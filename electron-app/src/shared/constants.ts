export const CACHE_DURATION_MS = 30 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 5000;
export const YTDLP_TIMEOUT_MS = 30000;
export const HTTP_PORT = 9527;
export const MAX_BODY_SIZE = 10240;

// Shared handshake for the extension <-> app local HTTP channel.
// This is a basic barrier against casual local processes hitting the
// server, NOT a strong secret: the extension ships its source publicly,
// so a determined local process can read this value. Real protection
// comes from binding to 127.0.0.1 plus the Origin/content-type checks.
// The same value is duplicated in browser-extension/src/popup/popup.js.
export const EXTENSION_TOKEN = 'mp_2f9c1e7a8b4d4f60a1c3e5d7b9f02468';
export const EXTENSION_TOKEN_HEADER = 'x-miniplayer-token';
