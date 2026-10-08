import { useState } from 'react';
import { MeetingHeader } from './components/MeetingHeader';
import { JoinMeeting } from './pages/JoinMeeting';
import { MeetingRoom } from './pages/MeetingRoom';
import type { RoomConfig } from './types/meeting';
import { LiveKitProvider } from './context/LiveKitContext';

export function App() {
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);

  const handleJoinRoom = (config: RoomConfig) => {
    setRoomConfig(config);
  };

  const handleLeaveRoom = () => {
    setRoomConfig(null);
  };

  return (
    <LiveKitProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <MeetingHeader
          roomId={roomConfig?.roomId}
          userName={roomConfig?.userName}
          spokenLanguage={roomConfig?.spokenLanguage}
          preferredLanguage={roomConfig?.preferredLanguage}
          onLeaveRoom={roomConfig ? handleLeaveRoom : undefined}
        />
        <main className="flex-1">
          {roomConfig ? (
            <MeetingRoom config={roomConfig} onLeaveRoom={handleLeaveRoom} />
          ) : (
            <JoinMeeting onJoinRoom={handleJoinRoom} />
          )}
        </main>
      </div>
    </LiveKitProvider>
  );
}

export default App;
