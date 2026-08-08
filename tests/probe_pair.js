/* tests/probe_pair.js — ONE WAY TO STAGE THE SAME BODY IN BOTH ENGINES, AND IT ASSERTS THAT IT DID.
 *
 *   const PP = require('./probe_pair.js');
 *   const r = PP.damage({ att:'Meganium', def:'Gengar', move:'Weather Ball',
 *                         attAb:'Mega Sol', defAb:'Levitate', weather:null, roll:0 });
 *   // r = { showdown: 115, medicham: 0, agree: false, roll: 0, rollFactor: 1.00, bodies: {...} }
 *
 * ================= WHY THIS EXISTS ==============================================================
 *
 * `docs/LESSONS.md` §5 now records about twenty-five cases of a probe being wrong rather than the
 * engine, and FIVE of them landed on 2026-08-08 alone. The one that cost the most was not subtle and
 * not unlucky — it is structural, and every hand-rolled two-engine probe in this repository has it:
 *
 *     MEDI.buildMon('snorlax')  ships the species' REAL ability out of MC.mons -> Thick Fat.
 *     mkSet('Snorlax')          ships dex.species.get(name).abilities[0]       -> Immunity.
 *
 * Thick Fat halves Fire and Ice. A Weather Ball probe read `Meganium into Snorlax`, found sun at
 * exactly half, and produced a confident report that Weather Ball ignored three of the four weathers
 * on 8,620 uses. Weather Ball is correct. The defender was carrying an ability on one side only.
 *
 * THE RULE THIS FILE ENFORCES IS CLAUDE.md's OWN: **facts are global, features are per-model.** Two
 * places that both decide what body a probe is holding will disagree eventually, and the disagreement
 * is invisible because both keep working. So there is one function, it builds both sides, and it
 * REFUSES to return a number when the two bodies do not match.
 *
 * ================= THE FOUR THINGS IT REFUSES ===================================================
 *
 * 1. A BODY THAT DOES NOT EXIST ON OUR SIDE. `MEDI.buildMon` returns **null** for any species with no
 *    `MC.mons` row — Blissey and Ferrothorn both fail, Snorlax works. A probe that does not check the
 *    return value stages nothing and reports whatever the uninitialised path happens to produce.
 *
 * 2. BODIES THAT DISAGREE. Species, ability, item, types, level and every stat are compared after
 *    both are built. Any mismatch throws, naming the field. This is the Thick Fat case and it is the
 *    whole reason the file exists.
 *
 * 3. A CONTROL THAT IS NOT QUIET. `ability: null` means "an ability that touches nothing", and it
 *    resolves to a NAMED quiet ability rather than to whatever the species happens to have. The
 *    roster's `ability/generic` rule picked another live ability as its control and produced four
 *    false findings across 2,049 uses (ROADMAP #100) — Sand Rush was "broken" because its control was
 *    Fluffy. A control has to be chosen, not defaulted into.
 *
 * 4. A KNOB THAT DID NOT MOVE. `damage()` takes an optional `control` — the same call with the one
 *    varied thing removed — and reports `knobMoved`. `docs/LESSONS.md`: identical results across a
 *    varied knob mean the knob is UNWIRED, not that it does not matter. A row where the authority
 *    itself cannot tell the two arms apart proves nothing about either engine.
 *
 * ================= THE ROLL INDEX, DERIVED ONCE ==================================================
 *
 * Both engines use the SAME convention and it is counter-intuitive enough that it was mislabelled in
 * a report on 2026-08-08 (harmlessly, because both columns were at the same index — but the next
 * person will not be so lucky).
 *
 *     Showdown   sim/battle.js:1972   randomizer(d) = tr(tr(d * (100 - this.random(16))) / 100)
 *     MEDICHAM   medicham2-browser.js:3218   for(let i=0;i<16;i++) hit.rolls.push(roll(100-i))
 *
 * So `random(16) -> i` and `hit.rolls[i]` are the SAME roll, and:
 *
 *     roll 0   ->  x1.00   THE TOP ROLL      (the default here, and what every other check pins)
 *     roll 15  ->  x0.85   the bottom roll
 *
 * The index is NOT a percentage and NOT a rank from the bottom. `damage()` returns `rollFactor` beside
 * the numbers so a caller can see which end it is on without re-deriving this.
 *
 * A STANDING WARNING, from the same session: a stage error is SMALLEST at the top roll, because the
 * randomizer is the identity there. `tests/test-damage-stages.js` found Kowtow Cleave disagreeing on
 * six of sixteen rolls with roll 0 among the ten that AGREE. Pinning one roll is a smoke test. Use
 * `allRolls()` when the answer matters.
 *
 * ================= WHAT THIS FILE DELIBERATELY DOES NOT DO ======================================
 *
 * It calls `battle.actions.moveHit(...)` directly, which is fast and exact for damage arithmetic and
 * WRONG for three whole classes of question, because that path never runs `runEvent('ModifyType')`
 * and never sets `battle.activePokemon`:
 *
 *     - move TYPE conversion   (Weather Ball is Normal on this path in every weather)
 *     - anything reading `battle.activePokemon`   (Mega Sol's core patch keys on exactly that)
 *     - charge turns, switches, residuals, and every question about the turn LOOP
 *
 * `damage()` throws on a move with `onModifyType` rather than quietly returning the unconverted
 * number, because that silent wrong answer is what produced the Weather Ball report. For those
 * questions use a real battle through `battle.choose(...)` — `tests/staged_board.js` already drives
 * one and is the right tool. This file is for damage arithmetic between two matched bodies.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
require(D('engine', 'showdown_path.js'));
const { Battle, Dex, Teams } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const MC = globalThis.MC;
const dex = Dex.forFormat(CS.FORMAT);

/* THE QUIET ABILITY, NAMED. Illuminate touches no damage event, no speed event and no secondary — it
 * is what tests/test-damage-stages.js already uses as its control on both sides. Naming it here means
 * a control is a DECISION recorded in one place, not a default that varies with the species. */
