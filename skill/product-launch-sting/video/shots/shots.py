#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shot writer: a film's shots as one spec, compiled into the key-frame and video prompts for the model the user
picked, and checked before anything is spent (SHOTS.md). Free: no network, no keys, nothing generated.

  python3 shots.py init    [--spec tools/shots.json] [--model h3|seedance] [--shots S01,S02,…]   starter (never overwrites)
  python3 shots.py check   [--spec …]                            lint every shot
  python3 shots.py build   [ID …] [--spec …]                     shots/<ID>.key.txt + <ID>.<model>.txt + shots/plan.json
  python3 shots.py show    ID [--spec …]                         the prompts and what is still only proposed
  python3 shots.py confirm ID … [--spec …]                       Alex OK'd a shot's proposed fields
  python3 shots.py emit-casting [ID …] [--spec …] [--force]      key frames into casting.json "stills" (its own entries only)
  python3 shots.py fov MM                                        horizontal field of view of a full-frame lens

The input can be anything: a few sentences, a script, a rough storyboard, or a story written together. Each shot
keeps Alex's own words verbatim (`brief`, `script`); every field Claude added is listed in `proposed` until Alex
confirms it. `model` (h3 or seedance) is asked every time and never assumed: a spec without one is refused.

Exit codes: 0 done · 1 done with warnings · 2 refused (a spec problem; nothing written) · 5 unexpected · 130 Ctrl-C.
"""
import argparse, ast, glob, hashlib, json, math, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
STARTER = os.path.join(HERE, 'starter.json')
RECIPES = os.path.join(HERE, 'recipes.json')
CASTING_PY = os.path.join(VIDEO, 'casting', 'casting.py')
PLACEHOLDERS_PY = os.path.join(VIDEO, 'storyboard', 'placeholders.py')

SAFE_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,80}\Z')            # as casting.py (\Z: no trailing newline)
SNIPPET = re.compile(r'\{([A-Z][A-Z0-9_]*)\}')
PLACEHOLDER = re.compile(r'<(?:FILL:|[a-z])[^<>\n]{0,300}>')      # casting's <…> and the storyboard lane's <FILL: …>
IMAGE_N = re.compile(r'(?<![@\w])Image\s+(\d+)\b')
WPS = 2.7                     # spoken words per second a line may need, at most
CPS = 4.0                     # …or CJK characters per second
CJK = re.compile(r'[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]')
NOSPACE = re.compile(r'[\u0e00-\u0eff\u1000-\u109f\u1780-\u17ff]')      # Thai, Lao, Myanmar, Khmer: no spaces between words
FOV_RE = re.compile(r'\{FOV:([0-9]+(?:\.[0-9]+)?)\}')              # as casting.py: {FOV:35} → the lens and its angle
LEFTOVER = re.compile(r'[{}]')                                      # any brace left after expansion: a typo'd snippet
HINT = re.compile(r'<FILL:[^<>\n]{0,300}>')                          # a starter hint, wherever it is in the spec
LOCKED = r'\blocked[\s-]?off\b|\bstatic\b|\bdoes(?: not|n\'t) move\b|\bno camera move'
VOICEOVER = 'voiceover'       # say.who for a voice no one in the frame speaks
VERBATIM = {'brief', 'script', 'proposed', 'confirmed', '_note'}    # Alex's words and our notes: never linted as prompts
SLOW = r'\bslow[\s-]motion\b|\b\d+\s*(?:fps|frames per second)\b'
MOVES = {   # camera moves as phrases, grouped by what the frame does (a dolly-out and a pull-back are one move)
    'in': r'(?:push(?:es|ed|ing)?|dolly(?:ing)?|dollies|creep(?:s|ing)?|zoom(?:s|ed|ing)?|move(?:s|d)?)[\s-]+(?:in|forward|closer|toward)',
    'out': r'(?:pull(?:s|ed|ing)?|dolly(?:ing)?|dollies|zoom(?:s|ed|ing)?|move(?:s|d)?)[\s-]+(?:back|out|away)|dolly-out',
    'pan': r'pan(?:s|ned|ning)?\s+(?:left|right|across|up|down|over|after|with|to)|whip[\s-]pan',
    'tilt': r'tilt(?:s|ed|ing)?\s+(?:up|down)',
    'orbit': r'orbit(?:s|ed|ing)?|half[\s-]orbit|circles?\s+(?:around|round)',
    'crane': r'crane(?:s|d)?\s+(?:up|down)|craning|boom(?:s|ed|ing)?\s+(?:up|down)',
    'track': r'tracking\s+shot|track(?:s|ed|ing)?\s+(?:alongside|beside|with|after)|truck(?:s|ed|ing)?\s+(?:left|right)',
}

MODELS = {
    'h3': {'name': 'MiniMax H3 (fal)', 'sec': (5, 10), 'lip_sync': False, 'beats': (1, 4),
           'i2v': 'minimax/h3-max/image-to-video', 'res': '1080P'},
    'seedance': {'name': 'Seedance 2.5 (fal)', 'sec': (4, 30), 'lip_sync': True, 'beats': (1, 10),
                 'i2v': 'bytedance/seedance-2.5/image-to-video', 'r2v': 'bytedance/seedance-2.5/reference-to-video',
                 'res': '480p', 'final': '720p'},                # drafts first, the chosen take again at 720p
}

TEXT = {   # built-in snippets, our own words; a spec's "text" overrides any of them
    'KEY_TAIL': 'Natural skin texture, visible film grain, slightly soft focus, unretouched, realistic, not a stock '
                'photo, no text, no logos, no watermark.',
    'H3_TAIL': 'Real-time, natural, candid motion. Keep the lighting, colours, depth of field and film grain of the '
               'first frame. No text, no captions, no logos.',
    'H3_TAIL_SLOW': 'Natural, candid motion. Keep the lighting, colours, depth of field and film grain of the first '
                    'frame. No text, no captions, no logos.',
    'MEDIUM': 'This is real live-action footage, shot in camera on location by a real crew: real people, real places, '
              'real weather.',
    'HOLD': 'The move eases in and eases out, then the camera holds still on the final framing to the last frame.',
    'BODY': 'Every body keeps its limb lengths, joints bend only the way real joints bend, and gravity is real.',
    'NO_TEXT': 'No text, captions, subtitles or logos appear anywhere in the frame.',
    'NO_MUSIC': 'No music.',
    # realism presets the recipes name (recipes.json); a shot may write its own instead
    'REAL_FILM': 'Shot on a cinema camera with a real spherical lens: fine organic grain, natural motion blur from a '
                 '180-degree shutter, frame edges a touch softer than the centre, restrained natural colour. Real skin '
                 'with pores and small asymmetries, real materials with creases, dust and wear; nothing looks rendered.',
    'REAL_ACTION_CAM': 'A tiny head-mounted action camera: a crisp digital look, slightly punchy contrast, auto '
                       'exposure that visibly reacts to light, a faint rolling-shutter skew on fast motion, and constant '
                       'unstabilised shake.',
    'REAL_HANDHELD': 'Raw documentary handheld: the frame breathes and jolts with a real operator, fine high-ISO grain, '
                     'natural motion blur, natural colour.',
    'REAL_16MM': 'The warm, slightly faded colour of real 16 mm film: visible organic grain and a gentle halation '
                 'around the brightest highlights.',
    'SLOWMO_120': 'Slow motion, constant for the whole shot: filmed at 120 fps, so everything moves at about a quarter '
                  'of real speed.',
}

TOP = {'_note', 'root', 'casting', 'placeholders', 'model', 'aspect', 'res', 'text', 'ban', 'people', 'products',
       'places', 'shots'}
PERSON = {'_note', 'sheet', 'is'}
PRODUCT = {'_note', 'ref', 'anatomy', 'colourway', 'is'}
PLACE = {'_note', 'loc', 'is'}
# phase 2, 2026-10-26 (SHOTS.md → "One trick, unbreakable rules, failure lines, acting"): the shot's one trick, the
# rules that can't break, failure lines, what not to take from each reference, a small task, acting, sizes three ways,
# negatives. All optional: a shot without them compiles exactly as before.
PHASE2 = ('trick', 'must', 'fail', 'refs', 'task', 'acting', 'sizes', 'negatives')
SHOT = {'_note', 'brief', 'script', 'proposed', 'confirmed', 'model', 'recipe', 'sec', 'aspect', 'people', 'extras',
        'products', 'place', 'position', 'key', 'motion', 'scene', 'first', 'final', 'lens', 'light', 'palette',
        'temp', 'count', 'physics', 'realism', 'audio', 'locks', 'links'} | set(PHASE2)
TRICK = {'_note', 'rule', 'so'}
ACTING = {'_note', 'who', 'direction', 'motive', 'goal', 'obstacle', 'tactic', 'eyes', 'restrained', 'lens'}
EYE = {'_note', 't', 'do'}
SIZE = {'_note', 'frame', 'body', 'hand'}
REF = {'_note', 'ref', 'dont'}
FIRST = 'first'               # refs[].ref for the input image Seedance animates (the approved key frame)
H3_WORDS = 120                # our budget for an H3 motion brief (The Lull's 20 sent prompts: 32–131 words, median ~66)
VAGUE = re.compile(r'(?<![A-Za-z])(slightly|a little|beautiful|stunning|nice|somewhat|very)(?![A-Za-z])', re.I)
LEAD_WORD = re.compile(r'(?:The|A|An|Her|His|Their|Its|Any|One|Two|Three|She|He|They|It|There|Someone|Something|Nothing|'
                       r'No|More|Every|Each|This|That|Our|My|Your)\b')
# a fail line that is already a whole verdict, kept as written: a condition ending "…, the shot is wrong", or a line
# opening "the shot is wrong if …". Anything else is a condition and gets the "If …, the shot is wrong." frame, so a
# line that only names a wrong thing ("she grabs the wrong cup") never reads as an instruction to do it. The frame and
# the clip count as the verdict's subject only after a comma ("if she stops, the frame is wrong"): "if the light in the
# frame is wrong" is a condition about something in the frame
VERDICT = re.compile(r"(?is)^(?:(?:if|when|whenever|once)\b.*(?:\b(?:the|this|that)\s+(?:shot|take)\s+is|,\s*(?:the|this|that)\s+(?:frame|clip)\s+is|"
                     r"\bit\s+is|\bit['’]s)\s+wrong[.!]?|(?:the|this)\s+(?:shot|take)\s+is\s+wrong\b.*)$")
COND = re.compile(r'(?i)^(?:if|when|whenever|once)\s+')
KEY = {'_note', 'id', 'batch', 'dir', 'frame', 'light', 'lens', 'refs', 'face', 'meta', 'prompt', 'tail'}
MOTION = {'_note', 'camera', 'beats', 'extra', 'hold', 'prompt', 'tail'}
BEAT = {'_note', 't', 'do', 'say'}
SAY = {'_note', 'who', 'line', 'voice'}
LENS = {'_note', 'mm', 'distance', 'focus', 'look'}
POSITION = {'_note', 'file', 'plate', 'legend'}
PALETTE = {'_note', 'accent', 'only', 'notes'}
LINKS = {'_note', 'from', 'via'}
LEGEND_COLOURS = ('red', 'blue', 'yellow', 'green', 'orange', 'purple', 'white', 'black', 'grey', 'gray')
# the type each field must have: a wrong one is refused by name (and dropped, so nothing downstream trips on it)
STR, STRS, OBJ, NUMBER, BOOL, ANY = 'text', 'a list of text', 'an object', 'a number', 'true or false', None
OBJS, TXTOBJ = 'a list of objects', 'text, or {rule, so}'
TYPES = {
    'top': {'root': STR, 'casting': STR, 'placeholders': STR, 'model': STR, 'aspect': STR, 'res': STR, 'text': OBJ,
            'ban': STRS, 'people': OBJ, 'products': OBJ, 'places': OBJ, 'shots': OBJ},
    'person': {'sheet': STR, 'is': STR}, 'product': {'ref': STR, 'anatomy': STR, 'colourway': STR, 'is': STR},
    'place': {'loc': STR, 'is': STR},
    'shot': {'brief': STR, 'script': STR, 'proposed': STRS, 'confirmed': STRS, 'model': STR, 'recipe': STR,
             'sec': NUMBER, 'aspect': STR, 'people': STRS, 'extras': STR, 'products': STRS, 'place': STR,
             'position': OBJ, 'key': OBJ, 'motion': OBJ, 'scene': STR, 'first': STR, 'final': STR, 'lens': OBJ,
             'light': STR, 'palette': OBJ, 'temp': STR, 'count': NUMBER, 'physics': STRS, 'realism': STR,
             'audio': STRS, 'locks': STRS, 'links': OBJ,
             'trick': TXTOBJ, 'must': STRS, 'fail': STRS, 'refs': OBJS, 'task': STR, 'acting': OBJ, 'sizes': OBJ,
             'negatives': STRS},
    'trick': {'rule': STR, 'so': STRS},
    'acting': {'who': STR, 'direction': STR, 'motive': STR, 'goal': STR, 'obstacle': STR, 'tactic': STR, 'eyes': OBJS,
               'restrained': BOOL, 'lens': ANY},
    'eye': {'do': STR}, 'size': {'frame': STR, 'body': STR, 'hand': STR}, 'ref': {'ref': STR, 'dont': STRS},
    'key': {'id': STR, 'batch': STR, 'dir': STR, 'frame': STR, 'light': STR, 'lens': STR, 'refs': STRS, 'face': STR,
            'meta': OBJ, 'prompt': STR, 'tail': STR},
    'motion': {'camera': STR, 'extra': STR, 'hold': BOOL, 'prompt': STR, 'tail': STR},
    'lens': {'mm': NUMBER, 'distance': STR, 'focus': STR, 'look': STR},
    'position': {'file': STR, 'plate': STR, 'legend': OBJ}, 'palette': {'accent': STR, 'only': STRS, 'notes': STR},
    'links': {'from': STR, 'via': STR}, 'beat': {'do': STR}, 'say': {'who': STR, 'line': STR, 'voice': STR},
}


class Refuse(Exception):
    pass


def fov(mm):
    """horizontal field of view of a full-frame (36 mm wide) lens, whole degrees"""
    return int(round(math.degrees(2 * math.atan(18.0 / float(mm)))))


def banned(text, ws):
    return [w for w in ws if re.search(r'(?<![A-Za-z])' + re.escape(w) + r'(?![A-Za-z])', text, re.I)]


def words(s):
    """the words in a line, in any script that puts spaces between words: letters with their combining marks (NFC
    first; an apostrophe joins two) and numbers. CJK characters are counted apart (speech_seconds)."""
    n, inw = 0, False
    for ch in CJK.sub(' ', unicodedata.normalize('NFC', s or '')):
        if unicodedata.category(ch)[0] in 'LMN':
            n += 0 if inw else 1
            inw = True
        elif not (inw and ch in "'’"):
            inw = False
    return n


def finite(v):
    try:
        return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
    except OverflowError:                       # an integer too big for a float
        return False


def ratio(asp):
    """an aspect "16:9" as a number, or None when it isn't W:H with both above 0"""
    m = re.fullmatch(r'(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)', str(asp))
    return float(m.group(1)) / float(m.group(2)) if m and float(m.group(1)) > 0 and float(m.group(2)) > 0 else None


