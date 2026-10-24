# -*- coding: utf-8 -*-
"""Validate the FINAL astronaut storyboard against hf01's verified cut list and write
../SHOTLIST.md, ../shotlist.json, ../COPY.md, ../STORY.md and ../VS-HF01.md (CAST.md is hand-written).

Base: drafts/comedy/tools/build.py, plus the checks the three judges asked for: no agency or hf01-place name inside
any generation prompt, every shot of her film captured before the prompt that needs it, S04's glyph swaps on hf01's
frames, S26's bubbles entering on hf01's frame and clearing before the gull lands, one blue accent on the title card,
and no shared 2-word run (with a content word) with any hf01 or Manus line.

    /usr/bin/python3 -B tools/build.py             build (exit 1 on any failure)
    /usr/bin/python3 -B tools/build.py --selftest  prove the checks fail on planted errors, then build

No network, no generation: it only reads the local study files.
"""
import copy
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)                                                    # storyboard-space/final/
STUDY = os.path.abspath(os.path.join(OUT, "..", ".."))                         # hf01-study/
CUTS = os.path.join(STUDY, "cuts", "cuts.json")
WORDS_JSON = os.path.join(STUDY, "manus2", "study", "words.json")
SHOTS_MD = os.path.join(STUDY, "SHOTS.md")
sys.path.insert(0, HERE)
import final_data as D  # noqa: E402

K = 1920.0 / 1080.0
RATE_USD = 0.16      # MiniMax H3 Max, $ per second at 1080P (skill FOOTAGE.md, prices checked 2026-10-22)
MAX_WPS = 3.0
HF_SEND = [652, 913, 1181, 1641, 1895]
HF_S04_SWAPS = [447, 473, 503, 523, 566]   # hf01's mascot swap frames (OVERLAY-SPEC §7)
HF_B2_BAR = 2004                           # hf01's closing bubble bar frame (OVERLAY-SPEC §6)
ALLOWED_TYPES = {"footage", "overlay-on-footage", "white status screen", "editor screen", "deliverable-in-viewer", "title", "end card"}
PRODUCT = {"manus", "2.0", "cloud", "computer", "studio", "video", "editor", "alchemy", "automations", "automation"}
STOP = {"a", "an", "the", "of", "to", "in", "on", "it", "is", "and", "for", "at", "by", "this", "that", "my", "me", "i",
        "you", "your", "our", "we", "be", "with", "from", "up", "now", "it's", "its", "as", "or", "are"}
NOT_WORDS = {"·", "/", "→", "…", "—", "–", "-", "|", "+", "×"}
COMP = (286, 794, 51, 337)   # the comp's box in the master editor layout


# ---------------------------------------------------------------- helpers
def nwords(text):
    return len([t for t in text.split() if t not in NOT_WORDS and re.search(r"[A-Za-z0-9]", t)])


def toks(s):
    s = s.lower().replace("’", "'").replace("—", " ").replace("–", " ").replace("·", " ").replace("…", " ")
    return [w.strip(".:'!?,\"") for w in re.split(r"[^a-z0-9':.!?,\"]+", s) if w.strip(".:'!?,\"")]


def longest_run(a, b):
    A, B = toks(a), toks(b)
    best = []
    for i in range(len(A)):
        for j in range(len(B)):
            k = 0
            while i + k < len(A) and j + k < len(B) and A[i + k] == B[j + k]:
                k += 1
            if k > len(best):
                best = A[i:i + k]
    return best


def content_overlap(a, b):
    ca = {w for w in toks(a) if w not in STOP and w not in PRODUCT}
    cb = {w for w in toks(b) if w not in STOP and w not in PRODUCT}
    if not ca:
        return 0.0, set()
    sh = ca & cb
    return len(sh) / len(ca), sh


def b1920(box):
    return [round(v * K) for v in box]


def view_of(fr):
    cx, cy, s = fr["cx"], fr["cy"], fr["s"]
    vis = [round(cx - 540 / s, 1), round(cx + 540 / s, 1), round(cy - 304 / s, 1), round(cy + 304 / s, 1)]
    a = ((COMP[0] - vis[0]) * s, (COMP[2] - vis[2]) * s)
    b = ((COMP[1] - vis[0]) * s, (COMP[3] - vis[2]) * s)
    return vis, [round(a[0]), round(b[0]), round(a[1]), round(b[1])]


def hf01_inventory():
    rows, sec = [], False
    for ln in open(SHOTS_MD, encoding="utf-8"):
        if ln.startswith("## 5."):
            sec = True
            continue
        if sec and ln.startswith("## "):
            break
        if not sec or not ln.startswith("| ") or ln.startswith("| #") or ln.startswith("|---"):
            continue
        c = [x.strip() for x in ln.strip().strip("|").split("|")]
        if len(c) < 6 or not c[0].isdigit():
            continue
        f, l = re.search(r"\d+", c[3]), re.search(r"\d+", c[4])
        if f and l:
            rows.append(dict(n=int(c[0]), text=c[1], first=int(f.group()), last=int(l.group()), where=c[5]))
    return rows


def manus_lines():
    wj = json.load(open(WORDS_JSON, encoding="utf-8"))
    out = []
    for e in wj["inventory"]:
        for ln in e.get("lines") or [e.get("text", "")]:
            if ln:
                out.append(ln)
    return out


def snapshot():
    return dict(SHOTS=D.S, PROMPTS=D.PROMPTS, AD=D.AD, HF01_LINES=D.HF01_LINES, MANUS_BANNED=D.MANUS_BANNED,
                BANNED_WORLD=D.BANNED_WORLD, BANNED_PLACES=D.BANNED_PLACES)


def banned_in_prompt(text, data):
    """Names a generation prompt must never contain (naming a thing pulls the model toward it)."""
    hits = []
    for b in data["BANNED_WORLD"]:
        flags = 0 if b.isupper() else re.I
        if re.search(r"\b" + re.escape(b) + r"\b", text, flags):
            hits.append(b)
    for b in data["BANNED_PLACES"]:
        if re.search(r"\b" + re.escape(b) + r"\b", text, re.I):
            hits.append(b)
    return hits