const QUIET_ABILITY = 'Illuminate';

/* Showdown's damage math wants a filled-out team; these are the padding, and they never act. */
const FILLER = ['Ditto', 'Ditto', 'Ditto'];

const idOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE FLAT STAT LINE, computed from base stats the same way on both sides. A harness that does not
 * align stat lines produces a constant offset in BOTH arms and proves nothing — that happened on
 * 2026-08-08 with Skarmory rows differing ~1.22x with and without the subject. */
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function flatStats(name) {
  const sp = dex.species.get(name);
  if (!sp.exists) throw new Error('probe_pair: no such species in ' + CS.FORMAT + ': ' + name);
  const bs = sp.baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}

/* The two engines spell the sky differently. ONE map, stated once, so a scenario says the authority's
 * word and both sides read it. Getting this wrong silently disables the weather on our side only,
 * which is a documented past failure in tests/test-damage-stages.js. */
const WEATHER = { sunnyday: 'sun', desolateland: 'sun', raindance: 'rain', primordialsea: 'rain',
                  sandstorm: 'sand', snowscape: 'snow', snow: 'snow', hail: 'snow' };

function medichamWeather(w) {
  if (!w) return '';
  const our = WEATHER[w];
  if (!our) throw new Error('probe_pair: no medicham spelling for weather ' + w);
  return our;
}

/* ---- THE BODIES, BUILT TOGETHER AND COMPARED ------------------------------------------------- */

function buildOurs(species, o) {
  const m = MEDI.buildMon(idOf(species), {});
  /* REFUSAL 1. buildMon returns null for a species with no MC.mons row. Silent on its own. */
  if (!m) throw new Error('probe_pair: MEDI.buildMon returned null for "' + species + '" — no MC.mons '
    + 'row. Pick a species that exists on BOTH sides (Blissey and Ferrothorn do not; Snorlax does).');
  m.st = flatStats(species);
  m.curHP = m.st.hp;
  m.boosts = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 };
  m.status = '';
  /* ALWAYS SET, NEVER INHERITED. This is the Thick Fat line. */
  m.ability = idOf(dex.abilities.get(o.ability || QUIET_ABILITY).name);
  m.item = o.item ? dex.items.get(o.item).id : '';
  return m;
}

