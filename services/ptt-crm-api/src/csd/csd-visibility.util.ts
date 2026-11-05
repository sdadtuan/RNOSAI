import type { CsdAttachmentVisibility } from './csd.types';

export function assertPublicAttachment(visibility: CsdAttachmentVisibility): void {
  if (visibility === 'internal') {
    throw new Error('Internal attachments cannot be included in public replies');
  }
}
