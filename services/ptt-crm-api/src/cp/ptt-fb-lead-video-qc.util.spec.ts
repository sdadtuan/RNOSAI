import {
  ADVISOR_FACE_ID,
  LEAD_VIDEO_FILES,
  assertLeadVideoLaunchable,
  evaluateLeadVideoFile,
  evaluateLeadVideoPack,
  type LeadVideoFileFacts,
} from './ptt-fb-lead-video-qc.util';

function base15(hook_id: LeadVideoFileFacts['hook_id'], filename: string): LeadVideoFileFacts {
  return {
    hook_id,
    filename,
    width: 1080,
    height: 1920,
    duration_sec: 15,
    has_audio: true,
    face_sec: 5.5,
    face_id: ADVISOR_FACE_ID,
    founder_claim: false,
    ui_shot: true,
    caption_has_spaces: true,
    caption_top_third: true,
    safe_top_px: 110,
    safe_bottom_px: 280,
    logo_present: true,
    cta_is_form: true,
    cta_is_call_only: false,
    ai_label_on_creative: false,
    fake_cpl_claim: false,
    contains_human: true,
    ai_disclosure: true,
    primary_text: 'Ngan sach chay. Inbox im.',
  };
}

function passingPack(): LeadVideoFileFacts[] {
  return [
    base15('h1', 'ptt-lead-h1-15.mp4'),
    base15('h2', 'ptt-lead-h2-15.mp4'),
    { ...base15('h3', 'ptt-lead-h3-15.mp4'), face_sec: 7, ui_shot: true },
    { ...base15('h1_30', 'ptt-lead-h1-30.mp4'), duration_sec: 30, face_sec: 5.5 },
  ];
}

describe('LEAD_VIDEO_FILES', () => {
  it('locks the four pack filenames and face id', () => {
    expect(ADVISOR_FACE_ID).toBe('ptt-advisor-f-01');
    expect(LEAD_VIDEO_FILES).toEqual([
      { hook_id: 'h1', filename: 'ptt-lead-h1-15.mp4', duration_sec: 15 },
      { hook_id: 'h2', filename: 'ptt-lead-h2-15.mp4', duration_sec: 15 },
      { hook_id: 'h3', filename: 'ptt-lead-h3-15.mp4', duration_sec: 15 },
      { hook_id: 'h1_30', filename: 'ptt-lead-h1-30.mp4', duration_sec: 30 },
    ]);
  });
});

