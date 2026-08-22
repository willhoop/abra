/* switchin_order.js — THE ORDER ENTRY ABILITIES RESOLVE IN, ASKED OF THE FORMAT RATHER THAN TYPED.
 *
 *   SHOWDOWN_PATH=... node engine/switchin_order.js            print it
 *   SHOWDOWN_PATH=... node engine/switchin_order.js --write     write data/switchin-order.json
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `Battle#fieldEvent('SwitchIn', switchersIn)` (sim/battle.ts:484-567) collects every entering body's
 * handlers, `speedSort`s them, and walks the list. `speedSort` sorts on `Battle#comparePriority`
 * (:404-411), whose own doc comment numbers the keys:
 *
 *     1. Order, low to high (default last)
 *     2. Priority, high to low (default 0)
 *     3. Speed, high to low (default 0)
 *     4. SubOrder, low to high (default 0)
 *     5. EffectOrder, low to high (default 0)
 *
 * SPEED IS THE THIRD KEY, NOT THE FIRST. `resolvePriority` (:950-1017) fills key 2 from
 * `effect[callbackName + 'Priority']` — for this event, `onSwitchInPriority` — so an ability that
 * declares one resolves ahead of (or behind) every ability that does not, WHATEVER the speeds are.
 * `medicham2-browser.js` sorted entrants on speed alone and therefore could not produce the
 * authority's answer on any board holding one of these.
 *
 * IT IS CARD 5 OF `data/divergence-turns.json`. A double KO brings in Torkoal (Drought, base Speed 20)
 * and Sinistcha (Hospitality, base Speed 70) together:
 *     SHOWDOWN  |-weather|SunnyDay|[from] ability: Drought   then  |-heal|...|[from] ability: Hospitality
 *     MEDICHAM  |-heal|...|[from] ability: Hospitality       then  |-weather|sunnyday|[from] ability: drought
 * The authority ran the SLOWER body first, because Hospitality carries `onSwitchInPriority: -2`. No
 * speed-only sort can reach that.
 *
 * ================= WHY AN ARTIFACT AND NOT A TABLE IN THE ENGINE ================================
 *
 * The same argument `data/residual-order.json` makes, for the same reason: sixteen abilities declare
 * one of these numbers and typing sixteen numbers next to sixteen names is the shape CLAUDE.md
 * records going stale three separate times. This is DERIVED on every run, so a regulation that adds a
 * carrier — or a Champions mod that changes a number — arrives without anybody editing the engine.
 *
 * THE CHAMPIONS OVERRIDE IS CHECKED RATHER THAN ASSUMED, per row. `/data/mods/champions/abilities.ts`
 * is one of the eight files the mod overrides; `override` records whether the mod's own file carries a
 * row for the ability at all, so "Champions changes none of these" is a MEASUREMENT in the artifact
 * and not a sentence in a comment. `priority` itself is read off `Dex.forFormat(...)`, which is the
 * merged view, so the number is right either way.
 *
 * ================= WHAT IS AND IS NOT IN IT ======================================================
 *
 * Every ability that declares `onSwitchInPriority`, with the count of LEGAL carriers beside it —
 * `.all()` is the National Dex and is filtered here, per CLAUDE.md. A row with zero carriers is kept
 * rather than dropped: the consumer keys on the ABILITY, so a rotation that brings a Neutralizing Gas
 * body is served without a regeneration, and a reader can see that the derivation looked at it.
 *
 * ITEMS ARE NOT IN IT AND THAT IS DECLARED, NOT OVERLOOKED. `resolvePriority` gives an Ability
 * `subOrder` 7 and an Item `subOrder` 8, so items resolve below abilities at the same priority and
 * speed. EIGHT items declare `onSwitchInPriority` — Booster Energy, the four seeds, Room Service,
 * and the two orbs — and **every one of them is `isNonstandard: 'Past'`**, i.e. banned in this
 * regulation. The count is printed on every run and the LEGALITY of each is printed with it, so the
 * day a rotation makes one legal this file says so instead of staying quiet.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* THE MOD'S OWN FILE, READ AS TEXT, so "did Champions touch this ability" is answered from the file
 * that would have to change rather than from the merged dex (which cannot tell you where a value came
 * from). Absent file -> null, and the artifact says null rather than false. */
let modSrc = null;
try {
  modSrc = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
} catch (e) { modSrc = null; }
const modHas = id => (modSrc == null ? null : new RegExp('^\\t' + id + ':\\s*\\{', 'm').test(modSrc));

const carriers = {};
for (const s of dex.species.all().filter(legal)) {
  for (const k in s.abilities) {
    const a = dex.abilities.get(s.abilities[k]);
    (carriers[a.id] = carriers[a.id] || []).push(s.name);
  }
}

const rows = [];
for (const a of dex.abilities.all()) {
  const p = a.onSwitchInPriority;
  if (p === undefined || p === null) continue;
  rows.push({ id: a.id, name: a.name, priority: p,
              nonstandard: a.isNonstandard || null,
              championsOverride: modHas(a.id),
              carriers: (carriers[a.id] || []).sort() });
}
rows.sort((x, y) => (y.priority - x.priority) || (x.id < y.id ? -1 : 1));

/* THE ITEM CLAUSE, MEASURED RATHER THAN ASSERTED — see the header. Every one is expected to be
 * `Past`; the artifact carries the legality per row so the expectation is checkable and not a claim. */
const itemRows = dex.items.all()
  .filter(i => i.onSwitchInPriority !== undefined && i.onSwitchInPriority !== null)
  .map(i => ({ id: i.id, priority: i.onSwitchInPriority, nonstandard: i.isNonstandard || null,
               legal: !!legal(i) }));

const out = {
  what: 'every ability declaring onSwitchInPriority, the key Battle#comparePriority sorts BEFORE speed',
  generated: new Date().toISOString(),
  format: CS.FORMAT,
  source: 'Dex.forFormat(...).abilities.all() — onSwitchInPriority; carriers filtered to the regulation',
  declaring: rows.length,
  with_legal_carriers: rows.filter(r => r.carriers.length).length,
  items_declaring: itemRows.length,
  items_declaring_and_legal: itemRows.filter(i => i.legal).length,
  items: itemRows,
  rows,
};

for (const r of rows) {
  console.log(String(r.priority).padStart(3) + '  ' + r.id.padEnd(20)
    + 'championsOverride=' + r.championsOverride
    + '  carriers=' + r.carriers.length + '  ' + r.carriers.slice(0, 6).join(', '));
}
console.log('\n' + rows.length + ' abilities declare onSwitchInPriority; '
  + out.with_legal_carriers + ' have a legal carrier in ' + CS.FORMAT);
console.log(itemRows.length + ' ITEMS declare one, ' + out.items_declaring_and_legal
  + ' of them legal here — the engine models none, and THAT number is why: '
  + itemRows.map(i => i.id + '(' + (i.nonstandard || 'LEGAL') + ')').join(', '));

if (process.argv.includes('--write')) {
  fs.writeFileSync(D('data', 'switchin-order.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('\nwrote data/switchin-order.json');
}
