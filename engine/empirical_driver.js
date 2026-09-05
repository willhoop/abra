/* empirical_driver.js — P(move | species) OVER REAL LADDER CLICKS, AS A DIFFERENTIAL DRIVER.
 *
 * ROADMAP: the empirical-click arm of the whole-game differential (docs/_reports/2026-08-29-real-
 * game-replay-scope.md §6 Option B, and the companion turn-cap report §5).
 *
 * ================= WHAT THIS IS FOR ===============================================================
 *
 * `engine/game_differential.js` drives both engines with `census-coverage-seeking/v1`: at every
 * decision it clicks whatever reaches the least-exercised census row. That driver is not trying to
 * win, so THE GAMES DO NOT END — 944 of 961 (98.2%) are cut off by the 12-turn cap and 17 reach a
 * natural result. The instrument has therefore never compared a game's ENDING, and severity band 1
 * (DIFFERENT-WINNER) has never once been reachable.
 *
 * THE CONTROL THAT PROVES IT IS THE DRIVER AND NOT THE CAP: `data/_bench-order-12-60.json`, 1,000
 * playouts at THE SAME CAP OF 12, medicham2 driving itself, reaches a result 64.1% of the time.
 * 36x at an identical cap.
 *
 * This module supplies the second arm's action selection and NOTHING ELSE. Same swarm teams, same
 * Mode A pinned dice on both sides, same comparators, same census credit rule. Only the choice of
 * action changes, which is what keeps every divergence a RULE rather than noise.
 *
 * ================= WHY THIS IS NOT `rollout_leaf.pickByPrior` CALLED DIRECTLY =====================
 *
 * IT SHOULD HAVE BEEN, AND THE REASON IT IS NOT IS THE PHOTOGRAPH RULE, NOT TASTE.
 *
 * `engine/rollout_leaf.js:706` already implements this draw and `engine/rollout_leaf.js:606`
 * already loads the table. Requiring that file from `game_differential.js` is not available:
 *
 *   (1) `rollout_leaf.js` requires `engine/medicham2-browser.js` and `engine/board.js` FROM THE LIVE
 *       TREE at module load (lines 24-25). `game_differential.js` loads medicham2 out of a FROZEN
 *       RELEASE. Requiring rollout_leaf would pull a SECOND, LIVE copy of the simulator into a
 *       process whose whole purpose is to read only the snapshot — CLAUDE.md's photograph rule
 *       broken by the act of importing the reuse.
 *   (2) `movePriorFor` reads `data/move-priors.json` off the live tree through a module-level memo.
 *       The differential must read it out of the release, because `data/move-priors.json` IS one of
 *       `engine_release.js`'s frozen SOURCES — the table is part of the engine being measured.
 *   (3) Lifting the sampler out of `rollout_leaf.js` into a shared module would add a require edge
 *       to a frozen SOURCE, which `requireClosure()` then demands be added to SOURCES, which strands
 *       every release cut before today the moment anything opens `rollout_leaf.js` out of one
 *       (CLAUDE.md / LESSONS §12: that reached 168 of 200 releases once already). MEASURE does not
 *       get to impose that on the release ladder to save fifteen lines.
 *
 * SO THE SAMPLING RULE IS DUPLICATED, AND THE DUPLICATION IS PINNED BY A TEST RATHER THAN BY A
 * PROMISE. `tests/test-empirical-driver.js` draws the same rows through BOTH implementations across
 * a sweep of u and asserts they return the same move every time. Two producers of one fact is this
 * repo's most-repeated failure; a test that fails the day they diverge is the only version of it
 * that is safe.
 *
 * THE RULE ITSELF, KEPT BYTE-FOR-BYTE FROM `rollout_leaf.pickByPrior`:
 *   weight(move) = the species' recorded p for that move, or 0.02 if the species is profiled but
 *   this move was never observed on it ("carried but never observed: rare, not impossible").
 *   Draw uniformly on the total and walk.
 *
 * ================= WHAT THE TABLE DOES NOT CARRY, SAID BEFORE ANYONE READS A NUMBER ===============
 *
 *   - NO TARGET MODEL. `data/move-priors.json` is P(move | species) and nothing else. The caller
 *     keeps its existing target rule unchanged. `engine/board.js:377` measures humans double-
 *     targeting 23.4% of the time against ~50% for independent choice, so a target model is a real
 *     missing capability and is filed, not faked here.
 *   - NO SWITCH MODEL. The priors say nothing about WHEN to leave. The switch rate is taken from
 *     `data/rollout-switch-census.json`, which is derived from the RAW replay logs of both human
 *     stores by `engine/rollout_switch_census.js` and is upstream of MEDICHAM (not quarantined).
 *     WHICH body to send is unmodelled and is drawn uniformly over the legal bench — declared,
 *     counted, and not to be read as a behaviour claim.
 *
 * ================= BOTH OF THOSE GAPS ARE CLOSED BY A SECOND POLICY, 2026-09-05 ===================
 *
 * `joint-empirical-click/v1` — a THIRD steering arm, not an edit to the second. `empirical-click/v1`
 * keeps meaning exactly what it meant when every figure published under that name was measured; a
 * silent widening would make those figures ambiguous forever. Everything below is inert unless the
 * caller asks for the joint arm by id, and `counters()` carries the joint fields at zero under the
 * other arms so the two artifacts have one shape.
 *
 * WHAT THE OLD ARM ACTUALLY DID ABOUT TARGETS, MEASURED FROM ITS OWN SOURCE RATHER THAN ASSUMED.
 * The comment above says the caller "keeps its existing target rule", and that rule is
 * `game_differential.js`'s `const j = foes.findIndex(q => q && !q.fainted)` — the LOWEST LIVE INDEX,
 * every time, for both slots. That is not the "~50% independent choice" the board.js line contrasts
 * humans against: it is 100% double-targeting, at the same foe, all game. The consequence is
 * structural rather than statistical — the foe standing in slot b is never named by a single-target
 * move at all until slot a is permanently empty, so three of a four-body bring are removed through
 * one lane while the fourth stands at full HP.
 *
 * THE HUMAN NUMBER, DERIVED — `engine/joint_click_census.js` -> `data/joint-click-census.json`, over
 * 101,995 finished Champions games from both raw human stores:
 *
 *   both actives clicked a single-foe move, both foes alive at turn start, no redirect, no `[from]`,
 *   no `[spread]`, and no faint between the two clicks:   62,154 of 159,951 name the SAME foe
 *                                                         = 38.9%   (bounds 29.1% - 54.1%)
 *
 *   the bounds carry the 53,309 AMBIGUOUS pairs, where a defending body fainted between the two
 *   clicks and Showdown re-aimed the second move onto the survivor, so the chosen target is not
 *   observable. They are bounded, never counted.
 *
 * AND THE SWITCH RATE IS NOT ONE NUMBER. `data/rollout-switch-census.json` gives one pooled
 * conditional rate. The same walk conditioned on context — HP band, tenure on the field, bench size —
 * spans 3.8% to 18.5% across 21 populated cells, a factor of five that a single constant cannot
 * express in either direction:
 *
 *   full HP, just switched in, one body on the bench      3.8%
 *   under a third HP, settled, two on the bench          18.5%
 *
 * WHICH BODY, MEASURED AND DELIBERATELY NEARLY-NOTHING. On a bench holding both a body that has
 * already been on the field and one that has not, humans send the debutant 52.8% of the time against
 * the 50.0% a uniform draw gives. It is wired because it is one derived number and it closes the
 * declared gap rather than halving it, and it is reported with that 2.8-point margin attached so
 * nobody reads it as a behaviour claim it cannot support.
 *   - ONLY THE TOP 8 MOVES AND TOP 4 LEADS PER SPECIES are in the table (`engine/policy.js`), and a
 *     species needs 15 recorded acts to be profiled at all. So `p` sums to slightly under 1 and the
 *     tail is exactly the 0.02 floor above.
 *
 * ================= NO SILENT FALLBACK ============================================================
 *
 * Every degradation below is a COUNTER the run prints, including its zero. `rollout_leaf.js`'s
 * census fallback is the cautionary case: it degrades loudly to stderr and nobody was reading the
 * line. A counter in the artifact cannot be skimmed past the same way.
 */
