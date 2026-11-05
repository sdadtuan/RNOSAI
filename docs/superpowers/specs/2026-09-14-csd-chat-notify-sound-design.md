# CSD Chat — Browser Notification + Sound (tab còn sống)

> **Ngày:** 2026-09-14  
> **Trạng thái:** Approved scope — Approach 1  
> **Phạm vi:** Tab `rs.pttads.vn` vẫn mở (ẩn cửa sổ hoặc đang xem tab khác). **Không** Web Push khi tắt trình duyệt.

## Goal

Khi có **tin nhắn mới** hoặc **cuộc gọi thoại/video đến**, staff vẫn nhận được **Notification hệ thống + âm thanh**, miễn là tab CRM còn mở (kể cả minimize / đang xem vnexpress).

## Non-goals

- Web Push / FCM khi đóng hết tab hoặc tắt trình duyệt
- Native mobile app
- Thay đổi backend CPaaS / Stringee config

## Current baseline

- `CsdChatNotifyHost`: poll unread → toast (tab visible) hoặc `Notification` (tab hidden); **không có sound**
- `useCsdChatCall`: Stringee presence + incoming UI; **không bắn Notification / chuông incoming**
- `requestCsdChatNotifyPermission` khi mở dock Chat

## Behavior

| Event | Tab CRM visible | Tab CRM hidden / window minimized |
|-------|-----------------|-----------------------------------|
| Tin nhắn mới (không đang xem hội thoại đó) | In-app toast + ting | Desktop Notification + ting |
| Cuộc gọi đến (voice/video) | Call bar + chuông lặp | Notification “Cuộc gọi đến” + chuông lặp + call bar khi focus lại |
| Trả lời / từ chối / kết thúc gọi | Dừng chuông, đóng notify call | Same |

Click notification → `window.focus()` + mở hội thoại / đảm bảo dock hiện call bar.

## Sound policy

- **Message:** one-shot short tone (Web Audio), không lặp
- **Incoming call:** looping ring cadence (reuse/adapt `startLocalRingback` pattern), stop on answer/reject/hangup/ended
- Respect OS mute; optional later: localStorage mute toggle (out of MVP unless trivial)

## Permission

- Continue requesting Notification on dock open
- Sounds may be blocked until user gesture — opening dock / allowing notify counts as gesture path

## Success criteria

1. Minimize CRM or switch to another tab → new DM shows OS notification + ting within ~poll interval (messages) or immediately (calls via Stringee)
2. Incoming call while on another tab → OS notification + repeating ring; click focuses CRM
3. Answer/reject stops ring
4. No Web Push infra added
