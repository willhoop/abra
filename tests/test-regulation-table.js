/* test-regulation-table.js — THE DAMAGE TABLE FOLLOWS THE SELECTED REGULATION, AND SO DOES A RELEASE.
 *
 * 2026-09-21 (MEASURE). `engine/regulation.js` resolves every require of `data/engine-data.js` to the
 * selected regulation's own table (`runtime.<id>.engineData`), and `engine/engine_release.js` freezes
 * that table into a release cut while the regulation is selected. This file holds both halves to the
 * behaviour they claim, from the CONSUMER side — by loading the table the way callers do and counting
 * the rows `globalThis.MC` ends up with, never by reading the resolver's own bookkeeping alone.
 *
 * EACH REGULATION RUNS IN ITS OWN CHILD. The selection is made once, at module load, so one process
 * cannot hold both. `SHOWDOWN_PATH` is dropped from each child: tests/run-all.js propagates the
 * default checkout, and an explicit path beats the regulation's own (see engine/regulation.js).
 *
 * THE KNOB IS VARIED AND THE CONTROL COULD HAVE SEEN IT. The two arms must report DIFFERENT row counts
 * and the counts must equal each file compiled directly; an unwired resolver gives the same answer in
 * both arms, and that is a failure here, not a pass.
 *
 * Releases are cut into a THROWAWAY store (`{ store }`), as tests/test-engine-release.js does, so the
 * real pointer and release store are never written. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '  — ' + detail : '')); }
  else { fails.push(name); console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

/* MOVE rows in a table file, compiled directly — the independent reading the arms are held to. Move
 * rows, not mon rows: enumerating a mons table outside engine/mc_key.js is what tests/test-mc-key.js
 * forbids, and the two tables differ in both. */
function rowsOf(rel) {
  const sandbox = {};
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  new Function('globalThis', 'module', src)(sandbox, undefined);
  return Object.keys(sandbox.MC.moves).length;
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-regtable-'));
function child(reg, body) {
  const env = Object.assign({}, process.env);
  delete env.SHOWDOWN_PATH;
  delete env.ABRA_REGULATION;
  if (reg) env.ABRA_REGULATION = reg;
  const r = spawnSync(process.execPath, ['-e', body], { cwd: ROOT, env, encoding: 'utf8', timeout: 300000 });
  const m = /RESULT (\{.*\})/.exec(r.stdout || '');
  if (!m) {
    console.log('  child (' + (reg || 'default') + ') produced no result, exit ' + r.status + ':\n'
      + String(r.stderr || '').split('\n').slice(-12).join('\n'));
    return null;
  }
  return JSON.parse(m[1]);
}
const J = JSON.stringify;

/* One child body, run under each regulation: load the table BY PATH (the way ~130 callers do), then
 * cut a release into the throwaway store and load the table out of it through REL.require. */
const ARM = `
  const path = require('path');
  const out = {};
  require('./engine/regulation.js');
  require(path.join(process.cwd(), 'data', 'engine-data.js'));
  out.rows = Object.keys(globalThis.MC.moves).length;
  out.loaded = Object.keys(require.cache).filter(k => /engine-data/.test(k)).map(k => path.basename(k));
  const REG = require('./engine/regulation.js');
  out.table = REG.table();
  const ER = require('./engine/engine_release.js');
  out.sourcesNow = ER.sourcesNow().length; out.sources = ER.SOURCES.length;
  const S = { store: ${J(TMP)} };
  const man = ER.cut('test-regulation-table', Object.assign({ allowAuthorityDrift: true }, S));
  out.id = man.id; out.regulation = man.regulation || null; out.engine_data = man.engine_data || null;
  out.frozen = Object.keys(man.files).filter(k => /engine-data/.test(k));
  delete globalThis.MC;
  const REL = ER.open(man.id, S);
  REL.require('data/engine-data.js');
  out.relRows = Object.keys(globalThis.MC.moves).length;
  out.relLoaded = Object.keys(require.cache).filter(k => /releases/.test(k) && /engine-data/.test(k)).map(k => path.basename(k));
  /* THE TAG FILE, the way the engine reads it (engine/tags.js requires data/tags.json by path), live
   * and out of the release through both REL.require and REL.read. */
  const T = require('./engine/tags.js');
  T.tagsFor('ability', 'intimidate');   /* forces the load */
  const liveTags = Object.keys(require.cache).filter(k => /[\\\\/]data[\\\\/]tags(-\\w+)?\\.json$/.test(k) && !/releases/.test(k));
  out.tagsLoaded = liveTags.map(k => path.basename(k));
  out.tagAbilities = liveTags.length === 1 ? Object.keys(require.cache[liveTags[0]].exports.abilities).length : -1;
  out.frozenTags = Object.keys(man.files).filter(k => /^data\\/tags/.test(k));
  /* 2026-09-21 (abra/regmc 0.19.0) -- and the behaviour table, read through REL.read by the empirical arm. */
  out.frozenPriors = Object.keys(man.files).filter(k => /^data\\/move-priors/.test(k));
  out.relPriorsPath = path.basename(REL.path('data/move-priors.json'));
  out.relTagAbilities = Object.keys(JSON.parse(REL.read('data/tags.json')).abilities).length;
  out.relTagPath = path.basename(REL.path('data/tags.json'));
  console.log('RESULT ' + JSON.stringify(out));
`;
/* The tag files compiled directly — the independent reading the arms are held to. */
const tagAbilitiesOf = rel => Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).abilities).length;

