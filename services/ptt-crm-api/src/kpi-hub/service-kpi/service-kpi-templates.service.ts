import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { validateReadiness } from './service-kpi-readiness';
import { ServiceKpiRepository } from './service-kpi.repository';
import type { CreateTemplateBody, ServiceKpiTemplateRow } from './service-kpi.types';

@Injectable()
export class ServiceKpiTemplatesService {
  constructor(private readonly repo: ServiceKpiRepository) {}

  async list(q: { dv_code?: string; status?: string; page?: number; page_size?: number }) {
    const { items, total } = await this.repo.listTemplates(q);
    const active = items.filter((i) => i.status === 'ACTIVE').length;
    const inReview = items.filter((i) => i.status === 'IN_REVIEW').length;
    return { items, total, summary: { active, in_review: inReview } };
  }

  async create(body: CreateTemplateBody, _actor: { staffId: number }) {
    if (!body.rules?.length) {
      throw new BadRequestException({ error: 'RULES_REQUIRED' });
    }
    for (const rule of body.rules) {
      const status = await this.repo.getDictionaryStatus(rule.dictionary_id);
      if (status !== 'ACTIVE') {
        throw new BadRequestException({ error: 'DICTIONARY_NOT_ACTIVE', dictionary_id: rule.dictionary_id });
      }
    }
    const created = await this.repo.createTemplate(body);
    return { id: created.id, status: 'DRAFT' as const, version_no: created.version_no, version_id: created.version_id };
  }

  async get(id: string): Promise<ServiceKpiTemplateRow> {
    const row = await this.repo.getTemplate(id);
    if (!row) throw new NotFoundException({ error: 'TEMPLATE_NOT_FOUND' });
    return row;
  }

  async createRevision(id: string, _actor: { staffId: number }) {
    const tpl = await this.get(id);
    if (tpl.status === 'ACTIVE') {
      return this.repo.createRevision(id);
    }
    throw new BadRequestException({ error: 'REVISION_REQUIRES_ACTIVE', hint: 'Chỉ template ACTIVE cần revision mới' });
  }

  async submitReview(versionId: string) {
    const version = await this.repo.getVersion(versionId);
    if (!version) throw new NotFoundException({ error: 'VERSION_NOT_FOUND' });
    const errors: Array<{ field: string; message: string; rule_id?: string }> = [];
    for (const rule of version.rules) {
      if (!rule.client_visible) continue;
      const result = validateReadiness({
        classification: rule.classification,
        clientVisible: rule.client_visible,
        hasDefinition: true,
        hasQuantityOrTarget: rule.target_min != null || rule.target_max != null,
        hasDisclaimer: Boolean(rule.disclaimer_template?.trim()),
        hasAssumption: Boolean(rule.assumption_template?.trim()),
        hasScenario: Boolean(rule.scenario && rule.scenario !== 'base') || rule.classification !== 'PROJECTED_RESULT',
        hasDataSource: true,
        hasOwner: Boolean(rule.owner_role?.trim()),
      });
      if (result.level === 'blocking') {
        for (const err of result.errors) {
          errors.push({ ...err, rule_id: rule.id });
        }
      }
    }
    if (errors.length) {
      throw new BadRequestException({ error: 'READINESS_BLOCKED', errors });
    }
    await this.repo.setVersionStatus(versionId, 'IN_REVIEW', 'IN_REVIEW');
    return { status: 'IN_REVIEW' as const };
  }

  async activate(versionId: string) {
    const version = await this.repo.getVersion(versionId);
    if (!version) throw new NotFoundException({ error: 'VERSION_NOT_FOUND' });
    if (version.status !== 'IN_REVIEW') {
      throw new BadRequestException({ error: 'VERSION_NOT_IN_REVIEW' });
    }
    await this.repo.setVersionStatus(versionId, 'ACTIVE', 'ACTIVE');
    return { status: 'ACTIVE' as const };
  }
}
