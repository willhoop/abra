/* test-policy-promote.js — the promote step is a GATE, so it must be able to refuse.
 *
 * WHY IT EXISTS. `data/move-priors.json` is one of the 26 files engine/engine_release.js freezes as
 * an engine SOURCE, and a six-hourly GitHub Action used to rewrite it. It genuinely changes a board:
 * engine/set_priors.js `movePriors()` -> `sampleMoves()` is called from engine/champions_sim.js
 * inside `packTeam()` and decides which moves an unrevealed set is filled with, on the team the
 * Showdown reference engine plays. On 2026-08-22 that collision cost two measurements in four hours.
 *
 * The fix moved the scheduled derivation to `data/move-priors.observed.json` and put an explicit
 * `engine/policy.js --promote` in front of the engine's copy. THAT ONLY HELPS IF THE PROMOTE CAN SAY
 * NO. A promote that always succeeds is the cron with a longer command line, so every arm below is a
 * way the observed file can be well-formed and still destroy the table nothing would report.
 *
 * SHOWN RED BEFORE BEING TRUSTED, 2026-08-22: with the `if (!spN) refuse(...)` blank guard deleted
 * from engine/policy.js this file reports "A BLANK OBSERVED FILE WAS PROMOTED" and the engine's
 * priors are gone; with the shrink band deleted it reports the truncated-store arm. See
 * docs/_reports/2026-08-22-promote-step.md.
 *
 * NO POKEMON NAME IS TYPED HERE. Every fixture is built by mutating a copy of the real derived
 * artifact, so the species in it are whatever the store actually observed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const POLICY = path.join(ROOT, 'engine', 'policy.js');
const REAL = path.join(ROOT, 'data', 'move-priors.json');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ingest.yml');

let pass = 0, fail = 0;
const ok  = (m) => { console.log('  ok    ' + m); pass++; };
const bad = (m) => { console.log('  FAIL  ' + m); fail++; };

console.log('POLICY PROMOTE');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-promote-'));
const p = (n) => path.join(TMP, n);
const write = (n, o) => { const f = p(n); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };

function promote(from, to, ...extra) {
  const r = spawnSync(process.execPath, [POLICY, '--promote', '--from', from, '--to', to, ...extra],
                      { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/* ---- the fixture, derived from the real artifact rather than typed ---------------------------- */
let base = null;
try { base = JSON.parse(fs.readFileSync(REAL, 'utf8')); } catch (e) { /* reported below */ }
if (!base || !base.species || Object.keys(base.species).length < 3) {
  console.log('  FAIL  data/move-priors.json is missing or too small to build a fixture from');
  console.log('\nPOLICY PROMOTE: 0 passed, 1 failed');
  process.exit(1);
}
const names = Object.keys(base.species);
const clone = (o) => JSON.parse(JSON.stringify(o));

/* CANONICAL: the engine's current table. OBSERVED: the same table with three deliberate, named
 * changes — a pool removal, a probability move, and a modal flip — so the delta print has something
 * true to say and the test can assert it said it. */
const canon = clone(base);
const obs = clone(base);
const POOL_SP = names.find(s => (base.species[s].moves || []).length >= 3);
const PROB_SP = names.find(s => s !== POOL_SP && (base.species[s].moves || []).length >= 2);
const FLIP_SP = names.find(s => s !== POOL_SP && s !== PROB_SP && (base.species[s].moves || []).length >= 2
                            && base.species[s].moves[0].mv !== base.species[s].moves[1].mv);
const DROPPED = obs.species[POOL_SP].moves[obs.species[POOL_SP].moves.length - 1].mv;
obs.species[POOL_SP].moves.pop();                                   // a pool REMOVAL
obs.species[PROB_SP].moves[0].p = +(obs.species[PROB_SP].moves[0].p + 0.05).toFixed(3);
obs.species[FLIP_SP].moves.reverse();                               // a MODAL flip
const flipTo = obs.species[FLIP_SP].moves[0].mv;                    // whatever reversing put on top

const CANON = write('canon.json', canon);
const OBS = write('obs.json', obs);

/* ---- 1. the refusals: every one of these must NOT land ---------------------------------------- */

{ /* a. no observed file at all */
  const before = fs.readFileSync(CANON, 'utf8');
  const r = promote(p('does-not-exist.json'), CANON);
  if (r.code === 0) bad('A MISSING OBSERVED FILE WAS PROMOTED — the engine table would be overwritten by nothing');
  else if (fs.readFileSync(CANON, 'utf8') !== before) bad('the canonical table was touched while refusing a missing file');
  else if (!/REFUSED.*does not exist/s.test(r.out)) bad('refused a missing observed file, but not by NAMING it missing: ' + r.out.slice(0, 300));
  else ok('a missing observed file is refused, exit ' + r.code + ', canonical untouched');
}

