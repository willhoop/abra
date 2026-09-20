/* probe_fickle_beam_die.js — FICKLE BEAM'S DOUBLE IS DRAWN INSIDE `getDamage`, AFTER THE CRIT, SO IT
 * IS A `crit`-STREAM DRAW AT REPEAT INDEX 1. THIS ENGINE DREW IT OFF THE GENERIC STREAM.
 *
 *   SHOWDOWN_PATH=... node tests/probe_fickle_beam_die.js
 *   SHOWDOWN_PATH=... MEDI_CONDPOWER_OFF_ANY=1 node tests/probe_fickle_beam_die.js
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED ====================================
 *
 * `data/mods/champions/moves.ts` has NO `ficklebeam` key — grepped, not assumed — so mainline
 * governs (`data/moves.ts`). The whole handler is four lines:
 *
 *     ficklebeam.onBasePower(basePower, pokemon) {
 *       if (this.randomChance(3, 10)) {
 *         this.attrLastMove('[anim] Fickle Beam All Out');
 *         this.add('-activate', pokemon, 'move: Fickle Beam');
 *         return this.chainModify(2);
 *
 * WHERE that draw happens is the whole of this probe. `onBasePower` is raised by
 * `runEvent('BasePower', ...)` from INSIDE `BattleActions#getDamage` (sim/battle-actions.ts:1649),
 * and the authority's own comment one line above it says `// happens after crit calculation` — the
 * crit is `randomChance(1, critMult[critRatio])` at :1640, nine lines earlier, in the same call.
 *
 * THE DIFFERENTIAL'S MIDDLE ARM ADDRESSES A DRAW BY ITS CATEGORY, and both of those draws land in
 * the same one. `engine/game_differential.js` wraps `getDamage` as category `dmg`
 * (`around('getDamage', 'dmg', 0)`), and its `chance(num, den)` re-labels `dmg` to **`crit`**
 * (`const cat = (MIDW.cat === 'dmg') ? 'crit' : midAddrCat()`). So on the authority's side Fickle
 * Beam's 30% is `crit | turn | ficklebeam | <target slot> | 1` — the SECOND crit-address draw of
 * that hit, the first being the crit itself.
 *
 * ================= WHAT WAS WRONG ==============================================================
 *
 * `rollConditionalPower(a.move.id, rng)` was handed the BATTLE'S GENERIC rng — the `any` stream —
 * and was called at the TOP of the damage step, above the crit block. Two engines drawing one event
 * from two different addresses agree by luck: with p = 0.3 they match on 0.3² + 0.7² = 58% of
 * clicks, which is why it survived the roster (whose dice are a pinned constant, so both sides give
 * the same answer whatever the address) and showed up only in whole games.
 *
 * ================= WHAT IT COST, MEASURED ======================================================
 *
 * Rows 28 and 33 of the 34 board partings in the held-out 12,000-game draw on release
 * `18773c22878f` (`data/verification/game-differential.g12000.json`) — both a Hydrapple's Fickle
 * Beam, and row 33 is a KO:
 *
 *     row 28  showdown  |-activate|p1a: Hydrapple|move: Fickle Beam   |-damage|p2a: Volcarona|34/160
 *             medicham2                                               |-damage|p2a: Volcarona|53/160
 *     row 33  showdown  |-activate|p2b: Hydrapple|move: Fickle Beam   |-damage|p1a: Chandelure|0 fnt
 *             medicham2                                               |-damage|p1a: Chandelure|38/135
 *
 * Row 33's Chandelure lives here and dies there, and the game runs on differently from that turn.
 *
 * ================= THE ARM, AND WHY IT IS MANY CLICKS =========================================
 *
 * ONE click proves nothing: two independent 30% coins agree 58% of the time, so a single agreeing
 * turn is the likelier outcome even with the defect in place. The probe therefore spends the move's
 * whole PP against the same body and compares the SET OF TURNS each engine announced on. The
 * address carries the TURN, so every click is a fresh address on both sides and the arms are
 * independent by construction; under the defect the chance of all of them agreeing is 0.58^N.
 *
 * It is deterministic, not sampled — the middle arm's dice are a hash of the address — so a red run
 * stays red and a green one stays green.
 *
 * THE CONTROL IS THE KNOB. `MEDI_CONDPOWER_OFF_ANY=1` restores the generic-stream draw above the
 * crit. The two arms MUST disagree on at least one turn, or the address is not what decides this
 * and the probe is asking nothing.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

/* ===== THE KNOB IS NOT THE CONTROL-ARM MARKER, AND CONFLATING THEM HID THE KNOB ================
 *
 * This probe spawns ITSELF with the knob set, as its control arm, and that child must exit 0 — it
 * asserts nothing, it only reports what the pre-fix engine did. The first version keyed that quiet
 * path on the KNOB VARIABLE, so a human who set the knob from outside got the quiet path too and the
 * probe exited **0 under a deliberately broken engine**. That is precisely "an unwired knob gives
 * identical output" wearing a green exit code, and it is indistinguishable from a knob that does
 * nothing.
 *
 * The control arm is now marked by its OWN variable, set only by the spawn. So:
 *   knob set from outside  -> the FULL verdict runs against the broken engine and this exits 1
 *   spawned control child  -> the quiet path, exit 0, `__CONTROL__` for the parent to read
 * The child spawn is skipped when the knob came from outside, because a child of an already-broken
 * parent would compare a control against a control and report "the knob changed nothing" — true, and
 * about the wrong thing. */
