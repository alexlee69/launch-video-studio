# -*- coding: utf-8 -*-
# Casting and key frames on OpenAI gpt-image-2 (CASTING.md): character sheets built the Higgsfield way (one face per
# sheet, flat #8a8a8a, every state its own sheet, faceless costume and prop sheets), location plates, and every film key
# frame made from the locked sheets as image references, never from text alone. Driven by one spec per job
# (DIR/tools/casting.json; worked example: examples/manus2-space-casting.json). Every paid command is a dry run — the
# requests and the quote, no network, nothing written — until --go.
#   python3 casting.py init DIR                              starter DIR/tools/casting.json (the method's prompt templates)
#   python3 casting.py plan [GROUP …]                        every request, its references and the quote; no network
#   python3 casting.py candidates [--only A,B] [--go]        candidate sheets → candidates/cand-NN.png
#   python3 casting.py review candidates                     a numbered contact sheet for the user's phone
#   python3 casting.py lock [--pick cand-02] [--go]          erase the full-body face (+ the spec's fixes), then free:
#                                                            the untouched face put back, the grey pinned
#   python3 casting.py states [--only helmet-off] [--go]     each state / faceless costume / props sheet, grey pinned
#   python3 casting.py locations [--only NAME] [--redo] [--go]   empty 3/4 location plates, 2 variants each
#   python3 casting.py pick NAME v2                          the variant the stills use (locations/NAME.png → NAME-v2.png)
#   python3 casting.py stills --batch identity [--only S01-1c] [--redo] [--go]   key frames, 2 variants each
#   python3 casting.py review stills [--batch identity]      per still: the locked close-up next to its variants
#   python3 casting.py fix ID [--go]                         a one-line edit, then only its box pasted back onto the source
#   python3 casting.py cost                                  every call in the ledger and the total spent
# Free tools (no spec, no network; an existing output needs --force): pin SRC DST [--cols X,X] [--rows Y] [--grey HEX] ·
# paste ORIG EDIT OUT --box x0,y0,x1,y1 [--feather 18] · restore BASE SRC OUT --ellipse cx,cy,rx,ry [--feather 28].
# The spec is found at --spec (default tools/casting.json under the current folder: run from the job folder); its paths
# are relative to the spec file. Key: --env FILE if given, else OPENAI_API_KEY in the environment, else
# ~/Downloads/launch-videos/.env (a line OPENAI_API_KEY=…); never printed, scrubbed from every line written.
# A --go is refused before any network when the ledger's total plus the quote would pass the spec's cap, when a prompt
# holds a ban-list word or an unfilled <placeholder>, when a reference is missing or names no sheet / location in the
# spec, when a box or mask doesn't fit its image, or when an output exists. Variants number on from the highest
# existing one; stills and locations that already have variants are skipped unless --redo (so a batch cut off by an
# error resumes where it stopped); lock, states and fix refuse a second --go, and --rebuild (free, no --go) redoes a
# sheet's free steps from its saved edit. Every request is in the ledger at its estimate BEFORE it is sent (under a lock,
# so two runs at once can't both pass the cap), and its answer replaces that row: a call cut off mid-way, or a Ctrl-C,
# stays counted. Redirects are never followed (they would carry the key). Flags are never abbreviated (--g is not --go).
# Exit codes: 0 done, or a dry run · 1 done, with something to look at (a sheet's grey not pinned, fewer images than
# asked) · 2 bad arguments or
# spec, a refusal · 3 no key · 4 the API failed (an HTTP error, no size accepted, a network error twice, a non-image)
# · 5 an unexpected error (a bug; its traceback is printed) · 130 stopped with Ctrl-C.
import argparse, base64, contextlib, datetime, fcntl, glob, http.client, io, json, math, os, re, socket, sys, time, uuid
from urllib import request as urlreq, error as urlerr, parse as urlparse
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'footage'))
sys.dont_write_bytecode = True                                                   # no __pycache__ in the skill
from _media import die as _die, need_numpy, guard_outputs, temp_beside, publish, discard  # noqa: E402

BASE_URL = (os.environ.get('OPENAI_BASE_URL') or 'https://api.openai.com/v1').rstrip('/')
ENV_DEFAULT = os.path.join(os.path.expanduser('~'), 'Downloads', 'launch-videos', '.env')
SIZES = ['2560x1440', '2048x1152', '1536x1024']        # 2K first (Higgsfield runs sheets at High + 2K); a 400 naming the size steps down
RATES = {'text_in': 5.0, 'image_in': 8.0, 'out': 30.0}  # USD per 1M tokens, per modality; the ledger keeps raw usage to redo it
# Measured on The Lull's 38 calls (2026-10-23, quality high): every 2560x1440 image = 7,370 output tokens; a reference
# costs 1,508 input tokens at 2560x1440 and 1,024 at 1024x1024, counted once per image asked for (n). Any other size is
# unmeasured: it is quoted at the 2560x1440 numbers (a 1024x1024 output measured 7,024, so smaller is not cheaper).
OUT_TOK = {'2560x1440': 7370}
REF_TOK = {(2560, 1440): 1508, (1024, 1024): 1024}

# The method's prompt templates (CASTING.md → The method). A spec's "text" adds snippets and overrides these; any
# {NAME} in a prompt expands, {GREY_HEX} is the spec's grey.
TEXT = {
    'GREY': 'on a flat solid neutral grey background ({GREY_HEX}), seamless, no gradient, no floor, no shadow on the '
            'background, even soft studio light',
    'TAIL': 'Photographic, natural skin texture, unretouched, realistic, not a stock photo. One clean subject, no props, '
            'no text, no labels, no numbers, no watermark.',
    'SHEET': 'A character reference sheet for a film: ONE image with three side-by-side panels of equal width separated '
             'by thin gutters, {GREY}. LEFT panel: a front-facing close-up of the head and shoulders filling the panel, '
             'eyes to camera, the whole face clearly visible. MIDDLE panel: the full body from the front, head to feet, '
             'standing upright and relaxed, arms slightly away from the sides. RIGHT panel: the full body from directly '
             'behind in the same stance.',
    'LOCK': 'This is a character reference sheet in three panels. Make exactly these changes and nothing else. '
            '1) MIDDLE panel (full body, front): erase the face. Leave a soft plain shadow where the face was: no eyes, '
            'no nose, no mouth.',
    'KEEP': 'Keep everything else exactly as it is: the close-up face in the left panel unchanged, the same flat grey, '
            'the same clothes, the same poses, the same framing and layout.',
    'STATE': 'Image 1 is the locked character sheet. Make the same person in a new state as a new sheet with the same '
             'layout, the same flat solid neutral grey background ({GREY_HEX}) and the same face.',
    'FACELESS': 'ONE image of close-up product photographs in a grid of equal tiles with thin gutters, {GREY}, no person '
                'and no face anywhere.',
    'PROP_TAIL': 'Photographic studio product photography, true materials and colours, realistic, not a render, no text, '
                 'no labels, no numbers, no watermark.',
    'PLATE_TAIL': 'Photoreal cinematic film still, visible film grain, slightly soft, true blacks, not a stock photo, no '
                  'people, no text, no logos, no watermark.',
    'PRE_FACE': 'Image 1 is the locked character sheet. The person in its LEFT close-up is the only face to use: keep '
                'exactly that face, skin tone and eyes. Its middle and right panels show the wardrobe from the front and '
                'the back. ',
    'PRE_LOC': 'Image 2 is the location: keep its architecture, materials and design. Do not copy the grey background or '
               'the sheet layout: make one single cinematic film frame, 16:9. ',
}
SNIPPET = re.compile(r'\{([A-Z][A-Z0-9_]*)\}')
SAFE_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,80}$')         # an entry id is one file-name component
PLACEHOLDER = re.compile(r'<[a-z][^<>\n]{0,300}>')
GROUPS = ('candidates', 'lock', 'states', 'locations', 'stills', 'fixes')
KEY = None                                              # set only for --go; every line printed or written is scrubbed of it
WARN = []                                               # sheets whose grey could not be pinned: the run exits 1


def scrub(s):
    s = str(s)
    return s.replace(KEY, '<key>') if KEY else s


def clip(s, n):
    return scrub(s)[:n]                                 # scrub first: a cut through the key would leave its prefix


def die(code, msg):
    _die(code, scrub(msg))


def say(*a):
    print(scrub(' '.join(str(x) for x in a)), flush=True)


def size_of(path):
    from PIL import Image
    try:
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


