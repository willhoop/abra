/* merge_mega_into_engine.js - put the mega formes into data/engine-data.js so the damage engine
 * stops treating a mega as its base form.
 *
 * The gap this closes: Charizard-Mega-Y appears in ~906 sets in our store and the engine dex had
 * ONE mega forme in it. Every damage calculation involving a mega used the base species' stats,
 * typing and ability - silently wrong, on some of the most common Pokemon in the format.
 *
 * Source of the mega data: data/mega-dex-official.json, built from Showdown's own pokedex.json.
 *
 * On abilities, stated plainly: replay logs CANNOT tell us a mega's ability. Mega evolution emits
 * only `|detailschange|` and `|-mega|`; no ability line follows. An earlier harvest appeared to find
 * conflicts (garchompmega "Speed Boost", dragonitemega "Intimidate") but those were attribution
 * noise on 1-6 observations, plus three real cases of Trace copying an opponent's ability. So the
 * official dex is used for abilities, and the harvest is kept only as a discovery tool for which
 * formes exist in this format.
 *
 * Level-50 stats use the same convention as the existing entries (see build_mega_dex.js) - an
 * approximation of a competitive spread, not the opponent's real EVs, which closed sheets hide.
 *
 *   node engine/merge_mega_into_engine.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);

const src = fs.readFileSync(D('engine-data.js'), 'utf8');
const m = src.match(/const MC = (\{[\s\S]*?\});/);
if (!m) { console.error('could not find the MC object in engine-data.js'); process.exit(1); }
const MC = JSON.parse(m[1]);
const mega = JSON.parse(fs.readFileSync(D('mega-dex-official.json'), 'utf8'));

const before = Object.keys(MC.mons).length;

/* THE TWO FILES DO NOT AGREE ON HOW TO SPELL A KEY, and this script used the source's spelling
 * directly. mega-dex-official.json keys `venusaurmega`; engine-data.js keys `venusaur-mega`. NONE of
 * the 67 forms this script writes matched — 0 exact, 48 matching only after normalising — so every
 * `MC.mons[key]` lookup below missed. The branch meant to UPDATE an existing entry could only ever
 * ADD a parallel one under the other spelling, and once a later regeneration rewrote the MC table
 * wholesale the real entries were left as the table had them: `ab: null`, `mv: []`, `item: null` on
 * all 57 megas.
 *
 * That is 21.1% of this format's usage carrying no ability at all — no Contrary on Staraptor-Mega
 * (the most-used mega here at 428,748), no Drought on Charizard-Mega-Y, no Swift Swim on
 * Swampert-Mega, no Huge Power on Mawile-Mega, no Electric Surge on Raichu-Mega-X.
 *
 * Found by engine/artifact_audit.js, which exists because Will asked how this was not caught
 * (2026-07-30). The answer: nothing in this project compared a derived artifact against the source
 * it was derived from, so a build step could be silently undone and every consumer kept reading the
 * null.
 *
 * Resolved by NORMALISING BOTH SIDES and preferring an entry that already exists, so this script can
 * never again create a second entry for a Pokemon the table already has. A form with no existing
 * entry falls back to the ARTIFACT's convention (display name, lowercased, runs of non-alphanumerics
 * collapsed to one hyphen) rather than to the source's. */
