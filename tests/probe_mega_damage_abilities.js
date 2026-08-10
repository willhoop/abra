/* tests/probe_mega_damage_abilities.js — FILTER, AND THE ARM THAT MAKES IT MEAN ANYTHING.
 *
 * ROADMAP #138. Will, 2026-08-10: "HAVE FILTER REDUCE DAMAGE BY 25% ON SUPER EFFECTIVE MOVES AND TEST
 * IT AGAINST NOT SUPER EFFECTIVE MOVES".
 *
 * WHY THIS IS A PROBE AND NOT A ROSTER ROW. Filter's only legal carrier in this format is Aggron-Mega,
 * and the deliberate roster stages an ability by writing it onto a body — which a forme change
 * overwrites. The roster's answer for this row is COULD-NOT-STAGE, honestly. But the QUESTION does not
 * need a played game at all: Filter is a damage multiplier, and `dmgRange` takes a built body and
 * answers what a move does to it. So the carrier can simply BE the mega forme, built from its own row.
 *
 * WHY A PLAYED-TURN RATIO WAS REFUSED. Will, on an Overgrow measurement an hour earlier: a played turn
 * rolls its own damage, so a with/without ratio mixes the multiplier with two different rolls and
 * produces arithmetically impossible numbers. `dmgRange` returns the WHOLE 16-roll ladder with the roll
 * held constant, so the two arms are compared ELEMENT BY ELEMENT and the ratio must be 0.75 at every
 * index. A ratio that is right on average and wrong per-index means the multiplier is landing at the
 * wrong damage stage.
 *
 * TWO ARMS, AND NEITHER ALONE IS EVIDENCE:
 *   SUPER-EFFECTIVE into the carrier   damage must be x0.75
 *   NEUTRAL into the same carrier      damage must be UNCHANGED
 * An engine that reduces everything passes the first and fails the second. An engine with Filter
 * missing passes the second and fails the first.
 *
 * THE CONTROL IS THE SAME BODY WITH A DIFFERENT ABILITY, which is available here precisely because
 * nothing is being validated as a team: `buildMon` hands back a plain object and the ability is a
 * field on it. That is not a legality claim and is not presented as one — the SET is never played.
 *
 * ================= THE BODIES HERE COULD NOT EXIST, AND THAT IS DELIBERATE ======================
 *
 * SAID PLAINLY BECAUSE A READER WILL OTHERWISE ASSUME OTHERWISE. Two things about every arm below are
 * ILLEGAL and Showdown's TeamValidator would refuse both:
 *
 *   THE MOVE IS NOT FROM THE BODY'S LEARNSET. Each arm picks the strongest move of a given TYPE out of
 *   the WHOLE DEX and hands it to the carrier. Aggron-Mega does not learn Eruption; Meganium-Mega does
 *   not learn most of what the type sweep throws. The move is a PROBE for the multiplier, chosen to
 *   isolate a type and a category, and nothing here claims the body could click it.
 *
 *   THE ABILITY IS WRITTEN ONTO A BODY THAT CANNOT CARRY IT. The control arm gives the mega forme a
 *   quiet ability it has no access to, which is the only way to get a with/without pair out of a forme
 *   whose ability table has exactly one entry.
 *
 * THIS IS SOUND HERE AND WOULD NOT BE IN A PLAYED GAME. `dmgRange` is ARITHMETIC: it takes two bodies,
 * a move and a field, and returns a damage ladder. It asks no legality question, no team is built, no
 * turn is played and no validator is consulted — so the illegal pairing cannot reach a rule that
 * depends on legality. The moment a fixture PLAYS a turn, this stops being acceptable: a Scrappy
 * Kangaskhan-Mega cannot exist, and a roster row staged that way would be measuring a body the game
 * does not have. Every roster fixture in this batch (Shadow Tag, Electric Surge, Fairy Aura) therefore
 * takes its ability from the FORME CHANGE and never writes one.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_damage_abilities.js
 *   SHOWDOWN_PATH=... node tests/probe_mega_damage_abilities.js --break   (the RED demonstration)
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — no simulator'); process.exit(2); }

const HAS = n => process.argv.includes(n);
const BREAK = HAS('--break');

require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const TAGS = JSON.parse(require('fs').readFileSync(D('data', 'tags.json'), 'utf8'));
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

console.log('PROBE — the mega-tier DAMAGE abilities, asked of dmgRange rather than of a played turn');
if (BREAK) console.log('  --break: the carrier is built with a QUIET ability instead, so the '
  + 'multiplier is absent.\n  Every arm below must go RED. An arm that stays green under this is an '
  + 'arm that proves nothing.\n');

/* ---- who carries what, asked of the format ------------------------------------------------------ */
const MEGA_OF = {};
for (const it of dex.items.all()) {
  if (!it.exists || it.isNonstandard || !it.megaStone) continue;
  for (const b of Object.keys(it.megaStone)) MEGA_OF[idOf(it.megaStone[b])] = { item: it.id, base: idOf(b) };
}
const CARRIERS = {};
for (const s of dex.species.all()) {
  if (!s.exists || s.isNonstandard) continue;
  for (const n of Object.values(s.abilities || {})) (CARRIERS[idOf(n)] = CARRIERS[idOf(n)] || []).push(s);
}
/* THE POPULATION IS DERIVED, NOT LISTED: every ability in this format whose only carrier is a mega
 * forme AND whose tag is a plain damage-taken multiplier. Printed, because a derived set that
 * over-matches is invisible until somebody looks at what it matched. */
