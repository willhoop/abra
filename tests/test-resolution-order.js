/* test-resolution-order.js — THE AUTHORITY DECLARES A RESOLUTION ORDER AND THIS ENGINE USED A
 * DIFFERENT ONE, IN FOUR PLACES. 2026-08-22.
 *
 *   SHOWDOWN_PATH=... node tests/test-resolution-order.js                the LIVE tree
 *   SHOWDOWN_PATH=... node tests/test-resolution-order.js --release <id>    a named snapshot
 *   SHOWDOWN_PATH=... node tests/test-resolution-order.js --only a4-red
 *
 * ================= IT IS NOT ONE TABLE, AND SAYING SO IS HALF THE ANSWER ========================
 *
 * The four defects were handed over as "one derivation". They are THREE tables on the authority's
 * side, and merging them here would have been a fiction:
 *
 *   A1  `Battle.actions.spreadMoveHit`'s numbered steps (sim/battle-actions.ts:1060-1130). Six
 *       numbered comments in the source, then `DamagingHit`, then `AfterHit`. medicham2 ALREADY has
 *       this as data — `_STEPS` — and the defect was one member sitting in the wrong slot.
 *   A2  `Battle#comparePriority` (sim/battle.ts:404-411), the SORT KEY, used by `speedSort` for the
 *       switch-in event. Not a sequence of steps at all; a comparator with five keys, of which this
 *       engine implemented the third and skipped the second.
 *   A3+A4  `Battle#runAction`'s tail (sim/battle.ts:2807-2865). THESE TWO ARE ONE TABLE: `|upkeep|`,
 *       `faintMessages()` and `eachEvent('Update')` are three consecutive statements in one function,
 *       and A4's berry and A3's faint are positions in it. A3's `-mustrecharge` half is NOT — it is
 *       step 4 of A1's table — which is exactly why "one table" was the wrong frame.
 *
 * So: three tables, four fixes, and the two that really are one table are A3's faint and A4's berry.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the identical script under the differential's
 * own pin and the two protocol streams are compared line for line; the pass is that they do not part.
 * SHOWDOWN IS THE EXPECTATION — `tests/staged_board.js` argues that at length.
 *
 * ================= EVERY FIX IS SHOWN RED, AND EVERY FIX IS SHOWN NOT TO OVER-FIRE ==============
 *
 * A green arm proves nothing on its own: it is also what an engine that never changed produces. So
 * each arm is played TWICE — once against the tree as it stands, and once against the same bytes with
 * ONE NAMED SURGICAL PATCH that reverts exactly one fix, applied in memory and never written to disk.
 *
 *   a RED arm      must AGREE clean and must PART under its own break.
 *   an OVER-FIRE   must AGREE clean and must ALSO AGREE under that same break.
 *   CONTROL arm
 *
 * The second row is the one that matters and it is the clause the last `-fail` attempt was retracted
 * for. An arm that agrees under both is an arm the change provably did not touch, so a RED arm's
 * parting is ATTRIBUTED to the fix by delta rather than inferred from a tally. Each break is also
 * required to match its anchor EXACTLY ONCE: an unapplied plant reads precisely like a comparator
 * that found nothing.
 *
 * ================= WHERE EACH DEFECT CAME FROM ==================================================
 *
 * All four are cards in `data/divergence-turns.json` (release 6a05dd9ad60d, 40 cards off 378 diverged
 * games), and each fixture below is that card's board rebuilt rather than a case somebody imagined:
 *
 *   card 18  |-status|p2a|brn <> |-boost|p2a|def|1                    A1  Flare Blitz into Stamina
 *   card  5  |-weather|sunnyday|[from]drought <> |-heal|...hospitality  A2  a double-KO refill
 *   card  9  |-mustrecharge|p1b <> |faint|p2a                          A3  a Hyper Beam that kills
 *   card 39  |faint|p2a <> |-hitcount|p2a|2                            A3  a volley that kills
 *   card 22  |upkeep <> |-enditem|p2b|sitrusberry|[eat]                A4  a berry off a status chip
 *
 * ================= WHAT THE INSTRUMENT CAN ACTUALLY SEE, PER DEFECT =============================
 *
 * `game_differential.js`'s reducer erases far more than a reader expects — `[silent]`/`[still]`/
 * `[miss]`/`[spread]`/`[anim]`, the whole target field of a `|move|` line, `-ability` announcements,
 * `[from]`/`[of]` attributions on stat lines — so a raw-stream difference is NOT a divergence and each
 * of these was checked against the rules before being called a defect:
 *
 *   A1  VISIBLE. `-boost`/`-unboost` survive with body, stat, direction and amount; only the
 *       `[from] ability:` tag is stripped. Two adjacent kept lines in the opposite order part.
 *   A2  VISIBLE. `-weather` and `-heal` are both kept whole.
 *   A3  VISIBLE, BOTH HALVES. `|faint|`, `|-mustrecharge|` and `|-hitcount|` are all kept. And the
 *       corpse ident survives the reducer BY ACCIDENT OF ITS RULE RATHER THAN BY DESIGN, which is
 *       worth stating: `traceCanon` folds `p2: Azumarill` to `p2:` and leaves `p2a: Azumarill` as
 *       `p2a:azumarill`, so the two forms are DIFFERENT strings and the difference is caught.
 *   A4  VISIBLE. `|upkeep|` is in TRACE_EVENTS and both engines emit it; the berry's `-enditem` and
 *       `-heal` are kept. The comparison is a POSITION against `|upkeep|`, which is the one marker
 *       the reducer cannot normalise away because it carries no fields at all.
 *
 * ================= AND WHAT IT CANNOT ==========================================================
 *
 * A1's OTHER half — the FREQUENCY of `onDamagingHit` on a multi-hit — is NOT fixed here and is not
 * claimed. The reaction COUNT is already right (`_react`, WIRE 84); what is wrong is that this engine
 * emits the whole packet volley and then N reactions, where the authority interleaves them, because
 * the authority runs the ENTIRE step list once per hit and this engine runs it once per move. That is
 * WIRE 20's declared granularity divergence and converting it is a restructure, not an ordering fix.
 * `a1-multihit-frequency` below stages it and is expected to PART on the live tree; it is registered
 * as a KNOWN-OPEN arm with its own verdict word so it cannot be read as a pass and cannot be read as a
 * regression either.
 *
 * ================= THE FIXTURES ARE FIXTURES ===================================================
 *
 * Every species, move and ability named here is legal in `gen9championsvgc2026regmb` and every move is
 * on its user's own learnset — both derived from `Dex.forFormat` below, not recalled. Spreads and
 * items are the harness's, so nothing here is a set and nothing here is a recommendation.
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
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and `tests/run-all.js` spawns a bare `node <file>`. See
 * tests/test-encore-fail-silent.js's header for the release that got cut into the real store this way. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

/* ---- THE SNAPSHOT THIS FILE PATCHES MUST BE THE TREE THIS FILE IS TESTING -----------------------
 * `open(null)` takes the NEWEST release in the store, which under `_live_release.js` is whatever a
 * PREVIOUS run of some other instrument happened to freeze into the temp store. Measured while
 * building this file: `CLEAN_SRC` came back as bytes that predated the change under test, so every
 * engine counter read `undefined` and every break was applied to the wrong engine — the arms still
 * agreed, which is exactly the shape of a green test that is asking nothing.
 * So the tree is frozen HERE, and the id is pushed onto argv so the driver opens the SAME one rather
 * than cutting a second and racing its own newest. With `--release <id>` nothing is cut at all. */
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/test-resolution-order.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_REL = 'engine/medicham2-browser.js';
const MEDI_PATH = REL.path(MEDI_REL);
const CLEAN_SRC = REL.read(MEDI_REL);
const GD_PATH = D('engine', 'game_differential.js');

