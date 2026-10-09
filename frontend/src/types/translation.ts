export type BackendConnectionState =
  | 'idle'
  | 'checking'
  | 'connecting'
  | 'connected'
  | 'waiting_ack'
  | 'requesting_mic'
  | 'listening'
  | 'processing'
  | 'finalizing'
  | 'disconnected'
  | 'backend_unavailable'
  | 'error';

export interface StabilityData {
  cumulative_committed_text: string;
  tentative_text: string;
}

export interface StartedEvent {
  type: 'started';
  session_id?: string;
}

export interface AsrPartialEvent {
  type: 'asr_partial';
  text: string;
  is_final: boolean;
  speaker_id?: string;
}

export interface TranslationEvent {
  type: 'translation';
  text: string;
  translated_text: string;
  is_final: boolean;
  stability?: StabilityData;
}

export interface DoneEvent {
  type: 'done';
  session_id?: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type BackendWebSocketEvent =
  | StartedEvent
  | AsrPartialEvent
  | TranslationEvent
  | DoneEvent
  | ErrorEvent
  | { type: string; [key: string]: unknown };

export interface CaptionEntry {
  id: string;
  speakerId: string;
  originalText: string;
  translatedText: string;
  timestamp: string;
  isFinal: boolean;
}

export interface LiveCaptionState {
  currentOriginal: string;
  currentCommitted: string;
  currentTentative: string;
  isFinal: boolean;
  speakerId: string;
}
