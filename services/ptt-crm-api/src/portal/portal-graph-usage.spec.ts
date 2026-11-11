import {
  classifyGraphPath,
  extractGraphErrorCode,
  isGraphHardPauseCode,
  noteGraphError,
  noteGraphUsageSnapshot,
  parseGraphUsageHeader,
  recordGraphCall,
  resetGraphUsageForTests,
  shouldPauseGraph,
  usagePercent,
  graphUsageStatus,
} from './portal-graph-usage';

describe('portal-graph-usage', () => {
  beforeEach(() => {
    resetGraphUsageForTests();
  });

  it('parses flat X-App-Usage and business-use-case headers', () => {
    const app = parseGraphUsageHeader('{"call_count":12,"total_cputime":34,"total_time":56}');
    expect(app).toEqual({ call_count: 12, total_cputime: 34, total_time: 56, source: 'x-app-usage' });
    expect(usagePercent(app)).toBe(56);

    const biz = parseGraphUsageHeader('{"111":[{"call_count":80,"total_cputime":10,"total_time":20,"type":"pages"}]}');
    expect(biz?.call_count).toBe(80);
    expect(usagePercent(biz)).toBe(80);
  });

  it('classifies graph paths', () => {
    expect(classifyGraphPath('https://graph.facebook.com/v21.0/me/accounts?limit=100')).toBe('me_accounts');
    expect(classifyGraphPath('123/leadgen_forms?fields=name')).toBe('leads');
    expect(classifyGraphPath('123/conversations?fields=participants')).toBe('conversations');
    expect(classifyGraphPath('act_1/insights?level=account')).toBe('insights');
  });

  it('recognizes hard pause codes and extracts them from Graph bodies', () => {
    expect(isGraphHardPauseCode(4)).toBe(true);
    expect(isGraphHardPauseCode(17)).toBe(true);
    expect(isGraphHardPauseCode(10)).toBe(false);
    expect(extractGraphErrorCode({ error: { code: 4, message: 'Application request limit reached' } })).toBe(4);
  });

  it('pauses after high usage or hard-limit errors', () => {
    expect(shouldPauseGraph()).toBe(false);
    noteGraphUsageSnapshot({ call_count: 76, total_cputime: 10, total_time: 12, source: 'x-app-usage' });
    expect(shouldPauseGraph()).toBe(true);

    resetGraphUsageForTests();
    noteGraphError('(#4) Application request limit reached', 4);
    expect(shouldPauseGraph()).toBe(true);
  });

  it('counts calls by kind in the current hour window', () => {
    recordGraphCall('me_accounts');
    recordGraphCall('leads');
    recordGraphCall('leads');
    expect(graphUsageStatus().calls_this_hour).toEqual({ me_accounts: 1, leads: 2 });
  });
});
