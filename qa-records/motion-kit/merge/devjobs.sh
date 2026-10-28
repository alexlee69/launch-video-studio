#!/bin/bash
# step 4 storyboards of the dev jobs (stage), the same with the worker engines (A, C) for the merge's no-change proof,
# a stage-vs-stageA film slice through kit-dev's fan (decision a: no from: = Worker A's fan), and the soft-cut probe (h)
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; cd $M/jobs
S=$M/stage/product-launch-sting/video/lv.mjs; A=$M/stageA/product-launch-sting/video/lv.mjs; C=$M/stageC/product-launch-sting/video/lv.mjs
cool(){ while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do echo "hot: sleeping 180"; sleep 180; done; }
run(){ log=$1; shift; cool; echo "=== $log $(date +%T)"; "$@" > $M/merge/logs/$log.log 2>&1; echo "rc=$?"; grep -E "✗|QA (PASSED|FAILED)|Error|^  ! " $M/merge/logs/$log.log | head -6; }
run board-kitdev-S node $S --job mrg-kit-dev --storyboard --aspect all --workers 2
run board-kitdev-A node $A --job mrg-kit-dev-A --storyboard --aspect all --workers 2
run board-r2dev-S node $S --job mrg-r2-dev --storyboard --aspect all --workers 2
run board-r2dev-C node $C --job mrg-r2-dev-C --storyboard --aspect all --workers 2
run range-kitdev-fan-S node $S --job mrg-kit-dev --film --aspect 16x9 --range 138,353 --workers 1
run range-kitdev-fan-A node $A --job mrg-kit-dev-A --film --aspect 16x9 --range 138,353 --workers 1
run film-hprobe-S node $S --job mrg-h-probe --film --aspect 16x9 --workers 2
for a in 9x16 1x1; do run range-cta-pre-e-$a node /private/tmp/claude-501/-Users-bytedance-Downloads-Design-AutoPilot-stable/fa3ddc2b-1841-41b6-9859-439143f36875/scratchpad/eng-pre-e/video/lv.mjs --job mrg-cta-pre-e-$a --film --aspect $a --range 660,680 --workers 1; done
echo DONE $(date +%T)
