import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  WEAVE_EMPTY_ORDERS,
  WEAVE_HUB_RULE,
  WEAVE_PATH_PATTERN,
  weaveEmptyCopy,
  weaveExportPrefix,
  weaveSyncNotice,
} from './cp-weave-composer.util';

describe('weaveEmptyCopy', () => {
  it('keeps dash when Weave is off and names the empty list when on', () => {
    expect(weaveEmptyCopy(false, 0)).toBe('—');
    expect(weaveEmptyCopy(true, 0)).toBe(WEAVE_EMPTY_ORDERS);
    expect(weaveEmptyCopy(true, 2)).toBe('');
    expect(WEAVE_EMPTY_ORDERS).toBe('Chưa có Work Order.');
  });
});

describe('weaveExportPrefix', () => {
  it('never invents folder names and shows the locked convention', () => {
    expect(WEAVE_PATH_PATTERN).toBe('{client_code}/{campaign_code}/{task_id}/{lane}/');
    expect(weaveExportPrefix(null)).toBe(WEAVE_PATH_PATTERN);
    expect(weaveExportPrefix({ client_code: 'nova' })).toBe(WEAVE_PATH_PATTERN);
    expect(weaveExportPrefix({
      client_code: 'nova',
      campaign_code: 'mid-autumn-2026',
      task_id: 'CR-2026-0912-028',
    })).toBe('nova/mid-autumn-2026/CR-2026-0912-028/{lane}/');
    expect(WEAVE_HUB_RULE).toMatch(/source\/ không gửi Hub/i);
    expect(WEAVE_HUB_RULE).toMatch(/review\/ và final\//);
  });
});

describe('weaveSyncNotice', () => {
  it('does not toast success when ingested is 0', () => {
    expect(weaveSyncNotice({ ingested: 0, scanned: 3, skipped: 3 })).toBe(
      'Không ingest file. Kiểm tra path convention.',
    );
    expect(weaveSyncNotice({ ingested: 2, scanned: 2, skipped: 0 })).toBe('Sync output: 2 file');
    expect(weaveSyncNotice({ ingested: 0 })).not.toMatch(/thành công/i);
  });
});

describe('CpWeaveWorkOrder composer', () => {
  it('renders locked path, hub rule, and empty copy without guessing folders', () => {
    const pane = readFileSync(new URL('../../components/crm/cp/CpWeaveWorkOrder.tsx', import.meta.url), 'utf8');
    expect(pane).toContain('weaveEmptyCopy');
    expect(pane).toContain('weaveExportPrefix');
    expect(pane).toContain('weaveSyncNotice');
    expect(pane).toContain('WEAVE_HUB_RULE');
    expect(pane).toContain('WEAVE_PATH_PATTERN');
    expect(pane).not.toContain('/crm/aco');
    expect(pane).not.toMatch(/đoán folder|guess folder/i);
  });
});
