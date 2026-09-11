/* bench_interleave.js — DO TWO LIVE MEDICHAM BATTLES STAY INDEPENDENT WHEN STEPPED ALTERNATELY?
 *
 * SEARCH, 2026-09-11. The clone-cost bench (data/verification/clone-cost-2026-09-11/bench_clone.js)
 * proved each rollout's rebuild-from-board is independent, but it only ever ran ONE battle at a time.
 * medicham2-browser.js keeps its "current battle" in module-level variables. A tree search keeps
 * several positions alive and steps them in an interleaved order; if a module variable carries state
 * from one battle into another, every search result is silently corrupted and nothing errors.
 *
 * WHAT IS PLAYED. Positions come from the pinned pool exactly as bench_clone.js makes them (Showdown
 * games under a seeded random policy, a Board filled through its public API). Each position is turned
 * into a live MEDICHAM battle by THE REAL REBUILD — rollout_leaf.rolloutWinProb with maxTurns:-1, the
 * battle captured through a pass-through wrapper on MEDI.battleInit. A battle is stepped ONE TURN AT A
 * TIME through THE REAL PLAYOUT (rollout_leaf.runPlayout, explore 1.0, uniform foe) by setting
 * S.maxTurns = S.turn+1; `maxTurns` is read in exactly one place (release medicham2-browser.js:25846,
 * `battleOver`), so the cap changes nothing inside a turn. Every battle owns its own dice
 * (mulberry(seed)), so "the same dice" is literal: each battle consumes its own stream in both arms.
 *
 * THE ARMS, per pair (P, Q), each played from scratch:
 *   A0  isolated      build P, play P; build Q, play Q.            What the leaf does today.
 *   A1  alive, seq    build P, build Q; play P; play Q.            The brief's arm 1.
 *   A2  interleaved   build P, build Q; P,Q,P,Q,...                The brief's arm 2.
 *   A3  tree-shaped   build P, step P, build Q, step Q, P,Q,...    A node expanded while another lives.
 * Each at STEPS turns and again to the end of the battle (FULL_CAP turns). Cross pairs (neighbouring
 * positions, different games and depths) and self pairs (P and a second rebuild of P on the SAME dice).
 *
 * WHAT IS COMPARED. The whole battle object (canonical JSON, the trace sink excluded), the protocol the
 * battle wrote into its own trace sink, battleResult read at three moments (the step that finished it,
 * the end of the arm, and after one further unrelated battleInit), and the MEDSEEN/MEDFAILS deltas.
 * Two process-global stamps are rank-normalised exactly as bench_clone.js does and for its stated
 * reason (`_faintSeq`, `_rtieGen`: only their order/equality within a battle is ever read). A third,
 * `_fEpoch`, is NOT an offset — `lastFaintSeq` (release :25635-25637) counts a faint only if its stamp
 * EQUALS the module's current `_FAINT_EPOCH`, which the most recent battleInit set — so it is reported
 * relative to the battle's own build and never silently dropped; the epoch-blind comparison is a
 * SEPARATE, labelled one.
 *
 * RED FIRST. Unless --no-red, the parent re-runs this file twice as a child against a SCRATCH COPY of
 * the release (in --scratch, outside the repo) with one module variable deliberately leaked:
 *   dice   the generic dice stream is latched in a module variable at the first battleTurn after a
 *          battleInit and handed to every battle stepped after it
 *   trace  the trace sink is latched: traceBind binds only when nothing is bound, traceRelease never
 *          releases
 * `dice` must FAIL the interleave state check and `trace` must FAIL the interleave protocol check, or
 * the check is blind and the run exits 3.
 *
 * EVENT-ADDRESSED DICE (game_differential's instrument, NOT the rollout path) are checked separately:
 * MEDI.midEventDice keys its repeat counter MID_NTH on seed|turn|cat|move|target with no battle
 * identity (release :26569-26577), so two battles stepped alternately on the default seed can share it.
 *
 * Not an accuracy claim about MEDICHAM, which is quarantined. Independence only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');
const cp = require('child_process');

const ROOT = 'C:/Users/willj/Projects/Pokemon/ABRA';
const D = (...p) => path.join(ROOT, ...p);
const HERE = path.join(ROOT, 'data', 'verification', 'interleave-2026-09-11');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const SMOKE = has('--smoke');
const RED = arg('--red', null);
const NO_RED = has('--no-red');
const REL_ID = arg('--release', '2b5a6585d8cf');
const TEAM_STORE = arg('--team-store', 'data/team-pool-frozen');
const GAMES = +arg('--games', SMOKE ? 3 : 16);
const STRIDE = +arg('--stride', 800);
const DEPTHS = String(arg('--depths', '2,5,8,12')).split(',').map(Number);
const STEPS = +arg('--steps', 3);
const SEEDS = +arg('--seeds', SMOKE ? 1 : 3);
const FULL_SEEDS = +arg('--full-seeds', SMOKE ? 1 : 4);
const FULL_CAP = +arg('--full-cap', 20);
const SCRATCH = arg('--scratch', path.join(os.tmpdir(), 'abra-interleave-2026-09-11'));
const SHOWDOWN_CHECKOUT = arg('--showdown', 'C:/Users/willj/Projects/Pokemon/pokemon-showdown');
/* where the red children write. Default = this folder, which is what the 2026-09-11 run used; a re-run
 * passes a NEW directory so it cannot overwrite that run's red-*.json. Added after that run. */
const RED_OUT_DIR = arg('--red-out-dir', HERE);
const OUT = arg('--out', SMOKE ? null : path.join(HERE, RED ? 'red-' + RED + '.json' : 'interleave.json'));
const FLAGS = { release: REL_ID, team_store: TEAM_STORE, games: GAMES, stride: STRIDE, depths: DEPTHS, steps: STEPS,
  seeds: SEEDS, full_seeds: FULL_SEEDS, full_cap: FULL_CAP, red: RED, no_red: NO_RED, smoke: SMOKE,
  showdown: SHOWDOWN_CHECKOUT, argv: process.argv.slice(2) };

const sha12 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const sha12File = (f) => { try { return sha12(fs.readFileSync(f)); } catch (e) { return 'MISSING:' + e.code; } };
const toID = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE RED PATCHES. Every target must occur EXACTLY ONCE in the release file, or the run refuses. */
const RED_PATCHES = {
  dice: {
    what: 'the dice-stream struct is latched in ONE module variable at the first battleTurn after a battleInit and handed to every battle stepped after it — one battle inherits another battle\'s sequence, the coupling the comment above MED_RNG (release medicham2-browser.js:23305-23317) says its unconditional assignment prevents',
    must_fail: 'interleave state',
    edits: [
      ['let MED_RNG=null;', 'let MED_RNG=null; let RED_LATCHED_R=null;'],
      ['  _FAINT_EPOCH++;', '  _FAINT_EPOCH++; RED_LATCHED_R=null;'],
      ['  const _R=rngStreams(rng); rng=_R.any;', '  const _R=(RED_LATCHED_R=RED_LATCHED_R||rngStreams(rng)); rng=_R.any;'],
    ],
  },
  trace: {
    what: 'trace sink latched: traceBind binds only when no sink is bound and traceRelease never releases, so every battle stepped after the first writes its protocol into the first battle\'s sink',
    must_fail: 'interleave protocol',
    edits: [
      ["  if(t&&typeof t.push==='function'){ TRACE.out=t; TRACE.S=S; TR=TRACE; }", "  if(t&&typeof t.push==='function'){ if(!TR){ TRACE.out=t; TRACE.S=S; TR=TRACE; } }"],
      ['function traceRelease(prev){ TR=prev; if(!prev){TRACE.out=null;TRACE.S=null;} }', 'function traceRelease(prev){ }'],
    ],
  },
};

