/* bench_two_engines.js — MEDICHAM vs Showdown's own sim, SAME machine, SAME teams, INTERLEAVED.
 *
 * MEASURE, 2026-09-08. Answers exactly one question: how many whole Champions Reg M-B doubles
 * battles per second does each engine play, driven by the SAME random policy, on this box.
 *
 * WHY INTERLEAVED. An ENGINE agent may start a heavy job at any moment. Running arm A to completion
 * and then arm B makes the ratio a function of when the contention landed. Alternating A,B,A,B within
 * one process and reporting the PER-REP PAIRED RATIO makes contention common-mode, and the spread
 * across reps is then the noise floor for the ratio itself (LESSONS §9).
 *
 * WHAT IS TIMED, PER GAME, SYMMETRICALLY:
 *   construct = MEDICHAM: freshBodies(x2) + battleInit   |  Showdown: new Battle + setPlayer(x2)
 *   play      = MEDICHAM: runPlayout                     |  Showdown: the choice loop to a result
 *   total     = construct + play
 * EXCLUDED from both: process start, dex load, team-pool load, buildPair, Teams.pack (done once per
 * pair, cached), and any protocol comparison. Neither engine's log is read.
 *
 * THE POLICY IS MATCHED TO rollout_leaf.runPlayout(explore=1.0, foePolicy='uniform'):
 *   with prob switchRate, switch to a uniformly random legal bench body (once per body per turn);
 *   otherwise a uniformly random selectable move at a uniformly random live foe. No mega, either side.
 *
 * Not a claim about correctness. MEDICHAM is quarantined for accuracy and speed does not touch that.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = 'C:/Users/willj/Projects/Pokemon/ABRA';
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const ms = (a, b) => Number(b - a) / 1e6;
const dig = (f) => { try { return crypto.createHash('sha256').update(fs.readFileSync(D(f))).digest('hex').slice(0, 12); } catch (e) { return 'MISSING:' + e.code; } };

const REL_ID = arg('--release', null);
if (!REL_ID) { console.error('--release is required; this run must be pinned'); process.exit(2); }
const TEAM_STORE = arg('--team-store', 'data/team-pool-frozen');
const REPS = Math.max(1, +arg('--reps', 5));
const PAIRS = Math.max(1, +arg('--pairs', 40));
const GAMES_PER_PAIR = Math.max(1, +arg('--per-pair', 5));
const CAPS = String(arg('--caps', '60,14')).split(',').map(Number).filter(n => n > 0);
const OUT = arg('--out', null);

/* ---- LOAD (all of it excluded from every per-game figure) ------------------------------------- */
const T0 = process.hrtime.bigint();
const REL = require(ROOT + '/engine/engine_release.js').open(REL_ID);
const MEDI = REL.require('engine/medicham2-browser.js',
  { need: ['battleInit', 'battleTurn', 'battleOver', 'buildMon', 'playerAction'] });
const RL = REL.require('engine/rollout_leaf.js', { need: ['runPlayout'] });
const CS = REL.require('engine/champions_sim.js');
/* --sd-module points the SHOWDOWN arm at a different published build (e.g. the npm package) while
 * leaving the MEDICHAM arm untouched. Recorded in the artifact; never defaulted. */
const SD_MODULE = arg('--sd-module', null);
const SD = SD_MODULE ? require(SD_MODULE) : CS.sim();
const { Dex, Teams, Battle } = SD;
const dex = Dex.forFormat(CS.FORMAT);
dex.species.get('garchomp');                       /* force the lazy tables into the load phase */
const LOAD_MS = ms(T0, process.hrtime.bigint());

/* game_differential is the repo's ONE sheet->body converter (buildPair/freshBodies). It is NOT a
 * release SOURCE and an ENGINE agent owns it, so its digest is recorded at the start AND the end of
 * this run: if it moved, the run says so rather than quietly averaging two harnesses. */
const GD_DIGEST_BEFORE = dig('engine/game_differential.js');
const SWARM = require(ROOT + '/engine/diff_swarm.js');
const GD = require(ROOT + '/engine/game_differential.js');
const TEAMS = SWARM.loadTeams({ storeDir: TEAM_STORE });

/* switch rate: the same census bench_speed.js reads, passed EXPLICITLY to both arms. */
const CENSUS = (() => {
  const raw = fs.readFileSync(D('data', 'rollout-switch-census.json'), 'utf8');
  const j = JSON.parse(raw);
  const pc = j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  return { switchRate: (typeof pc === 'number' && pc > 0) ? pc / 100 : 0,
           maxTurns: (j.derived_cap && j.derived_cap.max_turns) || 0, generated: j.generated || null,
           digest: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12) };
})();

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- COUNTERS. Every catch below increments one of these and every one of them is printed. ----- */
const C = { pair_build_fail: 0, medi_threw: 0, sd_threw: 0, sd_rejected_choice: 0,
            sd_fell_back_to_default: 0, sd_stuck: 0, sd_no_request: 0 };

