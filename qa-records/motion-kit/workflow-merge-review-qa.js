export const meta = {
  name: 'motion-kit-merge-review-qa',
  description: 'Finish the motion-kit plan: re-run the verify passes the network cut, merge rounds 1+2+small items, prove/docs/sample, Opus review with fixes, 3 QA passes',
  phases: [
    { title: 'Verify', detail: 're-run verify A, B, C (cut off by a DNS outage)' },
    { title: 'Merge', detail: 'three-way merge of A, B, C, D, S into the stage copy + the lead decisions' },
    { title: 'Prove', detail: 'merged-stage tests, docs, the sample job (in parallel)' },
    { title: 'Review', detail: 'Opus review → fix (Alex: Opus only this time)' },
    { title: 'QA', detail: 'QA1 new work, QA2 old work unchanged, QA3 probes + suites; fix loop' },
  ],
}

const R = '/Users/bytedance/Downloads/Design-AutoPilot-stable'
const Q = `${R}/qa/motion-kit`
const ST = `${Q}/stage/product-launch-sting`
const BASE = `${Q}/base/product-launch-sting`
const LIVE = '/Users/bytedance/.claude/skills/product-launch-sting'
const LJ = '/Users/bytedance/Downloads/launch-videos'

const COMMON = `Context: you are part of a multi-agent build of the product-launch-sting video skill's "motion kit" for Alex (do not ask questions — decide sensibly and record decisions in your report). The plan is ${R}/qa/video-skill-learnings/TAKE-AND-HOW-2026-10-26.md; the contracts are ${Q}/SPEC-R1.md (its "Rules for every change" 1–13 apply to everything), ${Q}/SPEC-R2.md and ${Q}/SPEC-S.md. Worker reports are in ${Q}/reports/.
Hard rules: never edit the live skill ${LIVE}/ or ${Q}/live-before/ or ${Q}/base/ (the pre-round base) or any original job under ${LJ}/ (copy what you need with cp -c into ${Q}/jobs/<your-prefix>-*/; NEVER run lv.mjs --job on an original job — it writes out/ files there; the only exception is the NEW sample job folder named in your task, if you are the sample agent). No git commits or pushes. No paid API calls, no --go on any generator. Never run or install anything under ${R}/qa/video-skill-learnings/skills/ (research only), and never copy research frames, reference-reel stills or private footage (manus2-space astronaut clips, hf01 frames/audio) into the skill or into the sample job. Never print secrets (FAL_KEY, OpenAI key).
Heat: this laptop overheated and had to be switched off during the last run. Render gently: one render at a time (never two films or aspects in parallel from your own shell), --workers 2 at most, and between long renders check \`pmset -g therm\`: if it reports a thermal or performance warning level, sleep 180 s and check again before the next render. Prefer --range slices and storyboard stills over full films when they prove the same thing.
Shell: macOS, bash; foreground commands time out at 10 minutes — split long renders (one aspect at a time) or run them in the background and poll. Use absolute paths. Python: /usr/bin/python3 -I. If a command fails on a network error, retry it.
Disk: the disk is shared and was nearly full last night. Keep at least 25 GB free (df -k ~/Downloads); delete the frames/, layers/, textless/ and bgref/ folders of YOUR OWN test jobs as soon as you have measured them (keep mp4s, qa.json, stills and logs). Never delete anything you did not create. Earlier test jobs' frame folders were deleted to free space — re-render when you need frames.
Visual judgement matters: Read the PNG stills you render (the Read tool shows images) and judge them like a demanding motion designer who has studied the Higgsfield launch reels (no empty or flat frames, nothing popping in by opacity alone, nothing clipped, text readable, motion continuous across cuts).`

// retry wrapper: last night three agents died on a DNS outage (agent() returned null)
async function run(prompt, opts) {
  for (let i = 0; i < 3; i++) {
    const p = i ? `${prompt}\n\n(Attempt ${i + 1}: an earlier attempt of this same task died on a network/API error. Files it left are real — read the report path it was writing and continue from where it got, rather than starting over.)` : prompt
    const r = await agent(p, { ...opts, label: i ? `${opts.label}#${i + 1}` : opts.label })
    if (r) return r
    log(`${opts.label}: attempt ${i + 1} returned nothing; retrying`)
  }
  return { failed: true, label: opts.label }
}

