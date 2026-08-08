/* test-pin-arms.js — THE RED DEMONSTRATION FOR THE FOUR PINNED ARMS. ROADMAP #88.
 *
 *   SHOWDOWN_PATH=... node tests/test-pin-arms.js
 *
 * ONE PIN IS ONE CORNER. Until 2026-08-07 `engine/game_differential.js` held exactly one, and every
 * number it ever produced describes that corner: max damage, every sub-100-accuracy move missing on
 * both sides, and a speed tie resolved one way. Four arms now exist. This file is the demonstration
 * that they are ARMS and not four names for the same run.
 *
 * THE ORDER OF THE PARTS IS THE POINT, and it is the discipline docs/LESSONS.md asks for:
 *
 *   1  THE CONTROL, CLEARED EXPLICITLY. The same staged game under the same arm twice must produce
 *      IDENTICAL output. Without this, every difference in part 2 could be run-to-run noise.
 *   2  THE KNOB IS WIRED. Identical results across a varied knob mean the knob is UNWIRED, not that
 *      it does not matter — so each axis must be shown CHANGING something, by name.
 *   3  THE PIN MEANS THE SAME THING ON BOTH SIDES. A pin that moves one engine and not the other is
 *      CHANGELOG 3.45.0 repeating: every sub-100 move missed in one engine and hit in the other.
 *   4  THE PIN SET IS A RUN PARAMETER and a pair of arms pinned differently is REFUSED.
 *
 * WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE". A divergence is a FINDING. This file goes red
 * when the INSTRUMENT is wrong — when an arm does not exist, does not differ, or differs on one side
 * only.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

const G = require(D('engine', 'game_differential.js'));
const ARM = id => { const a = G.ARM_BY_ID.get(id); if (!a) throw new Error('no such arm: ' + id); return a; };

/* A staged board is a FIXTURE, exactly as docs/GAME-DIFFERENTIAL-DESIGN.md §6 and the DIRECTED table
 * in the driver are: "a pure speed tie" is a specific pair of bodies and cannot be derived from a tag.
 * Volcarona and Charizard are both 100 base Speed and both engines build Serious / 0 EV / 31 IV, so
 * their Speed is 120 EXACTLY on both sides — the tie is a fact of the fixture, not a hope. */
const st = r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] });
const BENCH = (...n) => n.map(x => st([x, '', '', ['Protect']]));

const TIE_A = [st(['volcarona', '', 'Flame Body', ['Bug Buzz', 'Protect']])].concat(BENCH('clefable', 'milotic', 'snorlax'));
const TIE_B = [st(['charizard', '', 'Blaze', ['Flamethrower', 'Protect']])].concat(BENCH('toxapex', 'corviknight', 'garchomp'));
const TIE_SCRIPT = [{ p1: [{ m: 'bugbuzz', t: 0 }, { m: 'protect' }],
                      p2: [{ m: 'flamethrower', t: 0 }, { m: 'protect' }] }];

/* A 90-accuracy move, staged so the miss path and the hit path are the SAME board. Rock Slide is the
 * move the staged-board agent watched silently miss four times on 2026-08-07 while reporting
 * "identical".
 *
 * THE TARGETS CLICK AGILITY AND NOT PROTECT, and the first version of this fixture got it wrong in
 * exactly the way the driver's own `TAKE_IT` comment warns about: with both foes shielding, Rock Slide
 * hit nothing in EITHER arm and the demonstration reported the pin unwired when what was unwired was
 * the fixture. A body taking a staged hit must still click something legal, and Protect blocks the
 * very hit being staged. Agility resolves at priority 0 and moves no stat any damage formula here
 * reads. */
const ACC_TAKE = ['Agility', 'Protect'];
const ACC_A = [st(['garchomp', '', 'Rough Skin', ['Rock Slide', 'Protect']])].concat(BENCH('clefable', 'milotic', 'weavile'));
const ACC_B = [st(['snorlax', '', 'Thick Fat', ACC_TAKE]), st(['corviknight', '', 'Pressure', ACC_TAKE])]
  .concat(BENCH('toxapex', 'milotic'));
const ACC_SCRIPT = [{ p1: [{ m: 'rockslide' }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'agility' }] }];

function play(A, B, script, armId) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return null;
  const r = G.playGame(a, b, 'directed', 'pin-arms/' + armId, { script, arm: ARM(armId) });
  return {
    diverged: !!r.div, at: r.div ? r.div.index : null, cls: r.div ? G.classify(r.div).cls : null,
    sdAtDiv: r.div ? r.div.sdRaw : null, meAtDiv: r.div ? r.div.meRaw : null,
    order: r.mediTrace.filter(l => /^\|move\|/.test(l)).map(l => String(l).split('|')[2].slice(0, 3)),
    trace: r.mediTrace,
    err: r.err,
  };
}
const has = (t, re) => t.some(l => re.test(String(l)));

