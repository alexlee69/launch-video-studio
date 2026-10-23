import json, sys
for f in ['launch', 'brief', 'screens', 'brand', 'apps', 'ux', 'core']:
    d = json.load(open('tools/w5/logs/lt_%s.json' % f))[f]
    print('==', f)
    line = []
    for r in d:
        line.append('%d:%.0f,%.0f s%.2f b%.1f a%.2f c%.2f' % (r['n'], r['cx'], r['cy'], r['s'], r['blur'], r['amp'], r['ncc']))
        if len(line) == 4: print('  |  '.join(line)); line = []
    if line: print('  |  '.join(line))
