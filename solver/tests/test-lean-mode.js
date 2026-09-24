/* solver/tests/test-lean-mode.js -- LEAN MODE IS BOARD-IDENTICAL TO A FULL BATTLE (HEAVY, run by hand).
 *
 *   node solver/tests/test-lean-mode.js --release <id> [--games 1200] [--human 300] [--team-store <dir>]
 *        [--census <pin>] [--plain-sample <file>] [--part lattice|human|all] [--no-red]
 *   (through tools\lownode.cmd; Reg M-C only -- the solver's regulation)
 *
 * WHAT IS CLAIMED. A battle built with `newBattle({lean:true})` (engine/medicham_api.js) plays the same BOARDS as a
 * full battle: for the same seeds and the same choices, after every turn, the whole battle graph -- every body's HP,
 * status, boosts, item, ability, types, volatiles and PP, the field, the turn, and at the end the winner -- is equal,
 * less LEAN_EXEMPT (the lean flag itself, and `_eeHP`, a counter's witness), and the dice are consumed identically.
 *
 * TWO POPULATIONS, BOTH REQUIRED:
 *   LATTICE  every game of the Reg M-C `--games 1200` lattice, played by engine/game_differential.js exactly as the
 *            gate plays it (empirical steering, middle arm, end-state, one release, one census pin, one frozen pool),
 *            with tests/medicham_api_diffhook.js MEDI_API_HOOK=lean beside it: a FULL copy and a LEAN copy of each
 *            battle each play the whole game on the real turns' choices and a replay of the real turns' dice, and are
 *            compared after every turn. The hooked run's per-game sample fingerprint must equal a PLAIN run's, so the
 *            games checked are the lattice's games and the checking moved none of them.
 *   HUMAN    `--human` games built from the human dataset's open sheets (solver/arena/teams.js, the humans' own bring),
 *            each played twice from scratch -- full, then lean -- on the same seeds, with a seeded uniform policy over the
 *            rollout support drawn from the FULL battle and replayed on the lean one. Compared after every turn, draw
 *            counts per dice stream included, and the winner at the end.
 *
 * RED ARMS (unless --no-red): MEDI_LEAN_BREAK=1 makes a lean turn skip Leftovers' residual heal -- one real board
 * handler -- and BOTH populations must then report disagreements. A population that stays green on it is blind: exit 3.
 *
 * EXIT: 0 green, 1 red, 2 cannot answer (no release, no pool, no dataset), 3 blind.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const PART = flag('--part', 'all');
const DO_LAT = PART === 'all' || PART === 'lattice', DO_HUM = PART === 'all' || PART === 'human';
const HUMAN_N = +flag('--human', 300);
const HUMAN_CAP = +flag('--human-turns', 40);
const LEAN_EXEMPT = new Set(['_lean', '_eeHP']);

function cannot(why) { console.log('ABRA-EXIT 2 CANNOT-ANSWER'); console.log('CANNOT ANSWER: ' + why); process.exit(2); }

/* ---------------- HUMAN: a child role, so MEDI_LEAN_BREAK (read at engine load) can be set per arm ---------------- */
if (has('--human-child')) {
  require('../arena/env.js');
  const API = require('../../engine/medicham_api.js');
  const M = API.M;
  const T = require('../arena/teams.js');
  const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody, lean: false });
  const L = T.loadGames({ n: HUMAN_N, seed: 23, M, file: flag('--human-file', undefined) });
  if (L.refused) { console.log(JSON.stringify({ refused: L.refused })); process.exit(2); }
  const canon = (S) => {
    const C = structuredClone(S); const seen = new Set();
    (function strip(v) {
      if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v);
      if (v instanceof Map) { for (const [k, x] of v) { strip(k); strip(x); } return; }
      if (v instanceof Set) { for (const x of v) strip(x); return; }
      for (const k of Object.keys(v)) { if (LEAN_EXEMPT.has(k)) delete v[k]; else strip(v[k]); }
    })(C);
    return API.digestString(C);
  };
  const out = { games: 0, turns: 0, agree: 0, disagree: 0, winners_equal: 0, lean_steps_before: API.COUNTERS.leanSteps, first: [] };
  L.games.forEach((G, gi) => {
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const seed = 70001 + gi * 7919;
    /* FULL game first: its choices are drawn from a clone of the full battle and recorded */
    const play = (lean, choices) => {
      const S = API.newBattle(structuredClone(a.team), structuredClone(b.team), { rng: API.makeRng(seed), lean });
      const rng = API.makeRng(seed + 1);
      const coin = M.rngStreams({ seed: seed + 2 }).any;
      const boards = [canon(S)], draws = [JSON.stringify(rng.counts)];
      let t = 0;
      while (!API.isTerminal(S) && S.turn < HUMAN_CAP) {
        if (!choices[t]) {
          /* the LEAN arm only replays the full game's choices; a lean game still running where the full one ended
           * is a disagreement by itself (the board lists differ in length) */
          if (lean) break;
          const C = API.clone(S); choices[t] = [R.randomJoint(C, 'A', coin), R.randomJoint(C, 'B', coin)];
        }
        /* a lean game that has parted can be handed a choice its own board refuses; that is the disagreement, loudly */
        try { API.stepInPlace(S, choices[t][0], choices[t][1], rng); }
        catch (e) { if (!lean) throw e; boards.push('THREW ' + String(e.message).slice(0, 200)); draws.push(''); break; }
        t++;
        boards.push(canon(S)); draws.push(JSON.stringify(rng.counts));
      }
      return { boards, draws, winner: API.winner(S), lean: !!S._lean };
    };
    const ch = [];
    const F = play(false, ch), Ln = play(true, ch);
    out.games++; out.turns += F.boards.length - 1;
    if (!Ln.lean || F.lean) throw new Error('the lean arm is not lean (or the full arm is)');
    if (F.winner === Ln.winner) out.winners_equal++;
    const n = Math.max(F.boards.length, Ln.boards.length);
    for (let t = 1; t < n; t++) {
      const ok = F.boards[t] === Ln.boards[t] && F.draws[t] === Ln.draws[t];
      if (ok) out.agree++;
      else {
        out.disagree++;
        if (out.first.length < 5) {
          const x = F.boards[t] || '', y = Ln.boards[t] || ''; let i = 0; while (i < x.length && x[i] === y[i]) i++;
          out.first.push({ game: G.id, turn: t, draws: F.draws[t] === Ln.draws[t], full: x.slice(Math.max(0, i - 140), i + 60), lean: y.slice(Math.max(0, i - 140), i + 60) });
        }
      }
    }
  });
  out.lean_steps = API.COUNTERS.leanSteps - out.lean_steps_before;
  out.eligible = L.eligible; out.file = L.file;
  console.log('HUMAN-RESULT ' + JSON.stringify(out));
  process.exit(0);
}

