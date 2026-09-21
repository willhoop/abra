/* test-knob-control-arm.js — A KNOB THAT SILENCES ITS OWN PROBE PROVES NOTHING.
 *
 * THE DEFECT THIS EXISTS FOR, measured 2026-09-19 across tests/. A probe that restores a defect
 * behind `MEDI_<KNOB>=1` normally re-runs ITSELF with the knob set, as a control arm that asserts
 * nothing and must exit 0. Seventeen of them keyed that quiet arm on **the knob variable itself**:
 *
 *     const CHILD = process.env.MEDI_SMART_TARGET_SURVIVES_REDIRECT === '1';
 *     ...
 *     if (CHILD) { console.log('CONTROL ARM — asserts nothing'); process.exit(0); }
 *
 * Set the knob from OUTSIDE and the probe takes the quiet path too, so it **exits 0 against a
 * deliberately broken engine**. From the outside that is indistinguishable from a knob that is not
 * wired to anything — and `memory/an-unwired-knob-gives-identical-output.md` says an identical
 * result across a varied knob IS the finding. Here it was the probe, and the probe said "green".
 *
 * THE FIX IS A SEPARATE MARKER, SET ONLY BY THE SPAWN: `ABRA_PROBE_CONTROL_ARM=1` (or a `--red`
 * argv). The knob alone runs the FULL verdict against the broken engine and exits 1; knob AND
 * marker takes the quiet arm.
 *
 * WHY THIS IS NOT ONE CLAUSE. The static shape and the measured outcome each catch what the other
 * misses, and both were needed on the real population:
 *
 *   CLAUSE 2 (static)   catches `if (V) { ... exit(0) }` where V is the bare knob. Sixteen files.
 *                       It does NOT catch tests/probe_mega_trace_entry.js, whose knob selects a
 *                       whole ASSERTION BRANCH with no early exit.
 *   CLAUSE 3 (measured) catches that one, because the only thing that cannot be argued with is the
 *                       pair of exit codes. It does NOT run here — a full sweep is ~10 minutes —
 *                       so it reads a RECORDED measurement and re-hashes the probe, which is the
 *                       hash-not-mtime arrangement `engine/em_validation.js --check` already uses.
 *                       Edit a probe and its recorded verdict goes stale and this goes red.
 *
 * NOT REGISTERED IN run-all.js's GATES, deliberately: `tests/test-*.js` is DISCOVERED by the glob,
 * so a GATES entry would buy a second execution of the same command — the probe_red_demo trap that
 * run-all.js's own exemption table warns about twice.
 *
 *   node tests/test-knob-control-arm.js                 the gate (fast, no games played)
 *   node tests/test-knob-control-arm.js --measure       re-run EVERY pair and rewrite the artifact
 *   node tests/test-knob-control-arm.js --measure <f>   re-run one pair (about 10s)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const ENGINE = path.join(ROOT, 'engine');
const ARTIFACT = path.join(ROOT, 'data', 'probe-knob-arms.json');

let bad = 0;
const fail = (m, d) => { console.log('  RED    ' + m + (d ? '\n           ' + d : '')); bad++; };
const ok = (m, d) => console.log('  green  ' + m + (d ? ' — ' + d : ''));

const read = p => fs.readFileSync(p, 'utf8').replace(/\r/g, '');
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);

/* ================================================================================================
 * CLAUSE 1 — THE POPULATION, DERIVED. Nothing below is a typed list of probe names.
 *
 * A member is a file under tests/ that spawns ITSELF (`spawnSync(process.execPath, [... __filename
 * ...])`) with an environment name set in the child's env literal, where that name is READ BY CODE
 * UNDER engine/. The last condition is what separates a real engine knob from a bare control marker
 * like PROBE_NARA_CHILD: setting a marker cannot break the engine, so a probe that goes quiet under
 * one is not lying about the game. That distinction was MEASURED before it was relied on —
 * tests/probe_narration_a.js exits 1 under MEDI_ROOST_ANNOUNCE_FLYING_ONLY=1 and 0 under
 * PROBE_NARA_CHILD=1, and only the first of those is a claim about the engine.
 * ============================================================================================== */
