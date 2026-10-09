import { useState } from 'react';
import { Radio, Video } from 'lucide-react';
import { MeetingHeader } from './components/MeetingHeader';
import { JoinMeeting } from './pages/JoinMeeting';
import { MeetingRoom } from './pages/MeetingRoom';
import { LiveTranslationView } from './components/LiveTranslationView';
import type { RoomConfig } from './types/meeting';
import { LiveKitProvider } from './context/LiveKitContext';

export function App() {
  const [activeTab, setActiveTab] = useState<'ai_translation' | 'meeting_room'>('ai_translation');
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);

  const handleJoinRoom = (config: RoomConfig) => {
    setRoomConfig(config);
    setActiveTab('meeting_room');
  };

  const handleLeaveRoom = () => {
    setRoomConfig(null);
  };

  return (
    <LiveKitProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Navigation Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              IndicLive
            </span>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('ai_translation')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'ai_translation'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>AI Live Translation (WebSocket MVP)</span>
              </button>

              <button
                onClick={() => setActiveTab('meeting_room')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'meeting_room'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Meeting Room</span>
              </button>
            </div>
          </div>

          {activeTab === 'meeting_room' && (
            <MeetingHeader
              roomId={roomConfig?.roomId}
              userName={roomConfig?.userName}
              spokenLanguage={roomConfig?.spokenLanguage}
              preferredLanguage={roomConfig?.preferredLanguage}
              onLeaveRoom={roomConfig ? handleLeaveRoom : undefined}
            />
          )}
        </div>

        {/* Main Content View */}
        <main className="flex-1">
          {activeTab === 'ai_translation' ? (
            <LiveTranslationView />
          ) : roomConfig ? (
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