# ---- the spec
class Spec:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        try:
            self.d = json.load(open(self.path, encoding='utf-8'))
        except OSError as e:
            die(2, '%s: no spec here (%s) — run from the job folder, pass --spec, or start one: casting.py init DIR' % (path, e.strerror))
        except ValueError as e:
            die(2, '%s: not valid JSON (%s)' % (path, e))
        if not isinstance(self.d, dict):
            die(2, '%s: the spec must be a JSON object' % path)
        self.base = os.path.dirname(self.path)
        self.root = self.rel(self.d.get('root', '..'))              # the job folder: req.json and the ledger name refs from here
        dirs = {'candidates': '../cast/candidates', 'locked': '../cast/locked', 'locations': '../stills/locations',
                'stills': '../stills', 'review': '../stills/review'}
        dirs.update(self.d.get('dirs') or {})
        self.dirs = {k: self.rel(v) for k, v in dirs.items()}
        self.ledger = self.rel(self.d.get('ledger', '../cast/ledger.jsonl'))
        self.model = self.d.get('model', 'gpt-image-2')
        self.quality = self.d.get('quality', 'high')
        self.sizes = list(self.d.get('sizes') or SIZES)
        bad = [s for s in self.sizes if not re.fullmatch(r'\d{3,5}x\d{3,5}', str(s))]
        if bad:
            die(2, 'sizes %r: each one WIDTHxHEIGHT, e.g. "2560x1440"' % bad)
        self.rates = dict(RATES, **(self.d.get('rates') or {}))
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 for v in self.rates.values()):
            die(2, 'rates %r: USD per 1M tokens, numbers ≥ 0' % self.rates)
        self.grey = self.d.get('grey', '#8a8a8a')
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', str(self.grey)):
            die(2, 'grey %r: give one hex like #8a8a8a (one grey per project)' % self.grey)
        cap = self.d.get('cap', 10)
        if isinstance(cap, bool) or not isinstance(cap, (int, float)) or not math.isfinite(cap) or cap < 0:
            die(2, 'cap %r: give the spend the user approved, in USD, as a number (e.g. 12)' % cap)
        self.cap = float(cap)
        self.ban = [str(w) for w in self.d.get('ban') or []]
        self.text = dict(TEXT, **{k: str(v) for k, v in (self.d.get('text') or {}).items()})
        self.text['GREY_HEX'] = self.grey
        for g in GROUPS:
            v = self.d.get(g)
            if v is not None and not isinstance(v, dict):
                die(2, '"%s" must be an object of named entries' % g)
            bad = [k for k in (v or {}) if not k.startswith('_') and (not SAFE_ID.match(k) or '..' in k)]
            if bad:
                die(2, '%s: entry id %s — ids become file names: letters, digits, . _ - only, no slashes' % (g, ', '.join(map(repr, bad))))
        for k, e in self.group('stills').items():
            dd = e.get('dir', 'keys') if isinstance(e, dict) else 'keys'
            if not isinstance(dd, str) or not SAFE_ID.match(dd) or '..' in dd:
                die(2, 'stills.%s.dir %r: one folder name under the stills folder' % (k, dd))

    def rel(self, p):
        return p if os.path.isabs(p) else os.path.normpath(os.path.join(self.base, p))

    def name(self, p):                                           # how req.json and the ledger record a file
        return os.path.relpath(os.path.realpath(p), os.path.realpath(self.root))

    def group(self, g):
        return {k: v for k, v in (self.d.get(g) or {}).items() if not k.startswith('_')}

    def sheets(self):
        return list(self.group('lock')) + list(self.group('states'))

    def expand(self, text, where):
        out, seen = str(text), 0
        while SNIPPET.search(out):
            names = set(SNIPPET.findall(out))
            unknown = sorted(n for n in names if n not in self.text)
            if unknown:
                die(2, '%s: unknown snippet %s — define it in the spec\'s "text" (built in: %s)'
                    % (where, ', '.join('{%s}' % n for n in unknown), ', '.join(sorted(TEXT))))
            out = SNIPPET.sub(lambda m: self.text[m.group(1)], out)
            seen += 1
            if seen > 12:
                die(2, '%s: the snippets refer to each other in a loop' % where)
        return out

    def ref(self, r, where):
        kind, _, nm = str(r).partition(':')
        if nm and kind == 'sheet':
            return os.path.join(self.dirs['locked'], nm + '.png')
        if nm and kind == 'loc':
            return os.path.join(self.dirs['locations'], nm + '.png')
        if nm and kind == 'cand':
            return os.path.join(self.dirs['candidates'], nm + '.png')
        if nm and kind not in ('', '.', '..') and '/' not in kind and len(kind) > 1:
            die(2, '%s: reference %r — use sheet:NAME, loc:NAME, cand:NAME or a path' % (where, r))
        return self.rel(str(r))


# ---- cost
def out_tokens(size):
    return OUT_TOK.get(size, OUT_TOK['2560x1440'])


def ref_tokens(path):
    return REF_TOK.get(tuple(size_of(path) or (2560, 1440)), 1508)


def estimate(S, size, prompt, refs, n):
    text = n * (len(prompt) / 4.0 + 16)
    img = n * sum(ref_tokens(r) if os.path.exists(r) else 1508 for r in refs)
    return (text * S.rates['text_in'] + img * S.rates['image_in'] + n * out_tokens(size) * S.rates['out']) / 1e6


def usage_cost(S, u):
    """The cost from the API's usage, or None when the usage is incomplete or not numbers (the estimate stands)."""
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0
    if not isinstance(u, dict):
        return None
    d = u.get('input_tokens_details') or {}
    if not isinstance(d, dict):
        return None
    img, inp, out = d.get('image_tokens', 0), u.get('input_tokens'), u.get('output_tokens')
    txt = d.get('text_tokens', (inp - img) if num(inp) and num(img) else None)
    if not (isinstance(d, dict) and num(img) and num(txt) and num(out) and out > 0):
        return None
    return (txt * S.rates['text_in'] + img * S.rates['image_in'] + out * S.rates['out']) / 1e6


def ledger_rows(S):
    if not os.path.exists(S.ledger):
        return []
    rows = []
    for k, line in enumerate(open(S.ledger, encoding='utf-8'), 1):
        if line.strip():
            try:
                r = json.loads(line)
            except ValueError:
                die(2, '%s line %d is not JSON — fix or move the ledger before spending more' % (S.ledger, k))
            u = r.get('usd', 0) if isinstance(r, dict) else None
            if isinstance(u, bool) or not isinstance(u, (int, float)) or not math.isfinite(u) or u < 0:
                die(2, '%s line %d: usd %r is not a finite amount ≥ 0 — fix the ledger before spending more' % (S.ledger, k, u))
            rows.append(r)
    return rows


def ledger_calls(S):
    """One row per request: its answer replaces the row written before it was sent (same "call" id)."""
    out, at = [], {}
    for r in ledger_rows(S):
        c = r.get('call')
        if c and c in at:
            out[at[c]] = r
        else:
            if c:
                at[c] = len(out)
            out.append(r)
    return out


def spent(S):
    return sum(float(r.get('usd', 0) or 0) for r in ledger_calls(S))


