/* million_run.js — THE RATE RUNNER. It plays MEDICHAM at volume and tallies what the dice ACTUALLY
 * did against what `data/million-targets.json` says they should do. ROADMAP #133.
 *
 * ================= WHY THIS FILE EXISTS AT ALL =====================================================
 *
 * Nothing in this repository did this before 2026-08-11, and three files look like they do:
 *
 *   engine/million_targets.js   the WORK LIST. Its own header: "Runs no games." 233 rows, nine
 *                               families. It says what a rate SHOULD be; it never observes one.
 *   engine/mew_farm.js          a real hardened farm — driving the OFFICIAL Showdown simulator
 *                               through engine/champions_sim.js. A million of those measures the
 *                               AUTHORITY'S sampler, which nobody doubts. Wrong engine.
 *   tests/bench-medicham.js     plays MEDICHAM at volume and TIMES it. Tallies nothing else.
 *
 * The only rate-tallying code anywhere is `secondaryRates()` in engine/replay_differential.js behind
 * `--rates`: one family of nine, over stored human replays rather than self-play, with a denominator
 * approximated by scanning the next five events. Its own header calls it deferred.
 *
 * ================= THE THREE RULES THIS FILE IS BUILT AROUND =======================================
 *
 * 1. IT OPENS A FROZEN RELEASE AND NEVER READS HEAD. `--release <id>`, or the pointer. A measurement
 *    is a PHOTOGRAPH: on 2026-08-04 three agents ran at once with their FILES separated and a
 *    7,100-game run was destroyed anyway, because the SIMULATOR moved under it four times in eight
 *    minutes. See engine/engine_release.js for the receipt.
 *
 * 2. THE RNG IS FREE-RUNNING, AND THAT IS NOT THE DEFAULT ANYWHERE NEAR HERE.
 *
 *    **READ THIS BEFORE BUILDING ANYTHING ON TOP OF THIS FILE.** ROADMAP #88: every die in the
 *    differential drivers is PINNED to one corner, deliberately — speed ties resolve to input order,
 *    every sub-100% move MISSES on both sides, damage is always the max roll. That pin is correct for
 *    finding a wrong RULE and it is FATAL for a wrong RATE. A pinned rate run produces a beautiful,
 *    confident, meaningless number and nothing in the repository would say so.
 *
 *    MEDICHAM itself is not pinned — `battleTurn(S, rng, ...)` takes the rng as a PARAMETER, and
 *    tests/bench-medicham.js:61 already passes a free-running one. The pin arrives for free if you
 *    build on `engine/steering.js` or the differential drivers, which is the obvious way to build
 *    this. So this file supplies its own stream (mulberry32, seeded, uniform on [0,1)), never touches
 *    those drivers, and PROVES the difference: `--red-proof` runs the same games with the rng pinned
 *    high and REQUIRES the instrument to flag the collapse. If a pinned engine can pass this
 *    instrument, the instrument is blind.
 *
 * 3. THE DENOMINATOR COMES FROM THE TARGET ROW, NEVER FROM CLICKS. Every row of
 *    `data/million-targets.json` carries a `denominator` sentence, written when the row was derived.
 *    A CLICK IS NOT A TRIAL: a Rock Slide that missed, was Protected, hit an immune body or was
 *    filtered by Shield Dust never reached the flinch die. This file implements a denominator per
 *    family, carries the row's own prose beside it in the artifact so the two can be read against
 *    each other, and REFUSES to publish a rate for any row whose stated denominator it cannot
 *    implement — `not_observable`, with the reason, rather than a number over the wrong base. A rate
 *    over the wrong denominator is worse than no rate because it looks like an answer.
 *
 * ================= HOW IT OBSERVES, AND WHAT THAT SCOPES OUT =======================================
 *
 * MEDICHAM emits a Showdown-shaped protocol trace when armed (`battleInit(A,B,{trace:[]})`, ROADMAP
 * #68). This file parses THAT — the same stream engine/game_differential.js compares against the
 * authority — rather than instrumenting the engine, because the engine belongs to ENGINE and is being
 * rewritten while this runs. No line of medicham2 is touched or needed.
 *
 * WHAT THAT MEANS FOR SCOPE, said plainly: this instrument tests the SAMPLER, not ELIGIBILITY. The
 * denominators ask the engine's own `canTakeStatus` and the engine's own tag artifact whether a trial
 * was eligible. If the engine is wrong about WHO CAN BE BURNED, that shows up here as a wrong
 * denominator and not as a wrong rate. Eligibility is what tests/roster.js and the replay differential
 * are for. Two instruments, two questions; conflating them is how a wrong rule hides inside a right
 * rate.
 *
 * ================= COVERAGE IS A PROPERTY OF THE ACTION SET, NOT OF N =============================
 *
 * `data/million-targets.json`'s own `corpus_warning` says it: a self-play corpus where nobody
 * switches yields ZERO samples for entry abilities, hazard chip and Regenerator, HOWEVER MANY GAMES
 * RUN. ROADMAP #63 records that the rollout has no switch branch at all — `chooseAction()` in
 * medicham2 returns moves and only moves.
 *
 * A runner that hides that is worse than none, so this one COUNTS it rather than asserting it: the
 * artifact carries `coverage`, listing every target row that got ZERO trials, and `structural`,
 * which reports the observed number of switch events in the corpus. If that number is zero, every
 * entry-triggered row in the target list is unreachable at any N and the artifact says so on its own
 * evidence. Ten million games do not buy one Intimidate.
 *
 * ================= THE DECLARATION GATE (#132 BEFORE #133) ========================================
 *
 * ROADMAP #132's own row says do it BEFORE #133. Running a million games to check a rate we have not
 * finished DECLARING is checking our code against our own mistake. So before a single game is played
 * this file re-derives every secondary chance from `Dex.forFormat` and compares it to what the ENGINE
 * actually samples with (`data/move-effects.js` in the frozen release, which is what the secondary
 * loop reads). A row where those two disagree is REFUSED — measured, reported, never scored.
 *
 *   node engine/million_run.js --release f65caf5625fe --games 400
 *   node engine/million_run.js --release <id> --declaration-only     # the #132 gate, no games
 *   node engine/million_run.js --release <id> --games 400 --no-write
 *
 * MILLIONRUN_SABOTAGE exists ONLY to show this file's refusals red, and it can never produce an
 * artifact. Nothing else reads it. One mode per refusal:
 *   flagger               disables the divergence flagger, so both self-play red proofs go UNCAUGHT.
 *   refusal               lets the declaration gate's refused (move, effect) pairs through into the
 *                         tally, so the leak check sees a row scored against a rejected declaration.
 *   dumpseal              leaves --dump-status open across the pinned proof, reproducing the
 *                         1,824-against-1,818 contamination the dump identity check caught.
 *   staged-precondition   (--staged) forces reached() true, so the TRIGGER-CONTROL arms collect
 *                         trials on boards where the mechanic was never asked. Shown red 2026-08-11:
 *                         13 of 17 control arms went from 0 trials to 60 and the run refused.
 *   staged-declaration    (--staged) moves the target-list surface 25 points and disables the
 *                         fixture's own refusal, so the staged leak check sees rows scored against a
 *                         declaration the cross-check rejected. Shown red 2026-08-11: 10 rows.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
const argOf = (k, d) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : d; };
const GAMES = +argOf('--games', 200);
const SEED = +argOf('--seed', 20260811);
const RELID = argOf('--release', null);
const TURN_CAP = +argOf('--turn-cap', 20);
const TEAM = +argOf('--team', 4);
const OUT = argOf('--out', path.join(ROOT, 'data', 'million-run.json'));
const NO_WRITE = ARGS.includes('--no-write');
const DECL_ONLY = ARGS.includes('--declaration-only');
/* ---- THE STAGED ARM — ROADMAP #196 --------------------------------------------------------------
 * `--staged` plays CONSTRUCTED boards instead of random self-play, with the dice still free, and it
 * exists for one reason: on a staged board the TRIGGER IS REACHED BY CONSTRUCTION, so the denominator
 * is real rather than invented. See the STAGED ARM block at the foot of this file. It writes its own
 * artifact and never touches data/million-run.json. */
const STAGED = ARGS.includes('--staged');
const TRIALS = +argOf('--trials', 300);
const STAGED_OUT = argOf('--staged-out', path.join(ROOT, 'data', 'million-run-staged.json'));
/* ---- THE STOPPING RULE IS POWER PER ROW, NOT A TOTAL GAME COUNT ---------------------------------
 *
 * Will, 2026-08-11: *"I keep saying million but really its just however many games we need for each
 * staging to be certain of our chances and odds of procing."* "A million games" was always shorthand.
 *
 * THE 50,000-GAME SELF-PLAY RUN IS THE ARGUMENT. It put 20,987 trials on its busiest row — enough to
 * catch a ONE-POINT error — while other rows sat at ZERO. That run was not too small; it was badly
 * SHAPED, and more total games make the over-powered row more over-powered without moving the blind
 * ones at all. A staged arm can aim, so it should: each row runs until IT is powered, and then stops.
 *
 * `--detect 0.02` is the DETECTABLE ERROR, in proportion points, and it is a required part of the
 * claim: a power statement with no stated effect size is not a statement. It is recorded in the
 * artifact beside every required-N. */
const DETECT = +argOf('--detect', 0.02);
const BATCH = +argOf('--batch', 500);
const MAX_TRIALS = +argOf('--max-trials', 200000);
const SABOTAGE = process.env.MILLIONRUN_SABOTAGE || '';
/* `--dump-status <file>` — ONE JSONL ROW PER SCORED STATUS-SECONDARY TRIAL, and it changes no
 * denominator, no numerator and no published figure. It exists to ATTRIBUTE the status residual
 * (major status z = -5.18 over 30,052 trials at 50,000 games) between this instrument and the
 * engine, and the only honest way to do that is to condition the SAME trials this file already
 * scores on covariates it does not currently look at. A second instrument that re-derives its own
 * denominator would answer a different question and could not be compared.
 *
 * ITS OWN RED PROOF IS AN IDENTITY: summed over a key, the dumped rows must reproduce that key's
 * published `trials` and `fired` EXACTLY. If they do not, the dump is describing different trials
 * from the tally and nothing computed from it means anything. engine/status_residual.js asserts it
 * and refuses to report otherwise. */
const DUMP_STATUS = argOf('--dump-status', null);
const dumpRows = [];
/* THE DUMP IS SEALED WHEN THE FREE ARM ENDS, AND THAT IS NOT A DETAIL — IT WAS A REAL CONTAMINATION.
 * The red proofs replay 200 games with every die PINNED to 0.99, through the same playGame and the
 * same tallyTurn. `trials` is cleared around them; `dumpRows` was not, so the first dump carried 1,824
 * scald trials against the arm's 1,818 and read 23.794% against 23.872%. Six trials from a run whose
 * whole purpose is that no secondary ever fires — a downward bias, in the same direction as the effect
 * being attributed. The identity check below caught it on the first analysis pass, which is the only
 * reason this comment can be written in the past tense. */
let dumpSealed = false;

const ER = require('./engine_release.js');
const REL = ER.open(RELID || undefined);

/* THE FROZEN BYTES. `need` is the contract engine_release.js checks at the require — a release cut
 * before any of these existed refuses HERE, by name, instead of throwing four thousand lines into a
 * turn loop. */
const M = REL.require('engine/medicham2-browser.js', {
  need: ['buildMon', 'battleInit', 'battleTurn', 'battleOver', 'canTakeStatus', 'printedAccuracy',
         'hitChance', 'ACCMOD', 'MEDSEEN', 'MEDFAILS'],
});

/* The dex the frozen engine plays with, loaded from the SNAPSHOT. medicham2 reads it off the global,
 * so requiring the frozen copy is what puts the frozen mons in front of the frozen engine. */
global.window = global.window || global;
require(REL.path('data/engine-data.js'));
const MC = global.MC;
require(REL.path('data/move-effects.js'));
const ME = global.MOVE_EFFECTS;
const TAGS = JSON.parse(fs.readFileSync(REL.path('data/tags.json'), 'utf8'));

/* THE WORK LIST IS NOT IN THE RELEASE, because it is not part of the engine — it is what the engine
 * is being measured AGAINST. So it is read live and STAMPED: its age and its digest go in the
 * artifact, and a reader can tell whether the ruler moved. */
const TARGETS_PATH = path.join(ROOT, 'data', 'million-targets.json');
const TARGETS = JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8'));
const TARGETS_STAMP = {
  file: 'data/million-targets.json',
  digest: ER.sha12(TARGETS_PATH),
  generated: TARGETS.generated,
  age_hours: +(((Date.now() - fs.statSync(TARGETS_PATH).mtimeMs) / 3.6e6)).toFixed(2),
  rows: (TARGETS.rows || []).length,
};

/* ---- THE STREAM ---------------------------------------------------------------------------------
 * mulberry32, not the LCG in tests/bench-medicham.js. That one is `(s % 10000) / 10000` — 10,000
 * distinct values and an LCG's low bits, which is fine for a stopwatch and is not fine for a
 * measurement whose entire subject is the shape of a uniform. FREE-RUNNING: see rule 2 in the header.
 * The pinned stream below exists only for the red proof and says so in its name. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* EVERY DIE PINNED TO ONE CORNER — the ROADMAP #88 state, reproduced deliberately so the instrument
 * can be shown blind if it is blind. `rng()*100 > acc` is true for every acc < 99, and `rng() < p` is
 * false for every p <= 0.99, so accuracy collapses to ~0 and every secondary stops firing. */
const pinnedRng = () => 0.99;

/* ---- WHAT THE TAG ARTIFACT SAYS CONFOUNDS A TRIAL, DERIVED ---------------------------------------
 * Not a typed list of ability names. Serene Grace DOUBLES a secondary chance, Sheer Force DELETES the
 * secondaries, Shield Dust REFUSES them on the target, Stench ADDS one, King's Rock ADDS a flinch,
 * Inner Focus REFUSES the flinch volatile. Every one of those makes a trial not a sample of the
 * declared rate. Read out of data/tags.json by TAG SHAPE, so an ability added next regulation is
 * picked up without editing this file — docs/TAGS.md invariant 3. */
function carriersOf(kind, tag) {
  const box = TAGS[kind] || {};
  const out = new Set();
  for (const k of Object.keys(box)) if ((box[k].tags || []).includes(tag)) out.add(k);
  return out;
}
const ATT_AB_CONFOUND = new Set([...carriersOf('abilities', 'secondaryChanceMult'),
                                 ...carriersOf('abilities', 'removesOwnSecondaries'),
                                 ...carriersOf('abilities', 'addsOwnSecondary')]);
const DEF_AB_CONFOUND = new Set([...carriersOf('abilities', 'refusesSecondaries')]);
const ATT_ITEM_CONFOUND = new Set([...carriersOf('items', 'addsFlinch')]);
const FLINCH_REFUSERS = (() => {
  const out = new Set();
  for (const [k, row] of Object.entries(TAGS.abilities || {})) {
    const rv = row.params && row.params.refusesVolatile;
    if (rv && Array.isArray(rv.refuses) && rv.refuses.includes('flinch') && !rv.requiresForme) out.add(k);
  }
  return out;
})();
/* The accuracy modifiers, read out of the ENGINE'S OWN exported table rather than re-listed. A row
 * marked `off` is declared dead by the engine and does not confound anything. */
const ACC_CONFOUND = new Set(Object.entries(M.ACCMOD || {})
  .filter(([, v]) => !v.off).map(([k]) => k));
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- A SECONDARY STAT DROP THE ENGINE REFUSES IN SILENCE ----------------------------------------
 *
 * THIS IS THE LARGEST DENOMINATOR DEFECT IN THE FIRST PUBLISHED RUN AND IT IS THE INSTRUMENT'S, NOT
 * THE ENGINE'S. medicham2's `statDropRefusal(target, stat, effect, isSecondary, …)` returns
 * `announce: !isSecondary`, so when a Clear Body / White Smoke / Full Metal Body / Hyper Cutter /
 * Big Pecks / Mirror Armor body refuses a SECONDARY drop the engine deliberately emits NO `-fail`
 * line — Showdown does not emit one either. The instrument was reading exactly that absence as "the
 * die came up short", so every hit onto a refuser sat in the denominator and could never fire. That
 * biases every targetBoosts row DOWNWARD by the refusers' share of the corpus, uniformly, which is
 * the shape the 50,000-game run showed (crunch 17.8 against 20, liquidation 18.8 against 20,
 * shadowball 18.6 against 20, moonblast 8.6 against 10 — all low, all by about a tenth).
 *
 * A CLICK IS NOT A TRIAL. A hit that could not have produced the effect never reached the die.
 *
 * IT MIRRORS `statDropRefusal` RATHER THAN CALLING IT — the function is not exported, and mirroring
 * is what the declaration gate does one level up and for the same reason: an independent reading.
 * Every condition is read from `data/tags.json` in the FROZEN release by tag shape, so an ability
 * added next regulation is picked up without editing this file. `INTIM_ONLY_BRIDGE` is deliberately
 * NOT mirrored: the engine's own comment says that list is consulted only for a tag artifact
 * generated before `preventsStatDrop.onlyFrom` existed, and this release's artifact carries the
 * field on all five of its members.
 *
 * WHAT IT DOES NOT REACH, said rather than hidden: Safeguard and the ally veils (Flower Veil, Pastel
 * Veil, Sweet Veil) refuse a secondary STATUS just as silently, and this instrument has no side
 * state to ask. That residual is reported in the artifact, not corrected. */
const STAT_DROP_REFUSERS = (() => {
  const out = new Map();          // ability id -> the tag's own params
  for (const [k, row] of Object.entries(TAGS.abilities || {})) {
    const p = row.params && row.params.preventsStatDrop;
    if (p) out.set(k, p);
  }
  return out;
})();
/* The engine's own `blocks` -> engine stat key map, `SD_BLOCK2ENG`. `accuracy` and `evasion` are
 * ABSENT from it on purpose-or-otherwise: a `blocks:'accuracy'` carrier (Keen Eye, Illuminate,
 * Mind's Eye) therefore matches NOTHING and the engine does not refuse the drop. This mirror
 * reproduces that, because this instrument measures the SAMPLER given the engine's own eligibility —
 * whether the engine SHOULD refuse an accuracy drop is a question tests/roster.js owns, and it is
 * reported below rather than silently corrected here. */
const SD_BLOCK2ENG = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
function dropSilentlyRefused(def, sdStat) {
  if (!def) return false;
  const p = STAT_DROP_REFUSERS.get(def.ability);
  if (!p) return false;
  if (p.onlyGrassTypes && !(def.types || []).some(t => String(t).toLowerCase() === 'grass')) return false;
  /* `onlyFrom` names ONE effect (Intimidate, for the five Guard Dog-shaped abilities). A move's
   * secondary is never that effect, so a scoped refuser does not refuse this drop. */
  if (p.onlyFrom) return false;
  /* `blocks` is the ABILITY's stat, `sdStat` is the one being dropped. Comparing the two through the
   * engine's own map is the whole condition; the first version of this line compared the dropped
   * stat with itself and refused everything a refuser was carrying. */
  if (String(p.blocks || '') !== 'all stats' && SD_BLOCK2ENG[String(p.blocks || '')] !== engStat(sdStat)) return false;
  /* A reflector at the floor takes the drop normally — the engine returns null there. The stage-cap
   * exclusion above already removes those rows, so this is belt and braces on the same board. */
  if (p.reflects && def.boosts && def.boosts[engStat(sdStat)] === -6) return false;
  return true;
}
/* CONTRARY TURNS THE DROP INTO A BOOST, so the engine emits `-boost` where this instrument looks for
 * `-unboost` and a fired die reads as a miss. It is one ability in this format and it is read from
 * the tag, not named. */
const BOOST_INVERTERS = new Set(carriersOf('abilities', 'invertsBoosts'));

/* ---- THE FORMAT, AND THE ONE THING IT HAS TO TELL THE TALLY --------------------------------------
 * AN OHKO MOVE'S `accuracy` FIELD IS A LIE, and scoring it in the accuracy family is a mistake this
 * file made and `engine/million_targets.js` had already refused to make — its family-2 loop skips
 * `m.ohko` outright and cites `battle-actions.ts:696`, "bypasses accuracy modifiers", which then
 * OVERWRITES accuracy with 30 (20 for a non-Ice Sheer Cold) plus the level difference. The first
 * 50,000-game run pooled Fissure's 6,970 trials into the accuracy family and turned a clean arm
 * (z = +0.37 on 93,896 trials) into a diverging one (z = +3.46). The defect was real and it was in
 * the wrong family, which is the same mistake as the wrong denominator one level up. */
const FMT = (() => {
  const CS = require('./champions_sim.js');
  const { Dex } = CS.sim();
  return { CS, D: Dex.forFormat(CS.FORMAT) };
})();
const OHKO = new Map();
for (const mv of FMT.D.moves.all()) if (!mv.isNonstandard && mv.ohko) OHKO.set(mv.id, mv.ohko);

/* ---- THE DECLARATION GATE — ROADMAP #132 -------------------------------------------------------
 * The authority STATES every secondary chance, so this is a derivation taking seconds and not a
 * statistical question. Two surfaces are compared:
 *   FORMAT   Dex.forFormat(champions).moves.get(id).secondaries — the truth.
 *   ENGINE   data/move-effects.js in the FROZEN release — the rulebook medicham2's secondary loop
 *            actually reads. If this disagrees with the format, the sampler is sampling our mistake.
 * A move where they disagree is REFUSED for scoring: measuring a sampler against a wrong declaration
 * is what #132's row means by "do this BEFORE #133". */
/* WHAT THE ENGINE ACTUALLY ROLLS WITH, AND IT IS NOT `data/move-effects.js` ALONE.
 *
 * THE FIRST VERSION OF THIS GATE ASKED THE WRONG SURFACE AND PRODUCED A CONFIDENT WRONG ANSWER — six
 * disagreements including Moonblast at 30 against the format's 10 and Iron Head at 30 against 20, the
 * exact shape of the mainline-contamination bug `million_targets.js`'s header records. Reading the
 * secondary loop settles it (medicham2-browser.js, the `_fmtChance` closure):
 *
 *     const _generic = (s.chance == null ? 100 : s.chance);      // data/move-effects.js
 *     const _fmt     = _fmtChance(s);                            // data/tags.json, format-derived
 *     if (rng()*100 >= (_fmt != null ? _fmt : _generic)) continue;
 *
 * The TAG WINS where it carries a chance, and the rulebook is the fallback. The engine even counts
 * the disagreement itself, in `MEDFAILS.rulebookChanceDrift`. So `data/move-effects.js` holding
 * mainline's number is only a defect where NO tag covers the effect — and that is a much smaller and
 * much more specific claim than "six moves are wrong".
 *
 * This mirrors `_fmtChance` rather than approximating it. That is a duplicated FACT, which CLAUDE.md
 * forbids, and it is deliberate here for one reason: the gate's whole job is to be an INDEPENDENT
 * reading of what the engine will do. Calling the engine's own resolver would make the check agree
 * with the engine by construction. It is written directly under the source it mirrors so a drift is
 * visible, and `MEDFAILS.rulebookChanceDrift` in the artifact is the engine's own cross-check. */
function tagChance(id, s) {
  const P = (TAGS.moves[id] || {}).params || {};
  if (s.targetBoosts && P.statChange && Array.isArray(P.statChange.target)) {
    const keys = Object.keys(s.targetBoosts).sort().join(',');
    const r = P.statChange.target.find(e => e && e.boosts && Object.keys(e.boosts).sort().join(',') === keys);
    return r && r.chance != null ? +r.chance : null;
  }
  const si = P.statusInflict;
  if (!si || !Array.isArray(si.effects)) return null;
  const k = s.status ? ['status', s.status] : s.volatile ? ['volatile', s.volatile] : null;
  if (!k) return null;
  const e = si.effects.find(x => x && x[k[0]] === k[1] && (x.to == null || x.to === 'target'));
  return e && e.chance != null ? +e.chance : null;
}
const engKind = s => s.status ? 'status:' + s.status : s.volatile ? 'volatile:' + s.volatile
  : s.targetBoosts ? 'targetBoosts:' + Object.keys(s.targetBoosts).sort().join('/')
  : s.selfBoosts ? 'selfBoosts' : 'none';
const fmtKind = s => s.status ? 'status:' + s.status : s.volatileStatus ? 'volatile:' + s.volatileStatus
  : s.boosts ? 'targetBoosts:' + Object.keys(s.boosts).sort().join('/')
  : s.self ? 'selfBoosts' : 'none';
/* THE EFFECT THAT IS A CLOSURE, AND THEREFORE HAS NO CHANCE FIELD TO COMPARE. Dire Claw and Tri
 * Attack pick a status inside their handler, so both sides record `{chance:N}` with nothing in it and
 * this engine routes them through the `proceduralStatus` TAG instead — Dire Claw's `p` is 0.30, which
 * is the format's number even though the rulebook entry beside it says 50 and reaches the
 * effect-less branch. Comparing the `none` entries would have accused a correct mechanic. */
