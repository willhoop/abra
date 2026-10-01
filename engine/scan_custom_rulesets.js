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
/* REGULATION-AWARE — 2026-09-30 (MEASURE, abra/regmc 1.36.0). This scanned Reg M-B's ladder raw logs
 * and nothing else, so `exclude_custom_ruleset` removed 0 Reg M-C games while reporting ON. Under a
 * non-owner regulation (--regulation / ABRA_REGULATION, through engine/regulation.js) the defaults are
 * that regulation's raw-log shards (data/raw/games.<format>/*.jsonl.gz, both formats, plus any flat
 * data/games.<format>.raw-logs.jsonl) and its two parsed stores; `--raw-add <path>` adds a raw file
 * (repeatable), and the write below is turned into data/custom-ruleset-ids-<id>.json by the regulation
 * seam. Under Reg M-B nothing changes. */
const REGN = require('./regulation.js');
const Q = require('./quality.js');
const IS_OWNER = REGN.ID === REGN.ARTIFACT_OWNER;
const REG_FORMATS = IS_OWNER ? [] : [REGN.BO3_FORMAT, REGN.FORMAT].filter(Boolean);
const regRaw = () => {
  const out = [];
  for (const fmt of REG_FORMATS) {
    const dir = D('data', 'raw', 'games.' + fmt);
    try { for (const f of fs.readdirSync(dir).filter(f => /\.jsonl\.gz$/.test(f)).sort()) out.push(path.join(dir, f)); }
    catch (e) { console.error(`scan_custom_rulesets: no raw shards for ${fmt} (${e.code || e.message}); its store rows will count as UNTESTABLE.`); }
    const flat = D('data', 'games.' + fmt + '.raw-logs.jsonl');
    if (fs.existsSync(flat) || fs.existsSync(flat + '.gz')) out.push(flat);
  }
  return out;
};
const RAW_DEFAULT = IS_OWNER ? [D('data', 'games.ladder.raw-logs.jsonl')] : regRaw();
const STORE_DEFAULT = IS_OWNER ? [D('data', 'games.ladder.jsonl')] : REG_FORMATS.map(f => D('data', 'games.' + f + '.jsonl'));
const REPORT = IS_OWNER ? 'docs/_reports/2026-09-21-custom-ruleset-filter.md' : 'docs/_reports/2026-09-30-regmc-store-quality.md';

const flag = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const flags = n => process.argv.map((a, i) => (a === n ? process.argv[i + 1] : null)).filter(Boolean);
const RAWS = (flag('--raw', null) ? [flag('--raw', null)] : RAW_DEFAULT).concat(flags('--raw-add'));
const STORES = flag('--store', null) ? [flag('--store', null)] : STORE_DEFAULT;
if (!RAWS.length) { console.error('scan_custom_rulesets: no raw log to scan for ' + REGN.ID + ' -- refusing to write an empty verdict.'); process.exit(1); }
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
/* 2026-09-30: CALLED, NOT COPIED. The plain-wins copy that stood here went wrong with quality.js's for
 * Reg M-C, where the plain file is a stale local snapshot; the one rule now lives in quality.js. */
