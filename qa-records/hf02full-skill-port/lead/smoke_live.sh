#!/bin/bash
# Smoke test of the LIVE skill after the merge: every new entry point runs as installed. Writes only under lead/smoke-live/.
# No network: gen.mjs runs a dry run only, with a fake HOME and FAL_QUEUE_URL pointing at a closed port.
P=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port; V=${SMOKE_V:-$HOME/.claude/skills/product-launch-sting/video}
O=$P/lead/smoke-live; rm -rf $O; mkdir -p $O/fakehome $O/job $O/film; cd $O || exit 9
ok=0; bad=0
t() { local name="$1" want="$2" pat="$3"; shift 3; "$@" > "$O/$name.log" 2>&1; local rc=$?
  if [ "$rc" = "$want" ] && { [ -z "$pat" ] || grep -Eq -- "$pat" "$O/$name.log"; }; then echo "PASS  $name"; ok=$((ok+1)); else echo "FAIL  $name (exit $rc, want $want${pat:+, /$pat/})"; bad=$((bad+1)); fi; }
J=$HOME/Downloads/launch-videos/steady-sample
cp $J/beats.yaml $O/job/; [ -f $J/brief.md ] && cp $J/brief.md $O/job/; cp -R $J/assets $O/job/ 2>/dev/null
t grid-playful 0 'BPM' node $V/lv.mjs --job $O/job --grid
cp -R $O/job/. $O/film/
python3 -E - "$O/film/beats.yaml" <<'PY'
# -*- coding: utf-8 -*-
import sys, re
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
s2 = re.sub(r'(?m)^  style: playful\b.*$', '  style: film', s, count=1)
s3 = re.sub(r'(?m)^  bpm: .*\n', '', s2, count=1)          # an explicit bpm overrides the style's default (film: 87)
assert s2 != s and s3 != s2; open(p, 'w', encoding='utf-8').write(s3)
PY
t grid-film 0 '87 BPM' node $V/lv.mjs --job $O/film --grid
t gen-dry 0 'dry run — show the user' env HOME=$O/fakehome FAL_QUEUE_URL=http://127.0.0.1:9 node $V/footage/gen.mjs still --prompt "smoke test" --out $O/gen/x
[ -e $O/gen ] && { echo "FAIL  gen-dry wrote files"; bad=$((bad+1)); } || { echo "PASS  gen-dry wrote nothing"; ok=$((ok+1)); }
for py in footage/look.py footage/conform.py footage/pin.py recreate/compare.py recreate/track.py recreate/music.py recreate/temptrack.py; do
  t "help-$(basename $py .py)" 0 '' /usr/bin/python3 -B $V/$py --help; done
t screen-help 2 '' node $V/footage/screen.mjs
t compare-real 0 '19 exact, 2 within 1 f' /usr/bin/python3 -B $V/recreate/compare.py --ref $HOME/Downloads/higgsfield02.mp4 --ours $HOME/Downloads/launch-videos/hf02-full/film.mp4 --cuts-from $P/work-B/compare/hand-cuts-22.txt --no-video --out $O/compare
t music-compare 0 'ON THEIR BEAT' /usr/bin/python3 -B $V/recreate/music.py compare $HOME/Downloads/higgsfield02.mp4 $HOME/Downloads/launch-videos/hf02-full/film.mp4
[ -z "$(find $V -name __pycache__)" ] && { echo "PASS  no __pycache__ in live"; ok=$((ok+1)); } || { echo "FAIL  __pycache__ in live"; bad=$((bad+1)); }
echo "smoke: $ok PASS, $bad FAIL"; [ $bad = 0 ]
