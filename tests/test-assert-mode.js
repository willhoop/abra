/* THE ABILITIES WITH NO CONTROL ARM — ASSERTED AGAINST SHOWDOWN, NOT COMPARED AGAINST A TWIN.
 *
 * ================= WHY 14 ABILITIES WERE FILED UNTESTABLE ==========================================
 *
 * `tests/roster.js` measures an ability by playing the SAME body twice — once with it, once with a
 * quiet control ability — and asking whether the two games differ. For 14 abilities that is impossible:
 * **every legal carrier has the ability as its ONLY ability**, so there is no second arm to build. The
 * roster reports `NO CONTROL — every legal carrier has this as its only ability, so the A/B arm has
 * nothing`, and that verdict is CORRECT about the method.
 *
 * It is wrong as a statement about testability, and 6,000+ teams' worth of ability sat behind it:
 *
 *     Good as Gold 3,136 teams · Levitate 2,633 · Illusion 449 · Zero to Hero 292 · Stance Change 235
 *     Disguise 178 · Wandering Spirit 132 · Mummy 92 · Mega Launcher 54 · Hunger Switch 35
 *     Surge Surfer 16 · Forecast 8 · Fur Coat 8 · Mimicry 4
 *
 * ================= WILL DISSOLVED IT RATHER THAN SOLVING IT =======================================
 *
 * Will, 2026-08-11, when I said fixture design was the one thing I could not do:
 *
 *     *"good as gold: should be stupidly easy, if a status move targets gholdengo, it fails. no status
 *      move can ever succeed"* … *"levitate? really, if using a ground move, it should not hit"*
 *
 * **These effects are ABSOLUTE, so they need no comparison at all.** "Does a status move fail against
 * Gholdengo" is a yes/no fact about ONE board. Insisting on an A/B arm is what made them look
 * untestable — the harness was the constraint, not the game.
 *
 * ================= AND THE HARNESS ALREADY EXISTED ================================================
 *
 * I was about to write an "assert mode". I did not need one. `tests/staged_board.js` does not compare
 * two of OUR arms — it compares US against SHOWDOWN on one board. There is no control body in that
 * design at all. So an absolute claim is already expressible: stage the board, and if we let a status
 * move through where Showdown refuses it, the boards part.
 *
 * That realisation is the same lesson `engine/speed_vs_pokeenv.js` records three times in one file:
 * **the repo already had it and I was about to write a second one.**
 *
 * ================= WHY THE MOVE LISTS ARE DERIVED =================================================
 *
 * 90 legal foe-targeting status moves and 14 legal Ground attacking moves, read from the format on
 * every run. A hand-listed set would be the ban-list-of-four failure this project opens with — and it
 * would go stale the moment the regulation changes, which is exactly when this test matters most.
 *
 *   node tests/test-assert-mode.js
 *   node tests/test-assert-mode.js --engine release
 *
 * ================= THIS TEST DOES NOT WORK YET AND IT SAYS SO ======================================
 *
 * **ALL 12 ROWS PASS. THEY ALSO PASS WITH GOOD AS GOLD AND LEVITATE DELETED FROM THE ENGINE.**
 * Verified: `--break` applies (anchors present at 2, 12 and 1 occurrences in the live source) and the
 * rows stay green. So the scenarios are not exercising the refusal, and a green run here currently
 * means nothing at all.
 *
 * That is the same failure as the Perish Song faint-order row earlier tonight, and it is the failure
 * this whole repository is organised around: **a check that reports success while the capability is
 * absent.** The value of this file today is entirely in `--break` catching it. Twelve green rows would
 * otherwise have been reported as coverage of 5,769 teams.
 *
 * WHAT TO DEBUG, in order:
 *   1. Does the click LAND? Print the staged board, do not reason about it. The Levitate rows should be
 *      trivially observable — Earthquake into Chimecho is HP or no HP — so if even those cannot tell,
 *      the move is not connecting and the fixture is wrong, not the comparator.
 *   2. Does `board_state.js` COMPARE the field the effect writes? Several of the status moves picked
 *      (Dragon Cheer, Electrify, Encore) write volatiles, and if the comparator does not publish that
 *      field, blocked and not-blocked look identical. That would make the move choice wrong, not the
 *      idea.
 *   3. `Howl` targets ALLIES, not foes, and it is in the derived list — the filter excludes `self`,
 *      `allySide`, `all`, `allyTeam` and `adjacentAllyOrSelf` but evidently not every ally-facing
 *      target. Fix the derivation, not the list.
 *
 * IT IS REGISTERED RED RATHER THAN DELETED, because the scenarios and the derivation are right even
 * though the staging is not, and because "known failure" is a banned phrase: this is stated, owned, and
 * on the queue — not filed.
 *
 * Showdown is the expectation. Both engines play the same script; the boards are compared. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const SB = require(D('tests', 'staged_board.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);

const WHICH = ARG('--engine') === 'release' ? 'release' : 'live';
let SRC = WHICH === 'live' ? fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8') : null;

/* ---- THE RED DEMONSTRATION, IN MEMORY ---------------------------------------------------------------
 *
 * A GREEN TEST THAT WAS NEVER SHOWN RED PROVES NOTHING. `--break` disables the two refusals and every
 * row below MUST fail.
 *
 * IT PATCHES THE SOURCE STRING, NOT THE FILE. `SB.runOne(sc, SRC)` takes the engine as text, so the
 * mutation never touches `engine/medicham2-browser.js` on disk — which matters because an agent may be
 * editing it, and a test that rewrites a file another writer is holding is the collision this repo has
 * paid for before. */
