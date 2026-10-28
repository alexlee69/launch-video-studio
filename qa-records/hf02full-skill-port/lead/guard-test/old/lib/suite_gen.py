# -*- coding: utf-8 -*-
# gen.mjs acceptance suite: every command against the mock fal queue, inside the sandbox (real .env unreadable, only
# 127.0.0.1 reachable), with FAKE keys. Scenarios record observations; checks judge them.
import os, sys, json, re, time, shutil, subprocess, statistics, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

FIXF = os.path.join(H.FIX, 'fal')
STILL_EP, I2V_EP, R2V_EP = 'fal-ai/flux-pro/v1.1-ultra', 'minimax/h3-max/image-to-video', 'minimax/h3-max/reference-to-video'
PROMPT_TXT = 'ACC handheld video prompt — the screen stays completely black; keep the lighting of the first frame.'

# which scenarios feed which check (the self-test runs only what a planted fault needs)
CHECKS = {
    'gen.dry.still': ['dry'], 'gen.dry.no-network': ['dry'], 'gen.dry.no-files': ['dry'], 'gen.dry.datauri-display': ['dry'], 'gen.cost': ['dry'],
    'gen.still.go': ['still'], 'gen.video.i2v': ['i2v'], 'gen.video.defaults': ['i2v5'], 'gen.video.r2v': ['r2v'], 'gen.raw': ['raw'],
    'gen.log': ['still', 'i2v'], 'gen.poll.interval': ['still', 'i2v'], 'gen.download.curl': ['still', 'i2v'],
    'gen.overwrite': ['still', 'rerun'], 'gen.key.sources': ['keys'], 'gen.key.missing-exit3': ['keys'], 'gen.key.envfile-without-key': ['keys'],
    'gen.force-failure-intact': ['still', 'rerun'], 'gen.log-after-accept': ['errors'], 'gen.stray-args-exit2': ['stray'],
    'gen.errors.exit4': ['errors'], 'gen.timeout': ['fetch'], 'gen.fetch': ['fetch'],
    'gen.download.resume': ['resume'], 'gen.download.stall': ['stall'], 'gen.download.verify': ['short', 'corrupt'],
    'gen.download.exit5': ['exit5'], 'gen.key.never-leaks': ['dry', 'still', 'i2v', 'keys', 'errors', 'fetch'],
}
SLOW = {'exit5', 'corrupt'}


