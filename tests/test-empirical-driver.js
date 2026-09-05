/* test-empirical-driver.js — THE SECOND SAMPLER MUST AGREE WITH THE FIRST, MOVE FOR MOVE.
 *
 * `engine/empirical_driver.js` duplicates the weighted draw that `engine/rollout_leaf.js:706`
 * (`pickByPrior`) already implements. The duplication is forced — see that file's header: requiring
 * rollout_leaf from the differential would pull a LIVE copy of medicham2 into a process that reads a
 * frozen release, and lifting the sampler into a shared module would add a require edge to a frozen
 * SOURCE and strand every existing release.
 *
 * TWO PRODUCERS OF ONE FACT IS THIS REPO'S MOST-REPEATED FAILURE. The only safe version of it is one
 * that FAILS on the day they diverge, which is what this file is. It draws the same species' rows
 * through both implementations across a sweep of u and asserts the same move comes back every time.
 *
 * It also asserts the things a caller would otherwise have to trust:
 *   - the loader refuses an empty or unparsable table rather than returning an empty map;
 *   - the switch rate refuses an absent artifact rather than degrading to "cannot switch";
 *   - `steering.comparable` REFUSES a coverage artifact against an empirical one, and refuses two
 *     empirical arms whose behaviour tables differ;
 *   - the species key really is Showdown's `species.id` — measured against the format, not assumed.
 *
 * Run: node tests/test-empirical-driver.js
 */
'use strict';
require('../engine/showdown_path.js');
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

let failures = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) console.log('  ok   ' + what);
  else { failures++; console.log('  FAIL ' + what + (detail ? '\n         ' + detail : '')); }
};

const EMP = require('../engine/empirical_driver.js');
const STEERING = require('../engine/steering.js');

const PRIORS_BYTES = fs.readFileSync(D('data', 'move-priors.json'), 'utf8');
const P = EMP.loadPriors(PRIORS_BYTES, 'data/move-priors.json');
console.log('\nTHE BEHAVIOUR TABLE');
console.log('  ' + P.species + ' species, ' + P.move_rows + ' move rows, ' + P.lead_rows
  + ' lead rows, ' + P.acts + ' recorded acts, generated ' + P.generated);
ok(P.species > 300, 'the table profiles more than 300 species', P.species + ' profiled');

/* ---- 1. THE TWO SAMPLERS AGREE ------------------------------------------------------------------
 * `pickByPrior(mon, rng, usable)` reads `mon.name` through its own loader and calls `rng()` ONCE, so
 * a constant rng is the same u this file hands `drawMove`. The move lists are deliberately mixed:
 * moves the species really clicks, moves it does not (the 0.02 floor), and single-element lists. */
console.log('\n1. THE DUPLICATED DRAW — engine/empirical_driver.drawMove vs rollout_leaf.pickByPrior');
const RL = require('../engine/rollout_leaf.js');
if (typeof RL.pickByPrior !== 'function') {
  failures++;
  console.log('  FAIL rollout_leaf.js does not export pickByPrior, so the two samplers cannot be\n'
    + '       compared at all. That is worse than a mismatch: the duplication becomes unpinned.');
} else {
  /* Species chosen from the table itself rather than typed, per CLAUDE.md. The three with the most
   * recorded acts, plus three drawn from the middle of the distribution, so the sweep is not all
   * high-usage bodies. */
  const ranked = [...P.byKey.entries()].sort((a, b) => b[1].acts - a[1].acts);
  const picks = [ranked[0], ranked[1], ranked[2],
                 ranked[Math.floor(ranked.length / 2)],
                 ranked[Math.floor(ranked.length * 0.75)],
                 ranked[ranked.length - 1]].filter(Boolean);
  let compared = 0, disagreed = 0, firstBad = '';
  for (const [key, row] of picks) {
    const have = [...row.moves.keys()];
    /* three shapes: the real moveset, the real moveset plus a move never observed on it, and a
     * two-move subset. `protect` is read off another species' row rather than typed. */
    const foreign = [...P.byKey.get(ranked[0][0]).moves.keys()].find(m => !row.moves.has(m));
    const lists = [have, foreign ? have.concat([foreign]) : have, have.slice(0, 2)]
      .filter(l => l && l.length);
    for (const list of lists) {
      for (let k = 0; k < 40; k++) {
        const u = (k + 0.5) / 40;
        const mine = EMP.drawMove(row, list, false, u);
        const theirs = RL.pickByPrior({ name: key }, () => u, list);
        compared++;
        if (!mine || mine.id !== theirs) {
          disagreed++;
          if (!firstBad) firstBad = key + '  u=' + u.toFixed(4) + '  [' + list.join(',') + ']  '
            + 'empirical_driver=' + (mine && mine.id) + '  rollout_leaf=' + theirs;
        }
      }
    }
  }
  ok(compared > 300, 'the sweep actually ran', compared + ' draws compared across '
    + picks.length + ' species');
  ok(disagreed === 0, 'the two samplers return the same move on every draw',
    disagreed + ' of ' + compared + ' disagreed. first: ' + firstBad);
}

