#!/usr/bin/env node
/* format_audit.js — DOES EVERY CONSTANT IN OUR GENERATED MOVE TABLES EQUAL THE FORMAT'S?
 *
 *   SHOWDOWN_PATH=... node engine/format_audit.js
 *   SHOWDOWN_PATH=... node engine/format_audit.js --json
 *   SHOWDOWN_PATH=... node engine/format_audit.js --all      (every row, not just the disagreements)
 *
 * ================= WHY THIS EXISTS, AND WHY NOTHING ELSE COULD HAVE CAUGHT IT ==================
 *
 * Will, 2026-08-11: *"I BET THOSE ARE THE OLD NUMBERS AND YOU ARE OBSESSED WITH USING OUT OF DATE
 * INFO"* and *"STOP CHECKING GEN 9 AND START CHECKING CHAMPIONS"*. He was right, and it converts a
 * scatter of odd rows into ONE root cause.
 *
 * `CHOMP/build/build_move_effects.js` opens with
 *
 *     const dex = await (await fetch('https://play.pokemonshowdown.com/data/moves.json')).json();
 *
 * — the GENERIC gen-9 client dex. `Dex.forFormat('gen9championsvgc2026regmb')` applies the Champions
 * mod on top of that, and the mod changes real numbers: base power, accuracy, secondary chances, TYPE,
 * and the PP of 42 moves. So every value that mod touches is wrong in `data/move-effects.js`, and
 * wrong in exactly one direction — it equals the mainline value.
 *
 * ================= WHY THE OPEN MEDICHAM GATE IS BLIND TO THIS, WHICH IS THE POINT =============
 *
 * `tests/roster.js` stages an entity and compares OUR TWO ENGINES. `tests/interaction_matrix.js`
 * compares carrier x reactor pairs. Both are differential instruments over things that READ THE SAME
 * CONSTANT — so if medicham2 and board.js both believe Moonblast drops Special Attack 30% of the
 * time, they agree perfectly and the row is green. **A shared wrong input produces perfect
 * agreement.** Only `tests/test-engine-diff.js` (against Showdown) can see it, and only if the move
 * happens to be sampled — Growth is 38 corpus clicks and will not be.
 *
 * That is the honest limit of an OPEN gate, and it is why this check compares the artifact against
 * the AUTHORITY rather than against another artifact. It is `engine/artifact_audit.js` one level up:
 * that file asks whether a generated file carries its SOURCE's values; this one asks whether the
 * source itself is the right dex.
 *
 * ================= WHAT IT DOES AND DOES NOT COVER, SAID OUT LOUD ==============================
 *
 * FIELDS CHECKED, per move, in `data/move-effects.js`: type, category, base power, accuracy, target,
 * priority, contact, critRatio, drain, recoil, multihit, and the CHANCE of every secondary it lists.
 * In `data/engine-data.js`'s `MC.moves`: type, category and base power. In `data/tags.json`: the `pp`
 * row, against the `maxpp` a REAL BATTLE in the format hands back.
 *
 * WHAT IS NOT CHECKED, and this is not a small list: species base stats, learnsets, ability handler
 * behaviour, item behaviour, and every field of `move-effects.js` that has no single scalar
 * counterpart in the dex (the `targetBoosts`/`selfBoosts` SHAPES are compared, their ordering is not).
 * An audit reported as "the generated files are correct" when it covered eleven fields would be the
 * failure this repository is built to prevent, so the covered set is printed on every run.
 *
 * EACH DISAGREEMENT IS CLASSIFIED BY WHETHER THE ENGINE ACTUALLY READS IT, because that changes the
 * severity by an order of magnitude and a list that does not say so invites a panic or a shrug:
 *
 *   LIVE    medicham2 reads this field from this artifact and nothing overrides it
 *   FIXED   medicham2 reads it and a named correction already wins (ACC_FIX, the WIRE 89 chance)
 *   LATENT  nothing in the engine reads this field from this artifact today
 *
 * AND IT REPORTS WHETHER THE WRONG VALUE EQUALS THE MAINLINE ONE, because "every one of them does" is
 * a diagnosis and "some of them do" is a different bug.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const ARGS = process.argv.slice(2);
const JSON_OUT = ARGS.includes('--json');
const SHOW_ALL = ARGS.includes('--all');

if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH'); process.exit(2); }
const { Dex } = CS.sim();
const FMT = Dex.forFormat(CS.FORMAT);
/* THE CONTRAST DEX. Without it this file can say "wrong" and cannot say "wrong the SAME WAY every
 * time", and the second statement is the one that names the generator. */
const MAIN = Dex.forGen(9);
const { Battle } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle'));

