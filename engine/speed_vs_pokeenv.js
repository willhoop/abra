/* WHAT WE HAVE TO BEAT, AND WHAT BEATING IT ACTUALLY MEANS.
 *
 * Will, 2026-08-11: *"i would like to benchmark medicham against poke-env, can you run poke-env in the
 * background so we know what we need to beat and hopefully beat by a lot"*.
 *
 * ================= WHY THIS IS THREE MEASUREMENTS AND NOT TWO =====================================
 *
 * The obvious benchmark is MEDICHAM vs poke-env. **It would produce a huge number and the number would
 * be a lie**, because poke-env is Python talking to a Showdown SERVER over a WEBSOCKET. Most of what it
 * spends is transport and process boundary, not simulation. Reporting "we are 100x poke-env" would be
 * reporting that a function call beats a network round trip, which everybody already knows.
 *
 * The claim this project actually needs to defend is in ADR-003 and #62:
 *
 *     "we wrote our own simulator so per-turn re-solving is affordable, so the engine work is
 *      justified if and only if search pays"
 *
 * That claim is about SIMULATION cost. So three arms:
 *
 *   A. poke-env          Python + websocket + the Showdown server   <- what VGC-Bench actually paid
 *   B. BattleStream      Showdown's own sim, in-process, no socket   <- the simulation alone
 *   C. MEDICHAM          ours                                        <- the thing under test
 *
 * **B is the honest baseline.** C/B is "is our simulator faster than Showdown's simulator". C/A is "is
 * our simulator faster than the harness the neighbours used", which is a real fact about the field but
 * a much weaker claim, and the two must never be quoted as if they were the same number.
 *
 * If C/B is near 1, the engine programme's justification is transport avoidance — which we ALREADY had
 * for free by driving `BattleStream` in-process (`engine/champions_sim.js`), without writing a
 * simulator at all. That is the outcome worth knowing about, and it is the one a two-arm benchmark
 * would have hidden.
 *
 * ================= WHAT IS HELD EQUAL =============================================================
 *
 * Same format, same teams, same policy (uniform random over legal actions), full battles to a winner,
 * same machine, same run. A benchmark whose arms play different games measures the games.
 *
 *   node engine/speed_vs_pokeenv.js --games 200          # arms B and C
 *   node engine/speed_vs_pokeenv.js --games 200 --json   # for the Python side to merge into
 *
 * Arm A WOULD live in `engine/bench_pokeenv.py` because poke-env is Python, and would write the same
 * shape. THAT FILE DOES NOT EXIST AND NEVER HAS — this line said it did, in the present tense, for 16
 * days (written 2026-08-11 in ff5d2a65, corrected 2026-08-27 by MEASURE). See STATE below: arm A is
 * unwritten, so only arms B and C run and the artifact carries two arms, not three.
 *
 *
 * ================= STATE: NOT YET RUNNABLE, AND EXACTLY WHY ========================================
 *
 * Will, 2026-08-11: *"well only when we think medicham is ready for the benchmark"* — so this is built
 * and deliberately not run. Where it actually stands, so nobody rediscovers it:
 *
 *   ARM B  WORKS. First version hand-rolled a BattleStream driver and crashed with `Push after end of
 *          read stream`; the repo already had `champions_sim.battle()` and I had written a second
 *          driver. It now calls the one that works.
 *   ARM C  LOADS, DOES NOT BUILD. Two failures found in order, both mine:
 *            1. `require('./medicham2-browser.js')` dies with `MC is not defined` (:2976) — it is a
 *               BROWSER file that reads a data global. FIXED: it goes through `REL.require` now, which
 *               is also what makes a measurement a photograph rather than a reading of the live tree.
 *            2. `buildMon` rejects the Showdown-shaped sets this file builds. **THE REMAINING WORK**:
 *               `game_differential.js:1305` has a `buildPair(sheet, opts)` that does the conversion and
 *               is NOT exported. Export it and call it — do not write a third one. Two of the three
 *               bugs in this file so far were me writing a second implementation of something the repo
 *               already had.
 *   ARM A  poke-env is installed; the Python side is unwritten. It needs a local Showdown SERVER
 *          running, which arms B and C do not — that asymmetry IS the thing arm B exists to isolate.
 *
 * AND DO NOT RUN IT ON A BUSY MACHINE. #131. A benchmark taken while an agent is playing games
 * measures the agent.
 * * Runs games. Writes one artifact. Reads no model. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require('./showdown_path.js');

const ARG = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const GAMES = +ARG('--games', 200);
const AS_JSON = process.argv.includes('--json');
const OUT = path.join(ROOT, 'data', 'speed-vs-pokeenv.json');

const CS = require('./champions_sim.js');
const { Dex, BattleStream, Teams } = CS.sim();
const FORMAT = CS.FORMAT;

/* ---- THE TEAMS ARE FIXED AND SHARED, so no arm is measured on an easier matchup. Six legal bodies,
 * built the same way for every arm, and the packed form is what both sides of the benchmark consume. */