const KNOB_SET = process.env.MEDI_CONDPOWER_OFF_ANY === '1';
const CHILD = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === '1';
if (KNOB_SET && !CHILD) {
  console.log('');
  console.log('  MEDI_CONDPOWER_OFF_ANY=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so every assertion below is expected');
  console.log('  to FAIL and this run MUST exit 1. The control child is skipped.');
}
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };

let bad = 0;
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* THE POPULATION, PRINTED BEFORE ANYTHING IS WIRED TO IT. Nothing here is named: the branch under
 * test fires for any move whose `conditionalPower.when` is `chance`. */
const CP = Object.keys(TAGS.moves || {})
  .filter(k => ((TAGS.moves[k].params || {}).conditionalPower || {}).when === 'chance')
  .filter(k => dex.moves.get(k).exists && !dex.moves.get(k).isNonstandard);
console.log('  moves with conditionalPower{when:chance} : ' + (CP.join(', ') || 'NONE'));
if (!CP.length) { console.log('  THE POPULATION IS EMPTY — a claim about the artifact.'); process.exit(2); }
const MV = dex.moves.get(CP[0]);
const P = TAGS.moves[MV.id].params.conditionalPower;
console.log('  chosen                                   : ' + MV.id + '  p=' + P.p + '  x' + P.mult
  + '  pp=' + MV.pp + '  (max ' + Math.floor(MV.pp * 1.6) + ' with boosts)');

