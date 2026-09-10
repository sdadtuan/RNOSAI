export const ADVISOR_FACE_ID = 'ptt-advisor-f-01';

export const LEAD_VIDEO_FILES = [
  { hook_id: 'h1' as const, filename: 'ptt-lead-h1-15.mp4', duration_sec: 15 },
  { hook_id: 'h2' as const, filename: 'ptt-lead-h2-15.mp4', duration_sec: 15 },
  { hook_id: 'h3' as const, filename: 'ptt-lead-h3-15.mp4', duration_sec: 15 },
  { hook_id: 'h1_30' as const, filename: 'ptt-lead-h1-30.mp4', duration_sec: 30 },
];

export type LeadVideoHookId = (typeof LEAD_VIDEO_FILES)[number]['hook_id'];

export type LeadVideoFileFacts = {
  hook_id: LeadVideoHookId;
  filename: string;
  width: number;
  height: number;
  duration_sec: number;
  has_audio: boolean;
  face_sec: number;
  face_id: string;
  founder_claim: boolean;
  ui_shot: boolean;
  caption_has_spaces: boolean;
  caption_top_third: boolean;
  safe_top_px: number;
  safe_bottom_px: number;
  logo_present: boolean;
  cta_is_form: boolean;
  cta_is_call_only: boolean;
  ai_label_on_creative: boolean;
  fake_cpl_claim: boolean;
  contains_human: boolean;
  ai_disclosure: boolean;
  primary_text: string;
};

export type LeadVideoCheckResult = { result: 'passed' | 'blocked'; reason: string | null };

export type LeadVideoFileReport = {
  overall: 'passed' | 'blocked';
  checks: Record<string, LeadVideoCheckResult>;
};

const AI_LABEL = /h[ìi]nh\s*ảnh\s*ai|hinh\s*anh\s*ai|minh\s*họa\s*bằng\s*ai|minh\s*hoa\s*bang\s*ai/i;

function check(result: 'passed' | 'blocked', reason: string | null = null): LeadVideoCheckResult {
  return { result, reason };
}

function expectedDuration(hookId: LeadVideoHookId): number {
  return hookId === 'h1_30' ? 30 : 15;
}

function maxFaceSec(hookId: LeadVideoHookId): number {
  return hookId === 'h3' ? 7 : 5.5;
}

export function evaluateLeadVideoFile(facts: LeadVideoFileFacts): LeadVideoFileReport {
  const target = expectedDuration(facts.hook_id);
  const technical = !facts.has_audio
    ? check('blocked', 'missing_audio')
    : facts.width !== 1080 || facts.height !== 1920
      ? check('blocked', 'technical_not_9x16_1080')
      : Math.abs(facts.duration_sec - target) > 0.2
        ? check('blocked', 'technical_duration')
        : check('passed');

  const safe_area = facts.safe_top_px >= 110 && facts.safe_bottom_px >= 280 && facts.logo_present
    ? check('passed')
    : check('blocked', 'safe_area_violated');

  const caption = !facts.caption_has_spaces
    ? check('blocked', 'caption_no_spaces')
    : !facts.caption_top_third
      ? check('blocked', 'caption_not_top_third')
      : check('passed');

  const talent = facts.founder_claim
    ? check('blocked', 'founder_claim')
    : facts.face_id !== ADVISOR_FACE_ID
      ? check('blocked', 'face_id_mismatch')
      : facts.face_sec > maxFaceSec(facts.hook_id)
        ? check('blocked', 'face_too_long')
        : check('passed');

  const ui = facts.ui_shot ? check('passed') : check('blocked', 'ui_shot_missing');

  const cta = facts.cta_is_call_only || !facts.cta_is_form
    ? check('blocked', 'cta_call_only')
    : check('passed');

  const labeled = facts.ai_label_on_creative || AI_LABEL.test(facts.primary_text);
  const copy = labeled ? check('blocked', 'ai_label_on_creative') : check('passed');
  const claim = facts.fake_cpl_claim ? check('blocked', 'fake_cpl_claim') : check('passed');
  const internal = facts.contains_human && facts.ai_disclosure
    ? check('passed')
    : check('blocked', 'ai_disclosure_missing');

  const checks = { technical, safe_area, caption, talent, ui, cta, copy, claim, internal };
  const overall = Object.values(checks).some((item) => item.result === 'blocked') ? 'blocked' : 'passed';
  return { overall, checks };
}

export type LeadVideoPackReport = {
  overall: 'passed' | 'blocked';
  files: Record<LeadVideoHookId, LeadVideoFileReport | { overall: 'blocked'; reason: 'missing_file' }>;
};

export function evaluateLeadVideoPack(files: LeadVideoFileFacts[]): LeadVideoPackReport {
  const byHook = new Map(files.map((file) => [file.hook_id, file]));
  const out = {} as LeadVideoPackReport['files'];
  for (const row of LEAD_VIDEO_FILES) {
    const facts = byHook.get(row.hook_id);
    out[row.hook_id] = facts
      ? evaluateLeadVideoFile({ ...facts, filename: row.filename, hook_id: row.hook_id })
      : { overall: 'blocked', reason: 'missing_file' };
  }
  const overall = Object.values(out).some((file) => file.overall === 'blocked') ? 'blocked' : 'passed';
  return { overall, files: out };
}

export function assertLeadVideoLaunchable(
  pack: LeadVideoPackReport,
  opts: { require_h1_30: boolean },
): void {
  const hooks: LeadVideoHookId[] = opts.require_h1_30
    ? ['h1', 'h2', 'h3', 'h1_30']
    : ['h1', 'h2', 'h3'];
  const blocked = hooks.some((hook) => pack.files[hook].overall === 'blocked');
  if (blocked) {
    throw Object.assign(new Error('pack_qc_blocked'), { error: 'pack_qc_blocked' });
  }
}
