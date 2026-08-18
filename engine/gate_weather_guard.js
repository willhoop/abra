/* gate_weather_guard.js — ROADMAP #286: `weatherSetupHelpsPartner` GUARDS ITSELF ON A FIELD NOTHING
 * EVER WRITES. The FUNCTIONAL arm the row asked for, built.
 *
 * ================= WHAT THE ROW ASKED FOR, IN ITS OWN WORDS ======================================
 *
 *   "INSTRUMENT OWED, unchanged and now with the alternative ruled out: the FUNCTIONAL arm this row
 *    already specifies — stand a weather setter beside a partner of the boosted type with that
 *    weather ALREADY UP and FAIL while the feature still reads 1. A static scan cannot substitute
 *    for it."
 *
 * THE CHEAP GATE WAS BUILT, MEASURED AND REJECTED, AND IT STAYS REJECTED. A general static scan for
 * `__`-prefixed fields read and never assigned fires on EIGHT fields in `engine/` and only one of
 * them is this defect: `__ABRA_DEX`, `__seed`, `__setDB`, `__unreadable`, `__ally`, `__onSetDB` and
 * `__ABRA_BOARD_DATA` are all assigned through forms a scan cannot see. Seven false positives out of
 * eight is a ratchet people learn to ignore, which is the failure this repository names by its own
 * casualties (#148). Nothing here greps a source file.
 *
 * ================= WHAT IT ACTUALLY DOES ========================================================
 *
 * Three passes over `engine/feature_fixture.js`'s own staged boards — the canonical fixture, not a
 * second one written here, because a board hand-rolled in a gate is a claim about the fixture rather
 * than about the mechanic:
 *
 *   CONTROL (weather DOWN)   find every candidate pair the shipping `jointFeaturesFor` scores
 *                            `weatherSetupHelpsPartner = 1` while the board carries no weather.
 *                            NOTHING IS TYPED HERE: the pairs are whatever the function itself
 *                            calls a synergy, so this gate names no move, no type and no weather —
 *                            it reads `move.weather` off the candidate it was handed.
 *                            No such pair -> exit 2. A fixture that cannot stage the case has not
 *                            proved the case is absent.
 *   THE ARM (weather UP)     the SAME boards, with `board.setWeather(w)` through the Board's own
 *                            door and `board.weather` read back to prove it took, then the
 *                            candidates and vectors REBUILT through `B.candidates` / `B.featuresFor`
 *                            exactly as the fixture builds them. The feature must now read 0.
 *                            It reads 1 -> exit 1: the defect is live.
 *   THE REPAIR CONTROL       the same staged pair with `__weather` populated BY HAND. The feature
 *                            must drop to 0. This is not a pass condition and it is not a fix —
 *                            it is the proof that this gate can ever be green. A check that is red
 *                            no matter what the code does is decoration, and the one thing worse
 *                            than an unmeasured defect here is an instrument nobody can clear.
 *                            It fails to drop -> exit 2, because then the gate no longer knows what
 *                            it is measuring.
 *
 * WHY THE ARM GOES THROUGH THE CALLER AND NOT THROUGH THE FIELD. `jointFeaturesFor(A, B, xa, xb)`
 * takes no board, so the only channel by which it can learn the sky is the CANDIDATE OBJECTS. Setting
 * `A.__weather` here and calling it green would be this project's founding failure — a capability
 * absent, everything reporting success — because no caller in the tree sets it: `magnemite.js:1031`,
 * `joint_rows.js:260`, `branch_recall.js:127`, `feature_shift.js:149` and `feature_fixture.js:682`
 * all hand it candidates straight out of `B.candidates`. So the gate stages the WORLD and asks the
 * pipeline, and it goes green for a repair at either end — the caller populating the field, or the
 * feature reading `board.weather` (the expiry-aware accessor #276 built) instead.
 *
 * IT FIXES NOTHING. `engine/board.js` is fit-invalidating and belongs to the divisions that own the
 * weights; #286 is filed against it and stays filed. This measures.
 *
 *   node engine/gate_weather_guard.js            the verdict, with every staged pair named
 *   node engine/gate_weather_guard.js --json
 *   node engine/gate_weather_guard.js --selftest every branch of the verdict, red and green
 *
 * Loads the dex and the fixture. Plays no games and writes no artifact. */
'use strict';
const has = (f) => process.argv.includes(f);

const FEATURE = 'weatherSetupHelpsPartner';

/* THE VERDICT TABLE, EXTRACTED SO THE SELFTEST DRIVES THE SHIPPING FUNCTION RATHER THAN A
 * RESTATEMENT OF IT. `code` is the process exit code, and 2 is RED to `register_reality.js` exactly
 * as 1 is: a gate that exits 0 because it could not look would close a live defect. */
