/* WHAT DOES THIS REGULATION ACTUALLY CLICK?  require()d by tests/test-medicham-coverage.js
 *
 * Will's bar (2026-08-06): medicham2 must be wired and tested on every move, ability and item in the
 * regulation before its output gets used. Sizing that needs a DENOMINATOR, and the denominator is not
 * "everything in the dex" — it is what people bring and click. This derives it from the store.
 *
 * A THRESHOLD IS A LIST AND GOES STALE. A COVERAGE TARGET IS A MECHANISM AND RE-DERIVES ITSELF.
 * That distinction is the whole reason the gate above it is written against 99% OF USAGE rather than
 * against a hand-kept set of names: when Farigiraf falls out of the meta and something else arrives, a
 * list has to be edited by somebody who remembers, and a target simply moves. So nothing here is
 * hard-coded — every id and every count comes out of data/games.ladder.jsonl on the run.
 *
 * THREE SOURCES, BECAUSE ANY ONE OF THEM UNDERCOUNTS:
 *   - `sheets`   the DECLARED six, present only on open-sheet games. The only place a full moveset
 *                and an item appear together, so it is where items and abilities mostly come from.
 *   - `sets`     what the extractor INFERRED on a closed-sheet game — thinner, but 5x more games.
 *   - the turn stream — moves actually CLICKED (`m.mv`), plus the abilities the protocol names
 *                (`w.by` on a weather set, `m.blockedBy`, `fs.by`). A move nobody declared and
 *                everybody clicked would be invisible without this.
 *
 * ---- TWO CORPORA, AND THE CLEAN ONE IS NOT AN OPTIONAL EXTRA ------------------------------------
 *
 * The ladder store is ~82% bots, forfeits and stubs, and CLAUDE.md's clean-data discipline exists
 * because that distorts every RATE computed over it. A usage SHARE is a rate. So this file counts
 * BOTH, and the gate takes the UNION of the two 99% sets rather than either.
 *
 * THAT DECISION WAS MEASURED, NOT ARGUED, AND THE FIRST ARGUMENT FOR IT WAS WRONG. The comfortable
 * story was "raw is the conservative direction because bot spam adds junk entities". Measured at
 * 46,211 raw games against `engine/quality.js`'s 8,193 clean ones:
 *
 *              distinct with any usage        the 99%-of-usage prefix
 *     raw       moves 486  ab 175  it 146      moves 277  ab  78  it 100   (455)
 *     clean     moves 462  ab 167  it 142      moves 283  ab  98  it 107   (488)
 *
 * The raw corpus SEES MORE distinct things and demands a SMALLER prefix — repeated bot clicks
 * concentrate the distribution, so 99% of raw usage is reached sooner. Neither corpus dominates, and
 * picking one would have quietly relaxed the bar in one of the two directions. The union is strictly
 * more demanding than both and cannot be gamed by the mix of games in the store.
 *
 * COUNTS ARE STILL SHEET COUNTS AND THAT IS A KNOWN TRAP (docs/ENGINE.md: Blaze reads 4,585 uses and
 * never fires, because 30 of 54 entries mega into Drought on turn one). This file is deliberately NOT
 * the place that judgement is applied: it reports what the corpus says, and the gate above it carries
 * a CARVE-OUT for the opposite failure — a mechanic with tiny usage that turns a certainty into a
 * failure. Ranking is a prior; no number here is truth on its own.
 *
 * CACHED, AND THE CACHE IS KEYED ON THE CORPUS ITSELF (size + mtime), not on a timestamp. The scan is
 * ~8s over 200MB; a gate that runs inside tests/run-all.js should not spend that every time, and a
 * cache that could serve a stale answer would be exactly the silent default this project keeps being
 * bitten by. Change the store and the key changes and it re-derives.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
/* The clean filter itself, so this file is not declaring RAW-STORE-OK about a rate. loadGames()
 * applies the config, the reason set and the behavioural bot detector. */
const Q = require(D('engine', 'quality.js'));

const CORPUS = D('data', 'games.ladder.jsonl');
const CACHE = D('data', 'regulation-usage.json');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function key() {
  const st = fs.statSync(CORPUS);
  return { bytes: st.size, mtime: st.mtimeMs };
}

