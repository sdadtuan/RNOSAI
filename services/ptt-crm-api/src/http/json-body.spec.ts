import express from 'express';
import request from 'supertest';
import { DEFAULT_JSON_LIMIT, P13_CATALOG_IMPORT_JSON_LIMIT, P13_CATALOG_IMPORT_PATH, mountJsonBody } from './json-body';

describe('json body limits', () => {
  const app = express();
  mountJsonBody(app as unknown as Parameters<typeof mountJsonBody>[0]);
  app.post(P13_CATALOG_IMPORT_PATH, (req, res) => {
    res.json({ ok: true });
  });
  app.post('/api/other', (_req, res) => {
    res.json({ ok: true });
  });

  it('keeps the default parser at 100kb and the import route at 5mb', () => {
    expect(DEFAULT_JSON_LIMIT).toBe('100kb');
    expect(P13_CATALOG_IMPORT_JSON_LIMIT).toBe('5mb');
  });

  it('accepts an 200kb catalog import and rejects the same size elsewhere', async () => {
    const body = { seed: 'x'.repeat(200_000) };
    await request(app).post(P13_CATALOG_IMPORT_PATH).send(body).expect(200);
    await request(app).post('/api/other').send(body).expect(413);
  });
});
