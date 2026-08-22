/* test-sleep-duration.js — A SLEEP'S LENGTH IS DECIDED WHEN IT LANDS, AND REST OVERWRITES IT.
 *
 *   SHOWDOWN_PATH=... node tests/test-sleep-duration.js
 *   SHOWDOWN_PATH=... node tests/test-sleep-duration.js --release <id>
 *
 * ================= WHAT CHAMPIONS ACTUALLY SAYS, READ AND CITED =================================
 *
 * `data/mods/champions/conditions.ts:11-29` OVERRIDES `slp`:
 *
 *     // 1/3 chance for a Pokemon to wake up on turn 2
 *     this.effectState.startTime = this.sample([2, 3, 3]);
 *     this.effectState.time = this.effectState.startTime;
 *
 * Mainline is `this.random(2, 5)` -> {2,3,4}, so reading `data/conditions.ts` here is the documented
 * way to be wrong. `Battle#sample` is `items[this.random(items.length)]` — ONE draw of `random(3)`
 * indexing the table, which is why the table is reproduced rather than collapsed to "1/3".
 *
 * `data/mods/champions/moves.ts` has NO `rest:` key, so mainline's `rest.onHit` is the rule:
 *
 *     const result = target.setStatus('slp', source, move);   // slp.onStart samples 2/3/3 …
 *     target.statusState.time = 3;                            // … and this OVERWRITES it
 *     target.statusState.startTime = 3;
 *
 * So a Rest is a FIXED two missed turns and can never wake early. A natural sleep is one or two.
 *
 * ================= WHAT THIS ENGINE HAD, AND WHY EVERY RATE CHECK PASSED ========================
 *
 * The wake check was `slpTurns >= 3 || (slpTurns === 2 && rng() < 1/3)` — a coin flipped at the
 * SECOND sleeping turn rather than a length sampled at the first. Over a population that is the same
 * 5/3 expected turns lost, and `SLEEP_TURNS_LOST = 1 + 2/3` in this engine is exactly that
 * expectation, so the DISTRIBUTION was already right and nothing that measures a rate could see it.
 *
 * WHAT IT COULD NOT REPRESENT IS REST. With no stored length there was nothing for the override to
 * write onto, so a Rested body got up a turn early one time in three — at full HP, with its move.
 * `data/tags.json` had carried the number all along: rest's `healDescriptor.setsStatus` is
 * `{status:'slp', turns:3}` and NOTHING READ IT. Same shape as the Life Orb recoil stored as prose.
 *
 * ================= WHY THE TWO CORNERS ARE THE RIGHT ARMS AND THE MIDDLE ONE IS NOT =============
 *
 * The defect is a DIE, and the pinned corners make it deterministic rather than hiding it:
 *
 *   bottom-tie-first  the authority's `random(3)` returns 0 -> `sample` index 0 -> startTime 2, and
 *                     this engine's old coin `rng() < 1/3` was TRUE. Both wake early on a natural
 *                     sleep, which is why the natural arm agrees in both engines and is the control.
 *                     On a REST the authority overwrites to 3 and we did not: the streams part on
 *                     exactly that line, and this is the RED arm.
 *   top-tie-first     `random(3)` returns 2 -> startTime 3, and the old coin was FALSE. Both sleep
 *                     two turns, so the corner is blind to the defect — kept as the arm that must
 *                     not move.
 *
 * THE MIDDLE ARM IS EXCLUDED, MEASURED RATHER THAN ASSUMED. Its addresses are derived from which
 * BattleActions method is executing (`hitStepAccuracy` / `secondaries` / `getDamage`), and
 * `slp.onStart` is none of them: on the authority side the draw lands with no battle in scope and
 * addresses as `<seed>|0|any|-|-`, which nothing on this side can be made to match. That is an
 * instrument limitation, not an engine one, and an arm that cannot line up is an arm whose green
 * means nothing.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
const NL = String.fromCharCode(10);
const EMIT = process.argv.includes('--emit');

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const ARM_IDS = ['bottom-tie-first', 'top-tie-first'];

/* THE ATTACKING SIDE. Surf and not Muddy Water, and the reason was measured: Muddy Water is 85
 * accuracy, `top-tie-first` MISSES every sub-100 move, so the Rest arm never took damage, Rest failed
 * at full HP and that whole corner tested nothing while reporting AGREES. Surf is 100 accuracy with
 * no secondary of its own, so the damage lands at both corners. */
