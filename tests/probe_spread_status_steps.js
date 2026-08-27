/* probe_spread_status_steps.js — A SPREAD *STATUS* MOVE RAN THE WHOLE GAUNTLET PER TARGET, WHERE THE
 * AUTHORITY RUNS EACH STEP ACROSS EVERY TARGET. 2026-08-27. ROADMAP #448.
 *
 *   SHOWDOWN_PATH=... node tests/probe_spread_status_steps.js
 *   SHOWDOWN_PATH=... node tests/probe_spread_status_steps.js --release <id>
 *   SHOWDOWN_PATH=... node tests/probe_spread_status_steps.js --only cottonspore-red
 *
 * ================= THE DEFECT, AND WHY IT IS *HALF* OF A CONVERSION THAT ALREADY HAPPENED =========
 *
 * `Battle.actions.trySpreadMoveHit` (sim/battle-actions.ts:550-577) declares `moveSteps` as DATA and
 * then runs each STEP across the whole target array before the next step begins. That is why a
 * Protect on the SECOND foe is announced BEFORE anything lands on the first: `hitStepTryHitEvent` is
 * step 1 and the effects live in step 7.
 *
 * medicham2's DAMAGING branch already does this — ROADMAP #81 WIRE 10, `for (const _step of _STEPS)
 * for (const R of _rows)`, step outside and target inside. The `a.kind === 'affect'` branch — every
 * spread STATUS move in the format — was never converted and still walked
 * `for (const _t of _tl) { …whole gauntlet… }`.
 *
 * MEASURED BEFORE THE FIX, off `data/all-mechanics-fire.json` at release 7f7de860723b, five rows and
 * one sentence between them:
 *
 *     cottonspore   -unboost before -activate    |-activate|p2b: Charizard|move: Protect
 *     stringshot    -unboost before -activate     <>  |-unboost|p2a: Feraligatr|spe|2
 *     sweetscent    -unboost before -activate
 *     teeterdance   -start   before -activate
 *     corrosivegas  -enditem before -activate
 *
 * CORROSIVE GAS IS NAMED AND IS *NOT* CLOSED BY THIS FILE. `playerAction` classifies it `trickitem`,
 * so it never arrives in the `affect` branch at all — the engine's own comment above the branch says
 * so. It is the same sentence at a different site and it is a separate change; saying that here is
 * cheaper than having it rediscovered as "a spread move this probe appears to cover and does not".
 *
 * ================= NOTHING HERE IS TYPED =========================================================
 *
 * No arm declares an expected line. Both engines play the identical script under the differential's
 * own pin and the two protocol streams are compared line for line; the pass is that they do not part.
 * SHOWDOWN IS THE EXPECTATION.
 *
 * ================= THE KNOB IS THE RED, AND IT MUST BE SHOWN TO REACH THE DRIVER'S MODULE =========
 *
 * `MEDI_SPREAD_STATUS_PER_TARGET=1` puts the per-target loop back — one flag, read at module load,
 * reverting exactly the nesting and nothing else. Each arm is played TWICE:
 *
 *   a RED arm      must AGREE clean and must PART under the knob.
 *   an OVER-FIRE   must AGREE clean and must ALSO AGREE under the knob.
 *   CONTROL arm
 *
 * A knob read by a module the driver never loaded changes nothing and produces a green run that
 * staged nothing — that has happened in this repo. So the knob is not trusted: every arm asserts
 * `spreadStatusPerTargetRestored` at EXACT ZERO clean and at EXACT `spreadStatusStepOuter` under the
 * knob, read as a per-game DELTA off `globalThis.MEDSEEN`, which is the object the bytes the driver
 * actually ran increment. If the counter does not move, the arm fails whatever the streams say.
 *
 * ================= WHAT THE INSTRUMENT CAN SEE ===================================================
 *
 * `game_differential.js`'s reducer erases `[silent]`/`[still]`/`[miss]`/`[spread]`/`[anim]`, the
 * target field of a `|move|` line, `-ability` announcements and `[from]`/`[of]` tags. It keeps
 * `-unboost` with body, stat and amount, `-start` with the volatile, and `-activate` with its effect.
 * Two adjacent kept lines in the opposite order therefore part, which is exactly the shape of all
 * five rows above.
 *
 * ================= THE FIXTURES ARE FIXTURES =====================================================
 *
 * Every species, move and ability named here is legal in `gen9championsvgc2026regmb` and every move
 * is on its user's own learnset — derived from `Dex.forFormat` below and asserted before any arm
 * runs, not recalled. Spreads and items are the harness's, so nothing here is a set.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

/* ---- THE SNAPSHOT THE KNOB IS APPLIED TO MUST BE THE TREE THIS FILE IS TESTING ------------------
 * `open(null)` takes the NEWEST release in the store, which under `_live_release.js` is whatever some
 * previous instrument happened to freeze. Freeze HERE and push the id onto argv so the driver opens
 * the SAME one instead of cutting a second and racing its own newest. */
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_spread_status_steps.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_SPREAD_STATUS_PER_TARGET';

