import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StaffAvatarStorage } from './staff-avatar.storage';

describe('StaffAvatarStorage', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-avatar-'));
    process.env.PTT_STAFF_AVATAR_STORAGE_ROOT = tmp;
  });

  afterEach(() => {
    delete process.env.PTT_STAFF_AVATAR_STORAGE_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('rejects path escape', () => {
    const s = new StaffAvatarStorage();
    expect(() => s.resolvePath('../etc/passwd')).toThrow('invalid_storage_key');
  });

  it('round-trips bytes', () => {
    const s = new StaffAvatarStorage();
    const userId = '11111111-1111-4111-8111-111111111111';
    const { storageKey } = s.save(userId, Buffer.from('abc'), 'image/png');
    expect(s.read(storageKey)?.equals(Buffer.from('abc'))).toBe(true);
    s.remove(storageKey);
    expect(s.read(storageKey)).toBeNull();
  });
});