function bodies(sheet) {
  try {
    const p = GD.buildPair(sheet, { max: 4 });
    if (!p || p.filter(x => x && x.medi).length < 4) { C.pair_build_fail++; return null; }
    return p.filter(x => x && x.medi);
  } catch (e) { C.pair_build_fail++; return null; }
}

/* Distinct pairs by a deterministic stride, exactly as bench_speed.js picks them, so this run's
 * MEDICHAM arm is comparable to the published medicham-speed figures. */
function pickPairs(k) {
  const out = [];
  const step = Math.max(1, Math.floor(TEAMS.length / (k * 2 + 4)));
  for (let i = 0; out.length < k && i + step < TEAMS.length; i += step * 2) {
    const A = bodies(TEAMS[i].team), B = bodies(TEAMS[i + step].team);
    if (!A || !B) continue;
    out.push({ A, B, ia: i, ib: i + step,
               packA: Teams.pack(A.map(x => x.sd)), packB: Teams.pack(B.map(x => x.sd)) });
  }
  return out;
}

/* ================= ARM 1 — MEDICHAM ============================================================ */
function armMedi(pairs, cap, perPair) {
  let conNs = 0n, playNs = 0n, games = 0, turns = 0, decided = 0;
  for (const p of pairs) {
    for (let i = 0; i < perPair; i++) {
      let a = process.hrtime.bigint();
      let S;
      try {
        const A = GD.freshBodies(p.A).filter(Boolean), B = GD.freshBodies(p.B).filter(Boolean);
        S = MEDI.battleInit(A, B, {});
        S.maxTurns = cap; S._explore = 1.0;
      } catch (e) { C.medi_threw++; continue; }
      conNs += process.hrtime.bigint() - a;
      a = process.hrtime.bigint();
      try {
        RL.runPlayout(S, mulberry(p.ia * 7919 + i * 104729 + 13), 1.0, 'uniform', null, CENSUS.switchRate);
      } catch (e) { C.medi_threw++; }
      playNs += process.hrtime.bigint() - a;
      const tn = S.turn || 0; turns += tn; games++; if (tn < cap) decided++;
    }
  }
  return mk('medicham', cap, games, turns, decided, conNs, playNs);
}

/* ================= ARM 2 — SHOWDOWN sim ========================================================
 * A bare `Battle` object, no BattleStream and no protocol strings consumed: the fastest way to drive
 * Showdown's own simulator, so this is an UPPER BOUND on Showdown throughput, not a handicap. */
function sdChoiceFor(battle, sideId, rng) {
  const side = battle[sideId];
  const req = side.activeRequest;
  if (!req) { C.sd_no_request++; return null; }
  if (req.wait) return null;
  if (req.forceSwitch) {
    const claimed = new Set(); const toks = [];
    req.forceSwitch.forEach((need, i) => {
      if (!need) { toks.push('pass'); return; }
      const outs = [];
      side.pokemon.forEach((q, n) => { if (!q.isActive && !q.fainted && !claimed.has(n)) outs.push(n); });
      if (!outs.length) { toks.push('pass'); return; }
      const n = outs[Math.floor(rng() * outs.length) % outs.length];
      claimed.add(n); toks.push('switch ' + (n + 1));
    });
    return toks.join(', ');
  }
  const foes = (side.foe && side.foe.active) || [];
  const liveFoes = []; foes.forEach((q, n) => { if (q && !q.fainted) liveFoes.push(n); });
  const claimed = new Set(); const toks = [];
  (req.active || []).forEach((act, i) => {
    const me = side.active[i];
    if (!me || me.fainted || !act) { toks.push('pass'); return; }
    /* SWITCH BRANCH FIRST, matching runPlayout's ordering. */
    if (!act.trapped && !act.maybeTrapped && rng() < CENSUS.switchRate) {
      const outs = [];
      side.pokemon.forEach((q, n) => { if (!q.isActive && !q.fainted && !claimed.has(n)) outs.push(n); });
      if (outs.length) {
        const n = outs[Math.floor(rng() * outs.length) % outs.length];
        claimed.add(n); toks.push('switch ' + (n + 1)); return;
      }
    }
    const usable = [];
    (act.moves || []).forEach((mv, k) => { if (!mv.disabled) usable.push([mv, k]); });
    if (!usable.length) { toks.push('move 1'); return; }
    const [mv, k] = usable[Math.floor(rng() * usable.length) % usable.length];
    const tt = ('target' in mv) ? mv.target : null;
    let tok = 'move ' + (k + 1);
    if (tt === 'normal' || tt === 'any' || tt === 'adjacentFoe') {
      if (!liveFoes.length) { toks.push('move ' + (k + 1)); return; }
      tok += ' ' + (liveFoes[Math.floor(rng() * liveFoes.length) % liveFoes.length] + 1);
    } else if (tt === 'adjacentAlly') {
      const j = side.active.findIndex((q, n) => q && !q.fainted && n !== i);
      if (j < 0) { toks.push('move ' + (k + 1)); return; }
      tok += ' ' + (-(j + 1));
    } else if (tt === 'adjacentAllyOrSelf') {
      tok += ' ' + (-(i + 1));
    }
    toks.push(tok);
  });
  return toks.join(', ');
}