console.log('\nTHE DAMAGE TABLE FOLLOWS THE REGULATION\n');
const MB_ROWS = rowsOf('data/engine-data.js');
const MC_ROWS = rowsOf('data/engine-data-regmc.js');
ok('the two table files differ, so the arms CAN be told apart', MB_ROWS !== MC_ROWS, MB_ROWS + ' vs ' + MC_ROWS + ' rows');

const mb = child(null, ARM);
const mc = child('regmc', ARM);
ok('both children ran', !!mb && !!mc);
if (mb && mc) {
  /* 1. Reg M-B (nothing selected) is the old code path: no resolver, the default table, the old list. */
  ok('1  default: the table loaded by path is data/engine-data.js', mb.rows === MB_ROWS && J(mb.loaded) === J(['engine-data.js']),
    mb.rows + ' rows, loaded ' + mb.loaded.join(','));
  ok('1  default: NO resolver is installed and nothing is redirected', mb.table.installed === false && mb.table.redirects === 0);
  ok('1  default: a cut freezes exactly SOURCES', mb.sourcesNow === mb.sources, mb.sourcesNow + ' of ' + mb.sources);
  ok('1  default: the release holds no other regulation\'s table and names no regulation',
    J(mb.frozen) === J(['data/engine-data.js']) && mb.regulation === null && mb.engine_data === null, mb.frozen.join(','));
  ok('1  default: the table out of the release is M-B\'s', mb.relRows === MB_ROWS, mb.relRows + ' rows');

  /* 2. Reg M-C: the SAME require reads the M-C table, live and out of a release. */
  ok('2  regmc: the same require by path loads data/engine-data-regmc.js', mc.rows === MC_ROWS && J(mc.loaded) === J(['engine-data-regmc.js']),
    mc.rows + ' rows, loaded ' + mc.loaded.join(','));
  ok('2  regmc: the resolver is installed and counted its redirects', mc.table.installed === true && mc.table.redirects >= 1,
    mc.table.redirects + ' redirect(s)');
  /* +2 since 2026-09-21: the table AND the tag file (engine/engine_release.js REGULATION_SOURCES).
   * +3 since abra/regmc 0.19.0: and the behaviour table, which REL.read then serves in place of Reg M-B's. */
  ok('2  regmc: a cut freezes SOURCES plus the M-C table, tag file and behaviour table', mc.sourcesNow === mc.sources + 3
    && mc.frozenTags.includes('data/tags-regmc.json') && (mc.frozenPriors || []).includes('data/move-priors-regmc.json')
    && mc.relPriorsPath === 'move-priors-regmc.json',
    mc.sourcesNow + ' vs ' + mc.sources + '; ' + mc.frozenTags.join(',') + '; ' + (mc.frozenPriors || []).join(',') + '; REL.path -> ' + mc.relPriorsPath);
  ok('2  regmc: the release contains the M-C table and names its regulation',
    mc.frozen.includes('data/engine-data-regmc.js') && mc.regulation === 'regmc' && mc.engine_data === 'data/engine-data-regmc.js',
    mc.frozen.join(','));
  ok('2  regmc: REL.require of the table out of that release reads the FROZEN M-C table',
    mc.relRows === MC_ROWS && J(mc.relLoaded) === J(['engine-data-regmc.js']), mc.relRows + ' rows from ' + mc.relLoaded.join(','));

  /* 2b. THE TAG FILE FOLLOWS THE SAME RULE (2026-09-21, ENGINE). Varied knob, and the arms must differ. */
  const MB_TAB = tagAbilitiesOf('data/tags.json'), MC_TAB = tagAbilitiesOf('data/tags-regmc.json');
  ok('2b the two tag files differ, so the arms CAN be told apart', MB_TAB !== MC_TAB, MB_TAB + ' vs ' + MC_TAB + ' ability rows');
  ok('2b default: engine/tags.js reads data/tags.json, live and out of the release',
    mb.tagAbilities === MB_TAB && J(mb.tagsLoaded) === J(['tags.json']) && mb.relTagAbilities === MB_TAB
    && mb.relTagPath === 'tags.json' && J(mb.frozenTags) === J(['data/tags.json']),
    mb.tagAbilities + ' / ' + mb.relTagAbilities + ' rows, ' + mb.tagsLoaded.join(','));
  ok('2b regmc: the SAME reads give data/tags-regmc.json, live (require) and out of the release (REL.read / REL.path)',
    mc.tagAbilities === MC_TAB && J(mc.tagsLoaded) === J(['tags-regmc.json']) && mc.relTagAbilities === MC_TAB
    && mc.relTagPath === 'tags-regmc.json',
    mc.tagAbilities + ' / ' + mc.relTagAbilities + ' rows, ' + mc.tagsLoaded.join(',') + ', REL.path -> ' + mc.relTagPath);

  /* 3. One tree, two regulations, two releases — never one id serving both. */
  ok('3  the same tree cut under each regulation yields two DIFFERENT release ids', mb.id !== mc.id, mb.id + ' vs ' + mc.id);

  /* 4. A release serves the regulation it was cut for; the other is refused at open, by name. */
  const openAs = (reg, id) => child(reg, `
    const ER = require('./engine/engine_release.js');
    let err = null; try { ER.open(${J(id)}, { store: ${J(TMP)} }); } catch (e) { err = String(e.message).split('\\n')[0]; }
    console.log('RESULT ' + JSON.stringify({ err }));`);
  const x1 = openAs('regmc', mb.id), x2 = openAs(null, mc.id), x3 = openAs(null, mb.id), x4 = openAs('regmc', mc.id);
  ok('4  an M-B release is REFUSED under regmc', !!(x1 && x1.err && /was cut for the damage table/.test(x1.err)), x1 && x1.err);
  ok('4  an M-C release is REFUSED under the default', !!(x2 && x2.err && /was cut for the damage table/.test(x2.err)), x2 && x2.err);
  ok('4  CONTROL: each release still opens under its own regulation', !!(x3 && x3.err === null && x4 && x4.err === null),
    (x3 && x3.err) || (x4 && x4.err) || 'both opened');
}

