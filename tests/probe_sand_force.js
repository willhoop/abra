/* probe_sand_force.js — SAND FORCE HAS TWO HALVES AND THIS PROBE ASKS EACH ONE SEPARATELY.
 *
 *   node tests/probe_sand_force.js
 *   node tests/probe_sand_force.js --restore     (the knob: put the defect back, expect the SAME red)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED ====================================
 *
 * `data/mods/champions/abilities.ts` has NO `sandforce` key — grepped, not assumed — so mainline
 * governs. `data/abilities.ts:3946-3960`:
 *
 *     sandforce: {
 *       onBasePowerPriority: 21,
 *       onBasePower(basePower, attacker, defender, move) {
 *         if (this.field.isWeather('sandstorm')) {
 *           if (move.type === 'Rock' || move.type === 'Ground' || move.type === 'Steel') {
 *             return this.chainModify([5325, 4096]);
 *           }
 *         }
 *       },
 *       onImmunity(type, pokemon) { if (type === 'sandstorm') return false; },
 *
 * TWO HALVES. A base-power chain member worth [5325,4096] on THREE types while a sandstorm is up,
 * and a refusal of the sandstorm residual. They are wired in two different places here and the
 * second one was already right; this probe reports them apart so that cannot be blurred.
 *
 * ================= WHAT WAS WRONG ==============================================================
 *
 *   1. `data/tags.json` carried `damageBoost.onType: "Rock"` — a SCALAR, holding the FIRST of the
 *      three types the handler tests. `tag_dex.js` read the type with
 *      `src.match(/move\.type\s*===?\s*"(\w+)"/)` — one match, first only — so Ground and Steel were
 *      not in the artifact at all.
 *   2. NOTHING IN medicham2 SPENT IT ANYWAY. All three `damageBoost` consumers in `dmgRange` require
 *      `!_db.inWeather`, and Sand Force's param carries `inWeather: ["sand"]`. So the boost was
 *      absent on ALL THREE types, not just on two — which is why the Rock arm below is not the
 *      control the shape of the tag bug suggests, and is asserted to MOVE like the other two.
 *
 * ================= WHY EACH ARM IS HERE, AND WHY IT CAN FAIL ===================================
 *
 * Every arm is one Excadrill (a legal Sand Force carrier, derived — Reg M-B has four: Excadrill,
 * Hippowdon, Garchomp-Mega, Steelix-Mega) clicking one single-target move into one target, with
 * ONLY the ability varying between the two readings. `bare()` blanks the ability on both sides, so
 * neither arm can be handed Excadrill's own Sand Rush by the builder.
 *
 *   ground / steel / rock   sand up. Each MUST rise by ~[5325,4096].
 *   wrong-type              sand up, a BUG move off the same body. Must NOT move — the handler names
 *                           three types and a wire that ignored them would boost everything.
 *   no-weather              a GROUND move in a CLEAR sky. Must NOT move — the handler is gated on
 *                           the weather and a wire that ignored that would boost always. Without
 *                           this arm nothing here tests the sky at all.
 *
 * ONE REASON PER CELL, DERIVED FROM THE AUTHORITY'S OWN TYPE CHART, AND IT ALREADY EARNED ITSELF.
 * The reading is the aimed body's HP loss over a whole turn, so the ONE thing that can move it for a
 * reason other than the ability is the SANDSTORM RESIDUAL: chip is an ADDITIVE constant present in
 * both readings, which leaves `on - off` alone but dilutes `on / off` and therefore breaks the
 * [5325,4096] band. Every target below is Rock, Ground or Steel and takes no chip, and the probe
 * refuses any cell whose target is not — printed, not assumed.
 *
 * Effectiveness is NOT that second reason and is deliberately not refused on: a multiplier applies
 * identically to both readings, so it cancels out of the ratio. What it does do is shrink the number
 * until one truncation is a large share of it, so the probe requires the control reading to be big
 * enough that a 1.3x cannot hide inside rounding, and prints the effectiveness beside every arm.
 *
 * THE FIRST STAGING GOT THIS WRONG AND THE GUARD CAUGHT IT. It fired a Rock move at the Garchomp
 * that serves the other arms — and Rock is 0.5 into Ground, so the control read 24. There is no
 * body that is Rock/Ground/Steel (chip-immune) AND neutral to Rock unless it pairs the type with
 * Flying, so the Rock arm gets its own target and the others keep Garchomp.
 *
 * ================= THE SECOND HALF, ASKED APART ================================================
 *
 * `chip-immunity` reads the HOLDER's own HP across one sandstorm residual, on a body that is NOT
 * intrinsically sand-immune. Excadrill is Ground/Steel and therefore immune for a second reason, so
 * using it here would be the two-reasons failure exactly: the arm would read 0 whether or not the
 * ability did anything. Hippowdon is Ground — same problem. So the holder is a body that takes sand
 * normally and has the ability written onto it, and the control is the SAME body with no ability,
 * which must LOSE a sixteenth.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGSJSON = require(D('data', 'tags.json'));

const RESTORE = process.argv.includes('--restore');

/* THE RESTORE KNOB PUTS THE ARTIFACT BACK, NOT THE ENGINE. Both halves of the defect are readable
 * from `data/tags.json`: the scalar `onType` and — for the consumer — the presence of `inWeather`.
 * Re-scalarising the param reproduces the pre-fix artifact exactly, and an engine that reads the
 * type as a LIST will then see one type, which is the same red the defect produced. */
