#!/usr/bin/env node
/* tests/probe_regmc_leek.js — THE LEEK, UNDER REG M-C. 2026-09-22 (abra/regmc 0.34.0).
 *
 *   node tests/probe_regmc_leek.js --regulation regmc                               # green, exit 0
 *   MEDI_CRIT_ITEM_ONE_STAGE=1 node tests/probe_regmc_leek.js --regulation regmc    # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts leek (the Champions mod sets only `isNonstandard: null`):
 *     onModifyCritRatio(critRatio, user) { if (["farfetchd", "sirfetchd"].includes(this.toID(user.baseSpecies.baseSpecies)))
 *       return critRatio + 2; }
 *   The ratio indexes critMult [0, 24, 8, 2, 1] (sim/battle-actions.ts :1623-1641, gen 7+), so a move whose own critRatio is 2 (a high-crit
 *   move) held with the Leek by a Sirfetch'd reaches 4: a CERTAIN crit. The item is found by its TAG (`critRatioUp` with
 *   `onlySpecies`), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   LEEK      a locked species holds the item and uses a high-crit move for five turns: every hit crits.
 *   LOCKED    a species the lock does not name holds the item and uses the same move: it is one stage, not three.
 *   CONTROL   the LEEK arm with no item.
 *   Played on the MIDDLE arm (real dice, seeded and shared by category): under the bottom arm every crit lands and the
 *   rate is invisible. Two engines that agree on the ratio agree on every roll; five hits per arm.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_leek', ['MEDI_CRIT_ITEM_ONE_STAGE']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const ITEMS = Object.keys(TAGS.items).filter(i => { const p = (TAGS.items[i].params || {}).critRatioUp; return p && Array.isArray(p.onlySpecies) && K.legal(D.items.get(i)); });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     legal species-locked crit items: ' + ITEMS.map(i => i + ' ' + JSON.stringify(TAGS.items[i].params.critRatioUp)).join('; '));
const DEXL = D.items.all().filter(i => K.legal(i) && /baseSpecies/.test(String(i.onModifyCritRatio || '')));
ok(DEXL.length > 0 && DEXL.every(i => ITEMS.includes(i.id)), 'every legal species-locked crit item carries the lock in its tag', 'dex ' + DEXL.map(i => i.id) + ' vs tag ' + ITEMS);
if (!ITEMS.length) K.finish();
const IT = D.items.get(ITEMS[0]), LP = TAGS.items[ITEMS[0]].params.critRatioUp;
ok(LP.critRatio === 3, 'the tag reads the handler\'s +2 (critRatio 3)', JSON.stringify(LP));

const toID = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legalSp = s => K.legal(s) && !s.isMega && !s.battleOnly;
const HOLDERS = D.species.all().filter(s => legalSp(s) && LP.onlySpecies.includes(toID(s.baseSpecies)));
console.log('     locked holders in the format: ' + HOLDERS.map(s => s.id + ' ' + JSON.stringify(s.name)).join(', '));
const highCrit = u => D.moves.all().filter(m => K.legal(m) && m.critRatio === 2 && !m.willCrit && m.category !== 'Status' && m.target === 'normal'
  && learns(u, m.id) && !m.flags.charge && !m.flags.recharge && !m.self && !m.secondary && !m.secondaries && !m.recoil && !m.drain
  && !m.multihit && !m.selfSwitch && (m.accuracy === true || m.accuracy === 100)).sort((a, b) => a.basePower - b.basePower);
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-crit|-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ lockedOut: K.M.MEDSEEN.critItemLockedOut || 0 }), 'middle');
const N = 5;
/* the target's repeatable click: K.idle, unless that is Focus Energy (a second use fails); else a self-targeting +1 boost
 * (five uses stay under +6; a crit ignores the defender's positive boosts, so a Defence boost cannot move a crit's damage) */
const idleN = s => { const i = K.idle(s); if (i && i.id !== 'focusenergy') return i;
  return D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.heal && !m.onHit && !m.onTry
    && Object.values(m.boosts).every(v => v === 1) && learns(s, m.id)).sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null; };

let LK = null, LO = null, CT = null;
outer: for (const u of HOLDERS.filter(s => learns(s, 'protect'))) {
  for (const mv of highCrit(u)) {
    /* the other holder: a species the lock does not name, that learns the same move */
    const other = SPEC.filter(s => quiet(s) && learns(s, mv.id) && learns(s, 'protect') && !LP.onlySpecies.includes(toID(s.baseSpecies)))[0];
    if (!other) { console.log('   (skip ' + u.id + ' ' + mv.id + ': no unlocked holder learns it)'); continue; }
    const used = new Set([u.baseSpecies, u.id, other.baseSpecies, other.id]);
    /* the target resists the move and is bulky, so it survives four crits */
    const tgts = FILL.filter(s => !used.has(s.baseSpecies) && D.getImmunity(mv.type, s) && D.getEffectiveness(mv.type, s) < 0 && idleN(s));
    if (!tgts.length) console.log('   (skip ' + u.id + ' ' + mv.id + ': no bulky resisting target with a repeatable idle click)');
    for (const tgt of tgts.slice(0, 6)) {
      const u2 = new Set(used); u2.add(tgt.baseSpecies);
      const fills = pickDistinct(FILL.filter(s => !u2.has(s.baseSpecies)), u2, 4);
      if (fills.length < 4) continue;
      const tIdle = idleN(tgt);
      const A = (who, it) => [mon(who, it, [mv.name, 'Protect'], quiet(who) || abil(who)[0]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
      const B = [mon(tgt, '', [tIdle.name, 'Protect']), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const t = Array.from({ length: N }, () => ({ p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: tIdle.id }, P.protect] }));
      const g = play('leek', A(u, IT.name), B, t);
      if (!g.staged) { console.log('   (skip ' + u.id + ' ' + mv.id + ' -> ' + tgt.id + ': ' + g.why + ')'); continue; }
      const o = play('locked', A(other, IT.name), B, t), c = play('control', A(u, ''), B, t);
      if (!o.staged || !c.staged) continue;
      g.cast = u.id + ' @ ' + IT.name + ' --' + mv.id + ' x' + N + '--> ' + tgt.id;
      o.cast = other.id + ' @ ' + IT.name + ' --' + mv.id + ' x' + N + '--> ' + tgt.id;
      c.cast = u.id + ' (no item) --' + mv.id + ' x' + N + '--> ' + tgt.id;
      LK = g; LO = o; CT = c; break outer;
    }
  }
}
const RUNS = [['LEEK', LK], ['LOCKED', LO], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const crits = R => R.sdK.filter(l => /^\|-crit\|p2a:/.test(l)).length;
const hits = R => R.sdK.filter(l => /^\|-damage\|p2a:/.test(l)).length;
ok(hits(LK) === N && crits(LK) === N, 'LEEK: all ' + N + ' hits land and every one crits (critRatio 2 + 2 = 4)', crits(LK) + ' crits of ' + hits(LK) + ' hits');
ok(hits(LO) === N && hits(CT) === N, 'LOCKED and CONTROL: all ' + N + ' hits land', hits(LO) + ' / ' + hits(CT));
ok(crits(LO) < N || crits(CT) < N, 'LOCKED or CONTROL misses a crit somewhere, so the lock is visible in this sample', crits(LO) + ' / ' + crits(CT));

K.compareArms(RUNS, KEEP, '-crit / -damage / faint');
K.finish();