/* ================= PART 0 — THE ARMS EXIST AND EVERY CLAIM THEY MAKE HOLDS ====================== */
console.log('\nPART 0 — four arms, and every behavioural claim each one makes');
if (G.ARMS.length !== 4) fail('there are ' + G.ARMS.length + ' arms, not 4');
else pass('four arms: ' + G.ARMS.map(a => a.id).join(', '));
{
  let bad = 0;
  for (const a of G.ARMS) for (const [what, f] of G.PIN_CLAIMS_BY_ARM.get(a.id))
    if (!f()) { bad++; fail('the pin claims "' + what + '" and it is false'); }
  if (!bad) pass(G.PIN_CLAIMS.length + ' behavioural pin claims hold across the four arms');
  /* EVERY ARM NEEDS ITS OWN ROWS. An arm added without claims is a pin nobody has checked, which is
   * the shape the single old pin had for the tie and the accuracy. */
  for (const a of G.ARMS) {
    const n = G.PIN_CLAIMS_BY_ARM.get(a.id).length;
    if (n < 8) fail('arm ' + a.id + ' declares only ' + n + ' claims — a new pin with no new rows is unchecked');
  }
}

/* ================= PART 1 — THE CONTROL, CLEARED EXPLICITLY ===================================== */
console.log('\nPART 1 — THE CONTROL. The same arm twice on the same staged game is IDENTICAL.');
{
  const a1 = play(TIE_A, TIE_B, TIE_SCRIPT, 'top-tie-first');
  const a2 = play(TIE_A, TIE_B, TIE_SCRIPT, 'top-tie-first');
  if (!a1 || !a2) fail('the staged tie could not be built at all');
  else if (JSON.stringify(a1.trace) !== JSON.stringify(a2.trace))
    fail('two runs of the SAME arm produced different streams — the instrument is not deterministic '
       + 'and nothing below can be attributed to a pin');
  else pass('two runs of top-tie-first are byte-identical (' + a1.trace.length + ' lines), so a '
       + 'difference below is the pin and not noise');
}

/* ================= PART 2 — THE KNOB IS WIRED, ONE AXIS AT A TIME =============================== */
console.log('\nPART 2 — each axis CHANGES something. Identical results across a varied knob mean the');
console.log('         knob is unwired, not that it does not matter.');

/* --- the speed tie --- */
{
  const first = play(TIE_A, TIE_B, TIE_SCRIPT, 'top-tie-first');
  const second = play(TIE_A, TIE_B, TIE_SCRIPT, 'top-tie-second');
  const atk = r => r.order.filter(x => /a$/.test(x));   // the two attackers, in the order they moved
  if (!first || !second) fail('the staged tie could not be built');
  else if (JSON.stringify(atk(first)) === JSON.stringify(atk(second)))
    fail('THE TIE AXIS IS UNWIRED: both arms resolved the staged 120-vs-120 tie the same way ('
       + atk(first).join(' then ') + '). Either the fixture is not a tie or the medicham tie sequence '
       + 'is not reaching sortTurnOrder.');
  else {
    pass('the staged tie resolves the OTHER way: top-tie-first ' + atk(first).join(' then ')
       + ', top-tie-second ' + atk(second).join(' then '));
    /* THE FINDING, ASSERTED SO IT CANNOT REGRESS SILENTLY. Under the arm that WAS the whole
     * instrument the two engines disagree about this tie; under the other arm they agree. That is the
     * opposite of what the driver's header claimed for the life of the file, and if it ever stops
     * being true this test should say so rather than quietly pass. */
    if (first.diverged && first.cls === 'ordering' && !second.diverged) {
      pass('AND THE FINDING HOLDS: under top-tie-first the two engines DISAGREE about who moves first '
         + '(class "ordering", line ' + first.at + '); under top-tie-second they AGREE for the whole turn.');
      note('showdown  ' + first.sdAtDiv);
      note('medicham  ' + first.meAtDiv);
      note('Showdown gives the tie to the LATER body in input order and PRNG.shuffle is not what '
         + 'decides it; medicham2 gives it to the EARLIER one. This is an ENGINE finding, filed, not '
         + 'fixed here — engine/game_differential.js does not own medicham2.');
    } else {
      note('the two arms differ, but not in the shape recorded on 2026-08-07 (first: '
         + (first.diverged ? 'diverges ' + first.cls : 'agrees') + ', second: '
         + (second.diverged ? 'diverges ' + second.cls : 'agrees') + '). Re-read the driver header '
         + 'before quoting either arm.');
    }
  }
}