def speech_seconds(line):
    """about how long a line takes to say: 2.7 words a second, plus 4 CJK characters a second"""
    return words(line) / WPS + len(CJK.findall(line or '')) / CPS


def short(v):
    s = json.dumps(v, ensure_ascii=False)
    return s if len(s) <= 40 else s[:37] + '…'


def typed(d, kind, where, errs):
    """a copy of d without the fields of the wrong type, each one reported"""
    out = {}
    for k, v in d.items():
        want = TYPES[kind].get(k, ANY)
        ok = (want is ANY or (want == STR and isinstance(v, str)) or (want == OBJ and isinstance(v, dict))
              or (want == STRS and isinstance(v, list) and all(isinstance(x, str) for x in v))
              or (want == BOOL and isinstance(v, bool))
              or (want == NUMBER and isinstance(v, (int, float)) and not isinstance(v, bool))
              or (want == OBJS and isinstance(v, list) and all(isinstance(x, dict) for x in v))
              or (want == TXTOBJ and isinstance(v, (str, dict))))
        if ok:
            out[k] = v
        else:
            errs.append('%s.%s: %s (got %s)' % (where, k, want, short(v)))
    return out


def no_dupes(pairs):
    seen = set()
    for k, _ in pairs:
        if k in seen:
            raise ValueError('duplicate key "%s": a JSON object holds each key once, and the second would silently '
                             'replace the first' % k)
        seen.add(k)
    return dict(pairs)


def end(s):
    """a sentence with its full stop, so the next one doesn't run into it"""
    s = s.strip()
    return s if not s or s[-1] in '.!?…:;"\'”’)' else s + '.'


def fov_text(mm):
    return '%g mm full-frame look, about %d degrees horizontal field of view' % (mm, fov(mm))      # as casting.py's


def join(*parts):
    """sentences joined by single spaces; empty parts dropped"""
    return ' '.join(str(p).strip() for p in parts if p is not None and str(p).strip())


NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']


def listing(xs):
    xs = [str(x) for x in xs]
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]


def listing_or(xs):
    xs = [str(x).strip() for x in xs]
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' or ' + xs[-1]


def cap(s):
    s = str(s).strip()
    return s[:1].upper() + s[1:]


def fail_line(x, names=()):
    """a failure line as the prompt prints it: "the folder grows while she drags it" → "If the folder grows while she
    drags it, the shot is wrong." A line that is already a whole verdict ("if …, the shot is wrong", "the shot is wrong
    if …") is kept as written (with its full stop). A leading if / when / whenever / once is dropped, and a capitalised
    first word is lowercased unless it is one of `names` (the spec's people, products and places, lower case)."""
    x = str(x).strip()
    if VERDICT.match(x):
        return end(cap(x))
    x = COND.sub('', x).rstrip(' .!?;:,')
    w = re.match(r"[A-Za-z][\w'’-]*", x)
    if w and (LEAD_WORD.match(x) or (w.group(0)[1:].islower() and w.group(0).lower() not in names)):
        x = x[:1].lower() + x[1:]                # "The folder grows" / "Camera shakes" → "If the folder grows" …
    return 'If %s, the shot is wrong.' % x


def span_ok(t, hi):
    """[start, end] in seconds, end after start, inside 0…hi"""
    return isinstance(t, list) and len(t) == 2 and all(finite(v) for v in t) and hi >= t[1] > t[0] >= 0


def tc(t):
    m, s = divmod(float(t), 60)
    return '%d:%02d' % (int(m), int(round(s))) if abs(s - round(s)) < 1e-6 else '%d:%04.1f' % (int(m), s)


def expand(s, text, partial=False, where='', errs=None):
    """{NAME} snippets, recursively. partial: names not in `text` stay as they are (casting.py's own, for later)."""
    n = 0
    while True:
        names = [x for x in SNIPPET.findall(s) if x in text] if partial else SNIPPET.findall(s)
        if not names:
            return s if partial else FOV_RE.sub(lambda m: fov_text(float(m.group(1))) if 4 <= float(m.group(1)) <= 1200
                                                else m.group(0), s)
        if not partial:
            bad = sorted(set(x for x in names if x not in text))
            if bad:
                if errs is not None:
                    errs.append('%s: unknown snippet {%s} (define it in the spec\'s "text")' % (where, bad[0]))
                return SNIPPET.sub('', s)
        s = SNIPPET.sub(lambda m: text[m.group(1)] if m.group(1) in text else m.group(0), s)
        n += 1
        if n > 12:
            if errs is not None:
                errs.append('%s: the snippets refer to each other in a loop' % where)
            return s


_CASTING_TEXT = None


def casting_builtins():
    """casting.py's own snippet texts, read from its source (not imported: no side effects)"""
    global _CASTING_TEXT
    if _CASTING_TEXT is None:
        _CASTING_TEXT = {}
        try:
            with open(CASTING_PY, encoding='utf-8') as f:
                tree = ast.parse(f.read())
            for node in tree.body:
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TEXT' for t in node.targets):
                    _CASTING_TEXT = {str(k): str(v) for k, v in ast.literal_eval(node.value).items()}
        except (OSError, ValueError, SyntaxError):
            pass
    return _CASTING_TEXT


_PH_MOD = None


def placeholders_mod():
    """storyboard/placeholders.py, loaded for its plate_hash, so "this sketch is older than its plate" has one
    definition; None when it can't be loaded (the check is then skipped)"""
    global _PH_MOD
    if _PH_MOD is None:
        _PH_MOD = False
        dw, sys.dont_write_bytecode = sys.dont_write_bytecode, True
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location('lv_placeholders', PLACEHOLDERS_PY)
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            _PH_MOD = m
        except Exception:                       # noqa: BLE001
            pass
        finally:
            sys.dont_write_bytecode = dw
    return _PH_MOD or None


def legend_items(lg):
    return ['the %s marks are %s' % (c.upper() if c.lower() in LEGEND_COLOURS else c, v) for c, v in lg.items()]


# ---------------------------------------------------------------- spec
class Spec:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        try:
            with open(self.path, encoding='utf-8') as f:
                d = json.load(f, object_pairs_hook=no_dupes)
        except FileNotFoundError:
            raise Refuse('no spec at %s (run `shots.py init` first)' % path)
        except (OSError, ValueError) as e:
            raise Refuse('%s: not readable JSON (%s)' % (path, e))
        if not isinstance(d, dict):
            raise Refuse('%s: the spec must be a JSON object' % path)
        self.d, self.errs, self.warns, self.infos = d, [], [], []
        self.dir = os.path.dirname(self.path)
        self.root = os.path.realpath(os.path.join(self.dir, str(d.get('root', '..'))))
        try:
            with open(RECIPES, encoding='utf-8') as f:
                self.recipes = {k: v for k, v in json.load(f).get('recipes', {}).items() if not k.startswith('_')}
        except (OSError, ValueError):
            self.recipes = {}
        self.own = {k: v for k, v in (d.get('text') if isinstance(d.get('text'), dict) else {}).items() if isinstance(v, str)}
        self.text = dict(TEXT)
        self.text.update(self.own)
        self.cast, self._ph = None, None

    def casting_names(self):
        """the snippets casting.py expands in a key frame: its built-ins and the casting spec's own"""
        n = set(casting_builtins())
        if self.cast and self.cast.get('raw') and isinstance(self.cast['raw'].get('text'), dict):
            n |= set(str(k) for k in self.cast['raw']['text'])
        return n

    def key_names(self):
        """what shots.py expands in a key prompt before casting.py sees it: this spec's own text, and our built-ins
        casting.py doesn't define (a name it defines, built in or in casting.json, is left for it)"""
        t = {k: v for k, v in TEXT.items() if k not in self.casting_names()}
        t.update(self.own)
        return t

    def casting_text(self):
        """the snippets casting.py itself expands in what emit-casting wrote: its built-ins, the casting spec's own,
        GREY_HEX (and {FOV:n})"""
        t = dict(casting_builtins())
        cs = (self.cast or {}).get('raw') or {}
        t.update({k: str(v) for k, v in (cs.get('text') if isinstance(cs.get('text'), dict) else {}).items()})
        t['GREY_HEX'] = str(cs.get('grey') or '#8a8a8a')
        return t

    def load_casting(self):
        c = self.d.get('casting', 'casting.json')         # beside this spec, as SHOTS.md says
        if not c:
            return None
        p = os.path.join(self.dir, str(c))
        try:
            with open(p, encoding='utf-8') as f:
                cs = json.load(f)
        except FileNotFoundError:
            return {'path': p, 'sheets': set(), 'locs': set(), 'missing': True, 'raw': None}
        except (OSError, ValueError) as e:
            raise Refuse('casting %s: not readable JSON (%s)' % (p, e))
        if not isinstance(cs, dict):
            raise Refuse('casting %s: not a casting spec' % p)
        for g in ('lock', 'states', 'locations', 'stills', 'text', 'dirs'):
            if cs.get(g) is not None and not isinstance(cs[g], dict):
                raise Refuse('casting %s: "%s" must be an object (casting.py refuses it too)' % (p, g))
        ids = lambda g: set(k for k in (cs.get(g) or {}) if not str(k).startswith('_'))
        return {'path': p, 'sheets': ids('lock') | ids('states'), 'locs': ids('locations'), 'missing': False, 'raw': cs}

    def placeholders(self):
        """the storyboard's plate spec (STORYBOARD.md), where position.plate finds its pencil sketch"""
        if self._ph is None:
            p = os.path.join(self.dir, str(self.d.get('placeholders', 'placeholders.json')))
            self._ph = {'path': p, 'missing': True, 'plates': {}}
            try:
                with open(p, encoding='utf-8') as f:
                    raw = json.load(f)
            except (OSError, ValueError):
                raw = None
            if isinstance(raw, dict):
                root = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(p)), str(raw.get('root', '..'))))
                self._ph = {'path': p, 'missing': False, 'raw': raw, 'out': os.path.join(root, str(raw.get('out', 'assets/plates'))),
                            'plates': raw['plates'] if isinstance(raw.get('plates'), dict) else {}}
        return self._ph


