export const KPI_GROUPS_TENANT_ID = 'PTT';

export type KpiGroupStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type KpiGroupScopeType = 'ORGANIZATION' | 'DEPARTMENT' | 'POSITION' | 'CUSTOM';
export type KpiGroupDirection = 'INCREASE' | 'DECREASE' | 'RANGE';

export const KPI_GROUP_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export const KPI_GROUP_SCOPE_TYPES = ['ORGANIZATION', 'DEPARTMENT', 'POSITION', 'CUSTOM'] as const;
export const KPI_GROUP_DIRECTIONS = ['INCREASE', 'DECREASE', 'RANGE'] as const;

export const KPI_GROUP_UNIT_TYPES = [
  'COUNT',
  'PERCENT',
  'CURRENCY',
  'POINT',
  'HOUR',
  'DAY',
  'CUSTOMER',
  'LEAD',
  'VISIT',
] as const;

export const KPI_GROUP_DATA_DOMAINS = [
  'CRM',
  'MARKETING_AUTOMATION',
  'ADS',
  'WEBSITE_SEO',
  'SOCIAL',
  'SURVEY',
  'MANUAL',
] as const;

export type KpiGroupUnitType = (typeof KPI_GROUP_UNIT_TYPES)[number];
export type KpiGroupDataDomain = (typeof KPI_GROUP_DATA_DOMAINS)[number];

export const KPI_GROUP_ERROR_CODES = {
  CODE_REQUIRED: 'KPI_GROUP_CODE_REQUIRED',
  CODE_INVALID: 'KPI_GROUP_CODE_INVALID',
  CODE_DUPLICATE: 'KPI_GROUP_CODE_DUPLICATE',
  CODE_LOCKED: 'KPI_GROUP_CODE_LOCKED',
  SYSTEM_CODE_LOCKED: 'KPI_GROUP_SYSTEM_CODE_LOCKED',
  NAME_REQUIRED: 'KPI_GROUP_NAME_REQUIRED',
  NAME_DUPLICATE: 'KPI_GROUP_NAME_DUPLICATE',
  SCOPE_REQUIRED: 'KPI_GROUP_SCOPE_REQUIRED',
  DIRECTION_REQUIRED: 'KPI_GROUP_DIRECTION_REQUIRED',
  ORDER_INVALID: 'KPI_GROUP_ORDER_INVALID',
  DELETE_REFERENCED: 'KPI_GROUP_DELETE_REFERENCED',
  VERSION_CONFLICT: 'KPI_GROUP_VERSION_CONFLICT',
  NOT_FOUND: 'KPI_GROUP_NOT_FOUND',
  STATUS_INVALID: 'KPI_GROUP_STATUS_INVALID',
  COLOR_INVALID: 'KPI_GROUP_COLOR_INVALID',
} as const;

export type KpiGroupErrorCode = (typeof KPI_GROUP_ERROR_CODES)[keyof typeof KPI_GROUP_ERROR_CODES];

export type KpiGroupDepartmentRef = { id: number; name: string };
export type KpiGroupPositionRef = { id: number; name: string };
export type KpiGroupStaffRef = { id: number; name: string };

export type KpiGroupRow = {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string | null;
  scope_type: KpiGroupScopeType;
  default_direction: KpiGroupDirection;
  color: string;
  icon: string | null;
  display_order: number;
  status: KpiGroupStatus;
  is_system_default: boolean;
  created_by_staff_id: number;
  updated_by_staff_id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_staff_id: number | null;
  row_version: number;
  department_ids: number[];
  position_ids: number[];
  departments: KpiGroupDepartmentRef[];
  positions: KpiGroupPositionRef[];
  suggested_unit_types: string[];
  data_domains: string[];
  usage_count: number;
  updated_by_name: string | null;
};

export type KpiGroupListItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope_type: KpiGroupScopeType;
  departments: KpiGroupDepartmentRef[];
  positions: KpiGroupPositionRef[];
  default_direction: KpiGroupDirection;
  color: string;
  icon: string | null;
  display_order: number;
  status: KpiGroupStatus;
  usage_count: number;
  updated_at: string;
  updated_by: KpiGroupStaffRef | null;
  is_system_default: boolean;
  row_version: number;
};

export type KpiGroupDetail = KpiGroupListItem & {
  tenant_id: string;
  parent_id: string | null;
  suggested_unit_types: string[];
  data_domains: string[];
  created_by_staff_id: number;
  created_at: string;
};

export type KpiGroupListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
  department_id?: string;
  scope_type?: string;
  sort?: string;
  include_inactive?: boolean;
};

export type CreateKpiGroupBody = {
  code: string;
  name: string;
  description?: string | null;
  scope_type: KpiGroupScopeType;
  department_ids?: number[];
  position_ids?: number[];
  default_direction: KpiGroupDirection;
  suggested_unit_types?: string[];
  data_domains?: string[];
  color?: string;
  icon?: string | null;
  display_order?: number;
  status?: KpiGroupStatus;
};

export type PatchKpiGroupBody = Partial<
  Omit<CreateKpiGroupBody, 'status'>
> & {
  status?: KpiGroupStatus;
};

export type ChangeKpiGroupStatusBody = {
  status: KpiGroupStatus;
  reason?: string;
};

export type DuplicateKpiGroupBody = {
  code: string;
  name?: string;
};

export type ReorderKpiGroupsBody = {
  items: Array<{ id: string; display_order: number }>;
};

export type ImportKpiGroupsBody = {
  rows: CreateKpiGroupBody[];
};

export type ImportKpiGroupRowResult = {
  row_index: number;
  code?: string;
  ok: boolean;
  id?: string;
  error?: string;
};

export type ImportKpiGroupsResult = {
  created: number;
  failed: number;
  results: ImportKpiGroupRowResult[];
};

export type KpiGroupSummary = {
  total: number;
  active: number;
  draft: number;
  inactive: number;
};

export type KpiGroupAuditRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  performed_by_staff_id: number;
  performed_by_name: string | null;
  performed_at: string;
  ip_address: string | null;
  request_id: string | null;
};

export type KpiGroupAuditQuery = {
  page?: number;
  page_size?: number;
};

export type PaginatedMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export function toKpiGroupListItem(row: KpiGroupRow): KpiGroupListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    scope_type: row.scope_type,
    departments: row.department_ids.map((id, i) => ({
      id,
      name: '', // filled by repository join
    })),
    positions: row.position_ids.map((id) => ({ id, name: '' })),
    default_direction: row.default_direction,
    color: row.color,
    icon: row.icon,
    display_order: row.display_order,
    status: row.status,
    usage_count: row.usage_count,
    updated_at: row.updated_at,
    updated_by:
      row.updated_by_staff_id > 0
        ? { id: row.updated_by_staff_id, name: row.updated_by_name ?? '' }
        : null,
    is_system_default: row.is_system_default,
    row_version: row.row_version,
  };
}
