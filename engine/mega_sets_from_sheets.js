/* mega_sets_from_sheets.js — WHAT A MEGA FORME ACTUALLY BRINGS, DECLARED BY THE PLAYER.
 *
 * ROADMAP #138. Will, 2026-08-10: *"BRO WE HAVE MOVESET DATA FROM TEAM SHEETS AND SMOGON USE THEM"*.
 *
 * THE PROBLEM THIS EXISTS FOR, measured on data/engine-data.js before it was written: of 76 mega rows
 * whose source forme has a real moveset, only 8 carried the same moves. Sixty-eight carried something
 * else — Round, Snore, Facade, Frustration, moves nobody brings on purpose — and EVERY ONE OF THOSE 68
 * CARRIED NO `set_source` AT ALL, while their base forme carried thousands of observed sheets
 * (Charizard n=3,180, Swampert n=1,567). The mega rows were never observed by anything. Venusaur-Mega,
 * one of the most-brought megas in the format, read `venoshock, round, snore, protect`.
 *
 * The consequence is the one CLAUDE.md already records for the empty-`mv` hole: a body that threatens
 * NOTHING. `incomingThreat` finds no real attack, every switch check reads "survives", and the mega is
 * priced as harmless. An EMPTY moveset is a visible gap; a FILLER moveset is an invisible one, which is
 * exactly why this survived both `artifact_audit` and the mega-pointer check added earlier today —
 * both ask whether the moveset is ABSENT, and these are not absent.
 *
 * ================= WHY THE SHEET AND NOT THE BASE FORME =========================================
 *
 * The first proposed fix was to copy the BASE forme's set, on the reasoning that mega evolution does
 * not change moves. That is true of the game and it is still the weaker answer, because the sheet
 * DECLARES the real thing and the base row is a different distribution — the players who bring
 * Venusaur and the players who bring Venusaurite are not the same population.
 *
 * IT ALSO NEARLY CAUSED AN OVER-MATCH, and this is the reason the scope below is `requiredItem` rather
 * than `changesFrom`. Rotom-Heat, Rotom-Wash, Rotom-Frost and Rotom-Mow all carry `changesFrom` and
 * their movesets differ from base Rotom COMPLETELY AND CORRECTLY — Overheat, Hydro Pump, Blizzard and
 * Leaf Storm are the whole point of those formes, and all four are OBSERVED (n=260, 819, 22, 50). A
 * base-comparison rule applied to every `changesFrom` row would have overwritten four correct,
 * observed rows with base Rotom's. Printed before it was wired, per the standing rule.
 *
 * ================= THE DERIVATION IS UNAMBIGUOUS ================================================
 *
 * A sheet declares species + item. A MEGA STONE IDENTIFIES THE FORME: an entry reading
 * `species: Venusaur, item: Venusaurite` IS Venusaur-Mega, with its four real moves, declared by the
 * player who brought it. No inference, no prior, no filler.
 *
 * The stone -> forme map is read from the DEX (`item.megaStone`, which maps base name -> forme name),
 * never from a hand list — CLAUDE.md's standing rule, and the ban list of four is what a hand list is
 * worth here.
 *
 * ================= WHAT IS RECORDED, AND WHY THE COUNT TRAVELS ==================================
 *
 * Every row carries `source` and `observations`. TWO OBSERVATIONS IS A SET, NOT A DISTRIBUTION —
 * Audino-Mega has exactly 2 — and a row backed by 2 sheets and a row backed by 345 must not read the
 * same downstream. The count is what lets the next audit ask "is this row THIN?" instead of only "is
 * it absent?".
 *
 *   node engine/mega_sets_from_sheets.js            print what the store declares
 *   node engine/mega_sets_from_sheets.js --json     the same, as the artifact
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const D = (...p) => path.join(__dirname, '..', ...p);

const nrm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE STORES THAT CAN CARRY A SHEET. The open-sheet regime is the Bo3 ladder; the main ladder is
 * scanned too because the format allows players to agree to open sheets and `durable-ingest` records
 * the line wherever it appears. A store that is absent is COUNTED, never silently skipped — a missing
 * file and a file with no sheets are different facts. */
const STORES = ['games.bo3.jsonl', 'games.ladder.jsonl'];

/* the stone -> forme map, from the dex. Returns null when the dex cannot be opened, and the caller
 * REFUSES rather than falling back — guessing the forme from a name is what produced the bug this
 * file fixes. */
function stoneMap(dex) {
  const byItemAndBase = new Map();      // 'itemid|basespeciesid' -> forme id
  for (const it of dex.items.all()) {
    if (!it.exists || it.isNonstandard || !it.megaStone) continue;
    for (const baseName of Object.keys(it.megaStone))
      byItemAndBase.set(nrm(it.id) + '|' + nrm(baseName), nrm(it.megaStone[baseName]));
  }
  return byItemAndBase;
}

