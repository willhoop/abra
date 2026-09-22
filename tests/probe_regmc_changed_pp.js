#!/usr/bin/env node
/* tests/probe_regmc_changed_pp.js — A MOVE LEGAL IN BOTH REGULATIONS WHOSE PP CHANGED: THE ENGINE RUNS OUT WHEN THE
 * AUTHORITY DOES. 2026-09-22 (MEASURE, abra/regmc 0.40.0).
 *
 *   node tests/probe_regmc_changed_pp.js --regulation regmc      # exit 0 green, 1 red, 2 not run
 *
 * WHY. docs/REGMC.md "THE DELTA": two moves are legal in both regulations and had their PP cut. A changed value on an
 * entity legal in both is invisible to every added / removed list, and an engine built as "M-B plus the new things"
 * carries the old number forever. The cast is DERIVED, never typed: every move legal in both formats whose `pp`
 * differs between the Reg M-B checkout and the selected one (read off both dexes on the run).
 *
 * WHERE THE ENGINE READS PP. `engine/medicham2-browser.js` `ppMax` reads the `pp` tag through `engine/tags.js`, which
 * the selected regulation points at its own tag file; `engine/pp.js` `maxPP` reads the same tag. So the probe asks:
 *   1. the tag file the regulation selects carries the SELECTED authority's base PP for each changed move (the owner's
 *      file cannot be read from a non-owner run: the artifact seam answers it with the selected one, by design);
 *   2. `engine/pp.js` answers the selected value;
 *   3. A GAME: one body clicks the move until the authority has no PP left for it, both engines played by the
 *      differential's own scripted harness, and at EVERY turn boundary the PP REMAINING on each side is read straight
 *      off each engine (Showdown's `moveSlots[].pp`, medicham2's own `_pp` table) and must agree -- including the last
 *      boundary, where both must read 0. (The board comparator compares PP SPENT, which is equal on both sides until the
 *      moment one engine runs out; remaining is the reading that sees a wrong maximum.) */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_changed_pp', []);
const path = require('path');
const fs = require('fs');
const { G, D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P, CS } = K;
const ROOT = path.join(__dirname, '..');

/* ---- 1. the cast: moves legal in both, whose pp differs --------------------------------------------------------------- */
/* the owner's checkout NAME is read from data/regulations.json and resolved the way engine/regulation.js resolves one
 * (beside the repo, or beside the main checkout when this is a worktree) */
const MB_NAME = ((require(path.join(ROOT, 'data', 'regulations.json')).runtime || {}).regmb || {}).checkout || 'pokemon-showdown';
const MB_PATH = process.env.ABRA_REGMB_SHOWDOWN || [path.join(ROOT, '..', MB_NAME), path.join(ROOT, '..', '..', '..', '..', MB_NAME)]
  .find(p => fs.existsSync(path.join(p, 'dist', 'sim'))) || path.join(ROOT, '..', MB_NAME);
let DMB = null, why = '';
try {
  const simMB = require(path.join(MB_PATH, 'dist', 'sim'));
  DMB = simMB.Dex.forFormat('gen9championsvgc2026regmb');
} catch (e) { why = e.message; }
console.log('\n1. THE CAST, DERIVED THIS RUN');
console.log('     selected: ' + CS.FORMAT + '   owner checkout: ' + MB_PATH + (DMB ? '' : '  (NOT LOADED: ' + why + ')'));
if (!DMB) { console.log('  NOT RUN — the owner regulation\'s checkout could not be loaded, so "changed" cannot be derived.'); process.exit(2); }
const legal = K.legal;
const changed = D.moves.all().filter(m => legal(m)).map(m => ({ m, b: DMB.moves.get(m.id) }))
  .filter(x => x.b && x.b.exists && !x.b.isNonstandard && x.b.pp !== x.m.pp);
console.log('     moves legal in both with a different pp: ' + (changed.map(x => x.m.id + ' ' + x.b.pp + '->' + x.m.pp).join(', ') || '(none)'));
ok(changed.length > 0, 'the derivation found the changed moves (if none, this probe has nothing to ask)');

/* ---- 2. the tag files and pp.js ------------------------------------------------------------------------------------ */
const T_SEL = require(path.join(ROOT, K.REGN.fileFor('data/tags.json')));
/* (the owner's tag file cannot be read from here: under a non-owner regulation the artifact seam answers data/tags.json
 * with the selected regulation's file, by design. The owner's value is checked by the owner's own runs.) */
