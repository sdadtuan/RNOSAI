import { ConflictException } from '@nestjs/common';
import { ApprovalPackageService } from './approval-package.service';

describe('ApprovalPackageService', () => {
  const repo = {
    listAssetRights: jest.fn(),
    insertApprovalPackage: jest.fn(),
    getLatestApprovalPackage: jest.fn(),
    updateApprovalPackageStatus: jest.fn(),
  };

  let service: ApprovalPackageService;

  const item = {
    id: 7,
    body_json: { markdown: 'Launch copy' },
    brief_json: { objective: 'Lead gen', disclaimer: 'Results vary' },
    media_json: { selected_asset_id: 'a1' },
  };

  const rights = [
    {
      id: 3,
      item_id: 7,
      asset_ref: 'https://cdn/a.jpg',
      status: 'Valid',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApprovalPackageService(repo as never);
  });

  it('createSentOnSubmit inserts Sent snapshot with body, brief, media, rights, disclaimer', async () => {
    repo.listAssetRights.mockResolvedValue(rights);
    repo.insertApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });

    const out = await service.createSentOnSubmit(item as never, 'sp@test.vn');

    expect(out.status).toBe('Sent');
    expect(repo.listAssetRights).toHaveBeenCalledWith(7);
    expect(repo.insertApprovalPackage).toHaveBeenCalledWith({
      item_id: 7,
      status: 'Sent',
      created_by: 'sp@test.vn',
      snapshot_json: {
        body_json: { markdown: 'Launch copy' },
        brief_json: { objective: 'Lead gen', disclaimer: 'Results vary' },
        media: { selected_asset_id: 'a1' },
        rights,
        disclaimer: 'Results vary',
      },
    });
  });

  it('assertBodyNotLocked throws package_locked when latest package is Sent', async () => {
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });

    await expect(service.assertBodyNotLocked(7, false)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.assertBodyNotLocked(7, false)).rejects.toMatchObject({
      response: { error: 'package_locked' },
    });
  });

  it('assertBodyNotLocked allows force_version when latest package is Sent', async () => {
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });

    await expect(service.assertBodyNotLocked(7, true)).resolves.toBeUndefined();
  });

  it('assertBodyNotLocked allows when there is no Sent package', async () => {
    repo.getLatestApprovalPackage.mockResolvedValue(null);

    await expect(service.assertBodyNotLocked(7, false)).resolves.toBeUndefined();
  });

  it('supersedeLatestSent marks the latest Sent package Superseded', async () => {
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Sent' });
    repo.updateApprovalPackageStatus.mockResolvedValue({ id: 11, status: 'Superseded' });

    await service.supersedeLatestSent(7);

    expect(repo.updateApprovalPackageStatus).toHaveBeenCalledWith(11, 'Superseded');
  });

  it('supersedeLatestSent is a no-op when latest is not Sent', async () => {
    repo.getLatestApprovalPackage.mockResolvedValue({ id: 11, item_id: 7, status: 'Draft' });

    await service.supersedeLatestSent(7);

    expect(repo.updateApprovalPackageStatus).not.toHaveBeenCalled();
  });
});
