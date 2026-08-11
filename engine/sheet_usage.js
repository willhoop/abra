/* HOW OFTEN IS EACH ABILITY AND ITEM ACTUALLY BROUGHT — counted from declared team sheets.
 *
 * WHY THIS FILE EXISTS. `engine/click_counts.js` says, in its own header, that abilities and items
 * are "NOT counted here and deliberately so… the store does not know which ability a body had unless
 * the game carried an open sheet — 891 of 52,377. There is no honest store-derived usage count for an
 * ability, so this file does not invent one, and the roster does not defer ability rows on usage."
 *
 * THAT WAS TRUE WHEN IT WAS WRITTEN AND IT IS NOT TRUE NOW. It was measured against
 * `data/games.ladder.jsonl` alone. `data/games.bo3.jsonl` is a SECOND human store — a separate
 * Showdown format running in parallel over the same window — and because bo3 FORCES open team sheets,
 * 99.9% of its games declare both teams. Measured 2026-08-10: **146,652 sheet slots, every one of
 * which names an ability.** An honest store-derived ability usage exists; nothing was reading it.
 *
 * WHAT THIS UNLOCKS, AND WHY IT IS NOT COSMETIC. Will's rule for the shelf is
 * "SHELVE 2 UNLESS IT HAS REAL USAGE", and until now that rule could only be applied to MOVES. Ripen
 * was shelved on 0 of 146,652 and Stance Change kept on 231 — neither decision was available before.
 * The MEDICHAM gate's usage deferral reads artifacts, not prose.
 *
 * TWO DENOMINATORS, AND THE WRONG ONE MISLEADS. A count over SLOTS divides by six and is not the
 * number anyone reasons in. Will, on seeing Aegislash at "0.16%": *"I FEEL LIKE AEGISLASH GETS MORE
 * USAGE THAN THAT AM I CRAZY."* He was right — per TEAM it is 1.24%, rank 79 of 321. Both are
 * reported here, per_team first, because that is the one a human means by "usage".
 *
 * THE TRAP THIS ARTIFACT MUST NOT LAUNDER. **A sheet declares the PRE-MEGA ability.** Parental Bond
 * reads 0 and Mega Kangaskhan is on 2.26% of ladder teams. A mega's ability is never declared and
 * cannot be counted here; `mega_census.js` counts formes through the forme-change event and is the
 * only honest source for those. Every mega-only ability is listed in `not_countable` rather than
 * being allowed to read as unused, because a zero that means "invisible to this instrument" and a
 * zero that means "nobody brings it" are different facts and this file must not merge them.
 *
 *   node engine/sheet_usage.js              # rebuild data/sheet-usage.json
 *   node engine/sheet_usage.js --top 25     # and print the busiest abilities and items
 *
 * Read-only over the stores. Writes exactly one artifact. */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
/* BOTH HUMAN STORES. The bo1 ladder contributes few sheets and is included anyway: excluding it would
 * make this artifact describe the bo3 population rather than the player population, and the two
 * formats do not draw the same teams. `per_store` records what each contributed so a reader can tell.
 * Our own h2h and self-play stores are excluded — "how often is this brought" means by players. */
const STORES = ['games.ladder.jsonl', 'games.bo3.jsonl']
  .map(f => path.join(ROOT, 'data', f))
  .filter(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'data', 'sheet-usage.json');
const TOP = (() => { const i = process.argv.indexOf('--top'); return i >= 0 ? +process.argv[i + 1] || 20 : 0; })();

const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readOne(file, acc) {
  return new Promise((resolve, reject) => {
    let games = 0, sheetGames = 0, slots = 0, withAbility = 0, withItem = 0, badLines = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let g;
      try { g = JSON.parse(line); } catch (e) { badLines++; return; }
      games++;
      const sh = g.sheets;
      if (!sh) return;
      /* A `sheets` KEY IS NOT A SHEET. Caught on this file's first run: counting every game whose
       * `sheets` field is merely TRUTHY reported 64,846 sheet games against 26,232 teams — six slots
       * per team, so the team and slot counts were right and the game count was three orders of
       * nonsense. The bo1 store carries an empty `sheets` object on games that declared nothing.
       * A game counts only once a side actually yields bodies. */
      let gotAny = false;
      for (const side of Object.values(sh)) {
        if (!Array.isArray(side) || !side.length) continue;
        gotAny = true;
        /* PER TEAM, NOT PER SLOT, AND DE-DUPLICATED WITHIN THE TEAM. A team carrying two bodies with
         * Intimidate is ONE team running Intimidate for the "what will I face" question, and two
         * slots for the "how much of the field is this" question. Both are kept; `teams` is the one
         * the shelf reads. */
        const seenAb = new Set(), seenIt = new Set(), seenSp = new Set();
        for (const m of side) {
          if (!m) continue;
          slots++;
          const a = id(m.ability || m.ab);
          const it = id(m.item);
          const sp = id(m.species || m.name);
          if (a) { withAbility++; acc.abilitySlots[a] = (acc.abilitySlots[a] || 0) + 1; seenAb.add(a); }
          if (it) { withItem++; acc.itemSlots[it] = (acc.itemSlots[it] || 0) + 1; seenIt.add(it); }
          if (sp) seenSp.add(sp);
        }
        acc.teams++;
        for (const a of seenAb) acc.abilityTeams[a] = (acc.abilityTeams[a] || 0) + 1;
        for (const t of seenIt) acc.itemTeams[t] = (acc.itemTeams[t] || 0) + 1;
        for (const s of seenSp) acc.speciesTeams[s] = (acc.speciesTeams[s] || 0) + 1;
      }
      if (gotAny) sheetGames++;
    });
    rl.on('close', () => resolve({ games, sheetGames, slots, withAbility, withItem, badLines }));
    rl.on('error', reject);
  });
}

