# -*- coding: utf-8 -*-
"""Writes qa/motion-kit/results/page/index.html (the motion-kit results page) from the assets build_assets.py made."""
import html, os

HERE = os.path.dirname(os.path.abspath(__file__))
OFFS = [-12, -6, -3, -1, 0, 2, 6, 14]
TRANSITIONS = [
    ('dive-globe', 'Dive', 'globe → name', 'the globe turns towards us and the camera falls into it',
     'The dots swell past the lens and the next shot arrives still flying forward: the dots become the stars.'),
    ('flood-ask', 'Flood, then grow from a point', 'ask → trips', 'the cursor presses send',
     'Night pours out of the send button and covers the frame; the first trip is born as a speck where the cursor was and grows into the fan.'),
    ('carry-spots', 'Carry', 'spots → day', 'the lit tile lifts off the wall',
     'The lit cove tile leaves the wall and keeps moving across the cut; it lands as the postcard.'),
    ('dive-day', 'Dive into a picture', 'day → words', 'the postcard settles and the camera falls into it',
     'The camera falls into the postcard and lands inside it: the word beats play over the same cove.'),
    ('morph-go', 'Morph to frame', 'go → end', 'Send is pressed',
     'The prompt box grows to fill the frame in the end card’s navy; the lockup lands on it.'),
]
SCORES = [
    ('Opus review', 'the merged build', 'mixed', '21 findings (3 high): 18 fixed, 3 fixed in part'),
    ('QA1, round 1', 'the new work, frame by frame', 'fail', '3 visual glitches that every automatic check missed'),
    ('QA1, round 2', 'after one fix round', 'pass', '18 films, 6 layer exports and the alpha clip'),
    ('QA2', 'old jobs stay as they were', 'pass', '215 of 219 storyboard frames byte-identical; the 4 others are known run-to-run noise'),
    ('QA3', 'the new checks', 'pass', 'each one fires on a planted bad shot and stays quiet on a good one'),
    ('Live smoke film', 'a fresh 15 s starter on the live skill', 'pass', 'QA PASSED, 17 checks'),
    ('Test suites', 'shot writer, casting, storyboard', 'pass', '276 checks (17 + 48 + 16 + 57 + 90 + 48)'),
    ('Wayfinch sample', 'the films below, 3 aspects', 'pass', 'QA PASSED, 16 checks each'),
]
CHIP = {'pass': 'Pass', 'fail': 'Fail', 'mixed': 'Fixed'}
BLOCKS = [('globe', 'particles', 'A dot globe with orbits; it can also burst, become a star field, a halftone grid or a terrain.'),
          ('ask', 'press', 'A big cursor arcs in and presses one control; rings burst from it.'),
          ('trips', 'fan', 'One card deals out into a 3D arc of clips, then the camera pushes into the pick.'),
          ('route', 'map', 'A drawn city; the route draws itself, pins drop on the beat.')]
MODES = [('spots', 'wall layout: grid', 'A mosaic cascades in; one tile lights, the rest dim.'),
         ('words', 'type words', 'One word per beat, mixed faces.'),
         ('booked', 'stack mode: exploded', 'UI layers pull apart, with labels on leader lines.')]
OPEN = [('Medium', 'The 9:16 exploded stack fills only about a third of the frame height.'),
        ('Medium', 'In one test film a carried prompt box hangs over its neighbouring tiles for about 8 frames.'),
        ('Medium', 'One fan frame gets a purity warning: a footage card isn’t ready when the frame is drawn.'),
        ('Medium', 'Films render about 31 % slower (148 s → 194 s on steady-sample), mostly the purity re-draws.'),
        ('Medium', 'The reading-time rule is noisy: it warns on 34 of 63 old shots, and a fresh starter gets 4–6 notes.'),
        ('Low', 'A 2-frame double image of the label under the blur in launch30’s carry (shown above).'),
        ('Low', 'A near-flat frame before one dive lands; an empty oval for 0.27 s in particles grid mode.'),
        ('Low', 'The end-card web address is 31 px and low contrast in every starter (deferred).')]


def esc(s):
    return html.escape(s, quote=True)


def lab(o):
    return 'cut' if o == 0 else ('c%s%d' % ('−' if o < 0 else '+', abs(o)))


def frames(key):
    out = []
    for o in OFFS:
        cls = ' class="cut"' if o == 0 else ''
        out.append('<figure%s><img src="assets/%s_%+d.jpg" alt="%s, frame %s" loading="lazy" width="640" height="360">'
                   '<figcaption>%s</figcaption></figure>' % (cls, key, o, esc(key), lab(o), lab(o)))
    return '\n'.join(out)


tr_html = '\n'.join(
    '<article class="tr"><header><h3>%s <span class="shots">%s</span></h3><p class="cause"><span>cause</span> %s</p></header>'
    '<p class="what">%s</p><div class="strip">%s</div></article>' % (esc(n), esc(s), esc(c), esc(w), frames(k))
    for k, n, s, c, w in TRANSITIONS)
score_html = '\n'.join(
    '<tr><th scope="row">%s</th><td>%s</td><td><span class="chip %s">%s</span></td><td>%s</td></tr>' % (
        esc(a), esc(b), st, CHIP[st], esc(d)) for a, b, st, d in SCORES)


def tiles(items):
    return '\n'.join('<figure class="tile"><img src="assets/piece-%s.jpg" alt="%s" loading="lazy" width="960" height="540">'
                     '<figcaption><code>%s</code><span>%s</span></figcaption></figure>' % (k, esc(n), esc(n), esc(d)) for k, n, d in items)


open_html = '\n'.join('<li><span class="sev %s">%s</span><span>%s</span></li>' % (s.lower(), s, esc(t)) for s, t in OPEN)

page = open(os.path.join(HERE, 'page.tmpl.html'), encoding='utf-8').read()
for k, v in {'{{SCORES}}': score_html, '{{TRANSITIONS}}': tr_html, '{{BLOCKS}}': tiles(BLOCKS), '{{MODES}}': tiles(MODES),
             '{{OPEN}}': open_html}.items():
    assert k in page, k
    page = page.replace(k, v)
open(os.path.join(HERE, 'page', 'index.html'), 'w', encoding='utf-8').write(page)
print('wrote', len(page), 'bytes')
