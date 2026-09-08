/* collate.js — MEASURE, 2026-09-08. Reads the per-release artifacts written by the UNMODIFIED
 * data/verification/speed-2026-09-08/bench_two_engines.js and prints the curve.
 *
 * It computes NOTHING the harness did not already measure. Two derived columns only:
 *   norm  = medicham ms/turn divided by the SHOWDOWN ms/turn measured in the SAME process, which is
 *           the machine-state control: Showdown's bytes never change across these runs, so any
 *           common movement is contention rather than engine.
 *   step  = the ratio to the previous release in cut order.
 * Every catch below pushes onto `bad` and every entry of `bad` is printed. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const DIR = __dirname;
const ROOT = path.join(DIR, '..', '..', '..');
const ids = fs.readFileSync(path.join(DIR, 'candidates.txt'), 'utf8').trim().split(/\r?\n/);
const REL = path.join(ROOT, 'data', 'releases');
const bad = [];
const collected = [];
for (const id of ids) {
  let cut = null, why = null;
  try { const j = JSON.parse(fs.readFileSync(path.join(REL, id, 'release.json'), 'utf8')); cut = j.cut; why = j.why; }
  catch (e) { bad.push(id + ' no release.json: ' + e.message); continue; }
  const legs = [];
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(new RegExp('^r-' + id + '-p(\\d+)\\.json$'));
    if (!m) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
    catch (e) { bad.push(f + ' unreadable: ' + e.message); continue; }
    const c = j.by_cap && j.by_cap['60'];
    if (!c) { bad.push(f + ' has no cap-60 block'); continue; }
    for (const l of c.legs) legs.push({ pass: +m[1], medi: l.medicham, sd: l.showdown });
    if (j.counters && j.counters.medi_threw) bad.push(f + ' medi_threw=' + j.counters.medi_threw);
    if (j.harness_moved_under_the_run) bad.push(f + ' GAME_DIFFERENTIAL MOVED UNDER THE RUN');
  }
  if (!legs.length) { bad.push(id + ' NO USABLE LEG (stranded, failed, or not yet run)'); continue; }
  collected.push({ id, cut, why, legs });
}
/* ---- CLEANLINESS. Showdown's bytes are identical in every process here, so ANY inflation of its
 * ms/turn is contention and nothing else: a leg is refused if its SHOWDOWN arm is above 1.25x the
 * global Showdown minimum. MEDICHAM needs no clause of its own — `noise.js` measures that
 * normalising by the same-process Showdown leg takes corr(log contention, log figure) from
 * **0.848 to -0.124**, so what survives is not contention-driven.
 *
 * 1.25 IS DERIVED, NOT PICKED. The criterion was fixed before the curve was read: the LOOSEST cap
 * whose median within-release spread of the normalised figure is under 10%, 10% being the smallest
 * step this curve is asked to resolve. `noise.js`'s sweep gives 1.20 -> 4.9%, **1.25 -> 6.3%**,
 * 1.40 -> 10.3%. Looser caps buy release coverage at a noise floor that would swallow the steps. */
