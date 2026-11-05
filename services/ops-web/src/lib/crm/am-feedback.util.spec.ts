import { describe, expect, it } from 'vitest';
import {
  amFeedbackCsdHref,
  amFeedbackDash,
  amFeedbackKindLabel,
  amShouldCreateCsatTask,
} from './am-feedback.util';

describe('amFeedbackDash', () => {
  it('shows an em dash when there is no data', () => {
    expect(amFeedbackDash(null)).toBe('—');
    expect(amFeedbackDash(undefined)).toBe('—');
    expect(amFeedbackDash('')).toBe('—');
  });

  it('stringifies numeric tile values', () => {
    expect(amFeedbackDash(4.2)).toBe('4.2');
  });
});

describe('amShouldCreateCsatTask', () => {
  it('creates a task at the default threshold of 3 and not above', () => {
    expect(amShouldCreateCsatTask(3)).toBe(true);
    expect(amShouldCreateCsatTask(4)).toBe(false);
    expect(amShouldCreateCsatTask(null)).toBe(false);
  });
});

describe('amFeedbackCsdHref', () => {
  it('is a deep-link only — never a resolve action', () => {
    expect(amFeedbackCsdHref('19d722af-0000-4000-8000-0000000000cd')).toBe(
      '/crm/csd/tickets/19d722af-0000-4000-8000-0000000000cd',
    );
    expect(amFeedbackCsdHref(null)).toBeNull();
  });
});

describe('amFeedbackKindLabel', () => {
  it('labels known kinds and dashes unknown', () => {
    expect(amFeedbackKindLabel('csat')).toBe('CSAT');
    expect(amFeedbackKindLabel('complaint')).toBe('Complaint');
    expect(amFeedbackKindLabel('')).toBe('—');
  });
});
