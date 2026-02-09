export type VideoLoadCallback = () => void;

export class VideoPlayer {
  private video: HTMLVideoElement;
  private placeholder: HTMLElement;
  private loadingOverlay: HTMLElement;
  private videoContainer: HTMLElement;
  private videoLoadCallbacks: VideoLoadCallback[] = [];

  constructor() {
    const video = document.getElementById('video-player');
    if (!video) throw new Error('Missing required element: #video-player');
    this.video = video as HTMLVideoElement;

    const placeholder = document.getElementById('placeholder');
    if (!placeholder) throw new Error('Missing required element: #placeholder');
    this.placeholder = placeholder;

    const loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) throw new Error('Missing required element: #loading-overlay');
    this.loadingOverlay = loadingOverlay;

    const videoContainer = document.getElementById('video-container');
    if (!videoContainer) throw new Error('Missing required element: #video-container');
    this.videoContainer = videoContainer;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Handle video loading events
    this.video.addEventListener('loadstart', () => {
      this.showLoading();
    });

    this.video.addEventListener('canplay', () => {
      this.hideLoading();
      this.hidePlaceholder();
    });

    this.video.addEventListener('error', (e) => {
      this.hideLoading();
      console.error('Video error:', this.video.error);
    });

    // Auto-hide controls after inactivity
    let controlsTimeout: ReturnType<typeof setTimeout>;
    this.videoContainer.addEventListener('mousemove', () => {
      this.videoContainer.classList.add('show-controls');
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        if (!this.video.paused) {
          this.videoContainer.classList.remove('show-controls');
        }
      }, 2500);
    });

    this.videoContainer.addEventListener('mouseleave', () => {
      if (!this.video.paused) {
        this.videoContainer.classList.remove('show-controls');
      }
    });
  }

  loadVideo(url: string): void {
    this.video.src = url;
    this.video.load();
    this.video.play().catch(err => {
      console.error('Autoplay failed:', err);
    });

    // Notify listeners that a video was loaded
    for (const callback of this.videoLoadCallbacks) {
      callback();
    }
  }

  /**
   * Register a callback to be called when a video is loaded.
   * Returns an unsubscribe function.
   */
  onVideoLoad(callback: VideoLoadCallback): () => void {
    this.videoLoadCallbacks.push(callback);
    return () => {
      const index = this.videoLoadCallbacks.indexOf(callback);
      if (index !== -1) {
        this.videoLoadCallbacks.splice(index, 1);
      }
    };
  }

  play(): void {
    this.video.play();
  }

  pause(): void {
    this.video.pause();
  }

  togglePlayPause(): void {
    if (this.video.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  isPaused(): boolean {
    return this.video.paused;
  }

  seek(time: number): void {
    this.video.currentTime = time;
  }

  seekPercent(percent: number): void {
    if (this.video.duration) {
      this.video.currentTime = (percent / 100) * this.video.duration;
    }
  }

  getCurrentTime(): number {
    return this.video.currentTime;
  }

  getDuration(): number {
    return this.video.duration || 0;
  }

  getProgress(): number {
    if (!this.video.duration) return 0;
    return (this.video.currentTime / this.video.duration) * 100;
  }

  setVolume(volume: number): void {
    this.video.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.video.volume;
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
  }

  isMuted(): boolean {
    return this.video.muted;
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  private showLoading(): void {
    this.loadingOverlay.classList.remove('hidden');
  }

  private hideLoading(): void {
    this.loadingOverlay.classList.add('hidden');
  }

  private hidePlaceholder(): void {
    this.placeholder.classList.add('hidden');
  }

  showPlaceholder(): void {
    this.placeholder.classList.remove('hidden');
  }
}
