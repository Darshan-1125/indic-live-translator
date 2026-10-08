import React, { useState } from 'react';
import { Users } from 'lucide-react';
import type { RoomConfig, Participant, LiveTranscript } from '../types/meeting';
import { SUPPORTED_LANGUAGES } from '../types/meeting';
import { INITIAL_MOCK_PARTICIPANTS } from '../data/mockParticipants';
import { INITIAL_MOCK_TRANSCRIPTS } from '../data/mockTranscripts';
import { ParticipantGrid } from '../components/ParticipantGrid';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { MeetingControls } from '../components/MeetingControls';

interface MeetingRoomProps {
  config: RoomConfig;
  onLeaveRoom: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ config, onLeaveRoom }) => {
  // Local React State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState(config.preferredLanguage || 'en');
  const [transcripts, setTranscripts] = useState<LiveTranscript[]>(INITIAL_MOCK_TRANSCRIPTS);
  const [participants] = useState<Participant[]>(INITIAL_MOCK_PARTICIPANTS);

  // Construct current user participant state
  const currentUserParticipant: Participant = {
    id: 'user-self',
    name: config.userName,
    speakingLanguage: config.spokenLanguage,
    listeningLanguage: preferredLanguage,
    isMuted: isMuted,
    isVideoOff: isVideoOff,
    isSpeaking: !isMuted,
  };

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  const handleAddTranscript = (newTranscript: LiveTranscript) => {
    setTranscripts((prev) => [newTranscript, ...prev]);
  };

  const handleClearTranscripts = () => {
    setTranscripts([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] bg-slate-950 overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Active Participants: <strong className="text-slate-200">{participants.length + 1}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Translation Stream Ready
          </span>
          <div className="hidden sm:flex items-center gap-2">
            <span>Spoken: <strong className="text-indigo-300">{getLanguageName(config.spokenLanguage)}</strong></span>
            <span>&bull;</span>
            <span>Subtitles: <strong className="text-purple-300">{getLanguageName(preferredLanguage)}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 min-h-0">
        {/* Participant Video Tiles Container */}
        <div
          className={`flex flex-col ${
            showSubtitles ? 'lg:col-span-2' : 'lg:col-span-3'
          } min-h-0 overflow-hidden`}
        >
          <ParticipantGrid
            currentUser={currentUserParticipant}
            participants={participants}
            isSidebarOpen={showSubtitles}
          />
        </div>

        {/* Live Transcripts & Translations Panel Sidebar */}
        {showSubtitles && (
          <div className="lg:col-span-1 h-full min-h-0">
            <TranscriptPanel
              transcripts={transcripts}
              preferredLanguage={preferredLanguage}
              onAddTranscript={handleAddTranscript}
              onClearTranscripts={handleClearTranscripts}
            />
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <MeetingControls
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
