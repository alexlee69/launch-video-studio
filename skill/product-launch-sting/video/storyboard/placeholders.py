#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Placeholder plates: one labelled stand-in still per AI-footage shot, so a footage film can be storyboarded before
anything is generated (STORYBOARD.md). Every pixel is drawn here from gradients and simple shapes: no network, no image
read, nothing spent. A plate is a framing guide, not art: where each person stands and how big, which way they face,
the world's big masses, where the light comes from, and a label naming the shot, its lens and its camera move.

  python3 placeholders.py init   [--spec tools/placeholders.json] [--shots S01,S02,…]   starter spec (never overwrites)
  python3 placeholders.py check  [--spec …]                                             validate only
  python3 placeholders.py draw   [ID …] [--spec …] [--sheet]                            draw every plate (or the IDs named)
  python3 placeholders.py sketch [ID …] [--spec …] [--sheet]                            the same plates as pencil position sketches
  python3 placeholders.py status [--spec …] [--job DIR] [--cut main]                    shots still on placeholder plates

Run it from the job folder. The spec (JSON) sits in the job's tools/ folder; `root` is the job folder relative to it
(it must hold beats.yaml) and `out` the plates folder inside the job. Coordinates are fractions of the plate (0–1; a
little past either edge is fine). Each PNG carries a text chunk `lv-placeholder`, which is how `status`, the phone
storyboard and a redraw know it is a stand-in: `draw` redraws its own plates freely and refuses to replace any other
file. A shot standing on a plate should set `bgMove: none`, `bgDim: 0`, `push: 0`, so the board shows it as drawn.
`sketch` draws the same plates as hand pencil sketches with no text: the position references a key frame's prompt
sends (red people, yellow heads and props, a green ground line, the place in grey), each PNG marked `lv-position`
with its legend in a .json beside it (STORYBOARD.md → Pencil sketches).

