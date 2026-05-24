#!/usr/bin/env python3
"""
CricCoach — one-shot setup + run

  python setup_and_run.py          # install + verify env + start dev server
  python setup_and_run.py --build  # production build + start
  python setup_and_run.py --check  # just verify, don't start the server

What it does, in order:
  1. Verifies Node.js (>= 20.9 recommended for Next.js 16)
  2. Runs `npm install` if node_modules is missing
  3. Creates a .env.local template if missing, or validates the existing one
  4. Starts the dev server (or build+start) and opens the browser

Works on Windows / macOS / Linux. No external Python deps.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

# Windows console defaults to cp1252; force UTF-8 so emoji/box-drawing render.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parent
IS_WINDOWS = os.name == "nt"

# `shell=True` lets Windows find `npm.cmd`, `npx.cmd` from PATH without us
# having to guess the extension.
SHELL = IS_WINDOWS

# Hackathon-shared keys. Rotate after the event — anyone with the repo gets
# these. (Firebase web keys are public-by-design and gated by Firestore rules.)
HACKATHON_KEYS: dict[str, str] = {
    "GEMINI_API_KEY": "AIzaSyAmvtaURbOU7Vs2IU7CGvEo7iKDHcQaYcU",
    "CRICAPI_KEY": "a7e81b3b-90ce-47db-98fe-71cc15c98c8b",
}

ENV_TEMPLATE = f"""\
# === AI features (Why? / Roast) — hackathon key, will be rotated ===
GEMINI_API_KEY={HACKATHON_KEYS["GEMINI_API_KEY"]}

# === Live cricket scores (CricAPI) ===
CRICAPI_KEY={HACKATHON_KEYS["CRICAPI_KEY"]}

# === Cricket Tinder (Firebase Firestore) — fill these from Firebase Console ===
# Firebase console → Project Settings → Your apps → Web app config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MSG_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
"""

CORE_REQUIRED = ["GEMINI_API_KEY", "CRICAPI_KEY"]
TINDER_REQUIRED = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
]

# ---------- pretty printing ----------

USE_COLOR = sys.stdout.isatty()


def c(code: str, text: str) -> str:
    if not USE_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"


def step(msg: str) -> None:
    print(c("36;1", f"\n→ {msg}"))


def ok(msg: str) -> None:
    print(c("32", f"  ✓ {msg}"))


def warn(msg: str) -> None:
    print(c("33", f"  ⚠ {msg}"))


def fail(msg: str) -> None:
    print(c("31;1", f"  ✗ {msg}"))


# ---------- steps ----------

def check_node() -> None:
    step("Checking Node.js")
    if not shutil.which("node"):
        fail("Node.js not found in PATH.")
        print("    Install LTS from https://nodejs.org and re-run.")
        sys.exit(1)
    r = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, shell=SHELL
    )
    version = r.stdout.strip()
    ok(f"Node {version}")
    # Soft-warn if older than 20.9
    try:
        major, minor, *_ = (int(x) for x in version.lstrip("v").split("."))
        if major < 20 or (major == 20 and minor < 9):
            warn("Next.js 16 recommends Node 20.9+. Older versions may break.")
    except ValueError:
        pass


def install_deps(force: bool) -> None:
    step("Installing npm dependencies")
    node_modules = ROOT / "node_modules"
    if node_modules.exists() and not force:
        ok("node_modules exists — skipping (use --force-install to redo)")
        return
    try:
        subprocess.run(["npm", "install"], cwd=ROOT, check=True, shell=SHELL)
        ok("Dependencies installed")
    except subprocess.CalledProcessError:
        fail("npm install failed. Check the log above.")
        sys.exit(1)


def parse_env_file(path: Path) -> dict[str, str]:
    found: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        found[key.strip()] = val.strip().strip('"').strip("'")
    return found


def ensure_env() -> dict[str, str]:
    step("Checking .env.local")
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        env_path.write_text(ENV_TEMPLATE, encoding="utf-8")
        ok(f"Created {env_path.name} with hackathon keys pre-filled")
        print(c("33", "    Add the 6 Firebase keys to enable Cricket Tinder, then re-run."))
        # Don't exit — the dev server can still run for Why/Roast/Live
    else:
        # Auto-patch any missing hackathon keys into an existing .env.local
        found = parse_env_file(env_path)
        patches = [(k, v) for k, v in HACKATHON_KEYS.items() if not found.get(k)]
        if patches:
            with env_path.open("a", encoding="utf-8") as f:
                f.write("\n# auto-added by setup_and_run.py\n")
                for k, v in patches:
                    f.write(f"{k}={v}\n")
            ok(f"Patched missing hackathon keys into .env.local: {', '.join(k for k, _ in patches)}")

    found = parse_env_file(env_path)
    missing_core = [k for k in CORE_REQUIRED if not found.get(k)]
    missing_tinder = [k for k in TINDER_REQUIRED if not found.get(k)]

    if missing_core:
        fail(f"Required vars still missing: {', '.join(missing_core)}")
        print(f"    Edit {env_path} and re-run.")
        sys.exit(1)

    if missing_tinder:
        warn("Firebase vars missing → Cricket Tinder won't work:")
        for k in missing_tinder:
            print(c("33", f"      - {k}"))
        print(c("33", "    Other features (Why?, Roast, Live scores) will work."))
    else:
        ok("All env vars present (core + Firebase)")

    return found


def open_browser_when_ready(url: str, delay: float) -> None:
    def _open() -> None:
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()


def run_dev(mode: str) -> None:
    if mode == "build":
        step("Building production bundle")
        try:
            subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True, shell=SHELL)
        except subprocess.CalledProcessError:
            fail("Build failed. Fix the errors above and re-run.")
            sys.exit(1)
        cmd = ["npm", "run", "start"]
        verb = "Starting production server"
    else:
        cmd = ["npm", "run", "dev"]
        verb = "Starting dev server"

    step(f"{verb} at http://localhost:3000")
    print(c("90", "  (Ctrl+C to stop)\n"))

    open_browser_when_ready("http://localhost:3000", delay=4.0)

    try:
        subprocess.run(cmd, cwd=ROOT, shell=SHELL)
    except KeyboardInterrupt:
        print(c("36", "\n  ✓ Stopped"))


def main() -> None:
    ap = argparse.ArgumentParser(description="CricCoach setup + run helper")
    ap.add_argument(
        "--check",
        action="store_true",
        help="verify environment only, don't start the server",
    )
    ap.add_argument(
        "--build",
        action="store_true",
        help="run production build + start (instead of dev)",
    )
    ap.add_argument(
        "--force-install",
        action="store_true",
        help="run npm install even if node_modules exists",
    )
    args = ap.parse_args()

    print(c("35;1", "═" * 50))
    print(c("35;1", "  🏏  CricCoach setup"))
    print(c("35;1", "═" * 50))

    check_node()
    install_deps(force=args.force_install)
    ensure_env()

    if args.check:
        print(c("32;1", "\n  All checks passed ✓\n"))
        return

    run_dev("build" if args.build else "dev")


if __name__ == "__main__":
    main()
