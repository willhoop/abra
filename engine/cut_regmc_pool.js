/* cut_regmc_pool.js — CUT THE FROZEN REG M-C TEAM POOL. MEASURE, 2026-09-20.
 *
 * ABRA-HEAP: 4096
 *
 *   node engine/cut_regmc_pool.js                 dry run: derive and print every count, write nothing
 *   node engine/cut_regmc_pool.js --write         write the pool, its receipt and its FROZEN.md
 *   node engine/cut_regmc_pool.js --no-validate   skip the TeamValidator diagnostic (it costs ~60 s)
 *
 * WHY A FROZEN POOL AT ALL. `engine/diff_swarm.js` draws the differential's team pool LIVE from the
 * store unless `--team-store <dir>` pins it, and OPS appends to the store hourly. Two runs an hour
 * apart therefore ask two different questions and neither is wrong — that is the whole reason
 * `data/team-pool-frozen/` exists for Reg M-B, and its FROZEN.md records the run it cost.
 * Everything Reg M-C is ever measured against is drawn from this directory, so it is cut first.
 *
 * WHY THIS IS A SCRIPT AND THE M-B POOL WAS A PLAIN COPY. The M-B pool is `cp` — no predicate, so
 * prose could describe it completely. This cut EXCLUDES games, and an exclusion described only in
 * prose is not reproducible. The predicate below is the definition; FROZEN.md is generated from
 * this run so the counts in it cannot be mistyped.
 *
 * THE SCOPE (Will, 2026-09-20)
 * ---------------------------
 * OPEN TEAM SHEETS ONLY, the same in-scope population as Reg M-B. The bo3 stream is open-sheet by
 * construction; the bo1 ladder has a minority that are, and only those are taken. A closed-sheet
 * game reveals what was CLICKED, never the team of six, and a team is what a pool is made of.
 *
 * THE EJECT BUTTON EXCLUSION, AND IT IS A CONJUNCTION
 * --------------------------------------------------
 * Showdown commit aa6d5f0856 ("Champions: Allow self-switches even if Eject Button is triggered",
 * authored 2026-09-13 20:13 UTC) adds a Champions override for ONE item — read from that commit's
 * diff of data/mods/champions/items.ts, where the added key is `ejectbutton` — so a pivot move into
 * that item resolves differently before and after. M-C went live 2026-09-09, four days earlier, so
 * part of this store was played under the old rule. The deploy time to the live server is unknown,
 * hence a full day's margin: the boundary is `date < 2026-09-14`, and `date` is UTC derived from the
 * replay's `uploadtime` (READ: engine/durable-ingest.js:38,517).
 *
 * A DATE-ONLY CUT WOULD HAVE BEEN 25x THE DAMAGE FOR NOTHING. A game in which the item never appears
 * cannot have been affected by a change to that item. Measured on this store, both halves and the
 * conjunction, and printed on every run.
 *
 * BOTH SHEETS ARE SCANNED, NOT THE HOLDER'S. Under open sheets every item on the field was declared
 * by one of the two players, so a Trick or a swap is still visible on somebody's sheet. That is a
 * claim this run RE-DERIVES rather than assumes: it counts games naming the item anywhere in the
 * record and not on either sheet, and prints the number. It is zero inside the in-scope population
 * and it is NOT zero in the raw ladder store, where closed-sheet games hide the item entirely —
 * which is evidence for the scope rule, not against it.
 *
 * THE RECEIPT IS WRITTEN FROM THE PATH THAT WAS ACTUALLY OPENED. ROADMAP #547: a pool cache once
 * stamped digests taken from the LIVE paths during a pinned run, and provenance.js verified it
 * correctly, for the wrong reason — the receipt agreed with itself and described a store the run
 * never read. Every digest below is taken from the handle this run read or wrote.
 *
 * LEGALITY IS WHAT THE TeamValidator ACCEPTS (Will, 2026-09-20: "lets use the showdown team
 * validator again for reg mc"). Two uses here, and NEITHER of them filters a game:
 *   - the excluded item is confirmed to be in the format by validating a REAL sheet that carries it;
 *   - every kept sheet is validated, as a diagnostic on the store. A rejection here is a claim about
 *     the RECONSTRUCTION, not about the team: the store records no Stat Points, and the validator's
 *     zero-investment clause fires only on a Serious nature (READ:
 *     <showdown>/sim/team-validator.ts:1339-1343). That class is counted apart from every other.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const WRITE = process.argv.includes('--write');
const VALIDATE = !process.argv.includes('--no-validate');

/* The Reg M-C authority. docs/REGMC.md: two checkouts, and this is the moving one. The M-B checkout
 * is PINNED and is not read here. */
