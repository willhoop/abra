/* test-effective-identity.js — a transformed Pokemon has ONE identity, and it is not the sheet's.
 *
 * WHY THIS EXISTS (Will, 2026-08-02: "BRO IM TIRED OF THIS MEGA ABILITY GAP. RESEARCH WHAT THE
 * INDUSTRY STANDARD FIX IS AND IMPLEMENT IT UNIVERSALLY ... AND IMPLEMENT THIS FIX FOR ALL THINGS
 * NOT JUST MEGA ABILITY GAP")
 *
 * THE SHAPE, because it is the fourth table and the fourth session
 * ---------------------------------------------------------------
 * A team sheet lists what a Pokemon is BEFORE it transforms. Mega Gengar's sheet says Cursed Body;
 * the thing on the field has Shadow Tag. Mega Blaziken's says Blaze; the thing on the field has
 * Speed Boost, which is the whole reason it Protects. Every consumer that read `mon.ability` got the
 * sheet's answer and had no way to know it was stale — the exact `lookup(x) -> plausible wrong value`
 * that engine/lookup.js was written about, one field over.
 *
 * It had already appeared as: MC.mons keyed by hyphen (101 of 308 keys unreachable), the team-sheet
 * index collapsing mirrors, eight species with no damage row, and now the ability. Each was fixed
 * for the field that had just bitten someone, which is why it kept coming back — mega evolution
 * changes the species AND the ability AND the types AND the base stats AND the weight, and a fix
 * for one leaves the other four stale.
 *
 * WHAT THE INDUSTRY CALLS THIS, AND WHAT IT PRESCRIBES
 * ---------------------------------------------------
 * Two named refactorings and one structural test, and they stack:
 *
 *   SELF ENCAPSULATE FIELD (Fowler) — stop reading the raw field, INCLUDING from inside the module
 *     that owns it, and route every read through an accessor that is free to compute. That is what
 *     makes a derived value possible at all; a public raw field can never become derived.
 *     https://refactoring.guru/self-encapsulate-field
 *
 *   PRIMITIVE OBSESSION -> REPLACE DATA VALUE WITH OBJECT — `ability` is a bare string carrying a
 *     domain concept that has rules, and nothing stops you handing the pre-mega one where the
 *     effective one was meant. The same smell docs/ARTIFACT-ACCESS-RULES.md 2.1 already records for
 *     species names.  https://refactoring.guru/encapsulate-field
 *
 *   ARCHITECTURE FITNESS FUNCTION — assert the SHAPE of the system, not one behaviour. A
 *     behavioural test proves today's callers are right; it cannot catch the NEXT caller writing
 *     the same three lines, which is how this recurred four times. This file is that check.
 *
 * WHY ONE RESOLVER FOR ALL FIVE FIELDS, rather than five accessors
 * ---------------------------------------------------------------
 * board.js `effective(mon, dex)` returns species, ability, types, baseStats and weight together, so
 * a caller cannot obtain the mega's ability beside the base forme's types. That mixed state is what
 * made these bugs so hard to see: every individual field looked defensible.
 *
 * THE RATCHET (R5). 145 raw reads exist across the repo and most are legitimate — a SHEET entry's
 * `.ability` genuinely is the pre-mega one, and reading it is right. A test demanding all 145 be
 * cleaned before it can be switched on is a test that gets switched off. So the baseline records
 * what exists and this fails only on what is NEW, and the list may only shrink.
 *
 *   node tests/test-effective-identity.js
 *   node tests/test-effective-identity.js --update    (only after FIXING some)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const BASELINE = D('data', 'effective-identity-baseline.json');
const UPDATE = process.argv.includes('--update');

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

const CS = require('../engine/champions_sim.js');
const B = require('../engine/board.js');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

console.log('EFFECTIVE IDENTITY — a transformed Pokemon is not its sheet\n');

/* ---- 1. THE ACCESSOR EXISTS AND RESOLVES EVERY FIELD TOGETHER -------------------------------- */

