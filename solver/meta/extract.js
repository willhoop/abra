/* solver/meta/extract.js — stage 1 of the Reg M-C meta analysis.
 * ABRA-HEAP: 6144
 *
 * Reads the two Reg M-C stores (bo1 ladder + bo3), their raw logs, and the M-C Showdown checkout;
 * applies the population rules; writes a compact per-game extract plus a manifest of every byte read.
 *
 *   cmd.exe /c tools\lownode.cmd solver/meta/extract.js
 *
 * Writes ONLY under solver/out/meta/. Reads data/ and never writes it.
 *
 * POPULATION RULES, in the order a game is charged (first matching reason is the one counted; the
 * overlap of every reason is also counted):
 *   closed_sheet        bo1 game without open sheets — out of scope (Will: open team sheets only)
 *   own_account         either player is one of ours (OWN below)
 *   bot_flag            the store's `bot` flag, or the name regex quality-filter.json declares
 *   behavioural_bot     account with >= 50 games in these stores and exactly one distinct six
 *   custom_ruleset      the raw log carries Showdown's `N custom rule(s):` infobox
 *   illegal_entity      a species/item/ability/move/nature on either sheet is not legal in M-C
 *   validator_reject    Showdown's M-C TeamValidator rejects a sheet for a reason other than the
 *                       zero-Stat-Point clause (a reconstruction artifact: the store keeps no SP)
 * A game with no raw log cannot be tested for custom rules; it is KEPT and counted as untestable. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const L = require('./lib.js');
const LEG = require('./legality.js');

const OWN = new Set(['medicham32', 'willhoop', 'mag', 'mag2', 'miltank', 'miltank2']);
const BOT_NAME = /^pcrlbot|bot\d|^[a-z]+bot$/i;   // READ: data/quality-filter.json rules.exclude_bot_games.detection
const BEHAV_MIN_GAMES = 50, BEHAV_MAX_TEAMS = 1;  // READ: data/quality-filter.json rules.exclude_behavioural_bots

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(L.OUT, { recursive: true });
  const leg = LEG.open();
  const FMT = { bo1: leg.co.bo1, bo3: leg.co.bo3 };
  const D = p => path.join(L.ROOT, 'data', p);

  /* ---- receipts BEFORE reading ------------------------------------------------------------ */
  const inputs = [];
  const storeFiles = [];
  for (const k of ['bo1', 'bo3']) {
    for (const suffix of ['.jsonl.gz', '.jsonl']) {   // .gz first: it is the tracked copy and first-wins
      const abs = D('games.' + FMT[k] + suffix);
      if (fs.existsSync(abs)) { storeFiles.push({ k, abs }); inputs.push({ role: 'store:' + k, ...L.fileReceipt(abs) }); }
    }
  }
  const rawFiles = [];
  for (const k of ['bo1', 'bo3']) {
    const dir = D(path.join('raw', 'games.' + FMT[k]));
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) rawFiles.push({ k, abs: path.join(dir, f) });
    const flat = D('games.' + FMT[k] + '.raw-logs.jsonl');
    if (fs.existsSync(flat)) rawFiles.push({ k, abs: flat });
  }
  for (const r of rawFiles) inputs.push({ role: 'raw:' + r.k, ...L.fileReceipt(r.abs) });
  console.log(`receipts: ${inputs.length} files (${storeFiles.length} store, ${rawFiles.length} raw)`);

  /* ---- stores ----------------------------------------------------------------------------- */
  const games = new Map();
  const perFile = [];
  for (const { k, abs } of storeFiles) {
    let added = 0, dup = 0;
    const r = await L.eachJsonl(abs, o => {
      if (!o || !o.id) return;
      if (games.has(o.id)) { dup++; return; }
      games.set(o.id, compact(o, k));
      added++;
    });
    perFile.push({ path: L.rel(abs), rows: r.rows, bad_lines: r.bad, added, already_had: dup });
    console.log(`  ${L.rel(abs)}: ${r.rows} rows, +${added}, ${dup} already had`);
  }
  // Re-stat: did anything grow while we read it?
  const moved = inputs.filter(i => i.role.startsWith('store:')).filter(i => fs.statSync(path.join(L.ROOT, i.path)).size !== i.bytes).map(i => i.path);

  /* ---- raw logs --------------------------------------------------------------------------- */
  const raw = new Map();
  const ruleStrings = new Map();
  let rawRows = 0;
  for (const { abs } of rawFiles) {
    await L.eachJsonl(abs, o => {
      if (!o || !o.id || typeof o.log !== 'string') return;
      rawRows++;
      if (raw.has(o.id)) return;
      const f = L.rawFacts(o.log);
      raw.set(o.id, f);
      if (f.custom) ruleStrings.set(f.custom, (ruleStrings.get(f.custom) || 0) + 1);
    });
  }
  console.log(`raw: ${rawRows} rows, ${raw.size} distinct ids, ${[...raw.values()].filter(f => f.custom).length} with a custom-rule infobox`);

  /* ---- behavioural bots: over every game in both stores ----------------------------------- */
  const acct = new Map();
  for (const g of games.values()) for (let s = 0; s < 2; s++) {
    const n = L.toID(g.p[s].n);
    const a = acct.get(n) || { games: 0, teams: new Set() };
    a.games++; a.teams.add(g.six[s].slice().sort().join(','));
    acct.set(n, a);
  }
  const behavBots = new Set([...acct.entries()].filter(([, a]) => a.games >= BEHAV_MIN_GAMES && a.teams.size <= BEHAV_MAX_TEAMS).map(([n]) => n));

  /* ---- legality: every entity, then every distinct sheet ---------------------------------- */
  const ent = { species: new Map(), item: new Map(), ability: new Map(), move: new Map(), nature: new Map() };
  const bump = (kind, id) => { const m = ent[kind]; m.set(id, (m.get(id) || 0) + 1); };
  const sheetVerdict = new Map();
  const validatorReasons = new Map();
  let sheetsValidated = 0;
  for (const g of games.values()) {
    if (!g.sheets) continue;
    for (let s = 0; s < 2; s++) {
      const sh = g.sheets[s];
      for (const m of sh) {
        bump('species', m.s); if (m.i) bump('item', m.i); if (m.a) bump('ability', m.a); if (m.nt) bump('nature', m.nt);
        for (const mv of m.m) bump('move', mv);
      }
      const key = g.fmt + '|' + JSON.stringify(sh);
      if (!sheetVerdict.has(key)) {
        sheetsValidated++;
        const probs = leg.validate(sh.map(m => ({ species: m.s, item: m.i, ability: m.a, moves: m.m, nature: m.nt, gender: m.g })), g.fmt);
        const real = probs.filter(p => !leg.isReconstructionArtifact(p) && !/^\(If this was intentional/.test(p));
        for (const p of real) validatorReasons.set(p.slice(0, 160), (validatorReasons.get(p.slice(0, 160)) || 0) + 1);
        sheetVerdict.set(key, { artifact: probs.length - real.length, real: real.length });
      }
    }
  }
  const legality = {};
  const illegalIds = {};
  for (const kind of Object.keys(ent)) {
    legality[kind] = { observed: ent[kind].size, illegal: [] };
    illegalIds[kind] = new Set();
    for (const [id, n] of ent[kind]) {
      const c = leg.check(kind, id);
      if (!c.ok) { legality[kind].illegal.push({ id, name: c.name, why: c.why, slot_uses: n }); illegalIds[kind].add(id); }
    }
  }
  // mega formes seen in events are checked too
  const megaFormes = new Map();
  for (const g of games.values()) for (const mg of g.mega) if (mg) megaFormes.set(mg.to, (megaFormes.get(mg.to) || 0) + 1);
  legality.mega_forme = { observed: megaFormes.size, illegal: [...megaFormes].filter(([id]) => !leg.check('species', id).ok).map(([id, n]) => ({ id, uses: n })) };

  /* ---- charge each game ------------------------------------------------------------------- */
  const REASONS = ['closed_sheet', 'own_account', 'bot_flag', 'behavioural_bot', 'custom_ruleset', 'illegal_entity', 'validator_reject'];
  const first = Object.fromEntries(REASONS.map(r => [r, { bo1: 0, bo3: 0 }]));
  const any = Object.fromEntries(REASONS.map(r => [r, { bo1: 0, bo3: 0 }]));
  const ownSeen = {}, behavSeen = {};
  const untestable = { bo1: 0, bo3: 0 }, unrated = { bo1: 0, bo3: 0 };
  const kept = [];
  for (const g of games.values()) {
    const rf = raw.get(g.id) || null;
    const hits = [];
    if (!g.sheets) hits.push('closed_sheet');
    const names = g.p.map(p => L.toID(p.n));
    if (names.some(n => OWN.has(n))) { hits.push('own_account'); names.filter(n => OWN.has(n)).forEach(n => { ownSeen[n] = (ownSeen[n] || 0) + 1; }); }
    if (g.p.some(p => p.bot || BOT_NAME.test(p.n))) hits.push('bot_flag');
    if (names.some(n => behavBots.has(n))) { hits.push('behavioural_bot'); names.filter(n => behavBots.has(n)).forEach(n => { behavSeen[n] = (behavSeen[n] || 0) + 1; }); }
    if (rf && rf.custom) hits.push('custom_ruleset');
    if (g.sheets) {
      let ill = false;
      for (const sh of g.sheets) for (const m of sh) {
        if (illegalIds.species.has(m.s) || (m.i && illegalIds.item.has(m.i)) || (m.a && illegalIds.ability.has(m.a))
          || (m.nt && illegalIds.nature.has(m.nt)) || m.m.some(x => illegalIds.move.has(x))) ill = true;
      }
      if (ill) hits.push('illegal_entity');
      if (g.sheets.some(sh => sheetVerdict.get(g.fmt + '|' + JSON.stringify(sh)).real > 0)) hits.push('validator_reject');
    }
    for (const h of hits) any[h][g.fmt]++;
    if (hits.length) { first[hits[0]][g.fmt]++; continue; }
    if (!rf) untestable[g.fmt]++;
    else if (!rf.rated) unrated[g.fmt]++;
    g.raw = rf ? { rated: rf.rated, gameNo: rf.gameNo, series: rf.series } : null;
    kept.push(g);
  }

  kept.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  const outGames = path.join(L.OUT, 'games.clean.jsonl.gz');
  fs.writeFileSync(outGames, zlib.gzipSync(kept.map(g => JSON.stringify(g)).join('\n') + '\n'));

  const byFmt = k => [...games.values()].filter(g => g.fmt === k).length;
  const manifest = {
    by: 'solver/meta/extract.js',
    generated: new Date().toISOString(),
    checkout: leg.co,
    checkout_matches_pin: leg.co.head === leg.co.pinned,
    legal_counts_in_format: leg.legalCounts(),
    inputs,
    store_reads: perFile,
    stores_moved_during_read: moved,
    raw: { files: rawFiles.length, rows: rawRows, distinct_ids: raw.size },
    games: { distinct_ids: games.size, bo1: byFmt('bo1'), bo3: byFmt('bo3') },
    kept: { total: kept.length, bo1: kept.filter(g => g.fmt === 'bo1').length, bo3: kept.filter(g => g.fmt === 'bo3').length,
      first_date: kept.length ? kept[0].date : null, last_date: kept.length ? kept[kept.length - 1].date : null },
    exclusions: { order: REASONS, charged_first: first, any_overlap: any },
    own_accounts_listed: [...OWN], own_accounts_seen: ownSeen,
    behavioural_bots: { rule: { min_games: BEHAV_MIN_GAMES, max_distinct_teams: BEHAV_MAX_TEAMS }, accounts: behavSeen },
    custom_rule_strings: [...ruleStrings].sort((a, b) => b[1] - a[1]).map(([rules, rows]) => ({ rules, rows })),
    kept_but_untestable_for_custom_rules: untestable,
    kept_unrated: unrated,
    legality: { ...legality, sheets_validated_distinct: sheetsValidated,
      validator_real_reasons: [...validatorReasons].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([reason, sheets]) => ({ reason, sheets })),
      reconstruction_artifact_sheets: [...sheetVerdict.values()].filter(v => v.artifact && !v.real).length },
    output: { path: L.rel(outGames), bytes: fs.statSync(outGames).size, sha256: L.sha256File(outGames) },
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  fs.writeFileSync(path.join(L.OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(JSON.stringify({ games: manifest.games, kept: manifest.kept, first, untestable, unrated, moved }, null, 1));
}

/* One store row -> the fields this analysis uses. Ids are normalised with toID. */
function compact(o, fmt) {
  const sides = ['p1', 'p2'];
  const sheets = o.sheets && o.sheets.p1 && o.sheets.p2 && o.sheets.p1.length && o.sheets.p2.length
    ? sides.map(s => o.sheets[s].map(m => ({ s: L.toID(m.species), i: L.toID(m.item) || null, a: L.toID(m.ability) || null,
      m: (m.moves || []).map(L.toID).filter(Boolean), nt: L.toID(m.nature) || null, g: m.gender || null })))
    : null;
  const openSheet = fmt === 'bo3' ? true : !!o.openSheet;
  const winner = o.winner === o.p1.name ? 0 : o.winner === o.p2.name ? 1 : null;
  const mega = [null, null];
  const evs = [...(o.preTurn || []), ...(o.turns || []).flatMap(t => t.ev || [])];
  for (const e of evs) if (e.t === 'mega' && e.s) { const k = e.s[1] === '1' ? 0 : 1; if (!mega[k]) mega[k] = { from: L.toID(e.from), to: L.toID(e.mon) }; }
  const acted = (o.turns || []).some(t => (t.ev || []).some(e => e.t === 'm' || e.t === 's'));
  return {
    id: o.id, fmt, date: o.date, open: openSheet && !!sheets,
    p: sides.map(s => ({ n: o[s].name, r: o[s].rating == null ? null : +o[s].rating, bot: !!o[s].bot })),
    w: winner, ff: !!o.forfeit, acted, turns: (o.turns || []).length,
    sheets: openSheet ? sheets : null,
    six: sides.map(s => ((o.six && o.six[s]) || []).map(L.toID)),
    br: sides.map(s => ((o.brought && o.brought[s]) || []).map(L.toID)),
    ld: sides.map(s => ((o.lead && o.lead[s]) || []).map(L.toID)),
    mega,
  };
}

main().catch(e => { console.error(e); process.exit(1); });
