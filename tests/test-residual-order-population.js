/* THE RESIDUAL ORDER TABLE MUST BE THE POPULATION, NOT A SUBSET — ROADMAP #242.
 *
 * `engine/residual_order.js` published 42 rows and called them "every effect in this format carrying
 * a residual handler". That sentence was true. The FILE NAME was not: the thing it is consumed as is
 * the order of the authority's end-of-turn walk, and `Battle#fieldEvent` collects that walk on two
 * keys — a residual handler OR a live `duration`. Tailwind, Trick Room, the screens, Safeguard and
 * forty-odd others were in the authority's walk and absent from the table derived to describe it.
 *
 * `tests/test-residual-order-observed.js` already stages a turn and checks the CHIPS come out in the
 * table's order. It could not have caught this, and that is the point worth writing down: it only
 * ever looked at effects the table already contained, so a table that omitted a whole class of
 * participants agreed with it perfectly. A check that watches a copy of the population cannot report
 * that the population is short.
 *
 * SO THIS FILE ASKS THE AUTHORITY FOR ITS OWN LIST. It stages one battle with as many families live
 * at once as it can arrange, calls `findSideEventHandlers` / `findFieldEventHandlers` /
 * `findPokemonEventHandlers` with the SAME `getKey: 'duration'` that `fieldEvent` passes, and asserts
 * that every handler that comes back has a row — and that the row's `order` and `subOrder` equal the
 * ones `resolvePriority` just produced on the live object. Nothing here re-implements the sort rule;
 * a disagreement is the table's, never this file's.
 *
 * IT ALSO WALKS ONE RESIDUAL AND READS THE EXPIRIES OUT OF `battle.log`, because "the row exists" and
 * "the line lands in that position" are different claims and ENGINE consumes the second one.
 *
 *   SHOWDOWN_PATH=... node tests/test-residual-order-population.js
 *   SHOWDOWN_PATH=... node tests/test-residual-order-population.js --verbose
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const SHOWDOWN = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const { Battle, Teams, Dex } = require(path.join(SHOWDOWN, 'dist', 'sim'));
const TABLE = require(D('engine', 'residual_order.js'));
const FORMAT = TABLE.FORMAT;
const DEX = Dex.forFormat(FORMAT);
const VERBOSE = process.argv.includes('--verbose');

let fails = 0, checks = 0;
const ok = (cond, label, extra) => { checks++;
  if (cond) { console.log('  ok    ' + label + (extra ? '   (' + extra + ')' : '')); return true; }
  fails++; console.log('  FAIL  ' + label + (extra ? '   (' + extra + ')' : '')); return false; };

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => !!x && x.exists && !x.isNonstandard;
const ROWS = TABLE.rows;
const rowAt = (id, site) => ROWS.find(r => r.id === norm(id) && r.site === site);

console.log('RESIDUAL ORDER — IS THE TABLE THE POPULATION?');
console.log('  format : ' + FORMAT);
console.log('  table  : ' + ROWS.length + ' walk participants   ' + JSON.stringify(TABLE.population.byRoute));

/* ---- 0. a published key may never collide ------------------------------------------------------
 * medicham2 builds `new Map(rows.map(r => [r.ns + ':' + r.id, r]))`. A duplicate key does not throw;
 * the last row silently wins and the first disappears, so a step can be MISPLACED while still
 * reporting itself placed. This happened during the fix for #242 itself (Grassy Terrain's heal at
 * order 5 and its expiry at order 27 both wanted `field:grassyterrain`). */
{
  const seen = new Map(), dup = [];
  for (const r of ROWS) { const k = r.ns + ':' + r.id;
    if (seen.has(k)) dup.push(k + ' [' + seen.get(k).site + ' | ' + r.site + ']'); seen.set(k, r); }
  ok(dup.length === 0, 'no two rows share a published ns:id key', dup.join(', ') || ROWS.length + ' distinct keys');
}

