export type OpsReadiness = 'ready' | 'partial' | 'gap';

export type OpsRouteMapService = {
  code: string;
  name_vi: string;
  department?: string;
  package_tiers?: string[];
  readiness: OpsReadiness;
  service_slugs: {
    primary: string;
    alternates?: string[];
    existing_in_valid_slugs?: boolean;
  };
  depends_on_dv?: string[];
  ops_web?: {
    shell?: string[];
    execution?: Array<{ route: string; purpose?: string }>;
    tabs?: string[];
  };
  nest_api?: Record<string, unknown>;
  gaps?: string[];
};

export type OpsRouteMap = {
  schema_version: string;
  services: OpsRouteMapService[];
};

export type OpsServiceProfileRow = {
  id: number;
  dv_code: string;
  service_slug: string;
  name: string;
  readiness: OpsReadiness;
  service_slugs_json: Record<string, unknown>;
  ops_web_json: Record<string, unknown>;
  nest_api_json: Record<string, unknown>;
  weekly_process_template: unknown[];
  kpi_definitions: unknown[];
  tier_pricing: Record<string, unknown>;
};

export type OpsCatalogItem = {
  dv_code: string;
  name: string;
  service_slug: string;
  readiness: OpsReadiness;
  package_tiers: string[];
  ops_web: Record<string, unknown>;
};

export type OpsCatalogResponse = {
  schema_version: string;
  services: OpsCatalogItem[];
};

export type OpsHubEngine = {
  id: string;
  label: string;
  href: string;
  status: OpsReadiness | 'gap';
  badge: string | null;
};

export type OpsHubPayload = {
  lifecycle: {
    id: number;
    slug: string;
    client_name: string;
    status: string;
    package_tier: string;
  };
  dv: {
    dv_code: string;
    name: string;
    readiness: OpsReadiness;
  };
  engines: OpsHubEngine[];
  weekly: {
    iso_week: string;
    spawned: boolean;
    tasks_pending: number;
    tasks_done: number;
  };
  kpi: {
    period_key: string;
    metrics: unknown[];
  };
  flags: {
    ops_dv_enabled: boolean;
    weekly_spawn_enabled: boolean;
    pilot_dv: boolean;
  };
};

export type OpsHubBuildContext = {
  lifecycleId: number;
  serviceSlug: string;
  status: string;
  clientName: string;
  packageTier: string;
  agencyClientId?: string;
};

export type OpsHubFlags = {
  opsDvEnabled: boolean;
  opsWeeklySpawnEnabled: boolean;
  opsHubPilotDv: Set<string>;
};
