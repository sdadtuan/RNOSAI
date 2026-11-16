
/* Node 16 runner for a handful of portal-web unit tests (vitest needs a newer Node). */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require(path.resolve(__dirname, "../node_modules/typescript"));

const SRC = path.resolve(__dirname, "../src");
const failures = [];
let passed = 0;

function assert(cond, msg) {
  if (!cond) failures.push(msg);
  else passed += 1;
}
function assertEq(a, b, msg) {
  const ok = Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
  assert(ok, (msg || "equal") + " — got " + JSON.stringify(a) + " expected " + JSON.stringify(b));
}
function assertClose(a, b, digits, msg) {
  const ok = Math.abs(a - b) < Math.pow(10, -digits);
  assert(ok, (msg || "close") + " — got " + a + " expected " + b);
}

const cache = new Map();

function loadTs(rel) {
  const abs = path.resolve(SRC, rel);
  if (cache.has(abs)) return cache.get(abs);
  const raw = fs.readFileSync(abs, "utf8");
  const { outputText, diagnostics } = ts.transpileModule(raw, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: abs,
  });
  const boxed = new Module(abs);
  boxed.filename = abs;
  boxed.paths = Module._nodeModulePaths(path.dirname(abs));
  boxed.require = function (request) {
    if (request.startsWith("@/")) {
      let target = request.slice(2);
      if (!target.endsWith(".ts") && !target.endsWith(".tsx")) {
        const asTs = path.resolve(SRC, target + ".ts");
        const asTsx = path.resolve(SRC, target + ".tsx");
        if (fs.existsSync(asTs)) return loadTs(path.relative(SRC, asTs).replace(/\\/g, "/"));
        if (fs.existsSync(asTsx)) return loadTs(path.relative(SRC, asTsx).replace(/\\/g, "/"));
      }
      return loadTs(target);
    }
    if (request.startsWith(".")) {
      const resolved = path.resolve(path.dirname(abs), request);
      if (fs.existsSync(resolved + ".ts")) return loadTs(path.relative(SRC, resolved + ".ts").replace(/\\/g, "/"));
      if (fs.existsSync(resolved + ".tsx")) return loadTs(path.relative(SRC, resolved + ".tsx").replace(/\\/g, "/"));
    }
    return Module._load(request, boxed, false);
  };
  boxed._compile(outputText, abs);
  cache.set(abs, boxed.exports);
  return boxed.exports;
}

const refresh = loadTs("lib/portal/ads-live-refresh.ts");
assertEq(refresh.PORTAL_ADS_POLL_MS, 60000, "poll is 60s");
assertEq(refresh.saigonHm(new Date("2026-11-13T07:22:00.000Z")), "14:22", "saigon 14:22");
assertEq(refresh.adsUpdatedLabel(new Date("2026-11-13T07:22:00.000Z")), "Cập nhật lúc 14:22", "label");
assertEq(refresh.adsUpdatedLabel(null), "", "empty label");
assertEq(refresh.adsLoadMode(false, "user"), "full", "first load");
assertEq(refresh.adsLoadMode(true, "user"), "quiet", "later user");
assertEq(refresh.adsLoadMode(false, "poll"), "quiet", "poll without data");
assertEq(refresh.adsLoadMode(true, "poll"), "quiet", "poll with data");

const donut = loadTs("lib/portal/donut-arcs.ts");
assertEq(donut.donutArcs([{ label: "A", value: 0, color: "#000" }], 50).length, 0, "empty donut");
const circ = 2 * Math.PI * 50;
const arcs = donut.donutArcs([
  { id: "a", label: "A", value: 1, color: "#111" },
  { id: "b", label: "B", value: 3, color: "#222" },
  { id: "zero", label: "Z", value: 0, color: "#333" },
], 50);
assertEq(arcs.length, 2, "two arcs");
assertEq(arcs[0].id, "a", "first id");
assertEq(arcs[0].dashoffset, 0, "first offset");
assertEq(arcs[0].dasharray, circ / 4 + " " + (circ - circ / 4), "first dash");
assertClose(arcs[1].dashoffset, -(circ / 4), 8, "second offset");

const conv = loadTs("lib/portal/dashboard-conversion.util.ts");
const rows = [
  { customer_id: "c1", last_interaction_at: "2026-11-10T03:00:00+07:00" },
  { customer_id: null, last_interaction_at: "2026-11-11T10:00:00+07:00" },
  { customer_id: "c2", last_interaction_at: "2026-11-12T22:00:00+07:00" },
  { customer_id: "c3", last_interaction_at: "2026-11-05T08:00:00+07:00" },
  { customer_id: "c4", last_interaction_at: "" },
];
assertEq(conv.conversionRatio(rows, "2026-11-10", "2026-11-12"), { converted: 2, total: 3, percent: (2 / 3) * 100 }, "ratio");
assertEq(conv.conversionRatio(rows, "2026-11-01", "2026-11-02"), { converted: 0, total: 0, percent: null }, "empty range");
assertEq(
  conv.conversionRatio([{ customer_id: null, last_interaction_at: "2026-11-11T10:00:00+07:00" }], "2026-11-11", "2026-11-11"),
  { converted: 0, total: 1, percent: 0 },
  "zero conversion",
);
assertEq(conv.conversionRatio([{ customer_id: "c1", created_at: "2026-11-12T01:00:00+07:00" }], "2026-11-12", "2026-11-12").converted, 1, "created_at fallback");