/* ---- 1. the published artifact must equal what the generator produces now -----------------------
 * medicham2 reads `data/residual-order.json`, not this module. A corrected generator that was never
 * re-run leaves the consumer on the old table, which is the staleness this project keeps paying for. */
{
  let art = null;
  try { art = JSON.parse(fs.readFileSync(D('data', 'residual-order.json'), 'utf8')); } catch (e) { /* below */ }
  ok(!!art, 'data/residual-order.json exists');
  if (art) {
    const key = r => [r.ns, r.id, r.site, r.order, r.subOrder, r.route].join('|');
    const a = (art.rows || []).map(key).sort().join('\n');
    const b = ROWS.map(key).sort().join('\n');
    ok(a === b, 'the published artifact matches the generator (run `node engine/residual_order.js --write`)',
       (art.rows || []).length + ' published vs ' + ROWS.length + ' derived');
  }
}

/* ---- 2. an INDEPENDENT lower bound on the population --------------------------------------------
 * Deliberately a cruder walk than the generator's, so it is not the same derivation checking itself:
 * every id a legal move names as a side condition / pseudo-weather / terrain / weather / volatile /
 * slot condition, that resolves to a condition carrying a `duration`, is in the authority's walk. If
 * this file ever drifts back to enumerating by handler alone, this clause fails by name. */
{
  const named = new Set();
  for (const mv of DEX.moves.all()) {
    if (!legal(mv)) continue;
    for (const v of [mv.sideCondition, mv.pseudoWeather, mv.terrain, mv.weather, mv.volatileStatus,
                     mv.slotCondition, mv.self && mv.self.sideCondition, mv.self && mv.self.volatileStatus])
      if (v) named.add(norm(v));
  }
  const missing = [];
  for (const id of named) {
    const c = DEX.conditions.getByID(id);
    if (!c || !c.exists || !(c.duration || c.durationCallback)) continue;
    if (!ROWS.some(r => r.id === id && r.expiresInWalk)) missing.push(id);
  }
  const bound = [...named].filter(id => { const c = DEX.conditions.getByID(id);
    return c && c.exists && (c.duration || c.durationCallback); }).length;
  ok(missing.length === 0,
     'every duration-carrying condition a legal move can apply has an expiring row',
     missing.length ? 'MISSING: ' + missing.join(', ') : bound + ' checked, all present');
}

/* ---- 3. the fixture ------------------------------------------------------------------------------
 * Bodies are SEARCHED FOR in the legal species list, never named: a fixture naming a body this format
 * does not contain makes the whole result unusable, and `.all()` is the National Dex until filtered.
 * The chip-taker must not be Rock/Ground/Steel or carry an ability that refuses sand, or the most
 * load-bearing line in the walk silently never appears. */
const species = DEX.species.all().filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal');
const chipable = s => !s.types.some(t => ['Rock', 'Ground', 'Steel'].includes(t))
  && !Object.values(s.abilities).some(a => /Magic Guard|Sand Veil|Sand Rush|Sand Force|Overcoat/i.test(a));
const pick = (pred, why, taken) => { const s = species.find(x => pred(x) && !taken.includes(x.name));
  if (!s) throw new Error('COULD NOT STAGE: no legal species satisfies ' + why
    + ' — that is a claim about the fixture, never about the mechanic.'); return s; };
const taken = [];
const bodies = [];
for (let i = 0; i < 4; i++) {
  const s = pick(x => chipable(x) && x.baseStats.hp >= 60, 'a sand-chippable body with some bulk', taken);
  taken.push(s.name); bodies.push(s);
}
const ab = s => Object.values(s.abilities).find(a => !/Magic Guard|Overcoat|Sand/i.test(a)) || s.abilities[0];
const set = (s, item) => ({ name: s.name, species: s.name, item: item || '', ability: ab(s), gender: 'N',
  moves: ['Protect'], evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });

const battle = new Battle({ formatid: FORMAT, seed: [1, 2, 3, 4] });
battle.setPlayer('p1', { name: 'A', team: Teams.pack([set(bodies[0], 'Leftovers'), set(bodies[1], 'Leftovers')]) });
battle.setPlayer('p2', { name: 'B', team: Teams.pack([set(bodies[2], 'Leftovers'), set(bodies[3], 'Leftovers')]) });
if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1, 2'); battle.choose('p2', 'team 1, 2'); }
const p1a = battle.p1.active[0], p1b = battle.p1.active[1];
const p2a = battle.p2.active[0], p2b = battle.p2.active[1];

