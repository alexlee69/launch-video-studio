#!/usr/bin/env python3
"""Round 1: The Lull's astronaut character sheet on OpenAI gpt-image-2 (Alex's rule: stills on the OpenAI key, fal for
video only), built the Higgsfield way (Academy "One face per character sheet"; OSideMedia ad-asset-prep "Design for win
rate"). Memory: feedback_character_sheet_one_face.

  - A sheet is ONE image: close-up + full body front + full body back, on flat solid neutral grey #8a8a8a, no floor.
  - Make many candidate sheets, Alex picks one, then lock ONE face: erase the face from the front full-body panel.
  - Each state is its own sheet (helmet off on the sea); costume details and props go on faceless sheets.

  python3 cast_sheet.py plan                              every request + cost estimate; no network
  python3 cast_sheet.py candidates [--fresh 4] [--from A,B]
                                                          candidate sheets: fresh (one generations call) + built from
                                                          the face masters in round1/A|B/05-identity-master.png
  python3 cast_sheet.py review                            round1/candidates.png, numbered for Alex's phone
  python3 cast_sheet.py lock --pick cand-03               after Alex's pick: erase the front body's face -> locked/eva.png
  python3 cast_sheet.py states                            from locked/eva.png: helmet-off sheet, costume sheet, props sheet
  python3 cast_sheet.py cost                              spend so far from the ledger

Every call goes to cast/round1/ledger.jsonl with the API's token usage; a call is refused when the ledger total plus its
estimate would pass --cap (default $8.50; Alex approved ~$6-7.50). The key is read from the stable checkout's .env with
Python and never printed. Prompts are checked against the storyboard's ban lists before any call."""
import argparse, base64, json, os, re, sys, time, threading

sys.path.insert(0, os.path.expanduser('~/Downloads/launch-videos/hf01-study/storyboard-space/final/tools'))
from final_data import CHAR, NEG, BANNED_WORLD, BANNED_PLACES  # noqa: E402

JOB = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
CAST = os.path.join(JOB, 'cast')
OUT = os.path.join(CAST, 'round1')
CANDS = os.path.join(OUT, 'candidates')
LOCKED = os.path.join(CAST, 'locked')
PATCH = os.path.join(CAST, 'refs', 'patch.png')
LEDGER = os.path.join(OUT, 'ledger.jsonl')
ENV = os.path.expanduser('~/Downloads/Design-AutoPilot-stable/.env')
MODEL = 'gpt-image-2'
SIZES = ['2560x1440', '2048x1152', '1536x1024']        # 2K first (Higgsfield's lesson runs High + 2K); step down on a 400
# Segmind's per-modality rate card for gpt-image-2 (USD per 1M tokens); the ledger keeps raw usage so this can be redone.
RATE = {'text_in': 5.0, 'image_in': 8.0, 'out': 30.0}
EST_OUT = {'2560x1440': 8000, '2048x1152': 8000, '1536x1024': 7100}   # high-quality output tokens (2K measured 7.4-7.6k)
EST_REF_IN = 1100                                                       # per reference image (measured 1024)

GREY = ('on a flat solid neutral grey background (#8a8a8a), seamless, no gradient, no floor, no shadow on the '
        'background, even soft studio light')
TAIL = ('Photographic, natural skin texture, unretouched, realistic, not a stock photo. One clean subject, no props, no '
        'text, no labels, no numbers, no watermark. ' + NEG)
SIDES = ('Her mission patch and wrist display are on her own LEFT side: in the front view they are on the right side of '
         'the picture; in the back view the patch is on the left side of the picture.')
LAYOUT = ('A character reference sheet for a film: ONE image with three side-by-side panels of equal width separated by '
          'thin gutters, ' + GREY + '. LEFT panel: a front-facing close-up of her head and shoulders filling the panel, '
          'eyes to camera, calm with a hint of dry amusement, her whole face clearly visible through the clear bubble '
          'with no reflection across her eyes, the small pale scar through her own left eyebrow visible. MIDDLE panel: '
          'her full body from the front, head to boots, standing upright and relaxed, arms slightly away from her sides. '
          'RIGHT panel: her full body from directly behind in the same stance, showing the white life-support backpack '
          'and an orange-sleeved safety tether on a small reel at her waist ending in a steel hook. ' + SIDES)
