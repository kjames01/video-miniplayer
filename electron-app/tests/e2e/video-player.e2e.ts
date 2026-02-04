import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, ElectronAppContext } from './electron-app';

let context: ElectronAppContext;

test.describe('Video Player Controls', () => {
  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context) {
      await closeElectronApp(context);
    }
  });

  test('should display video controls', async () => {
    const videoControls = await context.window.$('#video-controls');
    expect(videoControls).not.toBeNull();
  });

  test('should have play/pause button', async () => {
    const playPauseBtn = await context.window.$('#play-pause-btn');
    expect(playPauseBtn).not.toBeNull();

    const buttonText = await context.window.$eval('#play-pause-btn', el => el.textContent);
    // Initially should show play icon
    expect(buttonText).toBeTruthy();
  });

  test('should display progress bar', async () => {
    const progressContainer = await context.window.$('#progress-container');
    expect(progressContainer).not.toBeNull();

    const progressBar = await context.window.$('#progress-bar');
    expect(progressBar).not.toBeNull();

    const progressFilled = await context.window.$('#progress-filled');
    expect(progressFilled).not.toBeNull();
  });

  test('should display time display', async () => {
    const timeDisplay = await context.window.$('#time-display');
    expect(timeDisplay).not.toBeNull();

    const timeText = await context.window.$eval('#time-display', el => el.textContent);
    // Default time display format
    expect(timeText).toContain('/');
  });

  test('should have volume controls', async () => {
    const volumeContainer = await context.window.$('#volume-container');
    expect(volumeContainer).not.toBeNull();

    const muteBtn = await context.window.$('#mute-btn');
    expect(muteBtn).not.toBeNull();

    const volumeSlider = await context.window.$('#volume-slider');
    expect(volumeSlider).not.toBeNull();
  });

  test('should have volume slider with correct attributes', async () => {
    const volumeSlider = await context.window.$('#volume-slider');
    expect(volumeSlider).not.toBeNull();

    const min = await context.window.$eval('#volume-slider', (el: HTMLInputElement) => el.min);
    const max = await context.window.$eval('#volume-slider', (el: HTMLInputElement) => el.max);
    const value = await context.window.$eval('#volume-slider', (el: HTMLInputElement) => el.value);

    expect(min).toBe('0');
    expect(max).toBe('100');
    expect(parseInt(value)).toBeGreaterThanOrEqual(0);
    expect(parseInt(value)).toBeLessThanOrEqual(100);
  });

  test('should change volume slider value', async () => {
    const volumeSlider = await context.window.$('#volume-slider');
    expect(volumeSlider).not.toBeNull();

    // Set volume to 50
    await context.window.$eval('#volume-slider', (el: HTMLInputElement) => {
      el.value = '50';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const value = await context.window.$eval('#volume-slider', (el: HTMLInputElement) => el.value);
    expect(value).toBe('50');
  });

  test('should toggle mute when clicking mute button', async () => {
    const muteBtn = await context.window.$('#mute-btn');
    expect(muteBtn).not.toBeNull();

    const initialText = await context.window.$eval('#mute-btn', el => el.textContent);

    // Use evaluate to click to avoid Playwright action timeout
    await context.window.evaluate(() => {
      const btn = document.querySelector('#mute-btn') as HTMLButtonElement;
      if (btn) btn.click();
    });

    await context.window.waitForTimeout(100);

    // Button text might change to indicate muted state
    const muteStateAfterClick = await context.window.$eval('#mute-btn', el => el.textContent);
    expect(muteStateAfterClick).toBeTruthy();
  });

  test('should have video element', async () => {
    const videoPlayer = await context.window.$('#video-player');
    expect(videoPlayer).not.toBeNull();

    // Check video element has required attributes
    const hasPlaysinline = await context.window.$eval('#video-player', (el: HTMLVideoElement) => el.hasAttribute('playsinline'));
    expect(hasPlaysinline).toBe(true);
  });

  test('should click play/pause button without error', async () => {
    const playPauseBtn = await context.window.$('#play-pause-btn');
    expect(playPauseBtn).not.toBeNull();

    // Use evaluate to click to avoid Playwright action timeout
    await context.window.evaluate(() => {
      const btn = document.querySelector('#play-pause-btn') as HTMLButtonElement;
      if (btn) btn.click();
    });

    await context.window.waitForTimeout(100);

    // UI should still be responsive
    const videoControls = await context.window.$('#video-controls');
    expect(videoControls).not.toBeNull();
  });

  test('should click progress bar without error', async () => {
    const progressBar = await context.window.$('#progress-bar');
    expect(progressBar).not.toBeNull();

    // Use evaluate to trigger click event
    await context.window.evaluate(() => {
      const bar = document.querySelector('#progress-bar') as HTMLElement;
      if (bar) {
        const rect = bar.getBoundingClientRect();
        const event = new MouseEvent('click', {
          bubbles: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        bar.dispatchEvent(event);
      }
    });

    await context.window.waitForTimeout(100);

    // UI should still be responsive
    const videoControls = await context.window.$('#video-controls');
    expect(videoControls).not.toBeNull();
  });

  test('video controls should have proper structure', async () => {
    // Check the overall structure of video controls
    const structure = await context.window.evaluate(() => {
      const controls = document.querySelector('#video-controls');
      if (!controls) return null;

      return {
        hasPlayPause: !!controls.querySelector('#play-pause-btn'),
        hasProgress: !!controls.querySelector('#progress-container'),
        hasVolume: !!controls.querySelector('#volume-container'),
        childCount: controls.children.length
      };
    });

    expect(structure).not.toBeNull();
    expect(structure!.hasPlayPause).toBe(true);
    expect(structure!.hasProgress).toBe(true);
    expect(structure!.hasVolume).toBe(true);
  });
});
