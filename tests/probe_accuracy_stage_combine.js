#!/usr/bin/env node
/* tests/probe_accuracy_stage_combine.js — IS THE ACCURACY STAGE AND THE EVASION STAGE ONE NUMBER?
 *   node tests/probe_accuracy_stage_combine.js          the clean arm
 *   node tests/probe_accuracy_stage_combine.js --red    under MEDI_ACC_EVA_SEPARATE=1
 * ==================================================================================================
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *     sim/battle-actions.ts:713-727   hitStepAccuracy
 *       let boost = 0;
 *       if (!move.ignoreAccuracy) {
 *         const boosts = this.battle.runEvent('ModifyBoost', pokemon, null, null, {...pokemon.boosts});
 *         boost = this.battle.clampIntRange(boosts['accuracy'], -6, 6);
 *       }
 *       if (!move.ignoreEvasion) {
 *         const boosts = this.battle.runEvent('ModifyBoost', target, null, null, {...target.boosts});
 *         boost = this.battle.clampIntRange(boost - boosts['evasion'], -6, 6);
 *       }
 *       if (boost > 0)      { accuracy = this.battle.trunc(accuracy * (3 + boost) / 3); }
 *       else if (boost < 0) { accuracy = this.battle.trunc(accuracy * 3 / (3 - boost)); }
 *
 * ONE SUBTRACTION, ONE CLAMP, ONE TABLE LOOKUP, ONE TRUNCATION. Champions does NOT override
 * `hitStepAccuracy` — the only `ignoreAccuracy` / `ignoreEvasion` text in
 * `data/mods/champions/scripts.ts` is inside the `multiaccuracy` branch of `hitStepMoveHitLoop`,
 * which is a different function and a different question (asserted below, from the file).
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 *     engine/medicham2-browser.js   if(_ab)acc*=accStageMul(_ab);
 *                                   if(_eb)acc/=accStageMul(_eb);
 *
 * Two lookups, MULTIPLIED, with no combined clamp and no truncation. -1 accuracy into +1 evasion is
 * 56.25 here against 60 there, and at the caps it is 11.1 against 33.3.
 *
 * AND THE OBVIOUS SENTENCE — "they agree whenever one side is zero" — IS FALSE, WHICH IS WHY THE
 * `trunc-one-sided` AND `trunc-eva6` ARMS EXIST. They agree when one side is zero AND the result is
 * an integer. 95 printed at +1 evasion alone is 71.25 here and 71 there; 80 printed at +6 evasion
 * alone is 26.667 here and 26 there. The second of those is the exact board the census row
 * `ability|accuracyMod — the bot PRICES an evasive body` stages, and it had been asserting 0.2667.
 *
 * ================= WHY NOTHING SAW IT ===========================================================
 *
 * Every accuracy row in `data/mechanics-census.json` varies ONE side. `item|accuracyMod` leaves the
 * attacker unboosted, `move|accuracyMod` moves each modifier alone, `ability|ignoresEvasion` moves
 * evasion only. **Nothing put a non-zero accuracy stage and a non-zero evasion stage on the board at
 * the same time**, so no existing probe could have gone red on this and all of them stay green
 * straight through the fix. That is why every LIVE arm below sets BOTH.
 *
 * ================= HOW IT IS MEASURED ===========================================================
 *
 * Nothing here is typed as an expected accuracy. Both engines are ASKED:
 *
 *   - the AUTHORITY is instrumented at `BattleActions.prototype.hitStepAccuracy` itself. The wrapper
 *     writes the two stages onto the live bodies and then captures the number the authority hands to
 *     `randomChance(accuracy, 100)` — the last line of that function, and the number that decides
 *     hit or miss. The stages are INJECTED because the format offers only Coil / Mud-Slap / Muddy
 *     Water / Night Daze and Double Team / Minimize / Sweet Scent to move them, and reaching +-6
 *     through those is a fixture problem, not a mechanic.
 *   - MEDICHAM2 is asked `hitChance`, which is the function its four roll sites call: the roll is
 *     `if(!accMustRoll(acc)||_R.acc()*100<=acc)`, so `hitChance`'s return IS its rolled accuracy.
 *
 * and then the NUMBER IS TIED TO A BOARD: every arm spends a real medicham turn at a constant die
 * chosen to sit between the two engines' answers, and the HP the target loses says whether the click
 * landed. A number that agrees and a board that does not would be caught here.
 *
 * ================= THE CONTROLS, WHICH ARE THE POINT ============================================
 *
 *   both-zero      no stage on either side. Identical before and after — anything that moves here is
 *                  a fix that changed the unboosted case, which is 99% of every game played.
 *   acc-only       a MINUS accuracy stage with evasion at zero, on a PRINTED-100 move so the result
 *                  is a whole number and the truncation has nothing to take. MUST NOT move — it is
 *                  what says the fix is narrow rather than "accuracy went up".
 *   eva-only       a PLUS evasion stage with accuracy at zero, printed 100 for the same reason.
 *   keeneye        the attacker's ability sets `move.ignoreEvasion`, so the authority SKIPS the whole
 *                  second clause and the boost stays at the accuracy stage alone. Both stages are
 *                  non-zero on the board and the answer must still be the accuracy-only one. This is
 *                  the composition check for the `ignoresEvasion` consumer that already sat two lines
 *                  above the arithmetic being rewritten.
 *
 * and one arm reverses the DIRECTION — +1 accuracy into +2 evasion is 80 here and 75 there — so a fix
 * that simply made everything more accurate cannot pass.
 */
