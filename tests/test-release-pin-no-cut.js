/* test-release-pin-no-cut.js — A RUN PINNED WITH --release NEVER CUTS, AND A CHILD INHERITS THE PIN.
 *
 *   node tests/test-release-pin-no-cut.js          exit 0 green, 1 red, 2 CANNOT-ANSWER (no SHOWDOWN_PATH)
 *
 * THE RECEIPT, 2026-09-19. Release d92bdfb50d88 gained 205 cut events in 103 seconds, every one reading
 * "game differential mode A", while every measurement on it passed `--release`. The writer was not a
 * measurement. `node -e "require('./tests/roster.js')"` reproduces 101 of them in one command:
 *
 *   - under `node -e` / `node -p` there is no script, so `process.argv` is [node, ...userArgs] and the
 *     user arguments start at index ONE. `engine/game_differential.js` read `process.argv.slice(2)`,
 *     so the pin that tests/roster.js pushes (`process.argv.push('--release', id)`) lost its FLAG and
 *     the driver saw a bare id. It cut.
 *   - and it cut on EVERY load, because tests/staged_board.js drops the driver from the require cache
 *     and re-requires it once per patched simulator. One command, 101 loads, 101 events.
 *
 * Chronic, not one agent: 6,778 of the 7,753 cut events on disk across 677 releases carry the driver's
 * `why`, and f30bf025ae28 alone holds 1,305. Nothing it wrote changed a frozen byte (a cut of an identical
 * tree appends and keeps its id) — but an unpinned cut over a MOVED tree repoints data/engine-release.json
 * under whoever is measuring, and gives the driver a different snapshot from the one staged_board patched.
 *
 * WHAT IS ASSERTED, each in its own process so no module state leaks between arms:
 *   A  PINNED UNDER `node -e`, LOADED TWICE      -> 0 cuts.                                        (RED before)
 *   B  PINNED PARENT, UNPINNED CHILD PROCESS     -> 0 cuts in the child, and it holds the parent's id. (RED before)
 *   C  UNPINNED, LOADED TWICE                    -> exactly 1 cut. The CONTROL: the counter is live, and a
 *                                                   re-load reuses the process's own photograph.  (2 before)
 * and, around all three, the REAL store's event log for the pinned release is not one line longer.
 *
 * NOTHING HERE TOUCHES THE REAL STORE. A preload written into a temp directory wraps `cut` and `open`
 * exactly as tests/_live_release.js does, sends every cut to a throwaway store, and counts it. `open`
 * tries the throwaway store first and falls back to the real one read-only. No game is played: the
 * driver is loaded, never run.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is not set; the driver refuses to load without the authority.');
  console.log('ABRA-EXIT 2 CANNOT-ANSWER');
  process.exit(2);
}

const ER = require(D('engine', 'engine_release.js'));
const GD = D('engine', 'game_differential.js').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-pin-no-cut-'));
const STORE = path.join(TMP, 'store');
const LOG = path.join(TMP, 'cuts.log');
const PRE = path.join(TMP, 'count_cuts.js');

fs.writeFileSync(PRE, `'use strict';
const fs = require('fs');
const ER = require(${JSON.stringify(D('engine', 'engine_release.js'))});
const _cut = ER.cut, _open = ER.open;
ER.cut = (why, opts) => {
  fs.appendFileSync(${JSON.stringify(LOG)}, JSON.stringify({ pid: process.pid, why: String(why).slice(0, 60) }) + '\\n');
  return _cut(why, Object.assign({}, opts || {}, { store: ${JSON.stringify(STORE)} }));
};
ER.open = (id, opts) => {
  try { return _open(id, Object.assign({}, opts || {}, { store: ${JSON.stringify(STORE)} })); }
  catch (e) { if (!id) throw e; return _open(id, opts); }
};
`);

let fail = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) fail++;
};
const cuts = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length : 0);
const reset = () => { if (fs.existsSync(LOG)) fs.unlinkSync(LOG); };
/* A clean environment: an ABRA_RELEASE_PIN left in the shell must not decide arm A or C. */
const baseEnv = () => { const e = { ...process.env }; delete e.ABRA_RELEASE_PIN; return e; };
function run(args, env) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=4096', '-r', PRE, ...args],
    { cwd: ROOT, env: env || baseEnv(), encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 26 });
  const held = /HELD (\S+)/.exec(String(r.stdout || ''));
  return { status: r.status, held: held ? held[1] : null,
           tail: (String(r.stderr || '') + String(r.stdout || '')).split('\n').filter(Boolean).slice(-4).join(' | ') };
}

/* THE PIN. Freeze the live tree into the throwaway store, so every arm has an id that exists and can
 * be opened without the real store being written. */
const PIN = ER.cut('tests/test-release-pin-no-cut.js — the pin the arms name', { store: STORE }).id;
const REAL_LOG = D('data', 'releases', PIN, 'cuts.jsonl');
const realBefore = fs.existsSync(REAL_LOG) ? fs.readFileSync(REAL_LOG, 'utf8').split('\n').filter(Boolean).length : null;
console.log('  pin ' + PIN + '   throwaway store ' + STORE);

