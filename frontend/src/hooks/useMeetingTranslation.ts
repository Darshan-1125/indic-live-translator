import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl } from '../services/healthService';
import { PCMAudioCaptureManager } from '../audio/pcmProcessor';
import { TranslationWebSocketClient } from '../services/translationWebSocket';
import type {
  BackendConnectionState,
  BackendWebSocketEvent,
  AsrPartialEvent,
  TranslationEvent,
  ErrorEvent,
} from '../types/translation';
import type { LiveTranscript } from '../types/meeting';

export interface MeetingTranslationOptions {
  activeAudioTrack: MediaStreamTrack | null;
  isMicMuted: boolean;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  speakerName: string;
  enabled?: boolean;
}

export interface LiveCaptionDisplay {
  originalText: string;
  translatedText: string;
  tentativeText: string;
  speakerName: string;
}

export function toBcp47Language(code: string): string {
  if (!code) return 'hi-IN';
  if (code.includes('-')) return code;
  const map: Record<string, string> = {
    hi: 'hi-IN',
    en: 'en-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    bn: 'bn-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    pa: 'pa-IN',
  };
  return map[code.toLowerCase()] || `${code}-IN`;
}

export function useMeetingTranslation({
  activeAudioTrack,
  isMicMuted,
  sourceLanguageCode,
  targetLanguageCode,
  speakerName,
  enabled = true,
}: MeetingTranslationOptions) {
  const [connectionState, setConnectionState] = useState<BackendConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(true);
  const [liveCaption, setLiveCaption] = useState<LiveCaptionDisplay | null>(null);
  const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);

  const sessionTokenRef = useRef<number>(0);
  const pcmCaptureRef = useRef<PCMAudioCaptureManager | null>(null);
  const wsClientRef = useRef<TranslationWebSocketClient | null>(null);

  const cleanupCurrentSession = useCallback(() => {
    if (pcmCaptureRef.current) {
      try {
        pcmCaptureRef.current.stop();
      } catch {
        // ignore
      }
      pcmCaptureRef.current = null;
    }

    if (wsClientRef.current) {
      try {
        if (wsClientRef.current.hasStartedSession) {
          wsClientRef.current.sendStop();
        }
        wsClientRef.current.close();
      } catch {
        // ignore
      }
      wsClientRef.current = null;
    }
  }, []);

  const handleEvent = useCallback(
    (rawEvent: BackendWebSocketEvent) => {
      switch (rawEvent.type) {
        case 'asr_partial': {
          const ev = rawEvent as AsrPartialEvent;
          setLiveCaption((prev) => ({
            originalText: ev.text || '',
            translatedText: prev?.translatedText || '',
            tentativeText: prev?.tentativeText || '',
            speakerName: ev.speaker_id || speakerName,
          }));
          setConnectionState('listening');
          break;
        }

        case 'translation':
        case 'caption': {
          const ev = rawEvent as TranslationEvent;
          const origText = ev.text || '';
          const transText = ev.translated_text || '';
          const stability = ev.stability;
          const isFinal = Boolean(ev.is_final);

          let committed = '';
          let tentative = '';

          if (stability) {
            committed = stability.cumulative_committed_text || '';
            tentative = stability.tentative_text || '';
          } else if (isFinal) {
            committed = transText;
          } else {
            tentative = transText;
          }

          if (isFinal) {
            const fullTranslation = (committed + ' ' + tentative).trim() || transText;
            if (origText || fullTranslation) {
              const entry: LiveTranscript = {
                id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                speakerId: 'user-self',
                speakerName: speakerName,
                originalText: origText,
                originalLanguage: sourceLanguageCode,
                translatedText: fullTranslation,
                targetLanguage: targetLanguageCode,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };
              setTranscripts((prev) => [entry, ...prev]);
            }
            setLiveCaption(null);
          } else {
            setLiveCaption({
              originalText: origText,
              translatedText: committed,
              tentativeText: tentative,
              speakerName: speakerName,
            });
          }
          setConnectionState('processing');
          break;
        }

        case 'error': {
          const ev = rawEvent as ErrorEvent;
          setError(`Backend Error: ${ev.message || 'Unknown processing error'}`);
          setConnectionState('error');
          break;
        }

        case 'done': {
          setLiveCaption(null);
          setConnectionState('idle');
          break;
        }
      }
    },
    [speakerName, sourceLanguageCode, targetLanguageCode]
  );

  useEffect(() => {
    // If translation disabled, or mic is muted, or no active track is available:
    if (!enabled || !isTranslating || isMicMuted || !activeAudioTrack) {
      sessionTokenRef.current += 1;
      cleanupCurrentSession();
      setConnectionState('idle');
      return;
    }

    const token = ++sessionTokenRef.current;
    const isCancelled = () => sessionTokenRef.current !== token;

    const startSession = async () => {
      setError(null);
      setConnectionState('connecting');

      const sessionId = `meet-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const srcCode = toBcp47Language(sourceLanguageCode);
      const tgtCode = toBcp47Language(targetLanguageCode);
      const wsUrl = getWebSocketUrl();

      try {
        const wsClient = new TranslationWebSocketClient({
          onMessage: (rawEvent) => {
            if (isCancelled()) return;
            handleEvent(rawEvent);
          },
          onError: () => {
            if (isCancelled()) return;
            setError(`Translation server at ${wsUrl} unreachable.`);
            setConnectionState('error');
            cleanupCurrentSession();
          },
          onClose: () => {
            if (isCancelled()) return;
            setConnectionState('idle');
          },
        });

        await wsClient.connect(wsUrl);
        if (isCancelled()) {
          wsClient.close();
          return;
        }

        wsClientRef.current = wsClient;
        setConnectionState('waiting_ack');

        await wsClient.sendStartAndWaitForAck(sessionId, speakerName, srcCode, tgtCode, 8000);
        if (isCancelled()) {
          wsClient.sendStop();
          wsClient.close();
          return;
        }

        setConnectionState('listening');

        // Capture raw 16kHz PCM by tapping the existing meeting microphone track
        const pcm = new PCMAudioCaptureManager({
          onAudioChunk: (base64) => {
            if (isCancelled()) return;
            if (wsClient.isOpen() && wsClient.hasAcknowledgedSession) {
              wsClient.sendAudioChunk(base64);
            }
          },
          onError: (e) => {
            if (isCancelled()) return;
            setError(e.message);
          },
        });

        await pcm.start(activeAudioTrack);
        if (isCancelled()) {
          pcm.stop();
          wsClient.sendStop();
          wsClient.close();
          return;
        }

        pcmCaptureRef.current = pcm;
      } catch (err: unknown) {
        if (isCancelled()) return;
        const msg =
          err instanceof Error ? err.message : 'Failed to start meeting speech translation.';
        setError(msg);
        setConnectionState('error');
        cleanupCurrentSession();
      }
    };

    startSession();

    return () => {
      sessionTokenRef.current += 1;
      cleanupCurrentSession();
    };
  }, [
    enabled,
    isTranslating,
    isMicMuted,
    activeAudioTrack,
    sourceLanguageCode,
    targetLanguageCode,
    speakerName,
    handleEvent,
    cleanupCurrentSession,
  ]);

  return {
    connectionState,
    error,
    liveCaption,
    transcripts,
    isTranslating,
    setIsTranslating,
    toggleTranslation: () => setIsTranslating((v) => !v),
    addTranscript: (item: LiveTranscript) => setTranscripts((prev) => [item, ...prev]),
    clearTranscripts: () => {
      setTranscripts([]);
      setLiveCaption(null);
    },
  };
}
