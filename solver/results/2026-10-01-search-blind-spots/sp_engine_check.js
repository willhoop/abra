#!/usr/bin/env node
/**
 * Does MEDICHAM fail our Sucker Punch where the server did? (2026-10-01, docs/_reports/2026-10-01-search-blind-spots.md)
 *
 * For every ladder decision that clicked Sucker Punch (blind_spots.js measured.json `sucker_punch.rows`), ROTOM's world is
 * rebuilt at that turn (solver/tests/ladder_replay.js) and ONE engine step is played, six seeds, with:
 *   ours    slot k = Sucker Punch into the logged target; the partner Protects when it can (else does not aim at the target)
 *   theirs  the target slot = the action it actually took (a status move, Protect, a switch, an attack)
 * and the target's HP (or the switch-in's) is read after the step. A failed Sucker Punch leaves it untouched. This asks the
 * question the table's cells rest on: when the opponent does what it did, does a playout charge Sucker Punch for failing?
 *
 *   node solver/results/2026-10-01-search-blind-spots/sp_engine_check.js [--root <solver/out/rotom>] [--release eaa5becc54eb]
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs'), path = require('path');
require('../../arena/env.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--root', path.join(__dirname, '..', '..', 'out', 'rotom'));
const REL = arg('--release', 'eaa5becc54eb');
const ENGINE = require('../../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../../arena/teams.js'), W = require('../../rotom/world.js'), LR = require('../../tests/ladder_replay.js');
const WB = W.create(API);
const hpOf = r => { const b = T.buildBody(M, r); return b ? b.st.hp : 100; };
const MS = JSON.parse(fs.readFileSync(path.join(__dirname, 'measured.json'), 'utf8'));
const out = [];
for (const s of MS.sucker_punch.rows) {
  const dir = path.join(ROOT, s.run, 'games', 'medicham32'), logf = path.join(dir, s.room + '.log');
  const ds = fs.readFileSync(path.join(dir, s.room + '.decisions.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const pv = ds.find(d => d.kind === 'preview');
  const bring = pv && /^team \d{4}/.test(pv.choice) ? pv.choice.slice(5, 9).split('').map(c => +c - 1) : null;
  const L = fs.readFileSync(logf, 'utf8').replace(/\r/g, '').split('\n');
  let me = null; for (const l of L) { const p = l.split('|'); if (p[1] === 'player' && p[3] === 'medicham32') me = p[2]; }
  const w = LR.worldAt(WB, { log: logf, me, bring, cut: '|turn|' + s.turn, hpOf });
  const side = w.side, opp = side === 'A' ? 'B' : 'A', k = s.slot === 'a' ? 0 : 1, tk = s.target_slot === 'a' ? 0 : 1;
  const laMe = API.legalActions(w.S, side), laOp = API.legalActions(w.S, opp);
  const cand = laMe.joint.filter(j => j[k] && j[k].kind === 'move' && j[k].move === 'suckerpunch' && j[k].target === tk + 1 && !j[k].mega);
  const pick = cand.find(j => j[1 - k] && j[1 - k].kind === 'move' && /protect|detect/.test(j[1 - k].move)) || cand.find(j => !(j[1 - k] && j[1 - k].target === tk + 1)) || cand[0];
  const act = s.target_actual;
  const opJ = laOp.joint.filter(j => { const o = j[tk]; if (!o) return false; if (act === 'switch') return o.kind === 'switch'; return o.kind === 'move' && o.move === act; });
  const row = { room: s.room, turn: s.turn, failed_on_server: s.failed, target_action: act, target_class: s.target_class };
  if (!pick || !opJ.length) { row.staged = false; row.why = !pick ? 'no Sucker Punch joint in the rebuilt menu' : 'the target action is not in the rebuilt menu (' + act + ')'; out.push(row); continue; }
  const oj = opJ.find(j => !(j[1 - tk] && j[1 - tk].kind === 'move' && /protect|detect/.test(j[1 - tk].move))) || opJ[0];
  const tgt0 = (opp === 'A' ? w.S.actA : w.S.actB)[tk];
  /* THE CONTROL: the same step with the Sucker Punch slot clicking a non-damaging move (Protect when it has one), so
   * residual chip (weather, burn, a partner's redirected hit) is not read as the Sucker Punch landing */
  const isQuiet = o => o && o.kind === 'move' && o.move !== 'suckerpunch' && (/protect|detect/.test(o.move) || (M.moveTagParam(o.move, 'targetClass') || {}).target === 'self');
  const ctl = laMe.joint.find(j => isQuiet(j[k]) && JSON.stringify(j[1 - k]) === JSON.stringify(pick[1 - k]));
  const hpAfter = S2 => {
    const team = opp === 'A' ? S2.sfA.team : S2.sfB.team;
    const b = team.find(x => x._solverSheet === tgt0._solverSheet);
    const a2 = (opp === 'A' ? S2.actA : S2.actB)[tk];
    const into = act === 'switch' ? a2 : b;
    return into ? (into.fainted ? 0 : into.curHP) : null;
  };
  let hurt = 0, n = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const hs = hpAfter(API.step(w.S, side === 'A' ? pick : oj, side === 'A' ? oj : pick, API.makeRng(seed)));
    const before = act === 'switch' ? null : tgt0.curHP;
    const hc = ctl ? hpAfter(API.step(w.S, side === 'A' ? ctl : oj, side === 'A' ? oj : ctl, API.makeRng(seed))) : before;
    n++; if (hs != null && hc != null && hs < hc) hurt++;
  }
  row.control = ctl ? ctl.map(o => o && (o.kind === 'switch' ? 'switch' : o.move)) : null;
  Object.assign(row, { staged: true, ours: pick.map(o => o && (o.kind === 'switch' ? 'switch' : o.move + (o.target != null ? ' ' + o.target : ''))),
    theirs: oj.map(o => o && (o.kind === 'switch' ? 'switch' : o.move + (o.target != null ? ' ' + o.target : ''))), seeds: n, target_hurt: hurt });
  out.push(row);
  console.log((s.failed ? 'FAIL ' : 'ok   ') + ('t' + s.turn).padEnd(4) + act.padEnd(14) + ' ours ' + JSON.stringify(row.ours) + ' theirs ' + JSON.stringify(row.theirs) + '  engine: target hurt ' + hurt + '/' + n);
}
const st = out.filter(r => r.staged);
const sum = {
  staged: st.length, not_staged: out.length - st.length,
  server_failed_engine_hurt_any_seed: st.filter(r => r.failed_on_server && r.target_hurt > 0).map(r => ({ room: r.room, turn: r.turn, action: r.target_action, hurt: r.target_hurt })),
  server_failed_engine_clean: st.filter(r => r.failed_on_server && r.target_hurt === 0).length,
  server_landed_engine_hurt: st.filter(r => !r.failed_on_server && r.target_hurt > 0).length,
};
fs.writeFileSync(path.join(__dirname, 'sp_engine.json'), JSON.stringify({ generated_by: 'solver/results/2026-10-01-search-blind-spots/sp_engine_check.js', release: REL, summary: sum, rows: out }, null, 1) + '\n');
console.log(JSON.stringify(sum, null, 1));
