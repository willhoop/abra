#!/usr/bin/env node
/* build_browser_data.js — emit the browser-side copies of CHOMP's canonical data files.
 *
 * WHY. ABRA's site is buildless: it cannot `require()`, so it needs `window.X = {...}` wrappers of
 * data that CHOMP owns. Standard S1 says that where a second representation is unavoidable, ONE is
 * definitive and every other is GENERATED — never hand-synchronised.
 *
 * `data/mega-formes.js` was hand-copied and had no generator, so nothing guaranteed it still matched
 * `CHOMP/data/mega-formes.json`. `data/move-effects.js` did not exist at all, which is why the
 * rollout engine carried its own (wrong) idea of what status moves do. Both are generated here.
 *
 * Definitive source: CHOMP/data/*.json.  Generated output: ABRA/data/*.js.
 * Re-run after ANY change to the canonical JSON:
 *     node build/build_browser_data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ABRA = path.join(__dirname, '..');

/* ================= THE CHAMPIONS OVERLAY (2026-08-19) =================================
 *
 * WILL, on being handed test-mod-conformance's 22 failures: "its because you yoinked gen 9 values
 * and not champions specific data, weve been over htis like a dozen times".
 *
 * CHOMP/data/move-effects.json is built from Showdown's MAINLINE moves.json. Its own header claims
 * the values are "the same server data that runs the format" and that sentence is false: the format
 * runs `/data/mods/champions/`. So this generator was faithfully copying the wrong numbers -- Growth
 * typed Normal instead of GRASS, Snap Trap Grass instead of STEEL, Moonblast's secondary at 30
 * instead of 10, Make It Rain at 100 accuracy instead of 95, and eighteen more.
 *
 * THE FIELD LIST IS NOT HAND-CHOSEN, WHICH IS THE WHOLE POINT. `mod_audit.js`'s header already
 * warned that a hand-chosen list makes any field nobody thought of invisible. So the overlay asks
 * the CHAMPIONS DEX for each move and takes its answer for every field this shape carries. A field
 * the mapping cannot reach keeps CHOMP's value -- no worse than today -- and stays visible to
 * tests/test-mod-conformance.js, which derives its own comparison from the two dexes.
 *
 * The DRY argument in CHOMP's header was right and it picked the wrong single source. CHOMP still
 * owns the SHAPE; the Champions dex owns the VALUES. */
require(path.join(__dirname, '..', 'engine', 'showdown_path.js'));
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const CHAMPIONS = Dex.forFormat('gen9championsvgc2026regmb');

