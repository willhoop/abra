/* usage_regulation.js -- THE USAGE MODEL FOR A REGULATION OTHER THAN REG M-B. MEASURE, abra/regmc 0.23.0.
 *
 *   node engine/analyze.js --regulation regmc        (analyze.js dispatches here; this is not a CLI)
 *
 * Writes data/meta-usage-<id>.json -- the sibling of data/meta-usage.json by engine/regulation.js
 * artifactFor -- in the same shape CHOMP reads (top-level `threats`, `views.competitive`,
 * `views.ladder`), plus the provenance a reader needs to tell what it was counted from, the sets the
 * open sheets declared, and a legality audit of every entity in it.
 *
 * LIVE STORES, NOT THE FROZEN POOL -- AND WHY THAT DOES NOT BREAK THE PHOTOGRAPH RULE.
 * The frozen pool (data/team-pool-frozen-<id>/) exists because a MEASUREMENT OF MEDICHAM must read the
 * same games on every run. A usage model is not a measurement of the simulator: it is a description of
 * what people are bringing, and CHOMP wants the meta as it is now, not as it was when the pool was cut.
 * So the model is counted over the regulation's live stores -- but with the pool's own predicate
 * (engine/regmc_pool_predicate.js, the ONE definition the cutter also uses), so the population is the
 * pool's population, just later. Reproducibility is kept a different way: the stores read are the
 * TRACKED .jsonl.gz blobs the collector commits, and their sha256 digests and line counts are stamped
 * here as `source_digests`, so engine/provenance.js reports the model stale the moment the store moves.
 *
 * THE .gz, NEVER THE PLAIN FILE. On this machine a plain data/games.<format>.jsonl can sit beside the
 * .gz as a stale local snapshot (docs/REGMC.md, "One thing found on the way"), and engine/quality.js
 * prefers the plain file when both exist -- right for Reg M-B's ladder, wrong here. The path is named
 * explicitly and a plain sibling is reported, never read.
 *
 * THE FILTER, IN ORDER, EVERY STEP COUNTED:
 *   1. the row's `format` token is this regulation's (engine/durable-ingest.js storeFormatFor, the parser
 *      that stamped the rows);
 *   2. the pool predicate: open team sheets with both sheets present, minus the Eject Button conjunction;
 *   3. the shared quality filter (data/quality-filter.json through engine/quality.js reasons()), the same
 *      rules Reg M-B's competitive view applies -- bot names, behavioural bots (judged over EVERY row of
 *      this regulation's stores), a forfeit before any action, short games, a partial bring.
 *   Two quality rules key on verdict files computed over REG M-B's store only (the legality verdict and
 *   the custom-ruleset scan). They are run, and cannot match a Reg M-C id, so they are published as NOT
 *   ASKED of this regulation rather than as a clean zero. The Reg M-C custom-rule question is open and
 *   is Will's (docs/REGMC.md).
 *
 * LEGALITY IS AUDITED, NEVER FILTERED. Every species, item, ability and move in the file is checked
 * against the regulation's own format: the strict filter first (exists, not isNonstandard, not tier
 * Illegal), then, for anything it rejects, a REAL sheet carrying it is put through the TeamValidator
 * (Will, 2026-09-20: legality is what the validator accepts; docs/REGMC.md "the strict filter silently
 * deletes a live ability"). Nothing is dropped from the usage for failing: a contaminated corpus has to
 * be visible, not quietly cleaner.
 *
 * AN ABSENT STORE REFUSES. A missing store, a store with no rows of this regulation, or a model with no
 * usable game exits 1 and writes nothing -- a zero-usage artifact is the silent default this project
 * exists to prevent. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const REGN = require('./regulation.js');
const Q = require('./quality.js');
const DI = require('./durable-ingest.js');
const { usage, view } = require('./usage_table.js');

/* The in-scope predicate for each regulation that has one. A regulation with no entry REFUSES: its
 * scope has not been decided, and guessing one is what this table exists to prevent. */
const PREDICATES = { regmc: () => require('./regmc_pool_predicate.js') };

const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');

function refuse(msg) {
  process.stderr.write('usage_regulation: REFUSING TO WRITE A MODEL -- ' + msg + '\n');
  return 1;
}

