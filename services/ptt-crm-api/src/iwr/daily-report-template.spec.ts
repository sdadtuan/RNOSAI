import {
  applyDailyTemplate,
  dailyDraftIsOverdue,
  ictYmd,
  reportTemplateForPosition,
  sanitizeDailyMetrics,
  validateDailyReport,
  type DailyReportCheckInput,
  type DailyReportLine,
  type DailyReportTemplateCode,
} from './daily-report-template';

const TODAY = '2026-10-06';

function line(partial: Partial<DailyReportLine> & Pick<DailyReportLine, 'section'>): DailyReportLine {
  return {
    title: 'Việc',
    text: 'Đã hoàn thành tối ưu ngân sách và ghi lại kết quả cho team.',
    project: 'PTT',
    kpi: 'CPL',
    kpiWaived: false,
    kpiWaiveReason: '',
    progress: partial.section === 'done' ? 100 : null,
    eta: partial.section === 'wip' ? TODAY : '',
    evidenceUrl: partial.section === 'done' ? 'https://ads.example/c/1' : '',
    evidenceName: '',
    assetType: '',
    campaign: '',
    adAccount: '',
    customerAccount: '',
    meeting: false,
    calendarUrl: '',
    ...partial,
  };
}

function input(template: DailyReportTemplateCode, partial: Partial<DailyReportCheckInput> = {}): DailyReportCheckInput {
  return {
    template,
    subject: 'Báo cáo ngày 06/10',
    reportDate: TODAY,
    todayYmd: TODAY,
    toStaffId: 2,
    toActive: true,
    summary: 'Tóm tắt ngày làm việc đủ dài để QL đọc nhanh phần kết quả, vướng mắc và việc ngày mai.',
    slaEnabled: false,
    slaThresholdPct: 80,
    duplicateSubmitted: false,
    lines: [],
    metrics: {
      adSpendVnd: null,
      crmSpendVnd: null,
      spendNote: '',
      newLeads: null,
      callsWithin15: null,
      slaPct: null,
      newAppointments: null,
    },
    ...partial,
  };
}

