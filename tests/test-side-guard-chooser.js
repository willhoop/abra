/* CAN THE INTERNAL CHOOSER CLICK A SIDE GUARD, AND AT WHAT RATE?   node tests/test-side-guard-chooser.js
 *
 * Will, 2026-08-10: *"its gotta be able to click it man"*.
 *
 * WIRE 148 made Quick Guard WORK -- it refuses priority moves through `playerAction`, which is the
 * path the live bot, the game differential and every census probe take. It did not touch
 * `chooseAction`, the internal heuristic chooser that drives every ROLLOUT and every self-play game,
 * and that still matched `me.moves.includes('wideguard')` by NAME. So MILTANK could never IMAGINE
 * clicking Quick Guard, and a move the search cannot select is worth nothing to the search.
 *
 * THIS IS A BEHAVIOUR TEST AND NOT A CORRECTNESS CLAIM. Nothing here compares the engine to Showdown.
 * No probe can show that the authority's own player would have clicked Quick Guard on a given turn --
 * the reference implementation has no policy. What is asserted is that the chooser CAN select it,
 * that it selects it for the right reason, and that it does so at a defensible RATE. The rate half is
 * the point: CLAUDE.md's mega lesson is that a non-zero counter at the wrong rate is still a defect
 * (mega ran at 56% of sides against a correct 85% and passed "at least one happened").
 *
 * THE TWO NUMBERS THIS FILE EXISTS TO HOLD, both measured on data/games.ladder.jsonl on 2026-08-10
 * over 51,445 games / 102,890 sides / 327,993 turns carrying a move:
 *
 *   HUMANS CLICKED   Quick Guard  601   Wide Guard  6,460      ratio 0.093
 *   THE TRIGGER IS REAL, NOT ASSERTED -- of the 482 sides that clicked Quick Guard, the OPPOSING side
 *   used one of the 17 foe-facing priority moves in 63.3% of those games, against a base rate of
 *   37.5% over all sides. A 1.69x lift.
 *
 * `data/tags.json` `uses` says 927:3,997 = 0.232 for the same two moves. The two artifacts disagree
 * by 2.5x and ROADMAP #70's standing caveat covers exactly this; the store is the harder fact, and
 * the engine can only read the tag record at runtime. Both are printed below so the gap stays visible.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = globalThis.ABRA_TAG_LOOKUP;

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

/* ------------------------------------------------------------------ 1. MEMBERSHIP, PRINTED FIRST */
/* LESSONS §4: print what a derived rule matched BEFORE trusting it. A new derived tag over-matches --
 * `refusesStatusMoves` caught Telepathy and Wonder Guard -- and the only way to know is to look. */
console.log('\n--- 1. WHAT THE DERIVATION MATCHED ---');
const FIELD = { weather:'', terrain:'', twA:0, twB:0, tr:0, sgA:{}, sgB:{} };
const ALLMV = Object.keys(MC.moves);
const family = (TAGS.withTag ? TAGS.withTag('move', 'oneTurnGuard') : []).slice().sort();
console.log('  oneTurnGuard family, of ' + ALLMV.length + ' moves in this engine\'s table: ' +
  family.map(id => id + ' blocks=' + JSON.stringify((TAGS.param('move', id, 'oneTurnGuard') || {}).blocks) +
                   ' uses=' + ((TAGS.tagsFor('move', id) || {}).uses) +
                   ' rate=' + M.sideGuardClickRate(id).toFixed(4)).join('  |  '));
ok(family.length === 2, 'the family is exactly 2 moves (a third arriving must be looked at, not assumed)');
ok(Math.abs(M.sideGuardClickRate('wideguard') - 0.35) < 1e-9,
   'Wide Guard keeps its historic 0.35 click rate EXACTLY -- it is the most-used member, so the ' +
   'derived scaling cannot move it');
ok(M.sideGuardClickRate('quickguard') < M.sideGuardClickRate('wideguard'),
   'Quick Guard\'s rate is BELOW Wide Guard\'s, derived from its own corpus uses');

/* A single foe holding exactly one move, and a side of mine with a body in KO range, so the print is
 * the full membership of each guard's threat scan rather than a sample of it. */
const oneFoe = (id) => { const f = M.buildMon('scizor', {}); f.moves = [id]; f._turnsOut = 0; return f; };
const frail  = () => { const b = M.buildMon('whimsicott', {}); b.curHP = 1; return b; };
const scanned = (gid) => ALLMV.filter(id => M.foeThreatensGuardClass(gid, [oneFoe(id)], [frail()], FIELD));
for (const gid of family) {
  const hit = scanned(gid);
  console.log('  ' + gid + ' is triggered by ' + hit.length + ' moves: ' + hit.join(' '));
}
/* THE NO-REGRESSION PROOF, and it is a set comparison rather than a promise. Wide Guard's old trigger
 * was the bare `SPREAD.has(id)`; the new one runs through the shared class predicate plus the
 * aimed-at-foes and cannot-be-used-this-turn filters. If those filters moved Wide Guard at all it
 * would show up here as a lost or gained move. */
