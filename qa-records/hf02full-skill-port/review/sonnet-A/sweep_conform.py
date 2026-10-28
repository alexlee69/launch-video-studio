# -*- coding: utf-8 -*-
# for many --start values: ask conform.py for the largest N it accepts (refusal message -> have), then write exactly N and N-1 and verify frame counts
import subprocess, sys, re, os
F='/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting/video/footage/conform.py'
src=sys.argv[1]; fps=sys.argv[2]
def run(n, st, out='sw.mp4'):
    r=subprocess.run(['/usr/bin/python3','-I',F,src,out,'--frames',str(n),'--start',str(st),'--fps',fps],capture_output=True,text=True)
    return r
def nframes(p):
    r=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',p],capture_output=True,text=True)
    return int(r.stdout.strip() or -1)
bad=0
for st in [0,0.01,0.02,0.0416,0.0417,0.05,0.1,0.2,0.5,0.9,1.0,1.234,2.5,3.333,3.999,4.0,4.5]:
    r=run(100000,st)
    m=re.search(r'covers (\d+) of',r.stderr)
    have=int(m.group(1)) if m else None
    if have is None: print('start',st,'no have in',r.stderr[:100]); continue
    ok1=run(have,st) if have>0 else None
    n1=nframes('sw.mp4') if ok1 is not None and ok1.returncode==0 else None
    over=run(have+1,st)
    print('start %-6s have=%-4s write(have): exit %s frames %s | have+1: exit %s' % (st,have, ok1.returncode if ok1 else '-', n1, over.returncode))
    if ok1 is not None and (ok1.returncode!=0 or n1!=have): bad+=1; print('   MISMATCH', ok1.stderr[:200])
    if over.returncode!=2: bad+=1; print('   have+1 NOT refused')
print('mismatches:',bad)
