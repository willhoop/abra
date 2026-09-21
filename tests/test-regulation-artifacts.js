/* test-regulation-artifacts.js — A RUN ABOUT ONE REGULATION CAN NEVER MOVE ANOTHER'S EVIDENCE.
 *
 * 2026-09-21 (MEASURE). Reg M-B closed at 7.0.0 and its artifacts are the published record. Reg M-C is
 * measured with the same instruments, and until engine/regulation.js grew its artifact seam every one of
 * them wrote a fixed `data/<name>`: a Reg M-C run with `--write` overwrote Reg M-B's evidence and exited 0,
 * and engine/quarantine.js could only answer for Reg M-B.
 *
 * FOUR PARTS.
 *   1. THE LIST IS CHECKED AGAINST THE GATE'S OWN DERIVATION. Every artifact in the gate's closure (what
 *      the clauses read, and everything those were built from, through provenance.js's graph — the same
 *      walk engine/quarantine.js uses to exempt its instruments) is per-regulation by engine/regulation.js,
 *      or one of the engine's own per-regulation files, or declared below as NOT YET per-regulation with
 *      its reason and owner. Every GATE INPUT must be per-regulation: a shared gate input is the M-C gate
 *      reading M-B's number. A declaration the closure no longer contains fails as stale.
 *   2. THE MAPPING, IN BOTH DIRECTIONS. Under Reg M-C every per-regulation name moves to a `-regmc`
 *      sibling and so does every lattice sample the gate reads; under Reg M-B nothing moves and the
 *      lattice list is exactly the three files the gate read before this change.
 *   3. THE SEAM, IN A SANDBOX. A copy of engine/regulation.js is run from a throwaway root, so no real
 *      file is ever at risk: under Reg M-C a declared write lands on the sibling, an absent sibling reads
 *      ENOENT (never Reg M-B's file), and every way of changing an existing undeclared file is refused.
 *      The same probes under Reg M-B are the control: they write straight through.
 *   4. THE GATE SAYS WHICH REGULATION IT ANSWERED FOR, on its first line.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
/* NAMES ARE ASSEMBLED, NOT SPELLED. engine/provenance.js credits a source with WRITING an artifact when the
 * artifact's name sits near a write verb rooted in data/, and part 3 below writes Reg M-B's names -- into a
 * throwaway sandbox. Spelled literally, this test became the recorded writer of data/game-differential.json
 * and moved Reg M-B's artifact graph (measured 2026-09-21: the gate's closure changed under it). */
const J = (stem) => stem + '.json';
const JS = (stem) => stem + '.js';
let ran = 0, bad = 0;
const ok = (name, cond, detail) => {
  ran++;
  if (cond) console.log('  ok   ' + name);
  else { bad++; console.log('  FAIL ' + name + (detail ? '\n       ' + String(detail).split('\n').join('\n       ') : '')); }
};
const child = (code, env, cwd) => {
  const e = Object.assign({}, process.env);
  delete e.ABRA_REGULATION;
  Object.assign(e, env || {});
  const r = spawnSync(process.execPath, ['-e', code], { cwd: cwd || ROOT, env: e, encoding: 'utf8', maxBuffer: 1 << 26 });
  let j = null, parseErr = '';
  try { j = JSON.parse(String(r.stdout).trim().split('\n').pop()); }
  catch (x) { parseErr = 'child printed no JSON (' + x.message + '); stdout tail: ' + String(r.stdout).slice(-300) + '\n'; }
  return { j, status: r.status, err: parseErr + String(r.stderr || '') };
};

/* NOT YET PER REGULATION — the closure members that are ENGINE INPUTS rather than gate evidence. Each is
 * derived from the format or its store and so is per regulation in truth; none is read by a clause, so
 * none can make the Reg M-C gate read a Reg M-B number, and every one is still protected from a Reg M-C
 * WRITE by the deny-by-default guard. Moving one to a sibling is ENGINE's call (its builder must learn
 * the regulation first, as build_engine_data_regmc.js and tag_dex.js did). Printed on every run. */
const NOT_YET = {
  [J('ability-blocks')]: 'ENGINE — built from engine/board.js; frozen into releases',
  [JS('abra-tags')]: 'ENGINE — browser bundle of the tag file; follows data/tags.json when it is rebuilt',
  [J('fixture-legality-baseline')]: 'ENGINE — legality baseline of the staged fixtures',
  [J('mega-dex-official')]: 'ENGINE — mega formes; source of the table, which is per regulation',
  [J('mega-dex')]: 'ENGINE — mega harvest; source of the table',
  [J('meta-usage')]: 'OPS — the CHOMP-facing usage model; engine/analyze.js has its own regulation handling',
  [JS('move-effects')]: 'ENGINE — browser bundle built from the table',
  [J('regulations')]: 'CONFIG — the one file that names every regulation; shared by construction',
  [J('residual-order')]: 'ENGINE — residual order, derived from the format',
  [J('smogon-priors')]: 'OPS — Smogon usage priors for Reg M-B',
};

