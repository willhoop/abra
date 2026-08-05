/* THE INTERACTION MATRIX, RUN.   node tests/test-interaction-matrix.js [--depth=N|--full] [--axis=..]
 *
 * `tests/interaction_matrix.js` generates the cross product of every CARRIER tag against every REACTOR
 * tag. This file plays every generated case in `engine/medicham2-browser.js` AND in the official
 * pinned Showdown engine and asks the official engine what should have happened.
 *
 * IT AUTHORS NO EXPECTED OUTCOME. Every one of the ~twenty-three wrong probes this project has
 * produced was a human writing down what should happen; a generator plus a reference engine cannot
 * make that mistake. What a generator CAN do instead is test nothing at all and report agreement, so
 * the whole design here is about telling "correctly resolved" from "silently absent".
 *
 * THE TWO-ARM RULE, WHICH IS THE POINT OF THE FILE
 * ------------------------------------------------
 * Every case is played FOUR times: with the reactor and without it, in each engine.
 *
 *     sdTest  vs sdCtl    -> did the mechanic do anything AT ALL in the reference engine?
 *     mediTest vs sdTest  -> does medicham2 land in the same state as the reference?
 *     mediTest vs mediCtl -> is the knob wired on OUR side?
 *
 * If the reference engine's two arms are IDENTICAL the case is INERT: the interaction cannot express
 * itself in the compared projection, and scoring it would be counting a pass that no engine could
 * fail. Those are reported separately and never counted as agreement. *Identical results across a
 * varied knob mean the knob is unwired* -- applied here to the HARNESS as well as to the engine.
 *
 * THE LAYER DECIDES THE EVALUATOR, AND THAT IS NOT A DETAIL
 * --------------------------------------------------------
 * docs/TAGS.md 92: Legality -> Targeting -> Immunity -> Damage -> Secondary. The state comparator in
 * tests/test-game-diff.js is BLIND to the DAMAGE layer by construction -- an HP amount is a die and it
 * compares `hurt`, a 0-versus-nonzero question. So a `halvesTypeDamage` case handed to it would come
 * back INERT forever and look covered. The damage layer therefore gets its own evaluator, which
 * compares the RATIO each engine applies (reactor arm / control arm) rather than the absolute number:
 * the spread, the formula and the roll all cancel, and what is left is exactly the multiplier under
 * test.
 *
 * THE THIRD EVALUATOR IS THE MULTI-TURN ONE, and it is generated the same way. Will: *"multi turn
 * things like tailwind and trick room."* A pair cannot reach a sequence, but the PERSISTENT FIELD
 * EFFECTS cross-product with each other, and each pair becomes a nine-turn script in which A lands on
 * turn 1 and B on turn 3 and both run to expiry. That is "Trick Room was up and then a Tailwind
 * landed", generated rather than typed.
 */
'use strict';
require('../engine/showdown_path.js');
const fs = require('fs');
const { shrinkDecision } = require('./shrink_guard.js');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));

if (!process.env.SHOWDOWN_PATH) { console.error('NOT RUN — set SHOWDOWN_PATH'); process.exit(2); }

const G = require('./test-game-diff.js');          /* the projection, the comparator, runScript */
const IM = require('./interaction_matrix.js');     /* the generator */
const CS = require(D('engine', 'champions_sim.js'));
const { set, runScript, compare, norm, dex } = G;
const tagsJson = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

const argv = process.argv.slice(2);
const depth = argv.includes('--full') ? Infinity : +((argv.find(a => a.startsWith('--depth=')) || '--depth=4').slice(8));
const axisFilter = (argv.find(a => a.startsWith('--axis=')) || '').slice(7);
const LIMIT = +((argv.find(a => a.startsWith('--limit=')) || '--limit=0').slice(8)) || Infinity;

/* ---- BENCH FILLERS ------------------------------------------------------------------------------
 * A side needs four bodies. They must not collide with the case's own user or holder: medicham2's
 * switch lookup and Showdown's are both BY SPECIES (trap 1 in test-game-diff), so a duplicate species
 * makes the two engines able to mean different bodies. Picked per case from a pool. */
const BENCH = ['Archaludon', 'Incineroar', 'Garchomp', 'Milotic', 'Corviknight', 'Weavile', 'Farigiraf', 'Torkoal'];
function benchFor(used, n) {
  const out = [];
  for (const b of BENCH) { if (out.length >= n) break; if (!used.has(norm(b))) { out.push(b); used.add(norm(b)); } }
  while (out.length < n) out.push(BENCH[0]);
  return out;
}
/* A bench body must ACT and must not change anything. Protect is the only move every one of these
 * legally knows, and a benched body never gets to click anyway. */
const idle = sp => set(sp, ['Protect'], IM.CONTROL_ABILITY);

/* THE IDENTITY OF THE REACTOR IS NOT ITS EFFECT. The projection carries `ability` and `item`, so the
 * two arms differ on those fields by construction -- comparing them raw would say every case is live.
 * Stripped for the INERTNESS question only; the real medi-vs-showdown comparison keeps them, which is
 * what caught Mummy rewriting the attacker's ability. */
function stripIdentity(p, side) {
  const c = JSON.parse(JSON.stringify(p));
  const m = c[side].active[0];
  if (m) { m.ability = ''; m.item = ''; }
  return c;
}