const POP = [];
for (const a of dex.abilities.all()) {
  if (!a.exists || a.isNonstandard) continue;
  const list = CARRIERS[a.id] || [];
  if (!list.length || !list.every(s => s.battleOnly && MEGA_OF[s.id])) continue;
  const t = (TAGS.abilities || {})[a.id];
  const p = t && t.params && t.params.damageReduce;
  if (!p || !p.damageMult) continue;
  POP.push({ ab: a, forme: list[0], mult: p.damageMult, onlyWhen: p.onlyWhen || null });
}
console.log('  population (mega-only carrier AND a damageReduce tag): '
  + (POP.map(x => x.ab.name + ' on ' + x.forme.name + ' x' + x.mult
      + (x.onlyWhen ? ' when ' + x.onlyWhen : ' always')).join(', ') || 'NONE'));
if (!POP.length) { console.log('  ZERO MEMBERS — this probe proves nothing. Treat as broken.'); process.exit(2); }

/* THE SAME TAG ON A NON-MEGA BODY, so the code path can be shown live independently of the staging.
 * Solid Rock carries `damageReduce {damageMult: 0.75, onlyWhen: superEffective}` — byte for byte the
 * param Filter carries — on Rhyperior, which the deliberate roster already tests. If the reference
 * arm is green and the mega arm is red, the defect is the CARRIER and not the mechanic. */
const REFERENCE = (() => {
  for (const a of dex.abilities.all()) {
    if (!a.exists || a.isNonstandard) continue;
    const t = (TAGS.abilities || {})[a.id];
    const p = t && t.params && t.params.damageReduce;
    if (!p || p.damageMult !== POP[0].mult || (p.onlyWhen || null) !== POP[0].onlyWhen) continue;
    const body = (CARRIERS[a.id] || []).find(s => !s.battleOnly && !s.isNonstandard);
    if (body) return { ab: a, sp: body };
  }
  return null;
})();

/* ---- a quiet ability to build the control (and the break) with -------------------------------- */
const QUIET = dex.abilities.all().filter(a => a.exists && !a.isNonstandard && !a.condition
  && !Object.keys(a).some(k => /^on/.test(k) && typeof a[k] === 'function')
  && !/^(levitate|stall|terashell|multitype|rkssystem)$/.test(a.id)).map(a => a.id);
const CONTROL_AB = QUIET[0];
console.log('  control ability (quiet, derived): ' + dex.abilities.get(CONTROL_AB).name
  + '   [pool: ' + QUIET.join(', ') + ']');

/* ---- the two moves, derived from the MEGA FORME'S OWN TYPES ------------------------------------
 * THE TRAP THIS AVOIDS IS NAMED: base Aggron is Steel/Rock and Aggron-Mega is PURE STEEL, so a move
 * chosen against the base can be neutral on the mega, or vice versa. Effectiveness is asked of the
 * forme that is actually on the field. */
