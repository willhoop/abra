/* solver/tests/test-porygon2-v2-features.js — PORYGON2 v2's encoder fills nothing and blanks history on both producers.
 *
 *   node solver/tests/test-porygon2-v2-features.js [--games N] [--no-red]        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER
 *
 * Real replays (the first write-once raw shards of both Reg M-C streams, as test-porygon2-v2-extract.js), through
 * reveal.js -> features.js on the frozen release eaa5becc54eb:
 *   NOFILL    every member whose ability is UNK is given `noability` in the body its facts are computed on, and its
 *             ability id is <UNK>; no body carries a move the position does not know.
 *   UNKCOUNT  the unk_moves / unk_item / unk_ability numbers equal the UNK ids of the same token.
 *   DEFENDER  a live member with no known move still has a body (a speed > 0), because it can be hit.
 *   HISTORY   no reveal position carries history: shield streak 0, turns in 0, PP full, no choice lock.
 *   ENGINE    the play producer (fromEngine: MEDICHAM battles on frozen-pool TEST team pairs with both open sheets, stepped
 *             by a seeded random-legal driver, as test-porygon2-v1.js does) blanks the same history fields, and no token
 *             of it has an UNK item or ability id.
 *   RED       unless --no-red: PORY2V2_FEAT_BREAK=fill and PORY2V2_FEAT_BREAK=history must each turn this test RED.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
if (!process.env.SHOWDOWN_PATH) {
  const sib = path.join(MAIN, '..', 'pokemon-showdown-mc');
  if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib;
}
require('../arena/env.js');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const NG = argv.includes('--games') ? +argv[argv.indexOf('--games') + 1] : 120;
const R = require('../porygon2/v2/reveal.js');
const FX = require('../porygon2/v2/features.js');
const { toID } = require('../human/dex.js');
const UNK = R.UNK;
const DIRS = { bo1: path.join(MAIN, 'data', 'raw', 'games.gen9championsvgc2026regmc'), bo3: path.join(MAIN, 'data', 'raw', 'games.gen9championsvgc2026regmcbo3') };
for (const d of Object.values(DIRS)) if (!fs.existsSync(d)) { console.log('CANNOT ANSWER: no raw-log shards at ' + d); process.exit(2); }
const E = require('../arena/engine.js').load('eaa5becc54eb');
const API = E.API, M = API.M;
const F = FX.create(API);
const T = FX.TOK_NUM_NAMES, ti = n => T.indexOf(n);

let fails = 0, checks = 0;
const failed = {};
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed[clause] = (failed[clause] || 0) + 1; if (failed[clause] <= 5) console.log('  FAIL [' + clause + '] ' + msg); } };
function sample(dir, n) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.gz')).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) { if (!line.trim()) continue; const r = JSON.parse(line); if (r.log) out.push(r); if (out.length >= n) return out; }
  }
  return out;
}

const stats = { games: 0, positions: 0, unk_ability_members: 0, no_move_live_members: 0, engine_positions: 0 };
for (const fmt of ['bo1', 'bo3']) {
  for (const r of sample(DIRS[fmt], fmt === 'bo1' ? NG : Math.ceil(NG / 2))) {
    let g; try { g = R.extract(r.log, { mode: fmt }); } catch (e) { continue; }
    if (!g.positions.length) continue;
    stats.games++;
    for (const p of g.positions) {
      const P = F.fromReveal(p.x); const X = F.encode(P, { p1: 1200, p2: null });
      stats.positions++;
      for (const s of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
        const m = p.x.sides[s].mons[i], tok = X.tok[s][i], ids = X.ids[s][i], row = P.sheets[s][i];
        const where = `${r.id} t${p.n} ${s}${i} ${m.species}`;
        const body = F.buildBody(M, row);
        if (m.ability.base === UNK) {
          stats.unk_ability_members++;
          ok('NOFILL', body && body.ability === 'noability', where + ' unknown ability built as ' + (body && body.ability));
          ok('NOFILL', ids[4] === '<UNK>', where + ' ability_base id ' + ids[4]);
        }
        const known = new Set(m.moves.filter(v => v !== UNK).map(toID));
        ok('NOFILL', body && body.moves.every(mv => known.has(mv)), where + ' body moves ' + (body && body.moves) + ' known ' + [...known]);
        ok('UNKCOUNT', Math.round(tok[ti('unk_moves')] * 4) === ids.slice(6).filter(v => v === '<UNK>').length, where + ' unk_moves');
        ok('UNKCOUNT', tok[ti('unk_item_orig')] === (ids[2] === '<UNK>' ? 1 : 0) && tok[ti('unk_ability_base')] === (ids[4] === '<UNK>' ? 1 : 0), where + ' unk item/ability');
        if (m.brought === true && !m.fnt && m.moves.every(v => v === UNK)) {
          stats.no_move_live_members++;
          ok('DEFENDER', tok[ti('spe_eff')] > 0, where + ' a live member with no known move has no speed');
        }
        ok('HISTORY', tok[ti('protect_streak')] === 0 && tok[ti('turns_out')] === 0 && tok[ti('pp_min')] === 1 && tok[ti('vol_locked')] === 0, where + ' history present');
      }
    }
  }
}
ok('NOFILL', stats.unk_ability_members > 0, 'no member with an unknown ability was seen: the clause asked nothing');
ok('DEFENDER', stats.no_move_live_members > 0, 'no live member without a known move was seen: the clause asked nothing');

/* ENGINE: battles on frozen-pool TEST team pairs, a seeded random-legal driver (as test-porygon2-v1.js) */
const TEAMS = require('../arena/teams.js');
/* the pinned pool is untracked; it lives in the main checkout (as the raw shards above) */
const POOL = [path.join(ROOT, 'data', 'team-pool-frozen-regmc'), path.join(MAIN, 'data', 'team-pool-frozen-regmc')].find(d => fs.existsSync(path.join(d, 'games.bo3.jsonl')));
if (!POOL) { console.log('CANNOT ANSWER: no data/team-pool-frozen-regmc/games.bo3.jsonl'); process.exit(2); }
const PAIRS = require('../mew/pairs.js').load({ teamStore: POOL });
let seedv = 777;
const rnd = () => { seedv = (seedv * 1103515245 + 12345) >>> 0; return seedv / 4294967296; };
let movedHistory = 0;
for (let g = 0; g < 6; g++) {
  const G = PAIRS.test[(g * 7) % PAIRS.test.length];
  const a = TEAMS.buildTeam(M, G, 'p1'), b = TEAMS.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(4000 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  for (let t = 0; t < 8 && !API.isTerminal(S); t++) {
    const pick = sd => { const la = API.legalActions(S, sd); return la.joint[Math.floor(rnd() * la.joint.length)]; };
    API.stepInPlace(S, pick('A'), pick('B'), rng);
    if (API.isTerminal(S)) break;
    const P = F.fromEngine(S, G.sheets); const X = F.encode(P, { p1: 1600, p2: 1300 });
    stats.engine_positions++;
    /* the control: the raw v1 producer on the same battle DOES carry history somewhere, so the blanking is doing work */
    const H1 = F.v1.fromEngine(S, G.sheets);
    if (['p1', 'p2'].some(s => H1.sides[s].mons.some(m => m.seen && (m.turnsOut > 0 || m.protectN > 0)))) movedHistory++;
    for (const s of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
      const tok = X.tok[s][i], ids = X.ids[s][i];
      ok('ENGINE', tok[ti('protect_streak')] === 0 && tok[ti('turns_out')] === 0 && tok[ti('pp_min')] === 1, `engine g${g} t${t} ${s}${i} history present`);
      ok('ENGINE', ids[2] !== '<UNK>' && ids[4] !== '<UNK>', `engine g${g} ${s}${i} an open sheet produced an UNK item/ability`);
    }
  }
}
ok('ENGINE', stats.engine_positions > 0, 'no engine position was staged: the play producer was never checked');
ok('ENGINE', movedHistory > 0, 'the raw engine producer never carried history on these battles: the ENGINE clause asked nothing');
stats.engine_positions_with_raw_history = movedHistory;

console.log(JSON.stringify(stats));
if (!NO_RED) {
  for (const brk of ['fill', 'history']) {
    const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--games', String(Math.min(NG, 40))], { env: Object.assign({}, process.env, { PORY2V2_FEAT_BREAK: brk }), encoding: 'utf8' });
    const red = r.status === 1;
    ok('RED', red, `PORY2V2_FEAT_BREAK=${brk} did not turn the test RED (exit ${r.status})`);
    const why = [...new Set((r.stdout || '').split('\n').filter(l => /FAIL \[/.test(l)).map(l => /FAIL \[(\w+)\]/.exec(l)[1]))].join(', ');
    console.log(`  deliberate break PORY2V2_FEAT_BREAK=${brk}: ${red ? 'RED (as it must be)' : 'NOT RED'} — ${why}`);
  }
}
console.log(fails ? `RED ${checks - fails}/${checks}` : `GREEN ${checks}/${checks}`);
process.exit(fails ? 1 : 0);