@contextlib.contextmanager
def ledger_lock(S):
    """One process at a time reads the spend, decides against the cap and writes its reservation."""
    os.makedirs(os.path.dirname(S.ledger), exist_ok=True)
    with open(S.ledger + '.lock', 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def log(S, rec):
    os.makedirs(os.path.dirname(S.ledger), exist_ok=True)
    rec = dict({'t': datetime.datetime.now().astimezone().isoformat(timespec='seconds')}, **rec)
    with open(S.ledger, 'a', encoding='utf-8') as f:
        f.write(scrub(json.dumps(rec)) + '\n')


# ---- checks
def banned(S, prompt):
    return [w for w in S.ban if re.search(r'(?<![A-Za-z])' + re.escape(w) + r'(?![A-Za-z])', prompt, re.I)]


def made_here(S, path):
    """Is this file one the pipeline makes (a candidate, a locked sheet, a location, a still)?"""
    rp = os.path.realpath(path)
    return any(rp.startswith(os.path.realpath(S.dirs[d]) + os.sep) for d in ('candidates', 'locked', 'locations', 'stills'))


def box_problem(box, wh, feather, what):
    if not (isinstance(box, (list, tuple)) and len(box) == 4 and all(isinstance(v, int) and not isinstance(v, bool) for v in box)):
        return '%s %r: give [x0, y0, x1, y1] in whole pixels' % (what, box)
    x0, y0, x1, y1 = box
    if wh and not (0 <= x0 < x1 <= wh[0] and 0 <= y0 < y1 <= wh[1]):
        return '%s %s is outside the %dx%d image' % (what, box, wh[0], wh[1])
    if feather and (x1 - x0 <= 2 * feather or y1 - y0 <= 2 * feather):
        return '%s %s is smaller than twice its feather (%d)' % (what, box, feather)
    return None


def feather_problem(f, what):
    return None if isinstance(f, int) and not isinstance(f, bool) and 0 <= f <= 200 else '%s feather %r: a whole number 0–200' % (what, f)


def restore_problems(rs, wh, where):
    if not isinstance(rs, dict) or ('ellipse' in rs) == ('boxes' in rs):
        return ['%s.restore: give "ellipse": [cx, cy, rx, ry] (the close-up face) or "boxes": [[x0, y0, x1, y1], …] (the edited regions)' % where]
    p = [feather_problem(rs.get('feather', 28 if 'ellipse' in rs else 18), where + '.restore')]
    if 'ellipse' in rs:
        el = rs['ellipse']
        if not (isinstance(el, (list, tuple)) and len(el) == 4 and all(isinstance(v, int) and not isinstance(v, bool) for v in el) and el[2] > 0 and el[3] > 0):
            p.append('%s.restore.ellipse %r: [cx, cy, rx, ry] in whole pixels' % (where, el))
        elif wh and not (0 <= el[0] - el[2] and el[0] + el[2] <= wh[0] and 0 <= el[1] - el[3] and el[1] + el[3] <= wh[1]):
            p.append('%s.restore.ellipse %r does not fit inside the %dx%d sheet' % (where, el, wh[0], wh[1]))
    else:
        bs = rs['boxes'] if isinstance(rs['boxes'], list) and rs['boxes'] else [None]
        p += [box_problem(b, wh, rs.get('feather', 18), where + '.restore box') for b in bs]
    return [x for x in p if x]


def pin_problem(pn, where):
    if pn is None or pn is False:
        return None
    if not isinstance(pn, dict) or set(pn) - {'cols', 'rows'}:
        return '%s.pin %r: {} (gutters found automatically), {"cols": [x, …], "rows": [y, …]}, or false' % (where, pn)
    for k in ('cols', 'rows'):
        v = pn.get(k)
        if v is not None and not (isinstance(v, list) and all(isinstance(x, int) and not isinstance(x, bool) and x > 0 for x in v)):
            return '%s.pin.%s %r: a list of whole-pixel gutter centres' % (where, k, v)
    return None


def same_any(paths):
    """Two of these are one file (the same path, or one a symlink / hard link of the other)?"""
    seen = []
    for p in paths:
        if not p:
            continue
        rp = os.path.realpath(p)
        st = os.stat(p) if os.path.exists(p) else None
        for q, rq, sq in seen:
            if rp == rq or (st and sq and (st.st_ino, st.st_dev) == (sq.st_ino, sq.st_dev)):
                return (q, p)
        seen.append((p, rp, st))
    return None


def problems(S, req, planning=False):
    """What would refuse this request at --go. planning: a missing file the pipeline makes is not a problem yet."""
    p = []
    b = banned(S, req['prompt'])
    if b:
        p.append('ban-list words: %s' % ', '.join(b))
    ph = PLACEHOLDER.findall(req['prompt'])
    if ph:
        p.append('unfilled placeholder %s' % ph[0][:60])
    for t in req.get('tokens', []):
        kind, _, nm = str(t).partition(':')
        if kind == 'sheet' and nm not in S.sheets():
            p.append('sheet:%s is no sheet in the spec (sheets: %s)' % (nm, ', '.join(S.sheets()) or 'none'))
        if kind == 'loc' and nm not in S.group('locations'):
            p.append('loc:%s is no location in the spec (locations: %s)' % (nm, ', '.join(S.group('locations')) or 'none'))
    miss = [r for r in req['refs'] if not os.path.exists(r) and not (planning and made_here(S, r))]
    if miss:
        hint = []
        for r in miss:
            d = os.path.realpath(os.path.dirname(r))
            if d == os.path.realpath(S.dirs['locations']):
                hint.append('pick one: casting.py pick %s vN' % os.path.basename(r)[:-4])
            elif d == os.path.realpath(S.dirs['locked']):
                hint.append('lock / states first')
        p.append('missing reference %s%s' % (', '.join(S.name(r) for r in miss), (' (%s)' % '; '.join(hint)) if hint else ''))
    for x in req.get('checks', []):                  # a box or mask that must fit its image, checked before the spend
        q = x()
        if q:
            p.append(q)
    return p


def waits(S, req):
    return [S.name(r) for r in req['refs'] if not os.path.exists(r) and made_here(S, r)]


# ---- the API
def load_key(env):
    if env:
        f = os.path.abspath(env)
    elif (os.environ.get('OPENAI_API_KEY') or '').strip():
        return os.environ['OPENAI_API_KEY'].strip()
    else:
        f = ENV_DEFAULT
    try:
        t = open(f, encoding='utf-8').read()
    except OSError:
        t = ''
    m = re.search(r'^[ \t]*(?:export[ \t]+)?OPENAI_API_KEY[ \t]*=[ \t]*(.*?)[ \t]*$', t, re.M)
    v = m.group(1).strip().strip('"').strip("'") if m else ''
    if not v:
        die(3, 'no OpenAI key found (%s has no OPENAI_API_KEY line%s). Ask the user to paste their own key into %s as one '
               'line, OPENAI_API_KEY=<their key>, then chmod 600 it — never into the chat.'
            % (f, '' if env else ', and OPENAI_API_KEY is not set', f))
    return v


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = io.BytesIO()
    for k, v in fields.items():
        out.write(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, k, v)).encode('utf-8'))
    for p in files:
        ext = os.path.splitext(p)[1].lower()
        ctype = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}.get(ext, 'image/png')
        out.write(('--%s\r\nContent-Disposition: form-data; name="image[]"; filename="%s"\r\nContent-Type: %s\r\n\r\n'
                   % (b, os.path.basename(p), ctype)).encode('utf-8'))
        out.write(open(p, 'rb').read())
        out.write(b'\r\n')
    out.write(('--%s--\r\n' % b).encode('utf-8'))
    return out.getvalue(), 'multipart/form-data; boundary=' + b


class NoRedirect(urlreq.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):          # a redirect would carry the key to another host: never follow one
        return None


OPENER = urlreq.build_opener(NoRedirect)


