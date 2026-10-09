import React from 'react';
import { Languages, Video } from 'lucide-react';

interface HeaderProps {
  roomId?: string;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ roomId, onLeaveRoom }) => {
  return (
    <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30 text-indigo-400">
          <Languages className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
            Indic Live Translator
            <span className="text-xs bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
              v0.1.0
            </span>
          </h1>
          <p className="text-xs text-slate-400">Real-time Multilingual Meeting Subtitles & Audio</p>
        </div>
      </div>

      {roomId && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <Video className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">Room:</span>
            <span className="text-xs font-mono font-semibold text-emerald-400">{roomId}</span>
          </div>

          {onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/30 transition-colors"
            >
              Leave Room
            </button>
          )}
        </div>
      )}
    </header>
  );
};