/* ---- LOAD ------------------------------------------------------------------------------------- */
process.env.SHOWDOWN_PATH = SHOWDOWN_CHECKOUT;
const REL = require(D('engine', 'engine_release.js')).open(REL_ID);   // verifies the digests either way
let MEDI, B, RL, CS, ENGINE;
if (!RED) {
  MEDI = REL.require('engine/medicham2-browser.js', { need: ['battleInit', 'battleTurn', 'battleOver', 'battleResult', 'midEventDice', 'MEDSEEN', 'MEDFAILS'] });
  B = REL.require('engine/board.js', { need: ['Board', 'norm', 'baseSpecies'] });
  RL = REL.require('engine/rollout_leaf.js', { need: ['rolloutWinProb', 'runPlayout', 'terrainOnBoard'],
    dataMissingOk: ['data/rollout-switch-census.json'] });
  CS = REL.require('engine/champions_sim.js', { need: ['sim', 'FORMAT', 'actualCommit'] });
  ENGINE = Object.assign({ kind: 'frozen release' }, REL.stamp());
} else {
  const P = RED_PATCHES[RED];
  if (!P) throw new Error('unknown --red variant ' + RED + '; known: ' + Object.keys(RED_PATCHES).join(', '));
  fs.mkdirSync(SCRATCH, { recursive: true });
  const dir = fs.mkdtempSync(path.join(SCRATCH, 'red-' + RED + '-' + REL.id + '-'));
  fs.cpSync(REL.dir, dir, { recursive: true });
  const f = path.join(dir, 'engine', 'medicham2-browser.js');
  let src = fs.readFileSync(f, 'utf8');
  const before = sha12(src);
  for (const [from, to] of P.edits) {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error('red patch target occurs ' + n + ' times, want exactly 1: ' + from.slice(0, 90));
    src = src.replace(from, () => to);
  }
  fs.writeFileSync(f, src);
  MEDI = require(f);
  B = require(path.join(dir, 'engine', 'board.js'));
  RL = require(path.join(dir, 'engine', 'rollout_leaf.js'));
  CS = require(path.join(dir, 'engine', 'champions_sim.js'));
  ENGINE = { kind: 'SCRATCH RED COPY — deliberately broken; NOT an engine measurement', of_release: REL.id,
    copy_dir: dir, medicham_sha12_release: before, medicham_sha12_patched: sha12(src), red_variant: RED,
    what: P.what, must_fail: P.must_fail, edits: P.edits };
}
const SDX = CS.sim();
const Battle = SDX.Battle;
const dex = SDX.Dex.forFormat(CS.FORMAT);
dex.species.get('garchomp');
{
  const want = String(REL.manifest.showdown_commit || ''), got = String(CS.actualCommit() || '');
  if (!want || !got || !(want.startsWith(got) || got.startsWith(want))) {
    throw new Error('Showdown checkout ' + SHOWDOWN_CHECKOUT + ' is at ' + (got || 'UNKNOWN') + ' but release ' + REL.id + ' was cut against ' + (want || 'UNKNOWN'));
  }
}
const CENSUS = (() => {
  const raw = fs.readFileSync(D('data', 'rollout-switch-census.json'), 'utf8');
  const j = JSON.parse(raw);
  const pc = j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  return { switchRate: (typeof pc === 'number' && pc > 0) ? pc / 100 : 0, digest: sha12(raw) };
})();
const SWR = CENSUS.switchRate;
const EXPLORE = 1.0;

/* ---- battleInit is wrapped: capture, and COUNT (the count is the module's _FAINT_EPOCH, inferred;
 * the inference is checked below against the stamps an isolated battle actually carries). -------- */
let CAP = null, INITS = 0;
const EPOCH = new WeakMap();
const _battleInit = MEDI.battleInit;
MEDI.battleInit = function () { const S = _battleInit.apply(this, arguments); INITS++; EPOCH.set(S, INITS); if (CAP) CAP.push(S); return S; };
if (MEDI.battleInit === _battleInit) throw new Error('could not wrap MEDI.battleInit');

const _MathRandom = Math.random;
let MR_N = 0;
Math.random = function () { MR_N++; return _MathRandom(); };

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const C = { pair_skipped: 0, sd_rejected_choice: 0, sd_fell_back_to_default: 0, sd_threw: 0, sd_stuck: 0,
  build_null: 0, build_threw: 0, build_first_error: null, step_threw: 0, step_first_error: null,
  event_step_threw: 0, event_first_error: null };

