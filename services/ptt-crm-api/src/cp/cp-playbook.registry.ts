import { HttpException } from '@nestjs/common';
import {
  CP_PLAYBOOK_IDS,
  CpPlaybookDefinition,
  CpPlaybookId,
} from './cp-playbook.types';

export const CP_PLAYBOOKS = {
  bds_social_916: {
    id: 'bds_social_916',
    line: 'PL-1',
    label: 'BĐS Social Ads · 9:16',
    template_slug: 'bds-social-916',
    qc_pack: 'bds_social',
    channels: ['meta_reels_916', 'meta_feed_45', 'meta_square_11'],
    vars: ['project_name', 'price_from', 'location', 'cta', 'hotline'],
    source: 're_project_products',
  },
  lead_social_916: {
    id: 'lead_social_916',
    line: 'PL-2',
    label: 'Lead Video Social · 9:16',
    template_slug: 'lead-social-916',
    qc_pack: 'lead_social',
    channels: ['meta_reels_916'],
    vars: ['hook_id', 'offer', 'primary_text'],
    source: 'manual',
    script_beats: ['hook', 'pain', 'ui_proof', 'form_crm', 'cta'],
  },
  tvc_short_169: {
    id: 'tvc_short_169',
    line: 'PL-3',
    label: 'Brand TVC ngắn · 16:9',
    template_slug: 'tvc-short-169',
    qc_pack: 'tvc_short',
    channels: ['youtube_169', 'meta_916_cutdown'],
    vars: ['brand_name', 'tagline', 'legal_disclaimer'],
    source: 'manual',
    sop_handoff: true,
  },
} as const satisfies Record<CpPlaybookId, CpPlaybookDefinition>;

export function listPlaybooks(): CpPlaybookDefinition[] {
  return CP_PLAYBOOK_IDS.map((id) => CP_PLAYBOOKS[id]);
}

export function getPlaybook(id: string): CpPlaybookDefinition {
  const key = id as CpPlaybookId;
  const playbook = CP_PLAYBOOKS[key];
  if (!playbook || playbook.id !== id) {
    cpThrow(404, { error: 'playbook_not_found' });
  }
  return playbook;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