# ---------------------------------------------------------------- validation
def validate(data, cuts, inv, mlines):
    F, W = [], []
    ref = {f"S{s['shot']:02d}": s for s in cuts["shots"]}
    ids = [f"S{i:02d}" for i in range(1, 28)]
    if sorted(data["SHOTS"]) != ids:
        F.append(f"shots are {sorted(data['SHOTS'])}, expected S01..S27")
        return F, W, None
    shots, prev, film_legs, density = [], -1, [], []
    for sid in ids:
        a, r = data["SHOTS"][sid], ref[sid]
        if r["first"] != prev + 1:
            F.append(f"{sid}: not contiguous")
        prev = r["last"]
        for t in a["types"]:
            if t not in ALLOWED_TYPES:
                F.append(f"{sid}: unknown type {t}")
        is_foot = any(t in ("footage", "overlay-on-footage") for t in a["types"])
        is_ui = any(t in ("editor screen", "deliverable-in-viewer") for t in a["types"])
        # transitions keep hf01's
        for side, key in (("transition_in", "transition_in"), ("transition_out", "transition_out")):
            h = r[key]
            if h not in ("start", "end") and not a[side].startswith(h.replace("endcard-dim", "endcard")) and not (
                    h == "endcard-dim" and a[side].startswith(("endcard", "cut"))):
                F.append(f"{sid}: {side} '{a[side][:28]}' does not start with hf01's '{h}'")
        # strings
        rows, blue, wsum, rmin, lmax = [], 0, 0, None, None
        for s in a["strings"]:
            if not (r["first"] <= s["f"] <= s["r"] <= s["l"] <= r["last"]):
                F.append(f"{sid}: '{s['t']}' frames f{s['f']} r{s['r']} l{s['l']} outside/invalid for n{r['first']}-n{r['last']}")
            if s.get("blue"):
                blue += 1
                if s["blue"] not in s["t"]:
                    F.append(f"{sid}: blue word '{s['blue']}' not in '{s['t']}'")
                if len(s["blue"].split()) != 1:
                    F.append(f"{sid}: blue span '{s['blue']}' is more than one word")
            low = s["t"].lower()
            if "out of office" in low and sid != "S27":
                F.append(f"{sid}: the end line appears before the end card")
            row = dict(s)
            if s.get("logo"):
                row.update(words=None, readable_s=None, wps=None)
            else:
                nw = nwords(s["t"])
                rs = (s["l"] - s["r"] + 1) / 30.0
                wps = nw / rs
                row.update(words=nw, readable_s=round(rs, 2), wps=round(wps, 2))
                if wps > MAX_WPS + 1e-9:
                    F.append(f"{sid}: '{s['t']}' {nw} words in {rs:.2f} s = {wps:.2f} w/s (max {MAX_WPS})")
                wsum += nw
                rmin = s["r"] if rmin is None else min(rmin, s["r"])
                lmax = s["l"] if lmax is None else max(lmax, s["l"])
            row["t_first"] = round(s["f"] / 30, 3)
            row["t_last"] = round(s["l"] / 30, 3)
            row["chars"] = None if s.get("logo") else len(s["t"])
            rows.append(row)
        if blue > 1:
            F.append(f"{sid}: {blue} blue words (max 1 per card)")
        # density per cluster: strings whose legible windows overlap are read together, so their words share one span
        counted = sorted([x for x in rows if x.get("words")], key=lambda x: x["r"])
        clusters = []
        for x in counted:
            if clusters and x["r"] <= clusters[-1]["l"]:
                c = clusters[-1]
                c["l"] = max(c["l"], x["l"])
                c["words"] += x["words"]
                c["texts"].append(x["t"])
            else:
                clusters.append(dict(r=x["r"], l=x["l"], words=x["words"], texts=[x["t"]]))
        for c in clusters:
            c["span_s"] = round((c["l"] - c["r"] + 1) / 30.0, 2)
            c["wps"] = round(c["words"] / ((c["l"] - c["r"] + 1) / 30.0), 2)
            if c["words"] / ((c["l"] - c["r"] + 1) / 30.0) > MAX_WPS + 1e-9:
                F.append(f"{sid}: {c['words']} words read together over {c['span_s']} s = {c['wps']} w/s ({c['texts']})")
        if clusters:
            top = max(clusters, key=lambda c: c["wps"])
            density.append(dict(shot=sid, words=wsum, clusters=len(clusters), span=f"n{top['r']}-n{top['l']}", span_s=top["span_s"],
                                cluster_words=top["words"], wps=top["wps"], texts=top["texts"]))
        else:
            density.append(dict(shot=sid, words=0, clusters=0, span="-", span_s=0, cluster_words=0, wps=0.0, texts=[]))
        # overlays
        ovs = []
        for o in a["overlays"]:
            x0, x1, y0, y1 = o["box"]
            if not (0 <= x0 < x1 <= 1080 and 0 <= y0 < y1 <= 608):
                F.append(f"{sid}: overlay box out of frame {o['box']}")
            if re.search(r"\bmascot\b", o["element"], re.I) or "app-icon" in o["element"].lower():
                F.append(f"{sid}: a logo or mascot used as a character ({o['element'][:40]})")
            ovs.append(dict(element=o["element"], box_1080x608=list(o["box"]), box_1920x1080=b1920(o["box"]),
                            timing=o["timing"], motion=o["motion"]))
        # generation legs
        legs = []
        if is_foot and not a["legs"]:
            F.append(f"{sid}: footage shot without generation legs")
        if not is_foot and a["legs"]:
            F.append(f"{sid}: legs on a non-footage shot")
        for c in a["legs"]:
            u0, u1 = c["use"]
            if not (isinstance(c["sec"], int) and 5 <= c["sec"] <= 10):
                F.append(f"{sid} leg {c['leg']}: sec {c['sec']} not a whole number 5-10")
            if not (r["first"] <= u0 <= u1 <= r["last"]):
                F.append(f"{sid} leg {c['leg']}: use n{u0}-n{u1} outside the shot")
            if not (u0 <= c["key_at"] <= u1):
                F.append(f"{sid} leg {c['leg']}: key still n{c['key_at']} outside its use window")
            used = (u1 - u0 + 1) / 30.0
            if used > c["sec"] + 1e-6:
                F.append(f"{sid} leg {c['leg']}: uses {used:.2f} s of a {c['sec']} s clip")
            for fld in ("key_frame", "motion"):
                if "no text" not in c[fld].lower():
                    F.append(f"{sid} leg {c['leg']}: {fld} without 'no text'")
            for fld in ("key_frame", "motion"):
                for bw in banned_in_prompt(c[fld], data):
                    F.append(f"{sid} leg {c['leg']}: '{bw}' named inside the {fld} prompt")
            legs.append(dict(leg=c["leg"], sec=c["sec"], use=f"n{u0}-n{u1}", use_frames=[u0, u1], use_sec=round(used, 2),
                             key_at=c["key_at"], join=c["join"], key_frame=c["key_frame"], motion=c["motion"]))
            film_legs.append((sid, c["leg"], c["sec"], round(used, 2)))
        framing = None
        if a.get("framing"):
            vis, comp = view_of(a["framing"])
            framing = dict(a["framing"], visible_master=vis, comp_on_screen_1080x608=comp, comp_on_screen_1920x1080=b1920(comp))
        elif is_ui:
            F.append(f"{sid}: an editor / viewer shot without a framing of the master window")
        hold = None
        if a.get("hold"):
            h0, h1 = a["hold"]
            if not (r["first"] <= h0 < h1 <= r["last"]):
                F.append(f"{sid}: hold outside the shot")
            hold = dict(frames=[h0, h1], local_30fps=[h0 - r["first"], h1 - r["first"]],
                        note="declare as `hold: [from, to]` (local 30-fps frames) so the freeze QA reports a verified hold")
        shots.append(dict(
            id=sid,
            hf01=dict(shot=r["shot"], label=r["label"], first=r["first"], last=r["last"], frames=r["frames"], sec=round(r["sec"], 3),
                      t_in=round(r["t_in"], 3), t_out=round(r["t_out"], 3), master_frames_24p=r["master_frames_24p"],
                      transition_in=r["transition_in"], transition_out=r["transition_out"], content=r["content"],
                      camera=r["camera"], shots_md=a["shots_md"], job=a["hf01_job"]),
            types=a["types"], summary=a["summary"], picture=a["picture"], framing=framing, hold=hold,
            transition_in=dict(hf01=r["transition_in"], ours=a["transition_in"]),
            transition_out=dict(hf01=r["transition_out"], ours=a["transition_out"]),
            strings=rows, overlays=ovs, sound=a["sound"], legs=legs, notes=a["notes"], check_with_manus=a["flags"]))
    if prev != 2295:
        F.append(f"last frame {prev}, expected 2295")
    if not any(x.get("blue") for x in data["SHOTS"]["S27"]["strings"]):
        F.append("S27: the end card carries no blue payoff word")

    # prompts
    if len(data["PROMPTS"]) != 5:
        F.append("not five prompts")
    for p, hs in zip(data["PROMPTS"], HF_SEND):
        if p["send"] != hs:
            F.append(f"P{p['n']}: send n{p['send']} != hf01 n{hs}")
        sh = data["SHOTS"][p["shot"]]
        r = ref[p["shot"]]
        if not (r["first"] <= p["send"] <= r["last"]):
            F.append(f"P{p['n']}: send outside {p['shot']}")
        bar = [s for s in sh["strings"] if s.get("prompt") == p["n"]]
        if len(bar) != 1 or bar[0]["t"] != p["text"]:
            F.append(f"P{p['n']}: bar string mismatch in {p['shot']}")
        elif not (bar[0]["r"] <= p["send"] <= bar[0]["l"]):
            F.append(f"P{p['n']}: the prompt is not on screen at its send frame")
        if not any(f"glow peak n{p['send']}" in o["timing"] for o in sh["overlays"]):
            F.append(f"P{p['n']}: the bar's press does not peak on hf01's send frame n{p['send']}")
    if not any("signal glyph" in o["element"].lower() for o in data["SHOTS"]["S24"]["overlays"]):
        F.append("S24: no signal glyph (the loss-of-signal beat)")

    # ad asset prompts: same hygiene as the film legs
    for x in data["AD"]["assets"]:
        for fld in ("image", "motion"):
            if x.get(fld):
                for bw in banned_in_prompt(x[fld], data):
                    F.append(f"ad {x['id']}: '{bw}' named inside the {fld} prompt")
    # causality: every shot of her film exists before the prompt that needs it
    for x in data["AD"]["assets"]:
        if x.get("needed_by") is None:
            continue
        if x.get("captured_last") is None or x["captured_last"] >= x["needed_by"]:
            F.append(f"ad {x['id']}: captured to n{x.get('captured_last')} but needed by {x['needed_for']} at n{x['needed_by']}")
        for sid in re.findall(r"S\d\d", x.get("seen_in", "")):
            if ref[sid]["last"] < (x["captured_last"] or 0):
                F.append(f"ad {x['id']}: shown in {sid} (ends n{ref[sid]['last']}) before it exists (n{x['captured_last']})")
    # S04: the glyph chain swaps on hf01's own frames
    s04 = " ".join(o["timing"] for o in data["SHOTS"]["S04"]["overlays"])
    for fr in HF_S04_SWAPS:
        if f"n{fr}" not in s04:
            F.append(f"S04: no glyph swap on hf01's frame n{fr}")
    # S26: bubbles enter on hf01's bar frame and are gone before the gull lands
    s26 = data["SHOTS"]["S26"]
    gull = s26.get("gull_lands")
    bub = [x for x in s26["strings"] if x["f"] < 2081]
    if not gull:
        F.append("S26: no gull_lands frame declared")
    else:
        if min(x["f"] for x in bub) < HF_B2_BAR:
            F.append(f"S26: the reply enters at n{min(x['f'] for x in bub)}, before hf01's bar frame n{HF_B2_BAR}")
        if max(x["l"] for x in bub) >= gull - 5:
            F.append(f"S26: the reply is still legible at n{max(x['l'] for x in bub)}, within 5 f of the gull landing (n{gull})")
    # title card: one blue accent
    n_blue = sum(1 for o in data["SHOTS"]["S01"]["overlays"] if "#33ABFB" in o["element"])
    if n_blue > 1:
        F.append(f"S01 title: {n_blue} elements carry #33ABFB (max 1)")

    # copy scans: every on-screen string + prompts + ad supers
    ours = [(sid, s["t"]) for sid, a in data["SHOTS"].items() for s in a["strings"] if not s.get("logo")]
    ours += [("ad", r_["super"]) for r_ in data["AD"]["script"] if r_["super"] != "-"]
    for sid, t in ours:
        for b in data["MANUS_BANNED"]:
            if b.lower() in t.lower():
                F.append(f"banned Manus string {b!r} in {sid}: {t!r}")
        for b in data["BANNED_WORLD"]:
            if re.search(r"\b" + re.escape(b) + r"\b", t, re.I):
                F.append(f"banned name {b!r} in {sid}: {t!r}")
    refs = [(x, "hf01") for x in data["HF01_LINES"]] + [(e["text"], "hf01") for e in inv] + [(x, "Manus") for x in mlines]
    two_word = []
    for sid, t in ours:
        for rl, src in refs:
            run = longest_run(t, rl)
            eff = [w for w in run if w not in PRODUCT]
            if len(run) >= 3 and set(run) - PRODUCT:
                F.append(f"{sid}: {t!r} shares '{' '.join(run)}' with {src} {rl!r}")
            elif len(run) == 2 and set(run) - STOP - PRODUCT:
                two_word.append(dict(shot=sid, ours=t, ref=rl, source=src, run=" ".join(run)))
                F.append(f"{sid}: {t!r} shares the 2-word run '{' '.join(run)}' with {src} {rl!r}")
            ov, sh = content_overlap(t, rl)
            if len(sh) >= 2 and ov >= 0.5:
                F.append(f"{sid}: {t!r} reuses content words {sorted(sh)} of {src} {rl!r}")
    # dedupe two-word notes
    seen, tw = set(), []
    for x in two_word:
        k = (x["shot"], x["ours"], x["run"], x["ref"])
        if k not in seen:
            seen.add(k)
            tw.append(x)
    return F, W, dict(shots=shots, density=density, film_legs=film_legs, two_word=tw)


