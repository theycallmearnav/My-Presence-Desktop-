import { Bell, Cpu, Database, Gauge, MonitorCog, MoonStar, RefreshCcw, Shield, Videotape, Wifi, Zap } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { SegmentedControl, SwitchField } from '../ui/forms';

export function SettingsView() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <SettingCard title="General" icon={Bell} description="Application-wide behavior.">
        <SwitchField label="Auto updates" description="Automatically install updates" checked={settings.autoUpdates} onChange={(v) => updateSettings((s) => ({ ...s, autoUpdates: v }))} />
        <SwitchField label="Notifications" description="Show desktop alerts on connection changes" checked={settings.notifications} onChange={(v) => updateSettings((s) => ({ ...s, notifications: v }))} />
        <SwitchField label="Reduced motion" description="Minimize animations and transitions" checked={settings.reduceMotion} onChange={(v) => updateSettings((s) => ({ ...s, reduceMotion: v }))} />
      </SettingCard>

      <SettingCard title="Appearance" icon={MoonStar} description="Dark, light, or OLED — instantly applies everywhere.">
        <SegmentedControl
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'oled', label: 'OLED' },
          ]}
          value={settings.appearance}
          onChange={(value) => updateSettings((current) => ({ ...current, appearance: value as typeof current.appearance }))}
        />
      </SettingCard>

      <SettingCard title="Discord" icon={Wifi} description="Connection and presence behavior.">
        <SwitchField label="Auto reconnect" description="Reconnect if Discord disconnects" checked={settings.autoReconnect} onChange={(v) => updateSettings((s) => ({ ...s, autoReconnect: v }))} />
        <div style={{ marginTop: 4 }}>
          <button className="ui-button ui-button--outline" onClick={() => { const s = useAppStore.getState(); const p = s.profiles.find(p => p.id === s.selectedProfileId); if (p) import('../../services/discordPresence').then(m => m.discordPresenceService.start(p).catch(() => {})); }} style={{ width: '100%' }}>
            <RefreshCcw size={12} /> Reconnect Discord
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Startup" icon={MonitorCog} description="Behavior when Windows starts.">
        <SwitchField label="Launch at Windows startup" description="Open automatically when you log in" checked={settings.launchOnStartup} onChange={(v) => { updateSettings((s) => ({ ...s, launchOnStartup: v })); void window.myPresenceDesktop?.setLaunchOnStartup?.(v); }} />
        <SwitchField label="Start minimized" description="Launch to system tray without showing window" checked={settings.startMinimized} onChange={(v) => updateSettings((s) => ({ ...s, startMinimized: v }))} />
        <SwitchField label="Minimize to tray" description="Keep running in the system tray when minimized" checked={settings.minimizeToTray} onChange={(v) => updateSettings((s) => ({ ...s, minimizeToTray: v }))} />
        <SwitchField label="Close to tray" description="Keep running in the system tray when closing window" checked={settings.closeToTray} onChange={(v) => updateSettings((s) => ({ ...s, closeToTray: v }))} />
        <SwitchField label="Restore previous session" description="Re-open profiles from last session" checked={settings.restorePreviousSession} onChange={(v) => updateSettings((s) => ({ ...s, restorePreviousSession: v }))} />
      </SettingCard>

      <SettingCard title="Performance" icon={Gauge} description="Optimize resource usage.">
        <SwitchField label="Hardware acceleration" description="Use GPU for video backgrounds and effects" checked={settings.hardwareAcceleration} onChange={(v) => updateSettings((s) => ({ ...s, hardwareAcceleration: v }))} />
        <SwitchField label="Pause video when hidden" description="Pause video backgrounds when window is minimized" checked={settings.videoPauseWhenHidden} onChange={(v) => updateSettings((s) => ({ ...s, videoPauseWhenHidden: v }))} />
      </SettingCard>

      <SettingCard title="Advanced" icon={Shield} description="Developer and power user options.">
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          My Presence v1.0.0
          <br />
          Electron + React + TypeScript
        </div>
      </SettingCard>
    </div>
  );
}

function SettingCard({ title, description, icon: Icon, children }: {
  title: string; description: string; icon: typeof Bell; children: React.ReactNode;
}) {
  return (
    <div className="section-card" style={{ padding: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <p className="eyebrow">Settings</p>
          <h3>{title}</h3>
        </div>
        <Icon size={16} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.4 }}>{description}</p>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}
