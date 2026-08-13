/* test-end-state-severity.js — THE GATE ON THE SEVERITY LADDER, not on the engines it ranks.
 *
 *   SHOWDOWN_PATH=... node tests/test-end-state-severity.js
 *
 * WHY THE LADDER EXISTS. `DIFFERENT-END-STATE` was a COUNT. A game in which a healthy body is killed
 * by a move it cannot be hit by — after which a replacement comes in and every later line is a
 * different game — weighed the same as a three-HP rounding residue. Will found three such games by
 * reading twenty-five battles by hand; the instrument could not have surfaced one of them.
 *
 * WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE". A divergence is a finding. This file goes red only
 * when the LADDER is wrong, in the five ways it can be:
 *
 *   PART 1  the top rung fires on a planted death and NOT on a planted three-HP residue. A ladder that
 *           has only ever seen real data is not evidence; it has to be shown catching and shown NOT
 *           catching, because a classifier that answers "severe" to everything also passes PART 1's
 *           first half.
 *   PART 2  a mega evolution that fires in one engine and not the other renames a party key. Read off
 *           the diff list that is indistinguishable from a death, and a false alarm at the TOP of the
 *           ladder is the most expensive kind. It must land on the identity rung.
 *   PART 3  every rung is reachable, and the rungs are ordered — a board carrying BOTH a death and a
 *           stat stage must band as the death.
 *   PART 4  the threshold is MEASURED. `severity` must REFUSE to run without one, and the collector
 *           must step over Showdown's duplicated `|split|` line — counting both halves would halve
 *           every hit and look exactly like a working ruler.
 *   PART 5  the whole path, through the real driver, on a real game: a planted faint reaches the last
 *           board and bands at the top, against the SAME PAIR AND SEED run clean as a control.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

/* THE FIXTURE IS PINNED AND THE ENGINE IS NOT. `--team-store` is forced so PART 5 plays the same team
 * pool every run — the pool was read live and three runs of one instrument reported 1,556, 1,213 and
 * 983 games. The RELEASE is deliberately NOT pinned here: a release id typed into a test rots, and the
 * driver already reads `--release` off argv, so `node tests/test-end-state-severity.js --release <id>`
 * runs PART 5 against a frozen engine while another division edits the live one. */
process.argv.push('--end-state');
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
const ESS = require(D('engine', 'end_state_severity.js'));

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

/* A HEALTH BAR OF 200 AND A TYPICAL HIT OF 40% OF IT — so one hit is 80 points and a three-HP residue
 * is 0.0375 of a hit. Written as an explicit fixture rather than taken from a run, because these
 * assertions are about the LADDER and must not move when the engines do. */
