#!/usr/bin/env python3
"""Idempotent LOCAL-ONLY demo seed for PORTAL_DEMO (prefix qa4-local-demo).

Re-runnable: deletes prior qa4-local-demo rows then re-inserts. Does not
touch the two existing non-qa4 synthetic messages (mess:qa-local-page:qa-psid-a/b).
Writes no tokens and makes no Meta/Zalo/Google API calls. Never prints
DATABASE_URL or secrets.

Fills Portal pages so every sidebar screen looks populated:
  - 2 Fanpages (PTT Demo Shop keeps page_id qa-local-page, PTT Demo Spa) + 1 Zalo OA
  - A Meta ad account page (channel=ad_account, digits only, no token) so
    /client/meta "Báo cáo Meta Ads" is no longer empty
  - Inbox threads (customer + page replies, Vietnamese) over 30 days
  - Customers, per-page catalog, POS orders/shipping, posts/comments
  - Campaign / adset / ad / account insights + Meta breakdowns, coherent
    with dashboard daily_performance (dashboard sums insight_level=campaign only)
"""
from __future__ import annotations

import json
import math
import random
import sys
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values, Json

CLIENT_ID = "550e8400-e29b-41d4-a716-446655440000"
PREFIX = "qa4-local-demo"
TZ = timezone(timedelta(hours=7))  # Asia/Saigon, no DST
TODAY = date(2026, 11, 13)
START = date(2026, 10, 15)
RNG = random.Random(20261113)
# Separate stream so inbox copy / ads splits do not shift lead assignment RNG.
EXTRA_RNG = random.Random(20261114)

# Keep qa-local-page id (referenced by existing QA scripts). Rename the label.
SHOP = {"page_id": "qa-local-page", "page_name": "PTT Demo Shop", "channel": "facebook"}
SPA = {"page_id": f"{PREFIX}-page-spa", "page_name": "PTT Demo Spa", "channel": "facebook"}
ZALO_OA = {"page_id": f"{PREFIX}-page-zalo", "page_name": "PTT Demo Zalo OA", "channel": "zalo"}
FANPAGES = [SHOP, SPA, ZALO_OA]
# Meta insights looks up portal_client_pages.channel='ad_account' and matches
# daily_performance.external_account_id with the act_ prefix stripped.
META_AD_ACCOUNT_ID = "5550001111"
META_AD_ACCOUNT_NAME = "PTT Demo Meta Ads"

STAFF = [
    ("166c0585-1da3-4d82-8b4f-7beccf28fa72", "qa2-staff-a", 0.42),
    ("6576ed02-27f4-4214-83ff-3699ca8c28c3", "qa2-staff-b", 0.33),
    ("fb4f1594-017f-407d-ac17-8f05f20c932c", "qa3-staff-notify", 0.25),
]
STAFF_EMAIL = {
    "166c0585-1da3-4d82-8b4f-7beccf28fa72": "qa2-staff-a@demo.local",
    "6576ed02-27f4-4214-83ff-3699ca8c28c3": "qa2-staff-b@demo.local",
    "fb4f1594-017f-407d-ac17-8f05f20c932c": "qa3-staff-notify@demo.local",
}
APPROVER_ID = "8ed79f3d-c6b8-4a09-871d-f724d890d55c"

# (channel, external_id, display name, daily spend share within channel)
CAMPAIGNS = [
    ("meta", f"{PREFIX}-camp-meta-inbox", "PTT Shop Inbox", 0.50),
    ("meta", f"{PREFIX}-camp-meta-form", "PTT Spa Form", 0.30),
    ("meta", f"{PREFIX}-camp-meta-retarget", "PTT Shop Remarketing", 0.20),
    ("zalo", f"{PREFIX}-camp-zalo-oa", "PTT Zalo OA", 0.65),
    ("zalo", f"{PREFIX}-camp-zalo-click", "PTT Zalo Click", 0.35),
]

ACCOUNTS = {
    "meta": (META_AD_ACCOUNT_ID, META_AD_ACCOUNT_NAME),
    "zalo": (f"{PREFIX}-zalo", "PTT Demo Zalo Ads"),
}

FORMS = [
    (f"{PREFIX}-form-tuvan", "Form tư vấn"),
    (f"{PREFIX}-form-baogia", "Form báo giá"),
    (f"{PREFIX}-form-dangky", "Form đăng ký"),
]
CARE_TAGS = ["Cần gọi", "Đã gửi SP", "Hẹn mua", "Quan tâm"]

# New cases only (existing 2 messages today are left untouched).
# messages: 190 new (~30% converted = 58); leads: 80 (~25% converted = 20).
MSG_PLAN = {
    "today": (10, 3),
    "last6": (40, 13),
    "month": (45, 13),
    "earlier": (95, 29),
}
LEAD_PLAN = {
    "today": (5, 1),
    "last6": (15, 4),
    "month": (18, 5),
    "earlier": (42, 10),
}

CUSTOMER_NAMES = [
    "Nguyễn Minh Anh", "Trần Thị Hoa", "Lê Văn Nam", "Phạm Thu Hà", "Hoàng Đức Minh",
    "Võ Ngọc Lan", "Đặng Quốc Huy", "Bùi Thanh Tâm", "Phan Hải Yến", "Đỗ Gia Bảo",
    "Ngô Thị Mai", "Lý Hoàng Long", "Trịnh Khánh Linh", "Hồ Quốc Việt", "Đinh Thu Trang",
    "Mai Anh Tuấn", "Tạ Ngọc Bích", "Lương Minh Khang", "Châu Thanh Vy", "Vũ Hải Đăng",
    "Nguyễn Thị Phương", "Phan Văn Khoa", "Trần Mỹ Duyên", "Lê Hoàng Phúc", "Đỗ Thanh Ngân",
    "Bùi Đức Anh", "Phạm Ngọc Hân", "Hoàng Thị Lan", "Võ Minh Quân", "Nguyễn Nhật Hà",
]

KEEP_THREADS = ("mess:qa-local-page:qa-psid-a", "mess:qa-local-page:qa-psid-b")

# Adset / ad trees (ids stay prefixed; names are what the Meta report shows).
META_ADSETS = {
    f"{PREFIX}-camp-meta-inbox": [
        (f"{PREFIX}-adset-inbox-chat", "Tin nhắn Shop"),
        (f"{PREFIX}-adset-inbox-care", "Tin nhắn CSKH"),
    ],
    f"{PREFIX}-camp-meta-form": [
        (f"{PREFIX}-adset-form-tuvan", "Form tư vấn Spa"),
        (f"{PREFIX}-adset-form-baogia", "Form báo giá Spa"),
    ],
    f"{PREFIX}-camp-meta-retarget": [
        (f"{PREFIX}-adset-retarget-web", "Remarketing web"),
        (f"{PREFIX}-adset-retarget-eng", "Remarketing tương tác"),
    ],
}
META_ADS = {
    f"{PREFIX}-adset-inbox-chat": [(f"{PREFIX}-ad-inbox-a", "Creative Inbox A"), (f"{PREFIX}-ad-inbox-b", "Creative Inbox B")],
    f"{PREFIX}-adset-inbox-care": [(f"{PREFIX}-ad-care-a", "Creative CSKH A"), (f"{PREFIX}-ad-care-b", "Creative CSKH B")],
    f"{PREFIX}-adset-form-tuvan": [(f"{PREFIX}-ad-form-a", "Creative Form tư vấn"), (f"{PREFIX}-ad-form-b", "Creative Form video")],
    f"{PREFIX}-adset-form-baogia": [(f"{PREFIX}-ad-price-a", "Creative Báo giá ảnh"), (f"{PREFIX}-ad-price-b", "Creative Báo giá carousel")],
    f"{PREFIX}-adset-retarget-web": [(f"{PREFIX}-ad-web-a", "Retargeting catalog"), (f"{PREFIX}-ad-web-b", "Retargeting offer")],
    f"{PREFIX}-adset-retarget-eng": [(f"{PREFIX}-ad-eng-a", "Engagement story"), (f"{PREFIX}-ad-eng-b", "Engagement reel")],
}
ZALO_ADSETS = {
    f"{PREFIX}-camp-zalo-oa": [
        (f"{PREFIX}-adset-zalo-oa-msg", "Zalo tin nhắn OA"),
        (f"{PREFIX}-adset-zalo-oa-form", "Zalo form OA"),
    ],
    f"{PREFIX}-camp-zalo-click": [
        (f"{PREFIX}-adset-zalo-click-feed", "Zalo click bảng tin"),
        (f"{PREFIX}-adset-zalo-click-article", "Zalo click bài viết"),
    ],
}
ZALO_ADS = {
    f"{PREFIX}-adset-zalo-oa-msg": [(f"{PREFIX}-ad-zalo-msg-a", "OA Message A"), (f"{PREFIX}-ad-zalo-msg-b", "OA Message B")],
    f"{PREFIX}-adset-zalo-oa-form": [(f"{PREFIX}-ad-zalo-form-a", "OA Form A"), (f"{PREFIX}-ad-zalo-form-b", "OA Form B")],
    f"{PREFIX}-adset-zalo-click-feed": [(f"{PREFIX}-ad-zalo-feed-a", "Zalo Feed A"), (f"{PREFIX}-ad-zalo-feed-b", "Zalo Feed B")],
    f"{PREFIX}-adset-zalo-click-article": [(f"{PREFIX}-ad-zalo-art-a", "Zalo Article A"), (f"{PREFIX}-ad-zalo-art-b", "Zalo Article B")],
}

BREAKDOWNS = {
    "gender": [("female", 0.62), ("male", 0.35), ("unknown", 0.03)],
    "age": [("18-24", 0.18), ("25-34", 0.42), ("35-44", 0.25), ("45-54", 0.10), ("55-64", 0.05)],
    "publisher_platform": [("facebook", 0.70), ("instagram", 0.25), ("audience_network", 0.05)],
    "platform_position": [("feed", 0.55), ("stories", 0.25), ("reels", 0.20)],
    "region": [("Hồ Chí Minh", 0.40), ("Hà Nội", 0.28), ("Đà Nẵng", 0.12), ("Khác", 0.20)],
}


def load_database_url() -> str:
    envp = Path(__file__).resolve().parents[1] / ".env"
    if not envp.is_file():
        raise SystemExit(f"missing env file at {envp}")
    for line in envp.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or not raw.startswith("DATABASE_URL="):
            continue
        value = raw.split("=", 1)[1].strip().strip('"').strip("'")
        if not value:
            raise SystemExit("DATABASE_URL is empty")
        return value
    raise SystemExit("DATABASE_URL not found")


