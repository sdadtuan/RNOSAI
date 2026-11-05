#!/usr/bin/env python3
"""One-shot: CRM_FACEBOOK_PAGE_ACCESS_TOKEN (User) → Page token. Never prints secrets."""
from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_PATH = Path(os.environ.get("PTT_ENV_PATH", "/var/www/rnosai/.env"))
PAGE_ID = os.environ.get("PTT_FB_PAGE_ID", "1222371747615610")
KEY = "CRM_FACEBOOK_PAGE_ACCESS_TOKEN"
VERSION = os.environ.get("CRM_FACEBOOK_GRAPH_VERSION", "v19.0")


def load_env(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


def env_value(lines: list[str], key: str) -> str:
    for line in lines:
        s = line.strip()
        if s.startswith(f"{key}="):
            return s.split("=", 1)[1].strip().strip("\"'")
    return ""


def graph(path: str, token: str, fields: str) -> tuple[int, dict]:
    q = urllib.parse.urlencode({"fields": fields, "access_token": token, "limit": "50"})
    url = f"https://graph.facebook.com/{VERSION}/{path}?{q}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8", "replace") or "{}")
        err = body.get("error") or {}
        return e.code, {
            "error_code": err.get("code"),
            "error_type": err.get("type"),
            "error_msg": str(err.get("message") or "")[:220],
        }


def pick_page_token(user_token: str) -> str:
    st, page = graph(PAGE_ID, user_token, "id,name,access_token")
    print(f"page_node status={st} id={page.get('id')} name={page.get('name')} err={page.get('error_msg', '')}")
    tok = str(page.get("access_token") or "").strip()
    if tok:
        print("source=page_node")
        return tok

    st, accounts = graph("me/accounts", user_token, "id,name,access_token")
    if accounts.get("error_msg"):
        print(f"accounts status={st} err={accounts.get('error_msg')}")
        return ""
    rows = accounts.get("data") or []
    print(f"accounts status={st} pages={len(rows)}")
    for row in rows:
        print(f"  page {row.get('id')} {row.get('name')} token={'yes' if row.get('access_token') else 'no'}")
        if str(row.get("id") or "") == PAGE_ID and str(row.get("access_token") or "").strip():
            print("source=me_accounts")
            return str(row["access_token"]).strip()
    return ""


def write_env(lines: list[str], key: str, value: str) -> list[str]:
    out: list[str] = []
    found = False
    for line in lines:
        if line.strip().startswith(f"{key}="):
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{key}={value}")
    return out


def main() -> int:
    if not ENV_PATH.is_file():
        print(f"missing {ENV_PATH}")
        return 1
    lines = load_env(ENV_PATH)
    user_token = env_value(lines, KEY)
    print(f"env_token_len={len(user_token)}")
    if not user_token:
        print("missing CRM_FACEBOOK_PAGE_ACCESS_TOKEN")
        return 1

    st, me = graph("me", user_token, "id,name")
    print(f"me status={st} id={me.get('id')} name={me.get('name')} err={me.get('error_msg', '')}")
    if me.get("error_msg"):
        return 1

    page_token = pick_page_token(user_token)
    if not page_token:
        print("FAIL exchange: token cannot see Page / no access_token on accounts")
        return 2

    print(f"page_token_len={len(page_token)} same_as_user={page_token == user_token}")

    st, forms = graph(f"{PAGE_ID}/leadgen_forms", page_token, "id,name,status")
    if forms.get("error_msg"):
        print(f"leadgen_forms err={forms.get('error_msg')}")
    else:
        rows = forms.get("data") or []
        print(f"leadgen_forms count={len(rows)}")
        for row in rows[:15]:
            print(f"  form {row.get('id')} {row.get('name')} {row.get('status')}")

    bak = ENV_PATH.with_suffix(".env.bak-page-token")
    shutil.copy2(ENV_PATH, bak)
    new_lines = write_env(lines, KEY, page_token)
    text = "\n".join(new_lines)
    if not text.endswith("\n"):
        text += "\n"
    ENV_PATH.write_text(text, encoding="utf-8")
    print(f"wrote {ENV_PATH} backup={bak} bytes={ENV_PATH.stat().st_size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