def keys(d, allowed, where, errs):
    if not isinstance(d, dict):
        errs.append('%s: must be an object' % where)
        return False
    bad = sorted(set(d) - allowed)
    if bad:
        errs.append('%s: unknown key%s %s (allowed: %s)' % (where, 's' if len(bad) > 1 else '', ', '.join(bad),
                                                              ', '.join(sorted(allowed - {'_note'}))))
    return True


def strlist(v, where, errs):
    if v is None:
        return []
    if not isinstance(v, list) or any(not isinstance(x, str) for x in v):
        errs.append('%s: a list of text' % where)
        return []
    return v


def num(v, where, errs, lo, hi):
    try:
        ok = not isinstance(v, bool) and isinstance(v, (int, float)) and math.isfinite(v) and lo <= v <= hi
    except OverflowError:                       # an integer too big for a float
        ok = False
    if not ok:
        errs.append('%s: a number from %g to %g (got %s)' % (where, lo, hi, short(v)))
        return None
    return float(v)


# ---------------------------------------------------------------- one shot
class Shot:
    """a shot with its recipe's defaults filled in; validates itself and compiles to the prompts"""

    def __init__(self, S, sid, raw):
        e = S.errs
        where = self.where = 'shots.%s' % sid
        keys(raw, SHOT, where, e)
        raw = typed(raw, 'shot', where, e)
        self.S, self.id, self.raw = S, sid, raw
        self.model = raw.get('model', S.d.get('model'))
        if self.model is not None and self.model not in MODELS:
            e.append('%s: model is h3 or seedance (got %s)' % (where, json.dumps(self.model)))
        self.M = MODELS.get(self.model) or MODELS['h3']
        rec = raw.get('recipe')
        self.recipe = {}
        if rec is not None:
            if rec not in S.recipes:
                e.append('%s.recipe: unknown recipe "%s" (recipes: %s)' % (where, rec, ', '.join(sorted(S.recipes))))
            else:
                self.recipe = S.recipes[rec]
        lo, hi = self.M['sec']
        self.sec = None
        if 'sec' not in raw:
            e.append('%s.sec: the shot\'s length in seconds (%s: %d–%d)' % (where, self.M['name'], lo, hi))
        else:
            self.sec = num(raw['sec'], where + '.sec', e, lo, hi)
            if self.sec is not None and self.sec != int(self.sec):
                e.append('%s.sec: whole seconds (gen.mjs asks the model for whole seconds; got %g)' % (where, self.sec))
        self.people = strlist(raw.get('people'), where + '.people', e)
        self.products = strlist(raw.get('products'), where + '.products', e)
        self.place = raw.get('place')
        if self.place is not None and not isinstance(self.place, str):
            e.append('%s.place: a place id' % where)
            self.place = None
        self.proposed = strlist(raw.get('proposed'), where + '.proposed', e)
        strlist(raw.get('confirmed'), where + '.confirmed', e)
        self.lens = self.g('lens')
        if isinstance(self.lens, dict):
            self.lens = typed(self.lens, 'lens', where + '.lens', e)
        if self.lens is not None:
            if keys(self.lens, LENS, where + '.lens', e) and 'mm' in self.lens:
                if num(self.lens['mm'], where + '.lens.mm', e, 4, 1200) is None:
                    self.lens = dict(self.lens)
                    self.lens.pop('mm')
            elif not isinstance(self.lens, dict):
                self.lens = None
        self.key = raw.get('key')
        if self.key is not None and not keys(self.key, KEY, where + '.key', e):
            self.key = None
        if self.key is not None:
            self.key = typed(self.key, 'key', where + '.key', e)
            for k2, what in (('id', 'the still\'s id in casting.json'), ('dir', 'one folder name under the stills folder')):
                v = self.key.get(k2)
                if v is not None and (not SAFE_ID.match(v) or '..' in v):
                    e.append('%s.key.%s %s: %s: letters, digits, . _ - only, no slashes' % (where, k2, short(v), what))
                    self.key.pop(k2)
        self.motion = raw.get('motion')
        if self.motion is None:
            e.append('%s.motion: the shot\'s camera and action (motion.camera, motion.beats)' % where)
            self.motion = {}
        elif not keys(self.motion, MOTION, where + '.motion', e):
            self.motion = {}
        else:
            self.motion = typed(self.motion, 'motion', where + '.motion', e)
        self.position = raw.get('position')
        if self.position is not None and not keys(self.position, POSITION, where + '.position', e):
            self.position = None
        if self.position is not None:
            self.position = typed(self.position, 'position', where + '.position', e)
        if self.position and self.position.get('legend') is not None and not (
                isinstance(self.position['legend'], dict) and all(isinstance(v, str) for v in self.position['legend'].values())):
            e.append('%s.position.legend: {"red": "what the red marks are", …}' % where)
            self.position = dict(self.position, legend=None)
        pal = self.g('palette')
        if pal is not None and not keys(pal, PALETTE, where + '.palette', e):
            self.recipe = dict(self.recipe, palette=None)
        elif isinstance(pal, dict):
            self.recipe = dict(self.recipe, palette=typed(pal, 'palette', where + '.palette', e))
            self.raw = raw = dict(raw, palette=self.recipe['palette']) if 'palette' in raw else raw
        if raw.get('links') is not None and keys(raw['links'], LINKS, where + '.links', e):
            self.raw = raw = dict(raw, links=typed(raw['links'], 'links', where + '.links', e))
        self.temp = raw.get('temp')
        if self.temp is not None and self.temp not in ('warm', 'cold', 'neutral'):
            e.append('%s.temp: warm, cold or neutral (got %s)' % (where, json.dumps(self.temp)))
            self.temp = None
        cnt = raw.get('count')
        if cnt is not None and (isinstance(cnt, bool) or not isinstance(cnt, int) or not 0 <= cnt <= 1000):
            e.append('%s.count: how many people are visible, a whole number up to 1000' % where)
            self.raw = raw = {k: v for k, v in raw.items() if k != 'count'}
        if raw.get('aspect') is not None and ratio(raw['aspect']) is None:
            e.append('%s.aspect: W:H with both above 0, e.g. 16:9 (got %s)' % (where, short(raw['aspect'])))
            self.raw = raw = {k: v for k, v in raw.items() if k != 'aspect'}
        self.beats = self._beats()
        self._phase2()

    # ---- phase 2: each field parsed and type-checked here (a wrong one is refused in one line and dropped)
    def _phase2(self):
        e, where, raw = self.S.errs, self.where, self.raw
        self.uses2 = any(k in raw for k in PHASE2)
        t = raw.get('trick')
        if isinstance(t, str):
            t = {'rule': t}
        elif isinstance(t, dict):
            keys(t, TRICK, where + '.trick', e)
            bad_rule = 'rule' in t
            t = typed(t, 'trick', where + '.trick', e)
            if bad_rule and 'rule' not in t:            # its wrong type is already refused: one line per problem
                t = None
        if t is not None and not (t.get('rule') or '').strip():
            e.append('%s.trick: the one idea the shot is built on, in one sentence ("rule"; its consequences in "so")' % where)
            t = None
        if t is not None and any(not x.strip() for x in t.get('so') or []):
            e.append('%s.trick.so: each consequence in words (an empty one was given)' % where)
            t = dict(t, so=[x for x in t['so'] if x.strip()])
        self.trick = t
        for k, what in (('must', 'a rule'), ('fail', 'a failure line'), ('negatives', 'a negative')):
            v = list(raw.get(k) or [])
            if any(not x.strip() for x in v):
                e.append('%s.%s: each entry is %s in words (an empty one was given)' % (where, k, what))
                v = [x for x in v if x.strip()]
            setattr(self, k, v)
        self.task = raw.get('task')
        if self.task is not None and not self.task.strip():
            e.append('%s.task: the small task the person keeps doing all through the shot, in words' % where)
            self.task = None
        conf, prop = (raw.get('confirmed') or []), (self.proposed or [])
        self.neg_ok = bool(self.negatives) and 'negatives' in conf and 'negatives' not in prop      # Alex OK'd them
        # refs: what not to take from each reference image
        self.dont, names = {}, self.ref_names()
        for i, x in enumerate(raw.get('refs') or []):
            w = '%s.refs[%d]' % (where, i)
            keys(x, REF, w, e)
            had, had_ref = 'dont' in x, 'ref' in x
            x = typed(x, 'ref', w, e)
            r, dont = x.get('ref'), [d for d in (x.get('dont') or []) if d.strip()]
            if (had and 'dont' not in x) or (had_ref and 'ref' not in x):
                pass                                # its wrong type is already refused above
            elif not r:
                e.append('%s.ref: which reference (%s)' % (w, ', '.join(names)))
            elif r not in names:
                e.append('%s.ref: "%s" is none of this shot\'s references (%s)' % (w, r, ', '.join(names)))
            elif r in self.dont:
                e.append('%s.ref: "%s" is listed twice; give each reference one entry' % (w, r))
            elif not dont:
                e.append('%s.dont: what NOT to take from %s (its people, light, grade, depth of field, framing, props …)' % (w, r))
            else:
                if len(dont) < len(x.get('dont') or []):
                    e.append('%s.dont: each entry is a thing not to take, in words (an empty one was given)' % w)
                self.dont[r] = dont
        # acting: whose, the inner task, eye beats, the register, when the lens may be looked into
        self.acting, self.actor = None, None
        a = raw.get('acting')
        if a is not None:
            keys(a, ACTING, where + '.acting', e)
            had_who = 'who' in a
            a = typed(a, 'acting', where + '.acting', e)
            who = a.get('who')
            if who is None and len(self.people) == 1:
                who = self.people[0]
            if who is None and had_who and 'who' not in a:
                pass                                    # its wrong type is already refused
            elif who is None:
                e.append('%s.acting: %s' % (where, 'whose acting? Set acting.who to one of this shot\'s people (%s)'
                                            % ', '.join(self.people) if self.people else 'acting needs a person in the shot (people)'))
            elif who not in self.people:
                e.append('%s.acting.who: "%s" is not one of this shot\'s people (%s)' % (where, who, ', '.join(self.people) or 'none'))
            else:
                self.actor = who
            eyes = []
            for i, x in enumerate(a.get('eyes') or []):
                w = '%s.acting.eyes[%d]' % (where, i)
                keys(x, EYE, w, e)
                had = 'do' in x
                x = typed(x, 'eye', w, e)
                if had and 'do' not in x:
                    continue                            # its wrong type is already refused
                if not span_ok(x.get('t'), self.M['sec'][1]):
                    e.append('%s.t: [start, end] in seconds, end after start, at most %d s' % (w, self.M['sec'][1]))
                elif not (x.get('do') or '').strip():
                    e.append('%s.do: what the eyes do then' % w)
                else:
                    eyes.append(x)
            lens = a.get('lens')
            if lens is not None and not (isinstance(lens, list) and all(span_ok(x, self.M['sec'][1]) for x in lens)):
                e.append('%s.acting.lens: the moments the person may look into the lens, [[start, end], …] in seconds (got %s)'
                         % (where, short(lens)))
                lens = None
            self.acting = dict(a, eyes=eyes, lens=lens or [])
        # sizes: each key object measured three ways
        self.sizes = []
        for thing, v in (raw.get('sizes') or {}).items():
            w = '%s.sizes.%s' % (where, thing)
            if not isinstance(v, dict):
                e.append('%s: {frame, body, hand}: its share of the frame, against the body, against the hand' % w)
                continue
            n_err = len(e)
            keys(v, SIZE, w, e)
            unknown = len(e) > n_err
            n0 = len(v)
            v = typed(v, 'size', w, e)
            got = {k: v[k].strip() for k in ('frame', 'body', 'hand') if (v.get(k) or '').strip()}
            if (len(v) < n0 or unknown) and not got:
                continue                                # its unknown keys or wrong-typed measures are already refused
            if not str(thing).strip() or not got:
                e.append('%s: {frame, body, hand}: its share of the frame, against the body, against the hand' % w)
            else:
                self.sizes.append((str(thing).strip(), got))

    def ref_names(self):
        """what refs[].ref may name: this shot's people, its place, its products, its position sketch, and the input image"""
        return list(self.people) + ([self.place] if self.place else []) + list(self.products) + (
            ['position'] if self.position else []) + [FIRST]

    def g(self, k, d=None):
        """a shot field, else its recipe's default"""
        v = self.raw.get(k) if k in self.raw else self.recipe.get(k, d)
        return v

    def _beats(self):
        e, where = self.S.errs, self.where + '.motion.beats'
        b = self.motion.get('beats', self.recipe.get('beats'))
        if b is None:
            return []
        if not isinstance(b, list):
            e.append('%s: a list of beats' % where)
            return []
        out = []
        for i, x in enumerate(b):
            w = '%s[%d]' % (where, i)
            if isinstance(x, str):
                out.append({'t': None, 'do': x, 'say': None})
                continue
            if not keys(x, BEAT, w, e):
                continue
            x = typed(x, 'beat', w, e)
            t = x.get('t')
            if t is not None and not (isinstance(t, list) and len(t) == 2 and all(finite(v) for v in t)
                                      and self.M['sec'][1] >= t[1] > t[0] >= 0):
                e.append('%s.t: [start, end] in seconds, end after start, at most %d s' % (w, self.M['sec'][1]))
                t = None
            say = x.get('say')
            if isinstance(say, str):
                say = {'who': None, 'line': say}
            elif say is not None:
                if not keys(say, SAY, w + '.say', e):
                    say = None
                else:
                    say = typed(say, 'say', w + '.say', e)
                    if not (say.get('line') or '').strip():
                        e.append('%s.say.line: the line, word for word' % w)
                        say = None
            do = x.get('do', '')
            if not isinstance(do, str):
                e.append('%s.do: text' % w)
                do = ''
            out.append({'t': t, 'do': do, 'say': say})
        return out

    # ---- references, in the order they are sent: people's sheets, the place, products, the position sketch
    def refs(self):
        d, out = self.S.d, []
        for p in self.people:
            pe = (d.get('people') or {}).get(p) or {}
            if pe.get('sheet'):
                out.append(('sheet:%s' % pe['sheet'], 'person', p))
        if self.place:
            pl = (d.get('places') or {}).get(self.place) or {}
            if pl.get('loc'):
                out.append(('loc:%s' % pl['loc'], 'place', self.place))
        for pr in self.products:
            po = (d.get('products') or {}).get(pr) or {}
            if po.get('ref'):
                out.append((po['ref'], 'product', pr))
        f = self.position_ref()[0]
        if f:
            out.append((f, 'position', None))
        return out

    def position_ref(self):
        """(the sketch, relative to the job folder, or None; its legend or None; the sketch's own record or None).
        position.plate is a storyboard plate's pencil sketch (placeholders.py sketch), with its legend beside it."""
        pos = self.position or {}
        if pos.get('file'):
            return pos['file'], pos.get('legend') or None, None
        ph = self.S.placeholders() if pos.get('plate') else None
        if not ph or ph['missing']:
            return None, pos.get('legend') or None, None
        png = os.path.join(ph['out'], '%s-sketch.png' % pos['plate'])
        try:
            with open(png[:-4] + '.json', encoding='utf-8') as f:
                side = json.load(f)
        except (OSError, ValueError):
            side = None
        if not (isinstance(side, dict) and side.get('lv') == 'position'):
            side = None
        lg = pos.get('legend') or (side or {}).get('legend')
        return os.path.relpath(png, self.S.root), lg if isinstance(lg, dict) and lg else None, side

    def lens_text(self, long=False):
        L = self.lens or {}
        parts = []
        if 'mm' in L:
            mm = '%g' % L['mm']
            parts.append('%s mm full-frame look, about %d degrees horizontal field of view' % (mm, fov(L['mm']))
                         if long else '%s mm lens' % mm)
        if L.get('distance'):                        # "about 40 m to the side" and "at eye level" read as they are
            dist = L['distance'].strip()
            parts.append(dist if re.match(r'(?i)(about|around|roughly|some|at|from|over|under|behind|above|below|in front|'
                                          r'beside|level|close|right|just|only)\b', dist) else 'from about ' + dist)
        if L.get('focus'):
            parts.append(L['focus'])
        if L.get('look'):
            parts.append(L['look'])
        return (', '.join(parts) + '.') if parts else ''

    # ---- phase 2 text, our own words (each part is '' when its field isn't given)
    def person_name(self, pid):
        return cap((self.S.d.get('people') or {}).get(pid, {}).get('is') or pid)

    def trick_text(self, short=False):
        """the trick as the ACTION's governing rule; short=True is H3's lead-in, light on its 120-word budget"""
        t = self.trick
        if not t:
            return ''
        return join(('Rule of the shot: ' if short else 'Rule of the shot, and everything in it follows from this: ') + end(t['rule']),
                    ('It follows that: ' + ' '.join(end(cap(x)) for x in t['so'])) if t.get('so') else '')

    def must_text(self):
        if not self.must:
            return ''
        return ('%s before everything else in this shot, never traded for anything: ' % (
            'This rule comes' if len(self.must) == 1 else 'These %s rules come' % (NUMBERS[len(self.must)] if len(self.must) < len(NUMBERS) else len(self.must)))
            + ' '.join(end(cap(x)) for x in self.must))

    def task_text(self):
        if not self.task:
            return ''
        return join('All through the shot, first frame to last, they keep at one ordinary job: ' + end(self.task.strip()),
                    'The event does not stop it and the camera does not feature it; whatever the event stirs in them '
                    'stays smaller than this.')

    def acting_lines(self):
        a = self.acting
        if a is None:
            return []
        who, out = self.person_name(self.actor) if self.actor else 'The person', []
        parts = [('direction', 'Direction (what they are after)'), ('motive', 'Motive (why it matters now)'),
                 ('goal', 'Goal'), ('obstacle', 'Obstacle'), ('tactic', 'Tactic (the visible part: how they get round it)')]
        inner = ['%s: %s' % (label, end(a[k].strip())) for k, label in parts if (a.get(k) or '').strip()]
        if inner:
            mid = ((self.S.d.get('people') or {}).get(self.actor, {}).get('is') or self.actor) if self.actor else 'the person'
            out.append(join('Acting notes for %s, an inner life that is never shown off to the camera; the thinking '
                            'shows in the eyes first, and the face catches up.' % mid.strip(), *inner))
        if a.get('eyes'):
            out.append('%s\'s eyes, moment by moment: %s.' % (who, '; '.join(
                '%s-%s %s' % (tc(x['t'][0]), tc(x['t'][1]), x['do'].strip().rstrip('.')) for x in a['eyes'])))
        if a.get('restrained'):
            out.append('Keep it understated: the strong moments land in the hands, the breath and the footing, not in '
                       'the face; no open mouth, no wide grin, no gasp, nothing bigger than someone alone would really do.')
        out.append('%s never looks into the lens%s. Head and eyes always turn the same way; the blinks keep no rhythm; '
                   'the eyes keep working and never park on one point.' % (who, (', except at ' + '; '.join(
                       '%s-%s' % (tc(x[0]), tc(x[1])) for x in a['lens'])) if a.get('lens') else ''))
        return out

    def size_text(self, still=False):
        if not self.sizes:
            return ''
        how = {3: ', sized three ways that must match:', 2: ', sized two ways that must match:', 1: ':'}
        s = ['%s%s %s.' % (cap(thing), how[len(v)], '; '.join(
            '%s %s' % (label, v[k].rstrip('.')) for k, label in (('frame', 'in the frame,'), ('body', 'against the body,'),
                                                                  ('hand', 'in the hand,')) if k in v))
            for thing, v in self.sizes]
        # real size, not size on screen: a person or thing walking up to the lens does grow in the frame
        return join(*s, '' if still else 'Nothing changes its real size during the shot: only its distance from the lens '
                                         'makes it look bigger or smaller.')

    def dont_text(self, name, image=None):
        d = self.dont.get(name)
        if not d:
            return ''
        if name == FIRST:                            # it is already in frame 1: what matters is that it doesn't carry on
            return 'From it, let none of this carry on into the motion or build up: %s.' % listing_or(d)
        return 'Take nothing else from %s: not %s.' % ('Image %d' % image if image else 'it', listing_or(d))

    def names(self):
        """the spec's people, products and places, lower case: a fail line's first word that names one keeps its capital"""
        d = self.S.d
        out = set()
        for k in ('people', 'products', 'places'):
            for i, v in (d.get(k) or {}).items():
                out.add(str(i).lower())
                if isinstance(v, dict):
                    out.update(w.lower() for w in re.findall(r"\b[A-Z][\w'’-]*", str(v.get('is') or v.get('name') or '')))
        return out

    def fail_lines(self):
        names = self.names()
        return [fail_line(x, names) for x in self.fail]

    def negative_text(self):
        if not (self.negatives and self.neg_ok):     # Claude's inversions reach a prompt only once Alex OK'd them
            return ''
        return 'None of these may happen: %s.' % '; '.join(x.strip().rstrip('.') for x in self.negatives)

    # ---- the key frame (a still for casting.py, then image-to-video); casting.py's own snippets stay as written
    def key_prompt(self):
        k, S = self.key or {}, self.S
        if k.get('prompt'):
            return expand(k['prompt'], S.key_names(), partial=True)
        lines, refs = [], self.refs()
        for i, (ref, role, name) in enumerate(refs, 1):
            if role == 'person':
                pe = S.d['people'][name]
                lines.append('Image %d is %s\'s locked character sheet: the face in its LEFT close-up is the only face '
                             'to use, and its other panels show the wardrobe.' % (i, pe.get('is') or name))
            elif role == 'place':
                lines.append('Image %d is the location: keep its architecture, materials, weather and light.' % i)
            elif role == 'product':
                po = S.d['products'][name]
                lines.append('Image %d is the product: reproduce it 1:1, identical in every line, surface and detail%s.'
                             % (i, ('; only its colours change: ' + po['colourway']) if po.get('colourway') else ''))
                if po.get('anatomy'):
                    lines.append(po['anatomy'])
            elif role == 'position':
                lines.append('Image %d is the position reference only: it gives the pose and the composition, nothing '
                             'else.' % i)
                lg = self.position_ref()[1]
                if lg:
                    lines.append('In it, %s.' % '; '.join(legend_items(lg)))
                lines.append('None of its lines, colours or paper appear in the frame.')
            lines.append(self.dont_text('position' if role == 'position' else name, i))     # '' unless refs[] names it
        for pr in self.products:                         # no photo: the product from words alone (the lint warns)
            po = (S.d.get('products') or {}).get(pr) or {}
            if not po.get('ref'):
                lines.append(join('The product, from these words alone:', end(po.get('anatomy') or 'the %s' % pr),
                                  ('Its colours: %s.' % po['colourway']) if po.get('colourway') else ''))
        if any(r[1] in ('person', 'place') for r in refs):
            lines.append('Do not copy any reference\'s grey background or sheet layout: make one single cinematic film '
                         'frame, %s.' % (self.raw.get('aspect') or S.d.get('aspect') or '16:9'))
        frame = k.get('frame') or self.raw.get('first') or ''
        return expand(join(*lines, frame, self.size_text(still=True), k.get('light') or self.raw.get('light') or '',
                           k.get('lens') or self.lens_text(), k.get('tail', '{KEY_TAIL}')), S.key_names(), partial=True)

    def key_final(self, where='', errs=None):
        """the key frame as casting.py will send it: what emit-casting writes (this spec's snippets and our built-ins
        expanded), then casting.py's own expansion of the rest (its built-ins and casting.json's text)"""
        return expand(self.key_prompt(), self.S.casting_text(), where=where, errs=errs)

    # ---- the video prompt for the chosen model
    def h3_prompt(self):
        m = self.motion
        if m.get('prompt'):
            return m['prompt']
        beats = [end(b['do']) for b in self.beats]      # a spoken line stays out: H3 has no lip-sync (the edit adds it)
        slow = self.slow_text()                # slow motion is timing, so the motion model needs it (and no "real-time")
        tail = m.get('tail', '{H3_TAIL_SLOW}' if slow else '{H3_TAIL}')
        # phase 2: the short brief gains the trick (first in the action, as its governing rule), then the fail lines
        # while the whole prompt stays within H3_WORDS
        head = [m.get('camera', self.recipe.get('camera', '')), self.trick_text(short=True), *beats, m.get('extra', '')]
        return join(*head, *self.h3_fails()[0], slow, tail)

    def h3_fails(self):
        """(the fail lines that fit the H3 budget, the ones left out), in the order given"""
        m = self.motion
        if not self.fail or m.get('prompt'):
            return [], list(self.fail_lines())
        slow = self.slow_text()
        head = [m.get('camera', self.recipe.get('camera', '')), self.trick_text(short=True), *[end(b['do']) for b in self.beats],
                m.get('extra', '')]
        tail = m.get('tail', '{H3_TAIL_SLOW}' if slow else '{H3_TAIL}')
        kept, left = [], []
        for f in self.fail_lines():
            if words(expand(join(*head, *kept, f, slow, tail), self.S.text, partial=True)) <= H3_WORDS:
                kept.append(f)
            else:
                left.append(f)
        return kept, left

    def slow_text(self):
        """the slow-motion sentences of the shot's realism (e.g. {SLOWMO_120})"""
        r = expand(str(self.g('realism') or ''), self.S.text, partial=True)
        return ' '.join(x for x in re.split(r'(?<=[.!?])\s+', r) if re.search(SLOW, x, re.I))

    def seedance_prompt(self):
        m, S, g = self.motion, self.S, self.g
        if m.get('prompt'):
            return m['prompt']
        blocks, people = [], S.d.get('people') or {}
        # image-to-video: the one image sent is the approved key frame, so the sheets, place, product and sketch reach
        # Seedance through it. (Reference-to-video, Kaye's way, would send them tagged @Image1 …: not wired yet.)
        who = [(people.get(p) or {}).get('is') or p for p in self.people]
        keep = (['the people in it (%s) with their faces, bodies and wardrobe' % listing(who)] if who else []) + ['the place', 'the light']
        if self.products:
            keep.append('the product')
        rl = ['The input image is the first frame of this shot. Keep exactly as they are: %s. Only what the ACTION '
              'describes changes.' % '; '.join(keep), self.dont_text(FIRST)]
        for pr in self.products:
            po = (S.d.get('products') or {}).get(pr) or {}
            if po.get('anatomy'):
                rl.append(po['anatomy'])
        blocks.append('REFERENCES: ' + join(*rl, '{MEDIUM}'))
        if self.raw.get('scene'):
            blocks.append('SCENE: ' + self.raw['scene'])
        first = self.raw.get('first') or (self.key or {}).get('frame')
        if first:
            blocks.append('FIRST FRAME: ' + first)
        lt = self.lens_text(long=True)
        if lt:                                           # a rectilinear lens keeps lines straight; a fisheye doesn't
            straight = 'mm' in (self.lens or {}) and not re.search(r'distort|fish-?eye|barrel', lt, re.I)
            blocks.append('OPTICS: ' + join(lt, 'One constant focal length for the whole shot%s.'
                                            % ('; straight lines stay straight' if straight else '')))
        cam = m.get('camera', self.recipe.get('camera', ''))
        if cam:
            hold = m.get('hold', self.recipe.get('hold', True)) and not re.search(LOCKED, cam, re.I)
            blocks.append('CAMERA: ' + join(cam, '{HOLD}' if hold else ''))
        if self.raw.get('final'):
            blocks.append('FINAL FRAMING: ' + self.raw['final'])
        acts = []
        for b in self.beats:
            s = ('%s-%s. ' % (tc(b['t'][0]), tc(b['t'][1])) if b['t'] else '') + end(b['do'])
            if b['say']:
                who, line = self.speaker(b['say'].get('who')) or ('[unknown speaker]', True), b['say']['line']
                if b['say'].get('who') == VOICEOVER:
                    s = join(s, 'A voice-over, from no one in the frame, says, word for word: "%s"' % line)
                elif who[1]:
                    s = join(s, '%s says, lip-synced and word for word: "%s"' % (who[0], line))
                else:
                    s = join(s, 'From %s, a voice says, word for word: "%s"' % (who[0], line))
                if b['say'].get('voice'):
                    s = join(s, '(%s)' % b['say']['voice'])
            acts.append(s)
        # phase 2: the trick governs the action, then the rules that can't break, the task under it all; the acting
        # after the timed beats
        acts = [x for x in (self.trick_text(), self.must_text(), self.task_text()) if x] + acts + self.acting_lines()
        if acts:
            blocks.append('ACTION:\n' + '\n'.join(acts))
        body, cnt = [], self.raw.get('count')
        if isinstance(cnt, int) and not isinstance(cnt, bool):
            word = NUMBERS[cnt] if cnt < len(NUMBERS) else str(cnt)
            body.append('Exactly %s %s visible in this shot.' % (word, 'person is' if cnt == 1 else 'people are'))
        body += [str(x) for x in (g('physics') or [])]
        blocks.append('BODY AND PHYSICS: ' + join(*body, self.size_text(), '{BODY}'))
        light = g('light')
        if light:
            blocks.append('LIGHT: ' + light)
        pal = g('palette') or {}
        if pal:
            col = []
            if pal.get('only'):
                col.append('The only saturated colours are %s.' % listing(pal['only']))
            if pal.get('accent'):
                col.append('The accent colour is %s.' % pal['accent'])
            col.append(pal.get('notes') or '')
            blocks.append('COLOUR: ' + join(*col))
        if g('realism'):
            blocks.append('REALISM: ' + g('realism'))
        aud, lines = list(g('audio') or []), [b['say']['line'] for b in self.beats if b['say']]
        if aud:                                          # the voice is always on the list when anyone speaks
            blocks.append('AUDIO: The soundtrack holds exactly these sounds and nothing else: %s. {NO_MUSIC}'
                          % '; '.join((['the spoken lines above'] if lines else []) + aud))
        locks = list(self.recipe.get('locks') or []) + list(self.raw.get('locks') or [])
        if lines:
            said = 'The only spoken words are %s' % ' then '.join('"%s"' % x for x in lines)
            locks.append(said if re.search(r'[.!?]"$', said) else said + '.')
        locks += self.fail_lines() + [self.negative_text()]       # phase 2: how the shot fails; negatives once OK'd
        blocks.append('LOCKS: ' + join(*locks, '' if aud else '{NO_MUSIC}', '{NO_TEXT}'))     # the score is ours
        return '\n\n'.join(blocks)

    def speaker(self, who):
        """(the speaker as the prompt names them, whether lips move) for say.who, or None when it names no one in this
        shot: a person in it speaks lip-synced; a product in it, or "voiceover", is a voice with no lips. With no who,
        the shot's only person; nothing is guessed."""
        people, products = self.S.d.get('people') or {}, self.S.d.get('products') or {}
        if who is None and len(self.people) == 1:
            who = self.people[0]
        if who in self.people:
            name = (people.get(who) or {}).get('is') or who
            return name[:1].upper() + name[1:], True
        if who in self.products:
            return (products.get(who) or {}).get('is') or 'the %s' % who, False
        if who == VOICEOVER:
            return 'a voice-over', False
        return None

    def video_prompt(self):
        return self.seedance_prompt() if self.model == 'seedance' else self.h3_prompt()

    # ---- the lint for this shot
    def lint(self):
        S, e, w, where, cast = self.S, self.S.errs, self.S.warns, self.where, self.S.cast
        d = S.d
        for p in self.people:
            pe = (d.get('people') or {}).get(p)
            if pe is None:
                e.append('%s.people: "%s" is not in the spec\'s people' % (where, p))
            elif not pe.get('sheet'):
                e.append('people.%s: no sheet: every character needs one, extras and animals too' % p)
            elif cast is not None and not cast['missing'] and pe['sheet'] not in cast['sheets']:
                e.append('%s: %s has no sheet in casting.json ("%s"): every character needs one, extras and animals '
                         'too, or the model invents a stranger in every shot' % (where, p, pe['sheet']))
        for pr in self.products:
            if pr not in (d.get('products') or {}):
                e.append('%s.products: "%s" is not in the spec\'s products' % (where, pr))
            elif not (d['products'][pr] or {}).get('ref'):
                w.append('%s: product %s has no ref (its photo): the key frame draws it from words alone, so it won\'t '
                         'match the real one' % (where, pr))
        cnt = self.raw.get('count')
        if isinstance(cnt, (int, float)) and not isinstance(cnt, bool) and self.people and cnt < len(self.people):
            e.append('%s.count: %g, but the shot lists %d people (%s), and every listed person is in the frame'
                     % (where, cnt, len(self.people), ', '.join(self.people)))
        for b in self.beats:
            if b['say'] and self.M['lip_sync'] and self.speaker(b['say'].get('who')) is None:
                who = b['say'].get('who')
                e.append('%s: say.who %s: whose line? One of this shot\'s people (%s), its products (%s), or "%s" '
                         '(a voice no one in the frame speaks)' % (where, short(who) if who is not None else 'is missing and '
                         'the shot has %d people' % len(self.people), ', '.join(self.people) or 'none',
                         ', '.join(self.products) or 'none', VOICEOVER))
        if self.place is not None:
            pl = (d.get('places') or {}).get(self.place)
            if pl is None:
                e.append('%s.place: "%s" is not in the spec\'s places' % (where, self.place))
            elif cast is not None and not cast['missing'] and pl.get('loc') not in cast['locs']:
                e.append('%s.place: location "%s" is not in casting.json\'s locations' % (where, pl.get('loc')))
        for ref, role, name in self.refs():
            if role == 'position' and (self.position or {}).get('plate'):
                continue                            # checked below, with the command that draws it
            if ':' not in ref and not os.path.isfile(os.path.join(S.root, ref)):
                e.append('%s: the %s reference %s is not a file (paths are relative to the job folder)' % (where, role, ref))
        if self.raw.get('extras'):
            w.append('%s: extras without a sheet ("%s") look different in every shot: fine far away, not for anyone '
                     'the viewer can recognise' % (where, self.raw['extras'][:50]))
        if self.proposed:
            w.append('%s: still only proposed, not yet OK\'d by Alex: %s (show it, then `shots.py confirm %s`)'
                     % (where, ', '.join(self.proposed), self.id))
        if self.position is not None:
            pos = self.position
            if pos.get('file') and pos.get('plate'):
                e.append('%s.position: a file or a plate, not both' % where)
            elif not pos.get('file') and not pos.get('plate'):
                e.append('%s.position: a file (a sketch) or a plate' % where)
            elif pos.get('plate'):
                ph = S.placeholders()
                rel = os.path.relpath(ph['path'], S.root)
                if ph['missing']:
                    e.append('%s.position.plate: no storyboard spec at %s (STORYBOARD.md; or set "placeholders", or give '
                             'position.file)' % (where, rel))
                elif pos['plate'] not in ph['plates']:
                    e.append('%s.position.plate: no plate "%s" in %s (plates: %s)' % (where, pos['plate'], rel, ', '.join(ph['plates']) or 'none'))
                else:
                    f, _, side = self.position_ref()
                    if not os.path.isfile(os.path.join(S.root, f)):
                        e.append('%s.position.plate: no sketch at %s yet; draw it (free): python3 $V/storyboard/placeholders.py '
                                 'sketch %s' % (where, f, pos['plate']))
                    elif side is None:
                        w.append('%s.position.plate: %s has no record beside it (-sketch.json), so its legend is unknown: '
                                 'draw it again' % (where, f))
                    else:
                        m, now = placeholders_mod(), None
                        try:
                            now = m and m.plate_hash(ph['raw'].get('aspect', '16x9'), m.sketch_plate(ph['raw'], pos['plate']))
                        except Exception:           # noqa: BLE001  (a malformed plate: placeholders.py check says why)
                            pass
                        if now and side.get('plate_hash') != now:
                            w.append('%s.position.plate: %s was drawn before plate %s last changed; draw it again: '
                                     'placeholders.py sketch %s' % (where, f, pos['plate'], pos['plate']))
            if (pos.get('file') or pos.get('plate')) and not self.position_ref()[1]:
                w.append('%s.position: no legend, so the key prompt cannot say what each colour means' % where)
            if self.key is None:
                w.append('%s.position: the sketch only shapes the key frame (the video model animates that frame), and '
                         'this shot has no key' % where)
        if not self.motion.get('prompt'):
            cam = self.motion.get('camera', self.recipe.get('camera', '')) or ''
            mv = sorted(k for k, rx in MOVES.items() if re.search(r'\b(?:%s)\b' % rx, cam, re.I))
            if 'in' in mv and 'out' in mv:
                mv.append('in-and-out')
            if len(mv) > 1:
                w.append('%s.motion.camera: %d camera moves (%s): one move per shot reads as real' % (where, len(mv), ', '.join(mv)))
            nb, (blo, bhi) = len(self.beats), self.M['beats']
            if nb == 0:
                e.append('%s.motion.beats: what happens, in order' % where)
            elif not (blo <= nb <= bhi):
                w.append('%s.motion.beats: %d beat%s; keep %s shots to %d–%d (one clear action each)' % (where, nb, '' if nb == 1 else 's', self.M['name'], blo, bhi))
        if self.model == 'seedance' and not self.motion.get('prompt'):
            timed = [b for b in self.beats if b['t']]
            if self.beats and len(timed) != len(self.beats):
                e.append('%s.motion.beats: on Seedance every beat has t: [start, end]' % where)
            elif timed and self.sec is not None and (abs(timed[0]['t'][0]) > 1e-6 or abs(timed[-1]['t'][1] - self.sec) > 0.05
                                                    or any(abs(a['t'][1] - b['t'][0]) > 1e-6 for a, b in zip(timed, timed[1:]))):
                w.append('%s.motion.beats: the beats should tile 0 to %g s without gaps or overlaps' % (where, self.sec))
            for b in timed:
                if self.sec is not None and b['t'][1] > self.sec + 0.05:
                    e.append('%s.motion.beats: a beat ends at %g s, after the shot\'s %g s (the clip stops there)'
                             % (where, b['t'][1], self.sec))
            if not self.raw.get('scene'):
                e.append('%s.scene: Seedance needs the whole shot in a sentence or two' % where)
            if not (self.raw.get('first') or (self.key or {}).get('frame')):
                e.append('%s.first: Seedance needs the first frame described (or key.frame)' % where)
            if self.raw.get('count') is None:
                w.append('%s.count: how many people are visible (it locks the head count)' % where)
            if not self.g('audio'):
                w.append('%s.audio: which sounds the clip may have (the model picks its own otherwise; "No music" is '
                         'locked either way)' % where)
        if not self.M['lip_sync'] and not self.motion.get('prompt'):
            for i, b in enumerate(self.beats):
                if not b['do'].strip():
                    e.append('%s.motion.beats[%d]: an H3 beat needs its action (do): a spoken line alone never reaches the '
                             'prompt' % (where, i))
        for b in self.beats:
            if not b['say']:
                continue
            if not self.M['lip_sync']:
                w.append('%s: a spoken line on %s, which has no lip-sync: it stays out of the prompt; the edit adds it '
                         'as a subtitle or a voiceover' % (where, self.M['name']))
            elif NOSPACE.search(b['say']['line']):
                w.append('%s: the line "%s" is in a script without spaces between words, so its length isn\'t checked: '
                         'time it by ear' % (where, b['say']['line'][:40]))
            elif b['t']:
                end_t = min(b['t'][1], self.sec) if self.sec is not None else b['t'][1]
                need, have = speech_seconds(b['say']['line']), end_t - b['t'][0]
                if need > have + 1e-6:
                    e.append('%s: the line "%s" needs about %.1f s, its beat is %.1f s' % (where, b['say']['line'][:40], need, have))
        k = self.key
        if k is not None and isinstance(k.get('refs'), list) and not k.get('prompt'):
            e.append('%s.key.refs: given without key.prompt, the numbered preamble would not match them' % where)
        if k is not None and not k.get('prompt') and not (k.get('frame') or self.raw.get('first')):
            e.append('%s.key: what the first frame shows (key.frame, or the shot\'s first)' % where)
        asp = self.raw.get('aspect') or d.get('aspect') or '16:9'
        sizes = (cast or {}).get('raw', {}).get('sizes') if cast is not None and cast.get('raw') else None
        if k is not None and cast is not None and cast.get('raw') and (sizes is None or (isinstance(sizes, list) and sizes)):
            sz = str((sizes or ['2560x1440'])[0])
            ms, ra = re.fullmatch(r'(\d+)x(\d+)', sz), ratio(asp)
            if ms and ra and int(ms.group(2)) and abs(int(ms.group(1)) / int(ms.group(2)) - ra) > 0.02:
                w.append('%s: the key frame is asked for %s, but casting.json makes %s: set its "sizes" to match (e.g. '
                         '["1440x2560"] for 9:16)' % (where, asp, sz))
        checks = [('video', expand(self.video_prompt(), S.text, where='%s video prompt' % where, errs=e))]
        if k is not None:
            kt = self.key_final('%s key prompt' % where, e)
            checks.append(('key', kt))
            nrefs = len(k['refs']) if isinstance(k.get('refs'), list) else len(self.refs())
            hi = max([int(x) for x in IMAGE_N.findall(kt)] or [0])
            if hi > nrefs:
                e.append('%s: the key prompt names Image %d but sends %d reference%s' % (where, hi, nrefs, '' if nrefs == 1 else 's'))
        for name, txt in checks:
            ph = PLACEHOLDER.search(txt)
            if ph:
                e.append('%s: the %s prompt still has a placeholder %s' % (where, name, ph.group(0)[:60]))
            left = LEFTOVER.search(txt)
            if left:
                e.append('%s: the %s prompt has a brace left in it, "…%s…" (a snippet is {NAME} in capitals, a lens angle '
                         '{FOV:35})' % (where, name, txt[max(0, left.start() - 20):left.start() + 20]))
            if re.search(r'\bin the style of\b', txt, re.I):
                w.append('%s: the %s prompt says "in the style of …": say the lens, distance, light and movement instead '
                         'of a name' % (where, name))
            bad = banned(txt, S.ban)
            if bad:
                e.append('%s: the %s prompt names %s (in the ban list)' % (where, name, ', '.join(sorted(set(bad)))))
            if not re.search(r'\bno text\b', txt, re.I):
                e.append('%s: the %s prompt does not say "no text"' % (where, name))
        exp = self.recipe.get('expect') or {}
        if exp.get('product') and not self.products:
            w.append('%s: the %s recipe needs a product' % (where, self.raw.get('recipe')))
        if exp.get('people') is False and self.people:
            w.append('%s: the %s recipe keeps people out of frame' % (where, self.raw.get('recipe')))
        if exp.get('slowmo') and not re.search(r'\b\d+\s*(?:fps|frames per second)\b', expand(
                str(self.g('realism') or '') + ' ' + json.dumps(self.motion), S.text, partial=True), re.I):
            w.append('%s: slow motion should give the capture rate (e.g. 120 fps, about quarter speed)' % where)
        self.lint2()

    def own_text(self):
        """(where, text) for the shot's own prompt-bound text: no Alex's verbatim words, no ids, paths or spoken lines,
        nothing from a recipe or a snippet"""
        out, skip_top = [], VERBATIM | {'people', 'products', 'place', 'recipe', 'model', 'aspect', 'temp', 'sec', 'count',
                                        'links', 'extras'}
        skip = {'key': {'id', 'batch', 'dir', 'face', 'meta', 'refs'}, 'position': {'file', 'plate'}}

        def walk(v, path):
            if isinstance(v, str):
                out.append((path, v))
            elif isinstance(v, dict):
                for k, x in v.items():
                    if (k in VERBATIM or (path == '' and k in skip_top) or k in skip.get(path, ()) or k in ('ref', 'who', 'line')
                            or (k == 'say' and isinstance(x, str))):        # a spoken line is the script's words
                        continue
                    walk(x, (path + '.' if path else '') + str(k))
            elif isinstance(v, list):
                for i, x in enumerate(v):
                    walk(x, '%s[%d]' % (path, i))
        walk(self.raw, '')
        return out

    def lint2(self):
        """the checks of SHOTS.md → "One trick, unbreakable rules, failure lines, acting". A shot that uses none of
        those fields gets only info lines (they never change the exit code, so old specs check as before): the Seedance
        task nudge and the vague words"""
        S, e, w, where = self.S, self.S.errs, self.S.warns, self.where
        seed, hand = self.model == 'seedance', bool(self.motion.get('prompt'))
        if seed and self.people and not self.task and not hand:
            S.infos.append('%s: people, but no task: a small task they keep doing all through the shot ("task", e.g. she '
                           'keeps stirring her coffee) makes them feel alive' % where)
        hits = []
        for path, txt in self.own_text():
            for m in VAGUE.finditer(txt):
                hits.append('"%s" (%s)' % (m.group(1).lower(), path))
        if hits:
            (w if self.uses2 else S.infos).append(
                '%s: vague words a model can\'t measure: %s; give a number or a comparison with the body instead (e.g. '
                '5 %% of the frame width, as wide as two fingers, knee-high)' % (where, ', '.join(hits[:6])
                                                                                 + (' and %d more' % (len(hits) - 6) if len(hits) > 6 else '')))
        if not self.uses2:
            return
        t = self.trick
        if t:
            n = len([x for x in re.split(r'(?<=[.!?])\s+(?=\S)', t['rule'].strip()) if x])
            if n > 1:
                w.append('%s.trick.rule: %d sentences; the trick is one sentence (its consequences go in trick.so)' % (where, n))
            if t.get('so') and not 3 <= len(t['so']) <= 4:
                w.append('%s.trick.so: %d consequence%s; derive 3–4 from the rule' % (where, len(t['so']), '' if len(t['so']) == 1 else 's'))
        if len(self.must) > 2:
            w.append('%s.must: %d rules; keep the 1–2 that may never break, or none of them is the most important' % (where, len(self.must)))
        if self.task and not self.people:
            w.append('%s.task: a task needs a person in the shot (people)' % where)
        for thing, v in self.sizes:
            if not self.people and ('body' in v or 'hand' in v):     # nobody in the shot: a body measure invites one in
                w.append('%s.sizes.%s: no people in this shot, so "%s" may draw a %s into it; measure it against the frame '
                         'and something in it (e.g. "half the cup\'s width")' % (where, thing, 'body' if 'body' in v else 'hand',
                                                                             'body' if 'body' in v else 'hand'))
            elif self.people and len(v) < 3:
                w.append('%s.sizes.%s: %d of the 3 measures (frame, body, hand); the three cross-check each other' % (where, thing, len(v)))
        if self.negatives:
            if not self.trick:
                w.append('%s.negatives: negatives are the trick turned inside out, and this shot has no trick' % where)
            if not self.neg_ok and 'negatives' not in (self.proposed or []):
                w.append('%s.negatives: Claude\'s inversions of the trick: list "negatives" in proposed, so Alex sees them; '
                         'they stay out of every prompt until `shots.py confirm %s`' % (where, self.id))
        for r in self.dont:
            if r in self.products and not ((S.d.get('products') or {}).get(r) or {}).get('ref'):
                w.append('%s.refs: product %s has no photo (ref), so there is no image to leave things out of' % (where, r))
        keyrefs = [r for r in self.dont if r != FIRST]
        if keyrefs and self.key is None:
            w.append('%s.refs: the don\'t-take lines for %s go into the key frame, and this shot has no key' % (where, ', '.join(keyrefs)))
        if self.key is not None and self.key.get('prompt') and (keyrefs or self.sizes):
            what = [x for x in ('the sizes' if self.sizes else '', 'the don\'t-take lines' if keyrefs else '') if x]
            w.append('%s.key.prompt: written by hand, so %s are not added to it: write them into key.prompt' % (where, ' and '.join(what)))
        if FIRST in self.dont and not seed:
            w.append('%s.refs: "first" (the input image) is for a Seedance prompt; this shot is on %s' % (where, self.M['name']))
        a = self.acting or {}
        if self.acting is not None and not any((a.get(k) or '').strip() for k in ('direction', 'motive', 'goal', 'obstacle', 'tactic')) \
                and not a.get('eyes'):
            w.append('%s.acting: none of direction, motive, goal, obstacle, tactic or eyes, so it adds only the gaze line' % where)
        for x in a.get('eyes') or []:
            if self.sec is not None and x['t'][1] > self.sec + 0.05:
                e.append('%s.acting.eyes: an eye beat ends at %g s, after the shot\'s %g s' % (where, x['t'][1], self.sec))
        for x in a.get('lens') or []:
            if self.sec is not None and x[1] > self.sec + 0.05:
                e.append('%s.acting.lens: a look into the lens ends at %g s, after the shot\'s %g s' % (where, x[1], self.sec))
        video = [k for k, on in (('trick', self.trick), ('must', self.must), ('fail', self.fail), ('task', self.task),
                                 ('acting', self.acting is not None), ('negatives', self.neg_ok),
                                 ('refs first', FIRST in self.dont), ('sizes', seed and self.sizes)) if on]
        if hand and video:
            w.append('%s.motion.prompt: written by hand, so %s never reach%s the video prompt: write what matters into it'
                     % (where, listing(video), 'es' if len(video) == 1 else ''))
        elif not seed and not hand:
            lost = [k for k in ('must', 'task', 'acting', 'negatives') if k in video]
            if lost:
                w.append('%s: on H3 the short prompt carries only the trick and the fail lines that fit; %s reach%s a '
                         'Seedance prompt only' % (where, listing(lost), 'es' if len(lost) == 1 else ''))
            left = self.h3_fails()[1]
            if left:
                w.append('%s.fail: %d fail line%s left out of the H3 prompt to keep it within %d words: %s' % (
                    where, len(left), '' if len(left) == 1 else 's', H3_WORDS, ' / '.join(left)))
            n = words(expand(self.h3_prompt(), S.text, partial=True))
            if self.trick and n > H3_WORDS:
                w.append('%s: the H3 prompt is %d words, over its %d-word budget; shorten the trick or the beats' % (where, n, H3_WORDS))
            if self.sizes and self.key is None:
                w.append('%s.sizes: on H3 the sizes go into the key frame, and this shot has no key' % where)


