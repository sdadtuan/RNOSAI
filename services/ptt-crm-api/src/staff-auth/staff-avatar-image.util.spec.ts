import { assertStaffAvatarUpload } from './staff-avatar-image.util';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('assertStaffAvatarUpload', () => {
  it('accepts small png', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: PNG, mimetype: 'image/png', size: PNG.length }),
    ).not.toThrow();
  });

  it('rejects svg', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: SVG, mimetype: 'image/svg+xml', size: SVG.length }),
    ).toThrow('invalid_image');
  });

  it('rejects png mime with svg bytes', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: SVG, mimetype: 'image/png', size: SVG.length }),
    ).toThrow('invalid_image');
  });

  it('rejects over 1MB', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: PNG, mimetype: 'image/png', size: 1_000_001 }),
    ).toThrow('file_too_large');
  });

  it('rejects empty', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: Buffer.alloc(0), mimetype: 'image/png', size: 0 }),
    ).toThrow('file_required');
  });
});
