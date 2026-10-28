#!/bin/bash
# old-job proofs for decisions d (ui.js) and e (type.js) + rule 1: live vs stage, separate clones, one render at a time
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; S=$M/stage/product-launch-sting/video/lv.mjs; L=~/.claude/skills/product-launch-sting/video/lv.mjs; cd $M/jobs
cool(){ while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do echo "hot: sleeping 180"; sleep 180; done; }
run(){ log=$1; shift; cool; echo "=== $* $(date +%T)"; "$@" > $M/merge/logs/$log.log 2>&1; echo "rc=$?"; grep -E "✗|QA (PASSED|FAILED)|Error" $M/merge/logs/$log.log | head -3; }
for n in film-sample steady-sample reel-sample dark-ui-check edge-test; do
  run board-$n-L node $L --job mrg-old-$n-live --storyboard --aspect all --workers 2
  run board-$n-S node $S --job mrg-old-$n --storyboard --aspect all --workers 2
done
run film-dark-L node $L --job mrg-old-dark-ui-check-live --film --aspect 16x9 --workers 2
run film-dark-S node $S --job mrg-old-dark-ui-check --film --aspect 16x9 --workers 2
for a in 16x9 9x16 1x1; do for r in 145,180 2119,2154; do
  run range-fs-$a-$r-L node $L --job mrg-old-film-sample-live --film --aspect $a --range $r --workers 1
  run range-fs-$a-$r-S node $S --job mrg-old-film-sample --film --aspect $a --range $r --workers 1
done; done
echo DONE $(date +%T)
