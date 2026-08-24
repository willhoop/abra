/* test-encore-fail-silent.js — ROADMAP #241 PART (3), NARROWED TO ITS REAL CONTENT: THE AUTHORITY
 * ANNOUNCES A FAILED ENCORE AND THIS ENGINE SAYS NOTHING.
 *
 *   SHOWDOWN_PATH=... node tests/test-encore-fail-silent.js               the LIVE tree
 *   SHOWDOWN_PATH=... node tests/test-encore-fail-silent.js --release <id>   a named snapshot
 *
 * IT PLAYS THE LIVE TREE, AND IT ARRANGES THAT ITSELF RATHER THAN ASKING THE CALLER TO.
 * `game_differential.js` binds the simulator out of a FROZEN release at require time — and CUTS one
 * into `data/releases/` when `--release` is absent. Both halves are wrong for a gate: an author's own
 * edit would be invisible to a run that graded the current snapshot, and `tests/run-all.js` spawns a
 * bare `node <file>`, so every suite run would leave a junk release behind. (That is not theoretical:
 * `tests/test-effect-kind.js` requires the same driver, and running it in a batch on 2026-08-22 cut
 * release `a875091966c4` into the real store before anyone noticed.)
 *
 * So `tests/_live_release.js` is required HERE, before the driver, whenever no `--release` was named.
 * It redirects `cut`/`open` to a throwaway store under the OS temp directory and freezes the WORKING
 * TREE; `data/releases/` and `data/engine-release.json` are never touched. It prints the override on
 * stderr itself, so a run that used it cannot look like a run that did not. With `--release <id>` it
 * is NOT loaded, because that id lives in the real store and the redirect would hide it.
 *
 * ================= WHAT THIS ROW IS, MEASURED =====================================================
 *
 * `data/divergence-turns.json` (release 6a05dd9ad60d, 40 cards off 378 diverged games): **18 of the
 * 40** are a `|-fail|` the authority emits and this engine does not. Walking each card's `before_raw`
 * back to the last `|move|` line, the move immediately in front of that `-fail` is **encore x16,
 * yawn x2**. It is not a diffuse `-fail` family. It is Encore.
 *
 * ================= THE TRAP, WHICH IS WHY EVERY ARM HAS A SILENT TWIN ============================
 *
 * THIS WAS ATTEMPTED ONCE AND RETRACTED THE SAME DAY. `medicham2-browser.js` carries the account: the
 * line `if(_sealNoLastMove&&!_volApplied&&!a.sc){ mvFail(m); }` is CORRECT on the case it was built
 * from and bought **four and six extra diverging games** across the two arms of an 815-game
 * differential. Announcing a failure whenever ours does not apply fires where the authority is
 * SILENT, and trades sixteen divergences for a different set.
 *
 * So a test that only proves the line APPEARS is the exact test that passed last time and still cost
 * a retraction. Half the arms below stage a case where the authority stays SILENT and assert this
 * engine stays silent too — a legitimately-applied Encore, an Encore a Protect turned away, an Encore
 * an Aroma Veil blocked, and the phaze/Suction Cups case that runs the OTHER WAY (we announce, the
 * authority does not).
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the identical script under the differential's
 * own pin and the two protocol streams are compared line for line; the pass is that they do not part.
 * SHOWDOWN IS THE EXPECTATION — the rule `tests/staged_board.js` argues for at length, applied to the
 * protocol stream instead of the board because the defect IS a line.
 *
 * ================= THE AUTHORITY'S OWN CONDITIONS, CITED =========================================
 *
 * CHAMPIONS OVERRIDES `encore` — `data/mods/champions/moves.ts:286-320` — so mainline is the wrong
 * file to read. The mod rewrites what happens on SUCCESS (it re-queues the target's action with a
 * recomputed priority, :303-318) and leaves the FAILURE conditions byte-identical to mainline:
 *
 *     let move = target.lastMove;
 *     if (!move || target.volatiles['dynamax']) return false;              // :292  — has not acted
 *     if (move.isMax && move.baseMove) move = this.dex.moves.get(move.baseMove);
 *     const moveSlot = target.getMoveData(move.id);                        // :296
 *     if (move.isZ || move.isMax || move.flags['failencore'] || !moveSlot || moveSlot.pp <= 0) {
 *         return false;                                                    // :297-299
 *     }
 *
 * plus one that is NOT in `onStart` and produces the same visible line from a different layer:
 * `Pokemon#addVolatile` (`sim/pokemon.ts:1994-1997`) returns **false** for a volatile the body already
 * carries when its condition declares no `onRestart`, and Encore's declares none.
 *
 * A `false` from any of those is what makes `runMoveEffects` write the line
 * (`sim/battle-actions.ts:1303-1309`): `if (didAnything === false) { add('-fail', source);
 * attrLastMove('[still]'); }`. **`null` does not.** That distinction is the whole row — see
 * `medicham2-browser.js`'s `volRefusal` block.
 *
 * `isZ` / `isMax` / `dynamax` are excluded rather than implemented: Z-moves, Max moves and Dynamax do
 * not exist in Reg M-B, so no board in this format can reach those three clauses.
 *
 * ================= THE FIXTURES ARE FIXTURES ====================================================
 *
 * Every species, move and ability named here is legal in `gen9championsvgc2026regmb` and every move
 * is on its user's own learnset — both derived from `Dex.forFormat`, not recalled. Spreads and items
 * are the harness's, so nothing here is a set and nothing here is a recommendation.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER: `_live_release.js` wraps `cut`/`open` on the module object, and
 * game_differential.js calls `cut()` at ITS require time. Loading it second would be a no-op that
 * still looked like it worked. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const NL = String.fromCharCode(10);

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const PP = [PROT, PROT];

/* THE STANDING CAST. Whimsicott is the format's Prankster Encore body and is why the +1 arms below
 * resolve before a slower target has moved; Garchomp is the target because Swords Dance is a move it
 * can legally repeat three times without hitting the +6 cap, which would introduce a SECOND `-fail`
 * from an unrelated cause into the middle of the arm. */
