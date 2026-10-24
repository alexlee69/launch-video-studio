#!/usr/bin/env python3
"""Round 2 on gpt-image-2 (Alex's rule: stills on the OpenAI key, fal for video only): the 4 location plates, then the
16 film key frames (the first frame of each MiniMax H3 leg), every one built from the locked sheets in cast/locked/ as
image references, never from text alone.

  python3 keyframes.py plan [--batch locations|identity|rest]      requests + cost quote; no network
  python3 keyframes.py locations                                   4 plates x 2 variants -> stills/locations/
  python3 keyframes.py pick-location NAME v1|v2                    the variant the key frames use (stills/locations/NAME.png)
  python3 keyframes.py keys --batch identity|rest [--only 1c,4A]   2 variants per leg -> stills/keys/
  python3 keyframes.py cost

Locations follow ad-asset-prep: an empty plate, a 3/4 angle, the light direction pinned. Key-frame prompts are the shot
list's (hf01-study/storyboard-space/final/shotlist.json) with a reference preamble. The ledger is stills/ledger.jsonl
with a hard cap (--cap, default $12 for Round 2 images)."""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cast_sheet as lib                                                     # noqa: E402  (call, save, est, banned)
from final_data import STATION, NEG                                          # noqa: E402  (path set up by cast_sheet)

JOB = lib.JOB
STILLS = os.path.join(JOB, 'stills')
lib.LEDGER = os.path.join(STILLS, 'ledger.jsonl')                            # Round 2 has its own ledger
LOCKED = lib.LOCKED
SHOTLIST = os.path.expanduser('~/Downloads/launch-videos/hf01-study/storyboard-space/final/shotlist.json')
SHEET = {k: os.path.join(LOCKED, k + '.png') for k in ('eva', 'helmet-off', 'costume', 'props')}

PLATE_TAIL = ('Photoreal cinematic film still, visible film grain, slightly soft, true blacks, not a stock photo, no '
              'people, no text, no logos, no watermark. ' + NEG)
LOCATIONS = {  # name: (refs, prompt)
    'exterior': (['props'],
                 'An empty location plate in orbit, three-quarter view, no people: ' + STATION + '. At the end of the '
                 'truss, the new guest module: a soft, rounded white module with one large round window. A small white '
                 'gumdrop-shaped capsule docked at one of the station\'s ports, exactly the capsule in image 1 '
                 '(bottom-right tile): white, one orange band, a hatch on top. The blue Earth curves below, black space '
                 'above. Hard sunlight from the right, deep shadow sides. 24mm. ' + PLATE_TAIL),
    'airlock': ([],
                'An empty location plate, three-quarter view, no people: a cramped white cylindrical spacecraft airlock '
                'with padded white walls and handholds under steady cool white panel light. At one end a round outer '
                'hatch stands half-closed, the sun\'s hard white glare in the gap and black space beyond; at the other '
                'end a closed round inner hatch with a metal rim. 24mm. ' + PLATE_TAIL),
    'capsule-interior': (['props'],
                         'An empty location plate, three-quarter view, no people: the inside of a small, dim, fictional '
                         're-entry capsule: grey padded panels, two reclined seats with harness straps, a few dim '
                         'indicator lights with no readable screens, one small round window showing black space. The '
                         'small pale blue-grey plush whale from image 1 (bottom-left tile) hangs on a cord from the '
                         'ceiling. Dim cabin light. 24mm. ' + PLATE_TAIL),
    'sea': (['props'],
            'A location plate at golden hour, three-quarter view, no people: the small white gumdrop-shaped capsule '
            'from image 1 (bottom-right tile), one orange band, its hatch open on top, bobbing on an open sea with a '
            'gentle swell; a recovery boat a tiny speck on the horizon; a pale sky. Low warm sun from the left, cool '
            'blue shadows, the sea\'s sparkle the brightest area. 50mm. ' + PLATE_TAIL),
}
LEG_LOC = {'1a': 'exterior', '1b': 'exterior', '1c': 'exterior', '2': 'exterior', '3': 'exterior', '4A': 'exterior',
           '4B': 'exterior', '9': 'exterior', '14A': 'exterior', '14B': 'exterior', '15': 'exterior', '20': 'airlock',
           '21': 'airlock', '22': 'airlock', '24': 'capsule-interior', '26': 'sea'}
IDENTITY = ['1c', '4A', '9', '14B', '22', '24', '26']
NO_FACE = {'2', '3', '15', '21'}          # gloves / wrench only: costume or props sheet, never the face
PRE_FACE = ('Image 1 is her locked character sheet. The woman in its LEFT close-up is the only face to use: keep exactly '
            'her face, her strong dark eyebrows with the small pale scar through her own left eyebrow, her skin tone and '
            'eyes. Its middle and right panels show her suit from the front and back: the helmet camera on her right, '
            'the mission patch on her left shoulder only, the wrist display on her left forearm, the orange bands. '
            'Sides are hers: whenever she faces the camera, the patch and the wrist display are on the RIGHT side of the '
            'picture and the helmet camera on the LEFT side of the picture. ')
