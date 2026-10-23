import sys, json
for r in json.load(open(sys.argv[1])):
    if 'TL' not in r or r['TL'] is None: print(r.get('n'), 'none'); continue
    w = ((r['TR'][0]-r['TL'][0]) + (r['BR'][0]-r['BL'][0]))/2
    hl = r['BL'][1]-r['TL'][1]; hr = r['BR'][1]-r['TR'][1]
    print(r['n'], 'TL', r['TL'], 'TR', r['TR'], 'BR', r['BR'], 'BL', r['BL'], ' w %.1f hl %.1f hr %.1f' % (w, hl, hr), 'res', [round(r[k][2], 2) if r[k] else None for k in 'LRTB'])
