#!/usr/bin/env python3
"""Read CRM_FACEBOOK_PAGE_ACCESS_TOKEN and probe Graph. Never prints secrets."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV = Path("/var/www/rnosai/.env")
PAGE_ID = "1222371747615610"
FORM_ID = "1062082956684532"
KEY = "CRM_FACEBOOK_PAGE_ACCESS_TOKEN"
VERSION = "v19.0"


def graph(token: str, path: str, fields: str | None = None, extra: dict | None = None) -> tuple[int, dict]:
    q: dict[str, str] = {"access_token": token}
    if fields:
        q["fields"] = fields
    if extra:
        q.update(extra)
    url = f"https://graph.facebook.com/{VERSION}/{path}?{urllib.parse.urlencode(q)}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8", "replace") or "{}")
        err = body.get("error") or {}
        return e.code, {
            "error_code": err.get("code"),
            "error_subcode": err.get("error_subcode"),
            "error_type": err.get("type"),
            "error_msg": str(err.get("message") or "")[:280],
        }


def main() -> int:
    st = ENV.stat()
    print(
        f"env_bytes={st.st_size} mtime_utc="
        f"{time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(st.st_mtime))}"
    )

    token = ""
    for line in ENV.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if s.startswith(f"{KEY}="):
            token = s.split("=", 1)[1].strip().strip("\"'")
            break
    print(f"token_len={len(token)}")
    if not token:
        print("MISSING_TOKEN")
        return 1

    status, me = graph(token, "me", "id,name")
    print(f"me status={status} id={me.get('id')} name={me.get('name')} err={me.get('error_msg', '')}")

    status, page = graph(token, PAGE_ID, "id,name,access_token")
    print(
        f"page status={status} id={page.get('id')} name={page.get('name')} "
        f"has_page_token={'yes' if page.get('access_token') else 'no'} err={page.get('error_msg', '')}"
    )

    status, acc = graph(token, "me/accounts", "id,name,access_token", {"limit": "50"})
    rows: list = []
    if acc.get("error_msg"):
        print(f"accounts status={status} err={acc.get('error_msg')}")
    else:
        rows = acc.get("data") or []
        print(f"accounts status={status} pages={len(rows)}")
        for row in rows[:20]:
            print(
                f"  page {row.get('id')} {row.get('name')} "
                f"token={'yes' if row.get('access_token') else 'no'}"
            )

    page_token = ""
    if page.get("access_token"):
        page_token = str(page["access_token"]).strip()
        print("page_token_source=page_node")
    else:
        for row in rows:
            if str(row.get("id") or "") == PAGE_ID and row.get("access_token"):
                page_token = str(row["access_token"]).strip()
                print("page_token_source=me_accounts")
                break
    if not page_token:
        page_token = token
        print("page_token_source=env_as_is")
    print(f"using_token_len={len(page_token)} same_as_env={page_token == token}")

    status, perms = graph(token, "me/permissions")
    if perms.get("error_msg"):
        print(f"permissions err={perms.get('error_msg')}")
    else:
        granted = [
            p.get("permission")
            for p in (perms.get("data") or [])
            if p.get("status") == "granted"
        ]
        print(f"granted_perms={','.join(granted) if granted else '(none)'}")

    status, forms = graph(page_token, f"{PAGE_ID}/leadgen_forms", "id,name,status", {"limit": "50"})
    if forms.get("error_msg"):
        print(f"leadgen_forms status={status} err={forms.get('error_msg')}")
    else:
        form_rows = forms.get("data") or []
        print(f"leadgen_forms status={status} count={len(form_rows)}")
        hit = False
        for row in form_rows:
            mark = "*" if str(row.get("id")) == FORM_ID else " "
            print(f" {mark} form {row.get('id')} {row.get('name')} {row.get('status')}")
            if str(row.get("id")) == FORM_ID:
                hit = True
        print(f"mapped_form_visible={'yes' if hit else 'no'}")

    status, leads = graph(page_token, f"{FORM_ID}/leads", extra={"limit": "5"})
    if leads.get("error_msg"):
        print(f"form_leads status={status} err={leads.get('error_msg')}")
    else:
        print(f"form_leads status={status} count={len(leads.get('data') or [])}")

    status, form = graph(page_token, FORM_ID, "id,name,status,locale")
    print(
        f"form_node status={status} id={form.get('id')} name={form.get('name')} "
        f"status_field={form.get('status')} err={form.get('error_msg', '')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
