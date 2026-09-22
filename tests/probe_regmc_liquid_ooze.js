#!/usr/bin/env node
/* tests/probe_regmc_liquid_ooze.js — AN ABILITY THAT TURNS A DRAIN INTO DAMAGE (LIQUID OOZE), UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.42.0).
 *
 *   node tests/probe_regmc_liquid_ooze.js --regulation regmc                            # green, exit 0
 *   MEDI_OOZE_INERT=1 node tests/probe_regmc_liquid_ooze.js --regulation regmc          # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts liquidooze :2402-2415 (the Champions mod does not name it):
 *       onSourceTryHeal(damage, target, source, effect) {
 *         const canOoze = ['drain', 'leechseed', 'strengthsap'];
 *         if (canOoze.includes(effect.id)) { this.damage(damage); return 0; }
 *       }
 *   sim/battle.ts heal :2261-2301 runs `TryHeal` BEFORE its `target.hp >= target.maxhp` refusal ("for things like Liquid
 *   Ooze, the Heal event still happens when nothing is healed"), so a drainer on full HP is still damaged. The damage is
 *   the heal amount as TryHeal received it (Big Root, onTryHealPriority 1, has already multiplied it); the line is
 *   `-damage|HEALER|hp|[from] ability: Liquid Ooze|[of] HOLDER`. The ability is found by its TAG (`reversesHeal`).
 *
 * ================= THE ARMS (both engines play the same scripted turn; SHOWDOWN IS THE ANSWER) ====
 *
 *   DRAIN     a full-HP attacker's drain move into the holder: the attacker takes the drain as damage.
 *   SAP       a full-HP user's heal-by-the-target's-Attack move into the holder: the same.
 *   SEED      the holder is seeded; at the residual the full-HP seeder takes the sapped HP as damage.
 *   CONTROL   the DRAIN arm into the same species on another of its abilities: nothing.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_liquid_ooze', ['MEDI_OOZE_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const ABS = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].params || {}).reversesHeal);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     reversesHeal: ' + (ABS.map(a => a + ' ' + JSON.stringify(TAGS.abilities[a].params.reversesHeal)).join('; ') || '(none)'));
const CARRIED = new Set(SPEC.flatMap(s => abil(s)));
const DEXA = D.abilities.all().filter(a => K.legal(a) && a.onSourceTryHeal && /this\.damage\(/.test(String(a.onSourceTryHeal)) && CARRIED.has(a.id));
console.log('     carried abilities whose onSourceTryHeal deals damage (dex): ' + DEXA.map(a => a.id).join(', '));
ok(DEXA.length > 0 && DEXA.every(a => ABS.includes(a.id)), 'every such ability carries the reversesHeal tag', 'dex ' + DEXA.map(a => a.id) + ' vs tag ' + ABS);
const AB = DEXA[0] && DEXA[0].id;
if (!AB) K.finish();
/* CONTROL's other ability may be a LOUD one (the only carrier's others touch items only); no item is held in any arm */
const HOLDERS = SPEC.filter(s => abil(s).includes(AB) && learns(s, 'protect') && abil(s).some(a => a !== AB));
console.log('     holders: ' + show(HOLDERS));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const drainOf = (u, tgt) => D.moves.all().filter(m => K.legal(m) && m.drain && m.category !== 'Status' && m.target === 'normal' && !m.secondary
  && !m.secondaries && K.sure(m) && !m.multihit && !m.priority && !m.basePowerCallback && learns(u, m.id) && D.getImmunity(m.type, tgt)
  && D.getEffectiveness(m.type, tgt) <= 0).sort((a, b) => a.basePower - b.basePower)[0] || null;
