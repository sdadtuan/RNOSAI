import { BadRequestException } from '@nestjs/common';
import { StaffJobFunctionsRepository } from './staff-job-functions.repository';

describe('StaffJobFunctionsRepository catalog validation', () => {
  const config = { databaseUrl: 'postgresql://test' } as never;
  const repo = new StaffJobFunctionsRepository(config);

  it('rejects empty code on create', async () => {
    await expect(
      repo.createFunction({ code: '  ', label: 'Video' }, 'admin@test'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty label on create', async () => {
    await expect(
      repo.createFunction({ code: 'video', label: '  ' }, 'admin@test'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
