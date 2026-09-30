/* solver/rotom/build_top_rotation.js — ROTOM's TOP-META ladder rotation: 3-5 teams that TOP-RATED Reg M-C open-sheet
 * players actually bring, more than one of them, and that do not under-perform at that rating. Nothing here is typed.
 *
 *   tools\lownode.cmd solver/rotom/build_top_rotation.js [--store <games.jsonl.gz>] [--meta <archetypes.json>] [--out <file>]
 *
 * WHY (Will, 2026-09-29, on seeing a Hippowdon on our team): "top-rated meta teams only". The first rotation
 * (build_ladder_teams.js) took the highest-rated side of each GURU archetype, one per archetype. Its sides were already in
 * the top ~3% by rating (1379-1549); what it lacked was a META test — one player's six at 1435 carried Hippowdon, a species
 * on 0.6% of top-rated teams. So this builder asks two questions of every team, and both are read from the store:
 *   TOP   the side was played at a rating >= FLOOR, the FLOOR_PCT quantile of every rated human open-sheet bo3 side.
 *   META  the exact six is brought by >= MIN_PLAYERS distinct players at >= FLOOR (not one player's brew), over
 *         >= MIN_GAMES decided side-games there; every one of its species is on >= MIN_SPECIES_SHARE of the distinct
 *         (player, six) teams at >= FLOOR; and its mean per-game residual S - E at >= FLOOR is no worse than the mean over
 *         ALL sides at >= FLOOR. That baseline, not 0: a rating read before the game regresses to the mean, so every
 *         top-rated group runs below 0 (measured -0.055 at the 99th percentile); 0 would pick only lucky samples.
 * THE RULE (pre-stated here, the output records it):
 *   1. sides: human (not bot, not our own accounts, not in a game engine/quality.js excludes as a bot, a behavioural
 *      bot, an illegal team, a declared corrupt winner or nonstandard ruleset, or a detected custom ruleset), open sheet, both ratings known, a winner, not an instant forfeit
 *      (forfeit with <= 1 turn); S = 1 if the side won, E = 1/(1+10^((R_opp-R)/400)).
 *   2. families = exact species-six at >= FLOOR, filtered by META above, ranked by distinct players, then games, then S - E.
 *   3. near-identical: a family sharing >= NEAR_SAME species with one already taken is skipped (a mirror of a kept team).
 *   4. variety: at most one family per GURU archetype (solver/out/meta/archetypes.json, same cosine + defining-species
 *      membership as build_ladder_teams.js); a six GURU does not assign is its own archetype. At most MAX_TEAMS teams
 *      (Will, 2026-09-24, solver/PLAN.md Q4: "a small rotation ... (3-5 of them)"). Fewer than 3 is a failure, not a pass.
 *   5. the sheet: the highest-rated side of that family at >= FLOOR whose sheet is COMPLETE (six sets, each an item, an
 *      ability, a nature, four moves), whose bring (four) and leads (two) were seen, every species / item / ability / move
 *      legal in the format (solver/human/dex.js legal()), and that passes Showdown's TeamValidator for the bo3 format.
 *      The spread is solver/rotom/spreads.js (2026-09-30): a Reg M-C observed spread if one exists, else derived from the
 *      set's role against the top-meta population of this same store (the store has no Stat Points).
 * Output: solver/rotom/teams/ladder-rotation-top.json, the same team shape as ladder-rotation.json, plus the rule, the
 * floor and each team's family evidence. rotom.js re-validates every team at start-up; checkRotation() below is what
 * solver/tests/test-rotom-top-rotation.js asserts.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
require('../arena/env.js');
const X = require('../human/dex.js');
const BA = require('./build_assets.js');
const { cosine } = require('./build_ladder_teams.js');

const RULE = { FLOOR_PCT: 0.99, MIN_PLAYERS: 2, MIN_GAMES: 8, MIN_SPECIES_SHARE: 0.03, NEAR_SAME: 5, MAX_TEAMS: 5, MIN_TEAMS: 3 };
/* our own accounts: the same set the meta extractor excludes (solver/meta/extract.js OWN) */
const OWN = new Set(['medicham32', 'willhoop', 'mag', 'mag2', 'miltank', 'miltank2']);
const HARD_EXCLUDE = new Set(['bot', 'behavioural_bot', 'illegal_team', 'corrupt_winner', 'nonstandard_ruleset', 'custom_ruleset']);
const toID = X.toID;
const ROOT = path.join(__dirname, '..', '..');
const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;
const STORE_DEFAULT = path.join(ROOT, 'data', 'games.' + X.FORMAT + '.jsonl.gz');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const defining = a => a.core.filter(c => c.in_cluster >= 0.5).map(c => c.id);
const turnsOf = g => Array.isArray(g.turns) ? g.turns.length : (+g.turns || 0);
const quantile = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };

