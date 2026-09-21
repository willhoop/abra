/* THE REGULATION IS A RUN-TIME CHOICE, AND THE DEFAULT IS UNCHANGED.
 *
 * `champions_sim.FORMAT` was a load-time constant with 490 readings across 357 files and no flag, so
 * the only way to point ABRA at a second regulation was to EDIT `data/regulations.json` — which the
 * first Reg M-C smoke run had to do, in a worktree, restoring it afterwards
 * (`docs/_reports/2026-09-20-regmc-first-run.md` §1a). A run that rewrites shared config is a run
 * that can corrupt another one beside it.
 *
 * THIS IS A REFACTOR, SO THE BAR IS THAT NOTHING MOVES. Clause 1 is the whole bar and the rest is
 * the capability: with nothing specified, the resolver must return exactly what the inlined
 * `JSON.parse(readFileSync('data/regulations.json'))` blocks returned, print nothing, and leave the
 * environment alone.
 *
 * AND THE KNOB IS CLEARED EXPLICITLY. An identical result across a varied knob means the knob is
 * unwired, not that it does not matter (docs/LESSONS.md). Every clause that varies the regulation
 * asserts a DIFFERENT outcome against a control arm that asks for the default — so an unwired flag
 * fails here rather than passing quietly.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REG = require(path.join(ROOT, 'engine', 'regulation.js'));
const SP = require(path.join(ROOT, 'engine', 'showdown_path.js'));

let pass = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function threw(fn) { try { fn(); return null; } catch (e) { return String((e && e.message) || e); } }

console.log('\nREGULATION SELECTION AT RUN TIME\n');

/* ---- 1. THE DEFAULT IS BYTE-FOR-BYTE THE OLD BEHAVIOUR ---------------------------------------- */
/* The old expression, written out rather than imported, so this compares two independent readings
 * of the same file and not one reading of itself. */
/* THE ORIGINAL SWALLOWED THIS READ AND RETURNED THE LITERAL. That is right for a collection job and
 * WRONG here: a fabricated baseline would make clause 1 compare the resolver against a constant and
 * pass while the config was unreadable. A test that cannot read its own baseline has no baseline. */
const OLD = (() => {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regulations.json'), 'utf8'));
    const a = r.regulations[r.active] || {};
    return { fmt: a.showdownFormat || null, bo3: a.bo3Format || null, active: r.active };
  } catch (e) {
    throw new Error('test-regulation-runtime: cannot read data/regulations.json, so there is no '
      + 'independent baseline to hold the resolver to: ' + ((e && e.message) || e));
  }
})();
if (!OLD.fmt) throw new Error('test-regulation-runtime: data/regulations.json names active="'
  + OLD.active + '" and that entry has no showdownFormat — no baseline exists.');

const dflt = REG.select({ argv: [], env: null });
ok('default resolves the config\'s active regulation', dflt.id === OLD.active, dflt.id + ' vs ' + OLD.active);
ok('default format id is the one the old inlined read returned',
  dflt.entry.showdownFormat === OLD.fmt, dflt.entry.showdownFormat + ' vs ' + OLD.fmt);
ok('default bo3 id is the one the old inlined read returned',
  (dflt.entry.bo3Format || null) === OLD.bo3, String(dflt.entry.bo3Format) + ' vs ' + String(OLD.bo3));
ok('default is not flagged explicit', dflt.explicit === false);
ok('default took no fallback', dflt.fallback === null, String(dflt.fallback));

const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
ok('champions_sim.FORMAT still equals the old inlined read', CS.FORMAT === OLD.fmt, CS.FORMAT + ' vs ' + OLD.fmt);

/* ---- 2. THE KNOB MOVES, AND THE CONTROL SAYS THE INSTRUMENT COULD HAVE SEEN IT ---------------- */
const known = REG.knownIds();
const others = known.filter(k => k !== OLD.active && (REG.entryFor(k) || {}).showdownFormat);
ok('data/regulations.json describes at least one NON-active regulation to select',
  others.length > 0, 'known: ' + known.join(', ') + ' — without a second entry this file cannot vary its knob');

