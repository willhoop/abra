/* bench_clone.js — WHAT IT COSTS TO COPY A MID-GAME POSITION, IN MEDICHAM AND IN SHOWDOWN.
 *
 * SEARCH, 2026-09-11. One question: is rollout search affordable on this laptop once the cost of
 * copying the position before every rollout is paid? That cost had never been measured.
 *
 * THE COPY PATHS MEASURED ARE THE ONES THAT EXIST, NOT ONES INVENTED HERE.
 *
 *   MEDICHAM has NO state-copy function. MILTANK's leaf rebuilds a fresh battle from the board.js
 *   Board for EVERY playout: `rollout_leaf.rolloutWinProb` (release 2b5a6585d8cf, rollout_leaf.js:1241)
 *   calls buildSide x2 -> MEDI.battleInit(seeded) -> checkFallenSeeded -> applyField -> applyFieldClock
 *   -> applySideState -> applyMegaWeather per sample (:1299-1343), under the comment at :1289
 *   "Fresh bodies EVERY rollout". `applyMegaWeather` is not exported, so the sequence cannot be
 *   replicated from outside; this bench therefore times THE REAL FUNCTION. `maxTurns: -1` makes
 *   `battleOver` (medicham2-browser.js:25845, `S.turn >= (S.maxTurns||20)`) true before the first
 *   turn, so `rolloutWinProb({maxTurns:-1})` is exactly "copy, then play nothing". To get hold of
 *   the rebuilt state for the correctness checks, `MEDI.battleInit` is wrapped with a pass-through
 *   that pushes the returned S onto a list when capture is on. The wrapper is installed for the
 *   whole run, so every MEDICHAM arm pays its (one extra call) cost identically.
 *
 *   SHOWDOWN's mechanism is `Battle#toJSON` / `Battle.fromJSON` (sim/battle.ts:318-323), i.e.
 *   `State.serializeBattle` / `State.deserializeBattle` (sim/state.ts:61-155). Its own fuzz runner
 *   uses it IN MEMORY, passing the object straight back in (sim/tools/runner.ts:218 and :233-234).
 *   Read before a line of this was written: serializeBattle stores `state.log = battle.log`
 *   (state.ts:72) and deserializeBattle assigns `battle.log = state.log` (state.ts:153), and
 *   serializePokemon stores `state.set = pokemon.set` (state.ts:214). So the in-memory round trip
 *   SHARES the log array and the set objects with the original. Three variants are measured:
 *     mem     Battle.fromJSON(b.toJSON())                  what runner.ts does
 *     str     Battle.fromJSON(JSON.stringify(b.toJSON()))  string round trip, nothing shared
 *     memfix  mem, then c.log = c.log.slice()              the smallest change that unshares the log
 *
 * CONTENTION IS COMMON-MODE BY CONSTRUCTION. An ENGINE agent is pinning every core. Every op for
 * both engines runs inside ONE rep loop over ONE position, in a rotating order, and every figure of
 * record is a RATIO within an engine (copy / one turn from the same position). Absolute times are
 * printed and labelled CONTENDED; a quiet re-run is owed.
 *
 * CORRECTNESS OF THE COPY IS CHECKED BEFORE ANY TIMING, AND THE CHECK IS SHOWN RED FIRST.
 *   C1/M1  copy, play the copy 3 turns, the ORIGINAL is byte-identical to before
 *   C2/M2  two copies played on the same dice end byte-identical
 *   C3/M3  a copy taken after another copy was played equals a copy taken before
 *   C4/M4  the object graphs of original and copy share no object (dex-class objects excepted)
 * Red first: a scratch copy that aliases ONE sub-object (Showdown: the lead's moveSlots; MEDICHAM:
 * the lead body's PP table pointed at the board's ledger) must FAIL C1/M1 and C3/M3, else the check
 * is blind and the run exits 3.
 *
 * Not a claim about correctness of either ENGINE. MEDICHAM is quarantined for accuracy; this is cost
 * and copy-independence only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');

const ROOT = 'C:/Users/willj/Projects/Pokemon/ABRA';
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const SMOKE = has('--smoke');
const REL_ID = arg('--release', '2b5a6585d8cf');
const TEAM_STORE = arg('--team-store', 'data/team-pool-frozen');
const GAMES = +arg('--games', SMOKE ? 2 : 16);
const STRIDE = +arg('--stride', 800);
const DEPTHS = String(arg('--depths', '2,5,8,12')).split(',').map(Number);
const REPS = +arg('--reps', SMOKE ? 3 : 12);
const FULL_REPS = +arg('--full-reps', SMOKE ? 1 : 4);
const K = +arg('--k', 10);
const MEM_N = +arg('--mem-n', SMOKE ? 5 : 30);
const WARM_MS = +arg('--warm-ms', SMOKE ? 1000 : 20000);
const FULL_CAP = +arg('--full-cap', 20);
const OUT = arg('--out', SMOKE ? null : D('data', 'verification', 'clone-cost-2026-09-11.json'));
const FLAGS = { release: REL_ID, team_store: TEAM_STORE, games: GAMES, stride: STRIDE, depths: DEPTHS,
  reps: REPS, full_reps: FULL_REPS, k: K, mem_n: MEM_N, warm_ms: WARM_MS, full_cap: FULL_CAP,
  smoke: SMOKE, argv: process.argv.slice(2) };

const now = () => process.hrtime.bigint();
const msSince = (t) => Number(now() - t) / 1e6;
const sha12 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const sha12File = (f) => { try { return sha12(fs.readFileSync(f)); } catch (e) { return 'MISSING:' + e.code; } };
const toID = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const noop = () => {};

let gc = null;
try { require('v8').setFlagsFromString('--expose-gc'); gc = require('vm').runInNewContext('gc'); } catch (e) { gc = null; }

/* ---- LOAD: the frozen release, and Showdown through the release's own loader ------------------- */
/* THE CHECKOUT IS PINNED HERE, NOT RESOLVED. The release's showdown_path.js looks for a sibling
 * checkout relative to ITS OWN directory, which for a snapshot is data/releases/<id>/engine — so from
 * a release it finds nothing and falls through to '/tmp/ps' (measured: the first smoke run died
 * there). The brief names the checkout; its commit is checked against the release manifest below. */
const SHOWDOWN_CHECKOUT = arg('--showdown', 'C:/Users/willj/Projects/Pokemon/pokemon-showdown');
process.env.SHOWDOWN_PATH = SHOWDOWN_CHECKOUT;
FLAGS.showdown = SHOWDOWN_CHECKOUT;
const T_LOAD = now();
const REL = require(D('engine', 'engine_release.js')).open(REL_ID);
const MEDI = REL.require('engine/medicham2-browser.js', { need: ['battleInit', 'battleTurn', 'battleOver', 'battleResult'] });
const B = REL.require('engine/board.js', { need: ['Board', 'dmgMon', 'norm', 'baseSpecies'] });
const RL = REL.require('engine/rollout_leaf.js', { need: ['rolloutWinProb', 'runPlayout', 'terrainOnBoard'],
  dataMissingOk: ['data/rollout-switch-census.json'] });
