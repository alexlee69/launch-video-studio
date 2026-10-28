#!/bin/bash
# live vs staging stems, every cut, for the given job/cut pairs: "job cut"
B=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B; cd $B
ok=0; tot=0
run() { j=$1; c=$2
  ( node probes/build_audio.mjs live/video jobs-old/$j ident/live-$j-$c --cut $c > ident/live-$j-$c.json 2> ident/live-$j-$c.err ) &
  ( node probes/build_audio.mjs stage/video jobs-old/$j ident/stage-$j-$c --cut $c > ident/stage-$j-$c.json 2> ident/stage-$j-$c.err ) &
}
for spec in "old-playful main" "old-playful 10s" "old-keynote main" "old-calm main" "old-calm 10s" "old-track main" "old-track short" "old-none main" "var-keynote-level main" "var-keynote-level cd" "var-playful-level main"; do set -- $spec; run $1 $2; done
wait
for spec in "old-playful main" "old-playful 10s" "old-keynote main" "old-calm main" "old-calm 10s" "old-track main" "old-track short" "old-none main" "var-keynote-level main" "var-keynote-level cd" "var-playful-level main"; do set -- $spec
  r=$(/usr/bin/python3 -c "
import json
a=json.load(open('ident/live-$1-$2.json')); b=json.load(open('ident/stage-$1-$2.json'))
print(('SAME ' if a['md5']==b['md5'] and len(a['md5'])>=3 else 'DIFF ')+'%-18s %-6s style %-8s stems %s' % ('$1','$2',a['style'],','.join(sorted(a['md5']))))
" 2>&1); echo "$r"; tot=$((tot+1)); [[ $r == SAME* ]] && ok=$((ok+1))
done
echo "IDENTICAL $ok/$tot"