// ---------------- Verify (re-run of the passes the DNS outage killed) ----------------
const verifyR1 = (who, area) => `${COMMON}
You are the MONITOR for Worker ${who} (${area}, round 1) — verify pass. Staging copy: ${Q}/stage${who}/product-launch-sting (tool: node ${Q}/stage${who}/product-launch-sting/video/lv.mjs). Your earlier findings: ${Q}/reports/${who}-monitor-r1.md. The worker's fix notes: the "Fix pass" section of ${Q}/reports/${who}-build-r1.md. (A first attempt of this verify pass died on a network outage; any ${Q}/jobs/ver-${who}-* folders are its partial leftovers — reuse or replace them.)
For EVERY finding, reproduce it again and give a verdict: FIXED / NOT FIXED / DISPUTED-WORKER-RIGHT / DISPUTED-WORKER-WRONG. Then re-run the whole done-criteria list for Worker ${who} in SPEC-R1 yourself and look for anything new the fixes broke (old jobs byte-identical with the live engine on clones; all three aspects). If something small is still broken and the fix is obvious and inside Worker ${who}'s files, fix it yourself in the staging copy and say so. Test jobs under ${Q}/jobs/ver-${who}-*/. Write ${Q}/reports/${who}-verify-r1.md. Final answer: verdict counts, anything still open, and the report path.`

const verifyC = `${COMMON}
You are the MONITOR for Worker C (engine transitions of round 2: carry, needle, morph, dive, from:/ctx.origin, flood, transition lint) — verify pass. Contract: ${Q}/SPEC-R1.md and ${Q}/SPEC-R2.md. Copy: ${Q}/stageC/product-launch-sting (tool: node ${Q}/stageC/product-launch-sting/video/lv.mjs). Your findings: ${Q}/reports/C-monitor.md; the worker's fix notes: the "Fix pass" section of ${Q}/reports/C-build-r2.md. (A first attempt died on a network outage; ${Q}/jobs/ver-C-* are its leftovers.)
For EVERY finding reproduce again: FIXED / NOT FIXED / DISPUTED-WORKER-RIGHT / DISPUTED-WORKER-WRONG. Read the frames around every cut (cut−4 … cut+6) of the dev films (r2-dev and r2-whip; clone them with cp -c into ${Q}/jobs/ver-C-*) in every aspect and judge them as a demanding motion designer: is the carried object truly continuous (no pop, jump, ghost or double), does the dive keep going forward, does the flood pour from the pressed thing, does the morph change size (not scale) cleanly? Re-run the done criteria (QA PASSED in 3 aspects, purity by a shuffled re-render on a fresh page, old jobs byte-identical with the live engine, --clips/--layers of a carry shot). If something small is still broken and the fix is obvious and inside Worker C's files, fix it yourself and say so. Write ${Q}/reports/C-verify.md. Final answer: verdict counts, anything still open, the report path.`

phase('Verify')
// one render-heavy agent at a time (heat)
const verifies = []
verifies.push(await run(verifyR1('A', 'the blocks: press, fan, particles, map, wall grid, type words, stack exploded'), { label: 'verify:A', phase: 'Verify' }))
verifies.push(await run(verifyR1('B', 'the frame checks: dead air, text floors by delivery, contrast, flash, reading time, purity, storyboard notes'), { label: 'verify:B', phase: 'Verify' }))
verifies.push(await run(verifyC, { label: 'verify:C', phase: 'Verify' }))

