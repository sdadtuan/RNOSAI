/**
 * Báo cáo ngày — một form, năm mẫu theo vai trò.
 * Bản sao của services/ptt-crm-api/src/iwr/daily-report-template.ts — sửa cả hai.
 *
 * [cần xác nhận]
 * - Đa vai trò: một mẫu primary theo chức vụ, bỏ qua job function.
 * - Chưa gán mẫu: chặn Gửi (không default am_account).
 * - Ngưỡng SLA mặc định 80 khi Admin bật SLA cho team.
 * - CRM spend/lead/call chưa nối — nhập tay, không bịa số.
 * - Deadline content trên task CRM chưa map.
 */

export const DAILY_REPORT_TEMPLATE_CODES = [
  'buyer_ads',
  'am_account',
  'cskh_sales',
  'content_edit',
  'ql_gdkd',
] as const;

export type DailyReportTemplateCode = (typeof DAILY_REPORT_TEMPLATE_CODES)[number];

export const DAILY_SUBMIT_HOUR_ICT = 22;
export const DAILY_SLA_THRESHOLD_PCT = 80;

export const DAILY_VALIDATION_CODES = [
  'VALIDATION_V1',
  'VALIDATION_V2',
  'VALIDATION_V3',
  'VALIDATION_V4',
  'VALIDATION_V5',
  'VALIDATION_V6',
  'VALIDATION_V7',
  'VALIDATION_V8',
  'VALIDATION_V9',
  'VALIDATION_V10',
  'VALIDATION_V11',
  'VALIDATION_V12',
  'VALIDATION_V13',
  'VALIDATION_V14',
  'VALIDATION_V15',
  'VALIDATION_V17',
  'VALIDATION_TEMPLATE_UNASSIGNED',
  'VALIDATION_RECIPIENT_DISABLED',
] as const;

export type DailyValidationCode = (typeof DAILY_VALIDATION_CODES)[number];

export type DailyValidationIssue = {
  code: DailyValidationCode;
  message: string;
};

export type DailyMetricField =
  | 'ad_spend'
  | 'new_leads'
  | 'calls_within_15'
  | 'sla_pct'
  | 'new_appointments';

export type DailyReportTemplateSpec = {
  code: DailyReportTemplateCode;
  label: string;
  tips: string[];
  requiredMetrics: DailyMetricField[];
  optionalMetrics: DailyMetricField[];
};

const BUYER_TIPS = [
  'Chi tiêu hôm nay so với CRM — ghi lý do nếu lệch hơn 15%.',
  'Hoàn thành: tối ưu campaign, hành động, link Ads Manager.',
  'KPI: CPL/CPA so với mục tiêu; CTR nếu có.',
  'Đang làm: test, creative hoặc budget — ETA.',
  'Rủi ro: policy, học máy, ngân sách.',
  'Cần QL duyệt tăng hoặc giảm budget / creative.',
  'Ưu tiên mai: một hoặc hai việc.',
];

const AM_TIPS = [
  'Account chạm hôm nay, việc đã làm, bằng chứng mail hoặc CRM.',
  'Lead mới, lịch hẹn, deal cập nhật.',
  'Hoàn thành: báo cáo, đề xuất hoặc kick-off — kèm link.',
  'Đang làm: deliverable với team — ETA.',
  'Blocker phía khách hoặc nội bộ.',
  'Cần GDKD: duyệt đề xuất hoặc escalation.',
  'Ưu tiên mai và follow-up khách.',
];

const CSKH_TIPS = [
  'Lead mới, số gọi trong 15 phút, SLA nếu team đang bật.',
  'Lịch hẹn chốt, no-show hoặc huỷ.',
  'Hoàn thành: tư vấn, báo giá, chăm sóc — link CRM.',
  'Pipeline nóng: deal, bước tiếp, ETA.',
  'Blocker: số điện thoại sai, khách treo, thiếu tài liệu.',
  'Cần hỗ trợ AM hoặc QL.',
  'Ưu tiên gọi mai: top 3 lead.',
];

