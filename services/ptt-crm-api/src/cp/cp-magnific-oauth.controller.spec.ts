import { GUARDS_METADATA } from '@nestjs/common/constants';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CpMagnificOAuthCallbackController } from './cp-magnific-oauth.controller';
import { createMagnificOAuthState } from './cp-magnific-oauth.util';
import { CpController } from './cp.controller';
import { StaffCpGuard } from './guards/staff-cp.guard';
import { CpProviderConnectionsService } from './cp-provider-connections.service';

const CONNECTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class ConnectionsMemory {
  rows: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('INSERT INTO crm_cp_provider_connections')) {
      const row = {
        id: CONNECTION_ID,
        provider: params[0],
        status: params[1],
        account_label: params[2] ?? null,
        secret_ref: params[3],
        expires_at: params[4] ?? null,
        created_by_staff_id: params[5],
      };
      this.rows.push(row);
      return { rows: [row] };
    }
    if (sql.includes('FROM crm_cp_provider_connections')) {
      return { rows: this.rows.map((row) => ({ ...row })) };
    }
    return { rows: [] };
  }
}

describe('CpMagnificOAuthCallbackController', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = { ...envBackup, PTT_SECRET_ENCRYPT_KEY: 'a'.repeat(32) };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('is not behind StaffOrInternalKeyGuard or StaffCpGuard', () => {
    const classGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      CpMagnificOAuthCallbackController,
    ) ?? []) as unknown[];
    const methodGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      CpMagnificOAuthCallbackController.prototype.callback,
    ) ?? []) as unknown[];

    expect(classGuards).toHaveLength(0);
    expect(methodGuards).toHaveLength(0);
    expect(classGuards).not.toContain(StaffOrInternalKeyGuard);
    expect(classGuards).not.toContain(StaffCpGuard);
    expect(methodGuards).not.toContain(StaffOrInternalKeyGuard);
    expect(methodGuards).not.toContain(StaffCpGuard);
    expect(CpController.prototype).not.toHaveProperty('magnificOAuthCallback');
  });

  it('completes oauth from signed state with only code+state and no Bearer', async () => {
    const { state } = createMagnificOAuthState({ staffId: 9 });
    const encrypt = jest.fn().mockReturnValue('enc:oauth');
    const exchange = jest.fn().mockResolvedValue({
      access_token: 'tok_live',
      refresh_token: 'ref_live',
    });
    const service = new CpProviderConnectionsService(
      new ConnectionsMemory(),
      encrypt,
      exchange,
    );
    const controller = new CpMagnificOAuthCallbackController(service);
    const res = { redirect: jest.fn() };

    await controller.callback('auth-code', state, res as never);

    expect(exchange).toHaveBeenCalledWith('auth-code');
    expect(encrypt).toHaveBeenCalled();
    expect(String(encrypt.mock.calls[0]?.[0])).toContain('tok_live');
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/\/crm\/creative-os\/settings\?.*tab=integrations.*magnific_oauth=ok/),
    );
    const location = String(res.redirect.mock.calls[0][0]);
    expect(location).not.toMatch(/tok_live|ref_live|Bearer |access_token/i);
  });
});
