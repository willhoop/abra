#!/usr/bin/env node
/* tests/probe_regmc_typeless_stab.js — A '???' MOVE FROM A '???' BODY TAKES NO STAB, UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.47.0).
 *
 *   node tests/probe_regmc_typeless_stab.js --regulation regmc                      # green, exit 0
 *   MEDI_TYPELESS_STAB=1 node tests/probe_regmc_typeless_stab.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/scripts.ts :228-233 (Champions' own modifyDamage):
 *       // The "???" type never gets STAB ...  if (type !== '???') { ... isSTAB ... }
 *   Struggle's onModifyMove sets `move.type = '???'` (data/moves.ts struggle :18224-18227; tag `setsOwnTypeAlways`).
 *   A body becomes '???' by spending its only type (Burn Up / Double Shock, tag `spendsOwnType.becomes`).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   SPENT     t1 the user (mono-typed, one move: the spender) spends its type on its own partner (which resists it);
 *             t2 a foe Disables that move; t3 the user has no usable move and Struggles into a foe at full HP. The user
 *             is '???', the move is '???': no STAB.
 *   CONTROL   the same user and foe, the user's one move a status click that spends nothing (a self boost, else a
 *             weather move), Disabled the same way: it Struggles as its own type, which the move's '???' does not match.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_typeless_stab', ['MEDI_TYPELESS_STAB']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const TYPELESS_MOVES = Object.keys(TAGS.moves).filter(m => ((TAGS.moves[m].params || {}).setsOwnTypeAlways || {}).type === '???');
const SPENDERS = Object.keys(TAGS.moves).filter(m => ((TAGS.moves[m].params || {}).spendsOwnType || {}).becomes === '???'
  && K.legal(D.moves.get(m)));
const DISABLE = Object.keys(TAGS.moves).find(m => (TAGS.moves[m].tags || []).includes('sealsMoves') && K.legal(D.moves.get(m))
  && D.moves.get(m).volatileStatus === 'disable');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     setsOwnTypeAlways ???: ' + TYPELESS_MOVES.join(', ') + '   spendsOwnType -> ???: ' + SPENDERS.join(', ')
  + '   the Disable move: ' + DISABLE);
ok(TYPELESS_MOVES.length > 0 && SPENDERS.length > 0 && !!DISABLE, 'a typeless move, a type spender and a move-sealer exist');
if (!SPENDERS.length || !DISABLE) K.finish();

const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
/* the user: mono-typed in exactly the type a spender removes, and learns it */
const USERS = [];
for (const mv of SPENDERS) {
  const need = TAGS.moves[mv].params.spendsOwnType.requires;
  for (const s of SPEC.filter(x => quiet(x) && x.types.length === 1 && x.types[0] === need && learns(x, mv))) USERS.push({ s, mv });
}
console.log('     users (mono-typed spenders): ' + USERS.slice(0, 6).map(u => u.s.id + '/' + u.mv).join(', '));
const KEEP = /^\|(-damage|-start|-activate|cant|-fail)\|/;
const OWN = /^\|-damage\|/;
const counters = () => ({ refused: K.M.MEDSEEN.typelessStabRefused || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let SPT = null, CTL = null;
outer: for (const { s: u, mv } of USERS) {
  /* the control user: the same shape, one plain self-targeted status move it can Disable-lose (no type spent) */
  const byId = (a, b) => (a.id < b.id ? -1 : 1);
  const ctlMv = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
    && !m.heal && !m.onHit && !m.onTry && !m.volatileStatus && learns(u, m.id)).sort(byId)[0]
    /* else a weather move: it touches no HP and no stat, and a '???' Struggle is not a type any weather scales */
    || D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.weather && learns(u, m.id)).sort(byId)[0];
  if (!ctlMv) continue;
  /* a REPEATABLE idle click: the kit's list without Focus Energy, whose second use fails on the authority */
  /* ...else a self boost that leaves Defence alone (Struggle is physical), repeatable for three turns */
  const idleOf = s => ['splash', 'celebrate', 'growl', 'tailwhip', 'leer', 'harden', 'defensecurl', 'withdraw']
    .map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id) && m.target !== 'normal')
    || D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.boosts.def
      && !m.heal && !m.onHit && !m.onTry && !m.volatileStatus && learns(s, m.id)).sort(byId)[0] || null;
  /* the spender's turn-1 target is the user's OWN PARTNER (`ally: true`), which must resist it, so no foe is
   * weakened before the Struggle lands on one of them at full HP */
  const allies = FILL.filter(s => s.baseSpecies !== u.baseSpecies && idleOf(s)
    && D.getImmunity(D.moves.get(mv).type, s) && D.getEffectiveness(D.moves.get(mv).type, s) < 0);
  const FOES = FILL.filter(s => s.baseSpecies !== u.baseSpecies && learns(s, DISABLE) && idleOf(s));
  console.log('     ' + u.id + ': partners that resist ' + mv + ' ' + show(allies) + ';  Disable foes ' + show(FOES));
  for (const foe of FOES.slice(0, 40)) {
    const ally = allies.find(s => s.baseSpecies !== foe.baseSpecies);
    if (!ally) continue;
    const used = new Set([u.baseSpecies, u.id, foe.baseSpecies, foe.id, ally.baseSpecies, ally.id]);
    const f2 = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies) && idleOf(s)), used, 1);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 2).concat(f2);
    if (fills.length < 3 || !f2.length) continue;
    const fi = idleOf(foe), ai = idleOf(ally), f2i = idleOf(fills[2]);
    /* t1: the user spends its type on its partner; everyone else idles. t2: the user clicks the spender again (the
     * foe's Disable seals it); its partner protects. t3: the user has no usable move and Struggles into a foe
     * (`randomNormal`); both foes stand, idling, so whichever the pinned target die names is struck. */
    const A = one => [mon(u, '', [one]), mon(ally, '', [ai.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const B = [mon(foe, '', [D.moves.get(DISABLE).name, fi.name, 'Protect']), mon(fills[2], '', [f2i.name, 'Protect']),
               mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const script = (one, selfAim) => [
      { p1: [selfAim ? { m: one } : { m: one, ally: true }, { m: ai.id }], p2: [{ m: fi.id }, { m: f2i.id }] },
      { p1: [selfAim ? { m: one } : { m: one, t: 0 }, P.protect], p2: [{ m: DISABLE, t: 0 }, { m: f2i.id }] },
      { p1: [{ m: 'struggle', t: 0 }, P.protect], p2: [{ m: fi.id }, { m: f2i.id }] },
    ];
    const r = play('spent', A(D.moves.get(mv).name), B, script(mv));
    if (!r.staged) { console.log('   (skip ' + u.id + '/' + foe.id + ': ' + r.why + ')'); continue; }
    const c = play('control', A(ctlMv.name), B, script(ctlMv.id, true));
    if (!c.staged) { console.log('   (skip control ' + u.id + '/' + foe.id + ': ' + c.why + ')'); continue; }
    r.cast = u.id + ' (' + u.types.join('/') + ', ' + mv + ' only, t1 into its partner ' + ally.id + ') vs ' + foe.id + ' (' + DISABLE + ') + ' + fills[2].id;
    c.cast = u.id + ' (' + ctlMv.id + ' only) vs ' + foe.id;
    SPT = r; CTL = c; break outer;
  }
}
const RUNS = [['SPENT', SPT], ['CONTROL', CTL]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const struggled = R => R.sd.some(l => /^\|-activate\|p1a: [^|]*\|move: Struggle/.test(l));
const typeless = R => R.sd.some(l => /^\|-start\|p1a: [^|]*\|typechange\|\?\?\?/.test(l));
ok(struggled(SPT) && typeless(SPT), 'SPENT — the user became ??? and Struggled');
ok(struggled(CTL) && !typeless(CTL), 'CONTROL — the user Struggled as its own type');

/* NOT the kit's compareArms: SPENT's second click of the spender fails, and the authority names the move on that
 * `-fail` (`|-fail|p1a: X|move: Burn Up`) where this engine does not -- a narration difference of its own (the same one
 * the Kingambit card carried at its turn 3), not this mechanic. So the protocol divergence is PRINTED, and what is
 * asserted is the damage lines and the boards. */
console.log('\n4. MEDICHAM AGAINST THE AUTHORITY');
for (const [tag, R] of RUNS) {
  const sdO = R.sdK.filter(l => OWN.test(l)), meO = R.meK.filter(l => OWN.test(l));
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  console.log('     ' + tag + ' first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none'));
  ok(same, tag + ' — every -damage line agrees in order', same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' '));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
}
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(SPT.counters.refused >= 1 && CTL.counters.refused === 0, 'the engine\'s receipts: STAB refused in SPENT, never in CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + R.counters.refused)));
}
K.finish();
