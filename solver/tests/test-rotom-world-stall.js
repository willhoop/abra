/* solver/tests/test-rotom-world-stall.js — ROTOM's world carries the consecutive-Protect counter (2026-09-26,
 * docs/_reports/2026-09-26-protect-overuse.md).
 *
 *   node solver/tests/test-rotom-world-stall.js [--release eaa5becc54eb] [--games 30]      exit 0 GREEN, 1 RED
 *
 *   ENGINE   the counter read off the PROTOCOL (solver/rotom/world.js stallStreaks) equals MEDICHAM's own
 *            `tookProtectTurns` at the start of every turn, for every live active body, over seeded games whose clicks
 *            lean on the protect family (so runs of 1, 2 and more occur, and some rolls are lost). The protocol is the
 *            engine's own trace, which the gate holds to Showdown's. Coverage floors: runs of 1 AND of 2+ both seen, and
 *            at least one lost roll, so a map that is always empty (or always 1) cannot pass.
 *   WORLD    world.js build() on a captured live request (solver/tests/fixtures/rotom/move-disabled.json) lays the counter
 *            on my active body when the log shows its Protect went up on the last turn, lays none when the log shows it
 *            failed, and counts a build with no log (`stallNoLines`) instead of guessing.
 *   RED      ROTOM_WORLD_BREAK=nostall (the pre-fix world: no counter) must turn ENGINE and WORLD red.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const NG = +flag('--games', 30);

let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const W = require('../rotom/world.js');
const FAM = require('../arena/protect_stats.js').family();
const P = require('../mew/pairs.js').load({ teamStore: 'data/team-pool-frozen-regmc' });
const live = m => !!(m && !m.fainted && m.curHP > 0);

/* ---------------- ENGINE ---------------- */
{
  let compared = 0, one = 0, twoPlus = 0, lost = 0, games = 0, mism = [];
  const pool = P.test.filter(g => ['p1', 'p2'].every(sd => g.brought[sd].some(s => (g.sheets[sd][s].moves || []).some(mv => FAM.has(T.toID(mv))))));
  for (let g = 0; g < NG && g < pool.length; g++) {
    const G = pool[(g * 7) % pool.length];
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    if (!a || !b) continue;
    const tr = [];
    const rng = API.makeRng(1000 + g);
    const coin = M.rngStreams({ seed: 5000 + g }).any;
    const S = API.newBattle(a.team, b.team, { rng, trace: tr });
    /* the protocol names a body by its ident: the sheet's nickname here is that ident */
    const sheets = {};
    for (const [sd, t] of [['p1', a], ['p2', b]]) { sheets[sd] = G.sheets[sd].map(r => Object.assign({}, r, { nick: null })); t.team.forEach(m => { sheets[sd][m._solverSheet].nick = m._ident || m.name; }); }
    games++;
    for (let turn = 0; turn < 14 && !API.isTerminal(S); turn++) {
      const st = W.stallStreaks(tr, sheets);
      for (const [sd, act] of [['p1', S.actA], ['p2', S.actB]]) for (const m of act) {
        if (!live(m)) continue;
        const want = m.tookProtectTurns | 0, got = st.get(sd + ':' + m._solverSheet) || 0;
        compared++;
        if (want === 1) one++; else if (want >= 2) twoPlus++;
        if (want !== got && mism.length < 5) mism.push(`game ${g} turn ${S.turn} ${sd} ${m._ident}: engine ${want} log ${got}`);
        if (want !== got) mism.total = (mism.total || 0) + 1;
      }
      const J = {};
      for (const sd of ['A', 'B']) {
        const la = API.legalActions(S, sd);
        J[sd] = la.slots.map((s, k) => {
          const opts = s.options.filter(o => o.kind === 'move' && !o.mega);
          const sh = opts.filter(o => FAM.has(o.move));
          if (sh.length && coin() < 0.7) return sh[0];
          return opts.length ? opts[Math.floor(coin() * opts.length)] : s.options[0];
        });
        if (!la.joint.some(j => j.every((o, k) => o === J[sd][k]))) J[sd] = la.joint[Math.floor(coin() * la.joint.length)];
      }
      const up = new Map([...S.actA, ...S.actB].filter(live).map(m => [m, m.tookProtectTurns | 0]));
      API.stepInPlace(S, J.A, J.B, rng);
      for (const [m, n] of up) if (n > 0 && live(m) && (m.tookProtectTurns | 0) === 0) lost++;
    }
  }
  console.log(`  ENGINE  ${games} games, ${compared} body-turns compared, counter 1: ${one}, counter 2+: ${twoPlus}, runs ended: ${lost}, mismatches: ${mism.total || 0}`);
  ok('ENGINE', games >= Math.min(NG, 10), 'too few games staged: ' + games);
  ok('ENGINE', !(mism.total > 0), 'the log-read counter disagrees with the engine on ' + mism.total + ' body-turns: ' + mism.join('; '));
  ok('ENGINE', one > 0 && twoPlus > 0 && lost > 0, `coverage: counter 1 seen ${one}, 2+ seen ${twoPlus}, runs ended ${lost} — each must be non-zero`);
}

