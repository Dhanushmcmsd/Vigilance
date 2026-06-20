#!/usr/bin/env python3
"""Copy all files from old Supabase storage bucket to new project.

Usage (Windows PowerShell):
  $env:OLD_SUPABASE_URL="https://OLD_REF.supabase.co"
  $env:OLD_SUPABASE_SERVICE_ROLE_KEY="eyJ..."
  $env:NEW_SUPABASE_URL="https://NEW_REF.supabase.co"
  $env:NEW_SUPABASE_SERVICE_ROLE_KEY="eyJ..."
  pip install supabase
  python scripts/migrate-storage.py
"""
import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("Install dependency: pip install supabase")
    sys.exit(1)

REQUIRED = [
    "OLD_SUPABASE_URL",
    "OLD_SUPABASE_SERVICE_ROLE_KEY",
    "NEW_SUPABASE_URL",
    "NEW_SUPABASE_SERVICE_ROLE_KEY",
]
missing = [k for k in REQUIRED if not os.environ.get(k)]
if missing:
    print("Missing environment variables:", ", ".join(missing))
    sys.exit(1)

BUCKET = "inspection-files"

old_sb = create_client(os.environ["OLD_SUPABASE_URL"], os.environ["OLD_SUPABASE_SERVICE_ROLE_KEY"])
new_sb = create_client(os.environ["NEW_SUPABASE_URL"], os.environ["NEW_SUPABASE_SERVICE_ROLE_KEY"])


def list_all(sb, prefix=""):
    items = sb.storage.from_(BUCKET).list(prefix or "")
    paths = []
    for item in items or []:
        name = item.get("name", "")
        path = f"{prefix}/{name}".strip("/") if prefix else name
        # Folders have null id; files have id
        if item.get("id"):
            paths.append(path)
        elif name:
            paths.extend(list_all(sb, path))
    return paths


def main():
    try:
        new_sb.storage.create_bucket(BUCKET, options={"public": False})
        print(f"Created bucket '{BUCKET}' on new project")
    except Exception:
        print(f"Bucket '{BUCKET}' already exists on new project (OK)")

    files = list_all(old_sb)
    print(f"Found {len(files)} files to migrate from '{BUCKET}'")

    ok, fail = 0, 0
    for i, path in enumerate(files, 1):
        try:
            data = old_sb.storage.from_(BUCKET).download(path)
            new_sb.storage.from_(BUCKET).upload(path, data, file_options={"upsert": "true"})
            ok += 1
            print(f"[{i}/{len(files)}] OK: {path}")
        except Exception as e:
            fail += 1
            print(f"[{i}/{len(files)}] FAIL: {path} — {e}")

    print(f"\nDone. Success: {ok}, Failed: {fail}")


if __name__ == "__main__":
    main()