'use strict';

/* The species key. `engine/policy.js:48` writes the table with `s.toLowerCase().replace(/[^a-z0-9]/g,'')`
 * over the ingest's species field, which is exactly Showdown's `species.id` form — MEASURED, not
 * assumed: 336 of the format's 347 legal species ids hit a row directly. The 11 that do not are
 * in-battle cosmetic formes (castformsunny, castformrainy) and pattern formes (vivillon*, alcremie*),
 * which is why `baseId` below exists as a SECOND, SEPARATELY COUNTED lookup rather than as a silent
 * widening of the first. */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE TABLE ---------------------------------------------------------------------------------
 * `bytes` is the raw JSON text. The caller reads it (from a release, from a pin, from the live tree)
 * and says where it came from; this file never decides that, because "which copy of the engine's
 * behaviour table did this run use" is a provenance question and provenance belongs to the caller
 * that holds the release handle. */
function loadPriors(bytes, where) {
  let j;
  try { j = JSON.parse(bytes); }
  catch (e) {
    throw new Error('empirical_driver: ' + (where || 'move-priors') + ' did not parse — ' + e.message
      + '\n  This table IS the driver. Continuing without it would play an unsteered sample and '
      + 'report it as an empirical one.');
  }
  const sp = j && j.species;
  if (!sp || typeof sp !== 'object' || !Object.keys(sp).length) {
    throw new Error('empirical_driver: ' + (where || 'move-priors') + ' carries no `species` rows. '
      + 'That is not a behaviour table, and a run driven by it would be driven by nothing.');
  }
  const byKey = new Map();
  let moveRows = 0, leadRows = 0, acts = 0;
  /* THE PROTECT FAMILY IS READ OFF THE TABLE'S OWN `kind` FIELD, NEVER TYPED. `engine/policy.js:351`
   * stamps `kind` on every row through `engine/moves-meta.js:classify`, so the membership question is
   * answered by the same artifact the weights come from. (Cross-checked against `data/tags.json`'s
   * `shieldsUser` tag: identical for the five members this format can reach — protect, detect,
   * spikyshield, banefulbunker, kingsshield.) It is a UNION over species rows, because a family
   * member absent from one species' top-8 is still that family member when another species carries
   * it. Used only by the counters below; no draw reads it. */
  const family = new Set();
  for (const v of Object.values(sp)) {
    for (const m of ((v && v.moves) || []).concat((v && v.lead) || [])) {
      if (m && m.mv && m.kind === 'protect') family.add(String(m.mv));
    }
  }
  let famActs = 0;
  for (const [k, v] of Object.entries(sp)) {
    const moves = new Map(), lead = new Map();
    for (const m of (v.moves || [])) if (m && m.mv && m.p > 0) { moves.set(String(m.mv), m.p); moveRows++; }
    for (const m of (v.lead || [])) if (m && m.mv && m.p > 0) { lead.set(String(m.mv), m.p); leadRows++; }
    if (!moves.size) continue;                 // a row with no usable move distribution is not a row
    acts += (v.acts || 0);
    /* `famP` — the share of THIS species' recorded clicks that were a protect-family move. Kept on
     * the row so the acts-weighted input rate below is computed from the same numbers the draw uses,
     * rather than from a second pass over the JSON that could read the table differently. */
    let famP = 0;
    for (const [mv, p] of moves) if (family.has(mv)) famP += p;
    famActs += famP * (v.acts || 0);
    byKey.set(norm(k), { key: norm(k), moves, lead, acts: v.acts || 0, famP });
  }
  if (!byKey.size) {
    throw new Error('empirical_driver: ' + (where || 'move-priors') + ' parsed but every species row '
      + 'was empty after filtering p > 0.');
  }
  FAMILY = family;      // published for the counters in drawMove; no draw reads it
  return { byKey, species: byKey.size, move_rows: moveRows, lead_rows: leadRows,
           acts, generated: (j && j.generated) || null, from: where || null,
           /* WHAT THIS TABLE ITSELF SAYS THE PROTECT RATE IS — the number the driver's realised rate
            * has to be read against. Acts-weighted over every profiled row, because that is the
            * denominator a click share is measured in. */
           family: [...family].sort(),
           input_family_share_pct: acts ? +(100 * famActs / acts).toFixed(3) : null };
}

