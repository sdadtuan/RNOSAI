import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';

type ReqWithStaff = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

function makeBudgetGuard(section: string, actions: string[]) {
  @Injectable()
  class BudgetGuard implements CanActivate {
    constructor(public readonly staffAuth: StaffAuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const req = context.switchToHttp().getRequest<ReqWithStaff>();
      if (req.staffAuthVia === 'internal') return true;
      if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
      const me = await this.staffAuth.me(req.staffUser);
      const ok = actions.some((action) => this.staffAuth.hasCap(me.caps, section, action));
      if (!ok) {
        throw new ForbiddenException({ error: 'missing_cap', section });
      }
      return true;
    }
  }
  return BudgetGuard;
}

@Injectable()
export class StaffDeliveryBudgetViewGuard extends makeBudgetGuard('crm_delivery_budget', ['view']) {}

@Injectable()
export class StaffDeliveryBudgetEditGuard extends makeBudgetGuard('crm_delivery_budget', ['edit']) {}

@Injectable()
export class StaffDeliveryBudgetApproveGuard extends makeBudgetGuard('crm_delivery_budget', ['approve']) {}
