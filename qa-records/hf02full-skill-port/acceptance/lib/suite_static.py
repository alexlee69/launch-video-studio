# -*- coding: utf-8 -*-
# Static acceptance: the live skill untouched, the stage changed only where the spec allows, spec.mjs's three small
# edits, Python 3.9 / C-locale hygiene of the new tools, no npm deps for gen.mjs, and the docs exist and cover the basics.
# Mechanical only: it never reads the workers' code for meaning.
import os, sys, re, json, glob, subprocess, difflib, fnmatch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

MANIFEST = os.path.join(H.P, 'live-before.sha1')
LIVE_BEFORE = os.path.join(H.P, 'live-before')
ALLOWED_CHANGED = ['video/lib/audio.mjs', 'video/lib/spec.mjs', 'SKILL.md', 'video/GUIDE.md', 'video/templates/beats.yaml']   # beats.yaml: the lead's one-line style comment
ALLOWED_NEW = ['video/footage/*', 'video/recreate/*', 'video/templates/footage-prompts.md', 'video/FOOTAGE.md', 'video/RECREATE.md']
DOCS = {'video/FOOTAGE.md': [r'--go', r'1\.08', r'look\.py', r'conform\.py', r'pin\.py', r'image.to.video|i2v', r'stall|resume'],
        'video/RECREATE.md': [r'compare\.py', r'track\.py', r'music\.py', r'temptrack\.py', r'style:\s*film', r'cop(y|ied)', r'private'],
        'video/templates/footage-prompts.md': [r'completely black', r'(?i)no text|no captions', r'(?i)lens|mm\b']}


def manifest(path):
    m = {}
    for l in open(path, encoding='utf-8'):
        l = l.strip()
        if l: h, p = l.split('  ', 1); m[p[2:] if p.startswith('./') else p] = h
    return m


def tree(root):
    out = {}
    for d, dirs, fs in os.walk(root):
        dirs[:] = [x for x in dirs if x != 'node_modules' and x != '__pycache__']
        for f in fs:
            if f == '.DS_Store': continue
            p = os.path.join(d, f); out[os.path.relpath(p, root)] = p
    return out


def new_files(stage):
    m = manifest(MANIFEST)
    return sorted(p for p in tree(stage) if p not in m)


def py_files(stage):
    return [os.path.join(stage, p) for p in new_files(stage) if p.endswith('.py')]


def ck_live_untouched(live=H.LIVE):
    m = manifest(MANIFEST); t = tree(live); bad = []
    for p, h in m.items():
        if p not in t: bad.append('deleted ' + p)
        elif H.sha1_file(t[p]) != h: bad.append('changed ' + p)
    bad += ['added ' + p for p in t if p not in m]
    return not bad, ('the LIVE skill was modified: ' + ', '.join(bad[:8])) if bad else 'live skill = live-before snapshot (%d files)' % len(m)


def ck_ownership(stage):
    m = manifest(MANIFEST); t = tree(stage); bad, changed, added = [], [], []
    for p, h in m.items():
        if p not in t: bad.append('deleted ' + p)
        elif H.sha1_file(t[p]) != h:
            changed.append(p)
            if p not in ALLOWED_CHANGED: bad.append('changed ' + p + ' (not in the spec)')
            elif p == 'video/templates/beats.yaml':                 # the lead's edit: one line
                la = open(os.path.join(LIVE_BEFORE, p), encoding='utf-8').read().splitlines(); lb = open(t[p], encoding='utf-8').read().splitlines()
                n = sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, la, lb, autojunk=False).get_opcodes() if op != 'equal')
                if n > 1: bad.append('templates/beats.yaml: %d lines changed (approved: one line)' % n)
    for p in t:
        if p not in m:
            added.append(p)
            if not any(fnmatch.fnmatch(p, g) for g in ALLOWED_NEW): bad.append('added ' + p + ' (outside the new folders)')
    lv, st = sorted(os.listdir(os.path.join(H.LIVE, 'node_modules'))), sorted(os.listdir(os.path.join(stage, 'node_modules'))) if os.path.isdir(os.path.join(stage, 'node_modules')) else []
    if lv != st: bad.append('node_modules differs from live (%s)' % sorted(set(lv) ^ set(st)))
    lv2 = sorted(os.listdir(os.path.join(H.LIVE, 'video', 'node_modules'))); st2 = sorted(os.listdir(os.path.join(stage, 'video', 'node_modules'))) if os.path.isdir(os.path.join(stage, 'video', 'node_modules')) else []
    if lv2 != st2: bad.append('video/node_modules differs from live')
    return not bad, '; '.join(bad[:10]) or 'changed only %s; added %d file(s), all under footage/, recreate/ or the new docs' % (', '.join(changed) or 'nothing', len(added))


