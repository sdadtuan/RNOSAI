import { describe, expect, it } from 'vitest';
import { mapStringeeSignalingCode } from './stringee-signaling.util';

describe('mapStringeeSignalingCode', () => {
  it('maps ringing and connected states', () => {
    expect(mapStringeeSignalingCode(1)).toBe('connecting');
    expect(mapStringeeSignalingCode(2)).toBe('ringing');
    expect(mapStringeeSignalingCode(3)).toBe('in_call');
    expect(mapStringeeSignalingCode(4)).toBe('in_call');
    expect(mapStringeeSignalingCode(5)).toBe('busy');
    expect(mapStringeeSignalingCode(6)).toBe('ended');
  });

  it('returns null for unknown codes', () => {
    expect(mapStringeeSignalingCode(0)).toBeNull();
    expect(mapStringeeSignalingCode(99)).toBeNull();
  });
});
