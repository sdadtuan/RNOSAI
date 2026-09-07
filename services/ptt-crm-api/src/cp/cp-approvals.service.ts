import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CP_VIDEOS_QUERY, CpVideosQueryPort, CpVideosService, CpVideoScope } from './cp-videos.service';

export const APPROVAL_STATES = [
  'internal_review',
  'client_review',
  'changes_requested',
  'brand_approved',
  'legal_approved',
  'final_approved',
  'rejected',
] as const;

export type CpApprovalState = (typeof APPROVAL_STATES)[number];

export type CpApprovalInput = {
  status?: string;
  decision?: string | null;
  reason?: string | null;
};

export function isLegalApprovalInput(input: CpApprovalInput = {}): boolean {
  const status = String(input.status ?? '').trim();
  const decision = String(input.decision ?? '').trim();
  return (
    status === 'legal_approved'
    || decision === 'legal_approved'
    || decision === 'legal'
    || (status !== '' && approvalStepForStatus(status) === 'legal')
  );
}

export type CpVersionDiffField<T> = {
  a: T;
  b: T;
  changed: boolean;
};

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpApprovalsService {
  constructor(
    private readonly videos: CpVideosService,
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
  ) {}

  async submit(
    id: string,
    input: CpApprovalInput,
    actorId: number,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const version = await this.videos.getVersion(id, scope);
    const status = parseApprovalStatus(input.status);
    const step = approvalStepForStatus(status);
    if (!this.db.transaction) {
      cpThrow(500, { error: 'transaction_unavailable' });
    }
    return this.db.transaction(async (tx) => {
      const updated = await tx.query(
        `UPDATE crm_cp_video_versions
            SET approval_status = $2
          WHERE id = $1::uuid
          RETURNING *`,
        [version.id, status],
      );
      const row = updated.rows[0] ?? cpThrow(404, { error: 'not_found' });
      await tx.query(
        `INSERT INTO crm_cp_approvals (
           object_type, object_id, step, actor_id, decision, reason, at
         ) VALUES (
           $1, $2::uuid, $3, $4, $5, $6, now()
         )
         RETURNING *`,
        [
          'video_version',
          version.id,
          step,
          actorId,
          nullableText(input.decision) ?? status,
          nullableText(input.reason),
        ],
      );
      return { ...row, approval_status: status };
    });
  }

  async compareVersions(
    a: string,
    b: string,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const left = await this.videos.getVersion(a, scope);
    const right = await this.videos.getVersion(b, scope);
    return {
      metadata: diffField(extractMetadata(left), extractMetadata(right)),
      script: diffField(extractScript(left), extractScript(right)),
      kit_id: diffField(extractKitId(left), extractKitId(right)),
      asset_ids: diffField(extractAssetIds(left), extractAssetIds(right)),
      cost: diffField(extractCost(left), extractCost(right)),
    };
  }
}

export function approvalStepForStatus(status: string): string {
  switch (status) {
    case 'client_review':
      return 'client_review';
    case 'brand_approved':
      return 'brand';
    case 'legal_approved':
      return 'legal';
    case 'final_approved':
      return 'final';
    default:
      return 'internal_review';
  }
}

function parseApprovalStatus(value: unknown): CpApprovalState {
  const status = String(value ?? '').trim();
  if (!(APPROVAL_STATES as readonly string[]).includes(status)) {
    cpThrow(400, { error: 'invalid_approval_status' });
  }
  return status as CpApprovalState;
}

function extractMetadata(version: Record<string, unknown>) {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  const config = objectValue(draft.config_json ?? snapshot.config_json);
  return {
    name: draft.name ?? snapshot.name ?? version.draft_name ?? null,
    input_mode: draft.input_mode ?? snapshot.input_mode ?? null,
    prompt: draft.prompt ?? snapshot.prompt ?? null,
    ratio: config.ratio ?? null,
    duration: config.duration ?? null,
    style: config.style ?? null,
    locale: config.locale ?? null,
    voice: config.voice ?? null,
    model: config.model ?? null,
  };
}

function extractScript(version: Record<string, unknown>) {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  return draft.script_json ?? snapshot.script_json ?? null;
}

function extractKitId(version: Record<string, unknown>): string | null {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  const kit = objectValue(snapshot.kit_version);
  return nullableText(
    version.brand_kit_version_id
    ?? draft.brand_kit_version_id
    ?? kit.id
    ?? snapshot.brand_kit_version_id,
  );
}

function extractAssetIds(version: Record<string, unknown>): string[] {
  const snapshot = objectValue(version.snapshot_json);
  const raw = Array.isArray(snapshot.asset_versions)
    ? snapshot.asset_versions
    : Array.isArray(snapshot.asset_ids)
      ? snapshot.asset_ids
      : [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'id' in item) {
        return String((item as { id: unknown }).id ?? '');
      }
      return '';
    })
    .filter(Boolean)
    .sort();
}

function extractCost(version: Record<string, unknown>) {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  const config = objectValue(draft.config_json ?? snapshot.config_json);
  return {
    estimated_credits: config.estimated_credits ?? snapshot.cost ?? null,
    pricing_version: snapshot.pricing_version ?? version.pricing_version ?? null,
  };
}

function diffField<T>(a: T, b: T): CpVersionDiffField<T> {
  return { a, b, changed: JSON.stringify(a) !== JSON.stringify(b) };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