/* 5. Load order. Reg M-B's table loaded BEFORE the resolver, under regmc, is refused at the door —
 * never carried on with. The control loads the same two files in the other order. */
const late = child('regmc', `
  const path = require('path'); let err = null;
  require(path.join(process.cwd(), 'data', 'engine-data.js'));
  try { require('./engine/mc_key.js'); } catch (e) { err = String(e.message).split('\\n')[0]; }
  console.log('RESULT ' + JSON.stringify({ err, rows: Object.keys(globalThis.MC.moves).length }));`);
const early = child('regmc', `
  const path = require('path'); let err = null;
  try { require('./engine/mc_key.js'); } catch (e) { err = String(e.message).split('\\n')[0]; }
  require(path.join(process.cwd(), 'data', 'engine-data.js'));
  console.log('RESULT ' + JSON.stringify({ err, rows: Object.keys(globalThis.MC.moves).length }));`);
ok('5  regmc: M-B\'s table loaded before the door is REFUSED when the door loads',
  !!(late && late.err && /REFUSING/.test(late.err)), late && late.err);
ok('5  CONTROL: door first, then the table — no refusal, and the M-C table loads',
  !!(early && early.err === null && early.rows === MC_ROWS), early && (early.err || early.rows + ' rows'));

/* 6. THE WRITE GUARD (2026-09-21, ENGINE). Under regmc a write onto the live tree's Reg M-B tag file or
 * protocol-events file is REFUSED and the file is untouched; the CONTROL writes a same-named file in a
 * throwaway `data/` directory (the shape a release copy has) and is allowed, so the guard is scoped to
 * the live tree and is not simply refusing every file called tags.json. Nothing here writes the real
 * Reg M-B file: the refused write never reaches the disk, and its bytes are compared before and after. */