require(D('data', 'engine-data.js'));
require(D('data', 'move-effects.js'));
const FX = globalThis.MOVE_EFFECTS;
const MCM = globalThis.MC.moves;
const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
const MEDI_SRC = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');

/* ---- maxpp, read off a constructed battle in the format (never a formula) --------------------- */
function maxppTable() {
  const ids = FMT.moves.all().filter(m => m && m.exists && !m.isNonstandard).map(m => m.id);
  const out = Object.create(null);
  for (let i = 0; i < ids.length; i += 24) {
    const chunk = ids.slice(i, i + 24), team = [];
    for (let j = 0; j < chunk.length; j += 4) {
      team.push({ name: 'M' + j, species: 'Ditto', ability: 'Limber', level: 50,
                  moves: chunk.slice(j, j + 4), item: '', evs: {}, ivs: {} });
    }
    const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
    b.setPlayer('p1', { name: 'a', team });
    b.setPlayer('p2', { name: 'b', team });
    for (const p of b.p1.pokemon) for (const s of p.moveSlots) out[s.id] = s.maxpp;
    b.destroy();
  }
  return out;
}

/* ---- usage, so the report is ordered by what is actually clicked ------------------------------ */
function clicks() {
  const out = Object.create(null);
  for (const id of Object.keys(TAGS.moves || {})) out[id] = TAGS.moves[id].uses || 0;
  return out;
}
const USES = clicks();

/* ---- WHO READS WHAT. Not a judgement — a grep for the read site, with the override named. ----- */
const READERS = {
  'move-effects.accuracy': { how: 'FIXED',
    why: 'moveAccuracy() reads fx.accuracy and ACC_FIX overrides the four measured deviations; '
       + 'tests/test-engine-diff.js re-derives the comparison and FAILS on a fifth row',
    live: () => /ACC_FIX/.test(MEDI_SRC) },
  'move-effects.secondary.chance': { how: 'FIXED',
    why: 'the secondary loop prefers the FORMAT-derived chance (statusInflict for a status or a '
       + 'volatile, statChange for a stat drop) and counts MEDFAILS.rulebookChanceDrift on every '
       + 'disagreement', live: () => /rulebookChanceDrift/.test(MEDI_SRC) },
  'move-effects.bp': { how: 'LATENT', why: 'the engine takes base power from MC.moves[id].bp' },
  'move-effects.type': { how: 'LATENT', why: 'the engine takes the type from MC.moves[id].t' },
  'move-effects.category': { how: 'LIVE', why: 'moveCategory() and the status gate read fx.category' },
  'move-effects.priority': { how: 'LATENT', why: 'movePriority() reads the priority tag' },
  'move-effects.target': { how: 'LIVE', why: 'the spread and self-target classifiers read fx.target' },
  'move-effects.drain': { how: 'LIVE', why: 'the drain branch reads the rulebook entry' },
  'move-effects.recoil': { how: 'LATENT', why: 'recoil is read from MC.moves[id].rc and the recoil tag' },
  'move-effects.critRatio': { how: 'LIVE', why: 'critChance() reads it' },
  'move-effects.contact': { how: 'LATENT', why: 'mvMakesContact() reads the contact TAG' },
  'move-effects.multihit': { how: 'LATENT', why: 'expectedHitsOf reads the multiHit tag' },
  'engine-data.bp': { how: 'LIVE', why: 'dmgRange reads MC.moves[id].bp' },
  'engine-data.type': { how: 'LIVE', why: 'effMoveType reads MC.moves[id].t' },
  'engine-data.category': { how: 'LIVE', why: 'dmgRange reads MC.moves[id].c' },
  'tags.pp': { how: 'LIVE', why: 'ppLeft() reads the pp tag' },
};

const rows = [];
const notComparable = [];
function cmp(kind, id, field, ours, theirs, mainline) {
  if (JSON.stringify(ours) === JSON.stringify(theirs)) return;
  const key = kind + '.' + field;
  const r = READERS[key] || { how: 'UNCLASSIFIED', why: 'no reader declared for this field' };
  rows.push({ move: id, artifact: kind, field, ours, format: theirs, mainline,
              equalsMainline: JSON.stringify(ours) === JSON.stringify(mainline),
              severity: r.how, why: r.why, uses: USES[id] || 0 });
}

const MAXPP = maxppTable();
let compared = 0;

