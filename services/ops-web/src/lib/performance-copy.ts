export const PM_SUBTITLES = {
  dashboard:
    'PM-01 · Nhịp tuần agency — không phải dashboard OKR generic. Scope: PTT Growth · Tháng 09/2026',
  registry: 'PM-02 · Direction-aware · quality chip · Quoted Δ. Không average raw đơn vị.',
  create: 'PM-03 · Prefill Dictionary Active. Custom KPI cần approval. Activate bị chặn nếu readiness đỏ.',
  scorecard: 'PM-04 · Inherit Service Template DV04 + Quote snapshot. Weight = 100% mới Active.',
  scorecardItem: 'PM-05 · Weight realtime. Target ngoài template range → approval cùng Contract Score.',
  checkin: 'PM-06 · TEC_008 · Lower-is-better · Auto actual locked · Red bắt buộc blocker.',
  marketing: 'PM-07 · Source health bắt buộc. ROAS = N/A nếu attribution thiếu — không bịa số đẹp.',
  campaign: 'PM-08 · Inherit Instance từ Quote. Media budget ≠ agency fee. Funnel không bịa stage thiếu mapping.',
  crm: 'PM-09 · Rule versioned. Stale cascade sang CPL. Không PII lead-level.',
  reports:
    'PM-10 · Kỳ đóng đọc snapshot bất biến. Export = field-level + audit. Không mix 2 formula version.',
  policy: 'PM-11 · Effective date. Không rewrite snapshot. Impact analysis trước khi save.',
} as const;

export type PmSubtitleKey = keyof typeof PM_SUBTITLES;

export const SIDE_NOTE_PERFORMANCE_OS =
  'Không đánh Lattice/AgencyAnalytics. Thắng bằng 3 sổ Quoted/Assigned/Verified + quality cascade + snapshot vào báo giá lần sau.';

export const RHYTHM_CTA: Record<string, string> = {
  assumption: 'Mở',
  at_risk: 'Registry',
  stale: 'CRM Map',
  gm: 'Contract',
  scorecard: 'Duyệt',
};

export const PM_SEARCH_PLACEHOLDER = 'Tìm KPI, owner, client, quote, campaign…';
