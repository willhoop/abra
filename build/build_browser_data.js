#!/usr/bin/env node
/* build_browser_data.js — emit the browser-side data files, DERIVED FROM THE CHAMPIONS DEX.
 *
 * WHY. ABRA's site is buildless: it cannot `require()`, so it needs `window.X = {...}` wrappers.
 * Standard S1 says that where a second representation is unavoidable, ONE is definitive and every
 * other is GENERATED — never hand-synchronised. This file is the generator.
 *
 * ================= WHY CHOMP IS NO LONGER THE SOURCE =============================================
 *
 * WILL, 2026-08-19: "stop using chomp that data is old and bad / just like i said to stop using mag".
 * And before that, on the 22 drifted values this file was faithfully copying: "its because you yoinked
 * gen 9 values and not champions specific data, weve been over htis like a dozen times".
 *
 * Both outputs used to be copied out of `CHOMP/data/*.json`. `CHOMP/build/build_move_effects.js` reads
 * Showdown's MAINLINE `moves.json` and its own header claims the values are "the same server data that
 * runs the format". THAT SENTENCE IS FALSE — the format runs `/data/mods/champions/`. The DRY argument
 * in that header was right and it picked the wrong single source.
 *
 * Measured on the switch:
 *   MOVE_EFFECTS  34 values were mainline where Champions differs — Growth typed Normal against GRASS,
 *                 Snap Trap Grass against STEEL, Moonblast's secondary 30 against 10, Iron Head 30
 *                 against 20, Make It Rain 100 accuracy against 95 AND its self-drop -1 against -2,
 *                 Toxic Thread -1 against -2, Freeze-Dry carrying a freeze Champions removed outright.
 *   MOVE_EFFECTS  954 entries against 500 legal ones. The other 454 are Z-moves, Max moves and Past
 *                 moves — the National Dex wearing the format's name, which CLAUDE.md names as its own
 *                 recurring failure.
 *   MEGA_FORMES   95 entries against 75 legal mega stones, the same shape of error.
 *
 * ================= WHY THE FIELD LIST IS NOT A JUDGEMENT CALL ====================================
 *
 * `mod_audit.js`'s header already warned that "a field nobody thought to list is invisible to it, and
 * a rewritten FUNCTION is invisible to any constant sweep at all." So the shape below was not chosen —
 * it was READ off the previously generated file, every field it carried reproduced, and the result
 * DIFFED against that file before this generator was trusted. On the 500 moves present in both, five
 * fields differed and every one was explained: two were real Champions values the old source had wrong
 * (Make It Rain, Toxic Thread), two were a chance-less secondary the dex leaves implicit, and one was
 * an empty array against an absent key.
 *
 * A chance-less secondary is encoded as `chance: 100` because Showdown applies one unconditionally;
 * leaving it undefined would read as "never" to anything that multiplies by it.
 *
 * Definitive source: Dex.forFormat('gen9championsvgc2026regmb').  Output: ABRA/data/*.js.
 * Re-run after a Showdown update:
 *     node build/build_browser_data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ABRA = path.join(__dirname, '..');
require(path.join(ABRA, 'engine', 'showdown_path.js'));
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');

/* CLAUDE.md: `.all()` walks the WHOLE dex and every illegal entity is still in it, still exists:true.
 * Filter every walk, every time. */
const legal = x => x.exists && !x.isNonstandard;

function secondaryOf(s) {
  const o = {};
  /* Showdown applies a secondary with no `chance` unconditionally. 100 is that, written down. */
  o.chance = (s.chance === undefined) ? 100 : s.chance;
  if (s.status) o.status = s.status;
  if (s.volatileStatus) o.volatile = s.volatileStatus;
  if (s.boosts) o.targetBoosts = s.boosts;
  if (s.self && s.self.boosts) o.selfBoosts = s.self.boosts;
  return o;
}

function moveRow(m) {
  const r = { name: m.name, type: m.type, category: m.category, bp: m.basePower,
              accuracy: m.accuracy, target: m.target };
  if (m.flags && m.flags.contact) r.contact = true;
  const sec = m.secondaries || (m.secondary ? [m.secondary] : []);
  if (sec.length) r.secondary = sec.map(secondaryOf);
  if (m.volatileStatus) r.volatile = m.volatileStatus;
  if (m.boosts) r.targetBoostsAlways = m.boosts;
  if (m.self && m.self.boosts) r.selfBoostsAlways = m.self.boosts;
  if (m.priority) r.priority = m.priority;
  if (m.multihit) r.multihit = m.multihit;
  if (m.critRatio && m.critRatio !== 1) r.critRatio = m.critRatio;
  if (m.sideCondition) r.sideCondition = m.sideCondition;
  if (m.status) r.status = m.status;
  if (m.drain) r.drain = m.drain;
  if (m.recoil) r.recoil = m.recoil;
  if (m.pseudoWeather) r.pseudoWeather = m.pseudoWeather;
  if (m.heal) r.heal = m.heal;
  if (m.weather) r.weather = m.weather;
  if (m.willCrit) r.willCrit = m.willCrit;
  if (m.terrain) r.terrain = m.terrain;
  return r;
}

