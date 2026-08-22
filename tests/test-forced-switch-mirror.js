/* DOES THE HARNESS SAY ANYTHING TO SHOWDOWN THAT SHOWDOWN WILL NOT TAKE?
 *
 *   node tests/test-forced-switch-mirror.js                       # gate: freezes the LIVE tree
 *   node tests/test-forced-switch-mirror.js --release 6a05dd9ad60d --team-store data/team-pool-frozen
 *
 * NOT `tests/test-forced-switch.js`, which sits next to it in a listing and asks a different question
 * entirely: that one gates MILTANK's post-KO replacement POLICY (does the scorer discriminate between
 * two live candidates). This one gates the DIFFERENTIAL HARNESS's ability to tell Showdown what
 * medicham2 already did. Same three words, opposite ends of the graph.
 *
 * ================= WHAT WENT WRONG ===============================================================
 *
 * `engine/game_differential.js` mirrors medicham2's actives into Showdown's forced-switch request. Its
 * lookup had a blind fallback — "the first live body on the bench" — with NO MEMORY OF WHAT THE OTHER
 * SLOT HAD JUST TAKEN. On a DOUBLE KO against a side down to its last usable body both slots resolved
 * to the same bench index and the harness said `"switch 4, switch 4"`. Showdown refuses that outright
 * (*"The Pokémon in slot 4 can only switch in once"*), EIGHT times, once per the caller's
 * `guard++ < 8` — and the return value of `battle.choose` was DISCARDED on that path, so every refusal
 * was swallowed. `requestState` stayed `switch`, and the next turn's guard reported *"showdown stopped
 * asking for a move"*.
 *
 * THAT IS THE INSTRUMENT MANUFACTURING A DIVERGENCE AND FILING IT AGAINST THE ENGINE. The game
 * `gen9championsvgc2026regmbbo3-2654714554 vs gen9championsvgc2026regmbbo3-2654812667`, config
 * `baseline`, arm `middle`, was published in `data/divergence-turns.json` as a real 128-line
 * divergence of class *"showdown stopped emitting while medicham2 continued"*. Answered `pass,
 * switch 4` the two engines agree on all 136 reduced lines and both end the battle. There was never an
 * engine defect in it.
 *
 * A refused choice EMITS NO PROTOCOL LINE. It is invisible in both streams by construction, so the
 * only place it can ever be seen is a counter — and there was no counter either.
 *
 * ================= WHY THE ASSERTIONS ARE SHAPED LIKE THIS =======================================
 *
 * NAME THE NOUN YOUR COUNTER COUNTS, AND ASSERT IT EXACTLY. Three counters in this repo were caught
 * being blind by construction in one day — `bracketRederiveMoved` counted a bracket NOTICED and not
 * APPLIED, `transformedOnEntry` counted COPIES and not LINES, `preTurnShieldAnnounced` counted LINES
 * and not POSITION. So:
 *   - `refused` counts `battle.choose()` CALLS THE AUTHORITY RETURNED FALSE FOR, and is asserted at
 *     EXACTLY 0, never `>= 1`;
 *   - part 7 SABOTAGES the harness on purpose and asserts the counter reads EXACTLY 1, which is the
 *     only way to know a zero means "nothing was refused" rather than "nothing was counted";
 *   - `switched` / `passed` count forced-switch SLOTS, and `passed` is legitimately non-zero — it is
 *     printed and never gated, because a counter allowed to be non-zero for a good reason is a
 *     counter nobody can gate on.
 *
 * CONSTRUCTED, NOT HUNTED. The shape that broke it happens in roughly one corpus game in a hundred and
 * cannot be summoned on demand. `mirrorForcedSwitch` is exported for that reason and parts 2–6 hand it
 * the exact shape as DATA — the double KO, the alias miss, the parted board — so this file does not
 * depend on a corpus that moves under it. Part 8 then plays real games, because a decision that is
 * right in isolation and never reached is still a broken instrument.
 *
 * SHOWN RED ON A DELIBERATE BREAK (2026-08-22). Restore the blind fallback in `mirrorForcedSwitch`,
 * immediately above the `if (j >= 0)` line —
 *     let jj = j;
 *     if (jj < 0) jj = roster.findIndex(q => !q.isActive && !q.fainted);
 * — and run it there instead of `j`. SEVEN checks go red, parts 2 and 4 printing the defect's own
 * strings: `got "switch 4, switch 4"` and `got "switch 3, switch 3"`.
 *
 * PART 8 STAYED GREEN UNDER THAT BREAK, and that is the reason parts 2–6 are constructed rather than
 * hunted. Forty real games in the primary arm never reached a double KO on a last usable body, so the
 * live batch could not tell the broken mirror from the fixed one. A gate that can only see a defect
 * when the corpus happens to serve one up is a gate that reports the corpus.
 */
