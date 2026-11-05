import { readFileSync } from 'fs';
import { join } from 'path';
import { loadStaffPermissionCatalog, normalizeGrantPayload } from './staff-permissions.catalog';

export type HandoverRbacDoc = {
  meta: {
    version: string;
    date: string;
    source: string;
    catalog_version?: string;
    notes?: string;
    position_codes?: string[];
  };
  grants_by_position: Record<string, Record<string, string[]>>;
};

export const HANDOVER_POSITION_CODES = [
  'CEO',
  'AE',
  'ACM',
  'CE',
  'MEP',
  'GD',
  'MKL',
  'PD',
] as const;

let cachedDoc: HandoverRbacDoc | null = null;

export function loadHandoverRbacDoc(): HandoverRbacDoc {
  if (cachedDoc) return cachedDoc;
  const path = join(__dirname, 'data', 'rnosai_handover_rbac_grants.json');
  cachedDoc = JSON.parse(readFileSync(path, 'utf8')) as HandoverRbacDoc;
  return cachedDoc;
}

export function handoverGrantsForCode(code: string): Record<string, string[]> | null {
  const doc = loadHandoverRbacDoc();
  const raw =
    doc.grants_by_position[code] ||
    doc.grants_by_position[code.toUpperCase()] ||
    doc.grants_by_position[code.toLowerCase()];
  if (!raw) return null;
  return normalizeGrantPayload(raw);
}

/** Full catalog grants for SUPER-ADMIN (every section action + UI buttons). */
export function buildFullCatalogGrants(): Record<string, string[]> {
  const catalog = loadStaffPermissionCatalog();
  const grants: Record<string, string[]> = {};
  for (const [sectionId, actions] of Object.entries(catalog.section_actions ?? {})) {
    if (Array.isArray(actions) && actions.length) {
      grants[sectionId] = [...new Set(actions.map((a) => String(a).toLowerCase()))].sort();
    }
  }
  for (const btn of catalog.ui_buttons ?? []) {
    const req = String(btn.requires_action || '').toLowerCase();
    if (btn.id && req) grants[btn.id] = [req];
  }
  return normalizeGrantPayload(grants);
}