const CONTENT_TIPS = [
  'Asset hoàn thành: loại, số lượng, dự án, link Drive hoặc Frame.',
  'Đã bàn giao hoặc chờ duyệt — hạn.',
  'Đang edit hoặc design — phần trăm và ETA.',
  'Brief thiếu hoặc revision — blocker.',
  'Phụ thuộc Buyer/AM: copy, insight, footage.',
  'Cần QL ưu tiên queue nếu quá tải.',
  'Queue mai: một hoặc hai asset.',
];

const QL_TIPS = [
  'Team coverage: đã gửi, quá hạn, chưa xem.',
  'Điểm nghẽn hôm nay: ads, lead, content hoặc SLA.',
  'Đã duyệt hoặc phản hồi team — quyết định gì.',
  'Escalation GDKD hoặc CEO.',
  'Ưu tiên điều hành mai.',
];

export const FALLBACK_TIPS = [
  'Hoàn thành: việc, dự án, bằng chứng.',
  'Đang làm — ETA — phần trăm.',
  'Số liệu nếu mẫu yêu cầu.',
  'Blocker.',
  'Cần QL hoặc GDKD.',
  'Ưu tiên mai.',
];

export const DAILY_REPORT_TEMPLATES: Record<DailyReportTemplateCode, DailyReportTemplateSpec> = {
  buyer_ads: {
    code: 'buyer_ads',
    label: 'Buyer / Ads',
    tips: BUYER_TIPS,
    requiredMetrics: ['ad_spend'],
    optionalMetrics: ['new_leads'],
  },
  am_account: {
    code: 'am_account',
    label: 'AM / Account',
    tips: AM_TIPS,
    requiredMetrics: ['new_leads'],
    optionalMetrics: ['ad_spend', 'calls_within_15', 'new_appointments'],
  },
  cskh_sales: {
    code: 'cskh_sales',
    label: 'CSKH / Sales',
    tips: CSKH_TIPS,
    requiredMetrics: ['new_leads'],
    optionalMetrics: ['calls_within_15', 'sla_pct', 'new_appointments'],
  },
  content_edit: {
    code: 'content_edit',
    label: 'Content / Edit',
    tips: CONTENT_TIPS,
    requiredMetrics: [],
    optionalMetrics: [],
  },
  ql_gdkd: {
    code: 'ql_gdkd',
    label: 'QL / GDKD',
    tips: QL_TIPS,
    requiredMetrics: [],
    optionalMetrics: ['sla_pct'],
  },
};

const POSITION_TEMPLATE: Record<string, DailyReportTemplateCode> = {
  CEO: 'ql_gdkd',
  GDKD: 'ql_gdkd',
  QL: 'ql_gdkd',
  ACM: 'am_account',
  'KD-01': 'am_account',
  AM: 'am_account',
  AE: 'cskh_sales',
  CSKH: 'cskh_sales',
  CE: 'content_edit',
  GD: 'content_edit',
  MEP: 'content_edit',
  'MKT-02': 'content_edit',
  MKL: 'buyer_ads',
  'MKT-01': 'buyer_ads',
};

const EVIDENCE_FILE = /\.(pdf|png|jpe?g|webp|gif|mp4|mov|docx?|xlsx?|zip|fig|psd)$/i;
const PLACEHOLDER = /^(ok|n\/a|na|test|xxx|todo|abc|asdf|\.{2,}|—|-)$/i;

export function isDailyTemplate(value: unknown): value is DailyReportTemplateCode {
  return DAILY_REPORT_TEMPLATE_CODES.includes(value as DailyReportTemplateCode);
}

export function reportTemplateForPosition(code: string | null | undefined): DailyReportTemplateCode | null {
  const key = String(code ?? '').trim().toUpperCase();
  return POSITION_TEMPLATE[key] ?? null;
}

export function templateSpec(code: DailyReportTemplateCode | null): DailyReportTemplateSpec | null {
  if (!code) return null;
  return DAILY_REPORT_TEMPLATES[code];
}

