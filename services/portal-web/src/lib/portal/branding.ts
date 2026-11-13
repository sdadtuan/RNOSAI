import type { PortalSettingsResponse } from '@/lib/api';

export const PTT_DEFAULT_ACCENT = '#17692f';
export const PTT_DEFAULT_ACCENT_HOVER = '#C7D9C9';

const HEX_SHORT = /^#([0-9a-fA-F]{3})$/;
const HEX_FULL = /^#([0-9a-fA-F]{6})$/;

function expandShortHex(hex: string): string {
  const match = HEX_SHORT.exec(hex);
  if (!match) return hex;
  const [, triple] = match;
  return `#${triple[0]}${triple[0]}${triple[1]}${triple[1]}${triple[2]}${triple[2]}`.toLowerCase();
}

export function normalizeAccentColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (HEX_FULL.test(trimmed)) return trimmed.toLowerCase();
  if (HEX_SHORT.test(trimmed)) return expandShortHex(trimmed);
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeAccentColor(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function darkenHex(hex: string, ratio = 0.15): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return PTT_DEFAULT_ACCENT;
  const factor = 1 - ratio;
  const toByte = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor)));
  const r = toByte(rgb.r).toString(16).padStart(2, '0');
  const g = toByte(rgb.g).toString(16).padStart(2, '0');
  const b = toByte(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/** Mix a hex color toward white for hover fills (light chips), not press states. */
export function tintTowardWhite(hex: string, amount = 0.76): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return PTT_DEFAULT_ACCENT_HOVER;
  const mix = (n: number) => {
    const v = Math.max(0, Math.min(255, Math.round(n * (1 - amount) + 255 * amount)));
    return v.toString(16).padStart(2, '0');
  };
  return `#${mix(rgb.r)}${mix(rgb.g)}${mix(rgb.b)}`;
}

export function applyPortalBranding(settings: PortalSettingsResponse | null): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const accent = normalizeAccentColor(settings?.accent_color) ?? PTT_DEFAULT_ACCENT;
  const accentPress = darkenHex(accent);
  const isCustom = Boolean(normalizeAccentColor(settings?.accent_color));
  // --accent-hover is a LIGHT fill used as a hover background (see .portal-nav-link:hover).
  // Never assign a darkened press color here — that makes dark labels disappear.
  const accentHover = isCustom ? tintTowardWhite(accent) : PTT_DEFAULT_ACCENT_HOVER;

  root.style.setProperty('--primary', accent);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--primary-700', accentPress);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--border', `color-mix(in srgb, ${accent} 16%, transparent)`);
  root.style.setProperty('--surface-soft', `color-mix(in srgb, ${accent} 6%, white)`);

  if (isCustom) {
    root.dataset.portalBranded = 'true';
  } else {
    delete root.dataset.portalBranded;
  }
}

export function clearPortalBranding(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const props = ['--primary', '--accent', '--primary-700', '--accent-hover', '--border', '--surface-soft'];
  for (const prop of props) {
    root.style.removeProperty(prop);
  }
  delete root.dataset.portalBranded;
}
