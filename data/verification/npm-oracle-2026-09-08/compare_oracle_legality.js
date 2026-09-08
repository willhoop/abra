/* IS THE PUBLISHED npm PACKAGE THE SAME ORACLE AS OUR PINNED CHECKOUT?
 *
 * MEASURE, 2026-09-08. Answers ONE question: does swapping the Showdown build change
 * WHAT IS LEGAL in `gen9championsvgc2026regmb`, or any `isNonstandard` value this project reads.
 *
 * A COUNT MATCH IS NOT AN ANSWER — the sets are compared element by element, and every table
 * that comes back empty aborts the run rather than agreeing with itself.
 *
 *   node data/verification/npm-oracle-2026-09-08/compare_oracle_legality.js \
 *        --a <path/to/build-A/dist/sim> --b <path/to/build-B/dist/sim> [--out <file.json>]
 *
 * Run 2026-09-08 with
 *   --a C:/Users/willj/Projects/Pokemon/pokemon-showdown/dist/sim      (commit 20ad99ff, 2026-07-22)
 *   --b C:/Users/willj/AppData/Local/Temp/psnpm/package/dist/sim       (npm pokemon-showdown@0.11.11)
 * The npm tarball was unpacked to a temp directory and is not vendored here; re-fetch it with
 *   npm pack pokemon-showdown@0.11.11 && tar -xf pokemon-showdown-0.11.11.tgz
 *
 * NOTHING HERE TOUCHES THE ENGINE. It reads two Showdown builds and this repo's frozen team pool.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FORMAT = 'gen9championsvgc2026regmb';
/* The filter CLAUDE.md mandates. `.all()` is the National Dex wearing the format's name. */
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';

