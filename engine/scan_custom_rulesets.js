/* ==============================================================================================
 * SCAN THE RAW LOGS FOR A CUSTOM RULESET, AND WRITE THE ID SET THE QUALITY FILTER READS.
 *
 *   node engine/scan_custom_rulesets.js [--raw <path>] [--store <path>] [--out <path>] [--quiet]
 *
 * WHY THIS EXISTS. A ladder game played under custom rules is not the game this project models.
 * Found 2026-09-21 by engine/sanity_check.py, which failed on ONE game where both sides brought six:
 * it was a Tournament battle run with `!Picked Team Size`, so pick-4 did not apply. The extractor was
 * proven innocent byte for byte before anything was declared, and the investigation then found the
 * larger problem beside it - see docs/_reports/2026-09-21-six-bring-game.md.
 *
 * WILL, 2026-09-21: "yes clean the store filter it all out".
 *
 * THE STORE IS NOT EDITED. `store raw, analyze on top` - every game stays, and the ANALYSIS excludes.
 * This writes a derived id set; data/quality-filter.json's `exclude_custom_ruleset` reads it.
 *
 * TWO KINDS, AND BOTH ARE FILTERED. A minority alter what a team may legally CONTAIN or how many are
 * picked (`!obtainable`, `+past`, `+jirachi`, a stone unban, `!Picked Team Size`). The majority set a
 * different INFORMATION REGIME instead - overwhelmingly `Best of = 3`, i.e. bo3 tournament games
 * sitting in the bo1 ladder store, which is a different format and a different metagame. Neither
 * belongs in the ladder corpus.
 *
 * THE REGEX TAKES `rules?` AND THAT SINGLE CHARACTER IS THE WHOLE DISAGREEMENT WITH THE FIRST SCAN.
 * Showdown writes `<strong>1 custom rule:</strong>` when exactly one rule is set and
 * `<strong>N custom rules:</strong>` otherwise. The 2026-09-21 investigation matched
 * `(\d+) custom rules:` - plural only - so every single-rule room was invisible to it, and a
 * single-rule room is overwhelmingly a bare `Best of = 3`. That is why it reported 1,176 where this
 * reports several times as many. The run prints the singular/plural split so the claim is checkable
 * rather than argued, and `counts.plural_only` reproduces the older figure on the same bytes.
 *
 * WHAT THIS CANNOT SEE, AND IT IS STATED RATHER THAN IMPLIED. The infobox is in the RAW log, so a row
 * whose raw log is not on disk cannot be tested. The count is a FLOOR, never a census, and the run
 * prints the untestable share every time. A silent zero there would let a partial scan read as a
 * clean corpus, which is this project's signature failure mode.
 * ============================================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), readline = require('readline');

const D = (...p) => path.join(__dirname, '..', ...p);
const RAW_DEFAULT = D('data', 'games.ladder.raw-logs.jsonl');
const STORE_DEFAULT = D('data', 'games.ladder.jsonl');
const REPORT = 'docs/_reports/2026-09-21-custom-ruleset-filter.md';

const flag = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RAW = flag('--raw', RAW_DEFAULT);
const STORE = flag('--store', STORE_DEFAULT);
/* NULL, NOT A DEFAULT CONSTANT, AND THE WRITE BELOW SPELLS THE NAME OUT. engine/provenance.js ranks
 * `the file's own name on a write line` above `its name bound to an identifier that is written`, and
 * engine/quality.py — which only READS this artifact, through `open(CUSTOM_RULESET, ...)` — scores
 * the lower rank on it. Binding the default to a constant here left the two arms tied at that lower
 * rank and the graph attributed this file to its READER. That is the exact false-attribution class
 * provenance.js's own header records four times over, so the write is spelled the way the checker
 * can read. */
const OUT = flag('--out', null);
const QUIET = process.argv.includes('--quiet');

/* `rules?` - see the header. `[^<]*` stops at the closing </details>, so the captured text is the
 * rule list exactly as Showdown rendered it. */
const BOX = /<strong>\s*(\d+)\s+custom rules?:<\/strong>\s*<\/summary>\s*([^<]*)/i;
const BOX_PLURAL = /<strong>\s*\d+\s+custom rules:<\/strong>/i;
/* The id is the first key of every record in both stores; reading it with a regex avoids parsing a
 * 100 KB log 77,000 times. A record that does not match is counted, never skipped silently. */
const ID = /^\{"id":"([^"]+)"/;

/* ALTERS WHAT A TEAM MAY LEGALLY CONTAIN, OR HOW MANY ARE PICKED. Anything else (Best of = 3, open
 * sheet forcing, timer and clause removals) changes the information regime, not legality. This is the
 * 2026-09-21 investigation's classifier unchanged, so the two runs' `alter_legality_or_pick` counts
 * are comparable; `entity_token` below is the wider question and is reported separately rather than
 * folded in. */