const WHIM = ['whimsicott', '', 'Prankster', ['Encore', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const CHOMP = ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Protect']];

const CASES = [

  /* ================= RED — the authority announces and this engine is silent ==================== */

  { name: 'RED  encore into a body that has not moved yet',
    what: 'Prankster puts the Encore at +1, so it resolves before Garchomp has clicked anything and '
        + '`target.lastMove` is null. champions/moves.ts:292 returns false; the authority writes '
        + '`|-fail|p1a: Whimsicott` and blanks its own move line with `[still]`.',
    A: [WHIM, CLEF], B: [CHOMP, CORV],
    script: [T([{ m: 'encore', t: 0 }, PROT], [{ m: 'swordsdance' }, PROT]),
             T(PP, [{ m: 'swordsdance' }, PROT])] },

  { name: 'RED  a second Encore while the first is still on the body',
    what: 'Turn 2 the Encore LANDS — that turn is this arm\'s own silent control and must stay '
        + 'silent. Turn 3 clicks it again into the volatile it just made: addVolatile refuses a '
        + 'volatile already present whose condition has no onRestart (sim/pokemon.ts:1994).',
    A: [WHIM, CLEF], B: [CHOMP, CORV],
    script: [T([PROT, PROT], [{ m: 'swordsdance' }, PROT]),
             T([{ m: 'encore', t: 0 }, PROT], [{ m: 'swordsdance' }, PROT]),
             T([{ m: 'encore', t: 0 }, PROT], [{ m: 'swordsdance' }, PROT])] },

  { name: 'RED  encore into a body whose last move was Encore (failencore)',
    what: 'Whimsicott Encores Clefable on turn 1, so on turn 2 Whimsicott\'s own `lastMove` IS '
        + 'Encore — and Encore carries `failencore` in its own flags block, so champions/moves.ts:297 '
        + 'returns false. THIS ONE IS A STATE BUG AS WELL AS A NARRATION BUG: this engine applies the '
        + 'Encore.  The five legal `failencore` moves are Encore, Copycat, Sleep Talk, Struggle and '
        + 'Transform, derived from the format\'s own flags (data/tags.json `callRefusalFlags`).'
        + '  THE FIXTURE IS BUILT, NOT FOUND, and three pieces of it are load-bearing. (1) Clefable '
        + 'clicks MOONBLAST on both of the first two turns, so the Encore that lands on turn 2 locks '
        + 'it into the move it was already clicking — Champions\' own `encore` re-queues the target\'s '
        + 'action only when `action.moveid !== move.id` (mods/champions/moves.ts:307), so an arm built '
        + 'any other way would be testing the re-queue instead. (2) The target may NOT be shielded: '
        + 'Encore carries `protect: 1`, and a Protected target is turned away SILENTLY, which is a '
        + 'different arm two rows down. (3) Sableye is the tester because Prankster puts its Encore at '
        + '+1, ahead of Whimsicott\'s 0-priority Moonblast, so Whimsicott\'s `lastMove` is still '
        + 'Encore when it is asked — and Whimsicott is Grass/Fairy, so Prankster reaches it. A '
        + 'Dark-type target would be immune and the arm would pass while testing nothing.',
    A: [['sableye', '', 'Prankster', ['Encore', 'Protect']],
        ['clefable', '', 'Unaware', ['Moonblast', 'Protect']]],
    B: [['whimsicott', '', 'Prankster', ['Encore', 'Moonblast', 'Protect']], CORV],
    script: [T([PROT, { m: 'moonblast', t: 1 }], [PROT, PROT]),
             T([PROT, { m: 'moonblast', t: 1 }], [{ m: 'encore', t: 1 }, PROT]),
             T([{ m: 'encore', t: 0 }, { m: 'moonblast', t: 1 }], [{ m: 'moonblast', t: 0 }, PROT])] },

  /* ================= SILENT — the authority says nothing and neither may we ===================== */

  { name: 'SILENT  an Encore that simply lands',
    what: 'The positive control for the whole file. An engine that announces a failure whenever its '
        + 'Encore did not apply passes every RED arm above and fails here.',
    A: [WHIM, CLEF], B: [CHOMP, CORV],
    script: [T([PROT, PROT], [{ m: 'swordsdance' }, PROT]),
             T([{ m: 'encore', t: 0 }, PROT], [{ m: 'swordsdance' }, PROT])] },

  { name: 'SILENT  an Encore a Protect turned away',
    what: 'Encore carries `protect: 1`. Protect\'s onTryHit returns NOT_FAIL — a STRING, which is '
        + 'falsy and is not `false` — so `hitStepTryHitEvent` (battle-actions.ts:1043-1047) writes no '
        + '`-fail` and the target is simply dropped from the list before the effects step runs. A '
        + 'blanket "the volatile did not apply, announce it" fires here and the authority does not.',
    A: [WHIM, CLEF], B: [CHOMP, CORV],
    script: [T([PROT, PROT], [{ m: 'swordsdance' }, PROT]),
             T([{ m: 'encore', t: 0 }, PROT], [PROT, PROT])] },

  { name: 'SILENT  an Encore an Aroma Veil blocked',
    what: 'Aroma Veil\'s `onAllyTryAddVolatile` announces `-block` ITSELF and returns **null** '
        + '(data/abilities.ts aromaveil). null loses to nothing in `combineResults`, so `didAnything` '
        + 'is null and battle-actions.ts:1305 never runs. This is the null-versus-false distinction '
        + 'staged on its own: same refusal, same layer, opposite announcement.  Aromatisse clicks '
        + 'MOONBLAST on turn 2, not Protect, and the counter assertion at the bottom is what forced '
        + 'that: with a Protect up the shield refuses the Encore one gate earlier, `volRefusedSilent` '
        + 'read 0, and this arm was a green Protect test wearing an Aroma Veil label.',
    A: [WHIM, CLEF],
    B: [['aromatisse', '', 'Aroma Veil', ['Moonblast', 'Protect']], CORV],
    script: [T([PROT, PROT], [{ m: 'moonblast', t: 0 }, PROT]),
             T([{ m: 'encore', t: 0 }, PROT], [{ m: 'moonblast', t: 0 }, PROT])] },

  /* ================= THE SAME RULE, RUNNING THE OTHER WAY ====================================== */

  { name: 'SILENT  a phaze Suction Cups refused (we announce, the authority does not)',
    what: 'THE OPPOSITE-DIRECTION INSTANCE OF THE SAME RULE, and the reason it is in this file: '
        + '`forceSwitch` writes `-fail` only when `hitResult === false` (battle-actions.ts:1358-1363) '
        + 'and Suction Cups\' onDragOut returns **null**, so the authority emits the `-activate` and '
        + 'nothing else. Malamar is the format\'s only Suction Cups body. Whirlwind carries no '
        + '`protect` flag, so the target clicking Protect does not shield it.',
    A: [['snorlax', '', 'Thick Fat', ['Whirlwind', 'Protect']], CLEF],
    B: [['malamar', '', 'Suction Cups', ['Protect']], CORV],
    script: [T([{ m: 'whirlwind', t: 0 }, PROT], [PROT, PROT]),
             T(PP, [PROT, PROT])] },

  /* ================= YAWN — the second member, staged but NOT swept in ========================== */

  { name: 'RED  a second Yawn while the first is still on the body',
    what: 'Yawn is 2 of the 18 cards and is NOT overridden by Champions (no `yawn` key in '
        + 'data/mods/champions/moves.ts). Turn 1 the Yawn LANDS — that turn is this arm\'s own silent '
        + 'control. Turn 2 clicks it into the drowse it just made, and `addVolatile` refuses a '
        + 'volatile already present. IT DOES NOT INHERIT THE ENCORE FIX: Yawn has its own branch in '
        + 'this engine and keeps its counter in `_yawn`, not in `_vol`, so it never touches '
        + '`applyMoveVolatile` at all — measured, not assumed. Only the already-drowsing clause is '
        + 'covered; Yawn\'s `onTryHit` half (already statused, or immune to sleep) is left alone '
        + 'because `canTakeStatus` here is wider than `runStatusImmunity` and would fire on Safeguard, '
        + 'where the authority is silent.',
    A: [['snorlax', '', 'Thick Fat', ['Yawn', 'Protect']], CLEF], B: [CHOMP, CORV],
    script: [T([{ m: 'yawn', t: 0 }, PROT], [{ m: 'swordsdance' }, PROT]),
             T([{ m: 'yawn', t: 0 }, PROT], [{ m: 'swordsdance' }, PROT])] },

  { name: 'SILENT  a Yawn a Protect turned away',
    what: 'Yawn carries `protect: 1`, so the same NOT_FAIL road as the Encore arm above. The '
        + 'over-fire control for the Yawn half: an engine that announces whenever its drowse did not '
        + 'land passes the RED arm above and fails here.',
    A: [['snorlax', '', 'Thick Fat', ['Yawn', 'Protect']], CLEF], B: [CHOMP, CORV],
    script: [T([{ m: 'yawn', t: 0 }, PROT], [PROT, PROT]),
             T(PP, [{ m: 'swordsdance' }, PROT])] },

  { name: 'SILENT  a Yawn a Sweet Veil ally blocked',
    what: 'Sweet Veil names `yawn` in its own `onAllyTryAddVolatile`, writes its own `-block` and '
        + 'returns **null** (data/abilities.ts sweetveil) — exactly as Aroma Veil does for the Encore '
        + 'family. Tsareena is a legal Sweet Veil body in this format. It clicks Trop Kick rather '
        + 'than Protect ON PURPOSE: a shield refuses the Yawn one gate EARLIER and the veil would '
        + 'never be reached, which is a green arm testing nothing.',
    A: [['snorlax', '', 'Thick Fat', ['Yawn', 'Protect']], CLEF],
    B: [['tsareena', '', 'Sweet Veil', ['Trop Kick', 'Protect']], CORV],
    script: [T([{ m: 'yawn', t: 0 }, PROT], [{ m: 'tropkick', t: 0 }, PROT]),
             T([{ m: 'yawn', t: 0 }, PROT], [{ m: 'tropkick', t: 0 }, PROT])] },
];

/* ---- LEGALITY, DERIVED. Nothing below is typed from memory and nothing is trusted from a list. --- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
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

/* ---- the run ------------------------------------------------------------------------------------ */
let bad = 0, ran = 0;
const results = [];
G.resetScriptCounters();
for (const c of CASES) {
  const A = stage(c.A).concat(BENCH('milotic', 'incineroar'));
  const B = stage(c.B).concat(BENCH('snorlax', 'toxapex'));
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name); bad++; continue; }
  const r = G.playGame(a, b, 'directed', 'test-encore-fail-silent :: ' + c.name, { script: c.script });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); bad++; continue; }
  ran++;
  /* SHORT IS NOT A PASS. In protocol mode a game stops AT the divergence, so a game that played
   * fewer turns than its script WITHOUT a divergence stopped testing and would otherwise read green. */
  const short = r.turns < c.script.length && !r.div;
  if (r.div || short) bad++;
  results.push({ c, r, short });
}

