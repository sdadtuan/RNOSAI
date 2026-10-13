import type { CrmLeadsFlowScope } from '@/lib/crm/lead-flow-routes';

export type LeadsListOwnerParam = 'all' | 'mine' | 'unassigned';
export type LeadsListKindParam = 'pipeline' | 'review' | 'all';

export interface LeadsListUrlState {
  owner: LeadsListOwnerParam;
  kind: LeadsListKindParam;
  status: string;
  source: string;
  channel: string;
  q: string;
  savedView: string;
  receivedFrom: string;
  receivedTo: string;
  assignee: string;
}

export interface LeadsFilterChip {
  id: string;
  label: string;
}

const KIND_VALUES: LeadsListKindParam[] = ['pipeline', 'review', 'all'];

function parseOwner(raw: string | null): LeadsListOwnerParam {
  if (raw === 'me' || raw === 'mine') return 'mine';
  if (raw === 'unassigned') return 'unassigned';
  return 'all';
}

function parseKind(raw: string | null, tabReview: boolean): LeadsListKindParam {
  if (tabReview) return 'review';
  if (raw && KIND_VALUES.includes(raw as LeadsListKindParam)) return raw as LeadsListKindParam;
  return 'pipeline';
}

export function parseLeadsListUrl(
  searchParams: URLSearchParams,
  flowScope: CrmLeadsFlowScope,
): LeadsListUrlState {
  const tab = searchParams.get('tab');
  return {
    owner: parseOwner(searchParams.get('owner')),
    kind:
      flowScope === 'b2b_prospect'
        ? 'all'
        : parseKind(searchParams.get('kind'), tab === 'review'),
    status: searchParams.get('status')?.trim() ?? '',
    source: searchParams.get('source')?.trim() ?? '',
    channel: searchParams.get('channel')?.trim() ?? '',
    q: searchParams.get('q')?.trim() ?? '',
    savedView: searchParams.get('view')?.trim() ?? '',
    receivedFrom: searchParams.get('from')?.trim() ?? '',
    receivedTo: searchParams.get('to')?.trim() ?? '',
    assignee: searchParams.get('assignee')?.trim() ?? '',
  };
}

export function buildLeadsListSearchParams(
  state: LeadsListUrlState,
  flowScope: CrmLeadsFlowScope,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.status) params.set('status', state.status);
  if (state.source) params.set('source', state.source);
  if (state.channel) params.set('channel', state.channel);
  if (state.savedView) params.set('view', state.savedView);
  if (state.receivedFrom) params.set('from', state.receivedFrom);
  if (state.receivedTo) params.set('to', state.receivedTo);
  if (state.assignee) params.set('assignee', state.assignee);
  if (state.owner === 'mine') params.set('owner', 'me');
  else if (state.owner === 'unassigned') params.set('owner', 'unassigned');
  if (flowScope !== 'b2b_prospect') {
    if (state.kind === 'review') params.set('tab', 'review');
    else if (state.kind !== 'pipeline') params.set('kind', state.kind);
  }
  return params;
}

export function ownerParamToListTab(owner: LeadsListOwnerParam): 'all' | 'mine' | 'unassigned' {
  return owner;
}

export function listTabToOwnerParam(tab: 'all' | 'mine' | 'unassigned'): LeadsListOwnerParam {
  return tab;
}

