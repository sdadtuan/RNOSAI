import { Injectable } from '@nestjs/common';
import { IwrPolicyRepository } from './iwr-policy.repository';
import type { IwrRecipientPolicyRules } from './iwr-recipient.util';

@Injectable()
export class IwrPolicyService {
  constructor(private readonly repo: IwrPolicyRepository) {}

  async getActiveRules(): Promise<IwrRecipientPolicyRules | null> {
    return this.repo.getActivePolicy();
  }
}
