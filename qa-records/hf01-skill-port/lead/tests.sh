#!/bin/bash
# Re-test the hf01 port's three tools (footage/plates.py, recreate/sfx.py, recreate/finish.py) against the live skill.
#   bash tests.sh RUN_DIR [SKILL_DIR]        (≈ 10 min; RESULTS.txt in RUN_DIR; exit 0 = every test passed)
# Inputs (read only): the manus2-space job's footage clips, higgsfield01.mp4, the brand SVGs, and r1/ (baseline master,
# the job's stems + sfx.wav snapshot, the plates built at 10:48 that were byte-identical to the job's own, the failure specs).
set -u
RUN=${1:?usage: tests.sh RUN_DIR [SKILL_DIR]}; SKILL=${2:-$HOME/.claude/skills/product-launch-sting}
V=$SKILL/video; HERE=$(cd "$(dirname "$0")" && pwd); R1=$HERE/../r1
PY="/usr/bin/python3 -B"; NICE="nice -n 10"
CLIPS=$HOME/Downloads/launch-videos/manus2-space/footage/fal
REF=$HOME/Downloads/higgsfield01.mp4; BRAND=$HOME/Downloads/launch-videos/hf01-study/manus2/brand
B=$R1/baseline-16x9.mp4; FI="$PY $V/recreate/finish.py"
CUTS=$HOME/Downloads/launch-videos/hf01-study/cuts/cuts.txt          # higgsfield01's verified cut list = the baseline's shot starts (n/30 s)
mkdir -p "$RUN"/{plates,plates-fail,sfx,finish,err}; RES=$RUN/RESULTS.txt; : > "$RES"
fails=0
rec() { printf '%-26s %s  %s\n' "$1" "$2" "$3" | tee -a "$RES"; [ "$2" = PASS ] || fails=$((fails + 1)); }
code() { name=$1; want=$2; shift 2; "$@" > "$RUN/$name.log" 2>&1; rc=$?; echo "exit=$rc" >> "$RUN/$name.log"
         note=$(grep -m1 '✗' "$RUN/$name.log" | cut -c1-110); [ $rc = "$want" ] && rec "$name" PASS "exit $rc $note" || rec "$name" FAIL "exit $rc, want $want $note"; }

# ── plates.py: the worked example rebuilds every plate byte for byte; a bad spec writes nothing (exit 2) ──
$NICE $PY $V/footage/plates.py $V/recreate/examples/manus2-space-plates.json --clips "$CLIPS" --out-dir "$RUN/plates" > "$RUN/plates.log" 2>&1
rc=$?; same=0; n=0
for f in "$R1"/plates/S*.mp4; do n=$((n + 1)); cmp -s "$f" "$RUN/plates/$(basename "$f")" && same=$((same + 1)); done
[ $rc = 0 ] && [ $same = $n ] && [ $n = 12 ] && rec plates-parity PASS "12/12 byte-identical to r1 (= the job's plates)" || rec plates-parity FAIL "exit $rc, $same/$n identical"
for c in long sum missing nokind; do
  code plates-fail-$c 2 $PY $V/footage/plates.py "$R1/plates-fail/$c.json" --clips "$CLIPS" --out-dir "$RUN/plates-fail"
done
[ -z "$(ls -A "$RUN/plates-fail")" ] || rec plates-fail-wrote-nothing FAIL "$(ls "$RUN/plates-fail")"

# ── sfx.py: the worked example renders the job's sfx.wav sample for sample; bad events exit 2, a clip exits 1 ──
$PY $V/recreate/sfx.py $V/recreate/examples/manus2-space-sfx.json --out "$RUN/sfx/sfx.wav" > "$RUN/sfx.log" 2>&1
rc=$?; cmp -s "$R1/sfx/sfx.wav" "$RUN/sfx/sfx.wav" && [ $rc = 0 ] && rec sfx-parity PASS "byte-identical to the job's audio/sfx.wav (r1 snapshot)" || rec sfx-parity FAIL "exit $rc"
for c in unknown badparam pastend; do code sfx-fail-$c 2 $PY $V/recreate/sfx.py "$R1/sfx/$c.json" --out "$RUN/sfx/$c.wav"; done
code sfx-fail-clip 1 $PY $V/recreate/sfx.py "$R1/sfx/clip.json" --out "$RUN/sfx/clip.wav"
ls "$RUN"/sfx/{unknown,badparam,pastend,clip}.wav > /dev/null 2>&1 && rec sfx-fail-wrote-nothing FAIL "a failed render left a file" || true