/* ---- THE HARNESS, LOADABLE OVER A PATCHED SIMULATOR ---------------------------------------------
 * Lifted in shape from tests/staged_board.js, and for its reason: `game_differential.js` binds its
 * engine ONCE with `REL.require(...)`, so patched bytes have to sit in the require cache under the
 * SNAPSHOT'S OWN FILENAME before the driver loads. Compiling them under any other name would pair
 * patched engine source with a differently-resolved `./tags.js`. */
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

/* ---- THE BREAKS. ONE PER FIX, EACH REVERTING EXACTLY THAT FIX AND NOTHING ELSE ------------------
 * A pair whose `from` does not appear EXACTLY ONCE is a FAILURE of this file, never a skip. */
const BREAKS = {
  'buff-above-secondaries': {
    what: 'puts `_stepBuffOnHit` back where it lived until 2026-08-22 — at the top of the secondaries '
        + 'step instead of beside `DamagingHit`. Two edits because the member has to leave one slot '
        + 'and enter another; a one-sided patch would delete the mechanic rather than move it.',
    edits: [['_stepDamagingHit,_stepBuffOnHit,', '_stepDamagingHit,'],
            ['_stepSelfPay,_stepEffects,', '_stepSelfPay,_stepBuffOnHit,_stepEffects,']] },

  'entry-sort-speed-only': {
    what: 'reverts the faint-replacement entry sort to speed alone, which is what it did before '
        + '`compareEntryOrder` read `onSwitchInPriority` out of data/switchin-order.json.',
    edits: [['_arrived.sort((x,y)=>compareEntryOrder(x,y,field));',
             '_arrived.sort((x,y)=>compareTurnOrder({spe:x.spe},{spe:y.spe},field));']] },

  'recharge-below-the-step-list': {
    what: 'deletes the step-4 arming so the backstop far below `_stepFaint` answers instead — i.e. '
        + 'exactly the engine as it stood, with `|-mustrecharge|` printed after `|faint|`.',
    edits: [[`        if(!m.fainted&&_reached>0&&TAGS.has('move',a.move.id,'recharge')){
          m._recharge=true;_rechargeArmed=true;MEDSEEN.rechargeArmedAtSelfDrops++;if(TR)TR.recharge(m);}
        else if(!m.fainted&&TAGS.has('move',a.move.id,'recharge')){
          MEDSEEN.rechargeSkippedNoTarget++;_rechargeArmed=true;}`, '        ;']] },

  'hitcount-in-the-packet-loop': {
    what: 'emits `|-hitcount|` from inside the damage step again, which reverts BOTH halves of card '
        + '39 at once — the line goes back above `|faint|` AND back to naming a live `p2a:` body, '
        + 'because `TR.hitcount` picks the de-activated ident off `fainted` and nothing is fainted yet.',
    edits: [['if(R.hitcount&&_landed>0)R.hitLanded=_landed;',
             'if(TR&&R.hitcount&&_landed>0)TR.hitcount(tg,_landed);']] },

  'berry-at-every-group': {
    what: 'runs the `onUpdate` pass after EVERY residual group instead of only after the weather, '
        + 'which is where ROADMAP #221 left it. The post-upkeep pass still runs and simply finds '
        + 'nothing, so this isolates the POSITION and changes nothing else.',
    edits: [["if(_G.has('weather')&&field.weather&&!field.wSup)residualUpdatePass(actA,actB,field,_gi);",
             'residualUpdatePass(actA,actB,field,_gi);']] },
};