/* ---- 2. THE LEAD TABLE IS A DIFFERENT DISTRIBUTION, AND IT IS ACTUALLY USED --------------------- */
console.log('\n2. THE TURN-1 TABLE');
{
  const withLead = [...P.byKey.entries()].filter(([, r]) => r.lead.size >= 2)
    .sort((a, b) => b[1].acts - a[1].acts);
  ok(withLead.length > 200, 'most profiled species carry a turn-1 distribution',
    withLead.length + ' of ' + P.species);
  let moved = 0;
  for (const [, row] of withLead.slice(0, 60)) {
    const list = [...new Set([...row.moves.keys(), ...row.lead.keys()])];
    for (let k = 0; k < 20; k++) {
      const u = (k + 0.5) / 20;
      const a = EMP.drawMove(row, list, false, u), b = EMP.drawMove(row, list, true, u);
      if (a && b && a.id !== b.id) { moved++; break; }
    }
  }
  ok(moved > 0, 'the lead table changes the draw for at least one species',
    'it changed nothing on 60 species — the lead branch is wired to nothing');
  console.log('     the lead table changes the draw on ' + moved + ' of 60 species sampled');
}

/* ---- 3. NO SILENT FALLBACK --------------------------------------------------------------------- */
console.log('\n3. THE DEGRADATIONS REFUSE RATHER THAN DEFAULT');
const throws = (fn, what) => {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  ok(!!threw, what, 'it returned instead of throwing');
  return threw;
};
throws(() => EMP.loadPriors('{ not json', 'x'), 'an unparsable behaviour table is a refusal');
throws(() => EMP.loadPriors('{"species":{}}', 'x'), 'an EMPTY behaviour table is a refusal');
throws(() => EMP.switchRateFrom('{"pooled":{}}', 'x'),
  'an absent switch rate is a refusal, not a driver that cannot leave');
{
  const sw = EMP.switchRateFrom(fs.readFileSync(D('data', 'rollout-switch-census.json'), 'utf8'),
                                'data/rollout-switch-census.json');
  ok(sw.rate > 0 && sw.rate < 0.5, 'the real switch rate loads and is a plausible probability',
    'rate=' + sw.rate);
  console.log('     ' + sw.pct + '% of decisions with a live bench, from ' + sw.games + ' games');
}
{
  /* THE UNPROFILED SPECIES IS A COUNTER, NOT A SHRUG. */
  const C = EMP.counters();
  EMP.rowFor(P, C, 'notapokemonatall', null);
  ok(C.no_prior_row === 1 && C.first_no_prior_row === 'notapokemonatall',
    'an unprofiled species increments no_prior_row and keeps its name',
    JSON.stringify({ n: C.no_prior_row, first: C.first_no_prior_row }));
  const C2 = EMP.counters();
  const base = [...P.byKey.keys()][0];
  EMP.rowFor(P, C2, base + 'notaforme', base);
  ok(C2.row_via_base_forme === 1 && C2.no_prior_row === 0,
    'a base-forme match is counted separately from a miss',
    JSON.stringify(C2));
}

/* ---- 4. THE SPECIES KEY IS SHOWDOWN'S `species.id`, DERIVED FROM THE FORMAT --------------------- */
console.log('\n4. THE KEY — derived from the format, not assumed');
{
  const SP = require('../engine/showdown_path.js');
  const { Dex } = require(path.join(SP.RESOLVED, 'dist', 'sim'));
  const Dx = Dex.forFormat('gen9championsvgc2026regmb');
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const all = Dx.species.all().filter(legal);
  const hit = all.filter(s => P.byKey.has(EMP.norm(s.id)));
  const miss = all.filter(s => !P.byKey.has(EMP.norm(s.id)));
  const viaBase = miss.filter(s => s.baseSpecies && P.byKey.has(EMP.norm(s.baseSpecies)));
  console.log('     ' + all.length + ' legal species, ' + hit.length + ' hit a row directly, '
    + viaBase.length + ' more through the base forme, ' + (miss.length - viaBase.length) + ' unprofiled');
  console.log('     unprofiled: ' + miss.filter(s => !viaBase.includes(s)).map(s => s.id).join(' '));
  ok(hit.length / all.length > 0.9, 'over 90% of legal species hit a prior row on species.id',
    hit.length + '/' + all.length);
}

