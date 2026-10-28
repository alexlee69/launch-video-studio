#!/bin/bash
# Lead's independent re-run of every Worker A suite against the staging copy (after the key-order change).
A="$(cd "$(dirname "$0")/../../work-A" && pwd)"; O="$(cd "$(dirname "$0")" && pwd)"; cd "$A" || exit 9
run() { local name="$1"; shift; local t0=$SECONDS; "$@" > "$O/$name.out" 2>&1; local rc=$?; echo "$name exit=$rc $((SECONDS-t0))s :: $(grep -E 'passed|caught' "$O/$name.out" | tail -1)" | tee -a "$O/summary.txt"; }
: > "$O/summary.txt"
run repro        bash tests/repro.sh
run look         python3 -E tests/test_look.py
run conform_pin  python3 -E tests/test_conform_pin.py
run conform_pin_Clocale env LANG=C LC_ALL=C TEST_TAG=clocale python3 -E tests/test_conform_pin.py
run gen          node tests/test_gen.mjs
run screen_bg    bash tests/test_screen_bg.sh
run mutants_gen  python3 -E tests/mutants.py gen
run mutants_py   python3 -E tests/mutants.py py
echo DONE | tee -a "$O/summary.txt"
