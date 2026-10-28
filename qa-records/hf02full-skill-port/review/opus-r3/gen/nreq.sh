#!/bin/bash
curl -s http://127.0.0.1:19960/__log | python3 -c "import json,sys; j=json.load(sys.stdin); print(\"requests at the mock:\", len(j[\"requests\"]))"
