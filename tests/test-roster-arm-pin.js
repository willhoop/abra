/* =================================================================================================
 *  tests/test-roster-arm-pin.js — DOES THE ARM A SCENARIO NAMES ACTUALLY REACH THE DICE?
 *
 *  USAGE:  SHOWDOWN_PATH=... node tests/test-roster-arm-pin.js [--release <id>]
 *
 *  WHY THIS FILE EXISTS, AND IT IS NOT A HYPOTHETICAL.
 *
 *  `tests/roster.js` declares `PRIMARY_ARM_ID = 'top-tie-first'` and every one of its rules is
 *  written against that corner: "the pin makes every sub-100 move miss", "no crit lands", "the
 *  maximum roll is the roll the pin selects". It passed `arm: undefined` for that arm and took the
 *  DRIVER'S default, which was `top-tie-first` until 2026-08-13 — when `engine/game_differential.js`
 *  prepended the `middle` arm to `ARMS` (commit cf7a2c5) and `PRIMARY_ARM = ARMS[0]` silently
 *  stopped meaning what the roster thought it meant. That commit's own message says the middle arm
 *  is "deliberately NOT in the default set". It was the default for every caller that omitted `arm`.
 *
 *  MEASURED, release 603d9a69d5a3, the arm resolution the ONLY difference:
 *      moves      157 FIRED-AND-BOARDS-DIFFER  ->    5        (25 DEFERRED -> 3, 298 MATCH -> 469)
 *      items        3                          ->    2
 *      abilities    8 + 1 DID-NOT-FIRE         ->    0 + 0
 *  162 of 169 accusations against the engine were this instrument. Every row still printed
 *  `arm: "top-tie-first"`, which is why nothing could see it: A LABEL IS NOT A RECEIPT.
 *
 *  WHAT THIS FILE ASKS, and each part is a different question:
 *    §1  at the DRIVER — a constant die cannot produce a varying number. Six identical clicks on one
 *        staged board must deal identical damage under a named corner, and must NOT under `middle`.
 *        The middle row is the OVER-FIRE CONTROL: without it this file would pass on an engine whose
 *        damage never varies at all.
 *    §2  at the ROSTER — the arm object that reached the driver, counted per id by `ARM_PLAYED` and
 *        published as `arms_played`. No `DRIVER-DEFAULT:` key may appear, and every arm a compared
 *        row DECLARED must appear as a key.
 *    §3  the RED demonstration — §2 re-run under `ROSTER_ARM_FALLS_THROUGH=1` MUST fail. A check
 *        that has never been red is not evidence.
 *
 *  WHAT IT CANNOT SEE: whether an arm's dice are the RIGHT dice (that is `PIN_CLAIMS`, asserted in
 *  `game_differential.js`), and every OTHER caller of `playGame` that omits `arm` —
 *  `tests/staged_board.js` and nine `tests/probe_*.js` files are in exactly the position the roster
 *  was in, and this file says nothing about them.
 * ================================================================================================= */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);

const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open(ARG('--release') || null);
if (!process.argv.includes('--release')) process.argv.push('--release', REL.id);
if (!process.argv.includes('--state')) process.argv.push('--state');

let FAILED = 0;
/* THE DETAIL IS THE FAILURE'S EXPLANATION AND IS PRINTED ONLY WHEN IT FAILS. Printed under a green
 * line it reads as a contradiction — "ok … the flag produced no DRIVER-DEFAULT row" was on screen
 * for one run and says the opposite of what happened. Anything worth seeing on a PASS is printed by
 * the section itself, above the clause. */
const ok = (w, cond, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + w + (!cond && detail ? '\n          ' + detail : ''));
  if (!cond) FAILED++;
};

console.log('\ntests/test-roster-arm-pin.js — the arm a scenario names must reach the dice');
console.log('  engine release ' + REL.id);

/* ---- §0 THE PREMISE, DERIVED FROM THE DRIVER RATHER THAN REMEMBERED ---------------------------- */
const SB = require(D('tests', 'staged_board.js'));
const G = SB.harness(null);
const ARM_IDS = [...G.ARM_BY_ID.keys()];
console.log('\n  §0  what game_differential.js publishes');
console.log('        arms         ' + ARM_IDS.join(', '));
console.log('        PRIMARY_ARM  ' + (G.PRIMARY_ARM ? G.PRIMARY_ARM.id : '(not exported)')
  + (G.PRIMARY_ARM && G.PRIMARY_ARM.id !== 'top-tie-first'
      ? '   <-- NOT top-tie-first. Any caller that omits `arm` is on THIS arm, whatever it believes.'
      : ''));
ok('the two corner arms this file needs are published',
   ARM_IDS.includes('top-tie-first') && ARM_IDS.includes('bottom-tie-first'),
   'published: ' + ARM_IDS.join(', '));
ok('the middle arm is published, so the over-fire control in §1 can run', ARM_IDS.includes('middle'));

