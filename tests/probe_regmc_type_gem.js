#!/usr/bin/env node
/* tests/probe_regmc_type_gem.js — A TYPE GEM (NORMAL GEM), UNDER REG M-C. 2026-09-22 (abra/regmc 0.31.0).
 *
 *   node tests/probe_regmc_type_gem.js --regulation regmc                          # green, exit 0
 *   MEDI_TYPE_GEM_INERT=1 node tests/probe_regmc_type_gem.js --regulation regmc    # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts normalgem: onSourceTryPrimaryHit(target, source, move) { if (target === source || move.category ===
 *   'Status' || move.flags['pledgecombo']) return; if (move.type === 'Normal' && source.useItem()) source.addVolatile('gem'); }
 *   data/conditions.ts gem: duration 1, onBasePowerPriority 14, onBasePower() { return this.chainModify([5325, 4096]); }
 *   `useItem` writes `-enditem|HOLDER|Normal Gem|[from] gem|[move] <Move>`. The item is found by its TAG (`typeGem`).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   GEM       the holder's plain move of the gem's type: the gem is spent before the damage and the hit is boosted.
 *   OFFTYPE   the holder's plain move of another type: the gem stays.
 *   CONTROL   the GEM arm with no item.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_type_gem', ['MEDI_TYPE_GEM_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, plain, sure, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const GEMS = Object.keys(TAGS.items).filter(i => (TAGS.items[i].params || {}).typeGem && K.legal(D.items.get(i)));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     legal type gems: ' + GEMS.map(i => i + ' ' + JSON.stringify(TAGS.items[i].params.typeGem)).join('; '));
const DEXG = D.items.all().filter(i => K.legal(i) && /source\.addVolatile\(["']gem["']\)/.test(String(i.onSourceTryPrimaryHit || '')));
ok(DEXG.length > 0 && DEXG.every(i => GEMS.includes(i.id)), 'every legal gem carries the typeGem tag', 'dex ' + DEXG.map(i => i.id) + ' vs tag ' + GEMS);
if (!GEMS.length) K.finish();
const GEM = D.items.get(GEMS[0]), GT = TAGS.items[GEMS[0]].params.typeGem.type;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-enditem|-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ spent: K.M.MEDSEEN.typeGemSpent || 0 }));
/* the holder's weakest plain sure single-target move of `type` (or not of it) into `tgt`, neutral */
const hit = (u, tgt, pred) => D.moves.all().filter(m => plain(m) && !m.multihit && sure(m) && learns(u, m.id) && pred(m)
  && D.getImmunity(m.type, tgt) && D.getEffectiveness(m.type, tgt) === 0).sort((a, b) => a.basePower - b.basePower)[0] || null;

let GM = null, OT = null, CT = null;
outer: for (const u of SPEC.filter(s => quiet(s) && learns(s, 'protect'))) {
  const used = new Set([u.baseSpecies, u.id]);
  for (const tgt of FILL.filter(s => !used.has(s.baseSpecies)).slice(0, 10)) {
    const on = hit(u, tgt, m => m.type === GT), off = hit(u, tgt, m => m.type !== GT);
    if (!on || !off) continue;
    const u2 = new Set(used); u2.add(tgt.baseSpecies);
    const fills = pickDistinct(FILL.filter(s => !u2.has(s.baseSpecies)), u2, 4);
    if (fills.length < 4) continue;
    const A = it => [mon(u, it, [on.name, off.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
    const B = [mon(tgt, '', ['Protect']), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    /* the target must be HIT, so it does not protect on the hit turn: it clicks Protect only in its partner's slot */
    const tIdle = K.idle(tgt);
    if (!tIdle) continue;
    B[0] = mon(tgt, '', [tIdle.name, 'Protect']);
    const t = mv => [{ p1: [{ m: mv, t: 0 }, P.protect], p2: [{ m: tIdle.id }, P.protect] }];
    const g = play('gem', A(GEM.name), B, t(on.id));
    if (!g.staged) { console.log('   (skip ' + u.id + ': ' + g.why + ')'); continue; }
    const o = play('offtype', A(GEM.name), B, t(off.id)), c = play('control', A(''), B, t(on.id));
    if (!o.staged || !c.staged) continue;
    g.cast = u.id + ' @ ' + GEM.name + ' --' + on.id + '--> ' + tgt.id; o.cast = u.id + ' @ ' + GEM.name + ' --' + off.id + '--> ' + tgt.id;
    c.cast = u.id + ' (no item) --' + on.id + '--> ' + tgt.id;
    GM = g; OT = o; CT = c; break outer;
  }
}
const RUNS = [['GEM', GM], ['OFFTYPE', OT], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const spent = R => R.sdK.filter(l => /^\|-enditem\|p1a:/.test(l)).length;
const dmg = R => { const l = R.sdK.find(x => /^\|-damage\|p2a:/.test(x)); return l ? +/\|(\d+)\//.exec(l.replace(/^\|-damage\|p2a:[^|]*/, ''))[1] : null; };
ok(spent(GM) === 1 && spent(OT) === 0 && spent(CT) === 0, 'GEM spends the gem; OFFTYPE and CONTROL do not');
ok(dmg(GM) != null && dmg(CT) != null && dmg(GM) < dmg(CT), 'GEM hits harder than CONTROL (the target has less HP left)', dmg(GM) + ' vs ' + dmg(CT));

K.compareArms(RUNS, KEEP, '-enditem / -damage / faint');
K.finish();
