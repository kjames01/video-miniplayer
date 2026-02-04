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

  constructor() {
    this.videoPlayer = new VideoPlayer();
    this.controls = new Controls(this.videoPlayer);
    this.titleBar = new TitleBar();
    this.urlInput = new UrlInput(this.videoPlayer);

    // Initialize chat
    this.chatStore = new ChatStore();
    this.chatPanel = new ChatPanel(this.chatStore);

    this.setupIpcListeners();
    this.setupChatToggle();
  }

  private setupIpcListeners(): void {
    // Listen for URLs sent from extension via main process
    window.electronAPI.onPlayUrl((url: string, title: string) => {
      this.urlInput.setUrl(url);
      this.urlInput.loadVideo();
    });

    // Listen for video ready events
    window.electronAPI.onVideoReady((url: string, title: string) => {
      this.videoPlayer.loadVideo(url);
      this.titleBar.setTitle(title);
    });

    // Listen for extraction errors
    window.electronAPI.onExtractionError((error: string) => {
      this.urlInput.showError(error);
    });
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