def post(endpoint, fields, refs, timeout):
    if refs:
        body, ctype = multipart({k: str(v) for k, v in fields.items()}, refs)
    else:
        body, ctype = json.dumps(fields).encode('utf-8'), 'application/json'
    rq = urlreq.Request(BASE_URL + '/images/' + endpoint, data=body, method='POST',
                        headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': ctype})
    try:
        with OPENER.open(rq, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urlerr.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def never_sent(ex):
    """A connection that was refused or a name that didn't resolve: the request never reached the API (free)."""
    r = getattr(ex, 'reason', ex)
    return isinstance(r, (ConnectionRefusedError, socket.gaierror))


def call(S, req, a):
    """One request with the size ladder: a 400 that names the size steps down (free); a 429 / 500 / 502 / 503 / 504, or
    a connection that never reached the API, is retried once; a request cut off after it was sent is never retried (a
    retry could pay twice). Every attempt is in the ledger at its estimate before it is sent; its answer replaces that
    row. Returns ([image bytes …], size)."""
    endpoint, refs, prompt, n = req['endpoint'], req['refs'], req['prompt'], req['n']
    sizes, retried = list(req.get('sizes') or S.sizes), False
    while sizes:
        size = sizes[0]
        e = estimate(S, size, prompt, refs, n)
        fields = {'model': S.model, 'prompt': prompt, 'n': n, 'size': size, 'quality': S.quality}
        cid, t0 = uuid.uuid4().hex[:12], time.time()
        row = {'call': cid, 'label': req['label'], 'size': size}
        with ledger_lock(S):                         # read, decide and reserve as one step: two runs can't both pass the cap
            sp = spent(S)
            if sp + e > S.cap + 1e-9:
                die(2, 'REFUSED %s at %s: spent $%.2f + estimate $%.2f > cap $%.2f — ask the user before raising "cap"'
                    % (req['label'], size, sp, e, S.cap))
            log(S, dict(row, status='sent', usd=round(e, 4), usd_from='estimate: no answer yet', est=round(e, 4)))
        try:
            status, text = post(endpoint, fields, refs, a.timeout)
        except (urlerr.URLError, socket.timeout, OSError, ValueError, http.client.HTTPException) as ex:
            free = never_sent(ex)
            log(S, dict(row, status='neterr', error=clip(repr(ex), 300), usd=0 if free else round(e, 4),
                        usd_from='never sent' if free else 'estimate: cut off after sending, may be billed', s=round(time.time() - t0)))
            if not free:                             # it reached the API: a retry could pay twice, so the user decides
                die(4, '%s: cut off after the request was sent (%s) — it may be billed (the ledger counts it at its estimate). '
                       'Check the OpenAI usage page, then re-run: stills and locations already made are skipped'
                    % (req['label'], clip(ex, 200)))
            if retried:
                die(4, '%s: could not reach the API twice (%s); nothing was sent' % (req['label'], clip(ex, 200)))
            retried = True
            say('  %s: could not reach the API (%s), retrying in %g s' % (req['label'], clip(ex, 120), a.backoff / 2.0))
            time.sleep(a.backoff / 2.0)
            continue
        took = round(time.time() - t0)
        if status == 400 and 'size' in text.lower() and len(sizes) > 1:
            log(S, dict(row, status=400, error=clip(text, 300), usd=0, s=took))
            say('  %s: size %s rejected, stepping down' % (req['label'], size))
            sizes.pop(0)
            continue
        if status in (429, 500, 502, 503, 504) and not retried:
            log(S, dict(row, status=status, error=clip(text, 300), usd=0, s=took))
            retried = True
            say('  %s: HTTP %s, retrying in %g s' % (req['label'], status, a.backoff))
            time.sleep(a.backoff)
            continue
        if status != 200:
            log(S, dict(row, status=status, error=clip(text, 500), usd=0, s=took))
            die(4, '%s: HTTP %s: %s' % (req['label'], status, clip(text, 500)))
        try:
            data = json.loads(text)
            pngs = [base64.b64decode(d['b64_json'], validate=True) for d in data['data']]
        except (ValueError, KeyError, TypeError, AttributeError) as ex:
            log(S, dict(row, status='badjson', error=clip(text, 300), usd=round(e, 4), usd_from='estimate', s=took))
            die(4, '%s: the API answered 200 without images (%s); billed by estimate in the ledger' % (req['label'], clip(ex, 120)))
        usage = data.get('usage') if isinstance(data, dict) and isinstance(data.get('usage'), dict) else {}
        try:
            uc = usage_cost(S, usage)
        except Exception:                            # bookkeeping never costs the user a paid image
            uc = None
        usd = e if uc is None else uc
        log(S, dict(row, status=200, n=n, refs=[S.name(r) for r in refs], usage=usage, usd=round(usd, 4),
                    usd_from='usage' if uc is not None else 'estimate (usage missing or incomplete)', est=round(e, 4), s=took))
        if not pngs:
            die(4, '%s: the API answered 200 with no images (billed by the ledger); nothing saved' % req['label'])
        if len(pngs) < n:
            say('  ⚠ %s: asked for %d images, got %d' % (req['label'], n, len(pngs)))
            WARN.append('%s (%d of %d images)' % (req['label'], len(pngs), n))
        say('  %s: %d image(s) at %s, $%.3f, %ds' % (req['label'], len(pngs), size, usd, took))
        return pngs, size
    die(4, '%s: no size accepted (%s)' % (req['label'], ', '.join(req.get('sizes') or S.sizes)))


def write_json(path, rec):
    t = temp_beside(path)                           # temp + rename: a symlink at path is replaced, never written through
    try:
        open(t, 'w', encoding='utf-8').write(scrub(json.dumps(rec, indent=1, ensure_ascii=False)))
        publish(t, path)
    except BaseException:
        discard(t)
        raise


def save_png(path, png, rec, renumber=None):
    """Save a paid image without ever replacing a file: os.link fails if the name is taken (another run got there
    first), and then the next variant number is taken (renumber), or the image is kept beside as NAME-dupN.png.
    A non-PNG answer is converted to PNG (its pixels unchanged) and noted. Returns the path saved."""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(png))
        im.load()
        fmt = im.format
    except Exception as ex:
        die(4, '%s: the API returned something that is not an image (%s) — billed in the ledger, nothing saved' % (path, ex))
    if fmt != 'PNG':
        b = io.BytesIO()
        im.save(b, 'PNG')
        png, rec = b.getvalue(), dict(rec, returned_format=fmt)
        say('  ⚠ the API returned %s; saved as PNG' % fmt)
        WARN.append('%s came back as %s (saved as PNG)' % (os.path.basename(path), fmt))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    t = temp_beside(path)
    try:
        open(t, 'wb').write(png)
        while True:
            try:
                os.link(t, path)
                break
            except FileExistsError:
                if renumber:
                    path = renumber()
                    continue
                stem, k = os.path.splitext(path)[0], 2
                while os.path.lexists('%s-dup%d.png' % (stem, k)):
                    k += 1
                say('  ⚠ %s appeared while this call ran (another run?) — this paid image kept as %s-dup%d.png' % (path, stem, k))
                WARN.append('%s taken by another run; kept as -dup%d' % (os.path.basename(path), k))
                path = '%s-dup%d.png' % (stem, k)
    finally:
        discard(t)
    write_json(path[:-4] + '.req.json', rec)
    say('  saved %s' % path)
    return path


def variants(folder, stem):
    return sorted(int(m.group(1)) for f in (os.listdir(folder) if os.path.isdir(folder) else [])
                  for m in [re.match(re.escape(stem) + r'-v(\d+)\.png$', f)] if m)


def next_cand(folder):
    have = [int(m.group(1)) for f in (os.listdir(folder) if os.path.isdir(folder) else [])
            for m in [re.match(r'cand-(\d+)\.png$', f)] if m]
    return max(have, default=0) + 1


# ---- the requests per group
def mk(S, label, refs, prompt, n, where):
    paths = [S.ref(r, where) for r in refs]
    return {'label': label, 'endpoint': 'edits' if paths else 'generations', 'refs': paths, 'tokens': [str(r) for r in refs],
            'prompt': S.expand(prompt, where), 'n': n, 'checks': []}


def entry(S, g, k):
    e = S.group(g)[k]
    if not isinstance(e, dict) or 'prompt' not in e:
        die(2, '%s.%s needs a "prompt"' % (g, k))
    return e


def count(e, default, where, hi=10):
    n = e.get('n', default)
    if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= hi:
        die(2, '%s.n %r: a whole number of images, %s' % (where, n, '1–%d' % hi if hi > 1 else 'only 1 (one sheet per state)'))
    return n


def own_size(r, src):
    """An edit composited back onto its source must come back at the source's size: ask for exactly that (no ladder)."""
    wh = size_of(src)
    if wh:
        r['sizes'] = ['%dx%d' % wh]


def requests(S, g, only=None, batch=None, pick=None):
    sel = list(S.group(g))
    if only:
        want = [v for v in only.split(',') if v]
        bad = [v for v in want if v not in sel]
        if bad:
            die(2, '%s: no entry %s (have: %s)' % (g, ', '.join(bad), ', '.join(sel) or 'none'))
        sel = [k for k in sel if k in want]
    out = []
    for k in sel:
        if g == 'lock':
            e = entry(S, 'lock', k)
            src = pick or e.get('pick')
            if not src:
                continue
            if ':' not in src and '/' not in src and not SAFE_ID.match(src):
                die(2, 'lock: pick %r — a candidate like cand-02, or a path' % src)
            refs = ['cand:' + src if ':' not in src and '/' not in src else src]
            r = mk(S, 'lock %s from %s' % (k, src), refs, e['prompt'], 1, 'lock.' + k)
            r.update(id=k, out=os.path.join(S.dirs['locked'], k + '-edit.png'))
            own_size(r, r['refs'][0])
            r['checks'].append(lambda e=e, k=k: pin_problem(e.get('pin'), 'lock.' + k))
            if e.get('restore') is not None:
                r['checks'].append(lambda e=e, k=k, s=r['refs'][0]: '; '.join(restore_problems(e['restore'], size_of(s), 'lock.' + k)) or None)
        elif g == 'fixes':
            e = entry(S, 'fixes', k)
            if ('src' not in e and 'sheet' not in e) or 'box' not in e:
                die(2, 'fixes.%s needs "src" (or "sheet") and "box" (the region pasted back)' % k)
            if e.get('sheet'):                       # a locked sheet fixed in place; the one before is kept beside it
                src = os.path.join(S.dirs['locked'], e['sheet'] + '.png')
                outp, before = src, os.path.join(S.dirs['locked'], '%s-before-%s.png' % (e['sheet'], k))
                edit = os.path.join(S.dirs['locked'], '%s-%s-edit.png' % (e['sheet'], k))
            else:
                src = S.rel(e['src'])
                outp, before = (S.rel(e['out']) if e.get('out') else os.path.splitext(src)[0] + 'f.png'), None
                edit = os.path.splitext(outp)[0] + '-edit.png'
            r = mk(S, 'fix %s' % k, [src] + list(e.get('refs') or []), e['prompt'], 1, 'fixes.' + k)
            r.update(id=k, src=src, out=outp, before=before, edit=S.rel(e['edit']) if e.get('edit') else edit)
            if e.get('sheet'):
                r['tokens'] = ['sheet:' + e['sheet']] + r['tokens'][1:]
            own_size(r, before if before and os.path.exists(before) else src)
            fe = e.get('feather', 18)
            files = [r['src'], r['edit'], r['before'], os.path.join(S.dirs['locked'], '%s-%s-fix.json' % (e['sheet'], k)) if e.get('sheet') else None] + \
                ([] if e.get('sheet') else [r['out'], os.path.splitext(r['out'])[0] + '.json'])
            r['checks'] += [lambda e=e, k=k: pin_problem(e.get('pin'), 'fixes.' + k),
                            lambda files=files, k=k: ('fixes.%s: %s and %s are one file — give the edit and the output names of their own'
                                                      % ((k,) + same_any(files)) if same_any(files) else None),
                            lambda fe=fe, k=k: feather_problem(fe, 'fixes.' + k),
                            lambda e=e, fe=fe, k=k, s=src: box_problem(e['box'], size_of(s), fe if isinstance(fe, int) else 0, 'fixes.%s.box' % k)]
        else:
            e = entry(S, g, k)
            if g == 'stills' and batch not in (None, 'all') and e.get('batch', 'rest') != batch:
                continue
            n = count(e, 1 if g in ('candidates', 'states') else 2, '%s.%s' % (g, k), hi=1 if g == 'states' else 10)
            r = mk(S, '%s %s' % ({'candidates': 'candidate', 'states': 'state', 'locations': 'location',
                                  'stills': 'still'}[g], k), e.get('refs') or [], e['prompt'], n, '%s.%s' % (g, k))
            r.update(id=k)
            if g == 'states':
                r['checks'].append(lambda e=e, k=k: pin_problem(e.get('pin'), 'states.' + k))
            if g == 'stills':
                r['folder'] = os.path.join(S.dirs['stills'], e.get('dir', 'keys'))
                r['checks'].append(lambda e=e, k=k: None if isinstance(e.get('meta', {}), dict) else 'stills.%s.meta %r: an object' % (k, e.get('meta')))
            if g == 'locations':
                r['folder'] = S.dirs['locations']
        out.append(r)
    return out


def first_size(S, r):
    return (r.get('sizes') or S.sizes)[0]


def is_made(S, g, r):
    if g in ('stills', 'locations'):
        return bool(variants(r['folder'], r['id']))
    if g == 'states':
        return os.path.lexists(os.path.join(S.dirs['locked'], r['id'] + '-gen.png'))
    if g == 'lock':
        return os.path.lexists(r['out'])
    if g == 'fixes':
        return os.path.lexists(r['edit'])
    return False


TODO = [0.0]                                            # plan: the part of the quote not made yet


def quote(S, reqs, title, planning=False, group=None):
    tot = 0.0
    for r in reqs:
        e = estimate(S, first_size(S, r), r['prompt'], r['refs'], r['n'])
        tot += e
        made = planning and group and is_made(S, group, r)
        if planning and not made:
            TODO[0] += e
        p = problems(S, r, planning)
        w = waits(S, r) if planning and not made else []
        say('  %-34s %-11s n=%d refs=%-44s words=%-4d $%.2f%s%s%s' % (
            r['label'][:34], r['endpoint'], r['n'], ','.join(os.path.basename(x) for x in r['refs']) or '-',
            len(r['prompt'].split()), e, '  (made)' if made else '', ('  ✗ ' + '; '.join(p)) if p else '', ('  · waits for ' + ', '.join(w)) if w else ''))
    imgs = sum(r['n'] for r in reqs)
    say('%s: %d call%s, %d image%s, quote $%.2f' % (title, len(reqs), '' if len(reqs) == 1 else 's', imgs,
                                                    '' if imgs == 1 else 's', tot))
    return tot


def skip_made(S, rs, a, title):
    """Stills and locations that already have variants are skipped unless --redo: a batch cut off by an error resumes."""
    if getattr(a, 'redo', False):
        return rs
    keep, skip = [], []
    for r in rs:
        v = variants(r['folder'], r['id'])
        (skip if v else keep).append((r, v))
    for r, v in skip:
        say('  skipped %s: has %s (--redo makes more)' % (r['id'], ', '.join('v%d' % x for x in v)))
    if not keep:
        say('%s: every one already has variants — nothing to make (--redo makes more)' % title)
        sys.exit(0)
    return [r for r, _ in keep]


def gate(S, reqs, a, title):
    """Dry run unless --go; with --go, refuse the whole batch before any network on a problem or the cap."""
    if not reqs:
        die(2, '%s: nothing selected' % title)
    tot = quote(S, reqs, title)
    bad = [(r['label'], p) for r in reqs for p in problems(S, r)]
    sp = spent(S)
    say('spent so far $%.2f, cap $%.2f%s' % (sp, S.cap, '  (this batch would pass it)' if sp + tot > S.cap + 1e-9 else ''))
    over = sp + tot > S.cap + 1e-9
    if not a.go:
        if bad or over:
            say('dry run — ✗ a --go would be refused: %s' % '; '.join(['%s: %s' % b for b in bad] + (['the quote passes the cap: ask the user before raising "cap"'] if over else [])))
            sys.exit(2)
        say('dry run — show the user the requests and the quote; add --go once they approve the spend')
        sys.exit(0)
    if bad:
        die(2, 'REFUSED: %s' % '; '.join('%s: %s' % b for b in bad))
    if sp + tot > S.cap + 1e-9:
        die(2, 'REFUSED: spent $%.2f + quote $%.2f > cap $%.2f — ask the user before raising "cap"' % (sp, tot, S.cap))
    u = urlparse.urlparse(BASE_URL)
    if u.scheme != 'https' and u.hostname not in ('127.0.0.1', 'localhost', '::1'):
        die(2, 'OPENAI_BASE_URL %s is not https: the key would travel in the clear' % BASE_URL)
    global KEY
    KEY = load_key(a.env)
    if u.hostname != 'api.openai.com':
        say('sending to %s (OPENAI_BASE_URL)' % u.hostname)


def record(S, r, size, extra=None):
    rec = {'endpoint': r['endpoint'], 'model': S.model, 'size': size, 'quality': S.quality, 'n': r['n'],
           'refs': [S.name(x) for x in r['refs']], 'prompt': r['prompt']}
    rec.update(extra or {})
    return rec


# ---- free image steps (pin, paste, restore)
def gutters(img, axis):
    """Centres of the thin near-white gutter lines between panels (columns for axis 0, rows for axis 1): a run of ≤ 24
    lines that are > 200 over 90 % of their length AND at least 25 levels brighter than the background 15–60 px either
    side (a light background is not a gutter), at least a tenth of the frame from an edge and from each other."""
    import numpy as np
    a = np.asarray(img.convert('L')).astype(float)
    lines = (a > 200).mean(0 if axis == 0 else 1) > 0.9
    prof = a.mean(0 if axis == 0 else 1)
    n, out, k = len(lines), [], 0
    while k < n:
        if lines[k]:
            j = k
            while j < n and lines[j]:
                j += 1
            c = (k + j - 1) // 2
            side = np.concatenate([prof[max(0, k - 60):max(0, k - 15)], prof[min(n, j + 15):min(n, j + 60)]])
            if 0.1 * n <= c <= 0.9 * n and j - k <= 24 and side.size and prof[k:j].mean() - np.median(side) >= 25 \
                    and all(abs(c - o) >= 0.1 * n for o in out):
                out.append(c)
            k = j
        else:
            k += 1
    return out


def pin_grey(src, dst, xs, ys, grey):
    """Pin a sheet's background to the project grey: per panel, flood-fill the grey from the panel's edges, fit a smooth
    surface to it (quadratic; flat under 15 % background), move each pixel by (grey − surface), weighted 1 within 14
    levels of the surface and 0 beyond 24 — the subject untouched, the generated grey's gradients flattened. "ok" is
    false when a panel had no neutral grey to seed from (100–170), the background didn't land within 3 of the grey, or it
    is still uneven (spread > 4 levels; The Lull's pinned sheets measure 0.8–3.1)."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    target = np.array([int(grey[i:i + 2], 16) for i in (1, 3, 5)], float)
    im = Image.open(src).convert('RGB')
    W, H = im.size
    if xs is None:
        xs = gutters(im, 0)
    if ys is None:
        ys = gutters(im, 1)
    a = np.asarray(im).astype(float)
    out, wmap, rep, unchanged = a.copy(), np.zeros((H, W)), [], 0
    pad = 5
    xs = sorted({int(x) for x in xs if pad < x < W - pad})
    ys = sorted({int(y) for y in ys if pad < y < H - pad})
    xs = [x for i, x in enumerate(xs) if i == 0 or x - xs[i - 1] > 2 * pad]
    ys = [y for i, y in enumerate(ys) if i == 0 or y - ys[i - 1] > 2 * pad]
    bx = [0] + [v for x in xs for v in (x - pad, x + pad)] + [W]
    by = [0] + [v for y in ys for v in (y - pad, y + pad)] + [H]
    boxes = [(bx[i], by[j], bx[i + 1], by[j + 1]) for j in range(0, len(by), 2) for i in range(0, len(bx), 2)]
    for (x0, y0, x1, y1) in boxes:
        if x1 - x0 < 20 or y1 - y0 < 20:
            continue
        sub = a[y0:y1, x0:x1]
        h, w = sub.shape[:2]
        probe = im.crop((x0, y0, x1, y1))
        for s in [(8, 8), (w - 9, 8), (8, h - 9), (w - 9, h - 9), (w // 2, 8), (8, h // 2), (w - 9, h // 2)]:
            px = np.array(probe.getpixel(s)).astype(int)
            if (px == [255, 0, 255]).all():
                continue
            if np.abs(px - px.mean()).max() < 10 and 100 < px.mean() < 170:      # seed only on neutral grey
                ImageDraw.floodfill(probe, s, (255, 0, 255), thresh=10)
        m = (np.asarray(probe).astype(int) == [255, 0, 255]).all(2)
        if m.sum() < 500:
            rep.append([int(x0), int(y0), int(x1), int(y1), 'too little background: unchanged'])
            unchanged += 1
            continue
        if m.mean() < 0.15:
            model, kind = np.broadcast_to(np.median(sub[m], 0), sub.shape).copy(), 'flat'
        else:
            yy, xx = np.nonzero(m)
            k = np.random.RandomState(0).choice(len(yy), min(40000, len(yy)), replace=False)

            def design(X, Y):
                u, v = X / w - .5, Y / h - .5
                return np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], -1)
            A = design(xx[k].astype(float), yy[k].astype(float))
            Yg, Xg = np.mgrid[0:h, 0:w]
            D = design(Xg.astype(float), Yg.astype(float))
            model = np.zeros_like(sub)
            for c in range(3):
                coef, *_ = np.linalg.lstsq(A, sub[yy[k], xx[k], c], rcond=None)
                model[..., c] = D @ coef
            model = np.clip(model, np.percentile(sub[m], 1, axis=0) - 6, np.percentile(sub[m], 99, axis=0) + 6)
            kind = 'surface'
        r = np.abs(sub - model).max(2)
        wt = np.clip((24 - r) / 10, 0, 1)
        wt = np.asarray(Image.fromarray((wt * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(float) / 255
        out[y0:y1, x0:x1] = sub + (target - model) * wt[..., None]
        wmap[y0:y1, x0:x1] = wt
        rep.append([int(x0), int(y0), int(x1), int(y1), '%s %d..%d -> %s, background %d%% of panel'
                    % (kind, model.mean(2).min(), model.mean(2).max(), grey, round(100 * m.mean()))])
    final = Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8))
    write_img(final, dst)
    f = np.asarray(final).astype(float)
    bg = wmap > 0.99
    mean = round(float(f[bg].mean()), 1) if bg.any() else None
    return {'src': os.path.basename(src), 'grey': grey, 'cols': [int(x) for x in xs], 'rows': [int(y) for y in ys],
            'panels': rep, 'bg_after_mean': mean, 'bg_after_std': round(float(f[bg].mean(1).std()), 1) if bg.any() else None,
            'ok': bool(unchanged == 0 and mean is not None and abs(mean - target.mean()) <= 3 and float(f[bg].mean(1).std()) <= 4)}


def paste_boxes(orig, edit, out, boxes, feather, why='', rec_path=None):
    """Paste boxes of an edit back onto the untouched original (soft edge; feather 0 = a hard paste), so a fix touches
    only those regions — gpt-image edits drift and soften everything else."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    o = Image.open(orig).convert('RGB')
    e = Image.open(edit).convert('RGB')
    if o.size != e.size:
        die(2, 'paste: %s is %dx%d but %s is %dx%d — the edit must be the original\'s size' % (orig, o.size[0], o.size[1], edit, e.size[0], e.size[1]))
    for b in boxes:
        q = box_problem(b, o.size, feather, 'paste: box')
        if q:
            die(2, q)
    if feather:
        m = Image.new('L', o.size, 0)
        for x0, y0, x1, y1 in boxes:
            ImageDraw.Draw(m).rectangle([x0 + feather, y0 + feather, x1 - feather, y1 - feather], fill=255)
        res = Image.composite(e, o, m.filter(ImageFilter.GaussianBlur(feather / 2)))
    else:
        res = o.copy()
        for x0, y0, x1, y1 in boxes:
            res.paste(e.crop((x0, y0, x1, y1)), (x0, y0))
    write_img(res, out)
    d = np.abs(np.asarray(o).astype(float) - np.asarray(e).astype(float)).mean(2)
    inside = np.zeros(d.shape, bool)
    for x0, y0, x1, y1 in boxes:
        inside[y0:y1, x0:x1] = True
    rec = {'original': os.path.basename(orig), 'edit': os.path.basename(edit), 'feather': feather,
           'edit_drift_inside': round(float(d[inside].mean()), 1),
           'edit_drift_outside_not_used': round(float(d[~inside].mean()), 1) if (~inside).any() else 0.0, 'why': why}
    rec.update({'box': list(boxes[0])} if len(boxes) == 1 else {'boxes': [list(b) for b in boxes]})
    write_json(rec_path or os.path.splitext(out)[0] + '.json', rec)
    return rec


def paste_region(orig, edit, out, box, feather, why=''):
    return paste_boxes(orig, edit, out, [box], feather, why)


def restore_face(base, src, out, ellipse, feather, why=''):
    """The anti-slop composite, ellipse mode: the untouched close-up face of the source sheet is masked back onto the
    edit through a feathered ellipse (an edit softens skin)."""
    from PIL import Image, ImageDraw, ImageFilter
    b = Image.open(base).convert('RGB')
    s = Image.open(src).convert('RGB')
    if b.size != s.size:
        die(2, 'restore: %s is %dx%d but %s is %dx%d' % (base, b.size[0], b.size[1], src, s.size[0], s.size[1]))
    cx, cy, rx, ry = ellipse
    m = Image.new('L', b.size, 0)
    ImageDraw.Draw(m).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    write_img(Image.composite(s, b, m.filter(ImageFilter.GaussianBlur(feather))), out)
    rec = {'base': os.path.basename(base), 'restored_from': os.path.basename(src), 'mask': 'ellipse', 'center': [cx, cy],
           'radii': [rx, ry], 'feather_blur': feather, 'why': why or 'GPT Image edits soften skin: the untouched close-up face is masked back onto the edit'}
    write_json(os.path.splitext(out)[0] + '.json', rec)
    return rec


def write_img(img, path):
    guard_outputs([path], [])
    t = temp_beside(path)
    try:
        img.save(t)
        publish(t, path)
    except OSError:
        discard(t)
        raise


def pinned(S, rec, path):
    if rec['ok']:
        say('  grey pinned (%s, panels at x %s, y %s; background %s±%s) → %s' % (S.grey, rec['cols'], rec['rows'], rec['bg_after_mean'], rec['bg_after_std'], path))
    else:
        bad = [p[4] for p in rec['panels'] if 'unchanged' in p[4]]
        say('  ⚠ grey NOT pinned on %s: %s; background %s (want %s). The sheet is saved — look at it: give "pin": {"cols": …, '
            '"rows": …} (the gutter centres), or regenerate it on a mid grey' % (path, '%d panel(s) with no neutral grey to seed from' % len(bad) if bad else 'it landed off the grey',
                                                                                 rec['bg_after_mean'], S.grey))
        WARN.append('grey NOT pinned on %s' % os.path.basename(path))


def finish_sheet(S, k, raw, spec_e, pick=None):
    """The free steps after a sheet's paid edit: put the untouched face back (lock only), then pin the grey."""
    locked = S.dirs['locked']
    cur = raw
    rs = spec_e.get('restore') if pick else None
    if rs:
        comp = os.path.join(locked, k + '-composite.png')
        if 'ellipse' in rs:
            rec = restore_face(raw, pick, comp, list(rs['ellipse']), int(rs.get('feather', 28)))
            rec['base'], rec['restored_from'] = S.name(raw), S.name(pick)
            say('  the close-up face put back from %s → %s' % (os.path.basename(pick), comp))
        else:                                        # the source's way: the edited regions onto the untouched pick
            rec = paste_boxes(pick, raw, comp, [list(b) for b in rs['boxes']], int(rs.get('feather', 18)), 'the lock edit\'s regions onto the untouched pick')
            rec['original'], rec['edit'] = S.name(pick), S.name(raw)
            say('  the edited regions %s pasted onto the untouched %s → %s' % (rs['boxes'], os.path.basename(pick), comp))
        write_json(comp[:-4] + '.json', rec)
        cur = comp
    final = os.path.join(locked, k + '.png')
    pn = spec_e.get('pin', {})
    if pn is False:
        from PIL import Image
        write_img(Image.open(cur), final)
    else:
        pn = pn if isinstance(pn, dict) else {}
        rec = pin_grey(cur, final, pn.get('cols'), pn.get('rows'), S.grey)
        rec['src'] = S.name(cur)
        write_json(os.path.join(locked, 'pin-%s.json' % k), rec)
        pinned(S, rec, final)
    return final


def fixed_sheets(S, k):
    return sorted(glob.glob(os.path.join(glob.escape(S.dirs['locked']), glob.escape(k) + '-before-*.png')))


def no_rebuild_over_fix(S, k):
    f = fixed_sheets(S, k)
    if f:
        die(2, '%s has a sheet fix applied (%s): a rebuild would undo it. Keep it as it is, or move those -before- files '
               'away first if the fix should go' % (k, ', '.join(os.path.basename(x) for x in f)))


# ---- commands
def cmd_init(a):
    d = os.path.abspath(a.dir)
    p = os.path.join(d, 'tools', 'casting.json')
    if os.path.exists(p):
        die(2, '%s exists — edit it, or move it away first' % p)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    starter = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'starter.json'), encoding='utf-8'))
    json.dump(starter, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    say('wrote %s\n  fill every <placeholder>, then: cd %s && python3 %s plan' % (p, d, os.path.abspath(__file__)))


def cmd_plan(S, a):
    groups = a.groups or [g for g in GROUPS if S.group(g)]
    tot, bad = 0.0, 0
    for g in groups:
        if g not in GROUPS:
            die(2, 'plan: no group %r (groups: %s)' % (g, ', '.join(GROUPS)))
        if g == 'stills':
            batches = sorted({e.get('batch', 'rest') for e in S.group('stills').values() if isinstance(e, dict)},
                             key=lambda b: (b != 'identity', b))
            for b in batches:
                rs = requests(S, 'stills', batch=b)
                tot += quote(S, rs, 'stills --batch %s' % b, planning=True, group='stills')
                bad += sum(1 for r in rs if problems(S, r, True))
            continue
        rs = requests(S, g)
        if g == 'lock' and not rs:
            k = next(iter(S.group('lock')), None)
            if k:                                    # quote the lock edit before the pick: one edit of one sheet
                e0 = entry(S, 'lock', k)
                r = mk(S, 'lock %s (before the pick)' % k, [], e0['prompt'], 1, 'lock.' + k)
                r['checks'].append(lambda: pin_problem(e0.get('pin'), 'lock.' + k))
                if e0.get('restore') is not None:
                    r['checks'].append(lambda: '; '.join(restore_problems(e0['restore'], None, 'lock.' + k)) or None)
                p = problems(S, r, True)
                e = estimate(S, S.sizes[0], r['prompt'], [], 1) + 1508 * S.rates['image_in'] / 1e6
                tot += e
                TODO[0] += e
                bad += 1 if p else 0
                say('lock: 1 call, 1 image (the edit of the picked candidate), quote $%.2f%s — after the pick: casting.py lock --pick cand-NN'
                    % (e, ('  ✗ ' + '; '.join(p)) if p else ''))
            continue
        tot += quote(S, rs, g, planning=True, group=g)
        bad += sum(1 for r in rs if problems(S, r, True))
    sp = spent(S)
    say('total quote $%.2f, still to make $%.2f (at %s; any other size is quoted at the same, unmeasured); spent so far $%.2f; cap $%.2f'
        % (tot, TODO[0], S.sizes[0], sp, S.cap))
    if sp + TODO[0] > S.cap + 1e-9:
        say('⚠ what is still to make passes the cap by $%.2f: each batch is refused once it would pass it — agree a cap with the user' % (sp + TODO[0] - S.cap))
    if bad:
        die(2, '%d request(s) would be refused (✗ above)' % bad)


def cmd_candidates(S, a):
    rs = requests(S, 'candidates', a.only)
    gate(S, rs, a, 'candidates')
    folder = S.dirs['candidates']
    for r in rs:
        pngs, size = call(S, r, a)
        nxt = lambda: os.path.join(folder, 'cand-%02d.png' % next_cand(folder))
        for png in pngs:
            save_png(nxt(), png, record(S, r, size, {'source': r['id']}), renumber=nxt)
    say('ledger total $%.2f — next: casting.py review candidates, then the user picks one' % spent(S))


def cmd_lock(S, a):
    ks = list(S.group('lock'))
    if len(ks) != 1:
        die(2, '"lock" holds one entry: the locked sheet\'s name (e.g. "eva": {…}); found %d' % len(ks))
    k = ks[0]
    edit = os.path.join(S.dirs['locked'], k + '-edit.png')
    if not a.rebuild:                                # checked in the dry run too: a made lock is never quoted again
        for p in (edit, os.path.join(S.dirs['locked'], k + '.png')):
            if os.path.lexists(p):
                die(2, '%s exists — the lock is made (never overwritten); to redo only the free steps: lock --rebuild' % p)
    made_from = None                                 # a rebuild takes the pick the saved edit was made from
    if a.rebuild:
        try:
            made_from = os.path.join(S.root, json.load(open(edit[:-4] + '.req.json', encoding='utf-8'))['refs'][0])
        except (OSError, ValueError, KeyError, IndexError, TypeError):
            die(2, 'lock --rebuild: no readable %s (it names the pick the edit was made from)' % (edit[:-4] + '.req.json'))
    rs = requests(S, 'lock', pick=a.pick or made_from)
    if not rs:
        die(2, 'lock: say which candidate — --pick cand-NN (or "pick" in the spec)')
    r = rs[0]
    final = os.path.join(S.dirs['locked'], k + '.png')
    if a.rebuild:
        if os.path.realpath(r['refs'][0]) != os.path.realpath(made_from):
            die(2, 'lock --rebuild: the saved edit was made from %s, not %s — a rebuild must put back the face it erased'
                % (S.name(made_from), S.name(r['refs'][0])))
        if not os.path.exists(r['out']) or not os.path.exists(r['refs'][0]):
            die(2, 'lock --rebuild: needs the saved edit %s and the pick %s' % (r['out'], r['refs'][0]))
        no_rebuild_over_fix(S, k)
        bad = problems(S, r) + ([] if size_of(r['out']) else ['the saved edit %s is not a readable image' % r['out']])
        if bad:
            die(2, 'lock --rebuild: %s' % '; '.join(bad))
    else:
        gate(S, rs, a, 'lock')
        pngs, size = call(S, r, a)
        r['out'] = save_png(r['out'], pngs[0], record(S, r, size))
    final = finish_sheet(S, k, r['out'], S.group('lock')[k], pick=r['refs'][0])
    say('locked: %s — check one readable face (the close-up), then: casting.py states' % final)


def cmd_states(S, a):
    rs = requests(S, 'states', a.only)
    if a.rebuild:
        for r in rs:
            raw = os.path.join(S.dirs['locked'], r['id'] + '-gen.png')
            if not size_of(raw):
                die(2, 'states --rebuild: no readable saved %s' % raw)
            no_rebuild_over_fix(S, r['id'])
            q = pin_problem(S.group('states')[r['id']].get('pin'), 'states.' + r['id'])
            if q:
                die(2, 'states --rebuild: %s' % q)
        for r in rs:
            finish_sheet(S, r['id'], os.path.join(S.dirs['locked'], r['id'] + '-gen.png'), S.group('states')[r['id']])
        return
    keep = []
    for r in rs:                                     # made sheets are skipped, so a batch cut off by an error resumes
        made = [p for p in (os.path.join(S.dirs['locked'], r['id'] + '-gen.png'), os.path.join(S.dirs['locked'], r['id'] + '.png')) if os.path.lexists(p)]
        if made:
            say('  skipped %s: made (%s); to redo only its grey pin: states --only %s --rebuild' % (r['id'], os.path.basename(made[0]), r['id']))
        else:
            keep.append(r)
    if not keep:
        say('states: every one is made — nothing to make')
        return
    rs = keep
    gate(S, rs, a, 'states')
    for r in rs:
        pngs, size = call(S, r, a)
        raw = save_png(os.path.join(S.dirs['locked'], r['id'] + '-gen.png'), pngs[0], record(S, r, size))
        finish_sheet(S, r['id'], raw, S.group('states')[r['id']])
    say('ledger total $%.2f' % spent(S))


def cmd_locations(S, a):
    rs = skip_made(S, requests(S, 'locations', a.only), a, 'locations')
    gate(S, rs, a, 'locations')
    for r in rs:
        pngs, size = call(S, r, a)
        nxt = lambda r=r: os.path.join(r['folder'], '%s-v%d.png' % (r['id'], max(variants(r['folder'], r['id']), default=0) + 1))
        for png in pngs:
            save_png(nxt(), png, record(S, r, size), renumber=nxt)
    say('ledger total $%.2f — next: casting.py pick NAME vN for each location' % spent(S))


def cmd_pick(S, a):
    folder = S.dirs['locations']
    if a.name not in S.group('locations'):
        die(2, 'pick: no location %r in the spec' % a.name)
    v = a.variant if a.variant.startswith('v') else 'v' + a.variant
    if not re.fullmatch(r'v\d{1,4}', v):
        die(2, 'pick: variant %r — like v2' % a.variant)
    src = os.path.join(folder, '%s-%s.png' % (a.name, v))
    if not os.path.exists(src):
        die(2, 'pick: no %s' % src)
    dst = os.path.join(folder, a.name + '.png')
    if os.path.lexists(dst) and not os.path.islink(dst):
        die(2, '%s is a file, not a pick link — move it away first' % dst)
    if os.path.lexists(dst):
        os.unlink(dst)
    os.symlink(os.path.basename(src), dst)
    say('%s → %s' % (dst, os.path.basename(src)))


def cmd_stills(S, a):
    if not a.batch and not a.only:
        die(2, 'stills: give --batch (identity first: the shots that carry the face) or --only IDS')
    title = 'stills --batch %s' % (a.batch or 'all')
    rs = requests(S, 'stills', a.only, batch=a.batch or 'all')
    if not rs:
        die(2, '%s: no stills in that batch (batches: %s)' % (title, ', '.join(sorted({e.get('batch', 'rest') for e in S.group('stills').values()})) or 'none'))
    rs = skip_made(S, rs, a, title)
    gate(S, rs, a, title)
    for r in rs:
        pngs, size = call(S, r, a)
        nxt = lambda r=r: os.path.join(r['folder'], '%s-v%d.png' % (r['id'], max(variants(r['folder'], r['id']), default=0) + 1))
        meta = dict(S.group('stills')[r['id']].get('meta') or {})
        for png in pngs:
            save_png(nxt(), png, record(S, r, size, meta), renumber=nxt)
    say('ledger total $%.2f — next: casting.py review stills --batch %s' % (spent(S), a.batch or 'all'))


def own_record(path, edit, orig):
    """Is the file at path this fix's own earlier output (its .json record names this edit and this original)?"""
    try:
        rec = json.load(open(os.path.splitext(path)[0] + '.json', encoding='utf-8'))
    except (OSError, ValueError):
        return False
    return isinstance(rec, dict) and rec.get('edit') == os.path.basename(edit) and rec.get('original') == os.path.basename(orig)


def cmd_fix(S, a):
    if not a.id or ',' in a.id:
        die(2, 'fix: one fix id at a time (have: %s)' % ', '.join(S.group('fixes')) or 'none')
    rs = requests(S, 'fixes', a.id)
    r = rs[0]
    e = S.group('fixes')[r['id']]
    applied = os.path.exists(r['before']) if r['before'] else os.path.lexists(r['out'])
    orig = r['before'] if r['before'] and applied else r['src']                    # the untouched original
    if a.rebuild:
        if not os.path.exists(r['edit']) or not os.path.exists(orig):
            die(2, 'fix --rebuild: needs the saved edit %s and the original %s' % (r['edit'], orig))
        if not r['before'] and applied and not own_record(r['out'], r['edit'], orig):
            die(2, 'fix --rebuild: %s exists and is not this fix\'s own output (its .json doesn\'t name %s) — never overwritten'
                % (r['out'], os.path.basename(r['edit'])))
        if r['before'] and applied:
            later = [f for f in fixed_sheets(S, e['sheet']) if f != r['before'] and os.path.getmtime(f) > os.path.getmtime(r['before'])]
            if later:
                die(2, 'fix %s --rebuild: a later fix of %s (%s) would be undone' % (a.id, e['sheet'], ', '.join(os.path.basename(f) for f in later)))
        bad = [p for p in problems(S, r) if 'missing reference' not in p] + ([] if size_of(r['edit']) else ['the saved edit %s is not a readable image' % r['edit']])
        if bad:
            die(2, 'fix --rebuild: %s' % '; '.join(bad))
    else:
        done = [p for p in (r['edit'], r['before'] or r['out']) if p and os.path.lexists(p)]   # the dry run checks it too
        if done:
            die(2, '%s exists — this fix was made (or its edit was saved); to redo only the free paste: fix %s --rebuild' % (done[0], a.id))
        gate(S, rs, a, 'fix %s' % a.id)
        pngs, size = call(S, r, a)
        r['edit'] = save_png(r['edit'], pngs[0], record(S, r, size))
    box, fe = list(e['box']), int(e.get('feather', 18))
    if r['before']:                                  # in place: paste into a temp file, then keep the old sheet, then publish
        t = temp_beside(r['out'])
        rec_path = os.path.join(S.dirs['locked'], '%s-%s-fix.json' % (e['sheet'], a.id))
        try:
            rec = paste_boxes(orig, r['edit'], t, [box], fe, e.get('why', ''), rec_path=rec_path)
            if orig == r['src']:
                os.replace(r['src'], r['before'])
                say('  the sheet before this fix → %s' % r['before'])
            publish(t, r['out'])
        except BaseException:
            discard(t)
            raise
    else:
        rec = paste_boxes(orig, r['edit'], r['out'], [box], fe, e.get('why', ''))     # written whole, then renamed
    say('  pasted %s of the edit onto %s (drift inside %.1f, outside %.1f not used) → %s'
        % (box, os.path.basename(orig), rec['edit_drift_inside'], rec['edit_drift_outside_not_used'], r['out']))
    if e.get('pin') is not None and e.get('pin') is not False:
        pn = e['pin'] if isinstance(e['pin'], dict) else {}
        pinned(S, pin_grey(r['out'], r['out'], pn.get('cols'), pn.get('rows'), S.grey), r['out'])


def font(size):
    from PIL import ImageFont
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default(size=size)


def cmd_review(S, a):
    from PIL import Image, ImageDraw
    os.makedirs(S.dirs['review'], exist_ok=True)
    if a.what == 'candidates':
        folder = S.dirs['candidates']
        fs = sorted((int(m.group(1)), f) for f in (os.listdir(folder) if os.path.isdir(folder) else [])
                    for m in [re.match(r'cand-(\d+)\.png$', f)] if m)
        if not fs:
            die(2, 'review: no candidates in %s' % folder)
        W, H, F = 1600, 900, font(56)
        sh = Image.new('RGB', (W, (H + 10) * len(fs) - 10), (20, 20, 22))
        for i, (num, f) in enumerate(fs):
            im = Image.open(os.path.join(folder, f)).convert('RGB').resize((W, H), Image.LANCZOS)
            d = ImageDraw.Draw(im)
            d.rectangle([0, 0, 120, 80], fill=(0, 0, 0))
            d.text((22, 8), str(num), fill=(255, 220, 90), font=F)
            sh.paste(im, (0, i * (H + 10)))
        out = os.path.join(S.dirs['review'], 'candidates.jpg')
        write_jpg(sh, out)
        say('%d candidates → %s (the user picks one by number)' % (len(fs), out))
        return
    rs = requests(S, 'stills', a.only, batch=a.batch or 'all')
    faces = S.d.get('faces') or {}
    TW, TH, FW, F = 960, 540, 540, font(30)
    rows = []
    for r in rs:
        vs = variants(r['folder'], r['id'])
        if vs:
            rows.append((r, [os.path.join(r['folder'], '%s-v%d.png' % (r['id'], v)) for v in vs[-4:]]))
    if not rows:
        die(2, 'review: no stills made yet for this selection')
    cols = max(len(v) for _, v in rows)
    sheet = Image.new('RGB', (FW + cols * TW, len(rows) * (TH + 44)), (16, 16, 18))
    d = ImageDraw.Draw(sheet)
    for i, (r, vs) in enumerate(rows):
        y = i * (TH + 44)
        fs = S.group('stills')[r['id']].get('face')
        label = r['id']
        if fs and fs in faces and os.path.exists(os.path.join(S.dirs['locked'], fs + '.png')):
            face = Image.open(os.path.join(S.dirs['locked'], fs + '.png')).convert('RGB').crop(tuple(faces[fs])).resize((FW - 20, FW - 20))
            sheet.paste(face, (10, y + 44))
            label += '  (locked face: %s)' % fs
        d.text((12, y + 6), label, fill=(255, 220, 90), font=F)
        for c, p in enumerate(vs):
            sheet.paste(Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS), (FW + c * TW, y + 44))
            d.text((FW + c * TW + 12, y + 6), re.search(r'-(v\d+)\.png$', p).group(1), fill=(255, 220, 90), font=F)
    out = os.path.join(S.dirs['review'], 'stills-%s.jpg' % (a.batch or 'all'))
    write_jpg(sheet, out)
    say('%d stills → %s' % (len(rows), out))