/* THE AUTHORITY'S OWN TEXT, CHECKED: the draw must sit inside `onBasePower`, which `getDamage`
 * raises AFTER the crit. A regulation that moved it to `onModifyMove` would put it in a different
 * category and make this probe's whole claim wrong — this is what would say so. */
{
  const src = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'moves.ts'), 'utf8');
  const NL = String.fromCharCode(10) + String.fromCharCode(9);
  const i = src.indexOf(NL + MV.id + ': {');
  const block = i < 0 ? '' : src.slice(i, src.indexOf(NL + '},', i));
  const inBasePower = /onBasePower\([^)]*\)\s*\{\s*if \(this\.randomChance\(/.test(block);
  console.log('    ' + MV.id.padEnd(12) + (inBasePower
    ? 'draws its chance inside onBasePower — raised by getDamage, after the crit roll'
    : 'DOES NOT draw inside onBasePower — this probe asserts something the authority does not say'));
  if (!inBasePower) bad++;
  const ba = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'sim', 'battle-actions.ts'), 'utf8');
  const order = /moveHit\.crit = this\.battle\.randomChance\(1, critMult\[critRatio\]\);[\s\S]{0,600}?runEvent\('BasePower'/.test(ba);
  console.log('    getDamage   ' + (order ? 'rolls the crit and THEN raises BasePower (the repeat index is 0 then 1)'
    : 'DOES NOT roll the crit before BasePower — the repeat index this probe assumes is wrong'));
  if (!order) bad++;
}

const USERS = POOL.filter(s => LS(s)[MV.id] && !G.CLOSET_SPECIES.has(norm(s.id)));
if (!USERS.length) { console.log('  NO LEGAL CARRIER — a claim about the format.'); process.exit(2); }
const U = USERS[0];

const SELF_HOLD = (s) => {
  const skip = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (skip.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
/* NOTHING ON THE RECEIVING SIDE MAY TOUCH THE HIT. A resist, an absorb, a Focus Sash or a
 * damage-reducing ability would each make the announcement and the HP disagree for a reason that is
 * not the die. The target must also SURVIVE the whole run, which is asserted below rather than
 * assumed — a KO ends the arms early and shortens the evidence silently. */
const REFUSE = new Set(['damageReduce', 'survivesFromFull', 'absorbsMoveType', 'immuneToMoveClass',
  'punishesContact', 'formeAbsorbsHit', 'halvesTypeDamage', 'typeImmunity', 'redirectsType',
  'reactorPerHit', 'onSwitchInDrop']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));
const eff = (s) => (dex.getImmunity(MV.type, s) ? Math.pow(2, dex.getEffectiveness(MV.type, s)) : 0);
/* THE BULKIEST body that resists or is neutral, so it survives a full PP bar of the move. */
const TARGETS = POOL.filter(s => s.name !== U.name && okAbility(s) && eff(s) > 0 && eff(s) <= 1
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s))
  .sort((a, b) => (b.baseStats.hp + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.spd));
if (!TARGETS.length) { console.log('  NO LEGAL TARGET.'); process.exit(2); }
const T = TARGETS[0];

const FILL = POOL.filter(s => ![U.name, T.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 6);
if (FILL.length < 6) { console.log('  NOT ENOUGH FILLER.'); process.exit(2); }

const TURNS = MV.pp;   /* the move's own PP bar: every click is a fresh address (the turn is in it) */
console.log('\n  chosen  : ' + U.name + ' [' + okAbility(U) + '] clicks ' + MV.id + ' at ' + T.name
  + ' [' + okAbility(T) + '], x' + eff(T) + ', for ' + TURNS + ' turns');
console.log('            the reading is WHICH TURNS each engine announced the double on');
console.log('            two independent 30% coins agree on ' + ((P.p * P.p + (1 - P.p) * (1 - P.p)) * 100).toFixed(0)
  + '% of clicks, so ONE agreeing turn proves nothing — ' + TURNS + ' do');

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = () => ([
  [mon(U.name, [MV.name, SELF_HOLD(U) || 'Protect'], '', okAbility(U)),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])])],
  [mon(T.name, [SELF_HOLD(T)], '', okAbility(T)),
   mon(FILL[3].name, [SELF_HOLD(FILL[3])]), mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
   mon(FILL[5].name, [SELF_HOLD(FILL[5])])],
]);
const script = () => {
  const out = [];
  for (let i = 0; i < TURNS; i++) {
    out.push({ p1: [{ m: norm(MV.id), t: 0 }, { m: norm(SELF_HOLD(FILL[0])) }],
               p2: [{ m: norm(SELF_HOLD(T)) }, { m: norm(SELF_HOLD(FILL[3])) }] });
  }
  return out;
};

const [SA, SB] = sides();
const a = G.buildPair(SA), b = G.buildPair(SB);
if (!a || !b) { console.log('  NOT STAGED — buildPair returned null'); process.exit(1); }
G.resetScriptCounters();
const r = G.playGame(a, b, 'directed', 'ficklebeamdie/' + (CHILD ? 'control' : 'real'), {
  arm: G.ARM_BY_ID.get('middle'), script: script(),
});
const SC = G.scriptCounters();
if (r.err) { console.log('  NOT STAGED — THREW: ' + r.err); process.exit(1); }
if (SC.moveNotOnRequest) { console.log('  NOT STAGED — ' + SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing); process.exit(1); }

/* THE TURN EACH ANNOUNCEMENT BELONGS TO, walked off the raw streams so a divergence part-way through
 * does not hide the rest: `playGame` plays BOTH engines to the end and keeps both traces. */
