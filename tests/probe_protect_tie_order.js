/* ROADMAP #376 — THE DISCRIMINATOR THE ROW ITSELF SPECIFIES.
 *
 *   SHOWDOWN_PATH=... node tests/probe_protect_tie_order.js [--n 48] [--release <id>]
 *
 * ================= WHAT THIS ANSWERS ============================================================
 *
 * #376 holds three `ordering` causes in which both engines put a DIFFERENT body's Protect (or
 * Detect) first, with `speed_gap: 0` and `same_priority: true` read off the AUTHORITY's own
 * `getActionSpeed()`. The row's own instruction, verbatim:
 *
 *   "stage two bodies at identical `getActionSpeed()` both clicking Protect across N seeds and count
 *    agreement — about 50% is the tie device, 0% is an inverted alignment, 100% means these three are
 *    something else."
 *
 * That is what this file does, and it is deliberately NOT the five hand-picked arrangements in
 * `tests/test-speed-tie.js`. Five geometries that happen to agree cannot distinguish "the rule is
 * right" from "these five miss it"; this sweeps every base-Speed group in the format that has two
 * Protect carriers, and it stages the tie THREE ways — across the net, both bodies on one side, and
 * across the net at different spread rungs — because a rule phrased about sides passes the first and
 * fails the second, and a rule phrased about slot index passes the first two and fails the third.
 *
 * ================= "N SEEDS" IS N ARRANGEMENTS HERE, AND THAT IS NOT A LOOSENING ================
 *
 * The row says seeds. Under this harness a seed cannot move the answer and saying so is the point:
 * `pinShuffle` (game_differential.js:1735) is a NO-OP in every shipped arm — `sdShuffleReverses` is
 * false — and the middle arm hands medicham2 `o.tie = () => 0` (:1842), a constant. BOTH tie devices
 * are already pinned, so re-running one arrangement under a thousand seeds re-runs one deterministic
 * comparison a thousand times. The variable that can actually move the verdict is the SHAPE of the
 * tied group, so that is the variable this file varies. If the two devices were NOT both pinned this
 * file would read ~50% and the row's first branch would be the answer — which is exactly the
 * hypothesis it exists to test rather than assume.
 *
 * ================= EVERY TIE IS VERIFIED, NEVER INTENDED ========================================
 *
 * A staged tie that is not actually a tie is the fixture failing, and it reads exactly like an engine
 * that agreed. `playGame({ speedCensus: true })` records `q.getActionSpeed()` for every body at
 * `when === 0` — the reading taken BEFORE a single choice, i.e. the queue that turn 1 is built from —
 * and an arrangement whose two named bodies do not come back EQUAL is reported as FIXTURE and is not
 * counted in the agreement rate at all.
 *
 * ================= WHAT COUNTS AS AGREEMENT =====================================================
 *
 * All four actives click Protect, so every `|move|` line in the turn is the same move and the ONLY
 * thing that can part the two streams there is the order. Agreement is `r.div === null && r.stateDiv
 * === null`. A divergence whose class is not an `|move|` ordering is counted APART as OTHER and named
 * — it is a real disagreement about something else and this file may not launder it into its own
 * denominator in either direction.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const N_WANT = Number(flag('--n', 48));
/* The driver reads its flags off argv at module load, exactly as tests/test-speed-tie.js does. */
if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));

/* ---- THE FIXTURE POOL, DERIVED FROM THE FORMAT AND NEVER TYPED --------------------------------
 * CLAUDE.md's filter, and `TeamValidator#checkCanLearn` for the click. `.all()` is the National Dex
 * wearing this format's name. */
/* A MEGA FORME IS NOT A SHEET ENTRY. `legalRoster()` lists every body that can stand on the field in
 * this format, which INCLUDES the megas — and a team declaring one is refused before a turn is
 * played, so an arrangement built on it measures nothing. The dex says which those are:
 * `requiredItem` is the stone, and it is read rather than a name being pattern-matched. */
/* AND NEITHER IS A BATTLE-ONLY FORME. `battleOnly` is the dex's own word for a body that only exists
 * once the battle has started — Morpeko-Hangry, Mimikyu-Busted, Aegislash-Blade. The first run of this
 * file put Morpeko against Morpeko-Hangry and got a `-formechange` disagreement that was entirely the
 * fixture: a sheet cannot declare the hungry forme, so no game can reach that board. */
