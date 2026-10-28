#!/bin/bash
# one film at a time, --workers 2, a thermal check between renders
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; V=$M/stage/product-launch-sting/video; cd $M/jobs
for spec in "$@"; do
  job=${spec%:*}; a=${spec#*:}
  while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do echo "hot: sleeping 180"; sleep 180; done
  echo "=== $job $a $(date +%T)"; start=$(date +%s)
  node $V/lv.mjs --job $job --film --aspect $a --workers 2 > $M/merge/logs/film-$job-$a.log 2>&1; echo "rc=$? $(( $(date +%s) - start )) s"
  grep -E "^(PASS|FAIL|WARN|INFO)|QA (PASSED|FAILED)" $M/merge/logs/film-$job-$a.log | grep -v "^PASS" | cut -c1-400
  df -k ~/Downloads | tail -1 | awk '{print int($4/1048576) " GB free"}'
done