const nrm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byNorm = new Map(Object.keys(MC.mons).map(k => [nrm(k), k]));
const artifactKey = (srcKey, f) => byNorm.get(nrm(srcKey)) ||
  (f.name || srcKey).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---- THE SOURCE OF A MEGA IS `changesFrom`, NOT `baseSpecies` (ROADMAP #138, 2026-08-10) ---------
 *
 * MEASURED, on the artifact this script writes: `floette-mega` carried `mv: []`, and that is not a
 * missing harvest. `data/mega-dex-official.json` records `base_species: "Floette"` for it, because
 * that is what Showdown's `baseSpecies` says — but the format ALSO says
 * `Floette-Mega.changesFrom = "Floette-Eternal"`, and PLAIN FLOETTE IS ILLEGAL IN THIS FORMAT. So the
 * moves lookup below resolved to a body with no row and inherited nothing. The store confirms which
 * of the two is real: `floetteeternal -> floettemega`, 5,433 games. Floette-Mega is in ~10.4% of
 * stored games and, with an empty `mv`, threatened NOTHING in any rollout — the same consequence this
 * file's own header records for the mega-ability hole, one field over.
 *
 * Three formes in this format have `changesFrom !== baseSpecies` (Floette-Mega, Meowstic-F-Mega and
 * the Ogerpon Teras), so this is a class and not an instance. It is asked of the DEX rather than of
 * the JSON snapshot, because `changesFrom` is not in that snapshot at all.
 *
 * IT REFUSES TO RUN WITHOUT THE DEX. Falling back to `base_species` is exactly the silent default that
 * produced the empty row, and a builder that quietly writes the wrong pointer is worse than one that
 * stops. */
let DEX = null;
try {
  const CS = require(path.join(__dirname, 'champions_sim.js'));
  DEX = CS.sim().Dex.forFormat(CS.FORMAT);
} catch (e) {
  console.error('merge_mega_into_engine REFUSES TO RUN: the format dex would not open — ' + e.message);
  console.error('  The mega source pointer is `changesFrom`, which only the dex carries. Falling back');
  console.error('  to mega-dex-official.json\'s `base_species` is what emptied floette-mega\'s moves.');
  process.exit(1);
}
/* the artifact key of the body a forme CHANGES FROM, or null. Reported by the caller, never guessed. */
function sourceKeyOf(artKey, f) {
  const sp = DEX.species.get(artKey);
  const fromName = (sp && sp.exists && sp.changesFrom) || f.base_species || '';
  const from = DEX.species.get(nrm(fromName));
  if (!from || !from.exists) return { key: null, name: fromName };
  return { key: byNorm.get(nrm(from.id)) || null, name: from.name, id: from.id };
}

let added = 0, updated = 0, skipped = 0;
const pointerFixed = [], pointerOrphan = [];
for (const [srcKey, f] of Object.entries(mega.forms)) {
  const key = artifactKey(srcKey, f);
  /* "Only carry what actually shows up" — but an entry the table ALREADY HAS shows up by definition,
   * whatever this source's stale `in_our_store` flag says. Eight formes were being skipped while
   * sitting in engine-data.js with a null ability, Heracross-Mega among them at 7,072 usage. The
   * guard is meant to stop the dex growing, not to stop an existing entry being completed. */
  if (!f.in_our_store && !MC.mons[key]) { skipped++; continue; }
  /* ONLY touch mega/primal formes — the original rule, and it is RIGHT about updates: the existing
   * non-mega entries were built elsewhere and are what the damage validation runs against, so
   * rewriting their stats with this file's approximate spread would be an unrequested behaviour
   * change. That caution is preserved exactly below: a non-mega forme may be ADDED, never UPDATED.
   *
   * WHY ADDING THEM IS NOT OPTIONAL, measured 2026-08-02. A forme with no row at all makes dmgMon
   * return null, and then EVERY damage-derived feature reads zero for that Pokemon — no kill odds,
   * no threat, no risk. Over 60 self-play games that was 3.62% of all candidate scorings, and the
   * offenders are Gourgeist-Super (25), Aegislash-Blade and Palafin-Hero. These are not obscure:
   * Aegislash-Blade is Aegislash's ATTACKING forme, 140 Atk against Shield's 50, so the bot was
   * blind to it in exactly the state that matters.
   *
   * The cosmetic-forme fallback in engine/mc_key.js deliberately refuses to substitute the base when
   * the stats differ — correctly, since Shield's body is not Blade's — so the fallback cannot fix
   * this and a real row is the only answer.
   *
   * THE PREDICATE IS NARROW ON PURPOSE: in our store, no existing entry, and a body that actually
   * differs from the base. A forme whose stats and types match its base needs no row, because the
   * fallback already handles it exactly. */
  const isMega = /mega|primal/i.test(f.forme || '');
  const baseKey = byNorm.get(nrm(f.base_species || ''));
  const baseRow = baseKey && MC.mons[baseKey];
  const bodyDiffers = !!(baseRow && f.base_stats &&
    JSON.stringify(baseRow.bs) !== JSON.stringify(f.base_stats));
  const addableForme = !isMega && !MC.mons[key] && f.in_our_store && bodyDiffers;
  if (!isMega && !addableForme) { skipped++; continue; }
  /* WHERE THIS ROW INHERITS FROM, resolved through the format and REPORTED when the two disagree —
   * a pointer that silently changed is the same class of bug as a pointer that was silently wrong. */
  const SRC = sourceKeyOf(key, f);
  if (SRC.id && nrm(SRC.id) !== nrm(f.base_species || ''))
    pointerFixed.push(`${key}: source is ${SRC.name} (changesFrom), NOT ${f.base_species} (baseSpecies)`);
  if (!SRC.key && isMega && !(MC.mons[key] && (MC.mons[key].mv || []).length))
    pointerOrphan.push(`${key}: its source ${SRC.name || '(unresolved)'} has no row in this artifact, ` +
      'so there are no moves to inherit');
  const entry = {
    t: f.types,
    /* BASE STATS, and their absence was a real bug shipped on 2026-07-30. This object wrote `st`
     * (the level-50 line) and not `bs`. The 48 formes that already existed kept their `bs` through
     * the Object.assign below, but the 19 this script ADDED had none at all -- and
     * medicham2-browser.js's buildMon opens with `if(!m||!m.bs) return null`, so those 19 could not
     * be built by the damage engine AT ALL. The same shape as the hole this script exists to close,
     * reintroduced by the fix for it, and caught only when CHOMP's dex refresh counted 289 where
     * ABRA reported 308.
     *
     * It is also why engine/artifact_audit.js now checks `bs`: the cohort check covered ab, mv,
     * item, t, st and wt, so the one field the repair forgot was the one field nothing looked at. */
    bs: f.base_stats,
    st: f.lvl50,
    /* MOVES COME FROM THE BASE SPECIES when the mega has none of its own, because mega evolution
     * changes stats, typing and ability — it does NOT change the moveset. Every mega was built with
     * `mv: []` and the consequence was not cosmetic: buildMon returns a Pokemon with no moves, so
     * incomingThreat's inner loop finds no attack, scores `best = 0`, and reports the mega as
     * threatening NOTHING. switchSurvives1/2 read "survives" against all 75 of them and
     * switchDiesFirst could never fire — on 26.0% of this format's usage, in the same switch logic
     * this session had just finished fixing.
     *
     * Resolved through the SAME normalising lookup as the key itself, so a base species spelled
     * differently in the two files still resolves. */
    /* THE MOVESET IS DECIDED BELOW, FROM THE SHEETS, and this line only carries whatever was already
     * there so the Object.assign has something to overwrite. See the SHEET pass after this loop. */
    mv: (MC.mons[key] && MC.mons[key].mv || []).length ? MC.mons[key].mv
      : ((MC.mons[SRC.key] || {}).mv || []),
    item: f.required_item || (MC.mons[key] && MC.mons[key].item) || null,
    ab: f.ability,
    /* THE POINTER THE CONSUMERS FOLLOW. It is the `changesFrom` body's own id, not `base_species` —
     * medicham2's `megaRowMoves`/`megaRowAbility` walk it to complete a row, and pointing them at an
     * illegal body is how `floette-mega` ended up threatening nothing. */
    base: SRC.id || (f.base_species ? nrm(f.base_species) : null),
    mega: /mega|primal/i.test(f.forme || '') || undefined,
  };
  if (MC.mons[key]) { MC.mons[key] = Object.assign({}, MC.mons[key], entry); updated++; }
  else { MC.mons[key] = entry; added++; }
}

/* ---- THE MOVESET COMES FROM THE OPEN TEAM SHEET (ROADMAP #138, 2026-08-10) ----------------------
 *
 * Will: *"BRO WE HAVE MOVESET DATA FROM TEAM SHEETS AND SMOGON USE THEM"*.
 *
 * MEASURED BEFORE IT WAS CHANGED. Of 76 mega rows whose source forme has a real moveset, EIGHT carried
 * the same moves. Sixty-eight carried something else, and every one of those 68 carried NO `set_source`
 * at all while its base carried thousands of observed sheets. Nothing had ever observed a mega row —
 * the store names only the base species in `brought[]`, so the set generator had ~0 samples per mega
 * and filled the slots. Venusaur-Mega read `venoshock, round, snore, protect`; Meganium-Mega read
 * `round, snore, protect` and Will named the move it should have had.
 *
 * AN EMPTY MOVESET IS A VISIBLE GAP AND A FILLER MOVESET IS AN INVISIBLE ONE. That asymmetry is the
 * whole reason this survived every existing check: `artifact_audit` check B, the cohort check and the
 * mega-pointer check added earlier today ALL ask whether the moveset is ABSENT, and three moves of
 * filler is not absent. So filler is never written here — a row with no evidence is emptied, loudly.
 *
 * WHAT THE SHEET GIVES THAT THE BASE FORME COULD NOT. A sheet declares species + item, and a MEGA
 * STONE IDENTIFIES THE FORME, so `Venusaur + Venusaurite` IS Venusaur-Mega with its four declared
 * moves. That is OBSERVED and DECLARED — the strongest evidence in this project — where the base row is
 * a different population (the players who bring Venusaur and the ones who bring Venusaurite are not the
 * same people). 13,116 games in the store carry a sheet and 44,163 of their entries hold a stone.
 *
 * SMOGON IS SECOND AND SAYS SO IN THE ROW. `provenance.source` and `provenance.observations` travel
 * with every set, because two observations is a SET and 4,527 is a DISTRIBUTION and a consumer must be
 * able to tell them apart. That is also what lets the audit ask "is this row THIN?" rather than only
 * "is it absent?". */
const SHEETS = require(path.join(__dirname, 'mega_sets_from_sheets.js'));
const megaMv = { sheet: [], smogon: [], emptied: [], kept: [] };
async function applySheetMovesets() {
  const { sets, stats } = await SHEETS.collect();
  let priors = null;
  try { priors = JSON.parse(fs.readFileSync(D('smogon-priors.json'), 'utf8')); } catch (e) { priors = null; }
  /* A SHEET PASS THAT OBSERVED NOTHING MUST NOT EMPTY THE TABLE. A missing store and a store with no
   * sheets are different accidents from "this forme is genuinely unobserved", and only the last one
   * justifies clearing a row. Refuse rather than destroy. */
  if (!Object.keys(sets).length) {
    console.error('merge_mega_into_engine REFUSES TO REWRITE MOVESETS: the sheet pass observed ZERO '
      + 'mega formes across ' + stats.games + ' games. Either no store is present or the stone->forme '
      + 'map resolved nothing. Emptying every mega row on the strength of a failed read is exactly the '
      + 'silent default this pass exists to remove.');
    return stats;
  }
  for (const key of Object.keys(MC.mons)) {
    const row = MC.mons[key];
    if (!row.mega && !/-(mega|primal)(-|$)/i.test(key)) continue;
    const id = nrm(key);
    const had = (row.mv || []).slice();
    const S = sets[id];
    const G = S ? null : SHEETS.smogonFallback(id, priors);
    if (S) {
      row.mv = S.moves.slice();
      row.mv_provenance = { source: 'sheet', observations: S.observations, modal_n: S.modal_n,
                            distinct_sets: S.distinct_sets };
      (JSON.stringify(had) === JSON.stringify(row.mv) ? megaMv.kept : megaMv.sheet)
        .push(key + '  ' + JSON.stringify(had) + ' -> ' + JSON.stringify(row.mv)
          + '  [' + S.observations + ' obs, modal x' + S.modal_n + ']');
    } else if (G) {
      row.mv = G.moves.slice();
      row.mv_provenance = { source: 'smogon', observations: G.observations };
      megaMv.smogon.push(key + '  ' + JSON.stringify(had) + ' -> ' + JSON.stringify(row.mv)
        + '  [smogon prior, ' + G.observations + ' raw]');
    } else {
      /* NO EVIDENCE. The honest value is EMPTY with a stated reason. medicham2 already handles an empty
       * mega row by walking `base` to the source forme (`megaRowMoves`, WIRE 132) and COUNTS when it
       * cannot — so an emptied row degrades into a counted recovery rather than into silence, which a
       * filler row never could. */
      row.mv_provenance = { source: 'none', observations: 0,
        why: 'no open team sheet in the store declares this forme and no smogon prior carries it. '
           + 'Emptied rather than filled: a filler moveset passes every structural check while '
           + 'carrying no information, and medicham2 recovers an empty mega row from its `base` '
           + 'pointer and counts when it cannot.' };
      if (had.length) megaMv.emptied.push(key + '  ' + JSON.stringify(had) + ' -> []');
      row.mv = [];
    }
  }
  return stats;
}

/* ---- TWO ROWS, ONE BODY — RECONCILED HERE BECAUSE HERE IS WHERE IT SURVIVES A REGENERATION -------
 *
 * `floette-eternal-mega` and `floette-mega` are two artifact rows for the ONE species the format calls
 * Floette-Mega. They do not normalise alike, so the existing duplicate check (artifact_audit check C)
 * never saw them; the format resolves both to `floettemega`, which is what check E now asks.
 *
 * THE DUPLICATE ORIGINATES UPSTREAM, in CHOMP/engine/champ-model.js, and `build/build_engine_data.js`
 * copies its row list wholesale — so deleting the row from the artifact by hand would last exactly
 * until the next regeneration. This script runs AFTER that builder, which makes it the right place:
 * the reconciliation is re-applied every time the pipeline runs.
 *
 * THE SURVIVOR IS CHOSEN BY THE FORMAT, not by which row looks fuller: the key whose normalised form
 * equals the dex's own species id wins, and every non-empty field on the losers is merged into it
 * first so nothing is thrown away. Both halves are PRINTED — a silent merge is indistinguishable from
 * a silent deletion. */
const dupMerged = [];
{
  const bySpecies = new Map();
  for (const k of Object.keys(MC.mons)) {
    const sp = DEX.species.get(k);
    if (!sp || !sp.exists) continue;
    if (!bySpecies.has(sp.id)) bySpecies.set(sp.id, []);
    bySpecies.get(sp.id).push(k);
  }
  const filled = k => Object.values(MC.mons[k]).filter(v => v != null
    && !(Array.isArray(v) && !v.length)).length;
  for (const [id, ks] of bySpecies) {
    if (ks.length < 2) continue;
    const keep = ks.find(k => nrm(k) === id) ||
      ks.slice().sort((a, b) => filled(b) - filled(a))[0];
    const merged = { ...MC.mons[keep] };
    for (const k of ks) {
      if (k === keep) continue;
      for (const [f, v] of Object.entries(MC.mons[k])) {
        const cur = merged[f];
        const isEmpty = cur == null || (Array.isArray(cur) && !cur.length);
        if (isEmpty && v != null && !(Array.isArray(v) && !v.length)) merged[f] = v;
      }
      delete MC.mons[k];
    }
    MC.mons[keep] = merged;
    dupMerged.push(`${DEX.species.get(id).name}: kept ${keep}, folded in and removed ` +
      ks.filter(k => k !== keep).join(', '));
  }
}

/* THE SHEET PASS IS ASYNC — it streams two multi-hundred-megabyte stores — so the WRITE happens inside
 * it. Nothing below may run before the movesets have landed: writing first and rewriting afterwards
 * would leave a window in which the artifact on disk is the filler one, and a crash in between would
 * leave it there permanently. */
(async () => {
const sheetStats = await applySheetMovesets();

const out = src.replace(/const MC = \{[\s\S]*?\};/, 'const MC = ' + JSON.stringify(MC) + ';');
fs.writeFileSync(D('engine-data.js'), out);

const megasNow = Object.keys(MC.mons).filter(k => MC.mons[k].mega).length;
console.log(`merge_mega_into_engine - dex ${before} -> ${Object.keys(MC.mons).length} species`);
console.log(`  added ${added}, updated ${updated}, skipped ${skipped} (not in our store)`);
console.log(`  mega formes now in the engine dex: ${megasNow}`);
/* EVERY RECOVERY THIS SCRIPT MAKES IS COUNTED AND PRINTED, INCLUDING A ZERO. A repair that cannot
 * prove it ran is assumed broken, and all three of these were invisible until they were counted. */
console.log(`  source pointer taken from changesFrom rather than baseSpecies: ${pointerFixed.length}` +
  (pointerFixed.length ? '\n     ' + pointerFixed.join('\n     ') : ''));
console.log(`  forme rows whose source has NO ROW here, so nothing could be inherited: ` +
  `${pointerOrphan.length}` + (pointerOrphan.length ? '\n     ' + pointerOrphan.join('\n     ') : ''));
console.log(`  duplicate bodies reconciled (two artifact keys, one species): ${dupMerged.length}` +
  (dupMerged.length ? '\n     ' + dupMerged.join('\n     ') : ''));
for (const k of ['charizardmegay', 'raichumegax', 'raichumegay', 'glimmoramega']) {
  const e = MC.mons[k];
  if (e) console.log(`     ${k.padEnd(16)} ${String(e.t.join('/')).padEnd(14)} ${String(e.ab).padEnd(16)} spe ${e.st.sp}`);
}
/* THE MOVESET PASS, PRINTED IN FULL AND IN FOUR BUCKETS. A row that CHANGED is the finding; a row the
 * sheet AGREED with is the control that says the pass is not simply overwriting everything; an EMPTIED
 * row is the honest gap and is the one somebody has to look at. A zero in any bucket is readable. */
console.log(`  sheet games scanned: ${sheetStats.sheetGames} of ${sheetStats.games}, with `
  + `${sheetStats.stoneEntries} sheet entries holding a mega stone`);
if (sheetStats.stoneNoForme) console.log(`     ${sheetStats.stoneNoForme} entr(ies) held a stone that `
  + `resolves to no forme for that body (first: ${sheetStats.stoneNoFormeFirst})`);
console.log(`  movesets REWRITTEN from open team sheets: ${megaMv.sheet.length}`
  + (megaMv.sheet.length ? '\n     ' + megaMv.sheet.join('\n     ') : ''));
console.log(`  movesets the sheet AGREED with (already correct): ${megaMv.kept.length}`);
console.log(`  movesets taken from the SMOGON prior (no sheet): ${megaMv.smogon.length}`
  + (megaMv.smogon.length ? '\n     ' + megaMv.smogon.join('\n     ') : ''));
console.log(`  movesets EMPTIED because neither source carries them: ${megaMv.emptied.length}`
  + (megaMv.emptied.length ? '\n     ' + megaMv.emptied.join('\n     ') : ''));
})().catch(e => { console.error(e); process.exit(1); });
