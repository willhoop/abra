#!/usr/bin/env node
/* tests/probe_census_reproduces.js — ROADMAP #442.
 * ABRA-HEAP: 6144
 * ==================================================================================================
 * DOES THE COMMITTED TREE REPRODUCE THE COMMITTED CENSUS?
 *
 * A census was committed claiming 674 live while its own tree measured 673: the probe landed and the
 * one-line engine edit it described did not. A knob run (`MEDI_*=1`) that writes the census is the
 * same failure from the other side. Nothing compares the committed artifact with what the committed
 * tree produces, so this does:
 *
 *   1. `git archive HEAD` of engine/, tests/, tools/ and data/ (minus releases, verification and the
 *      game stores) into a fresh temp directory — the COMMITTED bytes, never the working tree, which
 *      an agent may be editing.
 *   2. `node tests/test-mechanics.js` inside that directory, so it writes ITS OWN
 *      data/mechanics-census.json there and nothing in the repository moves.
 *   3. Compare with `git show HEAD:data/mechanics-census.json`: live, probed, missing, and every row's
 *      (kind, tag, label) -> live. Timestamps and write-policy stamps are not compared.
 *
 * HEAVY: it plays every census probe (the whole test-mechanics.js). The brief that wrote it forbade a
 * census run, so it was written and NOT run; `--dry` checks the preconditions only.
 * THE CONTROL is the comparison itself: `--plant` flips one row of the regenerated census before the
 * compare and must turn a clean run red.
 * EXIT: 0 reproduces / 1 differs / 2 cannot answer (including --dry).
 *
 * EITHER REGULATION -- 2026-09-24 (MEASURE, abra/regmc). The first form of this probe forced the child's
 * SHOWDOWN_PATH to Reg M-B's checkout and compared `data/mechanics-census.json` by that literal name. Under
 * `ABRA_REGULATION=regmc` the child census therefore ran against M-B's authority, and the probe read the
 * M-B census copy out of the temp tree, found the committed timestamp and declared CANNOT ANSWER. The
 * census is now `artifactFor('data/mechanics-census.json')` -- the one answer to "which file does this
 * regulation's measurement write" -- and the child inherits the checkout `engine/showdown_path.js`
 * resolved for the SELECTED regulation plus that selection. Under Reg M-B both resolve as before.
 *
 * AND IT SAYS WHICH WAY THE CENSUS IS WRONG. An OVERCLAIM (a committed row the tree reads missing, or a
 * committed row the tree no longer has) is this row's defect: a published count the engine cannot earn.
 * An UNDERCLAIM ONLY (rows the tree probes that the committed census has not caught up with, every
 * committed row reproducing) is a stale artifact. Both are RED -- both are a published census its own
 * tree does not reproduce -- and the class is printed so nobody has to work it out from the row list.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
/* The regulation first: it decides the checkout (showdown_path.js reads it) and the census's name. */
const REG = require(path.join(ROOT, 'engine', 'regulation.js'));
const SD = require(path.join(ROOT, 'engine', 'showdown_path.js'));
const CENSUS_REL = REG.artifactFor('data/mechanics-census.json');
const has = n => process.argv.includes(n);
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const git = (args, opt) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30, ...(opt || {}) });

