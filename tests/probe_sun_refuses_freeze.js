/* probe_sun_refuses_freeze.js — THE SKY CARRIES AN `onImmunity` AND THIS ENGINE READ ONLY ITS DAMAGE
 * HANDLERS, SO A BODY STANDING UNDER THE SUN COULD BE FROZEN.
 *
 *   SHOWDOWN_PATH=... node tests/probe_sun_refuses_freeze.js
 *   SHOWDOWN_PATH=... MEDI_FRZ_IN_SUN=1 node tests/probe_sun_refuses_freeze.js      (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * THREE of the forty board-material games on release `014fe780a1a6`
 * (`data/verification/fix-batch-6.json`), all three a `frz` THIS ENGINE APPLIED AND THE AUTHORITY DID
 * NOT, and two of the three with a Charizard-Mega-Y — Drought — standing on the field:
 *
 *   omit-weather           …2663587839  t3   p1.party.charizard.status   medi "frz"  sd ""
 *   pair-protect-bust      …2658818786  t2   p2.party.charizard.status   medi "frz"  sd ""
 *   pair-redirect-priority …2656727922  t2   p2.party.mawile.status      medi "frz"  sd ""
 *
 * The first one's PROTOCOL first divergence is the extra line itself:
 *     showdown  |faint|p1a: Whimsicott
 *     medicham  |-status|p1b: Charizard|frz          <- after a Froslass Blizzard spread
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/conditions.ts:579-582`:
 *
 *     sunnyday: { … onImmunity(type, pokemon) {
 *       if (pokemon.effectiveWeather() !== 'sunnyday') return;
 *       if (type === 'frz') return false;
 *     }, … }
 *
 * `desolateland` carries the byte-identical handler against its own id. `data/mods/champions/
 * conditions.ts` overrides NEITHER — it holds `par`, `slp` and `frz` and no weather — so mainline is
 * authoritative here, and saying that is itself a derivation rather than an assumption.
 *
 * REACHED FROM `Pokemon#setStatus` (sim/pokemon.ts:1714-1725):
 *
 *     if (!ignoreImmunities && status.id && !(source?.hasAbility('corrosion') && …)) {
 *       if (!this.runStatusImmunity(status.id === 'tox' ? 'psn' : status.id)) {
 *         if ((sourceEffect as Move)?.status) this.battle.add('-immune', this);
 *         return false; } }
 *
 * and `runStatusImmunity` (:2275-2295) whose second half is
 * `this.battle.runEvent('Immunity', this, null, null, type)`.
 *
 * MEGA SOL REACHES THIS HANDLER, and that is why the weather is read through `effWeatherOf` rather
 * than off the field. `onImmunity` calls `pokemon.effectiveWeather()` with NO argument, so
 * `sourceEffect` falls back to `this.battle.effect` — inside `runEvent('Immunity')` that is the
 * sunnyday condition itself, whose `effectType` is `'Weather'`, which satisfies the Mega Sol clause at
 * sim/pokemon.ts:2195-2202. A Mega Sol body ATTACKING makes its target freeze-proof with no sun on the
 * field at all.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 * Every reading below is taken off each engine's OWN output — the `|-status|` lines each one emitted
 * during the hit turn, and each one's own field object. Nothing is recomputed alongside the engine.
 *
 *   1  FIXTURE   every weather id any LEGAL move or ability can put on this field, with its
 *                `onImmunity` source printed, and the engine's exported table asserted EQUAL to the
 *                authority's — a second refusing weather or a second refused status reds this by name
 *   2  FIXTURE   zero legal moves carry a PRIMARY `status: 'frz'`, so the authority's `-immune` line
 *                is unreachable and this refusal is silent in every route the regulation has; and
 *                Utility Umbrella, which would blank the sun for its holder, is `isNonstandard: Past`
 *   3  CONTROL   with NO sun, the same click freezes in BOTH engines            (agreed before, and after)
 *   4  TEST      with the sun up, NEITHER engine freezes
 *   5  CONTROL   with the sun up, a non-`frz` secondary status still lands in both — the sun refuses
 *                one status, not statuses
 *   6  CONTROL   the sun was really up, read off each engine's own field, and only in the sun arms
 *   7  CONTROL   the target was alive in both engines on the hit turn, so there was a body to freeze
 *   8  CONTROL   a CLOUD NINE body on the field puts the freeze back in BOTH engines — the refusal
 *                reads `effectiveWeather`, not `field.weather`
 *   9  COUNTER   MEDSEEN.statusRefusedByWeatherCondition is non-zero, so the new clause really ran
 *
 * THE DIE IS PINNED AT ITS BOTTOM CORNER ON BOTH SIDES so a 10% secondary is not being sampled:
 * medicham2 is driven with `rng = () => 0`, and the authority's own PRNG is replaced with the minimum
 * of its documented range (`random()`→0, `random(n)`→0, `random(m,n)`→m), which is what
 * `BattleActions#secondaries`' `this.battle.random(100)` reads. `forceRandomChance` is NOT sufficient
 * and was tried first: `secondaries` does not call `randomChance` at all, so the arm sat green with
 * zero statuses on either side and proved nothing.
 *
 * `MEDI_FRZ_IN_SUN=1` restores the missing refusal. The parent re-runs ITSELF under it and FAILS if
 * that child passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE SUN REFUSES A FREEZE');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_FRZ_IN_SUN === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const uses = id => (TAGS.moves && TAGS.moves[id] && TAGS.moves[id].uses) || 0;
const buildable = n => { try { return !!MEDI.buildMon(mcKey(n, { mayMiss: 'a probe body must be a real row' }), {}); }
  catch (e) { console.error('probe fixture: buildMon(' + name + ') threw -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); return false; } };
const ab0 = sp => dex.abilities.get(Object.values(sp.abilities)[0]).id;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n== THE SUN REFUSES A FREEZE ==' + (CHILD ? '   [MEDI_FRZ_IN_SUN=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE AUTHORITY'S OWN TABLE, DERIVED. Never named here.
 *
 * A weather is only relevant if something in THIS regulation can put it on the field, so the walk is
 * over legal moves' `weather` field and legal abilities' own `setWeather('…')` calls — not over the
 * National Dex's conditions. `W2ENGINE` in engine/tag_dex.js maps both sun ids onto the engine's one
 * word `sun`, which is the key medicham2's table uses.
 * ============================================================================================= */
