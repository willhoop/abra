#!/usr/bin/env node
/* tests/probe_regmc_binding_band.js — AN ITEM THAT DEEPENS ITS HOLDER'S PARTIAL TRAP (BINDING BAND), UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.30.0).
 *
 *   node tests/probe_regmc_binding_band.js --regulation regmc                                  # green, exit 0
 *   MEDI_TRAP_CHIP_ITEM_BLIND=1 node tests/probe_regmc_binding_band.js --regulation regmc      # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/conditions.ts partiallytrapped (read from the dist dex):
 *       onStart(pokemon, source) { ...; this.effectState.boundDivisor = source.hasItem("bindingband") ? 6 : 8; }
 *       onResidual(pokemon) { ...; this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor); }
 *   The TRAPPER's item, read when the trap lands. The move's `partialTrap` tag carries it as `chipItem {item,
 *   chipPerTurn}` (engine/tag_dex.js); the item is read from there, never typed.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   BAND      the trapper holds the item: the residual chip is a sixth, turn after turn.
 *   CONTROL   no item: an eighth.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_binding_band', ['MEDI_TRAP_CHIP_ITEM_BLIND']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, sure, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const TRAPS = Object.keys(TAGS.moves).filter(m => { const p = (TAGS.moves[m].params || {}).partialTrap;
  return p && p.chipItem && p.chipItem.item && K.legal(D.moves.get(m)) && K.legal(D.items.get(p.chipItem.item)); });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     partial traps whose chip item is legal: ' + TRAPS.map(m => m + ' ' + JSON.stringify(TAGS.moves[m].params.partialTrap.chipItem)).join('; '));
if (!TRAPS.length) { console.log('  NOT STAGED — no legal chip item'); process.exit(1); }
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const again = s => ['swordsdance', 'nastyplot', 'agility'].map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)) || null;
const KEEP = /^\|(-damage|-activate|-end|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({}));

let BD = null, CT = null;
outer: for (const mvId of TRAPS) {
  const mv = D.moves.get(mvId), item = D.items.get(TAGS.moves[mvId].params.partialTrap.chipItem.item);
  if (!sure(mv) || mv.target !== 'normal') continue;
  for (const u of SPEC.filter(s => quiet(s) && learns(s, mvId) && learns(s, 'protect') && again(s))) {
    const used = new Set([u.baseSpecies, u.id]);
    /* the target takes the move (not immune), is bulky, not Ghost (the trap's immunity) and can repeat a harmless click */
    const tgt = FILL.find(s => !used.has(s.baseSpecies) && !s.types.includes('Ghost') && D.getImmunity(mv.type, s) && again(s));
    if (!tgt) continue; used.add(tgt.baseSpecies);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies) && again(s)), used, 4);
    if (fills.length < 4) continue;
    const g = s => again(s).name, idle = s => ({ m: again(s).id });
    const A = it => [mon(u, it, [mv.name, g(u)]), mon(fills[0], '', [g(fills[0])]), mon(fills[1], '', [g(fills[1])]), mon(fills[3], '', [g(fills[3])])];
    const B = [mon(tgt, '', [g(tgt)]), mon(fills[2], '', [g(fills[2])]), mon(fills[3], '', [g(fills[3])]), mon(fills[1], '', [g(fills[1])])];
    const rest = { p1: [idle(u), idle(fills[0])], p2: [idle(tgt), idle(fills[2])] };
    const script = [{ p1: [{ m: mvId, t: 0 }, idle(fills[0])], p2: [idle(tgt), idle(fills[2])] }, rest];
    const b = play('band', A(item.name), B, script);
    if (!b.staged) { console.log('   (skip ' + u.id + ': ' + b.why + ')'); continue; }
    const c = play('control', A(''), B, script);
    if (!c.staged) continue;
    b.cast = u.id + ' @ ' + item.name + ' --' + mvId + '--> ' + tgt.id; c.cast = u.id + ' (no item) --' + mvId + '--> ' + tgt.id;
    BD = b; CT = c; break outer;
  }
}
const RUNS = [['BAND', BD], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const chips = R => R.sdK.filter(l => /^\|-damage\|p2a:.*\[partiallytrapped\]/.test(l)).length;
ok(chips(BD) === 2 && chips(CT) === 2, 'both arms chip the target at both residuals');

K.compareArms(RUNS, /^\|-damage\|/, '-damage');
K.finish();