const LEGALITY = /!\s*obtainable|\+\s*past|\+\s*jirachi|\+[a-z]+ite\b|!\s*picked\s*team\s*size|!\s*min\s*team\s*size/i;
/* Any `+X` or `-X` token: an explicit unban or ban of a named entity. It catches what LEGALITY above
 * misses - `+golisopod`, `+electrium z`, `+salamence-mega`, and the restricted-event ban lists
 * (`-Sneasler, -Garchomp, ...` and `Best of = 3, - Garchomp, ...`, which is why the space after the
 * sign is optional). It is NOT used to classify, because swapping the classifier would make this run
 * incomparable with the one it is settling; it is reported beside it, and the two are UNIONED in
 * `counts.alter_legality_union`. Neither is a superset of the other:
 * `!obtainable, forceopenteamsheets, bestof=3` alters legality with no entity token at all. */
const ENTITY = /(^|[,\s])[+-]\s*[A-Za-z]/;

/* A RECEIPT IS WRITTEN FROM THE PATH THE RUN ACTUALLY OPENED, never from the canonical path for that
 * kind of file (ROADMAP #547 — a pool cache stamped the live paths during a pinned run and passed
 * provenance for the wrong reason). The path is reported repo-relative when it is inside the repo and
 * absolute when it is not, so a run pointed at another checkout says so. */
function stampFile(p) {
  const abs = path.resolve(resolveStore(p));
  const rel = path.relative(D('.'), abs);
  const shown = (rel && !rel.startsWith('..')) ? rel.split(path.sep).join('/') : abs.split(path.sep).join('/');
  try { const st = fs.statSync(abs); return { path: shown, bytes: st.size, mtime: new Date(st.mtimeMs).toISOString() }; }
  catch (e) { return { path: shown, error: String(e.message || e) }; }
}

/* PLAIN WINS WHEN BOTH EXIST, AND `.gz` IS READ WHEN IT IS ALL THERE IS — the same rule and the same
 * ordering as storePath()/readStoreText() in engine/quality.js, because a second convention for "where
 * is the store" is how two readers of one corpus disagree. On a fresh clone only the `.gz` exists. */
function resolveStore(p) {
  if (fs.existsSync(p)) return p;
  if (fs.existsSync(p + '.gz')) return p + '.gz';
  return p;                                  // let the read throw with the name the caller asked for
}
async function eachLine(file, fn) {
  const f = resolveStore(file);
  let input = fs.createReadStream(f);
  if (f.endsWith('.gz')) input = input.pipe(require('zlib').createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) { if (line) fn(line); }
}