# ---------------------------------------------------------------- the whole spec
def holes(v, where, errs):
    """a starter <FILL: …> hint still anywhere in the spec (Alex's own words may hold any <…>: a casting-style <…>
    is caught in the compiled prompts instead)"""
    if isinstance(v, str):
        m = HINT.search(v)
        if m:
            errs.append('%s: replace the hint %s first' % (where, m.group(0)[:60]))
    elif isinstance(v, dict):
        for k, x in v.items():
            if k != '_note':
                holes(x, '%s.%s' % (where, k), errs)
    elif isinstance(v, list):
        for i, x in enumerate(v):
            holes(x, '%s[%d]' % (where, i), errs)


def load(path):
    S = Spec(path)
    e, w = S.errs, S.warns
    keys(S.d, TOP, 'spec', e)
    S.d = d = typed(S.d, 'top', 'spec', e)
    holes({k: v for k, v in d.items() if k != '_note'}, 'spec', e)
    if d.get('model') is not None and d.get('model') not in MODELS:
        e.append('model: h3 or seedance (got %s)' % short(d.get('model')))
    if d.get('res') is not None and d['res'] not in ('480p', '720p'):
        e.append('res: Seedance\'s draft resolution, 480p (the default) or 720p (got %s)' % short(d['res']))
    if d.get('aspect') is not None and ratio(d['aspect']) is None:
        e.append('aspect: W:H with both above 0, e.g. 16:9 (got %s)' % short(d['aspect']))
        d.pop('aspect')
    for grp, allowed, kind in (('people', PERSON, 'person'), ('products', PRODUCT, 'product'), ('places', PLACE, 'place')):
        g = d.setdefault(grp, {})
        for k, v in list(g.items()):
            if not SAFE_ID.match(str(k)):
                e.append('%s.%s: an id is letters, digits, ., - or _' % (grp, k))
            g[k] = typed(v, kind, '%s.%s' % (grp, k), e) if keys(v, allowed, '%s.%s' % (grp, k), e) else {}
    for k, v in (d.get('text') or {}).items():
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*', str(k)) or not isinstance(v, str):
            e.append('text.%s: snippet names are UPPER_CASE, values text' % k)
    S.cast = S.load_casting()
    if S.cast and S.cast['missing']:
        w.append('casting: %s does not exist yet, so sheets and locations are not checked' % os.path.relpath(S.cast['path'], S.root))
    cs = (S.cast or {}).get('raw') or {}
    S.ban = [str(x) for x in (d.get('ban') or [])] + [str(x) for x in (cs.get('ban') if isinstance(cs.get('ban'), list) else [])
                                                      if str(x) not in (d.get('ban') or [])]
    ctext = cs.get('text') if isinstance(cs.get('text'), dict) else {}
    for k, v in S.own.items():
        if k in ctext and str(ctext[k]) != v:
            w.append('text.%s: casting.json defines it too, differently: a key frame that names {%s} itself gets this '
                     'spec\'s; a casting.json snippet that names it gets casting.json\'s' % (k, k))
    shots = d.get('shots')
    if not shots or not [k for k in shots if not str(k).startswith('_')]:
        e.append('shots: an object of shots by id')
        shots = {}
    out = []
    for sid, raw in shots.items():
        if str(sid).startswith('_'):
            continue
        if not SAFE_ID.match(str(sid)):
            e.append('shots.%s: an id is letters, digits, ., - or _ (it names files)' % sid)
        elif not isinstance(raw, dict):
            e.append('shots.%s: must be an object' % sid)
        else:
            out.append(Shot(S, str(sid), raw))
    low = {}
    for s in out:                                    # APFS doesn't tell S01 from s01: one set of files
        o = low.setdefault(s.id.lower(), s.id)
        if o != s.id:
            e.append('shots.%s: differs from %s only by case; on macOS both would be one file' % (s.id, o))
    missing = [s.id for s in out if s.model is None]
    if missing:
        e.append('model: no model for %s: ask Alex which one (h3 or seedance) before writing prompts, then set "model"'
                 % ', '.join(missing))
    kids = {}
    for s in out:
        if s.key is not None:
            kids.setdefault(s.key.get('id') or s.id, []).append(s.id)
    for kid, who in kids.items():
        if len(who) > 1:
            e.append('key id "%s" is used by %s: each key frame needs its own (key.id)' % (kid, ', '.join(who)))
    lowk = {}
    for kid in kids:
        lowk.setdefault(kid.lower(), []).append(kid)
    for ks in lowk.values():
        if len(ks) > 1:
            e.append('key ids %s differ only by case; on macOS they would be one file (key.id)'
                     % ', '.join('"%s" (%s)' % (x, ', '.join(kids[x])) for x in ks))
    for s in out:
        s.lint()
    byid = {s.id: s for s in out}
    for s in out:                                    # a linked element crosses from one shot into the next
        lk = s.raw.get('links') or {}
        if lk.get('from') is not None and lk['from'] not in byid:
            e.append('%s.links.from: "%s" is no shot in the spec' % (s.where, lk['from']))
        elif lk.get('from') and lk.get('via'):
            miss = [x.id for x in (byid[lk['from']], s) if lk['via'].lower() not in expand(x.video_prompt(), S.text).lower()]
            if miss:
                w.append('%s.links: "%s" crosses from %s, but %s never mention%s it' % (s.where, lk['via'], lk['from'],
                         ' and '.join('%s\'s prompt' % x for x in miss), 's' if len(miss) == 1 else ''))
    run, prev = 0, None
    for s in out:
        run = run + 1 if (s.temp and s.temp != 'neutral' and s.temp == prev) else (1 if s.temp else 0)
        prev = s.temp
        if run == 3:
            w.append('shots.%s: three %s shots in a row; alternate warm and cold between neighbours' % (s.id, s.temp))
    return S, out