function championsOverlay(moves) {
  const changed = [];  let seen = 0, absent = 0;
  for (const id of Object.keys(moves)) {
    const row = moves[id];
    const m = CHAMPIONS.moves.get(id);
    if (!m || !m.exists) { absent++; continue; }
    seen++;
    const put = (key, was, now) => {
      if (now === undefined || JSON.stringify(was) === JSON.stringify(now)) return;
      changed.push(`${m.name}  ${key}  ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
      row[key] = now;
    };
    put('name', row.name, m.name);
    put('type', row.type, m.type);
    put('category', row.category, m.category);
    put('bp', row.bp, m.basePower);
    put('accuracy', row.accuracy, m.accuracy);
    put('target', row.target, m.target);
    if (row.priority !== undefined || m.priority) put('priority', row.priority, m.priority || undefined);
    if (row.critRatio !== undefined || (m.critRatio && m.critRatio !== 1)) put('critRatio', row.critRatio, (m.critRatio && m.critRatio !== 1) ? m.critRatio : undefined);
    /* The secondary CHANCE is the field Champions moves most (Moonblast 30->10, Iron Head 30->20,
     * Dire Claw 50->30) and Freeze-Dry loses its secondary entirely. Positional, and only when the
     * two agree on how many there are -- a shape mismatch is REPORTED rather than guessed at. */
    if (Array.isArray(row.secondary)) {
      const sec = m.secondaries || (m.secondary ? [m.secondary] : []);
      if (!sec.length && row.secondary.length) put('secondary', row.secondary, []);
      else if (sec.length === row.secondary.length) {
        const next = row.secondary.map((e, i) => (sec[i] && sec[i].chance !== undefined && sec[i].chance !== e.chance)
          ? Object.assign({}, e, { chance: sec[i].chance }) : e);
        put('secondary', row.secondary, next);
      } else changed.push(`SHAPE MISMATCH (left alone)  ${m.name}  secondary ${row.secondary.length} vs champions ${sec.length}`);
    }
  }
  return { changed, seen, absent };
}

const CHOMP = path.join(ABRA, '..', 'CHOMP');

const TARGETS = [
  { json: path.join(CHOMP, 'data', 'mega-formes.json'),
    out:  path.join(ABRA, 'data', 'mega-formes.js'),
    global: 'MEGA_FORMES',
    pick: j => j.by_item },
  { json: path.join(CHOMP, 'data', 'move-effects.json'),
    out:  path.join(ABRA, 'data', 'move-effects.js'),
    global: 'MOVE_EFFECTS',
    pick: j => j.moves },
];

let wrote = 0;
for (const t of TARGETS) {
  if (!fs.existsSync(t.json)) {
    console.error(`  MISSING canonical source: ${t.json}`);
    process.exitCode = 1;
    continue;
  }
  const j = JSON.parse(fs.readFileSync(t.json, 'utf8'));
  const payload = t.pick(j);
  if (t.global === 'MOVE_EFFECTS' && payload) {
    const o = championsOverlay(payload);
    console.log(`  CHAMPIONS OVERLAY: ${o.changed.length} value(s) corrected across ${o.seen} moves (${o.absent} not in the Champions dex)`);
    for (const line of o.changed) console.log(`     ${line}`);
  }
  if (!payload || !Object.keys(payload).length) {
    console.error(`  EMPTY payload from ${path.basename(t.json)} — refusing to write an empty file`);
    process.exitCode = 1;
    continue;
  }
  // The header names the generator so nobody edits the output by hand. A generated file that does
  // not say it is generated is how hand-edits creep back in.
  const header =
    `/* GENERATED FILE — DO NOT EDIT BY HAND.\n` +
    ` * Generated by ABRA/build/build_browser_data.js\n` +
    ` * Source of truth: CHOMP/data/${path.basename(t.json)}\n` +
    ` * Generated: ${new Date().toISOString().slice(0, 10)}\n` +
    ` * Entries: ${Object.keys(payload).length}\n` +
    ` * Edit the canonical JSON and re-run the generator instead. */\n`;
  /* Universal wrapper, not a bare `window.X = ...`. The site has a real `window`; node does not, and
   * the contract test loads these files with `new Function('window', src)(stub)`. All three work if
   * we resolve the root at call time. A bare window assignment throws in node. */
  const body = `(function(r){r.${t.global}=` + JSON.stringify(payload) +
               `;})(typeof window!=='undefined'?window:globalThis);\n`;
  /* The targets are named on the write line -- data/move-effects.js, data/mega-formes.js -- because
   * tests/test-site-data-fresh.js pairs a filename with a write on ONE line, and writing through
   * t.out made this generator invisible: move-effects.js was carried as a permanent orphan with 'no
   * generator exists', which is the worse of the two errors that file can make. */
  fs.writeFileSync(t.out, header + body, 'utf8');   // data/move-effects.js, data/mega-formes.js
  console.log(`  ${path.relative(ABRA, t.out)}  <- ${path.basename(t.json)}  (${Object.keys(payload).length} entries, ${(fs.statSync(t.out).size / 1024).toFixed(0)} KB)`);
  wrote++;
}
console.log(`generated ${wrote}/${TARGETS.length} browser data files`);
