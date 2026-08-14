import { ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { sectionsFromReportSnapshot } from '../market-research/market-research-docx.util';
import { buildResearchReportPdf } from '../market-research/market-research-pdf.util';
import type { ResearchReportSnapshot } from '../market-research/market-research-report-snapshot.util';
import {
  assertPortalReportReadable,
  buildPortalWatermark,
} from '../market-research/portal-publish.util';
import { normalizeReportExec } from '../market-research/report-exec.util';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalResearchRepository } from './portal-research.repository';
import type {
  PortalResearchReportCard,
  PortalResearchReportDetail,
  PortalResearchVersionRecord,
} from './portal-research.types';

function mapReadableError(err: unknown): never {
  const code = (err as Error & { code?: string }).code;
  if (code === 'not_found') {
    throw new NotFoundException({ error: 'not_found' });
  }
  if (code === 'embargo_active' || code === 'report_expired') {
    throw new ForbiddenException({ error: code });
  }
  throw err;
}

function asOfFromSnapshot(snapshot: Record<string, unknown>): string | null {
  const cover = snapshot.cover;
  if (cover && typeof cover === 'object' && 'as_of' in cover) {
    const asOf = (cover as { as_of?: unknown }).as_of;
    return asOf == null || asOf === '' ? null : String(asOf);
  }
  return null;
}

function portalExec(snapshot: Record<string, unknown>): { vi: string; en: string | null } {
  const exec = normalizeReportExec(snapshot.exec);
  return {
    vi: exec.vi,
    en: exec.en_status === 'approved' ? exec.en : null,
  };
}

function watermarkFor(user: PortalJwtPayload, at: Date): string {
  return buildPortalWatermark({
    clientId: user.client_id,
    email: user.email,
    at,
  });
}

function toCard(row: PortalResearchVersionRecord, watermark: string): PortalResearchReportCard {
  return {
    version_id: row.id,
    version: row.version,
    as_of: asOfFromSnapshot(row.content_snapshot),
    expires_at: row.expires_at,
    watermark,
  };
}

@Injectable()
export class PortalResearchService {
  constructor(private readonly repo: PortalResearchRepository) {}

  async listReports(user: PortalJwtPayload): Promise<{ items: PortalResearchReportCard[] }> {
    const rows = await this.repo.listPortalVisibleVersions(user.client_id);
    const now = new Date();
    const watermark = watermarkFor(user, now);
    const items: PortalResearchReportCard[] = [];
    for (const row of rows) {
      try {
        assertPortalReportReadable({
          portalVisible: row.portal_visible,
          embargoUntil: row.embargo_until,
          expiresAt: row.expires_at,
          now,
        });
      } catch {
        continue;
      }
      items.push(toCard(row, watermark));
    }
    return { items };
  }

  async getReport(user: PortalJwtPayload, versionId: number): Promise<PortalResearchReportDetail> {
    const { row, now } = await this.loadReadableVersion(user, versionId);
    const snapshot = row.content_snapshot;
    return {
      ...toCard(row, watermarkFor(user, now)),
      exec: portalExec(snapshot),
      findings: Array.isArray(snapshot.findings) ? snapshot.findings : [],
      recs: Array.isArray(snapshot.recs) ? snapshot.recs : [],
      methodology: snapshot.methodology ?? null,
      evidence_index: Array.isArray(snapshot.evidence_index) ? snapshot.evidence_index : [],
    };
  }

  async exportReportPdf(user: PortalJwtPayload, versionId: number): Promise<StreamableFile> {
    const { row, now } = await this.loadReadableVersion(user, versionId);
    const raw = row.content_snapshot as ResearchReportSnapshot;
    const snapshot: ResearchReportSnapshot = {
      ...raw,
      exec: normalizeReportExec(raw.exec),
    };
    const watermark = buildPortalWatermark({ clientId: user.client_id, email: user.email, at: now });
    const buffer = buildResearchReportPdf(sectionsFromReportSnapshot(snapshot), watermark);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="research-v${row.version}.pdf"`,
    });
  }

  private async loadReadableVersion(
    user: PortalJwtPayload,
    versionId: number,
  ): Promise<{ row: PortalResearchVersionRecord; now: Date }> {
    const row = await this.repo.getPortalReportVersion(versionId);
    if (!row) {
      throw new NotFoundException({ error: 'not_found' });
    }
    if (row.client_id !== user.client_id) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    const now = new Date();
    try {
      assertPortalReportReadable({
        portalVisible: row.portal_visible,
        embargoUntil: row.embargo_until,
        expiresAt: row.expires_at,
        now,
      });
    } catch (err) {
      mapReadableError(err);
    }
    return { row, now };
  }
}