def report(S, label):
    for x in S.errs:
        print('✗ ' + x, file=sys.stderr)
    for x in S.warns:
        print('! ' + x)
    for x in S.infos:
        print('i ' + x)
    if S.errs:
        raise Refuse('%s: %d problem%s, nothing written' % (label, len(S.errs), '' if len(S.errs) == 1 else 's'))


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.islink(path):
        raise Refuse('%s is a symlink; not written' % path)
    tmp = '%s.tmp-%d' % (path, os.getpid())
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def pick(out, ids):
    if not ids:
        return out
    known = {s.id: s for s in out}
    bad = [i for i in ids if i not in known]
    if bad:
        raise Refuse('not in the spec: %s (shots: %s)' % (', '.join(bad), ', '.join(known)))
    return [known[i] for i in ids]


# ---------------------------------------------------------------- commands
def cmd_init(a):
    if os.path.lexists(a.spec):
        raise Refuse('%s already exists; edit it, or pass another --spec' % a.spec)
    with open(STARTER, encoding='utf-8') as f:
        st = json.load(f)
    if a.model:
        st['model'] = a.model
    if a.shots:
        ids = [s.strip() for s in a.shots.split(',') if s.strip()]
        if not ids or any(not SAFE_ID.match(i) for i in ids):
            raise Refuse('--shots: comma-separated ids, letters, digits, ., - or _ (got %s)' % a.shots)
        tpl = next(v for k, v in st['shots'].items() if not k.startswith('_'))
        st['shots'] = {i: json.loads(json.dumps(tpl)) for i in ids}
    if a.model == 'seedance':                    # Seedance-shaped: timed beats tiling the shot, the scene, the sounds
        for sh in st['shots'].values():
            beats = (sh.get('motion') or {}).get('beats') or []
            step = sh.get('sec', 6) / float(max(1, len(beats)))
            sh['motion']['beats'] = [{'t': [round(i * step, 2), round((i + 1) * step, 2)], 'do': b} for i, b in enumerate(beats)]
            sh.setdefault('scene', '<FILL: the whole shot in a sentence or two>')
            sh.setdefault('audio', ['<FILL: each sound the clip may have, e.g. her footsteps on concrete>'])
    os.makedirs(os.path.dirname(os.path.abspath(a.spec)), exist_ok=True)
    with open(a.spec, 'x', encoding='utf-8') as f:
        f.write(json.dumps(st, indent=1, ensure_ascii=False) + '\n')
    print('→ %s (%d shots). Ask Alex which model (h3 or seedance), fill every <placeholder>, then `shots.py check`.'
          % (a.spec, len([k for k in st['shots'] if not k.startswith('_')])))
    return 0