const ATT = [['milotic', '', 'Marvel Scale', ['Surf', 'Hypnosis', 'Protect']],
             ['clefable', '', 'Unaware', ['Protect']],
             ['incineroar', '', 'Intimidate', ['Protect']],
             ['corviknight', '', 'Pressure', ['Protect']]];
/* THE SLEEPER CLICKS AMNESIA, NOT PROTECT. A shield refuses Spore one gate earlier and, at the bottom
 * corner, Protect's consecutive-use chance is pinned TRUE so the shield never drops — the arm would
 * be a Protect test wearing a sleep label. Amnesia is a pure self-boost: no dice, no HP, no field. */
const SLEEPER = ['snorlax', '', 'Thick Fat', ['Rest', 'Amnesia', 'Protect']];
const BENCH_B = [['spiritomb', '', 'Pressure', ['Protect']],
                 ['toxapex', '', 'Regenerator', ['Protect']],
                 ['garchomp', '', 'Rough Skin', ['Protect']]];
const DEF = [SLEEPER].concat(BENCH_B);
const AMN = { m: 'amnesia' };

const CASES = [
  /* ---- RED: the arm the wire is about ---------------------------------------------------------- */
  { kind: 'RED', name: 'rest        a Rested body sleeps a FIXED two turns and cannot wake early',
    script: [T([{ m: 'surf' }, PROT], [AMN, PROT]),
             T([PROT, PROT], [{ m: 'rest' }, PROT]),
             T([PROT, PROT], [{ m: 'rest' }, PROT]),
             T([PROT, PROT], [{ m: 'rest' }, PROT]),
             T([PROT, PROT], [{ m: 'rest' }, PROT]),
             T([PROT, PROT], [{ m: 'rest' }, PROT])] },

  /* ---- CONTROL: the half that was already right and may not move --------------------------------
   * BOTTOM CORNER ONLY, AND THE REASON IS DERIVED RATHER THAN CHOSEN. `top-tie-first` MISSES every
   * sub-100-accuracy move, and this format has NO 100-accuracy sleep move with a legal carrier —
   * Spore has ZERO legal users in Reg M-B (asserted below, not recalled), leaving Sleep Powder 75,
   * Hypnosis 60 and Sing 55. So a natural sleep cannot be staged at the top corner at all, and an arm
   * that stages a miss and calls itself a sleep control is the empty green this repo keeps paying
   * for. The bottom corner is the one that matters anyway: it is where the old wake-site coin
   * returned TRUE. */
  { kind: 'CONTROL', arms: ['bottom-tie-first'],
    name: 'hypnosis    a NATURAL sleep — the distribution was already correct',
    script: [T([{ m: 'hypnosis', t: 0 }, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT])] },
  /* ONE Surf AND THEN SHIELDS, AND THE REASON WAS MEASURED. Five Surfs killed Snorlax at
   * `bottom-tie-first` — that corner lands EVERY crit — the driver sent a replacement, and the
   * scripted `amnesia` was not on the new body's request: *"amnesia (offered: protect)"*, caught by
   * `scriptCounters().moveNotOnRequest`. Both engines then passed silently and the turn tested
   * nothing. A KO inside a scripted fixture is a staging defect. */
  { kind: 'CONTROL', name: 'no sleep    the same bodies, the same first click, nobody ever falls asleep',
    script: [T([{ m: 'surf' }, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT]),
             T([PROT, PROT], [AMN, PROT])] },
];