/* EACH ARM ASSERTS THE REASON, NOT JUST A NON-ZERO EXIT — and that distinction is measured, not
 * assumed. With every explicit refusal deleted, the shrink band alone still exited non-zero on the
 * blank, the unparsable and the zero-cell fixtures (2026-08-22), so an arm testing only the exit
 * code would have stayed GREEN with its own guard gone. A guard that another guard can cover for is
 * a guard nothing pins. */
{ /* b. not JSON at all */
  const f = write('garbage.json', '{"species": {tru');
  const r = promote(f, CANON);
  if (r.code === 0) bad('UNPARSABLE JSON WAS PROMOTED');
  else if (!/not valid JSON/.test(r.out)) bad('unparsable JSON refused for the wrong reason: ' + r.out.slice(0, 200));
  else ok('unparsable JSON is refused as unparsable, exit ' + r.code);
}

{ /* c. well-formed JSON that is not a behaviour clone */
  const f = write('notaclone.json', { generated: '2026-01-01', rows: [] });
  const r = promote(f, CANON);
  if (r.code === 0) bad('A FILE WITH NO species OBJECT WAS PROMOTED');
  else if (!/no `species` object/.test(r.out)) bad('refused for the wrong reason: ' + r.out.slice(0, 200));
  else ok('JSON with no `species` object is refused as not a behaviour clone, exit ' + r.code);
}

{ /* d. THE ONE THAT COSTS THE MOST: an empty but perfectly valid table. Every unrevealed set would
     * be filled from nothing, and nothing anywhere would throw. */
  const before = fs.readFileSync(CANON, 'utf8');
  const f = write('blank.json', { generated: '2026-01-01', species: {} });
  const r = promote(f, CANON);
  if (r.code === 0) bad('A BLANK OBSERVED FILE WAS PROMOTED — fillSet would draw from an empty pool');
  else if (fs.readFileSync(CANON, 'utf8') !== before) bad('the canonical table was blanked while refusing');
  /* the phrase, not "0 species": the zero-CELL guard's message also contains "0 species" when the
     table is empty, so the looser match let the blank guard be deleted and stay green (measured). */
  else if (!/BLANK the engine/.test(r.out)) bad('a blank table was refused, but not by the blank guard: ' + r.out.slice(0, 200));
  else ok('a blank species table is refused for being blank, exit ' + r.code + ', canonical untouched');
}

{ /* e. species present, every move list empty — blank in the direction that matters */
  const z = clone(base);
  for (const s of Object.keys(z.species)) { z.species[s].moves = []; z.species[s].lead = []; }
  const f = write('nocells.json', z);
  const r = promote(f, CANON);
  if (r.code === 0) bad('A TABLE WITH ZERO MOVE CELLS WAS PROMOTED — the candidate pool would be empty');
  /* again the phrase and not the digits: the CELL SHRINK band's message also says "0 move cells"
     here, so a looser match let this guard be deleted and stay green (measured 2026-08-22). */
  else if (!/blank the candidate pool/.test(r.out)) bad('zero move cells refused, but not by the zero-cell guard: ' + r.out.slice(0, 200));
  else ok('zero move cells is refused as an empty candidate pool, exit ' + r.code);
}

{ /* f. a truncated store: the shape a half-finished ingest actually has */
  const before = fs.readFileSync(CANON, 'utf8');
  const few = { generated: '2026-01-01', species: {} };
  for (const s of names.slice(0, Math.floor(names.length * 0.1))) few.species[s] = clone(base.species[s]);
  const f = write('truncated.json', few);
  const r = promote(f, CANON);
  if (r.code === 0) bad('A TABLE MISSING 90% OF THE LADDER WAS PROMOTED');
  else if (fs.readFileSync(CANON, 'utf8') !== before) bad('the canonical table moved while refusing a truncated file');
  else if (!/bound/.test(r.out)) bad('refused the truncated file without naming the bound: ' + r.out.slice(0, 200));
  else ok('a >20% species shrink is refused, exit ' + r.code + ', canonical untouched');

  /* and the escape hatch works, loudly, because a refusal with no override is a rule nobody can
   * follow on the day the ladder really does collapse */
  const g = promote(f, write('canon-forced.json', canon), '--force');
  if (g.code !== 0) bad('--force could not override the shrink refusal (exit ' + g.code + ')');
  else if (!/FORCED PAST A REFUSAL/.test(g.out)) bad('--force overrode silently — an override nobody can see is not a decision');
  else ok('--force overrides the shrink band and says so in the output');
}

/* ---- 2. the promote itself, and what it must PRINT -------------------------------------------- */