def cmd_check(a):
    S, out = load(a.spec)
    report(S, a.spec)
    print('✓ %s: %d shot%s, %s' % (a.spec, len(out), '' if len(out) == 1 else 's',
                                  ', '.join(sorted(set(MODELS[s.model]['name'] for s in out)))))
    return 1 if S.warns else 0


def confirmed_only(todo, what):
    """no prompt goes towards a paid call while anything in it is only proposed"""
    pend = ['%s (%s)' % (s.id, ', '.join(s.proposed)) for s in todo if s.proposed]
    if pend:
        raise Refuse('%s: still only proposed, not yet OK\'d by Alex: %s. Show them (`shots.py show ID`), then '
                     '`shots.py confirm ID`; nothing written' % (what, '; '.join(pend)))


def plan_row(S, s):
    """what build writes for a shot: its plan.json row, its video prompt and its key prompt (or None)"""
    vp = expand(s.video_prompt(), S.text)
    row = {'shot': s.id, 'model': s.model, 'sec': s.sec, 'video_prompt': 'shots/%s.%s.txt' % (s.id, s.model), 'words': words(vp)}
    kp = s.key_final() if s.key is not None else None
    if kp is not None:
        row['key_prompt'] = 'shots/%s.key.txt' % s.id
    mp4 = 'footage/fal/%s.mp4' % s.id
    if s.model == 'h3':
        row['gen'] = ('node $V/footage/gen.mjs video --image <the picked key frame> --prompt @%s --out %s --sec %d'
                      % (row['video_prompt'], mp4, int(s.sec or 5)))
    else:                                        # whole seconds only (the lint refuses any other), never rounded
        line = lambda res, out: ('node $V/footage/gen.mjs video --endpoint %s --image <the picked key frame> --prompt @%s '
                                 '--out %s --sec %d --res %s' % (MODELS['seedance']['i2v'], row['video_prompt'], out,
                                                                 int(s.sec or 5), res))
        draft = S.d.get('res') or MODELS['seedance']['res']
        row['gen'] = line(draft, mp4)
        if draft != MODELS['seedance']['final']:   # the chosen take, again at 720p (a re-render can differ: check it)
            row['final'] = line(MODELS['seedance']['final'], 'footage/fal/%s-720p.mp4' % s.id)
    return row, vp, kp


