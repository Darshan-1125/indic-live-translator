import React, { useState } from 'react';
import { Sparkles, User, Key, ArrowRight } from 'lucide-react';
import type { RoomConfig } from '../../types/meeting';
import { LanguageSelector } from '../meeting/LanguageSelector';

interface LobbyProps {
  onJoinRoom: (config: RoomConfig) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoinRoom }) => {
  const [userName, setUserName] = useState('Rahul Verma');
  const [roomId, setRoomId] = useState('indic-meet-101');
  const [spokenLanguage, setSpokenLanguage] = useState('hi');
  const [preferredLanguage, setPreferredLanguage] = useState('hi');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomId.trim()) return;
    onJoinRoom({
      userName: userName.trim(),
      roomId: roomId.trim(),
      spokenLanguage,
      preferredLanguage,
    });
  };

  return (
    <div className="min-h-[calc(100vh-61px)] bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative gradient blur background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            AI-Powered Indic Translation Engine
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Join Real-Time Multilingual Meeting</h2>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            Speak in your native language while others receive real-time audio and subtitle translations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* User Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Your Display Name
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Rahul Verma"
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Room ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Meeting Room ID
            </label>
            <input
              type="text"
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. indic-meet-101"
              className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
            />
          </div>

          {/* Language Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <LanguageSelector
              label="I Will Speak In"
              selectedCode={spokenLanguage}
              onChange={setSpokenLanguage}
            />
            <LanguageSelector
              label="I Want Subtitles In"
              selectedCode={preferredLanguage}
              onChange={setPreferredLanguage}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all group"
          >
            <span>Enter Meeting Room</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
};
