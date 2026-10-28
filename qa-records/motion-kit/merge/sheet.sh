#!/bin/bash
# sheet.sh OUT.png FRAMESDIR W COLS i1 i2 … — tiles 60-fps frames (row-major, no labels) at width W each
out=$1; F=$2; w=$3; c=$4; shift 4; n=$#; args=(); fc=""; lay=""
for i in "$@"; do args+=(-i "$F/$(printf %05d $i).png"); done
h=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$F/$(printf %05d $1).png" | awk -F, -v w=$w '{printf "%d", w*$2/$1}')
for k in $(seq 0 $((n-1))); do fc+="[$k:v]scale=$w:$h,pad=$((w+4)):$((h+4)):2:2:white[v$k];"; lay+="$(( (k%c)*(w+4) ))_$(( (k/c)*(h+4) ))|"; done
ins=""; for k in $(seq 0 $((n-1))); do ins+="[v$k]"; done
ffmpeg -v error -y "${args[@]}" -filter_complex "${fc}${ins}xstack=inputs=$n:layout=${lay%|}:fill=white" -frames:v 1 "$out"
