#!/bin/bash
# ctl.sh '["ok","drop"]' [clear]
curl -s -X POST http://127.0.0.1:18931/control -d "{\"script\": $1, \"clear\": ${2:-false}}"; echo
