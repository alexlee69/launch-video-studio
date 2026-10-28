# -*- coding: utf-8 -*-
# The private temp track: our picture with the reference film's own audio laid under it, both stream-copied — so the
# user can judge the cut against the music it was timed to. For the user's private review only: never a deliverable,
# never posted, never sent beyond the user. The shareable master is our film with our own score.
#
#   python3 temptrack.py --film OURS.mp4 --ref REF.mp4 --out NAME[-tempmusic-PRIVATE.mp4]
#
# The name always ends in -tempmusic-PRIVATE.mp4 (a .mp4/.mov/… extension on NAME goes first: final-cut.mov →
# final-cut-tempmusic-PRIVATE.mp4) and the file's title/comment say what it is. Refused when the two
# videos' lengths differ by more than a frame (the music would drift off the picture). Then verified: the decoded audio
# is bit-identical to the reference's, the video packets are ours, and the audio keeps the reference's priming
# (first packet at the same time — pts × time base, in seconds — and the same packet count). The reference must be an
# MP4 or MOV with AAC audio, the kind of file the temp track is, so the bit-for-bit check means what it says; anything
# else is refused up front with the ffmpeg command that makes one (a remux for AAC in MKV/WebM, an AAC copy for Opus or
# other audio). The output is never an input (the same path, a hard link or a symlink to the film or the reference:
# refused) and is written whole (a temp file + one rename, which replaces a link, never its target).
# exit 0 PASS · 1 a verification failed (the file is left for inspection) · 2 bad input / refused
import os, sys, json, argparse, hashlib, shlex
from fractions import Fraction
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


def secs(pts, tb):
    """a packet time in seconds, exactly (pts × time base); None when unknown"""
    try:
        return Fraction(int(pts)) * Fraction(tb)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


CODECS = {'opus': 'Opus', 'vorbis': 'Vorbis', 'mp3': 'MP3', 'mp2': 'MP2', 'flac': 'FLAC', 'alac': 'ALAC', 'ac3': 'AC-3', 'eac3': 'E-AC-3', 'dts': 'DTS'}


def remade(ref, tail):
    """a name for the reference's MP4 copy, next to it: REF.mp4, or REF<tail>.mp4 when that is taken (or is REF)"""
    root = os.path.splitext(ref)[0]
    c = root + '.mp4'
    return root + tail + '.mp4' if os.path.exists(c) or os.path.abspath(c) == os.path.abspath(ref) else c


def refuse_unless_mp4_aac(ref, R):
    """the temp track keeps the reference's audio packets as they are: only an AAC track in an MP4/MOV goes into it with
    its priming carried the same way, so only that can be checked bit for bit — anything else: the command to run first"""
    codec = R['audio']['codec'] or '?'
    if codec != 'aac':
        name = CODECS.get(codec) or ('PCM' if codec.startswith('pcm_') else codec.upper())
        raise UserError('--ref %s has %s audio: the temp track carries the reference\'s own audio packets, and only AAC in an MP4/MOV '
                        'is carried bit for bit, priming and all — make an AAC copy first and pass that as --ref:\n  ffmpeg -i %s -c:v copy -c:a aac -b:a 256k %s'
                        % (R['name'], name, shlex.quote(ref), shlex.quote(remade(ref, '-aac'))))
    kinds = set(R['format'].split(','))
    if not kinds & {'mov', 'mp4'}:
        what = ('WebM' if ref.lower().endswith('.webm') else 'Matroska (MKV)') if 'matroska' in kinds else R['format'] or 'not a known kind of file'
        raise UserError('--ref %s is %s, not MP4/MOV: its AAC doesn\'t carry the priming an MP4 keeps, so the temp track can\'t be checked bit for '
                        'bit against it — remux to .mp4 first and pass that as --ref:\n  ffmpeg -i %s -c copy %s'
                        % (R['name'], what, shlex.quote(ref), shlex.quote(remade(ref, '-remux'))))


def vlen(P):
    """video length = frames / fps (frames counted when the container doesn't say: an MKV's durations are rounded)"""
    v = P['video']
    n = media.count_frames(P)
    return n / v['fps'] if n and v['fps'] else (v['duration'] or P['duration'])


