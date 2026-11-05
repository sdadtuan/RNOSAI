import { hasCapOnParentOrChild, MSOS_CHILD_SECTIONS } from './rbac-cap-bridge.util';

describe('hasCapOnParentOrChild', () => {
  it('accepts parent cap', () => {
    expect(
      hasCapOnParentOrChild([{ section: 'crm_media', action: 'view' }], 'crm_media', 'view', MSOS_CHILD_SECTIONS),
    ).toBe(true);
  });

  it('accepts child cap when parent missing', () => {
    expect(
      hasCapOnParentOrChild(
        [{ section: 'crm_media.inventory', action: 'write' }],
        'crm_media',
        'write',
        MSOS_CHILD_SECTIONS,
      ),
    ).toBe(true);
  });

  it('denies unrelated cap', () => {
    expect(
      hasCapOnParentOrChild([{ section: 'crm_board', action: 'view' }], 'crm_media', 'view', MSOS_CHILD_SECTIONS),
    ).toBe(false);
  });
});
