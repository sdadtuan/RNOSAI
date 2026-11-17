import {
  LEAD_HIDDEN_CONTACT_STATUS,
  LEAD_LOCKED_CONTACT_STATUS,
  leadLockKindSql,
  leadLockedSql,
  leadNotLockedSql,
} from './lead-lock.util';

describe('lead lock sql', () => {
  it('treats Sai số and Ẩn lead as locked, and everything else as visible', () => {
    const locked = leadLockedSql('l');
    const visible = leadNotLockedSql('l');
    expect(locked).toContain(LEAD_LOCKED_CONTACT_STATUS);
    expect(locked).toContain(LEAD_HIDDEN_CONTACT_STATUS);
    expect(visible).toContain('NOT IN');
    expect(visible).toContain(LEAD_HIDDEN_CONTACT_STATUS);
    expect(leadLockKindSql('l')).toContain("THEN 'hidden'");
    expect(leadLockKindSql('l')).toContain("THEN 'wrong_number'");
  });
});
