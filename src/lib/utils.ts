export function formatRelative(dateIso: string) {
  const delta = Math.round((Date.now() - new Date(dateIso).getTime()) / 60000);
  if (delta <= 1) return 'Updated just now';
  if (delta < 60) return `Updated ${delta} min ago`;
  const hours = Math.round(delta / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

export function validateApplicationId(value: string) {
  if (!value) return 'Application ID is required to publish an activity.';
  if (!/^\d{8,20}$/.test(value)) return 'Application ID should contain only numbers.';
  return '';
}

export function validateUrl(value: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return 'Button links must use http or https.';
    }
    return '';
  } catch {
    return 'Enter a valid button URL.';
  }
}