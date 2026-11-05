import { afterEach, describe, expect, it } from 'vitest';
import { isLeadPipelineTabEnabled } from './lead-pipeline-flags';

describe('lead-pipeline-flags', () => {
  const prev = process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB;
  afterEach(() => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = prev;
  });

  it('returns false when unset', () => {
    delete process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB;
    expect(isLeadPipelineTabEnabled()).toBe(false);
  });

  it('returns false when 0', () => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = '0';
    expect(isLeadPipelineTabEnabled()).toBe(false);
  });

  it('returns true when 1', () => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = '1';
    expect(isLeadPipelineTabEnabled()).toBe(true);
  });
});
