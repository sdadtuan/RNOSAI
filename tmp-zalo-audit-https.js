const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

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

function post(url, payload, secret) {
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
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
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
  const phone = '0903000777';
  const payload = {
    event_name: 'user_submit_info',
    app_id: appId,
    timestamp: String(Date.now()),
    sender: { id: 'AUTO_TEST_USER' },
    recipient: { id: oa },
    info: { name: 'Auto Test CRM', phone },
  };
  for (const url of [
    'https://rs.pttads.vn/api/v1/webhooks/zalo',
    'https://rs.pttads.vn/api/v1/webhooks/zalo/ptt-hcm',
  ]) {
    const out = await post(url, { ...payload, timestamp: String(Date.now()) }, secret);
    console.log(url, out.status, out.body.slice(0, 320));
  }
})();
