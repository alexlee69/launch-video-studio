#!/bin/bash
# the final engine: template films, old-job identity (dark-ui-check film + heroes), dev-job storyboards, shot-writer suites
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; cd $M/jobs; S=$M/stage/product-launch-sting/video; L=$HOME/.claude/skills/product-launch-sting/video
cool(){ while pmset -g therm | grep -qi 'warning level.*[1-9]\|CPU_Speed_Limit *= *[0-9][0-9]\?$'; do echo "hot: sleeping 180"; sleep 180; done; }
run(){ log=$1; shift; cool; echo "=== $log $(date +%T)"; start=$(date +%s); "$@" > $M/merge/logs/$log.log 2>&1; echo "rc=$? $(( $(date +%s) - start )) s"; grep -E "✗|QA (PASSED|FAILED)|Error|^WARN|^FAIL" $M/merge/logs/$log.log | cut -c1-300 | head -8; }
for spec in launch15:16x9 launch15:9x16 launch15:1x1 launch30:16x9 launch30:9x16 launch30:1x1; do k=${spec%:*}; a=${spec#*:}; run final-film-$k-$a node $S/lv.mjs --job mrg-$k --film --aspect $a --workers 2; done
run final-film-dark-S node $S/lv.mjs --job mrg-old-dark-ui-check --film --aspect 16x9 --workers 2
for n in film-sample steady-sample dark-ui-check edge-test reel-sample; do run final-board-$n node $S/lv.mjs --job mrg-old-$n --storyboard --aspect all --workers 2; done
run final-board-kitdev node $S/lv.mjs --job mrg-kit-dev --storyboard --aspect all --workers 2
run final-board-r2dev node $S/lv.mjs --job mrg-r2-dev --storyboard --aspect all --workers 2
cool; echo "=== suites stage $(date +%T)"; SHOTS_QA_VIDEO=$S bash /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/run_all.sh > $M/merge/logs/suites-stage.log 2>&1; echo "rc=$?"; tail -3 $M/merge/logs/suites-stage.log
cp -c -R /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/out $M/merge/logs/suites-stage-out 2>/dev/null
cool; echo "=== suites live $(date +%T)"; bash /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/run_all.sh > $M/merge/logs/suites-live.log 2>&1; echo "rc=$?"; tail -3 $M/merge/logs/suites-live.log
echo FINAL-DONE $(date +%T)
cool; echo "=== suites live, pre-merge test files $(date +%T)"; bash /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port-orig-mrg/run_all.sh > $M/merge/logs/suites-live-orig.log 2>&1; echo "rc=$?"; tail -3 $M/merge/logs/suites-live-orig.log
echo FINAL2-DONE $(date +%T)