const D = Dex.forFormat(FORMAT);
const PICK = ['garchomp', 'corviknight', 'milotic', 'incineroar', 'clefable', 'snorlax'];
function team() {
  return PICK.map(id => {
    const sp = D.species.get(id);
    const moves = Object.keys(D.species.getLearnsetData(id).learnset || {})
      .filter(m => { const mv = D.moves.get(m); return mv.exists && !mv.isNonstandard && mv.category !== 'Status'; })
      .slice(0, 4);
    return { name: sp.name, species: sp.name, item: '', ability: Object.values(sp.abilities)[0],
             moves: moves.length ? moves : ['Tackle'], nature: 'Serious', gender: '',
             evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
             level: 50 };
  });
}
const PACKED = Teams.pack(team());

/* ---- A DETERMINISTIC POLICY, so the arms do not diverge on luck of the draw and so a rerun repeats.
 * Uniform over what the request offers, which is the cheapest thing a rollout ever does — the point is
 * to price the SIMULATOR, not a bot. */
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ================= ARM B — SHOWDOWN'S OWN SIM, IN PROCESS =========================================
 * MY FIRST VERSION HAND-ROLLED A BattleStream DRIVER AND CRASHED — `Push after end of read stream`,
 * because it destroyed a stream whose reader had already ended. **The repo already had a working
 * driver and I wrote a second one**, which is the two-implementations-of-one-fact failure this project
 * keeps paying for. `champions_sim.battle()` is the one that works and is already trusted by the
 * ingest path; this arm calls it. Its own header states the assumption we want here: *"Both sides play
 * randomly - this measures the MATCHUP, not the players."* */