for (const { c, r, short } of results) {
  console.log(NL + (r.div ? 'STREAMS PART' : short ? 'SHORT       ' : 'AGREES      ') + '   ' + c.name);
  console.log('    ' + c.what);
  console.log('    ' + r.turns + '/' + c.script.length + ' turns');
  if (r.div) {
    console.log('    parted at reduced line ' + r.div.index);
    console.log('      showdown  ' + r.div.sdRaw);
    console.log('      medicham  ' + r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(r.div.sdAfterRaw));
    console.log('      medicham next  ' + JSON.stringify(r.div.meAfterRaw));
  }
}

/* ---- THE COUNTER, AND THE NOUN IT COUNTS ---------------------------------------------------------
 * `moveNotOnRequest` is the number of SCRIPTED CLICKS THE AUTHORITY'S REQUEST DID NOT OFFER, which
 * the driver silently turns into a `pass` on both sides (game_differential.js:3563-3568). A fixture
 * that mistypes a move, or hands a body a move it does not carry, therefore plays a turn in which
 * NOTHING HAPPENS on either engine — the streams agree and the arm reports green while testing
 * nothing at all. It is asserted at EXACT ZERO, never `>= 0`: three counters in this repo were caught
 * counting the wrong noun in one day, and the only defence is naming what is being counted and
 * refusing a range. This counts CLICKS REFUSED, not turns and not arms. */