describe('evaluateLeadVideoFile', () => {
  it('passes a legal H1 15s file', () => {
    const report = evaluateLeadVideoFile(base15('h1', 'ptt-lead-h1-15.mp4'));
    expect(report.overall).toBe('passed');
    expect(report.checks.technical.result).toBe('passed');
    expect(report.checks.talent.result).toBe('passed');
  });

  it('blocks wrong resolution or duration outside ±0.2s', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), width: 720 }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'technical_not_9x16_1080' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), duration_sec: 15.5 }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'technical_duration' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), has_audio: false }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'missing_audio' });
  });

  it('blocks H1-30 unless duration is 30±0.2s', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1_30', 'ptt-lead-h1-30.mp4'), duration_sec: 15 }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'technical_duration' });
  });

  it('blocks unsafe caption zone and missing word spaces', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), safe_bottom_px: 200 }).checks.safe_area)
      .toEqual({ result: 'blocked', reason: 'safe_area_violated' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), caption_has_spaces: false }).checks.caption)
      .toEqual({ result: 'blocked', reason: 'caption_no_spaces' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), caption_top_third: false }).checks.caption)
      .toEqual({ result: 'blocked', reason: 'caption_not_top_third' });
  });

  it('blocks talent over 5.5s on 15s, wrong face, or founder claim', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), face_sec: 5.6 }).checks.talent)
      .toEqual({ result: 'blocked', reason: 'face_too_long' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), face_id: 'stock-ceo' }).checks.talent)
      .toEqual({ result: 'blocked', reason: 'face_id_mismatch' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), founder_claim: true }).checks.talent)
      .toEqual({ result: 'blocked', reason: 'founder_claim' });
  });

  it('allows H3 face_sec up to 7s (0-3 plus 11-15) and still requires a mid UI shot', () => {
    const ok = evaluateLeadVideoFile({ ...base15('h3', 'ptt-lead-h3-15.mp4'), face_sec: 7, ui_shot: true });
    expect(ok.checks.talent.result).toBe('passed');
    expect(evaluateLeadVideoFile({ ...base15('h3', 'ptt-lead-h3-15.mp4'), ui_shot: false }).checks.ui)
      .toEqual({ result: 'blocked', reason: 'ui_shot_missing' });
  });

  it('blocks missing UI on H1/H2/H1-30, call-only CTA, AI label, and fake CPL', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), ui_shot: false }).checks.ui)
      .toEqual({ result: 'blocked', reason: 'ui_shot_missing' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), cta_is_call_only: true, cta_is_form: false }).checks.cta)
      .toEqual({ result: 'blocked', reason: 'cta_call_only' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), ai_label_on_creative: true }).checks.copy)
      .toEqual({ result: 'blocked', reason: 'ai_label_on_creative' });
    expect(evaluateLeadVideoFile({
      ...base15('h1', 'ptt-lead-h1-15.mp4'),
      primary_text: 'CPL giam 40%',
      fake_cpl_claim: true,
    }).checks.claim).toEqual({ result: 'blocked', reason: 'fake_cpl_claim' });
    expect(evaluateLeadVideoFile({
      ...base15('h1', 'ptt-lead-h1-15.mp4'),
      primary_text: 'Hinh anh AI — de lai SDT',
    }).checks.copy).toEqual({ result: 'blocked', reason: 'ai_label_on_creative' });
  });

  it('blocks when internal flags are missing even though they stay off-canvas', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), ai_disclosure: false }).checks.internal)
      .toEqual({ result: 'blocked', reason: 'ai_disclosure_missing' });
  });

  it('blocks when filename does not match LEAD_VIDEO_FILES for that hook', () => {
    const report = evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h2-15.mp4') });
    expect(report.overall).toBe('blocked');
    expect(report.checks.filename).toEqual({ result: 'blocked', reason: 'filename_mismatch' });
  });
});

describe('evaluateLeadVideoPack / assertLeadVideoLaunchable', () => {
  it('passes the four-file pack and allows H1-30 to stay paused', () => {
    const pack = evaluateLeadVideoPack(passingPack());
    expect(pack.overall).toBe('passed');
    expect(() => assertLeadVideoLaunchable(pack, { require_h1_30: false })).not.toThrow();
  });

  it('allows wave-1 launch when only the three 15s files are present', () => {
    const pack = evaluateLeadVideoPack(passingPack().filter((f) => f.hook_id !== 'h1_30'));
    expect(pack.files.h1_30).toEqual({ overall: 'blocked', reason: 'missing_file' });
    expect(pack.overall).toBe('blocked');
    expect(() => assertLeadVideoLaunchable(pack, { require_h1_30: false })).not.toThrow();
  });

  it('blocks launch when any 15s file is missing', () => {
    const pack = evaluateLeadVideoPack(passingPack().filter((f) => f.hook_id !== 'h2'));
    expect(pack.files.h2).toEqual({ overall: 'blocked', reason: 'missing_file' });
    expect(pack.overall).toBe('blocked');
    expect(() => assertLeadVideoLaunchable(pack, { require_h1_30: false })).toThrow(
      expect.objectContaining({ error: 'pack_qc_blocked' }),
    );
  });

  it('does not overwrite facts.filename and blocks a mismatched pack file', () => {
    const pack = evaluateLeadVideoPack([
      { ...base15('h1', 'renamed-h1.mp4') },
      ...passingPack().filter((f) => f.hook_id !== 'h1'),
    ]);
    expect(pack.files.h1.overall).toBe('blocked');
    expect('checks' in pack.files.h1 && pack.files.h1.checks.filename).toEqual({
      result: 'blocked',
      reason: 'filename_mismatch',
    });
  });

  it('blocks scale when require_h1_30 and H1-30 is missing or failed', () => {
    const without30 = evaluateLeadVideoPack(passingPack().filter((f) => f.hook_id !== 'h1_30'));
    expect(() => assertLeadVideoLaunchable(without30, { require_h1_30: true })).toThrow(
      expect.objectContaining({ error: 'pack_qc_blocked' }),
    );
  });
});