const SHOWDOWN = arg('--showdown', 'C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc');
const FORMAT = 'gen9championsvgc2026regmc';

const SRC_BO3 = arg('--bo3', 'data/games.gen9championsvgc2026regmcbo3.jsonl.gz');
const SRC_LADDER = arg('--ladder', 'data/games.gen9championsvgc2026regmc.jsonl.gz');
const OUT_DIR = arg('--out', 'data/team-pool-frozen-regmc');

/* THE PREDICATE, in one place -- engine/regmc_pool_predicate.js since abra/regmc 0.23.0, because the
 * Reg M-C usage model (engine/usage_regulation.js) counts the same population and a copy would drift. */
const PRED = require('./regmc_pool_predicate.js');
const { CUTOFF, FIX_COMMIT, EJECT_ID, norm, declaresItem } = PRED;

function die(msg) { console.error('FATAL: ' + msg); process.exit(1); }

/* ---- the authority, and the item ---------------------------------------------------------------
 * Nothing about the item is typed as a fact: the id above is a citation to the commit that created
 * the problem, and everything asserted about it is read out of the format on this run. A checkout
 * that cannot answer is a HARD STOP, never a skipped check — tests/test-no-silent-failure.js is a
 * ratchet and a capability that cannot prove it ran is assumed broken. */
let Dex, TeamValidator;
try { ({ Dex, TeamValidator } = require(SHOWDOWN + '/dist/sim')); }
catch (e) { die('cannot load the Reg M-C Showdown authority at ' + SHOWDOWN + ' (' + (e && e.message) + ')'); }
const DEX = Dex.forFormat(FORMAT);
const ITEM = DEX.items.get(EJECT_ID);
if (!ITEM || !ITEM.exists) die('the item ' + EJECT_ID + ' does not exist in ' + FORMAT);
const TV = new TeamValidator(FORMAT);

/* ---- reading a store WITHOUT a torn read -------------------------------------------------------
 * The collector appends to these stores hourly and commits them. This runs inside a git worktree
 * whose HEAD is pinned, so the bytes read are a tracked blob at a commit — the stable read the
 * project's own rule asks for. The digest of what was opened is stamped either way, so a run that
 * DID read a moving file can be told apart from one that did not. */
function readStore(rel) {
  const abs = path.isAbsolute(rel) ? rel : D(rel);
  let gz; try { gz = fs.readFileSync(abs); } catch (e) { die('cannot read ' + abs + ' (' + (e && e.message) + ')'); }
  const sha = crypto.createHash('sha256').update(gz).digest('hex');
  const text = /\.gz$/i.test(abs) ? zlib.gunzipSync(gz).toString('utf8') : gz.toString('utf8');
  const lines = text.split('\n').filter(l => l.trim());
  const st = fs.statSync(abs);
  return { abs, rel: path.relative(ROOT, abs).replace(/\\/g, '/'), sha256: sha, bytes: st.size, mtime: st.mtime.toISOString(), lines };
}


/* Each kept game is written back BYTE FOR BYTE as the store held it. A pool is a copy with rows
 * removed; rewriting a row would make it a derivation of the store rather than a sample of it. */