/* ---- LEGALITY, DERIVED ---------------------------------------------------------------------- */
if (!EMIT) {
  const LS = dex.data.Learnsets;
  const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const learns = (sp, mv) => {
    let s = dex.species.get(sp);
    while (s && s.exists) {
      const e = LS[s.id];
      if (e && e.learnset && e.learnset[dex.moves.get(mv).id]) return true;
      s = s.prevo ? dex.species.get(s.prevo)
        : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
    }
    return false;
  };
  let illegal = 0;
  for (const row of ATT.concat(DEF)) {
    const sp = dex.species.get(row[0]);
    if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
    if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id).includes(dex.abilities.get(row[2]).id)) {
      console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
    }
    for (const mv of row[3]) {
      const m = dex.moves.get(mv);
      if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
      if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
    }
  }
  /* AND THE FIXTURE'S PREMISE IS DERIVED, NOT DESCRIBED. Three claims this file rests on, each read
   * from the live format rather than from the header above. */
  const slp = dex.conditions.get('slp');
  const src = String(slp && slp.onStart || '');
  if (!/sample\(\s*\[\s*2\s*,\s*3\s*,\s*3\s*\]/.test(src)) {
    illegal++;
    console.log('PREMISE MOVED  this format\'s slp.onStart no longer samples [2,3,3] — re-derive before trusting this file');
  }
  const rest = dex.moves.get('rest');
  if (!/statusState\.time\s*=\s*3/.test(String(rest.onHit || ''))) {
    illegal++;
    console.log('PREMISE MOVED  rest.onHit no longer pins statusState.time to 3 in this format');
  }
  const TAGS = JSON.parse(require('fs').readFileSync(D('data', 'tags.json'), 'utf8'));
  const rt = TAGS.moves && TAGS.moves.rest && TAGS.moves.rest.params
          && TAGS.moves.rest.params.healDescriptor && TAGS.moves.rest.params.healDescriptor.setsStatus;
  if (!rt || rt.status !== 'slp' || +rt.turns !== 3) {
    illegal++;
    console.log('PREMISE MOVED  data/tags.json no longer gives rest healDescriptor.setsStatus {slp,3}: ' + JSON.stringify(rt));
  } else {
    console.log('premise    slp.onStart samples [2,3,3]; rest.onHit pins time=3; tags.json carries setsStatus {slp, turns 3} — all three read live');
  }
  /* THE FOURTH PREMISE: that no 100-accuracy sleep move can be staged, which is what confines the
   * natural-sleep control to one corner. Derived, so a regulation that brings a Spore carrier makes
   * this file say so instead of quietly keeping the restriction. */
  {
    const isLegal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
    const carriers = (mv) => dex.species.all().filter(isLegal).filter(sp => {
      const e = LS[sp.id]; return !!(e && e.learnset && e.learnset[mv]); }).length;
    const full = dex.moves.all().filter(isLegal)
      .filter(mv => mv.status === 'slp' && mv.accuracy === 100 && carriers(mv.id) > 0);
    if (full.length) {
      illegal++;
      console.log('PREMISE MOVED  this format now has a 100-accuracy sleep move with a legal carrier ('
        + full.map(x => x.name).join(', ') + ') — the natural-sleep control can and should run at BOTH corners');
    } else {
      console.log('premise    no 100-accuracy sleep move has a legal carrier here (Spore: '
        + carriers('spore') + '), so a natural sleep cannot be staged at top-tie-first');
    }
  }
  if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s) or moved premise(s). This is not a pass.'); process.exit(2); }
}

/* ---- the run ------------------------------------------------------------------------------------ */
function runAll() {
  const out = [];
  G.resetScriptCounters();
  for (const armId of ARM_IDS) {
    const ARM = G.ARM_BY_ID.get(armId);
    for (const c of CASES) {
      if (c.arms && !c.arms.includes(armId)) continue;
      G.driverReset();
      const a = G.buildPair(stage(ATT)), b = G.buildPair(stage(DEF));
      if (!a || !b) { out.push({ arm: armId, kind: c.kind, name: c.name, err: 'NOT-STAGED' }); continue; }
      const r = G.playGame(a, b, 'directed', 'sleep :: ' + armId + ' :: ' + c.name, { script: c.script, arm: ARM });
      /* `cant|slp` LINES ARE THE OBSERVABLE, and they are the medicham stream's — the point of the arm
       * is that the two streams are compared line for line, so a count here is a description of what
       * the arm exercised, never the assertion. A RED case with zero of them tested nothing. */
      const cant = (r.mediTrace || []).filter(l => /^\|cant\|.*\bslp\b/.test(String(l))).length;
      out.push({ arm: armId, kind: c.kind, name: c.name, err: r.err || null,
                 turns: r.turns, lines: r.lines, walked: r.comparedWalked, cant,
                 div: r.div ? (r.div.index + ' :: me ' + r.div.meRaw + ' :: sd ' + r.div.sdRaw) : null });
    }
  }
  return out;
}