function readStore(f) { return zlib.gunzipSync(fs.readFileSync(f)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); }

/* a store sheet row -> the row shape build_assets.packTeam takes, NAMES read from the dex; null if incomplete or illegal */
function rowOf(r) {
  if (!r || !r.species || !r.item || !r.ability || !r.nature || !Array.isArray(r.moves) || r.moves.length !== 4) return null;
  const sp = X.D.species.get(r.species), it = X.D.items.get(r.item), ab = X.D.abilities.get(r.ability), nat = X.D.natures.get(r.nature);
  const mv = r.moves.map(m => X.D.moves.get(m));
  if (![sp, it, ab].every(X.legal) || !nat.exists || !mv.every(X.legal) || new Set(mv.map(m => m.id)).size !== 4) return null;
  return { species: sp.name, item: it.name, ability: ab.name, moves: mv.map(m => m.name), nature: nat.name, gender: r.gender || '' };
}

function sidesOf(games, drop) {
  const out = [];
  for (const g of games) {
    if (!g.openSheet || (drop && drop.has(g.id))) continue;
    for (const [s, o] of [['p1', 'p2'], ['p2', 'p1']]) {
      const p = g[s], q = g[o];
      if (!p || p.bot || !p.rating || OWN.has(toID(p.name))) continue;
      const six = g.six && g.six[s];
      const decided = !!g.winner && !!q && !!q.rating && !(g.forfeit && turnsOf(g) <= 1) && (g.winner === p.name || g.winner === q.name);
      out.push({ g, s, r: p.rating, player: toID(p.name), six: six && six.length === 6 ? six : null, decided,
                 S: decided ? (g.winner === p.name ? 1 : 0) : null, E: decided ? 1 / (1 + Math.pow(10, (q.rating - p.rating) / 400)) : null });
    }
  }
  return out;
}

/* the store's sides at or above the top-meta floor, after the project's HARD quality exclusions (rule 1). Shared with
 * solver/rotom/spreads.js, whose population is exactly these sides, so a rotation's teams and its spreads read one sample. */
function topSides(games) {
  /* the project's corpus filter (engine/quality.js reasons), its HARD exclusions only: a bot flag, a behavioural bot
   * (store-derived), an illegal team, a declared corrupt winner or nonstandard ruleset, a detected custom ruleset. Its
   * `short`, `partial_bring` and `forfeit_no_action` are outcome filters; rule 1 above handles outcomes itself. */
  const Q = require('../../engine/quality.js');
  const qcfg = Q.config(), qbots = Q.behaviouralBots(games, qcfg);
  const drop = new Set(), dropped = {};
  for (const g of games) {
    const rs = Q.reasons(g, qcfg, qbots).filter(x => HARD_EXCLUDE.has(x));
    if (rs.length) { drop.add(g.id); for (const x of rs) dropped[x] = (dropped[x] || 0) + 1; }
  }
  const sides = sidesOf(games, drop);
  const FLOOR = quantile(sides.map(x => x.r), RULE.FLOOR_PCT);
  const top = sides.filter(x => x.r >= FLOOR && x.six);
  return { drop, dropped, qbots, sides, FLOOR, top };
}

/* the spread deriver over the top-meta population of a store (solver/rotom/spreads.js) */
function spreadDeriver(games, opts) {
  const SP = require('./spreads.js');
  const T = topSides(games);
  return { D: new SP.Deriver(SP.population(T.top, rowOf), opts), T };
}

