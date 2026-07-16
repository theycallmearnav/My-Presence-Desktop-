import { create } from 'zustand';
import { getDefaultBackgroundVideo } from './defaultBackground';
import { defaultSettings, defaultThemes, sampleAssets, sampleProfiles } from './seed';
import { persistence } from '../services/persistence';
import { effectiveTimestampMode } from './timestamps';
import type { AppSettings, AssetItem, ConnectionStatus, PresenceProfile, Theme } from './types';

export type TabKey = 'editor' | 'assets' | 'settings' | 'background';

type StoreState = {
  profiles: PresenceProfile[];
  selectedProfileId: string;
  search: string;
  activeTab: TabKey;
  assets: AssetItem[];
  settings: AppSettings;
  themes: Theme[];
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  onboardingOpen: boolean;
  selectProfile: (profileId: string) => void;
  updateProfile: (profileId: string, updater: (profile: PresenceProfile) => PresenceProfile) => void;
  createProfile: () => void;
  duplicateProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  toggleFavorite: (profileId: string) => void;
  setSearch: (value: string) => void;
  setActiveTab: (tab: TabKey) => void;
  setConnectionStatus: (status: ConnectionStatus, message: string) => void;
  updateSettings: (updater: (settings: AppSettings) => AppSettings) => void;
  createTheme: () => void;
  duplicateTheme: (themeId: string) => void;
  deleteTheme: (themeId: string) => void;
  updateTheme: (themeId: string, updater: (theme: Theme) => Theme) => void;
  reorderThemes: (themes: Theme[]) => void;
  setActiveTheme: (themeId: string | null) => void;
  exportTheme: (themeId: string) => string;
  importTheme: (json: string) => boolean;
  setOnboardingOpen: (open: boolean) => void;
  completeOnboarding: () => void;
  resetDefaultTheme: () => void;
};

export function useActiveTheme(): Theme | undefined {
  return useAppStore((s) => {
    const id = s.settings.activeThemeId;
    return id ? s.themes.find((t) => t.id === id) : undefined;
  });
}

export function useProfile(): PresenceProfile | undefined {
  return useAppStore((s) => s.profiles.find((p) => p.id === s.selectedProfileId));
}

const sanitizeProfileImages = (profiles: PresenceProfile[]): PresenceProfile[] =>
  profiles.map((profile) => {
    const keepUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : '');
    const buttons = (profile.buttons ?? []).map((button) =>
      /(^https?:\/\/)?(www\.)?example\.com/i.test(button.url.trim()) ? { ...button, url: '' } : button
    );
    const timestamps = {
      ...profile.timestamps,
      mode: effectiveTimestampMode(profile.timestamps),
      endEnabled: profile.timestamps.endEnabled ?? Boolean(profile.timestamps.end)
    };
    return {
      ...profile,
      buttonsEnabled: profile.buttonsEnabled ?? true,
      buttons,
      timestamps,
      assets: {
        ...profile.assets,
        largeImage: keepUrl(profile.assets.largeImage),
        smallImage: keepUrl(profile.assets.smallImage)
      }
    };
  });

const loadedProfiles = persistence.loadProfiles();
const storedProfiles = sanitizeProfileImages(loadedProfiles?.length ? loadedProfiles : sampleProfiles);
const storedAssets = persistence.loadAssets() ?? sampleAssets;
const storedSettings = persistence.loadSettings() ?? defaultSettings;
const storedThemes = persistence.loadThemes() ?? defaultThemes;

const persistState = (partial: Partial<StoreState>) => {
  if (partial.profiles) persistence.saveProfiles(partial.profiles);
  if (partial.assets) persistence.saveAssets(partial.assets);
  if (partial.settings) persistence.saveSettings(partial.settings);
  if (partial.themes) persistence.saveThemes(partial.themes);
};

const createBlankProfile = (): PresenceProfile => {
  const now = new Date().toISOString();
  return {
    id: `profile-${crypto.randomUUID()}`,
    name: 'New Presence',
    favorite: false,
    details: '',
    state: '',
    applicationId: '',
    activityType: 'Playing',
    instance: false,
    status: 'idle',
    buttonsEnabled: true,
    buttons: [
      { id: crypto.randomUUID(), label: '', url: '' },
      { id: crypto.randomUUID(), label: '', url: '' }
    ],
    assets: {
      largeImage: '',
      largeText: '',
      largeUrl: '',
      smallImage: '',
      smallText: '',
      smallUrl: ''
    },
    timestamps: { mode: 'none' },
    party: {
      id: '',
      currentSize: 1,
      maxSize: 5
    },
    secrets: {
      join: '',
      spectate: '',
      match: ''
    },
    notes: '',
    updatedAt: now
  };
};

