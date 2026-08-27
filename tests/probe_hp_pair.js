/* probe_hp_pair.js — THE CRIT IS ROLLED ONCE PER CLICK HERE AND ONCE PER HIT IN THE AUTHORITY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_hp_pair.js
 *
 * WHERE THIS CAME FROM. The 2026-08-27 pinned whole-game differential (961 games, arm `middle`,
 * pin digest 44bd49403231) carries two board-material rows that were handed over as "two bodies,
 * similar-sized gaps, likely one rule". Read out of `first_divergences`, both streams side by side:
 *
 *   seed ...2656492881 vs ...2656780112, turn 5, index 76
 *     |switch|p1a: Glimmora|Glimmora-Mega, L50|158/158
 *     |move|p2b: Aerodactyl|Dual Wingbeat|p1a: Glimmora
 *     |-resisted| |-crit| |-damage|134/158      <- hit 1: BOTH engines crit, SAME number
 *     |-resisted|                               <- hit 2 begins, still agreed
 *     showdown  |-damage|p1a: Glimmora|117/158  <- 17, no crit
 *     medicham2 |-crit|p1a: Glimmora            <- crits AGAIN, 25, ends on 109
 *
 *   seed ...2657375767 vs ...2657339156, turn 5, index 59
 *     |switch|p1a: Tyranitar|Tyranitar, L50|135/175
 *     |move|p2b: Aerodactyl|Dual Wingbeat|p1a: Tyranitar
 *     |-resisted| |-crit| |-damage|113/175      <- hit 1: BOTH engines crit, SAME number
 *     |-resisted|
 *     showdown  |-damage|p1a: Tyranitar|98/175  <- 15, no crit
 *     medicham2 |-crit|p1a: Tyranitar           <- crits AGAIN, 24, ends on 89
 *
 * 109 vs 117 and 89 vs 98 are the two board-material rows. They are ONE rule: a two-hit move whose
 * SECOND arrival inherits the FIRST arrival's crit. It is not the mega arithmetic closed earlier the
 * same day — hit 1 agreed to the point in both games, and Tyranitar is not a mega.
 *
 * THE AUTHORITY, READ NOT RECALLED. `data/mods/champions/scripts.ts` overrides `hitStepMoveHitLoop`
 * (:428) and `spreadMoveHit` (:315) and overrides NEITHER `getSpreadDamage` NOR `getDamage`, so the
 * crit roll is mainline's and the loop around it is the mod's:
 *
 *   data/mods/champions/scripts.ts:461   for (hit = 1; hit <= targetHits; hit++) {
 *   data/mods/champions/scripts.ts:518     [moveDamageThisHit, targetsCopy] = this.spreadMoveHit(...)
 *   data/mods/champions/scripts.ts:361     damage = this.getSpreadDamage(damage, targets, ...)
 *   sim/battle-actions.ts:1156             const curDamage = this.getDamage(source, target, moveData);
 *   sim/battle-actions.ts:1636-1642        const moveHit = target.getMoveHitData(move);
 *                                          moveHit.crit = move.willCrit || false;
 *                                          if (move.willCrit === undefined) {
 *                                            if (critRatio) moveHit.crit =
 *                                              this.battle.randomChance(1, critMult[critRatio]);
 *                                          }
 *   sim/dex-moves.ts:486                   this.critRatio = Number(data.critRatio) || 1;  -> 1/24
 *
 * So the die is inside the per-hit call. N hits spend N crit draws.
 *
 * THIS ENGINE, AND IT ALREADY SAYS SO IN ITS OWN COMMENT. `engine/medicham2-browser.js:27602` draws
 * `_R.crit()` ONCE for the click, `:27644` records one `R.crit`, and `:28199` re-emits that single
 * boolean before EVERY arrival of the volley. ROADMAP #322's header at :27668 states the gap in
 * plain words — *"The CRIT ITSELF is still one decision for the whole volley; the authority rolls it
 * per hit too, and that is a separate defect which this wire deliberately does not touch"*. This
 * probe is that declaration turned into a failing measurement.
 *
 * THE KNOB IS THE HIT COUNT AND IT IS CLEARED EXPLICITLY. Every row is played with a crit die that
 * says CRIT on draw 0 and NO-CRIT on every later draw. A per-hit engine must then crit arrival 1 and
 * no other; a per-click engine crits every arrival. The single-hit CONTROL is the same staging with
 * a move the format itself reports as non-multihit, and it must agree — a probe where the control
 * also parts is measuring the staging, not the rule.
 *
 * BOTH SIDES ARE ASKED THE SAME QUESTION, because a one-sided instrument is this repo's most
 * expensive failure shape: the count reported per engine is "how many times did you draw the crit
 * die for this one click", authority via `battle.randomChance(1, 24)`, ours via the `crit` stream.
 * The OUTCOME (which arrivals crit, and their damage) is asserted as well as the count, so the row
 * cannot pass by classifying.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('CRIT PER HIT');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* ---- STAGING: flat level-50 bodies in BOTH engines (the shape tests/test-multihit-roll.js uses) -- */
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function flatStats(name) {
  const bs = dex.species.get(name).baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}
