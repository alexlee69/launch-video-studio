# P8 of test_parity.py with the lead's proposed two-line patch (apply_phase2_brief.py after apply_pointers.py)
import os, shutil, subprocess, sys
QA = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/shots-skill-port'
SKILL = sys.argv[1]; ROLL = os.path.join(QA, 'rollback'); t = sys.argv[2]
shutil.rmtree(t, ignore_errors=True)
read = lambda p: open(p, encoding='utf-8').read()
run = lambda c: (lambda r: (r.returncode, r.stdout + r.stderr))(subprocess.run(c, capture_output=True, text=True))
for src, dst in (('SKILL.md', 'SKILL.md'), ('video_GUIDE.md', 'video/GUIDE.md'), ('video_FOOTAGE.md', 'video/FOOTAGE.md'),
                 ('video_templates_footage-prompts.md', 'video/templates/footage-prompts.md'), ('video_templates_brief.md', 'video/templates/brief.md')):
    os.makedirs(os.path.dirname(os.path.join(t, dst)), exist_ok=True)
    shutil.copy(os.path.join(ROLL, src), os.path.join(t, dst))
rc, out = run(['/usr/bin/python3', '-B', os.path.join(QA, 'apply_pointers.py'), t])
rc2, out2 = run(['/usr/bin/python3', '-B', os.path.join(QA, 'apply_phase2_brief.py'), t])      # the patch, line 1
docs = ('SKILL.md', 'video/GUIDE.md', 'video/FOOTAGE.md', 'video/templates/footage-prompts.md', 'video/templates/brief.md')
rebuilt = [d for d in docs if read(os.path.join(t, d)) == read(os.path.join(SKILL, d))]
ok = rc == 0 and rc2 == 0 and len(rebuilt) == 5 and out.count('APPLIED') == 11 and out2.count('APPLIED') == 2   # the patch, line 2
print('PASS' if ok else 'FAIL', 'P8 (patched): %d + %d applied, %d/5 docs rebuilt exactly' % (out.count('APPLIED'), out2.count('APPLIED'), len(rebuilt)),
      '' if ok else sorted(set(docs) - set(rebuilt)))