# ---------------------------------------------------------------- same-moment hf01 lines
def same_moment(shot, s, inv):
    bar = shot["id"] in ("S04", "S09", "S14", "S22", "S24")
    ui = any(t in ("editor screen", "deliverable-in-viewer") for t in shot["types"])
    out = []
    for e in inv:
        if e["first"] <= s["l"] and s["f"] <= e["last"] and (e["n"] != 3 or shot["id"] == "S27") and (e["n"] != 21 or bar) and (e["n"] != 24 or ui):
            out.append(e["text"])
    return out


# ---------------------------------------------------------------- writers
def esc(x):
    return str(x).replace("|", "\\|").replace("\n", " ")


ACTS, DECISIONS, GLOBAL_FLAGS, CLAIMS = D.ACTS, D.DECISIONS, D.GLOBAL_FLAGS, D.CLAIMS


def write_shotlist(doc):
    o = io.StringIO()
    w = o.write
    w(f"# {doc['title']}: the astronaut film, final shot list\n\n")
    w(f"**{doc['version']}.** Nothing here was generated: no image, video, audio or network calls. Machine-readable twin: "
      "`shotlist.json`. Story: `STORY.md`. Copy check: `COPY.md`. Actor: `CAST.md`. Beat-by-beat against hf01: `VS-HF01.md`. Everything except CAST.md is written in `tools/final_data.py` "
      "and rebuilt with `/usr/bin/python3 -B tools/build.py` (add `--selftest` to prove the checks fail on planted errors), "
      "which validates it against hf01's verified cut list (`hf01-study/cuts/cuts.json`).\n\n")
    w("**Conventions.** Frames `nNNNN` are hf01's 0-based 30 fps frames; ours land on the same frames. Boxes are px on the "
      "1080x608 reference with the 1920x1080 value in [brackets]. 'mf' = 24p master frame; 'cf' = content frame (1/24 s). "
      "Editor shots give a framing `(cx, cy, s)` of the one master editor window (kit), with hf01's camera on top. "
      "Each string has three frames: first visible, first legible, last.\n\n")
    w(f"**Logline.** {doc['logline']}\n\n")
    q = doc["qa"]
    w(f"**Checks (build.py):** 27/27 shots on hf01's frames (n0-n2295, 2296 f); 5/5 prompts pressed on hf01's send frames; "
      f"{q['strings']} on-screen strings, every one at <= {MAX_WPS:.0f} words per readable second, and every group read together too "
      f"(densest: {q['densest']}); <= 1 blue word per card; {q['banned']} banned Manus strings; {q['runs3']} runs of 3+ words shared "
      f"with hf01 or Manus, and 0 shared 2-word runs with a content word; 0 agency or hf01-place names inside any generation "
      f"prompt; every ad shot captured before the prompt that needs it; S04's glyph swaps on hf01's n447 / 473 / 503 / 523 / 566; "
      f"S26's reply entering on hf01's n2004 and gone before the gull lands; one blue accent on the title; self-test {q['selftest']}.\n\n")

    w("## Why it should be funny: hf01's engine, in space\n\n| Engine part | hf01 | Ours |\n|---|---|---|\n")
    for a, b, c in D.ENGINE:
        w(f"| {esc(a)} | {esc(b)} | {esc(c)} |\n")
    w("\n## The film in one table\n\n| Act | Frames (s) | hf01 | Ours |\n|---|---|---|---|\n")
    for a in ACTS:
        w("| " + " | ".join(esc(x) for x in a) + " |\n")

    w("\n## The five prompts (the plot)\n\nEach one is pressed on hf01's send frame, reacts to that loop's set piece, and changes the film.\n\n")
    w("| # | Shot | Send | Prompt | Words | Readable | Attached | Where she is | What it changes | hf01's prompt in this slot |\n|---|---|---|---|---|---|---|---|---|---|\n")
    for p in doc["prompts"]:
        w(f"| P{p['n']} | {p['shot']} | n{p['send']} ({p['send']/30:.2f} s) | **{esc(p['text'])}** | {p['words']} | {p['readable_s']} s ({p['wps']} w/s) | "
          f"{esc(p['attach'])} | {esc(p['where_she_is'])} | {esc(p['what_it_changes'])} | {esc(p['hf01'])} |\n")
    w(f"\n**Early payoff.** {D.EARLY_PAYOFF}\n\n")
    w("## Where the laughs land\n\n| Shot | Frames | The joke |\n|---|---|---|\n")
    for s_, fr, j in D.JOKES:
        w(f"| {s_} | {fr} | {esc(j)} |\n")

    ad = D.AD
    w(f"\n## The deliverable: {esc(ad['name'])}\n\n{ad['idea']} {ad['aspects']}. Every piece appears in our editor's viewer across the loops.\n\n")
    w("| Time | Slot | Asset | Picture | Super | Sound | Made / shown in |\n|---|---|---|---|---|---|---|\n")
    for r in ad["script"]:
        w(f"| {r['tc']} | {r['slot']} | {r['asset']} | {esc(r['picture'])} | {esc(r['super'])} | {esc(r['sound'])} | {esc(r['made_in'])} |\n")
    w("\n- **Palette:** " + ", ".join(f"{k} {v}" for k, v in ad["palette"].items()) + ".\n")
    w(f"- **Type:** {ad['type']}\n- **Mark:** {ad['mark']}\n\n")
    w("### Ad assets\n\n| Id | Slot | Kind | sec | Seen in | Image prompt | Motion prompt |\n|---|---|---|---|---|---|---|\n")
    for x in ad["assets"]:
        w(f"| {x['id']} | {esc(x['slot'])} | {esc(x['kind'])} | {x['sec'] or '-'} | {esc(x['seen_in'])} | {esc(x['image'] or '-')} | {esc(x['motion'] or '-')} |\n")

    w("\n## World\n\n")
    for k in ("setting", "never", "astronaut", "sender", "deliverable", "clock"):
        w(f"- **{k.capitalize()}:** {D.WORLD[k]}\n")
    w("- **Escalation:**\n")
    for e in D.WORLD["escalation"]:
        w(f"  - {e}\n")

    w("\n## Reading budget (every shot, computed)\n\n"
      f"Rule: at most {MAX_WPS:.0f} words per readable second, per string and per text moment (strings whose legible windows "
      "overlap are read together, so their words share one span, from the first legible frame to the last). Logos are not "
      "counted; greeked UI labels carry no words. The build fails above the rule.\n\n")
    w("| Shot | Words in shot | Text moments | Densest moment (strings read together) | Its words | Its seconds | Words/s |\n|---|---|---|---|---|---|---|\n")
    for d in doc["density"]:
        if d["words"]:
            w(f"| {d['shot']} | {d['words']} | {d['clusters']} | {d['span']}: {esc(' + '.join(d['texts']))} | {d['cluster_words']} | {d['span_s']} | {d['wps']} |\n")
    w("\nShots with no words on screen: " + ", ".join(d["shot"] for d in doc["density"] if not d["words"]) + ".\n")

    w("\n## Content mix (frames; same slots as hf01)\n\n| Kind | Frames | Seconds | % |\n|---|---|---|---|\n")
    for m in doc["content_mix"]:
        w(f"| {m['kind']} | {m['frames']} | {m['sec']} | {m['pct']} |\n")

    w("\n## Our design kit (Manus look; our own designs)\n\n")
    w(f"- **Reuse:** {D.KIT['reuse']}\n- **Block changes for this draft:**\n")
    for b in D.KIT["block_changes"]:
        w(f"  - {b}\n")
    for k in ("reading_rule", "grade_and_cadence", "brand_rules", "watermark", "prompt_bar", "status_screen", "bubble",
              "floating_words", "reveal_ring", "editor", "end_card", "score"):
        w(f"- **{k.replace('_', ' ').capitalize()}:** {D.KIT[k]}\n")

    w("\n## Looks per plate (grade targets; look.py categories)\n\n")
    for k, v in D.LOOKS.items():
        w(f"- **{k}:** {v}\n")

    g = doc["generation"]
    w("\n## Generation plan (counted by the build; nothing generated)\n\n")
    w(f"- **Image-to-video per take:** {g['film_legs']} film legs, {g['film_s']} s requested ({g['film_used']} s on screen) + "
      f"{g['ad_legs']} ad legs, {g['ad_s']} s = **{g['total_s']} s, about ${g['usd']:.2f} a take** at ${RATE_USD}/s (skill FOOTAGE.md: "
      "MiniMax H3 Max at 1080P, checked 2026-10-22). Budget re-rolls on the identity keys.\n")
    w(f"- **Stills:** {g['key_stills']} key stills (one per leg, its first frame) + {g['ad_stills']} ad stills, all made from the "
      "CAST.md character sheet and the location sheets as image references, never from text alone.\n")
    w("- **Order:** character sheet -> location sheets -> identity-key legs (S01 1c, S04 4A, S09, S14 14B, S22, S24, S26) -> the rest -> ad legs.\n\n")
    w("| Shot | Leg | sec | Used on screen (s) |\n|---|---|---|---|\n")
    for sid, leg, sec, used in doc["film_legs"]:
        w(f"| {sid} | {leg} | {sec} | {used} |\n")
    for x in D.AD["assets"]:
        if x["sec"]:
            w(f"| ad | {x['id']} | {x['sec']} | (ad asset) |\n")

    w("\n## Check with Manus (none of this is stated as a fact on screen)\n\n")
    for f_ in doc["check_with_manus"]:
        if f_["shot"] != "All":
            w(f"- {f_['shot']}: {f_['flag']}\n")
    for f_ in GLOBAL_FLAGS:
        w(f"- All: {f_}\n")
    w(f"\n**Claims on screen.** {CLAIMS}\n\n")

    w("## Decisions for Alex\n\n| Decision | Options | Drafted as |\n|---|---|---|\n")
    for a, b, c in DECISIONS:
        w(f"| {esc(a)} | {esc(b)} | {esc(c)} |\n")

    w("\n---\n\n# Shot list\n")
    for s in doc["shots"]:
        h = s["hf01"]
        w(f"\n## {s['id']} · n{h['first']}-n{h['last']} · {h['t_in']:.3f}-{h['t_out']:.3f} s · {h['frames']} f ({h['sec']:.3f} s, "
          f"{h['master_frames_24p']} mf) · {' + '.join(s['types'])}\n\n")
        w(f"- **hf01 (cuts S{h['shot']:02d} '{h['label']}', {h['shots_md']}):** {h['job']}\n")
        w(f"- **Ours:** {s['summary']}\n")
        w(f"- **In:** {s['transition_in']['ours']}\n- **Out:** {s['transition_out']['ours']}\n")
        p = s["picture"]
        if s["framing"]:
            fr = s["framing"]
            vis = fr["visible_master"]
            cm = fr["comp_on_screen_1080x608"]
            w(f"- **Framing (master editor):** centre ({fr['cx']}, {fr['cy']}), scale {fr['s']}: shows master x {vis[0]}-{vis[1]}, "
              f"y {vis[2]}-{vis[3]}; the comp lands at screen {cm[0]}-{cm[1]} x {cm[2]}-{cm[3]} [{'-'.join(map(str, fr['comp_on_screen_1920x1080'][:2]))} x {'-'.join(map(str, fr['comp_on_screen_1920x1080'][2:]))}].\n")
        if s["hold"]:
            hd = s["hold"]
            w(f"- **Hold:** n{hd['frames'][0]}-n{hd['frames'][1]} = `hold: [{hd['local_30fps'][0]}, {hd['local_30fps'][1]}]` ({hd['note']}).\n")
        for k in ("subject", "action", "framing", "lens", "light", "screen", "layout", "build"):
            if k in p:
                w(f"- **{k.capitalize()}:** {p[k]}\n")
        w(f"- **Camera (matches hf01):** {p['camera']}\n")
        if s["strings"]:
            w("\n**On screen (our copy)**\n\n| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |\n|---|---|---|---|---|---|---|---|\n")
            for x in s["strings"]:
                txt = esc(x["t"])
                if x.get("blue"):
                    txt += f" ('{esc(x['blue'])}' #33ABFB)"
                if x.get("ad"):
                    txt += " (ad)"
                w(f"| {txt} | {x['chars'] if x['chars'] is not None else '-'} | n{x['f']}-n{x['l']} | n{x['r']} | "
                  f"{x['words'] if x['words'] is not None else 'logo'} | {x['readable_s'] if x['readable_s'] is not None else '-'} | "
                  f"{x['wps'] if x['wps'] is not None else '-'} | {esc(x['w'])} |\n")
        else:
            w("\n**On screen:** nothing.\n")
        if s["overlays"]:
            w("\n**Overlays and elements**\n\n| Element | Box 1080x608 | [1920x1080] | Timing | Motion |\n|---|---|---|---|---|\n")
            for ov in s["overlays"]:
                b, c = ov["box_1080x608"], ov["box_1920x1080"]
                w(f"| {esc(ov['element'])} | {b[0]}-{b[1]} x {b[2]}-{b[3]} | {c[0]}-{c[1]} x {c[2]}-{c[3]} | {esc(ov['timing'])} | {esc(ov['motion'])} |\n")
        w(f"\n**Sound.** {s['sound']}\n")
        if s["legs"]:
            w("\n**Generation plan.**\n\n| Leg | Key still at | sec | Use | Join |\n|---|---|---|---|---|\n")
            for c in s["legs"]:
                w(f"| {c['leg']} | n{c['key_at']} | {c['sec']} | {c['use']} ({c['use_sec']} s) | {esc(c['join'])} |\n")
            for c in s["legs"]:
                w(f"\n*Leg {c['leg']}, key still (16:9, the leg's first frame n{c['key_at']}):*\n\n> {c['key_frame']}\n")
                w(f"\n*Leg {c['leg']}, motion (image-to-video, --sec {c['sec']}):*\n\n> {c['motion']}\n")
        if s["notes"] or s["check_with_manus"]:
            w("\n")
        for n_ in s["notes"]:
            w(f"- Note: {n_}\n")
        for f_ in s["check_with_manus"]:
            w(f"- **Check with Manus:** {f_}\n")
    with open(os.path.join(OUT, "SHOTLIST.md"), "w", encoding="utf-8") as fh:
        fh.write(o.getvalue())


