#!/usr/bin/env node
/* tests/probe_regmc_terrain_extender.js — AN ITEM THAT LENGTHENS ITS HOLDER'S TERRAIN (TERRAIN EXTENDER), UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.29.0).
 *
 *   node tests/probe_regmc_terrain_extender.js --regulation regmc                                    # green, exit 0
 *   MEDI_TERRAIN_FIVE_ALWAYS=1 node tests/probe_regmc_terrain_extender.js --regulation regmc         # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   Each terrain's condition, data/moves.ts (electricterrain :4511, grassyterrain :7687, mistyterrain :12165,
 *   psychicterrain :14109):   durationCallback(source, effect) { if (source?.hasItem('terrainextender')) return 8; return 5; }
 *   The SOURCE is whoever set it -- the move's user, or the Surge ability's holder on entry. The item is found by its TAG
 *   (`extendsDuration` naming the terrains), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   MOVE      the holder clicks a terrain move on turn 1; the terrain clock is compared at every boundary.
 *   ABILITY   a Surge-ability holder leads holding the item; the clock is compared at every boundary.
 *   CONTROL   the MOVE arm with no item.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_terrain_extender', ['MEDI_TERRAIN_FIVE_ALWAYS']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const tid = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const EXT = Object.keys(TAGS.items).filter(i => { const p = (TAGS.items[i].params || {}).extendsDuration;
  return p && (p.extends || []).some(x => /terrain$/.test(tid(x))) && K.legal(D.items.get(i)); });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     items that extend a terrain: ' + EXT.map(i => i + ' ' + JSON.stringify(TAGS.items[i].params.extendsDuration)).join('; '));
if (!EXT.length) { console.log('  NOT STAGED — no legal item extends a terrain'); process.exit(1); }
const ITEM = D.items.get(EXT[0]);
const TMOVES = D.moves.all().filter(m => K.legal(m) && m.terrain && m.target === 'all');
const SURGE = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].params || {}).terrainSetter);
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
/* a click the bodies can repeat without touching the field or HP */
const again = s => ['swordsdance', 'nastyplot', 'agility'].map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)) || null;
const KEEP = /^\|(-fieldstart|-fieldend|-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({}));

let MV = null, AB = null, CT = null;
/* MOVE + CONTROL */
outer: for (const tm of TMOVES) for (const u of SPEC.filter(s => quiet(s) && learns(s, tm.id) && again(s))) {
  const used = new Set([u.baseSpecies, u.id]);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies) && again(s)), used, 5);
  if (fills.length < 5) continue;
  const g = s => again(s).name;
  const A = it => [mon(u, it, [tm.name, g(u)]), mon(fills[0], '', [g(fills[0])]), mon(fills[1], '', [g(fills[1])]), mon(fills[4], '', [g(fills[4])])];
  const B = [mon(fills[2], '', [g(fills[2])]), mon(fills[3], '', [g(fills[3])]), mon(fills[4], '', [g(fills[4])]), mon(fills[1], '', [g(fills[1])])];
  const idle = (s) => ({ m: again(s).id });
  const rest = { p1: [idle(u), idle(fills[0])], p2: [idle(fills[2]), idle(fills[3])] };
  const script = [{ p1: [{ m: tm.id }, idle(fills[0])], p2: [idle(fills[2]), idle(fills[3])] }, rest, rest];
  const r = play('move', A(ITEM.name), B, script);
  if (!r.staged) { console.log('   (skip ' + u.id + ': ' + r.why + ')'); continue; }
  const c = play('control', A(''), B, script);
  if (!c.staged) continue;
  r.cast = u.id + ' @ ' + ITEM.name + ' clicks ' + tm.id; c.cast = u.id + ' (no item) clicks ' + tm.id;
  MV = r; CT = c; break outer;
}
/* ABILITY */
outer2: for (const s of SPEC.filter(x => abil(x).some(a => SURGE.includes(a)) && again(x))) {
  const ab = abil(s).find(a => SURGE.includes(a));
  const used = new Set([s.baseSpecies, s.id]);
  const fills = pickDistinct(FILL.filter(x => !used.has(x.baseSpecies) && again(x)), used, 5);
  if (fills.length < 5) continue;
  const g = x => again(x).name, idle = x => ({ m: again(x).id });
  const A = [mon(s, ITEM.name, [g(s)], ab), mon(fills[0], '', [g(fills[0])]), mon(fills[1], '', [g(fills[1])]), mon(fills[4], '', [g(fills[4])])];
  const B = [mon(fills[2], '', [g(fills[2])]), mon(fills[3], '', [g(fills[3])]), mon(fills[4], '', [g(fills[4])]), mon(fills[1], '', [g(fills[1])])];
  const rest = { p1: [idle(s), idle(fills[0])], p2: [idle(fills[2]), idle(fills[3])] };
  const r = play('ability', A, B, [rest, rest]);
  if (!r.staged) { console.log('   (skip ' + s.id + ': ' + r.why + ')'); continue; }
  r.cast = s.id + ' [' + ab + '] @ ' + ITEM.name + ' leads';
  AB = r; break outer2;
}
const RUNS = [['MOVE', MV], ['ABILITY', AB], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
for (const [tag, R] of RUNS) ok(R.sdK.filter(l => /^\|-fieldstart\|/.test(l)).length === 1, tag + ' — the terrain starts once');

/* The move road's `-fieldstart` carries `[of] <user>` here and nothing on the authority (its `[from]`/`[of]` pair is
 * written only when the effect is an ability); the differential's reducer folds `[of]` (its first-divergence check above
 * reads none). Narration, recorded, and compared without the field. */
const noOf = l => l.replace(/\|\[of\][^|]*/g, '');
for (const [tag, R] of RUNS) ok(JSON.stringify(R.sdK.filter(l => /^\|-field(start|end)\|/.test(l)).map(noOf))
  === JSON.stringify(R.meK.filter(l => /^\|-field(start|end)\|/.test(l)).map(noOf)), tag + ' — the terrain starts and ends on the same lines (the `[of]` field aside)');
for (const [tag, R] of RUNS) ok(!R.div, tag + ' — no protocol divergence', R.div ? JSON.stringify(R.div) : null);
for (const [tag, R] of RUNS) ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary (the terrain clock is a board leaf)', R.boardDiffs ? R.boardDetail : null);
K.finish();
