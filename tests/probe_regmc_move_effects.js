#!/usr/bin/env node
/* tests/probe_regmc_move_effects.js — THE MOVE-EFFECTS TABLE FOLLOWS THE REGULATION. 2026-09-22 (abra/regmc 0.24.0).
 *
 *   node tests/probe_regmc_move_effects.js --regulation regmc                                     # green, exit 0
 *   MEDI_MOVE_EFFECTS_OWNER_TABLE=1 node tests/probe_regmc_move_effects.js --regulation regmc     # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE DEFECT =====================================================================
 *
 * `data/move-effects.js` is the engine's rulebook for a move's secondaries, its certain boosts and its
 * accuracy (`moveFxTable` in engine/medicham2-browser.js). It was generated for ONE format
 * (build/build_browser_data.js, `Dex.forFormat` of the active regulation) and was not in the per-regulation
 * map (engine/regulation.js REG_FILE_KEYS), so under Reg M-C every legal move that Reg M-B does not have had
 * NO ROW: its secondary, its certain self boosts and its accuracy were simply absent, and the one reader
 * that assumed a row threw (guarded and counted at abra/regmc 0.22.0, `MEDFAILS.moveFxMissing`).
 *
 * ================= THE AUTHORITY (M-C checkout, read whole) ======================================
 *
 * The rows the arms rely on are read from `Dex.forFormat(<Reg M-C>)` THIS RUN, never typed:
 *   - a damaging move whose only effect is a 100% target stat drop (`secondary: {chance: 100, boosts}`),
 *     chosen among the legal Reg M-C moves that Reg M-B's table has no row for;
 *   - a self-targeting status move whose only effect is certain boosts (`boosts`), chosen the same way.
 * The authority applies a secondary with chance 100 unconditionally (sim/battle-actions.ts secondaries loop) and a
 * status move's `boosts` outright.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   SECONDARY  the drop move into a foe: `-unboost` on the foe.
 *   BOOSTS     the self-boost move: `-boost` lines on the user.
 *   ROWS       every legal Reg M-C move has a row in the table the engine reads, and no arm counts a missing one.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_move_effects', ['MEDI_MOVE_EFFECTS_OWNER_TABLE']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, sure, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

/* 0. WHICH MOVES REG M-B'S TABLE LACKS -- read from the owner's file by its bytes, not through the resolver */
const ownerTable = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data', 'move-effects.js'), 'utf8'))(w); return w.MOVE_EFFECTS; })();
const LEGAL = D.moves.all().filter(K.legal);
const NEW = LEGAL.filter(m => !ownerTable[m.id]);
console.log('\n0. LEGAL ' + K.CS.FORMAT + ' MOVES WITH NO ROW IN REG M-B\'S TABLE: ' + NEW.length + '  (' + NEW.map(m => m.id).join(', ') + ')');
if (!NEW.length) { console.log('  NOT STAGED — every legal move already has a Reg M-B row; nothing to probe'); process.exit(1); }

/* abilities with a boost handler would change a drop or a boost; the staged bodies carry none of them */
const boostQuiet = s => { const a = quiet(s); if (!a) return null; const A = D.abilities.get(a);
  return (A.onTryBoost || A.onChangeBoost || A.onAfterBoost || A.onAfterEachBoost || A.onFoeAfterBoost) ? null : a; };
const DROP = NEW.filter(m => m.category !== 'Status' && m.target === 'normal' && sure(m) && !m.multihit && !m.priority
  && m.secondary && m.secondary.chance === 100 && m.secondary.boosts && !m.secondary.status && !m.secondary.volatileStatus
  && !m.secondary.self && !m.self && !m.flags.charge && !m.flags.recharge && !m.selfSwitch && !m.basePowerCallback && !m.onHit);
const SELFB = NEW.filter(m => m.category === 'Status' && m.target === 'self' && m.boosts && !m.onHit && !m.volatileStatus && !m.heal);
console.log('     100% drop moves among them: ' + DROP.map(m => m.id).join(', '));
console.log('     self-boost status moves among them: ' + SELFB.map(m => m.id).join(', '));

