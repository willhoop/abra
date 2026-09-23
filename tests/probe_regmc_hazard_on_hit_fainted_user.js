#!/usr/bin/env node
/* tests/probe_regmc_hazard_on_hit_fainted_user.js — STONE AXE / CEASELESS EDGE LAY THEIR HAZARD EVEN WHEN A CONTACT TOLL
 * KNOCKS THEIR USER OUT. 2026-09-22 (abra/regmc 0.60.0).
 *
 *   node tests/probe_regmc_hazard_on_hit_fainted_user.js --regulation regmc                                 # green, exit 0
 *   MEDI_HAZARD_ON_HIT_NEEDS_LIVE_USER=1 node tests/probe_regmc_hazard_on_hit_fainted_user.js --regulation regmc # RED
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts stoneaxe :18078-18091 / ceaselessedge :2229-2242 (the Champions mod names neither):
 *       onAfterHit(target, source, move) { if (!move.hasSheerForce) for (side of source.side.foeSidesWithConditions())
 *           side.addSideCondition('stealthrock' | 'spikes'); }            -- no HP test
 *       onAfterSubDamage(...) { if (!move.hasSheerForce && source.hp) ... }  -- the Substitute road asks it
 *   data/mods/champions/scripts.ts spreadMoveHit :315-426 (the same in the Reg M-B checkout): `runEvent('DamagingHit')` (the
 *       tolls) and then `singleEvent('AfterHit', ...)` with NO `pokemon.hp` test (mainline's `sim/battle-actions.ts` :1123
 *       has one; Champions dropped it -- pass 5 §5, Ice Spinner). So a user a toll just knocked out still lays the hazard.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   FAINTS    a Rough Skin foe holding a Rocky Helmet brings the user low with its own hits (found by playing them), then the
 *             user's hazard move into it: the tolls knock the user out, and the hazard is laid on the foe's side.
 *   STANDS    the foe idles instead: the user survives, and the hazard is laid (the control).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_hazard_on_hit_fainted_user', ['MEDI_HAZARD_ON_HIT_NEEDS_LIVE_USER']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const MOVES = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).hazardOnHit).map(m => D.moves.get(m))
  .filter(m => K.legal(m) && m.flags.contact);
console.log('     hazardOnHit (legal, contact): ' + MOVES.map(m => m.id + ' -> ' + TAGS.moves[m.id].params.hazardOnHit.hazard).join(', '));
const tollAb = D.abilities.all().filter(a => K.legal(a) && a.onDamagingHit && /checkMoveMakesContact/.test(String(a.onDamagingHit))
  && /this\.damage\(/.test(String(a.onDamagingHit)) && !/status|trySetStatus|boost/i.test(String(a.onDamagingHit))
  && !/!target\.hp|target\.hp\)/.test(String(a.onDamagingHit))).map(a => a.id);
const tollIt = D.items.all().filter(i => K.legal(i) && i.onDamagingHit && /checkMoveMakesContact/.test(String(i.onDamagingHit))
  && /this\.damage\(/.test(String(i.onDamagingHit))).map(i => i.id);
console.log('     contact-toll abilities: ' + tollAb.join(', ') + '   items: ' + tollIt.join(', '));
const FOES = SPEC.filter(s => abil(s).some(a => tollAb.includes(a)) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const SELFUP = ['irondefense', 'amnesia', 'calmmind', 'bulkup', 'swordsdance', 'nastyplot', 'growth', 'workup', 'agility', 'cottonguard', 'acidarmor'];
const idle = s => { const k = K.idle(s); const up = SELFUP.map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)); return (k && k.id !== 'focusenergy' ? k : up || k) || null; };
const KEEP = /^\|(-sidestart|-damage|faint)\|/;
const OWN = /^\|(-sidestart|faint)\|/;
const counters = () => ({ laid: K.M.MEDSEEN.hazardOnHitAtAfterHit || 0, dead: K.M.MEDSEEN.hazardOnHitByFaintedUser || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const hpOf = (R, who) => { let hp = null, max = null; for (const l of R.sdK) { const x = new RegExp('^\\|-damage\\|p1a:' + who + '\\|(\\d+)/(\\d+)').exec(l); if (x) { hp = +x[1]; max = +x[2]; } } return { hp, max }; };

let FA = null, ST = null;
outer: for (const mv of MOVES) {
  const USERS = SPEC.filter(s => learns(s, mv.id) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(a) - bulk(b));
  console.log('     ' + mv.id + ' users: ' + show(USERS));
  for (const u of USERS) for (const f of FOES.filter(s => D.getImmunity(mv.type, s) && D.getEffectiveness(mv.type, s) < 0)) {
    const fi = idle(f);
    if (!fi) continue;
    const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (fills.length < 4) continue;
    const ab = abil(f).find(a => tollAb.includes(a));
    const uab = quiet(u) || abil(u)[0];
    const uname = K.canon(u.name.split('-')[0]);
    const ui = idle(u);
    const HITS = D.moves.all().filter(m => K.plain(m) && !m.multihit && K.sure(m) && learns(f, m.id) && D.getImmunity(m.type, u))
      .sort((a, b) => b.basePower - a.basePower).slice(0, 12);
    for (const h of HITS) for (const n of [1, 2]) {
      const A = [mon(u, '', [mv.name, ui.name, 'Protect'], uab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
      const B = [mon(f, tollIt[0], ['Protect', fi.name, h.name], ab), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const low = hit => ({ p1: [{ m: ui.id }, P.protect], p2: [hit ? { m: h.id, t: 0 } : { m: fi.id }, P.protect] });
      const shot = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: fi.id }, P.protect] };
      const pre = play('lower', A, B, Array.from({ length: n }, () => low(true)));
      if (!pre.staged) continue;
      const { hp, max } = hpOf(pre, uname);
      if (!(hp > 0 && max) || hp > Math.floor(max / 8) + Math.floor(max / 6)) continue;
      const r = play('faints', A, B, [...Array.from({ length: n }, () => low(true)), shot]);
      if (!r.staged) { console.log('   (skip ' + [u.id, f.id, h.id].join('/') + ': ' + r.why + ')'); continue; }
      if (!r.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + uname).test(l))) continue;
      const c = play('stands', A, B, [...Array.from({ length: n }, () => low(false)), shot]);
      if (!c.staged) { console.log('   (skip stands ' + c.why + ')'); continue; }
      r.cast = f.id + ' (' + ab + ' @' + tollIt[0] + ') ' + h.id + ' x' + n + ' brings ' + u.id + ' to ' + hp + '/' + max + ', then its ' + mv.id;
      c.cast = 'the same, ' + f.id + ' idling (' + fi.id + ')';
      r.uname = c.uname = uname;
      FA = r; ST = c; break outer;
    }
  }
}
const RUNS = [['FAINTS', FA], ['STANDS', ST]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const laid = R => R.sdK.filter(l => /^\|-sidestart\|p2/.test(l)).length;
const uFaint = R => R.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + R.uname).test(l));
ok(uFaint(FA) && laid(FA) === 1, 'FAINTS — the tolls knock the user out and the hazard is still laid');
ok(!uFaint(ST) && laid(ST) === 1, 'STANDS — the user survives and the hazard is laid');

/* the driver folds the side label and the `move:` prefix of a `-sidestart` line (`p2: B|Spikes` there, `p2: |move: Spikes`
 * here) and so does this comparison; everything else in the line must agree, in order */
console.log('\n4. MEDICHAM AGAINST THE AUTHORITY');
const fold = l => l.replace(/^\|-sidestart\|(p\d)[^|]*\|(move:)?/, '|-sidestart|$1|');
for (const [tag, R] of RUNS) {
  const sdO = R.sdK.filter(l => OWN.test(l)).map(fold), meO = R.meK.filter(l => OWN.test(l)).map(fold);
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  ok(!R.div && same, tag + ' — no protocol divergence, and every -sidestart / faint line agrees in order',
    R.div ? JSON.stringify(R.div) : (same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' ')));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
}
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(FA.counters.laid === 1 && FA.counters.dead === 1 && ST.counters.laid === 1 && ST.counters.dead === 0,
    'one lay per arm, the FAINTS one by a fainted user', JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
