#!/bin/bash
# The casting port's 3 QA runs; no key, no network, no spend. Exit 1 on any FAIL.
H=$(cd "$(dirname "$0")" && pwd); O=${1:-$H/out}; mkdir -p "$O"; rc=0
python3 "$H/test_parity.py" "$O/qa1" > "$O/qa1.log" 2>&1 || rc=1; echo "QA1 parity:   $(grep -c '^PASS' "$O/qa1.log") PASS, $(grep -c '^FAIL' "$O/qa1.log") FAIL"
python3 "$H/test_flow.py" "$O/qa2-job" > "$O/qa2.log" 2>&1 || rc=1; echo "QA2 flow:     $(grep -c '^PASS' "$O/qa2.log") PASS, $(grep -c '^FAIL' "$O/qa2.log") FAIL"
python3 "$H/test_failures.py" "$O/qa3-job" > "$O/qa3.log" 2>&1 || rc=1; echo "QA3 failures: $(grep -c '^PASS' "$O/qa3.log") PASS, $(grep -c '^FAIL' "$O/qa3.log") FAIL"
python3 "$H/test_review_fixes.py" "$O/qa4-job" > "$O/qa4.log" 2>&1 || rc=1; echo "QA4 review:   $(grep -c '^PASS' "$O/qa4.log") PASS, $(grep -c '^FAIL' "$O/qa4.log") FAIL"
exit $rc