for (const m of FMT.moves.all()) {
  if (!m || !m.exists || m.isNonstandard) continue;
  const id = m.id;
  const mm = MAIN.moves.get(id);

  /* ---- data/move-effects.js ------------------------------------------------------------------ */
  const fx = FX[id];
  if (fx) {
    const pairs = [
      ['type', fx.type, m.type, mm.type],
      ['category', fx.category, m.category, mm.category],
      ['bp', fx.bp || 0, m.basePower || 0, mm.basePower || 0],
      ['accuracy', fx.accuracy, m.accuracy, mm.accuracy],
      ['target', fx.target, m.target, mm.target],
      ['priority', fx.priority || 0, m.priority || 0, mm.priority || 0],
      ['contact', !!fx.contact, !!(m.flags && m.flags.contact), !!(mm.flags && mm.flags.contact)],
      ['critRatio', fx.critRatio || 1, m.critRatio || 1, mm.critRatio || 1],
      ['drain', fx.drain || null, m.drain || null, mm.drain || null],
      ['recoil', fx.recoil || null, m.recoil || null, mm.recoil || null],
      ['multihit', fx.multihit || null, m.multihit || null, mm.multihit || null],
    ];
    for (const [f, a, b, c] of pairs) { compared++; cmp('move-effects', id, f, a, b, c); }

    /* THE SECONDARY CHANCES. Matched by KIND rather than by index, because a move can carry two
     * secondaries of different kinds (Triple Arrows: a 50% Defence drop and a 30% flinch) and an
     * index match would price each with the other's number. */
    const kindOf = (s) => s.status ? 'status:' + s.status
      : s.volatile ? 'volatile:' + s.volatile
      : s.targetBoosts ? 'targetBoosts:' + Object.keys(s.targetBoosts).sort().join(',')
      : s.selfBoosts ? 'selfBoosts:' + Object.keys(s.selfBoosts).sort().join(',') : 'bare';
    const dexKind = (s) => s.status ? 'status:' + s.status
      : s.volatileStatus ? 'volatile:' + s.volatileStatus
      : (s.boosts ? 'targetBoosts:' + Object.keys(s.boosts).sort().join(',')
        : (s.self && s.self.boosts) ? 'selfBoosts:' + Object.keys(s.self.boosts).sort().join(',') : 'bare');
    const dexSecs = (mv) => {
      const out = [];
      if (mv.secondaries) for (const s of mv.secondaries) out.push(s);
      else if (mv.secondary) out.push(mv.secondary);
      return out;
    };
    const fmtSec = dexSecs(m), mainSec = dexSecs(mm);
    for (const s of (fx.secondary || [])) {
      const k = kindOf(s);
      const f = fmtSec.find(x => dexKind(x) === k);
      const g = mainSec.find(x => dexKind(x) === k);
      if (!f) continue;                       /* a shape only one side states cannot disagree */
      compared++;
      cmp('move-effects', id, 'secondary.chance',
          (s.chance == null ? 100 : s.chance), (f.chance == null ? 100 : f.chance),
          g ? (g.chance == null ? 100 : g.chance) : null);
    }
    /* A SECONDARY THE FORMAT HAS AND WE DO NOT is a different defect from a wrong number, and it is
     * reported as its own field so it cannot hide inside a chance comparison. */
    for (const f of fmtSec) {
      const k = dexKind(f);
      if (k === 'bare') continue;
      compared++;
      if (!(fx.secondary || []).some(s => kindOf(s) === k))
        cmp('move-effects', id, 'secondary.missing', null, k, mainSec.some(x => dexKind(x) === k) ? k : null);
    }
  }

  /* ---- data/engine-data.js (MC.moves) — READ-ONLY here; ENGINE may not edit that file --------- */
  const mc = MCM[id];
  if (mc) {
    /* `bp: 0` IS THIS TABLE'S WORD FOR "VARIABLE", NOT FOR "ZERO", and the first version of this file
     * did not know that: it reported Grass Knot, Final Gambit, Electro Ball, Spit Up, Sheer Cold,
     * Night Shade and Mirror Coat as LIVE category defects, on the reasoning `bp > 0 ? Special :
     * Status`. All seven are `basePowerCallback`/OHKO/fixed-damage moves whose power the engine reads
     * from a tag, and every one of them was a FALSE POSITIVE — the check firing at a convention.
     *
     * That is worth the paragraph rather than a quiet `if`: CLAUDE.md's own rule for this class of
     * instrument is that a check which keeps firing after the fix gets ignored, and seven loud false
     * rows on a 28-row report is exactly how that happens. They are counted as NOT COMPARABLE with
     * the reason, not silently skipped. */
    const variablePower = !!(m.basePowerCallback || m.ohko || m.damage) || (m.basePower === 0 && m.category !== 'Status');
    compared++;
    cmp('engine-data', id, 'type', mc.t, m.type, mm.type);
    if (!variablePower) {
      compared += 2;
      cmp('engine-data', id, 'bp', mc.bp || 0, m.basePower || 0, mm.basePower || 0);
      cmp('engine-data', id, 'category',
          mc.c === 'P' ? 'Physical' : (mc.bp > 0 ? 'Special' : 'Status'),
          m.category === 'Status' ? 'Status' : m.category,
          mm.category === 'Status' ? 'Status' : mm.category);
    } else notComparable.push(id + ' (variable power: the table stores bp 0 and the engine reads the power tag)');
  }

  /* ---- data/tags.json `pp` -------------------------------------------------------------------- */
  const t = TAGS.moves[id];
  if (t && t.params && t.params.pp) {
    compared++;
    const mainMax = mm.noPPBoosts ? mm.pp : Math.floor(mm.pp * 8 / 5);
    cmp('tags', id, 'pp', t.params.pp.max, MAXPP[id], mainMax);
  }
}

