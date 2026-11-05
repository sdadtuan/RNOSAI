export const CP_SUBTITLES = {
  ovrDashboard:
    'OVR-01 · 8 KPI Nova · budget alert · project health · không hard-code số khi null',
  ovrActions: 'FR-OVR-003 · severity · resource · owner · CTA · audit',
  ovrOps: 'OVR-03 + VID-04 · queue · provider · capacity',
  ovrActivity: 'OVR-04 · filter actor / module / action · export = view_audit',
  prjPortfolio: 'PRJ-01 · grid/list · client · progress · lifecycle chip',
  prjCreate:
    'PRJ-02 · 8 field bắt buộc · budget gate 50/80/100 · không tạo project trống client',
  prjWorkspace: 'PRJ-03 · 8 tab workspace · budget banner · deliverable card',
  prjTimeline: 'PRJ-04 · milestone vertical timeline · SLA còn lại',
  vidStudio: 'VID-01 · FR-VID-001…010 · autosave 2s · estimate + pricing · playbook',
  vidOps: 'VID-04 · queue · provider · capacity · retry fallback child job',
  vidBatch: 'VID-06 · 4 bước template → mapping → variants → review & run',
  medLibrary: 'MED-01 · DAM grid · rights chip · usage graph',
  brkPortfolio: 'BRK-01 · PTT default / khách / project override',
  brkEditor: 'BRK-02 · FR-BRK-001 · mọi sửa = version',
  calCalendar: 'CAL-01 · month grid · publish gate · timezone Asia/Ho_Chi_Minh',
  rptExecutive: 'RPT-01 · 4 KPI · funnel chỉ khi có ingest',
  rptProduction: 'RPT-02 · success · p50/p95 · retry · approval SLA',
  rptCredit: 'RPT-03 · estimated/reserved/charged/released/refunded',
  rptPerformance: 'RPT-04 · mọi metric có source + freshness · cấm bịa CTR',
  rptGovernance: 'RPT-05 · brand · rights · audit · policy outcome',
  setProfile: 'SET-01 · workspace profile · deep-link Admin identity',
  setIntegrations: 'SET-06 · Magnific MCP/REST · webhook CP · Hub · Content OS · Campaign Write',
  setPolicy: 'SET-08 · Block / Review / Allow · không lộ rule nội bộ',
} as const;

export const CP_FILTER_PRESETS = {
  last30Days: '30 ngày',
  clientAll: 'Khách: Tất cả',
  lifecycleAll: 'Lifecycle: Tất cả',
} as const;

export const CP_CREDIT_FOOTER_LABEL = 'Credit PTT';

export const CP_PRODUCT_NAME = 'Creative Production OS';

export const CP_SEARCH_PLACEHOLDER = 'Tìm project, video, asset…';
