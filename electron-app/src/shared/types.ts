// Shared types for IPC communication between main and renderer

export interface VideoInfo {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  directUrl?: string;
}

export interface ExtractResult {
  success: boolean;
  videoUrl?: string;
  title?: string;
  error?: string;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  alwaysOnTop: boolean;
  volume: number;
  lastBounds?: WindowBounds;
}

// Chat/Transcript types
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  success: boolean;
  segments?: TranscriptSegment[];
  fullText?: string;
  language?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface GeminiSettings {
  apiKey?: string;
  model: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Renderer to Main
  EXTRACT_VIDEO: 'extract-video',
  MINIMIZE_WINDOW: 'minimize-window',
  CLOSE_WINDOW: 'close-window',
  SET_ALWAYS_ON_TOP: 'set-always-on-top',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',

  // Main to Renderer
  VIDEO_READY: 'video-ready',
  EXTRACTION_ERROR: 'extraction-error',
  PLAY_URL: 'play-url',

  // Chat/Transcript channels (Renderer to Main)
  EXTRACT_TRANSCRIPT: 'extract-transcript',
  CHAT_SEND_MESSAGE: 'chat-send-message',
  GET_GEMINI_SETTINGS: 'get-gemini-settings',
  SAVE_GEMINI_SETTINGS: 'save-gemini-settings',

  // Chat channels (Main to Renderer)
  TRANSCRIPT_READY: 'transcript-ready',
  CHAT_RESPONSE_CHUNK: 'chat-response-chunk',
  CHAT_RESPONSE_COMPLETE: 'chat-response-complete',
  CHAT_ERROR: 'chat-error',
} as const;

// HTTP Server endpoints for extension communication
export const HTTP_ENDPOINTS = {
  SEND_URL: '/send-url',
  PING: '/ping',
} as const;

// Re-exported from constants for backwards compatibility
export { HTTP_PORT } from './constants';
