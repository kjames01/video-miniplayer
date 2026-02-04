import { VideoPlayer } from './VideoPlayer';

export class Controls {
  private player: VideoPlayer;
  private playPauseBtn: HTMLButtonElement;
  private progressBar: HTMLElement;
  private progressFilled: HTMLElement;
  private timeDisplay: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private volumeSlider: HTMLInputElement;

  constructor(player: VideoPlayer) {
    this.player = player;

    this.playPauseBtn = document.getElementById('play-pause-btn') as HTMLButtonElement;
    this.progressBar = document.getElementById('progress-bar') as HTMLElement;
    this.progressFilled = document.getElementById('progress-filled') as HTMLElement;
    this.timeDisplay = document.getElementById('time-display') as HTMLElement;
    this.muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;
    this.volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const video = this.player.getVideoElement();

    // Play/Pause button
    this.playPauseBtn.addEventListener('click', () => {
      this.player.togglePlayPause();
    });

    // Update play/pause button state
    video.addEventListener('play', () => {
      this.playPauseBtn.textContent = '⏸';
    });

    video.addEventListener('pause', () => {
      this.playPauseBtn.textContent = '▶';
    });

    // Progress bar update
    video.addEventListener('timeupdate', () => {
      this.updateProgress();
      this.updateTimeDisplay();
    });

    video.addEventListener('loadedmetadata', () => {
      this.updateTimeDisplay();
    });

    // Progress bar click to seek
    this.progressBar.addEventListener('click', (e) => {
      const rect = this.progressBar.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      this.player.seekPercent(percent);
    });

    // Volume controls
    this.muteBtn.addEventListener('click', () => {
      this.player.toggleMute();
      this.updateMuteButton();
    });

    this.volumeSlider.addEventListener('input', () => {
      const volume = parseInt(this.volumeSlider.value) / 100;
      this.player.setVolume(volume);
      this.updateMuteButton();
    });

    video.addEventListener('volumechange', () => {
      this.volumeSlider.value = String(this.player.getVolume() * 100);
      this.updateMuteButton();
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          this.player.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.player.seek(this.player.getCurrentTime() - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.player.seek(this.player.getCurrentTime() + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.player.setVolume(this.player.getVolume() + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.player.setVolume(this.player.getVolume() - 0.1);
          break;
        case 'm':
          e.preventDefault();
          this.player.toggleMute();
          this.updateMuteButton();
          break;
      }
    });

    // Double-click to toggle play/pause
    video.addEventListener('dblclick', () => {
      this.player.togglePlayPause();
    });

    // Single-click to toggle play/pause
    video.addEventListener('click', () => {
      this.player.togglePlayPause();
    });
  }

  private updateProgress(): void {
    const progress = this.player.getProgress();
    this.progressFilled.style.width = `${progress}%`;
  }

  private updateTimeDisplay(): void {
    const current = this.formatTime(this.player.getCurrentTime());
    const duration = this.formatTime(this.player.getDuration());
    this.timeDisplay.textContent = `${current} / ${duration}`;
  }

  private updateMuteButton(): void {
    if (this.player.isMuted() || this.player.getVolume() === 0) {
      this.muteBtn.textContent = '🔇';
    } else if (this.player.getVolume() < 0.5) {
      this.muteBtn.textContent = '🔉';
    } else {
      this.muteBtn.textContent = '🔊';
    }
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
