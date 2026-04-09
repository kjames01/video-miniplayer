export class TitleBar {
  private pinBtn: HTMLButtonElement;
  private minimizeBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private refreshBtn: HTMLButtonElement;
  private isPinned: boolean = true;
  private onRefresh: (() => void) | null;

  constructor(onRefresh: () => void) {
    this.onRefresh = onRefresh;
    this.pinBtn = document.getElementById('pin-btn') as HTMLButtonElement;
    this.minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
    this.closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
    this.refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;

    this.setupEventListeners();
    this.loadSettings();
  }

  private setupEventListeners(): void {
    this.pinBtn.addEventListener('click', () => {
      this.isPinned = !this.isPinned;
      this.updatePinButton();
      window.electronAPI.setAlwaysOnTop(this.isPinned);
    });

    this.minimizeBtn.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    this.closeBtn.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });

    this.refreshBtn.addEventListener('click', () => {
      this.onRefresh?.();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        this.onRefresh?.();
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
}
