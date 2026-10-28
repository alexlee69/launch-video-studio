#!/bin/bash
# Set up the launch-video studio on a Mac from this repo: the skill, the jobs, the keys file and Claude's notes, then check
# that it renders the same as the Mac it was made on.
#   bash setup.sh                 check the tools, install what is missing, run the quick check (all storyboards, ~30 s)
#   bash setup.sh --check         change nothing: check the tools, the installed copy, the keys file, then the quick check
#   bash setup.sh --film-check    also re-render the Wayfinch sample's 16:9 film and compare it with the shipped one (~5 min)
#   --force                       replace an installed skill that differs from this repo (the old one is kept as a .bak folder)
#   --releases                    also download the heavy renders from the two GitHub Releases (~1.15 GB, needs gh signed in)
# It never overwrites a job file that already exists, never writes a key and never spends money.
set -u
REPO=$(cd "$(dirname "$0")" && pwd)
SK=$HOME/.claude/skills/product-launch-sting; LV=$HOME/Downloads/launch-videos; LS=$HOME/Downloads/launch-stings
CHECK=0; FILM=0; FORCE=0; REL=0
for a in "$@"; do case $a in --check) CHECK=1;; --film-check) FILM=1;; --force) FORCE=1;; --releases) REL=1;;
  *) echo "unknown option $a (see the top of setup.sh)"; exit 2;; esac; done
BAD=0
ok() { echo "  ok       $*"; }; miss() { echo "  MISSING  $*"; BAD=1; }; note() { echo "  note     $*"; }
made() { awk -v k="$1" '$1 == k { $1 = ""; sub(/^ /, ""); print }' "$REPO/restore/toolchain.txt"; }
vs() { [ "$2" = "$(made "$1")" ] && ok "$1 $2" || note "$1 $2 (the shipped films were made with $(made "$1"); pixels may differ slightly)"; }