def write_copy(doc, inv):
    o = io.StringIO()
    w = o.write
    q = doc["qa"]
    w(f"# {doc['title']}: copy check (final)\n\n")
    w(f"**{doc['version']}.** Every on-screen line of ours, with its readable time and word count, next to the higgsfield01 line "
      "on screen at the same frames (SHOTS.md §5, ±2 f; hf01's watermark handle is left out except on the end card, where it is the content) and the nearest Manus line by function "
      "(WORDS.md). Their lines are quoted only to prove ours are not rewrites. The test: read each pair side by side; if ours "
      "reads as theirs reworded, it fails.\n\n")
    w("**Automatic checks (tools/build.py, on every build):**\n")
    w(f"- **Reading rule:** every string, and every group of strings read together, at <= {MAX_WPS:.0f} words per readable second "
      "(readable = from the first legible frame to the last). **All pass**; the densest string and shot are listed below.\n")
    w(f"- **Banned Manus UI strings** ('Generating footage', 'Mixing the score', 'Ready ·', 'Exporting', 'On it.', 'Done.', "
      f"'Untitled video', 'Made with …', 'Manus 2.0 Max', 'Introducing', 'Run this task on', 'In the cloud', 'Remote control', the "
      f"Alchemy line, …) and banned names (real agencies, stations, vehicles and hardware, 'safety video'; the list is BANNED_WORLD in "
      f"tools/final_data.py) on screen: **{q['banned']} found**.\n")
    w("- **Prompt hygiene:** no generation prompt (16 film legs, 5 ad stills, 3 ad motions) names a real agency, station, vehicle "
      "or hf01 / Manus place (BANNED_WORLD + BANNED_PLACES): **0 found**. Prompts say what things are ('blue-black solar arrays', "
      "'one large round window'), never what they are not.\n")
    w("- **Causality:** every shot of her film is captured before the prompt that needs it, and never shown before it exists "
      "(A1 n540 < P1 n652; A2 n912 < P2 n913; A3 n1180 < P3 n1181; A4 Marketing's photo < P4 n1641; A5 n1890 < P5 n1895): **pass**.\n")
    w(f"- **Runs of 3+ consecutive words** shared with any hf01 line (63 hand-listed + the SHOTS.md §5 inventory) or any of "
      f"Manus's on-screen strings (words.json), product names excepted: **{q['runs3']} found**. Content-word reuse (2+ shared content "
      "words covering half of our line): **0 found**.\n")
    w(f"- **Self-test:** {q['selftest']}.\n")
    w("- **2-word shared runs** with a content word (now failures: the comedy draft's 'Make a wish!' / 'Make a map…' is gone):\n")
    if doc["two_word"]:
        for x in doc["two_word"]:
            w(f"  - {x['shot']}: '{esc(x['ours'])}' shares '{x['run']}' with {x['source']} '{esc(x['ref'])}'.\n")
    else:
        w("  - none.\n")
    w("\n**Form checks (by eye):** no question cascade of categories on hf01's morph beats (ours are statements and one setup / "
      "punchline pair); no 'Today hh:mm' timestamp; no 'Client' label; no praise + 'Next brief:' reply (ours is a result, then a "
      "separate follow-up question); no bold one-word status opener ('Mapped.'); no 'TRY … FOR … WITH' CTA; no 'for X' title pill; "
      "no 'Every X, a Y' tagline; no 'you build / you decide' manifesto; no whole-line blue tool line; no Manus status line that "
      "jokes about her danger (the comedy draft's 'Gorgeous drift.' / 'What debris?' are now 'Drift first.' / 'Debris → stars.').\n\n")

    w("## Every line\n\n| Shot | Visible (legible from) | Ours | Words | Readable s | w/s | hf01 on screen at the same frames | Manus at a similar moment | Longest shared run | Check: not a rewrite because |\n|---|---|---|---|---|---|---|---|---|---|\n")
    for s in doc["shots"]:
        for x in s["strings"]:
            if x.get("logo"):
                continue
            conc = same_moment(s, x, inv)
            best, bref = [], ""
            for e in conc:
                run = longest_run(x["t"], e)
                if len(run) > len(best):
                    best, bref = run, e
            mref = x.get("mref", "-")
            mrun = longest_run(x["t"], mref) if mref != "-" else []
            runs = []
            if best:
                runs.append(f"'{' '.join(best)}' (hf01" + (", product name)" if set(best) <= PRODUCT else ")"))
            if mrun:
                runs.append(f"'{' '.join(mrun)}' (Manus" + (", product name)" if set(mrun) <= PRODUCT else ")"))
            tag = " (ad)" if x.get("ad") else ""
            w(f"| {s['id']} | n{x['f']}-n{x['l']} (n{x['r']}) | {esc(x['t'])}{tag} | {x['words']} | {x['readable_s']} | {x['wps']} | "
              f"{esc(' · '.join(conc) if conc else '(nothing)')} | {esc(mref)} | {esc(', '.join(runs) if runs else 'none')} | {esc(x.get('chk', '-'))} |\n")
    w("\n## The film's own supers (the deliverable)\n\n| Slot | Super | Words | Where it is read |\n|---|---|---|---|\n")
    for r in D.AD["script"]:
        if r["super"] != "-":
            w(f"| {r['tc']} {r['slot']} | {esc(r['super'])} | {nwords(r['super'])} | {esc(r['made_in'])} |\n")
    w("\nManus's nearest line for the supers is 'Every idea has a film in it.' (W14); none of ours uses the 'Every X' form, and "
      "none shares a run with hf01's Ivayu copy.\n")

    w("\n## Reading budget per shot (densest text moment)\n\n| Shot | Words in shot | Densest moment | Its words | Seconds | Words/s |\n|---|---|---|---|---|---|\n")
    for d in doc["density"]:
        if d["words"]:
            w(f"| {d['shot']} | {d['words']} | {d['span']}: {esc(' + '.join(d['texts']))} | {d['cluster_words']} | {d['span_s']} | {d['wps']} |\n")
    w(f"\nDensest string: {q['densest_string']}. Densest shot: {q['densest']}. For comparison, the ridge draft's cards ran up to "
      "16 words/s (S25: 15 words in 0.93 s).\n")

    w("\n## The prompts next to hf01's\n\n| Slot | hf01 | Ours | What ours does that hf01's does not |\n|---|---|---|---|\n")
    for p in doc["prompts"]:
        w(f"| P{p['n']} n{p['send']} | {esc(p['hf01'])} | **{esc(p['text'])}** | {esc(p['what_it_changes'])} |\n")

    w("\n## Where the laughs land\n\n| Shot | Frames | The joke |\n|---|---|---|\n")
    for s_, fr, j in D.JOKES:
        w(f"| {s_} | {fr} | {esc(j)} |\n")
    w("\n**Borrowed on purpose (structure, not words).** The three-beat human typing of prompt 1, the bubble bookends with a "
      "timestamp and a sender, the two-voice status screens (agent mark vs tool tile), the poster's build order, the deadpan bullet "
      "hidden in the infographic, the quiet one-line slot at n2081, the next-brief punchline about the hero's new surroundings, and "
      "the end card's icon motion sit where hf01's do, because the brief is to recreate hf01's motion and structure. The words in "
      "every slot are ours.\n")
    with open(os.path.join(OUT, "COPY.md"), "w", encoding="utf-8") as fh:
        fh.write(o.getvalue())


