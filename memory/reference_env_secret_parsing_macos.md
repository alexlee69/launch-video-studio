---
name: env-secret-parsing-macos
description: "Read .env secrets with Python, never sed: macOS BSD sed has no \\s, so it strips a character and the API echoes the masked key"
metadata:
  type: reference
---

On 2026-10-23, `sed -E 's/^[^=]*=\s*//'` on macOS turned `OPENAI_API_KEY=sk-proj-…` into `k-proj-…`. BSD sed has no `\s`, so it
read `\s*` as a literal `s`. OpenAI then answered 401 and echoed the key, masked except its first and last characters, into
the transcript.

**How to apply:** read secrets from a `.env` file with Python:
- `re.match(r'\s*(?:export\s+)?KEY\s*=\s*(.*)$', line)`, then strip the quotes;
- check that the value has the expected prefix (`sk-`);
- scrub key-like strings from any error message before printing it.

Prove access with a free call first (`GET /v1/models/<model>`). Related: [[hf01-manus2-recreation]].
