#!/bin/bash
SP=/private/tmp/claude-501/-Users-bytedance-Downloads-Design-AutoPilot-stable/fa3ddc2b-1841-41b6-9859-439143f36875/scratchpad
J=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/jobs
export STAGE=${STAGE:-/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting}
TAG=${TAG:-D}
for j in "$@"; do
  d=$J/mon-D-old-$j
  asp=$(/usr/bin/python3 -I -c "import re,sys;t=open('$d/beats.yaml').read();m=re.search(r'^aspects:\s*\[([^\]]*)\]',t,re.M);print(' '.join(x.strip() for x in m.group(1).split(',')) if m else '16x9')")
  for a in $asp; do
    node $SP/camsurvey.mjs $d $a $SP/survey/$TAG-$j-$a.json > $SP/survey/$TAG-$j-$a.txt 2>&1
    echo "== $j $a (exit $?)"; cut -c1-600 $SP/survey/$TAG-$j-$a.txt
  done
done
