import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_LABELS,
  MOAT_RECONCILE_SUCCESS,
  SKPI_SUBTITLES,
  WAR_ROOM_TILE_LABELS,
} from './service-kpi-copy';

describe('service-kpi-copy', () => {
  it('locks all mockup subtitle keys', () => {
    expect(Object.keys(SKPI_SUBTITLES).sort()).toEqual(
      ['contracts', 'instances', 'measurement', 'overview', 'packs', 'reconcile', 'templates', 'tracking', 'warroom'].sort(),
    );
    expect(SKPI_SUBTITLES.reconcile).toContain('Ba sổ');
    expect(SKPI_SUBTITLES.warroom).toMatch(/^SKPI-00 ·/);
    expect(SKPI_SUBTITLES.templates).toMatch(/^SKPI-01 ·/);
  });

  it('war room tile labels are ALL CAPS mockup', () => {
    expect(WAR_ROOM_TILE_LABELS.critical).toBe('CRITICAL QUÁ HẠN');
    expect(WAR_ROOM_TILE_LABELS.assumptions).toBe('ASSUMPTION MỞ');
  });

  it('classification labels in Vietnamese', () => {
    expect(CLASSIFICATION_LABELS.COMMITTED_DELIVERABLE?.label).toBe('Cam kết bàn giao');
    expect(CLASSIFICATION_LABELS.OPTIMIZATION_TARGET?.tone).toBe('purple');
  });

  it('reconcile moat mentions three ledgers', () => {
    expect(MOAT_RECONCILE_SUCCESS).toContain('Quoted');
    expect(MOAT_RECONCILE_SUCCESS).toContain('Delivered');
    expect(MOAT_RECONCILE_SUCCESS).toContain('Reported');
  });
});
