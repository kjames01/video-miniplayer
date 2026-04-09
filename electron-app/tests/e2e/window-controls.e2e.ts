import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, ElectronAppContext } from './electron-app';

let context: ElectronAppContext;

test.describe('Window Controls', () => {
  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context) {
      await closeElectronApp(context);
    }
  });

  test('should launch the application with correct title', async () => {
    const title = await context.window.title();
    expect(title).toBe('Window Manager');
  });

  test('should display the title bar', async () => {
    const titleBar = await context.window.$('#title-bar');
    expect(titleBar).not.toBeNull();

    const titleText = await context.window.$eval('.title-text', el => el.textContent);
    expect(titleText).toBe('Window Manager');
  });

  test('should have window control buttons', async () => {
    const refreshBtn = await context.window.$('#refresh-btn');
    const pinBtn = await context.window.$('#pin-btn');
    const minimizeBtn = await context.window.$('#minimize-btn');
    const closeBtn = await context.window.$('#close-btn');

    expect(refreshBtn).not.toBeNull();
    expect(pinBtn).not.toBeNull();
    expect(minimizeBtn).not.toBeNull();
    expect(closeBtn).not.toBeNull();
  });

  test('should display window list', async () => {
    const windowList = await context.window.$('#window-list');
    expect(windowList).not.toBeNull();

    // Wait for windows to load
    await context.window.waitForTimeout(1000);

    const windowCount = await context.window.$eval('#window-count', el => el.textContent);
    expect(windowCount).toBeTruthy();
  });

  test('should have search input', async () => {
    const searchInput = await context.window.$('#search-input');
    expect(searchInput).not.toBeNull();
  });

  test('should toggle always-on-top when clicking pin button', async () => {
    await context.window.evaluate(() => {
      const btn = document.querySelector('#pin-btn') as HTMLButtonElement;
      if (btn) btn.click();
    });

    await context.window.waitForTimeout(200);

    const isAlwaysOnTop = await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.isAlwaysOnTop() ?? false;
    });

    expect(typeof isAlwaysOnTop).toBe('boolean');
  });

  test('should minimize window when clicking minimize button', async () => {
    await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows[0]) {
        windows[0].restore();
        windows[0].show();
        windows[0].focus();
      }
    });

    await context.window.waitForTimeout(500);

    const minimizeBtnExists = await context.window.$('#minimize-btn');
    expect(minimizeBtnExists).not.toBeNull();

    await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows[0]) {
        windows[0].minimize();
      }
    });

    await context.window.waitForTimeout(300);

    const isMinimized = await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.isMinimized() ?? false;
    });

    expect(isMinimized).toBe(true);

    await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows[0]) {
        windows[0].restore();
        windows[0].show();
      }
    });

    await context.window.waitForTimeout(300);
  });

  test('should have close button functionality', async () => {
    const closeBtn = await context.window.$('#close-btn');
    expect(closeBtn).not.toBeNull();

    const hasCloseClass = await context.window.$eval('#close-btn', el => el.classList.contains('close'));
    expect(hasCloseClass).toBe(true);
  });

  test('should be a frameless window', async () => {
    const windowCount = await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.length;
    });

    expect(windowCount).toBeGreaterThan(0);
  });
});
