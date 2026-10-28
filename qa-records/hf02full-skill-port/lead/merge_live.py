# -*- coding: utf-8 -*-
# Merge the hf02-full port from staging into the live skill (PATCHES.md, "Applying now"), then prove live == staging.
#   python3 -E merge_live.py          checks only: nothing is written
#   python3 -E merge_live.py --go     merge, then verify (refuses unless every check passes first)
# Exit 0 = OK; 1 = a check failed (nothing written if it failed before the merge).
import sys, os, hashlib, shutil, subprocess

P = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port'
S = P + '/stage/product-launch-sting'
L = os.environ.get('MERGE_LIVE') or os.path.expanduser('~/.claude/skills/product-launch-sting')   # MERGE_LIVE: rehearse on a copy
GO = '--go' in sys.argv
NEW = ['video/footage/gen.mjs', 'video/footage/look.py', 'video/footage/conform.py', 'video/footage/pin.py',
       'video/footage/_media.py', 'video/footage/screen.mjs', 'video/FOOTAGE.md', 'video/templates/footage-prompts.md',
       'video/recreate/compare.py', 'video/recreate/track.py', 'video/recreate/music.py', 'video/recreate/temptrack.py',
       'video/recreate/media.py', 'video/RECREATE.md']
SCRIPTED = ['SKILL.md', 'video/GUIDE.md', 'video/templates/beats.yaml', 'video/lib/spec.mjs']   # apply_pointers.py
COPIED = ['video/lib/audio.mjs']

def sha1(p):
    h = hashlib.sha1()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()

def tree(root):                                    # relative path -> sha1, node_modules excluded (as live-before.sha1)
    out = {}
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d != 'node_modules']
        for f in fn:
            p = os.path.join(dp, f)
            if os.path.islink(p): raise SystemExit('symlink in %s: %s' % (root, p))
            out[os.path.relpath(p, root)] = sha1(p)
    return out

def fail(msg):
    print('FAIL: ' + msg); sys.exit(1)

before = {}
for line in open(P + '/live-before.sha1', encoding='utf-8'):
    h, rel = line.rstrip('\n').split('  ', 1)
    before[rel[2:] if rel.startswith('./') else rel] = h
print('live-before.sha1: %d files' % len(before))

# 1. live is still exactly the snapshot the port was built against (or already exactly staging: then verify only)
live, stage = tree(L), tree(S)
merged = False
if live == before:
    print('OK  live == live-before (%d files)' % len(live))
elif live == stage:
    merged = True; print('note: live already == staging (merged); verifying only')
else:
    extra, missing = sorted(set(live) - set(before)), sorted(set(before) - set(live))
    changed = sorted(k for k in set(live) & set(before) if live[k] != before[k])
    fail('live differs from live-before: extra %s, missing %s, changed %s' % (extra, missing, changed))

# 2. staging differs from live-before only by the reviewed files
added = sorted(set(stage) - set(before)); removed = sorted(set(before) - set(stage))
changed = sorted(k for k in set(stage) & set(before) if stage[k] != before[k])
if added != sorted(NEW) or removed or changed != sorted(SCRIPTED + COPIED):
    fail('staging is not exactly live-before + the port: added %s, removed %s, changed %s' % (added, removed, changed))
print('OK  staging = live-before + %d new files + %d edited files' % (len(added), len(changed)))
junk = [k for k in stage if '__pycache__' in k or k.endswith('.pyc') or '.tmp' in os.path.basename(k) or k.endswith('.lock')]
if junk: fail('litter in staging: %s' % junk)

# 3. the scripted edits rebuild staging's four files from live-before (dry run in a scratch copy)
T = P + '/lead/merge-sim'
shutil.rmtree(T, ignore_errors=True)
for rel in SCRIPTED:
    os.makedirs(os.path.dirname(os.path.join(T, rel)), exist_ok=True); shutil.copy2(os.path.join(P, 'live-before', rel), os.path.join(T, rel))
r = subprocess.run([sys.executable, '-E', P + '/lead/apply_pointers.py', T], capture_output=True, text=True)
if r.returncode != 0: fail('apply_pointers.py on a live-before copy: %s' % r.stdout[-500:])
bad = [rel for rel in SCRIPTED if sha1(os.path.join(T, rel)) != stage[rel]]
if bad: fail('apply_pointers.py does not rebuild staging for %s' % bad)
shutil.rmtree(T, ignore_errors=True)
print('OK  apply_pointers.py rebuilds SKILL.md, GUIDE.md, beats.yaml, spec.mjs byte for byte')

if not GO and not merged:
    print('checks only: nothing written. Run with --go to merge.'); sys.exit(0)

# 4. merge: new files, the scripted edits, audio.mjs (only if live's is still live-before's)
if not merged:
    for rel in NEW:
        d = os.path.join(L, rel)
        if os.path.exists(d): fail('%s already exists in live' % rel)
    for rel in NEW:
        os.makedirs(os.path.dirname(os.path.join(L, rel)), exist_ok=True)
        shutil.copy2(os.path.join(S, rel), os.path.join(L, rel))
    r = subprocess.run([sys.executable, '-E', P + '/lead/apply_pointers.py', L], capture_output=True, text=True)
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else '(no output)')
    if r.returncode != 0: fail('apply_pointers.py on live: %s' % r.stdout[-800:])
    for rel in COPIED:
        if sha1(os.path.join(L, rel)) != before[rel]: fail('%s in live changed since live-before; re-apply its diff by hand' % rel)
        shutil.copy2(os.path.join(S, rel), os.path.join(L, rel))
    print('merged: %d new files, %d scripted edits, %d copied' % (len(NEW), len(SCRIPTED), len(COPIED)))

# 5. verify: live == staging, file for file (node_modules aside); untouched files == live-before
live2 = tree(L)
if live2 != stage:
    diff = sorted(k for k in set(live2) | set(stage) if live2.get(k) != stage.get(k))
    fail('live != staging after the merge: %s' % diff)
untouched = [k for k in before if k not in SCRIPTED + COPIED]
if any(live2[k] != before[k] for k in untouched): fail('an untouched file changed')
r = subprocess.run([sys.executable, '-E', P + '/lead/apply_pointers.py', L, '--check'], capture_output=True, text=True)
if r.returncode != 0 or 'OK (check only)' not in r.stdout: fail('apply_pointers.py --check on live: %s' % r.stdout[-500:])
if any('__pycache__' in k for k in live2): fail('__pycache__ in live')
print('OK  live == staging (%d files); %d untouched files == live-before; patch check OK' % (len(live2), len(untouched)))
