import {
  buildScenesFromPlaybook,
  regenerateScene,
} from './cp-playbook-script.engine';

describe('cp-playbook-script.engine', () => {
  it('lead H1 produces five scenes with hook beat', () => {
    const scenes = buildScenesFromPlaybook('lead_social_916', {
      hook_id: 'h1',
      offer: 'PTT audit CPL',
    });
    expect(scenes).toHaveLength(5);
    expect(scenes[0]).toMatchObject({
      idx: 0,
      beat: 'hook',
      overlay: 'Bạn đang trả tiền cho click.',
    });
    expect(scenes[4].beat).toBe('cta');
  });

  it('bds social produces four beats with price and CTA', () => {
    const scenes = buildScenesFromPlaybook('bds_social_916', {
      project_name: 'The Peak',
      price_from: 'từ 3.2 tỷ',
      location: 'Quận 7',
      hotline: '19001234',
      cta: 'Đăng ký tư vấn',
    });
    expect(scenes).toHaveLength(4);
    expect(scenes[0].visual).toContain('The Peak');
    expect(scenes[3].vo).toContain('19001234');
  });

  it('regenerate keeps locked overlay unchanged', () => {
    const regenerated = regenerateScene(
      'lead_social_916',
      0,
      { hook_id: 'h1' },
      { locked: true, overlay: 'LOCKED CAPTION', visual: 'old', vo: 'old vo' },
    );
    expect(regenerated.overlay).toBe('LOCKED CAPTION');
    expect(regenerated.vo).toBe('old vo');
    expect(regenerated.visual).toBe('old');
  });

  it('regenerate updates unlocked scene fields', () => {
    const regenerated = regenerateScene(
      'bds_social_916',
      0,
      { project_name: 'Sunrise Tower', price_from: 'từ 2 tỷ' },
      { locked: false },
    );
    expect(regenerated.visual).toContain('Sunrise Tower');
    expect(regenerated.overlay).toContain('Sunrise Tower');
  });
});