const PP = require(path.join(ROOT, 'engine', 'pp.js'));
console.log('\n2. WHERE THE ENGINE READS IT');
for (const x of changed) {
  const sel = ((T_SEL.moves[x.m.id] || {}).params || {}).pp || {};
  console.log('     ' + x.m.id.padEnd(14) + ' tag (selected) base ' + sel.base + ' max ' + sel.max + '   authority base ' + x.m.pp
    + ' (owner ' + x.b.pp + ')   pp.js maxPP ' + PP.maxPP(x.m.id));
  ok(sel.base === x.m.pp, x.m.id + ': the selected tag file carries the selected authority\'s base PP, not the owner\'s');
  ok(PP.maxPP(x.m.id) === sel.max, x.m.id + ': engine/pp.js answers the selected regulation\'s maximum');
}

/* ---- 3. the games: every changed move with a learner, run out of PP ---------------------------------------------- */
console.log('\n3. THE GAMES');
const usersOf = id => SPEC.filter(s => learns(s, id) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const ARM = K.ARM;
function runOut(MV) {
  const USERS = usersOf(MV.id);
  console.log('   ' + MV.id + ' learners: ' + (show(USERS) || '(none)'));
  const sel = ((T_SEL.moves[MV.id] || {}).params || {}).pp || {};
  for (const u of USERS) {
    const used = new Set([u.baseSpecies, u.id]);
    const f = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
    if (f.length < 5) continue;
    const A = [mon(u, '', [MV.name, 'Protect'], quiet(u) || undefined), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[2], '', ['Protect'])];
    const B = [mon(f[3], '', ['Protect']), mon(f[4], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[2], '', ['Protect'])];
    const a = G.buildPair(A), b = G.buildPair(B);
    if (!a || !b || a.length !== 4 || b.length !== 4) continue;
    /* as many clicks as the selected maximum (= the authority's own slot maximum, asserted below); partner and foes idle */
    const script = [];
    for (let t = 0; t < sel.max; t++) script.push({ p1: [{ m: MV.id }, P.protect], p2: [P.protect, P.protect] });
    if (G.resetScriptCounters) G.resetScriptCounters();
    const rows = [];
    const r = G.playGame(a, b, 'directed', 'probe_regmc_changed_pp :: ' + MV.id + ' ' + u.id, { script, arm: ARM,
      onBoundary: (snap, ti, S, battle) => {
        const me = S.actA[0], sdb = battle.p1.active[0];
        const slot = sdb && sdb.moveSlots.find(s => s.id === MV.id);
        /* medicham2 derives a slot lazily on its first click (engine/pp.js / ppLeft): an untouched slot IS at its maximum */
        const mediLeft = me && me._pp && (MV.id in me._pp) ? me._pp[MV.id] : (me ? PP.maxPP(MV.id) : null);
        rows.push({ t: ti, sd: slot ? slot.pp : null, sdMax: slot ? slot.maxpp : null, me: mediLeft });
        snap.identical = true; snap.diffs = [];
      } });
    if (r.err) { console.log('   (skip ' + u.id + ': THREW ' + r.err + ')'); continue; }
    const SC = G.scriptCounters();
    if (SC.moveNotOnRequest) { console.log('   (skip ' + u.id + ': ' + SC.moveNotOnRequest + ' click(s) not on the request: ' + SC.firstMissing + ')'); continue; }
    return { u, rows, turns: sel.max, max: sel.max };
  }
  return null;
}
let games = 0;
for (const x of changed) {
  const R = runOut(x.m);
  if (!R) { console.log('   NOT STAGED — no learner of ' + x.m.id + ' could be built with a legal filler.'); continue; }
  games++;
  console.log('   ' + R.u.id + ' clicks ' + x.m.id + ' ' + R.turns + ' times; PP remaining at each boundary [authority / medicham2]:');
  console.log('   ' + R.rows.map(y => 't' + y.t + ' ' + y.sd + '/' + y.me).join('  '));
  const last = R.rows[R.rows.length - 1] || {};
  ok(R.rows.length === R.turns + 1 && R.rows.every(y => y.sd === y.me), x.m.id + ': the PP REMAINING agrees on both engines at every boundary',
    R.rows.filter(y => y.sd !== y.me).map(y => 't' + y.t + ' authority ' + y.sd + ' medicham2 ' + y.me).join('; ') || null);
  ok(last.sd === 0 && last.me === 0, x.m.id + ': after the last click BOTH engines are out (authority ' + last.sd + ', medicham2 ' + last.me + ')');
  ok(R.rows[0] && R.rows[0].sdMax === R.max, x.m.id + ': the authority\'s own slot maximum is the selected tag\'s (' + (R.rows[0] && R.rows[0].sdMax) + ')');
}
ok(games > 0, 'at least one changed move was played out of PP in a real game (' + games + ' of ' + changed.length + ')');
K.finish();
