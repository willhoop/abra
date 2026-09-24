#!/usr/bin/env node
/* tests/probe_recoil_faint_below_after_move_secondary.js — A RECOIL KO'S `|faint|` IS WRITTEN AT THE TAIL OF THE MOVE,
 * BELOW EVERY `AfterMoveSecondary` ANSWER. 2026-09-24 (abra/regmc 0.87.0).
 *
 *   node tests/probe_recoil_faint_below_after_move_secondary.js --regulation regmc   # Berserk + Emergency Exit, green
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_recoil_faint_below_after_move_secondary.js   # Berserk only (no M-B
 *                                                                                   # Emergency Exit carrier), green
 *   MEDI_RECOIL_FAINT_INLINE=1 ...     the recoil faint written on the spot again (the pre-fix engine): must exit 1
 *   ... --medi <path>                  compile THOSE engine bytes under the release (the pre-fix engine, the RED proof)
 *
 * ================= THE AUTHORITY (read whole, both checkouts) =====================================================
 *
 *   data/mods/champions/scripts.ts hitStepMoveHitLoop (Reg M-C checkout :547-590):
 *       this.battle.faintMessages(false, false, !pokemon.hp);     the TARGETS' lines -- the attacker is not dead yet
 *       if (move.totalDamage) this.applyRecoilDamage(...);        the attacker reaches 0: `Pokemon#faint()` only QUEUES
 *       ...
 *       this.battle.eachEvent('Update');
 *       this.afterMoveSecondaryEvent(...);                        Berserk (`onAfterMoveSecondary`) answers here
 *       ... runEvent('EmergencyExit', targets[i], pokemon)        Emergency Exit's `-activate` is written here
 *   sim/battle-actions.ts runMove :347   this.battle.faintMessages();   <- the recoil victim's `|faint|` is THIS drain
 *   So both answers print ABOVE the recoil victim's `|faint|`. MEDICHAM wrote that line where the HP reached zero.
 *   Pinned pool, Reg M-C, release ec377f6f8159, `omit-spread ...bo3-2682655109` t5 (Rillaboom's Wood Hammer into a
 *   Golisopod): showdown `-activate Emergency Exit`, `faint Rillaboom`; medicham the reverse.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ===========================
 *
 *   KO       turn 1 the holder and its partner chip the attacker; turn 2 the attacker's recoil move takes the holder
 *            across half and the recoil kills the attacker: the holder's answer, THEN the attacker's `|faint|`.
 *   CONTROL  the same cast with no chip: the attacker survives its recoil, no `|faint|` is owed, both engines agree
 *            before and after the fix (the instrument can see agreement, not only a difference).
 *   Holders are found by TAG (`boostsAtHPThreshold`, `switchesOutAtHalf`) in the selected regulation's tags file.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_recoil_faint_below_after_move_secondary', ['MEDI_RECOIL_FAINT_INLINE'], { anyRegulation: true });
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, sure, plain, bulk, mon, pickDistinct, show, P, idle } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const withTag = t => Object.keys(TAGS.abilities).filter(x => (TAGS.abilities[x].tags || []).includes(t));
const FAMILIES = [['BERSERK', withTag('boostsAtHPThreshold')], ['EMERGENCY EXIT', withTag('switchesOutAtHalf')]];
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
for (const [f, abs] of FAMILIES) console.log('     ' + f + ' abilities: ' + abs.join(', ') + '   carriers: '
  + show(SPEC.filter(s => abil(s).some(a => abs.includes(a)))));

/* a single-target, sure, secondary-free damaging move whose recoil is a share of the damage dealt */
const recoilMoves = (s, tgt) => D.moves.all().filter(m => K.legal(m) && learns(s, m.id) && m.recoil && m.category !== 'Status'
  && m.target === 'normal' && sure(m) && !m.secondary && !m.secondaries && !m.multihit && !m.priority && !m.self
  && D.getImmunity(m.type, tgt)).sort((a, b) => b.basePower * Math.pow(2, D.getEffectiveness(b.type, tgt))
  - a.basePower * Math.pow(2, D.getEffectiveness(a.type, tgt)));
const strongInto = (s, tgt) => D.moves.all().filter(m => plain(m) && !m.multihit && sure(m) && learns(s, m.id)
  && D.getImmunity(m.type, tgt)).sort((a, b) => b.basePower * Math.pow(2, D.getEffectiveness(b.type, tgt))
  - a.basePower * Math.pow(2, D.getEffectiveness(a.type, tgt)));
const KEEP = /^\|(-activate|-ability|-boost|switch|-damage|faint)\|/;
const counters = () => ({ deferred: K.M.MEDSEEN.recoilFaintDeferred || 0, tail: K.M.MEDSEEN.faintDrainMoveTail || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const ATT = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s));
const LIMIT = +(process.env.RECOIL_PROBE_TRIES || 400);

