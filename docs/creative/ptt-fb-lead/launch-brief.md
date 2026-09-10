# Launch brief — PTT FB Lead audit

## Instant Form

- Name: `PTT Audit CPL 2026-09`
- Headline: `Nhận audit CPL + creative — 15 phút`
- Privacy: on
- Thank-you: `AM PTT liên hệ trong giờ hành chính.`
- CTA on ad: `Đăng ký` or `Tìm hiểu thêm` (never `Gọi ngay`)
- Optimization: Lead / Instant Form. Phone on video is not the event.
- form_id: PENDING

### Fields (key = Graph name)

| Key | Type | Required | Values |
|---|---|---|---|
| full_name | short | yes | |
| phone_number | phone | yes | |
| company_name | short | yes | |
| ad_budget_band | dropdown | yes | `<20tr` · `20-50` · `50-100` · `>100` |
| ad_channels | dropdown | yes | `meta` · `tiktok` · `google` · `none` |

Labels VI on the form; **keys must match the table** (no `20–50` en-dash).

## Ads

Campaign: `PTT | Lead | Audit15 | 2026-09`
Template: `re_lead_default`
Ad sets (60/25/15): `AS | H1 pain`, `AS | H2 agency`, `AS | H3 face`
Ads: `AD | H1 15`, `AD | H2 15`, `AD | H3 15`
H1-30 ad set **paused**: `AS | H1 30 scale`
Primary texts: vo-scripts.md
