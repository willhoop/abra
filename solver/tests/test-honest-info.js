/* solver/tests/test-honest-info.js — the honest arena and ROTOM's miltank-gen5 policy search only on what a ladder
 * player can see (solver/xatu/worlds.js).
 *
 *   node solver/tests/test-honest-info.js [--no-red] [--release <id>]        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER
 *
 *   STATS    applySpread's stat line is the checkout's own (xatu/sd.js statValue = Showdown statModify) on every row of
 *            20 real Reg M-C sheets under random spreads, all six stats, HP included, the sheet's nature applied.
 *   DISPLAY  pctOf is the Champions display rule (floor(100 hp / max) || 1, 0 on a faint) and hpFromPct(pctOf(h)) shows
 *            the same percentage for every h of five max-HP values.
 *   VIEW     honest games on real TEST pairs (the frozen store), random joints for 6 turns; at EVERY decision of both
 *            sides the view (arenaView): keeps the decider's own side exactly; shows each revealed opponent body at
 *            the true DISPLAYED percentage and at the zero-SP line of its sheet nature, never its true line (and the
 *            true line does differ, on most bodies); fills every unrevealed opponent slot from XATU's MAP back pair,
 *            not from the truth (and the two differ somewhere); carries a back-pair posterior that sums to 1 and
 *            contains every revealed back row, and a spread belief.
 *   WORLDS   the honest rollout's worlds: the back line drawn from the posterior only (every filled row is in a pair with
 *            p > 0), the spreads re-drawn per world (a revealed body takes at least 5 distinct stat lines over 40
 *            worlds), the revealed bodies' displayed HP unchanged by the draw, and the counters move.
 *   MATCH    a 1-pair match through solver/mew/play.js with NO --info flag is honest: every line says so, the truth
 *            spread was applied to all 16 bodies, every decision took a view, XATU gave a posterior, worlds drew spreads.
 *
 * RED, unless --no-red: HONEST_BREAK=peek (arenaView hands back the TRUE battle and no belief) must turn VIEW red.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const REL = process.env.ARENA_TEST_RELEASE || (argv.includes('--release') ? argv[argv.indexOf('--release') + 1] : 'eaa5becc54eb');
const STORE = path.join(ROOT, 'data', 'team-pool-frozen-regmc');
if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL))) { console.log('CANNOT ANSWER: release ' + REL + ' is not in data/releases'); process.exit(2); }
if (!fs.existsSync(path.join(STORE, 'games.bo3.jsonl'))) { console.log('CANNOT ANSWER: no games.bo3.jsonl in ' + STORE); process.exit(2); }

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (failed.size < 40) console.log('  FAIL [' + clause + '] ' + msg); } };
const want = c => !ONLY || ONLY.includes(c);

const E = require('../arena/engine.js').load(REL);
const API = E.API, M = API.M;
const T = require('../arena/teams.js');
const P = require('../mew/pairs.js').load({ teamStore: STORE });
const AG = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
const XW = AG.XW, W = require('../xatu/worlds.js');
const SD = require('../xatu/sd.js');
const pairs = require('../mew/pairs.js').pick(P.test, 12, 3);
const MAP = { hp: 'hp', atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };

/* ---------------- STATS ---------------- */
if (want('STATS')) {
  const R0 = W.rng(11);
  const { randomSpread } = require('../xatu/selfplay.js');
  let n = 0, bad = 0;
  for (const G of pairs.slice(0, 10)) for (const p of ['p1', 'p2']) for (const row of G.sheets[p]) {
    const b = T.buildBody(M, row); if (!b) continue;
    const sp = randomSpread(R0);
    XW.applySpread(b, sp, row);
    for (const [k, e] of Object.entries(MAP)) {
      const want = SD.statValue(row.species, row.nature || 'Serious', k, sp[k]);
      n++; if (b.st[e] !== want) { bad++; if (bad < 4) console.log(`    ${row.species} ${row.nature} ${k} sp ${sp[k]}: ours ${b.st[e]} checkout ${want}`); }
    }
  }
  ok('STATS', n >= 600 && bad === 0, `applySpread equals the checkout's statModify on ${n - bad}/${n} stats`);
  console.log(`  STATS: ${n} stats compared, ${bad} differ`);
}