function stage(family, abs) {
  const HOLD = SPEC.filter(s => abil(s).some(a => abs.includes(a)) && learns(s, 'protect'));
  if (!HOLD.length) return { absent: true };
  let tries = 0;
  for (const h of HOLD) {
    const ha = abil(h).find(a => abs.includes(a));
    for (const att of ATT) {
      if (att.baseSpecies === h.baseSpecies) continue;
      const rms = recoilMoves(att, h);
      if (!rms.length) continue;
      const chipper = FILL.find(s => s.baseSpecies !== h.baseSpecies && s.baseSpecies !== att.baseSpecies && strongInto(s, att).length);
      if (!chipper) continue;
      const used = new Set([h.baseSpecies, att.baseSpecies, chipper.baseSpecies]);
      const fills = [chipper].concat(pickDistinct(FILL, used, 3));
      if (fills.length < 4) continue;
      const hHit = strongInto(h, att)[0], cHits = strongInto(chipper, att).slice(0, 4);
      const hIdle = hHit && K.hitFor(h, fills[1], m => m.id !== hHit.id);
      if (!hHit || !cHits.length || !hIdle) { if (process.env.RECOIL_DEBUG) console.log('   pre-skip ' + h.id + '/' + att.id + ' hHit=' + !!hHit + ' cHits=' + cHits.length + ' hIdle=' + !!hIdle); continue; }
      const rm = rms[0];
      let CT = null;
      const A = [mon(h, '', ['Protect', hHit.name, hIdle.name], ha), mon(chipper, '', ['Protect'].concat(cHits.map(m => m.name))),
                 mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect'])];
      const B = [mon(att, '', [rm.name, idle(att).name, 'Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect']),
                 mon(fills[2], '', ['Protect'])];
      const t2 = { p1: [{ m: hIdle.id, t: 1 }, P.protect], p2: [{ m: rm.id, t: 0 }, P.protect] };
      for (const ch of [null].concat(cHits)) {
        for (const both of ch ? [false, true] : [false]) {
          if (++tries > LIMIT) return { why: LIMIT + ' tries without a fixture' };
          const t1 = { p1: [both ? { m: hHit.id, t: 0 } : P.protect, ch ? { m: ch.id, t: 0 } : P.protect],
                       p2: [{ m: idle(att).id }, P.protect] };
          const r = play(family + (ch ? ' KO' : ' CONTROL'), A, B, ch ? [t1, t2] : [t2]);
          if (!r.staged) { if (process.env.RECOIL_DEBUG) console.log('   skip ' + h.id + '/' + att.id + ': ' + r.why); break; }
          const L = r.sdK, iR = L.findIndex(l => /^\|-damage\|p2a:.*\[from\]recoil/.test(l));
          const hp = L.filter(l => /^\|-damage\|p1a:/.test(l)).pop();
          const ans = L.findIndex(l => /^\|(-activate|-ability)\|p1a:/.test(l));
          if (process.env.RECOIL_DEBUG) console.log('   ' + h.id + '/' + att.id + ' ' + rm.id + ' chip=' + (ch ? ch.id : '-') + (both ? '+' : '') + ' :: ' + L.slice(4).join(' '));
          if (iR < 0 || ans < 0 || !hp || /0fnt/.test(hp)) continue;
          const died = /0fnt/.test(L[iR]);
          if (!ch && died) break;
          if (!ch) { CT = r; CT.cast = h.id + ' [' + ha + '] <- ' + att.id + ' (' + rm.id + '), no chip'; continue; }
          if (!died || !CT) continue;
          r.cast = h.id + ' [' + ha + '] <- ' + att.id + ' (' + rm.id + '), chipped by ' + chipper.id + ' (' + ch.id + ')' + (both ? ' + ' + hHit.id : '');
          return { KO: r, CT };
        }
      }
    }
  }
  return { why: 'no cast found' };
}

const RUNS = [];
for (const [f, abs] of FAMILIES) {
  const s = stage(f, abs);
  if (s.absent) { console.log('  ' + f + ': no legal carrier in ' + K.CS.FORMAT + ' -- not staged in this regulation'); continue; }
  if (!s.KO) { console.log('  NOT STAGED (' + f + ') — ' + s.why); process.exit(1); }
  RUNS.push([f + ' KO', s.KO], [f + ' CONTROL', s.CT]);
}
if (!RUNS.length) { console.log('  NOT RUN — no family has a legal carrier'); process.exit(2); }
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
for (const [tag, R] of RUNS) {
  const L = R.sdK, iR = L.findIndex(l => /^\|-damage\|p2a:.*\[from\]recoil/.test(l));
  const ans = L.findIndex((l, i) => i > iR && /^\|(-activate|-ability)\|p1a:/.test(l));
  const fnt = L.findIndex(l => /^\|faint\|p2a:/.test(l));
  if (/KO$/.test(tag)) ok(iR >= 0 && ans > iR && fnt > ans, tag + ' — recoil to 0, then the holder\'s answer, THEN the attacker\'s |faint|');
  else ok(iR >= 0 && ans > iR && fnt < 0, tag + ' — the attacker survives its recoil and the holder still answers');
}
K.compareArms(RUNS, KEEP, '-activate / -ability / -boost / switch / -damage / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  for (const [tag, R] of RUNS)
    ok(/KO$/.test(tag) ? R.counters.deferred >= 1 : R.counters.deferred === 0, tag + ' — the engine\'s own receipt: the recoil faint was deferred on the KO arm only', JSON.stringify(R.counters));
}
K.finish();
