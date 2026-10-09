import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  type LocalParticipant,
  type RemoteParticipant,
} from 'livekit-client';
import { getLiveKitConfig } from '../config/livekit';

export interface LiveKitCredentials {
  url: string;
  token: string;
}

export type ConnectionStatusDisplay = 'Connecting...' | 'Connected' | 'Disconnected' | 'Connection failed';

export interface LiveKitContextType {
  room: Room | null;
  connectionState: ConnectionState;
  connectionStatusDisplay: ConnectionStatusDisplay;
  error: string | null;
  useMockMode: boolean;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  participantVersion: number;
  connect: (credentialsOrUrl?: LiveKitCredentials | string, token?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMockMode: (enabled?: boolean) => void;
  toggleMicrophone: (enabled: boolean) => Promise<boolean>;
  toggleCamera: (enabled: boolean) => Promise<boolean>;
}

const LiveKitContext = createContext<LiveKitContextType | null>(null);

export const LiveKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  
  const initialConfig = getLiveKitConfig();
  const [useMockMode, setUseMockMode] = useState<boolean>(initialConfig.useMockMode);

  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [participantVersion, setParticipantVersion] = useState<number>(0);

  // Ref to track current room instance for safe listener cleanup
  const roomRef = useRef<Room | null>(null);

  // Derive explicit user-facing connection status string
  const connectionStatusDisplay: ConnectionStatusDisplay = useMemo(() => {
    if (useMockMode) return 'Disconnected';
    switch (connectionState) {
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Connected:
        return 'Connected';
      case ConnectionState.Reconnecting:
        return 'Connecting...';
      case ConnectionState.Disconnected:
        return error ? 'Connection failed' : 'Disconnected';
      default:
        return 'Disconnected';
    }
  }, [connectionState, useMockMode, error]);

  // Helper to sync participant list from active room state
  const syncParticipants = useCallback((activeRoom: Room) => {
    setLocalParticipant(activeRoom.localParticipant);
    setRemoteParticipants(Array.from(activeRoom.remoteParticipants.values()));
    setParticipantVersion((v) => v + 1);
  }, []);

  // Cleanup helper for room event listeners
  const cleanupRoom = useCallback(async (roomToClean: Room | null) => {
    if (!roomToClean) return;
    try {
      roomToClean.removeAllListeners();
      if (roomToClean.state !== ConnectionState.Disconnected) {
        // Stop local tracks before disconnect
        if (roomToClean.localParticipant) {
          try {
            await roomToClean.localParticipant.setMicrophoneEnabled(false);
            await roomToClean.localParticipant.setCameraEnabled(false);
          } catch {
            // ignore cleanup track errors
          }
        }
        await roomToClean.disconnect();
      }
    } catch (e) {
      console.warn('Error during room cleanup:', e);
    }
  }, []);

  const connect = useCallback(
    async (credentialsOrUrl?: LiveKitCredentials | string, tokenArg?: string) => {
      let serverUrl = '';
      let token = '';

      if (typeof credentialsOrUrl === 'object' && credentialsOrUrl !== null) {
        serverUrl = credentialsOrUrl.url;
        token = credentialsOrUrl.token;
      } else if (typeof credentialsOrUrl === 'string') {
        serverUrl = credentialsOrUrl;
        token = tokenArg || '';
      }

      const config = getLiveKitConfig();
      serverUrl = serverUrl || config.serverUrl;
      token = token || config.token;

      if (!serverUrl || !token) {
        setUseMockMode(true);
        setError('Missing LiveKit server URL or token. Falling back to Mock Mode.');
        return;
      }

      try {
        setError(null);
        setConnectionState(ConnectionState.Connecting);

        // Cleanup any existing room instance first
        if (roomRef.current) {
          await cleanupRoom(roomRef.current);
          roomRef.current = null;
        }

        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = newRoom;

        // Setup room event listeners
        newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          setConnectionState(state);
        });

        newRoom.on(RoomEvent.Connected, () => {
          setConnectionState(ConnectionState.Connected);
          setUseMockMode(false);
          syncParticipants(newRoom);
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          setConnectionState(ConnectionState.Disconnected);
          setLocalParticipant(null);
          setRemoteParticipants([]);
        });

        // Event listeners for participant & track updates
        newRoom.on(RoomEvent.ParticipantConnected, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.TrackSubscribed, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.TrackUnsubscribed, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.TrackMuted, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.TrackUnmuted, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.ActiveSpeakersChanged, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.LocalTrackPublished, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.LocalTrackUnpublished, () => syncParticipants(newRoom));

        await newRoom.connect(serverUrl, token);
        setRoom(newRoom);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect to LiveKit server';
        setError(errorMessage);
        setConnectionState(ConnectionState.Disconnected);
        setUseMockMode(true); // Graceful fallback to mock mode
      }
    },
    [syncParticipants, cleanupRoom]
  );

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await cleanupRoom(roomRef.current);
      roomRef.current = null;
    }
    setRoom(null);
    setLocalParticipant(null);
    setRemoteParticipants([]);
    setConnectionState(ConnectionState.Disconnected);
  }, [cleanupRoom]);

  const toggleMockMode = useCallback((enabled?: boolean) => {
    setUseMockMode((prev) => (enabled !== undefined ? enabled : !prev));
  }, []);

  const toggleMicrophone = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      const activeRoom = roomRef.current || room;
      const targetParticipant = activeRoom?.localParticipant || localParticipant;
      if (targetParticipant && !useMockMode && connectionState === ConnectionState.Connected) {
        try {
          await targetParticipant.setMicrophoneEnabled(enabled);
          if (activeRoom) {
            syncParticipants(activeRoom);
          }
          return true;
        } catch (err: unknown) {
          console.warn('Failed to toggle LiveKit microphone:', err);
          throw err;
        }
      }
      return true;
    },
    [room, localParticipant, useMockMode, connectionState, syncParticipants]
  );

  const toggleCamera = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      const activeRoom = roomRef.current || room;
      const targetParticipant = activeRoom?.localParticipant || localParticipant;
      if (targetParticipant && !useMockMode && connectionState === ConnectionState.Connected) {
        try {
          await targetParticipant.setCameraEnabled(enabled);
          if (activeRoom) {
            syncParticipants(activeRoom);
          }
          return true;
        } catch (err: unknown) {
          console.warn('Failed to toggle LiveKit camera:', err);
          throw err;
        }
      }
      return true;
    },
    [room, localParticipant, useMockMode, connectionState, syncParticipants]
  );

  // Cleanup room on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        cleanupRoom(roomRef.current);
      }
    };
  }, [cleanupRoom]);

  return (
    <LiveKitContext.Provider
      value={{
        room,
        connectionState,
        connectionStatusDisplay,
        error,
        useMockMode,
        localParticipant,
        remoteParticipants,
        participantVersion,
        connect,
        disconnect,
        toggleMockMode,
        toggleMicrophone,
        toggleCamera,
      }}
    >
      {children}
    </LiveKitContext.Provider>
  );
};

export const useLiveKit = (): LiveKitContextType => {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
};
