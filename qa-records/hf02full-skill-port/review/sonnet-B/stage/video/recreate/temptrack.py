# -*- coding: utf-8 -*-
# The private temp track: our picture with the reference film's own audio laid under it, both stream-copied — so the
# user can judge the cut against the music it was timed to. For the user's private review only: never a deliverable,
# never posted, never sent beyond the user. The shareable master is our film with our own score.
#
#   python3 temptrack.py --film OURS.mp4 --ref REF.mp4 --out NAME[-tempmusic-PRIVATE.mp4]
#
# The name always ends in -tempmusic-PRIVATE.mp4 and the file's title/comment say what it is. Refused when the two
# videos' lengths differ by more than a frame (the music would drift off the picture). Then verified: the decoded audio
# is bit-identical to the reference's, the video packets are ours, and the audio keeps the reference's priming
# (first packet pts, packet count).
# exit 0 PASS · 1 a verification failed (the file is left for inspection) · 2 bad input / refused
import os, sys, json, argparse, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True                  # no __pycache__ inside the skill
import media
from media import UserError

SUFFIX = '-tempmusic-PRIVATE.mp4'


def md5_of(path, sel, decode):
    args = ['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-map', sel] + ([] if decode else ['-c', 'copy']) + ['-f', 'md5', '-']
    return media.run(args, 'md5 of %s %s' % (os.path.basename(path), sel), text=True).strip().replace('MD5=', '')


def packets(path, sel):
    out = media.run(['ffprobe', '-v', 'error', '-select_streams', sel, '-show_entries', 'packet=pts', '-of', 'json', path], 'packets of %s' % os.path.basename(path), text=True)
    pts = [p.get('pts') for p in json.loads(out or '{}').get('packets', [])]
    return (pts[0] if pts else None), len(pts)


def vlen(P):
    """video length = frames / fps (frames counted when the container doesn't say: an MKV's durations are rounded)"""
    v = P['video']
    n = v['frames']
    if not n:
        out = media.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', P['path']], 'count frames', text=True)
        n = int(out.strip().split(',')[0]) if out.strip().split(',')[0].isdigit() else None
    return n / v['fps'] if n and v['fps'] else (v['duration'] or P['duration'])


def main():
    ap = argparse.ArgumentParser(description='our picture + the reference\'s own audio, for private review only')
    ap.add_argument('--film', required=True); ap.add_argument('--ref', required=True); ap.add_argument('--out', required=True)
    A = ap.parse_args()
    out = A.out[:-4] if A.out.lower().endswith('.mp4') else A.out
    if not out.endswith(SUFFIX[:-4]):
        out += SUFFIX[:-4]
    out += '.mp4'
    out = os.path.abspath(out)
    O, R = media.probe(A.film), media.probe(A.ref)
    if not O['video']:
        raise UserError('--film %s has no video stream' % O['name'])
    if not R['audio']:
        raise UserError('--ref %s has no audio stream — nothing to lay under the picture' % R['name'])
    if out in (os.path.abspath(A.film), os.path.abspath(A.ref)):
        raise UserError('--out would overwrite an input')
    fps = O['video']['fps'] or 30
    lo, lr = vlen(O), vlen(R) if R['video'] else R['duration']
    if abs(lo - lr) > 1 / fps + 1e-6:
        raise UserError('the films differ in length: ours %.3f s, the reference %.3f s (%.1f frames apart) — the music would drift off the picture; '
                        'cut ours to the reference\'s length first' % (lo, lr, abs(lo - lr) * fps))
    stem = os.path.basename(A.film).rsplit('.', 1)[0]
    title = '%s - TEMP TRACK (reference audio), private review only' % stem
    comment = ('Picture: %s. Audio: %s\'s own track, laid on as a temp track for private review. Not for sharing or posting. '
               'Shareable master with our own score: %s' % (os.path.basename(A.film), os.path.basename(A.ref), os.path.basename(A.film)))
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    media.run(['ffmpeg', '-y', '-v', 'error', '-nostdin', '-i', A.film, '-i', A.ref, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy',
               '-metadata', 'title=%s' % title, '-metadata', 'comment=%s' % comment, '-movflags', '+faststart', out], 'mux %s' % os.path.basename(out))
    checks = []
    def check(name, ok, detail):
        checks.append(ok); print('%s  %-9s %s' % ('PASS' if ok else 'FAIL', name, detail))
    a_out, a_ref = md5_of(out, '0:a:0', True), md5_of(A.ref, '0:a:0', True)
    check('audio', a_out == a_ref, 'decoded PCM md5 %s %s the reference\'s %s' % (a_out, '==' if a_out == a_ref else '!=', a_ref))
    v_out, v_ours = md5_of(out, '0:v:0', False), md5_of(A.film, '0:v:0', False)
    check('video', v_out == v_ours, 'video packets md5 %s %s ours %s' % (v_out, '==' if v_out == v_ours else '!=', v_ours))
    (p_out, n_out), (p_ref, n_ref) = packets(out, 'a:0'), packets(A.ref, 'a:0')
    P = media.probe(out)
    tb_ok = P['audio'] and P['audio']['time_base'] == R['audio']['time_base']
    check('priming', p_out == p_ref and n_out == n_ref and bool(tb_ok), 'first audio packet pts %s vs %s, %d vs %d packets, time base %s vs %s' % (p_out, p_ref, n_out, n_ref, P['audio'] and P['audio']['time_base'], R['audio']['time_base']))
    tags = {k.lower(): v for k, v in P['tags'].items()}
    check('label', tags.get('title') == title and 'private review' in tags.get('comment', ''), 'title "%s"' % tags.get('title'))
    ok = all(checks)
    print('%s → %s' % ('PASS' if ok else 'FAIL', out))
    print('  private review only: the reference\'s own music — never a deliverable, never posted or sent beyond the user; the shareable master is %s with our score' % os.path.basename(A.film))
    return 0 if ok else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except UserError as e:
        media.die(str(e))