const CS = REL.require('engine/champions_sim.js', { need: ['sim', 'FORMAT', 'actualCommit'] });
const SDX = CS.sim();
const Battle = SDX.Battle;
const dex = SDX.Dex.forFormat(CS.FORMAT);
dex.species.get('garchomp');
const SP = process.env.SHOWDOWN_PATH;
const PRNG = require(path.join(SP, 'dist', 'sim', 'index')).PRNG;
const State = require(path.join(SP, 'dist', 'sim', 'state')).State;
if (require(path.join(SP, 'dist', 'sim', 'battle')).Battle !== Battle) throw new Error('two Showdown module instances in one process');
{
  const want = String(REL.manifest.showdown_commit || ''), got = String(CS.actualCommit() || '');
  if (!want || !got || !(want.startsWith(got) || got.startsWith(want))) {
    throw new Error('Showdown checkout ' + SP + ' is at ' + (got || 'UNKNOWN') + ' but release ' + REL.id + ' was cut against ' + (want || 'UNKNOWN'));
  }
}
const LOAD_MS = msSince(T_LOAD);

/* The switch rate is NOT a release source (the census is absent from every release), so it is read
 * from the live file, passed EXPLICITLY to every playout, and its digest is recorded. */
const CENSUS = (() => {
  const raw = fs.readFileSync(D('data', 'rollout-switch-census.json'), 'utf8');
  const j = JSON.parse(raw);
  const pc = j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  return { switchRate: (typeof pc === 'number' && pc > 0) ? pc / 100 : 0, digest: sha12(raw) };
})();
const SWR = CENSUS.switchRate;
const EXPLORE = 1.0;

/* ---- the capture wrapper (pass-through; see header) --------------------------------------------- */
let CAP = null;
const _battleInit = MEDI.battleInit;
MEDI.battleInit = function () { const S = _battleInit.apply(this, arguments); if (CAP) CAP.push(S); return S; };
if (MEDI.battleInit === _battleInit) throw new Error('could not wrap MEDI.battleInit — module exports are frozen');

/* UNSEEDED DICE ARE COUNTED DURING THE CHECKS. Every die a playout rolls must come from the rng it
 * was handed, or two copies played "on the same dice" are not — and the leaf's Common Random Numbers
 * (miltank.js, "Every candidate is judged on the SAME dice") are not either. Installed for the check
 * phases only and restored before any timing. */
const _MathRandom = Math.random;
let MR_N = 0;
const countRandom = (on) => { Math.random = on ? function () { MR_N++; return _MathRandom(); } : _MathRandom; };

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const q = (xs, p) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const med = (xs) => q(xs, 0.5);
const r3 = (x) => (x == null ? null : +x.toFixed(3));
const r2 = (x) => (x == null ? null : +x.toFixed(2));

const C = { pair_skipped: 0, sd_rejected_choice: 0, sd_fell_back_to_default: 0, sd_threw: 0, sd_stuck: 0,
  md_copy_null: 0, md_threw: 0, sclone_threw: 0, sclone_first_error: null, positions_md_unbuildable: 0 };

