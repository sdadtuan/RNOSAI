import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AmHealthWorker } from '../am/am-health.worker';
import { AmRenewalWorker } from '../am/am-renewal.worker';

async function main() {
  const cmd = process.argv[2];
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    if (cmd === 'health') {
      const out = await app.get(AmHealthWorker).run();
      process.stdout.write(JSON.stringify(out) + '\n');
      return;
    }
    if (cmd === 'renewal') {
      const out = await app.get(AmRenewalWorker).run();
      process.stdout.write(JSON.stringify(out) + '\n');
      return;
    }
    process.stderr.write('usage: run_am_job.ts health|renewal\n');
    process.exitCode = 2;
  } finally {
    await app.close();
  }
}

void main();