/* WHICH ABILITIES CANNOT BE COUNTED HERE AT ALL — derived from the format, never listed by hand.
 * An ability that exists ONLY on a mega forme is invisible to a team sheet, because the sheet names
 * the base forme and its base ability. Reporting those as zero would be the same error as reading
 * `parentalbond: 0` and concluding nobody brings Mega Kangaskhan. */
function megaOnlyAbilities(dex) {
  const onBase = new Set(), onMega = new Set();
  for (const s of dex.species.all()) {
    if (s.isNonstandard) continue;
    const abils = Object.values(s.abilities || {}).map(id).filter(Boolean);
    const bucket = /-Mega/.test(s.name) ? onMega : onBase;
    for (const a of abils) bucket.add(a);
  }
  return [...onMega].filter(a => !onBase.has(a)).sort();
}

async function build() {
  const acc = { abilitySlots: {}, itemSlots: {}, abilityTeams: {}, itemTeams: {}, speciesTeams: {}, teams: 0 };
  const per = [];
  let games = 0, sheetGames = 0, slots = 0, withAbility = 0, withItem = 0, badLines = 0;
  for (const f of STORES) {
    const r = await readOne(f, acc);
    per.push({ store: path.basename(f), games: r.games, sheet_games: r.sheetGames, slots: r.slots });
    games += r.games; sheetGames += r.sheetGames; slots += r.slots;
    withAbility += r.withAbility; withItem += r.withItem; badLines += r.badLines;
  }
  return { acc, games, sheetGames, slots, withAbility, withItem, badLines, per };
}

function rank(counts, teams) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, { teams: v, per_team: +(100 * v / (teams || 1)).toFixed(3) }]));
}

async function main() {
  if (!STORES.length) { console.error('  no human store found in data/'); process.exit(1); }
  const r = await build();
  let notCountable = [];
  try {
    const CS = require('./champions_sim.js');
    const { Dex } = CS.sim();
    notCountable = megaOnlyAbilities(Dex.forFormat(CS.FORMAT));
  } catch (e) {
    /* A DEX THAT WILL NOT LOAD MUST NOT SILENTLY PRODUCE AN EMPTY LIST — an empty `not_countable`
     * reads as "every zero is real", which is the exact conflation this file exists to prevent. */
    notCountable = null;
  }
  const art = {
    generated: new Date().toISOString(),
    by: 'engine/sheet_usage.js',
    what: 'How often each ability and item is BROUGHT, counted from declared open team sheets across '
        + 'both human stores. The first honest store-derived ability usage this project has had.',
    supersedes: 'engine/click_counts.js\'s header claim that no honest ability usage exists. That was '
              + 'measured against games.ladder.jsonl alone, before games.bo3.jsonl (99.9% open sheets) '
              + 'was being read.',
    denominator: 'per_team is the share of TEAMS carrying it at least once, and is the number a human '
               + 'means by "usage". A per-SLOT share divides by six and reads six times smaller — '
               + 'reporting Aegislash as 0.16% of slots rather than 1.24% of teams was a real error.',
    not_countable_note: 'A team sheet declares the PRE-MEGA ability. Abilities that exist only on a '
                      + 'mega forme can never appear here, and a zero for one of them means INVISIBLE '
                      + 'TO THIS INSTRUMENT, not unused. Count those through engine/mega_census.js.',
    not_countable: notCountable,
    not_countable_failed: notCountable === null
      ? 'the format dex would not load, so the mega-only list is UNKNOWN — treat every zero here as '
        + 'unverified rather than as evidence of non-use' : null,
    stores: STORES.map(p => path.relative(ROOT, p).replace(/\\/g, '/')),
    per_store: r.per,
    games_scanned: r.games,
    sheet_games: r.sheetGames,
    sheet_slots: r.slots,
    slots_declaring_ability: r.withAbility,
    slots_declaring_item: r.withItem,
    teams: r.acc.teams,
    unparsable_lines: r.badLines,
    abilities: rank(r.acc.abilityTeams, r.acc.teams),
    items: rank(r.acc.itemTeams, r.acc.teams),
    species: rank(r.acc.speciesTeams, r.acc.teams),
  };
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
  console.log('  ' + r.games.toLocaleString() + ' games scanned, ' + r.sheetGames.toLocaleString()
            + ' with sheets, ' + r.slots.toLocaleString() + ' slots, ' + r.acc.teams.toLocaleString() + ' teams');
  console.log('  ' + r.withAbility.toLocaleString() + ' slots declare an ability, '
            + r.withItem.toLocaleString() + ' declare an item');
  if (notCountable) console.log('  ' + notCountable.length + ' mega-only abilities are NOT COUNTABLE from a sheet');
  if (TOP) {
    for (const kind of ['abilities', 'items']) {
      console.log('\n    ' + kind.toUpperCase() + ' — share of teams');
      for (const [k, v] of Object.entries(art[kind]).slice(0, TOP))
        console.log('      ' + String(v.per_team).padStart(6) + '%  ' + String(v.teams).padStart(6) + '  ' + k);
    }
  }
  console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
}

function load() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; } }
/* Returns null when the artifact is absent OR when the entity is mega-only, and the caller must treat
 * null as "cannot defer", never as zero. */
function teamsFor(kind, key) {
  const a = load();
  if (!a) return null;
  if (kind === 'abilities' && Array.isArray(a.not_countable) && a.not_countable.includes(id(key))) return null;
  const row = (a[kind] || {})[id(key)];
  return row ? row.teams : 0;
}
module.exports = { load, teamsFor, OUT_PATH: OUT };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
