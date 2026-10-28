#!/bin/bash
# run casting.py against the local mock with a fake key; cwd = $JOB
export OPENAI_BASE_URL=http://127.0.0.1:18931/v1
export OPENAI_API_KEY=sk-fake-review-opus-0000000000000000000000
cd "${JOB:?}" && python3 ~/.claude/skills/product-launch-sting/video/casting/casting.py "$@"; echo "[exit $?]"
