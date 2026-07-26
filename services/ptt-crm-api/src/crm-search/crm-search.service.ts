import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OpensearchClient } from './opensearch.client';
import { SearchDocumentProvider } from './search-document.provider';
import {
  ReindexResponse,
  SearchHealthResponse,
  SearchQuery,
  SearchResponse,
  SearchHit,
  normalizeSearchEntityType,
} from './crm-search.types';

@Injectable()
export class CrmSearchService {
  constructor(
    private readonly opensearch: OpensearchClient,
    private readonly documents: SearchDocumentProvider,
  ) {}

  async search(input: SearchQuery, requestId?: string): Promise<SearchResponse> {
    const started = Date.now();
    const q = String(input.q ?? '').trim();
    if (q.length < 2) {
      throw new BadRequestException({ error: 'query_too_short', message: 'q must be at least 2 characters' });
    }
    const entityType = normalizeSearchEntityType(input.entity_type);
    if (input.entity_type && !entityType) {
      throw new BadRequestException({
        error: 'invalid_entity_type',
        message: 'entity_type must be one of account, contact, lead, deal, email, note, ticket',
      });
    }
    const limit = Math.min(Math.max(Number(input.limit ?? 20) || 20, 1), 50);

    let hits: SearchHit[] = [];
    let engine: 'opensearch' | 'sqlite' = 'sqlite';
    if (this.opensearch.isConfigured() && (await this.opensearch.ping())) {
      hits = await this.opensearch.search(q, entityType ?? undefined, limit);
      engine = 'opensearch';
    }
    if (!hits.length) {
      hits = this.documents.searchLocal(q, entityType ?? undefined, limit);
      engine = 'sqlite';
    }

    return {
      data: {
        query: q,
        entity_type: entityType,
        hits,
        total: hits.length,
        engine,
        index: this.opensearch.indexName,
      },
      meta: { request_id: requestId?.trim() || randomUUID(), latency_ms: Date.now() - started },
      errors: [],
    };
  }

  async health(requestId?: string): Promise<SearchHealthResponse> {
    const configured = this.opensearch.isConfigured();
    const reachable = configured ? await this.opensearch.ping() : false;
    const status = reachable ? 'ready' : configured ? 'degraded' : 'unconfigured';
    return {
      data: {
        status,
        index: this.opensearch.indexName,
        opensearch_url: this.opensearch.baseUrl,
        opensearch_reachable: reachable,
        sqlite_fallback: true,
        document_count_estimate: this.documents.estimateDocumentCount(),
      },
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }

  async reindex(requestId?: string): Promise<ReindexResponse> {
    const docs = this.documents.collectAll(300);
    let indexed = 0;
    let engine: 'opensearch' | 'sqlite' = 'sqlite';
    if (this.opensearch.isConfigured() && (await this.opensearch.ping())) {
      indexed = await this.opensearch.bulkUpsert(docs);
      engine = 'opensearch';
    }
    return {
      data: {
        indexed: indexed || docs.length,
        engine,
        index: this.opensearch.indexName,
      },
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }
}