function build(opts) {
  const o = Object.assign({ store: STORE_DEFAULT, meta: path.join(MAIN, 'solver', 'out', 'meta', 'archetypes.json') }, opts || {});
  const A = JSON.parse(fs.readFileSync(o.meta, 'utf8'));
  const games = readStore(o.store);
  const SP = require('./spreads.js');
  /* o.deriver: a ready spread source (the REBUILD test passes the rotation's own recorded spreads, SP.recorded) */
  const { D: SPD, T } = o.deriver ? { D: o.deriver, T: topSides(games) } : spreadDeriver(games, o.spreads);
  const { drop, dropped, qbots, sides, FLOOR, top } = T;
  const topDec = top.filter(x => x.decided);
  const baseline = topDec.reduce((a, x) => a + x.S - x.E, 0) / topDec.length;
  const pt = new Map(); for (const x of top) pt.set(x.player + '|' + x.six.slice().sort().join(','), x.six);
  const spShare = {}; for (const six of pt.values()) for (const sp of six) spShare[sp] = (spShare[sp] || 0) + 1 / pt.size;
  const archOf = six => {
    const set = new Set(six); let best = null, bc = -1;
    for (const a of A.archetypes) { const c = cosine(a.core, set); if (c > bc) { bc = c; best = a; } }
    return best && best.stable === 'stable' && defining(best).every(sp => set.has(sp)) ? { best, cos: bc } : null;
  };
  const fam = new Map();
  for (const x of top) {
    const k = x.six.slice().sort().join(',');
    if (!fam.has(k)) fam.set(k, { key: k, six: x.six.slice().sort(), players: new Set(), games: 0, S: 0, R: 0, sides: [] });
    const f = fam.get(k); f.players.add(x.player); f.sides.push(x);
    if (x.decided) { f.games++; f.S += x.S; f.R += x.S - x.E; }
  }
  const verdicts = [];
  const ranked = [...fam.values()].map(f => Object.assign(f, { nPlayers: f.players.size, win: f.games ? f.S / f.games : null, resid: f.games ? f.R / f.games : null }))
    .sort((a, b) => b.nPlayers - a.nPlayers || b.games - a.games || (b.resid - a.resid) || (a.key < b.key ? -1 : 1));
  const teams = [], usedArch = new Set();
  for (const f of ranked) {
    const why = [];
    if (f.nPlayers < RULE.MIN_PLAYERS) continue;             // not a meta family; not listed (hundreds of one-player sixes)
    if (f.games < RULE.MIN_GAMES) why.push('games ' + f.games + ' < ' + RULE.MIN_GAMES);
    const rare = f.six.filter(sp => (spShare[sp] || 0) < RULE.MIN_SPECIES_SHARE);
    if (rare.length) why.push('off-meta species ' + rare.map(sp => sp + ' ' + ((spShare[sp] || 0) * 100).toFixed(1) + '%').join(', '));
    if (f.games && f.resid < baseline) why.push('S-E ' + f.resid.toFixed(3) + ' < top baseline ' + baseline.toFixed(3));
    const near = teams.find(t => t.six_ids.filter(sp => f.six.includes(sp)).length >= RULE.NEAR_SAME);
    if (near) why.push('near-identical to ' + near.id);
    const ar = archOf(f.six);
    const archId = ar ? 'guru:' + ar.best.id : 'six:' + f.key;
    if (usedArch.has(archId)) why.push('archetype ' + archId + ' already taken');
    if (teams.length >= RULE.MAX_TEAMS) why.push('rotation full');
    let pick = null; const refused = [];
    if (!why.length) {
      for (const x of f.sides.slice().sort((a, b) => b.r - a.r || (a.g.id < b.g.id ? -1 : 1))) {
        const sheet = x.g.sheets && x.g.sheets[x.s], br = x.g.brought && x.g.brought[x.s], ld = x.g.lead && x.g.lead[x.s];
        if (!sheet || sheet.length !== 6 || !br || br.length !== 4 || !ld || ld.length !== 2 || (x.g.forfeit && turnsOf(x.g) <= 1)) { refused.push(x.g.id + ': sheet/bring incomplete'); continue; }
        const rows = sheet.map(rowOf);
        if (rows.some(r => !r)) { refused.push(x.g.id + ': a set incomplete or not legal'); continue; }
        const ids = sheet.map(r => toID(r.species));
        const bring = ld.concat(br.filter(b => !ld.includes(b))).map(b => ids.indexOf(toID(b)));
        if (bring.length !== 4 || bring.some(i => i < 0) || new Set(bring).size !== 4) { refused.push(x.g.id + ': bring not on the sheet'); continue; }
        const spreads = SP.teamSpreads(SPD, rows);
        const { sets, packed } = BA.packTeam(rows, spreads.map(z => z.evs));
        const problems = BA.validate(sets);
        if (problems) { refused.push(x.g.id + ': TeamValidator ' + problems.slice(0, 2).join('; ')); continue; }
        pick = { x, rows, bring, packed, spreads }; break;
      }
      if (!pick) why.push('no side with a complete, legal, validating sheet (' + refused.length + ' refused)');
    }
    verdicts.push({ six: f.key, players: f.nPlayers, games: f.games, win: f.win == null ? null : +f.win.toFixed(3), resid: f.resid == null ? null : +f.resid.toFixed(4),
                    archetype: archId, kept: !why.length, why, refused: refused.slice(0, 5) });
    if (why.length) continue;
    usedArch.add(archId);
    const byUse = f.six.slice().sort((a, b) => (spShare[b] || 0) - (spShare[a] || 0) || (a < b ? -1 : 1));
    const label = ar ? ar.best.label : byUse.map(sp => X.D.species.get(sp).name).join(' / ');
    const t = pick.x;
    teams.push({ id: 'T' + (teams.length + 1),
      archetype: ar ? { id: 'guru:' + ar.best.id, label, source: 'GURU archetypes.json', share: ar.best.share, cosine: +ar.cos.toFixed(3), defining: defining(ar.best) }
                    : { id: archId, label, source: 'the exact six (no stable GURU archetype holds it); label = the six, most-used at the floor first (three names collided: two sixes share Rillaboom / Kingambit / Sneasler)' },
      from_game: t.g.id, date: t.g.date, rating: t.r, player: t.player,
      family: { players: f.nPlayers, side_games: f.games, win: +f.win.toFixed(3), resid: +f.resid.toFixed(4), species_share_at_floor: Object.fromEntries(f.six.map(sp => [sp, +(spShare[sp] * 100).toFixed(1)])) },
      six_ids: pick.rows.map(r => toID(X.D.species.get(r.species).id)), species: pick.rows.map(r => r.species), bring: pick.bring, packed: pick.packed, spreads: pick.spreads });
  }
  const dates = games.map(g => g.date).sort();
  return {
    generated: new Date().toISOString(), format: X.FORMAT, checkout_commit: X.checkoutCommit(), builder: 'solver/rotom/build_top_rotation.js',
    source: { store: { path: path.relative(ROOT, o.store).split(path.sep).join('/'), sha256: sha(o.store), games: games.length, first: dates[0], last: dates[dates.length - 1] },
              archetypes: { path: 'solver/out/meta/archetypes.json', sha256: sha(o.meta), k: A.k_chosen } },
    rule: Object.assign({}, RULE, { floor: FLOOR, floor_is: 'the ' + RULE.FLOOR_PCT + ' quantile of the ratings of every rated human open-sheet bo3 side in the store',
      games_excluded_by_quality_filter: drop.size, excluded_by_reason: dropped, behavioural_bots: [...qbots].sort(),
      rated_sides: sides.length, sides_at_floor: top.length, decided_at_floor: topDec.length, players_at_floor: new Set(top.map(x => x.player)).size,
      player_teams_at_floor: pt.size, baseline_resid_at_floor: +baseline.toFixed(4) }),
    spread_rule: SP.RULE_TEXT,
    spread_source: Object.assign({ store: path.relative(ROOT, o.store).split(path.sep).join('/'), store_sha256: sha(o.store), floor: FLOOR }, SPD.provenance()),
    validator: 'Showdown TeamValidator.get(' + X.FORMAT + ') on the Reg M-C checkout — every team below passed',
    families_considered: verdicts, teams };
}