/* ONE COUNTER, POINTED AT WHICHEVER PAIR OF MAPS THE CALLER WANTS. Written once so the raw pass and
 * the clean pass cannot drift apart — two copies of "what counts as a use" is exactly the
 * FACTS-ARE-GLOBAL failure CLAUDE.md names, and it would show up as an unexplained gap between the
 * two corpora rather than as an error. */
function tally(g, acc) {
  const bump = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  acc.games++;
  for (const side of ['p1', 'p2']) {
    for (const s of ((g.sheets && g.sheets[side]) || [])) {
      acc.sheetEntries++;
      for (const m of (s.moves || [])) bump(acc.mv, norm(m));
      bump(acc.it, norm(s.item)); bump(acc.ab, norm(s.ability));
    }
  }
  for (const s of Object.values(g.sets || {})) {
    acc.setEntries++;
    for (const m of (s.moves || [])) bump(acc.mv, norm(m));
    bump(acc.it, norm(s.item)); bump(acc.ab, norm(s.ability));
  }
  for (const t of (g.turns || [])) for (const e of (t.ev || [])) {
    if (e.t === 'm' && e.mv) { bump(acc.mv, norm(e.mv)); acc.clicks++; }
    if (e.blockedBy) bump(acc.ab, norm(e.blockedBy));
    if (e.by) bump(acc.ab, norm(e.by));
  }
}
const emptyAcc = () => ({ games: 0, sheetEntries: 0, setEntries: 0, clicks: 0,
                          unparsed: 0, unparsedFirst: '',
                          mv: new Map(), ab: new Map(), it: new Map() });
const freeze = (a) => {
  const obj = (m) => Object.fromEntries([...m.entries()].sort((x, y) => y[1] - x[1]));
  return { games: a.games, sheetEntries: a.sheetEntries, setEntries: a.setEntries, clicks: a.clicks,
           unparsed: a.unparsed, unparsedFirst: a.unparsedFirst,
           moves: obj(a.mv), abilities: obj(a.ab), items: obj(a.it) };
};

function scan() {
  /* THE RAW PASS. Synchronous whole-file read in 16MB slices: readline is async and every caller of
   * this is a gate that wants an answer before it continues, and a slice keeps the process from
   * holding two copies of a 200MB store. */
  const raw = emptyAcc();
  const fd = fs.openSync(CORPUS, 'r');
  const SIZE = 1 << 24;
  const buf = Buffer.alloc(SIZE);
  let carry = '', pos = 0, n;
  /* A LINE THAT WILL NOT PARSE IS COUNTED, NEVER DISCARDED. The store is append-only and a truncated
   * final write is a real thing that happens; skipping it silently would shrink the denominator this
   * whole file exists to compute and nothing would say so. The count is printed by the CLI and
   * carried into the cache. */
  const line = (l) => {
    if (!l) return;
    let g;
    try { g = JSON.parse(l); }
    catch (e) {
      raw.unparsed++;
      if (!raw.unparsedFirst) raw.unparsedFirst = String(e.message).slice(0, 80);
      return;
    }
    tally(g, raw);
  };
  while ((n = fs.readSync(fd, buf, 0, SIZE, pos)) > 0) {
    pos += n;
    const chunk = carry + buf.toString('utf8', 0, n);
    const parts = chunk.split('\n');
    carry = parts.pop();
    for (const l of parts) line(l);
  }
  line(carry);
  fs.closeSync(fd);

  /* THE CLEAN PASS, through engine/quality.js's own loader — the config, the reason set and the
   * behavioural bot detector, not a re-implementation of them. */
  const clean = emptyAcc();
  for (const g of Q.loadGames({})) tally(g, clean);

  return { raw: freeze(raw), clean: freeze(clean) };
}

/* THE ONLY DERIVED SET IN THE FILE, and it is a prefix of a sorted list rather than a membership
 * test — the smallest set of ids whose usage adds up to `frac` of ALL usage of that kind. */
