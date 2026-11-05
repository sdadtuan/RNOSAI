export const CP_PREVIEW_OVERLAY_CLIP = 42;

export type CpPreviewPayload = {
  motion?: { caption_style?: string | null };
  cta?: { label?: string | null };
};

export function overlayFromBrandPayload(payload: CpPreviewPayload): string {
  return String(payload.motion?.caption_style || payload.cta?.label || '');
}

export function previewOverlayInput(overlay: string | null | undefined): string | undefined {
  const text = String(overlay ?? '').trim();
  return text || undefined;
}

export function overlayClips(overlay: string, max = CP_PREVIEW_OVERLAY_CLIP): boolean {
  return overlay.length > max;
}