/* ---- THE ENGINE'S OWN COUNTERS, AT EXACT EQUALITY ------------------------------------------------
 * Every one is asserted `=== n`, never `>= 1`. A `>= 1` bar is passed by a rule that fires on every
 * turn of every arm, which is the over-fire this whole file exists to catch — the counter would go UP
 * under exactly the break it is supposed to detect. The nouns, spelled out because three counters in
 * this repo were caught in one day counting the wrong one:
 *
 *   volFailLinesWritten     `|-fail|` LINES PUT ON THE WIRE by the new rule. Four arms above stage a
 *                           refusal the authority announces and each must produce exactly one line;
 *                           the six silent arms must produce none. 3 Encore + 1 Yawn = 4.
 *   encoreRefusedByOnStart  ENCORE REFUSALS from a champions/moves.ts:297 clause other than the
 *                           shared `!lastMove` guard. Exactly one arm stages one (failencore). If
 *                           this read 0 the new clauses would be unreachable and the failencore arm
 *                           would be passing for some other reason.
 *   mvFailSilentNoLine      CALLS to mvFailSilent — `-fail` lines this engine used to write and no
 *                           longer does. **PINNED AT 0, and it was asserted at 1 until 2026-08-23.**
 *                           The Suction Cups site it named no longer writes `false` at all: the
 *                           phaze pass measured the authority holding `moveThisTurnResult === true`
 *                           there and moved the site to `mvOkSilentNoLine`
 *                           (engine/medicham2-browser.js:463 says so in as many words). The
 *                           expectation was never moved with it, so this file has been RED on an
 *                           engine everything else calls correct — including its own ten arms, all
 *                           of which read AGREES either side of the change, and
 *                           tests/probe_announce_failure.js, whose RESULT clause reads
 *                           `moveLastTurnResult` off both engines on eight arms and finds them
 *                           identical. Verified pre-existing rather than assumed: red on release
 *                           `3e00ea2575a9`, which predates that day's engine work.
 *   mvOkSilentNoLine        the SAME site under the value it actually writes, asserted at 1. The
 *                           pair is what keeps this an assertion rather than a relaxation — the
 *                           site is still pinned to fire exactly once, and a revert to the old
 *                           `false` write turns BOTH numbers red instead of neither.
 *   yawnShieldAnnounced     `|-activate|…|move: Protect` LINES the yawn branch wrote. One arm.
 *   volRefusedSilent        REFUSALS classified as the authority's `null` inside applyMoveVolatile.
 *                           ONE, not two: the Aroma Veil arm goes through applyMoveVolatile and the
 *                           Sweet Veil arm does NOT — Yawn has its own branch and never calls it.
 *                           That asymmetry is the measured finding that Yawn does not inherit the
 *                           Encore fix, asserted rather than described. */
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED, AND `require('engine/medicham2-browser.js')` IS NOT IT.
 * `game_differential.js` binds the engine with `REL.require(...)`, which compiles the SNAPSHOT's copy
 * under the snapshot's own path — a different module, with its own `MEDSEEN` object. Requiring the
 * live file here returns a freshly-loaded second engine whose counters are all zero, and every
 * assertion below would then be comparing against a module that never played a turn. Measured while
 * building this file: all five read 0 against arms that had just passed.
 * The engine writes `root.MEDSEEN = MEDSEEN` on load and `root` is `globalThis`, so this is the
 * object the bytes that actually ran are incrementing. Captured, then checked for existence, because
 * an undefined here would make every `!==` below fire for the wrong reason. */
