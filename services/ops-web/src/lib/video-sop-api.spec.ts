import { afterEach, describe, expect, it, vi } from 'vitest';
import { type StoredStaffUser } from './auth';
import {
  canEditVdBrief,
  canEditVdScript,
  canEnqueueVdJob,
  saveVdScript,
  vdAdminModelsPath,
  vdAdminProvidersPath,
  vdProjectBriefInsightsPath,
  vdProjectBriefPath,
  vdProjectBriefReadyPath,
  vdProjectCreatePath,
  vdProjectGetPath,
  vdProjectIdeasGeneratePath,
  vdProjectIdeasPath,
  vdProjectJobsPath,
  vdProjectScriptsPath,
  vdPromptTemplatesPath,
  vdScriptShotsPath,
  sc04AddShotPayload,
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

  it('vdProjectIdeasPath interpolates id', () => {
    expect(vdProjectIdeasPath(7)).toBe('/api/v1/vd/projects/7/ideas');
  });

  it('vdProjectIdeasGeneratePath interpolates id', () => {
    expect(vdProjectIdeasGeneratePath(7)).toBe('/api/v1/vd/projects/7/ideas/generate');
  });

  it('vdProjectScriptsPath interpolates id', () => {
    expect(vdProjectScriptsPath(7)).toBe('/api/v1/vd/projects/7/scripts');
  });

  it('vdScriptShotsPath interpolates id', () => {
    expect(vdScriptShotsPath(3)).toBe('/api/v1/vd/scripts/3/shots');
  });

  it('vdPromptTemplatesPath is collection', () => {
    expect(vdPromptTemplatesPath()).toBe('/api/v1/vd/prompt-templates');
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

describe('canEditVdScript (same as API ideas/script/shots)', () => {
  it('allows crm_vd.script edit', () => {
    expect(canEditVdScript(staff([{ section: 'crm_vd.script', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_vd.project edit', () => {
    expect(canEditVdScript(staff([{ section: 'crm_vd.project', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEditVdScript(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies view-only crm_vd.script', () => {
    expect(canEditVdScript(staff([{ section: 'crm_vd.script', action: 'view' }]))).toBe(false);
  });

  it('denies null user', () => {
    expect(canEditVdScript(null)).toBe(false);
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

describe('sc04AddShotPayload', () => {
  it('includes contains_human as boolean false so FR-R03 can pass', () => {
    const payload = sc04AddShotPayload({
      duration_ms: 3000,
      camera: 'wide',
      action: 'pan left',
      aspect: '9:16',
    });
    expect(typeof payload.contains_human).toBe('boolean');
    expect(payload.contains_human).toBe(false);
    expect(payload.text_in_frame).toBe(false);
    expect(payload.logo_in_ai_frame).toBe(false);
    expect(payload.duration_ms).toBe(3000);
    expect(payload.camera).toBe('wide');
    expect(payload.action).toBe('pan left');
    expect(payload.aspect).toBe('9:16');
  });
});

describe('saveVdScript', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PUTs markdown to project scripts path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ id: 10, project_id: 7, version: 1, markdown: 'hi' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await saveVdScript('tok', 7, 'hi');

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/v1/vd/projects/7/scripts');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ markdown: 'hi' }));
  });
});
