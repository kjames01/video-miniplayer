import { VideoPlayer } from './VideoPlayer';

export class UrlInput {
  private input: HTMLInputElement;
  private loadBtn: HTMLButtonElement;
  private statusText: HTMLElement;
  private player: VideoPlayer;
  private isLoading: boolean = false;

  constructor(player: VideoPlayer) {
    this.player = player;
    this.input = document.getElementById('url-input') as HTMLInputElement;
    this.loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    this.statusText = document.getElementById('status-text') as HTMLElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Load button click
    this.loadBtn.addEventListener('click', () => {
      this.loadVideo();
    });

    // Enter key to load
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.loadVideo();
      }
    });

    // Clear status on input
    this.input.addEventListener('input', () => {
      this.clearStatus();
    });

    // Paste handler
    this.input.addEventListener('paste', () => {
      // Auto-load after paste with a small delay
      setTimeout(() => {
        if (this.input.value.trim()) {
          this.loadVideo();
        }
      }, 100);
    });
  }

  async loadVideo(): Promise<void> {
    const url = this.input.value.trim();

    if (!url) {
      this.showError('Please enter a URL');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showError('Please enter a valid URL');
      return;
    }

    if (this.isLoading) return;

    this.setLoading(true);
    this.showStatus('Extracting video...');

    try {
      const result = await window.electronAPI.extractVideo(url);

      if (result.success && result.videoUrl) {
        this.showStatus('Playing: ' + (result.title || 'Video'));
        this.player.loadVideo(result.videoUrl);

        // Update title bar if title is available
        if (result.title) {
          const titleText = document.querySelector('.title-text') as HTMLElement;
          if (titleText) {
            const maxLen = 30;
            titleText.textContent = result.title.length > maxLen
              ? result.title.substring(0, maxLen) + '...'
              : result.title;
            titleText.title = result.title;
          }
        }
      } else {
        this.showError(result.error || 'Failed to extract video');
      }
    } catch (error) {
      this.showError('Failed to load video');
      console.error('Load error:', error);
    } finally {
      this.setLoading(false);
    }
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.loadBtn.disabled = loading;
    this.input.disabled = loading;
    this.loadBtn.textContent = loading ? '...' : '▶';
  }

  showStatus(message: string): void {
    this.statusText.textContent = message;
    this.statusText.classList.remove('error');
  }

  showError(message: string): void {
    this.statusText.textContent = message;
    this.statusText.classList.add('error');
  }

  clearStatus(): void {
    this.statusText.textContent = '';
    this.statusText.classList.remove('error');
  }

  setUrl(url: string): void {
    this.input.value = url;
  }

  getUrl(): string {
    return this.input.value.trim();
  }
}