# the 5th approved edit (lead, after QA run 3): a spec-time warning when `hit:` can't work, right after the music.breaks line
HIT_WARN_LINE = ("{ const L = shots[shots.length - 1]; if (music.style === 'film' && music.hit != null && L && L.block !== 'endcard') "
                 "warns.push(`music.hit does nothing here: the film's last shot (${L.id}) is a ${L.block}, not an endcard — end on an endcard shot`); }"
                 "   // film hit: the end card must be the last shot")
norm = lambda x: re.sub(r'\s+', ' ', x).strip()


def ck_spec_edits(stage):
    """exactly the approved edits (lead, 2026-10-22): 3 one-line film edits (STYLES, STYLE_BPM, the default-key map),
    one self-contained insertion right after the `music` object that validates and carries music.hit, and the one-line
    hit warning right after the music.breaks unknown-id line (exact text) — any other change fails"""
    a = open(os.path.join(LIVE_BEFORE, 'video', 'lib', 'spec.mjs'), encoding='utf-8').read().splitlines()
    b = open(os.path.join(stage, 'video', 'lib', 'spec.mjs'), encoding='utf-8').read().splitlines()
    hunks = [op for op in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes() if op[0] != 'equal']
    end_music = next((i for i, l in enumerate(a) if 'const music = {' in l), None)
    end_music = next((i for i in range(end_music, len(a)) if a[i].rstrip().endswith('};')), None) if end_music is not None else None
    want_lines = {'STYLES': lambda l: 'export const STYLES' in l, 'STYLE_BPM': lambda l: 'const STYLE_BPM' in l,
                  'default key': lambda l: "{ playful: 'F', keynote: 'D', calm: 'G' }" in l}
    breaks_line = next((i for i, l in enumerate(a) if 'music.breaks: unknown shot id' in l), None)
    found, bad, ins, warn = set(), [], None, None
    for t, i1, i2, j1, j2 in hunks:
        if t == 'insert' and breaks_line is not None and i1 == breaks_line + 1 and j2 - j1 == 1 and norm(b[j1]) == norm(HIT_WARN_LINE) and warn is None:
            warn = j1; continue
        new_ = b[j1:j2]
        if t == 'replace' and i2 - i1 == 1 and j2 - j1 == 1 and 'film' in new_[0]:
            hit = [k for k, f in want_lines.items() if f(a[i1])]
            if hit: found.add(hit[0]); continue
        if t == 'insert' and end_music is not None and i1 == end_music + 1 and j2 - j1 <= 12 and any(re.search(r'\bhit\b', l) for l in new_) and ins is None:
            ins = (j1, j2); continue
        bad.append('%s live %d–%d → %d line(s)%s' % (t, i1 + 1, i2, j2 - j1, ' (mentions film)' if any('film' in l for l in new_) else ''))
    miss = [k for k in want_lines if k not in found]
    if miss: bad.append('missing the one-line film edit to: %s' % ', '.join(miss))
    if ins is None: bad.append('no self-contained music.hit block right after the music object')
    if warn is None: bad.append('no approved music.hit warning line right after the music.breaks line')
    return not bad, ('spec.mjs: ' + '; '.join(bad)) if bad else 'spec.mjs: exactly the 5 approved edits — STYLES, STYLE_BPM and the default key (1 line each, film), a %d-line music.hit block after the music object, the hit warning line after music.breaks' % (ins[1] - ins[0])


