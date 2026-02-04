import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, ElectronAppContext } from './electron-app';
import { HTTP_PORT } from '../../src/shared/types';

let context: ElectronAppContext;
const baseUrl = `http://127.0.0.1:${HTTP_PORT}`;

test.describe('HTTP Server Extension API', () => {
  test.beforeAll(async () => {
    context = await launchElectronApp();
    // Wait for server to start
    await context.window.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    if (context) {
      await closeElectronApp(context);
    }
  });

  test('should respond to GET /ping', async () => {
    const response = await fetch(`${baseUrl}/ping`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  test('should return CORS headers for chrome extension origins', async () => {
    const response = await fetch(`${baseUrl}/ping`, {
      headers: {
        'Origin': 'chrome-extension://abcdefghijklmnop'
      }
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('chrome-extension://abcdefghijklmnop');
  });

  test('should accept POST /send-url with valid data', async () => {
    const response = await fetch(`${baseUrl}/send-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com/video.mp4',
        title: 'Test Video'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test('should show window when receiving URL from extension', async () => {
    // Hide the window first
    await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows[0]) {
        windows[0].hide();
      }
    });

    await context.window.waitForTimeout(200);

    // Send URL via HTTP
    await fetch(`${baseUrl}/send-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com/test-video.mp4',
        title: 'Extension Test'
      })
    });

    await context.window.waitForTimeout(300);

    // Window should be visible now
    const isVisible = await context.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.isVisible() ?? false;
    });

    expect(isVisible).toBe(true);
  });

  test('should reject POST /send-url without URL', async () => {
    const response = await fetch(`${baseUrl}/send-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'No URL'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('URL must be a non-empty string');
  });

  test('should reject non-HTTP URLs', async () => {
    const response = await fetch(`${baseUrl}/send-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'file:///etc/passwd',
        title: 'Malicious'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Only HTTP/HTTPS URLs are allowed');
  });

  test('should reject invalid JSON', async () => {
    const response = await fetch(`${baseUrl}/send-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'not valid json'
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON');
  });

  test('should handle OPTIONS preflight requests', async () => {
    const response = await fetch(`${baseUrl}/send-url`, {
      method: 'OPTIONS'
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test('should return 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/unknown-route`);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  test('should use default title when not provided', async () => {
    const response = await fetch(`${baseUrl}/send-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com/video-no-title.mp4'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
