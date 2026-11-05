import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CpModule } from '../src/cp/cp.module';

describe('Creative Production API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.PTT_CRM_INTERNAL_KEY = 'cp-e2e-internal-key';
    process.env.PTT_CRM_API_AUTH_DISABLED = '0';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CpModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/crm/cp/overview/kpis requires JWT', async () => {
    await request(app.getHttpServer()).get('/api/crm/cp/overview/kpis').expect(401);
  });
});