/* ---------------- DISPLAY ---------------- */
if (want('DISPLAY')) {
  ok('DISPLAY', W.pctOf(0, 150) === 0 && W.pctOf(1, 150) === 1 && W.pctOf(150, 150) === 100 && W.pctOf(149, 150) === 99 && W.pctOf(75, 150) === 50, 'pctOf is floor(100 hp / max) || 1');
  let bad = 0;
  for (const max of [131, 150, 177, 202, 244]) for (let h = 1; h <= max; h++) if (W.pctOf(W.hpFromPct(W.pctOf(h, max), max), max) !== W.pctOf(h, max)) bad++;
  ok('DISPLAY', bad === 0, `hpFromPct lands inside the displayed percentage (${bad} misses)`);
}

/* ---------------- VIEW + WORLDS ---------------- */
function viewClause() {
  const R = AG.R;
  const st = { decisions: 0, statDiffer: 0, revealedBodies: 0, hiddenSlots: 0, hiddenDiffer: 0, worldsChecked: 0 };
  for (const [gi, G] of pairs.slice(0, 6).entries()) {
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    if (!a || !b) continue;
    const truth = XW.truthSpreads(G.sheets, 1000 + gi);
    for (const [p, t] of [['p1', a], ['p2', b]]) for (const m of t.team) XW.applySpread(m, truth[p][m._solverSheet], G.sheets[p][m._solverSheet]);
    const rng = API.makeRng(500 + gi);
    const S = API.newBattle(a.team, b.team, { rng });
    const H = XW.arenaGame(G, S, PA0);
    const coin = M.rngStreams({ seed: 77 + gi }).any;
    for (let turn = 0; turn < 6 && !API.isTerminal(S); turn++) {
      for (const side of ['A', 'B']) {
        const O = side === 'A' ? 'B' : 'A', me = side === 'A' ? 'p1' : 'p2', oppP = side === 'A' ? 'p2' : 'p1';
        const { V, hb } = XW.arenaView(H, G, S, side, PA0);
        st.decisions++;
        const sfT = side === 'A' ? S.sfA : S.sfB, sfV = side === 'A' ? V.sfA : V.sfB;
        ok('VIEW', V !== S, 'the view is a copy, not the battle');
        ok('VIEW', sfT.team.every((m, k) => JSON.stringify(m.st) === JSON.stringify(sfV.team[k].st) && m.curHP === sfV.team[k].curHP), `${G.id} t${turn} ${side}: own side exact`);
        const oT = O === 'A' ? S.sfA : S.sfB, oV = O === 'A' ? V.sfA : V.sfB;
        const rev = PA0.revealed(S, O);
        const map = hb && hb.back && hb.back.length ? hb.back.reduce((x, y) => (y.p > x.p ? y : x)).pair : null;
        ok('VIEW', !!(hb && hb.back && hb.back.length && hb.spreads), `${G.id} t${turn} ${side}: a back-pair posterior and a spread belief`);
        if (hb && hb.back) {
          const sum = hb.back.reduce((s, x) => s + x.p, 0);
          ok('VIEW', Math.abs(sum - 1) < 1e-6, `posterior sums to 1 (${sum})`);
          const revBack = [...rev].map(k => oT.team[k]._solverSheet).filter(s => !H.leads[oppP].includes(s));
          ok('VIEW', hb.back.filter(x => x.p > 0).every(x => revBack.every(s => x.pair.includes(s))), 'every pair with p > 0 holds every revealed back row');
        }
        for (let k = 0; k < oT.team.length; k++) {
          const t = oT.team[k], v = oV.team[k];
          if (rev.has(k)) {
            st.revealedBodies++;
            const zero = T.buildBody(M, G.sheets[oppP][t._solverSheet]); zero.name = t.name; XW.applySpread(zero, null, G.sheets[oppP][t._solverSheet]);
            ok('VIEW', v._solverSheet === t._solverSheet, 'a revealed body keeps its identity');
            ok('VIEW', JSON.stringify(v.st) === JSON.stringify(zero.st), `${G.id} ${t.name}: the view's line is the zero-SP line of its nature`);
            ok('VIEW', W.pctOf(v.curHP, v.st.hp) === W.pctOf(t.curHP, t.st.hp), `${G.id} ${t.name}: displayed HP ${W.pctOf(v.curHP, v.st.hp)} = true display ${W.pctOf(t.curHP, t.st.hp)}`);
            if (JSON.stringify(v.st) !== JSON.stringify(t.st)) st.statDiffer++;
          } else {
            st.hiddenSlots++;
            ok('VIEW', map != null && map.includes(v._solverSheet), `${G.id} t${turn}: hidden slot ${k} is filled from the MAP pair ${map} (holds ${v._solverSheet})`);
            if (v._solverSheet !== t._solverSheet) st.hiddenDiffer++;
          }
        }
        /* WORLDS: once per game, from the first view of side A */
        if (turn === 1 && side === 'A' && hb) {
          const Rh = XW.rollout(hb);
          const belief = { sheet: G.sheets[oppP], revealed: PA0.revealed(V, O) };
          const c0 = Object.assign({}, XW.COUNTERS);
          const lines = new Map();
          const okPairs = hb.back.filter(x => x.p > 0).map(x => x.pair);
          for (let w = 0; w < 40; w++) {
            const Wd = Rh.sampleWorld(V, O, belief, coin);
            const sf = O === 'A' ? Wd.sfA : Wd.sfB;
            for (let k = 0; k < sf.team.length; k++) {
              const m = sf.team[k];
              if (belief.revealed.has(k)) {
                const key = k + ':' + JSON.stringify(m.st); lines.set(k, (lines.get(k) || new Set()).add(key));
                if (m.curHP > 0) ok('WORLDS', W.pctOf(m.curHP, m.st.hp) === W.pctOf(oV.team[k].curHP, oV.team[k].st.hp) || Math.abs(W.pctOf(m.curHP, m.st.hp) - W.pctOf(oV.team[k].curHP, oV.team[k].st.hp)) <= 1, `a world keeps a revealed body's displayed HP (±1 for rounding)`);
              } else ok('WORLDS', okPairs.some(pr => pr.includes(m._solverSheet)), `a filled back row (${m._solverSheet}) is in a pair with p > 0`);
            }
            st.worldsChecked++;
          }
          const minLines = Math.min(...[...lines.values()].map(s => s.size));
          ok('WORLDS', lines.size > 0 && minLines >= 5, `every revealed body takes >= 5 distinct stat lines over 40 worlds (min ${minLines})`);
          ok('WORLDS', XW.COUNTERS.worlds - c0.worlds === 40 && XW.COUNTERS.spreadsSampled > c0.spreadsSampled, 'the world counters move');
        }
      }
      API.stepInPlace(S, R.randomJoint(API.clone(S), 'A', coin), R.randomJoint(API.clone(S), 'B', coin), rng);
    }
  }
  ok('VIEW', st.decisions >= 40, `decisions viewed (${st.decisions})`);
  ok('VIEW', st.revealedBodies > 0 && st.statDiffer / st.revealedBodies > 0.5, `the truth's line differs from the view's on most revealed bodies (${st.statDiffer}/${st.revealedBodies}) — the truth has spreads to hide`);
  ok('VIEW', st.hiddenSlots > 0 && st.hiddenDiffer > 0, `the view's hidden fill is not the truth somewhere (${st.hiddenDiffer}/${st.hiddenSlots})`);
  console.log(`  VIEW: ${st.decisions} decisions, revealed bodies ${st.revealedBodies} (true line differs on ${st.statDiffer}), hidden slots ${st.hiddenSlots} (fill differs from truth on ${st.hiddenDiffer}), worlds ${st.worldsChecked}`);
}
if (want('VIEW') || want('WORLDS')) viewClause();