/* THE VOLUNTARY-SWITCH RATE, READ AND NEVER TYPED.
 *
 * `pct_decisions_with_a_bench_that_are_a_voluntary_switch` is the CONDITIONAL rate and it is the one
 * that matches this denominator: the draw below only happens when a live body is on the bench.
 * `rollout_leaf.js:651` records what using the marginal rate instead cost — a playout switching at
 * 3.9% while claiming 7.7%, every line of the draw correct.
 *
 * ABSENT IS A REFUSAL, NOT A ZERO. A zero switch rate is a driver that cannot leave, and a driver
 * that cannot leave will not end a game like a real one — which is the entire question this arm was
 * built to answer. `rollout_leaf.js` degrades to 0 here and announces it on stderr; this refuses,
 * because a whole measurement would be spent before anyone read the line. */
function switchRateFrom(bytes, where) {
  let j;
  try { j = JSON.parse(bytes); }
  catch (e) {
    throw new Error('empirical_driver: ' + (where || 'rollout-switch-census') + ' did not parse — '
      + e.message);
  }
  const p = j && j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  if (typeof p !== 'number' || !(p > 0)) {
    throw new Error('empirical_driver: ' + (where || 'rollout-switch-census') + ' carries no usable '
      + '`pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch`. Refusing to run: the '
      + 'fallback is a driver that CANNOT SWITCH, and a game that cannot switch does not end like a '
      + 'real one. Rebuild it: node engine/rollout_switch_census.js');
  }
  return { rate: p / 100, pct: p, games: (j.pooled && j.pooled.games) || null,
           decisions_with_a_live_bench: (j.pooled && j.pooled.decisions_with_a_live_bench) || null,
           generated: j.generated || null, from: where || null };
}

