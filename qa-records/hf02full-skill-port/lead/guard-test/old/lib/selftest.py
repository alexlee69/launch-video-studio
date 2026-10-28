# -*- coding: utf-8 -*-
# Self-test of the acceptance harness — needs no worker code:
#   1. the mock fal server and the sandbox; 2. the fixtures' known truths (barcodes, cut frames, bpm/phase, hstack slip);
#   3. the live baselines are still reproducible; 4. every check PASSes on a spec-following implementation (my oracles in
#   oracle/, or planted-good inputs) and FAILs on a planted-bad one.
#   python3 -E lib/selftest.py [--build-only] [--only mock,fixtures,baselines,gen,footage,recreate,film,static]
import os, sys, json, re, glob, shutil, subprocess, time, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H
import evals as E
import planted as PL

a = sys.argv[1:]
ONLY = set((a[a.index('--only') + 1] if '--only' in a else 'mock,fixtures,baselines,gen,footage,recreate,film,static').split(','))
RD = os.path.join(H.ACC, 'runs', 'selftest-' + time.strftime('%Y%m%d-%H%M%S'))
ORA = os.path.join(H.ACC, 'oracle')
PLD = os.path.join(H.ACC, 'planted')
PROOFS = []                                   # (check, side, held, detail)
OUT = None


def say(s):
    print(s, flush=True)
    if OUT:
        with open(OUT, 'a', encoding='utf-8') as f: f.write(s + '\n')


def prove(cid, side, ok_expected, observed, detail):
    if observed is not None: observed = bool(observed)            # numpy bools are not `True`
    held = (observed is True) if ok_expected else (observed is False)
    PROOFS.append((cid, side, held, detail))
    say('%-6s %-34s %-5s %s' % ('ok' if held else 'BROKEN', cid, side, (detail or '')[:230]))


class Cap(H.Report):
    """a Report that keeps rows quietly, for proofs"""
    def __init__(self): H.Report.__init__(self, None, quiet=True)
    def get(self, cid):
        r = [x for x in self.rows if x[0] == cid]
        return (r[-1][1], r[-1][2]) if r else (None, 'not reported')


def st(s): return {'PASS': True, 'FAIL': False}.get(s)


# ── 0. build fixtures + baselines (one-off) ──
def build():
    subprocess.run([H.PY, '-E', os.path.join(H.FIX, 'make_fixtures.py')], check=True)
    bd = os.path.join(H.FIX, 'cuts30', 'breakdown')
    subprocess.run([H.NODE, os.path.join(H.LIVE, 'video', 'lib', 'breakdown.mjs'), os.path.join(H.FIX, 'cuts30', 'ref.mp4'), '--out', bd], check=True, capture_output=True)
    d = os.path.join(H.ACC, 'runs', 'look-oracle'); os.makedirs(d, exist_ok=True)
    subprocess.run([H.PY, '-E', os.path.join(ORA, 'look.py'), os.path.join(H.FIX, 'look', 'still.png'), '--json', os.path.join(d, 'still.json')], check=True, capture_output=True)
    subprocess.run([H.PY, '-E', os.path.join(ORA, 'look.py'), os.path.join(H.FIX, 'look', 'ours_bright.png'), '--ref', os.path.join(H.FIX, 'look', 'ref.mp4'), '--json', os.path.join(d, 'ref.json')], check=True, capture_output=True)
    s, r = json.load(open(os.path.join(d, 'still.json'))), json.load(open(os.path.join(d, 'ref.json')))
    m = lambda x: {'p10': x['p10'], 'p50': x['p50'], 'p90': x['p90'], 'shadow': x['shadow_pct'], 'sat': x['saturation'], 'sharp': x['sharpness'], 'grain': x['grain'], 'warm_sh': x['warmth_shadows'], 'warm_hi': x['warmth_highlights']}
    json.dump({'note': "today's look_stats.py formulas (oracle/look.py) on the look fixtures; ref = 12 evenly spaced frames", 'still': m(s['measures']), 'ours_bright': m(r['measures']),
               'ref': m(r['ref']['measures']), 'ref_range': r['ref']['range'], 'flags': r['flags']}, open(os.path.join(H.ACC, 'baselines', 'look-oracle.json'), 'w'), indent=1)
    subprocess.run([H.PY, '-E', os.path.join(H.LIB, 'make_baselines.py')], check=True)


# ── 1. mock + sandbox ──
def mock():
    r = subprocess.run([H.PY, '-E', os.path.join(H.LIB, 'selftest_mock.py'), os.path.join(RD, 'mock')], capture_output=True, text=True, timeout=900)
    for l in r.stdout.splitlines():
        m = re.match(r'^(PASS|FAIL|SKIP)\s+(\S+)\s+(.*)$', l)
        if m: prove('selftest.' + m.group(2), 'self', True, m.group(1) == 'PASS' or m.group(1) == 'SKIP', m.group(3))