function coverPrefix(counts, frac) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, r) => s + r[1], 0);
  const want = total * frac;
  const out = []; let acc = 0;
  for (const [id, n] of rows) { if (acc >= want) break; out.push(id); acc += n; }
  return { ids: out, total, covered: acc, all: rows.length };
}

/* THE UNION OF THE TWO CORPORA'S PREFIXES, which is what the gate is written against. `all` is the
 * union of everything with ANY usage in either — Will's own wording — and the per-corpus prefixes are
 * kept so a reader can see which corpus is asking for what. */
function coverUnion(u, kind, frac) {
  const a = coverPrefix(u.raw[kind], frac), b = coverPrefix(u.clean[kind], frac);
  const ids = [...new Set([...a.ids, ...b.ids])];
  const anyUsage = new Set([...Object.keys(u.raw[kind]), ...Object.keys(u.clean[kind])]);
  return { ids, all: anyUsage.size, raw: a.ids.length, clean: b.ids.length };
}
/* Usage for weighting is the RAW count plus the CLEAN count, so an entity that only one corpus sees
 * still carries weight and neither corpus can zero something out. */
const usesOf = (u, kind, id) => (u.raw[kind][id] || 0) + (u.clean[kind][id] || 0);

function load(opts) {
  const k = key();
  if (!(opts && opts.fresh)) {
    try {
      const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
      if (c.corpus && c.corpus.bytes === k.bytes && c.corpus.mtime === k.mtime && c.clean) return c;
    } catch (e) {
      /* Re-deriving is the safe direction, but "there is no cache yet" and "the cache is corrupt" are
       * not the same event and a bare catch makes them one — the same correction the arms ratchet in
       * tests/test-mechanics.js needed. Only a corrupt one is worth a line. */
      if (fs.existsSync(CACHE))
        console.log('  NOTE: regulation_usage is re-deriving because its cache would not read — '
          + String(e.message).slice(0, 100));
    }
  }
  const s = scan();
  const c = Object.assign({ generated: new Date().toISOString(), by: 'tests/regulation_usage.js',
                            corpus: k, corpusFile: 'data/games.ladder.jsonl' }, s);
  try { fs.writeFileSync(CACHE, JSON.stringify(c, null, 1) + '\n'); }
  catch (e) { console.log('  NOTE: regulation_usage could not write its cache — ' + e.message); }
  return c;
}

module.exports = { load, coverPrefix, coverUnion, usesOf, scan, norm, CACHE, CORPUS };

if (require.main === module) {
  const u = load({ fresh: process.argv.includes('--fresh') });
  if (u.raw.unparsed) console.log('  NOTE: ' + u.raw.unparsed + ' store line(s) would not parse and '
    + 'are not counted — first: ' + u.raw.unparsedFirst + '\n');
  for (const [name, s] of [['RAW', u.raw], ['CLEAN (engine/quality.js)', u.clean]]) {
    console.log(name + ' — ' + s.games.toLocaleString() + ' games, '
      + s.sheetEntries.toLocaleString() + ' declared sheet entries, '
      + s.setEntries.toLocaleString() + ' inferred sets, ' + s.clicks.toLocaleString() + ' clicks');
    for (const kind of ['moves', 'abilities', 'items']) {
      const p = coverPrefix(s[kind], 0.99);
      console.log('    ' + kind.padEnd(10) + String(p.all).padStart(4) + ' with any usage;  '
        + String(p.ids.length).padStart(4) + ' carry 99% of it   (' + p.total.toLocaleString() + ' uses)');
    }
  }
  let all = 0, at99 = 0;
  console.log('\nUNION — what the coverage gate is actually written against');
  for (const kind of ['moves', 'abilities', 'items']) {
    const c = coverUnion(u, kind, 0.99);
    all += c.all; at99 += c.ids.length;
    console.log('    ' + kind.padEnd(10) + String(c.all).padStart(4) + ' with any usage in either;  '
      + String(c.ids.length).padStart(4) + ' in the union of the two 99% sets   (raw ' + c.raw
      + ', clean ' + c.clean + ')');
  }
  console.log('\n  ' + all + ' things carry real usage in this regulation; ' + at99
    + ' are in the union of the two 99% sets.');
}