'use strict';

const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ACC_EVA_SEPARATE = '1';
if (!process.argv.includes('--turns')) process.argv.splice(2, 0, '--turns', '1');

const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const M = ER.open().require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const NL = String.fromCharCode(10);

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- DERIVED FACTS, PRINTED, NEVER TYPED -------------------------------------------------------- */
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LEGAL_MOVES = dex.moves.all().filter(legal);
const IGN_ACC = LEGAL_MOVES.filter(m => m.ignoreAccuracy).map(m => m.id);
const IGN_EVA = LEGAL_MOVES.filter(m => m.ignoreEvasion).map(m => m.id);
const MULTIACC = LEGAL_MOVES.filter(m => m.multiaccuracy).map(m => m.id);
{
  const champScripts = fs.readFileSync(process.env.SHOWDOWN_PATH + '/data/mods/champions/scripts.ts', 'utf8');
  const overridesHitStep = /hitStepAccuracy/.test(champScripts);
  console.log('legal moves carrying ignoreAccuracy: ' + IGN_ACC.length
    + (IGN_ACC.length ? '  -> ' + IGN_ACC.join(' ') : '  (so that clause can never be taken here)'));
  console.log('legal moves carrying ignoreEvasion:  ' + IGN_EVA.length
    + (IGN_EVA.length ? '  -> ' + IGN_EVA.join(' ') : ''));
  console.log('legal moves carrying multiaccuracy:  ' + MULTIACC.length
    + (MULTIACC.length ? '  -> ' + MULTIACC.join(' ') : '')
    + '   (Champions gives hits 2..n their OWN separate-multiply block; hit 1 goes through '
    + 'hitStepAccuracy like every other move)');
  console.log('Champions overrides hitStepAccuracy: ' + (overridesHitStep ? 'YES' : 'NO')
    + '   (the mod file mentions the two ignore flags only inside hitStepMoveHitLoop’s multiaccuracy branch: '
    + (/ignoreEvasion/.test(champScripts) ? 'present' : 'absent') + ')');
  const accMovers = LEGAL_MOVES.filter(m => /"accuracy":-?\d/.test(JSON.stringify(m.boosts || {}))
    || /accuracy/.test(JSON.stringify(m.self || {}))
    || /accuracy/.test(JSON.stringify(m.secondaries || m.secondary || {}))).map(m => m.id);
  const evaMovers = LEGAL_MOVES.filter(m => /evasion/.test(JSON.stringify(m.boosts || {}))
    || /evasion/.test(JSON.stringify(m.self || {}))
    || /evasion/.test(JSON.stringify(m.secondaries || m.secondary || {}))).map(m => m.id);
  console.log('legal moves that move the ACCURACY stage: ' + accMovers.join(' '));
  console.log('legal moves that move the EVASION  stage: ' + evaMovers.join(' '));
}

