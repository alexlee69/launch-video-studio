#!/bin/bash
# Lead's independent re-run of Worker B's whole final pass (40 checks) against staging, after Worker A's re-run is done.
P=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port; B=$P/work-B; O=$P/lead/verify-B
until grep -q '^DONE' $P/lead/verify-A/summary.txt 2>/dev/null; do sleep 15; done
: > $B/logs/final/SUMMARY.txt
t0=$SECONDS; bash $B/tests/final.sh > $O/final.out 2>&1; rc=$?
cp $B/logs/final/SUMMARY.txt $O/SUMMARY.txt
echo "final.sh exit=$rc $((SECONDS-t0))s :: $(grep -c '^PASS' $O/SUMMARY.txt) PASS, $(grep -c '^FAIL' $O/SUMMARY.txt) FAIL" | tee $O/result.txt
