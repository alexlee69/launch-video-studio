# Per-beat energy profile of a mono wav on a fixed grid: RMS (dB), low/high band split, onset strength.
import sys, wave, json
import numpy as np
path, bpm, first = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
w = wave.open(path); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
beat = 60 / bpm; out = []
k = 0
while first + (k + 1) * beat <= len(x) / sr + 1e-9:
    a, b = int((first + k * beat) * sr), int((first + (k + 1) * beat) * sr)
    seg = x[a:b]; F = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))); f = np.fft.rfftfreq(len(seg), 1 / sr)
    lo = F[f < 200].sum(); mid = F[(f >= 200) & (f < 2500)].sum(); hi = F[f >= 2500].sum(); tot = lo + mid + hi + 1e-9
    rms = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)
    out.append(dict(beat=k, t=round(first + k * beat, 3), frame=round((first + k * beat) * 30, 1), db=round(rms, 1), lo=round(lo / tot, 2), mid=round(mid / tot, 2), hi=round(hi / tot, 2)))
    k += 1
for r in out: print(r)
json.dump(out, open(sys.argv[4], 'w'))