function buildMoveEffects() {
  const out = {};
  for (const m of D.moves.all()) if (legal(m)) out[m.id] = moveRow(m);
  return out;
}

function buildMegaFormes() {
  const out = {}, odd = [];
  for (const it of D.items.all()) {
    if (!legal(it) || !it.megaStone) continue;
    /* `megaStone` is a { "Base Name": "Mega Name" } map, and ONE stone carries two pairings:
     * Meowsticite serves Meowstic (M) and Meowstic-F. The two megas are identical in types, base
     * stats and ability and differ only in forme identity — so the primary entry keeps the shape every
     * consumer already reads, and the second travels in `alt` rather than being dropped or guessed at.
     *
     * CHOMP's file had this pair MISMATCHED: `forme: meowsticfmega` under `base: meowstic`, the female
     * mega filed against the male base. Deriving it from the item's own map cannot produce that. */
    const pairs = Object.entries(it.megaStone);
    const rows = [];
    for (const [baseName, megaName] of pairs) {
      const base = D.species.get(baseName), mega = D.species.get(megaName);
      if (!base.exists || !mega.exists) { odd.push(`${it.id}: ${baseName} -> ${megaName} does not resolve`); continue; }
      rows.push({ forme: mega.id, name: mega.name, base: base.id,
                  t: mega.types.slice(), bs: Object.assign({}, mega.baseStats),
                  ab: mega.abilities['0'] });
    }
    if (!rows.length) continue;
    out[it.id] = rows[0];
    if (rows.length > 1) {
      out[it.id].alt = rows.slice(1);
      odd.push(`${it.id}: ${rows.length} pairings — primary ${rows[0].forme}, alt ${rows.slice(1).map(r => r.forme).join(', ')}`);
    }
  }
  return { out, odd };
}

const mega = buildMegaFormes();
const TARGETS = [
  { out: path.join(ABRA, 'data', 'mega-formes.js'), global: 'MEGA_FORMES', payload: mega.out,
    note: 'legal mega stones' },
  { out: path.join(ABRA, 'data', 'move-effects.js'), global: 'MOVE_EFFECTS', payload: buildMoveEffects(),
    note: 'legal moves' },
];

for (const line of mega.odd) console.error(`  MEGA STONE NOTE — ${line}`);

let wrote = 0;
for (const t of TARGETS) {
  if (!t.payload || !Object.keys(t.payload).length) {
    console.error(`  EMPTY payload for ${t.global} — refusing to write an empty file`);
    process.exitCode = 1;
    continue;
  }
  const header =
    `/* GENERATED FILE — DO NOT EDIT BY HAND.\n` +
    ` * Generated by ABRA/build/build_browser_data.js\n` +
    ` * Source of truth: Dex.forFormat('gen9championsvgc2026regmb') — NOT CHOMP, NOT mainline.\n` +
    ` * Generated: ${new Date().toISOString().slice(0, 10)}\n` +
    ` * Entries: ${Object.keys(t.payload).length} ${t.note}\n` +
    ` * Re-run the generator instead of editing this file. */\n`;
  /* Universal wrapper, not a bare `window.X = ...`. The site has a real `window`; node does not, and
   * the contract test loads these files with `new Function('window', src)(stub)`. */
  const body = `(function(r){r.${t.global}=` + JSON.stringify(t.payload) +
               `;})(typeof window!=='undefined'?window:globalThis);\n`;
  /* The targets are named on the write line -- data/move-effects.js, data/mega-formes.js -- because
   * tests/test-site-data-fresh.js pairs a filename with a write on ONE line, and writing through
   * t.out alone made this generator invisible. */
  fs.writeFileSync(t.out, header + body, 'utf8');   // data/move-effects.js, data/mega-formes.js
  console.log(`  ${path.relative(ABRA, t.out)}  <- Champions dex  (${Object.keys(t.payload).length} ${t.note}, ${(fs.statSync(t.out).size / 1024).toFixed(0)} KB)`);
  wrote++;
}
console.log(`generated ${wrote}/${TARGETS.length} browser data files from the Champions dex`);