const oldWG = ALLMV.filter(id => M.MEDI_SPREAD.has(id));
const newWG = scanned('wideguard');
const lost = oldWG.filter(x => !newWG.includes(x)), gained = newWG.filter(x => !oldWG.includes(x));
console.log('  Wide Guard trigger vs the old SPREAD.has() test -- lost: [' + lost.join(' ') + '] gained: [' + gained.join(' ') + ']');
ok(lost.length === 0 && gained.length === 0, 'Wide Guard\'s trigger set is UNCHANGED, move for move');
ok(!scanned('quickguard').includes('feint'),
   'FEINT does not trigger Quick Guard -- it carries ignoresProtect and would go straight through it');
ok(!scanned('quickguard').includes('suckerpunch'),
   'SUCKER PUNCH does not trigger Quick Guard -- needsTargetToAttack, and a body raising a guard is ' +
   'not attacking, so the move fails on its own');
console.log('  MEDFAILS guardTargetClassUnknown=' + M.fails.guardTargetClassUnknown +
            ' guardClassUnknown=' + M.fails.guardClassUnknown +
            ' sideGuardRateNoUses=' + M.fails.sideGuardRateNoUses +
            '   (a non-zero is the finding, not a nuisance)');
ok(M.fails.guardTargetClassUnknown === 0, 'no move carried a target class the chooser could not read');
ok(M.seen.sideGuardBlocked === 0,
   'the HYPOTHETICAL scan did not touch MEDSEEN.sideGuardBlocked -- the chooser asks the refusal ' +
   'question thousands of times a game and must not inflate the number it is measured by');

/* -------------------------------------------------------- 2. THE CHOOSER, ON A DETERMINISTIC BOARD */
/* Ten arms, and EVERY control prints a real alternative click. The first version of WIRE 148's probe
 * used Sucker Punch, which fails unless the target attacks, so every arm INCLUDING the control read
 * zero and the board looked like universal refusal. A control that produces nothing proves nothing.
 *
 * `rng: () => 0` passes every rate roll, so what is being tested is the CONDITION and not the die.
 * My side is faster than both foes, so its click reaches the trace before anything can flinch it. */
console.log('\n--- 2. THE CHOOSER ON A DETERMINISTIC BOARD (rng()=0, so only the condition varies) ---');
function clicked(foeMove, allyHpFrac, guard) {
  const a = M.buildMon('raichu', {});     a.moves = ['thunderbolt', guard]; a.item = ''; a.ability = 'static';
  const b = M.buildMon('whimsicott', {}); b.moves = ['moonblast'];          b.item = ''; b.ability = 'prankster';
  const f1 = M.buildMon('scizor', {});    f1.moves = [foeMove];             f1.item = ''; f1.ability = 'swarm';
  const f2 = M.buildMon('garchomp', {});  f2.moves = ['dragonclaw'];        f2.item = ''; f2.ability = 'sandveil';
  const tr = [];
  const S = M.battleInit([a, b], [f1, f2], { trace: tr });
  b.curHP = Math.max(1, Math.round(b.st.hp * allyHpFrac));
  M.battleTurn(S, () => 0);
  return tr.map(l => String(l).split('|')).filter(f => f[1] === 'move' && String(f[2]).startsWith('p1a')).map(f => f[3]);
}
const ARMS = [
  ['bulletpunch', 0.15, 'quickguard', 'quickguard', 'a foe holds a priority attack AND my partner is in KO range of it'],
  ['fakeout',     1.00, 'quickguard', 'quickguard', 'FAKE OUT on its entry turn -- a flinch costs the whole turn at any hp'],
  ['bulletpunch', 1.00, 'quickguard', null,         'CONTROL: same priority attack, nobody in KO range -- the situational half refuses'],
  ['ironhead',    0.15, 'quickguard', null,         'CONTROL: same danger, the foe\'s move is not priority'],
  ['suckerpunch', 0.15, 'quickguard', null,         'CONTROL: needsTargetToAttack -- it fails against a body that is guarding'],
  ['feint',       0.15, 'quickguard', null,         'CONTROL: ignoresProtect -- Quick Guard would not stop it'],
  ['rockslide',   0.15, 'quickguard', null,         'CROSS-CONTROL: a SPREAD threat does not make QUICK Guard worth clicking'],
  ['rockslide',   1.00, 'wideguard',  'wideguard',  'WIDE GUARD still clicks on a spread threat'],
  ['ironhead',    1.00, 'wideguard',  null,         'CONTROL: no spread threat, no Wide Guard'],
  ['bulletpunch', 0.15, 'wideguard',  null,         'CROSS-CONTROL: a PRIORITY threat does not make WIDE Guard worth clicking'],
];
for (const [foeMove, hp, guard, want, why] of ARMS) {
  const got = clicked(foeMove, hp, guard);
  const label = (guard + ' | foe ' + foeMove + ' | ally hp ' + Math.round(hp * 100) + '%').padEnd(46);
  console.log('  ' + label + '-> ' + JSON.stringify(got) + '   ' + why);
  if (want) ok(got.includes(want), label + 'clicks ' + want);
  else      ok(got.length > 0 && !got.includes(guard), label + 'clicks something ELSE (and does click)');
}

