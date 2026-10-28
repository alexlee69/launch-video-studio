#!/bin/bash
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; cd $M/jobs; S=$M/stage/product-launch-sting/video; L=$HOME/.claude/skills/product-launch-sting/video
until grep -q CHAIN-DONE $M/merge/logs/chain.out; do sleep 10; done
cool(){ while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do echo "hot: sleeping 180"; sleep 180; done; }
run(){ log=$1; shift; cool; echo "=== $log $(date +%T)"; "$@" > $M/merge/logs/$log.log 2>&1; echo "rc=$?"; grep -E "✗|QA (PASSED|FAILED)|Error" $M/merge/logs/$log.log | head -3; }
run range-kitdev-fan-A2 node $M/stageA/product-launch-sting/video/lv.mjs --job mrg-kit-dev-A2 --film --aspect 16x9 --range 138,353 --workers 1
for n in steady-sample dark-ui-check edge-test; do run board2-$n-S node $S/lv.mjs --job mrg-old-$n --storyboard --aspect all --workers 2; done
run film-dark-S2 node $S/lv.mjs --job mrg-old-dark-ui-check --film --aspect 16x9 --workers 2
echo POST-DONE $(date +%T)