function cut(store, label) {
  const keep = [];
  const st = {
    label, total: store.lines.length, unreadable: 0,
    excl_not_open_sheet: 0, excl_eject_old_rule: 0,
    before_cutoff: 0, declares_item_any_date: 0,
    in_scope: 0, in_scope_before_cutoff: 0,
    names_item_anywhere_raw: 0, names_item_anywhere_in_scope: 0,
    in_scope_names_item_off_sheet: 0, in_scope_names_item_off_sheet_before: 0,
    ids: new Set(), dup_ids: 0, sides: 0, sheets: 0, teams: new Set(), slots: 0, slots_evs_null: 0,
    date_min: null, date_max: null,
  };
  for (const line of store.lines) {
    let g; try { g = JSON.parse(line); } catch (e) { st.unreadable++; continue; }
    const rawNamesItem = norm(line).includes(EJECT_ID);
    if (rawNamesItem) st.names_item_anywhere_raw++;
    /* CLAUSE 1 — scope. Open team sheets only, and a sheet that is not there is not a sheet. */
    if (!PRED.inScope(g)) { st.excl_not_open_sheet++; continue; }
    st.in_scope++;
    const before = PRED.before(g);
    if (before) st.in_scope_before_cutoff++;
    const declares = declaresItem(g);
    if (declares) st.declares_item_any_date++;
    if (rawNamesItem) st.names_item_anywhere_in_scope++;
    if (rawNamesItem && !declares) {
      st.in_scope_names_item_off_sheet++;
      if (before) st.in_scope_names_item_off_sheet_before++;
    }
    /* CLAUSE 2 — the conjunction. Before the fix AND the item is declared on a sheet. */
    if (before && declares) { st.excl_eject_old_rule++; continue; }
    keep.push(line);
    if (st.ids.has(g.id)) st.dup_ids++; else st.ids.add(g.id);
    if (!st.date_min || g.date < st.date_min) st.date_min = g.date;
    if (!st.date_max || g.date > st.date_max) st.date_max = g.date;
    for (const s of ['p1', 'p2']) {
      const t = g.sheets[s] || [];
      st.sides++; st.sheets++;
      /* Counted, not asserted: the validator diagnostic below rests on the store carrying no Stat
       * Points, so the run proves that about ITS OWN sample instead of repeating it. */
      for (const p of t) { st.slots++; if (p && p.evs == null) st.slots_evs_null++; }
      /* The same dedupe key diff_swarm.js uses, so "distinct teams" here means what it means there. */
      st.teams.add(t.map(p => norm(p && p.species) + ':' + ((p && p.moves) || []).map(norm).sort().join('.')).sort().join('|'));
    }
  }
  st.kept = keep.length;
  st.before_cutoff = st.in_scope_before_cutoff;
  return { keep, st };
}

/* ---- the validator, twice ---------------------------------------------------------------------- */
function setFrom(p) {
  /* No `name`: the store's nickname slot holds a normalised species key for some formes, which the
   * validator rejects as a too-long NICKNAME — a fact about the reconstruction and nothing else. */
  return { species: p.species, item: p.item, ability: p.ability, moves: p.moves,
           nature: p.nature, gender: p.gender || undefined, level: p.level || 50 };
}
function confirmItemInFormat(kept) {
  for (const line of kept) {
    const g = JSON.parse(line);
    for (const s of ['p1', 'p2']) {
      const sh = g.sheets[s] || [];
      if (!sh.some(p => norm(p && p.item) === EJECT_ID)) continue;
      const problems = TV.validateTeam(sh.map(setFrom));
      if (!problems) return { game: g.id, side: s, verdict: 'ACCEPT' };
      if (problems.every(r => /0 Stat Points/.test(r))) return { game: g.id, side: s, verdict: 'ACCEPT-modulo-0SP', problems };
    }
  }
  return null;
}
function validateAll(kept) {
  let sides = 0, accept = 0, only0sp = 0, other = 0; const reasons = {};
  for (const line of kept) {
    const g = JSON.parse(line);
    for (const s of ['p1', 'p2']) {
      sides++;
      const pr = TV.validateTeam((g.sheets[s] || []).map(setFrom));
      if (!pr) { accept++; continue; }
      if (pr.every(r => /0 Stat Points/.test(r))) { only0sp++; continue; }
      other++;
      for (const r of pr.filter(r => !/0 Stat Points/.test(r))) reasons[r.slice(0, 120)] = (reasons[r.slice(0, 120)] || 0) + 1;
    }
  }
  return { sides, accept, only0sp, other, reasons };
}