const T = { hpThresholdFrac: 0.40 };
const body = (hp, fainted) => ({ hp, maxhp: 200, fainted: !!fainted });
const board = (medi, sd, diffs) => ({ parties: { medi, sd }, diffs: diffs || [] });
const FULL = () => ({ p1: { incineroar: body(200), garchomp: body(200) },
                      p2: { kingambit: body(200), whimsicott: body(200) } });
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ================= PART 1 — SHOWN CATCHING, AND SHOWN NOT CATCHING ============================== */
console.log('PART 1 — a planted death must reach the top; a planted three-HP residue must NOT');
{
  const m = FULL(), s = FULL();
  m.p1.incineroar = body(0, true);                       // dead for us, standing for the authority
  const dead = ESS.severity(board(m, s, [
    { side: 'p1', body: 'incineroar', field: 'party.hp', us: 0, sd: 200, maxhp: 200 },
    { side: 'p1', body: 'incineroar', field: 'party.fainted', us: true, sd: false },
  ]), T);
  if (dead.band_id !== 'DIFFERENT-BODIES-ALIVE')
    fail('a body dead on one side and standing on the other banded as ' + dead.band_id);
  else pass('a planted death bands at DIFFERENT-BODIES-ALIVE (band ' + dead.band + '): ' + dead.why);
  if (!dead.evidence.some(e => e.body === 'incineroar'))
    fail('caught but NOT LOCALISED — the evidence does not name the body that died');
  else pass('localised: ' + dead.evidence[0].what + ' (' + dead.evidence[0].body + ')');

  const m2 = FULL(), s2 = FULL();
  m2.p1.incineroar = body(197);
  const small = ESS.severity(board(m2, s2, [
    { side: 'p1', body: 'incineroar', field: 'party.hp', us: 197, sd: 200, maxhp: 200 },
  ]), T);
  if (small.band_id === 'DIFFERENT-BODIES-ALIVE' || small.band_id === 'DIFFERENT-WINNER')
    fail('A THREE-HP RESIDUE WAS BANDED AS A WRONG OUTCOME (' + small.band_id + '). A ladder that '
       + 'answers "severe" to everything is a count with longer words.');
  else if (small.band_id !== 'SMALL-HP-OR-BOOST-ONLY')
    fail('a three-HP residue banded as ' + small.band_id + ', want SMALL-HP-OR-BOOST-ONLY');
  else pass('a three-HP residue bands at the bottom (band ' + small.band + '), '
          + small.largest_hp_gap_in_typical_hits + ' typical hits');

  /* AND THE BAND BETWEEN THEM. 100 of 200 is 1.25 typical hits — the health-gap rung has to be
   * reachable or band 3 is decoration and every damage defect falls to the bottom. */
  const m3 = FULL(), s3 = FULL();
  m3.p1.incineroar = body(100);
  const big = ESS.severity(board(m3, s3, [
    { side: 'p1', body: 'incineroar', field: 'party.hp', us: 100, sd: 200, maxhp: 200 },
  ]), T);
  if (big.band_id !== 'HP-BEYOND-A-TYPICAL-HIT')
    fail('a 100-of-200 health gap (1.25 typical hits) banded as ' + big.band_id);
  else pass('a health gap larger than one hit bands at HP-BEYOND-A-TYPICAL-HIT: ' + big.why);
}

/* ================= PART 2 — A RENAME IS NOT A DEATH ============================================= */
console.log('\nPART 2 — a forme change that fires in one engine only must NOT read as a death');
{
  /* The party is keyed by species, so a mega that fires for us and not for the authority puts
   * `venusaurmega` in one map and `venusaur` in the other. Nobody has died. Read off the diff list
   * this is `party.MISSING-OR-EXTRA-MEMBER` and looks exactly like a body that is gone. */
  const m = FULL(), s = FULL();
  delete m.p1.garchomp; m.p1.venusaurmega = body(200);
  delete s.p1.garchomp; s.p1.venusaur = body(200);
  const v = ESS.severity(board(m, s, [
    { side: 'p1', body: 'venusaurmega', field: 'party.MISSING-OR-EXTRA-MEMBER', us: 200, sd: null },
    { side: 'p1', body: 'venusaur', field: 'party.MISSING-OR-EXTRA-MEMBER', us: null, sd: 200 },
  ]), T);
  if (v.band_id === 'DIFFERENT-BODIES-ALIVE' || v.band_id === 'DIFFERENT-WINNER')
    fail('A RENAME WAS REPORTED AS A DEATH (' + v.band_id + ') — a false alarm at the top of the '
       + 'ladder is the most expensive kind there is');
  else if (v.band_id !== 'DIFFERENT-IDENTITY-ON-A-LIVE-BODY')
    fail('a one-sided forme change banded as ' + v.band_id + ', want DIFFERENT-IDENTITY-ON-A-LIVE-BODY');
  else pass('a one-sided forme change bands as identity, not as a death: ' + v.why);
}