/* Everything that can be staged, staged through the authority's OWN methods so nothing here invents a
 * mechanic. **The ids come from the MOVES, never from the table.** That was wrong in the first draft
 * and the deliberate break exposed it: staging `ROWS.filter(site === 'side')` means a table that has
 * dropped every side condition also stages no side condition, so the membership clause under-reports
 * exactly when it matters most. A fixture drawn from the thing it is auditing cannot audit it. */
const staged = [], refused = [];
const NAMED = { side: new Set(), pseudoweather: new Set(), volatile: new Set() };
for (const mv of DEX.moves.all()) {
  if (!legal(mv)) continue;
  for (const v of [mv.sideCondition, mv.self && mv.self.sideCondition]) if (v) NAMED.side.add(norm(v));
  if (mv.pseudoWeather) NAMED.pseudoweather.add(norm(mv.pseudoWeather));
  for (const v of [mv.volatileStatus, mv.self && mv.self.volatileStatus]) if (v) NAMED.volatile.add(norm(v));
  for (const sec of (mv.secondaries || [])) if (sec.volatileStatus) NAMED.volatile.add(norm(sec.volatileStatus));
  /* A move's own `.condition` is a VOLATILE only when the move does not attach it somewhere else —
   * that is how Fly, Dig, Dive, Bounce and Phantom Force reach the walk. Without this guard the
   * fixture called `addVolatile('tailwind')` and the authority obligingly hung a side condition on a
   * body, a board no real battle can reach, and then reported the table was missing a row for it. */
  if (mv.condition && !mv.sideCondition && !mv.pseudoWeather && !mv.terrain && !mv.weather
      && !mv.slotCondition && !mv.status) NAMED.volatile.add(mv.id);
}
const trySide = (side, id, src) => { try { if (side.addSideCondition(id, src)) staged.push('side:' + id);
  else refused.push('side:' + id); } catch (e) { refused.push('side:' + id + ' (' + e.message + ')'); } };
const tryVol = (mon, id, src) => { try { if (mon.addVolatile(id, src || mon)) staged.push('vol:' + id);
  else refused.push('vol:' + id); } catch (e) { refused.push('vol:' + id + ' (' + e.message + ')'); } };
const tryField = (id, src) => { try { if (battle.field.addPseudoWeather(id, src)) staged.push('field:' + id);
  else refused.push('field:' + id); } catch (e) { refused.push('field:' + id + ' (' + e.message + ')'); } };

const durish = id => { const c = DEX.conditions.getByID(id); return c && c.exists && (c.duration || c.durationCallback); };
for (const id of NAMED.side) if (durish(id)) trySide(battle.p1, id, p1a);
for (const id of NAMED.pseudoweather) if (durish(id)) tryField(id, p1a);
battle.field.setWeather('sandstorm', p2a); staged.push('weather:sandstorm');
battle.field.setTerrain('grassyterrain', p2a); staged.push('terrain:grassyterrain');
/* Pokemon volatiles are spread across the four bodies so that speed, not slot, separates them —
 * the term the sort key puts BETWEEN order and subOrder. */
[...NAMED.volatile].filter(durish).forEach((id, i) =>
  tryVol([p1a, p1b, p2a, p2b][i % 4], id, [p2a, p2b, p1a, p1b][i % 4]));
p2a.setStatus('psn'); staged.push('status:psn');
p1b.setStatus('brn'); staged.push('status:brn');
for (const m of [p1a, p1b, p2a, p2b]) m.hp = Math.max(1, Math.floor(m.maxhp * 0.6));

console.log('\n  staged : ' + staged.length + ' effects   refused: ' + refused.length);
if (VERBOSE) { console.log('    ' + staged.join(', ')); if (refused.length) console.log('    refused -> ' + refused.join(', ')); }