const key = (name) => dex.species.get(name).id;
const inertMove = (species) => CS.firstLegalMove(species) || CS.INERT_MOVE;
const NEUTRAL_AB = 'Illuminate';   /* on EVERY body both sides, so no body's own ability is its control */
const HPX = 40;                    /* the defender cannot faint and cannot reach a pinch */
const PAL = 'Ditto';
const ROLL_INDEX = 0;              /* the damage index is pinned; only the crit die is allowed to vary */

function mkSet(name, move) {
  return { name, species: name, item: '', ability: dex.species.get(name).abilities[0],
           moves: [move], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}

/* ---- THE AUTHORITY -------------------------------------------------------------------------------
 * `randomChance` does NOT route through `battle.random` (sim/battle.ts:350 calls `this.prng`
 * directly), so the crit must be intercepted on `randomChance` itself and the damage index on
 * `random`. Only the (1, 24) calls are the crit; accuracy is (acc, 100) and a secondary is
 * (chance, 100), and both are left alone. */
function sdRun(row) {
  const teamA = [mkSet(row.att, row.move), mkSet(PAL, inertMove(PAL)), mkSet(PAL, inertMove(PAL)), mkSet(PAL, inertMove(PAL))];
  const teamB = [mkSet(row.def, inertMove(row.def)), mkSet(PAL, inertMove(PAL)), mkSet(PAL, inertMove(PAL)), mkSet(PAL, inertMove(PAL))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  const A = flatStats(row.att), Dst = flatStats(row.def);
  src.storedStats.atk = A.at; src.storedStats.spa = A.sa; src.storedStats.def = A.df; src.storedStats.spd = A.sd;
  tgt.storedStats.atk = Dst.at; tgt.storedStats.spa = Dst.sa; tgt.storedStats.def = Dst.df; tgt.storedStats.spd = Dst.sd;
  src.maxhp = A.hp; src.hp = A.hp;
  tgt.maxhp = Dst.hp * HPX; tgt.hp = tgt.maxhp;
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) p.clearBoosts();
  battle.field.clearWeather(); battle.field.clearTerrain();
  const setAb = (p, name) => { const ab = dex.abilities.get(name);
    if (!ab.exists) throw new Error('no ability ' + name);
    p.ability = ab.id; p.abilityState = { id: ab.id, target: p, effectOrder: 0 }; };
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) setAb(p, NEUTRAL_AB);
  src.item = ''; tgt.item = '';

  let critDraws = 0, otherChance = 0;
  battle.random = (n) => (n === 16 ? ROLL_INDEX : 0);
  battle.randomChance = (num, den) => {
    if (num === 1 && den === 24) { const first = (critDraws === 0); critDraws++; return first; }
    otherChance++;
    return true;                       /* every accuracy check succeeds; no crit rides on this branch */
  };

  const move = battle.dex.getActiveMove(row.move);
  /* `willCrit` IS LEFT UNDEFINED ON PURPOSE. Setting it — even to false — takes
   * sim/battle-actions.ts:1638's `move.willCrit || false` branch and the die is never rolled at all,
   * which would make this probe report zero draws for every row and look like agreement. */
  const mark = battle.log.length;
  battle.actions.hitStepMoveHitLoop([tgt], src, move);

  const arrivals = [], crits = [];
  let last = tgt.maxhp, pendingCrit = false;
  for (const line of battle.log.slice(mark)) {
    const f = String(line).split('|');
    if (f[1] === '-crit' && String(f[2]).startsWith('p2a')) { pendingCrit = true; continue; }
    if (f[1] !== '-damage' || !String(f[2]).startsWith('p2a')) continue;
    const parts = String(f[3]).split('/');
    if (parseInt(parts[1], 10) !== tgt.maxhp) continue;   /* drop the |split| percentage copy */
    const hp = parseInt(parts[0], 10);
    arrivals.push(last - hp); crits.push(pendingCrit); last = hp; pendingCrit = false;
  }
  return { critDraws, otherChance, arrivals, crits };
}