/* ================================================================================================
 * EVALUATOR 1 — STATE.  Legality, Targeting, Immunity, Secondary.
 * ============================================================================================= */
function stageState(c, arm) {
  const used = new Set();
  const atkSide = c.reactor.side === 'atk';
  const userSp = c.carrier.user, holderSp = c.reactor.holder;
  used.add(norm(userSp)); used.add(norm(holderSp));

  /* WHICH THING THE ARM VARIES. An ability or item reactor is REMOVED in the control. A reactor MOVE
   * cannot be removed -- it is clicked -- so the control varies the CARRIER instead: the same body
   * clicks a move of the same category that does not carry the flag. Spiky Shield punishes Wave Crash
   * and must not punish Surf. */
  const reactorIsMove = c.reactor.kind === 'move';
  const carrierName = (arm === 'test' || !reactorIsMove) ? c.carrier.name : c.control.name;
  /* NOTHING IS ASSUMED, WHICH IS tests/test-mechanics.js's `bare()` DISCIPLINE APPLIED TO A GENERATOR.
   * Every body that is not the one under test gets the inert control ability and no item, ALWAYS --
   * a species' dex-default ability is an uncontrolled input, and it produced a false divergence the
   * first time this ran: `closecombat -> chopleberry` read a damage ratio of 56.7% against a true 50% because
   * the bulkiest Fighting-weak body is BASTIODON and its slot-0 ability is STURDY. The control arm's
   * overkill was stopped at 1 HP, so the "full damage" the ratio divided by was not the full damage.
   * The berry was innocent, the harness was not, and the same trap was sitting under every case whose
   * holder happened to have Multiscale, Disguise, Ice Face or Sturdy. */
  const abilityOn = (who) => {
    if (reactorIsMove || c.reactor.kind === 'item') return IM.CONTROL_ABILITY;
    const holderIsAttacker = atkSide;
    if ((who === 'atk') !== holderIsAttacker) return IM.CONTROL_ABILITY;
    return arm === 'test' ? dex.abilities.get(c.reactor.id).name : IM.CONTROL_ABILITY;
  };
  const itemOn = (who) => {
    if (c.reactor.kind !== 'item') return '';
    const holderIsAttacker = atkSide;
    if ((who === 'atk') !== holderIsAttacker) return '';
    return arm === 'test' ? dex.items.get(c.reactor.id).name : '';
  };

  /* The holder must ACT without stopping the incoming move -- Lesson 5 in a generator. */
  let holderMove = reactorIsMove ? dex.moves.get(c.reactor.id).name : IM.fillerFor(dex.species.get(holderSp));
  /* THE FILLER MAY NEVER BE A PROTECT, AND THIS IS THE ASSERTION THAT SAYS SO OUT LOUD.
   *
   * `fillerFor` used to fall back to 'Protect' for a body that learned nothing else, which defended
   * the holder against the exact carrier the case was built to land. Both arms then matched and the
   * case reported INERT -- indistinguishable, from the outside, from "this interaction genuinely
   * cannot express itself". 379 of 2,300 cases were staged that way, including every Gooey, every
   * Aftermath and every Good as Gold case. A standalone reproduction proved Gooey fires in the
   * official engine while this harness recorded it doing nothing.
   *
   * The generator now rejects a holder with no safe filler, so reaching here with a protect means
   * that rejection has been bypassed. It throws rather than degrading, because degrading quietly is
   * the entire failure. */
  /* ONLY THE FILLER BRANCH. When the REACTOR IS the protect -- Spiky Shield, Baneful Bunker, King's
   * Shield -- the holder clicking it is the whole case, and the first version of this guard threw on
   * `fakeout x spikyshield` for doing exactly what it was built to do. A guard that fires on correct
   * behaviour gets deleted, so it is narrowed to the branch that was actually wrong. */
  if (!reactorIsMove && holderMove && IM.PROTECT_FAMILY.has(norm(holderMove)))
    throw new Error('THE HOLDER WOULD BLOCK THE CARRIER: ' + holderSp + ' was given "' + holderMove
      + '" as its filler for ' + c.carrier.id + ' x ' + c.reactor.id + '. A protect makes the case '
      + 'answer itself and report INERT. holderFor() is supposed to have rejected this body.');
  let holderAim = null;
  /* SUCKER PUNCH FAILS AGAINST A TARGET THAT IS NOT ATTACKING, and Helping Hand is a status move — so
   * every one of the eleven Sucker Punch and Upper Hand cases had the carrier FAIL before the reactor
   * could matter, and read INERT. That is the harness answering a question about itself.
   *
   * The holder therefore clicks a DAMAGING move for those carriers. Aimed at the attacker's PARTNER,
   * not at the attacker: aimed at the attacker it would set `hurt` on the attacker in BOTH arms and
   * mask the exact field Rough Skin's punish is read from. The partner is on Protect, so the move
   * lands on nothing and changes no compared state. */
  const needsTargetAttacking = ((tagsJson.moves[norm(c.carrier.id)] || {}).tags || [])
    .includes('failsIfTargetNotAttacking');
  if (needsTargetAttacking && !reactorIsMove) {
    const atk = attackingFillerFor(holderSp);
    if (atk) { holderMove = atk; holderAim = 1; }
  }
  const A = [set(userSp, [carrierName, 'Protect'], abilityOn('atk'), itemOn('atk'))];
  const B = [set(holderSp, [holderMove, 'Protect'], abilityOn('def'), itemOn('def'))];
  for (const b of benchFor(used, 3)) A.push(idle(b));
  for (const b of benchFor(used, 3)) B.push(idle(b));
  const hAct = norm(holderMove) === 'helpinghand' ? { m: 'helpinghand', ally: 1 }
    : holderAim != null ? { m: norm(holderMove), t: holderAim }
    /* A REACTOR MOVE IS AN ORDINARY MOVE AND MOST OF THEM NEED A TARGET. Beak Blast, Throat Chop,
     * Sucker Punch, Taunt and Upper Hand all do, and emitting no target made `battle.choose` REJECT
     * the turn — fifteen cases that threw rather than ran. `needsTarget` is the dex's own answer. */
    : { m: norm(holderMove), ...(G.needsTarget(norm(holderMove)) ? { t: 0 } : {}) };
  const script = [{ a: [{ m: norm(carrierName), t: 0 }, { m: 'protect' }], b: [hAct, { m: 'protect' }] }];
  return { A, B, script, blocked: norm(holderMove) === 'protect' && !reactorIsMove };
}

