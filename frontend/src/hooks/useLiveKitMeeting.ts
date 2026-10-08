import { useMemo, useCallback, useState } from 'react';
import { useLiveKit } from '../context/LiveKitContext';
import type { Participant } from '../types/meeting';
import { INITIAL_MOCK_PARTICIPANTS } from '../data/mockParticipants';

export function useLiveKitMeeting(userSpokenLang: string = 'hi') {
  const {
    room,
    connectionState,
    useMockMode,
    error: livekitError,
    localParticipant,
    remoteParticipants,
    connect,
    disconnect,
    toggleMockMode,
    toggleMicrophone: contextToggleMicrophone,
    toggleCamera: contextToggleCamera,
  } = useLiveKit();

  const [deviceError, setDeviceError] = useState<string | null>(null);

  const isConnected = connectionState === 'connected' && !useMockMode;

  // Toggle Microphone for local participant using context API with error state capture
  const toggleMicrophone = useCallback(
    async (enable: boolean): Promise<{ success: boolean; error?: string }> => {
      setDeviceError(null);
      const success = await contextToggleMicrophone(enable);
      if (!success) {
        const errorMsg = 'Microphone access denied or audio device error.';
        setDeviceError(`Microphone error: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
      return { success: true };
    },
    [contextToggleMicrophone]
  );

  // Toggle Camera for local participant using context API with error state capture
  const toggleCamera = useCallback(
    async (enable: boolean): Promise<{ success: boolean; error?: string }> => {
      setDeviceError(null);
      const success = await contextToggleCamera(enable);
      if (!success) {
        const errorMsg = 'Camera access denied or video device error.';
        setDeviceError(`Camera error: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
      return { success: true };
    },
    [contextToggleCamera]
  );

  // Map real LiveKit remote participants to frontend Participant type if connected
  const liveKitParticipants = useMemo<Participant[]>(() => {
    if (!isConnected) return INITIAL_MOCK_PARTICIPANTS;

    return remoteParticipants.map((rp) => {
      const isMuted = !rp.isMicrophoneEnabled;
      const isVideoOff = !rp.isCameraEnabled;

      return {
        id: rp.sid || rp.identity,
        name: rp.name || rp.identity || 'Remote Participant',
        speakingLanguage: rp.metadata
          ? (() => {
              try {
                return JSON.parse(rp.metadata)?.speakingLanguage || 'en';
              } catch {
                return 'en';
              }
            })()
          : 'en',
        listeningLanguage: 'en',
        isMuted,
        isVideoOff,
        isSpeaking: rp.isSpeaking,
        isLiveKitParticipant: true,
      };
    });
  }, [isConnected, remoteParticipants]);

  // Map local LiveKit participant state if connected
  const localParticipantState = useMemo<Participant | null>(() => {
    if (!isConnected || !localParticipant) return null;

    return {
      id: localParticipant.sid || localParticipant.identity,
      name: localParticipant.name || localParticipant.identity || 'You',
      speakingLanguage: userSpokenLang,
      listeningLanguage: 'en',
      isMuted: !localParticipant.isMicrophoneEnabled,
      isVideoOff: !localParticipant.isCameraEnabled,
      isSpeaking: localParticipant.isSpeaking,
      isLiveKitParticipant: true,
    };
  }, [isConnected, localParticipant, userSpokenLang]);

  return {
    room,
    connectionState,
    error: livekitError,
    deviceError,
    useMockMode,
    isConnected,
    localParticipant: localParticipantState,
    remoteParticipants: liveKitParticipants,
    toggleMicrophone,
    toggleCamera,
    connect,
    disconnect,
    toggleMockMode,
    clearDeviceError: () => setDeviceError(null),
  };
}
