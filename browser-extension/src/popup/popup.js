const APP_URL = 'http://127.0.0.1:9527';

// Security constants
const PING_TIMEOUT_MS = 2000;
const SEND_TIMEOUT_MS = 5000;
const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 200;
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validates a URL for security
 */
function validateUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL too long' };
  }

  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are supported' };
    }
    return { valid: true, sanitized: parsedUrl.href };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitizes title to prevent issues
 */
function sanitizeTitle(title) {
  if (typeof title !== 'string') {
    return 'Untitled';
  }
  return title.substring(0, MAX_TITLE_LENGTH).trim() || 'Untitled';
}

async function isAppRunning() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const response = await fetch(`${APP_URL}/ping`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

async function sendUrl(url, title) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    const response = await fetch(`${APP_URL}/send-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const sendBtn = document.getElementById('send-btn');
  const errorEl = document.getElementById('error');

  statusEl.textContent = 'Checking connection...';
  statusEl.className = 'status checking';

  const appRunning = await isAppRunning();

  if (appRunning) {
    statusEl.textContent = 'Miniplayer is running';
    statusEl.className = 'status connected';
  } else {
    statusEl.textContent = 'Miniplayer not running';
    statusEl.className = 'status disconnected';
    sendBtn.disabled = true;
  }

  sendBtn.addEventListener('click', async () => {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    errorEl.classList.add('hidden');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        throw new Error('No URL found');
      }

      // Validate URL before sending
      const validation = validateUrl(tab.url);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Sanitize title
      const sanitizedTitle = sanitizeTitle(tab.title);

      const success = await sendUrl(validation.sanitized, sanitizedTitle);

      if (success) {
        sendBtn.textContent = 'Sent!';
        setTimeout(() => window.close(), 800);
      } else {
        throw new Error('Failed to send URL');
      }
    } catch (err) {
      // Sanitize error message for display
      const errorMessage = String(err.message || 'Unknown error').substring(0, 100);
      errorEl.textContent = errorMessage;
      errorEl.classList.remove('hidden');
      sendBtn.textContent = 'Send to Miniplayer';
      sendBtn.disabled = false;
    }
  });
});