/* ---- 1. the list against the gate's own derivation ------------------------------------------ */
console.log('1. THE PER-REGULATION LIST AGAINST THE GATE\'S DERIVED CLOSURE');
{
  const R = child(`
    const Q = require('./engine/quarantine.js');
    const g = Q.graph();
    if (g.error) { console.log(JSON.stringify({ error: g.error })); process.exit(0); }
    const src = Q.sources(), play = Q.playLayer(src), inputs = Q.gateInputArtifacts();
    const { closure } = Q.instrumentsOfTheGate(g, play, inputs);
    console.log(JSON.stringify({ inputs: [...inputs].sort(), closure: [...closure].sort() }));`);
  if (!R.j || R.j.error) {
    ok('the gate closure could be derived', false, (R.j && R.j.error) || R.err.slice(0, 600));
  } else {
    const REG = require('../engine/regulation.js');
    /* Every Reg M-B file the regulation map can replace, read off regulation.js (FILES is empty under
     * Reg M-B, which is the regulation this probe runs under). 2026-09-21: move-priors joined it. */
    const engineFile = f => (REG.FILE_DEFAULTS || []).includes('data/' + f)
      || [JS('engine-data'), J('tags'), J('protocol-events')].includes(f);
    ok('the closure is not empty (' + R.j.closure.length + ' artifacts, ' + R.j.inputs.length + ' gate inputs)',
      R.j.closure.length > 10 && R.j.inputs.length > 5);
    const loose = R.j.closure.filter(f => !REG.isPerRegulation(f) && !engineFile(f) && !NOT_YET[f]);
    ok('every artifact in the gate\'s path is per-regulation, an engine per-regulation file, or declared',
      !loose.length, 'UNDECLARED: ' + loose.join(', ') + ' — add a pattern to PER_REGULATION_ARTIFACTS in '
        + 'engine/regulation.js, or declare it in NOT_YET here with its owner and reason');
    const sharedInputs = R.j.inputs.filter(f => !REG.isPerRegulation(f) && !engineFile(f));
    ok('every GATE INPUT is per-regulation (a shared one is the M-C gate reading an M-B number)',
      !sharedInputs.length, 'SHARED GATE INPUTS: ' + sharedInputs.join(', '));
    const stale = Object.keys(NOT_YET).filter(f => !R.j.closure.includes(f));
    ok('no NOT_YET declaration is stale', !stale.length, 'no longer in the closure: ' + stale.join(', '));
    /* 2026-09-21 (abra/regmc 0.19.0) -- A DECLARATION THAT OUTLIVED ITS FIX. The steering inputs
     * (switch census, joint census, move priors) moved out of this list; one left behind would print
     * "NOT YET per-regulation" for a file that is, which is the stale-prose failure in a test. */
    const doubled = Object.keys(NOT_YET).filter(f => REG.isPerRegulation(f) || engineFile(f));
    ok('no NOT_YET declaration names a file that already follows the regulation', !doubled.length,
      'declared NOT YET and per-regulation at once: ' + doubled.join(', '));
    const perReg = R.j.closure.filter(f => REG.isPerRegulation(f));
    console.log('     per-regulation (' + perReg.length + '): ' + perReg.join(', '));
    console.log('     NOT YET per-regulation, write-guarded only (' + Object.keys(NOT_YET).length + '): '
      + Object.keys(NOT_YET).join(', '));
  }
}

/* ---- 2. the mapping, both directions -------------------------------------------------------- */
console.log('2. THE MAPPING, UNDER REG M-C AND UNDER REG M-B');
const NAMES = [J('data/game-differential'), J('data/game-differential.g1350'), J('data/game-differential.g12000'),
  J('data/engine-diff'), J('data/roster.items'), J('data/roster.all'), J('data/roster.moves.prev'),
  J('data/all-mechanics-fire'), J('data/all-mechanics-fire.boardstate'), J('data/mechanics-census'),
  J('data/engine-release'), J('data/published-samples'), J('data/whole-game-baseline'),
  J('data/quarantine-stamp'), J('data/decision-impact'), J('data/register-reality'), J('data/click-counts'),
  J('data/sheet-usage'), J('data/diff-team-pool'), 'data/team-pool-frozen', J('data/tags')];
