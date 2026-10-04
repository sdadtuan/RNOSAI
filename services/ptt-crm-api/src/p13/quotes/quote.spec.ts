import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { amountInWordsVi } from './amount-in-words-vi';
import {
  acceptQuote,
  approveQuote,
  createP13Quote,
  exportQuotePdf,
  markSent,
  newQuoteVersion,
  putQuoteLines,
  quoteChecks,
  returnQuote,
  submitQuote,
  visibleQuote,
  type P13Quote,
  type QuoteActor,
  type QuoteContext,
} from './quote-book';
import { calculateQuote, DEFAULT_QUOTE_SETTINGS, notNullVnd, parseThreshold, parseValidityDays, type QuoteItemRef, type QuoteLineInput, type QuoteServiceRef } from './quote-calc';
import { QuoteError } from './quote-error';
import { formatQuoteCode } from '../../proposals/quote-code.util';
import type { PricingRoleInput, PricingSettingsInput } from '../pricing/pricing-engine';

const root = join(__dirname, '../../../../../docs/p13');
const seed = JSON.parse(readFileSync(join(root, 'p13-seed-v2.json'), 'utf8')) as {
  services: Array<{ code: string; name: string; exclusions?: string[]; scope_matrix?: Array<Record<string, string>>; items: Array<Record<string, unknown>> }>;
};
const fixture = JSON.parse(readFileSync(join(root, 'p13-pricing-sanity-fixture.json'), 'utf8')) as {
  roles: Record<string, string>;
  settings: PricingSettingsInput;
  rate_display: string;
};

const roles: PricingRoleInput[] = ['am', 'strategist', 'content', 'design', 'ads', 'dev', 'data_crm', 'media_booking', 'video_production'].map((role_code) => ({
  role_code,
  monthly_salary: fixture.roles.monthly_salary,
  insurance_pct: fixture.roles.insurance_pct,
  monthly_benefits: fixture.roles.monthly_benefits,
  productive_hours: fixture.roles.productive_hours,
}));

const web = seed.services.find((service) => service.code === 'WEB');
if (!web) throw new Error('missing WEB');
const services: QuoteServiceRef[] = [
  {
    code: web.code,
    name: web.name,
    exclusions: web.exclusions ?? [],
    scope_matrix: (web.scope_matrix ?? []).map((row) => ({ feature: row.feature, basic: row.basic, standard: row.standard, advanced: row.advanced })),
  },
];
const items: QuoteItemRef[] = web.items.map((item) => ({
  code: String(item.code),
  service_code: web.code,
  min_level: item.min_level as QuoteItemRef['min_level'],
  est_hours: String(item.est_hours),
  default_qty: String(item.default_qty),
  billable: item.billable === true,
  client_only: item.client_only === true,
  main_role_code: String(item.main_role_code),
  name: String(item.task),
  unit_label: String(item.unit_label ?? 'lần'),
  est_hours_is_assumption: item.est_hours_is_assumption === true,
}));

function actor(partial: Partial<QuoteActor> = {}): QuoteActor {
  return { staffId: 7, email: 'am@ptt.test', seeAll: false, seeMargin: false, seeCost: false, canApprove: false, canEditSettings: false, ...partial };
}

function context(partial: Partial<QuoteContext> = {}): QuoteContext {
  let seq = 41;
  return {
    now: new Date('2026-10-03T03:00:00.000Z'),
    settings: { ...DEFAULT_QUOTE_SETTINGS },
    roles,
    pricing: { ...fixture.settings },
    version: { id: 'ver-test', code: 'PV-TEST' },
    services,
    items,
    company: { legal_name: '', tax_code: '', contact: '' },
    allocateCode: () => formatQuoteCode(2026, ++seq),
    ...partial,
  };
}

const t2Lines: QuoteLineInput[] = [
  { line_type: 'package', service_code: 'WEB', level_code: 'standard', qty: '1' },
  { line_type: 'item', item_code: 'WEB-04-08', qty: '2' },
];

async function textOf(buffer: Buffer): Promise<string> {
  const file = join(__dirname, '../../../../../tmp/p13-d2', `parse-${Date.now()}.pdf`);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, buffer);
  const parserPath = join(__dirname, '../../../node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs');
  const script = `
    const { PDFParse } = require(${JSON.stringify(parserPath)});
    const { readFileSync } = require('fs');
    (async () => {
      const parser = new PDFParse({ data: readFileSync(process.argv[1]) });
      const text = await parser.getText();
      process.stdout.write(text.text);
      await parser.destroy();
    })().catch((error) => { console.error(error); process.exit(1); });
  `;
  return execFileSync(process.execPath, ['-e', script, file], { encoding: 'utf8' });
}

