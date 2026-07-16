import type { ActivityType, ConnectionStatus, PresenceProfile } from '../lib/types';
import { validateUrl } from '../lib/utils';
import { BUNDLED_APPLICATION_ID, hasBundledApplicationId } from '../lib/config';
import { APP_START_MS, resolveTimestamps, type TimestampContext } from '../lib/timestamps';
import { persistence } from './persistence';

export type DiscordServiceState = {
  status: ConnectionStatus;
  message: string;
  activeProfileId?: string;
};

type Listener = (state: DiscordServiceState) => void;

// Shape of the activity object sent to Discord (matches electron/discordRpc.ts).
type DiscordActivity = {
  type?: number;
  details?: string;
  state?: string;
  timestamps?: { start?: number; end?: number };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
  party?: { id?: string; size?: [number, number] };
  instance?: boolean;
};

const ACTIVITY_TYPE_MAP: Record<ActivityType, number> = {
  Playing: 0,
  Streaming: 1,
  Listening: 2,
  Watching: 3,
  Competing: 5
};

// Discord's RPC SET_ACTIVITY only accepts these activity types. "Streaming" (1)
// is NOT allowed here (it needs a special stream-URL flow), so anything outside
// this set falls back to Playing (0).
const RPC_ALLOWED_TYPES = [0, 2, 3, 5];

export function mapProfileToActivity(
  profile: PresenceProfile,
  ctx: TimestampContext = { now: Date.now(), appStartMs: APP_START_MS }
): DiscordActivity {
  const mappedType = ACTIVITY_TYPE_MAP[profile.activityType] ?? 0;
  const activity: DiscordActivity = {
    type: RPC_ALLOWED_TYPES.includes(mappedType) ? mappedType : 0
  };

  if (profile.details.trim()) activity.details = profile.details.trim();
  if (profile.state.trim()) activity.state = profile.state.trim();

  const { start, end } = resolveTimestamps(profile.timestamps, ctx);
  if (start || end) {
    activity.timestamps = {};
    if (start) activity.timestamps.start = start;
    if (end) activity.timestamps.end = end;
  }

  const assets: DiscordActivity['assets'] = {};
  if (profile.assets.largeImage.trim()) assets.large_image = profile.assets.largeImage.trim();
  if (profile.assets.largeText.trim()) assets.large_text = profile.assets.largeText.trim();
  if (profile.assets.smallImage.trim()) assets.small_image = profile.assets.smallImage.trim();
  if (profile.assets.smallText.trim()) assets.small_text = profile.assets.smallText.trim();
  if (Object.keys(assets).length) activity.assets = assets;

  // Respect the Step 4 "Show buttons" toggle. Older saved profiles predate the
  // flag, so treat a missing value as "on".
  const buttonsEnabled = profile.buttonsEnabled !== false;
  const buttons = buttonsEnabled
    ? profile.buttons
        .filter((button) => button.label.trim() && button.url.trim() && !validateUrl(button.url))
        .slice(0, 2)
        .map((button) => ({ label: button.label.trim(), url: button.url.trim() }))
    : [];
  if (buttons.length) activity.buttons = buttons;

  if (profile.party.id.trim()) {
    activity.party = {
      id: profile.party.id.trim(),
      size: [profile.party.currentSize, profile.party.maxSize]
    };
  }

  if (profile.instance) activity.instance = true;

  return activity;
}

export class DiscordPresenceService {
  private state: DiscordServiceState = {
    status: 'disconnected',
    message: 'Not connected — go live to link Discord'
  };

  private listeners = new Set<Listener>();
  private lastApplicationId = '';
  private statusUnsubscribe: (() => void) | null = null;
  // Runtime moments powering the automatic timestamp modes.
  private connectionMs?: number;
  private lastUpdateMs?: number;

  private timestampContext(): TimestampContext {
    return {
      now: Date.now(),
      appStartMs: APP_START_MS,
      connectionMs: this.connectionMs,
      lastUpdateMs: this.lastUpdateMs
    };
  }

  constructor() {
    this.bindBridgeStatus();
  }

  private get bridge() {
    return typeof window !== 'undefined' ? window.myPresenceDesktop : undefined;
  }

