# Task 18: Portal min + expire (PUB-01…03)

**Status:** GREEN  
**Branch:** `feat/quotation-os`  
**Commit:** `feat(qt): public proposal page and checkbox accept`

## Requirements

- `@Controller('api/public/proposals')` — no staff guard
- W1 token: 32-byte random, store sha256 in `crm_quote_shares.token_hash`
- Staff mint helper + `POST /api/crm/proposals/:id/share` (write guard)
- `GET /api/public/proposals/:token` — public JSON via `stripPublicQuote` (no `cost`, `margin`, `gm_bps`, `nsr`, cost_*, approval internals)
- Expired (`valid_until` or `expires_at`) or `revoked_at` → **410**, body without investment
- `POST /api/public/proposals/:token/accept` — checkbox + name/email, status `accepted`, `option_key` `A`, no OTP, no convert
- Portal `/proposals/[token]` Vietnamese, CTA **Xác nhận đề xuất**
- Money BIGINT / empty `—`. No fake 0. No `265.647.600` in UI

## TDD

### RED

Wrote specs first. First run (no production files):

```
TS2307: Cannot find module './quote-public-strip.util'
TS2307: Cannot find module './quote-public.service'
TS2307: Cannot find module './quote-share.util'
```

### GREEN

```
cd services/ptt-crm-api && ./node_modules/.bin/jest --verbose src/proposals
```

**22 suites, 148 tests passed** (6 new).

```
cd services/portal-web && npx --yes vitest@2 run src/lib/public-proposal.spec.ts
```

**3 passed / 1 file.**

| Spec | Result |
|---|---|
| `stripPublicQuote` drops cost/margin/gm_bps/nsr + cost_* / approval | pass |
| GET public JSON excludes those keys; CTA `Xác nhận đề xuất` | pass |
| expired / revoked → 410 without `investment` | pass |
| accept locks `accepted` + option `A`; no lifecycle/convert | pass |
| accept expired → 410 without `investment` | pass |
| public controller has no staff guard | pass |
| portal CTA / `—` money / 410 helper | pass |

## Implementation

**New (API)**

- `quote-public-strip.util.ts` + spec
- `quote-share.util.ts` — 32-byte token, sha256 hex
- `quote-public.service.ts` + spec — mint / GET / accept
- `quote-public.controller.ts` — `GET :token`, `POST :token/accept`
- `quote-share.controller.ts` — `POST /api/crm/proposals/:id/share`

**New (portal)**

- `src/lib/public-proposal.ts` + spec
- `src/components/PublicProposalView.tsx`
- `src/app/proposals/[token]/page.tsx`

**Modified**

- `proposals.module.ts` — register public + share controllers / service

Public accept writes `crm_proposals.status = accepted`, version snapshot `accepted_option_key: A`, line `option_key = A`, audit `public.accept`. It does **not** call `QuoteConvertService`.

## Concerns

- No public rate-limit (same as deal-teaser token). Task 26 can add OTP + tighter limits.
- `crm_quote_shares` is assumed from Task 1 DDL; proposals-pg bootstrap does not CREATE it.
- Staff `PATCH` accepted still auto-converts (Task 10). Only the public POST is lock-only.
- 410 body may include `quote_code` for AM contact; never `investment`.
- Portal page not browser-verified (no live public token in this session).