/* ---- THE AUTHORITY'S OWN NUMBER, INSTRUMENTED --------------------------------------------------
 * The two stages are written onto the live bodies at the top of `hitStepAccuracy`, and the number
 * captured is the argument the SAME call passes to `randomChance(accuracy, 100)` on its last line. */
const BA = require(process.env.SHOWDOWN_PATH + '/dist/sim/battle-actions').BattleActions;
const INJ = { on: false, moveId: '', acc: 0, eva: 0, rolled: null, printed: null, calls: 0, rolls: 0 };
const _origHitStep = BA.prototype.hitStepAccuracy;
BA.prototype.hitStepAccuracy = function (targets, pokemon, move) {
  const mine = INJ.on && move && move.id === INJ.moveId
    && pokemon && pokemon.side && pokemon.side.id === 'p2';
  if (!mine) return _origHitStep.call(this, targets, pokemon, move);
  INJ.calls++;
  INJ.printed = move.accuracy;
  pokemon.boosts.accuracy = INJ.acc;
  for (const t of targets) if (t) t.boosts.evasion = INJ.eva;
  const b = this.battle;
  const had = Object.prototype.hasOwnProperty.call(b, 'randomChance');
  const rc = b.randomChance;
  b.randomChance = function (n, d) {
    if (d === 100 && INJ.rolled === null) { INJ.rolled = n; INJ.rolls++; }
    return rc.call(this, n, d);
  };
  try { return _origHitStep.call(this, targets, pokemon, move); }
  finally { if (had) b.randomChance = rc; else delete b.randomChance; }
};

/* ---- THE FIXTURE -------------------------------------------------------------------------------- */
const ATT = 'lycanrocmidnight';   /* learns Crunch (100) and Rock Tomb (95); ability 0 is Keen Eye */
const DEF = 'milotic';
const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
const BENCH = (...n) => n.map(s => mon(s, '', ['Protect']));
const P = { m: 'protect' };

/* ARMS. `want` is never typed — it is whatever the authority's own instrumented number turns out to
 * be. What IS declared per arm is whether the two engines must AGREE (a control) or must PART under
 * the --red knob (a live arm). */
