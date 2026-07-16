import type { AppSettings, AssetItem, PresenceProfile, Theme } from '../lib/types';

export type LiveState = {
  isLive: boolean;
  profileId: string;
};

const KEYS = {
  profiles: 'my-presence.profiles',
  assets: 'my-presence.assets',
  settings: 'my-presence.settings',
  live: 'my-presence.live',
  themes: 'my-presence.themes'
} as const;

export const persistence = {
  loadProfiles: (): PresenceProfile[] | null => read(KEYS.profiles),
  saveProfiles: (value: PresenceProfile[]) => write(KEYS.profiles, value),
  loadAssets: (): AssetItem[] | null => read(KEYS.assets),
  saveAssets: (value: AssetItem[]) => write(KEYS.assets, value),
  loadSettings: (): AppSettings | null => read(KEYS.settings),
  saveSettings: (value: AppSettings) => write(KEYS.settings, value),
  loadLiveState: (): LiveState | null => read(KEYS.live),
  saveLiveState: (value: LiveState) => write(KEYS.live, value),
  loadThemes: (): Theme[] | null => read(KEYS.themes),
  saveThemes: (value: Theme[]) => write(KEYS.themes, value)
};

function read<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch { return null; }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
