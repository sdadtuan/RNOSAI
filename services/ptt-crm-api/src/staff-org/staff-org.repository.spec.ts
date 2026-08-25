import { BadRequestException } from '@nestjs/common';
import { StaffOrgRepository } from './staff-org.repository';

describe('StaffOrgRepository validation', () => {
  const db = { query: jest.fn() } as never;
  const repo = new StaffOrgRepository(db);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects empty department code', async () => {
    await expect(repo.createDepartment({ code: '  ', name: 'Phòng MKT' }, 'admin@test')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects empty team name', async () => {
    await expect(repo.createTeam({ code: 'TEAM-01', name: '' }, 'admin@test')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects empty position code', async () => {
    await expect(repo.createPosition({ code: '  ', name: 'Sales' }, 'admin@test')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
