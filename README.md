# Video Miniplayer

A floating video miniplayer for Windows built with Electron. Extract and play videos from thousands of websites in an always-on-top frameless window. Includes a browser extension for one-click video sending.

## Features

- **Always-on-Top Window** - Watch videos while working in other applications
- **Frameless Design** - Clean, minimal dark-themed interface
- **Wide Site Support** - Works with YouTube, Vimeo, Twitter, Reddit, Twitch, and [thousands more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- **Browser Extension** - Send videos to the miniplayer with one click
- **System Tray** - Minimize to tray, quick access menu
- **AI Chat** - Chat about video content using Google Gemini integration
- **Transcript Extraction** - Extract and view video transcripts

## Prerequisites

- **Node.js** 18+ and npm
- **Windows** (currently Windows-only due to bundled yt-dlp.exe)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd miniplayer-project
   ```

2. Install dependencies:
   ```bash
   cd electron-app
   npm install
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Usage

### Desktop App

1. Launch the app with `npm run dev` from the `electron-app/` directory
2. Paste a video URL into the input field and press Enter
3. The video will load and play in the miniplayer

**Window Controls:**
- Drag the title bar to move the window
- Use minimize/close buttons in the title bar
- Close button hides to system tray (right-click tray icon to quit)

### Browser Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `browser-extension/` folder
4. Click the extension icon on any page with a video to send it to the miniplayer

The extension communicates with the desktop app via HTTP on `127.0.0.1:9527`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  - WindowManager: Frameless always-on-top window            │
│  - TrayManager: System tray with context menu               │
│  - LocalServer: HTTP server on 127.0.0.1:9527               │
│  - YtdlpManager: Video URL extraction via yt-dlp            │
│  - UrlCache: 30-minute cache for extracted URLs             │
└─────────────────────────────────────────────────────────────┘
                          │ IPC
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload Script                            │
│  Secure bridge exposing window.electronAPI to renderer      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Renderer Process                           │
│  VideoPlayer, Controls, TitleBar, UrlInput, ChatPanel       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Browser Extension                           │
│  Sends URLs via HTTP POST to LocalServer                    │
└─────────────────────────────────────────────────────────────┘
```

## Development

All commands run from `electron-app/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Compile TypeScript + copy assets + launch Electron |
| `npm run compile` | TypeScript compile + bundle + copy assets |
| `npm run watch` | TypeScript watch mode for development |
| `npm start` | Launch Electron from compiled dist |
| `npm test` | Run Jest unit tests |
| `npm test -- --coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:all` | Run all tests |

### Project Structure

```
miniplayer-project/
├── electron-app/
│   ├── src/
│   │   ├── main/          # Main process (window, tray, server, yt-dlp)
│   │   ├── preload/       # IPC bridge script
│   │   ├── renderer/      # UI components and styles
│   │   └── shared/        # Shared types and constants
│   ├── resources/         # Icons and binaries (yt-dlp.exe)
│   ├── dist/              # Compiled output
│   └── release/           # Production builds
└── browser-extension/
    ├── manifest.json      # Chrome Manifest v3
    └── src/popup/         # Extension popup UI
```

## Building for Production

Build a Windows installer:

```bash
cd electron-app
npm run build
```

The installer will be created in `electron-app/release/`.

## Supported Sites

The miniplayer uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) for video extraction, supporting thousands of sites including:

- YouTube
- Vimeo
- Twitter/X
- Reddit
- Twitch
- Instagram
- TikTok
- Facebook
- And [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

## Configuration

### Gemini API (Optional)

To enable AI chat features, add your Google Gemini API key in the app settings.

## Security

- Context isolation between renderer and main processes
- URL validation and sanitization
- CORS restrictions for extension communication
- Shell injection prevention for yt-dlp commands

## License

MIT