function human(extraEnv) {
  const args = [__filename, '--human-child', '--human', String(HUMAN_N), '--human-turns', String(HUMAN_CAP)];
  if (flag('--human-file', null)) args.push('--human-file', flag('--human-file'));
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, env: Object.assign({}, process.env, extraEnv || {}), encoding: 'utf8', maxBuffer: 1 << 30 });
  const line = (r.stdout || '').split('\n').find(l => l.startsWith('HUMAN-RESULT '));
  if (!line) console.log('  the human arm' + (extraEnv && extraEnv.MEDI_LEAN_BREAK ? ' (red)' : '') + ' did not finish: exit ' + r.status + ' '
    + ((r.stderr || '') + (r.stdout || '')).split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 600));
  if (!line) return { failed: true, why: 'exit ' + r.status + ' ' + ((r.stderr || '') + (r.stdout || '')).split('\n').slice(-8).join(' | ') };
  return JSON.parse(line.slice('HUMAN-RESULT '.length));
}

/* ---------------- LATTICE: the differential, plain and hooked ---------------- */
const RELEASE = flag('--release', null);
const GAMES = flag('--games', '1200');
const CENSUS = flag('--census', null);
let STORE = flag('--team-store', null);
const SCR = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-lean-'));
function lattice(name, extraEnv, games) {
  const sample = path.join(ROOT, 'data', '_scratch-lean-' + process.pid + '-' + name + '-sample.json');
  const outF = path.join(SCR, name + '-gd.json');
  const hookF = path.join(SCR, name + '-hook.json');
  const args = [];
  if (extraEnv && extraEnv.MEDI_API_HOOK) args.push('-r', path.join(ROOT, 'tests', 'medicham_api_diffhook.js'));
  args.push(path.join(ROOT, 'engine', 'game_differential.js'), '--regulation', 'regmc', '--steering', 'empirical', '--arm', 'middle',
    '--end-state', '--team-store', STORE, '--release', RELEASE, '--games', String(games || GAMES), '--write', '--out', outF);
  if (CENSUS) args.push('--census', CENSUS);
  const env = Object.assign({}, process.env, { ABRA_REGULATION: 'regmc',
    MEDI_SAMPLE_DUMP: path.relative(ROOT, sample).split(path.sep).join('/') }, extraEnv || {});
  if (extraEnv && extraEnv.MEDI_API_HOOK) env.MEDI_API_HOOK_OUT = hookF;
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 30 });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  let S = null; try { S = JSON.parse(fs.readFileSync(sample, 'utf8')); fs.unlinkSync(sample); } catch (e) { /* reported below */ }
  if (r.status !== 0 || !S) {
    console.log('  ' + name + ': the differential exited ' + r.status + ' after ' + secs + 's');
    console.log((r.stderr || '').split('\n').slice(-12).join('\n'));
    return { name, failed: true };
  }
  console.log('  ' + name + ': ran in ' + secs + 's');
  const H = fs.existsSync(hookF) ? JSON.parse(fs.readFileSync(hookF, 'utf8')) : null;
  return { name, sample: S, hook: H };
}
function sameSample(x, y) {
  if (JSON.stringify(x.arms) === JSON.stringify(y.arms)) return { same: true, games: x.arms.reduce((n, r) => n + r.games.length, 0) };
  let d = 0; x.arms.forEach((arm, i) => arm.games.forEach((g, j) => { const h = y.arms[i] && y.arms[i].games[j]; if (JSON.stringify(g) !== JSON.stringify(h)) d++; }));
  return { same: false, differing: d };
}

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ok    ' : '  FAIL  ') + msg); if (!c) fail++; };
console.log('test-lean-mode: part ' + PART + (DO_LAT ? ', release ' + RELEASE + ' --games ' + GAMES + ' census ' + (CENSUS || '(default)') : '')
  + (DO_HUM ? ', human ' + HUMAN_N + ' games (cap ' + HUMAN_CAP + ' turns)' : ''));