# ── 2. fixtures ──
def fixtures():
    for g, f, n, bcsrc in (('cadence', 'src24.mp4', 120, 'cadence'), ('cadence', 'src30.mp4', 120, 'cadence'), ('cuts30', 'ref.mp4', 300, 'cuts30'), ('cuts30', 'ours_exact.mp4', 300, 'cuts30'),
                           ('cuts30', 'ours_mixed.mp4', 300, 'cuts30'), ('phone24', 'clip.mp4', 96, 'phone24')):
        t = json.load(open(os.path.join(H.FIX, g, 'truth.json'))); bc = t['barcode']
        idx = [E.BC.decode(x, **bc) for x in H.decode_frames(os.path.join(H.FIX, g, f))]
        prove('fixture.%s/%s' % (g, f), 'self', True, idx == list(range(n)), 'frame-index barcode reads 0…%d on every decoded frame: %s' % (n - 1, idx == list(range(n))))
    t = json.load(open(os.path.join(H.FIX, 'cuts30', 'truth.json')))
    bd = json.load(open(os.path.join(H.FIX, 'cuts30', 'breakdown', 'breakdown.json')))
    sf = [s['startFrame'] for s in bd['shots']][1:]
    prove('fixture.cuts30.cut-frames', 'self', True, sf == t['ref_cuts'], 'the LIVE skill\'s --breakdown finds the planted cuts %s (truth %s)' % (sf, t['ref_cuts']))
    j = H.ffprobe_json(os.path.join(H.FIX, 'cuts30', 'ref.mp4'))
    v = [s for s in j['streams'] if s['codec_type'] == 'video'][0]
    pts = subprocess.run([H.FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts', '-of', 'csv=p=0', os.path.join(H.FIX, 'cuts30', 'ref.mp4')], capture_output=True, text=True).stdout.split()
    d = sorted({b - a_ for a_, b in zip(sorted(map(int, pts)), sorted(map(int, pts))[1:])})
    prove('fixture.cuts30.jittered-pts', 'self', True, v['time_base'] == '1/1000000' and len(d) > 2, 'reference time base %s, frame steps %s µs (irregular, like higgsfield02.mp4)' % (v['time_base'], d))
    hs = PL.sbs_hstack(os.path.join(H.FIX, 'cuts30', 'ref.mp4'), os.path.join(H.FIX, 'cuts30', 'ours_exact.mp4'), os.path.join(RD, 'hstack.mp4'))
    ok, det, _ = E.sbs_lock(hs, os.path.join(H.FIX, 'cuts30', 'ref.mp4'), os.path.join(H.FIX, 'cuts30', 'ours_exact.mp4'), bc=t['barcode'])
    prove('fixture.cuts30.hstack-slips', 'self', False, ok, 'ffmpeg hstack on the fixture: %s' % det)
    ct = json.load(open(os.path.join(H.FIX, 'clicks', 'truth.json')))
    for name in ('ref', 'lag40', 'tempo104'):
        r = subprocess.run([H.NODE, os.path.join(H.LIVE, 'video', 'lib', 'breakdown.mjs'), '--tempo', os.path.join(H.FIX, 'clicks', name + '.wav'), '--json'], capture_output=True, text=True)
        jj = json.loads(r.stdout); okk = abs(jj['bpm'] - ct[name]['bpm']) < .05 and abs(jj['firstBeat'] - ct[name]['first_beat']) < .005 and jj['confidence'] >= .9
        prove('fixture.clicks.%s' % name, 'self', True, okk, 'live tracker: %.2f BPM, first beat %.4f s, confidence %s (truth %.2f / %.4f)' % (jj['bpm'], jj['firstBeat'], jj['confidence'], ct[name]['bpm'], ct[name]['first_beat']))
    pt = json.load(open(os.path.join(H.FIX, 'phone24', 'truth.json'))); fr = H.decode_frames(os.path.join(H.FIX, 'phone24', 'clip.mp4'))[0]
    S = [np.array(p) for p in pt['per_frame'][0]['screen_corners']]
    inner = E._mask(fr.shape[1], fr.shape[0], S, -6); far = ~E._mask(fr.shape[1], fr.shape[0], S, 20)
    L = E.luma(fr)
    okp = (L[inner] < 24).mean() > .99 and (L[far] < 30).mean() < .001
    prove('fixture.phone24.dark-only-screen', 'self', True, okp, 'frame 0: %.1f %% of the screen < luma 24, %.3f %% of the rest' % (100 * (L[inner] < 24).mean(), 100 * (L[far] < 30).mean()))
    ft = json.load(open(os.path.join(H.FIX, 'films', 'truth.json')))
    prove('fixture.films.md5', 'self', True, ft['ref_pcm_md5'] == H.stream_md5(os.path.join(H.FIX, 'films', 'ref_a.mp4'), '0:a'), 'temp-track fixture md5s stable')


# ── 3. baselines still reproducible ──
def baselines():
    import make_baselines as MB
    for bj in sorted(glob.glob(os.path.join(H.ACC, 'baselines', 'live-audio', 'old-*.json'))):
        b = json.load(open(bj)); out = os.path.join(RD, 'baseline', b['job'])
        MB.build(H.LIVE, os.path.join(H.ACC, 'jobs', b['job']), out); m, t = MB.digest(out)
        prove('baseline.%s' % b['job'], 'self', True, m == b['md5'] and t == b['timeline_sha1'], 'live rebuild of %s (%s) = recorded md5s: %s' % (b['job'], b['style'], m == b['md5'] and t == b['timeline_sha1']))
    ok, det = __import__('suite_static').ck_live_untouched()
    prove('static.live-untouched', 'pass', True, ok, det)


# ── 4a. gen.mjs ──
GEN_FAULTS = {'leak-stdout': ['gen.key.never-leaks'], 'leak-log': ['gen.key.never-leaks', 'gen.log'], 'key-to-cdn': ['gen.key.never-leaks'],
              'dry-connect': ['gen.dry.no-network'], 'dry-files': ['gen.dry.no-files'], 'dry-quiet': ['gen.dry.still'], 'dry-base64': ['gen.dry.datauri-display'],
              'no-cost': ['gen.cost'], 'wrong-fields': ['gen.still.go', 'gen.video.i2v'], 'default-sec-6': ['gen.video.defaults'], 'guide-no-limit': ['gen.video.r2v'],
              'raw-convert-all': ['gen.raw'], 'datauri-log': ['gen.log'], 'poll-fast': ['gen.poll.interval'], 'node-download': ['gen.download.curl'],
              'overwrite': ['gen.overwrite'], 'force-resume': ['gen.overwrite'], 'no-env-default': ['gen.key.sources'], 'env-precedence': ['gen.key.sources'],
              'env-fallback': ['gen.key.envfile-without-key'], 'force-early': ['gen.force-failure-intact'], 'log-early': ['gen.log-after-accept'],
              'stray-ok': ['gen.stray-args-exit2'],
              'no-exit3': ['gen.key.missing-exit3'], 'exit1-errors': ['gen.errors.exit4'], 'no-rid': ['gen.errors.exit4'], 'timeout-silent': ['gen.timeout'],
              'fetch-broken': ['gen.fetch'], 'no-resume': ['gen.download.resume'], 'speed-limit': ['gen.download.stall'], 'no-size-check': ['gen.download.verify'],
              'exit1-download': ['gen.download.exit5']}


def gen():
    import suite_gen as G
    tool = os.path.join(ORA, 'gen.mjs')
    R = Cap(); G.run_suite(tool, os.path.join(RD, 'gen-oracle'), R, attempts=2, deny_write=(ORA,), quiet_ids=False)
    for c in G.CHECKS:
        s, d = R.get(c); prove(c, 'pass', True, st(s), 'oracle gen.mjs: ' + d)
    for fault, cids in GEN_FAULTS.items():
        R = Cap(); G.run_suite(tool, os.path.join(RD, 'gen-fault-' + fault), R, checks=cids, attempts=2, deny_write=(ORA,), extra_env={'ACC_FAULT': fault})
        for c in cids:
            s, d = R.get(c); prove(c, 'fail', False, st(s), 'planted %s: %s' % (fault, d))


# ── 4b. footage ──
def stub(name, body):
    p = os.path.join(PLD, 'stubs', name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write('# -*- coding: utf-8 -*-\n# planted-bad stub for the self-test\nimport sys, os, shutil\n' + body)
    return p


def footage():
    import suite_footage as SF
    T = {k: os.path.join(ORA, k + '.py') for k in ('look', 'conform', 'pin')}
    R = Cap(); SF.run_suite(T, os.path.join(RD, 'footage-oracle'), R, tag='oracle', real=True, deny=(ORA,))
    for c in ('look.oracle-still', 'look.ref-flags', 'look.decode-exact', 'look.real', 'conform.cadence', 'conform.size-cover', 'conform.grade', 'conform.30fps', 'conform.refuse-short', 'conform.real',
              'pin.composite-inside-only', 'pin.frames-cadence', 'pin.track-png', 'pin.no-phone-exit3', 'pin.real'):
        s, d = R.get(c); prove(c, 'pass', True, st(s), 'oracle: ' + d)
    oracle = json.load(open(os.path.join(H.ACC, 'baselines', 'look-oracle.json')))
    d = os.path.join(RD, 'footage-planted'); os.makedirs(d, exist_ok=True)
    good = json.load(open(os.path.join(RD, 'footage-oracle', 'look', 'still.json')))
    bad = json.loads(json.dumps(good)); bad['measures']['p50'] += 5; json.dump(bad, open(os.path.join(d, 'still-bad.json'), 'w'))
    ok, det = SF.Footage.eval_look_still(H.Run([], 0, '', '', 0), os.path.join(d, 'still-bad.json'), oracle['still']); prove('look.oracle-still', 'fail', False, ok, 'p50 +5: ' + det)
    g2 = json.load(open(os.path.join(RD, 'footage-oracle', 'look', 'ref.json'))); b2 = json.loads(json.dumps(g2)); b2['flags'] = {k: True for k in b2['flags']}
    json.dump(b2, open(os.path.join(d, 'ref-bad.json'), 'w'))
    ok, det = SF.Footage.eval_look_ref(H.Run([], 0, '', '', 0), os.path.join(d, 'ref-bad.json'), oracle); prove('look.ref-flags', 'fail', False, ok, 'every measure flagged: ' + det)
    fo = SF.Footage({'look': os.path.join(ORA, 'look.py')}, os.path.join(RD, 'footage-oracle'), Cap())
    exp = {n: fo.exact_expected(os.path.join(SF.V2, f), {}) for n, f in (('i2v', 'plate1-i2v.mp4'), ('fit', 'plate1-v2-fit.mp4'))}
    dark = {n: {k: (v - 2 if k in ('p10', 'p50', 'p90') else v) for k, v in e.items() if not k.startswith('_')} for n, e in exp.items()}
    ok, det = SF.Footage.eval_look_real(dark, exp); prove('look.real', 'fail', False, ok, 'every percentile 2 code values dark (the 1928-px decode QA1 found): ' + det)
    td = json.load(open(os.path.join(H.FIX, 'look_decode', 'truth.json')))
    got = {n: ({k: (v - 2 if k in ('p10', 'p90') and '1928' in n else v) for k, v in c['exact'].items()}, H.Run([], 0, '', '', 0)) for n, c in td['clips'].items()}
    ok, det = SF.Footage.eval_look_decode(got, td); prove('look.decode-exact', 'fail', False, ok, 'planted: grey stripes 2 dark at 1928 px only: ' + det)
    r4 = os.path.join(H.P, 'stage-r4-final-candidate', 'product-launch-sting', 'video', 'footage', 'look.py')
    if os.path.exists(r4):
        f4 = SF.Footage({'look': r4}, os.path.join(RD, 'footage-r4'), Cap(), deny=(os.path.dirname(os.path.dirname(os.path.dirname(r4))),))
        ok, det = f4.look_decode_exact(); prove('look.decode-exact', 'fail', False, ok, 'stage-r4-final-candidate (before the exact decode): ' + det)
    ct = json.load(open(os.path.join(H.FIX, 'cadence', 'truth.json'))); bc = ct['barcode']; src = os.path.join(H.FIX, 'cadence', 'src24.mp4'); s24 = H.decode_frames(src)
    for kind in ('interp', 'fast', 'n61', 'audio', 'untagged', 'yuv444', 'late'):
        o = PL.conform_planted(kind, os.path.join(d, 'conform-%s.mp4' % kind), src)
        ok, det = SF.Footage.eval_conform(H.Run([], 0, '24 → 30 fps: 1 repeat every 5', '', 0), o, bc, s24, 60, 12, 24, None)
        prove('conform.cadence', 'fail', False, ok, 'planted %s: %s' % (kind, det))
    o = PL.conform_planted('squash', os.path.join(d, 'conform-squash.mp4'), src)
    ok, det = SF.Footage.eval_conform(H.Run([], 0, '', '', 0), o, bc, s24, 60, 12, 24, (360, 360)); prove('conform.size-cover', 'fail', False, ok, 'squashed, not cover-cropped: ' + det)
    plain = os.path.join(RD, 'footage-oracle', 'conform', 'c24.mp4')
    ok, det = SF.Footage.eval_grade(H.Run([], 0, '', '', 0), plain, plain, bc); prove('conform.grade', 'fail', False, ok, 'grade ignored: ' + det)
    o30 = PL.conform_planted('n61', os.path.join(d, 'c30-bad.mp4'), os.path.join(H.FIX, 'cadence', 'src30.mp4'), start=1.0)
    ok, det = SF.Footage.eval_conform(H.Run([], 0, '', '', 0), o30, bc, H.decode_frames(os.path.join(H.FIX, 'cadence', 'src30.mp4')), 60, 30, 30, None); prove('conform.30fps', 'fail', False, ok, 'planted 61 frames: ' + det)
    sc = stub('conform_noref.py', "out = [x for x in sys.argv[1:] if x.endswith('.mp4')][1]\nshutil.copyfile(sys.argv[1], out)\nprint('ok')\n")
    r = H.run([H.PY, sc, src, os.path.join(d, 'short.mp4'), '--frames', '140', '--start', '0.5'], env=H.base_env(home=H.REAL_HOME))
    ok, det = SF.Footage.eval_refuse(r, os.path.join(d, 'short.mp4')); prove('conform.refuse-short', 'fail', False, ok, 'stub that never refuses: ' + det)
    regr = os.path.join(d, 'plate1-other-grade.mp4')
    H.run([H.PY, '-E', os.path.join(ORA, 'conform.py'), os.path.join(SF.V2, 'plate1-i2v.mp4'), regr, '--frames', '169', '--start', '0.9', '--grade', 'eq=saturation=1.3', '--crf', '14'], env=H.base_env(home=H.REAL_HOME), sandbox=False)
    ok, det = SF.Footage.eval_pixel_close(H.Run([], 0, '', '', 0), regr, os.path.join(SF.V2, 'plate1-v2-fit.mp4')); prove('conform.real', 'fail', False, ok, 'another grade: ' + det)
    pt = json.load(open(os.path.join(H.FIX, 'phone24', 'truth.json'))); psrc = H.decode_frames(os.path.join(H.FIX, 'phone24', 'clip.mp4'))
    for kind in ('naive', 'loose', 'frozen', 'flipped'):
        o = PL.pin_planted(kind, os.path.join(d, 'pin-%s.mp4' % kind), os.path.join(H.FIX, 'phone24'))
        ok, det = SF.Footage.eval_pin(None, o, pt, psrc); prove('pin.composite-inside-only', 'fail', False, ok, 'planted %s: %s' % (kind, det))
    o = PL.conform_planted('fast', os.path.join(d, 'pin-fast.mp4'), os.path.join(H.FIX, 'phone24', 'clip.mp4'), start=.4, n=90)
    ok, det = SF.Footage.eval_pin_cadence(None, o, pt); prove('pin.frames-cadence', 'fail', False, ok, 'sped-up clip: ' + det)
    ok, det = SF.Footage.eval_track_png(H.Run([], 0, '', '', 0), os.path.join(d, 'no-track.png')); prove('pin.track-png', 'fail', False, ok, 'nothing written: ' + det)
    sn = stub('pin_nophone.py', "print('wrote it anyway')\n")
    r = H.run([H.PY, sn, 'x'], env=H.base_env(home=H.REAL_HOME)); ok, det = SF.Footage.eval_nophone(r); prove('pin.no-phone-exit3', 'fail', False, ok, 'stub exit 0: ' + det)
    car = os.path.join(d, 'car0-start0.mp4')
    H.run([H.PY, '-E', os.path.join(ORA, 'pin.py'), os.path.join(SF.V3, 'car0-i2v.mp4'), os.path.join(SF.V3, 'ui_home.png'), car, '--frames', '69', '--start', '0.0', '--size', '720x1290', '--grade', SF.CAR0_GRADE], env=H.base_env(home=H.REAL_HOME), timeout=1200)
    ok, det = SF.Footage.eval_pixel_close(H.Run([], 0, '', '', 0), car, os.path.join(SF.V3, 'car0-fit.mp4'), tol=3.0); prove('pin.real', 'fail', False, ok, 'wrong start (0.0 s): ' + det)


# ── 4c. recreate ──
def recreate():
    import suite_recreate as SR
    T = {k: os.path.join(ORA, k + '.py') for k in ('compare', 'track', 'music', 'temptrack')}
    R = Cap(); SR.run_suite(T, os.path.join(RD, 'recreate-oracle'), R, tag='oracle', real=False, deny=(ORA,))
    rc = SR.Recreate(T, os.path.join(RD, 'recreate-oracle-real'), R, tag='oracle', deny=(ORA,)); rc.music(real=True); rc.temptrack(real=True)
    ids = ['compare.sbs-frame-lock', 'compare.verify-catches-slip', 'compare.cuts-exact', 'compare.cuts-shift1', 'compare.cuts-mixed', 'compare.cuts-trivial', 'compare.cuts-from', 'compare.fps-mismatch-exit2', 'compare.fps-multiple',
           'compare.overlap', 'compare.sheet', 'compare.options', 'track.pan', 'track.zoom', 'music.compare-clicks', 'music.profile-groove', 'music.real', 'music.real-profile',
           'temptrack.suffix-refuse', 'temptrack.verify-good', 'temptrack.verify-catches', 'temptrack.real']
    for c in ids:
        s, d = R.get(c); prove(c, 'pass', True, st(s), 'oracle: ' + d)
    d = os.path.join(RD, 'recreate-planted'); os.makedirs(d, exist_ok=True)
    t = json.load(open(os.path.join(H.FIX, 'cuts30', 'truth.json'))); bc = t['barcode']; ref, ours = os.path.join(H.FIX, 'cuts30', 'ref.mp4'), os.path.join(H.FIX, 'cuts30', 'ours_exact.mp4')
    ok_txt = H.Run([], 0, 'verify: 300/300 frames exact', '', 0)
    for kind, fn in (('slipped', lambda o: PL.sbs_compose(ref, ours, o, slip_at=150)), ('ffmpeg-hstack', lambda o: PL.sbs_hstack(ref, ours, o))):
        o = fn(os.path.join(d, 'sbs-%s.mp4' % kind)); ok, det = SR.Recreate.eval_sbs(ok_txt, o, ref, ours, bc, 300)
        prove('compare.sbs-frame-lock', 'fail', False, ok, 'planted %s side-by-side (tool claims 300/300): %s' % (kind, det))
    stub_cmp = stub('compare_noverify.py', "o = sys.argv[sys.argv.index('--out') + 1]; os.makedirs(o, exist_ok=True)\nimport subprocess\nt = os.path.join(o, '.sbs.q7w8.tmp.mp4')\nsubprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=1', '-pix_fmt', 'yuv420p', t])\nos.replace(t, os.path.join(o, 'sbs.mp4'))\nprint('verify: 300/300 frames exact')\n")
    mk = os.path.join(d, 'shim.jsonl')
    if os.path.exists(mk): os.remove(mk)
    e = H.base_env(home=H.REAL_HOME, tmp=os.path.join(d, 'tmp')); e.update({'PATH': SR.SHIM + ':' + e['PATH'], 'ACC_TAMPER': 'slip-sbs', 'ACC_SHIM_MARK': mk, 'ACC_REAL_FFMPEG': H.FFMPEG,
                                                                    'ACC_TAMPER_DIR': os.path.join(d, 'cmp-stub'), 'ACC_TAMPER_STEM': 'sbs', 'ACC_TAMPER_EXT': '.mp4'})
    r = H.run([H.PY, stub_cmp, '--ref', ref, '--ours', ours, '--out', os.path.join(d, 'cmp-stub')], env=e)
    ok, det = SR.Recreate.eval_catch(r, mk, r'verify:\s*(\d+)\s*/\s*(\d+)'); prove('compare.verify-catches-slip', 'fail', False, ok, 'stub that never verifies: ' + det)
    for v, cid, change in (('ours_exact', 'compare.cuts-exact', ('exact', 6)), ('ours_shift1', 'compare.cuts-shift1', ('offset', -2)), ('ours_mixed', 'compare.cuts-mixed', ('off_by', 4))):
        src_d = os.path.join(RD, 'recreate-oracle', 'compare', v); bd_ = os.path.join(d, 'cuts-' + v); shutil.rmtree(bd_, ignore_errors=True); shutil.copytree(src_d, bd_)
        j = json.load(open(os.path.join(bd_, 'cuts.json'))); line = j['summary']
        if change[0] == 'exact': line = line.replace('7 exact, 0 within', '6 exact, 1 within')
        if change[0] == 'offset':
            for rr in j['cuts']: rr['offset'] = 2
        if change[0] == 'off_by': line = line.replace('n104 +3 f', 'n104 +4 f'); [rr.update(offset=4) for rr in j['cuts'] if rr['n'] == 104]
        json.dump(j, open(os.path.join(bd_, 'cuts.json'), 'w')); open(os.path.join(bd_, 'cuts.md'), 'w').write(line + '\n')
        ok, det = SR.Recreate.eval_cuts(H.Run([], 0, line, '', 0), bd_, t['expect'][v], t['ref_cuts']); prove(cid, 'fail', False, ok, 'planted report: ' + det)
    bb = os.path.join(d, 'cuts-blank'); shutil.rmtree(bb, ignore_errors=True); shutil.copytree(os.path.join(RD, 'recreate-oracle', 'compare', 'ours_blank'), bb)
    j = json.load(open(os.path.join(bb, 'cuts.json'))); [rr.update(trivial=False) for rr in j['cuts']]; json.dump(j, open(os.path.join(bb, 'cuts.json'), 'w'))
    ok, det = SR.Recreate.eval_trivial(H.Run([], 0, '', '', 0), bb, t['expect']['ours_blank']['trivial'], t['ref_cuts']); prove('compare.cuts-trivial', 'fail', False, ok, 'no trivial flags: ' + det)
    bf = os.path.join(d, 'cuts-from'); shutil.rmtree(bf, ignore_errors=True); shutil.copytree(os.path.join(RD, 'recreate-oracle', 'compare', 'cutsfrom'), bf)
    j = json.load(open(os.path.join(bf, 'cuts.json'))); j['cuts'] = j['cuts'][:6]; json.dump(j, open(os.path.join(bf, 'cuts.json'), 'w'))
    ok, det = SR.Recreate.eval_cuts(H.Run([], 0, 'cuts: 6 in the reference — 6 exact, 0 within 1 f, 0 off, 0 missing', '', 0), bf, t['expect']['ours_exact'], t['ref_cuts']); prove('compare.cuts-from', 'fail', False, ok, 'a cut dropped from --cuts-from: ' + det)
    o60 = os.path.join(H.FIX, 'cuts30', 'ours_60fps.mp4'); odd = PL.sbs_compose_step(ref, o60, os.path.join(d, 'sbs-60-odd.mp4'))
    os.makedirs(os.path.join(d, 'fps60-planted'), exist_ok=True); shutil.copyfile(odd, os.path.join(d, 'fps60-planted', 'sbs.mp4'))
    ok, det = SR.Recreate.eval_fps_multiple(H.Run([], 0, 'verify: 300/300 frames exact\ncuts: 7 in the reference — 7 exact, 0 within 1 f', '', 0), os.path.join(d, 'fps60-planted'), ref, o60, bc, t)
    prove('compare.fps-multiple', 'fail', False, ok, 'side-by-side paired with our odd frames (2i+1): ' + det)
    sf = stub('compare_nofps.py', "print('fine'); sys.exit(0)\n"); r = H.run([H.PY, sf], env=H.base_env(home=H.REAL_HOME))
    prove('compare.fps-mismatch-exit2', 'fail', False, r.rc == 2, 'stub exit %s' % r.rc)
    ok, det = SR.Recreate.eval_overlap(H.Run([], 0, 'verify: 300/300 frames exact', '', 0), d, ref, os.path.join(H.FIX, 'cuts30', 'ours_short.mp4'), bc); prove('compare.overlap', 'fail', False, ok, 'silent about lengths: ' + det)
    from PIL import Image
    im = Image.open(os.path.join(RD, 'recreate-oracle', 'compare', 'ours_exact', 'sheet.png')).convert('RGB'); w, h = im.size
    half = im.crop((0, 0, w, h)); arr = np.asarray(half).copy(); arr[:, :] = np.asarray(im)[:, :]; tc = t['colors']
    for c in tc['ours']: arr[(np.abs(arr.astype(int) - np.array(c)).max(2) <= 18)] = (0, 0, 0)
    Image.fromarray(arr).save(os.path.join(d, 'sheet-no-ours.png'))
    ok, det = SR.Recreate.eval_sheet(os.path.join(d, 'sheet-no-ours.png'), tc); prove('compare.sheet', 'fail', False, ok, 'ours removed from the sheet: ' + det)
    so = stub('compare_opts.py', "o = sys.argv[sys.argv.index('--out') + 1]; os.makedirs(o, exist_ok=True)\nprint('cuts: 7 in the reference — 7 exact, 0 within 1 f, 0 off, 0 missing')\n")
    rcs = SR.Recreate({'compare': so}, os.path.join(d, 'opts'), Cap(), deny=(ORA,)); ok, det = rcs.options(ref, bc); prove('compare.options', 'fail', False, ok, 'stub ignoring the options: ' + det)
    ok, det = SR.Recreate.eval_cuts(H.Run([], 0, '', '', 0), d, t['expect']['ours_exact'], t['ref_cuts'])
    s = E.parse_cut_summary('cuts: 22 in the reference — 17 exact, 2 within 1 f, 3 off (n75 +4 f)')
    prove('compare.real', 'fail', False, s['exact'] >= 19 and s['exact'] + s['within1'] >= 21, 'a summary with 17 exact + 2 within 1 f would be judged FAIL')
    s = E.parse_cut_summary('cuts: 22 in the reference — 19 exact, 2 within 1 f, 1 off (n75 +4 f)')
    prove('compare.real', 'pass', True, s['exact'] >= 19 and s['exact'] + s['within1'] >= 21 and 20 <= s['ref'] <= 25, "today's result line (19 exact + 2 within 1 f of 22) is judged PASS")
    tr = json.load(open(os.path.join(H.FIX, 'track', 'truth.json'))); gp = json.load(open(os.path.join(RD, 'recreate-oracle', 'track', 'pan.json')))
    for name, mut in (('speed not normalised to 1080', lambda f: f.update(speed=f['speed'] / 2)), ('tx sign flipped', lambda f: f.update(tx=-f['tx']))):
        b = json.loads(json.dumps(gp)); [mut(f) for f in b['frames']]; p = os.path.join(d, 'pan-bad.json'); json.dump(b, open(p, 'w'))
        ok, det = SR.Recreate.eval_pan(H.Run([], 0, '', '', 0), p, tr['pan'], tr['W']); prove('track.pan', 'fail', False, ok, '%s: %s' % (name, det))
    gz = json.load(open(os.path.join(RD, 'recreate-oracle', 'track', 'zoom.json'))); b = json.loads(json.dumps(gz)); [f.update(scale=1 + (f['scale'] - 1) * .8) for f in b['frames']]
    p = os.path.join(d, 'zoom-bad.json'); json.dump(b, open(p, 'w')); ok, det = SR.Recreate.eval_zoom(H.Run([], 0, '', '', 0), p, tr['zoom']); prove('track.zoom', 'fail', False, ok, 'scale under-read 20 %: ' + det)
    ct = json.load(open(os.path.join(H.FIX, 'clicks', 'truth.json')))
    gl = json.load(open(os.path.join(RD, 'recreate-oracle', 'music', 'lag.json'))); b = json.loads(json.dumps(gl)); b['lag_ms'] = 0.0; p = os.path.join(d, 'lag-bad.json'); json.dump(b, open(p, 'w'))
    ok, det = SR.Recreate.eval_clicks(H.Run([], 0, 'verdict', '', 0), p, None, os.path.join(RD, 'recreate-oracle', 'music', 'same.json'), ct); prove('music.compare-clicks', 'fail', False, ok, 'lag reported as 0: ' + det)
    gg = json.load(open(os.path.join(RD, 'recreate-oracle', 'music', 'groove.json'))); b = json.loads(json.dumps(gg)); b['groove'] = {k: v[2:] + v[:2] for k, v in b['groove'].items()}
    p = os.path.join(d, 'groove-bad.json'); json.dump(b, open(p, 'w'))
    ok, det = SR.Recreate.eval_groove(H.Run([], 0, '', '', 0), p, None, os.path.join(RD, 'recreate-oracle', 'music', 'groove-tracker.json'), ct['groove']); prove('music.profile-groove', 'fail', False, ok, 'groove off by an 8th: ' + det)
    gr = json.load(open(os.path.join(RD, 'recreate-oracle-real', 'music', 'real.json'))); b = json.loads(json.dumps(gr)); b['ours']['hit'] = 50.47; p = os.path.join(d, 'real-bad.json'); json.dump(b, open(p, 'w'))
    ok, det = SR.Recreate.eval_real(H.Run([], 0, '', '', 0), p); prove('music.real', 'fail', False, ok, 'the loudest moment taken as the hit (50.47 s): ' + det)
    gp2 = json.load(open(os.path.join(RD, 'recreate-oracle-real', 'music', 'real-profile.json'))); b = json.loads(json.dumps(gp2)); b['key'] = 'C major'; b['centroid_hz'] = 4200
    p = os.path.join(d, 'real-profile-bad.json'); json.dump(b, open(p, 'w')); ok, det = SR.Recreate.eval_real_profile(H.Run([], 0, '', '', 0), p); prove('music.real-profile', 'fail', False, ok, 'wrong key + centroid: ' + det)
    st_ = stub('temptrack_lax.py', "a = sys.argv; o = a[a.index('--out') + 1]\nimport subprocess\nsubprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', a[a.index('--film') + 1], '-i', a[a.index('--ref') + 1], '-map', '0:v', '-map', '1:a', '-c', 'copy', o if o.endswith('.mp4') else o + '.mp4'])\nprint('PASS')\n")
    rt = SR.Recreate({'temptrack': st_}, os.path.join(d, 'tt'), Cap(), deny=(ORA,)); R2 = Cap(); rt.R = R2; rt.temptrack(real=False)
    for c in ('temptrack.suffix-refuse', 'temptrack.verify-good'):
        s, dd = R2.get(c); prove(c, 'fail', False, st(s), 'lax stub (no suffix, no refusal, no metadata, no verification): ' + dd)
    nv = stub('temptrack_noverify.py', "import re, subprocess\na = sys.argv; o = re.sub(r'(-tempmusic-PRIVATE)?\\.mp4$', '', a[a.index('--out') + 1]) + '-tempmusic-PRIVATE.mp4'\nt = os.path.join(os.path.dirname(o), '.' + os.path.basename(o)[:-4] + '.k3j9.tmp.mp4')\nsubprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', a[a.index('--film') + 1], '-i', a[a.index('--ref') + 1], '-map', '0:v', '-map', '1:a', '-c', 'copy', '-metadata', 'title=private temp track', t])\nos.replace(t, o)\nprint('PASS (not actually verified) — private review copy')\n")
    rv = SR.Recreate({'temptrack': nv}, os.path.join(d, 'tt-noverify'), Cap(), deny=(ORA,)); R3 = Cap(); rv.R = R3; rv.temptrack(real=False)
    s, dd = R3.get('temptrack.verify-catches'); prove('temptrack.verify-catches', 'fail', False, st(s), 'stub that writes the right file but never verifies: ' + dd)
    for kind in ('reencoded-audio', 'reencoded-video'):
        o = PL.temptrack_planted(kind, SR.FILM, H.REF_MP4, os.path.join(d, 'real-%s-tempmusic-PRIVATE.mp4' % kind))
        ok, det = E.temptrack_eval(o, SR.FILM, H.REF_MP4); prove('temptrack.real', 'fail', False, ok, '%s: %s' % (kind, det))


# ── 4d. film style ──
def synth_film(path, br, downbeat, beat, end, shift=0.0, kick_in_break=False, no_gap=False):
    sr = 44100; n = int(br['dur'] * sr); x = np.zeros(n); r = np.random.RandomState(5)
    drop = next(s['start'] for s in br['shots'] if s['id'] == 'brief'); vb = next(s for s in br['shots'] if s['id'] == 'voice')
    tt = np.arange(int(.3 * sr)) / sr
    kick = .7 * np.sin(2 * np.pi * (48 + 50 * np.exp(-tt / .03)) * tt) * np.exp(-tt / .12)
    X = np.fft.rfft(r.normal(0, 1, len(tt))); Fq = np.fft.rfftfreq(len(tt), 1.0 / sr); X[Fq < 6000] = 0; hn = np.fft.irfft(X, len(tt)); hn /= np.abs(hn).max()
    shaker = .25 * hn * np.exp(-tt / .012)
    def add(t, sig):
        i = int(round((t + shift) * sr))
        if 0 <= i < n: m = min(n - i, len(sig)); x[i:i + m] += sig[:m]
    gap = end - (0 if no_gap else .44)
    k = 0
    while True:
        t = downbeat + k * beat / 4
        if t >= gap: break
        if t >= 0:
            inb = vb['start'] <= t < vb['end']
            add(t, shaker * (1.0 if k % 4 == 0 else .6))
            if t >= drop and k % 4 == 0 and (not inb or kick_in_break): add(t, kick)
        k += 1
    tb = np.arange(n) / sr; pad = .03 * np.sin(2 * np.pi * 349.2 * tb); x += pad
    if not no_gap: x[int((gap + shift) * sr):int((end + shift) * sr)] = 0        # the gap before the end card: digital silence, tails included
    add(end, np.r_[kick, np.zeros(sr)] + .4 * np.exp(-np.arange(int(1.3 * sr)) / sr / .6) * np.sin(2 * np.pi * 349.2 * np.arange(int(1.3 * sr)) / sr))
    import wave
    s = (np.clip(x / max(1, np.abs(x).max() / .9), -1, 1) * 32767).astype('<i2'); stt = np.stack([s, s], -1).reshape(-1)
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(stt.tobytes())
    return path


def planted_good_stage(base):
    """live copy + my own 3 spec edits + style film routed to the keynote arrangement: proves the film checks' plumbing can PASS"""
    st_ = os.path.join(PLD, 'stage-good')
    if os.path.exists(st_): shutil.rmtree(st_)
    subprocess.run(['/bin/cp', '-cR', H.LIVE, st_], check=True)
    sp = os.path.join(st_, 'video', 'lib', 'spec.mjs'); s = open(sp, encoding='utf-8').read()
    s = s.replace("export const STYLES = ['playful', 'keynote', 'calm', 'none', 'track'];", "export const STYLES = ['playful', 'keynote', 'calm', 'none', 'track', 'film'];")
    s = s.replace("const STYLE_BPM = { playful: 120, keynote: 124, calm: 96 };", "const STYLE_BPM = { playful: 120, keynote: 124, calm: 96, film: 87 };")
    s = s.replace("{ playful: 'F', keynote: 'D', calm: 'G' }[style]", "{ playful: 'F', keynote: 'D', calm: 'G', film: 'F' }[style]")
    end_music = "    downbeat: Number(m.downbeat || 0), drop: m.drop != null ? String(m.drop) : null, breaks: [].concat(m.breaks || []).map(String), level: Number(m.level || 0) };"
    if end_music not in s: raise RuntimeError('planted-good spec.mjs: music object end not found — the live spec.mjs changed?')
    s = s.replace(end_music, end_music + "\n  if (m.hit != null && !(Number(m.hit) >= -1 && Number(m.hit) <= 2)) errs.push('music.hit must be −1…2 s after the end card (acceptance stand-in)');"
                  "\n  if (m.hit != null) music.hit = Number(m.hit);", 1)
    import suite_static as SS                                       # the approved 5th edit, verbatim
    bl = next(l for l in s.splitlines() if 'music.breaks: unknown shot id' in l)
    s = s.replace(bl, bl + '\n  ' + SS.HIT_WARN_LINE, 1)
    open(sp, 'w', encoding='utf-8').write(s)
    ap = os.path.join(st_, 'video', 'lib', 'audio.mjs'); s = open(ap, encoding='utf-8').read()
    toy = """
  if (style === 'film') {          // ACCEPTANCE STAND-IN (planted-good stage only), NOT the real film score: a toy on the grid
    const q = beat / 4, gapT = endT < dur - .05 ? endT - .44 : dur;
    for (let k = 0; ; k++) {
      const t = m.downbeat + k * q; if (t >= gapT - .1) break; if (t < 0) continue;
      const groove = t >= dropT && !inBreak(t);
      E.hat(t, k % 4 === 0 ? .2 : .07, false, 0);
      if (groove && k % 4 === 0) E.kick(t, .8, .5);
      if (groove && k % 8 === 4) E.clap(t, .45);
    }
    for (let b0 = Math.max(0, m.downbeat); b0 < gapT - .2; b0 += bar) E.pad(b0, Math.min(b0 + bar, gapT - .15), chord(b0), .04, .06, .05);
    if (endT < dur - .05) { const tonic = voice(chordPcs(keyPc, 0, 5), 53); E.kick(endT, .9, .6); E.crash(endT, .22); E.stab(endT, tonic, .12, .8, 3200, Math.min(1.8, dur - endT)); E.pad(endT, dur, [...tonic, tonic[0] + 12], .05, .05, .1); }
    return;
  }"""
    anchor = "  // ── intro: pad + arpeggio, light time-keeping, a riser into the drop ──"
    s = s.replace("    calm: { kick: .5,", "    film: null,\n    calm: { kick: .5,", 1).replace(anchor, toy + '\n' + anchor, 1)
    s = s.replace("const PROG = { playful: [0, 5, 3, 4], keynote: [0, 5, 3, 4], calm: [0, 4, 5, 3] };", "const PROG = { playful: [0, 5, 3, 4], keynote: [0, 5, 3, 4], calm: [0, 4, 5, 3], film: [0, 5, 3, 4] };", 1)
    for need in ("film: [0, 5, 3, 4]", "ACCEPTANCE STAND-IN"):
        if need not in s: raise RuntimeError('planted-good audio.mjs patch did not apply (%s) — the live audio.mjs changed?' % need)
    open(ap, 'w', encoding='utf-8').write(s)
    return st_


def film():
    import suite_film as SM
    d = os.path.join(RD, 'film'); os.makedirs(d, exist_ok=True)
    # FAIL side, the natural way: the LIVE skill has no film style
    R = Cap(); SM.run_suite(H.LIVE, os.path.join(d, 'live'), R, parts=('spec', 'score', 'starter', 'qa'))
    for c in ('film.spec-defaults', 'film.grid', 'film.endcard', 'film.intro-grid', 'film.breaks', 'film.no-endcard', 'film.starter', 'film.qa-audio'):
        s, dd = R.get(c); prove(c, 'fail', False, st(s), 'live skill (no film style): ' + dd)
    # PASS side of the plumbing: a planted-good stage (my 3 spec edits; film → keynote arrangement)
    good = planted_good_stage(H.LIVE)
    R = Cap(); SM.run_suite(good, os.path.join(d, 'good'), R, parts=('spec', 'score', 'starter', 'qa', 'old'))
    # (film.endcard's pass side comes from the synthetic track below: the toy can't gate the engine's mixdown tails)
    for c in ('film.spec-defaults', 'film.grid', 'film.intro-grid', 'film.breaks', 'film.no-endcard', 'film.starter', 'film.qa-audio', 'film.old-styles-unchanged'):
        s, dd = R.get(c); prove(c, 'pass', True, st(s), 'planted-good stage (my 3 spec edits + a toy film arrangement on the grid): ' + dd)
    # music.hit (lead's review round): validation passes on the planted-good stage, both checks fail on the pre-review tree
    fg = SM.Film(good, os.path.join(d, 'good-hit'), Cap()); R = Cap(); fg.R = R; fg.hit()
    s, dd = R.get('film.hit-validation'); prove('film.hit-validation', 'pass', True, st(s), 'planted-good stage (my own 2-line music.hit block): ' + dd)
    s, dd = R.get('film.hit-warning'); prove('film.hit-warning', 'pass', True, st(s), 'planted-good stage (the approved warning line verbatim): ' + dd)
    r2 = os.path.join(H.P, 'stage-r2-after-codex-fixes', 'product-launch-sting')
    if os.path.exists(r2):
        f2 = SM.Film(r2, os.path.join(d, 'r2-hit'), Cap()); R = Cap(); f2.R = R; f2.hit()
        s, dd = R.get('film.hit-warning'); prove('film.hit-warning', 'fail', False, st(s), 'stage-r2 (before the warning was added): ' + dd)
    r0 = os.path.join(H.P, 'stage-r0-before-review-fixes', 'product-launch-sting')
    if os.path.exists(r0):
        f0 = SM.Film(r0, os.path.join(d, 'r0-hit'), Cap()); R = Cap(); f0.R = R; f0.hit()
        for c in ('film.hit-validation', 'film.hit-offset'):
            s, dd = R.get(c); prove(c, 'fail', False, st(s), 'pre-review tree (stage-r0-before-review-fixes): ' + dd)
    # PASS/FAIL of the score evaluators on a synthetic film-like track on the reference grid
    f = SM.Film(H.LIVE, os.path.join(d, 'synth'), Cap())
    ctl = os.path.join(d, 'keynote-control'); shutil.rmtree(ctl, ignore_errors=True); shutil.copytree(os.path.join(H.ACC, 'jobs', 'film-grid'), ctl)
    y = os.path.join(ctl, 'beats.yaml'); txt = open(y).read(); open(y, 'w').write(txt.replace('style: film,', 'style: keynote,'))
    kb = f.build(ctl, os.path.join(d, 'keynote-control-audio'), master=True); br = json.load(open(os.path.join(d, 'keynote-control-audio', 'brief.json')))
    beat, db, end = 60 / 87.46, .3905, br['endcard']; drop = next(s['start'] for s in br['shots'] if s['id'] == 'brief'); vb = next(s for s in br['shots'] if s['id'] == 'voice')
    good_w = synth_film(os.path.join(d, 'synth-good.wav'), br, db, beat, end)
    x = H.decode_audio(good_w, sr=44100)
    tm, _ = f.tempo(good_w); prove('film.grid', 'pass', True, E.tempo_on_grid(tm, 87.46, db)[0], 'synthetic film-like track on the grid: ' + E.tempo_on_grid(tm, 87.46, db)[1])
    ok, dd = SM.Film.eval_endcard(x, 44100, end, br['dur']); prove('film.endcard', 'pass', True, ok, 'synthetic: ' + dd)
    ok, dd = SM.Film.eval_intro(x, 44100, db, beat, drop, end); prove('film.intro-grid', 'pass', True, ok, 'synthetic: ' + dd)
    ok, dd = SM.Film.eval_break(x, 44100, drop, (vb['start'], vb['end']), end); prove('film.breaks', 'pass', True, ok, 'synthetic: ' + dd)
    sh = synth_film(os.path.join(d, 'synth-halfbeat.wav'), br, db, beat, end, shift=beat / 2)
    tm, _ = f.tempo(sh); prove('film.grid', 'fail', False, E.tempo_on_grid(tm, 87.46, db)[0], 'synthetic shifted half a beat: ' + E.tempo_on_grid(tm, 87.46, db)[1])
    xk = H.decode_audio(os.path.join(d, 'keynote-control-audio', 'music.wav'), sr=44100)
    ok, dd = SM.Film.eval_endcard(xk, 44100, end, br['dur']); prove('film.endcard', 'fail', False, ok, 'keynote at the same grid (no gap before the end card): ' + dd)
    ok, dd = SM.Film.eval_intro(xk, 44100, db, beat, drop, end); prove('film.intro-grid', 'fail', False, ok, 'keynote at the same grid (intro counted from 0, not the downbeat): ' + dd)
    kib = H.decode_audio(synth_film(os.path.join(d, 'synth-kickbreak.wav'), br, db, beat, end, kick_in_break=True), sr=44100)
    ok, dd = SM.Film.eval_break(kib, 44100, drop, (vb['start'], vb['end']), end); prove('film.breaks', 'fail', False, ok, 'kick kept in the break: ' + dd)
    hs = synth_film(os.path.join(d, 'synth-hit0372.wav'), br, db, beat, end + .372)
    xh = H.decode_audio(hs, sr=44100); ok, dd = SM.Film.eval_hit_offset(xh, 44100, end, .372, br['dur']); prove('film.hit-offset', 'pass', True, ok, 'synthetic with its gap + hit moved 0.372 s past the card: ' + dd)
    ok, dd = SM.Film.eval_hit_offset(x, 44100, end, .372, br['dur']); prove('film.hit-offset', 'fail', False, ok, 'synthetic with the hit still on the card: ' + dd)
    ok, dd = SM.Film.eval_noend(x[:int((end - .44) * 44100)], 44100, end - .44, beat); prove('film.no-endcard', 'pass', True, ok, 'synthetic cut before its gap: ' + dd)
    ok, dd = SM.Film.eval_noend(x[:int((end + .01) * 44100)], 44100, end + .01, beat); prove('film.no-endcard', 'fail', False, ok, 'an end-card gap left in a film without an end card: ' + dd)
    # old styles: perturbed job vs its baseline
    pj = os.path.join(H.ACC, 'jobs', 'old-cue'); pj2 = os.path.join(d, 'old-cue-keyG'); shutil.rmtree(pj2, ignore_errors=True); shutil.copytree(pj, pj2)
    y = os.path.join(pj2, 'beats.yaml'); txt = open(y).read(); open(y, 'w').write(txt.replace('key: F', 'key: G', 1))
    f2 = SM.Film(H.LIVE, os.path.join(d, 'perturbed'), Cap())
    f2.build(pj2, os.path.join(d, 'perturbed', 'out')); import make_baselines as MB
    m, tl = MB.digest(os.path.join(d, 'perturbed', 'out')); b = json.load(open(os.path.join(H.ACC, 'baselines', 'live-audio', 'old-cue.json')))
    prove('film.old-styles-unchanged', 'fail', False, m == b['md5'] and tl == b['timeline_sha1'], 'old-cue rebuilt in key G instead of F → music.wav %s vs baseline %s' % (m.get('music.wav', '')[:8], b['md5']['music.wav'][:8]))


# ── 4e. static ──
def static():
    import suite_static as S
    good = planted_good_stage(H.LIVE)
    for rel, txt in (('video/footage/gen.mjs', "#!/usr/bin/env node\n// exit 0 ok · 2 bad input · 3 no key · 4 fal error · 5 download\nimport { spawnSync } from 'node:child_process';\n"),
                     ('video/footage/conform.py', '# -*- coding: utf-8 -*-\n# exit 0 ok, 2 too short\nimport sys, os\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\nimport fcommon\nif "--help" in sys.argv: print("usage")\n'),
                     ('video/footage/fcommon.py', '# -*- coding: utf-8 -*-\n# exit codes: none (a library)\nX = 1\n'),
                     ('video/recreate/compare.py', '# -*- coding: utf-8 -*-\n# exit 0 ok · 1 verify mismatch · 2 fps differ\nimport sys\nprint("usage")\n'),
                     ('video/FOOTAGE.md', '# Footage\n' + 'Generate with --go after approval; ~$1.10 per plate. look.py, conform.py, pin.py; image-to-video; CDN stall → resume.\n' * 8),
                     ('video/RECREATE.md', '# Recreate\n' + 'compare.py track.py music.py temptrack.py; music: {style: film}; the copy trap; private temp track.\n' * 8),
                     ('video/templates/footage-prompts.md', '# Prompts\n' + 'A 35mm lens; the screen is completely black; no text, no captions.\n' * 10)):
        p = os.path.join(good, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(txt)
    g = os.path.join(good, 'video', 'GUIDE.md'); open(g, 'a').write('\nSee FOOTAGE.md and RECREATE.md.\nRequirements: python3 with numpy + Pillow, ffmpeg, curl.\n')
    bt = os.path.join(good, 'video', 'templates', 'beats.yaml'); bl = open(bt, encoding='utf-8').read().splitlines()
    k = next(i for i, l in enumerate(bl) if 'playful (mallets, 120)' in l or 'style:' in l)
    bl[k] = bl[k] + '   # or film (groove, 87)'; open(bt, 'w', encoding='utf-8').write('\n'.join(bl) + '\n')
    s = os.path.join(good, 'SKILL.md'); open(s, 'a').write('\nFootage: video/FOOTAGE.md · recreate a film: video/RECREATE.md\n')
    gs = open(g).read().replace('nothing is generated here', 'footage is generated in FOOTAGE.md')
    gs = gs.replace('## Limits (raise them at the brief)\n', '## Limits (raise them at the brief)\nAI footage: generate it with video/footage (FOOTAGE.md).\n', 1); open(g, 'w').write(gs)
    R = Cap(); S.run_suite(good, os.path.join(RD, 'static-good'), R, tag='planted-good')
    for cid, _ in S.CHECKS:
        s_, dd = R.get(cid); prove(cid, 'pass', True, st(s_), 'planted-good stage: ' + dd)
    bad = os.path.join(PLD, 'stage-bad')
    if os.path.exists(bad): shutil.rmtree(bad)
    subprocess.run(['/bin/cp', '-cR', good, bad], check=True)
    open(os.path.join(bad, 'video', 'engine', 'kit.js'), 'a').write('\n// stray edit\n')
    sp = os.path.join(bad, 'video', 'lib', 'spec.mjs'); t = open(sp).read().replace('export const TRANSITIONS', '// film tweak\nexport const TRANSITIONS').replace('export const BG_MOVES', '// another\nexport const BG_MOVES').replace('export function mediaFields', '// and another\nexport function mediaFields'); open(sp, 'w').write(t)
    open(os.path.join(bad, 'video', 'footage', 'look.py'), 'w').write('import sys\nmatch sys.argv:\n    case _: pass\n')
    open(os.path.join(bad, 'video', 'footage', 'conform.py'), 'w').write('# -*- coding: utf-8 -*-\n# exit 0\nimport fcommon\nimport sys, os\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\n')
    open(os.path.join(bad, 'video', 'footage', 'gen.mjs'), 'w').write("import fetch from 'node-fetch';\n")
    open(os.path.join(bad, 'video', 'recreate', 'compare.py'), 'w').write('# -*- coding: utf-8 -*-\nprint("no exit codes documented")\n')
    open(os.path.join(bad, 'video', 'FOOTAGE.md'), 'w').write('# Footage\nTBD\n')
    open(os.path.join(bad, 'video', 'extra-notes.md'), 'w').write('stray file\n')
    bt = os.path.join(bad, 'video', 'templates', 'beats.yaml'); open(bt, 'a').write('# a second changed line\n# and a third\n')
    R = Cap(); S.run_suite(bad, os.path.join(RD, 'static-bad'), R, tag='planted-bad')
    for cid, _ in S.CHECKS:
        if cid == 'static.live-untouched': continue
        s_, dd = R.get(cid); prove(cid, 'fail', False, st(s_), 'planted-bad stage: ' + dd)
    lb = os.path.join(PLD, 'live-copy-touched')
    if os.path.exists(lb): shutil.rmtree(lb)
    subprocess.run(['/bin/cp', '-cR', H.LIVE, lb], check=True); open(os.path.join(lb, 'SKILL.md'), 'a').write('\n')
    ok, dd = S.ck_live_untouched(lb); prove('static.live-untouched', 'fail', False, ok, 'a touched copy of live: ' + dd)


def main():
    global OUT
    if '--build-only' in a: build(); return 0
    os.makedirs(RD, exist_ok=True); OUT = os.path.join(RD, 'selftest.txt')
    say('harness self-test → %s' % RD)
    for part in ('mock', 'fixtures', 'baselines', 'gen', 'footage', 'recreate', 'film', 'static'):
        if part not in ONLY: continue
        say('\n── %s ──' % part); t0 = time.time()
        try: globals()[part]()
        except Exception:
            import traceback
            prove('selftest.%s' % part, 'self', True, False, 'self-test crashed: ' + traceback.format_exc().strip().splitlines()[-1])
        say('   (%s: %.0f s)' % (part, time.time() - t0))
    checks = {}
    for cid, side, held, det in PROOFS:
        checks.setdefault(cid, {}).setdefault(side, []).append(held)
    say('\n── proof matrix (every check must be shown to PASS on a good input and FAIL on a planted-bad one) ──')
    broken = 0
    for cid in sorted(checks):
        c = checks[cid]
        if 'self' in c:
            if not all(c['self']): broken += 1; say('BROKEN %s' % cid)
            continue
        p, f = c.get('pass'), c.get('fail')
        okp, okf = (all(p) if p else None), (all(f) if f else None)
        tag = 'proven' if okp and okf else 'BROKEN' if okp is False or okf is False else 'partial'
        if tag != 'proven': broken += tag == 'BROKEN'
        say('%-7s %-34s pass-proof %-4s fail-proof %s' % (tag, cid, {True: 'yes', False: 'NO', None: '—'}[okp], ('yes (%d planted)' % len(f)) if okf else {False: 'NO', None: '—'}[okf]))
    n = len(PROOFS); held = sum(1 for x in PROOFS if x[2])
    say('\n%d/%d proofs held; %d broken check(s) — %s' % (held, n, broken, OUT))
    return 1 if broken or held < n else 0


if __name__ == '__main__':
    sys.exit(main())