/* ---- the pinned pool: a deterministic stride over the frozen bo3 store -------------------------- */
async function loadPairs() {
  const f = D(TEAM_STORE, 'games.bo3.jsonl');
  const rl = readline.createInterface({ input: fs.createReadStream(f, { encoding: 'utf8' }), crlfDelay: Infinity });
  const out = [];
  let i = -1;
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

/* ---- the Showdown policy: bench_two_engines.js's (data/verification/speed-2026-09-08), matched to
 * rollout_leaf.runPlayout(explore=1.0, uniform): with prob switchRate a random legal switch, else a
 * random usable move at a random live foe. PLUS one mega per side at the first chance, because a
 * Champions position without one is not a realistic position. ------------------------------------ */
function sdChoiceFor(battle, sideId, rng) {
  const side = battle[sideId];
  const req = side.activeRequest;
  if (!req || req.wait) return null;
  if (req.forceSwitch) {
    const claimed = new Set(); const toks = [];
    req.forceSwitch.forEach((need) => {
      if (!need) { toks.push('pass'); return; }
      const outs = [];
      side.pokemon.forEach((q2, n) => { if (!q2.isActive && !q2.fainted && !claimed.has(n)) outs.push(n); });
      if (!outs.length) { toks.push('pass'); return; }
      const n = outs[Math.floor(rng() * outs.length) % outs.length];
      claimed.add(n); toks.push('switch ' + (n + 1));
    });
    return toks.join(', ');
  }
  const foes = (side.foe && side.foe.active) || [];
  const liveFoes = []; foes.forEach((q2, n) => { if (q2 && !q2.fainted) liveFoes.push(n); });
  const claimed = new Set(); const toks = [];
  let megaTaken = false;
  (req.active || []).forEach((act, i) => {
    const me = side.active[i];
    if (!me || me.fainted || !act) { toks.push('pass'); return; }
    if (!act.trapped && !act.maybeTrapped && rng() < SWR) {
      const outs = [];
      side.pokemon.forEach((q2, n) => { if (!q2.isActive && !q2.fainted && !claimed.has(n)) outs.push(n); });
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
      if (liveFoes.length) tok += ' ' + (liveFoes[Math.floor(rng() * liveFoes.length) % liveFoes.length] + 1);
    } else if (tt === 'adjacentAlly') {
      const j = side.active.findIndex((q2, n) => q2 && !q2.fainted && n !== i);
      if (j >= 0) tok += ' ' + (-(j + 1));
    } else if (tt === 'adjacentAllyOrSelf') {
      tok += ' ' + (-(i + 1));
    }
    if (act.canMegaEvo && !megaTaken) { tok += ' mega'; megaTaken = true; }
    toks.push(tok);
  });
  return toks.join(', ');
}
function stepOnce(battle, rng) {
  let acted = false;
  for (const sid of ['p1', 'p2']) {
    const c = sdChoiceFor(battle, sid, rng);
    if (c === null) continue;
    let ok = false;
    try { ok = battle.choose(sid, c); } catch (e) { ok = false; }
    if (!ok) {
      C.sd_rejected_choice++;
      try { ok = battle.choose(sid, 'default'); C.sd_fell_back_to_default++; } catch (e) { C.sd_threw++; }
    }
    acted = acted || ok;
  }
  return acted;
}
function playTurns(battle, k, rng) {
  const target = battle.turn + k;
  let g = 0;
  while (!battle.ended && battle.turn < target) {
    if (++g > k * 10 + 10) { C.sd_stuck++; break; }
    if (!stepOnce(battle, rng)) { C.sd_stuck++; break; }
  }
  return battle.turn;
}
const seedArr = (s) => [(s * 2654435761) >>> 16 & 0xffff, (s * 40503) & 0xffff, 0x1234, (s + 7) & 0xffff];

/* ---- the Board at a position: populated from Showdown's live state through the Board's public API.
 * The live bot fills it from protocol lines (magnemite.js, not a release source); the rebuild's COST
 * depends on what the board holds — bodies, sheets, PP, the dead, the field — not on which route
 * filled it. Not populated: volatiles (Taunt/Encore/…), the status clock, the weather's age (a weather
 * is seeded at full length). Declared in the artifact. ------------------------------------------- */
function boardFrom(b, pair) {
  const bd = new B.Board();
  bd.turn = b.turn;
  const picked = (b.ruleTable && b.ruleTable.pickedTeamSize) || 4;
  for (const [sid, sheet] of [['p1', pair.A], ['p2', pair.B]]) {
    const side = b[sid];
    const brought = side.pokemon.slice(0, picked);
    bd.setParty(sid, brought.map(p => p.baseSpecies.name));
    for (const p of brought) {
      const e = sheet.find(x => toID(x.species) === toID(p.set.species)) || {};
      bd.setSheet(sid, p.baseSpecies.name, { nature: e.nature || '', item: e.item || '', ability: e.ability || '',
        moves: e.moves || [] });
      if (toID(p.item) !== toID(e.item)) bd.noteItem(sid, p.baseSpecies.name, p.item || '');
      for (const ms of p.baseMoveSlots) {
        const spent = (ms.maxpp | 0) - (ms.pp | 0);
        if (spent > 0) bd.ppSpend(sid, p.baseSpecies.name, ms.id, spent);
      }
    }
    side.active.forEach((p, i) => {
      if (!p) return;
      const L = 'ab'[i];
      bd.switchIn(sid, L, p.species.name);
      const m = bd.slot(sid, L);
      if (p.fainted || !p.hp) { bd.faint(sid, L); return; }
      m.hp = p.hp / p.maxhp; m.status = p.status || '';
      const bo = {}; for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (p.boosts[k]) bo[k] = p.boosts[k];
      m.boosts = bo; m.turnsActive = p.activeTurns | 0; m.moveActs = p.activeMoveActions | 0;
      m.lastMove = p.lastMove ? p.lastMove.id : '';
    });
    for (const p of brought) {
      if (p.isActive) continue;
      const k = B.baseSpecies(B.norm(p.species.name));
      if (p.fainted || !p.hp) bd.graveyard[sid].add(k);
      else bd.lastSeen[sid][k] = { hp: p.hp / p.maxhp, status: p.status || '' };
    }
    for (const [id, st] of Object.entries(side.sideConditions)) {
      const n = Math.max(1, st.layers | 0);
      for (let j = 0; j < n; j++) bd.startSide(sid, id, st.duration);
    }
  }
  const f = b.field;
  if (f.weather) bd.setWeather(f.weather);
  if (f.terrain) bd.startField(f.terrain, f.terrainState && f.terrainState.duration);
  for (const [id, st] of Object.entries(f.pseudoWeather || {})) bd.startField(id, st.duration);
  return bd;
}

function newGame(pair, gi) {
  const b = new Battle({ formatid: CS.FORMAT, seed: seedArr(gi + 101) });
  b.setPlayer('p1', { name: 'A', team: pair.A.map(toSet) });
  b.setPlayer('p2', { name: 'B', team: pair.B.map(toSet) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234'); }
  return b;
}
function positionsOf(pair, gi) {
  const b = newGame(pair, gi);
  const rng = mulberry(gi * 7919 + 13);
  const want = new Set(DEPTHS), maxD = Math.max(...DEPTHS);
  const out = []; let g = 0;
  while (!b.ended && b.turn <= maxD) {
    if (b.requestState === 'move' && want.has(b.turn) && !out.some(p => p.turn === b.turn)) {
      const str = JSON.stringify(b.toJSON());
      out.push({ gi, game: pair.id, turn: b.turn, str, board: boardFrom(b, pair), log_lines: b.log.length,
                 state_bytes: str.length, pair });
      if (b.turn === maxD) break;
    }
    if (++g > maxD * 12) { C.sd_stuck++; break; }
    if (!stepOnce(b, rng)) { C.sd_stuck++; break; }
  }
  return out;
}

/* ---- canonical state dumps and structural diffs ------------------------------------------------ */
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
    for (const k of Object.keys(v)) { let x; try { x = v[k]; } catch (e) { x = '<threw>'; } if (xf) x = xf(k, x); o[k] = rec(x, p + '.' + k); }
    return o;
  };
  return rec(root, '$');
}
const canon = (v) => JSON.stringify(toPlain(v));
/* THE ONE NORMALISATION, AND WHY IT IS NOT A LAUNDERING. The first smoke run failed M2 on 3 of 6
 * positions, and the ONLY differing fields were `_faintSeq` — an absolute stamp drawn from a counter
 * that lives outside the battle and keeps counting across battles, so the second copy's faints are
 * numbered after the first copy's. `battleResult` (medicham2-browser.js:45612) compares
 * `lastFaintSeq` of side A against side B WITHIN one battle, so only the ORDER is state. canonS
 * therefore replaces each stamp by its rank within the battle — order kept, offset dropped. The RAW
 * comparison is recorded beside it (`M2_raw`) so the normalisation is visible, never silent. */
/* AND A SECOND STAMP OF THE SAME CLASS, found by the first full run (M2 still failed 3 of 48 after the
 * _faintSeq rank, and the only diff was `_rtieGen: 1681 vs 1684`). `_RES_TIE_GEN` is a module global
 * (medicham2-browser.js:9832) bumped once per residual phase (:43399); a body's `_rtieGen` records
 * which phase its cached tie die `_rtie` was rolled in, and is only ever compared for EQUALITY with the
 * current global (:9878). The next residual phase bumps the global before any read, so no stamp left
 * on a body at the end of a turn can match it. Rank-normalised for the same reason and in the same
 * way; the raw comparison stays in the artifact as `M2_raw`. */
const STAMP_KEYS = ['_faintSeq', '_rtieGen'];
const canonS = (S) => {
  const ranks = {};
  const objs = [...walkObjs(S, null).keys()];
  for (const key of STAMP_KEYS) {
    const vals = objs.map(o => o[key]).filter(v => typeof v === 'number');
    ranks[key] = new Map([...new Set(vals)].sort((a, b) => a - b).map((v, i) => [v, i]));
  }
  return JSON.stringify(toPlain(S, (k, v) => (ranks[k] && typeof v === 'number') ? '<' + k + '#' + ranks[k].get(v) + '>' : v));
};
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.slice(0, 90); };
function diffs(x, y, max) {
  const out = []; const seen = new Set(); max = max || 4;
  (function rec(a, b, p) {
    if (out.length >= max || a === b) return;
    const ta = typeof a, tb = typeof b;
    if (ta !== tb || a === null || b === null || ta !== 'object') { out.push(p + ': ' + short(a) + '  vs  ' + short(b)); return; }
    if (seen.has(a)) return; seen.add(a);
    if (Array.isArray(a) !== Array.isArray(b)) { out.push(p + ': array vs object'); return; }
    if (Array.isArray(a) && a.length !== b.length) out.push(p + ': length ' + a.length + ' vs ' + b.length);
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) rec(a[k], b[k], p + (Array.isArray(a) ? '[' + k + ']' : '.' + k));
  })(x, y, '$');
  return out;
}
const firstDiff = (sa, sb) => { try { return diffs(JSON.parse(sa), JSON.parse(sb)); } catch (e) { return ['(unparseable)']; } };