const engineSrc = fs.readdirSync(ENGINE).filter(f => f.endsWith('.js'))
  .map(f => { try { return read(path.join(ENGINE, f)); } catch (e) { console.error('engine source unreadable, so its knobs cannot be seen: ' + f + ' -- ' + e.message); return ''; } }).join('\n');
/* A KNOB IS A SHAPE, NOT A PREFIX: engine/ reads it as the BOOLEAN `process.env.X === '1'`.
 * `engineSrc.includes(name)` was tried first and over-matched immediately — it swept in
 * SHOWDOWN_PATH, which engine/ certainly reads and which is a path rather than a switch. Printed
 * before it was relied on, per the standing rule about a derived tag that over-matches. */
/* AND A KNOB READ THROUGH A HELPER IS STILL A KNOB. engine/medicham2-browser.js declares
 * `const _MK=k=>(...process.env[k]==='1')` and then `const X=_MK('MEDI_...')`, so **42 knobs** —
 * every one of the narration family among them — matched no `process.env.NAME` text at all and were
 * absent from the population entirely. Neither clause asked anything of them, and the three probes
 * this file named as "NOT PAIR-MEASURED" were excluded for exactly that reason rather than the one
 * the comment gave. The HELPER NAMES ARE DERIVED, never typed: anything bound to an arrow that
 * compares `process.env[<its parameter>]` to '1' is one, so a second helper added later is picked up
 * without editing this line. Both counts are printed below, because a shape that stops matching
 * looks precisely like a shape that is not used. */
