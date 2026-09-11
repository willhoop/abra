#!/usr/bin/env node
/* tests/probe_differential_cause_context.js — ROADMAP #375.
 * ==================================================================================================
 * CAN EVERY DIVERGENCE CAUSE IN data/game-differential.json BE ATTRIBUTED FROM THE ARTIFACT ALONE?
 *
 * The row's three asks, each checked against the committed artifact, per distinct cause:
 *   (1) CONTEXT — the preceding authority lines AND the lines after the divergence on both sides
 *       (`showdown_before`, `sdAfter`, `meAfter`, or any key of that meaning) are published for the
 *       cause, on the cause row or on a first-divergence entry carrying the same cause string.
 *   (2) ATTRIBUTION — the body's SPECIES and the stripped `[from]`/`[of]` attribution sit beside the
 *       cause, so the normaliser can stay lossy for the comparison and lossless for triage.
 *   (3) TIE COUNTERS — `entryOrderTie` and `replaceOrderTie` appear in the artifact, so a declared
 *       switch-order tie can be told from an ordering defect.
 *
 * AND THE CAP, WHICH IS STRUCTURAL AND LABELLED SO. `first_divergences` is sliced to 60 and
 * `first_board_divergences` to 40 in engine/game_differential.js. With one divergence in today's
 * pool the cap cannot bite, so its presence is printed from the writer's source as context and is
 * NOT a cell; the cells are (1)-(3), which do not depend on how many games diverged.
 *
 * READ FROM `git show HEAD:` (a live differential run beside this probe would otherwise hand it a torn
 * read). PLANT: `--artifact <path>` reads a re-run's output. EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
let raw;
try {
  raw = arg('--artifact') ? fs.readFileSync(arg('--artifact'), 'utf8')
    : execFileSync('git', ['show', 'HEAD:data/game-differential.json'], { cwd: ROOT, maxBuffer: 1 << 30 }).toString();
} catch (e) { cannot('the differential artifact is unreadable: ' + e.message); }
const g = JSON.parse(raw);
const causes = [];
for (const c of g.classes || []) for (const k of c.causes || []) causes.push({ cls: c.cls, ...k });
console.log('\ntests/probe_differential_cause_context.js — ROADMAP #375');
console.log('  artifact ' + (arg('--artifact') || 'HEAD:data/game-differential.json') + '   release ' + g.engine_release
  + '   generated ' + g.generated + '   games ' + g.games + '   diverged ' + g.diverged);
if (!causes.length) cannot('the artifact carries no divergence cause, so there is nothing to attribute — not a pass');

const fd = g.first_divergences || [];
const has = (o, re) => !!o && Object.keys(o).some(k => re.test(k) && o[k] != null && !(Array.isArray(o[k]) && !o[k].length));
const BEFORE = /^(showdown_before|sd_?before|before)$/i, SD_AFTER = /^(sdAfter|showdown_after|sd_after)$/i, ME_AFTER = /^(meAfter|medicham_after|me_after)$/i;
const SPECIES = /species|^body$/i, ATTR = /attribution|^from$|^of$|from_of|stripped/i;

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const miss1 = [], miss2 = [];
for (const k of causes) {
  const e = fd.find(x => x.cause === k.cause);
  const ctx = [BEFORE, SD_AFTER, ME_AFTER].map(re => has(k, re) || has(e, re));
  if (ctx.includes(false)) miss1.push({ k, ctx, carried: !!e });
  const att = [SPECIES, ATTR].map(re => has(k, re) || has(e, re));
  if (att.includes(false)) miss2.push({ k, att, mentions: (k.mentions || []).length });
}
console.log('\n  ' + causes.length + ' distinct cause(s); first_divergences carries ' + fd.length + ' entr' + (fd.length === 1 ? 'y' : 'ies'));
ok(miss1.length === 0, '(1) every cause publishes its preceding lines and both engines\' following lines',
   miss1.length ? miss1.length + ' of ' + causes.length + ' cause(s) lack context; first cell: `' + miss1[0].k.cause
     + '` — before/sdAfter/meAfter = ' + miss1[0].ctx.join('/') + (miss1[0].carried ? ' (it IS in first_divergences)' : ' (not in first_divergences at all)') : null);
ok(miss2.length === 0, '(2) every cause carries the body\'s species and the stripped [from]/[of] attribution',
   miss2.length ? miss2.length + ' of ' + causes.length + ' cause(s) lack it; first cell: `' + miss2[0].k.cause
     + '` — species/attribution = ' + miss2[0].att.join('/') + ', mentions ' + miss2[0].mentions : null);
const tie = ['entryOrderTie', 'replaceOrderTie'].map(n => [n, raw.includes(n)]);
ok(tie.every(([, v]) => v), '(3) the artifact publishes MEDFAILS.entryOrderTie and replaceOrderTie',
   tie.every(([, v]) => v) ? null : 'cell: absent from the artifact: ' + tie.filter(([, v]) => !v).map(([n]) => n).join(', '));

/* the cap, as context */
try {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'game_differential.js'), 'utf8').split('\n');
  const caps = src.map((l, i) => [i + 1, l]).filter(([, l]) => /(first_divergences|first_board_divergences):.*\.slice\(0,\s*\d+\)/.test(l));
  console.log('\n  STRUCTURAL CONTEXT (not a cell): the writer caps the samples at');
  for (const [n, l] of caps) console.log('      engine/game_differential.js:' + n + '  ' + l.trim().slice(0, 100));
  console.log('      no bite today: ' + g.diverged + ' diverged game(s) against caps of 60 / 40');
} catch (e) { console.log('  (could not read the writer for the cap context: ' + e.message + ')'); }

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
