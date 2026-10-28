#!/bin/bash
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; cd $M/jobs
until grep -q CHAIN-DONE $M/merge/logs/chain.out; do sleep 10; done
cool(){ while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do echo "hot: sleeping 180"; sleep 180; done; }
cool; echo "=== A control range $(date +%T)"; node $M/stageA/product-launch-sting/video/lv.mjs --job mrg-kit-dev-A2 --film --aspect 16x9 --range 138,353 --workers 1 > $M/merge/logs/range-kitdev-fan-A2.log 2>&1; echo rc=$?
echo POST-DONE $(date +%T)
