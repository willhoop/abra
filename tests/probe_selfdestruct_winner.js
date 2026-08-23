/* probe_selfdestruct_winner.js — DOES MOVING THE SELF-DESTRUCT FAINT ABOVE THE HIT EVER CHANGE WHO
 * WON THE GAME? 2026-08-22.
 *
 *   SHOWDOWN_PATH=... node tests/probe_selfdestruct_winner.js
 *   SHOWDOWN_PATH=... node tests/probe_selfdestruct_winner.js --release <id>
 *   SHOWDOWN_PATH=... node tests/probe_selfdestruct_winner.js --only w3-simultaneous
 *
 * ================= WHY THIS IS A SEPARATE FILE FROM test-resolution-order.js ====================
 *
 * That file runs the differential in PROTOCOL mode, where a game STOPS at the first line the two
 * streams disagree on. That is the right instrument for "is this event in the right place" and it is
 * the WRONG one for "who won", because a game that stopped on turn 2 has no winner to compare. This
 * one pushes `--end-state` onto argv before the driver loads, so both engines play the whole script
 * whatever happens to the narration, and the comparison is the FINAL ROSTER plus the authority's own
 * `battle.winner`.
 *
 * ================= THE QUESTION, AND THE ANSWER THE SOURCE ALREADY GIVES ========================
 *
 * Will's case: everything on the field dies and there is nobody in the back. If the authority faints
 * the user FIRST and this engine faints it LAST, can the two disagree about the WINNER rather than
 * about a line?
 *
 * MY FIRST ANSWER WAS "NO, STRUCTURALLY", AND IT WAS HALF WRONG. `faintMessages()` (sim/battle.ts)
 * drains the WHOLE queue in a `while (this.faintQueue.length)` loop and only then runs
 * `if (checkWin && this.checkWin(faintData))`, so every body queued in one action is counted before
 * the win test is asked. That much is right and it is why w1 and w2 agree. But `checkWin` does NOT
 * stop at the count:
 *
 *     checkWin(faintData?) {                                        sim/battle.ts:2603
 *       if (this.sides.every(side => !side.pokemonLeft)) {
 *         this.win(faintData && this.gen > 4 ? faintData.target.side : null);
 *         return true;
 *       }
 *       for (const side of this.sides) if (!side.foePokemonLeft()) { this.win(side); return true; }
 *     }
 *
 * and `faintData` is the LAST entry the loop shifted. So in Gen 5+ a SIMULTANEOUS double wipe is not
 * a draw at all — the side whose body fainted LAST wins, which is the cartridge rule that the
 * self-destructing player loses, written as a queue position. THE FAINT ORDER IS LOAD-BEARING FOR THE
 * RESULT. medicham2's `battleResult` has no such rule (equal live counts fall through to total HP
 * fraction, and 0 against 0 is a 0.5), so it answers `draw` where the authority answers a winner.
 *
 * THAT IS NOT THIS PASS'S DEFECT AND THE FILE PROVES IT RATHER THAN ASSERTING IT: the disagreement is
 * IDENTICAL clean and under the revert, so it is not the self-KO position — `w3-simultaneous` is a
 * declared KNOWN-OPEN row and is reported, not swept in. medicham2 asks `sideWiped(S)` at the TOP of
 * the next action and once below the action loop, never between the self-KO site and WIRE 46, so both
 * of this engine's faint positions are inside the same window and neither can move a `sideWiped`.
 *
 * Each board is played TWICE — once against the tree as it stands and once under the same surgical
 * revert `test-resolution-order.js` uses — so every claim here is a reading off a run rather than a
 * claim about a control-flow graph. The first draft of this file made the control-flow claim and it
 * was the run that corrected it.
 *
 * ================= WHAT WOULD COUNT AS A FAILURE ================================================
 *
 * A KNOWN-OPEN board is neither. It is declared, it runs every time, and it is printed with its own
 * verdict word so it cannot be read as green and cannot be read as a regression.
 *
 * Three things, and they are reported apart because they are different facts:
 *   WINNER      the authority's `battle.winner` against medicham2's live-body verdict. A difference
 *               here is not a narration difference and would be the most consequential result in the
 *               file.
 *   ROSTER      per side, bodies alive at the end. The authority is additionally asked `pokemonLeft`,
 *               which is the number `checkWin` actually reads.
 *   PROTOCOL    the first line the two streams part on, if any. Recorded, NOT the bar: in end-state
 *               mode a parted line does not stop the game, and this file's claim is about the board.
 *
 * ================= THE FIXTURES ARE FIXTURES ====================================================
 *
 * Every species, move and ability is legal in `gen9championsvgc2026regmb` and every move is on its
 * user's own learnset, both derived from `Dex.forFormat` below. Spreads and items are the harness's.
 * The Ghost walls are the load-bearing part of two of the three boards: Explosion is NORMAL, so a
 * Ghost takes nothing from it, which is what lets one side be emptied while the other is untouched.
 */