function applyBreak(id) {
  const b = BREAKS[id];
  let src = CLEAN_SRC;
  for (const [from, to] of b.edits) {
    const n = src.split(from).length - 1;
    if (n !== 1) return { err: 'anchor matched ' + n + ' times (must be exactly 1): ' + from.slice(0, 60) };
    src = src.replace(from, to);
  }
  return { src };
}

/* ---- SCENARIO SUGAR ---------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };

const CASES = [

  /* =============================== A1 — `onDamagingHit` BELOW THE SECONDARIES =================== */
  { id: 'a1-red', group: 'A1', kind: 'red', brk: 'buff-above-secondaries',
    what: 'Incineroar clicks LOW SWEEP into an Archaludon with STAMINA. Low Sweep carries '
        + '`secondary: {chance: 100, boosts: {spe: -1}}`, so the two lines land on the SAME BODY in '
        + 'the same hit and their order is the whole question. The authority runs secondaries at step '
        + '5 and `DamagingHit` at :1121 below it. Card 18 is this with Flare Blitz, whose burn is 10% '
        + 'and therefore arm-dependent; 100% is the same defect with the dice taken out of it.',
    counters: { buffOnHitAfterSecondaries: 1 },
    A: [['incineroar', '', 'Blaze', ['Low Sweep', 'Brick Break', 'Protect']],
        ['corviknight', '', 'Pressure', ['Protect']],
        ['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]],
    B: [['archaludon', '', 'Stamina', ['Body Press', 'Protect']],
        ['snorlax', '', 'Thick Fat', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']]],
    script: [T([{ m: 'lowsweep', t: 0 }, PROT], [{ m: 'bodypress', t: 1 }, PROT])] },

  { id: 'a1-control-no-secondary', group: 'A1', kind: 'control', brk: 'buff-above-secondaries',
    what: 'the SAME board and the same Stamina body, hit with BRICK BREAK — which carries no '
        + 'secondary at all. There is nothing for the buff to be above or below, so moving the step '
        + 'must not move a line. This is the arm that says the fix is a reorder and not a rewrite.',
    counters: { buffOnHitAfterSecondaries: 1 },
    A: [['incineroar', '', 'Blaze', ['Low Sweep', 'Brick Break', 'Protect']],
        ['corviknight', '', 'Pressure', ['Protect']],
        ['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]],
    B: [['archaludon', '', 'Stamina', ['Body Press', 'Protect']],
        ['snorlax', '', 'Thick Fat', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']]],
    script: [T([{ m: 'brickbreak', t: 0 }, PROT], [{ m: 'bodypress', t: 1 }, PROT])] },

  { id: 'a1-control-roughskin', group: 'A1', kind: 'control', brk: 'buff-above-secondaries',
    what: 'Low Sweep into a ROUGH SKIN Garchomp — `punishesAttacker`, the other half of the same hook, '
        + 'which has been below the secondaries since 2026-08-12 and is not touched here. It must '
        + 'agree under the break as well as clean, and that is what makes "the two families are now '
        + 'in one place" a measurement rather than a claim.',
    counters: { buffOnHitAfterSecondaries: 0 },
    A: [['incineroar', '', 'Blaze', ['Low Sweep', 'Brick Break', 'Protect']],
        ['corviknight', '', 'Pressure', ['Protect']],
        ['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]],
    B: [['garchomp', '', 'Rough Skin', ['Protect']],
        ['snorlax', '', 'Thick Fat', ['Protect']],
        ['archaludon', '', 'Stamina', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']]],
    script: [T([{ m: 'lowsweep', t: 0 }, PROT], [PROT, PROT])] },

  /* =============================== A2 — `onSwitchInPriority` =================================== */
  { id: 'a2-red', group: 'A2', kind: 'red', brk: 'entry-sort-speed-only',
    what: 'card 5 rebuilt. Two Mementos take one body off each side in the same turn, so the '
        + 'replacements arrive together and the authority coalesces the queued `runSwitch` actions '
        + 'into ONE `fieldEvent(\'SwitchIn\')`. TORKOAL is base Speed 20 and SINISTCHA is 70, and the '
        + 'authority runs DROUGHT FIRST because Hospitality carries `onSwitchInPriority: -2`. '
        + 'Corviknight\'s Brave Bird on the way through is what damages Milotic, so Hospitality\'s '
        + 'heal produces a LINE instead of clamping to a no-op at full HP.',
    counters: { switchInPrioritySeparated: 1 },
    A: [['whimsicott', '', 'Prankster', ['Memento', 'Protect']],
        ['corviknight', '', 'Pressure', ['Brave Bird', 'Protect']],
        ['torkoal', '', 'Drought', ['Protect']], ['clefable', '', 'Unaware', ['Protect']]],
    B: [['milotic', '', 'Marvel Scale', ['Recover', 'Protect']],
        ['spiritomb', '', 'Infiltrator', ['Memento', 'Protect']],
        ['sinistcha', '', 'Hospitality', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]],
    script: [T([{ m: 'memento', t: 0 }, { m: 'bravebird', t: 0 }], [{ m: 'recover' }, { m: 'memento', t: 1 }]),
             T([PROT, PROT], [PROT, PROT])] },

  { id: 'a2-control-equal-priority', group: 'A2', kind: 'control', brk: 'entry-sort-speed-only',
    what: 'the identical double-KO refill with VANILLUXE (Snow Warning) in Sinistcha\'s place. Both '
        + 'arrivals now declare priority 0, so `comparePriority` falls through to its third key and '
        + 'SPEED decides on both engines. It must agree under the break, which is the proof that the '
        + 'priority term is inert where the authority declares none — an entry sort that had simply '
        + 'become unstable would part here.',
    counters: { switchInPrioritySeparated: 0 },
    A: [['whimsicott', '', 'Prankster', ['Memento', 'Protect']],
        ['corviknight', '', 'Pressure', ['Brave Bird', 'Protect']],
        ['torkoal', '', 'Drought', ['Protect']], ['clefable', '', 'Unaware', ['Protect']]],
    B: [['milotic', '', 'Marvel Scale', ['Recover', 'Protect']],
        ['spiritomb', '', 'Infiltrator', ['Memento', 'Protect']],
        ['vanilluxe', '', 'Snow Warning', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]],
    script: [T([{ m: 'memento', t: 0 }, { m: 'bravebird', t: 0 }], [{ m: 'recover' }, { m: 'memento', t: 1 }]),
             T([PROT, PROT], [PROT, PROT])] },

  /* =============================== A3 — THE FAINT LINE'S TWO NEIGHBOURS ========================= */
  { id: 'a3-recharge-red', group: 'A3', kind: 'red', brk: 'recharge-below-the-step-list',
    what: 'card 9 and card 28 rebuilt: a HYPER BEAM that kills. `self: {volatileStatus: '
        + '\'mustrecharge\'}` is applied by `selfDrops`, step 4 of `spreadMoveHit`, and every step below '
        + 'it — including the one that writes `|faint|` — comes after. This engine armed the recharge '
        + 'below the whole step list, so it printed `|faint|` then `|-mustrecharge|`. '
        + 'ONE TURN, and that is a fixture constraint rather than a choice: after a Hyper Beam the '
        + 'authority offers the user only `recharge`, so a second scripted click would not be on the '
        + 'request and would become a silent `pass` on BOTH engines. The Froslass clicks a Shadow Ball '
        + 'into the protecting PARTNER rather than protecting itself — a target behind a Protect is '
        + 'never reached, and the first draft of this arm staged nothing for exactly that reason.',
    counters: { rechargeArmedAtSelfDrops: 1, rechargeSkippedNoTarget: 0 },
    A: [['froslass', '', 'Snow Cloak', ['Shadow Ball', 'Protect']], ['corviknight', '', 'Pressure', ['Protect']],
        ['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]],
    B: [['sylveon', '', 'Pixilate', ['Hyper Beam', 'Protect']], ['snorlax', '', 'Thick Fat', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']]],
    script: [T([{ m: 'shadowball', t: 1 }, PROT], [{ m: 'hyperbeam', t: 0 }, PROT])] },

  { id: 'a3-recharge-control', group: 'A3', kind: 'control', brk: 'recharge-below-the-step-list',
    what: 'the same Hyper Beam into a SNORLAX, which survives it. With no `|faint|` in the turn there '
        + 'is nothing for `|-mustrecharge|` to be above, so moving the arming four steps up must not '
        + 'move a line. Agreeing under the break is what attributes the red arm to the POSITION and '
        + 'not to some second change in the recharge conditions — and the counter reading 1 on BOTH '
        + 'arms says the arming really did happen at step 4 in each.',
    counters: { rechargeArmedAtSelfDrops: 1, rechargeSkippedNoTarget: 0 },
    A: [['snorlax', '', 'Thick Fat', ['Brick Break', 'Protect']], ['corviknight', '', 'Pressure', ['Protect']],
        ['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]],
    B: [['sylveon', '', 'Pixilate', ['Hyper Beam', 'Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['froslass', '', 'Snow Cloak', ['Protect']]],
    script: [T([{ m: 'brickbreak', t: 1 }, PROT], [{ m: 'hyperbeam', t: 0 }, PROT])] },

  { id: 'a3-hitcount-red', group: 'A3', kind: 'red', brk: 'hitcount-in-the-packet-loop',
    what: 'card 39 rebuilt: a DUAL WINGBEAT volley that kills. `-hitcount` is written at '
        + 'battle-actions.ts:978, two lines BELOW `faintMessages()` at :976, and `faintMessages` sets '
        + '`isActive = false` at battle.ts:2563 — so the authority line both comes after `|faint|` AND '
        + 'names the corpse `p2: Tsareena` rather than `p2a:`. `traceCanon` folds the first form to '
        + '`p2:` and leaves the second as `p2a:tsareena`, so the reducer sees both halves.',
    counters: { hitCountLinesDeferred: 1, hitCountNamedACorpse: 1 },
    A: [['corviknight', '', 'Pressure', ['Dual Wingbeat', 'Protect']], ['clefable', '', 'Unaware', ['Protect']],
        ['milotic', '', 'Marvel Scale', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]],
    B: [['tsareena', '', 'Queenly Majesty', ['Trop Kick', 'Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['archaludon', '', 'Sturdy', ['Protect']]],
    script: [T([{ m: 'dualwingbeat', t: 0 }, PROT], [{ m: 'tropkick', t: 1 }, PROT])] },

  { id: 'a3-hitcount-control', group: 'A3', kind: 'control', brk: 'hitcount-in-the-packet-loop',
    what: 'TWO of the same volley into a SNORLAX that survives both. `-hitcount` has no faint to sit '
        + 'below and no corpse to name, so deferring the announcement must not move a line — and the '
        + 'two counters split exactly here: `hitCountLinesDeferred` reads 2 and `hitCountNamedACorpse` '
        + 'reads 0. That split is what separates "the line moved" from "the line changed", and a '
        + 'single `>= 1` bar on either would have been passed by both arms.',
    counters: { hitCountLinesDeferred: 2, hitCountNamedACorpse: 0 },
    A: [['corviknight', '', 'Pressure', ['Dual Wingbeat', 'Protect']], ['clefable', '', 'Unaware', ['Protect']],
        ['milotic', '', 'Marvel Scale', ['Protect']], ['froslass', '', 'Snow Cloak', ['Protect']]],
    B: [['snorlax', '', 'Thick Fat', ['Brick Break', 'Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['archaludon', '', 'Sturdy', ['Protect']]],
    script: [T([{ m: 'dualwingbeat', t: 0 }, PROT], [{ m: 'brickbreak', t: 1 }, PROT]),
             T([{ m: 'dualwingbeat', t: 0 }, PROT], [{ m: 'brickbreak', t: 1 }, PROT])] },

  /* =============================== A4 — THE BERRY AND THE UPKEEP MARKER ========================= */
  { id: 'a4-red', group: 'A4', kind: 'red', brk: 'berry-at-every-group',
    what: 'card 22 rebuilt. A Toxic\'d Snorlax holding a SITRUS BERRY: the badly-poisoned chip is '
        + '`onResidual` order 9, and the berry is `onUpdate`, which the authority runs at '
        + 'battle.ts:2858 — BELOW `add(\'upkeep\')` at :2814 and BELOW `faintMessages()` at :2832. '
        + 'This engine ate at the close of the group that dropped it. THE ONLY ONE OF THE FOUR THAT '
        + 'CHANGES WHO IS ALIVE: a body a later chip in the same walk would kill is dead before the '
        + 'berry can be eaten on the authority, and healed above zero here.',
    counters: { residualBerryAteAfterUpkeep: 1, residualBerryAte: 1,
                residualUpdatePasses: 5, residualUpdateAfterUpkeep: 5 },
    A: [['clefable', '', 'Unaware', ['Toxic', 'Calm Mind', 'Protect']],
        ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']],
        ['incineroar', '', 'Blaze', ['Protect']], ['garchomp', '', 'Rough Skin', ['Protect']]],
    B: [['snorlax', 'Sitrus Berry', 'Thick Fat', ['Amnesia', 'Protect']],
        ['milotic', '', 'Marvel Scale', ['Recover', 'Protect']],
        ['toxapex', '', 'Regenerator', ['Protect']], ['weavile', '', 'Pressure', ['Protect']]],
    script: [T([{ m: 'toxic', t: 0 }, { m: 'irondefense' }], [{ m: 'amnesia' }, { m: 'recover' }]),
             T([{ m: 'calmmind' }, { m: 'irondefense' }], [{ m: 'amnesia' }, { m: 'recover' }]),
             T([{ m: 'calmmind' }, { m: 'irondefense' }], [{ m: 'amnesia' }, { m: 'recover' }]),
             T([{ m: 'calmmind' }, { m: 'irondefense' }], [PROT, PROT]),
             T([PROT, PROT], [PROT, PROT])] },

  { id: 'a4-control-sandstorm', group: 'A4', kind: 'control', brk: 'berry-at-every-group',
    what: 'THE OVER-FIRE CONTROL FOR THE WHOLE OF A4, AND IT IS THE ONE THAT NEARLY WENT WRONG. The '
        + 'weather is the ONE residual that runs an Update INSIDE the walk: every weather condition '
        + 'ends its `onFieldResidual` with `eachEvent(\'Weather\')`, and `eachEvent` closes with '
        + '`if (eventid === \'Weather\' && gen >= 7) this.eachEvent(\'Update\')` (battle.ts:473-475). So a '
        + 'Sitrus eaten off the sand chip is eaten BEFORE `|upkeep|`. Moving every berry below the '
        + 'marker would have broken this arm, and it was measured on the authority before a line of '
        + 'the fix was written. '
        + 'THE HP IS SET BY A FRACTION AND NOT BY A DAMAGE ROLL: Curse from a GHOST costs the user '
        + 'exactly half its maximum, which puts Froslass on 73/145 — one point above its own Sitrus '
        + 'threshold — so the order-1 sand chip is what crosses it and nothing here rests on a roll or '
        + 'a crit. It also pins the GRANULARITY: both bodies take their sand chip and THEN the berry '
        + 'is eaten, which is `eachEvent(\'Weather\')` finishing before `eachEvent(\'Update\')` begins. A '
        + 'per-body Update would interleave them, and this arm would part.',
    counters: { residualBerryAte: 1, residualBerryAteAfterUpkeep: 0,
                residualUpdatePasses: 4, residualUpdateAfterUpkeep: 2 },
    A: [['tyranitar', '', 'Sand Stream', ['Iron Defense', 'Protect']],
        ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']],
        ['incineroar', '', 'Blaze', ['Protect']], ['garchomp', '', 'Rough Skin', ['Protect']]],
    B: [['froslass', 'Sitrus Berry', 'Snow Cloak', ['Curse', 'Protect']],
        ['clefable', '', 'Unaware', ['Calm Mind', 'Protect']],
        ['toxapex', '', 'Regenerator', ['Protect']], ['weavile', '', 'Pressure', ['Protect']]],
    script: [T([{ m: 'irondefense' }, { m: 'irondefense' }], [{ m: 'curse', t: 0 }, { m: 'calmmind' }]),
             T([{ m: 'irondefense' }, { m: 'irondefense' }], [PROT, { m: 'calmmind' }])] },

  /* =============================== THE HALF THAT IS NOT FIXED ================================== */
  { id: 'a1-multihit-frequency', group: 'A1', kind: 'known-open', brk: null,
    what: 'A DECLARED, MEASURED, UNFIXED ROW — not a failure and not a pass. Dual Wingbeat into '
        + 'GLIMMORA (Toxic Debris). The authority runs the WHOLE step list once per hit, so it lays a '
        + 'Toxic Spikes layer between the two `-damage` lines; this engine runs the step list once per '
        + 'MOVE, emits both packets, then reacts twice. The COUNT is already right (WIRE 84) and the '
        + 'INTERLEAVING cannot be without converting the hit loop, which is WIRE 20\'s declared '
        + 'granularity divergence and a restructure rather than an ordering fix. Staged here so the '
        + 'claim carries a running measurement instead of a sentence.',
    A: [['corviknight', '', 'Pressure', ['Dual Wingbeat', 'Protect']], ['clefable', '', 'Unaware', ['Protect']],
        ['milotic', '', 'Marvel Scale', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]],
    B: [['glimmora', '', 'Toxic Debris', ['Sludge Bomb', 'Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect']], ['archaludon', '', 'Sturdy', ['Protect']]],
    script: [T([{ m: 'dualwingbeat', t: 0 }, PROT], [{ m: 'sludgebomb', t: 1 }, PROT])] },
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
 * IT MUST BE THE ENGINE INSTANCE THE DRIVER PLAYED. `game_differential.js` binds with
 * `REL.require(...)`, which compiles the snapshot's copy under the snapshot's own path — a different
 * module with its own MEDSEEN. The engine writes `root.MEDSEEN = MEDSEEN` on load and `root` is
 * `globalThis`, so THAT is the object the bytes that actually ran increment. Read as a DELTA around
 * each game, because these counters are process-global and a whole-run total would be a different
 * (and much weaker) claim than "this arm produced exactly this many". */
const ARM_ID = 'bottom-tie-first';
function play(G, c) {
  /* ---- THE ARM IS NAMED, AND THE DEFAULT WOULD HAVE MADE THIS FILE MEANINGLESS -------------------
   * `playGame` defaults to `PRIMARY_ARM`, which is the MIDDLE arm — real seeded dice. Its own header
   * says a game whose per-category draw counts disagree is VOID rather than a divergence, and every
   * damage-bearing arm below hit exactly that: the same Brave Bird read 67/170 on the authority and
   * 71/170 here, purely because the two engines drew a different damage INDEX at a shifted address.
   * That is `test-middle-identity.js`'s open `nth` population and it is not what any arm here is
   * about, so this file pins a CORNER.
   * `bottom-tie-first` and not `top-tie-first`, and the reason is A1: the top corner's `PIN_CHANCE`
   * returns false for every roll, and the authority gates even a chance-100 secondary on
   * `randomChance(100, 100)` (battle-actions.ts `secondaries`). Under the top corner Low Sweep's
   * guaranteed Speed drop DOES NOT FIRE and the arm would be staging nothing. The bottom corner fires
   * every secondary, lands every crit, and takes the minimum damage roll — all deterministic. */
  const arm = G.ARM_BY_ID.get(ARM_ID);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + ARM_ID); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'test-resolution-order :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters() };
}

let bad = 0, ran = 0, knownOpen = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;

  const clean = play(harness(null), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  ran++;

  /* SHORT IS NOT A PASS. In protocol mode a game stops AT the divergence, so a game that played fewer
   * turns than its script WITHOUT a divergence stopped testing and would otherwise read green. */
  const short = clean.r.turns < c.script.length && !clean.r.div;
  /* A CLICK THE AUTHORITY'S REQUEST DID NOT OFFER becomes a silent `pass` on BOTH engines, so the arm
   * agrees while testing nothing. Asserted at EXACT ZERO. */
  const refused = clean.sc.moveNotOnRequest;

  let brk = null;
  if (c.brk) {
    const p = applyBreak(c.brk);
    if (p.err) { console.log('PLANT FAILED  ' + c.id + ' / ' + c.brk + '   ' + p.err); bad++; continue; }
    brk = play(harness(p.src), c);
    harness(null);
  }

  const row = { c, clean, brk, short, refused };
  results.push(row);

  if (c.kind === 'known-open') { knownOpen++; continue; }
  if (short || refused) { bad++; continue; }
  if (clean.r.div) bad++;                                  // every arm must agree clean
  if (c.kind === 'red' && brk && !brk.r.div) bad++;        // a red arm must PART under its break
  if (c.kind === 'control' && brk && brk.r.div) bad++;     // a control must NOT
  for (const [k, want] of Object.entries(c.counters || {})) {
    if (clean.delta[k] !== want) bad++;
  }
}

/* ---- THE REPORT --------------------------------------------------------------------------------- */
for (const { c, clean, brk, short, refused } of results) {
  const verdict = c.kind === 'known-open'
    ? (clean.r.div ? 'KNOWN-OPEN  ' : 'KNOWN-OPEN?')
    : (clean.r.div ? 'PARTS CLEAN ' : short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
       : c.kind === 'red' ? (brk && brk.r.div ? 'RED PROVEN  ' : 'BREAK SILENT')
                          : (brk && brk.r.div ? 'OVER-FIRES  ' : 'CONTROL HELD'));
  console.log(NL + verdict + '  [' + c.group + '] ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  if (c.brk) console.log('    break `' + c.brk + '`: ' + BREAKS[c.brk].what);
  if (clean.r.div) {
    console.log('    CLEAN PARTED at reduced line ' + clean.r.div.index);
    console.log('      showdown  ' + clean.r.div.sdRaw);
    console.log('      medicham  ' + clean.r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(clean.r.div.sdAfterRaw.slice(0, 5)));
    console.log('      medicham next  ' + JSON.stringify(clean.r.div.meAfterRaw.slice(0, 5)));
  }
  if (brk && brk.r && brk.r.div) {
    console.log('    UNDER THE BREAK the streams part at reduced line ' + brk.r.div.index);
    console.log('      showdown  ' + brk.r.div.sdRaw);
    console.log('      medicham  ' + brk.r.div.meRaw);
  } else if (brk) {
    console.log('    UNDER THE BREAK the streams still agree over all ' + brk.r.turns + ' turns');
  }
  for (const [k, want] of Object.entries(c.counters || {})) {
    const got = clean.delta[k];
    console.log('    counter   ' + k.padEnd(28) + (got === want ? '= ' : 'WANT ' + want + ', GOT ')
      + got + (got === want ? '  (exact)' : '   <-- FAIL'));
    if (brk) console.log('              ' + ''.padEnd(28) + 'under the break: ' + brk.delta[k]);
  }
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + knownOpen + ' of them KNOWN-OPEN (declared, not counted), '
  + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — each of the four orderings agrees with the authority, each is shown '
  + 'red under its own surgical revert, and every control holds under that same revert');
process.exit(bad ? 1 : 0);