/* The weakest 100%-accurate damaging foe-targeting move the body legally knows, so a case that needs
 * the holder to be ATTACKING gets one without also getting a knockout. */
const attackFillerCache = new Map();
function attackingFillerFor(speciesName) {
  if (attackFillerCache.has(speciesName)) return attackFillerCache.get(speciesName);
  const ls = dex.species.getLearnsetData(dex.species.get(speciesName).id);
  let best = null;
  for (const id of Object.keys((ls && ls.learnset) || {})) {
    const m = dex.moves.get(id);
    if (!m.exists || m.category === 'Status') continue;
    if (m.accuracy !== true && m.accuracy < 100) continue;
    if ((m.secondaries || []).some(s => s.chance != null && s.chance < 100)) continue;
    if (!['normal', 'any', 'adjacentFoe'].includes(m.target)) continue;
    if (!m.basePower) continue;
    if (!best || m.basePower < best.basePower) best = m;
  }
  attackFillerCache.set(speciesName, best ? best.name : null);
  return best ? best.name : null;
}

function runState(c) {
  const out = { evaluator: 'state' };
  const arms = {};
  for (const arm of ['test', 'ctl']) {
    const st = stageState(c, arm);
    out.blocked = st.blocked;
    const collect = [];
    /* `allowRolls` LIFTS TRAP 2 FOR THIS ONE SCRIPT, and only because the dice are pinned to the same
     * median in both engines — see carrierRollVerdict in the generator and the pinning block in
     * tests/test-game-diff.js. It is passed per CASE, off the carrier the generator marked, never as a
     * blanket setting: a blanket one would also excuse a control carrier that rolls, and the control
     * is the thing the whole two-arm design subtracts with. */
    try { runScript(c.id + '/' + arm, st.A, st.B, st.script, { collect, pinDice: true, allowRolls: !!c.carrier.rolls }); }
    catch (e) { out.failure = e.message.slice(0, 130); return out; }
    if (!collect.length) { out.failure = 'no turn was played'; return out; }
    arms[arm] = collect[collect.length - 1];
  }
  /* ONLY THE BODY UNDER TEST IS STRIPPED, AND THAT MATTERS. The first version blanked `ability` and
   * `item` on all four active slots, which is one field too many: MUMMY and WANDERING SPIRIT rewrite
   * the ATTACKER's ability, so the attacker's ability field is their ONLY witness in this projection.
   * Blanking it made both read INERT -- the harness deleting the evidence for the two mechanics the
   * previous pass had filed as unfixed. */
  const witnessSide = c.reactor.side === 'atk' ? 'A' : 'B';
  const sdMoved = compare(stripIdentity(arms.test.sd, witnessSide), stripIdentity(arms.ctl.sd, witnessSide));
  const mediMoved = compare(stripIdentity(arms.test.medi, witnessSide), stripIdentity(arms.ctl.medi, witnessSide));
  out.sdWitness = sdMoved.map(d => d[0]);
  out.mediWitness = mediMoved.map(d => d[0]);
  out.inert = !sdMoved.length;
  const diffs = compare(arms.test.medi, arms.test.sd);
  /* A KO the two engines time differently is a DAMAGE MAGNITUDE question and tests/test-engine-diff.js
   * owns it. Detected on `species` as well as `fainted`, because a fainted body is REPLACED and the
   * slot then holds a different Pokemon. Counted, never dropped. */
  out.koTiming = diffs.some(([p]) => /\.active\[\d+\]\.(fainted|species)$/.test(p))
    && dex.moves.get(norm(c.carrier.name)).category !== 'Status';
  out.diffs = diffs.slice(0, 4);
  out.agrees = !diffs.length;
  return out;
}

/* ================================================================================================
 * EVALUATOR 2 — DAMAGE.  A RATIO, so the spread, the formula and the roll all cancel.
 * ============================================================================================= */