const MAPCODE = `
  const REG = require('./engine/regulation.js');
  const Q = require('./engine/quarantine.js');
  console.log(JSON.stringify({ id: REG.ID, tag: REG.ARTIFACT_TAG,
    map: ${JSON.stringify(NAMES)}.map(f => [f, REG.artifactFor(f)]),
    lattice: Q.LATTICE_SAMPLES.map(s => [s.games, s.file]) }));`;
{
  const MC = child(MAPCODE, { ABRA_REGULATION: 'regmc' });
  const MB = child(MAPCODE, {});
  if (!MC.j || !MB.j) {
    ok('both mapping probes ran', false, (MC.err || '') + (MB.err || ''));
  } else {
    ok('Reg M-C: the probe answered for regmc', MC.j.id === 'regmc' && MC.j.tag === 'regmc', JSON.stringify(MC.j).slice(0, 200));
    const unmoved = MC.j.map.filter(([a, b]) => a === b || !/-regmc(\.[a-z]+)?$/.test(b));
    ok('Reg M-C: every per-regulation name moves to a -regmc sibling', !unmoved.length, JSON.stringify(unmoved));
    ok('Reg M-C: the pool is data/team-pool-frozen-regmc',
      MC.j.map.find(([a]) => a === 'data/team-pool-frozen')[1] === 'data/team-pool-frozen-regmc');
    ok('Reg M-C: the gate reads a declared lattice, every sample a -regmc file',
      MC.j.lattice.length >= 3 && MC.j.lattice.every(([, f]) => /-regmc\.json$/.test(f)), JSON.stringify(MC.j.lattice));
    ok('Reg M-C: no lattice sample is a Reg M-B file',
      !MC.j.lattice.some(([, f]) => MB.j.lattice.some(([, g]) => g === f)));
    ok('Reg M-B: nothing moves', MB.j.id === 'regmb' && MB.j.tag === null && MB.j.map.every(([a, b]) => a === b),
      JSON.stringify(MB.j.map.filter(([a, b]) => a !== b)));
    ok('Reg M-B: the lattice is exactly the three files the gate read before 2026-09-21',
      JSON.stringify(MB.j.lattice) === JSON.stringify([[1200, J('data/game-differential')],
        [1350, J('data/game-differential.g1350')], [1950, J('data/game-differential.g1950')]]), JSON.stringify(MB.j.lattice));
  }
}

/* ---- 3. the seam, in a sandbox -------------------------------------------------------------- */
console.log('3. THE SEAM, IN A THROWAWAY ROOT (no real file is ever at risk)');
const PROBE = `
  const fs = require('fs'), path = require('path');
  const REG = require('./engine/regulation.js');
  const J = (stem) => stem + '.json';
  const res = {};
  const tryit = (k, f) => { try { const v = f(); res[k] = 'ok' + (v === undefined ? '' : ':' + v); }
    catch (e) { res[k] = (/REFUSING/.test(e.message) ? 'REFUSED' : (e.code || 'ERR')) ; } };
  tryit('write_declared', () => fs.writeFileSync(J('data/game-differential'), 'NEW'));
  tryit('read_declared_absent', () => fs.readFileSync(J('data/game-differential.g1350'), 'utf8'));
  tryit('exists_declared_absent', () => fs.existsSync(J('data/game-differential.g1350')));
  tryit('write_undeclared', () => fs.writeFileSync(J('data/meta-usage'), 'NEW'));
  tryit('append_undeclared', () => fs.appendFileSync(J('data/meta-usage'), 'NEW'));
  tryit('rename_onto', () => { fs.writeFileSync(J('data/_tmp-new'), 'NEW'); fs.renameSync(J('data/_tmp-new'), J('data/meta-usage')); });
  tryit('copy_onto', () => fs.copyFileSync(J('data/_tmp-src'), J('data/meta-usage')));
  tryit('unlink', () => fs.unlinkSync(J('data/meta-usage')));
  tryit('stream', () => { fs.createWriteStream(J('data/meta-usage')).destroy(); });
  tryit('open_w', () => { fs.closeSync(fs.openSync(J('data/meta-usage'), 'w')); });
  tryit('open_r', () => { fs.closeSync(fs.openSync(J('data/meta-usage'), 'r')); });
  tryit('abs_path', () => fs.writeFileSync(path.resolve('data', J('meta-usage')), 'NEW'));
  tryit('subdir', () => fs.writeFileSync('data/team-pool-frozen/FROZEN.md', 'NEW'));
  tryit('new_file', () => fs.writeFileSync(J('data/brand-new'), 'NEW'));
  tryit('release', () => fs.writeFileSync(J('data/releases/abcdef012345/x'), 'NEW'));
  res.stats = REG.artifacts();
  console.log(JSON.stringify(res));`;