/* ---- run ---------------------------------------------------------------------------------------- */
const t0 = Date.now();
const bo3Src = readStore(SRC_BO3);
const ladSrc = readStore(SRC_LADDER);
const bo3 = cut(bo3Src, 'bo3 (open-sheet by construction)');
const ots = cut(ladSrc, 'ladder bo1 (open-sheet subset)');
/* The two files are deduped SEPARATELY, so adding their team counts double-counts a team that
 * laddered in both streams. The union is the honest breadth of the pool. */
const UNION_TEAMS = new Set([...bo3.st.teams, ...ots.st.teams]).size;

const num = n => n.toLocaleString('en-US');
console.log('CUT THE FROZEN REG M-C TEAM POOL');
console.log('  format         ' + FORMAT + '   authority ' + SHOWDOWN);
console.log('  item excluded  ' + ITEM.name + ' (id ' + ITEM.id + ', isNonstandard ' + JSON.stringify(ITEM.isNonstandard)
            + ') — the key added by Showdown ' + FIX_COMMIT);
console.log('  boundary       date < ' + CUTOFF + ' UTC');
for (const { st } of [bo3, ots]) {
  console.log('');
  console.log('  ' + st.label);
  console.log('    store lines                         ' + num(st.total) + '   unreadable ' + st.unreadable);
  console.log('    EXCLUDED not-open-sheet             ' + num(st.excl_not_open_sheet));
  console.log('    in scope (open sheet, both sheets)  ' + num(st.in_scope));
  console.log('      of which date < ' + CUTOFF + '        ' + num(st.in_scope_before_cutoff));
  console.log('      of which declare the item         ' + num(st.declares_item_any_date));
  console.log('    EXCLUDED eject-button-old-rule      ' + num(st.excl_eject_old_rule) + '   (the conjunction)');
  console.log('    KEPT                                ' + num(st.kept));
  console.log('    sides ' + num(st.sides) + '  sheets ' + num(st.sheets) + '  distinct teams ' + num(st.teams.size)
              + '  distinct ids ' + num(st.ids.size) + '  dup ids ' + st.dup_ids);
  console.log('    dates ' + st.date_min + ' -> ' + st.date_max);
  console.log('    item named anywhere in the record: raw store ' + num(st.names_item_anywhere_raw)
              + ', in scope ' + num(st.names_item_anywhere_in_scope)
              + ' — in scope and NOT on a sheet ' + st.in_scope_names_item_off_sheet
              + ' (before the fix: ' + st.in_scope_names_item_off_sheet_before + ')');
}