/* ---- 4. THE AUTHORITY'S OWN COLLECTORS, WITH THE SAME getKey `fieldEvent` PASSES ----------------- */
const live = [];
const siteOfPokemonHandler = (mon, h) => {
  if (h.state === mon.statusState) return 'status';
  if (h.state === mon.abilityState) return 'ability';
  if (h.state === mon.itemState) return 'item';
  if (h.state === mon.speciesState) return 'species';
  for (const id in mon.volatiles) if (mon.volatiles[id] === h.state) return 'volatile';
  for (const id in mon.side.slotConditions[mon.position]) {
    if (mon.side.slotConditions[mon.position][id] === h.state) return 'slot';
  }
  return 'UNKNOWN';
};
for (const side of battle.sides) {
  for (const h of battle.findSideEventHandlers(side, 'onSideResidual', 'duration')) live.push({ h, site: 'side' });
}
for (const h of battle.findFieldEventHandlers(battle.field, 'onFieldResidual', 'duration')) {
  const id = h.effect.id;
  const site = battle.field.pseudoWeather[id] ? 'pseudoweather'
             : battle.field.terrain === id ? 'terrain' : 'weather';
  live.push({ h, site });
}
for (const mon of [p1a, p1b, p2a, p2b]) {
  for (const h of battle.findPokemonEventHandlers(mon, 'onResidual', 'duration')) {
    live.push({ h, site: siteOfPokemonHandler(mon, h) });
  }
  live.push(...battle.findSideEventHandlers(mon.side, 'onResidual', undefined, mon).map(h => ({ h, site: 'side@active' })));
  live.push(...battle.findFieldEventHandlers(battle.field, 'onResidual', undefined, mon).map(h => ({ h, site: 'field@active' })));
}

ok(!live.some(x => x.site === 'species'),
   'no legal species owns onResidual — the walk has no species participant this table would have to carry',
   live.filter(x => x.site === 'species').map(x => x.h.effect.id).join(',') || 'confirmed');
ok(!live.some(x => x.site === 'UNKNOWN'), 'every live handler was traced to an attachment site',
   live.filter(x => x.site === 'UNKNOWN').map(x => x.h.effect.id).join(',') || 'all traced');

const unrowed = [], mismatched = [];
const covered = new Set();
for (const { h, site } of live) {
  if (site === 'species' || site === 'UNKNOWN') continue;
  const r = rowAt(h.effect.id, site);
  if (!r) { unrowed.push(site + ':' + h.effect.id); continue; }
  covered.add(r.ns + ':' + r.id);
  const liveOrder = h.order === false ? null : h.order;
  if (liveOrder !== r.order || h.subOrder !== r.subOrder) {
    mismatched.push(site + ':' + h.effect.id + '  live ' + liveOrder + '/' + h.subOrder
      + '  table ' + r.order + '/' + r.subOrder);
  }
}
console.log('\n  the authority handed back ' + live.length + ' residual handlers from the staged board;'
  + ' ' + covered.size + ' distinct table rows were exercised.');
ok(unrowed.length === 0, 'EVERY handler the authority collects has a row in the table',
   unrowed.length ? 'NOT IN THE TABLE: ' + unrowed.join(', ') : covered.size + ' rows matched');
ok(mismatched.length === 0, 'every row\'s (order, subOrder) equals what resolvePriority just produced live',
   mismatched.length ? mismatched.join(' | ') : 'all agree');

/* ---- 5. AND THE LINES LAND WHERE THE TABLE SAYS -------------------------------------------------
 * The rows above prove membership and keys. This proves the consequence ENGINE has to reproduce: the
 * expiry announcements interleave with the chips at their sorted position, they are not a separate
 * pass before or after the walk.
 *
 * THE BOARD IS REBUILT FIRST, and the reason is a finding rather than housekeeping. Step 4 stages
 * EVERY volatile that can expire, and that set contains Heal Block — which suppresses Leftovers and
 * the Grassy Terrain heal on whichever body it lands on. Walking that board produced no `-heal` line
 * at all, so the sequence assertions below had nothing to compare and reported -1. A fixture that
 * silently removes the effect it is measuring is the same shape as the defect this whole file exists
 * to catch, so the maximal board is used for MEMBERSHIP and a clean board for SEQUENCE. */
