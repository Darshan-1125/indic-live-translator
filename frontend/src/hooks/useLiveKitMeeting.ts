import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Track } from 'livekit-client';
import { useLiveKit, type LiveKitCredentials } from '../context/LiveKitContext';
import type { Participant } from '../types/meeting';
import { INITIAL_MOCK_PARTICIPANTS } from '../data/mockParticipants';

export function useLiveKitMeeting(
  userSpokenLang: string = 'hi',
  userName: string = 'You',
  preferredLanguage: string = 'en'
) {
  const {
    room,
    connectionState,
    connectionStatusDisplay,
    useMockMode,
    error: livekitError,
    localParticipant,
    remoteParticipants,
    participantVersion,
    connect: contextConnect,
    disconnect: contextDisconnect,
    toggleMockMode,
    toggleMicrophone: contextToggleMicrophone,
    toggleCamera: contextToggleCamera,
  } = useLiveKit();

  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Local media tracks management for mock mode or offline mode
  const [mockMicActive, setMockMicActive] = useState<boolean>(false);
  const [mockCameraActive, setMockCameraActive] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const isConnected = connectionState === 'connected' && !useMockMode;

  // Cleanup local tracks on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  // Clean connect wrapper supporting credentials object or string params
  const connect = useCallback(
    async (credentialsOrUrl?: LiveKitCredentials | string, token?: string) => {
      await contextConnect(credentialsOrUrl, token);
    },
    [contextConnect]
  );

  // Clean disconnect wrapper that also stops any local media tracks
  const disconnect = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setMockMicActive(false);
    setMockCameraActive(false);
    await contextDisconnect();
  }, [contextDisconnect]);

  // Toggle Microphone for active mode with real device capture and permission check
  const toggleMicrophone = useCallback(
    async (enable: boolean): Promise<{ success: boolean; error?: string }> => {
      setDeviceError(null);

      if (isConnected) {
        try {
          await contextToggleMicrophone(enable);
          return { success: true };
        } catch (err: unknown) {
          const errorMsg =
            err instanceof Error ? err.message : 'Microphone access denied or audio device error.';
          setDeviceError(`Microphone error: ${errorMsg}`);
          return { success: false, error: errorMsg };
        }
      }

      // Offline / Mock Mode: Request real audio capture from browser
      if (enable) {
        if (!navigator.mediaDevices?.getUserMedia) {
          const errorMsg = 'Audio capture not supported in this browser environment.';
          setDeviceError(errorMsg);
          return { success: false, error: errorMsg };
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const newAudioTrack = stream.getAudioTracks()[0];

          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }

          // Clean up old audio tracks if any
          localStreamRef.current.getAudioTracks().forEach((t) => {
            t.stop();
            localStreamRef.current?.removeTrack(t);
          });

          localStreamRef.current.addTrack(newAudioTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          setMockMicActive(true);
          return { success: true };
        } catch (err: unknown) {
          const errorMsg =
            err instanceof Error ? err.message : 'Microphone permission denied.';
          setDeviceError(`Microphone error: ${errorMsg}`);
          setMockMicActive(false);
          return { success: false, error: errorMsg };
        }
      } else {
        // Stop audio capture
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => {
            t.stop();
            localStreamRef.current?.removeTrack(t);
          });
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setMockMicActive(false);
        return { success: true };
      }
    },
    [isConnected, contextToggleMicrophone]
  );

  // Toggle Camera for active mode with real device capture and permission check
  const toggleCamera = useCallback(
    async (enable: boolean): Promise<{ success: boolean; error?: string }> => {
      setDeviceError(null);

      if (isConnected) {
        try {
          await contextToggleCamera(enable);
          return { success: true };
        } catch (err: unknown) {
          const errorMsg =
            err instanceof Error ? err.message : 'Camera access denied or video device error.';
          setDeviceError(`Camera error: ${errorMsg}`);
          return { success: false, error: errorMsg };
        }
      }

      // Offline / Mock Mode: Request real video capture from browser
      if (enable) {
        if (!navigator.mediaDevices?.getUserMedia) {
          const errorMsg = 'Camera not supported in this browser environment.';
          setDeviceError(errorMsg);
          return { success: false, error: errorMsg };
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = stream.getVideoTracks()[0];

          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }

          // Clean up old video tracks if any
          localStreamRef.current.getVideoTracks().forEach((t) => {
            t.stop();
            localStreamRef.current?.removeTrack(t);
          });

          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          setMockCameraActive(true);
          return { success: true };
        } catch (err: unknown) {
          const errorMsg =
            err instanceof Error ? err.message : 'Camera permission denied.';
          setDeviceError(`Camera error: ${errorMsg}`);
          setMockCameraActive(false);
          return { success: false, error: errorMsg };
        }
      } else {
        // Stop camera capture
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => {
            t.stop();
            localStreamRef.current?.removeTrack(t);
          });
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setMockCameraActive(false);
        return { success: true };
      }
    },
    [isConnected, contextToggleCamera]
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
        rawParticipant: rp,
      };
    });
  }, [isConnected, remoteParticipants]);

  // Single authoritative state for local participant:
  // Derived directly from the active media source (LiveKit local participant or local MediaStream)
  const isMuted = isConnected
    ? (localParticipant ? !localParticipant.isMicrophoneEnabled : true)
    : !mockMicActive;

  const isVideoOff = isConnected
    ? (localParticipant ? !localParticipant.isCameraEnabled : true)
    : !mockCameraActive;

  const localParticipantState = useMemo<Participant>(() => {
    if (isConnected && localParticipant) {
      return {
        id: localParticipant.sid || localParticipant.identity,
        name: localParticipant.name || localParticipant.identity || userName,
        speakingLanguage: userSpokenLang,
        listeningLanguage: preferredLanguage,
        isMuted: !localParticipant.isMicrophoneEnabled,
        isVideoOff: !localParticipant.isCameraEnabled,
        isSpeaking: localParticipant.isSpeaking,
        isLiveKitParticipant: true,
        rawParticipant: localParticipant,
      };
    }

    return {
      id: 'user-self',
      name: userName,
      speakingLanguage: userSpokenLang,
      listeningLanguage: preferredLanguage,
      isMuted: !mockMicActive,
      isVideoOff: !mockCameraActive,
      isSpeaking: mockMicActive,
      localStream: localStream,
    };
  }, [
    isConnected,
    localParticipant,
    participantVersion,
    userSpokenLang,
    userName,
    preferredLanguage,
    mockMicActive,
    mockCameraActive,
    localStream,
  ]);

  // Expose active local microphone track for speech translation pipeline
  const localAudioTrack = useMemo<MediaStreamTrack | null>(() => {
    if (isConnected && localParticipant) {
      if (!localParticipant.isMicrophoneEnabled) return null;
      const pubMap = localParticipant.audioTrackPublications as Map<string, any>;
      const pubList = Array.from(pubMap.values());
      const trackPub = pubList.find(
        (pub) => pub.source === Track.Source.Microphone || pub.kind === Track.Kind.Audio
      );
      return trackPub?.track?.mediaStreamTrack || null;
    }

    if (mockMicActive && localStream) {
      const audioTracks = localStream.getAudioTracks();
      return audioTracks.length > 0 && audioTracks[0].readyState === 'live'
        ? audioTracks[0]
        : null;
    }

    return null;
  }, [isConnected, localParticipant, participantVersion, mockMicActive, localStream]);

  return {
    room,
    connectionState,
    connectionStatusDisplay,
    error: livekitError,
    deviceError,
    useMockMode,
    isConnected,
    isMuted,
    isVideoOff,
    localAudioTrack,
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
