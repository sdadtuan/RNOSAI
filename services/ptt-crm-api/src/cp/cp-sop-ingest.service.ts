import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CpPlaybookId } from './cp-playbook.types';
import { CpQcService, QcFacts } from './cp-qc.service';
import {
  CP_VIDEOS_QUERY,
  CpVideosQueryPort,
  CpVideosService,
  CpVideoScope,
} from './cp-videos.service';

export type CpSopIngestInput = {
  draft_id?: string;
  project_id?: string;
  name?: string;
  output_uri?: string;
  playbook_id?: CpPlaybookId;
  facts?: QcFacts;
};

export type CpSopIngestResult = {
  draft_id: string;
  version_id: string;
  href: string;
  qc_status?: string | null;
};

const DEFAULT_PLAYBOOK: CpPlaybookId = 'tvc_short_169';
const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpSopIngestService {
  constructor(
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
    private readonly videos: CpVideosService,
    private readonly qc: CpQcService,
  ) {}

  async ingestFromSop(
    input: CpSopIngestInput = {},
    scope: CpVideoScope = DEFAULT_SCOPE,
  ): Promise<CpSopIngestResult> {
    const projectId = requiredUuid(input.project_id, 'project_id_required', 'invalid_project_id');
    const name = requiredText(input.name, 'name_required');
    const outputUri = requiredText(input.output_uri, 'output_uri_required');
    const playbookId = parsePlaybookId(input.playbook_id ?? DEFAULT_PLAYBOOK);

    const draft = input.draft_id
      ? await this.patchDraft(input.draft_id, { name, playbook_id: playbookId }, scope)
      : await this.videos.upsertDraft(
        {
          project_id: projectId,
          name,
          input_mode: 'url',
          config_json: {
            playbook_id: playbookId,
            source: 'sop_ingest',
          },
        },
        scope,
      );

    const draftId = String(draft.id);
    const version = await this.insertVersion(draftId, draft, outputUri);
    const versionId = String(version.id);

    let qcStatus = version.qc_status == null ? null : String(version.qc_status);
    if (input.facts && Object.keys(input.facts).length > 0) {
      const qcResult = await this.qc.run(
        versionId,
        input.facts,
        scope,
        { pack: 'tvc_short' },
      );
      qcStatus = qcResult.qc_status == null ? null : String(qcResult.qc_status);
    }

    return {
      draft_id: draftId,
      version_id: versionId,
      href: `/crm/creative-os/video/${draftId}?version=${versionId}`,
      qc_status: qcStatus,
    };
  }

  private async patchDraft(
    draftId: string,
    input: { name: string; playbook_id: CpPlaybookId },
    scope: CpVideoScope,
  ) {
    const current = await this.videos.get(draftId, scope);
    const config = asRecord(current.config_json);
    return this.videos.patchDraft(
      draftId,
      {
        name: input.name,
        config_json: {
          ...config,
          playbook_id: input.playbook_id,
          source: 'sop_ingest',
        },
      },
      scope,
    );
  }

  private async insertVersion(
    draftId: string,
    draft: Record<string, unknown>,
    outputUri: string,
  ) {
    const write = async (tx: CpVideosQueryPort) => {
      await tx.query(
        `SELECT id FROM crm_cp_video_drafts WHERE id = $1::uuid FOR UPDATE`,
        [draftId],
      );
      const next = await tx.query(
        `SELECT COALESCE(MAX(version_n), 0) + 1 AS next_n
           FROM crm_cp_video_versions
          WHERE draft_id = $1::uuid`,
        [draftId],
      );
      const versionN = Number(next.rows[0]?.next_n ?? 1);
      const snapshot = {
        draft,
        output_uri: outputUri,
        source: 'sop_ingest',
      };
      const inserted = await tx.query(
        `INSERT INTO crm_cp_video_versions (
           draft_id, version_n, snapshot_json, qc_status, approval_status,
           immutable, output_uri, pricing_version
         ) VALUES (
           $1::uuid, $2, $3::jsonb, NULL, 'internal_review', TRUE, $4, NULL
         )
         RETURNING *`,
        [draftId, versionN, JSON.stringify(snapshot), outputUri],
      );
      return inserted.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
    };

    if (this.db.transaction) return this.db.transaction(write);
    return write(this.db);
  }
}

function parsePlaybookId(value: string): CpPlaybookId {
  if (value === 'tvc_short_169') return value;
  cpThrow(400, { error: 'invalid_playbook_id' });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function requiredUuid(value: unknown, missingError: string, invalidError: string): string {
  const id = String(value ?? '').trim();
  if (!id) cpThrow(400, { error: missingError });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error: invalidError });
  }
  return id;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