for (const mon of [p1a, p1b, p2a, p2b]) {
  for (const id of Object.keys(mon.volatiles)) mon.removeVolatile(id);
  mon.clearStatus();
}
for (const id of Object.keys(battle.field.pseudoWeather)) battle.field.removePseudoWeather(id);
for (const side of battle.sides) for (const id of Object.keys(side.sideConditions)) side.removeSideCondition(id);
/* TEARING DOWN A VOLATILE IS NOT FREE, and one of them kills. `removeVolatile('perishsong')` fires the
 * condition's own `onEnd`, which faints the holder — so the body that happened to receive Perish Song
 * in the maximal board leaves the clean board dead. Reported, and the sequence bodies are chosen from
 * whoever survived, because a fixture that quietly loses a body is how a walk ends up shorter than the
 * claim made about it. */
/* AND THE FAINT IS QUEUED, NOT IMMEDIATE — `pokemon.faint()` pushes onto `battle.faintQueue` and the
 * body keeps `fainted === false` until something flushes it. The first version of this teardown read
 * `m.fainted` straight after removing the volatiles, saw four live bodies, poisoned one that was
 * already dead, and the walk emitted `-heal` then `|faint|` for it and no poison chip at all. The
 * clause below then failed on a psn that never happened. So the queue is flushed FIRST and the
 * survivors are read after. */
battle.faintMessages();
const alive = [p1a, p1b, p2a, p2b].filter(m => !m.fainted && m.hp > 0);
const foesAlive = alive.filter(m => m.side === battle.p2);
ok(!p1a.fainted && foesAlive.length >= 1,
   'the sequence board has p1a and at least one foe alive after teardown',
   'alive: ' + alive.map(m => m.name).join(', ') + (alive.length < 4 ? '  (teardown fainted '
     + [p1a, p1b, p2a, p2b].filter(m => m.fainted).map(m => m.name).join(', ') + ')' : ''));
for (const mon of alive) mon.hp = Math.max(1, Math.floor(mon.maxhp * 0.6));
battle.field.setWeather('sandstorm', foesAlive[0]);
battle.field.setTerrain('grassyterrain', foesAlive[0]);
battle.p1.addSideCondition('tailwind', p1a);
battle.p1.addSideCondition('lightscreen', p1a);
battle.field.addPseudoWeather('trickroom', p1a);
p1a.addVolatile('taunt', foesAlive[0]);
foesAlive[0].setStatus('psn');
if (foesAlive[1]) foesAlive[1].setStatus('brn');
/* Durations forced to 1 so that this ONE walk is the turn each of them expires. Set on the state the
 * authority owns, not on the dex entry, so nothing here changes what the next test sees. */
battle.field.weatherState.duration = 1;
battle.p1.sideConditions.tailwind.duration = 1;
battle.p1.sideConditions.lightscreen.duration = 1;
battle.field.pseudoWeather.trickroom.duration = 1;
p1a.volatiles.taunt.duration = 1;

const before = battle.log.length;
battle.fieldEvent('Residual');
const walk = battle.log.slice(before).map(String);
if (VERBOSE) { console.log('\n  --- one residual walk ---'); walk.forEach(l => console.log('    ' + l)); }

const CAUSE = [
  [/\|-weather\|none/, 'weather-expiry'],
  [/\[from\]\s*item:\s*Leftovers/i, 'leftovers'],
  [/\[from\]\s*psn/, 'psn'],
  [/\[from\]\s*brn/, 'brn'],
  [/\[from\]\s*Grassy Terrain/i, 'grassyterrain-heal'],
  [/\|-sideend\|/, 'sideend'],
  [/\|-fieldend\|/, 'fieldend'],
];
const seq = [];
for (const l of walk) for (const [re, tag] of CAUSE) if (re.test(l)) { seq.push({ tag, l }); break; }
const first = tag => seq.findIndex(s => s.tag === tag);
const pos = { weather: first('weather-expiry'), terrain: first('grassyterrain-heal'),
              lefto: first('leftovers'), psn: first('psn'), side: first('sideend'), field: first('fieldend') };
console.log('\n  observed positions: ' + JSON.stringify(pos));