export function buildLeadsFilterChips(
  state: LeadsListUrlState,
  flowScope: CrmLeadsFlowScope,
  labels: {
    statusLabel?: (key: string) => string;
    sourceLabel?: (key: string) => string;
    channelLabel?: (key: string) => string;
    assigneeLabel?: (id: string) => string;
  },
): LeadsFilterChip[] {
  const chips: LeadsFilterChip[] = [];
  if (state.q) chips.push({ id: 'q', label: `Tìm: ${state.q}` });
  if (state.owner === 'mine') chips.push({ id: 'owner', label: 'Của tôi' });
  if (state.owner === 'unassigned') chips.push({ id: 'owner', label: 'Chưa phân' });
  if (flowScope !== 'b2b_prospect') {
    if (state.kind === 'review') chips.push({ id: 'kind', label: 'Phải tra soát' });
    else if (state.kind === 'all') chips.push({ id: 'kind', label: 'Tất cả loại' });
  }
  if (state.status) {
    chips.push({
      id: 'status',
      label: `Trạng thái: ${labels.statusLabel?.(state.status) ?? state.status}`,
    });
  }
  if (state.source) {
    chips.push({
      id: 'source',
      label: `Nguồn: ${labels.sourceLabel?.(state.source) ?? state.source}`,
    });
  }
  if (state.channel) {
    chips.push({
      id: 'channel',
      label: `Kênh: ${labels.channelLabel?.(state.channel) ?? state.channel}`,
    });
  }
  if (state.savedView === 'p1') {
    chips.push({ id: 'view', label: 'Lead P1' });
  }
  if (state.receivedFrom || state.receivedTo) {
    chips.push({
      id: 'dates',
      label: `Ngày: ${state.receivedFrom || '…'} → ${state.receivedTo || '…'}`,
    });
  }
  if (state.assignee) {
    chips.push({
      id: 'assignee',
      label: `Phụ trách: ${labels.assigneeLabel?.(state.assignee) ?? state.assignee}`,
    });
  }
  return chips;
}

export function clearLeadsFilterField(
  state: LeadsListUrlState,
  chipId: string,
): LeadsListUrlState {
  switch (chipId) {
    case 'q':
      return { ...state, q: '' };
    case 'owner':
      return { ...state, owner: 'all' };
    case 'kind':
      return { ...state, kind: 'pipeline' };
    case 'status':
      return { ...state, status: '' };
    case 'source':
      return { ...state, source: '' };
    case 'channel':
      return { ...state, channel: '' };
    case 'view':
      return { ...state, savedView: '' };
    case 'dates':
      return { ...state, receivedFrom: '', receivedTo: '' };
    case 'assignee':
      return { ...state, assignee: '' };
    default:
      return state;
  }
}

export function clearAllLeadsFilters(
  state: LeadsListUrlState,
  flowScope: CrmLeadsFlowScope,
): LeadsListUrlState {
  return {
    owner: 'all',
    kind: flowScope === 'b2b_prospect' ? 'all' : 'pipeline',
    status: '',
    source: '',
    channel: '',
    q: '',
    savedView: '',
    receivedFrom: '',
    receivedTo: '',
    assignee: '',
  };
}

const FILTER_STORAGE_PREFIX = 'rnosai.b2b.leads.filters.';

export function leadsFilterStorageKey(userId: string): string {
  return `${FILTER_STORAGE_PREFIX}${userId}`;
}

export function readSavedLeadsFilters(userId: string): LeadsListUrlState | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(leadsFilterStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LeadsListUrlState>;
    return {
      owner: parsed.owner === 'mine' || parsed.owner === 'unassigned' ? parsed.owner : 'all',
      kind: parsed.kind === 'review' || parsed.kind === 'pipeline' ? parsed.kind : 'all',
      status: String(parsed.status ?? ''),
      source: String(parsed.source ?? ''),
      channel: String(parsed.channel ?? ''),
      q: String(parsed.q ?? ''),
      savedView: String(parsed.savedView ?? ''),
      receivedFrom: String(parsed.receivedFrom ?? ''),
      receivedTo: String(parsed.receivedTo ?? ''),
      assignee: String(parsed.assignee ?? ''),
    };
  } catch {
    return null;
  }
}

export function writeSavedLeadsFilters(userId: string, state: LeadsListUrlState): void {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.setItem(leadsFilterStorageKey(userId), JSON.stringify(state));
}

export function leadsFiltersAreEmpty(state: LeadsListUrlState): boolean {
  return (
    !state.q &&
    !state.status &&
    !state.source &&
    !state.channel &&
    !state.savedView &&
    !state.receivedFrom &&
    !state.receivedTo &&
    !state.assignee &&
    state.owner === 'all'
  );
}