const DEXLIKE = new Set(['ModdedDex', 'Species', 'Move', 'DataMove', 'Ability', 'Item', 'Condition', 'Format',
  'RuleTable', 'Nature', 'TypeInfo', 'Learnset', 'DexSpecies', 'DexMoves', 'DexAbilities', 'DexItems',
  'DexConditions', 'DexFormats', 'DexTypes', 'DexNatures', 'DexLearnsets']);
const sdSkip = (v) => !!(v && v.constructor && DEXLIKE.has(v.constructor.name));
function walkObjs(root, skip) {
  const seen = new Map(); const qu = [[root, '$']]; let h = 0;
  while (h < qu.length) {
    const [v, p] = qu[h++];
    if (v === null || typeof v !== 'object' || seen.has(v) || (skip && skip(v))) continue;
    seen.set(v, p);
    if (v instanceof Map) { let i = 0; for (const [k, x] of v) { qu.push([k, p + '<k' + i + '>']); qu.push([x, p + '<' + String(k).slice(0, 24) + '>']); i++; } }
    else if (v instanceof Set) { let i = 0; for (const x of v) qu.push([x, p + '{' + (i++) + '}']); }
    else for (const k of Object.keys(v)) { let x; try { x = v[k]; } catch (e) { continue; } qu.push([x, p + (Array.isArray(v) ? '[' + k + ']' : '.' + k)]); }
  }
  return seen;
}
const pathClass = (p) => p.replace(/\[\d+\]/g, '[]').replace(/<k?\d+>/g, '<>');
function sharedBetween(a, b, skip) {
  const A = walkObjs(a, skip), Bm = walkObjs(b, skip);
  const byClass = {}; let n = 0, frozen = 0;
  for (const [o, p] of A) {
    if (!Bm.has(o)) continue;
    n++; if (Object.isFrozen(o)) frozen++;
    const c = pathClass(p);
    byClass[c] = (byClass[c] || 0) + 1;
  }
  const classes = Object.entries(byClass).sort((x, y) => y[1] - x[1]);
  return { shared_objects: n, frozen, walked_a: A.size, walked_b: Bm.size,
           top_classes: classes.slice(0, 12).map(([c, k]) => c + ' x' + k), classes_total: classes.length };
}

/* ---- the copy functions ------------------------------------------------------------------------ */
const fieldOf = (bd) => ({ weather: (typeof bd.weatherWord === 'function' ? bd.weatherWord() : bd.weather) || '',
                           terrain: RL.terrainOnBoard(bd) });
const RWP = (bd, n, maxTurns, seed) => RL.rolloutWinProb(bd, 'p1', { n, dex, seed, explore: EXPLORE,
  foePolicy: 'uniform', field: fieldOf(bd), maxTurns, switchRate: SWR });
function mdCopy(bd, seed) {
  CAP = [];
  let r = null;
  try { r = RWP(bd, 1, -1, seed); } catch (e) { C.md_threw++; }
  const S = CAP[0] || null; CAP = null;
  if (!r || !S) { C.md_copy_null++; return null; }
  return S;
}
function mdPlay(S, k, seed, rngOverride) {
  S.maxTurns = k;
  return RL.runPlayout(S, rngOverride || mulberry(seed), EXPLORE, 'uniform', null, SWR);
}
const SDV = {
  mem:    (o) => { const c = Battle.fromJSON(o.toJSON()); c.restart(noop); return c; },
  str:    (o) => { const c = Battle.fromJSON(JSON.stringify(o.toJSON())); c.restart(noop); return c; },
  memfix: (o) => { const c = Battle.fromJSON(o.toJSON()); c.log = c.log.slice(); c.restart(noop); return c; },
};
/* SCRATCH, DELIBERATELY WRONG: the string copy, then ONE sub-object pointed back at the original. */
const SD_RED = (o) => {
  const c = SDV.str(o);
  const i = o.p1.active.findIndex(p => p && !p.fainted);
  if (i >= 0) c.p1.active[i].moveSlots = o.p1.active[i].moveSlots;
  return c;
};
const MD_RED = (bd) => {
  const S = mdCopy(bd, 7);
  if (!S) return null;
  const L = ['a', 'b'].find(x => { const m = bd.slot('p1', x); return m && !m.fainted; });
  const body = S.actA.find(x => x && !x.fainted);
  if (L && body && bd.slot('p1', L).pp) body._pp = bd.slot('p1', L).pp;
  return S;
};
const sdOrig = (pos) => { const o = Battle.fromJSON(pos.str); o.restart(noop); return o; };
const sdDump = (b) => JSON.stringify(State.normalize(b.toJSON()));

