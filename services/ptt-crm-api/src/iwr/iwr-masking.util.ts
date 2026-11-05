import type { IwrActor } from './iwr.types';

export type IwrFieldSensitivity = 'internal' | 'hr' | 'finance';

export type IwrTemplateFieldDef = {
  key: string;
  sensitivity: IwrFieldSensitivity;
};

const MASK = '***';

function hasCap(actor: IwrActor, section: string, action: string): boolean {
  return actor.caps.some((c) => c.section === section && c.action === action);
}

export function canSeeSensitiveField(actor: IwrActor, sensitivity: IwrFieldSensitivity): boolean {
  if (sensitivity === 'internal') return true;
  if (hasCap(actor, 'iwr', 'manage') || hasCap(actor, 'iwr', 'executive')) return true;
  if (sensitivity === 'hr' && hasCap(actor, 'hr', 'view')) return true;
  if (sensitivity === 'finance' && hasCap(actor, 'finance', 'view')) return true;
  return false;
}

export function maskSections(
  sections: Record<string, unknown>,
  fields: IwrTemplateFieldDef[],
  viewer: IwrActor,
): Record<string, unknown> {
  const out = { ...sections };
  for (const f of fields) {
    if (canSeeSensitiveField(viewer, f.sensitivity)) continue;
    if (!(f.key in out)) continue;
    const sec = out[f.key];
    if (sec && typeof sec === 'object') {
      out[f.key] = { ...(sec as object), body: MASK, items: [] };
    } else {
      out[f.key] = { body: MASK, items: [] };
    }
  }
  return out;
}
