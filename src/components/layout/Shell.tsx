import { PropsWithChildren, useEffect, useRef, useState, useCallback } from 'react';
import { Settings2, Minus, Square, X } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { discordPresenceService } from '../../services/discordPresence';
import type { ConnectionStatus } from '../../lib/types';
import { CommandPalette } from './CommandPalette';

export function Shell({ children }: PropsWithChildren) {
  const shellRef = useRef<HTMLDivElement>(null);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const statusMessage = useAppStore((state) => state.statusMessage);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const profiles = useAppStore((state) => state.profiles);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const createProfile = useAppStore((state) => state.createProfile);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const currentProfile = profiles.find((p) => p.id === selectedProfileId);

  useEffect(() => {
    const bridge = window.myPresenceDesktop;
    if (bridge) {
      bridge.getMeta().catch(() => {});
      const { settings } = useAppStore.getState();
      bridge.setLaunchOnStartup?.(settings.launchOnStartup).catch(() => {});
      void discordPresenceService.resumeIfLive(profiles);
    }

    const unsubscribe = discordPresenceService.subscribe((state) => {
      setConnectionStatus(state.status, state.message);
    });
    return () => { unsubscribe(); };
  }, [setConnectionStatus]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const handlePaletteAction = useCallback((action: string) => {
    setPaletteOpen(false);
    const state = useAppStore.getState();
    if (action === 'create-profile') { createProfile(); setActiveTab('editor'); }
    else if (action === 'duplicate-profile') {
      const pid = state.selectedProfileId;
      if (pid) useAppStore.getState().duplicateProfile(pid);
    }
    else if (action === 'delete-profile') {
      const pid = state.selectedProfileId;
      if (pid) useAppStore.getState().deleteProfile(pid);
    }
    else if (action === 'switch-editor') setActiveTab('editor');
    else if (action === 'switch-assets') setActiveTab('assets');
    else if (action === 'switch-settings') setActiveTab('settings');
    else if (action === 'switch-background') setActiveTab('background');
    else if (action === 'toggle-presence') {
      const profile = state.profiles.find((p) => p.id === state.selectedProfileId);
      if (profile) {
        if (profile.status === 'live') discordPresenceService.stop();
        else discordPresenceService.start(profile).catch(() => {});
      }
    }
    else if (action === 'connect-discord') {
      const profile = state.profiles.find((p) => p.id === state.selectedProfileId);
      if (profile) discordPresenceService.start(profile).catch(() => {});
    }
    else if (action === 'disconnect-discord') { discordPresenceService.stop(); }
    else if (action === 'toggle-background') {
      setActiveTab('background');
    }
    else if (action === 'import-profile') {
      const bridge = window.myPresenceDesktop;
      if (bridge?.uploadImage) bridge.uploadImage().catch(() => {});
    }
  }, [createProfile, setActiveTab]);

  const minimize = () => window.myPresenceDesktop?.minimizeToTray?.();
  const maximize = () => window.myPresenceDesktop?.maximizeWindow?.();
  const closeWindow = () => window.myPresenceDesktop?.hideWindow?.();

  return (
    <div className="shell-root" ref={shellRef}>

      {/* Custom Windows 11 Titlebar */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <div className="titlebar-logo">
            <img src="./ic_app_logo.png" alt="MY PRESENCE" />
          </div>
          <span className="titlebar-label">My Presence</span>
        </div>

        <div className="titlebar-actions">
          <button className="titlebar-btn" onClick={() => setActiveTab('settings')} title="Settings" aria-label="Settings">
            <Settings2 size={14} />
          </button>
          <button className="titlebar-btn" onClick={minimize} title="Minimize" aria-label="Minimize">
            <Minus size={14} />
          </button>
          <button className="titlebar-btn" onClick={maximize} title="Maximize" aria-label="Maximize">
            <Square size={12} />
          </button>
          <button className="titlebar-btn close" onClick={closeWindow} title="Close" aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="shell-content">{children}</div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handlePaletteAction}
      />
    </div>
  );
}
