/* THE DAMAGE ROLL IS AN INDEX INTO SIXTEEN, NOT A POSITION IN A SPAN — ROADMAP #304
 *
 *   SHOWDOWN_PATH=... node tests/test-damage-roll-support.js
 *
 * WHAT IT ASKS, AND WHY NO EXISTING INSTRUMENT COULD ASK IT
 * --------------------------------------------------------
 * `sim/battle.ts:2390` is the whole of the authority's damage die:
 *
 *     randomizer(baseDamage) { const tr = this.trunc; return tr(tr(baseDamage * (100 - this.random(16))) / 100); }
 *
 * `random(16)` is an INDEX i in 0..15 and the percentage is `100 - i`, so the authority can emit AT
 * MOST 16 damage numbers for one staged hit — and usually fewer, because everything after the
 * randomizer (STAB through `modify`, the type chart's `*2` / `tr(/2)`, burn, the `ModifyDamage`
 * chain) is applied to an already-truncated integer, and two neighbouring indices that truncated to
 * the same number stay equal for ever afterwards.
 *
 * medicham2 does not select an index. It draws a POSITION in the span:
 *
 *     const _roll = Math.floor(_R.dmg() * (d.max - d.min + 1));   let dmg = d.min + _roll;
 *
 * — every integer between the minimum and the maximum, each with probability 1/W. When W > 16 that
 * is MORE positions than the band contains, so the engine emits HP values the authority cannot
 * produce at all; when W < 16 it flattens a distribution that is not flat.
 *
 * EVERY CORNER INSTRUMENT IS BLIND TO THIS BY CONSTRUCTION. `tests/test-engine-diff.js` compares
 * index 0 against `d.max` and index 15 against `d.min`, and those are exactly the two points where
 * the two conventions must agree — `rolls[0]` IS `roll(100)` IS `d.max` and `rolls[15]` IS `roll(85)`
 * IS `d.min`. It reads 0 of 6000 at each corner while the interior is wrong, and both facts are true.
 *
 * THE THREE CLAUSES, AND THE CONTROL COMES FIRST
 * ----------------------------------------------
 *   §0 CONTROL — the fixture is comparable at all: the authority's span is not a single point (a row
 *      where nothing varies proves nothing about a roll), and the two engines AGREE AT BOTH
 *      ENDPOINTS. A row whose endpoints disagree is a STAGING failure — some multiplier is on in one
 *      engine and not the other — and it is reported as a fixture defect, never as an engine one.
 *   §1 SUPPORT — the set of HP values medicham2's battle loop can emit equals the set the authority
 *      can emit. Swept at 512 positions, which covers any span this fixture can produce, so the
 *      sweep does not assume the engine's own width.
 *   §2 PAIRED — for each index i, medicham2 driven at the die position the differential's middle arm
 *      maps to i emits EXACTLY the authority's value at i. This is the clause the whole-game
 *      differential's shared die actually needs; §1 can pass on a lucky permutation and §2 cannot.
 *
 * THE POSITION->INDEX MAPPING IS NOT TYPED HERE. It is read from `engine/game_differential.js`'s
 * exported `midDamageIndex`, which ROADMAP #303 derived from the pinned arms' own declarations
 * (`CORNER_TOP` beside `damageIndex: 0`, `CORNER_BOTTOM` beside `damageIndex: 15`). Two files that
 * each typed the mapping would disagree eventually and neither would be wrong on its own.
 *
 * WHAT IT DELIBERATELY DOES NOT COVER, STATED RATHER THAN DISCOVERED
 * -----------------------------------------------------------------
 * MULTI-HIT. Showdown draws a randomizer PER HIT; this engine spends one index across a summed
 * range. That is a declared divergence of `dmgRange`'s own header and a different defect from this
 * one — a fixture row for it would fail for a reason this file cannot fix, which is how a gate
 * becomes something people learn to ignore. No row in the fixture is multi-hit and the file asserts
 * that rather than trusting it.
 *
 * THE DIE IS ISOLATED BY STREAM, NOT BY LUCK. `rngStreams` accepts a struct, so `dmg` is swept while
 * `crit`, `acc`, `sec` and `stall` are held at values that cannot fire. Sweeping a single scalar was
 * tried first inside `game_differential.js`'s `damageInterior` and its own comment records why it was
 * abandoned: the bottom of the sweep silently CRITS, because the same scalar answers `rng() < 1/24`.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('DAMAGE ROLL SUPPORT — ROADMAP #304');
  console.log('  FAIL SHOWDOWN_PATH is not set, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const MC = globalThis.MC;
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* THE MAPPING, READ FROM THE INSTRUMENT THAT OWNS IT. Requiring the differential is genuinely
 * expensive — it loads the store and builds the team-pool cache before it hands over one function —
 * and it is still the honest source, because the alternative is a THIRD copy of `15 - floor(u*16)`
 * (medicham2 has one, game_differential has one, and two of the three would eventually disagree). The
 * cost is paid twice, since this file re-runs itself against the restored defect. */
