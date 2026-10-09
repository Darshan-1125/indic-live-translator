import React, { useEffect, useState } from 'react';
import { Users, AlertCircle, X } from 'lucide-react';
import type { RoomConfig, Participant } from '../types/meeting';
import { SUPPORTED_LANGUAGES } from '../types/meeting';
import { INITIAL_MOCK_PARTICIPANTS } from '../data/mockParticipants';
import { ParticipantGrid } from '../components/ParticipantGrid';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { MeetingControls } from '../components/MeetingControls';
import { useLiveKitMeeting } from '../hooks/useLiveKitMeeting';
import { useMeetingTranslation } from '../hooks/useMeetingTranslation';

interface MeetingRoomProps {
  config: RoomConfig;
  onLeaveRoom: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ config, onLeaveRoom }) => {
  const [preferredLanguage, setPreferredLanguage] = useState(config.preferredLanguage || 'en');
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Single authoritative source of truth for media state & participant tracks
  const {
    connectionState,
    useMockMode,
    error: livekitError,
    deviceError,
    isConnected,
    isMuted,
    isVideoOff,
    localAudioTrack,
    localParticipant: activeCurrentUser,
    remoteParticipants: livekitRemotes,
    toggleMicrophone,
    toggleCamera,
    connect,
    disconnect,
    clearDeviceError,
  } = useLiveKitMeeting(config.spokenLanguage, config.userName, preferredLanguage);

  // Real-time speech-to-text & translation pipeline for video meeting
  const {
    connectionState: translationConnectionState,
    error: translationError,
    liveCaption,
    transcripts,
    isTranslating,
    toggleTranslation,
    addTranscript,
    clearTranscripts,
  } = useMeetingTranslation({
    activeAudioTrack: localAudioTrack,
    isMicMuted: isMuted,
    sourceLanguageCode: config.spokenLanguage,
    targetLanguageCode: preferredLanguage,
    speakerName: config.userName,
    enabled: showSubtitles,
  });

  // Attempt LiveKit connection if explicit credentials provided
  useEffect(() => {
    if (config.livekitUrl && config.livekitToken) {
      connect(config.livekitUrl, config.livekitToken);
    }
  }, [config.livekitUrl, config.livekitToken, connect]);

  // Handle Leave Meeting
  const handleLeave = async () => {
    await disconnect();
    onLeaveRoom();
  };

  // Toggle Microphone: requests/releases mic track and updates authoritative state
  const handleToggleMic = async () => {
    await toggleMicrophone(isMuted);
  };

  // Toggle Camera: requests/releases camera track and updates authoritative state
  const handleToggleVideo = async () => {
    await toggleCamera(isVideoOff);
  };

  const activeRemoteParticipants: Participant[] = isConnected
    ? livekitRemotes
    : INITIAL_MOCK_PARTICIPANTS;

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] bg-slate-950 overflow-hidden">
      {/* Device Permission Error Banner */}
      {deviceError && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{deviceError}</span>
          </div>
          <button
            onClick={clearDeviceError}
            className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* LiveKit Connection Error / Mock Mode Banner */}
      {livekitError && useMockMode && !deviceError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Note: {livekitError}</span>
          </div>
          <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
            Mock Mode Active
          </span>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Active Participants: <strong className="text-slate-200">{activeRemoteParticipants.length + 1}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {isConnected ? `LiveKit Stream (${connectionState})` : 'Mock Demo Stream Active'}
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
            currentUser={activeCurrentUser}
            participants={activeRemoteParticipants}
            isSidebarOpen={showSubtitles}
          />
        </div>

        {/* Live Transcripts & Translations Panel Sidebar */}
        {showSubtitles && (
          <div className="lg:col-span-1 h-full min-h-0">
            <TranscriptPanel
              transcripts={transcripts}
              preferredLanguage={preferredLanguage}
              onAddTranscript={addTranscript}
              onClearTranscripts={clearTranscripts}
              liveCaption={liveCaption}
              connectionState={translationConnectionState}
              error={translationError}
              isTranslating={isTranslating}
              onToggleTranslation={toggleTranslation}
            />
          </div>
        )}
      </div>

      {/* Footer Controls: Bound to the single authoritative isMuted and isVideoOff source */}
      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        showSubtitles={showSubtitles}
        preferredLanguage={preferredLanguage}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onToggleSubtitles={() => setShowSubtitles(!showSubtitles)}
        onLanguageChange={(lang) => setPreferredLanguage(lang)}
        onLeaveMeeting={handleLeave}
      />
    </div>
  );
};
