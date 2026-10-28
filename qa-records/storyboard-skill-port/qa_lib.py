# -*- coding: utf-8 -*-
"""Shared helpers for the storyboard-port QA suites. No network, no keys, nothing spent."""
import json, os, shutil, subprocess, sys

QA = os.path.dirname(os.path.abspath(__file__))
V = os.environ.get('SB_QA_VIDEO') or os.path.expanduser('~/.claude/skills/product-launch-sting/video')   # SB_QA_VIDEO: run against another copy
PH = os.path.join(V, 'storyboard', 'placeholders.py')
PHONE = os.path.join(V, 'storyboard', 'phone.mjs')
LV = os.path.join(V, 'lv.mjs')
PY = '/usr/bin/python3'
RESULTS = []


def run(cmd, cwd=None, timeout=600):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout + p.stderr


def ph(args, cwd):
    return run([PY, '-B', PH] + args, cwd=cwd)


def phone(args):
    return run(['node', PHONE] + args)


def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok)))
    print('%s  %s%s' % ('PASS' if ok else 'FAIL', name, ('  [' + detail.strip().replace('\n', ' | ')[:300] + ']') if (detail and not ok) else ''))


def fresh(path):
    shutil.rmtree(path, ignore_errors=True)
    os.makedirs(path)
    return path


def stub_job(d):
    """a folder placeholders.py accepts as a job (root must hold beats.yaml)"""
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'beats.yaml'), 'w').write('title: stub\n')
    return d


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)


def done(suite):
    n, ok = len(RESULTS), sum(1 for _, r in RESULTS if r)
    print('\n%s: %d/%d PASS' % (suite, ok, n))
    sys.exit(0 if ok == n and n else 1)


def plates_spec(crops=None):
    """the three-plate spec the flow and failure suites draw"""
    return {
        'root': '..', 'out': 'assets/plates', 'aspect': '16x9', 'crops': crops or [], 'kind': 'AI FOOTAGE',
        'cast': {'hero': {'body': '#e6e8eb', 'accent': '#e8611e', 'skin': '#a7795a', 'hair': '#1b1b1f'}},
        'defaults': {'grain': 4},
        'plates': {
            'name': {'line': 'She runs along the harbour wall at dusk', 'lens': '50 mm', 'move': 'tracking left', 'look': 'dusk',
                     'horizon': {'y': 0.66, 'color': '#2a2f3a', 'line': True},
                     'fx': [{'kind': 'glow', 'x': 0.25, 'y': 0.55, 'r': 0.35, 'color': '#ffb27a'}, {'kind': 'stars', 'n': 80, 'box': [0, 0, 1, 0.35]}],
                     'figures': [{'who': 'hero', 'x': 0.5, 'feet': 0.9, 'height': 0.5, 'pose': 'walk', 'facing': 'left', 'tag': 'Hero, mid-stride'}]},
            'hook': {'line': 'A hand holds a phone at dusk', 'lens': '85 mm', 'move': 'locked off', 'look': 'interior-cool',
                     'fx': [{'kind': 'vignette', 'strength': 0.4}],
                     'figures': [{'who': 'hero', 'x': 0.5, 'feet': 1.05, 'height': 0.8, 'pose': 'bust', 'facing': 'camera'}],
                     'props': [{'kind': 'phone', 'x': 0.5, 'y': 0.78, 'w': 0.08, 'front': True, 'tag': 'the phone'}]},
            'ask': {'line': 'Late at the kitchen table, rain on the window', 'lens': '35 mm', 'move': 'slow push in', 'look': 'interior-warm',
                    'fx': [{'kind': 'rain', 'n': 300}, {'kind': 'fog', 'n': 6}],
                    'shapes': [{'kind': 'poly', 'points': [[0, 0.72], [1, 0.72], [1, 1], [0, 1]], 'color': '#4a3424'},
                               {'kind': 'line', 'points': [[0.1, 0.3], [0.3, 0.2]], 'width': 6}],
                    'figures': [{'who': 'hero', 'x': 0.42, 'feet': 0.88, 'height': 0.55, 'pose': 'sit', 'facing': 'right', 'tag': 'She types'},
                                {'x': 0.8, 'feet': 0.9, 'height': 0.4, 'pose': 'stand', 'facing': 'away'},
                                {'x': 0.2, 'feet': 0.9, 'height': 0.4, 'pose': 'float', 'facing': 'camera', 'bracket': False}],
                    'props': [{'kind': 'laptop', 'x': 0.6, 'y': 0.72, 'w': 0.14, 'front': True}, {'kind': 'screen', 'x': 0.75, 'y': 0.3, 'w': 0.1},
                              {'kind': 'card', 'x': 0.1, 'y': 0.5, 'w': 0.08}, {'kind': 'box', 'x': 0.9, 'y': 0.8, 'w': 0.05}, {'kind': 'ball', 'x': 0.3, 'y': 0.9, 'w': 0.03}],
                    'thirds': True,
                    'end': {'label': 'MCU, the screen lights her face', 'look': 'interior-warm',
                            'figures': [{'who': 'hero', 'x': 0.4, 'feet': 1.0, 'height': 0.8, 'pose': 'bust', 'facing': 'right'}]}},
        },
    }


def strip_marker(path):
    """re-save a PNG the way another app would: same pixels, no lv-placeholder chunk"""
    from PIL import Image
    with Image.open(path) as im:
        im.load()
        im.save(path + '.tmp.png', 'PNG')
    os.replace(path + '.tmp.png', path)
