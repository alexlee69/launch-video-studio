# -*- coding: utf-8 -*-
# Acceptance runner for the hf02-full → product-launch-sting port (DESIGN.md "Monitor").
#   python3 -E lib/run.py STAGE_SKILL_DIR [--no-real] [--no-slow] [--only static,gen,footage,recreate,film] [--run-dir DIR]
#   python3 -E lib/run.py STAGE_SKILL_DIR --part gen-slow --run-dir DIR      (internal: the slow download scenarios)
# Prints PASS / FAIL / SKIP per check and a final count; exit 0 = no FAIL, 1 = at least one FAIL, 2 = can't run.
import os, sys, time, json, subprocess, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d


def tools_of(stage):
    F, R = os.path.join(stage, 'video', 'footage'), os.path.join(stage, 'video', 'recreate')
    return {'gen': os.path.join(F, 'gen.mjs'), 'look': os.path.join(F, 'look.py'), 'conform': os.path.join(F, 'conform.py'), 'pin': os.path.join(F, 'pin.py'),
            'compare': os.path.join(R, 'compare.py'), 'track': os.path.join(R, 'track.py'), 'music': os.path.join(R, 'music.py'), 'temptrack': os.path.join(R, 'temptrack.py')}


def preflight():
    need = [os.path.join(H.FIX, g, 'truth.json') for g in ('phone24', 'cadence', 'cuts30', 'clicks', 'films', 'track', 'look', 'fal')]
    need += [os.path.join(H.FIX, 'cuts30', 'breakdown', 'breakdown.json'), os.path.join(H.ACC, 'baselines', 'look-oracle.json')]
    miss = [p for p in need if not os.path.exists(p)]
    if miss:
        print('fixtures/baselines missing (%s) — building them (one-off, ~2 min)…' % ', '.join(os.path.relpath(m, H.ACC) for m in miss[:3]), flush=True)
        subprocess.run([H.PY, '-E', os.path.join(H.ACC, 'lib', 'selftest.py'), '--build-only'], check=False)
    if not glob_any(os.path.join(H.ACC, 'baselines', 'live-audio', 'old-*.json')):
        subprocess.run([H.PY, '-E', os.path.join(H.LIB, 'make_baselines.py')], check=False)


def glob_any(p):
    import glob
    return bool(glob.glob(p))


def main():
    if not a or a[0].startswith('--'):
        print(__doc__ if __doc__ else 'usage: run.py STAGE_SKILL_DIR [...]'); return 2
    stage = os.path.abspath(os.path.expanduser(a[0]))
    if not os.path.exists(os.path.join(stage, 'video', 'lv.mjs')):
        print('✗ %s is not a product-launch-sting copy (no video/lv.mjs)' % stage); return 2
    if os.path.realpath(stage) == os.path.realpath(H.LIVE) and '--allow-live' not in a:
        print('✗ that is the LIVE skill — point run.sh at the staging copy (qa/hf02full-skill-port/stage/product-launch-sting)'); return 2
    T = tools_of(stage)
    if opt('--part') == 'gen-slow':
        import suite_gen as G
        rd = opt('--run-dir'); R = H.Report(os.path.join(rd, 'report-gen-slow.txt'), quiet=True)
        if not os.path.exists(T['gen']): R.add('gen.download.exit5', False, 'tool missing: ' + T['gen']); return 0
        G.run_suite(T['gen'], os.path.join(rd, 'gen-slow'), R, checks=['gen.download.exit5', 'gen.download.verify'], deny_write=(stage,))
        return 0
    if not H.sandbox_ok():
        print('✗ sandbox-exec is not usable here: the harness never runs the workers\' tools without it (real-key and no-spend safety)'); return 2
    preflight()
    rd = opt('--run-dir') or os.path.join(H.ACC, 'runs', time.strftime('%Y%m%d-%H%M%S'))
    os.makedirs(rd, exist_ok=True)
    R = H.Report(os.path.join(rd, 'report.txt'))
    only = set((opt('--only') or 'static,gen,footage,recreate,film').split(','))
    real, slow = '--no-real' not in a, '--no-slow' not in a
    t0 = time.time()
    print('acceptance run → %s\nstage: %s\nreal-file checks: %s · slow download checks: %s\n' % (rd, stage, 'on' if real else 'off', 'on (background)' if slow and 'gen' in only else 'off'), flush=True)
    bg = None
    if slow and 'gen' in only:
        bg = subprocess.Popen([H.PY, '-E', os.path.abspath(__file__), stage, '--part', 'gen-slow', '--run-dir', rd], stdout=open(os.path.join(rd, 'gen-slow.out'), 'w'), stderr=subprocess.STDOUT)
    if 'static' in only:
        import suite_static as S
        print('── static ──', flush=True); S.run_suite(stage, os.path.join(rd, 'static'), R)
    if 'gen' in only:
        import suite_gen as G
        print('── gen.mjs (mock fal queue, fake keys, sandbox) ──', flush=True)
        if os.path.exists(T['gen']):
            G.run_suite(T['gen'], os.path.join(rd, 'gen'), R, checks=[c for c in G.CHECKS if c not in ('gen.download.exit5', 'gen.download.verify')] + ([] if slow else []), deny_write=(stage,), slow=False)
            if not slow: G.run_suite(T['gen'], os.path.join(rd, 'gen-short'), R, checks=['gen.download.verify'], deny_write=(stage,), slow=False)
        else:
            for c in G.CHECKS: R.add(c, False, 'tool missing: ' + T['gen'])
    if 'footage' in only:
        import suite_footage as SF
        print('── look / conform / pin ──', flush=True); SF.run_suite(T, os.path.join(rd, 'footage'), R, real=real, deny=(stage,))
    if 'recreate' in only:
        import suite_recreate as SR
        print('── compare / track / music / temptrack ──', flush=True); SR.run_suite(T, os.path.join(rd, 'recreate'), R, real=real, deny=(stage,))
    if 'film' in only:
        import suite_film as SM
        print('── music: film + old styles ──', flush=True); SM.run_suite(stage, os.path.join(rd, 'film'), R, deny=(stage,), parts=('spec', 'score', 'hit', 'starter', 'old') + (('qa',) if real else ()))
    if bg:
        print('── waiting for the slow download checks (CDN always failing: up to 30 curl calls × ~31 s) ──', flush=True)
        try: bg.wait(timeout=45 * 60)
        except subprocess.TimeoutExpired: bg.kill(); R.add('gen.download.exit5', False, 'still running after 45 min (no exit 5 in sight)')
        p = os.path.join(rd, 'report-gen-slow.txt')
        for line in (open(p, encoding='utf-8').read().splitlines() if os.path.exists(p) else []):
            m = re.match(r'^(PASS|FAIL|SKIP)\s+(\S+)\s+(.*)$', line)
            if m: R.add(m.group(2), m.group(1), m.group(3))
    c = R.counts()
    print('\n%d PASS, %d FAIL, %d SKIP in %.0f min — report %s' % (c.get('PASS', 0), c.get('FAIL', 0), c.get('SKIP', 0), (time.time() - t0) / 60, os.path.join(rd, 'report.txt')))
    with open(os.path.join(rd, 'report.txt'), 'a', encoding='utf-8') as f:
        f.write('\n%d PASS, %d FAIL, %d SKIP\n' % (c.get('PASS', 0), c.get('FAIL', 0), c.get('SKIP', 0)))
    return 1 if c.get('FAIL') else 0


if __name__ == '__main__':
    sys.exit(main())