(async () => {
  /* ---- pass 1: the raw logs. Only these carry the infobox. ---------------------------------- */
  let rawSeen = 0, rawNoId = 0, box = 0, plural = 0, singular = 0, leg = 0, ent = 0, union = 0;
  const rawIds = new Set();
  const byRule = new Map();               // rule string -> { rows, alters_legality, entity_token }
  const hits = new Map();                 // id -> rule string
  await eachLine(RAW, (line) => {
    rawSeen++;
    const m = line.match(ID);
    if (!m) { rawNoId++; return; }
    rawIds.add(m[1]);
    const b = line.match(BOX);
    if (!b) return;
    box++;
    if (BOX_PLURAL.test(line)) plural++; else singular++;
    /* The captured text is a JSON string body, so a `\n` in it is two characters. Rule lists are
     * single-line in every row seen, but unescape rather than assume. */
    const rules = b[2].replace(/\\n/g, ' ').replace(/\\"/g, '"').trim();
    const alters = LEGALITY.test(rules), entity = ENTITY.test(rules);
    if (alters) leg++;
    if (entity) ent++;
    if (alters || entity) union++;
    const r = byRule.get(rules) || { rows: 0, alters_legality: alters, entity_token: entity };
    r.rows++; byRule.set(rules, r);
    hits.set(m[1], rules);
  });

  /* ---- pass 2: the parsed store. The join, and the untestable share. ------------------------ */
  let storeSeen = 0, storeNoId = 0, joined = 0, untestable = 0, joinedLeg = 0;
  const storeIds = new Set();
  await eachLine(STORE, (line) => {
    storeSeen++;
    const m = line.match(ID);
    if (!m) { storeNoId++; return; }
    if (storeIds.has(m[1])) return;             // dedupe: first occurrence wins, as quality.js does
    storeIds.add(m[1]);
    if (!rawIds.has(m[1])) { untestable++; return; }
    if (hits.has(m[1])) { joined++; if (LEGALITY.test(hits.get(m[1]))) joinedLeg++; }
  });

  /* ---- the artifact ------------------------------------------------------------------------ */
  const rules = [...byRule.entries()].sort((a, b) => b[1].rows - a[1].rows)
    .map(([k, v]) => ({ rules: k, rows: v.rows, alters_legality: v.alters_legality, entity_token: v.entity_token }));
  const ruleIndex = new Map(rules.map((r, i) => [r.rules, i]));
  const ids = {};
  for (const [id, r] of [...hits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) ids[id] = ruleIndex.get(r);

  const untestableShare = storeIds.size ? untestable / storeIds.size : 0;
  const out = {
    by: 'engine/scan_custom_rulesets.js',
    generated: new Date().toISOString(),
    report: REPORT,
    what: 'Every game id whose RAW log carries Showdown\'s custom-rule infobox. data/quality-filter.json '
        + 'rules.exclude_custom_ruleset reads `ids`; the store is never edited. Each value indexes '
        + '`rule_strings`.',
    floor_not_census: 'THE INFOBOX IS IN THE RAW LOG. A store row whose raw log is not on disk cannot be '
        + 'tested, so `counts.ids` is a FLOOR. untestable.share is what this scan could not ask.',
    sources: { raw_logs: stampFile(RAW), store: stampFile(STORE) },
    counts: {
      raw_logs_scanned: rawSeen,
      raw_logs_without_id: rawNoId,
      with_custom_rule_infobox: box,
      plural_only: plural,
      singular_only: singular,
      distinct_rule_strings: byRule.size,
      alter_legality_or_pick: leg,
      carry_an_entity_token: ent,
      alter_legality_union: union,
      store_rows: storeSeen,
      store_rows_without_id: storeNoId,
      store_unique_ids: storeIds.size,
      joined_to_store: joined,
      joined_share: storeIds.size ? +(joined / storeIds.size).toFixed(6) : 0,
      joined_alter_legality_or_pick: joinedLeg,
      ids: Object.keys(ids).length,
    },
    untestable: {
      store_ids_with_no_raw_log: untestable,
      share: +untestableShare.toFixed(6),
      why: 'the raw-log file is a snapshot; the parsed store keeps growing after it. These rows were '
         + 'never asked the question, so every count here is a floor.',
    },
    settles: {
      claim: 'docs/_reports/2026-09-21-six-bring-game.md 5b reported 1,176 store rows with a custom-rule '
           + 'infobox and 19 distinct rule strings.',
      cause: 'its regex required the PLURAL `custom rules:`, so every one-rule room was invisible, and a '
           + 'one-rule room is overwhelmingly a bare `Best of = 3`. `counts.plural_only` asks the older '
           + 'question on these bytes.',
    },
    rule_strings: rules,
    ids,
  };
  const body = JSON.stringify(out, null, 1) + '\n';
  if (OUT) fs.writeFileSync(OUT, body);
  else fs.writeFileSync(D('data', 'custom-ruleset-ids.json'), body);

  if (QUIET) return;
  const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : 'n/a');
  console.log('CUSTOM-RULESET SCAN');
  console.log(`  raw logs             ${rawSeen.toLocaleString()} records  (${stampFile(RAW).mtime})`);
  console.log(`  custom-rule infobox  ${box.toLocaleString()} (${pct(box, rawSeen)})  in ${byRule.size} distinct rule strings`);
  console.log(`    plural "rules:"    ${plural.toLocaleString()}   <- what the 2026-09-21 investigation could see`);
  console.log(`    singular "rule:"   ${singular.toLocaleString()}   <- what it could not`);
  console.log(`  alters legality/pick ${leg.toLocaleString()}   (+X/-X entity token: ${ent.toLocaleString()}; `
    + `UNION ${union.toLocaleString()} - neither classifier contains the other)`);
  console.log(`  store                ${storeIds.size.toLocaleString()} unique ids of ${storeSeen.toLocaleString()} rows`);
  console.log(`  JOINED               ${joined.toLocaleString()} = ${pct(joined, storeIds.size)} of the store `
    + `(${joinedLeg} of them alter legality or pick)`);
  /* PRINTED EVERY RUN. Silence here would let a partial scan read as a complete one. */
  console.log(`  UNTESTABLE           ${untestable.toLocaleString()} store ids have no raw log on disk `
    + `(${pct(untestable, storeIds.size)}) - the count above is a FLOOR, not a census`);
  console.log('\n  top rule strings');
  for (const r of rules.slice(0, 8))
    console.log(`    ${String(r.rows).padStart(6)}  ${r.alters_legality ? 'LEGALITY' : '        '}  ${r.rules.slice(0, 84)}`);
  console.log(`\n  wrote ${path.relative(D('.'), OUT || D('data', 'custom-ruleset-ids.json'))}`);
})();