/* ---- positions: the pinned pool, as bench_clone.js makes them --------------------------------- */
async function loadPairs() {
  const f = D(TEAM_STORE, 'games.bo3.jsonl');
  const rl = readline.createInterface({ input: fs.createReadStream(f, { encoding: 'utf8' }), crlfDelay: Infinity });
  const out = []; let i = -1;
  for await (const line of rl) {
    i++;
    if (i % STRIDE) continue;
    let g; try { g = JSON.parse(line); } catch (e) { C.pair_skipped++; continue; }
    const sh = g && g.sheets;
    const ok = (t) => Array.isArray(t) && t.length >= 4 && t.every(p => p && dex.species.get(p.species).exists
      && (p.moves || []).some(m => dex.moves.get(m).exists));
    if (!sh || !ok(sh.p1) || !ok(sh.p2)) { C.pair_skipped++; continue; }
    out.push({ id: g.id, line: i, A: sh.p1.slice(0, 6), B: sh.p2.slice(0, 6) });
    if (out.length >= GAMES) break;
  }
  rl.close();
  return out;
}
function toSet(p) {
  return { name: '', species: dex.species.get(p.species).name, item: p.item || '', ability: p.ability || '',
    moves: (p.moves || []).filter(m => dex.moves.get(m).exists).map(m => dex.moves.get(m).name),
    nature: p.nature || '', gender: p.gender || '', level: 50 };
}
function sdChoiceFor(battle, sideId, rng) {
  const side = battle[sideId]; const req = side.activeRequest;
  if (!req || req.wait) return null;
  if (req.forceSwitch) {
    const claimed = new Set(); const toks = [];
    req.forceSwitch.forEach((need) => {
      if (!need) { toks.push('pass'); return; }
      const outs = []; side.pokemon.forEach((q2, n) => { if (!q2.isActive && !q2.fainted && !claimed.has(n)) outs.push(n); });
      if (!outs.length) { toks.push('pass'); return; }
      const n = outs[Math.floor(rng() * outs.length) % outs.length]; claimed.add(n); toks.push('switch ' + (n + 1));
    });
    return toks.join(', ');
  }
  const foes = (side.foe && side.foe.active) || [];
  const liveFoes = []; foes.forEach((q2, n) => { if (q2 && !q2.fainted) liveFoes.push(n); });
  const claimed = new Set(); const toks = []; let megaTaken = false;
  (req.active || []).forEach((act, i) => {
    const me = side.active[i];
    if (!me || me.fainted || !act) { toks.push('pass'); return; }
    if (!act.trapped && !act.maybeTrapped && rng() < SWR) {
      const outs = []; side.pokemon.forEach((q2, n) => { if (!q2.isActive && !q2.fainted && !claimed.has(n)) outs.push(n); });
      if (outs.length) { const n = outs[Math.floor(rng() * outs.length) % outs.length]; claimed.add(n); toks.push('switch ' + (n + 1)); return; }
    }
    const usable = []; (act.moves || []).forEach((mv, k) => { if (!mv.disabled) usable.push([mv, k]); });
    if (!usable.length) { toks.push('move 1'); return; }
    const [mv, k] = usable[Math.floor(rng() * usable.length) % usable.length];
    const tt = ('target' in mv) ? mv.target : null;
    let tok = 'move ' + (k + 1);
    if (tt === 'normal' || tt === 'any' || tt === 'adjacentFoe') {
      if (liveFoes.length) tok += ' ' + (liveFoes[Math.floor(rng() * liveFoes.length) % liveFoes.length] + 1);
    } else if (tt === 'adjacentAlly') {
      const j = side.active.findIndex((q2, n) => q2 && !q2.fainted && n !== i); if (j >= 0) tok += ' ' + (-(j + 1));
    } else if (tt === 'adjacentAllyOrSelf') { tok += ' ' + (-(i + 1)); }
    if (act.canMegaEvo && !megaTaken) { tok += ' mega'; megaTaken = true; }
    toks.push(tok);
  });
  return toks.join(', ');
}
function stepSD(battle, rng) {
  let acted = false;
  for (const sid of ['p1', 'p2']) {
    const c = sdChoiceFor(battle, sid, rng); if (c === null) continue;
    let ok = false; try { ok = battle.choose(sid, c); } catch (e) { ok = false; }
    if (!ok) { C.sd_rejected_choice++; try { ok = battle.choose(sid, 'default'); C.sd_fell_back_to_default++; } catch (e) { C.sd_threw++; } }
    acted = acted || ok;
  }
  return acted;
}
const seedArr = (s) => [(s * 2654435761) >>> 16 & 0xffff, (s * 40503) & 0xffff, 0x1234, (s + 7) & 0xffff];
function boardFrom(b, pair) {
  const bd = new B.Board(); bd.turn = b.turn;
  const picked = (b.ruleTable && b.ruleTable.pickedTeamSize) || 4;
  for (const [sid, sheet] of [['p1', pair.A], ['p2', pair.B]]) {
    const side = b[sid]; const brought = side.pokemon.slice(0, picked);
    bd.setParty(sid, brought.map(p => p.baseSpecies.name));
    for (const p of brought) {
      const e = sheet.find(x => toID(x.species) === toID(p.set.species)) || {};
      bd.setSheet(sid, p.baseSpecies.name, { nature: e.nature || '', item: e.item || '', ability: e.ability || '', moves: e.moves || [] });
      if (toID(p.item) !== toID(e.item)) bd.noteItem(sid, p.baseSpecies.name, p.item || '');
      for (const ms of p.baseMoveSlots) { const spent = (ms.maxpp | 0) - (ms.pp | 0); if (spent > 0) bd.ppSpend(sid, p.baseSpecies.name, ms.id, spent); }
    }
    side.active.forEach((p, i) => {
      if (!p) return;
      const L = 'ab'[i]; bd.switchIn(sid, L, p.species.name); const m = bd.slot(sid, L);
      if (p.fainted || !p.hp) { bd.faint(sid, L); return; }
      m.hp = p.hp / p.maxhp; m.status = p.status || '';
      const bo = {}; for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (p.boosts[k]) bo[k] = p.boosts[k];
      m.boosts = bo; m.turnsActive = p.activeTurns | 0; m.moveActs = p.activeMoveActions | 0;
      m.lastMove = p.lastMove ? p.lastMove.id : '';
    });
    for (const p of brought) {
      if (p.isActive) continue;
      const k = B.baseSpecies(B.norm(p.species.name));
      if (p.fainted || !p.hp) bd.graveyard[sid].add(k); else bd.lastSeen[sid][k] = { hp: p.hp / p.maxhp, status: p.status || '' };
    }
    for (const [id, st] of Object.entries(side.sideConditions)) { const n = Math.max(1, st.layers | 0); for (let j = 0; j < n; j++) bd.startSide(sid, id, st.duration); }
  }
  const f = b.field;
  if (f.weather) bd.setWeather(f.weather);
  if (f.terrain) bd.startField(f.terrain, f.terrainState && f.terrainState.duration);
  for (const [id, st] of Object.entries(f.pseudoWeather || {})) bd.startField(id, st.duration);
  return bd;
}
function positionsOf(pair, gi) {
  const b = new Battle({ formatid: CS.FORMAT, seed: seedArr(gi + 101) });
  b.setPlayer('p1', { name: 'A', team: pair.A.map(toSet) });
  b.setPlayer('p2', { name: 'B', team: pair.B.map(toSet) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234'); }
  const rng = mulberry(gi * 7919 + 13);
  const want = new Set(DEPTHS), maxD = Math.max(...DEPTHS);
  const out = []; let g = 0;
  while (!b.ended && b.turn <= maxD) {
    if (b.requestState === 'move' && want.has(b.turn) && !out.some(p => p.turn === b.turn)) {
      out.push({ gi, game: pair.id, turn: b.turn, board: boardFrom(b, pair) });
      if (b.turn === maxD) break;
    }
    if (++g > maxD * 12) { C.sd_stuck++; break; }
    if (!stepSD(b, rng)) { C.sd_stuck++; break; }
  }
  return out;
}

/* ---- canonical dumps --------------------------------------------------------------------------- */
function walkObjs(root) {
  const seen = new Set(); const qu = [root]; let h = 0;
  while (h < qu.length) {
    const v = qu[h++];
    if (v === null || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (v instanceof Map) { for (const [k, x] of v) { qu.push(k); qu.push(x); } }
    else if (v instanceof Set) { for (const x of v) qu.push(x); }
    else for (const k of Object.keys(v)) { if (k === '_trace') continue; let x; try { x = v[k]; } catch (e) { continue; } qu.push(x); }
  }
  return seen;
}
function toPlain(root, xf) {
  const seen = new Map();
  const rec = (v, p) => {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? (Object.is(v, -0) ? '<-0>' : v) : '<' + String(v) + '>';
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'undefined') return '<undef>';
    if (t === 'function') return '<fn ' + (v.name || '') + '>';
    if (t === 'bigint' || t === 'symbol') return '<' + String(v) + '>';
    if (seen.has(v)) return '<@' + seen.get(v) + '>';
    seen.set(v, p);
    if (Array.isArray(v)) return v.map((x, i) => rec(x, p + '[' + i + ']'));
    if (v instanceof Map) { const a = []; let i = 0; for (const [k, x] of v) { a.push([rec(k, p + '<k' + i + '>'), rec(x, p + '<' + i + '>')]); i++; } return { '<Map>': a }; }
    if (v instanceof Set) return { '<Set>': [...v].map((x, i) => rec(x, p + '{' + i + '}')) };
    const o = {};
    for (const k of Object.keys(v)) {
      if (k === '_trace') continue;
      let x; try { x = v[k]; } catch (e) { x = '<threw>'; }
      if (xf) x = xf(k, x);
      if (x === DROP) continue;
      o[k] = rec(x, p + '.' + k);
    }
    return o;
  };
  return rec(root, '$');
}
const DROP = Symbol('drop');
const RANK_KEYS = ['_faintSeq', '_rtieGen'];
/* mode: 'raw' | 'norm' (ranks; _fEpoch relative to the battle's own build) | 'eblind' (ranks; _fEpoch dropped) */
function canonS(S, mode) {
  if (mode === 'raw') return JSON.stringify(toPlain(S));
  const objs = [...walkObjs(S)];
  const ranks = {};
  for (const key of RANK_KEYS) {
    const vals = objs.map(o => o[key]).filter(v => typeof v === 'number');
    ranks[key] = new Map([...new Set(vals)].sort((a, b) => a - b).map((v, i) => [v, i]));
  }
  const own = EPOCH.get(S);
  return JSON.stringify(toPlain(S, (k, v) => {
    if (ranks[k] && typeof v === 'number') return '<' + k + '#' + ranks[k].get(v) + '>';
    if (k === '_fEpoch' && typeof v === 'number') return mode === 'eblind' ? DROP : '<ep' + (v - own >= 0 ? '+' : '') + (v - own) + '>';
    return v;
  }));
}
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.slice(0, 110); };
function diffs(x, y, max) {
  const out = []; const seen = new Set(); max = max || 4;
  (function rec(a, b, p) {
    if (out.length >= max || a === b) return;
    const ta = typeof a, tb = typeof b;
    if (ta !== tb || a === null || b === null || ta !== 'object') { out.push(p + ': ' + short(a) + '  vs  ' + short(b)); return; }
    if (seen.has(a)) return; seen.add(a);
    if (Array.isArray(a) !== Array.isArray(b)) { out.push(p + ': array vs object'); return; }
    if (Array.isArray(a) && a.length !== b.length) out.push(p + ': length ' + a.length + ' vs ' + b.length);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) rec(a[k], b[k], p + (Array.isArray(a) ? '[' + k + ']' : '.' + k));
  })(x, y, '$');
  return out;
}
const firstDiff = (sa, sb) => { try { return diffs(JSON.parse(sa), JSON.parse(sb)); } catch (e) { return ['(unparseable)']; } };
const diffField = (d) => { const m = String(d).split(':')[0].match(/\.([A-Za-z_$][\w$]*)(\[\d+\])*$/); return m ? m[1] : String(d).split(':')[0]; };

