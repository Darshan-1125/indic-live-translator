import React from 'react';
import { Subtitles, Volume2, PlusCircle, Trash2, Radio, AlertCircle, RefreshCw } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LiveTranscript } from '../types/meeting';
import type { LiveCaptionDisplay } from '../hooks/useMeetingTranslation';

interface TranscriptPanelProps {
  transcripts: LiveTranscript[];
  preferredLanguage: string;
  onAddTranscript?: (transcript: LiveTranscript) => void;
  onClearTranscripts?: () => void;
  liveCaption?: LiveCaptionDisplay | null;
  connectionState?: string;
  error?: string | null;
  isTranslating?: boolean;
  onToggleTranslation?: () => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcripts,
  preferredLanguage,
  onAddTranscript,
  onClearTranscripts,
  liveCaption,
  connectionState,
  error,
  isTranslating = true,
  onToggleTranslation,
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
        originalText: 'आप सभी का स्वागत है, क्या मेरी आवाज़ आ रही है?',
        originalLanguage: 'hi',
        translatedText: 'Welcome everyone, can you hear my voice clearly?',
      },
      {
        speakerId: 'p2',
        speakerName: 'Priya Sundaram',
        originalText: 'வணக்கம், புதிய அம்சங்களைப் பற்றி விவாதிப்போம்.',
        originalLanguage: 'ta',
        translatedText: 'Greetings, let us discuss the new project features.',
      },
      {
        speakerId: 'p3',
        speakerName: 'Ananya Reddy',
        originalText: 'అవును, అందరూ సరైన సమయానికి చేరారు.',
        originalLanguage: 'te',
        translatedText: 'Yes, everyone joined right on time.',
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

  const renderStatusBadge = () => {
    if (!isTranslating) {
      return (
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
          Translation Paused
        </span>
      );
    }

    switch (connectionState) {
      case 'listening':
        return (
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Streaming &bull; Live ASR
          </span>
        );
      case 'processing':
        return (
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/40 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            Translating
          </span>
        );
      case 'connecting':
      case 'waiting_ack':
        return (
          <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/40 flex items-center gap-1 font-medium">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            Connecting AI...
          </span>
        );
      case 'error':
        return (
          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40 flex items-center gap-1 font-medium">
            <AlertCircle className="w-2.5 h-2.5" />
            Backend Error
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
            Unmute Mic to Translate
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
      {/* Panel Header */}
      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Subtitles className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs sm:text-sm font-semibold text-slate-200">
            Live Speech Translations
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {renderStatusBadge()}
          <span className="text-[11px] bg-indigo-500/15 text-indigo-300 font-medium px-2.5 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
            Target: {getLanguageName(preferredLanguage)}
          </span>
        </div>
      </div>

      {/* Action / Control bar */}
      <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onToggleTranslation && (
            <button
              onClick={onToggleTranslation}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isTranslating
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title="Toggle real-time AI speech translation"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isTranslating ? 'AI Translation: On' : 'AI Translation: Paused'}</span>
            </button>
          )}

          <button
            onClick={handleSimulateSpeech}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1 transition-colors cursor-pointer"
            title="Simulate speech for offline demo"
          >
            <PlusCircle className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Simulate</span>
          </button>
        </div>

        {onClearTranscripts && (transcripts.length > 0 || liveCaption) && (
          <button
            onClick={onClearTranscripts}
            className="text-[11px] text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear transcripts"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-1.5 text-xs text-rose-300 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Transcript items list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm">
        {/* Real-time in-progress caption card */}
        {liveCaption &&
          (liveCaption.originalText ||
            liveCaption.translatedText ||
            liveCaption.tentativeText) && (
            <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/40 rounded-xl p-3.5 space-y-2 shadow-lg ring-1 ring-indigo-500/30">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {liveCaption.speakerName} (Speaking)
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-full font-medium">
                  Live Stream
                </span>
              </div>

              {liveCaption.originalText && (
                <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-xs text-slate-300 italic">
                  "{liveCaption.originalText}"
                </div>
              )}

              <div className="text-sm font-semibold leading-relaxed pt-0.5">
                <span className="text-white">{liveCaption.translatedText}</span>
                {liveCaption.tentativeText && (
                  <span className="text-indigo-300/80 italic pl-1.5">
                    {liveCaption.tentativeText}
                  </span>
                )}
              </div>
            </div>
          )}

        {transcripts.length === 0 && !liveCaption ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6 space-y-2 min-h-[160px]">
            <Volume2 className="w-8 h-8 opacity-40 animate-pulse" />
            <p className="text-xs font-medium">Waiting for speech input...</p>
            <p className="text-[11px] text-slate-600 max-w-xs">
              Unmute your microphone and speak in your selected language to generate real-time AI speech-to-text and translations.
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

              {item.originalText && (
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/90 text-xs text-slate-300 italic">
                  "{item.originalText}"
                </div>
              )}

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