if (RESTORE) {
  const p = TAGSJSON.abilities.sandforce.params.damageBoost;
  const was = p.onType;
  p.onType = Array.isArray(was) ? was[0] : was;
  console.log('RESTORE: tags.json sandforce.damageBoost.onType ' + JSON.stringify(was)
    + ' -> ' + JSON.stringify(p.onType) + ' (the pre-fix scalar)\n');
}

const bare = (sp) => {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none';
  return b;
};
const unfaintable = (m) => { m.st = Object.assign({}, m.st, { hp: m.st.hp * 8 }); m.curHP = m.st.hp; };
const rng5 = () => 0.5;
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

/* ---- HALF ONE: THE BASE-POWER BOOST ---------------------------------------------------------- */

const ATTACKER = 'excadrill';

const hit = (ability, moveId, weather, target) => {
  const me = bare(ATTACKER), ally = bare('incineroar'), f1 = bare(target), f2 = bare(target);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  unfaintable(f1);
  me.ability = ability;
  S.field.weather = weather;
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return before - f1.curHP;
};

/* THE ROCK ARM'S TARGET IS NOT THE OTHERS', AND THAT IS THE POINT — see the header. Every target is
 * chip-immune by TYPE, which the loop below re-derives rather than trusting this comment. */
const ARMS = [
  { name: 'ground',      move: 'drillrun', target: 'garchomp',    weather: 'sand', mustMove: true },
  { name: 'steel',       move: 'ironhead', target: 'garchomp',    weather: 'sand', mustMove: true },
  { name: 'rock',        move: 'rocktomb', target: 'corviknight', weather: 'sand', mustMove: true },
  { name: 'wrong-type',  move: 'xscissor', target: 'garchomp',    weather: 'sand', mustMove: false },
  { name: 'no-weather',  move: 'drillrun', target: 'garchomp',    weather: '',     mustMove: false },
];

/* HOW MANY REASONS EACH CELL QUALIFIES FOR, DERIVED AND PRINTED, AND MORE THAN ONE IS REFUSED.
 * A fixture that would read the same for a second reason proves nothing about the ability. The two
 * reasons that could contaminate an arm here are (a) the target resisting or being weak to the move
 * type, so the two readings differ for an effectiveness reason, and (b) the target taking sandstorm
 * chip, so the HP reading includes the residual. Both are read out of the engine's own tables. */
if (!process.env.SHOWDOWN_PATH) {
  console.log('REFUSING TO RUN — SHOWDOWN_PATH is not set. The per-cell reason count below is read '
    + 'out of the AUTHORITY\'s type chart, and guessing it is the failure this probe exists to avoid.');
  process.exit(2);
}
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const eff = (moveId, target) => {
  const mv = DEX.moves.get(moveId);
  const tgt = DEX.species.get(target);
  if (!DEX.getImmunity(mv.type, tgt.types)) return 0;
  return Math.pow(2, DEX.getEffectiveness(mv.type, tgt.types));
};
/* THE CHIP-IMMUNE TYPES ARE THE AUTHORITY'S, NOT A MEMORY. Showdown decides the sandstorm residual's
 * type immunity through `dex.getImmunity('sandstorm', types)`, which is the same call the damage
 * chart uses — so the set is read out of the format instead of being written down here. */
const chipImmuneByType = (target) => !DEX.getImmunity('sandstorm', DEX.species.get(target).types);

const failures = [];
console.log('SAND FORCE — the base-power half\n');
console.log('  fixture: ' + ATTACKER + ' (a derived legal Sand Force carrier), aimed body '
  + 'unfaintable, ability set explicitly on BOTH readings\n');

console.log('  ONE REASON PER CELL, derived from the authority:');
for (const a of ARMS) {
  const e = eff(a.move, a.target);
  const chipSafe = chipImmuneByType(a.target);
  const reasons = [];
  if (a.weather === 'sand' && !chipSafe) reasons.push('target takes sandstorm chip — an additive '
    + 'constant in both readings that dilutes the ratio');
  console.log('    ' + a.name.padEnd(12) + a.move.padEnd(10) + ('-> ' + a.target).padEnd(16)
    + 'eff x' + String(e).padEnd(6)
    + 'chip-immune by type: ' + (chipSafe ? 'yes' : 'NO')
    + '   additional reasons the two readings could differ: '
    + (reasons.length ? reasons.join(' + ') : 'NONE'));
  if (reasons.length) failures.push('arm ' + a.name + ' qualifies for ' + (reasons.length + 1)
    + ' reasons (' + reasons.join('; ') + ') — refused');
}
console.log('');