# Per-leg additions after Round 2's identity check (2026-10-23): 4A came back in full daylight both times.
EXTRA = {'4A': ('Lighting is the point of this frame: the sun has NOT risen yet. It is orbital dawn, a low-key, mostly '
                'dark frame: Earth below is in night shadow except one thin bright blue line of atmosphere along the '
                'horizon; the station is lit only by that faint limb glow, her two helmet lamps and the soft blue-white '
                'glow of the wrist display on her face. Most of the frame is near-black. ')}
PRE_LOC = ('Image 2 is the location: keep its architecture, materials and design. Do not copy the grey background or the '
           'sheet layout: make one single cinematic film frame, 16:9. ')


# Her film's stills (shotlist ad.assets A1-A5; A4's red is a comp grade, A6 is designed in code). Each references what it
# must match: the picked plates, or the picked key frame of the moment her helmet cam recorded it.
AD_REFS = {'A1': ['loc:exterior'], 'A2': ['loc:exterior'], 'A3': ['key:S14-14A-v1f'], 'A4': ['loc:exterior'],
           'A5': ['loc:capsule-interior', 'key:S24-24-v1']}
AD_PRE = {
    'A1': 'Image 1 is the station: the hull and handrail at the frame edge belong to it. ',
    'A2': 'Image 1 is the station she is drifting away from: keep its design. ',
    'A3': ('Image 1 shows the same moment from outside: match its aurora, city lights, debris streaks and station truss. '
           'This frame is her own helmet-camera view, so she is not in it. '),
    'A4': ('Image 1 shows the station from outside; the soft rounded module with one large round window at the end of '
           'the truss is The Lull. This is its interior, facing that window. '),
    'A5': ('Image 1 is the capsule interior and image 2 shows its round window during re-entry: match that window and '
           'its plasma glow. Leave the person out: this frame is the window alone. '),
}


def ad_assets():
    d = json.load(open(SHOTLIST))
    return {a['id']: a for a in d['ad']['assets'] if a.get('image')}


def ad_job(aid, asset):
    refs = []
    for r in AD_REFS[aid]:
        kind, name = r.split(':')
        refs.append(os.path.join(STILLS, 'locations', name + '.png') if kind == 'loc' else os.path.join(STILLS, 'keys', name + '.png'))
    return refs, AD_PRE[aid] + asset['image']


def legs():
    d = json.load(open(SHOTLIST))
    out = {}
    for s in d['shots']:
        for L in s.get('legs') or []:
            out[L['leg'].split()[0]] = dict(shot=s['id'], **L)
    return out


def leg_job(key, L):
    loc = os.path.join(STILLS, 'locations', LEG_LOC[key] + '.png')
    if key == '1a':                       # the dark module interior through a hatch: no person, no sheet fits
        return [], L['key_frame']
    if key == '1b':                       # the station wide; she is a tiny figure far along the truss
        return [loc], ('Image 1 is the location: keep its architecture, materials and design, seen from much higher '
                       'and wider. ') + L['key_frame']
    if key == '26':
        refs, pre = [SHEET['helmet-off'], loc], PRE_FACE.replace('the helmet camera on her right, ', '').replace(
            'from the front and back', 'from the front and back with the helmet off and no backpack')
    elif key in NO_FACE:
        sheet = SHEET['props'] if key == '21' else SHEET['costume']
        refs, pre = [sheet, loc], ('Image 1 shows the exact design of the %s. ' % ('wrench' if key == '21' else
                                                                                 'gloves, wrist display and suit fabric'))
    else:
        refs, pre = [SHEET['eva'], loc], PRE_FACE + ('In this shot the backpack is removed. ' if key == '24' else '')
    return refs, pre + PRE_LOC + EXTRA.get(key, '') + L['key_frame']


def batch_keys(batch, only):
    L = legs()
    keys = IDENTITY if batch == 'identity' else [k for k in LEG_LOC if k not in IDENTITY]
    if only:
        keys = [k for k in keys if k in only.split(',')]
    return [(k, L[k]) for k in keys]


def quote(rows):
    # measured: 2K output ~7.4k tokens per image at $30/M; a 2560x1440 reference ~3,016 input tokens at $8/M (Round 2
    # identity batch: 6,032 image tokens for two references); ~800 text tokens at $5/M
    lo = sum(n * 7300 * 30e-6 + r * 3016 * 8e-6 + 0.004 for n, r in rows)
    hi = sum(n * 7700 * 30e-6 + r * 3016 * 8e-6 + 0.004 for n, r in rows)
    return lo, hi


