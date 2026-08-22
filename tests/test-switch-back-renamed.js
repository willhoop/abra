/* test-switch-back-renamed.js — CAN A BODY THAT WAS RENAMED MID-BATTLE BE SWITCHED BACK IN?
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/test-switch-back-renamed.js
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/test-switch-back-renamed.js --json
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * ROADMAP #204 was routed as "three formes have no body to become, and it blocks a 10-game divergence
 * family". The forme rows were the right fix for the forme instrument and they are NOT the cause of
 * the divergence family — that link is REFUTED here, with a control, and this file is what replaces
 * it.
 *
 * The card is `data/divergence-turns.json`, the `middle` arm of seed
 * `gen9championsvgc2026regmbbo3-2655542565`, class `event missing from medicham2`:
 *
 *     SHOWDOWN  |switch|p2b: Morpeko|Morpeko, L50|133/133   then  |switch|p2a: Espathra|...
 *     MEDICHAM  |switch|p2a: Espathra|espathra, L50|170/170        (and nothing at all for p2b)
 *
 * It reads as a switch ORDER divergence and it is not one: medicham2 never emits that line, because
 * medicham2 never performs that switch. Its own roster dump in the same card carries the answer —
 * a bench body named `morpekohangry` with `key: null`.
 *
 * ================= THE TWO INDEPENDENT CAUSES, EITHER OF WHICH ALONE PRODUCES IT ================
 *
 *   C1  ENGINE.      A NON-PERMANENT forme change is not reverted when the body leaves the field.
 *                    `Pokemon#formeChange` takes an `isPermanent` flag; Hunger Switch passes nothing,
 *                    so Showdown's `clearVolatile` puts Morpeko-Hangry back to Morpeko on the way out.
 *                    medicham2 keeps the flipped name on the bench. MEASURED at PART 3 below:
 *                    authority bench `morpeko`, ours `morpeko-hangry`, same board, same boundary.
 *
 *   C2  INSTRUMENT.  `engine/game_differential.js` stamps `_switchKey` in `buildPair` (:2213) — the
 *                    IMMUTABLE base-species key both engines are asked by — precisely so that a
 *                    rename cannot orphan a body. Its own comment says so: *"After the rename
 *                    `id(x.name)` is `mimikyubusted` while `switchTo` still says `mimikyu`, so THAT
 *                    BODY CAN NEVER BE SWITCHED TO AGAIN."* But `freshBodies` (:2362) — which is what
 *                    every PLAYED game is built from — rebuilds through `M.buildMon` and does not
 *                    carry the stamp, so the fix never reached the bodies that play. The resolver
 *                    falls through to `id(x.name)`, misses, and answers `pass`.
 *
 * One fact, two construction paths, one of them fixed: the shape CLAUDE.md's facts-are-global rule
 * names, arriving in the instrument rather than in the engine.
 *
 * ================= AND A THIRD SHAPE, WHICH IS NOT THE SAME AND SAYS SO =========================
 *
 * A MEGA is a PERMANENT rename and does not revert, so BOTH engines hold `abomasnow-mega` on the
 * bench while the driver's ask still says `abomasnow`. The Showdown branch matches on
 * `id(q.species.id)` (:3436) and therefore misses too — `SWITCH_LOOKUP_MISS.sd` — and the game does
 * not diverge quietly, it THROWS: *p1 choice rejected "pass, switch 4": Can't pass: Your Espathra must
 * make a move (or switch)*. Restamping `_switchKey` does NOT clear it, which is the measurement that
 * proves it is a different defect and not this one wearing a hat. PART 4.
 *
 * ================= WHAT THIS FILE STRUCTURALLY CANNOT SEE =======================================
 *
 * How OFTEN either shape is reached in a real differential run. It is four staged boards, not a
 * sweep; the population question belongs to `engine/game_differential.js`'s own counters
 * (`SWITCH_LOOKUP_MISS`), which this file does not read because they are not exported.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const SB = require(D('tests', 'staged_board.js'));
const JSONOUT = process.argv.includes('--json');
const say = (...a) => { if (!JSONOUT) console.log(...a); };

const INERT = 'focusenergy';
const mk = (species, ability, moves, item) =>
  ({ species, item: item || '', ability, moves: (moves || []).concat([INERT]), nature: 'Serious' });
const idle = () => ({ m: INERT });
const FOES = [mk('Blastoise', 'Torrent', []), mk('Vivillon', 'Shield Dust', []),
              mk('Weavile', 'Pressure', []), mk('Corviknight', 'Pressure', [])];

/* THE CONTROL IS ON THE SAME BOARD AND THE SAME TURN, and that is the whole design. Dragonite leaves
 * and returns beside the subject, under the identical ask, and nothing ever renames it. A subject
 * that fails while the control succeeds cannot be blamed on the script, the harness or the turn. */