rows.sort((a, b) => (b.uses - a.uses) || a.move.localeCompare(b.move));

const out = {
  generated: new Date().toISOString(), by: 'engine/format_audit.js',
  format: CS.FORMAT, comparedFields: compared, disagreements: rows.length,
  allWrongValuesEqualMainline: rows.length > 0 && rows.every(r => r.equalsMainline),
  bySeverity: rows.reduce((a, r) => (a[r.severity] = (a[r.severity] || 0) + 1, a), {}),
  clicksAffected: rows.reduce((a, r) => a + r.uses, 0),
  rows,
};
fs.writeFileSync(D('data', 'format-audit.json'), JSON.stringify(out, null, 2) + '\n');

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(rows.length ? 1 : 0); }

console.log('FORMAT AUDIT — our generated constants against ' + CS.FORMAT);
console.log('  ' + compared + ' fields compared across data/move-effects.js, data/engine-data.js and data/tags.json');
console.log('  ' + rows.length + ' disagree, ' + notComparable.length + ' NOT COMPARABLE (named at the bottom)');
if (rows.length) {
  console.log('  every wrong value equals the MAINLINE gen-9 value: '
    + (out.allWrongValuesEqualMainline ? 'YES — one root cause, not drift'
      : 'NO — ' + rows.filter(r => !r.equalsMainline).length + ' row(s) match neither dex'));
  console.log('  clicks behind the disagreeing rows: ' + out.clicksAffected.toLocaleString());
  console.log('');
  console.log('  ' + 'move'.padEnd(18) + 'field'.padEnd(20) + 'artifact'.padEnd(14)
    + 'ours'.padEnd(12) + 'CHAMPIONS'.padEnd(12) + 'mainline'.padEnd(12) + 'clicks'.padEnd(9) + 'reads?');
  for (const r of rows) {
    console.log('  ' + r.move.padEnd(18) + r.field.padEnd(20) + r.artifact.padEnd(14)
      + String(JSON.stringify(r.ours)).padEnd(12) + String(JSON.stringify(r.format)).padEnd(12)
      + String(JSON.stringify(r.mainline)).padEnd(12)
      + String(r.uses).padEnd(9) + r.severity + (r.equalsMainline ? '' : '  <- NOT the mainline value either'));
  }
  console.log('');
  const live = rows.filter(r => r.severity === 'LIVE');
  console.log('  LIVE means the engine reads that field from that artifact with nothing overriding it: '
    + live.length + ' row(s), ' + live.reduce((a, r) => a + r.uses, 0).toLocaleString() + ' clicks');
  for (const r of live) console.log('    ' + r.move + ' ' + r.field + ' — ' + r.why);
  console.log('');
  console.log('  THE ROOT CAUSE, and it is one line: CHOMP/build/build_move_effects.js fetches');
  console.log('    https://play.pokemonshowdown.com/data/moves.json');
  console.log('  which is the GENERIC gen-9 client dex. It must read Dex.forFormat(\'' + CS.FORMAT + '\').');
  console.log('  That file is CHOMP\'s, not ENGINE\'s, so this check names the rows rather than patching them.');
}
console.log('');
console.log('  FIELDS COVERED (a check that covers one field and is reported as "the generator is fixed"');
console.log('  is the failure this repo exists to prevent):');
console.log('    move-effects.js  type category bp accuracy target priority contact critRatio drain');
console.log('                     recoil multihit, and every secondary CHANCE matched BY KIND');
console.log('    engine-data.js   type bp category   (MC.moves)');
console.log('    tags.json        pp, against the maxpp a real battle in the format hands back');
console.log('  NOT COVERED: species base stats, learnsets, ability and item BEHAVIOUR, and the ordering');
console.log('  of boost tables. Those need their own instruments and do not have one here.');
console.log('');
if (notComparable.length) {
  console.log('  NOT COMPARABLE — a field this instrument cannot ask about, named rather than skipped:');
  for (const n of notComparable) console.log('    ' + n);
  console.log('');
}
console.log('  wrote data/format-audit.json');
process.exitCode = rows.length ? 1 : 0;
