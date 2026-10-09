import type { LiveTranscript } from '../types/meeting';

export const INITIAL_MOCK_TRANSCRIPTS: LiveTranscript[] = [
  {
    id: 't1',
    speakerId: 'p1',
    speakerName: 'Aarav Sharma',
    originalText: 'नमस्ते सभी लोग, आज की बैठक में आपका स्वागत है।',
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
    translatedText: 'Greetings, let\'s discuss the new project features.',
    targetLanguage: 'en',
    timestamp: '10:31 AM',
  },
  {
    id: 't3',
    speakerId: 'p3',
    speakerName: 'Ananya Reddy',
    originalText: 'ఈ రోజటి లైవ్ అనువాదం చాలా బాగా పనిచేస్తుంది.',
    originalLanguage: 'te',
    translatedText: 'Today\'s live translation is working extremely well.',
    targetLanguage: 'en',
    timestamp: '10:32 AM',
  },
  {
    id: 't4',
    speakerId: 'p4',
    speakerName: 'John Miller',
    originalText: 'Can everyone see the real-time multilingual subtitles?',
    originalLanguage: 'en',
    translatedText: 'क्या हर कोई वास्तविक समय के बहुभाषी उपशीर्षक देख सकता है?',
    targetLanguage: 'hi',
    timestamp: '10:33 AM',
  },
];