/* ================= PART 3 — EVERY RUNG REACHABLE, AND THE RUNGS ORDERED ========================= */
console.log('\nPART 3 — every rung is reachable, and a board carrying two of them takes the worse one');
{
  const cases = [];
  {
    const m = FULL(), s = FULL();
    m.p1.incineroar = body(0, true); m.p1.garchomp = body(0, true);   // we say p1 is wiped
    s.p2.kingambit = body(0, true); s.p2.whimsicott = body(0, true);  // the authority says p2 is
    cases.push(['DIFFERENT-WINNER', board(m, s, [])]);
  }
  {
    const m = FULL(), s = FULL();
    m.p1.incineroar = body(0, true);
    cases.push(['DIFFERENT-BODIES-ALIVE', board(m, s, [])]);
  }
  {
    const m = FULL(), s = FULL(); m.p2.kingambit = body(80);
    cases.push(['HP-BEYOND-A-TYPICAL-HIT',
      board(m, s, [{ side: 'p2', body: 'kingambit', field: 'hp', us: 80, sd: 200, maxhp: 200 }])]);
  }
  cases.push(['DIFFERENT-IDENTITY-ON-A-LIVE-BODY',
    board(FULL(), FULL(), [{ side: 'p2', body: 'kingambit', field: 'ability', us: 'defiant', sd: 'supremeoverlord' }])]);
  cases.push(['OTHER-STATE-DIFFERENCE',
    board(FULL(), FULL(), [{ side: 'p1', body: 'incineroar', field: 'status', us: 'brn', sd: '' }])]);
  cases.push(['SMALL-HP-OR-BOOST-ONLY',
    board(FULL(), FULL(), [{ side: 'p1', body: 'incineroar', field: 'boosts.atk', us: 1, sd: 0 }])]);
  const reached = new Set();
  for (const [want, b] of cases) {
    const got = ESS.severity(b, T);
    reached.add(got.band_id);
    if (got.band_id !== want) fail('rung ' + want + ' is unreachable — that board banded as ' + got.band_id);
    else pass('rung ' + got.band + ' ' + want + ' fires');
  }
  if (reached.size !== ESS.BANDS.length)
    fail('only ' + reached.size + ' of ' + ESS.BANDS.length + ' rungs were reached — an unreachable '
       + 'rung is a rung that will never report anything');
  else pass('all ' + ESS.BANDS.length + ' rungs reachable');

  /* THE ORDERING. A board with a death AND a stat stage AND a burn is a death. */
  const m = FULL(), s = FULL(); m.p1.incineroar = body(0, true);
  const mixed = ESS.severity(board(m, s, [
    { side: 'p1', body: 'garchomp', field: 'boosts.atk', us: 2, sd: 0 },
    { side: 'p2', body: 'kingambit', field: 'status', us: 'brn', sd: '' },
    { side: 'p1', body: 'incineroar', field: 'party.fainted', us: true, sd: false },
  ]), T);
  if (mixed.band_id !== 'DIFFERENT-BODIES-ALIVE')
    fail('a board carrying a death, a boost and a burn banded as ' + mixed.band_id + ' — the ladder is '
       + 'not ordered, so a severe finding can hide behind a cosmetic one');
  else pass('a board carrying a death, a boost and a burn bands as the death');

  /* AND THE OTHER DIRECTION: identity on a body that is DEAD in both engines is not the Soak class. */
  const dm = FULL(), ds = FULL();
  dm.p1.incineroar = body(0, true); ds.p1.incineroar = body(0, true);
  const corpse = ESS.severity(board(dm, ds, [
    { side: 'p1', body: 'incineroar', field: 'types', us: 'fire/dark', sd: 'water' },
  ]), T);
  if (corpse.band_id === 'DIFFERENT-IDENTITY-ON-A-LIVE-BODY')
    fail('a typing difference on a body dead in BOTH engines was banded as a live-body identity defect');
  else pass('identity on a body dead in both engines does not reach the identity rung ('
          + corpse.band_id + ')');
}