ok(typeof B.effective === 'function', 'board.js exports effective(mon, dex)');
for (const f of ['effAbility', 'effTypes', 'effStats', 'effWeight', 'effSpecies']) {
  ok(typeof B[f] === 'function', `board.js exports ${f}()`);
}

/* A mega found by SWEEPING the dex, so this test names no species either. The first stone whose
 * forme differs from its base in ability AND types is the sharpest single case. */
function findMegaCase() {
  for (const it of dex.items.all()) {
    if (!it.megaStone) continue;
    for (const sp of dex.species.all()) {
      if (!sp.exists || sp.isMega) continue;
      const forme = B.megaFormeOf(B.norm(sp.name), B.norm(it.name), dex);
      if (!forme) continue;
      const m = dex.species.get(forme);
      if (!m || !m.exists) continue;
      const abils = Object.values(m.abilities || {}).map(a => B.norm(a));
      const baseAb = Object.values(sp.abilities || {}).map(a => B.norm(a));
      if (abils.length === 1 && !baseAb.includes(abils[0])) {
        return { base: B.norm(sp.name), stone: B.norm(it.name), forme, want: abils[0], sp, m };
      }
    }
  }
  return null;
}
const C = findMegaCase();
ok(!!C, `found a mega case by sweeping the dex${C ? ` (${C.base} + ${C.stone} -> ${C.forme})` : ''}`);

if (C) {
  const mon = { species: C.base, ability: 'sheetability', item: C.stone, nature: 'Adamant' };
  const e = B.effective(mon, dex);

  ok(e.species === C.forme, `effective() resolves the SPECIES (${e.species})`);
  ok(e.ability === C.want, `effective() resolves the ABILITY (sheet said 'sheetability', got '${e.ability}')`);
  ok(B.effAbility(mon, dex) === C.want, 'effAbility() agrees with effective()');

  /* THE POINT OF ONE RESOLVER: the fields must move TOGETHER. A caller must never be able to hold
   * the mega's ability beside the base forme's types. */
  const sameTypes = JSON.stringify(e.types) === JSON.stringify((C.m.types || []).slice());
  ok(sameTypes, `and the TYPES come from the same forme (${(e.types || []).join('/')})`);
  ok(JSON.stringify(e.baseStats) === JSON.stringify(Object.assign({}, C.m.baseStats || {})),
    'and the BASE STATS come from the same forme');

  /* The negative case matters as much: no stone, nothing may move. */
  const plain = { species: C.base, ability: 'sheetability', item: '', nature: 'Adamant' };
  const p2 = B.effective(plain, dex);
  ok(p2.ability === 'sheetability' && p2.species === C.base,
    'a Pokemon with no stone keeps its sheet ability and species — the accessor is not guessing');
}

/* ---- 2. THE DERIVATION REPRODUCES THE HAND-WRITTEN MAP ---------------------------------------
 * engine/medicham2-browser.js carries MEGA_ABIL, ~63 species typed out by hand. If the derivation
 * is right the map is redundant; if it disagrees anywhere, one of them is wrong and we need to know
 * WHICH before anything is deleted. Read as DATA rather than imported, because that file is a
 * browser file with no require. */
{
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const m = src.match(/const MEGA_ABIL=\{([\s\S]*?)\};/);
  const hand = {};
  if (m) for (const kv of m[1].split(/[,\n]/)) {
    const t = kv.match(/([a-z0-9]+)\s*:\s*'([a-z0-9]+)'/);
    if (t) hand[t[1]] = t[2];
  }
  ok(Object.keys(hand).length > 20, `read the hand-written MEGA_ABIL map (${Object.keys(hand).length} entries)`);

  const stoneFor = {};
  for (const it of dex.items.all()) {
    if (!it.megaStone) continue;
    for (const base of Object.keys(hand)) {
      if (B.megaFormeOf(base, B.norm(it.name), dex)) stoneFor[base] = B.norm(it.name);
    }
  }
  const differ = [];
  let checked = 0;
  for (const [base, ab] of Object.entries(hand)) {
    const stone = stoneFor[base];
    if (!stone) continue;                    // not in this format; nothing to check against
    checked++;
    const got = B.effAbility({ species: base, ability: 'sheetability', item: stone }, dex);
    if (got !== ab) differ.push(`${base}: hand=${ab} derived=${got}`);
  }
  ok(differ.length === 0,
    `the derivation reproduces all ${checked} checkable hand-written entries` +
    (differ.length ? ` — ${differ.length} differ:\n         ` + differ.slice(0, 8).join('\n         ') : ''));
}