export function metricFieldsFor(
  code: DailyReportTemplateCode | null,
  slaEnabled: boolean,
): { required: DailyMetricField[]; optional: DailyMetricField[] } {
  if (!code) return { required: [], optional: [] };
  const spec = DAILY_REPORT_TEMPLATES[code];
  if (code === 'cskh_sales' && !slaEnabled) {
    return { required: ['new_leads'], optional: ['new_appointments'] };
  }
  if (code === 'cskh_sales' && slaEnabled) {
    return {
      required: ['new_leads', 'calls_within_15', 'sla_pct'],
      optional: ['new_appointments'],
    };
  }
  return { required: [...spec.requiredMetrics], optional: [...spec.optionalMetrics] };
}

export type DailyReportLine = {
  section: 'done' | 'wip' | 'blocked' | 'next';
  title: string;
  text: string;
  project: string;
  kpi: string;
  kpiWaived: boolean;
  kpiWaiveReason: string;
  progress: number | null;
  eta: string;
  evidenceUrl: string;
  evidenceName: string;
  assetType: string;
  campaign: string;
  adAccount: string;
  customerAccount: string;
  meeting: boolean;
  calendarUrl: string;
};

export type DailyReportMetrics = {
  adSpendVnd: number | null;
  crmSpendVnd: number | null;
  spendNote: string;
  newLeads: number | null;
  callsWithin15: number | null;
  slaPct: number | null;
  newAppointments: number | null;
};

export type DailyReportCheckInput = {
  template: DailyReportTemplateCode | null;
  subject: string;
  reportDate: string;
  todayYmd: string;
  toStaffId: number | null;
  toActive: boolean;
  summary: string;
  slaEnabled: boolean;
  slaThresholdPct: number;
  duplicateSubmitted: boolean;
  lines: DailyReportLine[];
  metrics: DailyReportMetrics;
};

const EMPTY_METRICS: DailyReportMetrics = {
  adSpendVnd: null,
  crmSpendVnd: null,
  spendNote: '',
  newLeads: null,
  callsWithin15: null,
  slaPct: null,
  newAppointments: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalNumber(value: unknown): number | null | 'invalid' {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 'invalid';
  return n;
}

export function sanitizeDailyMetrics(
  template: DailyReportTemplateCode | null,
  raw: unknown,
): DailyReportMetrics {
  const src = asRecord(raw) ?? {};
  const spend = optionalNumber(src.ad_spend_vnd ?? src.adSpendVnd);
  const crm = optionalNumber(src.crm_spend_vnd ?? src.crmSpendVnd);
  const leads = optionalNumber(src.new_leads ?? src.newLeads);
  const calls = optionalNumber(src.calls_within_15 ?? src.callsWithin15);
  const sla = optionalNumber(src.sla_pct ?? src.slaPct);
  const appts = optionalNumber(src.new_appointments ?? src.newAppointments);
  const note = String(src.spend_note ?? src.spendNote ?? '').trim();
  const fields = metricFieldsFor(template, true);
  const allowed = new Set([...fields.required, ...fields.optional, 'ad_spend']);
  if (template === 'content_edit' || template == null) return { ...EMPTY_METRICS };
  const keepSpend = template === 'buyer_ads' || template === 'am_account';
  const keepLeads = allowed.has('new_leads') || template === 'buyer_ads' || template === 'am_account';
  const keepCalls = template === 'am_account' || template === 'cskh_sales';
  const keepSla = template === 'cskh_sales' || template === 'ql_gdkd';
  const keepAppt = template === 'am_account' || template === 'cskh_sales';
  return {
    adSpendVnd: keepSpend && spend !== 'invalid' ? spend : keepSpend && spend === 'invalid' ? Number.NaN : null,
    crmSpendVnd: keepSpend && crm !== 'invalid' ? crm : null,
    spendNote: keepSpend ? note : '',
    newLeads: keepLeads && leads !== 'invalid' ? leads : keepLeads && leads === 'invalid' ? Number.NaN : null,
    callsWithin15: keepCalls && calls !== 'invalid' ? calls : keepCalls && calls === 'invalid' ? Number.NaN : null,
    slaPct: keepSla && sla !== 'invalid' ? sla : keepSla && sla === 'invalid' ? Number.NaN : null,
    newAppointments: keepAppt && appts !== 'invalid' ? appts : keepAppt && appts === 'invalid' ? Number.NaN : null,
  };
}

export function lockedTemplate(sections: Record<string, unknown> | null | undefined): DailyReportTemplateCode | null {
  const role = asRecord(sections?.daily_role);
  if (!role) return null;
  if (role.assigned_by === 'server' && isDailyTemplate(role.report_template)) return role.report_template;
  return null;
}

export function applyDailyTemplate(
  sections: Record<string, unknown>,
  previous: Record<string, unknown>,
  positionCode: string | null | undefined,
): Record<string, unknown> {
  const prevRole = asRecord(previous.daily_role);
  const kept = lockedTemplate(previous);
  const template = kept ?? reportTemplateForPosition(positionCode);
  const incoming = asRecord(sections.daily_role);
  const metrics = sanitizeDailyMetrics(template, incoming?.metrics ?? prevRole?.metrics ?? {});
  const slaEnabled = Boolean(prevRole?.sla_enabled);
  const threshold =
    typeof prevRole?.sla_threshold_pct === 'number' ? prevRole.sla_threshold_pct : DAILY_SLA_THRESHOLD_PCT;
  return {
    ...sections,
    daily_role: {
      report_template: template,
      ...(template ? { assigned_by: 'server' as const } : {}),
      sla_enabled: slaEnabled,
      sla_threshold_pct: threshold,
      metrics: {
        ad_spend_vnd: metrics.adSpendVnd,
        crm_spend_vnd: metrics.crmSpendVnd,
        spend_note: metrics.spendNote,
        new_leads: metrics.newLeads,
        calls_within_15: metrics.callsWithin15,
        sla_pct: metrics.slaPct,
        new_appointments: metrics.newAppointments,
      },
    },
  };
}

function add(list: DailyValidationIssue[], code: DailyValidationCode, message: string) {
  if (!list.some((item) => item.code === code)) list.push({ code, message });
}

function workLines(lines: DailyReportLine[]): DailyReportLine[] {
  return lines.filter((line) => line.section === 'done' || line.section === 'wip');
}

function description(line: DailyReportLine): string {
  return String(line.text ?? '').trim();
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value.trim());
}