{ /* dry run: the delta is printed and nothing is written */
  const before = fs.readFileSync(CANON, 'utf8');
  const r = promote(OBS, CANON, '--dry-run');
  if (r.code !== 0) bad('a valid dry run exited ' + r.code + ': ' + r.out.slice(0, 300));
  else if (fs.readFileSync(CANON, 'utf8') !== before) bad('--dry-run WROTE the canonical table');
  else if (!/DRY RUN/.test(r.out)) bad('--dry-run did not say so');
  else ok('--dry-run prints and writes nothing');

  /* THE POINT OF THE WHOLE STEP: it must say what would change, in the units the readers consume. */
  const missing = [];
  for (const [what, re] of [
    ['species changed',      /species changed\s+\d+ of \d+/],
    ['move cells changed',   /move cells changed\s+\d+ of \d+/],
    ['pool membership',      /POOL membership changed\s+\d+ cells/],
    ['modal flip count',     /MODAL move flipped\s+\d+/],
    ['protectOdds',          /protectOdds moved\s+\d+ species/],
    ['mean/max magnitude',   /mean \|delta\| over changed\s+[\d.]+\s+max\s+[\d.]+/],
    ['the dropped move by name',   new RegExp('-' + DROPPED + '\\b')],
    ['the pool species by name',   new RegExp('\\b' + POOL_SP + '\\b')],
    ['the modal flip by name',     new RegExp('\\b' + FLIP_SP + '\\b.*-> ' + flipTo)],
  ]) if (!re.test(r.out)) missing.push(what);
  if (missing.length) bad('the delta print omits: ' + missing.join(', ') + '\n' + r.out);
  else ok('the delta names the pool change, the modal flip and the magnitudes — not just "updated"');
}

{ /* the real thing */
  const target = write('canon-live.json', canon);
  const r = promote(OBS, target);
  if (r.code !== 0) bad('a valid promote exited ' + r.code + ': ' + r.out.slice(0, 300));
  else if (fs.readFileSync(target, 'utf8') !== fs.readFileSync(OBS, 'utf8'))
    bad('promote reported success and the canonical bytes are NOT the observed bytes');
  else ok('a valid promote lands the observed bytes exactly');

  /* idempotent: promoting the same bytes twice must not rewrite the file, because an mtime move on
     an engine source is a re-cut nobody asked for */
  const mt = fs.statSync(target).mtimeMs;
  const again = promote(OBS, target);
  if (again.code !== 0) bad('a repeat promote failed: ' + again.out.slice(0, 200));
  else if (!/NO CHANGE/.test(again.out)) bad('a repeat promote did not report NO CHANGE');
  else if (fs.statSync(target).mtimeMs !== mt) bad('a no-op promote still rewrote the file and moved its mtime');
  else ok('promoting identical bytes is a no-op and does not touch the file');
}

/* ---- 3. the ratchet: the scheduler must not be able to write the engine source again ---------- */