'use strict';
const path = require('path');
const Module = require('module');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');

/* END-STATE MODE IS PUSHED BEFORE THE DRIVER LOADS, because `END_STATE` is a module-level `const`
 * read off `process.argv` at require time. Pushing it afterwards would leave the run in protocol
 * mode and every game would stop at its first parted line — which is exactly the shape of a probe
 * that measures nothing while reporting a clean number. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

/* The tree under test is frozen HERE and the id pushed onto argv, so the bytes this file PATCHES are
 * the bytes the driver PLAYS. See test-resolution-order.js's header for the run this cost. */
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_selfdestruct_winner.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_REL = 'engine/medicham2-browser.js';
const MEDI_PATH = REL.path(MEDI_REL);
const CLEAN_SRC = REL.read(MEDI_REL);
const GD_PATH = D('engine', 'game_differential.js');

/* THE ONE BREAK, CHARACTER FOR CHARACTER THE ONE IN test-resolution-order.js. Kept as its own copy
 * rather than imported because that file is a runnable test with its own release cut and requiring it
 * would run it; the anchor is asserted to match EXACTLY ONCE, so a drift between the two copies is a
 * hard failure here and not a silently unapplied patch. */
const BREAK_FROM = `{
        const _ufA=TAGS.param('move',a.move.id,'userFaints');
        if(_ufA&&_ufA.faints==='always'&&!m.fainted){
          m.curHP=0;m.fainted=true;_selfKOPending=true;MEDSEEN.selfKOAlwaysAboveTheHit++;}
      }`;
const eol = t => String(t).replace(/\r\n/g, '\n');
function broken() {
  const src = eol(CLEAN_SRC), from = eol(BREAK_FROM);
  const n = src.split(from).length - 1;
  if (n !== 1) return { err: 'anchor matched ' + n + ' times (must be exactly 1)' };
  return { src: src.replace(from, ';') };
}

