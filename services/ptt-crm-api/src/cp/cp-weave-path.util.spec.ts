import {
  buildWeaveExportRelPath,
  nextWeaveTaskId,
  parseWeaveExportKey,
  parseWeaveFileName,
} from './cp-weave-path.util';

describe('cp-weave-path', () => {
  it('parses the Mức 2 convention path', () => {
    expect(parseWeaveExportKey(
      'nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4',
    )).toEqual({
      clientCode: 'nova',
      campaignCode: 'mid-autumn-2026',
      taskId: 'CR-2026-0912-028',
      lane: 'final',
      fileName: 'CR-2026-0912-028_v01_9x16.mp4',
    });
  });

  it('parses filename ratio and rejects unknown lanes', () => {
    expect(parseWeaveFileName('CR-2026-0912-028_v01_1x1.jpg')?.ratio).toBe('1x1');
    expect(parseWeaveExportKey('nova/mid-autumn-2026/CR-2026-0912-028/tmp/x.png')).toBeNull();
    expect(nextWeaveTaskId('2026-09-12', 28)).toBe('CR-2026-0912-028');
  });

  it('builds export relative path with trailing slash', () => {
    expect(buildWeaveExportRelPath({
      clientCode: 'nova',
      campaignCode: 'mid-autumn-2026',
      taskId: 'CR-2026-0912-028',
      lane: 'final',
    })).toBe('nova/mid-autumn-2026/CR-2026-0912-028/final/');
  });
});
