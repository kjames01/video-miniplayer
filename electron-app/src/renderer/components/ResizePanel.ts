import { RESIZE_PRESETS } from '../../shared/constants';

export class ResizePanel {
  private panelEl: HTMLElement;
  private titleEl: HTMLElement;
  private closePanelBtn: HTMLButtonElement;
  private presetsEl: HTMLElement;
  private widthInput: HTMLInputElement;
  private heightInput: HTMLInputElement;
  private applyBtn: HTMLButtonElement;
  private currentSizeEl: HTMLElement;
  private currentHwnd: number | null = null;

  constructor() {
    this.panelEl = document.getElementById('resize-panel') as HTMLElement;
    this.titleEl = document.getElementById('selected-window-title') as HTMLElement;
    this.closePanelBtn = document.getElementById('close-panel-btn') as HTMLButtonElement;
    this.presetsEl = document.getElementById('resize-presets') as HTMLElement;
    this.widthInput = document.getElementById('custom-width') as HTMLInputElement;
    this.heightInput = document.getElementById('custom-height') as HTMLInputElement;
    this.applyBtn = document.getElementById('apply-resize-btn') as HTMLButtonElement;
    this.currentSizeEl = document.getElementById('current-size') as HTMLElement;

    this.buildPresets();
    this.setupEventListeners();
  }

  private buildPresets(): void {
    for (const preset of RESIZE_PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        this.applyResize(preset.width, preset.height);
      });
      this.presetsEl.appendChild(btn);
    }
  }

  private setupEventListeners(): void {
    this.closePanelBtn.addEventListener('click', () => {
      this.hide();
    });

    this.applyBtn.addEventListener('click', () => {
      const width = parseInt(this.widthInput.value, 10);
      const height = parseInt(this.heightInput.value, 10);
      if (!isNaN(width) && !isNaN(height)) {
        this.applyResize(width, height);
      }
    });

    // Enter key in inputs triggers apply
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.applyBtn.click();
    };
    this.widthInput.addEventListener('keydown', handleEnter);
    this.heightInput.addEventListener('keydown', handleEnter);
  }

  show(hwnd: number, title: string, bounds: { width: number; height: number }): void {
    this.currentHwnd = hwnd;
    const maxLen = 40;
    this.titleEl.textContent = title.length > maxLen ? title.substring(0, maxLen) + '...' : title;
    this.titleEl.title = title;
    this.updateCurrentSize(bounds.width, bounds.height);
    this.widthInput.value = String(bounds.width);
    this.heightInput.value = String(bounds.height);
    this.panelEl.classList.remove('hidden');
  }

  hide(): void {
    this.currentHwnd = null;
    this.panelEl.classList.add('hidden');
  }

  private updateCurrentSize(width: number, height: number): void {
    this.currentSizeEl.textContent = `Current: ${width} x ${height}`;
  }

  private async applyResize(width: number, height: number): Promise<void> {
    if (this.currentHwnd === null) return;

    const result = await window.electronAPI.resizeWindow(this.currentHwnd, width, height);
    if (result.success) {
      this.updateCurrentSize(width, height);
      this.widthInput.value = String(width);
      this.heightInput.value = String(height);
    } else {
      console.error('Resize failed:', result.error);
    }
  }
}