/* ---- 3. THE RATCHET — no NEW raw read of a transforming field -------------------------------- */

const SKIP_DIR = /node_modules|[\\/]graveyard[\\/]|[\\/]archive[\\/]/;
/* Deliberately over-broad, then baselined. A clever regex that decides which reads are "fine" is
 * how the next one gets through — the same reasoning docs/ARTIFACT-ACCESS-RULES.md 5 gives for the
 * mc_key sweep. */
const RAW = /\.(ability|baseStats|weighthg|weightkg)\b/g;

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (SKIP_DIR.test(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const files = [];
for (const d of ['engine', 'build', 'tests']) if (fs.existsSync(D(d))) walk(D(d), files);

const now = {};
for (const p of files) {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  const n = (fs.readFileSync(p, 'utf8').match(RAW) || []).length;
  if (n) now[rel] = n;
}
const total = Object.values(now).reduce((a, b) => a + b, 0);

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: 'GENERATED. Raw reads of a field that mega evolution changes. New entries are a FAILURE; '
      + 'this list may only shrink. Route the read through board.js effective()/effAbility(). '
      + 'See tests/test-effective-identity.js.',
    generated: new Date().toISOString().slice(0, 10),
    count: total, allowed: now,
  }, null, 1));
  console.log(`\n  baselined ${total} raw reads across ${Object.keys(now).length} files -> ` +
    path.relative(ROOT, BASELINE));
  process.exit(0);
}

let base = null;
try {
  base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} catch (e) {
  /* A baseline that EXISTS but will not parse is a different fault from one never written, and
   * treating both as "first run" would silently disarm the ratchet -- which is the exact failure
   * this repository keeps finding. Every path out of this catch says something. */
  if (e.code !== 'ENOENT') {
    console.log(`  FAIL the baseline exists but could not be read: ${e.message}`);
    process.exit(1);
  }
  console.log('  note: no baseline on disk yet — this is a first run, not a pass');
}
if (!base) {
  console.log('\n  NO BASELINE. Run:  node tests/test-effective-identity.js --update');
  process.exit(1);
}
const allowed = base.allowed || {};
const grew = [];
for (const [f, n] of Object.entries(now)) {
  const was = allowed[f] || 0;
  if (n > was) grew.push(`${f}: ${was} -> ${n}`);
}
const shrank = Object.entries(allowed).filter(([f, n]) => (now[f] || 0) < n).length;

ok(grew.length === 0,
  `no NEW raw read of a transforming field (${total} total, baseline ${base.count})` +
  (grew.length ? `\n         ` + grew.join('\n         ') : ''));
if (grew.length) {
  console.log('         A sheet entry\'s .ability IS the pre-mega one and reading it is correct.');
  console.log('         A LIVE Pokemon\'s is not. Route it through board.js effAbility(mon, dex),');
  console.log('         or re-baseline with --update if the new read is genuinely on a sheet.');
}
if (shrank) console.log(`\n  ${shrank} file(s) now read fewer raw fields. Re-run with --update to lock the gain in.`);

console.log(`\nEFFECTIVE IDENTITY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
