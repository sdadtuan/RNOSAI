import { describe, expect, it } from 'vitest';
import {
  defaultPlaybookSlug,
  orderPlaybooksForSelector,
} from '@/lib/mkt-ai-playbook-selector.util';

const rows = [
  { slug: 'seo-retainer', label_vi: 'SEO retainer', quality_gate: { min_score_launch_qa: 70 } },
  { slug: '_common', label_vi: 'Playbook chung', quality_gate: { min_score_launch_qa: 70 } },
  { slug: 'meta-lead-gen', label_vi: 'Meta lead gen', quality_gate: { min_score_launch_qa: 70 } },
];

describe('orderPlaybooksForSelector', () => {
  it('puts _common first then service slug match', () => {
    const out = orderPlaybooksForSelector(rows, 'meta-lead-gen');
    expect(out.map((p) => p.slug)).toEqual(['_common', 'meta-lead-gen', 'seo-retainer']);
  });

  it('keeps _common first for unknown service slug', () => {
    const out = orderPlaybooksForSelector(rows, 'quang-cao-facebook');
    expect(out[0]?.slug).toBe('_common');
    expect(out.map((p) => p.slug)).toContain('meta-lead-gen');
  });
});

describe('defaultPlaybookSlug', () => {
  it('prefers active_slug when set', () => {
    expect(
      defaultPlaybookSlug({ active_slug: 'seo-retainer', playbooks: rows }, 'meta-lead-gen'),
    ).toBe('seo-retainer');
  });

  it('falls back to _common when service slug has no industry playbook', () => {
    expect(defaultPlaybookSlug({ active_slug: null, playbooks: rows }, 'quang-cao-facebook')).toBe(
      '_common',
    );
  });
});
