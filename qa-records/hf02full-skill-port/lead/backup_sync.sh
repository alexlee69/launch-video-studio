#!/bin/bash
# Sync the live launch-video skill + jobs into the personal backup clone (alexlee69/launch-video-studio), following the
# README's rules: no regenerable output (out/, clips/, layers/, review/, frames, stems, logs), no node_modules, no secrets,
# and nothing that carries another film's frames or audio (ref/ media, comparison sheets, PRIVATE temp tracks).
#   bash backup_sync.sh          dry run: print what would change, write nothing
#   bash backup_sync.sh --go     sync (no git commands; commit and push are separate steps)
set -u
B=$HOME/Downloads/launch-video-studio; L=$HOME/.claude/skills/product-launch-sting; D=$HOME/Downloads/launch-videos
M=$HOME/.claude/projects/-Users-bytedance-Downloads-Design-AutoPilot/memory
N=--dry-run; [ "${1:-}" = "--go" ] && N=
[ -d $B/.git ] || { echo "no backup clone at $B"; exit 2; }
R() { rsync -a --itemize-changes $N "$@" | grep -v '^\.d\.\.t\.\.\.\.\.\. ' ; }   # hide folder-timestamp-only lines
COMMON=(--exclude node_modules --exclude __pycache__/ --exclude .DS_Store --exclude frames/ --exclude '*.log' --exclude '.env*')
JOB=(--exclude /out/ --exclude /clips/ --exclude /layers/ --exclude /review/ --exclude /audio/ --exclude /ref/ --exclude /baseline/)

echo "== skill (mirror of live)"
R --delete "${COMMON[@]}" $L/ $B/skill/product-launch-sting/

echo "== jobs already in the backup (updated in place)"
for j in cue cue-overlays steady-sample edge-test dark-ui-check layers-probe qa-probe qa-probe2; do
  R --delete "${COMMON[@]}" "${JOB[@]}" $D/$j/ $B/launch-videos/$j/ | sed "s#^#$j: #"; done

echo "== new jobs"
for j in film-sample reel-sample hf02-full hf02-recreate hf02-skill motion-kit-sample shots-demo; do
  [ -z "$N" ] && mkdir -p $B/launch-videos/$j
  R --delete "${COMMON[@]}" "${JOB[@]}" $D/$j/ $B/launch-videos/$j/ | sed "s#^#$j: #"; done

echo "== hf02-full: the paid fal footage (the film's 8 clips + their raw generations, key stills and request logs)"
FAL=$D/hf02-full/out/fal
INC=(--include '*-fit.mp4' --include '*-i2v.mp4' --include '*-key_[0-9].jpg' --include 'plate1-key_1-clean.jpg' --include 'car3-key2*.jpg'
     --include '*.fal.json' --include '*.input.json' --exclude '*')
for v in v2 v3; do
  [ -z "$N" ] && mkdir -p $B/launch-videos/hf02-full/out/fal/$v
  R "${INC[@]}" $FAL/$v/ $B/launch-videos/hf02-full/out/fal/$v/ | sed "s#^#hf02-full/out/fal/$v: #"; done

echo "== measurement data (numbers only, no frames or audio): hf02-full/ref cuts + breakdown, hf02-skill/ref curves"
DATA=(--include '*/' --include '*.json' --include '*.jsonl' --include '*.txt' --include '*.md' --exclude '*' --prune-empty-dirs)
R "${DATA[@]}" --exclude /frames/ --exclude /sheets/ --exclude /audio/ $D/hf02-full/ref/ $B/launch-videos/hf02-full/ref/ | sed 's#^#hf02-full/ref: #'
R "${DATA[@]}" --exclude /frames/ $D/hf02-skill/ref/ $B/launch-videos/hf02-skill/ref/ | sed 's#^#hf02-skill/ref: #'

echo "== manus2-space (The Lull, the hf01 recreation): our cast, stills, paid fal footage and graded plates; the current cut only"
# out/ (9 GB of renders, the PRIVATE temp track and side-by-sides) and audio/ stay on the Mac. Left out as regenerable or
# superseded: the ungraded plates (tools/plates.py rebuilds them from footage/fal), the review sheets, the engine master
# (finish.py's input), cut v0.1, the v1 phone copy, the pre-finish master WAV and the full-size storyboard PDF.
M2=(--exclude /assets/footage/ --exclude /footage/review/ --exclude /stills/review/ --exclude /manus2-space-16x9.mp4
    --exclude /manus2-space-cut-v0.1-16x9.mp4 --exclude /manus2-space-firstcut-phone.mp4 --exclude /manus2-space-master.wav
    --exclude /manus2-space-storyboard-16x9.pdf)
[ -z "$N" ] && mkdir -p $B/launch-videos/manus2-space
R --delete "${COMMON[@]}" "${JOB[@]}" "${M2[@]}" $D/manus2-space/ $B/launch-videos/manus2-space/ | sed 's#^#manus2-space: #'