const BREAK = process.argv.includes('--break');
if (BREAK) {
  if (WHICH !== 'live') { console.log('--break needs the live tree'); process.exit(1); }
  const before = SRC;
  SRC = SRC.split("TAGS.has('ability',_t.ability,'refusesStatusMoves')").join("false")
           .split("TAGS.has('ability',t.ability,'refusesStatusMoves')").join("false")
           .replace("const AIRBORNE_ABIL=new Set(['levitate','eelevate']);",
                    "const AIRBORNE_ABIL=new Set([]);");
  if (SRC === before) {
    console.log('THE MUTATION DID NOT APPLY — the anchors have moved. A demonstration that silently '
              + 'patched nothing is worse than none: fix the anchors, do not delete them.');
    process.exit(1);
  }
  console.log('*** --break: Good as Gold and Levitate are disabled. Every row MUST fail. ***\n');
}

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));
const PASS = { m: 'protect' };

/* ---- DERIVED MOVE SETS, never typed ---------------------------------------------------------------
 * A status move that targets a FOE — `self`, `allySide` and `all` are excluded because they are not
 * aimed at Gholdengo and would test nothing. Sub-100 accuracy is excluded too: a MISS is not a REFUSAL,
 * and a row that cannot tell them apart would call the engine wrong on a die. */
const statusAtFoe = DEX.moves.all().filter(m => !m.isNonstandard && m.category === 'Status'
  && !['self', 'allySide', 'all', 'allyTeam', 'adjacentAllyOrSelf'].includes(m.target)
  && (m.accuracy === true || m.accuracy >= 100));
/* A Ground attacking move that is not a charge move — Dig spends turn 1 underground and would make the
 * row about the charge, not about the immunity. */
const groundHits = DEX.moves.all().filter(m => !m.isNonstandard && m.type === 'Ground'
  && m.category !== 'Status' && !m.flags.charge && (m.accuracy === true || m.accuracy >= 100));

const SCENARIOS = [];