def cmd_build(a):
    S, out = load(a.spec)
    todo = pick(out, a.ids)
    report(S, a.spec)
    confirmed_only(todo, 'build')
    od, rows = os.path.join(S.root, 'shots'), {}
    try:                                         # plan.json keeps every shot built so far, in the spec's order
        with open(os.path.join(od, 'plan.json'), encoding='utf-8') as f:
            rows = {r['shot']: r for r in json.load(f).get('shots', []) if isinstance(r, dict) and r.get('shot')}
    except (OSError, ValueError, AttributeError, TypeError):
        rows = {}
    for s in todo:
        row, vp, kp = plan_row(S, s)
        write_text(os.path.join(S.root, row['video_prompt']), vp + '\n')
        if kp is not None:
            write_text(os.path.join(S.root, row['key_prompt']), kp + '\n')
        rows[s.id] = row
        print('→ %s  %s  %d words%s' % (s.id, row['video_prompt'], row['words'],
                                         ('  + ' + row['key_prompt']) if 'key_prompt' in row else ''))
    built, stale = {s.id for s in todo}, []
    rd = lambda p: open(p, encoding='utf-8').read() if os.path.isfile(p) else None
    for s in out:                                # a row built before is kept only while its shot compiles the same
        if s.id in rows and s.id not in built:
            row, vp, kp = plan_row(S, s)
            if (rows[s.id] != row or rd(os.path.join(S.root, row['video_prompt'])) != vp + '\n'
                    or (kp is not None and rd(os.path.join(S.root, row['key_prompt'])) != kp + '\n')):
                stale.append(s.id)
                del rows[s.id]
    if stale:
        print('! dropped from plan.json, changed since they were built: %s (build them again: shots.py build %s)'
              % (', '.join(stale), ' '.join(stale)))
    plan = [rows[s.id] for s in out if s.id in rows]
    write_text(os.path.join(od, 'plan.json'), json.dumps({'model': S.d.get('model'), 'shots': plan}, indent=1,
                                                         ensure_ascii=False) + '\n')
    print('→ shots/plan.json: dry-run gen.mjs lines; quote them and get Alex\'s yes before any --go')
    return 1 if S.warns else 0


