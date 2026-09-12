export const CP_PROJECT_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'brief', label: 'Brief' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'tasks', label: 'Công việc' },
  { id: 'media', label: 'Media' },
  { id: 'approvals', label: 'Phê duyệt' },
  { id: 'budget', label: 'Ngân sách' },
  { id: 'activity', label: 'Hoạt động' },
  { id: 'ai-ops', label: 'AI Ops' },
] as const;

export type CpProjectTabId = (typeof CP_PROJECT_TABS)[number]['id'];