const roster = CS.legalRoster().filter(sp =>
  !sp.requiredItem && !sp.battleOnly && CS.canLearn(sp.name, 'protect'));
const bySpe = new Map();
for (const sp of roster) {
  const k = sp.baseStats.spe;
  if (!bySpe.has(k)) bySpe.set(k, []);
  bySpe.get(k).push(sp.name);
}
const speeds = [...bySpe.keys()].sort((a, b) => a - b);

/* THE SPREAD LADDER IS THE HARNESS'S, AND IT IS READ RATHER THAN COPIED. `buildPair` gives slot i the
 * ladder rung `[32, 22, 11, 0][i % 4]` in Speed, at Serious / level 50. So two bodies tie when their
 * base Speeds differ by exactly the difference between their rungs — 0 across the same rung, and 10
 * across rungs 0 and 1, because the level-50 line adds `floor((2*base+31)/2)` and a 10-point base
 * difference is exactly 10 points of final Speed. NOTHING HERE TRUSTS THAT: every arrangement is
 * checked against the authority's own `getActionSpeed()` below, and a miss is a FIXTURE row. */
const RUNG_GAP_01 = 10;

/* FILLERS THAT ARE NOT TIED TO ANYTHING ELSE IN THE ARRANGEMENT, and DISTINCT — Species Clause is in
 * this format's rule table, so a sheet naming one body twice is refused and the turn never plays.
 * That is exactly what the first run of this file did on 11 of 12 arrangements. */
function fillersAway(base, want) {
  const out = [];
  const far = speeds.filter(s => Math.abs(s - base) > RUNG_GAP_01 + 2).sort((a, b) => Math.abs(b - base) - Math.abs(a - base));
  for (const s of far) {
    for (const nm of bySpe.get(s)) {
      if (out.includes(nm)) continue;
      out.push(nm);
      if (out.length >= want) return out;
    }
  }
  return out.length >= want ? out : null;
}

const mon = (species) => ({ species, item: '', ability: '', moves: ['Protect'] });

/* ---- THE ARRANGEMENTS -------------------------------------------------------------------------
 * Three geometries per base-Speed group, so a rule phrased about sides or about slot index cannot
 * pass by accident. Everything clicks Protect. */
const CASES = [];
function addCases(base, names) {
  const X = names[0], Y = names[1];
  const F = fillersAway(base, 8);
  if (!F) return;
  const Z = (() => {
    const up = bySpe.get(base + RUNG_GAP_01) || [];
    for (const nm of up) if (nm !== X && nm !== Y) return nm;
    return null;
  })();
  const away = (list, extra) => list.filter(nm => nm !== X && nm !== Y && nm !== extra);

  /* (a) ACROSS THE NET, same rung: p1a against p2a, identical base Speed. */
  {
    const f = away(F);
    CASES.push({ id: 'cross-r0 ' + X + ' / ' + Y, want: ['p1a', 'p2a'],
                 A: [mon(X), mon(f[0]), mon(f[1]), mon(f[2])],
                 B: [mon(Y), mon(f[3]), mon(f[4]), mon(f[5])] });
  }
  if (!Z) return;

  /* (b) BOTH ON ONE SIDE: p1a against p1b, rung 32 against rung 22, so the slot-1 body needs a base
   * Speed ten points higher. There is no "later side" to take here. */
  {
    const f = away(F, Z);
    CASES.push({ id: 'same-side ' + X + ' / ' + Z, want: ['p1a', 'p1b'],
                 A: [mon(X), mon(Z), mon(f[0]), mon(f[1])],
                 B: [mon(f[2]), mon(f[3]), mon(f[4]), mon(f[5])] });

    /* (c) ACROSS THE NET AT DIFFERENT RUNGS: p1a (rung 32) against p2b (rung 22). A rule phrased
     * about slot index passes (a) and (b) and fails this. */
    CASES.push({ id: 'cross-r1 ' + X + ' / ' + Z, want: ['p1a', 'p2b'],
                 A: [mon(X), mon(f[0]), mon(f[1]), mon(f[2])],
                 B: [mon(f[3]), mon(Z), mon(f[4]), mon(f[5])] });
  }
}
for (const s of speeds) {
  const names = bySpe.get(s);
  if (names.length < 2) continue;
  addCases(s, names);
  if (CASES.length >= N_WANT) break;
}
CASES.length = Math.min(CASES.length, N_WANT);