const CASES = [
  { id: 'middle', live: true, mv: 'crunch', acc: -1, eva: 1,
    name: 'LIVE      -1 accuracy into +1 evasion',
    what: 'The video\'s own sentence and the smallest case in which both stages are non-zero. '
        + 'Combined: boost = -2. Multiplied: (3/4) / (4/3).' },
  { id: 'middle-2', live: true, mv: 'crunch', acc: -2, eva: 2,
    name: 'LIVE      -2 accuracy into +2 evasion',
    what: 'Combined: boost = -4, and 3/7 of 100 is not an integer, so this arm also carries the '
        + 'truncation.' },
  { id: 'caps', live: true, mv: 'crunch', acc: -6, eva: 6,
    name: 'LIVE      the CAPS — -6 accuracy into +6 evasion',
    what: 'The SECOND clamp is the whole arm: -6 - 6 is -12 and must come back as -6. Multiplied it '
        + 'is (3/9)/3; combined it is 3/9.' },
  { id: 'reverse', live: true, mv: 'crunch', acc: 1, eva: 2,
    name: 'LIVE      +1 accuracy into +2 evasion — the DIRECTION REVERSES',
    what: 'Combined: boost = -1, so the authority is LESS accurate than this engine here. A fix that '
        + 'just made everything more accurate fails this arm.' },
  { id: 'trunc', live: true, mv: 'rocktomb', acc: -1, eva: 2,
    name: 'LIVE      a 95-printed move, -1 accuracy into +2 evasion — the TRUNCATION arm',
    what: 'Combined without truncating is 47.5; the authority truncates to 47. Multiplied it is '
        + '42.75. This arm separates all three.' },

  /* THE TWO ARMS BELOW HOLD ONE STAGE AT ZERO AND STILL PART, WHICH CORRECTS THE SENTENCE THIS FILE
   * OPENED WITH. The two forms are the same ALGEBRA when one side is zero; they are the same NUMBER
   * only when the result is an integer. A one-sided stage on a 95- or 80-printed move is not, and the
   * authority throws the fraction away where this engine kept it. The second arm is the exact
   * configuration of the existing census row `ability|accuracyMod — the bot PRICES an evasive body`,
   * whose typed 0.2667 was pinning the untruncated value; this measures what it should read. */
  { id: 'trunc-one-sided', live: true, mv: 'rocktomb', acc: 0, eva: 1,
    name: 'LIVE      a 95-printed move at +1 evasion ALONE — one stage zero and it STILL parts',
    what: '95 * 3/4 is 71.25. The authority truncates to 71; the old arithmetic kept 71.25.' },
  { id: 'trunc-eva6', live: true, mv: 'stoneedge', acc: 0, eva: 6,
    name: 'LIVE      an 80-printed move at +6 evasion — the existing census row’s own board',
    what: '80 * 3/9 is 26.667. The authority truncates to 26, and `the bot PRICES an evasive body` '
        + 'has been asserting 0.2667 since it was written.' },

  { id: 'both-zero', live: false, mv: 'crunch', acc: 0, eva: 0,
    name: 'CONTROL   no stage on either side',
    what: 'The 99% case. Identical before and after, or the fix reached every game ever played.' },
  { id: 'acc-only', live: false, mv: 'crunch', acc: -1, eva: 0,
    name: 'CONTROL   -1 accuracy, evasion ZERO',
    what: 'One side zero makes the two forms algebraically identical. MUST NOT MOVE — this is what '
        + 'says the fix is the COMBINATION and not "accuracy changed".' },
  { id: 'eva-only', live: false, mv: 'crunch', acc: 0, eva: 2,
    name: 'CONTROL   +2 evasion, accuracy ZERO',
    what: 'The other side of the same control, and it is the shape every existing census row has.' },
  { id: 'keeneye', live: false, mv: 'crunch', acc: -1, eva: 2, ability: 'Keen Eye',
    name: 'CONTROL   both stages non-zero, but the attacker IGNORES evasion',
    what: 'Keen Eye sets move.ignoreEvasion, so the authority never takes the second clause and the '
        + 'boost stays at the accuracy stage alone. The board carries BOTH stages and the answer must '
        + 'still be the accuracy-only one — the composition check for the consumer that sits two '
        + 'lines above the arithmetic being rewritten.' },
];

/* ---- THE FIXTURE'S OWN LEGALITY, DERIVED -------------------------------------------------------- */
{
  let bad = 0;
  const rows = [];
  for (const c of CASES) rows.push(mon(ATT, c.ability || 'Vital Spirit', ['Crunch', 'Rock Tomb', 'Stone Edge', 'Protect']));
  rows.push(mon(DEF, 'Marvel Scale', ['Scald', 'Protect']));
  const seen = new Set();
  for (const row of rows) {
    const key = row.species + '|' + row.ability + '|' + row.moves.join(',');
    if (seen.has(key)) continue; seen.add(key);
    const sp = dex.species.get(row.species);
    if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); bad++; continue; }
    if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
      .includes(dex.abilities.get(row.ability).id)) {
      console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); bad++;
    }
    for (const mv of row.moves) {
      if (!legal(dex.moves.get(mv))) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); bad++; continue; }
      if (!CS.canLearn(row.species, dex.moves.get(mv).id)) {
        console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + dex.moves.get(mv).name); bad++;
      }
    }
  }
  if (bad) { console.log(NL + 'NOT RUN — ' + bad + ' illegal fixture row(s). This is not a pass.'); process.exit(2); }
  console.log('fixture: every species, ability and move checked against the format — ' + seen.size + ' rows LEGAL');
}

