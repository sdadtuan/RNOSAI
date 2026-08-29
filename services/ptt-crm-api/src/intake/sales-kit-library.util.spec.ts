import {
  folderKeyOk,
  playbookSlugForFolder,
  sessionFolderKey,
  salesKitFileTooLarge,
} from './sales-kit-library.util';

describe('sales-kit-library.util', () => {
  it('accepts org qa folder and rejects path escape', () => {
    expect(folderKeyOk('dich-vu-seo-tong-the/qa')).toBe(true);
    expect(folderKeyOk('dich-vu-seo-tong-the/qa/bds')).toBe(true);
    expect(folderKeyOk('../etc')).toBe(false);
    expect(folderKeyOk('SEO/qa')).toBe(false);
    expect(folderKeyOk('a/b/c/d')).toBe(false);
  });

  it('maps folder and session slugs', () => {
    expect(playbookSlugForFolder('dich-vu-seo-tong-the/qa')).toBe('sk-dich-vu-seo-tong-the-qa');
    expect(sessionFolderKey(5, 12)).toBe('session/5/12');
    expect(playbookSlugForFolder('session/5/12')).toBe('sk-session-5-12');
  });

  it('enforces size caps', () => {
    expect(salesKitFileTooLarge('application/pdf', 8 * 1024 * 1024 + 1)).toBe(true);
    expect(salesKitFileTooLarge('image/png', 4 * 1024 * 1024)).toBe(false);
  });
});