{
  let wf = null;
  try { wf = fs.readFileSync(WORKFLOW, 'utf8'); } catch (e) { bad('cannot read .github/workflows/ingest.yml: ' + e.message); }
  if (wf) {
    const calls = wf.split(/\r?\n/).filter(l => /engine\/policy\.js/.test(l) && !/^\s*#/.test(l));
    if (!calls.length) bad('the ingest workflow no longer derives the behaviour priors at all');
    else if (calls.some(l => /data\/move-priors\.json(?!\w)/.test(l)))
      bad('THE SCHEDULER WRITES THE FROZEN ENGINE SOURCE AGAIN: ' + calls.find(l => /data\/move-priors\.json(?!\w)/.test(l)).trim());
    else if (!calls.every(l => /data\/move-priors\.observed\.json/.test(l)))
      bad('an ingest policy.js call writes somewhere other than the observed table: ' + calls.map(l => l.trim()).join(' | '));
    else ok('both ingest policy.js calls write data/move-priors.observed.json, never the engine source');

    /* AND THE RUN MUST STILL COMMIT WHAT IT DERIVED. This is the dangerous half of the change: a
       `git add` naming a path that does not exist exits 1 under `bash -e` and the commit never
       happens, which is exactly how this workflow died for 24 days. The staging list is extracted
       from the workflow text and RUN, rather than read. */
    const fnm = wf.match(/^([ \t]*)add_artifacts\(\)\s*\{[\s\S]*?^\1\}/m);
    if (!fnm) bad('cannot find the add_artifacts staging list in the workflow');
    else {
      const dedent = fnm[0].split(/\r?\n/).map(l => l.replace(new RegExp('^' + fnm[1]), '')).join('\n');
      const paths = (dedent.match(/(?:data|docs|web|build)\/[\w.\-/]+/g) || []);
      const calls = (wf.match(/^\s*add_artifacts\s*$/gm) || []).length;
      if (!paths.includes('data/move-priors.observed.json')) bad('the observed table is not in the staging list');
      else if (paths.length < 9) bad('the staging list has only ' + paths.length + ' artifacts; it had nine');
      else if (calls < 2) bad('the staging list is invoked ' + calls + ' time(s); the workflow commits twice (initial + reconcile)');
      else ok('the staging list holds ' + paths.length + ' artifacts incl. the observed table, invoked ' + calls + '×');

      /* run it for real in a throwaway repo, once with everything present and once with the new
         path missing — the second is the case that would kill the run */
      const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
      if (!bash.stdout || !/ok/.test(bash.stdout)) {
        console.log('  SKIP  staging simulation — no bash on this machine, and the step is a bash block');
      } else {
        const NEW = 'data/move-priors.observed.json';
        const script = 'set -eu\n' + dedent + '\nadd_artifacts\necho "STAGED:"; git diff --cached --name-only\n';
        /* A FRESH RUNNER EVERY TIME. The workflow checks out clean, so each case gets its own repo
           rather than inheriting the previous case's index — which is not a detail: `git add` on a
           path that is missing behaves DIFFERENTLY depending on whether the index already knows it
           (pathspec error vs staging a deletion), and re-using one repo silently tested only the
           second. */
        const stage = (omit, track) => {
          const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-ingest-'));
          for (const rel of paths) {
            if (rel === omit && !track) continue;
            fs.mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(repo, rel), 'x');
          }
          const sh = (s) => spawnSync('bash', ['-c', s], { cwd: repo, encoding: 'utf8' });
          sh('git init -q . && git config user.email a@b.c && git config user.name a');
          if (track) { sh('git add -A && git commit -q -m base'); fs.rmSync(path.join(repo, omit)); }
          const r = sh(script);
          try { fs.rmSync(repo, { recursive: true, force: true }); } catch (e) {}
          return { code: r.status, out: (r.stdout || ''), err: (r.stderr || ''),
                   staged: ((r.stdout || '').split('STAGED:')[1] || '').trim().split(/\r?\n/).filter(Boolean) };
        };

        const a = stage(null, false);
        if (a.code !== 0) bad('the staging block itself failed: ' + a.err.slice(0, 300));
        else if (!a.staged.includes(NEW)) bad('the observed table was NOT staged by the real block');
        else if (a.staged.length !== paths.length) bad('staged ' + a.staged.length + ' of ' + paths.length + ' artifacts');
        else ok('the workflow\'s own staging block stages all ' + paths.length + ' artifacts, observed table included');

        /* CASE 1 — THE 24-DAY FAILURE, EXACTLY: a path in the list that is not on disk and not in
           the index. `git add` exits 1, the step runs under `bash -e`, and NOTHING is committed —
           silently, because every derivation above is continue-on-error. */
        const b = stage(NEW, false);
        if (b.code !== 0) bad('AN UNPRODUCED ARTIFACT ABORTS THE COMMIT STEP — this is the 24-day failure again: ' + b.err.slice(0, 200));
        else if (!/::warning::/.test(b.out)) bad('an unproduced artifact was skipped SILENTLY; it must warn');
        else if (!b.staged.some(f => /games\.ladder\.jsonl\.gz/.test(f)))
          bad('an unproduced artifact stopped the store being staged — the run would ship nothing');
        else ok('an unproduced artifact warns, the other ' + b.staged.length + ' still stage — the ingest cannot die on this');

        /* CASE 2 — the same path once it IS tracked and a run fails to produce it. `git add` then
           succeeds and stages a DELETION, so a failed derivation would commit the artifact's
           removal. Staging nothing is the correct answer; deleting it is not. */
        const c = stage(NEW, true);
        if (c.code !== 0) bad('a tracked-but-missing artifact aborted the commit step: ' + c.err.slice(0, 200));
        else if (c.staged.includes(NEW)) bad('A FAILED DERIVATION WOULD COMMIT THE DELETION of ' + NEW);
        else ok('a tracked artifact a run failed to produce is warned about, not deleted');
      }
    }
  }
}

/* the derivation's own default must be the observed path — a positional default is what the cron
   inherits if someone ever drops the explicit argument */
{
  const src = fs.readFileSync(POLICY, 'utf8');
  /* the LITERAL, not the identifier: engine/provenance.js attributes a generator by finding the
     artifact's name bound to something it writes, and `POS[1] || OBSERVED` put the observed table in
     the "no generator" bucket, which is exempt from every corpus check there (measured 2026-08-22). */
  if (!/const\s*OUT\s*=\s*POS\[1\]\s*\|\|\s*path\.join\([^)]*move-priors\.observed\.json/.test(src))
    bad('engine/policy.js no longer defaults its derivation output to the observed table');
  else ok('a bare `node engine/policy.js` writes the observed table, not the engine source');
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

console.log('\nPOLICY PROMOTE: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
