#!/bin/bash
# Undo the 2026-10-27 motion-kit merge on the live skill: the 35 files in promote-files.txt go back to live-before/
# (24 edited files restored, 11 new files removed), then live is checked against live-before.sha1.
#   bash rollback.sh          dry run: list what would change
#   bash rollback.sh --go     restore
set -u
Q=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit; L=${LIVE:-$HOME/.claude/skills/product-launch-sting}   # LIVE: try it on a copy first
GO=0; [ "${1:-}" = "--go" ] && GO=1
while IFS= read -r f; do
  if [ -f "$Q/live-before/$f" ]; then echo "restore $f"; [ $GO = 1 ] && cp -p "$Q/live-before/$f" "$L/$f"
  else echo "remove  $f"; [ $GO = 1 ] && rm -f "$L/$f"; fi
done < "$Q/merge/promote-files.txt"
[ $GO = 1 ] || { echo "(dry run: nothing changed)"; exit 0; }
cd "$L" && find . -type f -not -path './video/node_modules/*' | LC_ALL=C sort | xargs shasum | diff -q - "$Q/live-before.sha1" >/dev/null \
  && echo "live == live-before (rolled back)" || { echo "live differs from live-before.sha1: check by hand"; exit 1; }
