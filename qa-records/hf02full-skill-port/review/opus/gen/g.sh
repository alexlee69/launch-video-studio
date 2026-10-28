#!/bin/bash
# opus review: run the STAGED gen.mjs against the local mock only, with a fake key and a fake empty HOME
O=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/opus
G=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting/video/footage/gen.mjs
exec env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin HOME=$O/gen/home LANG=C LC_ALL=C \
  FAL_QUEUE_URL=http://127.0.0.1:19950 FAL_KEY=FAKEKEY-opus-0123456789abcdef:fedcba9876543210 \
  FAL_DL_ATTEMPTS=${FAL_DL_ATTEMPTS:-4} FAL_DL_TIMEOUT=${FAL_DL_TIMEOUT:-20} node "$G" "$@"
