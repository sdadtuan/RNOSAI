import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AssetRightsService,
  evaluateItemRights,
  selectedMediaAssetRefs,
} from './asset-rights.service';

describe('selectedMediaAssetRefs', () => {
  it('collects selected asset urls and selected_asset_id', () => {
    expect(
      selectedMediaAssetRefs({
        selected_asset_id: 'sel-1',
        ai_assets: [
          { id: 'sel-1', type: 'image', url: 'https://cdn/a.jpg', ai_generated: true, provider: 'x' },
          { id: 'other', type: 'image', url: 'https://cdn/skip.jpg', ai_generated: true, provider: 'x' },
        ],
        carousel_slides: [
          {
            id: 's2',
            type: 'carousel_slide',
            url: 'https://cdn/slide.jpg',
            ai_generated: false,
            provider: 'x',
            selected: true,
          },
        ],
      }).sort(),
    ).toEqual(['https://cdn/a.jpg', 'https://cdn/slide.jpg']);
  });
});

describe('evaluateItemRights', () => {
  it('omits rightsValid when there are no selected assets and no rights rows', () => {
    expect(evaluateItemRights({}, [])).toEqual({});
  });

  it('treats a selected asset with no row as Unknown and sets rightsValid false', () => {
    expect(
      evaluateItemRights(
        {
          ai_assets: [
            {
              id: 'a1',
              type: 'image',
              url: 'https://cdn/need.jpg',
              ai_generated: true,
              provider: 'x',
              selected: true,
            },
          ],
        },
        [],
      ),
    ).toEqual({ rightsValid: false });
  });

  it('sets rightsValid false for Unknown or Invalid required rows', () => {
    expect(
      evaluateItemRights({}, [{ asset_ref: 'https://cdn/x.jpg', status: 'Unknown' }]),
    ).toEqual({ rightsValid: false });
    expect(
      evaluateItemRights({}, [{ asset_ref: 'https://cdn/x.jpg', status: 'Invalid' }]),
    ).toEqual({ rightsValid: false });
  });

  it('does not treat Expiring as Invalid and warns when paid_ok', () => {
    expect(
      evaluateItemRights({}, [{ asset_ref: 'https://cdn/x.jpg', status: 'Expiring', paid_ok: true }]),
    ).toEqual({ rightsValid: true, paidExpiryWarning: true });
  });

  it('sets rightsValid true when every required asset is Valid', () => {
    expect(
      evaluateItemRights(
        {
          ai_assets: [
            {
              id: 'a1',
              type: 'image',
              url: 'https://cdn/ok.jpg',
              ai_generated: true,
              provider: 'x',
              selected: true,
            },
          ],
        },
        [{ asset_ref: 'https://cdn/ok.jpg', status: 'Valid' }],
      ),
    ).toEqual({ rightsValid: true });
  });
});

describe('AssetRightsService', () => {
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    listAssetRights: jest.fn(),
    replaceAssetRights: jest.fn(),
    getAssetRightById: jest.fn(),
    updateAssetRightStatus: jest.fn(),
    insertItemVersion: jest.fn(),
  };
  let service: AssetRightsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssetRightsService(core as never, repo as never);
  });

  it('listRights returns rows for the item', async () => {
    repo.getItemById.mockResolvedValue({ id: 7, media_json: {} });
    repo.listAssetRights.mockResolvedValue([{ id: 1, item_id: 7, asset_ref: 'https://cdn/a.jpg', status: 'Valid' }]);

    await expect(service.listRights(1, 7)).resolves.toEqual({
      rights: [{ id: 1, item_id: 7, asset_ref: 'https://cdn/a.jpg', status: 'Valid' }],
    });
  });

  it('replaceRights upserts the payload rows', async () => {
    repo.getItemById.mockResolvedValue({ id: 7 });
    repo.replaceAssetRights.mockResolvedValue([{ id: 2, item_id: 7, asset_ref: 'https://cdn/b.jpg', status: 'Unknown' }]);

    const out = await service.replaceRights(1, 7, {
      rights: [{ asset_ref: 'https://cdn/b.jpg' }],
    });

    expect(repo.replaceAssetRights).toHaveBeenCalledWith(
      7,
      expect.arrayContaining([expect.objectContaining({ asset_ref: 'https://cdn/b.jpg', status: 'Unknown' })]),
    );
    expect(out.rights).toHaveLength(1);
  });

  it('override requires reason length >= 10 and non-empty evidence', async () => {
    repo.getItemById.mockResolvedValue({ id: 7, body_json: { markdown: 'x' } });
    repo.getAssetRightById.mockResolvedValue({ id: 9, item_id: 7, status: 'Invalid' });

    await expect(service.overrideRight(1, 7, 9, { reason: 'short', evidence: 'doc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.overrideRight(1, 7, 9, { reason: 'long enough reason', evidence: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.updateAssetRightStatus).not.toHaveBeenCalled();
  });

  it('override sets Valid and audits rights_override', async () => {
    repo.getItemById.mockResolvedValue({ id: 7, body_json: { markdown: 'x' } });
    repo.getAssetRightById.mockResolvedValue({ id: 9, item_id: 7, status: 'Invalid' });
    repo.updateAssetRightStatus.mockResolvedValue({ id: 9, item_id: 7, status: 'Valid' });

    const out = await service.overrideRight(1, 7, 9, {
      reason: 'Client license on file',
      evidence: 'https://drive/license.pdf',
    }, 'qa@ptt.vn');

    expect(out.status).toBe('Valid');
    expect(repo.updateAssetRightStatus).toHaveBeenCalledWith(9, 'Valid');
    expect(repo.insertItemVersion).toHaveBeenCalledWith(7, { markdown: 'x' }, 'qa@ptt.vn', 'rights_override');
  });

  it('override 404s when the rights row is missing', async () => {
    repo.getItemById.mockResolvedValue({ id: 7, body_json: {} });
    repo.getAssetRightById.mockResolvedValue(null);
    await expect(
      service.overrideRight(1, 7, 99, { reason: 'Client license on file', evidence: 'doc' }, 'qa@ptt.vn'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