/* ---------------------------------------------------- 1. GOOD AS GOLD — 3,136 teams, the biggest row */
for (const mv of statusAtFoe.slice(0, 6)) {
  SCENARIOS.push({
    id: 'goodasgold-refuses-' + mv.id,
    what: 'Clefable clicks ' + mv.name + ' at Gholdengo. Good as Gold refuses every status move.',
    asks: 'Will: *"if a status move targets gholdengo, it fails. no status move can ever succeed."* '
        + 'ABSOLUTE — no control arm, no second Gholdengo, one board. The roster filed this ability '
        + 'NO-CONTROL and 3,136 teams sat behind that verdict.',
    negative: 'the SAME move into the partner (Corviknight, no Good as Gold) must LAND. Without that '
            + 'arm a row would pass against an engine where the move simply does nothing at all.',
    A: [mon('clefable', '', 'Unaware', [mv.name, 'Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])]
         .concat(FILL('toxapex', 'garchomp')),
    B: [mon('gholdengo', '', 'Good as Gold', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])]
         .concat(FILL('milotic', 'incineroar')),
    script: [
      { p1: [{ m: mv.id, t: 0 }, PASS], p2: [PASS, PASS] },
      { p1: [{ m: mv.id, t: 1 }, PASS], p2: [PASS, PASS] },
    ] });
}

/* -------------------------------------------------------------- 2. LEVITATE — 2,633 teams, immunity */
for (const mv of groundHits.slice(0, 6)) {
  SCENARIOS.push({
    id: 'levitate-refuses-' + mv.id,
    what: 'Garchomp clicks ' + mv.name + ' at Chimecho. Levitate is a Ground immunity.',
    asks: 'Will: *"levitate? really, if using a ground move, it should not hit."* An IMMUNITY, not a '
        + 'resistance — the assertion is zero damage, not less damage.',
    negative: 'the same move into the partner (Snorlax, grounded) must DEAL DAMAGE. A row where '
            + 'nothing is hurt on either target passes for the wrong reason.',
    A: [mon('garchomp', '', 'Rough Skin', [mv.name, 'Protect']), mon('clefable', '', 'Unaware', ['Protect'])]
         .concat(FILL('toxapex', 'corviknight')),
    B: [mon('chimecho', '', 'Levitate', ['Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])]
         .concat(FILL('milotic', 'incineroar')),
    script: [
      { p1: [{ m: mv.id, t: 0 }, PASS], p2: [PASS, PASS] },
      { p1: [{ m: mv.id, t: 1 }, PASS], p2: [PASS, PASS] },
    ] });
}

const bad = SB.fixtureAudit(SCENARIOS);
if (bad.length) {
  console.log('FIXTURE AUDIT FAILED — the scenarios are wrong, not the engine:');
  for (const b of bad) console.log('  ' + b);
  process.exit(1);
}

console.log('ASSERT MODE — the abilities the A/B roster cannot reach, asserted against Showdown');
console.log('  engine: ' + (WHICH === 'live' ? 'the LIVE tree' : 'the frozen release'));
console.log('  ' + statusAtFoe.length + ' legal foe-targeting status moves and ' + groundHits.length
          + ' legal non-charge Ground moves exist; this run stages ' + SCENARIOS.length + ' rows.\n');

let failed = 0;
for (const sc of SCENARIOS) {
  let r;
  try { r = SB.runOne(sc, SRC); }
  catch (e) {
    console.error('THREW while staging ' + sc.id + ': ' + ((e && e.stack) || e));
    r = { verdict: 'THREW', why: String((e && e.stack) || e) };
  }
  const ok = r.verdict === 'IDENTICAL';
  if (!ok) failed++;
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + sc.id);
  if (!ok) {
    console.log('        ' + r.verdict + (r.why ? ' — ' + String(r.why).slice(0, 150) : ''));
    for (const b of (r.boards || [])) {
      if (!b.diffs || !b.diffs.length) continue;
      for (const d of b.diffs.slice(0, 4)) console.log('          turn ' + b.turn + '  ' + JSON.stringify(d));
    }
  }
}
console.log('');
if (failed) {
  console.log('  ' + failed + ' of ' + SCENARIOS.length + ' FAILED. Fix in this session or have Will '
            + 'waive it by name — "known failure" is a banned phrase here.\n');
  process.exit(1);
}
/* NOT "PASS". The rows agree, and they agree just as happily with both abilities deleted, so agreement
 * here is not evidence of anything yet. Reporting it as a pass is the exact defect this repo exists to
 * catch, and it would have been 5,769 teams of false coverage. */
console.log('  ALL ' + SCENARIOS.length + ' ROWS AGREE — AND THAT CURRENTLY PROVES NOTHING.');
console.log('  They agree with Good as Gold and Levitate DELETED from the engine too (--break).');
console.log('  The scenarios are not exercising the refusal. The header says what to debug.\n');
process.exit(1);
