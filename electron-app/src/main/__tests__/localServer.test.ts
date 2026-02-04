import * as http from 'http';
import { LocalServer } from '../localServer';
import { HTTP_PORT } from '../../shared/types';

// Mock Electron's BrowserWindow
const mockWebContentsSend = jest.fn();
const mockShow = jest.fn();
const mockFocus = jest.fn();

const mockBrowserWindow = {
  webContents: {
    send: mockWebContentsSend
  },
  show: mockShow,
  focus: mockFocus
} as any;

describe('LocalServer', () => {
  let server: LocalServer;
  const baseUrl = `http://127.0.0.1:${HTTP_PORT}`;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new LocalServer(mockBrowserWindow);
  });

  afterEach((done) => {
    server.stop();
    // Give time for server to fully close
    setTimeout(done, 100);
  });

  describe('start', () => {
    it('should start server on port 9527', (done) => {
      server.start();

      setTimeout(async () => {
        try {
          const response = await fetch(`${baseUrl}/ping`);
          expect(response.ok).toBe(true);
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    });
  });

  describe('GET /ping', () => {
    beforeEach((done) => {
      server.start();
      setTimeout(done, 100);
    });

    it('should return status ok', async () => {
      const response = await fetch(`${baseUrl}/ping`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
    });

    it('should include CORS headers', async () => {
      const response = await fetch(`${baseUrl}/ping`);

      // Without an extension origin header, CORS returns 'null'
      expect(response.headers.get('access-control-allow-origin')).toBe('null');
    });

    it('should allow chrome extension origins', async () => {
      const response = await fetch(`${baseUrl}/ping`, {
        headers: { 'Origin': 'chrome-extension://abcdefghijklmnop' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('chrome-extension://abcdefghijklmnop');
    });
  });

  describe('POST /send-url', () => {
    beforeEach((done) => {
      server.start();
      setTimeout(done, 100);
    });

    it('should accept valid URL and send to renderer', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/video', title: 'Test Video' })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockWebContentsSend).toHaveBeenCalledWith('play-url', 'https://example.com/video', 'Test Video');
      expect(mockShow).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should use default title when not provided', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/video' })
      });

      expect(response.status).toBe(200);
      expect(mockWebContentsSend).toHaveBeenCalledWith('play-url', 'https://example.com/video', 'External Video');
    });

    it('should return 400 when URL is missing', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No URL' })
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('URL must be a non-empty string');
    });

    it('should return 400 for non-HTTP URLs', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'file:///etc/passwd', title: 'Malicious' })
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Only HTTP/HTTPS URLs are allowed');
    });

    it('should return 400 for invalid JSON', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json'
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
    });
  });

  describe('OPTIONS (CORS preflight)', () => {
    beforeEach((done) => {
      server.start();
      setTimeout(done, 100);
    });

    it('should respond to OPTIONS requests', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });
  });

  describe('404 handling', () => {
    beforeEach((done) => {
      server.start();
      setTimeout(done, 100);
    });

    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });
  });

  describe('stop', () => {
    it('should stop the server', (done) => {
      server.start();

      setTimeout(() => {
        server.stop();

        setTimeout(async () => {
          try {
            await fetch(`${baseUrl}/ping`);
            done(new Error('Server should be stopped'));
          } catch {
            // Expected - connection refused
            done();
          }
        }, 100);
      }, 100);
    });
  });
});