let confirm = null, val3 = null, valO = null;
if (VALIDATE) {
  confirm = confirmItemInFormat(bo3.keep) || confirmItemInFormat(ots.keep);
  if (!confirm) die('no kept sheet declares ' + ITEM.name + ' — the validator confirmation could not be staged, '
                    + 'which is a claim about the fixture and must not be reported as a fact about the format');
  console.log('');
  console.log('  VALIDATOR — the excluded item is in the format: a real kept sheet carrying it validates '
              + confirm.verdict + ' (' + confirm.game + ' ' + confirm.side + ')');
  val3 = validateAll(bo3.keep); valO = validateAll(ots.keep);
  for (const [lab, v] of [['bo3', val3], ['ots', valO]]) {
    console.log('  VALIDATOR — ' + lab + ': ' + num(v.sides) + ' sides, accept ' + num(v.accept)
                + ', reject ONLY on the 0-Stat-Point clause ' + num(v.only0sp) + ', reject on anything else ' + num(v.other));
    for (const [r, n] of Object.entries(v.reasons).sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log('      ' + n + '  ' + r);
  }
}

/* ---- write --------------------------------------------------------------------------------------- */
const LF = txt => txt.replace(/\r\n/g, '\n');
function writeFile(abs, text) { fs.writeFileSync(abs, LF(text)); const b = fs.readFileSync(abs);
  return { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }; }

if (!WRITE) { console.log(''); console.log('  DRY RUN — nothing written. Pass --write. (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); process.exit(0); }

const outAbs = path.isAbsolute(OUT_DIR) ? OUT_DIR : D(OUT_DIR);
fs.mkdirSync(outAbs, { recursive: true });
const wrote = {
  'games.bo3.jsonl': writeFile(path.join(outAbs, 'games.bo3.jsonl'), bo3.keep.join('\n') + '\n'),
  'games.ots.jsonl': writeFile(path.join(outAbs, 'games.ots.jsonl'), ots.keep.join('\n') + '\n'),
};
wrote['games.bo3.jsonl'].lines = bo3.keep.length;
wrote['games.ots.jsonl'].lines = ots.keep.length;

/* THE POOL DIGEST — one number a run's receipt can name. It is over the CONTENT of both files in a
 * fixed order, so it changes if either file changes and cannot be forged by renaming. */
const poolDigest = crypto.createHash('sha256')
  .update(wrote['games.bo3.jsonl'].sha256 + '\n' + wrote['games.ots.jsonl'].sha256 + '\n').digest('hex');

const receipt = {
  generated: new Date().toISOString(),
  by: 'engine/cut_regmc_pool.js',
  what: 'The frozen Reg M-C team pool. Everything M-C is measured against is drawn from here.',
  format: FORMAT, showdown_authority: SHOWDOWN,
  predicate: {
    scope: 'openSheet === true AND both sheets present',
    exclusion: 'date < ' + CUTOFF + ' (UTC) AND an item with id ' + EJECT_ID + ' is declared on EITHER sheet',
    exclusion_reason: 'Showdown ' + FIX_COMMIT + ' (2026-09-13 20:13 UTC) changed what a pivot move does '
                    + 'against ' + ITEM.name + '; the deploy time to the live server is unknown, hence a day of margin',
    conjunction: 'both clauses, never the date alone — a game in which the item never appears cannot have been affected',
  },
  /* ROADMAP #547 — these are the paths this run OPENED, digested from the handle it read. */
  sources: {
    [bo3Src.rel]: { sha256: bo3Src.sha256, bytes: bo3Src.bytes, mtime: bo3Src.mtime, lines: bo3Src.lines.length },
    [ladSrc.rel]: { sha256: ladSrc.sha256, bytes: ladSrc.bytes, mtime: ladSrc.mtime, lines: ladSrc.lines.length },
  },
  files: wrote,
  pool_digest: poolDigest,
  counts: {
    bo3: { ...bo3.st, ids: undefined, teams: bo3.st.teams.size, distinct_ids: bo3.st.ids.size },
    ots: { ...ots.st, ids: undefined, teams: ots.st.teams.size, distinct_ids: ots.st.ids.size },
    distinct_teams_union: UNION_TEAMS,
  },
  validator: confirm ? { item_confirmed: confirm, bo3: val3, ots: valO } : 'skipped by --no-validate',
};
fs.writeFileSync(path.join(outAbs, 'pool-receipt.json'), LF(JSON.stringify(receipt, null, 2)) + '\n');

/* FROZEN.md IS GENERATED. The M-B pool's was typed, because a plain copy has nothing to get wrong;
 * this one carries a predicate and eleven counts, and a typed count is how this project's fourteen
 * handoffs went stale. Re-running with --write reproduces it exactly. */
const row = (st, files) => '| `' + files + '` | ' + num(st.kept) + ' | ' + num(wrote[files].bytes) + ' | `'
  + wrote[files].sha256.slice(0, 12) + '` |';
const md = `# The Reg M-C team pool, frozen — ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC

**GENERATED by \`node engine/cut_regmc_pool.js --write\`. Do not hand-edit — re-run it.**

Everything Reg M-C is ever measured against is drawn from this directory. It is the first M-C
artifact for the same reason \`data/team-pool-frozen/\` exists for Reg M-B: \`engine/diff_swarm.js\`
draws the differential's team pool **LIVE from the store** unless \`--team-store <dir>\` pins it, and
the collector appends hourly — so two runs an hour apart ask two different questions and neither is
wrong. On 2026-08-07 that cost a 14-arm ladder: the corpus moved between arm 3 and arm 4.

## How to use it

\`\`\`bash
node engine/game_differential.js --release <id> --team-store ${OUT_DIR} --games 1200 --write
\`\`\`

The basenames are \`games.bo3.jsonl\` and \`games.ots.jsonl\` because that is what
\`diff_swarm.loadTeams\` opens inside a \`--team-store\` directory. **A run without the flag is not
comparable to one with it**, and neither is comparable to a run taken at a different moment of the
live store.

## What is in it

| file | games | bytes | sha256 (12) |
|---|---|---|---|
${row(bo3.st, 'games.bo3.jsonl')}
${row(ots.st, 'games.ots.jsonl')}

**Pool digest \`${poolDigest.slice(0, 12)}\`** — sha256 over both file digests in that order. A run's
receipt names this. Full digests, every count and the validator block: \`pool-receipt.json\`.

| | bo3 | ladder (ots) |
|---|---|---|
| store lines read | ${num(bo3.st.total)} | ${num(ots.st.total)} |
| EXCLUDED — not open sheet | ${num(bo3.st.excl_not_open_sheet)} | ${num(ots.st.excl_not_open_sheet)} |
| in scope | ${num(bo3.st.in_scope)} | ${num(ots.st.in_scope)} |
| … of which \`date < ${CUTOFF}\` | ${num(bo3.st.in_scope_before_cutoff)} | ${num(ots.st.in_scope_before_cutoff)} |
| … of which declare the item, any date | ${num(bo3.st.declares_item_any_date)} | ${num(ots.st.declares_item_any_date)} |
| **EXCLUDED — the conjunction** | **${num(bo3.st.excl_eject_old_rule)}** | **${num(ots.st.excl_eject_old_rule)}** |
| **KEPT** | **${num(bo3.st.kept)}** | **${num(ots.st.kept)}** |
| sides / sheets | ${num(bo3.st.sides)} | ${num(ots.st.sides)} |
| distinct teams (diff_swarm's key) | ${num(bo3.st.teams.size)} | ${num(ots.st.teams.size)} |
| duplicate game ids | ${bo3.st.dup_ids} | ${ots.st.dup_ids} |
| dates | ${bo3.st.date_min} → ${bo3.st.date_max} | ${ots.st.date_min} → ${ots.st.date_max} |

**Distinct teams across the whole pool: ${num(UNION_TEAMS)}** — the union of both files under the same
key, ${num(bo3.st.teams.size + ots.st.teams.size - UNION_TEAMS)} fewer than adding the two columns,
which is how many teams laddered in both streams.

## What was included

**Open team sheets only** (Will, 2026-09-20) — the same in-scope population as Reg M-B. The bo3
stream is open-sheet by construction; of the bo1 ladder store's ${num(ots.st.total)} games only
${num(ots.st.in_scope)} are. A closed-sheet game reveals what was CLICKED and never the team of six,
and a team is what a pool is made of.

## What was excluded, with the predicate spelled out

\`\`\`
EXCLUDE a game  IF  date < ${CUTOFF}          (UTC, derived from the replay's uploadtime)
                AND an item with id '${EJECT_ID}' is declared on EITHER sheet
\`\`\`

**It is a CONJUNCTION and the second clause is what makes it cheap.** Showdown commit
\`${FIX_COMMIT}\` ("Champions: Allow self-switches even if Eject Button is triggered", authored
2026-09-13 20:13 UTC) adds a Champions override for exactly one item, and M-C went live four days
earlier on 2026-09-09 — so part of this store was played under the old rule. The deploy time to the
live server is unknown, hence a full day of margin.

**A game in which the item never appears cannot have been affected by a change to that item.** On
the bo3 stream: ${num(bo3.st.in_scope_before_cutoff)} games predate the boundary and
${num(bo3.st.declares_item_any_date)} carry the item at any date, but only
**${num(bo3.st.excl_eject_old_rule)}** are both. A date-only cut would have discarded
${num(bo3.st.in_scope_before_cutoff)} games to guard against ${num(bo3.st.excl_eject_old_rule)}.

**BOTH sheets are scanned, not the holder's.** Under open sheets every item on the field was declared
by one of the two players, so a Trick or a swap is still visible. That is re-derived here rather than
assumed: within the in-scope population, **${bo3.st.in_scope_names_item_off_sheet + ots.st.in_scope_names_item_off_sheet}**
games name the item anywhere in the record without it appearing on a sheet — there is no hidden case.

**The raw ladder store shows what closed sheets cost.** It names the item in
${num(ots.st.names_item_anywhere_raw)} games while only ${num(ots.st.declares_item_any_date)} in-scope
games declare it; the other ${num(ots.st.names_item_anywhere_raw - ots.st.names_item_anywhere_in_scope)}
are closed-sheet games where nothing is declared at all and the conjunction could not be evaluated.
That is evidence for the scope rule rather than against it.

## Legality is what the TeamValidator accepts

Will, 2026-09-20: *"lets use the showdown team validator again for reg mc"*. Neither use below
filters a game.

- **The excluded item is in the format**, tested the honest way: a real kept sheet carrying it is
  accepted by the M-C \`TeamValidator\`${confirm ? ' (' + confirm.game + ', ' + confirm.side + ' — ' + confirm.verdict + ')' : ''}.
  The dex agrees — \`${ITEM.name}\`, \`isNonstandard: ${JSON.stringify(ITEM.isNonstandard)}\`.
- **Every kept sheet was validated as a diagnostic on the store.**${val3 ? `
  bo3: ${num(val3.sides)} sides, **${num(val3.accept)} accepted**, ${num(val3.only0sp)} rejected on the
  zero-investment clause alone, ${num(val3.other)} on anything else.
  ladder: ${num(valO.sides)} sides, **${num(valO.accept)} accepted**, ${num(valO.only0sp)} / ${num(valO.other)}.
  **A rejection here is a claim about the RECONSTRUCTION, not about the team.** The store records no
  Stat Points — \`evs\` is null on ${num(bo3.st.slots_evs_null + ots.st.slots_evs_null)} of
  ${num(bo3.st.slots + ots.st.slots)} declared slots in this pool — and the zero-investment clause fires only
  when the nature is Serious (READ: \`<showdown>/sim/team-validator.ts:1339-1343\`) — so that class is
  an artifact of the store schema and is counted apart from everything else.` : ' *(skipped)*'}

## When it comes off

It does not come off during the M-C build. It is re-cut only deliberately, and a re-cut changes the
pool digest, which is what makes a before/after detectable instead of silent. **Going back to the
live store without saying so is the failure this directory exists to prevent** — it would not look
like anything.

*The \`.jsonl\` files are untracked by \`.gitignore\`, exactly as the M-B pool's are: they are a local
measurement pin, not repo content. This page and \`pool-receipt.json\` are tracked, and the digests
above are what make the pin checkable rather than assumed.*
`;
fs.writeFileSync(path.join(outAbs, 'FROZEN.md'), LF(md));

console.log('');
console.log('  WROTE ' + OUT_DIR + '/games.bo3.jsonl (' + num(bo3.keep.length) + ' games, ' + num(wrote['games.bo3.jsonl'].bytes) + ' bytes)');
console.log('  WROTE ' + OUT_DIR + '/games.ots.jsonl (' + num(ots.keep.length) + ' games, ' + num(wrote['games.ots.jsonl'].bytes) + ' bytes)');
console.log('  WROTE ' + OUT_DIR + '/FROZEN.md, pool-receipt.json');
console.log('  POOL DIGEST ' + poolDigest);
console.log('  done in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
