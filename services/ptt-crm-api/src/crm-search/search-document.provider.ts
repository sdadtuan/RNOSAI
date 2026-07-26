import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import {
  SearchEntityDocument,
  SearchEntityType,
  SearchHit,
  buildSearchSnippet,
} from './crm-search.types';

@Injectable()
export class SearchDocumentProvider implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath, { readOnly: true });
    }
    return this.db;
  }

  collectAll(limitPerType = 200): SearchEntityDocument[] {
    const out: SearchEntityDocument[] = [];
    out.push(...this.collectAccounts(limitPerType));
    out.push(...this.collectContacts(limitPerType));
    out.push(...this.collectLeads(limitPerType));
    out.push(...this.collectDeals(limitPerType));
    out.push(...this.collectEmails(limitPerType));
    out.push(...this.collectNotes(limitPerType));
    out.push(...this.collectTickets(limitPerType));
    return out;
  }

  searchLocal(q: string, entityType?: SearchEntityType, limit = 20): SearchHit[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const docs = this.collectAll(250).filter((d) => !entityType || d.entity_type === entityType);
    const scored = docs
      .map((doc) => ({ doc, score: this.scoreDoc(doc, needle) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(limit, 1), 50));
    return scored.map(({ doc, score }) => ({
      entity_type: doc.entity_type,
      entity_id: doc.entity_id,
      title: doc.title,
      subtitle: doc.subtitle,
      snippet: buildSearchSnippet(doc.body ?? doc.subtitle ?? doc.title, q),
      route_path: doc.route_path,
      score,
    }));
  }

  estimateDocumentCount(): number {
    try {
      return this.collectAll(1).length;
    } catch {
      return 0;
    }
  }

  private scoreDoc(doc: SearchEntityDocument, needle: string): number {
    const hay = `${doc.title} ${doc.subtitle ?? ''} ${doc.body ?? ''}`.toLowerCase();
    if (!hay.includes(needle)) return 0;
    let score = 1;
    if (doc.title.toLowerCase().includes(needle)) score += 3;
    if (doc.subtitle?.toLowerCase().includes(needle)) score += 2;
    if (doc.body?.toLowerCase().includes(needle)) score += 1;
    return score;
  }

  private collectAccounts(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT id, name, company, email, phone, created_at
           FROM crm_customers
           WHERE COALESCE(is_placeholder, 0) = 0
           ORDER BY id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'account' as const,
        entity_id: String(r.id),
        title: String(r.name ?? r.company ?? `Account #${r.id}`),
        subtitle: String(r.company ?? ''),
        body: [r.email, r.phone].filter(Boolean).join(' · '),
        route_path: `/crm/customers/${r.id}`,
        updated_at: String(r.created_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private collectContacts(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT id, name, email, phone, company, created_at
           FROM crm_customers
           ORDER BY id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'contact' as const,
        entity_id: String(r.id),
        title: String(r.name ?? `Contact #${r.id}`),
        subtitle: String(r.email ?? r.phone ?? ''),
        body: [r.company, r.phone, r.email].filter(Boolean).join(' · '),
        route_path: `/crm/customers/${r.id}`,
        updated_at: String(r.created_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private collectLeads(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT id, full_name, phone, email, status, source, created_at
           FROM crm_leads
           WHERE COALESCE(is_duplicate, 0) = 0
           ORDER BY id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'lead' as const,
        entity_id: String(r.id),
        title: String(r.full_name ?? `Lead #${r.id}`),
        subtitle: String(r.status ?? ''),
        body: [r.phone, r.email, r.source].filter(Boolean).join(' · '),
        route_path: `/crm/leads`,
        updated_at: String(r.created_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private collectDeals(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT c.id, c.title, c.pipeline_stage, c.deal_value_vnd, cu.name AS customer_name, c.updated_at
           FROM crm_cases c
           LEFT JOIN crm_customers cu ON cu.id = c.customer_id
           ORDER BY c.updated_at DESC, c.id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'deal' as const,
        entity_id: String(r.id),
        title: String(r.title ?? `Deal #${r.id}`),
        subtitle: String(r.pipeline_stage ?? ''),
        body: [r.customer_name, r.deal_value_vnd ? `${r.deal_value_vnd} VND` : ''].filter(Boolean).join(' · '),
        route_path: `/crm/sales`,
        updated_at: String(r.updated_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private collectEmails(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT id, case_id, kind, body, created_at
           FROM crm_case_events
           WHERE lower(kind) LIKE '%email%' OR lower(body) LIKE '%@%.%'
           ORDER BY id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'email' as const,
        entity_id: String(r.id),
        title: String(r.kind ?? 'Email'),
        subtitle: `Case #${r.case_id}`,
        body: String(r.body ?? '').slice(0, 500),
        route_path: `/crm/sales`,
        updated_at: String(r.created_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private collectNotes(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT id, case_id, kind, body, created_at
           FROM crm_case_events
           WHERE lower(kind) IN ('note', 'comment', 'activity')
           ORDER BY id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'note' as const,
        entity_id: String(r.id),
        title: `Note · case #${r.case_id}`,
        subtitle: String(r.kind ?? 'note'),
        body: String(r.body ?? '').slice(0, 500),
        route_path: `/crm/sales`,
        updated_at: String(r.created_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private collectTickets(limit: number): SearchEntityDocument[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT t.id, t.title, t.status, t.priority, c.name AS customer_name, t.updated_at
           FROM crm_tickets t
           LEFT JOIN crm_customers c ON c.id = t.customer_id
           ORDER BY t.updated_at DESC, t.id DESC
           LIMIT ?`,
        )
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        entity_type: 'ticket' as const,
        entity_id: String(r.id),
        title: String(r.title ?? `Ticket #${r.id}`),
        subtitle: String(r.status ?? ''),
        body: [r.customer_name, r.priority].filter(Boolean).join(' · '),
        route_path: `/crm/tickets`,
        updated_at: String(r.updated_at ?? ''),
      }));
    } catch {
      return [];
    }
  }
}