def write_story(doc):
    o = io.StringIO()
    w = o.write
    St = D.STORY
    g = doc["generation"]
    w(f"# {doc['title']}: the story (final)\n\n")
    w(f"**{doc['version']}.** Shot by shot: `SHOTLIST.md` (`shotlist.json`). The actor: `CAST.md`. Every line on screen against the "
      "references, with reading rates: `COPY.md`. Beat by beat against higgsfield01: `VS-HF01.md`. Nothing has been generated: no "
      "image, video, audio or network calls.\n\n")
    w(f"**Logline.** {doc['logline']}\n\n## The story\n\n")
    for i, x in enumerate(St["sentences"], 1):
        w(f"{i}. {x}\n")
    w(f"\n**Shape.** {St['shape']}\n\n## The five loops\n\nEach prompt is pressed on hf01's send frame, reacts to that loop's set "
      "piece, and changes the film she is making.\n\n| Loop | Shots | Set piece | Prompt (send) | What it changes in her film |\n|---|---|---|---|---|\n")
    for L in St["loops"]:
        w(f"| {esc(L['loop'])} | {L['shots']} | {esc(L['set_piece'])} | {esc(L['prompt'])} | {esc(L['changes'])} |\n")
    w("\n**The prompts in detail**\n\n| # | Sent | Prompt | Words / readable | Attached | Where she is | hf01's prompt in this slot |\n|---|---|---|---|---|---|---|\n")
    for p in doc["prompts"]:
        w(f"| P{p['n']} | {p['shot']} n{p['send']} ({p['send']/30:.2f} s) | **{esc(p['text'])}** | {p['words']} in {p['readable_s']} s ({p['wps']} w/s) | "
          f"{esc(p['attach'])} | {esc(p['where_she_is'])} | {esc(p['hf01'])} |\n")
    w(f"\n**Early payoff.** {D.EARLY_PAYOFF}\n\n")
    ad = D.AD
    w(f"## The deliverable: {esc(ad['name'])}\n\n{ad['idea']} {ad['aspects']}, six slots, every one a danger she survived or the "
      "room it is selling:\n\n| Film time | Slot | Picture | Super | Where it comes from in our film |\n|---|---|---|---|---|\n")
    for r in ad["script"]:
        w(f"| {r['tc']} | {r['slot']} | {esc(r['picture'])} | {esc(r['super'])} | {esc(r['made_in'])} |\n")
    w("\n**Where each shot comes from (the causality rule).**\n\n| Asset | Captured | Needed by |\n|---|---|---|\n")
    for x in ad["assets"]:
        nb = f"{x['needed_for']} at n{x['needed_by']}" if x.get("needed_by") else "-"
        w(f"| {x['id']} {esc(x['slot'])} | {esc(x['captured'])} | {nb} |\n")
    w(f"\n- **Look:** {ad['type']} Palette: " + ", ".join(f"{k} {v}" for k, v in ad["palette"].items()) + f". {ad['mark']}\n\n")
    w(f"## The re-entry blackout ending\n\n{St['blackout']}\n\n## The punchline\n\n{St['punchline']}\n\n")
    w(f"## The end-card line\n\n{St['endline']}\n\n")
    w("## What changed from the comedy draft\n\nThe comedy draft won (weighted 291 against heart 269 and spectacle 244). Every "
      "problem the three judges raised, and what this version does about it:\n\n| Judge | They said | What we did |\n|---|---|---|\n")
    for j, a, b in D.CHANGES:
        w(f"| {j} | {esc(a)} | {esc(b)} |\n")
    w("\n## Check with Manus\n\nNone of this is stated as a fact on screen; each is flagged on its shot in SHOTLIST.md.\n\n")
    for f_ in doc["check_with_manus"]:
        if f_["shot"] != "All":
            w(f"- **{f_['shot']}:** {f_['flag']}\n")
    for f_ in GLOBAL_FLAGS:
        w(f"- **All:** {f_}\n")
    w(f"\n**Claims on screen.** {CLAIMS}\n\n## Open choices for Alex\n\n| Choice | Options | Drafted as |\n|---|---|---|\n")
    for a, b, c in DECISIONS:
        w(f"| **{esc(a)}** | {esc(b)} | {esc(c)} |\n")
    w(f"\n## Before any generation\n\n- **Cost, volunteered:** {g['film_legs']} film legs ({g['film_s']} s requested, {g['film_used']} s on "
      f"screen) + {g['ad_legs']} ad legs ({g['ad_s']} s) = **{g['total_s']} s of image-to-video, about ${g['usd']:.2f} a take** at "
      f"${RATE_USD}/s before re-rolls, plus {g['key_stills']} key stills, {g['ad_stills']} ad stills and the character sheet. Still the most "
      "expensive of the three drafts' plans; the S21 sprite option saves $0.80 a take. Only about half of the seconds requested reach "
      "the screen, because i2v takes are whole 5-10 s legs.\n")
    w("- **Build gaps (named, not budgeted):** a gpt-image-2 sheet and still leg plus identity QA (gaps/footage.md items 1-3; the skill's "
      "`gen.mjs still` is fal FLUX, so feed our stills to `gen.mjs video --image`); the 24p master with index-mapped 30p delivery (items "
      "16-17); `make_plates.py` space looks; three new `plate.mjs` glyphs (orbit, helmet, capsule); the three-line `endcard.mjs`; the "
      "editor's thumbnail rows; the status hairline; the comp grade layers (S14, S20-S23).\n\n")
    w("## Ask\n\n1. Approve this story, the five loops and the five prompts as the plot (the punchline 'Booked solid.' / 'Undersea "
      "next?' and the end line included).\n2. Pick the score (B is drafted), type only or VO (type only is drafted) and the URL line "
      "(none is drafted).\n3. Send the Check-with-Manus list before any spend, above all: a wrist device starting a Video Editor job, "
      "the job finishing during her blackout and the film going to Marketing, the Cloud Computer chip, the Manus mark in the bar, and "
      "the tone of the tether and the radiation alarm.\n")
    with open(os.path.join(OUT, "STORY.md"), "w", encoding="utf-8") as fh:
        fh.write(o.getvalue())


