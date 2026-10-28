#!/bin/bash
# The storyboard port's QA: every suite, no network, no keys, nothing spent. Keep the lid open (a sleeping Mac stalls
# Chrome mid-screenshot and a render step times out); caffeinate keeps an open, idle Mac awake.
cd "$(dirname "$0")" || exit 2
if ioreg -r -k AppleClamshellState -d 4 2>/dev/null | grep -q '"AppleClamshellState" = Yes'; then
  echo "the lid is closed: the Mac will sleep mid-render. Open it and run again." >&2; exit 2
fi
fail=0
for t in test_parity.py test_flow.py test_failures.py test_review_fixes.py; do
  [ -f "$t" ] || continue
  echo "=== $t"
  caffeinate -i /usr/bin/python3 -B "$t" > "out/$t.log" 2>&1
  rc=$?
  grep -E '^(FAIL|PASS)  ' "out/$t.log" | grep '^FAIL' || true
  tail -1 "out/$t.log"
  [ $rc -eq 0 ] || fail=1
done
[ $fail -eq 0 ] && echo "ALL SUITES PASS" || { echo "SOME SUITES FAILED (logs in out/)"; exit 1; }