const CLEAN_MULT = 1.25;
const SD_MIN = Math.min(...collected.flatMap(c => c.legs.map(l => l.sd.play_ms_per_turn)));
let dirty = 0, kept = 0;
for (const c of collected) {
  c.clean = c.legs.filter(l => l.sd.play_ms_per_turn <= SD_MIN * CLEAN_MULT);
  dirty += c.legs.length - c.clean.length; kept += c.clean.length;
  if (!c.clean.length) { bad.push(c.id + ' EVERY LEG DIRTY (' + c.legs.length + ') — excluded'); }
}
const rows = [];
for (const c of collected) {
  const { id, cut } = c; const why = c.why;
  const legs = c.clean.length ? c.clean : [];
  if (!legs.length) continue;
  const mid = a => a[(a.length - 1) >> 1];
  const med = legs.map(l => l.medi.play_ms_per_turn).sort((a, b) => a - b);
  const sdt = legs.map(l => l.sd.play_ms_per_turn).sort((a, b) => a - b);
  const norm = legs.map(l => l.medi.play_ms_per_turn / l.sd.play_ms_per_turn).sort((a, b) => a - b);
  rows.push({ id, cut, why: (why || '').slice(0, 64), n: legs.length, n_all: c.legs.length,
    medi_ms_turn: mid(med), medi_min: med[0], medi_max: med[med.length - 1],
    medi_spread_pct: +(100 * (med[med.length - 1] - med[0]) / med[0]).toFixed(1),
    sd_ms_turn: mid(sdt), norm: mid(norm),
    norm_min: norm[0], norm_max: norm[norm.length - 1],
    norm_spread_pct: +(100 * (norm[norm.length - 1] - norm[0]) / norm[0]).toFixed(1),
    medi_turns_sec: Math.round(1000 / mid(med)),
    mean_turns: +(legs.reduce((a, l) => a + l.medi.mean_turns, 0) / legs.length).toFixed(2),
    result_pct: +(legs.reduce((a, l) => a + l.medi.reached_a_result_pct, 0) / legs.length).toFixed(1),
    construct_ms_game: +(legs.reduce((a, l) => a + l.medi.construct_ms / l.medi.games, 0) / legs.length).toFixed(3) });
}
rows.sort((a, b) => a.cut.localeCompare(b.cut));
console.log('\n  CLEANLINESS: showdown global min ' + SD_MIN.toFixed(4) + ' ms/turn; kept ' + kept
  + ' legs, refused ' + dirty + ' as contended (' + (100 * dirty / (kept + dirty)).toFixed(1) + '%)');
/* commits touching the simulator inside each interval, for attribution */
const log = cp.execFileSync('git', ['log', '--format=%H|%cI|%s', '--since=2026-08-05', '--',
  'engine/medicham2-browser.js'], { cwd: ROOT, maxBuffer: 1 << 24 })
  .toString().trim().split(/\r?\n/)
  .map(l => { const p = l.split('|'); return { h: p[0].slice(0, 8), at: p[1], s: p.slice(2).join('|') }; });
console.log('');
console.log('cut               release        turns/s  ms/turn  norm(vs SD)   step   n  meanT  res%  why');
let prev = null;
for (const r of rows) {
  const step = prev ? (r.norm / prev.norm) : 1;
  r.step_norm = +step.toFixed(3);
  console.log(r.cut.slice(0, 16) + '  ' + r.id + '  ' + String(r.medi_turns_sec).padStart(7)
    + '  ' + r.medi_ms_turn.toFixed(4).padStart(7) + '  ' + r.norm.toFixed(4).padStart(11)
    + '  ' + (step >= 1 ? '+' : '') + ((step - 1) * 100).toFixed(1).padStart(6) + '%'
    + String(r.n).padStart(4) + '  ' + r.mean_turns.toFixed(2).padStart(5)
    + '  ' + String(r.result_pct).padStart(5) + '  ' + r.why.slice(0, 40));
  prev = r;
}
console.log('');
console.log('BIGGEST STEPS (normalised; positive = the engine got SLOWER):');
const steps = rows.slice(1).map((r, i) => ({ r, prev: rows[i], pct: (r.norm / rows[i].norm - 1) * 100 }))
  .sort((a, b) => b.pct - a.pct).slice(0, 8);
for (const s of steps) {
  const inRange = log.filter(c => c.at > s.prev.cut && c.at <= s.r.cut);
  console.log('  +' + s.pct.toFixed(1) + '%  ' + s.prev.cut.slice(0, 16) + ' -> ' + s.r.cut.slice(0, 16)
    + '   ' + s.prev.id + ' -> ' + s.r.id + '   (' + inRange.length + ' simulator commits)');
  for (const c of inRange.slice(0, 8)) console.log('        ' + c.h + ' ' + c.at.slice(0, 16) + ' ' + c.s.slice(0, 92));
}
console.log('');
if (bad.length) { console.log('PROBLEMS (' + bad.length + '):'); for (const b of bad) console.log('  ' + b); }
fs.writeFileSync(path.join(DIR, 'curve.json'),
  JSON.stringify({ generated: new Date().toISOString(), rows, problems: bad }, null, 1) + '\n');
console.log('wrote curve.json  (' + rows.length + ' points)');
