import { describe, expect, it } from 'vitest';
import {
  canShowPublicationQueueCta,
  formatChannelHealthLabel,
  PUBLICATIONS_EMPTY,
} from './cmkte-publications';

describe('canShowPublicationQueueCta', () => {
  it('hides Vào queue on Blocked gate rows', () => {
    expect(canShowPublicationQueueCta('Blocked')).toBe(false);
    expect(canShowPublicationQueueCta('Pass')).toBe(true);
    expect(canShowPublicationQueueCta('Warning')).toBe(true);
    expect(canShowPublicationQueueCta(null)).toBe(true);
  });
});

describe('publication empty copy', () => {
  it('uses Vietnamese empty when there are no slots', () => {
    expect(PUBLICATIONS_EMPTY).toBe('Chưa có lịch xuất bản.');
  });
});

describe('formatChannelHealthLabel', () => {
  it('shows Facebook health from the API and em dash otherwise', () => {
    expect(formatChannelHealthLabel('Manual')).toBe('Manual');
    expect(formatChannelHealthLabel('TokenExpired')).toBe('Token expiry');
    expect(formatChannelHealthLabel('Connected')).toBe('Connected');
    expect(formatChannelHealthLabel(null)).toBe('—');
    expect(formatChannelHealthLabel(undefined)).toBe('—');
    expect(formatChannelHealthLabel('')).toBe('—');
  });
});