async function armBattleStream(n) {
  const t0 = process.hrtime.bigint();
  let done = 0, err = null;
  for (let g = 0; g < n; g++) {
    try { await CS.battle(PACKED, PACKED, [g, g, g, g]); done++; }
    catch (e) { err = e.message; break; }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { arm: 'B. Showdown, in-process (champions_sim.battle)', games: done, ms: +ms.toFixed(1),
           games_per_sec: done ? +(done / (ms / 1000)).toFixed(1) : 0, error: err };
}

/* ================= ARM C — MEDICHAM ==============================================================
 * MY FIRST VERSION PROBED FOR `MC.playGame` AND `MC.buildPair` AND NEITHER EXISTS. I wrote the arm
 * against an API I assumed rather than one I read — the same failure as typing a Pokemon value from
 * memory, in a different costume, and it would have reported "could not run" as if that were a fact
 * about MEDICHAM rather than about me.
 *
 * THE REAL SURFACE, read from the module: `battleInit(teamA, teamB, opts)`, then `battleTurn(S, rng,
 * mapA, mapB)` until `battleOver(S)`, with each side's map built from `playerAction(mon, move, target,
 * field)`. That is exactly the loop `engine/game_differential.js:2027` drives, which is the one place
 * this engine is already played correctly. */
async function armMedicham(n) {
  /* THERE IS EXACTLY ONE CORRECT WAY TO LOAD MEDICHAM AND A PLAIN require() IS NOT IT.
   * `medicham2-browser.js` is a BROWSER file: it reads a global `MC` for its data tables, so
   * `require()` returns a module whose first call dies with `MC is not defined` (:2976). The loader
   * that supplies it is `engine_release.js`, and going through it is also what makes a measurement a
   * PHOTOGRAPH rather than a reading of whatever is on disk — `need` makes a missing export shout on
   * every run instead of failing silently. Copied from game_differential.js:147, which is the one
   * place this engine is already loaded correctly. */
  let MC;
  try {
    const REL = require('./engine_release.js').open(ARG('--release') || null);
    /* AND THE DATA TABLES MUST BE LOADED FIRST. The comment above says this was copied from
     * game_differential.js:147 — it copied :147 and not :128, which is `REL.require('data/engine-data.js')`.
     * That file is what populates the global the browser bundle reads, so without it `buildMon`
     * dies on its first row lookup with the very error the comment above warns about. Diagnosed
     * 2026-08-11 by running the benchmark for the first time: it had never been executed, so a
     * two-line load sequence had only ever half-existed. */
    REL.require('data/engine-data.js');
    MC = REL.require('engine/medicham2-browser.js', {
      need: ['battleInit', 'battleTurn', 'battleOver', 'playerAction', 'buildMon'],
    });
  } catch (e) { return { arm: 'C. MEDICHAM', error: 'could not load through the release: ' + e.message }; }

  /* USE THE REPO'S OWN CONVERTER. `MC.buildMon` takes MEDICHAM-shaped sets and this file builds
   * SHOWDOWN-shaped ones, so calling it directly returned 0 usable bodies from 6 sets — which the
   * header above had already predicted, and which said the fix is `buildPair` from
   * `game_differential.js`, adding "do not write a third one". That advice stands; the header's claim
   * that it is NOT exported is simply stale — it sits in `module.exports` at :2941.
   *
   * It returns `{medi, spec, sd}` per body: `medi` is the built MEDICHAM body, `sd` the Showdown set.
   * Requiring the module costs ~1s of setup and is side-effect safe (no main guard needed — it does
   * not self-run), measured before wiring. */
  const sets = team();
  let buildPair;
  try { ({ buildPair } = require('./game_differential.js')); }
  catch (e) { return { arm: 'C. MEDICHAM', error: 'could not reach buildPair: ' + e.message }; }

  const build = () => buildPair(sets, { max: 4 }).map(p => p && p.medi).filter(Boolean);
  const probe = build();
  if (probe.length < 2)
    return { arm: 'C. MEDICHAM', error: 'buildPair returned ' + probe.length + ' usable bodies from ' + sets.length + ' sets — the fixture is wrong, not the engine' };

  const t0 = process.hrtime.bigint();
  let done = 0, turns = 0;
  for (let g = 0; g < n; g++) {
    try {
      const S = MC.battleInit(build(), build(), {});
      const rng = mulberry(20260811 + g);
      let guard = 0;
      while (!MC.battleOver(S) && guard++ < 60) {
        const mk = (own, foes) => {
          const m = new Map();
          own.forEach((mon, i) => {
            if (!mon || mon.fainted) return;
            const mv = (mon.moves || [])[Math.floor(rng() * (mon.moves || []).length)];
            if (!mv) return;
            m.set(mon, MC.playerAction(mon, mv, foes.find(f => f && !f.fainted) || null, S.field));
          });
          return m;
        };
        MC.battleTurn(S, rng, mk(S.actA, S.actB), mk(S.actB, S.actA));
        turns++;
      }
      done++;
    } catch (e) {
      return { arm: 'C. MEDICHAM', error: 'threw on game ' + g + ': ' + e.message, games: done };
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { arm: 'C. MEDICHAM', games: done, turns, ms: +ms.toFixed(1),
           games_per_sec: done ? +(done / (ms / 1000)).toFixed(1) : 0 };
}

/* ================= THE READINESS GUARD ============================================================
 *
 * Will, 2026-08-11: *"well only when we think medicham is ready for the benchmark"*.
 *
 * **THAT IS A CONDITION, SO IT IS A CHECK AND NOT A JUDGEMENT CALL.** Benchmarking a simulator that is
 * still being wired measures a moving target, and a speed number taken mid-repair is exactly the kind
 * of figure this repo then quotes for a week (#61: MEDICHAM was believed to run at 3,401 battles/sec
 * and measures 1,606 — nothing watched, so a 2x regression went unseen).
 *
 * Two clauses, both read rather than remembered:
 *   1. the MEDICHAM gate is OPEN — `engine/quarantine.js` says the simulator passes its own conditions
 *   2. the working tree is CLEAN of engine edits — a benchmark of half-applied bytes is nobody's engine
 *
 * `--anyway` overrides and STAMPS THE OVERRIDE INTO THE ARTIFACT, because a number taken under protest
 * must carry that fact with it wherever it is quoted. */
function readiness() {
  const out = { ok: true, why: [] };
  try {
    const Q = require('./quarantine.js');
    const g = Q.medichamIsCorrect();
    if (!g.ok) { out.ok = false; out.why.push('the MEDICHAM gate is CLOSED — failing: ' + g.failing.map(c => c.name).join(', ')); }
  } catch (e) { out.ok = false; out.why.push('could not read the gate: ' + e.message); }
  try {
    const { execSync } = require('child_process');
    const dirty = execSync('git status --porcelain engine/', { cwd: ROOT }).toString().trim();
    if (dirty) out.why.push('NOTE: engine/ has uncommitted edits — ' + dirty.split('\n').length + ' file(s). The number describes bytes that are not in any commit.');
  } catch (e) { /* not fatal: a benchmark outside a checkout is still a benchmark */ }
  return out;
}

(async () => {
  const R = readiness();
  const OVERRIDE = process.argv.includes('--anyway');
  if (!R.ok && !OVERRIDE) {
    console.log('  NOT RUN — MEDICHAM is not ready to be benchmarked.\n');
    for (const w of R.why) console.log('    ' + w);
    console.log('\n  A speed number taken mid-repair gets quoted for a week (#61). Re-run when the gate');
    console.log('  is open, or force it with --anyway and the override is stamped into the artifact.');
    process.exit(2);
  }
  for (const w of R.why) console.log('  ' + w);
  /* ONE ARM FAILING MUST NOT DISCARD ANOTHER ARM'S MEASUREMENT. Found 2026-08-11 by running it:
   * arm C threw an UNCAUGHT ReferenceError, which killed the process before the artifact was
   * written — so arm B, which had already run and produced a perfectly good baseline, was lost.
   * The `a.error` handling below only ever covered errors an arm CAUGHT and returned; a throw
   * escaped it entirely.
   *
   * That matters more than it looks. Arm B is the HONEST BASELINE — it is Showdown's own simulator
   * and it has no dependency on ours being correct or even loadable. Coupling its number to arm C's
   * health meant the one measurement that can always be taken was the one we could never keep. */
  const runArm = async (name, fn) => {
    try { return await fn(GAMES); }
    catch (e) { return { arm: name, error: (e && e.message ? e.message : String(e)).split('\n')[0] }; }
  };
  const B = await runArm('B. BattleStream (Showdown, in-process)', armBattleStream);
  const C = await runArm('C. MEDICHAM (ours)', armMedicham);
  const art = {
    generated: new Date().toISOString(), by: 'engine/speed_vs_pokeenv.js', format: FORMAT, games: GAMES,
    readiness: readiness(), forced: process.argv.includes('--anyway') || undefined,
    /* THIS FIELD CLAIMED A THIRD ARM THAT DOES NOT EXIST, INTO THE ARTIFACT ITSELF, FOR 16 DAYS.
     * It read "Arm A (poke-env) is written by engine/bench_pokeenv.py and merged in"; there is no
     * such file and no commit has ever created one, so any reader of data/speed-vs-pokeenv.json was
     * told a benchmark had three arms when the `arms` array beside it holds two. Corrected
     * 2026-08-27 (MEASURE). It says what is here, and names arm A as OWED. */
    what: 'Simulation cost, same teams and same random policy. TWO ARMS RAN: B (Showdown in-process) '
        + 'and C (MEDICHAM). Arm A (poke-env, Python + websocket + a local Showdown server) is NOT '
        + 'in this artifact — it is unwritten, so no C/A ratio may be quoted from this file.',
    the_honest_baseline: 'B is the baseline that matters. C/B answers "is our simulator faster than '
        + 'Showdown\'s simulator". C/A answers "is it faster than the harness the neighbours used", '
        + 'which is mostly websocket and process boundary. THE TWO MUST NEVER BE QUOTED AS ONE NUMBER.',
    what_a_null_result_means: 'If C/B is near 1, the engine programme\'s justification is transport '
        + 'avoidance — which driving BattleStream in-process already gave us for free, without writing '
        + 'a simulator. That is the outcome a two-arm benchmark would have hidden.',
    arms: [B, C],
  };
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
  if (AS_JSON) { console.log(JSON.stringify(art, null, 2)); return; }
  console.log('  SIMULATION COST — same teams, same random policy, ' + GAMES + ' games\n');
  for (const a of [B, C]) {
    if (a.error) { console.log('    ' + a.arm.padEnd(46) + 'COULD NOT RUN — ' + a.error); continue; }
    console.log('    ' + a.arm.padEnd(46) + String(a.games_per_sec).padStart(9) + ' games/sec'
              + '   (' + a.games + ' in ' + a.ms + ' ms)');
  }
  if (!B.error && !C.error && B.games_per_sec)
    console.log('\n    C/B = ' + (C.games_per_sec / B.games_per_sec).toFixed(2) + 'x'
              + '   <- the claim that matters; C/A is transport and is a different sentence');
  /* PRINTED, SO A PERSON ACTS ON IT. This line told the operator to "run engine/bench_pokeenv.py"
   * for 16 days; that file has never existed, so the instruction sent whoever followed it to a
   * missing path. Corrected 2026-08-27 (MEASURE) — it now says arm A is OWED rather than available. */
  console.log('\n  arm A (poke-env) DID NOT RUN — the Python side is unwritten, so C/A is not available');
  console.log('  wrote data/speed-vs-pokeenv.json');
})();
