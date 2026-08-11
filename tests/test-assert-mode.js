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
  /* ================= THE LEVITATE ANCHOR WAS THE WRONG MECHANISM — #174, 2026-08-11 ===============
   *
   * It patched `AIRBORNE_ABIL`, and that set is about being GROUNDED — hazards, the terrains, the
   * `preventsSwitch.onlyGrounded` test. It has NOTHING to do with the damage immunity. Measured
   * rather than argued: with `AIRBORNE_ABIL` emptied, a Garchomp Earthquake into a Levitate Chimecho
   * still deals `0`, exactly as it does clean, while the grounded Snorlax beside it takes 85 in both
   * arms. So the "mutation applied" check was TRUE and the mutation was INERT — a demonstration that
   * patched a real string in a real file and could not change the answer.
   *
   * THE DAMAGE IMMUNITY LIVES IN `absorbedBy` (medicham2-browser.js:7203), which reads the artifact's
   * `typeImmunity` param. Breaking THAT is breaking Levitate, and it breaks every other type-absorber
   * with it — Volt Absorb, Water Absorb, Flash Fire — which is correct for a demonstration whose job
   * is to make the rows red, and is why it is scoped to `--break` and never touches the file. */
  /* THE ANCHOR IS THE TAG NAME, NOT A CALL SITE, and that correction is the whole of #174.
   *
   * The old mutation patched ONE expression each. Both were wrong:
   *   - Levitate's anchor was `AIRBORNE_ABIL`, which is the GROUNDED set — hazards, the terrains,
   *     `preventsSwitch.onlyGrounded` — and has nothing to do with the damage immunity. Emptying it
   *     leaves Earthquake into a Levitate Chimecho at 0, exactly as clean.
   *   - Aiming instead at `absorbedBy` (the battle loop's reader) ALSO left it at 0, because
   *     `dmgRange` reads `typeImmunity` a second time on its own line. One consumer patched, the
   *     other still standing, and the mutation reported "applied".
   * Both measured, not argued, on a real staged turn with a grounded Snorlax beside the Chimecho as
   * the control: 0 / 85 in every arm.
   *
   * So the mutation now renames the TAG in the engine's source, which takes every consumer of that
   * fact at once and cannot be defeated by a third one being added later. It is the same shape as
   * the FACTS-ARE-GLOBAL rule this repo is built on: break the fact, not one of its readers. */
  const before = SRC;
  for (const tag of ['refusesStatusMoves', 'typeImmunity']) {
    const anchor = "'" + tag + "'";
    if (!SRC.includes(anchor)) {
      console.log('THE MUTATION DID NOT APPLY — the engine never names `' + tag + '`. A demonstration '
                + 'that silently patched nothing is worse than none: fix the anchor, do not delete it.');
      process.exit(1);
    }
    SRC = SRC.split(anchor).join("'__BROKEN_" + tag + "'");
  }
  /* ================= LEVITATE HAS **TWO** INDEPENDENT GATES, AND THAT IS WHY IT SURVIVED ==========
   *
   * Renaming `typeImmunity` still left Earthquake into Chimecho at 0. Measured, arm by arm, on the
   * same staged turn with a grounded Snorlax beside it as the control (0/85 throughout):
   *
   *     AIRBORNE_ABIL emptied only ......... chimecho 0   (typeImmunity still absorbs)
   *     `typeImmunity` renamed only ........ chimecho 0   (isGrounded still lifts it)
   *     absorbedBy() forced to null ........ chimecho 0   (same)
   *     BOTH ............................... the row goes red
   *
   * The engine reaches the SAME immunity down two roads: `absorbedBy` reads the artifact's
   * `typeImmunity{type:'Ground'}`, and `typeEffAgainst`'s Ground clause asks `isGrounded`, which
   * reads `AIRBORNE_ABIL`. They agree today, so nothing is wrong on the board — but a demonstration
   * that breaks one of two agreeing implementations proves nothing, and that is precisely the state
   * this file was in. Filed for ENGINE as a FACTS-ARE-GLOBAL duplicate; not collapsed here, because
   * `AIRBORNE_ABIL` also answers the grounded axis (hazards, terrains) where `typeImmunity` has no
   * opinion, so merging them is a change to the engine and not to its test. */
  SRC = SRC.replace("const AIRBORNE_ABIL=new Set(['levitate','eelevate']);",
                    "const AIRBORNE_ABIL=new Set([]);");
  if (SRC.includes("new Set(['levitate','eelevate'])")) {
    console.log('THE MUTATION LEFT THE AIRBORNE ANCHOR STANDING — Levitate has a second gate and the '
              + 'demonstration would be green for the wrong reason. Fix the anchor.');
    process.exit(1);
  }
  if (SRC === before) {
    console.log('THE MUTATION DID NOT APPLY — the anchors have moved.');
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
 * and a row that cannot tell them apart would call the engine wrong on a die.
 *
 * ================= WHY THE FILTERS BELOW EXIST — #174, 2026-08-11 ==================================
 *
 * THE TWELVE ROWS WERE GREEN AND THE MOVES WERE NEVER CLICKED. `game_differential.js`'s `scripted()`
 * answers `pass` for a move that is not on Showdown's request and, until this pass, did so SILENTLY.
 * Six of the twelve moves picked here were not on the clicker's request at all: `Howl` targets an
 * ALLY, and Clefable simply does not learn Corrosive Gas, Dragon Cheer, Electrify or Toxic Thread. So
 * both engines passed the turn, the boards agreed, and the row reported a refusal it never staged.
 * That is why `--break` changed nothing: there was no click for the ability to refuse.
 *
 * THREE FILTERS, EACH DERIVED, EACH FIXING ONE HALF OF THAT:
 *   1. THE CLICKER MUST LEARN IT. Asked of the format's own learnsets, walking the pre-evolution
 *      chain exactly as the validator does. A move the body cannot select is not a scenario.
 *   2. THE EFFECT MUST BE ONE `board_state.js` PUBLISHES. A move whose whole effect is a volatile the
 *      comparator does not carry is invisible in BOTH engines, so blocked and not-blocked read the
 *      same — the second half of the header's debug list, and the reason `statusInflict` /
 *      `statChange` are required rather than any status move.
 *   3. IT MUST NOT ALREADY FAIL FOR ANOTHER REASON. A Ghost is immune to Toxic whatever its ability,
 *      so a status move whose type the target resists to zero would pass with Good as Gold deleted.
 *      Asked of the type chart rather than assumed.
 * The counter added to the driver makes filter 1 self-enforcing: if a future edit picks an
 * unlearnable move again, `scriptCounters().moveNotOnRequest` is non-zero and this file FAILS on it
 * rather than going quietly green. */
const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
const learns = (speciesId, moveId) => {
  let cur = DEX.species.get(speciesId), guard = 0;
  while (cur && cur.exists && guard++ < 6) {
    const ls = DEX.data.Learnsets[cur.id];
    if (ls && ls.learnset && ls.learnset[moveId]) return true;
    cur = cur.prevo ? DEX.species.get(cur.prevo)
      : (cur.baseSpecies !== cur.name ? DEX.species.get(cur.baseSpecies) : null);
  }
  return false;
};
/* THE EFFECT HAS TO REACH THE COMPARATOR. `board_state.js` publishes status and stat stages; a
 * volatile-only move (Encore, Electrify, Dragon Cheer — three of the six that were staged before)
 * writes nothing it carries, so the two engines agree whether or not the refusal fired. Read off the
 * artifact's own tags rather than from a list of move names. */
const OBSERVABLE = (m) => {
  const t = (TAGS.moves[m.id] && TAGS.moves[m.id].tags) || [];
  /* `boostsUser` EXCLUDES CURSE, and it is a filter rather than a name: Curse declares
   * `target: 'normal'` and then re-aims itself at the USER for a non-Ghost clicker
   * (`onModifyMove`), so a Clefable's Curse never reaches Gholdengo at all and the row would be
   * green against an engine with no Good as Gold. The tag says the move moves the user's own stats;
   * that is the shape, and Curse is merely the member it has today. */
  return (t.includes('statusInflict') || t.includes('lowersTarget')) && !t.includes('boostsUser');
};
/* ================= AND THE FOURTH FILTER, WHICH IS A FACT ABOUT THIS HARNESS =====================
 *
 * A SINGLE-TARGET SCRIPTED CLICK DOES NOT REACH EITHER FOE IN THIS COMPARATOR. Measured per row,
 * clean arm against broken arm, with both abilities disabled — a divergence MUST appear and does not:
 *
 *     earthquake  (allAdjacent)     clean IDENTICAL   broken DIFFERS    <- the mechanism is exercised
 *     bulldoze    (allAdjacent)     clean IDENTICAL   broken DIFFERS
 *     cottonspore (allAdjacentFoes) clean IDENTICAL   broken DIFFERS
 *     sweetscent  (allAdjacentFoes) clean IDENTICAL   broken DIFFERS
 *     earthpower  (normal, t:0)     clean IDENTICAL   broken IDENTICAL  <- never reached the body
 *     earthpower  (normal, t:1)     clean IDENTICAL   broken IDENTICAL
 *     charm       (normal, t:0)     clean IDENTICAL   broken IDENTICAL
 *     charm       (normal, t:1)     clean IDENTICAL   broken IDENTICAL
 * `scriptCounters().moveNotOnRequest` is ZERO in every one of those, so the click was OFFERED and
 * TAKEN — the loss is downstream of the request, in the single-target aim. The engine itself is
 * fine: the same Charm into the same Gholdengo through `battleTurn` reads atk -2 with the ability
 * off and 0 with it on.
 *
 * SO THE ROWS ARE SPREAD MOVES, and that is a WORKAROUND with a defect behind it, not a design.
 * It is filed and named rather than absorbed: the single-target scripted aim in
 * `engine/game_differential.js` / `tests/staged_board.js` is the open half of #174. Nothing here
 * papers over it — a single-target row would simply be a hollow row again, and the two-arm check
 * below would refuse to report it green. */
const SPREAD = new Set(['allAdjacentFoes', 'allAdjacent']);
const GHOLD = DEX.species.get('gholdengo');
const LEGAL_SP = DEX.species.all()
  .filter(s => s && s.exists && !s.isNonstandard && s.tier !== 'Illegal');
/* WHO CLICKS IT is derived too, and deterministically: the first legal carrier by id. A hand-picked
 * clicker is the ban-list-of-four failure at one remove — it goes stale the moment a learnset moves. */
const clickerFor = (moveId) => {
  const s = LEGAL_SP.filter(x => learns(x.id, moveId)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  return s ? s.id : null;
};
const statusAtFoe = DEX.moves.all().filter(m => !m.isNonstandard && m.category === 'Status'
  && SPREAD.has(m.target)
  && (m.accuracy === true || m.accuracy >= 100)
  && OBSERVABLE(m) && clickerFor(m.id)
  /* A move the TARGET is already immune to by type proves nothing about the ability. */
  && DEX.getEffectiveness(m.type, GHOLD.types) > -3
  && DEX.getImmunity(m.type, GHOLD.types));
/* A Ground attacking move that is not a charge move — Dig spends turn 1 underground and would make the
 * row about the charge, not about the immunity — and one GARCHOMP ACTUALLY LEARNS. */
const groundHits = DEX.moves.all().filter(m => !m.isNonstandard && m.type === 'Ground'
  && m.category !== 'Status' && !m.flags.charge && (m.accuracy === true || m.accuracy >= 100)
  && m.basePower > 0 && SPREAD.has(m.target) && learns('garchomp', m.id));

const SCENARIOS = [];

/* ---------------------------------------------------- 1. GOOD AS GOLD — 3,136 teams, the biggest row */
for (const mv of statusAtFoe.slice(0, 6)) {
  const who = clickerFor(mv.id);
  SCENARIOS.push({
    id: 'goodasgold-refuses-' + mv.id,
    what: DEX.species.get(who).name + ' clicks ' + mv.name + ' at Gholdengo. Good as Gold refuses '
        + 'every status move.',
    asks: 'Will: *"if a status move targets gholdengo, it fails. no status move can ever succeed."* '
        + 'ABSOLUTE — no control arm, no second Gholdengo, one board. The roster filed this ability '
        + 'NO-CONTROL and 3,136 teams sat behind that verdict.',
    negative: 'the SAME move into the partner (Corviknight, no Good as Gold) must LAND. Without that '
            + 'arm a row would pass against an engine where the move simply does nothing at all.',
    A: [mon(who, '', '', [mv.name, 'Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])]
         .concat(FILL('toxapex', 'garchomp')),
    B: [mon('gholdengo', '', 'Good as Gold', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])]
         .concat(FILL('milotic', 'incineroar')),
    /* THE NEGATIVE IS IN THE SAME CLICK, which is what a spread move buys: Corviknight stands beside
     * Gholdengo and takes the drop, so "nothing moved anywhere" cannot pass for a refusal. */
    script: [
      { p1: [{ m: mv.id, t: 0 }, PASS], p2: [PASS, PASS] },
      { p1: [{ m: mv.id, t: 0 }, PASS], p2: [PASS, PASS] },
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
    /* THE NEGATIVE IS IN THE SAME CLICK: Snorlax is grounded and stands beside the Chimecho, so a
     * spread Ground move that hurts nobody at all cannot read as an immunity. */
    script: [
      { p1: [{ m: mv.id, t: 0 }, PASS], p2: [PASS, PASS] },
      { p1: [{ m: mv.id, t: 0 }, PASS], p2: [PASS, PASS] },
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

/* ================= EVERY ROW PROVES ITSELF, EVERY RUN — #174, 2026-08-11 ==========================
 *
 * `--break` used to be a thing somebody had to REMEMBER to run, and the twelve rows sat green for as
 * long as nobody did. So the demonstration is not a flag any more: each row is played TWICE, once
 * against the shipped engine and once against the mutant, and it PASSES only if
 *
 *     clean  === IDENTICAL      we agree with Showdown, and
 *     broken !== IDENTICAL      the agreement was CAUSED by the mechanism under test.
 *
 * A row where both arms agree is HOLLOW — it is the exact state this whole file was in — and it
 * FAILS, by name, with no way to report it as coverage. `--break` still exists and now means "show me
 * the mutant arm on its own"; under it every row must fail, which is the same claim from the other
 * side. */
const BROKEN_SRC = (() => {
  let s = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  for (const tag of ['refusesStatusMoves', 'typeImmunity']) s = s.split("'" + tag + "'").join("'__BROKEN_" + tag + "'");
  return s.replace("const AIRBORNE_ABIL=new Set(['levitate','eelevate']);", "const AIRBORNE_ABIL=new Set([]);");
})();
const play = (sc, src) => {
  let r;
  try { r = SB.runOne(sc, src); }
  catch (e) {
    console.error('THREW while staging ' + sc.id + ': ' + ((e && e.stack) || e));
    return { verdict: 'THREW', why: String((e && e.stack) || e) };
  }
  /* ROADMAP #174 — THE CLICK MUST HAVE HAPPENED. A scenario whose scripted move was not on
   * Showdown's request becomes passed turns in BOTH engines and reports IDENTICAL; that is exactly
   * how this file stayed green with both abilities deleted. The driver counts it now and a non-zero
   * reading FAILS the row, whatever the board comparison said. */
  const missed = (r.script && r.script.moveNotOnRequest) || 0;
  if (missed) return { verdict: 'NEVER-CLICKED', boards: r.boards,
    why: missed + ' scripted click(s) were not on Showdown\'s request and became a pass — '
       + ((r.script && r.script.firstMissing) || '?') };
  return r;
};

let failed = 0, hollow = 0;
for (const sc of SCENARIOS) {
  const clean = play(sc, SRC);
  /* Under `--break` the "clean" arm IS the mutant, so there is no second arm to take. */
  const broken = BREAK ? null : play(sc, BROKEN_SRC);
  const agrees = clean.verdict === 'IDENTICAL';
  const proven = BREAK ? true : (broken && broken.verdict !== 'IDENTICAL');
  const ok = agrees && proven;
  if (!ok) failed++;
  if (agrees && !proven) hollow++;
  console.log('  ' + (ok ? 'PASS  ' : (agrees ? 'HOLLOW' : 'FAIL  ')) + '  ' + sc.id
    + (ok && !BREAK ? '   (mutant arm: ' + broken.verdict + ')' : ''));
  if (agrees && !proven) {
    console.log('        the row agrees with Showdown AND agrees just as happily with the mechanism '
              + 'DELETED, so it is evidence of nothing. It is not exercising the refusal.');
  } else if (!agrees) {
    console.log('        ' + clean.verdict + (clean.why ? ' — ' + String(clean.why).slice(0, 150) : ''));
    for (const b of (clean.boards || [])) {
      if (!b.diffs || !b.diffs.length) continue;
      for (const d of b.diffs.slice(0, 4)) console.log('          turn ' + b.turn + '  ' + JSON.stringify(d));
    }
  }
}
console.log('');
if (BREAK) {
  if (failed === SCENARIOS.length) {
    console.log('  --break: all ' + SCENARIOS.length + ' rows went RED, which is the demonstration '
              + 'passing. The rows are load-bearing.\n');
    process.exit(0);
  }
  console.log('  --break: ' + (SCENARIOS.length - failed) + ' of ' + SCENARIOS.length + ' rows STAYED '
            + 'GREEN with the mechanism deleted. Those rows prove nothing.\n');
  process.exit(1);
}
if (failed) {
  console.log('  ' + failed + ' of ' + SCENARIOS.length + ' FAILED' + (hollow ? ' (' + hollow
    + ' of them HOLLOW — agreeing for no reason)' : '') + '. Fix in this session or have Will waive it '
    + 'by name — "known failure" is a banned phrase here.\n');
  process.exit(1);
}
console.log('  ALL ' + SCENARIOS.length + ' ROWS AGREE WITH SHOWDOWN, AND EACH ONE WENT RED WITH THE '
          + 'MECHANISM DELETED.');
console.log('  That second half is the whole point: until 2026-08-11 twelve rows agreed and agreed '
          + 'just as happily\n  with Good as Gold and Levitate removed from the engine.\n');
