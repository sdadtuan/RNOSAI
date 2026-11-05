import { evaluateDomainQc } from './cp-qc-packs.util';
import { ADVISOR_FACE_ID } from './ptt-fb-lead-video-qc.util';

const GENERIC_PASS = {
  width: 1080,
  height: 1920,
  duration_sec: 15,
  has_audio: true,
  safe_area_ok: true,
  caption_overflow: false,
  logo_present: true,
  cta_present: true,
  disclaimer_present: true,
  loudness_lufs: -14,
  black_frozen: false,
  moderation: 'ok',
};

describe('cp-qc-packs.util', () => {
  describe('bds_social', () => {
    it('passes when caption uses price-from wording and no banned phrase', () => {
      const report = evaluateDomainQc('bds_social', {
        ...GENERIC_PASS,
        caption: 'Căn hộ The Peak từ 3.2 tỷ — liên hệ hotline',
        project_id: '42',
        image_project_id: '42',
      });
      expect(report.domain_checks?.banned_phrase.result).toBe('passed');
      expect(report.overall).toBe('passed');
    });

    it('blocks when banned phrase appears in script', () => {
      const report = evaluateDomainQc('bds_social', {
        ...GENERIC_PASS,
        script_text: 'Chúng tôi cam kết doanh số 200 căn',
      });
      expect(report.domain_checks?.banned_phrase.result).toBe('blocked');
      expect(report.overall).toBe('blocked');
    });
  });

  describe('lead_social', () => {
    const leadPass = {
      hook_id: 'h1' as const,
      filename: 'ptt-lead-h1-15.mp4',
      width: 1080,
      height: 1920,
      duration_sec: 15,
      has_audio: true,
      face_sec: 4.5,
      face_id: ADVISOR_FACE_ID,
      founder_claim: false,
      ui_shot: true,
      caption_has_spaces: true,
      caption_top_third: true,
      safe_top_px: 120,
      safe_bottom_px: 300,
      logo_present: true,
      cta_is_form: true,
      cta_is_call_only: false,
      ai_label_on_creative: false,
      fake_cpl_claim: false,
      contains_human: true,
      ai_disclosure: true,
      primary_text: 'Ngân sách chạy. Inbox im.',
    };

    it('passes with valid lead file facts', () => {
      const report = evaluateDomainQc('lead_social', {
        ...GENERIC_PASS,
        lead_video: leadPass,
      });
      expect(report.domain_checks?.lead_overall.result).toBe('passed');
      expect(report.overall).toBe('passed');
    });

    it('blocks when form CTA is missing', () => {
      const report = evaluateDomainQc('lead_social', {
        ...GENERIC_PASS,
        lead_video: { ...leadPass, cta_is_form: false, cta_is_call_only: true },
      });
      expect(report.domain_checks?.lead_cta.result).toBe('blocked');
      expect(report.overall).toBe('blocked');
    });
  });

  describe('tvc_short', () => {
    it('passes when claim exists and legal approved', () => {
      const report = evaluateDomainQc('tvc_short', {
        ...GENERIC_PASS,
        width: 1920,
        height: 1080,
        has_claim: true,
        legal_approved: true,
        logo_present: true,
      });
      expect(report.domain_checks?.legal_claim.result).toBe('passed');
      expect(report.overall).toBe('passed');
    });

    it('blocks when claim exists without legal approval', () => {
      const report = evaluateDomainQc('tvc_short', {
        ...GENERIC_PASS,
        width: 1920,
        height: 1080,
        has_claim: true,
        legal_approved: false,
      });
      expect(report.domain_checks?.legal_claim.result).toBe('blocked');
      expect(report.overall).toBe('blocked');
    });
  });
});
