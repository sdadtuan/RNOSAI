#!/usr/bin/env python3
"""Seed tài khoản super admin toàn quyền — PostgreSQL (ops-web / Nest) hoặc SQLite legacy.

Ví dụ VPS (PG-only, không cần ptt.db):
  export DATABASE_URL=postgresql://ptt:PASSWORD@127.0.0.1:5433/rnosaidb
  python3 scripts/seed_super_admin_full_access.py --pg-only \\
    --email admin@pttads.vn --password 'YourPass!'

Legacy local (SQLite + optional PG):
  python3 scripts/seed_super_admin_full_access.py --sqlite ./ptt.db --apply-pg
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import os
import secrets
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from admin_page_permissions import ADMIN_CRM_SECTIONS  # noqa: E402
from cms_permissions import CMS_ACTIONS  # noqa: E402
from ptt_ui_button_permissions import CRM_UI_BUTTONS  # noqa: E402
from unified_auth import set_unified_password  # noqa: E402

POSITION_CODE = "SUPER-ADMIN"
POSITION_NAME = "Quản trị hệ thống (toàn quyền)"
PG_SUPER_ADMIN_POSITION_ID = 1

EXTRA_ACTIONS: frozenset[str] = frozenset(
    {
        "assign",
        "write",
        "settings",
        "compliance",
        "deliverability",
        "reports",
    }
)

AGGREGATE_CAPS: tuple[tuple[str, str], ...] = (
    ("dashboard", "view"),
    ("crm_board", "view"),
    ("crm_board", "edit"),
    ("crm_board", "create"),
    ("crm_email_mkt", "view"),
    ("crm_email_mkt", "write"),
    ("crm_email_mkt", "settings"),
    ("crm_email_mkt", "compliance"),
    ("crm_email_mkt", "approve"),
    ("crm_email_mkt", "deliverability"),
    ("crm_email_mkt", "reports"),
    ("crm_agency", "view"),
    ("crm_agency", "edit"),
    ("crm_agency", "create"),
    ("crm_agency", "configure"),
    ("crm_agency", "delete"),
    ("crm_agency", "export"),
    ("crm_agency", "approve"),
    ("crm_facebook_ads", "view"),
    ("crm_facebook_ads", "edit"),
    ("crm_facebook_ads", "create"),
    ("crm_facebook_ads", "configure"),
    ("meta_campaign_write", "view"),
    ("meta_campaign_write", "approve"),
    ("crm_facebook_ads", "delete"),
    ("crm_facebook_ads", "export"),
    ("crm_google_ads", "view"),
    ("crm_google_ads", "export"),
    ("crm_leads", "assign"),
)


def hash_pg_password(plain: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(plain.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    return f"scrypt:{base64.b64encode(salt).decode()}:{base64.b64encode(key).decode()}"


def build_full_caps() -> list[tuple[str, str]]:
    actions = set(CMS_ACTIONS) | set(EXTRA_ACTIONS)
    caps: set[tuple[str, str]] = set()

    for sec in ADMIN_CRM_SECTIONS:
        sid = str(sec["id"])
        for act in actions:
            caps.add((sid, act))

    for btn in CRM_UI_BUTTONS:
        caps.add((str(btn["id"]), str(btn["requires_action"])))

    caps.update(AGGREGATE_CAPS)
    return sorted(caps)


def ensure_super_admin_position(conn: sqlite3.Connection, *, ts: str) -> int:
    row = conn.execute(
        """
        SELECT id FROM crm_positions
        WHERE lower(trim(code)) = lower(trim(?)) AND active = 1
        LIMIT 1
        """,
        (POSITION_CODE,),
    ).fetchone()
    if row:
        pid = int(row[0])
        conn.execute(
            """
            UPDATE crm_positions
            SET name = ?, description = ?, grants_customized = 1, updated_at = ?
            WHERE id = ?
            """,
            (
                POSITION_NAME,
                "Toàn quyền mọi section CRM + Agency + Email + SEO (seed script).",
                ts,
                pid,
            ),
        )
        return pid

    conn.execute(
        """
        INSERT INTO crm_positions (code, name, description, sort_order, active, grants_customized, created_at, updated_at)
        VALUES (?, ?, ?, 0, 1, 1, ?, ?)
        """,
        (
            POSITION_CODE,
            POSITION_NAME,
            "Toàn quyền mọi section CRM + Agency + Email + SEO (seed script).",
            ts[:10],
            ts,
        ),
    )
    row = conn.execute(
        "SELECT id FROM crm_positions WHERE lower(trim(code)) = lower(trim(?)) LIMIT 1",
        (POSITION_CODE,),
    ).fetchone()
    return int(row[0])


def save_sqlite_caps(conn: sqlite3.Connection, position_id: int, caps: list[tuple[str, str]]) -> int:
    conn.execute(
        "DELETE FROM crm_position_section_permissions WHERE position_id = ?",
        (position_id,),
    )
    for section_id, action in caps:
        conn.execute(
            """
            INSERT OR IGNORE INTO crm_position_section_permissions (position_id, section_id, action)
            VALUES (?, ?, ?)
            """,
            (position_id, section_id, action),
        )
    return len(caps)


def ensure_cms_super_admin(
    conn: sqlite3.Connection,
    *,
    username: str,
    display_name: str,
    password: str,
    ts: str,
) -> None:
    from crm_staff_auth import hash_password

    uname = username.strip()
    row = conn.execute(
        """
        SELECT id FROM cms_admin_users
        WHERE lower(trim(username)) = lower(trim(?))
        LIMIT 1
        """,
        (uname,),
    ).fetchone()

    if row:
        conn.execute(
            """
            UPDATE cms_admin_users
            SET role_code = 'super_admin', position_id = NULL, display_name = ?, active = 1, updated_at = ?
            WHERE id = ?
            """,
            (display_name[:120], ts, int(row[0])),
        )
    else:
        ph = hash_password(password)
        conn.execute(
            """
            INSERT INTO cms_admin_users (
                username, display_name, role_code, position_id, password_hash, active, created_at, updated_at
            )
            VALUES (?, ?, 'super_admin', NULL, ?, 1, ?, ?)
            """,
            (uname, display_name[:120], ph, ts[:10], ts),
        )

    set_unified_password(conn, uname, password, updated_at=ts)


def ensure_pg_super_admin_position(cur, *, email: str) -> int:
    cur.execute(
        """
        SELECT position_id FROM staff_users
        WHERE lower(trim(email)) = lower(trim(%s))
        LIMIT 1
        """,
        (email.strip().lower(),),
    )
    row = cur.fetchone()
    if row:
        return int(row[0])
    return PG_SUPER_ADMIN_POSITION_ID


def apply_pg(
    *,
    caps: list[tuple[str, str]],
    email: str,
    display_name: str,
    password: str,
    position_id: int | None = None,
) -> None:
    from ptt_jobs.db import pg_available, pg_connection

    if not pg_available():
        raise SystemExit("PostgreSQL unavailable — set DATABASE_URL trước khi dùng --apply-pg / --pg-only")

    pwd_hash = hash_pg_password(password)
    with pg_connection() as conn:
        with conn.cursor() as cur:
            resolved_position_id = position_id or ensure_pg_super_admin_position(cur, email=email)
            cur.execute(
                """
                DELETE FROM staff_section_permissions WHERE position_id = %s
                """,
                (resolved_position_id,),
            )
            for section_id, action in caps:
                cur.execute(
                    """
                    INSERT INTO staff_section_permissions (position_id, section_id, action)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (position_id, section_id, action) DO NOTHING
                    """,
                    (resolved_position_id, section_id, action),
                )

            cur.execute(
                """
                INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (email) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    display_name = EXCLUDED.display_name,
                    position_id = EXCLUDED.position_id,
                    active = TRUE,
                    updated_at = NOW()
                RETURNING id::text
                """,
                (email.strip().lower(), pwd_hash, display_name[:255], resolved_position_id),
            )
            staff_id = cur.fetchone()[0]
        conn.commit()
    print(
        f"  PG staff_users id={staff_id} email={email.strip().lower()} "
        f"position_id={resolved_position_id}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed super admin full access (SQLite + optional PG)")
    parser.add_argument("--sqlite", default=str(ROOT / "ptt.db"), help="SQLite path")
    parser.add_argument("--username", default=os.environ.get("ADMIN_USERNAME", "admin"))
    parser.add_argument("--email", default=os.environ.get("PTT_SUPER_ADMIN_EMAIL", "admin@pttads.vn"))
    parser.add_argument("--display-name", default="Quản trị hệ thống")
    parser.add_argument(
        "--password",
        default=os.environ.get("ADMIN_PASSWORD") or os.environ.get("PTT_SUPER_ADMIN_PASSWORD"),
        help="Mật khẩu (hoặc ADMIN_PASSWORD / PTT_SUPER_ADMIN_PASSWORD)",
    )
    parser.add_argument("--apply-pg", action="store_true", help="Ghi staff_users + caps vào PostgreSQL")
    parser.add_argument(
        "--pg-only",
        action="store_true",
        help="Chỉ PostgreSQL (VPS prod — không cần ptt.db / SQLite)",
    )
    parser.add_argument(
        "--skip-sqlite",
        action="store_true",
        help="Bỏ qua SQLite legacy (kết hợp --apply-pg)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pg_only = args.pg_only or (args.apply_pg and args.skip_sqlite)
    if args.pg_only:
        args.apply_pg = True

    if not args.password or len(str(args.password)) < 8:
        print("Cần mật khẩu ≥8 ký tự: --password hoặc ADMIN_PASSWORD trong .env", file=sys.stderr)
        return 1

    caps = build_full_caps()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    mode = "PostgreSQL only" if pg_only else ("SQLite + PG" if args.apply_pg else "SQLite")
    print("=== PTT — Super admin toàn quyền ===")
    print(f"  Mode: {mode}")
    print(f"  Username (CMS legacy): {args.username}")
    print(f"  Email (ops-web): {args.email}")
    print(f"  Caps: {len(caps)} section/action pairs")

    if args.dry_run:
        print("  (dry-run — không ghi DB)")
        for section_id, action in caps[:12]:
            print(f"    {section_id}.{action}")
        print("    …")
        return 0

    position_id: int | None = None

    if pg_only:
        apply_pg(
            caps=caps,
            email=args.email,
            display_name=args.display_name,
            password=str(args.password),
        )
    else:
        db_path = Path(args.sqlite)
        if not db_path.is_file():
            print(f"SQLite not found: {db_path}", file=sys.stderr)
            print("  VPS prod: dùng --pg-only (không cần ptt.db)", file=sys.stderr)
            return 1

        print(f"  SQLite: {db_path}")
        conn = sqlite3.connect(db_path)
        try:
            position_id = ensure_super_admin_position(conn, ts=ts)
            saved = save_sqlite_caps(conn, position_id, caps)
            ensure_cms_super_admin(
                conn,
                username=args.username,
                display_name=args.display_name,
                password=str(args.password),
                ts=ts,
            )
            conn.commit()
            print(f"  SQLite position {POSITION_CODE} id={position_id} — {saved} caps")
            print(f"  SQLite cms_admin_users username={args.username} role=super_admin")
        finally:
            conn.close()

        if args.apply_pg:
            apply_pg(
                position_id=position_id,
                caps=caps,
                email=args.email,
                display_name=args.display_name,
                password=str(args.password),
            )
        else:
            print("  PG: bỏ qua (thêm --apply-pg hoặc --pg-only khi DATABASE_URL sẵn sàng)")

    print("\nĐăng nhập ops-web: https://rs.pttads.vn/login")
    print(f"  Email: {args.email}")
    print("  (Đăng xuất / đăng nhập lại nếu đang mở session cũ)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
