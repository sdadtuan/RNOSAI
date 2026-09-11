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
  it('hard delete is atomic and blocked with 409 legal_hold when the delete matches a held row', async () => {
    const repo = {
      hardDeleteItem: jest.fn().mockResolvedValue('held'),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 409,
      response: { error: 'legal_hold' },
    });
    expect(repo.hardDeleteItem).toHaveBeenCalledWith({
      itemId: 21,
      actor: 'admin@ptt.vn',
      lifecycleIds: [4],
    });
    expect(repo.getItemLegalHold).not.toHaveBeenCalled();
  });

  it('hard deletes atomically and writes the audit event inside the delete', async () => {
    const repo = {
      hardDeleteItem: jest.fn().mockResolvedValue('deleted'),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).resolves.toEqual({
      ok: true,
      id: 21,
    });
    expect(repo.hardDeleteItem).toHaveBeenCalledWith({
      itemId: 21,
      actor: 'admin@ptt.vn',
      lifecycleIds: [4],
    });
    expect(repo.getItemLegalHold).not.toHaveBeenCalled();
  });

  it('returns 404 when the atomic delete finds no row', async () => {
    const repo = {
      hardDeleteItem: jest.fn().mockResolvedValue('missing'),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 99, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.hardDeleteItem).toHaveBeenCalledWith({
      itemId: 99,
      actor: 'admin@ptt.vn',
      lifecycleIds: [4],
    });
    expect(repo.getItemLegalHold).not.toHaveBeenCalled();
  });
});
