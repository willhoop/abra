/* staged_board.js — A MECHANIC IS TESTED BY PLAYING THE SAME TURN IN BOTH ENGINES AND COMPARING
 * THE WHOLE BOARD. NOBODY WRITES DOWN WHAT SHOULD HAPPEN.
 *
 *   SHOWDOWN_PATH=... node tests/staged_board.js               every scenario, clean
 *   SHOWDOWN_PATH=... node tests/staged_board.js --reds         clean AND under each declared break
 *   SHOWDOWN_PATH=... node tests/staged_board.js --only fakeout-flinch
 *   SHOWDOWN_PATH=... node tests/staged_board.js --list
 *   SHOWDOWN_PATH=... node tests/staged_board.js --json
 *
 * ================= WHY THIS EXISTS, AND WHY IT IS NOT A SECOND COPY OF THE CENSUS ================
 *
 * `tests/test-mechanics.js` writes `data/mechanics-census.json` — 294 behavioural probes, 293 live.
 * It is the only trustworthy inventory this project has and it is still the weaker instrument, for
 * two reasons that no amount of adding probes fixes.
 *
 * 1. A PROBE PROVES A MECHANIC FIRES. IT DOES NOT PROVE IT FIRES CORRECTLY. Every defect found on
 *    2026-08-07 was a mechanic that fired and was wrong anyway: Black Glasses applied at the wrong
 *    damage STAGE, Fairy Aura reaching nothing while its tag read `used:false`, Zero to Hero firing
 *    at the wrong MOMENT (Showdown transforms Palafin on switch-OUT; this engine does it on the
 *    return). The census passed, or could not see, all three.
 *
 * 2. EVERY PROBE CARRIES A HAND-WRITTEN EXPECTED ANSWER, AND THAT ANSWER CAN BE WRONG THE SAME WAY
 *    THE CODE IS. Demonstrated on 2026-08-07: ROADMAP #81 WIRE 7 moved the Substitute doll from
 *    `floor` to `ceil` quoting Showdown, and Showdown's own `data/moves.ts:18328` says `Math.floor`.
 *    The probe that wire wrote ASSERTED THE MISQUOTE AND WENT GREEN ON IT. A test that carries its
 *    own expected value is exactly as fallible as its author, and this project has been wrong that
 *    way about twenty-seven times.
 *
 * SO THE TYPED ANSWER IS REMOVED ENTIRELY. A scenario here declares three things — the two teams,
 * the script of clicks, and prose saying what is being staged. It declares NOTHING about what should
 * result. Both engines play the identical turns under the existing pin, the board is read out of
 * both at every turn boundary, and SHOWDOWN IS THE EXPECTATION.
 *
 * Will, 2026-08-07: *"IF THE BOARDS ARE THE SAME WE KNOW THAT IT DID HAPPEN CORRECTLY THATS THE
 * WHOLE POINT"* and *"IF WE MAKE IT HAPPEN ON SHOWDOWN THEN WE CAN ALWAYS TEST IT AGAINST MEDICHAM
 * AND THAT FIXES THE THIRD OUTCOME"*.
 *
 * The side effect is the point as much as the main effect: 131 fields are compared, not the one the
 * probe author thought of. Staging Fake Out to look at the flinch ALSO catches it if that same turn
 * quietly broke an item, a boost, a clock or the speed order.
 *
 * ================= MULTI-TURN IS REQUIRED, NOT OPTIONAL ==========================================
 *
 * Will's own examples are two-turn by nature. Fake Out flinches on turn 1 and MUST FAIL on turn 2.
 * Trick Room is set on turn 1 and the order reverses on turn 2. A single-turn harness cannot express
 * either, and a mechanic that fires unconditionally passes any test that only checks the positive.
 *
 * SO EVERY SCENARIO CARRIES ITS NEGATIVE, and `negative:` names it in prose. What the negative means
 * here is subtler than "assert nothing happened", and it is worth stating because it is the one place
 * the no-typed-answer rule could be misread: THE NEGATIVE TURN IS COMPARED EXACTLY LIKE THE POSITIVE
 * ONE. Showdown answers both. The negative earns its place by being a turn on which the mechanic MUST
 * NOT fire, so an engine that fires it unconditionally parts from the authority there — and if it
 * fires correctly on both, the same 131-field comparison says so without anybody typing a zero.
 *
 * ================= WHAT COUNTS AS A PASS, AND WHAT NEVER DOES ====================================
 *
 * This project's signature failure is a capability that is absent while everything reports success,
 * so the ways this file can silently not-run are enumerated and every one of them is a FAILURE:
 *
 *   NOT-STAGED     `buildPair` returned null. The scenario never ran. Not a pass.
 *   THREW          the driver threw (a rejected choice, an illegal click). Not a pass, and NOT a
 *                  finding about the engine either — it is this file's fixture being wrong.
 *   SHORT          fewer turns were played than the script declares, or fewer boundaries were taken
 *                  than turns+1. A scripted game that ends early has stopped testing and looks
 *                  exactly like one that agreed. Not a pass.
 *   STALE-ALLOW    a declared divergence matched nothing. A deliberate exception that is no longer
 *                  there is a claim that has quietly become false; same discipline as the directed
 *                  table's `expect: 'agree'`.
 *
 * ================= THE DECLARED DIVERGENCE ======================================================
 *
 * A scenario may declare a difference it expects, WITH A WRITTEN REASON, the way the protocol side
 * keeps its declared-not-emitted list. The default is that any difference fails. A declared one is
 * still printed on every run, so it cannot fade into the background.
 *
 * ONE LIMITATION, SAID OUT LOUD BECAUSE IT CHANGES WHAT A DECLARED DIVERGENCE COSTS: the driver's
 * own stop rule ends a state-mode game at the first divergent board. This file neutralises the
 * snapshot AFTER copying its diffs (see `runOne`) so that a red turn 1 does not hide turn 2 —
 * without that, every multi-turn scenario would stop being multi-turn the moment it found anything.
 * The neutralisation touches only the object handed to the hook; neither engine is affected.
 *
 * ================= HOW A MECHANIC IS BROKEN FOR THE RED DEMONSTRATION ============================
 *
 * A comparator that has never been shown catching the thing it is trusted on is not evidence — the
 * reason `board_state.js` has a planted proof and the Lightning Rod probe has a PART B. So every
 * scenario carries `break:`, a NAMED SURGICAL PATCH to the simulator's own source, applied IN MEMORY
 * to the frozen release's bytes and never written to disk. `tests/mutation_harness.js` already plants
 * stubs this way and defends the technique; the difference is that this file's patches are aimed at
 * one mechanic each and the observable is the BOARD rather than a projection digest.
 *
 * A PATCH ANCHOR THAT DOES NOT MATCH EXACTLY ONCE IS A FAILURE, never a skip. An unapplied plant
 * reads exactly like a comparator that found nothing.
 *
 * IT READS A FROZEN RELEASE. ENGINE may be rewriting `engine/medicham2-browser.js` while this runs;
 * that is the point of the divisions and it is only safe because the bytes here come out of a
 * snapshot. The release id is printed with every run.
 *
 * ================= THE TEAMS ARE FIXTURES, NOT SETS =============================================
 *
 * Moves here are assigned for staging and are not learnset-checked, exactly as the directed table in
 * `engine/game_differential.js` does (its `TAKE_IT = 'Agility'` is handed to a Snorlax, which does
 * not learn it). Both engines receive the IDENTICAL set, so nothing about the comparison depends on
 * legality. Nothing in this file is a recommendation and no set here should be copied into one.
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

/* THE DRIVER READS ITS OWN FLAGS OFF argv AT MODULE LOAD, so the state path must be armed before
 * `game_differential.js` is required. Without it no board is ever read and every scenario below
 * reports "identical" over zero compared fields — the silent-zero shape. Asserted after the load. */
if (!process.argv.includes('--state')) process.argv.push('--state');

const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const HAS = (n) => process.argv.includes(n);
const ONLY = ARG('--only');
const REDS = HAS('--reds');
const JSONOUT = HAS('--json');
const LIST = HAS('--list');

const BS = require(D('engine', 'board_state.js'));
/* THE SAME FLAG THE DRIVER READS, so this file and `game_differential.js` cannot end up holding two
 * different releases — one patching the bytes of release X while the other plays release Y would be
 * invisible and would make every red demonstration meaningless. */
const REL = require(D('engine', 'engine_release.js')).open(ARG('--release') || null);

/* A RELEASE CAN BE CUT OVER A FILE THAT IS BEING REWRITTEN, AND THE RESULT IS A VALID DIGEST SET
 * THAT IS NOT A LOADABLE ENGINE. Measured 2026-08-07 while this file was being built: release
 * 4b1887a601d9 holds a ZERO-BYTE `data/tags.json`, frozen mid-`tag_dex` run by a division working
 * beside this one. `open()` with no id takes the NEWEST release, so a run started a second later
 * died inside the engine's own loader with a JSON parse error and no hint that the snapshot rather
 * than the code was at fault. CLAUDE.md records this exact shape twice already ("a valid DIGEST SET
 * turned out not to be a loadable engine"), so it is named here rather than left to a stack trace.
 * The FIX belongs to whoever owns engine_release.js; what belongs here is refusing to run. */
/* AND THE LIVE `data/tags.json` IS READ TOO, BY THE DRIVER, THROUGH `engine/names.js` — so the same
 * mid-write window kills a run that pinned a perfectly good release. Both are checked, and the
 * message says WHICH copy was bad, because "pin a release" is the answer to one of them and not to
 * the other. */
for (const [what, read] of [['the release ' + REL.id, () => REL.read('data/tags.json')],
                            ['the LIVE tree', () => require('fs').readFileSync(D('data', 'tags.json'), 'utf8')]]) {
  let db = null, why = 'it parsed but carries no `moves`/`items`';
  /* THE REASON IS KEPT AND PRINTED. `catch (e) {}` here was flagged by tests/test-no-silent-failure.js
   * and it was right to flag it: the block below says "empty or unparseable" and, without this, could
   * not say WHICH — a truncated write and a zero-byte file are different accidents with different
   * answers, and the parse error names the byte offset. */
  try { db = JSON.parse(read() || 'null'); } catch (e) { db = null; why = e.message; }
  if (!db || !db.moves || !db.items) {
    console.log('NOT RUN — data/tags.json in ' + what + ' is empty or unparseable: ' + why);
    console.log('  A snapshot can be CUT, and the live tree can be READ, while `tag_dex.js` is part way'
      + ' through rewriting that file.\n  Measured 2026-08-07: release 4b1887a601d9 holds a ZERO-BYTE'
      + ' data/tags.json, frozen mid-run by a division\n  working beside this one, and the live copy was'
      + ' unparseable for roughly two minutes at the same time.\n  This is not a pass and it is not a'
      + ' finding about the engine. Re-run; pin with --release <id> if the snapshot was the bad one.');
    process.exit(2);
  }
}
const MEDI_REL = 'engine/medicham2-browser.js';
const MEDI_PATH = REL.path(MEDI_REL);
const CLEAN_SRC = REL.read(MEDI_REL);
const GD_PATH = D('engine', 'game_differential.js');

/* ---- THE HARNESS, LOADABLE OVER A PATCHED SIMULATOR ---------------------------------------------
 * `game_differential.js` binds its engine once, at module load, with `REL.require(...)`. To play a
 * scenario against a deliberately broken simulator the patched bytes have to be sitting in the
 * require cache under the SNAPSHOT'S OWN FILENAME before the driver is loaded — compiling them under
 * any other name would pair patched engine source with a differently-resolved `./tags.js`, which is
 * the mistake mutation_harness.js records in its own header. */
let _cur = '';                 // '' = the shipped engine
let _G = null;
function harness(src) {
  const key = src == null ? '' : 'patched:' + src.length + ':' + hash(src);
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
  /* the driver narrates its steering and its team pool on every load; that belongs on the FIRST
   * load and would be noise on the twelfth */
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }

/* THE AUTHORITY'S OWN DISPLAY NAMES. `BS.explain` takes `pretty` as a parameter rather than a
 * require, deliberately, so that this instrument cannot grow a second naming table beside the dex. */
const CS = require(D('engine', 'champions_sim.js'));
const _dex = CS.sim().Dex.forFormat(CS.FORMAT);
function pretty(x) {
  const s = String(x || '');
  if (!s) return s;
  for (const g of [_dex.species, _dex.items, _dex.moves, _dex.abilities]) {
    const e = g.get(s);
    if (e && e.exists) return e.name;
  }
  return s;
}

/* ---- SCENARIO SUGAR ----------------------------------------------------------------------------- */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* =================================================================================================
 *  THE SCENARIOS
 *
 *  Each declares: the two teams, the script, prose saying what is staged and where its NEGATIVE is,
 *  and a named break for the red demonstration. NONE of them declares an expected value.
 *
 *  `census` names the row in data/mechanics-census.json this scenario is the staged equivalent of,
 *  so the two verdicts can be read against each other. It is a cross-reference and nothing here
 *  branches on it.
 * ================================================================================================= */
const SCENARIOS = [

  /* ---------------------------------------------------------------------------- 1. move / flinch */
  { id: 'fakeout-flinch',
    kind: 'move', shape: 'damage (by consequence)',
    census: 'move/flinches — "Fake Out stops the foe attacking"',
    what: 'Incineroar clicks Fake Out at Snorlax, which has clicked Body Slam back at it.',
    negative: 'turn 2 — Incineroar clicks Swords Dance instead, so nothing flinches Snorlax and its '
            + 'Body Slam must land. A flinch that persisted, or one applied every turn, parts here.',
    residue: 'THE FLINCH ITSELF IS NEVER ON THE BOARD, AND IT DOES NOT NEED TO BE. `_flinch` is set '
           + 'and consumed inside one turn — medicham2-browser.js:76 records that FOUR PROBES failed '
           + 'to see it from outside and concludes "the instrument had to be inside the engine; there '
           + 'was no probe that could have worked from outside". MEASURED HERE, 2026-08-07: with the '
           + 'flinch stopped being honoured, the two boards part by 69 HP on Incineroar at the end of '
           + 'turn 1 and stay parted. The CAUSE vanishes at the end of the turn; the EFFECT — a body '
           + 'that did not act, so damage that was never dealt — is on the board and stays there. '
           + 'That answer generalises to every within-turn mechanic whose consequence is damage, a '
           + 'boost or a faint, which is most of them.',
    A: [mon('incineroar', '', 'Blaze', ['Fake Out', 'Swords Dance', 'Protect']),
        mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(FILL('clefable', 'garchomp')),
    B: [mon('snorlax', '', 'Thick Fat', ['Body Slam', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'weavile')),
    script: [
      { p1: [{ m: 'fakeout', t: 0 }, { m: 'protect' }], p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] },
    ],
    break: { why: 'the engine stops HONOURING a flinch: the body that was flinched takes its turn anyway',
      patch: [['if(m._flinch){m._flinch=false;m._mvRes=false;',
               'if(false&&m._flinch){m._flinch=false;m._mvRes=false;']] } },

  /* ------------------------------------------------------------------------ 2. move / field, order */
  { id: 'trickroom-order',
    kind: 'move', shape: 'field + turn order',
    census: 'move/reversesSpeed — "Trick Room lets the slow user move first"',
    what: 'Clefable sets Trick Room on turn 1 while Weavile (187 Speed) attacks Incineroar (80 Speed); '
        + 'on turn 2 Incineroar swings back and the reversed order decides whether Weavile ever gets '
        + 'to act again. THE ORDER HAS TO CHANGE THE BOARD OR THE SCENARIO IS INERT — Incineroar is '
        + 'at +2 and its Fighting move is 4x on Weavile, so moving first means Weavile deals nothing.',
    negative: 'turn 1 is the negative — Trick Room is not up yet when the choices resolve, so the FAST '
            + 'body must move first. An engine that reversed the order a turn early parts there. The '
            + 'clock is also on the board, so an expiry that runs long or short parts too.',
    A: [mon('incineroar', '', 'Blaze', ['Swords Dance', 'Close Combat', 'Protect']),
        mon('clefable', '', 'Unaware', ['Trick Room', 'Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('weavile', '', 'Pressure', ['Night Slash', 'Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'garchomp')),
    script: [
      { p1: [{ m: 'swordsdance' }, { m: 'trickroom' }], p2: [{ m: 'nightslash', t: 0 }, { m: 'irondefense' }] },
      { p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'nightslash', t: 0 }, { m: 'irondefense' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ],
    break: { why: 'Trick Room no longer reverses the order — the field flag is still set and read, and '
                + 'the comparison it feeds is inverted back to normal',
      patch: [['if(field&&field.tr>0)sp=-sp;', 'if(false&&field&&field.tr>0)sp=-sp;']] } },

  /* ----------------------------------------------------------------------------- 3. move / boosts */
  { id: 'haze-clears-boosts',
    kind: 'move', shape: 'stat stages',
    census: 'move/clearsBoosts — "Haze wipes the boosts off both sides"',
    what: 'Garchomp climbs to +2 Attack on turn 1; Milotic clicks Haze on turn 2.',
    negative: 'turn 3 — Haze is clicked again into a board with no boosts left on it. A Haze that '
            + 'wrote a value instead of clearing one, or that failed to apply, parts there.',
    A: [mon('milotic', '', 'Marvel Scale', ['Haze', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('snorlax', 'corviknight')),
    B: [mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']),
        mon('weavile', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
      { p1: [{ m: 'haze' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'haze' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ],
    break: { why: 'Haze stops clearing anything — the tag is still read and the clear is skipped',
      patch: [['for(const x of [...actA,...actB])if(x&&!x.fainted&&x.boosts)x.boosts={at:0,df:0,sa:0,sd:0,sp:0,acc:0,eva:0};',
               '/* the clear itself, removed by tests/staged_board.js */;']] } },

  /* ------------------------------------------------------------------- 4. move / hazard + switch */
  { id: 'stealthrock-entry',
    kind: 'move', shape: 'side condition + switch-in',
    census: 'move/hazard — "Stealth Rock chips what comes in afterwards"',
    what: 'Garchomp sets Stealth Rock on turn 1; on turn 2 Weavile pivots out with U-turn and the '
        + 'replacement walks into the rocks.',
    negative: 'turn 1 is the negative — the bodies ALREADY on the field must take nothing when the '
            + 'layer goes down. An engine that chipped on the set, or chipped the wrong side, parts '
            + 'there before the switch ever happens.',
    A: [mon('garchomp', '', 'Rough Skin', ['Stealth Rock', 'Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('weavile', '', 'Pressure', ['U-turn', 'Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    /* THE PIVOT MUST NOT BE AIMED INTO A PROTECT. A blocked U-turn does not switch, so the body never
     * leaves, nothing walks into the rocks, and the scenario stages nothing while still reading
     * "identical". Garchomp clicks Swords Dance on turn 2 for exactly that reason. */
    script: [
      { p1: [{ m: 'stealthrock' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'uturn', t: 0 }, { m: 'irondefense' }] },
    ],
    break: { why: 'the entry hazard stops chipping the body that walks in — the layer is still laid '
                + 'and still counted, so only the CONSEQUENCE goes missing',
      patch: [['if(sf.hz.stealthrock){nx.curHP-=', 'if(false&&sf.hz.stealthrock){nx.curHP-=']] } },

  /* ------------------------------------------------------------------- 5. move / status + residual */
  /* THE STATUS SCENARIO IS PARALYSIS AND NOT A BURN, AND THE REASON IS THE PIN RATHER THAN A
   * PREFERENCE. Will-O-Wisp is 85-accurate, Toxic is 90 and Thunder Wave is 90; the driver's pin
   * makes every one of them MISS, so each stages nothing while still reading "identical". Nuzzle is
   * 100-accurate with a guaranteed paralysis and no duration to roll, which makes it the only status
   * in this class that is deterministic under the pin. The fixture audit is what refused the first
   * three versions of this scenario. */
  { id: 'nuzzle-paralysis',
    kind: 'move', shape: 'major status',
    census: 'move/inflictsParalysis — "Thunder Wave paralyses" / move/statusInflict',
    what: 'Milotic clicks Nuzzle at Snorlax, which paralyses whatever it connects with.',
    negative: 'turn 2 — the same Nuzzle is aimed at Garchomp, a Ground type, which an Electric move '
            + 'cannot touch at all. An engine that writes the status without asking about the type '
            + 'parts there, and so does one that re-statuses an already-paralysed body on turn 3.',
    A: [mon('milotic', '', 'Marvel Scale', ['Nuzzle', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('toxapex', 'corviknight')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect'])].concat(FILL('weavile', 'incineroar')),
    script: [
      { p1: [{ m: 'nuzzle', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'nuzzle', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'nuzzle', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
    ],
    break: { why: 'the engine refuses to write PARALYSIS specifically — every other status still '
                + 'applies, so this is one mechanic and not the status system',
      patch: [['function applyStatus(t,st,src){',
               "function applyStatus(t,st,src){if(st==='par')return false;"]] } },

  /* ---------------------------------------------------------------------------- 6. item / residual */
  { id: 'leftovers-residual',
    kind: 'item', shape: 'residual heal',
    census: 'item/passiveHeal — "Leftovers heals at end of turn"',
    what: 'Tyranitar sets sand on entry and chips both of the facing bodies every turn. Snorlax holds '
        + 'Leftovers; Milotic beside it holds nothing. Every click is a Protect, so nothing in this '
        + 'scenario rolls a die or deals move damage.',
    negative: 'the partner IS the negative and it is on the same board: a body with no item must not '
            + 'heal. The ORDER is also under test — a heal that ran before the chip leaves a '
            + 'full-HP body at less than full, and a heal that ran after leaves it at full.',
    A: [mon('tyranitar', '', 'Sand Stream', ['Protect']),
        mon('garchomp', '', 'Rough Skin', ['Protect'])].concat(FILL('corviknight', 'weavile')),
    B: [mon('snorlax', 'Leftovers', 'Thick Fat', ['Protect']),
        mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(FILL('clefable', 'toxapex')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ],
    break: { why: 'the passive heal is skipped — the item is still held and still on the board',
      patch: [["{const _ph=TAGS.param('item',m.item,'passiveHeal');",
               "{const _ph=null&&TAGS.param('item',m.item,'passiveHeal');"]] } },

  /* ------------------------------------------------------------------ 7. item / survival + removal */
  { id: 'focussash-survives',
    kind: 'item', shape: 'hp floor + item consumption',
    census: 'item/survivesFromFull — "Focus Sash leaves 1 HP from full"',
    what: 'Incineroar clicks Close Combat at a full-HP Weavile holding a Focus Sash. Fighting is 4x '
        + 'on a Dark/Ice body, so the hit is lethal several times over.',
    negative: 'turn 2 — the identical hit into the SAME body, now on 1 HP with the Sash spent. A Sash '
            + 'that saved twice, or one that saved from chipped HP, parts there.',
    A: [mon('incineroar', '', 'Blaze', ['Close Combat', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('weavile', 'Focus Sash', 'Pressure', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'garchomp')),
    script: [
      { p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the Sash stops holding the body at 1 HP — it is still held, still read, and no '
                + 'longer saves anything',
      patch: [["const _sv=TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull');",
               "const _sv=null&&(TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull'));"]] } },

  /* ------------------------------------------------------------------------- 8. item / damage type */
  { id: 'blackglasses-dark-only',
    kind: 'item', shape: 'damage multiplier',
    census: 'item/damageMultType — "Black Glasses raises Dark damage only"',
    what: 'Weavile holding Black Glasses clicks a DARK move at Snorlax on turn 1.',
    negative: 'turn 2 — the same body clicks a FIGHTING move at the same target. A type-scoped '
            + 'multiplier that leaked onto every move parts there.',
    A: [mon('weavile', 'Black Glasses', 'Pressure', ['Night Slash', 'Brick Break', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'garchomp')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'nightslash', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'brickbreak', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the type-scoped item multiplier is dropped entirely',
      patch: [['if(_ty&&_ty.onType===mvT&&_ty.mult)BPCH(_ty.mult);',
               'if(false&&_ty&&_ty.onType===mvT&&_ty.mult)BPCH(_ty.mult);']] } },

  /* --------------------------------------------------------------------- 9. ability / entry drop */
  { id: 'intimidate-entry',
    kind: 'ability', shape: 'switch-in stat drop',
    census: 'ability/onSwitchInDrop — "Intimidate drops Attack"',
    what: 'Incineroar leads with Intimidate. The board taken before anybody chooses (boundary 0) '
        + 'already carries the drop.',
    negative: 'two of them, on the same boards. Metagross has Clear Body and must NOT be dropped, and '
            + 'the drop must not REPEAT on turns 1 and 2 — an entry ability that ticked every turn '
            + 'would show -2 and -3 at the later boundaries.',
    A: [mon('incineroar', '', 'Intimidate', ['Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'garchomp')),
    B: [mon('metagross', '', 'Clear Body', ['Protect']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('toxapex', 'corviknight')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ],
    break: { why: 'the entry drop is skipped — the ability is still on the body and still named',
      patch: [["const _osd=TAGS.param('ability',m.ability,'onSwitchInDrop');",
               "const _osd=null&&TAGS.param('ability',m.ability,'onSwitchInDrop');"]] } },

  /* --------------------------------------------------------------------- 10. ability / weather */
  { id: 'drizzle-weather',
    kind: 'ability', shape: 'field + clock',
    census: 'ability/weatherSetter — "Drizzle sets rain on entry"',
    what: 'Pelipper leads with Drizzle. The sky and its counter are both on the board from boundary 0.',
    negative: 'the EXPIRY. Every click is a Protect for six turns, so the counter has to walk down and '
            + 'the sky has to clear on its own. A weather that never ran out, or ran out a turn early, '
            + 'parts on the boundary where the two engines stop agreeing about the number.',
    A: [mon('pelipper', '', 'Drizzle', ['Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    B: [mon('snorlax', '', 'Thick Fat', ['Protect']),
        mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: Array.from({ length: 6 }, () => (
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] })),
    break: { why: 'the entry weather setter is skipped',
      patch: [["const w=TAGS.param('ability',m.ability,'weatherSetter');",
               "const w=null&&TAGS.param('ability',m.ability,'weatherSetter');"]] } },

  /* ------------------------------------------------------------- 11. ability / heal on switch out */
  { id: 'regenerator-switchout',
    kind: 'ability', shape: 'switch-out heal (read off the bench)',
    census: 'ability/healsOnSwitchOut — "Regenerator heals a third on the way out"',
    what: 'Both of the facing bodies are chipped by an Earthquake on turn 1 and both pivot out with '
        + 'U-turn on turn 2. Toxapex has Regenerator; Snorlax beside it does not. The healed HP is '
        + 'read off the PARTY, because by the boundary both bodies are on the bench.',
    negative: 'the partner is the negative and it is on the same board — a body without the ability '
            + 'must come off the field on exactly the HP it left with.',
    A: [mon('garchomp', '', 'Rough Skin', ['Earthquake', 'Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'weavile')),
    B: [mon('toxapex', '', 'Regenerator', ['U-turn', 'Swords Dance', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['U-turn', 'Swords Dance', 'Protect'])].concat(FILL('corviknight', 'incineroar')),
    script: [
      { p1: [{ m: 'earthquake' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'uturn', t: 0 }, { m: 'uturn', t: 0 }] },
    ],
    break: { why: 'the switch-out heal is skipped',
      patch: [["{const _hs=TAGS.param('ability',out.ability,'healsOnSwitchOut');",
               "{const _hs=null&&TAGS.param('ability',out.ability,'healsOnSwitchOut');"]] } },

  /* -------------------------------------------------------------------- 12. ability / forme change */
  { id: 'disguise-forme',
    kind: 'ability', shape: 'forme change + hp',
    census: 'ability/formeChange — "Disguise eats the first hit"',
    what: 'Garchomp clicks Crunch at Mimikyu. Disguise takes the hit instead and the body becomes its '
        + 'busted forme, which is a SPECIES change and an HP cost, both on the board.',
    negative: 'turn 2 — the identical hit into the now-busted body, which has to take the damage in '
            + 'full. A Disguise that survived twice parts there.',
    A: [mon('garchomp', '', 'Rough Skin', ['Crunch', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('mimikyu', '', 'Disguise', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'crunch', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'crunch', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the forme change on being hit is skipped',
      patch: [["if(_fh&&_fh.becomes&&!tg._disguiseBusted&&dmg>0){",
               "if(false&&_fh&&_fh.becomes&&!tg._disguiseBusted&&dmg>0){"]] } },

  /* ================= THE BOARD-RESIDUE SCENARIOS, 2026-08-08 =====================================
   * The twelve above were written to mirror a census row. These three were written the other way
   * round: each is aimed at one of the three largest surviving families in
   * `data/game-differential.json`'s `state.families` — `active[].boosts.spe`, `active[].species` +
   * `active[].maxhp`, and `active[].boosts.atk` — over 1,530 real games. They are NOT extra: each
   * must go green, and each was RED on the release it was written against.
   * ============================================================================================== */

  /* ------------------------------------------------------------ 13. ability / a boost with an entry gate */
  { id: 'speedboost-entry-gate',
    kind: 'ability', shape: 'per-turn boost + the turn it may not fire on',
    census: 'ability/boostsEachTurn — "Speed Boost raises Speed every turn"',
    what: 'TWO Speed Boost bodies on the same side and the same board. Espathra stands in slot 1 from '
        + 'the leads and must gain a stage at the end of every turn. Weavile pivots out with U-turn on '
        + 'turn 1 and the Speed Boost body that replaces it arrives MID-TURN — Showdown gates the '
        + 'ability on `activeTurns` (data/abilities.ts:4447), which a body switched in this turn reads '
        + 'as 0, so the entrant must gain NOTHING at the end of the turn it walked in on.',
    negative: 'the lead IS the negative and it is beside the entrant on every board: a gate that '
            + 'over-matched — the shape this engine rejected the first time, because `_turnsOut` reads '
            + '0 for a lead and for a mid-turn entrant alike — suppresses the lead\'s turn-1 boost too '
            + 'and parts at the very first boundary. Turns 2 and 3 are the second negative: the '
            + 'entrant must resume boosting once it has stood through a turn opening, so a gate that '
            + 'latched would part there.',
    A: [mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('weavile', '', 'Pressure', ['U-turn', 'Protect']),
        mon('espathra', '', 'Speed Boost', ['Protect']),
        mon('sharpedo', '', 'Speed Boost', ['Protect']),
        mon('scolipede', '', 'Speed Boost', ['Protect'])],
    script: [
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'uturn', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ],
    /* BOTH BENCH BODIES CARRY THE ABILITY ON PURPOSE. The driver mirrors Showdown's replacement from
     * whatever medicham2 brought in, so the scenario must not depend on WHICH of the two walks in. */
    break: { why: 'the entry gate is removed and the per-turn boost fires unconditionally — which is '
                + 'exactly the defect this scenario was written against, so a green above it is '
                + 'vacuous unless this goes red',
      patch: [['if(_be&&_be.boosts&&m.boosts&&!m._newlySwitched)for(const k in _be.boosts){',
               'if(_be&&_be.boosts&&m.boosts)for(const k in _be.boosts){']] } },

  /* ------------------------------------------- 14. move / A MOVE TARGETS A SLOT, NOT A POKEMON */
  { id: 'pivot-then-the-slot-is-hit',
    kind: 'move', shape: 'target resolution across a mid-turn switch',
    census: 'no census row — this is Will\'s slot-first question asked as a BOARD question',
    what: 'Weavile (125 Speed) pivots out with U-turn and its replacement walks in MID-TURN. Milotic '
        + '(81 Speed) has already clicked CHARM at that slot and moves afterwards. Showdown resolves '
        + 'a move\'s target from its `targetLoc` at EXECUTION time (`Battle#getTarget`), so the Charm '
        + 'must land on WHOEVER IS STANDING THERE — the replacement — at -2 Attack. An engine holding '
        + 'the Pokemon OBJECT it aimed at follows the body onto the bench and the slot shows 0.',
    negative: 'turn 2 — the identical Charm into the same slot with NOBODY pivoting; the replacement '
            + 'clicks Iron Defense rather than Protect so the drop is not blocked, and it must go to '
            + '-4. A re-aim that fires when nothing moved, or that stopped landing at all, parts '
            + 'there. THE PARTNER IS THE SECOND NEGATIVE and is on every board: Charm is '
            + 'single-target, so p2b must never be dropped.',
    A: [mon('milotic', '', 'Marvel Scale', ['Charm', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('garchomp', 'snorlax')),
    B: [mon('weavile', '', 'Pressure', ['U-turn', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect']),
        mon('toxapex', '', 'Regenerator', ['Iron Defense', 'Protect']),
        mon('incineroar', '', 'Blaze', ['Iron Defense', 'Protect'])],
    script: [
      { p1: [{ m: 'charm', t: 0 }, { m: 'protect' }], p2: [{ m: 'uturn', t: 0 }, { m: 'irondefense' }] },
      { p1: [{ m: 'charm', t: 0 }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the generic effect branch stops re-aiming at the slot and follows the Pokemon '
                + 'object onto the bench, which is what it did before WIRE 139',
      patch: [['let _t=reaimToSlot(a.target,it,actA,actB,a.mv);', 'let _t=a.target;']] } },

  /* ------------------------------------------ 15. move / THE SHARPEST TEST OF THE SLOT-FIRST RULE */
  { id: 'allyswitch-follows-the-slot',
    kind: 'move', shape: 'target resolution with NOBODY leaving the field',
    census: 'move/priority + move/statusCategory — Ally Switch, 202 uses',
    what: 'Ally Switch (priority +2) swaps the two bodies on p2 BETWEEN SLOTS without either leaving '
        + 'the field, and Garchomp\'s Crunch — aimed at p2 slot 0 before the swap — resolves '
        + 'afterwards. This is the case the two models cannot both pass by accident: a slot-first '
        + 'engine hits the body that arrived in slot 0, a Pokemon-first engine follows Corviknight to '
        + 'slot 1. Both bodies are on the field the whole time, so "has my target left" — the weaker '
        + 'rule this engine carried until 2026-08-08 — answers NO and changes nothing.',
    negative: 'turn 2 — the identical Crunch at the identical slot with NO Ally Switch clicked. The '
            + 'hit must stay on whoever the swap left standing there, so an engine that re-aims when '
            + 'nothing moved, or that swapped a second time, parts. The UNHIT body is the second '
            + 'negative and is on every board: exactly one of the two may lose HP per turn.',
    A: [mon('garchomp', '', 'Rough Skin', ['Crunch', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'weavile')),
    B: [mon('corviknight', '', 'Pressure', ['Ally Switch', 'Iron Defense', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'incineroar')),
    script: [
      { p1: [{ m: 'crunch', t: 0 }, { m: 'protect' }], p2: [{ m: 'allyswitch' }, { m: 'irondefense' }] },
      { p1: [{ m: 'crunch', t: 0 }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the shared target reader stops asking the slot and hands back the body it was '
                + 'given — the Pokemon-first model, restored exactly',
      patch: [['const now=foes[it.tgtSlot]||null;',
               'const now=(actA.indexOf(t)>=0||actB.indexOf(t)>=0)?t:(foes[it.tgtSlot]||null);']] } },

  /* ---------------------------------------------------------- 16. mega / the forme on the board */
  { id: 'mega-forme-on-the-board',
    kind: 'mega', shape: 'species + the stone that stays held',
    census: 'mega/* — eleven census rows that NO staged scenario could reach until 2026-08-07',
    what: 'Kangaskhan holds a Kangaskhanite and its click on turn 1 asks to mega evolve. The species '
        + 'on the board must become Kangaskhan-Mega, on the ACTIVE slot and in the PARTY row, and the '
        + 'stone must still be held afterwards. NO mega in this format changes the HP stat — measured '
        + 'over all 76 base->mega pairs the format defines — so `maxhp` must NOT move, which makes '
        + 'this the one forme class that can part on `species` while `maxhp` agrees.',
    negative: 'TWO, and the first is on the same board: Gardevoir stands beside it holding a '
            + 'Gardevoirite and NEVER asks, so it must still read `gardevoir` on every board — an '
            + 'engine that megas whatever holds a stone parts there. The second is turn 2, where the '
            + 'same Kangaskhan clicks again WITHOUT asking: a forme that changed twice, or reverted, '
            + 'parts there.',
    A: [mon('kangaskhan', 'Kangaskhanite', 'Scrappy', ['Protect', 'Swords Dance']),
        mon('gardevoir', 'Gardevoirite', 'Synchronize', ['Calm Mind', 'Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'weavile')),
    script: [
      { p1: [{ m: 'swordsdance', mega: true }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the mega transformation is skipped — the choice is still made and still accepted, '
                + 'so only the FORME goes missing',
      patch: [['function megaEvolveNow(S,m,auto){', 'function megaEvolveNow(S,m,auto){if(1)return false;']] } },

  /* ------------------------------------------------ 17. ability / A TRANSFORM INTO AN ARBITRARY BODY */
  { id: 'imposter-copies-the-body-opposite',
    kind: 'ability', shape: 'species + stats + boosts, copied off a body the table has no row about',
    census: 'ability/imposter — "Ditto becomes the body it faces on entry"',
    what: 'Weavile pivots out with U-turn on turn 2 and Ditto walks in. Imposter copies the body it '
        + 'faces — Showdown reads `pokemon.side.foe.active[len - 1 - position]` (data/abilities.ts'
        + ':2111), which in doubles is the DIAGONAL slot, so a Ditto arriving in p2 slot 0 becomes p1 '
        + 'slot 1. Clefable has spent turn 1 on Calm Mind, so the copy has to bring the CURRENT STAT '
        + 'STAGES across as well as the species, the types and every stat except HP.',
    negative: 'THREE, all on the same boards. (a) The turn-1 boundaries are the entry negative — Ditto '
            + 'is on the bench and nothing may have transformed. (b) HP IS NOT COPIED: Ditto keeps its '
            + 'own maxhp, which is the one field that separates a real transform from a forme swap. '
            + '(c) THE DIAGONAL IS THE SHARPEST NEGATIVE — an engine that copies the body directly '
            + 'opposite becomes Garchomp, which parts on species, on every stat and on the boosts, '
            + 'because Garchomp spent the same two turns on Swords Dance.',
    A: [mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('milotic', 'snorlax')),
    /* THE BENCH IS UNAMBIGUOUS ON PURPOSE. The driver mirrors Showdown's replacement off medicham2's
     * slot, and after a transform medicham2's body NO LONGER ANSWERS TO ITS OWN SPECIES — so the
     * species lookup misses and the mirror falls through to the first healthy bench member. Ditto is
     * that member on both sides, which is what keeps the two engines playing the same game. */
    B: [mon('weavile', '', 'Pressure', ['U-turn', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect']),
        mon('ditto', '', 'Imposter', ['Protect']),
        mon('toxapex', '', 'Regenerator', ['Protect'])],
    /* DITTO IS SCRIPTED ONTO `Protect` AND THE BODY IT COPIES CARRIES `Protect` TOO. A transformed
     * body holds the COPIED moveset, so a click that is legal before the transform and illegal after
     * it would throw instead of diverging — which is a fixture fault wearing a finding's clothes. */
    script: [
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'protect' }, { m: 'irondefense' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'uturn', t: 0 }, { m: 'irondefense' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'protect' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the entry transform is skipped — Imposter is still on the body, still named, and '
                + 'copies nothing',
      patch: [['function imposterCopy(m,foes,slot){', 'function imposterCopy(m,foes,slot){if(1)return false;']] } },

  /* ------------------------------------ 18. mega / THE ABILITY IS REPLACED, AND SO IS WHAT IT DID */
  { id: 'mawile-mega-swaps-the-ability',
    kind: 'mega', shape: 'the ability the forme change overwrites, and the Attack that follows from it',
    census: 'mega/megaAbility — "the mega forme\'s slot-0 ability replaces whatever was there"',
    what: 'Mawile holds a Mawilite and carries INTIMIDATE; Mawile-Mega carries HUGE POWER. Staraptor '
        + 'leads opposite with an Intimidate of its own, so there are two Intimidates and one ability '
        + 'replacement inside a single turn. Mawile clicks Brick Break at Corviknight AND asks to mega '
        + 'evolve on the same click, which is the order Showdown resolves (mega at queue order 104, '
        + 'every move at 200). Both halves are on the board: the Attack STAGE says whether an entry '
        + 'drop fired twice or landed on the wrong body, and Corviknight\'s HP says whether the '
        + 'doubling ability the forme change installed is the one actually multiplying the hit.',
    negative: 'turn 2 — the same click with NO mega asked for. Nothing may transform a second time, no '
            + 'entry ability may fire again, and the damage must be the post-mega damage rather than '
            + 'the pre-mega one. The PARTNERS are the second negative and are on every board: Clefable '
            + 'never megas and Staraptor\'s Intimidate lands on both p1 bodies exactly once.',
    A: [mon('mawile', 'Mawilite', 'Intimidate', ['Brick Break', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('milotic', 'snorlax')),
    /* CORVIKNIGHT IS THE TARGET BECAUSE IT SURVIVES. Fighting is exactly neutral on Steel/Flying
     * (2 x 0.5), so the hit is a clean damage reading rather than a KO — and a KO clamps both engines
     * to the same number, which is the shape that makes a damage arm agree for the wrong reason. */
    B: [mon('staraptor', '', 'Intimidate', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Swords Dance', 'Protect'])].concat(FILL('toxapex', 'weavile')),
    script: [
      { p1: [{ m: 'brickbreak', t: 1, mega: true }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'brickbreak', t: 1 }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
    ],
    break: { why: 'the mega forme\'s ability is NOT installed — the species, the stats and the stone '
                + 'all change exactly as before, so only the ability replacement goes missing',
      patch: [['m.ability=ab; m.baseAbility=ab;', '/* the ability overwrite, removed by tests/staged_board.js */;']] } },

  /* ------------------------------------------- 21. ability / A FORME THAT FLIPS ON A CLOCK */
  { id: 'hungerswitch-flips-every-turn',
    kind: 'ability', shape: 'species, alternating at the residual with no trigger at all',
    census: 'ability/formeCycleResidual — "Hunger Switch flips Morpeko every turn"',
    what: 'Weavile pivots out with U-turn and MORPEKO walks in. Hunger Switch is an `onResidual` at '
        + 'order 29 — one slot after Speed Boost\'s 28 — and it flips Morpeko to Morpeko-Hangry at the '
        + 'END OF THE VERY TURN IT ARRIVED ON, triggered by nothing. Three boundaries are read after '
        + 'the entry because the flip ALTERNATES: Hangry, then back to Morpeko, then Hangry again.',
    negative: 'THREE. (a) The turn-1 boundaries are the entry negative — Morpeko is on the bench and '
            + 'nothing may have flipped. (b) THE ALTERNATION ITSELF IS THE SHARPEST NEGATIVE: an '
            + 'engine that transforms ONCE is green on turn 2 and parts on turn 3, so a one-shot fix '
            + 'cannot pass this. (c) The PARTNER is on every board and carries the ability on NOTHING '
            + '— Corviknight is not a Morpeko, and the handler\'s own `baseSpecies !== "Morpeko"` '
            + 'guard means a flip that keyed on the tag alone would rename a body that must not move.',
    A: [mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('weavile', '', 'Pressure', ['U-turn', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect']),
        mon('morpeko', '', 'Hunger Switch', ['Protect']),
        mon('toxapex', '', 'Regenerator', ['Protect'])],
    script: [
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'uturn', t: 0 }, { m: 'irondefense' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'protect' }, { m: 'irondefense' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'calmmind' }], p2: [{ m: 'protect' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the residual flip is skipped — the ability is still on the body and still named, so '
                + 'only the forme goes missing',
      patch: [["{const _fc=TAGS.param('ability',m.ability,'formeCycleResidual');",
               "{const _fc=null&&TAGS.param('ability',m.ability,'formeCycleResidual');"]] } },

  /* =============== 19-20. ONE QUESTION, TWO MOVES: CAN THIS ITEM LEAVE THIS BODY RIGHT NOW ======
   * Knock Off takes the TARGET'S item and Fling spends the USER'S OWN. They are staged together
   * because they ask the same thing of the same reader, and a reader that answers one of them and
   * not the other is exactly the two-implementations-of-one-fact breach CLAUDE.md names.
   * ============================================================================================= */

  /* -------------------------------------- 19. move / A BOOST THAT IS NOT ABOUT DAMAGE AT ALL */
  { id: 'knockoff-refuses-the-stone',
    kind: 'move', shape: 'base power gated on whether the item could be taken',
    census: 'move/removesItem + move/variablePower — Knock Off, 3,535 uses',
    what: 'Knock Off\'s x1.5 is not a damage rule, it is an ITEM rule: `data/moves.ts` asks '
        + '`singleEvent("TakeItem", item, ...)` FIRST and returns without the boost when the item '
        + 'refuses. Turn 1 stages the refusal — Charizard mega evolves holding its Charizardite Y and '
        + 'Tyranitar clicks Knock Off into it, so the stone cannot be taken, the boost must not apply '
        + 'and the stone must still be there afterwards (a stone removed here un-megas the body for '
        + 'the rest of the battle).',
    negative: 'turn 2 IS the negative and it is the sharpest one available: Tyranitar clicks the SAME '
            + 'Knock Off at SNORLAX, which is holding the SAME Charizardite Y. The authority keys the '
            + 'refusal on `source.baseSpecies.baseSpecies`, so a stone is untakeable on the body it '
            + 'belongs to and perfectly takeable on anything else — "mega stones are immune" is the '
            + 'wrong rule and parts here. The boost must apply and the item must go. The partner is '
            + 'also a standing negative on turn 1: it is never hit and keeps its stone throughout.',
    A: [mon('tyranitar', '', 'Unnerve', ['Knock Off', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('milotic', 'weavile')),
    B: [mon('charizard', 'Charizardite Y', 'Blaze', ['Swords Dance', 'Protect']),
        mon('snorlax', 'Charizardite Y', 'Thick Fat', ['Swords Dance', 'Protect'])].concat(FILL('toxapex', 'corviknight')),
    script: [
      { p1: [{ m: 'knockoff', t: 0 }, { m: 'calmmind' }], p2: [{ m: 'swordsdance', mega: true }, { m: 'swordsdance' }] },
      { p1: [{ m: 'knockoff', t: 1 }, { m: 'calmmind' }], p2: [{ m: 'swordsdance' }, { m: 'swordsdance' }] },
    ],
    break: { why: 'the base-power branch stops asking whether the item could be taken and boosts off '
                + 'the mere PRESENCE of one, which is what it did before this wire',
      patch: [["else if(_vp.kind==='targetHasItem'&&def.item&&!itemRefusesTake(def))",
               "else if(_vp.kind==='targetHasItem'&&def.item)"]] } },

  /* ------------------------------------------- 20. move / THE USER'S OWN ITEM, IN REVERSE */
  { id: 'fling-spends-the-users-item',
    kind: 'move', shape: 'the item leaves the user, and the base power came OUT of it',
    census: 'move/flingsOwnItem — Fling, 31 uses',
    what: 'Sceptile holds a Light Ball and clicks Fling. The authority\'s `onPrepareHit` asks '
        + '`TakeItem` FIRST, refuses outright if the item carries no `fling` entry, and only THEN '
        + 'writes `move.basePower = item.fling.basePower` — so the power comes out of the item (30 for '
        + 'a Light Ball), the item is spent, and the Light Ball\'s own `fling.status` PARALYSES what it '
        + 'hits. Three separate board fields: the user\'s item, the target\'s HP and the target\'s '
        + 'status.',
    negative: 'TWO, and each is a different reason to fail. (a) Turn 2 — the SAME Sceptile clicks Fling '
            + 'again with nothing left to throw, so the move must do nothing at all; an engine that '
            + 'consumed the item but kept a fixed base power still deals damage there. (b) The PARTNER, '
            + 'on both turns — Charizard clicks Fling while holding its own Charizardite Y, which '
            + '`TakeItem` refuses, so the move fails outright and the stone stays. That is the SAME '
            + 'refusal Knock Off asks about one scenario above, arriving from the other side.',
    A: [mon('sceptile', 'Light Ball', 'Overgrow', ['Fling', 'Protect']),
        mon('charizard', 'Charizardite Y', 'Blaze', ['Fling', 'Protect'])].concat(FILL('milotic', 'clefable')),
    B: [mon('snorlax', '', 'Thick Fat', ['Swords Dance', 'Protect']),
        mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect'])].concat(FILL('toxapex', 'weavile')),
    script: [
      { p1: [{ m: 'fling', t: 0 }, { m: 'fling', t: 1 }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
      { p1: [{ m: 'fling', t: 0 }, { m: 'fling', t: 1 }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the item is no longer spent — the power still comes out of it and the throw still '
                + 'lands, so ONLY the disposition goes missing and turn 2 throws a second Light Ball',
      patch: [['{const _it=m.item;m.item=\'\';', '{const _it=m.item;']] } },

  /* ---------------------------------- 22. move / A PHAZE RESOLVES LAST, AND AIMS AT A SLOT */
  { id: 'roar-drags-whoever-is-standing-there',
    kind: 'move', shape: 'target resolution at priority -6, after the slot has changed hands',
    census: 'move/forcesSwitch — Roar 454 uses, Dragon Tail 105, Whirlwind 25',
    what: 'Will, 2026-08-08: *"roar has super negative priority so switch happens first"*. Roar, '
        + 'Whirlwind, Dragon Tail and Circle Throw are all priority -6, so ANY switch in the turn '
        + 'resolves before them and the body the Roar was aimed at is routinely gone by the time it '
        + 'fires. Corviknight pivots out with U-turn on turn 2 and Snorlax walks into that slot; '
        + 'Incineroar\'s Roar then resolves and must drag WHOEVER IS STANDING THERE. '
        + 'THE BENCH IS DELIBERATELY DOWN TO ONE LIVE BODY by then — Weavile is knocked out on turn 1 '
        + 'and Toxapex replaces it — because the drag itself is a uniform die in both engines and a '
        + 'two-way choice would part for a reason that has nothing to do with this rule.',
    negative: 'turn 3 — Corviknight clicks PROTECT and is Roared anyway. That is counter-intuitive and '
            + 'it is the rule: Roar has no `protect` flag, so an engine that started gating the phaze '
            + 'on the shield parts there. Turn 1 is the second negative: the same Incineroar clicks a '
            + 'damaging move rather than Roar, so nothing may be dragged while the aimed slot changes '
            + 'hands under a faint. The PARTNER is the third and is on every board: Roar is '
            + 'single-target and p2b must sit in its slot untouched throughout.',
    A: [mon('incineroar', '', 'Blaze', ['Close Combat', 'Roar', 'Protect']),
        mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(FILL('milotic', 'garchomp')),
    B: [mon('corviknight', '', 'Pressure', ['U-turn', 'Iron Defense', 'Protect']),
        mon('weavile', '', 'Pressure', ['Swords Dance', 'Protect']),
        mon('toxapex', '', 'Regenerator', ['Iron Defense', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Iron Defense', 'Protect'])],
    script: [
      { p1: [{ m: 'closecombat', t: 1 }, { m: 'calmmind' }], p2: [{ m: 'irondefense' }, { m: 'swordsdance' }] },
      { p1: [{ m: 'roar', t: 0 }, { m: 'calmmind' }], p2: [{ m: 'uturn', t: 0 }, { m: 'irondefense' }] },
      { p1: [{ m: 'roar', t: 0 }, { m: 'calmmind' }], p2: [{ m: 'protect' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the phaze branch stops asking the slot and looks the aimed POKEMON up in the active '
                + 'array — the Pokemon-first model, restored exactly, which fails the move whenever '
                + 'the target has already left',
      /* SINGLE-LINE ANCHOR ON PURPOSE. The first version of this spanned two lines with a `\n` and
       * matched ZERO times: the file on disk is CRLF, so a plant written with a bare newline reads
       * exactly like a comparator that found nothing — which is the failure mode `patchedSource`
       * refuses by demanding exactly one match. Every anchor in this file is one line for that
       * reason. */
      patch: [['const _t=reaimToSlot(a.target,it,actA,actB,a.mv);', 'const _t=a.target;']] } },

  /* ============================ BEYOND THE TWELVE ==============================================
   * Two scenarios staged for a DIFFERENT question: not "does the staged board agree with the census",
   * but "does it see something the census could not". They are marked `extra: true` and are reported
   * apart so they cannot pad the twelve. */

  { id: 'zerotohero-moment', extra: true,
    kind: 'ability', shape: 'forme change on switch-OUT',
    census: 'ability/formeChange — "Zero to Hero upgrades Palafin on return"',
    what: 'Palafin pivots out with U-turn. Showdown transforms it as it LEAVES; this engine\'s probe '
        + 'describes the change happening on the RETURN. Nothing here asserts which is right — the '
        + 'board is read off both engines while Palafin is on the bench.',
    negative: 'turn 1 is the negative — Palafin has not left yet, so no forme change may have happened.',
    A: [mon('palafin', '', 'Zero to Hero', ['U-turn', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [mon('corviknight', '', 'Pressure', ['Iron Defense', 'Protect']),
        mon('toxapex', '', 'Regenerator', ['Iron Defense', 'Protect'])].concat(FILL('weavile', 'incineroar')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
      { p1: [{ m: 'uturn', t: 0 }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
    ],
    break: { why: 'the switch-in forme change is skipped entirely',
      patch: [["{const _sot=TAGS.param('ability',out.ability,'switchOutTrigger');",
               "{const _sot=null&&TAGS.param('ability',out.ability,'switchOutTrigger');"]] } },

  { id: 'sandstorm-residual-order', extra: true,
    kind: 'move', shape: 'residual order across four bodies',
    census: 'no census row — this is the directed table\'s surviving `ordering` cause, asked as a BOARD question',
    what: 'Tyranitar sets sand; four bodies stand in it and every click is a Protect. The protocol '
        + 'differential says the two engines announce the chip in a different order (Showdown '
        + 'speed-sorts the residual; this engine walks its slots). This asks whether that reaches the '
        + 'BOARD at all.',
    negative: 'the two Rock/Ground bodies must take nothing — an engine chipping the immune ones parts '
            + 'on the same boards.',
    A: [mon('incineroar', '', 'Blaze', ['Protect']),
        mon('whimsicott', '', 'Chlorophyll', ['Protect'])].concat(FILL('milotic', 'clefable')),
    B: [mon('tyranitar', '', 'Sand Stream', ['Protect']),
        mon('garchomp', '', 'Rough Skin', ['Protect'])].concat(FILL('corviknight', 'snorlax')),
    script: Array.from({ length: 3 }, () => (
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] })),
    break: { why: 'the sandstorm residual stops chipping anybody',
      patch: [["if(field.weather==='sand'&&!field.wSup&&!m.types.some(t=>t==='Rock'||t==='Ground'||t==='Steel')){",
               "if(false&&field.weather==='sand'&&!field.wSup&&!m.types.some(t=>t==='Rock'||t==='Ground'||t==='Steel')){"]] } },
];

/* ---- THE FIXTURE AUDIT, RUN BEFORE ANY BOARD IS READ --------------------------------------------
 *
 * FOUR OF THE FIRST SIX RED DEMONSTRATIONS FAILED, AND EVERY ONE OF THEM WAS THIS FILE'S FAULT
 * RATHER THAN THE COMPARATOR'S. The driver's pin (`game_differential.js` PIN_CLAIMS) says in as many
 * words that *a 90-accuracy move MISSES*, so a Will-O-Wisp, a Rock Slide and a High Horsepower
 * staged nothing at all — and a scenario that stages nothing reads exactly like one that agreed.
 * That is this project's signature failure arriving inside the instrument built to catch it.
 *
 * So the accuracy of every scripted click is checked against the dex BEFORE any game is played, and
 * anything that is not a guaranteed hit is a hard failure with the move named. Two more cheap checks
 * ride along, for the two other ways a script silently becomes a no-op:
 *   - a click naming a move the body does not carry. `scripted()` answers `pass` for it, Showdown
 *     rejects `pass` for a healthy active body, and the game throws — loud, but the message names
 *     the body rather than the typo.
 *   - a script with the wrong number of slots per side.
 *
 * WHAT IT STILL CANNOT SEE, said rather than implied: a click aimed INTO A PROTECT. A blocked U-turn
 * does not switch and a blocked attack deals nothing, and both leave a scenario staging nothing. No
 * static check can decide that; the red demonstration is what catches it, which is the other reason
 * `--reds` is not decoration. A break that changes no board means the scenario cannot express its
 * own mechanic. */
/* CAN THIS BODY LEARN THIS MOVE — ASKED OF THE AUTHORITY, NEVER OF A LEARNSET WALK OF OUR OWN.
 *
 * `TeamValidator#checkCanLearn` is the same code path that refuses a team on the ladder: it handles
 * prevo chains, event-only moves and every mod override for free. A hand-rolled walk of
 * `getLearnsetData().learnset` gets the common case right and the interesting cases wrong, which is
 * the worst possible split for a check whose entire job is catching the interesting cases.
 *
 * It returns a STRING on refusal ("` can't learn Will-O-Wisp.`") and `null` on success, so the reason
 * printed to a reader is the game's own words. Built once and memoised: the validator is not cheap to
 * construct and this is called per click per scenario. */
/* The pairs already in the tree when this clause was written. Keyed (species|move) so the same
 * illegal pair cannot be re-introduced in a new scenario and read as pre-existing. */
const _LEARNSET_KNOWN = new Set((() => {
  try { return require(path.join(__dirname, '..', 'data', 'fixture-learnset-baseline.json')).pairs || []; }
  catch (e) { return []; }
})());
let _validator = null;
const _canLearnCache = new Map();
function _canLearn(mv, speciesName) {
  const key = String(speciesName).toLowerCase() + '|' + mv.id;
  if (_canLearnCache.has(key)) return _canLearnCache.get(key);
  let why = null;
  try {
    if (!_validator) _validator = new (CS.sim().TeamValidator)(CS.FORMAT);
    const sp = _dex.species.get(speciesName);
    /* A SPECIES THIS FORMAT DOES NOT CONTAIN IS A DIFFERENT DEFECT AND IS NOT THIS CLAUSE'S TO REPORT.
     * Saying "cannot learn" about a body that does not exist would send someone to the learnset. */
    if (!sp || !sp.exists) why = null;
    else why = _validator.checkCanLearn(mv, sp) || null;
  } catch (e) {
    /* A THROWN VALIDATOR IS NOT A PASS. It is a clause that could not be computed, and this repo's
     * rule for that is that it FAILS — but loudly and as itself, not disguised as a learnset verdict. */
    why = ' — the learnset check THREW (' + String(e.message).slice(0, 60) + '), which is not a pass';
  }
  _canLearnCache.set(key, why);
  return why;
}

function fixtureAudit(list) {
  const bad = [];
  /* pairs already on the baseline: reported, never failed. See the learnset clause below. */
  const known = [];
  for (const sc of list) {
    for (const [side, team] of [['p1', sc.A], ['p2', sc.B]]) {
      const carried = team.map(m => new Set((m.moves || []).map(x => _dex.moves.get(x).id)));
      sc.script.forEach((step, t) => {
        const acts = step[side] || [];
        if (acts.length !== 2) bad.push(sc.id + ' turn ' + (t + 1) + ' ' + side + ': ' + acts.length
          + ' slot(s) scripted, and a doubles side has 2');
        acts.forEach((a, i) => {
          if (!a) return;
          const mv = _dex.moves.get(a.m);
          if (!mv || !mv.exists) { bad.push(sc.id + ' turn ' + (t + 1) + ' ' + side + '[' + i + ']: no '
            + 'such move "' + a.m + '"'); return; }
          /* SLOT 0 KEEPS ITS BODY ALL GAME IN THESE SCENARIOS ONLY WHEN NOBODY PIVOTS OR FAINTS, so
           * the carried-move check is applied to the LEAD of that slot and only for turn 1. Later
           * turns may legitimately be answered by a replacement with a different set. */
          if (t === 0 && carried[i] && !carried[i].has(mv.id))
            bad.push(sc.id + ' turn 1 ' + side + '[' + i + ']: ' + mv.name + ' is not on that body');
          /* CARRIED IS NOT LEGAL, AND THIS AUDIT ONLY EVER ASKED THE FIRST — 2026-08-12.
           *
           * The clause above proves the click is on the body's DECLARED move list, and `buildPair`
           * proves the move EXISTS. Neither asks whether the body could LEARN it, so a fixture can
           * declare any moveset it likes and pass. **Eight illegal pairs were sitting in
           * tests/staged_status_counters.js**, in scenarios that were green: Snorlax|Swords Dance in
           * NINE places, Milotic|Will-O-Wisp, Milotic|Calm Mind, Milotic|Spore twice, Milotic|Nuzzle,
           * Mudsdale|Swords Dance, Incineroar|Iron Defense, Tinkaton|Iron Defense.
           *
           * It was found by an agent sent to repair ONE faint, which ran the authority's own
           * TeamValidator on the fixture and got *"Milotic can't learn Will-O-Wisp"* back. Nothing in
           * this repo had asked that question of a staged board.
           *
           * IT MATTERS BECAUSE THE WHOLE POINT OF A STAGED FIXTURE IS THAT THE GAME COULD PRODUCE IT.
           * A board Showdown would refuse at team validation is not a weaker test, it is a test of a
           * position that cannot occur — the same class as the blank-spread rig testing turn order in
           * the one configuration where turn order cannot be got wrong.
           *
           * `checkCanLearn` is the authority and returns a STRING on refusal, `null` on success — so
           * the reason the game gives is the reason printed here, rather than a message of our own
           * invention. Turn 1 only, matching the clause above: later turns may be answered by a
           * replacement whose set this audit does not hold. */
          if (t === 0 && carried[i] && carried[i].has(mv.id)) {
            const body = team[i];
            const sp = body && (body.species || body.name);
            if (sp) {
              const why = _canLearn(mv, sp);
              if (why) {
                /* RATCHETED, BECAUSE THE CLAUSE IS NEW AND THE VIOLATIONS ARE NOT.
                 *
                 * Turning this on red-lights fixtures that have been green for weeks, and repairing
                 * eight of them is its own batch — each repair changes what its scenario measures, and
                 * folding that into the pass that ADDS the check makes both unattributable. So a pair
                 * already on the baseline is REPORTED and does not fail; a NEW one fails by name.
                 *
                 * The key is (species|move) rather than (scenario|slot|turn): the same illegal pair
                 * appears in nine scenarios, and a ratchet keyed on position would let someone move
                 * Snorlax|Swords Dance to a tenth scenario and call it new. */
                const key = String(sp).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + mv.id;
                (_LEARNSET_KNOWN.has(key) ? known : bad).push(
                  sc.id + ' turn 1 ' + side + '[' + i + ']: ' + sp + why
                  + '  — the fixture declares a moveset the game cannot produce'
                  + (_LEARNSET_KNOWN.has(key) ? '   [KNOWN — on the baseline, not failing]' : ''));
              }
            }
          }
          /* THE EXEMPTION, AND IT IS NARROW. Where the ACCURACY IS THE MECHANIC — Blizzard in snow,
           * Thunder in rain, a powder into a Grass type, High Jump Kick crashing, Fissure — a losing
           * roll is the arm under test rather than a staging accident, and the click declares
           * `mayMiss` with its reason. It is written per CLICK, never per scenario, so it cannot
           * quietly cover a delivery move that was meant to land. */
          if (!(mv.accuracy === true || mv.accuracy === 100) && !a.mayMiss)
            bad.push(sc.id + ' turn ' + (t + 1) + ' ' + side + '[' + i + ']: ' + mv.name + ' is '
              + mv.accuracy + '-accurate, and THE PIN MAKES ANYTHING BELOW 100 MISS — the click would '
              + 'stage nothing and the boards would agree for the wrong reason. If the losing roll IS '
              + 'the mechanic, say so on the click: { m: \'' + mv.id + '\', mayMiss: \'why\' }');
        });
      });
    }
  }
  /* Reported, never failed — see the learnset clause. A known violation that stops being printed
   * is a repair and the baseline may then shrink; one that appears here and is NOT on the baseline
   * went into ad instead and fails by name. */
  if (known.length) {
    for (const k of known) console.log('      ' + k);
  }
  return bad;
}

/* THE AUDIT AUDITS ITSELF, because a check nobody has seen fire is a check nobody can believe — and
 * `mayMiss` is an OPT-OUT, which is the one shape that can quietly disable a guard. Both directions,
 * on a scenario built here and never played. */
function auditProof() {
  const shell = (click) => ([{ id: '(audit self-test)',
    A: [mon('garchomp', '', 'Rough Skin', ['Rock Slide']), mon('clefable', '', 'Unaware', ['Protect'])],
    B: [mon('snorlax', '', 'Thick Fat', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])],
    script: [{ p1: [click, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }] }]);
  return [
    { id: 'a 90-accurate click is REFUSED',
      ok: fixtureAudit(shell({ m: 'rockslide' })).some(x => /90-accurate/.test(x)) },
    { id: 'and is allowed only when that click declares mayMiss',
      ok: fixtureAudit(shell({ m: 'rockslide', mayMiss: 'the losing roll IS the mechanic' })).length === 0 },
  ];
}

/* ---- ONE RUN OF ONE SCENARIO -------------------------------------------------------------------- */
/* ---- THE PP HOLD IS GONE FROM THIS FILE, AND HERE IS WHAT IT COST TO REMOVE ----------------------
 *
 * PP became a compared board leaf on 2026-08-11 (it had been in `board_state.js`'s NOT_COMPARED on the
 * claim that "medicham2 does not track PP at all", which stopped being true at ROADMAP #144 -- the
 * declaration outlived what it described). It was held out of this file's VERDICT for one day because
 * it was WRONG, measured against the authority on this file's own scenarios:
 *     Trick Room  showdown 3 / ours 1     Stealth Rock  3/1     Haze  2/1
 *     Charm       showdown 1 / ours 2     Crunch        1/2     Roar  3/4
 *
 * ALL OF IT IS FIXED AND THIS FILE IS 24 of 24 CLEAN WITH PP COMPARED. Two defects, not six:
 *   - the first three are ROADMAP #206 FAMILY 1. Pressure was priced off an EMPTY list for any move
 *     that names no target, because the list was guessed from `a.target` and the spread table. It is
 *     now read off the move's own `targetClass` tag, derived in tag_dex from `target` plus the
 *     `mustpressure` flag by replaying `getMoveTargets` (sim/pokemon.ts:794-860).
 *   - the last three are ONE defect and it is the same function's other half: Pressure was charged
 *     for the body the click NAMED rather than the body standing in the slot when the move RAN. The
 *     authority resolves that list inside `useMoveInner`, after any mid-turn switch; this engine
 *     already re-aimed the EFFECT through `reaimToSlot` and now prices the PP off the same call.
 *
 * SO THIS FILE ASKS ABOUT PP AND ANSWERS FOR IT. `tests/roster.js` still holds it -- its verdict is a
 * MEDICHAM gate clause and lifting it there still flips one, for six reasons that are NOT PP defects.
 * The reason is written at that call site with the seven rows named, and ROADMAP #207 tracks it. */
const PP_HOLD_WHY = 'PP is COMPARED by board_state.js and is IN this instrument\'s verdict since '
  + '2026-08-11 -- the hold that stood here for one day is gone. It was lifted only after the '
  + 'scenarios that parted on it were fixed: Trick Room 3/1, Stealth Rock 3/1, Haze 2/1 (Pressure '
  + 'priced off an empty target list) and Charm 1/2, Crunch 1/2, Roar 3/4 (Pressure charged for the '
  + 'body the click NAMED rather than the one standing in the slot when it ran). All 24 scenarios are '
  + 'board-identical with PP compared.';

function runOne(sc, patchedSrc) {
  const G = harness(patchedSrc);
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { id: sc.id, verdict: 'NOT-STAGED',
    why: 'buildPair returned null for ' + (!a ? 'side A' : 'side B') + ' — the scenario never ran' };

  const boards = [];
  /* ROADMAP #174 -- DID THE SCRIPT ACTUALLY CLICK WHAT IT SAID? The driver answers `pass` for a
   * scripted move that is not on Showdown's request, which is the right behaviour and was SILENT: a
   * scenario whose click never happened reports IDENTICAL, because both engines passed. Reset per
   * scenario and read back on the result so a caller can assert it rather than assume it. */
  if (G.resetScriptCounters) G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'staged:' + sc.id, {
    script: sc.script,
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
      /* THE DRIVER'S OWN STOP RULE ENDS A STATE GAME AT THE FIRST DIVERGENT BOARD, and a multi-turn
       * scenario whose turn 1 parts would then never reach its negative half. The diffs are copied
       * out ABOVE this line; what is neutralised is the driver's copy of the verdict, not either
       * engine's state. Both engines play on exactly as they would have. */
      snap.identical = true; snap.diffs = [];
    } });

  if (r.err) return { id: sc.id, verdict: 'THREW', why: r.err, boards };
  const wantTurns = sc.script.length;
  if (r.turns !== wantTurns) return { id: sc.id, verdict: 'SHORT', boards,
    why: 'the script declares ' + wantTurns + ' turn(s) and ' + r.turns + ' were played — a scripted '
       + 'game that ends early looks exactly like one that agreed' };
  if (boards.length !== wantTurns + 1) return { id: sc.id, verdict: 'SHORT', boards,
    why: boards.length + ' boundaries were taken and ' + (wantTurns + 1) + ' were expected (one for '
       + 'the leads plus one per turn)' };
  if (boards.some(x => !x.compared)) return { id: sc.id, verdict: 'SHORT', boards,
    why: 'a boundary compared ZERO leaves — the state path is not armed' };

  /* the declared exceptions, matched leaf by leaf */
  const allow = (sc.allow || []).map(x => ({ ...x, hits: 0 }));
  for (const bd of boards) {
    bd.allowed = []; bd.unexplained = [];
    for (const d of bd.diffs) {
      const m = allow.find(x => (x.turn == null || x.turn === bd.turn)
        && (x.field == null || x.field === d.field)
        && (x.body == null || x.body === d.body)
        && (x.side == null || x.side === d.side));
      if (m) { m.hits++; bd.allowed.push({ d, why: m.why }); } else bd.unexplained.push(d);
    }
  }
  const stale = allow.filter(x => !x.hits);
  const unexplained = boards.reduce((n, x) => n + x.unexplained.length, 0);
  const compared = boards.reduce((n, x) => n + x.compared, 0);
  const script = G.scriptCounters ? G.scriptCounters() : null;
  return { id: sc.id, boards, allow, stale, compared, unexplained, script,
    verdict: stale.length ? 'STALE-ALLOW' : (unexplained ? 'DIFFERS' : 'IDENTICAL') };
}

/* ================= WHICH CENSUS ROWS COULD BECOME A SCENARIO, AND WHICH COULD NOT ================
 *
 *   node tests/staged_board.js --convertibility
 *
 * DERIVED AND NOT TYPED, because a count in a comment is stale the day the census moves — and this
 * repository has fourteen handoff documents proving it. The rules come from two sources and never
 * from an opinion about whether a mechanic matters:
 *
 *   what board_state.js COMPARES, and the four fields it publishes in NOT_COMPARED;
 *   what the SCRIPT LANGUAGE can say, which is the larger constraint and the surprise. Two facts,
 *   read off `engine/game_differential.js` rather than assumed:
 *       `scripted()`               returns {pass} or {move,slot,target} — THERE IS NO SWITCH ACTION.
 *       the mega block             `if (!req || !req.active || opts.script) continue;`
 *                                  — A SCRIPTED GAME NEVER MEGA EVOLVES.
 *   and one by construction: a click the request marks DISABLED is answered `pass`, Showdown refuses
 *   `pass` for a healthy active body, and the game throws instead of diverging.
 *
 * EVERY EXCLUDED ROW IS PRINTED BY NAME. An exclusion rule that over-matches is this project's
 * standing hazard (`refusesStatusMoves` caught Telepathy; `speedOnItemLoss` caught Sticky Hold), and
 * the only defence that has ever worked is showing the membership before believing the count.
 *
 * THE DIRECT / BY-CONSEQUENCE SPLIT INSIDE THE CONVERTIBLE SET IS SOFT and is published as a
 * caution, not as a result: a terrain that raises a Psychic move is filed by consequence and could
 * equally be filed direct. Both halves are convertible; the split says only how much care a scenario
 * needs. What is NOT soft is the excluded set, which is where the honest residue lives. */
const CONV_RULES = [
  { id: 'A. NOT A SIMULATOR QUESTION AT ALL',
    why: 'the row is about the SCORER — board.js / MAG pricing a click — and not about a game state. '
       + 'There is no pair of boards to compare because only one engine has an opinion. Triple Axel '
       + 'is the third member: "priced below three full hits" is a claim about dmgRange.',
    test: r => /\bthe bot\b/i.test(r.label) || /is priced below/i.test(r.label) },
  { id: 'B. ANNOUNCEMENT ONLY',
    why: 'the row asserts something about the PROTOCOL STREAM — which line is emitted, in what order, '
       + 'naming whom. board_state.js reads live state and never opens either engine\'s log, by '
       + 'design and for a stated reason. These belong to the protocol differential; converting them '
       + 'would be a category error rather than closing a gap.',
    test: r => /announc|is ANNOUNCED|adds no line|one line per|\|move\| line|names every|names each/i.test(r.label) },
  { id: 'C. THE SCRIPT CANNOT SAY IT — MEGA EVOLUTION',
    why: 'the driver skips the mega choice whenever a script is supplied, so no staged scenario can '
       + 'mega evolve. This is the LARGEST single exclusion and it has nothing to do with the board '
       + 'comparator: these rows are unreachable because the script language has no word for the '
       + 'choice, and CLAUDE.md puts megas at 26.0% of this format\'s usage. It is also the cheapest '
       + 'exclusion to fix — the driver already makes the choice for unscripted games.',
    test: r => /^mega/.test(r.tag) },
  { id: 'D. THE SCRIPT CANNOT SAY IT — A VOLUNTARY SWITCH',
    why: '`scripted()` can express a move and a pass and nothing else. Every switch in this file is '
       + 'driven by a PIVOT MOVE, and a pivot is a different act — trapping does not stop one — so a '
       + 'row whose whole content is "this holds a voluntary switch" cannot be staged.',
    test: r => /voluntary switch/i.test(r.label) },
  { id: 'E. THE SCRIPT CANNOT SAY IT — A CLICK THE REQUEST REFUSES',
    why: 'Fake Out on turn 2, a second Gigaton Hammer, a Choice-locked second move and a Taunted '
       + 'status move are all DISABLED on Showdown\'s own request; a recharge turn is the same shape '
       + 'from the other side, offering only the pseudo-move `recharge`. Each throws rather than '
       + 'diverging. Measured, not assumed: the first Fake Out scenario written for this file died '
       + 'with `Can\'t move: Incineroar\'s Fake Out is disabled`.',
    tags: new Set(['choiceLock', 'cantUseTwice', 'recharge']),
    test(r) { return this.tags.has(r.tag) || /off the menu|selection time/i.test(r.label); } },
  { id: 'F. A FIELD board_state.js DECLARES IT DOES NOT COMPARE',
    why: 'published in NOT_COMPARED with its reason. The stall counter behind consecutive Protect is '
       + 'the only one any census row is ABOUT — item disposition, PP and ability trapping have no '
       + 'row of their own, so the declared blind spots cost almost nothing here.',
    test: r => /consecutive Protect decays|FAILS outright when its user holds the LAST action/i.test(r.label) },
];
/* the within-turn facts: real, and on the board only as a CONSEQUENCE that a scenario has to force */
const CONV_BY_CONSEQUENCE = new Set(['flinches', 'addsFlinch', 'priority', 'priorityMod',
  'priorityModFlying', 'priorityBlockEveryKind', 'fractionalPriority', 'reordersTurn', 'quashSendsLast',
  'reversesSpeed', 'speedMult', 'speedCond', 'speedCondWrongWeather', 'speedOnItemLoss', 'accuracyMod',
  'writesAccuracy', 'neverMisses', 'neverMissesAttack', 'weatherAccuracy', 'multiAccuracy', 'ohko',
  'redirects', 'redirectsType', 'ignoresProtect', 'oneTurnGuard', 'preTurnShield', 'preTurnShieldFails',
  'failsIfTargetNotAttacking', 'blocksMove', 'immuneToMoveClass', 'blocksStatusMoves',
  'refusesStatusMoves', 'blocksSoundMoves', 'soundSealBlocksEveryKind', 'sound', 'powder',
  'ignoresScreensAndSubs', 'blocksExplosion', 'blocksBerries', 'semiInvulnerable', 'stalling',
  'preventsCrit', 'alwaysCrit', 'critRatioUp', 'critDamageUp', 'boardWeatherLanguage',
  'boardTerrainLanguage', 'statusCategory', 'setsTerrainEveryMember', 'formatSecondaryChance',
  'phazeDragIsADie', 'immunityBlocksSecondary', 'removesOwnSecondaries', 'forbidsStatusMoves',
  'swapsAbilities', 'rewritesAbilityOnContact', 'changesTargetType', 'typeBecomesMoveType',
  'ignoresDefenderAbility', 'ignoresTypeImmunity', 'ignoresStatStages', 'ignoresBoosts',
  'weatherSuppression', 'privateWeather', 'contact', 'moveClass', 'boostsMoveClass', 'stabBoost',
  'damageBoost', 'damageReduce', 'damageMultAll', 'damageMultType', 'halvesDamage', 'halvesTypeDamage',
  'boostsSuperEffective', 'resistBerry', 'reducesAllyDamage', 'overridesEffectiveness',
  'conditionalPower', 'variablePower', 'variablePowerAbsolute', 'weightBased', 'speedRatioPower',
  'hpScaledPower', 'boostScaledPower', 'powerFromFallen', 'boostsFromFallen', 'terrainScaled',
  'weatherScaled', 'weatherDamageMult', 'weatherDefenceMult', 'weatherBall', 'needsUntrackedState',
  'needsTargetToAttack', 'multiHit', 'hitsTwice', 'reactorPerHit', 'spreadFoes', 'spreadAll',
  'swapsStat', 'statSwap', 'fixedDamage', 'chargeTurn', 'chargeSkippedByWeather', 'solarPower',
  'typeImmunity', 'weatherChipImmune', 'statusImmune', 'preventsStatDrop', 'auraBoost', 'auraBreak',
  'reflectsStatusMoves', 'boostsTargetHonoursTarget', 'readsOwnItem', 'readsTargetItem',
  'failsWithoutWeather', 'failsWithoutTerrain', 'crashOnMiss', 'noRecoil', 'drainThenPunishOrder',
  'intimidateRetaliationNet', 'untagged']);

function convertibility() {
  const C = require(D('data', 'mechanics-census.json'));
  const bucket = {};
  for (const r of C.results) {
    let cls = null;
    for (const rule of CONV_RULES) if (rule.test(r)) { cls = rule.id; break; }
    if (!cls) cls = CONV_BY_CONSEQUENCE.has(r.tag) ? 'CONVERTIBLE — through a forced CONSEQUENCE'
                                                   : 'CONVERTIBLE — DIRECTLY on a compared field';
    (bucket[cls] = bucket[cls] || []).push(r);
  }
  console.log('\nWHICH CENSUS ROWS COULD BECOME A STAGED SCENARIO');
  console.log('  census ' + C.results.length + ' rows, generated ' + C.generated);
  let ok = 0;
  for (const k of ['CONVERTIBLE — DIRECTLY on a compared field',
                   'CONVERTIBLE — through a forced CONSEQUENCE']) {
    ok += (bucket[k] || []).length;
    console.log('\n  ' + (bucket[k] || []).length + '   ' + k);
  }
  console.log('\n  THE RESIDUE, EVERY ROW NAMED:');
  for (const rule of CONV_RULES) {
    const rows = bucket[rule.id] || [];
    console.log('\n  ' + rows.length + '   ' + rule.id);
    console.log('      ' + rule.why);
    for (const r of rows) console.log('        ' + (r.kind + '/' + r.tag).padEnd(32) + r.label);
  }
  console.log('\n  CONVERTIBLE ' + ok + '   NOT CONVERTIBLE ' + (C.results.length - ok)
    + '   of ' + C.results.length);
  /* THE SECOND CONSTRAINT, MEASURED RATHER THAN GUESSED: the driver's pin makes every move below 100
   * accuracy MISS, so a row staged through an inaccurate DELIVERY move stages nothing. Where the
   * accuracy IS the mechanic that is not a blocker — the losing roll is the arm under test — which
   * is what `mayMiss` on a click is for. */
  const moves = _dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.name.length > 3
                                        && !(m.accuracy === true || m.accuracy === 100));
  const named = C.results.map(r => ({ r, hit: moves.filter(m => r.label.includes(m.name)) }))
                         .filter(x => x.hit.length);
  console.log('\n  AND A SECOND CONSTRAINT ON STAGING, WHICH IS NOT A BLIND SPOT BUT A COST:');
  console.log('    ' + named.length + ' rows name a move the pin makes MISS. Each needs either a '
    + '100-accuracy carrier of the same');
  console.log('    tag, or a click declaring `mayMiss` because the losing roll is the point:');
  for (const x of named) console.log('        ' + (x.r.kind + '/' + x.r.tag).padEnd(28)
    + x.hit.map(m => m.name + ' ' + m.accuracy).join(', ').padEnd(30) + x.r.label.slice(0, 70));
  return 0;
}

/* ---- THE DECLARED-DIVERGENCE MACHINERY PROVES ITSELF, BEFORE ANY SCENARIO USES IT ---------------
 *
 * `allow` is the one place this file can go quiet, so it is the one place that has to be shown
 * working in BOTH directions before it is trusted — the same discipline as `board_state.js`'s
 * MAPPINGS and the driver's planted proof. A declared exception that silently swallowed everything
 * would turn every verdict below into a comparator artefact.
 *
 * IT RUNS AGAINST A DELIBERATELY BROKEN ENGINE, AND IT USED TO RUN AGAINST A REAL DEFECT. Until
 * 2026-08-08 the proof case was `zerotohero-moment`, which parted for a published reason — and then
 * WIRE 133–137 FIXED IT, so the proof reported `the proof case no longer parts` and, by its own
 * rule, declared every verdict below it untrustworthy. A guard whose fixture is a bug is a guard
 * that dies the day the bug does; this project has the same shape written down as `expect: 'agree'`
 * going stale. The fixture is now `fakeout-flinch` UNDER ITS OWN DECLARED BREAK, which is a plant
 * rather than a defect, so nothing ENGINE lands can take it away. A break that stops parting is
 * still a hard failure here — it means the plant no longer plants.
 *   FORWARD   the true divergence, declared -> the verdict must become IDENTICAL
 *   BACKWARD  a declaration that matches nothing -> the verdict must become STALE-ALLOW, never a pass
 *   NARROW    a declaration aimed at a DIFFERENT field -> the true divergence must still be reported
 */
function allowProof() {
  const base = SCENARIOS.find(s => s.id === 'fakeout-flinch');
  const p = patchedSource(base);
  if (p.error)
    return [{ id: 'the proof fixture could not be planted', ok: false,
      note: 'fakeout-flinch\'s break did not apply: ' + p.error }];
  const raw = runOne(base, p.src);
  if (raw.verdict !== 'DIFFERS')
    return [{ id: 'the planted proof case does not part', ok: false,
      note: 'fakeout-flinch under its own break reports ' + raw.verdict + ', so this proof tested '
          + 'nothing. That is not a pass — it means the machinery below is unguarded, and separately '
          + 'that the plant is no longer a plant.' }];
  /* EVERY field the plant moved, not just the first: a break whose consequence lands on two fields
   * (the flinch one lands on both the active's HP and the same body's party row) would fail the
   * FORWARD leg for a reason that has nothing to do with the machinery being proved. */
  const why = 'declared by allowProof(), not by a scenario';
  const fields = [...new Set(raw.boards.flatMap(b => b.unexplained.map(d => d.field)))];
  const all = fields.map(field => ({ field, why }));
  const run = (allow) => runOne({ ...base, allow }, p.src).verdict;
  return [
    { id: 'a TRUE divergence, declared, is quietened', ok:
        run(all) === 'IDENTICAL' },
    { id: 'a declaration matching NOTHING is STALE-ALLOW, not a pass', ok:
        run([{ field: 'field.weather', why }]) === 'STALE-ALLOW' },
    { id: 'a declaration aimed at another field does NOT swallow this one', ok:
        run(all.concat([{ field: 'vol.taunt', why }])) === 'STALE-ALLOW' },
  ];
}

/* ---- THE BREAK ---------------------------------------------------------------------------------- */
function patchedSource(sc) {
  if (!sc.break) return { error: 'the scenario declares no break, so no red demonstration is possible' };
  let src = CLEAN_SRC;
  for (const [find, repl] of sc.break.patch) {
    const n = src.split(find).length - 1;
    if (n !== 1) return { error: 'the anchor matched ' + n + ' time(s), not exactly once — an '
      + 'unapplied plant reads exactly like a comparator that found nothing. Anchor: ' + find.slice(0, 90) };
    src = src.replace(find, repl);
  }
  return { src };
}

/* ---- REPORT ------------------------------------------------------------------------------------- */
/* `BS.explain` is the shared English and is used for everything it renders. It falls through to a
 * raw dump for one field only — `party.MISSING-OR-EXTRA-MEMBER`, whose VALUE is a whole party row —
 * and that row reads as `[object Object]`, which is the least useful line a report can print about
 * the most interesting kind of difference there is (a body one engine has and the other does not).
 * Rendered here rather than by editing the shared file, which other divisions are in. */
function say(d, v) {
  if (d.field === 'party.MISSING-OR-EXTRA-MEMBER')
    return pretty(d.body) + (v ? ' is on the team' : ' is NOT on the team');
  return BS.explain(d, v, pretty);
}
function printRun(res, indent) {
  const P = indent || '    ';
  if (!res.boards) { console.log(P + res.verdict + ' — ' + res.why); return; }
  for (const bd of res.boards) {
    const ok = bd.compared - bd.diffs.length;
    console.log(P + (bd.turn === 0 ? 'the leads' : 'end of turn ' + bd.turn).padEnd(14)
      + ok + ' of ' + bd.compared + ' fields identical'
      + (bd.diffs.length ? '   — and these do not agree:' : ''));
    for (const d of (bd.unexplained || bd.diffs)) {
      console.log(P + '   SHOWDOWN  ' + say(d, d.sd));
      console.log(P + '   OURS      ' + say(d, d.us)
        + '        [' + (d.slot || d.side || 'field') + ' ' + d.field + ' / ' + d.bucket + ']');
    }
    for (const a of (bd.allowed || [])) {
      console.log(P + '   DECLARED  ' + say(a.d, a.d.sd) + '  vs  ' + say(a.d, a.d.us));
      console.log(P + '             ' + a.why);
    }
  }
  if (res.verdict === 'STALE-ALLOW') for (const s of res.stale)
    console.log(P + '   STALE DECLARATION — nothing matched: ' + JSON.stringify(s));
  if (res.verdict === 'SHORT') console.log(P + '   SHORT — ' + res.why);
}

function main() {
  const chosen = SCENARIOS.filter(s => !ONLY || s.id === ONLY);
  if (!chosen.length) { console.log('no scenario matches --only ' + ONLY); process.exit(2); }
  if (HAS('--convertibility')) return convertibility();
  if (LIST) { for (const s of SCENARIOS) console.log(String(s.id).padEnd(28) + s.kind.padEnd(9)
    + String(s.shape).padEnd(34) + (s.extra ? '(beyond the twelve) ' : '') + s.census); return 0; }

  console.log('\nSTAGED BOARD COMPARISON — Showdown is the expectation; no scenario declares a result.');
  console.log('  engine release ' + REL.id + '   simulator digest ' + (REL.stamp().source_digests || {})[MEDI_REL]);
  console.log('  ' + chosen.filter(s => !s.extra).length + ' scenario(s) in the twelve, '
    + chosen.filter(s => s.extra).length + ' beyond it' + (REDS ? ', each also played under its declared break' : ''));
  /* THE HELD FIELD, ON THE SCREEN, BEFORE ANY VERDICT. A hold that lives only in a source comment is
   * the caveat-that-gets-skimmed this repository has paid for repeatedly. */
  console.log('  PP IS IN EVERY VERDICT BELOW: ' + PP_HOLD_WHY.replace(/\s+/g, ' '));

  let bad0 = 0;
  const fx = fixtureAudit(chosen);
  console.log('\n  THE FIXTURE AUDIT — every scripted click, before a single game is played:');
  for (const p of auditProof()) {
    console.log('    ' + (p.ok ? 'ok   ' : 'FAIL ') + p.id);
    if (!p.ok) bad0++;
  }
  if (fx.length) {
    for (const f of fx) console.log('    ' + f);
    console.log('    THE SCENARIOS ARE WRONG. Nothing below would mean anything; refusing to play them.');
    return fx.length;
  }
  console.log('    all ' + chosen.reduce((n, s) => n + s.script.length * 4, 0) + ' clicks are guaranteed '
    + 'hits carried by the body that clicks them.');

  console.log('\n  THE DECLARED-DIVERGENCE MACHINERY, both directions, before any scenario uses it:');
  for (const p of allowProof()) {
    console.log('    ' + (p.ok ? 'ok   ' : 'FAIL ') + p.id + (p.note ? '\n         ' + p.note : ''));
    if (!p.ok) bad0++;
  }
  if (bad0) console.log('    THE QUIETENING MECHANISM IS NOT TRUSTWORTHY — every verdict below could be it.');

  let bad = bad0, greens = 0, reds = 0, redFails = 0;
  const out = [];
  for (const sc of chosen) {
    console.log('\n' + (sc.extra ? '[beyond the twelve] ' : '') + sc.id + '   (' + sc.kind + ' / ' + sc.shape + ')');
    console.log('  probe it mirrors: ' + sc.census);
    console.log('  staged:   ' + sc.what);
    console.log('  negative: ' + sc.negative);
    if (sc.residue) console.log('  note:     ' + sc.residue);
    const clean = runOne(sc, null);
    console.log('  CLEAN ENGINE  -> ' + clean.verdict);
    printRun(clean, '    ');
    if (clean.verdict === 'IDENTICAL') greens++;
    else if (!sc.extra) bad++;

    let broken = null;
    if (REDS) {
      const p = patchedSource(sc);
      if (p.error) { console.log('  BROKEN ENGINE -> PATCH NOT APPLIED: ' + p.error); redFails++; bad++; }
      else {
        broken = runOne(sc, p.src);
        console.log('  BROKEN ENGINE -> ' + broken.verdict + '   (' + sc.break.why + ')');
        printRun(broken, '    ');
        /* THE FIELDS THE BREAK MOVED, and it is not enough that the boards merely parted: the break
         * has to be LOCALISED, exactly as `board_state.js`'s own planted proof demands. */
        const named = broken.boards
          ? [...new Set(broken.boards.flatMap(b => (b.unexplained || []).map(d => d.field)))] : [];
        if (broken.verdict === 'DIFFERS' && named.length) {
          reds++;
          console.log('    CAUGHT AND LOCALISED — the break moved: ' + named.join(', '));
        } else {
          redFails++; bad++;
          console.log('    NOT CAUGHT. Read this as a fault of the SCENARIO, not of the comparator: a '
            + 'break that moves no board means this staging cannot express its own mechanic (the '
            + 'click was blocked, the hit was not lethal, the order did not matter). It is the '
            + 'equivalent-mutant test, and a green above it is vacuous until this goes red.');
        }
      }
    }
    out.push({ id: sc.id, extra: !!sc.extra, kind: sc.kind, shape: sc.shape, census: sc.census,
               clean: { verdict: clean.verdict, why: clean.why || null, compared: clean.compared || 0,
                        diffs: (clean.boards || []).flatMap(b => (b.unexplained || b.diffs || [])
                          .map(d => ({ turn: b.turn, slot: d.slot, body: d.body, field: d.field,
                                       showdown: d.sd, ours: d.us, bucket: d.bucket }))) },
               broken: broken ? { verdict: broken.verdict, why: broken.why || null,
                        fields: (broken.boards || []).flatMap(b => (b.unexplained || [])
                          .map(d => b.turn + ':' + d.field)) } : null });
  }

  console.log('\nSUMMARY');
  console.log('  clean and board-identical: ' + greens + ' of ' + chosen.length);
  if (REDS) console.log('  breaks caught and localised: ' + reds + ' of ' + chosen.length
    + (redFails ? '   ' + redFails + ' NOT CAUGHT' : ''));
  const differs = out.filter(o => o.clean.verdict !== 'IDENTICAL');
  if (differs.length) {
    console.log('  scenarios whose CLEAN boards part — each is a FINDING about the engine, not about this file:');
    for (const o of differs) console.log('    ' + o.id.padEnd(28) + o.clean.verdict + '  '
      + [...new Set(o.clean.diffs.map(d => d.field))].join(', '));
  }
  if (JSONOUT) console.log('\n' + JSON.stringify({ release: REL.id, stamp: REL.stamp(), scenarios: out }, null, 1));
  return bad;
}

module.exports = { SCENARIOS, runOne, patchedSource, harness, pretty, PP_HOLD_WHY,
                   fixtureAudit, auditProof, allowProof, convertibility, CONV_RULES };

if (require.main === module) {
  const bad = main();
  process.exit(bad ? 1 : 0);
}