function prow(partial) {
  return Object.assign({
    external_campaign_id: "c1",
    external_campaign_name: "Camp",
    currency: "VND",
    impressions: 0,
    clicks: 0,
    leads_crm: 0,
    leads_platform: 0,
    cpl: null,
    target_cpl_vnd: null,
    cpl_delta_vnd: null,
    cpl_delta_pct: null,
    conversion_value: 0,
    roas: null,
    roas_stub: false,
    hub_mapped: true,
    synced_at: null,
    performance_date: "2026-11-12",
  }, partial);
}
const adsRows = [
  prow({ channel: "meta", spend: 100000, clicks: 14, impressions: 610 }),
  prow({ channel: "meta", spend: 50000, clicks: 2, impressions: 90 }),
  prow({ channel: "zalo", spend: 80000, clicks: 5, impressions: 200 }),
  prow({ channel: "google", spend: 0, clicks: 0, impressions: 0 }),
];
assertEq(conv.spendByChannel(adsRows), [
  { id: "meta", label: "Meta", value: 150000, color: "#17692f" },
  { id: "zalo", label: "Zalo Ads", value: 80000, color: "#0d9488" },
], "spend by channel");
const totals = conv.adsTotalsFromRows(adsRows);
assertEq(totals.clicks, 21, "clicks");
assertEq(totals.impressions, 900, "impressions");
assertClose(totals.ctr, (21 / 900) * 100, 8, "ctr");
assertEq(conv.adsSummarySpend({ summary: { total_spend: 230000 }, rows: adsRows }), 230000, "summary spend");
assertEq(conv.adsSummarySpend(null), null, "null spend");

assertEq(conv.adsChannelOf('facebook'), 'meta', 'facebook->meta');
assertEq(conv.adsChannelOf('meta'), 'meta', 'meta->meta');
assertEq(conv.adsChannelOf(null, 'qa4-local-demo-camp-zalo-oa'), 'zalo', 'campaign zalo');
assertEq(conv.adsChannelOf('facebook', null, ['zalo']), 'zalo', 'labels zalo wins');

const breakdown = conv.adsChannelBreakdown({
  connectedIds: ['meta', 'zalo'],
  spendRows: [prow({ channel: 'meta', spend: 100000, clicks: 10, impressions: 500 })],
  leads: [
    { channel: 'facebook', last_interaction_at: '2026-11-12T10:00:00+07:00' },
    { labels: ['zalo'], last_interaction_at: '2026-11-12T11:00:00+07:00' },
  ],
  messages: [],
  from: '2026-11-10',
  to: '2026-11-12',
});
assertEq(breakdown.length, 2, 'two connected channels');
assertEq(breakdown[0].id, 'meta', 'meta first');
assertEq(breakdown[0].spend, 100000, 'meta spend');
assertEq(breakdown[0].percent, 100, 'meta 100%');
assertEq(breakdown[0].leads, 1, 'meta leads');
assertEq(breakdown[0].color, '#17692f', 'meta color');
assertEq(breakdown[1].id, 'zalo', 'zalo second');
assertEq(breakdown[1].spend, 0, 'zalo zero spend');
assertEq(breakdown[1].percent, 0, 'zalo 0%');
assertEq(breakdown[1].leads, 1, 'zalo leads');
assertEq(breakdown[1].color, '#0d9488', 'zalo color');

const gapRatio = 0.04;
const gapArcs = donut.donutArcs([
  { id: 'a', label: 'A', value: 1, color: '#111' },
  { id: 'b', label: 'B', value: 1, color: '#222' },
], 50, gapRatio);
const gap = Math.min(circ * gapRatio, (circ / 2) * 0.3);
const rawHalf = circ / 2;
const drawn = rawHalf - gap;
assertEq(gapArcs.length, 2, 'gapped arcs');
assertClose(Number(gapArcs[0].dasharray.split(' ')[0]), drawn, 8, 'gapped length');
assertClose(drawn * 2 + gap * 2, circ, 8, 'gaps + drawn fill circle');

assertEq(conv.previousEqualWindow('2026-11-07', '2026-11-13'), { from: '2026-10-31', to: '2026-11-06' }, 'prev 7d');
assertEq(conv.previousEqualWindow('2026-11-13', '2026-11-13'), { from: '2026-11-12', to: '2026-11-12' }, 'prev today');
assertEq(conv.previousEqualWindow('2026-11-13', '2026-11-07'), null, 'inverted window');
assertClose(conv.periodDeltaPct(110, 100), 10, 8, 'delta +10');
assertClose(conv.periodDeltaPct(80, 100), -20, 8, 'delta -20');
assertEq(conv.periodDeltaPct(100, 0), null, 'delta hide zero prev');
assertEq(conv.periodDeltaPct(100, null), null, 'delta hide null prev');
assertEq(conv.fmtCompactVnd(16825000), '16,8tr', '16,8tr');
assertEq(conv.fmtCompactVnd(5476000), '5,5tr', '5,5tr');
assertEq(conv.fmtCompactVnd(956000), '956k', '956k');
assertEq(conv.fmtCompactVnd(2000000), '2tr', '2tr');

if (failures.length) {
  console.error("FAILED " + failures.length + " / " + (passed + failures.length));
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log("passed " + passed + " assertions (Node " + process.version + ", vitest skipped)");