describe('daily report template', () => {
  it('maps one primary template from position and blocks an unknown role', () => {
    expect(reportTemplateForPosition('GD')).toBe('content_edit');
    expect(reportTemplateForPosition('ae')).toBe('cskh_sales');
    expect(reportTemplateForPosition('MKL')).toBe('buyer_ads');
    expect(reportTemplateForPosition('PD')).toBeNull();
  });

  it('keeps the draft snapshot when the position template changes', () => {
    const previous = {
      daily_role: { report_template: 'content_edit', assigned_by: 'server', sla_enabled: false },
    };
    const next = applyDailyTemplate({ daily_role: { metrics: { ad_spend_vnd: 9 } } }, previous, 'MKL');
    const role = next.daily_role as { report_template: string; metrics: { ad_spend_vnd: number | null } };
    expect(role.report_template).toBe('content_edit');
    expect(role.metrics.ad_spend_vnd).toBeNull();
  });

  it('strips ads and lead numbers on the content template', () => {
    expect(sanitizeDailyMetrics('content_edit', { ad_spend_vnd: 1500, new_leads: 4 }).adSpendVnd).toBeNull();
    expect(sanitizeDailyMetrics('content_edit', { ad_spend_vnd: 1500, new_leads: 4 }).newLeads).toBeNull();
  });

  it('V1 rejects a result row without a project', () => {
    const issues = validateDailyReport(
      input('content_edit', {
        lines: [line({ section: 'done', project: '', assetType: 'ảnh' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V1');
  });

  it('V2 rejects done progress between 1 and 99', () => {
    const issues = validateDailyReport(
      input('content_edit', {
        lines: [line({ section: 'done', progress: 50, assetType: 'video' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V2');
  });

  it('V3 rejects a placeholder description', () => {
    const issues = validateDailyReport(
      input('content_edit', {
        lines: [line({ section: 'done', text: 'ok', assetType: 'copy' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V3');
  });

  it('V4 rejects a finished row without evidence', () => {
    const issues = validateDailyReport(
      input('am_account', {
        metrics: { ...input('am_account').metrics, newLeads: 1 },
        lines: [line({ section: 'done', evidenceUrl: '', evidenceName: '', customerAccount: 'Spa ABC' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V4');
  });

  it('V5 rejects a WIP row whose ETA is before today', () => {
    const issues = validateDailyReport(
      input('am_account', {
        metrics: { ...input('am_account').metrics, newLeads: 0 },
        lines: [line({ section: 'wip', eta: '2026-10-05', customerAccount: 'Spa ABC' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V5');
  });

  it('V17 rejects WIP progress at 100 and asks to move it to done', () => {
    const issues = validateDailyReport(
      input('content_edit', {
        lines: [line({ section: 'wip', progress: 100, eta: TODAY, assetType: 'video' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V17');
    expect(issues.find((issue) => issue.code === 'VALIDATION_V17')?.message).toMatch(/hoàn thành/);
  });

  it('flags an unsent daily draft after 22:00 ICT of its period', () => {
    expect(
      dailyDraftIsOverdue({
        templateCode: 'daily_work',
        status: 'draft',
        periodYmd: '2026-10-06',
        now: new Date('2026-10-07T10:00:00+07:00'),
      }),
    ).toBe(true);
    expect(
      dailyDraftIsOverdue({
        templateCode: 'daily_work',
        status: 'draft',
        periodYmd: '2026-10-07',
        now: new Date('2026-10-07T15:00:00+07:00'),
      }),
    ).toBe(false);
  });

  it('V11 rejects buyer spend missing and a CRM gap without a note', () => {
    const missing = validateDailyReport(
      input('buyer_ads', { lines: [line({ section: 'done', campaign: 'PTT - Prospecting' })] }),
    );
    expect(missing.map((issue) => issue.code)).toContain('VALIDATION_V11');

    const gap = validateDailyReport(
      input('buyer_ads', {
        metrics: { ...input('buyer_ads').metrics, adSpendVnd: 100000, crmSpendVnd: 200000, spendNote: 'lệch' },
        lines: [line({ section: 'done', campaign: 'PTT - Prospecting' })],
      }),
    );
    expect(gap.map((issue) => issue.code)).toContain('VALIDATION_V11');
  });

  it('V12 rejects an account report without a customer account', () => {
    const issues = validateDailyReport(
      input('am_account', {
        metrics: { ...input('am_account').metrics, newLeads: 2 },
        lines: [line({ section: 'done' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V12');
  });

  it('V13 requires calls when SLA is on and a blocker when SLA is under the threshold', () => {
    const missingCalls = validateDailyReport(
      input('cskh_sales', {
        slaEnabled: true,
        metrics: { ...input('cskh_sales').metrics, newLeads: 3, slaPct: 90 },
        lines: [line({ section: 'done' })],
      }),
    );
    expect(missingCalls.map((issue) => issue.code)).toContain('VALIDATION_V13');

    const lowSla = validateDailyReport(
      input('cskh_sales', {
        slaEnabled: true,
        metrics: { ...input('cskh_sales').metrics, newLeads: 3, callsWithin15: 2, slaPct: 40 },
        lines: [line({ section: 'done' })],
      }),
    );
    expect(lowSla.map((issue) => issue.code)).toContain('VALIDATION_V13');
  });

  it('V14 rejects content with no asset link and type', () => {
    const issues = validateDailyReport(
      input('content_edit', {
        lines: [line({ section: 'done', evidenceUrl: '', evidenceName: '' })],
      }),
    );
    expect(issues.map((issue) => issue.code)).toContain('VALIDATION_V14');
  });

  it('V15 accepts a QL report with zero rows when the summary covers team review', () => {
    const ok = validateDailyReport(
      input('ql_gdkd', {
        summary: 'Đã duyệt và phản hồi team về nghẽn ads trong ngày.',
      }),
    );
    expect(ok).toEqual([]);

    const blocked = validateDailyReport(input('ql_gdkd', { summary: 'Hôm nay team ổn và không có gì thêm.' }));
    expect(blocked.map((issue) => issue.code)).toContain('VALIDATION_V15');
  });

  it('accepts one valid report per role', () => {
    expect(
      validateDailyReport(
        input('buyer_ads', {
          metrics: { ...input('buyer_ads').metrics, adSpendVnd: 250000, crmSpendVnd: 250000 },
          lines: [line({ section: 'done', campaign: 'PTT - Retarget' })],
        }),
      ),
    ).toEqual([]);
    expect(
      validateDailyReport(
        input('am_account', {
          metrics: { ...input('am_account').metrics, newLeads: 0 },
          lines: [line({ section: 'done', customerAccount: 'Spa ABC' })],
        }),
      ),
    ).toEqual([]);
    expect(
      validateDailyReport(
        input('cskh_sales', {
          metrics: { ...input('cskh_sales').metrics, newLeads: 4 },
          lines: [line({ section: 'done' })],
        }),
      ),
    ).toEqual([]);
    expect(
      validateDailyReport(
        input('content_edit', {
          lines: [line({ section: 'done', assetType: 'ảnh' })],
        }),
      ),
    ).toEqual([]);
  });

  it('uses the ICT calendar date', () => {
    expect(ictYmd(new Date('2026-10-06T18:30:00+07:00'))).toBe('2026-10-06');
    expect(ictYmd(new Date('2026-10-06T23:30:00+07:00'))).toBe('2026-10-06');
  });
});
