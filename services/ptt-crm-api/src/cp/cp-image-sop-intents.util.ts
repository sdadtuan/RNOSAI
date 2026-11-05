import type { ImgIntent } from './cp-image-sop.types';

export type ImgIntentMeta = {
  intent: ImgIntent;
  label: string;
  primaryCapability: string;
  description: string;
};

export const IMG_INTENT_CATALOG: ImgIntentMeta[] = [
  {
    intent: 'hero_lifestyle',
    label: 'Hero lifestyle / KV',
    primaryCapability: 'images_generate',
    description: 'Brand key visual, lifestyle, mood imagery',
  },
  {
    intent: 'product_lock',
    label: 'Product lock / packshot',
    primaryCapability: 'comfy_packshot',
    description: 'SKU-accurate packshot with label fidelity',
  },
  {
    intent: 'text_cta',
    label: 'Text / CTA overlay',
    primaryCapability: 'overlay_lockup',
    description: 'Official lockup overlay — no model-drawn logo',
  },
  {
    intent: 'upscale_print',
    label: 'Upscale print master',
    primaryCapability: 'images_upscale',
    description: '4K–8K print-ready upscale',
  },
  {
    intent: 'bg_cutout',
    label: 'Background cutout',
    primaryCapability: 'images_remove_background',
    description: 'Transparent PNG product isolation',
  },
  {
    intent: 'format_pack',
    label: 'Format pack',
    primaryCapability: 'images_crop',
    description: 'Multi-ratio 1:1 · 4:5 · 9:16 · 16:9 from master',
  },
  {
    intent: 'human_art',
    label: 'Human art direction',
    primaryCapability: 'weave_wo',
    description: 'Weave work order for food / luxury art',
  },
  {
    intent: 'i2v_handoff',
    label: 'I2V handoff',
    primaryCapability: 'video_generate',
    description: 'Keyframe to clip after G2 approval',
  },
];

export function listIntentCatalog(): ImgIntentMeta[] {
  return [...IMG_INTENT_CATALOG];
}

export function isImgIntent(value: string): value is ImgIntent {
  return IMG_INTENT_CATALOG.some((item) => item.intent === value);
}
