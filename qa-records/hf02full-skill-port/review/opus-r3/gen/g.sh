#!/bin/bash
# opus r3 review: run the r3 SNAPSHOT's gen.mjs against the local mock only, with a fake key and a fake empty HOME
O=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/opus-r3
G=${GEN:-/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage-r3-after-opus-fixes/product-launch-sting/video/footage/gen.mjs}
exec env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin HOME=$O/gen/home LANG=C LC_ALL=C \
  FAL_QUEUE_URL=http://127.0.0.1:19960 FAL_KEY=FAKEKEY-opusr3-0123456789abcdef:fedcba9876543210 \
  FAL_DL_ATTEMPTS=${FAL_DL_ATTEMPTS:-4} FAL_DL_TIMEOUT=${FAL_DL_TIMEOUT:-20} node "$G" "$@"
