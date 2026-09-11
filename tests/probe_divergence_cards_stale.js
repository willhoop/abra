#!/usr/bin/env node
/* tests/probe_divergence_cards_stale.js — ROADMAP #399.
 * ==================================================================================================
 * DOES THE CARD RENDERER SAY SO WHEN ITS DUMP IS FROM A DIFFERENT RUN THAN THE DIFFERENTIAL?
 *
 * engine/divergence_cards.js reads data/divergence-turns.json and prints the dump's own release in
 * the page header (`d.engine_release`) and never compares it with data/game-differential.json's. The
 * dump is only rewritten by a differential run given `--dump-games N --write`, so an ordinary run
 * leaves it behind — and Will's card review reads this page.
 *
 * THE REAL FILE, RUN FOR REAL, TO A TEMP PAGE. The tool is spawned with `--in` and `--out` pointed at
 * the scratch directory; nothing canonical is written.
 *
 *   RED ARM   a dump whose engine_release differs from the differential's (the real dump when they
 *             differ today; always also a copy re-stamped with a release that cannot exist). The
 *             render must refuse (non-zero exit) or carry a staleness banner.
 *   CONTROL   the same dump re-stamped with the differential's OWN release must render cleanly
 *             (exit 0, no banner). If the red arm and the control produce identical results the
 *             check inside the tool is unwired — which is the defect.
 *
 * The artifacts are read from `git show HEAD:` so a differential being rewritten beside this probe
 * cannot hand it a torn read. EXIT: 0 green / 1 red / 2 cannot answer. Plays no game.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const show = f => execFileSync('git', ['show', 'HEAD:' + f], { cwd: ROOT, maxBuffer: 1 << 30 }).toString();

let gd, dump;
try { gd = JSON.parse(show('data/game-differential.json')); } catch (e) { cannot('HEAD:data/game-differential.json unreadable: ' + e.message); }
try { dump = JSON.parse(show('data/divergence-turns.json')); } catch (e) { cannot('HEAD:data/divergence-turns.json unreadable: ' + e.message); }
const GD_REL = gd.engine_release, DUMP_REL = dump.engine_release;
if (!GD_REL) cannot('the differential carries no engine_release to compare against');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-cards-'));
/* RE-AIMED 2026-09-11 (ENGINE). MEASURE's 6.12.1 made the renderer REFUSE a dump whose release is not the
 * differential's, comparing against the LIVE data/game-differential.json. This probe reads HEAD's, so once
 * the live differential moved past HEAD its own CONTROL (a dump re-stamped with HEAD's release) was refused
 * too: exit 2, a 0-byte page, and no arm could be read. The renderer's own `--differential <path>` hands it
 * the SAME differential this probe read, so the control compares like with like again. */
const GD_PATH = path.join(TMP, 'differential.json');
fs.writeFileSync(GD_PATH, JSON.stringify(gd));
/* THE BANNER TEST IS A DIFFERENCE, NOT A WORD SEARCH. The first form of this probe grepped the page for
 * "stale"/"mismatch" and its CONTROL went red: a 438 KB page of real cards contains those words. So
 * each page is normalised — every release id in it replaced by a placeholder — and compared with the
 * control's normalised page. If a mismatched dump produces a page and output IDENTICAL to a matched
 * one, the tool did nothing with the mismatch: that is the defect, measured as an outcome. */
const RELS = [GD_REL, DUMP_REL, 'ffffffffffff'].filter(Boolean);
const norm = s => RELS.reduce((a, id) => a.split(id).join('<REL>'), String(s || ''));
function render(tag, d) {
  const inP = path.join(TMP, tag + '.json'), outP = path.join(TMP, tag + '.html');
  fs.writeFileSync(inP, JSON.stringify(d));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine', 'divergence_cards.js'), '--in', inP, '--out', outP, '--differential', GD_PATH],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const html = fs.existsSync(outP) ? fs.readFileSync(outP, 'utf8') : '';
  const text = (r.stdout || '') + (r.stderr || '');
  return { tag, rel: d.engine_release, status: r.status, refused: r.status !== 0, page: norm(html), out: norm(text).split(outP).join('<OUT>'),
           bytes: html.length, text: text.trim().split('\n').slice(-2).join(' | ') };
}

console.log('\ntests/probe_divergence_cards_stale.js — ROADMAP #399');
console.log('  HEAD data/game-differential.json  engine_release ' + GD_REL + '   generated ' + gd.generated);
console.log('  HEAD data/divergence-turns.json   engine_release ' + DUMP_REL + '   generated ' + dump.generated
  + '   (' + (dump.divergences || []).length + ' cards)');

const arms = [];
if (DUMP_REL !== GD_REL) arms.push({ red: true, r: render('real-dump', dump) });
arms.push({ red: true, r: render('planted-mismatch', Object.assign({}, dump, { engine_release: 'ffffffffffff' })) });
const ctl = render('control-matched', Object.assign({}, dump, { engine_release: GD_REL }));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const say = r => 'dump ' + r.rel + ' vs differential ' + GD_REL + ': exit ' + r.status + ', page ' + r.bytes + ' bytes';
console.log('\n  CONTROL');
ok(ctl.status === 0 && ctl.bytes > 0, 'a dump stamped with the differential\'s own release renders', say(ctl));
if (ctl.status !== 0 || !ctl.bytes) cannot('the renderer failed on the control, so no arm below can be read: ' + ctl.text);
console.log('\n  THE CELLS — does a mismatched dump produce anything the matched control does not?');
for (const a of arms) {
  const same = !a.r.refused && a.r.page === ctl.page && a.r.out === ctl.out;
  ok(!same, '[' + a.r.tag + '] a dump from another release is refused or marked',
     same ? 'cell: ' + say(a.r) + ' — page and console output are byte-identical to the control once release ids '
       + 'are blanked, so the renderer never compared the two releases' : null);
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + TMP + ': ' + e.message + ')'); }
console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
