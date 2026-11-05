import { Injectable, NotFoundException } from '@nestjs/common';
import { KpiHubDictionaryService } from '../dictionary/kpi-hub-dictionary.service';
import { KpiHubFactsRepository } from '../facts/kpi-hub-facts.repository';
import { KpiHubSourcesService } from '../mapping/kpi-hub-sources.service';

export type KpiLineageNode = {
  id: string;
  label: string;
  kind: 'dictionary' | 'source' | 'fact';
  meta?: Record<string, unknown>;
};

export type KpiLineageResponse = {
  code: string;
  dictionary: Record<string, unknown> | null;
  nodes: KpiLineageNode[];
  edges: Array<{ from: string; to: string }>;
  last_fact_at: string | null;
};

@Injectable()
export class KpiHubLineageService {
  constructor(
    private readonly dictionary: KpiHubDictionaryService,
    private readonly sources: KpiHubSourcesService,
    private readonly factsRepo: KpiHubFactsRepository,
  ) {}

  async getByCode(code: string): Promise<KpiLineageResponse> {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) throw new NotFoundException({ error: 'code_required' });

    const list = await this.dictionary.list({ q: trimmed, page: 1, page_size: 20 });
    const items = (list.items ?? []) as Array<Record<string, unknown>>;
    const row = items.find((d) => String(d.code).toUpperCase() === trimmed) ?? null;
    if (!row) {
      return { code: trimmed, dictionary: null, nodes: [], edges: [], last_fact_at: null };
    }

    const dictId = String(row.id);
    const deps = await this.dictionary.getDependencies(dictId);
    const sourceList = await this.sources.list();
    const sourceRows = (sourceList.items ?? []) as Array<Record<string, unknown>>;

    const nodes: KpiLineageNode[] = [
      {
        id: `dict:${dictId}`,
        label: `${row.code} — ${row.name}`,
        kind: 'dictionary',
        meta: { status: row.status, metric_type: row.metric_type, source: row.source_system },
      },
    ];
    const edges: Array<{ from: string; to: string }> = [];

    for (const up of deps.upstream ?? []) {
      const upRow = up as Record<string, unknown>;
      const nodeId = `dict:${upRow.id ?? upRow.code}`;
      nodes.push({
        id: nodeId,
        label: String(upRow.code ?? upRow.name ?? 'upstream'),
        kind: 'dictionary',
      });
      edges.push({ from: nodeId, to: `dict:${dictId}` });
    }

    const boundSource = sourceRows.find(
      (s) => String(s.system ?? s.code ?? '').toUpperCase() === String(row.source_system ?? '').toUpperCase(),
    );
    if (boundSource) {
      const sourceId = `source:${boundSource.id ?? boundSource.system}`;
      nodes.push({
        id: sourceId,
        label: String(boundSource.name ?? boundSource.system ?? 'Source'),
        kind: 'source',
        meta: { status: boundSource.status, last_success_at: boundSource.last_success_at },
      });
      edges.push({ from: sourceId, to: `dict:${dictId}` });
    } else if (row.source_system) {
      const sourceId = `source:${row.source_system}`;
      nodes.push({ id: sourceId, label: String(row.source_system), kind: 'source' });
      edges.push({ from: sourceId, to: `dict:${dictId}` });
    }

    const facts = await this.factsRepo.listByDictionary(dictId);
    const lastFactAt = facts[0]?.computed_at ?? null;

    if (lastFactAt) {
      nodes.push({
        id: `fact:${dictId}`,
        label: 'Fact gần nhất',
        kind: 'fact',
        meta: { computed_at: lastFactAt },
      });
      edges.push({ from: `dict:${dictId}`, to: `fact:${dictId}` });
    }

    return {
      code: trimmed,
      dictionary: row,
      nodes,
      edges,
      last_fact_at: lastFactAt,
    };
  }
}