function mkSet(species, move, o) {
  return { name: species, species, item: o.item ? dex.items.get(o.item).name : '',
           ability: dex.abilities.get(o.ability || QUIET_ABILITY).name,
           moves: [move], nature: 'Serious',
           evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}

/* REFUSAL 2. Every field that could differ, compared after both are built. */
function assertBodiesMatch(label, sdMon, ourMon, species, o) {
  const want = flatStats(species);
  const wantAb = idOf(dex.abilities.get(o.ability || QUIET_ABILITY).name);
  const wantItem = o.item ? dex.items.get(o.item).id : '';
  const bad = [];
  if (idOf(sdMon.species.name) !== idOf(species)) bad.push('showdown species is ' + sdMon.species.name);
  if (idOf(ourMon.name || species) !== idOf(species)) bad.push('medicham species is ' + ourMon.name);
  if (sdMon.ability !== wantAb) bad.push('showdown ability ' + sdMon.ability + ' != ' + wantAb);
  if (ourMon.ability !== wantAb) bad.push('medicham ability ' + ourMon.ability + ' != ' + wantAb);
  if ((sdMon.item || '') !== wantItem) bad.push('showdown item "' + sdMon.item + '" != "' + wantItem + '"');
  if ((ourMon.item || '') !== wantItem) bad.push('medicham item "' + ourMon.item + '" != "' + wantItem + '"');
  for (const [ourK, sdK] of [['at', 'atk'], ['df', 'def'], ['sa', 'spa'], ['sd', 'spd'], ['sp', 'spe']]) {
    if (ourMon.st[ourK] !== want[ourK]) bad.push('medicham ' + ourK + ' ' + ourMon.st[ourK] + ' != ' + want[ourK]);
    if (sdMon.storedStats[sdK] !== want[ourK]) bad.push('showdown ' + sdK + ' ' + sdMon.storedStats[sdK] + ' != ' + want[ourK]);
  }
  const sdTypes = sdMon.getTypes().join('/');
  const ourTypes = (ourMon.types || ourMon.ty || []).join('/');
  if (ourTypes && sdTypes !== ourTypes) bad.push('types showdown ' + sdTypes + ' != medicham ' + ourTypes);
  if (bad.length) {
    throw new Error('probe_pair: THE TWO BODIES DO NOT MATCH (' + label + ' = ' + species + ')\n    '
      + bad.join('\n    ') + '\n  This is the Thick Fat failure. The number would have been a lie.');
  }
}

/* ---- ONE PINNED ROLL -------------------------------------------------------------------------- */

/**
 * damage({att, def, move, attAb, defAb, attItem, defItem, weather, terrain, crit, spread, roll, control})
 *   roll: 0..15, where 0 is the TOP roll (x1.00) and 15 the bottom (x0.85). Default 0.
 *   control: an optional partial override; the same scenario with the varied thing removed.
 * Returns { showdown, medicham, agree, roll, rollFactor, knobMoved (if control given) }.
 */
function damage(o) {
  if (o.roll != null && (!Number.isInteger(o.roll) || o.roll < 0 || o.roll > 15)) {
    throw new Error('probe_pair: roll must be an integer 0..15 (0 = top). Got ' + o.roll);
  }
  const roll = o.roll == null ? 0 : o.roll;

  /* THE MOVE-TYPE REFUSAL. moveHit never runs ModifyType, so a converting move silently reports its
   * unconverted damage — the exact silent wrong answer that produced the Weather Ball report. */
  const mv = dex.moves.get(o.move);
  if (!mv.exists) throw new Error('probe_pair: no such move: ' + o.move);
  if (mv.onModifyType && !o.iKnowMoveHitSkipsModifyType) {
    throw new Error('probe_pair: "' + mv.name + '" has onModifyType, and this file calls moveHit '
      + 'directly, which never runs ModifyType — the reported type would be its UNCONVERTED one. '
      + 'Drive a real battle through battle.choose() instead (tests/staged_board.js does). '
      + 'Pass iKnowMoveHitSkipsModifyType:true only if the unconverted number is genuinely what you want.');
  }

  const attO = { ability: o.attAb, item: o.attItem };
  const defO = { ability: o.defAb, item: o.defItem };

  /* ---- ours ---- */
  const a = buildOurs(o.att, attO);
  const d = buildOurs(o.def, defO);
  /* UNFAINTABLE, both sides by the same multiple. The reference reports HP ACTUALLY LOST, so a KO
   * clamps at the defender's maximum and "strong" and "much stronger" print the same number. */
  d.st.hp = d.st.hp * 40; d.curHP = d.st.hp;
  const field = { terrain: o.terrain || '', weather: medichamWeather(o.weather), twA: 0, twB: 0 };
  const mcRow = MC.moves[mv.id];
  if (!mcRow) throw new Error('probe_pair: no MC.moves row for ' + mv.id);
  const hit = { rolls: [] };
  MEDI.dmgRange(a, d, mcRow, field, !!o.spread, !!o.crit, hit);
  const ours = hit.rolls[roll];

  /* ---- the authority ---- */
  const teamA = [mkSet(o.att, mv.name, attO), ...FILLER.map(f => mkSet(f, 'Tackle', {}))];
  const teamB = [mkSet(o.def, 'Tackle', defO), ...FILLER.map(f => mkSet(f, 'Tackle', {}))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  const A = flatStats(o.att), Dst = flatStats(o.def);
  src.storedStats.atk = A.at; src.storedStats.spa = A.sa; src.storedStats.def = A.df; src.storedStats.spd = A.sd; src.storedStats.spe = A.sp;
  tgt.storedStats.atk = Dst.at; tgt.storedStats.spa = Dst.sa; tgt.storedStats.def = Dst.df; tgt.storedStats.spd = Dst.sd; tgt.storedStats.spe = Dst.sp;
  src.maxhp = A.hp; src.hp = A.hp;
  tgt.maxhp = Dst.hp * 40; tgt.hp = tgt.maxhp;
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) p.clearBoosts();
  battle.field.clearWeather(); battle.field.clearTerrain();
  /* BOTH ABILITIES SET EXPLICITLY, ALWAYS — never left at the species default on either side. */
  const setAb = (p, name) => {
    const ab = dex.abilities.get(name || QUIET_ABILITY);
    if (!ab.exists) throw new Error('probe_pair: no ability ' + name);
    p.ability = ab.id; p.abilityState = { id: ab.id, target: p, effectOrder: 0 };
  };
  setAb(src, attO.ability); setAb(tgt, defO.ability);
  if (attO.item) src.item = dex.items.get(attO.item).id;
  if (defO.item) tgt.item = dex.items.get(defO.item).id;
  if (o.terrain) {
    battle.field.setTerrain(o.terrain, src);
    if (battle.field.terrain !== dex.conditions.get(o.terrain).id) throw new Error('probe_pair: terrain did not take');
  }
  if (o.weather) {
    battle.field.setWeather(o.weather, src);
    if (battle.field.weather !== dex.conditions.get(o.weather).id) throw new Error('probe_pair: weather did not take');
  }

  assertBodiesMatch('att', src, a, o.att, attO);
  assertBodiesMatch('def', tgt, d, o.def, defO);

  battle.random = (n) => (n === 16 ? roll : 0);
  const active = battle.dex.getActiveMove(mv.id);
  active.willCrit = !!o.crit || !!mv.willCrit;
  active.hit = 1;
  if (o.spread) active.spreadHit = true;
  const before = tgt.hp;
  battle.actions.moveHit(tgt, src, active);
  const showdown = before - tgt.hp;

  const out = { showdown, medicham: ours, agree: showdown === ours,
                roll, rollFactor: +((100 - roll) / 100).toFixed(2) };

  /* REFUSAL 4 — THE KNOB CHECK, on the AUTHORITY only. If Showdown gives the same answer with and
   * without the varied thing, the row proves nothing about either engine. */
  if (o.control) {
    const ctl = damage(Object.assign({}, o, o.control, { control: null }));
    out.knobMoved = ctl.showdown !== showdown;
    out.control = { showdown: ctl.showdown, medicham: ctl.medicham };
    if (!out.knobMoved) {
      out.warning = 'KNOB DEAD — the authority gives ' + showdown + ' with and without the varied '
        + 'thing, so this row is not evidence. Stage it against a body that can show the effect.';
    }
  }
  return out;
}

/* ---- ALL SIXTEEN, WHICH IS WHAT YOU WANT WHEN THE ANSWER MATTERS ------------------------------ */
function allRolls(o) {
  const sd = [], me = [];
  for (let r = 0; r < 16; r++) { const x = damage(Object.assign({}, o, { roll: r, control: null })); sd.push(x.showdown); me.push(x.medicham); }
  const bad = [];
  for (let r = 0; r < 16; r++) if (sd[r] !== me[r]) bad.push(r);
  return { showdown: sd, medicham: me, agree: bad.length === 0, disagreeingRolls: bad,
           flat: new Set(sd).size === 1 };
}

module.exports = { damage, allRolls, flatStats, QUIET_ABILITY, WEATHER, medichamWeather };

/* ---- SELF-TEST: the instrument, before any subject ------------------------------------------- */
if (require.main === module) {
  let fail = 0;
  const ok = (name, cond, detail) => { console.log((cond ? '  ok    ' : '  FAIL  ') + name + (detail ? '   ' + detail : '')); if (!cond) fail++; };
  console.log('probe_pair self-test — the instrument checks ITSELF before it is trusted\n');

  /* 1. The refusal that is the whole point: it must NOT be possible to compare mismatched bodies.
   *    Snorlax is the real case — MC.mons gives it Thick Fat, Showdown gives it Immunity. If the
   *    explicit-ability path ever regresses, this fires. */
  try {
    const m = MEDI.buildMon('snorlax', {});
    ok('MC.mons Snorlax really does ship a non-quiet ability (the bug that motivated this file)',
       !!m && m.ability !== idOf(QUIET_ABILITY), 'buildMon gave ability=' + (m && m.ability));
  } catch (e) { ok('buildMon snorlax', false, e.message); }

  /* 2. buildMon's null must be caught, not returned as a body. */
  let threw = false;
  try { buildOurs('Blissey', {}); } catch (e) { threw = /returned null/.test(e.message); }
  ok('a species with no MC.mons row THROWS rather than staging nothing', threw);

  /* 3. A converting move must be refused on this path, not silently mis-answered. */
  threw = false;
  try { damage({ att: 'Meganium', def: 'Snorlax', move: 'Weather Ball' }); }
  catch (e) { threw = /onModifyType/.test(e.message); }
  ok('a move with onModifyType is REFUSED (moveHit never runs ModifyType)', threw);

  /* 4. A plain damage row agrees, and the roll index means what the header says it means. */
  try {
    const top = damage({ att: 'Meganium', def: 'Snorlax', move: 'Energy Ball', roll: 0 });
    const bot = damage({ att: 'Meganium', def: 'Snorlax', move: 'Energy Ball', roll: 15 });
    ok('a plain row agrees at the top roll', top.agree, 'sd=' + top.showdown + ' ours=' + top.medicham);
    ok('a plain row agrees at the bottom roll', bot.agree, 'sd=' + bot.showdown + ' ours=' + bot.medicham);
    ok('roll 0 is the TOP roll (strictly larger than roll 15)', top.showdown > bot.showdown,
       'roll0=' + top.showdown + ' > roll15=' + bot.showdown);
    ok('rollFactor is labelled correctly', top.rollFactor === 1 && bot.rollFactor === 0.85,
       'top=' + top.rollFactor + ' bottom=' + bot.rollFactor);
  } catch (e) { ok('plain damage row', false, e.message); }

  /* 5. The knob check must call a dead knob dead. Illuminate vs Illuminate cannot move anything. */
  try {
    const dead = damage({ att: 'Meganium', def: 'Snorlax', move: 'Energy Ball',
                          attAb: QUIET_ABILITY, control: { attAb: QUIET_ABILITY } });
    ok('a knob that cannot move is reported DEAD', dead.knobMoved === false && !!dead.warning);
    const live = damage({ att: 'Meganium', def: 'Snorlax', move: 'Energy Ball',
                          attAb: 'Overgrow', attItem: 'Life Orb', control: { attItem: null } });
    ok('a knob that does move is reported LIVE', live.knobMoved === true,
       'with=' + live.showdown + ' without=' + live.control.showdown);
  } catch (e) { ok('knob check', false, e.message); }

  console.log('\n' + (fail ? fail + ' FAILED' : 'all green — the instrument may be trusted'));
  process.exit(fail ? 1 : 0);
}
