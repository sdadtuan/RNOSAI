import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as http2 from 'http2';
import { CsdChatDevicesRepository } from './csd-chat-devices.repository';
import { apnsConfig, chatPushNotice, fcmServerKey, type ChatPushNotice } from './csd-chat-push.util';

@Injectable()
export class CsdChatPushService {
  private readonly log = new Logger(CsdChatPushService.name);

  constructor(private readonly devices: CsdChatDevicesRepository) {}

  async registerDevice(
    staffId: number,
    body: { platform?: string; token?: string },
  ): Promise<{ ok: true }> {
    const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;
    const token = String(body.token ?? '').trim();
    if (!platform || token.length < 8 || token.length > 4096) {
      throw new BadRequestException({ error: 'invalid_device' });
    }
    await this.devices.upsert(staffId, platform, token);
    return { ok: true };
  }

  async notifyMessage(input: {
    staffIds: number[];
    title: string;
    preview: string;
    conversationId: string;
  }): Promise<void> {
    const notice = chatPushNotice(input);
    try {
      const rows = await this.devices.listForStaff(input.staffIds);
      const ios = rows.filter((row) => row.platform === 'ios').map((row) => row.token);
      const android = rows.filter((row) => row.platform === 'android').map((row) => row.token);
      await Promise.all([this.sendFcm(android, notice), this.sendApns(ios, notice)]);
    } catch (err) {
      this.log.warn(`chat push skipped: ${err instanceof Error ? err.name : 'error'}`);
    }
  }

  private async sendFcm(tokens: string[], notice: ChatPushNotice): Promise<void> {
    const key = fcmServerKey();
    if (!key || tokens.length === 0) return;
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title: notice.title, body: notice.body },
        data: { conversation_id: notice.conversationId },
      }),
    });
    if (!res.ok) {
      this.log.warn(`fcm status ${res.status}`);
    }
  }

  private async sendApns(tokens: string[], notice: ChatPushNotice): Promise<void> {
    const cfg = apnsConfig();
    if (!cfg || tokens.length === 0) return;
    const jwt = apnsBearer(cfg.authKey, cfg.keyId, cfg.teamId);
    const host = cfg.sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    await Promise.all(tokens.map((token) => postApns(host, token, jwt, cfg.bundleId, notice)));
  }
}

function apnsBearer(authKey: string, keyId: string, teamId: string): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const data = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(data), {
    key: authKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${data}.${base64url(signature)}`;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function postApns(
  host: string,
  deviceToken: string,
  jwt: string,
  bundleId: string,
  notice: ChatPushNotice,
): Promise<void> {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    const done = () => {
      client.close();
      resolve();
    };
    client.on('error', done);
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });
    req.on('error', done);
    req.on('response', done);
    req.end(
      JSON.stringify({
        aps: {
          alert: { title: notice.title, body: notice.body },
          sound: 'default',
        },
        conversation_id: notice.conversationId,
      }),
    );
  });
}