/* ---- THE FIXTURE, DERIVED ---------------------------------------------------------------------
 * A body whose ability registers NO `on*` key at all cannot interfere with a damage number, and a
 * move with no secondary, no drain, no recoil, no multi-hit and 100 accuracy is a bare damage roll.
 * Both are read off the format on every run; nothing here is a name somebody typed. */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = (x) => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const quietAbility = (name) => { const a = dex.abilities.get(name);
  return !!(a && a.exists && !Object.keys(a).some(k => /^on/.test(k))); };
const BODIES = dex.species.all().filter(legal)
  .map(sp => ({ sp, ab: Object.values(sp.abilities || {}).find(quietAbility) }))
  .filter(r => r.ab)
  .sort((a, b) => (b.sp.baseStats.hp + b.sp.baseStats.def + b.sp.baseStats.spd)
                - (a.sp.baseStats.hp + a.sp.baseStats.def + a.sp.baseStats.spd));
const BARE = dex.moves.all().filter(m => legal(m) && m.basePower > 0 && m.accuracy === true
    && !(m.secondaries && m.secondaries.length) && !m.multihit && !m.drain && !m.recoil
    && !m.boosts && !m.self && (m.priority || 0) === 0 && m.target === 'normal'
    && !m.basePowerCallback && !(m.critRatio > 1) && !m.willCrit && !(m.flags && m.flags.charge))
  .sort((a, b) => a.basePower - b.basePower);
if (BODIES.length < 2 || !BARE.length) {
  console.log('  FAIL  the fixture could not be DERIVED from the format: ' + BODIES.length
    + ' quiet-ability bodies, ' + BARE.length + ' bare damaging moves');
  process.exit(1);
}
/* THE HIGHEST-POWER BARE CLICK, because the band has to be WIDE ENOUGH TO VARY for §1's control to
 * mean anything: a 16-index band on a 5 HP hit can collapse to one value and the middle arm would
 * then look pinned. The width is asserted rather than assumed — see the control clause. */
const CLICK = BARE[BARE.length - 1];
const mon = (sp, ab, moves) => ({ species: sp, item: '', ability: ab, moves });
const FILLER = BODIES.slice(0, 6);
console.log('        fixture      ' + FILLER[0].sp.name + ' clicks ' + CLICK.name
  + ' (' + CLICK.type + ' ' + CLICK.basePower + ' BP, accuracy ' + CLICK.accuracy + ', no secondary) at '
  + FILLER[1].sp.name);

const side = (lead, leadMoves) => {
  const rows = [mon(lead.sp.id, lead.ab, leadMoves)];
  for (const r of FILLER) { if (rows.length >= 4) break; if (rows.some(x => x.species === r.sp.id)) continue;
                            rows.push(mon(r.sp.id, r.ab, [CLICK.id])); }
  return rows;
};
const TURNS = 6;
function damageUnder(armId) {
  const a = G.buildPair(side(FILLER[0], [CLICK.id]), { hpBoost: 8 });
  const b = G.buildPair(side(FILLER[1], [CLICK.id]), { hpBoost: 8 });
  if (!a || !b) return { bad: 'buildPair returned null — the fixture never ran' };
  const script = [];
  /* SLOT b AIMS AT SLOT b. Both bodies aiming at `t: 0` puts TWO hits per turn on p2a, and the
   * alternating pair that produces reads exactly like an unpinned die — it was the first version of
   * this file and it failed both corner arms for a reason that had nothing to do with the pin. */
  for (let i = 0; i < TURNS; i++) script.push({ p1: [{ m: CLICK.id, t: 0 }, { m: CLICK.id, t: 1 }],
                                                p2: [{ m: CLICK.id, t: 0 }, { m: CLICK.id, t: 1 }] });
  const r = G.playGame(a, b, 'directed', 'armpin:' + armId, { script, arm: G.ARM_BY_ID.get(armId),
    onBoundary: (snap) => { snap.identical = true; snap.diffs = []; } });
  if (r.err) return { bad: 'the game threw: ' + r.err };
  /* KEYED TO ONE VICTIM SLOT. Four bodies clicking means four damage streams, and a pooled list
   * would call two different targets' numbers a variation. `p2a` is the slot side A's lead aims at. */
  const missing = [];
  for (const l of (r.mediTrace || [])) {
    const m = /^\|-damage\|p2a: [^|]+\|(\d+)\/(\d+)/.exec(String(l));
    if (m) missing.push(+m[2] - +m[1]);
  }
  const per = missing.map((v, i) => (i === 0 ? v : v - missing[i - 1]));
  return { per, distinct: [...new Set(per)] };
}

