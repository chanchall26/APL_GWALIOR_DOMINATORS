#!/usr/bin/env python3
"""
Firebase auto-setup for CricCoach.

One command does everything: creates the project, enables Firestore,
deploys security rules, registers a web app, fetches the SDK config,
and writes the 6 NEXT_PUBLIC_FIREBASE_* vars to .env.local.

The ONLY manual step is signing into Google when your browser opens.

  py firebase_setup.py                         # auto-generated project id
  py firebase_setup.py --project-id criccoach-apl-yourname
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import string
import subprocess
import sys
from pathlib import Path

# Windows console: force UTF-8 so emoji/box-drawing render
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parent
SHELL = os.name == "nt"

USE_COLOR = sys.stdout.isatty()


def c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text


def step(msg: str) -> None:
    print(c("36;1", f"\n→ {msg}"))


def ok(msg: str) -> None:
    print(c("32", f"  ✓ {msg}"))


def warn(msg: str) -> None:
    print(c("33", f"  ⚠ {msg}"))


def fail(msg: str) -> None:
    print(c("31;1", f"  ✗ {msg}"))


RULES = """rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tinder-profiles/{doc} {
      allow read, write: if true;
    }
  }
}
"""


def cli(args: list[str], *, capture: bool = True, timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(
        args,
        cwd=ROOT,
        shell=SHELL,
        capture_output=capture,
        text=True,
        timeout=timeout,
    )


def check_cli() -> None:
    step("Checking firebase-tools")
    r = cli(["firebase", "--version"], timeout=20)
    if r.returncode != 0:
        warn("firebase-tools not found — installing globally...")
        install = cli(["npm", "install", "-g", "firebase-tools"], capture=False, timeout=600)
        if install.returncode != 0:
            fail("npm install -g firebase-tools failed.")
            sys.exit(1)
        r = cli(["firebase", "--version"], timeout=20)
    ok(f"firebase-tools {r.stdout.strip()}")


def ensure_login() -> None:
    step("Checking Firebase login")
    r = cli(["firebase", "login:list"], timeout=20)
    output = (r.stdout or "") + (r.stderr or "")
    if "No authorized accounts" in output or "@" not in output:
        warn("Not signed in. A browser tab will open for Google sign-in.")
        warn("Complete the sign-in, then control returns to this script.")
        # Foreground (interactive) — this opens the browser and waits for callback
        login = subprocess.run(["firebase", "login"], cwd=ROOT, shell=SHELL)
        if login.returncode != 0:
            fail("firebase login failed.")
            sys.exit(1)
    ok("Signed in")


def create_project(preferred_id: str | None) -> str:
    step("Creating Firebase project")
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    project_id = preferred_id or f"criccoach-apl-{suffix}"

    r = cli(
        ["firebase", "projects:create", project_id, "--display-name", "CricCoach APL"],
        timeout=120,
    )
    combined = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0:
        ok(f"Created project: {project_id}")
    elif "already exists" in combined.lower() or "id is already" in combined.lower():
        warn(f"Project '{project_id}' already exists — reusing it (must be yours).")
    else:
        fail("projects:create failed:")
        print(combined)
        sys.exit(1)
    return project_id


def create_firestore(project_id: str) -> None:
    step("Creating Firestore database (asia-south1)")
    r = cli(
        [
            "firebase",
            "firestore:databases:create",
            "(default)",
            "--location",
            "asia-south1",
            "--project",
            project_id,
        ],
        timeout=180,
    )
    combined = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0 or "already exists" in combined.lower():
        ok("Firestore database ready")
        return

    warn("Auto-create failed. This usually means Cloud APIs need a 1-click enable.")
    print(combined)
    print()
    print(c("33", "Open this URL → click 'Create database' → 'Production mode' → asia-south1:"))
    print(c("33;1", f"  https://console.firebase.google.com/project/{project_id}/firestore"))
    try:
        input(c("36", "  Press Enter once the database is created..."))
    except KeyboardInterrupt:
        sys.exit(1)


def deploy_rules(project_id: str) -> None:
    step("Deploying Firestore security rules")
    (ROOT / "firestore.rules").write_text(RULES, encoding="utf-8")

    fb_path = ROOT / "firebase.json"
    if fb_path.exists():
        try:
            fb_config = json.loads(fb_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            fb_config = {}
    else:
        fb_config = {}
    fb_config.setdefault("firestore", {})["rules"] = "firestore.rules"
    fb_path.write_text(json.dumps(fb_config, indent=2), encoding="utf-8")

    r = cli(
        ["firebase", "deploy", "--only", "firestore:rules", "--project", project_id],
        timeout=180,
    )
    if r.returncode != 0:
        warn("Rules deploy failed — set them by hand in the console if needed:")
        print((r.stdout or "") + (r.stderr or ""))
    else:
        ok("Rules deployed (tinder-profiles is read+write public)")


def create_web_app(project_id: str) -> str:
    step("Creating web app")
    # Reuse if any web app already exists on this project
    listing = cli(
        ["firebase", "apps:list", "WEB", "--project", project_id, "--json"],
        timeout=60,
    )
    if listing.returncode == 0:
        try:
            data = json.loads(listing.stdout)
            apps = data.get("result", [])
            if apps:
                app_id = apps[0].get("appId")
                if app_id:
                    ok(f"Reusing existing web app {app_id}")
                    return app_id
        except Exception:
            pass

    r = cli(
        ["firebase", "apps:create", "WEB", "CricCoach Web", "--project", project_id, "--json"],
        timeout=120,
    )
    if r.returncode != 0:
        fail("apps:create failed:")
        print((r.stdout or "") + (r.stderr or ""))
        sys.exit(1)
    try:
        data = json.loads(r.stdout)
        app_id = data.get("result", {}).get("appId") or data.get("appId")
        if not app_id:
            raise ValueError("appId missing from response")
        ok(f"Created web app: {app_id}")
        return app_id
    except Exception as e:
        fail(f"Couldn't parse apps:create output ({e}):")
        print(r.stdout)
        sys.exit(1)


def get_sdk_config(project_id: str, app_id: str) -> dict:
    step("Fetching SDK config")
    r = cli(
        ["firebase", "apps:sdkconfig", "WEB", app_id, "--project", project_id, "--json"],
        timeout=60,
    )
    if r.returncode != 0:
        fail("apps:sdkconfig failed:")
        print((r.stdout or "") + (r.stderr or ""))
        sys.exit(1)
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        fail("Couldn't parse SDK config JSON:")
        print(r.stdout)
        sys.exit(1)
    config = data.get("result", {}).get("sdkConfig") or data.get("sdkConfig", {})
    if not config.get("apiKey"):
        fail("SDK config missing apiKey — full response:")
        print(json.dumps(data, indent=2))
        sys.exit(1)
    ok(f"Config received (apiKey ends ...{config['apiKey'][-4:]})")
    return config


def write_env(config: dict) -> None:
    step("Writing to .env.local")
    env_path = ROOT / ".env.local"
    existing = env_path.read_text(encoding="utf-8") if env_path.exists() else ""

    mapping = {
        "NEXT_PUBLIC_FIREBASE_API_KEY": config.get("apiKey", ""),
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": config.get("authDomain", ""),
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID": config.get("projectId", ""),
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": config.get("storageBucket", ""),
        "NEXT_PUBLIC_FIREBASE_MSG_SENDER_ID": config.get("messagingSenderId", ""),
        "NEXT_PUBLIC_FIREBASE_APP_ID": config.get("appId", ""),
    }

    for key, val in mapping.items():
        line = f"{key}={val}"
        pattern = rf"^{re.escape(key)}=.*$"
        if re.search(pattern, existing, re.MULTILINE):
            existing = re.sub(pattern, line, existing, flags=re.MULTILINE)
        else:
            existing = existing.rstrip() + f"\n{line}\n"

    env_path.write_text(existing, encoding="utf-8")
    ok(f"Wrote 6 Firebase vars to {env_path.name}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Firebase auto-setup for CricCoach")
    ap.add_argument(
        "--project-id",
        help="Specific project ID to create/reuse (default: criccoach-apl-<random>)",
    )
    args = ap.parse_args()

    print(c("35;1", "═" * 52))
    print(c("35;1", "  🔥  Firebase auto-setup for CricCoach"))
    print(c("35;1", "═" * 52))

    check_cli()
    ensure_login()
    project_id = create_project(args.project_id)
    create_firestore(project_id)
    deploy_rules(project_id)
    app_id = create_web_app(project_id)
    config = get_sdk_config(project_id, app_id)
    write_env(config)

    print()
    print(c("32;1", "✅ Firebase is wired up. Cricket Tinder is now real-backend ready."))
    print(f"   Project console: https://console.firebase.google.com/project/{project_id}")
    print(c("33", "   Restart the dev server (Ctrl+C, then `py setup_and_run.py`) to load the new vars."))


if __name__ == "__main__":
    main()
