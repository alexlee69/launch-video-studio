# -*- coding: utf-8 -*-
import subprocess, sys, re
F='/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting/video/footage/pin.py'
src,scr=sys.argv[1],sys.argv[2]
def run(n, st, out='swp.mp4'):
    return subprocess.run(['/usr/bin/python3','-I',F,src,scr,out,'--frames',str(n),'--start',str(st),'--track-png','swp-track.png'],capture_output=True,text=True)
def nframes(p):
    r=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',p],capture_output=True,text=True)
    return int(r.stdout.strip() or -1)
bad=0
for st in [0,0.01,0.0417,0.3,1.0,2.0,3.0,3.5,3.9]:
    r=run(100000,st)
    m=re.search(r'covers (\d+) of',r.stderr)
    if not m: print('start',st,'rc',r.returncode,r.stderr[-160:].replace('\n',' | ')); continue
    have=int(m.group(1))
    if have>0:
        a=run(have,st); n=nframes('swp.mp4') if a.returncode==0 else None
    else: a=None; n=None
    b=run(have+1,st)
    print('start %-6s have=%-4s write(have): exit %s frames %s | have+1: exit %s' % (st,have,a.returncode if a else '-',n,b.returncode), flush=True)
    if a is not None and (a.returncode!=0 or n!=have): bad+=1; print('   MISMATCH', a.stderr[-300:])
    if b.returncode!=2: bad+=1; print('   have+1 not refused', b.returncode, b.stderr[-200:])
print('mismatches',bad)