  private bindBridgeStatus() {
    const bridge = this.bridge;
    if (!bridge?.onStatus || this.statusUnsubscribe) return;
    this.statusUnsubscribe = bridge.onStatus((payload) => {
      this.setState({
        status: payload.status,
        message: payload.message,
        activeProfileId: this.state.activeProfileId
      });
    });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(profile: PresenceProfile) {
    const bridge = this.bridge;
    if (!bridge?.connect) {
      this.setState({
        status: 'error',
        message: 'Discord bridge unavailable. Run the desktop app (npm run dev), not a browser tab.',
        activeProfileId: profile.id
      });
      return;
    }

    // Users never provide an application ID — the app ALWAYS uses the one baked
    // into config.ts. (We intentionally ignore any legacy profile.applicationId
    // that may still be sitting in saved/seed data from older builds.)
    const applicationId = BUNDLED_APPLICATION_ID.trim();
    if (!hasBundledApplicationId()) {
      this.setState({
        status: 'error',
        message: 'This build has no Discord application linked yet. Set BUNDLED_APPLICATION_ID in src/lib/config.ts.',
        activeProfileId: profile.id
      });
      return;
    }

    this.lastApplicationId = applicationId;
    this.setState({
      status: 'connecting',
      message: `Connecting ${profile.name}…`,
      activeProfileId: profile.id
    });

    try {
      const alreadyConnected = this.state.status === 'connected';
      await bridge.connect(applicationId);
      // Reset the "since I went live" anchor only on a fresh connection, not on
      // every re-push from an edit while already live.
      if (!alreadyConnected || this.connectionMs === undefined) {
        this.connectionMs = Date.now();
      }
      this.lastUpdateMs = Date.now();
      await bridge.setActivity(mapProfileToActivity(profile, this.timestampContext()));
      // Remember this as the live profile so a background/login startup can
      // auto-resume it without the user opening the window.
      persistence.saveLiveState({ isLive: true, profileId: profile.id });
      this.setState({
        status: 'connected',
        message: `Live with ${profile.name}`,
        activeProfileId: profile.id
      });
    } catch (error) {
      this.setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to publish presence to Discord.',
        activeProfileId: profile.id
      });
    }
  }

  async stop() {
    const bridge = this.bridge;
    try {
      await bridge?.clear?.();
    } catch {
      // ignore — clearing is best-effort
    }
    // Next Go Live is a fresh session for the "since I went live" timer.
    this.connectionMs = undefined;
    this.lastUpdateMs = undefined;
    // Stopping means the app should NOT auto-resume presence next launch.
    persistence.saveLiveState({ isLive: false, profileId: '' });
    this.setState({
      status: 'disconnected',
      message: 'Activity cleared from Discord',
      activeProfileId: undefined
    });
  }

  /**
   * On startup, re-publish whatever profile the user was last live with. Called
   * once when the renderer boots (including hidden/background launches) so the
   * Discord presence comes back automatically with no interaction.
   */
  async resumeIfLive(profiles: PresenceProfile[]) {
    const live = persistence.loadLiveState();
    if (!live?.isLive || !live.profileId) return;
    const profile = profiles.find((item) => item.id === live.profileId);
    if (!profile) return;
    await this.start(profile);
  }

  async reconnect() {
    const bridge = this.bridge;
    if (!bridge?.connect || !this.lastApplicationId) {
      this.setState({
        status: 'error',
        message: 'Nothing to reconnect. Go live with a profile first.',
        activeProfileId: this.state.activeProfileId
      });
      return;
    }

    this.setState({
      status: 'connecting',
      message: 'Reconnecting to Discord…',
      activeProfileId: this.state.activeProfileId
    });

    try {
      await bridge.disconnect?.();
      await bridge.connect(this.lastApplicationId);
      this.connectionMs = Date.now();
      this.setState({
        status: 'connected',
        message: 'Reconnected to Discord',
        activeProfileId: this.state.activeProfileId
      });
    } catch (error) {
      this.setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Reconnect failed.',
        activeProfileId: this.state.activeProfileId
      });
    }
  }

  private setState(nextState: DiscordServiceState) {
    this.state = nextState;
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const discordPresenceService = new DiscordPresenceService();
