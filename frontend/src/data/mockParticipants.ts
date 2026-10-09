import type { Participant } from '../types/meeting';

export const INITIAL_MOCK_PARTICIPANTS: Participant[] = [
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
    name: 'Ananya Reddy',
    speakingLanguage: 'te',
    listeningLanguage: 'te',
    isMuted: true,
    isVideoOff: false,
    isSpeaking: false,
  },
  {
    id: 'p4',
    name: 'John Miller',
    speakingLanguage: 'en',
    listeningLanguage: 'en',
    isMuted: false,
    isVideoOff: true,
    isSpeaking: false,
  },
];
