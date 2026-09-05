export type Am360TabId =
  | 'overview'
  | 'timeline'
  | 'projects'
  | 'work'
  | 'finance'
  | 'health'
  | 'opportunities'
  | 'feedback'
  | 'documents'
  | 'audit';

export type Am360Tab = {
  id: Am360TabId;
  label: string;
  wave: 2 | 3 | 4;
  implemented: boolean;
};

export const AM_360_TABS: Am360Tab[] = [
  { id: 'overview', label: 'Tổng quan', wave: 2, implemented: true },
  { id: 'timeline', label: 'Timeline', wave: 3, implemented: false },
  { id: 'projects', label: 'Dự án & dịch vụ', wave: 3, implemented: false },
  { id: 'work', label: 'Công việc', wave: 3, implemented: false },
  { id: 'finance', label: 'Hợp đồng & Tài chính', wave: 2, implemented: true },
  { id: 'health', label: 'Health & Risk', wave: 3, implemented: false },
  { id: 'opportunities', label: 'Cơ hội', wave: 4, implemented: false },
  { id: 'feedback', label: 'Phản hồi', wave: 4, implemented: false },
  { id: 'documents', label: 'Tài liệu', wave: 3, implemented: false },
  { id: 'audit', label: 'Audit', wave: 2, implemented: true },
];

export const AM_360_STATUS_COPY: Record<string, string> = {
  pending_handover: 'Chờ handover',
  onboarding: 'Onboarding',
  active: 'Active',
  at_risk: 'At risk',
  renewing: 'Renewing',
  paused: 'Paused',
  churned: 'Churned',
};

export function parseAm360Tab(raw: string | null | undefined): Am360TabId {
  const hit = AM_360_TABS.find((tab) => tab.id === raw);
  return hit?.id ?? 'overview';
}

export function am360WaveCopy(tab: Am360Tab): string {
  if (tab.implemented) return '';
  return `${tab.label} — mở ở Wave ${tab.wave}`;
}

export function am360HasForbiddenTabs(tabs: Am360Tab[] = AM_360_TABS): boolean {
  return tabs.some((tab) => /ads|portal/i.test(`${tab.id} ${tab.label}`));
}