const proceduralP = id => {
  const p = ((TAGS.moves[id] || {}).params || {}).proceduralStatus;
  return p && p.p != null ? +p.p * 100 : null;
};

function declarationGate() {
  const CS = FMT.CS, D = FMT.D;
  const rows = [], bad = [], notCompared = [];
  for (const mv of D.moves.all()) {
    /* LEGALITY IS A MECHANISM. `Dex...all()` walks the whole National Dex; `isNonstandard` is what
     * this format marks a retired entity with, and everything else here would be a claim about a
     * move nobody can click. */
    if (mv.isNonstandard) continue;
    const fmt = [].concat(mv.secondaries || (mv.secondary ? [mv.secondary] : [])).filter(Boolean);
    const eng = ((ME[mv.id] || {}).secondary || []).filter(Boolean);
    if (!fmt.length && !eng.length) continue;
    const seen = new Set();
    const one = (kind, fchance, echance, note, source) => {
      const row = { move: mv.id, kind, format_pct: fchance, engine_pct: echance,
                    uses: (TAGS.moves[mv.id] || {}).uses || 0, note: note || null,
                    source: source || null, agree: fchance === echance };
      rows.push(row);
      if (!row.agree) bad.push(row);
    };
    for (const s of eng) {
      const kind = engKind(s);
      seen.add(kind);
      const f = fmt.find(q => fmtKind(q) === kind);
      const generic = s.chance == null ? 100 : s.chance;
      const tag = tagChance(mv.id, s);
      let eff = tag != null ? tag : generic;
      let src = tag != null ? 'tag' : 'rulebook';
      let note = tag != null ? 'tag wins over the rulebook (' + generic + ')' : 'rulebook only — no tag covers this effect';
      if (kind === 'none') {
        /* AN EFFECT-LESS ENTRY IS COUNTED, NOT SKIPPED. ROADMAP #132's row records "34 carry no
         * chance at all" and the first version of this gate `continue`d past exactly that class,
         * which turns the open half of #132 into an invisible zero — the shape of the bug the row is
         * about. The effect reaches the body through the `proceduralStatus` tag (Dire Claw, Tri
         * Attack: the handler picks the status, so both sides record a chance with nothing in it), or
         * through a DIFFERENT tag entirely (Ceaseless Edge and Stone Axe set a hazard on hit), or
         * through nothing. Only the first is comparable; the rest are listed with the reason. */
        const pp = proceduralP(mv.id);
        if (pp != null) { eff = pp; src = 'proceduralStatus tag'; note = 'proceduralStatus tag p=' + (pp / 100); }
        else {
          notCompared.push({ move: mv.id, kind, engine_pct: generic, uses: (TAGS.moves[mv.id] || {}).uses || 0,
            why: 'the rulebook entry names no status, no volatile and no boost — the effect is a '
               + 'closure another tag owns (a hazard on hit, a Throat Chop shape). There is no chance '
               + 'field on either side to compare, so this pair is neither agreed nor refused; it is '
               + 'outside what a chance comparison can say anything about.' });
          continue;
        }
      }
      one(kind, f ? (f.chance == null ? 100 : f.chance) : null, eff, note, src);
    }
    for (const q of fmt) {
      const kind = fmtKind(q);
      if (seen.has(kind)) continue;
      if (kind === 'none' && proceduralP(mv.id) != null) {
        one(kind, q.chance == null ? 100 : q.chance, proceduralP(mv.id), 'proceduralStatus tag', 'proceduralStatus tag');
        continue;
      }
      if (kind === 'none') {
        notCompared.push({ move: mv.id, kind, engine_pct: null, uses: (TAGS.moves[mv.id] || {}).uses || 0,
          why: 'the FORMAT declares an effect-less secondary (a closure) and no proceduralStatus tag '
             + 'covers it here. Nothing to compare; whether the effect happens at all is an '
             + 'eligibility question tests/roster.js owns, not a rate question.' });
        continue;
      }
      one(kind, q.chance == null ? 100 : q.chance, null, 'the engine declares no such secondary', 'format only');
    }
  }
  return {
    what: 'ROADMAP #132. Every secondary the FORMAT declares, against the chance the frozen engine '
        + 'ACTUALLY ROLLS WITH — the tag where a tag carries one, the rulebook otherwise, the '
        + 'proceduralStatus tag for a closure effect. A disagreement means the million games would be '
        + 'checking our sampler against our own mistake, so those (move, effect) pairs are refused '
        + 'for scoring rather than measured.',
    format: CS.FORMAT,
    surfaces: 'data/tags.json (format-derived, wins) > data/move-effects.js (the rulebook fallback). '
            + 'Comparing the rulebook ALONE reports six disagreements and five of them are not real, '
            + 'because a tag overrides them before the die is thrown.',
    pairs_compared: rows.length,
    agree: rows.length - bad.length,
    disagree: bad.length,
    /* WHERE EACH AGREED NUMBER CAME FROM. A pair scored off the `rulebook` fallback is the class
     * Freeze-Dry is in — nothing format-derived is guarding it, so a mainline value can sit there
     * and agree with the format only by luck. Printed so the exposure is a number rather than a
     * feeling. */
    by_source: rows.reduce((a, r) => { a[r.source || 'unknown'] = (a[r.source || 'unknown'] || 0) + 1; return a; }, {}),
    /* THE OTHER HALF OF #132's ROW: "34 carry no chance at all". A CERTAINTY IS NOT A DIE, and it is
     * excluded from the RATE run for that reason (million_targets.js excludes chance >= 100 too) —
     * but it is counted here, because "modelled as a certainty" is exactly how the Focus Sash drag
     * became a hard 1.0. If a 100% entry is wrong it is wrong in the eligibility instruments, not
     * this one. */
    certainties: rows.filter(r => r.engine_pct >= 100).length,
    certainty_moves: rows.filter(r => r.engine_pct >= 100).map(r => r.move + '|' + r.kind),
    /* THE EXPOSED CLASS, NAMED. These are the pairs where the engine rolls a number that NOTHING
     * format-derived is guarding — data/move-effects.js is generated from the generic gen-9 client
     * dex, so any of these agreeing with Champions does so by luck rather than by construction. The
     * one disagreement found at this release is in this list, which is the argument for printing it. */
    rulebook_only: rows.filter(r => r.source === 'rulebook')
      .map(r => ({ pair: r.move + '|' + r.kind, pct: r.engine_pct, uses: r.uses, agree: r.agree })),
    not_compared: notCompared,
    refused_for_scoring: bad.map(r => r.move + '|' + r.kind),
    disagreements: bad,
  };
}

/* ---- WHICH TARGET ROWS THIS INSTRUMENT CAN OBSERVE -----------------------------------------------
 * Stated per family, with the reason, and the artifact carries it. A family that is not implemented
 * is `not_observable` and gets NO number — never a zero, which would read as "it never fired". */
const FAMILY_SUPPORT = {
  secondary: { observable: true,
    denominator_implemented: 'per (move, secondary): hits that CONNECTED with a body eligible to '
      + 'receive that specific effect, taken from the emitted protocol trace. Excluded: a miss, an '
      + 'immunity, a Protect, a body that fainted to the hit, a target already carrying a major '
      + 'status (asked of the engine\'s own canTakeStatus), a target already at the stage cap, an '
      + 'attacker or target carrying a tag that rewrites the chance (Serene Grace, Sheer Force, '
      + 'Shield Dust, Stench, King\'s Rock — derived from data/tags.json, not listed here), and for '
      + 'flinch, a target that had ALREADY acted this turn or refuses the volatile.' },
  accuracy: { observable: true,
    denominator_implemented: 'attempts that REACHED the accuracy roll: the trace shows either a '
      + 'connection or a |-miss| for that body. An immunity, a Protect, a failed move and a '
      + 'no-target turn are outside it. A trial is CLEAN only if the engine\'s own printedAccuracy '
      + 'under the live field equals the format\'s printed accuracy AND neither body carries an '
      + 'ACCMOD row AND gravity is 0; anything else goes in a separate `modified` bucket and is '
      + 'never pooled, which is what the target row\'s own denominator sentence demands.' },
  multihit: { observable: true,
    denominator_implemented: 'uses that connected at least once, read off the |-hitcount| line the '
      + 'engine emits at the close of a volley (ROADMAP #151). Loaded Dice and Skill Link carriers '
      + 'are excluded from the bare arm rather than pooled.' },
  chance: { observable: 'par only',
    denominator_implemented: 'par: attempted moves while paralysed — a body whose status was par when '
      + 'it came up to act, counted from the trace as (|cant|X|par|) + (X emitted a |move|). Every '
      + 'other member of this family is not observable here; see below.' },
  crit: { observable: false,
    why: 'the row asserts the rate MOVES relative to the same carrier without the effect, so it needs '
       + 'a paired arm this runner does not stage. The BASE crit rate is reported separately as a '
       + 'whole-corpus diagnostic and is not scored against a target row.' },
  proc: { observable: false,
    why: 'an ability/item proc needs the trigger to be REACHED (a contact move that connected, a hit '
       + 'that would otherwise have been lethal, a turn where moving first changes the board). The '
       + 'trace does not say whether the trigger was reached, only whether it fired, so the '
       + 'denominator would be invented. Needs a staged arm, not a bigger corpus.' },
  ohko: { observable: true,
    was_withheld: 'This family was TALLIED AND NOT SCORED from 2026-08-11 until the denominator was '
            + 'reconciled the same night. A rule-free count of the same event over 25,000 games — '
            + 'every |-miss| and every |-damage| inside an OHKO move block, no eligibility rule of any '
            + 'kind — reads 1,081/3,622 = 29.85% [28.4, 31.4] against the declared 30, so the engine\'s '
            + 'sampler was right and this instrument, reading 32.89% on 7,005 trials, was not. THE '
            + 'CAUSE was `connected = damaged || touched`: an unmarked end-of-turn -boost inside the '
            + 'block read as a connection, and on a 30-accuracy move seven trials in ten are misses so '
            + 'the leak lands almost entirely on the hit side. With a damage line required (see conn) '
            + 'the arm reads 29.44% of 6,662 [28.35, 30.54] and the two readings overlap. It published '
            + '"z = +8.0 DIVERGES" for one run before any of that was measured; the number was about '
            + 'this file, not about the engine.',
    denominator_implemented: 'attempts that reached the roll, exactly as the accuracy family counts '
      + 'them, but scored against 30 (20 for a non-Ice user of Sheer Cold) rather than against the '
      + 'move\'s printed accuracy field — which battle-actions.ts:696 overwrites. Every body in this '
      + 'corpus is Level 50, so the level term is zero. A Sturdy target refuses the move outright and '
      + 'leaves the denominator as an immunity.' },
  duration: { observable: false,
    why: 'sleep, freeze and confusion lengths are counted in ATTEMPTED MOVES, and an attempt that '
       + 'never happened (the body fainted, the game hit the turn cap) censors the observation. A '
       + 'censored duration needs survival analysis rather than a ratio; refusing is honest.' },
  'random-choice': { observable: false,
    why: 'Trace needs an entry with TWO eligible adjacent foes, which needs a switch. This corpus has '
       + 'no switch branch — see `structural` in this artifact for the observed count.' },
};

/* Populated from the declaration gate before a game is played. A (move, effect) pair the gate
 * refuses is never tallied at all — not tallied and marked afterwards, which is what the first
 * version did and which left the refused rows inside the POOLED statistic. */
let PAIR_EXPECT = new Map(), PAIR_REFUSED = new Set();

/* ---- THE TRIALS TABLE ---------------------------------------------------------------------------- */
const trials = new Map();     // key -> {family, subject, detail, expect, n, k, halves:[{n,k},{n,k}]}
function bump(key, meta, hit, half) {
  let t = trials.get(key);
  if (!t) { t = Object.assign({ key, n: 0, k: 0, halves: [{ n: 0, k: 0 }, { n: 0, k: 0 }] }, meta); trials.set(key, t); }
  t.n++; if (hit) t.k++;
  t.halves[half].n++; if (hit) t.halves[half].k++;
}
const diag = { blocks: 0, turns: 0, games: 0, switch_events: 0, replacement_switches: 0,
               voluntary_switches: 0, faints: 0, cant_lines: 0,
               hits: 0, crits: 0, misses: 0, immune: 0, protect: 0,
               excluded: {} };
const excl = k => { diag.excluded[k] = (diag.excluded[k] || 0) + 1; };

/* ---- THE TRACE PARSER ---------------------------------------------------------------------------
 * The stream is Showdown's grammar with ids in the name fields (medicham2's TRACE block says so and
 * says why). A MOVE BLOCK is a |move| line and every consequence line up to the next action line;
 * |faint| stays inside the block because a body fainting to the hit is a consequence of it and is
 * exactly what removes a trial from a secondary's denominator. */
const ACTION_LINE = new Set(['move', 'cant', 'turn', 'upkeep', 'switch', 'drag']);
/* WHEN a body acted, not WHETHER — and getting that wrong cost every flinch trial in the first run.
 * `acted` was a Set, so a body that FLINCHED registered as "has acted" and the flinch trial that
 * caused it was then thrown out as "the target had already acted this turn". 378 flinch trials, ZERO
 * numerators, against MEDSEEN.flinch = 233 in the same corpus — the counter is what caught it. It is
 * an event INDEX now: a flinch cant-line always comes AFTER the move that set it, so the comparison
 * separates "moved before the hit" from "was stopped by the hit" instead of merging them. */
function parseTurns(lines) {
  const turns = [];
  let cur = null, block = null, ei = 0;
  for (const raw of lines) {
    const f = String(raw).split('|'); f.shift();
    const ev = f[0];
    if (ev === 'turn') { cur = { no: +f[1], events: [], blocks: [], acted: new Map() }; turns.push(cur); block = null; ei = 0; continue; }
    if (!cur) continue;
    ei++;
    if (ACTION_LINE.has(ev)) block = null;
    if ((ev === 'move' || ev === 'cant') && !cur.acted.has(f[1])) cur.acted.set(f[1], ei);
    if (ev === 'move') {
      /* THE FIELDS SHIFT WHEN ONE IS EMPTY. `TRACE.push()` filters out null and '' before joining,
       * so a move with no target and a trailing attribute writes the attribute where the target goes.
       * A target is therefore accepted only if it LOOKS like a slot identifier; anything else is not
       * a body and must not be used as a `-miss` fallback. */
      const tgt = /^p[12][a-d]: /.test(f[3] || '') ? f[3] : '';
      block = { user: f[1], move: idOf(f[2]), target: tgt, lines: [], idx: cur.blocks.length, at: ei };
      cur.blocks.push(block);
    }
    cur.events.push(f);
    if (block && !ACTION_LINE.has(ev)) block.lines.push(f);
  }
  return turns;
}

/* DID THIS BLOCK'S MOVE ACTUALLY REACH THIS BODY? ONE ANSWER, AND IT IS NOT `damaged || touched`.
 *
 * ================= WHAT WENT WRONG, MEASURED RATHER THAN ARGUED ===================================
 *
 * `touched` is set by a `-status`, `-start`, `-boost` or `-unboost` line inside the block that does
 * not carry `[from]`. That filter is the right idea and it CANNOT WORK on this stream, because
 * medicham2's `TR.bst(m,eng,d,from)` takes a `from` argument and the RESIDUAL sites do not pass one:
 * a Speed Boost or a Moody roll at the end of the turn is emitted as a bare `|-boost|p2a: X|spe|1`
 * where the authority writes `|-boost|p2a: X|spe|1|[from] ability: Speed Boost`. The parser closes a
 * block only on an ACTION line, so every end-of-turn line lands inside the turn's LAST move block and
 * a bare `-boost` there reads as "the move touched this body".
 *
 * IT IS NOT SMALL AND IT IS NOT EVEN. Over 50,000 games, 1,391 of the 30,052 scored status-secondary
 * trials had NO damage line at all, and they fired 0 times out of 1,391 — a class that cannot fire,
 * sitting in the denominator. The carriers name themselves: 868 Speed Boost, 373 Moody, 60
 * Intimidate, 54 Lightning Rod. 1,119 of the 1,391 bodies were not damaged by ANY block in the whole
 * turn. Their share is what made the residual look like a property of the MOVE: 12.3% of Scald's
 * trials, 12.0% of Body Slam's, 9.8% of Flare Blitz's — against 1.7% of Poison Jab's and 2.6% of
 * Discharge's, which is exactly the set of rows that read correct.
 *
 * ================= THE RULE, AND WHY IT IS NOT JUST `r.damaged` ==================================
 *
 * A DAMAGING move that reached a body wrote a `-damage` line for it. That is the whole test, and it
 * is a line the move certainly caused. A STATUS move reached a body without damaging it, and its only
 * evidence is exactly the `-status`/`-boost` line this leak is made of — so Thunder Wave and Icy
 * Wind's accuracy arms still need `touched` and still have it. `category` is read from the rulebook
 * rather than `bp > 0`, because FISSURE has bp 0 and is a damaging move; a `bp > 0` test would have
 * left the OHKO family on the broken evidence, which is the family that most needed fixing.
 *
 * FILED TO ENGINE, NOT FIXED HERE: a residual or ability-sourced `-boost` carries no `[from]`. That
 * is a protocol divergence from the authority in its own right and everything downstream of the
 * trace inherits it. This instrument must not depend on it being fixed. */
const conn = (fx, r) => (fx && fx.category === 'Status') ? (r.damaged || r.touched) : r.damaged;

/* Which bodies a block resolved against, and how. One pass, so the same evidence feeds accuracy and
 * every secondary rather than two readers that can disagree. */
function resolveBlock(b) {
  const per = new Map();
  const get = id => { if (!per.has(id)) per.set(id, { damaged: false, missed: false, immune: false, fainted: false, touched: false, hitcount: null, crit: false }); return per.get(id); };
  for (const f of b.lines) {
    const ev = f[0];
    if (ev === '-miss') { get(f[2] || b.target).missed = true; }
    /* THE HEALTH FIELD SAYS WHETHER THE BODY SURVIVED, AND IT SAYS IT ON THE DAMAGE LINE. medicham2's
     * `health()` writes `0 fnt` the moment curHP hits zero, which is BEFORE the `|faint|` line is
     * emitted — and the engine's secondary loop is gated on `!tg.fainted`, so a target killed by the
     * hit can never take the secondary. Reading the KO off the `faint` line alone left every trial
     * whose faint was announced after the block boundary in the denominator, where it could not fire.
     * That is a downward bias that scales with how hard the move hits, which is what a 30% Scald
     * reading 23.2% looks like. */
    else if (ev === '-damage') { const r = get(f[1]); if (!/\[from\]/.test(f[3] || '')) { r.damaged = true; r.touched = true; } if (/^0 /.test(f[2] || '')) r.fainted = true; }
    else if (ev === '-immune') { get(f[1]).immune = true; }
    else if (ev === 'faint') { get(f[1]).fainted = true; }
    else if (ev === '-crit') { get(f[1]).crit = true; }
    else if (ev === '-hitcount') { get(f[1]).hitcount = +f[2]; }
    /* `[from]` MARKS A LINE THIS BLOCK DID NOT CAUSE. A residual burn tick, a Speed Boost at the end
     * of the turn, a Leftovers heal — the engine emits them after the last move of the turn and this
     * parser closes a block only on an ACTION line, so they land inside it. Reading them as "the move
     * touched this body" is what turned missed Fissures into connections. The `-damage` arm already
     * filtered on `[from]`; these three did not. */
    else if (ev === '-status' || ev === '-start' || ev === '-boost' || ev === '-unboost') {
      if (!/\[from\]/.test(f[3] || '')) get(f[1]).touched = true;
    }
    else if (ev === '-activate' && /protect|bunker|spikyshield|spiky shield/i.test(f[2] || '')) { get(f[1]).protect = true; }
  }
  return per;
}

/* THE COVARIATES OF ONE SCORED STATUS TRIAL. Read off the SAME parsed block the tally reads, so a
 * covariate cannot describe a different event from the trial it is attached to.
 *
 * `hp_after` and `hp_status` come out of the `-damage` line's HEALTH FIELD, which medicham2 writes
 * as `n/max`, `n/max <status>` or `0 fnt` (its `health()`, mirroring sim/pokemon.ts:2065). That
 * field is the engine's OWN statement of the target's hp and status at the moment the damage landed,
 * and it is therefore an independent witness against this file's reconstructed `status` map — which
 * is the thing most likely to be wrong, because a stale map leaves a body in a denominator it can
 * never fire in and biases every status row DOWNWARD, uniformly. */
function dumpStatusTrial(key, expect, fired, b, T, tid, r, def, att, half, st) {
  if (dumpSealed) return;
  const dl = b.lines.find(f => f[0] === '-damage' && f[1] === tid && !/\[from\]/.test(f[3] || ''));
  const h = dl ? String(dl[2] || '') : '';
  let hpNum = null, hpMax = null, hpSt = '';
  const mh = /^(\d+)\/(\d+)(?:\s+(\w+))?$/.exec(h);
  if (mh) { hpNum = +mh[1]; hpMax = +mh[2]; hpSt = mh[3] || ''; }
  else if (/^0 fnt/.test(h)) { hpNum = 0; hpMax = null; hpSt = 'fnt'; }
  const foes = [...T.blocks].length;
  let nTargets = 0; for (const f of b.lines) if (f[0] === '-damage' && f[1] !== b.user && !/\[from\]/.test(f[3] || '')) nTargets++;
  /* THE NUMERATOR, ASKED TWICE. `fired` is the tally's own question — a `-status` line for this body
   * INSIDE this move block. `fired_turn` asks the whole turn. If the second ever exceeds the first,
   * the numerator is being lost at the block boundary, which is an INSTRUMENT fault and would look
   * exactly like a sampler firing too rarely. It costs one scan to know instead of assume. */
  const firedTurn = T.events.some(f => f[0] === '-status' && f[1] === tid && idOf(f[2]) === idOf(st));
  dumpRows.push({
    key, expect, fired: fired ? 1 : 0, fired_turn: firedTurn ? 1 : 0, half,
    move: b.move, st,
    hp_after: hpNum, hp_max: hpMax, hp_frac: (hpNum != null && hpMax) ? +(hpNum / hpMax).toFixed(4) : null,
    hp_status: hpSt,                       // the ENGINE's own word for the target's status at damage time
    dmg_line: dl ? 1 : 0,
    damaged: r.damaged ? 1 : 0, touched: r.touched ? 1 : 0,
    crit: r.crit ? 1 : 0, hitcount: r.hitcount,
    n_damaged: nTargets, blocks_in_turn: foes,
    hit_by_blocks: T.blocks.filter(x => x.lines.some(f => f[0] === '-damage' && f[1] === tid)).length,
    faint_later: T.events.some(f => f[0] === 'faint' && f[1] === tid) ? 1 : 0,
    sub: b.lines.some(f => f[1] === tid && /substitute/i.test(String(f[2] || '') + String(f[3] || ''))) ? 1 : 0,
    def_ab: (def && def.ability) || '', def_types: ((def && def.types) || []).join('/'),
    def_snap_status: (def && def.status) || '',
    att_ab: (att && att.ability) || '', att_item: (att && att.item) || '',
  });
}

/* ---- ONE GAME ------------------------------------------------------------------------------------ */
/* ENUMERATION THROUGH THE RESOLVER, not `Object.keys(MC.mons)` — `mcKey.all()` hands back ENTRIES
 * precisely so a caller holding a list of keys cannot go back to indexing the raw table. */
const ROWS = REL.require('engine/mc_key.js').mcKey.all({ mayMiss: 'the weighted sampler needs the whole table' }) || [];
const SPECIES = ROWS.map(([k]) => k);
const WEIGHTS = ROWS.map(([, row]) => Math.max(1, +((row && row.wt) || 1)));
const WSUM = WEIGHTS.reduce((a, b) => a + b, 0);
function pickSpecies(rng) {
  let r = rng() * WSUM;
  for (let i = 0; i < SPECIES.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return SPECIES[i]; }
  return SPECIES[SPECIES.length - 1];
}
const slotIdent = (S, m) => {
  let i = S.actA.indexOf(m); if (i >= 0) return 'p1' + 'abcd'[i] + ': ' + (m._ident || m.name);
  i = S.actB.indexOf(m); if (i >= 0) return 'p2' + 'abcd'[i] + ': ' + (m._ident || m.name);
  return null;
};

/* TWO STREAMS, AND THE SECOND ONE IS THE REASON THE FIRST RED PROOF READ n=0 ON ITS FIRST RUN.
 * `teamRng` builds the roster; `rng` rolls the dice inside the turn. They were one stream, so pinning
 * the dice ALSO pinned team construction — every body on every team came out the same species, whose
 * modal moveset happened to carry no sub-100 accuracy move, and the pinned arm produced ZERO trials
 * and reported "not flagged". A red proof that cannot reach the mechanic is not a red proof.
 * Splitting them also makes the pinned arm play the SAME teams as the free arm, so the only
 * difference between the two is the dice, which is what the proof is about. */
