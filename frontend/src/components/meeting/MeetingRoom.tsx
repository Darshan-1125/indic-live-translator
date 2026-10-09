import React, { useState } from 'react';
import { Mic, MicOff, Volume2, Users } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type RoomConfig, type Participant, type LiveTranscript } from '../../types/meeting';
import { SubtitleOverlay } from './SubtitleOverlay';
import { ControlBar } from './ControlBar';

interface MeetingRoomProps {
  config: RoomConfig;
  onLeaveRoom: () => void;
}

const MOCK_PARTICIPANTS: Participant[] = [
  {
    id: 'p1',
    name: 'Aarav Sharma',
    speakingLanguage: 'hi',
    listeningLanguage: 'hi',
    isMuted: false,
    isVideoOff: false,
    isSpeaking: true,
  },
  {
    id: 'p2',
    name: 'Priya Sundaram',
    speakingLanguage: 'ta',
    listeningLanguage: 'ta',
    isMuted: false,
    isVideoOff: false,
    isSpeaking: false,
  },
  {
    id: 'p3',
    name: 'John Miller',
    speakingLanguage: 'en',
    listeningLanguage: 'en',
    isMuted: true,
    isVideoOff: true,
    isSpeaking: false,
  },
];

const INITIAL_TRANSCRIPTS: LiveTranscript[] = [
  {
    id: 't1',
    speakerId: 'p1',
    speakerName: 'Aarav Sharma',
    originalText: 'नमस्ते सब लोग, आज की बैठक में आपका स्वागत है।',
    originalLanguage: 'hi',
    translatedText: 'Hello everyone, welcome to today\'s meeting.',
    targetLanguage: 'en',
    timestamp: '10:30 AM',
  },
  {
    id: 't2',
    speakerId: 'p2',
    speakerName: 'Priya Sundaram',
    originalText: 'வணக்கம், புதிய அம்சங்களைப் பற்றி விவாதிக்கலாம்.',
    originalLanguage: 'ta',
    translatedText: 'Hello, let\'s discuss the new features.',
    targetLanguage: 'en',
    timestamp: '10:31 AM',
  },
];

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ config, onLeaveRoom }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState(config.preferredLanguage || 'hi');
  const [transcripts] = useState<LiveTranscript[]>(INITIAL_TRANSCRIPTS);

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] bg-slate-950 overflow-hidden">
      {/* Top room status banner */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Participants: {MOCK_PARTICIPANTS.length + 1}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Translation Stream Active
          </span>
          <span className="text-slate-400">
            Your Spoken: <strong className="text-slate-200">{getLanguageName(config.spokenLanguage)}</strong>
          </span>
        </div>
      </div>

      {/* Main Grid: Video Stream + Live Transcripts Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 min-h-0">
        {/* Video Tiles Section */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${showSubtitles ? 'lg:col-span-2' : 'lg:col-span-3'} overflow-y-auto`}>
          {/* User's Video Tile */}
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[220px] shadow-lg group">
            {isVideoOff ? (
              <div className="flex flex-col items-center justify-center text-slate-500">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xl mb-2">
                  {config.userName ? config.userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-xs">Camera is turned off</span>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 to-slate-900 flex items-center justify-center relative">
                <div className="w-20 h-20 rounded-full bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-2xl shadow-inner">
                  {config.userName ? config.userName.charAt(0).toUpperCase() : 'U'}
                </div>
                {/* Simulated webcam video feed placeholder */}
                <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-[11px] px-2.5 py-1 rounded-md border border-slate-700">
                  {config.userName} (You)
                </span>
              </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="text-xs bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-slate-200">
                Speaking: {getLanguageName(config.spokenLanguage)}
              </span>
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-700 text-slate-300">
                {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
            </div>
          </div>

          {/* Remote Participants Video Tiles */}
          {MOCK_PARTICIPANTS.map((p) => (
            <div
              key={p.id}
              className={`relative bg-slate-900 border rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[220px] shadow-lg ${
                p.isSpeaking ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800'
              }`}
            >
              <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center relative">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xl">
                  {p.name.charAt(0)}
                </div>
                <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-[11px] px-2.5 py-1 rounded-md border border-slate-700">
                  {p.name}
                </span>

                {p.isSpeaking && (
                  <span className="absolute top-3 right-3 bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-500/40 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse" /> Speaking
                  </span>
                )}
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="text-xs bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300">
                  Lang: {getLanguageName(p.speakingLanguage)}
                </span>
                <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-700">
                  {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Subtitle & Translation Feed Sidebar */}
        {showSubtitles && (
          <div className="lg:col-span-1 h-full min-h-0">
            <SubtitleOverlay
              transcripts={transcripts}
              preferredLanguage={preferredLanguage}
            />
          </div>
        )}
      </div>

      {/* Control Bar Footer */}
      <ControlBar
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        showSubtitles={showSubtitles}
        preferredLanguage={preferredLanguage}
        onToggleMic={() => setIsMuted(!isMuted)}
        onToggleVideo={() => setIsVideoOff(!isVideoOff)}
        onToggleSubtitles={() => setShowSubtitles(!showSubtitles)}
        onLanguageChange={(lang) => setPreferredLanguage(lang)}
        onLeaveMeeting={onLeaveRoom}
      />
    </div>
  );
};
