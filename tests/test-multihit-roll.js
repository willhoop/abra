/* test-multihit-roll.js — ONE DAMAGE INDEX PER HIT, NOT ONE PER VOLLEY.
 *
 *   SHOWDOWN_PATH=... node tests/test-multihit-roll.js
 *
 * ================= WHAT THIS ASKS, AND WHY test-damage-roll-support.js CANNOT ====================
 *
 * `sim/battle.ts:2388-2391` is the whole of the authority's damage die:
 *
 *     randomizer(baseDamage) { const tr = this.trunc; return tr(tr(baseDamage * (100 - this.random(16))) / 100); }
 *
 * ROADMAP #304 converted THE SINGLE-HIT PATH to that scheme and `tests/test-damage-roll-support.js`
 * pins it — index for index, over nine staged rows. That file declares multi-hit OUT OF SCOPE in its
 * own header and asserts no row of its fixture is multi-hit, so the residue was left uncovered BY
 * CONSTRUCTION rather than by oversight:
 *
 *     "MULTI-HIT. Showdown draws a randomizer PER HIT; this engine spends one index across a summed
 *      range. That is a declared divergence of `dmgRange`'s own header and a different defect."
 *
 * `sim/battle-actions.ts:888` (`hitStepMoveHitLoop`) runs `spreadMoveHit` once per HIT, and
 * `getDamage` — and therefore `randomizer` — runs inside each pass. So the authority takes N
 * independent draws for an N-hit volley. medicham2 took ONE and spread it across the packets
 * greedily, saturating the first arrival before giving anything to the second.
 *
 * ================= THE CONTRADICTION THAT MADE THIS A PROOF RATHER THAN A SUSPICION =============
 *
 * Twin Beam is the clean case: BOTH HITS ARE 40 BP, so the base is identical for both, and one index
 * applied to one base can only give one number twice. Card 38 of the 2026-08-22 review:
 *
 *     SHOWDOWN : 185 -> 130 -> 75    hits of 55, 55
 *     MEDICHAM : 185 -> 125 -> 75    hits of 60, 50
 *
 * No single base produces both 60 and 50 under that scheme — 60 needs `B >= 60`, 50 needs
 * `trunc(B*0.85) <= 50` i.e. `B < 60`.
 *
 * ================= WHY NO EXISTING INSTRUMENT COULD SEE IT ======================================
 *
 * THE TOTAL IS RIGHT AND ONLY THE SPLIT IS WRONG. `_band[i]` for the flat multi-hit path is
 * `floor(v_i * n)` with `v_i` an integer, so the summed number the volley deals is EXACTLY the
 * authority's — measured below and printed as §3, which passes both before and after the fix. Every
 * comparator that reads HP after the turn, and every board feature, agrees. That is Will's "it evens
 * out": a shared index is unbiased about the same total, so only the ARRIVALS scatter.
 *
 * AND BOTH PINNED CORNERS ARE BLIND TOO. At `top-tie-first` (damageIndex 0) every packet saturates;
 * at `bottom-tie-first` (damageIndex 15) every packet is its minimum. In both the greedy split and
 * the per-hit draw give the same answer, so the whole-game differential's two corner arms CANNOT
 * fail on this. Only the interior — the middle arm, and every real game anyone plays — differs.
 *
 * ================= THE CLAUSES, CONTROL FIRST ===================================================
 *
 *   §L LEGALITY   every species/move pair put to the official TeamValidator. Nothing typed.
 *   §0 CONTROL    (a) a SINGLE-HIT row must agree at all sixteen indices. It clears the staging and
 *                     the u->index mapping: if the mapping were wrong, this row would fail too, and
 *                     a multi-hit failure beside a passing single-hit row cannot be the mapping.
 *                 (b) for a CONSTANT-BASE-POWER volley, THE AUTHORITY'S OWN per-hit numbers must be
 *                     equal within an index. That is derived from the authority on this run, not
 *                     asserted from the header above — if Showdown ever stopped doing it, §2 would
 *                     be testing something else and this says so.
 *   §1 SUPPORT    the SET of per-arrival damage values medicham2 can emit equals the set the
 *                 authority can emit. Swept at 512 die positions so this engine's own span width is
 *                 never assumed.
 *   §2 PAIRED     arrival for arrival, at each of the sixteen indices. This is the clause the defect
 *                 lives in.
 *   §3 TOTAL      the summed damage agrees. PRINTED, and it passes on the broken engine too — it is
 *                 here to show what every existing instrument was reading.
 *   §C COUNTERS   at EXACT equality, and the noun is named at the assertion.
 *   §B BROKEN ARM re-runs this file with MEDI_MULTIHIT_ONE_INDEX=1 and FAILS IF IT PASSES.
 *
 * THE MAPPING IS NOT RE-TYPED FROM `game_differential.js`. Requiring that module loads the store and
 * cuts a release; this file instead uses the position `(15 - i + 0.5)/16` and PROVES it on the
 * single-hit control row against the authority, which is the same claim arrived at from the other
 * side. A wrong mapping cannot pass §0(a).
 *
 * THE DIE IS ISOLATED BY STREAM. `rngStreams` takes a struct, so `dmg` is swept while `crit`, `acc`,
 * `sec` and `stall` are held where they cannot fire — the same isolation test-damage-roll-support.js
 * records as necessary, because a single swept scalar silently crits at the bottom of its range.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
const NL = String.fromCharCode(10);

if (!process.env.SHOWDOWN_PATH) {
  console.log('MULTI-HIT DAMAGE ROLL');
  console.log('  FAIL SHOWDOWN_PATH is not set, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const SIDES = 16;
/* THE POSITION THE ENGINE'S OWN `damageRollIndex` MAPS ONTO INDEX i. Not imported and not asserted
 * here — §0(a) proves it against the authority on a single-hit row before anything else runs. */
