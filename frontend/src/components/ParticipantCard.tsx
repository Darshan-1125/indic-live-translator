import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VideoOff } from 'lucide-react';
import { Track } from 'livekit-client';
import { SUPPORTED_LANGUAGES, type Participant } from '../types/meeting';

interface ParticipantCardProps {
  participant: Participant;
  isSelf?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isSelf = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  // Attach real LiveKit video track when video is enabled and rawParticipant exists
  useEffect(() => {
    const videoEl = videoRef.current;
    const raw = participant.rawParticipant;

    if (!videoEl || !raw || participant.isVideoOff) return;

    // Access track publications safely
    const pubMap = raw.videoTrackPublications as Map<string, any>;
    const pubList = Array.from(pubMap.values());

    const trackPub = pubList.find(
      (pub) => pub.source === Track.Source.Camera || pub.kind === Track.Kind.Video
    );

    const track = trackPub?.track;
    if (track && typeof track.attach === 'function') {
      track.attach(videoEl);
      return () => {
        track.detach(videoEl);
      };
    }
  }, [participant.rawParticipant, participant.isVideoOff]);

  const raw = participant.rawParticipant;
  const pubMap = raw ? (raw.videoTrackPublications as Map<string, any>) : null;
  const pubList = pubMap ? Array.from(pubMap.values()) : [];
  const hasLiveKitVideo = Boolean(
    raw && !participant.isVideoOff && pubList.some((pub) => pub && pub.track)
  );

  return (
    <div
      className={`relative w-full h-full bg-slate-900 border rounded-2xl overflow-hidden flex flex-col items-center justify-between min-h-[200px] sm:min-h-[240px] shadow-lg transition-all duration-300 ${
        participant.isSpeaking && !participant.isMuted
          ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-500/20'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Video Stream / Avatar Display Area */}
      <div className="relative w-full flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center overflow-hidden">
        {participant.isVideoOff ? (
          /* Camera Off State */
          <div className="flex flex-col items-center justify-center space-y-3 p-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border-2 border-slate-700/80 flex items-center justify-center text-slate-200 font-bold text-xl sm:text-2xl shadow-inner">
              {getInitials(participant.name)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-full border border-slate-800 backdrop-blur-md">
              <VideoOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Camera Off</span>
            </div>
          </div>
        ) : hasLiveKitVideo ? (
          /* Real LiveKit Video Feed */
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf}
            className="w-full h-full object-cover rounded-t-2xl"
          />
        ) : (
          /* Mock / Video Feed Container */
          <div className="w-full h-full flex flex-col items-center justify-center relative p-4">
            <div className="relative">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-2xl transition-transform ${
                  isSelf
                    ? 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white border-2 border-indigo-400/60'
                    : 'bg-slate-800 text-indigo-300 border-2 border-indigo-500/30'
                }`}
              >
                {getInitials(participant.name)}
              </div>
              {participant.isSpeaking && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Top-Left Name Badge */}
        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-slate-200 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-1.5 shadow-md z-10">
          <span>{participant.name}</span>
          {isSelf && <span className="text-[10px] text-indigo-400 font-bold">(You)</span>}
        </div>

        {/* Top-Right Active Speaking Indicator */}
        {participant.isSpeaking && !participant.isMuted && (
          <div className="absolute top-3 right-3 bg-indigo-500/20 backdrop-blur-md text-indigo-300 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-indigo-500/40 flex items-center gap-1.5 shadow-md z-10">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Speaking</span>
          </div>
        )}
      </div>

      {/* Footer Info: Language Badge & Mic Mute Status */}
      <div className="w-full bg-slate-950/80 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 flex items-center justify-between z-10">
        <span className="text-[11px] text-slate-400 font-medium">
          Lang: <span className="text-slate-200 font-semibold">{getLanguageName(participant.speakingLanguage)}</span>
        </span>

        <div
          className={`p-1.5 rounded-lg border transition-all ${
            participant.isMuted
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              : 'bg-slate-800/80 text-emerald-400 border-slate-700/80'
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