/* TWO TURNS OF PROTECT, NOT ONE — and the second turn is what settles ROADMAP #376's own caveat.
 * A Protect can fail two ways, and `[still]` is the same line for both:
 *
 *     onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
 *                                                                       data/moves.ts, protect
 *
 * `willAct()` is false for the LAST action in the queue, which turn 1 exercises on every arrangement.
 * `StallMove` is the CONSECUTIVE-USE counter, which cannot fire until a body has already Protected —
 * so a one-turn script leaves half of the caveat unstaged. The stall counter is a live, address-keyed
 * die SHARED by both engines in the middle arm (`MID_CATS` includes `stall`), so turn 2 asks a real
 * question rather than a pinned one. */
const SCRIPT = [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
];

function moveOrder(lines) {
  const out = [];
  for (const l of lines) { const m = /^\|move\|([^|]+)\|/.exec(String(l)); if (m) out.push(m[1]); }
  return out.join(' -> ');
}

/* ---- THE RUN, AND THE CONTROL THAT PROVES IT CAN SEE A DISAGREEMENT ---------------------------
 *
 * A GREEN PROBE CAN BE ASKING NOTHING. `pinShuffle` is a no-op and the middle arm hands medicham2
 * `o.tie = () => 0`, so if these arrangements were not real tied groups — or if the sort never
 * consulted the tie key at all — every arrangement would read AGREE for a reason that has nothing to
 * do with the alignment being right.
 *
 * SO THE KNOB IS THE TIE DIE ITSELF, and it is turned in the one direction that can move a tie: a
 * RAMP. A different CONSTANT would be no control at all — the comparator sees the same key on every
 * action either way, so the group keeps its order and the run comes back identical, which reads
 * exactly like a knob that is unwired. The ramp gives each drawn action a strictly increasing key, so
 * a tied group is re-ordered by draw order and nothing else, which is precisely the retired
 * `tieToSecondBody` behaviour this arm dropped. The arm is CLONED (`opts.arm`), so the shipped arm is
 * never mutated and the shipped rows above are unaffected.
 *
 * IF THE CONTROL DOES NOT MOVE THE COUNT, THE SHIPPED ROWS ARE WORTHLESS and this file says so and
 * exits non-zero. */