let _cur = null, _G = null;
function harness(src) {
  const key = src == null ? '' : 'patched:' + src.length;
  if (_G && _cur === key) return _G;
  const mres = require.resolve(MEDI_PATH);
  delete require.cache[mres];
  if (src != null) {
    const m = new Module(MEDI_PATH, null);
    m.filename = MEDI_PATH;
    m.paths = Module._nodeModulePaths(path.dirname(MEDI_PATH));
    m._compile(src, MEDI_PATH);
    m.loaded = true;
    require.cache[mres] = m;
  }
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const BOOM = { m: 'explosion' };

/* ---- THE THREE BOARDS ---------------------------------------------------------------------------
 * EVERY BODY THAT MUST DIE EITHER EXPLODES ITSELF OR IS A NON-GHOST STANDING BESIDE ONE. That is a
 * deliberate construction and it replaced a fragile one: relying on a 250 BP spread hit to KO a
 * particular ally makes the fixture depend on a damage roll, and a body that survived by four points
 * would empty no side and the arm would report a clean winner while staging nothing at all. An
 * `allAdjacent` boom beside a second exploder empties a slot whichever of the two moves first. */
const CASES = [
  { id: 'w1-user-side-empties-first',
    what: 'THE USER\'S OWN SIDE IS WIPED AND THE OPPONENT IS UNTOUCHED. All four of p1 click Explosion, '
        + 'so every p1 body either spends itself or is a non-Ghost standing in an ally\'s blast; all '
        + 'four of p2 are GHOSTS and a NORMAL boom cannot touch them. Two turns empties p1 completely '
        + 'with p2 on four healthy bodies, so the winner is p2 and it is decided by the very faint '
        + 'whose POSITION this pass moved.',
    A: [['metagross', '', 'Clear Body', ['Explosion', 'Protect']],
        ['vanilluxe', '', 'Ice Body', ['Explosion', 'Protect']],
        ['glalie', '', 'Inner Focus', ['Explosion', 'Protect']],
        ['garganacl', '', 'Purifying Salt', ['Explosion', 'Protect']]],
    B: [['spiritomb', '', 'Pressure', ['Nasty Plot', 'Protect']],
        ['banette', '', 'Insomnia', ['Nasty Plot', 'Protect']],
        ['froslass', '', 'Snow Cloak', ['Nasty Plot', 'Protect']],
        ['cofagrigus', '', 'Mummy', ['Nasty Plot', 'Protect']]],
    script: [T([BOOM, BOOM], [{ m: 'nastyplot' }, { m: 'nastyplot' }]),
             T([BOOM, BOOM], [{ m: 'nastyplot' }, { m: 'nastyplot' }])] },

  { id: 'w2-foe-side-empties-first',
    what: 'THE MIRROR, AND IT IS A SEPARATE ARM BECAUSE "the side that exploded lost" and "the side '
        + 'that exploded won" are different questions — a win check reading the wrong side would pass '
        + 'one of them. p1 keeps a GHOST in slot b, so its exploder dies and its partner does not; '
        + 'every p2 body clicks Explosion and empties p2 in two turns. p1 finishes with two bodies '
        + 'alive and p2 with none, so the winner is p1.',
    A: [['metagross', '', 'Clear Body', ['Explosion', 'Protect']],
        ['spiritomb', '', 'Pressure', ['Nasty Plot', 'Protect']],
        ['glalie', '', 'Inner Focus', ['Explosion', 'Protect']],
        ['banette', '', 'Insomnia', ['Nasty Plot', 'Protect']]],
    B: [['forretress', '', 'Overcoat', ['Explosion', 'Protect']],
        ['garbodor', '', 'Aftermath', ['Explosion', 'Protect']],
        ['steelix', '', 'Sheer Force', ['Explosion', 'Protect']],
        ['reuniclus', '', 'Overcoat', ['Explosion', 'Protect']]],
    script: [T([BOOM, { m: 'nastyplot' }], [BOOM, BOOM]),
             T([BOOM, { m: 'nastyplot' }], [BOOM, BOOM])] },

  { id: 'w3-simultaneous', kind: 'known-open',
    what: 'A DECLARED, MEASURED, UNFIXED ROW — and it is the arm that found something. BOTH SIDES '
        + 'EMPTY IN THE SAME ACTION: one boom on turn two takes the last four bodies off the board at '
        + 'once, its user, its partner and both foes. '
        + 'I EXPECTED A DRAW AND THE AUTHORITY DOES NOT GIVE ONE. `checkWin` (sim/battle.ts:2603) is '
        + '    if (this.sides.every(side => !side.pokemonLeft)) { '
        + 'this.win(faintData && this.gen > 4 ? faintData.target.side : null); return true; } '
        + '— and `faintData` is the LAST entry `faintMessages()` shifted off the queue. So in Gen 5+ a '
        + 'simultaneous double wipe is NOT a draw: THE SIDE WHOSE BODY FAINTED LAST WINS, which is the '
        + 'cartridge rule that the self-destructing player loses, expressed as a queue position. '
        + 'MEASURED HERE: showdown `winner="B"` with `pokemonLeft p1=0 p2=0`, medicham2 a draw. '
        + 'THE FAINT ORDER IS THEREFORE LOAD-BEARING FOR THE RESULT, NOT ONLY FOR THE NARRATION — '
        + 'which is exactly the concern this file was written to test, arriving from the other '
        + 'direction. THIS PASS DOES NOT CLOSE IT, and the reason is measured rather than asserted: '
        + 'the disagreement is IDENTICAL clean and under the break, so it is not the self-KO position. '
        + 'It is `battleResult`, which resolves an equal body count by total HP fraction and calls '
        + '0 against 0 a 0.5 — a rule that has no notion of who died last and cannot acquire one '
        + 'without a new field written at every faint site in the engine. That is a separate defect '
        + 'with a separate blast radius (`battleResult` is what every rollout and every H2H reads) and '
        + 'it is reported, not swept into this batch. '
        + 'EVERY BODY EXCEPT THE TWO EXPLODERS IS PICKED FOR BEING FRAIL, and that is not decoration: '
        + 'the first draft filled both benches with exploders and the SECOND side to empty simply '
        + 'never got its action, because the battle had already ended — it reported a clean winner '
        + 'while staging a sequential wipe under the name of a simultaneous one. A body that survives '
        + 'the final boom by four points turns this arm back into w2.',
    A: [['metagross', '', 'Clear Body', ['Explosion', 'Protect']],
        ['pikachu', '', 'Static', ['Nasty Plot', 'Protect']],
        ['glalie', '', 'Inner Focus', ['Explosion', 'Protect']],
        ['liepard', '', 'Limber', ['Nasty Plot', 'Protect']]],
    B: [['weavile', '', 'Pressure', ['Nasty Plot', 'Protect']],
        ['salazzle', '', 'Oblivious', ['Nasty Plot', 'Protect']],
        ['watchog', '', 'Keen Eye', ['Nasty Plot', 'Protect']],
        ['houndoom', '', 'Unnerve', ['Nasty Plot', 'Protect']]],
    script: [T([BOOM, { m: 'nastyplot' }], [{ m: 'nastyplot' }, { m: 'nastyplot' }]),
             T([{ m: 'nastyplot' }, BOOM], [{ m: 'nastyplot' }, { m: 'nastyplot' }])] },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp);
  const mid = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[mid]) return true;
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

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const ARM_ID = 'bottom-tie-first';
function play(G, c) {
  const arm = G.ARM_BY_ID.get(ARM_ID);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + ARM_ID); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe-selfdestruct-winner :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters() };
}