FROM_MASTER = ('Image 1 is the identity master. Keep exactly this woman: the same face, the same strong dark eyebrows and '
               'the small pale scar through her own LEFT eyebrow, the same warm brown skin, dark brown eyes and laugh '
               'lines; the same helmet, comms cap and suit. ')

# Alex, 10-23: the astronaut is either Asian or white (not Black); he chose an East Asian woman (cand-02), and CHAR in
# final_data now says so. Candidate looks swap only CHAR's person clause (everything before the eyebrows).
_WHO = CHAR.split(', strong expressive', 1)[0]
assert _WHO != CHAR and len(_WHO) < 90, _WHO
CHAR_ASIAN = CHAR.replace(_WHO, 'an East Asian woman of about 40 with light warm skin', 1)
CHAR_WHITE = CHAR.replace(_WHO, 'a white woman of about 40 with fair, lightly freckled skin', 1).replace('dark brown eyes',
                                                                                                        'grey-blue eyes')
JOBS = {  # name: (endpoint, refs, prompt) -- refs are paths or tokens resolved at run time
    'fresh': ('generations', [], LAYOUT + ' She is ' + CHAR + '. ' + TAIL),
    'asian': ('generations', [], LAYOUT + ' She is ' + CHAR_ASIAN + '. ' + TAIL),
    'white': ('generations', [], LAYOUT + ' She is ' + CHAR_WHITE + '. ' + TAIL),
    'from': ('edits', ['<master>'], FROM_MASTER + LAYOUT + ' She is ' + CHAR + '. ' + TAIL),
    'lock': ('edits', ['<pick>'],
             'This is a character reference sheet in three panels. Make exactly these three changes and nothing else. '
             '1) MIDDLE panel (full body, front): erase her face. Inside its clear helmet bubble show only the black '
             'comms cap and a soft plain shadow where the face was: no eyes, no nose, no mouth. '
             '2) The small helmet camera belongs on her own RIGHT side of the helmet. In the LEFT and MIDDLE panels, '
             'where she faces us, it must sit on the LEFT side of the picture, next to that lamp; remove it from the '
             'right side of the picture. In the RIGHT panel, seen from behind, it sits on the right side of the picture. '
             '3) RIGHT panel (seen from behind): the round mission patch belongs on her own LEFT shoulder, which from '
             'behind is on the LEFT side of the picture. Remove the patch from the shoulder on the right side of the '
             'picture and put the same patch on the shoulder on the left side of the picture. '
             'Keep everything else exactly as it is: the close-up face in the left panel unchanged, the same flat '
             'grey, the same suit, the same poses, the same framing and layout.'),
    'helmet-off': ('edits', ['<locked>'],
                   'Image 1 is her locked character sheet. Make her second state as a new sheet with the same layout, '
                   'the same flat solid neutral grey background (#8a8a8a) and the same woman: the helmet and comms cap '
                   'are OFF and there is NO backpack. LEFT panel: a front-facing close-up of her head and shoulders, '
                   '{HAIR}, cropped close at the sides and damp from the sea, a few drops on her skin, '
                   'eyes to camera, tired and quietly pleased, the small pale scar through her own left eyebrow visible. '
                   'MIDDLE panel: her full body from the front, holding the clear bubble helmet against her hip, the '
                   'face area of this panel left as a soft plain shadow with no features. RIGHT panel: her full body '
                   'from behind, no backpack, damp hair. The suit is the same suit, slightly wet. ' + SIDES + ' ' + TAIL),
    'costume': ('edits', ['<locked>', PATCH],
                'Image 1 is her locked character sheet; image 2 is her mission patch. A faceless costume detail sheet: '
                'ONE image of six close-up product photographs in a 3 x 2 grid of equal tiles with thin gutters, ' + GREY +
                ', no person and no face anywhere: 1 the round embroidered mission patch exactly as image 2, on white '
                'suit fabric; 2 the slim wrist display under its padded white cover with a small window strip, strapped '
                'on the white sleeve; 3 the same wrist display with the cover open, the dark screen glowing softly and '
                'unreadable; 4 the empty clear bubble helmet with its black comms cap inside, two small lamps on its '
                'sides, a small camera on its right side and the gold visor raised; 5 a white glove with orange '
                'fingertip grips; 6 the tether reel at the waist with the orange-sleeved line and a steel hook. ' + TAIL),
    'props': ('edits', ['<locked>'],
              'Image 1 shows the costume world these props belong to. A faceless props sheet: ONE image of four product '
              'photographs in a 2 x 2 grid of equal tiles with thin gutters, ' + GREY + ', no person: 1 a small white '
              'padded tool bag with an orange pull tab and a carabiner; 2 a small silver wrench; 3 a small pale '
              'blue-grey plush toy whale on a short cord, soft and well loved; 4 a small white gumdrop-shaped space '
              'capsule with one orange band around it and a hatch on top, plain and fictional, in three-quarter view. '
              + TAIL),
}