const FIELD0 = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, wgA: false, wgB: false };
function runDamage(c) {
  const out = { evaluator: 'damage' };
  const atkSide = c.reactor.side === 'atk';
  const mv = (globalThis.MC && MC.moves) ? MC.moves[norm(c.carrier.id)] : null;
  if (!mv) { out.failure = 'medicham2 has no MC.moves row for ' + c.carrier.id; return out; }
  const medi = {}, sd = {};
  const holderBuild = M.buildMon(norm(c.reactor.holder), {});
  const defMax = (holderBuild ? holderBuild.st.hp : 150) * 8;      /* matches hpBoost below */
  for (const arm of ['test', 'ctl']) {
    /* --- medicham2: dmgRange is pure and needs no battle --- */
    const att = M.buildMon(norm(c.carrier.user), {}), def = M.buildMon(norm(c.reactor.holder), {});
    if (!att || !def) { out.failure = 'buildMon failed'; return out; }
    att.item = ''; def.item = ''; att.ability = 'none'; def.ability = 'none';
    const who = atkSide ? att : def;
    if (c.reactor.kind === 'item') who.item = norm(arm === 'test' ? c.reactor.id : '');
    else who.ability = norm(arm === 'test' ? c.reactor.id : IM.CONTROL_ABILITY);
    medi[arm] = M.dmgRange(att, def, mv, Object.assign({}, FIELD0), false).max;

    /* --- Showdown: the FULL pipeline with the dice pinned, so every onTryHit / onBasePower /
     * onModifyDamage the ability owns actually runs. Reading the target's HP loss rather than calling
     * moveHit is what makes this need no CONTROL FIX of its own. --- */
    const st = stageState(c, arm);
    const collect = [];
    try { runScript(c.id + '/dmg/' + arm, st.A, st.B, st.script, { collect, pinDice: true, hpBoost: 8, allowRolls: !!c.carrier.rolls }); }
    catch (e) { out.failure = e.message.slice(0, 130); return out; }
    if (!collect.length) { out.failure = 'no turn was played'; return out; }
    const last = collect[collect.length - 1];
    sd[arm] = 1 - last.sdHp[2];                              /* [A0,A1,B0,B1] -> the defender */
    /* A BODY THAT FAINTED WAS REPLACED, AND THE REPLACEMENT IS ON FULL HP — so the slot reads a LOSS
     * OF ZERO and a lethal hit looks like an immunity. Strong Jaw x1.5 KO'd the target in the reactor
     * arm and the ratio came back 0.000, which reads exactly like an unwired boost pointing the wrong
     * way. Recorded per arm; the case is then excluded as SATURATED, never scored. */
    if (last.sd.B.active[0] && last.sd.B.active[0].fainted) sd[arm + 'Fainted'] = true;
    if (last.sd.B.active[0] && last.sd.B.active[0].species !== IM.norm(c.reactor.holder).replace(/mega.*$/, 'mega')) sd[arm + 'Fainted'] = true;
  }
  out.mediRatio = medi.ctl > 0 ? medi.test / medi.ctl : null;
  out.sdRatio = sd.ctl > 0 ? sd.test / sd.ctl : null;
  out.detail = 'medi ' + medi.ctl + '->' + medi.test + '   sd ' + sd.ctl.toFixed(3) + '->' + sd.test.toFixed(3);
  /* SATURATION IS NOT AGREEMENT. If the control arm already took the body to 0, the reference "damage"
   * is clamped at the max HP and its ratio is meaningless -- the halving would read as 1.0 and the
   * engine would be scored right for a number nobody measured. Counted, never scored. */
  if (sd.ctl >= 0.999 || sd.test >= 0.999 || sd.testFainted || sd.ctlFainted) { out.saturated = true; return out; }
  /* INTEGER DAMAGE IS QUANTISED AND A SMALL HIT CANNOT CARRY A RATIO. Mach Punch into a bulky body is
   * 21 damage; Iron Fist's x1.2 is 24 rounded, a measured 1.143 against a true 1.2. That is the
   * FLOOR of the instrument, not a disagreement, and the alternative -- widening the tolerance to
   * swallow it -- would also swallow a real 10% error on every big hit. Counted as its own bucket. */
  if (medi.ctl < 12) { out.lowSignal = true; return out; }
  /* AND THE TOLERANCE CARRIES THE QUANTISATION RATHER THAN HIDING IT. Both sides are integers, so the
   * smallest error either engine can express is one point of damage. Mach Punch into a bulky body is
   * 21; Iron Fist's x1.2 rounds to 24, a measured 1.143 against a true 1.2, and no engine could do
   * better. A flat 6% tolerance would call that a bug; a flat 15% would swallow a real 10% error on a
   * big hit. So the floor is the measurement's own resolution. */
  if (out.sdRatio == null || out.mediRatio == null) { out.zeroControl = true; return out; }
  const quant = 1 / Math.max(1, sd.ctl * defMax) + 1 / medi.ctl;
  out.tol = Math.max(0.06, 3 * quant) * Math.max(1, out.sdRatio);
  out.inert = Math.abs(out.sdRatio - 1) < 0.02;
  out.agrees = Math.abs(out.mediRatio - out.sdRatio) <= out.tol;
  return out;
}

