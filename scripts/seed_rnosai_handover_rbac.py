#!/usr/bin/env python3
"""Seed staff_section_permissions from bàn giao matrix (2026-09-16).

Applies grants in scripts/data/rnosai_handover_rbac_grants.json onto PostgreSQL
crm_positions that exist (CEO, AE, ACM, CE, MEP, GD, MKL, PD, …).

SUPER-ADMIN is refreshed from Nest catalog actions (full access).
Portal Client is not a staff position — skipped.

Usage (VPS):
  set -a && source .env && set +a
  python3 scripts/seed_rnosai_handover_rbac.py            # dry-run
  python3 scripts/seed_rnosai_handover_rbac.py --apply     # write + sync
  python3 scripts/seed_rnosai_handover_rbac.py --apply --codes CEO,ACM
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from rbac_permissions_pg import (  # noqa: E402
    PG_SUPER_ADMIN_POSITION_ID,
    ensure_super_admin_crm_position,
    fetch_position_id,
    require_pg,
    sync_super_admin_missing_caps,
)

DEFAULT_JSON = ROOT / "scripts" / "data" / "rnosai_handover_rbac_grants.json"
NEST_JSON = (
    ROOT
    / "services"
    / "ptt-crm-api"
    / "src"
    / "staff-permissions"
    / "data"
    / "rnosai_handover_rbac_grants.json"
)
CATALOG_JSON = (
    ROOT
    / "services"
    / "ptt-crm-api"
    / "src"
    / "staff-permissions"
    / "rbac-admin-catalog.json"
)

HANDOVER_CODES = ("CEO", "AE", "ACM", "CE", "MEP", "GD", "MKL", "PD")


def load_doc(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(f"Missing grants file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def grants_to_rows(grants: dict[str, list[str]]) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for section_id, actions in grants.items():
        for action in actions:
            a = str(action or "").strip().lower()
            if section_id and a:
                rows.append((str(section_id), a))
    return rows


def replace_position_grants(
    cur,
    *,
    position_id: int,
    code: str,
    grants: dict[str, list[str]],
    dry_run: bool,
) -> tuple[int, int]:
    rows = grants_to_rows(grants)
    desired = set(rows)
    cur.execute(
        "SELECT section_id, action FROM staff_section_permissions WHERE position_id = %s",
        (position_id,),
    )
    current = {(str(r[0]), str(r[1])) for r in cur.fetchall()}
    to_add = desired - current
    to_del = current - desired
    if dry_run:
        print(
            f"DRY  {code} position_id={position_id} "
            f"keep={len(desired & current)} add={len(to_add)} del={len(to_del)} total={len(desired)}"
        )
        return len(to_add), len(to_del)

    cur.execute("DELETE FROM staff_section_permissions WHERE position_id = %s", (position_id,))
    for section_id, action in sorted(desired):
        cur.execute(
            """
            INSERT INTO staff_section_permissions (position_id, section_id, action)
            VALUES (%s, %s, %s)
            ON CONFLICT (position_id, section_id, action) DO NOTHING
            """,
            (position_id, section_id, action),
        )
    cur.execute(
        """
        UPDATE crm_positions
        SET grants_customized = TRUE, updated_at = NOW()
        WHERE id = %s
        """,
        (position_id,),
    )
    cur.execute(
        """
        INSERT INTO staff_permission_audit (actor_email, position_id, diff_json)
        VALUES (%s, %s, %s::jsonb)
        """,
        (
            "seed_rnosai_handover_rbac.py",
            position_id,
            json.dumps(
                {
                    "source": "rnosai_handover_rbac_grants.json",
                    "position_code": code,
                    "added": sorted(f"{s}.{a}" for s, a in to_add),
                    "removed": sorted(f"{s}.{a}" for s, a in to_del),
                },
                ensure_ascii=False,
            ),
        ),
    )
    print(
        f"OK   {code} position_id={position_id} "
        f"caps={len(desired)} add={len(to_add)} del={len(to_del)}"
    )
    return len(to_add), len(to_del)


def build_full_catalog_grants() -> dict[str, list[str]]:
    catalog = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    section_actions: dict[str, list[str]] = catalog.get("section_actions") or {}
    grants: dict[str, list[str]] = {
        sid: sorted(set(acts)) for sid, acts in section_actions.items() if acts
    }
    for btn in catalog.get("ui_buttons") or []:
        bid = str(btn.get("id") or "")
        req = str(btn.get("requires_action") or "").strip().lower()
        if bid and req:
            grants[bid] = [req]
    return grants


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed bàn giao RBAC onto PostgreSQL")
    parser.add_argument("--apply", action="store_true", help="Write to PG")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--json",
        type=Path,
        default=None,
        help="Path to rnosai_handover_rbac_grants.json",
    )
    parser.add_argument(
        "--codes",
        default="",
        help="Comma-separated position codes (default: handover 8 + SUPER-ADMIN)",
    )
    parser.add_argument(
        "--skip-super-admin",
        action="store_true",
        help="Do not refresh SUPER-ADMIN full catalog caps",
    )
    args = parser.parse_args()
    dry_run = args.dry_run or not args.apply

    require_pg()
    path = args.json or (DEFAULT_JSON if DEFAULT_JSON.is_file() else NEST_JSON)
    doc = load_doc(path)
    by_pos: dict[str, dict[str, list[str]]] = doc.get("grants_by_position") or {}

    if args.codes.strip():
        codes = [c.strip() for c in args.codes.split(",") if c.strip()]
    else:
        codes = list(HANDOVER_CODES)

    print("=== seed_rnosai_handover_rbac ===")
    print(f"  file: {path}")
    print(f"  mode: {'dry-run' if dry_run else 'apply'}")
    print(f"  codes: {', '.join(codes)}")

    from ptt_jobs.db import pg_connection

    total_add = total_del = 0
    missing: list[str] = []
    with pg_connection() as conn:
        with conn.cursor() as cur:
            ensure_super_admin_crm_position(cur, dry_run=dry_run)

            if not args.skip_super_admin:
                if dry_run:
                    full = build_full_catalog_grants()
                    print(
                        f"DRY  SUPER-ADMIN would sync full catalog "
                        f"sections={len(full)} caps={sum(len(v) for v in full.values())}"
                    )
                else:
                    # Upsert missing catalog caps, then optionally full replace for UI parity
                    added, _checked = sync_super_admin_missing_caps(
                        cur, position_id=PG_SUPER_ADMIN_POSITION_ID, dry_run=False
                    )
                    full = build_full_catalog_grants()
                    a, d = replace_position_grants(
                        cur,
                        position_id=PG_SUPER_ADMIN_POSITION_ID,
                        code="SUPER-ADMIN",
                        grants=full,
                        dry_run=False,
                    )
                    total_add += a + added
                    total_del += d

            for code in codes:
                if code.upper() == "SUPER-ADMIN":
                    continue
                grants = by_pos.get(code) or by_pos.get(code.upper()) or by_pos.get(code.lower())
                if not grants:
                    print(f"WARN skip {code} — not in grants JSON", file=sys.stderr)
                    continue
                pid = fetch_position_id(cur, code)
                if pid is None:
                    missing.append(code)
                    print(f"WARN skip {code} — not in crm_positions", file=sys.stderr)
                    continue
                a, d = replace_position_grants(
                    cur, position_id=pid, code=code, grants=grants, dry_run=dry_run
                )
                total_add += a
                total_del += d

        if not dry_run:
            conn.commit()

    if missing:
        print(f"Missing positions on DB: {', '.join(missing)}")
    print(f"Done — add≈{total_add} del≈{total_del}")
    if dry_run:
        print("Run with --apply to write.")
    else:
        print("OK — mở Admin → Phân quyền để xem ma trận; user cần đăng xuất/đăng nhập.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