echo "== hf01-study: text and numbers only (the story, shot list, cut list, sound and overlay measurements), no frames or audio"
H1=(--exclude '*.png' --exclude '*.jpg' --exclude '*.mp4' --exclude '*.wav' --exclude '*.pdf'
    --include '/*.md' --include '/cuts/' --include '/cuts/cuts.json' --include '/cuts/cuts.txt'
    --include '/sound/' --include '/sound/*.json' --include '/sound/*.txt' --include '/overlay/' --include '/overlay/events.json'
    --include '/storyboard-space/' --include '/storyboard-space/final/' --include '/storyboard-space/final/**' --exclude '*')
[ -z "$N" ] && mkdir -p $B/launch-videos/hf01-study
R --delete "${COMMON[@]}" "${H1[@]}" $D/hf01-study/ $B/launch-videos/hf01-study/ | sed 's#^#hf01-study: #'

echo "== memory notes for this work"
for f in feedback_one_skill_per_domain project_cue_painted_short project_launch_video_mode_b project_product_sting_recreation \
         reference_chrome_layer_separation_traps reference_ffmpeg8_mux_traps user_github_account \
         project_hf02_motion_recreation reference_minimax_h3_video_api reference_video_motion_measurement \
         reference_layers_render_speedup project_manus_reel_style_gap reference_instagram_reel_frame_capture \
         project_hf01_manus2_recreation feedback_character_sheet_one_face feedback_keep_reference_story_engine \
         reference_higgsfield_video_guides feedback_work_cadence feedback_ship_draft_first feedback_scratchpad_not_durable \
         feedback_post_processor_over_prompt_mandates reference_env_secret_parsing_macos; do
  R $M/$f.md $B/memory/; done

echo "== qa-records: the video lanes' tests, reports, design notes, patches and unmerged fix worktrees (text and code only)"
# No renders, frames, audio, images, old-skill snapshots, scratch job runs, third-party .skill files or reference media.
QA=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa
TXT=(--include '*/' --include '*.md' --include '*.py' --include '*.sh' --include '*.mjs' --include '*.js' --include '*.cjs'
     --include '*.json' --include '*.jsonl' --include '*.txt' --include '*.yaml' --include '*.yml' --include '*.sha1'
     --include '*.diff' --include '*.patch' --include '*.tmpl.html' --exclude '*' --prune-empty-dirs --max-size=1m --no-links)
QSKIP=(--exclude ref/ --exclude '/stage*/' --exclude /live-before/ --exclude /base/ --exclude /snap/ --exclude /work-A/ --exclude /work-B/
       --exclude /skills/ --exclude /readers/ --exclude /pre1020-skill/ --exclude /pre-skill/ --exclude /stash-full/ --exclude work/
       --exclude '/fix/work-*/' --exclude /fix/regress/ --exclude out/ --exclude monitor/ --exclude /acceptance/runs/ --exclude /qa-runs/
       --exclude 'verify-r*/' --exclude /results/page/ --exclude memory-before/ --exclude .git/)
for d in hf02full-skill-port shots-skill-port storyboard-skill-port cast-skill-port hf01-skill-port launch-video-skill-review motion-kit video-skill-learnings; do
  [ -z "$N" ] && mkdir -p $B/qa-records/$d
  R --delete "${COMMON[@]}" "${QSKIP[@]}" "${TXT[@]}" $QA/$d/ $B/qa-records/$d/ | sed "s#^#qa-records/$d: #" | tail -n +1 | grep -c . | sed "s#^#qa-records/$d: changes #"; done

# the unmerged fix round is a git repo with worktrees: keep its history as one bundle next to the copied worktrees
FB=$B/qa-records/launch-video-skill-review/fix/fix-round-2026-10-22.bundle
heads() { grep " refs/" | LC_ALL=C sort; }   # remake the bundle only when a branch moved (its bytes differ every time)
if [ -f $FB ] && [ "$(git bundle list-heads $FB 2>/dev/null | heads)" = "$(git -C $QA/launch-video-skill-review/fix/main for-each-ref --format='%(objectname) %(refname)' | heads)" ]; then echo "qa-records: fix-round bundle up to date"
elif [ -z "$N" ]; then git -C $QA/launch-video-skill-review/fix/main bundle create $FB --all 2>/dev/null; git bundle verify -q $FB 2>/dev/null && echo "qa-records: fix-round bundle ok"
else echo "qa-records: fix-round bundle would be (re)made"; fi

echo "== handovers"
R /Users/bytedance/Downloads/Design-AutoPilot-stable/HANDOVER-cue-video.md /Users/bytedance/Downloads/Design-AutoPilot-stable/HANDOVER-hf02-motion.md $B/
[ -n "$N" ] && echo "(dry run: nothing written)"
