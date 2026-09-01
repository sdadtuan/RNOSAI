import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { hashPortalPassword, verifyPortalPassword } from '../portal/portal-password.util';
import { positionRequiresMfa } from './staff-keycloak.util';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthAuditRepository } from './staff-auth-audit.repository';
import { StaffAccountRateLimiter } from './staff-account-rate.util';
import { staffAuditSummaryVi } from './staff-account-audit.util';
import { assertStaffAvatarUpload, contentTypeForAvatarExt } from './staff-avatar-image.util';
import type {
  StaffAccountAuditResponse,
  StaffAccountBundleResponse,
  StaffAccountProfile,
  StaffAccountSessionsResponse,
  StaffAccountTeam,
} from './staff-account.types';
import { StaffAvatarStorage } from './staff-avatar.storage';
import { StaffJwtPayload } from './staff-jwt.util';
import { isUuidStaffUserId, sessionToListItem, StaffSessionsRepository } from './staff-sessions.repository';
import { parseNumericStaffSub } from './staff-user-id.util';

const PASSWORD_WINDOW_MS = 15 * 60_000;
const PASSWORD_MAX = 5;
const AVATAR_MAX = 10;

@Injectable()
export class StaffAccountService {
  private pool: Pool | null = null;
  private readonly rateLimiter = new StaffAccountRateLimiter();