function playGame(rng, half, teamRng) {
  const mk = () => { let m = null, guard = 0; while (!m && guard++ < 30) m = M.buildMon(pickSpecies(teamRng), {}); return m; };
  const A = []; const B = [];
  for (let i = 0; i < TEAM; i++) { const a = mk(), b = mk(); if (a) A.push(a); if (b) B.push(b); }
  if (A.length < 2 || B.length < 2) return;
  const trace = [];
  const S = M.battleInit(A, B, { trace });
  S.maxTurns = TURN_CAP;
  diag.games++;
  for (let t = 0; t < TURN_CAP && !M.battleOver(S); t++) {
    /* THE SNAPSHOT IS TAKEN BEFORE THE TURN RUNS. Ability, item, types, status and the two stat
     * stages that decide whether a trial is clean. Taken here because the bodies MUTATE inside the
     * turn, and a denominator read off a post-turn body is a denominator about a different board. */
    const snap = new Map();
    const line0 = trace.length;
    for (const m of [...S.actA, ...S.actB]) {
      if (!m) continue;
      const id = slotIdent(S, m); if (!id) continue;
      snap.set(id, {
        ability: idOf(m.ability), item: idOf(m.item), types: (m.types || []).slice(),
        status: m.status || '', boosts: Object.assign({}, m.boosts || {}), fainted: !!m.fainted,
      });
    }
    const field = Object.assign({}, S.field);
    M.battleTurn(S, rng, null, null);
    diag.turns++;
    tallyTurn(trace.slice(line0), snap, field, half);
  }
}

/* ---- THE TALLY ----------------------------------------------------------------------------------- */
function tallyTurn(lines, snap, field, half) {
  const turns = parseTurns(lines);
  for (const T of turns) {
    const actedBefore = T.acted;       // ident -> event index of its FIRST action line this turn
    for (const f of T.events) if (f[0] === 'cant') diag.cant_lines++;
    /* IS A SWITCH A REPLACEMENT OR A DECISION? The whole coverage claim turns on it. `chooseAction()`
     * in medicham2 returns moves and only moves (ROADMAP #63) — so every switch here should be a
     * post-faint replacement, and a body arriving that way DOES run its entry ability. That is
     * MEASURED rather than asserted: a switch of a body whose side had no faint earlier in the same
     * turn would be a voluntary one, and would mean the claim is wrong. */
    let faintedSoFar = 0;
    for (const f of T.events) {
      if (f[0] === 'faint') { diag.faints++; faintedSoFar++; }
      else if (f[0] === 'switch' || f[0] === 'drag') {
        diag.switch_events++;
        if (faintedSoFar > 0) diag.replacement_switches++; else diag.voluntary_switches++;
      }
    }

    /* RUNNING STATUS, SEEDED FROM THE SNAPSHOT AND ADVANCED THROUGH THE STREAM. A body can only carry
     * one major status, so a target burned by the first move of the turn is INELIGIBLE for the
     * second move's burn secondary — and the first version of this only updated the map when a
     * secondary it was itself scoring fired. Every other road to a status (a status MOVE, an ability,
     * a residual, another move's secondary on a row this instrument does not score) left the map
     * stale, so those trials stayed in the denominator and could never fire. That biases every status
     * secondary DOWNWARD, uniformly, which is exactly the shape the 50,000-game run showed
     * (status arm z = -4.92 while flinch sat at -0.65). Advanced by EVENT INDEX so a status landing
     * later in the turn does not retro-exclude an earlier trial. */
    const status = new Map();
    for (const [k, v] of snap) status.set(k, v.status);
    let cursor = 0;
    const advanceTo = (at) => {
      while (cursor < T.events.length && cursor < at) {
        const f = T.events[cursor++];
        if (f[0] === '-status') status.set(f[1], idOf(f[2]));
        else if (f[0] === '-curestatus') status.set(f[1], '');
      }
    };

    for (const b of T.blocks) {
      advanceTo(b.at);
      diag.blocks++;
      const per = resolveBlock(b);
      const fx = ME[b.move];
      const att = snap.get(b.user);
      for (const [tid, r] of per) {
        if (r.damaged) diag.hits++;
        if (r.crit) diag.crits++;
        if (r.missed) diag.misses++;
        if (r.immune) diag.immune++;
        if (r.protect) diag.protect++;
      }
      if (!fx) { excl('no rulebook entry for ' + b.move); continue; }

      /* ---- ACCURACY --------------------------------------------------------------------------- */
      if (typeof fx.accuracy === 'number' && fx.accuracy < 100) {
        for (const [tid, r] of per) {
          if (tid === b.user) continue;
          if (r.immune || r.protect) { excl('accuracy: target immune or protected'); continue; }
          /* AN EXPLICIT `-miss` IS AUTHORITATIVE AND OUTRANKS EVERY LATER LINE IN THE BLOCK.
           *
           * THIS IS THE WHOLE OF THE OHKO HEADLINE AND IT WAS THE INSTRUMENT. `connected` was
           * `damaged || touched`, so a body that the engine announced a MISS against and that was
           * then touched by anything else attributed to the same block came out as a CONNECTION. On
           * a 90-accuracy move that is invisible — misses are a tenth of the trials. On a 30-accuracy
           * move misses are SEVEN TENTHS of them, so the leak lands almost entirely on the hit side
           * and the arm reads high.
           *
           * MEASURED, NOT REASONED: a raw probe over 25,000 games that counts nothing but `|-miss|`
           * and `|-damage|` lines inside an OHKO move block, with no eligibility rule of any kind,
           * reads 1,081 / 3,622 = 29.85% [28.4, 31.4] — the declared 30. The instrument was reading
           * 34.40% on 7,005 trials, which is outside that interval, so the two could not both be
           * describing the sampler. medicham2's roll is `_mvMissed = (_mvAcc < 100 && rng()*100 >
           * _mvAcc)` at one site with `hitChance` returning exactly 30 for Fissure, and it is right.
           *
           * A DIVERGENCE THIS INSTRUMENT WOULD HAVE FILED AGAINST THE ENGINE. That is the failure
           * mode worth naming: an instrument fault wearing an engine defect's clothes, which is what
           * `instrument_checks` exists for and what this one was not shaped to catch. */
          const connected = r.missed ? false : conn(fx, r);
          /* THE OHKO FAMILY IS SPLIT OUT OF THIS COUNTER BECAUSE IT IS THE FIRST THING TO CHECK WHEN
           * AN ACCURACY ARM READS HIGH. A trial that neither connected nor emitted a `-miss` is
           * dropped, and dropping a MISS raises the observed rate — so a large OHKO count here is
           * the instrument losing misses, not the engine landing extra hits. Pooled into one
           * counter, the two are indistinguishable, which is how the 34.4%-against-30% headline sat
           * unattributed. */
          if (!connected && !r.missed) {
            excl(OHKO.has(b.move) ? 'ohko: no miss line and no observable effect — ' + b.move
                                  : 'accuracy: no miss line and no observable effect');
            continue;
          }
          const def = snap.get(tid);
          if (OHKO.has(b.move)) {
            /* Level 50 mirror, so the level term is zero and the base is the whole rate. Sheer Cold
             * needs its OWN arm at 20 for a non-Ice user — the target row says so in those words,
             * and pooling the two hides both. */
            const iceUser = !!(att && (att.types || []).includes('Ice'));
            const expect = (OHKO.get(b.move) === 'Ice' && !iceUser) ? 20 : 30;
            /* AND THE SAME CLEAN/MODIFIED SPLIT THE ACCURACY FAMILY HAS. See noAccuracyModifier: the
             * OHKO arm was pooling every stage, ability, item and gravity into one bare rate, which
             * is the mistake the accuracy family had already been fixed for. It matters here more,
             * not less — the authority bypasses modifiers on these moves and this engine does not. */
            const cleanO = noAccuracyModifier(att, def, field);
            /* THE OHKO WITHHOLD IS LIFTED, AND IT WAS LIFTED BY FIXING THE DENOMINATOR RATHER THAN BY
             * DECIDING THE NUMBER LOOKED BETTER.
             *
             * The previous pass withheld this family because it could not be reconciled with a
             * rule-free count of its own event: over 25,000 games, counting nothing but `|-miss|` and
             * `|-damage|` lines inside an OHKO move block with no eligibility rule at all, the engine
             * connects 1,081 / 3,622 = 29.85% [28.4, 31.4] — the declared 30 — while this instrument
             * read 32.89% on 7,005 trials. Two readings of one event whose intervals do not overlap
             * cannot both describe the sampler, and the one with no rules in it was the one to trust.
             *
             * THE MISSING THIRD WAS NAMED. That probe's 5,353 blocks produced only 3,622 hit-or-miss
             * lines, and the question left open was what the rest are. They are the `conn` header's
             * subject: a block whose only evidence for a body is a bare end-of-turn `-boost`, which
             * the parser read as a CONNECTION. On a 30-accuracy move seven trials in ten are misses,
             * so a leak on the hit side moves this arm several points where it moves a 90-accuracy
             * arm by a tenth. With `conn` requiring a damage line, `ohko:fissure` reads
             * 29.44% of 6,662 [28.35, 30.54] — the declaration is inside the interval and the two
             * readings now overlap almost exactly. The arm is SCORED again.
             *
             * `:MODIFIED` STAYS UNSCORED AND IS ITSELF AN ENGINE FINDING. Showdown's OHKO moves bypass
             * accuracy modifiers entirely (`battle-actions.ts:696`) and medicham2's `hitChance` applies
             * the attacker's accuracy stage, the defender's evasion and every ACCMOD row to them like
             * any other move — so under the authority this bucket could not exist. It is not empty.
             * Filed to ENGINE; pooling it into the clean arm would hide the defect AND corrupt the
             * rate, which is why it is split rather than dropped. */
            bump('ohko:' + b.move + (OHKO.get(b.move) === 'Ice' ? (iceUser ? ':ice-user' : ':non-ice-user') : '')
                 + (cleanO ? '' : ':MODIFIED'),
                 { family: 'ohko', subject: b.move, detail: cleanO ? 'connects at equal level' : 'modified',
                   expect: cleanO ? expect : null, scored: cleanO },
                 connected, half);
            continue;
          }
          const clean = isCleanAccuracy(b.move, fx.accuracy, att, def, field);
          const key = 'accuracy:' + b.move + (clean ? '' : ':MODIFIED');
          bump(key, { family: 'accuracy', subject: b.move, detail: clean ? 'clean' : 'modified',
                      expect: clean ? fx.accuracy : null, scored: clean }, connected, half);
        }
      }

      /* ---- MULTI-HIT --------------------------------------------------------------------------- */
      if (Array.isArray(fx.multihit) && fx.multihit[0] !== fx.multihit[1]) {
        for (const [tid, r] of per) {
          if (r.hitcount == null) continue;
          if (att && (att.item === 'loadeddice' || att.ability === 'skilllink')) { excl('multihit: Loaded Dice / Skill Link carrier'); continue; }
          bump('multihit:' + b.move + ':' + r.hitcount,
               { family: 'multihit', subject: b.move, detail: 'hits=' + r.hitcount,
                 expect: null, scored: false, distribution: true }, true, half);
          bump('multihit:' + b.move, { family: 'multihit', subject: b.move, detail: 'volleys',
                                       expect: null, scored: false }, true, half);
        }
      }

      /* ---- SECONDARIES ------------------------------------------------------------------------- */
      const secs = (fx.secondary || []).filter(Boolean);
      if (secs.length) {
        const attConf = att && (ATT_AB_CONFOUND.has(att.ability) || ATT_ITEM_CONFOUND.has(att.item));
        for (let si = 0; si < secs.length; si++) {
          const s = secs[si];
          const what = engKind(s);
          if (what === 'none') { excl('secondary: the rulebook entry names no effect (procedural — Dire Claw / Tri Attack shape, or a closure the tag owns)'); continue; }
          const pair = b.move + '|' + what;
          /* THE EXPECTATION IS THE FORMAT'S, NEVER THE RULEBOOK'S. Scoring against
           * `data/move-effects.js` measured the engine against a file the engine overrides, which put
           * Moonblast's 9,318-use row on trial at 30% while the tag rolled it at the correct 10 — and
           * that single misdirection was most of a pooled z of -12. */
          if (PAIR_REFUSED.has(pair) && SABOTAGE !== 'refusal') { excl('secondary: the declaration gate refuses this pair (' + pair + ')'); continue; }
          const expect = PAIR_EXPECT.get(pair);
          if (expect == null) { excl('secondary: no format declaration for this (move, effect) pair'); continue; }
          if (expect >= 100) { excl('secondary: a certainty, not a die — million_targets.js excludes chance >= 100'); continue; }
          const key = 'secondary:' + b.move + ':' + what;
          if (attConf) { excl('secondary: attacker rewrites the chance (Serene Grace / Sheer Force / Stench / King\'s Rock)'); continue; }

          if (what.startsWith('selfBoosts')) {
            const r = per.get(b.user) || {};
            const anyHit = [...per].some(([tid, x]) => tid !== b.user && conn(fx, x));
            if (!anyHit) { excl('selfBoost secondary: the move did not connect'); continue; }
            const st = Object.keys(s.selfBoosts)[0];
            const capped = att && (att.boosts || {})[engStat(st)] >= 6;
            if (capped) { excl('selfBoost secondary: user already at the stage cap'); continue; }
            const fired = b.lines.some(f => (f[0] === '-boost') && f[1] === b.user && idOf(f[2]) === idOf(st));
            bump(key, { family: 'secondary', subject: b.move, detail: what, expect, scored: true }, fired, half);
            continue;
          }

          for (const [tid, r] of per) {
            if (tid === b.user) continue;
            if (!conn(fx, r)) {
              /* SPLIT, so the size of the class this file was getting wrong stays visible. A damaging
               * move with no damage line for this body did not reach it; if that count ever collapses
               * to zero the `conn` header above has stopped being about anything. */
              excl((r.touched && fx && fx.category !== 'Status')
                   ? 'secondary: a damaging move with no -damage line for this body — the only evidence '
                     + 'is a bare -boost/-status, which on this stream is an unmarked end-of-turn residual (see conn)'
                   : 'secondary: did not connect with this body');
              continue;
            }
            if (r.fainted) { excl('secondary: target fainted to the hit'); continue; }
            const def = snap.get(tid);
            /* A BODY THAT WAS NOT ON THE PRE-TURN BOARD CANNOT BE ASKED WHETHER IT WAS ELIGIBLE.
             * The snapshot is keyed by slot identity (`p2a: <name>`), so a replacement that arrived
             * after a faint is a different key and carries no ability, no types and no status here.
             * Scoring it anyway asks `canTakeStatus` with an EMPTY ability and EMPTY types — which
             * refuses nothing — so a Fire-type replacement would sit in a burn denominator it could
             * never fire in. Counted, so the size of the hole is on the record rather than assumed
             * small. */
            if (!def) { excl('secondary: target was not on the pre-turn board (a mid-turn replacement); its ability and types are unknown so eligibility cannot be asked'); continue; }
            if (def && DEF_AB_CONFOUND.has(def.ability)) { excl('secondary: target refuses secondaries'); continue; }

            if (s.status) {
              const proxy = { fainted: false, curHP: 1, status: status.get(tid) || '',
                              ability: (def && def.ability) || '', types: (def && def.types) || [] };
              if (!M.canTakeStatus(proxy, s.status)) { excl('secondary status: target ineligible (engine canTakeStatus)'); continue; }
              const fired = b.lines.some(f => f[0] === '-status' && f[1] === tid && idOf(f[2]) === idOf(s.status));
              if (fired) status.set(tid, s.status);
              if (DUMP_STATUS) dumpStatusTrial(key, expect, fired, b, T, tid, r, def, att, half, s.status);
              bump(key, { family: 'secondary', subject: b.move, detail: what, expect, scored: true }, fired, half);
            } else if (s.volatile === 'flinch') {
              /* THE FLINCH DENOMINATOR IS THE ONE THE TARGET ROW ASKS FOR: hits on a body that had
               * NOT already acted this turn. A flinch on a body that has already moved is set and
               * costs nothing, and the engine counts it apart (MEDSEEN.flinchTooLate) — it is not
               * observable in the stream, so it is refused rather than scored as a failure. */
              const already = actedBefore.has(tid) && actedBefore.get(tid) < b.at;
              if (already) { excl('flinch: target had already acted this turn'); continue; }
              /* AND IT MUST HAVE REACHED ITS ACTION AFTERWARDS, or the flinch is unobservable. A body
               * that is knocked out later in the turn — by the partner, by a residual — never emits a
               * |cant| line whether or not it flinched, so counting it in the denominator censors the
               * numerator downward and reports a working flinch as a broken one. */
              if (!actedBefore.has(tid)) { excl('flinch: target never reached its action this turn (fainted later, or the turn ended)'); continue; }
              if (def && FLINCH_REFUSERS.has(def.ability)) { excl('flinch: target refuses the volatile'); continue; }
              const fired = T.events.some(f => f[0] === 'cant' && f[1] === tid && f[2] === 'flinch');
              bump(key, { family: 'secondary', subject: b.move, detail: what, expect, scored: true }, fired, half);
            } else if (s.volatile) {
              const fired = b.lines.some(f => f[0] === '-start' && f[1] === tid && idOf(f[2]).includes(idOf(s.volatile)));
              bump(key, { family: 'secondary', subject: b.move, detail: what, expect, scored: true }, fired, half);
            } else if (s.targetBoosts) {
              const st = Object.keys(s.targetBoosts)[0];
              const dir = s.targetBoosts[st] > 0 ? 1 : -1;
              const cur = def ? (def.boosts || {})[engStat(st)] || 0 : 0;
              if ((dir < 0 && cur <= -6) || (dir > 0 && cur >= 6)) { excl('secondary boost: target already at the stage cap'); continue; }
              const refused = b.lines.some(f => f[0] === '-fail' && f[1] === tid && /unboost/.test(f[2] || ''));
              if (refused) { excl('secondary boost: the drop was refused by an ability (announced)'); continue; }
              /* AND THE REFUSAL THAT IS NEVER ANNOUNCED. See STAT_DROP_REFUSERS above: the engine
               * suppresses the `-fail` line for a SECONDARY drop by design, so the line above can
               * only ever catch the direct-move path. Without this the Clear Body class sits in
               * every targetBoosts denominator unable to fire. */
              if (dir < 0 && dropSilentlyRefused(def, st)) { excl('secondary boost: the drop was refused SILENTLY (preventsStatDrop carrier; the engine emits no -fail for a secondary)'); continue; }
              if (def && BOOST_INVERTERS.has(def.ability)) { excl('secondary boost: target inverts boosts, so the drop lands as a boost and the direction of the observation flips'); continue; }
              const fired = b.lines.some(f => f[0] === (dir > 0 ? '-boost' : '-unboost') && f[1] === tid && idOf(f[2]) === idOf(st));
              bump(key, { family: 'secondary', subject: b.move, detail: what, expect, scored: true }, fired, half);
            }
          }
        }
      }
    }

    /* ---- FULL PARALYSIS ---------------------------------------------------------------------- */
    for (const [tid, v] of snap) {
      if (v.status !== 'par' || v.fainted) continue;
      const cantPar = T.events.some(f => f[0] === 'cant' && f[1] === tid && f[2] === 'par');
      const moved = T.blocks.some(b => b.user === tid);
      if (!cantPar && !moved) { excl('par: the body never reached its action this turn'); continue; }
      bump('chance:par', { family: 'chance', subject: 'par', detail: 'full paralysis',
                           expect: 12.5, scored: true }, cantPar, half);
    }
  }
}

/* THE ENGINE'S OWN `SD2ENG`, mirrored — including `accuracy` and `evasion`, which this map was
 * missing. medicham2 stores an accuracy stage under `boosts.acc`; without these two rows the
 * stage-cap exclusion for Muddy Water's accuracy drop read `boosts.accuracy`, which is always
 * undefined, so a target already at −6 accuracy stayed in the denominator and could never fire. */
const ENG_STAT = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp', hp: 'hp',
                   accuracy: 'acc', evasion: 'eva' };
const engStat = s => ENG_STAT[s] || s;

/* A TRIAL IS CLEAN ONLY IF NOTHING IN THE WORLD MOVED THE NUMBER. The engine's own printedAccuracy
 * under the live field is asked first: Thunder is 70 in the open, never-miss in rain, and pooling
 * those two is exactly what the target row's denominator sentence forbids. */
function isCleanAccuracy(mid, declared, att, def, field) {
  try {
    const pa = M.printedAccuracy(mid, field);
    if (pa !== declared) return false;
  } catch (e) { return false; }
  return noAccuracyModifier(att, def, field);
}
/* THE MODIFIER HALF ON ITS OWN, because the OHKO family needs it and cannot use the half above.
 * An OHKO move's printed accuracy is 30 while the rate it is scored against is 30 OR 20 (Sheer Cold
 * from a non-Ice body), so `printedAccuracy === declared` is the wrong question there — but "did a
 * stage, an ability, an item or gravity move the number" is exactly the same question, and the OHKO
 * arm was asking nobody. That matters more than it looks: Showdown's OHKO moves BYPASS accuracy
 * modifiers entirely (`battle-actions.ts:696`) and medicham2's `hitChance` applies the attacker's
 * accuracy stage, the defender's evasion stage and every ACCMOD row to them like any other move. So
 * a MODIFIED bucket that is not empty is itself the evidence, and pooling it into the bare arm both
 * hides the defect and corrupts the clean rate. */
function noAccuracyModifier(att, def, field) {
  if (field && field.gravity > 0) return false;
  if (att) {
    if (ACC_CONFOUND.has('ability:' + att.ability) || ACC_CONFOUND.has('item:' + att.item)) return false;
    if ((att.boosts || {}).acc) return false;
  }
  if (def) {
    if (ACC_CONFOUND.has('ability:' + def.ability) || ACC_CONFOUND.has('item:' + def.item)) return false;
    if ((def.boosts || {}).eva) return false;
  }
  return true;
}

/* ---- SCORING --------------------------------------------------------------------------------------
 * Wilson, because a normal-approximation interval on a 10% secondary at n=40 puts the lower bound
 * below zero and this file would then never flag anything. */
