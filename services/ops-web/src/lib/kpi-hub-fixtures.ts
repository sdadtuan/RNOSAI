export type KpiHubDictStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'NEED_REVIEW'
  | 'DEPRECATED'
  | 'ARCHIVED';

export type KpiHubGroupCode =
  | 'ACQUISITION'
  | 'MEDIA_EFFICIENCY'
  | 'FUNNEL'
  | 'SALES_OUTCOME'
  | 'FINANCE'
  | 'OPERATIONS';

export interface KpiHubDictionaryRow {
  id: string;
  code: string;
  name: string;
  group: KpiHubGroupCode;
  groupLabel: string;
  groupColor: string;
  source: string;
  frequency: string;
  dataOwner: string;
  status: KpiHubDictStatus;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  unit?: string;
  formulaDisplay?: string;
  targetValue?: number;
  targetLabel?: string;
  numeratorCode?: string;
  numeratorLabel?: string;
  denominatorCode?: string;
  denominatorLabel?: string;
}

const GROUP_META: Record<KpiHubGroupCode, { label: string; color: string }> = {
  ACQUISITION: { label: 'Acquisition', color: '#3b82f6' },
  MEDIA_EFFICIENCY: { label: 'Media Efficiency', color: '#10b981' },
  FUNNEL: { label: 'Funnel', color: '#8b5cf6' },
  SALES_OUTCOME: { label: 'Sales Outcome', color: '#f59e0b' },
  FINANCE: { label: 'Finance', color: '#6366f1' },
  OPERATIONS: { label: 'Operations', color: '#64748b' },
};

function row(
  code: string,
  name: string,
  group: KpiHubGroupCode,
  source: string,
  frequency: string,
  dataOwner: string,
  status: KpiHubDictStatus,
  extra: Partial<KpiHubDictionaryRow> = {},
): KpiHubDictionaryRow {
  const g = GROUP_META[group];
  return {
    id: code.toLowerCase(),
    code,
    name,
    group,
    groupLabel: g.label,
    groupColor: g.color,
    source,
    frequency,
    dataOwner,
    status,
    direction: extra.direction ?? 'HIGHER_IS_BETTER',
    ...extra,
  };
}

