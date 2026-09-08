import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PortalNotifyWebhookResult } from './portal-notification.types';

const SECRET_KEY = /otp|token/i;

export function redactNotifyPayload(input: unknown): Record<string, unknown> {
  return redactNotifyInner(input, collectNotifySecrets(input));
}

function collectNotifySecrets(input: unknown, into: string[] = []): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return into;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY.test(key) && typeof value === 'string' && value) into.push(value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collectNotifySecrets(value, into);
    }
  }
  return into;
}

function scrubSecrets(value: string, secrets: string[]): string {
  let out = value;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out;
}

function redactNotifyInner(input: unknown, secrets: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === 'string') {
      out[key] = scrubSecrets(value, secrets);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactNotifyInner(value, secrets);
    } else {
      out[key] = value;
    }
  }
  return out;
}

@Injectable()
export class PortalNotifyWebhookService {
  private readonly logger = new Logger(PortalNotifyWebhookService.name);

  constructor(private readonly config: AppConfigService) {}

  resolveWebhookUrl(): string | null {
    return this.config.portalNotifyWebhookUrl ?? this.config.portalEmailWebhookUrl;
  }

  async sendQuoteOtp(params: {
    to: string;
    subject: string;
    otp: string;
  }): Promise<PortalNotifyWebhookResult> {
    return this.send({
      source: 'quote_share_otp',
      to: params.to,
      subject: params.subject,
      otp: params.otp,
      body: `Mã xác nhận đề xuất của bạn là ${params.otp}.\nMã hết hạn sau 5 phút. Không chia sẻ mã này.`,
    });
  }

  async send(
    payload: Record<string, unknown>,
    options?: { enabled?: boolean },
  ): Promise<PortalNotifyWebhookResult> {
    if (!(options?.enabled ?? this.config.portalEmailNotifyEnabled)) {
      return { ok: true, skipped: true };
    }
    const url = this.resolveWebhookUrl();
    if (!url) {
      this.logger.warn('portal notify webhook not configured: %j', redactNotifyPayload(payload));
      return { ok: false, error: 'webhook_not_configured' };
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return { ok: false, error: `webhook HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }
}