const turnsAnnouncing = (lines) => {
  const out = []; let turn = 0, clicks = 0;
  for (const L of lines) {
    const p = String(L).split('|');
    if (p[1] === 'turn') turn = +p[2];
    if (p[1] === 'move' && norm(p[3]) === norm(MV.id)) clicks++;
    /* `|-activate|p1a: Hydrapple|move: Fickle Beam` -- field 3 is the EFFECT, prefixed `move: `,
     * so an equality test against the move id silently matches nothing. It did, on the first run,
     * and both lists read empty while the authority had plainly announced. */
    if (p[1] === '-activate' && norm(p[3]).endsWith(norm(MV.id))) out.push(turn);
  }
  return { on: out, clicks };
};
const SD = turnsAnnouncing(G.sdStream(G.lastSdLog()));
const ME = turnsAnnouncing(r.mediTrace || []);

console.log('\n  === THE ARM ===');
console.log('    clicks landed        showdown ' + SD.clicks + '   medicham2 ' + ME.clicks);
console.log('    announced on turns   showdown [' + SD.on.join(',') + ']');
console.log('                         medicham2 [' + ME.on.join(',') + ']');
const sameSet = SD.on.length === ME.on.length && SD.on.every((t, i) => t === ME.on[i]);
console.log('    first protocol divergence: ' + (r.div ? JSON.stringify({ sd: r.div.sdRaw, me: r.div.meRaw }) : 'none — the streams agree'));

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_CONDPOWER_OFF_ANY=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ sd: SD.on, me: ME.on, clicks: ME.clicks, same: sameSet }));
  console.log('\ngreen — the control arm ran');
  process.exit(0);
}

console.log('\n  === THE VERDICT ===');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
    + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
/* THE FIXTURE FIRST, AND IT IS READ OFF WHAT WAS ACTUALLY PLAYED. `playGame` stops at the first
 * divergence, so a run with the defect in it plays FEWER clicks than the script asks for — asserting
 * the full count up front would fail for a reason that is downstream of the thing under test and
 * would bury the real line. The die must be shown to VARY over the clicks the authority did play:
 * a stream that never announces and one that always announces would both make two engines agree. */
need('the authority announced at least once over the clicks it played (otherwise a silent engine passes for free)',
  SD.on.length > 0, true);
need('and NOT on every one of them (otherwise an always-on engine passes too)', SD.on.length < SD.clicks, true);
need('the two engines announce on exactly the same turns', sameSet, true);
need('the streams do not part at all', r.div ? JSON.stringify({ sd: r.div.sdRaw, me: r.div.meRaw }) : null, null);
/* AND ONLY ONCE THE STREAMS HELD is the full length meaningful — a short run is a CONSEQUENCE of a
 * divergence, never independent evidence of one. */
if (!r.div) {
  need('every scripted click landed (the evidence is the whole PP bar, not a prefix of it)', SD.clicks, TURNS);
  need('...on this engine too', ME.clicks, TURNS);
}

if (KNOB_SET) {
  console.log('');
  console.log('  --- the control child is SKIPPED: the knob is already set in this process, so a child');
  console.log('      of it would compare a control against a control and say the knob changed nothing ---');
} else {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_CONDPOWER_OFF_ANY=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_CONDPOWER_OFF_ANY: '1', ABRA_PROBE_CONTROL_ARM: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = JSON.stringify(ctl.me) !== JSON.stringify(ME.on);
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES which turns this engine announces on: default ['
      + ME.on.join(',') + ']  vs control [' + ctl.me.join(',') + ']');
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED — '
      + 'the generic stream and the crit stream would have to agree on all ' + TURNS + ' addresses.'); bad++; }
    if (ctl.same) { console.log('  RED    the control arm AGREED with the authority, so it is not the old behaviour.'); bad++; }
    else console.log('  green  the control arm disagrees with the authority, as the pre-fix engine did');
    if (JSON.stringify(ctl.sd) !== JSON.stringify(SD.on)) {
      console.log('  RED    THE AUTHORITY MOVED under the knob (' + JSON.stringify(ctl.sd) + '). The knob is not '
        + 'medicham2-only and the comparison is not a comparison.'); bad++;
    } else console.log('  green  the authority did not move under the knob — it is a medicham2-side knob');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