// ---------------- Merge ----------------
const mergePrompt = `${COMMON}
You are the INTEGRATOR (the lead's hands). Five workers built in separate copies made from the same base ${BASE}:
- Worker A (round-1 blocks) ${Q}/stageA/product-launch-sting — changed: engine/blocks/{_motion.js (new), press.js, fan.js, particles.js, map.js, stack.js, type.js, wall.js, index.js}, lib/spec.mjs
- Worker B (round-1 frame checks) ${Q}/stageB/... — engine/runtime.js, lib/{board.mjs, qa.mjs, render.mjs, timeline.mjs}, lv.mjs
- Worker C (round-2 transitions) ${Q}/stageC/... — engine/{runtime.js, kit.js}, engine/blocks/{float.js, stack.js, wall.js}, lib/{fingerprint.mjs, spec.mjs, timeline.mjs}
- Worker D (round-2 cut checks) ${Q}/stageD/... — lib/{board.mjs, qa.mjs, render.mjs, sheet.html, sheet.mjs}, lv.mjs
- Worker S (small items) ${Q}/stageS/... — SHOTS.md, shots/shots.py, shots/examples/phase2-band-shots.json (new), templates/{brief.md, launch15.yaml (new), launch30.yaml (new)}
(all paths under video/). Read every worker's build report, its "Fix pass" section and the verify reports (A-verify-r1.md, B-verify-r1.md, C-verify.md, D-verify.md, S-verify.md) first — the verify passes may have made last fixes in the worker copies.
The integration copy is ${ST}; it is currently identical to ${BASE} (check with diff -rq -x node_modules first; if not, stop and report). This time you DO edit it.

1. Record what you merge: for each worker copy write ${Q}/merge/worker-<X>.sha1 (shasum of every file under video/, excluding node_modules).
2. Merge. Files only one worker changed: copy them. Overlaps (trial merges show these conflict-hunk counts): stack.js A+C 2, wall.js A+C 3, spec.mjs A+C 1, runtime.js B+C 1, timeline.mjs B+C 1, render.mjs B+D 1 (known resolution: keep both keys — return { log, pages, audits, fit, layers, probes, composited, cams, sigs, sigs2 }), board.mjs/qa.mjs/lv.mjs B+D 0. Use git merge-file <workerX file> <base file> <workerY file> (three-way, base = ${BASE}) and resolve every conflict by hand so BOTH behaviours survive; read both sides' reports for intent (e.g. round 1's new modes in wall/stack must still get round 2's from: entrance only in their DEFAULT layouts; spec.mjs keeps both sets of enums/checks — mind float's from: rule and fan). After merging, node --check every .js/.mjs you touched, and for each worker diff its copy against the merged stage: only other workers' changes may differ (list any surprise).
3. Apply the lead's decisions (each is described in the named report; prove each one):
 a. Fan adopts the grow-from-a-point entrance: \`from:\` on a fan shot uses ctx.origin via K.grow in one line, as C's report describes for round-1 blocks; spec.mjs accepts from: on fan. Without from: the fan renders exactly as Worker A built it.
 b. lv.mjs: apply ${Q}/reports/S-lvmjs-kit.patch (--init --kit launch15|launch30), adjusting to the merged lv.mjs. Also add to the --blocks "Common to every shot" line the new fields (carry, dive, flood {from, spot, color}, from, cause; and top-level signature, delivery) — wording from C-build-r2.md and B-build-r1.md.
 c. Shot-writer tests: apply the P8 patch (${Q}/reports/S-rollback/p8_patched.py and S-build.md / S-verify.md M5) to ${R}/qa/shots-skill-port/, and make P4/P4b honour SHOTS_QA_VIDEO, so SHOTS_QA_VIDEO=${ST}/video bash ${R}/qa/shots-skill-port/run_all.sh ends ALL SUITES PASS (and the same run against ${LIVE}/video still behaves as before for the live skill — don't break the live run).
 d. engine/ui.js: C's two verified purity fixes (C-build-r2.md "Open issues after the fix pass" #1: the panel tap target rests at transform none instead of scale(1); the panel item entrance lands with rotate(.001deg)). Then measure which old-job frames change (film-sample, steady-sample, reel-sample clones, storyboard heroes + a film slice through a panel tap) and show the changed frames now equal a fresh-page draw; record it. If the old-job hero stills change visibly (more than a few code values), revert d and record why.
 e. engine/blocks/type.js: S-verify.md N1 — the opening-tracking clamp must also keep a head on one line when its final layout is one line. Prove old jobs' type shots are byte-identical and launch15's CTA no longer jumps lines on 9:16/1:1.
 f. shots.py N4 (the VERDICT comma rule, S-verify.md) and launch30 N3 (move the "120 films studied" claim out of the UI pill into a headline or stat shot, keep the legal-approval comment). Re-run the shot-writer suites.
 g. The skeletons templates/launch15.yaml and launch30.yaml: where their comments mark "# round 1: block: …" (or where a round-1 block or a round-2 transition plainly fits — the click → press; one → many → fan or wall grid; a flood or carry on one cut each, with cause: lines), switch to it now that the kit exists, keeping them asset-free (placeholders), within their word and timing targets (SPEC-S §3). Keep their QA: --film --aspect all QA PASSED in each aspect (read any new WARN lines and fix the template if they are real).
 h. QA's hard-cut check: a cut the timeline declares soft by design (a carry/morph that fills the frame or lands on the same plain background, a flood) must not FAIL as a missing hard cut — make it INFO "soft cut by design (<device>)". Old jobs' cut lines unchanged.
 i. Purity WARN (Worker B): before warning on a differing frame, re-render it once on a fresh page with the same predecessors (C-build-r2.md open issue #2); only a repeatable difference warns.
 j. Accept as built (record, no change): fingerprint.mjs changes (C); D's speed-ratio limits (3× built-in transitions, 2× after a dive and for carries) and hand-tuned drift → INFO; sheet.html as D's file; C's continuous-box morph timing; the fan headline's translate3d(0,0,0); particles as SVG; 16:9 fan chips at 34 px.
 k. Deferred for Alex (record in the report's "Deferred" list, don't do): B's snap-worker-seams-to-cuts (changes old frames); endcard / steady muted-grey colour contrast; the wall's pre-existing run-to-run raster noise; the spec's two-box ±18 % morph alternative; faster particles.
 l. If D's board.mjs does not yet print a shot's cause: under its storyboard frame like note:, add it.
4. Sanity: --grid on clones of EVERY original job under ${LJ} that has a beats.yaml (cp -c each into ${Q}/jobs/mrg-old-<name>; compare the stage tool's --grid output with the live tool's on separate clones: identical except new WARN/INFO lines — list them per job); --storyboard --aspect all of clones of kit-dev and r2-dev (${Q}/jobs/kit-dev, ${Q}/jobs/r2-dev → ${Q}/jobs/mrg-kit-dev, mrg-r2-dev) with no errors; Read the board stills.
Write ${Q}/reports/merge.md: files merged and how each conflict was resolved, each lead decision a–l with its proof, the sanity results, the Deferred list, anything you could not resolve. Final answer: PASS/FAIL per step + the report path.`

