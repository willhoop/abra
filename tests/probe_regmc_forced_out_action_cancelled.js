#!/usr/bin/env node
/* tests/probe_regmc_forced_out_action_cancelled.js — A BODY FORCED OUT MID-TURN LOSES ITS QUEUED ACTION, EVEN IF IT IS
 * BROUGHT BACK IN THE SAME TURN, UNDER REG M-C. 2026-09-22 (abra/regmc 0.52.0).
 *
 *   node tests/probe_regmc_forced_out_action_cancelled.js --regulation regmc                                  # green, exit 0
 *   MEDI_RETURNED_BODY_KEEPS_ACTION=1 node tests/probe_regmc_forced_out_action_cancelled.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   sim/battle-actions.ts switchIn :62-122 (no Champions override): for an unfainted body leaving its slot,
 *       // if a pokemon is forced out by Whirlwind/etc or Eject Button/Pack, it can't use its chosen move
 *       this.battle.queue.cancelAction(oldActive);
 *   sim/battle-queue.ts cancelAction :334-343 splices EVERY queued action of that body out of the queue. So a body that
 *   comes back later in the same turn (a partner's pivot brings it in) has nothing left to do; `runAction`'s
 *   `isActive` refusal (the only guard this engine had) is true again by then.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   BACK      turn 1: a fast foe hits our slow Eject Button holder, which is ejected (the first bench body comes in);
 *             our middle-speed partner then pivots and the first bench body is now the ejected holder, which walks
 *             back in. Its queued stat-dropping click is gone: no `|move|` from it this turn.
 *   STAYS     the CONTROL: the holder carries no item, is hit and stays; the partner's pivot brings the first bench
 *             body in; the holder's queued click runs on both engines.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_forced_out_action_cancelled', ['MEDI_RETURNED_BODY_KEEPS_ACTION']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const withTag = (kind, t) => Object.keys(TAGS[kind]).filter(x => (TAGS[kind][x].tags || []).includes(t));
const EB = withTag('items', 'ejectsHolderOnHit').map(i => D.items.get(i)).filter(i => K.legal(i))[0];
const PIVOTS = Object.keys(TAGS.moves).map(m => D.moves.get(m)).filter(x => K.legal(x) && x.selfSwitch === true
  && x.category !== 'Status' && !x.secondary && !x.secondaries && x.target === 'normal');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     ejectsHolderOnHit ' + (EB ? EB.id : '(none)') + '   pivots ' + PIVOTS.map(m => m.id).join(', '));
ok(!!EB && PIVOTS.length > 0, 'an ejecting item and a pivot move exist');
if (!EB || !PIVOTS.length) K.finish();
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const spe = s => s.baseStats.spe;
const KEEP = /^\|(switch|move|-enditem|-damage|-unboost)\|/;
const counters = () => ({ cancelled: K.M.MEDSEEN.actionCancelledByForcedOut || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let BK = null, ST = null;
outer: for (const h of FILL.filter(s => K.idle(s) && spe(s) <= 60).slice(0, 20))
  for (const u of FILL.filter(s => s.baseSpecies !== h.baseSpecies && spe(s) >= spe(h) + 30 && PIVOTS.some(m => learns(s, m.id))).slice(0, 10))
    for (const f of FILL.filter(s => ![h.baseSpecies, u.baseSpecies].includes(s.baseSpecies) && spe(s) >= spe(u) + 30).slice(0, 10)) {
      const hit = K.hitFor(f, h);
      const pv = PIVOTS.find(m => learns(u, m.id) && D.getImmunity(m.type, f));
      const hi = K.idle(h);
      if (!hit || !pv || !hi) continue;
      const used = new Set([h.baseSpecies, h.id, u.baseSpecies, u.id, f.baseSpecies, f.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
      if (fills.length < 4) continue;
      const A = item => [mon(h, item, [hi.name, 'Protect']), mon(u, '', [pv.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const B = [mon(f, '', [hit.name, 'Protect']), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      /* turn 1: the foe hits the holder (slot 0); the partner pivots into the foe; the holder's queued click is its idle move */
      const t1 = { p1: [{ m: hi.id }, { m: pv.id, t: 0 }], p2: [{ m: hit.id, t: 0 }, P.protect] };
      const r = play('back', A(EB.name), B, [t1]);
      if (!r.staged) { console.log('   (skip ' + [h.id, u.id, f.id].join('/') + ': ' + r.why + ')'); continue; }
      const c = play('stays', A(''), B, [t1]);
      if (!c.staged) { console.log('   (skip stays ' + c.why + ')'); continue; }
      r.cast = f.id + ' (spe ' + spe(f) + ') --' + hit.id + '--> ' + h.id + ' @' + EB.id + ' (spe ' + spe(h) + '); ' + u.id + ' (spe ' + spe(u) + ') --' + pv.id + '--> ' + f.id
        + '; ' + h.id + ' queued ' + hi.id;
      c.cast = 'the same, ' + h.id + ' holding nothing';
      r.hname = K.canon(h.name.split('-')[0]); r.hi = hi.id;
      BK = r; ST = c; break outer;
    }
const RUNS = [['BACK', BK], ['STAYS', ST]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const hMoves = R => R.sdK.filter(l => new RegExp('^\\|move\\|p1[ab]:' + BK.hname + '\\|').test(l)).length;
const hBack = R => R.sdK.filter(l => new RegExp('^\\|switch\\|p1[ab]:' + BK.hname + '\\|').test(l)).length;
ok(R0(BK), 'BACK — the holder is ejected and walks back in behind the pivot', BK.sdK.filter(l => /^\|(switch|-enditem)\|/.test(l)).join('  '));
ok(hMoves(BK) === 0, 'BACK — the returned holder does not act: no |move| from it on the authority');
ok(hMoves(ST) === 1, 'STAYS — the holder that stayed acts once');
function R0(R) { return R.sdK.some(l => /^\|-enditem\|p1a/.test(l)) && hBack(R) >= 1; }

/* the holder's own |move| lines (the pivot's display name is `U-turn` on the authority and `uturn` here, a spelling the
 * driver's alignment folds and not this mechanic's) */
K.compareArms(RUNS, new RegExp('^\\|move\\|p1[ab]:' + BK.hname + '\\|'), 'holder |move|');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(BK.counters.cancelled === 1 && ST.counters.cancelled === 0, 'one queued action cancelled in BACK, none in STAYS',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