/* --- the accuracy corner --- */
{
  const top = play(ACC_A, ACC_B, ACC_SCRIPT, 'top-tie-first');
  const bot = play(ACC_A, ACC_B, ACC_SCRIPT, 'bottom-tie-first');
  if (!top || !bot) fail('the staged 90-accuracy move could not be built');
  else {
    const topMissed = has(top.trace, /^\|-miss\|/);
    const botMissed = has(bot.trace, /^\|-miss\|/);
    const botHit = has(bot.trace, /^\|-damage\|/);
    if (!topMissed)
      fail('the TOP arm did not miss the 90-accuracy move. That arm is defined by every sub-100 move '
         + 'missing on both sides; if it connected, the accuracy pin is not what the header says.');
    else if (botMissed)
      fail('THE ACCURACY AXIS IS UNWIRED: the BOTTOM arm also emitted a -miss. Rock Slide has never '
         + 'connected in this instrument and it still has not.');
    else if (!botHit)
      fail('the BOTTOM arm neither missed nor damaged anything — the scenario is staging nothing, '
         + 'which is exactly the failure four of six demos hit on 2026-08-07.');
    else pass('the 90-accuracy move MISSES in top-tie-first and CONNECTS in bottom-tie-first — the '
         + 'hit path of a sub-100-accuracy move runs for the first time in this instrument');
  }
}

/* --- the damage corner --- */
{
  const top = play(ACC_A, ACC_B, ACC_SCRIPT, 'top-tie-first');
  const bot = play(ACC_A, ACC_B, ACC_SCRIPT, 'bottom-tie-first');
  /* A GUARANTEED CRIT IS THE BOTTOM CORNER'S SIGNATURE, and it is a cleaner witness than a damage
   * number because a number can coincide. medicham2 crits when `rng() < rate`, Showdown when
   * `random(den) < 1`; both are true at the bottom and false at the top. */
  if (top && bot) {
    const topCrit = has(top.trace, /^\|-crit\|/), botCrit = has(bot.trace, /^\|-crit\|/);
    if (topCrit) fail('the TOP arm CRIT. `randomChance(1, 24)` must be false there.');
    else if (!botCrit)
      fail('THE DAMAGE/CRIT CORNER IS UNWIRED: the BOTTOM arm did not crit either, so the 15 of 16 '
         + 'damage rolls this arm exists to reach are still unreached. (medicham2 must emit |-crit|; '
         + 'if it does not, this witness is wrong and needs replacing, not deleting.)');
    else pass('every crit lands in bottom-tie-first and none in top-tie-first — the two damage '
         + 'endpoints are genuinely different games');
  }
}

/* ================= PART 3 — THE PIN MEANS THE SAME THING ON BOTH SIDES ========================== */
console.log('\nPART 3 — a pin that moves ONE engine is CHANGELOG 3.45.0 repeating.');
{
  /* The two dice are one function by construction; asserted over a table rather than trusted. */
  let bad = 0;
  for (const a of G.ARMS)
    for (const [n, d] of [[100, 100], [95, 100], [90, 100], [50, 100], [30, 100], [1, 24], [1, 8], [1, 3], [1, 2]])
      if (a.chance(n, d) !== (a.random(d) < n)) { bad++; fail(a.id + ': randomChance and random are different dice at (' + n + ', ' + d + ')'); }
  if (!bad) pass('in every arm randomChance IS random(den) < num, at every rate a battle asks about');

  /* THE SLEEP DURATION IS THE CONTROL FOR THE TIE PIN. `random(2,5)` is the range form and it is NOT
   * the speed-tie resolver; if an arm moved it, that arm would differ from the baseline in a second
   * way and no difference between the two could be attributed. */
  const sleeps = G.ARMS.map(a => a.random(2, 5));
  if (new Set(sleeps).size !== 1 || sleeps[0] !== 2)
    fail('the arms disagree about `random(2,5)` — THE SLEEP DURATION — (' + sleeps.join(', ')
       + '). The tie pin has leaked into the range form.');
  else pass('every arm reads `random(2,5)` as 2, so the sleep duration is a CONTROL and the arms '
       + 'differ in one thing');

  /* THE BOTTOM ARM'S HIT MUST BE EVENT FOR EVENT, not merely "both hit". medicham2 SKIPS the accuracy
   * check at acc >= 100 and Showdown always calls randomChance; the pin has to make the outcome the
   * same for every accuracy from 1 to 100 or the two streams part on a `-miss`. */
  for (const a of G.ARMS.filter(x => !x.top)) {
    const wrong = [];
    for (let acc = 1; acc <= 100; acc++) if (a.chance(acc, 100) !== true) wrong.push(acc);
    if (wrong.length) fail(a.id + ': a move at accuracy ' + wrong.slice(0, 5).join(', ') + ' does NOT hit');
    else pass(a.id + ': every accuracy from 1 to 100 HITS, so no -miss is emitted on either side');
  }
  for (const a of G.ARMS.filter(x => x.top)) {
    const wrong = [];
    for (let acc = 1; acc < 100; acc++) if (a.chance(acc, 100) !== false) wrong.push(acc);
    if (a.chance(100, 100) !== true) wrong.push(100);
    if (wrong.length) fail(a.id + ': accuracy ' + wrong.slice(0, 5).join(', ') + ' behaves wrongly');
    else pass(a.id + ': every accuracy below 100 MISSES and 100 hits, on both sides');
  }

  /* THE TIE SEQUENCE MUST BE INVISIBLE TO EVERYTHING EXCEPT THE TIE. If one of its values crossed a
   * threshold the arm would differ in accuracy or damage as well and the tie measurement would be
   * contaminated by it. */
  for (const a of G.ARMS.filter(x => x.tieToSecondBody)) {
    const r = a.mediRng(); const c = a.corner; let bad2 = 0, prev = -1;
    for (let i = 0; i < 5000; i++) {
      const v = r();
      if (!(v > prev)) bad2++;
      prev = v;
      if (v >= 1 || v < 0) bad2++;
      if (Math.floor(v * 16) !== Math.floor(c * 16)) bad2++;
      if ((v * 100 > 90) !== (c * 100 > 90)) bad2++;
      if ((v < 1 / 24) !== (c < 1 / 24)) bad2++;
    }
    if (bad2) fail(a.id + ': the tie sequence is not behaviour-neutral (' + bad2 + ' violations in 5000 draws)');
    else pass(a.id + ': 5000 draws of the tie sequence are strictly increasing AND give the same '
       + 'answer as the constant corner at every threshold');
  }
}