phase('Merge')
const merge = await run(mergePrompt, { label: 'merge', phase: 'Merge' })

// Alex 10-27: the flash check counts a leg's NET share (its way minus the other way) and stays a WARN
const flashPrompt = `${COMMON}
You are the FLASH-FIX agent. Alex decided (10-27) the open flash question from ${Q}/reports/B-verify-r1.md N1: use the "net" rule and keep the check a WARN (never FAIL). The merged integration copy is ${ST} (see ${Q}/reports/merge.md). Edit ONLY ${ST}/video/lib/qa.mjs (flashCheck and the file's header comment that describes it).
1. The rule: a candidate leg counts when its NET share — the window's pixels changing by ≥ 0.1 its way MINUS those changing by ≥ 0.1 the other way at the same moment — reaches the existing 25 % area bar. Everything else stays as built: the 3-a-second limit, the window layout, the area rule, the midpoint timing, the WARN wording. Keep the diff small. node --check it.
2. Strobes still caught: re-run B's measured cases (${Q}/runs/verB3/flashproto.mjs and fl.mjs show how) and the planted probes ${Q}/jobs/ver-B-flash and ver-B-flasharea (clone them with cp -c to ${Q}/jobs/fl-*; prefer lv.mjs --qa on existing frames over re-rendering): 3 Hz full frame quiet; 3.5, 4 and 10 Hz WARN; 300 px at 5 Hz WARN; 220 and 200 px quiet — exactly B-verify-r1.md's table. Add one new probe ${Q}/jobs/fl-strobe-motion: a full-frame 4 Hz strobe while a high-contrast card sweeps across the same window. It must still WARN; if it goes quiet, say so plainly as a finding for Alex and do NOT change the rule beyond "net".
3. Motion no longer counted: hf02-skill 1:1 (clone ${LJ}/hf02-skill to ${Q}/jobs/fl-hf02, or reuse frames under ${Q}/jobs/ver-B-old-hf02-skill-S) → no flash WARN; film-sample's scan shot (--range 1180,1370, all three aspects, clone ${Q}/jobs/fl-film) → record the new count per aspect (B measured 3 / 2 / WARN 4). Old jobs' PASS/FAIL lines unchanged (film-sample and steady-sample 16x9 qa.json: only flash WARN lines may change; list every line that changed).
Write ${Q}/reports/flash.md (the diff, every command and result, the before/after table) and append a section "m. Flash check: net share (Alex 10-27)" to ${Q}/reports/merge.md with the proof in two or three lines. Final answer: PASS/FAIL per step + the report path.`
const flash = await run(flashPrompt, { label: 'flash-net', phase: 'Merge' })

