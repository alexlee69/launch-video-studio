// cue_sheets.js: the Cue agents' model sheets, as standalone loops (labels are fine here; these are reference, not video).
//   node render.mjs --loop=cue --sheet=1 --cols=1 --w=1920 --out=docs/cue_family.jpg
//   node render.mjs --loop=cueEmotions --sheet=1 --cols=1 --w=1920 --out=docs/cue_emotions.jpg
(() => {
  const label = (txt, x, y, size = 20) => letter(txt, x, y, size, PAL.ink, { ink: false, alpha: .8 });
  const floor = y => inkLine([[40, y + 6], [W / 2, y + 4], [W - 40, y + 7]], .6, mixCol(PAL.paper, PAL.ink, .35), 'inkfine', .5);

  LOOPS.cue = t => {
    // row 1: the family, alive, each in its signature face
    const tags = { tri: 'tri', drop: 'drop', star: 'star', heart: 'heart', cog: 'cog (logo)', mint: 'mint', brief: 'brief', ghost: 'ghost', blob: 'blob' };
    CUE_NAMES.forEach((n, i) => { const cx = W / 9 * (i + .5); cue(cx, 330, 13, cueFeel(n, 'neutral', t, { seed: i })); label(tags[n], cx, 372, 22); });
    floor(330);
    // row 2: turns (drawn views) and motion
    const y2 = 660, u2 = 9.5, row = [
      ['front', x => cue(x, y2, u2, { ...cueFeel('tri', 'neutral', t), view: 'front' })],
      ['q', x => cue(x, y2, u2, { ...cueFeel('tri', 'neutral', t), view: 'q' })],
      ['side', x => cue(x, y2, u2, { ...cueFeel('tri', 'neutral', t), view: 'side' })],
      ['back', x => cue(x, y2, u2, { ...cueFeel('tri', 'neutral', t), view: 'back' })],
      ['turn', x => cue(x, y2, u2, { ...cueFeel('ghost', 'happy', t), ...spinView(Math.floor(t * 2) / 8) })],
      ['jump', x => { const k = t % 1.5; cue(x, y2, u2, { ...cueFeel('star', 'excited', t), ...jump(k, .35, .95, 3) }); }],
      ['take', x => cue(x, y2, u2, { ...cueFeel('heart', 'surprised', t), ...take(t % 2, .5, 1.2), emoteAge: (t % 2) - .5, emoteK: seg(t % 2, .5, .7) })],
      ['hop', x => cue(x, y2, u2, { agent: 'mint', ...move('hop', t), eyes: 'determined' })],
      ['smear', x => cue(x, y2, u2, { ...cueFeel('drop', 'excited', t), view: 'side', smear: .8, smearDir: 1, dx: Math.sin(t * TAU / 2) * .3 })],
      ['float', x => cue(x, y2, u2, cueFeel('blob', 'happy', t))],
    ];
    row.forEach(([name, f], i) => { const x = 110 + i * 189; f(x); label(name, x, y2 + 36); });
    floor(y2);
    // row 3: acted mood changes (emotions with anticipation, take, settle), hats, and a prop riding on a head
    const y3 = 960, u3 = 9.5, lt = t % 4, row3 = [
      ['bored → idea', x => cue(x, y3, u3, cueEmotions(lt, 'brief', [[0, 'bored'], [1.3, 'idea']]))],
      ['sleepy → surprised → happy', x => cue(x, y3, u3, cueEmotions(lt, 'cog', [[0, 'sleepy'], [1.4, 'surprised'], [2.4, 'happy']]))],
      ['nervous → relieved', x => cue(x, y3, u3, cueEmotions(lt, 'drop', [[0, 'nervous'], [2, 'relieved']]))],
      ['party', x => cue(x, y3, u3, { ...cueFeel('heart', 'happy', t), hat: 'party' })],
      ['crown', x => cue(x, y3, u3, { ...cueFeel('star', 'proud', t), hat: 'crown' })],
      ['headphones', x => cue(x, y3, u3, { ...cueFeel('mint', 'cool', t), hat: 'headphones' })],
      ['carry', x => cue(x, y3, u3, { ...cueFeel('tri', 'determined', t), carry: (u, sw) => {   // an envelope balanced on top
        const b = Math.sin(t * TAU) * .25 * u; push(); translate(0, -1.6 * u + b); rotate(.08 * Math.sin(t * TAU));
        paint(rectPts(-2.2 * u, -1.4 * u, 4.4 * u, 2.8 * u), { wash: PAL.cream, ink: PAL.ink, sw: sw * .7 });
        inkLine([[-2.1 * u, -1.3 * u], [0, .2 * u], [2.1 * u, -1.3 * u]], sw * .6, PAL.ink, 'inkfine', 0); pop(); } })],
    ];
    row3.forEach(([name, f], i) => { const x = 140 + i * 273; f(x); label(name, x, y3 + 36, 18); });
    floor(y3);
  };
  LOOPS.cue.len = 4;

  // Every emotion in EMO, each on a different agent (they all share one acting system).
  LOOPS.cueEmotions = t => {
    const names = Object.keys(EMO), cols = 8, cw = W / cols, ch = H / 4;
    names.forEach((name, i) => {
      const cx = cw * (i % cols) + cw / 2, gy = ch * Math.floor(i / cols) + ch - 62, ag = CUE_NAMES[i % CUE_NAMES.length];
      cue(cx, gy, 10, cueFeel(ag, name, t, { seed: i }));
      label(name, cx, gy + 32);
    });
    for (let r = 0; r < 4; r++) floor(ch * r + ch - 62);
  };
  LOOPS.cueEmotions.len = 4;
})();
