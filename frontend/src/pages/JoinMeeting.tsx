import React, { useState } from 'react';
import { Sparkles, User, Key, ArrowRight, Server, ChevronDown, ChevronUp } from 'lucide-react';
import type { RoomConfig } from '../types/meeting';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLiveKit } from '../context/LiveKitContext';

interface JoinMeetingProps {
  onJoinRoom: (config: RoomConfig) => void;
}

export const JoinMeeting: React.FC<JoinMeetingProps> = ({ onJoinRoom }) => {
  const { useMockMode, toggleMockMode } = useLiveKit();

  const [userName, setUserName] = useState('Rahul Verma');
  const [roomId, setRoomId] = useState('indic-meet-101');
  const [spokenLanguage, setSpokenLanguage] = useState('hi');
  const [preferredLanguage, setPreferredLanguage] = useState('en');

  // Optional LiveKit server connection override fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [livekitUrl, setLivekitUrl] = useState('');
  const [livekitToken, setLivekitToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomId.trim()) return;

    onJoinRoom({
      userName: userName.trim(),
      roomId: roomId.trim(),
      spokenLanguage,
      preferredLanguage,
      livekitUrl: livekitUrl.trim() || undefined,
      livekitToken: livekitToken.trim() || undefined,
    });
  };

  return (
    <div className="min-h-[calc(100vh-61px)] bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative gradient blur background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            AI-Powered Indic Translation Engine
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Join Multilingual Meeting Room
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
            Speak naturally in your native language while participants receive live audio & subtitle translations.
          </p>
        </div>

        {/* Mode Toggle Banner */}
        <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Connection Mode:</span>
            <span className="font-semibold text-indigo-300">
              {useMockMode ? 'Interactive Mock Mode' : 'LiveKit Server Mode'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => toggleMockMode()}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30 transition-colors cursor-pointer"
          >
            Switch to {useMockMode ? 'LiveKit Mode' : 'Mock Mode'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Name input */}
          <div className="space-y-1.5">
            <label htmlFor="user-name-input" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Your Display Name
            </label>
            <input
              id="user-name-input"
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Rahul Verma"
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Meeting Room ID input */}
          <div className="space-y-1.5">
            <label htmlFor="room-id-input" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Meeting Room ID
            </label>
            <input
              id="room-id-input"
              type="text"
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. indic-meet-101"
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
            />
          </div>

          {/* Language selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <LanguageSelector
              id="spoken-language-selector"
              label="I Will Speak In"
              selectedCode={spokenLanguage}
              onChange={setSpokenLanguage}
            />
            <LanguageSelector
              id="subtitle-language-selector"
              label="I Want Subtitles In"
              selectedCode={preferredLanguage}
              onChange={setPreferredLanguage}
            />
          </div>

          {/* Optional Advanced LiveKit Credentials Collapsible */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>LiveKit Connection Settings (Optional)</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <p className="text-[11px] text-slate-400">
                  Leave blank to use environment variables (`VITE_LIVEKIT_URL`, `VITE_LIVEKIT_TOKEN`) or Mock Mode.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300">LiveKit Server URL</label>
                  <input
                    type="text"
                    value={livekitUrl}
                    onChange={(e) => setLivekitUrl(e.target.value)}
                    placeholder="wss://your-livekit-server.livekit.cloud"
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-700 px-3 py-2 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300">LiveKit Room Token</label>
                  <input
                    type="password"
                    value={livekitToken}
                    onChange={(e) => setLivekitToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-700 px-3 py-2 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <span>Enter Meeting Room</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
};
