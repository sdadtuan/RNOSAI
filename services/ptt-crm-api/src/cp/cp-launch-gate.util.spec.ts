import {
  buildCpCreativeDescription,
  parseCpVersionIdFromDescription,
  requiresCpQcForTemplate,
} from './cp-launch-gate.util';

describe('cp-launch-gate.util', () => {
  it('builds and parses cp_version description links', () => {
    const versionId = '11111111-1111-4111-8111-111111111111';
    const description = buildCpCreativeDescription(versionId);
    expect(parseCpVersionIdFromDescription(description)).toBe(versionId);
  });

  it('requires QC for re_lead_default template only', () => {
    expect(requiresCpQcForTemplate('re_lead_default')).toBe(true);
    expect(requiresCpQcForTemplate('re_traffic_warm')).toBe(false);
  });
});
