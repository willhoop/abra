/* staged_status_counters.js — THE VOLATILE AND MAJOR STATUS COUNTERS, STAGED ON A REAL BOARD.
 *
 *   SHOWDOWN_PATH=... node tests/staged_status_counters.js
 *   SHOWDOWN_PATH=... node tests/staged_status_counters.js --only confusion-counter-decays
 *   SHOWDOWN_PATH=... node tests/staged_status_counters.js --json
 *
 * ================= WHY THIS FILE EXISTS BESIDE tests/staged_board.js ============================
 *
 * `tests/staged_board.js` is a LIBRARY here and is never edited: its `harness()`, `fixtureAudit()`
 * and scenario sugar are reused verbatim. Two things this file needs that it does not do:
 *
 *   1. IT COMPARES THE FROZEN RELEASE AGAINST ITSELF. Every scenario below is run TWICE — once over
 *      the release's bytes (the BEFORE) and once over the LIVE `engine/medicham2-browser.js` (the
 *      AFTER), compiled under the snapshot's own filename by the same `harness()`. The release is
 *      therefore the RED and nobody has to type a break to get one. A scenario that is IDENTICAL in
 *      both arms is reported as ALREADY-CORRECT rather than as a pass, because a fix with no red
 *      before it fixed nothing anybody can check.
 *
 *   2. IT CHOOSES THE PIN ARM. `staged_board.js` always plays the PRIMARY arm, in which every
 *      sub-100-accuracy move MISSES and no secondary fires — and that is exactly why the roster
 *      could not stage a BURN or a FREEZE: nothing at 100 accuracy inflicts either in this format.
 *      `bottom-tie-first` is the other shipped arm (every sub-100 move HITS, every secondary fires,
 *      minimum damage), and it is the only arm in which Will-O-Wisp lands and Ice Beam freezes.
 *      The arm is named on every scenario and printed with every verdict.
 *
 * ================= THE CONTROL IS EXPLICIT, AND IT IS NOT OPTIONAL =============================
 *
 * Three of the four defects below are about ONE turn in a sequence, so a scenario that goes red
 * proves nothing on its own — the red could be the staging. Every red scenario here is paired with
 * a CONTROL scenario that removes ONLY the suspected cause and must be green on the SAME release:
 *
 *   sleep-counter-under-a-flinch   pairs with   sleep-counter-with-no-flinch
 *   confusion-counter-decays       pairs with   confusion-control-nobody-is-confused
 *
 * A control that is also red means the finding is somewhere else and the scenario is not evidence.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--state')) process.argv.push('--state');

/* ================= THE BEFORE ARM HAS TO BE PINNED, AND IT ALMOST WAS NOT ======================
 *
 * `engine_release.open()` WITH NO ID TAKES THE NEWEST RELEASE, and both `staged_board.js` and
 * `game_differential.js` read the id off `--release` at MODULE LOAD. Measured here on 2026-08-08:
 * this file's first full run had every scenario red on the release and red on the live tree; the
 * engine was then fixed; the second run reported IDENTICAL ON BOTH ARMS — and the BEFORE arm had
 * silently become a second copy of the AFTER arm, because a `game_differential` run in another
 * process had cut release 138261a235c7 over this working tree at 07:33, mid-edit, and `open()` chose
 * it. Nothing failed. The comparison simply stopped comparing, and its verdict was the comfortable
 * one — which is this project's signature failure mode arriving inside the instrument built to catch
 * it, for the second time in this file's short life.
 *
 * So the baseline is NAMED, injected into argv before either module is required, and the run REFUSES
 * to proceed if that release is not on disk. `--release <id>` overrides it deliberately. */
const BASELINE_RELEASE = '6b5447db1738';        // 3.76.0, the tree this session started from
if (!process.argv.includes('--release')) process.argv.push('--release', BASELINE_RELEASE);
{
  const rid = process.argv[process.argv.indexOf('--release') + 1];
  /* `existsSync` rather than a try/catch around `accessSync`: a catch here would swallow the reason
   * (a permission error and an absent directory are different accidents) and tests/test-no-silent-
   * failure.js is right to refuse one. */
  const rel = path.join(__dirname, '..', 'data', 'releases', String(rid), 'release.json');
  if (!require('fs').existsSync(rel)) {
    console.log('NOT RUN — release ' + rid + ' is not on disk (' + rel + '), so there is no BEFORE '
      + 'arm to compare against. This is not a pass.');
    process.exit(2);
  }
  console.log('BEFORE arm pinned to release ' + rid
    + (rid === BASELINE_RELEASE ? '   (the declared baseline)' : '   (overridden on the command line)'));
}