function verdict(m) {
  if (!m || m.error) return { code: 2, tag: 'CANNOT ANSWER', why: (m && m.error) || 'no measurement' };
  if (!m.controls) {
    return { code: 2, tag: 'CANNOT ANSWER',
      why: 'THE FIXTURE STAGED NO PAIR AT ALL — no candidate pair on any board scores `' + FEATURE
         + ' = 1` with the weather DOWN, so there is nothing to re-ask with it up. A fixture that '
         + 'cannot stage the case has not shown the case is absent. Add a weather setter beside a '
         + 'partner of the boosted type in engine/feature_fixture.js.' };
  }
  if (!m.staged) {
    return { code: 2, tag: 'CANNOT ANSWER',
      why: 'THE WEATHER WOULD NOT STAGE — board.setWeather() was called and board.weather did not '
         + 'read back as the weather asked for, on every control pair. That is a claim about the '
         + 'fixture, never about the mechanic.' };
  }
  if (!m.repairProved) {
    return { code: 2, tag: 'CANNOT ANSWER',
      why: 'THE REPAIR CONTROL DID NOT DROP — with the guard field populated by hand the feature '
         + 'still reads 1, so this gate can no longer tell a live defect from a moved guard. It is '
         + 'refusing rather than reporting either.' };
  }
  if (m.stillFiring > 0) {
    return { code: 1, tag: 'LIVE',
      why: m.stillFiring + ' of ' + m.staged + ' staged pair(s) still score `' + FEATURE + ' = 1` '
         + 'with that weather ALREADY UP on the board. The guard has never bound: nothing in the '
         + 'pipeline carries the sky into the joint layer, so `\'\' !== w` is true for every '
         + 'non-empty w. The repair control drops to 0, so this gate goes green on a fix.' };
  }
  return { code: 0, tag: 'CLEAN',
    why: 'all ' + m.staged + ' staged pair(s) score 0 with the weather already up, and all '
       + m.controls + ' of them scored 1 with it down — so the guard binds and the control is not '
       + 'vacuous.' };
}

/* ---- the measurement ------------------------------------------------------------------------- */
function measure() {
  const B = require('./board.js');
  const FIX = require('./feature_fixture.js');
  const CS = require('./champions_sim.js');
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const IDX = B.JOINT_INDEX[FEATURE];
  if (IDX == null) {
    return { error: 'engine/board.js no longer exports a joint feature named `' + FEATURE + '`. The '
                  + 'thing this row is about has been renamed or removed; re-read #286 before '
                  + 'trusting any verdict from here.' };
  }

  /* Slot a against slot b of the SAME side of the SAME scenario — the only pairing
   * `jointFeaturesFor` is ever asked about, and the rule is `feature_fixture.columns`'s own. */
  const partnerOf = (slots, A) => slots.find((s) => s !== A && s.side === A.side
    && s.label.split('/')[0] === A.label.split('/')[0] && s.letter > A.letter);

  /* PASS 1 — CONTROL. Which pairs does the function itself call a weather synergy, with no weather
   * up? Nothing about Pokemon is typed here; `w` is read off the candidate's own move. */
  const controls = [];
  {
    const slots = FIX.build(dex);
    for (const A of slots) {
      const P = partnerOf(slots, A);
      if (!P) continue;
      for (let ia = 0; ia < A.cands.length; ia++) {
        for (let ib = 0; ib < P.cands.length; ib++) {
          const j = B.jointFeaturesFor(A.cands[ia], P.cands[ib], A.feats[ia], P.feats[ib]);
          if (j[IDX] !== 1) continue;
          const w = B.norm((A.cands[ia].move && A.cands[ia].move.weather) || '');
          if (!w) continue;                      /* the feature is symmetric; the other order is found on its own pass */
          /* A control is only a control if the weather really was DOWN for it. */
          if (B.norm(A.board.weather || '') === w) continue;
          controls.push({ label: A.label, partner: P.label, ia, ib, w,
            setter: (A.cands[ia].move && A.cands[ia].move.name) || '?',
            partnerMove: (P.cands[ib].move && P.cands[ib].move.name) || '?',
            partnerType: (P.cands[ib].move && P.cands[ib].move.type) || '?' });
        }
      }
    }
  }
  if (!controls.length) return { controls: 0, staged: 0, stillFiring: 0, repairProved: false, rows: [] };

  /* PASS 2 — THE ARM. One fresh fixture per distinct weather, so no board is asked two questions.
   * `setWeather` is the Board's own door and `board.weather` is the accessor that answers it; both
   * are read back rather than assumed, because a fixture that silently failed to stage would report
   * this defect fixed. */
  const rows = [];
  let staged = 0, stillFiring = 0, repairChecked = 0, repairDropped = 0;
  for (const w of Array.from(new Set(controls.map((c) => c.w)))) {
    const slots = FIX.build(dex);
    const boards = new Set();
    for (const s of slots) boards.add(s.board);
    for (const b of boards) b.setWeather(w);
    /* THE PRECONDITION, ASSERTED AND NOT ASSUMED. */
    const stuck = Array.from(boards).filter((b) => B.norm(b.weather || '') !== w);
    /* Rebuild every candidate and vector through the fixture's own calls, so the pipeline gets the
     * chance to carry the new sky forward. */
    for (const s of slots) {
      const user = s.board.slot(s.side, s.letter);
      if (!user) continue;
      s.cands = B.candidates(user.moves, user, s.board, s.side, dex);
      s.feats = s.cands.map((c, i) => B.featuresFor(c, user, s.board, s.side, dex, (i + 1) / (s.cands.length + 1)));
    }
    for (const c of controls.filter((x) => x.w === w)) {
      const A = slots.find((s) => s.label === c.label);
      const P = A && partnerOf(slots, A);
      if (!A || !P || !A.cands[c.ia] || !P.cands[c.ib]) continue;
      if (stuck.has ? stuck.has(A.board) : stuck.indexOf(A.board) >= 0) continue;
      staged++;
      const j = B.jointFeaturesFor(A.cands[c.ia], P.cands[c.ib], A.feats[c.ia], P.feats[c.ib]);
      const fires = j[IDX] === 1;
      if (fires) stillFiring++;
      /* THE REPAIR CONTROL — populate the guard field by hand and re-ask. This is what a caller
       * doing its job would produce, and it is the proof this gate is not stuck red. */
      const copy = Object.assign(Object.create(Object.getPrototypeOf(A.cands[c.ia]) || Object.prototype), A.cands[c.ia]);
      copy.__weather = w;
      const j2 = B.jointFeaturesFor(copy, P.cands[c.ib], A.feats[c.ia], P.feats[c.ib]);
      repairChecked++;
      if (j2[IDX] === 0) repairDropped++;
      rows.push({ board: c.label + ' + ' + c.partner, weather: w, setter: c.setter,
        partner: c.partnerMove + ' (' + c.partnerType + ')',
        with_weather_down: 1, with_weather_up: j[IDX], with_field_populated: j2[IDX] });
    }
  }
  return { controls: controls.length, staged, stillFiring, rows,
    repairProved: repairChecked > 0 && repairDropped === repairChecked,
    repair_checked: repairChecked, repair_dropped: repairDropped };
}

