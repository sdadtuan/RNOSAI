import { OpsReturnToAmService } from './ops-return-to-am.service';

describe('OpsReturnToAmService dry_run', () => {
  const repo = {
    findLifecycleByLead: jest.fn(),
    getLifecycleDetail: jest.fn(),
    getStageTask: jest.fn(),
    ensureStageTask: jest.fn(),
    patchStageTaskFormData: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLifecycleDetail.mockResolvedValue({
      id: 5,
      lead_id: 5,
      assigned_am: 1,
      service_slug: 'quang-cao-facebook',
    });
    repo.getStageTask.mockResolvedValue({
      id: 99,
      form_data: {},
      notes: '',
      is_done: false,
    });
  });

  it('does not write needs_am_rework when dry_run=true', async () => {
    const svc = new OpsReturnToAmService(repo as never);
    const out = await svc.returnToAm({
      lifecycle_id: 5,
      reason_codes: ['pain_empty'],
      dry_run: true,
    });
    expect(out.dry_run).toBe(true);
    expect(out.needs_am_rework).toBe(false);
    expect(repo.patchStageTaskFormData).not.toHaveBeenCalled();
    expect(repo.ensureStageTask).not.toHaveBeenCalled();
  });

  it('writes flag when dry_run is false', async () => {
    const svc = new OpsReturnToAmService(repo as never);
    const out = await svc.returnToAm({
      lifecycle_id: 5,
      reason_codes: ['pain_empty'],
      dry_run: false,
    });
    expect(out.needs_am_rework).toBe(true);
    expect(repo.patchStageTaskFormData).toHaveBeenCalled();
  });
});