function hasEvidence(line: DailyReportLine): boolean {
  const url = line.evidenceUrl.trim();
  const file = line.evidenceName.trim();
  if (/^https?:\/\/\S{3,}/i.test(url)) return true;
  if (EVIDENCE_FILE.test(url) || EVIDENCE_FILE.test(file)) return true;
  if (file.length > 0) return true;
  return false;
}

function integerMoney(value: number | null): 'missing' | 'invalid' | number {
  if (value == null) return 'missing';
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return 'invalid';
  return value;
}

function integerCount(value: number | null): 'missing' | 'invalid' | number {
  if (value == null) return 'missing';
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return 'invalid';
  return value;
}

export function validateDailyReport(input: DailyReportCheckInput): DailyValidationIssue[] {
  const issues: DailyValidationIssue[] = [];
  if (!input.template) {
    add(issues, 'VALIDATION_TEMPLATE_UNASSIGNED', 'Admin chưa gán mẫu báo cáo cho chức vụ này.');
    return issues;
  }

  const template = input.template;
  const ql = template === 'ql_gdkd';
  const rows = workLines(input.lines);
  const summary = input.summary.trim();
  const summaryMin = ql ? 30 : 40;
  const qlSummaryOk = ql && summary.length >= 30 && /duyệt|phản hồi/i.test(summary);

  for (const line of rows) {
    if (!line.project.trim()) {
      add(issues, 'VALIDATION_V1', 'Mỗi dòng kết quả hoặc đang làm cần dự án.');
    }
    const waived = line.kpiWaived && line.kpiWaiveReason.trim().length >= 20;
    if (line.project.trim() && !line.kpi.trim() && !waived) {
      add(issues, 'VALIDATION_V1', 'Thiếu KPI. Chọn KPI hoặc ghi “Không áp dụng” kèm lý do ít nhất 20 ký tự.');
    }
    const text = description(line);
    if (text.length < 20 || isPlaceholder(text)) {
      add(issues, 'VALIDATION_V3', 'Mô tả mỗi dòng cần ít nhất 20 ký tự, không dùng placeholder.');
    }
    if (line.section === 'done' && line.progress != null && line.progress !== 100) {
      add(issues, 'VALIDATION_V2', 'Kết quả hoàn thành phải 100% hoặc bỏ phần trăm. Không dùng 1–99.');
    }
    if (line.section === 'done' && !ql && !hasEvidence(line)) {
      add(issues, 'VALIDATION_V4', 'Dòng hoàn thành cần URL hoặc file bằng chứng.');
    }
    if (line.section === 'wip') {
      const eta = line.eta.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eta) || eta < input.todayYmd) {
        add(issues, 'VALIDATION_V5', 'Việc đang làm cần ETA từ hôm nay (ICT) trở đi.');
      }
      if (line.progress === 100) {
        add(issues, 'VALIDATION_V17', 'Việc đang làm đã 100%. Chuyển sang Kết quả đã hoàn thành.');
      }
    }
  }

  if (summary.length < summaryMin || isPlaceholder(summary)) {
    add(issues, 'VALIDATION_V3', ql ? 'Tóm tắt QL cần ít nhất 30 ký tự.' : 'Tóm tắt cần ít nhất 40 ký tự.');
  }

  if (!input.toStaffId) {
    add(issues, 'VALIDATION_V6', 'Chọn người nhận ở mục Đến.');
  } else if (!input.toActive) {
    add(issues, 'VALIDATION_RECIPIENT_DISABLED', 'Người nhận Đến đã ngưng hoạt động.');
  }

  if (!ql && rows.length < 1) {
    add(issues, 'VALIDATION_V7', 'Cần ít nhất một dòng kết quả hoặc đang làm.');
  }
  if (ql && rows.length < 1 && !qlSummaryOk) {
    add(
      issues,
      'VALIDATION_V15',
      'QL gửi trống dòng khi tóm tắt từ 30 ký tự và có nội dung duyệt hoặc phản hồi team.',
    );
  }

  if (input.duplicateSubmitted) {
    add(issues, 'VALIDATION_V8', 'Ngày này đã có một bản đã gửi.');
  }

  const subject = input.subject.trim();
  if (subject.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate) || input.reportDate > input.todayYmd) {
    add(issues, 'VALIDATION_V9', 'Chủ đề cần ít nhất 10 ký tự và ngày báo cáo không sau hôm nay.');
  }

  const fields = metricFieldsFor(template, input.slaEnabled);
  const enabled = new Set([...fields.required, ...fields.optional]);
  const metrics = input.metrics;

  if (enabled.has('ad_spend')) {
    const spend = integerMoney(metrics.adSpendVnd);
    if (fields.required.includes('ad_spend') && spend === 'missing') {
      add(issues, 'VALIDATION_V11', 'Buyer cần nhập chi tiêu ads hôm nay (VND, số nguyên ≥ 0).');
    } else if (spend === 'invalid') {
      add(issues, 'VALIDATION_V10', 'Chi tiêu ads phải là số tiền VND nguyên, không âm.');
    }
    if (metrics.crmSpendVnd != null && typeof spend === 'number' && metrics.crmSpendVnd > 0) {
      const gap = Math.abs(spend - metrics.crmSpendVnd) / metrics.crmSpendVnd;
      if (gap > 0.15 && metrics.spendNote.trim().length < 10) {
        add(issues, 'VALIDATION_V11', 'Chi tiêu lệch CRM hơn 15%. Cần chú thích ít nhất 10 ký tự.');
      }
    }
  }
  if (enabled.has('new_leads')) {
    const leads = integerCount(metrics.newLeads);
    if (fields.required.includes('new_leads') && leads === 'missing') {
      add(issues, template === 'am_account' ? 'VALIDATION_V12' : 'VALIDATION_V13', 'Cần nhập số lead mới (≥ 0).');
    } else if (leads === 'invalid') {
      add(issues, 'VALIDATION_V10', 'Lead mới phải là số nguyên không âm.');
    }
  }
  if (input.slaEnabled && template === 'cskh_sales') {
    const calls = integerCount(metrics.callsWithin15);
    if (calls === 'missing' || calls === 'invalid') {
      add(issues, 'VALIDATION_V13', 'Team đang bật SLA: cần số cuộc gọi xử lý trong 15 phút.');
    }
    if (metrics.slaPct == null || !Number.isFinite(metrics.slaPct) || metrics.slaPct < 0 || metrics.slaPct > 100) {
      add(issues, 'VALIDATION_V13', 'Team đang bật SLA: cần SLA trong khoảng 0–100.');
    } else if (metrics.slaPct < input.slaThresholdPct) {
      const blocker = input.lines.find((line) => line.section === 'blocked');
      const blockerText = blocker ? `${blocker.title} ${blocker.text}`.trim() : '';
      if (!blocker || blockerText.length < 10) {
        add(issues, 'VALIDATION_V13', 'SLA dưới ngưỡng team. Cần Blocker = Có và mô tả.');
      }
    }
  }
  if (enabled.has('sla_pct') && template !== 'cskh_sales' && metrics.slaPct != null) {
    if (!Number.isFinite(metrics.slaPct) || metrics.slaPct < 0 || metrics.slaPct > 100) {
      add(issues, 'VALIDATION_V10', 'SLA phải trong khoảng 0–100.');
    }
  }
  if (enabled.has('calls_within_15') && template !== 'cskh_sales' && metrics.callsWithin15 != null) {
    if (integerCount(metrics.callsWithin15) === 'invalid') {
      add(issues, 'VALIDATION_V10', 'Số gọi trong 15 phút phải là số nguyên không âm.');
    }
  }
  if (enabled.has('new_appointments') && metrics.newAppointments != null) {
    if (integerCount(metrics.newAppointments) === 'invalid') {
      add(issues, 'VALIDATION_V10', 'Lịch hẹn mới phải là số nguyên không âm.');
    }
  }

  if (template === 'buyer_ads') {
    const campaign = rows.some((line) => line.campaign.trim() || line.adAccount.trim());
    if (!campaign) {
      add(issues, 'VALIDATION_V11', 'Cần ít nhất một dòng gắn campaign hoặc ad account.');
    }
  }

  if (template === 'am_account') {
    const account = rows.some((line) => line.customerAccount.trim());
    if (!account) {
      add(issues, 'VALIDATION_V12', 'Cần ít nhất một dòng gắn account khách.');
    }
    const meetingGap = rows.some(
      (line) => line.meeting && !/^https?:\/\/\S{3,}/i.test(line.calendarUrl.trim()) && description(line).length < 20,
    );
    if (meetingGap) {
      add(issues, 'VALIDATION_V12', 'Lịch hẹn cần link lịch hoặc ghi chú ít nhất 20 ký tự.');
    }
  }

  if (template === 'content_edit') {
    const asset = input.lines.some(
      (line) => line.section === 'done' && hasEvidence(line) && line.assetType.trim().length > 0,
    );
    if (!asset) {
      add(issues, 'VALIDATION_V14', 'Cần ít nhất một kết quả có link hoặc file asset và loại asset.');
    }
  }

  return issues;
}

