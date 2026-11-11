import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { PortalWorkerModule } from './portal-worker.module';

function loadDotEnvFile(): void {
  const candidates = [join(__dirname, '.env'), join(__dirname, '..', '.env'), join(process.cwd(), '.env')];
  const path = candidates.find((item) => existsSync(item));
  if (!path) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function applyWorkerEnv(): void {
  process.env.PTT_PROCESS_ROLE = 'portal-worker';
  if (!process.env.PTT_DB_POOL_MAX) process.env.PTT_DB_POOL_MAX = '3';
  if (!process.env.PTT_DB_STATEMENT_TIMEOUT_MS) process.env.PTT_DB_STATEMENT_TIMEOUT_MS = '15000';
}

async function bootstrap(): Promise<void> {
  loadDotEnvFile();
  applyWorkerEnv();
  const app = await NestFactory.createApplicationContext(PortalWorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
  app.enableShutdownHooks();
  // Keep the standalone worker alive; pollers run on @Interval / OnModuleInit.
}

void bootstrap().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack || err.message : String(err)}\n`);
  process.exit(1);
});
