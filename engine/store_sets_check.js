/* store_sets_check.js — does the parsed store's per-game `sets` say what the raw log says?
 * 2026-10-01 (MEASURE, abra/regmc 1.52.0).
 *
 * WHY. `sets` is the end-of-game summary engine/durable-ingest.js extract() writes into every store row:
 * species -> { moves, item, ability }. Usage, sheet usage, the team pools and the priors all read it. PORYGON2
 * v2's reveal tracker (solver/porygon2/v2/reveal.js), an independent parser of the same raw logs, agreed with it
 * on only 98.49% of moves, 97.55% of items and 97.31% of abilities (abra/regmc 1.37.0), and every disagreement
 * read by hand was the store's. This file turns that hand-reading into a classified count.
 *
 * NO THIRD PARSER. The reference is reveal.js, called as-is; the subject is extract() — both the row ALREADY in
 * the store and a FRESH extract() of the same log at this checkout, so one run says what consumers read today
 * AND what a re-parse would give them. The classifier below reads the log only to say WHY two parsers differ,
 * never to decide what a set is.
 *
 * WHY NOT MAKE THE INGEST CALL reveal.js. reveal.js reads the Reg M-C dex from a Showdown checkout
 * (solver/human/dex.js); the ingest runs in CI with no checkout. So the two stay two implementations, and this
 * check is what keeps them from diverging silently.
 *
 *   node engine/store_sets_check.js --data C:/Users/willj/Projects/Pokemon/ABRA --fmt bo1 --every 10
 *   options: --fmt bo1|bo3 (default bo1)   --every N (sample ids with numeric suffix % N == 0; default 10)
 *            --examples K (per cause; default 4)   --out <json> (write the result; default: print only)
 *
 * Reads, explicitly by path and read-only: <data>/data/games.<format>.jsonl.gz (the parsed store) and
 * <data>/data/raw/games.<format>/*.jsonl.gz plus <data>/data/games.<format>.raw-logs.jsonl (the raw logs).
 * Never the plain parsed .jsonl: it is gitignored and can be stale beside its .gz.
 *
 * THE UNIT is one brought member of a species that is NOT on both sides (a mirror species shares one store key,
 * which is counted as its own cause rather than compared). Moves are compared as a set over every store key
 * whose base forme is this member's (a mega's moves sit under the mega key). Item: the store's item vs the
 * reveal's ORIGINAL item. Ability: the store's base-key ability vs the reveal's BASE ability. A store null
 * against a known reveal is a MISS, counted apart from a WRONG value.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const DATA = path.resolve(flag('--data', path.join(__dirname, '..')));
const FMT = flag('--fmt', 'bo1');
const EVERY = +flag('--every', 10);
const NEX = +flag('--examples', 4);
const OUTF = flag('--out', null);
const ING = require('./durable-ingest.js');
const R = require('../solver/porygon2/v2/reveal.js');

const REG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'regulations.json'), 'utf8')).runtime.regmc;
const FORMAT_ID = FMT === 'bo3' ? REG.bo3Format : REG.bo3Format.replace(/bo3$/, '');
const STORE = path.join(DATA, 'data', 'games.' + FORMAT_ID + '.jsonl.gz');
const RAWDIR = path.join(DATA, 'data', 'raw', 'games.' + FORMAT_ID);
const RAWPLAIN = path.join(DATA, 'data', 'games.' + FORMAT_ID + '.raw-logs.jsonl');

const id_ = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sampled = id => { const n = +(/(\d+)$/.exec(id) || [])[1]; return Number.isFinite(n) && n % EVERY === 0; };
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

async function* linesOf(f) {
  const src = fs.createReadStream(f);
  const rl = readline.createInterface({ input: /\.gz$/.test(f) ? src.pipe(zlib.createGunzip()) : src, crlfDelay: Infinity });
  for await (const l of rl) yield l;
}

/* ------------------------------------------------------------------ the log, read only to name a cause */
function logIndex(log) {
  const L = log.split('\n').filter(l => l.startsWith('|'));
  const nicks = { p1: {}, p2: {} };               // side -> nick -> base key
  const swapAt = { p1: [], p2: [] };              // line indices of `|swap|` per side
  const transformed = { p1: new Set(), p2: new Set() };
  L.forEach((l, i) => {
    const p = l.split('|');
    if (/^(switch|drag|replace)$/.test(p[1])) {
      const m = /^(p[12])[ab]: (.*)$/.exec(p[2] || ''); if (!m) return;
      const key = ING.baseForme(id_((p[3] || '').split(',')[0]));
      if (!(m[2] in nicks[m[1]])) nicks[m[1]][m[2]] = key;
    } else if (p[1] === 'swap') { const s = (p[2] || '').slice(0, 2); if (swapAt[s]) swapAt[s].push(i); }
    else if (p[1] === '-transform') { const m = /^(p[12])[ab]: (.*)$/.exec(p[2] || ''); if (m) transformed[m[1]].add(m[2]); }
  });
  return { L, nicks, swapAt, transformed };
}
const identOf = s => { const m = /^(p[12])[ab]?: (.*)$/.exec(String(s || '').trim()); return m ? { side: m[1], nick: m[2] } : null; };
const tag = (p, t) => { const f = p.find(x => x.startsWith(t)); return f ? f.slice(t.length).trim() : null; };
const isMember = (ix, side, key, ident) => ident && ident.side === side && (ix.nicks[side][ident.nick] === key || (!(ident.nick in ix.nicks[side]) && ING.baseForme(id_(ident.nick)) === key));
const swappedBefore = (ix, side, i) => ix.swapAt[side].some(j => j < i);
const OWN_FROM = /^(lockedmove|move: Round|move: Sleep Talk)$/;