function playShowdown(p, cap, rng) {
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: p.packA });
  battle.setPlayer('p2', { name: 'B', team: p.packB });
  return battle;
}

function armShowdown(pairs, cap, perPair) {
  let conNs = 0n, playNs = 0n, chooseNs = 0n, games = 0, turns = 0, decided = 0, logLines = 0;
  for (const p of pairs) {
    for (let i = 0; i < perPair; i++) {
      const rng = mulberry(p.ia * 7919 + i * 104729 + 13);
      let a = process.hrtime.bigint(); let battle;
      try { battle = playShowdown(p, cap, rng); }
      catch (e) { C.sd_threw++; continue; }
      conNs += process.hrtime.bigint() - a;
      a = process.hrtime.bigint();
      try {
        if (battle.requestState === 'teampreview') {
          battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234');
        }
        let guard = 0;
        while (!battle.ended && battle.turn < cap) {
          if (++guard > cap * 8) { C.sd_stuck++; break; }
          let acted = false;
          for (const sid of ['p1', 'p2']) {
            /* THE HARNESS'S OWN CHOOSER IS TIMED AND SUBTRACTED. It is MY javascript, not
             * Showdown's, and leaving it inside Showdown's play time would inflate the ratio in the
             * direction I would like it to go. MEDICHAM's figure still INCLUDES its chooser (it is
             * inside runPlayout and cannot be separated), so this subtraction is conservative
             * against MEDICHAM in every case. */
            const ca = process.hrtime.bigint();
            const c = sdChoiceFor(battle, sid, rng);
            chooseNs += process.hrtime.bigint() - ca;
            if (c === null) continue;
            let ok = false;
            try { ok = battle.choose(sid, c); } catch (e) { ok = false; }
            if (!ok) {
              C.sd_rejected_choice++;
              try { ok = battle.choose(sid, 'default'); C.sd_fell_back_to_default++; }
              catch (e) { C.sd_threw++; }
            }
            acted = acted || ok;
          }
          if (!acted) { C.sd_stuck++; break; }
        }
      } catch (e) { C.sd_threw++; }
      playNs += process.hrtime.bigint() - a;
      const tn = battle.turn || 0; turns += tn; games++; if (battle.ended) decided++;
      logLines += (battle.log && battle.log.length) || 0;
      try { battle.destroy(); } catch (e) { C.sd_threw++; }
    }
  }
  const r = mk('showdown', cap, games, turns, decided, conNs, playNs);
  r.chooser_ms = +(Number(chooseNs) / 1e6).toFixed(1);
  r.engine_only_ms = +(r.play_ms - r.chooser_ms).toFixed(1);
  r.engine_only_games_per_sec = +(games / (r.engine_only_ms / 1000)).toFixed(1);
  r.engine_only_ms_per_turn = +(r.engine_only_ms / Math.max(1, turns)).toFixed(4);
  r.mean_log_lines_per_game = +(logLines / Math.max(1, games)).toFixed(1);
  return r;
}

function mk(engine, cap, games, turns, decided, conNs, playNs) {
  const con = Number(conNs) / 1e6, play = Number(playNs) / 1e6, tot = con + play;
  return { engine, cap, games, turns,
    reached_a_result_pct: +(100 * decided / Math.max(1, games)).toFixed(1),
    mean_turns: +(turns / Math.max(1, games)).toFixed(2),
    construct_ms: +con.toFixed(1), play_ms: +play.toFixed(1), total_ms: +tot.toFixed(1),
    play_games_per_sec: +(games / (play / 1000)).toFixed(1),
    total_games_per_sec: +(games / (tot / 1000)).toFixed(1),
    play_ms_per_game: +(play / Math.max(1, games)).toFixed(4),
    total_ms_per_game: +(tot / Math.max(1, games)).toFixed(4),
    play_ms_per_turn: +(play / Math.max(1, turns)).toFixed(4),
    total_ms_per_turn: +(tot / Math.max(1, turns)).toFixed(4),
    turns_per_sec_play: +(turns / (play / 1000)).toFixed(0),
    turns_per_sec_total: +(turns / (tot / 1000)).toFixed(0) };
}