/* Load the driver, drop it from the cache, load it again — what tests/staged_board.js's harness does
 * once per patched simulator. */
const TWICE_JS = path.join(TMP, 'load_twice.js');
fs.writeFileSync(TWICE_JS, `const p = ${JSON.stringify(GD)};
let G = require(p); delete require.cache[require.resolve(p)]; G = require(p);
console.log('HELD ' + G.REL.id);
`);
/* UNDER `node -e` THE DRIVER CANNOT FINISH LOADING AT ALL — `steering.driverCode` refuses with "no entry
 * file", because there is no script to digest. That refusal comes ~2,400 lines AFTER the release is
 * resolved, so it does not stop a cut, and it is exactly how the 2026-09-19 burst happened: every load
 * cut, then threw. Arm A therefore catches the load and asks only whether a cut happened first. */
const TWICE_EVAL = `const p = ${JSON.stringify(GD)};
for (let i = 0; i < 2; i++) {
  try { require(p); } catch (e) { console.log('LOAD-THREW ' + String(e.message).split('\\n')[0].slice(0, 90)); }
  delete require.cache[require.resolve(p)];
}`;

/* ---- A: pinned under node -e ---------------------------------------------------------------------- */
reset();
const a = run(['-e', TWICE_EVAL, '--', '--release', PIN]);
ok(a.status === 0, 'A  the pinned `node -e` process ran its two load attempts', a.status === 0 ? '' : 'exit ' + a.status + ': ' + a.tail);
ok(a.status === 0 && cuts() === 0, 'A  a run pinned with --release under `node -e` cut NOTHING across two loads',
   cuts() + ' cut event(s)' + (cuts() ? ' — the pin was invisible to the driver\'s argument parser' : ''));

/* ---- B: pinned parent, unpinned child ------------------------------------------------------------- */
reset();
const CHILD = path.join(TMP, 'child.js');
fs.writeFileSync(CHILD, `const G = require(${JSON.stringify(GD)}); console.log('HELD ' + G.REL.id);\n`);
const PARENT = path.join(TMP, 'parent.js');
fs.writeFileSync(PARENT, `'use strict';
const { spawnSync } = require('child_process');
const G = require(${JSON.stringify(GD)});
/* the child is started with the counting preload and NO --release; only the environment is inherited */
const r = spawnSync(process.execPath, ['--max-old-space-size=4096', '-r', ${JSON.stringify(PRE)}, ${JSON.stringify(CHILD)}],
  { encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 26 });
process.stdout.write(String(r.stdout || '')); process.stderr.write(String(r.stderr || ''));
process.exit(r.status === 0 ? 0 : 1);
`);
const b = run([PARENT, '--release', PIN]);
ok(b.status === 0, 'B  the pinned parent and its child both loaded the driver', b.status === 0 ? '' : 'exit ' + b.status + ': ' + b.tail);
ok(b.status === 0 && cuts() === 0, 'B  a child of a pinned run cut NOTHING', cuts() + ' cut event(s)' + (cuts() ? ' — the child did not inherit the pin' : ''));
ok(b.held === PIN, 'B  and the child holds the PARENT\'s release', 'held ' + b.held + ', pinned ' + PIN);

/* ---- C: unpinned, the control --------------------------------------------------------------------- */
reset();
const c = run([TWICE_JS]);
ok(c.status === 0, 'C  the unpinned process loaded the driver twice', c.status === 0 ? '' : 'exit ' + c.status + ': ' + c.tail);
ok(c.status === 0 && cuts() === 1, 'C  CONTROL: an unpinned process cuts EXACTLY ONCE, however often it re-loads the driver',
   cuts() + ' cut event(s)' + (cuts() === 1 ? '' : '. Zero would mean the counter is dead and A and B prove'
   + ' nothing; more than one is a new event per re-load'));
ok(c.held === PIN, 'C  and the one cut is the live tree, which is the pin', 'held ' + c.held + ', pinned ' + PIN);
/* AND THE EVENT NAMES ITS WRITER. The 205 on d92bdfb50d88 carried only the driver's own `why`. */
{
  const evs = fs.readFileSync(path.join(STORE, 'releases', PIN, 'cuts.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const last = evs[evs.length - 1] || {};
  ok(last.by && Number.isInteger(last.by.pid) && /load_twice\.js$/.test(String(last.by.entry)),
     'C  the cut event records WHICH process wrote it (`by.pid`, `by.entry`)', 'by = ' + JSON.stringify(last.by || null));
}

/* ---- the real store ------------------------------------------------------------------------------- */
const realAfter = fs.existsSync(REAL_LOG) ? fs.readFileSync(REAL_LOG, 'utf8').split('\n').filter(Boolean).length : null;
ok(realAfter === realBefore, 'the REAL store was not written by this test',
   'data/releases/' + PIN + '/cuts.jsonl ' + realBefore + ' -> ' + realAfter + ' line(s)');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + TMP + ': ' + e.message + ')'); }
console.log('\n' + (fail ? 'FAIL — ' + fail + ' assertion(s)' : 'PASS — a pinned run never cuts, and its children inherit the pin'));
process.exit(fail ? 1 : 0);