// ---------------- Prove / Docs / Sample (parallel; only 'prove' may edit stage code, docs edits only .md) ----------------
const provePrompt = `${COMMON}
You are the MERGED-STAGE TESTER. The integration copy ${ST} now holds rounds 1 + 2 + the small items (see ${Q}/reports/merge.md). Tool: node ${ST}/video/lv.mjs. You may fix bugs you find in ${ST} code (record every edit with file:line and why); another agent edits only the .md docs in ${ST} at the same time, and another renders a sample job — don't touch their files.
1. Full films: clones ${Q}/jobs/prv-kit-dev (from ${Q}/jobs/kit-dev) and ${Q}/jobs/prv-r2-dev (from ${Q}/jobs/r2-dev, and r2-whip if present): --film --aspect all → QA PASSED for every aspect; read every new WARN/INFO line and say whether it is a true problem.
2. A combined job ${Q}/jobs/prv-combo (new, asset-free or using film-sample's brand assets; no private footage): round-1 blocks joined by round-2 transitions — e.g. press → flood into the next shot, a fan born from: the pressed element, a carry from a prompt box into a map or a wall layout: grid, a dive into the particles sphere, type words, stack mode: exploded, a needle carry into the end card, cause: on every moving cut, a signature. 3 aspects, --film --aspect all QA PASSED each. Read the stills at cut−4 … cut+6 of every cut (16x9 at least, plus the 9x16 cuts) and judge continuity like a motion designer; fix engine bugs you find.
3. Purity: a shuffled re-render of 30 frames inside transition windows of prv-combo on a fresh page equals the film (within B's documented tolerance).
4. --layers for one shot of each new block plus one carry shot (16x9) → layer QA passes; --clips <one shot> --alpha passes; --sheet --aspect 16x9 on prv-combo renders the review sheet with cut stills (Read its HTML and a screenshot or the cut-strip JPGs).
5. Old jobs: storyboard hero PNGs of clones of film-sample, steady-sample, reel-sample, edge-test, dark-ui-check (all their aspects) byte-identical between the live tool and the stage tool (known exception: the wall/stack 3D heroes' raster noise ≤ 3 code values, which two live runs also show — prove it with two live runs); a 120-frame --film --range slice of film-sample 16x9 byte-identical; --film of steady-sample 16x9 → QA PASSED with the same PASS/FAIL lines as the live tool's run (only new WARN/INFO added). The QA probes qa-probe and qa-probe2 still FAIL as before.
Write ${Q}/reports/prove.md (commands, QA summaries, stills paths, every fix with proof). Final answer: PASS/FAIL per step + the report path.`

