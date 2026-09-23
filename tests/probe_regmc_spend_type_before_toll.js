#!/usr/bin/env node
/* tests/probe_regmc_spend_type_before_toll.js — A MOVE THAT SPENDS ITS USER'S TYPE (DOUBLE SHOCK, BURN UP) SPENDS IT AT
 * `selfDrops`, ABOVE THE CONTACT TOLL -- SO A USER THE TOLL KNOCKS OUT FAINTS ON ITS OWN TYPES. 2026-09-22 (abra/regmc 0.57.0).
 *
 *   node tests/probe_regmc_spend_type_before_toll.js --regulation regmc                              # green, exit 0
 *   MEDI_SPEND_TYPE_AFTER_MOVE=1 node tests/probe_regmc_spend_type_before_toll.js --regulation regmc   # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts doubleshock :3945-3969 (and burnup): `self: { onHit(pokemon) { pokemon.setType(... '???' ...);
 *       this.add('-start', pokemon, 'typechange', ...) } }`. The Champions mod adds only a `punch` flag to Double Shock
 *       (data/mods/champions/moves.ts :254-257).
 *   data/mods/champions/scripts.ts spreadMoveHit :315-426 (the mod's own copy; the Reg M-B checkout's is the same): step 4
 *       `selfDrops` -- the `self` block, so the type change -- runs BEFORE `runEvent('DamagingHit', ...)`, where Rough Skin
 *       and Rocky Helmet charge the attacker, and before the target's `faint`. A user the tolls knock out then faints, and
 *       the faint rebuilds its types.
 *
 *   The pinned 1950 card (`omit-spread …bo3-2678871998` t8): Pawmot's Double Shock KOs Indeedee; the authority writes
 *   `-start|p1a: Pawmot|typechange|???/Fighting` above the Rocky Helmet `0 fnt`, and the fainted Pawmot reads
 *   Electric/Fighting; this engine wrote the type change after `|faint|` and it stuck to the corpse.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   FAINTS    a Rough Skin foe holding a Rocky Helmet brings the user low with its own hits (the first of its plain moves
 *             that leaves the user inside the two tolls' reach, found by playing it -- the bottom arm is deterministic),
 *             then the user's contact type-spending move into it: type change, the tolls, the user faints on its own types.
 *   STANDS    the foe idles instead of hitting: the user survives the tolls; the type change is still above them.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_spend_type_before_toll', ['MEDI_SPEND_TYPE_AFTER_MOVE']);
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const MOVES = D.moves.all().filter(m => K.legal(m) && m.self && m.self.onHit && /setType/.test(String(m.self.onHit)));
console.log('     legal moves whose self onHit sets the user\'s type: ' + MOVES.map(m => m.id + (m.flags.contact ? ' (contact)' : '')).join(', '));
const tollAb = D.abilities.all().filter(a => K.legal(a) && a.onDamagingHit && /checkMoveMakesContact/.test(String(a.onDamagingHit))
  && /this\.damage\(/.test(String(a.onDamagingHit)) && !/status|trySetStatus|boost/i.test(String(a.onDamagingHit))
  && !/!target\.hp|target\.hp\)/.test(String(a.onDamagingHit))).map(a => a.id);
const tollIt = D.items.all().filter(i => K.legal(i) && i.onDamagingHit && /checkMoveMakesContact/.test(String(i.onDamagingHit))
  && /this\.damage\(/.test(String(i.onDamagingHit))).map(i => i.id);
console.log('     contact-toll abilities: ' + tollAb.join(', ') + '   contact-toll items: ' + tollIt.join(', '));
const FOES = SPEC.filter(s => abil(s).some(a => tollAb.includes(a)) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const SELFUP = ['irondefense', 'amnesia', 'calmmind', 'bulkup', 'swordsdance', 'nastyplot', 'growth', 'workup', 'agility', 'cottonguard', 'acidarmor'];
/* a repeatable click: a self boost before Focus Energy, whose second use fails */
const idle = s => { const k = K.idle(s); const up = SELFUP.map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)); return (k && k.id !== 'focusenergy' ? k : up || k) || null; };
const KEEP = /^\|(-start|-damage|faint)\|/;
const OWN = /^\|(-start\|[^|]*\|typechange|-damage\|[^|]*\|[^|]*\|\[from\](item|ability)|faint)/;
const counters = () => ({ spent: K.M.MEDSEEN.ownTypeSpent || 0, early: K.M.MEDSEEN.ownTypeSpentAtSelfDrops || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const hpOf = (R, who) => {
  let hp = null, max = null;
  for (const l of R.sdK) {
    const x = new RegExp('^\\|-damage\\|p1a:' + who + '\\|(\\d+)/(\\d+)').exec(l);
    if (x) { hp = +x[1]; max = +x[2]; }
    if (new RegExp('^\\|-damage\\|p1a:' + who + '\\|0fnt').test(l)) hp = 0;
  }
  return { hp, max };
};

let FA = null, ST = null;
outer: for (const mv of MOVES.filter(m => m.flags && m.flags.contact)) {
  const USERS = SPEC.filter(s => learns(s, mv.id) && learns(s, 'protect') && s.types.includes(mv.type) && idle(s));
  console.log('     ' + mv.id + ' users: ' + show(USERS));
  for (const u of USERS) for (const f of FOES.filter(s => D.getImmunity(mv.type, s))) {
    const fi = idle(f);
    if (!fi) continue;
    const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (fills.length < 4) continue;
    const ab = abil(f).find(a => tollAb.includes(a));
    const uname = K.canon(u.name.split('-')[0]);
    const ui = idle(u);
    const HITS = D.moves.all().filter(m => K.plain(m) && !m.multihit && K.sure(m) && learns(f, m.id) && D.getImmunity(m.type, u))
      .sort((a, b) => b.basePower - a.basePower).slice(0, 12);
    for (const h of HITS) for (const n of [1, 2]) {
      const A = [mon(u, '', [mv.name, ui.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
      const B = [mon(f, tollIt[0], ['Protect', fi.name, h.name], ab), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const low = hit => ({ p1: [{ m: ui.id }, P.protect], p2: [hit ? { m: h.id, t: 0 } : { m: fi.id }, P.protect] });
      const shot = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: fi.id }, P.protect] };
      const pre = play('lower', A, B, Array.from({ length: n }, () => low(true)));
      if (!pre.staged) continue;
      const { hp, max } = hpOf(pre, uname);
      if (!(hp > 0 && max)) continue;
      const reach = Math.floor(max / 8) + Math.floor(max / 6);
      if (hp > reach) continue;
      const r = play('faints', A, B, [...Array.from({ length: n }, () => low(true)), shot]);
      if (!r.staged) { console.log('   (skip ' + [u.id, f.id, h.id].join('/') + ': ' + r.why + ')'); continue; }
      const c = play('stands', A, B, [...Array.from({ length: n }, () => low(false)), shot]);
      if (!c.staged) { console.log('   (skip stands ' + c.why + ')'); continue; }
      r.cast = f.id + ' (' + ab + ' @' + tollIt[0] + ') ' + h.id + ' x' + n + ' brings ' + u.id + ' to ' + hp + '/' + max + ', then its ' + mv.id;
      c.cast = 'the same, ' + f.id + ' idling (' + fi.id + ') instead of hitting';
      r.uname = c.uname = uname;
      FA = r; ST = c; break outer;
    }
  }
}
const RUNS = [['FAINTS', FA], ['STANDS', ST]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const iTc = R => R.sdK.findIndex(l => new RegExp('^\\|-start\\|p1a:' + R.uname + '\\|typechange\\|').test(l));
const iToll = R => R.sdK.findIndex(l => new RegExp('^\\|-damage\\|p1a:' + R.uname + '\\|[^|]*\\|\\[from\\]').test(l));
const uFaint = R => R.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + R.uname).test(l));
ok(uFaint(FA) && iTc(FA) >= 0 && iToll(FA) > iTc(FA), 'FAINTS — the type change is written above the toll, and the tolls knock the user out');
ok(!uFaint(ST) && iTc(ST) >= 0 && iToll(ST) > iTc(ST), 'STANDS — the user survives; the type change is still above the toll');

/* each arm asserts this mechanic's lines in order and the boards at every boundary, and prints its first protocol divergence */
console.log('\n4. MEDICHAM AGAINST THE AUTHORITY');
for (const [tag, R] of RUNS) {
  const norm = l => l.replace(/\[from\]move:.*$/, '[from]move').replace(/\[from\](item|ability):([^|]*)/, (x, k, n) => '[from]' + k + ':' + n.replace(/-/g, ''));
  const sdO = R.sdK.filter(l => OWN.test(l)).map(norm), meO = R.meK.filter(l => OWN.test(l)).map(norm);
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  ok(same, tag + ' — every typechange / toll / faint line agrees in order', same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' '));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
  console.log('    (' + tag + ' first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none') + ')');
}
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(FA.counters.spent === 1 && FA.counters.early === 1 && ST.counters.spent === 1 && ST.counters.early === 1,
    'one type spend per arm, each at selfDrops', JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