const SAP = D.moves.all().find(m => K.legal(m) && m.category === 'Status' && m.target === 'normal' && /heal\(/.test(String(m.onHit || '')) && /getStat\(\s*["']atk["']/.test(String(m.onHit || '')));
const SEED = D.moves.all().find(m => K.legal(m) && m.category === 'Status' && m.volatileStatus === 'leechseed');
console.log('     heal-by-Attack move: ' + (SAP ? SAP.id : '(none)') + '   seeding move: ' + (SEED ? SEED.id : '(none)'));
const KEEP = /^\|(-damage|-heal|faint)\|/;
const counters = () => ({ ooze: K.M.MEDSEEN.oozeReversed || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let DR = null, SP = null, SD = null, CT = null;
outer: for (const h of HOLDERS) {
  const other = abil(h).find(a => a !== AB && !K.LOUD.has(a)) || abil(h).find(a => a !== AB);
  /* the holder's click: the kit's idle move, else a self-targeted status move with no heal, no protection and no
   * switch (the only carrier learns none of the kit's list); either moves nothing a heal or a drain reads */
  const hIdle = K.idle(h) || D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && !m.heal
    && !m.stallingMove && !m.selfSwitch && !m.volatileStatus && !m.onHit && !m.sideCondition && !m.weather && !m.terrain
    && !m.pseudoWeather && learns(h, m.id)).sort((a, b) => Object.keys(a.boosts || {}).length - Object.keys(b.boosts || {}).length)[0];
  if (!hIdle) { console.log('   (skip ' + h.id + ': no idle click)'); continue; }
  console.log('     ' + h.id + ' clicks ' + hIdle.id);
  const used0 = new Set([h.baseSpecies, h.id]);
  const att = FILL.find(s => !used0.has(s.baseSpecies) && drainOf(s, h));
  /* no quiet carrier learns the heal-by-Attack move; an ability whose ONLY handler is `onModifySpe` touches no HP and is
   * the sapper's ability instead (derived off the handlers, not named) */
  const speOnly = s => abil(s).find(a => { const x = D.abilities.get(a); return Object.keys(x).filter(k => /^on[A-Z]/.test(k)).join() === 'onModifySpe'; });
  const sap = SAP && SPEC.filter(s => learns(s, 'protect') && (quiet(s) || speOnly(s))).find(s => !used0.has(s.baseSpecies)
    && learns(s, SAP.id) && (!att || s.baseSpecies !== att.baseSpecies));
  const sdr = SEED && FILL.find(s => !used0.has(s.baseSpecies) && learns(s, SEED.id) && !h.types.includes('Grass')
    && (!att || s.baseSpecies !== att.baseSpecies) && (!sap || s.baseSpecies !== sap.baseSpecies));
  if (!att || !sap || !sdr) { console.log('   (skip ' + h.id + ': drainer ' + !!att + ', sapper ' + !!sap + ', seeder ' + !!sdr + ')'); continue; }
  const used = new Set([...used0, att.baseSpecies, sap.baseSpecies, sdr.baseSpecies]);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
  if (fills.length < 3) continue;
  const dm = drainOf(att, h);
  const B = ab => [mon(h, '', [hIdle.name, 'Protect'], ab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const A = x => [mon(x.s, '', [x.m, 'Protect'], quiet(x.s) || speOnly(x.s)), mon(fills[2], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[0], '', ['Protect'])];
  const hit = mv => [{ p1: [{ m: mv, t: 0 }, P.protect], p2: [{ m: hIdle.id }, P.protect] }];
  const d = play('drain', A({ s: att, m: dm.name }), B(AB), hit(dm.id));
  if (!d.staged) { console.log('   (skip ' + h.id + ' drain: ' + d.why + ')'); continue; }
  const s = play('sap', A({ s: sap, m: SAP.name }), B(AB), hit(SAP.id));
  const e = play('seed', A({ s: sdr, m: SEED.name }), B(AB), hit(SEED.id));
  const c = play('control', A({ s: att, m: dm.name }), B(other), hit(dm.id));
  if (!s.staged || !e.staged || !c.staged) { console.log('   (skip ' + h.id + ': ' + (s.why || e.why || c.why) + ')'); continue; }
  d.cast = att.id + ' --' + dm.id + '--> ' + h.id + ' (' + AB + ')';
  s.cast = sap.id + ' --' + SAP.id + '--> ' + h.id + ' (' + AB + ')';
  e.cast = sdr.id + ' --' + SEED.id + '--> ' + h.id + ' (' + AB + '), residual';
  c.cast = att.id + ' --' + dm.id + '--> ' + h.id + ' (' + other + ')';
  d.att = att.id; s.att = sap.id; e.att = sdr.id; c.att = att.id;
  DR = d; SP = s; SD = e; CT = c; break outer;
}
const RUNS = [['DRAIN', DR], ['SAP', SP], ['SEED', SD], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const oozeOn = R => R.sdK.some(l => new RegExp('^\\|-damage\\|p1a:' + R.att + '\\|[^|]*\\|\\[from\\]ability:' + AB).test(l));
ok(oozeOn(DR), 'DRAIN — the full-HP drainer is damaged by the holder\'s ability');
ok(oozeOn(SP), 'SAP — the full-HP user is damaged');
ok(oozeOn(SD), 'SEED — the full-HP seeder is damaged at the residual');
ok(!oozeOn(CT) && !CT.sdK.some(l => /^\|-damage\|p1a:/.test(l)), 'CONTROL — on another ability, nothing touches the drainer');

K.compareArms(RUNS, KEEP, '-damage / -heal / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(DR.counters.ooze === 1 && SP.counters.ooze === 1 && SD.counters.ooze >= 1 && CT.counters.ooze === 0,
    'the engine\'s receipts: one reversal per heal in each arm, none in CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + R.counters.ooze)));
}
K.finish();