const HERE = runAll();
if (EMIT) { process.stdout.write('@@JSON@@' + JSON.stringify(HERE) + '@@END@@' + NL); process.exit(0); }

let bad = 0;
console.log(NL + 'SLEEP DURATION — sampled at application, and Rest overwrites it');
console.log('  arms: ' + ARM_IDS.join(', ') + '   (the middle arm cannot address this draw — see the header)');
console.log('');
for (const r of HERE) {
  const tag = r.err ? 'THREW      ' : r.div ? 'STREAMS PART' : 'AGREES     ';
  if (r.err || r.div) bad++;
  console.log(tag + ' ' + r.arm.padEnd(17) + r.name + '   [' + r.cant + ' |cant|slp]');
  if (r.div) console.log('               parted at reduced line ' + r.div);
  if (r.err) console.log('               ' + r.err);
  /* AN ARM THAT NEVER PUT ANYBODY TO SLEEP IS NOT A SLEEP TEST. */
  if (!r.err && r.kind !== 'CONTROL' && !r.cant) {
    bad++;
    console.log('               EMPTY ARM — no |cant|slp at all, so nothing here was asleep');
  }
}

const sc = G.scriptCounters();
console.log('');
if (sc.moveNotOnRequest !== 0) {
  bad++;
  console.log('FIXTURE BROKEN — ' + sc.moveNotOnRequest + ' scripted click(s) were not on Showdown\'s request '
    + 'and became a silent `pass` on BOTH engines. First: ' + sc.firstMissing);
} else {
  console.log('scripted clicks refused by the authority\'s request: 0 (every click above really ran)');
}

/* ---- THE COUNTERS, AT EXACT EQUALITY, AND THE NOUN EACH ONE COUNTS ----------------------------
 *
 *   sleepDurationDrawn        SLEEPS whose length was sampled AT APPLICATION. Not turns, not bodies,
 *                             not wake-ups. The fixture stages exactly one landed sleep per arm in
 *                             the `rest` case and one in the `spore` case and none in the third, so
 *                             this is 2 per arm.
 *   sleepDurationFixedByMove  SLEEPS whose sampled length was then OVERWRITTEN by the move's own
 *                             `healDescriptor.setsStatus.turns`. THIS IS THE COUNTER THAT CAN SEE THE
 *                             DEFECT: a natural sleep and a Rest both raise `sleepDurationDrawn`, and
 *                             only the override tells them apart. One per arm.
 *   sleepDurationDrawnLate    SLEEPS met ALREADY IN PROGRESS, whose duration was never sampled here.
 *                             Zero in a fixture where every sleep starts on camera; non-zero would
 *                             mean the application-time draw was skipped and the wake site invented
 *                             a length, which is the silent default in a new place.
 *
 * Every one is `=== n`. A `>= 1` bar is passed by an engine that samples once and then flips a coin
 * anyway, which is most of the defect. */
const SEEN = globalThis.MEDSEEN;
if (!SEEN) { console.log(NL + 'NOT RUN — globalThis.MEDSEEN is absent. This is not a pass.'); process.exit(2); }
/* DERIVED FROM THE FIXTURE, NOT TYPED: one landed sleep per case that stages one, summed over the
 * arms each case actually runs on. */
const staged = (kindPred) => CASES.filter(kindPred)
  .reduce((n, c) => n + (c.arms ? c.arms.length : ARM_IDS.length), 0);
