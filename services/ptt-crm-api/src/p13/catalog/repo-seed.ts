import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const RELATIVE = join('docs', 'p13', 'p13-seed-v2.json');

export function repoCatalogSeedPath(): string {
  const candidates = [
    join(process.cwd(), RELATIVE),
    join(process.cwd(), '..', '..', RELATIVE),
    join(__dirname, '..', '..', '..', '..', '..', RELATIVE),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`missing repo seed ${RELATIVE}`);
  return found;
}

export function readRepoCatalogSeed(): { text: string; fileName: string } {
  const path = repoCatalogSeedPath();
  return { text: readFileSync(path, 'utf8'), fileName: 'p13-seed-v2.json' };
}