function whyMoveMissing(ix, side, key, mv, groupKeys, sets) {     // the reveal has mv, the store does not
  for (const l of ix.L) {
    const p = l.split('|');
    if (p[1] === 'cant' && id_(p[4]) === mv) {
      const of = tag(p, '[of]'); const mover = identOf(of || p[2]);
      if (isMember(ix, side, key, mover)) return 'cant_names_move';
    }
    if (p[1] === '-activate' && /ability: Forewarn/.test(p[3] || '') && id_(p[4]) === mv) return 'forewarn_reveal';
  }
  for (const k in sets) if (!groupKeys.includes(k) && (sets[k].moves || []).some(x => id_(x) === mv)) return 'forme_key_split';
  return 'unclassified';
}
function whyMoveExtra(ix, side, key, mv) {                         // the store has mv, the reveal does not
  if (mv === 'struggle') return 'struggle';
  const froms = [];
  for (let i = 0; i < ix.L.length; i++) {
    const p = ix.L[i].split('|');
    if (p[1] !== 'move' || id_(p[3]) !== mv) continue;
    const who = identOf(p[2]);
    if (!isMember(ix, side, key, who)) { if (who && who.side === side) froms.push('wrong_member'); continue; }
    if (ix.transformed[side].has(who.nick)) { froms.push('transform_copied'); continue; }
    const f = tag(p, '[from]');
    froms.push(f && !OWN_FROM.test(f) ? 'called_by:' + f.replace(/^move: |^ability: /, m => m) : 'own_line');
  }
  if (!froms.length) return 'unclassified';
  if (froms.includes('own_line')) return 'own_line(reveal_disagrees)';
  return froms[0];
}
function whyItem(ix, side, key, item, stItem) {                     // the store says stItem, the reveal says `item`
  const it = id_(stItem);
  for (let i = 0; i < ix.L.length; i++) {
    const p = ix.L[i].split('|');
    if (!/^(-item|-enditem|-mega)$/.test(p[1])) continue;
    const val = p[1] === '-mega' ? p[4] : p[3];
    if (id_(val) !== it) continue;
    const who = identOf(p[2]); if (!who || who.side !== side) continue;
    if (isMember(ix, side, key, who)) {
      const f = tag(p, '[from]') || '';
      if (p[1] === '-item' && /^(move: (Trick|Switcheroo|Thief|Covet|Bestow)|ability: (Pickpocket|Magician))$/.test(f)) return 'item_received:' + f;
      if (item === R.UNK) continue;
      return 'own_line(reveal_disagrees):' + p[1] + (f ? ' ' + f : '');
    }
    return swappedBefore(ix, side, i) ? 'wrong_member:after_ally_switch' : 'wrong_member:' + p[1];
  }
  return 'unclassified';
}
function whyAbility(ix, side, key, ab, stAb) {
  const a = id_(stAb);
  let sawSkillSwap = false;
  for (let i = 0; i < ix.L.length; i++) {
    const p = ix.L[i].split('|');
    if (p[1] === '-activate' && /Skill Swap/.test(p[3] || '')) sawSkillSwap = true;
    let who = null, f = null;
    if (p[1] === '-ability' && id_(p[3]) === a) { who = identOf(p[2]); f = tag(p, '[from]'); }
    else if (/^(-weather|-fieldstart)$/.test(p[1]) && id_((tag(p, '[from]') || '').replace(/^ability: /, '')) === a) who = identOf(tag(p, '[of]'));
    else continue;
    if (!who || who.side !== side) continue;
    if (!isMember(ix, side, key, who)) return swappedBefore(ix, side, i) ? 'wrong_member:after_ally_switch' : sawSkillSwap ? 'wrong_member:after_skill_swap' : 'wrong_member:' + p[1];
    if (ix.transformed[side].has(who.nick)) return 'transform_copied';
    if (f) return 'ability_changed_by:' + f;
    if (sawSkillSwap) return 'after_skill_swap';
    if (ab === R.UNK) return 'reveal_unknown(reveal_refused_or_mega)';
    return 'own_line(reveal_disagrees)';
  }
  return 'unclassified';
}
function whyMiss(ix, side, key, val, kind) {                         // the reveal knows val, the store has null
  const v = id_(val);
  for (const l of ix.L) {
    const p = l.split('|');
    const who = identOf(p[2]);
    const f = tag(p, '[from]') || '';
    if (kind === 'item') {
      if (p[1] === '-activate' && id_((p[3] || '').replace(/^item: /, '')) === v && isMember(ix, side, key, who)) return 'item_from:-activate';
      if (id_(f.replace(/^item: /, '')) === v && /^item:/.test(f)) return 'item_from:' + p[1] + ' [from] item';
      if ((p[1] === '-item' || p[1] === '-enditem') && id_(p[3]) === v) return 'item_from:' + p[1] + '(not credited)';
    } else {
      if (p[1] === '-activate' && id_((p[3] || '').replace(/^ability: /, '')) === v) return 'ability_from:-activate';
      if (/^ability:/.test(f) && id_(f.replace(/^ability: /, '')) === v) return 'ability_from:' + p[1] + ' [from] ability';
      if (p[1] === 'cant' && id_((p[3] || '').replace(/^ability: /, '')) === v) return 'ability_from:cant';
      if (p[1] === '-ability' && id_(p[4]) === v) return 'ability_from:-ability (previous ability field)';
    }
  }
  return 'unclassified';
}

