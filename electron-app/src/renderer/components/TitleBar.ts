export type ChatToggleCallback = () => void;

export class TitleBar {
  private titleText: HTMLElement;
  private pinBtn: HTMLButtonElement;
  private minimizeBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private chatToggleBtn: HTMLButtonElement;
  private isPinned: boolean = true;
  private onChatToggle: ChatToggleCallback | null = null;

  constructor() {
    this.titleText = document.querySelector('.title-text') as HTMLElement;
    this.pinBtn = document.getElementById('pin-btn') as HTMLButtonElement;
    this.minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
    this.closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
    this.chatToggleBtn = document.getElementById('chat-toggle-btn') as HTMLButtonElement;

    this.setupEventListeners();
    this.loadSettings();
  }

  private setupEventListeners(): void {
    // Pin button (always on top toggle)
    this.pinBtn.addEventListener('click', () => {
      this.isPinned = !this.isPinned;
      this.updatePinButton();
      window.electronAPI.setAlwaysOnTop(this.isPinned);
    });

    // Minimize button
    this.minimizeBtn.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    // Close button
    this.closeBtn.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });

    // Chat toggle button
    this.chatToggleBtn.addEventListener('click', () => {
      if (this.onChatToggle) {
        this.onChatToggle();
      }
    });

    // Keyboard shortcut: Ctrl+Shift+C to toggle chat
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (this.onChatToggle) {
          this.onChatToggle();
        }
      }
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await window.electronAPI.getSettings();
      this.isPinned = settings.alwaysOnTop ?? true;
      this.updatePinButton();
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  private updatePinButton(): void {
    if (this.isPinned) {
      this.pinBtn.classList.add('pinned');
      this.pinBtn.title = 'Always on Top (ON)';
    } else {
      this.pinBtn.classList.remove('pinned');
      this.pinBtn.title = 'Always on Top (OFF)';
    }
  }

  setTitle(title: string): void {
    const maxLength = 30;
    const displayTitle = title.length > maxLength
      ? title.substring(0, maxLength) + '...'
      : title;
    this.titleText.textContent = displayTitle;
    this.titleText.title = title;
  }

  resetTitle(): void {
    this.titleText.textContent = 'Video Miniplayer';
    this.titleText.title = '';
  }

  /**
   * Set the callback for chat toggle
   */
  setChatToggleCallback(callback: ChatToggleCallback): void {
    this.onChatToggle = callback;
  }

  /**
   * Update the chat button active state
   */
  setChatActive(isActive: boolean): void {
    if (isActive) {
      this.chatToggleBtn.classList.add('active');
    } else {
      this.chatToggleBtn.classList.remove('active');
    }
  }
}