export function ictYmd(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function ictCountdown(now: Date): { late: boolean; label: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const nowMin = hour * 60 + minute;
  const dueMin = DAILY_SUBMIT_HOUR_ICT * 60;
  if (nowMin > dueMin) return { late: true, label: 'Quá hạn' };
  const left = dueMin - nowMin;
  const h = Math.floor(left / 60);
  const m = left % 60;
  return { late: false, label: `${h}g ${String(m).padStart(2, '0')}p tới 22:00` };
}

export function dailyDueAt(ymd: string): string {
  return `${ymd}T22:00:00.000+07:00`;
}

/** Nháp báo cáo ngày sau 22:00 ICT của kỳ đó, kể cả khi chưa bấm Gửi. */
export function dailyDraftIsOverdue(input: {
  templateCode: string;
  status: string;
  periodYmd: string;
  isLate?: boolean;
  now?: Date;
}): boolean {
  if (input.isLate) return true;
  if (input.templateCode !== 'daily_work') return false;
  if (input.status !== 'draft' && input.status !== 'changes_requested') return false;
  const ymd = String(input.periodYmd ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const now = input.now ?? new Date();
  const today = ictYmd(now);
  if (ymd < today) return true;
  if (ymd > today) return false;
  return ictCountdown(now).late;
}
