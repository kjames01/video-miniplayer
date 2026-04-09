export const WINDOW_REFRESH_INTERVAL_MS = 3000;
export const WINDOW_TITLE_MAX_LENGTH = 100;

export const RESIZE_PRESETS = [
  { label: '640 x 480', width: 640, height: 480 },
  { label: '800 x 600', width: 800, height: 600 },
  { label: '1024 x 768', width: 1024, height: 768 },
  { label: '1280 x 720 (HD)', width: 1280, height: 720 },
  { label: '1920 x 1080 (FHD)', width: 1920, height: 1080 },
] as const;

export const MIN_RESIZE_WIDTH = 100;
export const MIN_RESIZE_HEIGHT = 50;
export const MAX_RESIZE_WIDTH = 7680;
export const MAX_RESIZE_HEIGHT = 4320;
