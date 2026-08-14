import { ForbiddenException, NotFoundException, StreamableFile } from '@nestjs/common';
import * as pdfUtil from '../market-research/market-research-pdf.util';
import { PortalResearchRepository } from './portal-research.repository';
import { PortalResearchService } from './portal-research.service';

function decodePdfUtf16Be(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];
  const re = /<([0-9a-fA-F]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const hex = match[1];
    let text = '';
    for (let i = 0; i + 3 < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (code === 0xfeff) continue;
      text += String.fromCharCode(code);
    }
    chunks.push(text);
  }
  return chunks.join('\n');
}

async function streamableBuffer(file: StreamableFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const ACME = '550e8400-e29b-41d4-a716-446655440000';
const BETA = '660e8400-e29b-41d4-a716-446655440001';

const acmeUser = {
  sub: '2',
  email: 'acme@test.local',
  client_id: ACME,
  role: 'viewer' as const,
  iat: 1,
  exp: 9999999999,
};

const betaUser = {
  ...acmeUser,
  sub: '3',
  email: 'beta@test.local',
  client_id: BETA,
};

function acmeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    report_id: 7,
    version: 1,
    content_snapshot: {
      cover: {
        client: 'Acme',
        title: 'Secret Acme title',
        confidential: true,
        version: 1,
        as_of: '2026-08-14',
      },
      exec: { vi: 'Tóm tắt', en: 'Summary', en_status: 'approved' },
      findings: [],
      recs: [],
      methodology: { stub: true, population: '', source_plan: '', limitation: '' },
      evidence_index: [],
    },
    generated_by: 'am@ptt',
    content_hash: 'abc',
    embargo_until: null,
    expires_at: null,
    portal_visible: true,
    created_at: '2026-08-14T00:00:00Z',
    client_id: ACME,
    ...overrides,
  };
}

describe('PortalResearchService', () => {
  const repo = {
    getPortalReportVersion: jest.fn(),
    listPortalVisibleVersions: jest.fn(),
  } as unknown as jest.Mocked<PortalResearchRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('M2-1a: cross-tenant GET → 403, JSON.stringify(body) has no title', async () => {
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion());
    const svc = new PortalResearchService(repo);

    try {
      await svc.getReport(betaUser, 42);
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
    }
  });

  it('M2-1b: unpublished same-tenant → 404 not_found', async () => {
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion({ portal_visible: false }));
    const svc = new PortalResearchService(repo);

    try {
      await svc.getReport(acmeUser, 42);
      throw new Error('expected not_found');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toEqual({ error: 'not_found' });
    }
  });

  it('M2-1c: expired → 403 report_expired', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({ expires_at: '2020-01-01T00:00:00Z' }),
    );
    const svc = new PortalResearchService(repo);

    try {
      await svc.getReport(acmeUser, 42);
      throw new Error('expected report_expired');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'report_expired' });
    }
  });

  it('listReports skips embargo/expired/unpublished; remaining card has watermark and no title', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        id: 10,
        embargo_until: '2099-01-01T00:00:00Z',
      }),
      acmeVersion({
        id: 11,
        expires_at: '2020-01-01T00:00:00Z',
      }),
      acmeVersion({
        id: 12,
        portal_visible: false,
      }),
      acmeVersion({ id: 42 }),
    ]);
    const svc = new PortalResearchService(repo);

    const { items } = await svc.listReports(acmeUser);

    expect(items).toHaveLength(1);
    const card = items[0];
    expect(card.version_id).toBe(42);
    expect(card.watermark).toMatch(/^CONFIDENTIAL · /);
    expect(card.watermark).toContain(ACME);
    expect(card.watermark).toContain(acmeUser.email);
    expect(JSON.stringify(card)).not.toContain('title');
  });

  it('getReport happy path: watermark, exec.en null when not approved, no project/title', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          cover: {
            client: 'Acme',
            title: 'Secret Acme title',
            confidential: true,
            version: 1,
            as_of: '2026-08-14',
          },
          exec: { vi: 'Tóm tắt', en: 'Summary', en_status: 'draft' },
          findings: [],
          recs: [],
          methodology: { stub: true, population: '', source_plan: '', limitation: '' },
          evidence_index: [],
        },
      }),
    );
    const svc = new PortalResearchService(repo);

    const body = await svc.getReport(acmeUser, 42);

    expect(body.watermark).toMatch(/^CONFIDENTIAL · /);
    expect(body.watermark).toContain(ACME);
    expect(body.watermark).toContain(acmeUser.email);
    expect(body.exec).toEqual({ vi: 'Tóm tắt', en: null });
    expect(body).not.toHaveProperty('project');
    expect(body).not.toHaveProperty('title');
  });

  it('M2-1a: published + in-window PDF → %PDF- buffer and watermark', async () => {
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion());
    const svc = new PortalResearchService(repo);

    const out = await svc.exportReportPdf(acmeUser, 42);
    expect(out).toBeInstanceOf(StreamableFile);
    const headers = out.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('attachment; filename="research-v1.pdf"');

    const buffer = await streamableBuffer(out);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const decoded = decodePdfUtf16Be(buffer);
    expect(decoded).toContain('CONFIDENTIAL · ');
    expect(decoded).toContain(ACME);
    expect(decoded).toContain(acmeUser.email);
    expect(decoded).toMatch(/CONFIDENTIAL · .+ · .+ · \d{4}-\d{2}-\d{2}/);
  });

  it('M2-1b: unpublished same-tenant PDF → 404 not_found (no file)', async () => {
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion({ portal_visible: false }));
    const svc = new PortalResearchService(repo);

    try {
      await svc.exportReportPdf(acmeUser, 42);
      throw new Error('expected not_found');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toEqual({ error: 'not_found' });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('M2-1c: other client PDF → 403 forbidden; JSON.stringify(body) has no title', async () => {
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion());
    const svc = new PortalResearchService(repo);

    try {
      await svc.exportReportPdf(betaUser, 42);
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('M2-1d: expired PDF → 403 report_expired (no file)', async () => {
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({ expires_at: '2020-01-01T00:00:00Z' }),
    );
    const svc = new PortalResearchService(repo);

    try {
      await svc.exportReportPdf(acmeUser, 42);
      throw new Error('expected report_expired');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'report_expired' });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
