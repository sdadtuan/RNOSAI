import { readAiOpsFlags } from './cp-ai-ops.flags';
import type { ImgIntent, ImgProvider, ImgRecipeStage } from './cp-image-sop.types';

export function compileRecipe(input: {
  intent: ImgIntent;
  flags: ReturnType<typeof readAiOpsFlags>;
  hasMagnificConnection: boolean;
}): { stages: ImgRecipeStage[]; blocked_reason: string | null } {
  const { intent, flags, hasMagnificConnection } = input;
  const magnificAvailable = flags.magnificRest && hasMagnificConnection;
  const weaveAvailable = flags.weave;
  const comfyAvailable = flags.comfy;

  switch (intent) {
    case 'hero_lifestyle': {
      if (!magnificAvailable && !weaveAvailable) {
        return { stages: [], blocked_reason: 'magnific_disconnected' };
      }
      const exploreProvider: ImgProvider = magnificAvailable ? 'magnific_rest' : 'weavy';
      return {
        stages: basePipeline({
          explore: { capability: 'images_generate', provider: exploreProvider },
          refine: weaveAvailable
            ? { capability: 'weave_refine', provider: 'weavy', required: false }
            : undefined,
          upscale: magnificAvailable
            ? { capability: 'images_upscale', provider: 'magnific_rest' }
            : undefined,
          pack: packStage(magnificAvailable),
        }),
        blocked_reason: null,
      };
    }
    case 'product_lock': {
      const exploreProvider: ImgProvider = comfyAvailable ? 'comfyui' : 'magnific_rest';
      if (exploreProvider === 'magnific_rest' && !magnificAvailable && !weaveAvailable) {
        return { stages: [], blocked_reason: 'magnific_disconnected' };
      }
      return {
        stages: basePipeline({
          explore: {
            capability: comfyAvailable ? 'comfy_packshot' : 'images_generate',
            provider: exploreProvider,
          },
          refine: magnificAvailable
            ? { capability: 'images_remove_background', provider: 'magnific_rest' }
            : undefined,
          pack: packStage(magnificAvailable),
        }),
        blocked_reason: null,
      };
    }
    case 'text_cta':
      return {
        stages: basePipeline({
          explore: { capability: 'overlay_lockup', provider: 'local' },
          refine: { capability: 'overlay_lockup', provider: 'local' },
          pack: packStage(magnificAvailable),
        }),
        blocked_reason: null,
      };
    case 'upscale_print':
      if (!magnificAvailable) {
        return { stages: [], blocked_reason: 'magnific_disconnected' };
      }
      return {
        stages: [
          stage('upscale', 'images_upscale', 'magnific_rest'),
          stage('qc', 'brand_kv_v1', 'local'),
        ],
        blocked_reason: null,
      };
    case 'bg_cutout':
      if (!magnificAvailable && !comfyAvailable) {
        return { stages: [], blocked_reason: 'magnific_disconnected' };
      }
      return {
        stages: basePipeline({
          explore: {
            capability: 'images_remove_background',
            provider: magnificAvailable ? 'magnific_rest' : 'comfyui',
          },
          pack: packStage(magnificAvailable),
        }),
        blocked_reason: null,
      };
    case 'format_pack':
      return {
        stages: basePipeline({
          explore: { capability: 'images_generate', provider: magnificAvailable ? 'magnific_rest' : 'local' },
          pack: packStage(magnificAvailable),
        }),
        blocked_reason: null,
      };
    case 'human_art':
      if (!weaveAvailable) {
        return { stages: [], blocked_reason: 'weave_disabled' };
      }
      return {
        stages: basePipeline({
          explore: { capability: 'weave_wo', provider: 'weavy' },
          upscale: magnificAvailable
            ? { capability: 'images_upscale', provider: 'magnific_rest' }
            : undefined,
          pack: packStage(magnificAvailable),
        }),
        blocked_reason: null,
      };
    case 'i2v_handoff':
      if (!magnificAvailable) {
        return { stages: [], blocked_reason: 'magnific_disconnected' };
      }
      return {
        stages: [
          stage('explore', 'video_generate', 'magnific_rest'),
          stage('select', 'manual', 'local'),
          stage('qc', 'brand_kv_v1', 'local'),
        ],
        blocked_reason: null,
      };
    default:
      return { stages: [], blocked_reason: 'unknown_intent' };
  }
}

function basePipeline(parts: {
  explore: { capability: string; provider: ImgProvider };
  refine?: { capability: string; provider: ImgProvider; required?: boolean };
  upscale?: { capability: string; provider: ImgProvider };
  pack?: ImgRecipeStage;
}): ImgRecipeStage[] {
  const stages: ImgRecipeStage[] = [
    stage('explore', parts.explore.capability, parts.explore.provider),
    stage('select', 'manual', 'local'),
  ];
  if (parts.refine) {
    stages.push(
      stage(
        'refine',
        parts.refine.capability,
        parts.refine.provider,
        parts.refine.required ?? true,
      ),
    );
  }
  if (parts.upscale) {
    stages.push(stage('upscale', parts.upscale.capability, parts.upscale.provider));
  }
  if (parts.pack) stages.push(parts.pack);
  stages.push(stage('qc', 'quality_profile', 'local'));
  return stages;
}

function packStage(magnificAvailable: boolean): ImgRecipeStage {
  return magnificAvailable
    ? stage('pack', 'images_crop', 'magnific_rest')
    : stage('pack', 'images_crop', 'local');
}

function stage(
  stageName: ImgRecipeStage['stage'],
  capability: string,
  provider: ImgProvider,
  required = true,
): ImgRecipeStage {
  return { stage: stageName, capability, provider, required };
}