/* ---- THE JOINT MODEL, LOADED THE SAME WAY AND REFUSING THE SAME WAY ------------------------------
 *
 * `data/joint-click-census.json` is NOT an engine SOURCE and is read live, for exactly the reason
 * `data/rollout-switch-census.json` is: it is a fact about HUMAN play read off raw Showdown protocol,
 * upstream of MEDICHAM, and not part of the engine being measured. The caller digests it into the
 * steering block so two arms can be shown to have used the same bytes.
 *
 * EVERY DEGRADATION IS A REFUSAL, NOT A DEFAULT. A missing focus rate would fall back to whatever the
 * caller did before, which is 100% focus wearing a joint label — the exact shape of the failure this
 * repository is named after. */
const CELL_MIN_N = 500;   // a cell thinner than this is not a rate, it is an anecdote

function loadJoint(bytes, where) {
  const w = where || 'joint-click-census';
  let j;
  try { j = JSON.parse(bytes); }
  catch (e) { throw new Error('empirical_driver: ' + w + ' did not parse — ' + e.message); }
  const p = j && j.pooled;
  const jt = p && p.joint_target;
  const sw = p && p.switch;
  const focus = jt && jt.pct_same_foe_clean;
  if (typeof focus !== 'number' || !(focus > 0) || !(focus < 100)) {
    throw new Error('empirical_driver: ' + w + ' carries no usable '
      + '`pooled.joint_target.pct_same_foe_clean`. Refusing to run: the fallback is the caller\'s own '
      + 'target rule, which names the lowest live foe every time — 100% focus reported under a joint '
      + 'label. Rebuild it: node engine/joint_click_census.js --write');
  }
  const pooledRate = sw && sw.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  if (typeof pooledRate !== 'number' || !(pooledRate > 0)) {
    throw new Error('empirical_driver: ' + w + ' carries no usable pooled switch rate.');
  }
  const cells = new Map();
  for (const [k, v] of Object.entries((sw && sw.by_cell) || {})) {
    if (!v || typeof v.pct !== 'number' || !(v.decisions > 0)) continue;
    cells.set(k, { n: v.decisions, rate: v.pct / 100 });
  }
  if (!cells.size) {
    throw new Error('empirical_driver: ' + w + ' carries no `pooled.switch.by_cell` rows. The '
      + 'context table IS the switch model under this policy; without it the arm is the previous arm '
      + 'with a different name on it.');
  }
  const ch = p.switch_in_choice || {};
  const pNew = typeof ch.pct_mixed_bench_chose_new === 'number' ? ch.pct_mixed_bench_chose_new / 100 : null;
  if (pNew === null) {
    throw new Error('empirical_driver: ' + w + ' carries no `pooled.switch_in_choice.'
      + 'pct_mixed_bench_chose_new`, so WHICH body to send would silently stay uniform while the '
      + 'policy id claims the gap is closed.');
  }
  return { pFocus: focus / 100, pFocusPct: focus, pNewBody: pNew, pNewBodyPct: ch.pct_mixed_bench_chose_new,
           uniformWouldGivePct: ch.pct_mixed_bench_uniform_would_give,
           cells, cellRows: cells.size, cellMinN: CELL_MIN_N,
           pooledRate: pooledRate / 100, pooledRatePct: pooledRate,
           games: p.games || null, clean_pairs: jt.clean_pairs || null,
           bounds: [jt.pct_same_foe_lower_bound, jt.pct_same_foe_upper_bound],
           generated: j.generated || null, from: w };
}

/* THE CELL KEY IS BUILT IN ONE PLACE AND BY ONE FUNCTION, because the census writes it and the driver
 * reads it, and two spellings of one key is this repository's most expensive recurring failure. The
 * bands are the census's own — see `hpBand`/`tenureBand` in engine/joint_click_census.js. */
