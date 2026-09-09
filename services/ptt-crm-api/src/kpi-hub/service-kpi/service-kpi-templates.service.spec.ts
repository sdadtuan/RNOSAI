import { BadRequestException } from '@nestjs/common';
import { ServiceKpiTemplatesService } from './service-kpi-templates.service';
import type { ServiceKpiRepository } from './service-kpi.repository';

function mockRepo(overrides: Partial<ServiceKpiRepository> = {}): ServiceKpiRepository {
  return {
    getDictionaryStatus: jest.fn().mockResolvedValue('ACTIVE'),
    createTemplate: jest.fn().mockResolvedValue({ id: 'tpl-1', version_id: 'ver-1', version_no: 1 }),
    getTemplate: jest.fn(),
    getVersion: jest.fn(),
    setVersionStatus: jest.fn(),
    createRevision: jest.fn(),
    ...overrides,
  } as unknown as ServiceKpiRepository;
}

describe('ServiceKpiTemplatesService', () => {
  it('create rejects non-ACTIVE dictionary', async () => {
    const repo = mockRepo({
      getDictionaryStatus: jest.fn().mockResolvedValue('DRAFT'),
    });
    const svc = new ServiceKpiTemplatesService(repo);
    await expect(
      svc.create(
        {
          dv_code: 'DV01',
          name: 'Test',
          rules: [{ dictionary_id: 'dict-1', classification: 'OPTIMIZATION_TARGET' }],
        },
        { staffId: 1 },
      ),
    ).rejects.toMatchObject({ response: { error: 'DICTIONARY_NOT_ACTIVE' } });
  });

  it('submitReview blocks client-visible rule without disclaimer', async () => {
    const repo = mockRepo({
      getVersion: jest.fn().mockResolvedValue({
        id: 'ver-1',
        template_id: 'tpl-1',
        version_no: 1,
        status: 'DRAFT',
        rules: [
          {
            id: 'rule-1',
            dictionary_id: 'dict-1',
            classification: 'PROJECTED_RESULT',
            is_required: true,
            client_visible: true,
            display_order: 0,
            target_min: 100,
            target_max: null,
            target_unit: null,
            scenario: 'base',
            assumption_template: 'Giả định A',
            disclaimer_template: '',
            owner_role: 'AM',
            cadence: 'weekly',
          },
        ],
      }),
    });
    const svc = new ServiceKpiTemplatesService(repo);
    await expect(svc.submitReview('ver-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activate only from IN_REVIEW', async () => {
    const repo = mockRepo({
      getVersion: jest.fn().mockResolvedValue({
        id: 'ver-1',
        template_id: 'tpl-1',
        version_no: 1,
        status: 'DRAFT',
        rules: [],
      }),
    });
    const svc = new ServiceKpiTemplatesService(repo);
    await expect(svc.activate('ver-1')).rejects.toMatchObject({ response: { error: 'VERSION_NOT_IN_REVIEW' } });
  });
});
