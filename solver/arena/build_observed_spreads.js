/* solver/arena/build_observed_spreads.js — build the arena's `observed-v1` spread table: role-v1 with the OBSERVED hooks
 * folded in, the way ROTOM's ladder rotations are spread since abra/regmc 1.72.0. A NEW version beside role-v1, never an
 * edit of it. (2026-10-01; docs/_reports/2026-10-01-smogon-sept.md.)
 *
 *   node solver/arena/build_observed_spreads.js        -> solver/arena/spreads/observed-v1.json   (tracked, small)
 *
 * Needs no engine and no store: every entry is decided by a lookup.
 * THE SETS are role-v1's (the frozen team store, the human dataset and the rotations as role-v1 was built) plus every set
 * of every ladder rotation on disk now. For each, in the ladder's order:
 *   1. a set a ladder rotation plays takes the rotation's RECORDED spread — what ROTOM fields, byte for byte (the same
 *      reconciliation role-v1 makes; the parity the arena exists for);
 *   2. else the tournament hook (spreads.js tournamentSpread: a published spread for the species + item + nature);
 *   3. else the Smogon chain (spreads.js observedSpread over loadObserved(): bo3 1760 -> 0, then bo1);
 *   4. else role-v1's entry (the derived rule, unchanged).
 * The entry keeps role-v1's encoding ("hp/atk/def/spa/spd/spe role"); `sources` counts each path and `by_set_source`
 * names the path of every entry (t = tournament, o<k> = the chain level k, r = rotation, d = role-v1). The rule text is
 * spreads.js RULE_TEXT (the fallback IS role-v1's derivation) and the Smogon files and the tournament events are pinned by
 * sha256 in the provenance; solver/arena/spread_source.js refuses to open the table if any of them has moved.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('./env.js');
const X = require('../human/dex.js');
const SPR = require('../rotom/spreads.js');
const SS = require('./spread_source.js');
const ROOT = path.join(__dirname, '..', '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rel = f => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/');

const baseBuf = fs.readFileSync(SS.TABLE_FILE);
const BASE = JSON.parse(baseBuf.toString('utf8'));
if (BASE.provenance.rule !== SPR.RULE_TEXT) throw new Error('role-v1 was built by another rule; rebuild it first');
const obs = SPR.loadObserved();
if (!obs) throw new Error('no Reg M-C Smogon moveset file under data/smogon-stats/: nothing to fold in');
const tour = SPR.loadTournament();

/* a row from a setKey (species|item|ability|nature|moves): ids, which the dex and every lookup here accept */
const rowOfKey = k => { const [species, item, ability, nature, moves] = k.split('|'); return { species, item, ability, nature, moves: moves ? moves.split(',') : [] }; };

const rotDir = path.join(ROOT, 'solver', 'rotom', 'teams');
const rotRec = new Map(), rotFiles = [];
for (const f of fs.readdirSync(rotDir).filter(f => /^ladder-rotation.*\.json$/.test(f)).sort()) {
  const J = JSON.parse(fs.readFileSync(path.join(rotDir, f), 'utf8'));
  if (!Array.isArray(J.teams) || !J.teams.every(t => Array.isArray(t.spreads))) continue;
  rotFiles.push({ file: 'solver/rotom/teams/' + f, sha256: sha(fs.readFileSync(path.join(rotDir, f))) });
  for (const t of J.teams) for (const z of t.spreads) {
    const row = { species: z.species, item: z.item, ability: z.ability, nature: z.nature, moves: z.moves.slice() };
    const k = SPR.setKey(row), v = SS.encode(z.evs, SPR.role(row).role);
    if (rotRec.has(k) && rotRec.get(k).v !== v) throw new Error('two rotations play ' + k + ' at different spreads: ' + rotRec.get(k).v + ' / ' + v);
    rotRec.set(k, { v, row, source: z.source });
  }
}

const keys = new Set([...Object.keys(BASE.spreads), ...rotRec.keys()]);
const spreads = {}, bySrc = {}, sources = { rotation: 0, tournament: 0, observed: {}, role_v1: 0 };
let speedMoved = 0, moved = 0;
for (const k of [...keys].sort()) {
  let v, s;
  if (rotRec.has(k)) { v = rotRec.get(k).v; s = 'r'; sources.rotation++; }
  else {
    const row = rowOfKey(k);
    const tz = SPR.tournamentSpread(row, tour);
    const o = tz ? null : SPR.observedSpread(row, obs);
    if (tz) { v = SS.encode(tz.evs, SPR.role(row).role); s = 't'; sources.tournament++; }
    else if (o) { v = SS.encode(o.evs, SPR.role(row).role); s = 'o' + o.level; const lk = (o.format === X.FORMAT ? 'bo3-' : 'bo1-') + o.cutoff; sources.observed[lk] = (sources.observed[lk] || 0) + 1; }
    else { v = BASE.spreads[k]; s = 'd'; sources.role_v1++; }
  }
  spreads[k] = v; bySrc[k] = s;
  if (BASE.spreads[k] && BASE.spreads[k] !== v) { moved++; if (SS.decode(BASE.spreads[k]).evs.spe !== SS.decode(v).evs.spe) speedMoved++; }
}
const provenance = { version: 'observed-v1', base: { version: 'role-v1', file: rel(SS.TABLE_FILE), sha256: sha(baseBuf), release: BASE.provenance.release, built: BASE.provenance.built },
  release: BASE.provenance.release, rule: SPR.RULE_TEXT, rule_sha256: sha(SPR.RULE_TEXT),
  observed: { rule: SPR.OBSERVED_RULE_TEXT, min_weight: SPR.OBS_MIN_WEIGHT, files: obs.files.map(f => ({ file: f.file, sha256: f.sha256, format: f.format, cutoff: f.cutoff })) },
  tournament: tour ? { rule: SPR.TOURNAMENT_RULE_TEXT, dir: tour.dir, events: tour.events, keys: tour.keys } : null,
  rotations: rotFiles, order: '1 the ladder rotation\'s recorded spread; 2 the tournament hook; 3 the Smogon chain; 4 role-v1',
  population_file: BASE.provenance.population_file, population_sha256: BASE.provenance.population_sha256, store: BASE.provenance.store, store_sha256: BASE.provenance.store_sha256,
  sets: keys.size, sources, moved_from_role_v1: moved, speed_moved_from_role_v1: speedMoved,
  encoding: 'spreads[setKey] = "hp/atk/def/spa/spd/spe role"; by_set_source[setKey] = r | t | o<chain level> | d', built: new Date().toISOString() };
const out = path.join(path.dirname(SS.TABLE_FILE), 'observed-v1.json');
fs.writeFileSync(out, JSON.stringify({ provenance, spreads, by_set_source: bySrc }) + '\n');
console.log('wrote ' + rel(out) + ': ' + keys.size + ' sets ' + JSON.stringify(sources) + '; ' + moved + ' differ from role-v1 (' + speedMoved + ' in Speed)');
