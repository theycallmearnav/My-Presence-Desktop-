import type { PresenceTimestamps, TimestampMode } from './types';

// The moment this module first loaded — i.e. when the app was opened. Used by
// the 'sinceAppStart' mode ("Since My Presence opened").
export const APP_START_MS = Date.now();

// Runtime moments the resolver needs to turn an automatic mode into a concrete
// epoch. The presence service fills connection/update times; the preview anchors
// them to APP_START_MS so its counters still visibly tick.
export type TimestampContext = {
  now: number;
  appStartMs: number;
  connectionMs?: number;
  lastUpdateMs?: number;
};

// Shape consumed by the RadioGroup in Step 5. Matches SelectOption in ui/forms.
export type TimestampModeOption = {
  value: TimestampMode;
  label: string;
  description?: string;
};

export const TIMESTAMP_MODE_OPTIONS: TimestampModeOption[] = [
  { value: 'none', label: 'No timer', description: "Don't show any timer on your status." },
  { value: 'sinceConnection', label: 'Since I went live', description: 'Counts up from when you connected to Discord.' },
  { value: 'sinceUpdate', label: 'Since last presence update', description: 'Resets each time your status is updated.' },
  { value: 'sinceAppStart', label: 'Since My Presence opened', description: 'Counts up from when you opened this app.' },
  { value: 'localTime', label: 'Your local time', description: 'Shows your current local clock time.' },
  { value: 'custom', label: 'Custom timestamp', description: 'Pick your own start (and optional end) time.' }
];

// Old profiles only stored start/end. Treat a missing mode as 'custom' when
// either was set, otherwise 'none'.
export function effectiveTimestampMode(ts?: PresenceTimestamps): TimestampMode {
  if (!ts) return 'none';
  if (ts.mode) return ts.mode;
  return ts.start || ts.end ? 'custom' : 'none';
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function localMidnight(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Resolve a timestamps config + runtime context into the concrete epoch ms that
// Discord (and the preview) should display. This is the single source of truth
// shared by the RPC mapping and the live preview so they never disagree.
export function resolveTimestamps(
  ts: PresenceTimestamps | undefined,
  ctx: TimestampContext
): { start?: number; end?: number } {
  switch (effectiveTimestampMode(ts)) {
    case 'none':
      return {};
    case 'sinceConnection':
      return { start: ctx.connectionMs ?? ctx.now };
    case 'sinceUpdate':
      return { start: ctx.lastUpdateMs ?? ctx.now };
    case 'sinceAppStart':
      return { start: ctx.appStartMs };
    case 'localTime':
      return { start: localMidnight(ctx.now) };
    case 'custom':
      return {
        start: toEpochMs(ts?.start),
        end: ts?.endEnabled ? toEpochMs(ts?.end) : undefined
      };
  }
}