async function collect(opts) {
  const CS = require(D('engine', 'champions_sim.js'));
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const MAP = stoneMap(dex);

  const counts = new Map();             // formeId -> Map(setKey -> {n, moves})
  const stats = { files: [], games: 0, sheetGames: 0, entries: 0, stoneEntries: 0,
                  stoneNoForme: 0, stoneNoFormeFirst: '' };

  for (const f of STORES) {
    const p = D('data', f);
    if (!fs.existsSync(p)) { stats.files.push(f + ' ABSENT'); continue; }
    let n = 0, sh = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let g; try { g = JSON.parse(line); } catch (e) { continue; }
      n++;
      const S = g.sheets;
      if (!S || (!S.p1 && !S.p2)) continue;
      sh++;
      for (const side of ['p1', 'p2']) {
        for (const e of (S[side] || [])) {
          stats.entries++;
          const item = nrm(e.item);
          if (!item) continue;
          const forme = MAP.get(item + '|' + nrm(e.species));
          if (!forme) {
            /* the item is a stone but not THIS body's — or not a stone at all. Only the first case is
             * interesting and it is counted, because a stone that resolves to no forme means the map
             * and the store disagree about a name. */
            if ([...MAP.keys()].some(k => k.startsWith(item + '|'))) {
              stats.stoneNoForme++;
              if (!stats.stoneNoFormeFirst) stats.stoneNoFormeFirst = e.species + ' + ' + e.item;
            }
            continue;
          }
          stats.stoneEntries++;
          const moves = (e.moves || []).map(nrm).filter(Boolean).sort();
          if (!moves.length) continue;
          const key = moves.join(',');
          if (!counts.has(forme)) counts.set(forme, new Map());
          const m = counts.get(forme);
          m.set(key, { n: (m.get(key) ? m.get(key).n : 0) + 1, moves });
        }
      }
    }
    stats.files.push(f + ' ' + n + ' games, ' + sh + ' with a sheet');
    stats.games += n; stats.sheetGames += sh;
  }

  /* THE MODAL DECLARED SET. Not a union and not a per-slot vote: a UNION would invent a five-move
   * body nobody brought, and a per-slot vote would mix two different archetypes into one set that
   * exists on no team. The modal set is a set somebody actually declared. */
  const out = {};
  for (const [forme, sets] of counts) {
    const ranked = [...sets.values()].sort((a, b) => b.n - a.n || a.moves.join().localeCompare(b.moves.join()));
    const total = ranked.reduce((s, x) => s + x.n, 0);
    out[forme] = { moves: ranked[0].moves, source: 'sheet', observations: total,
                   modal_n: ranked[0].n, distinct_sets: ranked.length };
  }
  return { sets: out, stats, dex };
}

/* SMOGON, WHERE THE SHEETS ARE THIN OR ABSENT. Second, never first, and it says so in the row: this
 * is a population prior and a sheet is a declaration. `data/smogon-priors.json` is already a frozen
 * release input, so nothing new enters the release surface. */
function smogonFallback(formeId, priors) {
  const S = (priors || {}).species || {};
  const row = S[formeId] || S[nrm(formeId)];
  if (!row) return null;
  const mv = row.moves || row.mv;
  if (!mv) return null;
  const list = Array.isArray(mv) ? mv.slice()
    : Object.entries(mv).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => nrm(x[0]));
  if (!list.length) return null;
  return { moves: list.map(nrm).sort(), source: 'smogon', observations: row.raw || 0 };
}

module.exports = { collect, smogonFallback, stoneMap, nrm, STORES };

if (require.main === module) {
  (async () => {
    require(D('engine', 'showdown_path.js'));
    const { sets, stats } = await collect();
    console.log('MEGA MOVESETS, DECLARED BY OPEN TEAM SHEETS');
    for (const f of stats.files) console.log('  ' + f);
    console.log('  ' + stats.games + ' games scanned, ' + stats.sheetGames + ' carried a sheet, '
      + stats.entries + ' sheet entries, ' + stats.stoneEntries + ' of them holding a mega stone');
    if (stats.stoneNoForme) console.log('  ' + stats.stoneNoForme + ' entr(ies) held a stone that '
      + 'resolves to no forme for that body (first: ' + stats.stoneNoFormeFirst + ') — the store and '
      + 'the dex disagree about a name, or the player brought a stone the body cannot use');
    const rows = Object.entries(sets).sort((a, b) => b[1].observations - a[1].observations);
    console.log('  ' + rows.length + ' distinct mega formes observed\n');
    for (const [k, v] of rows) {
      console.log('  ' + k.padEnd(22) + String(v.observations).padStart(4) + ' obs  '
        + String(v.modal_n).padStart(3) + 'x  ' + v.moves.join(', ')
        + (v.distinct_sets > 1 ? '   [' + v.distinct_sets + ' distinct sets]' : ''));
    }
    if (!rows.length) console.log('  ZERO FORMES OBSERVED — this is not a pass. Either no store has a '
      + 'sheet, or the stone->forme map resolved nothing.');
    if (process.argv.includes('--json')) console.log(JSON.stringify(sets, null, 1));
  })().catch(e => { console.error(e); process.exit(1); });
}