/* ---- OURS ---------------------------------------------------------------------------------------
 * A REAL TURN, because the defect is in the battle loop and not in dmgRange. The `crit` stream is
 * counted as it is drawn, and it answers CRIT (0 < 1/24) on draw 0 and NO-CRIT on every draw after
 * — the same die the authority is given above. */
function mediRun(row) {
  const mk = (name, moveName) => {
    const b = MEDI.buildMon(key(name), {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = [dex.moves.get(moveName).id];
    b.item = '';
    b.ability = dex.abilities.get(NEUTRAL_AB).id;
    b.st = flatStats(name);
    b.curHP = b.st.hp;
    return b;
  };
  const A = [mk(row.att, row.move), mk(PAL, inertMove(PAL)), mk(PAL, inertMove(PAL)), mk(PAL, inertMove(PAL))];
  const B = [mk(row.def, inertMove(row.def)), mk(PAL, inertMove(PAL)), mk(PAL, inertMove(PAL)), mk(PAL, inertMove(PAL))];
  B[0].st.hp = B[0].st.hp * HPX; B[0].curHP = B[0].st.hp;
  const trace = [];
  const S = MEDI.battleInit(A, B, { trace });
  let critDraws = 0;
  const critDie = () => { const first = (critDraws === 0); critDraws++; return first ? 0 : 0.999; };
  const u = (2 * (16 - 1 - ROLL_INDEX) + 1) / 32;   /* the position damageRollIndex maps onto ROLL_INDEX */
  const streams = { any: () => 0.5, acc: () => 0, crit: critDie, sec: () => 0.999,
                    dmg: () => u, stall: () => 0.999, tie: () => 0, split: true, seed: null };
  const acts = (own, foes, want) => { const map = new Map();
    own.forEach((mon, i) => { if (!mon) return;
      const w = want[i];
      if (!w) { map.set(mon, { kind: 'pass' }); return; }
      map.set(mon, MEDI.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
    return map; };
  MEDI.battleTurn(S, streams,
    acts(S.actA, S.actB, [{ m: dex.moves.get(row.move).id, t: 0 }, null]),
    acts(S.actB, S.actA, [null, null]));

  const arrivals = [], crits = [];
  let last = B[0].st.hp, pendingCrit = false;
  for (const line of trace) {
    const f = String(line).split('|');
    if (f[1] === '-crit' && String(f[2]).startsWith('p2a')) { pendingCrit = true; continue; }
    if (f[1] !== '-damage' || !String(f[2]).startsWith('p2a')) continue;
    const hp = parseInt(String(f[3]).split('/')[0], 10);
    arrivals.push(last - hp); crits.push(pendingCrit); last = hp; pendingCrit = false;
  }
  return { critDraws, arrivals, crits };
}

/* ------------------------------------------------------------------------------------------------
 * THE FIXTURE. The observed pair is Aerodactyl's Dual Wingbeat, so that row is the one from the
 * artifact; Triple Axel covers the OTHER path through dmgRange (`hitPlanOf().perHitPower`); the
 * control is a single-hit move under identical staging. The 2-5 family is deliberately absent — its
 * count is itself a draw, so the row would be testing two things.
 * ---------------------------------------------------------------------------------------------- */

/* THE CONTROL'S MOVE IS DERIVED, NOT NAMED, AND THE FIRST ATTEMPT AT IT WAS WRONG IN A WAY WORTH
 * KEEPING. Rock Slide was used and the control row FAILED: it is `allAdjacentFoes`, so this engine
 * drew a crit die per TARGET while the authority — handed one target by the direct
 * `hitStepMoveHitLoop` call — drew one. A spread move measures the staging, not the rule, and a
 * probe whose control also parts proves nothing. Every row is now asserted `target: 'normal'`. */
const controlMove = (species) => {
  const ls = dex.species.getLearnsetData(dex.species.get(species).id).learnset || {};
  const c = Object.keys(ls).map(id => dex.moves.get(id)).filter(m =>
    m.exists && !m.isNonstandard && m.target === 'normal' && m.category !== 'Status' &&
    !m.multihit && !m.willCrit && (Number(m.critRatio) || 1) === 1 && m.basePower > 0 &&
    !m.secondaries && !m.self && !m.recoil && !m.drain &&
    /* AND IT MUST LAND THIS TURN. The first derived candidate was Meteor Beam, which CHARGES: the
     * authority's direct `hitStepMoveHitLoop` call skips the charge step and dealt damage, this
     * engine played the real turn and dealt none, and the row failed on arrival COUNT. A control
     * that fails is a control that is measuring the harness. */
    !m.flags.charge && !m.flags.recharge && !m.volatileStatus && !m.status && !m.boosts &&
    !m.sideCondition && !m.forceSwitch && !m.selfSwitch);
  c.sort((a, b) => (b.basePower - a.basePower) || a.name.localeCompare(b.name));
  if (!c.length) throw new Error('no single-target control move on ' + species);
  return c[0].name;
};

const FIX = [
  { label: 'CONTROL single hit    ' + controlMove('Aerodactyl') + '   (the staging, with no volley in it)',
    att: 'Aerodactyl', move: controlMove('Aerodactyl'), def: 'Snorlax', single: true },
  { label: 'THE OBSERVED PAIR     Dual Wingbeat x2  (flat path — the two artifact rows)',
    att: 'Aerodactyl', move: 'Dual Wingbeat', def: 'Snorlax', single: false },
  { label: 'the other dmgRange    Triple Axel x3   (per-hit loop path)',
    att: 'Weavile', move: 'Triple Axel', def: 'Snorlax', single: false },
];

console.log('CRIT PER HIT — the crit die is drawn once per HIT by the authority and once per CLICK here');
console.log('  authority  data/mods/champions/scripts.ts:461 loop -> :361 -> sim/battle-actions.ts:1156 -> :1641');
console.log('  ours       engine/medicham2-browser.js:27602 one _R.crit() -> :27644 one R.crit -> :28199 every arrival');
console.log('  the die BOTH engines are handed: CRIT on draw 0, NO-CRIT on every draw after it');
console.log('');

let red = 0, fixtureFail = 0;

/* §L — LEGALITY AND THE FIXTURE'S OWN PREMISE, DERIVED FROM THE LIVE FORMAT, NEVER TYPED. */
{
  const seen = new Set();
  for (const r of FIX) {
    for (const [sp, mv] of [[r.att, r.move], [r.def, inertMove(r.def)], [PAL, inertMove(PAL)]]) {
      const k = sp + '|' + mv;
      if (seen.has(k)) continue; seen.add(k);
      const v = CS.checkLegal({ species: sp, moves: [mv], item: '' });
      if (!v.legal) { fixtureFail++; console.log('  FAIL not legal in ' + CS.FORMAT + ': ' + k + ' — ' + (v.problems || []).join('; ')); }
    }
    const m = dex.moves.get(r.move);
    if (!!r.single === !!m.multihit) {
      fixtureFail++;
      console.log('  FAIL fixture premise: ' + r.move + ' multihit=' + JSON.stringify(m.multihit)
                  + ' but the row is marked ' + (r.single ? 'single-hit' : 'multi-hit'));
    }
    /* A move that always crits, or one the format gives a raised ratio, would answer a different
     * question. Both are read off the format rather than assumed. */
    if (m.willCrit) { fixtureFail++; console.log('  FAIL fixture premise: ' + r.move + ' has willCrit — it cannot roll'); }
    if ((Number(m.critRatio) || 1) !== 1) {
      fixtureFail++;
      console.log('  FAIL fixture premise: ' + r.move + ' critRatio=' + m.critRatio + ', not the 1/24 branch');
    }
    /* SINGLE TARGET, ASSERTED. A spread move draws one crit per TARGET here and one in total in the
     * direct hit-loop call below, which is a staging difference wearing the finding's clothes. */
    if (m.target !== 'normal') {
      fixtureFail++;
      console.log('  FAIL fixture premise: ' + r.move + ' target=' + m.target + ', not single-target');
    }
    console.log('  fixture  ' + r.move.padEnd(14) + ' multihit=' + JSON.stringify(m.multihit || null)
                + '  critRatio=' + (Number(m.critRatio) || 1) + '  target=' + m.target
                + '  accuracy=' + m.accuracy);
  }
}
if (fixtureFail) { console.log(''); console.log('  ' + fixtureFail + ' FIXTURE FAILURES — nothing below is evidence.'); process.exit(1); }
console.log('');

for (const r of FIX) {
  const sd = sdRun(r), me = mediRun(r);
  const expect = sd.arrivals.length;      /* the authority decides how many arrivals there are */
  const fmt = (o) => '[' + o.arrivals.map((d, i) => d + (o.crits[i] ? '*' : '')).join(' ') + ']';
  console.log('  ' + r.label);
  console.log('      arrivals (a * marks a crit)   authority ' + fmt(sd).padEnd(20) + '  ours ' + fmt(me));
  console.log('      crit-die draws for the click  authority ' + String(sd.critDraws).padEnd(20) + '  ours ' + me.critDraws);

  if (sd.arrivals.length !== me.arrivals.length) {
    red++; console.log('      FAIL different arrival COUNT — this row cannot speak about the crit');
    continue;
  }
  /* THE COUNT. The knob is the hit count; a per-hit die moves with it and a per-click die does not. */
  if (sd.critDraws !== expect) {
    red++; console.log('      FAIL the AUTHORITY drew ' + sd.critDraws + ' crit dice for ' + expect
                       + ' arrivals — the interception is wrong, not the engine');
  }
  if (me.critDraws !== sd.critDraws) {
    red++; console.log('      FAIL crit-die draws differ: authority ' + sd.critDraws + ', ours ' + me.critDraws);
  }
  /* THE OUTCOME. Asserted separately, so the row cannot pass by counting draws it then ignores. */
  for (let i = 0; i < expect; i++) {
    if (sd.crits[i] !== me.crits[i]) {
      red++; console.log('      FAIL arrival ' + (i + 1) + ' crit: authority ' + sd.crits[i] + ', ours ' + me.crits[i]);
    }
    if (sd.arrivals[i] !== me.arrivals[i]) {
      red++; console.log('      FAIL arrival ' + (i + 1) + ' damage: authority ' + sd.arrivals[i] + ', ours ' + me.arrivals[i]);
    }
  }
  console.log('');
}

console.log(red ? '  ' + red + ' FAILURES' : '  all rows agree');
process.exit(red ? 1 : 0);
