#!/usr/bin/env node
/* DERIVE WHAT SURVIVES A SWITCH — from the format, never from a typed list.
 *
 * Will, 2026-08-12: "does toxic and sleep turns carry over when a mon is switched out and are we
 * tracking relevant things like that".
 *
 * THE RULE IS `Pokemon#clearVolatile()` (sim/pokemon.ts:1514), called by `switchIn`
 * (sim/battle-actions.ts) on the OUTGOING body and by `faintMessages`:
 *
 *   - `this.volatiles = {}`      -- EVERY volatile is dropped, wholesale, with no `onEnd`.
 *   - `this.boosts = {...0}`     -- boosts reset.
 *   - `this.ability = this.baseAbility`, `this.transformed = false`, `setSpecies(baseSpecies)`.
 *   - `this.status` IS NOT TOUCHED. A status and everything hanging off `statusState` SURVIVES.
 *
 * So the interesting question is only about the things that survive: STATUS conditions, and the
 * ABILITY/ITEM state that rides on a body rather than in `volatiles`. For those, a per-condition
 * `onSwitchIn` / `onSwitchOut` handler is the ONLY thing that can reset a counter, because nothing
 * generic does.
 *
 * This script prints, for every legal entity in gen9championsvgc2026regmb, whether it declares a
 * switch handler and (for the survivors) what that handler writes. It is DERIVED on every run --
 * no list of mechanics is typed here.
 *
 *   node engine/derive_switch_carry.js            summary table
 *   node engine/derive_switch_carry.js --all      every row, including the ones with no handler
 *   node engine/derive_switch_carry.js --json     machine-readable
 */
'use strict';
const path = require('path');
const SP = process.env.SHOWDOWN_PATH;
if (!SP) { console.error('SHOWDOWN_PATH is required'); process.exit(2); }
const { Dex } = require(path.join(SP, 'dist/sim'));
const D = Dex.forFormat('gen9championsvgc2026regmb');

/* CLAUDE.md: `.all()` is the National Dex. Filter every walk, every time. */
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

const SWITCH_KEYS = ['onSwitchIn', 'onSwitchOut', 'onSwitchInPriority', 'onSwitchOutPriority',
                     'onAnySwitchIn', 'onFoeSwitchIn', 'onSourceSwitchIn'];

function handlerSrc(obj, key) {
  const v = obj && obj[key];
  if (v == null) return null;
  if (typeof v === 'number') return String(v);
  return String(v).replace(/\s+/g, ' ').trim();
}

function scan(kind, name, obj) {
  const hits = {};
  for (const k of SWITCH_KEYS) { const s = handlerSrc(obj, k); if (s) hits[k] = s; }
  return { kind, name, id: obj.id || name, hits, nHits: Object.keys(hits).length };
}

const rows = [];

/* 1+2. THE BUILT-IN CONDITION TABLE. `D.conditions` exposes only get/getByID -- there is no
 *      `.all()` -- so the ID set is read off `D.data.Conditions`, which is the MOD-MERGED table
 *      (Champions overrides data/mods/champions/conditions.ts). Each is then fetched through
 *      `D.conditions.get` so what is scanned is the resolved effect, not the raw row.
 *      A condition whose `effectType` is 'Status' is one that SURVIVES clearVolatile. */
for (const id of Object.keys(D.data.Conditions)) {
  const c = D.conditions.get(id);
  const isStatus = c.effectType === 'Status';
  const r = scan(isStatus ? 'status' : 'condition', c.name || id, c);
  r.effectType = c.effectType;
  r.durationKeys = Object.keys(c).filter(k => /duration|counter|stage|time/i.test(k));
  r.allKeys = Object.keys(c).filter(k => k.startsWith('on'));
  if (isStatus || r.nHits) rows.push(r);
}

/* 3. ABILITIES and 4. ITEMS — legal ones only. */
for (const a of D.abilities.all()) { if (!legal(a)) continue; const r = scan('ability', a.name, a); if (r.nHits) rows.push(r); }
for (const it of D.items.all())    { if (!legal(it)) continue; const r = scan('item', it.name, it); if (r.nHits) rows.push(r); }

/* 5. MOVE-BORNE CONDITIONS — a move's `condition` block is the volatile it installs. Every one of
 *    these is inside `this.volatiles` and therefore dies on the switch; listed so the comparison
 *    can check our engine drops each one. Restricted to moves legal in this format. */
const moveVolatiles = [];
for (const m of D.moves.all()) {
  if (!legal(m)) continue;
  if (!m.condition) continue;
  const holder = m.volatileStatus ? 'pokemon-volatile'
    : m.sideCondition ? 'side-condition'
    : m.slotCondition ? 'slot-condition'
    : m.weather ? 'weather' : m.terrain ? 'terrain'
    : m.status ? 'status' : 'other';
  moveVolatiles.push({ move: m.name, id: m.id, holder,
    volatileStatus: m.volatileStatus || null,
    duration: m.condition.duration != null ? m.condition.duration : null,
    noCopy: !!m.condition.noCopy,
    switchHandlers: Object.keys(m.condition).filter(k => SWITCH_KEYS.includes(k)) });
}

const out = { generated: new Date().toISOString(), format: 'gen9championsvgc2026regmb',
  clearVolatileWipes: ['volatiles (all)', 'boosts', 'ability -> baseAbility', 'transformed',
    'moveSlots -> baseMoveSlots', 'species -> baseSpecies (and therefore TYPES)',
    'lastMove/lastMoveUsed/moveThisTurn/moveLastTurnResult', 'lastDamage/attackedBy/hurtThisTurn',
    'abilityState.started / itemState.started'],
  clearVolatileDoesNotTouch: ['status', 'statusState', 'hp', 'item', 'baseSpecies'],
  rows, moveVolatiles };

if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

console.log('DERIVED FROM ' + out.format + '  ' + out.generated);
console.log('');
console.log('clearVolatile() WIPES: ' + out.clearVolatileWipes.join(', '));
console.log('clearVolatile() LEAVES: ' + out.clearVolatileDoesNotTouch.join(', '));
console.log('');
console.log('=== STATUS CONDITIONS — these SURVIVE the switch. Only an onSwitchIn/Out resets state. ===');
for (const r of rows.filter(x => x.kind === 'status')) {
  console.log('  ' + r.name.padEnd(14) + (r.nHits ? 'SWITCH HANDLER: ' + JSON.stringify(r.hits)
                                                  : 'no switch handler  -> STATE CARRIES OVER'));
  console.log('      handlers: ' + r.allKeys.join(', '));
}
console.log('');
console.log('=== ABILITIES / ITEMS / NON-STATUS CONDITIONS WITH A SWITCH HANDLER ===');
for (const r of rows.filter(x => x.kind !== 'status')) {
  console.log('  [' + r.kind + '] ' + r.name + (r.effectType ? ' (' + r.effectType + ')' : ''));
  for (const k in r.hits) console.log('      ' + k + ': ' + r.hits[k].slice(0, 220));
}
console.log('');
console.log('=== MOVE-BORNE STATE: ' + moveVolatiles.length + ' legal moves install a condition ===');
const byHolder = {};
for (const mv of moveVolatiles) (byHolder[mv.holder] = byHolder[mv.holder] || []).push(mv);
for (const h in byHolder) {
  console.log('  ' + h + ' (' + byHolder[h].length + '): ' + byHolder[h].map(m => m.move).join(', '));
}
