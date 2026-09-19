import { BadRequestException } from '@nestjs/common';
import { OpsCrmContextService } from './ops-crm-context.service';

describe('OpsCrmContextService', () => {
  const repo = {
    getClient: jest.fn(),
    getLifecycle: jest.fn(),
    findPrimaryLifecycleByClient: jest.fn(),
    getPlan: jest.fn(),
    findPlanByLifecycle: jest.fn(),
    listMilestones: jest.fn(),
    listOpenTasks: jest.fn(),
    getProject: jest.fn(),
    findProjectByLifecycle: jest.fn(),
    listPlanCampaigns: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.listMilestones.mockResolvedValue([]);
    repo.listOpenTasks.mockResolvedValue([]);
    repo.listPlanCampaigns.mockResolvedValue([]);
    repo.findPrimaryLifecycleByClient.mockResolvedValue(null);
    repo.findPlanByLifecycle.mockResolvedValue(null);
    repo.findProjectByLifecycle.mockResolvedValue(null);
    repo.getClient.mockResolvedValue(null);
    repo.getLifecycle.mockResolvedValue(null);
    repo.getPlan.mockResolvedValue(null);
    repo.getProject.mockResolvedValue(null);
  });

  it('rejects when no id provided', async () => {
    const svc = new OpsCrmContextService(repo as never);
    await expect(svc.buildPack('marketing_plan.read', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds pack from plan_id and linked lifecycle', async () => {
    repo.getPlan.mockResolvedValue({
      id: 6,
      name: 'Lifecycle #3 TMMT',
      status: 'draft',
      period_label: '2026-Q3',
      lifecycle_id: 3,
      success_metrics_json: [{ kpi: 'CPL', quoted: 100000, actual: 120000 }],
    });
    repo.getLifecycle.mockResolvedValue({
      id: 3,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: 6,
      agency_client_id: null,
    });
    repo.listMilestones.mockResolvedValue([
      { id: 1, title: 'Kickoff', status: 'todo', due_date: '2026-10-01' },
    ]);
    repo.listOpenTasks.mockResolvedValue([
      { id: 10, title: 'Thu thập brand kit', stage: 'onboard' },
    ]);

    const svc = new OpsCrmContextService(repo as never);
    const pack = await svc.buildPack('service_delivery.read', { plan_id: 6 });

    expect(pack.wired).toBe(true);
    expect(pack.marketing_plan.id).toBe('6');
    expect(pack.marketing_plan.milestones).toHaveLength(1);
    expect(pack.service_delivery.id).toBe('3');
    expect(pack.service_delivery.stage).toBe('Onboard');
    expect(pack.service_delivery.open_tasks).toEqual([
      { id: 10, title: 'Thu thập brand kit', stage: 'Onboard' },
    ]);
    expect(pack.campaigns[0]?.kpi).toBe('CPL');
    expect(JSON.stringify(pack)).not.toMatch(/@|phone|sdt/i);
  });
});
