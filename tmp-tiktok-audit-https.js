const https = require('https');

const payload = {
  object: 1,
  time: Math.floor(Date.now() / 1000),
  entry: [
    {
      id: `audit-${Date.now()}`,
      advertiser_id: 999000111,
      page_id: 888,
      campaign_id: 'crm-audit',
      lead_source: 'INSTANT_FORM',
      changes: [
        { field: 'name', value: 'TikTok Audit CRM' },
        { field: 'phone_number', value: '0903000666' },
        { field: 'email', value: 'audit@pttads.vn' },
      ],
    },
  ],
};

const body = Buffer.from(JSON.stringify(payload));

const req = https.request(
  {
    hostname: 'rs.pttads.vn',
    path: '/api/v1/webhooks/tiktok',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => console.log(res.statusCode, data.slice(0, 400)));
  },
);
req.on('error', (e) => console.error(e));
req.write(body);
req.end();
