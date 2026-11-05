import { describe, expect, it } from 'vitest';
import { CP_NAV } from './cp-nav.util';
import { CP_IMAGE_NAV, cpImageActiveNavId, visibleCpNav } from './cp-image-sop-nav.util';

describe('CP_IMAGE_NAV', () => {
  it('has 11 subnav items matching mockup', () => {
    expect(CP_IMAGE_NAV).toHaveLength(11);
    expect(CP_IMAGE_NAV.map((item) => item.screen)).toEqual([
      'IMG-01',
      'IMG-02',
      'IMG-03',
      'IMG-04',
      'IMG-05',
      'IMG-06',
      'IMG-07',
      'IMG-08',
      'IMG-09',
      'IMG-10',
      'IMG-11',
    ]);
  });
});

describe('visibleCpNav', () => {
  it('hides Ảnh SOP when flag off', () => {
    expect(
      visibleCpNav({ items: CP_NAV, imageEnabled: false, canImgView: true }).some(
        (item) => item.id === 'image',
      ),
    ).toBe(false);
  });

  it('hides Ảnh SOP when cap missing', () => {
    expect(
      visibleCpNav({ items: CP_NAV, imageEnabled: true, canImgView: false }).some(
        (item) => item.id === 'image',
      ),
    ).toBe(false);
  });

  it('places Ảnh SOP after Video AI', () => {
    const ids = visibleCpNav({ items: CP_NAV, imageEnabled: true, canImgView: true }).map(
      (item) => item.id,
    );
    expect(ids.indexOf('image')).toBe(ids.indexOf('video') + 1);
  });
});

describe('cpImageActiveNavId', () => {
  it('maps nested routes to subnav ids', () => {
    expect(cpImageActiveNavId('/crm/creative-os/image/jobs')).toBe('jobs');
    expect(cpImageActiveNavId('/crm/creative-os/image/sops/new')).toBe('composer');
    expect(cpImageActiveNavId('/crm/creative-os/image/review/asset-1')).toBe('review');
  });
});