# ── finish.py ──
$PY $V/recreate/finish.py --measure "$REF" > "$RUN/finish-measure.log" 2>&1
grep -q ': 15:5,10,14 — ' "$RUN/finish-measure.log" && rec finish-measure PASS "$(sed 's/^.*: 15/15/' "$RUN/finish-measure.log")" || rec finish-measure FAIL "$(cat "$RUN/finish-measure.log")"
code finish-full 0 $NICE $FI --master "$B" --out "$RUN/finish/final-16x9.mp4" --ref "$REF" --cuts "$CUTS" \
  --bug $V/recreate/corner-bug-hf01.json --bug-glyph "$BRAND/manus-mark-white.svg" --bug-text "$BRAND/manus-wordmark-white.svg" \
  --stems "$R1/stems" --keep music --add "$R1/sfx/sfx.wav"
grep '✓\|✗\|audio:\|kept inside' "$RUN/finish-full.log" | sed 's/^/      /' | tee -a "$RES"
# every cut of the finished 30 fps file against the reference's own (the master read 25 exact + n1532 within 1)
$NICE $PY $V/recreate/compare.py --ref "$REF" --ours "$RUN/finish/final-16x9.mp4" --out "$RUN/finish/compare" --cuts-from "$CUTS" --no-video > "$RUN/finish-cuts.log" 2>&1
grep -q '26 in the reference — 25 exact, 1 within 1 f' "$RUN/finish-cuts.log" && rec finish-cuts-exact PASS "$(grep -m1 '^cuts:' "$RUN/finish-cuts.log")" || rec finish-cuts-exact FAIL "$(grep -m1 '^cuts:' "$RUN/finish-cuts.log")"
code finish-shots 0 $NICE $PY "$HERE/shots_test.py" "$RUN/shots"
code finish-wrong-phase 1 $NICE $FI --master "$B" --out "$RUN/finish/wrongphase.mp4" --pattern 15:2,7,12 --ref "$REF" --cuts "$CUTS" --no-audio --frames 900
code finish-own-pattern 0 $FI --qa "$RUN/finish/wrongphase.mp4" --master "$B" --pattern 15:2,7,12 --cuts "$CUTS"
code finish-none 0 $NICE $FI --master "$B" --out "$RUN/finish/none.mp4" --cadence none --no-audio --frames 900
code finish-none-vs-ref 1 $NICE $FI --master "$B" --out "$RUN/finish/none-ref.mp4" --cadence none --ref "$REF" --no-audio --frames 900
code finish-picks-harness 0 $NICE $PY "$HERE/picks_harness.py" "$B" "$RUN/finish/picks" 900
O=$RUN/err/out.mp4
code err-pattern-half 2 $FI --master "$B" --out "$O" --pattern 15:1,3,5,7,9,11,13,14 --no-audio
code err-pattern-text 2 $FI --master "$B" --out "$O" --pattern abc --no-audio
code err-pattern-slot 2 $FI --master "$B" --out "$O" --pattern 15:0,15 --no-audio
code err-missing-stem 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --keep music,nosuch --stems "$R1/stems"
code err-missing-add 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --keep music --add "$RUN/err/none.wav" --stems "$R1/stems"
code err-bug-no-glyph 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --bug $V/recreate/corner-bug-hf01.json --no-audio
code err-out-is-master 2 $FI --master "$B" --out "$B" --pattern 15:5,10,14 --no-audio
code err-out-not-mp4 2 $FI --master "$B" --out "$RUN/err/out.wav" --pattern 15:5,10,14 --no-audio
code err-no-cadence 2 $FI --master "$B" --out "$O" --no-audio
code err-noaudio-keep 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --no-audio --keep music
code err-no-master 2 $FI --master "$RUN/err/nosuch.mp4" --out "$O" --pattern 15:5,10,14 --no-audio
code err-qa-no-master 2 $FI --qa "$RUN/finish/final-16x9.mp4" --pattern 15:5,10,14
code err-bad-fps 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --no-audio --fps abc
code err-no-cuts 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --no-audio
echo '{"renderFps": 60, "fps": 30, "frames": 999, "cuts": [696]}' > "$RUN/timeline-wrong.json"
code err-wrong-timeline 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --no-audio --cuts "$RUN/timeline-wrong.json"
code err-bad-cuts 2 $FI --master "$B" --out "$O" --pattern 15:5,10,14 --no-audio --cuts 348,abc
[ -z "$(ls -A "$RUN/err")" ] || rec err-wrote-nothing FAIL "$(ls "$RUN/err")"
# the corner bug, for eyes: TR (n 100), mid fade-out (n 263), BL (n 400)
for n in 100 263 400; do ffmpeg -v error -y -i "$RUN/finish/final-16x9.mp4" -vf "select=eq(n\,$n)" -frames:v 1 "$RUN/finish/bug-n$n.png"; done
echo "$fails failure(s)" | tee -a "$RES"
exit $((fails > 0))
