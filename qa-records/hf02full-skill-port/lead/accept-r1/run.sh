#!/bin/bash
# Lead runs the monitor's acceptance harness (85 checks) on the fixed staging, after the workers' suites finish.
P=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port; O=$P/lead/accept-r1
until grep -q '^DONE' $P/lead/verify-r1/summary.txt 2>/dev/null; do sleep 15; done
t0=$SECONDS; bash $P/acceptance/run.sh $P/stage-r1-after-sonnet-fixes/product-launch-sting > $O/run.out 2>&1; rc=$?
echo "acceptance exit=$rc $((SECONDS-t0))s :: $(grep -E '^[0-9]+ PASS' $O/run.out | tail -1)" | tee $O/result.txt
