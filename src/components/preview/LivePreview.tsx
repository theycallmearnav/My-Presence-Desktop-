import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock3, ExternalLink, ImageOff, Radio } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PresenceProfile } from '../../lib/types';
import { APP_START_MS, resolveTimestamps } from '../../lib/timestamps';

type PreviewBackground = 'discord' | 'amoled' | 'soft';

const backgroundOptions: { key: PreviewBackground; label: string }[] = [
  { key: 'discord', label: 'Discord Dark' },
  { key: 'amoled', label: 'AMOLED' },
  { key: 'soft', label: 'Soft Gradient' }
];

export function LivePreview({ profile }: { profile: PresenceProfile }) {
  const [background, setBackground] = useState<PreviewBackground>('discord');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleButtons = useMemo(
    () => (profile.buttonsEnabled === false ? [] : profile.buttons.filter((button) => button.label.trim()).slice(0, 2)),
    [profile.buttons, profile.buttonsEnabled]
  );
  const { start: timerStart, end: timerEnd } = resolveTimestamps(profile.timestamps, {
    now,
    appStartMs: APP_START_MS,
    connectionMs: APP_START_MS,
    lastUpdateMs: APP_START_MS
  });
  const timerText = getTimerText(timerStart, timerEnd, now);
  const hasParty = Boolean(profile.party.id || profile.party.currentSize > 1 || profile.party.maxSize > 1);
  const hasLargeImage = Boolean(profile.assets.largeImage);
  const activityName = profile.details || profile.name;
  const applicationName = profile.name || 'MY PRESENCE';

  return (
    <aside className="preview-panel live-preview-hero glass-panel">
      <div className="preview-hero-header">
        <div>
          <p className="eyebrow">Live Activity Preview</p>
          <h2>Rich Presence</h2>
        </div>
        <div className={profile.status === 'live' ? 'status-pill connected' : 'status-pill'}>
          <Radio size={14} />
          {profile.status === 'live' ? 'Live' : 'Idle'}
        </div>
      </div>

      <div className="preview-controls minimal">
        <label className="preview-select">
          <span>Background</span>
          <select value={background} onChange={(event) => setBackground(event.target.value as PreviewBackground)}>
            {backgroundOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>

      <div className={`presence-preview-stage preview-bg-${background}`}>
        <motion.div className="presence-preview-card" layout transition={{ duration: 0.22, ease: 'easeOut' }}>
          <div className="presence-preview-app">
            <div className="presence-app-icon">{applicationName.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{applicationName}</strong>
              <span>{profile.activityType}</span>
            </div>
          </div>

          <div className="presence-preview-content">
            <div className="presence-artwork-shell">
              <AnimatePresence mode="wait">
                <motion.div
                  key={profile.assets.largeImage || 'missing'}
                  className={hasLargeImage ? 'presence-large-artwork' : 'presence-large-artwork empty'}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                >
                  {hasLargeImage ? (
                    isImageUrl(profile.assets.largeImage) ? (
                      <img className={`presence-artwork-image fit-${profile.assets.largeFit ?? 'fill'}`} src={profile.assets.largeImage} alt={profile.assets.largeText || 'Large art'} />
                    ) : (
                      profile.assets.largeImage.slice(0, 2).toUpperCase()
                    )
                  ) : (
                    <ImageOff size={26} />
                  )}
                </motion.div>
              </AnimatePresence>

              {profile.assets.smallImage ? (
                <motion.div className="presence-small-artwork" initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }}>
                  {isImageUrl(profile.assets.smallImage) ? (
                    <img className={`presence-artwork-image fit-${profile.assets.smallFit ?? 'fill'}`} src={profile.assets.smallImage} alt={profile.assets.smallText || 'Small art'} />
                  ) : (
                    profile.assets.smallImage.slice(0, 1).toUpperCase()
                  )}
                  {profile.assets.smallText ? <span className="simulated-tooltip">{profile.assets.smallText}</span> : null}
                </motion.div>
              ) : null}
              {profile.assets.largeText ? <span className="simulated-tooltip large-tip">{profile.assets.largeText}</span> : null}
            </div>

            <div className="presence-preview-copy">
              <AnimatePresence mode="popLayout">
                <motion.span key={profile.activityType} className="presence-activity-type" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                  {profile.activityType} a game
                </motion.span>
                {activityName ? (
                  <motion.strong key={activityName} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                    {activityName}
                  </motion.strong>
                ) : null}
                {profile.state ? (
                  <motion.p key={profile.state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                    {profile.state}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {(timerText || hasParty) ? (
                <div className="presence-preview-meta">
                  {timerText ? (
                    <motion.span key={timerText} className="presence-live-timer" initial={{ opacity: 0.72 }} animate={{ opacity: 1 }}>
                      <Clock3 size={13} />
                      {timerText}
                    </motion.span>
                  ) : null}
                  {hasParty ? <span>{profile.party.currentSize} / {profile.party.maxSize}</span> : null}
                </div>
              ) : null}

              {visibleButtons.length ? (
                <motion.div className={visibleButtons.length === 1 ? 'presence-buttons single' : 'presence-buttons'} layout>
                  {visibleButtons.map((button) => {
                    const href = button.url.trim();
                    const openable = /^https?:\/\//i.test(href);
                    return (
                      <motion.button
                        key={button.id}
                        type="button"
                        className="presence-button"
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        disabled={!openable}
                        title={openable ? href : 'Add a link in Step 4'}
                        onClick={() => {
                          if (openable) window.open(href, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <span>{button.label}</span>
                        <ExternalLink size={12} />
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </aside>
  );
}

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function getTimerText(start?: number, end?: number, now = Date.now()) {
  if (end !== undefined) {
    const diff = end - now;
    if (Number.isFinite(diff) && diff > 0) return `${formatDuration(diff)} left`;
    return 'Ending now';
  }

  if (start !== undefined) {
    const diff = now - start;
    if (Number.isFinite(diff) && diff >= 0) return `${formatDuration(diff)} elapsed`;
  }

  return '';
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