const CONTROL = 'dragonite';

/* ---- THE ARMS ---------------------------------------------------------------------------------- */
const ARMS = [
  { id: 'hungerswitch', subject: 'morpeko', ask: 'morpeko',
    what: 'Morpeko is renamed to Morpeko-Hangry by a RESIDUAL, leaves, and is asked back by the name '
        + 'the driver names every candidate by — its base species.',
    lead: mk('Morpeko', 'Hunger Switch', ['Aura Wheel']), trigger: null },
  { id: 'hungerswitch-restamped', subject: 'morpeko', ask: 'morpeko', restamp: true,
    what: 'THE SUFFICIENCY ARM. Identical board, with the stamp `freshBodies` drops put back on the '
        + 'bench bodies one boundary before the ask — no file edited, the fix simulated in place. If '
        + 'the ask then resolves, the missing stamp is the mechanism.',
    lead: mk('Morpeko', 'Hunger Switch', ['Aura Wheel']), trigger: null },
  { id: 'mega-base-key', subject: 'abomasnow', ask: 'abomasnow',
    what: 'A MEGA is a permanent rename, so BOTH engines hold abomasnow-mega and the ask still says '
        + 'abomasnow. This is the arm that THROWS rather than diverging.',
    lead: mk('Abomasnow', 'Snow Warning', ['Ice Shard'], 'Abomasite'),
    trigger: { m: 'iceshard', t: 0, mega: true } },
  { id: 'mega-forme-key', subject: 'abomasnow', ask: 'abomasnowmega',
    what: 'THE OVER-FIRE CONTROL FOR THE ARM ABOVE. The same board asked by the forme key instead of '
        + 'the base key. It must SUCCEED — otherwise the mega arm proves nothing about the KEY.',
    lead: mk('Abomasnow', 'Snow Warning', ['Ice Shard'], 'Abomasite'),
    trigger: { m: 'iceshard', t: 0, mega: true } },
];

function play(arm) {
  const G = SB.harness(null);
  const sheet = [arm.lead, mk('Dragonite', 'Multiscale', ['Extreme Speed']),
                 mk('Espathra', 'Speed Boost', []), mk('Garchomp', 'Rough Skin', [])];
  const script = [
    { p1: [arm.trigger || idle(), idle()], p2: [idle(), idle()] },
    { p1: [{ sw: 'espathra' }, { sw: 'garchomp' }], p2: [idle(), idle()] },
    { p1: [{ sw: arm.ask }, { sw: CONTROL }], p2: [idle(), idle()] },
  ];
  const A = G.buildPair(sheet, { hpBoost: 1 }), B = G.buildPair(FOES, { hpBoost: 1 });
  if (!A || !B) return { bad: 'NOT-STAGED' };
  const seen = [];
  const r = G.playGame(A, B, 'directed', 'switchback:' + arm.id, { script,
    onBoundary: (snap, t, S, battle) => {
      if (arm.restamp) for (const x of (S.benchA || [])) if (x && !x._switchKey)
        x._switchKey = String(x.name || '').toLowerCase().replace(/-.*$/, '');
      seen.push({ t,
        medi_active: (S.actA || []).map(x => (x ? String(x.name).toLowerCase() : '-')),
        medi_bench: (S.benchA || []).map(x => (x ? String(x.name).toLowerCase() : '-')),
        medi_stamp: (S.benchA || []).map(x => (x && x._switchKey) || null),
        sd_active: battle.sides[0].active.map(p => (p ? String(p.species.id) : '-')),
        sd_bench: battle.sides[0].pokemon.filter(p => !p.isActive).map(p => String(p.species.id)) });
      snap.identical = true; snap.diffs = [];
    } });
  return { err: r.err || null, turns: r.turns, seen };
}

