import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object, marketingRepo: object = {}) {
  return new ContentOsPortfolioService(
    repo as never,
    {} as never,
    marketingRepo as never,
    {} as never,
    {} as never,
  );
}

describe('ContentOsPortfolioService legal hold', () => {
  it('hard delete is blocked with 409 legal_hold when the item is on hold', async () => {
    const repo = {
      getItemLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        lifecycle_id: 4,
        legal_hold: true,
      }),
      hardDeleteItem: jest.fn(),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 409,
      response: { error: 'legal_hold' },
    });
    expect(repo.hardDeleteItem).not.toHaveBeenCalled();
  });

  it('hard deletes an item that is not on legal hold', async () => {
    const repo = {
      getItemLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        lifecycle_id: 4,
        legal_hold: false,
      }),
      hardDeleteItem: jest.fn().mockResolvedValue(true),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).resolves.toEqual({
      ok: true,
      id: 21,
    });
    expect(repo.hardDeleteItem).toHaveBeenCalledWith(21);
  });

  it('returns 404 when the item does not exist', async () => {
    const repo = {
      getItemLegalHold: jest.fn().mockResolvedValue(null),
      hardDeleteItem: jest.fn(),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 99, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.hardDeleteItem).not.toHaveBeenCalled();
  });
});
