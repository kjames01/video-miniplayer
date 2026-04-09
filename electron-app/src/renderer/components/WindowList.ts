import { WINDOW_REFRESH_INTERVAL_MS, WINDOW_TITLE_MAX_LENGTH } from '../../shared/constants';
import { ResizePanel } from './ResizePanel';

interface WindowInfo {
  hwnd: number;
  title: string;
  className: string;
  processId: number;
  bounds: { x: number; y: number; width: number; height: number };
  isTopmost: boolean;
  isMinimized: boolean;
}

export class WindowList {
  private listEl: HTMLElement;
  private countEl: HTMLElement;
  private searchInput: HTMLInputElement;
  private resizePanel: ResizePanel;
  private windows: WindowInfo[] = [];
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private searchFilter: string = '';
  private selectedHwnd: number | null = null;

  constructor(resizePanel: ResizePanel) {
    this.resizePanel = resizePanel;
    this.listEl = document.getElementById('window-list') as HTMLElement;
    this.countEl = document.getElementById('window-count') as HTMLElement;
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;

    this.setupEventListeners();
    this.refresh();
    this.startAutoRefresh();
  }

  private setupEventListeners(): void {
    this.searchInput.addEventListener('input', () => {
      this.searchFilter = this.searchInput.value.toLowerCase();
      this.render();
    });
  }

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, WINDOW_REFRESH_INTERVAL_MS);
  }

  async refresh(): Promise<void> {
    try {
      this.windows = await window.electronAPI.getWindows();
      this.render();
    } catch (e) {
      console.error('Failed to get windows:', e);
    }
  }

  private getFilteredWindows(): WindowInfo[] {
    if (!this.searchFilter) return this.windows;
    return this.windows.filter(w =>
      w.title.toLowerCase().includes(this.searchFilter)
    );
  }

  private render(): void {
    const filtered = this.getFilteredWindows();

    // Update count
    const total = this.windows.length;
    const shown = filtered.length;
    this.countEl.textContent = this.searchFilter
      ? `${shown} of ${total} windows`
      : `${total} window${total !== 1 ? 's' : ''}`;

    // Clear and rebuild list
    this.listEl.innerHTML = '';

    for (const win of filtered) {
      const item = document.createElement('div');
      item.className = 'window-item';
      if (win.isTopmost) item.classList.add('pinned');
      if (win.isMinimized) item.classList.add('minimized');
      if (win.hwnd === this.selectedHwnd) item.classList.add('selected');

      // Pin button
      const pinBtn = document.createElement('button');
      pinBtn.className = 'item-btn pin-toggle' + (win.isTopmost ? ' active' : '');
      pinBtn.textContent = '\u{1F4CC}';
      pinBtn.title = win.isTopmost ? 'Unpin' : 'Pin to top';
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePin(win);
      });

      // Title
      const title = document.createElement('span');
      title.className = 'item-title';
      const displayTitle = win.title.length > WINDOW_TITLE_MAX_LENGTH
        ? win.title.substring(0, WINDOW_TITLE_MAX_LENGTH) + '...'
        : win.title;
      title.textContent = displayTitle;
      title.title = win.title;

      // Focus button
      const focusBtn = document.createElement('button');
      focusBtn.className = 'item-btn focus-btn';
      focusBtn.textContent = '\u{1F441}';
      focusBtn.title = 'Focus window';
      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focusWindow(win);
      });

      // Resize button
      const resizeBtn = document.createElement('button');
      resizeBtn.className = 'item-btn resize-btn';
      resizeBtn.textContent = '\u2922';
      resizeBtn.title = 'Resize window';
      resizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectForResize(win);
      });

      item.appendChild(pinBtn);
      item.appendChild(title);
      item.appendChild(focusBtn);
      item.appendChild(resizeBtn);

      // Click row to select
      item.addEventListener('click', () => {
        this.selectForResize(win);
      });

      this.listEl.appendChild(item);
    }
  }

  private async togglePin(win: WindowInfo): Promise<void> {
    const result = await window.electronAPI.setTopmost(win.hwnd, !win.isTopmost);
    if (!result.success) {
      console.error('Failed to toggle pin:', result.error);
    }
    this.refresh();
  }

  private async focusWindow(win: WindowInfo): Promise<void> {
    await window.electronAPI.focusWindow(win.hwnd);
  }

  private selectForResize(win: WindowInfo): void {
    this.selectedHwnd = win.hwnd;
    this.resizePanel.show(win.hwnd, win.title, win.bounds);
    this.render();
  }

  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
