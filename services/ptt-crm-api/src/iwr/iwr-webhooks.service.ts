import { randomBytes } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IwrW5Repository, signWebhookBody } from './iwr-w5.repository';
import type { CreateIwrWebhookInput, IwrActor, IwrWebhookRow } from './iwr.types';

function hasCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrWebhooksService {
  constructor(private readonly repo: IwrW5Repository) {}

  async list(actor: IwrActor): Promise<{ items: IwrWebhookRow[] }> {
    const items = await this.repo.listWebhooks(actor.staffId, hasCap(actor, 'manage'));
    return { items };
  }

  async create(actor: IwrActor, input: CreateIwrWebhookInput): Promise<IwrWebhookRow> {
    if (!hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'manage' });
    }
    const url = String(input.url ?? '').trim();
    if (!url.startsWith('https://')) {
      throw new BadRequestException({ error: 'webhook_https_required' });
    }
    return this.repo.insertWebhook({
      name_vi: input.name_vi.trim(),
      url,
      secret: input.secret?.trim() || cryptoRandomSecret(),
      events: input.events?.length ? input.events : ['report.submitted', 'report.acknowledged'],
      owner_staff_id: actor.staffId,
    });
  }

  async test(actor: IwrActor, id: string): Promise<{ ok: boolean; status?: number }> {
    const hook = await this.repo.getWebhook(id);
    if (!hook) throw new NotFoundException({ error: 'iwr_webhook_not_found' });
    if (hook.owner_staff_id !== actor.staffId && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const url = hook.url.trim();
    if (!url.startsWith('https://')) {
      return { ok: false };
    }
    const body = JSON.stringify({ event: 'webhook.test', report_id: null });
    const signature = signWebhookBody(hook.secret, body);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Iwr-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false };
    }
  }
}

function cryptoRandomSecret(): string {
  return randomBytes(24).toString('hex');
}
