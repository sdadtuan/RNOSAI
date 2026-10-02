import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const FILES = [
  '2026-10-02-p13-01-service-catalog.sql',
  '2026-10-02-p13-02-holidays.sql',
];

export function readP13Sql(name: string): string {
  const candidates = [
    join(process.cwd(), 'docs/specs', name),
    join(process.cwd(), '../../docs/specs', name),
    join(__dirname, '../../../../../docs/specs', name),
    join(__dirname, '../../../../docs/specs', name),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error(`missing SQL ${name}`);
}

export function p13SchemaSql(): string {
  return FILES.map((name) => readP13Sql(name)).join('\n');
}