/* ---- THE DECLARED KNOWN-OPEN ------------------------------------------------------------------
 * Same contract as tests/test-forme-assert.js: pairwise and exhaustive against the MEASURED text, so
 * a declaration cannot swallow a second, different failure that turns up later. Red, named, printed,
 * kept out of the pass count — and it stops being declared the moment the observed text changes. */
const DECLARED = {
  hungerswitch: {
    measured: ['medicham2 did not bring the subject back: active [espathra,dragonite], '
             + 'the authority [morpekohangry,dragonite]',
               'the bench body kept its flipped name: ours morpeko-hangry, the authority morpeko'],
    owed: 'TWO fixes, EITHER of which closes the switch. (C1, engine/medicham2-browser.js) revert a '
        + 'NON-PERMANENT forme change when the body leaves the field — Hunger Switch passes no '
        + 'isPermanent, so Showdown reverts and this engine does not. (C2, '
        + 'engine/game_differential.js freshBodies, :2362) carry the `_switchKey` stamp buildPair '
        + 'writes at :2213; PART 2 of this file proves it is sufficient on its own.' },
  /* THE SUFFICIENCY ARM IS DECLARED SEPARATELY AND WITH ONE LINE FEWER, WHICH IS THE POINT OF IT.
   * Restamping closes the SWITCH — the subject comes back — and leaves C1 exactly where it was, so
   * this arm's declaration is the bench-name line ALONE. If a future change made it two lines again
   * the declaration would stop matching and the arm would go hard red. */
  'hungerswitch-restamped': {
    measured: ['the bench body kept its flipped name: ours morpeko-hangry, the authority morpeko'],
    owed: 'C1 only — engine/medicham2-browser.js must revert a non-permanent forme change on the way '
        + 'out. The switch itself is already closed on this arm, which is what makes C2 sufficient '
        + 'for the divergence card and C1 a separate, still-open engine defect.' },
  'mega-base-key': {
    measured: ['the game THREW: p1 choice rejected'],
    owed: 'engine/game_differential.js — the Showdown branch at :3436 resolves a bench ask against '
        + '`id(q.species.id)` and a mega\'d body never reverts, so the ask must also try '
        + '`baseSpecies.id` (or the driver must name the candidate by its CURRENT forme). NOT the '
        + 'same defect as the arm above: restamping `_switchKey` leaves it throwing.' },
};

/* ---- RUN --------------------------------------------------------------------------------------- */
say('\nSWITCH BACK IN AFTER A RENAME — can a body medicham2 renamed mid-battle be returned to play?\n');

/* PART 1 — THE STRUCTURAL FACT, asserted rather than described. */
const G0 = SB.harness(null);
const p0 = G0.buildPair([mk('Morpeko', 'Hunger Switch', ['Aura Wheel']),
                         mk('Dragonite', 'Multiscale', ['Extreme Speed']),
                         mk('Espathra', 'Speed Boost', []), mk('Garchomp', 'Rough Skin', [])],
                        { hpBoost: 1 });
const f0 = G0.freshBodies(p0);
const stampedByBuildPair = p0.map(x => (x && x.medi && x.medi._switchKey) || null);
const stampedByFresh = f0.map(b => (b && b._switchKey) || null);
const part1 = stampedByBuildPair.every(Boolean) && stampedByFresh.every(x => x == null);
say('  PART 1 — THE STAMP THAT DOES NOT SURVIVE CONSTRUCTION');
say('    buildPair   _switchKey: ' + JSON.stringify(stampedByBuildPair));
say('    freshBodies _switchKey: ' + JSON.stringify(stampedByFresh) + '   <- what every PLAYED game uses');
say('    ' + (part1 ? 'CONFIRMED' : 'NOT CONFIRMED')
    + ' — the stamp is written by buildPair and dropped by freshBodies');