const GUARD_TMP = path.join(TMP, 'guard', 'data');
const guard = child('regmc', `
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  const REG = require('./engine/regulation.js');
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const out = {};
  for (const f of ['tags.json', 'protocol-events.json']) {
    const live = path.join(process.cwd(), 'data', f);
    const before = sha(live);
    /* THE PROBE WRITES THE FILE'S OWN BYTES BACK, so a broken guard costs an mtime and never the file.
     * The first version of this clause wrote '{}' and, run against a deliberate break, emptied Reg
     * M-B's data/tags.json — restored from git, and the reason for this line. */
    const same = fs.readFileSync(live);
    let err = null; try { fs.writeFileSync(live, same); } catch (e) { err = String(e.message).split('\\n')[0]; }
    out[f] = { err, unchanged: sha(live) === before };
  }
  fs.mkdirSync(${J(GUARD_TMP)}, { recursive: true });
  let cerr = null; try { fs.writeFileSync(path.join(${J(GUARD_TMP)}, 'tags.json'), '{}'); } catch (e) { cerr = e.message; }
  out.control = cerr; out.refused = REG.table().writesRefused;
  console.log('RESULT ' + JSON.stringify(out));`);
ok('6  regmc: a write onto the live data/tags.json is REFUSED and the file is byte-identical',
  !!(guard && guard['tags.json'].err && /REFUSING/.test(guard['tags.json'].err) && guard['tags.json'].unchanged),
  guard && guard['tags.json'].err);
ok('6  regmc: a write onto the live data/protocol-events.json is REFUSED and the file is byte-identical',
  !!(guard && guard['protocol-events.json'].err && /REFUSING/.test(guard['protocol-events.json'].err) && guard['protocol-events.json'].unchanged),
  guard && guard['protocol-events.json'].err);
ok('6  CONTROL: a tags.json in another data/ directory is written, and the refusals were counted',
  !!(guard && guard.control === null && guard.refused === 2), guard && ('control ' + guard.control + ', refused ' + guard.refused));

try { fs.rmSync(TMP, { recursive: true, force: true }); }
catch (e) { console.log('  (could not remove the throwaway store ' + TMP + ': ' + e.message + ')'); }

console.log('\n  ' + pass + ' passed, ' + fails.length + ' failed');
process.exit(fails.length ? 1 : 0);
