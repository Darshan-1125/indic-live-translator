import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  type LocalParticipant,
  type RemoteParticipant,
} from 'livekit-client';
import { getLiveKitConfig } from '../config/livekit';

export interface LiveKitContextType {
  room: Room | null;
  connectionState: ConnectionState;
  error: string | null;
  useMockMode: boolean;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  connect: (url?: string, token?: string) => Promise<void>;
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

  // Helper to sync participant list from room state
  const syncParticipants = useCallback((activeRoom: Room) => {
    setLocalParticipant(activeRoom.localParticipant);
    setRemoteParticipants(Array.from(activeRoom.remoteParticipants.values()));
  }, []);

  const connect = useCallback(
    async (overrideUrl?: string, overrideToken?: string) => {
      const config = getLiveKitConfig();
      const serverUrl = overrideUrl || config.serverUrl;
      const token = overrideToken || config.token;

      if (!serverUrl || !token) {
        setUseMockMode(true);
        setError('Missing LiveKit server URL or token. Falling back to Mock Mode.');
        return;
      }

      try {
        setError(null);
        setConnectionState(ConnectionState.Connecting);

        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Setup event handlers
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

        newRoom.on(RoomEvent.ParticipantConnected, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.TrackSubscribed, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.TrackUnsubscribed, () => syncParticipants(newRoom));
        newRoom.on(RoomEvent.ActiveSpeakersChanged, () => syncParticipants(newRoom));

        await newRoom.connect(serverUrl, token);
        setRoom(newRoom);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect to LiveKit server';
        setError(errorMessage);
        setConnectionState(ConnectionState.Disconnected);
        setUseMockMode(true); // Graceful fallback to mock mode
      }
    },
    [syncParticipants]
  );

  const disconnect = useCallback(async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
    }
    setConnectionState(ConnectionState.Disconnected);
  }, [room]);

  const toggleMockMode = useCallback((enabled?: boolean) => {
    setUseMockMode((prev) => (enabled !== undefined ? enabled : !prev));
  }, []);

  const toggleMicrophone = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      const targetParticipant = room?.localParticipant || localParticipant;
      if (targetParticipant && !useMockMode && connectionState === ConnectionState.Connected) {
        try {
          await targetParticipant.setMicrophoneEnabled(enabled);
          return true;
        } catch (err: unknown) {
          console.warn('Failed to toggle LiveKit microphone:', err);
          return false;
        }
      }
      return true;
    },
    [room, localParticipant, useMockMode, connectionState]
  );

  const toggleCamera = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      const targetParticipant = room?.localParticipant || localParticipant;
      if (targetParticipant && !useMockMode && connectionState === ConnectionState.Connected) {
        try {
          await targetParticipant.setCameraEnabled(enabled);
          return true;
        } catch (err: unknown) {
          console.warn('Failed to toggle LiveKit camera:', err);
          return false;
        }
      }
      return true;
    },
    [room, localParticipant, useMockMode, connectionState]
  );

  // Cleanup room on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return (
    <LiveKitContext.Provider
      value={{
        room,
        connectionState,
        error,
        useMockMode,
        localParticipant,
        remoteParticipants,
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
