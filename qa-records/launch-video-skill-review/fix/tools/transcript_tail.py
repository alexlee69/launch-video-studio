#!/usr/bin/env python3
# Print the tail of a subagent transcript (.jsonl): assistant text, tool calls and (truncated) tool results, oldest first.
#   python3 -E transcript_tail.py AGENT.jsonl [N_EVENTS=120] [MAX_CHARS=700]
import json, sys
p = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 120; mx = int(sys.argv[3]) if len(sys.argv) > 3 else 700
ev = []
for line in open(p, encoding='utf-8'):
    try: m = json.loads(line)
    except Exception: continue
    ts = (m.get('timestamp') or '')[11:19]
    msg = m.get('message') or {}
    content = msg.get('content')
    if not isinstance(content, list): continue
    for c in content:
        t = c.get('type')
        if m.get('type') == 'assistant' and t == 'text' and c['text'].strip():
            ev.append(f"{ts} SAY  {c['text']}")
        elif m.get('type') == 'assistant' and t == 'tool_use':
            ev.append(f"{ts} CALL {c['name']} {json.dumps(c['input'], ensure_ascii=False)}")
        elif t == 'tool_result':
            r = c.get('content')
            if isinstance(r, list): r = ' '.join(x.get('text', '') for x in r if isinstance(x, dict))
            ev.append(f"{ts} GOT  {r}")
for e in ev[-n:]:
    e = e.replace('\n', ' | ')
    print(e[:mx] + (' …' if len(e) > mx else ''))