let latRed = null, humRed = null;
if (DO_LAT) {
  if (!RELEASE) cannot('--release <id> is required: the lattice is played by the differential on a frozen release');
  if (!STORE) {
    try { process.env.ABRA_REGULATION = 'regmc'; const RS = require('../../engine/regulation_stores.js'); const p = RS.pool(); if (p) STORE = path.join(ROOT, p.dir); }
    catch (e) { cannot('no team store: ' + e.message.split('\n')[0] + ' (pass --team-store)'); }
  }
  if (!STORE || !fs.existsSync(STORE)) cannot('no Reg M-C frozen pool at ' + STORE + ' (pass --team-store)');
  let plainSample = null;
  if (flag('--plain-sample', null)) { plainSample = JSON.parse(fs.readFileSync(flag('--plain-sample'), 'utf8')); console.log('  plain: read ' + flag('--plain-sample')); }
  else { const p = lattice('plain', {}); if (p.failed) cannot('the plain lattice run did not run'); plainSample = p.sample; }
  const hk = lattice('lean-hook', { MEDI_API_HOOK: 'lean' });
  if (hk.failed || !hk.hook) ok(false, 'LATTICE: the hooked run did not run');
  else {
    const s = sameSample(plainSample, hk.sample);
    ok(s.same, 'LATTICE: the hooked run played the lattice\'s own games -- per-game sample fingerprint ' + (s.same ? 'byte-identical over ' + s.games + ' games' : 'DIFFERS in ' + s.differing + ' games'));
    const H = hk.hook;
    console.log('        lean: ' + H.lean_turns + ' turns in ' + H.lean_battles + ' battle copies; full copy equals the real battle after '
      + H.full_track_agree + ' turns and differs after ' + H.full_track_disagree + ' (trace-only fields aside)');
    ok(H.lean_turns > 0, 'LATTICE: the lean copy played ' + H.lean_turns + ' turns (a zero is the finding)');
    /* EVERY ROUTED TURN IS ACCOUNTED FOR: compared (agree/disagree), a real turn that threw (nothing to compare), or
     * one the harness could not translate (which must be zero -- an uncompared turn is not a pass) */
    const acc = H.lean_agree + H.lean_disagree + (H.lean_real_turn_threw || 0) + (H.lean_untranslated || 0);
    console.log('        accounted: ' + H.lean_agree + ' agree + ' + H.lean_disagree + ' disagree + ' + (H.lean_real_turn_threw || 0)
      + ' real turns that threw + ' + (H.lean_untranslated || 0) + ' untranslated = ' + acc + ' of ' + H.lean_turns
      + '; the pair was re-taken before ' + (H.lean_retaken_edited || 0) + ' turns because the differential had edited the real battle');
    ok(acc === H.lean_turns && !(H.lean_untranslated > 0), 'LATTICE: every routed turn is compared or named (none untranslated)'
      + (H.lean_untranslated_why ? ' -- ' + JSON.stringify(H.lean_untranslated_why).slice(0, 400) : ''));
    ok(H.lean_disagree === 0, 'LATTICE: the lean game equals the full game after every turn (board less ' + JSON.stringify(H.lean_exempt) + ', and the same draws stream by stream)'
      + (H.lean_disagree ? ' -- ' + H.lean_disagree + ' of ' + H.lean_turns + ' turns differ, first ' + JSON.stringify(H.lean_disagreements[0]).slice(0, 900) : ''));
  }
  if (!has('--no-red')) {
    /* the break only has to be SEEN, so the red arm plays a small lattice (--red-games, default 45) */
    const red = lattice('red-lean-break', { MEDI_API_HOOK: 'lean', MEDI_LEAN_BREAK: '1' }, flag('--red-games', '45'));
    latRed = red.failed || !red.hook ? null : red.hook.lean_disagree;
  }
}
if (DO_HUM) {
  const h = human({});
  if (h.failed || h.refused) cannot('the human-sheet arm did not run: ' + (h.why || h.refused));
  console.log('        human: ' + JSON.stringify({ games: h.games, turns: h.turns, agree: h.agree, disagree: h.disagree, winners_equal: h.winners_equal, lean_steps: h.lean_steps, eligible: h.eligible }));
  ok(h.games > 0 && h.turns > 0 && h.lean_steps > 0, 'HUMAN: ' + h.games + ' games, ' + h.turns + ' turns, ' + h.lean_steps + ' lean steps (a zero is the finding)');
  ok(h.disagree === 0, 'HUMAN: the lean game equals the full game after every turn, dice counts included'
    + (h.disagree ? ' -- ' + h.disagree + ' turns differ, first ' + JSON.stringify(h.first[0]).slice(0, 900) : ''));
  ok(h.winners_equal === h.games, 'HUMAN: the same winner in every game (' + h.winners_equal + ' of ' + h.games + ')');
  if (!has('--no-red')) { const r = human({ MEDI_LEAN_BREAK: '1' }); humRed = r.failed ? null : r.disagree; }
}
if (!has('--no-red')) {
  console.log('  RED ARM -- MEDI_LEAN_BREAK=1 (a lean turn skips Leftovers\' heal) must FAIL each population:');
  let blind = 0;
  if (DO_LAT) { console.log('    lattice -> ' + (latRed ? 'red, as it must be (' + latRed + ' lean turns differ)' : 'STILL GREEN (blind)')); if (!latRed) blind++; }
  if (DO_HUM) { console.log('    human   -> ' + (humRed ? 'red, as it must be (' + humRed + ' lean turns differ)' : 'STILL GREEN (blind)')); if (!humRed) blind++; }
  if (blind) { console.log('ABRA-EXIT 3 VERDICT-RED'); console.log('BLIND: ' + blind + ' population(s) stayed green on the break'); process.exit(3); }
}
if (fail) { console.log('ABRA-EXIT 1 VERDICT-RED'); console.log('FAIL: ' + fail); process.exit(1); }
console.log('ABRA-EXIT 0 VERDICT-GREEN');
console.log('PASS');
