const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function post(path, payload, secret) {
  const body = Buffer.from(JSON.stringify(payload));
  const ts = String(payload.timestamp);
  const mac = crypto
    .createHash('sha256')
    .update(String(payload.app_id))
    .update(body)
    .update(ts)
    .update(secret)
    .digest('hex');
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          'X-ZEvent-Signature': `mac=${mac}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const env = loadEnv('/var/www/rnosai/.env');
  const secret = env.CRM_ZALO_WEBHOOK_SECRET || '';
  const appId = env.PTT_ZALO_APP_ID || '';
  const oa = '4352202090921291927';
  const payload = {
    event_name: 'user_submit_info',
    app_id: appId,
    timestamp: String(Date.now()),
    sender: { id: 'AUDIT_USER' },
    recipient: { id: oa },
    info: { name: 'Audit CRM', phone: '0900999888' },
  };
  for (const path of ['/api/v1/webhooks/zalo', '/api/v1/webhooks/zalo/ptt-hcm']) {
    const out = await post(path, { ...payload, timestamp: String(Date.now()) }, secret);
    console.log(path, out.status, out.body.slice(0, 220));
  }
  const noSig = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/v1/webhooks/zalo',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', reject);
    req.write('{}');
    req.end();
  });
  console.log('unsigned', noSig);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