/* medicham2's winner, computed the way `battleResult` computes it — MORE LIVE BODIES WINS, and an
 * equal count falls through to total HP fraction, which for two emptied sides is 0 against 0 and is
 * therefore a draw. Written here rather than imported because `battleResult` is not exported and a
 * probe that reached into the module would be reading a different function from the one the callers
 * use; the rule is quoted from its source and the roster it reads is the driver's own snapshot. */
function mediVerdict(fr) {
  if (!fr || !fr.medicham) return { who: 'UNREADABLE', a: null, b: null };
  const liveA = fr.medicham.p1.filter(x => !x.fainted && x.hp > 0).length;
  const liveB = fr.medicham.p2.filter(x => !x.fainted && x.hp > 0).length;
  return { who: liveA > liveB ? 'p1' : (liveB > liveA ? 'p2' : 'draw-on-bodies'), a: liveA, b: liveB };
}
/* `battle.winner` IS A PLAYER NAME, NOT A SIDE ID, AND THE FIRST DRAFT OF THIS FILE READ IT AS ONE.
 * The driver names its two players `A` and `B` (see game_differential.js's battle options), so the
 * authority answers 'A', 'B', the empty string for a draw, or undefined while unresolved — and
 * comparing that against medicham2's 'p1'/'p2' scored TWO of three boards as WINNER DIFFERS on a
 * run where both engines had emptied the SAME side. Three probe errors preceded the real defect on
 * the pass that produced this file; this was the fourth. The mapping is asserted rather than assumed:
 * a name that is neither A nor B nor the draw is reported as UNMAPPED and fails, because a silent
 * fallback here would restore exactly the bug it replaced. */
const SD_SIDE = { A: 'p1', B: 'p2' };
const names = (fr, side) => (fr && fr.medicham && fr.medicham[side] || [])
  .filter(x => !x.fainted && x.hp > 0).map(x => x.name).join(' ');
function sdVerdict(fr) {
  if (!fr || !fr.showdown) return { who: 'UNREADABLE', a: null, b: null, winner: null };
  const w = fr.showdown.winner;
  const who = w == null ? 'unresolved'
            : w === '' ? 'draw'
            : (SD_SIDE[w] || ('UNMAPPED:' + w));
  return { winner: w, a: fr.showdown.p1.pokemonLeft, b: fr.showdown.p2.pokemonLeft, who };
}
/* THE TWO ENGINES ARE ASKED THE SAME QUESTION IN THEIR OWN VOCABULARY, and this is the translation.
 * The authority answers with a player NAME (mapped by `SD_SIDE` above), the empty string for a draw
 * and `undefined` while unresolved; medicham2 has no winner field at all and is read off live bodies
 * with `battleResult`'s own rule. A mismatch
 * is only reported where BOTH have resolved — a game the authority never ended is a fixture problem
 * and is printed as one rather than folded into the verdict. */
