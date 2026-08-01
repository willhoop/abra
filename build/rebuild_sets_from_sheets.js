/* rebuild_sets_from_sheets.js — put the REAL sets into data/engine-data.js.
 *
 * WHY (Will, 2026-07-31: "when i played the tower last the moves on the mons were all fucked up",
 * and "no one uses thrash on chomp idk where u got that")
 * ---------------------------------------------------------------------------------------------
 * build/build_engine_data.js populates four fields by inheritance, never derivation:
 *
 *     mv: old.mv || [],   item: old.item || null,   ab: old.ab || null,   st: old.st || null
 *
 * so whatever was in the file first propagates forever. Measured against 4,742 real Garchomp sheets:
 * the file said outrage / earthquake / thrash / protect, while the format plays DragonClaw 93%,
 * Earthquake 81%, Protect 80%, RockSlide 78% — Outrage and Thrash are not in the top eight, and the
 * two most-used moves on the most-used species were absent. 133 of 205 checkable species carried an
 * ability neither their base nor their mega forme can have.
 *
 * That table is what the Battle Tower builds from, what medicham2 rolls out, and what DITTO hands
 * its referee. One shared artifact, three systems playing fictional Pokemon — which is the cost of
 * sharing when the shared thing is inherited rather than generated.
 *
 * WHAT IS OBSERVED AND WHAT IS ASSUMED, because the difference must survive into the artifact:
 *
 *   item      OBSERVED   from the sheet
 *   ability   OBSERVED   from the sheet
 *   moves     OBSERVED   from the sheet, as a JOINT set — the four together, not four marginals
 *   nature    OBSERVED   from the sheet
 *   sp        ASSUMED    open team sheets do not carry it. 0 of 68,580 entries have EVs; the format
 *                        shows the kit, not the investment.
 *
 * WHY JOINT MOVES MATTER (Will's point, and it is the one that makes usage stats unusable here):
 * "very few sneasler actually have both so even if both are common, its usually one or the other."
 * Smogon publishes MARGINALS, and the top four marginals are a set nobody runs. Measured: for
 * Garchomp the top-4-by-marginal is the true set only 43.7% of the time (114 distinct sets played);
 * for Sneasler 41.8% (69 sets). Open sheets give the joint set directly, so none of that is guessed.
 *
 * THE sp ASSUMPTION, STATED IN FULL. Champions uses flat STAT POINTS, not mainline EVs:
 * st = nature x (base_at_50 + sp), per l50() in medicham2-browser.js. The nature is observed, and it
 * names which stat is raised and which is cut, so the DIRECTION of investment is not a guess — only
 * the magnitude is. Points go to the nature-favoured stat and to the offence the moveset actually
 * uses, at the level the current file already implies (about 50 into the main attacking stat, about
 * 20-30 into speed), so no mon becomes stronger or weaker than the table already assumed.
 *
 *   node build/rebuild_sets_from_sheets.js            report only, writes nothing
 *   node build/rebuild_sets_from_sheets.js --write    update data/engine-data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');

const SETS = JSON.parse(fs.readFileSync(D('data', 'species-sets.json'), 'utf8'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* The nature chart, taken from medicham2's PASTE_NAT so the two cannot disagree about which stat a
 * nature raises. [raised, lowered] in this engine's at/df/sa/sd/sp naming. */
const NAT = {
  adamant: ['at', 'sa'], jolly: ['sp', 'sa'], modest: ['sa', 'at'], timid: ['sp', 'at'],
  careful: ['sd', 'sa'], impish: ['df', 'sa'], bold: ['df', 'at'], calm: ['sd', 'at'],
  brave: ['at', 'sp'], quiet: ['sa', 'sp'], relaxed: ['df', 'sp'], sassy: ['sd', 'sp'],
  naughty: ['at', 'sd'], lonely: ['at', 'df'], mild: ['sa', 'df'], rash: ['sa', 'sd'],
  hasty: ['sp', 'df'], naive: ['sp', 'sd'], gentle: ['sd', 'df'], careless: ['sa', 'sd'],
  lax: ['df', 'sd'], docile: [null, null], hardy: [null, null], serious: [null, null],
  bashful: [null, null], quirky: [null, null],
};

/* THE ONLY ASSUMED NUMBERS IN THIS FILE, and they are chosen to match what the existing table
 * already implies rather than to make anything stronger: Garchomp reads as +50 Atk / +18 Spe,
 * Incineroar as roughly +48 / +32. So: a full investment in the attacking stat the MOVES use, a
 * lesser one in the nature-favoured stat, and nothing anywhere else. */
const SP_MAIN = 50, SP_SECOND = 25;

/* Which offence does this set actually use? Derived from the moves via the dex, not assumed from
 * the nature — a Careful Incineroar with four physical moves still wants Attack. */
let DEX = null;
try { const CS = require(D('engine', 'champions_sim.js')); DEX = CS.sim().Dex.forFormat(CS.FORMAT); }
catch (e) { console.error('  no dex — cannot classify moves, refusing to guess'); process.exit(2); }

