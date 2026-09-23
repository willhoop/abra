#!/usr/bin/env node
/* tests/probe_regmc_transformed_toll_at_faint.js — A TRANSFORMED BODY KNOCKED OUT BY A CONTACT MOVE STILL CHARGES ITS KILLER
 * THE COPIED ROUGH SKIN. 2026-09-22 (abra/regmc 0.58.0).
 *
 *   node tests/probe_regmc_transformed_toll_at_faint.js --regulation regmc                                     # green, exit 0
 *   MEDI_DH_READS_REVERTED_ABILITY=1 node tests/probe_regmc_transformed_toll_at_faint.js --regulation regmc      # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts roughskin :3938-3949 (the Champions mod names neither Rough Skin nor Imposter):
 *       `onDamagingHitOrder: 1, onDamagingHit(damage, target, source, move) { if (checkMoveMakesContact(...))
 *        this.damage(source.baseMaxhp / 8, source, target); }` -- no HP test on the holder.
 *   data/mods/champions/scripts.ts spreadMoveHit :315-426: `runEvent('DamagingHit')` inside the move; the faint is written
 *       later by `faintMessages`, which runs `runEvent('Faint')` (sim/battle.ts :2555) and THEN `clearVolatile(false)`
 *       (:2563) -- the call that ends a transformation. So the DamagingHit handlers of a body the hit just knocked out
 *       are the COPIED ability's.
 *
 *   The pinned 1950 card (`pair-protect-bust …bo3-2678161087` t4): Garchomp's Stomping Tantrum KOs a Ditto transformed into
 *   Garchomp; the authority writes `-damage|p2a: Garchomp|54/183|[from] ability: Rough Skin|[of] p1b: Ditto`, this engine
 *   nothing (its faint bookkeeping reverts the transformation at the HP-zero moment, above the toll).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   KO        Ditto (Imposter) leads opposite a Rough Skin carrier and copies it; the carrier's contact move knocks the Ditto
 *             out: the copied Rough Skin charges it.
 *   STANDS    the same with a contact move that leaves the Ditto standing: the toll, and no faint (the control that the
 *             copied ability tolls at all).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_transformed_toll_at_faint', ['MEDI_DH_READS_REVERTED_ABILITY']);
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P, legal } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const tollAb = D.abilities.all().filter(a => legal(a) && a.onDamagingHit && /checkMoveMakesContact/.test(String(a.onDamagingHit))
  && /this\.damage\(/.test(String(a.onDamagingHit)) && !/status|trySetStatus|boost/i.test(String(a.onDamagingHit))
  && !/!target\.hp|target\.hp\)/.test(String(a.onDamagingHit))).map(a => a.id);
const TRANSFORMERS = SPEC.filter(s => abil(s).includes('imposter'));
const CARRIERS = SPEC.filter(s => abil(s).some(a => tollAb.includes(a)) && learns(s, 'protect'));
console.log('     contact-toll abilities: ' + tollAb.join(', ') + '   Imposter bodies: ' + show(TRANSFORMERS) + '   carriers: ' + show(CARRIERS));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-transform|-damage|faint)\|/;
const OWN = /^\|(-damage\|[^|]*\|[^|]*\|\[from\]ability|faint)/;
const counters = () => ({ worn: K.M.MEDSEEN.dhAbilityWornAtFaint || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const SELFUP = ['swordsdance', 'bulkup', 'irondefense', 'amnesia', 'calmmind', 'nastyplot', 'growth', 'workup', 'agility'];
const up = s => SELFUP.map(x => D.moves.get(x)).find(m => legal(m) && learns(s, m.id)) || null;
const contact = (f, dit) => D.moves.all().filter(m => K.plain(m) && !m.multihit && K.sure(m) && m.flags.contact && learns(f, m.id)
  && D.getImmunity(m.type, dit)).sort((a, b) => b.basePower - a.basePower);

let KO = null, SD = null;
outer: for (const dt of TRANSFORMERS) for (const f of CARRIERS) {
  const ab = abil(f).find(a => tollAb.includes(a));
  const used = new Set([dt.baseSpecies, dt.id, f.baseSpecies, f.id]);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
  if (fills.length < 4) continue;
  const MOVES = contact(f, f);   // the Ditto wears the carrier's types
  const fu = up(f);
  if (!MOVES.length || !fu) continue;
  const tname = K.canon(dt.name.split('-')[0]);
  const A = [mon(dt, '', ['Transform'], 'imposter'), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
  const B = h => [mon(fills[2], '', ['Protect']), mon(f, '', ['Protect', h.name, fu.name], ab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  let ko = null, st = null;
  for (const h of MOVES) {
    /* the Ditto (slot a) copies foe slot b (Imposter's `foe.active[length - 1 - position]`) and with it the carrier's moves;
     * it clicks the copied self boost while the carrier hits it */
    const t = { p1: [{ m: fu.id }, P.protect], p2: [P.protect, { m: h.id, t: 0 }] };
    const r = play('probe-' + h.id, A, B(h), [t]);
    if (!r.staged) continue;
    const dead = r.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + tname).test(l));
    const tolled = r.sdK.some(l => /^\|-damage\|p2b[^|]*\|[^|]*\|\[from\]ability:/.test(l));
    if (!r.sdK.some(l => /^\|-transform\|p1a/.test(l))) break;
    if (dead && !ko) { r.cast = dt.id + ' copies ' + f.id + ' (' + ab + '); ' + f.id + "'s " + h.id + ' knocks it out'; ko = r; }
    if (!dead && tolled && !st) { r.cast = 'the same, ' + f.id + "'s " + h.id + ' (the Ditto stands)'; st = r; }
    if (ko && st) break;
  }
  if (ko && st) { ko.tname = st.tname = tname; KO = ko; SD = st; break outer; }
}
const RUNS = [['KO', KO], ['STANDS', SD]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const toll = R => R.sdK.filter(l => new RegExp('^\\|-damage\\|p2b[^|]*\\|[^|]*\\|\\[from\\]ability:[^|]*\\|\\[of\\]p1a:' + R.tname).test(l)).length;
const dead = R => R.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + R.tname).test(l));
ok(dead(KO) && toll(KO) === 1, 'KO — the transformed body is knocked out and its copied ability still charges the attacker');
ok(!dead(SD) && toll(SD) === 1, 'STANDS — the transformed body survives and its copied ability charges the attacker');

K.compareArms(RUNS, OWN, 'ability-toll / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(KO.counters.worn >= 1 && SD.counters.worn === 0, 'the engine\'s receipt: the worn ability read at the faint in KO, never in STANDS',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