/* Read one store as the bytes on disk, digest what was opened, dedupe by id (first wins, as
 * engine/quality.js readStore does). */
function readStore(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return { missing: true, rel: relPath };
  const buf = fs.readFileSync(abs);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const text = /\.gz$/.test(abs) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  const seen = new Set(), rows = [];
  let lines = 0, unreadable = 0, dup = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    lines++;
    let g; try { g = JSON.parse(line); } catch (e) { unreadable++; continue; }
    if (seen.has(g.id)) { dup++; continue; }
    seen.add(g.id); rows.push(g);
  }
  const plain = abs.replace(/\.gz$/, '');
  const plainBeside = plain !== abs && fs.existsSync(plain)
    ? { file: rel(plain), bytes: fs.statSync(plain).size, mtime: fs.statSync(plain).mtime.toISOString(), read: false } : null;
  return { rel: relPath, sha256, bytes: buf.length, mtime: fs.statSync(abs).mtime.toISOString(), lines, unreadable,
           duplicate_ids: dup, rows, plainBeside };
}

/* The regulation's Showdown checkout, loaded and asked whether it knows this format at all. */
function authority() {
  const SP = require('./showdown_path.js');
  const where = SP.RESOLVED || process.env.SHOWDOWN_PATH;
  let sim;
  try { sim = require(path.join(where, 'dist', 'sim')); }
  catch (e) { return { error: 'cannot load a Showdown build at ' + where + ' (' + String(e.message).split('\n')[0] + ')' }; }
  const fmt = sim.Dex.formats.get(REGN.FORMAT);
  if (!fmt || !fmt.exists) return { error: 'the checkout at ' + where + ' does not define ' + REGN.FORMAT };
  return { where, Dex: sim.Dex.forFormat(REGN.FORMAT), TV: new sim.TeamValidator(REGN.FORMAT) };
}