/* ---- the checks -------------------------------------------------------------------------------- */
function sdChecks(pos, V, s, label, redPrng) {
  const r = {};
  { const o = sdOrig(pos); const before = sdDump(o); const c = V(o); c.prng = new PRNG(seedArr(s));
    playTurns(c, 3, mulberry(s)); const after = sdDump(o);
    r.C1 = before === after; if (!r.C1) r.C1_diff = firstDiff(before, after); }
  { const o = sdOrig(pos); const c1 = V(o), c2 = V(o);
    c1.prng = new PRNG(seedArr(s)); c2.prng = redPrng ? c1.prng : new PRNG(seedArr(s));
    playTurns(c1, 3, mulberry(s)); playTurns(c2, 3, mulberry(s));
    const d1 = sdDump(c1), d2 = sdDump(c2); r.C2 = d1 === d2; if (!r.C2) r.C2_diff = firstDiff(d1, d2); }
  { const o = sdOrig(pos); const d0 = sdDump(V(o)); const c = V(o); c.prng = new PRNG(seedArr(s));
    playTurns(c, 3, mulberry(s)); const d1 = sdDump(V(o));
    r.C3 = d0 === d1; if (!r.C3) r.C3_diff = firstDiff(d0, d1); }
  { const o = sdOrig(pos); r.C4 = sharedBetween(o, V(o), sdSkip); }
  return r;
}
function mdChecks(pos, V, s, redRng) {
  const bd = pos.board; const r = {};
  { const before = canon(bd); const S = V(bd); if (!S) return null; mdPlay(S, 3, s); const after = canon(bd);
    r.M1 = before === after; if (!r.M1) r.M1_diff = firstDiff(before, after); }
  { const S1 = V(bd), S2 = V(bd); const rr = mulberry(s); const mr0 = MR_N;
    mdPlay(S1, 3, s, redRng ? rr : null); mdPlay(S2, 3, s, redRng ? rr : null);
    r.M2_math_random_calls = MR_N - mr0;
    const d1 = canon(S1), d2 = canon(S2); r.M2_raw = d1 === d2; if (!r.M2_raw) r.M2_raw_diff = firstDiff(d1, d2);
    const n1 = canonS(S1), n2 = canonS(S2); r.M2 = n1 === n2; if (!r.M2) r.M2_diff = firstDiff(n1, n2); }
  { const d0 = canon(V(bd)); const S = V(bd); mdPlay(S, 3, s); const d1 = canon(V(bd));
    r.M3 = d0 === d1; if (!r.M3) r.M3_diff = firstDiff(d0, d1); }
  { const S1 = V(bd), S2 = V(bd);
    r.M4 = { copy_vs_copy: sharedBetween(S1, S2, null), copy_vs_board: sharedBetween(S1, bd, null),
             copy_vs_MC: sharedBetween(S1, globalThis.MC, null) }; }
  return r;
}
function scloneChecks(pos, s) {
  const S0 = mdCopy(pos.board, 7); if (!S0) return null;
  let c;
  try { c = structuredClone(S0); } catch (e) { C.sclone_threw++; if (!C.sclone_first_error) C.sclone_first_error = String(e.message).slice(0, 160); return { error: String(e.message).slice(0, 160) }; }
  const r = {};
  const before = canon(S0); mdPlay(c, 3, s); r.M1 = before === canon(S0);
  const c1 = structuredClone(S0), c2 = structuredClone(S0); mdPlay(c1, 3, s); mdPlay(c2, 3, s);
  r.M2_raw = canon(c1) === canon(c2);
  const d1 = canonS(c1), d2 = canonS(c2); r.M2 = d1 === d2; if (!r.M2) r.M2_diff = firstDiff(d1, d2);
  const c3 = structuredClone(S0), S3 = mdCopy(pos.board, 7); mdPlay(c3, 3, s); mdPlay(S3, 3, s);
  r.clone_plays_like_rebuild_raw = canon(c3) === canon(S3);
  const e1 = canonS(c3), e2 = canonS(S3); r.clone_plays_like_rebuild = e1 === e2; if (!r.clone_plays_like_rebuild) r.clone_vs_rebuild_diff = firstDiff(e1, e2);
  r.M4 = sharedBetween(S0, structuredClone(S0), null);
  return r;
}
const tally = (rows, keys) => { const t = {}; for (const k of keys) { const v = rows.filter(r => r && typeof r[k] === 'boolean');
  t[k] = { pass: v.filter(r => r[k]).length, fail: v.filter(r => !r[k]).length }; } return t; };
const firstFail = (rows, k) => { const r = rows.find(x => x && x[k] === false); return r ? { at: r._at, diff: r[k + '_diff'] || null } : null; };