Exit codes: 0 done · 1 done with warnings (draw), or shots still on placeholders (status) · 2 refused (a spec error, a
file in the way, a missing library, a stale or missing timeline) · 5 unexpected error · 130 Ctrl-C · 129 / 143 hang-up
or kill (temp files cleaned).
"""
import argparse, json, math, os, re, signal, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
STARTER = os.path.join(HERE, 'starter.json')
MARK = 'lv-placeholder'
SHEET_MARK = b'lv-placeholder-sheet'
SHEET = 'placeholders-sheet.jpg'
ASPECTS = {'16x9': (1920, 1080), '9x16': (1080, 1920), '1x1': (1080, 1080)}
LOOKS = {                                   # vertical gradients, top → bottom
    'space': [(0, '#040509'), (1, '#0a0c12')],
    'night': [(0, '#05070d'), (1, '#141c2e')],
    'dawn': [(0, '#26324f'), (.55, '#c9866a'), (1, '#f2c48d')],
    'dusk': [(0, '#1d1a3a'), (.6, '#8a4a5a'), (1, '#e0875a')],
    'day': [(0, '#6fa8dc'), (1, '#d7ebf8')],
    'overcast': [(0, '#8d969f'), (1, '#d3d8dc')],
    'golden': [(0, '#e9b872'), (1, '#f7e3b5')],
    'interior-warm': [(0, '#2e241d'), (1, '#7d5f45')],
    'interior-cool': [(0, '#1a222b'), (1, '#5d6b79')],
    'office': [(0, '#c9ced4'), (1, '#eceef0')],
    'studio': [(0, '#8a8a8a'), (1, '#8a8a8a')],
}
POSES = ('stand', 'walk', 'sit', 'float', 'bust')
FACING = ('camera', 'left', 'right', 'away')
PROPS = ('phone', 'laptop', 'screen', 'card', 'box', 'ball')
FONTS = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf']
CJK_FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
WHO = {'body': '#e6e8eb', 'accent': '#e8611e', 'skin': '#a7795a', 'hair': '#1b1b1f'}
ID_RE = r'[A-Za-z0-9_][A-Za-z0-9_-]{0,63}'
ID_RULE = 'an id starts with a letter, digit or _, then letters, digits, - or _ (64 at most; it names the file)'

TOP_KEYS = {'_note', 'root', 'out', 'aspect', 'crops', 'kind', 'font', 'cast', 'defaults', 'plates'}
SCENE_KEYS = {'_note', 'look', 'horizon', 'fx', 'shapes', 'props', 'figures'}
PLATE_KEYS = SCENE_KEYS | {'line', 'lens', 'move', 'kind', 'end', 'thirds', 'grain'}
END_KEYS = SCENE_KEYS | {'label'}
FX_KEYS = {                                 # each kind's own keys: a key another kind uses is still a typo here
    'stars': {'_note', 'kind', 'n', 'box', 'seed'},
    'glow': {'_note', 'kind', 'x', 'y', 'r', 'color', 'strength'},
    'rain': {'_note', 'kind', 'n', 'angle', 'alpha', 'seed'},
    'fog': {'_note', 'kind', 'n', 'box', 'color', 'alpha', 'seed'},
    'vignette': {'_note', 'kind', 'strength'},
}
SHAPE_KEYS = {
    'rect': {'_note', 'kind', 'box', 'color', 'alpha', 'blur', 'radius'},
    'ellipse': {'_note', 'kind', 'box', 'color', 'alpha', 'blur'},
    'poly': {'_note', 'kind', 'points', 'color', 'alpha', 'blur'},
    'line': {'_note', 'kind', 'points', 'color', 'alpha', 'blur', 'width'},
}
KEYS = {
    'horizon': {'_note', 'y', 'color', 'color2', 'line'},
    'props': {'_note', 'kind', 'x', 'y', 'w', 'color', 'screen', 'tag', 'front'},
    'figures': {'_note', 'who', 'x', 'feet', 'height', 'pose', 'facing', 'tag', 'body', 'accent', 'skin', 'hair', 'bracket'},
    'cast': {'_note', 'body', 'accent', 'skin', 'hair'},
}


class Refuse(Exception):
    pass


class Stop(BaseException):                  # SIGTERM / SIGHUP: unwind so every `finally` removes its temp file
    pass


def die(code, msg):
    print(('✗ ' if code >= 2 else '! ') + msg, file=sys.stderr)
    sys.exit(code)


def need_libs():
    try:
        import numpy, PIL          # noqa: F401
    except ImportError as e:
        raise Refuse('%s: this tool needs numpy and Pillow for /usr/bin/python3 (pip3 install numpy pillow)' % e)


def short(v):
    s = json.dumps(v)
    return s if len(s) <= 40 else s[:37] + '…'


# ---------------------------------------------------------------- spec
def no_dupes(pairs):
    seen = set()
    for k, _ in pairs:
        if k in seen:
            raise ValueError('duplicate key "%s": a JSON object holds each key once, and the second would silently replace the first' % k)
        seen.add(k)
    return dict(pairs)


def load_spec(path):
    try:
        with open(path, encoding='utf-8') as f:
            spec = json.load(f, object_pairs_hook=no_dupes)
    except FileNotFoundError:
        raise Refuse('no spec at %s (run `placeholders.py init` in the job folder first)' % path)
    except (OSError, ValueError) as e:
        raise Refuse('%s: not readable JSON (%s)' % (path, e))
    if not isinstance(spec, dict):
        raise Refuse('%s: the spec must be a JSON object' % path)
    return spec


def color(v, where, errs):
    if isinstance(v, str) and re.fullmatch(r'#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}', v):
        h = v[1:]
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    errs.append('%s: a colour is "#rgb" or "#rrggbb" (got %s)' % (where, short(v)))
    return (128, 128, 128)


def num(v, where, errs, lo=-.5, hi=1.5, default=None):
    if v is None and default is not None:
        return default
    ok = isinstance(v, (int, float)) and not isinstance(v, bool)
    if ok:
        try:
            ok = math.isfinite(v) and lo <= v <= hi
        except OverflowError:                # an integer too big for a float
            ok = False
    if not ok:
        errs.append('%s: a number from %g to %g (got %s)' % (where, lo, hi, short(v)))
        return default if default is not None else lo
    return float(v)


def flag(v, where, errs, default=False):
    if v is None:
        return default
    if not isinstance(v, bool):
        errs.append('%s: true or false (got %s)' % (where, short(v)))
        return default
    return v


def keys(d, allowed, where, errs):
    if not isinstance(d, dict):
        errs.append('%s: must be an object' % where)
        return False
    bad = sorted(set(d) - allowed)
    if bad:
        errs.append('%s: unknown key%s %s (allowed: %s)' % (where, 's' if len(bad) > 1 else '', ', '.join(bad),
                                                              ', '.join(sorted(allowed - {'_note'}))))
    return True


def holes(v, where, errs):
    """a starter <FILL: …> hint still in the spec"""
    if isinstance(v, str):
        if re.search(r'<FILL:[^<>]*>', v):
            errs.append('%s: replace the <FILL: …> hint first (%s)' % (where, v[:60]))
    elif isinstance(v, dict):
        for k, x in v.items():
            if k != '_note':
                holes(x, '%s.%s' % (where, k), errs)
    elif isinstance(v, list):
        for i, x in enumerate(v):
            holes(x, '%s[%d]' % (where, i), errs)


def parse_look(v, where, errs):
    if isinstance(v, str):
        if v in LOOKS:
            return [(p, color(c, where, errs)) for p, c in LOOKS[v]]
        errs.append('%s: look is one of %s, or stops [[0, "#hex"], …, [1, "#hex"]] (got "%s")' % (where, ', '.join(LOOKS), v[:40]))
        return [(0, (60, 60, 60)), (1, (60, 60, 60))]
    if isinstance(v, list) and len(v) >= 2 and all(isinstance(s, list) and len(s) == 2 for s in v):
        stops = [(num(s[0], '%s[%d][0]' % (where, i), errs, 0, 1, 0), color(s[1], '%s[%d][1]' % (where, i), errs)) for i, s in enumerate(v)]
        if [p for p, _ in stops] != sorted(p for p, _ in stops) or stops[0][0] != 0 or stops[-1][0] != 1:
            errs.append('%s: stops run from 0 to 1 in order' % where)
        return stops
    errs.append('%s: look is one of %s, or stops [[0, "#hex"], …, [1, "#hex"]]' % (where, ', '.join(LOOKS)))
    return [(0, (60, 60, 60)), (1, (60, 60, 60))]


def pts(v, where, errs, n_min):
    if not (isinstance(v, list) and len(v) >= n_min and all(isinstance(p, list) and len(p) == 2 for p in v)):
        errs.append('%s: %d or more points [[x, y], …]' % (where, n_min))
        return [(0, 0)] * n_min
    return [(num(p[0], '%s[%d]' % (where, i), errs), num(p[1], '%s[%d]' % (where, i), errs)) for i, p in enumerate(v)]


def box(v, where, errs):
    if isinstance(v, list) and len(v) == 4:
        b = [num(x, '%s[%d]' % (where, i), errs) for i, x in enumerate(v)]
        if b[2] <= b[0] or b[3] <= b[1]:
            errs.append('%s: [x0, y0, x1, y1] with x1 > x0 and y1 > y0' % where)
        return b
    errs.append('%s: a box [x0, y0, x1, y1] in fractions of the plate' % where)
    return [0, 0, 1, 1]


def text(v, where, errs, limit=200):
    if v is None:
        return None
    if not isinstance(v, str) or not v.strip() or len(v) > limit:
        errs.append('%s: text of 1–%d characters' % (where, limit))
        return None
    return v.strip()


def parse_scene(d, where, errs, cast):
    """the drawable part shared by a plate and its end inset"""
    sc = {'look': parse_look(d.get('look', 'overcast'), where + '.look', errs), 'horizon': None,
          'fx': [], 'shapes': [], 'props': [], 'figures': []}
    h = d.get('horizon')
    if h is not None:
        if keys(h, KEYS['horizon'], where + '.horizon', errs):
            c = color(h.get('color', '#3a3d44'), where + '.horizon.color', errs)
            sc['horizon'] = {'y': num(h.get('y'), where + '.horizon.y', errs, 0, 1),
                             'color': c, 'color2': color(h['color2'], where + '.horizon.color2', errs) if 'color2' in h else tuple(int(x * .7) for x in c),
                             'line': flag(h.get('line'), where + '.horizon.line', errs)}
    for name in ('fx', 'shapes', 'props', 'figures'):
        items = d.get(name, [])
        if not isinstance(items, list):
            errs.append('%s.%s: a list' % (where, name))
            continue
        for i, it in enumerate(items):
            w = '%s.%s[%d]' % (where, name, i)
            if name in ('fx', 'shapes'):
                kinds = FX_KEYS if name == 'fx' else SHAPE_KEYS
                k = it.get('kind') if isinstance(it, dict) else None
                if not isinstance(k, str) or k not in kinds:
                    errs.append('%s.kind: one of %s (got %s)' % (w, ', '.join(kinds), short(k)))
                    continue
                allowed = kinds[k]
            else:
                allowed = KEYS[name]
            if not keys(it, allowed, w, errs):
                continue
            o = PARSE[name](it, w, errs, cast)
            if name == 'figures':
                o['name'] = 'figure %d%s' % (i + 1, ' (%s)' % it['who'] if isinstance(it.get('who'), str) else '')
            elif name == 'props':
                o['name'] = 'prop %d (%s)' % (i + 1, o['kind'])
            sc[name].append(o)
    return sc


def p_fx(it, w, errs, cast):
    k = it['kind']
    o = {'kind': k, 'seed': int(num(it.get('seed'), w + '.seed', errs, 0, 1e6, 7))}
    if k == 'stars':
        o['n'] = int(num(it.get('n'), w + '.n', errs, 1, 5000, 300))
        o['box'] = box(it.get('box', [0, 0, 1, 1]), w + '.box', errs)
    elif k == 'glow':
        o.update(x=num(it.get('x'), w + '.x', errs), y=num(it.get('y'), w + '.y', errs), r=num(it.get('r'), w + '.r', errs, .01, 2, .2),
                 color=color(it.get('color', '#fff2d6'), w + '.color', errs), strength=num(it.get('strength'), w + '.strength', errs, 0, 1, .8))
    elif k == 'rain':
        o.update(n=int(num(it.get('n'), w + '.n', errs, 1, 5000, 400)), angle=num(it.get('angle'), w + '.angle', errs, -60, 60, 12),
                 alpha=num(it.get('alpha'), w + '.alpha', errs, 0, 1, .3))
    elif k == 'fog':
        o.update(n=int(num(it.get('n'), w + '.n', errs, 1, 200, 12)), box=box(it.get('box', [0, .4, 1, 1]), w + '.box', errs),
                 color=color(it.get('color', '#eef1f0'), w + '.color', errs), alpha=num(it.get('alpha'), w + '.alpha', errs, 0, 1, .35))
    elif k == 'vignette':
        o['strength'] = num(it.get('strength'), w + '.strength', errs, 0, 1, .35)
    return o


def p_shape(it, w, errs, cast):
    k = it['kind']
    o = {'kind': k, 'color': color(it.get('color', '#5a5f68'), w + '.color', errs),
         'alpha': num(it.get('alpha'), w + '.alpha', errs, 0, 1, 1), 'blur': num(it.get('blur'), w + '.blur', errs, 0, 200, 0)}
    if k in ('rect', 'ellipse'):
        o['box'] = box(it.get('box'), w + '.box', errs)
        o['radius'] = num(it.get('radius'), w + '.radius', errs, 0, .5, 0)
    else:
        o['points'] = pts(it.get('points'), w + '.points', errs, 3 if k == 'poly' else 2)
        o['width'] = num(it.get('width'), w + '.width', errs, 1, 200, 8)
    return o


def p_prop(it, w, errs, cast):
    k = it.get('kind')
    if not isinstance(k, str) or k not in PROPS:
        errs.append('%s.kind: one of %s (got %s)' % (w, ', '.join(PROPS), short(k)))
    return {'kind': k, 'x': num(it.get('x'), w + '.x', errs), 'y': num(it.get('y'), w + '.y', errs),
            'w': num(it.get('w'), w + '.w', errs, .01, 1, .1), 'color': color(it['color'], w + '.color', errs) if 'color' in it else None,
            'screen': color(it.get('screen', '#e9edf2'), w + '.screen', errs), 'tag': text(it.get('tag'), w + '.tag', errs),
            'front': flag(it.get('front'), w + '.front', errs)}


def p_figure(it, w, errs, cast):
    who = it.get('who')
    base = dict(WHO)
    if who is not None:
        if not isinstance(who, str) or who not in cast:
            errs.append('%s.who: %s is not in cast (cast: %s)' % (w, short(who), ', '.join(cast) or 'none'))
        else:
            base.update(cast[who])
    for k in ('body', 'accent', 'skin', 'hair'):
        if k in it:
            base[k] = it[k]
    cols = {k: color(base[k], '%s.%s' % (w, k), errs) for k in ('body', 'accent', 'skin', 'hair')}
    pose, facing = it.get('pose', 'stand'), it.get('facing', 'camera')
    if not isinstance(pose, str) or pose not in POSES:
        errs.append('%s.pose: one of %s (got %s)' % (w, ', '.join(POSES), short(pose)))
    if not isinstance(facing, str) or facing not in FACING:
        errs.append('%s.facing: one of %s (got %s)' % (w, ', '.join(FACING), short(facing)))
    return {'x': num(it.get('x'), w + '.x', errs), 'feet': num(it.get('feet'), w + '.feet', errs, -.5, 2),
            'height': num(it.get('height'), w + '.height', errs, .02, 3), 'pose': pose, 'facing': facing,
            'tag': text(it.get('tag'), w + '.tag', errs), 'bracket': flag(it.get('bracket'), w + '.bracket', errs, True), 'cols': cols}


PARSE = {'fx': p_fx, 'shapes': p_shape, 'props': p_prop, 'figures': p_figure}


def job_aspects(root):
    """the film's aspects from beats.yaml (`aspects: [16x9, 9x16]` or a block list), or None when it can't tell"""
    try:
        t = open(os.path.join(root, 'beats.yaml'), encoding='utf-8').read()
    except OSError:
        return None
    m = re.search(r'^aspects:[ \t]*\[([^\]\n]*)\]', t, re.M)
    if m:
        items = [x.strip().strip('\'"') for x in m.group(1).split(',') if x.strip()]
    else:
        m = re.search(r'^aspects:[ \t]*(?:#.*)?\n((?:[ \t]+-[ \t]*[^\n]+\n?)+)', t, re.M)
        if not m:
            return None
        items = [re.sub(r'#.*', '', x).strip().lstrip('-').strip().strip('\'"') for x in m.group(1).splitlines()]
    items = [x for x in items if x]
    return items if items and all(x in ASPECTS for x in items) else None


def validate(spec, spec_path):
    """every error at once, before anything is drawn"""
    errs = []
    keys(spec, TOP_KEYS, 'spec', errs)
    holes({k: v for k, v in spec.items() if k != '_note'}, 'spec', errs)
    aspect = spec.get('aspect', '16x9')
    if not isinstance(aspect, str) or aspect not in ASPECTS:
        errs.append('aspect: one of %s (got %s)' % (', '.join(ASPECTS), short(aspect)))
        aspect = '16x9'
    crops = spec.get('crops', [])
    if not isinstance(crops, list) or any(not isinstance(c, str) or c not in ASPECTS for c in crops):
        errs.append('crops: a list of the other aspects the plate is shown in, from %s (got %s)' % (', '.join(ASPECTS), short(crops)))
        crops = []
    crops = [c for c in dict.fromkeys(crops) if c != aspect]
    kind = spec.get('kind', 'AI FOOTAGE')
    if not isinstance(kind, str) or not kind.strip() or len(kind) > 40:
        errs.append('kind: a short label such as "AI FOOTAGE" (got %s)' % short(kind))
        kind = 'AI FOOTAGE'
    sdir = os.path.dirname(os.path.abspath(spec_path))
    root_rel = spec.get('root', '..')
    if not isinstance(root_rel, str) or not root_rel:
        errs.append('root: the job folder, relative to the spec (got %s)' % short(root_rel))
        root_rel = '..'
    root = os.path.realpath(os.path.join(sdir, root_rel))
    if not os.path.isdir(root):
        errs.append('root: %s is not a folder (it is the job folder, relative to the spec)' % root)
    elif not os.path.isfile(os.path.join(root, 'beats.yaml')):
        errs.append('root: %s has no beats.yaml; root is the job folder, relative to the spec (%s)' % (root, sdir))
    out_rel = spec.get('out', 'assets/plates')
    out = os.path.realpath(os.path.join(root, out_rel)) if isinstance(out_rel, str) else root
    if not isinstance(out_rel, str) or os.path.isabs(out_rel) or not (out + os.sep).startswith(root + os.sep) or out == root:
        errs.append('out: a folder inside the job folder, e.g. "assets/plates" (got %s)' % short(out_rel))
    elif os.path.exists(out) and not os.path.isdir(out):
        errs.append('out: %s is a file, not a folder' % out)
    else:
        p = out
        while not os.path.exists(p) and p != root:
            p = os.path.dirname(p)
        if not os.path.isdir(p):
            errs.append('out: %s sits under a file, not a folder' % out)
    font = spec.get('font')
    if font is not None:
        fp = os.path.join(sdir, font) if isinstance(font, str) else None
        if not (fp and os.path.isfile(fp)):
            errs.append('font: a .ttf/.otf/.ttc file, relative to the spec (got %s)' % short(font))
        font = fp
    cast, raw_cast = {}, spec.get('cast', {})
    if not isinstance(raw_cast, dict):
        errs.append('cast: an object of named looks {"hero": {"body": "#hex", …}}')
        raw_cast = {}
    for name, c in raw_cast.items():
        if keys(c, KEYS['cast'], 'cast.%s' % name, errs):
            cast[name] = {k: c[k] for k in ('body', 'accent', 'skin', 'hair') if k in c}
            for k, v in cast[name].items():
                color(v, 'cast.%s.%s' % (name, k), errs)
    defaults = spec.get('defaults', {})
    if keys(defaults, PLATE_KEYS - {'line', 'end'}, 'defaults', errs) is False:
        defaults = {}
    plates = spec.get('plates')
    if not isinstance(plates, dict) or not plates:
        errs.append('plates: an object of plates by shot id, e.g. {"S01": {"line": …}}')
        plates = {}
    seen, parsed = {}, {}
    for pid, p in plates.items():
        w = 'plates.%s' % pid
        if not re.fullmatch(ID_RE, pid):
            errs.append('%s: %s' % (w, ID_RULE))
            continue
        if pid.lower() in seen:
            errs.append('%s: differs from %s only by case; on macOS both would be one file' % (w, seen[pid.lower()]))
            continue
        seen[pid.lower()] = pid
        if not keys(p, PLATE_KEYS, w, errs):
            continue
        d = dict(defaults if isinstance(defaults, dict) else {})
        d.update(p)
        line = text(d.get('line'), w + '.line', errs, 300)
        if line is None and d.get('line') is None:
            errs.append('%s.line: one line on what the shot shows (it goes on the label)' % w)
        lens, move = text(d.get('lens'), w + '.lens', errs, 120), text(d.get('move'), w + '.move', errs, 120)
        pkind = text(d.get('kind'), w + '.kind', errs, 40)
        pl = parse_scene(d, w, errs, cast)
        pl.update(id=pid, line=line or '', lens=lens or '', move=move or '', kind=pkind or kind,
                  thirds=flag(d.get('thirds'), w + '.thirds', errs), grain=num(d.get('grain'), w + '.grain', errs, 0, 30, 4), end=None)
        if d.get('end') is not None:
            e = d['end']
            if keys(e, END_KEYS, w + '.end', errs):
                lab = text(e.get('label'), w + '.end.label', errs, 120)
                if lab is None and e.get('label') is None:
                    errs.append('%s.end.label: what the shot ends on, e.g. "MCU, she looks up"' % w)
                pl['end'] = parse_scene(e, w + '.end', errs, cast)
                pl['end']['label'] = lab or ''
        parsed[pid] = pl
    return {'aspect': aspect, 'size': ASPECTS[aspect], 'crops': crops, 'root': root, 'out': out, 'font': font,
            'plates': parsed, 'job_aspects': job_aspects(root) if os.path.isdir(root) else None}, errs


# ---------------------------------------------------------------- drawing
def find_font(override):
    from PIL import ImageFont
    for f in ([override] if override else []) + FONTS:
        if f and os.path.isfile(f):
            try:
                ImageFont.truetype(f, 20)
            except (OSError, ValueError) as e:
                if f == override:
                    raise Refuse('font: %s is not a font Pillow can read (%s)' % (f, e))
                continue
            return f
    raise Refuse('no bold font found (looked for %s); set "font" in the spec to a .ttf file' % ', '.join(FONTS))


class Canvas:
    def __init__(self, w, h, font):
        from PIL import Image
        self.w, self.h, self.s, self.fontpath = w, h, min(w, h) / 1080.0, font
        self.img = Image.new('RGB', (w, h))

    def X(self, f):
        return f * self.w

    def Y(self, f):
        return f * self.h

    def font(self, px):
        from PIL import ImageFont
        return ImageFont.truetype(self.fontpath, max(8, int(round(px))))

    def layer(self):
        from PIL import Image
        return Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))

    def comp(self, lay, blur=0):
        from PIL import ImageFilter
        if blur:
            lay = lay.filter(ImageFilter.GaussianBlur(blur * self.s))
        base = self.img.convert('RGBA')
        base.alpha_composite(lay)
        self.img = base.convert('RGB')


def gradient(cv, stops, y0=0.0, y1=1.0):
    import numpy as np
    from PIL import Image
    h0, h1 = int(round(cv.Y(y0))), int(round(cv.Y(y1)))
    if h1 <= h0:
        return
    ys = np.linspace(0, 1, h1 - h0)
    col = np.stack([np.interp(ys, [p for p, _ in stops], [c[i] for _, c in stops]) for i in range(3)], axis=1)
    arr = np.asarray(cv.img).copy()
    arr[h0:h1] = np.clip(col[:, None, :], 0, 255).astype(np.uint8)
    cv.img = Image.fromarray(arr)


def rgba(c, a):
    return (c[0], c[1], c[2], int(round(255 * a)))


def draw_fx(cv, f, phase):
    """phase 'back' (stars, glow) or 'front' (rain, fog, vignette)"""
    import numpy as np
    import random
    from PIL import Image, ImageDraw
    k = f['kind']
    rnd = random.Random(f['seed'])
    if phase == 'back' and k == 'stars':
        lay = cv.layer(); d = ImageDraw.Draw(lay)
        x0, y0, x1, y1 = f['box']
        for _ in range(f['n']):
            x, y = cv.X(rnd.uniform(x0, x1)), cv.Y(rnd.uniform(y0, y1))
            r = rnd.choice((.8, 1, 1, 1.4, 2)) * cv.s
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(90, 255)))
        cv.comp(lay)
    elif phase == 'back' and k == 'glow':
        a = np.asarray(cv.img).astype(np.float32)
        yy, xx = np.mgrid[0:cv.h, 0:cv.w]
        r = f['r'] * max(cv.w, cv.h)
        g = np.exp(-((xx - cv.X(f['x'])) ** 2 + (yy - cv.Y(f['y'])) ** 2) / (2 * (r / 2.2) ** 2)) * f['strength']
        a = a * (1 - g[..., None]) + np.array(f['color'], np.float32) * g[..., None]
        cv.img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    elif phase == 'front' and k == 'rain':
        lay = cv.layer(); d = ImageDraw.Draw(lay)
        ang = math.radians(f['angle'])
        for _ in range(f['n']):
            x, y, L = cv.X(rnd.uniform(-.1, 1.1)), cv.Y(rnd.uniform(-.1, 1.0)), rnd.uniform(40, 110) * cv.s
            d.line([x, y, x + math.sin(ang) * L, y + math.cos(ang) * L], fill=(225, 232, 240, int(255 * f['alpha'])), width=max(1, int(2 * cv.s)))
        cv.comp(lay, .6)
    elif phase == 'front' and k == 'fog':
        lay = cv.layer(); d = ImageDraw.Draw(lay)
        x0, y0, x1, y1 = f['box']
        for _ in range(f['n']):
            cx, cy = cv.X(rnd.uniform(x0, x1)), cv.Y(rnd.uniform(y0, y1))
            rw, rh = cv.X(rnd.uniform(.12, .3)), cv.Y(rnd.uniform(.04, .1))
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=rgba(f['color'], f['alpha'] * rnd.uniform(.4, 1)))
        cv.comp(lay, 60)
    elif phase == 'front' and k == 'vignette':
        a = np.asarray(cv.img).astype(np.float32)
        yy, xx = np.mgrid[0:cv.h, 0:cv.w]
        r = np.sqrt(((xx / cv.w - .5) * 2) ** 2 + ((yy / cv.h - .5) * 2) ** 2) / math.sqrt(2)
        a *= (1 - f['strength'] * np.clip(r, 0, 1) ** 2)[..., None]
        cv.img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def draw_shape(cv, sh):
    from PIL import ImageDraw
    lay = cv.layer(); d = ImageDraw.Draw(lay)
    fill = rgba(sh['color'], sh['alpha'])
    if sh['kind'] in ('rect', 'ellipse'):
        x0, y0, x1, y1 = sh['box']
        b = [cv.X(x0), cv.Y(y0), cv.X(x1), cv.Y(y1)]
        if sh['kind'] == 'ellipse':
            d.ellipse(b, fill=fill)
        elif sh['radius']:
            d.rounded_rectangle(b, radius=sh['radius'] * min(b[2] - b[0], b[3] - b[1]) * 2, fill=fill)
        else:
            d.rectangle(b, fill=fill)
    elif sh['kind'] == 'poly':
        d.polygon([(cv.X(x), cv.Y(y)) for x, y in sh['points']], fill=fill)
    elif sh['kind'] == 'line':
        p = [(cv.X(x), cv.Y(y)) for x, y in sh['points']]
        d.line(p, fill=fill, width=max(1, int(round(sh['width'] * cv.s))), joint='curve')
    cv.comp(lay, sh['blur'])


def limb(d, a, b, wd, fill):
    d.line([a, b], fill=fill, width=max(1, int(round(wd))))
    for x, y in (a, b):
        d.ellipse([x - wd / 2, y - wd / 2, x + wd / 2, y + wd / 2], fill=fill)


def sorted_box(a, b):
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]


def draw_figure(cv, fg):
    """a person as a framing guide: head, torso, limbs in the wardrobe's colours. Returns (its pixel bbox, the box that
    must stay inside a crop: the whole figure, or for a bust its head, since a bust's shoulders run past the frame)."""
    from PIL import ImageDraw
    lay = cv.layer(); d = ImageDraw.Draw(lay)
    Hp = fg['height'] * cv.h
    cx, fy = cv.X(fg['x']), cv.Y(fg['feet'])
    mir = -1 if fg['facing'] == 'left' else 1          # walk / sit lead with the facing side
    P = lambda u, v: (cx + mir * u * Hp, fy - v * Hp)
    c = fg['cols']
    body, acc, skin, hair = (rgba(c[k], 1) for k in ('body', 'accent', 'skin', 'hair'))
    shade = rgba(tuple(int(x * .78) for x in c['body']), 1)
    pose = fg['pose']
    if pose == 'bust':
        head_c, head_r = P(0, .64), .2 * Hp
        d.rounded_rectangle(sorted_box(P(-.48, .4), P(.48, -.2)), radius=.16 * Hp, fill=body)        # shoulders, past the frame edge
        d.polygon([P(-.14, .4), P(.14, .4), P(0, .28)], fill=acc)                      # collar
        d.rectangle([cx - .07 * Hp, fy - .5 * Hp, cx + .07 * Hp, fy - .38 * Hp], fill=skin)   # neck
    else:
        head_c, head_r = P(0, .925), .068 * Hp
        tw = .1 * Hp
        if pose == 'sit':
            hip = .42
            d.rounded_rectangle(sorted_box(P(-.1, hip - .02), P(.12, .8)), radius=.05 * Hp, fill=body)
            limb(d, P(.02, hip), P(.27, hip), .1 * Hp, shade)                         # thigh
            limb(d, P(.27, hip), P(.29, .03), .085 * Hp, shade)                      # shin
            limb(d, P(.11, .76), P(.22, .5), .055 * Hp, body)                        # arm to the lap
        else:
            d.rounded_rectangle([cx - tw - .01 * Hp, fy - .82 * Hp, cx + tw + .01 * Hp, fy - .47 * Hp], radius=.05 * Hp, fill=body)
            if pose == 'stand':
                limb(d, P(-.05, .47), P(-.055, .03), .085 * Hp, shade); limb(d, P(.05, .47), P(.055, .03), .085 * Hp, shade)
                limb(d, P(-.14, .78), P(-.15, .5), .055 * Hp, body); limb(d, P(.14, .78), P(.15, .5), .055 * Hp, body)
            elif pose == 'walk':
                limb(d, P(-.03, .47), P(-.13, .03), .085 * Hp, shade); limb(d, P(.03, .47), P(.15, .03), .085 * Hp, shade)
                limb(d, P(-.13, .78), P(-.2, .54), .055 * Hp, body); limb(d, P(.13, .78), P(.21, .55), .055 * Hp, body)
            elif pose == 'float':
                limb(d, P(-.05, .47), P(-.12, .26), .085 * Hp, shade); limb(d, P(-.12, .26), P(-.07, .04), .08 * Hp, shade)
                limb(d, P(.05, .47), P(.13, .27), .085 * Hp, shade); limb(d, P(.13, .27), P(.09, .05), .08 * Hp, shade)
                limb(d, P(-.13, .79), P(-.32, .93), .055 * Hp, body); limb(d, P(.13, .79), P(.32, .93), .055 * Hp, body)
            d.rectangle([cx - tw - .01 * Hp, fy - .65 * Hp, cx + tw + .01 * Hp, fy - .61 * Hp], fill=acc)   # a wardrobe band
        d.rectangle([cx - .022 * Hp, fy - .87 * Hp, cx + .022 * Hp, fy - .8 * Hp], fill=skin)            # neck
    hx, hy = head_c
    d.ellipse([hx - head_r, hy - head_r, hx + head_r, hy + head_r], fill=hair if fg['facing'] == 'away' else skin)
    if fg['facing'] != 'away':
        d.chord([hx - head_r * 1.04, hy - head_r * 1.06, hx + head_r * 1.04, hy + head_r * .5], 180, 360, fill=hair)   # hair cap
        er = max(1.5, head_r * .1)
        ink = (24, 24, 28, 255)
        if fg['facing'] == 'camera':
            for sx in (-1, 1):
                d.ellipse([hx + sx * .36 * head_r - er, hy + .12 * head_r - er, hx + sx * .36 * head_r + er, hy + .12 * head_r + er], fill=ink)
        else:
            s = -1 if fg['facing'] == 'left' else 1
            ex = hx + s * .5 * head_r
            d.ellipse([ex - er, hy + .1 * head_r - er, ex + er, hy + .1 * head_r + er], fill=ink)
            d.polygon([(hx + s * .9 * head_r, hy), (hx + s * 1.18 * head_r, hy + .28 * head_r), (hx + s * .9 * head_r, hy + .36 * head_r)], fill=skin)
    bb = lay.getbbox()
    key = bb
    if pose == 'bust' and bb:
        hb = (int(hx - head_r * 1.2), int(hy - head_r * 1.1), int(hx + head_r * 1.2), int(hy + head_r))
        key = (max(hb[0], 0), max(hb[1], 0), min(hb[2], cv.w), min(hb[3], cv.h))
    cv.comp(lay, .6)
    return bb, key


