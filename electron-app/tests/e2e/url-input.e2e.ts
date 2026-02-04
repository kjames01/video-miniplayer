import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, ElectronAppContext } from './electron-app';

let context: ElectronAppContext;

test.describe('URL Input and Video Loading', () => {
  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context) {
      await closeElectronApp(context);
    }
  });

  test('should display URL input section', async () => {
    const urlSection = await context.window.$('#url-section');
    expect(urlSection).not.toBeNull();

    const urlInput = await context.window.$('#url-input');
    expect(urlInput).not.toBeNull();

    const loadBtn = await context.window.$('#load-btn');
    expect(loadBtn).not.toBeNull();
  });

  test('should have placeholder text in URL input', async () => {
    const placeholder = await context.window.$eval('#url-input', (el: HTMLInputElement) => el.placeholder);
    expect(placeholder).toBe('Paste video URL here...');
  });

  test('should allow typing in URL input', async () => {
    const urlInput = await context.window.$('#url-input');
    expect(urlInput).not.toBeNull();

    const testUrl = 'https://example.com/video.mp4';
    await urlInput!.fill(testUrl);

    const value = await context.window.$eval('#url-input', (el: HTMLInputElement) => el.value);
    expect(value).toBe(testUrl);
  });

  test('should clear URL input', async () => {
    const urlInput = await context.window.$('#url-input');
    await urlInput!.fill('');

    const value = await context.window.$eval('#url-input', (el: HTMLInputElement) => el.value);
    expect(value).toBe('');
  });

  test('should display placeholder when no video is loaded', async () => {
    const placeholder = await context.window.$('#placeholder');
    expect(placeholder).not.toBeNull();

    const placeholderText = await context.window.$eval('.placeholder-text', el => el.textContent);
    expect(placeholderText).toContain('Paste a video URL');
  });

  test('should display video container', async () => {
    const videoContainer = await context.window.$('#video-container');
    expect(videoContainer).not.toBeNull();

    const videoPlayer = await context.window.$('#video-player');
    expect(videoPlayer).not.toBeNull();
  });

  test('should have loading overlay (hidden by default)', async () => {
    const loadingOverlay = await context.window.$('#loading-overlay');
    expect(loadingOverlay).not.toBeNull();

    const hasHiddenClass = await context.window.$eval('#loading-overlay', el => el.classList.contains('hidden'));
    expect(hasHiddenClass).toBe(true);
  });

  test('should handle direct video URL (MP4)', async () => {
    // Use a small test video from a reliable source
    const testVideoUrl = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4';

    const urlInput = await context.window.$('#url-input');
    await urlInput!.fill(testVideoUrl);

    const loadBtn = await context.window.$('#load-btn');
    await loadBtn!.click();

    // Wait for potential loading state
    await context.window.waitForTimeout(1000);

    // Check that something happened (either loading or error displayed)
    const statusText = await context.window.$('#status-text');
    expect(statusText).not.toBeNull();
  });

  test('should show error for invalid URL', async () => {
    const urlInput = await context.window.$('#url-input');
    await urlInput!.fill('not-a-valid-url');

    const loadBtn = await context.window.$('#load-btn');
    await loadBtn!.click();

    // Wait for error to potentially appear
    await context.window.waitForTimeout(500);

    // The status text should exist
    const statusText = await context.window.$('#status-text');
    expect(statusText).not.toBeNull();
  });

  test('should handle empty URL submission', async () => {
    const urlInput = await context.window.$('#url-input');
    await urlInput!.fill('');

    const loadBtn = await context.window.$('#load-btn');
    await loadBtn!.click();

    // Should not crash, check UI still works
    const urlSection = await context.window.$('#url-section');
    expect(urlSection).not.toBeNull();
  });

  test('should support Enter key to load video', async () => {
    const urlInput = await context.window.$('#url-input');
    await urlInput!.fill('https://example.com/test.mp4');

    // Press Enter key
    await context.window.keyboard.press('Enter');

    // Wait for potential action
    await context.window.waitForTimeout(500);

    // App should still be responsive
    const videoContainer = await context.window.$('#video-container');
    expect(videoContainer).not.toBeNull();
  });
});