/* every rotation team: validates, is complete and legal, is at or above the recorded floor, and its from_game side in the
 * store has that rating. -> list of problems (empty = pass). `games` is optional (the store rows keyed by id). */
function checkRotation(rot, games) {
  const bad = [];
  const { Teams, TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  if (rot.format !== X.FORMAT) bad.push('format ' + rot.format + ' is not ' + X.FORMAT);
  const V = TeamValidator.get(X.FORMAT);
  const floor = rot.rule && rot.rule.floor;
  if (!(floor > 0)) bad.push('no floor recorded');
  if (!(rot.teams.length >= RULE.MIN_TEAMS && rot.teams.length <= RULE.MAX_TEAMS)) bad.push('rotation holds ' + rot.teams.length + ' teams, not 3-5');
  for (const t of rot.teams) {
    const sets = Teams.unpack(t.packed);
    const pr = V.validateTeam(sets);
    if (pr) bad.push(t.id + ' TeamValidator: ' + pr.slice(0, 2).join('; '));
    if (!sets || sets.length !== 6) { bad.push(t.id + ' does not hold six'); continue; }
    for (const s of sets) {
      if (!s.item || !s.ability || !s.nature || !s.moves || s.moves.length !== 4) bad.push(t.id + ' ' + s.species + ' set incomplete');
      const ents = [X.D.species.get(s.species), X.D.items.get(s.item), X.D.abilities.get(s.ability)].concat((s.moves || []).map(m => X.D.moves.get(m)));
      for (const e of ents) if (!X.legal(e)) bad.push(t.id + ' ' + s.species + ': ' + (e.name || e.id) + ' is not legal in ' + X.FORMAT);
    }
    if (!(t.rating >= floor)) bad.push(t.id + ' rating ' + t.rating + ' is below the floor ' + floor);
    if (!(t.bring && t.bring.length === 4 && new Set(t.bring).size === 4 && t.bring.every(i => i >= 0 && i < 6))) bad.push(t.id + ' bring ' + JSON.stringify(t.bring));
    if (!(t.family && t.family.players >= RULE.MIN_PLAYERS && t.family.side_games >= RULE.MIN_GAMES)) bad.push(t.id + ' family evidence below the META bar: ' + JSON.stringify(t.family));
    else if (!(t.family.resid >= rot.rule.baseline_resid_at_floor)) bad.push(t.id + ' family S-E ' + t.family.resid + ' below the top baseline ' + rot.rule.baseline_resid_at_floor);
    if (t.family) for (const [sp, pc] of Object.entries(t.family.species_share_at_floor || {})) if (!(pc >= RULE.MIN_SPECIES_SHARE * 100)) bad.push(t.id + ' off-meta species ' + sp + ' ' + pc + '%');
    if (games) {
      const g = games.get(t.from_game);
      const side = g && ['p1', 'p2'].find(s => g[s] && toID(g[s].name) === t.player);
      if (!side) bad.push(t.id + ' from_game ' + t.from_game + ' / player ' + t.player + ' not in the store');
      else if (g[side].rating !== t.rating) bad.push(t.id + ' store rating ' + g[side].rating + ' != recorded ' + t.rating);
    }
  }
  if (new Set(rot.teams.map(t => t.archetype && t.archetype.id)).size !== rot.teams.length) bad.push('two teams share an archetype');
  return bad;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const OUTF = flag('--out', path.join(__dirname, 'teams', 'ladder-rotation-top.json'));
  const out = build({ store: flag('--store', STORE_DEFAULT), meta: flag('--meta', path.join(MAIN, 'solver', 'out', 'meta', 'archetypes.json')) });
  const R = out.rule;
  console.log('floor ' + R.floor + ' (q' + R.FLOOR_PCT + ' of ' + R.rated_sides + ' rated sides); ' + R.sides_at_floor + ' sides / ' + R.players_at_floor + ' players at the floor; baseline S-E ' + R.baseline_resid_at_floor);
  for (const v of out.families_considered) console.log('  ' + (v.kept ? 'KEEP ' : 'skip ') + v.players + 'p ' + v.games + 'g win ' + v.win + ' S-E ' + v.resid + '  ' + v.six + (v.why.length ? '   <- ' + v.why.join('; ') : ''));
  if (out.teams.length < RULE.MIN_TEAMS) { console.error('only ' + out.teams.length + ' teams meet the rule; a rotation needs ' + RULE.MIN_TEAMS + '. Nothing written.'); process.exit(1); }
  const bad = checkRotation(out, null);
  if (bad.length) { console.error('checkRotation refused the build: ' + bad.join(' | ')); process.exit(1); }
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1) + '\n');
  console.log('top rotation: ' + out.teams.length + ' teams -> ' + OUTF);
  for (const t of out.teams) console.log('  ' + t.id + ' ' + t.rating + ' [' + t.archetype.label + '] ' + t.species.join(' / ') + '  (' + t.family.players + ' players, ' + t.family.side_games + ' games, S-E ' + t.family.resid + ')');
}
if (require.main === module) main();
module.exports = { RULE, HARD_EXCLUDE, build, checkRotation, readStore, rowOf, sidesOf, topSides, spreadDeriver, STORE_DEFAULT };
