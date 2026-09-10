/* probe_delayed_hit_immune.js — A FUTURE SIGHT THAT COMES DUE ON A BODY IMMUNE TO ITS TYPE WRITES `-end`
 * AND `-immune` AND DRAWS NO DIE. THIS ENGINE DREW TWO DICE AND WROTE NOTHING.
 * 2026-09-09, narration batch Y.
 *
 *   SHOWDOWN_PATH=... node tests/probe_delayed_hit_immune.js
 *   SHOWDOWN_PATH=... node tests/probe_delayed_hit_immune.js --release <id> --only futuresight-into-a-dark-body
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `b0f5c159c46e`, 961 games on the pinned pool:
 *
 *     event missing from medicham2 :: |-end|p2a|futuresight <> |-sideend|p1:|reflect
 *
 * and the game itself (`omit-spread`, seed …bo3-2657358877 vs …2657413811, turn 5, residual):
 *
 *     showdown   |-end|p2a: Morpeko|move: Future Sight
 *                |-immune|p2a: Morpeko
 *     medicham2  (nothing — the next line is Reflect's `-sideend`)
 *
 * Before the instrument edit of ROADMAP #551 this game was VOID as `low-identity`, because this engine
 * spent `crit|futuresight` and `dmg|futuresight` into a Dark type the authority never rolled for. The
 * lines are the visible half; the dice are the half that voided a game.
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * `futuremove.onEnd`, data/conditions.ts:395-415 (no Champions override — asserted below):
 *
 *     if (target.fainted || target === data.source) { this.hint(...); return; }
 *     this.add('-end', target, 'move: ' + move.name);                 <- unconditional from here
 *     target.removeVolatile('Protect'); target.removeVolatile('Endure');
 *     ...
 *     const hitMove = new this.dex.Move(data.moveData) as ActiveMove;
 *     this.actions.trySpreadMoveHit([target], data.source, hitMove, true);
 *
 * `trySpreadMoveHit` walks the step list; step 2 is `hitStepTypeImmunity` (sim/battle-actions.ts:654),
 * which calls `runImmunity(move, true)`: for a type the chart refuses it writes `|-immune|TARGET` and
 * returns false, and the move-hit loop — where `getDamage` rolls crit and damage — is never entered.
 * The booked `moveData` carries `ignoreImmunity: false` (data/moves.ts:6408), which is what lets
 * step 2 bite; the CLICK carries `ignoreImmunity: true`, which is why the booking turn never refuses.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * The payout block in `condition:futuremove`'s residual priced the body first (`dmgRange`), drew the
 * crit die and the dmg die, and only then asked `if (_d.max > 0)` — and wrote `-end` INSIDE that
 * guard. A type-immune body prices at zero, so the two dice were spent and neither line was written.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION.
 * `MEDI_DELAYED_HIT_SILENT_IMMUNE=1` is the revert knob and restores exactly the pre-2026-09-09 road,
 * so a RED arm is one that agrees clean and PARTS under the knob, and a CONTROL is one that agrees under
 * BOTH. The knob is proved to have reached the module the driver played, by a load-time stamp in
 * `MEDFAILS`, before any verdict is read.
 *
 * ================= THE CONTROLS, AND WHY EACH ONE EXISTS ========================================
 *
 * `futuresight-into-a-neutral-body` is THE KNOB CLEARED EXPLICITLY: the same Slowking, the same click,
 * the same slot, and ONE field moved — the collector is Normal-typed, so Psychic connects. The payout
 * must land on both loads, `-end` must be written once (not twice, not zero times — the hoisted line
 * and the knob-only line are the same line and must never both fire), and the crit die must be drawn.
 * A fix that hoisted `-end` and forgot to gate the old site writes it twice here.
 *
 * `psychic-into-a-dark-body` is the OTHER ROAD: the same immune body, the same type, but a DIRECT
 * click. `_stepTypeImm` already answers it and must be untouched — the fix lives in the residual
 * payout and must not have leaked into the step list.
 *
 * `futuresight-into-a-dark-body` asserts THREE counters in both directions: `delayedHitImmune` (the
 * new road fired), `delayedHitCritDrawn` (the die was NOT spent — the second half of the defect, and
 * the half that voided a game), and `delayedHitLanded` (nothing landed on either load).
 *
 * ================= WHAT IS OBSERVED AND NOT ASSERTED ===========================================
 *
 * The authority's payout runs `hitStepAccuracy` on a printed 100, which is a real `randomChance(100,
 * 100)` draw; this engine's payout takes no `acc` draw. That is a die-count gap on every landing
 * payout, tolerated by the identity floor, and it is NOT this batch's mechanism. The neutral arm
 * PRINTS both engines' `acc|futuresight` address counts so the gap is on the record with a number
 * rather than left to be rediscovered. Folding it in here would be a second behaviour change riding on
 * a narration fix, on a family with one row in the pinned pool.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_delayed_hit_immune.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_DELAYED_HIT_SILENT_IMMUNE';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FIXTURE ------------------------------------------------------------------------------
 * THREE TURNS: the booking, a filler, and the turn whose residual pays out (the census probe
 * `move/delayedHit` measured the payout on the THIRD turn after a turn-1 click, not the second, and
 * this fixture is shaped by that measurement rather than by the `(turn - 1) + 2` arithmetic). The
 * booker clicks Calm Mind on turns 2 and 3 so the occupied slot never produces the `-fail` line a
 * second Future Sight would. Every partner clicks a self-boost so that no slot can run out of a legal
 * choice inside the turn. The collector clicks Curse and not Protect: Future Sight's payout removes
 * Protect explicitly in the authority, and a shield in the fixture would stage a second question. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const CM = { m: 'calmmind' };
const SD = { m: 'swordsdance' };
const CURSE = { m: 'curse' };

const KING = ['slowking', '', 'Oblivious', ['Future Sight', 'Psychic', 'Calm Mind', 'Protect']];
const A_TAIL = [['clefable', '', 'Unaware', ['Calm Mind', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Rest']],
                ['corviknight', '', 'Pressure', ['Protect']]];
const B_TAIL = [['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];
const DARK_BODY = ['umbreon', '', 'Inner Focus', ['Curse', 'Protect']];
const NEUTRAL_BODY = ['snorlax', '', 'Thick Fat', ['Curse', 'Protect']];

const bookThenWait = mv => [
  { p1: [{ m: mv, t: 0 }, CM], p2: [CURSE, SD] },
  { p1: [CM, CM], p2: [CURSE, SD] },
  { p1: [CM, CM], p2: [CURSE, SD] },
];

const CASES = [
  { id: 'futuresight-into-a-dark-body', kind: 'red',
    a: [KING].concat(A_TAIL), b: [DARK_BODY].concat(B_TAIL), script: bookThenWait('futuresight'),
    immClean: 1, immKnob: 0, critClean: 0, critKnob: 1, landedClean: 0, landedKnob: 0,
    what: 'THE CARD, REBUILT. Slowking books Future Sight on a Dark-typed Umbreon. Two turns later the '
        + 'authority writes `|-end|…|move: Future Sight` then `|-immune|…` and never reaches getDamage; '
        + 'this engine priced the body at zero, spent the crit and dmg dice on it, and wrote nothing.' },

  { id: 'futuresight-into-a-neutral-body', kind: 'control',
    a: [KING].concat(A_TAIL), b: [NEUTRAL_BODY].concat(B_TAIL), script: bookThenWait('futuresight'),
    immClean: 0, immKnob: 0, critClean: 1, critKnob: 1, landedClean: 1, landedKnob: 1,
    what: 'THE KNOB CLEARED EXPLICITLY — the same booker, the same click, the same slot, and ONE field '
        + 'moved: the collector is a Normal-typed Snorlax. The payout must land on both loads with '
        + 'exactly one `-end` line; the crit die is drawn on both loads.' },

  { id: 'psychic-into-a-dark-body', kind: 'control',
    a: [KING].concat(A_TAIL), b: [DARK_BODY].concat(B_TAIL), script: bookThenWait('psychic'),
    immClean: 0, immKnob: 0, critClean: 0, critKnob: 0, landedClean: 0, landedKnob: 0,
    what: 'THE OTHER ROAD. A direct Psychic into the same Dark body is refused by `_stepTypeImm`, which '
        + 'this fix does not touch; the residual payout counters must stay at zero on both loads and '
        + 'the streams must agree.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
const seen = new Set();
for (const c of CASES) for (const row of c.a.concat(c.b)) {
  const key = row[0] + '|' + row[3].join(',');
  if (seen.has(key)) continue; seen.add(key);
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
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE PREMISES, DERIVED ON EVERY RUN -------------------------------------------------------- */
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const champMoves = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const champConds = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'conditions.ts'), 'utf8');
  const champScripts = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const mainConds = fs.readFileSync(path.join(SP, 'data', 'conditions.ts'), 'utf8');
  const bad = [];
  const fs_ = dex.moves.get('futuresight');
  console.log('futuresight: type ' + fs_.type + ', ignoreImmunity (click) ' + JSON.stringify(fs_.ignoreImmunity)
    + ', flags ' + JSON.stringify(fs_.flags));
  const fm = mainConds.slice(mainConds.indexOf('\tfuturemove: {'));
  const fmBlock = fm.slice(0, fm.indexOf('\n\t},') + 4);
  const endIdx = fmBlock.indexOf("this.add('-end', target, 'move: ' + move.name)");
  const hitIdx = fmBlock.indexOf('trySpreadMoveHit([target], data.source, hitMove, true)');
  console.log('futuremove.onEnd: `-end` at offset ' + endIdx + ', trySpreadMoveHit at offset ' + hitIdx
    + ' (the line is ABOVE the hit: ' + (endIdx > 0 && hitIdx > endIdx) + ')');
  console.log('DOES CHAMPIONS REWRITE futuresight / futuremove / hitStepTypeImmunity? '
    + (/^\tfuturesight: \{/m.test(champMoves) ? 'YES' : 'no') + ' / '
    + (/^\tfuturemove: \{/m.test(champConds) ? 'YES' : 'no') + ' / '
    + (/hitStepTypeImmunity\s*\(/.test(champScripts) ? 'YES' : 'no'));
  console.log('collector types: umbreon ' + JSON.stringify(dex.species.get('umbreon').types)
    + '   snorlax ' + JSON.stringify(dex.species.get('snorlax').types)
    + '   Psychic into Dark immune: ' + (dex.getImmunity('Psychic', dex.species.get('umbreon').types) === false));
  if (fs_.type !== 'Psychic') bad.push('Future Sight is no longer Psychic');
  if (!(endIdx > 0 && hitIdx > endIdx)) bad.push('futuremove.onEnd no longer writes -end above trySpreadMoveHit; the derivation above is stale');
  if (!/ignoreImmunity:\s*false/.test(fmBlock) && !/ignoreImmunity:\s*false/.test(fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8').slice(fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8').indexOf('\tfuturesight: {'), fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8').indexOf('\tfuturesight: {') + 1200)))
    bad.push('the booked moveData no longer carries ignoreImmunity: false');
  if (/^\tfuturesight: \{/m.test(champMoves)) bad.push('Champions now overrides Future Sight');
  if (/^\tfuturemove: \{/m.test(champConds)) bad.push('Champions now overrides the futuremove condition');
  if (/hitStepTypeImmunity\s*\(/.test(champScripts)) bad.push('Champions now overrides hitStepTypeImmunity');
  if (dex.getImmunity('Psychic', dex.species.get('umbreon').types) !== false) bad.push('the red arm\'s collector is no longer immune to Psychic');
  if (dex.getImmunity('Psychic', dex.species.get('snorlax').types) === false) bad.push('the cleared-knob control\'s collector is immune to Psychic');
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.a)), b = G.buildPair(stage(c.b));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_delayed_hit_immune :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  let addr = null;
  try {
    const A = G.midAddresses ? G.midAddresses() : null;
    if (A) addr = { sd: (A.sd || []).filter(x => /acc\|futuresight/.test(String(x))).length,
                    me: (A.me || []).filter(x => /acc\|futuresight/.test(String(x))).length };
  } catch (e) {
    /* CLOSE PASS 5.277.0 -- the reader THREW, which is not the same fact as "no reader" (the null above).
     * The address count is diagnostic, so the run goes on, but the reason is printed rather than swallowed. */
    addr = null; console.error('probe_delayed_hit_immune: midAddresses() threw -- ' + (e && e.message));
  }
  return { r, delta, sc: G.scriptCounters(), addr,
    restored: (globalThis.MEDFAILS || {}).delayedHitSilentImmuneRestored || 0,
    zeroBand: (globalThis.MEDFAILS || {}).delayedHitZeroBandUnannounced || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const R = { c, clean, brk, short, refused,
    imm: clean.delta.delayedHitImmune || 0, immK: brk.delta.delayedHitImmune || 0,
    crit: clean.delta.delayedHitCritDrawn || 0, critK: brk.delta.delayedHitCritDrawn || 0,
    landed: clean.delta.delayedHitLanded || 0, landedK: brk.delta.delayedHitLanded || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (R.imm !== c.immClean) fails.push('delayedHitImmune clean is ' + R.imm + ', declared ' + c.immClean);
  if (R.immK !== c.immKnob) fails.push('delayedHitImmune knob is ' + R.immK + ', declared ' + c.immKnob);
  /* THE DIE IS THE SECOND HALF OF THE DEFECT AND IS ASSERTED IN BOTH DIRECTIONS. */
  if (R.crit !== c.critClean) fails.push('delayedHitCritDrawn clean is ' + R.crit + ', declared ' + c.critClean);
  if (R.critK !== c.critKnob) fails.push('delayedHitCritDrawn knob is ' + R.critK + ', declared ' + c.critKnob);
  if (R.landed !== c.landedClean) fails.push('delayedHitLanded clean is ' + R.landed + ', declared ' + c.landedClean);
  if (R.landedK !== c.landedKnob) fails.push('delayedHitLanded knob is ' + R.landedK + ', declared ' + c.landedKnob);
  if (clean.zeroBand) fails.push('delayedHitZeroBandUnannounced is ' + clean.zeroBand + ' on the clean load — a zero band this engine cannot explain');
  if (clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk } = R;
  const verdict = R.short ? 'SHORT        ' : R.refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
      : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       delayedHitImmune ' + R.imm + '/' + c.immClean + ' clean, ' + R.immK + '/' + c.immKnob
    + ' knob   |   delayedHitCritDrawn ' + R.crit + '/' + c.critClean + ' clean, ' + R.critK + '/' + c.critKnob
    + ' knob   |   delayedHitLanded ' + R.landed + '/' + c.landedClean + ' clean, ' + R.landedK + '/' + c.landedKnob + ' knob');
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   zeroBandUnannounced clean ' + clean.zeroBand);
  if (clean.addr) console.log('    OBSERVED, NOT ASSERTED  `acc|futuresight` addresses drawn — showdown ' + clean.addr.sd
    + ', medicham ' + clean.addr.me + '   (the authority\'s payout runs hitStepAccuracy on a printed 100; this engine\'s does not)');
  const d = clean.r.div || brk.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : 'PASS — a delayed hit that comes due on a type-immune body writes the condition\'s `-end` and the '
  + 'target\'s `-immune` and spends no die, the knob puts the red arm apart again, and neither a neutral '
  + 'collector nor a direct click at the same immune body moves at all');
