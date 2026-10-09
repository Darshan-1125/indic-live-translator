import React, { useState } from 'react';
import { Sparkles, User, Key, ArrowRight, Server, AlertCircle, Loader2 } from 'lucide-react';
import type { RoomConfig } from '../types/meeting';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLiveKit } from '../context/LiveKitContext';
import { fetchLiveKitToken } from '../services/livekitService';

interface JoinMeetingProps {
  onJoinRoom: (config: RoomConfig) => void;
}

export const JoinMeeting: React.FC<JoinMeetingProps> = ({ onJoinRoom }) => {
  const { useMockMode, toggleMockMode } = useLiveKit();

  const [userName, setUserName] = useState('Rahul Verma');
  const [roomId, setRoomId] = useState('indic-meet-101');
  const [spokenLanguage, setSpokenLanguage] = useState('hi');
  const [preferredLanguage, setPreferredLanguage] = useState('en');

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUserName = userName.trim();
    const cleanRoomId = roomId.trim();

    if (!cleanUserName || !cleanRoomId) return;

    // If Mock Mode is active, join immediately without backend API call
    if (useMockMode) {
      onJoinRoom({
        userName: cleanUserName,
        roomId: cleanRoomId,
        spokenLanguage,
        preferredLanguage,
      });
      return;
    }

    // Real LiveKit Mode: Request token from backend API
    setIsLoading(true);
    setApiError(null);

    try {
      const { token, url } = await fetchLiveKitToken(cleanRoomId, cleanUserName);

      onJoinRoom({
        userName: cleanUserName,
        roomId: cleanRoomId,
        spokenLanguage,
        preferredLanguage,
        livekitUrl: url,
        livekitToken: token,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to connect to the meeting server. Please try again.';
      setApiError(errorMessage);
      setIsLoading(false);
    }
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
            <span>Mode:</span>
            <span className="font-semibold text-indigo-300">
              {useMockMode ? 'Interactive Mock Mode' : 'Live Backend Token Mode'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setApiError(null);
              toggleMockMode();
            }}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30 transition-colors cursor-pointer"
          >
            Switch to {useMockMode ? 'Live Backend Mode' : 'Mock Mode'}
          </button>
        </div>

        {/* API Error Alert */}
        {apiError && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-rose-200">{apiError}</p>
              </div>
            </div>
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setApiError(null);
                  toggleMockMode(true);
                }}
                className="text-[11px] underline text-indigo-300 hover:text-indigo-200 cursor-pointer"
              >
                Continue in Offline Mock Mode &rarr;
              </button>
            </div>
          </div>
        )}

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
              disabled={isLoading}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Rahul Verma"
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
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
              disabled={isLoading}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. indic-meet-101"
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono disabled:opacity-50"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Connecting to Meeting Server...</span>
              </>
            ) : (
              <>
                <span>Enter Meeting Room</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
