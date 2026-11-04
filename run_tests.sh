#!/usr/bin/env bash
# Run every automated check: backend (pytest), frontend (vitest) and a frontend production build.
#
#   ./run_tests.sh                  everything
#   ./run_tests.sh backend          backend only
#   ./run_tests.sh frontend         frontend tests + build only
#
# Extra arguments after the target go to the test runner, e.g.  ./run_tests.sh backend -k login
set -uo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"

TARGET="${1:-all}"
[[ $# -gt 0 ]] && shift
case "$TARGET" in all|backend|frontend) ;; *) echo "Usage: $0 [all|backend|frontend] [runner args]"; exit 2 ;; esac

PYTHON_BIN="${PYTHON:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  for c in python3.12 python3.13 python3.11 python3; do command -v "$c" >/dev/null 2>&1 && { PYTHON_BIN="$c"; break; }; done
fi

failed=()
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

run_backend() {
  step "Backend: environment"
  cd "$ROOT/backend"
  [[ -x .venv/bin/python ]] || "$PYTHON_BIN" -m venv .venv || return 1
  local stamp=".venv/.requirements.sha"
  local want; want="$(cat requirements.txt requirements-dev.txt | shasum | cut -d' ' -f1)"
  if [[ "$(cat "$stamp" 2>/dev/null)" != "$want" ]]; then
    .venv/bin/pip install -q -r requirements-dev.txt || return 1
    echo "$want" > "$stamp"
  fi
  step "Backend: pytest"
  .venv/bin/python -m pytest "$@"
}

run_frontend() {
  cd "$ROOT/frontend"
  step "Frontend: dependencies"
  if [[ ! -d node_modules || package.json -nt node_modules/.package-lock.json ]]; then
    npm install --no-audit --no-fund --loglevel=error || return 1
  fi
  step "Frontend: vitest"
  npx vitest run "$@" || return 1
  step "Frontend: production build"
  npm run build --silent
}

if [[ "$TARGET" == "all" || "$TARGET" == "backend" ]];  then (run_backend "$@")  || failed+=("backend");  fi
if [[ "$TARGET" == "all" || "$TARGET" == "frontend" ]]; then (run_frontend "$@") || failed+=("frontend"); fi

echo
if [[ ${#failed[@]} -eq 0 ]]; then
  printf '\033[32mALL CHECKS PASSED\033[0m\n'
else
  printf '\033[31mFAILED: %s\033[0m\n' "${failed[*]}"
  exit 1
fi
