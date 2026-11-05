const MAX_AVATAR_BYTES = 1_000_000;

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export type StaffAvatarUploadInput = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

export function assertStaffAvatarUpload(file: StaffAvatarUploadInput): void {
  if (!file.buffer?.length || file.size <= 0) {
    throw new Error('file_required');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('file_too_large');
  }
  const mime = (file.mimetype ?? '').trim().toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    throw new Error('invalid_image');
  }
  if (!magicMatchesMime(file.buffer, mime)) {
    throw new Error('invalid_image');
  }
}

function magicMatchesMime(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

export function avatarExtForMime(mime: string): 'jpg' | 'png' | 'webp' {
  const m = mime.trim().toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  return 'jpg';
}

export function contentTypeForAvatarExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}