function runArm(arm, tag) {
  let agree = 0, disagree = 0, fixture = 0, other = 0, threw = 0, stallFail = 0, stallFail2 = 0;
  const disagreements = [], others = [], fixtures = [];
  for (const c of CASES) {
    const a = G.buildPair(c.A), b = G.buildPair(c.B);
    if (!a || !b) { fixture++; fixtures.push(c.id + ' — buildPair returned null'); continue; }
    const r = G.playGame(a, b, 'directed', 'p376:' + c.id, { script: SCRIPT, speedCensus: true, arm });
    if (r.err) { threw++; fixtures.push(c.id + ' — THREW ' + r.err); continue; }
    /* THE SHORT-GAME CHECK BELONGS *AFTER* THE DIVERGENCE CHECK, and putting it first cost the control
     * 56 of its 116 rows: the driver STOPS at the first divergence, so a control arrangement that
     * disagreed on turn 1 played one turn and was filed as a broken fixture instead of as the
     * disagreement it is. A short game is only a fixture failure when nothing diverged. */

    /* THE TIE IS VERIFIED, NOT INTENDED. `when === 0` is the reading taken before a single choice. */
    const pre = (r.speedCensus || []).filter(x => x.when === 0);
    const sp = (slot) => { const row = pre.find(x => x.slot === slot); return row ? row.showdown : null; };
    const s1 = sp(c.want[0]), s2 = sp(c.want[1]);
    if (s1 == null || s2 == null || s1 !== s2) {
      fixture++;
      fixtures.push(c.id + ' — NOT A TIE: ' + c.want[0] + ' ' + s1 + ' vs ' + c.want[1] + ' ' + s2
        + '  (authority getActionSpeed at when=0)');
      continue;
    }

    /* THE DIVERGENCE RECORD'S OWN FIELDS — `sdRaw` / `meRaw`, and the class from the driver's own
     * `classify`. Reading `d.showdown` instead printed `undefined` on every control row, which made a
     * control that HAD moved read as a knob that was never wired. */
    /* ---- THE GARCHOMP CAVEAT, EXERCISED RATHER THAN ARGUED (ROADMAP #376, JOB 2) ----------------
     * The row's second pair carries the authority line `|move|p1b: Garchomp|Protect||[still]`, and
     * `[still]` is `Battle#attrLastMove` blanking the target of a move that did nothing
     * (sim/battle.ts:3128). For Protect that comes from its own `onPrepareHit`:
     *
     *     return !!this.queue.willAct() && this.runEvent('StallMove', pokemon);   data/moves.ts
     *
     * `willAct()` is FALSE for the LAST action in the queue — so a Protect that is ordered last FAILS,
     * and whether a Protect is last is decided by the very tie under test. Every arrangement here has
     * all four actives clicking Protect, so exactly one of them is last and MUST fail; the count is
     * printed so "the failing-Protect mechanism agrees" is a measurement rather than a claim. */
    const tr = (r.mediTrace || []).map(String);
    const t2 = tr.findIndex(l => /^\|turn\|2\b/.test(l));
    if (tr.some(l => /^\|-fail\|/.test(l))) stallFail++;
    if (t2 >= 0 && tr.slice(t2).some(l => /^\|-fail\|/.test(l))) stallFail2++;

    const d = r.div || r.stateDiv;
    if (!d) {
      if (r.turns !== SCRIPT.length) {
        fixture++;
        fixtures.push(c.id + ' — ' + r.turns + ' turn(s) played, ' + SCRIPT.length + ' scripted, and '
          + 'nothing diverged, so the turn simply did not happen');
        continue;
      }
      agree++; continue;
    }
    const sdL = String(d.sdRaw != null ? d.sdRaw : ''), meL = String(d.meRaw != null ? d.meRaw : '');
    const cls = r.div ? (G.classify(r.div) || {}).cls : 'board';
    const isMoveOrdering = /^\|move\|/.test(sdL) && /^\|move\|/.test(meL);
    if (isMoveOrdering) {
      disagree++;
      disagreements.push({ id: c.id, tie_speed: s1, cls, showdown: sdL, medicham: meL,
                           medi_order: moveOrder(r.mediTrace) });
    } else {
      other++;
      others.push({ id: c.id, tie_speed: s1, cls,
                    showdown: sdL || JSON.stringify(d).slice(0, 90), medicham: meL });
    }
  }
  return { tag, agree, disagree, fixture, other, threw, stallFail, stallFail2, disagreements, others, fixtures };
}

const RAMP_STEP = 1 / 64;
const CONTROL_ARM = Object.assign({}, G.PRIMARY_ARM, {
  id: G.PRIMARY_ARM.id + '+tie-ramp-CONTROL',
  mediRng: () => {
    const o = G.PRIMARY_ARM.mediRng();
    let i = 0;
    o.tie = () => Math.min(1 - 1e-9, (i++) * RAMP_STEP);
    return o;
  },
});

console.log('ROADMAP #376 — TWO BODIES AT AN IDENTICAL getActionSpeed(), BOTH CLICKING PROTECT\n');
console.log('  release ' + G.REL.id + ', arm ' + G.PRIMARY_ARM.id
  + ', showdown shuffle = ' + (G.PRIMARY_ARM.sdShuffleReverses ? 'REVERSED' : 'no-op')
  + ', arrangements ' + CASES.length + '\n');

const SHIPPED = runArm(undefined, 'shipped');
const CONTROL = runArm(CONTROL_ARM, 'tie-ramp control');