def cmd_show(a):
    S, out = load(a.spec)
    s = pick(out, [a.id])[0]
    print('== %s · %s · %s s · recipe %s' % (s.id, MODELS[s.model]['name'] if s.model in MODELS else 'NO MODEL',
                                             '%g' % s.sec if s.sec else '?', s.raw.get('recipe') or '—'))
    if s.raw.get('brief'):
        print('\nAlex\'s brief (verbatim): %s' % s.raw['brief'])
    if s.raw.get('script'):
        print('Script (verbatim): %s' % s.raw['script'])
    print('\nProposed by Claude, not yet OK\'d: %s' % (', '.join(s.proposed) if s.proposed else 'nothing'))
    if s.negatives and not s.neg_ok:             # Claude's inversions of the trick: shown here, in no prompt until confirmed
        print('Negatives proposed by Claude (in no prompt until `shots.py confirm %s`): %s' % (s.id, '; '.join(s.negatives)))
    f, _, side = s.position_ref()
    if f:
        print('Position reference: %s%s' % (f, ' (plate %s)' % s.position['plate'] if (s.position or {}).get('plate') else ''))
        if side and side.get('says'):
            print('  it shows: %s' % side['says'])
    if s.key is not None:
        print('\n-- key frame prompt --\n' + s.key_final())
    print('\n-- %s prompt --\n%s' % (s.model, expand(s.video_prompt(), S.text)))
    own = re.compile(r'shots\.%s[.: ]|\b%s\b|^people\.(?:%s)[.:]' % (re.escape(s.id), re.escape(s.id),
                     '|'.join(re.escape(p) for p in s.people) or '(?!)'))
    mine = [x for x in S.errs + S.warns if own.search(x)]
    for x in S.errs:
        if x in mine:
            print('✗ ' + x)
    for x in S.warns:
        if x in mine:
            print('! ' + x)
    for x in S.infos:
        if own.search(x):
            print('i ' + x)
    rest = [x for x in S.errs if x not in mine]
    if rest:
        print('✗ and %d more problem%s in the spec (`shots.py check` lists them)' % (len(rest), '' if len(rest) == 1 else 's'))
    return 2 if S.errs else (1 if any(x in mine for x in S.warns) else 0)


def cmd_confirm(a):
    try:                                         # duplicates refused: a rewrite would keep only the last one
        with open(a.spec, encoding='utf-8') as f:
            d = json.load(f, object_pairs_hook=no_dupes)
    except (OSError, ValueError) as e:
        raise Refuse('%s: %s; nothing written' % (a.spec, e))
    if not isinstance(d, dict):
        raise Refuse('%s: the spec must be a JSON object' % a.spec)
    shots = d.get('shots') or {}
    bad = [i for i in a.ids if i not in shots or not isinstance(shots[i], dict)]
    if bad:
        raise Refuse('not in the spec: %s' % ', '.join(bad))
    for i in a.ids:
        sh = shots[i]
        sh['confirmed'] = sorted(set(list(sh.get('confirmed') or []) + list(sh.get('proposed') or [])))
        sh['proposed'] = []
        print('✓ %s: confirmed %s' % (i, ', '.join(sh['confirmed']) or 'nothing (nothing was proposed)'))
    write_text(os.path.abspath(a.spec), json.dumps(d, indent=1, ensure_ascii=False) + '\n')
    return 0


OWNED = ('batch', 'dir', 'refs', 'prompt', 'face', 'meta')        # the still's fields shots.py writes; others are kept


def still_sha(e):
    """every field shots.py wrote into a still (meta without this mark), so a later edit in casting.json shows"""
    meta = {k: v for k, v in (e.get('meta') if isinstance(e.get('meta'), dict) else {}).items() if k != 'sha'}
    return hashlib.sha1(json.dumps([e.get(k) for k in OWNED[:-1]] + [meta], sort_keys=True,
                                   ensure_ascii=False).encode('utf-8')).hexdigest()[:12]


def cmd_emit(a):
    S, out = load(a.spec)
    todo = [s for s in pick(out, a.ids) if s.key is not None]
    report(S, a.spec)
    confirmed_only(todo, 'emit-casting')
    cast = S.cast
    if cast is None or cast['missing']:
        raise Refuse('no casting spec to write into: set "casting" to an existing casting.json')
    if not todo:
        raise Refuse('no shot has a key frame ("key") to write')
    cs = cast['raw']
    stills = cs.setdefault('stills', {})
    if not isinstance(stills, dict):
        raise Refuse('casting.json "stills" is not an object')
    mine = lambda v: isinstance(v, dict) and isinstance(v.get('meta'), dict) and v['meta'].get('from') == 'shots'
    kids = [(s.key or {}).get('id') or s.id for s in todo]
    blocked = [k for k in kids if k in stills and not mine(stills[k])]
    if blocked:
        raise Refuse('casting.json already has stills not written by shots.py: %s (give the key another key.id, or '
                     'remove theirs first)' % ', '.join(blocked))
    clash = ['%s and stills.%s' % (k, o) for k in kids for o in stills if o != k and o.lower() == k.lower()]
    if clash:
        raise Refuse('ids that differ only by case are one file on macOS: %s (give the key another key.id)' % ', '.join(clash))
    cdir = os.path.dirname(cast['path'])
    sdir = os.path.normpath(os.path.join(cdir, str((cs.get('dirs') if isinstance(cs.get('dirs'), dict) else {}).get('stills', '../stills'))))
    made, edited, remade = {}, [], []
    for s in todo:
        k = s.key
        kid = k.get('id') or s.id
        to_cast = lambda r: r if ':' in r or os.path.isabs(r) else os.path.relpath(os.path.join(S.root, r), cdir)
        refs = [to_cast(r) for r in k['refs']] if isinstance(k.get('refs'), list) else [to_cast(r) for r, _, _ in s.refs()]
        meta = dict(k.get('meta') or {})
        meta['from'] = 'shots'
        e = {'batch': k.get('batch') or ('identity' if s.people else 'rest'), 'dir': k.get('dir') or 'keys',
             'refs': refs, 'prompt': s.key_prompt(), 'meta': meta}
        face = k.get('face') or ((((S.d.get('people') or {}).get(s.people[0]) or {}).get('sheet')) if s.people else None)
        if face:
            e['face'] = face
        meta['sha'] = still_sha(e)
        old = stills.get(kid)
        if mine(old):
            for k2, v2 in old.items():               # fields shots.py doesn't write (n, …) stay as set in casting.json
                if k2 not in OWNED:
                    e[k2] = v2
            was, now = old['meta'].get('sha'), still_sha(old)
            if was and now != was and now != meta['sha'] and not a.force:
                edited.append(kid)               # edited in casting.json since, and this would lose that edit
            elif now != meta['sha'] and glob.glob(os.path.join(sdir, str(old.get('dir') or 'keys'), glob.escape(kid) + '-v*.png')):
                remade.append(kid)
        made[kid] = e
    if edited:
        raise Refuse('casting.json\'s %s %s edited there since shots.py wrote %s; replacing %s would lose that edit. Move the '
                     'edit into tools/shots.json (key.prompt), or pass --force; nothing written'
                     % (', '.join('stills.' + x for x in edited), 'was' if len(edited) == 1 else 'were',
                        'it' if len(edited) == 1 else 'them', 'it' if len(edited) == 1 else 'them'))
    for kid, e in made.items():
        stills[kid] = e
        print('→ stills.%s  batch %s  refs %s' % (kid, e['batch'], ', '.join(e['refs']) or '—'))
    if remade:
        print('! changed, and already made: %s. casting.py skips a still that has variants: make the new one with '
              '`casting.py stills --only %s --go --redo` (quoted first)' % (', '.join(remade), ','.join(remade)))
    write_text(cast['path'], json.dumps(cs, indent=1, ensure_ascii=False) + '\n')
    print('→ %s: %d still%s written; quote them with `casting.py plan` before any --go'
          % (os.path.relpath(cast['path'], S.root), len(todo), '' if len(todo) == 1 else 's'))
    return 1 if S.warns or remade else 0


def cmd_fov(a):
    print('%g mm full-frame lens: about %d degrees horizontal field of view' % (a.mm, fov(a.mm)))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='shots.py', description=__doc__.split('\n\n')[0], allow_abbrev=False)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = {}
    for name in ('init', 'check', 'build', 'show', 'confirm', 'emit-casting', 'fov'):
        p[name] = sub.add_parser(name, allow_abbrev=False)
        if name != 'fov':
            p[name].add_argument('--spec', default=os.path.join('tools', 'shots.json'))
    p['init'].add_argument('--model', choices=sorted(MODELS))
    p['init'].add_argument('--shots')
    p['build'].add_argument('ids', nargs='*')
    p['show'].add_argument('id')
    p['confirm'].add_argument('ids', nargs='+')
    p['emit-casting'].add_argument('ids', nargs='*')
    p['emit-casting'].add_argument('--force', action='store_true', help='replace stills edited in casting.json since')
    p['fov'].add_argument('mm', type=float)
    a = ap.parse_args(argv)
    if a.cmd == 'fov' and not (4 <= a.mm <= 1200):
        print('✗ fov: a focal length from 4 to 1200 mm', file=sys.stderr)
        return 2
    try:
        return {'init': cmd_init, 'check': cmd_check, 'build': cmd_build, 'show': cmd_show, 'confirm': cmd_confirm,
                'emit-casting': cmd_emit, 'fov': cmd_fov}[a.cmd](a)
    except Refuse as e:
        print('✗ ' + str(e), file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print('\ninterrupted', file=sys.stderr)
        return 130
    except Exception as e:                      # noqa: BLE001
        import traceback
        traceback.print_exc()
        print('✗ unexpected error: %s' % e, file=sys.stderr)
        return 5


if __name__ == '__main__':
    sys.exit(main())
