#!/usr/bin/env node
/* tests/probe_regmc_ice_spinner_fainted_user.js — ICE SPINNER ENDS THE TERRAIN EVEN WHEN A CONTACT TOLL KNOCKS ITS USER
 * OUT, UNDER REG M-C. 2026-09-22 (abra/regmc 0.53.0).
 *
 *   node tests/probe_regmc_ice_spinner_fainted_user.js --regulation regmc                                     # green, exit 0
 *   MEDI_AFTERHIT_NEEDS_LIVE_USER=1 node tests/probe_regmc_ice_spinner_fainted_user.js --regulation regmc       # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/scripts.ts spreadMoveHit :315-426 -- the Champions mod's OWN copy -- raises
 *       if (moveData.onAfterHit) { for (const t of damagedTargets) this.battle.singleEvent('AfterHit', moveData, {}, t, pokemon, move); }
 *   right after `runEvent('DamagingHit', ...)`, with NO `pokemon.hp` guard. Mainline sim/battle-actions.ts :1123 has
 *   `if (moveData.onAfterHit && pokemon.hp)`; the mod dropped it (the Reg M-B checkout's mod is the same). And
 *   data/moves.ts icespinner :9417-9437: `onAfterHit(target, source) { this.field.clearTerrain(); }` -- no HP check of
 *   its own (only `onAfterSubDamage` asks `source.hp`). So a user that a Rough Skin + Rocky Helmet toll knocks out
 *   still ends the terrain, above its own `|faint|`.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   FAINTS    t1 the Ice Spinner user (a Ghost) Curses the foe (half its own HP); t2 it makes a Substitute (a quarter)
 *             while its partner raises a terrain; t3 its Ice Spinner hits a Rough Skin foe holding Rocky Helmet, whose
 *             tolls knock it out: the terrain still ends.
 *   STANDS    the CONTROL: t1 the user Protects instead of Cursing, so it survives the tolls; the terrain ends on both.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_ice_spinner_fainted_user', ['MEDI_AFTERHIT_NEEDS_LIVE_USER']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const MV = Object.keys(TAGS.moves).find(m => (TAGS.moves[m].params || {}).clearsTerrainAfterHit);
const withTag = (kind, t) => Object.keys(TAGS[kind]).filter(x => (TAGS[kind][x].tags || []).includes(t));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     clearsTerrainAfterHit: ' + MV);
/* the tolls: an ability and an item that damage a contact attacker (tag `punishesContactAbility`-shaped rows vary, so the
 * dex handler is read: onDamagingHit that damages the source on contact) */
