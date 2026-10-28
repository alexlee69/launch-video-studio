# -*- coding: utf-8 -*-
# Self-test of the mock fal server and the sandbox the harness runs every stage tool in. Prints PASS/FAIL lines.
#   python3 -E lib/selftest_mock.py [RUN_DIR]
import os, sys, json, time, urllib.request, urllib.error, hashlib, base64, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

RUN = sys.argv[1] if len(sys.argv) > 1 else os.path.join(H.ACC, 'runs', 'selftest-mock')
os.makedirs(RUN, exist_ok=True)
for _f in ('selftest-mock.txt', 'selftest-mock.log'):
    open(os.path.join(RUN, _f), 'w').close()
REP = H.Report(os.path.join(RUN, 'selftest-mock.txt'))
LOG = os.path.join(RUN, 'selftest-mock.log')
CURL = ['/usr/bin/curl', '-4', '--http1.1', '-L', '--fail', '-C', '-', '--retry', '5', '--retry-all-errors', '-s', '-S']


def req(method, url, body=None, key=None, timeout=10):
    h = {'content-type': 'application/json'}
    if key: h['authorization'] = 'Key ' + key
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as x: return x.status, json.loads(x.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or '{}')


def main():
    blob = os.path.join(RUN, 'blob.bin')
    with open(blob, 'wb') as f: f.write(hashlib.sha512(b'acc').digest() * 49152)          # 3 MiB, deterministic
    want = H.md5_file(blob)
    m = H.Mock(os.path.join(RUN, 'mock'), RUN)
    try:
        # ── sandbox semantics ──
        REP.add('sb.available', H.sandbox_ok(), 'sandbox-exec usable')
        env = H.base_env(tmp=os.path.join(RUN, 'tmp'))
        m.file('blob.bin', blob, mode='ok', ctype='application/octet-stream')
        out = os.path.join(RUN, 'sb-ok.bin')
        r = H.run(CURL + ['-o', out, m.cdn + '/files/blob.bin'], env=env, net='localhost', log=LOG)
        REP.add('sb.localhost-allowed', r.rc == 0 and os.path.exists(out) and H.md5_file(out) == want, 'curl to 127.0.0.1 under net=localhost rc %s' % r.rc)
        r = H.run(['/usr/bin/curl', '-s', '-S', '-m', '4', '-o', '/dev/null', 'http://192.0.2.1/'], env=env, net='localhost', timeout=20, log=LOG)
        REP.add('sb.internet-blocked', r.rc != 0 and r.secs < 2.5, 'curl to TEST-NET 192.0.2.1 rc %s in %.2fs (%s)' % (r.rc, r.secs, r.brief(80)))
        r = H.run(['/usr/bin/curl', '-s', '-S', '-m', '4', '-o', '/dev/null', m.cdn + '/files/blob.bin'], env=env, net='none', timeout=20, log=LOG)
        REP.add('sb.net-none-blocks-localhost', r.rc != 0, 'curl to the mock under net=none rc %s' % r.rc)
        probe = os.path.join(RUN, 'sbprobe'); os.makedirs(probe, exist_ok=True)
        r = H.run(['/usr/bin/touch', os.path.join(probe, 'x')], env=env, deny_write=(probe,), log=LOG)
        REP.add('sb.deny-write', r.rc != 0 and not os.path.exists(os.path.join(probe, 'x')), 'touch inside a denied folder rc %s' % r.rc)
        if os.path.exists(H.REAL_ENV):                      # a stat only: the harness never opens the real .env
            r = H.run(['/bin/test', '-e', H.REAL_ENV], env=env, log=LOG)
            r2 = H.run([H.PY, '-E', '-c', 'import sys; open(sys.argv[1], "rb").close()', H.REAL_ENV], env=env, log=LOG)   # open+close, reads nothing
            REP.add('sb.real-env-unreadable', r.rc != 0 and r2.rc != 0 and 'Operation not permitted' in r2.err, 'under the sandbox the real .env is invisible (test -e rc %s) and unopenable (open() rc %s: %s)' % (r.rc, r2.rc, r2.err.strip().splitlines()[-1][:80] if r2.err.strip() else ''))
        else:
            REP.add('sb.real-env-unreadable', None, 'no real .env on this machine')

        # ── queue API ──
        m.reset(); m.file('blob.bin', blob, mode='ok')
        m.scenario(result={'video': {'url': '$CDN/blob.bin', 'content_type': 'video/mp4', 'file_name': 'blob.bin', 'file_size': 3145728}})
        c, j = req('POST', m.api + '/minimax/h3-max/image-to-video', {'prompt': 'x', 'image_url': 'data:image/png;base64,' + base64.b64encode(b'hello').decode()})
        REP.add('mock.auth-required', c == 401, 'submit without a key → %s' % c)
        c, j = req('POST', m.api + '/minimax/h3-max/image-to-video', {'prompt': 'x', 'image_url': 'data:image/png;base64,' + base64.b64encode(b'hello').decode()}, key='bad:key')
        lg = m.log()['log']
        REP.add('mock.unknown-key-masked', c == 401 and lg[-1]['auth'].startswith('unknown(') and 'bad:key' not in json.dumps(lg), 'unknown key logged as %s' % lg[-1]['auth'])
        c, j = req('POST', m.api + '/minimax/h3-max/image-to-video', {'prompt': 'x', 'image_url': 'data:image/png;base64,' + base64.b64encode(b'hello').decode()}, key=H.KEY_A)
        rid = j.get('request_id')
        ok = c == 200 and rid and j['status_url'].endswith('/minimax/h3-max/requests/%s/status' % rid) and j['response_url'].endswith('/minimax/h3-max/requests/' + rid)
        REP.add('mock.submit', ok, 'submit → %s %s' % (c, json.dumps(j)[:160]))
        e = [x for x in m.log()['log'] if x.get('request_id') == rid and x.get('endpoint')][0]
        REP.add('mock.records-auth-and-datauri', e['auth'] == 'a' and e['body']['image_url'].get('md5') == hashlib.md5(b'hello').hexdigest(), 'auth=%s image_url=%s' % (e['auth'], e['body']['image_url']))
        seen = []
        t0 = time.time()
        while time.time() - t0 < 8:
            c, s = req('GET', j['status_url'], key=H.KEY_A); seen.append(s['status'])
            if s['status'] == 'COMPLETED': break
            time.sleep(.5)
        REP.add('mock.status-progression', seen[0] == 'IN_QUEUE' and 'IN_PROGRESS' in seen and seen[-1] == 'COMPLETED', ' → '.join(dict.fromkeys(seen)))
        c, res = req('GET', j['response_url'], key=H.KEY_A)
        REP.add('mock.result-urls', c == 200 and res['video']['url'] == m.cdn + '/files/blob.bin', 'result video.url %s' % res.get('video', {}).get('url'))
        # full-endpoint status paths are accepted too (fetch may build them either way)
        c, s = req('GET', m.api + '/minimax/h3-max/image-to-video/requests/%s/status' % rid, key=H.KEY_A)
        REP.add('mock.status-path-variants', c == 200 and s['status'] == 'COMPLETED', 'full-endpoint status path → %s %s' % (c, s.get('status')))
        # error scenarios
        m.scenario(submitError={'code': 422, 'body': {'detail': [{'msg': 'ACC-E1 prompt too long', 'type': 'value_error'}]}})
        c, j2 = req('POST', m.api + '/fal-ai/flux-pro/v1.1-ultra', {'prompt': 'x'}, key=H.KEY_A)
        REP.add('mock.error-submit', c == 422 and 'ACC-E1' in json.dumps(j2), 'submitError → %s' % c)
        m.scenario(timeline=[[0, 'IN_QUEUE'], [0.2, 'COMPLETED']], resultError={'code': 422, 'body': {'detail': [{'msg': 'ACC-E3 content policy'}]}})
        c, j3 = req('POST', m.api + '/fal-ai/flux-pro/v1.1-ultra', {'prompt': 'x'}, key=H.KEY_A); time.sleep(.4)
        c, r3 = req('GET', j3['response_url'], key=H.KEY_A)
        REP.add('mock.error-result', c == 422 and 'ACC-E3' in json.dumps(r3), 'resultError → %s' % c)
        m.scenario(hold=True)
        c, j4 = req('POST', m.api + '/fal-ai/flux-pro/v1.1-ultra', {'prompt': 'x'}, key=H.KEY_A); time.sleep(.3)
        c, s4 = req('GET', j4['status_url'], key=H.KEY_A); m.complete(j4['request_id']); c, s5 = req('GET', j4['status_url'], key=H.KEY_A)
        REP.add('mock.hold-complete', s4['status'] != 'COMPLETED' and s5['status'] == 'COMPLETED', '%s → %s after /complete' % (s4['status'], s5['status']))

        # ── CDN: Range, 416, cut + resume, stall, 503 ──
        m.reset()
        m.file('blob.bin', blob, mode='ok')
        rq = urllib.request.Request(m.cdn + '/files/blob.bin', headers={'Range': 'bytes=1000-1999'})
        with urllib.request.urlopen(rq, timeout=10) as x: body, code, cr = x.read(), x.status, x.headers.get('content-range')
        REP.add('cdn.range-206', code == 206 and body == open(blob, 'rb').read()[1000:2000] and cr == 'bytes 1000-1999/3145728', '206 %s' % cr)
        try:
            urllib.request.urlopen(urllib.request.Request(m.cdn + '/files/blob.bin', headers={'Range': 'bytes=3145728-'}), timeout=10); c416 = 200
        except urllib.error.HTTPError as e: c416 = e.code
        REP.add('cdn.range-416', c416 == 416, 'range past the end → %s' % c416)
        fmt = lambda gets: ', '.join('%s %s→%s' % (g.get('range') or 'full', g.get('status', '-'), g.get('outcome')) for g in gets)
        for mode, kw in (('cut', dict(cutAt=.4, stallMs=200, failTimes=1)), ('drop', dict(failTimes=1)), ('stall', dict(cutAt=.5, stallMs=5000, failTimes=1))):
            m.reset(); m.file('blob.bin', blob, mode=mode, **kw)
            out = os.path.join(RUN, 'cdn-%s.bin' % mode)
            if os.path.exists(out): os.remove(out)
            r = H.run(CURL + ['-o', out, m.cdn + '/files/blob.bin'], env=env, timeout=120, log=LOG)
            gets = [x for x in m.log()['log'] if x['port'] == 'cdn' and x['method'] == 'GET']
            ok = r.rc == 0 and os.path.exists(out) and H.md5_file(out) == want
            if mode == 'stall': ok = ok and len(gets) == 1
            REP.add('cdn.%s' % mode, ok, 'one curl call (spec flags) rc %s in %.1fs; GETs: %s' % (r.rc, r.secs, fmt(gets)))
        # curl --retry truncates to where the call started, so a resume needs a second curl call: cut every GET from 0
        m.reset(); m.file('blob.bin', blob, mode='cut-unless-range', cutAt=.4, stallMs=100)
        out = os.path.join(RUN, 'cdn-resume.bin')
        if os.path.exists(out): os.remove(out)
        r1 = H.run(CURL + ['-o', out, m.cdn + '/files/blob.bin'], env=env, timeout=120, log=LOG)
        part = os.path.getsize(out) if os.path.exists(out) else 0
        r2 = H.run(CURL + ['-o', out, m.cdn + '/files/blob.bin'], env=env, timeout=120, log=LOG)
        gets = [x for x in m.log()['log'] if x['port'] == 'cdn' and x['method'] == 'GET']
        ok = r1.rc != 0 and part > 0 and r2.rc == 0 and H.md5_file(out) == want and gets[-1].get('range') == 'bytes=%d-' % part
        REP.add('cdn.cut-unless-range', ok, 'call 1 rc %s after %d GETs (%.1fs) left %d bytes; call 2 rc %s resumed with %s' % (r1.rc, len(gets) - 1, r1.secs, part, r2.rc, gets[-1].get('range')))
        m.reset(); m.file('blob.bin', blob, mode='fail503')
        r = H.run(CURL + ['-o', os.path.join(RUN, 'cdn-503.bin'), m.cdn + '/files/blob.bin'], env=env, timeout=200, log=LOG)
        gets = [x for x in m.log()['log'] if x['port'] == 'cdn']
        REP.add('cdn.fail503', r.rc != 0 and len(gets) == 6, 'always-503: curl rc %s after %d tries in %.1fs (one curl call; the 30-attempt loop multiplies this)' % (r.rc, len(gets), r.secs))
        m.reset(); m.file('blob.bin', blob, mode='short', cutAt=.5, failTimes=1)
        out = os.path.join(RUN, 'cdn-short.bin')
        if os.path.exists(out): os.remove(out)
        r = H.run(CURL + ['-o', out, m.cdn + '/files/blob.bin'], env=env, timeout=60, log=LOG)
        REP.add('cdn.short-looks-complete', r.rc == 0 and os.path.getsize(out) == 3145728 // 2, 'chunked early end: curl rc %s, %d bytes (only a size/ffprobe check can catch this)' % (r.rc, os.path.getsize(out)))
        conns = m.log()['conns']
        REP.add('mock.connection-counter', conns['cdn'] >= 1, 'connections seen api=%d cdn=%d' % (conns['api'], conns['cdn']))
    finally:
        m.stop()
    c = REP.counts()
    print('selftest-mock: %d PASS, %d FAIL, %d SKIP' % (c.get('PASS', 0), c.get('FAIL', 0), c.get('SKIP', 0)))
    return 1 if c.get('FAIL') else 0


if __name__ == '__main__':
    sys.exit(main())
