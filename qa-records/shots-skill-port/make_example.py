# -*- coding: utf-8 -*-
"""Builds the shot writer's worked example from The Lull's own files (manus2-space, 2026-10-23):
the 19 sent H3 prompts (footage/fal/in/*.txt), its shot list (hf01-study/.../shotlist.json) and the casting example's
key-frame stills. Each sent prompt is split into camera + beats + extra + tail and must compile back byte for byte;
the hand-written retake S01-1c-t2 is kept verbatim as a motion.prompt override.
  /usr/bin/python3 -B make_example.py [OUT]   (default: the skill's shots/examples/manus2-space-shots.json)
"""
import json, os, re, sys

HOME = os.path.expanduser('~')
LULL = os.path.join(HOME, 'Downloads/launch-videos/manus2-space')
SHOTLIST = os.path.join(HOME, 'Downloads/launch-videos/hf01-study/storyboard-space/final/shotlist.json')
SKILL = os.path.join(HOME, '.claude/skills/product-launch-sting/video')
CASTING = os.path.join(SKILL, 'casting/examples/manus2-space-casting.json')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SKILL, 'shots/examples/manus2-space-shots.json')
IN = os.path.join(LULL, 'footage/fal/in')

MTAIL = ('Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first '
         'frame. No text, no captions, no logos.')
WRIST = 'The wrist display glows softly but its screen is never readable.'
ATAIL = 'No text, no captions, no logos.'
SENT = re.compile(r'(?<=[.!?;:])\s(?=\S)')


def split(text, tail_name, tail):
    """sent text → (camera, beats, extra, tail): camera = the first sentence; beats = the rest"""
    assert text.endswith(' ' + tail), text[-80:]
    body, extra = text[:-len(tail) - 1], ''
    if body.endswith(' ' + WRIST):
        body, extra = body[:-len(WRIST) - 1], '{WRIST}'
    parts = re.split(r'(?<=[.!?])\s(?=[A-Z])', body)
    camera, beats = parts[0], parts[1:]
    if not beats:                       # one long sentence: keep its first clause as the camera, the rest as one beat
        m = re.match(r'(.+?[:;])\s(.+)$', body)
        camera, beats = (m.group(1), [m.group(2)]) if m else (body, [])
    return camera, beats, extra, '{%s}' % tail_name


def compile_h3(camera, beats, extra, tail, text):
    t = {'MTAIL': MTAIL, 'WRIST': WRIST, 'ATAIL': ATAIL}
    parts = [camera] + beats + [extra and t[extra.strip('{}')], t[tail.strip('{}')]]
    return ' '.join(p for p in parts if p)


def main():
    sl = json.load(open(SHOTLIST, encoding='utf-8'))
    cast = json.load(open(CASTING, encoding='utf-8'))
    stills = cast['stills']
    shots, made = {}, 0
    legs = []
    for s in sl['shots']:
        for l in (s.get('legs') or []):
            legs.append(('%s-%s' % (s['id'], l['leg'].split()[0]), l['sec'], 'MTAIL', MTAIL, s.get('summary', '')))
    for a in sl['ad']['assets']:
        if a.get('motion'):
            legs.append((a['id'], a['sec'], 'ATAIL', ATAIL, a.get('slot', '')))
    for sid, sec, tname, tail, summary in legs:
        text = open(os.path.join(IN, sid + '.txt'), encoding='utf-8').read().rstrip('\n')
        if tname == 'MTAIL' and not text.endswith(' ' + MTAIL):
            tname, tail = 'ATAIL', ATAIL            # S24-24: its own "keep the colours …" sentence, then the short tail
        camera, beats, extra, tname2 = split(text, tname, tail)
        assert compile_h3(camera, beats, extra, tname2, text) == text, sid
        sh = {'sec': sec, 'motion': {'camera': camera, 'beats': beats, 'tail': tname2}}
        if extra:
            sh['motion']['extra'] = extra
        st = stills.get(sid)
        if st:
            job_rel = lambda r: r if ':' in r else os.path.normpath(os.path.join('tools', r))   # spec paths are job-relative
            k = {'prompt': st['prompt'], 'refs': [job_rel(r) for r in st['refs']], 'batch': st['batch'],
                 'dir': st.get('dir', 'keys'), 'meta': st.get('meta', {})}
            if st.get('face'):
                k['face'] = st['face']
            sh['key'] = k
        if summary:
            sh['_note'] = str(summary)[:200]
        shots[sid] = sh
        made += 1
    retake = open(os.path.join(IN, 'S01-1c-t2.txt'), encoding='utf-8').read().rstrip('\n')
    shots['S01-1c-t2'] = {'_note': 'A hand-written retake of S01-1c (the wrench release moved to the first second), kept '
                                   'verbatim; it reuses S01-1c\'s key frame.',
                          'sec': 5, 'motion': {'prompt': retake}}
    spec = {
        '_note': ('Worked example (SHOTS.md): The Lull (manus2-space, 2026-10-23). Every motion prompt compiles back to the '
                  'exact text sent to MiniMax H3; the key frames are the casting example\'s stills, so emit-casting '
                  'rebuilds them. Built by qa/shots-skill-port/make_example.py from the job\'s own files.'),
        'root': '..',
        'casting': 'casting.json',
        'model': 'h3',
        'aspect': '16:9',
        'text': {'MTAIL': MTAIL, 'WRIST': WRIST, 'ATAIL': ATAIL},
        'ban': list(cast.get('ban') or []),
        'people': {'eva': {'sheet': 'eva', 'is': 'the astronaut'}},
        'places': {k: {'loc': k} for k in cast['locations'] if not k.startswith('_')},
        'shots': shots,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(json.dumps(spec, indent=1, ensure_ascii=False) + '\n')
    print('→ %s: %d shots (%d compiled, 1 verbatim retake), every split round-trips' % (OUT, len(shots), made))


if __name__ == '__main__':
    main()