/* ================= PART 4 — THE PIN SET IS A RUN PARAMETER AND A MISMATCH IS REFUSED ============ */
console.log('\nPART 4 — two arms pinned differently are NOT a before/after, and it must be REFUSED.');
{
  const AC = require(D('engine', 'arms_comparable.js'));
  const base = () => ({ games: 45, turns_cap: 12, mode: G.MODE,
    pins: { digest: G.PIN_DIGEST, arms_run: G.PINS.arms_run },
    steering: { policy: 'census-coverage-seeking/v1', input: 'data/mechanics-census.json',
                input_digest: 'aaaaaaaaaaaa', input_rows: 299, team_pool_digest: 'bbbbbbbbbbbb' } });
  const same = AC.compare(base(), base());
  if (!same.ok) fail('THE CONTROL FAILED: two artifacts with the SAME pin set are reported as not '
       + 'comparable (' + same.reasons.join('; ') + '). Everything below would then be vacuous.');
  else pass('THE CONTROL: two artifacts with the same pin set ARE comparable');

  const other = base(); other.mode = 'A/top-tie-first/pins:deadbeefcafe/credit:observed-effect/v1';
  const diff = AC.compare(base(), other);
  if (diff.ok) fail('arms_comparable ACCEPTED a pair whose pin sets differ. `mode` carries the pin '
       + 'digest exactly so this cannot happen — a die pinned to max damage and one pinned to min '
       + 'damage answer different questions.');
  else pass('arms_comparable REFUSES a pair whose pin sets differ: ' + diff.reasons.join('; '));

  /* AND THE OLD ARTIFACTS FAIL CLOSED. Every run before 2026-08-07 wrote `mode: "A"` with no pin
   * digest; the honest verdict for those is "nothing recorded which corner it measured". */
  const old = base(); old.mode = 'A'; delete old.pins;
  const vsOld = AC.compare(old, base());
  if (vsOld.ok) fail('an artifact from before the arms existed was accepted as comparable with one '
       + 'from after. It declares no pin set at all.');
  else pass('a pre-2026-08-07 artifact (mode "A", no pins block) is NOT comparable with a new one');

  if (!/pins:/.test(G.MODE)) fail('`mode` does not carry the pin digest: ' + G.MODE);
  else if (!/credit:/.test(G.MODE)) fail('`mode` does not carry the credit-rule version: ' + G.MODE);
  else pass('mode = ' + G.MODE);
}

console.log('\n' + (failures
  ? failures + ' FAILURE(S) — the INSTRUMENT is wrong, which is the only thing this file fails on'
  : 'ALL PASSED — four arms exist, each axis is wired, each pin means the same thing on both sides,\n'
  + 'and a pair pinned differently is refused. What the arms FOUND is in data/game-differential.json.'));
process.exit(failures ? 1 : 0);
