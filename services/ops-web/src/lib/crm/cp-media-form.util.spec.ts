import { describe, expect, it } from 'vitest';
import {
  agencyClientSearchOptions,
  buildCpRightsInput,
  clientIdFromProject,
  filterProjectsForClient,
  parseCpFinalizeInput,
  type CpRightsDraft,
} from './cp-media-form.util';

describe('parseCpFinalizeInput', () => {
  it('rejects missing finalize bytes before any request can be made', () => {
    expect(() => parseCpFinalizeInput(true, '', 'sha256')).toThrow('bytes_required');
  });

  it('rejects missing finalize hash before any request can be made', () => {
    expect(() => parseCpFinalizeInput(true, '12', '')).toThrow('hash_required');
  });

  it('returns null when finalize is disabled', () => {
    expect(parseCpFinalizeInput(false, '', '')).toBeNull();
  });
});

describe('buildCpRightsInput', () => {
  const current = {
    license_type: 'licensed',
    owner_name: 'PTT',
    effective_on: '2026-01-01',
    expiry_on: '2026-12-31',
    territory: ['VN'],
    channels: ['social'],
    restriction: 'organic only',
    model_release: true,
    talent_release: null,
    proof_asset_id: null,
  };

  it('preserves prefilled rights and omits untouched blank fields', () => {
    const draft: CpRightsDraft = {
      license_type: 'licensed',
      owner_name: 'PTT',
      effective_on: '2026-01-01',
      expiry_on: '2026-12-31',
      territory: 'VN',
      channels: 'social',
      restriction: 'organic only',
      proof_asset_id: '',
      model_release: true,
      talent_release: false,
      model_release_touched: false,
      talent_release_touched: false,
    };

    expect(buildCpRightsInput(current, draft)).toEqual({
      license_type: 'licensed',
      owner_name: 'PTT',
      effective_on: '2026-01-01',
      expiry_on: '2026-12-31',
      territory: ['VN'],
      channels: ['social'],
      restriction: 'organic only',
      model_release: true,
    });
  });

  it('sends a toggled checkbox while preserving the other nullable boolean', () => {
    const draft: CpRightsDraft = {
      license_type: 'licensed',
      owner_name: 'PTT',
      effective_on: '2026-01-01',
      expiry_on: '2026-12-31',
      territory: 'VN',
      channels: 'social',
      restriction: 'organic only',
      proof_asset_id: '',
      model_release: false,
      talent_release: true,
      model_release_touched: true,
      talent_release_touched: true,
    };

    expect(buildCpRightsInput(current, draft)).toMatchObject({
      model_release: false,
      talent_release: true,
    });
  });
});

describe('ingest Agency / Project search', () => {
  it('maps agency clients to searchable name options, never a raw empty id', () => {
    expect(agencyClientSearchOptions([
      { id: 'c1', name: 'PTT-HCM' },
      { id: '  ', name: 'skip' },
      { id: 'c2', name: null },
    ])).toEqual([
      { value: 'c1', label: 'PTT-HCM' },
      { value: 'c2', label: 'c2' },
    ]);
  });

  it('filters CP projects by selected agency client and can recover client from project', () => {
    const projects = [
      { id: 'p1', agency_client_id: 'c1', name: 'Reels Q3' },
      { id: 'p2', agency_client_id: 'c2', name: 'TVC' },
    ];
    expect(filterProjectsForClient(projects, '')).toHaveLength(2);
    expect(filterProjectsForClient(projects, 'c1').map((row) => row.id)).toEqual(['p1']);
    expect(clientIdFromProject(projects, 'p2')).toBe('c2');
    expect(clientIdFromProject(projects, 'missing')).toBeNull();
  });
});