const docsPrompt = `${COMMON}
You are the DOCS WRITER. The integration copy ${ST} now holds rounds 1 + 2 + the small items (see ${Q}/reports/merge.md and every worker report's "GUIDE text I'd add" section, with their fix-pass corrections). Edit ONLY Markdown files in ${ST} (video/GUIDE.md, SKILL.md, and where needed video/SHOTS.md, video/STORYBOARD.md, video/templates/*.md) — never .js/.mjs/.py/.yaml (other agents edit code now; changes to block doc strings → list them in your report for the fixers).
Write, in GUIDE.md's own house style and plain words (paraphrase; never paste research text): the new block rows and their fields (press, fan, particles, map; wall layout: grid; type words; stack mode: exploded), with one short example each; a "Transitions that cross the cut" section (the core rule; carry smooth/needle, morph incl. to: frame, dive, from:, flood, cause:, signature:, the transition lint); the frame checks table (dead air, text floors by delivery web/feed/tv, contrast, flash, reading time, purity, cut continuity) with what each warns on and how to silence it legitimately; the review sheet's cut stills; --kit launch15|launch30 and what the brief's passport / trigger map / pacing targets are for; custom-block authors' notes (ctx.origin/K.grow, ctx.entered, ctx.carried, the Chrome transform rule: never settle an animated transform on scale(1) or a bare translate). Make every documented field match the code: run lv.mjs --blocks and --grid on small examples you write under ${Q}/jobs/doc-* to confirm each example in the docs validates. SKILL.md: add the new capabilities to the router/description in one or two lines (one skill per domain — extend, don't fork). Keep the existing structure; no reformatting of untouched sections.
Write ${Q}/reports/docs.md (what you added where, every example you validated, suggested doc-string changes for code). Final answer: a short summary + the report path.`

const samplePrompt = `${COMMON}
You are the SAMPLE-JOB AGENT. Make the finished showcase job ${LJ}/motion-kit-sample (a NEW folder you create; you may run the stage tool on it): a 20–30 s launch film for a fictional product (not Manus, not TikTok, no real brand) that shows the new kit at its best — press, fan, particles, map, wall layout: grid, type words, stack mode: exploded — joined by the round-2 transitions (a flood from the pressed thing, a carry or needle, a morph to: frame into the end card, a dive, from: on a fan or float) with cause: lines and one signature, on a beat grid with music: as the templates do (no paid generation; no private footage; placeholder or in-engine visuals only). Start from the merged starter: node ${ST}/video/lv.mjs --init --kit launch30 (or launch15) as documented in ${Q}/reports/S-build.md, then design it properly (read ${ST}/video/GUIDE.md and ${ST}/video/templates/brief.md; fill a brief.md passport for it in the job folder). Tool: node ${ST}/video/lv.mjs. Do not edit ${ST} — if you hit an engine bug, work around it in the job and write the bug down in your report with a repro.
Iterate visually: --storyboard --aspect all, Read every still, improve; then --film --aspect all → QA PASSED each; read every WARN and fix the real ones in the job; --sheet --aspect 16x9. Delete the frames/ folders when done (keep the mp4s, stills, qa.json, the sheet).
Write ${Q}/reports/sample.md (the shot list, why each choice, QA lines, still paths, engine bugs found). Final answer: a short summary + the report path.`

phase('Prove')
// docs barely renders, so it runs beside prove; the sample (render-heavy) waits for prove (heat)
const [prove, docs] = await parallel([
  () => run(provePrompt, { label: 'prove', phase: 'Prove' }),
  () => run(docsPrompt, { label: 'docs', phase: 'Prove' }),
])
const sample = await run(samplePrompt, { label: 'sample', phase: 'Prove' })

// ---------------- Review chain ----------------
const SCOPE = `Scope: everything new in ${ST} — code: diff -ru -x node_modules ${BASE} ${ST} (base = the live skill plus four stub blocks); docs: diff -ru -x node_modules ${LIVE} ${ST} for the .md files; tests: ${R}/qa/shots-skill-port changes; the sample job ${LJ}/motion-kit-sample; the dev/combo jobs ${Q}/jobs/prv-*. Context: ${Q}/reports/merge.md, prove.md, docs.md, sample.md and the worker/verify reports.`
const reviewAsk = `Find what is wrong, missing or weak — adversarially, by running things (renders, --grid on bad inputs, old-job comparisons against the live tool on clones), never by trusting the reports. Look for: correctness bugs and crashes on valid or odd input (all three aspects); regressions on old jobs (byte-identity with the live tool, unchanged PASS/FAIL); purity (frames depending on draw order); validation gaps and unclear messages; docs that don't match the code (run the GUIDE examples); visual quality of the new blocks and transitions (Read stills around cuts); performance traps; hygiene (no secrets, no private/reference frames or footage, no research text pasted verbatim); diff hygiene. Test jobs only under ${Q}/jobs/<your prefix>-*. Do NOT edit ${ST} or any test file — you only report. Output: numbered findings, each with severity (HIGH / MEDIUM / LOW), file:line, an exact repro command, what you saw, and the fix you'd make.`