def ck_py_headers(stage):
    files = py_files(stage)
    if not files: return False, 'no new Python files'
    bad = [os.path.relpath(f, stage) for f in files if not re.search(r'coding[:=]\s*utf-?8', ''.join(open(f, encoding='utf-8', errors='replace').readlines()[:2]))]
    return not bad, ('no "# -*- coding: utf-8 -*-" in line 1–2: ' + ', '.join(bad)) if bad else '%d .py files start with the coding line' % len(files)


def ck_py39(stage, tmp):
    files = py_files(stage); bad = []
    for f in files:
        r = subprocess.run([H.PY, '-c', 'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8").read(), sys.argv[1])', f], capture_output=True, text=True)
        if r.returncode: bad.append('%s: %s' % (os.path.relpath(f, stage), r.stderr.strip().splitlines()[-1][:100])); continue
    env = H.base_env(home=H.REAL_HOME, tmp=tmp)
    env.update({'PYTHONUTF8': '0', 'PYTHONCOERCECLOCALE': '0'})
    for f in files:
        if '/lib/' in f or os.path.basename(f).startswith('_'): continue
        r = H.run([H.PY, '-X', 'utf8=0', f, '--help'], env=env, cwd=tmp, timeout=120)
        if 'Traceback' in r.err and ('SyntaxError' in r.err or 'TypeError' in r.err or 'Unicode' in r.err or 'NameError' in r.err):
            bad.append('%s --help under a strict C locale: %s' % (os.path.relpath(f, stage), r.err.strip().splitlines()[-1][:120]))
    return not bad, '; '.join(bad) or '%d files parse under /usr/bin/python3 3.9 and run --help under LC_ALL=C (PYTHONUTF8=0) without a traceback' % len(files)


def ck_sibling_imports(stage):
    bad = []
    for f in py_files(stage):
        d = os.path.dirname(f); sib = {os.path.splitext(x)[0] for x in os.listdir(d) if x.endswith('.py')} - {os.path.splitext(os.path.basename(f))[0]}
        src = open(f, encoding='utf-8', errors='replace').read()
        imps = [m.group(1) or m.group(2) for m in re.finditer(r'(?m)^\s*(?:from\s+(\w+)\s+import|import\s+(\w+))', src)]
        hit = [i for i in imps if i in sib]
        if hit:
            first = min(src.find('import ' + h) if src.find('import ' + h) >= 0 else src.find('from ' + h) for h in hit)
            ins = src.find('sys.path.insert')
            if ins < 0 or ins > first: bad.append('%s imports %s without sys.path.insert first' % (os.path.relpath(f, stage), hit))
    return not bad, '; '.join(bad) or 'every sibling import comes after sys.path.insert (works under python3 -I)'


def ck_gen_no_npm(stage):
    g = os.path.join(stage, 'video', 'footage', 'gen.mjs')
    if not os.path.exists(g): return False, 'no video/footage/gen.mjs'
    src = open(g, encoding='utf-8').read()
    mods = re.findall(r'''(?:import\s[^'"]*from\s*|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]''', src, re.M)
    bad = [m for m in mods if not (m.startswith('node:') or m.startswith('.') or m.startswith('/') or m in ('fs', 'path', 'os', 'child_process', 'crypto', 'url', 'util', 'https', 'http', 'zlib', 'stream', 'events', 'readline', 'process', 'fs/promises', 'timers/promises'))]
    return not bad, ('npm imports in gen.mjs: %s' % bad) if bad else 'gen.mjs imports only Node built-ins / local files (%s)' % (', '.join(sorted(set(mods))) or 'none')