/* ------------------------------------------------------------------ compare one game */
function compare(allSets, rv, ix, T, mirrorSets) {
  const fin = rv.final_state;
  const bases = s => fin[s].map(m => ING.baseForme(id_(m.species)));
  const b1 = new Set(bases('p1')), b2 = new Set(bases('p2'));
  const ex = (cause, o) => { const e = T.examples[cause] = T.examples[cause] || []; if (e.length < NEX) e.push(o); };
  for (const side of ['p1', 'p2']) for (const m of fin[side]) {
    if (m.brought !== true) continue;
    const key = ING.baseForme(id_(m.species));
    let sets = allSets;
    if (b1.has(key) && b2.has(key)) {
      T.mirror_members++;
      /* A row written before abra/regmc 1.52.0 has no per-side record: its mirrored entry is one merged set
       * and cannot be compared. A row from the current extractor carries `mirrorSets`. */
      if (mirrorSets === undefined) { inc(T.causes, 'mirror_species_shares_one_key'); continue; }
      sets = Object.assign({}, allSets);
      for (const k in mirrorSets) { if (mirrorSets[k][side]) sets[k] = mirrorSets[k][side]; else delete sets[k]; }
      T.mirror_compared++;
    }
    const groupKeys = Object.keys(sets).filter(k => k === key || ING.baseForme(k) === key);
    if (!groupKeys.length) { T.member_absent++; ex('member_absent', { id: T._id, side, species: m.species }); continue; }
    T.members++;
    if (groupKeys.length > 1 && groupKeys.some(k => k !== key && (sets[k].moves || []).length)) T.moves_split_across_keys++;
    const st = new Set(groupKeys.flatMap(k => (sets[k].moves || []).map(id_)));
    const mine = new Set(m.moves.filter(x => x !== R.UNK).map(id_));
    const missing = [...mine].filter(x => !st.has(x)), extra = [...st].filter(x => !mine.has(x));
    if (!missing.length && !extra.length) T.moves_equal++;
    for (const mv of missing) { const c = 'move_missing:' + whyMoveMissing(ix, side, key, mv, groupKeys, sets); inc(T.causes, c); T.move_missing++; ex(c, { id: T._id, side, species: m.species, move: mv }); }
    for (const mv of extra) { const c = 'move_extra:' + whyMoveExtra(ix, side, key, mv); inc(T.causes, c); T.move_extra++; ex(c, { id: T._id, side, species: m.species, move: mv }); }
    const base = sets[key] || {};
    const stItem = base.item || groupKeys.map(k => sets[k].item).find(Boolean) || null;
    const rvItem = m.item.orig;
    if (stItem) {
      T.item_compared++;
      if (rvItem !== R.UNK && id_(rvItem) === id_(stItem)) T.item_equal++;
      else { const c = 'item_wrong:' + whyItem(ix, side, key, rvItem, stItem); inc(T.causes, c); T.item_wrong++; ex(c, { id: T._id, side, species: m.species, store: stItem, reveal: rvItem }); }
    } else if (rvItem !== R.UNK && rvItem) { const c = 'item_miss:' + whyMiss(ix, side, key, rvItem, 'item'); inc(T.causes, c); T.item_miss++; ex(c, { id: T._id, side, species: m.species, reveal: rvItem }); }
    const stAb = base.ability || null, rvAb = m.ability.base;
    if (stAb) {
      T.ability_compared++;
      if (rvAb !== R.UNK && id_(rvAb) === id_(stAb)) T.ability_equal++;
      else { const c = 'ability_wrong:' + whyAbility(ix, side, key, rvAb, stAb); inc(T.causes, c); T.ability_wrong++; ex(c, { id: T._id, side, species: m.species, store: stAb, reveal: rvAb }); }
    } else if (rvAb !== R.UNK && m.ability_src === 'log') { const c = 'ability_miss:' + whyMiss(ix, side, key, rvAb, 'ability'); inc(T.causes, c); T.ability_miss++; ex(c, { id: T._id, side, species: m.species, reveal: rvAb }); }
  }
}
const tally = () => ({ games: 0, members: 0, mirror_members: 0, mirror_compared: 0, member_absent: 0, moves_equal: 0, move_missing: 0, move_extra: 0, moves_split_across_keys: 0,
  item_compared: 0, item_equal: 0, item_wrong: 0, item_miss: 0, ability_compared: 0, ability_equal: 0, ability_wrong: 0, ability_miss: 0, causes: {}, examples: {} });

