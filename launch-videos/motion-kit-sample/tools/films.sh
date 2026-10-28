#!/bin/bash
# one aspect at a time, --workers 2, a thermal check (and a 180 s pause on any warning level) before each render
J=/Users/bytedance/Downloads/launch-videos/motion-kit-sample
S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stage/product-launch-sting/video
TAG=${1:-final}; shift
for A in "${@:-16x9 9x16 1x1}"; do
  for A1 in $A; do
    while pmset -g therm | grep -qiE "warning level.*[1-9]|CPU_Speed_Limit *= *[0-9]{1,2}$"; do echo "hot: waiting 180 s"; sleep 180; done
    free=$(df -k ~/Downloads | tail -1 | awk '{print int($4/1048576)}'); if [ "$free" -lt 25 ]; then echo "disk under 25 GB ($free): stop"; exit 3; fi
    echo "== $A1 $(date +%T) free ${free} GB"
    node $S/lv.mjs --job $J --film --aspect $A1 --workers 2 > $J/logs/film-$A1-$TAG.log 2>&1; echo "exit $? $A1"
    grep -E "QA (PASSED|FAILED)" $J/logs/film-$A1-$TAG.log
  done
done
echo ALLDONE
