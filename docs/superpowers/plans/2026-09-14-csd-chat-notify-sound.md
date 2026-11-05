# CSD Chat Notification + Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the CRM tab is still open (hidden or another tab focused), staff get OS Notification + sound for new CSD chat messages and incoming voice/video calls.

**Architecture:** Extend existing client-side notify path (`CsdChatNotifyHost` + `Notification` API) with a small sound helper; wire incoming Stringee calls in `useCsdChatCall` to the same notify/sound channel. No Web Push / no server changes for MVP.

**Tech Stack:** Next.js ops-web, Web Audio API, Browser Notification API, existing Stringee presence (`useCsdChatCall`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-csd-chat-notify-sound-design.md`

## Global Constraints

- Scope = tab still alive only (minimize / other tab OK; closed browser out of scope)
- Reuse `showCsdChatDesktopNotify` / `requestCsdChatNotifyPermission` patterns
- Do not add VAPID / push subscribe for this plan
- Prefer Web Audio tones over binary asset files unless a short public-domain mp3 already exists in repo
- TDD for pure helpers; thin wiring in React hooks/components
- Vietnamese UI copy for notifications

## File map

| File | Responsibility |
|------|----------------|
| `services/ops-web/src/lib/crm/csd-chat-notify-sound.util.ts` | Play message ting / start-stop call ring (Web Audio) |
| `services/ops-web/src/lib/crm/csd-chat-notify-sound.util.spec.ts` | Unit tests (mock AudioContext) |
| `services/ops-web/src/lib/crm/csd-chat-notify-persist.ts` | Extend desktop notify (optional `silent`, `requireInteraction`, tag helpers for calls) |
| `services/ops-web/src/lib/crm/csd-chat-notify.ts` | Keep channel selection; add helper for call notify payload if needed |
| `services/ops-web/src/components/crm/csd/CsdChatNotifyHost.tsx` | Play ting when toast/desktop fires for messages |
| `services/ops-web/src/components/crm/csd/useCsdChatCall.ts` | On incoming → Notification + call ring; stop on answer/reject/hangup/ended |
| `services/ops-web/src/lib/crm/csd-chat-call-ringback.util.ts` | Optionally share cadence with incoming ring OR leave outbound-only and duplicate thin wrapper in notify-sound |
| `docs/superpowers/specs/2026-09-14-csd-chat-notify-sound-design.md` | Spec (already written) |

---

### Task 1: Sound helper (message ting + call ring)

**Files:**
- Create: `services/ops-web/src/lib/crm/csd-chat-notify-sound.util.ts`
- Create: `services/ops-web/src/lib/crm/csd-chat-notify-sound.util.spec.ts`

**Interfaces:**
- Produces:
  - `playCsdChatMessageTone(): void`
  - `startCsdChatIncomingCallRing(): { stop: () => void }`
  - `stopCsdChatIncomingCallRing(): void` (idempotent global stop if one active ring)

**Notes:** Reuse cadence ideas from `csd-chat-call-ringback.util.ts` (outbound). Incoming ring can call into a shared internal oscillator helper to avoid drift. Guard `typeof window` / missing `AudioContext`.

- [ ] **Step 1: Write failing tests** for “message tone creates AudioContext path” and “incoming ring stop is idempotent” (mock `AudioContext` on `globalThis`).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-notify-sound.util.spec.ts
```

- [ ] **Step 3: Implement util**

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/csd-chat-notify-sound.util.ts \
  services/ops-web/src/lib/crm/csd-chat-notify-sound.util.spec.ts
git commit -m "feat(csd): add chat message tone and incoming call ring helpers."
```

---

### Task 2: Desktop notify helpers for calls + sound hooks for messages

**Status:** ✅ Done in `43677b0c` (bundled with Task 1+3 deploy)

**Files:**
- Modify: `services/ops-web/src/lib/crm/csd-chat-notify-persist.ts`
- Modify: `services/ops-web/src/lib/crm/csd-chat-notify.ts` (if adding `csdChatCallNotifyTag` / payload builder)
- Modify: `services/ops-web/src/lib/crm/csd-chat-notify.spec.ts`
- Modify: `services/ops-web/src/components/crm/csd/CsdChatNotifyHost.tsx`

**Interfaces:**
- Consumes: `playCsdChatMessageTone`
- Produces:
  - `showCsdChatDesktopNotify({ ..., kind?: 'message' | 'call', requireInteraction?: boolean })`
  - Tag: `csd-chat:${conversationId}` (message), `csd-call:${fromUserId}` (call)
  - Host plays `playCsdChatMessageTone()` once per incoming batch when channel is `toast` or `desktop`

- [x] **Step 1: Extend unit tests** in `csd-chat-notify.spec.ts` for channel behavior unchanged; add test for tag helper if extracted.

- [x] **Step 2: Implement persist/notify helpers + wire Host to play ting** when `next.incoming.length > 0` and channel ≠ `none`.

- [x] **Step 3: Run**

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-notify.spec.ts src/lib/crm/csd-chat-notify-sound.util.spec.ts
```

- [x] **Step 4: Commit** (included in `43677b0c feat(csd): notify + sound for chat messages and incoming calls.`)

---

### Task 3: Incoming call → Notification + looping ring

**Files:**
- Modify: `services/ops-web/src/components/crm/csd/useCsdChatCall.ts`
- Modify: `services/ops-web/src/lib/crm/csd-chat-call.util.ts` (only if exporting a small `notifyIncomingCall` helper for testability)
- Optional test: `services/ops-web/src/lib/crm/csd-chat-call-notify.util.spec.ts` for pure “should notify” predicates

**Interfaces:**
- Consumes: `showCsdChatDesktopNotify`, `startCsdChatIncomingCallRing`, `stopCsdChatIncomingCallRing`, `requestCsdChatNotifyPermission` (best-effort if still `default`)
- Behavior:
  - On `onIncoming`: if `Notification.permission === 'granted'` (or after request), show call notification with `requireInteraction: true`; start incoming ring
  - On `answerIncoming` / `rejectIncoming` / `hangup` / phase `ended`: `stop` ring + close notification via tag if possible
  - Click notification: `window.focus()` + leave call bar as-is (already set state `incoming`)

- [ ] **Step 1: Write a small pure helper test** e.g. `shouldPlayIncomingCallAlerts(permission, busy)` if extracting; else document manual UAT in commit body.

- [ ] **Step 2: Wire `useCsdChatCall`**

- [ ] **Step 3: Manual smoke checklist (local)**
  1. Two browsers, both CRM logged into CSD chat
  2. Callee switches to vnexpress or minimizes
  3. Caller starts voice call → callee hears ring + OS notification
  4. Click notification → CRM focuses with Answer/Reject
  5. Reject → ring stops
  6. Send DM while callee on other tab → notification + ting (within poll ≤15s)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(csd): desktop notify and ring on incoming chat calls."
```

---

### Task 4: Deploy + verify on VPS

**Files:**
- Use: `scripts/deploy_csd_vps.sh`

- [ ] **Step 1: Push commits to `main`** (only if user requested deploy/push)

- [ ] **Step 2: Deploy**

```bash
APPLY=1 ./scripts/deploy_csd_vps.sh
```

- [ ] **Step 3: Ensure services active** (HUP/restart if sudo skipped)

- [ ] **Step 4: UAT on https://rs.pttads.vn** with two staff accounts

---

## Manual UAT matrix

| # | Action | Expect |
|---|--------|--------|
| 1 | CRM visible, new message other thread | Toast + ting |
| 2 | CRM tab hidden, new message | OS Notification + ting |
| 3 | CRM minimized, incoming voice | OS Notification + looping ring |
| 4 | Answer call | Ring stops; media works |
| 5 | Reject call | Ring stops; notify closes |
| 6 | Notification permission denied | Call bar still works when focused; no OS notify (acceptable) |

## Out of scope reminders

- Service worker push when browser quit
- Changing message poll from 15s (optional follow-up: shorten when dock open)
