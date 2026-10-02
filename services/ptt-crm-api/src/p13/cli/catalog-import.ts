import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import { importCatalog, sha256Text } from '../catalog/catalog-import';
import { PgCatalog } from '../catalog/pg-catalog';

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function option(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function resolveSeed(fileArg: string): string {
  const candidates = [
    resolve(process.cwd(), fileArg),
    resolve(process.cwd(), '../..', fileArg),
    resolve(__dirname, '../../../../..', fileArg),
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0];
}

async function main(): Promise<void> {
  const fileArg = option('--file') ?? 'docs/p13/p13-seed-v2.json';
  const filePath = resolveSeed(fileArg);
  const text = readFileSync(filePath, 'utf8');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const summary = await importCatalog(new PgCatalog(pool), JSON.parse(text) as unknown, {
      dryRun: flag('--dry-run'),
      forceHours: flag('--force-hours'),
      deactivateMissing: flag('--deactivate-missing'),
      fileName: fileArg.split('/').pop() || fileArg,
      fileSha256: sha256Text(text),
      actor: process.env.P13_IMPORT_ACTOR || 'cli',
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