const REST_CASES = staged(c => c.kind === 'RED');
const SLEEP_CASES = staged(c => /rest|hypnosis/.test(c.name));
const WANT = { sleepDurationDrawn: SLEEP_CASES,
               sleepDurationFixedByMove: REST_CASES,
               sleepDurationDrawnLate: 0 };
console.log('');
for (const [k, want] of Object.entries(WANT)) {
  const got = SEEN[k] || 0;
  if (got !== want) { bad++; console.log('COUNTER  ' + k + '  want exactly ' + want + ', got ' + got); }
  else console.log('counter  ' + k.padEnd(26) + ' = ' + got + '  (exact)');
}

/* ================= THE OVER-FIRE PROOF, BY TRACE DELTA ========================================== */
console.log(NL + 'OVER-FIRE PROOF — the identical fixture with MEDI_SLEEP_WAKE_COIN=1, compared case by case');
const { spawnSync } = require('child_process');
const childEnv = Object.assign({}, process.env, { MEDI_SLEEP_WAKE_COIN: '1' });
if (!process.argv.includes('--release')) {
  childEnv.NODE_OPTIONS = ((process.env.NODE_OPTIONS || '') + ' -r ./tests/_live_release.js').trim();
}
const child = spawnSync(process.execPath, [__filename, '--emit'].concat(process.argv.slice(2).filter(x => x !== '--emit')),
  { encoding: 'utf8', cwd: D('.'), env: childEnv, maxBuffer: 64 * 1024 * 1024 });
const m = String(child.stdout || '').match(/@@JSON@@([\s\S]*?)@@END@@/);
if (!m) {
  console.log('  FAIL the restore-arm child produced no result block (exit ' + child.status + ')');
  console.log(String(child.stdout || '').split(NL).slice(-12).join(NL));
  console.log(String(child.stderr || '').split(NL).slice(-8).join(NL));
  process.exit(1);
}
const THEN = JSON.parse(m[1]);
const kOf = r => r.arm + ' :: ' + r.name;
const thenBy = new Map(THEN.map(r => [kOf(r), r]));
let moved = 0, fixed = 0, overfired = 0;
for (const now of HERE) {
  const was = thenBy.get(kOf(now));
  if (!was) { overfired++; console.log('  FAIL no restore-arm counterpart for ' + kOf(now)); continue; }
  const same = was.turns === now.turns && was.lines === now.lines && was.walked === now.walked
            && was.cant === now.cant && String(was.div) === String(now.div) && String(was.err) === String(now.err);
  if (same) continue;
  moved++;
  if (now.kind === 'CONTROL') {
    overfired++;
    console.log('  FAIL  OVER-FIRE on a control   ' + kOf(now));
    console.log('        was  turns=' + was.turns + ' lines=' + was.lines + ' cant=' + was.cant + ' div=' + was.div);
    console.log('        now  turns=' + now.turns + ' lines=' + now.lines + ' cant=' + now.cant + ' div=' + now.div);
  } else if (was.div && !now.div) {
    fixed++;
    console.log('  ok    PARTED -> AGREES         ' + kOf(now));
    console.log('        was  ' + was.div + '   (' + was.cant + ' |cant|slp -> ' + now.cant + ')');
  } else {
    overfired++;
    console.log('  FAIL  MOVED THE WRONG WAY      ' + kOf(now));
    console.log('        was  turns=' + was.turns + ' cant=' + was.cant + ' div=' + was.div);
    console.log('        now  turns=' + now.turns + ' cant=' + now.cant + ' div=' + now.div);
  }
}
console.log('  ' + HERE.length + ' games compared: ' + (HERE.length - moved) + ' byte-identical, '
  + fixed + ' parted-before/agree-now, ' + overfired + ' moved where they must not');
if (overfired) bad++;
if (!fixed) { bad++; console.log('  FAIL  the restore arm changed NOTHING anywhere — MEDI_SLEEP_WAKE_COIN did not take effect'); }

console.log(NL + (bad ? 'FAIL' : 'PASS — a Rest sleeps its fixed two turns, a natural sleep is unchanged at both corners, '
  + 'and no control moved'));
process.exit(bad ? 1 : 0);
