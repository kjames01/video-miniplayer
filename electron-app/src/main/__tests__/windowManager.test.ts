import { BrowserWindow } from 'electron';
import { WindowManager } from '../windowManager';
import { SettingsStore } from '../settingsStore';
import { AppSettings } from '../../shared/types';

const MockBrowserWindow = BrowserWindow as unknown as jest.Mock;

function makeStore(overrides: Partial<AppSettings> = {}): SettingsStore {
  return {
    get: jest.fn().mockReturnValue({ alwaysOnTop: true, volume: 1, ...overrides }),
    update: jest.fn(),
  } as unknown as SettingsStore;
}

/** Find a listener registered via window.on(eventName, handler). */
function getHandler(win: { on: jest.Mock }, event: string): (() => void) | undefined {
  const call = win.on.mock.calls.find((c) => c[0] === event);
  return call?.[1];
}

describe('WindowManager', () => {
  it('initializes always-on-top from persisted settings', () => {
    const store = makeStore({ alwaysOnTop: false });
    const wm = new WindowManager(store);

    expect(wm.isOnTop()).toBe(false);

    wm.createWindow();
    const options = MockBrowserWindow.mock.calls[0][0];
    expect(options.alwaysOnTop).toBe(false);
    expect(options.sandbox).toBe(undefined); // sandbox is under webPreferences
    expect(options.webPreferences.sandbox).toBe(true);
    expect(options.webPreferences.contextIsolation).toBe(true);
    expect(options.webPreferences.nodeIntegration).toBe(false);
  });

  it('positions the window bottom-right by default when no bounds are saved', () => {
    const wm = new WindowManager(makeStore());
    wm.createWindow();

    const options = MockBrowserWindow.mock.calls[0][0];
    // 1920x1080 work area, 400x280 window, 20px margin
    expect(options.width).toBe(400);
    expect(options.height).toBe(280);
    expect(options.x).toBe(1920 - 400 - 20);
    expect(options.y).toBe(1080 - 280 - 20);
  });

  it('restores saved on-screen bounds', () => {
    const saved = { x: 100, y: 120, width: 500, height: 360 };
    const wm = new WindowManager(makeStore({ lastBounds: saved }));
    wm.createWindow();

    const options = MockBrowserWindow.mock.calls[0][0];
    expect(options).toMatchObject(saved);
  });

  it('ignores saved bounds that fall outside all displays', () => {
    const offscreen = { x: 5000, y: 5000, width: 500, height: 360 };
    const wm = new WindowManager(makeStore({ lastBounds: offscreen }));
    wm.createWindow();

    const options = MockBrowserWindow.mock.calls[0][0];
    expect(options.x).toBe(1920 - 400 - 20); // fell back to default
  });

  it('persists bounds (debounced) when the window is moved', () => {
    jest.useFakeTimers();
    try {
      const store = makeStore();
      const wm = new WindowManager(store);
      const win = wm.createWindow() as unknown as { on: jest.Mock };

      const movedHandler = getHandler(win, 'moved');
      expect(movedHandler).toBeDefined();
      movedHandler!();

      // Not saved until the debounce elapses
      expect(store.update).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);

      expect(store.update).toHaveBeenCalledWith({
        lastBounds: { x: 0, y: 0, width: 400, height: 300 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides to tray (does not destroy) on the close event', () => {
    const wm = new WindowManager(makeStore());
    const win = wm.createWindow() as unknown as { on: jest.Mock; hide: jest.Mock };

    const closeHandler = win.on.mock.calls.find((c) => c[0] === 'close')?.[1];
    expect(closeHandler).toBeDefined();

    const event = { preventDefault: jest.fn() };
    closeHandler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(win.hide).toHaveBeenCalled();
  });

  it('delegates window controls to the BrowserWindow', () => {
    const wm = new WindowManager(makeStore());
    const win = wm.createWindow() as unknown as Record<string, jest.Mock>;

    wm.minimize();
    expect(win.minimize).toHaveBeenCalled();

    wm.close();
    expect(win.hide).toHaveBeenCalled();

    wm.show();
    expect(win.show).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();

    wm.setAlwaysOnTop(false);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(wm.isOnTop()).toBe(false);
  });

  it('cleans up on destroy', () => {
    const wm = new WindowManager(makeStore());
    const win = wm.createWindow() as unknown as Record<string, jest.Mock>;

    wm.destroy();

    expect(win.removeAllListeners).toHaveBeenCalledWith('close');
    expect(win.close).toHaveBeenCalled();
    expect(wm.getWindow()).toBeNull();
  });
});