const GD = require(D('engine', 'game_differential.js'));
const SIDES = GD.DAMAGE_ROLL_SIDES;
const midDamageIndex = GD.midDamageIndex;
if (typeof midDamageIndex !== 'function' || SIDES !== 16) {
  console.log('  FAIL game_differential.js no longer exports the roll mapping this file reads.');
  process.exit(2);
}

/* ------------------------------------------------------------------------------------------------
 * THE STAGING. Flat level-50 bodies — 0 EVs, 31 IVs, Serious — in BOTH engines, so the comparison is
 * of arithmetic and not of two different stat lines. Copied in shape from tests/test-damage-stages.js,
 * whose header records why every one of these lines is there.
 * ---------------------------------------------------------------------------------------------- */
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function flatStats(name) {
  const bs = dex.species.get(name).baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}
const key = (name) => dex.species.get(name).id;
const inertMove = (species) => CS.firstLegalMove(species) || CS.INERT_MOVE;
/* THE NEUTRAL ABILITY, on every body on both sides. Leaving one at the species default makes the
 * body's own ability the control for its own row — the compare-a-Scarf-against-a-Scarf failure. */
const NEUTRAL_AB = 'Illuminate';
const HPX = 40;   /* the defender cannot faint: Showdown reports HP LOST, so a KO clamps the number */