function wilson(k, n, z) {
  if (!n) return [0, 1];
  const p = k / n, z2 = z * z;
  const d = 1 + z2 / n;
  const c = p + z2 / (2 * n);
  const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
/* THE FLAGGER. SABOTAGE turns it off, and that is the only thing MILLIONRUN_SABOTAGE does — it
 * exists so the red proofs can be shown red, and it makes the run refuse to write. */
function flags(k, n, expect, z) {
  if (SABOTAGE === 'flagger') return false;
  const [lo, hi] = wilson(k, n, z);
  return expect < lo || expect > hi;
}

/* ---- THE POOLED TEST, AND IT IS THE HEADLINE AT SMALL N ------------------------------------------
 * A per-row interval on a 30% secondary needs hundreds of trials before it means anything, and a
 * corpus this size gives most rows twenty. The question "does the sampler fire at the rate we
 * declared" is answerable long before any single row is: pool the trials, sum the EXPECTED fires
 * (each row at its own declared p — not a common one), and compare. Poisson-binomial, so the variance
 * is the sum of the per-row variances rather than an n·p̄·(1−p̄) that would be wrong whenever the
 * rows carry different rates. A rate error in one direction across many moves — which is the shape a
 * generated rulebook produces — shows up here at a fraction of the games it needs per row. */
function pooled(rows) {
  let n = 0, obs = 0, exp = 0, varr = 0;
  for (const t of rows) {
    if (!t.scored || t.expect == null || !t.n) continue;
    const p = t.expect / 100;
    n += t.n; obs += t.k; exp += t.n * p; varr += t.n * p * (1 - p);
  }
  const sd = Math.sqrt(varr);
  return { trials: n, fired: obs, expected_fires: +exp.toFixed(2),
           z: sd > 0 ? +((obs - exp) / sd).toFixed(3) : null,
           observed_pct: n ? +(100 * obs / n).toFixed(3) : null,
           expected_pct: n ? +(100 * exp / n).toFixed(3) : null };
}
/* A pooled arm DIVERGES at |z| > 3. Not 1.96: this statistic is computed once per family on every run
 * and a 5% flag rate would make it noise. SABOTAGE turns it off with the per-row flagger, for the
 * same reason and by the same switch. */
function pooledDiverges(p) { return SABOTAGE === 'flagger' ? false : (p.z != null && Math.abs(p.z) > 3); }

function scoreRows(rows, alphaZ, bonfZ) {
  return rows.map(t => {
    const p = t.n ? t.k / t.n : null;
    const [lo, hi] = wilson(t.k, t.n, alphaZ);
    const out = {
      key: t.key, family: t.family, subject: t.subject, detail: t.detail,
      declared_pct: t.expect, observed_pct: p == null ? null : +(100 * p).toFixed(3),
      trials: t.n, fired: t.k,
      ci95_pct: [+(100 * lo).toFixed(3), +(100 * hi).toFixed(3)],
      half_width_pts: +(100 * (hi - lo) / 2).toFixed(3),
      scored: !!t.scored && t.expect != null,
    };
    if (out.scored) {
      out.diverges_at_95 = flags(t.k, t.n, t.expect / 100, alphaZ);
      out.diverges_bonferroni = flags(t.k, t.n, t.expect / 100, bonfZ);
      const a = t.halves[0], b = t.halves[1];
      out.split_half = (a.n >= 30 && b.n >= 30)
        ? { a: +(100 * a.k / a.n).toFixed(2), b: +(100 * b.k / b.n).toFixed(2),
            spread_pts: +Math.abs(100 * a.k / a.n - 100 * b.k / b.n).toFixed(2) }
        : null;
    }
    return out;
  });
}

/* ---- MAIN ----------------------------------------------------------------------------------------- */
const t0 = Date.now();
console.log('MILLION RUN — the rate runner\n');
console.log('  release       ' + REL.id + '   (first cut ' + REL.manifest.cut + ')');
console.log('  targets       ' + TARGETS_STAMP.file + '  ' + TARGETS_STAMP.rows + ' rows, digest '
            + TARGETS_STAMP.digest + ', ' + TARGETS_STAMP.age_hours + ' h old');

const gate = declarationGate();
console.log('\n  DECLARATION GATE (ROADMAP #132) — the format against the frozen engine rulebook');
console.log('    ' + gate.pairs_compared + ' (move, effect) pairs on either side');
console.log('    ' + gate.agree + ' agree, ' + gate.disagree + ' DISAGREE');
console.log('    chance read from: ' + Object.entries(gate.by_source).map(([k, v]) => v + ' ' + k).join(', '));
console.log('    ' + gate.certainties + ' are CERTAINTIES (>=100%) and are not dice — excluded from the rate run');
console.log('    ' + gate.not_compared.length + ' pairs carry NO chance on either side (a closure another tag owns): '
            + gate.not_compared.map(r => r.move).join(', '));
console.log('    ' + gate.rulebook_only.length + ' pairs roll a number NO format-derived tag guards:');
for (const r of gate.rulebook_only)
  console.log('        ' + r.pair.padEnd(34) + String(r.pct).padStart(5) + '%   uses '
              + String(r.uses).padStart(6) + (r.agree ? '   agrees with the format' : '   DISAGREES'));
for (const d of gate.disagreements)
  console.log('      ' + d.move.padEnd(18) + d.kind.padEnd(22) + 'format '
              + String(d.format_pct).padStart(5) + '   engine ' + String(d.engine_pct).padStart(5)
              + '   uses ' + String(d.uses).padStart(6) + '   ' + d.note);
if (DECL_ONLY) {
  console.log('\n  --declaration-only: no games played, no artifact written.');
  process.exit(gate.disagree ? 1 : 0);
}

/* THE STAGED ARM RUNS INSTEAD OF THE SELF-PLAY ARM, NEVER BESIDE IT. Two arms in one process would
 * share `trials`, share `diag` and share one artifact, and the whole argument for the staged arm is
 * that its denominator is a DIFFERENT KIND OF THING from the self-play one. They are kept apart so
 * neither can be quoted as the other. The declaration gate above has already run, because a staged
 * rate measured against a declaration we have not finished checking is the same #132-before-#133
 * mistake one level down. */
if (STAGED) { stagedArm(gate); process.exit(0); }

/* THE REFUSAL IS PER (MOVE, EFFECT) PAIR, NEVER PER MOVE. Triple Arrows carries a 50% Defence drop
 * AND a 30% flinch; refusing the whole move because one of the two disagrees throws away a clean arm,
 * and refusing the move that a SIBLING effect broke is how a wrong denominator gets built one level
 * up. `PAIR_REFUSED` is consulted inside the tally (see the secondary block) so a refused pair is
 * never counted at all, rather than counted and marked afterwards. */
for (const r of gate.disagreements) PAIR_REFUSED.add(r.move + '|' + r.kind);
{ /* every AGREEING pair carries the format's chance forward as the expectation */
  const D = FMT.D;
  for (const mv of D.moves.all()) {
    if (mv.isNonstandard) continue;
    for (const q of [].concat(mv.secondaries || (mv.secondary ? [mv.secondary] : [])).filter(Boolean)) {
      const pair = mv.id + '|' + fmtKind(q);
      if (!PAIR_REFUSED.has(pair)) PAIR_EXPECT.set(pair, q.chance == null ? 100 : q.chance);
    }
  }
  /* THE SABOTAGE, AND WHY IT HAS TO REACH IN HERE. There are TWO independent guards on a refused
   * pair — the tally skips it, AND it never gets an expectation — so disabling one alone leaves the
   * leak check unable to fire, and a check that cannot be shown red is a check nobody has seen work.
   * `refusal` disables both: the refused pair is given the ENGINE's own number as its expectation,
   * which is precisely the mistake (scoring the sampler against the declaration the gate rejected). */
  if (SABOTAGE === 'refusal')
    for (const d of gate.disagreements) PAIR_EXPECT.set(d.move + '|' + d.kind, d.engine_pct);
}

console.log('\n  playing ' + GAMES + ' games, team ' + TEAM + ', turn cap ' + TURN_CAP
            + ', FREE-RUNNING rng (mulberry32, seed ' + SEED + ')');
const rng = mulberry32(SEED);
const teamRng = mulberry32(SEED ^ 0x5f3759df);
const seen0 = Object.assign({}, M.MEDSEEN);
for (let g = 0; g < GAMES; g++) playGame(rng, g < GAMES / 2 ? 0 : 1, teamRng);
const elapsed = Date.now() - t0;
const seenDelta = {};
for (const k of Object.keys(M.MEDSEEN)) if (M.MEDSEEN[k] !== (seen0[k] || 0)) seenDelta[k] = M.MEDSEEN[k] - (seen0[k] || 0);

/* ---- RED PROOF 1: THE PIN. Same games, every die pinned to one corner. Accuracy must collapse and
 * every secondary must stop firing, and the INSTRUMENT MUST SAY SO. If a pinned engine passes, the
 * instrument is measuring nothing — which is the ROADMAP #88 hazard this file's header is about. */
const freeRows = [...trials.values()];
/* `MILLIONRUN_SABOTAGE=dumpseal` leaves the dump OPEN across the pinned red proof, which is the state
 * that produced the 1,824-against-1,818 mismatch. It exists so the identity check below can be shown
 * RED on demand rather than only once, by accident, in an analysis nobody kept. */
if (SABOTAGE !== 'dumpseal') dumpSealed = true;
const diagFree = JSON.parse(JSON.stringify(diag));     // snapshot BEFORE the pinned run pollutes it
trials.clear();
const PIN_GAMES = Math.max(60, Math.min(GAMES, 200));
const pinTeamRng = mulberry32(SEED ^ 0x5f3759df);        // the SAME team sequence as the free arm
for (let g = 0; g < PIN_GAMES; g++) playGame(pinnedRng, g < PIN_GAMES / 2 ? 0 : 1, pinTeamRng);
const pinnedRows = [...trials.values()];
trials.clear();

/* ---- THE INSTRUMENT CHECKS ITSELF AGAINST THE ENGINE'S OWN COUNTERS -----------------------------
 * WIRE 157 exported MEDSEEN by reference precisely so a caller could subtract it around a run, and
 * this is what that is for. THE FIRST VERSION OF THIS FILE READ 378 FLINCH TRIALS AND ZERO FIRES
 * while MEDSEEN.flinch sat at 233 in the same corpus — the flinch cant-line marked the target as
 * "already acted", so every trial excluded the very event it was counting. It looked exactly like an
 * engine that never flinches, which is a headline somebody would have filed.
 *
 * A counter that is non-zero while the parsed numerator is zero means the PARSER is broken, not the
 * engine. Stated as a REFUSAL rather than a note: this instrument's whole output is numerators. */
function instrumentChecks(rows, counters) {
  const fires = (pred) => rows.filter(pred).reduce((a, t) => a + t.k, 0);
  const out = [];
  const pair = (name, counter, n, why) => out.push({
    check: name, engine_counter: counter, parsed_numerator: n,
    ok: !(counter > 0 && n === 0), why,
  });
  pair('flinch', counters.flinch || 0, fires(t => /volatile:flinch/.test(t.key)),
       'MEDSEEN.flinch counts flinches SET on a body that had not yet acted; the trace says |cant|X|flinch| '
     + 'when that body comes up. They are not equal — a body that faints first, or a King\'s Rock / Fling '
     + 'flinch this instrument excludes, breaks the identity — but a zero against a non-zero cannot happen.');
  pair('secondary status', counters.secondaryVolatileApplied || 0,
       fires(t => t.family === 'secondary' && /^secondary:.*(status|volatile)/.test(t.key)),
       'the engine counts a secondary volatile applied; the trace announces it.');
  return out;
}

const POOL_FAMILIES = ['secondary', 'accuracy', 'ohko', 'chance'];
const Z95 = 1.959963985;
const nScored = freeRows.filter(t => t.scored && t.expect != null).length || 1;
const zBonf = zFor(0.05 / nScored);
function zFor(alpha) {   // inverse normal, Acklam's rational approximation — two-sided
  const p = 1 - alpha / 2;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425;
  let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/* THE PIN IS JUDGED ON THE POOLED ARMS, because that is the arm a real defect would move too, and a
 * per-row judgement at this corpus size measures how many trials one move happened to get rather than
 * whether the instrument can see. Both arms must have real trials AND must be flagged: an arm with no
 * trials proves nothing and must not read as a pass. */
const pinAcc = pooled(pinnedRows.filter(t => t.family === 'accuracy'));
const pinSec = pooled(pinnedRows.filter(t => t.family === 'secondary'));
const pinArm = (p, name) => ({ arm: name, trials: p.trials, fired: p.fired, expected_fires: p.expected_fires,
                               z: p.z, flagged: pooledDiverges(p), enough_trials: p.trials >= 50 });
const pinArms = [pinArm(pinAcc, 'accuracy'), pinArm(pinSec, 'secondary')];
const pinnedCaught = pinArms.every(a => a.enough_trials && a.flagged);
const pinnedScored = scoreRows(pinnedRows.filter(t => t.scored && t.expect != null && t.n >= 20), Z95, Z95);
const pinnedMissed = pinArms.filter(a => !(a.enough_trials && a.flagged));

/* ---- RED PROOF 2: A WRONG DECLARATION. The same observed tallies, re-scored against an expectation
 * shifted by 25 points. Every row with enough trials must be flagged; a row that is not flagged is a
 * row this instrument could not have caught a 25-point error in. */
/* THE SHIFT GOES ONE WAY FOR EVERY ROW, and the first version did not — it moved rows above 50 down
 * and rows below 50 up, so in the POOLED sum the accuracy rows' deficit cancelled the secondary rows'
 * surplus and a 25-point error across the whole corpus came out at z = 1.3. Two errors in opposite
 * directions is not a harder test, it is a test that passes a broken instrument. */
const shifted = freeRows.filter(t => t.scored && t.expect != null)
  .map(t => Object.assign({}, t, { expect: Math.max(1, t.expect - 25) }));
const shiftPooled = pooled(shifted);
const shiftedScored = scoreRows(shifted.filter(t => t.n >= 30), Z95, Z95);
/* THE SHIFT PROOF IS JUDGED ON THE POOLED ARM, AND THE PER-ROW MISSES ARE A POWER STATEMENT RATHER
 * THAN A FAILURE. Requiring every row to flag was the first version and it refused to write on a run
 * where four rows observed ZERO fires: a 20% declaration shifted to 1% cannot be separated from an
 * observation of 0/67 by any correct interval, and demanding that it be is demanding a false
 * positive. The per-row flagger gets its OWN decidable proof below instead. */
const shiftMissed = shiftedScored.filter(r => !r.diverges_at_95)
  .map(r => ({ key: r.key, trials: r.trials, observed_pct: r.observed_pct, shifted_to: r.declared_pct,
               why: 'not separable at this n — a power limit, not a blind instrument' }));
/* THE PER-ROW PROOF, DECIDABLE FOR EVERY ROW: take the real trial counts and substitute an outcome
 * that is maximally wrong — every trial fires when the declaration says it rarely should, or none
 * fires when it says it usually should. A flagger that misses THAT is blind, and there is no n at
 * which the answer is ambiguous. */
const synthetic = scoreRows(freeRows.filter(t => t.scored && t.expect != null && t.n >= 20)
  .map(t => Object.assign({}, t, { k: t.expect >= 50 ? 0 : t.n,
                                   halves: [{ n: 0, k: 0 }, { n: 0, k: 0 }] })), Z95, Z95);
const synthMissed = synthetic.filter(r => !r.diverges_at_95).map(r => ({ key: r.key, trials: r.trials }));
const shiftCaught = shiftPooled.trials >= 50 && pooledDiverges(shiftPooled)
  && synthetic.length > 0 && synthMissed.length === 0;

const scored = scoreRows(freeRows, Z95, zBonf)
  .sort((a, b) => (b.trials - a.trials));
/* THE REFUSAL IS ENFORCED AT THE TALLY, AND THIS ASSERTS IT RATHER THAN REPEATING IT. A refused pair
 * is dropped inside the secondary block, so it never becomes a row and never enters the POOLED sum —
 * which is the whole point, because marking a row afterwards leaves it inside the pooled statistic.
 * If one is here anyway, the two paths have drifted and the pooled headline is contaminated, so this
 * refuses to write instead of publishing a number over a declaration the gate rejected. */
const leaked = scored.filter(r => r.family === 'secondary'
  && PAIR_REFUSED.has(r.subject + '|' + String(r.key).split(':').slice(2).join(':')));
if (leaked.length) {
  console.error('\n  REFUSING TO WRITE AN ARTIFACT. ' + leaked.length + ' row(s) the declaration gate '
    + 'refused reached the tally: ' + leaked.map(r => r.key).join(', ') + '. The gate and the tally '
    + 'disagree about what is scorable, so the pooled figure is over a declaration we rejected.');
  process.exit(1);
}

/* ---- COVERAGE, OFF THE TARGET LIST ITSELF -------------------------------------------------------- */
const observedSubjects = new Set(scored.filter(r => r.trials > 0).map(r => r.family + ':' + r.subject));
const coverage = { by_family: {}, zero_trial_rows: [] };
for (const row of TARGETS.rows) {
  const fam = row.family;
  const sup = FAMILY_SUPPORT[fam] || { observable: false, why: 'no support declared' };
  coverage.by_family[fam] = coverage.by_family[fam] || { rows: 0, observed: 0, observable: sup.observable, why: sup.why || null };
  coverage.by_family[fam].rows++;
  if (observedSubjects.has(fam + ':' + row.subject)) coverage.by_family[fam].observed++;
  else coverage.zero_trial_rows.push({ family: fam, subject: row.subject, observable: sup.observable });
}

const perTurnMs = diagFree.turns ? elapsed / diagFree.turns : null;
const projection = {
  measured_ms_per_turn: perTurnMs == null ? null : +perTurnMs.toFixed(4),
  measured_turns_per_game: diagFree.games ? +(diagFree.turns / diagFree.games).toFixed(2) : null,
  ms_per_game: diagFree.games ? +(elapsed / diagFree.games).toFixed(3) : null,
  one_million_games_hours: diagFree.games ? +((elapsed / diagFree.games) * 1e6 / 3.6e6).toFixed(2) : null,
  taken_under_load: true,
  note: 'This throughput was taken while another division was working on this machine, so it is an '
      + 'UPPER bound on the time and must not be recorded as a benchmark. tests/bench-medicham.js is '
      + 'the canonical instrument and correctly REFUSES to record under load. The parse and tally '
      + 'cost is INSIDE this figure — it is the cost of a rate-measuring game, not of a bare rollout.',
};

/* THE `note` IS FIRST AND THAT IS LOAD-BEARING, not decoration. engine/conformance.js's S13 reads the
 * first 400 bytes of a data file to decide whether it declares itself generated, and this artifact led
 * with a 24-key `source_digests` block — so the `generated` and `by` fields sat well past the window
 * and the file was flagged "generated but does not say so" on the run that created it. */
const artifact = Object.assign({
  note: 'GENERATED — do not hand-edit. Written by engine/million_run.js. See its provenance stamp below.',
}, REL.stamp(), {
  generated: new Date().toISOString(),
  by: 'engine/million_run.js',
  what: 'Observed rates from free-running MEDICHAM self-play, against the rates '
      + 'data/million-targets.json declares. ROADMAP #133, gated on #132.',
  rng: 'FREE-RUNNING (mulberry32, seed ' + SEED + '). NOT the differential drivers\' pin — ROADMAP '
     + '#88 pins every die to one corner, which makes a wrong RATE agree with itself. The red proof '
     + 'below runs the same games pinned and requires the instrument to catch it.',
  scope: 'This instrument tests the SAMPLER, not ELIGIBILITY. Its denominators ask the engine\'s own '
       + 'canTakeStatus and the engine\'s own tag artifact whether a trial was eligible, so an engine '
       + 'that is wrong about who can be burned shows up here as a wrong denominator and not as a '
       + 'wrong rate. tests/roster.js and engine/replay_differential.js own eligibility.',
  target_list: TARGETS_STAMP,
  declaration_gate: gate,
  corpus: { games: diagFree.games, turns: diagFree.turns, move_blocks: diagFree.blocks, team_size: TEAM, turn_cap: TURN_CAP, seed: SEED },
  structural: {
    switch_events_observed: diagFree.switch_events,
    replacement_switches: diagFree.replacement_switches,
    voluntary_switches: diagFree.voluntary_switches,
    faints: diagFree.faints,
    note: 'COVERAGE IS A PROPERTY OF THE ACTION SET, NOT OF N. medicham2\'s chooseAction() returns '
        + 'moves and only moves (ROADMAP #63), so a body only ever leaves the field by FAINTING. '
        + 'Read `voluntary_switches`: if it is 0, no rollout in this corpus ever chose to pivot, and '
        + 'every mechanic whose trigger is a DECISION to switch — a pivot into Intimidate, a '
        + 'Regenerator pivot, U-turn/Volt Switch bookkeeping, Trace with two eligible foes on entry — '
        + 'has ZERO samples at any N. Ten million games do not buy one of those. What IS reached is '
        + 'the REPLACEMENT half: a body brought in after a faint runs its entry ability, so entry '
        + 'effects and hazard chip get samples at the replacement rate and NOT at the rate real play '
        + 'produces them. A rate measured over replacements only is not a rate over entries.',
  },
  pooled: {
    what: 'The headline at this corpus size. Every scored trial, each row at its OWN declared rate; '
        + 'expected fires summed, variance summed (Poisson-binomial). |z| > 3 is a divergence. A '
        + 'rulebook wrong in one direction across many moves shows up here long before any single '
        + 'row has enough trials to say so.',
    all: pooled(freeRows),
    by_family: Object.fromEntries(POOL_FAMILIES
      .map(f => [f, pooled(freeRows.filter(t => t.family === f))])),
    diverges: Object.fromEntries(POOL_FAMILIES
      .map(f => [f, pooledDiverges(pooled(freeRows.filter(t => t.family === f)))])),
    /* THE SECONDARY FAMILY SPLIT BY WHAT THE EFFECT IS, because the arms behave differently and a
     * single pooled z hides that. Derived from the row key, not from a second tally. */
    secondary_by_effect: Object.fromEntries(['status', 'volatile:flinch', 'targetBoosts', 'selfBoosts']
      .map(k => [k, pooled(freeRows.filter(t => t.family === 'secondary'
                    && (k === 'volatile:flinch' ? /volatile:flinch/.test(t.key) : t.key.includes(':' + k))))])),
  },
  red_proof: {
    what: 'The artifact refuses to exist unless both of these were CAUGHT. A flag that has never '
        + 'fired is a flag nobody has seen work.',
    pin: { games: PIN_GAMES, arms: pinArms, rows_with_20_plus_trials: pinnedScored.length,
           caught: pinnedCaught, missed: pinnedMissed,
           what: 'every die pinned to 0.99 — the ROADMAP #88 state. Accuracy must collapse to ~0 and '
               + 'no secondary may fire, and every such row must be FLAGGED.' },
    wrong_declaration: { pooled: shiftPooled, rows: shiftedScored.length, caught: shiftCaught,
           not_separable_at_this_n: shiftMissed,
           per_row_synthetic: { rows: synthetic.length, missed: synthMissed,
             what: 'every scored row with 20+ trials, its real n against a maximally wrong outcome '
                 + '(0 fires where the declaration is >= 50%, all fires where it is below). Decidable '
                 + 'at every n; a miss here means the row-level flagger is blind.' },
           what: 'the same observed tallies re-scored against a declaration moved 25 points DOWN for '
               + 'every row — one direction, because the first version moved rows in opposite '
               + 'directions and the two errors cancelled in the pooled sum (z fell to 1.3). The '
               + 'pooled arm must flag AND the per-row synthetic must be caught in full.' },
    sabotage_env: SABOTAGE || null,
  },
  scoring: { interval: 'Wilson 95%', bonferroni_z: +zBonf.toFixed(4), scored_rows: nScored,
             note: 'divergence at 95% over ~100 rows produces ~5 false flags by construction; the '
                 + 'Bonferroni column is the honest headline and the 95% column is the reading list.' },
  instrument_checks: instrumentChecks(freeRows, seenDelta),
  engine_counters: seenDelta,
  diagnostics: diagFree,
  family_support: FAMILY_SUPPORT,
  coverage,
  projection,
  rows: scored,
});

/* ---- REPORT ---------------------------------------------------------------------------------------- */
const shown = scored.filter(r => r.scored && r.trials >= 20).slice(0, 30);
console.log('\n  corpus: ' + diagFree.games + ' games, ' + diagFree.turns + ' turns, '
            + diagFree.blocks + ' move blocks, ' + diagFree.hits + ' connections, '
            + diagFree.misses + ' misses, ' + diagFree.switch_events + ' switch events');
console.log('\n  busiest scored rows (declared vs observed, Wilson 95%):');
for (const r of shown)
  console.log('    ' + String(r.trials).padStart(6) + '  ' + r.key.padEnd(46)
              + String(r.declared_pct).padStart(6) + '  ->' + String(r.observed_pct).padStart(8)
              + '  [' + r.ci95_pct[0].toFixed(1) + ', ' + r.ci95_pct[1].toFixed(1) + ']'
              + (r.diverges_bonferroni ? '   DIVERGES' : r.diverges_at_95 ? '   diverges@95' : ''));
const div95 = scored.filter(r => r.scored && r.diverges_at_95).length;
const divB = scored.filter(r => r.scored && r.diverges_bonferroni).length;
console.log('\n  POOLED — every scored trial, each at its own declared rate:');
for (const [fam, p] of Object.entries(artifact.pooled.by_family)) {
  if (!p.trials) continue;
  console.log('    ' + fam.padEnd(12) + String(p.trials).padStart(7) + ' trials   fired '
              + String(p.fired).padStart(6) + '   expected ' + String(p.expected_fires).padStart(8)
              + '   z ' + String(p.z).padStart(7) + (artifact.pooled.diverges[fam] ? '   DIVERGES' : ''));
}
const pa = artifact.pooled.all;
console.log('    ' + 'ALL'.padEnd(12) + String(pa.trials).padStart(7) + ' trials   fired '
            + String(pa.fired).padStart(6) + '   expected ' + String(pa.expected_fires).padStart(8)
            + '   z ' + String(pa.z).padStart(7));
console.log('\n  ' + scored.filter(r => r.scored).length + ' scored rows; ' + div95
            + ' diverge at 95%, ' + divB + ' survive Bonferroni');
console.log('  excluded trials, by reason:');
for (const [k, v] of Object.entries(diagFree.excluded).sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log('    ' + String(v).padStart(7) + '  ' + k);
console.log('\n  red proof — pin: ' + (pinnedCaught ? 'CAUGHT' : 'NOT CAUGHT') + '  '
            + pinArms.map(a => a.arm + ' n=' + a.trials + ' fired=' + a.fired + ' exp='
                          + a.expected_fires + ' z=' + a.z + (a.flagged ? ' FLAGGED' : ' not flagged')).join('; '));
console.log('  red proof — wrong declaration: ' + (shiftCaught ? 'CAUGHT' : 'NOT CAUGHT')
            + '  pooled z=' + shiftPooled.z + '; per-row synthetic ' + (synthetic.length - synthMissed.length)
            + '/' + synthetic.length + ' flagged; ' + shiftMissed.length
            + ' shifted rows not separable at this n');
console.log('  throughput ' + projection.ms_per_game + ' ms/game under load -> 1,000,000 games ~ '
            + projection.one_million_games_hours + ' h');

const badChecks = artifact.instrument_checks.filter(c => !c.ok);
for (const c of artifact.instrument_checks)
  console.log('  instrument check — ' + c.check.padEnd(18) + 'engine counter ' + String(c.engine_counter).padStart(6)
              + ', parsed numerator ' + String(c.parsed_numerator).padStart(6) + '  ' + (c.ok ? 'ok' : 'FAILED'));
if (badChecks.length) {
  console.error('\n  REFUSING TO WRITE AN ARTIFACT. The engine says a mechanic fired and this parser '
    + 'counted none of it: ' + badChecks.map(c => c.check).join(', ') + '. That is an instrument '
    + 'fault wearing an engine defect\'s clothes — which is exactly what the first run of this file '
    + 'produced for flinch.');
  process.exit(1);
}
if (!pinnedCaught || !shiftCaught) {
  console.error('\n  REFUSING TO WRITE AN ARTIFACT. A red proof went uncaught, which means this '
    + 'instrument cannot demonstrate it would notice a wrong rate. A number it produced would be '
    + 'confident and meaningless — exactly the failure the header is about.');
  process.exit(1);
}
/* The dump is written even under --no-write: it is not a published figure and it is the only output
 * of a diagnostic run, whose whole point is to leave the artifact everybody quotes alone. */
if (DUMP_STATUS) {
  /* THE DUMP'S OWN RED PROOF, AND IT IS AN IDENTITY RATHER THAN A JUDGEMENT. Summed by key, the
   * dumped rows must reproduce the free arm's own `n` and `k` EXACTLY. If they do not, the dump is
   * describing a different set of trials from the tally and every conditional rate computed off it is
   * about some other population. It has already been red once, for real: the pinned red-proof arm was
   * leaking 6 scald trials in. A mismatch REFUSES to write the file rather than captioning it. */
  const byKey = new Map();
  for (const d of dumpRows) { const a = byKey.get(d.key) || { n: 0, k: 0 }; a.n++; a.k += d.fired; byKey.set(d.key, a); }
  const bad = [];
  for (const t of freeRows) {
    if (t.family !== 'secondary' || !/^status:/.test(String(t.detail || '')) || !t.scored) continue;
    const a = byKey.get(t.key) || { n: 0, k: 0 };
    if (a.n !== t.n || a.k !== t.k) bad.push(t.key + ' tally ' + t.k + '/' + t.n + ' vs dump ' + a.k + '/' + a.n);
  }
  for (const k of byKey.keys()) if (!freeRows.some(t => t.key === k)) bad.push(k + ' is in the dump and not in the tally');
  if (bad.length) {
    console.error('\n  REFUSING TO WRITE THE STATUS DUMP. It does not reproduce the arm it claims to '
      + 'describe:\n    ' + bad.join('\n    '));
    process.exit(1);
  }
  fs.writeFileSync(DUMP_STATUS, dumpRows.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log('\n  --dump-status: ' + dumpRows.length + ' scored status trials -> '
              + path.relative(ROOT, DUMP_STATUS).replace(/\\/g, '/')
              + '  (reproduces the arm exactly, ' + byKey.size + ' keys)');
}
if (NO_WRITE) { console.log('\n  --no-write: nothing written.'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n');
console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));

/* ###################################################################################################
 *  THE STAGED ARM — ROADMAP #196.  ONE SET OF FIXTURES AT TWO DICE SETTINGS.
 * ###################################################################################################
 *
 * Will, 2026-08-11: *"the million game run will be all these staging scenarios right, just with
 * normal accuracy, proc chances, crit chances, etc"*, and then, on Sniper and Merciless: *"so those
 * will have to be in the million game run"*.
 *
 * ================= THE ARGUMENT, WHICH IS ABOUT DENOMINATORS AND NOTHING ELSE =====================
 *
 * `FAMILY_SUPPORT.proc` above marks the whole proc family `observable: false`, in these words:
 *
 *     "an ability/item proc needs the trigger to be REACHED (a contact move that connected, a hit
 *      that would otherwise have been lethal, a turn where moving first changes the board). The trace
 *      does not say whether the trigger was reached, only whether it fired, so the denominator would
 *      be invented. Needs a staged arm, not a bigger corpus."
 *
 * That is exactly right and it is not a sample-size problem. MORE RANDOM GAMES NEVER FIX AN INVENTED
 * DENOMINATOR; THEY ONLY MAKE IT BIGGER. On a board this file BUILT, the trigger is reached by
 * construction — the attacker's move makes contact, the target survives it, the holder is strictly
 * slower, the hit is lethal — so the denominator is the number of trials and nothing is inferred.
 *
 * ================= WHAT "KNOWN BY CONSTRUCTION" IS MADE TO MEAN HERE ==============================
 *
 * A claim that a denominator is construction-known is worth nothing unless it can go red, so every
 * fixture carries THREE things and the artifact refuses to exist without them:
 *
 *   1. `denominator` — one sentence naming what one trial IS. Printed beside the number, always.
 *   2. `reached()`   — the construction VERIFIED on that trial, from the board and the trace. A trial
 *                      where it fails is REFUSED with a named reason and counted; it never silently
 *                      becomes a zero in the numerator. A fixture refusing more than 2% of its
 *                      attempts is NOT SCORED, because at that point the denominator is partly
 *                      inferred and this file has no business publishing a rate over it.
 *   3. A TRIGGER CONTROL ARM — the identical board with the trigger removed and ONE thing changed
 *                      (a NON-contact move where the ability wants contact; a faster holder where the
 *                      item wants to be slower; a survivable hit where the item wants a lethal one).
 *                      It must record ZERO trials, because `reached()` must refuse every one of them,
 *                      AND zero fires on the raw board read. THIS IS THE PROOF THAT THE DENOMINATOR
 *                      IS A TRIGGER AND NOT A CLICK. A control arm that collects trials means
 *                      `reached()` is waving through boards where the mechanic was never asked, which
 *                      is the invented denominator wearing a staged board's clothes.
 *                      `MILLIONRUN_SABOTAGE=staged-precondition` produces exactly that, and the run
 *                      refuses to write.
 *
 * ================= THE DICE ARE FREE, AND THE PROOF THAT THEY ARE ================================
 *
 * Rule 2 of this file's own header applies with full force. The differential drivers pin every die
 * (ROADMAP #88) and the roster inherits that pin — which is why these rows are COULD-NOT-STAGE over
 * there and why they are measurable here. This arm supplies the same free-running mulberry32 stream
 * the self-play arm uses, a fresh one per trial, and it runs the whole fixture set twice more with
 * the dice pinned to each corner: pinned high, no proc may fire; pinned low, every proc must. Both
 * pinned arms must be FLAGGED by the same flagger that judges the real one. If a pinned engine can
 * pass this instrument, the instrument is blind.
 *
 * ================= WHERE THE DECLARED RATE COMES FROM, AND WHY NOT FROM HERE =====================
 *
 * Nothing in this block types a percentage. Two surfaces are read and they are CROSS-CHECKED:
 *
 *   TAG   `data/tags.json` in the FROZEN release — the chance the engine actually rolls with, since
 *         every one of these mechanics reads its `p`/`chance` out of a tag param at the roll site.
 *   LIST  `data/million-targets.json` — DERIVED by engine/million_targets.js from the handler source
 *         in `Dex.forFormat`, and stamped at the top of this run with its digest and age.
 *
 * A subject where the two disagree is REFUSED for scoring and named, exactly as the #132 declaration
 * gate refuses a (move, effect) pair. A subject the TAG does not carry at all is tallied and NOT
 * scored, because the engine has nothing to roll and a rate is the wrong question about it.
 *
 * AND A SUBJECT THE LIST DOES NOT CARRY IS SCORED AGAINST THE TAG ALONE, WITH THAT SAID ON THE ROW.
 * `million_targets.js`'s `PROC_WHAT` is a HAND-TYPED LIST OF TWELVE and the ROADMAP #196
 * reclassification names seventeen, so some of these rows have no independent corroboration. That is
 * printed as a number rather than left as a feeling — the same exposure the free arm prints as
 * `rulebook_only`.
 *
 * ================= THE FIXTURES ARE DERIVED, NOT TYPED ==========================================
 *
 * Carriers, control abilities and the delivery moves all come out of `Dex.forFormat` at run time and
 * are checked through `engine/fixture_preflight.js` — species legality, ability-on-species, move
 * learnability (the clause the standard filter misses: Spore passes every flag and nothing legal
 * learns it) and status immunity. A fixture that cannot run says so with the preflight's own words
 * instead of running and reading "identical".
 *
 * THE NOISE RULE IS HONOURED ON EVERY BOARD. `data/scenarios-from-will.json`'s `the_noise_rule`:
 * *"EVERY BODY NOT UNDER TEST CLICKS THE WEAKEST AVAILABLE MOVE"*, because a loud neighbour
 * contaminates a reading exactly as the Struggle fallback did — seven defects misdiagnosed. Here the
 * two bodies that are not the subject or its target click the weakest boring move on their OWN
 * learnset, aimed at each other and never at the experiment.
 *
 * ================= WHAT THIS ARM IS NOT ==========================================================
 *
 * It is a SAMPLER test, like the rest of this file. It does not ask whether the engine is right about
 * WHO can be paralysed — that is `tests/roster.js` and `engine/replay_differential.js`. What it adds
 * is that on a constructed board the eligibility question is answered by construction too, so a row
 * reading zero here is a much sharper statement than a row reading zero over self-play.
 */

/* ---- THE FORMAT PIECES THE FIXTURES ARE DERIVED FROM -------------------------------------------- */
function stagedDex() {
  const D = FMT.D;
  const legalX = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
  const PRE = require('./fixture_preflight.js');
  const { mcKey } = REL.require('engine/mc_key.js');
  const learnsetOf = (sp) => {
    if (!sp || !sp.exists) return {};
    const own = (D.species.getLearnsetData(sp.id) || {}).learnset || {};
    if (Object.keys(own).length) return own;
    const base = sp.baseSpecies && sp.baseSpecies !== sp.name ? D.species.get(sp.baseSpecies) : null;
    return base && base.exists ? ((D.species.getLearnsetData(base.id) || {}).learnset || {}) : own;
  };
  /* A BODY THIS ENGINE CANNOT BUILD IS NOT A FIXTURE. `MC.mons` is the engine's own dex and it does
   * not cover the whole format — Quick Draw's single legal carrier has no row in it, which is why
   * that row comes out COULD-NOT-STAGE with a derived reason rather than a zero. */
  const rowKey = (sp) => {
    const MAY = { mayMiss: 'a staged fixture skips a species the engine has no row for' };
    let k = null;
    try { k = mcKey(sp.id, MAY); } catch (e) { k = null; }
    k = k || sp.id;
    /* MEMBERSHIP THROUGH THE RESOLVER. This used to read `MC.mons[k] ? k : null`, which is the one
     * doorway tests/test-mc-key.js bans — and the ban is right even here, where `k` came from
     * `mcKey`: the regex cannot tell this from `MC.mons[norm(x)]` and must not try. */
    return mcKey.row(k, MAY) ? k : null;
  };
  /* THE QUIET ABILITIES — every legal ability registering NO handler at all, minus the five that act
   * anyway through a field the engine reads directly. Same derivation and same exclusions as
   * tests/roster.js, which prints its membership for the same reason: this is the shape that
   * over-matches. Levitate registers no handler and grants a Ground immunity. */
  const QUIET_EXCLUDE = {
    levitate: 'grants a Ground immunity, which changes what can be staged against the body',
    stall: 'moves the holder last in its priority bracket, which changes turn order',
    terashell: 'halves the effectiveness of everything at full HP, which is a damage modifier',
    multitype: 'rewrites the holder types from its plate', rkssystem: 'same as Multitype',
  };
  const QUIET = new Set(D.abilities.all()
    .filter(a => a.exists && !a.isNonstandard
      && !Object.keys(a).some(k => /^on/.test(k) && typeof a[k] === 'function')
      && !a.condition && !QUIET_EXCLUDE[a.id]).map(a => a.id));
  /* A BORING DELIVERY MOVE. Every disqualifier is a way a vehicle stops being a vehicle and starts
   * being the experiment: a secondary of its own would collide with the proc under test, a boost or a
   * status moves the board, a charge turn changes the clock, a crit-ratio move corrupts the crit arm,
   * and a multi-hit move throws the contact trigger more than once per click. */
  const boring = (m, wantContact) => {
    if (!legalX(m) || m.category === 'Status' || !(m.basePower > 0)) return false;
    if (m.accuracy !== 100 || m.priority !== 0) return false;
    if ((m.secondaries && m.secondaries.length) || m.secondary) return false;
    if (m.multihit || m.recoil || m.drain || m.selfdestruct) return false;
    if (m.flags && (m.flags.charge || m.flags.recharge)) return false;
    if (m.self || m.boosts || m.status || m.volatileStatus) return false;
    if (!['normal', 'any', 'adjacentFoe'].includes(m.target)) return false;
    if (m.basePower > 60 || m.ohko || m.willCrit || m.critRatio > 1) return false;
    /* Thief and Covet TAKE THE ITEM, which on an item fixture is the experiment walking off the
     * board mid-turn. Derived from the move own handler rather than named. */
    if (typeof m.onAfterHit === 'function' && /setItem|takeItem/.test(String(m.onAfterHit))) return false;
    const c = !!(m.flags && m.flags.contact);
    return wantContact ? c : !c;
  };
  const CONTACT = D.moves.all().filter(m => boring(m, true)).sort((a, b) => a.basePower - b.basePower);
  const NOCONTACT = D.moves.all().filter(m => boring(m, false)).sort((a, b) => a.basePower - b.basePower);
  const carriers = (abId) => D.species.all()
    .filter(sp => legalX(sp) && Object.values(sp.abilities || {}).map(idOf).includes(abId) && rowKey(sp))
    .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                  - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd));
  /* the weakest boring move a body can actually LEARN — the noise rule, per body, off its own
   * learnset, exactly as `the_noise_rule.how` states it */
  const weakestOwn = (sp) => {
    const ls = learnsetOf(sp);
    const m = NOCONTACT.find(x => ls[x.id]) || CONTACT.find(x => ls[x.id]);
    return m ? m.id : null;
  };
  return { D, legalX, PRE, learnsetOf, rowKey, QUIET, CONTACT, NOCONTACT, carriers, weakestOwn, boring };
}

/* ---- THE DECLARATION SURFACES, CROSS-CHECKED ---------------------------------------------------- */
function stagedDeclaration(subject, kind, tagPath) {
  /* tagPath walks the FROZEN tag artifact to the chance the engine rolls with. Nothing is typed. */
  const box = TAGS[kind === 'item' ? 'items' : 'abilities'] || {};
  const row = box[subject];
  let tag = null, tagFrom = null;
  if (row && row.params && tagPath) {
    const p = row.params[tagPath.param];
    if (p) {
      const v = tagPath.pick(p);
      if (v != null) { tag = +(100 * v).toFixed(3); tagFrom = 'data/tags.json (frozen release) ' + subject + '.' + tagPath.param + '.' + tagPath.name; }
    }
  }
  const listRow = (TARGETS.rows || []).find(r => r.family === 'proc' && r.subject === subject);
  /* `MILLIONRUN_SABOTAGE=staged-declaration` moves the list surface 25 points so the two disagree.
   * It exists to show the leak check red — a check nobody has seen fire is not a check — and it has
   * to defeat BOTH guards, exactly as the self-play arm `refusal` mode does: the cross-check refuses
   * the row AND the fixture stops marking it scored, so disabling one alone leaves the leak check
   * with nothing to find. See `declScorable`. */
  let list = listRow && typeof listRow.expect === 'number' ? +listRow.expect : null;
  if (SABOTAGE === 'staged-declaration' && list != null) list += 25;
  const agree = (tag != null && list != null) ? Math.abs(tag - list) < 0.51 : null;
  return {
    tag_pct: tag, tag_from: tagFrom,
    list_pct: list, list_from: listRow ? listRow.from : null,
    list_expect_raw: listRow ? listRow.expect : null,
    corroborated: agree,
    why: tag == null
      ? 'the FROZEN tag artifact carries no such param for ' + subject + ', so the engine has nothing '
        + 'to roll here. The row is tallied and NOT scored: a rate is the wrong question about a '
        + 'mechanic that is absent, and tests/roster.js owns absence.'
      : list == null
      ? 'no numeric row in data/million-targets.json corroborates this. million_targets.js derives the '
        + 'proc family from a HAND-TYPED list of twelve subjects (PROC_WHAT) and the ROADMAP #196 '
        + 'reclassification names seventeen, so this rate rests on the tag alone.'
      : agree ? 'the frozen tag and the format-derived target row agree'
              : 'THE TWO SURFACES DISAGREE — refused for scoring, exactly as the #132 gate refuses a '
                + '(move, effect) pair. Measuring a sampler against a declaration we have not settled '
                + 'is checking our code against our own mistake.',
  };
}

/* THE SECOND GUARD ON A REFUSED DECLARATION, AND IT IS SEPARATE FROM THE FIRST ON PURPOSE. A row
 * whose two surfaces disagree is refused HERE, at the point the fixture decides whether it is
 * scorable, and the leak check at the end asserts that no such row reached the tally anyway. Two
 * guards, so a drift between them is caught rather than agreed with — the same arrangement the
 * self-play arm has around PAIR_REFUSED. `staged-declaration` disables this one so the leak check has
 * something to find. */
function declScorable(decl) {
  if (SABOTAGE === 'staged-declaration') return decl.tag_pct != null;
  return decl.tag_pct != null && decl.corroborated !== false;
}

/* ---- BUILDING A BODY FOR A STAGED BOARD ---------------------------------------------------------
 * Not `buildPair`. That function is welded to the Showdown-side set it must also produce, and it
 * lives in `engine/game_differential.js`, whose module load BINDS THE PINNED DRIVER and builds a
 * swarm off the live store — both of which are exactly what this arm must not inherit (rule 2 of this
 * file header, and the photograph rule). What IS shared with it is the only part that matters: the
 * body comes from the frozen engine own `buildMon`, and nothing here re-implements a fact about the
 * game. Item, ability and moves are pinned afterwards, as buildPair pins them.
 *
 * `hpx` MULTIPLIES MAX HP, and it is the device `tests/roster.js` already uses (`hpBoost`). It is what
 * makes "the target survived the hit" true BY CONSTRUCTION rather than true on most rolls: a proc
 * trial lost to a KO is a trial removed from the denominator by the dice, which is the invented
 * denominator coming back in through the window. */
function stagedMon(speciesKey, ability, item, moves, opts) {
  const o = opts || {};
  const m = M.buildMon(speciesKey, { [speciesKey]: item || '' });
  if (!m) return null;
  if (ability) { m.ability = idOf(ability); m.baseAbility = idOf(ability); }
  if (moves && moves.length) m.moves = moves.map(idOf);
  if (o.hpx && o.hpx !== 1) { m.st.hp = Math.floor(m.st.hp * o.hpx); m.curHP = m.st.hp; }
  if (o.maxhp) { m.st.hp = o.maxhp; m.curHP = o.maxhp; }
  /* SPEED AND ATTACK ARE SET OUTRIGHT WHERE THE ORDER OR THE LETHALITY IS THE EXPERIMENT. Quick
   * Claw's whole claim is "20% of turns the holder moves first when it should have moved second"; a
   * fixture that only USUALLY wins the speed comparison has a denominator that depends on the very
   * roll it is trying to measure. */
  if (o.spe != null) m.st.sp = o.spe;
  if (o.atk != null) m.st.at = o.atk;
  if (o.hpFrac) m.curHP = Math.max(1, Math.floor(m.st.hp * o.hpFrac));
  if (o.status) m.status = o.status;
  /* A GENDER, BECAUSE A GENDERLESS BOARD IS NOT A NEUTRAL ONE — IT SILENCES TWO MECHANICS.
   *
   * (Will, 2026-08-11: *"well lets add gender into the battles and see cute charm proc"*.)
   *
   * The engine is RIGHT and this harness was wrong. `genderOf` is medicham2's one reader of the fact
   * and it returns 'N' for a body with no declared gender — which was every fixture in this repo. The
   * authority gates Cute Charm on `pokemon.gender === 'M' && source.gender === 'F'` (or the mirror)
   * and Rivalry on `attacker.gender && defender.gender`, so on a genderless board BOTH abilities
   * correctly do nothing. The rate runner then read Cute Charm as 0 fires in 4,166 trials and called
   * it ABSENT — an instrument reporting a mechanic missing when what was missing was the fixture.
   *
   * DECLARING A GENDER CANNOT DISTURB A MECHANIC THAT DOES NOT READ ONE, which is why this is a
   * default rather than an opt-in for two rows. Every other staged board is unchanged by construction.
   *
   * DERIVED FROM THE SPECIES' OWN RATIO, never typed: a body the format says is genderless stays 'N',
   * because forcing a gender onto one would be inventing a Pokemon this regulation does not contain. */
  m.gender = o.gender || speciesGender(speciesKey);
  return m;
}

/* The declared ratio, read off the format. `genderRatio` is {M, F}; `gender` is set outright for the
 * fixed ones ('N' for genderless, 'M'/'F' for the single-sex species). Ties break to 'F' so the value
 * is deterministic across runs — a fixture that changed sex between runs would put a wobble into
 * every gender-reading rate at once. */
function speciesGender(speciesKey) {
  try {
    const sp = FMT.D.species.get(speciesKey);
    if (!sp || !sp.exists) return 'N';
    if (sp.gender) return sp.gender;                        /* 'N', 'M' or 'F', declared outright */
    const r = sp.genderRatio;
    if (!r) return 'F';                                     /* the 50/50 default carries no ratio */
    return (r.M > r.F) ? 'M' : 'F';
  } catch (e) { return 'N'; }
}

/* ---- ONE TRIAL ---------------------------------------------------------------------------------- */
function stagedPlay(board, rng) {
  const trace = [];
  const S = M.battleInit(board.A, board.B, { trace });
  S.maxTurns = 8;
  if (board.after) board.after(S);
  for (const step of board.script) {
    if (M.battleOver(S)) break;
    const mk = (own, foes, acts) => {
      const map = new Map();
      own.forEach((mon, i) => {
        const w = acts[i]; if (!mon || mon.fainted) return;
        if (!w) { map.set(mon, { kind: 'pass' }); return; }
        map.set(mon, M.playerAction(mon, w.m, w.t != null ? (foes[w.t] || null) : null, S.field));
      });
      return map;
    };
    M.battleTurn(S, rng, mk(S.actA, S.actB, step.a), mk(S.actB, S.actA, step.b));
  }
  return { S, trace };
}

/* ---- THE FIXTURES -------------------------------------------------------------------------------
 * Every board below is derived. The only things typed anywhere in this block are the SHAPES of the
 * mechanics — "a contact ability needs a contact move", "Quick Claw needs the holder to be slower" —
 * which is what a fixture IS. No species, no ability, no move and no percentage is typed. */
function stagedFixtures(SD) {
  const D = SD.D;
  const SLOT = ['p1a', 'p1b', 'p2a', 'p2b'];
  const identOf = (S, side, i) => { const m = side === 1 ? S.actA[i] : S.actB[i]; return m ? ('p' + side + 'abcd'[i] + ': ' + (m._ident || m.name)) : null; };
  const moveLine = (trace, ident) => trace.findIndex(l => l.startsWith('|move|' + ident + '|'));
  const cantLine = (trace, ident, why) => trace.findIndex(l => l.startsWith('|cant|' + ident + '|' + why));
  const anyLine = (trace, ev, ident) => trace.findIndex(l => l.startsWith('|' + ev + '|' + ident + '|'));

  /* the second ability a species really has, quiet first then fewest handlers — the control-arm rule
   * tests/roster.js uses, and for its reason: whatever the control carries is present in both arms */
  const altAbility = (sp, exclude) => {
    const abs = [...new Set(Object.values(sp.abilities || {}).map(idOf))].filter(a => a !== idOf(exclude));
    if (!abs.length) return null;
    return abs.map(a => { const e = D.abilities.get(a);
      return { a, q: SD.QUIET.has(a) ? 1 : 0, n: Object.keys(e).filter(k => /^on/.test(k) && typeof e[k] === 'function').length }; })
      .sort((x, y) => (y.q - x.q) || (x.n - y.n))[0].a;
  };
  /* the weakest boring move the ATTACKER can learn that the TARGET is not type-immune to */
  const delivery = (attSp, tgtSp, wantContact) => {
    const ls = SD.learnsetOf(attSp);
    for (const m of (wantContact ? SD.CONTACT : SD.NOCONTACT)) {
      if (!ls[m.id]) continue;
      if (!D.getImmunity(m.type, tgtSp.types)) continue;
      return m;
    }
    return null;
  };
  /* THE ATTACKER POOL, DERIVED. A body that can carry a quiet ability, has a row in the engine's own
   * dex, is not itself immune to any of the statuses these procs inflict, and learns BOTH a boring
   * contact move and a boring non-contact one — the second is what makes the trigger-control arm
   * possible at all. */
  const STATUS_IMMUNE_TYPES = { par: 'Electric', brn: 'Fire', psn: 'Poison', slp: 'Grass', frz: 'Ice' };
  const ATTACKERS = D.species.all().filter(sp => {
    if (!SD.legalX(sp) || !SD.rowKey(sp)) return false;
    if ((sp.types || []).some(t => ['Electric', 'Fire', 'Poison', 'Steel', 'Ice', 'Grass'].includes(t))) return false;
    if (!Object.values(sp.abilities || {}).some(a => SD.QUIET.has(idOf(a)))) return false;
    const ls = SD.learnsetOf(sp);
    return SD.CONTACT.some(m => ls[m.id]) && SD.NOCONTACT.some(m => ls[m.id]);
  });
  const quietOf = (sp) => Object.values(sp.abilities || {}).map(idOf).find(a => SD.QUIET.has(a)) || altAbility(sp, '');
  /* TWO FILLER BODIES for the slots that are not the experiment, each clicking the weakest boring
   * move on its OWN learnset — the noise rule, honoured per body.
   *
   * THE FILLER POOL IS ITS OWN DERIVATION AND NOT `ATTACKERS.slice()`, WHICH IS THE FIRST THING THIS
   * ARM GOT WRONG. The attacker pool is narrow by design (a quiet ability, a safe typing, AND both a
   * contact and a non-contact boring move) — three bodies at this release. Drawing fillers from it
   * left one body for two slots on every fixture whose subject and target were both in the pool, so
   * `build` threw and SIX FIXTURES REPORTED ZERO TRIALS. Zero trials is the silent-failure shape this
   * whole file is about: it looks exactly like a mechanic nobody could reach. A filler needs far
   * less — a quiet ability, a body the engine can build, and one boring move it can learn. */
  const FILLERS = D.species.all().filter(sp => SD.legalX(sp) && SD.rowKey(sp)
    && Object.values(sp.abilities || {}).some(a => SD.QUIET.has(idOf(a)))
    && SD.weakestOwn(sp));
  const fillerPair = (used) => {
    const out = [];
    for (const sp of FILLERS) { if (used.has(sp.id)) continue; out.push(sp); used.add(sp.id); if (out.length === 2) break; }
    return out;
  };

  const F = [];
  const add = (fx) => { fx.idx = F.length; F.push(fx); return fx; };
  const cannot = (id, family, subject, kind, why) => add({ id, family, subject, kind, stageable: false, why_not: why });

  /* ============================================================================ CONTACT PUNISHERS */
  /* Static, Flame Body, Poison Point, Effect Spore, Cute Charm: `punishesAttacker` with
   * `trigger: 'contact'`. THE TRIGGER IS A CONTACT MOVE THAT CONNECTED AND DID NOT KILL, and that is
   * the whole reason these rows are not observable over self-play — the trace says the ability fired,
   * never that it was asked. */
  const contactPunisher = (subject, kindOfEffect) => {
    const cars = SD.carriers(subject);
    if (!cars.length) return cannot('proc:' + subject, 'proc', subject, 'ability',
      'no legal Reg M-B carrier of this ability has a row in the engine own dex (MC.mons), so no body '
      + 'can be built to carry it. Out of scope by construction, not untested.');
    const car = cars[0];
    const tagRow = (TAGS.abilities[subject] || {}).params || {};
    const pun = tagRow.punishesAttacker;
    const infl = pun && (kindOfEffect === 'volatile' ? (pun.inflictsVolatile ? [pun.inflictsVolatile] : []) : (pun.inflicts || []));
    if (!infl || !infl.length) return cannot('proc:' + subject, 'proc', subject, 'ability',
      'the FROZEN tag artifact carries no punishesAttacker effect for this ability, so the engine has '
      + 'nothing to roll. Absence is tests/roster.js question, not a rate.');
    const att = ATTACKERS.find(sp => sp.id !== car.id && delivery(sp, car, true) && delivery(sp, car, false));
    if (!att) return cannot('proc:' + subject, 'proc', subject, 'ability',
      'no derived attacker learns BOTH a boring contact move and a boring non-contact move that this '
      + 'carrier is not type-immune to — the trigger-control arm would be impossible, and an arm '
      + 'without its control is a denominator nobody has checked.');
    const hit = delivery(att, car, true), miss = delivery(att, car, false);
    const used = new Set([att.id, car.id]);
    const [f1, f2] = fillerPair(used);
    const pre = SD.PRE.check({ species: att.name, ability: quietOf(att), move: hit.name, target: car.name, targetAbility: subject });
    const total = infl.reduce((a, x) => a + (+x.chance || 0), 0);
    const decl = stagedDeclaration(subject, 'ability', {
      param: 'punishesAttacker', name: kindOfEffect === 'volatile' ? 'inflictsVolatile.chance' : 'sum of inflicts[].chance',
      pick: () => total });
    return add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'ability', carrier: car.name, stageable: true,
      detail: 'contact punisher', hasControl: true, scored: declScorable(decl),
      declared: decl.tag_pct, decl, preflight: pre,
      bands: kindOfEffect === 'volatile' ? null : infl.map(x => ({ name: x.status, declared: +(100 * x.chance).toFixed(3) })),
      boardText: att.name + ' (' + quietOf(att) + ', no item, max HP x4) clicks ' + hit.name + ' — a boring '
        + 'contact move, 100 accuracy, no secondary of its own — into ' + car.name + ' (' + subject
        + ', max HP x4). The two other slots click the weakest boring move on their own learnset at '
        + 'each other, never at the experiment.',
      controlText: 'the identical board with ' + hit.name + ' replaced by ' + miss.name + ' — same '
        + 'accuracy, same connection, NO CONTACT. The trigger is absent, so reached() must refuse '
        + 'every trial and the ability must not fire once.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which a contact move connected with the '
        + 'carrier, the carrier survived the hit, and the attacker was alive and eligible for the '
        + 'status (asked of the engine own canTakeStatus). Every one of those is true BY '
        + 'CONSTRUCTION and VERIFIED on the trial; nothing is inferred from what the trace happened '
        + 'to show.',
      build(mode) {
        const mv = mode === 'control' ? miss : hit;
        /* OPPOSITE GENDERS ON THE TWO EXPERIMENTAL BODIES, because for a gender-gated punisher a
         * SAME-gender pair is exactly as silent as a genderless one — and silent for a reason the
         * artifact could not distinguish from the ability being absent. Forced rather than drawn from
         * the two species' ratios: a Sylveon is male 7 times in 8, so leaving it to the declared
         * ratio would make the denominator depend on a coin the experiment is not measuring, and a
         * row would drift between runs for no reason a reader could see.
         *
         * NOT A CUTE CHARM BRANCH. It is set on every contact-punisher board, and a punisher that
         * reads no gender is unaffected — which is the whole reason this can be a default. The
         * SAME-gender arm belongs here too and is registered rather than built tonight: it is the
         * arm that separates "the roll fired" from "the gate was honoured". */
        const A = [stagedMon(SD.rowKey(att), quietOf(att), '', [mv.id], { hpx: 4, gender: 'M' }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 4 })];
        const B = [stagedMon(SD.rowKey(car), subject, '', [SD.weakestOwn(car)], { hpx: 4, gender: 'F' }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 4 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, contact: mode !== 'control',
          script: [{ a: [{ m: mv.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(car), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      /* THE NUMERATOR IS "THE ATTACKER ACQUIRED A STATUS IT DID NOT HAVE", AND IT IS DELIBERATELY
       * NOT "THE ATTACKER ACQUIRED THE STATUS THE TAG NAMES".
       *
       * THE FIRST VERSION MATCHED THE TAG'S WORD AGAINST THE ENGINE'S AND READ FLAME BODY AND POISON
       * POINT AT 0 OF 40 — a headline somebody would have filed against the engine. The tag artifact
       * speaks Showdown's vocabulary ("burn", "poison", "sleep") and this engine speaks its own
       * ("brn", "psn", "slp"); medicham2 translates at the roll site with `CODE_OF_STATUS`, whose own
       * comment says it is "naming conventions, not mechanics". Static passed by pure accident:
       * "paralysis" and "par" share three letters and nothing else in that map does.
       *
       * THE FIX IS NOT A SECOND COPY OF `CODE_OF_STATUS`. That map is not exported, and writing one
       * here would be the FACTS-ARE-GLOBAL breach CLAUDE.md names — two implementations of one fact,
       * drifting invisibly because both keep working. The board answers the question without it: the
       * attacker starts clean by construction and every other click on the board is a boring move
       * with no status, no secondary and no boost, so ANY status it ends the turn holding came from
       * the punisher. The per-status split is reported DESCRIPTIVELY, keyed by the engine's own code,
       * and is not scored against the tag's bands for exactly the reason above.
       *
       * FILED TO ENGINE, one line: export `CODE_OF_STATUS`. With it this arm scores Effect Spore's
       * 11/10/9 ladder band by band instead of only in total, and the ladder is the case where the
       * total can agree while the branches are wrong. */
      read(S, trace, board) {
        const A0 = S.actA[0], B0 = S.actB[0];
        const fired = kindOfEffect === 'volatile'
          ? !!(A0._vol && Object.keys(A0._vol).length > 0)
          : !!A0.status;
        const band = (kindOfEffect === 'volatile' || !A0.status) ? null : String(A0.status);
        if (!board.contact) return { reached: false, why: 'the delivery move makes no contact, so the contact trigger was never reached', fired };
        if (B0.curHP >= B0.st.hp) return { reached: false, why: 'the hit did not connect with the carrier', fired };
        if (B0.fainted) return { reached: false, why: 'the carrier fainted to the hit', fired };
        if (A0.fainted) return { reached: false, why: 'the attacker did not survive the turn', fired };
        return { reached: true, fired, band };
      },
    });
  };
  contactPunisher('static', 'status');
  contactPunisher('flamebody', 'status');
  contactPunisher('poisonpoint', 'status');
  contactPunisher('effectspore', 'status');
  contactPunisher('cutecharm', 'volatile');

  /* ================================================================================= CURSED BODY */
  (() => {
    const subject = 'cursedbody';
    const cars = SD.carriers(subject);
    if (!cars.length) return cannot('proc:' + subject, 'proc', subject, 'ability', 'no legal carrier with a row in the engine own dex');
    const car = cars[0];
    const att = ATTACKERS.find(sp => sp.id !== car.id && delivery(sp, car, true));
    if (!att) return cannot('proc:' + subject, 'proc', subject, 'ability', 'no derived attacker learns a boring move this carrier is not immune to');
    const hit = delivery(att, car, true);
    const used = new Set([att.id, car.id]); const [f1, f2] = fillerPair(used);
    const decl = stagedDeclaration(subject, 'ability', { param: 'disablesAttacker', name: 'chance', pick: p => p.chance });
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'ability', carrier: car.name, stageable: true,
      detail: 'disables the move that hit it', hasControl: true,
      scored: declScorable(decl), declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: att.name, ability: quietOf(att), move: hit.name, target: car.name, targetAbility: subject }),
      boardText: att.name + ' clicks ' + hit.name + ' into ' + car.name + ' (' + subject + ', max HP x4).',
      controlText: 'the identical board with the attacker PASSING. No hit lands, so the trigger is '
        + 'absent — the tag trigger for this one is anyHit rather than contact, so removing the '
        + 'CONTACT would not remove the trigger and would prove nothing.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which a damaging hit connected with the '
        + 'carrier, the carrier survived it, and the attacker was alive and not already disabled.',
      build(mode) {
        const A = [stagedMon(SD.rowKey(att), quietOf(att), '', [hit.id], { hpx: 4 }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 4 })];
        const B = [stagedMon(SD.rowKey(car), subject, '', [SD.weakestOwn(car)], { hpx: 4 }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 4 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, hits: mode !== 'control',
          script: [{ a: [mode === 'control' ? null : { m: hit.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(car), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const A0 = S.actA[0], B0 = S.actB[0];
        const fired = !!(A0._vol && A0._vol.disable > 0) || !!A0._sealed;
        if (!board.hits) return { reached: false, why: 'the attacker passed, so no hit landed and the trigger was never reached', fired };
        if (B0.curHP >= B0.st.hp) return { reached: false, why: 'the hit did not connect with the carrier', fired };
        if (B0.fainted) return { reached: false, why: 'the carrier fainted to the hit', fired };
        if (A0.fainted) return { reached: false, why: 'the attacker did not survive the turn', fired };
        return { reached: true, fired };
      },
    });
  })();

  /* ================================================================================ POISON TOUCH */
  (() => {
    const subject = 'poisontouch';
    const cars = SD.carriers(subject);
    if (!cars.length) return cannot('proc:' + subject, 'proc', subject, 'ability', 'no legal carrier with a row in the engine own dex');
    /* the SUBJECT is the attacker here, so the carrier needs the contact move and the TARGET needs to
     * be poisonable — derived, never assumed */
    const tgt = ATTACKERS.find(sp => !(sp.types || []).some(t => ['Poison', 'Steel'].includes(t)));
    const car = cars.find(c => delivery(c, tgt, true) && delivery(c, tgt, false));
    if (!car || !tgt) return cannot('proc:' + subject, 'proc', subject, 'ability',
      'no carrier learns both a boring contact move and a boring non-contact move into a poisonable derived target');
    const hit = delivery(car, tgt, true), miss = delivery(car, tgt, false);
    const used = new Set([car.id, tgt.id]); const [f1, f2] = fillerPair(used);
    const decl = stagedDeclaration(subject, 'ability', { param: 'poisonsOnMyContact', name: 'p', pick: p => p.p });
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'ability', carrier: car.name, stageable: true,
      detail: 'poisons what it touches', hasControl: true,
      scored: declScorable(decl), declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: car.name, ability: subject, move: hit.name, target: tgt.name }),
      boardText: car.name + ' (' + subject + ') clicks ' + hit.name + ' into ' + tgt.name + ' (max HP x4), which no type or ability refuses poison for.',
      controlText: 'the identical board with ' + hit.name + ' replaced by the non-contact ' + miss.name + '.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the carrier own contact move '
        + 'connected, the target survived it, and the target was eligible for poison.',
      build(mode) {
        const mv = mode === 'control' ? miss : hit;
        const A = [stagedMon(SD.rowKey(car), subject, '', [mv.id], { hpx: 4 }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 4 })];
        const B = [stagedMon(SD.rowKey(tgt), quietOf(tgt), '', [SD.weakestOwn(tgt)], { hpx: 4 }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 4 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, contact: mode !== 'control',
          script: [{ a: [{ m: mv.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(tgt), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const A0 = S.actA[0], B0 = S.actB[0];
        const fired = String(B0.status || '').slice(0, 3) === 'psn' || String(B0.status || '') === 'tox';
        if (!board.contact) return { reached: false, why: 'the delivery move makes no contact, so the contact trigger was never reached', fired };
        if (B0.curHP >= B0.st.hp) return { reached: false, why: 'the hit did not connect with the target', fired };
        if (B0.fainted) return { reached: false, why: 'the target fainted to the hit', fired };
        return { reached: true, fired };
      },
    });
  })();

  /* =============================================================== THE FLINCH ADDERS: STENCH, KING'S ROCK
   * The trigger is a damaging hit on a body that HAS NOT YET ACTED. Speed is set outright so that is
   * true by construction rather than true on most rolls, and the control arm inverts exactly that. */
  const flinchAdder = (subject, kind, tagParam, pickChance) => {
    const cars = kind === 'item' ? [null] : SD.carriers(subject);
    if (!cars.length) return cannot('proc:' + subject, 'proc', subject, kind, 'no legal carrier with a row in the engine own dex');
    const holderSp = kind === 'item' ? ATTACKERS[0] : cars[0];
    const tgtSp = ATTACKERS.find(sp => sp.id !== holderSp.id);
    const hit = delivery(holderSp, tgtSp, true) || delivery(holderSp, tgtSp, false);
    if (!hit) return cannot('proc:' + subject, 'proc', subject, kind, 'the derived holder learns no boring move the derived target can be hit by');
    const used = new Set([holderSp.id, tgtSp.id]); const [f1, f2] = fillerPair(used);
    const decl = stagedDeclaration(subject, kind, { param: tagParam, name: 'the flinch chance', pick: pickChance });
    const holderAb = kind === 'item' ? quietOf(holderSp) : subject;
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind, carrier: holderSp.name, stageable: true,
      detail: 'adds a flinch to its own damaging move', hasControl: true,
      scored: declScorable(decl), declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: holderSp.name, ability: holderAb, item: kind === 'item' ? subject : null, move: hit.name, target: tgtSp.name }),
      boardText: holderSp.name + (kind === 'item' ? ' holding ' + subject : ' (' + subject + ')')
        + ' has its Speed SET to 400 and the target ' + tgtSp.name + ' to 1, so the holder moves first by '
        + 'construction, and clicks ' + hit.name + ' — a move with no secondary of its own.',
      controlText: 'the identical board with the two Speeds SWAPPED, so the target has already acted '
        + 'when the hit lands. A flinch set on a body that has already moved costs nothing and is not '
        + 'observable, so the trigger is genuinely absent — this is the same exclusion the self-play '
        + 'arm has to make from the trace, made true by construction instead.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the holder moved FIRST (verified '
        + 'from the trace), its damaging move connected, and the target was alive, had an action '
        + 'this turn and does not refuse the flinch volatile.',
      build(mode) {
        const fast = mode === 'control' ? 1 : 400, slow = mode === 'control' ? 400 : 1;
        const A = [stagedMon(SD.rowKey(holderSp), holderAb, kind === 'item' ? subject : '', [hit.id], { hpx: 4, spe: fast }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 4, spe: 200 })];
        const B = [stagedMon(SD.rowKey(tgtSp), quietOf(tgtSp), '', [SD.weakestOwn(tgtSp)], { hpx: 4, spe: slow }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 4, spe: 200 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, holderFirst: mode !== 'control',
          script: [{ a: [{ m: hit.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(tgtSp), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const A0 = S.actA[0], B0 = S.actB[0];
        const idA = 'p1a: ' + (A0._ident || A0.name), idB = 'p2a: ' + (B0._ident || B0.name);
        const fired = cantLine(trace, idB, 'flinch') >= 0;
        const mvA = moveLine(trace, idA), mvB = moveLine(trace, idB);
        if (B0.curHP >= B0.st.hp) return { reached: false, why: 'the hit did not connect with the target', fired };
        if (B0.fainted) return { reached: false, why: 'the target fainted to the hit', fired };
        if (mvA < 0) return { reached: false, why: 'the holder never took its action', fired };
        if (!board.holderFirst) return { reached: false, why: 'the target had ALREADY acted when the hit landed, so a flinch could not be observed — the trigger was never reached', fired };
        if (mvB >= 0 && mvB < mvA) return { reached: false, why: 'the target acted before the hit landed', fired };
        if (FLINCH_REFUSERS.has(idOf(B0.ability))) return { reached: false, why: 'the target refuses the flinch volatile', fired };
        return { reached: true, fired };
      },
    });
  };
  flinchAdder('stench', 'ability', 'addsOwnSecondary', p => p.chance);
  flinchAdder('kingsrock', 'item', 'addsFlinch', p => p.pFlinch);

  /* ========================================================= THE PRIORITY JUMPERS: QUICK CLAW, QUICK DRAW */
  const priorityJumper = (subject, kind) => {
    let holderSp = ATTACKERS[0];
    if (kind === 'ability') {
      const cars = SD.carriers(subject);
      const anyLegal = D.species.all().filter(sp => SD.legalX(sp) && Object.values(sp.abilities || {}).map(idOf).includes(subject));
      if (!cars.length) return cannot('proc:' + subject, 'proc', subject, kind,
        'the format has ' + anyLegal.length + ' legal carrier(s) of this ability — '
        + anyLegal.map(s => s.name).join(', ') + ' — and NONE has a row in the engine own dex '
        + '(MC.mons), so no body can be built to carry it. The row is out of scope by construction '
        + 'rather than untested, and a zero here would have been a claim about this file.');
      /* THE ABILITY GOES ON ITS OWN CARRIER, WHICH THE FIRST VERSION OF THIS FUNCTION FORGOT — it
       * handed the ability id to `stagedMon` in the ITEM slot on the generic attacker, so Quick Draw
       * was staged as an imaginary held item on a body that does not have the ability, and would have
       * read 0 for a reason that was entirely this file's. */
      holderSp = cars[0];
    }
    const foeSp = ATTACKERS.find(sp => sp.id !== holderSp.id);
    const hit = delivery(holderSp, foeSp, true) || delivery(holderSp, foeSp, false);
    const back = delivery(foeSp, holderSp, true) || delivery(foeSp, holderSp, false);
    if (!hit || !back) return cannot('proc:' + subject, 'proc', subject, kind, 'no boring move connects the two derived bodies');
    const used = new Set([holderSp.id, foeSp.id]); const [f1, f2] = fillerPair(used);
    const decl = stagedDeclaration(subject, kind, { param: 'fractionalPriority', name: 'chance', pick: p => p.chance });
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind, carrier: holderSp.name, stageable: true,
      detail: 'moves first out of its bracket', hasControl: true, controlKind: 'mechanism-removed',
      scored: declScorable(decl), declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: holderSp.name, ability: kind === 'ability' ? subject : quietOf(holderSp), item: kind === 'item' ? subject : null, move: hit.name, target: foeSp.name }),
      boardText: holderSp.name + (kind === 'item' ? ' holding ' : ' carrying ') + subject + ' has its Speed SET to 1 and the foe '
        + foeSp.name + ' to 400. Both click a 0-priority damaging move, so the holder moves second on '
        + 'every turn the item does not fire, with no speed tie anywhere near it.',
      controlText: 'the identical board, the holder still STRICTLY SLOWER, and the ' + subject
        + ' taken away. The trigger is fully present — this is the mechanism-removed shape — so the '
        + 'trials must be there and the numerator must be exactly ZERO. Removing the trigger instead '
        + 'would mean making the holder faster, and then "moved first" is true by construction and '
        + 'the observable stops meaning anything.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the holder was STRICTLY SLOWER than '
        + 'the foe (set outright, not hoped for), both bodies were alive, and both clicked a move in '
        + 'the same priority bracket. Moving first can then only be the item.',
      build(mode) {
        const mine = 1, theirs = 400;
        const A = [stagedMon(SD.rowKey(holderSp),
                     kind === 'ability' ? (mode === 'control' ? (altAbility(holderSp, subject) || '') : subject) : quietOf(holderSp),
                     (kind === 'item' && mode !== 'control') ? subject : '', [hit.id], { hpx: 8, spe: mine }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 8, spe: 200 })];
        const B = [stagedMon(SD.rowKey(foeSp), quietOf(foeSp), '', [back.id], { hpx: 8, spe: theirs }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 8, spe: 200 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, slower: true,
          script: [{ a: [{ m: hit.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: back.id, t: 0 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const A0 = S.actA[0], B0 = S.actB[0];
        const idA = 'p1a: ' + (A0._ident || A0.name), idB = 'p2a: ' + (B0._ident || B0.name);
        const mvA = moveLine(trace, idA), mvB = moveLine(trace, idB);
        const fired = mvA >= 0 && mvB >= 0 && mvA < mvB;
        if (mvA < 0 || mvB < 0) return { reached: false, why: 'one of the two bodies never took its action', fired };
        if (A0.st.sp >= B0.st.sp) return { reached: false, why: 'the holder was not strictly slower, so moving first is not attributable to the subject and the trigger was never reached', fired };
        return { reached: true, fired };
      },
    });
  };
  priorityJumper('quickclaw', 'item');
  priorityJumper('quickdraw', 'ability');

  /* ================================================================================== FOCUS BAND */
  (() => {
    const subject = 'focusband';
    const attSp = ATTACKERS[0], tgtSp = ATTACKERS.find(sp => sp.id !== ATTACKERS[0].id);
    const hit = delivery(attSp, tgtSp, true) || delivery(attSp, tgtSp, false);
    if (!hit) return cannot('proc:' + subject, 'proc', subject, 'item', 'no boring move connects the two derived bodies');
    const used = new Set([attSp.id, tgtSp.id]); const [f1, f2] = fillerPair(used);
    /* THE ROW WAS TALLIED AND NOT SCORED BECAUSE THIS ARGUMENT WAS null, AND THE CAPTION IT PRINTED
     * SAID "the FROZEN tag artifact carries no such param" — TRUE WHEN IT WAS WRITTEN AND A LIE THE
     * MOMENT #216 LANDED. `stagedDeclaration` needs a path (`if (row && row.params && tagPath)`), so a
     * null one is indistinguishable from a genuinely absent param. Reading `survivesFromFull.chance`
     * out of the frozen artifact corroborates the 10 against `million-targets.json`'s independent
     * `DERIVED:randomChance(1,10)` — two surfaces, one number, which is what makes the row scorable
     * rather than merely counted. */
    const decl = stagedDeclaration(subject, 'item',
      { param: 'survivesFromFull', name: 'chance', pick: p => p.chance });
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'item', carrier: tgtSp.name, stageable: true,
      detail: 'survives a lethal hit on 1 HP', hasControl: true,
      scored: decl.tag_pct != null, declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: attSp.name, ability: quietOf(attSp), item: subject, move: hit.name, target: tgtSp.name }),
      boardText: tgtSp.name + ' holds ' + subject + ' with its max HP SET to 20 while ' + attSp.name
        + ' has its Attack SET to 400 and clicks ' + hit.name + ', so the hit is lethal several times '
        + 'over on every roll and at every crit state.',
      controlText: 'the identical board with the holder max HP left at x8, so the hit cannot be '
        + 'lethal. The trigger — a hit that would otherwise have killed — is genuinely absent.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the incoming hit WAS LETHAL, '
        + 'verified as the holder either fainting or standing on exactly 1 HP. A hit that left it on '
        + 'anything else was not lethal and is refused.',
      build(mode) {
        const A = [stagedMon(SD.rowKey(attSp), quietOf(attSp), '', [hit.id], { hpx: 8, atk: 400, spe: 400 }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 8, spe: 200 })];
        const B = [stagedMon(SD.rowKey(tgtSp), quietOf(tgtSp), subject, [SD.weakestOwn(tgtSp)],
                     mode === 'control' ? { hpx: 8, spe: 1 } : { maxhp: 20, spe: 1 }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 8, spe: 200 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, lethal: mode !== 'control',
          script: [{ a: [{ m: hit.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(tgtSp), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const B0 = S.actB[0];
        const fired = !B0.fainted && B0.curHP === 1;
        if (!board.lethal) return { reached: false, why: 'the hit was not lethal, so the trigger was never reached', fired };
        if (!B0.fainted && B0.curHP !== 1) return { reached: false, why: 'the hit did not kill and did not leave 1 HP, so it was not the lethal hit this fixture claims to stage', fired };
        return { reached: true, fired };
      },
    });
  })();

  /* ======================================================= THE RESIDUAL CURERS: SHED SKIN, HEALER */
  const residualCurer = (subject, scope) => {
    const cars = SD.carriers(subject);
    if (!cars.length) return cannot('proc:' + subject, 'proc', subject, 'ability', 'no legal carrier with a row in the engine own dex');
    /* NO SECOND ABILITY IS NEEDED HERE, and requiring one was a real fixture fault: it retired
     * Healer entirely because the bulkiest carrier the engine can build is a mega forme with exactly
     * one ability. The control arm for a residual curer is the TRIGGER REMOVAL — a board with nobody
     * statused — which is a stronger control than an ability swap and needs no alternative at all. */
    const car = cars[0];
    const used = new Set([car.id]); const [f1, f2] = fillerPair(used);
    const ally = f2;
    const decl = stagedDeclaration(subject, 'ability', { param: 'curesStatusResidual', name: 'chance', pick: p => p.chance });
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'ability', carrier: car.name, stageable: true,
      detail: scope === 'self' ? 'cures its own status at the residual' : 'cures an ally status at the residual',
      hasControl: true, scored: declScorable(decl), declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: car.name, ability: subject }),
      boardText: car.name + ' (' + subject + ') stands beside ' + ally.name + '. The body that must be '
        + 'cured is PARALYSED on the pre-turn board — paralysis is used because it carries no counter, '
        + 'so setting it is the same state the engine would have written. Nothing attacks either of '
        + 'them; every other body clicks its weakest boring move at the far slot.',
      controlText: 'the identical board with NOBODY paralysed. There is no status to cure, so the '
        + 'residual trigger is absent and reached() must refuse every trial.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the body that must be cured carried '
        + 'a major status when the turn opened and was still alive at the residual.',
      build(mode) {
        const sick = mode === 'control' ? null : 'par';
        const A = [stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 8, spe: 200 }),
                   stagedMon(SD.rowKey(ally), quietOf(ally), '', [SD.weakestOwn(ally)], { hpx: 8, spe: 200 })];
        const B = [stagedMon(SD.rowKey(car), subject, '', [SD.weakestOwn(car)], { hpx: 8, status: scope === 'self' ? sick : null }),
                   stagedMon(SD.rowKey(ally), quietOf(ally), '', [SD.weakestOwn(ally)], { hpx: 8, status: scope === 'self' ? null : sick })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, sick: !!sick, who: scope === 'self' ? 0 : 1,
          script: [{ a: [{ m: SD.weakestOwn(f1), t: 0 }, { m: SD.weakestOwn(ally), t: 0 }],
                     b: [{ m: SD.weakestOwn(car), t: 0 }, { m: SD.weakestOwn(ally), t: 0 }] }] };
      },
      read(S, trace, board) {
        const who = S.actB[board.who], car0 = S.actB[0];
        const fired = !!board.sick && !who.status;
        if (!board.sick) return { reached: false, why: 'nobody carried a status, so the residual cure had nothing to act on and the trigger was never reached', fired: !!who.status ? false : false };
        if (who.fainted || car0.fainted) return { reached: false, why: 'a body did not survive to the residual', fired };
        return { reached: true, fired };
      },
    });
  };
  residualCurer('shedskin', 'self');
  residualCurer('healer', 'ally');

  /* ===================================================================================== HARVEST */
  (() => {
    const subject = 'harvest';
    const cars = SD.carriers(subject);
    if (!cars.length) return cannot('proc:' + subject, 'proc', subject, 'ability', 'no legal carrier with a row in the engine own dex');
    const car = cars[0];
    const berry = D.items.get('sitrusberry');
    if (!SD.legalX(berry)) return cannot('proc:' + subject, 'proc', subject, 'ability', 'the derived berry is not legal in this format');
    /* CONTACT IS FINE FOR THIS ONE and insisting on a non-contact chipper retired the row: the
     * carrier is Ghost, so every derived non-contact boring move is Normal and does nothing to it.
     * Harvest reacts to a berry being eaten, not to being touched, so the contact flag is not part of
     * this experiment. */
    const attSp = ATTACKERS.find(sp => sp.id !== car.id && (delivery(sp, car, false) || delivery(sp, car, true)));
    if (!attSp) return cannot('proc:' + subject, 'proc', subject, 'ability', 'no derived attacker can chip this carrier at all');
    const hit = delivery(attSp, car, false) || delivery(attSp, car, true);
    const used = new Set([car.id, attSp.id]); const [f1, f2] = fillerPair(used);
    const decl = stagedDeclaration(subject, 'ability', { param: 'restoresBerryAtResidual', name: 'chance', pick: p => p.chance });
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'ability', carrier: car.name, stageable: true,
      detail: 'restores the berry it ate', hasControl: true,
      scored: declScorable(decl), declared: decl.tag_pct, decl,
      preflight: SD.PRE.check({ species: car.name, ability: subject, item: 'Sitrus Berry' }),
      boardText: car.name + ' (' + subject + ') holds a Sitrus Berry and opens the turn on 52% of its '
        + 'max HP; ' + attSp.name + ' chips it below half with ' + hit.name + ', so the berry is eaten '
        + 'inside the turn and the residual has something to restore.',
      controlText: 'the identical board with the carrier at FULL HP, so the berry is never eaten and '
        + 'there is nothing to restore — the trigger is absent.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the berry was ACTUALLY EATEN this '
        + 'turn (the engine own _ateBerry, which it sets at the consumption site) and the carrier was '
        + 'alive at the residual.',
      build(mode) {
        const A = [stagedMon(SD.rowKey(attSp), quietOf(attSp), '', [hit.id], { hpx: 8, spe: 400 }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 8, spe: 200 })];
        /* THE CONTROL NEEDS A HP POOL THE CHIP CANNOT CROSS, not merely "full HP". At the carrier own
         * max the 60-BP chipper takes it under half on its own, so nine control trials ATE THE BERRY
         * and eight of them restored it — a control arm reporting the mechanic it exists to rule out.
         * x8 puts the half-HP line out of one hit's reach. */
        /* x2 ON THE SUBJECT ARM TOO, AND IT IS NOT COSMETIC: at the carrier's own max HP a CRIT on the
         * chipper KILLED it from 52%, so the berry never ate and 825 attempts in 20,445 (4.0%) were
         * refused — over the 2% construction tolerance, which correctly dropped the row from the
         * scored set. Doubling the pool keeps the chip comfortably across the half-HP line and puts a
         * critical hit comfortably short of lethal. */
        const B = [stagedMon(SD.rowKey(car), subject, 'sitrusberry', [SD.weakestOwn(car)],
                     mode === 'control' ? { hpx: 8, spe: 1 } : { hpx: 2, hpFrac: 0.52, spe: 1 }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 8, spe: 200 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, chipped: mode !== 'control',
          script: [{ a: [{ m: hit.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(car), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const B0 = S.actB[0];
        const fired = idOf(B0.item) === 'sitrusberry' && !!B0._ateBerry;
        if (!B0._ateBerry) return { reached: false, why: 'the berry was never eaten this turn, so the residual had nothing to restore', fired: false };
        if (B0.fainted) return { reached: false, why: 'the carrier did not survive to the residual', fired };
        return { reached: true, fired };
      },
    });
  })();

  /* ============================================== THE STATUS-CURING BERRIES: ASPEAR, RAWST
   * These are CERTAINTIES, not dice, and they are here for the reason ROADMAP #196 puts them here:
   * the roster cannot LAND the status under a pinned die, so the trigger is unreachable over there.
   * With the dice free the status lands on its own and the cure is then a 100% claim — which this
   * arm scores, using the engine own rule that an effect with no chance field is a certainty. */
  const cureBerry = (subject) => {
    const it = D.items.get(subject);
    const tagRow = (TAGS.items[subject] || {}).params || {};
    const cs = tagRow.curesStatus;
    if (!SD.legalX(it) || !cs || !Array.isArray(cs.statuses) || !cs.statuses.length)
      return cannot('proc:' + subject, 'proc', subject, 'item', 'the frozen tag artifact declares no curesStatus for this berry');
    const st = idOf(cs.statuses[0]);
    /* the delivery: any legal move that inflicts this status, learnable by a body the engine can
     * build. Derived off the move own status/secondary rather than named. */
    const inflicters = D.moves.all().filter(m => SD.legalX(m) && (m.status === st || (m.secondaries || []).some(s => s && s.status === st) || (m.secondary && m.secondary.status === st)));
    let attSp = null, mv = null;
    for (const cand of inflicters) {
      const sp = ATTACKERS.find(s => SD.learnsetOf(s)[cand.id]);
      if (sp) { attSp = sp; mv = cand; break; }
    }
    if (!attSp) return cannot('proc:' + subject, 'proc', subject, 'item',
      'no derived attacker learns a legal move that inflicts ' + st + ', so the trigger cannot be reached');
    const tgtSp = ATTACKERS.find(sp => sp.id !== attSp.id
      && !(sp.types || []).includes(STATUS_IMMUNE_TYPES[st] || '__none__'));
    if (!tgtSp) return cannot('proc:' + subject, 'proc', subject, 'item', 'no derived target can receive ' + st);
    const used = new Set([attSp.id, tgtSp.id]); const [f1, f2] = fillerPair(used);
    const listRow = (TARGETS.rows || []).find(r => r.family === 'proc' && r.subject === subject);
    const decl = { tag_pct: 100,
      tag_from: 'data/tags.json (frozen release) ' + subject + '.curesStatus — the tag declares WHICH '
        + 'statuses it cures and NO chance field. The engine own secondary loop reads an absent '
        + 'chance as 100 (`s.chance == null ? 100 : s.chance`), so a certainty is what the engine '
        + 'rolls with here. Nothing is typed.',
      list_pct: listRow && typeof listRow.expect === 'number' ? +listRow.expect : null,
      list_from: listRow ? listRow.from : null, list_expect_raw: listRow ? listRow.expect : null,
      corroborated: null,
      why: 'a CERTAINTY rather than a die. It is in this instrument because the trigger — the status '
        + 'actually landing — cannot be reached under the roster pinned dice, not because the rate is '
        + 'in doubt. data/million-targets.json has no row for it (PROC_WHAT is a hand-typed list of twelve).' };
    add({
      id: 'proc:' + subject, family: 'proc', subject, kind: 'item', carrier: tgtSp.name, stageable: true,
      detail: 'cures ' + st + ' the moment it lands', hasControl: true, controlKind: 'mechanism-removed',
      scored: true, declared: 100, decl,
      preflight: SD.PRE.check({ species: attSp.name, ability: quietOf(attSp), item: subject, move: mv.name, target: tgtSp.name }),
      boardText: attSp.name + ' clicks ' + mv.name + ' at ' + tgtSp.name + ', which holds ' + subject
        + '. The dice are free, so the status lands at its own rate; only the trials where it actually '
        + 'landed are in the denominator.',
      controlText: 'the identical board with the target holding NOTHING. This is the '
        + 'mechanism-removed shape: the trigger — the status landing — is still fully present, so '
        + 'the trials must be there and the numerator must be ZERO.',
      denominator: 'ONE TRIAL = ONE FRESHLY BUILT BOARD on which the trace shows the status ACTUALLY '
        + 'LANDING on the holder this turn. That is an independent observation of the trigger — not '
        + 'the berry own consumption, which would make the test circular.',
      build(mode) {
        const A = [stagedMon(SD.rowKey(attSp), quietOf(attSp), '', [mv.id], { hpx: 8, spe: 400 }),
                   stagedMon(SD.rowKey(f1), quietOf(f1), '', [SD.weakestOwn(f1)], { hpx: 8, spe: 200 })];
        const B = [stagedMon(SD.rowKey(tgtSp), quietOf(tgtSp), mode === 'control' ? '' : subject, [SD.weakestOwn(tgtSp)], { hpx: 8, spe: 1 }),
                   stagedMon(SD.rowKey(f2), quietOf(f2), '', [SD.weakestOwn(f2)], { hpx: 8, spe: 200 })];
        if (A.some(x => !x) || B.some(x => !x)) return null;
        return { A, B, held: mode !== 'control',
          script: [{ a: [{ m: mv.id, t: 0 }, { m: SD.weakestOwn(f1), t: 1 }],
                     b: [{ m: SD.weakestOwn(tgtSp), t: 1 }, { m: SD.weakestOwn(f2), t: 1 }] }] };
      },
      read(S, trace, board) {
        const B0 = S.actB[0];
        const idB = 'p2a: ' + (B0._ident || B0.name);
        const landed = trace.some(l => l.startsWith('|-status|' + idB + '|') && idOf(l.split('|')[3] || '').slice(0, 3) === st.slice(0, 3));
        /* THE BERRY MUST BE THE THING THAT CURED IT. `!status` alone is not the numerator: a freeze
         * thaws on its own at 25% per attempt, and the control arm caught exactly that — two trials
         * where the status was gone and no berry had been anywhere near them. Requiring the berry to
         * have been SPENT (_lastItem, which the engine writes at its own consumption site) separates
         * the two. `landed` stays the independent trigger observation, so the test is not circular. */
        const fired = landed && !B0.status && idOf(B0._lastItem || '') === subject;
        if (!landed) return { reached: false, byDesign: true, why: 'the status never landed this turn, so the berry was never asked', fired: false };
        if (B0.fainted) return { reached: false, why: 'the holder did not survive the turn', fired };
        return { reached: true, fired };
      },
    });
  };
  cureBerry('rawstberry');
  cureBerry('aspearberry');

  return F;
}

/* ---- HOW MANY TRIALS ONE ROW NEEDS -------------------------------------------------------------
 *
 * A ONE-SAMPLE test of an observed proportion against a DECLARED one — which is exactly what every
 * row here is. Two-sided alpha 0.05, power 0.8:
 *
 *     n = ( z(a/2)*sqrt(p0(1-p0)) + z(b)*sqrt(p1(1-p1)) )^2 / (p1-p0)^2
 *
 * BOTH ALTERNATIVES ARE COMPUTED AND THE LARGER IS TAKEN, and that is deliberately more conservative
 * than a one-directional figure. It matters at the extremes and nowhere else: at a declared 95%, the
 * upward alternative is 100% (variance zero) and needs 73 trials, while the downward one is 90% and
 * needs 185. A rate can be wrong in either direction, so the row is not powered until it can catch
 * the harder one. At 10/20/30/50/70% the two directions agree with the one-directional table to the
 * trial (316 / 528 / 676 / 783 / 638 at five points).
 *
 * `zFor` is this file's own inverse normal, already used for the Bonferroni column — one
 * implementation, not a second table of critical values. */
function requiredTrials(declaredPct, delta) {
  const p0 = declaredPct / 100;
  if (!(p0 >= 0 && p0 <= 1) || !(delta > 0)) return null;
  const za = zFor(0.05), zb = zFor(2 * (1 - 0.8));   /* one-sided z for 80% power = 0.8416 */
  let need = 0;
  for (const p1 of [Math.min(1, p0 + delta), Math.max(0, p0 - delta)]) {
    const d = p1 - p0;
    if (!d) continue;
    const n = Math.pow(za * Math.sqrt(p0 * (1 - p0)) + zb * Math.sqrt(p1 * (1 - p1)), 2) / (d * d);
    need = Math.max(need, Math.ceil(n));
  }
  return need || null;
}

/* ---- THE ARM ------------------------------------------------------------------------------------ */
function stagedArm(gate) {
  const SD = stagedDex();
  const SZ95 = 1.959963985;
  const t0s = Date.now();
  const FIX = stagedFixtures(SD);
  const staged = [];          // one entry per fixture, whatever happened to it
  const rows = [];            // scoreRows-shaped rows for the SUBJECT arm
  const controlRows = [];
  const pinRows = { high: [], low: [] };
  let battlesPlayed = 0;      // every board this arm builds and plays, across every arm

  console.log('\n  STAGED ARM (ROADMAP #196) — constructed boards, free dice, denominator by construction');
  console.log('    ' + FIX.length + ' fixtures, ' + FIX.filter(f => f.stageable).length
              + ' stageable, ' + TRIALS + ' trials per arm');

  /* THE DICE. `free` is a FRESH stream per (fixture, trial), so a row rate cannot depend on how many
   * trials some earlier fixture happened to consume — which would make the whole arm order-dependent
   * and would make a re-run with one fixture removed a different measurement. */
  const DICE = {
    free: (fxi, i) => mulberry32((SEED ^ (fxi * 0x9E3779B1) ^ (i * 2654435761)) >>> 0),
    high: () => pinnedRng,
    low: () => (() => 0.0009),
  };

  /* THE STOPPING RULE, PER ARM. `target` is the trials this row needs to be certain to `--detect`;
   * `cap` stops a row that cannot get there (a fixture whose trigger is only reached on a fraction of
   * attempts, like a berry waiting on a 10% secondary to land). A row that hits the cap is SHORT and
   * says so — it is never quietly scored as though it were powered.
   *
   * THE HALVES ARE INTERLEAVED (i % 2) RATHER THAN FIRST-HALF/SECOND-HALF, which the self-play arm
   * uses. With a stopping rule the two are not the same thing: a run that stops the moment a target
   * is met has an arbitrary boundary, and a first/second split across it is not a split of
   * exchangeable arms. Parity is exchangeable whatever n turns out to be, and the split-half spread
   * is this file's noise floor (LESSONS 9). */
  function runArm(fx, mode, dice, target, cap) {
    const out = { attempts: 0, n: 0, k: 0, refused: {}, bands: {}, extra: {},
                  halves: [{ n: 0, k: 0 }, { n: 0, k: 0 }] };
    const TGT = target || TRIALS, CAP = cap || Math.max(TGT, TRIALS);
    for (let i = 0; i < CAP && out.n < TGT; i++) {
      out.attempts++; battlesPlayed++;
      let board;
      try { board = fx.build(mode); } catch (e) {
        out.refused['build threw: ' + e.message] = (out.refused['build threw: ' + e.message] || 0) + 1; continue; }
      if (!board) { out.refused['board not buildable'] = (out.refused['board not buildable'] || 0) + 1; continue; }
      let r;
      try { r = stagedPlay(board, dice(fx.idx, i)); } catch (e) {
        out.refused['the turn threw: ' + e.message] = (out.refused['the turn threw: ' + e.message] || 0) + 1; continue; }
      let obs;
      try { obs = fx.read(r.S, r.trace, board, mode); } catch (e) {
        out.refused['the reader threw: ' + e.message] = (out.refused['the reader threw: ' + e.message] || 0) + 1; continue; }
      /* THE RAW FIRE IS COUNTED WHATEVER `reached` SAYS, and that is what makes the control arm a
       * proof rather than a tautology: a control arm that refuses every trial and STILL sees the
       * mechanic fire would mean the thing being called the trigger is not the trigger. */
      if (obs.fired) out.extra.raw_fires = (out.extra.raw_fires || 0) + 1;
      const reached = SABOTAGE === 'staged-precondition' ? true : obs.reached;
      if (!reached) {
        const w = obs.why || 'the construction did not hold';
        out.refused[w] = (out.refused[w] || 0) + 1;
        /* TWO KINDS OF REFUSAL, AND CONFLATING THEM MISJUDGED THREE ROWS.
         *   BY DESIGN            the trigger is itself a die. Aspear Berry waits on a 10% freeze
         *                        secondary to land, so nine attempts in ten produce no trial and that
         *                        is the fixture working. It costs boards, not correctness.
         *   CONSTRUCTION FAILURE the board did not do what the fixture says it does — the hit did not
         *                        connect, the target died, the body never acted. THAT is what the 2%
         *                        tolerance is about, because past it the denominator stops being the
         *                        thing the fixture claims.
         * Judged together, the two berries (90%+ by-design refusals) and Harvest came out NOT CLEAN
         * and were dropped from the scored set with no visible reason. */
        if (obs.byDesign) out.by_design = (out.by_design || 0) + 1;
        else out.construction_failures = (out.construction_failures || 0) + 1;
        continue;
      }
      const half = i % 2;
      out.n++; out.halves[half].n++;
      if (obs.fired) { out.k++; out.halves[half].k++; }
      if (obs.band) out.bands[obs.band] = (out.bands[obs.band] || 0) + 1;
    }
    out.refused_total = out.attempts - out.n;
    out.by_design = out.by_design || 0;
    out.construction_failures = out.construction_failures || 0;
    out.refused_rate = out.attempts ? +(out.refused_total / out.attempts).toFixed(4) : null;
    /* A DENOMINATOR THAT IS PARTLY INFERRED IS NOT A DENOMINATOR. The tolerance is over the boards
     * where the trigger WAS supposed to be reachable — attempts minus the by-design refusals — and
     * above 2% of those the construction is not holding and this file has no business publishing a
     * rate over whatever is left. */
    const reachable = out.attempts - out.by_design;
    out.construction_failure_rate = reachable ? +(out.construction_failures / reachable).toFixed(4) : null;
    out.by_design_refusal_rate = out.attempts ? +(out.by_design / out.attempts).toFixed(4) : null;
    out.denominator_clean = out.construction_failures === 0 ? 'exact'
      : out.construction_failure_rate <= 0.02 ? 'within tolerance' : 'NOT CLEAN';
    return out;
  }

  for (const fx of FIX) {
    const entry = {
      id: fx.id, family: fx.family, subject: fx.subject, kind: fx.kind, carrier: fx.carrier || null,
      stageable: fx.stageable, why_not: fx.why_not || null,
      declaration: fx.decl || null, denominator: fx.denominator || null,
      preflight: fx.preflight || null, board: fx.boardText || null,
    };
    if (!fx.stageable) { staged.push(entry); continue; }
    /* HOW MANY THIS ROW NEEDS, DERIVED FROM ITS OWN DECLARED RATE. A row with no declared rate has no
     * required N — it is UNREACHABLE for power rather than SHORT, and the two are different problems.
     * A ladder row needs enough for its SMALLEST band, because the bands share this denominator and
     * the total agreeing while a branch is wrong is the failure the split exists to catch. */
    const need = fx.scored && fx.declared != null ? requiredTrials(fx.declared, DETECT) : null;
    entry.power = { detect_points: +(100 * DETECT).toFixed(2), required_trials: need,
      from: 'one-sample proportion test against the DECLARED rate, two-sided alpha 0.05, power 0.80, '
          + 'larger of the two alternatives (p0 +/- detect)' };
    const sub = runArm(fx, 'subject', DICE.free, need, need ? MAX_TRIALS : TRIALS);
    entry.subject_arm = sub;
    entry.power.achieved_trials = sub.n;
    entry.power.attempts_spent = sub.attempts;
    entry.power.met = need == null ? null : sub.n >= need;
    entry.power.verdict = need == null
      ? 'UNREACHABLE FOR POWER — no declared rate to power against; ' + (fx.decl ? fx.decl.why : '')
      : sub.n >= need ? 'MET' : 'SHORT';
    if (fx.hasControl) {
      /* A MECHANISM-REMOVED CONTROL HAS TO REACH ITS TRIGGER, AND FOR TWO FIXTURES THE TRIGGER IS
       * ITSELF A DIE. The berries wait on a 10% secondary to land, so a control capped at the flat
       * trial count collected ZERO reached trials on a small run and the proof failed for a reason
       * that was about the cap. It gets a TARGET in reached trials and an attempt budget of thirty
       * boards per trial; a trigger-removed control cannot increment by construction, so its target
       * is never met and its cap is what stops it — exactly the flat count it had. */
      const ctlTarget = Math.min(TRIALS, 200);
      const ctlCap = (fx.controlKind === 'mechanism-removed') ? ctlTarget * 30 : ctlTarget;
      const ctl = runArm(fx, 'control', DICE.free, ctlTarget, ctlCap);
      ctl.what = fx.controlText;
      entry.control_arm = ctl;
      /* TWO SHAPES OF CONTROL, AND THEY PROVE DIFFERENT THINGS. Both are decidable; a fixture
       * declares which one its board actually expresses, because asserting the wrong one is how a
       * proof becomes a formality.
       *
       *   TRIGGER-REMOVED    the board no longer reaches the trigger, so `reached()` must refuse
       *                      EVERY trial — n = 0 — and the mechanic must not fire once. This is the
       *                      denominator proof: it shows the denominator counts triggers rather than
       *                      clicks.
       *   MECHANISM-REMOVED  the trigger is still fully present — n must be NON-ZERO — and the
       *                      subject itself is gone (no item, no ability), so the numerator must be
       *                      ZERO. This is the attribution proof, and it is the only shape available
       *                      where removing the trigger also destroys the observable: with Quick Claw
       *                      the trigger IS "the holder would move second", so a board without it has
       *                      the holder moving first by definition and "moved first" stops meaning
       *                      anything. The first version asserted the trigger shape there and read
       *                      200 raw fires out of 200 — a proof failing for a reason that was about
       *                      the assertion rather than about the instrument. */
      const kindC = fx.controlKind || 'trigger-removed';
      entry.control_proof = { kind: kindC, trials: ctl.n, fired: ctl.k, raw_fires: ctl.extra.raw_fires || 0,
        caught: kindC === 'mechanism-removed' ? (ctl.n > 0 && ctl.k === 0)
                                              : (ctl.n === 0 && !(ctl.extra.raw_fires > 0)) };
      controlRows.push(entry);
    }
    for (const mode of ['high', 'low']) {
      const p = runArm(fx, 'subject', DICE[mode], TRIALS, TRIALS);
      pinRows[mode].push({ id: fx.id, n: p.n, k: p.k, expect: fx.scored ? fx.declared : null });
      entry['pinned_' + mode] = { trials: p.n, fired: p.k };
    }
    staged.push(entry);
    const ZH = () => [{ n: 0, k: 0 }, { n: 0, k: 0 }];
    rows.push({ key: fx.id, family: fx.family, subject: fx.subject, detail: fx.detail || fx.kind,
      expect: fx.scored ? fx.declared : null, scored: !!fx.scored,
      n: sub.n, k: sub.k, halves: sub.halves, denominator_clean: sub.denominator_clean,
      power: entry.power });
    /* A LADDER EFFECT IS REPORTED BAND BY BAND AND DELIBERATELY NOT SCORED BAND BY BAND.
     *
     * Effect Spore is one random(100) with three exclusive branches (11 / 10 / 9), and the total
     * agreeing while a branch is wrong is exactly the kind of failure a split catches — the branches
     * share this denominator, so the split would be exact rather than approximate. It is not scored
     * because the DECLARED band names come out of the tag artifact in Showdown's vocabulary
     * ("sleep", "paralysis", "poison") and the OBSERVED ones come off the body in this engine's
     * ("slp", "par", "psn"), and joining them needs medicham2's `CODE_OF_STATUS`, which is not
     * exported. Writing a second copy of that map here is the two-implementations-of-one-fact breach
     * CLAUDE.md names, and the FIRST version of this file did the shabby version of it — matching on
     * three characters — which read Flame Body and Poison Point at 0 of 40 and would have been filed
     * against the engine. So: both sides are PRINTED, side by side, in the fixture entry, and
     * nothing joins them.
     *
     * FILED TO ENGINE, one line: export CODE_OF_STATUS and these bands become scored rows. */
    if (fx.bands) entry.ladder = {
      declared_by_the_frozen_tag: fx.bands,
      observed_by_engine_status_code: sub.bands,
      note: 'NOT SCORED band by band — the two vocabularies are not joined here on purpose; see the '
          + 'comment at this push in engine/million_run.js. The TOTAL is scored and is the row above.',
    };
    console.log('    ' + fx.id.padEnd(22) + String(sub.n).padStart(6) + '/' + String(need == null ? '—' : need).padEnd(6)
      + ' fired ' + String(sub.k).padStart(6) + '  ' + (sub.n ? (100 * sub.k / sub.n).toFixed(2) + '%' : '—').padStart(7)
      + '  vs ' + String(fx.scored ? fx.declared : 'NOT SCORED').padStart(10)
      + '  ' + String(entry.power.verdict).padEnd(6)
      + (fx.hasControl ? '  control n=' + entry.control_arm.n + ' fires=' + (entry.control_arm.extra.raw_fires || 0) : ''));
  }

  /* ---- SCORING, through this file own scorers ------------------------------------------------- */
  const nScoredS = rows.filter(r => r.scored && r.expect != null).length || 1;
  const scoredRows = scoreRows(rows, SZ95, zFor(0.05 / nScoredS))
    .map((r, i) => Object.assign(r, { denominator_clean: rows[i].denominator_clean }));
  for (const r of scoredRows) if (r.denominator_clean === 'NOT CLEAN') {
    r.scored = false; r.diverges_at_95 = null; r.diverges_bonferroni = null;
    r.withheld = 'the denominator is partly inferred — more than 2% of the REACHABLE boards failed '
               + 'their construction (the hit did not connect, the body died, it never acted), so a '
               + 'rate over what is left is not a rate over a construction-known denominator. '
               + 'By-design refusals — a trigger that is itself a die — are excluded from that '
               + 'fraction and are reported separately as by_design.';
  }
  /* A SHORT ROW IS NOT A CERTAIN ROW, AND THE ASYMMETRY IS THE WHOLE POINT. A DIVERGENCE found at a
   * small n is real — the interval said so. An ABSENCE of divergence at a small n says nothing at
   * all, and reading it as agreement is the same error as scoring a rate over an invented
   * denominator: the number looks like an answer. So the flags stay and `certain` is a separate,
   * printed field. */
  for (let i = 0; i < scoredRows.length; i++) {
    const p = rows[i].power || {};
    scoredRows[i].power = { detect_points: p.detect_points, required_trials: p.required_trials,
      achieved_trials: p.achieved_trials, verdict: p.verdict };
    scoredRows[i].certain = p.met === true;
    if (p.met === false && !scoredRows[i].diverges_at_95)
      scoredRows[i].caveat = 'SHORT of the trials this rate needs to be certain to '
        + p.detect_points + ' points. It did not diverge, and at this n that is not evidence that it '
        + 'agrees.';
  }

  /* ---- RED PROOF 1: THE TRIGGER CONTROL ------------------------------------------------------- */
  const ctlMissed = controlRows.filter(e => !e.control_proof.caught)
    .map(e => ({ id: e.id, kind: e.control_proof.kind, trials: e.control_arm.n,
                 fired: e.control_arm.k, raw_fires: e.control_arm.extra.raw_fires || 0,
                 why: e.control_proof.kind === 'mechanism-removed'
                   ? (e.control_arm.n === 0
                      ? 'the control never REACHED its trigger in its attempt budget — this is a '
                        + 'power failure of the proof, not a finding about the instrument, and it is '
                        + 'still a refusal because a control arm with no trials proves nothing'
                      : 'the subject was removed and the mechanic fired anyway, so the numerator is '
                        + 'not attributable to the subject')
                   : 'the trigger was removed and the arm still collected trials (or still saw the '
                     + 'mechanic fire), so the denominator is not counting triggers' }));
  const ctlCaught = controlRows.length > 0 && ctlMissed.length === 0;

  /* ---- RED PROOF 2: THE TWO PINNED CORNERS ---------------------------------------------------- */
  const pinArm = (list, corner) => {
    const scored = list.filter(r => r.expect != null && r.n >= 20 && r.expect > 1 && r.expect < 99);
    const missed = scored.filter(r => !flags(r.k, r.n, r.expect / 100, SZ95))
      .map(r => ({ id: r.id, trials: r.n, fired: r.k, declared: r.expect }));
    return { corner, rows_with_20_plus: scored.length, missed,
             caught: scored.length > 0 && missed.length === 0 };
  };
  const pinHigh = pinArm(pinRows.high, 'every die 0.99 — no proc may fire, and every scored row must be FLAGGED');
  const pinLow = pinArm(pinRows.low, 'every die ~0 — every proc must fire, and every scored row must be FLAGGED');

  /* ---- RED PROOF 3: THE PER-ROW SYNTHETIC, the same device the self-play arm uses -------------- */
  const synth = scoreRows(rows.filter(t => t.scored && t.expect != null && t.n >= 20)
    .map(t => Object.assign({}, t, { k: t.expect >= 50 ? 0 : t.n,
                                     halves: [{ n: 0, k: 0 }, { n: 0, k: 0 }] })), SZ95, SZ95);
  const synthMissed = synth.filter(r => !r.diverges_at_95).map(r => ({ key: r.key, trials: r.trials }));
  const synthCaught = synth.length > 0 && synthMissed.length === 0;

  const leaked = staged.filter(e => e.declaration && e.declaration.corroborated === false
                                    && rows.some(r => r.key === e.id && r.scored));
  const elapsedS = Date.now() - t0s;
  const stageable = FIX.filter(f => f.stageable).length;

  const artifactS = Object.assign({
    note: 'GENERATED — do not hand-edit. Written by engine/million_run.js --staged. ROADMAP #196.',
  }, REL.stamp(), {
    generated: new Date().toISOString(),
    by: 'engine/million_run.js --staged',
    what: 'THE STAGED ARM. Constructed boards, FREE dice, and a denominator known BY CONSTRUCTION '
        + 'rather than inferred from a trace. This is the arm the proc family was waiting for: '
        + 'FAMILY_SUPPORT.proc in this same file marks the whole family observable:false because '
        + '"the trace does not say whether the trigger was reached, only whether it fired, so the '
        + 'denominator would be invented. Needs a staged arm, not a bigger corpus." On a board this '
        + 'file built the trigger is reached by construction and VERIFIED per trial, and a '
        + 'trigger-control arm proves the verification is a trigger test rather than a click count.',
    rng: 'FREE-RUNNING (mulberry32, a fresh stream per fixture-trial, seeded from ' + SEED + '). NOT '
       + 'the differential drivers pin — ROADMAP #88 pins every die to one corner, which is why these '
       + 'rows read COULD-NOT-STAGE in tests/roster.js and are measurable here. Both pinned corners '
       + 'are run as red proofs and both must be flagged.',
    denominator_doctrine: 'ONE TRIAL IS ONE FRESHLY BUILT BOARD played for the fixture own script. '
        + 'The denominator is the number of trials on which the construction was VERIFIED to hold — '
        + 'never a count of clicks, and never a count inferred from what the trace happened to show. '
        + 'A trial where it did not hold is REFUSED with a named reason and counted; a fixture '
        + 'refusing more than 2% of its attempts is reported and NOT scored.',
    noise_rule: 'data/scenarios-from-will.json the_noise_rule — every body not under test clicks the '
        + 'weakest boring move on ITS OWN learnset, aimed at the far slot and never at the '
        + 'experiment. A loud neighbour contaminates a reading exactly as the Struggle fallback did.',
    power: {
      what: 'THE STOPPING RULE IS POWER PER ROW, NOT A TOTAL GAME COUNT. Will, 2026-08-11: "I keep '
          + 'saying million but really its just however many games we need for each staging to be '
          + 'certain of our chances and odds of procing." Each row runs until IT can catch an error '
          + 'of `detect_points`, then stops. The total below is the ANSWER to "how many games do we '
          + 'need" for this fixture set, and it is an allocation rather than a lottery: the '
          + '50,000-game self-play run put 20,987 trials on its busiest row and ZERO on others.',
      detect_points: +(100 * DETECT).toFixed(2),
      test: 'one-sample proportion against the DECLARED rate, two-sided alpha 0.05, power 0.80, '
          + 'larger of the two alternatives (p0 + detect and p0 - detect). At 10/20/30/50/70% the '
          + 'two directions agree; at 95% the downward alternative is the harder one (185 against '
          + '73 at five points) and this takes the harder one.',
      rows_met: staged.filter(e => e.power && e.power.met === true).map(e => e.id),
      rows_short: staged.filter(e => e.power && e.power.met === false)
        .map(e => ({ id: e.id, required: e.power.required_trials, achieved: e.power.achieved_trials,
                     attempts_spent: e.power.attempts_spent,
                     why: 'the trigger is only reached on a fraction of attempts, so trials cost more '
                        + 'than one board each — see this fixture refused map for the split' })),
      rows_unreachable: staged.filter(e => !e.stageable || (e.power && e.power.met === null))
        .map(e => ({ id: e.id, why: e.why_not || (e.power && e.power.verdict) })),
      all_scoreable_rows_powered: staged.filter(e => e.power && e.power.met === false).length === 0,
      staged_battles_played: null,   /* filled below */
    },
    trials_per_control_and_pin_arm: TRIALS,
    target_list: TARGETS_STAMP,
    declaration_gate: { pairs_compared: gate.pairs_compared, agree: gate.agree, disagree: gate.disagree,
      note: 'the #132 secondary gate, run before any board was staged. It does not cover the proc '
          + 'family; the per-fixture `declaration` block below is the proc equivalent and it '
          + 'cross-checks the frozen tag against the format-derived target row.' },
    corroboration: {
      what: 'How many staged rows have a SECOND, independent declaration behind them. '
          + 'engine/million_targets.js derives the proc family from PROC_WHAT, a HAND-TYPED list of '
          + 'TWELVE subjects, and ROADMAP #196 names SEVENTEEN. The uncorroborated rows are not '
          + 'wrong; they rest on one surface, and that is a number rather than a feeling.',
      corroborated: staged.filter(e => e.declaration && e.declaration.corroborated === true).map(e => e.subject),
      tag_only: staged.filter(e => e.declaration && e.declaration.corroborated === null && e.declaration.tag_pct != null).map(e => e.subject),
      disagreeing: staged.filter(e => e.declaration && e.declaration.corroborated === false).map(e => e.subject),
      no_tag_param: staged.filter(e => e.declaration && e.declaration.tag_pct == null).map(e => e.subject),
    },
    /* AN ABSENT MECHANIC IS NOT A MIS-SAMPLED ONE, AND POOLING THE TWO IS A CATEGORY ERROR.
     * A row that fires ZERO times in a denominator large enough to have caught the declared rate many
     * times over is not a sampler running slightly cold: the mechanic is not there. Pooled with the
     * rest it dominates the z and turns "three abilities do nothing" into "the sampler is biased" —
     * a headline about the wrong thing entirely. So it is named, counted, and taken out of the second
     * pooled figure, with both printed. */
    absent_mechanics: rows.filter(r => r.scored && r.expect > 0 && r.k === 0 && r.n >= 20)
      .map(r => ({ id: r.key, trials: r.n, fired: 0, declared_pct: r.expect,
        upper_bound_95_pct: +(100 * wilson(0, r.n, 1.959963985)[1]).toFixed(3),
        what_it_means: 'zero fires in ' + r.n + ' trials on a board where the trigger was reached and '
          + 'verified every time. At a declared ' + r.expect + '% the expected count was '
          + Math.round(r.n * r.expect / 100) + '. This is a mechanic that is not implemented, not a '
          + 'rate that is off — and which of the two it is, is exactly what a staged board can say '
          + 'and a self-play corpus cannot.' })),
    pooled: {
      what: 'Every scored staged trial, each row at its own declared rate, Poisson-binomial. |z| > 3 '
          + 'diverges. Unlike the self-play arm this pool is over CONSTRUCTED denominators, so a '
          + 'divergence here cannot be a denominator artefact of the corpus.',
      all: pooled(rows.filter(r => r.scored)),
      excluding_absent_mechanics: pooled(rows.filter(r => r.scored && !(r.expect > 0 && r.k === 0 && r.n >= 20))),
      by_family: Object.fromEntries([...new Set(rows.map(r => r.family))]
        .map(f => [f, pooled(rows.filter(r => r.family === f && r.scored))])),
    },
    red_proof: {
      what: 'The artifact refuses to exist unless all three were CAUGHT.',
      trigger_control: {
        what: 'the identical board with the TRIGGER removed and one thing changed. It must record '
            + 'ZERO trials — reached() must refuse every one — and ZERO raw fires. A control arm that '
            + 'collects trials is an invented denominator wearing a staged board clothes. '
            + 'MILLIONRUN_SABOTAGE=staged-precondition forces exactly that and the run refuses.',
        arms: controlRows.length, caught: ctlCaught, missed: ctlMissed },
      pinned_corners: { high: pinHigh, low: pinLow, caught: pinHigh.caught && pinLow.caught },
      per_row_synthetic: { rows: synth.length, missed: synthMissed, caught: synthCaught,
        what: 'every scored row with 20+ trials, its real n against a maximally wrong outcome. '
            + 'Decidable at every n; a miss means the row-level flagger is blind.' },
      sabotage_env: SABOTAGE || null,
    },
    scoring: { interval: 'Wilson 95%', scored_rows: nScoredS,
      note: 'the split-half spread on each row is the noise floor for that row (LESSONS 9): an effect '
          + 'smaller than the spread between two halves of one arm is not an effect. Band rows share '
          + 'their parent denominator and carry no split-half of their own.' },
    cost: { elapsed_ms: elapsedS, fixtures: FIX.length, stageable,
      arms_per_fixture: 4, staged_battles_played: battlesPlayed,
      ms_per_battle: +(elapsedS / Math.max(1, battlesPlayed)).toFixed(4),
      what_a_battle_is: 'one freshly built four-body board played for one or two scripted turns. It '
          + 'is not comparable to a self-play game, which runs to a 20-turn cap — so this number must '
          + 'never be quoted beside the self-play arm ms/game.',
      note: 'four arms are played per stageable fixture — subject (which runs to its own power '
          + 'target), trigger control, pinned high, pinned low. COVERAGE HERE IS THE FIXTURE SET, NOT '
          + 'N: past its power target another million trials adds precision to a row that already has '
          + 'enough and reaches no mechanic that has no fixture. That is the same finding the '
          + '50,000-game self-play run made from the other direction.' },
    fixtures: staged,
    rows: scoredRows,
  });

  artifactS.power.staged_battles_played = battlesPlayed;
  /* WHICH TARGET ROWS THIS ARM REACHES, off the work list itself rather than off a memory of it. The
   * proc family is what ROADMAP #196 reclassified into this instrument, so that is the denominator
   * for coverage — and a target row with no fixture is UNREACHABLE with a reason, never a zero. */
  const procTargets = (TARGETS.rows || []).filter(r => r.family === 'proc');
  artifactS.coverage_against_target_list = {
    proc_rows_in_list: procTargets.length,
    with_a_staged_fixture: procTargets.filter(r => staged.some(e => e.subject === r.subject && e.stageable)).length,
    list_rows_with_no_fixture: procTargets.filter(r => !staged.some(e => e.subject === r.subject)).map(r => r.subject),
    fixtures_with_no_list_row: staged.filter(e => !procTargets.some(r => r.subject === e.subject)).map(e => e.subject),
    note: 'a fixture with no list row is not an error — million_targets.js PROC_WHAT is a hand-typed '
        + 'list of twelve subjects and ROADMAP #196 names seventeen. It is the corroboration gap, '
        + 'counted rather than felt.',
  };
  const div95 = scoredRows.filter(r => r.scored && r.diverges_at_95).length;
  const divB = scoredRows.filter(r => r.scored && r.diverges_bonferroni).length;
  if (artifactS.absent_mechanics.length) {
    console.log('\n  MECHANICS THAT ARE ABSENT, NOT MIS-SAMPLED — zero fires on a verified trigger:');
    for (const a of artifactS.absent_mechanics)
      console.log('    ' + a.id.padEnd(24) + '0 / ' + String(a.trials).padStart(5)
        + '   declared ' + String(a.declared_pct).padStart(5) + '%   95% upper bound '
        + a.upper_bound_95_pct + '%');
  }
  console.log('\n  POOLED (staged, scored rows only): trials ' + artifactS.pooled.all.trials
    + ', fired ' + artifactS.pooled.all.fired + ', expected ' + artifactS.pooled.all.expected_fires
    + ', z ' + artifactS.pooled.all.z);
  console.log('  POOLED excluding the absent mechanics: trials '
    + artifactS.pooled.excluding_absent_mechanics.trials + ', fired '
    + artifactS.pooled.excluding_absent_mechanics.fired + ', expected '
    + artifactS.pooled.excluding_absent_mechanics.expected_fires + ', z '
    + artifactS.pooled.excluding_absent_mechanics.z);
  console.log('  ' + scoredRows.filter(r => r.scored).length + ' scored rows; ' + div95
    + ' diverge at 95%, ' + divB + ' survive Bonferroni');
  console.log('  red proof — trigger control: ' + (ctlCaught ? 'CAUGHT' : 'NOT CAUGHT')
    + '  (' + controlRows.length + ' control arms'
    + (ctlMissed.length ? ', MISSED ' + JSON.stringify(ctlMissed) : '') + ')');
  console.log('  red proof — pinned high: ' + (pinHigh.caught ? 'CAUGHT' : 'NOT CAUGHT')
    + ' (' + pinHigh.rows_with_20_plus + ' rows)   pinned low: ' + (pinLow.caught ? 'CAUGHT' : 'NOT CAUGHT')
    + ' (' + pinLow.rows_with_20_plus + ' rows)');
  console.log('  red proof — per-row synthetic: ' + (synthCaught ? 'CAUGHT' : 'NOT CAUGHT')
    + '  ' + (synth.length - synthMissed.length) + '/' + synth.length + ' flagged');
  const notStaged = staged.filter(e => !e.stageable);
  if (notStaged.length) {
    console.log('\n  COULD-NOT-STAGE (' + notStaged.length + '), each with its derived reason:');
    for (const e of notStaged) console.log('    ' + e.id.padEnd(24) + e.why_not);
  }
  const shortRows = artifactS.power.rows_short;
  console.log('\n  POWER — every row runs until it can catch a ' + artifactS.power.detect_points
    + '-point error, then stops.');
  console.log('    ' + artifactS.power.rows_met.length + ' MET, ' + shortRows.length + ' SHORT, '
    + artifactS.power.rows_unreachable.length + ' UNREACHABLE');
  for (const s of shortRows)
    console.log('      SHORT  ' + s.id.padEnd(22) + s.achieved + ' of ' + s.required
      + ' trials in ' + s.attempts_spent + ' boards');
  console.log('  ANSWER TO "HOW MANY GAMES DO WE NEED": ' + battlesPlayed + ' staged battles, '
    + (elapsedS / 1000).toFixed(1) + ' s, to power ' + artifactS.power.rows_met.length
    + ' rows to ' + artifactS.power.detect_points + ' points (subject arms plus the three proof arms).');

  if (leaked.length) {
    console.error('\n  REFUSING TO WRITE AN ARTIFACT. ' + leaked.length + ' row(s) whose two '
      + 'declaration surfaces DISAGREE were scored anyway: ' + leaked.map(e => e.id).join(', ')
      + '. Measuring a sampler against a declaration we have not settled is checking our code '
      + 'against our own mistake.');
    process.exit(1);
  }
  if (!ctlCaught || !pinHigh.caught || !pinLow.caught || !synthCaught) {
    console.error('\n  REFUSING TO WRITE AN ARTIFACT. A red proof went uncaught. Without the trigger '
      + 'control this arm cannot show that its denominator is a TRIGGER rather than a click, and '
      + 'without the pinned corners it cannot show it would notice a wrong rate. Either way the '
      + 'number would be confident and meaningless.');
    process.exit(1);
  }
  if (NO_WRITE) { console.log('\n  --no-write: nothing written.'); return; }
  fs.writeFileSync(STAGED_OUT, JSON.stringify(artifactS, null, 2) + '\n');
  console.log('\n  wrote ' + path.relative(ROOT, STAGED_OUT).replace(/\\/g, '/'));
}