def daterange(start: date, end: date) -> list[date]:
    days = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def bucket_of(d: date) -> str:
    if d == TODAY:
        return "today"
    if date(2026, 11, 7) <= d <= date(2026, 11, 12):
        return "last6"
    if date(2026, 11, 1) <= d <= date(2026, 11, 6):
        return "month"
    if START <= d <= date(2026, 10, 31):
        return "earlier"
    raise ValueError(d)


def distribute_counts(dates: list[date], total: int, weekend_weight: float = 0.62) -> dict[date, int]:
    """Spread `total` items across dates with a weekend dip; exact sum."""
    weights = []
    for d in dates:
        base = weekend_weight if d.weekday() >= 5 else 1.0
        weights.append(base * RNG.uniform(0.82, 1.18))
    scale = total / sum(weights)
    raw = [w * scale for w in weights]
    counts = [int(math.floor(x)) for x in raw]
    leftover = total - sum(counts)
    order = sorted(
        range(len(dates)),
        key=lambda i: (raw[i] - counts[i], dates[i].weekday() < 5),
        reverse=True,
    )
    for i in order[:leftover]:
        counts[i] += 1
    return dict(zip(dates, counts))


def pick_staff() -> tuple[str, datetime] | tuple[None, None]:
    if RNG.random() > 0.72:
        return None, None
    roll = RNG.random()
    acc = 0.0
    chosen = STAFF[-1][0]
    for sid, _name, share in STAFF:
        acc += share
        if roll <= acc:
            chosen = sid
            break
    return chosen, None


NOW = datetime.now(TZ)


def set_now() -> None:
    """Capture clock at seed start so no demo timestamp is later than now()."""
    global NOW
    NOW = datetime.now(TZ)


