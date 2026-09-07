import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CP_VIDEOS_QUERY, CpVideosQueryPort, CpVideosService, CpVideoScope } from './cp-videos.service';

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };
const COMMENT_STATUSES = ['open', 'in_progress', 'resolved'] as const;

export type CpCommentInput = {
  body?: string;
  timecode_ms?: number | null;
  mention_ids?: number[];
  status?: string;
};

@Injectable()
export class CpCommentsService {
  constructor(
    private readonly videos: CpVideosService,
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
  ) {}

  async list(id: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    const version = await this.videos.getVersion(id, scope);
    const result = await this.db.query(
      `SELECT *
         FROM crm_cp_comments
        WHERE object_type = 'video_version' AND object_id = $1::uuid
        ORDER BY created_at ASC, id ASC`,
      [version.id],
    );
    return { items: result.rows };
  }

  async create(
    id: string,
    input: CpCommentInput,
    actorId: number,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const version = await this.videos.getVersion(id, scope);
    const body = requiredText(input.body, 'body_required');
    const result = await this.db.query(
      `INSERT INTO crm_cp_comments (
         object_type, object_id, timecode_ms, body, status, mention_ids, created_by
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6, $7
       )
       RETURNING *`,
      [
        'video_version',
        version.id,
        optionalInteger(input.timecode_ms, 'invalid_timecode_ms'),
        body,
        parseStatus(input.status),
        parseMentions(input.mention_ids),
        actorId,
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }
}

function parseStatus(value: unknown): (typeof COMMENT_STATUSES)[number] {
  if (value == null || value === '') return 'open';
  const status = String(value).trim();
  if (!(COMMENT_STATUSES as readonly string[]).includes(status)) {
    cpThrow(400, { error: 'invalid_comment_status' });
  }
  return status as (typeof COMMENT_STATUSES)[number];
}

function parseMentions(value: unknown): number[] {
  if (value == null) return [];
  if (!Array.isArray(value)) cpThrow(400, { error: 'invalid_mention_ids' });
  return value.map((item) => {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) cpThrow(400, { error: 'invalid_mention_ids' });
    return id;
  });
}

function optionalInteger(value: unknown, error: string): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) cpThrow(400, { error });
  return number;
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