/* ---- counters ---------------------------------------------------------------------------------- */
function counterSnap() {
  const o = {};
  for (const [name, obj] of [['MEDSEEN', MEDI.MEDSEEN], ['MEDFAILS', MEDI.MEDFAILS]]) {
    for (const k of Object.keys(obj || {})) if (typeof obj[k] === 'number') o[name + '.' + k] = obj[k];
  }
  return o;
}
function counterDelta(a, b) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = (b[k] || 0) - (a[k] || 0); if (d) o[k] = d; }
  return o;
}

/* ---- build, step, read -------------------------------------------------------------------------- */
const fieldOf = (bd) => ({ weather: (typeof bd.weatherWord === 'function' ? bd.weatherWord() : bd.weather) || '', terrain: RL.terrainOnBoard(bd) });
function build(bd) {
  CAP = []; let r = null;
  try { r = RL.rolloutWinProb(bd, 'p1', { n: 1, dex, seed: 7, explore: EXPLORE, foePolicy: 'uniform', field: fieldOf(bd), maxTurns: -1, switchRate: SWR }); }
  catch (e) { C.build_threw++; if (!C.build_first_error) C.build_first_error = String(e && e.message).slice(0, 200); }
  const S = CAP[0] || null; CAP = null;
  if (!r || !S) { C.build_null++; return null; }
  S.maxTurns = FULL_CAP;
  S._trace = [];
  return S;
}
function mkBattle(pos, seed) {
  const S = build(pos.board);
  if (!S) return null;
  return { S, rng: mulberry(seed), ctr: { threw: 0, first: null }, steps: 0, seen: new Map(), restamps: 0, resultAtFinish: null, threw: null };
}
const live = (arr) => (arr || []).filter(m => m && !m.fainted && m.curHP > 0).length;
const bothEmpty = (S) => live(S.actA) + live(S.benchA) === 0 && live(S.actB) + live(S.benchB) === 0;
const over = (bt) => MEDI.battleOver(bt.S);
function noteStamps(bt) {
  const S = bt.S;
  for (const m of new Set([...(S.actA || []), ...(S.benchA || []), ...(S.actB || []), ...(S.benchB || [])])) {
    if (!m || !m.fainted || typeof m._faintSeq !== 'number') continue;
    const was = bt.seen.get(m);
    if (!was) bt.seen.set(m, { seq: m._faintSeq, ep: m._fEpoch });
    else if (was.seq !== m._faintSeq || was.ep !== m._fEpoch) { bt.restamps++; was.seq = m._faintSeq; was.ep = m._fEpoch; }
  }
}
function step(bt) {
  if (!bt || over(bt)) return false;
  const S = bt.S;
  S.maxTurns = S.turn + 1;
  try { RL.runPlayout(S, bt.rng, EXPLORE, 'uniform', bt.ctr, SWR); }
  catch (e) { bt.threw = String(e && e.message).slice(0, 200); C.step_threw++; if (!C.step_first_error) C.step_first_error = bt.threw; }
  S.maxTurns = FULL_CAP;
  bt.steps++;
  noteStamps(bt);
  if (over(bt) && bt.resultAtFinish === null) bt.resultAtFinish = MEDI.battleResult(bt.S);
  return true;
}
/* the event-addressed stepper: MEDICHAM's own chooser on both sides, dice = midEventDice (a struct) */
function stepEvent(bt) {
  if (!bt || over(bt)) return false;
  const S = bt.S;
  S.maxTurns = S.turn + 1;
  try { MEDI.battleTurn(S, bt.dice, null, null); }
  catch (e) { bt.threw = String(e && e.message).slice(0, 200); C.event_step_threw++; if (!C.event_first_error) C.event_first_error = bt.threw; }
  S.maxTurns = FULL_CAP;
  bt.steps++;
  if (over(bt) && bt.resultAtFinish === null) bt.resultAtFinish = MEDI.battleResult(bt.S);
  return true;
}

/* ---- the arms ---------------------------------------------------------------------------------- */
function runArm(kind, pair, turns) {
  const snap0 = counterSnap(); const mr0 = MR_N;
  const cap = turns;
  let bP = null, bQ = null;
  const run = (bt, k) => { for (let i = 0; i < k; i++) if (!step(bt)) break; };
  const alt = (k) => { for (let i = 0; i < k; i++) { const a = step(bP), b = step(bQ); if (!a && !b) break; } };
  if (kind === 'A0') { bP = mkBattle(pair.P, pair.sP); run(bP, cap); bQ = mkBattle(pair.Q, pair.sQ); run(bQ, cap); }
  else if (kind === 'A1') { bP = mkBattle(pair.P, pair.sP); bQ = mkBattle(pair.Q, pair.sQ); run(bP, cap); run(bQ, cap); }
  else if (kind === 'A2') { bP = mkBattle(pair.P, pair.sP); bQ = mkBattle(pair.Q, pair.sQ); alt(cap); }
  else if (kind === 'A3') { bP = mkBattle(pair.P, pair.sP); step(bP); bQ = mkBattle(pair.Q, pair.sQ); step(bQ); alt(cap - 1); }
  if (!bP || !bQ) return null;
  const counters = counterDelta(snap0, counterSnap());
  const mr = MR_N - mr0;
  const res = (bt) => ({ raw: canonS(bt.S, 'raw'), norm: canonS(bt.S, 'norm'), eblind: canonS(bt.S, 'eblind'),
    proto: JSON.stringify(bt.S._trace), steps: bt.steps, turn: bt.S.turn, over: over(bt), threw: bt.threw,
    restamps: bt.restamps, resultAtFinish: bt.resultAtFinish, resEnd: MEDI.battleResult(bt.S), doubleWipe: bothEmpty(bt.S),
    epoch: EPOCH.get(bt.S), stamps: [...bt.seen.values()].map(x => x.ep) });
  const out = { P: res(bP), Q: res(bQ), counters, math_random: mr };
  /* THE LATE READ: one further, unrelated battleInit (a node expanded somewhere else), then read again. */
  const lateSnap = counterSnap();
  build(pair.P.board);
  out.P.resLate = MEDI.battleResult(bP.S); out.Q.resLate = MEDI.battleResult(bQ.S);
  out.late_counters = counterDelta(lateSnap, counterSnap());
  return out;
}
function runEventArm(kind, pair, turns, seed) {
  const mk = (pos) => { const S = build(pos.board); return S ? { S, dice: null, steps: 0, resultAtFinish: null, threw: null } : null; };
  let bP, bQ;
  const run = (bt, k) => { for (let i = 0; i < k; i++) if (!stepEvent(bt)) break; };
  if (kind === 'E1') { bP = mk(pair.P); if (!bP) return null; bP.dice = MEDI.midEventDice({ seed }); run(bP, turns);
                       bQ = mk(pair.Q); if (!bQ) return null; bQ.dice = MEDI.midEventDice({ seed }); run(bQ, turns); }
  else { bP = mk(pair.P); bQ = mk(pair.Q); if (!bP || !bQ) return null;
         bP.dice = MEDI.midEventDice({ seed }); bQ.dice = MEDI.midEventDice({ seed });
         for (let i = 0; i < turns; i++) { const a = stepEvent(bP), b = stepEvent(bQ); if (!a && !b) break; } }
  const res = (bt) => ({ norm: canonS(bt.S, 'eblind'), proto: JSON.stringify(bt.S._trace), resultAtFinish: bt.resultAtFinish, threw: bt.threw });
  return { P: res(bP), Q: res(bQ) };
}