class Gen(object):
    def __init__(self, tool, run_dir, mock, report, tag='', extra_env=None, attempts=None, deny_write=()):
        self.tool, self.dir, self.m, self.R, self.tag = tool, run_dir, mock, report, tag
        self.deny = tuple(deny_write)
        self.all_logs = []
        self.extra = dict(extra_env or {})
        if attempts: self.extra['FAL_DL_ATTEMPTS'] = str(attempts)              # the as-built knob (oracle and stage)
        self.obs, self.runs, self.homes = {}, [], []
        self.log = os.path.join(run_dir, 'gen-runs.log')
        self.t_start = time.time()
        self.home = self.mkhome('home-default')                # no .env in it: only FAL_KEY / --env count

    def mkhome(self, name, env_text=None):
        h = os.path.join(self.dir, 'homes', name)
        os.makedirs(os.path.join(h, 'Downloads', 'launch-videos'), exist_ok=True)
        if env_text is not None:
            with open(os.path.join(h, 'Downloads', 'launch-videos', '.env'), 'w', encoding='utf-8') as f: f.write(env_text)
        self.homes.append(h)
        return h

    def gen(self, args, key='A', home=None, timeout=240, net='localhost', cwd=None, env_over=None):
        e = H.base_env(home=home or self.home, tmp=os.path.join(self.dir, 'tmp'))
        e['FAL_QUEUE_URL'] = self.m.api
        if key: e['FAL_KEY'] = {'A': H.KEY_A, 'B': H.KEY_B, 'C': H.KEY_C}[key]
        e.update(self.extra)
        if env_over: e.update(env_over)
        r = H.run([H.NODE, self.tool] + args, env=e, cwd=cwd or self.dir, timeout=timeout, net=net, deny_write=self.deny, log=self.log)
        self.runs.append(r)
        return r

    def w(self, *p):
        d = os.path.join(self.dir, *p)
        os.makedirs(d, exist_ok=True)
        return d

    def cdn_files(self, **modes):
        for name in ('still_0.jpg', 'still_1.jpg', 'still2_0.jpg', 'still2_1.jpg', 'clip.mp4', 'clip2.mp4', 'thumb.png'):
            kw = modes.get(name, {'mode': 'ok'})
            self.m.file(name, os.path.join(FIXF, name), ctype='video/mp4' if name.endswith('.mp4') else 'image/jpeg' if name.endswith('.jpg') else 'image/png', **kw)

    def lg(self):
        L = self.m.log()
        self.all_logs.append(L['log'])
        return L

    # ── scenarios ──
    def sc_dry(self):
        m = self.m; m.reset()
        pf = os.path.join(self.w('dry'), 'prompt.txt')
        with open(pf, 'w', encoding='utf-8') as f: f.write(PROMPT_TXT + '\n')
        runs = {
            'still': self.gen(['still', '--prompt', 'ACC still prompt, 35mm film still', '--out', os.path.join(self.w('dry', 'still'), 'key'), '--n', '2', '--aspect', '9:16', '--seed', '7510']),
            'still4': self.gen(['still', '--prompt', 'ACC four', '--out', os.path.join(self.w('dry', 'still4'), 'key'), '--n', '4']),
            'i2v': self.gen(['video', '--image', os.path.join(FIXF, 'key.jpg'), '--prompt', '@' + pf, '--out', os.path.join(self.w('dry', 'i2v'), 'clip.mp4'), '--sec', '6', '--seed', '5309']),
            'i2v5': self.gen(['video', '--image', os.path.join(FIXF, 'key.jpg'), '--prompt', 'ACC default length', '--out', os.path.join(self.w('dry', 'i2v5'), 'clip.mp4')]),
            'r2v': self.gen(['video', '--guide', os.path.join(FIXF, 'guide_5p4.mp4'), '--prompt', 'ACC guided', '--out', os.path.join(self.w('dry', 'r2v'), 'clip.mp4'), '--aspect', '16:9']),
            'raw': self.gen(['raw', 'fal-ai/acc-unknown-model', os.path.join(FIXF, 'raw_input.json'), '--out', os.path.join(self.w('dry', 'raw'), 'out.mp4')]),
        }
        runs['nonet'] = self.gen(['still', '--prompt', 'ACC no network at all', '--out', os.path.join(self.w('dry', 'nonet'), 'key')], net='none')
        L = self.lg()
        files = [p for p in glob.glob(os.path.join(self.dir, 'dry', '**', '*'), recursive=True) if os.path.isfile(p) and not p.endswith('prompt.txt')]
        self.obs['dry'] = {'runs': runs, 'conns': L['conns'], 'requests': len(L['log']), 'files': files, 'prompt_file': PROMPT_TXT}

    def go_run(self, name, args, scenario, cdn=None, timeout=240, key='A', home=None, env_over=None, reset=True):
        m = self.m
        if reset: m.reset()
        self.cdn_files(**(cdn or {}))
        m.scenario(**scenario)
        r = self.gen(args, timeout=timeout, key=key, home=home, env_over=env_over)
        L = self.lg()
        return {'run': r, 'log': L['log'], 'conns': L['conns']}

    def sc_still(self):
        d = self.w('still'); pre = os.path.join(d, 'key')
        res = {'images': [{'url': '$CDN/still_0.jpg', 'width': 512, 'height': 912, 'content_type': 'image/jpeg'}, {'url': '$CDN/still_1.jpg', 'width': 512, 'height': 912, 'content_type': 'image/jpeg'}],
               'timings': {}, 'seed': 7510, 'has_nsfw_concepts': [False, False], 'prompt': 'ACC still go'}
        o = self.go_run('still', ['still', '--prompt', 'ACC still go', '--out', pre, '--aspect', '9:16', '--seed', '7510', '--go'], {'result': res})
        o['prefix'] = pre
        o['md5'] = {p: H.md5_file(p) for p in glob.glob(pre + '_*')}            # snapshot: the re-run scenario replaces them
        o['size'] = {p: os.path.getsize(p) for p in glob.glob(pre + '_*')}
        lf = pre + '.fal.json'
        o['logtext'] = open(lf, encoding='utf-8', errors='replace').read() if os.path.exists(lf) else None
        self.obs['still'] = o

    def sc_rerun(self):
        pre = self.obs['still']['prefix']; d = os.path.dirname(pre)
        names = [pre + '_0.jpg', pre + '_1.jpg', pre + '.fal.json']
        snap = lambda: {os.path.basename(p): (H.md5_file(p), os.path.getmtime(p)) for p in names if os.path.exists(p)}
        before = snap(); listing0 = sorted(os.listdir(d))
        res2 = {'images': [{'url': '$CDN/still2_0.jpg'}, {'url': '$CDN/still2_1.jpg'}]}
        o1 = self.go_run('rerun', ['still', '--prompt', 'ACC still go', '--out', pre, '--aspect', '9:16', '--seed', '7510', '--go'], {'result': res2})
        after = snap()
        # a forced run that fal rejects must leave the old outputs and the old log exactly where they were
        of = self.go_run('force-fail', ['still', '--prompt', 'ACC still go', '--out', pre, '--aspect', '9:16', '--seed', '7510', '--go', '--force'],
                         {'submitError': {'code': 422, 'body': {'detail': [{'msg': 'ACC-F1 rejected', 'type': 'value_error'}]}}})
        after_fail = snap(); listing1 = sorted(os.listdir(d))
        o2 = self.go_run('force', ['still', '--prompt', 'ACC still go', '--out', pre, '--aspect', '9:16', '--seed', '7510', '--go', '--force'], {'result': res2})
        forced = {os.path.basename(p): H.md5_file(p) for p in names[:2] if os.path.exists(p)}
        prev = sorted(f for f in os.listdir(d) if 'prev' in f)
        self.obs['rerun'] = {'plain': o1, 'before': before, 'after': after, 'force': o2, 'forced': forced, 'force_fail': of, 'after_fail': after_fail,
                             'listing0': listing0, 'listing1': listing1, 'prev': prev}

    def sc_stray(self):
        self.m.reset(); d = self.w('stray')
        r1 = self.gen(['still', 'stray-word', '--prompt', 'ACC stray', '--out', os.path.join(d, 'k')])
        self.cdn_files(); self.m.scenario(result={'video': {'url': '$CDN/clip.mp4'}})
        r2 = self.gen(['video', '--image', os.path.join(FIXF, 'key.jpg'), os.path.join(FIXF, 'still_0.jpg'), '--prompt', 'ACC stray go', '--out', os.path.join(d, 'c.mp4'), '--go'])
        L = self.lg()
        self.obs['stray'] = {'r1': r1, 'r2': r2, 'requests': len([x for x in L['log'] if x.get('port') == 'api']), 'files': sorted(os.listdir(d))}

    def sc_i2v(self):
        d = self.w('i2v'); pf = os.path.join(d, 'prompt.txt')
        with open(pf, 'w', encoding='utf-8') as f: f.write(PROMPT_TXT + '\n')
        res = {'video': {'url': '$CDN/clip.mp4', 'content_type': 'video/mp4', 'file_name': 'clip.mp4', 'file_size': os.path.getsize(os.path.join(FIXF, 'clip.mp4'))}, 'expanded_prompt': None, 'timings': {'inference': 3.3}}
        out = os.path.join(d, 'clip.mp4')
        o = self.go_run('i2v', ['video', '--image', os.path.join(FIXF, 'key.jpg'), '--prompt', '@' + pf, '--out', out, '--sec', '6', '--seed', '5309', '--go'], {'result': res})
        o['out'] = out
        self.obs['i2v'] = o

    def sc_i2v5(self):
        out = os.path.join(self.w('i2v5'), 'clip.mp4')
        o = self.go_run('i2v5', ['video', '--image', os.path.join(FIXF, 'key.jpg'), '--prompt', 'ACC defaults', '--out', out, '--go'], {'result': {'video': {'url': '$CDN/clip.mp4'}}})
        o['out'] = out
        self.obs['i2v5'] = o

    def sc_r2v(self):
        res = {'video': {'url': '$CDN/clip.mp4'}}
        o = {}
        for name, guide in (('g54', 'guide_5p4.mp4'), ('g3', 'guide_3.mp4'), ('g16', 'guide_16.mp4')):
            out = os.path.join(self.w('r2v', name), 'clip.mp4')
            o[name] = self.go_run(name, ['video', '--guide', os.path.join(FIXF, guide), '--prompt', 'ACC guided ' + name, '--out', out, '--aspect', '16:9', '--go'], {'result': res})
            o[name]['out'] = out
        self.obs['r2v'] = o

    def sc_raw(self):
        d = self.w('raw')
        for f in ('key.jpg', 'guide_3.mp4', 'raw_input.json'): shutil.copyfile(os.path.join(FIXF, f), os.path.join(d, f))
        out = os.path.join(d, 'out.mp4')
        res = {'video': {'url': '$CDN/clip.mp4'}, 'extras': {'thumb': {'url': '$CDN/thumb.png', 'content_type': 'image/png'}}, 'seed': 11}
        o = self.go_run('raw', ['raw', I2V_EP, os.path.join(d, 'raw_input.json'), '--out', out, '--go'], {'result': res})
        o['dir'] = d; o['out'] = out
        self.obs['raw'] = o

    def sc_keys(self):
        res = {'images': [{'url': '$CDN/still_0.jpg'}]}
        k = {}
        envb = os.path.join(self.w('keys'), 'b.env')
        with open(envb, 'w', encoding='utf-8') as f: f.write("# test key file\nFAL_KEY='%s'\n" % H.KEY_B)
        k['precedence'] = self.go_run('kp', ['still', '--prompt', 'ACC key precedence', '--n', '1', '--out', os.path.join(self.w('keys', 'p'), 'k'), '--env', envb, '--go'], {'result': res}, key='A')
        k['envfile'] = self.go_run('ke', ['still', '--prompt', 'ACC key from --env', '--n', '1', '--out', os.path.join(self.w('keys', 'e'), 'k'), '--env', envb, '--go'], {'result': res}, key=None)
        hc = self.mkhome('home-c', 'export FAL_KEY="%s"\n' % H.KEY_C)
        k['default'] = self.go_run('kd', ['still', '--prompt', 'ACC key from the default .env', '--n', '1', '--out', os.path.join(self.w('keys', 'd'), 'k'), '--go'], {'result': res}, key=None, home=hc)
        k['envvar'] = self.go_run('kv', ['still', '--prompt', 'ACC exported key beats the default .env', '--n', '1', '--out', os.path.join(self.w('keys', 'v'), 'k'), '--go'], {'result': res}, key='A', home=hc)
        he = self.mkhome('home-empty')
        k['missing'] = self.go_run('km', ['still', '--prompt', 'ACC no key', '--n', '1', '--out', os.path.join(self.w('keys', 'm'), 'k'), '--go'], {'result': res}, key=None, home=he)
        envn = os.path.join(self.w('keys'), 'nokey.env')
        with open(envn, 'w', encoding='utf-8') as f: f.write('# an env file without the key line\nOTHER_TOKEN=nothing-here\n')
        k['envnokey'] = self.go_run('kn', ['still', '--prompt', 'ACC --env without a key line', '--n', '1', '--out', os.path.join(self.w('keys', 'n'), 'k'), '--env', envn, '--go'], {'result': res}, key='A', home=hc)
        self.obs['keys'] = k

    def sc_errors(self):
        e = {}
        sc = {
            'E1': {'submitError': {'code': 422, 'body': {'detail': [{'loc': ['body', 'prompt'], 'msg': 'ACC-E1 prompt is too long', 'type': 'value_error'}]}}},
            'E2': {'timeline': [[0, 'IN_QUEUE'], [1, 'COMPLETED']], 'statusFinal': {'status': 'FAILED', 'error': 'ACC-E2 generation failed on the worker'}},
            'E3': {'timeline': [[0, 'IN_QUEUE'], [1, 'COMPLETED']], 'resultError': {'code': 422, 'body': {'detail': [{'msg': 'ACC-E3 content policy violation', 'type': 'content_policy_violation'}]}}},
            'E4': {'timeline': [[0, 'IN_QUEUE'], [1, 'COMPLETED']], 'result': {'detail': 'ACC-E4 the output was withheld'}},
            'E5': {'submitError': {'code': 401, 'body': {'detail': 'ACC-E5 Invalid API key'}}},
        }
        for name, s in sc.items():
            e[name] = self.go_run(name, ['still', '--prompt', 'ACC error ' + name, '--n', '1', '--out', os.path.join(self.w('errors', name), 'k'), '--go'], s, timeout=120)
        self.obs['errors'] = e

    def sc_fetch(self):
        out = os.path.join(self.w('fetch'), 'clip.mp4')
        o = self.go_run('timeout', ['video', '--image', os.path.join(FIXF, 'key.jpg'), '--prompt', 'ACC held', '--out', out, '--timeout', '5', '--go'],
                        {'hold': True, 'result': {'video': {'url': '$CDN/clip.mp4'}}}, timeout=90)
        subs = [x for x in o['log'] if x.get('endpoint')]
        rid = subs[-1]['request_id'] if subs else None
        f = None
        if rid:
            self.m.complete(rid)
            r = self.gen(['fetch', rid, '--endpoint', I2V_EP, '--out', out], timeout=180)
            L = self.lg()
            f = {'run': r, 'log': L['log']}
        self.obs['fetch'] = {'timeout': o, 'rid': rid, 'fetch': f, 'out': out}

    def _dl(self, name, cdnmode, timeout):
        out = os.path.join(self.w(name), 'clip.mp4')
        o = self.go_run(name, ['video', '--image', os.path.join(FIXF, 'key.jpg'), '--prompt', 'ACC download ' + name, '--out', out, '--go'],
                        {'result': {'video': {'url': '$CDN/clip.mp4', 'file_size': os.path.getsize(os.path.join(FIXF, 'clip.mp4'))}}}, cdn={'clip.mp4': cdnmode}, timeout=timeout)
        o['out'] = out
        self.obs[name] = o

    def sc_resume(self): self._dl('resume', {'mode': 'cut-unless-range', 'cutAt': .4, 'stallMs': 150}, 240)
    def sc_stall(self): self._dl('stall', {'mode': 'stall', 'cutAt': .5, 'stallMs': 6000, 'failTimes': 1}, 120)
    def sc_short(self): self._dl('short', {'mode': 'short', 'cutAt': .6, 'failTimes': 1}, 300)
    def sc_corrupt(self): self._dl('corrupt', {'mode': 'corrupt'}, 1800)
    def sc_exit5(self): self._dl('exit5', {'mode': 'fail503'}, 1800)

    # ── checks ──
    def judge(self, cid):
        f = getattr(self, 'ck_' + cid.replace('gen.', '').replace('.', '_').replace('-', '_'))
        try:
            return f()
        except KeyError as e:
            return None, 'scenario %s did not run' % e
        except Exception as e:
            return False, 'check crashed: %s: %s' % (type(e).__name__, e)

    def _sub(self, log, ep=None):
        s = [x for x in log if x.get('port') == 'api' and x.get('endpoint')]
        return [x for x in s if ep is None or x['endpoint'] == ep]

    def ck_dry_still(self):
        r = self.obs['dry']['runs']['still']; t = r.text
        need = [('exit 0', r.rc == 0), ('endpoint', STILL_EP in t), ('prompt', 'ACC still prompt, 35mm film still' in t), ('raw true', re.search(r'"?raw"?\s*:\s*true', t)),
                ('jpeg', re.search(r'"?output_format"?\s*:\s*"?jpeg', t)), ('num_images 2', re.search(r'"?num_images"?\s*:\s*2', t)), ('seed', '7510' in t),
                ('aspect 9:16', '9:16' in t), ('"dry run"', re.search(r'dry run', t, re.I)), ('"--go"', '--go' in t)]
        miss = [n for n, ok in need if not ok]
        return not miss, ('missing: ' + ', '.join(miss) + ' | ' + r.brief(200)) if miss else 'endpoint, input (raw/jpeg/2 images/seed), dry-run line all printed; exit 0'

    def ck_dry_no_network(self):
        o = self.obs['dry']; n = o['conns']['api'] + o['conns']['cdn']; nn = o['runs']['nonet']
        bad = []
        if n: bad.append('%d connection(s) reached the mock during dry runs' % n)
        if nn.rc != 0: bad.append('dry run with ALL network blocked exited %s (%s)' % (nn.rc, nn.brief(120)))
        return not bad, '; '.join(bad) or '7 dry runs, 0 connections; still exits 0 with the network blocked'

    def ck_dry_no_files(self):
        f = self.obs['dry']['files']
        return not f, ('dry runs wrote %s' % [os.path.relpath(x, self.dir) for x in f][:5]) if f else 'no files written by any dry run'

    def ck_dry_datauri_display(self):
        r = self.obs['dry']['runs']['i2v']; t = r.text
        ok = re.search(r'<file key\.jpg, *\d+ *KB>', t) and 'base64' not in t and PROMPT_TXT in t
        r2 = self.obs['dry']['runs']['r2v'].text
        ok2 = re.search(r'<file guide_5p4\.mp4, *\d+ *KB>', r2) and 'base64' not in r2
        return bool(ok and ok2), 'image/guide shown as <file NAME, N KB>, prompt read from @file, no base64' if ok and ok2 else 'i2v/r2v dry run: %s | %s' % (r.brief(160), self.obs['dry']['runs']['r2v'].brief(120))

    def ck_cost(self):
        R = self.obs['dry']['runs']
        want = [('still ×2 $0.12', 'still', r'\$0?\.12\b'), ('still ×4 $0.24', 'still4', r'\$0?\.24\b'), ('i2v 6 s $0.96', 'i2v', r'\$0?\.96\b'), ('i2v default 5 s $0.80', 'i2v5', r'\$0?\.80?\b'),
                ('r2v 5.4 s guide → 6 s $0.96', 'r2v', r'\$0?\.96\b'), ('unknown endpoint', 'raw', r'unknown\s*[—–-]+\s*check fal\.ai/models'), ('dated', 'still', r'checked 2026-10-22'), ('dated', 'i2v', r'checked 2026-10-22')]
        miss = [n for n, k, rx in want if not re.search(rx, R[k].text)]
        return not miss, ('missing ' + ', '.join(miss)) if miss else 'all estimates right ($0.12 / $0.24 / $0.96 / $0.80 / $0.96 / unknown), dated 2026-10-22'

    def _files_ok(self, pairs, snap=None):
        bad = []
        for path, fx in pairs:
            got = (snap or {}).get(path) if snap is not None else (H.md5_file(path) if os.path.exists(path) else None)
            if got is None: bad.append('%s missing' % os.path.basename(path))
            elif got != H.md5_file(os.path.join(FIXF, fx)): bad.append('%s ≠ served %s' % (os.path.basename(path), fx))
        return bad

    def ck_still_go(self):
        o = self.obs['still']; r = o['run']; subs = self._sub(o['log'])
        if not subs: return False, 'no submit reached the mock (rc %s: %s)' % (r.rc, r.brief(200))
        s = subs[-1]; b = s['body'] or {}
        want = {'prompt': 'ACC still go', 'aspect_ratio': '9:16', 'raw': True, 'num_images': 2, 'output_format': 'jpeg', 'seed': 7510}
        bad = ['%s=%r (want %r)' % (k, b.get(k), v) for k, v in want.items() if b.get(k) != v]
        if s['endpoint'] != STILL_EP: bad.append('endpoint %s' % s['endpoint'])
        if s['auth'] != 'a': bad.append('Authorization %s (want Key <FAL_KEY>)' % s['auth'])
        bad += self._files_ok([(o['prefix'] + '_0.jpg', 'still_0.jpg'), (o['prefix'] + '_1.jpg', 'still_1.jpg')], snap=o['md5'])
        if r.rc != 0: bad.append('exit %s' % r.rc)
        if not re.search(r'\$0?\.12\b', r.text): bad.append('estimate not printed again with --go')
        return not bad, '; '.join(bad) or 'POST %s with %s; Key auth; key_0.jpg/key_1.jpg = served bytes; exit 0' % (STILL_EP, sorted(b))

    def ck_video_i2v(self):
        o = self.obs['i2v']; r = o['run']; subs = self._sub(o['log'])
        if not subs: return False, 'no submit reached the mock (rc %s: %s)' % (r.rc, r.brief(200))
        s = subs[-1]; b = s['body'] or {}; bad = []
        if s['endpoint'] != I2V_EP: bad.append('endpoint %s' % s['endpoint'])
        iu = b.get('image_url')
        if not (isinstance(iu, dict) and iu.get('datauri') and iu.get('md5') == H.md5_file(os.path.join(FIXF, 'key.jpg')) and iu.get('mime') == 'image/jpeg'): bad.append('image_url %s (want a data URI of key.jpg)' % iu)
        want = {'prompt': PROMPT_TXT, 'duration': 6, 'resolution': '1080P', 'prompt_expansion_mode': 'disabled', 'seed': 5309, 'enable_safety_checker': True}
        bad += ['%s=%r (want %r)' % (k, b.get(k), v) for k, v in want.items() if b.get(k) != v]
        bad += self._files_ok([(o['out'], 'clip.mp4')])
        if not (re.search(r'audio', r.out, re.I) and re.search(r'24\s*fps', r.out, re.I)): bad.append('success line doesn\'t mention the model\'s audio + 24 fps')
        if r.rc != 0: bad.append('exit %s' % r.rc)
        return not bad, '; '.join(bad) or 'image-to-video with every field from today\'s requests; key frame as data URI; clip = served bytes; success line names audio + 24 fps'

    def ck_video_defaults(self):
        o = self.obs['i2v5']; subs = self._sub(o['log'])
        if not subs: return False, 'no submit (rc %s: %s)' % (o['run'].rc, o['run'].brief(160))
        b = subs[-1]['body'] or {}
        ok = b.get('duration') == 5 and b.get('resolution') == '1080P' and b.get('prompt_expansion_mode') == 'disabled' and b.get('enable_safety_checker') is True
        return ok, 'defaults duration=%r resolution=%r prompt_expansion_mode=%r enable_safety_checker=%r' % (b.get('duration'), b.get('resolution'), b.get('prompt_expansion_mode'), b.get('enable_safety_checker'))

    def ck_video_r2v(self):
        o = self.obs['r2v']; bad = []
        for name, guide, dur in (('g54', 'guide_5p4.mp4', 6), ('g3', 'guide_3.mp4', 5)):
            subs = self._sub(o[name]['log'])
            if not subs: bad.append('%s: no submit (rc %s %s)' % (guide, o[name]['run'].rc, o[name]['run'].brief(100))); continue
            s = subs[-1]; b = s['body'] or {}
            if s['endpoint'] != R2V_EP: bad.append('%s endpoint %s' % (guide, s['endpoint']))
            rv = b.get('reference_video_urls')
            if not (isinstance(rv, list) and len(rv) == 1 and isinstance(rv[0], dict) and rv[0].get('md5') == H.md5_file(os.path.join(FIXF, guide)) and rv[0].get('mime') == 'video/mp4'):
                bad.append('%s reference_video_urls %s' % (guide, rv))
            for k, v in (('duration', dur), ('aspect_ratio', '16:9'), ('resolution', '1080P'), ('prompt_expansion_mode', 'disabled'), ('enable_safety_checker', True)):
                if b.get(k) != v: bad.append('%s %s=%r (want %r)' % (guide, k, b.get(k), v))
        g16 = o['g16']
        if g16['run'].rc == 0 or self._sub(g16['log']): bad.append('a 16 s guide was not refused (rc %s, %d submit)' % (g16['run'].rc, len(self._sub(g16['log']))))
        return not bad, '; '.join(bad) or '5.4 s guide → duration 6, 3 s → 5 (min), guide as data URI, 16:9; a 16 s guide refused before any request (exit %s)' % g16['run'].rc

    def ck_raw(self):
        o = self.obs['raw']; r = o['run']; subs = self._sub(o['log']); bad = []
        if not subs: return False, 'no submit (rc %s: %s)' % (r.rc, r.brief(200))
        b = subs[-1]['body'] or {}
        iu = b.get('image_url'); rv = b.get('reference_video_urls')
        if not (isinstance(iu, dict) and iu.get('md5') == H.md5_file(os.path.join(FIXF, 'key.jpg'))): bad.append('image_url "@key.jpg" not sent as a data URI (%s)' % iu)
        if not (isinstance(rv, list) and rv and isinstance(rv[0], dict) and rv[0].get('md5') == H.md5_file(os.path.join(FIXF, 'guide_3.mp4'))): bad.append('reference_video_urls ["@guide_3.mp4"] not data URIs (%s)' % rv)
        if b.get('note') != '@key.jpg': bad.append('"note" (not a *_url field) was changed to %r' % (b.get('note') if not isinstance(b.get('note'), dict) else 'a data URI'))
        if b.get('prompt') != 'acc raw request' or b.get('seed') != 11: bad.append('other fields changed: %s' % {k: b.get(k) for k in ('prompt', 'seed')})
        if subs[-1]['endpoint'] != I2V_EP: bad.append('endpoint %s' % subs[-1]['endpoint'])
        have = {H.md5_file(p) for p in glob.glob(os.path.join(o['dir'], '**', '*'), recursive=True) if os.path.isfile(p)}
        for fx in ('clip.mp4', 'thumb.png'):
            if H.md5_file(os.path.join(FIXF, fx)) not in have: bad.append('output %s ({url} leaf) not downloaded' % fx)
        if r.rc != 0: bad.append('exit %s' % r.rc)
        return not bad, '; '.join(bad) or '"@file" → data URI only in *_url/*_urls fields; both {url} leaves (video.url, extras.thumb.url) downloaded'

    def ck_log(self):
        bad = []
        for name, logf, files in (('still', self.obs['still']['prefix'] + '.fal.json', [self.obs['still']['prefix'] + '_0.jpg', self.obs['still']['prefix'] + '_1.jpg']),
                                  ('i2v', os.path.splitext(self.obs['i2v']['out'])[0] + '.fal.json', [self.obs['i2v']['out']])):
            raw = self.obs['still']['logtext'] if name == 'still' else (open(logf, encoding='utf-8', errors='replace').read() if os.path.exists(logf) else None)
            if raw is None: bad.append('%s: no %s' % (name, os.path.basename(logf))); continue
            try: j = json.loads(raw)
            except ValueError: bad.append('%s: log is not JSON' % name); continue
            flat = H.flatten(j); vals = [str(v) for _, v in flat]; keys = ' '.join(p for p, _ in flat).lower()
            subs = self._sub(self.obs[name]['log']); rid = subs[-1]['request_id'] if subs else '?'
            ep = STILL_EP if name == 'still' else I2V_EP
            if ep not in vals: bad.append('%s: endpoint missing' % name)
            if rid not in vals: bad.append('%s: request_id missing' % name)
            if 'data:' in raw or 'base64' in raw: bad.append('%s: a data URI is in the log' % name)
            if name == 'i2v' and not re.search(r'<file key\.jpg', raw): bad.append('i2v: input image not logged as <file key.jpg>')
            for k in ('submit', 'finish', 'estimate'):
                if k not in keys: bad.append('%s: no %s field' % (name, k))
            urls = [x['path'] for x in self.obs[name]['log'] if x.get('port') == 'cdn']
            if not any(u.split('/')[-1] in raw for u in urls): bad.append('%s: output URLs missing' % name)
            for fpath in files:
                sz = self.obs['still']['size'].get(fpath, -1) if name == 'still' else (os.path.getsize(fpath) if os.path.exists(fpath) else -1)
                if os.path.basename(fpath) not in raw or str(sz) not in raw: bad.append('%s: local file %s with its size (%d) not logged' % (name, os.path.basename(fpath), sz))
            if re.search(r'"auth"\s*:\s*"Key (?!\*+")', raw): bad.append('%s: auth logged beyond "Key ****"' % name)
        return not bad, '; '.join(bad) or '.fal.json: endpoint, input (<file NAME>, no data URI), request_id, submitted/finished, estimate, output URLs, files with sizes'

    def ck_poll_interval(self):
        iv = []
        for name in ('still', 'i2v'):
            st = [x for x in self.obs[name]['log'] if x.get('kind') == 'status']
            ts = [x['t'] for x in st]
            iv += [b - a for a, b in zip(ts, ts[1:])]
        if not iv: return False, 'fewer than two status polls per request (polls: %s)' % iv
        med = statistics.median(iv)
        return 2.5 <= med <= 4.5, 'status polled every %.2f s (median of %d gaps; spec: 3 s)' % (med, len(iv))

    def ck_download_curl(self):
        gets = [x for n in ('still', 'i2v') for x in self.obs[n]['log'] if x.get('port') == 'cdn' and x.get('method') == 'GET']
        if not gets: return False, 'no downloads seen'
        bad = [g for g in gets if not g['ua'].startswith('curl/')]
        hv = sorted({g['httpVersion'] for g in gets})
        return not bad, ('%d download(s) not made by curl: %s' % (len(bad), [g['ua'][:20] for g in bad[:3]])) if bad else '%d downloads by curl (HTTP/%s)' % (len(gets), '/'.join(hv))

    def ck_overwrite(self):
        o = self.obs['rerun']; p = o['plain']; bad = []
        if p['run'].rc != 2: bad.append('re-run exited %s (want 2)' % p['run'].rc)
        if self._sub(p['log']): bad.append('re-run submitted a new request (spends money) before refusing')
        if o['before'] != o['after']: bad.append('re-run touched the existing outputs')
        f = o['force']
        want = {'key_0.jpg': H.md5_file(os.path.join(FIXF, 'still2_0.jpg')), 'key_1.jpg': H.md5_file(os.path.join(FIXF, 'still2_1.jpg'))}
        if f['run'].rc != 0 or o['forced'] != want:
            bad.append('--force did not cleanly replace the outputs (rc %s)%s' % (f['run'].rc, '; a resumed download (curl -C -) appended the new file to the old one' if any(r.get('range') for r in f['log'] if r.get('port') == 'cdn') else ''))
        return not bad, '; '.join(bad) or 're-run: exit 2, no request, files untouched; --force replaced them%s' % (' (old ones kept as %s)' % ', '.join(o['prev']) if o['prev'] else '')

    def ck_force_failure_intact(self):
        o = self.obs['rerun']; f = o['force_fail']; bad = []
        if f['run'].rc == 0: bad.append('a forced run fal rejected exited 0')
        if o['after_fail'] != o['after']: bad.append('the rejected forced run changed the old outputs/log: %s → %s' % (sorted(o['after']), sorted(o['after_fail'])))
        if o['listing1'] != o['listing0']: bad.append('files moved/added: %s' % sorted(set(o['listing1']) ^ set(o['listing0'])))
        return not bad, '; '.join(bad) or '--force rejected by fal (422) → exit %s, key_0/1.jpg and key.fal.json untouched, nothing moved' % f['run'].rc

    def ck_log_after_accept(self):
        e = self.obs['errors']; bad = []
        for name in ('E1', 'E5'):
            lf = os.path.join(self.dir, 'errors', name, 'k.fal.json')
            if os.path.exists(lf): bad.append('%s (submit rejected, no request_id): wrote %s' % (name, os.path.basename(lf)))
        return not bad, '; '.join(bad) or 'no .fal.json when fal rejects the submit (422, 401): the log is written only once there is a request_id'

    def ck_stray_args_exit2(self):
        o = self.obs['stray']; bad = []
        if o['r1'].rc != 2: bad.append('`still stray-word …` exit %s (want 2)' % o['r1'].rc)
        if o['r2'].rc != 2: bad.append('`video --image a.jpg b.jpg … --go` exit %s (want 2)' % o['r2'].rc)
        if o['requests']: bad.append('%d request(s) reached fal' % o['requests'])
        if o['files']: bad.append('wrote %s' % o['files'])
        return not bad, '; '.join(bad) or 'stray positional arguments → exit 2 before any request or file (%s)' % o['r1'].brief(90)

    def ck_key_sources(self):
        k = self.obs['keys']; bad = []
        for name, want, what in (('precedence', 'b', '--env FILE beats an exported FAL_KEY'), ('envfile', 'b', "--env FILE (FAL_KEY='…')"),
                                 ('envvar', 'a', 'an exported FAL_KEY beats ~/Downloads/launch-videos/.env'), ('default', 'c', '~/Downloads/launch-videos/.env (export FAL_KEY="…") via $HOME')):
            subs = self._sub(k[name]['log'])
            got = subs[-1]['auth'] if subs else 'no request (rc %s: %s)' % (k[name]['run'].rc, k[name]['run'].brief(100))
            if got != want: bad.append('%s: sent %s' % (what, 'key %s' % got.upper() if len(got) == 1 else got))
        return not bad, '; '.join(bad) or '--env FILE > FAL_KEY env > ~/Downloads/launch-videos/.env (lead\'s order of 2026-10-22); quotes and "export " parsed'

    def ck_key_envfile_without_key(self):
        o = self.obs['keys']['envnokey']; r = o['run']; bad = []
        if r.rc != 3: bad.append('exit %s (want 3)' % r.rc)
        subs = self._sub(o['log'])
        if subs: bad.append('it fell back and sent a request with key %s' % subs[-1]['auth'].upper())
        return not bad, '; '.join(bad) or '--env FILE without a FAL_KEY line + FAL_KEY exported → exit 3, nothing sent (%s)' % r.brief(120)

    def ck_key_missing_exit3(self):
        o = self.obs['keys']['missing']; r = o['run']; bad = []
        if r.rc != 3: bad.append('exit %s (want 3)' % r.rc)
        if self._sub(o['log']): bad.append('it still sent a request')
        if not (re.search(r'FAL_KEY', r.text) and re.search(r'\.env', r.text)): bad.append('message doesn\'t say where the key goes (%s)' % r.brief(160))
        return not bad, '; '.join(bad) or 'exit 3: %s' % r.brief(160)

    def ck_errors_exit4(self):
        e = self.obs['errors']; bad = []
        for name in ('E1', 'E2', 'E3', 'E4', 'E5'):
            r = e[name]['run']; subs = self._sub(e[name]['log']); rid = subs[-1].get('request_id') if subs else None
            if r.rc != 4: bad.append('%s exit %s' % (name, r.rc))
            if 'ACC-' + name not in r.text: bad.append('%s: fal\'s message not printed' % name)
            if rid and rid not in r.text: bad.append('%s: request_id not printed' % name)
        return not bad, '; '.join(bad) or 'HTTP 422/401 on submit, status FAILED, HTTP 422 on the result, a result "detail": exit 4 with fal\'s message (+ request_id)'

    def ck_timeout(self):
        o = self.obs['fetch']; r = o['timeout']['run']; bad = []
        if r.rc == 0: bad.append('exit 0 on a request that never finished')
        if r.timed_out or r.secs > 60: bad.append('--timeout 5 not honoured (%.0f s)' % r.secs)
        if not o['rid'] or o['rid'] not in r.text: bad.append('request_id not printed, so fetch can\'t pick it up')
        return not bad, '; '.join(bad) or 'gave up after %.0f s (exit %s) and printed the request_id' % (r.secs, r.rc)

    def ck_fetch(self):
        o = self.obs['fetch']
        if not o['fetch']: return False, 'no request to fetch'
        r = o['fetch']['run']; bad = []
        if r.rc != 0: bad.append('exit %s (%s)' % (r.rc, r.brief(160)))
        if not os.path.exists(o['out']) or H.md5_file(o['out']) != H.md5_file(os.path.join(FIXF, 'clip.mp4')): bad.append('output missing or ≠ served bytes')
        st = [x for x in o['fetch']['log'] if x.get('kind') in ('status', 'result') and x.get('request_id') == o['rid']]
        if not st: bad.append('never polled the request')
        elif any(x['auth'] != 'a' for x in st): bad.append('polled without the key')
        return not bad, '; '.join(bad) or 'fetch %s re-polled (%s) and downloaded the clip' % (o['rid'][:13], ', '.join(sorted({x['prefix'] + '/…' for x in st})))

    def _gets(self, name):
        return [x for x in self.obs[name]['log'] if x.get('port') == 'cdn' and x.get('method') == 'GET' and x.get('file') == 'clip.mp4']

    def ck_download_resume(self):
        o = self.obs['resume']; r = o['run']; g = self._gets('resume')
        rng = [x['range'] for x in g if x.get('range') and re.match(r'bytes=[1-9]\d*-', x['range'])]
        ok = r.rc == 0 and os.path.exists(o['out']) and H.md5_file(o['out']) == H.md5_file(os.path.join(FIXF, 'clip.mp4')) and rng
        return bool(ok), '%s after %.0f s; %d GETs, resumed with %s' % ('complete' if ok else 'NOT resumed (rc %s, %s)' % (r.rc, r.brief(120)), r.secs, len(g), rng[:2] or 'no Range request')

    def ck_download_stall(self):
        o = self.obs['stall']; r = o['run']; g = self._gets('stall')
        ok = r.rc == 0 and H.md5_file(o['out']) == H.md5_file(os.path.join(FIXF, 'clip.mp4')) if os.path.exists(o['out']) else False
        return bool(ok and len(g) == 1), '6 s mid-file stall: %s, %d GET(s)%s' % ('waited out' if ok else 'rc %s' % r.rc, len(g), ' (a speed-limit cut-off re-requested it)' if len(g) > 1 else '')

    def ck_download_verify(self):
        bad, info = [], []
        good = H.md5_file(os.path.join(FIXF, 'clip.mp4'))
        if 'short' in self.obs:
            o = self.obs['short']; r = o['run']; got = H.md5_file(o['out']) if os.path.exists(o['out']) else None
            if r.rc == 0 and got != good: bad.append('a truncated download (clean early end, no Content-Length) was accepted')
            info.append('truncated → exit %s, %s' % (r.rc, 'file correct' if got == good else 'no file' if got is None else 'file WRONG'))
        if 'corrupt' in self.obs:
            o = self.obs['corrupt']; r = o['run']
            if r.rc == 0: bad.append('unreadable (corrupt) video accepted with exit 0')
            info.append('corrupt → exit %s in %.0f s' % (r.rc, r.secs))
        return not bad, '; '.join(bad + info)

    def ck_download_exit5(self):
        o = self.obs['exit5']; r = o['run']
        url = [x['path'] for x in o['log'] if x.get('port') == 'cdn']
        ok = r.rc == 5 and url and url[0].split('/')[-1] in r.text
        return bool(ok), 'CDN always 503: exit %s after %.0f s, %d download attempts%s' % (r.rc, r.secs, len(url), '' if ok else ' — want exit 5 and the URL printed (%s)' % r.brief(160))

    def ck_key_never_leaks(self):
        hits = []
        for r in self.runs:
            h = H.scan_for_key(r.text.encode('utf-8', 'replace'))
            if h: hits.append('stdout/stderr of `%s`' % ' '.join(str(c) for c in r.cmd[2:4]))
        for d in [self.dir] + self.homes:
            for p, h in H.scan_tree(d):
                if p.endswith('gen-runs.log') or '/homes/' in p and p.endswith('/.env') or p.endswith('b.env'): continue
                hits.append(os.path.relpath(p, self.dir))
        try:
            fs = subprocess.run(['/usr/bin/find', '/private/tmp', '-type', 'f', '-newermt', time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(self.t_start)), '-size', '-64M'],
                                capture_output=True, timeout=60).stdout.decode('utf-8', 'replace').split('\n')
            for p in fs:
                if p and '/acceptance/' not in p:
                    for q, h in H.scan_tree(p): hits.append(q)
        except Exception:
            pass
        cdn_auth = [x for L in self.all_logs for x in L if x.get('port') == 'cdn' and x.get('hasAuth')]
        if cdn_auth: hits.append('%d download(s) sent the key to the file host' % len(cdn_auth))
        return not hits, ('key found in: ' + '; '.join(hits[:6])) if hits else 'no 12-char window of the fake keys in any stdout/stderr, written file, fake HOME, TMPDIR or new /private/tmp file; downloads carry no Authorization'