(async () => {
  for (const f of [STORE]) if (!fs.existsSync(f)) { console.error('store_sets_check: REFUSING -- no ' + f); process.exit(2); }
  // 1. the stored rows' sets, for the sampled ids only
  const stored = new Map(); let storeRows = 0;
  const unreadable = { store_rows: 0, raw_rows: 0 };   // counted and printed: an unparsable row must not vanish
  for await (const l of linesOf(STORE)) {
    if (!l) continue; storeRows++;
    const m = /^\{"id":"([^"]+)"/.exec(l); if (!m || !sampled(m[1])) continue;
    try { const g = JSON.parse(l); if (!stored.has(g.id)) stored.set(g.id, g.sets || {}); } catch (e) { unreadable.store_rows++; }
  }
  // 2. the raw logs, first occurrence of an id wins (the store's rule)
  const raws = [];
  if (fs.existsSync(RAWDIR)) for (const f of fs.readdirSync(RAWDIR).filter(f => f.endsWith('.jsonl.gz')).sort()) raws.push(path.join(RAWDIR, f));
  if (fs.existsSync(RAWPLAIN)) raws.push(RAWPLAIN);
  const seen = new Set();
  const out = { by: 'engine/store_sets_check.js', generated: new Date().toISOString(), format: FORMAT_ID, fmt: FMT, every: EVERY,
    inputs: { store: STORE.replace(/\\/g, '/'), store_bytes: fs.statSync(STORE).size, store_rows: storeRows, raw_files: raws.length, raw_dir: RAWDIR.replace(/\\/g, '/') },
    sampled_store_rows: stored.size, unreadable, no_raw_log: 0, reveal_threw: {}, stored_differs_from_fresh: 0, stored_differs_examples: [],
    store: tally(), fresh: tally() };
  for (const f of raws) for await (const l of linesOf(f)) {
    if (!l) continue;
    const m = /"id":"([^"]+)"/.exec(l); if (!m || !sampled(m[1]) || seen.has(m[1]) || !stored.has(m[1])) continue;
    let r; try { r = JSON.parse(l); } catch (e) { unreadable.raw_rows++; continue; }
    seen.add(r.id);
    const log = String(r.log || '');
    let rv;
    try { rv = R.extract(log, { mode: FMT }); } catch (e) { inc(out.reveal_threw, e.code || 'exception'); continue; }
    if (rv.game.sheets_public && FMT === 'bo1') { inc(out.reveal_threw, 'bo1_sheets_public(skipped: agrees trivially)'); continue; }
    const freshRow = ING.extract(r.id, r.uploadtime, log), fresh = freshRow.sets;
    const st = stored.get(r.id);
    if (JSON.stringify(st) !== JSON.stringify(fresh)) { out.stored_differs_from_fresh++; if (out.stored_differs_examples.length < NEX) out.stored_differs_examples.push(r.id); }
    const ix = logIndex(log);
    for (const [T, sets, ms] of [[out.store, st, undefined], [out.fresh, fresh, freshRow.mirrorSets || {}]]) { T._id = r.id; T.games++; compare(sets, rv, ix, T, ms); delete T._id; }
  }
  out.no_raw_log = stored.size - seen.size - 0;
  for (const T of [out.store, out.fresh]) {
    T.rates = { moves_equal: +(T.moves_equal / T.members).toFixed(4), item_equal: +(T.item_equal / T.item_compared).toFixed(4), ability_equal: +(T.ability_equal / T.ability_compared).toFixed(4) };
    T.causes = Object.fromEntries(Object.entries(T.causes).sort((a, b) => b[1] - a[1]));
  }
  const brief = T => ({ games: T.games, members: T.members, rates: T.rates, wrong: { item: T.item_wrong, ability: T.ability_wrong, move_extra: T.move_extra }, miss: { item: T.item_miss, ability: T.ability_miss, move: T.move_missing }, mirror_members: T.mirror_members, mirror_compared: T.mirror_compared, causes: T.causes });
  console.log(JSON.stringify({ format: FORMAT_ID, sampled_store_rows: out.sampled_store_rows, unreadable: out.unreadable, reveal_threw: out.reveal_threw, stored_differs_from_fresh: out.stored_differs_from_fresh, store: brief(out.store), fresh: brief(out.fresh) }, null, 1));
  if (OUTF) fs.writeFileSync(OUTF, JSON.stringify(out, null, 1) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
