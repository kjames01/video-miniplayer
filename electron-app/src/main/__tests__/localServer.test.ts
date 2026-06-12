import * as http from 'http';
import { LocalServer } from '../localServer';
import { HTTP_PORT } from '../../shared/types';
import { EXTENSION_TOKEN } from '../../shared/constants';

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

    it('should not include CORS header for non-extension origins', async () => {
      const response = await fetch(`${baseUrl}/ping`);

      // Without a recognized origin, no CORS header is set
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('should include CORS header for localhost origins', async () => {
      const response = await fetch(`${baseUrl}/ping`, {
        headers: { 'Origin': 'http://localhost:3000' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
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

    it('should return 403 when the handshake token is missing', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/video', title: 'Test Video' })
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it('should return 403 when the handshake token is wrong', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': 'wrong-token' },
        body: JSON.stringify({ url: 'https://example.com/video', title: 'Test Video' })
      });

      expect(response.status).toBe(403);
      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it('should accept valid URL and send to renderer', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': EXTENSION_TOKEN },
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
        headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': EXTENSION_TOKEN },
        body: JSON.stringify({ url: 'https://example.com/video' })
      });

      expect(response.status).toBe(200);
      expect(mockWebContentsSend).toHaveBeenCalledWith('play-url', 'https://example.com/video', 'External Video');
    });

    it('should return 400 when URL is missing', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': EXTENSION_TOKEN },
        body: JSON.stringify({ title: 'No URL' })
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('URL must be a non-empty string');
    });

    it('should return 400 for non-HTTP URLs', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': EXTENSION_TOKEN },
        body: JSON.stringify({ url: 'file:///etc/passwd', title: 'Malicious' })
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Only HTTP/HTTPS URLs are allowed');
    });

    it('should return 400 for invalid JSON', async () => {
      const response = await fetch(`${baseUrl}/send-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': EXTENSION_TOKEN },
        body: 'not valid json'
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
    });

    it('should not play a video when the request body exceeds the size limit', async () => {
      const oversized = 'x'.repeat(11000); // > MAX_BODY_SIZE (10240)
      try {
        await fetch(`${baseUrl}/send-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Miniplayer-Token': EXTENSION_TOKEN },
          body: JSON.stringify({ url: 'https://example.com/v', title: oversized })
        });
      } catch {
        // The server destroys the connection after exceeding the limit, which
        // can surface as a fetch network error. Either way, no video plays.
      }

      expect(mockWebContentsSend).not.toHaveBeenCalled();
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

  describe('port in use', () => {
    it('notifies the renderer when the port is already taken', (done) => {
      server.start();

      setTimeout(() => {
        const second = new LocalServer(mockBrowserWindow);
        second.start();

        setTimeout(() => {
          expect(mockWebContentsSend).toHaveBeenCalledWith(
            'extraction-error',
            expect.stringContaining('already in use')
          );
          second.stop();
          done();
        }, 250);
      }, 100);
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