def scenarios_for(checks):
    order = ['dry', 'still', 'rerun', 'i2v', 'i2v5', 'r2v', 'raw', 'keys', 'errors', 'stray', 'fetch', 'resume', 'stall', 'short', 'corrupt', 'exit5']
    need = set()
    for c in checks: need |= set(CHECKS[c])
    if 'rerun' in need: need.add('still')
    return [s for s in order if s in need]


def run_suite(tool, run_dir, report, checks=None, tag='', extra_env=None, attempts=None, slow=True, quiet_ids=False, deny_write=()):
    """runs the scenarios the given checks need, returns {check: (ok, detail)}"""
    checks = checks or list(CHECKS)
    if not slow: checks = [c for c in checks if not set(CHECKS[c]) <= SLOW]
    os.makedirs(run_dir, exist_ok=True)
    if not H.sandbox_ok():
        for c in checks: report.add(c, None, 'sandbox-exec unavailable: gen.mjs is never run without it (real-key safety)', tag)
        return {}
    m = H.Mock(os.path.join(run_dir, 'mock'), FIXF)
    g = Gen(tool, run_dir, m, report, tag, extra_env, attempts, deny_write)
    out = {}
    try:
        for s in scenarios_for(checks):
            if s == 'exit5' or s == 'corrupt':
                if not slow: continue
            getattr(g, 'sc_' + s)()
        for c in checks:
            if c in ('gen.download.exit5',) and 'exit5' not in g.obs: continue
            ok, det = g.judge(c)
            out[c] = (ok, det)
            if not quiet_ids: report.add(c, ok, det, tag)
    finally:
        m.stop()
    return out
