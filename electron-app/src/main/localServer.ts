import * as http from 'http';
import { BrowserWindow } from 'electron';
import { HTTP_ENDPOINTS, IPC_CHANNELS } from '../shared/types';
import { HTTP_PORT, MAX_BODY_SIZE, REQUEST_TIMEOUT_MS } from '../shared/constants';

// Security constants
const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 200;
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validates a URL for security
 */
function validateUrl(url: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL exceeds maximum length' };
  }

  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }
    // Return the parsed URL href for safety (normalized)
    return { valid: true, sanitized: parsedUrl.href };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitizes title to prevent XSS
 */
function sanitizeTitle(title: unknown): string {
  if (typeof title !== 'string') {
    return 'External Video';
  }
  // Remove HTML-like characters and limit length
  return title
    .replace(/[<>]/g, '')
    .substring(0, MAX_TITLE_LENGTH)
    .trim() || 'External Video';
}

export class LocalServer {
  private server: http.Server | null = null;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  start(): void {
    this.server = http.createServer((req, res) => {
      // Set request timeout to prevent slowloris attacks
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy();
      });

      // Enable CORS for browser extensions only
      const origin = req.headers.origin || '';
      if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || '';

      if (req.method === 'GET' && url === HTTP_ENDPOINTS.PING) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (req.method === 'POST' && url === HTTP_ENDPOINTS.SEND_URL) {
        let body = '';
        let destroyed = false;

        req.on('data', (chunk) => {
          const chunkStr = chunk.toString();

          // Prevent memory exhaustion - check before appending
          if (body.length + chunkStr.length > MAX_BODY_SIZE) {
            destroyed = true;
            req.destroy();
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body too large' }));
            return;
          }

          body += chunkStr;
        });

        req.on('end', () => {
          if (destroyed) return;

          try {
            const data = JSON.parse(body);
            const { url: videoUrl, title } = data;

            // Validate URL
            const validation = validateUrl(videoUrl);
            if (!validation.valid) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: validation.error }));
              return;
            }

            // Sanitize title to prevent XSS
            const sanitizedTitle = sanitizeTitle(title);

            // Send to renderer to play
            this.mainWindow.webContents.send(IPC_CHANNELS.PLAY_URL, validation.sanitized, sanitizedTitle);
            this.mainWindow.show();
            this.mainWindow.focus();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.server.listen(HTTP_PORT, '127.0.0.1', () => {
      console.log(`[LocalServer] Listening on ${HTTP_PORT}`);
    });

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[LocalServer] Port ${HTTP_PORT} is already in use. Another instance may be running.`);
        // Surface to renderer so user knows the server failed
        this.mainWindow.webContents.send(IPC_CHANNELS.EXTRACTION_ERROR, `Port ${HTTP_PORT} is already in use`);
      } else {
        console.error('[LocalServer] Server error:', err);
      }
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
