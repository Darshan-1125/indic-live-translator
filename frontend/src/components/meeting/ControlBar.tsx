import React from 'react';
import { Mic, MicOff, Video, VideoOff, Subtitles, PhoneOff } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';

interface ControlBarProps {
  isMuted: boolean;
  isVideoOff: boolean;
  showSubtitles: boolean;
  preferredLanguage: string;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleSubtitles: () => void;
  onLanguageChange: (lang: string) => void;
  onLeaveMeeting: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isMuted,
  isVideoOff,
  showSubtitles,
  preferredLanguage,
  onToggleMic,
  onToggleVideo,
  onToggleSubtitles,
  onLanguageChange,
  onLeaveMeeting,
}) => {
  return (
    <div className="w-full bg-slate-900/90 border-t border-slate-800 px-6 py-3 flex items-center justify-between gap-4">
      {/* Media Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-xl border transition-all ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-xl border transition-all ${
            isVideoOff
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
          title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleSubtitles}
          className={`p-3 rounded-xl border transition-all ${
            showSubtitles
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
          title={showSubtitles ? 'Hide Subtitles' : 'Show Subtitles'}
        >
          <Subtitles className="w-5 h-5" />
        </button>
      </div>

      {/* Target Audio/Subtitle Language Selector */}
      <div className="flex items-center gap-3">
        <div className="w-48">
          <LanguageSelector
            label="Live Audio & Subtitles"
            selectedCode={preferredLanguage}
            onChange={onLanguageChange}
          />
        </div>
      </div>

      {/* End Call */}
      <div>
        <button
          onClick={onLeaveMeeting}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-rose-900/30"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Leave Meeting</span>
        </button>
      </div>
    </div>
  );
};