const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const counters = () => ({ missing: K.M.MEDFAILS.moveFxMissing || 0, accUnknown: K.M.MEDFAILS.accuracyUnknown || 0 });
const KEEP = /^\|(-unboost|-boost|-damage|faint|-miss)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let SEC = null, BST = null;
/* SECONDARY: p1a clicks the drop move into p2a once; p2a hits p1b's Protect; everyone else protects */
for (const mv of DROP) {
  for (const att of SPEC.filter(s => boostQuiet(s) && learns(s, mv.id) && learns(s, 'protect'))) {
    const used = new Set([att.baseSpecies, att.id]);
    const tgts = SPEC.filter(s => boostQuiet(s) && learns(s, 'protect') && !used.has(s.baseSpecies)
      && D.getImmunity(mv.type, s) && D.getEffectiveness(mv.type, s) <= 0).sort((a, b) => bulk(b) - bulk(a));
    for (const tgt of tgts.slice(0, 12)) {
    const used2 = new Set(used); used2.add(tgt.baseSpecies); used2.add(tgt.id);
    const fills = pickDistinct(FILL, used2, 5);
    if (fills.length < 5) continue;
    const back = K.hitFor(tgt, fills[0]);
    if (process.env.ME_DEBUG) console.log('   try ' + att.id + ' ' + mv.id + ' -> ' + tgt.id + ' back=' + (back && back.id));
    if (!back) continue;
    const A = [mon(att, '', [mv.name, 'Protect'], boostQuiet(att)), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[4], '', ['Protect'])];
    const B = [mon(tgt, '', [back.name, 'Protect'], boostQuiet(tgt)), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect'])];
    const t = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: back.id, t: 0 }, P.protect] };
    const R = play('secondary', A, B, [t]);
    if (!R.staged) { console.log('   (skip ' + att.id + ' ' + mv.id + ': ' + R.why + ')'); continue; }
    if (!R.sdK.some(l => /^\|-unboost\|p2a:/.test(l))) continue;
    SEC = R; SEC.cast = att.id + ' --' + mv.id + '--> ' + tgt.id; break;
    }
    if (SEC) break;
  }
  if (SEC) break;
}
/* BOOSTS: p1a clicks the self-boost move; p2a hits p1b's Protect */
for (const mv of SELFB) {
  for (const user of SPEC.filter(s => boostQuiet(s) && learns(s, mv.id) && learns(s, 'protect'))) {
    const used = new Set([user.baseSpecies, user.id]);
    const fills = pickDistinct(FILL, used, 5);
    if (fills.length < 5) continue;
    const back = K.hitFor(fills[2], fills[0]);
    if (!back) continue;
    const A = [mon(user, '', [mv.name, 'Protect'], boostQuiet(user)), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[4], '', ['Protect'])];
    const B = [mon(fills[2], '', [back.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const R = play('boosts', A, B, [{ p1: [{ m: mv.id }, P.protect], p2: [{ m: back.id, t: 1 }, P.protect] }]);
    if (!R.staged) { console.log('   (skip ' + user.id + ' ' + mv.id + ': ' + R.why + ')'); continue; }
    if (!R.sdK.some(l => /^\|-boost\|p1a:/.test(l))) continue;
    BST = R; BST.cast = user.id + ' --' + mv.id; break;
  }
  if (BST) break;
}
const RUNS = [['SECONDARY', SEC], ['BOOSTS', BST]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
ok(SEC.sdK.filter(l => /^\|-unboost\|p2a:/.test(l)).length === 1, 'SECONDARY — the foe\'s stat drops once, on the one hit');
ok(BST.sdK.filter(l => /^\|-boost\|p1a:/.test(l)).length >= 1, 'BOOSTS — the user is boosted');

K.compareArms(RUNS, /^\|(-unboost|-boost)\|/, '-unboost / -boost');

console.log('\n5. THE TABLE THE ENGINE READS');
ok(SEC.counters.missing === 0 && BST.counters.missing === 0, 'no arm reached a move with no row (MEDFAILS.moveFxMissing)',
  JSON.stringify([SEC.counters, BST.counters]));
ok(SEC.counters.accUnknown === 0 && BST.counters.accUnknown === 0, 'no arm fell back to an unknown accuracy (MEDFAILS.accuracyUnknown)',
  JSON.stringify([SEC.counters, BST.counters]));
{
  /* the file the SELECTED regulation reads, through the same seam the engine's require goes through */
  const own = K.REGN.fileFor('data/move-effects.js');
  let t = null, why = null;
  try { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, own), 'utf8'))(w); t = w.MOVE_EFFECTS; } catch (e) { why = e.message; }
  const gap = t ? LEGAL.filter(m => !t[m.id]).map(m => m.id) : null;
  ok(own !== 'data/move-effects.js' && t && gap.length === 0, 'the selected regulation reads its own table (' + own + ') and it has a row for all '
    + LEGAL.length + ' legal moves', why || (gap && gap.length ? 'missing: ' + gap.join(', ') : null));
}
K.finish();
