#!/bin/bash
# Acceptance harness for the hf02-full → product-launch-sting port (DESIGN.md "Monitor"). Black-box: it tests the spec,
# never reads the workers' code for meaning; every tool runs in a sandbox (real .env unreadable, only 127.0.0.1 reachable,
# the live skill / original jobs / reference unwritable) against a local mock fal queue with FAKE keys.
#   bash run.sh <STAGE_SKILL_DIR> [--no-real] [--no-slow] [--only static,gen,footage,recreate,film]
#   bash run.sh --self-test [--only mock,fixtures,baselines,gen,footage,recreate,film,static]
#   bash run.sh --build          rebuild fixtures + live baselines (one-off; already done)
# exit 0 = no FAIL (SKIPs allowed) · 1 = at least one FAIL · 2 = could not run
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PY=/usr/bin/python3
case "${1:-}" in
  --self-test) shift; exec "$PY" -E "$HERE/lib/selftest.py" "$@" ;;
  --build) exec "$PY" -E "$HERE/lib/selftest.py" --build-only ;;
  ""|-h|--help) sed -n '2,8p' "$0"; exit 2 ;;
  *) exec "$PY" -E "$HERE/lib/run.py" "$@" ;;
esac