/* ================= MAIN ======================================================================== */
console.log('');
console.log('TWO ENGINES, ONE MACHINE, INTERLEAVED — throughput only, no accuracy claim.');
console.log('  release        ' + REL.id + '   (pinned; ' + (REL_ID ? 'explicit' : 'pointer') + ')');
console.log('  team store     ' + TEAM_STORE);
console.log('  showdown       ' + (CS.actualCommit() || 'UNKNOWN') + '  format ' + CS.FORMAT);
console.log('  node           ' + process.version + '   ' + require('os').cpus().length + ' cores, '
  + (require('os').freemem() / 1e9).toFixed(1) + ' GB free');
console.log('  switch rate    ' + CENSUS.switchRate + '   census ' + CENSUS.digest);
console.log('  load (excl.)   ' + LOAD_MS.toFixed(0) + ' ms');
console.log('  game_differential.js ' + GD_DIGEST_BEFORE + '  (live, not a release source)');

const pairs = pickPairs(PAIRS);
console.log('  pool ' + TEAMS.length.toLocaleString() + ' teams -> ' + pairs.length
  + ' pairs built (' + C.pair_build_fail + ' failures), ' + GAMES_PER_PAIR + ' games/pair/rep');
console.log('');

/* WARM-UP, DISCARDED, BOTH ARMS. V8 tiers up over the first few thousand calls and whichever arm ran
 * first would otherwise be measured cold — bench_speed.js documents a 5.6x effect. */
{
  const t = process.hrtime.bigint();
  const wp = pairs.slice(0, Math.min(6, pairs.length));
  for (let r = 0; r < 2; r++) { armMedi(wp, 20, 8); armShowdown(wp, 20, 8); }
  console.log('  warm-up (discarded, both arms): ' + ms(t, process.hrtime.bigint()).toFixed(0) + ' ms');
  console.log('');
}

const RESULT = { generated: new Date().toISOString(), by: 'scratchpad bench_two_engines.js (MEASURE)',
  what: 'Whole-battle throughput, MEDICHAM vs Showdown sim, same machine, same teams, interleaved.',
  not_an_accuracy_claim: 'MEDICHAM is quarantined for correctness. Speed says nothing about it.',
  engine_release: REL.id, team_store_pinned_to: TEAM_STORE,
  showdown_commit: CS.actualCommit(), format: CS.FORMAT, sd_module: SD_MODULE || 'sibling master checkout via champions_sim.js',
  node: process.version, cores: require('os').cpus().length,
  census: CENSUS, load_ms_excluded: +LOAD_MS.toFixed(0),
  game_differential_digest_before: GD_DIGEST_BEFORE,
  pairs: pairs.length, games_per_pair_per_rep: GAMES_PER_PAIR, reps: REPS, caps: CAPS,
  counters: C, by_cap: {} };

