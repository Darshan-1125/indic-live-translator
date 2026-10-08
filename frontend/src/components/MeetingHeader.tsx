import React from 'react';
import { Languages, Video, User, Cpu, ShieldCheck } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../types/meeting';
import { useLiveKit } from '../context/LiveKitContext';

interface MeetingHeaderProps {
  roomId?: string;
  userName?: string;
  spokenLanguage?: string;
  preferredLanguage?: string;
  onLeaveRoom?: () => void;
}

export const MeetingHeader: React.FC<MeetingHeaderProps> = ({
  roomId,
  userName,
  spokenLanguage,
  preferredLanguage,
  onLeaveRoom,
}) => {
  const { useMockMode, connectionState, toggleMockMode } = useLiveKit();

  const getLanguageName = (code?: string) => {
    if (!code) return '';
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
      {/* Brand & Room Info */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400 shadow-sm">
          <Languages className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
            Indic Live Translator
            {/* LiveKit Mode vs Mock Mode Badge */}
            {useMockMode ? (
              <button
                onClick={() => toggleMockMode(false)}
                className="text-[10px] bg-purple-500/20 text-purple-300 font-medium px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1 hover:bg-purple-500/30 transition-colors cursor-pointer"
                title="Running in Demo Mock Mode. Click to attempt LiveKit server connection."
              >
                <Cpu className="w-3 h-3 text-purple-400" />
                <span>Mock Mode</span>
              </button>
            ) : connectionState === 'connected' ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>LiveKit Connected</span>
              </span>
            ) : (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-medium px-2 py-0.5 rounded-full border border-amber-500/30">
                LiveKit: {connectionState}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            Multilingual Real-Time Audio & Subtitle Translation
          </p>
        </div>
      </div>

      {/* Room metadata & Actions */}
      {roomId && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Room ID Badge */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80">
            <Video className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Room:</span>
            <span className="text-xs font-mono font-semibold text-emerald-400">{roomId}</span>
          </div>

          {/* User & Language Pills */}
          {userName && (
            <div className="hidden md:flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium text-slate-200">{userName}</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Spoken: <span className="text-indigo-300 font-medium">{getLanguageName(spokenLanguage)}</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Subtitles: <span className="text-purple-300 font-medium">{getLanguageName(preferredLanguage)}</span>
              </span>
            </div>
          )}

          {/* Leave Room Button */}
          {onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-1.5 rounded-xl border border-rose-500/30 transition-all cursor-pointer"
            >
              Leave Meeting
            </button>
          )}
        </div>
      )}
    </header>
  );
};
