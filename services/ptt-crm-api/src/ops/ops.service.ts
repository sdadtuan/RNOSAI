import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { OPS_PACKAGE_TIERS } from './ops.constants';
import { buildOpsHubPayload } from './ops-hub.builder';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { resolveDvByLifecycleSlug } from './ops-slug-resolver.util';
import type {
  OpsCatalogItem,
  OpsCatalogResponse,
  OpsHubPayload,
  OpsRouteMapService,
  OpsServiceProfileRow,
} from './ops.types';

@Injectable()
export class OpsService implements OnModuleInit {
  constructor(
    private readonly config: AppConfigService,
    private readonly routeMapLoader: OpsRouteMapLoader,
    private readonly profiles: OpsProfilePgRepository,
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.opsDvEnabled) return;
    try {
      const count = await this.profiles.countProfiles();
      if (count === 0) {
        await this.profiles.syncFromRouteMap(this.routeMapLoader.getMap().services);
      }
    } catch {
      // PG optional — route map still serves catalog/hub
    }
  }

  private assertEnabled(): void {
    if (!this.config.opsDvEnabled) {
      throw new ServiceUnavailableException({ error: 'ops_dv_disabled' });
    }
  }

  private hubFlags() {
    return {
      opsDvEnabled: this.config.opsDvEnabled,
      opsWeeklySpawnEnabled: this.config.opsWeeklySpawnEnabled,
      opsHubPilotDv: this.config.opsHubPilotDv,
    };
  }

  health() {
    return {
      ok: true,
      ops_dv_enabled: this.config.opsDvEnabled,
      route_map: this.routeMapLoader.isLoaded()
        ? this.routeMapLoader.getLoadedPath()
        : null,
    };
  }

  private routeEntryToCatalogItem(entry: OpsRouteMapService): OpsCatalogItem {
    return {
      dv_code: entry.code,
      name: entry.name_vi,
      service_slug: entry.service_slugs.primary,
      readiness: entry.readiness,
      package_tiers: [...OPS_PACKAGE_TIERS],
      ops_web: (entry.ops_web ?? {}) as Record<string, unknown>,
    };
  }

  private profileToCatalogItem(row: OpsServiceProfileRow): OpsCatalogItem {
    return {
      dv_code: row.dv_code,
      name: row.name,
      service_slug: row.service_slug,
      readiness: row.readiness,
      package_tiers: [...OPS_PACKAGE_TIERS],
      ops_web: row.ops_web_json,
    };
  }

  async getCatalog(): Promise<OpsCatalogResponse> {
    this.assertEnabled();
    const map = this.routeMapLoader.getMap();
    let rows: OpsServiceProfileRow[] = [];
    try {
      rows = await this.profiles.listProfiles();
    } catch {
      rows = [];
    }
    const services =
      rows.length > 0
        ? rows.map((row) => this.profileToCatalogItem(row))
        : map.services.map((entry) => this.routeEntryToCatalogItem(entry));
    return {
      schema_version: map.schema_version ?? '1.0.0',
      services,
    };
  }

  async getCatalogByCode(dvCode: string) {
    this.assertEnabled();
    const code = String(dvCode ?? '').trim().toUpperCase();
    const map = this.routeMapLoader.getMap();
    let profile: OpsServiceProfileRow | null = null;
    try {
      profile = await this.profiles.getByDvCode(code);
    } catch {
      profile = null;
    }
    const entry = map.services.find((s) => s.code === code);
    if (!profile && !entry) {
      throw new NotFoundException({ error: 'dv_not_found' });
    }
    return {
      profile: profile
        ? {
            ...profile,
            package_tiers: [...OPS_PACKAGE_TIERS],
            route_entry: entry ?? null,
          }
        : {
            dv_code: entry!.code,
            name: entry!.name_vi,
            service_slug: entry!.service_slugs.primary,
            readiness: entry!.readiness,
            service_slugs_json: entry!.service_slugs,
            ops_web_json: entry!.ops_web ?? {},
            nest_api_json: entry!.nest_api ?? {},
            weekly_process_template: [],
            kpi_definitions: [],
            tier_pricing: {},
            package_tiers: [...OPS_PACKAGE_TIERS],
          },
    };
  }

  async getHub(lifecycleId: number): Promise<OpsHubPayload> {
    this.assertEnabled();
    const detail = await this.lifecycle.detail(lifecycleId);
    const serviceSlug = String(detail.service_slug ?? '').trim();
    const map = this.routeMapLoader.getMap();
    const dv = resolveDvByLifecycleSlug(serviceSlug, map);
    if (!dv) {
      throw new UnprocessableEntityException({
        error: 'unknown_service_slug',
        slug: serviceSlug,
      });
    }

    let profile: OpsServiceProfileRow | null = null;
    try {
      profile = await this.profiles.getByDvCode(dv.code);
    } catch {
      profile = null;
    }

    let clientName = '';
    let agencyClientId = '';
    try {
      const ctx = await this.lifecycle.context(lifecycleId);
      clientName = String(ctx.lead?.full_name ?? ctx.contract?.title ?? '').trim();
      agencyClientId = String(ctx.contract?.agency_client_id ?? '').trim();
    } catch {
      clientName = '';
    }

    return buildOpsHubPayload({
      ctx: {
        lifecycleId,
        serviceSlug,
        status: String(detail.status ?? ''),
        clientName,
        packageTier: 'standard',
        agencyClientId: agencyClientId || undefined,
      },
      dv,
      profile,
      flags: this.hubFlags(),
    });
  }
}