function flag(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const COUNTERS = { walks: 0, empty_walks: 0, validator_threw: 0, store_lines_unparsed: 0 };

/* ---- one build, everything legality depends on ------------------------------------------------ */
function snapshot(simPath, poolFile) {
  const { Dex, TeamValidator } = require(simPath);
  const D = Dex.forFormat(FORMAT);

  const walk = (all, label) => {
    const rows = {};
    for (const x of all) if (legal(x)) rows[x.id] = { name: x.name, isNonstandard: x.isNonstandard ?? null, tier: x.tier ?? null };
    COUNTERS.walks++;
    if (!Object.keys(rows).length) { COUNTERS.empty_walks++; throw new Error('EMPTY WALK: ' + label + ' in ' + simPath); }
    return rows;
  };

  const out = {
    build: simPath,
    version: (() => {
      const pk = path.join(simPath.replace(/[\\/]dist[\\/]sim.*$/, ''), 'package.json');
      try { return JSON.parse(fs.readFileSync(pk, 'utf8')).version; } catch (e) { return 'UNKNOWN: ' + e.message; }
    })(),
    species: walk(D.species.all(), 'species'),
    moves: walk(D.moves.all(), 'moves'),
    items: walk(D.items.all(), 'items'),
    abilities: walk(D.abilities.all(), 'abilities'),
  };

  /* The three Champions formats, as the dex resolves them. */
  out.formats = {};
  for (const id of ['gen9championsvgc2026regmb', 'gen9championsvgc2026regmbbo3', 'gen9championsbssregmb']) {
    const f = Dex.formats.get(id);
    out.formats[id] = f && f.exists
      ? { name: f.name, mod: f.mod, gameType: f.gameType, ruleset: f.ruleset, banlist: f.banlist,
          unbanlist: f.unbanlist, restricted: f.restricted, rated: f.rated }
      : { MISSING: true };
  }

  /* The resolved rule table — this, not the tier label, is what decides legality. */
  const rt = Dex.formats.getRuleTable(Dex.formats.get(FORMAT));
  const rules = {};
  for (const [k, v] of rt) rules[k] = String(v);
  out.ruleTable = {
    rules,
    complexBans: (rt.complexBans || []).map(b => JSON.stringify(b)).sort(),
    complexTeamBans: (rt.complexTeamBans || []).map(b => JSON.stringify(b)).sort(),
    restrictedSpecies: [...(rt.restrictedSpecies || [])].sort(),
    minTeamSize: rt.minTeamSize ?? null, maxTeamSize: rt.maxTeamSize ?? null,
    pickedTeamSize: rt.pickedTeamSize ?? null, adjustLevel: rt.adjustLevel ?? null,
    adjustLevelDown: rt.adjustLevelDown ?? null, evLimit: rt.evLimit ?? null,
  };
  if (!Object.keys(rules).length) { COUNTERS.empty_walks++; throw new Error('EMPTY RULE TABLE in ' + simPath); }

  /* Every learnset cell for every legal species — move legality per body. */
  out.learn = {};
  let cells = 0;
  for (const s of D.species.all()) {
    if (!legal(s)) continue;
    const ls = D.species.getLearnsetData(s.id);
    const rows = {};
    for (const mid of Object.keys(ls.learnset || {})) { rows[mid] = (ls.learnset[mid] || []).slice().sort().join('|'); cells++; }
    out.learn[s.id] = rows;
  }
  out.learn_cells = cells;
  if (!cells) { COUNTERS.empty_walks++; throw new Error('EMPTY LEARNSET WALK in ' + simPath); }

  /* THE DECISIVE INSTRUMENT: the real validator on real teams. */
  const V = new TeamValidator(FORMAT);
  out.teamVerdicts = {};
  let teams = 0, valid = 0, rejected = 0;
  for (const ln of fs.readFileSync(poolFile, 'utf8').split('\n')) {
    if (!ln.trim()) continue;
    let g;
    try { g = JSON.parse(ln); } catch (e) { COUNTERS.store_lines_unparsed++; continue; }
    for (const side of ['p1', 'p2']) {
      const sheet = g.sheets && g.sheets[side];
      if (!Array.isArray(sheet) || !sheet.length) continue;
      const team = sheet.map(m => ({
        name: m.nickname || m.species, species: m.species, item: m.item || '', ability: m.ability || '',
        moves: m.moves || [], nature: m.nature || '', evs: m.evs || {}, ivs: {},
        level: m.level || 50, gender: m.gender || '',
      }));
      let r;
      try { r = V.validateTeam(team); } catch (e) { r = ['HARNESS THREW: ' + e.message]; COUNTERS.validator_threw++; }
      teams++;
      if (r) rejected++; else valid++;
      out.teamVerdicts[g.id + ':' + side] = r ? r.slice().sort().join(' ;; ') : 'VALID';
    }
  }
  out.teams = teams; out.teams_valid = valid; out.teams_rejected = rejected;
  if (!teams) { COUNTERS.empty_walks++; throw new Error('NO TEAMS READ from ' + poolFile); }
  return out;
}

/* ---- compare ---------------------------------------------------------------------------------- */
function diffTable(A, B) {
  const onlyA = Object.keys(A).filter(k => !(k in B));
  const onlyB = Object.keys(B).filter(k => !(k in A));
  const fields = [];
  for (const k of Object.keys(A)) {
    if (!(k in B)) continue;
    for (const f of new Set([...Object.keys(A[k]), ...Object.keys(B[k])])) {
      if (JSON.stringify(A[k][f]) !== JSON.stringify(B[k][f])) {
        fields.push({ id: k, field: f, a: A[k][f] ?? null, b: B[k][f] ?? null });
      }
    }
  }
  return { count_a: Object.keys(A).length, count_b: Object.keys(B).length,
           set_equal: onlyA.length === 0 && onlyB.length === 0, only_a: onlyA, only_b: onlyB, field_diffs: fields };
}

const aPath = flag('--a'), bPath = flag('--b');
if (!aPath || !bPath) { console.error('need --a <dist/sim> --b <dist/sim>'); process.exit(2); }
const pool = flag('--pool', 'data/team-pool-frozen/games.ots.jsonl');

const A = snapshot(aPath, pool);
const B = snapshot(bPath, pool);

const result = {
  generated: new Date().toISOString(),
  by: 'data/verification/npm-oracle-2026-09-08/compare_oracle_legality.js (MEASURE)',
  what: 'Does the published npm Showdown build change what is LEGAL in ' + FORMAT + '?',
  not_an_accuracy_claim: 'This compares LEGALITY and validator verdicts only. It says nothing about simulation behaviour.',
  format: FORMAT,
  build_a: { path: A.build, version: A.version },
  build_b: { path: B.build, version: B.version },
  team_pool: pool,
  counters: COUNTERS,
  tables: {
    species: diffTable(A.species, B.species),
    moves: diffTable(A.moves, B.moves),
    items: diffTable(A.items, B.items),
    abilities: diffTable(A.abilities, B.abilities),
  },
  formats_identical: JSON.stringify(A.formats) === JSON.stringify(B.formats),
  rule_table_identical: JSON.stringify(A.ruleTable) === JSON.stringify(B.ruleTable),
  learn_cells: { a: A.learn_cells, b: B.learn_cells },
  learn_diffs: (() => {
    const out = [];
    for (const s of Object.keys(A.learn)) {
      const a = A.learn[s], b = B.learn[s] || {};
      for (const m of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[m] !== b[m]) out.push(s + '.' + m);
    }
    return out;
  })(),
  teams: { a: A.teams, b: B.teams, valid_a: A.teams_valid, valid_b: B.teams_valid,
           rejected_a: A.teams_rejected, rejected_b: B.teams_rejected },
};

/* THE CLAUSE THAT DECIDES: does either build ACCEPT a team the other REJECTS? */
let classDiff = 0, textDiff = 0;
const examples = [];
for (const k of new Set([...Object.keys(A.teamVerdicts), ...Object.keys(B.teamVerdicts)])) {
  const a = A.teamVerdicts[k], b = B.teamVerdicts[k];
  if ((a === 'VALID') !== (b === 'VALID')) { classDiff++; if (examples.length < 10) examples.push({ k, a, b }); }
  else if (a !== b) { textDiff++; if (examples.length < 10) examples.push({ k, a, b }); }
}
result.team_verdicts = { compared: Object.keys(A.teamVerdicts).length,
                         accept_reject_diffs: classDiff, wording_only_diffs: textDiff, examples };

/* The legality-relevant fields are `isNonstandard` and the `Illegal` tier. A Smogon singles tier
 * LABEL moving (UU -> UUBL) is not a legality change and is reported separately rather than hidden. */
const legalityFieldDiffs = [];
for (const [t, d] of Object.entries(result.tables)) {
  for (const f of d.field_diffs) {
    if (f.field === 'isNonstandard' || f.a === 'Illegal' || f.b === 'Illegal') legalityFieldDiffs.push({ table: t, ...f });
  }
}
result.legality_field_diffs = legalityFieldDiffs;

result.LEGAL_SETS_IDENTICAL =
  Object.values(result.tables).every(d => d.set_equal) &&
  result.formats_identical && result.rule_table_identical &&
  result.learn_diffs.length === 0 && legalityFieldDiffs.length === 0 &&
  result.team_verdicts.accept_reject_diffs === 0 &&
  COUNTERS.empty_walks === 0 && COUNTERS.validator_threw === 0;

const out = flag('--out', 'data/verification/npm-oracle-2026-09-08/npm-oracle-legality.json');
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log('LEGAL_SETS_IDENTICAL:', result.LEGAL_SETS_IDENTICAL);
console.log('counts a/b:', Object.entries(result.tables).map(([t, d]) => t + ' ' + d.count_a + '/' + d.count_b).join('  '));
console.log('set equal :', Object.entries(result.tables).map(([t, d]) => t + ' ' + d.set_equal).join('  '));
console.log('formats identical:', result.formats_identical, ' rule table identical:', result.rule_table_identical);
console.log('learnset cells:', result.learn_cells.a, '/', result.learn_cells.b, ' diffs:', result.learn_diffs.length);
console.log('teams:', result.teams.a, 'valid', result.teams.valid_a, '/', result.teams.valid_b,
            ' accept-reject diffs:', result.team_verdicts.accept_reject_diffs,
            ' wording-only diffs:', result.team_verdicts.wording_only_diffs);
console.log('legality field diffs:', legalityFieldDiffs.length,
            ' non-legality field diffs:', Object.values(result.tables).reduce((n, d) => n + d.field_diffs.length, 0) - legalityFieldDiffs.length);
console.log('counters:', JSON.stringify(COUNTERS));
console.log('written:', out);
