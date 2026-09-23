#!/usr/bin/env node
/* tests/probe_regmc_spin_fainted_user.js — RAPID SPIN / MORTAL SPIN CLEAR THEIR USER'S SIDE EVEN WHEN A CONTACT TOLL KNOCKS
 * THE USER OUT. 2026-09-22 (abra/regmc 0.61.0).
 *
 *   node tests/probe_regmc_spin_fainted_user.js --regulation regmc                                  # green, exit 0
 *   MEDI_SPIN_NEEDS_LIVE_USER=1 node tests/probe_regmc_spin_fainted_user.js --regulation regmc       # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts rapidspin :14703-14734 / mortalspin :12323-12354 (the Champions mod names neither):
 *       onAfterHit(target, pokemon, move) { if (!move.hasSheerForce) {
 *           if (pokemon.removeVolatile('leechseed')) this.add('-end', ...);          -- removeVolatile refuses !hp
 *           for (condition of [...hazards]) if (pokemon.side.removeSideCondition(condition)) this.add('-sideend', ...);
 *                                                                                     -- a SIDE method: no HP test
 *           if (pokemon.volatiles['partiallytrapped']) pokemon.removeVolatile('partiallytrapped'); } }
 *       onAfterSubDamage(...) -- every piece gated on `pokemon.hp`.
 *   data/mods/champions/scripts.ts spreadMoveHit :315-426: `runEvent('DamagingHit')` (the tolls), then `AfterHit` with no
 *       `pokemon.hp` test. So a user a toll just knocked out still clears its side's hazards (and nothing else).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   FAINTS    the foe's partner lays a hazard on our side while the Rough Skin / Rocky Helmet foe brings our spinner low;
 *             then the spin into the toll foe: the tolls KO the spinner, and the hazard still leaves our side.
 *   STANDS    the toll foe idles instead of hitting: the spinner survives, and the hazard leaves (the control).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_spin_fainted_user', ['MEDI_SPIN_NEEDS_LIVE_USER']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const MOVES = Object.keys(TAGS.moves).filter(m => { const r = (TAGS.moves[m].params || {}).removesHazards; return r && r.hazardsFrom === 'self'; })
  .map(m => D.moves.get(m)).filter(m => K.legal(m) && m.category !== 'Status' && m.flags.contact);
console.log('     removesHazards from self (legal, damaging, contact): ' + MOVES.map(m => m.id).join(', '));
const tollAb = D.abilities.all().filter(a => K.legal(a) && a.onDamagingHit && /checkMoveMakesContact/.test(String(a.onDamagingHit))
  && /this\.damage\(/.test(String(a.onDamagingHit)) && !/status|trySetStatus|boost/i.test(String(a.onDamagingHit))
  && !/!target\.hp|target\.hp\)/.test(String(a.onDamagingHit))).map(a => a.id);
const tollIt = D.items.all().filter(i => K.legal(i) && i.onDamagingHit && /checkMoveMakesContact/.test(String(i.onDamagingHit))
  && /this\.damage\(/.test(String(i.onDamagingHit))).map(i => i.id);
const FOES = SPEC.filter(s => abil(s).some(a => tollAb.includes(a)) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const HZ = ['stealthrock', 'spikes'].filter(h => K.legal(D.moves.get(h)));
const SETTERS = FILL.filter(s => HZ.some(h => learns(s, h)));
console.log('     toll foes: ' + show(FOES) + '   hazard setters: ' + show(SETTERS));
const SELFUP = ['irondefense', 'amnesia', 'calmmind', 'bulkup', 'swordsdance', 'nastyplot', 'growth', 'workup', 'agility', 'cottonguard', 'acidarmor'];
const idle = s => { const k = K.idle(s); const up = SELFUP.map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)); return (k && k.id !== 'focusenergy' ? k : up || k) || null; };
const KEEP = /^\|(-sidestart|-sideend|-damage|faint)\|/;
const OWN = /^\|(-sideend|faint)\|/;
const counters = () => ({ swept: K.M.MEDSEEN.hazardSweepAtAfterHit || 0, dead: K.M.MEDSEEN.hazardSweepByFaintedUser || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const hpOf = (R, who) => { let hp = null, max = null; for (const l of R.sdK) { const x = new RegExp('^\\|-damage\\|p1a:' + who + '\\|(\\d+)/(\\d+)').exec(l); if (x) { hp = +x[1]; max = +x[2]; } } return { hp, max }; };

let FA = null, ST = null;
outer: for (const mv of MOVES) {
  const USERS = SPEC.filter(s => learns(s, mv.id) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(a) - bulk(b));
  console.log('     ' + mv.id + ' users: ' + show(USERS));
  for (const u of USERS) for (const f of FOES.filter(s => D.getImmunity(mv.type, s))) for (const st of SETTERS.slice(0, 6)) {
    if (new Set([u.baseSpecies, f.baseSpecies, st.baseSpecies]).size < 3) continue;
    const hz = HZ.find(h => learns(st, h));
    const fi = idle(f), si = idle(st);
    if (!fi || !si) continue;
    const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id, st.baseSpecies, st.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
    if (fills.length < 3) continue;
    const ab = abil(f).find(a => tollAb.includes(a));
    const uab = quiet(u) || abil(u)[0];
    const uname = K.canon(u.name.split('-')[0]);
    const ui = idle(u);
    const HITS = D.moves.all().filter(m => K.plain(m) && !m.multihit && K.sure(m) && learns(f, m.id) && D.getImmunity(m.type, u))
      .sort((a, b) => b.basePower - a.basePower).slice(0, 12);
    let found = false;
    for (const h of HITS) for (const n of [1, 2]) {
      const A = [mon(u, '', [mv.name, ui.name, 'Protect'], uab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
      const B = [mon(f, tollIt[0], ['Protect', fi.name, h.name], ab), mon(st, '', [D.moves.get(hz).name, si.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      /* turn 1 the setter lays the hazard on our side; every lowering turn the toll foe hits (or idles, in STANDS) */
      const low = (hit, i) => ({ p1: [{ m: ui.id }, P.protect], p2: [hit ? { m: h.id, t: 0 } : { m: fi.id }, i === 0 ? { m: hz } : { m: si.id }] });
      const shot = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: fi.id }, { m: si.id }] };
      const pre = play('lower', A, B, Array.from({ length: n }, (_, i) => low(true, i)));
      if (!pre.staged) continue;
      const { hp, max } = hpOf(pre, uname);
      if (!(hp > 0 && max) || hp > Math.floor(max / 8) + Math.floor(max / 6)) continue;
      const r = play('faints', A, B, [...Array.from({ length: n }, (_, i) => low(true, i)), shot]);
      if (!r.staged) { console.log('   (skip ' + [u.id, f.id, h.id].join('/') + ': ' + r.why + ')'); continue; }
      if (!r.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + uname).test(l))) continue;
      const c = play('stands', A, B, [...Array.from({ length: n }, (_, i) => low(false, i)), shot]);
      if (!c.staged) { console.log('   (skip stands ' + c.why + ')'); continue; }
      r.cast = st.id + ' ' + hz + ' on our side; ' + f.id + ' (' + ab + ' @' + tollIt[0] + ') ' + h.id + ' x' + n + ' brings ' + u.id + ' to '
        + hp + '/' + max + ', then its ' + mv.id;
      c.cast = 'the same, ' + f.id + ' idling (' + fi.id + ')';
      r.uname = c.uname = uname;
      FA = r; ST = c; found = true; break;
    }
    if (found) break outer;
  }
}
const RUNS = [['FAINTS', FA], ['STANDS', ST]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const swept = R => R.sdK.filter(l => /^\|-sideend\|p1/.test(l)).length;
const uFaint = R => R.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + R.uname).test(l));
ok(uFaint(FA) && swept(FA) >= 1, 'FAINTS — the tolls knock the spinner out and the hazard still leaves its side');
ok(!uFaint(ST) && swept(ST) >= 1, 'STANDS — the spinner survives and the hazard leaves its side');

/* the driver folds the side label of a `-sideend` line (`p1: A` there, `p1: ` here) and so does this comparison */
console.log('\n4. MEDICHAM AGAINST THE AUTHORITY');
const fold = l => l.replace(/^\|-sideend\|(p\d)[^|]*\|(move:)?/, '|-sideend|$1|');
for (const [tag, R] of RUNS) {
  const sdO = R.sdK.filter(l => OWN.test(l)).map(fold), meO = R.meK.filter(l => OWN.test(l)).map(fold);
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  ok(!R.div && same, tag + ' — no protocol divergence, and every -sideend / faint line agrees in order',
    R.div ? JSON.stringify(R.div) : (same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' ')));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
}
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(FA.counters.swept === 1 && FA.counters.dead === 1 && ST.counters.swept === 1 && ST.counters.dead === 0,
    'one sweep per arm, the FAINTS one by a fainted user', JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