/* ---- MEDICHAM'S OWN NUMBER, AND ITS BOARD ------------------------------------------------------- */
const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none'; return b; };
const FIELD = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, sgA: {}, sgB: {} };
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

function mediAccuracy(c) {
  const att = bare(ATT), def = bare(DEF);
  att.moves = ['crunch', 'rocktomb', 'stoneedge', 'protect'];
  if (c.ability) att.ability = dex.abilities.get(c.ability).id;
  att.boosts.acc = c.acc; def.boosts.eva = c.eva;
  return M.hitChance(att, def, c.mv, Object.assign({}, FIELD), {});
}
/* THE NUMBER TIED TO A BOARD. One real turn at a constant die, and the reading is the HP the target
 * actually lost. `die` is chosen per arm to sit between the two engines' answers where they part and
 * anywhere at all where they agree; the EXPECTATION is computed from the AUTHORITY's instrumented
 * number, never typed. */
function mediLands(c, die) {
  const att = bare(ATT), ally = bare('corviknight');
  const f1 = bare(DEF), f2 = bare(DEF);
  att.moves = ['crunch', 'rocktomb', 'stoneedge', 'protect'];
  if (c.ability) att.ability = dex.abilities.get(c.ability).id;
  f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
  const S = M.battleInit([att, ally], [f1, f2], { seeded: true });
  att.boosts.acc = c.acc; f1.boosts.eva = c.eva;
  const before = f1.curHP;
  M.battleTurn(S, () => die,
    new Map([[att, M.playerAction(att, c.mv, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return (before - f1.curHP) > 0;
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
let fails = 0;
const claim = (ok, what, detail) => {
  console.log('    ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '            ' + detail : ''));
  if (!ok) fails++;
};

console.log(NL + (RED ? 'RED ARM — MEDI_ACC_EVA_SEPARATE=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM')
  + '   mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + NL);

let sawAuthority = 0;
for (const c of CASES) {
  console.log(NL + c.id + '   ' + c.name);
  console.log('    ' + c.what);
  const attRow = mon(ATT, c.ability || 'Vital Spirit', ['Crunch', 'Rock Tomb', 'Stone Edge', 'Protect']);
  const a = G.buildPair([mon(DEF, 'Marvel Scale', ['Scald', 'Protect']),
                         mon('corviknight', 'Pressure', ['Protect'])].concat(BENCH('snorlax', 'toxapex')));
  const b = G.buildPair([attRow, mon('clefable', 'Magic Guard', ['Protect'])]
                        .concat(BENCH('garchomp', 'tyranitar')));
  if (!a || !b) { console.log('    NOT-STAGED  (this is not a pass)'); fails++; continue; }

  INJ.on = true; INJ.moveId = c.mv; INJ.acc = c.acc; INJ.eva = c.eva;
  INJ.rolled = null; INJ.printed = null; INJ.calls = 0; INJ.rolls = 0;
  const r = G.playGame(a, b, 'directed', 'probe_accuracy_stage_combine :: ' + c.id,
    { script: [{ p1: [{ m: 'scald', t: 0 }, P], p2: [{ m: c.mv, t: 0 }, P] }], arm: ARM });
  INJ.on = false;
  if (r.err) { console.log('    THREW  ' + r.err); fails++; continue; }

  const sdAcc = INJ.rolled;
  const meAcc = mediAccuracy(c);
  const printed = INJ.printed;
  sawAuthority += (INJ.rolls > 0 ? 1 : 0);

  console.log('    authority  printed ' + printed + '   ROLLED AGAINST ' + sdAcc
    + '   (hitStepAccuracy calls ' + INJ.calls + ', randomChance(_,100) ' + INJ.rolls + ')');
  console.log('    medicham   printed ' + M.printedAccuracy(c.mv, Object.assign({}, FIELD))
    + '   hitChance ' + (typeof meAcc === 'number' ? meAcc.toFixed(4) : meAcc));

  /* THE PREMISES, ASSERTED — a fixture that did not do what the arm needs is not a result. */
  claim(INJ.calls === 1 && INJ.rolls === 1,
    c.id + ' — PREMISE: the authority took the accuracy step exactly once and rolled once',
    'calls ' + INJ.calls + ', rolls ' + INJ.rolls + '   (zero means the injection missed the live path)');
  claim(printed === M.printedAccuracy(c.mv, Object.assign({}, FIELD)),
    c.id + ' — PREMISE: both engines start from the same PRINTED accuracy',
    'authority ' + printed + ', medicham ' + M.printedAccuracy(c.mv, Object.assign({}, FIELD)));

  /* THE CLAIM: the two engines roll against the same number. */
  const agree = Math.abs(meAcc - sdAcc) < 1e-9;
  const want = RED ? !c.live : true;
  claim(agree === want,
    c.id + ' — the two engines roll against the SAME accuracy'
      + (RED ? (c.live ? '  [--red: MUST PART]' : '  [--red: a control, MUST NOT move]') : ''),
    'showdown ' + sdAcc + ', medicham ' + (typeof meAcc === 'number' ? meAcc.toFixed(4) : meAcc)
    + (agree === want ? '' : (RED && c.live ? '   — the knob did not reach the engine'
      : '   — ' + (agree ? 'unexpected agreement' : 'they disagree'))));

  /* THE NUMBER TIED TO A BOARD. Two dice per arm, straddling the AUTHORITY's number, so the claim is
   * about a landed hit and not about a float. Skipped only when the authority's number is at or above
   * 100 on both sides, where no die can separate anything. */
  if (sdAcc !== null && sdAcc < 100) {
    const lo = Math.max(0, (sdAcc - 2) / 100), hi = Math.min(0.999, (sdAcc + 2) / 100);
    const landsLo = mediLands(c, lo), landsHi = mediLands(c, hi);
    const wantLo = lo * 100 <= sdAcc, wantHi = hi * 100 <= sdAcc;
    const boardOk = (landsLo === wantLo) && (landsHi === wantHi);
    console.log('    board      die ' + lo.toFixed(4) + ' -> ' + (landsLo ? 'HIT' : 'miss')
      + '   die ' + hi.toFixed(4) + ' -> ' + (landsHi ? 'HIT' : 'miss')
      + '   (the authority would ' + (wantLo ? 'HIT' : 'miss') + ' / '
      + (wantHi ? 'HIT' : 'miss') + ')');
    claim(boardOk === want,
      c.id + ' — A REAL TURN lands exactly where the AUTHORITY’s number says it should'
        + (RED ? (c.live ? '  [--red: MUST PART]' : '  [--red: a control, MUST NOT move]') : ''),
      'die ' + lo.toFixed(4) + '/' + hi.toFixed(4) + ' -> ' + (landsLo ? 'HIT' : 'miss') + '/'
      + (landsHi ? 'HIT' : 'miss') + ', authority says ' + (wantLo ? 'HIT' : 'miss') + '/'
      + (wantHi ? 'HIT' : 'miss'));
  } else {
    console.log('    board      NOT SEPARABLE — the authority rolls against ' + sdAcc
      + ', which no die can miss');
  }
}

/* THE KNOB ITSELF, ASSERTED ON BOTH ARMS — a knob that reached no module reads as a held control. */
claim((M.fails.accEvaSeparateRestored | 0) === (RED ? 1 : 0),
  'the knob stamp is ' + (RED ? 'PRESENT under --red' : 'ABSENT on the clean arm'),
  'MEDFAILS.accEvaSeparateRestored = ' + (M.fails.accEvaSeparateRestored | 0));
claim(sawAuthority === CASES.length, 'the authority instrument reached every arm',
  sawAuthority + ' of ' + CASES.length + '   (a short count means the prototype patch missed the live path)');
claim(IGN_ACC.length === 0, 'the ignoreAccuracy clause has no carrier in this format, as the engine says',
  IGN_ACC.length + ' legal moves carry it');

console.log(NL + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'GREEN — every assertion held'));
process.exit(fails ? 1 : 0);