def ck_exit_codes_documented(stage):
    tools = [p for p in new_files(stage) if re.match(r'video/(footage|recreate)/[^/]+\.(py|mjs)$', p)]
    bad = [p for p in tools if not re.search(r'exit', ''.join(open(os.path.join(stage, p), encoding='utf-8', errors='replace').readlines()[:40]), re.I)]
    return not bad, ('no exit codes in the header of: ' + ', '.join(bad)) if bad else '%d tools document their exit codes up top' % len(tools)


def ck_docs(stage):
    bad = []
    for rel, pats in DOCS.items():
        p = os.path.join(stage, rel)
        if not os.path.exists(p) or os.path.getsize(p) < 400: bad.append('%s missing or near-empty' % rel); continue
        t = open(p, encoding='utf-8', errors='replace').read()
        miss = [x for x in pats if not re.search(x, t, re.I if not x.startswith('(?i)') else 0)]
        if miss: bad.append('%s doesn\'t mention %s' % (rel, miss))
    g = open(os.path.join(stage, 'video', 'GUIDE.md'), encoding='utf-8').read()
    if 'FOOTAGE.md' not in g or 'RECREATE.md' not in g: bad.append('GUIDE.md has no pointer to FOOTAGE.md / RECREATE.md (lead\'s step)')
    if not all(re.search(x, g, re.I) for x in (r'numpy', r'pillow', r'\bcurl\b', r'python3')): bad.append('GUIDE.md has no requirements line (python3 + numpy + Pillow, curl)')
    lim = re.search(r'(?ims)^#+[^\n]*limit[^\n]*\n(.*?)(?=^#+ |\Z)', g) or re.search(r'(?ims)\blimits?\b[^\n]*\n?(.{0,1500})', g)
    if not lim or 'FOOTAGE.md' not in lim.group(0): bad.append('GUIDE.md\'s Limits paragraph doesn\'t point at FOOTAGE.md')
    bt = os.path.join(stage, 'video', 'templates', 'beats.yaml')
    if os.path.exists(bt) and not re.search(r'film\s*\(groove,\s*87\)', open(bt, encoding='utf-8').read()): bad.append('templates/beats.yaml\'s style comment doesn\'t list film (groove, 87)')
    sk = open(os.path.join(stage, 'SKILL.md'), encoding='utf-8').read()
    if not re.search(r'footage', sk, re.I) or not re.search(r'recreat', sk, re.I): bad.append('SKILL.md doesn\'t mention footage / recreate (lead\'s step)')
    if re.search(r'nothing is generated here', g, re.I): bad.append('GUIDE.md still says "nothing is generated here"')
    return not bad, '; '.join(bad) or 'FOOTAGE.md, RECREATE.md, footage-prompts.md cover the basics; GUIDE.md and SKILL.md point to them'


CHECKS = [('static.live-untouched', lambda s, t: ck_live_untouched()), ('static.ownership', lambda s, t: ck_ownership(s)), ('static.spec-edits', lambda s, t: ck_spec_edits(s)),
          ('static.py-headers', lambda s, t: ck_py_headers(s)), ('static.py39-c-locale', ck_py39), ('static.sibling-imports', lambda s, t: ck_sibling_imports(s)),
          ('static.gen-no-npm', lambda s, t: ck_gen_no_npm(s)), ('static.exit-codes-documented', lambda s, t: ck_exit_codes_documented(s)), ('static.docs', lambda s, t: ck_docs(s))]


def run_suite(stage, run_dir, report, tag=''):
    os.makedirs(os.path.join(run_dir, 'tmp'), exist_ok=True)
    for cid, fn in CHECKS:
        try: ok, det = fn(stage, os.path.join(run_dir, 'tmp'))
        except Exception as e: ok, det = False, 'check crashed: %s: %s' % (type(e).__name__, e)
        report.add(cid, ok, det, tag)
