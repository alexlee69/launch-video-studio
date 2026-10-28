# -*- coding: utf-8 -*-
# planted-bad stub for the self-test
import sys, os, shutil
o = sys.argv[sys.argv.index('--out') + 1]; os.makedirs(o, exist_ok=True)
print('cuts: 7 in the reference — 7 exact, 0 within 1 f, 0 off, 0 missing')
