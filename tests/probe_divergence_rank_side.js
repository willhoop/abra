#!/usr/bin/env node
/* tests/probe_divergence_rank_side.js — ROADMAP #349, ranking defect (1).
 * ==================================================================================================
 * CAN THE DIVERGENCE WORKLIST RANK A CAUSE BY AN ENTITY THAT ONLY OUR OWN LINE NAMES?
 *
 * engine/divergence_report.js ranks causes by `max_uses`, a max over the entities named by BOTH
 * lines of the pair. So a cause whose authority line names a rare ability and whose medicham line
 * names Protect is ranked by Protect's usage — the line that DIFFERS is the authority's, and the head
 * of the list names the line we emitted. The row's evidence: the head read "126,170 clicks, Protect"
 * where the differing line was a Protean typechange.
 *
 * THE REAL SCRIPT, ON A FIXTURE ARTIFACT, IN A SCRATCH TREE. divergence_report.js reads
 * `<its dir>/../data/game-differential.json` and requires only ./divergence_shape.js, so both files
 * are copied byte-for-byte into a temp tree with a two-cause fixture beside them and run there.
 * Nothing in the repository is read as input or written.
 *
 *   cause DEF   authority `|-activate|p2a: Kingambit|ability: Defiant`, ours `|move|p2a: Kingambit|Protect`
 *               mentions: ability defiant (authority line), move protect (OUR line)
 *   cause SIT   authority `|-enditem|p1a: Garchomp|Sitrus Berry|[eat]`, ours a `-damage` line
 *               mentions: item sitrusberry (authority line)
 *   Usage is read off the pinned release's data/tags.json (`uses`), not typed, and the probe refuses
 *   unless protect > sitrusberry > defiant — the only order in which the two rankings disagree.
 *
 * CELL: ranked by the differing line, SIT heads the list; ranked the current way, DEF heads it on
 * Protect's count. GREEN when SIT heads, or when DEF's printed row says which side its key came from.
 * CONTROL: the same fixture with the `protect` mention removed must put SIT first — so the red is
 * caused by the our-line mention and nothing else.
 * EXIT: 0 green / 1 red / 2 cannot answer. Plays no game.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', '2b5a6585d8cf');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };

let T;
try { T = JSON.parse(require(path.join(ROOT, 'engine', 'engine_release.js')).open(REL_ID).read('data/tags.json')); }
catch (e) { cannot('release ' + REL_ID + ' tags unreadable: ' + String(e && e.message || e)); }
const U = { protect: T.moves.protect.uses, sitrusberry: T.items.sitrusberry.uses, defiant: T.abilities.defiant.uses };
console.log('\ntests/probe_divergence_rank_side.js — ROADMAP #349');
console.log('  usage from release ' + REL_ID + ' data/tags.json: protect ' + U.protect + ', sitrusberry ' + U.sitrusberry + ', defiant ' + U.defiant);
if (!(U.protect > U.sitrusberry && U.sitrusberry > U.defiant))
  cannot('the fixture needs protect > sitrusberry > defiant for the two rankings to disagree');

const DEF = 'event missing from medicham2 :: |-activate|p2a: Kingambit|ability: Defiant <> |move|p2a: Kingambit|Protect|p2a: Kingambit';
const SIT = 'event missing from medicham2 :: |-enditem|p1a: Garchomp|Sitrus Berry|[eat] <> |-damage|p1a: Garchomp|92/183';
const fixture = (withOurs) => ({
  generated: new Date().toISOString(), engine_release: 'fixture-349', mode: 'fixture for ROADMAP #349',
  games: 961, diverged: 2, threw: 0, planted_divergence_proof_ok: true,
  classes: [{ cls: 'event missing from medicham2', games: 2, causes: [
    { cause: DEF, n: 1, max_uses: withOurs ? Math.max(U.defiant, U.protect) : U.defiant,
      mentions: [{ kind: 'ability', id: 'defiant', uses: U.defiant, legal: true }]
        .concat(withOurs ? [{ kind: 'move', id: 'protect', uses: U.protect, legal: true }] : []) },
    { cause: SIT, n: 1, max_uses: U.sitrusberry,
      mentions: [{ kind: 'item', id: 'sitrusberry', uses: U.sitrusberry, legal: true }] }] }],
});
function run(tag, fx) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-349-' + tag + '-'));
  fs.mkdirSync(path.join(dir, 'engine')); fs.mkdirSync(path.join(dir, 'data'));
  for (const f of ['divergence_report.js', 'divergence_shape.js'])
    fs.copyFileSync(path.join(ROOT, 'engine', f), path.join(dir, 'engine', f));
  fs.writeFileSync(path.join(dir, 'data', 'game-differential.json'), JSON.stringify(fx));
  const r = spawnSync(process.execPath, [path.join(dir, 'engine', 'divergence_report.js'), '--all'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + dir + ': ' + e.message + ')'); }
  const out = (r.stdout || '') + (r.stderr || '');
  const L = out.split(/\r?\n/);
  const at = L.findIndex(l => /THE WORKLIST/.test(l));
  const rows = at < 0 ? [] : L.slice(at + 2).filter(l => /Kingambit|Garchomp/.test(l)).slice(0, 2);
  return { status: r.status, out, rows, head: rows[0] || '' };
}
const R = run('red', fixture(true));
const C = run('ctl', fixture(false));
if (R.status !== 0 || C.status !== 0 || !R.rows.length || !C.rows.length)
  cannot('the report did not run on the fixture (exit ' + R.status + '/' + C.status + '): '
    + (R.out || C.out).trim().split('\n').slice(-3).join(' | '));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
console.log('\n  CONTROL — protect not mentioned:');
for (const r of C.rows) console.log('      ' + r.trim());
ok(/Garchomp/.test(C.head), 'with only authority-line entities, the Sitrus cause heads the list');
console.log('\n  THE CELL — protect mentioned by OUR line of the Defiant cause:');
for (const r of R.rows) console.log('      ' + r.trim());
const sideShown = /\b(ours|medicham line|our line|from medicham|\[me\]|side)\b/i.test(R.rows.find(r => /Kingambit/.test(r)) || '');
ok(/Garchomp/.test(R.head) || sideShown,
   'the worklist ranks by the differing line, or says which side its ranking key came from',
   'cell: the head row is the Defiant cause at ' + U.protect.toLocaleString() + ' uses — move/protect, named only by the '
     + 'medicham line — above the Sitrus cause at ' + U.sitrusberry.toLocaleString() + '; no side is printed beside the key');

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
