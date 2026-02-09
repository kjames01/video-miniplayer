import { ChatMessage, TranscriptResult, GeminiSettings } from '../../shared/types';

export type TranscriptStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

export interface ChatState {
  messages: ChatMessage[];
  transcriptStatus: TranscriptStatus;
  transcriptError?: string;
  isStreaming: boolean;
  currentStreamingContent: string;
  apiKeyConfigured: boolean;
}

type ChatStateListener = (state: ChatState) => void;

export class ChatStore {
  private state: ChatState = {
    messages: [],
    transcriptStatus: 'idle',
    isStreaming: false,
    currentStreamingContent: '',
    apiKeyConfigured: false
  };

  private listeners: Set<ChatStateListener> = new Set();
  private ipcCleanups: Array<() => void> = [];

  constructor() {
    this.setupIpcListeners();
    this.checkApiKeyStatus();
  }

  private setupIpcListeners(): void {
    // Handle streaming response chunks
    const cleanupChunk = window.electronAPI.onChatResponseChunk((chunk: string) => {
      this.state.currentStreamingContent += chunk;
      this.notify();
    });
    if (cleanupChunk) this.ipcCleanups.push(cleanupChunk);

    // Handle streaming complete
    const cleanupComplete = window.electronAPI.onChatResponseComplete(() => {
      if (this.state.currentStreamingContent) {
        const assistantMessage: ChatMessage = {
          id: this.generateId(),
          role: 'assistant',
          content: this.state.currentStreamingContent,
          timestamp: Date.now()
        };
        this.state.messages.push(assistantMessage);
      }
      this.state.isStreaming = false;
      this.state.currentStreamingContent = '';
      this.notify();
    });
    if (cleanupComplete) this.ipcCleanups.push(cleanupComplete);

    // Handle chat errors
    const cleanupError = window.electronAPI.onChatError((error: string) => {
      this.state.isStreaming = false;
      this.state.currentStreamingContent = '';
      // Add error as a system message
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: Date.now()
      };
      this.state.messages.push(errorMessage);
      this.notify();
    });
    if (cleanupError) this.ipcCleanups.push(cleanupError);
  }

  destroy(): void {
    for (const cleanup of this.ipcCleanups) {
      cleanup();
    }
    this.ipcCleanups = [];
    this.listeners.clear();
  }

  private async checkApiKeyStatus(): Promise<void> {
    try {
      const settings = await window.electronAPI.getGeminiSettings();
      this.state.apiKeyConfigured = !!settings.apiKey;
      this.notify();
    } catch {
      this.state.apiKeyConfigured = false;
    }
  }

  getState(): ChatState {
    return { ...this.state };
  }

  subscribe(listener: ChatStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Load transcript for the current video
   */
  async loadTranscript(): Promise<void> {
    this.state.transcriptStatus = 'loading';
    this.state.transcriptError = undefined;
    this.notify();

    try {
      const result: TranscriptResult = await window.electronAPI.extractTranscript();

      if (result.success) {
        this.state.transcriptStatus = 'ready';
      } else {
        this.state.transcriptStatus = 'unavailable';
        this.state.transcriptError = result.error;
      }
    } catch (error) {
      this.state.transcriptStatus = 'error';
      this.state.transcriptError = error instanceof Error ? error.message : 'Unknown error';
    }

    this.notify();
  }

  /**
   * Send a chat message
   */
  async sendMessage(content: string): Promise<void> {
    if (this.state.isStreaming || !content.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };
    this.state.messages.push(userMessage);
    this.state.isStreaming = true;
    this.state.currentStreamingContent = '';
    this.notify();

    // Get history without the just-added message (it's passed separately)
    const history = this.state.messages.slice(0, -1);

    try {
      await window.electronAPI.sendChatMessage(content.trim(), history);
    } catch (error) {
      // Error handling is done via IPC listener
      console.error('[ChatStore] Send message error:', error);
    }
  }

  /**
   * Save API key
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await window.electronAPI.saveGeminiSettings({ apiKey });
    this.state.apiKeyConfigured = !!apiKey;
    this.notify();
  }

  /**
   * Clear chat history
   */
  clearMessages(): void {
    this.state.messages = [];
    this.notify();
  }

  /**
   * Reset transcript status (e.g., when loading a new video)
   */
  resetTranscript(): void {
    this.state.transcriptStatus = 'idle';
    this.state.transcriptError = undefined;
    this.notify();
  }
}