function movesFor(types) {
  let se = null, nu = null;
  for (const m of dex.moves.all()) {
    if (!m.exists || m.isNonstandard || !m.basePower || m.accuracy !== 100) continue;
    if (m.category === 'Status' || m.multihit || m.ohko || m.flags.charge || m.flags.recharge) continue;
    if (!MC.moves[m.id]) continue;                      // the engine must know it
    const eff = types.reduce((e, t) => e * (dex.getEffectiveness(m.type, t) === 1 ? 2
      : dex.getEffectiveness(m.type, t) === -1 ? 0.5 : 1), 1);
    if (dex.getImmunity(m.type, types) === false) continue;
    if (eff > 1 && (!se || m.basePower > se.bp)) se = { mv: m, bp: m.basePower, eff };
    if (eff === 1 && (!nu || m.basePower > nu.bp)) nu = { mv: m, bp: m.basePower, eff };
  }
  return { se, nu };
}

/* ---- one arm ------------------------------------------------------------------------------------
 * `dmgRange` is called with the IDENTICAL attacker, move and field on both sides; the only thing that
 * differs is the defender's ability. The 16 rolls are compared element by element. */
const ATTACKER = 'dragapult';
let red = 0, arms = 0;
function arm(label, defKey, abilityId, controlId, pick, expect) {
  arms++;
  const att = M.buildMon(ATTACKER, {});
  const d1 = M.buildMon(defKey, {});
  const d2 = M.buildMon(defKey, {});
  if (!att || !d1 || !d2) { console.log('    ' + label + '  COULD NOT BUILD A BODY — not a pass'); red++; return; }
  att.ability = CONTROL_AB;
  d1.ability = BREAK ? controlId : abilityId;      // the subject (or, under --break, no multiplier)
  d2.ability = controlId;                          // the control
  const mv = MC.moves[pick.mv.id];
  const withAb = M.dmgRange(att, d1, mv, {}, false, false, null);
  const without = M.dmgRange(att, d2, mv, {}, false, false, null);
  const A = withAb.rolls || [withAb.min, withAb.max];
  const B = without.rolls || [without.min, without.max];
  if (A.length !== B.length || !A.length) {
    console.log('    ' + label + '  NO ROLL LADDER TO COMPARE (' + A.length + ' vs ' + B.length + ')');
    red++; return;
  }
  const ratios = A.map((v, i) => (B[i] ? v / B[i] : null));
  const uniq = [...new Set(ratios.map(r => (r == null ? 'null' : r.toFixed(4))))];
  const perIndex = ratios.every(r => r != null && Math.abs(r - expect) < 0.005);
  const ok = perIndex;
  if (!ok) red++;
  console.log('    ' + label.padEnd(46) + (ok ? 'ok   ' : 'RED  ')
    + pick.mv.name + ' (' + pick.mv.type + ', eff x' + pick.eff + ')  '
    + 'with=' + A[0] + '..' + A[A.length - 1] + '  without=' + B[0] + '..' + B[B.length - 1]
    + '  ratio ' + uniq.join('/') + '  expected ' + expect.toFixed(2));
  if (!ok && uniq.length > 1) console.log('        THE RATIO IS NOT CONSTANT ACROSS THE 16 ROLLS — the '
    + 'multiplier is landing at the wrong damage stage, not merely at the wrong size.');
}

for (const P of POP) {
  const types = P.forme.types;
  const { se, nu } = movesFor(types);
  console.log('\n  ' + P.ab.name + ' on ' + P.forme.name + '  [' + types.join('/') + ']   tag says x'
    + P.mult + (P.onlyWhen ? ' only when ' + P.onlyWhen : ' always'));
  if (!se || !nu) { console.log('    COULD-NOT-STAGE: the format offers no '
    + (!se ? 'super-effective' : 'neutral') + ' 100-accuracy damaging move this engine knows against '
    + types.join('/') + ' — both arms are required and one is missing'); red++; continue; }
  const megaKey = P.forme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  arm('SUPER-EFFECTIVE, must be reduced', megaKey, P.ab.id, CONTROL_AB, se, P.mult);
  arm('NEUTRAL, must be UNCHANGED      ', megaKey, P.ab.id, CONTROL_AB, nu, 1);
  if (REFERENCE) {
    const rt = REFERENCE.sp.types, r = movesFor(rt);
    console.log('    reference — the identical tag on a NON-mega body (' + REFERENCE.ab.name + ' on '
      + REFERENCE.sp.name + '), which the roster already tests:');
    if (r.se) arm('  reference SUPER-EFFECTIVE       ', REFERENCE.sp.id, REFERENCE.ab.id, CONTROL_AB, r.se, P.mult);
    if (r.nu) arm('  reference NEUTRAL               ', REFERENCE.sp.id, REFERENCE.ab.id, CONTROL_AB, r.nu, 1);
  }
}

