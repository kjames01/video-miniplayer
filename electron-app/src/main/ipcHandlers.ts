import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, ExtractResult, AppSettings, TranscriptResult, ChatMessage, GeminiSettings } from '../shared/types';
import { WindowManager } from './windowManager';
import { YtdlpManager } from './ytdlpManager';
import { UrlCache } from './urlCache';
import { TranscriptManager } from './transcriptManager';
import { GeminiService } from './geminiService';

// Security constants
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const MAX_URL_LENGTH = 2048;

let ytdlpManager: YtdlpManager | null = null;
let urlCache: UrlCache | null = null;
let transcriptManager: TranscriptManager | null = null;
let geminiService: GeminiService | null = null;
let lastTranscript: TranscriptResult | null = null;
let settings: AppSettings = {
  alwaysOnTop: true,
  volume: 1,
};

/**
 * Validates a URL for security
 */
function validateUrl(url: unknown): { valid: boolean; error?: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL exceeds maximum length' };
  }

  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  return { valid: true };
}

/**
 * Validates and sanitizes settings input
 */
function validateSettings(newSettings: unknown): Partial<AppSettings> {
  const validated: Partial<AppSettings> = {};

  if (typeof newSettings !== 'object' || newSettings === null) {
    return validated;
  }

  const input = newSettings as Record<string, unknown>;

  if (typeof input.alwaysOnTop === 'boolean') {
    validated.alwaysOnTop = input.alwaysOnTop;
  }

  if (typeof input.volume === 'number' && input.volume >= 0 && input.volume <= 1) {
    validated.volume = input.volume;
  }

  if (input.lastBounds && typeof input.lastBounds === 'object') {
    const bounds = input.lastBounds as Record<string, unknown>;
    if (
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      typeof bounds.width === 'number' &&
      typeof bounds.height === 'number' &&
      bounds.width > 0 &&
      bounds.height > 0
    ) {
      validated.lastBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }
  }

  return validated;
}

export function getYtdlpManager(): YtdlpManager | null {
  return ytdlpManager;
}

export function getUrlCache(): UrlCache | null {
  return urlCache;
}

export function setupIpcHandlers(windowManager: WindowManager): void {
  ytdlpManager = new YtdlpManager();
  urlCache = new UrlCache();
  transcriptManager = new TranscriptManager();
  geminiService = new GeminiService();

  // Handle video URL extraction
  ipcMain.handle(IPC_CHANNELS.EXTRACT_VIDEO, async (_event, url: string): Promise<ExtractResult> => {
    // Validate URL input
    const validation = validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Check cache first
      const cached = urlCache?.get(url);
      if (cached) {
        return {
          success: true,
          videoUrl: cached.videoUrl,
          title: cached.title,
        };
      }

      // Check if it's a direct video URL
      if (isDirectVideoUrl(url)) {
        return {
          success: true,
          videoUrl: url,
          title: 'Direct Video',
        };
      }

      // Extract using yt-dlp
      const result = await ytdlpManager!.extract(url);

      if (result.success && result.videoUrl) {
        // Cache the result
        urlCache?.set(url, {
          videoUrl: result.videoUrl,
          title: result.title || 'Unknown',
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Window controls
  ipcMain.on(IPC_CHANNELS.MINIMIZE_WINDOW, () => {
    windowManager.minimize();
  });

  ipcMain.on(IPC_CHANNELS.CLOSE_WINDOW, () => {
    windowManager.destroy();
    app.quit();
  });

  ipcMain.on(IPC_CHANNELS.SET_ALWAYS_ON_TOP, (_event, value: boolean) => {
    // Validate boolean input
    if (typeof value !== 'boolean') {
      return;
    }
    windowManager.setAlwaysOnTop(value);
    settings.alwaysOnTop = value;
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): AppSettings => {
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, newSettings: Partial<AppSettings>) => {
    // Validate and sanitize settings before merging
    const validatedSettings = validateSettings(newSettings);
    settings = { ...settings, ...validatedSettings };
  });

  // ========== Chat/Transcript Handlers ==========

  // Extract transcript from the current video
  ipcMain.handle(IPC_CHANNELS.EXTRACT_TRANSCRIPT, async (): Promise<TranscriptResult> => {
    if (!ytdlpManager || !transcriptManager) {
      return { success: false, error: 'Services not initialized' };
    }

    const subtitles = ytdlpManager.getLastSubtitles();
    if (subtitles.length === 0) {
      return { success: false, error: 'No transcript available for this video' };
    }

    // Use the first available subtitle
    const result = await transcriptManager.fetchTranscript(subtitles[0]!);
    if (result.success) {
      lastTranscript = result;
    }

    return result;
  });

  // Get Gemini settings
  ipcMain.handle(IPC_CHANNELS.GET_GEMINI_SETTINGS, (): GeminiSettings => {
    if (!geminiService) {
      return { model: 'gemini-1.5-flash' };
    }
    return geminiService.getSettings();
  });

  // Save Gemini settings
  ipcMain.handle(IPC_CHANNELS.SAVE_GEMINI_SETTINGS, (_event, newSettings: Partial<GeminiSettings>) => {
    if (!geminiService) return;

    // Validate input
    const validated: Partial<GeminiSettings> = {};
    if (typeof newSettings === 'object' && newSettings !== null) {
      if (typeof newSettings.apiKey === 'string') {
        validated.apiKey = newSettings.apiKey;
      }
      if (typeof newSettings.model === 'string') {
        validated.model = newSettings.model;
      }
    }

    geminiService.updateSettings(validated);
  });

  // Handle chat message - streams response back to renderer
  ipcMain.handle(
    IPC_CHANNELS.CHAT_SEND_MESSAGE,
    async (event, message: string, history: ChatMessage[]): Promise<void> => {
      if (!geminiService) {
        event.sender.send(IPC_CHANNELS.CHAT_ERROR, 'Gemini service not initialized');
        return;
      }

      if (!geminiService.isConfigured()) {
        event.sender.send(IPC_CHANNELS.CHAT_ERROR, 'Please configure your Gemini API key in settings');
        return;
      }

      if (!lastTranscript?.fullText) {
        event.sender.send(IPC_CHANNELS.CHAT_ERROR, 'No transcript available. Please load a video with captions first.');
        return;
      }

      // Validate message
      if (typeof message !== 'string' || message.trim().length === 0) {
        event.sender.send(IPC_CHANNELS.CHAT_ERROR, 'Message cannot be empty');
        return;
      }

      // Validate history
      if (!Array.isArray(history)) {
        history = [];
      }

      try {
        const stream = geminiService.streamChat(message, lastTranscript.fullText, history);

        for await (const chunk of stream) {
          event.sender.send(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, chunk);
        }

        event.sender.send(IPC_CHANNELS.CHAT_RESPONSE_COMPLETE);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        event.sender.send(IPC_CHANNELS.CHAT_ERROR, errorMessage);
      }
    }
  );
}

function isDirectVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.m3u8', '.mpd'];
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return videoExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}
