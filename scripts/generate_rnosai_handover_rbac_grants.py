#!/usr/bin/env python3
"""Regenerate scripts/data/rnosai_handover_rbac_grants.json from Nest catalog + matrix rules.

Usage:
  python3 scripts/generate_rnosai_handover_rbac_grants.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    # Re-run the embedded generator by importing logic from a sibling module path.
    # Keep generator body here for single-file regen.
    catalog_path = ROOT / "services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    section_actions: dict[str, list[str]] = catalog["section_actions"]
    sections = [s["id"] for s in catalog["sections"]]
    ui_buttons = catalog.get("ui_buttons") or []

    def acts(section_id: str, *wanted: str) -> list[str]:
        allowed = set(section_actions.get(section_id) or [])
        return [a for a in wanted if a in allowed]

    def view_only(*ids: str) -> dict[str, list[str]]:
        g: dict[str, list[str]] = {}
        for sid in ids:
            a = acts(sid, "view")
            if a:
                g[sid] = a
        return g

    def grant(sid: str, *actions: str) -> dict[str, list[str]]:
        a = acts(sid, *actions)
        return {sid: a} if a else {}

    def merge(*parts: dict[str, list[str]]) -> dict[str, list[str]]:
        out: dict[str, set[str]] = {}
        for part in parts:
            for sid, alist in part.items():
                out.setdefault(sid, set()).update(alist)
        return {k: sorted(v) for k, v in sorted(out.items()) if v}

    def prefix_filtered(
        prefix: str,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
    ) -> dict[str, list[str]]:
        g: dict[str, list[str]] = {}
        for sid in sections:
            if sid == prefix or sid.startswith(prefix + "."):
                allowed = section_actions.get(sid) or []
                chosen = list(allowed)
                if include is not None:
                    chosen = [a for a in chosen if a in include]
                if exclude:
                    chosen = [a for a in chosen if a not in exclude]
                if chosen:
                    g[sid] = sorted(chosen)
        return g

    board_view = view_only(
        "crm_board_funnel",
        "crm_board_workspace",
        "crm_board_kanban",
        "crm_board_playbook",
        "crm_board_customers",
        "crm_board",
        "crm_assistant",
        "crm_hdsd",
    )
    board_write = merge(
        grant("crm_board_funnel", "view"),
        grant("crm_board_workspace", "view", "edit"),
        grant("crm_board_kanban", "view", "edit", "create"),
        grant("crm_board_create", "view", "create"),
        grant("crm_board_playbook", "view"),
        grant("crm_board_customers", "view", "edit", "create"),
        grant("crm_board", "view", "edit"),
        grant("crm_assistant", "view", "create", "export"),
        grant("crm_hdsd", "view", "export"),
    )
    leads_write = merge(
        grant("crm_leads", "view", "edit", "create", "export", "assign"),
        grant("crm_lmp", "view", "edit", "create"),
    )
    leads_view = view_only("crm_leads", "crm_lmp")
    # Catalog: crm_b2b_projects = view|manage; crm_quote = view|view_all|edit|manage;
    # publish/convert = execute; catalog = view|manage.
    b2b_write = merge(
        grant("crm_b2b_projects", "view", "manage"),
        grant("crm_presales_solution", "view"),
        grant("crm_quote", "view", "edit"),
        grant("crm_quote.catalog", "view"),
        grant("crm_quote.publish", "execute"),
        grant("crm_quote.convert", "execute"),
    )
    b2b_view = view_only("crm_b2b_projects", "crm_presales_solution", "crm_quote", "crm_quote.catalog")
    solution_lead = grant("crm_presales_solution", "view", "edit", "claim", "release")
    agency_view = grant("crm_agency", "view")
    agency_write = grant("crm_agency", "view", "edit", "create", "configure", "export")
    agency_am = grant(
        "crm_agency", "view", "edit", "create", "configure", "export", "approve", "view_pii"
    )
    am_full = merge(
        grant("crm_am", "view", "view_all", "edit", "assign", "manage"),
        grant("crm_am.clients", "view", "edit"),
        grant("crm_am.onboarding", "view", "edit"),
        grant("crm_am.work", "view", "edit"),
        grant("crm_am.renewals", "view", "edit"),
        grant("crm_am.health", "view", "edit"),
        grant("crm_am.reports", "view"),
        grant("crm_am.opportunities", "view", "edit"),
        grant("crm_am.feedback", "view", "edit"),
        grant("crm_am.settings", "view", "manage"),
        grant("crm_am.finance", "view"),
    )
    am_view = merge(view_only("crm_am", "crm_am.clients", "crm_am.reports", "crm_am.health"))
    csd_admin = grant("csd", "view", "write", "assign", "manage", "admin")
    csd_manage = grant("csd", "view", "write", "assign", "manage")
    csd_write = grant("csd", "view", "write")
    ceo_tower = grant("ceo_command", "view", "act", "configure")
    dash_exec = merge(
        grant("crm_business_dashboard", "view", "export", "configure"),
        grant("crm_owner_weekly_dashboard", "view", "export", "configure"),
        grant("ai_forecast", "view"),
        grant("ai_analytics", "query"),
    )
    dash_view = view_only("crm_business_dashboard", "crm_owner_weekly_dashboard")
    kpi_view = merge(
        view_only(
            "crm_kpi_hub",
            "crm_kpi_dictionary",
            "crm_kpi_alerts",
            "crm_kpi_chart",
            "crm_kpi_metrics",
            "crm_kpi_records",
            "crm_kpi_groups",
            "crm_kpi_types",
            "crm_staff_kpi_am_sp",
        ),
        grant("crm_kpi_hub_reports", "view"),
        grant("crm_kpi_hub_targets", "view"),
        grant("crm_kpi_hub_sources", "view"),
        grant("crm_kpi_quality", "view"),
    )
    kpi_write = merge(
        kpi_view,
        grant("crm_kpi_records", "view", "edit", "create"),
        grant("crm_kpi_hub_targets", "view", "manage"),
        grant("crm_kpi_hub_reports", "view", "send"),
        grant("crm_daily_work_report", "view", "edit", "create", "export"),
        grant("crm_payroll_attendance", "view"),
    )
    revops_view = merge(
        view_only("crm_revops", "crm_revops.pipeline", "crm_revops.reports"),
        grant("crm_revops", "view", "view_team"),
    )
    revops_lead = merge(
        grant("crm_revops", "view", "view_all"),
        view_only(
            "crm_revops.pipeline", "crm_revops.sla", "crm_revops.reports", "crm_revops.territory"
        ),
    )
    finance_view = merge(view_only("crm_quote.finance"), grant("crm_am.finance", "view"))
    delivery_write = merge(
        grant("crm_delivery_projects", "view", "edit", "manage"),
        grant("crm_delivery_budget", "view", "edit"),
        grant("crm_board", "view", "edit"),
        grant("crm_sop_runs", "view", "edit", "create"),
        grant("crm_sop_templates", "view"),
        grant("crm_sop_overdue", "view"),
    )
    delivery_view = view_only(
        "crm_delivery_projects", "crm_delivery_budget", "crm_board", "crm_sop_runs"
    )
    ads_write = merge(
        grant("crm_facebook_ads", "view", "edit", "create", "configure"),
        grant("meta_ads_ops", "view", "edit"),
        grant("meta_campaign_write", "view", "approve"),
        grant("crm_google_ads", "view", "export"),
        grant("crm_zalo_ads", "view", "edit"),
    )
    ads_view = view_only("crm_facebook_ads", "meta_ads_ops", "crm_google_ads", "crm_zalo_ads")
    ads_mc = merge(
        grant("crm_facebook_ads", "view", "edit", "create"),
        grant("meta_ads_ops", "view", "edit"),
        grant("meta_campaign_write", "view"),
        view_only("crm_google_ads", "crm_zalo_ads"),
    )
    ads_ds = merge(
        grant("crm_facebook_ads", "view", "edit"),
        grant("meta_ads_ops", "view", "edit"),
        grant("meta_campaign_write", "view"),
    )
    seo_write = merge(
        grant("crm_seo_aeo", "view", "edit", "create", "export"),
        grant("crm_seo_aeo_write", "view", "edit", "create"),
        grant("crm_seo_aeo_technical", "view", "edit", "create"),
        grant("crm_seo_aeo_settings", "view", "edit", "configure"),
        grant("crm_seo_aeo_reports", "view", "export"),
    )
    seo_approve = merge(
        seo_write,
        grant("crm_seo_aeo", "view", "edit", "create", "approve", "configure", "export"),
        grant("crm_seo_aeo_approve", "approve"),
    )
    seo_view = view_only("crm_seo_aeo", "crm_seo_aeo_reports", "crm_seo_aeo_technical")
    seo_am = merge(
        seo_view,
        grant("crm_seo_aeo_settings", "view", "edit", "configure"),
        grant("crm_seo_aeo_reports", "view", "export"),
    )
    email_write = grant("crm_email_mkt", "view", "write", "settings", "reports")
    email_approve = grant(
        "crm_email_mkt",
        "view",
        "write",
        "settings",
        "compliance",
        "approve",
        "deliverability",
        "reports",
    )
    email_view = grant("crm_email_mkt", "view", "reports")
    content_write = grant(
        "crm_content", "view", "write", "production", "publish", "generate", "qa", "assign"
    )
    content_approve = grant(
        "crm_content",
        "view",
        "write",
        "production",
        "publish",
        "generate",
        "qa",
        "assign",
        "approve_internal",
        "admin",
    )
    content_view = grant("crm_content", "view")
    media_write = prefix_filtered("crm_media")
    media_view = prefix_filtered("crm_media", include={"view"})
    cp_ds = prefix_filtered("crm_cp", exclude={"approve_legal"})
    img_ds = prefix_filtered("crm_img", exclude={"admin"})
    cp_ml = prefix_filtered("crm_cp")
    img_ml = prefix_filtered("crm_img")
    vd_write: dict[str, list[str]] = {}
    for sid in sections:
        if not sid.startswith("crm_vd."):
            continue
        allowed = section_actions.get(sid) or []
        if sid in ("crm_vd.gate1", "crm_vd.gate2", "crm_vd.gate3"):
            vd_write[sid] = sorted([a for a in allowed if a in ("view", "edit", "approve")])
        elif sid == "crm_vd.admin":
            vd_write[sid] = sorted([a for a in allowed if a in ("view", "create")])
        else:
            vd_write[sid] = sorted([a for a in allowed if a in ("view", "edit", "create")])
    vd_approve = dict(vd_write)
    vd_view = {
        sid: ["view"]
        for sid in sections
        if sid.startswith("crm_vd.") and "view" in (section_actions.get(sid) or [])
    }
    research_write = grant("crm_research", "view", "create", "edit", "run", "export")
    research_approve = grant("crm_research", "view", "create", "edit", "run", "export", "approve")
    research_view = grant("crm_research", "view")
    mktplan_write = grant("crm_mktplan", "view", "edit", "create", "export")
    mktplan_view = grant("crm_mktplan", "view")
    hub_write = merge(
        grant("crm_hub_campaigns", "view", "edit", "create"),
        grant("crm_hub_contracts", "view", "edit"),
        grant("crm_hub_reminders", "view", "edit", "create"),
    )
    hub_view = view_only("crm_hub_campaigns", "crm_hub_contracts", "crm_hub_reminders")
    automation_lead = merge(
        grant("automation_workflows", "view", "edit", "create", "configure", "simulate"),
        grant("playbooks", "view", "edit", "create"),
        # Catalog: view|generate|export|approve (no "edit")
        grant("crm_mkt_ai", "view", "generate", "export"),
    )
    automation_view = view_only("automation_workflows", "playbooks")
    gtm_write = merge(
        grant("gtm_demos", "view", "edit", "create"), grant("gtm.cms", "view", "edit", "create")
    )
    sales_view = view_only(
        "crm_sales_overview",
        "crm_sales_funnel",
        "crm_sales_reports",
        "crm_sales_deals",
        "crm_sales_prospects",
    )
    sales_write = merge(
        grant("crm_sales_overview", "view", "export"),
        grant("crm_sales_funnel", "view", "export"),
        grant("crm_sales_market", "view", "edit", "create"),
        grant("crm_sales_deals", "view", "edit", "create"),
        grant("crm_sales_prospects", "view", "edit", "create"),
        grant("crm_sales_reports", "view", "export"),
    )
    iwr_exec = grant(
        "iwr", "view", "write", "export", "lists", "manage", "review", "schedule", "executive"
    )
    iwr_write = grant("iwr", "view", "write", "export", "review")
    iwr_view = grant("iwr", "view", "write")
    hr_view = view_only(
        "crm_staff_roster", "crm_staff_departments", "crm_staff_positions", "crm_hr_leave"
    )

    roles = {
        "CEO": merge(
            ceo_tower,
            csd_admin,
            dash_exec,
            kpi_view,
            revops_lead,
            finance_view,
            agency_view,
            am_view,
            hub_view,
            # Create/assign any lead + view_all via gdkd (Admin/CEO desk).
            leads_write,
            b2b_write,
            board_view,
            delivery_view,
            ads_view,
            seo_view,
            email_view,
            content_view,
            media_view,
            research_view,
            mktplan_view,
            sales_view,
            automation_view,
            iwr_exec,
            hr_view,
            grant("crm_gdkd", "view", "assign", "review_queue", "view_all_leads"),
            view_only("crm_presales_solution"),
        ),
        # Matrix AE: leads write (no assign — không GDKD-bypass) · B2B · quote/HĐ view · CSD · agency.
        # Quote/Proposal/HĐ create stays with AM/CEO/GĐKD — AE xem, PDF/email, trả lại, advance status.
        "AE": merge(
            csd_write,
            grant("crm_leads", "view", "edit", "create", "export"),
            grant("crm_lmp", "view", "edit", "create"),
            grant("crm_b2b_projects", "view", "manage"),
            grant("crm_presales_solution", "view"),
            grant("crm_quote", "view"),
            grant("crm_quote.catalog", "view"),
            grant("crm_hub_contracts", "view", "export"),
            agency_view,
            grant("crm_hdsd", "view", "export"),
        ),
        "ACM": merge(
            csd_write,
            leads_write,
            b2b_write,
            agency_am,
            am_full,
            board_write,
            kpi_write,
            revops_view,
            ads_write,
            seo_am,
            email_view,
            content_view,
            media_view,
            research_write,
            mktplan_view,
            delivery_write,
            sales_write,
            hub_write,
            automation_view,
            iwr_write,
            finance_view,
            grant("crm_quote", "view", "edit", "create", "export"),
            grant("crm_quote.publish", "view"),
            grant("crm_quote.convert", "view"),
            grant("crm_quote.catalog", "view", "edit"),
            grant("meta_campaign_write", "view"),
            grant("crm_hdsd", "view", "export"),
            grant("crm_presales_solution", "view"),
        ),
        "CE": merge(
            csd_write,
            content_write,
            seo_write,
            email_write,
            hub_write,
            content_view,
            kpi_view,
            agency_view,
            board_view,
            iwr_view,
            grant("crm_mkt_ai", "view", "generate", "export"),
            gtm_write,
            mktplan_view,
            research_view,
            view_only("crm_cp", "crm_facebook_ads", "crm_sop_runs"),
            grant("crm_hdsd", "view", "export"),
        ),
        "MEP": merge(
            csd_write,
            media_write,
            vd_write,
            content_write,
            ads_mc,
            kpi_view,
            agency_view,
            board_view,
            iwr_view,
            delivery_view,
            prefix_filtered(
                "crm_cp", include={"view", "edit", "create", "render", "publish", "brand"}
            ),
            grant("crm_hdsd", "view", "export"),
        ),
        "GD": merge(
            csd_write,
            cp_ds,
            img_ds,
            ads_ds,
            content_view,
            media_view,
            vd_view,
            kpi_view,
            agency_view,
            board_view,
            iwr_view,
            grant("crm_hdsd", "view", "export"),
        ),
        "MKL": merge(
            csd_manage,
            hub_write,
            solution_lead,
            agency_write,
            seo_approve,
            email_approve,
            content_approve,
            cp_ml,
            img_ml,
            vd_approve,
            media_write,
            ads_write,
            research_approve,
            mktplan_write,
            delivery_write,
            kpi_write,
            automation_lead,
            leads_view,
            b2b_view,
            board_view,
            sales_view,
            dash_view,
            revops_view,
            iwr_write,
            gtm_write,
            # Catalog actions: view|generate|export|approve (no "edit")
            grant("crm_mkt_ai", "view", "generate", "export", "approve"),
            grant("crm_hdsd", "view", "export"),
        ),
        "PD": merge(
            csd_manage,
            research_write,
            mktplan_write,
            delivery_write,
            kpi_write,
            b2b_write,
            solution_lead,
            agency_view,
            am_view,
            hub_view,
            dash_view,
            ads_view,
            seo_view,
            email_view,
            content_view,
            media_view,
            vd_view,
            automation_lead,
            revops_lead,
            sales_view,
            board_view,
            iwr_write,
            hr_view,
            grant("ceo_command", "view"),
            grant("crm_hdsd", "view", "export"),
        ),
    }
    roles["KD-01"] = roles["ACM"]
    roles["MKT-01"] = roles["MKL"]
    roles["MKT-02"] = merge(roles["CE"], roles["MEP"])

    def expand_buttons(grants: dict[str, list[str]]) -> dict[str, list[str]]:
        out = dict(grants)
        for btn in ui_buttons:
            bid = btn["id"]
            parent = btn["parent_section"]
            req = btn["requires_action"]
            if req in set(out.get(parent) or []):
                out[bid] = [req]
        return out

    roles = {code: expand_buttons(g) for code, g in roles.items()}
    doc = {
        "meta": {
            "version": "1.0",
            "date": "2026-09-16",
            "source": "docs/exports/ma-tran-phan-quyen-RNOSAI-ban-giao-2026-09-16.md",
            "catalog_version": catalog.get("version"),
            "notes": "Portal Client is not a staff position — skipped. SUPER-ADMIN uses full catalog sync separately.",
            "position_codes": sorted(roles.keys()),
        },
        "grants_by_position": roles,
    }
    out1 = ROOT / "scripts/data/rnosai_handover_rbac_grants.json"
    out2 = (
        ROOT
        / "services/ptt-crm-api/src/staff-permissions/data/rnosai_handover_rbac_grants.json"
    )
    text = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    out1.parent.mkdir(parents=True, exist_ok=True)
    out2.parent.mkdir(parents=True, exist_ok=True)
    out1.write_text(text, encoding="utf-8")
    out2.write_text(text, encoding="utf-8")
    for code, g in roles.items():
        n = sum(len(v) for v in g.values())
        print(f"{code}: {len(g)} sections, {n} caps")
    print("wrote", out1)
    print("wrote", out2)
    # Also refresh SQL companion for VPS without psycopg2
    subprocess.check_call(
        [sys.executable, str(ROOT / "scripts/export_rnosai_handover_rbac_sql.py")],
        cwd=str(ROOT),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