/* ================= PART 4 — THE THRESHOLD IS MEASURED, AND THE RULER IS NOT DOUBLE-COUNTED ====== */
console.log('\nPART 4 — no threshold, no ladder; and the |split| duplicate is stepped over');
{
  let threw = false;
  try { ESS.severity(board(FULL(), FULL(), []), {}); } catch (e) { threw = true; note(e.message); }
  if (!threw) fail('severity() accepted a run with NO MEASURED THRESHOLD — a default here is exactly '
                 + 'the picked number the ladder exists not to have');
  else pass('severity() refuses to band without a measured threshold');

  /* Showdown narrates every HP change twice: `|split|pX`, the exact figure, then the same event as a
   * percentage. Counting both halves the figure AND doubles the count, and both look like a ruler. */
  const log = [
    '|split|p1', '|switch|p1a: Incineroar|Incineroar, L50|200/200', '|switch|p1a: Incineroar|Incineroar, L50|100/100',
    '|split|p1', '|-damage|p1a: Incineroar|120/200', '|-damage|p1a: Incineroar|60/100',
    '|split|p1', '|-damage|p1a: Incineroar|20/200', '|-damage|p1a: Incineroar|10/100',
  ];
  const out = [], fails = {};
  ESS.collectHits(log, out, fails);
  if (out.length !== 2)
    fail('the collector recorded ' + out.length + ' hits where the log narrates 2 — the |split| '
       + 'duplicate is being counted (' + JSON.stringify(out) + ')');
  else pass('two narrated hits read as two: ' + out.map(x => (100 * x).toFixed(0) + '%').join(', '));
  if (Math.abs(out[0] - 0.40) > 1e-9 || Math.abs(out[1] - 0.50) > 1e-9)
    fail('the hit fractions are wrong: ' + JSON.stringify(out) + ', want [0.40, 0.50]');
  else pass('each hit is measured against the struck body\'s own maximum HP (40%, 50%)');
  if (!fails.splits_seen) fail('the |split| branch never fired — the parse is not doing what it says');
  else pass('the |split| branch fired ' + fails.splits_seen + ' time(s), so it is live rather than dead code');
  /* THE KILLING BLOW HAS NO DENOMINATOR, AND DROPPING IT BIASED THE RULER DOWNWARD. Showdown writes a
   * fainted body as `0 fnt` — no maximum at all — so a parse requiring `\d+/\d+` silently discarded
   * exactly the largest hits in the sample. Measured on one real game: 13 direct hits narrated, 8
   * reached the ruler, and the five missing were the knockouts. A ruler assembled from hits too small
   * to kill anybody is not a ruler for "a typical hit". */
  {
    const ko = [
      '|split|p1', '|switch|p1a: Sinistcha|Sinistcha, L50|146/146', '|switch|p1a: Sinistcha|Sinistcha, L50|100/100',
      '|split|p1', '|-damage|p1a: Sinistcha|0 fnt', '|-damage|p1a: Sinistcha|0 fnt',
    ];
    const o2 = [], f2 = {};
    ESS.collectHits(ko, o2, f2);
    if (o2.length !== 1)
      fail('THE KILLING BLOW WAS DROPPED FROM THE RULER — `0 fnt` carries no denominator and the parse '
         + 'discarded it, which removes the LARGEST hits from the sample and biases the median down. '
         + 'Got ' + o2.length + ' hits, want 1' + (f2.damage_line_unparsed ? ' (' + f2.damage_line_unparsed
         + ' unparsed)' : ''));
    else if (Math.abs(o2[0] - 1) > 1e-9)
      fail('a full-health body knocked out read as ' + o2[0] + ' of a health bar, want 1');
    else pass('a knockout written `0 fnt` resolves against the body\'s carried maximum: 100% of a bar');
  }
  const R = ESS.typicalHit(out, fails);
  if (Math.abs(R.median_fraction_of_max_hp - 0.45) > 1e-9)
    fail('the median of [0.40, 0.50] came back as ' + R.median_fraction_of_max_hp);
  else pass('the ruler is the median of what the AUTHORITY narrated: ' + R.median_fraction_of_max_hp);
}

