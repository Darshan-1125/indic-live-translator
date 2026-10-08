import React from 'react';
import { Subtitles, Volume2, PlusCircle, Trash2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LiveTranscript } from '../types/meeting';

interface TranscriptPanelProps {
  transcripts: LiveTranscript[];
  preferredLanguage: string;
  onAddTranscript?: (transcript: LiveTranscript) => void;
  onClearTranscripts?: () => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcripts,
  preferredLanguage,
  onAddTranscript,
  onClearTranscripts,
}) => {
  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  const handleSimulateSpeech = () => {
    if (!onAddTranscript) return;

    const sampleSimulations = [
      {
        speakerId: 'p1',
        speakerName: 'Aarav Sharma',
        originalText: 'क्या आप अगली रिलीज़ की तारीख की पुष्टि कर सकते हैं?',
        originalLanguage: 'hi',
        translatedText: 'Can you confirm the next release date?',
      },
      {
        speakerId: 'p2',
        speakerName: 'Priya Sundaram',
        originalText: 'நாங்கள் நேரடி மொழிபெயர்ப்பு சோதனைகளை முடித்துவிட்டோம்.',
        originalLanguage: 'ta',
        translatedText: 'We have completed the live translation tests.',
      },
      {
        speakerId: 'p3',
        speakerName: 'Ananya Reddy',
        originalText: 'అవును, అందరూ సరైన సమయానికి చేరారు.',
        originalLanguage: 'te',
        translatedText: 'Yes, everyone joined on time.',
      },
    ];

    const randomIndex = Math.floor(Math.random() * sampleSimulations.length);
    const sample = sampleSimulations[randomIndex];
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    onAddTranscript({
      id: `sim-${Date.now()}`,
      speakerId: sample.speakerId,
      speakerName: sample.speakerName,
      originalText: sample.originalText,
      originalLanguage: sample.originalLanguage,
      translatedText: sample.translatedText,
      targetLanguage: preferredLanguage,
      timestamp: timeString,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
      {/* Panel Header */}
      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Subtitles className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs sm:text-sm font-semibold text-slate-200">
            Live Transcripts & Translations
          </h2>
        </div>
        <span className="text-[11px] bg-indigo-500/15 text-indigo-300 font-medium px-2.5 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
          Target: {getLanguageName(preferredLanguage)}
        </span>
      </div>

      {/* Action bar for testing */}
      <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={handleSimulateSpeech}
          className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Simulate a new incoming speech translation"
        >
          <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Simulate Speech</span>
        </button>

        {onClearTranscripts && transcripts.length > 0 && (
          <button
            onClick={onClearTranscripts}
            className="text-[11px] text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear transcripts"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Transcript items list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm">
        {transcripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6 space-y-2 min-h-[160px]">
            <Volume2 className="w-8 h-8 opacity-40 animate-pulse" />
            <p className="text-xs font-medium">Waiting for speech input...</p>
            <p className="text-[11px] text-slate-600 max-w-xs">
              Click "Simulate Speech" above or unmute microphone to generate live translated subtitles.
            </p>
          </div>
        ) : (
          transcripts.map((item) => (
            <div
              key={item.id}
              className="bg-slate-800/40 hover:bg-slate-800/70 transition-colors p-3.5 rounded-xl border border-slate-700/50 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-indigo-300">{item.speakerName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-700/60 px-2 py-0.5 rounded-md text-slate-300 font-medium">
                    {getLanguageName(item.originalLanguage)} &rarr; {getLanguageName(preferredLanguage)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                </div>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/90 text-xs text-slate-300 italic">
                "{item.originalText}"
              </div>

              <div className="text-indigo-100 font-medium text-xs sm:text-sm leading-relaxed pl-1">
                {item.translatedText}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
