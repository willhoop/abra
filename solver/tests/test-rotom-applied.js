/* solver/tests/test-rotom-applied.js — CHOSEN VS APPLIED (solver/rotom/applied.js), on hand-made turns.
 *
 *   node solver/tests/test-rotom-applied.js        exit 0 GREEN, 1 RED
 *
 * Every verdict the live client can reach, from protocol lines shaped like the server's (sim/battle.ts, sim/side.ts,
 * server/room-battle.ts): APPLIED when the server did what was chosen; EXPLAINED only when a LINE says why (cant, a faint,
 * a target already down, a redirection the format's own move or ability set up, an Encore); MISMATCH otherwise. The BREAK
 * clauses are the deliberate breaks: a verifier that passed them would be asking nothing, so each one must read MISMATCH.
 * Bodies, moves and items are the preview fixture's (solver/tests/fixtures/rotom/preview.json), captured from the Reg M-C
 * server; the redirect sets are derived from the format (applied.js redirectors()).
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const A = require('../rotom/applied.js');
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };
const st = (vs, kind, slot) => { const v = vs.find(x => x.kind === kind && (slot == null || x.slot === slot)); return v ? v.status + (v.why ? ' (' + v.why + ')' : '') : 'none'; };
const is = (vs, kind, slot, s) => { const v = vs.find(x => x.kind === kind && (slot == null || x.slot === slot)); return !!v && v.status === s; };

/* our side p2: Salamence (a) + Sneasler (b) active, Primarina and Raichu behind; the foe p1: Pelipper (a) + Archaludon (b) */
const mon = (n, active) => ({ ident: 'p2: ' + n, details: n + ', L50', condition: '100/100', active });
const mv = (move, id, target) => ({ move, id, pp: 8, maxpp: 8, target, disabled: false });
const REQ = { rqid: 7, side: { id: 'p2', name: 'medicham32', pokemon: [mon('Salamence', true), mon('Sneasler', true), mon('Primarina', false), mon('Raichu', false)] },
  active: [{ canMegaEvo: true, moves: [mv('Hyper Voice', 'hypervoice', 'allAdjacentFoes'), mv('Draco Meteor', 'dracometeor', 'normal'), mv('Tailwind', 'tailwind', 'allySide'), mv('Protect', 'protect', 'self')] },
           { moves: [mv('Close Combat', 'closecombat', 'normal'), mv('Dire Claw', 'direclaw', 'normal'), mv('Throat Chop', 'throatchop', 'normal'), mv('Protect', 'protect', 'self')] }] };
const V = (choice, lines, extra) => A.verifyDecision(Object.assign({ me: 'p2', req: REQ, choice, lines }, extra || {}));
const MEGA = ['|detailschange|p2a: Salamence|Salamence-Mega, L50', '|-mega|p2a: Salamence|Salamence|Salamencite'];