/* ---------------- MATCH ---------------- */
if (want('MATCH')) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'honest-test-'));
  const spec = path.join(TMP, 'x.json');
  fs.writeFileSync(spec, JSON.stringify({ name: 'honest-test', kind: 'miltank', mag: 'solver/machamp/models/gen5/mag-gen5.json', doduo: 'solver/machamp/models/gen5/doduo-gen5.json',
    pory2: 'solver/machamp/models/gen5/porygon2-gen5.json', budgetMs: 300, k1: 4, k2: 4, depth: 0, reserveSwitch: 1 }));
  const out = path.join(TMP, 'm.jsonl');
  const r = cp.spawnSync(process.execPath, ['--max-old-space-size=1536', path.join(ROOT, 'solver', 'mew', 'play.js'), '--mode', 'match', '--release', REL, '--x', spec,
    '--y', path.join(ROOT, 'solver', 'machamp', 'league', 'human-clone.json'), '--pairs', '1', '--pair-seed', '2', '--seed', '9', '--cap', '12', '--team-store', STORE, '--out', out],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  ok('MATCH', r.status === 0, 'play.js ran (exit ' + r.status + ') ' + String(r.stderr || '').slice(-300));
  if (r.status === 0) {
    const s = JSON.parse(fs.readFileSync(out + '.summary.json', 'utf8'));
    const lines = fs.readFileSync(out, 'utf8').trim().split('\n').map(JSON.parse);
    ok('MATCH', s.info === 'honest' && lines.length === 2 && lines.every(l => l.info === 'honest'), 'a match with no --info is honest, on every line');
    ok('MATCH', s.honest && s.honest.truth_bodies === 16, `the truth spread was applied to all 16 bodies (${s.honest && s.honest.truth_bodies})`);
    const dec = s.agent_counters.decisions;
    ok('MATCH', s.honest && s.honest.views === dec && s.honest.back_xatu === dec && s.honest.back_error === 0, `every decision took a view with a XATU posterior (views ${s.honest && s.honest.views}, posteriors ${s.honest && s.honest.back_xatu}, decisions ${dec})`);
    ok('MATCH', s.agent_counters.searched > 0 && s.agent_counters.honest === s.agent_counters.searched + s.agent_counters.forced, `every MILTANK decision used the honest worlds (${s.agent_counters.honest} honest, ${s.agent_counters.searched} searched + ${s.agent_counters.forced} forced)`);
    ok('MATCH', s.honest.worlds.worlds > 0 && s.honest.worlds.spreadsSampled > 0, `worlds drew spreads (${s.honest.worlds.worlds} worlds, ${s.honest.worlds.spreadsSampled} spreads)`);
    console.log(`  MATCH: ${lines.length} games, ${dec} decisions, ${s.honest.views} views, ${s.honest.worlds.worlds} worlds, ${s.honest.worlds.spreadsSampled} spreads drawn`);
  }
}

/* ---------------- RED ---------------- */
let blind = false;
if (!NO_RED && !ONLY) {
  const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--only', 'VIEW', '--release', REL], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { HONEST_BREAK: 'peek' }), maxBuffer: 1 << 26 });
  const red = r.status === 1 && /FAIL \[VIEW\]/.test(r.stdout);
  console.log(`  RED HONEST_BREAK=peek: ${red ? 'VIEW went red, as it must' : 'STAYED GREEN (exit ' + r.status + ') — the test is blind'}`);
  if (!red) blind = true;
}

console.log(`\ntest-honest-info: ${checks - fails}/${checks} ${fails ? 'RED ' + JSON.stringify([...failed]) : blind ? 'BLIND' : 'GREEN'}`);
process.exit(fails ? 1 : blind ? 3 : 0);
