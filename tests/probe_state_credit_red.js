#!/usr/bin/env node
/* tests/probe_state_credit_red.js — the two gate rows closed on 2026-09-19 (close-two-clauses).
 * ==================================================================================================
 * DOES engine/all_mechanics_fire.js SEE OUR ENGINE ACT — AND ONLY WHEN IT ACTS?
 *
 * Eight moves read `medicham_resolved: false` on `d92bdfb50d88` with the boards agreeing: Ally Switch,
 * Destiny Bond, Guard Swap, Life Dew, Power Swap, Sleep Talk, Topsy-Turvy, Wish. The reader keyed on
 * protocol lines our trace never writes (`[spread]`, a called move's `[from]`, the move NAME in
 * `[from] move:`) or on announcements our engine is declared not to make (`swap`, `-swapboost`,
 * `-invertboost`, `-singlemove`). Three reader fixes and one board reading (`stateCredit`) close them;
 * this probe asks both halves of the question:
 *
 *   GREEN ARM  the eight, plus Psych Up (its fixture moved with the same planner derivation), must each
 *              read resolved on BOTH engines, and Natural Cure must read FIRED on the planner fixture
 *              (the merge had refused it: "C is asked for two trigger clicks on one turn").
 *   RED ARM 1  MEDI_WISH_NO_PAYOUT=1 — Wish comes due and heals nobody. The PROTOCOL half must read Wish
 *              NOT resolved on MEDICHAM.
 *   RED ARM 2  MEDI_STAT_INVERT_NOOP=1 — Topsy-Turvy reports success and inverts nothing. The STATE half
 *              must read it NOT resolved (our two arms identical), and the board must part.
 *
 * THE REAL TOOL, RUN SMALL, TO A TEMP PATH (`--only`, `--out`), pinned to `--release` and the frozen pool.
 * A release whose engine predates the two knobs cannot run the red arms and the probe says CANNOT ANSWER
 * rather than calling an unwired knob a pass.
 * EXIT: 0 green / 1 red / 2 cannot answer. About three minutes.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'engine-release.json'), 'utf8')).current);
const STORE = arg('--team-store', 'data/team-pool-frozen');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const env0 = { ...process.env, SHOWDOWN_PATH: process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown' };
delete env0.MEDI_WISH_NO_PAYOUT; delete env0.MEDI_STAT_INVERT_NOOP;

const relMedi = path.join(ROOT, 'data', 'releases', REL_ID, 'engine', 'medicham2-browser.js');
let src = null;
try { src = fs.readFileSync(relMedi, 'utf8'); } catch (e) { cannot('release ' + REL_ID + ' has no frozen engine to read (' + e.message + ')'); }
for (const k of ['MEDI_WISH_NO_PAYOUT', 'MEDI_STAT_INVERT_NOOP'])
  if (src.indexOf(k) < 0) cannot('release ' + REL_ID + ' predates the knob ' + k + ', so the red arm would be an unwired knob — pass --release <id> of a release that carries it');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-state-credit-'));
function amf(tag, kind, only, knobs) {
  const out = path.join(TMP, tag + '.json');
  const args = [path.join(ROOT, 'engine', 'all_mechanics_fire.js'), '--release', REL_ID, '--team-store', STORE,
                '--kind', kind, '--only', only.join(','), '--write', '--out', out];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', ...args],
    { cwd: ROOT, env: { ...env0, ...(knobs || {}) }, encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 28 });
  let j = null, readErr = null;
  try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { readErr = 'artifact unreadable: ' + e.message; }
  const tail = (readErr ? readErr + ' | ' : '') + ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-3).join(' | ');
  console.log('  ' + tag.padEnd(12) + ' exit ' + r.status + ' in ' + Math.round((Date.now() - t0) / 1000) + 's'
    + (knobs ? '  ' + JSON.stringify(knobs) : ''));
  if (!j) cannot('the ' + tag + ' run published nothing: ' + tail);
  if (j.games_threw) cannot('the ' + tag + ' run threw ' + j.games_threw + ' game(s): ' + tail);
  return j;
}
const byId = (j, pop) => new Map(((j.rows || {})[pop] || []).map(r => [r.id, r]));
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\ntests/probe_state_credit_red.js   release ' + REL_ID + '   pool ' + STORE);
const MOVES = ['allyswitch', 'destinybond', 'guardswap', 'lifedew', 'powerswap', 'sleeptalk', 'topsyturvy', 'wish', 'psychup'];
const green = byId(amf('green-moves', 'moves', MOVES), 'moves');
for (const m of MOVES) {
  const r = green.get(m);
  ok(!!r && r.resolved === true && r.medicham_resolved === true,
     m + ' resolves on BOTH engines' + (r && r.medicham_resolved_by ? ' (ours read off the board: ' + ((r.medicham_state_credit || {}).where || '?') + ')' : ''),
     r ? 'showdown ' + r.resolved + ', medicham ' + r.medicham_resolved + ' — ' + (r.medicham_why || '') : 'NO ROW');
}
const nc = byId(amf('green-nc', 'abilities', ['naturalcure']), 'abilities').get('naturalcure');
ok(!!nc && nc.verdict === 'FIRED' && nc.stage === 'planner' && !nc.control_not_quiet,
   'Natural Cure FIRES on its planner fixture against a quiet control',
   nc ? 'verdict ' + nc.verdict + ', stage ' + nc.stage + ', control ' + nc.control + (nc.planner && nc.planner.refusal ? ', planner REFUSED ' + nc.planner.reason : '') : 'NO ROW');

const wish = byId(amf('red-wish', 'moves', ['wish'], { MEDI_WISH_NO_PAYOUT: '1' }), 'moves').get('wish');
ok(!!wish && wish.resolved === true && wish.medicham_resolved === false,
   'RED 1 CAUGHT — a Wish that heals nobody reads NOT resolved on MEDICHAM (protocol half)',
   wish ? 'showdown ' + wish.resolved + ', medicham ' + wish.medicham_resolved + ' — ' + (wish.medicham_why || '') : 'NO ROW');
const tt = byId(amf('red-topsy', 'moves', ['topsyturvy'], { MEDI_STAT_INVERT_NOOP: '1' }), 'moves').get('topsyturvy');
ok(!!tt && tt.resolved === true && tt.medicham_resolved === false && !!tt.board && tt.board.verdict !== 'NO-DIVERGENCE',
   'RED 2 CAUGHT — a Topsy-Turvy that inverts nothing reads NOT resolved on MEDICHAM (state half), and the board parts',
   tt ? 'showdown ' + tt.resolved + ', medicham ' + tt.medicham_resolved + ', board ' + (tt.board || {}).verdict
        + ' — ' + ((tt.medicham_state_credit || {}).why || tt.medicham_why || '') : 'NO ROW');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + TMP + ': ' + e.message + ')'); }
console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