export const KPI_HUB_DICTIONARY: KpiHubDictionaryRow[] = [
  row('MKT_001', 'Tổng Raw Leads', 'ACQUISITION', 'SharePoint + CRM', 'Hàng ngày', 'Nguyễn Thị Lan', 'ACTIVE'),
  row('MKT_002', 'Tổng Valid Leads', 'ACQUISITION', 'CRM', 'Hàng ngày', 'Nguyễn Thị Lan', 'ACTIVE'),
  row('MKT_003', 'Valid Lead Rate', 'ACQUISITION', 'CRM + SharePoint', 'Hàng ngày', 'Nguyễn Thị Lan', 'ACTIVE', {
    direction: 'HIGHER_IS_BETTER',
  }),
  row('MKT_004', 'Tổng chi tiêu quảng cáo', 'MEDIA_EFFICIENCY', 'Meta Ads', 'Hàng ngày', 'Trần Văn Hùng', 'ACTIVE', {
    direction: 'LOWER_IS_BETTER',
  }),
  row('MKT_005', 'CPL Raw Lead', 'MEDIA_EFFICIENCY', 'Ads + SharePoint', 'Hàng ngày', 'Trần Văn Hùng', 'ACTIVE', {
    direction: 'LOWER_IS_BETTER',
  }),
  row('MKT_006', 'CPL Valid Lead', 'MEDIA_EFFICIENCY', 'Meta Ads + CRM', 'Hàng ngày', 'Trần Văn Hùng', 'ACTIVE', {
    direction: 'LOWER_IS_BETTER',
    unit: 'VND/Lead',
    formulaDisplay: 'Tổng chi tiêu quảng cáo / Tổng Valid Leads',
    targetValue: 150000,
    targetLabel: '≤ 150.000 VND',
    numeratorCode: 'MKT_004',
    numeratorLabel: 'Tổng chi tiêu quảng cáo',
    denominatorCode: 'MKT_002',
    denominatorLabel: 'Tổng Valid Leads',
  }),
  row('MKT_007', 'Tổng MQL', 'FUNNEL', 'CRM', 'Hàng ngày', 'Lê Hoàng Nam', 'ACTIVE'),
  row('MKT_008', 'MQL Rate', 'FUNNEL', 'CRM', 'Hàng ngày', 'Lê Hoàng Nam', 'ACTIVE'),
  row('MKT_009', 'ROAS', 'MEDIA_EFFICIENCY', 'Ads + CRM + ERP', 'Hàng ngày', 'Trần Văn Hùng', 'ACTIVE'),
  row('SAL_001', 'Tổng SQL', 'FUNNEL', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_002', 'SQL Rate', 'FUNNEL', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_003', 'Tổng cuộc hẹn', 'SALES_OUTCOME', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_004', 'Show-up Rate', 'SALES_OUTCOME', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_005', 'Pipeline Value', 'SALES_OUTCOME', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_007', 'Win Rate', 'SALES_OUTCOME', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_008', 'Doanh thu ký mới', 'SALES_OUTCOME', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('SAL_WON', 'Deal Won (count)', 'SALES_OUTCOME', 'CRM', 'Hàng ngày', 'Phạm Minh Tuấn', 'ACTIVE'),
  row('FIN_001', 'Doanh thu xuất hóa đơn', 'FINANCE', 'ERP', 'Hàng tháng', 'Hoàng Thị Mai', 'ACTIVE'),
  row('FIN_002', 'Doanh thu thu tiền', 'FINANCE', 'ERP', 'Hàng tháng', 'Hoàng Thị Mai', 'ACTIVE'),
  row('FIN_003', 'CAC', 'FINANCE', 'CRM + ERP', 'Hàng tháng', 'Hoàng Thị Mai', 'ACTIVE', {
    direction: 'LOWER_IS_BETTER',
  }),
  row('OPS_002', 'Lead Contact Rate', 'OPERATIONS', 'CRM + Call Center', 'Hàng ngày', 'Vũ Đức Anh', 'ACTIVE'),
  row('MKT_GA4', 'GA4 Sessions', 'ACQUISITION', 'GA4', 'Hàng ngày', 'Nguyễn Thị Lan', 'NEED_REVIEW'),
];

export const KPI_HUB_DICT_SUMMARY = {
  total: 22,
  active: 20,
  needReview: 1,
  sources: 7,
};

export const KPI_HUB_FRESHNESS = {
  asOfLabel: 'Hôm nay, 08:45',
  sources: [
    { system: 'CRM', label: 'CRM', status: 'FRESH' as const },
    { system: 'META_ADS', label: 'Meta Ads', status: 'FRESH' as const },
    { system: 'SHAREPOINT', label: 'SharePoint', status: 'DELAYED' as const },
  ],
};

export const KPI_HUB_DASHBOARD = {
  periodLabel: '01–30 Tháng 09, 2026',
  cards: [
    {
      code: 'SAL_008',
      name: 'Doanh thu ký mới',
      value: 1240000000,
      formatted: '1.24 tỷ đ',
      deltaPct: 18.6,
      status: 'ACHIEVED' as const,
      badge: 'Đạt target',
    },
    {
      code: 'MKT_002',
      name: 'Tổng Valid Leads',
      value: 1486,
      formatted: '1,486',
      deltaPct: 12.4,
      status: 'ACHIEVED' as const,
      badge: 'Đạt target',
    },
    {
      code: 'MKT_006',
      name: 'CPL Valid Lead',
      value: 142000,
      formatted: '142.000 đ',
      target: 150000,
      status: 'ACHIEVED' as const,
      badge: 'Đạt ≤ 150.000',
    },
    {
      code: 'MKT_008',
      name: 'MQL Rate',
      value: 24.8,
      formatted: '24.8%',
      target: 30,
      status: 'WARNING' as const,
      badge: 'Thiếu 5.2%',
    },
    {
      code: 'SAL_007',
      name: 'Win Rate',
      value: 12.5,
      formatted: '12.5%',
      target: 20,
      status: 'CRITICAL' as const,
      badge: 'Nguy cấp ≥ 20%',
    },
  ],
  funnel: {
    stages: [
      { code: 'MKT_001', name: 'Raw Leads', value: 2340 },
      { code: 'MKT_002', name: 'Valid Leads', value: 1486, conversion: '63.5%' },
      { code: 'MKT_007', name: 'MQL', value: 369, conversion: '24.8%' },
      { code: 'SAL_001', name: 'SQL', value: 152, conversion: '41.2%' },
      { code: 'SAL_003', name: 'Cuộc hẹn', value: 86, conversion: '56.6%' },
      { code: 'SAL_WON', name: 'Deal Won', value: 19, conversion: '22.1%' },
    ],
    bottleneck: { code: 'MKT_008', label: 'MQL Rate' },
  },
  targetProgress: {
    overallPct: 68,
    groups: [
      { code: 'ACQUISITION', label: 'Acquisition', pct: 92 },
      { code: 'MEDIA_EFFICIENCY', label: 'Media Efficiency', pct: 95 },
      { code: 'FUNNEL', label: 'Funnel', pct: 71 },
      { code: 'SALES_OUTCOME', label: 'Sales Outcome', pct: 46 },
    ],
  },
  channels: [
    { channel: 'Meta Ads', validLeads: 820, revenue: 410000000 },
    { channel: 'Google Ads', validLeads: 310, revenue: 280000000 },
    { channel: 'Organic', validLeads: 240, revenue: 190000000 },
    { channel: 'Referral', validLeads: 116, revenue: 360000000 },
  ],
  alerts: [
    { level: 'CRITICAL', title: 'Win Rate thấp hơn ngưỡng Critical', scope: 'Sales Team A', age: '8 phút' },
    { level: 'WARNING', title: 'MQL Rate chưa đạt target', scope: 'Campaign BĐS Q3' },
    { level: 'INFO', title: 'SharePoint Mapping trễ 2 giờ', scope: 'Data Quality' },
    { level: 'SUCCESS', title: 'CPL Valid Lead đạt target', scope: 'Marketing' },
  ],
  topSales: [
    { rank: 1, name: 'Nguyễn Minh Anh', revenue: 420000000, winRate: 18.7 },
    { rank: 2, name: 'Trần Thị Hương', revenue: 380000000, winRate: 16.2 },
    { rank: 3, name: 'Lê Văn Đức', revenue: 290000000, winRate: 14.8 },
  ],
};

export const KPI_HUB_TARGETS = {
  summary: { configured: 18, total: 22, achievedPct: 66, warning: 4, critical: 2 },
  rows: [
    {
      id: 't1',
      code: 'MKT_006',
      name: 'CPL Valid Lead',
      actual: 142000,
      actualFmt: '142.000 đ',
      target: 150000,
      targetFmt: '≤ 150.000',
      warning: 180000,
      critical: 220000,
      trend: 'down',
      status: 'ACHIEVED' as const,
    },
    {
      id: 't2',
      code: 'MKT_008',
      name: 'MQL Rate',
      actual: 24.8,
      actualFmt: '24.8%',
      target: 30,
      targetFmt: '≥ 30%',
      warning: 25,
      critical: 20,
      trend: 'flat',
      status: 'WARNING' as const,
    },
    {
      id: 't3',
      code: 'SAL_007',
      name: 'Win Rate',
      actual: 12.5,
      actualFmt: '12.5%',
      target: 20,
      targetFmt: '≥ 20%',
      warning: 15,
      critical: 20,
      trend: 'down',
      status: 'CRITICAL' as const,
    },
    {
      id: 't4',
      code: 'SAL_008',
      name: 'Doanh thu ký mới',
      actual: 1240000000,
      actualFmt: '1.24 tỷ',
      target: 1000000000,
      targetFmt: '≥ 1 tỷ',
      warning: null,
      critical: null,
      trend: 'up',
      status: 'ACHIEVED' as const,
    },
  ],
};

export const KPI_HUB_SOURCES = [
  {
    id: 'src-crm',
    system: 'CRM',
    name: 'CRM Leads & Deals',
    role: 'Denominator',
    status: 'CONNECTED' as const,
    lastSync: '08:42',
  },
  {
    id: 'src-meta',
    system: 'META_ADS',
    name: 'Meta Ads Insights',
    role: 'Numerator',
    status: 'CONNECTED' as const,
    lastSync: '08:40',
  },
  {
    id: 'src-sp',
    system: 'SHAREPOINT',
    name: 'SharePoint Lookup',
    role: 'Lookup',
    status: 'DELAYED' as const,
    lastSync: '06:30',
  },
  {
    id: 'src-erp',
    system: 'ERP',
    name: 'ERP Invoices',
    role: 'Supporting',
    status: 'CONNECTED' as const,
    lastSync: '07:15',
  },
  {
    id: 'src-ga4',
    system: 'GA4',
    name: 'Google Analytics 4',
    role: 'Supporting',
    status: 'UNAVAILABLE' as const,
    lastSync: '—',
  },
];

export const KPI_HUB_QUALITY = {
  score: 92,
  sourcesOk: 5,
  sourcesTotal: 7,
  warnings: 3,
  critical: 1,
  trend: [88, 89, 90, 91, 92, 91, 92],
  freshness: [
    { name: 'CRM', status: 'FRESH' as const, lag: '3 phút' },
    { name: 'Meta Ads', status: 'FRESH' as const, lag: '5 phút' },
    { name: 'SharePoint', status: 'DELAYED' as const, lag: '2 giờ 15 phút' },
    { name: 'ERP', status: 'FRESH' as const, lag: '1 giờ 30 phút' },
  ],
  rules: [
    { id: 'r1', name: 'Lead_ID không trùng', severity: 'CRITICAL', passRate: 98, status: 'PASS' },
    { id: 'r2', name: 'Valid Lead có nguồn', severity: 'WARNING', passRate: 94, status: 'WARN' },
    { id: 'r3', name: 'Campaign mapping đầy đủ', severity: 'WARNING', passRate: 96, status: 'WARN' },
    { id: 'r4', name: 'Spend currency VND', severity: 'INFO', passRate: 100, status: 'PASS' },
  ],
  issue: {
    id: 'iss-1',
    rule: 'Lead_ID không trùng',
    count: 12,
    sample: 'LEAD-20260904-***',
    assignee: null,
  },
};

export const KPI_HUB_REPORTS = {
  summary: { total: 12, mine: 6, shared: 2, sentThisMonth: 28 },
  tabs: ['Tất cả', 'Của tôi', 'Đã chia sẻ', 'Lịch gửi'] as const,
  items: [
    { id: 'rep1', name: 'Marketing Weekly', type: 'Dashboard', owner: 'Trần Văn Hùng', status: 'ACTIVE' },
    { id: 'rep2', name: 'Sales Pipeline', type: 'Funnel', owner: 'Phạm Minh Tuấn', status: 'ACTIVE' },
    { id: 'rep3', name: 'CPL Deep Dive', type: 'KPI Detail', owner: 'Trần Văn Hùng', status: 'DRAFT' },
  ],
  quickCreate: [
    'Dashboard Marketing',
    'Funnel Conversion',
    'Target vs Actual',
    'Data Quality Summary',
  ],
  nextSchedule: { name: 'Marketing Weekly', at: 'Thứ 2, 08:00', channel: 'Email + Teams' },
  recentShares: [
    { report: 'Marketing Weekly', user: 'CEO Office', at: 'Hôm qua' },
    { report: 'Sales Pipeline', user: 'GD Sales', at: '2 ngày trước' },
  ],
};

export const KPI_HUB_WORKSPACE = {
  name: 'KPI Hub - Marketing & Sales',
  company: 'Công ty CP PTT',
  timezone: 'Asia/Ho_Chi_Minh',
  locale: 'vi-VN',
  currency: 'VND',
  weekStart: 'MON',
  defaultPeriodGrain: 'MONTH',
  closeDay: 3,
  reconcileDay: 5,
  lockClosedPeriods: true,
  allowReopen: false,
  requireKpiApproval: true,
  autoQuality: true,
  alertsEnabled: true,
  maintenanceMode: false,
};

export const KPI_HUB_SETTINGS_NAV = [
  'Không gian làm việc',
  'Chuẩn dữ liệu',
  'Chu kỳ & đối soát',
  'Cảnh báo',
  'Chất lượng dữ liệu',
  'Báo cáo',
  'Tích hợp',
  'Phân quyền',
  'Nâng cao',
] as const;

export function findDictionaryByCode(code: string): KpiHubDictionaryRow | undefined {
  return KPI_HUB_DICTIONARY.find((k) => k.code === code);
}

export function findDictionaryById(id: string): KpiHubDictionaryRow | undefined {
  return KPI_HUB_DICTIONARY.find((k) => k.id === id || k.code === id);
}

export const KPI_HUB_FORMULA_CPL = {
  calcType: 'Ratio',
  numerator: {
    code: 'MKT_004',
    name: 'Tổng chi tiêu quảng cáo',
    expression: 'SUM(AdInsights[Spend])',
    filter: 'Campaign Active',
  },
  denominator: {
    code: 'MKT_002',
    name: 'Tổng Valid Leads',
    expression: 'DISTINCTCOUNT(Leads[Lead_ID])',
    filter: 'Status = Valid',
  },
  businessFormula: 'CPL Valid Lead = Tổng chi tiêu quảng cáo ÷ Tổng Valid Leads',
  dax: 'DIVIDE([Tổng chi tiêu quảng cáo], [Tổng Valid Leads])',
  toggles: {
    blankIfZero: true,
    nonAdditiveRatio: true,
    manualEntry: false,
  },
  sidebar: {
    timeBasis: 'Theo ngày tạo Lead (CRM)',
    logicChecks: ['Mẫu số > 0', 'Không có vòng phụ thuộc'],
    dependencies: ['MKT_004', 'MKT_002', 'MKT_009', 'FIN_003'],
  },
};

export const KPI_HUB_MAPPING_CPL = {
  bindings: [
    { system: 'Meta Ads', role: 'Numerator', status: 'CONNECTED' as const },
    { system: 'CRM', role: 'Denominator', status: 'CONNECTED' as const },
    { system: 'SharePoint', role: 'Lookup', status: 'DELAYED' as const },
  ],
  mappings: [
    {
      title: 'Chi tiêu quảng cáo',
      source: 'Meta Ads · AdInsights',
      aggregation: 'SUM(Spend)',
      preview: 'SUM',
    },
    {
      title: 'Valid Leads',
      source: 'CRM · Leads',
      aggregation: 'DISTINCTCOUNT(Lead_ID)',
      preview: 'DISTINCTCOUNT',
    },
  ],
  rail: {
    strategy: 'Campaign + Date',
    joinKey: 'campaign_id → utm_campaign',
    utmEnabled: true,
    mappingTable: true,
    qualityPct: 96,
    unmappedCount: 12,
  },
};
