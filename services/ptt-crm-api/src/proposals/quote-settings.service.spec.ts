import { QuoteSettingsService } from './quote-settings.service';

const DEFAULT_PTT = {
  tenant_id: 'PTT',
  quote_code_pattern: 'QT-PTT-{YYYY}-{SEQ:6}',
  validity_days: 30,
  vat_bps: 800,
  currency_code: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  issuing_entity: 'PTT-HCM',
  payment_template: '50/30/20',
  gm_floor_bps: 2500,
  discount_auto_bps: 500,
  director_value_vnd: 200000000,
  payment_term_max_days: 60,
  share_expiry_days: 14,
  pdf_download: true,
  otp_required: true,
  view_tracking: true,
  ai_enabled: false,
};

class SettingsMemory {
  row: Record<string, unknown> | null = { ...DEFAULT_PTT };

  async query(sql: string, params: unknown[] = []) {
    if (/INSERT INTO crm_quote_settings/i.test(sql)) {
      if (!this.row) this.row = { ...DEFAULT_PTT };
      return { rows: [this.row] };
    }
    if (/UPDATE crm_quote_settings/i.test(sql)) {
      if (!this.row) this.row = { ...DEFAULT_PTT };
      applyUpdate(sql, params, this.row);
      return { rows: [this.row] };
    }
    return { rows: this.row ? [this.row] : [] };
  }
}

function applyUpdate(sql: string, params: unknown[], row: Record<string, unknown>) {
  const setPart = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1] ?? '';
  for (const [, field, idx] of setPart.matchAll(/(\w+)\s*=\s*\$(\d+)/g)) {
    if (field === 'updated_at') {
      row.updated_at = new Date().toISOString();
      continue;
    }
    row[field] = params[Number(idx) - 1];
  }
}

function loadService(db: SettingsMemory) {
  return new QuoteSettingsService(db);
}

const ORIGINAL_QT_AI = process.env.QT_AI_ENABLED;

describe('QuoteSettingsService', () => {
  afterEach(() => {
    if (ORIGINAL_QT_AI === undefined) delete process.env.QT_AI_ENABLED;
    else process.env.QT_AI_ENABLED = ORIGINAL_QT_AI;
  });

  it('GET returns default PTT settings', async () => {
    const settings = await loadService(new SettingsMemory()).get();

    expect(settings).toMatchObject(DEFAULT_PTT);
  });

  it('PATCH updates vat_bps to 800', async () => {
    const db = new SettingsMemory();
    db.row = { ...DEFAULT_PTT, vat_bps: 1000 };
    const settings = loadService(db);

    const patched = await settings.patch({ vat_bps: 800 }, 42);

    expect(patched?.vat_bps).toBe(800);
    const stored = await settings.get();
    expect(stored?.vat_bps).toBe(800);
    expect(stored?.updated_by_staff_id).toBe(42);
  });

  it('PATCH ai_enabled is ignored when QT_AI_ENABLED is unset', async () => {
    delete process.env.QT_AI_ENABLED;
    const db = new SettingsMemory();
    const settings = loadService(db);

    const patched = await settings.patch({ ai_enabled: true }, 7);

    expect(patched?.ai_enabled).toBe(false);
    const stored = await settings.get();
    expect(stored?.ai_enabled).toBe(false);
  });

  it('PATCH does not change quote_code_pattern', async () => {
    const db = new SettingsMemory();
    const settings = loadService(db);

    const patched = await settings.patch(
      { quote_code_pattern: 'QT-HACK-{YYYY}-{SEQ:6}', vat_bps: 800 },
      1,
    );

    expect(patched?.quote_code_pattern).toBe('QT-PTT-{YYYY}-{SEQ:6}');
  });
});
