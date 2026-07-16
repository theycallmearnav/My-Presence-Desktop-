const ASSETS_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? './assets/backgrounds'
  : '/assets/backgrounds';

export function getDefaultBackgroundImage(): string {
  return `${ASSETS_BASE}/default.jpg`;
}

export function getDefaultBackgroundVideo(): string {
  return `${ASSETS_BASE}/default.mp4`;
}