echo "== tools"
CHROME=${CHROME_PATH:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
[ "$(uname -s)" = Darwin ] && vs macos "$(sw_vers -productVersion) $(uname -m)" || note "not macOS: only macOS was tested"
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then vs node "$(node -v)"
else miss "Node 18 or newer (brew install node)"; fi
command -v npm >/dev/null || miss "npm (comes with Node)"
if command -v ffmpeg >/dev/null && ffmpeg -version | head -1 | grep -q 'version 8\.'; then vs ffmpeg "$(ffmpeg -version | head -1 | awk '{print $3}')"
else miss "ffmpeg 8 (brew install ffmpeg); the skill's colour and mux fixes are written for 8"; fi
command -v ffprobe >/dev/null || miss "ffprobe (comes with ffmpeg)"
if [ -x "$CHROME" ]; then vs chrome "$("$CHROME" --version | awk '{print $NF}')"
else miss "Google Chrome in /Applications (or set CHROME_PATH)"; fi
command -v curl >/dev/null || miss "curl"
command -v gh >/dev/null && ok "gh $(gh --version | head -1 | awk '{print $3}')" || note "gh not found: needed only for --releases and pushing (brew install gh)"
PY=$(command -v python3 || true)
if [ -z "$PY" ]; then miss "python3 (xcode-select --install)"
else
  if ! "$PY" -c 'import numpy, PIL' 2>/dev/null && [ $CHECK = 0 ]; then
    echo "  installing numpy and Pillow for $PY (user site)"
    "$PY" -m pip install --user -q numpy==2.0.2 pillow==11.3.0 2>/dev/null || "$PY" -m pip install --user -q numpy pillow
  fi
  if "$PY" -c 'import numpy, PIL' 2>/dev/null; then
    vs python "$("$PY" -c 'import sys, numpy, PIL; print(sys.version.split()[0], "numpy", numpy.__version__, "Pillow", PIL.__version__)')"
  else miss "numpy and Pillow for $PY (python3 -m pip install --user numpy pillow)"; fi
fi

echo "== skill -> $SK"
if [ -d "$SK" ] && diff -rq -x node_modules -x .DS_Store -x __pycache__ "$REPO/skill/product-launch-sting" "$SK" >/dev/null; then
  ok "installed, identical to this repo"
elif [ $CHECK = 1 ]; then miss "the installed skill is absent or differs from this repo (run bash setup.sh)"
else
  if [ -d "$SK" ]; then
    if [ $FORCE = 1 ]; then mv "$SK" "$SK.bak-$(date +%Y%m%d-%H%M%S)"; note "the old copy is kept next to it as .bak-<time>"
    else miss "an installed skill differs from this repo; run with --force to replace it (the old one is kept)"; fi
  fi
  if [ ! -d "$SK" ]; then mkdir -p "$(dirname "$SK")" && cp -R "$REPO/skill/product-launch-sting" "$SK" && ok "installed"; fi
fi
for d in "$SK" "$SK/video"; do
  [ -f "$d/package-lock.json" ] || continue
  if [ -d "$d/node_modules" ]; then ok "node packages in ${d#$HOME/}"
  elif [ $CHECK = 1 ]; then miss "node packages in ${d#$HOME/} (run bash setup.sh)"
  else (cd "$d" && npm ci --no-audit --no-fund --loglevel=error) && ok "node packages in ${d#$HOME/}" || miss "npm ci failed in $d"; fi
done

echo "== jobs -> $LV and $LS (existing files are never overwritten)"
for p in "launch-videos:$LV" "launch-stings:$LS"; do
  src=$REPO/${p%%:*}/; dst=${p#*:}
  n=$(rsync -a -n --ignore-existing --out-format='%n' "$src" "$dst/" 2>/dev/null | grep -vc '/$')
  if [ "$n" = 0 ]; then ok "${p%%:*}: every file is in place"
  elif [ $CHECK = 1 ]; then miss "${p%%:*}: $n files not copied yet (run bash setup.sh)"
  else mkdir -p "$dst" && rsync -a --ignore-existing "$src" "$dst/" && ok "${p%%:*}: copied $n files"; fi
done
for j in hf02-full hf02-recreate; do   # these two hand-built jobs use the skill's node packages through a link
  [ -d "$LV/$j" ] || continue
  if [ -e "$LV/$j/node_modules" ]; then ok "$j/node_modules link"
  elif [ $CHECK = 0 ]; then ln -s "$SK/node_modules" "$LV/$j/node_modules" && ok "$j/node_modules link made"; fi
done
for e in cue-painted product-sting; do
  d=$REPO/experiments/$e
  if [ -d "$d/node_modules" ]; then ok "experiments/$e node packages"
  elif [ $CHECK = 0 ]; then (cd "$d" && npm ci --no-audit --no-fund --loglevel=error) && ok "experiments/$e node packages" || note "npm ci failed in experiments/$e"; fi
done
if [ $REL = 1 ] && [ $CHECK = 0 ]; then
  (cd "$LV" && gh release download renders-2026-10-20 -R alexlee69/launch-video-studio -p '*.zip' --skip-existing \
     && unzip -oq cue-clips-layers.zip && unzip -oq cue-overlays-clips-layers.zip \
     && mkdir -p cue/layers && cd cue/layers && gh release download layers-2026-10-20 -R alexlee69/launch-video-studio -p '*.zip' --skip-existing \
     && for z in cue-s*-16x9.zip; do unzip -oq "$z"; done) && ok "release renders unpacked" || miss "release download (is gh signed in as alexlee69?)"
fi

echo "== keys file -> $LV/.env (only the names are checked; values are never printed)"
if [ ! -f "$LV/.env" ] && [ $CHECK = 0 ]; then
  mkdir -p "$LV" && printf 'FAL_KEY=\nOPENAI_API_KEY=\n' > "$LV/.env" && chmod 600 "$LV/.env" && note "made an empty one (chmod 600)"
fi
if [ -f "$LV/.env" ]; then
  for k in FAL_KEY OPENAI_API_KEY; do
    if "${PY:-python3}" - "$LV/.env" "$k" <<'EOF'
import re, sys
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
m = re.search(r'^[ \t]*(?:export[ \t]+)?%s[ \t]*=[ \t]*(.*?)[ \t]*$' % sys.argv[2], t, re.M)
sys.exit(0 if m and m.group(1).strip('\'"') else 1)
EOF
    then ok "$k is set"; else note "$k is empty: paste your own key after $k= in $LV/.env yourself (never into a chat)"; fi
  done
  [ "$(stat -f %Lp "$LV/.env")" = 600 ] || note "run chmod 600 $LV/.env"
else miss "$LV/.env (run bash setup.sh)"; fi

echo "== Claude's notes"
MD=$HOME/.claude/projects/$(printf '%s' "$REPO" | sed 's/[^A-Za-z0-9]/-/g')/memory
n=0; for f in "$REPO"/memory/*.md; do [ -e "$MD/$(basename "$f")" ] || n=$((n + 1)); done
if [ $n = 0 ]; then ok "the $(ls "$REPO"/memory/*.md | wc -l | tr -d ' ') notes are in $MD"
elif [ $CHECK = 1 ]; then note "$n notes not in $MD yet (run bash setup.sh); CLAUDE.md here points Claude at memory/ anyway"
else mkdir -p "$MD" && cp -n "$REPO"/memory/*.md "$MD/" && ok "copied $n notes to $MD"; fi
note "open Claude Code in $REPO: it reads CLAUDE.md, and the notes above load as its memory"

echo "== quick check: all three storyboards of the Wayfinch sample, compared with the shipped ones"
T=$(mktemp -d "${TMPDIR:-/tmp}/lv-check.XXXXXX"); W=$T/motion-kit-sample; SHIP=$REPO/launch-videos/motion-kit-sample
if [ -d "$SK/node_modules" ] && [ -d "$SK/video/node_modules" ] && [ -n "$PY" ]; then
  cp -Rc "$SHIP" "$T/" 2>/dev/null || cp -R "$SHIP" "$T/"
  if node "$SK/video/lv.mjs" --job "$W" --storyboard > "$T/storyboard.log" 2>&1; then
    for a in 16x9 9x16 1x1; do
      printf '  %-5s ' $a; "$PY" "$REPO/restore/compare.py" png "$W/wayfinch-storyboard-$a.png" "$SHIP/wayfinch-storyboard-$a.png" || BAD=1
    done
  else miss "the storyboard render failed: see $T/storyboard.log"; fi
  if [ $FILM = 1 ]; then
    echo "== film check: Wayfinch 16:9, same settings as the shipped render (--workers 2)"
    if node "$SK/video/lv.mjs" --job "$W" --film --aspect 16x9 --workers 2 > "$T/film.log" 2>&1; then
      grep -E 'QA (PASSED|FAILED)' "$T/film.log" | tail -1 | sed 's/^/  /'
      "$PY" "$REPO/restore/compare.py" film "$W/wayfinch-16x9.mp4" "$SHIP/wayfinch-16x9.mp4" "$W/wayfinch-master.wav" "$SHIP/wayfinch-master.wav" \
        | sed 's/^/  /'; [ "${PIPESTATUS[0]}" = 0 ] || BAD=1
    else miss "the film render failed: see $T/film.log"; fi
  fi
else miss "the quick check needs the skill, its node packages and python3 (run bash setup.sh)"; fi

echo
if [ $BAD = 0 ]; then echo "READY: the studio is set up and renders the same as the Mac it was made on. Check files: $T"
else echo "NOT READY: fix the MISSING lines above, then run bash setup.sh again. Check files: $T"; exit 1; fi
