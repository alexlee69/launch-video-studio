#!/bin/bash
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit
until [ $(grep -c "^rc=" $M/merge/logs/films-tpl.out) -ge 6 ]; do sleep 10; done
$M/merge/devjobs.sh > $M/merge/logs/devjobs.out 2>&1
$M/merge/oldjobs.sh > $M/merge/logs/oldjobs.out 2>&1
echo CHAIN-DONE $(date +%T)
