import { useState, useEffect, useRef, useCallback } from 'react';
import {
  checkBackendHealth,
  getBackendBaseUrl,
  getWebSocketUrl,
} from '../services/healthService';
import { PCMAudioCaptureManager } from '../audio/pcmProcessor';
import { TranslationWebSocketClient } from '../services/translationWebSocket';
import type {
  BackendConnectionState,
  CaptionEntry,
  LiveCaptionState,
  BackendWebSocketEvent,
  AsrPartialEvent,
  TranslationEvent,
  ErrorEvent,
} from '../types/translation';

// Supported language codes
export type SourceLanguage = 'ta-IN' | 'hi-IN' | 'te-IN' | 'kn-IN' | 'ml-IN' | 'bn-IN' | 'mr-IN' | 'en-IN';
export type TargetLanguage = 'en-IN' | 'hi-IN' | 'ta-IN' | 'te-IN' | 'kn-IN' | 'ml-IN' | 'bn-IN' | 'mr-IN';

export function useLiveTranslation() {
  const [connectionState, setConnectionState] = useState<BackendConnectionState>('idle');
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>(getBackendBaseUrl());
  const [wsUrl, setWsUrl] = useState<string>(getWebSocketUrl());
  const [error, setError] = useState<string | null>(null);

  const [speakerId, setSpeakerId] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem('indic_speaker_id');
      if (stored) return stored;
    } catch {
      // ignore
    }
    return 'user-A';
  });

  // Language selection state
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('ta-IN');
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>('en-IN');

  const [sessionId, setSessionId] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const [liveCaption, setLiveCaption] = useState<LiveCaptionState>({
    currentOriginal: '',
    currentCommitted: '',
    currentTentative: '',
    isFinal: false,
    speakerId: 'user-A',
  });

  const [captionHistory, setCaptionHistory] = useState<CaptionEntry[]>([]);

  const audioManagerRef = useRef<PCMAudioCaptureManager | null>(null);
  const wsClientRef = useRef<TranslationWebSocketClient | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  /**
   * A session token (incrementing integer) that prevents stale async callbacks
   * from a previous session from affecting the current one.
   * Each new startSpeaking() call bumps this number; every async continuation
   * checks that its captured token still matches the current value.
   */
  const sessionTokenRef = useRef<number>(0);

  const updateSpeakerId = useCallback((newId: string) => {
    const trimmed = newId.trim() || 'user-A';
    setSpeakerId(trimmed);
    try {
      sessionStorage.setItem('indic_speaker_id', trimmed);
    } catch {
      // ignore
    }
  }, []);

  const runHealthCheck = useCallback(async () => {
    setConnectionState('checking');
    setError(null);
    const result = await checkBackendHealth();
    setBackendUrl(result.url);
    setWsUrl(result.wsUrl);
    setBackendHealthy(result.isHealthy);
    if (result.isHealthy) {
      setConnectionState('idle');
    } else {
      setConnectionState('backend_unavailable');
      setError(`Backend server at ${result.url} is unreachable. Make sure FastAPI is running.`);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  // cleanupSession must be defined before handleWebSocketMessage
  const cleanupSession = useCallback((cancelToken?: number) => {
    // If a specific token was provided, only clean up if it matches the current session
    if (cancelToken !== undefined && cancelToken !== sessionTokenRef.current) {
      return;
    }
    if (audioManagerRef.current) {
      audioManagerRef.current.stop();
      audioManagerRef.current = null;
    }
    if (wsClientRef.current) {
      wsClientRef.current.close();
      wsClientRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  const handleWebSocketMessage = useCallback(
    (rawEvent: BackendWebSocketEvent) => {
      switch (rawEvent.type) {
        case 'asr_partial': {
          const ev = rawEvent as AsrPartialEvent;
          const asrText = ev.text || '';
          setLiveCaption((prev): LiveCaptionState => ({
            ...prev,
            currentOriginal: asrText,
            speakerId: ev.speaker_id || prev.speakerId,
          }));
          setConnectionState('listening');
          break;
        }
        case 'translation': {
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
            const entry: CaptionEntry = {
              id: `caption-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              speakerId,
              originalText: origText,
              translatedText: fullTranslation,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              isFinal: true,
            };
            setCaptionHistory((prev) => [...prev, entry]);
            setLiveCaption({ currentOriginal: '', currentCommitted: '', currentTentative: '', isFinal: false, speakerId });
          } else {
            setLiveCaption((prev): LiveCaptionState => ({
              ...prev,
              currentOriginal: origText || prev.currentOriginal,
              currentCommitted: committed,
              currentTentative: tentative,
              isFinal: false,
            }));
          }
          setConnectionState('processing');
          break;
        }
        case 'done': {
          if (stopTimeoutRef.current) {
            clearTimeout(stopTimeoutRef.current);
            stopTimeoutRef.current = null;
          }
          cleanupSession();
          setConnectionState('connected');
          break;
        }
        case 'error': {
          const ev = rawEvent as ErrorEvent;
          setError(`Backend Error: ${ev.message || 'Unknown processing error'}`);
          setConnectionState('error');
          break;
        }
        default:
          break;
      }
    },
    [speakerId, cleanupSession]
  );

  /**
   * Full startup sequence with ACK gate:
   *
   *  idle → connecting → waiting_ack → requesting_mic → listening
   *
   * Microphone is NEVER initialized before the backend returns {"type":"started"}.
   */
  const startSpeaking = useCallback(async () => {
    // Bump session token – any stale callbacks will detect a mismatch
    const myToken = sessionTokenRef.current + 1;
    sessionTokenRef.current = myToken;

    const isCancelled = () => sessionTokenRef.current !== myToken;

    setError(null);
    setConnectionState('connecting');

    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setSessionId(newSessionId);

    // Clean up any previous session first
    if (audioManagerRef.current) {
      audioManagerRef.current.stop();
      audioManagerRef.current = null;
    }
    if (wsClientRef.current) {
      wsClientRef.current.cancelAndClose('New session started');
      wsClientRef.current = null;
    }

    try {
      // ── Step 1: Open WebSocket ─────────────────────────────────────────────
      const wsClient = new TranslationWebSocketClient({
        onMessage: handleWebSocketMessage,
        onError: () => {
          if (isCancelled()) return;
          setError(`WebSocket connection failed. Ensure backend is running at ${wsUrl}`);
          setConnectionState('error');
          cleanupSession(myToken);
        },
        onClose: (_code: number, _reason: string) => {
          if (isCancelled()) return;
          setConnectionState((prev) => {
            if (
              prev === 'listening' ||
              prev === 'processing' ||
              prev === 'connected' ||
              prev === 'waiting_ack'
            ) {
              return 'disconnected';
            }
            return prev;
          });
        },
      });

      await wsClient.connect(wsUrl);

      if (isCancelled()) {
        wsClient.close();
        return;
      }

      wsClientRef.current = wsClient;

      // ── Step 2: Send START and wait for backend "started" ACK ─────────────
      setConnectionState('waiting_ack');
      console.debug('[useLiveTranslation] Sending start, waiting for ACK…');

      await wsClient.sendStartAndWaitForAck(
        newSessionId,
        speakerId,
        sourceLanguage,
        targetLanguage,
        8000 // 8-second timeout
      );

      if (isCancelled()) {
        // User stopped while waiting for ACK – do not start microphone
        wsClient.sendStop();
        wsClient.close();
        return;
      }

      console.debug('[useLiveTranslation] Backend ACK received – requesting microphone…');

      // ── Step 3: Request microphone ONLY after ACK ──────────────────────────
      setConnectionState('requesting_mic');

      const audioManager = new PCMAudioCaptureManager({
        onAudioChunk: (base64Pcm) => {
          if (isCancelled()) return;
          if (wsClient.isOpen() && wsClient.hasAcknowledgedSession) {
            wsClient.sendAudioChunk(base64Pcm);
          }
        },
        onAudioLevel: (level) => {
          if (!isCancelled()) setAudioLevel(level);
        },
        onError: (err) => {
          if (isCancelled()) return;
          setError(err.message || 'Microphone error occurred.');
          setConnectionState('error');
          cleanupSession(myToken);
        },
      });

      await audioManager.start();

      if (isCancelled()) {
        // User stopped while microphone was initialising
        audioManager.stop();
        wsClient.sendStop();
        wsClient.close();
        return;
      }

      audioManagerRef.current = audioManager;
      setIsRecording(true);
      setConnectionState('listening');
      console.debug('[useLiveTranslation] Microphone started – streaming audio');

    } catch (err: unknown) {
      if (isCancelled()) return; // Stop was clicked; don't clobber its state
      cleanupSession(myToken);
      const msg = err instanceof Error ? err.message : 'Failed to start speaking session.';
      setError(msg);
      setConnectionState('error');
    }
  }, [wsUrl, speakerId, sourceLanguage, targetLanguage, handleWebSocketMessage, cleanupSession]);

  /**
   * Stop sequence:
   *   1. Bump session token so stale async continuations are ignored.
   *   2. Stop audio capture (no more chunks).
   *   3. Send STOP to backend (only if START was sent).
   *   4. Transition to finalizing, wait for "done" or timeout.
   */
  const stopSpeaking = useCallback(() => {
    // Invalidate the current session token to cancel any in-flight async work
    sessionTokenRef.current += 1;

    setConnectionState('finalizing');

    // 1. Stop audio FIRST – no more chunks will be produced
    if (audioManagerRef.current) {
      audioManagerRef.current.stop();
      audioManagerRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);

    // 2. Send STOP only after audio is stopped
    if (wsClientRef.current && wsClientRef.current.isOpen()) {
      try {
        wsClientRef.current.sendStop();
      } catch (err) {
        console.warn('[useLiveTranslation] Failed to send stop message:', err);
      }
    }

    // 3. Wait up to 6 seconds for "done" event, then cleanup
    stopTimeoutRef.current = window.setTimeout(() => {
      cleanupSession();
      setConnectionState('idle');
    }, 6000);
  }, [cleanupSession]);

  const clearHistory = useCallback(() => {
    setCaptionHistory([]);
    setLiveCaption({ currentOriginal: '', currentCommitted: '', currentTentative: '', isFinal: false, speakerId });
  }, [speakerId]);

  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      cleanupSession();
    };
  }, [cleanupSession]);

  return {
    connectionState,
    backendHealthy,
    backendUrl,
    wsUrl,
    speakerId,
    setSpeakerId: updateSpeakerId,
    sourceLanguage,
    setSourceLanguage,
    targetLanguage,
    setTargetLanguage,
    sessionId,
    isRecording,
    audioLevel,
    liveCaption,
    captionHistory,
    error,
    startSpeaking,
    stopSpeaking,
    clearHistory,
    runHealthCheck,
  };
}