const rows = [];
for (const a of ARMS) {
  const off = hit('none', a.move, a.weather, a.target);
  const on = hit('sandforce', a.move, a.weather, a.target);
  rows.push({ a, off, on });
  const ratio = off > 0 ? on / off : null;
  console.log('  ' + a.name.padEnd(12) + a.move.padEnd(10) + (a.weather || 'clear').padEnd(7)
    + 'no ability ' + String(off).padStart(4) + '   SAND FORCE ' + String(on).padStart(4)
    + '   x' + (ratio === null ? '?' : ratio.toFixed(3))
    + '   want ' + (a.mustMove ? 'HIGHER' : 'IDENTICAL'));
  /* RESOLUTION, not just non-zero. A 1.3x on a control of 3 is a delta of 1, which one truncation
   * can swallow — so a small control makes an arm that cannot fail honestly. 20 puts the expected
   * delta at 6 or more, an order above the rounding. */
  if (!(off >= 20)) failures.push('arm ' + a.name + ': the control dealt ' + off + ', under the 20 '
    + 'needed for a 1.3x to be bigger than one truncation — the arm cannot fail honestly');
  else if (a.mustMove && !(on > off)) failures.push('arm ' + a.name + ': ' + off + ' -> ' + on
    + ' — the boost did not fire');
  else if (!a.mustMove && on !== off) failures.push('arm ' + a.name + ': ' + off + ' -> ' + on
    + ' — the boost fired where the handler says it must not');
}

/* THE SIZE, NOT JUST THE DIRECTION. [5325,4096] is 1.3, folded into the base-power relay and
 * truncated once with it, so the expectation is a band tight enough to exclude 1.0 and 1.5 and
 * loose enough for one truncation. */
for (const r of rows.filter(x => x.a.mustMove)) {
  const lo = Math.floor(r.off * 1.3 * 0.94), hi = Math.ceil(r.off * 1.3 * 1.06);
  if (r.on < lo || r.on > hi) failures.push('arm ' + r.a.name + ': ' + r.off + ' -> ' + r.on
    + ' is outside the [5325,4096] band [' + lo + ',' + hi + '] — the multiplier is the wrong size');
}

/* ---- HALF TWO: THE SANDSTORM CHIP IMMUNITY, ASKED APART --------------------------------------- */

/* THE HOLDER MUST NOT BE INTRINSICALLY SAND-IMMUNE, which rules out every real Sand Force carrier
 * in this format — all four are Rock, Ground or Steel. Staging one of them here would be the
 * two-reasons failure: the arm would read 0 whether or not the ability did anything. The ability is
 * therefore written onto a body that takes sand normally, and the control is that same body with no
 * ability, which must LOSE a sixteenth. */
const CHIP_BODY = 'milotic';
const chip = (ability) => {
  const me = bare(CHIP_BODY), ally = bare('incineroar'), f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  me.ability = ability;
  S.field.weather = 'sand';
  const before = me.curHP;
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return before - me.curHP;
};
console.log('\nSAND FORCE — the sandstorm-immunity half\n');
const chipTypes = bare(CHIP_BODY).types;
const chipIntrinsic = chipTypes.some(t => t === 'Rock' || t === 'Ground' || t === 'Steel');
console.log('  holder: ' + CHIP_BODY + ' [' + chipTypes.join('/') + '] — intrinsically sand-immune? '
  + (chipIntrinsic ? 'YES (this arm would prove nothing)' : 'no'));
if (chipIntrinsic) failures.push('the chip arm\'s holder is already sand-immune by TYPE — two reasons');
const chipOff = chip('none'), chipOn = chip('sandforce');
console.log('  no ability -' + chipOff + '   SAND FORCE -' + chipOn
  + '   (want: the control LOSES a sixteenth, the holder loses 0)');
if (!(chipOff > 0)) failures.push('chip arm: the control lost nothing — sand is not chipping at all, '
  + 'so an immunity cannot be observed');
if (chipOn !== 0) failures.push('chip arm: the Sand Force holder lost ' + chipOn + ' — the ability '
  + 'refuses the sandstorm residual and this one did not');

/* ---- WHAT THE ARTIFACT SAYS, PRINTED SO THE TWO CANNOT DRIFT ---------------------------------- */
const p = TAGSJSON.abilities.sandforce.params;
console.log('\n  data/tags.json sandforce.damageBoost = ' + JSON.stringify(p.damageBoost));
console.log('  data/tags.json sandforce.weatherChipImmune = ' + JSON.stringify(p.weatherChipImmune));

console.log('\n' + (failures.length ? 'RED — ' + failures.length + ' failure(s):' : 'GREEN — every arm behaves as the handler says.'));
for (const f of failures) console.log('  ' + f);
process.exit(failures.length ? 1 : 0);
