#!/usr/bin/env node
/* tests/probe_drain_per_arrival.js — A VOLLEY DRAINS ONCE PER ARRIVAL, NOT ONCE AT THE FOOT
 *   node tests/probe_drain_per_arrival.js        node tests/probe_drain_per_arrival.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY, sim/battle.ts:2160-2171, INSIDE `spreadDamage`'s own per-target loop:
 *
 *     if (targetDamage && effect.effectType === 'Move') {
 *       if (this.gen > 4 && effect.drain && source) {
 *         const amount = Math.round(targetDamage * effect.drain[0] / effect.drain[1]);
 *         this.heal(amount, source, target, 'drain');
 *       }
 *     }
 *
 * `spreadDamage` is called from `spreadMoveHit`, which `hitStepMoveHitLoop` calls ONCE PER HIT
 * (data/mods/champions/scripts.ts:518). So a two-arrival Drain Punch heals TWICE, each heal sized on
 * ITS OWN arrival's damage and each writing its own `|-heal|…|[from] drain` line. This engine paid
 * one heal at the foot of the whole volley, on the summed damage.
 *
 * IT WAS ALREADY NAMED AND OWED. `tests/probe_bond_arrival_reprice.js` prints it on every run —
 * *"drain LINES: showdown 2, medicham 1  <- NARRATION, owed"* — and docs/ENGINE.md's batch N hand
 * list carries it. It became MEASURABLE on 2026-09-07: closing the one-arrival `-hitcount` line
 * uncovered it as the FIRST divergence in two pool games that had been hidden behind it, and there
 * was a third already standing.
 *
 * THREE POOL GAMES on release `a9b05e61146a`:
 *   event missing from medicham2 :: |-heal|p1a|H/H|[from]drain <> |-damage|p2a|H/H
 *   event missing from medicham2 :: |-heal|p1b|H/H|[from]drain <> |-damage|p2a|H/H
 *   event missing from medicham2 :: |-heal|p2a|H/H|[from]drain <> |-supereffective|p1a|1
 *
 * THE ARMS, AND WHAT EACH ONE REFUSES.
 *
 *   RED    a two-arrival Drain Punch from a WOUNDED user — the authority writes TWO `-heal` lines,
 *          this engine wrote ONE. **AND THE FINAL HP MUST MATCH IN EVERY ARM**, which is the claim
 *          that this stays a narration fix: `Math.round` per arrival is not `Math.round` on the sum,
 *          so a change of arithmetic that moved the total would part a board.
 *   CTRL-A THE ARRIVALS. The identical click from a NON-MEGA Kangaskhan — one arrival, so ONE line
 *          on both sides in both arms. Without it, "always emit two" passes RED.
 *   CTRL-B THE CAP. A two-arrival volley where arrival 1 FILLS the user's bar — the second heal moves
 *          nothing and `Battle#heal` writes no line, so ONE. A fix that emitted one line per ARRIVAL
 *          rather than one per heal that MOVED THE BAR fails here and passes everything else.
 *   CTRL-C THE USER'S HP. The same mega volley from a user at FULL HP — `Battle#heal` returns false
 *          when nothing moves and writes NO line, so ZERO on both sides however many arrivals landed.
 *
 * RED FIRST: `MEDI_DRAIN_AT_FOOT=1` restores the single expression this fix turns on — the payment
 * moves back below the arrival loop and is sized on the row total. Any run carrying it also carries
 * a non-zero `MEDFAILS.drainAtFootRestored`.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_DRAIN_AT_FOOT = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE FIXTURE, DERIVED ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const TAGS = require(D('data', 'tags.json'));
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};

const KANG_MEGA = ['kangaskhan', 'Kangaskhanite', 'Scrappy', ['Drain Punch', 'Protect']];
const KANG_BASE = ['kangaskhan', '', 'Scrappy', ['Drain Punch', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
/* THE BODY THAT SURVIVES BOTH ARRIVALS, so the RED arm has two heals to compare. */
const TANK = ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']];
/* THE BODY ARRIVAL 1 KILLS — the frailest legal non-mega body by hp+def, DERIVED below. */
const FRAIL = ['pikachu', '', 'Static', ['Protect', 'Thunderbolt']];