function agree(sd, me) {
  if (sd.who === 'unresolved' || sd.who === 'UNREADABLE' || me.who === 'UNREADABLE') return null;
  if (String(sd.who).startsWith('UNMAPPED')) return false;
  const meName = me.who === 'draw-on-bodies' ? 'draw' : me.who;
  return sd.who === meName;
}

let bad = 0, ran = 0, knownOpen = 0;
const rows = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(null), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const p = broken();
  if (p.err) { console.log('PLANT FAILED  ' + c.id + '   ' + p.err); bad++; continue; }
  const brk = play(harness(p.src), c);
  harness(null);
  ran++;
  rows.push({ c, clean, brk });
}

for (const { c, clean, brk } of rows) {
  const sdC = sdVerdict(clean.r.finalRoster), meC = mediVerdict(clean.r.finalRoster);
  const sdB = sdVerdict(brk.r.finalRoster), meB = mediVerdict(brk.r.finalRoster);
  const okC = agree(sdC, meC), okB = agree(sdB, meB);
  /* A KNOWN-OPEN ROW IS NEITHER A PASS NOR A FAILURE, and it gets its own verdict word for exactly
   * the reason `a1-multihit-frequency` has one in test-resolution-order.js: a declared, measured,
   * deliberately unfixed defect must not be readable as green and must not be readable as a
   * regression. It still runs on every invocation, so the day it starts agreeing is visible. */
  const open = c.kind === 'known-open';
  const verdict = open ? (okC === true ? 'KNOWN-OPEN? ' : 'KNOWN-OPEN  ')
                : okC === null ? 'UNRESOLVED  ' : okC ? 'WINNER AGREES' : 'WINNER DIFFERS';
  if (!open && okC !== true) bad++;
  if (open) knownOpen++;
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  const line = (tag, sd, me, r) => {
    console.log('    ' + tag.padEnd(7)
      + 'showdown winner=' + JSON.stringify(sd.winner) + ' pokemonLeft p1=' + sd.a + ' p2=' + sd.b
      + '   |   medicham live p1=' + me.a + ' p2=' + me.b + ' -> ' + me.who);
    console.log('           first parted line: '
      + (r.div ? ('#' + r.div.index + '  sd `' + r.div.sdRaw + '`  me `' + r.div.meRaw + '`') : 'none'));
    console.log('           alive at the end: p1 [' + names(r.finalRoster, 'p1') + ']  p2 [' + names(r.finalRoster, 'p2') + ']');
    console.log('           selfKOAlwaysAboveTheHit=' + (r === clean.r ? clean.delta : brk.delta).selfKOAlwaysAboveTheHit
      + '  selfKOLineFromShieldExit=' + (r === clean.r ? clean.delta : brk.delta).selfKOLineFromShieldExit);
  };
  line('CLEAN', sdC, meC, clean.r);
  line('BROKEN', sdB, meB, brk.r);
  console.log('    CLEAN vs BROKEN, the attribution: the winner comparison is '
    + (okB === okC ? 'THE SAME under the revert, so the self-KO POSITION is not what decides it'
                   : 'DIFFERENT under the revert, so the self-KO POSITION is what decides it')
    + '.');
  const refused = clean.sc.moveNotOnRequest;
  if (refused) { console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
    bad++; }
}

console.log(NL + ran + ' boards staged, ' + knownOpen + ' of them KNOWN-OPEN (declared, not counted), '
  + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — on every staged wipe this file counts, the two engines name the same '
  + 'winner, clean and under the revert. The one board they do NOT agree on is declared: a Gen-5+ '
  + 'simultaneous double wipe is decided by WHO FAINTED LAST and medicham2 calls it a draw, which is '
  + 'the same disagreement with the fix and without it and is therefore a battleResult defect rather '
  + 'than a resolution-order one');
process.exit(bad ? 1 : 0);
