// Renderer process - main entry point
import { VideoPlayer } from './components/VideoPlayer';
import { Controls } from './components/Controls';
import { TitleBar } from './components/TitleBar';
import { UrlInput } from './components/UrlInput';
import { ChatPanel } from './components/ChatPanel';
import { ChatStore } from './stores/ChatStore';

class App {
  private videoPlayer: VideoPlayer;
  private controls: Controls;
  private titleBar: TitleBar;
  private urlInput: UrlInput;
  private chatStore: ChatStore;
  private chatPanel: ChatPanel;
  private ipcCleanups: Array<() => void> = [];

  constructor() {
    this.videoPlayer = new VideoPlayer();
    this.controls = new Controls(this.videoPlayer);
    this.titleBar = new TitleBar();
    this.urlInput = new UrlInput(this.videoPlayer, (title: string) => {
      this.titleBar.setTitle(title);
    });

    // Initialize chat
    this.chatStore = new ChatStore();
    this.chatPanel = new ChatPanel(this.chatStore);

    this.setupIpcListeners();
    this.setupChatToggle();
  }

  private setupIpcListeners(): void {
    // Listen for URLs sent from extension via main process
    const cleanupPlayUrl = window.electronAPI.onPlayUrl((url: string, title: string) => {
      this.urlInput.setUrl(url);
      this.urlInput.loadVideo();
    });
    if (cleanupPlayUrl) this.ipcCleanups.push(cleanupPlayUrl);

    // Listen for video ready events
    const cleanupVideoReady = window.electronAPI.onVideoReady((url: string, title: string) => {
      this.videoPlayer.loadVideo(url);
      this.titleBar.setTitle(title);
    });
    if (cleanupVideoReady) this.ipcCleanups.push(cleanupVideoReady);

    // Listen for extraction errors
    const cleanupExtractionError = window.electronAPI.onExtractionError((error: string) => {
      this.urlInput.showError(error);
    });
    if (cleanupExtractionError) this.ipcCleanups.push(cleanupExtractionError);
  }

  destroy(): void {
    for (const cleanup of this.ipcCleanups) {
      cleanup();
    }
    this.ipcCleanups = [];
    this.chatStore.destroy();
    this.controls.destroy();
  }

  private setupChatToggle(): void {
    // Set up chat toggle callback
    this.titleBar.setChatToggleCallback(() => {
      this.chatPanel.toggle();
      this.titleBar.setChatActive(this.chatPanel.getIsVisible());
    });

    // Hook into video loading to load transcript
    this.videoPlayer.onVideoLoad(() => {
      this.chatPanel.onVideoLoaded();
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