def draw_prop(cv, pr):
    from PIL import ImageDraw
    lay = cv.layer(); d = ImageDraw.Draw(lay)
    w = pr['w'] * cv.w
    cx, cy = cv.X(pr['x']), cv.Y(pr['y'])
    k = pr['kind']
    dark = rgba(pr['color'] or (22, 23, 27), 1)
    scr = rgba(pr['screen'], 1)
    if k == 'phone':
        h = w * 2.05
        d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=w * .16, fill=dark)
        m = w * .06
        d.rounded_rectangle([cx - w / 2 + m, cy - h / 2 + m, cx + w / 2 - m, cy + h / 2 - m], radius=w * .12, fill=scr)
    elif k == 'laptop':
        h = w * .64
        d.rounded_rectangle([cx - w / 2, cy - h, cx + w / 2, cy], radius=w * .03, fill=dark)
        m = w * .035
        d.rectangle([cx - w / 2 + m, cy - h + m, cx + w / 2 - m, cy - m * .6], fill=scr)
        d.polygon([(cx - w * .5, cy), (cx + w * .5, cy), (cx + w * .58, cy + w * .06), (cx - w * .58, cy + w * .06)], fill=rgba(pr['color'] or (176, 180, 188), 1))
    elif k == 'screen':
        h = w * .58
        d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=w * .02, fill=dark)
        m = w * .025
        d.rectangle([cx - w / 2 + m, cy - h / 2 + m, cx + w / 2 - m, cy + h / 2 - m], fill=scr)
        d.rectangle([cx - w * .03, cy + h / 2, cx + w * .03, cy + h / 2 + w * .12], fill=dark)
        d.rectangle([cx - w * .16, cy + h / 2 + w * .12, cx + w * .16, cy + h / 2 + w * .145], fill=dark)
    elif k == 'card':
        h = w * .62
        d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=w * .07, fill=rgba(pr['color'] or (246, 246, 248), 1))
        for i, f in enumerate((.7, .5, .6)):
            y = cy - h / 2 + h * (.25 + .2 * i)
            d.rounded_rectangle([cx - w * .38, y, cx - w * .38 + w * .76 * f, y + h * .08], radius=h * .04, fill=(196, 199, 206, 255))
    elif k == 'box':
        h = w * .8
        d.rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=rgba(pr['color'] or (190, 150, 104), 1))
        d.rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + h * .08], fill=(0, 0, 0, 40))
    elif k == 'ball':
        d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=rgba(pr['color'] or (220, 90, 60), 1))
    bb = lay.getbbox()
    cv.comp(lay, .6)
    return bb, bb