const ARGV = process.argv;
const ARG = (n) => { const i = ARGV.indexOf(n); return i >= 0 ? ARGV[i + 1] : null; };
const HAS = (n) => ARGV.includes(n);
const ONLY = ARG('--only');
const JSONOUT = HAS('--json');

const BS = require(D('engine', 'board_state.js'));
const SB = require(D('tests', 'staged_board.js'));
const LIVE_SRC = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');

/* ================= THE AFTER ARM NEEDS THE LIVE ARTIFACT, NOT ONLY THE LIVE CODE ================
 *
 * `harness()` compiles the live simulator UNDER THE SNAPSHOT'S OWN FILENAME, which is the only way to
 * pair patched engine source with the right sibling modules — and it means `require('./tags.js')`
 * resolves inside the release, so the live engine reads the RELEASE'S `data/tags.json`. Measured
 * here: with the release pinned, the two berry scenarios stayed red on the AFTER arm even though the
 * code was right, because the frozen artifact still had no `curesVolatile` on a Lum Berry. That is a
 * true statement about that release and a MISLEADING one about the fix, and it is exactly the shape
 * this repository keeps finding — a capability present, running clean, and reading a stale input.
 *
 * So the AFTER arm swaps the tags LOADER'S cache entry for the live one, which reads the live
 * `data/tags.json`, and the BEFORE arm removes it again. The loader FILE itself must be byte-identical
 * between the release and the tree or this would be swapping two things at once; that is asserted
 * rather than assumed, and a mismatch refuses the run. Which artifact each arm read is printed. */
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];
const REL_TAGS_JS = D('data', 'releases', REL_ID, 'engine', 'tags.js');
const LIVE_TAGS_JS = D('engine', 'tags.js');
if (fs.readFileSync(REL_TAGS_JS, 'utf8') !== fs.readFileSync(LIVE_TAGS_JS, 'utf8')) {
  console.log('NOT RUN — engine/tags.js differs between release ' + REL_ID + ' and the tree, so the '
    + 'AFTER arm cannot swap the ARTIFACT without also swapping the LOADER. Two changes at once is '
    + 'not a measurement. This is not a pass.');
  process.exit(2);
}
const REL_TAGS_KEY = require.resolve(REL_TAGS_JS);
require(LIVE_TAGS_JS);
const LIVE_TAGS_MODULE = require.cache[require.resolve(LIVE_TAGS_JS)];
function useLiveTags(on) {
  if (on) require.cache[REL_TAGS_KEY] = LIVE_TAGS_MODULE;
  else delete require.cache[REL_TAGS_KEY];
}

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* ================================================================================================
 *  THE SCENARIOS.  Each declares the two teams, the script, the prose, the ARM, and — where the
 *  finding is about one turn in a sequence — the id of its control.  NONE declares an expected value.
 * ============================================================================================== */