/* ================================================================================================
 * EVALUATOR 3 — FIELD.  The multi-turn half: two persistent effects layered, run to expiry.
 * ============================================================================================= */
function runField(c) {
  const out = { evaluator: 'field' };
  const used = new Set([norm(c.carrier.user), norm(c.reactor.holder)]);
  const A = [set(c.carrier.user, [c.carrier.name, 'Protect']), set(c.reactor.holder, [c.reactor.name, 'Protect'])];
  for (const b of benchFor(used, 2)) A.push(idle(b));
  const B = benchFor(used, 4).map(idle);
  const idleTurn = { a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] };
  const script = [
    { a: [{ m: norm(c.carrier.id) }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    idleTurn,
    { a: [{ m: 'protect' }, { m: norm(c.reactor.id) }], b: [{ m: 'protect' }, { m: 'protect' }] },
    /* EIGHT TURNS, AND THE CEILING IS PP. medicham2 does not track PP at all (it is in NOT_COMPARED),
     * Showdown does, and Protect on these sets has EIGHT of it. At nine turns every idle body ran out
     * and STRUGGLED -- three bodies suddenly damaged on turn 9 of 126 of the 156 field cases, an 80%
     * "divergence" rate that was entirely the harness. Eight turns still covers every expiry that
     * matters: the second effect lands on turn 3 and the longest counter in the set is 5. */
    ...Array.from({ length: 5 }, () => idleTurn),
  ];
  const collect = [];
  let r = null;
  try { r = runScript('field/' + c.id, A, B, script, { collect, pinDice: true }); }
  catch (e) { out.failure = e.message.slice(0, 130); return out; }
  /* INERTNESS FOR A FIELD CASE: did the reference engine's projection actually SHOW both effects? A
   * setter whose effect no projection field carries would make every turn agree trivially. */
  const seen = new Set();
  for (const t of collect) for (const [k, v] of Object.entries(t.sd.field)) if (v) seen.add(k);
  for (const t of collect) for (const s of ['A', 'B']) for (const k of ['reflect', 'lightscreen']) if (t.sd[s][k]) seen.add(k);
  out.fieldsSeen = [...seen].sort();
  out.inert = seen.size < 2;
  out.turnsCompared = collect.length;
  out.agrees = !r;
  if (r) { out.turn = r.turn; out.diffs = r.diffs.slice(0, 4); }
  return out;
}

/* ================================================================================================
 * THE RUN. Wrapped in `main()` and exported below, so the staging can be exercised by a measurement
 * without publishing an artifact. Requiring this file used to RUN the whole matrix and WRITE
 * data/interaction-matrix.json as a side effect of the require — which makes it impossible to
 * measure the harness with the harness.
 * ============================================================================================= */
function main() {
const gen = IM.generate({ depth });
const th = IM.theoreticalSize();
let cases = gen.cases;
if (axisFilter) cases = cases.filter(c => c.axis === axisFilter);
if (cases.length > LIMIT) cases = cases.slice(0, LIMIT);

console.log('THE GENERATED INTERACTION MATRIX — medicham2 against the official pinned Showdown engine');
console.log('  Showdown ' + CS.PINNED_COMMIT + '\n');
console.log('  SIZE');
console.log('    theoretical cross product, no filter at all : ' + th.total
  + '   (flag ' + th.flag + ', type ' + th.type + ', field ' + th.field + ')');
console.log('    emitted at --depth=' + depth + '                        : ' + gen.cases.length
  + '   ' + JSON.stringify(gen.byAxis));
console.log('    run in this pass                            : ' + cases.length);
console.log('    by layer   ' + JSON.stringify(gen.byLayer));
console.log('    by evaluator ' + JSON.stringify(gen.byEvaluator) + '\n');
console.log('  WHAT THE GENERATOR REFUSED TO EMIT, every reason named:');
for (const [r, k] of Object.entries(gen.dropped).sort((a, b) => b[1].n - a[1].n))
  console.log('    ' + String(k.n).padStart(5) + '  ' + r + '   e.g. ' + k.eg.slice(0, 2).join(' | '));
console.log('');

const rows = [];
const t0 = Date.now();
for (const c of cases) {
  const r = c.evaluator === 'damage' ? runDamage(c) : c.evaluator === 'field' ? runField(c) : runState(c);
  rows.push({ ...c, result: r });
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const tally = (pred) => rows.filter(pred).length;
/* THE OUTCOME BUCKETS ARE A PARTITION, AND THEY HAD TO BE MADE ONE. `live` was the only filter that
 * excluded the others; `saturated` did not exclude a row that had THROWN and `ko` excluded nothing at
 * all, so a row could be counted in two buckets and the five printed totals summed to four MORE than
 * the number of cases actually run. Four is small. The point is that nothing in the run compared the
 * two, exactly as nothing compared theoretical to staged+dropped on the generation side.
 *
 * One classifier, one precedence, stated: a case that could not be STAGED says nothing about the
 * engine; one whose reference arms are identical cannot express itself; a clamped damage ratio is not
 * a measurement; a KO-timing split belongs to tests/test-engine-diff.js; what survives is LIVE. */
const bucketOf = r => r.result.failure ? 'threw'
  : r.result.inert ? 'inert'
  : (r.result.saturated || r.result.zeroControl || r.result.lowSignal) ? 'saturated'
  : r.result.koTiming ? 'ko'
  : 'live';
const BUCKETS = { threw: [], inert: [], saturated: [], ko: [], live: [] };
for (const r of rows) BUCKETS[bucketOf(r)].push(r);
const { threw, inert, saturated, ko, live } = BUCKETS;
{
  const sum = threw.length + inert.length + saturated.length + ko.length + live.length;
  if (sum !== rows.length)
    throw new Error('OUTCOME BUCKETS ARE NOT A PARTITION: ' + sum + ' bucketed vs ' + rows.length
      + ' run. Every case that ran has exactly one outcome, or the coverage line is arithmetic on '
      + 'overlapping sets.');
}
const agree = live.filter(r => r.result.agrees);
const part = live.filter(r => !r.result.agrees);

/* A DISAGREEMENT IS A DISAGREEMENT WHETHER OR NOT THE REACTOR MATTERED, AND THIS GATE HAD IT BACKWARDS.
 *
 * Will, 2026-08-05: *"why dont we compare medicham to showdown while testing? that would be the
 * easiest way to catch? instead of the dumb way of comparing it to itself."*
 *
 * The two-arm test is not the dumb half -- it exists because a mechanic MISSING from medicham2, in a
 * staging that also stops it firing in Showdown, makes both engines produce identical states and
 * scores as AGREE. A capability that is absent would pass. That is this project's signature failure.
 *
 * But it was being used as a GATE: an INERT case was discarded before its medicham2-vs-Showdown
 * result was ever read. Measured across the 497 inert state cases, 49 of them had the two engines in
 * DIFFERENT states, every one thrown away -- including ten showing that medicham2 does not implement
 * Taunt blocking status moves at all (a Taunted body still lands Hypnosis, Stun Spore, Decorate,
 * Screech, Disable), plus Simple Beam and Worry Seed not applying, and Last Resort and Upper Hand
 * firing where they should fail.
 *
 * INERT means "an AGREEMENT here proves nothing", never "a DISAGREEMENT here does not count". The
 * label suppresses the positive claim only. These are reported and counted; they stay OUT of the
 * agreement rate, because that rate is a claim about pairs where the reactor demonstrably fired. */
const offGate = rows.filter(r => r !== undefined
  && bucketOf(r) !== 'live' && bucketOf(r) !== 'threw'
  && r.result && r.result.diffs && r.result.diffs.length);

console.log('  RAN ' + rows.length + ' cases in ' + secs + 's\n');
console.log('  CAN THE PAIR ACTUALLY MEET? — answered by the REFERENCE engine, not by us:');
console.log('    ' + String(live.length).padStart(5) + '  LIVE      the reference engine\'s two arms differ, so the mechanic fires');
console.log('    ' + String(inert.length).padStart(5) + '  INERT     the reference engine behaves IDENTICALLY with and without the reactor —');
console.log('             the case cannot express itself in what this instrument compares, and scoring it');
console.log('             would count a pass no engine could fail');
console.log('    ' + String(saturated.length).padStart(5) + '  SATURATED the control arm already dealt 100% of the target\'s HP, so a damage RATIO');
console.log('             is clamped and meaningless');
console.log('    ' + String(ko.length).padStart(5) + '  KO-TIMING a damage-magnitude disagreement — tests/test-engine-diff.js owns it');
console.log('    ' + String(threw.length).padStart(5) + '  THREW     the harness could not stage it\n');
console.log('  OF THE ' + live.length + ' LIVE CASES, medicham2 matches the official engine on '
  + agree.length + '   (' + (live.length ? (100 * agree.length / live.length).toFixed(1) : '0.0') + '%)\n');

if (part.length) {
  console.log('  WHERE THEY PART:');
  for (const r of part) {
    const d = r.result.evaluator === 'damage'
      ? 'ratio medi ' + (r.result.mediRatio == null ? '—' : r.result.mediRatio.toFixed(3))
        + ' vs sd ' + (r.result.sdRatio == null ? '—' : r.result.sdRatio.toFixed(3)) + '   ' + r.result.detail
      : (r.result.turn ? 'turn ' + r.result.turn + '  ' : '')
        + (r.result.diffs || []).map(x => x[0] + ' medi=' + x[1] + ' sd=' + x[2]).join('  |  ');
    console.log('    ' + r.layer.padEnd(10) + r.key.padEnd(22) + r.carrier.id.padEnd(15) + ' -> '
      + r.reactor.id.padEnd(17) + d);
    /* A LIVE CASE WHOSE OWN ARMS AGREE ON OUR SIDE IS AN UNWIRED KNOB, not a wrong number. Printed
     * because the two need different fixes and read identically in a diff. */
    if (r.result.mediWitness && !r.result.mediWitness.length)
      console.log('      ^ medicham2\'s OWN two arms are identical: the knob is UNWIRED, not miscalculated');
    if (r.result.evaluator === 'damage' && r.result.mediRatio != null && Math.abs(r.result.mediRatio - 1) < 0.02)
      console.log('      ^ medicham2\'s ratio is 1.000: the knob is UNWIRED, not miscalculated');
  }
  console.log('');
}
if (offGate.length) {
  console.log('  THE ENGINES DIFFER ON CASES THE GATE DISCARDED — ' + offGate.length + ' of them.');
  console.log('  The reactor did not demonstrably fire, so these are NOT in the agreement rate above.');
  console.log('  They are still medicham2 disagreeing with the official engine, and they used to be');
  console.log('  thrown away unread. INERT means an AGREEMENT proves nothing; a DISAGREEMENT still counts:');
  for (const r of offGate.slice(0, 30))
    console.log('    ' + r.key.padEnd(20) + (r.carrier.id + ' -> ' + r.reactor.id).padEnd(34)
      + (r.result.diffs || []).slice(0, 2).map(d => d[0] + ' medi=' + d[1] + ' sd=' + d[2]).join('  |  '));
  if (offGate.length > 30) console.log('    ... ' + (offGate.length - 30) + ' more');
  console.log('');
}
if (threw.length) {
  console.log('  THREW — the harness, not the engine. Named, never dropped silently:');
  for (const r of threw.slice(0, 20)) console.log('    ' + r.key.padEnd(22) + r.carrier.id + ' -> ' + r.reactor.id + '  ' + r.result.failure);
  if (threw.length > 20) console.log('    ... ' + (threw.length - 20) + ' more');
  console.log('');
}
console.log('  INERT, by reason — this is the honest coverage line:');
const inertBy = {};
for (const r of inert) (inertBy[r.evaluator + '/' + r.layer] = inertBy[r.evaluator + '/' + r.layer] || []).push(r);
for (const k of Object.keys(inertBy).sort())
  console.log('    ' + String(inertBy[k].length).padStart(4) + '  ' + k + '   e.g. '
    + inertBy[k].slice(0, 3).map(r => r.carrier.id + '->' + r.reactor.id).join(', '));
console.log('');

const artifact = {
  generated: new Date().toISOString(), by: 'tests/test-interaction-matrix.js',
  showdown_commit: CS.PINNED_COMMIT, depth: depth === Infinity ? 'full' : depth,
  theoretical: th, emitted: gen.cases.length, ran: rows.length,
  by_axis: gen.byAxis, by_layer: gen.byLayer, by_evaluator: gen.byEvaluator,
  dropped_by_the_generator: Object.fromEntries(Object.entries(gen.dropped).map(([k, v]) => [k, v.n])),
  live: live.length, agree: agree.length, part: part.length,
  /* THE HEADLINE PERCENTAGE IS A FACT IN THE FILE, not one every document recomputes. Six living docs
   * quote it; each was deriving it from `agree / live` by hand, so `tests/test-docs-current.js` could
   * only report it as a figure no artifact contains — correctly, since none did. A number that many
   * documents cite belongs in the artifact at the precision the documents use. */
  agreement_pct: live.length ? +(100 * agree.length / live.length).toFixed(1) : null,
  /* Likewise the coverage fraction, which is the honest half of the claim above. */
  staged_pct_of_theoretical: th.total ? +(100 * gen.cases.length / th.total).toFixed(1) : null,
  inert: inert.length, saturated: saturated.length, ko_timing: ko.length, threw: threw.length,
  not_compared: G.NOT_COMPARED.map(x => x[0]),
  /* THE INERT ROWS ARE WRITTEN OUT, and until now only their COUNT was.
   *
   * INERT means the reference engine behaved identically with and without the reactor, so the case
   * expresses nothing and is never scored. That is usually honest. It is also the ONE outcome this
   * whole instrument cannot self-diagnose: if the STAGING is wrong — the holder was immune, the
   * carrier never connected, the body could not survive to show the effect — then both arms are
   * wrong together, they agree perfectly, and the case reports INERT rather than reporting a fault.
   * A shared blind spot cancels out exactly. It has already happened twice in this file's own
   * reference harness (both defenders given Protect as their only move; then Earthquake, which
   * `battle.choose` rejects).
   *
   * A human who knows what a mechanic NEEDS in order to fire can read this list and say "that one
   * should have done something" in about a second, which is a judgement no oracle can make — the
   * oracle faithfully reports that nothing happened and cannot ask why. Sorted by carrier usage so
   * the moves people actually click come first. */
  inert_rows: inert.map(r => ({
    axis: r.axis, key: r.key, layer: r.layer,
    carrier: r.carrier.id, carrier_uses: r.carrier.uses || 0, user: r.carrier.user,
    reactor: r.reactor.id, reactor_kind: r.reactor.kind, holder: r.reactor.holder,
    side: r.reactor.side, evaluator: r.evaluator,
  })).sort((a, b) => b.carrier_uses - a.carrier_uses),
  parting: part.map(r => ({ axis: r.axis, key: r.key, layer: r.layer, carrier: r.carrier.id,
    reactor: r.reactor.id, kind: r.reactor.kind, side: r.reactor.side, uses: r.carrier.uses,
    evaluator: r.result.evaluator, medi_ratio: r.result.mediRatio, sd_ratio: r.result.sdRatio,
    medi_witness: r.result.mediWitness, sd_witness: r.result.sdWitness,
    turn: r.result.turn || null, diffs: r.result.diffs || null, detail: r.result.detail || null })),
  threw_rows: threw.map(r => ({ key: r.key, carrier: r.carrier.id, reactor: r.reactor.id, why: r.result.failure })),
  /* Disagreements on cases the two-arm gate discarded. Kept OUT of `agree`/`part` because the
   * agreement rate is a claim about pairs where the reactor demonstrably fired -- and kept IN the
   * artifact because they are real differences between the two engines and were previously computed
   * and thrown away unread. */
  off_gate: offGate.length,
  off_gate_rows: offGate.map(r => ({ key: r.key, bucket: bucketOf(r), carrier: r.carrier.id,
    reactor: r.reactor.id, kind: r.reactor.kind, uses: r.carrier.uses || 0,
    diffs: (r.result.diffs || []).map(d => ({ path: d[0], medi: d[1], sd: d[2] })) })),
};
/* A SHALLOW RUN MAY NOT OVERWRITE A DEEP ONE.
 *
 * Caught immediately, by doing it: running this file without `--full` to look at the output replaced
 * a published 1,008-case artifact with a 323-case one. Both are HONEST — each records its own
 * `depth` — and that is exactly why it is dangerous. Nothing was wrong, nothing failed, and every
 * downstream reader would have quoted a third of the coverage as though it were the whole matrix.
 * The default invocation is the one a person reaches for, so the default invocation is the one that
 * silently downgrades.
 *
 * The same shape as the mtime problem in `engine/provenance.js` one commit earlier: a derived
 * artifact whose validity depends on something the file records but nobody compares.
 *
 * Refuse rather than prompt. `--full` is one word, and a run that prints its numbers without
 * publishing them is still a completely useful run.
 *
 * TWO DEFECTS IN THIS GUARD, BOTH PAID FOR ON 2026-08-05, BOTH FIXED BELOW.
 *
 * 1. THE ADVICE SENT YOU IN A CIRCLE. It said "Re-run with --full to publish" — but the test is
 *    `live < prevLive` and nothing else, so `--full` does not satisfy it and never could. A run
 *    already at `--full` was told to re-run at `--full`. The only route is `--publish-shallow`,
 *    which the same sentence mentioned last and framed as the unusual case.
 *
 * 2. A DECLARED SHRINK RECORDED NO REASON. `--publish-shallow` was a bare boolean, so an accepted
 *    shrink left nothing on disk saying WHY it was accepted, and a later reader could not tell a
 *    legitimate one from a mistake waved through.
 *
 * What that cost: four redundant tags were retired, live legitimately fell 1,012 -> 899, and the
 * `--full` run reporting 899/899 = 100.0% was REFUSED publication. The number was real and correct.
 * It was read off the terminal into the whitepaper, the deck, the technical docs and SUMMARY.md,
 * where it sat for hours as a figure four living documents attributed to an artifact that did not
 * contain it. The guard was right to fire and the number was right too; what was missing was any
 * way to say "this shrink is intended, and here is why".
 *
 * So a shrink is now DECLARED WITH ITS REASON and the reason is written into the artifact — the
 * same shape as `RAW-STORE-OK` and `provenance.js`'s `void: true`: a judgement is not suppressed,
 * it is recorded where a consumer will see it. A bare `--publish-shallow` is refused, because a
 * flag that silences a gate without saying why is a flag that eventually silences it wrongly. */
const OUT = D('data', 'interaction-matrix.json');
let prevLive = null;
/* ENOENT is a genuine first run. Anything else means the PUBLISHED artifact is unreadable, and
 * saying nothing would let this run silently replace a deeper artifact it could not even open —
 * the exact depth-downgrade this guard exists to refuse. */
try { prevLive = JSON.parse(fs.readFileSync(OUT, 'utf8')).live; }
catch (e) { if (e.code !== 'ENOENT') console.error(`  note: data/interaction-matrix.json exists but is unreadable (${e.message}) — treating as a first run, so the depth guard cannot fire`); }

const decision = shrinkDecision(prevLive, artifact.live, process.argv.slice(2));
if (!decision.write) {
  console.log('\n  NOT WRITTEN — ' + decision.why);
  for (const line of decision.advice) console.log('  ' + line);
} else {
  if (decision.declared) {
    artifact.shrink_declared = {
      from: prevLive, to: artifact.live, depth: depth === Infinity ? 'full' : depth,
      reason: decision.declared,
      note: 'A shrink was accepted deliberately. This block is the record of that judgement; ' +
            'without it the drop from ' + prevLive + ' to ' + artifact.live + ' is indistinguishable ' +
            'from a shallow run overwriting a deep one.',
    };
  }
  fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n');
  console.log('  wrote data/interaction-matrix.json'
    + (decision.declared ? '  (declared shrink: ' + decision.declared + ')' : ''));
}

/* A DIVERGENCE IS A FINDING AND IS REPORTED, exactly as the census reports a MISSING mechanic — a file
 * that went red and got ignored would be worthless. What DOES make this file exit non-zero is the
 * instrument failing: zero live cases means the two-arm design found nothing it could judge, which is
 * a broken harness rather than a clean engine. */
if (!live.length) {
  console.log('\n  FAILED: not one case was LIVE. The harness judged nothing.');
  process.exitCode = 1;
}
}

module.exports = { stageState, runState, runDamage, runField, attackingFillerFor, idle, benchFor };
if (require.main === module) main();