console.log('\n  §1  a CONSTANT die cannot produce a varying number');
const seen = {};
for (const armId of ['top-tie-first', 'bottom-tie-first', 'middle']) {
  const r = damageUnder(armId);
  if (r.bad) { ok(armId + ': the fixture ran', false, r.bad); continue; }
  seen[armId] = r;
  console.log('        ' + armId.padEnd(18) + r.per.join(' ') + '   (' + r.distinct.length + ' distinct)');
  ok(armId + ': the click landed on every one of the ' + TURNS + ' scripted turns', r.per.length === TURNS,
     'saw ' + r.per.length + ' damage lines at p2a — a fixture that stopped hitting proves nothing');
}
for (const armId of ['top-tie-first', 'bottom-tie-first']) {
  const s = seen[armId];
  ok(armId + ': every one of the ' + TURNS + ' identical clicks deals the SAME damage',
     !!s && s.distinct.length === 1,
     s ? 'distinct per-hit values: ' + s.distinct.join(', ') + ' — a corner arm pins the damage index, '
         + 'so more than one value means the pin never reached the engine' : 'the arm did not run');
}
ok('CONTROL: the same script under `middle` DOES vary — otherwise this file is asking nothing',
   !!seen.middle && seen.middle.distinct.length > 1,
   seen.middle ? 'distinct per-hit values under middle: ' + seen.middle.distinct.join(', ')
     + ' — one value here means the band is too narrow to detect an unpinned die and §1 is vacuous'
     : 'middle did not run');

/* ---- §2 / §3 THE ROSTER'S OWN RECEIPT ----------------------------------------------------------
 * The ITEMS stage, because it is the fastest of the three and it exercises both the primary arm and
 * the scenario-declared one. A child process, because the flag is read at load. */
function rosterArms(env) {
  let out;
  try {
    out = execFileSync(process.execPath,
      [D('tests', 'roster.js'), '--stage', 'items', '--release', REL.id, '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 28, env: Object.assign({}, process.env, env || {}),
        stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    /* A NON-ZERO EXIT IS THE ROSTER'S VERDICT, NOT A CRASH. It exits 1 whenever any row DIFFERS,
     * which is most of the time and is exactly the state this file has to be able to read — treating
     * it as a failure made §2 and §3 both red on a run that had produced a perfectly good artifact.
     * The stdout is still the artifact; only a stdout with no JSON in it is a real failure, and then
     * the CHILD'S OWN WORDS are printed rather than execFileSync's "Command failed" summary. */
    out = String(e.stdout || '');
    if (out.indexOf('\n{') < 0) {
      throw new Error('the roster child exited ' + e.status + ' and wrote no JSON'
        + '\n--- its stderr ---\n' + String(e.stderr || '').slice(-1500)
        + '\n--- its last stdout ---\n' + out.slice(-600));
    }
  }
  const j = JSON.parse(out.slice(out.indexOf('\n{') + 1));
  return { played: j.arms_played || {},
           declared: [...new Set(j.results.filter(r => /FIRED|DID-NOT-FIRE|CONTROL-NOT-QUIET/.test(r.verdict))
                                           .map(r => r.arm))] };
}
console.log('\n  §2  the arm that reached the driver, off the roster\'s own receipt');
let clean = null;
try { clean = rosterArms({ ROSTER_ARM_FALLS_THROUGH: '0' }); }
catch (e) { ok('the roster items stage ran', false, String(e.message).slice(0, 300)); }
if (clean) {
  console.log('        arms_played  ' + JSON.stringify(clean.played));
  console.log('        declared     ' + clean.declared.join(', '));
  const fell = Object.keys(clean.played).filter(k => k.startsWith('DRIVER-DEFAULT:'));
  ok('no scenario took the driver\'s default arm', fell.length === 0,
     fell.length ? 'fell through on: ' + fell.join(', ') : '');
  ok('every arm a compared row DECLARED was actually played',
     clean.declared.every(d => Object.prototype.hasOwnProperty.call(clean.played, d)),
     'declared ' + JSON.stringify(clean.declared) + ' played ' + JSON.stringify(Object.keys(clean.played)));
  ok('every arm played is one game_differential.js publishes',
     Object.keys(clean.played).every(k => ARM_IDS.includes(k)));
}

console.log('\n  §3  the RED demonstration — the same check under ROSTER_ARM_FALLS_THROUGH=1');
let red = null;
try { red = rosterArms({ ROSTER_ARM_FALLS_THROUGH: '1' }); }
catch (e) { ok('the red arm ran', false, String(e.message).slice(0, 300)); }
if (red) {
  console.log('        arms_played  ' + JSON.stringify(red.played));
  const fell = Object.keys(red.played).filter(k => k.startsWith('DRIVER-DEFAULT:'));
  ok('the restored defect IS caught by §2\'s check — a check that cannot go red is not evidence',
     fell.length > 0, 'the flag produced no DRIVER-DEFAULT row, so either the flag is dead or the '
     + 'receipt is not reading the object that was handed over');
}

console.log('\n' + (FAILED ? '  ' + FAILED + ' FAILED' : '  all clauses pass'));
process.exit(FAILED ? 1 : 0);