/* ---- THE HARNESS, RELOADABLE UNDER A CHANGED ENVIRONMENT -----------------------------------------
 * The knob is a module-load-time read (`process.env… === '1'` at the engine's top level), so flipping
 * it means dropping the engine AND the driver out of the require cache and letting the driver rebind.
 * `game_differential.js` binds its engine ONCE with `REL.require(...)`, so the engine has to leave the
 * cache under the SNAPSHOT'S OWN FILENAME before the driver is re-required — the same reason
 * tests/test-resolution-order.js compiles its patched bytes under that path and no other. */
let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- SCENARIO SUGAR ---------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const SD = { m: 'swordsdance' };
const AG = { m: 'agility' };

/* The wall. Nothing on it is aimed at anything; it exists so both sides have four legal bodies. */
const WALL_A = [['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]];
const WALL_B = [['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']]];
/* FERALIGATR CLICKS SWORDS DANCE AND CHARIZARD CLICKS PROTECT, and the choice of Swords Dance is not
 * decoration: it is the one self-boost both bodies learn that touches NEITHER Speed nor evasion nor
 * confusion, so it cannot interact with any of the three spread payloads staged below. */
const FOES = it => [['feraligatr', '', 'Torrent', ['Swords Dance', 'Protect']],
                    ['charizard', '', 'Blaze', ['Swords Dance', 'Protect']]].concat(it || WALL_B);

const CASES = [

  { id: 'cottonspore-red', kind: 'red',
    what: 'AMPHAROS CLICKS COTTON SPORE INTO A FOE PAIR WHOSE SECOND BODY IS BEHIND PROTECT. '
        + '`allAdjacentFoes`, 100% accuracy, `spe: -2` on each. The authority runs `hitStepTryHitEvent` '
        + 'across BOTH foes first, so `|-activate|p2b: Charizard|move: Protect` precedes '
        + '`|-unboost|p2a: Feraligatr|spe|2`. Per-target, the drop lands first and the two streams part '
        + 'on two adjacent kept lines. This is the `cottonspore` row of data/all-mechanics-fire.json '
        + 'rebuilt, not a case somebody imagined.',
    A: [['ampharos', '', 'Static', ['Cotton Spore', 'Protect']],
        ['corviknight', '', 'Pressure', ['Agility', 'Protect']]].concat(WALL_A),
    B: FOES(),
    script: [T([{ m: 'cottonspore' }, PROT], [SD, PROT])] },

  { id: 'stringshot-red', kind: 'red',
    what: 'THE SAME SENTENCE WITH AN ACCURACY STEP UNDER IT. String Shot is 95%, so `hitStepAccuracy` '
        + 'is a real step here rather than a skipped one, and the two engines must agree about WHERE '
        + 'the per-target die is thrown as well as about the refusal. Played on the `bottom-tie-first` '
        + 'corner, where every sub-100 move HITS — a corner that missed would stage nothing and read '
        + 'green. 46 clicks in 64,846 stored games, the largest of the five.',
    A: [['ariados', '', 'Insomnia', ['String Shot', 'Protect']],
        ['corviknight', '', 'Pressure', ['Agility', 'Protect']]].concat(WALL_A),
    B: FOES(),
    script: [T([{ m: 'stringshot' }, PROT], [SD, PROT])] },

  { id: 'teeterdance-red', kind: 'red',
    what: 'THE `spreadAll` HALF, WHICH IS A DIFFERENT TARGET SET AND NOT JUST A DIFFERENT PAYLOAD. '
        + 'Teeter Dance is `allAdjacent`, so `Pokemon#getMoveTargets` pushes MY OWN PARTNER FIRST and '
        + 'the foes after it — three bodies through one step list. Corviknight clicks Agility rather '
        + 'than Protect precisely so the ally is a LIVE target; a shielded ally would collapse this arm '
        + 'onto the previous one. The payload is a volatile, so the parted pair is `-start|confusion` '
        + 'against `-activate|Protect`.',
    A: [['lopunny', '', 'Cute Charm', ['Teeter Dance', 'Protect']],
        ['corviknight', '', 'Pressure', ['Agility', 'Protect']]].concat(WALL_A),
    B: FOES(),
    script: [T([{ m: 'teeterdance' }, AG], [SD, PROT])] },

  { id: 'cottonspore-nobody-shields', kind: 'control',
    what: 'THE KNOB CLEARED EXPLICITLY — the IDENTICAL board and the identical Cotton Spore, differing '
        + 'in ONE CLICK: Charizard uses Swords Dance instead of Protect. Nothing is refused, so no '
        + 'refusal can be interleaved and the two nestings are the same permutation. It must agree '
        + 'clean AND under the knob. Without this arm, "the refusal moved" and "spread status is '
        + 'broken in some other way" are the same reading.',
    A: [['ampharos', '', 'Static', ['Cotton Spore', 'Protect']],
        ['corviknight', '', 'Pressure', ['Agility', 'Protect']]].concat(WALL_A),
    B: FOES(),
    script: [T([{ m: 'cottonspore' }, PROT], [SD, SD])] },

  { id: 'single-target-into-the-shield', kind: 'control',
    what: 'ONE TARGET, AND THAT TARGET IS THE PROTECTING ONE. Eerie Impulse is `normal`, `spa: -2`, '
        + '100% — the same `affect` branch, the same Protect gate, a target list of length one. At one '
        + 'target the two nestings are the same permutation by arithmetic, so this must agree under '
        + 'both. It is the arm that says the change is a TRANSPOSITION and not a rewrite of the '
        + 'gauntlet, which is the claim every single-target status move in the format depends on.',
    A: [['ampharos', '', 'Static', ['Eerie Impulse', 'Protect']],
        ['corviknight', '', 'Pressure', ['Agility', 'Protect']]].concat(WALL_A),
    B: FOES(),
    script: [T([{ m: 'eerieimpulse', t: 1 }, PROT], [SD, PROT])] },

  { id: 'single-target-unshielded', kind: 'control',
    what: 'THE OTHER HALF OF THE SINGLE-TARGET PAIR: the same Eerie Impulse aimed at the body that is '
        + 'NOT behind Protect, so the effect LANDS and a `-unboost` is really written. Taken with the '
        + 'arm above it separates "one target refuses identically" from "one target resolves '
        + 'identically", and only the second says the effects step still runs where it did.',
    A: [['ampharos', '', 'Static', ['Eerie Impulse', 'Protect']],
        ['corviknight', '', 'Pressure', ['Agility', 'Protect']]].concat(WALL_A),
    B: FOES(),
    script: [T([{ m: 'eerieimpulse', t: 0 }, PROT], [SD, PROT])] },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory and nothing is trusted from a list. --- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp);
  const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const c of CASES) {
  for (const row of c.A.concat(c.B)) {
    const sp = dex.species.get(row[0]);
    if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
    if (row[1] && !legal(dex.items.get(row[1]))) {
      console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++;
    }
    if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
      .includes(dex.abilities.get(row[2]).id)) {
      console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
    }
    for (const mv of row[3]) {
      const m = dex.moves.get(mv);
      if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
      if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
    }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------
 * The counters MUST be read off the engine instance the driver played. `game_differential.js` binds
 * with `REL.require(...)`, which compiles the snapshot's copy under the snapshot's own path — a module
 * with its own MEDSEEN. The engine writes `root.MEDSEEN = MEDSEEN` on load and `root` is
 * `globalThis`, so that is the object the bytes that ran increment. Read as a DELTA around each game:
 * a whole-run total is a weaker claim than "this arm produced exactly this many". */
const ARM_ID = 'bottom-tie-first';
function play(G, c) {
  const arm = G.ARM_BY_ID.get(ARM_ID);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + ARM_ID); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_spread_status_steps :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters() };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  ran++;

  /* SHORT IS NOT A PASS: in protocol mode a game stops AT the divergence, so a game that played fewer
   * turns than its script WITHOUT a divergence stopped testing and would otherwise read green. */
  const short = clean.r.turns < c.script.length && !clean.r.div;
  /* A CLICK THE AUTHORITY'S REQUEST DID NOT OFFER becomes a silent `pass` on BOTH engines, so the arm
   * agrees while testing nothing. Asserted at EXACT ZERO. */
  const refused = clean.sc.moveNotOnRequest;

  const brk = play(harness(true), c);
  harness(false);

  /* THE KNOB HAS TO BE SHOWN TO HAVE REACHED THE MODULE THE DRIVER PLAYED. `stepOuter` counts the
   * `affect` moves this arm resolved; `perTargetRestored` counts the ones that took the reverted
   * nesting. Clean must be all-step-outer and none-reverted; under the knob it must be the exact
   * mirror. Anything else is a knob that changed nothing, which is a green arm staging nothing. */
  const nClean = clean.delta.spreadStatusStepOuter, nBrkStep = brk.delta && brk.delta.spreadStatusStepOuter;
  const nBrk = brk.delta && brk.delta.spreadStatusPerTargetRestored;
  const knobOk = nClean > 0 && clean.delta.spreadStatusPerTargetRestored === 0
              && nBrk === nClean && nBrkStep === 0;

  results.push({ c, clean, brk, short, refused, nClean, nBrk, nBrkStep, knobOk });

  if (short || refused) { bad++; continue; }
  if (!knobOk) bad++;
  if (clean.r.div) bad++;                             // every arm must agree clean
  if (c.kind === 'red' && !brk.r.div) bad++;          // a red arm must PART under the knob
  if (c.kind === 'control' && brk.r.div) bad++;       // a control must NOT
}