export const useAppStore = create<StoreState>((set, get) => ({
  profiles: storedProfiles,
  selectedProfileId: storedProfiles[0]?.id ?? '',
  search: '',
  activeTab: 'editor',
  assets: storedAssets,
  settings: storedSettings,
  themes: storedThemes,
  connectionStatus: 'disconnected',
  statusMessage: 'Not connected',
  onboardingOpen: !storedSettings.onboardingComplete,

  selectProfile: (selectedProfileId) => set({ selectedProfileId }),
  updateProfile: (profileId, updater) =>
    set((state) => {
      const profiles = state.profiles.map((profile) =>
        profile.id === profileId ? { ...updater(profile), updatedAt: new Date().toISOString() } : profile
      );
      persistState({ profiles });
      return { profiles };
    }),
  createProfile: () =>
    set((state) => {
      const profile = createBlankProfile();
      const profiles = [profile, ...state.profiles];
      persistState({ profiles });
      return { profiles, selectedProfileId: profile.id, activeTab: 'editor' as TabKey };
    }),
  duplicateProfile: (profileId) =>
    set((state) => {
      const target = state.profiles.find((p) => p.id === profileId);
      if (!target) return state;
      const duplicate = {
        ...target,
        id: `profile-${crypto.randomUUID()}`,
        name: `${target.name} Copy`,
        status: 'idle' as const,
        updatedAt: new Date().toISOString()
      };
      const profiles = [duplicate, ...state.profiles];
      persistState({ profiles });
      return { profiles, selectedProfileId: duplicate.id };
    }),
  deleteProfile: (profileId) =>
    set((state) => {
      const profiles = state.profiles.filter((p) => p.id !== profileId);
      persistState({ profiles });
      return { profiles, selectedProfileId: profiles[0]?.id ?? '', activeTab: profiles.length ? state.activeTab : 'editor' as TabKey };
    }),
  toggleFavorite: (profileId) =>
    set((state) => {
      const profiles = state.profiles.map((p) =>
        p.id === profileId ? { ...p, favorite: !p.favorite, updatedAt: new Date().toISOString() } : p
      );
      persistState({ profiles });
      return { profiles };
    }),
  setSearch: (search) => set({ search }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setConnectionStatus: (connectionStatus, statusMessage) => set({ connectionStatus, statusMessage }),
  updateSettings: (updater) =>
    set((state) => {
      const settings = updater(state.settings);
      persistState({ settings });
      return { settings };
    }),

  // Theme actions
  createTheme: () =>
    set((state) => {
      const theme: Theme = {
        id: `theme-${crypto.randomUUID()}`,
        name: `Theme ${state.themes.length + 1}`,
        backgroundType: 'solid',
        solidColor: '#0b0b0f',
        gradientStart: '#6366f1',
        gradientEnd: '#06b6d4',
        gradientAngle: 135,
        imageUrl: '',
        videoUrl: '',
        accentColor: '#6366f1',
        blurAmount: 0,
        brightness: 100,
        opacity: 100,
        noiseOverlay: false,
        glassStrength: 10,
        cornerRadius: 12,
        videoFit: 'fill',
        overlayColor: '#000000',
        overlayOpacity: 0,
        muted: true,
        volume: 50,
        playbackSpeed: 1,
        loop: true,
        scope: 'app',
        sortOrder: state.themes.length,
      };
      const themes = [...state.themes, theme];
      persistState({ themes });
      return { themes };
    }),
  duplicateTheme: (themeId) =>
    set((state) => {
      const target = state.themes.find((t) => t.id === themeId);
      if (!target) return state;
      const duplicate = { ...target, id: `theme-${crypto.randomUUID()}`, name: `${target.name} Copy`, sortOrder: state.themes.length };
      const themes = [...state.themes, duplicate];
      persistState({ themes });
      return { themes };
    }),
  deleteTheme: (themeId) =>
    set((state) => {
      const themes = state.themes.filter((t) => t.id !== themeId);
      const activeThemeId = state.settings.activeThemeId === themeId ? null : state.settings.activeThemeId;
      persistState({ themes });
      const settings = { ...state.settings, activeThemeId };
      persistState({ settings });
      return { themes, settings };
    }),
  updateTheme: (themeId, updater) =>
    set((state) => {
      const themes = state.themes.map((t) => (t.id === themeId ? updater(t) : t));
      persistState({ themes });
      return { themes };
    }),
  reorderThemes: (themes) => {
    persistState({ themes });
    set({ themes });
  },
  setActiveTheme: (themeId) =>
    set((state) => {
      const settings = { ...state.settings, activeThemeId: themeId };
      persistState({ settings });
      return { settings };
    }),
  resetDefaultTheme: () =>
    set((state) => {
      const settings = { ...state.settings, backgroundSource: '' };
      persistState({ settings });
      const themes: Theme[] = state.themes.map((t) =>
        t.id === state.settings.activeThemeId
          ? {
              ...t,
              backgroundType: 'video' as const,
              videoUrl: getDefaultBackgroundVideo(),
              imageUrl: '',
              blurAmount: 0,
              brightness: 100,
              opacity: 100,
              noiseOverlay: true,
              muted: true,
              volume: 50,
              playbackSpeed: 1,
              loop: true,
              videoFit: 'fill' as const,
              overlayOpacity: 0,
            }
          : t
      );
      persistState({ themes });
      return { themes, settings };
    }),
  exportTheme: (themeId) => {
    const state = get();
    const theme = state.themes.find((t) => t.id === themeId);
    if (!theme) return '';
    return JSON.stringify(theme, null, 2);
  },
  importTheme: (json) => {
    try {
      const theme = JSON.parse(json) as Theme;
      if (!theme.id || !theme.name) return false;
      theme.id = `theme-${crypto.randomUUID()}`;
      theme.name = `${theme.name} (imported)`;
      const state = get();
      const themes = [...state.themes, theme];
      persistState({ themes });
      set({ themes });
      return true;
    } catch { return false; }
  },
  setOnboardingOpen: (open) => set({ onboardingOpen: open }),
  completeOnboarding: () =>
    set((state) => {
      const settings = { ...state.settings, onboardingComplete: true };
      persistState({ settings });
      return { settings, onboardingOpen: false };
    })
}));