const tollAb = D.abilities.all().filter(a => K.legal(a) && a.onDamagingHit && /checkMoveMakesContact/.test(String(a.onDamagingHit))
  && /this\.damage\(/.test(String(a.onDamagingHit)) && !/status|trySetStatus|boost/i.test(String(a.onDamagingHit))).map(a => a.id);
const tollIt = D.items.all().filter(i => K.legal(i) && i.onDamagingHit && /checkMoveMakesContact/.test(String(i.onDamagingHit))
  && /this\.damage\(/.test(String(i.onDamagingHit))).map(i => i.id);
console.log('     contact-toll abilities: ' + tollAb.join(', ') + '   contact-toll items: ' + tollIt.join(', '));
const USERS = SPEC.filter(s => learns(s, MV) && learns(s, 'curse') && learns(s, 'substitute') && learns(s, 'protect') && s.types.includes('Ghost'));
const FOES = SPEC.filter(s => abil(s).some(a => tollAb.includes(a)) && learns(s, 'protect'));
const SETTERS = SPEC.filter(s => quiet(s) && learns(s, 'protect') && ['electricterrain', 'mistyterrain', 'psychicterrain'].some(t => learns(s, t)));
console.log('     users (Ghost; Curse, Substitute, ' + MV + '): ' + show(USERS) + '   toll foes: ' + show(FOES));
const KEEP = /^\|(-fieldstart|-fieldend|-damage|faint|-start|-activate)\|/;
const OWN = /^\|(-fieldend|faint)\|/;
const counters = () => ({ cleared: K.M.MEDSEEN.terrainClearedAfterHit || 0, dead: K.M.MEDSEEN.terrainClearedByFaintedUser || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let FA = null, ST = null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
outer: for (const u of USERS) for (const f of FOES.filter(s => D.getImmunity(D.moves.get(MV).type, s) && D.getEffectiveness(D.moves.get(MV).type, s) < 0))
  for (const st of SETTERS.filter(s => ![u.baseSpecies, f.baseSpecies].includes(s.baseSpecies)).slice(0, 6)) {
    const tm = ['electricterrain', 'mistyterrain', 'psychicterrain'].find(t => learns(st, t));
    /* a click the foe can repeat on all three turns without failing: a self boost (Focus Energy fails the second time) */
    const fi = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.heal
      && !m.onHit && !m.onTry && !m.volatileStatus && learns(f, m.id)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    if (!fi) continue;
    const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id, st.baseSpecies, st.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
    if (fills.length < 3) continue;
    const ab = abil(f).find(a => tollAb.includes(a));
    const A = [mon(u, '', [D.moves.get(MV).name, 'Curse', 'Substitute', 'Protect']), mon(st, '', [D.moves.get(tm).name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const B = [mon(f, tollIt[0], ['Protect', fi.name], ab), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const s1 = first => ({ p1: [first, P.protect], p2: [{ m: fi.id }, P.protect] });
    const s2 = { p1: [{ m: 'substitute' }, { m: tm }], p2: [{ m: fi.id }, P.protect] };
    const s3 = { p1: [{ m: MV, t: 0 }, P.protect], p2: [{ m: fi.id }, P.protect] };
    const r = play('faints', A, B, [s1({ m: 'curse', t: 0 }), s2, s3]);
    if (!r.staged) { console.log('   (skip ' + [u.id, f.id, st.id].join('/') + ': ' + r.why + ')'); continue; }
    const c = play('stands', A, B, [s1(P.protect), s2, s3]);
    if (!c.staged) { console.log('   (skip stands ' + c.why + ')'); continue; }
    r.cast = u.id + ' Curse t1, Substitute t2 (' + st.id + ' ' + tm + '), ' + MV + ' t3 into ' + f.id + ' (' + ab + ' @' + tollIt[0] + ')';
    c.cast = 'the same with Protect on t1';
    r.uname = K.canon(u.name.split('-')[0]);
    FA = r; ST = c; break outer;
  }
const RUNS = [['FAINTS', FA], ['STANDS', ST]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const ends = R => R.sdK.filter(l => /^\|-fieldend\|/.test(l)).length;
const uFaint = R => R.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + FA.uname).test(l));
ok(uFaint(FA) && ends(FA) === 1, 'FAINTS — the tolls knock the user out and the terrain still ends');
ok(!uFaint(ST) && ends(ST) === 1, 'STANDS — the user survives and the terrain ends');

/* NOT `K.compareArms`: the FAINTS arm's first protocol divergence is turn 1's Ghost Curse line (the authority writes the
 * user's `-damage` above `-start|<foe>|curse|[of] <user>`; this engine writes the `-start` first, with a bare `[of]`), a
 * separate narration defect that moves no board and is named in the report rather than fixed here. So each arm asserts
 * this mechanic's lines in order and the boards at every boundary, and prints its first protocol divergence. */
console.log('\n4. MEDICHAM AGAINST THE AUTHORITY');
for (const [tag, R] of RUNS) {
  const sdO = R.sdK.filter(l => OWN.test(l)).map(l => l.replace(/move:/, '')), meO = R.meK.filter(l => OWN.test(l)).map(l => l.replace(/move:/, ''));
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  ok(same, tag + ' — every -fieldend / faint line agrees in order', same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' '));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
  console.log('    (' + tag + ' first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none') + ')');
}
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(FA.counters.cleared === 1 && FA.counters.dead === 1 && ST.counters.cleared === 1 && ST.counters.dead === 0,
    'one clear in each arm, the FAINTS one by a fainted user', JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