function mkSet(name, move, item) {
  return { name, species: name, item: item || '', ability: dex.species.get(name).abilities[0],
           moves: [move], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}

/* ---- THE AUTHORITY: one hit, one index, exactly ------------------------------------------------- */
function showdownDamage(row, rollIndex) {
  const teamA = [mkSet(row.att, row.move, row.attItem), mkSet(row.pal, inertMove(row.pal), ''),
                 mkSet(row.benchA, inertMove(row.benchA), ''), mkSet(row.benchB, inertMove(row.benchB), '')];
  const teamB = [mkSet(row.def, inertMove(row.def), row.defItem), mkSet(row.pal, inertMove(row.pal), ''),
                 mkSet(row.benchA, inertMove(row.benchA), ''), mkSet(row.benchB, inertMove(row.benchB), '')];
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
  src.item = row.attItem ? dex.items.get(row.attItem).id : '';
  tgt.item = row.defItem ? dex.items.get(row.defItem).id : '';
  battle.random = (n) => (n === 16 ? rollIndex : 0);
  const move = battle.dex.getActiveMove(row.move);
  move.willCrit = !!battle.dex.moves.get(row.move).willCrit;
  move.hit = 1;
  if (row.spread) move.spreadHit = true;          /* STAGED BY HAND — moveHit is below spreadMoveHit */
  const before = tgt.hp;
  battle.actions.moveHit(tgt, src, move);
  return before - tgt.hp;
}

/* ---- OURS: the BATTLE LOOP, which is where the defect lives ------------------------------------
 * `dmgRange` is NOT the subject. It already hands back all sixteen rolls in the authority's own index
 * order and tests/test-damage-stages.js compares them exactly. What nothing checked is which of them
 * the loop at medicham2-browser.js:18336 actually SPENDS. So this drives a real turn. */
function mediBodies(row) {
  const mk = (name, moveName, item) => {
    const b = MEDI.buildMon(key(name), {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = [dex.moves.get(moveName).id];
    b.item = item ? dex.items.get(item).id : '';
    b.ability = dex.abilities.get(NEUTRAL_AB).id;
    b.st = flatStats(name);
    b.curHP = b.st.hp;
    return b;
  };
  const A = [mk(row.att, row.move, row.attItem), mk(row.pal, inertMove(row.pal), ''),
             mk(row.benchA, inertMove(row.benchA), ''), mk(row.benchB, inertMove(row.benchB), '')];
  const B = [mk(row.def, inertMove(row.def), row.defItem), mk(row.pal, inertMove(row.pal), ''),
             mk(row.benchA, inertMove(row.benchA), ''), mk(row.benchB, inertMove(row.benchB), '')];
  B[0].st.hp = B[0].st.hp * HPX; B[0].curHP = B[0].st.hp;
  return { A, B };
}
/* THE OTHER FOUR STREAMS ARE HELD WHERE THEY CANNOT FIRE, and each value is chosen against the
 * comparison the engine makes rather than by taste: `acc` is compared `< chance` so 0 always hits,
 * `crit` is compared `< critChance` so 0.999 never crits (no move in this format has a rolled rate
 * above 1/2), `sec` likewise, `stall` decides a shield nobody raises here. */
function mediDamage(row, u) {
  const { A, B } = mediBodies(row);
  const S = MEDI.battleInit(A, B, {});
  const before = S.actB[0].curHP;
  const streams = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
                    dmg: () => u, stall: () => 0.999, split: true, seed: null };
  const mk = (own, foes, acts) => { const map = new Map();
    own.forEach((mon, i) => { if (!mon) return;
      const w = acts[i];
      if (!w) { map.set(mon, { kind: 'pass' }); return; }
      map.set(mon, MEDI.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
    return map; };
  MEDI.battleTurn(S, streams,
    mk(S.actA, S.actB, [{ m: dex.moves.get(row.move).id, t: 0 }, null]),
    mk(S.actB, S.actA, [null, null]));
  return before - S.actB[0].curHP;
}

/* ------------------------------------------------------------------------------------------------
 * THE FIXTURE — widened deliberately, because one staged hit is one attacker, one defender and one
 * move, and a shape that only appears in one configuration needs re-scoping rather than fixing.
 * Two categories, a resist, a 4x, an item that lands AFTER the randomizer, a spread hit, and base
 * powers from 40 to 120 so both a narrow and a wide span are covered.
 *
 * EVERY ROW IS PUT TO THE OFFICIAL TeamValidator BEFORE IT RUNS (§L below) — species, move and item.
 * The abilities are overridden by the harness after validation and are therefore not claimed legal.
 * ---------------------------------------------------------------------------------------------- */
const PAL = 'Ditto', B1 = 'Ditto', B2 = 'Ditto';
const FIX = [
  { label: 'physical, item-boosted BP   Knock Off into a body holding an item',
    att: 'Weavile', move: 'Knock Off', def: 'Snorlax', defItem: 'Leftovers' },
  { label: 'physical, 120 BP, neutral   Close Combat',
    att: 'Incineroar', move: 'Close Combat', def: 'Garchomp' },
  { label: 'special, 90 BP, 4x          Ice Beam into Dragon/Ground',
    att: 'Milotic', move: 'Ice Beam', def: 'Garchomp' },
  { label: 'special, 95 BP, neutral     Moonblast',
    att: 'Clefable', move: 'Moonblast', def: 'Snorlax' },
  { label: 'physical, 40 BP, 4x         Ice Shard — the narrow span',
    att: 'Weavile', move: 'Ice Shard', def: 'Garchomp' },
  { label: 'physical, 120 BP, RESISTED  Brave Bird into Steel/Dragon',
    att: 'Corviknight', move: 'Brave Bird', def: 'Archaludon' },
  { label: 'special, 80 BP, SE + ITEM   Flash Cannon with Life Orb (ModifyDamage, after the die)',
    att: 'Archaludon', move: 'Flash Cannon', def: 'Clefable', attItem: 'Life Orb' },
  { label: 'physical, 100 BP, SPREAD    Earthquake',
    att: 'Garchomp', move: 'Earthquake', def: 'Snorlax', spread: true },
  { label: 'physical, 75 BP, SPREAD     Rock Slide',
    att: 'Tyranitar', move: 'Rock Slide', def: 'Corviknight', spread: true },
];
for (const r of FIX) { r.pal = PAL; r.benchA = B1; r.benchB = B2; }

/* ------------------------------------------------------------------------------------------------ */
const BROKEN_ARM = process.env.MEDI_DAMAGE_SPAN_DRAW === '1';
console.log('DAMAGE ROLL SUPPORT — ROADMAP #304'
  + (BROKEN_ARM ? '   *** MEDI_DAMAGE_SPAN_DRAW=1: THE SPAN DRAW IS RESTORED, this arm is EXPECTED to fail ***' : ''));
console.log('  the authority selects one of ' + SIDES + ' floored indices; this engine draws a position in a span');
console.log('');

let fixtureFail = 0, red = 0, rows = 0;
const uniq = a => [...new Set(a)].sort((x, y) => x - y);

/* §L — LEGALITY, DERIVED. Nothing in this file names an entity the format does not carry. */
{
  let bad = 0;
  const seen = new Set();
  for (const r of FIX) {
    const k = r.att + '|' + r.move + '|' + (r.attItem || '');
    if (!seen.has(k)) { seen.add(k);
      const v = CS.checkLegal({ species: r.att, moves: [r.move], item: r.attItem || '' });
      if (!v.legal) { bad++; console.log('  FAIL not legal in ' + CS.FORMAT + ': ' + k + ' — ' + (v.problems || []).join('; ')); } }
    for (const [sp, it] of [[r.def, r.defItem], [r.pal, ''], [r.benchA, ''], [r.benchB, '']]) {
      const k2 = sp + '|' + (it || '');
      if (seen.has(k2)) continue; seen.add(k2);
      const v = CS.checkLegal({ species: sp, moves: [inertMove(sp)], item: it || '' });
      if (!v.legal) { bad++; console.log('  FAIL not legal in ' + CS.FORMAT + ': ' + k2 + ' — ' + (v.problems || []).join('; ')); }
    }
  }
  console.log('  §L legality — ' + seen.size + ' distinct species/move/item combinations put to the official TeamValidator: '
              + (bad ? bad + ' REJECTED' : 'all accepted'));
  fixtureFail += bad;
}
console.log('');

for (const row of FIX) {
  rows++;
  let sd, me16, meSweep;
  try {
    sd = [];
    for (let i = 0; i < SIDES; i++) sd.push(showdownDamage(row, i));
    /* the paired sweep: the die position the middle arm maps onto index i */
    me16 = new Array(SIDES);
    for (let i = 0; i < SIDES; i++) {
      const u = (SIDES - 1 - i + 0.5) / SIDES;
      if (midDamageIndex(u) !== i) throw new Error('the mapping disagrees with itself at i=' + i);
      me16[i] = mediDamage(row, u);
    }
    /* the support sweep: 512 positions, so the width of this engine's span is not assumed */
    meSweep = [];
    for (let k = 0; k < 512; k++) meSweep.push(mediDamage(row, (k + 0.5) / 512));
  } catch (e) {
    fixtureFail++;
    console.log('  FIXTURE ' + row.label + '\n    THREW ' + e.message);
    continue;
  }

  const sdSet = uniq(sd), meSet = uniq(meSweep);
  const meOnly = meSet.filter(v => !sdSet.includes(v));
  const sdOnly = sdSet.filter(v => !meSet.includes(v));

  /* §0 CONTROL, and it runs before anything is called a defect. */
  const varies = sdSet.length > 1;
  const topAgrees = sd[0] === Math.max(...meSweep);
  const botAgrees = sd[SIDES - 1] === Math.min(...meSweep);
  const multihit = !!(dex.moves.get(row.move).multihit);
  console.log('  ' + row.label);
  console.log('    showdown ' + sdSet[0] + '..' + sdSet[sdSet.length - 1] + ' (' + sdSet.length + ' distinct of ' + SIDES + ' indices)'
            + '   medicham ' + meSet[0] + '..' + meSet[meSet.length - 1] + ' (' + meSet.length + ' distinct)');
  if (!varies || multihit || !topAgrees || !botAgrees) {
    fixtureFail++;
    console.log('    FIXTURE NOT COMPARABLE — this is a staging defect, not an engine one:'
      + (!varies ? ' the authority gives one value at every index (nothing varies);' : '')
      + (multihit ? ' the move is multi-hit, which this file declares out of scope;' : '')
      + (!topAgrees ? ' top endpoint sd=' + sd[0] + ' me=' + Math.max(...meSweep) + ';' : '')
      + (!botAgrees ? ' bottom endpoint sd=' + sd[SIDES - 1] + ' me=' + Math.min(...meSweep) + ';' : ''));
    continue;
  }

  /* §1 SUPPORT */
  let bad = 0;
  if (meOnly.length || sdOnly.length) {
    bad++;
    console.log('    §1 SUPPORT   FAIL  ' + meOnly.length + ' value(s) only this engine can emit'
                + (meOnly.length ? ' [' + meOnly.slice(0, 10).join(',') + (meOnly.length > 10 ? ',…' : '') + ']' : '')
                + (sdOnly.length ? ', ' + sdOnly.length + ' only the authority can [' + sdOnly.slice(0, 10).join(',') + ']' : ''));
  } else {
    console.log('    §1 SUPPORT   ok    the two engines can emit exactly the same ' + sdSet.length + ' values');
  }

  /* §2 PAIRED */
  const mism = [];
  for (let i = 0; i < SIDES; i++) if (me16[i] !== sd[i]) mism.push(i + ': sd ' + sd[i] + ' me ' + me16[i]);
  if (mism.length) {
    bad++;
    console.log('    §2 PAIRED    FAIL  ' + mism.length + ' of ' + SIDES + ' indices disagree — ' + mism.slice(0, 6).join(' | ')
                + (mism.length > 6 ? ' | …' : ''));
  } else {
    console.log('    §2 PAIRED    ok    all ' + SIDES + ' indices agree, value for value');
  }
  if (bad) red++;
  /* THE DERIVATION, PRINTED RATHER THAN ARGUED: where the authority's sixteen indices collapse. */
  const collide = [];
  for (let i = 1; i < SIDES; i++) if (sd[i] === sd[i - 1]) collide.push(i);
  console.log('    the authority\'s ' + SIDES + ' indices collapse to ' + sdSet.length
              + (collide.length ? ' — indices ' + collide.join(',') + ' repeat the one below them' : ' — no repeats')
              + '; the span holds ' + (sdSet[sdSet.length - 1] - sdSet[0] + 1) + ' integers, so '
              + (sdSet[sdSet.length - 1] - sdSet[0] + 1 - sdSet.length) + ' are HOLES the authority never lands on');
  console.log('');
}

console.log('  ' + rows + ' rows, ' + fixtureFail + ' not comparable, ' + red + ' with a disagreeing engine');

/* §C — THE CAPABILITY MUST PROVE IT RAN. A selection that never happens looks exactly like one that
 * works, because the fallback arithmetic is the old engine. Both counters are read, not assumed. */
const SEEN = MEDI.MEDSEEN || (globalThis.MEDSEEN || {});
const FAILS = MEDI.MEDFAILS || (globalThis.MEDFAILS || {});
const selected = SEEN.damageBandSelected || 0, missing = FAILS.damageBandMissing || 0;
let counterBad = 0;
if (!BROKEN_ARM) {
  if (!selected) { counterBad++; console.log('  FAIL §C the band was selected ZERO times — the loop is still interpolating and every green line above is a coincidence'); }
  else console.log('  §C the band was selected ' + selected + ' time(s); ' + missing + ' hit(s) fell back');
  if (missing) { counterBad++; console.log('  FAIL §C ' + missing + ' hit(s) had no sixteen-entry band and took the loud fallback, first on ' + (FAILS.damageBandMissingFirst || '?')); }
} else {
  console.log('  §C restore flag arm: band selected ' + selected + ' time(s), MEDFAILS.damageSpanDrawRestored=' + (FAILS.damageSpanDrawRestored || 0));
  if (!FAILS.damageSpanDrawRestored) { counterBad++; console.log('  FAIL §C MEDI_DAMAGE_SPAN_DRAW=1 did not stamp its failure counter — a restore arm that cannot be told from a clean run'); }
}

if (fixtureFail) { console.log('\n  FAIL — the fixture could not be staged. Fix the fixture before reading the engine.'); process.exit(2); }
if (red || counterBad) { console.log('\n  FAIL — medicham2 does not spend the authority\'s damage index. ROADMAP #304.'); process.exit(1); }

/* §B — THE DELIBERATE BREAK MUST BREAK. Re-runs this file with the defect restored at runtime and
 * FAILS IF THE BROKEN ARM PASSES, because a probe nobody has seen red proves nothing. */
if (!BROKEN_ARM) {
  console.log('\n  §B THE BROKEN ARM MUST BREAK  (re-running with MEDI_DAMAGE_SPAN_DRAW=1)');
  const { spawnSync } = require('child_process');
  const child = spawnSync(process.execPath, [__filename],
    { encoding: 'utf8', cwd: D('.'), env: Object.assign({}, process.env, { MEDI_DAMAGE_SPAN_DRAW: '1' }) });
  const out = String(child.stdout || '') + String(child.stderr || '');
  const failed = (out.match(/FAIL/g) || []).length;
  if (child.status === 0 || !failed) {
    console.log('    FAIL the restored span draw did not break this file (exit ' + child.status + ') — every green line above is unproven');
    console.log(out.split('\n').slice(-12).join('\n'));
    process.exit(1);
  }
  console.log('    ok  with the span draw restored this file FAILS (' + failed + ' FAIL line(s), exit ' + child.status + ')');
}

console.log('\n  PASS — every staged hit emits the authority\'s support, index for index.');
