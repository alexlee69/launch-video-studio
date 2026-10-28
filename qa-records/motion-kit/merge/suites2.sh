#!/bin/bash
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit
until grep -q FINAL2-DONE $M/merge/logs/final.out; do sleep 10; done
while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do sleep 180; done
cp -c -R /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/out $M/merge/logs/suites-live-out 2>/dev/null
echo "=== suites stage (P4 path fix) $(date +%T)"
SHOTS_QA_VIDEO=$M/stage/product-launch-sting/video bash /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/run_all.sh > $M/merge/logs/suites-stage2.log 2>&1; echo "rc=$?"
cp -c -R /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/out $M/merge/logs/suites-stage2-out 2>/dev/null
echo SUITES2-DONE $(date +%T)
