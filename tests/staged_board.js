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
  let db = null;
  try { db = JSON.parse(read() || 'null'); } catch (e) { db = null; }
  if (!db || !db.moves || !db.items) {
    console.log('NOT RUN — data/tags.json in ' + what + ' is empty or unparseable.');
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
      patch: [['function applyStatus(t,st){if(!canTakeStatus(t,st))return false;t.status=st;',
               "function applyStatus(t,st){if(st==='par')return false;if(!canTakeStatus(t,st))return false;t.status=st;"]] } },

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
      patch: [["if(tg.ability==='disguise'&&!tg._disguiseBusted&&dmg>0){",
               "if(false&&tg.ability==='disguise'&&!tg._disguiseBusted&&dmg>0){"]] } },

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
      patch: [["const _sf=TAGS.param('ability',nx.ability,'switchInForme');",
               "const _sf=null&&TAGS.param('ability',nx.ability,'switchInForme');"]] } },

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
function fixtureAudit(list) {
  const bad = [];
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
function runOne(sc, patchedSrc) {
  const G = harness(patchedSrc);
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { id: sc.id, verdict: 'NOT-STAGED',
    why: 'buildPair returned null for ' + (!a ? 'side A' : 'side B') + ' — the scenario never ran' };

  const boards = [];
  const r = G.playGame(a, b, 'directed', 'staged:' + sc.id, {
    script: sc.script,
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
  return { id: sc.id, boards, allow, stale, compared, unexplained,
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
 * It runs against `zerotohero-moment`, which parts for a REAL and already-published reason, so the
 * proof needs no fixture of its own:
 *   FORWARD   the true divergence, declared -> the verdict must become IDENTICAL
 *   BACKWARD  a declaration that matches nothing -> the verdict must become STALE-ALLOW, never a pass
 *   NARROW    a declaration aimed at a DIFFERENT field -> the true divergence must still be reported
 */
function allowProof() {
  const base = SCENARIOS.find(s => s.id === 'zerotohero-moment');
  const raw = runOne(base, null);
  if (raw.verdict !== 'DIFFERS')
    return [{ id: 'the proof case no longer parts', ok: false,
      note: 'zerotohero-moment reports ' + raw.verdict + ', so this proof tested nothing. That is not '
          + 'a pass — it means the machinery is unguarded (and, separately, that a published finding '
          + 'has moved and the scenario needs restating).' }];
  const field = raw.boards.flatMap(b => b.unexplained)[0].field;
  const run = (allow) => runOne({ ...base, allow }, null).verdict;
  const why = 'declared by allowProof(), not by a scenario';
  return [
    { id: 'a TRUE divergence, declared, is quietened', ok:
        run([{ field, why }]) === 'IDENTICAL' },
    { id: 'a declaration matching NOTHING is STALE-ALLOW, not a pass', ok:
        run([{ field: 'field.weather', why }]) === 'STALE-ALLOW' },
    { id: 'a declaration aimed at another field does NOT swallow this one', ok:
        run([{ field, why }, { field: 'vol.taunt', why }]) === 'STALE-ALLOW' },
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

module.exports = { SCENARIOS, runOne, patchedSource, harness, pretty,
                   fixtureAudit, auditProof, allowProof, convertibility, CONV_RULES };

if (require.main === module) {
  const bad = main();
  process.exit(bad ? 1 : 0);
}
