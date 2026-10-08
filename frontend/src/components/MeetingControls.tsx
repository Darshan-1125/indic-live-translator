import React from 'react';
import { Mic, MicOff, Video, VideoOff, Subtitles, PhoneOff } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';

interface MeetingControlsProps {
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

export const MeetingControls: React.FC<MeetingControlsProps> = ({
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
    <div className="w-full bg-slate-900/95 border-t border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-40">
      {/* Media Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mic toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
        </button>

        {/* Camera toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            isVideoOff
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-indigo-400" />}
        </button>

        {/* Subtitles Panel toggle */}
        <button
          onClick={onToggleSubtitles}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
            showSubtitles
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
          title={showSubtitles ? 'Hide Subtitles Panel' : 'Show Subtitles Panel'}
        >
          <Subtitles className="w-5 h-5" />
          <span className="text-xs font-semibold hidden md:inline">
            {showSubtitles ? 'Subtitles Active' : 'Subtitles Off'}
          </span>
        </button>
      </div>

      {/* Target Subtitle Language Dropdown */}
      <div className="flex items-center gap-2">
        <div className="w-44 sm:w-52">
          <LanguageSelector
            id="control-language-selector"
            label="Translate Subtitles To"
            selectedCode={preferredLanguage}
            onChange={onLanguageChange}
          />
        </div>
      </div>

      {/* Leave Call Button */}
      <div>
        <button
          onClick={onLeaveMeeting}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-rose-900/30 cursor-pointer"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Leave Meeting</span>
        </button>
      </div>
    </div>
  );
};
