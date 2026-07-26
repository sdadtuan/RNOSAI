import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';

@Injectable()
export class StaffAiCopilotGuard implements CanActivate {
  constructor(private readonly aiConfig: AiIntelligenceConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();

    if (req.staffAuthVia === 'internal') {
      return true;
    }

    if (!this.aiConfig.copilotEnabled) {
      throw new ServiceUnavailableException({
        error: 'ai_copilot_disabled',
        message: 'PTT_AI_COPILOT_ENABLED=0',
      });
    }

    const staffId = req.staffUser?.sub;
    if (!staffId) {
      throw new ForbiddenException({ error: 'staff_required' });
    }

    if (!this.aiConfig.isPilotUser(staffId)) {
      throw new ForbiddenException({ error: 'pilot_cohort_required', staff_id: staffId });
    }

    return true;
  }
}
