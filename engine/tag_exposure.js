/* tag_exposure.js — of the mechanics we have NOT wired, which ones actually turn up?
 *
 *   SHOWDOWN_PATH=... node engine/tag_exposure.js [--top 30]
 *
 * WHY THIS EXISTS
 * ---------------
 * The artifact carries 163 tag families and roughly a dozen are wired. The standing advice on the
 * rest is "needs-state, below-floor, or rulebook-served -- don't force it", which is honest and
 * gives no order to work in. This turns the pile into a ranked list by asking the only question that
 * decides whether wiring something could possibly matter:
 *
 *     in real games, how often is this mechanic even ON THE TABLE?
 *
 * A mechanic nobody brings cannot be worth wiring however elegant it is. One that appears in a third
 * of games and is unread is a hole with a size attached.
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT
 * ----------------------------------------
 * EXPOSURE, not effect. Two numbers per family:
 *
 *   games   the share of clean games where a Pokemon carrying the tag was actually BROUGHT, or a
 *           move carrying it was in a declared set -- the mechanic had the opportunity to act.
 *   clicks  for move tags, how many times a move carrying it was actually THROWN. Much sharper than
 *           exposure, because a move in a set that nobody presses is not a mechanic in play.
 *
 * It cannot tell you the tag would change an outcome. Nothing can, before it is wired: that needs a
 * counterfactual, which is exactly the paired A/B this project runs after wiring. So this is a
 * SCREEN for what is worth the work, never a verdict on whether it helped. Four features were wired
 * this week on the strength of an argument and all four measured null; the point of this file is to
 * stop that happening for the reason "nobody plays it".
 *
 * WHAT "UNREAD" MEANS HERE, AND THE TRAP IN IT
 * --------------------------------------------
 * It means the family is not reached through engine/tags.js. It does NOT mean the mechanic is
 * unmodelled, because several are modelled by reading the DEX directly instead of the artifact:
 * movePriority resolves `priority` off moveFx, moveAccuracy resolves `neverMisses`, effSpeed
 * resolves Choice Scarf and Tailwind. All four show as unread below and all four work.
 *
 * So read this column as "does the artifact reach it", which is a question about SINGLE SOURCING --
 * a mechanic modelled from the dex in one engine and the artifact in another is exactly how the two
 * drift apart. For "is it modelled at all", the companion is engine/mechanics_coverage.js, which
 * answers by experiment rather than by grep. The pair of them is the real picture; neither alone is.
 *
 * The rows worth attention are therefore ABILITIES and ITEMS with high exposure and no click count,
 * since those have no dex-side path in this engine -- boostsWhenLowered (Defiant/Competitive) and
 * passiveHeal (Leftovers) are the shape to look for.
 *
 * HOW READING IS DETECTED, and why this grep is trustworthy where the last one was not
 * --------------------------------------------------------------------------------------
 * engine/mechanics_coverage.js records that its first version searched the source for each ability's
 * NAME and "failed in both directions at once". This does something narrower and reliable: a tag can
 * only be reached through the accessors in engine/tags.js -- param(), has(), withTag() -- so a tag
 * family is READ if and only if its name appears as a string argument to one of those. That is a
 * structural fact about the API, not a guess about prose.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const TOP = parseInt(arg('top', '30'), 10);

const TAGS = require(D('data', 'tags.json'));
const FP = require(D('engine', 'fit_policy.js'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- which families does any engine actually read? ------------------------------------------- */
function wiredFamilies() {
  const read = new Set();
  const dirs = ['engine', 'build', 'app'];
  const files = [];
  for (const d of dirs) {
    let list = []; try { list = fs.readdirSync(D(d)); } catch (e) { continue; }
    for (const f of list) if (/\.(js|html)$/.test(f)) files.push(D(d, f));
  }
  /* param('kind','id','TAG') / has(...,'TAG') / withTag('kind','TAG') — the third or second string. */
  const re = /\b(?:param|has)\s*\(\s*[^,]+,\s*[^,]+,\s*['"]([A-Za-z0-9_]+)['"]|\bwithTag\s*\(\s*['"][^'"]+['"]\s*,\s*['"]([A-Za-z0-9_]+)['"]/g;
  for (const f of files) {
    let src = ''; try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    /* tag_dex.js DEFINES the families; reading it as a consumer would mark everything wired. */
    if (/tag_dex\.js$/.test(f)) continue;
    let m;
    while ((m = re.exec(src))) read.add(m[1] || m[2]);
  }
  return read;
}

/* ---- what does each family attach to? -------------------------------------------------------- */
const owners = { abilities: new Map(), items: new Map(), moves: new Map() };
const familyKinds = new Map();
for (const kind of ['abilities', 'items', 'moves']) {
  for (const id in TAGS[kind]) {
    for (const fam of (TAGS[kind][id].tags || [])) {
      if (!owners[kind].has(fam)) owners[kind].set(fam, new Set());
      owners[kind].get(fam).add(id);
      if (!familyKinds.has(fam)) familyKinds.set(fam, new Set());
      familyKinds.get(fam).add(kind);
    }
  }
}

/* ---- walk the clean human corpus -------------------------------------------------------------- */
process.stderr.write('loading clean open-sheet games...\n');
const { games } = FP.loadCorpus();
process.stderr.write(`  ${games.length.toLocaleString()} games\n`);

const gamesWith = new Map();   // family -> games in which a carrier was brought
const clicks = new Map();      // family -> times a tagged move was actually thrown
const bump = (m, k, n) => m.set(k, (m.get(k) || 0) + (n || 1));

for (const g of games) {
  const here = new Set();
  for (const side of ['p1', 'p2']) {
    const brought = new Set(((g.brought || {})[side] || []).map(norm));
    for (const s of (g.sheets && g.sheets[side]) || []) {
      if (!s || !s.species) continue;
      /* Only what was actually BROUGHT — a Pokemon left in the back never had the opportunity. */
      if (brought.size && !brought.has(norm(s.species))) continue;
      const ab = norm(s.ability), it = norm(s.item);
      for (const [fam, ids] of owners.abilities) if (ab && ids.has(ab)) here.add(fam);
      for (const [fam, ids] of owners.items) if (it && ids.has(it)) here.add(fam);
      for (const mv of (s.moves || [])) {
        const id = norm(mv);
        for (const [fam, ids] of owners.moves) if (ids.has(id)) here.add(fam);
      }
    }
  }
  for (const fam of here) bump(gamesWith, fam);
  /* Moves actually clicked, which is a much sharper signal than a move sitting in a set. */
  for (const t of g.turns || []) {
    for (const e of (t.ev || [])) {
      if (e.t !== 'm' || !e.mv) continue;
      const id = norm(e.mv);
      for (const [fam, ids] of owners.moves) if (ids.has(id)) bump(clicks, fam);
    }
  }
}

/* ---- report ---------------------------------------------------------------------------------- */
const wired = wiredFamilies();
const all = [...familyKinds.keys()];
const rows = all.map(fam => ({
  fam,
  kinds: [...familyKinds.get(fam)].map(k => k[0]).join(''),
  wired: wired.has(fam),
  games: gamesWith.get(fam) || 0,
  clicks: clicks.get(fam) || 0,
})).sort((a, b) => b.games - a.games || b.clicks - a.clicks);

const pct = n => (100 * n / Math.max(1, games.length)).toFixed(1) + '%';
const line = r => `  ${r.wired ? ' reads ' : '   -   '}  ${pct(r.games).padStart(6)}  ${String(r.clicks).padStart(8)}  ${r.kinds.padEnd(4)} ${r.fam}`;

console.log(`\nTAG EXPOSURE — how often is each mechanic even on the table?\n`);
console.log(`  corpus ${games.length.toLocaleString()} clean open-sheet games · ${all.length} tag families · ${wired.size} read by some engine\n`);
console.log(`  artifact  games   clicks   kind  family`);
console.log(`  ${'-'.repeat(64)}`);
const unwired = rows.filter(r => !r.wired);
for (const r of unwired.slice(0, TOP)) console.log(line(r));

const dead = unwired.filter(r => r.games === 0).length;
console.log(`\n  ${unwired.length} families unread. ${dead} of them appear in ZERO games — those are not a backlog,`);
console.log(`  header). ${dead} appear in ZERO games: out of format, and wiring them cannot change anything.`);
const live = unwired.filter(r => r.games >= games.length * 0.05);
console.log(`  ${live.length} appear in at least 5% of games. That is the real shelf, in order.`);
console.log(`\n  EXPOSURE IS NOT EFFECT. This says a mechanic had the opportunity to act, never that`);
console.log(`  wiring it would win a game — that needs the paired A/B, after wiring.\n`);