function resolveStore(p) { return Q.storePath(p); }
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
  for (const RAW of RAWS) await eachLine(RAW, (line) => {
    rawSeen++;
    const m0 = line.match(ID);
    if (!m0) { rawNoId++; return; }
    /* AN OWNED COPY OF THE ID, NOT A SLICE. A regex capture is a V8 sliced string that keeps its whole
     * parent alive, so a Set of ids retained every raw log it was cut from: 97,000 Reg M-C logs ran the
     * heap out at 2 GB on 2026-09-30. Reg M-B's single flat file never reached the limit. */
    const m = [null, Buffer.from(m0[1], 'utf8').toString('utf8')];
    rawIds.add(m[1]);
    const b = line.match(BOX);
    if (!b) return;
    box++;
    if (BOX_PLURAL.test(line)) plural++; else singular++;
    /* The captured text is a JSON string body, so a `\n` in it is two characters. Rule lists are
     * single-line in every row seen, but unescape rather than assume. */
    const rules = Buffer.from(b[2].replace(/\\n/g, ' ').replace(/\\"/g, '"').trim(), 'utf8').toString('utf8');
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
  for (const STORE of STORES) await eachLine(STORE, (line) => {
    storeSeen++;
    const m0 = line.match(ID);
    if (!m0) { storeNoId++; return; }
    const m = [null, Buffer.from(m0[1], 'utf8').toString('utf8')];   /* owned, not a slice: see pass 1 */
    if (storeIds.has(m[1])) return;             // dedupe: first occurrence wins, as quality.js does
    storeIds.add(m[1]);
    if (!rawIds.has(m[1])) { untestable++; return; }
    if (hits.has(m[1])) { joined++; if (LEGALITY.test(hits.get(m[1]))) joinedLeg++; }
  });

  /* ---- the artifact ------------------------------------------------------------------------ */
  const rules = [...byRule.entries()].sort((a, b) => b[1].rows - a[1].rows)
    .map(([k, v]) => ({ rules: k, rows: v.rows, alters_legality: v.alters_legality, entity_token: v.entity_token }));
  /* The verdict per (format, rule string), from the one classifier, so the artifact says why each room
   * is in or out. Counted over the store-joined rooms only. */
  const verdictTable = new Map();
  if (!IS_OWNER) for (const [id, r] of hits) {
    if (!storeIds.has(id)) continue;
    const reg = Q.customRuleRegime(Q.formatOfId(id), r);
    const k = reg.format + '|' + r;
    const e = verdictTable.get(k) || { format: reg.format, rules: r, rows: 0, verdict: reg.verdict,
      force_open_sheets: reg.force_open_sheets, best_of: reg.best_of, other: reg.other };
    e.rows++; verdictTable.set(k, e);
  }
  const ruleIndex = new Map(rules.map((r, i) => [r.rules, i]));
  /* UNDER A NON-OWNER REGULATION ONLY THE LEGALITY-ALTERING ROOMS ARE EXCLUDED — and that is a scope
   * decision already written down, not a new one. docs/REGMC.md "THE M-C POOL CARRIES CUSTOM-RULE
   * ROOMS": `Force Open Team Sheets` is the rule that MAKES a game open-sheet, which is Reg M-C's scope,
   * and whether to drop the `Best of = 3` rooms "is a judgement and it has not been taken". So `ids`
   * (what engine/quality.js excludes) holds the rooms whose rules change what a team may contain or how
   * many are picked (LEGALITY or an explicit +X/-X entity token, the `alter_legality_union` classifier),
   * and every other infobox room is published under `ids_information_regime_not_excluded` for that
   * judgement. Sheet-regime rooms are already scoped by the pool predicate (openSheet and both sheets).
   * Under Reg M-B every infobox room is excluded, as Will decided on 2026-09-21. */
  /* SUPERSEDED 2026-10-01 BY WILL'S DECISION. The paragraph above is left as it was written. Under a
   * non-owner regulation EVERY custom-rule room is now excluded except one whose rules leave the game
   * exactly the open-sheet bo3 game (Force Open Team Sheets + Best of = 3, nothing else). The split is
   * made by engine/quality.js customRuleRegime(), the one classifier, from each room's own rule text and
   * format; quality.js re-classifies at read time and reports any disagreement with this file. The
   * allowed rooms are published under `ids_open_sheet_bo3`. Under Reg M-B nothing changes. */
  /* 2026-10-01, Will's second decision: a room whose rules touch only the sheets and the series length is split out as
   * `ids_sheet_rules_only`. It is not excluded by its text; engine/quality.js reasons() admits it when the game showed
   * both sheets (open-sheet turn play, and open-sheet bo3 by consent at best of three) and excludes it otherwise. */
  const ids = {}, idsOpenBo3 = {}, idsSheetOnly = {};
  for (const [id, r] of [...hits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const reg = Q.customRuleRegime(Q.formatOfId(id), r);
    if (IS_OWNER) ids[id] = ruleIndex.get(r);
    else if (reg.open_sheet_bo3) idsOpenBo3[id] = ruleIndex.get(r);
    else if (Q.sheetRulesOnly(reg)) idsSheetOnly[id] = ruleIndex.get(r);
    else ids[id] = ruleIndex.get(r);
  }

  const untestableShare = storeIds.size ? untestable / storeIds.size : 0;
  const out = {
    by: 'engine/scan_custom_rulesets.js',
    ...(IS_OWNER ? {} : { regulation: REGN.ID, formats: REG_FORMATS }),
    generated: new Date().toISOString(),
    report: REPORT,
    what: 'Every game id whose RAW log carries Showdown\'s custom-rule infobox. data/quality-filter.json '
        + 'rules.exclude_custom_ruleset reads `ids`; the store is never edited. Each value indexes '
        + '`rule_strings`.',
    floor_not_census: 'THE INFOBOX IS IN THE RAW LOG. A store row whose raw log is not on disk cannot be '
        + 'tested, so `counts.ids` is a FLOOR. untestable.share is what this scan could not ask.',
    sources: IS_OWNER ? { raw_logs: stampFile(RAWS[0]), store: stampFile(STORES[0]) } : {
      raw_logs: { files: RAWS.length, bytes: RAWS.map(stampFile).reduce((a, x) => a + (x.bytes || 0), 0),
                  first: stampFile(RAWS[0]).path, last: stampFile(RAWS[RAWS.length - 1]).path },
      stores: STORES.map(stampFile) },
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
      ...(IS_OWNER ? {} : { ids_open_sheet_bo3: Object.keys(idsOpenBo3).length, ids_sheet_rules_only: Object.keys(idsSheetOnly).length }),
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
    ...(IS_OWNER ? {} : { verdict_by_format_and_rules: [...verdictTable.values()].sort((a, b) => b.rows - a.rows),
                          classifier: 'engine/quality.js customRuleRegime() — `ids` excluded (a rule other than a sheet or best-of rule); `ids_open_sheet_bo3` the open-sheet bo3 game by rule; `ids_sheet_rules_only` decided per game by engine/quality.js reasons(): admitted when both sheets were shown (Will, 2026-10-01)' }),
    ids,
    ...(IS_OWNER ? {} : { ids_open_sheet_bo3: idsOpenBo3, ids_sheet_rules_only: idsSheetOnly }),
  };
  const body = JSON.stringify(out, null, 1) + '\n';
  if (OUT) fs.writeFileSync(OUT, body);
  else fs.writeFileSync(D('data', 'custom-ruleset-ids.json'), body);

  if (QUIET) return;
  const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : 'n/a');
  console.log('CUSTOM-RULESET SCAN');
  console.log(`  raw logs             ${rawSeen.toLocaleString()} records  (${RAWS.length} file(s); first ${stampFile(RAWS[0]).mtime})`);
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
  if (!IS_OWNER) console.log(`  EXCLUDED (${REGN.ID})       ${Object.keys(ids).length.toLocaleString()} ids under a rule other than a sheet or best-of rule; `
    + `${Object.keys(idsOpenBo3).length.toLocaleString()} open-sheet bo3 rooms kept; ${Object.keys(idsSheetOnly).length.toLocaleString()} sheet-rules-only rooms decided per game by their sheets (Will, 2026-10-01)`);
  console.log('\n  top rule strings');
  for (const r of rules.slice(0, 8))
    console.log(`    ${String(r.rows).padStart(6)}  ${r.alters_legality ? 'LEGALITY' : '        '}  ${r.rules.slice(0, 84)}`);
  console.log(`\n  wrote ${OUT ? path.relative(D('.'), OUT) : REGN.artifactFor('data/custom-ruleset-ids.json')}`);
})();
