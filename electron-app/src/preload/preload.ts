import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS, ExtractResult, AppSettings, TranscriptResult, ChatMessage, GeminiSettings } from '../shared/types';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Video extraction
  extractVideo: (url: string): Promise<ExtractResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_VIDEO, url);
  },

  // Window controls
  minimizeWindow: (): void => {
    ipcRenderer.send(IPC_CHANNELS.MINIMIZE_WINDOW);
  },

  closeWindow: (): void => {
    ipcRenderer.send(IPC_CHANNELS.CLOSE_WINDOW);
  },

  setAlwaysOnTop: (value: boolean): void => {
    ipcRenderer.send(IPC_CHANNELS.SET_ALWAYS_ON_TOP, value);
  },

  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
  },

  saveSettings: (settings: Partial<AppSettings>): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings);
  },

  // Event listeners for main -> renderer communication
  // Each returns an unsubscribe function to prevent memory leaks
  onPlayUrl: (callback: (url: string, title: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, url: string, title: string) => {
      callback(url, title);
    };
    ipcRenderer.on(IPC_CHANNELS.PLAY_URL, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PLAY_URL, handler);
    };
  },

  onVideoReady: (callback: (url: string, title: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, url: string, title: string) => {
      callback(url, title);
    };
    ipcRenderer.on(IPC_CHANNELS.VIDEO_READY, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.VIDEO_READY, handler);
    };
  },

  onExtractionError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, error: string) => {
      callback(error);
    };
    ipcRenderer.on(IPC_CHANNELS.EXTRACTION_ERROR, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EXTRACTION_ERROR, handler);
    };
  },

  // ========== Chat/Transcript APIs ==========

  // Extract transcript from current video
  extractTranscript: (): Promise<TranscriptResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_TRANSCRIPT);
  },

  // Send chat message (response comes via streaming callbacks)
  sendChatMessage: (message: string, history: ChatMessage[]): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND_MESSAGE, message, history);
  },

  // Get Gemini settings
  getGeminiSettings: (): Promise<GeminiSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_GEMINI_SETTINGS);
  },

  // Save Gemini settings
  saveGeminiSettings: (settings: Partial<GeminiSettings>): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_GEMINI_SETTINGS, settings);
  },

  // Chat streaming event listeners
  onChatResponseChunk: (callback: (chunk: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, chunk: string) => {
      callback(chunk);
    };
    ipcRenderer.on(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, handler);
    };
  },

  onChatResponseComplete: (callback: () => void): (() => void) => {
    const handler = () => {
      callback();
    };
    ipcRenderer.on(IPC_CHANNELS.CHAT_RESPONSE_COMPLETE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CHAT_RESPONSE_COMPLETE, handler);
    };
  },

  onChatError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, error: string) => {
      callback(error);
    };
    ipcRenderer.on(IPC_CHANNELS.CHAT_ERROR, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CHAT_ERROR, handler);
    };
  },
});

// Type declarations for renderer
declare global {
  interface Window {
    electronAPI: {
      extractVideo: (url: string) => Promise<ExtractResult>;
      minimizeWindow: () => void;
      closeWindow: () => void;
      setAlwaysOnTop: (value: boolean) => void;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
      // Event listeners return cleanup functions to prevent memory leaks
      onPlayUrl: (callback: (url: string, title: string) => void) => () => void;
      onVideoReady: (callback: (url: string, title: string) => void) => () => void;
      onExtractionError: (callback: (error: string) => void) => () => void;
      // Chat/Transcript APIs
      extractTranscript: () => Promise<TranscriptResult>;
      sendChatMessage: (message: string, history: ChatMessage[]) => Promise<void>;
      getGeminiSettings: () => Promise<GeminiSettings>;
      saveGeminiSettings: (settings: Partial<GeminiSettings>) => Promise<void>;
      onChatResponseChunk: (callback: (chunk: string) => void) => () => void;
      onChatResponseComplete: (callback: () => void) => () => void;
      onChatError: (callback: (error: string) => void) => () => void;
    };
  }
}
