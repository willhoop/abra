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
 * artifact. Nothing else reads it. Two modes, one per refusal:
 *   flagger   disables the divergence flagger, so both red proofs go UNCAUGHT.
 *   refusal   lets the declaration gate's refused (move, effect) pairs through into the tally, so
 *             the leak check at the end sees a row scored against a declaration the gate rejected.
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
const SABOTAGE = process.env.MILLIONRUN_SABOTAGE || '';

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
  ohko: { observable: 'TALLIED BUT WITHHELD — the denominator does not reconcile',
    withheld: 'A rule-free count of the same event over 25,000 games — every |-miss| and every '
            + '|-damage| inside an OHKO move block, no eligibility rule of any kind — reads '
            + '1,081/3,622 = 29.85% [28.4, 31.4] against the declared 30, so the engine\'s sampler '
            + 'is right. This instrument reads outside that interval on 7,005 trials, so its '
            + 'denominator is still losing trials and the family is not scored. It published '
            + '"z = +8.0 DIVERGES" for one run before that was measured; the number was about this '
            + 'file, not about the engine.',
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

/* ---- ONE GAME ------------------------------------------------------------------------------------ */
const SPECIES = Object.keys(MC.mons);
const WEIGHTS = SPECIES.map(s => Math.max(1, +(MC.mons[s].wt || 1)));
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
          const connected = r.missed ? false : (r.damaged || r.touched);
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
            /* THE OHKO FAMILY IS TALLIED AND NOT SCORED, AND THE REASON IS A MEASUREMENT.
             *
             * A RATE THIS INSTRUMENT CANNOT RECONCILE WITH A RULE-FREE COUNT OF ITS OWN EVENT DOES
             * NOT GET PUBLISHED. Over 25,000 games, counting nothing but `|-miss|` and `|-damage|`
             * inside an OHKO move block with no eligibility rule at all, the engine connects
             * 1,081 / 3,622 = 29.85% [28.4, 31.4] — the declared 30, so the SAMPLER IS RIGHT. This
             * instrument, after the miss-outranks-touch fix above took it from 34.40% to 32.89%,
             * still reads outside that interval on 7,005 trials. Two readings of one event that do
             * not overlap mean the denominator is still wrong, and the residual is on this side: the
             * raw count is the one with no rules in it.
             *
             * IT IS STILL TALLIED, because the rows and their split-halves are the evidence somebody
             * needs to finish this, and a family that vanishes is a family nobody fixes. `scored` is
             * what keeps it out of the pooled headline and out of the divergence list — the number
             * is WITHHELD rather than captioned, which is CLAUDE.md's rule and which this file broke
             * for one run by publishing `ohko z = +8.0 DIVERGES` as though it were about the engine.
             *
             * WHAT CLOSES IT: 5,353 OHKO move blocks in that probe produced only 3,622 lines of
             * either kind, so roughly a third emit neither a hit nor a miss. Identify what those
             * blocks are (a failure, a target that left, a spread bookkeeping path) and the two
             * counts will either agree or the disagreement will name itself. */
            bump('ohko:' + b.move + (OHKO.get(b.move) === 'Ice' ? (iceUser ? ':ice-user' : ':non-ice-user') : '')
                 + (cleanO ? '' : ':MODIFIED'),
                 { family: 'ohko', subject: b.move, detail: cleanO ? 'connects at equal level' : 'modified',
                   expect: cleanO ? expect : null, scored: false,
                   withheld: 'this family disagrees with a rule-free count of the same event (29.85% '
                           + 'on 3,622 raw hit-or-miss lines against 30 declared), so the residual is '
                           + 'this instrument\'s denominator and not the engine\'s sampler' },
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
            const anyHit = [...per].some(([tid, x]) => tid !== b.user && (x.damaged || x.touched));
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
            if (!(r.damaged || r.touched)) { excl('secondary: did not connect with this body'); continue; }
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

const artifact = Object.assign({}, REL.stamp(), {
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
if (NO_WRITE) { console.log('\n  --no-write: nothing written.'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n');
console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