const SCENARIOS = [

  /* ---------------------------------------------------------------- 1. sleep, under a flinch */
  { id: 'sleep-counter-under-a-flinch',
    arm: 'top-tie-first', control: 'sleep-counter-with-no-flinch',
    kind: 'status', shape: 'the sleep counter, on a turn the body was ALSO flinched',
    what: 'Incineroar clicks Fake Out (priority +3) at Snorlax and Milotic clicks Spore at the same '
        + 'body in the same turn, so Snorlax reaches its own action ASLEEP AND FLINCHED. Showdown '
        + 'runs `slp` at onBeforeMove PRIORITY 10 and `flinch` at 8 (data/conditions.ts), so THE '
        + 'SLEEP COUNTER TICKS FIRST and the flinch never gets asked. Everything after that turn is '
        + 'downstream of one number: turn 3 is the wake-up turn in one engine and turn 4 in the other, '
        + 'so Snorlax gets a Swords Dance in one world that it does not get in the other.',
    negative: 'TWO, on the same boards. Turns 2-4 carry no flinch at all, so the counter must tick '
            + 'normally there — an engine that stopped ticking it entirely parts on every turn rather '
            + 'than on the first. And the PARTNER, Corviknight, is never touched by either move and '
            + 'must read no status and counter 0 on every board.',
    A: [mon('incineroar', '', 'Blaze', ['Fake Out', 'Protect']),
        mon('milotic', '', 'Marvel Scale', ['Spore', 'Protect'])].concat(FILL('garchomp', 'clefable')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'weavile')),
    script: [
      { p1: [{ m: 'fakeout', t: 0 }, { m: 'spore', t: 0 }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* --------------------------------------------------- 1b. THE CONTROL — the same sleep, no flinch */
  { id: 'sleep-counter-with-no-flinch',
    arm: 'top-tie-first', isControl: true,
    kind: 'status', shape: 'the sleep counter with nothing else happening to the body',
    what: 'THE IDENTICAL SPORE with the Fake Out removed — Incineroar clicks Protect on turn 1 '
        + 'instead. If this is red as well, the finding above is NOT about the flinch and that '
        + 'scenario is not evidence for anything.',
    negative: 'the partner again, and the whole sleep duration: three turns of counter with no other '
            + 'effect on the board.',
    A: [mon('incineroar', '', 'Blaze', ['Fake Out', 'Protect']),
        mon('milotic', '', 'Marvel Scale', ['Spore', 'Protect'])].concat(FILL('garchomp', 'clefable')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'weavile')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'spore', t: 0 }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* --------------------------------------------------------------- 2. the confusion counter */
  { id: 'confusion-counter-decays',
    arm: 'top-tie-first', control: 'confusion-control-nobody-is-confused',
    kind: 'volatile', shape: 'the confusion volatile and its clock',
    what: 'Milotic clicks Confuse Ray (100 accuracy, so the pin cannot make it miss) at Snorlax on '
        + 'turn 1 and nothing else happens for four turns. Showdown holds confusion as a volatile '
        + 'whose `time` is drawn at onStart and DECREMENTED at the top of every move the body tries '
        + '(data/conditions.ts:181), removing itself when it reaches zero. The clock is on the '
        + 'compared board as `vol.confusion`, so a counter that never moves is visible directly '
        + 'rather than through a consequence.',
    negative: 'TWO, on the same boards. The PARTNER, Corviknight, is never aimed at and must read '
            + 'vol.confusion 0 on every board. And the LATER turns are the negative for the removal: '
            + 'once the clock has run out the volatile must be GONE and must not come back, so an '
            + 'engine that latched it parts on every board after the last one.',
    A: [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'confuseray', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* ------------------------------------------------- 2b. THE CONTROL — the same board, no Confuse Ray */
  { id: 'confusion-control-nobody-is-confused',
    arm: 'top-tie-first', isControl: true,
    kind: 'volatile', shape: 'the same four turns with the confusing click removed',
    what: 'THE IDENTICAL BOARD with Milotic clicking Protect instead of Confuse Ray. A red here would '
        + 'mean the four turns above part for a reason that has nothing to do with confusion.',
    negative: 'every body on the board is the negative: nothing may carry a volatile at any boundary.',
    A: [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* --------------------------------------- 2c. THE CONSEQUENCE, WHICH THE PRIMARY ARM CANNOT SEE */
  { id: 'confusion-hurts-itself',
    arm: 'bottom-tie-first',
    kind: 'volatile', shape: 'the self-hit: a lost action AND a specific number of HP',
    what: 'THE COUNTER IS NOT THE MECHANIC. `confusion-counter-decays` runs on the primary arm, where '
        + '`randomChance(33, 100)` reads the top of the range and the body NEVER hurts itself — so '
        + 'that scenario proves the clock and says nothing at all about what the clock is for. Here '
        + 'the roll lands: Snorlax is confused on turn 1 and, on its own attempt, loses the action and '
        + 'takes a 40-BP typeless physical hit off its OWN Attack against its OWN Defence '
        + '(battle-actions.ts:1850). Two compared fields say so together — the HP, which pins the '
        + 'damage formula exactly, and `boosts.atk`, which stays at 0 because the Swords Dance never '
        + 'happened.',
    negative: 'TWO. Turn 2 is the first: the clock reaches zero at the top of that attempt, the '
            + 'volatile is removed BEFORE the self-hit roll is even asked, and the Swords Dance goes '
            + 'through — so an engine that rolled first would deal one hit too many and part on HP '
            + 'and on the stage together. The partner is the second and is never confused.',
    A: [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'confuseray', t: 0 }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* ------------------------------------------------------------ 3. Lum Berry against confusion */
  { id: 'lum-berry-eats-a-confusion',
    arm: 'top-tie-first',
    kind: 'item', shape: 'a berry consumed by a VOLATILE rather than by a status',
    what: 'Snorlax holds a Lum Berry (212 uses) and is aimed at with Confuse Ray. Showdown\'s Lum is '
        + 'an `onUpdate` that fires on `pokemon.status || pokemon.volatiles["confusion"]`, and its '
        + '`onEat` calls BOTH `cureStatus()` and `removeVolatile("confusion")` — so the berry is '
        + 'spent, the item leaves the board, and the confusion never gets a single turn. THREE '
        + 'compared fields move together: the item, the volatile and the body\'s HP staying untouched.',
    negative: 'the PARTNER holds a Lum Berry too and is never aimed at, so its berry must still be on '
            + 'the board at every boundary. An engine that ate the berry on sight, or that ate it for '
            + 'the wrong body, parts there.',
    A: [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', 'Lum Berry', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', 'Lum Berry', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'confuseray', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* ------------------------------------------------------- 4. Persim Berry, which cures ONLY this */
  { id: 'persim-berry-eats-a-confusion',
    arm: 'top-tie-first',
    kind: 'item', shape: 'a berry whose WHOLE effect is the confusion volatile',
    what: 'Snorlax holds a Persim Berry (2 uses) and Corviknight beside it holds one too. Persim has '
        + 'no `curesStatus` handler at all — its `onUpdate` tests only `volatiles["confusion"]` — so '
        + 'it is the sharpest separation available between "cures a status" and "cures this volatile".',
    negative: 'THE PARALYSIS IS THE NEGATIVE AND IT IS ON THE SAME BOARD. Milotic clicks Nuzzle at '
            + 'Corviknight on turn 2, which is a guaranteed paralysis at 100 accuracy: a Persim Berry '
            + 'must NOT be spent on a major status, so Corviknight has to end the game paralysed and '
            + 'STILL HOLDING ITS BERRY. An engine that treated Persim as a Lum parts there, and that '
            + 'is the exact over-match this berry invites.',
    A: [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Nuzzle', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', 'Persim Berry', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', 'Persim Berry', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'confuseray', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'nuzzle', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ] },

  /* ------------------------------------------------------------------- 5. Own Tempo refuses it */
  { id: 'owntempo-refuses-the-confusion',
    arm: 'top-tie-first',
    kind: 'ability', shape: 'an ability that refuses ONE volatile',
    what: 'Mudsdale carries Own Tempo (64 uses), whose whole handler is `onTryAddVolatile(status) '
        + '{ if (status.id === "confusion") return null; }`. Confuse Ray is aimed at it on turn 1 and '
        + 'must do nothing at all.',
    negative: 'THE PARTNER IS THE NEGATIVE AND IT IS ON THE SAME BOARD: Snorlax has Thick Fat, is '
            + 'aimed at with the identical Confuse Ray on turn 2, and MUST be confused. A refusal '
            + 'that over-matched — the standing hazard in this repository — suppresses both and '
            + 'parts there rather than on turn 1.',
    A: [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('mudsdale', '', 'Own Tempo', ['Swords Dance', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'confuseray', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'confuseray', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
    ] },

  /* ================= THE TWO THE ROSTER COULD NOT STAGE, AND THE ARM THAT STAGES THEM ==========
   * `bottom-tie-first` is not a preference. Nothing at 100 accuracy burns or freezes in this format,
   * so under the primary arm the roster's status entries are COULD-NOT-STAGE by construction. In
   * this arm every sub-100 move HITS and every secondary FIRES, which is the only way a Will-O-Wisp
   * lands or an Ice Beam freezes. Damage is at the MINIMUM roll and every crit lands, in both
   * engines alike.
   * ========================================================================================== */

  /* ------------------------------------------------------------------ 6. burn — CONFIRM, not fix */
  { id: 'burn-halves-the-physical-hit',
    arm: 'bottom-tie-first',
    kind: 'status', shape: 'burn, and the three bodies it must NOT halve',
    what: 'THE HALVING ITSELF IS ALREADY PROVEN — tests/test-damage-stages.js runs 1,728 of 1,728 '
        + 'exact against Showdown\'s own moveHit with burn x0.5 inside it. WHAT WAS NEVER STAGED IS '
        + 'THE STATUS: Will-O-Wisp is 85-accurate and the primary pin makes it miss, so no board in '
        + 'this repository has ever carried a burn. Here it lands. Milotic clicks Will-O-Wisp at '
        + 'Snorlax on turn 1; Snorlax then clicks Body Slam, a physical move, into Clefable for two '
        + 'turns, and the HP on the board is what says whether the halving happened.',
    negative: 'THREE, and each is a different reason a burn does not halve. (a) INCINEROAR IS A FIRE '
            + 'TYPE and is aimed at with the same Will-O-Wisp on turn 2 — it cannot be burned at all, '
            + 'so it must read no status on every board. (b) FACADE IS EXEMPT: the burned Snorlax '
            + 'clicks Facade on turn 3 instead of Body Slam, and Showdown\'s Facade both doubles its '
            + 'power and skips the halving, so an engine applying x0.5 there deals about a quarter of '
            + 'the right damage. (c) The partner Corviknight is never aimed at and is never burned.',
    A: [mon('milotic', '', 'Marvel Scale', ['Will-O-Wisp', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', '', 'Thick Fat', ['Body Slam', 'Facade', 'Protect']),
        mon('incineroar', '', 'Blaze', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'corviknight')),
    /* CLEFABLE CLICKS CALM MIND AND NOT PROTECT, and the first version of this scenario got that
     * wrong in the one way the fixture audit says it cannot see: a click aimed INTO A PROTECT. With
     * Clefable shielding, every Body Slam and the Facade were blocked — the burn landed, the boards
     * agreed, and the HALVING under test was never once computed. Measured rather than reasoned:
     * Clefable sat on 170 of 170 HP at every boundary of all three turns. */
    script: [
      { p1: [{ m: 'willowisp', t: 0, mayMiss: 'the burn IS the mechanic and this arm lands it' }, { m: 'calmmind' }],
        p2: [{ m: 'bodyslam', t: 1 }, { m: 'irondefense' }] },
      { p1: [{ m: 'willowisp', t: 1, mayMiss: 'aimed at a FIRE type — the refusal is the negative' }, { m: 'calmmind' }],
        p2: [{ m: 'bodyslam', t: 1 }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'calmmind' }], p2: [{ m: 'facade', t: 1 }, { m: 'irondefense' }] },
    ] },

  /* ---------------------------------------------- 7. guts — the OTHER body a burn does not halve */
  { id: 'guts-is-not-halved-by-its-own-burn',
    arm: 'bottom-tie-first',
    kind: 'ability', shape: 'the ability that inverts the burn',
    what: 'Conkeldurr has GUTS, which turns a burn into a x1.5 Attack multiplier AND skips the x0.5 '
        + 'halving. Milotic burns it on turn 1 and it clicks Drain Punch into the Snorlax opposite on '
        + 'all three turns; the HP on that body is the whole reading.',
    negative: 'THE PARTNER IS THE NEGATIVE AND IT IS ON THE SAME BOARDS. Scizor is burned by the same '
            + 'Milotic on turn 2 and has TECHNICIAN rather than Guts, so the identical status must '
            + 'halve its Bullet Punch and must not raise its Attack. Both bodies are burned and only '
            + 'one is exempt, which is the separation a single-body scenario cannot make. Scizor also '
            + 'aims at the OTHER slot, so the two damage arms are read off two different bodies and '
            + 'cannot be confused with each other.',
    A: [mon('milotic', '', 'Marvel Scale', ['Will-O-Wisp', 'Calm Mind', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('conkeldurr', '', 'Guts', ['Drain Punch', 'Protect']),
        mon('scizor', '', 'Technician', ['Bullet Punch', 'Protect'])].concat(FILL('toxapex', 'corviknight')),
    /* THE TWO ATTACKERS AIM AT DIFFERENT BODIES, AND NEITHER TARGET MAY PROTECT OR DIE. The first
     * version pointed both at one Clefable, which duly FAINTED on turn 2 -- and a faint in a scripted
     * game is not a finding, it is a THROW: the replacement carries a different moveset, the scripted
     * click is answered `pass`, and Showdown rejects a pass for a healthy active body. The version
     * before that had the target on Protect, so both damage arms read zero. Both are staging faults
     * and both looked like results. */
    script: [
      { p1: [{ m: 'willowisp', t: 0, mayMiss: 'the burn IS the mechanic and this arm lands it' }, { m: 'calmmind' }],
        p2: [{ m: 'drainpunch', t: 1 }, { m: 'bulletpunch', t: 0 }] },
      { p1: [{ m: 'willowisp', t: 1, mayMiss: 'the second burn, on the body WITHOUT Guts' }, { m: 'calmmind' }],
        p2: [{ m: 'drainpunch', t: 1 }, { m: 'bulletpunch', t: 0 }] },
      { p1: [{ m: 'calmmind' }, { m: 'calmmind' }],
        p2: [{ m: 'drainpunch', t: 1 }, { m: 'bulletpunch', t: 0 }] },
    ] },

  /* ------------------------------------------------------- 8. freeze — the counter nobody compared */
  { id: 'freeze-counter-is-on-the-board',
    arm: 'bottom-tie-first',
    kind: 'status', shape: 'frz, and the timer this format overrides',
    what: 'Champions OVERRIDES `frz` (data/mods/champions/conditions.ts): the freeze is a THREE-TURN '
        + 'TIMER with an additional 1-in-4 thaw per move attempt, not standard Gen 9 freeze. Milotic '
        + 'clicks Ice Beam at TINKATON; in this arm the 10% secondary fires and the body is frozen. '
        + 'THE POINT IS THE COMPARED FIELD RATHER THAN THE DURATION: until this pass `board_state.js` '
        + 'mentioned `frz` only in a display-name map, so `frzTurns` could drift by any amount and no '
        + 'instrument in the repository would have seen it. The plant below is what proves it now can.\n'
        + '            THE TARGET IS THE FASTER BODY ON PURPOSE, and the first version of this scenario '
        + 'got it wrong in exactly the way the fixture audit cannot see. Aimed at Snorlax (50 Speed) '
        + 'the freeze landed and was GONE before the boundary — this pin reads `randomChance(1,4)` at '
        + 'the bottom of the range, so the very next attempt thaws — and the two boards agreed over a '
        + 'field neither of them was carrying. Tinkaton, at 152 Speed to Milotic\'s 101, moves '
        + 'BEFORE the Ice Beam and reaches the boundary still frozen, so the counter sits on a real '
        + 'board. CORVIKNIGHT WAS TRIED FIRST AND WAS NOT FAST ENOUGH, and the pinned log is what '
        + 'said so: the 1-in-4 thaw roll fired on turn 1, which can only happen if the frozen body '
        + 'moved AFTER the freeze landed. Steel halves Ice so Tinkaton survives the hit; the obvious '
        + 'fast target, an ICE type, cannot be frozen at all.',
    negative: 'the partner Snorlax is never aimed at and is never frozen. And the arm itself is the '
            + 'second negative: the thaw is guaranteed on the next attempt here, so the board must '
            + 'show the freeze APPEARING and then LEAVING — an engine that held it parts on turn 2.',
    plant: { why: 'the freeze counter is started at 1 instead of 0 — the status, the thaw and every '
                + 'other field are untouched, so ONLY the counter moves. Before `frzTurns` was added '
                + 'to the compared board this plant was INVISIBLE, which is the whole finding.',
      patch: [["if(st==='slp')t.slpTurns=0;if(st==='frz')t.frzTurns=0;",
               "if(st==='slp')t.slpTurns=0;if(st==='frz')t.frzTurns=1;"]] },
    A: [mon('milotic', '', 'Marvel Scale', ['Ice Beam', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('tinkaton', '', 'Mold Breaker', ['Iron Defense', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'icebeam', t: 0 }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'swordsdance' }] },
    ] },
];

/* ---- ONE RUN, WITH THE ARM NAMED ---------------------------------------------------------------
 * The body of this is `staged_board.js`'s own `runOne` with two changes: the arm is passed through
 * to `playGame`, and the source is a parameter so the same scenario can be played over the frozen
 * release and over the live tree in one process. */
function runOne(sc, src, armId) {
  let G;
  useLiveTags(src != null);          // the AFTER arm reads the live artifact; the BEFORE arm the frozen one
  try { G = SB.harness(src); }
  catch (e) { return { id: sc.id, verdict: 'THREW', why: 'the simulator source would not load: ' + e.message }; }
  const arm = G.ARM_BY_ID.get(armId || 'top-tie-first');
  if (!arm) return { id: sc.id, verdict: 'THREW', why: 'no such pin arm: ' + armId };
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { id: sc.id, verdict: 'NOT-STAGED',
    why: 'buildPair returned null for ' + (!a ? 'side A' : 'side B') + ' — the scenario never ran' };

  const boards = [];
  const r = G.playGame(a, b, 'directed', 'status:' + sc.id, {
    script: sc.script, arm,
    /* ---- THE PP HOLD IS LIFTED HERE, 2026-08-11 (ROADMAP #206/#207) -----------------------------
     *
     * ROADMAP #206's defect families are closed and this instrument was RE-RUN WITH PP COMPARED
     * before the line was deleted. It went from three scenarios parting on PP alone --
     * `pivot-then-the-slot-is-hit` pp.charm, `allyswitch-follows-the-slot` pp.crunch,
     * `roar-drags-whoever-is-standing-there` pp.roar, every one of them off by one in the same
     * direction -- to CLEAN. All three were ONE defect and it is the second half of the target-class
     * work: Pressure was priced off the body the click NAMED instead of the body standing in the slot
     * when the move ran, which is what `getMoveTargets` inside `useMoveInner` answers. The engine
     * already re-aimed the EFFECT through `reaimToSlot`; it now prices the PP off the same call.
     *
     * SO THIS FILE NOW ASKS, and `board_state.js` no longer stamps `pp_comparable.held_by_the_caller`
     * on its snapshots -- which is the whole difference between a run that compared PP and one that
     * did not. `tests/roster.js` still holds it, for a reason written at its own call site.
     */
    onBoundary: (snap, turnIdx) => {
      boards.push({ turn: turnIdx, compared: snap.leaves_compared,
                    diffs: snap.diffs.map(d => BS.locate(d, snap)) });
      snap.identical = true; snap.diffs = [];      // see staged_board.js runOne — a red turn 1 must not hide turn 2
    } });

  if (r.err) return { id: sc.id, verdict: 'THREW', why: r.err, boards };
  if (r.turns !== sc.script.length) return { id: sc.id, verdict: 'SHORT', boards,
    why: 'the script declares ' + sc.script.length + ' turn(s) and ' + r.turns + ' were played' };
  if (boards.length !== sc.script.length + 1) return { id: sc.id, verdict: 'SHORT', boards,
    why: boards.length + ' boundaries taken, ' + (sc.script.length + 1) + ' expected' };
  if (boards.some(x => !x.compared)) return { id: sc.id, verdict: 'SHORT', boards,
    why: 'a boundary compared ZERO leaves — the state path is not armed' };
  for (const bd of boards) bd.unexplained = bd.diffs;
  const unexplained = boards.reduce((n, x) => n + x.diffs.length, 0);
  const compared = boards.reduce((n, x) => n + x.compared, 0);
  return { id: sc.id, boards, compared, unexplained,
           verdict: unexplained ? 'DIFFERS' : 'IDENTICAL' };
}

function plantedSource(sc, src) {
  if (!sc.plant) return null;
  let out = src;
  for (const [find, repl] of sc.plant.patch) {
    const n = out.split(find).length - 1;
    if (n !== 1) return { error: 'the anchor matched ' + n + ' time(s), not exactly once — an '
      + 'unapplied plant reads exactly like a comparator that found nothing. Anchor: ' + find.slice(0, 90) };
    out = out.replace(find, repl);
  }
  return { src: out };
}

function say(d, v) {
  if (d.field === 'party.MISSING-OR-EXTRA-MEMBER')
    return SB.pretty(d.body) + (v ? ' is on the team' : ' is NOT on the team');
  return BS.explain(d, v, SB.pretty);
}
function printRun(res, P) {
  if (!res.boards) { console.log(P + res.verdict + ' — ' + res.why); return; }
  for (const bd of res.boards) {
    const ok = bd.compared - bd.diffs.length;
    console.log(P + (bd.turn === 0 ? 'the leads' : 'end of turn ' + bd.turn).padEnd(14)
      + ok + ' of ' + bd.compared + ' fields identical'
      + (bd.diffs.length ? '   — and these do not agree:' : ''));
    for (const d of bd.diffs) {
      console.log(P + '   SHOWDOWN  ' + say(d, d.sd));
      console.log(P + '   OURS      ' + say(d, d.us)
        + '        [' + (d.slot || d.side || 'field') + ' ' + d.field + ' / ' + d.bucket + ']');
    }
  }
}

function main() {
  const chosen = SCENARIOS.filter(s => !ONLY || s.id === ONLY);
  if (!chosen.length) { console.log('no scenario matches --only ' + ONLY); return 2; }

  console.log('\nSTAGED STATUS COUNTERS — Showdown is the expectation; no scenario declares a result.');
  console.log('  the FROZEN RELEASE is the BEFORE arm and the LIVE tree is the AFTER arm.');

  const fx = SB.fixtureAudit(chosen);
  console.log('\n  THE FIXTURE AUDIT (tests/staged_board.js\'s own), every scripted click:');
  for (const p of SB.auditProof()) console.log('    ' + (p.ok ? 'ok   ' : 'FAIL ') + p.id);
  if (fx.length) {
    for (const f of fx) console.log('    ' + f);
    console.log('    THE SCENARIOS ARE WRONG. Refusing to play them.');
    return fx.length;
  }
  console.log('    all ' + chosen.reduce((n, s) => n + s.script.length * 4, 0)
    + ' clicks are carried by the body that clicks them, and each is either a guaranteed hit or '
    + 'declares mayMiss.');

  let bad = 0;
  const out = [];
  for (const sc of chosen) {
    console.log('\n' + sc.id + '   (' + sc.kind + ' / ' + sc.shape + ')   pin arm: ' + sc.arm
      + (sc.isControl ? '   [CONTROL]' : '') + (sc.control ? '   control: ' + sc.control : ''));
    console.log('  staged:   ' + sc.what);
    console.log('  negative: ' + sc.negative);
    const before = runOne(sc, null, sc.arm);
    const after = runOne(sc, LIVE_SRC, sc.arm);
    console.log('  FROZEN RELEASE -> ' + before.verdict);
    printRun(before, '    ');
    console.log('  LIVE TREE      -> ' + after.verdict);
    printRun(after, '    ');

    let verdict;
    if (after.verdict !== 'IDENTICAL') { verdict = 'RED — the live engine still parts'; bad++; }
    else if (before.verdict === 'IDENTICAL') verdict = 'ALREADY-CORRECT — no red preceded this';
    else verdict = 'FIXED — red on the release, identical on the live tree';
    console.log('  => ' + verdict);

    let planted = null;
    if (sc.plant) {
      const p = plantedSource(sc, LIVE_SRC);
      if (p.error) { console.log('  PLANT NOT APPLIED: ' + p.error); bad++; }
      else {
        planted = runOne(sc, p.src, sc.arm);
        const fields = planted.boards
          ? [...new Set(planted.boards.flatMap(b => b.diffs.map(d => d.field)))] : [];
        console.log('  PLANTED BREAK  -> ' + planted.verdict + '   (' + sc.plant.why + ')');
        if (planted.verdict === 'DIFFERS' && fields.length)
          console.log('    CAUGHT AND LOCALISED — the plant moved: ' + fields.join(', '));
        else { bad++; console.log('    NOT CAUGHT — the comparator cannot see this field, so the '
          + 'green above is vacuous.'); }
      }
    }
    out.push({ id: sc.id, arm: sc.arm, isControl: !!sc.isControl, control: sc.control || null,
               before: before.verdict, after: after.verdict, verdict,
               planted: planted ? planted.verdict : null,
               diffs_after: (after.boards || []).flatMap(b => b.diffs.map(d => ({
                 turn: b.turn, slot: d.slot, body: d.body, field: d.field,
                 showdown: d.sd, ours: d.us, bucket: d.bucket }))) });
  }

  /* THE CONTROL RULE, ENFORCED RATHER THAN DESCRIBED: a scenario that names a control is only
   * evidence if that control was GREEN ON THE RELEASE. A control that is also red means the two
   * boards part for a reason the scenario does not name. */
  console.log('\nTHE CONTROLS');
  for (const o of out.filter(x => x.control)) {
    const c = out.find(x => x.id === o.control);
    if (!c) { console.log('  ' + o.id + ': its control ' + o.control + ' was not run — no verdict'); continue; }
    const clean = c.before === 'IDENTICAL';
    console.log('  ' + (clean ? 'ok   ' : 'FAIL ') + o.id + ' rests on ' + c.id
      + ', which is ' + c.before + ' on the release'
      + (clean ? ' — so the red above is the named cause and nothing else'
               : ' — SO THE RED ABOVE IS NOT EVIDENCE. Both boards part for an unnamed reason.'));
    if (!clean) bad++;
  }

  console.log('\nSUMMARY');
  for (const o of out) console.log('  ' + o.id.padEnd(36) + o.arm.padEnd(18)
    + ('release ' + o.before).padEnd(20) + 'live ' + o.after);
  if (JSONOUT) console.log('\n' + JSON.stringify(out, null, 1));
  return bad;
}

module.exports = { SCENARIOS, runOne };

if (require.main === module) process.exit(main() ? 1 : 0);
