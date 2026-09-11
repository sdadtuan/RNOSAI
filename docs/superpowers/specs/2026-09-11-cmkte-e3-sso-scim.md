# CMKT E3 — SSO / SCIM follows existing staff identity

**Date:** 2026-09-11  
**Wave:** Content Marketing OS E3  
**Status:** Documented hook only — no new IdP, no SCIM server

## Decision

Content OS does **not** build an identity provider, SAML/OIDC broker, or SCIM provisioning API. Enterprise identity for staff already exists on the platform. CMKT Settings only exposes a read-only policy flag.

## Identity hook (existing Staff SSO)

Use the Staff SSO path already in the product:

| Surface | Location |
|---|---|
| Keycloak staff realm / OIDC | `docs/runbooks/keycloak-staff-auth.md` · env `PTT_STAFF_KEYCLOAK_ISSUER`, `PTT_STAFF_KEYCLOAK_AUDIENCE`, `STAFF_AUTH_MODE` |
| Staff login + token exchange | `services/ptt-crm-api/src/staff-auth/` · ops-web `/login/callback` |
| Admin group → cap map | `/admin/crm/sso/groups` (WIN-4; `NEXT_PUBLIC_WIN_SSO`) |
| Config probe | `AppConfigService.staffSsoConfigured()` — true only when `PTT_STAFF_KEYCLOAK_ISSUER` is set |
| Health | `staff_sso_configured` on the API health payload |

Content OS workspace access stays on existing staff JWT + `crm_content.*` caps. Do not invent a CMKT-only IdP or a second login.

## Settings flag `sso_enforced`

- Key: `sso_enforced`
- **Read-only in E3.** Not stored in `cmkt_settings`. PATCH must not persist it.
- **False if no IdP is configured.** E3 Content OS also does not flip this flag on just because Staff SSO exists — enforcement stays on the staff auth layer (`STAFF_AUTH_MODE=keycloak` when IT cuts over).
- Governance Settings shows a disabled switch. Admins open Staff SSO admin; they do not toggle a CMKT IdP here.

`GET/PATCH /api/crm/content-os/portfolio/settings` always includes `sso_enforced` next to `direct_social_publish`. Missing payload / no IdP → `false`.

## SCIM

Out of scope for E3 code. SCIM provisioning and deprovisioning, if needed later, **follow the same staff identity** (Keycloak / HR staff records) — not a Content OS user directory. No `/scim/v2` routes, no CMKT user store.

## Out of scope

- New IdP or SCIM server
- Facebook / social identity
- Changing staff login, Keycloak realm, or WIN-4 group maps
- Enabling `CP_AI_ENABLED` or rewriting E0 DDL