function cellKey(hpPct, tenure, bench) {
  const hp = hpPct == null ? 'unknown'
    : hpPct >= 100 ? 'full' : hpPct > 66 ? 'hp_67_99' : hpPct > 33 ? 'hp_34_66' : 'hp_1_33';
  const t = tenure == null ? 'tenure_unknown' : tenure <= 0 ? 'tenure_0' : tenure === 1 ? 'tenure_1' : 'tenure_2plus';
  return hp + '|' + t + '|bench_' + Math.min(2, Math.max(1, bench));
}

/* The rate for one decision. A cell that is absent, or thinner than CELL_MIN_N, falls back to the
 * POOLED rate and says so in a counter — not because a thin cell is wrong, but because a rate read
 * off 131 decisions and a rate read off 391,253 must not be indistinguishable in the artifact. */
function switchRateAt(J, C, key) {
  const c = J.cells.get(key);
  if (!c) { C.joint_cell_absent++; return J.pooledRate; }
  if (c.n < J.cellMinN) { C.joint_cell_too_thin++; return J.pooledRate; }
  C.joint_cell_hit++;
  return c.rate;
}

/* ---- THE JOINT TARGET DRAW ---------------------------------------------------------------------
 *
 * TWO SLOTS, ONE DRAW, AND NO STATE. The obvious construction is a per-turn memo: the first slot to
 * ask picks a foe and the second consults it. That is STATE, and `game_differential.js`'s
 * `driverSnap`/`driverRestore` header records what state in this driver costs — the planted-
 * comparator proofs silently become a DIFFERENT GAME from their clean arm. So both slots compute the
 * SAME anchor from the SAME address, and only the second slot draws again to decide whether to join
 * it. Asking twice returns the same answer, which is correct here: it is one decision.
 *
 *   anchorAt(live, u)               the foe this side is looking at, uniform over the live foes
 *   joinOrSplit(live, anchor, ...)  the partner joins with probability pFocus, else takes another
 *
 * WITH ONE LIVE FOE THERE IS NO CHOICE and the caller must not consult this at all — a "focus rate"
 * measured over forced targets is not a focus rate, which is why the census conditions on both foes
 * being alive at turn start and why `forced` is counted separately here. */
function anchorAt(live, u) {
  if (!live || !live.length) return null;
  return live[Math.min(live.length - 1, Math.floor(u * live.length))];
}
function joinOrSplit(live, anchor, pFocus, uJoin, uPick) {
  if (!live || !live.length) return null;
  if (live.length === 1) return live[0];
  if (uJoin < pFocus) return anchor;
  const others = live.filter(x => x !== anchor);
  if (!others.length) return anchor;
  return others[Math.min(others.length - 1, Math.floor(uPick * others.length))];
}

/* WHICH BODY. `debutants` are the bench bodies that have never stood on the field; `veterans` have.
 * On a MIXED bench the debutant is taken with probability pNewBody (52.8% measured, against 50.0% for
 * uniform). On a bench that is all one kind there is nothing to prefer and the draw is uniform — the
 * same case the census reports as carrying no information. */
function pickBody(debutants, veterans, pNew, uGroup, uPick) {
  const all = debutants.concat(veterans);
  if (!all.length) return null;
  let group = all;
  if (debutants.length && veterans.length) group = (uGroup < pNew) ? debutants : veterans;
  return group[Math.min(group.length - 1, Math.floor(uPick * group.length))];
}

