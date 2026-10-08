import React from 'react';
import { Mic, MicOff, Volume2, VideoOff } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type Participant } from '../types/meeting';

interface ParticipantCardProps {
  participant: Participant;
  isSelf?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isSelf = false,
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  return (
    <div
      className={`relative bg-slate-900 border rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[200px] sm:min-h-[220px] shadow-lg transition-all duration-300 ${
        participant.isSpeaking
          ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-500/10'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Video Content / Avatar Placeholder */}
      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 flex flex-col items-center justify-center relative p-6">
        {participant.isVideoOff ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-200 font-bold text-xl sm:text-2xl shadow-inner">
              {getInitials(participant.name)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800">
              <VideoOff className="w-3 h-3 text-slate-500" />
              <span>Camera Off</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Simulated Video feed placeholder */}
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-xl transition-transform ${
                isSelf
                  ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white border-2 border-indigo-400/50'
                  : 'bg-slate-800 text-indigo-300 border-2 border-indigo-500/30'
              }`}
            >
              {getInitials(participant.name)}
            </div>
          </div>
        )}

        {/* Participant Name Badge */}
        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-slate-200 text-xs font-medium px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
          <span>{participant.name}</span>
          {isSelf && <span className="text-[10px] text-indigo-400 font-semibold">(You)</span>}
        </div>

        {/* Active Speaking Indicator */}
        {participant.isSpeaking && !participant.isMuted && (
          <div className="absolute top-3 right-3 bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Speaking</span>
          </div>
        )}
      </div>

      {/* Footer Info: Language & Mic status */}
      <div className="w-full bg-slate-950/70 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-medium">
          Lang: <span className="text-slate-200">{getLanguageName(participant.speakingLanguage)}</span>
        </span>

        <div
          className={`p-1.5 rounded-lg border transition-colors ${
            participant.isMuted
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              : 'bg-slate-800 text-emerald-400 border-slate-700'
          }`}
          title={participant.isMuted ? 'Microphone Muted' : 'Microphone Active'}
        >
          {participant.isMuted ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
};
