import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from '../content-marketing/guards/staff-content-marketing.guard';
import {
  ContentOsPortfolioController,
  ContentOsPortfolioFacebookOAuthCallbackController,
} from './content-os-portfolio.controller';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

describe('ContentOsPortfolioController', () => {
  it('GET command-center delegates to service', async () => {
    const service = { getCommandCenter: jest.fn().mockResolvedValue({ throughput_week: 0, risk_queue: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    await c.commandCenter({ staffUser: { sub: '1' } } as never);
    expect(service.getCommandCenter).toHaveBeenCalled();
  });

  it('GET command-center passes ?lifecycle= as a hint', async () => {
    const service = { getCommandCenter: jest.fn().mockResolvedValue({ throughput_week: 0, risk_queue: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    await c.commandCenter({ staffUser: { sub: '7' } } as never, '4');
    expect(service.getCommandCenter).toHaveBeenCalledWith({ staffId: 7, lifecycleHint: 4 });
  });

  it('GET approvals delegates to listApprovals with staffId', async () => {
    const service = { listApprovals: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.approvals({ staffUser: { sub: '7' } } as never);
    expect(service.listApprovals).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ items: [] });
  });

  it('GET publications delegates to listPublications with staffId and range', async () => {
    const service = { listPublications: jest.fn().mockResolvedValue({ slots: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.publications({ staffUser: { sub: '7' } } as never, '2026-09-07', '2026-09-13');
    expect(service.listPublications).toHaveBeenCalledWith({
      staffId: 7,
      from: '2026-09-07',
      to: '2026-09-13',
    });
    expect(out).toEqual({ slots: [] });
  });

  it('GET channel-health delegates to getChannelHealth with staffId', async () => {
    const service = {
      getChannelHealth: jest.fn().mockResolvedValue({ channels: [{ channel: 'facebook', status: 'Manual' }] }),
    };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.channelHealth({ staffUser: { sub: '7' } } as never);
    expect(service.getChannelHealth).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ channels: [{ channel: 'facebook', status: 'Manual' }] });
  });

  it('GET channel-accounts delegates to listChannelAccounts with staffId', async () => {
    const listed = {
      items: [
        {
          id: 1,
          channel: 'facebook_page',
          display_name: 'PTT Ads',
          account_ref: '555',
          health: { status: 'Connected', expires_at: '2026-12-01T00:00:00.000Z' },
        },
      ],
    };
    const service = { listChannelAccounts: jest.fn().mockResolvedValue(listed) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listChannelAccounts({ staffUser: { sub: '7' } } as never);
    expect(service.listChannelAccounts).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual(listed);
    expect(JSON.stringify(out)).not.toMatch(/token/i);
  });

  it('POST connectors/:id/disconnect uses write guard path and returns off without token', async () => {
    const service = { disconnectConnector: jest.fn().mockResolvedValue({ status: 'off' }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.disconnectConnector(9, { staffUser: { sub: '7', email: 'ops@ptt.vn' } } as never);
    expect(service.disconnectConnector).toHaveBeenCalledWith({
      staffId: 7,
      connectorId: 9,
      actor: 'ops@ptt.vn',
    });
    expect(out).toEqual({ status: 'off' });
    expect(JSON.stringify(out)).not.toMatch(/token/i);
  });

  it('GET requests delegates to listRequests with staffId', async () => {
    const service = { listRequests: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listRequests({ staffUser: { sub: '7' } } as never);
    expect(service.listRequests).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ items: [] });
  });

  it('GET items/:itemId delegates to getPortfolioItem with staffId and lifecycle hint', async () => {
    const item = { id: 21, lifecycle_id: 4 };
    const service = { getPortfolioItem: jest.fn().mockResolvedValue(item) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.getPortfolioItem(21, { staffUser: { sub: '7' } } as never, '4');
    expect(service.getPortfolioItem).toHaveBeenCalledWith({ staffId: 7, itemId: 21, lifecycleHint: 4 });
    expect(out).toEqual(item);
  });

  it('PATCH items/:itemId/legal-hold delegates to patchLegalHold without a writer DELETE', async () => {
    const held = { id: 21, legal_hold: true, legal_hold_set_by: 'w@ptt.vn' };
    const service = { patchLegalHold: jest.fn().mockResolvedValue(held) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.patchLegalHold(
      21,
      { legal_hold: true, reason: 'tranh chấp hợp đồng Q4' },
      { staffUser: { sub: '7', email: 'w@ptt.vn' }, staffAuthVia: 'jwt' } as never,
    );
    expect(service.patchLegalHold).toHaveBeenCalledWith({
      staffId: 7,
      itemId: 21,
      actor: 'w@ptt.vn',
      body: { legal_hold: true, reason: 'tranh chấp hợp đồng Q4' },
      staffUser: { sub: '7', email: 'w@ptt.vn' },
      staffAuthVia: 'jwt',
    });
    expect(out).toEqual(held);
    expect(c).not.toHaveProperty('deleteItem');
    expect(c).not.toHaveProperty('hardDeleteItem');
  });

  it('PATCH legal-hold keeps class ViewGuard and does not use WriteGuard', () => {
    const classGuards = (Reflect.getMetadata(GUARDS_METADATA, ContentOsPortfolioController) ?? []) as unknown[];
    expect(classGuards).toContain(StaffContentMarketingViewGuard);
    expect(classGuards).not.toContain(StaffContentMarketingWriteGuard);

    const holdGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      ContentOsPortfolioController.prototype.patchLegalHold,
    ) ?? []) as unknown[];
    expect(holdGuards).not.toContain(StaffContentMarketingWriteGuard);
  });

  it('GET sla-events delegates to listSlaEvents with staffId and optional filters', async () => {
    const service = { listSlaEvents: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listSlaEvents({ staffUser: { sub: '7' } } as never, '21', '11');
    expect(service.listSlaEvents).toHaveBeenCalledWith({ staffId: 7, itemId: 21, amStaffId: 11 });
    expect(out).toEqual({ items: [] });
  });

  it('GET insights delegates to listInsights with staffId and lifecycle hint', async () => {
    const service = { listInsights: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listInsights({ staffUser: { sub: '7' } } as never, '4');
    expect(service.listInsights).toHaveBeenCalledWith({ staffId: 7, lifecycleHint: 4 });
    expect(out).toEqual({ items: [] });
  });

  it('POST insights/:id/approve delegates to approveInsight', async () => {
    const approved = { id: 11, status: 'Approved' };
    const service = { approveInsight: jest.fn().mockResolvedValue(approved) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.approveInsight(11, { staffUser: { sub: '7' } } as never);
    expect(service.approveInsight).toHaveBeenCalledWith({ staffId: 7, insightId: 11 });
    expect(out).toEqual(approved);
  });

  it('GET glossary delegates to listGlossary with staffId and lifecycle hint', async () => {
    const service = { listGlossary: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listGlossary({ staffUser: { sub: '7' } } as never, '4');
    expect(service.listGlossary).toHaveBeenCalledWith({ staffId: 7, lifecycleHint: 4 });
    expect(out).toEqual({ items: [] });
  });

  it('POST glossary/:id/approve delegates to approveGlossary', async () => {
    const approved = { id: 11, status: 'Approved', term: 'đăng ký nhận tư vấn', locale: 'vi', brand_id: 'brand-4' };
    const service = { approveGlossary: jest.fn().mockResolvedValue(approved) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.approveGlossary(11, { staffUser: { sub: '7' } } as never);
    expect(service.approveGlossary).toHaveBeenCalledWith({ staffId: 7, glossaryId: 11 });
    expect(out).toEqual(approved);
  });

  it('POST glossary delegates to createGlossary with write guard path', async () => {
    const created = { id: 21, status: 'Draft', term: 'sống xanh' };
    const service = { createGlossary: jest.fn().mockResolvedValue(created) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.createGlossary(
      { term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4 },
      { staffUser: { sub: '7', email: 'am@ptt.vn' } } as never,
    );
    expect(service.createGlossary).toHaveBeenCalledWith({
      staffId: 7,
      actor: 'am@ptt.vn',
      body: { term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4 },
    });
    expect(out).toEqual(created);
  });

  it('PATCH glossary/:id delegates to patchGlossaryDraft', async () => {
    const patched = { id: 11, status: 'Draft', preferred: 'Sống xanh' };
    const service = { patchGlossaryDraft: jest.fn().mockResolvedValue(patched) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.patchGlossary(11, { preferred: 'Sống xanh' }, { staffUser: { sub: '7' } } as never);
    expect(service.patchGlossaryDraft).toHaveBeenCalledWith({
      staffId: 7,
      glossaryId: 11,
      body: { preferred: 'Sống xanh' },
    });
    expect(out).toEqual(patched);
  });

  it('POST approvals/batch delegates to batchApprove with staffId, actor, ids, and step', async () => {
    const service = { batchApprove: jest.fn().mockResolvedValue({ ok: [21], failed: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.batchApprove(
      { item_ids: [21, 22], step: 'in_review' },
      { staffUser: { sub: '7', email: 'am@ptt.vn' } } as never,
    );
    expect(service.batchApprove).toHaveBeenCalledWith({
      staffId: 7,
      actor: 'am@ptt.vn',
      item_ids: [21, 22],
      step: 'in_review',
    });
    expect(out).toEqual({ ok: [21], failed: [] });
  });

  it('POST approvals/:packageId/delegate delegates to delegateApproval', async () => {
    const pkg = { id: 9, delegate_until: '2026-09-12T00:00:00.000Z', delegate_expired: false };
    const service = { delegateApproval: jest.fn().mockResolvedValue(pkg) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.delegateApproval(
      9,
      { delegate_until: '2026-09-12T00:00:00.000Z', delegate_to: 'qa@ptt.vn' },
      { staffUser: { sub: '7', email: 'am@ptt.vn' } } as never,
    );
    expect(service.delegateApproval).toHaveBeenCalledWith({
      staffId: 7,
      actor: 'am@ptt.vn',
      packageId: 9,
      delegate_until: '2026-09-12T00:00:00.000Z',
      delegate_to: 'qa@ptt.vn',
    });
    expect(out).toEqual(pkg);
  });

  it('GET settings delegates to getSettings with staffId', async () => {
    const service = {
      getSettings: jest.fn().mockResolvedValue({ direct_social_publish: false, sso_enforced: false }),
    };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.getSettings({ staffUser: { sub: '7' } } as never);
    expect(service.getSettings).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ direct_social_publish: false, sso_enforced: false });
  });

  it('PATCH settings delegates to patchSettings with staffId, actor, and body', async () => {
    const service = { patchSettings: jest.fn().mockResolvedValue({ direct_social_publish: true }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.patchSettings(
      { direct_social_publish: true },
      { staffUser: { sub: '7', email: 'admin@ptt.vn' } } as never,
    );
    expect(service.patchSettings).toHaveBeenCalledWith({
      staffId: 7,
      actor: 'admin@ptt.vn',
      body: { direct_social_publish: true },
    });
    expect(out).toEqual({ direct_social_publish: true });
  });

  it('GET dam delegates to listDamAssets with staffId and collection', async () => {
    const listed = { items: [], error: 'dam_not_configured' };
    const service = { listDamAssets: jest.fn().mockResolvedValue(listed) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listDamAssets({ staffUser: { sub: '7' } } as never, 'approved');
    expect(service.listDamAssets).toHaveBeenCalledWith({ staffId: 7, collection: 'approved' });
    expect(out).toEqual(listed);
  });

  it('POST items/:itemId/dam-bind delegates to bindDamAsset with write guard path', async () => {
    const bound = { media_json: { dam_refs: [{ dam_id: 'a1', url: 'https://dam.example.internal/a.jpg' }] } };
    const service = { bindDamAsset: jest.fn().mockResolvedValue(bound) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.bindDamAsset(
      21,
      { dam_id: 'a1', url: 'https://dam.example.internal/a.jpg' },
      { staffUser: { sub: '7', email: 'ops@ptt.vn' } } as never,
    );
    expect(service.bindDamAsset).toHaveBeenCalledWith({
      staffId: 7,
      itemId: 21,
      actor: 'ops@ptt.vn',
      body: { dam_id: 'a1', url: 'https://dam.example.internal/a.jpg' },
    });
    expect(out).toEqual(bound);
  });

  it('GET items/:itemId/ai-traces delegates to listAiTraces with staffId and lifecycle hint', async () => {
    const traces = { items: [{ at: '2026-09-10T08:00:00.000Z', intent: 'Draft generate', sources: [], job_id: 55, status: 'succeeded' }] };
    const service = { listAiTraces: jest.fn().mockResolvedValue(traces) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listAiTraces(21, { staffUser: { sub: '7' } } as never, '4');
    expect(service.listAiTraces).toHaveBeenCalledWith({ staffId: 7, itemId: 21, lifecycleHint: 4 });
    expect(out).toEqual(traces);
  });

  it('GET audit/export delegates to exportAuditCsv with staffId and actor', async () => {
    const csv = 'actor,action,entity,created_at\nadmin@ptt.vn,audit_export,portfolio_audit,2026-09-11T07:47:00.000Z\n';
    const service = { exportAuditCsv: jest.fn().mockResolvedValue(csv) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.exportAuditCsv({ staffUser: { sub: '7', email: 'admin@ptt.vn' } } as never);
    expect(service.exportAuditCsv).toHaveBeenCalledWith({ staffId: 7, actor: 'admin@ptt.vn' });
    expect(out).toBe(csv);
  });

  it('POST publications/execute delegates to enqueuePublicationExecute', async () => {
    const queued = { queued: true, client_request_id: 'r1', execute_id: 88 };
    const service = { enqueuePublicationExecute: jest.fn().mockResolvedValue(queued) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.enqueuePublicationExecute(
      { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r1' },
      { staffUser: { sub: '7', email: 'social@ptt.vn' } } as never,
    );
    expect(service.enqueuePublicationExecute).toHaveBeenCalledWith({
      staffId: 7,
      actor: 'social@ptt.vn',
      body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r1' },
    });
    expect(out).toEqual(queued);
  });

  it('GET oauth/start uses write guard path and returns redirect without token', async () => {
    const service = { startFacebookOAuth: jest.fn().mockResolvedValue({ redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x' }) };
    const c = new ContentOsPortfolioController(service as never);
    const res = { redirect: jest.fn(), json: jest.fn() };
    await c.startFacebookOAuth({ staffUser: { sub: '7' }, headers: {} } as never, res as never);
    expect(service.startFacebookOAuth).toHaveBeenCalledWith({ staffId: 7 });
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('facebook.com'));
    expect(res.json).not.toHaveBeenCalled();
    expect(String(res.redirect.mock.calls[0][0])).not.toMatch(/access_token/);
  });

  it('GET oauth/start.json returns JSON { redirect } for the FE without a token', async () => {
    const service = {
      startFacebookOAuth: jest.fn().mockResolvedValue({
        redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x',
      }),
    };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.startFacebookOAuthJson({ staffUser: { sub: '7' } } as never);
    expect(service.startFacebookOAuth).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x' });
    expect(JSON.stringify(out)).not.toMatch(/access_token|Bearer /);
  });

  it('GET oauth/start returns JSON when Accept is application/json', async () => {
    const service = {
      startFacebookOAuth: jest.fn().mockResolvedValue({
        redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x',
      }),
    };
    const c = new ContentOsPortfolioController(service as never);
    const res = { redirect: jest.fn(), json: jest.fn() };
    await c.startFacebookOAuth(
      { staffUser: { sub: '7' }, headers: { accept: 'application/json' } } as never,
      res as never,
    );
    expect(res.json).toHaveBeenCalledWith({
      redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x',
    });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('GET oauth/start returns JSON when ?format=json', async () => {
    const service = {
      startFacebookOAuth: jest.fn().mockResolvedValue({
        redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x',
      }),
    };
    const c = new ContentOsPortfolioController(service as never);
    const res = { redirect: jest.fn(), json: jest.fn() };
    await c.startFacebookOAuth(
      { staffUser: { sub: '7' }, headers: {}, query: { format: 'json' } } as never,
      res as never,
    );
    expect(res.json).toHaveBeenCalledWith({
      redirect: expect.stringContaining('facebook.com'),
    });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('GET oauth/callback stays fb=ok when audit fails after tokens are saved', async () => {
    const env = {
      CMKT_FB_APP_ID: process.env.CMKT_FB_APP_ID,
      CMKT_FB_APP_SECRET: process.env.CMKT_FB_APP_SECRET,
      CMKT_FB_REDIRECT_URI: process.env.CMKT_FB_REDIRECT_URI,
      CMKT_FB_PAGE_ALLOWLIST: process.env.CMKT_FB_PAGE_ALLOWLIST,
      OPS_WEB_ORIGIN: process.env.OPS_WEB_ORIGIN,
    };
    process.env.CMKT_FB_APP_ID = 'app-1';
    process.env.CMKT_FB_APP_SECRET = 'sec';
    process.env.CMKT_FB_REDIRECT_URI = 'https://api.example/cb';
    process.env.CMKT_FB_PAGE_ALLOWLIST = '555';
    process.env.OPS_WEB_ORIGIN = 'https://ops.example';
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'USER_TOKEN', expires_in: 3600 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: '555', access_token: 'PAGE_TOKEN' }] }),
      }) as typeof fetch;
    const repo = {
      consumeOauthState: jest.fn().mockResolvedValue({ staffId: 7, lifecycleId: 4 }),
      saveConnectorSecrets: jest.fn().mockResolvedValue(undefined),
      insertAuditExport: jest.fn().mockRejectedValue(new Error('audit_down')),
    };
    const service = new ContentOsPortfolioService(repo as never, {} as never, {} as never, {} as never);
    const c = new ContentOsPortfolioFacebookOAuthCallbackController(service);
    const res = { redirect: jest.fn() };
    try {
      await c.facebookOAuthCallback('oauth-code', 'oauth-state', res as never);
      const location = String(res.redirect.mock.calls[0][0]);
      expect(location).toContain('fb=ok');
      expect(location).not.toMatch(/fb=error/);
      expect(location).not.toMatch(/access_token/);
      expect(repo.saveConnectorSecrets).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

});

