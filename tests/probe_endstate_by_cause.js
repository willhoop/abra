/* probe_endstate_by_cause.js — PER-GAME, WHICH PROTOCOL CAUSE ENDED ON WHICH BOARD.
 *
 * WHY THIS EXISTS. `engine/game_differential.js --end-state` publishes the end-state verdict crossed
 * with the SHAPE (engine/divergence_shape.js) and nothing finer. Two questions the brief of
 * 2026-08-19 asks cannot be answered from that artifact:
 *
 *   1. `drag: a different body` — 22 of this run's 26 UNPARSED games. A different body arriving IS a
 *      different board, so those must not be allowed to fall into "same" by default. The artifact
 *      says UNPARSED is 22 different / 4 same and cannot say WHICH four.
 *   2. the games whose protocol NEVER parted and whose END BOARD differs anyway. The artifact counts
 *      them (16) and names no leaf, and that population is exactly where an over-wide comparison leaf
 *      would hide.
 *
 * IT DRIVES THE SAME DRIVER, NOT A COPY. `game_differential.js` returns at `require.main !== module`
 * before it plays anything, so requiring it yields the exports with a FRESH driver — the same state
 * the real run's `driverReset()` leaves. This file then replays the same configurations, the same
 * pair lists and the same per-config budget, and PRINTS ITS OWN TOTALS AGAINST THE ARTIFACT'S. If the
 * game count, the diverged count and the class tally do not reproduce, the replay is a DIFFERENT
 * SAMPLE and says so rather than quietly attributing per-game rows to somebody else's number.
 *
 * IT MEASURES. It fixes nothing and asserts nothing about whether either engine is right.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('--games', 982);
const ART = arg('--artifact', 'data/verification/gd-endstate-982.json');
const OUT = arg('--out', 'data/verification/endstate-by-cause.json');
const WITH_CONTROL = !process.argv.includes('--no-control');

/* the run parameters of the artifact this replay is meant to reproduce, pushed before the require
 * because the driver reads its flags off argv at load. */
for (const [k, v] of [['--arm', 'middle'], ['--turns', '12'], ['--release', '94a84744346d'],
                      ['--census', 'data/mechanics-census.json'],
                      ['--team-store', 'data/team-pool-frozen']]) {
  if (!process.argv.includes(k)) process.argv.push(k, v);
}
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const G = require(D('engine', 'game_differential.js'));
const BS = require(D('engine', 'board_state.js'));

if (!G.END_STATE) { console.log('THE DRIVER IS NOT IN END-STATE MODE — the replay would stop at the first '
  + 'divergent board and every verdict below would be about where it stopped looking.'); process.exit(2); }

const live = G.SW.out;
const perConfig = Math.max(1, Math.floor(GAMES / live.length));
console.log('REPLAY — ' + live.length + ' configurations, up to ' + perConfig + ' games each, '
  + (WITH_CONTROL ? 'with' : 'WITHOUT') + ' the paired stones-removed control');

