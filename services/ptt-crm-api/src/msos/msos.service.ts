import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { throwDisabled } from './msos-errors.util';
import { assertAllowedMsosName } from './msos-forbidden-seed.util';
import { MsosRepository } from './msos.repository';
import type {
  CreateInventoryInput,
  CreatePartnerInput,
  CreatePlacementInput,
  MsosHealthDto,
  MsosInventoryRow,
  MsosPartnerRow,
  MsosPlacementRow,
} from './msos.types';

@Injectable()
export class MsosService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MsosRepository,
  ) {}

  assertEnabled(): void {
    if (!this.config.mediaOsEnabled) {
      throwDisabled();
    }
  }

  getHealth(): MsosHealthDto {
    return {
      ok: true,
      reseller: this.config.mediaOsReseller,
      connector_write: this.config.mediaOsConnectorWrite,
    };
  }

  async listPartners(): Promise<MsosPartnerRow[]> {
    this.assertEnabled();
    return this.repo.listPartners();
  }

  async createPartner(input: CreatePartnerInput): Promise<MsosPartnerRow> {
    this.assertEnabled();
    const legalName = String(input.legal_name ?? '').trim();
    if (!legalName) {
      throw new UnprocessableEntityException({ error: 'legal_name_required' });
    }
    assertAllowedMsosName(legalName);
    return this.repo.createPartner({ ...input, legal_name: legalName });
  }

  async listInventories(): Promise<MsosInventoryRow[]> {
    this.assertEnabled();
    return this.repo.listInventories();
  }

  async createInventory(input: CreateInventoryInput): Promise<MsosInventoryRow> {
    this.assertEnabled();
    const name = String(input.name ?? '').trim();
    if (!name) {
      throw new UnprocessableEntityException({ error: 'name_required' });
    }
    assertAllowedMsosName(name);
    if (input.property_host) {
      assertAllowedMsosName(input.property_host);
    }
    if (input.owner_kind === 'partner' && !input.partner_id) {
      throw new UnprocessableEntityException({ error: 'partner_id_required' });
    }
    if (input.owner_kind === 'ptt' && input.partner_id) {
      throw new UnprocessableEntityException({ error: 'partner_id_forbidden_for_ptt' });
    }
    return this.repo.createInventory({ ...input, name });
  }

  async listPlacements(): Promise<MsosPlacementRow[]> {
    this.assertEnabled();
    return this.repo.listPlacements();
  }

  async createPlacement(input: CreatePlacementInput): Promise<MsosPlacementRow> {
    this.assertEnabled();
    const name = String(input.name ?? '').trim();
    if (!name) {
      throw new UnprocessableEntityException({ error: 'name_required' });
    }
    assertAllowedMsosName(name);
    return this.repo.createPlacement({ ...input, name });
  }
}
