import { Module, forwardRef } from '@nestjs/common';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';
import { StaffBreakGlassModule } from '../staff-break-glass/staff-break-glass.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffPermissionSetsModule } from '../staff-permission-sets/staff-permission-sets.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffSsoAdminController } from './staff-sso-admin.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffAccountService } from './staff-account.service';
import { StaffAuthAuditRepository } from './staff-auth-audit.repository';
import { StaffKeycloakGroupsRepository } from './staff-keycloak-groups.repository';
import { StaffSessionsRepository } from './staff-sessions.repository';
import { StaffAvatarStorage } from './staff-avatar.storage';
import { StaffJwtGuard } from './staff-jwt.guard';
import { StaffOrInternalKeyGuard } from './staff-or-internal-key.guard';

@Module({
  imports: [
    forwardRef(() => StaffPermissionsModule),
    forwardRef(() => StaffPermissionSetsModule),
    forwardRef(() => StaffBreakGlassModule),
    forwardRef(() => StaffClientScopeModule),
  ],
  controllers: [StaffAuthController, StaffSsoAdminController],
  providers: [
    StaffAuthService,
    StaffAccountService,
    StaffAuthAuditRepository,
    StaffKeycloakGroupsRepository,
    StaffSessionsRepository,
    StaffAvatarStorage,
    StaffJwtGuard,
    StaffOrInternalKeyGuard,
  ],
  exports: [StaffAuthService, StaffAccountService, StaffJwtGuard, StaffOrInternalKeyGuard],
})
export class StaffAuthModule {}