/* ================================== MAIN ======================================================== */
(async () => {
  const T0 = Date.now();
  const RESULT = { generated: new Date().toISOString(), by: 'data/verification/clone-cost-2026-09-11/bench_clone.js (SEARCH)',
    what: 'Cost of copying a mid-game position before each rollout, MEDICHAM vs Showdown, as ratios to one turn from the same position; plus whether each copy is independent of the original.',
    not_an_accuracy_claim: 'MEDICHAM is quarantined for correctness. Cost and copy-independence only.',
    contended: 'An ENGINE agent was pinning every core. Every absolute time here is CONTENDED and is owed a quiet re-run; the ratios are within-engine and within-rep, so contention is common-mode.',
    ...REL.stamp(), showdown_commit_checkout: CS.actualCommit(), format: CS.FORMAT,
    team_store_pinned_to: TEAM_STORE, team_store_bo3_sha12: sha12File(D(TEAM_STORE, 'games.bo3.jsonl')),
    census: CENSUS, explore: EXPLORE, foe_policy: 'uniform', flags: FLAGS,
    node: process.version, cores: os.cpus().length, freemem_gb_at_start: +(os.freemem() / 1e9).toFixed(2),
    gc_available: !!gc, load_ms_excluded: Math.round(LOAD_MS),
    copy_paths: {
      medicham: 'rollout_leaf.rolloutWinProb (release rollout_leaf.js:1241; per-sample rebuild :1299-1343) with maxTurns:-1 — the real function; no state-copy exists in medicham2-browser.js',
      showdown_mem: 'Battle.fromJSON(b.toJSON()) — sim/battle.ts:318-323, used in memory by sim/tools/runner.ts:218,233',
      showdown_str: 'Battle.fromJSON(JSON.stringify(b.toJSON()))',
      showdown_memfix: 'mem + c.log = c.log.slice() (not in Showdown; the smallest unsharing change)',
      structuredClone_md: 'structuredClone of a rebuilt MEDICHAM state — NOT in the engine; informational only',
    },
    board_population: 'boards are filled from Showdown state via the Board public API; volatiles, status clock and weather age are not populated',
    counters: C };

  console.log('');
  console.log('CLONE COST — MEDICHAM vs Showdown, one process, interleaved. CONTENDED; ratios are the figures of record.');
  console.log('  release ' + REL.id + '   showdown ' + (CS.actualCommit() || '?') + '   format ' + CS.FORMAT);
  console.log('  node ' + process.version + '   ' + os.cpus().length + ' cores   ' + (os.freemem() / 1e9).toFixed(1) + ' GB free   gc ' + (gc ? 'yes' : 'NO'));
  console.log('  switch rate ' + SWR + ' (census ' + CENSUS.digest + ')   explore ' + EXPLORE);

  const pairs = await loadPairs();
  const positions = [];
  pairs.forEach((p, gi) => { for (const pos of positionsOf(p, gi)) positions.push(pos); });
  positions.forEach((p, i) => { p._i = i; });
  const byDepth = {}; for (const d of DEPTHS) byDepth[d] = positions.filter(p => p.turn === d);
  RESULT.pairs = pairs.map(p => ({ id: p.id, line: p.line }));
  RESULT.positions = positions.map(p => ({ game: p.game, turn: p.turn, log_lines: p.log_lines, state_bytes: p.state_bytes }));
  console.log('  pool ' + TEAM_STORE + ' stride ' + STRIDE + ' -> ' + pairs.length + ' games (' + C.pair_skipped + ' lines skipped); positions by depth '
    + DEPTHS.map(d => d + ':' + byDepth[d].length).join('  '));
  console.log('');

  /* THE SHARED TABLE IS WATCHED AT EVERY PHASE BOUNDARY. `globalThis.MC` is the one object every
   * rollout of every search shares; a write into it is state leaking between rollouts whatever the
   * copy looks like. Snapshotted as plain JSON so a change can be LOCATED, not merely detected. */
  const MC_SNAP0 = canon(globalThis.MC);
  const MC0 = sha12(MC_SNAP0);
  const MC_PHASES = [];
  let MC_PREV_S = MC_SNAP0;
  const mcCheckpoint = (phase) => {
    const s = canon(globalThis.MC);
    const e = { phase, digest: sha12(s), changed_since_start: s !== MC_SNAP0, changed_since_previous: s !== MC_PREV_S };
    if (e.changed_since_start) e.first_diffs_vs_start = firstDiff(MC_SNAP0, s);
    if (e.changed_since_previous) e.first_diffs_vs_previous = firstDiff(MC_PREV_S, s);
    MC_PREV_S = s;
    MC_PHASES.push(e);
    return e;
  };
  /* THE PRIMER separates a ONE-TIME lazy initialisation from a write made by playing. One copy and
   * three turns; every later checkpoint is then read against the one before it. */
  if (positions.length) { const S = mdCopy(positions[0].board, 1); if (S) mdPlay(S, 3, 1); }
  mcCheckpoint('after_primer_one_copy_and_3_turns');

  /* ---------- 1. RED FIRST: the scratch aliased copies must be caught ------------------------------ */
  countRandom(true);
  console.log('  1. RED DEMO — scratch copies that alias ONE sub-object. These MUST fail.');
  const redSD = [], redMD = [], redSDprng = [], redMDrng = [];
  for (const pos of positions) {
    const s = 1000 + pos._i;
    const at = 'g' + pos.gi + ' t' + pos.turn;
    const a = sdChecks(pos, SD_RED, s, 'red'); a._at = at; redSD.push(a);
    const b2 = sdChecks(pos, SDV.str, s, 'redprng', true); b2._at = at; redSDprng.push(b2);
    const m = mdChecks(pos, MD_RED, s); if (m) { m._at = at; redMD.push(m); }
    const m2 = mdChecks(pos, (bd) => mdCopy(bd, 7), s, true); if (m2) { m2._at = at; redMDrng.push(m2); }
  }
  const RED = {
    showdown_alias_moveslots: { tally: tally(redSD, ['C1', 'C3']), first_C1_fail: firstFail(redSD, 'C1') },
    showdown_alias_prng_between_copies: { tally: tally(redSDprng, ['C2']), first_C2_fail: firstFail(redSDprng, 'C2') },
    medicham_alias_pp_ledger: { tally: tally(redMD, ['M1', 'M3']), first_M1_fail: firstFail(redMD, 'M1') },
    medicham_shared_rng_stream: { tally: tally(redMDrng, ['M2']), first_M2_fail: firstFail(redMDrng, 'M2'),
      note: 'aliases the DICE, not the copy — shows the M2 comparison can see a divergence at all' },
  };
  const redCaught = RED.showdown_alias_moveslots.tally.C1.fail > 0 && RED.showdown_alias_moveslots.tally.C3.fail > 0
    && RED.showdown_alias_prng_between_copies.tally.C2.fail > 0
    && RED.medicham_alias_pp_ledger.tally.M1.fail > 0 && RED.medicham_alias_pp_ledger.tally.M3.fail > 0
    && RED.medicham_shared_rng_stream.tally.M2.fail > 0;
  RED.all_red_variants_caught = redCaught;
  RESULT.red_demo = RED;
  mcCheckpoint('after_red_demo');
  for (const [k, v] of Object.entries(RED)) if (v && v.tally) console.log('     ' + k.padEnd(38) + JSON.stringify(v.tally));
  console.log('     ' + (redCaught ? 'RED as required — every check can see an alias.' : '*** A CHECK IS BLIND — it passed a deliberately aliased copy ***'));
  console.log('');

  /* ---------- 2. THE REAL COPIES ------------------------------------------------------------------ */
  console.log('  2. REAL COPY PATHS — independence');
  const real = { sd: { mem: [], str: [], memfix: [] }, md: [], sclone: [] };
  for (const pos of positions) {
    const s = 2000 + pos._i; const at = 'g' + pos.gi + ' t' + pos.turn;
    for (const v of ['mem', 'str', 'memfix']) { const r = sdChecks(pos, SDV[v], s); r._at = at; real.sd[v].push(r); }
    const m = mdChecks(pos, (bd) => mdCopy(bd, 7), s); if (m) { m._at = at; real.md.push(m); } else C.positions_md_unbuildable++;
    const sc = scloneChecks(pos, s); if (sc) { sc._at = at; real.sclone.push(sc); }
  }
  const sumShared = (rows, get) => { const xs = rows.map(get).filter(Boolean);
    return { positions: xs.length, with_any_shared: xs.filter(x => x.shared_objects > 0).length,
             max_shared: Math.max(0, ...xs.map(x => x.shared_objects)), example: (xs.find(x => x.shared_objects > 0) || xs[0] || {}).top_classes || [] }; };
  const REAL = { showdown: {}, medicham: {}, medicham_structuredClone: {} };
  for (const v of ['mem', 'str', 'memfix']) {
    REAL.showdown[v] = { tally: tally(real.sd[v], ['C1', 'C2', 'C3']),
      first_C1_fail: firstFail(real.sd[v], 'C1'), first_C2_fail: firstFail(real.sd[v], 'C2'), first_C3_fail: firstFail(real.sd[v], 'C3'),
      C4_shared_with_original_excluding_dex_objects: sumShared(real.sd[v], r => r.C4) };
  }
  REAL.medicham = { tally: tally(real.md, ['M1', 'M2', 'M2_raw', 'M3']), first_M2_raw_fail: firstFail(real.md, 'M2_raw'),
    first_M1_fail: firstFail(real.md, 'M1'), first_M2_fail: firstFail(real.md, 'M2'), first_M3_fail: firstFail(real.md, 'M3'),
    M4_copy_vs_copy: sumShared(real.md, r => r.M4.copy_vs_copy), M4_copy_vs_board: sumShared(real.md, r => r.M4.copy_vs_board),
    M4_copy_vs_MC: sumShared(real.md, r => r.M4.copy_vs_MC),
    M2_math_random_calls: { total: real.md.reduce((s, r) => s + (r.M2_math_random_calls || 0), 0),
      in_failing_positions: real.md.filter(r => r.M2 === false).reduce((s, r) => s + (r.M2_math_random_calls || 0), 0),
      in_passing_positions: real.md.filter(r => r.M2 === true).reduce((s, r) => s + (r.M2_math_random_calls || 0), 0) },
    M2_fails_at: real.md.filter(r => r.M2 === false).map(r => r._at),
    M2_all_fail_diffs: real.md.filter(r => r.M2 === false).map(r => ({ at: r._at, diff: r.M2_diff })),
    M2_raw_fail_diff_fields: [...new Set(real.md.filter(r => r.M2_raw === false)
      .flatMap(r => (r.M2_raw_diff || []).map(d => (String(d).split(':')[0].match(/\.([A-Za-z_]\w*)$/) || [])[1] || d)))] };
  const scOk = real.sclone.filter(r => !r.error);
  REAL.medicham_structuredClone = { threw: real.sclone.length - scOk.length, first_error: C.sclone_first_error,
    tally: tally(scOk, ['M1', 'M2', 'M2_raw', 'clone_plays_like_rebuild', 'clone_plays_like_rebuild_raw']), first_clone_vs_rebuild_diff: firstFail(scOk, 'clone_plays_like_rebuild'),
    M4: sumShared(scOk, r => r.M4),
    clone_vs_rebuild_all_fail_diffs: scOk.filter(r => r.clone_plays_like_rebuild === false).map(r => ({ at: r._at, diff: r.clone_vs_rebuild_diff })),
    M2_all_fail_diffs: scOk.filter(r => r.M2 === false).map(r => ({ at: r._at, diff: r.M2_diff })) };
  RESULT.real_checks = REAL;
  mcCheckpoint('after_real_checks');
  for (const v of ['mem', 'str', 'memfix']) console.log('     showdown ' + v.padEnd(7) + JSON.stringify(REAL.showdown[v].tally) + '  shared-with-original ' + JSON.stringify(REAL.showdown[v].C4_shared_with_original_excluding_dex_objects.example.slice(0, 3)));
  console.log('     medicham rebuild ' + JSON.stringify(REAL.medicham.tally) + '  copy~copy shared ' + REAL.medicham.M4_copy_vs_copy.max_shared
    + ', copy~board ' + REAL.medicham.M4_copy_vs_board.max_shared + ', copy~MC ' + REAL.medicham.M4_copy_vs_MC.max_shared);
  console.log('     medicham M2 Math.random calls ' + JSON.stringify(REAL.medicham.M2_math_random_calls)
    + '  first M2 fail ' + JSON.stringify(REAL.medicham.first_M2_fail));
  console.log('     medicham structuredClone (not in engine) ' + JSON.stringify(REAL.medicham_structuredClone.tally) + (REAL.medicham_structuredClone.threw ? '  THREW: ' + C.sclone_first_error : ''));
  console.log('');

  countRandom(false);
  RESULT.math_random_calls_during_checks = MR_N;
  /* ---------- 3. WARM-UP (discarded) ------------------------------------------------------------- */
  { const t = Date.now(); let i = 0;
    while (Date.now() - t < WARM_MS && positions.length) {
      const pos = positions[i++ % positions.length];
      try { RWP(pos.board, 4, 3, i); } catch (e) { C.md_threw++; }
      const o = sdOrig(pos); const c = SDV.str(o); playTurns(c, 3, mulberry(i));
    }
    console.log('  3. warm-up (discarded): ' + (Date.now() - t) + ' ms, ' + i + ' rounds');
    console.log('');
  }

  /* ---------- 4. TIMING, INTERLEAVED ------------------------------------------------------------- */
  console.log('  4. TIMING — ' + REPS + ' reps/position (' + FULL_REPS + ' with full playouts), K=' + K + ' rollouts per rolloutWinProb call');
  const T = []; // per position: { op: [ms...] }
  for (const pos of positions) {
    const bd = pos.board;
    const O = sdOrig(pos);
    let S0 = mdCopy(bd, 7);
    const t = { _pos: pos, sd_copy_mem: [], sd_copy_str: [], sd_copy_memfix: [], sd_turn1: [], sd_roll3: [], sd_full: [], sd_full_turns: [],
                md_copy: [], md_turn1: [], md_roll3: [], md_full: [], md_full_turns: [], md_sclone: [] };
    const ops = [
      ['md_copy', (s) => { const a = now(); RWP(bd, K, -1, s); return Number(now() - a) / 1e6 / K; }],
      ['sd_copy_str', () => { const a = now(); SDV.str(O); return Number(now() - a) / 1e6; }],
      ['md_turn1', (s) => { const S = mdCopy(bd, s); if (!S) return null; S.maxTurns = 1; const rr = mulberry(s ^ 0x5bd1e995);
          const a = now(); RL.runPlayout(S, rr, EXPLORE, 'uniform', null, SWR); return Number(now() - a) / 1e6; }],
      ['sd_turn1', (s) => { const c = SDV.str(O); c.prng = new PRNG(seedArr(s)); const rr = mulberry(s);
          const a = now(); playTurns(c, 1, rr); return Number(now() - a) / 1e6; }],
      ['sd_copy_mem', () => { const a = now(); SDV.mem(O); return Number(now() - a) / 1e6; }],
      ['md_roll3', (s) => { const a = now(); RWP(bd, K, 3, s); return Number(now() - a) / 1e6 / K; }],
      ['sd_roll3', (s) => { const a = now(); const c = SDV.str(O); c.prng = new PRNG(seedArr(s)); playTurns(c, 3, mulberry(s)); return Number(now() - a) / 1e6; }],
      ['sd_copy_memfix', () => { const a = now(); SDV.memfix(O); return Number(now() - a) / 1e6; }],
      ['md_sclone', () => { if (!S0 || C.sclone_threw) return null; const a = now(); structuredClone(S0); return Number(now() - a) / 1e6; }],
    ];
    const fullOps = [
      ['md_full', (s) => { const a = now(); const r = RWP(bd, K, FULL_CAP, s); const dt = Number(now() - a) / 1e6 / K;
          if (r) t.md_full_turns.push(r.meanTurns); return dt; }],
      ['sd_full', (s) => { const a = now(); const c = SDV.str(O); const t0 = c.turn; c.prng = new PRNG(seedArr(s)); playTurns(c, FULL_CAP, mulberry(s));
          const dt = Number(now() - a) / 1e6; t.sd_full_turns.push(c.turn - t0); return dt; }],
    ];
    for (let rep = 0; rep < REPS; rep++) {
      const list = rep < FULL_REPS ? ops.concat(fullOps) : ops;
      const off = (rep + pos._i) % list.length;
      for (let j = 0; j < list.length; j++) {
        const [name, fn] = list[(j + off) % list.length];
        let v = null;
        try { v = fn(3000 + pos._i * 131 + rep); } catch (e) { if (name.startsWith('md')) C.md_threw++; else C.sd_threw++; }
        if (typeof v === 'number' && Number.isFinite(v)) t[name].push(v);
      }
    }
    T.push(t);
  }

  mcCheckpoint('after_timing');

  /* ---------- 5. SUMMARY -------------------------------------------------------------------------- */
  const OPS = ['md_copy', 'md_turn1', 'md_roll3', 'md_full', 'md_sclone', 'sd_copy_mem', 'sd_copy_str', 'sd_copy_memfix', 'sd_turn1', 'sd_roll3', 'sd_full'];
  const RATIOS = [
    ['medicham_copy_over_turn', 'md_copy', 'md_turn1'], ['medicham_roll3_over_turn', 'md_roll3', 'md_turn1'],
    ['medicham_full_over_turn', 'md_full', 'md_turn1'], ['medicham_structuredClone_over_turn', 'md_sclone', 'md_turn1'],
    ['showdown_copy_str_over_turn', 'sd_copy_str', 'sd_turn1'], ['showdown_copy_mem_over_turn', 'sd_copy_mem', 'sd_turn1'],
    ['showdown_copy_memfix_over_turn', 'sd_copy_memfix', 'sd_turn1'], ['showdown_roll3_over_turn', 'sd_roll3', 'sd_turn1'],
    ['showdown_full_over_turn', 'sd_full', 'sd_turn1'],
    ['showdown_turn_over_medicham_turn', 'sd_turn1', 'md_turn1'], ['showdown_copy_str_over_medicham_copy', 'sd_copy_str', 'md_copy'],
  ];
  const summarise = (rows) => {
    const abs = {};
    for (const op of OPS) { const all = [].concat(...rows.map(t => t[op])); abs[op] = { n: all.length, median_ms: r3(med(all)), p90_ms: r3(q(all, 0.9)) }; }
    const ratios = {};
    for (const [name, a, b] of RATIOS) {
      const per = rows.map(t => (t[a].length && t[b].length && med(t[b]) > 0) ? med(t[a]) / med(t[b]) : null).filter(x => x != null);
      ratios[name] = { positions: per.length, median: r2(med(per)), p90: r2(q(per, 0.9)), min: r2(q(per, 0)), max: r2(q(per, 1)) };
    }
    const nf = {};
    for (const op of ['md_copy', 'md_turn1', 'sd_copy_str', 'sd_turn1']) {
      const h1 = [], h2 = [];
      for (const t of rows) { const xs = t[op]; const h = xs.length >> 1; h1.push(...xs.slice(0, h)); h2.push(...xs.slice(h)); }
      const m1 = med(h1), m2 = med(h2);
      nf[op] = (m1 && m2) ? r2(100 * Math.abs(m1 - m2) / m1) : null;
    }
    const fullTurns = { md: r2(med([].concat(...rows.map(t => t.md_full_turns)))), sd: r2(med([].concat(...rows.map(t => t.sd_full_turns)))) };
    return { positions: rows.length, abs_contended: abs, ratios, noise_floor_half_split_pct: nf, median_turns_in_full_playout: fullTurns,
             mean_log_lines: r2(rows.reduce((s, t) => s + t._pos.log_lines, 0) / Math.max(1, rows.length)),
             mean_state_bytes: Math.round(rows.reduce((s, t) => s + t._pos.state_bytes, 0) / Math.max(1, rows.length)) };
  };
  RESULT.by_depth = {};
  for (const d of DEPTHS) RESULT.by_depth[d] = summarise(T.filter(t => t._pos.turn === d));
  RESULT.all_depths = summarise(T);

  /* ---------- 6. MEMORY PER COPY (first position at each depth) ----------------------------------- */
  RESULT.memory = {};
  if (gc) {
    const heapOnce = (make) => { { const warm = []; for (let i = 0; i < MEM_N; i++) warm.push(make(i)); warm.length = 0; }
      gc(); gc(); const h0 = process.memoryUsage().heapUsed; const keep = [];
      for (let i = 0; i < MEM_N; i++) keep.push(make(i)); gc(); gc(); const h1 = process.memoryUsage().heapUsed;
      const per = (h1 - h0) / MEM_N; keep.length = 0; return Math.round(per); };
    /* MEDIAN OF THREE. A single reading came back at 984 bytes per Showdown copy (first full run), which
     * is a GC artefact, not a copy. Three trials, median reported; a heap delta is still an estimate. */
    const heapPer = (make) => Math.round(med([heapOnce(make), heapOnce(make), heapOnce(make)]));
    RESULT.memory_method = 'heapUsed delta holding ' + MEM_N + ' copies, after a discarded warm pass and gc x2, median of 3 trials; an estimate';
    for (const d of DEPTHS) {
      const pos = byDepth[d][0]; if (!pos) continue;
      const O = sdOrig(pos);
      RESULT.memory[d] = { game: pos.game,
        showdown_str_bytes_heap: heapPer(() => SDV.str(O)),
        showdown_mem_bytes_heap: heapPer(() => SDV.mem(O)),
        showdown_serialized_json_bytes: JSON.stringify(O.toJSON()).length,
        medicham_rebuild_bytes_heap: heapPer((i) => mdCopy(pos.board, i + 1)) };
    }
  }

  const MCend = mcCheckpoint('after_memory');
  RESULT.MC_table_digest = { before_checks: MC0, after_everything: MCend.digest, unchanged: !MCend.changed_since_start,
                             phases: MC_PHASES };
  for (const e of MC_PHASES) console.log('   MC ' + e.phase.padEnd(36) + e.digest + '  since-start ' + e.changed_since_start
    + '  since-previous ' + e.changed_since_previous + (e.changed_since_previous ? '  ' + JSON.stringify(e.first_diffs_vs_previous) : ''));
  RESULT.rollout_leaf_guards = { FALLEN_GUARD: RL.FALLEN_GUARD || null };
  RESULT.counters = C;
  RESULT.elapsed_s = Math.round((Date.now() - T0) / 1000);

  /* ---------- PRINT ------------------------------------------------------------------------------- */
  const line = (label, o) => console.log('     ' + label.padEnd(36) + 'median ' + String(o.median).padStart(6) + 'x   p90 ' + String(o.p90).padStart(6) + 'x   (' + o.positions + ' positions)');
  for (const d of [...DEPTHS, 'all']) {
    const R = d === 'all' ? RESULT.all_depths : RESULT.by_depth[d];
    if (!R || !R.positions) continue;
    console.log('   DEPTH ' + d + '  (' + R.positions + ' positions, mean log ' + R.mean_log_lines + ' lines, state ' + R.mean_state_bytes + ' B)');
    for (const [name] of RATIOS) line(name, R.ratios[name]);
    const a = R.abs_contended;
    console.log('     CONTENDED ms (median/p90): md copy ' + a.md_copy.median_ms + '/' + a.md_copy.p90_ms + '  md turn ' + a.md_turn1.median_ms + '/' + a.md_turn1.p90_ms
      + '  md roll3 ' + a.md_roll3.median_ms + '  md full ' + a.md_full.median_ms + '  | sd copy str ' + a.sd_copy_str.median_ms + '/' + a.sd_copy_str.p90_ms
      + '  sd turn ' + a.sd_turn1.median_ms + '/' + a.sd_turn1.p90_ms + '  sd roll3 ' + a.sd_roll3.median_ms + '  sd full ' + a.sd_full.median_ms);
    console.log('     noise floor (half-split %) ' + JSON.stringify(R.noise_floor_half_split_pct) + '   full playout turns ' + JSON.stringify(R.median_turns_in_full_playout));
  }
  console.log('   memory per copy ' + JSON.stringify(RESULT.memory));
  console.log('   MC table digest unchanged: ' + RESULT.MC_table_digest.unchanged + '   counters ' + JSON.stringify(C));
  console.log('   elapsed ' + RESULT.elapsed_s + ' s');
  if (OUT) { fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 2) + '\n'); console.log('   wrote ' + OUT); }
  else console.log('   (smoke: nothing written)');
  process.exit(redCaught ? 0 : 3);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
