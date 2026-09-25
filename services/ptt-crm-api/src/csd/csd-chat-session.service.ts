import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { verifyPortalPassword } from '../portal/portal-password.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { signStaffJwt, verifyStaffJwt, type StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdChatAccountsRepository } from './csd-chat-accounts.repository';

export type CsdChatSessionResult = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  staff_id: number;
  username: string;
  email: string;
  display_name: string;
  position_id: number;
  caps: { section: string; action: string }[];
  refresh_token?: undefined;
};

@Injectable()
export class CsdChatSessionService {
  constructor(
    private readonly repo: CsdChatAccountsRepository,
    private readonly config: AppConfigService,
    @Optional() private readonly staffAuth?: StaffAuthService,
  ) {}

  async openSession(input: { username?: string; password?: string }): Promise<CsdChatSessionResult> {
    const username = (input.username ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const row = username ? await this.repo.findByUsername(username) : null;
    const staff = row ? await this.repo.findCrmStaff(row.staff_id) : null;
    const passwordOk =
      Boolean(row?.password_hash) && verifyPortalPassword(password, row!.password_hash!);
    const ok = Boolean(row?.enabled && row.username && staff) && passwordOk;
    if (!ok || !row || !staff || !row.username) {
      throw new UnauthorizedException({ error: 'invalid_chat_credentials' });
    }

    const email = staff.staff_email.trim() || `staff-${row.staff_id}@chat.pttads.vn`;
    const displayName = row.display_name_vi || staff.staff_name || row.username;
    const positionId = staff.position_id ?? 0;
    const access_token = signStaffJwt(
      {
        sub: String(row.staff_id),
        email,
        display_name: displayName,
        position_id: positionId,
        token_type: 'access',
        scope: 'chat',
      },
      this.config.staffJwtSecret,
      this.config.staffJwtTtlSec,
    );

    return {
      access_token,
      token_type: 'Bearer',
      expires_in: this.config.staffJwtTtlSec,
      staff_id: row.staff_id,
      username: row.username,
      email,
      display_name: displayName,
      position_id: positionId,
      caps: await this.csdCaps(access_token),
    };
  }

  private async csdCaps(accessToken: string): Promise<{ section: string; action: string }[]> {
    if (!this.staffAuth) return [];
    const payload = verifyStaffJwt(accessToken, this.config.staffJwtSecret);
    if (!payload) return [];
    try {
      const me = await this.staffAuth.me(payload as StaffJwtPayload);
      return me.caps.filter((cap) => cap.section === 'csd');
    } catch {
      return [];
    }
  }
}