const SEEN = globalThis.MEDSEEN;
if (!SEEN) {
  console.log(NL + 'NOT RUN — globalThis.MEDSEEN is absent, so the engine\'s own counters cannot be '
    + 'read at all. This is not a pass.');
  process.exit(2);
}
const WANT = { volFailLinesWritten: 4, encoreRefusedByOnStart: 1, mvFailSilentNoLine: 0,
               mvOkSilentNoLine: 1, yawnShieldAnnounced: 1, volRefusedSilent: 1 };
console.log('');
for (const [k, want] of Object.entries(WANT)) {
  const got = SEEN[k];
  if (got !== want) { bad++; console.log('COUNTER   ' + k + '  want exactly ' + want + ', got ' + got); }
  else console.log('counter   ' + k.padEnd(24) + ' = ' + got + '  (exact)');
}

const sc = G.scriptCounters();
if (sc.moveNotOnRequest !== 0) {
  bad++;
  console.log(NL + 'FIXTURE BROKEN — ' + sc.moveNotOnRequest + ' scripted click(s) were not on '
    + 'Showdown\'s request and became a silent `pass` on both engines. First: ' + sc.firstMissing);
} else {
  console.log(NL + 'scripted clicks refused by the authority\'s request: 0 (every click above really ran)');
}

console.log(NL + ran + ' staged, ' + bad + ' parted (or not staged)');
console.log(bad ? 'FAIL' : 'PASS — every staged Encore refusal is announced exactly where the authority '
  + 'announces it, and nowhere else');
process.exit(bad ? 1 : 0);