if (others.length) {
  const other = others[0];
  const otherFmt = REG.entryFor(other).showdownFormat;

  const viaFlag = REG.select({ argv: ['--regulation', other], env: null });
  const control = REG.select({ argv: ['--regulation', OLD.active], env: null });
  ok('--regulation <id> selects that regulation', viaFlag.id === other && viaFlag.entry.showdownFormat === otherFmt,
    viaFlag.id + '/' + viaFlag.entry.showdownFormat);
  ok('CONTROL: --regulation <active> selects the active one', control.id === OLD.active && control.entry.showdownFormat === OLD.fmt);
  ok('CONTROL CLEARED: the two arms return DIFFERENT format ids',
    viaFlag.entry.showdownFormat !== control.entry.showdownFormat,
    'both answered ' + viaFlag.entry.showdownFormat + ' — the flag is unwired');

  ok('--regulation=<id> (equals form) selects it too',
    REG.select({ argv: ['--regulation=' + other], env: null }).id === other);
  ok('ABRA_REGULATION selects it', REG.select({ argv: [], env: other }).id === other);
  ok('the flag BEATS the environment',
    REG.select({ argv: ['--regulation', OLD.active], env: other }).id === OLD.active);
  ok('a full Showdown format id is accepted where a key is',
    REG.select({ argv: ['--regulation', otherFmt], env: null }).id === other, otherFmt);
  ok('the flag is found wherever it sits on the line',
    REG.select({ argv: ['--games', '45', '--regulation', other, '--dump-games'], env: null }).id === other);

  /* ---- 3. THE CHECKOUT FOLLOWS THE REGULATION ------------------------------------------------- */
  const cA = REG.entryFor(OLD.active).checkout;
  const cB = REG.entryFor(other).checkout;
  ok('both regulations name a Showdown checkout', !!cA && !!cB, 'active=' + cA + ' other=' + cB);
  ok('CONTROL CLEARED: they name DIFFERENT checkouts', cA !== cB,
    'both named ' + cA + ' — selecting a regulation would not select a checkout');

  /* The refusal is what makes the pairing load-bearing, and it is asserted against the REAL dex
   * rather than against the config: M-B's pinned authority does not carry M-C's format, so a run
   * that got the pairing wrong would be answered by `dexFor` with a refusal rather than by mainline
   * Gen 9 wearing the format's name. Both directions are checked so this cannot pass by accident. */
  const paths = {};
  for (const k of [OLD.active, other]) {
    const cand = REG.select({ argv: ['--regulation', k], env: null });
    const dir = (cand.entry.checkout && [
      path.join(ROOT, '..', cand.entry.checkout),
      path.join(ROOT, '..', '..', '..', '..', cand.entry.checkout),
    ].find(p => SP.looksLikeShowdown(p))) || null;
    paths[k] = dir;
  }
  ok('each named checkout exists on this machine', !!paths[OLD.active] && !!paths[other], JSON.stringify(paths));

  if (paths[OLD.active] && paths[other]) {
    const carries = (dir, fmt) => {
      const { Dex } = require(path.join(dir, 'dist', 'sim', 'index.js'));
      const f = Dex.formats.get(fmt);
      return !!(f && f.exists);
    };
    ok('the ACTIVE regulation\'s checkout carries the ACTIVE format', carries(paths[OLD.active], OLD.fmt));
    ok('the OTHER regulation\'s checkout carries the OTHER format', carries(paths[other], otherFmt));
    ok('CONTROL CLEARED: the ACTIVE checkout does NOT carry the OTHER format',
      !carries(paths[OLD.active], otherFmt),
      'it does — then the checkout pairing proves nothing, because one checkout answers both');
  }

  /* ---- 4. THE CHOICE IS PRINTED, AND THE DEFAULT IS SILENT ------------------------------------ */
  const probe = path.join(__dirname, '_regulation_probe.js');
  fs.writeFileSync(probe,
    "const R=require(require('path').join(__dirname,'..','engine','regulation.js'));\n"
    + "process.stdout.write(JSON.stringify({id:R.ID,fmt:R.FORMAT,src:R.SOURCE,env:process.env.ABRA_REGULATION||null}));\n",
    'utf8');
  const run = (args, env) => {
    const r = execFileSync(process.execPath, [probe].concat(args || []),
      { encoding: 'utf8', env: Object.assign({}, process.env, { ABRA_REGULATION: '' }, env || {}),
        stdio: ['ignore', 'pipe', 'pipe'] });
    return r;
  };
  const runBoth = (args, env) => {
    const out = require('child_process').spawnSync(process.execPath, [probe].concat(args || []),
      { encoding: 'utf8', env: Object.assign({}, process.env, { ABRA_REGULATION: '' }, env || {}) });
    return { out: out.stdout, err: out.stderr, code: out.status };
  };
  try {
    const d = runBoth([]);
    ok('a DEFAULT run prints nothing about the regulation', !/ABRA REGULATION/.test(d.err || ''), JSON.stringify(d.err));
    ok('a DEFAULT run resolves the active regulation', JSON.parse(d.out).id === OLD.active);

    const s = runBoth(['--regulation', other]);
    ok('a SELECTED run PRINTS its choice on stderr', /ABRA REGULATION/.test(s.err || ''), JSON.stringify(s.err));
    ok('the printed line names the regulation AND the format id',
      new RegExp(other).test(s.err || '') && new RegExp(otherFmt).test(s.err || ''), JSON.stringify(s.err));
    ok('a SELECTED run resolves that regulation', JSON.parse(s.out).id === other);
    ok('an explicit selection is propagated to CHILD processes via ABRA_REGULATION',
      JSON.parse(s.out).env === other, s.out);
    ok('a DEFAULT run does NOT write ABRA_REGULATION', !JSON.parse(d.out).env, d.out);

    /* ---- 5. AN UNRESOLVABLE EXPLICIT SELECTION REFUSES ---------------------------------------- */
    const bad = runBoth(['--regulation', 'regzz']);
    ok('an unknown regulation REFUSES rather than falling back', bad.code !== 0, 'exit ' + bad.code);
    ok('the refusal names what it knows', /Known:/.test(bad.err || ''), JSON.stringify((bad.err || '').slice(0, 200)));
    ok('the refusal does NOT quietly answer with the active format',
      !new RegExp('"fmt":"' + OLD.fmt + '"').test(bad.out || ''), bad.out);
  } finally {
    /* The probe is this file's own scratch and a failed delete does not affect any verdict above —
     * but it leaves a stray `tests/_regulation_probe.js` that the next reader will find and wonder
     * about, and an unexplained file in tests/ is exactly the kind of debris this repo says to
     * report rather than ignore. So it is SAID, not swallowed. */
    try { fs.unlinkSync(probe); }
    catch (e) { console.error('  (could not remove the scratch probe ' + probe + ': ' + ((e && e.message) || e) + ')'); }
  }
}

/* ---- 6. THE ARGUMENT FORMS THAT MUST NOT PASS SILENTLY ---------------------------------------- */
ok('--regulation with no value throws', !!threw(() => REG.select({ argv: ['--regulation'], env: null })));
ok('--regulation followed by another flag throws', !!threw(() => REG.select({ argv: ['--regulation', '--games'], env: null })));
ok('--regulation= with an empty value throws', !!threw(() => REG.select({ argv: ['--regulation='], env: null })));
ok('an unknown id throws rather than returning the default',
  !!threw(() => REG.select({ argv: ['--regulation', 'regzz'], env: null })));

console.log('\n  ' + pass + ' passed, ' + fails.length + ' failed');
if (fails.length) { for (const f of fails) console.log('    FAIL ' + f); process.exit(1); }