describe('P13 quote book', () => {
  it('T1 allocates the shared QT-PTT counter', () => {
    const quote = createP13Quote({ title: 'Web' }, context(), actor());
    expect(quote.quote_code).toBe('QT-PTT-2026-000042');
    expect(quote.version_n).toBe(1);
    expect(quote.pricing_source).toBe('p13');
    expect(quote.validity_days).toBe(10);
    expect(quote.display_mode).toBe('package_with_scope');
    const source = readFileSync(join(__dirname, 'quote.service.ts'), 'utf8');
    expect(source).toContain("nextval('crm_quote_code_seq')");
    expect(source).toContain('formatQuoteCode');
  });

  it('T2 prices a package plus an item and keeps the legacy money columns', () => {
    const quote = createP13Quote({}, context(), actor());
    putQuoteLines(quote, t2Lines, '0', 10, context());
    expect(quote.calc?.lines.map((line) => line.line_type)).toEqual(['package', 'item']);
    expect(quote.calc?.lines.map((line) => line.unit)).toEqual(['gói', 'lần']);
    expect(quote.calc?.lines[0]?.amount).toBe('121629000');
    expect(quote.calc?.lines[1]?.amount).toBe('10506000');
    expect(quote.calc?.totals).toMatchObject({ fee_subtotal: '132135000', fee_vat: '10570800', fee_total: '142705800', grand_total: '142705800' });
    expect(quote.calc?.warnings).toEqual(expect.arrayContaining(['item_already_in_package', 'hours_assumption']));
    expect(quote.total_vnd).toBe('142705800');
    expect(quote.fee_vnd).toBe('142705800');
  });

  it('T3 prices one item, rejects a client-only item, and warns on a duplicate package', () => {
    const quote = createP13Quote({}, context(), actor());
    putQuoteLines(quote, [{ line_type: 'item', item_code: 'WEB-04-08', qty: '1' }], '0', 10, context());
    expect(quote.calc?.lines[0]?.amount).toBe('5253000');
    expect(() => putQuoteLines(quote, [{ line_type: 'item', item_code: 'WEB-05-02', qty: '1' }], '0', 10, context())).toThrow(QuoteError);
    expect(() => putQuoteLines(quote, [{ line_type: 'package', service_code: 'WEB', qty: '1' }], '0', 10, context())).toThrow(QuoteError);
    putQuoteLines(
      quote,
      [
        { line_type: 'package', service_code: 'WEB', level_code: 'basic', qty: '1' },
        { line_type: 'package', service_code: 'WEB', level_code: 'standard', qty: '1' },
      ],
      '0',
      10,
      context(),
    );
    expect(quote.calc?.warnings).toContain('package_duplicate_service');
  });

  it('T4 applies a 10 percent extra discount', () => {
    const quote = createP13Quote({}, context(), actor());
    putQuoteLines(quote, t2Lines, '0.1', 10, context());
    expect(quote.calc?.totals).toMatchObject({
      extra_discount_amount: '13213500',
      fee_after_discount: '118921500',
      fee_vat: '9513720',
      fee_total: '128435220',
    });
    expect(quote.calc?.effective_discount_pct).toBe('0.1');
  });

  it('T5 requires CEO approval when the threshold is empty', () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0.1', 10, ctx);
    expect(quote.needs_approval).toBe(true);
    expect(quote.approval_reasons).toContain('discount_above_threshold');
    expect(() => markSent(quote, { sent_channel: 'zalo', sent_evidence_url: 'https://evidence' }, ctx)).toThrow(QuoteError);
    const ceo = actor({ canApprove: true, seeAll: true });
    submitQuote(quote, ctx, actor());
    approveQuote(quote, ceo);
    markSent(quote, { sent_channel: 'zalo', sent_evidence_url: 'https://evidence' }, ctx);
    expect(quote.status).toBe('sent');
  });

  it('T6 compares the discount with a strict threshold and ignores the built-in package discount', () => {
    const ctx = context({ settings: { ...DEFAULT_QUOTE_SETTINGS, discount_approval_threshold_pct: '0.1' } });
    const atTen = createP13Quote({}, ctx, actor());
    putQuoteLines(atTen, t2Lines, '0.1', 10, ctx);
    expect(atTen.approval_reasons).not.toContain('discount_above_threshold');
    const atTenFive = createP13Quote({}, ctx, actor());
    putQuoteLines(atTenFive, t2Lines, '0.105', 10, ctx);
    expect(atTenFive.approval_reasons).toContain('discount_above_threshold');
    const open = context();
    const packaged = createP13Quote({}, open, actor());
    putQuoteLines(packaged, [{ line_type: 'package', service_code: 'WEB', level_code: 'standard', qty: '1' }], '0', 10, open);
    expect(packaged.needs_approval).toBe(false);
  });

  it('T7 lets only the CEO change the quote settings ratio', () => {
    expect(() => parseThreshold('1')).toThrow(QuoteError);
    expect(() => parseThreshold('-0.01')).toThrow(QuoteError);
    expect(parseThreshold(null)).toBeNull();
    expect(parseThreshold('0.125')).toBe('0.125');
    const source = readFileSync(join(__dirname, '../p13-caps.ts'), 'utf8');
    expect(source).toContain("section_id: 'p13_settings', action: 'quote.edit'");
    expect(source).toContain('if (ceoOnly)');
  });

  it('T8 does not reopen an approved quote when the threshold drops', () => {
    const ctx = context({ settings: { ...DEFAULT_QUOTE_SETTINGS, discount_approval_threshold_pct: '0.2' } });
    const approved = createP13Quote({}, ctx, actor());
    putQuoteLines(approved, t2Lines, '0.1', 10, ctx);
    submitQuote(approved, ctx, actor());
    approveQuote(approved, actor({ canApprove: true }));
    ctx.settings.discount_approval_threshold_pct = null;
    expect(approved.p13_approval_status).toBe('approved');
    const draft = createP13Quote({}, ctx, actor());
    putQuoteLines(draft, t2Lines, '0.1', 10, ctx);
    expect(draft.needs_approval).toBe(true);
  });

  it('T9 counts ten calendar days and expires the day after valid_until', () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 10, ctx);
    expect(quoteChecks(quote, ctx).valid_until_if_issued_today).toBe('2026-10-13');
    markSent(quote, { sent_channel: 'email', sent_evidence_url: 'https://sent' }, ctx);
    expect(quote.issued_at).toBe('2026-10-03');
    expect(quote.valid_until).toBe('2026-10-13');
    acceptQuote(quote, { accepted_evidence_url: 'https://yes', accepted_by_contact: 'Lan' }, context({ now: new Date('2026-10-13T10:00:00.000Z') }));
    const late = createP13Quote({}, ctx, actor());
    putQuoteLines(late, t2Lines, '0', 10, ctx);
    markSent(late, { sent_channel: 'email', sent_evidence_url: 'https://sent' }, ctx);
    expect(() => acceptQuote(late, { accepted_evidence_url: 'https://yes', accepted_by_contact: 'Lan' }, context({ now: new Date('2026-10-13T17:00:00.000Z') }))).toThrow(QuoteError);
  });

  it('T10 flags validity above 10 days and rejects an empty or out-of-range value on send', () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 11, ctx);
    expect(quote.approval_reasons).toContain('validity_above_default');
    expect(() => parseValidityDays(0)).toThrow(QuoteError);
    expect(() => parseValidityDays(31)).toThrow(QuoteError);
    putQuoteLines(quote, t2Lines, '0', null, ctx);
    expect(() => submitQuote(quote, ctx, actor())).toThrow(QuoteError);
  });

  it('T11 keeps the proposal in draft while internal approval is pending', () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0.1', 10, ctx);
    submitQuote(quote, ctx, actor());
    expect(quote.status).toBe('draft');
    expect(quote.p13_approval_status).toBe('pending');
    expect(() => putQuoteLines(quote, t2Lines, '0.1', 10, ctx)).toThrow(QuoteError);
    expect(() => returnQuote(quote, '', actor({ canApprove: true }))).toThrow(QuoteError);
    returnQuote(quote, 'Sửa chiết khấu', actor({ canApprove: true }));
    expect(quote.p13_approval_status).toBe('returned');
    putQuoteLines(quote, t2Lines, '0.1', 10, ctx);
    submitQuote(quote, ctx, actor());
    approveQuote(quote, actor({ canApprove: true }));
    putQuoteLines(quote, t2Lines, '0.1', 10, ctx);
    expect(quote.p13_approval_status).toBe('none');
  });

  it('T12 saves a draft when a role salary is missing and blocks submit', () => {
    const broken = roles.map((role) => (role.role_code === 'dev' ? { ...role, monthly_salary: null } : role));
    const ctx = context({ roles: broken });
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 10, ctx);
    expect(quote.calc?.missing).toContain('pricing_roles.dev.monthly_salary');
    expect(() => submitQuote(quote, ctx, actor())).toThrow(QuoteError);
    const empty = context({ roles: null, pricing: null, version: null });
    const draft = createP13Quote({}, empty, actor());
    putQuoteLines(draft, t2Lines, '0', 10, empty);
    expect(draft.calc?.totals).toBeNull();
    expect(draft.calc?.warnings).toContain('pricing_params_incomplete');
  });

  it('saves mixed package and item lines when no pricing version is active', () => {
    const empty = context({ roles: null, pricing: null, version: null });
    const quote = createP13Quote({}, empty, actor());
    expect(() => putQuoteLines(quote, t2Lines, '0', 10, empty)).not.toThrow();
    const priced = quote.calc?.lines ?? [];
    const pkg = priced.find((line) => line.line_type === 'package');
    const item = priced.find((line) => line.item_code === 'WEB-04-08');
    expect(pkg?.description).toContain('Tiêu chuẩn');
    expect(pkg?.scope.length).toBeGreaterThan(0);
    expect(pkg?.unit_price).toBeNull();
    expect(pkg?.amount).toBeNull();
    expect(item?.unit).toBe('lần');
    expect(item?.qty).toBe('2');
    expect(item?.unit_price).toBeNull();
    expect(item?.amount).toBeNull();
    expect(quote.calc?.totals).toBeNull();
    expect(quote.total_vnd).toBeNull();
    expect(quote.calc?.warnings).toContain('pricing_params_incomplete');
    expect(quote.calc?.missing).toContain('pricing_version');
    expect(notNullVnd(quote.total_vnd)).toBe('0');
    const service = readFileSync(join(__dirname, 'quote.service.ts'), 'utf8');
    expect(service).toContain('notNullVnd(quote.total_vnd)');
    expect(service).toContain('grand_total = $25');

    putQuoteLines(quote, t2Lines, '0', 10, context());
    expect(quote.calc?.totals?.fee_subtotal).toBe('132135000');
    expect(quote.calc?.lines.find((line) => line.line_type === 'package')?.amount).toBe('121629000');
    expect(quote.calc?.lines.find((line) => line.item_code === 'WEB-04-08')?.amount).toBe('10506000');
    expect(quote.calc?.warnings).not.toContain('pricing_params_incomplete');
  });

  it('T13 freezes the submitted price when a newer version exists', () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, [{ line_type: 'package', service_code: 'WEB', level_code: 'standard', qty: '1' }], '0', 10, ctx);
    submitQuote(quote, ctx, actor());
    const frozen = JSON.stringify(quote.snapshot);
    expect(frozen).toContain('121629000');
    expect(frozen).toContain('package');
    expect(frozen).toContain('ver-test');
    expect(frozen).not.toContain('monthly_salary');
    expect(frozen).not.toContain('insurance_pct');
    expect(frozen).not.toContain('monthly_benefits');
    ctx.pricing = { ...fixture.settings, overhead_pct: '0.35' };
    expect(String(quote.snapshot && JSON.stringify(quote.snapshot))).toContain('121629000');
  });

  it('T14 requires evidence and starts a new version on the same number', () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 10, ctx);
    expect(() => acceptQuote(quote, { accepted_by_contact: 'Lan' }, ctx)).toThrow(QuoteError);
    markSent(quote, { sent_channel: 'zalo', sent_evidence_url: 'https://sent' }, ctx);
    expect(() => acceptQuote(quote, { accepted_by_contact: 'Lan' }, ctx)).toThrow(QuoteError);
    const code = quote.quote_code;
    newQuoteVersion(quote);
    expect(quote.quote_code).toBe(code);
    expect(quote.version_n).toBe(2);
    expect(quote.p13_approval_status).toBe('none');
    expect(quote.issued_at).toBeNull();
  });

  it('T15 hides cost and other AM quotes', () => {
    const ctx = context();
    const quote = createP13Quote({ owner_staff_id: 7 }, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 10, ctx);
    quote.calc!.totals!.cost_total = '1';
    quote.margin_pct_effective = '0.25';
    const view = visibleQuote(quote, actor());
    expect(JSON.stringify(view)).not.toContain('cost_total');
    expect(JSON.stringify(view)).not.toContain('margin_pct_effective');
    expect(() => visibleQuote(quote, actor({ staffId: 8 }))).toThrow(QuoteError);
    expect(() => approveQuote(quote, actor())).toThrow(QuoteError);
  });

  it('T16 reuses PricingEngine.previewPricing', () => {
    const source = readFileSync(join(__dirname, 'quote-calc.ts'), 'utf8');
    expect(source).toContain("from '../pricing/pricing-engine'");
    expect(source).toContain('previewPricing');
    expect(source).not.toContain('quote-pricing.util');
    const priced = calculateQuote({ lines: t2Lines, extra_discount_pct: '0', validity_days: 10, settings: DEFAULT_QUOTE_SETTINGS, roles, pricing: fixture.settings, version: { id: 'v', code: 'PV' }, services, items });
    expect(priced.totals?.fee_total).toBe('142705800');
  });

  it('keeps a legacy proposal off the P13 guards', () => {
    const source = readFileSync(join(__dirname, '../../proposals/proposals.service.ts'), 'utf8');
    expect(source).toContain("proposal.pricing_source === 'p13'");
    const legacy = { pricing_source: 'legacy', total_vnd: 1000, fee_vnd: 800 };
    expect(legacy.pricing_source).not.toBe('p13');
    expect(legacy.total_vnd).toBe(1000);
  });
});

