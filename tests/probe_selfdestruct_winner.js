/* probe_selfdestruct_winner.js — DOES MOVING THE SELF-DESTRUCT FAINT ABOVE THE HIT EVER CHANGE WHO
 * WON THE GAME? 2026-08-22. And, since 2026-08-23, the instrument for WIRE 160: WHO WINS WHEN BOTH
 * SIDES EMPTY AT ONCE.
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
 * ON 2026-08-22 THAT WAS NOT THAT PASS'S DEFECT, and the file proved it rather than asserting it: the
 * disagreement was IDENTICAL clean and under the self-KO revert, so it was not the self-KO position.
 * `w3-simultaneous` was declared KNOWN-OPEN and reported.
 *
 * ================= CLOSED 2026-08-23 — WIRE 160, AND WILL'S CASE IS THE BETTER FIXTURE ==========
 *
 * `battleResult` now stamps a monotone faint SEQUENCE at all 26 of this engine's faint sites and
 * awards two emptied sides to the one owning the LAST of them. `w3-simultaneous` KEEPS ITS ID and is
 * an ordinary arm; two Perish Song boards join it.
 *
 * WILL: *"similar to perish song where all mons on the field faint on the same turn with nothing in
 * the back, the slowest mon wins."* DERIVED, not taken: Perish Song's condition is
 * `duration: 4, onResidualOrder: 24, onEnd(t){ t.faint() }`; `fieldEvent('Residual')` speed-sorts its
 * handlers (`comparePriority`, sim/battle.ts:404 — order ASC, priority DESC, SPEED DESC) before
 * decrementing durations, so the FASTEST body's counter expires first and the SLOWEST body's last,
 * they enter `faintQueue` in that order, and `checkWin` hands the game to the last of them. THE CLAIM
 * HOLDS, in the authority and now in this engine: `w4` reads `gengar#5 politoed#6 primarina#7
 * azumarill#8` — exact speed order — and the winner is Azumarill's side.
 *
 * AND THE 2026-08-22 ATTRIBUTION IS NOW READABLE FROM THE OTHER SIDE. With the win rule wired, `w3`
 * reports the winner comparison as DIFFERENT under the self-KO revert. That is not a contradiction of
 * last pass's measurement — it is what last pass could not see: while the engine answered `draw` both
 * ways, the self-KO position could not show up in a winner comparison at all. The `always` fix has a
 * WINNER-level consequence, and only a working win rule can demonstrate it.
 *
 * Each board is played THREE TIMES — clean, under the self-KO revert `test-resolution-order.js` uses,
 * and under WIRE 160's own revert — so every claim here is a reading off a run rather than a claim
 * about a control-flow graph. The first draft of this file made the control-flow claim and it was the
 * run that corrected it.
 *
 * ================= WHAT WOULD COUNT AS A FAILURE ================================================
 *
 * A KNOWN-OPEN board is neither. It is declared, it runs every time, and it is printed with its own
 * verdict word so it cannot be read as green and cannot be read as a regression. There are none left
 * in this file; the machinery stays because the next one will want it.
 *
 * A TIED BOARD MUST GO RED UNDER WIRE 160's REVERT AND AN UNTIED ONE MUST NOT. `tied` is declared per
 * board and CHECKED against the authority's own `pokemonLeft`, so a fixture that quietly stopped
 * emptying both sides fails loudly instead of passing while measuring nothing — which is the failure
 * `w3`'s own text records from its first draft.
 *
 * Three things, and they are reported apart because they are different facts:
 *   WINNER      the authority's `battle.winner` against `M.battleResult(S)` — THE ENGINE'S OWN
 *               FUNCTION, not a rule this file reimplements. A difference here is not a narration
 *               difference and would be the most consequential result in the file.
 *   FAINT ORDER the sequence medicham2 stamped, printed per side. The verdict alone cannot separate
 *               "the rule read the right body" from "the rule guessed the right side", and on a
 *               two-sided question a guess is right half the time.
 *   ROSTER      per side, bodies alive at the end. The authority is additionally asked `pokemonLeft`,
 *               which is the number `checkWin` actually reads.
 *   PROTOCOL    the first line the two streams part on, if any. Recorded, NOT the bar: in end-state
 *               mode a parted line does not stop the game, and this file's claim is about the board.
 *
 * ================= THE FIXTURES ARE FIXTURES ====================================================
 *
 * Every species, move and ability is legal in `gen9championsvgc2026regmb` and every move is on its
 * user's own learnset, both derived from `Dex.forFormat` below. Spreads and items are the harness's.
 * The Ghost walls are the load-bearing part of the two untied boards: Explosion is NORMAL, so a Ghost
 * takes nothing from it, which is what lets one side be emptied while the other is untouched. On the
 * two Perish Song boards the opening Explosion is SCAFFOLDING and nothing else — the driver sends
 * `team 1234`, and the rule needs nothing in the back, so one boom empties both benches onto the
 * field and the quartet that then sings is the whole of both teams.
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
          m.curHP=0;m.fainted=true,noteFaint(m);_selfKOPending=true;MEDSEEN.selfKOAlwaysAboveTheHit++;}
      }`;
/* THE SECOND REVERT, AND IT IS THE ONE THIS FILE NOW TURNS ON ITS OWN RESULT (WIRE 160, 2026-08-23).
 * `battleResult`'s last-fainted tie-break, deleted — which restores the engine EXACTLY as it stood
 * when `w3-simultaneous` was declared KNOWN-OPEN: two emptied sides fall through to the HP fraction,
 * 0 against 0, and the answer is 0.5. It is kept apart from `BREAK_FROM` because the two ask opposite
 * questions of the same board. Reverting the self-KO POSITION must NOT move the winner (that is the
 * measurement that made this a `battleResult` defect rather than a resolution-order one, and it stays
 * in the file as the over-fire control); reverting the WIN RULE must move it on every tied board and
 * on none of the untied ones. A fix that scored every board the same way passes neither test. */