const fixPrompt = (name, rep) => `${COMMON}
You are the FIXER after the ${name} review. Findings: ${rep}. ${SCOPE}
Fix every HIGH and MEDIUM and every cheap LOW in ${ST} (and the sample job / shot-writer tests if the finding is there); if you disagree, give evidence (command + output). Re-run the affected tests and then a short regression: --grid on clones of film-sample and steady-sample identical to the live tool except new WARN/INFO; storyboard heroes of film-sample byte-identical with live; prv-combo --film --aspect 16x9 QA PASSED; the shot-writer suites against ${ST}/video ALL SUITES PASS. Append a "${name} fixes" section to ${Q}/reports/fixes.md: per finding → fixed (how, proof) or not (why). Final answer: counts fixed / not fixed + anything left open.`

phase('Review')
// Alex 10-26: this time an Opus review only (no Sonnet, no Codex)
const opus = await run(`${COMMON}\nYou are the REVIEWER (the only review this round, so cover both angles). ${SCOPE}\n(1) Read the code diff line by line for real bugs: wrong logic, off-by-one frame maths, unhandled inputs, impurity (a frame depending on draw order), validation gaps, behaviour changes for timelines that don't use the new fields, Python edge cases in shots.py — prove each by running it. (2) Judge the visual quality of the sample film and the new blocks and transitions in every aspect (Read stills; judge against the Higgsfield launch reels the plan studied: ${R}/qa/video-skill-learnings/TAKE-AND-HOW-2026-10-26.md). (3) Check the plan's Round 1, Round 2 and Small items are all actually delivered (go item by item). ${reviewAsk}\nWrite the findings to ${Q}/reports/review-opus.md. Final answer: counts by severity + the report path.`, { label: 'review:opus', phase: 'Review' })
const fix3 = await run(fixPrompt('Opus', `${Q}/reports/review-opus.md`), { label: 'fix:opus', phase: 'Review' })

