import { CP_PLAYBOOKS, getPlaybook, listPlaybooks } from './cp-playbook.registry';
import { CP_PLAYBOOK_IDS } from './cp-playbook.types';

describe('cp-playbook.registry', () => {
  it('lists exactly three Phase A playbooks', () => {
    const items = listPlaybooks();
    expect(items).toHaveLength(3);
    expect(items.map((row) => row.id).sort()).toEqual([...CP_PLAYBOOK_IDS].sort());
  });

  it('each playbook has qc_pack and template_slug', () => {
    for (const id of CP_PLAYBOOK_IDS) {
      const playbook = CP_PLAYBOOKS[id];
      expect(playbook.qc_pack).toBeTruthy();
      expect(playbook.template_slug).toBeTruthy();
      expect(playbook.vars.length).toBeGreaterThan(0);
    }
  });

  it('getPlaybook returns detail for known id', () => {
    expect(getPlaybook('lead_social_916')).toMatchObject({
      id: 'lead_social_916',
      qc_pack: 'lead_social',
      template_slug: 'lead-social-916',
    });
  });

  it('getPlaybook throws for unknown id', () => {
    expect(() => getPlaybook('unknown_playbook')).toThrow(expect.objectContaining({ status: 404 }));
  });
});