def write_jpg(img, path):
    guard_outputs([path], [])
    t = temp_beside(path)
    try:
        img.save(t, quality=88)
        publish(t, path)
    except OSError:
        discard(t)
        raise


def cmd_cost(S, a):
    rows = ledger_calls(S)
    for r in rows:
        say('%-36s %-10s %-8s $%.3f %ss' % (str(r.get('label', ''))[:36], r.get('size', ''), r.get('status'), float(r.get('usd', 0) or 0), r.get('s', '-')))
    say('calls %d, spent $%.2f, cap $%.2f' % (len(rows), spent(S), S.cap))


def ints(s, n=None, what='values'):
    try:
        v = [int(x) for x in str(s).split(',') if x.strip() != '']
    except ValueError:
        die(2, '%s %r: whole numbers separated by commas' % (what, s))
    if n and len(v) != n:
        die(2, '%s %r: give %d numbers' % (what, s, n))
    return v


def free_io(a, outs, ins):
    for p in outs[:1]:
        if not p.lower().endswith('.png'):
            die(2, '%s: the output must be a .png' % p)
    f = getattr(a, 'feather', None)
    if f is not None and not (isinstance(f, int) and 0 <= f <= 200):
        die(2, '--feather %r: a whole number 0–200' % f)
    for p in ins:
        if not os.path.isfile(p):
            die(2, '%s: no such image' % p)
    for p in outs:
        if os.path.lexists(p) and not a.force:
            die(2, '%s exists — never overwritten (add --force to replace it)' % p)
    guard_outputs(outs, ins)


