import { GoogleGenerativeAI, GenerativeModel, ChatSession, Content } from '@google/generative-ai';
import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ChatMessage, GeminiSettings } from '../shared/types';

const SETTINGS_FILE = 'gemini-settings.json';
const DEFAULT_MODEL = 'gemini-2.0-flash';

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private settings: GeminiSettings = { model: DEFAULT_MODEL };
  private settingsPath: string;

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    this.loadSettings();
  }

  /**
   * Load settings from disk
   */
  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const saved = JSON.parse(data);

        this.settings = {
          model: saved.model || DEFAULT_MODEL,
          apiKey: undefined
        };

        // Decrypt API key if present
        if (saved.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
          try {
            const decrypted = safeStorage.decryptString(Buffer.from(saved.encryptedApiKey, 'base64'));
            this.settings.apiKey = decrypted;
            this.initializeClient();
          } catch {
            console.error('[GeminiService] Failed to decrypt API key');
          }
        }
      }
    } catch (error) {
      console.error('[GeminiService] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to disk
   */
  private saveSettings(): void {
    try {
      const toSave: Record<string, unknown> = {
        model: this.settings.model
      };

      // Encrypt API key if present and encryption is available
      if (this.settings.apiKey) {
        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(this.settings.apiKey);
          toSave.encryptedApiKey = encrypted.toString('base64');
        } else {
          console.error('[GeminiService] Encryption not available, refusing to store API key in plaintext');
          return;
        }
      }

      fs.writeFileSync(this.settingsPath, JSON.stringify(toSave, null, 2));
    } catch (error) {
      console.error('[GeminiService] Failed to save settings:', error);
    }
  }

  /**
   * Initialize the Gemini client with the API key
   */
  private initializeClient(): void {
    if (!this.settings.apiKey) {
      this.genAI = null;
      this.model = null;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.settings.model });
    } catch (error) {
      console.error('[GeminiService] Failed to initialize client:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  /**
   * Get current settings (without exposing the full API key)
   */
  getSettings(): GeminiSettings {
    return {
      model: this.settings.model,
      apiKey: this.settings.apiKey ? '***' + this.settings.apiKey.slice(-4) : undefined
    };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<GeminiSettings>): void {
    if (newSettings.model) {
      this.settings.model = newSettings.model;
    }

    if (newSettings.apiKey !== undefined) {
      this.settings.apiKey = newSettings.apiKey || undefined;
      this.initializeClient();
    }

    this.saveSettings();
  }

  /**
   * Check if the service is configured and ready
   */
  isConfigured(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  /**
   * Stream a chat response
   */
  async *streamChat(
    userMessage: string,
    transcript: string,
    history: ChatMessage[]
  ): AsyncGenerator<string, void, unknown> {
    if (!this.model) {
      throw new Error('Gemini API not configured. Please add your API key in settings.');
    }

    // Prepare the system context with transcript
    const systemPrompt = `You are a helpful assistant that answers questions about a video based on its transcript. Be concise and helpful.

Here is the video transcript:
---
${transcript}
---

Answer questions based on the transcript above. If the answer isn't in the transcript, say so. Keep responses concise.`;

    // Convert history to Gemini format
    const formattedHistory: Content[] = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    try {
      // Start chat with history
      const chat: ChatSession = this.model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'I understand. I\'ll answer questions about the video based on the transcript you provided. What would you like to know?' }] },
          ...formattedHistory
        ]
      });

      // Stream the response
      const result = await chat.sendMessageStream(userMessage);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Chat request failed: ${errorMessage}`);
    }
  }
}
