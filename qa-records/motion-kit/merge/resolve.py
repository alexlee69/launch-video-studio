# Resolve git merge-file conflict hunks by index: choose 'ours', 'theirs', 'both' or a literal replacement string.
import sys, re
def resolve(path, choices, out):
    txt = open(path, encoding='utf-8').read()
    pat = re.compile(r'^<<<<<<< [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n', re.S | re.M)
    hunks = list(pat.finditer(txt))
    assert len(hunks) == len(choices), (len(hunks), len(choices))
    res, last = [], 0
    for m, c in zip(hunks, choices):
        res.append(txt[last:m.start()])
        a, b = m.group(1), m.group(2)
        if callable(c): res.append(c(a, b))
        elif c == 'ours': res.append(a)
        elif c == 'theirs': res.append(b)
        elif c == 'both': res.append(a + b)
        else: res.append(c)
        last = m.end()
    res.append(txt[last:])
    s = ''.join(res)
    assert '<<<<<<<' not in s and '>>>>>>>' not in s
    open(out, 'w', encoding='utf-8').write(s)
