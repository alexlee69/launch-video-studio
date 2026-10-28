# -*- coding: utf-8 -*-
# Regression baselines with the LIVE skill: every old job's soundtrack stems built twice (must be byte-identical run to
# run, or an md5 comparison means nothing), their md5s + the compiled timeline's sha1 → baselines/live-audio/<job>.json.
# Also records the live skill's file manifest (baselines/live-skill.sha1) so a stage run can prove the live copy is untouched.
#   python3 -E lib/make_baselines.py
import os, sys, json, glob, hashlib, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

OUT = os.path.join(H.ACC, 'baselines', 'live-audio')
SKIP = {'audio.json', 'brief.json', 'master.json'}                # audio.json carries a hash of audio.mjs itself


def build(skill, job, out):
    if os.path.exists(out): shutil.rmtree(out)
    r = subprocess.run([H.NODE, os.path.join(H.LIB, 'build_audio.mjs'), skill, job, out], capture_output=True, text=True, timeout=600)
    try: info = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: info = {'error': (r.stdout + r.stderr)[-300:]}
    return info


def digest(out):
    md5 = {os.path.basename(p): H.md5_file(p) for p in sorted(glob.glob(os.path.join(out, '*'))) if os.path.basename(p) not in SKIP and os.path.basename(p) != 'tl.json'}
    tl = hashlib.sha1(open(os.path.join(out, 'tl.json'), 'rb').read()).hexdigest() if os.path.exists(os.path.join(out, 'tl.json')) else None
    return md5, tl


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(H.ACC, 'runs', 'baseline-build')
    ok = True
    for job in sorted(glob.glob(os.path.join(H.ACC, 'jobs', 'old-*'))):
        name = os.path.basename(job)
        i1 = build(H.LIVE, job, os.path.join(tmp, name, 'a')); m1, t1 = digest(os.path.join(tmp, name, 'a'))
        i2 = build(H.LIVE, job, os.path.join(tmp, name, 'b')); m2, t2 = digest(os.path.join(tmp, name, 'b'))
        det = m1 == m2 and t1 == t2 and 'error' not in i1
        ok &= det
        rec = {'job': name, 'style': (i1.get('music') or {}).get('style'), 'bpm': i1.get('bpm'), 'dur': i1.get('dur'), 'md5': m1, 'timeline_sha1': t1,
               'deterministic': det, 'built_with': H.LIVE}
        json.dump(rec, open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8'), indent=1)
        print('%-4s %-22s %-8s music.wav %s  (%d stems, run-to-run identical: %s)' % ('PASS' if det else 'FAIL', name, rec['style'], m1.get('music.wav', '— (style none: no music stem)'), len(m1), det))
    man = []
    for d, _, fs in os.walk(H.LIVE):
        if 'node_modules' in d.split(os.sep): continue
        for f in fs:
            p = os.path.join(d, f); man.append('%s  ./%s' % (H.sha1_file(p), os.path.relpath(p, H.LIVE)))
    open(os.path.join(H.ACC, 'baselines', 'live-skill.sha1'), 'w', encoding='utf-8').write('\n'.join(sorted(man, key=lambda x: x.split('  ')[1])) + '\n')
    print('live skill manifest: %d files → baselines/live-skill.sha1' % len(man))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
