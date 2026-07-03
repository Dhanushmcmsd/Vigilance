#!/usr/bin/env python3
"""Push local repo main branch to GitHub using the Git Data API (no git CLI required).

Usage (PowerShell):
  $env:GITHUB_TOKEN = 'github_pat_...'
  $env:GITHUB_REPO = 'Dhanushmcmsd/Vigilance'
  python scripts/push-to-github-api.py

Requires: requests (pip install requests)
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {
    ".git",
    "node_modules",
    ".expo",
    "dist",
    "build",
    ".vercel",
    "__pycache__",
}
SKIP_PREFIXES = (".deploy-", ".mcp-")
SKIP_FILES = {".env", ".env.local", ".env.production"}


def iter_files() -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [
            d
            for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(SKIP_PREFIXES)
        ]
        for name in filenames:
            if name in SKIP_FILES or name.startswith(SKIP_PREFIXES):
                continue
            p = Path(dirpath) / name
            rel = p.relative_to(ROOT).as_posix()
            files.append(p)
    return sorted(files, key=lambda p: p.relative_to(ROOT).as_posix())


def api(session: requests.Session, method: str, url: str, **kwargs):
    r = session.request(method, url, timeout=120, **kwargs)
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {url} -> {r.status_code}: {r.text[:500]}")
    if r.text:
        return r.json()
    return None


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    repo = os.environ.get("GITHUB_REPO", "Dhanushmcmsd/Vigilance").strip()
    branch = os.environ.get("GITHUB_BRANCH", "main").strip()

    if not token:
        print("Set GITHUB_TOKEN environment variable.")
        return 1

    session = requests.Session()
    session.headers.update(
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
    )
    base = f"https://api.github.com/repos/{repo}"

    ref = api(session, "GET", f"{base}/git/ref/heads/{branch}")
    base_commit_sha = ref["object"]["sha"]
    base_commit = api(session, "GET", f"{base}/git/commits/{base_commit_sha}")
    base_tree_sha = base_commit["tree"]["sha"]

    files = iter_files()
    print(f"Uploading {len(files)} files to {repo}@{branch} ...")

    tree_entries = []
    for i, path in enumerate(files, 1):
        rel = path.relative_to(ROOT).as_posix()
        data = path.read_bytes()
        if b"\0" in data[:8192]:
            print(f"  skip binary-ish: {rel}")
            continue
        blob = api(
            session,
            "POST",
            f"{base}/git/blobs",
            json={
                "content": base64.b64encode(data).decode("ascii"),
                "encoding": "base64",
            },
        )
        tree_entries.append(
            {"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]}
        )
        if i % 25 == 0 or i == len(files):
            print(f"  blobs {i}/{len(files)}")

    tree = api(
        session,
        "POST",
        f"{base}/git/trees",
        json={"base_tree": base_tree_sha, "tree": tree_entries},
    )

    head_msg_path = ROOT / ".git" / "COMMIT_EDITMSG"
    message = (
        head_msg_path.read_text(encoding="utf-8").strip()
        if head_msg_path.exists()
        else "chore: reverse transfer from vigilancecfcici account"
    )

    commit = api(
        session,
        "POST",
        f"{base}/git/commits",
        json={
            "message": message,
            "tree": tree["sha"],
            "parents": [base_commit_sha],
        },
    )

    api(
        session,
        "PATCH",
        f"{base}/git/refs/heads/{branch}",
        json={"sha": commit["sha"], "force": True},
    )

    print(f"Done. {repo}@{branch} -> {commit['sha'][:12]}")
    print(f"https://github.com/{repo}/commit/{commit['sha']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