/* ---- comparison tallies ------------------------------------------------------------------------ */
function Tally() { return { n: 0, pass: 0, fail: 0, first: null, fields: {} }; }
function cmp(t, a, b, at, withDiff) {
  t.n++;
  if (a === b) { t.pass++; return true; }
  t.fail++;
  if (withDiff !== false) {
    const d = firstDiff(a, b);
    for (const x of d) { const f = diffField(x); t.fields[f] = (t.fields[f] || 0) + 1; }
    if (!t.first) t.first = { at, diff: d };
  }
  return false;
}
function cmpVal(t, a, b, at) { t.n++; if (a === b) { t.pass++; return true; } t.fail++; if (!t.first) t.first = { at, a, b }; return false; }
const protoDiff = (a, b) => { const x = JSON.parse(a), y = JSON.parse(b); const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) return { line: i, a: short(x[i]), b: short(y[i]), len: [x.length, y.length] };
  return { line: n, a: '(end)', b: '(end)', len: [x.length, y.length] }; };
function cmpProto(t, a, b, at) { t.n++; if (a === b) { t.pass++; return true; } t.fail++; if (!t.first) t.first = { at, diff: protoDiff(a, b) }; return false; }
function cmpCounters(t, a, b, at) {
  t.n++;
  const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => (a[k] || 0) !== (b[k] || 0)).sort();
  if (!ks.length) { t.pass++; return true; }
  t.fail++;
  for (const k of ks) t.fields[k] = (t.fields[k] || 0) + 1;
  if (!t.first) t.first = { at, keys: ks.slice(0, 8).map(k => [k, a[k] || 0, b[k] || 0]) };
  return false;
}

function Block() {
  return { state_norm: Tally(), state_raw: Tally(), state_eblind: Tally(), protocol: Tally(), result_at_finish: Tally(),
    result_end: Tally(), counters: Tally() };
}
function compareArms(blk, X, Y, at, which) {
  for (const s of which || ['P', 'Q']) {
    const a = X[s], b = Y[s]; const w = at + ' ' + s;
    cmp(blk.state_norm, a.norm, b.norm, w);
    cmp(blk.state_raw, a.raw, b.raw, w);
    cmp(blk.state_eblind, a.eblind, b.eblind, w);
    cmpProto(blk.protocol, a.proto, b.proto, w);
    cmpVal(blk.result_at_finish, a.resultAtFinish, b.resultAtFinish, w);
    cmpVal(blk.result_end, a.resEnd, b.resEnd, w);
  }
  cmpCounters(blk.counters, X.counters, Y.counters, at);
}
const slim = (blk) => { const o = {}; for (const [k, t] of Object.entries(blk)) o[k] = { n: t.n, pass: t.pass, fail: t.fail,
  fields: Object.keys(t.fields).length ? t.fields : undefined, first: t.first || undefined }; return o; };