function main() {
  const t0 = Date.now();
  const id = REGN.ID;
  if (!PREDICATES[id]) return refuse('no in-scope predicate is declared for ' + id + ' in engine/usage_regulation.js PREDICATES.');
  const PRED = PREDICATES[id]();
  const TOKEN = DI.storeFormatFor({ label: REGN.LABEL, showdownFormat: REGN.FORMAT }, 'runtime.' + id);

  /* ---- the stores ------------------------------------------------------------------------------ */
  const STORES = [
    { key: 'bo3', format: REGN.BO3_FORMAT, note: 'the bo3 ladder -- open sheets by construction' },
    { key: 'ladder', format: REGN.FORMAT, note: 'the bo1 ladder -- only its open-sheet subset is in scope' },
  ].map(s => Object.assign(s, { path: 'data/games.' + s.format + '.jsonl.gz' }));
  for (const s of STORES) {
    Object.assign(s, readStore(s.path));
    if (s.missing) return refuse(s.path + ' is absent. It is a tracked collector store; a worktree or checkout without it '
      + 'must not produce a model of zero games.');
    if (s.plainBeside) process.stderr.write('  note: ' + s.plainBeside.file + ' exists beside ' + s.rel + ' and was NOT read '
      + '(a plain local copy is not the tracked store)\n');
  }
  const allRows = [].concat(...STORES.map(s => s.rows));
  if (!allRows.length) return refuse('both ' + id + ' stores are empty.');

  /* ---- the filter, each step counted per store ------------------------------------------------- */
  const cfg = Q.config();
  const bots = Q.behaviouralBots(allRows, cfg);         /* an ACCOUNT property, judged over every row of this regulation */
  const funnel = {};
  const inFormat = [], competitive = [];
  for (const s of STORES) {
    const f = { collected: s.rows.length, other_format: {}, after_format: 0, excluded_not_open_sheet: 0,
                excluded_eject_old_rule: 0, after_pool_predicate: 0 };
    const stepCounts = Object.fromEntries(Q.FUNNEL_STEPS.map(([label]) => [label, 0]));
    let clean = 0;
    const reasonTally = {};
    for (const g of s.rows) {
      if (g.format !== TOKEN) { const k = g.format || '(no format field)'; f.other_format[k] = (f.other_format[k] || 0) + 1; continue; }
      f.after_format++; inFormat.push(g);
      if (!PRED.inScope(g)) { f.excluded_not_open_sheet++; continue; }
      if (PRED.oldRule(g)) { f.excluded_eject_old_rule++; continue; }
      f.after_pool_predicate++;
      const rs = Q.reasons(g, cfg, bots);
      for (const r of rs) reasonTally[r] = (reasonTally[r] || 0) + 1;
      /* cumulative, exactly as engine/quality.js funnel() counts it */
      const applied = [];
      for (const [label, code] of Q.FUNNEL_STEPS) { applied.push(code); if (!rs.some(x => applied.includes(x))) stepCounts[label]++; }
      if (!rs.length) { competitive.push(g); clean++; }
    }
    Object.assign(f, stepCounts, { clean, reasons_flagged_anywhere: reasonTally });
    funnel[s.key] = f;
  }
  if (!inFormat.length) return refuse('the stores hold ' + allRows.length + ' rows and none carry the token ' + TOKEN + '.');
  if (!competitive.length) return refuse('no game survives the filter (' + inFormat.length + ' rows of ' + TOKEN + ').');

  /* ---- the two views, counted by the one usage table ------------------------------------------- */
  const out = usage(competitive, { humansOnly: true });
  const ladderOut = usage(inFormat, { humansOnly: true });

  /* ---- the sets the open sheets declared, per species in the competitive table ------------------ */
  const A = authority();
  if (A.error) return refuse(A.error + ' -- the legality audit cannot run, and an unaudited model is not published.');
  const D = A.Dex;
  const inTable = new Set(out.table.map(t => t.sp));
  const setsRaw = {};
  /* THE AUDIT'S SCOPE IS WIDER THAN THE FILE: every species in any team preview of this regulation's
   * stores, and every item, ability and move on any open sheet of them -- a superset of everything the
   * file publishes, so a contaminated row cannot hide in the part that did not make the table. */
  const seen = { species: new Map(), item: new Map(), ability: new Map(), move: new Map() };  /* id -> {raw, n} */
  const note = (cls, raw) => {
    if (raw == null || raw === '') return null;
    const k = PRED.norm(raw);
    const e = seen[cls].get(k) || { raw: String(raw), n: 0 };
    e.n++; seen[cls].set(k, e);
    return k;
  };
  const sheetEntities = p => [['species', p.species], ['item', p.item], ['ability', p.ability]]
    .concat((p.moves || []).map(m => ['move', m]));
  for (const g of inFormat) for (const s of ['p1', 'p2']) {
    for (const sp of ((g.six || {})[s] || [])) note('species', sp);
    if (PRED.sheetsPresent(g)) for (const p of (g.sheets[s] || [])) if (p) for (const [c, v] of sheetEntities(p)) if (c !== 'species') note(c, v);
  }
  const ids = (cls, p) => { const v = cls === 'move' ? null : p[cls]; return v == null || v === '' ? null : PRED.norm(v); };
  for (const g of competitive) for (const s of ['p1', 'p2']) {
    const pl = g[s]; if (!pl || pl.bot) continue;       /* the same sides usage() counts */
    for (const p of (g.sheets[s] || [])) {
      if (!p) continue;
      const spk = ids('species', p), ik = ids('item', p), ak = ids('ability', p);
      const mks = (p.moves || []).filter(m => m != null && m !== '').map(PRED.norm);
      if (!spk || !inTable.has(spk)) continue;
      const S = setsRaw[spk] || (setsRaw[spk] = { sheets: 0, item: {}, ability: {}, move: {} });
      S.sheets++;
      if (ik) S.item[ik] = (S.item[ik] || 0) + 1;
      if (ak) S.ability[ak] = (S.ability[ak] || 0) + 1;
      for (const mk of new Set(mks)) S.move[mk] = (S.move[mk] || 0) + 1;
    }
  }
  const nameOf = { item: k => D.items.get(k).name || k, ability: k => D.abilities.get(k).name || k, move: k => D.moves.get(k).name || k };
  const rank = (cls, obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1])
    .map(([k, c]) => ({ id: k, name: nameOf[cls](k), rate: +(c / n).toFixed(3), n: c }));
  const sets = {};
  for (const t of out.table) {
    const S = setsRaw[t.sp];
    if (!S) { sets[t.sp] = { sheets: 0 }; continue; }
    sets[t.sp] = { sheets: S.sheets, items: rank('item', S.item, S.sheets), abilities: rank('ability', S.ability, S.sheets),
                   moves: rank('move', S.move, S.sheets) };
  }

  /* ---- legality: strict filter, then the validator on a real sheet for anything it rejects ------- */
  const getter = { species: k => D.species.get(k), item: k => D.items.get(k), ability: k => D.abilities.get(k), move: k => D.moves.get(k) };
  const setFrom = p => ({ species: p.species, item: p.item, ability: p.ability, moves: p.moves,
                          nature: p.nature, gender: p.gender || undefined, level: p.level || 50 });
  const only0sp = pr => pr.every(r => /0 Stat Points/.test(r));
  const legality = { authority: A.where.replace(/\\/g, '/'), format: REGN.FORMAT,
    rule: 'strict filter (exists && !isNonstandard && tier !== "Illegal"); anything it rejects is re-asked of the '
        + 'TeamValidator on a REAL sheet carrying it. A rejection only on the 0-Stat-Point clause is a fact about the '
        + 'store (it records no Stat Points), not the team (data/team-pool-frozen-regmc/FROZEN.md).',
    by_class: {}, readmitted: [], illegal: [], unresolved: [] };
  /* pass 1: the strict filter. pass 2: up to FIXTURES real sheets for each entity it rejects. */
  const FIXTURES = 5;
  const failing = {};
  for (const cls of Object.keys(seen)) for (const k of seen[cls].keys()) if (!legal(getter[cls](k))) failing[cls + ':' + k] = [];
  const failingGames = {};                               /* cls:id -> up to 10 game ids that carry it */
  if (Object.keys(failing).length) {
    for (const g of inFormat) for (const s of ['p1', 'p2']) for (const sp of ((g.six || {})[s] || [])) {
      const k = 'species:' + PRED.norm(sp);
      if (failing[k]) { const l = failingGames[k] || (failingGames[k] = []); if (l.length < 10 && !l.includes(g.id)) l.push(g.id); }
    }
    for (const g of inFormat) if (PRED.sheetsPresent(g)) for (const s of ['p1', 'p2']) {
      const sheet = g.sheets[s] || [];
      for (const p of sheet) if (p) for (const [c, v] of sheetEntities(p)) {
        const f = failing[c + ':' + PRED.norm(v)];
        if (f && f.length < FIXTURES && !f.some(x => x.game === g.id && x.side === s)) f.push({ game: g.id, side: s, sheet });
      }
    }
  }
  for (const cls of ['species', 'item', 'ability', 'move']) {
    let strict = 0;
    for (const [k, e] of seen[cls]) {
      const x = getter[cls](k);
      if (legal(x)) { strict++; continue; }
      const row = { class: cls, id: k, as_stored: e.raw, occurrences: e.n, exists: !!(x && x.exists),
                    isNonstandard: x ? (x.isNonstandard || null) : null, tier: x && x.tier ? x.tier : null };
      const fx = failing[cls + ':' + k];
      if (failingGames[cls + ':' + k]) row.games = failingGames[cls + ':' + k];
      if (!fx.length) {
        /* NO REAL SHEET CARRIES IT -- seen only in a closed-sheet team preview. So the fixture is CONSTRUCTED
         * (memory: construct the fixture, don't find it): the species alone, its first ability, the item its
         * forme requires, one move. The team-size and 0-Stat-Point lines are about the fixture and are set
         * aside; whatever is left is the validator's verdict on the entity. Only species can reach here. */
        if (cls !== 'species' || !x || !x.exists) { row.verdict = 'NO SHEET TO VALIDATE and no fixture can be built'; legality.unresolved.push(row); continue; }
        const req = x.requiredItem || (x.requiredItems || [])[0];
        const pr = (A.TV.validateTeam([{ species: x.name, ability: (x.abilities || {})[0], item: req, moves: ['Protect'],
          nature: 'Hardy', level: 50 }]) || []).filter(r => !/must bring at least|0 Stat Points/.test(r));
        row.fixture = 'CONSTRUCTED (no real sheet carries it)';
        if (!pr.length) { row.verdict = 'VALIDATOR ACCEPTS a constructed set'; legality.readmitted.push(row); }
        else if (pr.some(r => /does not exist|banned|not allowed/i.test(r))) { row.verdict = 'VALIDATOR REJECTS a constructed set'; row.problems = pr.slice(0, 3); legality.illegal.push(row); }
        else { row.verdict = 'UNRESOLVED -- the constructed set failed on something else'; row.problems = pr.slice(0, 3); legality.unresolved.push(row); }
        continue;
      }
      /* ACCEPTED IF ANY real sheet carrying it validates: a rejection can be about another member. */
      let accepted = null; const problems = [];
      for (const f of fx) {
        const pr = A.TV.validateTeam(f.sheet.map(setFrom));
        if (!pr || only0sp(pr)) { accepted = { f, pr }; break; }
        problems.push(f.game + ' ' + f.side + ': ' + pr.filter(r => !/0 Stat Points/.test(r)).slice(0, 3).join(' | '));
      }
      if (accepted) { row.verdict = 'VALIDATOR ACCEPTS' + (accepted.pr ? ' (modulo the 0-Stat-Point clause)' : '');
        row.validated_on = accepted.f.game + ' ' + accepted.f.side; legality.readmitted.push(row); }
      else { row.verdict = 'VALIDATOR REJECTS every sheet tried (' + fx.length + ')'; row.problems = problems; legality.illegal.push(row); }
    }
    legality.by_class[cls] = { distinct: seen[cls].size, strict_legal: strict,
      readmitted_by_validator: legality.readmitted.filter(r => r.class === cls).length,
      illegal: legality.illegal.filter(r => r.class === cls).length,
      unresolved: legality.unresolved.filter(r => r.class === cls).length };
  }
  /* WHERE EACH FAILING ENTITY SITS. The audit's scope is wider than the file, so say whether the entity
   * reached a published table or only the corpus beneath it. */
  const published = { species: new Set([...out.table, ...ladderOut.table].map(t => t.sp)), item: new Set(), ability: new Set(), move: new Set() };
  for (const S of Object.values(sets)) for (const [cls, list] of [['item', S.items], ['ability', S.abilities], ['move', S.moves]])
    for (const e of (list || [])) published[cls].add(e.id);
  for (const r of [...legality.illegal, ...legality.unresolved, ...legality.readmitted]) r.in_published_table = published[r.class].has(r.id);
  legality.illegal_in_published_tables = legality.illegal.filter(r => r.in_published_table).length;
  legality.illegal_count = legality.illegal.length;
  legality.unresolved_count = legality.unresolved.length;

  /* ---- write ------------------------------------------------------------------------------------ */
  const target = path.join(ROOT, REGN.artifactFor(['data/meta', 'usage.json'].join('-')));
  const now = new Date();
  const model = {
    format: REGN.FORMAT,
    regulation: id,
    generated: now.toISOString().slice(0, 10),
    generated_at: now.toISOString(),
    by: 'engine/usage_regulation.js (dispatched by engine/analyze.js --regulation ' + id + ')',
    provenance: {
      source: 'LIVE ' + id + ' stores, the tracked .jsonl.gz the collector commits -- NOT the frozen pool',
      why_live: 'A usage model describes what is being brought now, which is what CHOMP needs; the frozen pool '
        + 'pins MEDICHAM measurements, and this is not one. The population is the pool\'s (same predicate module), '
        + 'counted later; the digests below make the exact bytes checkable.',
      stores: STORES.map(s => ({ key: s.key, file: s.rel, note: s.note, sha256: s.sha256, bytes: s.bytes, mtime: s.mtime,
        lines: s.lines, unique_games: s.rows.length, unreadable: s.unreadable, duplicate_ids: s.duplicate_ids,
        plain_file_beside_not_read: s.plainBeside })),
      formatToken: TOKEN,
      predicate: { module: 'engine/regmc_pool_predicate.js', scope: 'openSheet === true AND both sheets present',
        exclusion: 'date < ' + PRED.CUTOFF + ' (UTC) AND an item with id ' + PRED.EJECT_ID + ' is declared on EITHER sheet',
        same_as: REGN.artifactFor(REGN.POOL_DIR) + '/pool-receipt.json predicate' },
      filter: 'data/quality-filter.json',
      filter_version: cfg.version,
      funnel,
      not_asked_of_this_regulation: {
        illegal_team: 'keys on data/store-validation.json, judged over Reg M-B\'s store only; replaced here by the legality audit below',
        custom_ruleset: 'keys on data/custom-ruleset-ids.json, scanned from Reg M-B\'s raw logs only; the ' + id
          + ' custom-rule question is open (docs/REGMC.md, "the M-C pool carries custom-rule rooms")',
      },
      behavioural_bots: [...bots].sort(),
      behavioural_bots_note: 'data/quality-filter.json\'s team-invariance rule, validated on Reg M-B\'s bo1 ladder. Judged here '
        + 'over every row of both ' + id + ' stores. Not re-validated for a bo3 open-sheet ladder, where playing one team '
        + 'for many games is more plausible for a human.',
      usable: competitive.length,
      rowsInFormat: inFormat.length,
      caveat: 'Bot detection is name-based plus a team-invariance rule. Describe this set as "no bot detected", not as human.',
    },
    source_digests: Object.fromEntries(STORES.map(s => [s.rel, s.sha256])),
    sampledTeams: out.sides,
    threats: view(out).threats,
    views: {
      competitive: Object.assign(view(out), {
        population: 'open-sheet ' + id + ' games (both stores), the pool predicate, then the shared quality filter',
        use: 'tournament preparation; claims about the game; anything an agent should imitate',
        games: competitive.length }),
      ladder: Object.assign(view(ladderOut), {
        population: 'every stored ' + id + ' game in both stores, closed sheets included; name-flagged bot sides not counted',
        use: 'what you will actually face while laddering',
        games: inFormat.length }),
    },
    sets,
    sets_note: 'Declared on the open sheets of the competitive view (bot-named sides excluded, as in usage), per species in '
      + 'its table. rate = sheets carrying it / sheets of that species. Species ids are the store\'s; names are the format\'s.',
    legality,
    choosing: 'State which view you used. They answer different questions and neither is "the" metagame.',
  };
  fs.writeFileSync(target, JSON.stringify(model, null, 1));

  const pct = x => (100 * x).toFixed(1);
  console.log('REG ' + id.toUpperCase() + ' USAGE MODEL -> ' + rel(target));
  for (const s of STORES) console.log('  ' + s.rel + '  sha256 ' + s.sha256.slice(0, 12) + '  ' + s.rows.length + ' games');
  console.log('  competitive ' + competitive.length + ' games / ' + out.sides + ' teams;  ladder ' + inFormat.length + ' games / ' + ladderOut.sides + ' teams');
  console.log('  species        team%  bring% lead%  win%');
  for (const t of out.table.slice(0, 12))
    console.log('  ' + t.sp.padEnd(14) + pct(t.team).padStart(5) + (pct(t.bring) + '%').padStart(8) + (pct(t.lead) + '%').padStart(7)
      + (t.win != null ? (pct(t.win) + '%').padStart(7) : '     -'));
  console.log('  LEGALITY  ' + Object.entries(legality.by_class).map(([c, v]) => c + ' ' + v.distinct + ' (strict ' + v.strict_legal
    + ', validator ' + v.readmitted_by_validator + ', ILLEGAL ' + v.illegal + ', unresolved ' + v.unresolved + ')').join(';  '));
  for (const r of legality.readmitted) console.log('    re-admitted by the validator: ' + r.class + ' ' + r.id + ' (isNonstandard ' + r.isNonstandard + ')');
  console.log('  ILLEGAL entities: ' + legality.illegal_count + ' in the corpus, ' + legality.illegal_in_published_tables + ' in a published table');
  for (const r of legality.illegal) console.log('    ILLEGAL: ' + r.class + ' ' + r.id + ' x' + r.occurrences + (r.in_published_table ? ' [PUBLISHED]' : ' [corpus only]')
    + ' -- ' + (r.problems || []).join(' | '));
  for (const r of legality.unresolved) console.log('    unresolved: ' + r.class + ' ' + r.id + ' x' + r.occurrences + ' -- ' + r.verdict);
  console.log('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  return 0;
}

module.exports = { main, PREDICATES };