  constructor(
    private readonly config: AppConfigService,
    private readonly auth: StaffAuthService,
    private readonly sessions: StaffSessionsRepository,
    private readonly avatarStorage: StaffAvatarStorage,
    private readonly authAudit: StaffAuthAuditRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async buildProfile(user: StaffJwtPayload): Promise<StaffAccountProfile> {
    const base = await this.auth.me(user);
    const extras = await this.loadAccountExtras(user.sub);
    return { ...base, ...extras };
  }

  async getBundle(user: StaffJwtPayload): Promise<StaffAccountBundleResponse> {
    const profile = await this.buildProfile(user);
    const sessions = await this.listSessions(user);
    const audit = await this.listAudit(user, 20);
    return { profile, sessions, audit };
  }

  async changePassword(
    user: StaffJwtPayload,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true; message: 'password_updated' }> {
    if (!this.config.staffNestLoginAllowed()) {
      throw new BadRequestException({ error: 'password_change_sso_only' });
    }
    if (!isUuidStaffUserId(user.sub)) {
      throw new BadRequestException({ error: 'password_change_not_available' });
    }
    if (!this.rateLimiter.hit('password', user.sub, PASSWORD_WINDOW_MS, PASSWORD_MAX)) {
      throw new BadRequestException({ error: 'rate_limited' });
    }

    const row = await this.loadPasswordRow(user.sub);
    if (!row?.password_hash) {
      throw new BadRequestException({ error: 'password_change_not_available' });
    }

    const current = currentPassword?.trim() ?? '';
    const next = newPassword?.trim() ?? '';
    if (!verifyPortalPassword(current, row.password_hash)) {
      throw new UnauthorizedException({ error: 'invalid_current_password' });
    }
    if (next.length < 8) {
      throw new BadRequestException({ error: 'password_too_short', min_length: 8 });
    }
    if (current === next) {
      throw new BadRequestException({ error: 'password_unchanged' });
    }

    await this.db.query(
      `UPDATE staff_users SET password_hash = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [user.sub, hashPortalPassword(next)],
    );

    const now = new Date();
    if (user.sid) {
      await this.sessions.revokeOthers(user.sub, user.sid, 'password_changed', now);
    }
    void this.authAudit.write('password_changed', { userId: user.sub, email: user.email });
    return { ok: true, message: 'password_updated' };
  }

  async listSessions(user: StaffJwtPayload): Promise<StaffAccountSessionsResponse> {
    if (!isUuidStaffUserId(user.sub)) {
      return { current_sid: user.sid ?? null, items: [] };
    }
    const now = new Date();
    const rows = await this.sessions.listForUser(user.sub, now);
    return {
      current_sid: user.sid ?? null,
      items: rows.map((row) => sessionToListItem(row, user.sid ?? null)),
    };
  }

  async revokeOne(
    user: StaffJwtPayload,
    sessionId: string,
  ): Promise<{ ok: true; already_revoked?: true; current_revoked?: true }> {
    if (!isUuidStaffUserId(user.sub)) {
      throw new BadRequestException({ error: 'session_binding_required' });
    }
    const now = new Date();
    const result = await this.sessions.revoke(sessionId, user.sub, 'user_revoke', now);
    if (result === 'not_found') {
      throw new NotFoundException({ error: 'session_not_found' });
    }
    if (result === 'already_revoked') {
      return { ok: true, already_revoked: true };
    }
    void this.authAudit.write('session_revoked', {
      userId: user.sub,
      email: user.email,
      detail: { sid: sessionId },
    });
    if (sessionId === user.sid) {
      return { ok: true, current_revoked: true };
    }
    return { ok: true };
  }

  async revokeOthers(user: StaffJwtPayload): Promise<{ ok: true; revoked: number }> {
    if (!user.sid) {
      throw new BadRequestException({ error: 'session_binding_required' });
    }
    if (!isUuidStaffUserId(user.sub)) {
      throw new BadRequestException({ error: 'session_binding_required' });
    }
    const now = new Date();
    const revoked = await this.sessions.revokeOthers(user.sub, user.sid, 'user_revoke_others', now);
    void this.authAudit.write('sessions_revoked_others', { userId: user.sub, email: user.email });
    return { ok: true, revoked };
  }

  async revokeAll(user: StaffJwtPayload): Promise<{ ok: true }> {
    if (!isUuidStaffUserId(user.sub)) {
      throw new BadRequestException({ error: 'session_binding_required' });
    }
    const now = new Date();
    await this.sessions.revokeAll(user.sub, 'user_revoke_all', now);
    await this.db.query(
      `UPDATE staff_users SET auth_token_version = auth_token_version + 1, updated_at = NOW() WHERE id = $1::uuid`,
      [user.sub],
    );
    void this.authAudit.write('sessions_revoked_all', { userId: user.sub, email: user.email });
    void this.authAudit.write('token_revoked', { userId: user.sub, email: user.email });
    return { ok: true };
  }

  async listAudit(user: StaffJwtPayload, limit = 20): Promise<StaffAccountAuditResponse> {
    const capped = Math.min(Math.max(limit, 1), 50);
    if (!isUuidStaffUserId(user.sub)) {
      return { items: [] };
    }
    try {
      const result = await this.db.query<{ id: string; event_type: string; created_at: Date }>(
        `SELECT id::text, event_type, created_at
         FROM staff_auth_audit
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2`,
        [user.sub, capped],
      );
      return {
        items: result.rows.map((row) => ({
          id: row.id,
          event_type: row.event_type,
          created_at: new Date(row.created_at).toISOString(),
          summary_vi: staffAuditSummaryVi(row.event_type),
        })),
      };
    } catch {
      return { items: [] };
    }
  }

  async uploadAvatar(
    user: StaffJwtPayload,
    file?: Express.Multer.File,
  ): Promise<{ ok: true; has_avatar: true; avatar_updated_at: string }> {
    if (!isUuidStaffUserId(user.sub) || parseNumericStaffSub(user.sub) != null) {
      throw new BadRequestException({ error: 'avatar_not_available' });
    }
    if (!this.rateLimiter.hit('avatar', user.sub, PASSWORD_WINDOW_MS, AVATAR_MAX)) {
      throw new BadRequestException({ error: 'rate_limited' });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'file_required' });
    }
    try {
      assertStaffAvatarUpload({
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'invalid_image';
      throw new BadRequestException({ error: code });
    }

    const oldKey = await this.loadAvatarKey(user.sub);
    const { storageKey } = this.avatarStorage.save(user.sub, file.buffer, file.mimetype);
    const updatedAt = new Date();
    await this.db.query(
      `UPDATE staff_users SET avatar_storage_key = $2, avatar_updated_at = $3, updated_at = NOW() WHERE id = $1::uuid`,
      [user.sub, storageKey, updatedAt],
    );
    if (oldKey && oldKey !== storageKey) {
      this.avatarStorage.remove(oldKey);
    }
    void this.authAudit.write('avatar_updated', { userId: user.sub, email: user.email });
    return { ok: true, has_avatar: true, avatar_updated_at: updatedAt.toISOString() };
  }

  async deleteAvatar(
    user: StaffJwtPayload,
  ): Promise<{ ok: true; has_avatar: false; already_removed?: true }> {
    if (!isUuidStaffUserId(user.sub)) {
      throw new BadRequestException({ error: 'avatar_not_available' });
    }
    const oldKey = await this.loadAvatarKey(user.sub);
    if (!oldKey) {
      return { ok: true, has_avatar: false, already_removed: true };
    }
    this.avatarStorage.remove(oldKey);
    await this.db.query(
      `UPDATE staff_users SET avatar_storage_key = NULL, avatar_updated_at = NULL, updated_at = NOW() WHERE id = $1::uuid`,
      [user.sub],
    );
    void this.authAudit.write('avatar_removed', { userId: user.sub, email: user.email });
    return { ok: true, has_avatar: false };
  }

  async readAvatar(user: StaffJwtPayload): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!isUuidStaffUserId(user.sub)) return null;
    const key = await this.loadAvatarKey(user.sub);
    if (!key) return null;
    const buffer = this.avatarStorage.read(key);
    if (!buffer) return null;
    const ext = key.split('.').pop() ?? 'jpg';
    return { buffer, contentType: contentTypeForAvatarExt(ext) };
  }

  private async loadPasswordRow(userId: string): Promise<{ password_hash: string } | null> {
    try {
      const result = await this.db.query<{ password_hash: string }>(
        `SELECT password_hash FROM staff_users WHERE id = $1::uuid AND active IS TRUE LIMIT 1`,
        [userId],
      );
      return result.rows[0] ?? null;
    } catch {
      return null;
    }
  }

  private async loadAvatarKey(userId: string): Promise<string | null> {
    try {
      const result = await this.db.query<{ avatar_storage_key: string | null }>(
        `SELECT avatar_storage_key FROM staff_users WHERE id = $1::uuid LIMIT 1`,
        [userId],
      );
      const key = result.rows[0]?.avatar_storage_key;
      return key ? String(key) : null;
    } catch {
      return null;
    }
  }

  private async loadAccountExtras(userId: string): Promise<Partial<StaffAccountProfile>> {
    if (!isUuidStaffUserId(userId)) {
      return {
        password_login_enabled: false,
        sso_enabled: this.config.staffAuthMode !== 'nest' && Boolean(this.config.staffKeycloakIssuer),
        oidc_linked: false,
        has_avatar: false,
        teams: [],
      };
    }
    try {
      const result = await this.db.query<{
        account_kind: string | null;
        last_login_at: Date | null;
        oidc_sub: string | null;
        password_hash: string | null;
        avatar_storage_key: string | null;
        avatar_updated_at: Date | null;
      }>(
        `SELECT account_kind, last_login_at, oidc_sub, password_hash, avatar_storage_key, avatar_updated_at
         FROM staff_users WHERE id = $1::uuid LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      const teams = await this.loadTeams(userId);
      const issuer = this.config.staffKeycloakIssuer;
      const nestAllowed = this.config.staffNestLoginAllowed();
      const positionIdRow = await this.db.query<{ position_id: number }>(
        `SELECT position_id FROM staff_users WHERE id = $1::uuid LIMIT 1`,
        [userId],
      );
      const posId = Number(positionIdRow.rows[0]?.position_id ?? 0);
      const posCode = await this.auth.loadPositionCodePublic(posId);
      return {
        account_kind: row?.account_kind ? String(row.account_kind) : undefined,
        last_login_at: row?.last_login_at ? new Date(row.last_login_at).toISOString() : null,
        oidc_linked: Boolean(row?.oidc_sub),
        password_login_enabled: nestAllowed && Boolean(row?.password_hash),
        sso_enabled: this.config.staffAuthMode !== 'nest' && Boolean(issuer),
        mfa_required_for_position: positionRequiresMfa(
          posCode,
          this.config.staffMfaRequiredPositionCodes,
        ),
        keycloak_account_url: issuer ? `${issuer.replace(/\/$/, '')}/account` : null,
        teams,
        has_avatar: Boolean(row?.avatar_storage_key),
        avatar_updated_at: row?.avatar_updated_at
          ? new Date(row.avatar_updated_at).toISOString()
          : null,
      };
    } catch {
      return {};
    }
  }

  private async loadTeams(userId: string): Promise<StaffAccountTeam[]> {
    try {
      const result = await this.db.query<{ id: number; name: string }>(
        `SELECT t.id, t.name
         FROM staff_user_teams sut
         JOIN crm_teams t ON t.id = sut.team_id
         WHERE sut.user_id = $1::uuid
         ORDER BY t.name`,
        [userId],
      );
      return result.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
    } catch {
      return [];
    }
  }
}