def write_vs(doc):
    o = io.StringIO()
    w = o.write
    w(f"# {doc['title']} vs higgsfield01, beat by beat\n\n")
    w(f"**{doc['version']}.** Same 27 shots, 26 cuts and five send frames as hf01 (n652 / 913 / 1181 / 1641 / 1895); our story, "
      "copy and plates. hf01's lines are quoted only to compare the beats.\n\n")
    w("| Beat | higgsfield01 | Ours (The Lull) | Why ours holds up |\n|---|---|---|---|\n")
    for a, b, c, d in D.VS:
        w(f"| **{esc(a)}** | {esc(b)} | {esc(c)} | {esc(d)} |\n")
    w("\n**Where we are weaker, said plainly.** hf01 has a mascot with personality (the cat) and we have none, because the Manus "
      "mark is never a character: her deadpan face and the zero-G props carry that job. hf01's prompts are plain briefs; ours are "
      "jokes, which means each one must land in about a second of reading. Our plan also costs more to generate (12 live plates "
      "in space, one face through a helmet bubble in 8 of them).\n")
    with open(os.path.join(OUT, "VS-HF01.md"), "w", encoding="utf-8") as fh:
        fh.write(o.getvalue())


# ---------------------------------------------------------------- self-test
def selftest(cuts, inv, mlines):
    base = snapshot()
    F0, _, _ = validate(base, cuts, inv, mlines)
    if F0:
        return False, f"clean data fails: {F0[:3]}"
    cases = []

    def case(name, fn):
        d = copy.deepcopy(base)
        fn(d)
        F, _, _ = validate(d, cuts, inv, mlines)
        cases.append((name, len(F)))

    case("dense card (S10 tool line made 7 words)", lambda d: d["SHOTS"]["S10"]["strings"][1].update(t="Half speed while we add the strings…"))
    case("rewrite of hf01's punchline in S26", lambda d: d["SHOTS"]["S26"]["strings"][2].update(t="Looks great! Next brief: a safety film."))
    case("P2 pressed one frame late", lambda d: d["PROMPTS"][1].update(send=914))
    case("second blue word on S05", lambda d: d["SHOTS"]["S05"]["strings"].append(dict(t="Noted.", f=670, r=672, l=697, w="x", blue="Noted.")))
    case("banned Manus status string", lambda d: d["SHOTS"]["S18"]["strings"][0].update(t="Mixing the score…"))
    case("string outside its shot", lambda d: d["SHOTS"]["S16"]["strings"][0].update(l=1300))
    case("agency name on screen", lambda d: d["SHOTS"]["S19"]["strings"][0].update(t="NASA ORBIT"))
    case("two short lines read together too fast (S16)", lambda d: d["SHOTS"]["S16"]["strings"].append(dict(t="Twelve stars, added.", f=1258, r=1262, l=1293, w="x")))
    case("end line before the end card", lambda d: d["SHOTS"]["S25"]["strings"][0].update(t="Out of office"))
    case("agency name inside a key-frame prompt (S01 1a)", lambda d: d["SHOTS"]["S01"]["legs"][0].update(key_frame=d["SHOTS"]["S01"]["legs"][0]["key_frame"] + " Not NASA."))
    case("hf01 place inside a motion prompt (S14 14A)", lambda d: d["SHOTS"]["S14"]["legs"][0].update(motion=d["SHOTS"]["S14"]["legs"][0]["motion"] + " Like a rope bridge."))
    case("real station named in an ad prompt (A1)", lambda d: d["AD"]["assets"][0].update(image=d["AD"]["assets"][0]["image"] + " Not the International Space Station."))
    case("ad shot captured after the prompt that needs it (A3)", lambda d: d["AD"]["assets"][2].update(captured_last=1190))
    case("S04 glyph swap off hf01's frame (n447 -> n449)", lambda d: d["SHOTS"]["S04"]["overlays"][0].update(timing=d["SHOTS"]["S04"]["overlays"][0]["timing"].replace("n447 orbit", "n449 orbit")))
    case("S26 reply still legible as the gull lands", lambda d: d["SHOTS"]["S26"]["strings"][1].update(l=2070))
    case("S26 reply enters before hf01's bar frame", lambda d: d["SHOTS"]["S26"]["strings"][0].update(f=1984))
    case("second blue accent on the title card", lambda d: d["SHOTS"]["S01"]["overlays"][4].update(element=d["SHOTS"]["S01"]["overlays"][4]["element"] + " #33ABFB"))
    case("'Make a wish!' back in S14 (2-word run with hf01's P3)", lambda d: d["SHOTS"]["S14"]["strings"][1].update(t="Make a wish!"))
    bad = [n for n, k in cases if k == 0]
    if bad:
        return False, "missed: " + "; ".join(bad)
    return True, f"PASS: clean data 0 failures; {len(cases)}/{len(cases)} planted errors caught (" + "; ".join(f"{n}: {k}" for n, k in cases) + ")"