const { agree, disagree, fixture, other, threw, disagreements, others, fixtures } = SHIPPED;
const scored = agree + disagree;
console.log('  ' + agree + ' AGREE, ' + disagree + ' DISAGREE on turn order, out of ' + scored + ' scored');
console.log('  ' + fixture + ' fixture (staged tie did not materialise or the turn did not play), '
  + threw + ' threw, ' + other + ' diverged for a DIFFERENT reason (counted apart, never in the rate)');
/* ROADMAP #376 JOB 2 — the `[still]` caveat. A zero here means the failing-Protect mechanism was
 * never staged and nothing above says anything about it. */
console.log('  ' + SHIPPED.stallFail + ' of ' + CASES.length + ' arrangements produced a FAILED Protect '
  + '(the `[still]` line the #376 Garchomp row carries); ' + SHIPPED.stallFail2 + ' of them on TURN 2, '
  + 'where the consecutive-use `StallMove` counter is the only thing that can refuse it.');
if (!SHIPPED.stallFail || !SHIPPED.stallFail2) {
  console.log('    A ZERO HERE MEANS THE CAVEAT IS UNTESTED by this file, whatever the rate above says.');
}
if (scored) {
  const pct = 100 * agree / scored;
  console.log('\n  AGREEMENT = ' + pct.toFixed(1) + '%   (' + agree + '/' + scored + ')');
  console.log('  THE ROW\'S DISCRIMINATOR: ~50% = the tie device is unshared; 0% = our alignment is '
    + 'INVERTED; 100% = #376\'s three causes are something else.');
} else {
  console.log('\n  NOTHING SCORED — this is not a pass. Every arrangement failed its fixture check.');
}

const cScored = CONTROL.agree + CONTROL.disagree;
console.log('\n  CONTROL — the SAME arrangements with medicham2\'s `tie` stream on a ramp instead of the '
  + 'arm\'s constant:');
console.log('    ' + CONTROL.agree + ' AGREE, ' + CONTROL.disagree + ' DISAGREE out of ' + cScored
  + ' scored  (' + CONTROL.fixture + ' fixture, ' + CONTROL.other + ' other, ' + CONTROL.threw + ' threw)');
const controlMoved = CONTROL.disagree > disagree;
console.log('    ' + (controlMoved
  ? 'THE KNOB REACHED THE RULE — turning the tie die moves turn order, so the rows above are a reading '
    + 'of the alignment and not of an arrangement that could never disagree.'
  : 'THE KNOB DID NOT REACH THE RULE. Every row above is worthless: the arrangements cannot see a tie '
    + 'disagreement even when one is forced.'));
/* WHAT THE FORCED TIE ACTUALLY PARTED ON, printed whichever way the control lands — a control that
 * moved is evidence and a control that did not is a bug in this file, and neither can be read off a
 * count alone. */
for (const x of (CONTROL.disagreements.concat(CONTROL.others)).slice(0, 6)) {
  console.log('      ' + x.id + '  [' + (x.cls || 'move-ordering') + ']');
  console.log('          showdown ' + String(x.showdown).slice(0, 90));
  console.log('          medicham ' + String(x.medicham).slice(0, 90));
}
if (disagreements.length) {
  console.log('\n  THE DISAGREEING ARRANGEMENTS:');
  for (const x of disagreements.slice(0, 20)) {
    console.log('    ' + x.id + '  (both at ' + x.tie_speed + ')');
    console.log('        showdown ' + x.showdown);
    console.log('        medicham ' + x.medicham);
  }
}
if (others.length) {
  console.log('\n  DIVERGED FOR A DIFFERENT REASON — not turn order, and not counted either way:');
  for (const x of others.slice(0, 20)) console.log('    ' + x.id + '  [' + x.cls + ']  '
    + String(x.showdown).slice(0, 70) + '  <>  ' + String(x.medicham).slice(0, 70));
}
if (fixtures.length) {
  console.log('\n  FIXTURE — staged and did not hold, so nothing was measured here:');
  for (const x of fixtures.slice(0, 20)) console.log('    ' + x);
}

/* A PROBE THAT SCORED NOTHING IS A FAILURE, and a probe that found a turn-order disagreement is the
 * defect #376 describes. Both are non-zero exits so a caller cannot read this as green. */
process.exitCode = (!scored || disagree || !controlMoved) ? 1 : 0;