def key():
    for line in open(ENV, encoding='utf-8'):
        m = re.match(r'^\s*OPENAI_API_KEY\s*=\s*(.*?)\s*$', line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    sys.exit('OPENAI_API_KEY not found in ' + ENV)


def banned(prompt):
    return [w for w in BANNED_WORLD + BANNED_PLACES
            if re.search(r'(?<![A-Za-z])' + re.escape(w) + r'(?![A-Za-z])', prompt, re.I)]


def est(size, nrefs, n=1):
    return n * EST_OUT[size] * RATE['out'] / 1e6 + nrefs * EST_REF_IN * RATE['image_in'] / 1e6 + 500 * RATE['text_in'] / 1e6


def cost(usage):
    d = usage.get('input_tokens_details') or {}
    img_in = d.get('image_tokens', 0)
    txt_in = d.get('text_tokens', usage.get('input_tokens', 0) - img_in)
    return txt_in * RATE['text_in'] / 1e6 + img_in * RATE['image_in'] / 1e6 + usage.get('output_tokens', 0) * RATE['out'] / 1e6


_lock = threading.Lock()


def spent():
    if not os.path.exists(LEDGER):
        return 0.0
    return sum(json.loads(l).get('usd', 0) for l in open(LEDGER) if l.strip())


def log(rec):
    with _lock:
        with open(LEDGER, 'a') as f:
            f.write(json.dumps(rec) + '\n')


def call(endpoint, prompt, refs, n, cap, label):
    """POST with the size ladder: a 400 that names the size steps down (free); 429/5xx/network retry once."""
    import requests
    bad = banned(prompt)
    if bad:
        raise SystemExit('REFUSED %s: banned words in prompt: %s' % (label, bad))
    for p in refs:
        if not os.path.exists(p):
            raise SystemExit('REFUSED %s: missing reference %s' % (label, p))
    sizes = list(SIZES)
    retried = False
    while sizes:
        size = sizes[0]
        e = est(size, len(refs), n)
        if spent() + e > cap:
            raise SystemExit('REFUSED %s at %s: spent $%.2f + est $%.2f > cap $%.2f' % (label, size, spent(), e, cap))
        fields = {'model': MODEL, 'prompt': prompt, 'n': n, 'size': size, 'quality': 'high'}
        t0 = time.time()
        try:
            if refs:
                opened = [('image[]', (os.path.basename(p), open(p, 'rb'), 'image/png')) for p in refs]
                try:
                    r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': 'Bearer ' + key()},
                                      data={k: str(v) for k, v in fields.items()}, files=opened, timeout=(30, 900))
                finally:
                    for _, (_, fp, _) in opened:
                        fp.close()
            else:
                r = requests.post('https://api.openai.com/v1/images/generations', headers={'Authorization': 'Bearer ' + key()},
                                  json=fields, timeout=(30, 900))
        except (OSError, ValueError) as ex:          # requests' connection errors and timeouts subclass OSError
            log({'label': label, 'size': size, 'status': 'neterr', 'error': repr(ex)[:300], 'usd': 0, 's': round(time.time() - t0)})
            if retried:
                raise RuntimeError('%s: network error twice' % label)
            retried = True
            time.sleep(15)
            continue
        if r.status_code == 400 and 'size' in r.text.lower() and len(sizes) > 1:
            log({'label': label, 'size': size, 'status': 400, 'error': r.text[:300], 'usd': 0, 's': round(time.time() - t0)})
            print('  %s: size %s rejected, stepping down' % (label, size), flush=True)
            sizes.pop(0)
            continue
        if r.status_code in (429, 500, 502, 503, 504) and not retried:
            log({'label': label, 'size': size, 'status': r.status_code, 'error': r.text[:300], 'usd': 0, 's': round(time.time() - t0)})
            retried = True
            time.sleep(30)
            continue
        if r.status_code != 200:
            log({'label': label, 'size': size, 'status': r.status_code, 'error': r.text[:500], 'usd': 0, 's': round(time.time() - t0)})
            raise RuntimeError('%s HTTP %s: %s' % (label, r.status_code, r.text[:500]))
        data = r.json()
        usage = data.get('usage') or {}
        usd = cost(usage) if usage else e
        log({'label': label, 'size': size, 'status': 200, 'n': n, 'refs': [os.path.relpath(p, JOB) for p in refs],
             'usage': usage, 'usd': round(usd, 4), 'usd_from': 'usage' if usage else 'estimate', 's': round(time.time() - t0)})
        print('  %s: %d image(s) at %s, $%.3f, %ds' % (label, len(data['data']), size, usd, time.time() - t0), flush=True)
        return [base64.b64decode(d['b64_json']) for d in data['data']], size
    raise RuntimeError('%s: no size accepted' % label)