def main():
    ap = argparse.ArgumentParser(description='our picture + the reference\'s own audio, for private review only')
    ap.add_argument('--film', required=True); ap.add_argument('--ref', required=True); ap.add_argument('--out', required=True)
    A = ap.parse_args()
    root, ext = os.path.splitext(A.out)
    out = root if ext.lower() in ('.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi', '.mxf') else A.out    # final-cut.mov → final-cut-tempmusic-PRIVATE.mp4
    if not out.endswith(SUFFIX[:-4]):
        out += SUFFIX[:-4]
    out += '.mp4'
    out = os.path.abspath(out)
    media.guard_outputs([out], [A.film, A.ref])
    O, R = media.probe(A.film), media.probe(A.ref)
    if not O['video']:
        raise UserError('--film %s has no video stream' % O['name'])
    if not R['audio']:
        raise UserError('--ref %s has no audio stream — nothing to lay under the picture' % R['name'])
    refuse_unless_mp4_aac(A.ref, R)
    vsel = '0:%d' % O['video']['index']             # the film's picture (never an attached cover image)
    fps = O['video']['fps'] or 30
    lo, lr = vlen(O), vlen(R) if R['video'] else R['duration']
    if abs(lo - lr) > 1 / fps + 1e-6:
        raise UserError('the films differ in length: ours %.3f s, the reference %.3f s — ours is %.1f frames %s, and the music would drift off the picture; %s first'
                        % (lo, lr, abs(lo - lr) * fps, 'shorter' if lo < lr else 'longer', 'make ours as long as the reference' if lo < lr else 'cut ours to the reference\'s length'))
    stem = os.path.basename(A.film).rsplit('.', 1)[0]
    title = '%s - TEMP TRACK (reference audio), private review only' % stem
    comment = ('Picture: %s. Audio: %s\'s own track, laid on as a temp track for private review. Not for sharing or posting. '
               'Shareable master with our own score: %s' % (os.path.basename(A.film), os.path.basename(A.ref), os.path.basename(A.film)))
    tmp = media.temp_beside(out)
    try:
        media.run(['ffmpeg', '-y', '-v', 'error', '-nostdin', '-i', A.film, '-i', A.ref, '-map', vsel, '-map', '1:a:0', '-c', 'copy',
                   '-metadata', 'title=%s' % title, '-metadata', 'comment=%s' % comment, '-movflags', '+faststart', tmp], 'mux %s' % os.path.basename(out))
        media.publish(tmp, out)
    except BaseException:
        media.discard(tmp)
        raise
    checks = []
    def check(name, ok, detail):
        checks.append(ok); print('%s  %-9s %s' % ('PASS' if ok else 'FAIL', name, detail))
    a_out, a_ref = md5_of(out, '0:a:0', True), md5_of(A.ref, '0:a:0', True)
    check('audio', a_out == a_ref, 'decoded PCM md5 %s %s the reference\'s %s' % (a_out, '==' if a_out == a_ref else '!=', a_ref))
    v_out, v_ours = md5_of(out, '0:v:0', False), md5_of(A.film, vsel, False)
    check('video', v_out == v_ours, 'video packets md5 %s %s ours %s' % (v_out, '==' if v_out == v_ours else '!=', v_ours))
    (p_out, n_out), (p_ref, n_ref) = packets(out, 'a:0'), packets(A.ref, 'a:0')
    P = media.probe(out)
    tb_out, tb_ref = P['audio'] and P['audio']['time_base'], R['audio']['time_base']
    s_out, s_ref, sr = secs(p_out, tb_out), secs(p_ref, tb_ref), R['audio']['sr']
    at = s_out is not None and s_ref is not None and (abs(s_out - s_ref) <= Fraction(1, 2 * sr) if sr else s_out == s_ref)   # within half a sample
    t = lambda x: '?' if x is None else '%+.6f s' % float(x)
    check('priming', at and n_out == n_ref, 'first audio packet pts %s vs %s, %d vs %d packets — at %s vs %s (time base %s vs %s)' % (p_out, p_ref, n_out, n_ref, t(s_out), t(s_ref), tb_out, tb_ref))
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