/* ---- THE `prefer` AXIS DOES NOT NARROW THIS ARM'S DRAW — 2026-09-05 ----------------------------
 *
 * THE DEFECT, MEASURED AT THE LINE. `empirical-click/v1` realised a protect-family share of 32.8% of
 * its clicks against the 13.565% its OWN input table (`data/move-priors.json`, acts-weighted over
 * 435,700 recorded acts) says it is sampling, and against 14.76% for real humans. It protected again
 * after protecting 68.6% of the time where humans do it 10.5%. The weights were never the cause: on
 * decisions where the body had its full four moves the arm realised 15.3% protect, which is the human
 * rate. The amplification was ENTIRELY in which candidates reached the draw.
 *
 * `engine/game_differential.js`'s `DRIVER_AXES` gives two of the swarm's nine configurations a
 * `prefer` set that contains the protect family — `pair-protect-bust` (byTag stalling/oneTurnGuard)
 * and `pair-redirect-priority`, because every member of the family is +4 PRIORITY and so is inside
 * `byTag('moves','priority')` as well. `empiricalPick` then took `use = pref` as a HARD narrowing at
 * EVERY decision of every turn of every game in those configurations. Measured over 8,885 draws of a
 * 120-game run: 1,975 decisions (22.2%) reached the sampler with exactly ONE candidate, and 1,183 of
 * those single candidates were Protect. More than half of the arm's protect clicks were not sampled
 * at all — the candidate list held nothing else.
 *
 * THAT IS A COVERAGE DEVICE APPLIED TO A BEHAVIOUR CLONE. Under `census-coverage-seeking/v1` a hard
 * preference is coherent: nobody is playing a game, and the point is to stage a rare interaction. This
 * arm exists BECAUSE the coverage arm's games never end, and its whole contract is that the click
 * distribution is the table's. A narrowing that decides 22% of its decisions is not a staging device
 * in that context; it is a second, undeclared policy overriding the declared one — and it took the
 * SWITCH candidates with it, because a bench candidate never carries `prefer`, so the declared switch
 * model was silently off in two configurations of nine.
 *
 * SO THE PAIR CONFIGURATIONS STAGE THROUGH THE TEAMS THEY SELECT, WHICH IS WHERE THE ARM CAN STILL
 * HONESTLY STAGE. `diff_swarm.configs` already picks teams that carry both halves of the pair; what
 * changes is that the interaction now happens at the rate the behaviour table produces it rather than
 * on every turn. THE COVERAGE ARM IS NOT TOUCHED and still forces the click on every decision — it is
 * the arm those configurations were built for, and Will's rule stands: *"thats why we have both."*
 *
 * THE KNOB RESTORES THE DEFECT, and exists so the probe can be shown RED. `MEDI_PREFER_HARD=1` puts
 * the hard narrowing back exactly as it was; `tests/probe_protect_amplification.js` runs both ways.
 * It is read once, here, so a run cannot be half one policy and half the other, and the value is
 * reported in the counters so an artifact says which policy produced it. */
const PREFER_HARD = process.env.MEDI_PREFER_HARD === '1';

/* `pool` is the caller's full candidate list (moves AND bench). Returns the list the draw may use.
 * The counters are the caller's block, incremented here so the two policies count identically. */
function preferPool(pool, C) {
  const pref = (pool || []).filter(c => c && c.prefer);
  if (!pref.length || pref.length === pool.length) return pool;
  if (C) C.prefer_would_have_narrowed++;
  if (!PREFER_HARD) return pool;
  if (C) C.prefer_narrowed++;
  return pref;
}

/* ---- THE DRAW ----------------------------------------------------------------------------------
 * `ids`  the LEGAL move ids for this body, already filtered by the caller from Showdown's own
 *        request. Legality is never re-decided here.
 * `row`  a byKey entry, or null when the species is not profiled.
 * `lead` true on turn 1, where the table carries its own turn-1 distribution.
 * `u`    a uniform variate in [0,1). Supplied by the caller so the draw is addressable and
 *        reproducible rather than stateful — see game_differential.js's driver address.
 *
 * Returns { id, weights, informed } where `informed` is false when EVERY legal move fell to the
 * 0.02 floor, i.e. the table had nothing to say about this body's actual moveset. That is a distinct
 * state from "no row at all" and it is counted separately, because a uniform draw wearing an
 * empirical label is the failure this arm exists to avoid. */
const UNOBSERVED = 0.02;      // rollout_leaf.js:718 — "carried but never observed: rare, not impossible"
/* THE NAME OF THE WEIGHTING RULE IN FORCE, STAMPED INTO EVERY PROBE DUMP. A dump that does not say
 * which rule produced it cannot be compared with one taken after a rule change, and this file's whole
 * subject is a rule change. */
const DRAW_RULE = 'renormalise-over-legal/v1';

/* ---- THE OBSERVATIONAL DRAW LOG — `MEDI_DRAW_PROBE=<file>` (2026-09-05) -------------------------
 *
 * OFF UNLESS THE VARIABLE NAMES A FILE, and it changes no weight, no variate and no returned move —
 * it appends a copy of what `drawMove` was already about to do. An ordinary run is byte-identical.
 *
 * IT EXISTS BECAUSE THE FIRST FORK IN THIS DIAGNOSIS IS UNANSWERABLE FROM THE OUTSIDE. A realised
 * protect share measured off the emitted stream says WHAT was clicked; it cannot say whether the
 * sampler picked protect more often than its own weight said (a draw defect) or exactly as often as
 * its weight said (a weight defect). Those need opposite fixes, so the run has to record both the
 * weight vector and the pick. Every row here is one decision, so any candidate weighting rule can be
 * re-scored against the SAME corpus of decisions without paying for another run.
 *
 * It writes on process exit rather than per call, because the caller runs two arms in one process and
 * a partial file would look like a short run. */
