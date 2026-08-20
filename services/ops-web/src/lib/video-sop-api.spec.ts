import { describe, expect, it } from 'vitest';
import { type StoredStaffUser } from './auth';
import {
  canEditVdBrief,
  canEnqueueVdJob,
  vdAdminModelsPath,
  vdAdminProvidersPath,
  vdProjectBriefInsightsPath,
  vdProjectBriefPath,
  vdProjectBriefReadyPath,
  vdProjectCreatePath,
  vdProjectGetPath,
  vdProjectJobsPath,
} from './video-sop-api';

function staff(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('video-sop-api path helpers', () => {
  it('vdProjectCreatePath is POST collection', () => {
    expect(vdProjectCreatePath()).toBe('/api/v1/vd/projects');
  });

  it('vdProjectGetPath interpolates id', () => {
    expect(vdProjectGetPath(7)).toBe('/api/v1/vd/projects/7');
  });

  it('vdProjectJobsPath interpolates id', () => {
    expect(vdProjectJobsPath(7)).toBe('/api/v1/vd/projects/7/jobs');
  });

  it('vdAdminProvidersPath is admin collection', () => {
    expect(vdAdminProvidersPath()).toBe('/api/v1/vd/admin/providers');
  });

  it('vdAdminModelsPath is admin collection', () => {
    expect(vdAdminModelsPath()).toBe('/api/v1/vd/admin/models');
  });

  it('vdProjectBriefPath interpolates id', () => {
    expect(vdProjectBriefPath(7)).toBe('/api/v1/vd/projects/7/brief');
  });

  it('vdProjectBriefReadyPath interpolates id', () => {
    expect(vdProjectBriefReadyPath(7)).toBe('/api/v1/vd/projects/7/brief/ready');
  });

  it('vdProjectBriefInsightsPath interpolates id', () => {
    expect(vdProjectBriefInsightsPath(7)).toBe('/api/v1/vd/projects/7/brief/insights');
  });
});

describe('canEditVdBrief (same as API PUT/ready)', () => {
  it('allows crm_vd.project edit', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_vd.project', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies view-only crm_vd.project', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_vd.project', action: 'view' }]))).toBe(false);
  });

  it('denies create-only crm_vd.project', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_vd.project', action: 'create' }]))).toBe(false);
  });

  it('denies null user', () => {
    expect(canEditVdBrief(null)).toBe(false);
  });
});

describe('canEnqueueVdJob (same as API POST)', () => {
  it('allows crm_vd.project create', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_vd.project', action: 'create' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies view-only crm_vd.project', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_vd.project', action: 'view' }]))).toBe(false);
  });

  it('denies view-only crm_content', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_content', action: 'view' }]))).toBe(false);
  });

  it('denies null user', () => {
    expect(canEnqueueVdJob(null)).toBe(false);
  });
});