/* ---------- APPLIED ---------- */
{
  const vs = V('move 2 1 mega, move 1 2', MEGA.concat(['|move|p2b: Sneasler|Close Combat|p1b: Archaludon', '|-damage|p1b: Archaludon|40/100', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']));
  ok('APPLIED', vs.every(v => v.status === 'applied') && vs.length === 5, 'moves, targets and the mega all applied: ' + JSON.stringify(vs.map(v => v.kind + ':' + v.status)));
  const v2 = V('move 4, move 2 1', ['|move|p2b: Sneasler|Close Combat|p1a: Pelipper|[from]ability: Dancer', '|move|p2a: Salamence|Protect|p2a: Salamence', '|move|p2b: Sneasler|Dire Claw|p1a: Pelipper', '|turn|3']);
  ok('APPLIED', is(v2, 'move', 1, 'applied') && is(v2, 'target', 1, 'applied'), 'a `[from]` move line is another effect\'s, never the choice: ' + st(v2, 'move', 1));
  ok('APPLIED', !v2.some(v => v.kind === 'target' && v.slot === 0), 'no target check for a move whose target the player does not choose (Protect)');
  const v3 = V('move 1, switch 3', ['|switch|p2b: Primarina|Primarina, L50|100/100', '|move|p2a: Salamence|Hyper Voice|p1a: Pelipper|[spread] p1a,p1b', '|turn|3']);
  ok('APPLIED', is(v3, 'switch', 1, 'applied') && is(v3, 'move', 0, 'applied'), 'a switch and a spread move: ' + st(v3, 'switch', 1) + ' / ' + st(v3, 'move', 0));
  const v4 = A.verifyDecision({ me: 'p2', req: Object.assign({}, REQ, { forceSwitch: [true, false], active: undefined }), choice: 'switch 4, pass', lines: ['|switch|p2a: Raichu|Raichu, L50|100/100', '|turn|4'] });
  ok('APPLIED', is(v4, 'forced', 0, 'applied') && v4.length === 1, 'a forced switch: ' + st(v4, 'forced', 0));
  ok('APPLIED', V('default', []).every(v => v.status === 'unverifiable'), 'the last-resort `default` is UNVERIFIABLE, never counted as applied');
}
/* ---------- EXPLAINED (a line says why) ---------- */
{
  const vs = V('move 2 1, move 1 1', ['|cant|p2a: Salamence|par', '|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|turn|3']);
  ok('EXPLAINED', is(vs, 'move', 0, 'explained') && /cant: par/.test(vs.find(v => v.slot === 0).why), 'cant -> explained: ' + st(vs, 'move', 0));
  const v2 = V('move 2 1, move 1 1', ['|move|p1a: Pelipper|Hurricane|p2a: Salamence', '|-damage|p2a: Salamence|0 fnt', '|faint|p2a: Salamence', '|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|turn|3']);
  ok('EXPLAINED', is(v2, 'move', 0, 'explained') && is(v2, 'move', 1, 'applied'), 'fainted before moving -> explained: ' + st(v2, 'move', 0));
  const v3 = V('move 2 1, move 1 1', ['|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|-damage|p1a: Pelipper|0 fnt', '|faint|p1a: Pelipper', '|move|p2b: Sneasler|Close Combat|p1b: Archaludon', '|turn|3']);
  ok('EXPLAINED', is(v3, 'target', 1, 'explained') && /target-fainted/.test(st(v3, 'target', 1)), 'the target fainted earlier this turn -> retargeted: ' + st(v3, 'target', 1));
  const before = ['|switch|p1a: Pelipper|Pelipper, L50|100/100', '|turn|2', '|faint|p1a: Pelipper', '|upkeep', '|turn|3'];
  const v4 = V('move 2 2, move 1 1', ['|move|p2b: Sneasler|Close Combat|p1b: Archaludon', '|move|p2a: Salamence|Draco Meteor|p1b: Archaludon', '|turn|4'], { before, beforeEnd: before.length });
  ok('EXPLAINED', is(v4, 'target', 1, 'explained') && /target-empty/.test(st(v4, 'target', 1)), 'the target slot was already empty at the turn start -> retargeted: ' + st(v4, 'target', 1));
  const R = A.redirectors();
  const fm = [...R.moves][0];
  ok('EXPLAINED', R.moves.size > 0 && R.abilities.size > 0, 'the redirect sets are derived from the format: ' + JSON.stringify({ moves: [...R.moves], abilities: [...R.abilities], error: R.error || null }));
  if (fm) {
    const v5 = V('move 2 1, move 1 1', ['|move|p1b: Archaludon|' + fm + '|p1b: Archaludon', '|-singleturn|p1b: Archaludon|move: ' + fm, '|move|p2b: Sneasler|Close Combat|p1b: Archaludon', '|move|p2a: Salamence|Draco Meteor|p1b: Archaludon', '|turn|3']);
    ok('EXPLAINED', is(v5, 'target', 1, 'explained') && /redirected/.test(st(v5, 'target', 1)), 'a redirection set this turn -> explained: ' + st(v5, 'target', 1));
  }
  const v6 = V('move 2 1, move 1 1', ['|move|p1a: Pelipper|Encore|p2b: Sneasler', '|-start|p2b: Sneasler|Encore', '|move|p2b: Sneasler|Dire Claw|p1a: Pelipper', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']);
  ok('EXPLAINED', is(v6, 'move', 1, 'explained') && /encored/.test(st(v6, 'move', 1)), 'Encore this turn replaces the move -> explained: ' + st(v6, 'move', 1));
  const v7 = V('move 2 1, move 1 1', ['|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|-damage|p1a: Pelipper|0 fnt', '|faint|p1a: Pelipper', '|win|weedwizardxx68']);
  ok('EXPLAINED', is(v7, 'move', 0, 'explained') && /ended/.test(st(v7, 'move', 0)), 'the battle ended before it moved -> explained: ' + st(v7, 'move', 0));
  const v8 = V('move 2 1, move 1 1', ['|drag|p2a: Primarina|Primarina, L50|100/100', '|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|turn|3']);
  ok('EXPLAINED', is(v8, 'move', 0, 'explained') && /left/.test(st(v8, 'move', 0)), 'dragged out before it moved -> explained: ' + st(v8, 'move', 0));
}
/* ---------- three shapes the first throttled dry run found (solver/out/rotom/dry-throttle-2026-09-26): each read as a
 * mismatch before the verifier learned it, and each is the server doing exactly what was chosen ---------- */
{
  const R2 = { rqid: 9, side: { id: 'p1', pokemon: [{ ident: 'p1: Sneasler', active: true }, { ident: 'p1: Gardevoir', active: true }] },
    active: [{ moves: [mv('Close Combat', 'closecombat', 'normal')] }, { moves: [mv('Psychic', 'psychic', 'normal'), mv('Expanding Force', 'expandingforce', 'normal')] }] };
  const s1 = A.verifyDecision({ me: 'p1', req: R2, choice: 'move 1 1, move 2 2', lines: ['|move|p1a: Sneasler|Close Combat|p2a: Raichu', '|move|p1b: Gardevoir|Expanding Force|p2a: Raichu|[spread] p2a,p2b', '|turn|6'] });
  ok('DRYRUN', is(s1, 'target', 1, 'applied'), 'a move turned SPREAD by the terrain hit the chosen slot among others -> applied: ' + st(s1, 'target', 1));
  const R3 = { rqid: 9, side: { id: 'p1', pokemon: [{ ident: 'p1: Gardevoir', active: true }, { ident: 'p1: Archaludon', active: true }] },
    active: [{ moves: [mv('Protect', 'protect', 'self')] }, { moves: [mv('Electro Shot', 'electroshot', 'normal')] }] };
  const s2 = A.verifyDecision({ me: 'p1', req: R3, choice: 'move 1, move 1 2', lines: ['|move|p1a: Gardevoir|Protect|p1a: Gardevoir', '|move|p1b: Archaludon|Electro Shot||[still]', '|-prepare|p1b: Archaludon|Electro Shot', '|turn|3'] });
  ok('DRYRUN', is(s2, 'move', 1, 'applied') && is(s2, 'target', 1, 'explained'), 'a charge turn prints no target ([still]) -> the move applied, the target not comparable: ' + st(s2, 'move', 1) + ' / ' + st(s2, 'target', 1));
  const R4 = { rqid: 11, side: R3.side, active: [{ moves: [mv('Protect', 'protect', 'self')] }, { moves: [{ move: 'Electro Shot', id: 'electroshot', pp: 8, maxpp: 8, disabled: false }] }] };
  const s3 = A.verifyDecision({ me: 'p1', req: R4, choice: 'move 1, move 1', lines: ['|move|p1a: Gardevoir|Protect|p1a: Gardevoir', '|move|p1b: Archaludon|Electro Shot|p2b: Sneasler|[from] lockedmove', '|turn|4'] });
  ok('DRYRUN', is(s3, 'move', 1, 'applied'), '`[from] lockedmove` is the user\'s own continuation, not another effect\'s: ' + st(s3, 'move', 1));
}
/* ---------- BREAK: each of these MUST read mismatch ---------- */
{
  const b1 = V('move 2 1, move 1 1', ['|move|p2b: Sneasler|Protect|p2b: Sneasler', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']);
  ok('BREAK', is(b1, 'move', 1, 'mismatch'), 'the server used a different move -> MISMATCH: ' + st(b1, 'move', 1));
  const b2 = V('move 2 1, move 1 2', ['|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']);
  ok('BREAK', is(b2, 'target', 1, 'mismatch'), 'a different target and no line that says why -> MISMATCH: ' + st(b2, 'target', 1));
  const b3 = V('move 2 1 mega, move 1 1', ['|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']);
  ok('BREAK', is(b3, 'mega', 0, 'mismatch'), 'mega chosen, none happened -> MISMATCH: ' + st(b3, 'mega', 0));
  const b3b = V('move 2 1, move 1 1', MEGA.concat(['|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']));
  ok('BREAK', is(b3b, 'mega', 0, 'mismatch'), 'a mega nobody chose -> MISMATCH: ' + st(b3b, 'mega', 0));
  const b4 = V('move 2 1, move 1 1', ['|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']);
  ok('BREAK', is(b4, 'move', 1, 'mismatch'), 'no move line for the slot and nothing that explains it -> MISMATCH: ' + st(b4, 'move', 1));
  const b5 = V('move 2 1, switch 3', ['|switch|p2b: Raichu|Raichu, L50|100/100', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']);
  ok('BREAK', is(b5, 'switch', 1, 'mismatch'), 'a different body switched in -> MISMATCH: ' + st(b5, 'switch', 1));
  const PREQ = { rqid: 2, teamPreview: true, side: { id: 'p2', pokemon: ['Rillaboom', 'Salamence', 'Primarina', 'Raichu', 'Ceruledge', 'Sneasler'].map(n => mon(n, false)) } };
  const after = order => ({ rqid: 3, side: { id: 'p2', pokemon: order.map(i => mon(PREQ.side.pokemon[i - 1].ident.slice(4), false)) } });
  ok('BREAK', A.verifyPreview({ me: 'p2', req: PREQ, choice: 'team 2143', nextReq: after([1, 2, 3, 4]) }).status === 'mismatch', 'preview 2143, server applied the default 1234 -> MISMATCH (the aa2 k=16 shape)');
  ok('APPLIED', A.verifyPreview({ me: 'p2', req: PREQ, choice: 'team 2143', nextReq: after([2, 1, 4, 3]) }).status === 'applied', 'preview 2143 applied as 2143');
  ok('BREAK', A.verifyPreview({ me: 'p2', req: PREQ, choice: 'team 2143', nextReq: after([2, 1, 3, 4]) }).status === 'mismatch', 'right leads, wrong back order -> MISMATCH');
  ok('BREAK', A.verifyTimer({ sent: true, name: 'medicham32', lines: ["|inactive|Battle timer is ON: inactive players will automatically lose when time's up. (requested by weedwizardxx68)"] }).status === 'mismatch', 'the timer is on, but not by us, and we never "also want" it -> our /timer on never arrived: MISMATCH');
  ok('APPLIED', A.verifyTimer({ sent: true, name: 'medicham32', lines: ['|inactive|medicham32 also wants the timer to be on.'] }).status === 'applied', '"also wants the timer" -> applied');
  ok('APPLIED', A.verifyTimer({ sent: false, name: 'medicham32', lines: [] }) === null, 'no /timer on sent -> no check');
}
/* ---------- the tally ---------- */
{
  const T = new A.Tally();
  for (const v of V('move 2 1 mega, move 1 2', MEGA.concat(['|move|p2b: Sneasler|Close Combat|p1a: Pelipper', '|move|p2a: Salamence|Draco Meteor|p1a: Pelipper', '|turn|3']))) T.add(v, { turn: 2 });
  for (const v of V('default', [])) T.add(v);
  const j = T.toJSON();
  ok('TALLY', j.chosen === 5 && j.applied === 4 && j.mismatch === 1 && j.unverifiable === 1 && j.mismatches.length === 1 && j.mismatches[0].turn === 2, 'chosen/applied/mismatch/unverifiable counted, each mismatch kept with its context: ' + JSON.stringify({ c: j.chosen, a: j.applied, m: j.mismatch, u: j.unverifiable }));
}
console.log((fails ? 'RED' : 'GREEN') + ' test-rotom-applied: ' + (checks - fails) + '/' + checks);
process.exit(fails ? 1 : 0);