def dashed_rect(d, b, fill, width, dash):
    x0, y0, x1, y1 = b
    for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
        L = math.hypot(bx - ax, by - ay)
        n = max(1, int(L // (dash * 2)))
        for i in range(n + 1):
            t0, t1 = i * 2 * dash / L, min(1, (i * 2 + 1) * dash / L)
            if t0 >= 1:
                break
            d.line([ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1], fill=fill, width=width)


def pill(cv, d, text, x, y, size, bounds, anchor_bottom=False):
    """a dark tag with white text, kept (and shortened) inside bounds [x0, x1]"""
    f = cv.font(size)
    pad = size * .35
    maxw = bounds[1] - bounds[0]
    tw = d.textlength(text, font=f)
    if tw + 2 * pad > maxw:
        while text and d.textlength(text + '…', font=f) + 2 * pad > maxw:
            text = text[:-1]
        text += '…'
        tw = d.textlength(text, font=f)
    h = size * 1.45
    y0 = y - h if anchor_bottom else y
    x = min(max(x, bounds[0]), bounds[1] - tw - 2 * pad)
    d.rounded_rectangle([x, y0, x + tw + 2 * pad, y0 + h], radius=size * .3, fill=(18, 18, 22, 200))
    d.text((x + pad, y0 + h * .14), text, font=f, fill=(255, 255, 255, 255))


def wrap(d, text, f, maxw):
    lines, cur = [], ''
    for wd in text.split():
        while len(wd) > 1 and d.textlength(wd, font=f) > maxw:      # a word wider than the line: break it
            k = len(wd) - 1
            while k > 1 and d.textlength(wd[:k], font=f) > maxw:
                k -= 1
            if cur:
                lines.append(cur); cur = ''
            lines.append(wd[:k]); wd = wd[k:]
        t = (cur + ' ' + wd).strip()
        if d.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = wd
    if cur:
        lines.append(cur)
    return lines


def missing_glyphs(f, text):
    """characters the font draws as its 'no glyph' box"""
    tofu = f.getmask('\U000F0000')
    ref = (tofu.size, bytes(tofu))
    return [ch for ch in sorted(set(text)) if not ch.isspace() and (f.getmask(ch).size, bytes(f.getmask(ch))) == ref]


def crop_rect(w, h, a):
    tw, th = ASPECTS[a]
    if tw / th < w / h:
        cw = h * tw / th
        return [(w - cw) / 2, 0, (w + cw) / 2, h]
    ch = w * th / tw
    return [0, (h - ch) / 2, w, (h + ch) / 2]


def draw_scene(cv, sc):
    """look, world and people; returns [(name, bbox, crop-check box, tag, bracket)]"""
    gradient(cv, sc['look'])
    for f in sc['fx']:
        draw_fx(cv, f, 'back')
    hz = sc['horizon']
    if hz:
        gradient(cv, [(0, hz['color']), (1, hz['color2'])], hz['y'], 1)
        if hz['line']:
            from PIL import ImageDraw
            lay = cv.layer(); ImageDraw.Draw(lay).line([0, cv.Y(hz['y']), cv.w, cv.Y(hz['y'])], fill=(255, 255, 255, 90), width=max(1, int(2 * cv.s)))
            cv.comp(lay)
    for sh in sc['shapes']:
        draw_shape(cv, sh)
    marks = []
    for pr in [p for p in sc['props'] if not p['front']]:
        marks.append((pr['name'],) + draw_prop(cv, pr) + (pr['tag'], False))
    for fg in sc['figures']:
        marks.append((fg['name'],) + draw_figure(cv, fg) + (fg['tag'], fg['bracket']))
    for pr in [p for p in sc['props'] if p['front']]:
        marks.append((pr['name'],) + draw_prop(cv, pr) + (pr['tag'], False))
    for f in sc['fx']:
        draw_fx(cv, f, 'front')
    return marks


def render(pl, cfg, font):
    """one plate → (PIL image, warnings)"""
    import numpy as np
    from PIL import Image, ImageDraw
    W, H = cfg['size']
    cv = Canvas(W, H, font)
    marks = draw_scene(cv, pl)
    warns = []
    if pl['grain']:
        rng = np.random.default_rng(zlib.crc32(pl['id'].encode('utf-8')))
        a = np.asarray(cv.img).astype(np.float32) + rng.normal(0, pl['grain'], (H, W))[..., None]
        cv.img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    lay = cv.layer(); d = ImageDraw.Draw(lay)
    s = cv.s
    if pl['thirds']:
        for i in (1, 2):
            d.line([W * i / 3, 0, W * i / 3, H], fill=(255, 255, 255, 60), width=max(1, int(2 * s)))
            d.line([0, H * i / 3, W, H * i / 3], fill=(255, 255, 255, 60), width=max(1, int(2 * s)))
    safe = [0, 0, W, H]
    for a in cfg['crops']:
        r = crop_rect(W, H, a)
        safe = [max(safe[0], r[0]), max(safe[1], r[1]), min(safe[2], r[2]), min(safe[3], r[3])]
        dashed_rect(d, r, (255, 255, 255, 150), max(2, int(3 * s)), 18 * s)
        d.text((r[0] + max(14 * s, .07 * (r[2] - r[0])), r[3] - max(40 * s, .07 * (r[3] - r[1])) - 30 * s), '%s crop' % a.replace('x', ':'),
               font=cv.font(24 * s), fill=(255, 255, 255, 190))
        for name, bb, key, _, _ in marks:
            if key and (key[0] < r[0] - 1 or key[2] > r[2] + 1 or key[1] < r[1] - 1 or key[3] > r[3] + 1):
                warns.append('%s: %s leaves the %s crop' % (pl['id'], name, a.replace('x', ':')))
    sw, sh_ = safe[2] - safe[0], safe[3] - safe[1]
    mx, my = max(40 * s, .07 * sw), max(40 * s, .07 * sh_)       # survives the engine's default bg zoom and push
    bounds = (safe[0] + mx, safe[2] - mx)                       # tags keep the label's full margin
    glyphs = []
    for name, bb, key, tag, br in marks:
        if not bb:
            warns.append('%s: %s is entirely off the plate' % (pl['id'], name))
            continue
        pad = 14 * s
        b = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad]
        if br or tag:
            dashed_rect(d, b, (255, 255, 255, 200), max(2, int(3 * s)), 16 * s)
        if tag:
            glyphs.append(tag)
            th = 26 * s * 1.45
            y = b[3] + 10 * s if b[3] + 10 * s + th <= safe[3] - my else b[1] - 10 * s - th     # under the bracket, else over it
            y = min(max(y, safe[1] + my), safe[3] - my - th)                                    # never outside a crop
            pill(cv, d, tag, b[0], y, 26 * s, bounds)
    # the label: laid out first, so the END inset can keep clear of it
    label = ' · '.join(x for x in (pl['kind'], pl['id'], pl['line'], pl['lens'], pl['move']) if x)
    glyphs.append(label)
    maxw = sw - 2 * mx - 44 * s
    size = 44 * s
    while True:
        f = cv.font(size)
        lines = wrap(d, label, f, maxw)
        if len(lines) <= 4 or size <= 28 * s:
            break
        size -= 2 * s
    if len(lines) > 4:
        warns.append('%s: the label runs to %d lines; shorten its line' % (pl['id'], len(lines)))
    lh = size * 1.18
    bx, by = safe[0] + mx, safe[1] + my
    bw, bh = max(d.textlength(t, font=f) for t in lines) + 44 * s, lh * len(lines) + 30 * s
    if pl['end']:
        glyphs.append(pl['end']['label'])
        ph = 22 * s * 1.45 + 10 * s                                # the END pill above the inset
        room = safe[3] - my - (by + bh + 12 * s + ph)              # height free under the label
        ew = min(.3 * sw, .3 * sh_ * W / H)                        # about a third of the crop …
        eh = ew * H / W
        low = max(54 * s, .1 * sh_)
        if eh < low:                                               # … but tall enough to read (a 16:9 plate in a 9:16 crop)
            eh = low
            ew = min(eh * W / H, sw - 2 * mx)
            eh = ew * H / W
        if eh > room:
            eh = room
            ew = eh * W / H
        if eh < 54 * s:
            warns.append('%s: no room for the END inset in the space the label leaves inside every crop, so it is left out'
                         ' (a shorter line leaves more)' % pl['id'])
        else:
            ew, eh = int(ew), int(eh)
            ecv = Canvas(ew, eh, font)
            draw_scene(ecv, pl['end'])
            ex, ey = int(safe[2] - mx - ew), int(safe[3] - my - eh)
            lay.paste(Image.new('RGBA', (ew + 6, eh + 6), (255, 255, 255, 235)), (ex - 3, ey - 3))
            lay.paste(ecv.img.convert('RGBA'), (ex, ey))
            pill(cv, d, 'END · ' + pl['end']['label'], ex - 3, ey - 10 * s, 22 * s, bounds, anchor_bottom=True)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=18 * s, fill=(20, 20, 24, 165))
    for i, t in enumerate(lines):
        d.text((bx + 22 * s, by + 15 * s + i * lh), t, font=f, fill=(255, 255, 255, 255))
    cv.comp(lay)
    miss = sorted(set(ch for t in glyphs for ch in missing_glyphs(f, t)))
    if miss:
        alt = ' (e.g. "%s")' % CJK_FONT if os.path.isfile(CJK_FONT) else ''
        warns.append('%s: the font has no glyph for %s, drawn as boxes; set "font" to one that has%s'
                     % (pl['id'], ''.join(miss[:12]) + ('…' if len(miss) > 12 else ''), alt))
    return cv.img, warns