// ---------------- QA ----------------
const QA_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, summary: { type: 'string' }, failures: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } }, required: ['pass', 'summary', 'failures', 'report'] }
const QAS = {
  qa1: `QA PASS 1 — the new work, end to end, as a user would. Fresh clones only (${Q}/jobs/qa1-*): kit-dev, r2-dev, prv-combo and ${LJ}/motion-kit-sample (cp -c, no out/ needed), plus two new jobs made with node ${ST}/video/lv.mjs --init --kit launch15 / launch30 --title "<a fictional name>". For each: --grid, --storyboard --aspect all, --film --aspect all → QA PASSED for every aspect; Read the stills at every cut of the 16x9 film and the hero still of every shot in 9x16 and 1x1; judge as a motion designer (anything clipped, empty, popping, discontinuous across a cut = a failure). Also: --layers for one press, one fan, one particles, one map, one exploded stack and one carry shot (16x9) → layer QA passes; --clips <one shot> --alpha passes; --sheet --aspect 16x9 for motion-kit-sample with cut stills. pass = every QA PASSED and no visual defect you'd call HIGH.`,
  qa2: `QA PASS 2 — the old work is unchanged. For EVERY original job under ${LJ} that has a beats.yaml (except motion-kit-sample): clone it twice (${Q}/jobs/qa2-live-<name> and qa2-stage-<name>, cp -c, without its out/ folder if it is large). --grid: the stage output equals the live tool's except added WARN/INFO lines (list them). Storyboard heroes for every aspect the job declares: byte-identical between live and stage (the only allowed exception: wall/stack 3D heroes with ≤ 3 code values of raster noise, proved as noise by two live runs). Films: --film --aspect 16x9 with BOTH tools for film-sample, steady-sample and reel-sample → the same PASS/FAIL lines (only new WARN/INFO added) and frames byte-identical except the documented ui.js/raster-noise cases (quantify). qa-probe and qa-probe2 still FAIL exactly as with the live tool. Mode A (the 12 s sting at the skill root: build.mjs/render.mjs/qa.mjs/stage.html): the root files are identical to the live skill's (diff), and one mode-A build following SKILL.md runs to its QA pass with the stage copy into a scratch output folder (if mode A needs inputs, use its bundled brands/ example). pass = all identical/equal as described.`,
  qa3: `QA PASS 3 — every guard fires and stays quiet correctly. Planted probe jobs under ${Q}/jobs/qa3-*: one per new frame check (dead air, text floors with delivery: web/feed/tv, contrast, flash, reading time incl. CJK, purity with an order-dependent custom block, cut continuity incl. a dive into a shot that starts zoomed in and shrinks) → each WARNs as the GUIDE says, and the same checks are silent on film-sample and the motion-kit-sample; one per new validation (carry with an unknown layer, carry on the last shot, carry landing on an invisible element, dive into a missing layer, from: typo on float, bad flood colour, press with a very long label, fan count 9 with labels on 1:1, particles bad mode, wall grid bad cols, type words empty, stack exploded with no cards, an invalid delivery, signature as a list, blank cause) → one clear line each, the right rc; the transition lint (more than 2 types, missing cause). Shot writer: SHOTS_QA_VIDEO=${ST}/video bash ${R}/qa/shots-skill-port/run_all.sh → ALL SUITES PASS, and the same suites against the live skill behave as they did before tonight; shots.py on the phase-2 example prints each new field where SHOTS.md says, negatives stay out of the prompt until confirmed; lv.mjs --init --kit launch20 → rc 2 with a clear message. pass = every guard behaves as documented.`,
}
const qaPrompt = k => `${COMMON}\nYou are an independent QA TESTER. Tool: node ${ST}/video/lv.mjs (the merged stage copy; live tool for comparison: node ${LIVE}/video/lv.mjs). Do NOT edit ${ST} or any test file — you only test and report.\n${QAS[k]}\nWrite ${Q}/reports/${k}.md (every command, its result, still paths, failures with exact repro). Return pass/summary/failures/report.`

phase('QA')
let qa = {}
let todo = ['qa1', 'qa2', 'qa3']
for (let round = 1; round <= 3 && todo.length; round++) {
  const res = []  // one QA pass at a time (heat)
  for (const k of todo) res.push(await agent(qaPrompt(k), { label: `${k}#r${round}`, phase: 'QA', schema: QA_SCHEMA }).then(r => ({ k, r })))
  for (const x of res.filter(Boolean)) qa[x.k] = x.r || { pass: false, summary: 'agent died (network?)', failures: ['no result'], report: '' }
  for (const k of todo) if (!qa[k]) qa[k] = { pass: false, summary: 'no result', failures: ['no result'], report: '' }
  const failed = todo.filter(k => !qa[k].pass)
  log(`QA round ${round}: ${todo.map(k => `${k}=${qa[k].pass ? 'PASS' : 'FAIL'}`).join(' ')}`)
  if (!failed.length || round === 3) { todo = failed; break }
  const real = failed.filter(k => qa[k].failures.join(' ') !== 'no result')
  if (real.length) {
    await run(`${COMMON}\nYou are the QA FIXER (round ${round}). These QA passes failed: ${real.map(k => `${k} (${Q}/reports/${k}.md): ${qa[k].failures.join(' | ')}`).join('\n')}\n${SCOPE}\nReproduce each failure, fix the cause in ${ST} (or the sample job / tests), re-run the failing commands, and append a "QA round ${round} fixes" section to ${Q}/reports/fixes.md. Final answer: what you fixed and what is still failing.`, { label: `qa-fix#${round}`, phase: 'QA' })
  }
  todo = failed
}

return { verifies, merge, flash, prove, docs, sample, opus, fix3, qa, qaStillFailing: todo }
