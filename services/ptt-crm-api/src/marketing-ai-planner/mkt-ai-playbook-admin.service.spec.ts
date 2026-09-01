import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MktAiPlaybookAdminService } from './mkt-ai-playbook-admin.service';
import { MktAiPlaybookLearnService } from './mkt-ai-playbook-learn.service';
import { MktAiPlaybookVersionsRepository } from './mkt-ai-playbook-versions.repository';
import { MktAiServicePolicyRepository } from './mkt-ai-service-policy.repository';

describe('MktAiPlaybookAdminService activate', () => {
  const config = { opsRouteMapPath: '' } as AppConfigService;
  const policyRepo = {
    listPolicyRows: jest.fn().mockResolvedValue([]),
    getPolicyRow: jest.fn(),
    upsertPolicy: jest.fn(),
  };
  const versionsRepo = {
    getVersion: jest.fn(),
    activateVersion: jest.fn(),
    listVersionsBySlug: jest.fn(),
    getActiveVersion: jest.fn(),
    listLearnJobsBySlug: jest.fn(),
  };
  const learnService = {
    loadCorpusRows: jest.fn().mockResolvedValue([]),
  };

  const service = new MktAiPlaybookAdminService(
    config,
    policyRepo as unknown as MktAiServicePolicyRepository,
    versionsRepo as unknown as MktAiPlaybookVersionsRepository,
    learnService as unknown as MktAiPlaybookLearnService,
  );

  const approvedVersion = {
    id: 10,
    service_slug: 'meta-lead-gen',
    version_no: 2,
    status: 'approved' as const,
    depth: 'deep' as const,
    document_json: {},
    source: 'learn' as const,
    learn_job_id: 1,
    corpus_json: {},
    created_by: 'ai-job-actor',
    reviewed_by: 'lead@test.vn',
    reviewed_at: '2026-09-01T00:00:00Z',
    review_note: 'ok',
    created_at: '2026-09-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    versionsRepo.getVersion.mockResolvedValue(approvedVersion);
    versionsRepo.activateVersion.mockResolvedValue({ ...approvedVersion, status: 'active' });
  });

  it('activates approved version with separate reviewer', async () => {
    const out = await service.activateVersion(10, {}, 'lead@test.vn');
    expect(out.ok).toBe(true);
    expect(versionsRepo.activateVersion).toHaveBeenCalledWith(
      10,
      'meta-lead-gen',
      'lead@test.vn',
      'ok',
    );
  });

  it('rejects draft status', async () => {
    versionsRepo.getVersion.mockResolvedValue({ ...approvedVersion, status: 'draft' });
    await expect(service.activateVersion(10, {}, 'lead@test.vn')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires self_approve + note when reviewer equals creator', async () => {
    versionsRepo.getVersion.mockResolvedValue({
      ...approvedVersion,
      reviewed_by: 'sp@test.vn',
      created_by: 'sp@test.vn',
    });
    await expect(service.activateVersion(10, {}, 'lead@test.vn')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows self_approve with note >= 20 chars', async () => {
    versionsRepo.getVersion.mockResolvedValue({
      ...approvedVersion,
      reviewed_by: 'sp@test.vn',
      created_by: 'sp@test.vn',
    });
    await expect(
      service.activateVersion(
        10,
        { self_approve: true, note: 'Lead kiêm SP duyệt và active bản này' },
        'sp@test.vn',
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it('requires accept_shallow for shallow depth', async () => {
    versionsRepo.getVersion.mockResolvedValue({ ...approvedVersion, depth: 'shallow' });
    await expect(service.activateVersion(10, {}, 'lead@test.vn')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