function offenceOf(moves) {
  let phys = 0, spec = 0;
  for (const m of moves || []) {
    const d = DEX.moves.get(norm(m));
    if (!d || !d.exists) continue;
    if (d.category === 'Physical') phys++;
    else if (d.category === 'Special') spec++;
  }
  if (!phys && !spec) return null;               // a fully defensive set invests nowhere offensive
  return phys >= spec ? 'at' : 'sa';
}

function spFor(set) {
  const sp = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, spe: 0 };
  const key = { at: 'at', df: 'df', sa: 'sa', sd: 'sd', sp: 'sp' };
  const out = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
  const off = offenceOf(set.moves);
  const [up] = NAT[norm(set.nature)] || [null, null];
  if (off) out[off] = SP_MAIN;
  if (up && up !== off) out[up] = SP_SECOND;
  else if (up === off) out.sp = SP_SECOND;       // nature already backs the offence -> speed instead
  return out;
}

/* ---- rebuild ---------------------------------------------------------------------------------- */
const src = fs.readFileSync(D('data', 'engine-data.js'), 'utf8');
const m = src.match(/const MC = (\{[\s\S]*?\});/);
if (!m) { console.error('cannot find the MC object in data/engine-data.js'); process.exit(2); }
const MC = JSON.parse(m[1]);

let updated = 0, kept = 0, noData = 0;
const changes = [];
for (const [name, mon] of Object.entries(MC.mons)) {
  const s = SETS.species[norm(name)];
  if (!s || !s.sets || !s.sets.length || s.n < 10) { noData++; kept++; continue; }
  const top = s.sets[0];
  const before = { mv: mon.mv, item: mon.item, ab: mon.ab };
  mon.mv = (top.moves || []).map(x => norm(x));
  mon.item = norm(top.item) || null;
  mon.ab = norm(top.ability) || null;
  mon.nature = norm(top.nature) || null;
  mon.sp = spFor(top);
  /* AND RECOMPUTE THE STAT LINE, or the artifact contradicts itself. buildMon() reads the stored
   * `st`, not `bs` + `sp`, so writing sp alone would leave every mon with the old inherited stat
   * line while its moves and ability changed underneath it.
   *
   * HP TAKES A DIFFERENT FORMULA (Will) and it is not a detail: HP gets +level+10 and NEVER takes
   * the nature multiplier — that is why a 1 HP Shedinja is possible. Every other stat is
   * nature x (base_at_50 + sp). medicham2's own l50() drops sp.hp entirely while buildMonFromSet
   * adds it, a 50 HP disagreement on Garchomp between two functions in the same file; that path is
   * latent today (l50 is only called for mega conversion, always without sp) but the formula used
   * here is buildMonFromSet's, which is the one that honours the investment. */
  if (mon.bs) {
    const b = mon.bs;
    const at50 = (base) => Math.floor((2 * base + 31) * 50 / 100) + 5;
    const [up, down] = NAT[norm(top.nature)] || [null, null];
    const natMul = (k) => (k === up ? 1.1 : k === down ? 0.9 : 1);
    const S = (base, key) => Math.floor(Math.floor(at50(base) + (mon.sp[key] || 0)) * natMul(key));
    mon.st = {
      hp: Math.floor((2 * b.hp + 31) * 50 / 100) + 50 + 10 + (mon.sp.hp || 0),
      at: S(b.atk, 'at'), df: S(b.def, 'df'),
      sa: S(b.spa, 'sa'), sd: S(b.spd, 'sd'), sp: S(b.spe, 'sp'),
    };
  }
  /* PROVENANCE TRAVELS WITH THE ROW. A consumer must be able to tell an observed field from an
   * assumed one without reading this file. */
  mon.set_source = { observed: ['mv', 'item', 'ab', 'nature'], assumed: ['sp'],
                     n: s.n, share: top.share, distinct_sets: s.distinct_sets };
  updated++;
  if (before.mv.join(',') !== mon.mv.join(',') || norm(before.ab) !== mon.ab)
    changes.push({ name, before, after: { mv: mon.mv, item: mon.item, ab: mon.ab }, n: s.n });
}

console.log('REBUILD SETS FROM SHEETS\n');
console.log(`  species in engine-data   ${Object.keys(MC.mons).length}`);
console.log(`  rebuilt from real sheets ${updated}`);
console.log(`  left alone (<10 sheets)  ${noData}`);
console.log(`  materially changed       ${changes.length}`);
console.log('\n  examples:');
for (const c of changes.slice(0, 8)) {
  console.log(`\n    ${c.name}  (${c.n} sheets)`);
  console.log(`      was  ${JSON.stringify(c.before.mv)}  @${c.before.item}  ${c.before.ab}`);
  console.log(`      now  ${JSON.stringify(c.after.mv)}  @${c.after.item}  ${c.after.ab}`);
}

if (!WRITE) { console.log('\n  REPORT ONLY. Re-run with --write to update data/engine-data.js.'); process.exit(0); }

const out = src.replace(/const MC = \{[\s\S]*?\};/, 'const MC = ' + JSON.stringify(MC) + ';');
fs.writeFileSync(D('data', 'engine-data.js'), out);
console.log('\n  -> data/engine-data.js updated');