console.log('\ntests/probe_census_reproduces.js — ROADMAP #442');
let head, headSha;
try { headSha = git(['rev-parse', '--short=12', 'HEAD']).toString().trim(); head = JSON.parse(git(['show', 'HEAD:' + CENSUS_REL]).toString()); }
catch (e) { cannot('HEAD:' + CENSUS_REL + ' unreadable: ' + e.message); }
console.log('  regulation ' + REG.ID + ' (' + REG.SOURCE + '), authority ' + (SD.RESOLVED || '(none)') + ', census ' + CENSUS_REL);
if (!SD.hasSim()) cannot('no Showdown checkout for regulation ' + REG.ID + ' (candidates: ' + SD.CANDIDATES.join(', ') + ')');
console.log('  committed census at ' + headSha + ': live ' + head.live + ', probed ' + head.probed + ', missing ' + head.missing + ', generated ' + head.generated);
if (has('--dry')) cannot('--dry: preconditions hold (git, HEAD census). The regeneration was not run.');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-442-'));
const tarPath = path.join(TMP, 'head.tar');
try {
  git(['archive', '--format=tar', '-o', tarPath, 'HEAD', '--', 'engine', 'tests', 'tools', 'data', 'package.json',
       ':(exclude)data/releases', ':(exclude)data/verification', ':(glob,exclude)data/**/*.jsonl', ':(glob,exclude)data/**/*.gz']);
  const tree = path.join(TMP, 'tree'); fs.mkdirSync(tree);
  /* RELATIVE PATHS, FROM INSIDE TMP — 2026-09-11 (ENGINE). The first registered run refused with
   * `tar -xf C:\...\head.tar` failing: Git Bash's GNU tar reads `C:` as a REMOTE HOST (`host:path`), so an
   * absolute Windows path cannot be extracted at all. Relative names from `cwd: TMP` mean the same file to
   * GNU tar and to Windows' bsdtar alike. The refusal was honest (exit 2); this makes the probe answerable. */
  execFileSync('tar', ['-xf', 'head.tar', '-C', 'tree'], { cwd: TMP });
} catch (e) { cannot('could not extract HEAD into ' + TMP + ': ' + e.message); }
const tree = path.join(TMP, 'tree');
const t0 = Date.now();
const r = spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(tree, 'tests', 'test-mechanics.js')],
  { cwd: tree, encoding: 'utf8', timeout: 3600000, maxBuffer: 1 << 28,
    env: { ...process.env, SHOWDOWN_PATH: SD.RESOLVED, ...(REG.ARTIFACT_TAG || REG.EXPLICIT ? { ABRA_REGULATION: REG.ID } : {}) } });
/* An unreadable regenerated census is REPORTED on the refusal line, never absorbed (#258/#409). */
let regen = null, regenErr = null;
try { regen = JSON.parse(fs.readFileSync(path.join(tree, ...CENSUS_REL.split('/')), 'utf8')); } catch (e) { regenErr = e.message; }
console.log('  regenerated in ' + Math.round((Date.now() - t0) / 1000) + 's, test-mechanics exit ' + r.status);
if (!regen || regen.generated === head.generated)
  cannot('the committed tree did not write a fresh census (' + (regenErr ? 'census unreadable: ' + regenErr + ' | ' : '')
    + ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-3).join(' | ') + ')');
if (has('--plant') && regen.results && regen.results.length) { regen.results[0].live = !regen.results[0].live; console.log('  --plant: row 0 flipped'); }

const key = x => x.kind + '|' + x.tag + '|' + x.label;
const A = new Map((head.results || []).map(x => [key(x), !!x.live]));
const B = new Map((regen.results || []).map(x => [key(x), !!x.live]));
const diffs = [];
for (const f of ['live', 'probed', 'missing']) if (head[f] !== regen[f]) diffs.push(f + ': committed ' + head[f] + ', reproduced ' + regen[f]);
for (const [k, v] of A) if (!B.has(k)) diffs.push('row only in the committed census: ' + k); else if (B.get(k) !== v) diffs.push('row flips: ' + k + ' committed ' + v + ', reproduced ' + B.get(k));
for (const k of B.keys()) if (!A.has(k)) diffs.push('row only in the reproduced census: ' + k);
/* the class: OVER = the committed census claims something the tree does not give (#442's shape) */
let over = 0, under = 0;
for (const [k, v] of A) { if (!B.has(k) || (v && !B.get(k))) over++; else if (!v && B.get(k)) under++; }
for (const k of B.keys()) if (!A.has(k)) under++;
if (head.live > regen.live) over++;
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + TMP + ')'); }

console.log('  ' + (diffs.length ? 'FAIL' : 'ok  ') + '  the committed tree reproduces the committed census');
for (const d of diffs.slice(0, 20)) console.log('          ' + d);
if (diffs.length) console.log('  class: ' + (over
  ? 'OVERCLAIM — the committed census claims ' + over + ' thing(s) its own tree does not give (the #442 shape)'
  : 'UNDERCLAIM ONLY — every committed row reproduces with the same verdict; the committed census is STALE by ' + under + ' row(s) the tree now probes'));
console.log('\n' + (diffs.length ? 'RED — ' + diffs.length + ' difference(s)' : 'GREEN'));
console.log('ABRA-EXIT ' + (diffs.length ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(diffs.length ? 1 : 0);