/* ================= PART 5 — THE WHOLE PATH, THROUGH THE REAL DRIVER ============================= */
console.log('\nPART 5 — a planted faint must survive to the last board and band at the top, against a control');
const G = require(D('engine', 'game_differential.js'));
{
  if (typeof G.severity !== 'function' || typeof G.endBoard !== 'function')
    fail('the driver does not expose the ladder it bands with — a test driving a second copy would '
       + 'prove the copy works');
  else pass('the driver exposes engine/end_state_severity.js rather than a second copy');

  const PAIRS = G.pairsFor('baseline');
  if (!PAIRS.length) fail('no baseline pairs could be built — PART 5 did not run');
  else {
    /* WHY A PAIR WAS SKIPPED IS KEPT, NOT DISCARDED. "the plant was never placed" and "the ladder
     * cannot see a planted death" are different events and only the second condemns the ladder; a bare
     * COULD-NOT-STAGE has already cost this repository a diagnosis once. `threw` in particular means
     * the ENGINE is broken or mid-edit, which is a fact about another division and not about this file. */
    const skip = { threw: 0, no_final_board: 0, no_bench_body: 0, planted_threw: 0, first_error: null };
    let done = false;
    for (const pr of PAIRS.slice(0, 8)) {
      const clean = G.playGame(pr.a, pr.b, 'baseline', 'sev/control');
      if (clean.err) { skip.threw++; skip.first_error = skip.first_error || clean.err; continue; }
      if (!clean.finalBoard || !clean.finalBoard.parties) { skip.no_final_board++; continue; }
      let applied = false, victim = null;
      const planted = G.playGame(pr.a, pr.b, 'baseline', 'sev/planted', {
        /* THE PLANT KILLS A BENCH BODY, DELIBERATELY. Killing an ACTIVE one makes medicham2 ask for a
         * replacement that Showdown was never asked for, and the two engines then play different
         * games — which would catch the plant for the wrong reason. A bench body that is dead on one
         * side and standing on the other is the card-23 shape with nothing else moving. */
        statePlant: (S) => {
          if (applied) return;
          const b = (S.benchA || []).find(x => x && !x.fainted && x.curHP > 0);
          if (!b) return;
          b.curHP = 0; b.fainted = true; victim = b.name; applied = true;
        } });
      if (!applied) { skip.no_bench_body++; continue; }
      if (planted.err) { skip.planted_threw++; skip.first_error = skip.first_error || planted.err; continue; }
      const ruler = { hpThresholdFrac: 0.40 };
      const cs = clean.finalBoard ? G.severity(clean.finalBoard, ruler) : null;
      const ps = planted.finalBoard ? G.severity(planted.finalBoard, ruler) : null;
      note(pr.tag);
      note('the plant killed ' + victim + ' on our side only, at the first boundary it could');
      note('control  ' + (cs ? cs.band + ' ' + cs.band_id : 'NO FINAL BOARD'));
      note('planted  ' + (ps ? ps.band + ' ' + ps.band_id : 'NO FINAL BOARD'));
      if (!ps) { fail('the planted game produced no final board — nothing to band'); done = true; break; }
      if (ps.band_id !== 'DIFFERENT-BODIES-ALIVE' && ps.band_id !== 'DIFFERENT-WINNER')
        fail('THE PLANTED FAINT DID NOT REACH THE TOP OF THE LADDER — banded ' + ps.band_id
           + '. A comparator that cannot see a death it planted itself cannot be believed about zero.');
      else pass('the planted faint bands at ' + ps.band_id + ': ' + ps.why);
      /* THE CASCADE IS THE POINT, NOT A MISS. A body removed from one engine's team changes who gets
       * brought in next, so by the last board the set of bodies alive can differ on several members
       * that were never touched. That is precisely the card-23 mechanism — one wrong death, then a
       * replacement, then a different game — so the evidence naming OTHER bodies is the finding
       * behaving correctly and is printed rather than asserted away. */
      if (!ps.bodies.includes(String(victim || '').toLowerCase().replace(/[^a-z0-9]/g, '')))
        note('the evidence names ' + JSON.stringify(ps.bodies) + ' and the plant named ' + victim
           + ' — the plant CASCADED, which is the shape this ladder exists to catch');
      /* THE CONTROL, CLEARED EXPLICITLY. Without it the plant proves nothing — this pair might have
       * lost a body all by itself and the "catch" would be the game. */
      if (cs && (cs.band_id === 'DIFFERENT-BODIES-ALIVE' || cs.band_id === 'DIFFERENT-WINNER'))
        fail('THE CONTROL GAME ALREADY HAS A BODY ALIVE ON ONE SIDE ONLY (' + cs.band_id + ') — this '
           + 'fixture cannot prove the plant was caught. Choose another pair.');
      else pass('the control does not reach the top two rungs, so the catch is the plant');
      done = true; break;
    }
    if (!done) {
      note('pairs skipped: ' + JSON.stringify(skip));
      if (skip.threw || skip.planted_threw) {
        note('EVERY CANDIDATE GAME THREW IN THE ENGINE. That is a claim about the SIMULATOR, not about');
        note('this ladder — first error: ' + skip.first_error);
        note('Re-run against a frozen release:  node tests/test-end-state-severity.js --release <id>');
      }
      fail('PART 5 COULD NOT BE STAGED — see the reasons above. A comparator that has not been shown '
         + 'catching a planted death has proved nothing, so this is not a pass.');
    }
  }
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — the severity ladder is not trustworthy'
                             : 'ALL GREEN — the ladder catches what it says it catches and, just as '
                             + 'importantly, does not catch what it says it does not'));
process.exit(failures ? 1 : 0);