/* =================================================================================================
 *  MEGA SOL — A PRIVATE WEATHER, AND THE ASSERTION RESTATES NOTHING
 *
 * ROADMAP #138. `megasol` carries `privateWeather {actsAsWeather: ["sun"], visibleOnField: false,
 * affects: "only this Pokemon"}` — Meganium-Mega's moves resolve AS IF sun were up while the field
 * reports none. medicham2 reads it in `effWeatherOf`, off the ATTACKER only (WIRE 99), which decides
 * the entire shape of the test: the carrier has to be the one THROWING.
 *
 * THE ASSERTION IS NOT "FIRE GOES UP BY 1.5". That number is the WEATHER's rule, not this ability's,
 * and typing it here would be restating a fact the engine already owns — the defect CLAUDE.md names as
 * "two files that both decide Choice Scarf is x1.5". The tag says the holder acts as if its weather
 * were up, so the assertion is exactly that:
 *
 *   EQUIVALENCE   (carrier with Mega Sol, NO field weather) must equal, roll for roll,
 *                 (carrier with a quiet ability, field weather = sun)
 *   LIVE          (carrier with Mega Sol) must NOT equal (carrier with a quiet ability, no weather),
 *                 or the ability is doing nothing and the equivalence above is vacuous
 *   PRIVATE       the carrier as DEFENDER must take the identical damage either way — `affects: only
 *                 this Pokemon`, so an implementation that raised real sun would leak to the foe
 *
 * The weather-affected types are DERIVED by asking the engine which types its own sun moves: any type
 * whose damage changes under `field.weather = sun` for a control body. Nothing is named.
 * ================================================================================================= */
const PW_POP = [];
for (const a of dex.abilities.all()) {
  if (!a.exists || a.isNonstandard) continue;
  const list = CARRIERS[a.id] || [];
  if (!list.length || !list.every(s => s.battleOnly && MEGA_OF[s.id])) continue;
  const t = (TAGS.abilities || {})[a.id];
  const p = t && t.params && t.params.privateWeather;
  if (!p || !Array.isArray(p.actsAsWeather) || !p.actsAsWeather.length) continue;
  PW_POP.push({ ab: a, forme: list[0], weather: p.actsAsWeather[0], affects: p.affects || null });
}
console.log('\n  private-weather population (mega-only carrier AND a privateWeather tag): '
  + (PW_POP.map(x => x.ab.name + ' on ' + x.forme.name + ' acts as ' + x.weather).join(', ') || 'NONE'));

function rolls(r) { return r.rolls || [r.min, r.max]; }
function same(A, B) { return A.length === B.length && A.length > 0 && A.every((v, i) => v === B[i]); }