def is_placeholder(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.format == 'PNG' and MARK in getattr(im, 'text', {})
    except Exception:
        return False


def is_sheet(path, mark=SHEET_MARK):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.format == 'JPEG' and im.info.get('comment') == mark
    except Exception:
        return False


def atomic_save(img, path, **kw):
    tmp = os.path.join(os.path.dirname(path), '.%s.tmp-%d' % (os.path.basename(path), os.getpid()))
    if os.path.lexists(tmp):
        os.unlink(tmp)                          # a leftover (or a link) at the temp path is removed, never written through
    made = False
    try:
        with open(tmp, 'xb') as fh:
            made = True
            img.save(fh, **kw)
        os.replace(tmp, path)
    finally:
        if made and os.path.lexists(tmp):
            os.unlink(tmp)


def save(img, path, meta, mark=MARK):
    """write the plate; an identical one already there is left alone, so a board made from it stays current"""
    import io
    from PIL.PngImagePlugin import PngInfo
    info = PngInfo()
    info.add_text(mark, json.dumps(meta, ensure_ascii=True, sort_keys=True))     # ASCII: always a plain tEXt chunk
    buf = io.BytesIO()
    img.save(buf, format='PNG', pnginfo=info)
    return save_bytes(buf.getvalue(), path)


def save_bytes(data, path):
    """write data unless the file already holds exactly it (True when written)"""
    try:
        if not os.path.islink(path) and os.path.isfile(path) and open(path, 'rb').read() == data:
            return False
    except OSError:
        pass
    tmp = os.path.join(os.path.dirname(path), '.%s.tmp-%d' % (os.path.basename(path), os.getpid()))
    if os.path.lexists(tmp):
        os.unlink(tmp)
    made = False
    try:
        with open(tmp, 'xb') as fh:
            made = True
            fh.write(data)
        os.replace(tmp, path)
    finally:
        if made and os.path.lexists(tmp):
            os.unlink(tmp)
    return True


def sweep_temps(folder):
    """temp files a killed run left behind (only when the process that made one is gone)"""
    for f in os.listdir(folder):
        m = re.fullmatch(r'\..+\.(png|jpg|json)\.tmp-(\d+)', f)
        if not m:
            continue
        try:
            os.kill(int(m.group(2)), 0)
            continue                                    # still running
        except ProcessLookupError:
            pass
        except (PermissionError, OverflowError, ValueError):
            continue
        try:
            os.unlink(os.path.join(folder, f))
        except OSError:
            pass


# ---------------------------------------------------------------- pencil sketches: position references for the AI
# The same plate, drawn as a hand pencil sketch with no text: the people in red, each head and each product or prop in
# yellow, the ground line in green, the place in grey. A key frame's prompt sends it as "the position reference only"
# with the legend (SHOTS.md), so the generated frame takes the plate's blocking and nothing else.
POS_MARK = 'lv-position'
POS_SHEET_MARK = b'lv-position-sheet'
POS_SHEET = 'sketches-sheet.jpg'
PAPER = (243, 239, 230)
INKS = {'grey': (64, 63, 66), 'pencil': (64, 63, 66), 'red': (196, 48, 40), 'yellow': (226, 170, 24), 'green': (46, 140, 70)}
# grey is the place, drawn around the people and props (it stops at their edges); pencil is the same grey drawn over
# them: a head's hair, a screen's glass


def lum(c):
    return (.299 * c[0] + .587 * c[1] + .114 * c[2]) / 255


class Pencil:
    """pencil on paper: each ink's coverage builds up stroke by stroke, darker where strokes cross and broken by the
    paper's tooth; the inks multiply like real pencil, so drawing order doesn't matter. Seeded: the same plate draws
    the same bytes."""

    def __init__(self, w, h, seed):
        import numpy as np
        import random
        from PIL import Image
        self.w, self.h, self.s = w, h, min(w, h) / 1080.0
        self.rnd = random.Random(seed)
        self.rng = np.random.default_rng(seed)

        def grain(sx, sy):                          # unit noise on a coarser grid, scaled up: grain stretched sx × sy
            n = self.rng.normal(0, 1, (max(2, int(h / sy)), max(2, int(w / sx))))
            im = Image.fromarray(np.clip(n * 40 + 128, 0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
            a = np.asarray(im).astype(np.float32)
            return (a - a.mean()) / (a.std() + 1e-6)
        fine, fibre, mottle = grain(1, 1), grain(4, 1.2), grain(90 * self.s, 90 * self.s)
        t = .6 * fine + .4 * fibre
        self.tooth = np.clip((t - t.min()) / (t.max() - t.min() + 1e-6), 0, 1)
        yy, xx = np.mgrid[0:h, 0:w]
        r = np.sqrt(((xx / w - .5) * 2) ** 2 + ((yy / h - .5) * 2) ** 2) / math.sqrt(2)
        self.paper = (np.array(PAPER, np.float32)[None, None, :] + (1.3 * mottle + 1.8 * fine)[..., None]) \
            * (1 - .035 * np.clip(r, 0, 1) ** 3)[..., None]
        self.cov = {k: np.zeros((h, w), np.float32) for k in INKS}
        self.used, self.keepout = set(), None

    def path(self, pts, wobble=1.0, overshoot=.04, step=3.0):
        """a hand's line through pts: resampled, bent by two slow waves and a tremor, its ends run on a little.
        Returns (points, u from 0 to 1 along it) or None for a dot."""
        import numpy as np
        P = np.array(pts, np.float64)
        if len(P) < 2:
            return None
        L = np.hypot(*np.diff(P, axis=0).T).sum()
        if L < 1:
            return None
        rnd = self.rnd
        if overshoot:
            v0, v1 = P[0] - P[1], P[-1] - P[-2]
            v0, v1 = v0 / (np.hypot(*v0) + 1e-9), v1 / (np.hypot(*v1) + 1e-9)
            cap = 40 * self.s
            P = np.vstack([P[:1] + v0 * min(L * overshoot * rnd.uniform(.1, 1), cap), P,
                           P[-1:] + v1 * min(L * overshoot * rnd.uniform(.3, 1), cap)])
        cum = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
        L = cum[-1]
        n = max(2, int(L / (step * self.s)) + 1)
        t = np.linspace(0, L, n)
        X, Y = np.interp(t, cum, P[:, 0]), np.interp(t, cum, P[:, 1])
        dx, dy = np.gradient(X), np.gradient(Y)
        nl = np.hypot(dx, dy) + 1e-9
        u = t / L
        amp = wobble * self.s * min(5.0, .5 + .004 * L / self.s)
        d = amp * (.65 * np.sin(2 * math.pi * rnd.uniform(.4, 1.3) * u + rnd.uniform(0, 6.3))
                   + .35 * np.sin(2 * math.pi * rnd.uniform(2, 4.5) * u + rnd.uniform(0, 6.3)))
        tr = self.rng.normal(0, .35 * self.s * wobble, n)
        d += np.convolve(tr, np.ones(3) / 3, mode='same') if n >= 3 else tr
        return np.stack([X - dy / nl * d, Y + dx / nl * d], 1), u

    def pressure(self, u, taper=(.12, .18)):
        """light at the start, firm in the middle, lifting off at the end"""
        import numpy as np
        rnd = self.rnd
        ti, to = taper[0] * rnd.uniform(.6, 1.4), taper[1] * rnd.uniform(.6, 1.4)
        a = np.clip(u / ti, 0, 1)
        b = np.clip((1 - u) / to, 0, 1)
        m = .84 + .16 * np.sin(2 * math.pi * rnd.uniform(.5, 2) * u + rnd.uniform(0, 6.3))
        return (.3 + .7 * a * a * (3 - 2 * a)) * (.12 + .88 * b * b * (3 - 2 * b)) * m

    def ink(self, name, strokes, grain=.6):
        """strokes [(points, pressure, width px)] drawn into one layer, 2× supersampled, then laid on the ink"""
        import numpy as np
        from PIL import Image, ImageDraw
        if not strokes:
            return
        allp = np.vstack([p for p, _, _ in strokes])
        pad = max(w for _, _, w in strokes) + 2
        x0, y0 = max(0, int(allp[:, 0].min() - pad)), max(0, int(allp[:, 1].min() - pad))
        x1, y1 = min(self.w, int(allp[:, 0].max() + pad) + 1), min(self.h, int(allp[:, 1].max() + pad) + 1)
        if x1 <= x0 or y1 <= y0:
            return
        SS = 2
        lay = Image.new('L', ((x1 - x0) * SS, (y1 - y0) * SS), 0)
        d = ImageDraw.Draw(lay)
        for p, pr, w in strokes:
            q = (p - [x0, y0]) * SS
            for i in range(len(q) - 1):
                f = int(round(255 * min(1, (pr[i] + pr[i + 1]) / 2)))
                ww = max(1.0, w * SS * (.65 + .35 * min(1, pr[i])))
                d.line([tuple(q[i]), tuple(q[i + 1])], fill=f, width=int(round(ww)))
                if ww >= 3:
                    rr = ww / 2
                    d.ellipse([q[i][0] - rr, q[i][1] - rr, q[i][0] + rr, q[i][1] + rr], fill=f)
        a = np.asarray(lay.resize((x1 - x0, y1 - y0), Image.BOX)).astype(np.float32) / 255
        a *= (1 - grain) + grain * self.tooth[y0:y1, x0:x1]
        c = self.cov[name][y0:y1, x0:x1]
        c[...] = 1 - (1 - c) * (1 - np.clip(a, 0, 1))
        self.used.add(name)

    def line(self, name, pts, width=2.2, strength=.9, passes=2, wobble=1.0, overshoot=.04, grain=.6):
        """a drawn line; a second pass searches a little off the first, lighter, as a hand does"""
        for k in range(passes):
            r = self.path(pts, wobble * (1 if k == 0 else 1.4), overshoot)
            if r is None:
                return
            p, u = r
            if k:
                p = p + self.rng.normal(0, 1.2 * self.s, 2)
            self.ink(name, [(p, self.pressure(u) * strength * (1 if k == 0 else .55), width * self.s)], grain)

    def loop(self, name, cx, cy, rx, ry, width=2.2, strength=.9, passes=2, grain=.6):
        """an oval drawn in one go: it starts anywhere and runs on past where it began"""
        import numpy as np
        for k in range(passes):
            a0, turn, jr = self.rnd.uniform(0, 2 * math.pi), 1 + self.rnd.uniform(.06, .2), 1 + self.rnd.uniform(-.04, .04)
            n = max(12, int(2 * math.pi * max(rx, ry) / (4 * self.s)))
            ang = a0 + np.linspace(0, 2 * math.pi * turn, n)
            r = self.path(np.stack([cx + rx * jr * np.cos(ang), cy + ry * jr * np.sin(ang)], 1), .7, 0)
            if r is None:
                return
            p, u = r
            self.ink(name, [(p, self.pressure(u, (.08, .12)) * strength * (1 if k == 0 else .55), width * self.s)], grain)

    def mask(self, draw):
        import numpy as np
        from PIL import Image, ImageDraw
        m = Image.new('L', (self.w, self.h), 0)
        draw(ImageDraw.Draw(m))
        return np.asarray(m) > 127

    def hatch(self, name, mask, angle, spacing, strength=.5, width=1.5, grain=.7, ends=.6, maxlen=170):
        """quick parallel strokes across a mask, each stopping a little short of its edge or running past it"""
        import numpy as np
        if name == 'grey' and self.keepout is not None:
            mask = mask & ~self.keepout
        ys, xs = np.nonzero(mask)
        if not len(xs):
            return
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        R = math.hypot(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 2
        th = math.radians(angle)
        ux, uy, nx, ny = math.cos(th), math.sin(th), -math.sin(th), math.cos(th)
        ts = np.arange(-R, R, 2.0)
        sp, strokes = spacing * self.s, []
        c = -R + self.rnd.uniform(0, sp)
        while c < R:
            ix, iy = np.round(cx + c * nx + ts * ux).astype(int), np.round(cy + c * ny + ts * uy).astype(int)
            ok = (ix >= 0) & (ix < self.w) & (iy >= 0) & (iy < self.h)
            inside = np.zeros(len(ts), np.int8)
            inside[ok] = mask[iy[ok], ix[ok]]
            dd = np.diff(np.concatenate([[0], inside, [0]]))
            for a, b in zip(np.nonzero(dd == 1)[0], np.nonzero(dd == -1)[0]):
                ta, tb = ts[a] + self.rnd.gauss(0, ends * sp * .5), ts[b - 1] + self.rnd.gauss(0, ends * sp * .5)
                if tb - ta < 3 * self.s:
                    continue
                at = ta
                while at < tb:                      # a long run is laid as several short strokes, as a hand does
                    ln = min(tb - at, maxlen * self.s * self.rnd.uniform(.5, 1))
                    if tb - at - ln < maxlen * self.s * .25:
                        ln = tb - at
                    r = self.path([(cx + c * nx + at * ux, cy + c * ny + at * uy),
                                   (cx + c * nx + (at + ln) * ux, cy + c * ny + (at + ln) * uy)], .35, 0, 5)
                    if r:
                        strokes.append((r[0], self.pressure(r[1], (.08, .25)) * strength * self.rnd.uniform(.75, 1), width * self.s))
                    at += ln + self.rnd.uniform(1, 7) * self.s
            c += sp * self.rnd.uniform(.8, 1.2)
        self.ink(name, strokes, grain)

    def image(self):
        import numpy as np
        from PIL import Image, ImageFilter
        out = self.paper.copy()
        for name in sorted(self.used):
            c = self.cov[name]
            if name == 'grey' and self.keepout is not None:      # the place's lines stop at the people and props
                k = Image.fromarray(self.keepout.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.2 * self.s))
                c = c * (1 - np.asarray(k).astype(np.float32) / 255)
            out *= 1 - c[..., None] * (1 - np.array(INKS[name], np.float32) / 255)
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def sketch_shape(pc, sh):
    """one of the world's masses, outlined and hatched by its tone; returns whether anything was drawn"""
    W, H = pc.w, pc.h
    tone, soft = (1 - lum(sh['color'])) * sh['alpha'], sh['blur'] > 20      # a soft mass gets tone, no outline
    edges = lambda P: [pc.line('grey', [a, b], 1.9, .7, 1 + (pc.rnd.random() < .5), overshoot=.06) for a, b in zip(P, P[1:] + P[:1])]
    if sh['kind'] == 'line':
        pc.line('grey', [(x * W, y * H) for x, y in sh['points']], max(1.6, sh['width'] * .35), .55 + .3 * tone, 2, overshoot=.03)
        return True
    if sh['kind'] == 'ellipse':
        x0, y0, x1, y1 = sh['box'][0] * W, sh['box'][1] * H, sh['box'][2] * W, sh['box'][3] * H
        if not soft:
            pc.loop('grey', (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 1.9, .7, 2)
        m = pc.mask(lambda d: d.ellipse([x0, y0, x1, y1], fill=255))
    else:
        if sh['kind'] == 'rect':
            x0, y0, x1, y1 = sh['box'][0] * W, sh['box'][1] * H, sh['box'][2] * W, sh['box'][3] * H
            P = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        else:
            P = [(x * W, y * H) for x, y in sh['points']]
        if not soft:
            edges(P)
        m = pc.mask(lambda d: d.polygon(P, fill=255))
    if tone > .12:
        ang = 45 + pc.rnd.uniform(-6, 6)
        pc.hatch('grey', m, ang, 28 - 18 * tone, .2 + .32 * tone, 1.4)
        if tone > .6:
            pc.hatch('grey', m, ang + 90 + pc.rnd.uniform(-8, 8), 30 - 16 * tone, .15 + .2 * tone, 1.3)
    return not soft or tone > .12


def sketch_fx(pc, f):
    """the light (a sun, when it is in the frame) and the weather; returns whether anything was drawn"""
    W, H, s, rnd = pc.w, pc.h, pc.s, pc.rnd
    k = f['kind']
    if k == 'glow' and not (0 <= f['x'] <= 1 and 0 <= f['y'] <= 1):
        return False
    if k == 'glow':                                                  # the light: a sun with rays
        cx, cy, r = f['x'] * W, f['y'] * H, 26 * s
        pc.loop('grey', cx, cy, r, r, 1.8, .7, 2)
        for i in range(10):
            a = 2 * math.pi * i / 10 + rnd.uniform(-.12, .12)
            pc.line('grey', [(cx + math.cos(a) * r * 1.5, cy + math.sin(a) * r * 1.5),
                             (cx + math.cos(a) * r * 2.3, cy + math.sin(a) * r * 2.3)], 1.6, .6, 1, overshoot=0)
    elif k == 'rain':
        ang = math.radians(f['angle'])
        for _ in range(min(60, max(12, f['n'] // 8))):
            x, y, L = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(30, 70) * s
            pc.line('grey', [(x, y), (x + math.sin(ang) * L, y + math.cos(ang) * L)], 1.2, .35, 1, overshoot=0)
    elif k == 'stars':
        x0, y0, x1, y1 = f['box']
        for _ in range(min(40, max(8, f['n'] // 10))):
            x, y, r = rnd.uniform(x0, x1) * W, rnd.uniform(y0, y1) * H, rnd.uniform(3, 6) * s
            pc.line('grey', [(x - r, y), (x + r, y)], 1.2, .5, 1, overshoot=0)
            pc.line('grey', [(x, y - r), (x, y + r)], 1.2, .5, 1, overshoot=0)
    elif k == 'fog':
        x0, y0, x1, y1 = f['box']
        for _ in range(min(6, f['n'])):
            y, xa, xb = rnd.uniform(y0, y1) * H, rnd.uniform(x0, (x0 + x1) / 2) * W, rnd.uniform((x0 + x1) / 2, x1) * W
            pc.line('grey', [(xa, y), ((xa + xb) / 2, y + rnd.uniform(-8, 8) * s), (xb, y)], 1.3, .3, 1, 2, 0)
    return k != 'vignette'


def sketch_prop(pc, pr):
    """the prop's outline in yellow, shaded in yellow; a screen's glass as a grey line inside. Returns its mask."""
    W, H = pc.w, pc.h
    w, cx, cy, k = pr['w'] * W, pr['x'] * W, pr['y'] * H, pr['kind']
    rect = lambda x0, y0, x1, y1: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    polys, glass = [], None
    if k == 'phone':
        h = w * 2.05
        polys.append(rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
        glass = rect(cx - w * .42, cy - h / 2 + w * .14, cx + w * .42, cy + h / 2 - w * .14)
    elif k == 'laptop':
        h = w * .64
        polys += [rect(cx - w / 2, cy - h, cx + w / 2, cy), [(cx - w * .5, cy), (cx + w * .5, cy), (cx + w * .58, cy + w * .06), (cx - w * .58, cy + w * .06)]]
        glass = rect(cx - w * .46, cy - h + w * .035, cx + w * .46, cy - w * .02)
    elif k == 'screen':
        h = w * .58
        polys += [rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), rect(cx - w * .03, cy + h / 2, cx + w * .03, cy + h / 2 + w * .12),
                  rect(cx - w * .16, cy + h / 2 + w * .12, cx + w * .16, cy + h / 2 + w * .145)]
        glass = rect(cx - w * .47, cy - h / 2 + w * .025, cx + w * .47, cy + h / 2 - w * .025)
    elif k == 'card':
        h = w * .62
        polys.append(rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
    elif k == 'box':
        h, dx, dy = w * .8, w * .16, w * .12
        x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
        polys += [rect(x0, y0, x1, y1), [(x0, y0), (x0 + dx, y0 - dy), (x1 + dx, y0 - dy), (x1, y0)],
                  [(x1, y0), (x1 + dx, y0 - dy), (x1 + dx, y1 - dy), (x1, y1)]]
    elif k == 'ball':
        pc.loop('yellow', cx, cy, w / 2, w / 2, 2.6, 1.0, 2)
        pc.line('yellow', [(cx - w * .42, cy - w * .2), (cx, cy - w * .05), (cx + w * .42, cy - w * .2)], 1.8, .8, 1, overshoot=0)
        m = pc.mask(lambda d: d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=255))
        pc.hatch('yellow', m, 50, 6, .55, 1.6)
        return m
    for P in polys:
        for a, b in zip(P, P[1:] + P[:1]):
            pc.line('yellow', [a, b], 2.6, 1.0, 2, overshoot=.05)
    m = pc.mask(lambda d: [d.polygon(P, fill=255) for P in polys])
    pc.hatch('yellow', m, 50, 6, .55, 1.6)
    if glass:
        for a, b in zip(glass, glass[1:] + glass[:1]):
            pc.line('pencil', [a, b], 1.4, .5, 1, overshoot=.04)
    return m


# A mannequin per pose, in units of the figure's height (u across, mirrored when facing left; v up from the feet). The
# joints follow draw_figure's, so a sketch keeps its plate's blocking: limbs are [(u, v, width), …] from body to tip.
TORSO = [(-.03, .835), (-.12, .8), (-.105, .74), (-.085, .6), (-.1, .49), (0, .455), (.1, .49), (.085, .6), (.105, .74),
         (.12, .8), (.03, .835)]
MANNEQUIN = {
    'stand': {'legs': [[(-.055, .47, .085), (-.055, .25, .065), (-.055, .04, .045)], [(.055, .47, .085), (.055, .25, .065), (.055, .04, .045)]],
              'arms': [[(-.135, .79, .055), (-.145, .645, .045), (-.15, .5, .035)], [(.135, .79, .055), (.145, .645, .045), (.15, .5, .035)]]},
    'walk': {'legs': [[(-.035, .47, .085), (-.085, .25, .065), (-.13, .04, .045)], [(.035, .47, .085), (.1, .26, .065), (.15, .04, .045)]],
             'arms': [[(-.13, .78, .055), (-.17, .66, .045), (-.2, .54, .035)], [(.13, .78, .055), (.175, .665, .045), (.21, .55, .035)]]},
    'float': {'legs': [[(-.05, .47, .085), (-.12, .26, .07), (-.07, .04, .045)], [(.05, .47, .085), (.13, .27, .07), (.09, .05, .045)]],
              'arms': [[(-.13, .79, .055), (-.23, .87, .045), (-.32, .93, .035)], [(.13, .79, .055), (.23, .87, .045), (.32, .93, .035)]]},
    'sit': {'torso': [(-.02, .815), (-.1, .79), (-.09, .73), (-.075, .6), (-.1, .42), (.12, .42), (.1, .6), (.11, .73), (.12, .79), (.04, .815)],
            'legs': [[(.02, .42, .1), (.27, .42, .08), (.29, .04, .05)]],
            'arms': [[(.11, .76, .055), (.17, .63, .045), (.22, .5, .035)]]},
}
BUST = [(-.48, -.2), (-.48, .2), (-.42, .32), (-.25, .39), (-.07, .42), (.07, .42), (.25, .39), (.42, .32), (.48, .2), (.48, -.2)]


def tube(J):
    """joints [(x, y, width px)] → the two side lines of a tapered tube through them"""
    import numpy as np
    P, w = np.array([(x, y) for x, y, _ in J], float), np.array([wd for _, _, wd in J], float)
    T = np.zeros_like(P)
    T[1:-1], T[0], T[-1] = P[2:] - P[:-2], P[1] - P[0], P[-1] - P[-2]
    T /= np.hypot(T[:, 0], T[:, 1])[:, None] + 1e-9
    N = np.stack([-T[:, 1], T[:, 0]], 1) * w[:, None] / 2
    return P + N, P - N


def sketch_figure(pc, fg):
    """a mannequin in red pencil, shaded red; the head a yellow oval whose cross shows where the face looks (a head
    facing away is shaded grey: hair); hands and feet as quick marks. Returns its mask."""
    W, H, s = pc.w, pc.h, pc.s
    Hp, cx, fy = fg['height'] * H, fg['x'] * W, fg['feet'] * H
    mir = -1 if fg['facing'] == 'left' else 1
    P = lambda u, v: (cx + mir * u * Hp, fy - v * Hp)
    pose, side = fg['pose'], fg['facing'] in ('left', 'right')
    limbs, outline, tips = [], [], []                  # tubes in px; the torso's polygon; (point, kind, direction)
    if pose == 'bust':
        (hx, hy), hr = P(0, .64), .2 * Hp
        outline = [P(*q) for q in BUST]
        limbs.append([P(0, .38) + (.14 * Hp,), P(0, .52) + (.12 * Hp,)])
    else:
        (hx, hy), hr = P(0, .925), .068 * Hp
        m = MANNEQUIN[pose]
        outline = [P(*q) for q in m.get('torso', TORSO)]
        for J in m['legs'] + m['arms']:
            limbs.append([P(u, v) + (wd * Hp,) for u, v, wd in J])
        for J in m['legs']:
            fwd = side or pose in ('walk', 'sit')
            du = .06 if fwd else (.03 if J[-1][0] >= 0 else -.03)
            tips.append(('foot', P(J[-1][0], J[-1][1]), P(J[-1][0] + du, .012)))
        for J in m['arms']:
            (u0, v0, _), (u1, v1, _) = J[-2], J[-1]
            L = math.hypot(u1 - u0, v1 - v0) or 1
            tips.append(('hand', P(u1 + (u1 - u0) / L * .02, v1 + (v1 - v0) / L * .02), None))
        limbs.append([P(0, .8) + (.044 * Hp,), P(0, .87) + (.044 * Hp,)])
    sides = [tube(J) for J in limbs]

    def body(d):
        d.polygon(outline, fill=255)
        for a, b in sides:
            d.polygon([tuple(q) for q in a] + [tuple(q) for q in b[::-1]], fill=255)
        for kind, q, _ in tips:
            if kind == 'hand':
                r = .024 * Hp
                d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=255)
    msk = pc.mask(body)
    sp = min(6.0, max(3.2, Hp * .008 / s))
    pc.hatch('red', msk, 58, sp, .72, 1.5)
    pc.hatch('red', msk, 74, sp * 1.5, .45, 1.4)
    if pose == 'bust':
        pc.line('red', outline[1:5], 2.6, .95, 2, overshoot=.03)
        pc.line('red', outline[5:9], 2.6, .95, 2, overshoot=.03)
    else:
        n = len(outline)
        k = 1 if pose != 'sit' else 1
        mid = n // 2
        pc.line('red', outline[1:mid], 2.6, .95, 2, overshoot=.04)              # one side, shoulder to hip
        pc.line('red', outline[mid:n - 1], 2.6, .95, 2, overshoot=.04)          # the other
        pc.line('red', [outline[0], outline[1]], 2.2, .85, 1, overshoot=.08)    # shoulder lines
        pc.line('red', [outline[-1], outline[-2]], 2.2, .85, 1, overshoot=.08)
    for a, b in sides:
        for edge in (a, b):
            pc.line('red', [tuple(q) for q in edge], 2.3, .9, 1, overshoot=.05)
    for kind, q, to in tips:
        if kind == 'hand':
            pc.loop('red', q[0], q[1], .024 * Hp, .028 * Hp, 2.0, .9, 1)
        else:
            pc.line('red', [q, to], 2.6, .95, 1, overshoot=.02)
    head = pc.mask(lambda d: d.ellipse([hx - hr, hy - hr * 1.08, hx + hr, hy + hr * 1.08], fill=255))
    pc.loop('yellow', hx, hy, hr, hr * 1.08, 2.8, 1.0, 2)
    pc.hatch('yellow', head, 50, max(3.5, min(6.5, hr * .08 / s)), .62, 1.6)
    if fg['facing'] == 'away':
        pc.hatch('pencil', head, 45, max(3.5, min(6.5, hr * .07 / s)), .6, 1.4)
        pc.hatch('pencil', head, 130, max(4.5, min(8.0, hr * .09 / s)), .45, 1.3)
        return msk | head
    if fg['facing'] == 'camera':
        cross = [[(hx, hy - .9 * hr), (hx + .04 * hr, hy), (hx, hy + .9 * hr)],
                 [(hx - .85 * hr, hy + .1 * hr), (hx, hy + .17 * hr), (hx + .85 * hr, hy + .1 * hr)]]
    else:
        sg = -1 if fg['facing'] == 'left' else 1
        cross = [[(hx + sg * .45 * hr, hy - .85 * hr), (hx + sg * .62 * hr, hy), (hx + sg * .45 * hr, hy + .85 * hr)],
                 [(hx - sg * .7 * hr, hy + .1 * hr), (hx + sg * .62 * hr, hy + .14 * hr), (hx + sg * .98 * hr, hy + .12 * hr)]]
        pc.line('yellow', [(hx + sg * .93 * hr, hy - .05 * hr), (hx + sg * 1.22 * hr, hy + .3 * hr), (hx + sg * .93 * hr, hy + .4 * hr)],
                2.4, 1.0, 1, overshoot=0)
    for c in cross:
        pc.line('red', c, 1.8, .9, 1, .6, 0)
    return msk | head


def sketch_scene(pc, sc):
    """the plate's scene as a pencil drawing; returns which legend entries it drew"""
    import numpy as np
    W, H, s, rnd = pc.w, pc.h, pc.s, pc.rnd
    keep = np.zeros((H, W), bool)                    # people and props first: the place is drawn around them
    for pr in sc['props']:
        keep |= sketch_prop(pc, pr)
    for fg in sc['figures']:
        keep |= sketch_figure(pc, fg)
    pc.keepout = keep
    hz, place = sc['horizon'], False
    if hz and -.02 <= hz['y'] <= 1.02:
        place = True
        y = hz['y'] * H
        pc.line('grey', [(-.02 * W, y + rnd.uniform(-3, 3) * s), (W * .5, y + rnd.uniform(-4, 4) * s),
                         (1.02 * W, y + rnd.uniform(-3, 3) * s)], 2.0, .75, 2, 1.4, 0)
        tone = 1 - lum(hz['color'])
        if tone > .15 and y < H:
            m = np.zeros((H, W), bool)
            m[int(max(0, y)):, :] = True
            pc.hatch('grey', m, 8 + rnd.uniform(-3, 3), 30 - 16 * tone, .16 + .18 * tone, 1.3)
    for f in sc['fx']:
        place = sketch_fx(pc, f) or place
    for sh in sc['shapes']:
        place = sketch_shape(pc, sh) or place
    groups = []                                       # one ground line for figures standing at about the same height
    for y, x, hp, pose in sorted((f['feet'] * H, f['x'] * W, f['height'] * H, f['pose']) for f in sc['figures']
                                 if f['pose'] in ('stand', 'walk', 'sit')):
        half = (.42 if pose == 'walk' else .36 if pose == 'sit' else .3) * hp
        if groups and abs(y - groups[-1][0]) < .025 * H:
            groups[-1][1], groups[-1][2] = min(groups[-1][1], x - half), max(groups[-1][2], x + half)
        else:
            groups.append([y, x - half, x + half])
    ground = False
    for y, xa, xb in groups:
        if y <= H + 2 * s:
            ground = True
            pc.line('green', [(xa, y + rnd.uniform(-2, 2) * s), ((xa + xb) / 2, y + rnd.uniform(-3, 3) * s),
                              (xb, y + rnd.uniform(-2, 2) * s)], 3.0, 1.0, 2, overshoot=.05)
    return {'people': bool(sc['figures']), 'props': bool(sc['props']), 'ground': ground, 'place': place,
            'away': any(f['facing'] == 'away' for f in sc['figures']),
            'cross': any(f['facing'] != 'away' for f in sc['figures'])}


def legend_for(drew):
    """what each colour stands for, worded for a prompt's MAP LEGEND (only the colours the sketch uses)"""
    lg = {}
    if drew['people']:
        lg['red'] = 'the people: where each one stands and how big they are'
    if drew['people'] or drew['props']:
        what = ' and '.join(x for x, on in (('each head', drew['people']), ('each product or prop', drew['props'])) if on)
        lg['yellow'] = '; '.join([what] + (['the red cross on a head shows which way the face looks'] if drew['cross'] else [])
                                 + (['a head shaded grey all over faces away'] if drew['away'] else []))
    if drew['ground']:
        lg['green'] = 'the ground line their feet stand on'
    if drew['place']:
        lg['grey'] = 'the place: its horizon, its big shapes and where the light comes from'
    return lg


def describe(sc):
    """the sketch in one sentence, for whoever reads the shot spec (never sent as-is: the brief is Alex's words)"""
    xw = lambda x: ('on the far left' if x < .2 else 'left of centre' if x < .42 else 'in the centre' if x <= .58
                    else 'right of centre' if x <= .8 else 'on the far right')
    face = {'camera': 'facing the camera', 'left': 'facing left', 'right': 'facing right', 'away': 'with the back to the camera'}
    parts = []
    for fg in sc['figures']:
        if fg['pose'] == 'bust':
            parts.append('%s, head and shoulders, %s, %s' % (fg['name'], xw(fg['x']), face[fg['facing']]))
            continue
        verb = {'stand': 'stands', 'walk': 'walks', 'sit': 'sits', 'float': 'floats'}[fg['pose']]
        feet = ('' if fg['pose'] == 'float' else ', feet %s' % ('high in the frame' if fg['feet'] < .55 else 'in the lower half'
                if fg['feet'] < .8 else 'near the bottom' if fg['feet'] <= 1.0 else 'below the bottom edge'))
        parts.append('%s %s %s, about %d%% of the frame tall, %s%s' % (fg['name'], verb, xw(fg['x']), round(fg['height'] * 100),
                                                                        face[fg['facing']], feet))
    for pr in sc['props']:
        yw = 'high in the frame' if pr['y'] < .33 else 'at mid height' if pr['y'] < .66 else 'low in the frame'
        parts.append('%s %s, %s' % (pr['name'], xw(pr['x']), yw))
    t = '; '.join(parts) or 'no people or props: the place only'
    return t[0].upper() + t[1:] + '.'


def sketch_plate(raw, pid):
    """what a sketch of this plate draws, every default filled in: a change anywhere else (a tag, the look, the label,
    the lens, a colour the sketch doesn't draw) leaves a sketch current. shots.py hashes this to spot a stale one."""
    d = dict(raw.get('defaults') or {})
    d.update(raw['plates'][pid])
    errs = []
    sc = parse_scene(d, 'plates.' + pid, errs, {k: {} for k in (raw.get('cast') or {})})
    fx = []
    for f in sc['fx']:
        if f['kind'] == 'glow' and 0 <= f['x'] <= 1 and 0 <= f['y'] <= 1:
            fx.append(['glow', f['x'], f['y']])
        elif f['kind'] in ('rain', 'stars', 'fog'):
            fx.append([f['kind'], f['n'], f.get('angle'), f.get('box')])
    hz = sc['horizon']
    flt = lambda v: (float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else [flt(x) for x in v]
                     if isinstance(v, (list, tuple)) else {k: flt(x) for k, x in v.items()} if isinstance(v, dict) else v)
    return flt({'horizon': [hz['y'], lum(hz['color'])] if hz and -.02 <= hz['y'] <= 1.02 else None, 'fx': fx,
            'shapes': [[s['kind'], s.get('box') or s.get('points'), lum(s['color']), s['alpha'], s['blur'] > 20,
                        s['width'] if s['kind'] == 'line' else None] for s in sc['shapes']],
            'props': [[p['name'], p['x'], p['y'], p['w']] for p in sc['props']],
            'figures': [[f['name'], f['x'], f['feet'], f['height'], f['pose'], f['facing']] for f in sc['figures']]})   # 1 == 1.0


def plate_hash(aspect, drawn):
    """shots.py recomputes this from the spec to tell a sketch older than its plate (keep the two in step)"""
    return '%08x' % zlib.crc32(json.dumps({'aspect': aspect, 'plate': drawn}, sort_keys=True, ensure_ascii=True).encode('ascii'))


def is_sketch(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.format == 'PNG' and POS_MARK in getattr(im, 'text', {})
    except Exception:
        return False


def is_sketch_json(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f).get('lv') == 'position'
    except Exception:
        return False


def sketch_sheet(made, cfg, path, font):
    """a contact sheet of the sketches, each with its id under it (the sketches themselves carry no text)"""
    from PIL import Image, ImageDraw, ImageFont
    W, H = cfg['size']
    tw = 640 if W >= H else 360
    th, cols, cap = int(tw * H / W), 3 if W >= H else 5, 34
    rows = (len(made) + cols - 1) // cols
    out = Image.new('RGB', (cols * (tw + 20) + 20, rows * (th + cap + 20) + 20), (236, 236, 240))
    d, f = ImageDraw.Draw(out), ImageFont.truetype(font, 22)
    for k, (pid, img) in enumerate(made):
        x, y = 20 + (k % cols) * (tw + 20), 20 + (k // cols) * (th + cap + 20)
        out.paste(img.resize((tw, th), Image.LANCZOS), (x, y))
        d.text((x, y + th + 6), pid, font=f, fill=(40, 40, 46))
    atomic_save(out, path, format='JPEG', quality=86, comment=POS_SHEET_MARK)
    print('→ %s' % os.path.relpath(path))


# ---------------------------------------------------------------- commands
def cmd_init(a):
    if os.path.lexists(a.spec):
        raise Refuse('%s already exists; edit it, or pass another --spec' % a.spec)
    with open(STARTER, encoding='utf-8') as f:
        st = json.load(f)
    if a.shots:
        ids = [s.strip() for s in a.shots.split(',') if s.strip()]
        bad = [i for i in ids if not re.fullmatch(ID_RE, i)]
        if bad or not ids:
            raise Refuse('--shots: comma-separated shot ids; %s (got %s)' % (ID_RULE, a.shots))
        tpl = next(iter(st['plates'].values()))
        st['plates'] = {i: json.loads(json.dumps(tpl)) for i in ids}
    sdir = os.path.dirname(os.path.abspath(a.spec))
    st['root'] = os.path.relpath(os.getcwd(), sdir)          # the job folder is where init runs
    ja = job_aspects(os.getcwd())
    if ja:                                                  # the plate in the film's first aspect, a crop for each other one
        st['aspect'], st['crops'] = ja[0], ja[1:]
    try:
        os.makedirs(sdir, exist_ok=True)
        with open(a.spec, 'x', encoding='utf-8') as f:
            f.write(json.dumps(st, indent=1, ensure_ascii=False) + '\n')
    except OSError as e:
        raise Refuse('cannot write %s (%s)' % (a.spec, e.strerror or e))
    print('→ %s (%d plates, %s%s). Replace every <FILL: …> hint, then `placeholders.py draw`.'
          % (a.spec, len(st['plates']), st['aspect'], ' + crops ' + ', '.join(st['crops']) if st['crops'] else ''))
    if not os.path.isfile('beats.yaml'):
        print('! there is no beats.yaml here: run init from the job folder (draw will refuse this spec\'s root)', file=sys.stderr)
    return 0


def checked(a):
    spec = load_spec(a.spec)
    cfg, errs = validate(spec, a.spec)
    if errs:
        raise Refuse('%s has %d problem%s; nothing drawn:\n  ' % (a.spec, len(errs), '' if len(errs) == 1 else 's') + '\n  '.join(errs))
    return cfg


def cmd_check(a):
    need_libs()
    cfg = checked(a)
    find_font(cfg['font'])
    print('✓ %s: %d plates, %s%s → %s' % (a.spec, len(cfg['plates']), cfg['aspect'],
                                       ' (crops %s)' % ', '.join(cfg['crops']) if cfg['crops'] else '', os.path.relpath(cfg['out'])))
    return 0


def cmd_draw(a):
    need_libs()
    cfg = checked(a)
    font = find_font(cfg['font'])
    ids = a.ids or list(cfg['plates'])
    unknown = [i for i in ids if i not in cfg['plates']]
    if unknown:
        raise Refuse('not in the spec: %s (plates: %s)' % (', '.join(unknown), ', '.join(cfg['plates'])))
    try:
        os.makedirs(cfg['out'], exist_ok=True)
    except OSError as e:
        raise Refuse('out: cannot make %s (%s)' % (cfg['out'], e))
    sweep_temps(cfg['out'])
    blocked = []
    for i in ids:
        p = os.path.join(cfg['out'], i + '.png')
        if os.path.islink(p) or (os.path.lexists(p) and not is_placeholder(p)):
            blocked.append(p)
    sp = os.path.join(cfg['out'], SHEET)
    if a.sheet and (os.path.islink(sp) or (os.path.lexists(sp) and not is_sheet(sp))):
        blocked.append(sp)
    if blocked:
        raise Refuse('not a file this tool made, so not replaced (move it, or give the plate another id):\n  '
                     + '\n  '.join(os.path.relpath(p) for p in blocked))
    warns, made = [], []
    ja = cfg['job_aspects']
    if ja:
        miss = [x for x in ja if x != cfg['aspect'] and x not in cfg['crops']]
        if miss:
            warns.append('the film is cut to %s too, but the spec has no crop for %s: add "crops": %s so the label stays'
                         ' readable there' % (', '.join(miss), 'it' if len(miss) == 1 else 'them', json.dumps(sorted(set(cfg['crops'] + miss)))))
    for i in ids:
        img, w = render(cfg['plates'][i], cfg, font)
        p = os.path.join(cfg['out'], i + '.png')
        pl = cfg['plates'][i]
        try:
            changed = save(img, p, {'id': i, 'kind': pl['kind'], 'line': pl['line'], 'aspect': cfg['aspect'], 'crops': cfg['crops']})
        except OSError as e:
            raise Refuse('cannot write %s (%s)' % (os.path.relpath(p), e.strerror or e))
        made.append((i, p, img))
        warns += w
        print('→ %s%s' % (os.path.relpath(p), '' if changed else ' (unchanged)'))
    if a.sheet:
        try:
            sheet(made, cfg, sp)
        except OSError as e:
            raise Refuse('cannot write %s (%s)' % (os.path.relpath(sp), e.strerror or e))
    for w in warns:
        print('  ! ' + w)
    rel = os.path.relpath(cfg['out'], cfg['root'])
    print('%d plate%s drawn (free, nothing generated). On each shot: `bg: %s/<ID>.png`, `bgMove: none`, `bgDim: 0`, `push: 0`'
          ' (the board then shows the plate as drawn; the generated clip brings the real camera move).' % (len(made), '' if len(made) == 1 else 's', rel))
    return 1 if warns else 0


def sheet(made, cfg, path):
    from PIL import Image
    W, H = cfg['size']
    tw = 640 if W >= H else 360
    th = int(tw * H / W)
    cols = 3 if W >= H else 5
    rows = (len(made) + cols - 1) // cols
    out = Image.new('RGB', (cols * (tw + 20) + 20, rows * (th + 20) + 20), (236, 236, 240))
    for k, (_, _, img) in enumerate(made):
        out.paste(img.resize((tw, th), Image.LANCZOS), (20 + (k % cols) * (tw + 20), 20 + (k // cols) * (th + 20)))
    atomic_save(out, path, format='JPEG', quality=86, comment=SHEET_MARK)
    print('→ %s' % os.path.relpath(path))


def cmd_sketch(a):
    need_libs()
    cfg = checked(a)
    raw = load_spec(a.spec)
    ids = a.ids or list(cfg['plates'])
    unknown = [i for i in ids if i not in cfg['plates']]
    if unknown:
        raise Refuse('not in the spec: %s (plates: %s)' % (', '.join(unknown), ', '.join(cfg['plates'])))
    try:
        os.makedirs(cfg['out'], exist_ok=True)
    except OSError as e:
        raise Refuse('out: cannot make %s (%s)' % (cfg['out'], e))
    sweep_temps(cfg['out'])
    blocked = []
    for i in ids:
        for p, own in ((os.path.join(cfg['out'], i + '-sketch.png'), is_sketch), (os.path.join(cfg['out'], i + '-sketch.json'), is_sketch_json)):
            if os.path.islink(p) or (os.path.lexists(p) and not own(p)):
                blocked.append(p)
    sp = os.path.join(cfg['out'], POS_SHEET)
    if a.sheet and (os.path.islink(sp) or (os.path.lexists(sp) and not is_sheet(sp, POS_SHEET_MARK))):
        blocked.append(sp)
    if blocked:
        raise Refuse('not a file this tool made, so not replaced (move it, or give the plate another id):\n  '
                     + '\n  '.join(os.path.relpath(p) for p in blocked))
    made = []
    for i in ids:
        pl = cfg['plates'][i]
        W, H = cfg['size']
        pc = Pencil(W, H, zlib.crc32(('sketch:' + i).encode('utf-8')))
        legend = legend_for(sketch_scene(pc, pl))
        img = pc.image()
        h = plate_hash(cfg['aspect'], sketch_plate(raw, i))
        png, side = os.path.join(cfg['out'], i + '-sketch.png'), os.path.join(cfg['out'], i + '-sketch.json')
        info = {'lv': 'position', 'id': i, 'image': i + '-sketch.png', 'aspect': cfg['aspect'], 'plate_hash': h,
                'legend': legend, 'says': describe(pl)}
        try:
            changed = save(img, png, {'id': i, 'aspect': cfg['aspect'], 'plate_hash': h}, mark=POS_MARK)
            changed = save_bytes((json.dumps(info, indent=1, ensure_ascii=False) + '\n').encode('utf-8'), side) or changed
        except OSError as e:
            raise Refuse('cannot write %s (%s)' % (os.path.relpath(png), e.strerror or e))
        made.append((i, img))
        print('→ %s + .json%s' % (os.path.relpath(png), '' if changed else ' (unchanged)'))
    if a.sheet:
        try:
            sketch_sheet(made, cfg, sp, find_font(cfg['font']))
        except OSError as e:
            raise Refuse('cannot write %s (%s)' % (os.path.relpath(sp), e.strerror or e))
    print('%d pencil sketch%s drawn (free, nothing generated): position references for the AI, never a frame of the film.'
          ' A shot sends one with `"position": {"plate": "<ID>"}` in tools/shots.json (SHOTS.md).' % (len(made), '' if len(made) == 1 else 'es'))
    return 0


def cmd_status(a):
    need_libs()
    job = os.path.realpath(a.job) if a.job else None
    if not job:
        if os.path.exists(a.spec):
            spec = load_spec(a.spec)
            r = spec.get('root', '..')
            job = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(a.spec)), r if isinstance(r, str) else '..'))
        else:
            job = os.getcwd()
    import shlex
    tlp = os.path.join(job, 'out', a.cut, 'timeline.json')
    grid = 'node $V/lv.mjs --job %s --grid%s' % (shlex.quote(job), '' if a.cut == 'main' else ' --cut ' + shlex.quote(a.cut))
    try:
        with open(tlp, encoding='utf-8') as f:
            tl = json.load(f)
    except (OSError, ValueError):
        raise Refuse('no timeline at %s: run `%s` first' % (tlp, grid))
    if not isinstance(tl, dict) or not isinstance(tl.get('shots'), list):
        raise Refuse('%s is not a timeline lv.mjs wrote: run `%s` again' % (tlp, grid))
    beats = os.path.join(job, 'beats.yaml')
    if os.path.isfile(beats) and os.path.getmtime(beats) > os.path.getmtime(tlp):
        raise Refuse('beats.yaml changed after %s: run `%s` first, so status reads the shots as they are now'
                     % (os.path.relpath(tlp, job), grid))
    aspects = [x for x in tl.get('aspects') or [] if x in ASPECTS]
    still, moving, kit, unfit, sketched = [], [], [], [], []

    def walk(v, out):
        if isinstance(v, str):
            if re.search(r'\.(png|svg|jpe?g|webp)$', v, re.I) and '\n' not in v and len(v) < 400:
                out.append(v)
        elif isinstance(v, dict):
            for x in v.values():
                walk(x, out)
        elif isinstance(v, list):
            for x in v:
                walk(x, out)
    for s in tl['shots']:
        if not isinstance(s, dict):
            continue
        refs = []
        walk({k: v for k, v in s.items() if k != 'note'}, refs)
        hits = sorted({r for r in refs if is_placeholder(os.path.join(job, r))})
        stand = sorted({r for r in refs if re.search(r'(^|/)placeholder-[^/]*$', r) and r not in hits})
        sk = sorted({r for r in refs if is_sketch(os.path.join(job, r))})
        if sk:
            sketched.append('%s (%s)' % (s.get('id'), ', '.join(sk)))
        if stand:
            kit.append('%s (%s)' % (s.get('id'), ', '.join(stand)))
        if hits:
            still.append((s.get('id'), hits))
            if isinstance(s.get('bg'), str) and s['bg'] in hits:
                m = moves(s)
                if m:
                    moving.append('%s (%s)' % (s.get('id'), ', '.join(m)))
                meta = plate_meta(os.path.join(job, s['bg']))
                shown = [x for x in aspects if x != meta.get('aspect') and x not in (meta.get('crops') or [])]
                if shown:
                    unfit.append('%s (%s)' % (s.get('id'), ', '.join(shown)))
    if kit:
        print('! the starter kit\'s own stand-in stills are still in %s: %s' % ('a shot' if len(kit) == 1 else 'shots', '; '.join(kit)))
    if sketched:
        print('! a pencil position sketch is a reference for the AI, never a frame of the film; it stands in %s: %s. Use the'
              ' plate (<ID>.png) on the board.' % ('a shot' if len(sketched) == 1 else 'shots', '; '.join(sketched)))
    if not still:
        print('✓ no shot in %s uses a placeholder plate' % os.path.relpath(tlp, job))
        return 1 if kit or sketched else 0
    print('%d shot%s still on placeholder plates (storyboard only; generate the footage before the final film):'
          % (len(still), '' if len(still) == 1 else 's'))
    for sid, hits in still:
        print('  %s  %s' % (sid, ', '.join(hits)))
    if moving:
        print('  ! the engine moves, dims or covers these plates, so the board cuts their labels: %s. Set `bgMove: none`,'
              ' `bgDim: 0`, `push: 0` and leave out zoom / offset / pan / move / letterbox on a plate shot.' % '; '.join(moving))
    if unfit:
        print('  ! these plates were drawn with no crop for an aspect the film is cut to, so their labels can be cut there: %s.'
              ' Add the aspect to the spec\'s "crops" and draw again.' % '; '.join(unfit))
    return 1


def plate_meta(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return json.loads(im.text.get(MARK, '{}'))
    except Exception:
        return {}


def moves(s):
    """the shot fields that make the engine move or dim its bg (STORYBOARD.md: a plate shot sets none of them)"""
    out = []
    if s.get('bgMove') != 'none':
        out.append('bgMove')
    if s.get('bgDim') != 0:
        out.append('bgDim')
    if s.get('push') != 0:
        out.append('push')
    z = s.get('zoom')
    if z is not None and (any(v != 1 for v in z.values()) if isinstance(z, dict) else z != 1):
        out.append('zoom')
    for k in ('offset', 'pan', 'move'):
        if s.get(k) not in (None, [], {}, [0, 0]):
            out.append(k)
    if s.get('letterbox') not in (None, False, 0):
        out.append('letterbox')                 # the bars sit over the plate's label
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(prog='placeholders.py', description=__doc__.split('\n\n')[0], allow_abbrev=False)
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('init', 'check', 'draw', 'sketch', 'status'):
        p = sub.add_parser(name, allow_abbrev=False)
        p.add_argument('--spec', default=os.path.join('tools', 'placeholders.json'))
        if name == 'init':
            p.add_argument('--shots', help='comma-separated shot ids, one plate each')
        if name in ('draw', 'sketch'):
            p.add_argument('ids', nargs='*')
            p.add_argument('--sheet', action='store_true', help='also a contact sheet of the %s drawn' % ('plates' if name == 'draw' else 'sketches'))
        if name == 'status':
            p.add_argument('--job', help='the job folder (default: the spec\'s root, else here)')
            p.add_argument('--cut', default='main')
    a = ap.parse_args(argv)

    def stop(signum, frame):
        raise Stop(signum)
    for sig in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, stop)
    try:
        return {'init': cmd_init, 'check': cmd_check, 'draw': cmd_draw, 'sketch': cmd_sketch, 'status': cmd_status}[a.cmd](a)
    except Refuse as e:
        die(2, str(e))
    except KeyboardInterrupt:
        print('\ninterrupted', file=sys.stderr)
        return 130
    except Stop as e:
        print('\nstopped by signal %d' % e.args[0], file=sys.stderr)
        return 128 + e.args[0]
    except Exception as e:                      # noqa: BLE001
        import traceback
        traceback.print_exc()
        die(5, 'unexpected error: %s' % e)


if __name__ == '__main__':
    sys.exit(main())