const KNOB_HELPERS = [];
{
  const hre = /(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\s*=>[^;]*?process\.env\[\s*\2\s*\]\s*===\s*['"]1['"]/g;
  let h; while ((h = hre.exec(engineSrc))) KNOB_HELPERS.push(h[1]);
}
const isEngineKnob = n =>
  new RegExp('process\\.env\\.' + n + "\\s*===\\s*['\"]1['\"]").test(engineSrc)
  || KNOB_HELPERS.some(fn => new RegExp('\\b' + fn + "\\(\\s*['\"]" + n + "['\"]\\s*\\)").test(engineSrc));
/* and the PROBE must steer on it as a boolean too — merely mentioning a name is not reading it */
const probeSteersOn = (src, n) => new RegExp('process\\.env\\.' + n + "\\s*===\\s*['\"]1['\"]").test(src);

const population = [], dynamic = [], tableDriven = [];
for (const f of fs.readdirSync(TESTS).filter(x => x.endsWith('.js')).sort()) {
  if (path.join(TESTS, f) === __filename) continue;   /* this file quotes the shape in its own header */
  const src = read(path.join(TESTS, f));
  if (!/spawnSync\(process\.execPath/.test(src)) continue;
  /* every env object literal that belongs to a SELF spawn.
   * BRACKET-BALANCED, NOT `[^\]]*`: the real argument list is `[...(process.execArgv || []), __filename]`,
   * whose inner `[]` ends a character-class scan early. A regex written that way found 16 of the 30
   * pairs and reported the other 14 as absent, which is the silent-default shape this file is about. */
  const names = new Set();
  const CALL = 'spawnSync(process.execPath,';
  for (let at = src.indexOf(CALL); at >= 0; at = src.indexOf(CALL, at + 1)) {
    let d = 0, end = at;
    for (let i = src.indexOf('(', at); i < src.length; i++) {   /* from the CALL's own paren */
      const c = src[i];
      if (c === '(' || c === '[' || c === '{') d++;
      else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) { end = i; break; } }
    }
    const call = src.slice(at, end + 1);
    if (!call.includes('__filename')) continue;          /* it must spawn ITSELF */
    const envAt = call.indexOf('env:');
    if (envAt < 0) continue;
    let ed = 0, eEnd = envAt;
    for (let i = call.indexOf('{', envAt); i < call.length; i++) {
      if (call[i] === '{') ed++; else if (call[i] === '}') { ed--; if (!ed) { eEnd = i; break; } }
    }
    const envBody = call.slice(call.indexOf('{', envAt), eEnd + 1);
    let k; const kre = /(?:^|[,{\s])([A-Z][A-Z0-9_]{2,})\s*:\s*['"`]/g;
    while ((k = kre.exec(envBody))) names.add(k[1]);
    const dyn = /\[\s*(\w+)\s*\]\s*:\s*['"`]/.exec(envBody);   /* `[kn]: '1'` — a knob chosen at run time */
    if (dyn) names.add('__DYNAMIC__' + dyn[1]);
  }
  names.delete('ABRA_PROBE_CONTROL_ARM');
  /* AND EVERY KNOB THE FILE READS BY NAME. Five probes set the child's knob through a COMPUTED key
   * (`env: { [knob]: '1' }`) while still reading one fixed name at the top — so an env-literal-only
   * enumeration filed them as "chosen at run time" and never pair-tested them, and all five were in
   * the broken class. A name read as `process.env.X` is a name a human can set from outside, which
   * is exactly what CLAUSE 3 asks about. */
  let r; const rre = /process\.env\.([A-Z][A-Z0-9_]{2,})\s*===\s*['"]1['"]/g;
  while ((r = rre.exec(src))) if (r[1] !== 'ABRA_PROBE_CONTROL_ARM' && isEngineKnob(r[1])) names.add(r[1]);
  for (const n of [...names]) if (!n.startsWith('__DYNAMIC__') && !probeSteersOn(src, n)) names.delete(n);
  const real = [...names].filter(n => !n.startsWith('__DYNAMIC__') && isEngineKnob(n)).sort();
  /* A TABLE-DRIVEN PROBE'S KNOBS ARE STILL NAMES A HUMAN CAN SET FROM OUTSIDE — they are STRING
   * LITERALS in the probe's own `KNOBS` table instead of a `process.env.X` read, which is the only
   * reason the enumeration above misses them. They were EXCLUDED and named for one day, and the
   * exclusion rested on a sentence in this header claiming each had been measured under one knob
   * from its table. A sentence is not a ratchet: nothing re-checked it, and CLAUSE 2 does not scan a
   * file outside `population`, so a table-driven probe that later keyed its quiet arm on a table
   * knob would have been invisible to both clauses. Measured 2026-09-19 over the FULL tables — all
   * 13 exit 0 clean and 1 under their knob — so folding them in costs nothing and the exclusion
   * goes away. Guarded on `dyn` so it reaches ONLY a file that genuinely picks its knob at run time,
   * never a file that merely mentions a knob name in a comment. */
  if (!real.length && [...names].some(n => n.startsWith('__DYNAMIC__'))) {
    /* BOTH SPELLINGS OF A TABLE. `probe_multihit_reaction_per_arrival` uses an ARRAY of quoted
     * strings; `probe_narration_a` and `_c` use an OBJECT whose keys are BARE identifiers. A
     * quoted-literal-only scan found the first and reported the other two as absent — which is the
     * silent-default shape this whole file is about, so it is matched as a bare TOKEN and filtered
     * by `isEngineKnob`. A name engine/ reads as a boolean switch is a knob wherever it is written. */
    const lit = new Set(); let m; const lre = /\b([A-Z][A-Z0-9_]{2,})\b/g;
    while ((m = lre.exec(src))) if (isEngineKnob(m[1])) lit.add(m[1]);
    for (const n of [...lit].sort()) real.push(n);
    if (lit.size) tableDriven.push({ file: 'tests/' + f, knobs: [...lit].sort() });
  }
  for (const n of real) population.push({ file: 'tests/' + f, knob: n });
  /* only a file with NO fixed engine knob of its own is genuinely table-driven */
  if (!real.length) for (const n of names) if (n.startsWith('__DYNAMIC__'))
    dynamic.push({ file: 'tests/' + f, via: n.slice(11) });
}

console.log('== A KNOB THAT SILENCES ITS OWN PROBE PROVES NOTHING ==\n');
console.log('CLAUSE 1 — the population, derived from the code (self-spawn + a name engine/ reads):');
{
  const direct = new Set(), viaHelper = new Set();
  let d; const dre = /process\.env\.([A-Z][A-Z0-9_]{2,})\s*===\s*['"]1['"]/g;
  while ((d = dre.exec(engineSrc))) direct.add(d[1]);
  for (const fn of KNOB_HELPERS) {
    let h; const hre = new RegExp('\\b' + fn + "\\(\\s*['\"]([A-Z][A-Z0-9_]{2,})['\"]\\s*\\)", 'g');
    while ((h = hre.exec(engineSrc))) viaHelper.add(h[1]);
  }
  console.log('  engine/ reads ' + direct.size + ' knob(s) as `process.env.X === \'1\'` and '
    + viaHelper.size + ' through ' + (KNOB_HELPERS.length ? KNOB_HELPERS.join('/') + '()' : 'NO HELPER — '
    + 'the helper detector matched nothing, which is a broken detector, not an absent shape'));
}
for (const p of population) console.log('    ' + p.file + '   ' + p.knob);
console.log('  ' + population.length + ' (probe, engine knob) pair(s).');
/* PRINTED BEFORE IT IS RELIED ON — a new matcher over-matches quietly, and a string-literal scan is
 * exactly the shape that does. These are the names lifted out of a run-time KNOBS table. */
if (tableDriven.length) {
  console.log('  lifted out of a run-time KNOBS table (string literals, each read by engine/):');
  for (const t of tableDriven) console.log('    ' + t.file + '   ' + t.knobs.join(' '));
}
/* THIS EXCLUSION IS EMPTY AS OF 2026-09-19 AND THE BRANCH IS KEPT SO IT CANNOT COME BACK SILENTLY.
 * It used to hold probe_narration_a, probe_narration_c and probe_multihit_reaction_per_arrival on
 * the reasoning that a run-time table has "no single env name to set from outside", with a sentence
 * saying each had been measured under ONE knob from its table. Both halves were wrong: the names are
 * perfectly settable (they are written in the probe's own table), and a sentence is not a ratchet.
 * The real reason they fell out was that every one of their knobs is read through `_MK()`, which the
 * old `isEngineKnob` could not see at all. They are now 13 ordinary pairs, each measured clean 0 /
 * knob 1 over the FULL table. An unlisted exclusion is how a population quietly shrinks; a listed
 * one that nothing re-derives is how it stays shrunk. */
if (dynamic.length) {
  console.log('  NOT PAIR-MEASURED — the knob is chosen at run time from the probe\'s own table:');
  for (const d of dynamic) console.log('    ' + d.file + '   env[' + d.via + ']');
}
if (!population.length) fail('the enumeration found NOTHING, so every clause below asks nothing',
  'a self-spawn with an engine knob is the shape this file exists for; zero means the detector broke');
console.log('');

/* ================================================================================================
 * CLAUSE 2 — THE STATIC SHAPE. A variable assigned STRAIGHT from the knob, with no conjunction,
 * must not guard a block that exits 0. That block is the quiet control arm, and reaching it with
 * the knob alone is the whole defect.
 * ============================================================================================== */
console.log('CLAUSE 2 — no quiet arm may be reachable by the knob alone:');
let shapeHits = 0;
for (const { file, knob } of population) {
  const fileSrc = read(path.join(ROOT, file));
  const L = fileSrc.split('\n');
  /* Names assigned from a BARE knob read. `&&` is the fix and is accepted; `||` is NOT — several
   * probes read two knobs as `A === '1' || B === '1'`, and an end-anchored single-term pattern
   * missed them. MATCHED OVER THE WHOLE SOURCE, not line by line: one of them wraps the `||` onto a
   * second line, and a line-scoped pattern reported it clean while the pair measured 0/0. */
  const bare = [];
  {
    const re = new RegExp('(?:const|let|var)\\s+(\\w+)\\s*=\\s*([^;]*?process\\.env\\.' + knob + '[^;]*?);', 'g');
    let d;
    while ((d = re.exec(fileSrc))) {
      if (/&&/.test(d[2])) continue;
      bare.push({ v: d[1], line: fileSrc.slice(0, d.index).split('\n').length });
    }
  }
  for (const b of bare) {
    /* does `if (<v>)` open a block that calls process.exit(0)? */
    for (let i = 0; i < L.length; i++) {
      if (!new RegExp('^\\s*if\\s*\\(\\s*' + b.v + '\\s*\\)\\s*\\{\\s*$').test(L[i])) continue;
      let depth = 1, exits = false;
      for (let j = i + 1; j < L.length && depth > 0; j++) {
        if (/process\.exit\(\s*0\s*\)/.test(L[j])) exits = true;
        for (const ch of L[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      }
      if (exits) {
        shapeHits++;
        fail(file + ':' + b.line + ' — `' + b.v + '` is the bare knob and guards an exit(0) at line ' + (i + 1),
          'set ' + knob + '=1 from outside and this probe goes quiet and exits 0 against a broken engine.'
          + '\n           The fix: `const ' + b.v + ' = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === \'1\';`'
          + ' and set that marker only in the spawn.');
      }
      break;
    }
  }
}
if (!shapeHits) ok('no probe reaches its quiet arm on the knob alone', population.length + ' checked');
console.log('');

/* ================================================================================================
 * CLAUSE 3 — THE MEASURED PAIR, RATCHETED. `clean must exit 0` and `knob must exit 1`.
 *
 * It is RECORDED rather than re-run: the sweep costs about ten minutes and this file is discovered
 * by run-all.js. The recording carries the probe's CONTENT DIGEST, so editing a probe invalidates
 * its verdict and turns this red — "newer than its source" is no evidence at all, and a digest is.
 * ============================================================================================== */
/* A DECLARED SILENT CONTROL INVERTS THE EXPECTATION, AND THE PROBE IS THE ONE THAT DECLARES IT.
 * Three probes deliberately re-run themselves under ANOTHER probe's knob to show the two fixes are
 * independent — `ok(quiet.status === 0, 'SILENT CONTROL — an unrelated knob does not move this
 * probe')`. For those the knob MUST leave the probe green, and a rule that demanded exit 1 would
 * have called three correct files broken. The marker is read off the probe's own line rather than
 * guessed from the numbers, and the classification is PRINTED for every pair. */
const silentControl = (file, knob) => read(path.join(ROOT, file)).split('\n')
  .some(l => l.includes(knob) && /SILENT CONTROL/.test(l));

/* A PAIRED KNOB IS HALF OF ONE DEFECT, AND THE PROBE DECLARES ITS OTHER HALF — 2026-09-20.
 * Some defects are suppressed by TWO independent guards, so restoring one leaves the other correct
 * and the probe stays green. Read bare, that is indistinguishable from an unwired knob, and this
 * guard called a correct file broken on exactly that reading. The marker is read off the probe's own
 * line, like SILENT CONTROL, and it is NOT the same thing: a silent control is an UNRELATED knob that
 * must leave the probe green, whereas these are each half of the same defect and must restore it
 * TOGETHER. The measurement sets both and still requires exit 1, so the claim this guard exists to
 * make -- "this probe can fail" -- is preserved rather than waived. */
const pairedWith = (file, knob) => {
  const m = read(path.join(ROOT, file)).match(new RegExp(knob + '[ 	]+PAIRED WITH[ 	]+([A-Z0-9_]+)'));
  return m ? m[1] : null;
};

const KEY = (file, knob) => file + ' :: ' + knob;

const MEASURE = process.argv.includes('--measure');
if (MEASURE) {
  const only = process.argv.slice(process.argv.indexOf('--measure') + 1).filter(a => !a.startsWith('--'));
  const prev = fs.existsSync(ARTIFACT) ? JSON.parse(read(ARTIFACT)) : { pairs: {} };
  const out = { generated: new Date().toISOString(), note:
    'Measured exit codes for every (probe, engine knob) pair, keyed "<file> :: <knob>" because a probe '
    + 'may carry two knobs and a file-only key silently kept the last one. clean MUST be 0; the knob '
    + 'MUST be 1 unless the probe declares that knob a SILENT CONTROL, in which case it MUST be 0. '
    + 'Regenerate with `node tests/test-knob-control-arm.js --measure [file]`. `sha256` is the probe '
    + 'file, so an edited probe invalidates its own verdict.',
    clean_red_allowed: prev.clean_red_allowed || {},
    pairs: { ...(prev.pairs || {}) } };
  for (const { file, knob } of population) {
    if (only.length && !only.some(o => file.endsWith(o.replace(/\\/g, '/')))) continue;
    const go = (env, args) => spawnSync(process.execPath, ['-r', './tests/_live_release.js', file, ...args],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
    /* SOME PROBES REFUSE TO RUN WITHOUT AN EXPLICIT `--release <id>` — correctly, because requiring
     * the differential bare CUTS a release. The retry is recorded and PRINTED rather than applied
     * quietly: a release id is part of a sample definition, and a silent fallback looks exactly like
     * a feature that works. `probe_trap_timing.js` exits 2 both ways without it and 0 with it, which
     * would otherwise have been filed as a probe red it is not. */
    let pin = null;
    let r = go({}, []);
    if (r.status === 2 && /--release/.test(String(r.stdout || '') + String(r.stderr || ''))) {
      try { pin = JSON.parse(read(path.join(ROOT, 'data', 'engine-release.json'))).current; } catch (e) { console.error('no release pointer to pin this probe with: ' + e.message); pin = null; }
      if (pin) r = go({}, ['--release', pin]);
    }
    const args = pin ? ['--release', pin] : [];
    const clean = r.status;
    const mate = pairedWith(file, knob);
    const knobbed = go(mate ? { [knob]: '1', [mate]: '1' } : { [knob]: '1' }, args).status;
    out.pairs[KEY(file, knob)] = { file, knob, clean, knob_exit: knobbed,
      silent_control: silentControl(file, knob), paired_with: mate, release_pin: pin, sha256: digest(path.join(ROOT, file)) };
    console.log('  measured  ' + file + '  clean=' + clean + '  ' + knob + '=1 -> ' + knobbed
      + (pin ? '   [REFUSED without a release; re-run with --release ' + pin + ']' : '')
      + (mate ? '   [PAIRED WITH ' + mate + ' — both set, 1 is still the pass]' : '')
      + (silentControl(file, knob) ? '   [declared SILENT CONTROL — 0 is the pass]' : ''));
  }
  fs.writeFileSync(ARTIFACT, JSON.stringify(out, null, 1) + '\n');
  console.log('  wrote ' + path.relative(ROOT, ARTIFACT));
  console.log('');
}

console.log('CLAUSE 3 — the recorded pair: clean exits 0, the knob exits 1:');
let REC = null;
try { REC = JSON.parse(read(ARTIFACT)); }
catch (e) { fail('data/probe-knob-arms.json is missing or unreadable (' + e.message + ')',
  'run `node tests/test-knob-control-arm.js --measure`. An absent measurement is not a pass.'); }

const cannotAsk = [];
let silents = 0;
if (REC) {
  for (const { file, knob } of population) {
    const r = (REC.pairs || {})[KEY(file, knob)];
    if (!r) { fail(KEY(file, knob) + ' has no recorded measurement', 'run --measure ' + file); continue; }
    const now = digest(path.join(ROOT, file));
    if (r.sha256 !== now) {
      fail(file + ' changed since it was measured (' + r.sha256 + ' -> ' + now + ')',
        'its recorded verdict describes bytes that no longer exist. Re-run: --measure ' + file);
      continue;
    }
    if (r.clean !== 0) { cannotAsk.push(KEY(file, knob) + '  clean exit ' + r.clean + ', knob -> ' + r.knob_exit); continue; }
    const want = silentControl(file, knob) ? 0 : 1;
    if (want === 0) {
      silents++;
      if (r.knob_exit !== 0) fail(file + ': ' + knob + ' is declared a SILENT CONTROL and yet moves this probe (exit ' + r.knob_exit + ')',
        'either the two fixes are not independent after all, or the declaration is wrong.');
      continue;
    }
    if (r.knob_exit === 0) {
      fail(file + ': ' + knob + '=1 leaves it GREEN',
        'the probe exits 0 against an engine with the defect deliberately restored. Either the control'
        + ' arm is keyed on the knob, or the knob is unwired — both are findings, neither is a pass.');
      continue;
    }
    if (r.knob_exit !== 1) { fail(file + ': ' + knob + '=1 exits ' + r.knob_exit + ', which is neither a pass nor a fail'); continue; }
  }
  const covered = population.filter(p => (REC.pairs || {})[KEY(p.file, p.knob)]).length;
  if (bad === 0) ok('every pair exits 0 clean and 1 under its knob', covered + ' of ' + population.length
    + ' measured (' + silents + ' declared SILENT CONTROL, where 0 is the pass), recorded ' + REC.generated);
}

/* ---- the probes that are RED ON A CLEAN RUN -------------------------------------------------- *
 * This guard cannot ask "does the knob move the verdict" of a probe whose clean run already fails —
 * both arms are red and the comparison says nothing. Those are NOT counted as a pass and they are
 * NOT silently skipped: they are named on every run and RATCHETED, so the number can only go down.
 * A clean-red probe is a defect the probe itself reports with its own exit code; it belongs to
 * whoever owns that mechanic, and it is printed here so it cannot be forgotten. */
/* THE RATCHET IS A NAMED LIST, NOT A COUNT. A count lets one probe get fixed and another go red in
 * the same pass and reports nothing, which is how a bound stops bounding. */
const ALLOWED = (REC && REC.clean_red_allowed) || {};
console.log('');
console.log('PROBES THAT DO NOT EXIT 0 ON A CLEAN RUN — the knob question cannot be asked of these:');
for (const r of cannotAsk) {
  const key = r.split('  ')[0];
  console.log('    ' + r + (ALLOWED[key] ? '\n        declared: ' + ALLOWED[key] : '   <-- NOT DECLARED'));
  if (!ALLOWED[key]) fail(key + ' fails its own clean run and is not on the declared list',
    'fix the probe, or add it to `clean_red_allowed` in data/probe-knob-arms.json with the measured'
    + ' reason. A probe that cannot pass clean cannot answer the knob question either way.');
}
console.log('  ' + cannotAsk.length + ' of ' + population.length + ', ' + Object.keys(ALLOWED).length + ' declared');
for (const k of Object.keys(ALLOWED)) if (!cannotAsk.some(r => r.startsWith(k)))
  console.log('    ' + k + ' is DECLARED red and is not red any more — drop it from the list.');

console.log('');
console.log(bad ? 'RED — ' + bad + ' clause(s) failed' : 'green — every clause held');
process.exit(bad ? 1 : 0);
