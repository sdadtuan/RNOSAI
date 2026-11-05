import { describe, expect, it } from 'vitest';
import { buildIntakeAnswersPatch } from './intake-answers';
import { emptyDiscoveryForMode } from './intake-discovery';
import { emptyRedFlags } from './intake-red-flags';
import { emptyWinIntel, mergeWinIntelPatch, parseWinIntel } from './intake-win-intel';

describe('parseWinIntel', () => {
  it('fills four keys', () => {
    const w = parseWinIntel({
      win_intel: { incumbent: { answer: 'Agency A', confidence: 'heard' } },
    });
    expect(w.incumbent.answer).toBe('Agency A');
    expect(w.competitor.answer).toBe('');
  });
});

describe('mergeWinIntelPatch', () => {
  it('keeps discovery when merging', () => {
    const out = mergeWinIntelPatch({ crm_fields: { need: 'x' } }, {
      ...emptyWinIntel(),
      incumbent: { answer: 'A', confidence: 'confirmed' },
    });
    expect((out.crm_fields as { need: string }).need).toBe('x');
    expect((out.win_intel as { incumbent: { answer: string } }).incumbent.answer).toBe('A');
  });
});

describe('buildIntakeAnswersPatch', () => {
  it('merges win_intel last and keeps qualify_checked', () => {
    const out = buildIntakeAnswersPatch({
      existing: { crm_fields: { need: 'old' } },
      need: 'new',
      discovery: emptyDiscoveryForMode('phone'),
      redFlags: emptyRedFlags(),
      winIntel: { ...emptyWinIntel(), incumbent: { answer: 'A', confidence: 'confirmed' } },
      qualifyChecked: { nganh: true },
    });
    expect((out.qualify_checked as { nganh: boolean }).nganh).toBe(true);
    expect((out.win_intel as { incumbent: { answer: string } }).incumbent.answer).toBe('A');
  });

  it('persists bant_checklist scores', () => {
    const out = buildIntakeAnswersPatch({
      existing: {},
      need: 'x',
      discovery: emptyDiscoveryForMode('phone'),
      redFlags: emptyRedFlags(),
      winIntel: emptyWinIntel(),
      bantChecklist: { budget: 4, need: 5 },
    });
    expect(out.bant_checklist).toEqual({
      budget: 4,
      authority: 0,
      need: 5,
      timeline: 0,
      fit: 0,
      history: 0,
    });
  });

  it('persists win_checklist and win_score_json', () => {
    const out = buildIntakeAnswersPatch({
      existing: {},
      need: 'x',
      discovery: emptyDiscoveryForMode('phone'),
      redFlags: emptyRedFlags(),
      winIntel: emptyWinIntel(),
      winChecklist: { incumbent: 4 },
    });
    expect(out.win_checklist).toEqual({
      incumbent: 4,
      competitor: 0,
      selection_criteria: 0,
      switch_risk: 0,
      champion: 0,
      next_step: 0,
    });
    expect(out.win_score_json).toEqual(out.win_checklist);
  });
});