def clamp_now(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt if dt <= NOW else NOW


def saigon_at(d: date, hour: int | None = None, minute: int | None = None) -> datetime:
    if d > NOW.date():
        d = NOW.date()
    if d == NOW.date() and NOW.hour < 8 and hour is None:
        return clamp_now(NOW - timedelta(minutes=RNG.randint(1, 20))) or NOW
    if hour is None:
        hour = RNG.randint(8, 20) if d < NOW.date() else RNG.randint(8, max(8, NOW.hour))
    if minute is None:
        if d == NOW.date() and hour == NOW.hour:
            minute = RNG.randint(0, max(0, NOW.minute))
        else:
            minute = RNG.randint(0, 59)
    if d == NOW.date() and hour == NOW.hour and minute == NOW.minute:
        s = RNG.randint(0, max(0, NOW.second))
    else:
        s = RNG.randint(0, 59)
    dt = datetime.combine(d, time(min(hour, 23), min(minute, 59), s), tzinfo=TZ)
    return clamp_now(dt) or NOW


def fmt_vnd(n: float | Decimal | int) -> str:
    return f"{int(round(n)):,} ₫".replace(",", ".")


def page_for_item(item: dict) -> dict:
    if item["channel"] == "zalo":
        return ZALO_OA
    # Deterministic 3/5 Shop, 2/5 Spa among Facebook cases (no RNG).
    return SPA if item["seq"] % 5 in (3, 4) else SHOP


def customer_name(seq: int) -> str:
    return CUSTOMER_NAMES[(seq - 1) % len(CUSTOMER_NAMES)]


def split_parts(total: int, shares: list[float]) -> list[int]:
    raw = [total * s for s in shares]
    parts = [int(round(x / 1000.0) * 1000) for x in raw]
    drift = total - sum(parts)
    parts[0] += drift
    if parts[0] < 0:
        parts[0] = 0
    return parts


def split_int(total: int, shares: list[float]) -> list[int]:
    if total <= 0:
        return [0] * len(shares)
    raw = [total * s for s in shares]
    parts = [int(math.floor(x)) for x in raw]
    leftover = total - sum(parts)
    order = sorted(range(len(shares)), key=lambda i: raw[i] - parts[i], reverse=True)
    for i in order[:leftover]:
        parts[i] += 1
    return parts


def delete_prior(cur) -> None:
    # Order respects FKs. Never delete the two non-qa4 synthetic threads.
    cur.execute(
        """
        DELETE FROM daily_performance_breakdown
        WHERE client_id = %s AND (
          external_campaign_id LIKE %s
          OR external_account_id LIKE %s
          OR regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = %s
        )
        """,
        (CLIENT_ID, PREFIX + "%", PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    n_bd = cur.rowcount
    cur.execute(
        """
        DELETE FROM daily_performance
        WHERE client_id = %s AND (
          external_campaign_id LIKE %s
          OR external_account_id LIKE %s
          OR regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = %s
        )
        """,
        (CLIENT_ID, PREFIX + "%", PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    n_perf = cur.rowcount
    cur.execute(
        "DELETE FROM meta_ad_account_sync_state WHERE client_id = %s AND regexp_replace(external_account_id, '^act_', '', 'i') = %s",
        (CLIENT_ID, META_AD_ACCOUNT_ID),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_shipments
        WHERE client_id = %s AND order_id IN (
          SELECT id FROM portal_pos_orders
          WHERE client_id = %s AND (code LIKE %s OR notes = 'qa4-local-demo seed')
        )
        """,
        (CLIENT_ID, CLIENT_ID, "DH-QA4-%"),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_order_events
        WHERE order_id IN (
          SELECT id FROM portal_pos_orders
          WHERE client_id = %s AND (code LIKE %s OR notes = 'qa4-local-demo seed')
        )
        """,
        (CLIENT_ID, "DH-QA4-%"),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_order_items
        WHERE order_id IN (
          SELECT id FROM portal_pos_orders
          WHERE client_id = %s AND (code LIKE %s OR notes = 'qa4-local-demo seed')
        )
        """,
        (CLIENT_ID, "DH-QA4-%"),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_orders
        WHERE client_id = %s AND (code LIKE %s OR notes = 'qa4-local-demo seed')
        """,
        (CLIENT_ID, "DH-QA4-%"),
    )
    n_ord = cur.rowcount
    cur.execute(
        "DELETE FROM portal_pos_customers WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
        (CLIENT_ID,),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_stock_ledger
        WHERE variant_id IN (
          SELECT v.id FROM portal_pos_variants v
          JOIN portal_page_products p ON p.id = v.product_id
          WHERE p.client_id = %s AND p.sku LIKE %s
        )
        """,
        (CLIENT_ID, PREFIX + "%"),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_stock
        WHERE variant_id IN (
          SELECT v.id FROM portal_pos_variants v
          JOIN portal_page_products p ON p.id = v.product_id
          WHERE p.client_id = %s AND p.sku LIKE %s
        )
        """,
        (CLIENT_ID, PREFIX + "%"),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_combo_items
        WHERE combo_product_id IN (
          SELECT id FROM portal_page_products WHERE client_id = %s AND sku LIKE %s
        )
        """,
        (CLIENT_ID, PREFIX + "%"),
    )
    cur.execute(
        """
        DELETE FROM portal_pos_variants
        WHERE product_id IN (
          SELECT id FROM portal_page_products WHERE client_id = %s AND sku LIKE %s
        )
        """,
        (CLIENT_ID, PREFIX + "%"),
    )
    cur.execute(
        "DELETE FROM portal_page_products WHERE client_id = %s AND sku LIKE %s",
        (CLIENT_ID, PREFIX + "%"),
    )
    n_prod = cur.rowcount
    cur.execute(
        "DELETE FROM portal_pos_categories WHERE client_id = %s AND name LIKE %s",
        (CLIENT_ID, "PTT Demo%"),
    )
    cur.execute(
        "DELETE FROM portal_pos_warehouses WHERE client_id = %s AND name LIKE %s",
        (CLIENT_ID, "PTT Demo%"),
    )
    cur.execute(
        "DELETE FROM portal_pos_carrier_accounts WHERE client_id = %s AND label LIKE %s",
        (CLIENT_ID, "PTT Demo%"),
    )
    n_car = cur.rowcount
    cur.execute(
        "DELETE FROM portal_page_comments WHERE client_id = %s AND comment_id LIKE %s",
        (CLIENT_ID, PREFIX + "%"),
    )
    n_cmt = cur.rowcount
    cur.execute(
        "DELETE FROM portal_fb_posts WHERE client_id = %s AND post_id LIKE %s",
        (CLIENT_ID, PREFIX + "%"),
    )
    cur.execute(
        "DELETE FROM portal_page_posts WHERE client_id = %s AND body LIKE %s",
        (CLIENT_ID, "[qa4-local-demo]%"),
    )
    cur.execute(
        "DELETE FROM portal_page_messages WHERE client_id = %s AND external_message_id LIKE %s",
        (CLIENT_ID, PREFIX + "%"),
    )
    n_msg = cur.rowcount
    cur.execute(
        """
        DELETE FROM portal_customers
        WHERE client_id = %s AND (
          thread_key LIKE %s
          OR case_id IN (
            SELECT id FROM portal_care_cases
            WHERE client_id = %s
              AND notes = 'qa4-local-demo seed'
              AND thread_key <> ALL(%s)
          )
        )
        """,
        (CLIENT_ID, PREFIX + "%", CLIENT_ID, list(KEEP_THREADS)),
    )
    n_cust = cur.rowcount
    cur.execute(
        """
        DELETE FROM portal_care_cases
        WHERE client_id = %s
          AND notes = 'qa4-local-demo seed'
          AND thread_key <> ALL(%s)
        """,
        (CLIENT_ID, list(KEEP_THREADS)),
    )
    n_cases = cur.rowcount
    cur.execute(
        """
        DELETE FROM portal_page_leads
        WHERE client_id = %s AND (external_lead_id LIKE %s OR campaign_id LIKE %s OR full_name LIKE %s)
        """,
        (CLIENT_ID, PREFIX + "%", PREFIX + "%", "QA4 Demo Lead%"),
    )
    n_leads = cur.rowcount
    cur.execute(
        "DELETE FROM hub_campaign_map WHERE client_id = %s AND external_campaign_id LIKE %s",
        (CLIENT_ID, PREFIX + "%"),
    )
    n_map = cur.rowcount
    cur.execute("DELETE FROM hub_campaigns WHERE code LIKE %s", (PREFIX + "%",))
    n_hub = cur.rowcount
    cur.execute(
        """
        DELETE FROM client_channel_accounts
        WHERE client_id = %s AND (
          external_account_id LIKE %s
          OR regexp_replace(COALESCE(external_account_id, ''), '^act_', '', 'i') = %s
        )
        """,
        (CLIENT_ID, PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    n_acc = cur.rowcount
    # Drop previously seeded demo pages except the long-lived qa-local-page row
    # (we upsert its display name below).
    cur.execute(
        """
        DELETE FROM portal_client_pages
        WHERE client_id = %s AND (
          page_id LIKE %s
          OR (channel = 'ad_account' AND page_id = %s)
        )
        """,
        (CLIENT_ID, PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    n_pages = cur.rowcount
    cur.execute(
        "DELETE FROM creative_submissions WHERE client_id = %s AND title LIKE %s",
        (CLIENT_ID, "PTT Demo:%"),
    )
    n_cre = cur.rowcount
    print(
        f"deleted prior qa4-local-demo: performance={n_perf} breakdowns={n_bd} "
        f"customers={n_cust} cases={n_cases} page_leads={n_leads} messages={n_msg} "
        f"products={n_prod} orders={n_ord} comments={n_cmt} carriers={n_car} "
        f"maps={n_map} hub={n_hub} accounts={n_acc} pages={n_pages} creatives={n_cre}"
    )


def upsert_pages(cur) -> None:
    rows = list(FANPAGES) + [
        {"page_id": META_AD_ACCOUNT_ID, "page_name": META_AD_ACCOUNT_NAME, "channel": "ad_account"}
    ]
    for p in rows:
        cur.execute(
            """
            INSERT INTO portal_client_pages (id, client_id, page_id, page_name, channel, active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, TRUE, NOW(), NOW())
            ON CONFLICT (channel, page_id) DO UPDATE SET
              page_name = EXCLUDED.page_name,
              active = TRUE,
              client_id = EXCLUDED.client_id,
              updated_at = NOW()
            """,
            (str(uuid.uuid4()), CLIENT_ID, p["page_id"], p["page_name"], p["channel"]),
        )
    print(f"upserted {len(rows)} portal_client_pages (3 fanpages/OA + 1 meta ad account, no tokens)")


def insert_accounts(cur) -> None:
    for channel, (ext_id, name) in ACCOUNTS.items():
        cur.execute(
            """
            INSERT INTO client_channel_accounts (
              client_id, channel, external_account_id, display_name,
              status, token_status, access_token_encrypted, token_scopes, meta
            ) VALUES (%s, %s, %s, %s, 'active', 'unknown', NULL, '{}', '{}'::jsonb)
            """,
            (CLIENT_ID, channel, ext_id, name),
        )
    print("inserted channel accounts meta+zalo (no tokens)")


def insert_campaigns(cur) -> dict[str, tuple[int, str]]:
    """Return {external_campaign_id: (hub_campaign_id, map_id)}."""
    mapping: dict[str, tuple[int, str]] = {}
    for channel, ext_id, name, _share in CAMPAIGNS:
        cur.execute(
            """
            INSERT INTO hub_campaigns (code, name, channel, external_ref, active, notes)
            VALUES (%s, %s, %s, %s, TRUE, 'qa4-local-demo seed — local only')
            RETURNING id
            """,
            (ext_id, name, channel, ext_id),
        )
        hub_id = cur.fetchone()[0]
        target = Decimal("1800000") if channel == "meta" else Decimal("900000")
        map_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO hub_campaign_map (
              id, client_id, hub_campaign_id, channel,
              external_campaign_id, external_campaign_name, external_account_id,
              target_cpl_vnd, active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            """,
            (map_id, CLIENT_ID, hub_id, channel, ext_id, name, ACCOUNTS[channel][0], target),
        )
        mapping[ext_id] = (hub_id, map_id)
    print(f"inserted {len(mapping)} hub campaigns + maps")
    return mapping


def day_spend(d: date, channel: str) -> int:
    weekend = d.weekday() >= 5
    if channel == "meta":
        base = 2_200_000
        lo, hi = 1_500_000, 3_000_000
        if weekend:
            base = 1_700_000
    else:
        base = 720_000
        lo, hi = 500_000, 1_000_000
        if weekend:
            base = 560_000
    dow_boost = {0: 0.96, 1: 1.02, 2: 1.06, 3: 1.04, 4: 1.10, 5: 1.0, 6: 0.95}[d.weekday()]
    age = (TODAY - d).days
    trend = 1.0 + 0.004 * (30 - age)
    noise = RNG.uniform(0.90, 1.12)
    value = int(round(base * dow_boost * trend * noise / 1000.0) * 1000)
    return max(lo, min(hi, value))


def split_campaign_spend(total: int, shares: list[float]) -> list[int]:
    return split_parts(total, shares)


def _metrics_for_spend(spend: int, channel: str, d: date, nleads: int) -> dict:
    rng = EXTRA_RNG
    ctr = rng.uniform(0.014, 0.028) if d.weekday() < 5 else rng.uniform(0.011, 0.022)
    cpm = rng.uniform(45_000, 90_000) if channel == "meta" else rng.uniform(35_000, 70_000)
    impressions = max(200 if spend else 0, int(round(spend / cpm * 1000)) if cpm else 0)
    clicks = max(1 if spend else 0, int(round(impressions * ctr)))
    if clicks > impressions:
        clicks = impressions
    actual_ctr = (clicks / impressions * 100) if impressions else 0
    cpc = (spend / clicks) if clicks else 0
    actual_cpm = (spend / impressions * 1000) if impressions else 0
    reach = int(impressions * rng.uniform(0.72, 0.92)) if impressions else 0
    freq = round(impressions / reach, 2) if reach else 1
    return {
        "impressions": impressions,
        "clicks": clicks,
        "reach": reach,
        "frequency": freq,
        "cpc": round(cpc, 2),
        "cpm": round(actual_cpm, 2),
        "ctr": round(actual_ctr, 4),
        "leads": nleads,
        "link_clicks": int(round(clicks * rng.uniform(0.78, 0.95))) if clicks else 0,
    }


def _perf_tuple(channel, account, camp_id, camp_name, map_id, d, spend, metrics, level, adset_id="", adset_name="", ad_id="", ad_name=""):
    return (
        CLIENT_ID, channel, account, camp_id, camp_name, map_id, d, "VND",
        spend, metrics["impressions"], metrics["clicks"], metrics["reach"],
        metrics["frequency"], metrics["cpc"], metrics["cpm"], metrics["ctr"],
        metrics["leads"], metrics["leads"], metrics["leads"], 0,
        level, adset_id, adset_name, ad_id, ad_name, metrics["link_clicks"],
    )


def build_performance(cur, mapping: dict[str, tuple[int, str]], lead_by_day_ch: dict) -> dict:
    days = daterange(START, TODAY)
    meta_camps = [c for c in CAMPAIGNS if c[0] == "meta"]
    zalo_camps = [c for c in CAMPAIGNS if c[0] == "zalo"]
    rows = []
    breakdowns = []
    totals = defaultdict(lambda: defaultdict(int))

    def period_of(d: date) -> None:
        return None

    adset_map = {"meta": META_ADSETS, "zalo": ZALO_ADSETS}
    ads_map = {"meta": META_ADS, "zalo": ZALO_ADS}

    for d in days:
        for channel, camps in (("meta", meta_camps), ("zalo", zalo_camps)):
            total = day_spend(d, channel)
            shares = [c[3] for c in camps]
            parts = split_campaign_spend(total, shares)
            day_leads = lead_by_day_ch.get((d, channel), 0)
            lead_parts = [0] * len(camps)
            for i in range(day_leads):
                roll = RNG.random()
                acc = 0.0
                picked = 0
                for j, s in enumerate(shares):
                    acc += s
                    if roll <= acc:
                        picked = j
                        break
                lead_parts[picked] += 1
            day_account = {
                "spend": 0, "impressions": 0, "clicks": 0, "reach": 0,
                "leads": 0, "link_clicks": 0,
            }
            account_id = ACCOUNTS[channel][0]
            for (ch, ext_id, name, _s), spend, nleads in zip(camps, parts, lead_parts):
                metrics = _metrics_for_spend(spend, channel, d, nleads)
                _, map_id = mapping[ext_id]
                rows.append(_perf_tuple(
                    channel, account_id, ext_id, name, map_id, d, spend, metrics, "campaign"
                ))
                day_account["spend"] += spend
                day_account["impressions"] += metrics["impressions"]
                day_account["clicks"] += metrics["clicks"]
                day_account["reach"] += metrics["reach"]
                day_account["leads"] += nleads
                day_account["link_clicks"] += metrics["link_clicks"]

                # Adset / ad grains — spend sums back to the campaign row.
                adsets = adset_map[channel][ext_id]
                adset_shares = [0.58, 0.42]
                adset_spends = split_parts(spend, adset_shares)
                adset_leads = split_int(nleads, adset_shares)
                adset_imps = split_int(metrics["impressions"], adset_shares)
                adset_clicks = split_int(metrics["clicks"], adset_shares)
                adset_reach = split_int(metrics["reach"], adset_shares)
                adset_links = split_int(metrics["link_clicks"], adset_shares)
                for (adset_id, adset_name), a_spend, a_leads, a_imp, a_clk, a_reach, a_link in zip(
                    adsets, adset_spends, adset_leads, adset_imps, adset_clicks, adset_reach, adset_links
                ):
                    a_ctr = (a_clk / a_imp * 100) if a_imp else 0
                    a_cpc = (a_spend / a_clk) if a_clk else 0
                    a_cpm = (a_spend / a_imp * 1000) if a_imp else 0
                    a_freq = round(a_imp / a_reach, 2) if a_reach else 1
                    a_metrics = {
                        "impressions": a_imp, "clicks": a_clk, "reach": a_reach,
                        "frequency": a_freq, "cpc": round(a_cpc, 2), "cpm": round(a_cpm, 2),
                        "ctr": round(a_ctr, 4), "leads": a_leads, "link_clicks": a_link,
                    }
                    rows.append(_perf_tuple(
                        channel, account_id, ext_id, name, map_id, d, a_spend, a_metrics,
                        "adset", adset_id, adset_name,
                    ))
                    ads = ads_map[channel][adset_id]
                    ad_shares = [0.55, 0.45]
                    ad_spends = split_parts(a_spend, ad_shares)
                    ad_leads = split_int(a_leads, ad_shares)
                    ad_imps = split_int(a_imp, ad_shares)
                    ad_clicks = split_int(a_clk, ad_shares)
                    ad_reach = split_int(a_reach, ad_shares)
                    ad_links = split_int(a_link, ad_shares)
                    for (ad_id, ad_name), s2, l2, i2, c2, r2, k2 in zip(
                        ads, ad_spends, ad_leads, ad_imps, ad_clicks, ad_reach, ad_links
                    ):
                        m2 = {
                            "impressions": i2, "clicks": c2, "reach": r2,
                            "frequency": round(i2 / r2, 2) if r2 else 1,
                            "cpc": round((s2 / c2) if c2 else 0, 2),
                            "cpm": round((s2 / i2 * 1000) if i2 else 0, 2),
                            "ctr": round((c2 / i2 * 100) if i2 else 0, 4),
                            "leads": l2, "link_clicks": k2,
                        }
                        rows.append(_perf_tuple(
                            channel, account_id, ext_id, name, map_id, d, s2, m2,
                            "ad", adset_id, adset_name, ad_id, ad_name,
                        ))

                if channel == "meta":
                    for btype, pairs in BREAKDOWNS.items():
                        b_shares = [p[1] for p in pairs]
                        b_spends = split_parts(spend, b_shares)
                        b_imps = split_int(metrics["impressions"], b_shares)
                        b_clicks = split_int(metrics["clicks"], b_shares)
                        b_leads = split_int(nleads, b_shares)
                        for (bval, _sh), bs, bi, bc, bl in zip(pairs, b_spends, b_imps, b_clicks, b_leads):
                            breakdowns.append((
                                CLIENT_ID, "meta", ext_id, d, btype, bval,
                                bs, bi, bc, bl, Json({}), account_id,
                            ))

                for key in ("last30",):
                    totals[key][channel] += spend
                    totals[key]["all"] += spend
                if d >= date(2026, 11, 1):
                    totals["month"][channel] += spend
                    totals["month"]["all"] += spend
                if d >= date(2026, 11, 7):
                    totals["last7"][channel] += spend
                    totals["last7"]["all"] += spend
                if d == TODAY:
                    totals["today"][channel] += spend
                    totals["today"]["all"] += spend

            if channel == "meta" and day_account["spend"]:
                reach = day_account["reach"]
                impressions = day_account["impressions"]
                clicks = day_account["clicks"]
                spend = day_account["spend"]
                acc_metrics = {
                    "impressions": impressions,
                    "clicks": clicks,
                    "reach": reach,
                    "frequency": round(impressions / reach, 2) if reach else 1,
                    "cpc": round((spend / clicks) if clicks else 0, 2),
                    "cpm": round((spend / impressions * 1000) if impressions else 0, 2),
                    "ctr": round((clicks / impressions * 100) if impressions else 0, 4),
                    "leads": day_account["leads"],
                    "link_clicks": day_account["link_clicks"],
                }
                rows.append(_perf_tuple(
                    "meta", account_id, "", META_AD_ACCOUNT_NAME, None, d, spend, acc_metrics, "account"
                ))

    execute_values(
        cur,
        """
        INSERT INTO daily_performance (
          client_id, channel, external_account_id, external_campaign_id,
          external_campaign_name, hub_campaign_map_id, performance_date, currency,
          spend, impressions, clicks, reach, frequency, cpc, cpm, ctr,
          leads_platform, leads_crm, conversions, conversion_value,
          insight_level, external_adset_id, external_adset_name,
          external_ad_id, external_ad_name, inline_link_clicks
        ) VALUES %s
        """,
        rows,
    )
    if breakdowns:
        execute_values(
            cur,
            """
            INSERT INTO daily_performance_breakdown (
              client_id, channel, external_campaign_id, performance_date,
              breakdown_type, breakdown_value, spend, impressions, clicks,
              leads_platform, raw_insights, external_account_id
            ) VALUES %s
            """,
            breakdowns,
        )
    cur.execute(
        """
        INSERT INTO meta_ad_account_sync_state (
          client_id, external_account_id, last_synced_at, last_error,
          last_since, last_until, rows_upserted, updated_at, last_breakdown_warnings
        ) VALUES (%s, %s, NOW(), NULL, %s, %s, %s, NOW(), NULL)
        ON CONFLICT (client_id, external_account_id) DO UPDATE SET
          last_synced_at = NOW(), last_error = NULL,
          last_since = EXCLUDED.last_since, last_until = EXCLUDED.last_until,
          rows_upserted = EXCLUDED.rows_upserted, updated_at = NOW(),
          last_breakdown_warnings = NULL
        """,
        (CLIENT_ID, META_AD_ACCOUNT_ID, START, TODAY, len(rows)),
    )
    n_campaign = sum(1 for r in rows if r[20] == "campaign")
    n_adset = sum(1 for r in rows if r[20] == "adset")
    n_ad = sum(1 for r in rows if r[20] == "ad")
    n_acc = sum(1 for r in rows if r[20] == "account")
    print(
        f"inserted {len(rows)} daily_performance rows "
        f"(campaign={n_campaign} adset={n_adset} ad={n_ad} account={n_acc}); "
        f"breakdowns={len(breakdowns)}"
    )
    return {k: dict(v) for k, v in totals.items()}


def allocate_cases(kind: str, plan: dict) -> list[dict]:
    """Build a concrete list of cases for one kind according to the period plan."""
    buckets = {
        "today": daterange(TODAY, TODAY),
        "last6": daterange(date(2026, 11, 7), date(2026, 11, 12)),
        "month": daterange(date(2026, 11, 1), date(2026, 11, 6)),
        "earlier": daterange(START, date(2026, 10, 31)),
    }
    items: list[dict] = []
    seq = 0
    for bucket, dates in buckets.items():
        total, nconv = plan[bucket]
        per_day = distribute_counts(dates, total)
        slots: list[tuple[date, bool]] = []
        for d, n in per_day.items():
            slots.extend([(d, False)] * n)
        idx = list(range(len(slots)))
        RNG.shuffle(idx)
        converted_idx = set(idx[:nconv])
        for i, (d, _) in enumerate(slots):
            seq += 1
            converted = i in converted_idx
            zalo_p = 0.34 if d >= date(2026, 11, 7) else 0.28
            ch = "zalo" if RNG.random() < zalo_p else "meta"
            items.append(
                {
                    "seq": seq,
                    "kind": kind,
                    "day": d,
                    "channel": ch,
                    "converted": converted,
                }
            )
    return items


INBOX_SCRIPTS = [
    [
        ("in", "Chào shop, cho mình hỏi sản phẩm còn hàng không ạ?"),
        ("out", "Dạ chào bạn, bên mình còn hàng ạ. Bạn đang quan tâm mẫu nào ạ?"),
        ("in", "Mình lấy 1 phần, ship về quận 7 được không ạ?"),
        ("out", "Dạ ship được ạ, phí 25.000đ, nhận trong 1-2 ngày. Bạn chốt mình lên đơn nhé."),
        ("in", "Chốt giúp mình, số điện thoại {phone} ạ."),
    ],
    [
        ("in", "Shop ơi liệu trình spa hôm nay còn lịch không ạ?"),
        ("out", "Dạ còn ạ. Mình còn khung 14h và 16h30. Bạn tiện giờ nào?"),
        ("in", "Mình book 16h30 được không ạ?"),
        ("out", "Dạ mình giữ lịch 16h30 cho bạn. Bạn vui lòng gửi họ tên giúp mình nhé."),
    ],
    [
        ("in", "Giá combo hiện tại bao nhiêu ạ? Có ship COD không?"),
        ("out", "Dạ combo đang {price}. Shop hỗ trợ COD toàn quốc ạ."),
        ("in", "Vậy mình đặt 1 combo, giao huyện Bình Chánh giúp mình."),
        ("out", "Dạ mình lên đơn giúp bạn. Ngày mai ship tới ạ."),
    ],
    [
        ("in", "Mình đặt hôm qua mà chưa thấy ai gọi xác nhận ạ."),
        ("out", "Dạ xin lỗi bạn, mình kiểm tra lại đơn ngay ạ. Bạn cho mình số điện thoại đặt hàng nhé."),
        ("in", "Số mình là {phone} ạ."),
        ("out", "Dạ mình thấy đơn rồi, sẽ giao trong hôm nay. Cảm ơn bạn đã thông cảm ạ."),
    ],
    [
        ("in", "Cho mình xin bảng giá và hình sản phẩm với ạ."),
        ("out", "Dạ mình gửi bảng giá và hình ảnh cho bạn ngay đây ạ. Bạn đang quan tâm dòng nào?"),
        ("in", "Mình muốn dùng cho da khô, shop tư vấn giúp mình với."),
        ("out", "Dạ với da khô mình gợi ý bộ dưỡng ẩm. Bạn cần mình lên đơn thử không ạ?"),
    ],
    [
        ("in", "Zalo ơi, mình muốn đăng ký tư vấn ạ."),
        ("out", "Dạ chào bạn, mình là CSKH PTT. Bạn cho mình biết nhu cầu để mình tư vấn rõ hơn ạ."),
        ("in", "Mình muốn đặt lịch cuối tuần."),
        ("out", "Dạ cuối tuần mình còn sáng CN. Mình giữ chỗ giúp bạn nhé."),
    ],
]


def _thread_messages(item: dict, page: dict, title: str, phone: str, created: datetime) -> list[dict]:
    script = INBOX_SCRIPTS[(item["seq"] - 1) % len(INBOX_SCRIPTS)]
    # ~25% unreplied: drop the last outbound if the script ends with out, or keep last as in.
    unreplied = EXTRA_RNG.random() < 0.28
    turns = list(script)
    if unreplied and turns and turns[-1][0] == "out":
        turns = turns[:-1]
    if item["seq"] % 7 == 0:
        turns = turns + [("in", "Mình thêm 1 phần nữa được không ạ?")]
    price = "890.000đ" if page is SHOP else ("650.000đ" if page is SPA else "450.000đ")
    out = []
    t = created
    last_day = item["day"]
    for i, (direction, body) in enumerate(turns):
        t = t + timedelta(minutes=EXTRA_RNG.randint(4, 90))
        t = clamp_now(t) or NOW
        body = body.replace("{phone}", phone or "0908123456").replace("{price}", price)
        out.append({"direction": direction, "body": body, "at": t, "idx": i})
        last_day = t.date()
    # If later turns were all clamped to NOW, spread them back so the thread still has a sequence.
    if out and out[-1]["at"] >= NOW - timedelta(seconds=2) and len(out) > 1:
        n = len(out)
        start = created if created < NOW else NOW - timedelta(minutes=max(8, n * 4))
        span = (NOW - start).total_seconds()
        if span <= 0:
            start = NOW - timedelta(minutes=max(8, n * 4))
            span = (NOW - start).total_seconds()
        for i, row in enumerate(out):
            row["at"] = start + timedelta(seconds=span * (i + 1) / n)
    return out


def insert_cases(cur, items: list[dict]) -> list[dict]:
    n_assigned = 0
    n_converted = 0
    by_kind = defaultdict(int)
    inserted: list[dict] = []
    message_rows = []
    for item in items:
        seq = item["seq"]
        kind = item["kind"]
        d = item["day"]
        ads_ch = item["channel"]
        converted = item["converted"]
        db_channel = "zalo" if ads_ch == "zalo" else "facebook"
        page = page_for_item(item)
        person = customer_name(seq + (0 if kind == "lead" else 80))
        title = person
        created = saigon_at(d)
        staff_id, _ = pick_staff()
        assigned_at = None
        received_at = None
        care_started = None
        status = "waiting_receive"
        assigned_manually = False
        purchased = False
        form_id = form_name = campaign_name = campaign_id = phone = ""
        lead_id = None
        if kind == "lead":
            form_id, form_name = FORMS[seq % len(FORMS)]
            camp_pool = [c for c in CAMPAIGNS if c[0] == ads_ch]
            camp = camp_pool[seq % len(camp_pool)]
            campaign_id, campaign_name = camp[1], camp[2]
            phone = "09%08d" % (10000000 + (seq * 17) % 80000000)
        else:
            phone = "09%08d" % (20000000 + (seq * 23) % 70000000)
        tag_n = 1 if RNG.random() < 0.65 else 2
        labels = [CARE_TAGS[(seq + i) % len(CARE_TAGS)] for i in range(tag_n)]
        if staff_id:
            assigned_at = created + timedelta(minutes=RNG.randint(8, 90))
            assigned_manually = True
            received_at = assigned_at + timedelta(minutes=RNG.randint(2, 40))
            care_started = received_at + timedelta(minutes=RNG.randint(5, 50))
            status = "received" if (not converted and seq % 3 == 0) else "caring"
            n_assigned += 1
        if converted:
            if not staff_id:
                staff_id = STAFF[seq % len(STAFF)][0]
                assigned_at = created + timedelta(minutes=RNG.randint(8, 90))
                assigned_manually = True
                received_at = assigned_at + timedelta(minutes=RNG.randint(2, 40))
                care_started = received_at + timedelta(minutes=RNG.randint(5, 50))
                n_assigned += 1
            purchased = (seq % 5) != 0 and (seq % 5) != 1
            status = "purchased" if purchased else "caring"
        case_id = str(uuid.uuid4())
        psid = ""
        if kind == "lead":
            lead_id = str(uuid.uuid4())
            thread = f"lead:{lead_id}"
            cur.execute(
                """
                INSERT INTO portal_page_leads (
                  id, client_id, page_id, external_lead_id, full_name, phone, email,
                  campaign_name, campaign_id, form_id, form_name, created_at
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, '',
                  %s, %s, %s, %s, %s
                )
                """,
                (
                    lead_id, CLIENT_ID, page["page_id"], f"{PREFIX}-lead-{seq:03d}",
                    title, phone, campaign_name, campaign_id, form_id, form_name, created,
                ),
            )
        else:
            # psidFromMessageThreadKey only accepts digit tails on mess:{page_id}:{psid}
            psid = str(9001000000 + seq)
            thread = f"mess:{page['page_id']}:{psid}"
        converted_at = None
        if converted:
            converted_at = clamp_now((care_started or created) + timedelta(hours=RNG.randint(2, 18)))
        assigned_at = clamp_now(assigned_at)
        received_at = clamp_now(received_at)
        care_started = clamp_now(care_started)
        last_read_at = None
        last_interaction = created
        if kind == "message":
            turns = _thread_messages(item, page, title, phone, created)
            last_interaction = turns[-1]["at"] if turns else created
            # Mark read when staff already received and last message is not brand new today-unreplied.
            if received_at and turns and turns[-1]["direction"] == "out":
                last_read_at = clamp_now(turns[-1]["at"] + timedelta(minutes=EXTRA_RNG.randint(3, 40)))
            for turn in turns:
                ext_id = f"{PREFIX}-msg-{seq:04d}-{turn['idx']:02d}"
                sender = title if turn["direction"] == "in" else page["page_name"]
                sender_psid = psid
                message_rows.append((
                    str(uuid.uuid4()), CLIENT_ID, page["page_id"], ext_id,
                    sender, turn["body"], turn["at"], turn["direction"], sender_psid, Json([]),
                ))
        cur.execute(
            """
            INSERT INTO portal_care_cases (
              id, client_id, page_id, channel, kind, thread_key, title,
              assignee_user_id, status, labels, customer_id,
              assigned_at, received_at, care_started_at,
              created_at, updated_at, assigned_manually, notes, converted_at, last_read_at
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, NULL,
              %s, %s, %s,
              %s, %s, %s, %s, %s, %s
            )
            """,
            (
                case_id, CLIENT_ID, page["page_id"], db_channel, kind, thread, title,
                staff_id, status, labels,
                assigned_at, received_at, care_started,
                created, last_interaction, assigned_manually, "qa4-local-demo seed",
                converted_at, last_read_at,
            ),
        )
        cust_id = None
        if converted:
            cust_id = str(uuid.uuid4())
            email = f"kh.{seq:03d}.{kind}@demo.local"
            cur.execute(
                """
                INSERT INTO portal_customers (
                  id, client_id, page_id, display_name, thread_key, case_id,
                  created_at, last_interaction_at, phone, email, psid,
                  source_conversation_case_id, source_lead_id
                ) VALUES (
                  %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s,
                  %s, %s
                )
                """,
                (
                    cust_id, CLIENT_ID, page["page_id"], title, thread, case_id,
                    converted_at or created, last_interaction, phone, email, psid,
                    case_id if kind == "message" else None, lead_id,
                ),
            )
            cur.execute(
                "UPDATE portal_care_cases SET customer_id = %s, converted_at = COALESCE(converted_at, %s) WHERE id = %s",
                (cust_id, converted_at or created, case_id),
            )
            n_converted += 1
        by_kind[kind] += 1
        inserted.append({
            "case_id": case_id, "kind": kind, "seq": seq, "page": page,
            "title": title, "phone": phone, "converted": converted, "purchased": purchased,
            "status": status, "staff_id": staff_id, "created": created,
            "converted_at": converted_at, "lead_id": lead_id, "cust_id": cust_id,
            "channel": ads_ch, "last_interaction": last_interaction,
        })
    if message_rows:
        execute_values(
            cur,
            """
            INSERT INTO portal_page_messages (
              id, client_id, page_id, external_message_id, sender_name, body,
              received_at, direction, sender_psid, attachments
            ) VALUES %s
            """,
            message_rows,
        )
    print(
        f"inserted cases: messages={by_kind['message']} leads={by_kind['lead']} "
        f"assigned≈{n_assigned} converted={n_converted} inbox_messages={len(message_rows)}"
    )
    return inserted


def lead_counts_by_day_channel(items: list[dict]) -> dict:
    out = defaultdict(int)
    for item in items:
        out[(item["day"], item["channel"])] += 1
    return out


CATALOG = {
    SHOP["page_id"]: [
        ("Serum Vitamin C 30ml", 450000, 280000, "Dưỡng sáng da, mờ thâm."),
        ("Kem dưỡng ẩm ban đêm", 320000, 180000, "Phục hồi da ban đêm."),
        ("Sữa rửa mặt dịu nhẹ", 189000, 90000, "Làm sạch cho da nhạy cảm."),
        ("Toner hoa hồng", 210000, 110000, "Cân bằng độ pH, se khít lỗ chân lông."),
        ("Combo chăm sóc da cơ bản", 890000, 520000, "Serum + kem đêm + sữa rửa mặt."),
        ("Mặt nạ dưỡng ẩm (hộp 5)", 159000, 80000, "Cấp nước tức thì."),
    ],
    SPA["page_id"]: [
        ("Liệu trình facial 90 phút", 650000, 250000, "Làm sạch sâu và dưỡng ẩm."),
        ("Massage body 60 phút", 450000, 180000, "Thư giãn vai cổ, giảm mệt."),
        ("Gội đầu dưỡng sinh", 250000, 90000, "Gội thảo mộc + massage đầu."),
        ("Combo thư giãn 120 phút", 990000, 400000, "Facial + massage body."),
        ("Chăm sóc da mụn", 550000, 220000, "Bóc tách + ánh sáng + dưỡng."),
        ("Liệu trình 5 buổi facial", 2800000, 1100000, "Gói liệu trình tiết kiệm."),
    ],
    ZALO_OA["page_id"]: [
        ("Gói tư vấn chăm sóc da", 199000, 60000, "Tư vấn 30 phút qua Zalo OA."),
        ("Voucher spa 200.000đ", 200000, 0, "Áp dụng cho lần thăm đầu."),
        ("Combo serum + tư vấn", 590000, 280000, "Serum Vitamin C kèm tư vấn."),
        ("Đặt lịch spa ưu đãi OA", 399000, 150000, "Giá ưu đãi riêng cho khách Zalo."),
    ],
}


def insert_catalog(cur) -> dict[str, list[dict]]:
    """Return {page_id: [product dicts]}."""
    cats = {}
    for name, sort in (("PTT Demo - Mỹ phẩm", 1), ("PTT Demo - Dịch vụ Spa", 2), ("PTT Demo - Zalo OA", 3)):
        cid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO portal_pos_categories (id, client_id, name, parent_id, sort_order, created_at)
            VALUES (%s, %s, %s, NULL, %s, NOW())
            """,
            (cid, CLIENT_ID, name, sort),
        )
        cats[name] = cid
    cat_for = {
        SHOP["page_id"]: cats["PTT Demo - Mỹ phẩm"],
        SPA["page_id"]: cats["PTT Demo - Dịch vụ Spa"],
        ZALO_OA["page_id"]: cats["PTT Demo - Zalo OA"],
    }
    cur.execute(
        "SELECT id FROM portal_pos_warehouses WHERE client_id = %s AND is_default IS TRUE LIMIT 1",
        (CLIENT_ID,),
    )
    existing_wh = cur.fetchone()
    if existing_wh:
        wh_id = str(existing_wh[0])
    else:
        wh_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO portal_pos_warehouses (id, client_id, name, is_default, address, low_stock_threshold, created_at)
            VALUES (%s, %s, 'PTT Demo - Kho trung tâm', TRUE, '12 Nguyễn Văn Linh, Q.7, TP.HCM', 5, NOW())
            """,
            (wh_id, CLIENT_ID),
        )
    by_page: dict[str, list[dict]] = defaultdict(list)
    sku_n = 0
    for page_id, products in CATALOG.items():
        for name, price, cost, detail in products:
            sku_n += 1
            pid = str(uuid.uuid4())
            sku = f"{PREFIX}-sku-{sku_n:03d}"
            img = "https://placehold.co/400x400/png?text=" + name.split()[0]
            spec = {"price_vnd": price, "colors": [], "sizes": [], "options": []}
            cur.execute(
                """
                INSERT INTO portal_page_products (
                  id, client_id, page_id, name, image_url, detail, created_at, spec, active,
                  sku, barcode, category_id, compare_at_vnd, cost_vnd, weight_gram, is_combo, low_stock_threshold
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, NOW(), %s, TRUE,
                  %s, '', %s, %s, %s, 250, FALSE, 5
                )
                """,
                (
                    pid, CLIENT_ID, page_id, name, img, detail, Json(spec),
                    sku, cat_for[page_id], int(price * 1.2), cost,
                ),
            )
            vid = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO portal_pos_variants (
                  id, client_id, product_id, sku, color, size, price_vnd, cost_vnd, compare_at_vnd,
                  weight_gram, barcode, image_url, attrs, active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, '', '', %s, %s, %s, 250, '', %s, '{}'::jsonb, TRUE, NOW(), NOW())
                """,
                (vid, CLIENT_ID, pid, sku, price, cost, int(price * 1.2), img),
            )
            on_hand = 20 + (sku_n * 7) % 80
            cur.execute(
                """
                INSERT INTO portal_pos_stock (warehouse_id, variant_id, on_hand, reserved, updated_at)
                VALUES (%s, %s, %s, 0, NOW())
                """,
                (wh_id, vid, on_hand),
            )
            by_page[page_id].append({
                "id": pid, "name": name, "price": price, "cost": cost, "sku": sku, "image": img,
                "variant_id": vid,
            })
    print(f"inserted catalog: products={sku_n} categories=3 warehouse=1 variants+stock={sku_n}")
    return {"warehouse_id": wh_id, "by_page": dict(by_page)}


ADDRESSES = [
    ("12 Nguyễn Văn Linh", "Hồ Chí Minh", "Quận 7", "Tân Thuận Tây"),
    ("88 Lê Lợi", "Hồ Chí Minh", "Quận 1", "Bến Nghé"),
    ("21 Trần Hưng Đạo", "Hà Nội", "Hoàn Kiếm", "Hàng Bài"),
    ("5 Nguyễn Huệ", "Đà Nẵng", "Hải Châu", "Hải Châu 1"),
    ("36 Phạm Văn Đồng", "Hồ Chí Minh", "Bình Thạnh", "Hiệp Bình Chánh"),
    ("15 Lý Thường Kiệt", "Hà Nội", "Hoàn Kiếm", "Tràng Tiền"),
]


def insert_orders(cur, cases: list[dict], catalog: dict) -> None:
    purchased = [c for c in cases if c["purchased"] or (c["converted"] and c["kind"] == "lead" and c["seq"] % 5 in (2, 3, 4))]
    # Also turn some converted message cases into orders even if not marked purchased.
    extras = [c for c in cases if c["converted"] and not c["purchased"] and c["kind"] == "message" and c["seq"] % 4 == 0]
    targets = purchased + extras
    statuses = [
        "success", "success", "success", "success", "shipping", "awaiting_pickup",
        "packing", "confirmed", "new", "returned", "cancelled",
    ]
    by_page = catalog["by_page"]
    wh_id = catalog["warehouse_id"]
    # Carrier accounts — test mode, no tokens.
    carriers = []
    for carrier, label in (("ghn", "PTT Demo GHN (test)"), ("ghtk", "PTT Demo GHTK (test)"), ("vtp", "PTT Demo Viettel Post (test)")):
        cid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO portal_pos_carrier_accounts (
              id, client_id, carrier, label, token_encrypted, shop_id, extra, test_mode, active, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, NULL, '', '{}'::jsonb, TRUE, TRUE, NOW(), NOW())
            """,
            (cid, CLIENT_ID, carrier, label),
        )
        carriers.append((cid, carrier, label))

    pos_customers = {}
    n_ship = 0
    n_ord = 0
    for i, case in enumerate(targets):
        page = case["page"]
        products = by_page.get(page["page_id"]) or by_page[SHOP["page_id"]]
        pick = products[case["seq"] % len(products)]
        qty = 1 if pick["price"] >= 800000 else (2 if case["seq"] % 4 == 0 else 1)
        subtotal = pick["price"] * qty
        ship_fee = 0 if subtotal >= 500000 else 25000
        discount = 20000 if case["seq"] % 6 == 0 else 0
        total = max(0, subtotal + ship_fee - discount)
        status = statuses[i % len(statuses)]
        if not case["purchased"] and status == "success":
            status = "confirmed"
        addr = ADDRESSES[case["seq"] % len(ADDRESSES)]
        created = case["converted_at"] or case["created"]
        confirmed_at = shipped_at = delivered_at = cancelled_at = returned_at = None
        stock_state = "none"
        if status in ("confirmed", "packing", "awaiting_pickup", "shipping", "success", "returned"):
            confirmed_at = created + timedelta(hours=EXTRA_RNG.randint(1, 8))
            stock_state = "reserved"
        if status in ("awaiting_pickup", "shipping", "success", "returned"):
            shipped_at = (confirmed_at or created) + timedelta(hours=EXTRA_RNG.randint(4, 24))
            stock_state = "deducted"
        if status == "success":
            delivered_at = (shipped_at or created) + timedelta(days=EXTRA_RNG.randint(1, 3))
        if status == "cancelled":
            cancelled_at = created + timedelta(hours=EXTRA_RNG.randint(2, 20))
            stock_state = "released" if confirmed_at else "none"
        if status == "returned":
            returned_at = (shipped_at or created) + timedelta(days=EXTRA_RNG.randint(1, 4))
            stock_state = "restocked"
        # clamp dates
        for dt_name in ("confirmed_at", "shipped_at", "delivered_at", "cancelled_at", "returned_at"):
            val = locals()[dt_name]
            if val and val.date() > TODAY:
                locals_hack = None
        def clamp(dt):
            return clamp_now(dt)
        confirmed_at, shipped_at, delivered_at, cancelled_at, returned_at = map(
            clamp, (confirmed_at, shipped_at, delivered_at, cancelled_at, returned_at)
        )
        phone = case["phone"] or ("09%08d" % (30000000 + case["seq"] * 13 % 60000000))
        if phone not in pos_customers:
            pcid = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO portal_pos_customers (
                  id, client_id, name, phone, email, address, province, district, ward, notes, blacklist, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'qa4-local-demo seed', FALSE, %s, %s)
                """,
                (
                    pcid, CLIENT_ID, case["title"], phone, f"kh.{case['seq']:03d}@demo.local",
                    addr[0], addr[1], addr[2], addr[3], created, created,
                ),
            )
            pos_customers[phone] = pcid
        oid = str(uuid.uuid4())
        code = f"DH-QA4-{n_ord + 1:06d}"
        staff = case["staff_id"]
        cur.execute(
            """
            INSERT INTO portal_pos_orders (
              id, client_id, code, status, page_id, case_id, comment_id, customer_id,
              assignee_user_id, assignee_email, source, customer_name, phone, email,
              address, province, district, ward, subtotal_vnd, discount_vnd, shipping_fee_vnd,
              deposit_vnd, total_vnd, cod_vnd, notes, customer_notes, ad_id, post_id,
              warehouse_id, stock_state, confirmed_at, shipped_at, delivered_at,
              cancelled_at, returned_at, created_at, updated_at
            ) VALUES (
              %s, %s, %s, %s, %s, %s, '', %s,
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s, %s,
              0, %s, %s, 'qa4-local-demo seed', '', '', '',
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s
            )
            """,
            (
                oid, CLIENT_ID, code, status, page["page_id"], case["case_id"], pos_customers[phone],
                staff, STAFF_EMAIL.get(staff or "", ""),
                "inbox" if case["kind"] == "message" else "ad",
                case["title"], phone, f"kh.{case['seq']:03d}@demo.local",
                addr[0], addr[1], addr[2], addr[3],
                subtotal, discount, ship_fee, total, total if status != "cancelled" else 0,
                wh_id, stock_state, confirmed_at, shipped_at, delivered_at,
                cancelled_at, returned_at, created, delivered_at or shipped_at or confirmed_at or created,
            ),
        )
        cur.execute(
            """
            INSERT INTO portal_pos_order_items (
              id, order_id, product_id, variant_id, name, sku, color, size, qty,
              price_vnd, cost_vnd, image_url, weight_gram
            ) VALUES (%s, %s, %s, NULL, %s, %s, '', '', %s, %s, %s, %s, 250)
            """,
            (str(uuid.uuid4()), oid, pick["id"], pick["name"], pick["sku"], qty, pick["price"], pick["cost"], pick["image"]),
        )
        if status in ("awaiting_pickup", "shipping", "success", "returned"):
            acc_id, carrier, _label = carriers[i % len(carriers)]
            ship_status = {"awaiting_pickup": "ready_to_pick", "shipping": "delivering", "success": "delivered", "returned": "returned"}[status]
            cur.execute(
                """
                INSERT INTO portal_pos_shipments (
                  id, client_id, order_id, account_id, carrier, service_code, service_name,
                  tracking_code, status, raw_status, fee_vnd, label_url, payload,
                  test_mode, cancelled_at, created_at, updated_at
                ) VALUES (
                  %s, %s, %s, %s, %s, 'demo', 'Hàng nhẹ',
                  %s, %s, %s, %s, '', '{}'::jsonb,
                  TRUE, NULL, %s, %s
                )
                """,
                (
                    str(uuid.uuid4()), CLIENT_ID, oid, acc_id, carrier,
                    f"QA4{100000 + n_ship}", ship_status, ship_status,
                    ship_fee, shipped_at or created, delivered_at or shipped_at or created,
                ),
            )
            n_ship += 1
        n_ord += 1
    cur.execute(
        """
        INSERT INTO portal_pos_code_seq (client_id, last_value) VALUES (%s, %s)
        ON CONFLICT (client_id) DO UPDATE SET last_value = GREATEST(portal_pos_code_seq.last_value, EXCLUDED.last_value)
        """,
        (CLIENT_ID, n_ord),
    )
    print(f"inserted orders={n_ord} shipments={n_ship} pos_customers={len(pos_customers)} carriers={len(carriers)} (test_mode, no tokens)")


def insert_posts_and_comments(cur) -> None:
    posts = [
        (SHOP, "Khuyến mãi tuần này: giảm 15% serum Vitamin C. Inbox để được tư vấn ạ!"),
        (SHOP, "Combo chăm sóc da cơ bản chỉ còn 890.000đ — số lượng có hạn."),
        (SPA, "Lịch spa cuối tuần còn vài slot 14h và 16h30. Nhắn tin để giữ chỗ nhé!"),
        (SPA, "Ra mắt liệu trình chăm sóc da mụn 5 buổi, ưu đãi khách mới."),
        (ZALO_OA, "Zalo OA PTT: đặt lịch spa và nhận voucher 200.000đ trong tháng 11."),
    ]
    n_cmt = 0
    for i, (page, body) in enumerate(posts, start=1):
        post_id = f"{PREFIX}-post-{i:02d}"
        published = saigon_at(daterange(START, TODAY)[(i * 5) % len(daterange(START, TODAY))], 10, 15)
        cur.execute(
            """
            INSERT INTO portal_fb_posts (
              id, client_id, page_id, post_id, message, permalink, picture, created_time, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, '', %s, NOW())
            """,
            (str(uuid.uuid4()), CLIENT_ID, page["page_id"], post_id, body, f"https://example.local/posts/{post_id}", published),
        )
        cur.execute(
            """
            INSERT INTO portal_page_posts (id, client_id, page_id, body, published_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (str(uuid.uuid4()), CLIENT_ID, page["page_id"], f"[qa4-local-demo] {body}", published),
        )
        comments = [
            ("Bài này hay quá, cho mình xin giá ạ.", False, True),
            ("Shop ship về Thủ Đức còn không ạ?", False, True),
            ("Mình inbox rồi, ad check giúp mình với.", True, False),
        ]
        if i % 2 == 0:
            comments.append(("Đặt hộ mình 1 combo nha.", False, False))
        for j, (msg, hidden, replied) in enumerate(comments, start=1):
            who = customer_name(i * 10 + j)
            ctime = published + timedelta(hours=j * 3 + EXTRA_RNG.randint(0, 4))
            ctime = clamp_now(ctime)
            cur.execute(
                """
                INSERT INTO portal_page_comments (
                  id, client_id, page_id, post_id, comment_id, parent_id,
                  from_name, from_id, message, created_time, is_hidden, replied,
                  can_hide, can_reply, can_reply_privately, updated_at
                ) VALUES (
                  %s, %s, %s, %s, %s, '',
                  %s, %s, %s, %s, %s, %s,
                  TRUE, TRUE, TRUE, NOW()
                )
                """,
                (
                    str(uuid.uuid4()), CLIENT_ID, page["page_id"], post_id,
                    f"{PREFIX}-cmt-{i:02d}-{j:02d}", who, f"{PREFIX}-fbuser-{i}{j}",
                    msg, ctime, hidden, replied,
                ),
            )
            n_cmt += 1
    print(f"inserted fb_posts={len(posts)} comments={n_cmt}")




def insert_notifications(cur) -> None:
    """Broadcast + approver-visible rows (staff assignment notifs already exist from care)."""
    cur.execute(
        "DELETE FROM portal_notification WHERE client_id = %s AND title LIKE %s",
        (CLIENT_ID, "PTT Demo:%"),
    )
    rows = [
        ("system", "PTT Demo: dữ liệu mẫu đã sẵn sàng", "Lead, tin nhắn, đơn hàng và báo cáo ads đã được đổ cho PORTAL_DEMO.", "/dashboard", APPROVER_ID, False),
        ("campaign_milestone", "PTT Demo: chi tiêu Meta tuần này ổn định", "Chi tiêu Meta 7 ngày vừa qua khoảng 16 triệu đồng, CPL trong hạn mức.", "/meta", None, False),
        ("system", "PTT Demo: 51 đơn hàng mẫu", "Đơn hàng demo đã được tạo trên Shop, Spa và Zalo OA. Kiểm tra mục Đơn hàng.", "/crm/orders", None, True),
        ("campaign_milestone", "PTT Demo: Zalo OA có lead mới", "Form Zalo OA ghi nhận lead trong 7 ngày. Xem báo cáo Zalo Ads.", "/zalo", APPROVER_ID, False),
        ("system", "PTT Demo: catalog theo Page", "16 sản phẩm / dịch vụ đã gắn theo từng Page. Xem mục Sản phẩm.", "/products", None, False),
    ]
    for i, (cat, title, body, link, user_id, already_read) in enumerate(rows):
        created = clamp_now(NOW - timedelta(hours=i * 5 + EXTRA_RNG.randint(0, 3)))
        read_at = clamp_now(created + timedelta(minutes=30)) if already_read else None
        cur.execute(
            """
            INSERT INTO portal_notification (
              id, client_id, portal_user_id, category, title, body, link_url, meta, read_at, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, '{}'::jsonb, %s, %s)
            """,
            (str(uuid.uuid4()), CLIENT_ID, user_id, cat, title, body, link, read_at, created),
        )
    print(f"inserted {len(rows)} approver-visible demo notifications")


def insert_creatives(cur) -> None:
    """A few portal creatives so /client/creatives is not empty. Placeholder images, no tokens."""
    cur.execute(
        "DELETE FROM creative_submissions WHERE client_id = %s AND title LIKE %s",
        (CLIENT_ID, "PTT Demo:%"),
    )
    rows = [
        ("pending_client", "PTT Demo: Creative Inbox A — Shop", "Mẫu tin nhắn Shop, phiên bản chờ duyệt.",
         f"{PREFIX}-camp-meta-inbox", "PTT Shop Inbox", "https://placehold.co/800x800/png?text=Inbox+A",
         "image", "meta", "PTT AM (demo)", None, None),
        ("pending_client", "PTT Demo: Creative Form Spa", "Form tư vấn Spa — ảnh carousel chờ duyệt.",
         f"{PREFIX}-camp-meta-form", "PTT Spa Form", "https://placehold.co/800x800/png?text=Form+Spa",
         "image", "meta", "PTT AM (demo)", None, None),
        ("approved", "PTT Demo: Remarketing catalog", "Catalog remarketing đã được duyệt.",
         f"{PREFIX}-camp-meta-retarget", "PTT Shop Remarketing", "https://placehold.co/800x800/png?text=Retarget",
         "image", "meta", "PTT AM (demo)", "approver@demo.local", "Đã duyệt, chạy tuần này."),
        ("approved", "PTT Demo: Zalo OA Message A", "Creative tin nhắn Zalo OA đã duyệt.",
         f"{PREFIX}-camp-zalo-oa", "PTT Zalo OA", "https://placehold.co/800x800/png?text=Zalo+OA",
         "image", "zalo", "PTT AM (demo)", "approver@demo.local", "OK chạy trên OA."),
        ("rejected", "PTT Demo: Engagement reel v1", "Reel tương tác — bị từ chối vì claim chưa rõ nguồn.",
         f"{PREFIX}-camp-meta-retarget", "PTT Shop Remarketing", "https://placehold.co/800x800/png?text=Reel+v1",
         "image", "meta", "PTT AM (demo)", "approver@demo.local", "Cần chỉnh lại claim và logo."),
    ]
    for i, (status, title, desc, camp_id, camp_name, asset, atype, channel, submitted_by, reviewed_by, note) in enumerate(rows):
        submitted = clamp_now(NOW - timedelta(days=2 + i, hours=EXTRA_RNG.randint(1, 8)))
        reviewed = None
        if status in ("approved", "rejected"):
            reviewed = clamp_now((submitted or NOW) + timedelta(hours=6 + i * 3, minutes=EXTRA_RNG.randint(0, 40)))
        cur.execute(
            """
            INSERT INTO creative_submissions (
              id, client_id, title, description, external_campaign_id, external_campaign_name,
              version, asset_url, asset_type, status, submitted_by, submitted_at,
              reviewed_by, reviewed_at, review_note, channel, created_at, updated_at
            ) VALUES (
              %s, %s, %s, %s, %s, %s,
              1, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s
            )
            """,
            (
                str(uuid.uuid4()), CLIENT_ID, title, desc, camp_id, camp_name,
                asset, atype, status, submitted_by, submitted,
                reviewed_by, reviewed, note, channel, submitted, reviewed or submitted,
            ),
        )
    print(f"inserted {len(rows)} portal creatives (pending/approved/rejected, placeholder images)")


def verify_timestamps(cur) -> None:
    cur.execute("SELECT NOW()")
    db_now = cur.fetchone()[0]
    checks = [
        ("portal_page_messages.received_at",
         "SELECT max(received_at) FROM portal_page_messages WHERE client_id = %s AND external_message_id LIKE %s",
         (CLIENT_ID, PREFIX + "%")),
        ("portal_care_cases.created_at",
         "SELECT max(created_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_care_cases.assigned_at",
         "SELECT max(assigned_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_care_cases.received_at",
         "SELECT max(received_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_care_cases.care_started_at",
         "SELECT max(care_started_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_care_cases.converted_at",
         "SELECT max(converted_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_care_cases.updated_at",
         "SELECT max(updated_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_care_cases.last_read_at",
         "SELECT max(last_read_at) FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_page_leads.created_at",
         "SELECT max(created_at) FROM portal_page_leads WHERE client_id = %s AND external_lead_id LIKE %s",
         (CLIENT_ID, PREFIX + "%")),
        ("portal_customers.created_at",
         "SELECT max(created_at) FROM portal_customers WHERE client_id = %s AND case_id IN (SELECT id FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed')",
         (CLIENT_ID, CLIENT_ID)),
        ("portal_customers.last_interaction_at",
         "SELECT max(last_interaction_at) FROM portal_customers WHERE client_id = %s AND case_id IN (SELECT id FROM portal_care_cases WHERE client_id = %s AND notes = 'qa4-local-demo seed')",
         (CLIENT_ID, CLIENT_ID)),
        ("portal_pos_orders.created_at",
         "SELECT max(created_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_pos_orders.confirmed_at",
         "SELECT max(confirmed_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_pos_orders.shipped_at",
         "SELECT max(shipped_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_pos_orders.delivered_at",
         "SELECT max(delivered_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_pos_orders.cancelled_at",
         "SELECT max(cancelled_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_pos_orders.returned_at",
         "SELECT max(returned_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_pos_orders.updated_at",
         "SELECT max(updated_at) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'",
         (CLIENT_ID,)),
        ("portal_page_comments.created_time",
         "SELECT max(created_time) FROM portal_page_comments WHERE client_id = %s AND comment_id LIKE %s",
         (CLIENT_ID, PREFIX + "%")),
        ("portal_fb_posts.created_time",
         "SELECT max(created_time) FROM portal_fb_posts WHERE client_id = %s AND post_id LIKE %s",
         (CLIENT_ID, PREFIX + "%")),
        ("portal_page_posts.published_at",
         "SELECT max(published_at) FROM portal_page_posts WHERE client_id = %s AND body LIKE %s",
         (CLIENT_ID, "[qa4-local-demo]%")),
        ("portal_notification.created_at",
         "SELECT max(created_at) FROM portal_notification WHERE client_id = %s AND title LIKE %s",
         (CLIENT_ID, "PTT Demo:%")),
        ("portal_notification.read_at",
         "SELECT max(read_at) FROM portal_notification WHERE client_id = %s AND title LIKE %s",
         (CLIENT_ID, "PTT Demo:%")),
        ("daily_performance.performance_date",
         "SELECT max(performance_date) FROM daily_performance WHERE client_id = %s AND (external_campaign_id LIKE %s OR external_account_id = %s)",
         (CLIENT_ID, PREFIX + "%", META_AD_ACCOUNT_ID)),
        ("daily_performance.synced_at",
         "SELECT max(synced_at) FROM daily_performance WHERE client_id = %s AND (external_campaign_id LIKE %s OR external_account_id = %s)",
         (CLIENT_ID, PREFIX + "%", META_AD_ACCOUNT_ID)),
        ("creative_submissions.submitted_at",
         "SELECT max(submitted_at) FROM creative_submissions WHERE client_id = %s AND title LIKE %s",
         (CLIENT_ID, "PTT Demo:%")),
        ("creative_submissions.reviewed_at",
         "SELECT max(reviewed_at) FROM creative_submissions WHERE client_id = %s AND title LIKE %s",
         (CLIENT_ID, "PTT Demo:%")),
        ("meta_ad_account_sync_state.last_synced_at",
         "SELECT max(last_synced_at) FROM meta_ad_account_sync_state WHERE client_id = %s AND regexp_replace(external_account_id, '^act_', '', 'i') = %s",
         (CLIENT_ID, META_AD_ACCOUNT_ID)),
    ]
    bad = 0
    print(f"\ntimestamp check vs db now() = {db_now}")
    for label, sql, args in checks:
        cur.execute(sql, args)
        mx = cur.fetchone()[0]
        if mx is None:
            print(f"  {label}: (empty)")
            continue
        # date columns compare against current date; timestamptz against now()
        if hasattr(mx, "year") and not hasattr(mx, "hour"):
            ok = mx <= db_now.date() if hasattr(db_now, "date") else mx <= NOW.date()
        else:
            ok = mx <= db_now
        flag = "OK" if ok else "FUTURE"
        if not ok:
            bad += 1
        print(f"  {flag} {label}: {mx}")
    if bad:
        print(f"WARNING: {bad} timestamp(s) later than now()")
    else:
        print("timestamp check OK — no seeded row later than now()")


def verify(cur, spend_totals: dict) -> None:
    cur.execute(
        """
        SELECT thread_key FROM portal_care_cases
        WHERE client_id = %s
          AND thread_key IN ('mess:qa-local-page:qa-psid-a', 'mess:qa-local-page:qa-psid-b')
        """,
        (CLIENT_ID,),
    )
    kept = {r[0] for r in cur.fetchall()}
    if len(kept) != 2:
        print("WARNING: expected 2 existing synthetic messages, found", kept)
    else:
        print("kept 2 existing non-qa4 messages")

    def period_clause(from_d: date, to_d: date) -> tuple[str, tuple]:
        return (
            """
            ((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= %s
             AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= %s)
            """,
            (from_d, to_d),
        )

    periods = [
        ("Hôm nay", TODAY, TODAY),
        ("7 ngày", date(2026, 11, 7), TODAY),
        ("Tháng này", date(2026, 11, 1), TODAY),
        ("30 ngày", START, TODAY),
    ]
    print()
    print(f"{'Khoảng':<12} {'TN':>5} {'TN→KH':>8} {'Lead':>6} {'L→KH':>7}  chi tiêu Meta / Zalo / tổng")
    for label, a, b in periods:
        clause, args = period_clause(a, b)
        cur.execute(
            f"""
            SELECT kind, COUNT(*), COUNT(*) FILTER (WHERE customer_id IS NOT NULL)
            FROM portal_care_cases
            WHERE client_id = %s AND {clause}
            GROUP BY kind
            """,
            (CLIENT_ID, *args),
        )
        tallies = {row[0]: (row[1], row[2]) for row in cur.fetchall()}
        msg = tallies.get("message", (0, 0))
        lead = tallies.get("lead", (0, 0))
        if label == "Hôm nay":
            key = "today"
        elif label == "7 ngày":
            key = "last7"
        elif label == "Tháng này":
            key = "month"
        else:
            key = "last30"
        st = spend_totals[key]
        print(
            f"{label:<12} {msg[0]:>5} {msg[1]:>3}/{msg[0]:<4} {lead[0]:>6} {lead[1]:>3}/{lead[0]:<3}  "
            f"{fmt_vnd(st['meta'])} / {fmt_vnd(st['zalo'])} / {fmt_vnd(st['all'])}"
        )

    cur.execute(
        """
        SELECT COUNT(*) FILTER (WHERE hub_campaign_map_id IS NULL AND insight_level = 'campaign'),
               COUNT(*) FILTER (WHERE insight_level = 'campaign')
        FROM daily_performance
        WHERE client_id = %s AND (external_campaign_id LIKE %s OR external_account_id = %s)
        """,
        (CLIENT_ID, PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    unmapped, total = cur.fetchone()
    print(f"\ncampaign performance rows={total}, unmapped={unmapped} (want 0)")

    cur.execute(
        """
        SELECT performance_date, channel, SUM(spend)
        FROM daily_performance
        WHERE client_id = %s
          AND performance_date >= %s
          AND (insight_level = 'campaign' OR insight_level IS NULL)
          AND (external_campaign_id LIKE %s OR external_account_id = %s)
        GROUP BY performance_date, channel
        ORDER BY performance_date, channel
        """,
        (CLIENT_ID, date(2026, 11, 7), PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    print("last-7 daily spend by channel (campaign level):")
    for r in cur.fetchall():
        print(f"  {r[0]} {r[1]:<5} {fmt_vnd(r[2])}")

    cur.execute(
        "SELECT COUNT(*) FROM portal_care_cases WHERE client_id = %s AND kind = 'message'",
        (CLIENT_ID,),
    )
    total_msg = cur.fetchone()[0]
    print(f"total messages for PORTAL_DEMO (desk cap 200): {total_msg}")
    if total_msg > 200:
        print("WARNING: messages exceed desk LIMIT 200")
    cur.execute(
        """
        SELECT COUNT(*), COUNT(*) FILTER (WHERE customer_id IS NOT NULL)
        FROM portal_care_cases WHERE client_id = %s AND kind = 'lead'
        """,
        (CLIENT_ID,),
    )
    nlead, nconv = cur.fetchone()
    print(f"total leads for PORTAL_DEMO: {nlead} (converted {nconv}; want 80 / 20)")
    if nlead != 80:
        print("WARNING: lead count is not 80 — possible trigger duplicates")

    cur.execute(
        """
        SELECT access_token_encrypted IS NOT NULL, COUNT(*)
        FROM client_channel_accounts
        WHERE client_id = %s AND (
          external_account_id LIKE %s OR external_account_id = %s
        )
        GROUP BY 1
        """,
        (CLIENT_ID, PREFIX + "%", META_AD_ACCOUNT_ID),
    )
    for has_token, n in cur.fetchall():
        print(f"channel accounts token_present={has_token} n={n}")

    cur.execute(
        "SELECT channel, page_id, page_name, active FROM portal_client_pages WHERE client_id = %s ORDER BY channel, page_id",
        (CLIENT_ID,),
    )
    print("pages:")
    for r in cur.fetchall():
        print(f"  {r[0]:<12} {r[1]:<28} {r[2]} active={r[3]}")

    cur.execute(
        """
        SELECT page_id, COUNT(*) FROM portal_care_cases
        WHERE client_id = %s AND kind = 'lead' GROUP BY page_id ORDER BY 1
        """,
        (CLIENT_ID,),
    )
    print("leads by page:")
    for r in cur.fetchall():
        print(f"  {r[0]} {r[1]}")

    cur.execute(
        """
        SELECT insight_level, channel, COUNT(*), SUM(spend)::bigint
        FROM daily_performance
        WHERE client_id = %s AND performance_date BETWEEN %s AND %s
        GROUP BY 1, 2 ORDER BY 2, 1
        """,
        (CLIENT_ID, START, TODAY),
    )
    print("insights by level:")
    for r in cur.fetchall():
        print(f"  {r[1]:<5} {r[0]:<10} rows={r[2]} spend={fmt_vnd(r[3] or 0)}")

    for label, sql in [
        ("inbox messages", "SELECT COUNT(*) FROM portal_page_messages WHERE client_id = %s AND external_message_id LIKE %s"),
        ("customers", "SELECT COUNT(*) FROM portal_customers WHERE client_id = %s"),
        ("products", "SELECT COUNT(*) FROM portal_page_products WHERE client_id = %s AND sku LIKE %s"),
        ("orders", "SELECT COUNT(*) FROM portal_pos_orders WHERE client_id = %s AND notes = 'qa4-local-demo seed'"),
        ("comments", "SELECT COUNT(*) FROM portal_page_comments WHERE client_id = %s AND comment_id LIKE %s"),
        ("breakdowns", "SELECT COUNT(*) FROM daily_performance_breakdown WHERE client_id = %s AND external_account_id = %s"),
    ]:
        if label in ("inbox messages", "products", "comments"):
            cur.execute(sql, (CLIENT_ID, PREFIX + "%"))
        elif label == "breakdowns":
            cur.execute(sql, (CLIENT_ID, META_AD_ACCOUNT_ID))
        else:
            cur.execute(sql, (CLIENT_ID,))
        print(f"  {label}: {cur.fetchone()[0]}")


def main() -> int:
    url = load_database_url()
    if "127.0.0.1" not in url and "localhost" not in url:
        print("refusing to seed: DATABASE_URL host is not local")
        return 2
    conn = psycopg2.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, code FROM clients WHERE id = %s", (CLIENT_ID,))
            row = cur.fetchone()
            if not row or row[1] != "PORTAL_DEMO":
                print("refusing to seed: client is not PORTAL_DEMO")
                conn.rollback()
                return 2
            delete_prior(cur)
            upsert_pages(cur)
            insert_accounts(cur)
            mapping = insert_campaigns(cur)
            messages = allocate_cases("message", MSG_PLAN)
            leads = allocate_cases("lead", LEAD_PLAN)
            lead_by = lead_counts_by_day_channel(leads)
            cases = insert_cases(cur, messages + leads)
            spend_totals = build_performance(cur, mapping, lead_by)
            catalog = insert_catalog(cur)
            insert_orders(cur, cases, catalog)
            insert_posts_and_comments(cur)
            insert_notifications(cur)
            insert_creatives(cur)
            verify(cur, spend_totals)
            verify_timestamps(cur)
        conn.commit()
        print("\nSEED OK — committed")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
