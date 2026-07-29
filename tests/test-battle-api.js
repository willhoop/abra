/* test-battle-api.js — the step-wise battle API the Tower stands on.
 *
 *   node tests/test-battle-api.js
 *
 * battle() moved its loop body into battleTurn() so a HUMAN can drive side A. The two claims that
 * must hold: (1) the sealed rollout is unchanged — same seeds, same winners, via battle() itself;
 * (2) a forced player action resolves exactly like the engine's own shape — playerAction() builds
 * what chooseAction would, so the Tower and the rollout share one resolution path.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };
const rngOf = seed => { let s = (seed * 2654435761 + 12345) >>> 0;
  return () => (((s = (Math.imul(s, 1103515245) + 12345) >>> 0) & 0x7fffffff) / 0x80000000); };
const team = names => names.map(n => M.buildMon(n, {})).filter(Boolean);

console.log('BATTLE API — one engine, sealed or stepped\n');

/* the sealed rollout still runs and is deterministic per seed */
{
  const r1 = M.battle(team(['garchomp', 'incineroar', 'kingambit', 'whimsicott']),
                      team(['corviknight', 'pelipper', 'venusaur', 'arcanine']), {}, rngOf(7));
  const r2 = M.battle(team(['garchomp', 'incineroar', 'kingambit', 'whimsicott']),
                      team(['corviknight', 'pelipper', 'venusaur', 'arcanine']), {}, rngOf(7));
  ok(r1 === r2 && (r1 === 0 || r1 === 0.5 || r1 === 1),
    `battle() is deterministic per seed and returns a result (${r1})`);
}

/* stepping to completion IS battle(): same seed, same winner */
{
  const mk = () => [team(['garchomp', 'incineroar', 'kingambit', 'whimsicott']),
                    team(['corviknight', 'pelipper', 'venusaur', 'arcanine'])];
  const [a1, b1] = mk(); const sealed = M.battle(a1, b1, {}, rngOf(11));
  const [a2, b2] = mk(); const S = M.battleInit(a2, b2);
  while (!M.battleOver(S)) M.battleTurn(S, rngOf(11 + S.turn * 0));
  /* NOTE: one rng stream, so rebuild it the way battle() consumes it */
  const [a3, b3] = mk(); const S3 = M.battleInit(a3, b3); const r = rngOf(11);
  while (!M.battleOver(S3)) M.battleTurn(S3, r);
  ok(M.battleResult(S3) === sealed,
    `stepping with the same rng stream reproduces battle() exactly (${sealed})`);
}

/* a forced player action resolves — and the engine's immunities still apply to a player.
 * First written as Earthquake into a Pelipper, which is a FLYING body: the engine correctly did
 * nothing, and the test was wrong. Both halves kept: the immune click deals zero, the legal one
 * lands. A Tower player gets the same physics as a rollout. */
{
  const A = team(['garchomp', 'incineroar']), B = team(['corviknight', 'pelipper']);
  const S = M.battleInit(A, B);
  const tgt = S.actB[1];                       // pelipper
  const hp0 = tgt.curHP;
  /* the partner is forced to Protect so the only attack in flight is the immune Earthquake —
   * the first version left it to the AI, which attacked, and the test blamed the EQ */
  const acts = new Map([[S.actA[0], M.playerAction(S.actA[0], 'earthquake', tgt, S.field)],
                        [S.actA[1], M.playerAction(S.actA[1], 'protect', null, S.field)]]);
  M.battleTurn(S, rngOf(3), acts);
  ok(S.turn === 1, 'the turn counter advanced under player control');
  ok(tgt.curHP === hp0, `a player's Earthquake into a Flying body deals ZERO, same as anyone's (${tgt.curHP}/${hp0})`);
  const S2 = M.battleInit(team(['garchomp', 'incineroar']), team(['corviknight', 'pelipper']));
  const t2 = S2.actB[1]; const h2 = t2.curHP;
  M.battleTurn(S2, rngOf(3), new Map([[S2.actA[0], M.playerAction(S2.actA[0], 'ironhead', t2, S2.field)]]));
  ok(t2.curHP < h2, `the legal click lands (ironhead: pelipper ${h2} -> ${t2.curHP})`);
}

/* the player's Protect holds through the turn; the flag clears when the NEXT turn begins */
{
  const A = team(['garchomp', 'incineroar']), B = team(['corviknight', 'pelipper']);
  const S = M.battleInit(A, B);
  const me = S.actA[0]; const hp0 = me.curHP;
  const acts = new Map([[me, M.playerAction(me, 'protect', null, S.field)]]);
  M.battleTurn(S, () => 0.9, acts);            // 0.9: no crits, no procs, first Protect never fails
  ok(me.protect === true && S.turn === 1 && me.curHP === hp0,
    'Protect held: flag up all turn, no damage taken (it clears at the START of the next turn)');
  const pa = M.playerAction(me, 'notarealmove', null, S.field);
  ok(pa && pa.kind === 'pass', 'an unmodelled click builds an honest pass, not a fake move');
  /* the turn record for observers (the Tower's LOCAL game log — Will's games stay his) */
  ok(Array.isArray(S.lastActs) && S.lastActs.length >= 2 &&
     S.lastActs.every(a => a.side && a.name && a.kind),
    `battleTurn records what both sides clicked (${S.lastActs && S.lastActs.length} actions)`);
}

console.log('');
if (fail) { console.log(`${fail} check(s) failed — the Tower has no floor to stand on.`); process.exit(1); }
console.log(`${pass} checks passed. One engine, sealed or stepped.`);
