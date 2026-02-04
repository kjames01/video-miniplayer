import { ChatStore, ChatState, TranscriptStatus } from '../stores/ChatStore';
import { ChatMessage } from '../../shared/types';

export class ChatPanel {
  private container: HTMLElement;
  private store: ChatStore;
  private messagesContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private statusElement: HTMLElement | null = null;
  private settingsPanel: HTMLElement | null = null;
  private isVisible: boolean = false;

  constructor(store: ChatStore) {
    this.store = store;
    this.container = document.getElementById('chat-panel') as HTMLElement;

    if (this.container) {
      this.render();
      this.setupEventListeners();
      this.store.subscribe((state) => this.onStateChange(state));
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="chat-header">
        <span class="chat-title">Chat</span>
        <div class="chat-header-actions">
          <button class="chat-btn" id="chat-settings-btn" title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="chat-btn" id="chat-clear-btn" title="Clear chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="chat-status" id="chat-status">
        <span class="status-dot"></span>
        <span class="status-text">Loading...</span>
      </div>

      <div class="chat-settings hidden" id="chat-settings">
        <div class="settings-field">
          <label for="api-key-input">Gemini API Key</label>
          <input type="password" id="api-key-input" placeholder="Enter your API key...">
          <button id="save-api-key-btn" class="settings-save-btn">Save</button>
        </div>
        <p class="settings-hint">
          Get your API key from <a href="#" id="gemini-link">Google AI Studio</a>
        </p>
      </div>

      <div class="chat-messages" id="chat-messages"></div>

      <div class="chat-input-container">
        <input type="text" id="chat-input" placeholder="Ask about the video..." disabled>
        <button id="chat-send-btn" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;

    this.messagesContainer = document.getElementById('chat-messages');
    this.inputElement = document.getElementById('chat-input') as HTMLInputElement;
    this.sendButton = document.getElementById('chat-send-btn') as HTMLButtonElement;
    this.statusElement = document.getElementById('chat-status');
    this.settingsPanel = document.getElementById('chat-settings');
  }

  private setupEventListeners(): void {
    // Send button
    this.sendButton?.addEventListener('click', () => {
      this.sendMessage();
    });

    // Enter key to send
    this.inputElement?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Settings button
    document.getElementById('chat-settings-btn')?.addEventListener('click', () => {
      this.toggleSettings();
    });

    // Clear button
    document.getElementById('chat-clear-btn')?.addEventListener('click', () => {
      this.store.clearMessages();
    });

    // Save API key
    document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
      this.saveApiKey();
    });

    // Gemini link
    document.getElementById('gemini-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      // Open in default browser via shell
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    });
  }

  private onStateChange(state: ChatState): void {
    this.updateStatus(state.transcriptStatus, state.transcriptError, state.apiKeyConfigured);
    this.updateMessages(state.messages, state.currentStreamingContent, state.isStreaming);
    this.updateInputState(state);
  }

  private updateStatus(status: TranscriptStatus, error?: string, apiKeyConfigured?: boolean): void {
    if (!this.statusElement) return;

    const dot = this.statusElement.querySelector('.status-dot');
    const text = this.statusElement.querySelector('.status-text');

    if (!dot || !text) return;

    // Remove all status classes
    dot.className = 'status-dot';

    if (!apiKeyConfigured) {
      dot.classList.add('status-warning');
      text.textContent = 'API key required';
      return;
    }

    switch (status) {
      case 'idle':
        dot.classList.add('status-idle');
        text.textContent = 'Load a video to chat';
        break;
      case 'loading':
        dot.classList.add('status-loading');
        text.textContent = 'Loading transcript...';
        break;
      case 'ready':
        dot.classList.add('status-ready');
        text.textContent = 'Transcript ready';
        break;
      case 'error':
        dot.classList.add('status-error');
        text.textContent = error || 'Error loading transcript';
        break;
      case 'unavailable':
        dot.classList.add('status-warning');
        text.textContent = 'No captions available';
        break;
    }
  }

  private updateMessages(messages: ChatMessage[], streamingContent: string, isStreaming: boolean): void {
    if (!this.messagesContainer) return;

    // Build messages HTML
    let html = '';

    for (const msg of messages) {
      const isUser = msg.role === 'user';
      const isError = msg.content.startsWith('Error:');
      html += `
        <div class="chat-message ${isUser ? 'user-message' : 'assistant-message'} ${isError ? 'error-message' : ''}">
          <div class="message-content">${this.escapeHtml(msg.content)}</div>
        </div>
      `;
    }

    // Add streaming message if in progress
    if (isStreaming && streamingContent) {
      html += `
        <div class="chat-message assistant-message streaming">
          <div class="message-content">${this.escapeHtml(streamingContent)}</div>
        </div>
      `;
    } else if (isStreaming) {
      html += `
        <div class="chat-message assistant-message streaming">
          <div class="message-content typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
    }

    this.messagesContainer.innerHTML = html;

    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private updateInputState(state: ChatState): void {
    if (!this.inputElement || !this.sendButton) return;

    const canSend = state.transcriptStatus === 'ready' && !state.isStreaming && state.apiKeyConfigured;

    this.inputElement.disabled = !canSend;
    this.sendButton.disabled = !canSend;

    if (!state.apiKeyConfigured) {
      this.inputElement.placeholder = 'Configure API key in settings...';
    } else if (state.transcriptStatus !== 'ready') {
      this.inputElement.placeholder = 'Load a video with captions first...';
    } else if (state.isStreaming) {
      this.inputElement.placeholder = 'Waiting for response...';
    } else {
      this.inputElement.placeholder = 'Ask about the video...';
    }
  }

  private sendMessage(): void {
    if (!this.inputElement) return;

    const message = this.inputElement.value.trim();
    if (message) {
      this.store.sendMessage(message);
      this.inputElement.value = '';
    }
  }

  private toggleSettings(): void {
    if (!this.settingsPanel) return;
    this.settingsPanel.classList.toggle('hidden');
  }

  private async saveApiKey(): Promise<void> {
    const input = document.getElementById('api-key-input') as HTMLInputElement;
    if (!input) return;

    const apiKey = input.value.trim();
    await this.store.saveApiKey(apiKey);
    input.value = '';
    this.settingsPanel?.classList.add('hidden');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show the chat panel
   */
  show(): void {
    this.container.classList.add('visible');
    this.isVisible = true;
    document.getElementById('app')?.classList.add('chat-open');
  }

  /**
   * Hide the chat panel
   */
  hide(): void {
    this.container.classList.remove('visible');
    this.isVisible = false;
    document.getElementById('app')?.classList.remove('chat-open');
  }

  /**
   * Toggle panel visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if panel is visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Called when a new video is loaded
   */
  onVideoLoaded(): void {
    this.store.resetTranscript();
    this.store.loadTranscript();
  }
}