/* ---- 5. THE ARMS MAY NOT BE TABLED TOGETHER ---------------------------------------------------- */
console.log('\n5. arms_comparable / steering.comparable REFUSES A CROSS-POLICY PAIR');
{
  const inputs = [{ file: 'data/move-priors.json', digest: 'aaaaaaaaaaaa' }];
  /* `driver_code` IS PART OF THE FIXTURE — 2026-09-05. This section's subject is the POLICY and the
   * BEHAVIOUR TABLES, and `comparable()` now also answers on the INSTRUMENT: a pair where neither arm
   * declares its driver code reads UNKNOWN, because two runs on identical pins read 138 and 167 after
   * engine/empirical_driver.js was rewritten between them. A fixture that omitted the field would make
   * this section's control assert something it never intended to be about. Both sides carry the same
   * digest, so the instrument axis is held still and the tables are the only thing varying. */
  const common = { input_digest: 'ccc', input_rows: 1, input_generated: 'g',
                   driver_code: { digest: 'ddddddddddd0', files: { 'engine/game_differential.js': 'x' } },
                   team_pool_digest: 'ppp', team_pool_teams: 1, team_pool_picked: 1 };
  const cov = Object.assign({ policy: STEERING.POLICY, driver_inputs: null }, common);
  const emp = Object.assign({ policy: STEERING.POLICY_EMPIRICAL, driver_inputs: inputs }, common);
  const emp2 = Object.assign({ policy: STEERING.POLICY_EMPIRICAL,
    driver_inputs: [{ file: 'data/move-priors.json', digest: 'bbbbbbbbbbbb' }] }, common);

  const a = STEERING.comparable(cov, emp);
  ok(!a.ok && a.reasons.some(r => /selection POLICY differs/.test(r)),
    'a coverage arm and an empirical arm are NOT comparable', JSON.stringify(a));
  const b = STEERING.comparable(emp, emp2);
  ok(!b.ok && b.reasons.some(r => /BEHAVIOUR TABLES differ/.test(r)),
    'two empirical arms with different behaviour tables are NOT comparable', JSON.stringify(b));
  const c = STEERING.comparable(emp, Object.assign({}, emp));
  ok(c.ok, 'two empirical arms with identical tables ARE comparable', JSON.stringify(c));
  const d = STEERING.comparable(emp, Object.assign({}, emp, { driver_inputs: null }));
  ok(!d.ok && d.reasons.some(r => /records no `driver_inputs`/.test(r)),
    'an empirical arm with no declared tables is NOT comparable', JSON.stringify(d));
  /* THE INSTRUMENT AXIS, exercised where the fixture that carries it lives. Same policy, same tables,
   * different driver code — which is the shape that produced 138 and 167 on one set of pins. */
  const e = STEERING.comparable(emp, Object.assign({}, emp,
    { driver_code: { digest: 'eeeeeeeeeee1', files: { 'engine/empirical_driver.js': 'y' } } }));
  ok(!e.ok && e.verdict === STEERING.VERDICT.NO && e.reasons.some(r => /INSTRUMENT differs/.test(r)),
    'two arms with identical tables and DIFFERENT driver code are NOT comparable', JSON.stringify(e));
  const f = STEERING.comparable(Object.assign({}, emp, { driver_code: undefined }),
                                Object.assign({}, emp, { driver_code: undefined }));
  ok(!f.ok && f.verdict === STEERING.VERDICT.UNKNOWN,
    'two arms that BOTH predate the instrument stamp read UNKNOWN, not COMPARABLE', JSON.stringify(f));
}

/* ---- 6. THE MODE MUST BE NAMED BY ID ----------------------------------------------------------- */
console.log('\n6. THE ARM IS ASKED FOR BY ID');
{
  throws(() => STEERING.resolve({ mode: 'realistic' }),
    'an unknown steering mode is a refusal, not a fallback to the default');
  throws(() => STEERING.resolve({ mode: 'empirical' }),
    'the empirical mode with no declared driverInputs is a refusal');
  const r = STEERING.resolve({ mode: 'coverage' });
  ok(r.policy === STEERING.POLICY && r.driver_inputs === null,
    'the default arm is unchanged and declares no driver inputs', r.policy);
  const e = STEERING.resolve({ mode: 'empirical',
    driverInputs: [{ file: 'data/move-priors.json', digest: 'x' }] });
  ok(e.policy === STEERING.POLICY_EMPIRICAL && /CREDITED ONLY/.test(e.census_role),
    'the empirical arm says the census no longer selects', e.census_role);
}

console.log('\n' + (failures ? 'RED — ' + failures + ' of ' + checks + ' checks failed'
                              : 'GREEN — all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