'use strict';

const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

let bad = 0;
const ok = (cond, name, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  THE FORCED-SWITCH MIRROR — everything the harness says to the authority must be taken\n');

/* ---- loading, without cutting a junk release ---------------------------------------------------
 * `engine/game_differential.js` CUTS A RELEASE INTO data/releases AT REQUIRE TIME unless `--release`
 * is in process.argv (:196). A gate that cut one on every run would repoint the live pointer under
 * whatever else is measuring. Two ways in, and both are named rather than left to chance:
 *   - `--release <id>` given: read those frozen bytes. This is how a MEASUREMENT re-runs the file.
 *   - nothing given: preload `tests/_live_release.js`, which redirects cut/open to a throwaway store
 *     under the OS temp directory. That freezes the LIVE tree, which is the right thing for a gate —
 *     "does the code I just wrote still answer the authority" — and touches data/releases never. */
const PINNED = process.argv.includes('--release');
if (!PINNED) require(D('tests', '_live_release.js'));
let GD = null, loadErr = '';
try { GD = require(D('engine', 'game_differential.js')); }
catch (e) { loadErr = String((e && e.message) || e); }
if (!GD) {
  console.log('  SKIP  needs the Showdown checkout (SHOWDOWN_PATH). NOT a pass.  ' + loadErr.slice(0, 120));
  process.exit(2);
}
console.log('  release ' + GD.REL.id + (PINNED ? '  (pinned)' : '  (live tree, throwaway store)') + '\n');

/* ---- the fixtures ------------------------------------------------------------------------------
 * Shaped exactly like what the real call sees: `mine` is medicham2's actives (each body has `.name`
 * and `.fainted`); `roster` is `side.pokemon` (each has `.species.id`, `.isActive`, `.fainted`). */
const me = (name, fainted) => (name == null ? null : { name, fainted: !!fainted });
const sd = (id_, isActive, fainted) => ({ species: { id: id_ }, isActive: !!isActive, fainted: !!fainted });

/* ---- 1. THE TEST GRADES THE DRIVER, NOT A COPY OF IT -------------------------------------------- */
ok(typeof GD.mirrorForcedSwitch === 'function',
   'engine/game_differential.js exports mirrorForcedSwitch — the decision the driver itself calls',
   'a test that re-implemented the mirror would keep passing after the real one was broken');
if (typeof GD.mirrorForcedSwitch !== 'function') process.exit(1);
const M = GD.mirrorForcedSwitch;

/* ---- 2. THE REPRODUCED GAME, AS DATA ------------------------------------------------------------
 * p2 on turn 10 of `2654714554 vs 2654812667`: Dragonite dead in slot a, medicham2 refilled slot b
 * with Pelipper, and Pelipper is the ONLY live body left. Showdown asks about both slots. */
{
  const r = M([true, true],
              [me('dragonite', true), me('pelipper', false)],
              [sd('dragonite', true, true), sd('basculegion', false, true),
               sd('metagross', false, true), sd('pelipper', false, false)]);
  ok(r.picks.join(', ') === 'pass, switch 4',
     'the double KO on a last usable body answers `pass, switch 4`',
     'got "' + r.picks.join(', ') + '"   (the defect answered "switch 4, switch 4", which Showdown '
     + 'refuses with "The Pokémon in slot 4 can only switch in once")');
  ok(r.switched === 1 && r.passed === 1 && r.cannot === null && r.lookupMiss === 0,
     'and it is booked as ONE slot filled and ONE slot passed',
     'switched=' + r.switched + ' passed=' + r.passed + ' lookupMiss=' + r.lookupMiss
     + ' cannot=' + r.cannot);
}

/* ---- 3. NO ANSWER MAY EVER NAME THE SAME SLOT TWICE ---------------------------------------------
 * The assertion is on the DEFECT'S SIGNATURE, not on a counter: whatever else the mirror does, a
 * duplicate `switch n` is the string Showdown refuses, so no input may contain one. Asserted over
 * every arrangement of a two-slot request against a four-body roster with one live bench body. */
{
  const roster = [sd('dragonite', true, true), sd('basculegion', false, true),
                  sd('metagross', false, true), sd('pelipper', false, false)];
  const bodies = [null, me('dragonite', true), me('pelipper', false), me('basculegion', true),
                  me('metagross', true)];
  let dupes = 0, cases = 0, firstDupe = '';
  for (const a of bodies) for (const b of bodies) {
    const r = M([true, true], [a, b], roster);
    cases++;
    const sw = r.picks.filter(x => /^switch /.test(x));
    if (new Set(sw).size !== sw.length) { dupes++; if (!firstDupe) firstDupe = r.picks.join(', '); }
  }
  ok(dupes === 0, 'no arrangement produces a duplicate `switch n` (' + cases + ' constructed requests)',
     dupes ? dupes + ' did, first: "' + firstDupe + '"' : 'the string Showdown refuses is never built');
}

/* ---- 4. A SLOT MEDICHAM2 COULD NOT FILL IS `pass`, NEVER A BODY OF SHOWDOWN'S CHOOSING ----------
 * The blind fallback did not only collide; when it did NOT collide it put a body on Showdown's field
 * that medicham2 never brought in, which is the harness playing its own game with nobody watching. */
{
  const r = M([true, true], [me('dragonite', true), me('charizard', true)],
              [sd('dragonite', true, true), sd('charizard', true, true),
               sd('metagross', false, false), sd('pelipper', false, false)]);
  ok(r.picks.join(', ') === 'pass, pass',
     'both slots empty in medicham2 answers `pass, pass` even though showdown HAS live bench bodies',
     'got "' + r.picks.join(', ') + '"   (the defect answered "switch 3, switch 4" — two bodies '
     + 'medicham2 never brought in)');
  ok(r.passed === 2 && r.switched === 0 && r.cannot === null,
     'and both are booked as passes rather than as anything having gone wrong',
     'switched=' + r.switched + ' passed=' + r.passed + ' cannot=' + r.cannot);
}

/* ---- 5. THE BOARDS HAVE PARTED — SAY SO, DO NOT ANSWER -------------------------------------------
 * Measured, not argued: with the `claimed` set in place, 129 corpus games produced two of these. The
 * first was `p1 slot 2 holds liepard` — FAINTED in Showdown and at 139 HP in medicham2, ON TURN 1. No
 * answer to that request reproduces medicham2's placement, because that placement does not exist on
 * Showdown's board. */
{
  const r = M([false, true], [me('slowbrogalar', false), me('liepard', false)],
              [sd('slowbrogalar', true, false), sd('liepard', false, true),
               sd('mudsdale', false, false), sd('sableye', false, false)]);
  ok(r.cannot && /liepard/.test(r.cannot) && /cannot switch in/.test(r.cannot),
     'a live medicham2 body that showdown has FAINTED reports `cannot`, and names the body',
     String(r.cannot));
  ok(r.lookupMiss === 0,
     'and it is NOT charged to the alias-table counter — the two engines agree on the NAME',
     'lookupMiss=' + r.lookupMiss + '; SWITCH_LOOKUP_MISS.sd must stay a name failure and must read 0');
}

/* ---- 6. AN ALIAS FAILURE IS A DIFFERENT FINDING AND IS COUNTED APART ---------------------------- */
{
  const r = M([true, false], [me('urshifurapidstrike', false), null],
              [sd('urshifu', true, true), sd('mudsdale', false, false),
               sd('sableye', false, false), sd('liepard', false, false)]);
  ok(r.lookupMiss === 1 && r.cannot && /does not have under that name/.test(r.cannot),
     'a body showdown holds under NO such name is charged to the alias counter (must read 0 in a run)',
     'lookupMiss=' + r.lookupMiss + '  cannot=' + r.cannot);
}

/* ---- 7. THE COUNTER IS NOT BLIND BY CONSTRUCTION -------------------------------------------------
 * A zero is worth nothing until something has made it read one. `Battle.prototype.choose` is wrapped
 * to rewrite the harness's forced-switch answer into the exact duplicate the defect used to build;
 * the driver must SEE the refusal, count EXACTLY one, and throw — and the game must come back with an
 * error rather than a result. The wrapper is removed again before part 8. */
const HAS_SIM = !!process.env.SHOWDOWN_PATH;
let sabotageRan = false;
if (HAS_SIM) {
  const { Battle } = require(D('engine', 'champions_sim.js')).sim();
  const orig = Battle.prototype.choose;
  let fired = 0, firedSlots = 0;
  Battle.prototype.choose = function (sideId, input) {
    let s = String(input);
    if (this.requestState === 'switch' && /switch \d+/.test(s) && fired === 0) {
      const n = /switch (\d+)/.exec(s)[1];
      /* HOW MANY SLOTS THE REQUEST ASKED ABOUT DECIDES WHICH REFUSAL SHOWDOWN GIVES, and the
       * assertion below is told which rather than guessing. Two slots reproduces the defect's own
       * refusal verbatim ("can only switch in once"); one slot gets "You sent more switches than
       * Pokémon that need to switch". Both are the authority refusing a switch the harness invented,
       * which is the noun being counted — but a test that accepted either string without knowing
       * which it had asked for would be a test that cannot tell them apart. */
      const fs_ = (this[sideId].activeRequest && this[sideId].activeRequest.forceSwitch) || [];
      firedSlots = fs_.filter(Boolean).length;
      s = 'switch ' + n + ', switch ' + n;
      fired++;
    }
    return orig.call(this, sideId, s);
  };
  GD.driverReset();
  GD.resetChoiceCounters();
  let sawErr = '';
  outer:
  for (const c of GD.SW.out) {
    for (const pr of GD.pairsFor(c.config)) {
      const r = GD.playGame(pr.a, pr.b, c.config, pr.tag, { arm: GD.PRIMARY_ARM });
      if (GD.choiceCounters().refused > 0) { sawErr = r.err || ''; break outer; }
    }
  }
  Battle.prototype.choose = orig;
  const cc = GD.choiceCounters();
  sabotageRan = cc.refused > 0;
  ok(cc.refused === 1,
     'a deliberately duplicated forced-switch answer is counted EXACTLY once',
     'refused=' + cc.refused + '   first: ' + (cc.first || '(none)'));
  const wantErr = firedSlots >= 2 ? /can only switch in once/i : /sent more switches/i;
  ok(wantErr.test(cc.first || ''),
     'and the refusal is the one a ' + firedSlots + '-slot request gives for a duplicated `switch n`',
     (cc.first || '(no refusal was ever seen — the sabotage did not reach a forced switch)')
     + '   expected /' + wantErr.source + '/');
  ok(/forced-switch choice rejected/.test(sawErr),
     'and the game came back with an error rather than a result — a refusal is never swallowed',
     'err: ' + (sawErr || '(none)'));
} else {
  console.log('  SKIP  parts 7 and 8 need the Showdown simulator (SHOWDOWN_PATH). NOT a pass.');
  bad++;
}

/* ---- 8. AND ON REAL GAMES THE AUTHORITY TAKES EVERYTHING ---------------------------------------- */
if (HAS_SIM) {
  GD.driverReset();
  GD.resetChoiceCounters();
  let played = 0;
  outer2:
  for (const c of GD.SW.out) {
    for (const pr of GD.pairsFor(c.config)) {
      GD.playGame(pr.a, pr.b, c.config, pr.tag, { arm: GD.PRIMARY_ARM });
      if (++played >= 40) break outer2;
    }
  }
  const cc = GD.choiceCounters();
  ok(cc.refused === 0,
     played + ' games: showdown refused EXACTLY 0 of this harness\'s choices',
     cc.refused ? 'refused=' + cc.refused + '   first: ' + cc.first
                : 'the noun is a battle.choose() call returning false, counted at every call site');
  ok(cc.switched > 0,
     'and the mirror actually RAN — a capability that cannot prove it ran is assumed broken',
     cc.switched + ' forced-switch slots filled, ' + cc.passed + ' passed, '
     + cc.unmirrorable + ' unmirrorable (boards already parted — not a defect, not gated)');
  if (!sabotageRan) {
    console.log('        note: part 7 never reached a forced switch, so the zero above is unproven '
              + 'in this run.');
  }
}

console.log('\n  ' + (bad ? 'FAIL — ' + bad + ' check(s) red' : 'ALL CHECKS PASS'));
process.exit(bad ? 1 : 0);