function sandbox() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-regart-'));
  fs.mkdirSync(path.join(T, 'engine'));
  fs.mkdirSync(path.join(T, 'data', 'team-pool-frozen'), { recursive: true });
  fs.mkdirSync(path.join(T, 'data', 'releases', 'abcdef012345'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'engine', 'regulation.js'), path.join(T, 'engine', 'regulation.js'));
  fs.copyFileSync(path.join(ROOT, 'data', J('regulations')), path.join(T, 'data', J('regulations')));
  for (const f of [J('game-differential'), J('game-differential.g1350'), J('meta-usage'), J('_tmp-src'),
    'team-pool-frozen/FROZEN.md', J('releases/abcdef012345/x')]) fs.writeFileSync(path.join(T, 'data', f), 'MB');
  return T;
}
/* null means ABSENT and nothing else; any other failure is thrown, so a read error cannot pose as absence */
const rd = (T, f) => {
  try { return fs.readFileSync(path.join(T, 'data', f), 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
};
{
  const T = sandbox();
  const R = child(PROBE, { ABRA_REGULATION: 'regmc' }, T);
  if (!R.j) ok('the Reg M-C probe ran', false, R.err.slice(0, 800));
  else {
    const j = R.j;
    ok('RED under M-C: a declared write lands on the sibling', j.write_declared === 'ok'
      && rd(T, J('game-differential-regmc')) === 'NEW' && rd(T, J('game-differential')) === 'MB', JSON.stringify(j));
    ok('an absent sibling reads ENOENT, never Reg M-B\'s file', j.read_declared_absent === 'ENOENT'
      && j.exists_declared_absent === 'ok:false', j.read_declared_absent + ' / ' + j.exists_declared_absent);
    for (const k of ['write_undeclared', 'append_undeclared', 'rename_onto', 'copy_onto', 'unlink', 'stream', 'open_w', 'abs_path', 'subdir']) {
      ok('an existing Reg M-B file is REFUSED: ' + k, j[k] === 'REFUSED', k + ' -> ' + j[k]);
    }
    ok('...and it is byte-for-byte untouched', rd(T, J('meta-usage')) === 'MB' && rd(T, 'team-pool-frozen/FROZEN.md') === 'MB');
    ok('reading an existing file is not a write', j.open_r === 'ok', j.open_r);
    ok('a NEW file is allowed (it overwrites nothing)', j.new_file === 'ok' && rd(T, J('brand-new')) === 'NEW');
    ok('data/releases/ is exempt (content-addressed)', j.release === 'ok');
    ok('the seam counts what it did', j.stats && j.stats.installed === true && j.stats.redirects >= 3
      && j.stats.writesRefused >= 8, JSON.stringify(j.stats));
  }
  fs.rmSync(T, { recursive: true, force: true });
}
{
  /* THE CONTROL — the same probes with nothing selected. If these also refused, the knob would be unwired. */
  const T = sandbox();
  const R = child(PROBE, {}, T);
  if (!R.j) ok('the Reg M-B control probe ran', false, R.err.slice(0, 800));
  else {
    ok('CONTROL under M-B: the same write goes to the plain name', R.j.write_declared === 'ok'
      && rd(T, J('game-differential')) === 'NEW' && rd(T, J('game-differential-regmc')) === null);
    ok('CONTROL under M-B: nothing is refused and no seam is installed', !Object.values(R.j).includes('REFUSED')
      && R.j.stats.installed === false, JSON.stringify(R.j));
  }
  fs.rmSync(T, { recursive: true, force: true });
}

/* ---- 4. the gate's first line ----------------------------------------------------------------- */
console.log('4. THE GATE NAMES THE REGULATION IT ANSWERED FOR');
{
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'quarantine.js'), 'utf8');
  const i = src.indexOf("console.log('REGULATION: ' + REG.ID");
  const j = src.indexOf("console.log('QUARANTINE — everything downstream of MEDICHAM is withheld until MEDICHAM is correct');");
  ok('the report prints REGULATION: <id> immediately before its QUARANTINE header', i > 0 && j > i && j - i < 400);
}

console.log('\nREGULATION ARTIFACTS: ' + (ran - bad) + ' passed, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
