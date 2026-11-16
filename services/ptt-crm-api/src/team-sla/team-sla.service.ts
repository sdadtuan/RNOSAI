import { Injectable } from '@nestjs/common';
import type { SolutionWorkDueSettings } from '../leads-funnel/solution-case.util';
import {
  marketingClaimMinutes,
  saleClaimMinutes,
  saleMissingInfoHours,
  saleRetryGapHours,
  saleUpdateAfterClaimHours,
} from './team-sla-clocks.util';
import { defaultTeamSlaDocument, normalizeTeamSlaDocument, type TeamSlaDocument } from './team-sla-profiles';
import { TeamSlaRepository } from './team-sla.repository';
import { notifyBusinessCalendarSourceChanged } from './business-calendar.util';

const CACHE_MS = 15_000;

@Injectable()
export class TeamSlaService {
  private cache: { at: number; document: TeamSlaDocument } | null = null;

  constructor(private readonly repo: TeamSlaRepository) {}

  private async loadDocument(): Promise<TeamSlaDocument> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.document;
    }
    try {
      const row = await this.repo.get();
      this.cache = { at: Date.now(), document: row.document };
      return row.document;
    } catch {
      return this.cache?.document ?? defaultTeamSlaDocument();
    }
  }

  async getDocument(): Promise<TeamSlaDocument> {
    return this.loadDocument();
  }

  async getSettings(): Promise<{
    document: TeamSlaDocument;
    updated_by: string;
    updated_at: string;
  }> {
    const row = await this.repo.get();
    this.cache = { at: Date.now(), document: row.document };
    return {
      document: row.document,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    };
  }

  async saveDocument(raw: unknown, actor: string): Promise<{
    document: TeamSlaDocument;
    updated_by: string;
    updated_at: string;
  }> {
    const document = normalizeTeamSlaDocument(raw);
    const row = await this.repo.save(document, actor);
    this.cache = { at: Date.now(), document: row.document };
    notifyBusinessCalendarSourceChanged();
    return {
      document: row.document,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    };
  }

  async saleClaimMinutes(): Promise<number> {
    return saleClaimMinutes(await this.loadDocument());
  }

  async marketingClaimMinutes(): Promise<number> {
    return marketingClaimMinutes(await this.loadDocument());
  }

  async saleMissingInfoHours(): Promise<number> {
    return saleMissingInfoHours(await this.loadDocument());
  }

  async saleUpdateAfterClaimHours(): Promise<number> {
    return saleUpdateAfterClaimHours(await this.loadDocument());
  }

  async saleRetryGapHours(): Promise<number> {
    return saleRetryGapHours(await this.loadDocument());
  }

  async marketingSolutionWorkSettings(): Promise<SolutionWorkDueSettings> {
    const doc = await this.loadDocument();
    const marketing = doc.profiles.find((row) => row.code === 'marketing');
    if (!marketing) return {};
    const clocks = marketing.marketing;
    return {
      cutoffTime: clocks.solution_cutoff_time || undefined,
      beforeCutoffHours:
        clocks.solution_before_cutoff_hours == null
          ? undefined
          : Number(clocks.solution_before_cutoff_hours),
      afterCutoffTime: clocks.solution_after_cutoff_time || undefined,
      workStartTime: marketing.calendar?.start || undefined,
      revisionHours:
        clocks.revision_hours != null && Number(clocks.revision_hours) > 0 ? Number(clocks.revision_hours) : undefined,
    };
  }
}