def save(p, png, req):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(png)
    json.dump(req, open(p[:-4] + '.req.json', 'w'), indent=1)
    print('  saved %s' % os.path.relpath(p, JOB), flush=True)


def next_cand():
    os.makedirs(CANDS, exist_ok=True)
    have = [int(m.group(1)) for f in os.listdir(CANDS) for m in [re.match(r'cand-(\d+)\.png$', f)] if m]
    return max(have, default=0) + 1


def cmd_plan(a):
    tot = 0
    rows = [('%s x%d' % (j, a.fresh), j, a.fresh, 1) for j in a.who.split(',') if j and a.fresh] + \
           [('from %s' % f, 'from', 1, 1) for f in a.from_.split(',') if f] + \
           [(j, j, 1, 1) for j in ('lock', 'helmet-off', 'costume', 'props')]
    for label, job, n, _ in rows:
        endpoint, refs, prompt = JOBS[job]
        e = est(SIZES[0], len(refs), n)
        tot += e
        b = banned(prompt)
        print('%-12s %-11s refs=%d words=%-4d est $%.2f at %s%s' % (label, endpoint, len(refs), len(prompt.split()), e, SIZES[0],
                                                                   '  BANNED: %s' % b if b else ''))
    print('estimated $%.2f at 2K (less if 2K is refused); spent so far $%.2f; cap $%.2f' % (tot, spent(), a.cap))
    if any(banned(j[2]) for j in JOBS.values()):
        sys.exit(1)


def cmd_candidates(a):
    for f in [f for f in a.from_.split(',') if f]:
        m = os.path.join(OUT, f, '05-identity-master.png')
        endpoint, _, prompt = JOBS['from']
        imgs, size = call(endpoint, prompt, [m], 1, a.cap, 'sheet from face %s' % f)
        save(os.path.join(CANDS, 'cand-%02d.png' % next_cand()), imgs[0],
             {'endpoint': endpoint, 'model': MODEL, 'size': size, 'quality': 'high', 'source': 'face ' + f,
              'refs': [os.path.relpath(m, JOB)], 'prompt': prompt})
    for job in [j for j in a.who.split(',') if j] if a.fresh else []:
        endpoint, _, prompt = JOBS[job]
        imgs, size = call(endpoint, prompt, [], a.fresh, a.cap, '%s sheets x%d' % (job, a.fresh))
        for png in imgs:
            save(os.path.join(CANDS, 'cand-%02d.png' % next_cand()), png,
                 {'endpoint': endpoint, 'model': MODEL, 'size': size, 'quality': 'high', 'source': job, 'n': a.fresh,
                  'prompt': prompt})
    print('ledger total $%.2f' % spent())


