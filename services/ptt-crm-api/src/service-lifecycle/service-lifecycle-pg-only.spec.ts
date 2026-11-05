import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const lifecycleDir = __dirname;

describe('service lifecycle PostgreSQL-only boundary', () => {
  it('contains no SQLite runtime dependency', () => {
    const files = [
      'service-lifecycle.service.ts',
      'service-lifecycle.module.ts',
      'lifecycle-consult.service.ts',
      'lifecycle-onboarding.service.ts',
      'lifecycle-launch-qa.service.ts',
      'lifecycle-finance-confirm.repository.ts',
      'lifecycle-tasks.repository.ts',
      'lifecycle-finance.util.ts',
      'lifecycle-context.util.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(lifecycleDir, file), 'utf8');
      expect(source).not.toContain('node:sqlite');
      expect(source).not.toContain('ServiceLifecycleSqliteRepository');
    }
    expect(existsSync(join(lifecycleDir, 'service-lifecycle-sqlite.repository.ts'))).toBe(false);
  });

  it('routes lifecycle services through PostgreSQL repositories', () => {
    const service = readFileSync(join(lifecycleDir, 'service-lifecycle.service.ts'), 'utf8');
    const consult = readFileSync(join(lifecycleDir, 'lifecycle-consult.service.ts'), 'utf8');
    const onboarding = readFileSync(join(lifecycleDir, 'lifecycle-onboarding.service.ts'), 'utf8');
    const launchQa = readFileSync(join(lifecycleDir, 'lifecycle-launch-qa.service.ts'), 'utf8');

    expect(service).toContain('ServiceLifecyclePgRepository');
    expect(service).toContain('LifecycleTasksPgRepository');
    expect(consult).toContain('ServiceLifecyclePgRepository');
    expect(consult).toContain('LifecycleTasksPgRepository');
    expect(onboarding).toContain('ServiceLifecyclePgRepository');
    expect(launchQa).toContain('ServiceLifecyclePgRepository');
  });
});
