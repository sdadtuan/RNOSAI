import { Injectable } from '@nestjs/common';
import { buildBrandContextJson } from './content-plan-snapshot.util';

@Injectable()
export class ContentBrandContextService {
  buildFromBrief(brief: Record<string, unknown>): Record<string, unknown> {
    return buildBrandContextJson(brief);
  }
}