/* ================================== MAIN ======================================================== */
(async () => {
  const T0 = Date.now();

  /* ---- RED FIRST, in children, against scratch copies. ------------------------------------------ */
  const RED_RESULTS = {};
  let redCaught = null;
  if (!RED && !NO_RED) {
    console.log('');
    console.log('INTERLEAVE — red demo first (children against scratch copies of release ' + REL.id + ')');
    redCaught = true;
    for (const v of Object.keys(RED_PATCHES)) {
      const outPath = SMOKE ? path.join(SCRATCH, 'smoke-red-' + v + '.json') : path.join(RED_OUT_DIR, 'red-' + v + '.json');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const fwd = [];
      for (const f of ['--release', '--team-store', '--games', '--stride', '--depths', '--steps', '--seeds', '--full-seeds', '--full-cap', '--scratch', '--showdown']) {
        const x = arg(f, null); if (x !== null) fwd.push(f, x);
      }
      if (!process.argv.includes('--scratch')) fwd.push('--scratch', SCRATCH);
      if (SMOKE) fwd.push('--smoke');
      const t = Date.now();
      const r = cp.spawnSync(process.execPath, [__filename, '--red', v, '--out', outPath, ...fwd],
        { stdio: ['ignore', 'inherit', 'inherit'], timeout: 30 * 60 * 1000 });
      let j = null; try { j = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) { j = null; }
      const I = j && j.checks;
      const failedState = I ? (I.interleave_3.state_norm.fail + I.interleave_full.state_norm.fail + I.self_interleave_3.state_norm.fail + I.self_interleave_full.state_norm.fail) : null;
      const failedProto = I ? (I.interleave_3.protocol.fail + I.interleave_full.protocol.fail + I.self_interleave_3.protocol.fail + I.self_interleave_full.protocol.fail) : null;
      const caught = !!I && (RED_PATCHES[v].must_fail === 'interleave state' ? failedState > 0 : failedProto > 0);
      RED_RESULTS[v] = { exit: r.status, signal: r.signal, pid: r.pid, ms: Date.now() - t, artifact: path.relative(ROOT, outPath).replace(/\\/g, '/'),
        must_fail: RED_PATCHES[v].must_fail, interleave_state_fails: failedState, interleave_protocol_fails: failedProto, caught };
      if (!caught) redCaught = false;
      console.log('   red ' + v.padEnd(6) + (caught ? 'CAUGHT' : '*** NOT CAUGHT ***') + '  state fails ' + failedState + '  protocol fails ' + failedProto + '  (exit ' + r.status + ')');
    }
  }

  const RESULT = { generated: new Date().toISOString(), by: 'data/verification/interleave-2026-09-11/bench_interleave.js (SEARCH)',
    question: 'Do two live MEDICHAM battles stay independent when stepped alternately, turn by turn?',
    not_an_accuracy_claim: 'MEDICHAM is quarantined for correctness. Independence only.',
    engine: ENGINE, showdown_commit_checkout: CS.actualCommit(), format: CS.FORMAT,
    team_store_pinned_to: TEAM_STORE, team_store_bo3_sha12: sha12File(D(TEAM_STORE, 'games.bo3.jsonl')),
    census: CENSUS, explore: EXPLORE, foe_policy: 'uniform', flags: FLAGS, node: process.version, counters: C };

  console.log('');
  console.log('INTERLEAVE ' + (RED ? '[RED ' + RED + ' — scratch copy, deliberately broken]' : '— release ' + REL.id) + '   showdown ' + (CS.actualCommit() || '?'));
  const MC0 = sha12(JSON.stringify(toPlain(globalThis.MC)));

  const pairs = await loadPairs();
  const positions = [];
  pairs.forEach((p, gi) => { for (const pos of positionsOf(p, gi)) positions.push(pos); });
  positions.forEach((p, i) => { p._i = i; });
  RESULT.pool_games = pairs.map(p => ({ id: p.id, line: p.line }));
  RESULT.positions = positions.map(p => ({ game: p.game, turn: p.turn }));
  const byDepth = {}; for (const d of DEPTHS) byDepth[d] = positions.filter(p => p.turn === d).length;
  console.log('  pool ' + TEAM_STORE + ' stride ' + STRIDE + ' -> ' + pairs.length + ' games; positions ' + positions.length + ' by depth ' + JSON.stringify(byDepth));

  /* primer: a one-time lazy initialisation is separated from anything a turn writes */
  if (positions.length) { const bt = mkBattle(positions[0], 1); if (bt) { step(bt); step(bt); } }
  const MC1 = sha12(JSON.stringify(toPlain(globalThis.MC)));
  const RUN_SNAP0 = counterSnap();
  const TP = { _t: Date.now() };

  const K = {
    interleave_3: Block(), interleave_full: Block(),            // A2 vs A1, cross pairs
    self_interleave_3: Block(), self_interleave_full: Block(),  // A2 vs A1, self pairs
    self_twins_in_A2_eblind: Tally(), self_twins_in_A2_protocol: Tally(), self_twins_in_A2_result: Tally(),
    alive_vs_isolated_3: Block(), alive_vs_isolated_full: Block(),   // A1 vs A0
    tree_vs_isolated_3: Block(), tree_vs_isolated_full: Block(),     // A3 vs A0
  };
  const EPOCH_CHECK = { isolated_battles_with_faints: 0, stamps_checked: 0, stamps_equal_own_build: 0 };
  const RESTAMPS = { A0: 0, A1: 0, A2: 0, A3: 0 };
  const LATE = { battles: 0, finished: 0, double_wipes: 0, flips_vs_isolated_at_finish: 0, by_arm: {}, examples: [],
    late_counter_totals: {} };
  const FINISH = { by_arm: {} };
  const MR = { total_in_arms: 0 };
  const DW = { full_battles: 0, double_wipes: 0 };

  const pairList = [];
  for (let i = 0; i < positions.length; i++) {
    const P = positions[i], Q = positions[(i + 1) % positions.length];
    pairList.push({ kind: 'cross', P, Q, at: 'g' + P.gi + 't' + P.turn + '~g' + Q.gi + 't' + Q.turn });
    pairList.push({ kind: 'self', P, Q: P, at: 'g' + P.gi + 't' + P.turn + '~self' });
  }

  for (const pr of pairList) {
    for (const [horizon, nseeds, turns] of [['3', SEEDS, STEPS], ['full', FULL_SEEDS, FULL_CAP]]) {
      for (let s = 0; s < nseeds; s++) {
        const sP = 5000 + pr.P._i * 101 + s * 7;
        const pair = { P: pr.P, Q: pr.Q, sP, sQ: pr.kind === 'self' ? sP : sP + 7777 };
        const at = pr.at + ' s' + s + ' h' + horizon;
        const arms = {};
        for (const kind of ['A0', 'A1', 'A2', 'A3']) {
          const r = runArm(kind, pair, turns);
          if (!r) continue;
          arms[kind] = r;
          MR.total_in_arms += r.math_random;
          RESTAMPS[kind] += r.P.restamps + r.Q.restamps;
          for (const side of ['P', 'Q']) {
            const x = r[side];
            LATE.battles++;
            if (x.over) LATE.finished++;
            const key = kind + '/h' + horizon;
            const L = LATE.by_arm[key] || (LATE.by_arm[key] = { battles: 0, double_wipes: 0, late_differs_from_end: 0, late_differs_from_isolated: 0 });
            L.battles++;
            if (x.doubleWipe) { L.double_wipes++; }
            if (x.resLate !== x.resEnd) L.late_differs_from_end++;
            if (horizon === 'full') { DW.full_battles++; if (x.doubleWipe) DW.double_wipes++; }
          }
          for (const k of Object.keys(r.late_counters)) LATE.late_counter_totals[k] = (LATE.late_counter_totals[k] || 0) + r.late_counters[k];
        }
        if (!arms.A0 || !arms.A1 || !arms.A2 || !arms.A3) continue;
        /* epoch inference check: an isolated P was built and played before anything else was built */
        { const x = arms.A0.P; if (x.stamps.length) { EPOCH_CHECK.isolated_battles_with_faints++;
            for (const e of x.stamps) { EPOCH_CHECK.stamps_checked++; if (e === x.epoch) EPOCH_CHECK.stamps_equal_own_build++; } } }
        /* the isolated battle, read the moment it finished, is the reference the leaf actually uses */
        for (const kind of ['A1', 'A2', 'A3']) for (const side of ['P', 'Q']) {
          const ref = arms.A0[side].resultAtFinish, x = arms[kind][side];
          const key = kind + '/h' + horizon;
          const F = FINISH.by_arm[key] || (FINISH.by_arm[key] = { finished: 0, at_finish_differs: 0, late_differs: 0, late_differs_double_wipes: 0 });
          if (ref === null) continue;
          F.finished++;
          if (x.resultAtFinish !== ref) F.at_finish_differs++;
          if (x.resLate !== ref) { F.late_differs++; if (x.doubleWipe) F.late_differs_double_wipes++;
            if (LATE.examples.length < 8) LATE.examples.push({ at, arm: kind, side, isolated_at_finish: ref, at_finish: x.resultAtFinish, end: x.resEnd, late: x.resLate, doubleWipe: x.doubleWipe }); }
        }
        { const x = arms.A0; for (const side of ['P', 'Q']) if (x[side].resLate !== x[side].resultAtFinish && x[side].resultAtFinish !== null) {
            LATE.flips_vs_isolated_at_finish++;
            if (LATE.examples.length < 8) LATE.examples.push({ at, arm: 'A0', side, isolated_at_finish: x[side].resultAtFinish, late: x[side].resLate, doubleWipe: x[side].doubleWipe }); } }
        for (const side of ['P', 'Q']) if (arms.A0[side].doubleWipe) LATE.double_wipes++;

        const tag = pr.kind === 'self' ? 'self_interleave_' : 'interleave_';
        compareArms(K[tag + (horizon === '3' ? '3' : 'full')], arms.A2, arms.A1, at);
        if (pr.kind === 'self') {
          cmp(K.self_twins_in_A2_eblind, arms.A2.P.eblind, arms.A2.Q.eblind, at);
          cmpProto(K.self_twins_in_A2_protocol, arms.A2.P.proto, arms.A2.Q.proto, at);
          cmpVal(K.self_twins_in_A2_result, arms.A2.P.resultAtFinish, arms.A2.Q.resultAtFinish, at);
        } else {
          compareArms(K['alive_vs_isolated_' + (horizon === '3' ? '3' : 'full')], arms.A1, arms.A0, at);
          compareArms(K['tree_vs_isolated_' + (horizon === '3' ? '3' : 'full')], arms.A3, arms.A0, at);
        }
      }
    }
  }

  TP.arms_ms = Date.now() - TP._t; TP._t = Date.now();
  /* ---- event-addressed dice: the differential's instrument, NOT the rollout path --------------------- */
  const EV = { same_seed_self: Block(), same_seed_cross: Block(), distinct_seed_cross: Block() };
  const EV_SEED = 20260911;
  for (const pr of pairList) {
    const pair = { P: pr.P, Q: pr.Q };
    const blkSame = pr.kind === 'self' ? EV.same_seed_self : EV.same_seed_cross;
    const a1 = runEventArm('E1', pair, STEPS, EV_SEED), a2 = runEventArm('E2', pair, STEPS, EV_SEED);
    if (a1 && a2) for (const side of ['P', 'Q']) { cmp(blkSame.state_eblind, a2[side].norm, a1[side].norm, pr.at + ' ' + side); cmpProto(blkSame.protocol, a2[side].proto, a1[side].proto, pr.at + ' ' + side); }
    if (pr.kind === 'cross') {
      const d1 = (() => { const x = runEventArmSeeds('E1', pair); return x; })(), d2 = runEventArmSeeds('E2', pair);
      if (d1 && d2) for (const side of ['P', 'Q']) { cmp(EV.distinct_seed_cross.state_eblind, d2[side].norm, d1[side].norm, pr.at + ' ' + side); cmpProto(EV.distinct_seed_cross.protocol, d2[side].proto, d1[side].proto, pr.at + ' ' + side); }
    }
  }
  function runEventArmSeeds(kind, pair) {
    const mk = (pos) => { const S = build(pos.board); return S ? { S, dice: null, steps: 0, resultAtFinish: null, threw: null } : null; };
    let bP, bQ;
    if (kind === 'E1') { bP = mk(pair.P); if (!bP) return null; bP.dice = MEDI.midEventDice({ seed: EV_SEED }); for (let i = 0; i < STEPS; i++) stepEvent(bP);
                         bQ = mk(pair.Q); if (!bQ) return null; bQ.dice = MEDI.midEventDice({ seed: EV_SEED + 1 }); for (let i = 0; i < STEPS; i++) stepEvent(bQ); }
    else { bP = mk(pair.P); bQ = mk(pair.Q); if (!bP || !bQ) return null; bP.dice = MEDI.midEventDice({ seed: EV_SEED }); bQ.dice = MEDI.midEventDice({ seed: EV_SEED + 1 });
           for (let i = 0; i < STEPS; i++) { stepEvent(bP); stepEvent(bQ); } }
    const res = (bt) => ({ norm: canonS(bt.S, 'eblind'), proto: JSON.stringify(bt.S._trace) });
    return { P: res(bP), Q: res(bQ) };
  }

  /* ---- DOUBLE WIPES: the only case `lastFaintSeq` (and so `_FAINT_EPOCH`) decides a result ------------
   * natural     full random playouts from the pinned positions, as they are
   * staged_1hp  CONSTRUCTED: every living body set to 1 HP after the rebuild, so a double wipe is common.
   *             A fixture, not a claim about how often it happens.
   * For every double wipe: r0 = the result read the moment it finished (what runPlayout returns),
   * r1 = read again with NOTHING built in between (the control), r2 = read after ONE unrelated battleInit.
   * And the same dice replayed with a battleInit inserted after the first turn (tree-shaped), whose
   * finish-time result and epoch-blind state must equal the isolated one's. */
  const DW_SEEDS = +arg('--dw-seeds', SMOKE ? 2 : 10), DW_STAGED_SEEDS = +arg('--dw-staged-seeds', SMOKE ? 2 : 6);
  FLAGS.dw_seeds = DW_SEEDS; FLAGS.dw_staged_seeds = DW_STAGED_SEEDS;
  const dwBlock = () => ({ playouts: 0, finished: 0, double_wipes: 0, result_at_finish: {}, reread_no_build_differs: 0,
    late_read_differs: 0, late_read_values: {}, tree_at_finish_differs: 0, tree_state_eblind_differs: 0, examples: [] });
  const DWP = { natural: dwBlock() };
  const playDW = (pos, seed, stage, buildAfterFirst) => {
    const bt = mkBattle(pos, seed); if (!bt) return null;
    if (stage) for (const m of [...bt.S.actA, ...bt.S.benchA, ...bt.S.actB, ...bt.S.benchB]) if (m && !m.fainted && m.curHP > 0) m.curHP = 1;
    for (let i = 0; i < FULL_CAP && !over(bt); i++) { step(bt); if (i === 0 && buildAfterFirst) build(buildAfterFirst.board); }
    return bt;
  };
  const dwRun = (blk, pos, other, seed, stage) => {
    const bt = playDW(pos, seed, stage, null); if (!bt) return;
    blk.playouts++;
    if (!over(bt)) return;
    blk.finished++;
    if (!bothEmpty(bt.S)) return;
    blk.double_wipes++;
    const r0 = bt.resultAtFinish;
    const r1 = MEDI.battleResult(bt.S);
    const eb0 = canonS(bt.S, 'eblind');
    build(other.board);
    const r2 = MEDI.battleResult(bt.S);
    blk.result_at_finish[r0] = (blk.result_at_finish[r0] || 0) + 1;
    blk.late_read_values[r2] = (blk.late_read_values[r2] || 0) + 1;
    if (r1 !== r0) blk.reread_no_build_differs++;
    if (r2 !== r0) { blk.late_read_differs++; if (blk.examples.length < 6) blk.examples.push({ game: pos.game, turn: pos.turn, seed, at_finish: r0, reread_no_build: r1, after_one_build: r2, turns_played: bt.S.turn }); }
    const bt2 = playDW(pos, seed, stage, other);
    if (bt2) { if (bt2.resultAtFinish !== r0) blk.tree_at_finish_differs++; if (canonS(bt2.S, 'eblind') !== eb0) blk.tree_state_eblind_differs++; }
  };
  TP.event_dice_ms = Date.now() - TP._t; TP._t = Date.now();
  const dwSnap0 = counterSnap();
  for (const pos of positions) {
    const other = positions[(pos._i + 1) % positions.length];
    for (let s = 0; s < DW_SEEDS; s++) dwRun(DWP.natural, pos, other, 9000 + pos._i * 131 + s, false);
  }
  DWP.counters = Object.fromEntries(Object.entries(counterDelta(dwSnap0, counterSnap())).filter(([k]) => /doubleWipe/i.test(k)));
  TP.double_wipe_natural_ms = Date.now() - TP._t; TP._t = Date.now();

  /* THE CONSTRUCTED DOUBLE WIPE. 1-HP staging alone does not make one (measured: 0 of 16 on the smoke),
   * because the engine ends a battle the instant ONE side is wiped (the `residualBody` drain, release
   * :44824-44826), so a double wipe needs a single faint batch to take both sides' last bodies. The
   * fixture: after the rebuild, each side keeps ONE living active body (every other living body is set
   * fallen, the state the leaf's seeded roster corpses already carry), both lone bodies at 1 HP, and
   * both FORCED to Struggle at each other through the engine's own `playerAction(me,'struggle',...)`
   * — the action `struggleAction` builds (release :7002). Whoever moves first KOs the other and dies to
   * its own recoil in the same action. One turn. Then: r0 read immediately, r1 read again with nothing
   * built (CONTROL), r2 read after ONE unrelated battleInit, r3 after a second. */
  const SF = { fixtures: 0, double_wipes: 0, not_a_double_wipe: 0, unbuildable: 0, action_threw: 0, first_error: null,
    r0: {}, reread_no_build_differs: 0, after_one_build: {}, after_one_build_differs: 0, after_two_builds_differs: 0,
    alive_build_before_turn_differs: 0, counters_on_late_read: {}, examples: [] };
  const loneOf = (act, bench) => {
    const l = (act || []).find(m => m && !m.fainted && m.curHP > 0); if (!l) return null;
    for (const m of [...(act || []), ...(bench || [])]) if (m && m !== l && !m.fainted && m.curHP > 0) { m.curHP = 0; m.fainted = true; }
    l.curHP = 1; return l;
  };
  const struggleTurn = (pos, seed, buildFirst) => {
    const bt = mkBattle(pos, seed); if (!bt) return { status: 'unbuildable' };
    const S = bt.S;
    const a = loneOf(S.actA, S.benchA), b = loneOf(S.actB, S.benchB);
    if (!a || !b) return { status: 'unbuildable' };
    let fa, fb;
    try { fa = new Map([[a, MEDI.playerAction(a, 'struggle', b, S.field)]]); fb = new Map([[b, MEDI.playerAction(b, 'struggle', a, S.field)]]); }
    catch (e) { return { status: 'action_threw', err: String(e && e.message).slice(0, 160) }; }
    if (buildFirst) build(buildFirst.board);        // another battle built while this one is alive
    S.maxTurns = S.turn + 1;
    try { MEDI.battleTurn(S, bt.rng, fa, fb); } catch (e) { return { status: 'action_threw', err: String(e && e.message).slice(0, 160) }; }
    S.maxTurns = FULL_CAP;
    return { status: bothEmpty(S) ? 'double wipe' : 'not a double wipe', S, a, b };
  };
  for (const pos of positions) {
    const other = positions[(pos._i + 1) % positions.length];
    const seed = 29000 + pos._i;
    const x = struggleTurn(pos, seed, null);
    SF.fixtures++;
    if (x.status === 'unbuildable') { SF.unbuildable++; continue; }
    if (x.status === 'action_threw') { SF.action_threw++; if (!SF.first_error) SF.first_error = x.err; continue; }
    if (x.status !== 'double wipe') { SF.not_a_double_wipe++; continue; }
    SF.double_wipes++;
    const r0 = MEDI.battleResult(x.S), r1 = MEDI.battleResult(x.S);
    const c0 = counterSnap();
    build(other.board);
    const r2 = MEDI.battleResult(x.S);
    const dc = counterDelta(c0, counterSnap());
    for (const [k, v] of Object.entries(dc)) if (/doubleWipe/.test(k)) SF.counters_on_late_read[k] = (SF.counters_on_late_read[k] || 0) + v;
    build(other.board);
    const r3 = MEDI.battleResult(x.S);
    SF.r0[r0] = (SF.r0[r0] || 0) + 1;
    SF.after_one_build[r2] = (SF.after_one_build[r2] || 0) + 1;
    if (r1 !== r0) SF.reread_no_build_differs++;
    if (r2 !== r0) SF.after_one_build_differs++;
    if (r3 !== r0) SF.after_two_builds_differs++;
    /* the same fixture with the unrelated battle built BEFORE the turn, while this one is alive: the
     * faints are stamped with the newer epoch, which is still current when read -> must equal r0 */
    const y = struggleTurn(pos, seed, other);
    const ry = (y.status === 'double wipe') ? MEDI.battleResult(y.S) : null;
    if (ry !== r0) SF.alive_build_before_turn_differs++;
    if (SF.examples.length < 6) SF.examples.push({ game: pos.game, turn: pos.turn, lone_A: x.a.name, lone_B: x.b.name,
      read_immediately: r0, reread_no_build: r1, after_one_unrelated_build: r2, after_two: r3, alive_build_before_turn: ry });
  }
  DWP.struggle_fixture = SF;
  TP.struggle_fixture_ms = Date.now() - TP._t; TP._t = Date.now();
  RESULT.double_wipes = DWP;
  console.log('   double wipes: natural ' + JSON.stringify(Object.assign({}, DWP.natural, { examples: undefined })) + '  counters ' + JSON.stringify(DWP.counters));
  console.log('   struggle fixture ' + JSON.stringify(Object.assign({}, SF, { examples: undefined })));
  if (SF.examples.length) console.log('   struggle example ' + JSON.stringify(SF.examples[0]));

  /* THE LEAK-SHAPED COUNTERS OVER THE WHOLE RUN (primer to here) */
  RESULT.leak_counters_whole_run = Object.fromEntries(Object.entries(counterDelta(RUN_SNAP0, counterSnap()))
    .filter(([k]) => /faintQueue|encoreRelocate|residualHandlerList|doubleWipe|chargeWrap|NoDie|Leak|Sticky|Restored/i.test(k)));
  console.log('   leak-shaped counters (whole run) ' + JSON.stringify(RESULT.leak_counters_whole_run));

  const MC2 = sha12(JSON.stringify(toPlain(globalThis.MC)));
  Math.random = _MathRandom;

  const checks = {};
  for (const [k, v] of Object.entries(K)) checks[k] = (v && v.state_norm) ? slim(v) : { n: v.n, pass: v.pass, fail: v.fail, fields: Object.keys(v.fields || {}).length ? v.fields : undefined, first: v.first || undefined };
  RESULT.checks = checks;
  RESULT.event_dice = { note: 'midEventDice, MEDICHAM\'s own chooser on both sides; the differential\'s instrument, not the rollout path', seed: EV_SEED,
    same_seed_self: slim(EV.same_seed_self), same_seed_cross: slim(EV.same_seed_cross), distinct_seed_cross: slim(EV.distinct_seed_cross) };
  RESULT.epoch_inference = EPOCH_CHECK;
  RESULT.restamps_by_arm = RESTAMPS;
  RESULT.late_read = LATE;
  RESULT.result_vs_isolated = FINISH;
  RESULT.double_wipe_rate_full = { battles: DW.full_battles, double_wipes: DW.double_wipes, pct: DW.full_battles ? +(100 * DW.double_wipes / DW.full_battles).toFixed(2) : null };
  RESULT.math_random_calls_in_arms = MR.total_in_arms;
  RESULT.MC_table = { before_primer: MC0, after_primer: MC1, after_everything: MC2, unchanged_after_primer: MC1 === MC2 };
  RESULT.battle_inits_total = INITS;
  if (!RED) RESULT.red_demo = { ran: !NO_RED, all_caught: redCaught, variants: RED_RESULTS };
  RESULT.elapsed_s = Math.round((Date.now() - T0) / 1000);
  delete TP._t; RESULT.phase_ms = TP;
  console.log('   phase ms ' + JSON.stringify(TP));

  /* ---- PRINT ------------------------------------------------------------------------------------- */
  const row = (name, t) => console.log('   ' + name.padEnd(28) + ['state_norm', 'state_raw', 'state_eblind', 'protocol', 'result_at_finish', 'result_end', 'counters']
    .map(k => k.replace('state_', '').replace('result_', 'res_') + ' ' + t[k].pass + '/' + t[k].n).join('  '));
  for (const k of ['interleave_3', 'interleave_full', 'self_interleave_3', 'self_interleave_full', 'alive_vs_isolated_3', 'alive_vs_isolated_full', 'tree_vs_isolated_3', 'tree_vs_isolated_full'])
    row(k, checks[k]);
  console.log('   self twins in A2: eblind ' + K.self_twins_in_A2_eblind.pass + '/' + K.self_twins_in_A2_eblind.n + '  protocol ' + K.self_twins_in_A2_protocol.pass + '/' + K.self_twins_in_A2_protocol.n
    + '  result ' + K.self_twins_in_A2_result.pass + '/' + K.self_twins_in_A2_result.n);
  for (const k of ['interleave_3', 'interleave_full', 'alive_vs_isolated_3', 'alive_vs_isolated_full', 'tree_vs_isolated_full']) {
    const f = checks[k].state_raw.fields; if (f) console.log('   raw-diff fields ' + k + ': ' + JSON.stringify(f));
    const g = checks[k].state_norm.fields; if (g) console.log('   norm-diff fields ' + k + ': ' + JSON.stringify(g));
    if (checks[k].protocol.first) console.log('   first protocol diff ' + k + ': ' + JSON.stringify(checks[k].protocol.first).slice(0, 300));
    if (checks[k].state_eblind.first) console.log('   first eblind diff ' + k + ': ' + JSON.stringify(checks[k].state_eblind.first).slice(0, 300));
    if (checks[k].counters.fields) console.log('   counter keys differing ' + k + ': ' + JSON.stringify(checks[k].counters.fields) + '  first ' + JSON.stringify(checks[k].counters.first).slice(0, 300));
  }
  console.log('   event dice: same-seed self ' + JSON.stringify({ st: EV.same_seed_self.state_eblind.pass + '/' + EV.same_seed_self.state_eblind.n, pr: EV.same_seed_self.protocol.pass + '/' + EV.same_seed_self.protocol.n })
    + '  same-seed cross ' + JSON.stringify({ st: EV.same_seed_cross.state_eblind.pass + '/' + EV.same_seed_cross.state_eblind.n, pr: EV.same_seed_cross.protocol.pass + '/' + EV.same_seed_cross.protocol.n })
    + '  distinct-seed cross ' + JSON.stringify({ st: EV.distinct_seed_cross.state_eblind.pass + '/' + EV.distinct_seed_cross.state_eblind.n, pr: EV.distinct_seed_cross.protocol.pass + '/' + EV.distinct_seed_cross.protocol.n }));
  console.log('   epoch inference ' + JSON.stringify(EPOCH_CHECK) + '   restamps ' + JSON.stringify(RESTAMPS));
  console.log('   double wipes (full) ' + JSON.stringify(RESULT.double_wipe_rate_full) + '   late read ' + JSON.stringify({ flips_A0: LATE.flips_vs_isolated_at_finish, by_arm: LATE.by_arm }));
  console.log('   result vs isolated ' + JSON.stringify(FINISH.by_arm));
  console.log('   late-read counters ' + JSON.stringify(LATE.late_counter_totals));
  console.log('   Math.random in arms ' + MR.total_in_arms + '   MC unchanged after primer ' + (MC1 === MC2) + '   counters ' + JSON.stringify(C));
  console.log('   elapsed ' + RESULT.elapsed_s + ' s');
  if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 2) + '\n'); console.log('   wrote ' + OUT); }
  else console.log('   (smoke: nothing written)');
  if (!RED && !NO_RED && !redCaught) { console.log('   *** A RED VARIANT WAS NOT CAUGHT — the check is blind; exit 3 ***'); process.exit(3); }
  process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
