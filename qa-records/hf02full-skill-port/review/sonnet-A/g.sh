#!/bin/sh
# review wrapper: can only ever reach the local mock, with a fake key and a fake HOME
R=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-A
S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting
export HOME=$R/home
export FAL_QUEUE_URL=http://127.0.0.1:18950
export FAL_KEY=FAKEKEY-sonnetA-0123456789abcdef:fedcba9876543210fedcba98
export LANG=C LC_ALL=C
exec node "$S/video/footage/gen.mjs" "$@"