def cmd_plan(a):
    batches = [a.batch] if a.batch else ['locations', 'identity', 'rest', 'ad']
    for b in batches:
        rows = []
        if b == 'ad':
            for aid, asset in ad_assets().items():
                refs, prompt = ad_job(aid, asset)
                rows.append((2, len(refs)))
                print('  %-3s refs=%-40s words=%d%s' % (aid, ','.join(os.path.basename(r) for r in refs), len(prompt.split()),
                                                       '  BANNED %s' % lib.banned(prompt) if lib.banned(prompt) else ''))
        elif b == 'locations':
            for name, (refs, prompt) in LOCATIONS.items():
                rows.append((2, len(refs)))
                print('  %-17s refs=%-6s words=%d%s' % (name, ','.join(refs) or '-', len(prompt.split()),
                                                        '  BANNED %s' % lib.banned(prompt) if lib.banned(prompt) else ''))
        else:
            for k, L in batch_keys(b, a.only):
                refs, prompt = leg_job(k, L)
                rows.append((2, len(refs)))
                print('  %-4s %-4s refs=%-40s words=%d%s' % (L['shot'], k, ','.join(os.path.basename(r) for r in refs),
                                                            len(prompt.split()),
                                                            '  BANNED %s' % lib.banned(prompt) if lib.banned(prompt) else ''))
        lo, hi = quote(rows)
        print('%s: %d calls x 2 variants = %d images at 2560x1440, quote $%.2f-$%.2f' % (b, len(rows), 2 * len(rows), lo, hi))
    print('Round 2 spent so far $%.2f; cap $%.2f' % (lib.spent(), a.cap))


def cmd_locations(a):
    for name, (refs, prompt) in LOCATIONS.items():
        if a.only and name not in a.only.split(','):
            continue
        rp = [SHEET[r] for r in refs]
        imgs, size = lib.call('edits' if rp else 'generations', prompt, rp, 2, a.cap, 'location %s' % name)
        for i, png in enumerate(imgs, 1):
            lib.save(os.path.join(STILLS, 'locations', '%s-v%d.png' % (name, i)), png,
                     {'model': lib.MODEL, 'size': size, 'quality': 'high', 'n': 2,
                      'refs': [os.path.relpath(r, JOB) for r in rp], 'prompt': prompt})
    print('Round 2 ledger total $%.2f' % lib.spent())


def cmd_pick_location(a):
    src = os.path.join(STILLS, 'locations', '%s-%s.png' % (a.name, a.variant))
    dst = os.path.join(STILLS, 'locations', a.name + '.png')
    if os.path.lexists(dst):
        os.remove(dst)
    os.symlink(os.path.basename(src), dst)
    print('%s -> %s' % (os.path.relpath(dst, JOB), os.path.basename(src)))


def cmd_keys(a):
    for k, L in batch_keys(a.batch, a.only):
        refs, prompt = leg_job(k, L)
        for r in refs:
            if not os.path.exists(r):
                sys.exit('missing reference %s (pick the location first)' % r)
        imgs, size = lib.call('edits' if refs else 'generations', prompt, refs, 2, a.cap, 'key %s %s' % (L['shot'], k))
        for i, png in enumerate(imgs, a.first):
            lib.save(os.path.join(STILLS, 'keys', '%s-%s-v%d.png' % (L['shot'], k, i)), png,
                     {'model': lib.MODEL, 'size': size, 'quality': 'high', 'n': 2, 'leg': L['leg'],
                      'use': L['use'], 'refs': [os.path.relpath(os.path.realpath(r), JOB) for r in refs], 'prompt': prompt})
    print('Round 2 ledger total $%.2f' % lib.spent())


def cmd_ad(a):
    for aid, asset in ad_assets().items():
        if a.only and aid not in a.only.split(','):
            continue
        refs, prompt = ad_job(aid, asset)
        for r in refs:
            if not os.path.exists(r):
                sys.exit('missing reference %s' % r)
        imgs, size = lib.call('edits' if refs else 'generations', prompt, refs, 2, a.cap, 'ad %s' % aid)
        for i, png in enumerate(imgs, a.first):
            lib.save(os.path.join(STILLS, 'ad', '%s-v%d.png' % (aid, i)), png,
                     {'model': lib.MODEL, 'size': size, 'quality': 'high', 'n': 2, 'asset': aid, 'slot': asset['slot'],
                      'refs': [os.path.relpath(os.path.realpath(r), JOB) for r in refs], 'prompt': prompt})
    print('Round 2 ledger total $%.2f' % lib.spent())


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['plan', 'locations', 'pick-location', 'keys', 'ad', 'cost'])
    ap.add_argument('name', nargs='?')
    ap.add_argument('variant', nargs='?')
    ap.add_argument('--batch', choices=['locations', 'identity', 'rest', 'ad'])
    ap.add_argument('--only')
    ap.add_argument('--cap', type=float, default=12.0)
    ap.add_argument('--first', type=int, default=1, help='first variant number (3 for a re-roll, so v1/v2 are kept)')
    a = ap.parse_args()
    os.makedirs(STILLS, exist_ok=True)
    if a.cmd == 'cost':
        lib.cmd_cost(a)
    else:
        {'plan': cmd_plan, 'locations': cmd_locations, 'pick-location': cmd_pick_location, 'keys': cmd_keys,
         'ad': cmd_ad}[a.cmd](a)