/* ---------------- WORLD ---------------- */
{
  const { parseGame } = require('../human/parse_game.js');
  const f = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rotom', 'move-disabled.json'), 'utf8'));
  const WB = W.create(API);
  const actIdent = f.req.side.pokemon.find(p => p.active).ident.replace(/^(p[12])/, '$1a');
  const nick = actIdent.replace(/^p[12]a:\s*/, '');
  const up = f.lines.lastIndexOf('|upkeep');
  const withShield = res => f.lines.slice(0, up).concat(['|move|' + actIdent + '|Protect|' + actIdent].concat(res), f.lines.slice(up));
  /* the parsed row is the fixture's own (the parser holds one decision per slot per turn); only the log handed to the
   * counter carries the added turn-5 shield, which is the one input stallStreaks reads */
  const build = lines => {
    const row = parseGame({ id: 'fx', log: f.lines.join('\n') });
    return WB.build({ row, sheets: f.sheets, me: f.me, req: f.req, oppGuess: null, lines });
  };
  const bodyOf = w => w.mine.find(x => f.sheets[f.me][x.s].nick === nick).b;
  const wUp = build(withShield(['|-singleturn|' + actIdent + '|Protect']));
  ok('WORLD', bodyOf(wUp).tookProtectTurns === 1, 'a Protect that went up last turn: counter ' + bodyOf(wUp).tookProtectTurns + ', want 1');
  const wFail = build(withShield(['|-fail|' + actIdent]));
  ok('WORLD', !(bodyOf(wFail).tookProtectTurns > 0), 'a Protect that failed last turn: counter ' + bodyOf(wFail).tookProtectTurns + ', want 0');
  const before = WB.COUNTERS.stallNoLines;
  const row = parseGame({ id: 'fx', log: f.lines.join('\n') });
  WB.build({ row, sheets: f.sheets, me: f.me, req: f.req, oppGuess: null });
  ok('WORLD', WB.COUNTERS.stallNoLines === before + 1, 'a build with no log was not counted');
  console.log(`  WORLD   ${actIdent}: up -> ${bodyOf(wUp).tookProtectTurns}, failed -> ${bodyOf(wFail).tookProtectTurns | 0}; stallLaid ${WB.COUNTERS.stallLaid}`);
}

console.log(fails ? `RED  ${fails} of ${checks} checks failed${process.env.ROTOM_WORLD_BREAK ? ' (ROTOM_WORLD_BREAK=' + process.env.ROTOM_WORLD_BREAK + ')' : ''}` : `GREEN  ${checks} checks`);
process.exit(fails ? 1 : 0);