const posFor = (i) => (SIDES - 1 - i + 0.5) / SIDES;

/* ---- STAGING: flat level-50 bodies in BOTH engines ---------------------------------------------- */
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function flatStats(name) {
  const bs = dex.species.get(name).baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}
const key = (name) => dex.species.get(name).id;
const inertMove = (species) => CS.firstLegalMove(species) || CS.INERT_MOVE;
/* The neutral ability goes on EVERY body on both sides, so no body's own ability is the control for
 * its own row — the compare-a-Scarf-against-a-Scarf failure. */
const NEUTRAL_AB = 'Illuminate';
/* The defender cannot faint and cannot fall into a pinch: a KO clamps the last arrival and a berry
 * would move HP between two arrivals, and either turns an arrival comparison into a fiction. */
const HPX = 40;
const PAL = 'Ditto';

function mkSet(name, move) {
  return { name, species: name, item: '', ability: dex.species.get(name).abilities[0],
           moves: [move], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}

/* ---- THE AUTHORITY: the real hit loop, one pinned index, arrival by arrival --------------------- */
function sdArrivals(row, rollIndex) {
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
  /* THE ONLY DIE THIS ROW MAY SPEND IS THE DAMAGE ONE. `randomChance(a,b)` is `random(b) < a`, so 0
   * makes every accuracy check (including Triple Axel's per-hit `multiaccuracy` one) succeed and
   * every fixed count stay fixed. `random(16)` is the randomizer and only the randomizer. */
  battle.random = (n) => (n === 16 ? rollIndex : 0);
  const move = battle.dex.getActiveMove(row.move);
  move.willCrit = !!battle.dex.moves.get(row.move).willCrit;
  const mark = battle.log.length;
  battle.actions.hitStepMoveHitLoop([tgt], src, move);
  /* ONE ARRIVAL PER `-damage`, AND THE `|split|` PUBLIC COPY IS DROPPED BY ITS DENOMINATOR. Showdown
   * emits the omniscient line and then a percentage copy for the other side; the copy reads `99/100`
   * and the real one reads `x/maxhp`, so the denominator is the discriminator and no line ordering
   * is assumed. */
  const out = [];
  let last = tgt.maxhp;
  for (const line of battle.log.slice(mark)) {
    const f = line.split('|');
    if (f[1] !== '-damage' || !String(f[2]).startsWith('p2a')) continue;
    const parts = String(f[3]).split('/');
    if (parseInt(parts[1], 10) !== tgt.maxhp) continue;
    const hp = parseInt(parts[0], 10);
    out.push(last - hp); last = hp;
  }
  return out;
}

/* ---- OURS: a REAL TURN, because the defect lives in the battle loop and not in dmgRange ---------- */
function mediArrivals(row, u) {
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
  const streams = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
                    dmg: () => u, stall: () => 0.999, split: true, seed: null };
  const acts = (own, foes, want) => { const map = new Map();
    own.forEach((mon, i) => { if (!mon) return;
      const w = want[i];
      if (!w) { map.set(mon, { kind: 'pass' }); return; }
      map.set(mon, MEDI.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
    return map; };
  MEDI.battleTurn(S, streams,
    acts(S.actA, S.actB, [{ m: dex.moves.get(row.move).id, t: 0 }, null]),
    acts(S.actB, S.actA, [null, null]));
  const out = [];
  let last = B[0].st.hp;
  for (const line of trace) {
    const f = String(line).split('|');
    if (f[1] !== '-damage' || !String(f[2]).startsWith('p2a')) continue;
    const hp = parseInt(String(f[3]).split('/')[0], 10);
    out.push(last - hp); last = hp;
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * THE FIXTURE. Every move is derived multi-hit from the format's own `multihit` field (asserted
 * below), and the two PATHS through `dmgRange` are both covered on purpose:
 *   - the FLAT path — a constant base power priced once and multiplied (Twin Beam, Dual Wingbeat,
 *     Double Hit). This is where the arithmetic contradiction lives.
 *   - the PER-HIT LOOP — `hitPlanOf().perHitPower`, entered only when base power is a function of
 *     the hit index. Triple Axel is the only legal member with a fixed count.
 * The 2-5 family (Bullet Seed etc.) is deliberately absent: its count is itself a draw, so a row
 * would be testing the count and the roll at once.
 * ---------------------------------------------------------------------------------------------- */
const FIX = [
  { label: 'CONTROL single hit         Psychic (clears the staging and the u->index mapping)',
    att: 'Farigiraf', move: 'Psychic', def: 'Snorlax', single: true },
  { label: 'flat, special, 40 BP x2    Twin Beam — both hits share one base',
    att: 'Farigiraf', move: 'Twin Beam', def: 'Snorlax', constantBase: true },
  { label: 'flat, physical, 40 BP x2   Dual Wingbeat — the physical twin',
    att: 'Corviknight', move: 'Dual Wingbeat', def: 'Snorlax', constantBase: true },
  { label: 'flat, physical, 35 BP x2   Double Hit',
    att: 'Dragapult', move: 'Double Hit', def: 'Snorlax', constantBase: true },
  { label: 'per-hit loop, 20/40/60 x3  Triple Axel — escalating base, the OTHER path in dmgRange',
    att: 'Weavile', move: 'Triple Axel', def: 'Snorlax', constantBase: false },
];

const BROKEN_ARM = process.env.MEDI_MULTIHIT_ONE_INDEX === '1';
console.log('MULTI-HIT DAMAGE ROLL — one index per HIT, not one per volley'
  + (BROKEN_ARM ? '   *** MEDI_MULTIHIT_ONE_INDEX=1: the shared-index split is RESTORED, this arm is EXPECTED to fail ***' : ''));
console.log('  sim/battle-actions.ts:888 runs spreadMoveHit once per hit; randomizer runs inside each pass');
console.log('');

let fixtureFail = 0, red = 0, rows = 0;
const uniq = a => [...new Set(a)].sort((x, y) => x - y);

/* §L — LEGALITY, DERIVED. Species, move and the learnset link, all from the live format. */
{
  let bad = 0;
  const seen = new Set();
  for (const r of FIX) {
    for (const [sp, mv] of [[r.att, r.move], [r.def, inertMove(r.def)], [PAL, inertMove(PAL)]]) {
      const k = sp + '|' + mv;
      if (seen.has(k)) continue; seen.add(k);
      const v = CS.checkLegal({ species: sp, moves: [mv], item: '' });
      if (!v.legal) { bad++; console.log('  FAIL not legal in ' + CS.FORMAT + ': ' + k + ' — ' + (v.problems || []).join('; ')); }
    }
    /* THE FIXTURE'S OWN PREMISE, DERIVED RATHER THAN LABELLED: a row marked multi-hit must carry a
     * `multihit` in the format's data, and the single-hit control must not. A mislabelled row would
     * make §2 pass by testing nothing. */
    const mh = dex.moves.get(r.move).multihit;
    if (!!r.single === !!mh) {
      bad++;
      console.log('  FAIL fixture premise: ' + r.move + ' multihit=' + JSON.stringify(mh) + ' but the row is marked '
                  + (r.single ? 'single-hit' : 'multi-hit'));
    }
    if (Array.isArray(mh)) { bad++; console.log('  FAIL fixture premise: ' + r.move + ' has a ROLLED hit count ' + JSON.stringify(mh)
                                                + ' — the count would be a second die in the row'); }
  }
  console.log('  §L legality — ' + seen.size + ' species/move pairs put to the official TeamValidator: '
              + (bad ? bad + ' REJECTED' : 'all accepted') + '; every hit count read from the format');
  fixtureFail += bad;
}
console.log('');

for (const row of FIX) {
  rows++;
  let sd, me16, meSweep;
  try {
    sd = [];
    for (let i = 0; i < SIDES; i++) sd.push(sdArrivals(row, i));
    me16 = [];
    for (let i = 0; i < SIDES; i++) me16.push(mediArrivals(row, posFor(i)));
    meSweep = [];
    for (let k = 0; k < 512; k++) meSweep.push(mediArrivals(row, (k + 0.5) / 512));
  } catch (e) {
    fixtureFail++;
    console.log('  FIXTURE ' + row.label + NL + '    THREW ' + e.message);
    continue;
  }

  const nSD = sd[0].length;
  console.log('  ' + row.label);

  /* §0 CONTROL — the fixture is comparable at all, and it is checked before anything is called a
   * defect. Arrival COUNT first: two engines that disagree about how many arrivals there were are
   * not disagreeing about a roll. */
  let staging = 0;
  if (!nSD) { staging++; console.log('    FIXTURE NOT COMPARABLE — the authority produced no arrival at all'); }
  if (sd.some(a => a.length !== nSD)) { staging++; console.log('    FIXTURE NOT COMPARABLE — the authority\'s arrival COUNT varies across indices'); }
  const meCounts = uniq(meSweep.map(a => a.length));
  if (meCounts.length !== 1 || meCounts[0] !== nSD) {
    staging++;
    console.log('    FIXTURE NOT COMPARABLE — arrivals sd=' + nSD + ' me=' + meCounts.join('/')
                + ' (a hit-COUNT disagreement, which is a different defect from a roll)');
  }
  const sdTot = sd.map(a => a.reduce((x, y) => x + y, 0));
  if (uniq(sdTot).length < 2) { staging++; console.log('    FIXTURE NOT COMPARABLE — the authority deals the same total at every index; nothing varies'); }
  /* §0(b) — the CONSTANT-BASE premise, taken from the authority on this run. */
  if (row.constantBase) {
    const uneven = [];
    for (let i = 0; i < SIDES; i++) if (uniq(sd[i]).length !== 1) uneven.push(i + ': [' + sd[i].join(',') + ']');
    if (uneven.length) {
      staging++;
      console.log('    FIXTURE NOT COMPARABLE — the authority\'s arrivals are NOT equal within an index at '
                  + uneven.slice(0, 4).join(' | ') + ' — the constant-base premise does not hold for ' + row.move);
    } else {
      console.log('    §0 premise  the authority deals EQUAL arrivals within every index (one base, one index, one number)');
    }
  }
  if (staging) { fixtureFail += staging; console.log(''); continue; }

  const flat = a => a.map(x => x);
  const sdVals = uniq([].concat(...sd));
  const meVals = uniq([].concat(...meSweep.map(flat)));
  const meOnly = meVals.filter(v => !sdVals.includes(v));
  const sdOnly = sdVals.filter(v => !meVals.includes(v));

  console.log('    ' + nSD + ' arrival(s) per volley;  showdown per-arrival values [' + sdVals.join(',')
            + ']   medicham [' + meVals.join(',') + ']');

  let bad = 0;
  /* §1 SUPPORT — per ARRIVAL, not per total. */
  if (meOnly.length || sdOnly.length) {
    bad++;
    console.log('    §1 SUPPORT   FAIL  ' + meOnly.length + ' arrival value(s) only this engine can emit ['
                + meOnly.slice(0, 8).join(',') + ']'
                + (sdOnly.length ? ', ' + sdOnly.length + ' only the authority can [' + sdOnly.slice(0, 8).join(',') + ']' : ''));
  } else {
    console.log('    §1 SUPPORT   ok    the two engines emit exactly the same ' + sdVals.length + ' arrival values');
  }

  /* §2 PAIRED — arrival for arrival, index for index. */
  const mism = [];
  for (let i = 0; i < SIDES; i++) {
    if (sd[i].join(',') !== me16[i].join(',')) mism.push(i + ': sd [' + sd[i].join(',') + '] me [' + me16[i].join(',') + ']');
  }
  if (mism.length) {
    bad++;
    console.log('    §2 PAIRED    FAIL  ' + mism.length + ' of ' + SIDES + ' indices split the volley differently — '
                + mism.slice(0, 4).join(' | ') + (mism.length > 4 ? ' | …' : ''));
  } else {
    console.log('    §2 PAIRED    ok    all ' + SIDES + ' indices agree, arrival for arrival');
  }

  /* §3 TOTAL — printed, not a gate on its own. It is what every existing instrument reads. */
  const totBad = [];
  for (let i = 0; i < SIDES; i++) {
    const a = sd[i].reduce((x, y) => x + y, 0), b = me16[i].reduce((x, y) => x + y, 0);
    if (a !== b) totBad.push(i + ': sd ' + a + ' me ' + b);
  }
  if (totBad.length) { bad++; console.log('    §3 TOTAL     FAIL  ' + totBad.length + ' of ' + SIDES + ' totals disagree — ' + totBad.slice(0, 4).join(' | ')); }
  else console.log('    §3 TOTAL     ok    every index deals the same SUMMED damage'
                   + (nSD > 1 ? '  <- the reason nothing caught the split' : ''));

  if (bad) red++;
  console.log('');
}

console.log('  ' + rows + ' rows, ' + fixtureFail + ' not comparable, ' + red + ' with a disagreeing engine');

/* ---- §C THE COUNTERS, AND THE NOUN EACH ONE COUNTS ---------------------------------------------
 *
 * `perArrivalDamageIndex` counts ARRIVALS whose damage number was read off THEIR OWN sixteen-entry
 * band at THEIR OWN drawn index. NOT volleys, NOT draws, NOT multi-hit moves. A draw counter cannot
 * see this defect at all — the broken engine draws once and the fixed engine draws N times, but a
 * count of DRAWS would also rise if the loop simply drew twice and threw one away. What is being
 * asserted is that each arrival was ADDRESSED individually, so the noun has to be the arrival.
 *
 * It is asserted at EXACT equality against a number derived from the fixture — sum over multi-hit
 * rows of (arrivals per volley x indices swept) — never `>= 1`, because a `>= 1` bar is passed by an
 * engine that addresses the first arrival and splits the rest, which is most of the defect.
 *
 * `packetBandMissing` counts ARRIVALS that had no sixteen-entry band and fell back to the greedy
 * split. It is the loud fallback: a silent default here looks exactly like the fix working.
 */
const SEEN = MEDI.MEDSEEN || (globalThis.MEDSEEN || {});
const FAILS = MEDI.MEDFAILS || (globalThis.MEDFAILS || {});
let counterBad = 0;
console.log('');
if (!BROKEN_ARM && !fixtureFail) {
  /* THE EXPECTED COUNT, DERIVED FROM WHAT WAS ACTUALLY STAGED. 512 sweep positions + 16 paired
   * positions per row, times the arrivals per volley, summed over the multi-hit rows only. */
  let want = 0;
  for (const row of FIX) {
    if (row.single) continue;
    const n = dex.moves.get(row.move).multihit;
    want += (512 + SIDES) * (typeof n === 'number' ? n : 0);
  }
  const got = SEEN.perArrivalDamageIndex || 0;
  if (got !== want) {
    counterBad++;
    console.log('  §C FAIL  perArrivalDamageIndex — ARRIVALS that read their own band at their own index — '
                + 'want exactly ' + want + ', got ' + got
                + (got === 0 ? '   (ZERO: the per-arrival draw never ran and every green line above is a coincidence)' : ''));
  } else {
    console.log('  §C ok    perArrivalDamageIndex = ' + got + ' (exact) — every staged arrival was addressed on its own');
  }
  const miss = FAILS.packetBandMissing || 0;
  if (miss) {
    counterBad++;
    console.log('  §C FAIL  packetBandMissing = ' + miss + ' arrival(s) had no band and took the greedy fallback, first on '
                + (FAILS.packetBandMissingFirst || '?'));
  } else {
    console.log('  §C ok    packetBandMissing = 0 — no arrival fell back to the shared-index split');
  }
} else if (BROKEN_ARM) {
  console.log('  §C restore arm: perArrivalDamageIndex=' + (SEEN.perArrivalDamageIndex || 0)
              + ', MEDFAILS.multiHitOneIndexRestored=' + (FAILS.multiHitOneIndexRestored || 0));
  if (!FAILS.multiHitOneIndexRestored) {
    counterBad++;
    console.log('  §C FAIL  MEDI_MULTIHIT_ONE_INDEX=1 did not stamp its failure counter — a restore arm that cannot be told from a clean run');
  }
}

if (fixtureFail) { console.log(NL + '  FAIL — the fixture could not be staged. Fix the fixture before reading the engine.'); process.exit(2); }
if (red || counterBad) { console.log(NL + '  FAIL — medicham2 does not draw the authority\'s damage index once per hit.'); process.exit(1); }

/* §B — THE DELIBERATE BREAK MUST BREAK. */
if (!BROKEN_ARM) {
  console.log(NL + '  §B THE BROKEN ARM MUST BREAK  (re-running with MEDI_MULTIHIT_ONE_INDEX=1)');
  const { spawnSync } = require('child_process');
  const child = spawnSync(process.execPath, [__filename],
    { encoding: 'utf8', cwd: D('.'), env: Object.assign({}, process.env, { MEDI_MULTIHIT_ONE_INDEX: '1' }) });
  const out = String(child.stdout || '') + String(child.stderr || '');
  const failed = (out.match(/FAIL/g) || []).length;
  if (child.status === 0 || !failed) {
    console.log('    FAIL the restored shared-index split did not break this file (exit ' + child.status + ') — every green line above is unproven');
    console.log(out.split(NL).slice(-14).join(NL));
    process.exit(1);
  }
  console.log('    ok  with the shared-index split restored this file FAILS (' + failed + ' FAIL line(s), exit ' + child.status + ')');
}

console.log(NL + '  PASS — every staged arrival carries the authority\'s own index, arrival for arrival.');