const PROBE_OUT = process.env.MEDI_DRAW_PROBE || null;
const PROBE = PROBE_OUT ? [] : null;
/* THE FAMILY AND THE COUNTER BLOCK, REACHED FROM INSIDE `drawMove`.
 *
 * `drawMove` is handed a row and a variate and nothing else — no counter block, no table handle — so
 * a realised-rate counter has nowhere to land without changing its signature at the call site, which
 * lives in `engine/game_differential.js`. These two module-level handles are the smaller change:
 * `loadPriors` publishes the family it derived, `counters()` publishes the block it just minted, and
 * `drawMove` increments through them. ONE table and ONE counter block per process is the caller's own
 * construction (`EMP_PRIORS`/`EMP_C` are each built once), so there is nothing here to get out of
 * step; if that ever stops being true these counters go stale silently, which is why the assertion is
 * written down here rather than assumed.
 *
 * NOTHING BELOW STEERS A DRAW. They are counters. */
let FAMILY = new Set();
let LAST_C = null;
if (PROBE_OUT) {
  process.on('exit', () => {
    try {
      require('fs').writeFileSync(PROBE_OUT, JSON.stringify({
        what: 'every drawMove decision: the legal ids, the weight the sampler gave each, and which it '
            + 'returned. Observational; no draw is changed by this block.',
        generated: new Date().toISOString(),
        rule: DRAW_RULE, unobserved_floor: UNOBSERVED,
        decisions: PROBE,
      }) + '\n');
      process.stderr.write('  MEDI_DRAW_PROBE wrote ' + PROBE.length + ' decisions to ' + PROBE_OUT + '\n');
    } catch (e) {
      /* NOT SWALLOWED. A probe that fails to write must say so, or a missing file reads as a run that
       * never drew anything. */
      process.stderr.write('  MEDI_DRAW_PROBE FAILED TO WRITE ' + PROBE_OUT + ': ' + e.message + '\n');
    }
  });
}

function drawMove(row, ids, lead, u) {
  if (!row || !ids || !ids.length) return null;
  const table = (lead && row.lead && row.lead.size) ? row.lead : row.moves;
  const weights = [];
  let tot = 0, informed = false;
  for (const mv of ids) {
    let w = table.has(mv) ? table.get(mv) : (row.moves.has(mv) ? row.moves.get(mv) : UNOBSERVED);
    if (table.has(mv) || row.moves.has(mv)) informed = true;
    weights.push([mv, w]); tot += w;
  }
  if (!(tot > 0)) return null;
  let x = u * tot, picked = weights[weights.length - 1][0];
  for (const [mv, w] of weights) { x -= w; if (x <= 0) { picked = mv; break; } }
  if (PROBE) PROBE.push({ sp: row.key || null, lead: !!lead, u: +u.toFixed(6), tot: +tot.toFixed(6),
                          picked, informed, w: weights.map(([mv, w]) => [mv, +w.toFixed(6)]) });
  /* THE REALISED PROTECT SHARE, AND THE SHARE THE WEIGHTS THEMSELVES ASKED FOR, COUNTED AT THE LINE.
   * Both, because they answer different questions and only the pair is diagnostic: `expected` is what
   * this decision's weight vector said, `clicked` is what came out. They agree when the sampler is
   * faithful, and a gap between them is a draw defect rather than a weighting one. */
  if (LAST_C && FAMILY.size) {
    let famW = 0, anyFam = false;
    for (const [mv, w] of weights) if (FAMILY.has(mv)) { famW += w; anyFam = true; }
    LAST_C.protect_draws++;
    if (anyFam) {
      LAST_C.protect_legal++;
      LAST_C.protect_expected_x1e6 += Math.round(1e6 * famW / tot);
      if (FAMILY.has(picked)) LAST_C.protect_clicked++;
    }
  }
  return { id: picked, weights, informed };
}

/* ---- THE COUNTERS ------------------------------------------------------------------------------
 * "A capability that cannot prove it ran is assumed broken." Every one of these is printed by the
 * run INCLUDING ITS ZERO, and every one names a state the driver can be in. There is no bucket for
 * "something else happened". */
