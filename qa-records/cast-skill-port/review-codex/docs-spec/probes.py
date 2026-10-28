import hashlib
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
ROOT = os.path.join(HERE, 'runs')


def fresh(name):
    p = os.path.join(ROOT, name)
    shutil.rmtree(p, ignore_errors=True)
    os.makedirs(os.path.join(p, 'tools'))
    return p


def put_spec(job, value):
    with open(os.path.join(job, 'tools', 'casting.json'), 'w', encoding='utf-8') as f:
        json.dump(value, f, indent=1)


def image(path, size=(640, 360), colour=(138, 138, 138)):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = Image.new('RGB', size, colour)
    d = ImageDraw.Draw(im)
    d.rectangle((80, 60, 180, 300), fill=(30, 70, 110))
    im.save(path)


def run(job, *args):
    env = dict(os.environ)
    p = subprocess.run([sys.executable, CAST] + list(args), cwd=job, env=env,
                       capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def short(s):
    return '\n'.join(s.strip().splitlines()[-8:])


os.makedirs(ROOT, exist_ok=True)

# 1. Invalid explicit pin structure is not flagged by plan/problems().
job = fresh('bad-pin-after-spend')
put_spec(job, {
    'cap': 50,
    'lock': {'hero': {'prompt': '{LOCK} {KEEP}', 'pin': {'cols': 123}}},
})
code, out = run(job, 'plan')
print('CASE bad-pin-after-spend')
print('exit=%d flagged=%s' % (code, '✗' in out))
print(short(out))

# 2. A restore ellipse much larger than the image is accepted by free rebuild and restores the whole original.
job = fresh('oversize-restore')
put_spec(job, {
    'cap': 50,
    'lock': {'hero': {'prompt': '{LOCK} {KEEP}',
                      'restore': {'ellipse': [10, 10, 9999, 9999], 'feather': 0},
                      'pin': False}},
})
cand = os.path.join(job, 'cast', 'candidates', 'cand-01.png')
image(cand)
raw = os.path.join(job, 'cast', 'locked', 'hero-edit.png')
image(raw, colour=(160, 160, 160))
code, out = run(job, 'lock', '--pick', 'cand-01', '--rebuild')
comp = os.path.join(job, 'cast', 'locked', 'hero-composite.png')
same_pixels = False
if os.path.exists(comp):
    same_pixels = list(Image.open(cand).getdata()) == list(Image.open(comp).getdata())
print('CASE oversize-restore')
print('exit=%d whole_original_restored=%s' % (code, same_pixels))
print(short(out))

# 3. Lock rebuild deletes the good final before discovering the saved edit is unreadable.
job = fresh('rebuild-deletes-final')
put_spec(job, {
    'cap': 50,
    'lock': {'hero': {'prompt': '{LOCK} {KEEP}', 'pin': {}}},
})
image(os.path.join(job, 'cast', 'candidates', 'cand-01.png'))
final = os.path.join(job, 'cast', 'locked', 'hero.png')
image(final, colour=(12, 34, 56))
edit = os.path.join(job, 'cast', 'locked', 'hero-edit.png')
with open(edit, 'wb') as f:
    f.write(b'not an image')
before = hashlib.sha256(open(final, 'rb').read()).hexdigest()
code, out = run(job, 'lock', '--pick', 'cand-01', '--rebuild')
print('CASE rebuild-deletes-final')
print('exit=%d final_exists=%s before_sha=%s' % (code, os.path.exists(final), before[:12]))
print(short(out))

# 4. Free paste protects OUT.png but not the JSON sidecar it writes.
job = fresh('sidecar-overwrite')
orig = os.path.join(job, 'orig.png')
edit = os.path.join(job, 'edit.png')
outpng = os.path.join(job, 'result.png')
sidecar = os.path.join(job, 'result.json')
precious = os.path.join(job, 'precious-user.json')
image(orig, (100, 100), (20, 20, 20))
image(edit, (100, 100), (220, 220, 220))
with open(precious, 'w', encoding='utf-8') as f:
    f.write('PRECIOUS USER JSON\n')
os.symlink(os.path.basename(precious), sidecar)
code, out = run(job, 'paste', orig, edit, outpng, '--box', '10,10,90,90', '--feather', '0')
with open(precious, encoding='utf-8') as f:
    now = f.read()
print('CASE sidecar-overwrite')
print('exit=%d output=%s sidecar_is_symlink=%s symlink_target_marker_survived=%s target_prefix=%r' % (
    code, os.path.exists(outpng), os.path.islink(sidecar), 'PRECIOUS' in now, now[:35]))
print(short(out))

# 5. Invalid restore geometry is an uncaught traceback / exit 1, not bad-argument exit 2.
job = fresh('free-restore-invalid')
base = os.path.join(job, 'base.png')
src = os.path.join(job, 'src.png')
image(base, (100, 100))
image(src, (100, 100), (150, 150, 150))
code, out = run(job, 'restore', base, src, os.path.join(job, 'out.png'),
                '--ellipse', '10,10,-5,5')
print('CASE free-restore-invalid')
print('exit=%d traceback=%s' % (code, 'Traceback (most recent call last)' in out))
print(short(out))

# 6. A corrupt filename matching ID-vN.png is treated as a completed request.
job = fresh('resume-corrupt-variant')
put_spec(job, {
    'cap': 50,
    'locations': {'place': {'prompt': 'An empty room. {PLATE_TAIL}', 'n': 2}},
})
bad_variant = os.path.join(job, 'stills', 'locations', 'place-v1.png')
os.makedirs(os.path.dirname(bad_variant), exist_ok=True)
with open(bad_variant, 'wb') as f:
    pass
code, out = run(job, 'locations')
print('CASE resume-corrupt-variant')
print('exit=%d variant_bytes=%d' % (code, os.path.getsize(bad_variant)))
print(short(out))

# 7. A non-integer restore-box feather crashes problems() instead of producing exit 2.
job = fresh('restore-feather-type')
put_spec(job, {
    'cap': 50,
    'lock': {'hero': {'prompt': '{LOCK} {KEEP}',
                      'restore': {'boxes': [[10, 10, 100, 100]], 'feather': '18'}}},
})
code, out = run(job, 'plan')
print('CASE restore-feather-type')
print('exit=%d traceback=%s' % (code, 'Traceback (most recent call last)' in out))
print(short(out))
