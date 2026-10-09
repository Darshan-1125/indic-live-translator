import React from 'react';
import {
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  Sparkles,
  Volume2,
  Trash2,
  AlertCircle,
  Users,
  CheckCircle2,
  Languages,
} from 'lucide-react';
import { useLiveTranslation } from '../hooks/useLiveTranslation';
import type { BackendConnectionState } from '../types/translation';

export const LiveTranslationView: React.FC = () => {
  const {
    connectionState,
    backendHealthy,
    backendUrl,
    speakerId,
    setSpeakerId,
    sourceLanguage,
    setSourceLanguage,
    targetLanguage,
    setTargetLanguage,
    sessionId,
    isRecording,
    audioLevel,
    liveCaption,
    captionHistory,
    error,
    startSpeaking,
    stopSpeaking,
    clearHistory,
    runHealthCheck,
  } = useLiveTranslation();

  const LANGUAGE_OPTIONS = [
    { code: 'ta-IN', label: 'Tamil' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'te-IN', label: 'Telugu' },
    { code: 'kn-IN', label: 'Kannada' },
    { code: 'ml-IN', label: 'Malayalam' },
    { code: 'bn-IN', label: 'Bengali' },
    { code: 'mr-IN', label: 'Marathi' },
    { code: 'en-IN', label: 'English' },
  ];

  const renderConnectionPill = (state: BackendConnectionState) => {
    switch (state) {
      case 'listening':
        return (
          <span className="flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            Listening & Streaming
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            Processing AI Pipeline
          </span>
        );
      case 'finalizing':
        return (
          <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            Finalizing...
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
            Connecting to backendâ€¦
          </span>
        );
      case 'waiting_ack':
        return (
          <span className="flex items-center gap-1.5 bg-violet-500/20 text-violet-300 border border-violet-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
            Waiting for backendâ€¦
          </span>
        );
      case 'requesting_mic':
        return (
          <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <Mic className="w-3 h-3 text-amber-400 animate-pulse" />
            Requesting microphoneâ€¦
          </span>
        );
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-full text-xs">
            <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
            Checking Backend...
          </span>
        );
      case 'backend_unavailable':
        return (
          <span className="flex items-center gap-1.5 bg-rose-950/60 text-rose-300 border border-rose-700/60 px-3 py-1 rounded-full text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Backend Unavailable
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 bg-rose-950/60 text-rose-300 border border-rose-700/60 px-3 py-1 rounded-full text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Error
          </span>
        );
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Connected
          </span>
        );
      default:
        return backendHealthy ? (
          <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Ready to Translate
          </span>
        ) : (
          <span className="flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1 rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-61px)] bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        {/* Top Control & Status Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  IndicLive
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                    Real-Time AI Pipeline
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Saaras v4 ASR &bull; StabilityEngine &bull; Mayura Translation
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {renderConnectionPill(connectionState)}

            {/* Language Selectors */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value as typeof sourceLanguage)}
                disabled={isRecording || connectionState === 'connecting' || connectionState === 'waiting_ack' || connectionState === 'requesting_mic'}
                className="bg-slate-900 text-indigo-300 font-semibold rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none cursor-pointer disabled:opacity-50"
                title="Source language"
              >
                {LANGUAGE_OPTIONS.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <span className="text-slate-500">â†’</span>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value as typeof targetLanguage)}
                disabled={isRecording || connectionState === 'connecting' || connectionState === 'waiting_ack' || connectionState === 'requesting_mic'}
                className="bg-slate-900 text-emerald-300 font-semibold rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none cursor-pointer disabled:opacity-50"
                title="Target language"
              >
                {LANGUAGE_OPTIONS.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Speaker ID Switcher (Two Tab Demo Support) */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">Speaker:</span>
              <select
                value={speakerId}
                onChange={(e) => setSpeakerId(e.target.value)}
                disabled={isRecording}
                className="bg-slate-900 text-purple-300 font-mono font-semibold rounded px-2 py-0.5 border border-slate-700 focus:outline-none cursor-pointer disabled:opacity-50"
                title="Select speaker identity for multi-tab testing"
              >
                <option value="user-A">user-A</option>
                <option value="user-B">user-B</option>
                <option value="speaker-1">speaker-1</option>
                <option value="speaker-2">speaker-2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Backend Unreachable Alert Banner */}
        {connectionState === 'backend_unavailable' && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-semibold">Backend Server Unavailable</p>
                <p className="text-rose-300/80">
                  Could not reach {backendUrl}/health. Ensure your FastAPI server is running.
                </p>
              </div>
            </div>
            <button
              onClick={runHealthCheck}
              className="bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 px-3.5 py-1.5 rounded-xl border border-rose-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Backend</span>
            </button>
          </div>
        )}

        {/* Generic Error Banner */}
        {error && connectionState !== 'backend_unavailable' && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 flex items-center gap-2 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Main Live AI Translation Display Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Original Speech */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[260px] relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                  <h2 className="text-xs font-bold tracking-wider uppercase text-slate-400">
                    Original Speech
                  </h2>
                </div>
                <span className="text-[11px] bg-slate-800 px-2.5 py-0.5 rounded-full text-indigo-300 font-medium">
                  Tamil / Tanglish
                </span>
              </div>

              {/* Dynamic Transcript Area */}
              <div className="pt-2">
                {liveCaption.currentOriginal ? (
                  <p className="text-lg sm:text-xl font-medium text-slate-100 leading-relaxed font-sans">
                    "{liveCaption.currentOriginal}"
                  </p>
                ) : isRecording ? (
                  <p className="text-base text-slate-500 italic animate-pulse">
                    Listening for speech... (Start speaking in Tamil)
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Ready to translate. Click <strong className="text-slate-400">Start Speaking</strong> and speak in Tamil or Tanglish.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60">
              <span>ASR: Saaras v4</span>
              {sessionId && <span>Session: {sessionId}</span>}
            </div>
          </div>

          {/* Card 2: Live Translation with Stability Engine */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[260px] relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-bold tracking-wider uppercase text-slate-400">
                    Live Translation
                  </h2>
                </div>
                <span className="text-[11px] bg-slate-800 px-2.5 py-0.5 rounded-full text-emerald-300 font-medium">
                  English
                </span>
              </div>

              {/* Stability Engine Split Text: Committed (solid) + Tentative (italic/faded) */}
              <div className="pt-2">
                {liveCaption.currentCommitted || liveCaption.currentTentative ? (
                  <p className="text-lg sm:text-xl leading-relaxed">
                    {/* Committed Text */}
                    {liveCaption.currentCommitted && (
                      <span className="font-semibold text-white transition-colors duration-200">
                        {liveCaption.currentCommitted}
                      </span>
                    )}
                    {/* Tentative Text: slightly faded and italic */}
                    {liveCaption.currentTentative && (
                      <span className="italic text-indigo-300/80 pl-1.5 transition-opacity duration-200">
                        {liveCaption.currentTentative}
                      </span>
                    )}
                  </p>
                ) : isRecording ? (
                  <p className="text-base text-slate-500 italic animate-pulse">
                    Generating live English translation...
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Live translations with Stability Engine committed and tentative text will stream here in real time.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-white"></span> Committed
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 opacity-60"></span> Tentative
              </span>
              <span>Model: Mayura</span>
            </div>
          </div>
        </div>

        {/* Center Control Action Area */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center space-y-4 text-center">
          {/* Main Microphone Button */}
          {!isRecording ? (
            <button
              onClick={startSpeaking}
              disabled={connectionState === 'connecting' || connectionState === 'finalizing' || connectionState === 'waiting_ack' || connectionState === 'requesting_mic'}
              className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Start Speaking</span>
            </button>
          ) : (
            <button
              onClick={stopSpeaking}
              className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-xl shadow-rose-600/30 flex items-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer animate-pulse"
            >
              <MicOff className="w-5 h-5" />
              <span>Stop Speaking</span>
            </button>
          )}

          {/* Recording & Audio Level Meter Indicator */}
          {isRecording && (
            <div className="flex flex-col items-center space-y-2 w-full max-w-xs pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span>Recording &bull; 16kHz Mono PCM Audio Streaming</span>
              </div>
              {/* Dynamic volume level bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-75"
                  style={{ width: `${Math.max(5, Math.min(100, audioLevel * 100))}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Microphone audio is captured via Web Audio API, resampled to 16 kHz mono signed 16-bit PCM, and streamed over WebSocket.
          </p>
        </div>

        {/* Finalized Caption History */}
        {captionHistory.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Committed Caption History ({captionHistory.length})
                </h3>
              </div>
              <button
                onClick={clearHistory}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
              {captionHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-purple-300">
                      Speaker: {item.speakerId}
                    </span>
                    <span className="font-mono text-slate-500">{item.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    "{item.originalText}"
                  </p>

                  <p className="text-sm font-semibold text-emerald-300 leading-relaxed pt-0.5">
                    {item.translatedText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