def cmd_review(a):
    from PIL import Image, ImageDraw, ImageFont
    fs = sorted(f for f in os.listdir(CANDS) if re.match(r'cand-\d+\.png$', f))
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 56)
    W, H = 1600, 900
    sh = Image.new('RGB', (W, (H + 10) * len(fs)), (20, 20, 22))
    for i, f in enumerate(fs):
        im = Image.open(os.path.join(CANDS, f)).convert('RGB').resize((W, H), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 120, 80], fill=(0, 0, 0))
        d.text((22, 8), str(int(f[5:7])), fill=(255, 220, 90), font=font)
        sh.paste(im, (0, i * (H + 10)))
    sh.save(os.path.join(OUT, 'candidates.png'))
    print('%d candidates -> %s' % (len(fs), os.path.join(OUT, 'candidates.png')))


def cmd_lock(a):
    pick = os.path.join(CANDS, a.pick + '.png')
    endpoint, _, prompt = JOBS['lock']
    imgs, size = call(endpoint, prompt, [pick], 1, a.cap, 'lock %s' % a.pick)
    # the raw edit; locked/eva.png is this with the untouched close-up face restored (edits soften skin)
    save(os.path.join(LOCKED, 'eva-edit.png'), imgs[0], {'endpoint': endpoint, 'model': MODEL, 'size': size,
                                                         'quality': 'high', 'refs': [os.path.relpath(pick, JOB)],
                                                         'prompt': prompt})


def cmd_states(a):
    eva = os.path.join(LOCKED, 'eva.png')
    for job in (a.only.split(',') if a.only else ['helmet-off', 'costume', 'props']):
        endpoint, refs, prompt = JOBS[job]
        if '{HAIR}' in prompt:
            if not a.hair:
                raise SystemExit('helmet-off needs --hair, e.g. --hair "short black hair" (from the picked face)')
            prompt = prompt.replace('{HAIR}', a.hair)
        refs = [eva if r == '<locked>' else r for r in refs]
        imgs, size = call(endpoint, prompt, refs, 1, a.cap, job)
        save(os.path.join(LOCKED, job + '.png'), imgs[0], {'endpoint': endpoint, 'model': MODEL, 'size': size, 'quality': 'high',
                                                          'refs': [os.path.relpath(r, JOB) for r in refs], 'prompt': prompt})
    print('ledger total $%.2f' % spent())


def cmd_cost(a):
    rows = [json.loads(l) for l in open(LEDGER)] if os.path.exists(LEDGER) else []
    for r in rows:
        print('%-24s %-10s %-6s $%.3f %ss' % (r['label'], r.get('size', r.get('fields', {}).get('size', '')), r['status'],
                                            r.get('usd', 0), r.get('s')))
    print('calls %d, spent $%.2f' % (len(rows), spent()))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['plan', 'candidates', 'review', 'lock', 'states', 'cost'])
    ap.add_argument('--fresh', type=int, default=2, help='sheets per --who look (one generations call each)')
    ap.add_argument('--who', default='asian,white')
    ap.add_argument('--from', dest='from_', default='')
    ap.add_argument('--hair')
    ap.add_argument('--pick')
    ap.add_argument('--only')
    ap.add_argument('--cap', type=float, default=8.50)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    {'plan': cmd_plan, 'candidates': cmd_candidates, 'review': cmd_review, 'lock': cmd_lock, 'states': cmd_states,
     'cost': cmd_cost}[a.cmd](a)