/* ---- selftest ---------------------------------------------------------------------------------- */
if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const M = (o) => Object.assign({ controls: 2, staged: 2, stillFiring: 0, repairProved: true }, o);

  ok('GREEN only when every staged pair reads 0 with the weather up',
    verdict(M({})).code === 0, verdict(M({})));
  ok('RED — a pair still firing with the weather ALREADY UP is exit 1, the defect live',
    verdict(M({ stillFiring: 1 })).code === 1 && verdict(M({ stillFiring: 1 })).tag === 'LIVE');
  ok('RED — a fixture that staged NO control pair is CANNOT ANSWER, never green: an absent fixture '
    + 'is a claim about the fixture and not about the mechanic',
    verdict(M({ controls: 0 })).code === 2);
  ok('RED — a weather that would not stage is CANNOT ANSWER, never green',
    verdict(M({ staged: 0 })).code === 2);
  ok('RED — if the REPAIR control does not drop, the gate refuses rather than reporting either way: '
    + 'a check that cannot be cleared by a fix is decoration',
    verdict(M({ repairProved: false })).code === 2);
  ok('RED — a measurement that errored is CANNOT ANSWER and is never 0',
    verdict({ error: 'board.js renamed the feature' }).code === 2 && verdict(null).code === 2);
  ok('the LIVE verdict names the count and the denominator, so a partial regression is legible',
    /1 of 2 staged/.test(verdict(M({ stillFiring: 1 })).why));

  console.log(`\nWEATHER-GUARD GATE SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- the run ----------------------------------------------------------------------------------- */
let m = null;
try { m = measure(); }
catch (e) { m = { error: 'THE MEASUREMENT THREW — ' + String((e && e.message) || e).split('\n')[0] }; }
const v = verdict(m);
const out = {
  row: 286, gate: 'engine/gate_weather_guard.js', feature: FEATURE,
  what: 'a weather setter beside a partner of the boosted type, with that weather ALREADY UP: the '
      + 'joint feature must read 0',
  control_pairs: m.controls || 0, staged_pairs: m.staged || 0, still_firing: m.stillFiring || 0,
  repair_control: m.repairProved ? (m.repair_dropped + '/' + m.repair_checked + ' drop to 0 when the '
    + 'guard field is populated by hand') : 'NOT PROVED',
  verdict: v.tag, exit: v.code, why: v.why, rows: m.rows || [],
};

if (has('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(v.code); }

console.log('');
console.log('ROADMAP #286 — `' + FEATURE + '` guards itself on a field nothing writes');
console.log('  fixture   engine/feature_fixture.js (the canonical staged boards)');
console.log('  control   ' + out.control_pairs + ' pair(s) score 1 with the weather DOWN'
          + '   staged with it UP: ' + out.staged_pairs);
console.log('  repair    ' + out.repair_control);
console.log('');
console.log('  ' + v.tag + '   ' + v.why);
for (const r of out.rows) {
  console.log('      ' + r.board);
  console.log('        ' + r.setter + ' -> ' + r.weather + '  beside  ' + r.partner
            + '   down=' + r.with_weather_down + '  up=' + r.with_weather_up
            + '  field-populated=' + r.with_field_populated);
}
console.log('');
console.log('  exit ' + v.code + '   [0 clean, 1 the defect is live, 2 cannot answer]');
console.log('');
process.exit(v.code);