/* ---- THE REPORT --------------------------------------------------------------------------------- */
for (const { c, clean, brk, short, refused, nClean, nBrk, nBrkStep, knobOk } of results) {
  const verdict = clean.r.div ? 'PARTS CLEAN ' : short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
    : c.kind === 'red' ? (brk.r.div ? 'RED PROVEN  ' : 'KNOB SILENT ')
                       : (brk.r.div ? 'OVER-FIRES  ' : 'CONTROL HELD');
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  if (clean.r.div) {
    console.log('    CLEAN PARTED at reduced line ' + clean.r.div.index);
    console.log('      showdown  ' + clean.r.div.sdRaw);
    console.log('      medicham  ' + clean.r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(clean.r.div.sdAfterRaw.slice(0, 4)));
    console.log('      medicham next  ' + JSON.stringify(clean.r.div.meAfterRaw.slice(0, 4)));
  }
  if (brk.r && brk.r.div) {
    console.log('    UNDER THE KNOB the streams part at reduced line ' + brk.r.div.index);
    console.log('      showdown  ' + brk.r.div.sdRaw);
    console.log('      medicham  ' + brk.r.div.meRaw);
  } else if (brk.r) {
    console.log('    UNDER THE KNOB the streams still agree over all ' + brk.r.turns + ' turns');
  }
  console.log('    knob      stepOuter clean=' + nClean + ' knob=' + nBrkStep
    + ' | perTargetRestored clean=' + clean.delta.spreadStatusPerTargetRestored + ' knob=' + nBrk
    + (knobOk ? '   (the knob reached the driver\'s module)' : '   <-- FAIL, the knob changed nothing'));
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — every spread status move runs each step across every target the way '
  + 'the authority does, each is shown red under the per-target knob, and both single-target controls '
  + 'and the unshielded control hold under that same knob');
process.exit(bad ? 1 : 0);