const BREAK_WINRULE_FROM = `if(aA===0&&bA===0){
    const la=lastFaintSeq([...S.actA,...S.benchA]),lb=lastFaintSeq([...S.actB,...S.benchB]);
    if(la!==lb){MEDSEEN.doubleWipeDecidedByLastFaint++;return la>lb?1:0;}
    MEDFAILS.doubleWipeNoFaintOrder++;return 0.5;
  }`;
const eol = t => String(t).replace(/\r\n/g, '\n');
function plant(from) {
  const src = eol(CLEAN_SRC), f = eol(from);
  const n = src.split(f).length - 1;
  if (n !== 1) return { err: 'anchor matched ' + n + ' times (must be exactly 1)' };
  return { src: src.replace(f, ';') };
}
const broken = () => plant(BREAK_FROM);
const brokenWinRule = () => plant(BREAK_WINRULE_FROM);

let _cur = null, _G = null;
/* THE CACHE KEY IS THE PATCH'S NAME, NOT ITS LENGTH. Two surgical reverts now exist and both delete a
 * block down to a single `;`; keying on `src.length` would let two DIFFERENT patched engines collide
 * on one cache entry and the second arm would silently play the first arm's bytes. */
function harness(src, tag) {
  const key = src == null ? '' : 'patched:' + (tag || ('len' + src.length));
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
  { id: 'w1-user-side-empties-first', tied: false,
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

  { id: 'w2-foe-side-empties-first', tied: false,
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

  { id: 'w3-simultaneous', tied: true,
    what: 'CLOSED 2026-08-23 BY WIRE 160, AND THE ID IS KEPT SO THE HISTORY IS READABLE — this row '
        + 'was declared KNOWN-OPEN on 2026-08-22 and is now an ordinary arm that must AGREE. What '
        + 'changed is the engine: `battleResult` stamps a monotone faint SEQUENCE at all 26 faint '
        + 'sites and awards two emptied sides to the one that owns the LAST of them. Its own revert '
        + '(the NOWIN arm below) puts the 0.5 back, so this arm is red on demand rather than on trust. '
        + 'The original text follows, unedited, because it is the derivation. --- BOTH SIDES '
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

  /* ---- WILL'S OWN CASE, AND IT IS THE BETTER FIXTURE (2026-08-23) -------------------------------
   * *"similar to perish song where all mons on the field faint on the same turn with nothing in the
   * back, the slowest mon wins."*
   *
   * DERIVED BEFORE IT WAS STAGED, because a premise taken on trust is the thing this file exists to
   * refuse. Perish Song's condition, off `Dex.forFormat('gen9championsvgc2026regmb')`, is
   * `duration: 4, onResidualOrder: 24, onEnd(t){ add('-start',t,'perish0'); t.faint(); }`.
   * `fieldEvent('Residual')` collects the four handlers and `speedSort`s them with `comparePriority`
   * (sim/battle.ts:404 — order ASC, priority DESC, **SPEED DESC**), then decrements each duration and
   * calls `end` on the one that reaches zero. So the FASTEST body's counter expires first and the
   * SLOWEST body's last; all four land in `faintQueue` in that order; `faintMessages` shifts them in
   * that order; and `checkWin` hands the game to `faintData.target.side` — the SLOWEST. Staged in the
   * raw official simulator, Gengar 130 / Politoed 90 / Primarina 80 / Azumarill 70 faint in exactly
   * that sequence and the winner is Azumarill's side. **THE CLAIM HOLDS.**
   *
   * WHY IT IS BETTER THAN EXPLOSION'S: nothing here depends on a damage roll deciding which bodies
   * die. Perish Song reads no HP and takes no accuracy check, so the wipe is not a fixture that might
   * come apart — the only thing selecting the winner is the speed order, which is the mechanic.
   *
   * WHY THE BOARD STILL OPENS WITH A BOOM: the driver sends `team 1234` and four bodies a side, and
   * the rule needs NOTHING IN THE BACK. One Explosion on turn one empties both benches onto the
   * field; the quartet that then sings is the whole of both teams. That first turn is scaffolding and
   * is deliberately identical to `w3`'s, which is already proven to wipe all four actives.
   *
   * AND IT IS A PAIR, NOT A BOARD. `w5` is the same eight bodies with the two SIDES exchanged, so the
   * authority's answer flips. An engine that had learned to answer "p1" — or that read the FIRST
   * faint instead of the last — passes exactly one of them. */
  { id: 'w4-perish-slowest-on-p1', tied: true,
    what: "WILL'S CASE. Turn 1 is scaffolding: a Metagross Explosion empties both sides' active slots, "
        + 'so the four bodies that walk in are the last four in the game. Turn 2 Gengar sings; the '
        + 'counters expire together at the end of turn 5. Speed order is Gengar 110 > Politoed 70 > '
        + 'Primarina 60 > Azumarill 50, so AZUMARILL faints LAST and the winner is p1 — decided by a '
        + 'body that is on the field only because it is the slowest thing there.',
    A: [['metagross', '', 'Clear Body', ['Explosion', 'Protect']],
        ['pikachu', '', 'Static', ['Nasty Plot', 'Protect']],
        ['gengar', '', 'Cursed Body', ['Perish Song', 'Protect']],
        ['azumarill', '', 'Thick Fat', ['Perish Song', 'Protect']]],
    B: [['weavile', '', 'Pressure', ['Nasty Plot', 'Protect']],
        ['salazzle', '', 'Oblivious', ['Nasty Plot', 'Protect']],
        ['politoed', '', 'Water Absorb', ['Perish Song', 'Protect']],
        ['primarina', '', 'Torrent', ['Perish Song', 'Protect']]],
    script: [T([BOOM, { m: 'nastyplot' }], [{ m: 'nastyplot' }, { m: 'nastyplot' }]),
             T([{ m: 'perishsong' }, PROT], [PROT, PROT]),
             T([PROT, PROT], [PROT, PROT]),
             T([PROT, PROT], [PROT, PROT]),
             T([PROT, PROT], [PROT, PROT])] },

  { id: 'w5-perish-slowest-on-p2', tied: true,
    what: 'THE MIRROR OF w4 — THE SAME EIGHT BODIES, THE SIDES EXCHANGED. Azumarill is now on p2, so '
        + 'the authority answers p2 where w4 answered p1. This is the varied knob: identical results '
        + 'across the pair would mean the tie-break is not reading the faint order at all, and an '
        + 'engine that awarded a double wipe to a fixed side would pass w4 and fail here.',
    A: [['weavile', '', 'Pressure', ['Nasty Plot', 'Protect']],
        ['salazzle', '', 'Oblivious', ['Nasty Plot', 'Protect']],
        ['politoed', '', 'Water Absorb', ['Perish Song', 'Protect']],
        ['primarina', '', 'Torrent', ['Perish Song', 'Protect']]],
    B: [['metagross', '', 'Clear Body', ['Explosion', 'Protect']],
        ['pikachu', '', 'Static', ['Nasty Plot', 'Protect']],
        ['gengar', '', 'Cursed Body', ['Perish Song', 'Protect']],
        ['azumarill', '', 'Thick Fat', ['Perish Song', 'Protect']]],
    script: [T([{ m: 'nastyplot' }, { m: 'nastyplot' }], [BOOM, { m: 'nastyplot' }]),
             T([PROT, PROT], [{ m: 'perishsong' }, PROT]),
             T([PROT, PROT], [PROT, PROT]),
             T([PROT, PROT], [PROT, PROT]),
             T([PROT, PROT], [PROT, PROT])] },
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
  /* BOTH COUNTER BANKS. The first version of this read `MEDSEEN` alone, and the loud-fallback check
   * below reads `MEDFAILS.doubleWipeNoFaintOrder` — so it compared `undefined` against 0, passed
   * every time, and asserted nothing. That is the silent default in its usual costume: a green check
   * that was never able to be red. The two banks are merged and a key collision THROWS, because a
   * collision would silently pick one of two different facts. */
  const banks = () => {
    const out = {};
    for (const [bank, name] of [[globalThis.MEDSEEN, 'MEDSEEN'], [globalThis.MEDFAILS, 'MEDFAILS']])
      for (const k of Object.keys(bank || {})) {
        if (k in out) throw new Error('counter name ' + k + ' exists in both MEDSEEN and ' + name);
        if (typeof bank[k] === 'number') out[k] = bank[k];
      }
    return out;
  };
  const before = banks();
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe-selfdestruct-winner :: ' + c.id, { script: c.script, arm });
  const after = banks();
  const delta = {};
  for (const k of Object.keys(after)) delta[k] = after[k] - (before[k] || 0);
  /* NAMED, NOT DEFAULTED. A counter this file asserts on must EXIST; reading a missing one as 0 is
   * how the check above came to be vacuous in the first place. */
  for (const k of ['doubleWipeDecidedByLastFaint', 'doubleWipeNoFaintOrder',
                   'selfKOAlwaysAboveTheHit', 'selfKOLineFromShieldExit'])
    if (!(k in delta)) throw new Error('the engine has no counter named ' + k);
  return { r, delta, sc: G.scriptCounters() };
}

/* medicham2's winner, ASKED OF `battleResult` ITSELF (2026-08-23) — the driver now calls it at the
 * moment it takes the final roster and carries the answer as `mediResult`.
 *
 * THE EARLIER VERSION OF THIS FUNCTION RE-IMPLEMENTED THE RULE HERE, and its header said that was
 * because `battleResult` is not exported. THAT WAS FALSE — it is on `module.exports` and on `root` —
 * and the cost of the false claim was not academic: a probe that recomputes "who won" scores a rule
 * of its own, so it would have gone green the moment I taught the PROBE about the last faint while
 * leaving the ENGINE answering 0.5 to every rollout and every H2H that reads it. The re-implementation
 * is kept BESIDE the real answer as `bodies`, purely so a disagreement between the two is visible.
 * 1 = side A, 0 = side B, 0.5 = neither. */
function mediVerdict(fr) {
  if (!fr || !fr.medicham) return { who: 'UNREADABLE', a: null, b: null, bodies: null };
  const liveA = fr.medicham.p1.filter(x => !x.fainted && x.hp > 0).length;
  const liveB = fr.medicham.p2.filter(x => !x.fainted && x.hp > 0).length;
  const bodies = liveA > liveB ? 'p1' : (liveB > liveA ? 'p2' : 'draw');
  const r = fr.mediResult;
  const who = r == null ? 'UNREADABLE' : (r === 1 ? 'p1' : (r === 0 ? 'p2' : 'draw'));
  return { who, a: liveA, b: liveB, result: r, bodies };
}
/* THE FAINT ORDER THE ENGINE ACTUALLY RECORDED, printed on every arm. The verdict alone cannot
 * distinguish "the rule read the right body" from "the rule guessed the right side", and on a
 * two-sided question a guess is right half the time. */
const seqLine = (fr, side) => (fr && fr.medicham && fr.medicham[side] || [])
  .filter(x => x.faintSeq != null).sort((p, q) => p.faintSeq - q.faintSeq)
  .map(x => x.name + '#' + x.faintSeq).join(' ');
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
  return sd.who === me.who;
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
  const brk = play(harness(p.src, 'selfko'), c);
  const w = brokenWinRule();
  if (w.err) { console.log('PLANT FAILED (winrule)  ' + c.id + '   ' + w.err); bad++; continue; }
  const wrk = play(harness(w.src, 'winrule'), c);
  harness(null);
  ran++;
  rows.push({ c, clean, brk, wrk });
}

for (const { c, clean, brk, wrk } of rows) {
  const sdC = sdVerdict(clean.r.finalRoster), meC = mediVerdict(clean.r.finalRoster);
  const sdB = sdVerdict(brk.r.finalRoster), meB = mediVerdict(brk.r.finalRoster);
  const sdW = sdVerdict(wrk.r.finalRoster), meW = mediVerdict(wrk.r.finalRoster);
  const okC = agree(sdC, meC), okB = agree(sdB, meB), okW = agree(sdW, meW);
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
  const DELTA = new Map([[clean.r, clean.delta], [brk.r, brk.delta], [wrk.r, wrk.delta]]);
  const line = (tag, sd, me, r) => {
    const d = DELTA.get(r);
    console.log('    ' + tag.padEnd(7)
      + 'showdown winner=' + JSON.stringify(sd.winner) + ' pokemonLeft p1=' + sd.a + ' p2=' + sd.b
      + '   |   medicham battleResult=' + JSON.stringify(me.result) + ' -> ' + me.who
      + '   (live bodies p1=' + me.a + ' p2=' + me.b + ')');
    console.log('           first parted line: '
      + (r.div ? ('#' + r.div.index + '  sd `' + r.div.sdRaw + '`  me `' + r.div.meRaw + '`') : 'none'));
    console.log('           alive at the end: p1 [' + names(r.finalRoster, 'p1') + ']  p2 [' + names(r.finalRoster, 'p2') + ']');
    /* THE ORDER, NOT THE VERDICT. On a two-sided question a wrong rule is right half the time; this
     * is the line that says which BODY the tie-break read. */
    console.log('           faint order  : p1 [' + seqLine(r.finalRoster, 'p1') + ']  p2 [' + seqLine(r.finalRoster, 'p2') + ']');
    console.log('           selfKOAlwaysAboveTheHit=' + d.selfKOAlwaysAboveTheHit
      + '  selfKOLineFromShieldExit=' + d.selfKOLineFromShieldExit
      + '  doubleWipeDecidedByLastFaint=' + d.doubleWipeDecidedByLastFaint
      + '  doubleWipeNoFaintOrder=' + d.doubleWipeNoFaintOrder);
  };
  line('CLEAN', sdC, meC, clean.r);
  line('BROKEN', sdB, meB, brk.r);
  line('NOWIN', sdW, meW, wrk.r);
  console.log('    CLEAN vs BROKEN, the attribution: the winner comparison is '
    + (okB === okC ? 'THE SAME under the revert, so the self-KO POSITION is not what decides it'
                   : 'DIFFERENT under the revert, so the self-KO POSITION is what decides it')
    + '.');

  /* ---- THE WIN RULE'S OWN RED ARM, AND ITS OVER-FIRE CONTROL ------------------------------------
   * `tied` is DECLARED on the board and CHECKED against the run, because the whole arm rests on both
   * sides really emptying and a fixture that quietly stopped doing so would take the demonstration
   * with it — that is the failure w3's own header records from its first draft. */
  const reallyTied = sdC.a === 0 && sdC.b === 0;
  if (!!c.tied !== reallyTied) {
    console.log('    FIXTURE BROKEN — declared tied=' + !!c.tied + ' but the authority ended with '
      + 'pokemonLeft p1=' + sdC.a + ' p2=' + sdC.b + '. The win-rule arm below is measuring nothing.');
    bad++;
  } else if (c.tied) {
    const moved = meW.who !== meC.who;
    console.log('    WIN RULE, RED ON DEMAND: deleting the last-fainted tie-break moves this board '
      + 'from ' + meC.who + ' to ' + meW.who + ' — ' + (moved ? 'RED PROVEN' : 'IT DID NOT MOVE, so the '
      + 'tie-break is NOT what decides this board and the arm proves nothing') + '.');
    if (!moved) bad++;
    if ((clean.delta.doubleWipeDecidedByLastFaint || 0) !== 1) {
      console.log('    COUNTER — doubleWipeDecidedByLastFaint=' + clean.delta.doubleWipeDecidedByLastFaint
        + ' on the clean run; a tied board must decide exactly once.');
      bad++;
    }
  } else {
    const moved = meW.who !== meC.who;
    console.log('    WIN RULE, OVER-FIRE CONTROL: an UNTIED board must be untouched by the tie-break — '
      + (moved ? 'IT MOVED, from ' + meC.who + ' to ' + meW.who + ', so the new rule is reaching boards '
        + 'it has no business on' : 'unchanged at ' + meC.who) + '.');
    if (moved) bad++;
    if ((clean.delta.doubleWipeDecidedByLastFaint || 0) !== 0) {
      console.log('    COUNTER — doubleWipeDecidedByLastFaint fired on an untied board.'); bad++;
    }
  }
  if ((clean.delta.doubleWipeNoFaintOrder || 0) !== 0) {
    console.log('    LOUD FALLBACK FIRED — battleResult found two emptied sides with no comparable '
      + 'faint order and answered 0.5. The stamp did not reach every faint site.'); bad++;
  }

  const refused = clean.sc.moveNotOnRequest;
  if (refused) { console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
    bad++; }
}

console.log(NL + ran + ' boards staged, ' + knownOpen + ' of them KNOWN-OPEN (declared, not counted), '
  + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — on every staged wipe this file counts, the two engines name the same '
  + 'winner: the two untied boards, the simultaneous Explosion, and Perish Song with the slowest body '
  + 'on each side in turn. Every tied board parts from the authority under its own revert and every '
  + 'untied one does not, so the last-fainted rule is what is deciding them and it is not reaching '
  + 'anything else');
process.exit(bad ? 1 : 0);
