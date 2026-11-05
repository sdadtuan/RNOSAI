import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { avatarExtForMime } from './staff-avatar-image.util';

@Injectable()
export class StaffAvatarStorage {
  private readonly logger = new Logger(StaffAvatarStorage.name);

  get rootDir(): string {
    const custom = (process.env.PTT_STAFF_AVATAR_STORAGE_ROOT ?? '').trim();
    if (custom) return path.resolve(custom);
    return path.resolve(process.cwd(), 'data/staff-avatars');
  }

  save(userId: string, buffer: Buffer, mime: string): { storageKey: string } {
    const ext = avatarExtForMime(mime);
    const storageKey = `${userId}/${randomUUID()}.${ext}`;
    const filePath = this.resolvePath(storageKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return { storageKey };
  }

  read(storageKey: string): Buffer | null {
    try {
      const filePath = this.resolvePath(storageKey);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    } catch {
      return null;
    }
  }

  remove(storageKey: string): void {
    try {
      const filePath = this.resolvePath(storageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      this.logger.warn(
        `remove failed ${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  resolvePath(storageKey: string): string {
    const normalized = storageKey.replace(/^\/+/, '');
    const filePath = path.resolve(this.rootDir, normalized);
    if (!filePath.startsWith(this.rootDir)) {
      throw new Error('invalid_storage_key');
    }
    return filePath;
  }
}
