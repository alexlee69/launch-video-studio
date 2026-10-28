# -*- coding: utf-8 -*-
# The harness's slow sub-run guard: (1) --allow-live reaches the sub-run; (2) a sub-run that reports nothing → 2 FAILs, exit 1.
# Stubs: the gen suite is a no-op and the sub-run is a fake process that exits 2 without writing its report.
import sys, os, subprocess
ACC = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/acceptance'
LIVE = os.path.expanduser('~/.claude/skills/product-launch-sting'); RD = sys.argv[1]
sys.path.insert(0, ACC + '/lib')
sys.argv = ['run.py', LIVE, '--allow-live', '--only', 'gen', '--run-dir', RD]
import suite_gen
suite_gen.run_suite = lambda *a, **k: None
spawned = []
class Fake:
    returncode = 2
    def wait(self, timeout=None): return 2
real = subprocess.Popen
def fake(cmd, *a, **k):
    if '--part' in cmd:
        spawned.append(cmd); k['stdout'].write('simulated refusal\n'); k['stdout'].close(); return Fake()
    return real(cmd, *a, **k)
subprocess.Popen = fake
import run as RUN
rc = RUN.main()
rep = open(os.path.join(RD, 'report.txt'), encoding='utf-8').read()
fails = [l for l in rep.splitlines() if l.startswith('FAIL') and 'no result from the slow sub-run' in l]
ok1 = bool(spawned) and '--allow-live' in spawned[0]
ok2 = rc == 1 and len(fails) == 2 and any('gen.download.exit5' in l for l in fails) and any('gen.download.verify' in l for l in fails)
print('allow-live passed to the sub-run:', ok1); print('missing results → 2 FAILs, exit %s:' % rc, ok2)
print('\n'.join(fails)); sys.exit(0 if ok1 and ok2 else 1)