const results = [];
let failed = 0, declaredCount = 0;
say('\n  PART 2/3/4 — THE STAGED ARMS. The control (' + CONTROL + ') rides every board and must always return.');
for (const arm of ARMS) {
  const r = play(arm);
  const rec = { id: arm.id, what: arm.what, ask: arm.ask, err: r.err || null };
  const bad = [];
  if (r.bad) bad.push('COULD-NOT-STAGE');
  else if (r.err) bad.push('the game THREW: ' + r.err);
  else {
    const last = r.seen[r.seen.length - 1];
    const out = r.seen.find(s => s.t === 2) || {};
    rec.observed = { after_the_ask: last.medi_active, authority: last.sd_active,
                     bench_while_away: out.medi_bench, bench_while_away_authority: out.sd_bench };
    /* THE CONTROL FIRST. If the control did not come back this board is broken and the subject's
     * verdict is worth nothing — checked before the subject, and reported as its own line. */
    const controlBack = last.medi_active.some(n => n.indexOf(CONTROL) === 0)
                     && last.sd_active.some(n => n.indexOf(CONTROL) === 0);
    rec.control_returned = controlBack;
    if (!controlBack) bad.push('THE CONTROL DID NOT RETURN — this board proves nothing');
    const mine = last.medi_active.map(n => n.replace(/-.*$/, ''));
    const theirs = last.sd_active.map(n => n.replace(/(mega|hangry|busted|hero|sunny|rainy|snowy)$/, ''));
    if (!mine.includes(arm.subject) || !theirs.includes(arm.subject))
      bad.push('medicham2 did not bring the subject back: active [' + last.medi_active.join(',')
        + '], the authority [' + last.sd_active.join(',') + ']');
    /* PART 3 — the ENGINE half, read while the body is OFF the field. */
    const ob = (out.medi_bench || []).find(n => n.indexOf(arm.subject) === 0);
    const sb = (out.sd_bench || []).find(n => n.indexOf(arm.subject) === 0);
    if (ob && sb && ob.replace(/-/g, '') !== sb)
      bad.push('the bench body kept its flipped name: ours ' + ob + ', the authority ' + sb);
  }
  const d = DECLARED[arm.id];
  let declared = null;
  if (d && bad.length === d.measured.length && bad.every((line, i) => line.indexOf(d.measured[i]) >= 0)) {
    declared = { measured: bad.slice(), owed: d.owed };
    declaredCount++;
  } else if (bad.length) failed++;
  rec.known_open = declared; rec.problems = declared ? [] : bad;
  rec.verdict = declared ? 'KNOWN-OPEN' : (bad.length ? 'DIFFERS' : 'AGREES');
  say('\n  ' + rec.verdict.padEnd(11) + arm.id + '   ask: {sw:' + arm.ask + '}');
  say('        ' + arm.what);
  if (rec.observed) say('        after the ask — ours [' + rec.observed.after_the_ask.join(',')
    + ']  authority [' + rec.observed.authority.join(',') + ']   control returned: ' + rec.control_returned);
  if (rec.observed) say('        while away    — bench ours [' + rec.observed.bench_while_away.join(',')
    + ']  authority [' + rec.observed.bench_while_away_authority.join(',') + ']');
  for (const b of bad) say('        RED' + (declared ? ' (DECLARED KNOWN-OPEN)' : '') + '  ' + b);
  if (declared) say('        OWED: ' + declared.owed);
  results.push(rec);
}

if (!part1) failed++;
const art = { generated: new Date().toISOString(), by: 'tests/test-switch-back-renamed.js',
  what: 'can a body medicham2 renamed mid-battle be switched back in — subject against a control on '
      + 'the same board and turn',
  switchkey_written_by_buildpair: stampedByBuildPair,
  switchkey_on_played_bodies: stampedByFresh,
  arms: results, known_open: declaredCount };
fs.writeFileSync(D('data', 'switch-back-renamed.json'), JSON.stringify(art, null, 1));
if (JSONOUT) console.log(JSON.stringify(art, null, 1));

say('\n  wrote data/switch-back-renamed.json');
say('  ' + (results.length - failed - declaredCount) + ' of ' + results.length + ' arms agree; '
  + declaredCount + ' DECLARED KNOWN-OPEN (red, named, not a pass).');
if (failed) { say('\nSWITCH-BACK: RED'); process.exit(1); }
say('\nSWITCH-BACK: no undeclared disagreement; ' + declaredCount + ' declared KNOWN-OPEN arm(s) above');