const PROT = { m: 'protect' };
const DP = mega => ({ m: 'drainpunch', t: 0, mega: !!mega });
const IDLE = m => ({ m, t: 1 });
/* THE USER MUST BE BELOW ITS MAXIMUM OR THE READING IS VACUOUS — two empty lists are equal, and that
 * is exactly how an earlier probe in this repository reported a quiet pass on a full-HP body. So the
 * wounding turn is part of the fixture and CTRL-C is the arm that removes it deliberately. */
const WOUND = m => ({ p1: [{ m: 'drainpunch', t: 1 }, PROT], p2: [{ m, t: 0 }, PROT] });

const CASES = [
  { name: 'RED     a two-arrival Drain Punch from a WOUNDED user   [the authority writes TWO -heal]',
    part: true, sdLines: 2, meLines: 2, redLines: 1, arrivals: 2, wound: true,
    A: [KANG_MEGA, CLEF], B: [TANK, CLEF],
    what: 'Parental Bond makes it two arrivals; each one runs spreadDamage and each one heals.',
    script: [WOUND('bodyslam'), { p1: [DP(true), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-A  THE ARRIVALS — the same click WITHOUT the mega   [ONE line, in BOTH arms]',
    part: false, sdLines: 1, meLines: 1, arrivals: null, wound: true,
    A: [KANG_BASE, CLEF], B: [TANK, CLEF],
    what: 'One arrival, one heal. Without this arm an unconditional second line would pass RED.',
    script: [WOUND('bodyslam'), { p1: [DP(false), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  /* WHAT THIS ARM ACTUALLY MEASURES, CORRECTED AFTER READING IT. It was written as "arrival 1 kills"
   * and it is not: Drain Punch is 75 BP and neutral into an Electric body, so the authority reports
   * `-hitcount 2` — BOTH arrivals landed and the target died to the second. What it does measure is
   * better and is kept: arrival 1's heal FILLS THE BAR (180 of 180), so arrival 2's heal moves
   * nothing and `Battle#heal` writes NO second line. A fix that emitted one line per ARRIVAL rather
   * than one per heal that MOVED THE BAR fails here and passes everything else. */
  { name: 'CTRL-B  THE CAP — arrival 1 fills the bar, so arrival 2 writes NOTHING   [ONE line]',
    part: false, sdLines: 1, meLines: 1, arrivals: 2, wound: true, ko: true,
    A: [KANG_MEGA, CLEF], B: [FRAIL, CLEF],
    what: 'Two arrivals LANDED and only one of them moved the user\'s HP. The line follows the HEAL, '
        + 'not the arrival — a fix that wrote one per arrival would write two here.',
    script: [WOUND('thunderbolt'), { p1: [DP(true), PROT], p2: [IDLE('thunderbolt'), PROT] }] },

  /* ==== THE ARM THAT WAS MISSING, AND THE POOL FOUND IT BEFORE THIS FILE DID =====================
   * The first version of the fix passed the ARRIVAL'S PACKET to the drain and parted TWO boards on
   * the pinned pool. The authority's variable is `targetDamage` -- the HP the bar actually gave up --
   * so an OVERKILL heals on the victim's last few HP. None of the four arms above could see it: RED
   * and CTRL-C kill nobody, CTRL-A lands one arrival, and CTRL-B's cap swallowed the difference.
   * THREE WOUNDING TURNS make the user's bar deep enough that the second heal is not capped. */
  { name: 'RED-2   THE OVERKILL - arrival 2 kills with damage to spare   [the heal is on the HP TAKEN]',
    part: true, sdLines: 3, meLines: 3, redLines: 2, arrivals: 2, wound: true, ko: true,
    A: [KANG_MEGA, CLEF], B: [FRAIL, CLEF],
    what: 'Arrival 2 rolls far more than the target has left. Showdown heals half of what the bar '
        + 'gave up; the first cut of this fix healed half of the PACKET and gained three HP that do '
        + 'not exist. Measured in the pool as p1.party.kangaskhan.hp medi 160 / sd 147.',
    script: [WOUND('thunderbolt'), WOUND('thunderbolt'), WOUND('thunderbolt'),
             { p1: [DP(true), PROT], p2: [IDLE('thunderbolt'), PROT] }] },

  { name: 'CTRL-C  THE USER\'S HP — the same volley from a FULL-HP user   [ZERO lines]',
    part: false, sdLines: 0, meLines: 0, arrivals: 2, wound: false,
    A: [KANG_MEGA, CLEF], B: [TANK, CLEF],
    what: '`Battle#heal` writes nothing when the bar does not move, whatever the arrival count. This '
        + 'is the arm that says the RED arm\'s two lines are about the DRAIN and not about the volley.',
    script: [{ p1: [DP(true), PROT], p2: [IDLE('bodyslam'), PROT] }] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) bad(row[1] + ' is not a legal item in this format');
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const dp = dex.moves.get('drainpunch');
  if (!dp.drain) bad('Drain Punch no longer drains, so this file has nothing to measure');
  if (dp.multihit) bad('Drain Punch has become multi-hit; Parental Bond would refuse it');
  if (dp.target !== 'normal') bad('Drain Punch now targets ' + dp.target + '; a spread move refuses Parental Bond');
  const km = dex.species.get('kangaskhanmega');
  if (!legal(km)) bad('Kangaskhan-Mega is not in this format');
  if (dex.abilities.get(Object.values(km.abilities)[0]).id !== 'parentalbond')
    bad('Kangaskhan-Mega\'s ability is ' + JSON.stringify(km.abilities) + ', not Parental Bond');
  const dt = TAGS.moves.drainpunch && TAGS.moves.drainpunch.params.drain;
  if (!(dt && dt.fraction > 0)) bad('the drain tag no longer carries a fraction: ' + JSON.stringify(dt));
  const nonMega = dex.species.all().filter(legal).filter(s => !s.name.includes('-Mega'));
  nonMega.sort((a, b) => (a.baseStats.hp + a.baseStats.def) - (b.baseStats.hp + b.baseStats.def));
  if (nonMega[0].id !== FRAIL[0])
    console.log('  NOTE — the frailest legal body is now ' + nonMega[0].name + '. CTRL-B asserts the KO '
      + 'directly, so it fails loudly rather than quietly testing nothing.');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
/* THE USER IS p1a AND ITS DRAIN HEALS CARRY `[from] drain` AND NOTHING ELSE ON THAT BODY DOES. The
 * log carries BOTH viewpoints (an exact `x/165` and a percentage `x/100`), so the series is filtered
 * to the LARGEST max — the same narrowing tests/probe_bond_arrival_reprice.js makes, and for the
 * same reason: without it every reading is doubled and a count assertion is meaningless. */
const drainSeries = lines => {
  const rows = lines.filter(l => /^\|-heal\|p1a/.test(String(l)) && String(l).indexOf('[from] drain') >= 0)
    .map(l => { const m = /\|(\d+)\/(\d+)/.exec(String(l)); return m ? { hp: +m[1], max: +m[2] } : null; })
    .filter(Boolean);
  if (!rows.length) return [];
  const mx = Math.max(...rows.map(r => r.max));
  return rows.filter(r => r.max === mx).map(r => r.hp);
};
const hitcountOf = lines => { for (const l of lines) { const m = /^\|-hitcount\|[^|]+\|(\d+)/.exec(String(l)); if (m) return +m[1]; } return null; };
const faints = lines => lines.filter(l => /^\|faint\|p2a/.test(String(l))).length;

console.log((RED ? 'RED ARM — MEDI_DRAIN_AT_FOOT=1 (the drain paid once, below the volley, on the row total)'
                 : 'CLEAN ARM') + NL);

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_drain_per_arrival :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdH = drainSeries(sdL), meH = drainSeries(meL);
  const sdC = hitcountOf(sdL), meC = hitcountOf(meL);

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  drain -heal lines ' + JSON.stringify(sdH) + '   -hitcount ' + sdC
    + '   target faints ' + faints(sdL));
  console.log('    medicham  drain -heal lines ' + JSON.stringify(meH) + '   -hitcount ' + meC
    + '   target faints ' + faints(meL));

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  if (c.arrivals) claim(sdC === c.arrivals && meC === c.arrivals,
    c.name + ' — the volley landed ' + c.arrivals + ' arrivals on BOTH engines',
    'showdown -hitcount ' + sdC + ', medicham ' + meC);
  if (c.ko) claim(faints(sdL) === 1 && faints(meL) === 1,
    c.name + ' — the target died on both engines (to arrival 2 — see the arm note), so the two '
      + 'streams are describing the same volley',
    'showdown ' + faints(sdL) + ', medicham ' + faints(meL));
  claim(sdH.length === c.sdLines,
    c.name + ' — THE AUTHORITY wrote ' + c.sdLines + ' drain line(s)', 'showdown ' + JSON.stringify(sdH));

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  /* WHAT THE RESTORED ENGINE WRITES IS ITS OWN NUMBER AND IS NOT DERIVED FROM THE AUTHORITY'S.
   * The old engine paid ONE heal per volley, so a game with an earlier drain in it still carries
   * that earlier line: RED-2's three authority lines are two under the restore. Stating it per arm
   * is the only honest option — a formula here would be a second model of the defect. */
  const want = RED && c.part ? c.redLines : c.meLines;
  claim(meH.length === want,
    c.name + ' — this engine wrote ' + want + ' drain line(s)'
      + (RED ? (c.part ? '   [--red: the defect restored]' : '   [--red: control, must HOLD]') : ''),
    'medicham ' + JSON.stringify(meH));
  /* ==== THE WHOLE SERIES, NOT JUST THE COUNT AND NOT JUST THE LAST VALUE ========================
   * The first cut of this file asserted the COUNT and the FINAL HP. It passed a fix that healed the
   * wrong AMOUNT on an intermediate arrival, and the pinned pool is what caught it. Every value the
   * user\'s bar passed through is compared now -- in the RED arm too wherever the line COUNT is allowed
   * to differ but the arithmetic is not. */
  if (!RED || !c.part)
    claim(JSON.stringify(sdH) === JSON.stringify(meH),
      c.name + ' -- and EVERY VALUE the bar passed through matches the authority, not just the count '
        + 'and not just the last one',
      'showdown ' + JSON.stringify(sdH) + '  vs  medicham ' + JSON.stringify(meH));
  /* ==== THE BOARD CLAIM, IN EVERY ARM AND IN BOTH ARMS ==========================================
   * `Math.round` per arrival is NOT `Math.round` over the sum, so this fix could move the user's
   * final HP by one — which would turn a narration fix into a board regression. The end HP is
   * therefore asserted EQUAL on both engines whether or not the line count moved, and it is asserted
   * in the RED arm too, where the count is allowed to differ and the HP is not. */
  const sdEnd = sdH.length ? sdH[sdH.length - 1] : null, meEnd = meH.length ? meH[meH.length - 1] : null;
  claim(sdEnd === meEnd,
    c.name + ' — and the VOLLEY LEAVES THE USER ON THE SAME HP, in this arm and in the other one. '
      + 'This is the claim that keeps the fix narration-only',
    sdEnd === meEnd ? ('identical at ' + sdEnd) : 'showdown ' + sdEnd + '  vs  medicham ' + meEnd);
  claim(!r.stateDiv, c.name + ' — the BOARD at the turn boundary is IDENTICAL',
    r.stateDiv ? JSON.stringify(r.stateDiv).slice(0, 200) : 'identical');
}

/* ---- THE RESTORE FLAG IS LOUD -------------------------------------------------------------------- */
if (RED) {
  claim((FAILS.drainAtFootRestored | 0) > 0, 'the RED arm STAMPED a failure counter',
    'MEDFAILS.drainAtFootRestored = ' + (FAILS.drainAtFootRestored | 0));
} else {
  claim((FAILS.drainAtFootRestored | 0) === 0, 'the CLEAN arm carries NO restore stamp',
    String(FAILS.drainAtFootRestored | 0));
  claim((SEEN.drainPaidPerArrival | 0) > 0,
    'the per-arrival drain counter MOVED — a wire nobody can see fire is assumed broken',
    'MEDSEEN.drainPaidPerArrival = ' + (SEEN.drainPaidPerArrival | 0));
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