function counters() {
  const C = {
    decisions: 0,                 // every empirical decision this driver reached
    move_from_prior: 0,           // a move drawn from the species' recorded distribution
    lead_table_used: 0,           // ... of those, drawn from the turn-1 table
    uninformed_draw: 0,           // a row existed but NONE of the legal moves were in it (all 0.02)
    no_prior_row: 0,              // the species is not profiled at all — the loud state
    row_via_base_forme: 0,        // matched only after falling back to the base species id
    switch_reached_the_draw: 0,   // decisions where a live bench existed
    switch_offered: 0,            // ... the draw said leave
    no_bench: 0,                  // decisions with nowhere to go
    trapped: 0,                   // showdown refused to offer a switch at all
    prefer_narrowed: 0,           // a pair-* configuration restricted the pool before the draw —
                                  //   ZERO unless MEDI_PREFER_HARD=1 restores the pre-2026-09-05 rule
    prefer_would_have_narrowed: 0,// ... how many decisions the old hard rule WOULD have narrowed. Kept
                                  //   because "the axis stopped narrowing" and "no configuration
                                  //   preferred anything" are different states and must not read alike
    prefer_hard_narrowing: PREFER_HARD ? 1 : 0,  // WHICH policy this run used, in the artifact
    ban_narrowed: 0,              // an omit-* configuration removed at least one legal click
    no_move_candidates: 0,        // only switches were available (the caller's own fallbacks apply)
    /* ---- THE PROTECT RATE, COUNTED AT THE LINE (2026-09-05) -------------------------------------
     * The arm's realised protect-family share is the one number that can be checked against the
     * driver's OWN INPUT without a second measurement: `move-priors.json` is acts-weighted 13.565%
     * protect, so a realised share far from that is the driver failing to sample the table it claims
     * to sample. `expected` is what the weight vectors asked for and `clicked` is what came out; a
     * gap between THOSE two is a sampler defect, and their agreement moves the question onto the
     * weights. Reported as a percentage by the caller; carried as an integer x1e6 sum so the
     * artifact is exact rather than float-accumulated. */
    protect_draws: 0,             // drawMove calls reached (the denominator for `legal`)
    protect_legal: 0,             // ... with at least one protect-family move among the legal ids
    protect_expected_x1e6: 0,     // ... sum over those of the weight share the family held
    protect_clicked: 0,           // ... and the draw returned a family member
    first_no_prior_row: '',       // the first unprofiled species, named — a bare count sends the
                                  // reader back to guess which row it was
    /* ---- THE JOINT ARM'S OWN COUNTERS -----------------------------------------------------------
     * ZERO BY CONSTRUCTION UNDER `empirical-click/v1`, and carried there anyway so the two arms have
     * ONE counter shape and a reader never has to work out whether an absent field means the
     * capability was off or the capability is broken. */
    joint_target_draws: 0,        // a slot named a foe through the joint model
    joint_target_forced: 0,       // ... of the decisions, the ones with only one live foe: no choice
    joint_anchor: 0,              // the slot that set this side's anchor for the turn
    joint_joined: 0,              // the partner joined the anchor (focus fire)
    joint_split: 0,               // the partner took the other foe
    joint_cell_hit: 0,            // the switch rate came from a context cell with enough data
    joint_cell_too_thin: 0,       // ... the cell existed and was under CELL_MIN_N: pooled rate used
    joint_cell_absent: 0,         // ... no such cell at all: pooled rate used
    joint_body_mixed_bench: 0,    // a bench holding both a debutant and a returning body
    joint_body_chose_debutant: 0, // ... and the debutant was taken
    joint_body_uniform: 0,        // the bench was all one kind — nothing to prefer
  };
  LAST_C = C;                     // published for the protect counters in drawMove; see FAMILY above
  return C;
}

/* Resolve a body to a row, counting HOW it resolved. `id` is Showdown's `species.id`; `baseId` is
 * the base forme's id, or null when the caller cannot supply one. */
function rowFor(P, C, id, baseId) {
  const k = norm(id);
  let row = P.byKey.get(k) || null;
  if (row) return row;
  const b = baseId ? norm(baseId) : null;
  if (b && b !== k) {
    row = P.byKey.get(b) || null;
    if (row) { C.row_via_base_forme++; return row; }
  }
  C.no_prior_row++;
  if (!C.first_no_prior_row) C.first_no_prior_row = String(id || '?');
  return null;
}

module.exports = { loadPriors, switchRateFrom, drawMove, counters, rowFor, norm, UNOBSERVED,
                   preferPool, PREFER_HARD, DRAW_RULE,
                   loadJoint, cellKey, switchRateAt, anchorAt, joinOrSplit, pickBody, CELL_MIN_N };
