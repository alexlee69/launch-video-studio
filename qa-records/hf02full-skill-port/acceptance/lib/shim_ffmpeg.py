# -*- coding: utf-8 -*-
# Fault-injection ffmpeg (put lib/shim/ first on PATH). Passes every call through to the real ffmpeg, except that with
#   ACC_TAMPER=slip-sbs     a written sbs*.mp4 gets its right half slipped one frame from the middle on
#   ACC_TAMPER=tamper-audio a written *-tempmusic-PRIVATE.mp4 gets its audio re-encoded (PCM no longer the reference's)
#   ACC_TAMPER=tamper-video a written *-tempmusic-PRIVATE.mp4 gets its video re-encoded (packets no longer ours)
# after the real ffmpeg wrote it; then it notes what it did in $ACC_SHIM_MARK. A tool's own verify must catch it.
# With ACC_TAMPER_DIR / ACC_TAMPER_STEM / ACC_TAMPER_EXT it tampers with whatever file ffmpeg writes into the tool's
# output folder holding that stem and extension — so a temp written beside the output and renamed into place
# (e.g. .sbs.edh8ulnf.tmp.mp4 → sbs.mp4) is caught too. ACC_SHIM_LOG=FILE only records every ffmpeg command line.
import os, sys, json, subprocess
REAL = os.environ.get('ACC_REAL_FFMPEG', '/opt/homebrew/bin/ffmpeg')
PROBE = os.path.join(os.path.dirname(REAL), 'ffprobe')
mode = os.environ.get('ACC_TAMPER', '')
args = sys.argv[1:]
if os.environ.get('ACC_SHIM_LOG'):                                # observation only: record every ffmpeg command line
    with open(os.environ['ACC_SHIM_LOG'], 'a', encoding='utf-8') as _f: _f.write(json.dumps(args) + '\n')


def target():
    # ACC_TAMPER_DIR (+ ACC_TAMPER_STEM, ACC_TAMPER_EXT): tamper with ANY file ffmpeg writes into the tool's output folder
    # whose name holds the output's stem and ends in its extension — the final name or a temp written beside it and
    # renamed into place (e.g. .sbs.x1y2.tmp.mp4). Without ACC_TAMPER_DIR: the final names only (older tools).
    tdir, stem, ext = os.environ.get('ACC_TAMPER_DIR'), os.environ.get('ACC_TAMPER_STEM', ''), os.environ.get('ACC_TAMPER_EXT', '.mp4')
    for i in range(len(args) - 1, -1, -1):
        a = args[i]
        if i and args[i - 1] == '-i': continue
        if a.startswith('-') or a.startswith('pipe:'): continue
        b = os.path.basename(a)
        if b.startswith('.acc-shim-'): continue
        if tdir:
            if os.path.realpath(os.path.dirname(os.path.abspath(a))) == os.path.realpath(tdir) and b.endswith(ext) and stem in b: return i
            continue
        if mode == 'slip-sbs' and b.startswith('sbs') and b.endswith('.mp4'): return i
        if mode.startswith('tamper-') and b.endswith('-tempmusic-PRIVATE.mp4'): return i
    return None


k = target() if mode else None
if k is None:
    os.execv(REAL, [REAL] + args)
dst = args[k]
FMT = ['-f', 'mp4'] if os.path.splitext(dst)[1].lower() not in ('.mp4', '.mov', '.m4v', '.mkv') else []
tmp = os.path.join(os.path.dirname(os.path.abspath(dst)), '.acc-shim-' + os.path.splitext(os.path.basename(dst))[0] + '.mp4')
args2 = list(args); args2[k] = tmp
if os.path.exists(tmp): os.remove(tmp)
rc = subprocess.call([REAL] + args2)
if rc != 0 or not os.path.exists(tmp):
    sys.exit(rc)


def mark(info):
    m = os.environ.get('ACC_SHIM_MARK')
    if m:
        with open(m, 'a', encoding='utf-8') as f: f.write(json.dumps(info) + '\n')


if mode == 'slip-sbs':
    import numpy as np
    j = json.loads(subprocess.run([PROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', tmp], capture_output=True).stdout)['streams'][0]
    W, H = int(j['width']), int(j['height'])
    raw = subprocess.run([REAL, '-v', 'error', '-i', tmp, '-map', '0:v:0', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy(); n = len(F); h = W // 2
    for i in range(n // 2, n - 1): F[i, :, h:] = F[i + 1, :, h:]
    has_a = b'audio' in subprocess.run([PROBE, '-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', tmp], capture_output=True).stdout
    cmd = [REAL, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-framerate', j['r_frame_rate'], '-i', '-']
    if has_a: cmd += ['-i', tmp, '-map', '0:v', '-map', '1:a', '-c:a', 'copy']
    cmd += ['-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p'] + FMT + [dst]
    subprocess.run(cmd, input=F.tobytes(), check=True)
    mark({'mode': mode, 'file': dst, 'frames': n, 'slipped_from': n // 2})
elif mode == 'tamper-audio':
    subprocess.run([REAL, '-y', '-v', 'error', '-i', tmp, '-map', '0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-map_metadata', '0'] + FMT + [dst], check=True)
    mark({'mode': mode, 'file': dst})
elif mode == 'tamper-video':
    subprocess.run([REAL, '-y', '-v', 'error', '-i', tmp, '-map', '0', '-c:v', 'libx264', '-crf', '23', '-c:a', 'copy', '-map_metadata', '0'] + FMT + [dst], check=True)
    mark({'mode': mode, 'file': dst})
os.remove(tmp)
sys.exit(0)