for (const cap of CAPS) {
  const legs = [];
  for (let r = 0; r < REPS; r++) {
    const m = armMedi(pairs, cap, GAMES_PER_PAIR);
    const s = armShowdown(pairs, cap, GAMES_PER_PAIR);
    legs.push({ rep: r, medicham: m, showdown: s,
      ratio_play: +(m.play_games_per_sec / s.play_games_per_sec).toFixed(2),
      ratio_total: +(m.total_games_per_sec / s.total_games_per_sec).toFixed(2),
      ratio_per_turn: +(s.play_ms_per_turn / m.play_ms_per_turn).toFixed(2),
      /* Showdown's chooser cost removed, MEDICHAM's left in: the ratio that is hardest on us. */
      ratio_per_turn_conservative: +(s.engine_only_ms_per_turn / m.play_ms_per_turn).toFixed(2) });
  }
  const pick = (f) => legs.map(f);
  const stat = (xs) => { const s = xs.slice().sort((a, b) => a - b);
    return { min: s[0], median: s[(s.length - 1) >> 1], max: s[s.length - 1],
             spread_pct: s[0] ? +(100 * (s[s.length - 1] - s[0]) / s[0]).toFixed(1) : null, all: xs }; };
  RESULT.by_cap[cap] = { legs,
    medicham_play_games_per_sec: stat(pick(l => l.medicham.play_games_per_sec)),
    showdown_play_games_per_sec: stat(pick(l => l.showdown.play_games_per_sec)),
    medicham_total_games_per_sec: stat(pick(l => l.medicham.total_games_per_sec)),
    showdown_total_games_per_sec: stat(pick(l => l.showdown.total_games_per_sec)),
    ratio_play_paired: stat(pick(l => l.ratio_play)),
    ratio_total_paired: stat(pick(l => l.ratio_total)),
    ratio_per_turn_paired: stat(pick(l => l.ratio_per_turn)),
    ratio_per_turn_conservative_paired: stat(pick(l => l.ratio_per_turn_conservative)),
    /* NOISE FLOOR (LESSONS §9): split the reps into halves and take the spread between the two half
     * means of the SAME arm. A ratio difference smaller than this is not a difference. */
    noise_floor: (() => {
      const f = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
      const half = Math.floor(legs.length / 2);
      if (half < 1) return null;
      const mA = f(legs.slice(0, half).map(l => l.medicham.play_ms_per_turn));
      const mB = f(legs.slice(half).map(l => l.medicham.play_ms_per_turn));
      const sA = f(legs.slice(0, half).map(l => l.showdown.play_ms_per_turn));
      const sB = f(legs.slice(half).map(l => l.showdown.play_ms_per_turn));
      return { medicham_half_split_pct: +(100 * Math.abs(mA - mB) / mA).toFixed(1),
               showdown_half_split_pct: +(100 * Math.abs(sA - sB) / sA).toFixed(1),
               what: 'same arm, first half of reps vs second half, ms/turn' };
    })() };

  const R = RESULT.by_cap[cap];
  console.log('  CAP ' + cap + '  (' + REPS + ' interleaved reps, ' + legs[0].medicham.games
    + ' games per arm per rep)');
  console.log('    ' + 'engine'.padEnd(12) + 'play g/s'.padStart(11) + 'total g/s'.padStart(11)
    + 'ms/game'.padStart(10) + 'ms/turn'.padStart(10) + 'mean turns'.padStart(12)
    + 'result%'.padStart(9) + 'construct ms/g'.padStart(16));
  for (const k of ['medicham', 'showdown']) {
    const f = legs.reduce((a, b) => (b[k].play_games_per_sec > a[k].play_games_per_sec ? b : a))[k];
    console.log('    ' + k.padEnd(12) + String(f.play_games_per_sec).padStart(11)
      + String(f.total_games_per_sec).padStart(11) + f.play_ms_per_game.toFixed(2).padStart(10)
      + f.play_ms_per_turn.toFixed(4).padStart(10) + f.mean_turns.toFixed(2).padStart(12)
      + (f.reached_a_result_pct + '%').padStart(9)
      + (f.construct_ms / f.games).toFixed(3).padStart(16));
  }
  console.log('    RATIO medicham/showdown, paired per rep — play ' + JSON.stringify(R.ratio_play_paired.all)
    + '  median ' + R.ratio_play_paired.median + 'x  (min ' + R.ratio_play_paired.min
    + ', max ' + R.ratio_play_paired.max + ')');
  console.log('    RATIO including construction — median ' + R.ratio_total_paired.median + 'x');
  console.log('    RATIO per TURN — median ' + R.ratio_per_turn_paired.median + 'x  '
    + JSON.stringify(R.ratio_per_turn_paired.all));
  console.log('    RATIO per TURN, showdown chooser removed (hardest on us) — median '
    + R.ratio_per_turn_conservative_paired.median + 'x  '
    + JSON.stringify(R.ratio_per_turn_conservative_paired.all));
  console.log('    NOISE FLOOR (half-split of the same arm, ms/turn): medicham '
    + R.noise_floor.medicham_half_split_pct + '%, showdown ' + R.noise_floor.showdown_half_split_pct + '%');
  console.log('    showdown mean protocol log lines/game: '
    + legs[0].showdown.mean_log_lines_per_game);
  console.log('');
}

RESULT.game_differential_digest_after = dig('engine/game_differential.js');
RESULT.harness_moved_under_the_run = RESULT.game_differential_digest_after !== GD_DIGEST_BEFORE;
console.log('  counters: ' + JSON.stringify(C));
console.log('  game_differential.js after: ' + RESULT.game_differential_digest_after
  + (RESULT.harness_moved_under_the_run ? '   *** MOVED UNDER THE RUN ***' : '   (unchanged)'));
const out = OUT || path.join(__dirname, 'two-engine-speed.json');
fs.writeFileSync(out, JSON.stringify(RESULT, null, 2) + '\n');
console.log('  wrote ' + out);
console.log('');
