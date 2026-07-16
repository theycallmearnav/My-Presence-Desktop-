export type ButtonConfig = {
  id: string;
  label: string;
  url: string;
};

export type ImageFit = 'fill' | 'fit';

export type PresenceAssets = {
  largeImage: string;
  largeText: string;
  smallImage: string;
  smallText: string;
  // How the artwork sits inside Discord's square in our preview: 'fill' scales
  // to cover and center-crops (Discord's own behaviour); 'fit' shows the whole
  // image. Optional so profiles saved before this feature still load.
  largeFit?: ImageFit;
  smallFit?: ImageFit;
};

// How the Step 5 timer decides what "start"/"end" to show. Automatic modes are
// resolved to a concrete epoch at publish/preview time (see lib/timestamps.ts);
// only 'custom' uses the start/end fields below.
export type TimestampMode =
  | 'none'
  | 'sinceConnection'
  | 'sinceUpdate'
  | 'sinceAppStart'
  | 'localTime'
  | 'custom';

export type PresenceTimestamps = {
  // Optional so profiles saved before timestamp modes existed still load; a
  // missing mode is inferred from start/end by effectiveTimestampMode().
  mode?: TimestampMode;
  start?: string;
  end?: string;
  // Whether the End picker is active in 'custom' mode.
  endEnabled?: boolean;
};

export type PresenceParty = {
  id: string;
  currentSize: number;
  maxSize: number;
};

export type PresenceSecrets = {
  join: string;
  spectate: string;
  match: string;
};

export type ActivityType = 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';

export type PresenceProfile = {
  id: string;
  name: string;
  favorite: boolean;
  details: string;
  state: string;
  applicationId: string;
  activityType: ActivityType;
  instance: boolean;
  status: 'idle' | 'live';
  buttonsEnabled: boolean;
  buttons: ButtonConfig[];
  assets: PresenceAssets;
  timestamps: PresenceTimestamps;
  party: PresenceParty;
  secrets: PresenceSecrets;
  notes: string;
  updatedAt: string;
};

export type AssetItem = {
  id: string;
  name: string;
  kind: 'large' | 'small' | 'library';
  accent: string;
  updatedAt: string;
};

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type BackgroundType =
  | 'solid'
  | 'gradient'
  | 'image'
  | 'video'
  | 'video-url'
  | 'animated';

export type VideoFit = 'fill' | 'fit' | 'blur';

export type Theme = {
  id: string;
  name: string;
  backgroundType: BackgroundType;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  imageUrl: string;
  videoUrl: string;
  accentColor: string;
  blurAmount: number;
  brightness: number;
  opacity: number;
  noiseOverlay: boolean;
  glassStrength: number;
  cornerRadius: number;
  // Video-specific
  videoFit: VideoFit;
  overlayColor: string;
  overlayOpacity: number;
  muted: boolean;
  volume: number;
  playbackSpeed: number;
  loop: boolean;
  // Scope
  scope: 'editor' | 'preview' | 'app';
  sortOrder: number;
};

export type AppSettings = {
  appearance: 'system' | 'dark' | 'light' | 'oled';
  launchOnStartup: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  restorePreviousSession: boolean;
  autoReconnect: boolean;
  reduceMotion: boolean;
  notifications: boolean;
  autoUpdates: boolean;
  videoPauseWhenHidden: boolean;
  hardwareAcceleration: boolean;
  activeThemeId: string | null;
  backgroundSource: string;
  onboardingComplete: boolean;
};