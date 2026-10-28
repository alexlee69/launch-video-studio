#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Placeholder plates: one labelled stand-in still per AI-footage shot, so a footage film can be storyboarded before
anything is generated (STORYBOARD.md). Every pixel is drawn here from gradients and simple shapes: no network, no image
read, nothing spent. A plate is a framing guide, not art: where each person stands and how big, which way they face,
the world's big masses, where the light comes from, and a label naming the shot, its lens and its camera move.

  python3 placeholders.py init   [--spec tools/placeholders.json] [--shots S01,S02,…]   starter spec (never overwrites)
  python3 placeholders.py check  [--spec …]                                             validate only
  python3 placeholders.py draw   [ID …] [--spec …] [--sheet]                            draw every plate (or the IDs named)
  python3 placeholders.py status [--spec …] [--job DIR] [--cut main]                    shots still on placeholder plates

Run it from the job folder. The spec (JSON) sits in the job's tools/ folder; `root` is the job folder relative to it
(it must hold beats.yaml) and `out` the plates folder inside the job. Coordinates are fractions of the plate (0–1; a
little past either edge is fine). Each PNG carries a text chunk `lv-placeholder`, which is how `status`, the phone
storyboard and a redraw know it is a stand-in: `draw` redraws its own plates freely and refuses to replace any other
file. A shot standing on a plate should set `bgMove: none`, `bgDim: 0`, `push: 0`, so the board shows it as drawn.

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


def is_sheet(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.format == 'JPEG' and im.info.get('comment') == SHEET_MARK
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


def save(img, path, meta):
    """write the plate; an identical one already there is left alone, so a board made from it stays current"""
    import io
    from PIL.PngImagePlugin import PngInfo
    info = PngInfo()
    info.add_text(MARK, json.dumps(meta, ensure_ascii=True, sort_keys=True))     # ASCII: always a plain tEXt chunk
    buf = io.BytesIO()
    img.save(buf, format='PNG', pnginfo=info)
    data = buf.getvalue()
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
        m = re.fullmatch(r'\..+\.(png|jpg)\.tmp-(\d+)', f)
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
    still, moving, kit, unfit = [], [], [], []

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
    if not still:
        print('✓ no shot in %s uses a placeholder plate' % os.path.relpath(tlp, job))
        return 1 if kit else 0
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
    for name in ('init', 'check', 'draw', 'status'):
        p = sub.add_parser(name, allow_abbrev=False)
        p.add_argument('--spec', default=os.path.join('tools', 'placeholders.json'))
        if name == 'init':
            p.add_argument('--shots', help='comma-separated shot ids, one plate each')
        if name == 'draw':
            p.add_argument('ids', nargs='*')
            p.add_argument('--sheet', action='store_true', help='also a contact sheet of the plates drawn')
        if name == 'status':
            p.add_argument('--job', help='the job folder (default: the spec\'s root, else here)')
            p.add_argument('--cut', default='main')
    a = ap.parse_args(argv)

    def stop(signum, frame):
        raise Stop(signum)
    for sig in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, stop)
    try:
        return {'init': cmd_init, 'check': cmd_check, 'draw': cmd_draw, 'status': cmd_status}[a.cmd](a)
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
