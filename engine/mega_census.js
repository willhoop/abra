/* HOW MUCH OF THIS FORMAT IS ACTUALLY A MEGA — derived from the store, because nothing else knows.
 *
 * WHY THIS EXISTS. Will, 2026-08-10: *"megas need to be the number one priority wtf"*, then
 * *"how tf did we get this far without this coming up"*. The second question has a measured answer:
 *
 *     stored games                 52,377
 *     mega EVENTS recorded         83,810   (93.3% of games)
 *     mega forme named in brought[]     0   of 387,491 bodies
 *     mega forme named in lead[]        0
 *
 * The store records THAT a mega happened and never records the mega as a body. `brought` and `lead`
 * name only the base species, so every usage figure derived from them counts Charizard-Mega-Y as
 * ZERO. Every ranking in this project — the coverage bar, what gets wired next, what the roster
 * stages, which tags are "worth" a probe — is built on those counts. A mega forme therefore cannot
 * rank above anything, however broken it is. That is not an oversight anyone made; it is a blind spot
 * with the shape of the project's signature failure: a whole layer absent, every instrument green.
 *
 * IT IS A DERIVATION, NOT A RE-PULL. The events already carry everything:
 *
 *     {"t":"mega","s":"p2a","mon":"charizardmegay","from":"charizard"}
 *
 * forme, base and slot. So this reads the store and nothing else — no network, no re-parse, and the
 * 6,191 stored games whose raw log has aged out are covered exactly like the rest. "Store raw,
 * analyze on top", applied.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not write into `brought` or `lead`. Those fields mean
 * "what was brought to preview", which is the base species and is correct as it stands; a mega is a
 * mid-battle forme change, not a team slot. Rewriting them would make the store lie about preview to
 * fix a problem in analysis. The fix belongs in a derived artifact that analysis reads instead.
 *
 *   node engine/mega_census.js           # rebuild data/mega-usage.json
 *   node engine/mega_census.js --top 25  # and print the busiest formes
 *
 * Read-only over the store. Writes one artifact. */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'games.ladder.jsonl');
const OUT = path.join(ROOT, 'data', 'mega-usage.json');
const TOP = (() => { const i = process.argv.indexOf('--top'); return i >= 0 ? +process.argv[i + 1] || 20 : 0; })();

const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function run() {
  return new Promise((resolve, reject) => {
    const forme = Object.create(null);      // charizardmegay -> games it appeared in
    const base = Object.create(null);       // charizard      -> games it mega'd in
    const perGameSides = Object.create(null);
    let games = 0, gamesWithMega = 0, events = 0, sides = 0, bodies = 0;
    let twoOnOneSide = 0, megaTurn1 = 0, megaLater = 0;

    const rl = readline.createInterface({ input: fs.createReadStream(STORE), crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let g;
      try { g = JSON.parse(line); } catch (e) { return; }
      games++;
      for (const s of ['p1', 'p2']) {
        sides++;
        bodies += ((g.brought && g.brought[s]) || []).length;
      }
      /* One game contributes AT MOST ONE count per forme. Counting raw events would weight a mega by
         how many turns the log happens to mention it, which is a property of the log and not of the
         meta — the same mistake as counting clicks when you mean teams. */
      const seenForme = new Set();
      const perSide = { p1: new Set(), p2: new Set() };
      for (const t of (g.turns || [])) {
        for (const e of (t.ev || [])) {
          if (e.t !== 'mega' || !e.mon) continue;
          events++;
          const f = id(e.mon), b = id(e.from || '');
          seenForme.add(f);
          if (b) base[b] = base[b] || { games: 0, formes: Object.create(null) };
          const side = String(e.s || '').slice(0, 2);
          if (perSide[side]) perSide[side].add(f);
          if (t.n === 1) megaTurn1++; else megaLater++;
        }
      }
      if (!seenForme.size) return;
      gamesWithMega++;
      for (const f of seenForme) forme[f] = (forme[f] || 0) + 1;
      /* THE FORMAT ALLOWS ONE MEGA PER BATTLE PER SIDE. If a side shows two distinct formes the
         record disagrees with the regulation, and that is worth a count rather than a silent pass. */
      for (const s of ['p1', 'p2']) if (perSide[s].size > 1) twoOnOneSide++;
      /* base -> which formes it became, so a two-forme base (Charizard X/Y) is legible */
      for (const t of (g.turns || [])) for (const e of (t.ev || [])) {
        if (e.t !== 'mega' || !e.from) continue;
        const b = id(e.from), f = id(e.mon);
        base[b].formes[f] = (base[b].formes[f] || 0) + 1;
      }
      for (const b of Object.keys(base)) if (seenForme.size) { /* counted once below */ }
      const basesThisGame = new Set();
      for (const t of (g.turns || [])) for (const e of (t.ev || [])) {
        if (e.t === 'mega' && e.from) basesThisGame.add(id(e.from));
      }
      for (const b of basesThisGame) base[b].games++;
    });
    rl.on('close', () => resolve({ forme, base, games, gamesWithMega, events, sides, bodies,
                                   twoOnOneSide, megaTurn1, megaLater }));
    rl.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(STORE)) { console.error('  no store at ' + STORE); process.exit(1); }
  const r = await run();
  const sorted = Object.entries(r.forme).sort((a, b) => b[1] - a[1]);
  const art = {
    generated: new Date().toISOString(),
    by: 'engine/mega_census.js',
    what: 'How often each MEGA FORME actually appears, derived from the store\'s t:"mega" events. The '
        + 'store\'s brought[] and lead[] name only the base species, so every usage figure taken from '
        + 'them counts every mega forme as zero. This is the artifact that un-blinds them.',
    method: 'one count per forme per GAME, not per event — event counts weight a mega by how talkative '
          + 'its log was, which is a property of the log and not of the meta',
    caveat: 'THIS IS NOT DOWNSTREAM OF MEDICHAM. It counts what the store recorded; no simulation runs '
          + 'and the quarantine does not touch it.',
    store_games: r.games,
    games_with_a_mega: r.gamesWithMega,
    games_with_a_mega_pct: +(100 * r.gamesWithMega / (r.games || 1)).toFixed(2),
    mega_events: r.events,
    mega_on_turn_1: r.megaTurn1,
    mega_after_turn_1: r.megaLater,
    sides_showing_two_distinct_formes: r.twoOnOneSide,
    sides_note: 'the format allows one mega per battle per side; a non-zero count here is the record '
              + 'disagreeing with the regulation and wants explaining, not rounding away',
    distinct_formes_seen: sorted.length,
    formes: Object.fromEntries(sorted),
    by_base: r.base,
  };
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
  console.log('  ' + r.games.toLocaleString() + ' games   ' + r.gamesWithMega.toLocaleString()
            + ' with a mega (' + art.games_with_a_mega_pct + '%)   '
            + sorted.length + ' distinct formes   ' + r.events.toLocaleString() + ' events');
  console.log('  mega on turn 1: ' + r.megaTurn1.toLocaleString()
            + '   later: ' + r.megaLater.toLocaleString()
            + '   sides showing two formes: ' + r.twoOnOneSide.toLocaleString());
  if (TOP) {
    console.log('');
    for (const [k, v] of sorted.slice(0, TOP))
      console.log('    ' + String(v).padStart(6) + '  ' + (100 * v / r.games).toFixed(2).padStart(5)
                + '%  ' + k);
  }
  console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
}

function load() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; } }
module.exports = { load, OUT_PATH: OUT };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