const orderOf = (ns, id) => { const r = ROWS.find(x => x.ns === ns && x.id === id); return r ? r.order : null; };
ok(pos.weather >= 0 && pos.lefto > pos.weather,
   'the weather expiry (order ' + orderOf('field', 'sandstorm') + ') precedes Leftovers (order '
   + orderOf('item', 'leftovers') + ')', 'weather@' + pos.weather + ' leftovers@' + pos.lefto);
/* NOT A PAIRWISE CLAIM, AND THE FIRST DRAFT MADE IT ONE AND WAS RIGHT ONLY BY LUCK. Grassy Terrain's
 * heal (subOrder 2) and Leftovers (subOrder 4) share order 5, and within one order the authority
 * separates them by the SPEED of the body carrying each — subOrder is not consulted until speeds tie.
 * So a fast body's Leftovers legitimately precedes a slow body's terrain heal, and asserting
 * `terrain before leftovers` reproduces ROADMAP #221's own title error inside the test written to
 * catch it. What is actually true is GROUP MEMBERSHIP: both belong to order 5, so every one of their
 * events lies between the order-1 weather expiry and the order-9 poison chip. */
const inGroup5 = seq.map((s, i) => ({ s, i })).filter(x => x.s.tag === 'grassyterrain-heal' || x.s.tag === 'leftovers');
ok(pos.terrain >= 0 && inGroup5.length > 0
   && inGroup5.every(x => x.i > pos.weather && x.i < pos.psn),
   'the Grassy Terrain heal and Leftovers form ONE order-' + orderOf('field', 'grassyterrain')
   + ' group between the weather expiry and the status chips — the heal is NOT at the terrain\'s '
   + 'expiry order ' + orderOf('expiry', 'grassyterrain'),
   inGroup5.length + ' events at [' + inGroup5.map(x => x.i).join(',') + '], weather@' + pos.weather
   + ' psn@' + pos.psn);
ok(pos.side > pos.lefto && pos.side > pos.psn,
   'every `-sideend` lands AFTER the Leftovers group and AFTER the status chips — order '
   + orderOf('expiry', 'tailwind') + ', not a pre-pass',
   'sideend@' + pos.side + ' leftovers@' + pos.lefto + ' psn@' + pos.psn);
ok(pos.field > pos.side,
   'every `-fieldend` (order ' + orderOf('expiry', 'trickroom') + ') lands after every `-sideend` (order '
   + orderOf('expiry', 'tailwind') + ')', 'fieldend@' + pos.field + ' sideend@' + pos.side);

/* Announcement: a row that claims it announces must have produced a line, and a row that claims it is
 * silent must not have. The silent ones are the half that is easy to leave out of an engine, because
 * nothing in a log ever shows them — they only ever move something ELSE by one position. */
const announced = new Set();
for (const l of walk) {
  const m = /\|(-end|-sideend|-fieldend)\|[^|]*\|(?:move:\s*)?([^|]+)/.exec(l);
  if (m) announced.add(norm(m[2]));
  if (/\|-weather\|none/.test(l)) announced.add('sandstorm');
}
const claimedAnnouncing = ROWS.filter(r => r.announces && staged.some(s => s.endsWith(':' + r.id)));
const silentClaim = ROWS.filter(r => r.expiresInWalk && !r.announces && staged.some(s => s.endsWith(':' + r.id)));
const brokePromise = silentClaim.filter(r => announced.has(r.id));
ok(brokePromise.length === 0, 'no row marked SILENT produced a protocol line',
   brokePromise.map(r => r.id).join(', ') || silentClaim.length + ' silent rows staged, none spoke');
console.log('  note  ' + claimedAnnouncing.length + ' staged rows claim to announce; ' + announced.size
  + ' distinct effects announced on the one turn their durations happened to reach zero. '
  + 'A row that did not expire this turn cannot speak, so this is reported and not asserted.');

console.log('\n' + (fails ? 'FAILED: ' + fails + ' of ' + checks
  : 'ALL GREEN — ' + checks + ' checks. The table is the population the authority walks.'));
process.exitCode = fails ? 1 : 0;