for (const P of PW_POP) {
  const W = M.weatherId(P.weather);
  const megaKey = P.forme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  console.log('\n  ' + P.ab.name + ' on ' + P.forme.name + '   tag says it acts as "' + P.weather
    + '" (engine weather id ' + JSON.stringify(W) + '), ' + (P.affects || 'scope unstated'));
  if (!W) { console.log('    COULD-NOT-STAGE: this engine has no weather id for "' + P.weather
    + '", so there is nothing to be equivalent TO'); red++; continue; }
  const bag = dex.species.get('kangaskhan');
  /* WHICH TYPES THE WEATHER ACTUALLY MOVES, asked of the engine rather than listed. A control body
   * throws each candidate under no weather and under the weather; a type whose ladder changes is a
   * member, and a type whose ladder does not is the NEGATIVE arm. Printed either way. */
  const probe = M.buildMon(megaKey, {}); if (probe) probe.ability = CONTROL_AB;
  const target = M.buildMon(bag.id, {});
  const moved = [], still = [];
  if (probe && target) {
    for (const t of dex.types.all().map(x => x.name)) {
      const mv = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.type === t
        && m.category !== 'Status' && m.basePower && m.accuracy === 100 && MC.moves[m.id]
        && dex.getImmunity(m.type, target.types) !== false)
        .sort((a, b) => b.basePower - a.basePower)[0];
      if (!mv) continue;
      const dry = rolls(M.dmgRange(probe, target, MC.moves[mv.id], {}, false, false, null));
      const wet = rolls(M.dmgRange(probe, target, MC.moves[mv.id], { weather: W }, false, false, null));
      (same(dry, wet) ? still : moved).push(mv);
    }
  }
  console.log('    types this engine says "' + W + '" MOVES: '
    + (moved.map(m => m.type).join(', ') || 'NONE') + '   |   unaffected: '
    + (still.length ? still.slice(0, 4).map(m => m.type).join(', ') + (still.length > 4
        ? ', +' + (still.length - 4) + ' more' : '') : 'NONE'));
  if (!moved.length) { console.log('    COULD-NOT-STAGE: this engine\'s "' + W + '" changes no damage '
    + 'at all, so an ability that acts as if it were up has nothing to be equivalent to and every arm '
    + 'below would agree for the wrong reason'); red++; continue; }

  for (const mv of moved.concat(still.slice(0, 1))) {
    const isNeg = still.includes(mv);
    const att1 = M.buildMon(megaKey, {}), att2 = M.buildMon(megaKey, {});
    const def = M.buildMon(bag.id, {});
    if (!att1 || !att2 || !def) { console.log('    COULD NOT BUILD A BODY — not a pass'); red++; continue; }
    att1.ability = BREAK ? CONTROL_AB : P.ab.id;      // the holder, no field weather
    att2.ability = CONTROL_AB;                         // the control
    const priv = rolls(M.dmgRange(att1, def, MC.moves[mv.id], {}, false, false, null));
    const real = rolls(M.dmgRange(att2, def, MC.moves[mv.id], { weather: W }, false, false, null));
    const dry = rolls(M.dmgRange(att2, def, MC.moves[mv.id], {}, false, false, null));
    arms += 2;
    const eqOk = same(priv, real), liveOk = isNeg ? same(priv, dry) : !same(priv, dry);
    if (!eqOk) red++;
    if (!liveOk) red++;
    console.log('    ' + (isNeg ? 'NEGATIVE ' : 'AFFECTED ') + mv.type.padEnd(9)
      + (eqOk ? 'ok  ' : 'RED ') + 'EQUIVALENCE private=' + priv[0] + '..' + priv[priv.length - 1]
      + ' real-' + W + '=' + real[0] + '..' + real[real.length - 1]
      + '   ' + (liveOk ? 'ok  ' : 'RED ') + (isNeg ? 'UNCHANGED' : 'LIVE') + ' no-weather='
      + dry[0] + '..' + dry[dry.length - 1]);
  }

  /* PRIVACY. The carrier DEFENDS and an ordinary body throws an affected type at it. `affects: only
   * this Pokemon`, so the reading must be identical with and without the ability — an implementation
   * that raised REAL weather would change this and pass every arm above. */
  {
    const attacker = M.buildMon(ATTACKER, {});
    const d1 = M.buildMon(megaKey, {}), d2 = M.buildMon(megaKey, {});
    const mv = moved[0];
    if (attacker && d1 && d2 && mv) {
      attacker.ability = CONTROL_AB;
      d1.ability = BREAK ? CONTROL_AB : P.ab.id; d2.ability = CONTROL_AB;
      const A = rolls(M.dmgRange(attacker, d1, MC.moves[mv.id], {}, false, false, null));
      const B = rolls(M.dmgRange(attacker, d2, MC.moves[mv.id], {}, false, false, null));
      arms++;
      const ok = same(A, B);
      if (!ok) red++;
      console.log('    PRIVATE   as DEFENDER  ' + (ok ? 'ok  ' : 'RED ')
        + 'a foe\'s ' + mv.type + ' move into the holder: with=' + A[0] + '..' + A[A.length - 1]
        + '  without=' + B[0] + '..' + B[B.length - 1]
        + (ok ? '   (the weather does not leak to the other side)'
              : '   THE ABILITY LEAKED TO THE ATTACKER — it is being modelled as real weather'));
    }
  }
}

console.log('\n  ' + arms + ' arm(s) played, ' + red + ' RED');
if (BREAK) {
  /* UNDER --break EVERY "must be reduced" ARM SHOULD BE RED. A break that leaves an arm green means
   * that arm was never reading the multiplier. */
  console.log('  --break expectation: every "must be reduced" arm RED, every "must be UNCHANGED" arm '
    + 'green (removing a multiplier cannot change a case it never applied to).');
}
process.exit(red && !BREAK ? 1 : 0);