def main():
    spec = argparse.ArgumentParser(add_help=False, allow_abbrev=False)
    spec.add_argument('--spec', default=argparse.SUPPRESS, help='the job\'s spec (default tools/casting.json)')
    ap = argparse.ArgumentParser(description='Character sheets, location plates and key frames on gpt-image-2 (CASTING.md).', allow_abbrev=False)
    ap.add_argument('--spec', default=os.path.join('tools', 'casting.json'), help='the job\'s spec (default tools/casting.json)')
    sub = ap.add_subparsers(dest='cmd', required=True)

    def cmd(name):
        return sub.add_parser(name, parents=[spec], allow_abbrev=False)

    def paid(p):
        p.add_argument('--go', action='store_true', help='spend: without it, a dry run with the quote')
        p.add_argument('--env', help='read OPENAI_API_KEY from this file only')
        p.add_argument('--timeout', type=float, default=900)
        p.add_argument('--backoff', type=float, default=30, help=argparse.SUPPRESS)
        return p
    p = sub.add_parser('init', allow_abbrev=False); p.add_argument('dir')
    p = cmd('plan'); p.add_argument('groups', nargs='*')
    paid(cmd('candidates')).add_argument('--only')
    p = cmd('review'); p.add_argument('what', choices=['candidates', 'stills']); p.add_argument('--batch'); p.add_argument('--only')
    p = paid(cmd('lock')); p.add_argument('--pick'); p.add_argument('--rebuild', action='store_true')
    p = paid(cmd('states')); p.add_argument('--only'); p.add_argument('--rebuild', action='store_true')
    p = paid(cmd('locations')); p.add_argument('--only'); p.add_argument('--redo', action='store_true')
    p = cmd('pick'); p.add_argument('name'); p.add_argument('variant')
    p = paid(cmd('stills')); p.add_argument('--batch'); p.add_argument('--only'); p.add_argument('--redo', action='store_true')
    p = paid(cmd('fix')); p.add_argument('id'); p.add_argument('--rebuild', action='store_true')
    cmd('cost')
    p = sub.add_parser('pin', allow_abbrev=False); p.add_argument('src'); p.add_argument('dst'); p.add_argument('--cols'); p.add_argument('--rows')
    p.add_argument('--grey', default='#8a8a8a'); p.add_argument('--force', action='store_true')
    p = sub.add_parser('paste', allow_abbrev=False); p.add_argument('orig'); p.add_argument('edit'); p.add_argument('out'); p.add_argument('--box', required=True)
    p.add_argument('--feather', type=int, default=18); p.add_argument('--why', default=''); p.add_argument('--force', action='store_true')
    p = sub.add_parser('restore', allow_abbrev=False); p.add_argument('base'); p.add_argument('src'); p.add_argument('out'); p.add_argument('--ellipse', required=True)
    p.add_argument('--feather', type=int, default=28); p.add_argument('--why', default=''); p.add_argument('--force', action='store_true')
    a = ap.parse_args()
    need_numpy('casting.py')
    if a.cmd == 'init':
        return cmd_init(a)
    if a.cmd == 'pin':
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', a.grey):
            die(2, '--grey %r: one hex like #8a8a8a' % a.grey)
        free_io(a, [a.dst], [a.src])
        rec = pin_grey(a.src, a.dst, ints(a.cols, what='--cols') if a.cols is not None else None,
                       ints(a.rows, what='--rows') if a.rows is not None else None, a.grey)
        print(json.dumps(rec, indent=1))
        if not rec['ok']:
            die(1, '⚠ the grey is NOT pinned (a panel with no neutral grey to seed from, or the background off %s)' % a.grey)
        return
    if a.cmd == 'paste':
        free_io(a, [a.out, os.path.splitext(a.out)[0] + '.json'], [a.orig, a.edit])
        print(json.dumps(paste_boxes(a.orig, a.edit, a.out, [ints(a.box, 4, '--box')], a.feather, a.why)))
        return
    if a.cmd == 'restore':
        free_io(a, [a.out, os.path.splitext(a.out)[0] + '.json'], [a.base, a.src])
        el = ints(a.ellipse, 4, '--ellipse')
        q = restore_problems({'ellipse': el, 'feather': a.feather}, size_of(a.base), 'restore')
        if q:
            die(2, '; '.join(q))
        print(json.dumps(restore_face(a.base, a.src, a.out, el, a.feather, a.why)))
        return
    S = Spec(a.spec)
    {'plan': cmd_plan, 'candidates': cmd_candidates, 'review': cmd_review, 'lock': cmd_lock, 'states': cmd_states,
     'locations': cmd_locations, 'pick': cmd_pick, 'stills': cmd_stills, 'fix': cmd_fix, 'cost': cmd_cost}[a.cmd](S, a)
    if WARN:
        die(1, '⚠ done, with something to look at: %s' % '; '.join(os.path.basename(w) if os.sep in w else w for w in WARN))


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        die(130, 'stopped — a request in flight stays in the ledger at its estimate (it may be billed)')
    except Exception:                                    # a bug: never mistaken for "done, with something to look at"
        import traceback
        sys.stderr.write(scrub(traceback.format_exc()))
        die(5, '✗ casting.py hit an unexpected error (above). Paid images already saved stay; the ledger counts every request sent')
