export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isIndic?: boolean;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', isIndic: true },
  { code: 'en', name: 'English', nativeName: 'English', isIndic: false },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', isIndic: true },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', isIndic: true },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', isIndic: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', isIndic: true },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', isIndic: true },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', isIndic: true },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', isIndic: true },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', isIndic: true },
];

export interface Participant {
  id: string;
  name: string;
  speakingLanguage: string;
  listeningLanguage: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking?: boolean;
  avatarUrl?: string;
  isLiveKitParticipant?: boolean;
}

export interface LiveTranscript {
  id: string;
  speakerId: string;
  speakerName: string;
  originalText: string;
  originalLanguage: string;
  translatedText: string;
  targetLanguage: string;
  timestamp: string;
}

export interface RoomConfig {
  roomId: string;
  userName: string;
  spokenLanguage: string;
  preferredLanguage: string;
  livekitUrl?: string;
  livekitToken?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
