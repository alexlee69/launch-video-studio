#!/bin/bash
# Re-measure the proof film against the reference's curves (numbers in ../ref/curves; no reference frame is read or written).
#   bash compare/run.sh [skill video dir]   (default: the live skill)
# 1. our 16:9 film frames 30–239 → ours/n0300…n0509.png at 1080×608 (the reference's size and numbering)
# 2. the job's own tracker (../tools/track.py, --half) on the reference's key frames and directions; ../tools/listL.py
#    (list offset + slot edges) and listc2.py (= ../tools/listc.py + a green mask) on the list shot
# 3. compare.py (camera errors per shot), landings.py (fly-in landings), blurcal.py (the tracker's blur reading vs the σ the
#    engine applied, from camdump.mjs)
set -e
C=$(cd "$(dirname "$0")" && pwd); J=$(dirname "$C"); T=$J/tools; V=${1:-$HOME/.claude/skills/product-launch-sting/video}
python3 -E $C/prep.py $J/out/main/16x9/frames $C/ours 30 239
rm -f $C/trk-*.json
for spec in "A 300 300 311" "B1f 325 325 333" "B1r 325 325 312" "B2f 345 345 356" "B2r 345 345 334" "C0f 372 372 388" "C0r 372 372 357" "D1f 470 470 483" "D1r 470 470 465" "D2f 500 500 509" "D2r 500 500 484"; do
  set -- $spec; (cd $T && python3 -E track.py $C/ours $2 $3 $4 $C/trk-$1.json --half > $C/trk-$1.log 2>&1) &
done

wait
# list offset anchored at our own n386 title top (any constant works: L is compared relative to n386)
(cd $T && python3 -E listL.py $C/ours 357 466 386 0 $C/listL-ours.json > $C/listL.log 2>&1)
(cd $C/tools && python3 -E listc2.py $C/ours 356 446 $C/listc-ours.json > $C/listc.log 2>&1)
node $C/tools/camdump.mjs $V $J 16x9 30 239 1 "(() => { const sh = [...document.querySelectorAll('.lv-shot')].findIndex(e => e.style.display === 'block'); const g = document.querySelector('#lvB' + sh + ' feGaussianBlur'); const f = document.querySelectorAll('.lv-cam')[sh].style.filter; return { sd: g ? g.getAttribute('stdDeviation') : null, f }; })()" > $C/blur-applied.jsonl
python3 -E $C/compare.py .6 | tee $C/compare.txt
python3 -E $C/landings.py | tee $C/landings.txt
python3 -E $C/blurcal.py > $C/blurcal.txt
rm -rf $C/ours
echo "→ $C/compare.txt, landings.txt, blurcal.txt"
