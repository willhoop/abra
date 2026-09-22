#!/usr/bin/env node
/* tests/probe_regmc_steely_spirit.js — AN ALLY BASE-POWER BOOSTER (STEELY SPIRIT), UNDER REG M-C. 2026-09-22 (abra/regmc 0.35.0).
 *
 *   node tests/probe_regmc_steely_spirit.js --regulation regmc                               # green, exit 0
 *   MEDI_ALLY_BP_BOOST_INERT=1 node tests/probe_regmc_steely_spirit.js --regulation regmc    # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts steelyspirit (the Champions mod does not name it): onAllyBasePowerPriority 22,
 *   onAllyBasePower(basePower, attacker, defender, move) { if (move.type === 'Steel') return this.chainModify(1.5); }
 *   `onAlly<Event>` handlers are collected over the event target's `alliesAndSelf()` (sim/battle.ts :1056-1057), and the
 *   BasePower event's target is the attacker (sim/battle-actions.ts :1650), so the holder boosts its OWN Steel move and
 *   its partner's. The ability is found by its TAG (`allyBasePowerBoost`), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turn; SHOWDOWN IS THE ANSWER) ===
 *
 *   SELF      the holder uses a Steel move.
 *   ALLY      the holder's partner (no booster of its own) uses a Steel move; the holder stands behind Protect.
 *   CONTROL   the SELF arm with the holder on another of its abilities.
 *   ALLYCTL   the ALLY arm with the holder on that other ability.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_steely_spirit', ['MEDI_ALLY_BP_BOOST_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const ABS = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].params || {}).allyBasePowerBoost);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     allyBasePowerBoost: ' + ABS.map(a => a + ' ' + JSON.stringify(TAGS.abilities[a].params.allyBasePowerBoost)).join('; '));
/* every ability with an onAllyBasePower handler that some legal species can carry */
const CARRIED = new Set(D.species.all().filter(s => K.legal(s)).flatMap(s => abil(s)));
const DEXA = D.abilities.all().filter(a => a.onAllyBasePower && CARRIED.has(a.id));
ok(DEXA.length > 0 && DEXA.every(a => ABS.includes(a.id)), 'every carried onAllyBasePower ability carries the tag', 'dex ' + DEXA.map(a => a.id) + ' vs tag ' + ABS);
const AB = ABS.find(a => TAGS.abilities[a].params.allyBasePowerBoost.onlyType && TAGS.abilities[a].params.allyBasePowerBoost.includesSelf);
if (!AB) { ok(false, 'a typed self-including member exists'); K.finish(); }
const PR = TAGS.abilities[AB].params.allyBasePowerBoost;
ok(PR.mult === 1.5, 'the tag reads the handler\'s x1.5', JSON.stringify(PR));
const TY = PR.onlyType;

const HOLDERS = SPEC.filter(s => abil(s).includes(AB) && learns(s, 'protect') && abil(s).some(a => a !== AB && !K.LOUD.has(a)));
console.log('     holders: ' + HOLDERS.map(s => s.id).join(', '));
/* a single-target damaging move of the type; a secondary is allowed (the carrier's own Steel moves all carry one) and fires
 * identically on both engines under the kit's arm, so it cannot move the damage line this probe compares */
const simple = m => K.legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.self && !m.recoil && !m.drain && !m.flags.charge
  && !m.flags.recharge && !m.priority && !m.basePowerCallback && !m.damageCallback && !m.onBasePower && !m.onModifyMove && !m.onModifyType && m.basePower >= 20;
const plainOf = (u, tgt) => D.moves.all().filter(m => simple(m) && !m.multihit && K.sure(m) && m.type === TY && learns(u, m.id)
  && D.getImmunity(m.type, tgt) && D.getEffectiveness(m.type, tgt) <= 0).sort((a, b) => a.basePower - b.basePower)[0] || null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ boost: K.M.MEDSEEN.allyBasePowerBoost || 0 }));

let SF = null, AL = null, CT = null, AC = null;
outer: for (const h of HOLDERS) {
  const other = abil(h).find(a => a !== AB && !K.LOUD.has(a));
  /* the partner that attacks in ALLY: a quiet body with no booster, a plain Steel move */
  for (const tgt of FILL.filter(s => s.baseSpecies !== h.baseSpecies && K.idle(s)).slice(0, 12)) {
    const hm = plainOf(h, tgt);
    if (!hm) continue;
    const used = new Set([h.baseSpecies, h.id, tgt.baseSpecies, tgt.id]);
    const pals = FILL.filter(s => !used.has(s.baseSpecies) && plainOf(s, tgt));
    if (!pals.length) continue;
    const pal = pals[0], pm = plainOf(pal, tgt);
    used.add(pal.baseSpecies); used.add(pal.id);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (fills.length < 4) continue;
    const tIdle = K.idle(tgt);
    const A = ab => [mon(h, '', [hm.name, 'Protect'], ab), mon(pal, '', [pm.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const B = [mon(tgt, '', [tIdle.name, 'Protect']), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const tSelf = [{ p1: [{ m: hm.id, t: 0 }, P.protect], p2: [{ m: tIdle.id }, P.protect] }];
    const tAlly = [{ p1: [P.protect, { m: pm.id, t: 0 }], p2: [{ m: tIdle.id }, P.protect] }];
    const s = play('self', A(AB), B, tSelf);
    if (!s.staged) { console.log('   (skip ' + h.id + ' -> ' + tgt.id + ': ' + s.why + ')'); continue; }
    const a = play('ally', A(AB), B, tAlly), c = play('control', A(other), B, tSelf), ac = play('allyctl', A(other), B, tAlly);
    if (!a.staged || !c.staged || !ac.staged) continue;
    s.cast = h.id + ' (' + AB + ') --' + hm.id + '--> ' + tgt.id;
    a.cast = pal.id + ' --' + pm.id + '--> ' + tgt.id + ', partner ' + h.id + ' (' + AB + ')';
    c.cast = h.id + ' (' + other + ') --' + hm.id + '--> ' + tgt.id;
    ac.cast = pal.id + ' --' + pm.id + '--> ' + tgt.id + ', partner ' + h.id + ' (' + other + ')';
    SF = s; AL = a; CT = c; AC = ac; break outer;
  }
}
const RUNS = [['SELF', SF], ['ALLY', AL], ['CONTROL', CT], ['ALLYCTL', AC]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const left = R => { const l = R.sdK.find(x => /^\|-damage\|p2a:/.test(x)); return l ? +/\|(\d+)\//.exec(l.replace(/^\|-damage\|p2a:[^|]*/, ''))[1] : null; };
ok(left(SF) != null && left(CT) != null && left(SF) < left(CT), 'SELF hits harder than CONTROL (the target has less HP left)', left(SF) + ' vs ' + left(CT));
ok(left(AL) != null && left(AC) != null && left(AL) < left(AC), 'ALLY hits harder than ALLYCTL (the partner boosts it)', left(AL) + ' vs ' + left(AC));

K.compareArms(RUNS, KEEP, '-damage / faint');
K.finish();