/* ---------------------------------------------------------------- 3. THE RATE, OVER REAL SELF-PLAY */
/* Each body holds ONE guard, assigned 50/50, and keeps three of its real attacks. Handing every body
 * BOTH guards -- which is what the red baseline used -- makes them compete for the same move slot and
 * shortens games, and neither belongs in a rate measurement. Foes are usage-weighted with their own
 * movesets, so the base rate of each threat class is the format's own.
 *
 * ENGINE-DATA CARRIES NO QUICK GUARD SET AT ALL (0 of 318 species; Wide Guard is on 8), so this run
 * has to hand the move out. That is worth knowing on its own: even a correct chooser cannot click a
 * move no modelled body holds. */
console.log('\n--- 3. THE RATE, MEASURED OVER SELF-PLAY ---');
function xorshift(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const names = Object.keys(MC.mons).filter(k => M.buildMon(k, {}));
const wts = names.map(k => (MC.mons[k].set_source && MC.mons[k].set_source.n) || 0);
const total = wts.reduce((a, b) => a + b, 0);
const GAMES = 1500;
const rng = xorshift(20260810);
const draw = () => { let x = rng() * total; for (let i = 0; i < names.length; i++) { x -= wts[i]; if (x <= 0) return names[i]; } return names[0]; };
let turns = 0, qg = 0, wg = 0, heldQ = 0, heldW = 0;
const blocked0 = M.seen.sideGuardBlocked;
for (let g = 0; g < GAMES; g++) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const a = M.buildMon(draw(), {});
    const keep = (a.moves || []).filter(id => !TAGS.has('move', id, 'oneTurnGuard')).slice(0, 3);
    const gid = rng() < 0.5 ? 'quickguard' : 'wideguard';
    if (gid === 'quickguard') heldQ++; else heldW++;
    a.moves = keep.concat([gid]);
    A.push(a); B.push(M.buildMon(draw(), {}));
  }
  const tr = [];
  const S = M.battleInit(A, B, { trace: tr });
  let n = 0; while (!M.battleOver(S) && n < 40) { M.battleTurn(S, rng); n++; }
  turns += n;
  for (const line of tr) {
    const f = String(line).split('|'); if (f[1] !== 'move') continue;
    const nm = String(f[3] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nm === 'quickguard') qg++; else if (nm === 'wideguard') wg++;
  }
}
const ratio = wg ? qg / wg : Infinity;
console.log('  ' + GAMES + ' games, ' + turns + ' turns, bodies holding QG ' + heldQ + ' / WG ' + heldW);
console.log('  CLICKS   Quick Guard ' + qg + '   Wide Guard ' + wg + '   ratio ' + ratio.toFixed(3));
console.log('  TARGETS  store-observed humans 601:6460 = 0.093   |   tags.json uses 927:3997 = 0.232');
console.log('  COUNTERS sideGuardChosenVsPriority=' + M.seen.sideGuardChosenVsPriority +
            ' sideGuardChosenVsSpread=' + M.seen.sideGuardChosenVsSpread +
            ' sideGuardBlocked=' + (M.seen.sideGuardBlocked - blocked0));
ok(qg > 0, 'the chooser CAN select Quick Guard -- this read 0 over 200 games / 1,176 turns before the wire');
ok(wg > 0, 'Wide Guard did not regress to zero');
ok(qg < wg, 'Quick Guard is clicked LESS than Wide Guard, as in the corpus');
/* The band, stated as what it is: an order-of-magnitude bar, not a fitted target. The floor keeps a
 * later change from quietly making the move unreachable again; the ceiling is the HIGHER of the two
 * disagreeing corpus figures, so passing it would mean clicking it more often than the most generous
 * reading of human play. */
ok(ratio < 0.232, 'the click ratio is under the tag-usage figure 0.232 (measured ' + ratio.toFixed(3) + ')');
ok(ratio > 0.010, 'the click ratio is not a rounding error (measured ' + ratio.toFixed(3) + ')');
ok(M.seen.sideGuardChosenVsPriority > 0 && M.seen.sideGuardChosenVsSpread > 0,
   'both per-class selection counters fired -- a zero on either means that class is off the path');

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed'));
process.exit(fails ? 1 : 0);
