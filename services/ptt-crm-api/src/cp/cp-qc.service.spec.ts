import {
  assertExportable,
  assertNotQcBlocked,
  CpQcService,
  evaluateQcChecks,
  QC_CHECK_KEYS,
} from './cp-qc.service';

const VERSION_ID = '55555555-5555-4555-8555-555555555555';
const SCOPE = { scope: 'all' as const, staffId: 9 };

const PASSING_FACTS = {
  width: 1080,
  height: 1920,
  duration_sec: 30,
  has_audio: true,
  safe_area_ok: true,
  caption_overflow: false,
  logo_present: true,
  cta_present: true,
  disclaimer_present: true,
  loudness_lufs: -14,
  black_frozen: false,
  moderation: 'ok',
};

class VersionPort {
  version: Record<string, unknown> = {
    id: VERSION_ID,
    draft_id: '44444444-4444-4444-8444-444444444444',
    snapshot_json: {},
    qc_status: null,
    qc_json: null,
    output_uri: 's3://cp/out.mp4',
  };

  async getVersion(id: string) {
    if (id !== VERSION_ID) throw Object.assign(new Error('not_found'), { status: 404 });
    return this.version;
  }
}

class QcQuery {
  lastSql = '';
  lastParams: unknown[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    if (sql.includes('UPDATE crm_cp_video_versions')) {
      return {
        rows: [{
          id: VERSION_ID,
          qc_status: params[1],
          qc_json: typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2],
        }],
      };
    }
    return { rows: [] };
  }
}

describe('evaluateQcChecks', () => {
  it('runs exactly the ten SRS check keys', () => {
    expect(QC_CHECK_KEYS).toEqual([
      'technical',
      'safe_area',
      'caption_overflow',
      'logo',
      'cta',
      'disclaimer',
      'missing_audio',
      'loudness',
      'black_frozen',
      'moderation',
    ]);
    const report = evaluateQcChecks(PASSING_FACTS);
    expect(Object.keys(report.checks)).toEqual([...QC_CHECK_KEYS]);
    expect(report.overall).toBe('passed');
  });

  it('rolls up blocked when any check is blocked', () => {
    const report = evaluateQcChecks({ ...PASSING_FACTS, has_audio: false });
    expect(report.checks.missing_audio.result).toBe('blocked');
    expect(report.overall).toBe('blocked');
  });

  it('rolls up warning when no check is blocked but one warns', () => {
    const report = evaluateQcChecks({ ...PASSING_FACTS, loudness_lufs: -20 });
    expect(report.checks.loudness.result).toBe('warning');
    expect(report.overall).toBe('warning');
  });
});

describe('CpQcService', () => {
  it('persists overall result on qc_status and the ten checks on qc_json', async () => {
    const videos = new VersionPort();
    const db = new QcQuery();
    const qc = new CpQcService(videos as never, db);

    const result = await qc.run(VERSION_ID, { has_audio: false }, SCOPE);

    expect(result.qc_status).toBe('blocked');
    expect(result.qc_json.overall).toBe('blocked');
    expect(Object.keys(result.qc_json.checks)).toEqual([...QC_CHECK_KEYS]);
    expect(db.lastSql).toContain('UPDATE crm_cp_video_versions');
    expect(db.lastSql).toContain('qc_status');
    expect(db.lastSql).toContain('qc_json');
  });

  it('export_final returns 409 qc_blocked when overall QC is blocked', async () => {
    const videos = new VersionPort();
    videos.version.qc_status = 'blocked';
    const qc = new CpQcService(videos as never, new QcQuery());

    await expect(qc.exportFinal(VERSION_ID, SCOPE)).rejects.toMatchObject({
      status: 409,
      error: 'qc_blocked',
    });
  });

  it('export_final succeeds when QC is not blocked', async () => {
    const videos = new VersionPort();
    videos.version.qc_status = 'passed';
    const qc = new CpQcService(videos as never, new QcQuery());

    await expect(qc.exportFinal(VERSION_ID, SCOPE)).resolves.toMatchObject({
      id: VERSION_ID,
      output_uri: 's3://cp/out.mp4',
    });
  });
});

describe('assertNotQcBlocked / assertExportable', () => {
  it('publish helper returns 409 qc_blocked for blocked QC', () => {
    expect(() => assertNotQcBlocked('blocked')).toThrow(
      expect.objectContaining({ status: 409, error: 'qc_blocked' }),
    );
    expect(() => assertExportable({ qc_status: 'blocked' })).toThrow(
      expect.objectContaining({ status: 409, error: 'qc_blocked' }),
    );
  });

  it('allows warning and passed versions through', () => {
    expect(() => assertNotQcBlocked('warning')).not.toThrow();
    expect(() => assertExportable({ qc_status: 'passed' })).not.toThrow();
  });
});
