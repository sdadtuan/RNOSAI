import { describe, expect, it } from 'vitest';
import { CP_CREDIT_FOOTER_LABEL, CP_FILTER_PRESETS, CP_SUBTITLES } from './cp-copy';

describe('cp-copy', () => {
  it('locks OVR subtitles', () => {
    expect(CP_SUBTITLES.ovrDashboard).toContain('OVR-01');
    expect(CP_SUBTITLES.ovrActions).toContain('FR-OVR-003');
  });

  it('locks filter presets', () => {
    expect(CP_FILTER_PRESETS.last30Days).toBe('30 ngày');
    expect(CP_FILTER_PRESETS.clientAll).toBe('Khách: Tất cả');
  });

  it('locks credit footer label', () => {
    expect(CP_CREDIT_FOOTER_LABEL).toBe('Credit PTT');
  });
});