G.driverReset();
const rows = [];
const t0 = Date.now();
for (const cfg of live) {
  let made = 0;
  for (const pr of G.pairsFor(cfg.config)) {
    if (made >= perConfig) break;
    /* THE CONTROL GAME IS PLAYED AND THROWN AWAY, exactly as the real run's playOne does, because the
     * real run plays it and this replay is trying to be the same sample. Its driver effect is undone
     * by the snapshot pair, which is the driver's own mechanism and not a copy of it. */
    if (WITH_CONTROL) {
      const s0 = G.driverSnap();
      G.playGame(pr.aN, pr.bN, cfg.config, pr.tag + ' [stones removed]', { arm: G.PRIMARY_ARM });
      G.driverRestore(s0);
    }
    const r = G.playGame(pr.a, pr.b, cfg.config, pr.tag, { arm: G.PRIMARY_ARM });
    made++;
    const c = r.div ? G.classify(r.div) : null;
    const fb = r.finalBoard || null;
    const paths = fb ? (fb.diffs || []).map(d => d.path) : [];
    rows.push({
      config: cfg.config, seed: r.seed, turns: r.turns,
      end_reason: r.endReason || null, ended_medi: !!r.endedMedi, ended_sd: !!r.endedSd,
      protocol_diverged_at_turn: r.divTurn == null ? null : r.divTurn,
      cls: c ? c.cls : null, cause: c ? c.cause : null,
      shape: c ? G.shapeOfCause(c.cause).shape : null,
      first_board_divergence_at_turn: r.stateDiv ? r.stateDiv.turn : null,
      verdict: G.endStateVerdict(r),
      final_board_turn: fb ? fb.turn : null,
      leaves_compared: fb ? fb.leaves_compared : null,
      differing_leaves: paths.length,
      families: [...new Set(paths.map(p => BS.family(p)))].sort(),
      paths: paths.slice(0, 40),
      /* THE TWO VALUES, NOT ONLY THE PATH. "the ability leaf differs in 9 games" is a count; "we hold
       * a swapped ability where the authority holds the body's own" is something a fix can start
       * from, and only the values carry it. */
      /* `us`/`sd` and NOT `medicham`/`showdown`: the driver stores LOCATED rows (BS.locate), which
       * rename the two values. Reading the raw names gave `undefined` on every row — a value that
       * looks like a reading and is the probe being wrong before the engine is. */
      diffs: (fb ? (fb.diffs || []) : []).slice(0, 40)
        .map(d => ({ path: d.path, body: d.body, field: d.field, medicham: d.us, showdown: d.sd,
                     /* IS THE BODY UNDER THIS LEAF A CORPSE IN BOTH ENGINES? `board_state.js` skips
                      * the post-faint group on the PARTY (walkParty) and does NOT skip it on the
                      * ACTIVE slot, so a leaf the authority cleared on a faint and medicham2 kept
                      * would read as a divergence there and not here. Recorded, not assumed. */
                     dead: (() => { const P = fb && fb.parties; const s = (d.path.match(/^p[12]/) || [])[0];
                       if (!P || !s || !d.body) return null;
                       const m = (P.medi[s] || {})[d.body], q = (P.sd[s] || {})[d.body];
                       if (!m || !q) return null;
                       return (m.fainted ? 'medicham-dead' : 'medicham-alive') + '/'
                            + (q.fainted ? 'showdown-dead' : 'showdown-alive'); })() })),
      threw: r.err ? String(r.err).slice(0, 120) : null,
    });
  }
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

/* ---- DOES THIS REPLAY THE ARTIFACT'S SAMPLE? Printed before anything is concluded from it. ------- */
let A = null;
try { A = JSON.parse(fs.readFileSync(D(ART), 'utf8')); } catch (e) { A = null; }
const diverged = rows.filter(r => r.cls);
const clsTally = {};
for (const r of diverged) clsTally[r.cls] = (clsTally[r.cls] || 0) + 1;
let reproduces = null;
if (A) {
  const artCls = {};
  for (const c of A.classes) artCls[c.cls] = c.games;
  const same = rows.length === A.games && diverged.length === (A.arms[0].diverged)
    && JSON.stringify(Object.entries(clsTally).sort()) === JSON.stringify(Object.entries(artCls).sort());
  reproduces = same;
  console.log('\nAGAINST THE ARTIFACT ' + ART);
  console.log('  games     replay ' + rows.length + '   artifact ' + A.games);
  console.log('  diverged  replay ' + diverged.length + '   artifact ' + A.arms[0].diverged);
  console.log('  classes   ' + (JSON.stringify(Object.entries(clsTally).sort()) === JSON.stringify(Object.entries(artCls).sort())
    ? 'identical' : 'DIFFER\n    replay   ' + JSON.stringify(clsTally) + '\n    artifact ' + JSON.stringify(artCls)));
  console.log('  ' + (same ? 'THE REPLAY IS THE SAME SAMPLE — the per-game rows below describe the published number.'
    : 'THE REPLAY IS A DIFFERENT SAMPLE. Everything below is its own measurement and must not be '
    + 'read as a breakdown of the artifact.'));
} else {
  console.log('\nNO ARTIFACT TO COMPARE AGAINST at ' + ART + ' — the replay stands alone.');
}

const parted = rows.filter(r => r.protocol_diverged_at_turn != null);
const tally = (list) => { const t = {}; for (const r of list) t[r.verdict] = (t[r.verdict] || 0) + 1; return t; };
console.log('\n' + rows.length + ' games, ' + elapsed + 's.  protocol parted ' + parted.length
  + ', never parted ' + (rows.length - parted.length));
console.log('  of the parted:      ' + JSON.stringify(tally(parted)));
console.log('  of the never-parted:' + JSON.stringify(tally(rows.filter(r => r.protocol_diverged_at_turn == null))));

console.log('\nVERDICT BY THE DIFFERENTIAL\'S OWN CLASS (protocol-parted games only)');
const byCls = new Map();
for (const r of parted) {
  const e = byCls.get(r.cls) || { cls: r.cls, shape: r.shape, games: 0, v: {} };
  e.games++; e.v[r.verdict] = (e.v[r.verdict] || 0) + 1; byCls.set(r.cls, e);
}
for (const e of [...byCls.values()].sort((a, b) => b.games - a.games))
  console.log('  ' + String(e.games).padStart(4) + '  ' + String(e.shape).padEnd(9) + '  '
    + e.cls.padEnd(46) + JSON.stringify(e.v));

console.log('\nTHE `drag: a different body` POPULATION, NAMED GAME BY GAME');
for (const r of parted.filter(x => /^drag: a different body/.test(x.cls)))
  console.log('  ' + r.verdict.padEnd(21) + 'protocol turn ' + String(r.protocol_diverged_at_turn).padStart(2)
    + '   first board divergence turn ' + String(r.first_board_divergence_at_turn) .padStart(4)
    + '   ' + r.differing_leaves + ' leaves   ' + r.families.slice(0, 6).join(','));

console.log('\nGAMES WHOSE PROTOCOL NEVER PARTED AND WHOSE END BOARD DIFFERS ANYWAY');
const silent = rows.filter(r => r.protocol_diverged_at_turn == null && r.verdict === 'DIFFERENT-END-STATE');
console.log('  ' + silent.length + ' game(s)');
const silentFam = {};
for (const r of silent) for (const f of r.families) silentFam[f] = (silentFam[f] || 0) + 1;
for (const [f, n] of Object.entries(silentFam).sort((a, b) => b[1] - a[1]))
  console.log('    ' + String(n).padStart(3) + '  ' + f);

/* ---- HOW MANY DIFFERENT-END-STATE GAMES REST ON ONE FAMILY ALONE -------------------------------
 * A game whose end board differs in exactly one family is a game the whole verdict turns on that
 * leaf. It is the sensitivity the brief asks for: if a leaf turns out to be a reader artifact, these
 * are the games that would move. */
console.log('\nDIFFERENT-END-STATE GAMES WHOSE ONLY DIFFERING FAMILY IS ONE FAMILY');
const diffGames = rows.filter(r => r.verdict === 'DIFFERENT-END-STATE');
const soleFam = {};
for (const r of diffGames) if (r.families.length === 1) soleFam[r.families[0]] = (soleFam[r.families[0]] || 0) + 1;
console.log('  ' + diffGames.length + ' DIFFERENT-END-STATE games; '
  + Object.values(soleFam).reduce((a, b) => a + b, 0) + ' of them differ in ONE family only');
for (const [f, n] of Object.entries(soleFam).sort((a, b) => b[1] - a[1]))
  console.log('    ' + String(n).padStart(3) + '  ' + f);

/* ---- WHAT THE ABILITY LEAF ACTUALLY HOLDS ON EACH SIDE ------------------------------------------
 * It is the largest family in the DIFFERENT-END-STATE set and the whole of the silent population, so
 * the two VALUES are printed rather than the count. */
console.log('\nTHE ABILITY LEAF, VALUE PAIRS (all games with a differing end board)');
const abPair = {};
for (const r of diffGames) for (const d of r.diffs) {
  if (!/\.ability$/.test(d.path)) continue;
  const k = 'medicham ' + String(d.medicham) + '   showdown ' + String(d.showdown);
  abPair[k] = (abPair[k] || 0) + 1;
}
for (const [k, n] of Object.entries(abPair).sort((a, b) => b[1] - a[1]).slice(0, 30))
  console.log('    ' + String(n).padStart(3) + '  ' + k);

console.log('\nTHE SILENT POPULATION IN FULL — protocol identical, end board not');
for (const r of silent) {
  console.log('  ' + r.config + '  ' + r.turns + ' turns  ' + r.differing_leaves + ' leaves  first board divergence turn ' + r.first_board_divergence_at_turn);
  for (const d of r.diffs.slice(0, 6))
    console.log('      ' + d.path.padEnd(38) + 'medicham ' + String(d.medicham) + '   showdown ' + String(d.showdown)
      + '   [' + String(d.dead) + ']');
}

/* ---- HOW MUCH OF THE DIFFERENCE SITS ON A BODY BOTH ENGINES CALL DEAD ---------------------------
 * `walkParty` skips the post-faint group on the bench; `walk(A.active, ...)` does not. The authority
 * clears boosts, volatiles and the ability on a faint and medicham2 keeps them, so a leaf on a corpse
 * still occupying an active slot is the reader, not the rule. Counted so the size of that suspicion
 * is a number rather than an adjective. */
console.log('\nDIFFERING LEAVES ON A BODY BOTH ENGINES CALL DEAD (the active-slot post-faint asymmetry)');
{
  const t = { 'both dead': 0, 'both alive': 0, 'disagree': 0, 'not in both parties': 0 };
  const deadFam = {};
  for (const r of diffGames) for (const d of r.diffs) {
    if (d.dead == null) { t['not in both parties']++; continue; }
    if (d.dead === 'medicham-dead/showdown-dead') { t['both dead']++; deadFam[d.field] = (deadFam[d.field] || 0) + 1; }
    else if (d.dead === 'medicham-alive/showdown-alive') t['both alive']++;
    else t.disagree++;
  }
  console.log('  ' + JSON.stringify(t));
  for (const [f, n] of Object.entries(deadFam).sort((a, b) => b[1] - a[1]).slice(0, 12))
    console.log('    on a corpse: ' + String(n).padStart(3) + '  ' + f);
  const allDead = diffGames.filter(r => r.diffs.length && r.diffs.every(d => d.dead === 'medicham-dead/showdown-dead'));
  console.log('  ' + allDead.length + ' of ' + diffGames.length + ' DIFFERENT-END-STATE games differ ONLY on bodies both engines call dead');
}

console.log('\nEVERY FAMILY THAT DIFFERS AT THE END, over the DIFFERENT-END-STATE games');
const famAll = {};
for (const r of diffGames) for (const f of r.families) famAll[f] = (famAll[f] || 0) + 1;
for (const [f, n] of Object.entries(famAll).sort((a, b) => b[1] - a[1]))
  console.log('    ' + String(n).padStart(3) + '  ' + f);

fs.writeFileSync(D(OUT), JSON.stringify({
  what: 'PER-GAME end-state verdict against the protocol cause, from a replay of the same driver. '
      + 'A measurement, not a gate.',
  generated: new Date().toISOString(),
  replays_artifact: ART, reproduces_that_sample: reproduces,
  with_control_games: WITH_CONTROL,
  engine_release: G.REL.id, games: rows.length, elapsed_s: +elapsed,
  not_compared: BS.NOT_COMPARED.map(x => x.field),
  rows,
}, null, 1));
console.log('\n  -> ' + D(OUT));