const W2ENGINE = { sunnyday: 'sun', desolateland: 'sun', raindance: 'rain', primordialsea: 'rain',
                   sandstorm: 'sand', hail: 'snow', snowscape: 'snow', snow: 'snow',
                   deltastream: 'deltastream' };
const setters = {};
const note = (id, who) => { (setters[id] = setters[id] || []).push(who); };
for (const m of dex.moves.all().filter(legal)) if (m.weather) note(dex.conditions.get(m.weather).id, 'move:' + m.id);
for (const a of dex.abilities.all().filter(legal)) {
  const src = Object.values(a).filter(v => typeof v === 'function').map(String).join('\n');
  for (const mm of src.matchAll(/setWeather\(\s*['"](\w+)['"]/g)) {
    const carriers = dex.species.all().filter(legal)
      .filter(s => Object.values(s.abilities).map(x => dex.abilities.get(x).id).includes(a.id));
    note(dex.conditions.get(mm[1]).id, 'ability:' + a.id + ' (' + carriers.length + ' legal carriers)');
  }
}
const AUTH = {};
console.log('  EVERY WEATHER THIS REGULATION CAN PUT ON THE FIELD, AND ITS `onImmunity`:');
for (const id of Object.keys(setters)) {
  const c = dex.conditions.get(id);
  const src = c.onImmunity ? String(c.onImmunity).replace(/\s+/g, ' ') : '';
  const refused = [...new Set([...src.matchAll(/type\s*===\s*['"](\w+)['"]\s*\)\s*return\s+false/g)].map(m => m[1]))];
  const w = W2ENGINE[id] || id;
  if (refused.length) AUTH[w] = [...new Set((AUTH[w] || []).concat(refused))].sort();
  console.log('    ' + id.padEnd(14) + ' engine word `' + w + '`  refuses ' + (refused.length ? refused.join(',') : 'NOTHING'));
  console.log('        set by ' + setters[id].join(', '));
  if (src) console.log('        ' + src);
}
if (!Object.keys(AUTH).length) { FIXTURE('no reachable weather refuses any status — nothing to test'); process.exit(2); }

const ENG = MEDI.WEATHER_REFUSES_STATUS;
const engNorm = {}; for (const k of Object.keys(ENG || {})) engNorm[k] = [...ENG[k]].sort();
ok(eq(engNorm, AUTH),
  'FIXTURE/TEST — the engine\'s weather-immunity table IS the authority\'s, derived here and compared',
  'engine ' + JSON.stringify(engNorm) + '   authority ' + JSON.stringify(AUTH));

/* ================================================================================================
 * 2 — THE TWO FACTS THAT MAKE THIS REFUSAL SILENT AND UNCONDITIONAL IN THIS REGULATION.
 * ============================================================================================= */
const STATUSES = [...new Set(Object.values(AUTH).flat())];
const PRIMARY = dex.moves.all().filter(legal).filter(m => STATUSES.includes(m.status)).map(m => m.id);
ok(PRIMARY.length === 0,
  'FIXTURE — no legal move carries a PRIMARY ' + STATUSES.join('/') + ', so the authority\'s `-immune` line is unreachable',
  'legal moves with a primary refused status: ' + (PRIMARY.join(', ') || 'NONE'));
const UMB = dex.items.get('utilityumbrella');
ok(!legal(UMB),
  'FIXTURE — Utility Umbrella, which would blank the sun for its holder, is not in this regulation',
  'isNonstandard=' + JSON.stringify(UMB.isNonstandard) + '   tier=' + JSON.stringify(UMB.tier));

/* ================================================================================================
 * THE FIXTURE BODIES, ALL DERIVED.
 * ============================================================================================= */
const secStatuses = m => [].concat(m.secondaries || [], m.secondary ? [m.secondary] : [])
  .filter(s => s && s.status).map(s => s.status);
const famFor = st => dex.moves.all().filter(legal)
  .filter(m => m.category !== 'Status' && m.target === 'normal' && secStatuses(m).includes(st))
  .map(m => ({ id: m.id, uses: uses(m.id) })).sort((a, b) => b.uses - a.uses);
const REFUSED = STATUSES[0];                                  /* the status the sky turns away */
const FRZ = famFor(REFUSED);
/* THE CONTROL STATUS: the most-used secondary status this format carries that the sky does NOT
 * refuse. Derived, so the control cannot accidentally be a second refused one. */
const OTHER = [...new Set(dex.moves.all().filter(legal).flatMap(secStatuses))]
  .filter(s => !STATUSES.includes(s))
  .map(s => ({ st: s, fam: famFor(s) })).filter(x => x.fam.length)
  .sort((a, b) => b.fam[0].uses - a.fam[0].uses)[0];
const SUNM = dex.moves.all().filter(legal)
  .filter(m => m.weather && (W2ENGINE[dex.conditions.get(m.weather).id] || '') === Object.keys(AUTH)[0])
  .map(m => m.id);
const SELFB = dex.moves.all().filter(legal)
  .filter(m => m.category === 'Status' && m.target === 'self' && m.boosts && !m.status && !m.volatileStatus)
  .map(m => ({ id: m.id, uses: uses(m.id) })).sort((a, b) => b.uses - a.uses);
console.log('\n  LEGAL single-target damaging moves whose secondary is `' + REFUSED + '`: '
  + (FRZ.map(m => m.id + ' uses=' + m.uses).join(', ') || 'NONE'));
console.log('  THE CONTROL STATUS (most-used secondary the sky does NOT refuse): '
  + (OTHER ? OTHER.st + ' via ' + OTHER.fam[0].id + ' uses=' + OTHER.fam[0].uses : 'NONE'));
console.log('  LEGAL moves that set `' + Object.keys(AUTH)[0] + '`: ' + (SUNM.join(', ') || 'NONE'));
if (!FRZ.length || !SUNM.length || !SELFB.length) {
  FIXTURE('this format has no ' + REFUSED + ' carrier, no sun setter or no inert self-boost — a claim about the format');
  process.exit(2);
}

/* THE TARGET: the bulkiest legal body that can hold the refused status at all (not type-immune, not
 * ability-immune) and learns an inert self-boost to click. */
const typeImmune = (sp, st) => !dex.getImmunity(st, sp);
let TGT = null;
for (const s of dex.species.all().filter(legal).sort((a, b) =>
  (b.baseStats.hp + b.baseStats.def + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd)
  || a.name.localeCompare(b.name))) {
  if (typeImmune(s, REFUSED) || (OTHER && typeImmune(s, OTHER.st))) continue;
  const ab = dex.abilities.get(ab0(s));
  if (ab.onSetStatus || ab.onImmunity || ab.onUpdate) continue;      /* no ability-side refusal or cure */
  const sb = SELFB.find(x => LS(s)[x.id]); if (!sb) continue;
  if (!buildable(s.name)) continue;
  TGT = { sp: s, boost: sb.id, ab: ab.id }; break;
}
if (!TGT) { FIXTURE('no legal body can carry ' + REFUSED + ' and click an inert self-boost'); process.exit(2); }
function attacker(fam) {
  for (const mv of fam) for (const s of dex.species.all().filter(legal)
    .sort((a, b) => b.baseStats.spe - a.baseStats.spe || a.name.localeCompare(b.name))) {
    if (!LS(s)[mv.id]) continue;
    const sb = SELFB.find(x => LS(s)[x.id]); if (!sb) continue;
    if (!buildable(s.name)) continue;
    return { sp: s, ab: ab0(s), mv: mv.id, idle: sb.id };
  }
  return null;
}
const A_FRZ = attacker(FRZ), A_OTH = OTHER ? attacker(OTHER.fam) : null;
let SUN = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name))) {
  const sm = SUNM.find(x => LS(s)[x]); if (!sm) continue;
  const sb = SELFB.find(x => LS(s)[x.id]); if (!sb) continue;
  if (!buildable(s.name)) continue;
  SUN = { sp: s, ab: ab0(s), mv: sm, idle: sb.id }; break;
}
if (!A_FRZ || !SUN) { FIXTURE('no legal ' + REFUSED + ' attacker or no legal sun setter that also has an inert click'); process.exit(2); }
/* THE SUPPRESSOR for arm 8, from the tag rather than from a name. */
const SUPP_AB = (TAGS.abilities ? Object.keys(TAGS.abilities) : [])
  .filter(a => TAGS.abilities[a] && (TAGS.abilities[a].tags || []).indexOf('weatherSuppression') >= 0)
  .filter(a => legal(dex.abilities.get(a)));
let SUPP = null;
for (const a of SUPP_AB) for (const s of dex.species.all().filter(legal).sort((x, y) => x.name.localeCompare(y.name))) {
  if (!Object.values(s.abilities).map(x => dex.abilities.get(x).id).includes(a)) continue;
  const sb = SELFB.find(x => LS(s)[x.id]); if (!sb) continue;
  if (!buildable(s.name)) continue;
  SUPP = { sp: s, ab: a, idle: sb.id }; break;
}
console.log('\n  TARGET      ' + TGT.sp.name + ' (' + TGT.ab + ', ' + TGT.sp.types.join('/') + ')  inert click ' + TGT.boost);
console.log('  ATTACKER    ' + A_FRZ.sp.name + ' clicks ' + A_FRZ.mv + ', idles on ' + A_FRZ.idle);
console.log('  CONTROL ATK ' + (A_OTH ? A_OTH.sp.name + ' clicks ' + A_OTH.mv : 'NONE'));
console.log('  SUN SETTER  ' + SUN.sp.name + ' clicks ' + SUN.mv + ', idles on ' + SUN.idle);
console.log('  SUPPRESSOR  ' + (SUPP ? SUPP.sp.name + ' (' + SUPP.ab + ')' : 'NONE — `weatherSuppression` has no buildable legal carrier'));

/* ================================================================================================
 * THE TWO RUNS.
 *
 *   turn 1  the attacker idles; its PARTNER either sets the sun or idles; both defenders idle
 *   turn 2  the attacker clicks the move at the defender; everybody else idles
 *
 * Every body that is not the attacker clicks a self-boost on every turn, in every arm, so the only
 * thing that varies between arms is whether the sun went up on turn 1.
 * ============================================================================================= */
function runMedi(atk, sun, supp) {
  const mk = (n, mvs, ab) => { const b = MEDI.buildMon(mcKey(n, { mayMiss: 'a probe body must be a real row' }), {});
    if (!b) throw new Error('buildMon failed for ' + n);
    b.moves = mvs.map(m => dex.moves.get(m).id); b.item = ''; b.ability = ab; return b; };
  const A = mk(atk.sp.name, [atk.mv, atk.idle], atk.ab);
  const B = mk(SUN.sp.name, [SUN.mv, SUN.idle], SUN.ab);
  const V = mk(TGT.sp.name, [TGT.boost, TGT.boost], TGT.ab);
  const V2 = supp ? mk(supp.sp.name, [supp.idle, supp.idle], supp.ab) : mk(TGT.sp.name, [TGT.boost, TGT.boost], TGT.ab);
  const v2click = supp ? supp.idle : TGT.boost;
  const trace = [];
  const S = MEDI.battleInit([A, B], [V, V2], { seeded: true, trace });
  const rng = () => 0;
  const step = (aClick, aTgt, bClick) => MEDI.battleTurn(S, rng,
    new Map([[A, MEDI.playerAction(A, aClick, aTgt, S.field)], [B, MEDI.playerAction(B, bClick, null, S.field)]]),
    new Map([[V, MEDI.playerAction(V, TGT.boost, null, S.field)], [V2, MEDI.playerAction(V2, v2click, null, S.field)]]));
  step(atk.idle, null, sun ? SUN.mv : SUN.idle);
  const weather = (S.field && S.field.weather) || '';
  const n0 = trace.length;
  step(atk.mv, V, SUN.idle);
  const L = trace.slice(n0).map(String);
  return { weather, applied: L.filter(l => /^\|-status\|/.test(l)).map(l => l.split('|')[3]).sort(),
           alive: !V.fainted && V.curHP > 0, lines: L };
}
function runSD(atk, sun, supp) {
  const set = (n, mvs, ab) => ({ name: n, species: n, item: '', ability: dex.abilities.get(ab).name,
    moves: mvs.map(m => dex.moves.get(m).name), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  /* THE BOTTOM CORNER OF THE AUTHORITY'S OWN PRNG, so the 10% secondary is not being sampled. The
   * three shapes are `PRNG#random`'s documented ones (sim/prng.ts:91-103) with `result = 0`:
   * `random()`→0, `random(n)`→0, `random(m,n)`→m. `BattleActions#secondaries` reads
   * `this.battle.random(100)` — NOT `randomChance` — which is why `forceRandomChance` is not used. */
  b.prng.random = (from, to) => (from === undefined ? 0 : (!to ? 0 : Math.floor(from)));
  const v2 = supp ? set(supp.sp.name, [supp.idle, supp.idle], supp.ab) : set(TGT.sp.name, [TGT.boost, TGT.boost], TGT.ab);
  const v2click = supp ? supp.idle : TGT.boost;
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(atk.sp.name, [atk.mv, atk.idle], atk.ab),
                                                   set(SUN.sp.name, [SUN.mv, SUN.idle], SUN.ab)]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(TGT.sp.name, [TGT.boost, TGT.boost], TGT.ab), v2]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  b.choose('p1', 'move ' + atk.idle + ', move ' + (sun ? SUN.mv : SUN.idle));
  b.choose('p2', 'move ' + TGT.boost + ', move ' + v2click);
  const weather = W2ENGINE[b.field.weather] || b.field.weather || '';
  const n0 = b.log.length;
  b.choose('p1', 'move ' + atk.mv + ' 1, move ' + SUN.idle);
  b.choose('p2', 'move ' + TGT.boost + ', move ' + v2click);
  const L = b.log.slice(n0);
  const V = b.sides[1].active[0];
  return { weather, applied: L.filter(l => /^\|-status\|/.test(l)).map(l => l.split('|')[3]).sort(),
           alive: !V.fainted && V.hp > 0, lines: L };
}
const show = r => 'weather ' + JSON.stringify(r.weather) + '  statuses applied ' + JSON.stringify(r.applied)
  + '  target alive ' + r.alive;

/* ================================================================================================
 * 3 — CONTROL: no sun. This arm agreed BEFORE the fix and must still agree.
 * ============================================================================================= */
const clearM = runMedi(A_FRZ, false), clearS = runSD(A_FRZ, false);
console.log('\n  NO SUN    medi ' + show(clearM) + '\n            sd   ' + show(clearS));
ok(clearM.weather === '' && clearS.weather === '',
  'CONTROL — no weather was up in either engine on the hit turn',
  'medi ' + JSON.stringify(clearM.weather) + '   authority ' + JSON.stringify(clearS.weather));
ok(eq(clearM.applied, clearS.applied) && clearS.applied.includes(REFUSED),
  'CONTROL — with NO sun, the same click applies `' + REFUSED + '` in BOTH engines',
  'medi ' + JSON.stringify(clearM.applied) + '   authority ' + JSON.stringify(clearS.applied));

/* ================================================================================================
 * 4/6/7 — the sun.
 * ============================================================================================= */
const sunM = runMedi(A_FRZ, true), sunS = runSD(A_FRZ, true);
console.log('\n  SUN UP    medi ' + show(sunM) + '\n            sd   ' + show(sunS));
ok(sunM.weather === Object.keys(AUTH)[0] && sunS.weather === Object.keys(AUTH)[0],
  'CONTROL — the sun really was up, read off each engine\'s own field',
  'medi ' + JSON.stringify(sunM.weather) + '   authority ' + JSON.stringify(sunS.weather));
ok(sunM.alive && sunS.alive,
  'CONTROL — the target was alive in both engines, so there was a body to freeze',
  'medi ' + sunM.alive + '   authority ' + sunS.alive);
ok(eq(sunM.applied, sunS.applied) && !sunS.applied.includes(REFUSED),
  'TEST — with the sun up, NEITHER engine applies `' + REFUSED + '`',
  'medi ' + JSON.stringify(sunM.applied) + '   authority ' + JSON.stringify(sunS.applied));

/* ================================================================================================
 * 5 — CONTROL: the sun refuses ONE status, not statuses. Without this arm a blanket "no status under
 * the sun" would read exactly like the fix.
 * ============================================================================================= */
if (A_OTH) {
  const oM = runMedi(A_OTH, true), oS = runSD(A_OTH, true);
  console.log('\n  SUN + ' + OTHER.st.toUpperCase() + '  medi ' + show(oM) + '\n            sd   ' + show(oS));
  ok(eq(oM.applied, oS.applied) && oS.applied.includes(OTHER.st),
    'CONTROL — with the sun up, `' + OTHER.st + '` still lands in BOTH engines',
    'medi ' + JSON.stringify(oM.applied) + '   authority ' + JSON.stringify(oS.applied));
} else {
  FIXTURE('no second secondary status is carried in this format — the "one status, not statuses" control is untested');
}

/* ================================================================================================
 * 8 — CONTROL: `effectiveWeather`, not `field.weather`. A suppressor on the field puts the freeze
 * back. Same fixture as arm 4; only the fourth body changes.
 * ============================================================================================= */
if (SUPP) {
  const spM = runMedi(A_FRZ, true, SUPP), spS = runSD(A_FRZ, true, SUPP);
  console.log('\n  SUPPRESSED medi ' + show(spM) + '\n            sd   ' + show(spS));
  ok(eq(spM.applied, spS.applied) && spS.applied.includes(REFUSED),
    'CONTROL — a `weatherSuppression` body on the field puts `' + REFUSED + '` BACK in both engines',
    'medi ' + JSON.stringify(spM.applied) + '   authority ' + JSON.stringify(spS.applied)
    + '   (' + SUPP.sp.name + ', ' + SUPP.ab + ')');
} else {
  FIXTURE('`weatherSuppression` has no buildable legal carrier — the effectiveWeather control is untested');
}

/* ================================================================================================
 * 9 — COUNTER. The clause must have RUN, not merely existed.
 * ============================================================================================= */
const C = MEDI.MEDSEEN || {}, F = MEDI.MEDFAILS || {};
ok((C.statusRefusedByWeatherCondition || 0) > 0,
  'COUNTER — the sky\'s own status refusal fired during this run',
  'statusRefusedByWeatherCondition='
  + (C.statusRefusedByWeatherCondition === undefined ? 'ABSENT' : C.statusRefusedByWeatherCondition)
  + '   weatherStatusFieldUnknown=' + (F.weatherStatusFieldUnknown === undefined ? 'ABSENT' : F.weatherStatusFieldUnknown)
  + (F.weatherStatusFieldUnknownFirst ? ' (' + F.weatherStatusFieldUnknownFirst + ')' : '')
  + '   statusRefusedByWeather[Leaf Guard]=' + (C.statusRefusedByWeather === undefined ? 'ABSENT' : C.statusRefusedByWeather));

/* ================================================================================================
 * THE KNOB.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename],
    { env: { ...process.env, MEDI_FRZ_IN_SUN: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const a = (out.match(/^ *(PASS|FAIL) *TEST — with the sun up.*$/m) || [''])[0].trim();
  const b2 = (out.match(/^ *(PASS|FAIL) *CONTROL — with NO sun.*$/m) || [''])[0].trim();
  ok(r.status !== 0,
    'KNOB — removing the sky\'s `onImmunity` REDS this probe',
    'child exit ' + r.status + '\n          ' + (a || '(no sun arm printed — the knob is not wired)')
    + '\n          ' + (b2 || '(no no-sun control printed)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