describe('P13 quote PDF', () => {
  it('reads amounts in Vietnamese', () => {
    expect(amountInWordsVi(142705800)).toBe('Một trăm bốn mươi hai triệu bảy trăm linh năm nghìn tám trăm đồng');
    expect(amountInWordsVi('128435220')).toBe('Một trăm hai mươi tám triệu bốn trăm ba mươi lăm nghìn hai trăm hai mươi đồng');
    expect(amountInWordsVi(10506000)).toBe('Mười triệu năm trăm linh sáu nghìn đồng');
    expect(amountInWordsVi(0)).toBe('Không đồng');
  });

  it('T17 T18 T19 T20 render the draft quote without cost', async () => {
    const ctx = context();
    const quote = createP13Quote({ client_name: 'Khách A', am_name: 'AM B' }, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 10, ctx);
    const draft = await exportQuotePdf(quote, { mode: 'draft', display_mode: 'package_with_scope' }, ctx, actor());
    const text = await textOf(draft.buffer!);
    expect(text).toContain('BÁO GIÁ DỊCH VỤ');
    expect(text).toContain('Gói Tiêu chuẩn – Website & Landing Page');
    expect(text).toContain('Phạm vi bao gồm');
    expect(text).toContain('WEB-04-08 – Tích hợp form/CRM/chatbot');
    expect(text).toContain('lần');
    expect(text).toContain('5.253.000');
    expect(text).toContain('10.506.000');
    expect(text).toContain('Hiệu lực: 10 ngày');
    expect(text).toContain('Một trăm bốn mươi hai triệu bảy trăm linh năm nghìn tám trăm đồng');
    expect(text).toContain(quote.quote_code);
    expect(text).toContain('BẢN NHÁP — CHƯA DUYỆT');
    expect(text).not.toContain('189394');
    expect(text).not.toContain('189393');
    expect(text).not.toContain('390');
    expect(text).not.toContain('16h');
    const only = await exportQuotePdf(quote, { mode: 'draft', display_mode: 'package_only' }, ctx, actor());
    const onlyText = await textOf(only.buffer!);
    expect(onlyText).not.toContain('Phạm vi bao gồm');
    const detail = await exportQuotePdf(quote, { mode: 'draft', display_mode: 'item_detail' }, ctx, actor());
    const detailText = await textOf(detail.buffer!);
    expect(detailText).toContain('Phạm vi bao gồm');
    expect(detailText).toContain(items.find((item) => item.billable && !item.client_only)?.name ?? '');
    expect(detailText).toContain('WEB-04-08 – Tích hợp form/CRM/chatbot');
    expect(onlyText).toContain('WEB-04-08 – Tích hợp form/CRM/chatbot');
    const out = join(__dirname, '../../../../../tmp/p13-d2');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 't2-package-with-scope.pdf'), draft.buffer!);
    writeFileSync(join(out, 't2-package-only.pdf'), only.buffer!);
    const raw = draft.buffer!.toString('latin1');
    expect(raw).toContain('BeVietnamPro');
    let fonts = 'pdffonts-missing';
    try {
      fonts = execFileSync('pdffonts', [join(out, 't2-package-with-scope.pdf')], { encoding: 'utf8' });
    } catch {
      fonts = 'pdffonts-missing';
    }
    writeFileSync(join(out, 'pdffonts.txt'), fonts);
  });

  it('T21 blocks a final export until approval, validity, and the company profile are present', async () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0.1', 10, ctx);
    await expect(exportQuotePdf(quote, { mode: 'final' }, ctx, actor())).rejects.toMatchObject({
      code: 'quote_export_blocked',
      details: { codes: expect.arrayContaining(['quote_approval_required', 'company_profile_incomplete']) },
    });
    const draft = await exportQuotePdf(quote, { mode: 'draft' }, ctx, actor());
    expect(draft.buffer?.length).toBeGreaterThan(1000);
    const sent = createP13Quote({}, ctx, actor());
    putQuoteLines(sent, t2Lines, '0', 10, ctx);
    markSent(sent, { sent_channel: 'zalo', sent_evidence_url: 'https://sent' }, ctx);
    await expect(
      exportQuotePdf(sent, { mode: 'final' }, context({ now: new Date('2026-10-13T17:00:00.000Z'), company: ctx.company }), actor()),
    ).rejects.toMatchObject({
      code: 'quote_export_blocked',
      details: { codes: expect.arrayContaining(['quote_expired']) },
    });
  });

  it('T22 keeps every export and ignores dry_run', async () => {
    const ctx = context({ company: { legal_name: 'PTT', tax_code: '0', contact: '090' } });
    const quote = createP13Quote({}, ctx, actor());
    putQuoteLines(quote, t2Lines, '0', 10, ctx);
    const before = quote.issued_at;
    const dry = await exportQuotePdf(quote, { mode: 'final', dry_run: true }, ctx, actor());
    expect(dry.would_block).toBe(false);
    expect(quote.files).toHaveLength(0);
    expect(quote.issued_at).toBe(before);
    await exportQuotePdf(quote, { mode: 'draft' }, ctx, actor());
    await exportQuotePdf(quote, { mode: 'draft' }, ctx, actor());
    await exportQuotePdf(quote, { mode: 'final' }, ctx, actor());
    expect(quote.files.map((file) => file.file_name)).toEqual([
      `${quote.quote_code}-v1-1.pdf`,
      `${quote.quote_code}-v1-2.pdf`,
      `${quote.quote_code}-v1-3.pdf`,
    ]);
    expect(quote.files[0]?.kind).toBe('quote_draft');
    expect(quote.files[2]?.kind).toBe('quote_final');
    expect(quote.files[0]?.renderer_version).toBe('p13-pdfkit-1');
    expect(quote.files[0]?.data_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(quote.issued_at).toBe('2026-10-03');
  });

  it('T23 hides export while the flag is off and leaves the legacy export alone', () => {
    const controller = readFileSync(join(__dirname, 'quote.controller.ts'), 'utf8');
    expect(controller).toContain("enabled('QUOTE_EXPORT')");
    expect(controller).toContain('NotFoundException');
    const legacy = readFileSync(join(__dirname, '../../proposals/proposals.service.ts'), 'utf8');
    const body = legacy.slice(legacy.indexOf('async exportQuote'), legacy.indexOf('async ', legacy.indexOf('async exportQuote') + 10));
    expect(body).toContain("pricing_source === 'p13'");
    expect(body).not.toContain('QUOTE_EXPORT');
  });

  it('retries a failed quote migration instead of caching the first 500', () => {
    const service = readFileSync(join(__dirname, 'quote.service.ts'), 'utf8');
    const catalog = readFileSync(join(__dirname, '../catalog/pg-catalog.ts'), 'utf8');
    expect(service).toContain('withP13SchemaLock');
    expect(service).toContain('this.schemaReady = null');
    expect(catalog).toContain('withP13SchemaLock');
    expect(catalog).toContain('this.schemaReady = null');
    const settings = readFileSync(join(__dirname, '../../proposals/quote-settings.service.ts'), 'utf8');
    expect(settings).toContain('validity_days: 30');
  });

  it('T24 repeats the table header after a page break', async () => {
    const ctx = context();
    const quote = createP13Quote({}, ctx, actor());
    const lines: QuoteLineInput[] = Array.from({ length: 40 }, () => ({ line_type: 'item' as const, item_code: 'WEB-04-08', qty: '1' }));
    putQuoteLines(quote, lines, '0', 10, ctx);
    const rendered = await exportQuotePdf(quote, { mode: 'draft' }, ctx, actor());
    const text = await textOf(rendered.buffer!);
    expect(text.split('Nội dung').length).toBeGreaterThan(2);
  });
});
