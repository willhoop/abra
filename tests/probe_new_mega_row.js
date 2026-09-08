#!/usr/bin/env node
/* probe_new_mega_row.js — WOULD A NEW REGULATION'S MEGA GET AN ENGINE ROW, AND WOULD ANYTHING SAY SO?
 *
 * THE SILENT FAILURE THIS STAGES. `engine/merge_mega_into_engine.js:105` skips any forme that is
 * neither in the store nor already in `data/engine-data.js`:
 *
 *     if (!f.in_our_store && !MC.mons[key]) { skipped++; continue; }
 *
 * A mega that arrives with a NEW REGULATION has neither — no games in an M-B store, no existing row.
 * It is skipped into an anonymous counter. `buildMon` opens `if (!m || !m.bs) return null`, so every
 * damage-derived feature then reads ZERO for it: no kill odds, no threat, no risk. That is the
 * 2026-07-30 consequence exactly, when every mega in the game scored as threatening nothing.
 *
 * AND THE AUDIT IS ALIGNED NOT TO SEE IT. `engine/artifact_audit.js` check B restates the builder's
 * own predicate deliberately ("kept in step with merge_mega_into_engine.js") so the builder is judged
 * on the rows it writes — which means the rows the builder SKIPS are excluded from the audit too.
 * Checks A and E only ever walk rows that EXIST. Nothing asks the FORMAT whether a legal `megaStone`
 * forme has no row at all.
 *
 * HOW THE FIXTURE IS BUILT — CONSTRUCTED, NOT FOUND. All 76 legal mega formes have a row today and
 * all 76 are in `data/mega-dex-official.json`, so the state cannot be found in the tree. It is staged
 * in memory, in a CHILD PROCESS, against the REAL audit: one legal mega forme is removed from the
 * artifact table (via `mcKey.rawTable`) AND from the mega source (via one `fs.readFileSync`
 * intercept). Nothing on disk is touched by either arm. What is left is exactly the M-C shape — a
 * forme the FORMAT calls legal, with no source row and no artifact row.
 *
 * THE FORME IS DERIVED, NEVER TYPED: the lowest-usage legal mega in `data/smogon-priors.json`, so the
 * removal moves the usage-weighted lines in the audit as little as possible.
 *
 *   node tests/probe_new_mega_row.js          both arms + verdict
 *   node tests/probe_new_mega_row.js --child <forme>   one doctored audit run (used by the parent)
 *
 * RED means the audit finished with NO GAP naming the forme: the hole is invisible.
 * GREEN means the audit named it. Exit code: 0 when the doctored arm is caught, 1 when it is not.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* ---- the forme to remove, derived from the format and the usage file ------------------------- */
function pickForme() {
  const CS = require(D('engine', 'champions_sim.js'));
  const dex = CS.dexFor(CS.FORMAT);
  const USAGE = (JSON.parse(fs.readFileSync(D('data', 'smogon-priors.json'), 'utf8')) || {}).species || {};
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawOf = k => { const v = USAGE[k] || USAGE[norm(k)]; return v && v.raw > 0 ? v.raw : 0; };
  const formes = [];
  for (const it of dex.items.all()) {
    if (!it.exists || it.isNonstandard || !it.megaStone) continue;
    for (const m of Object.values(it.megaStone)) {
      const sp = dex.species.get(m);
      if (sp && sp.exists) formes.push(sp.name);
    }
  }
  formes.sort((a, b) => (rawOf(a) - rawOf(b)) || a.localeCompare(b));
  return { forme: formes[0], count: formes.length };
}

/* ---- CHILD: stage the missing row and run the REAL audit ------------------------------------- */
if (process.argv.includes('--child')) {
  const forme = process.argv[process.argv.indexOf('--child') + 1];
  if (!forme) { console.error('probe: --child needs a forme name'); process.exit(2); }
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(forme);

  /* 1. the artifact row disappears. Patched on the exported object, so the audit's own
   *    `mcKey.rawTable(...)` call gets the doctored table and every other reader is untouched. */
  const MK = require(D('engine', 'mc_key.js'));
  const orig = MK.mcKey.rawTable;
  const patched = (why) => {
    const t = orig(why) || {};
    const out = {};
    for (const k of Object.keys(t)) if (norm(k) !== target) out[k] = t[k];
    return out;
  };
  patched.reasons = orig.reasons;
  MK.mcKey.rawTable = patched;

  /* 2. the mega SOURCE row disappears too — a genuinely new mega is in neither file. One path is
   *    intercepted by name; every other read goes through untouched. */
  const MEGA_SRC = D('data', 'mega-dex-official.json');
  const realRead = fs.readFileSync;
  fs.readFileSync = function (p, ...rest) {
    const text = realRead.call(fs, p, ...rest);
    if (typeof p === 'string' && path.resolve(p) === MEGA_SRC && typeof text === 'string') {
      const j = JSON.parse(text);
      for (const k of Object.keys(j.forms || {})) {
        if (norm(k) === target || norm((j.forms[k] || {}).name) === target) delete j.forms[k];
      }
      return JSON.stringify(j);
    }
    return text;
  };

  console.log(`[probe] staged: "${forme}" is LEGAL in ${require(D('engine', 'champions_sim.js')).FORMAT}, `
    + 'and has no artifact row and no source row.\n');
  require(D('engine', 'artifact_audit.js'));   // runs and exits with its own code
  return;
}

/* ---- PARENT: run the doctored arm and the control ------------------------------------------- */
const { spawnSync } = require('child_process');
const { forme, count } = pickForme();
console.log(`PROBE — a legal mega forme with no engine row (${count} legal mega formes in this format)`);
console.log(`  staging the removal of: ${forme}\n`);

function arm(label, argv) {
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const gapLines = out.split('\n').filter(l => /^\s*GAP\s/.test(l));
  const named = gapLines.filter(l => l.toLowerCase().includes(forme.toLowerCase()));
  console.log(`  ${label}: exit ${r.status}, ${gapLines.length} GAP line(s), ` +
    `${named.length} of them naming ${forme}`);
  for (const l of named.slice(0, 3)) console.log('      ' + l.trim());
  return { status: r.status, gapLines, named, out };
}

/* The control is the audit itself, not this probe with the patches off — so a bug in the staging
 * cannot make both arms agree for the wrong reason. */
const doctored = arm('MISSING ROW ', [__filename, '--child', forme]);
const control = arm('REAL ARTIFACT', [D('engine', 'artifact_audit.js')]);

console.log('');
const caught = doctored.named.length > 0 && doctored.status !== 0;
if (!caught) {
  console.log(`RED — the audit finished with no GAP naming ${forme}. A legal mega forme with no row`);
  console.log('      is invisible: buildMon returns null on !m.bs and every damage-derived feature');
  console.log('      reads zero, with nothing reporting it.');
} else {
  console.log(`GREEN — the audit REFUSED: it named ${forme} and exited ${doctored.status}.`);
}
if (control.status !== 0) {
  console.log('CONTROL FAILED — the undoctored audit is not clean, so this arm proves nothing about');
  console.log('      the staged row. Fix the audit first.');
}
process.exit(caught && control.status === 0 ? 0 : 1);
