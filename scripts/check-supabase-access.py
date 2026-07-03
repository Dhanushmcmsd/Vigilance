#!/usr/bin/env python3
"""Check Supabase project access and compare migration readiness."""
from __future__ import annotations

import json
import os
import sys

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

OLD_REF = "xgwjcknpkpzsbjvuninm"
NEW_REF = "itxfffjepcdfhuzsrnwf"


def check(token: str, label: str, ref: str) -> dict | None:
    if not token:
        print(f"{label}: no token set")
        return None
    r = requests.get(
        f"https://api.supabase.com/v1/projects/{ref}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if r.status_code != 200:
        print(f"{label}: HTTP {r.status_code} — {r.text[:200]}")
        return None
    data = r.json()
    print(
        f"{label}: OK — {data.get('name')} ({data.get('id')}) "
        f"status={data.get('status')} region={data.get('region')}"
    )
    return data


def main() -> int:
    old = check(os.environ.get("OLD_SUPABASE_TOKEN", ""), "OLD (company)", OLD_REF)
    new = check(os.environ.get("NEW_SUPABASE_TOKEN", ""), "NEW (Dhanush)", NEW_REF)

    if old and new:
        print("\nBoth projects reachable. Run reverse-transfer-to-dhanush.ps1 for data migration.")
    elif new:
        print("\nDhanush project OK. Company token may be invalid (account disabled).")
        print("Use pg_dump backups from company dashboard if still accessible, or local SQL dumps.")
    else:
        print("\nFix Supabase tokens before migrating data.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