# ---------------------------------------------------------------- main
def main():
    cuts = json.load(open(CUTS, encoding="utf-8"))
    inv = hf01_inventory()
    mlines = manus_lines()
    if len(inv) < 50:
        print(f"FAIL: SHOTS.md §5 parsed only {len(inv)} rows")
        sys.exit(1)
    st = "not run"
    if "--selftest" in sys.argv:
        ok, msg = selftest(cuts, inv, mlines)
        print("selftest:", msg)
        if not ok:
            sys.exit(1)
        st = msg
    F, W, res = validate(snapshot(), cuts, inv, mlines)
    if F:
        print("VALIDATION FAILED")
        for f_ in F:
            print(" -", f_)
        sys.exit(1)
    shots = res["shots"]
    mix = {}
    for s in shots:
        k = "live action (footage, with or without overlays)" if any(t in ("footage", "overlay-on-footage") for t in s["types"]) else s["types"][0]
        if s["types"][0] == "title":
            k = "live action (footage, with or without overlays)"
        mix[k] = mix.get(k, 0) + s["hf01"]["frames"]
    mix_rows = [dict(kind=k, frames=v, sec=round(v / 30, 2), pct=round(100 * v / 2296, 1)) for k, v in sorted(mix.items(), key=lambda kv: -kv[1])]
    prompts = []
    for p in D.PROMPTS:
        bar = next(x for x in next(s for s in shots if s["id"] == p["shot"])["strings"] if x.get("prompt") == p["n"])
        prompts.append(dict(p, chars=len(p["text"]), words=bar["words"], readable_s=bar["readable_s"], wps=bar["wps"], t_send=round(p["send"] / 30, 3)))
    film_s = sum(x[2] for x in res["film_legs"])
    ad_legs = [x for x in D.AD["assets"] if x["sec"]]
    ad_s = sum(x["sec"] for x in ad_legs)
    gen = dict(film_legs=len(res["film_legs"]), film_s=film_s, film_used=round(sum(x[3] for x in res["film_legs"]), 2),
               ad_legs=len(ad_legs), ad_s=ad_s, total_s=film_s + ad_s, usd=round((film_s + ad_s) * RATE_USD, 2),
               key_stills=len(res["film_legs"]), ad_stills=sum(1 for x in D.AD["assets"] if x.get("image")))
    dens = [d for d in res["density"] if d["words"]]
    dmax = max(dens, key=lambda d: d["wps"])
    allstr = [(s["id"], x) for s in shots for x in s["strings"] if x.get("wps") is not None]
    smax = max(allstr, key=lambda t: t[1]["wps"])
    flags = [dict(shot=s["id"], flag=f_) for s in shots for f_ in s["check_with_manus"]]
    nstr = sum(1 for s in shots for x in s["strings"] if not x.get("logo"))
    doc = dict(
        title=D.TITLE, version=D.VERSION, status="storyboard only: no image, video or audio generated; no network; for Alex's review",
        logline=D.LOGLINE, engine=[dict(part=a, hf01=b, ours=c) for a, b, c in D.ENGINE], world=D.WORLD, ad=D.AD,
        prompts=prompts, early_payoff=D.EARLY_PAYOFF, jokes=[dict(shot=a, frames=b, joke=c) for a, b, c in D.JOKES],
        kit=D.KIT, looks=D.LOOKS, content_mix=mix_rows, generation=gen, film_legs=res["film_legs"], density=res["density"],
        reference=dict(source=cuts["source"], size=cuts["size"], fps=cuts["fps"], frames=cuts["frames"], duration_s=cuts["duration_s"],
                       cadence=cuts["cadence"], units="boxes (x0, x1, y0, y1) px at 1080x608 and 1920x1080; editor framings (cx, cy, s)"),
        shots=shots, check_with_manus=flags + [dict(shot="All", flag=f_) for f_ in GLOBAL_FLAGS], claims=CLAIMS,
        decisions=[dict(decision=a, options=b, drafted=c) for a, b, c in DECISIONS], two_word=res["two_word"],
        qa=dict(shots=27, frames=2296, prompts_on_send_frames=5, strings=nstr, max_wps=MAX_WPS,
                densest=f"{dmax['shot']} {dmax['span']}, {dmax['cluster_words']} words over {dmax['span_s']} s = {dmax['wps']} w/s",
                densest_string=f"{smax[0]} '{smax[1]['t']}' {smax[1]['words']} words in {smax[1]['readable_s']} s = {smax[1]['wps']} w/s",
                banned=0, runs3=0, selftest=st),
    )
    with open(os.path.join(OUT, "shotlist.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    write_shotlist(doc)
    write_copy(doc, inv)
    write_story(doc)
    write_vs(doc)
    print(f"OK: 27 shots n0-n2295; 5 prompts on hf01's send frames; {nstr} strings, all <= {MAX_WPS} w/s "
          f"(densest shot {doc['qa']['densest']}; densest string {doc['qa']['densest_string']}); 0 banned strings; 0 shared 3-word runs; "
          f"{len(res['two_word'])} 2-word runs listed; i2v {gen['film_legs']} film legs ({gen['film_s']} s) + {gen['ad_legs']} ad legs "
          f"({gen['ad_s']} s) = ${gen['usd']:.2f} a take; {len(flags)} shot flags")


if __name__ == "__main__":
    main()
