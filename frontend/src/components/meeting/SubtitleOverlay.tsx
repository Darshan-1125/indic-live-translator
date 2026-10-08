import React from 'react';
import { Subtitles, Volume2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LiveTranscript } from '../../types/meeting';

interface SubtitleOverlayProps {
  transcripts: LiveTranscript[];
  preferredLanguage: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  transcripts,
  preferredLanguage,
}) => {
  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Subtitles className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-200">Live Transcripts & Translations</h2>
        </div>
        <span className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
          Target: {getLanguageName(preferredLanguage)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
        {transcripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6 space-y-2">
            <Volume2 className="w-8 h-8 opacity-40 animate-pulse" />
            <p className="text-xs">Waiting for participants to speak...</p>
            <p className="text-[11px] text-slate-600">Subtitles will appear here dynamically in real time.</p>
          </div>
        ) : (
          transcripts.map((item) => (
            <div
              key={item.id}
              className="bg-slate-800/50 hover:bg-slate-800/80 transition-colors p-3 rounded-lg border border-slate-700/50 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-indigo-300">{item.speakerName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-300">
                    {getLanguageName(item.originalLanguage)} &rarr; {getLanguageName(item.targetLanguage)}
                  </span>
                  <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                </div>
              </div>
              <p className="text-slate-300 text-xs italic bg-slate-900/40 p-2 rounded border border-slate-800">
                "{item.originalText}"
              </p>
              <p className="text-indigo-200 font-medium text-sm leading-relaxed">
                {item.translatedText}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
