/* replay_differential.js — ROADMAP #68. REPLAY REAL STORED GAMES THROUGH THE ENGINE AND COUNT THE
 * DIVERGENCES AGAINST WHAT ACTUALLY HAPPENED.
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * `tests/test-engine-diff.js` is the differential this project has had, and it is ONE DAMAGE
 * CALCULATION PER ROW — attacker, move, defender, do the two engines agree within 12%. There is no
 * turn loop in it. It cannot see anything that needs a second turn, a switch or a residual, which is
 * nearly every mechanic fixed in the last day: Trick Room expiring, Wish resolving across a switch,
 * Stockpile layering, Encore's lock, a partial-trap counter, the volatile-duration family.
 *
 * It is also why we were fooled. At its default n=150 it reported ZERO disagreements for weeks. Run at
 * n=20,000 it reports 19. Sample size was hiding a live bug.
 *
 * `engine/game_differential.js` does have a turn loop and it plays SYNTHETIC games against Showdown.
 * That is the right instrument for "do the two rulebooks agree". It is not an instrument for "does our
 * engine describe the game people actually play": its bodies are flat-statted, its driver is
 * coverage-seeking rather than skilful, and its positions are ones no ladder player would reach.
 *
 * This file is the third thing. The authority is not Showdown-the-library, it is **51,445 games that
 * really happened**, in `data/games.ladder.jsonl`. The question is not "do two engines agree", it is
 * **"can our engine produce what the record says happened"**.
 *
 * ================= THE THREE HARD PROBLEMS, AND WHAT WAS ACTUALLY DONE ABOUT EACH ==================
 *
 * ---- 1. THE STORE RECORDS EFFECTS, NOT CHOICES.
 *
 * A line says Incineroar used Fake Out and dealt 33. It does not say the click was `move 1 2`. The
 * choice is reconstructed from the effect — the move id off the `m` event, the target SLOT off the
 * species the event names. WHERE IT CANNOT BE RECONSTRUCTED THE UNIT IS REFUSED AND COUNTED. A
 * reconstruction that guesses is worse than no test, because a guess that happens to be wrong looks
 * exactly like an engine defect.
 *
 * THE STORE HAS NO `cant` EVENT AT ALL. Measured: the event types present are `m hp f s b mega w x fs`.
 * Showdown emits `|cant|p2a: Incineroar|flinch` and the extractor drops it, so a body that was
 * flinched, fully paralysed, asleep, frozen or recharging is INDISTINGUISHABLE from one that simply
 * has no record. That is an ingest defect and it is filed, not fixed here (this file may not edit the
 * ingest). Its consequence is carried honestly: a slot with no `m` event is `no-click-recorded` and
 * gets its own bucket rather than dissolving into the pass rate.
 *
 * ---- 2. HIDDEN INFORMATION RESOLVED ONE WAY IN THE REAL GAME.
 *
 * Every source of randomness in the real game left a trace, so it is RECOVERED rather than simulated:
 *
 *     accuracy      a miss is `miss:1` on the move event. Hit-or-miss is observable.
 *     crit          `-crit` is parsed onto the event as `crit:1`. ABSENCE IS INFORMATIVE — Showdown
 *                   always announces a crit — so the crit state is known on every event, not guessed.
 *                   That halves the candidate set from 32 to 16 by itself.
 *     secondaries   a burn is an `x` event, a stat drop is a `b` event. Fired-or-not is observable.
 *     speed ties    THE RESOLUTION ORDER IS THE EVENT ORDER (ROADMAP #43). Which `m` event came first
 *                   is how the coin landed, and nothing in this repository has ever read it.
 *     damage roll   the 16-roll identification, below, and it is the one that does not work.
 *
 * ---- 3. DIVERGENCE COMPOUNDS. One wrong HP on turn 2 makes turn 5 meaningless.
 *
 * THE BOARD IS REBUILT FROM THE LOG AT THE START OF EVERY TURN. Not patched — rebuilt. Every turn is
 * therefore an independent test and one 6-turn game is ~6 units instead of one fragile chain.
 *
 * THE PRICE IS STATED RATHER THAN HIDDEN, because it is the largest single caveat on this instrument.
 * The store records active identity, HP%, status, ABSOLUTE boost stages, weather, terrain, field
 * starts, megas and faints. It does NOT record `-sidestart` (Reflect, Light Screen, Aurora Veil,
 * Tailwind), Substitute, item consumption, PP, choice locks or volatile durations. A rebuilt board has
 * none of those. So on turn 1 this instrument is EXACT by construction — no invisible state can exist
 * yet — and on later turns it is blind to that list. Turn 1 is therefore reported as its own arm, and
 * it is not a convenience: it is the only arm with no unmeasured confounder in it.
 *
 * The alternative — carry our own engine's state and overwrite the observable subset — keeps the
 * screens and the Substitutes but makes every later turn depend on our own earlier simulation, which
 * is the thing under test. Rebuilding is the choice that keeps each unit attributable, and the blind
 * spots are enumerated in `cannot_see` in the artifact rather than argued about in prose.
 *
 * ================= THE DAMAGE TEST, AND WHY ROLL RECOVERY DOES NOT WORK HERE =======================
 *
 * Will: *"couldnt our engine roll all 16 rolls and identify which one was played out in game?"* It is
 * the right idea and it is the correct shape of the test — it turns the damage figure from an INPUT
 * into a TEST, where pinning the engine to the observed damage would have made a wrong damage model
 * agree with itself. `dmgRange`'s `hit.rolls` out-parameter already computes all sixteen, and
 * `tests/test-damage-stages.js` proves that array exact against the authority 1,728/1,728.
 *
 * IT CANNOT IDENTIFY THE ROLL ON THIS CORPUS, AND THE REASON IS MEASURED RATHER THAN ASSERTED.
 * `spread_envelope` in the artifact carries it. Two facts about the record defeat it:
 *
 *   - CHAMPIONS TEAM SHEETS DO NOT DECLARE SP. Of 52,089 stored games, 884 carry an open sheet, and
 *     every one of those sheets has `evs: null` — the format publishes item, ability, moves and
 *     NATURE and not the 66-point spread. An attacker's offensive stat is therefore only known to lie
 *     between 0 SP with a hindering nature and 32 SP with a boosting one, which for a typical body is
 *     a range of about 1.35x.
 *   - THE RECORD STATES DAMAGE AS AN INTEGER PERCENT OF AN UNKNOWN MAXIMUM. The defender's HP SP is
 *     unknown too, so the DENOMINATOR moves by up to ~19% on its own, and the numerator is quantised
 *     to whole points.
 *
 * One roll step is 1/16 of a 15% band — under 1% of the damage. The legal-spread envelope is wider
 * than the entire 16-roll span by a large factor, so the observed value is consistent with many rolls
 * for structural reasons that have nothing to do with our engine. Recovering the index would require
 * the spread, and the spread is not in the record.
 *
 * SO THE TEST IS INVERTED INTO THE ONE THE RECORD CAN ACTUALLY SUPPORT, AND IT IS STILL ONE-SIDED AND
 * STILL DICE-FREE: compute the full attainable damage interval — all 16 rolls, at the observed crit
 * state, at the observed spread state, evaluated at both corners of the LEGAL SP envelope — and ask
 * whether the observed damage is inside it. Outside is a statement no legal Champions spread can
 * explain, which is exactly an engine defect. Inside is agreement, and it is honestly weaker than a
 * roll match; the artifact reports the interval WIDTH beside every verdict so nobody can read
 * "in-span" as "exact".
 *
 * FOUR VERDICTS, NEVER TWO. `matched` / `ambiguous` / `unresolved` / `no-match`, with the unresolved
 * reason always named. A 30% unresolved rate would make the headline meaningless in exactly the way
 * the 150-comparison differential did, so the rate is printed at the top of the report.
 *
 * THE ROLL IDENTIFICATION IS STILL RUN, against the DEFAULT baked body, and reported as its own line.
 * It is not a verdict on the engine — it confounds the damage chain with `data/engine-data.js`'s baked
 * spread — but "how often does a real damage number land exactly on one of our sixteen" is a number
 * this project has never had, and it is the direct answer to the question that was asked.
 *
 * ================= WHAT PINNING CANNOT TEST ========================================================
 *
 * If our secondary chance is 30% where Showdown's is 10%, pinning the outcome to what was observed
 * makes a wrong probability agree with itself — the same trap as pinning the damage. The answer is a
 * SECOND, AGGREGATE test over the same corpus: count the observed rate of each secondary across all
 * games and compare it against the chance our own tag declares, with an interval.
 *
 * IT IS DESIGNED HERE AND DEFERRED, AND SAYING SO IS THE POINT. `--rates` runs it. It is reported
 * separately and it is NOT part of the headline, because it needs a corpus far larger than the sample
 * this pass validates on before an interval on a 10% secondary means anything.
 *
 * ================= A DIVERGING TURN IS A BOARD, NOT A COUNTER ======================================
 *
 * Will: *"if you could give me the turns that differed in a freeze state i could probably tell you
 * what went wrong"*. Most of this project's real bugs were found by a human reading a board. So every
 * divergence is written to `data/replay-differential-freezes.json` as a readable frozen state: the
 * game id and turn (so it can be pulled up on Showdown), the full board before, the clicks that were
 * fed in and how they were reconstructed, the board after from the log against the board after from
 * our engine with the differing fields called out, and the raw log events for that turn.
 *
 * ================= USAGE ==========================================================================
 *
 *   node engine/replay_differential.js --games 100
 *   node engine/replay_differential.js --games 100 --release <id>     # never cuts; see below
 *   node engine/replay_differential.js --selftest                     # the RED proof
 *   node engine/replay_differential.js --rates --games 2000           # the deferred aggregate test
 *
 * THIS FILE NEVER CUTS A RELEASE. `game_differential.js:126` auto-cuts when `--release` is absent,
 * which is right for the instrument that drives the release ladder and wrong for everything else — a
 * cut is a write, and a measurement that writes to the release store on start-up cannot be run beside
 * another division. It opens the CURRENT release and stamps it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const has = (name) => argv.indexOf(name) >= 0;

const N_GAMES = +flag('--games', 100);
const SKIP_GAMES = +flag('--skip', 0);
const STORE = flag('--store', D('data', 'games.ladder.jsonl'));
const OUT = flag('--out', D('data', 'replay-differential.json'));
const FREEZE_OUT = flag('--freeze-out', D('data', 'replay-differential-freezes.json'));
const FREEZE_CAP = +flag('--freeze-cap', 40);
const TURN1_ONLY = has('--turn1-only');
const SELFTEST = has('--selftest');
const QUIET = has('--quiet');

/* ---- THE PHOTOGRAPH ---------------------------------------------------------------------------- */
const ER = require('./engine_release.js');
const REL = ER.open(flag('--release', null));
REL.require('data/engine-data.js');
const M = REL.require('engine/medicham2-browser.js', {
  need: ['buildMon', 'dmgRange', 'moveFx', 'natureL50', 'natureStat', 'battleInit', 'battleTurn',
         'battleOver', 'playerAction', 'effSpeed', 'movePriority', 'weatherId', 'terrainId'],
});
const MC = global.MC;
const { mcKey } = REL.require('engine/mc_key.js');
const id = require('./names.js').id;

/* ================= COUNTERS — EVERY ONE OF THEM IS PRINTED, INCLUDING THE ZEROS =================
 * CLAUDE.md: a capability that cannot prove it ran is assumed broken. A silent zero here reads
 * exactly like a working feature. */
const C = {
  games_read: 0, games_replayed: 0, games_skipped: 0,
  turns_seen: 0, turns_compared: 0, turns_diverged: 0, turns_turn1: 0, turns_turn1_diverged: 0,
  exceptions: 0,
};
/* ---- THE BOT SPLIT, REPORTED AND NEVER FILTERED (Will, 2026-08-10) ------------------------------
 *
 * *"we can use the bot games here too. they still have to follow the rules, we are just trying to
 * make sure our engine lines up with reality"*. He is right, and the reason is structural rather than
 * charitable: the engine that resolved those turns was SHOWDOWN, and Showdown does not resolve a turn
 * differently because a bot chose it. Move QUALITY is irrelevant to "can our engine reproduce this
 * turn" — only legality and resolution matter, and both are guaranteed by the server.
 *
 * They are also denser material. A single `pcrlbot*` account plays roughly 2,900 games, so a bot slice
 * gives many turns over a consistent archetype instead of a long tail of one-off teams.
 *
 * THE BOUNDARY THAT MUST NOT BE CROSSED LATER, written here so it travels with the decision: bot games
 * must NEVER feed `meta-usage.json`, the opponent model or any human prior. A bot's CHOICES are not a
 * human distribution. That is a different analysis with a different filter — which is exactly the
 * store's founding principle working as intended: store raw, filter at analysis time.
 *
 * SPLIT, SO THE HEADLINE IS READABLE EITHER WAY. If the divergence rate differs between the two
 * populations that is itself a finding (it would mean bot lines reach different mechanics), and a
 * single blended number could never say so. */
const SPLIT = { 'bot-v-bot': { games: 0, turns: 0, diverged: 0 },
                'bot-v-human': { games: 0, turns: 0, diverged: 0 },
                'human-v-human': { games: 0, turns: 0, diverged: 0 },
                'unknown': { games: 0, turns: 0, diverged: 0 } };
function population(game) {
  const a = game.p1 && typeof game.p1.bot === 'boolean' ? game.p1.bot : null;
  const b = game.p2 && typeof game.p2.bot === 'boolean' ? game.p2.bot : null;
  if (a === null || b === null) return 'unknown';
  return a && b ? 'bot-v-bot' : (a || b ? 'bot-v-human' : 'human-v-human');
}
const SKIP_REASON = new Map();
const EXCEPTIONS = new Map();
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

/* Damage verdicts, four-way and never two. */
const DMG = { matched: 0, ambiguous: 0, unresolved: 0, no_match: 0, clamped_ok: 0, clamped_unreachable: 0 };
const DMG_UNRESOLVED = new Map();
/* A move event that is not a damage comparison at all — a Protect, a Tailwind, a recorded miss. Kept
 * OUT of the damage denominator and printed anyway, because "we looked at 242 things" has to mean the
 * same 242 things a rate is computed over. */
const NOT_A_DAMAGE_UNIT = new Map();
/* Two of the same species on one board. Not a skip and not a refusal — the unit is scored and the
 * count is published so a reader can see how much of the sample rested on a first-match. */
const AMBIGUOUS_TARGETS = { n: 0, games: 0 };
/* The roll-identification reading against the DEFAULT baked body — the direct answer to the question
 * that was asked, kept separate from the verdict because it confounds the damage chain with the
 * dataset's baked spread. */
const ROLLID = { unique: 0, ambiguous: 0, none: 0 };
/* Every span we computed, so the artifact can state how WIDE the interval was rather than letting
 * "in-span" read as "exact". */
const SPAN_WIDTH = [];

/* Divergences GROUPED BY MECHANIC. "23 games diverged on Fake Out" is nearly useless; "the flinch was
 * not applied on the turn it landed, 23 times" is actionable. The key is the mechanic; the moves and
 * bodies ride along as evidence. */
const MECH = new Map();
function mech(key, detail, ev) {
  let r = MECH.get(key);
  if (!r) { r = { key, n: 0, examples: [], witnesses: new Map() }; MECH.set(key, r); }
  r.n++;
  if (detail) bump(r.witnesses, detail);
  if (ev && r.examples.length < 6) r.examples.push(ev);
  return r;
}

/* ================= THE LEGAL SP ENVELOPE ==========================================================
 *
 * Champions: 66 SP total, 32 cap per stat, auto-31 IVs, level 50, and the nature multiplier applies
 * AFTER adding SP. So one stat's attainable range at level 50 is
 *      [ nature-hindered, 0 SP ,  nature-boosted, 32 SP ].
 *
 * IT IS COMPUTED THROUGH THE ENGINE'S OWN EXPORTS AND NOT REIMPLEMENTED HERE. `natureL50(bs,
 * 'Serious')` is the neutral line, which is the pre-nature value the formula adds SP to; `natureStat`
 * is the engine's fixed-point nature multiply. Writing the level-50 formula out again would be the
 * two-implementations-of-one-fact breach CLAUDE.md names, and it is exactly the breach
 * `game_differential.js`'s `flatL50` was written to avoid.
 *
 * IT IS A MARGINAL ENVELOPE AND THEREFORE AN OUTER BOUND. A single nature cannot boost two stats, and
 * a 66-point budget cannot put 32 into every stat — so taking each stat to its own extreme describes
 * spreads that are not simultaneously legal. That errs in the direction of NOT accusing the engine,
 * which is the correct direction for an instrument whose finding is "our model cannot produce this".
 *
 * HP SP: `l50` inside medicham2 does not add SP to HP at all (`hp: floor((2*bs.hp+31)*50/100)+50+10`),
 * while the paste importer's comment says HP SP is added after. The two disagree, and that is an
 * ENGINE finding rather than this file's business — it is FILED. Here the HP envelope is widened by
 * the full 32 in the safe direction, so the disagreement cannot manufacture a divergence. */
const SP_CAP = 32;
const NAT_UP = { at: 'Adamant', df: 'Impish', sa: 'Modest', sd: 'Calm', sp: 'Timid' };
const NAT_DOWN = { at: 'Modest', df: 'Hasty', sa: 'Adamant', sd: 'Naughty', sp: 'Brave' };
function neutralLine(bs) { return M.natureL50(bs, 'Serious'); }
function statEnvelope(bs, key, declaredNature) {
  const raw = neutralLine(bs)[key];
  if (declaredNature) {
    /* An open sheet declares the NATURE, which halves the envelope. The SP is still unknown. */
    const lo = M.natureStat(raw, declaredNature, key);
    const hi = M.natureStat(raw + SP_CAP, declaredNature, key);
    return { lo, hi, narrowed: true };
  }
  return { lo: M.natureStat(raw, NAT_DOWN[key], key),
           hi: M.natureStat(raw + SP_CAP, NAT_UP[key], key), narrowed: false };
}
function hpEnvelope(bs) { const h = neutralLine(bs).hp; return { lo: h, hi: h + SP_CAP }; }

/* ================= WALKING ONE GAME'S LOG INTO BOARDS =============================================
 * The store's own event stream, replayed into a per-slot state. Everything here is READ OFF THE
 * RECORD; nothing is inferred from our engine. This is the authority side of the comparison. */
const SLOTS = ['p1a', 'p1b', 'p2a', 'p2b'];
const foeSlots = (s) => (s.slice(0, 2) === 'p1' ? ['p2a', 'p2b'] : ['p1a', 'p1b']);
const allySlot = (s) => (s[2] === 'a' ? s.slice(0, 2) + 'b' : s.slice(0, 2) + 'a');

/* TAILWIND AND TRICK ROOM ARE DERIVABLE FROM THE RECORD EVEN THOUGH THE STORE HAS NO `-sidestart`.
 *
 * The store drops `|-sidestart|p1: Tailwind`, so a doubled side is invisible as STATE — but the MOVE
 * that set it is an `m` event, and the duration is a rule rather than an observation. Four turns for
 * Tailwind, five for Trick Room, and a second Trick Room CANCELS rather than refreshes.
 *
 * IT MATTERS BECAUSE OF WHAT IT WAS DOING TO THE ORDER COMPARATOR. Without it, a Charizard-Mega-Y
 * under a Tailwind that our board did not know about reads as "no legal Champions spread can produce
 * this order" — an accusation against the engine for a side condition the instrument had thrown away.
 * Trick Room is worse because it is wrong in BOTH directions: sticky-true never expires, and absent
 * never applies.
 *
 * THIS IS THE ONE PLACE THE INSTRUMENT INFERS RATHER THAN READS, so it is marked: a board carrying a
 * derived Tailwind or Trick Room says so, and the freeze dump prints it as `derived` beside the fields
 * that were read straight off the record. */
function blankBoard(game) {
  const b = { slot: {}, weather: null, weatherBy: null, weatherT: 0, terrain: null, tr: 0,
              tw: { p1: 0, p2: 0 }, derived: [] };
  const lead = game.lead || {};
  for (const side of ['p1', 'p2']) {
    const L = lead[side] || [];
    b.slot[side + 'a'] = L[0] ? { sp: L[0], hp: 100, status: '', boosts: {} } : null;
    b.slot[side + 'b'] = L[1] ? { sp: L[1], hp: 100, status: '', boosts: {} } : null;
  }
  return b;
}
function cloneBoard(b) {
  const o = { slot: {}, weather: b.weather, weatherBy: b.weatherBy, weatherT: b.weatherT || 0, terrain: b.terrain, tr: b.tr,
              tw: { p1: b.tw ? b.tw.p1 : 0, p2: b.tw ? b.tw.p2 : 0 }, derived: (b.derived || []).slice() };
  for (const s of SLOTS) o.slot[s] = b.slot[s] ? { sp: b.slot[s].sp, hp: b.slot[s].hp,
                                                  status: b.slot[s].status, boosts: Object.assign({}, b.slot[s].boosts) } : null;
  return o;
}
/* WHICH SLOT DID THIS MOVE EVENT HIT. The store names the target by SPECIES (the extractor writes
 * `slotSp[targetSlot]`), never by slot, so the slot has to be recovered. Foes first, then the ally
 * and the user's own slot for a heal or a self-hit. TWO SLOTS HOLDING THE SAME SPECIES IS AN
 * AMBIGUITY AND IS COUNTED — resolving it by picking one would be exactly the guessing this
 * instrument refuses. */
/* THE BASE FORME, MEMOISED. A mega resolves before the moves, so the record names the target as
 * `charizardmegay` while the board at the start of the turn still holds `charizard` — 29 of the first
 * run's target-slot failures were exactly that, reported as "the species could not be recovered" when
 * the species was right there one forme away. Compared on the BASE so the two spellings meet; a
 * genuine two-of-the-same-base board is still counted as an ambiguity below. */
const BASE_MEMO = new Map();
function baseOf(sp) {
  const raw = String(sp || '');
  if (BASE_MEMO.has(raw)) return BASE_MEMO.get(raw);
  const k = resolveKey(raw).key || id(raw);
  const b = String(k).replace(/-mega(-[xy])?$/, '').replace(/-primal$/, '');
  BASE_MEMO.set(raw, b);
  return b;
}
function targetSlotOf(board, userSlot, species, amb) {
  if (!species) return null;
  const want = baseOf(species);
  const cands = [];
  for (const s of foeSlots(userSlot).concat([allySlot(userSlot), userSlot])) {
    const o = board.slot[s];
    if (o && baseOf(o.sp) === want) cands.push(s);
  }
  if (cands.length > 1 && amb) amb.n++;
  return cands.length ? cands[0] : null;
}

/* Apply one turn's events to a board, returning the board AS IT STANDS AFTER the turn. This is the
 * authority's answer for the next comparison. */
/* ONE EVENT, APPLIED IN PLACE. THE COMPARISON WALKS THE TURN EVENT BY EVENT RATHER THAN SCORING IT
 * FROM THE OPENING BOARD, and that is not a refinement — it was producing false divergences of
 * exactly the kind this instrument exists to find.
 *
 * MEASURED on the first hundred games: `charizardmegay Weather Ball -> sylveon` scored `x4-plus — a
 * type chart or base-power error`. The sun was set BY THE MEGA'S DROUGHT, IN THAT SAME TURN, three
 * events before the Weather Ball. Priced from the opening board the sky was clear, so Weather Ball is
 * a 50 BP Normal move instead of a 100 BP Fire one, and the instrument accused the engine of a type
 * chart error over its own choice of clock. Boosts (an Intimidate on a switch-in, an Icy Wind), a
 * target already chipped earlier in the turn, and a mega all have the same shape. */
function stepEvent(b, e, amb) {
  if (e.t === 's') { b.slot[e.s] = { sp: e.mon, hp: 100, status: '', boosts: {} }; }
  else if (e.t === 'mega') { if (b.slot[e.s]) b.slot[e.s].sp = e.mon; }
  else if (e.t === 'hp') { if (b.slot[e.s]) b.slot[e.s].hp = e.hp; }
  else if (e.t === 'f') { if (b.slot[e.s]) b.slot[e.s].hp = 0; }
  else if (e.t === 'x') { if (b.slot[e.s]) b.slot[e.s].status = e.st; }
  else if (e.t === 'b') { if (b.slot[e.s]) b.slot[e.s].boosts = Object.assign({}, e.b); }
  /* WEATHER HAS A CLOCK AND THE FIRST VERSION LET IT RUN FOREVER, which is a speed bug rather than a
   * damage one. `-weather` is only emitted when the sky CHANGES, so a rain set on turn 2 stayed set
   * for the rest of the game — and `effSpeed` doubles Swift Swim and Chlorophyll under it. Both
   * published turn-order divergences were that: a Swampert-Mega priced at 162-268 and a Venusaur at
   * 180-290, each carrying a x2 from weather that had expired several turns earlier.
   *
   * FIVE TURNS, WHICH IS THE RULE AND NOT AN OBSERVATION, and the imprecision is stated: an extending
   * rock makes it eight and the record cannot tell us which. A weather older than five turns is
   * therefore CLEARED rather than kept, which is the direction that removes a multiplier rather than
   * inventing one. */
  else if (e.t === 'w') { b.weather = e.field; b.weatherBy = e.by || null; b.weatherT = 5; }
  else if (e.t === 'fs') {
    if (/trick\s*room/i.test(e.field)) { b.tr = b.tr > 0 ? 0 : 5; if (!b.derived.includes('trick room duration')) b.derived.push('trick room duration'); }
    else b.terrain = e.field;
  }
  else if (e.t === 'm') {
    if (id(e.mv) === 'tailwind' && !e.fail && !e.miss) {
      b.tw[e.s.slice(0, 2)] = 4;
      if (!b.derived.includes('tailwind (the store has no -sidestart; read off the MOVE)')) {
        b.derived.push('tailwind (the store has no -sidestart; read off the MOVE)');
      }
    }
    if (e.tgthp != null) {
      const ts = targetSlotOf(b, e.s, e.tgt, amb);
      if (ts && b.slot[ts]) b.slot[ts].hp = e.tgthp;
    }
  }
  return b;
}
function applyTurn(board, turn, amb) {
  const b = cloneBoard(board);
  for (const e of turn.ev || []) stepEvent(b, e, amb);
  /* The clocks tick at the turn boundary and NOT inside stepEvent, because a Tailwind set this turn
   * is up for this turn. Getting that backwards costs exactly one turn of doubled Speed, which is the
   * turn the order comparator is most likely to be looking at. */
  b.tr = Math.max(0, b.tr - 1);
  b.weatherT = Math.max(0, (b.weatherT || 0) - 1);
  if (!b.weatherT) { b.weather = null; b.weatherBy = null; }
  b.tw.p1 = Math.max(0, b.tw.p1 - 1);
  b.tw.p2 = Math.max(0, b.tw.p2 - 1);
  return b;
}

/* ================= BUILDING OUR ENGINE'S BODY FOR A SLOT ==========================================
 *
 * THE ITEM AND THE ABILITY ARE THE OBSERVED ONES OR NONE — NEVER THE TABLE'S DEFAULT. `buildMon`
 * falls back to `data/engine-data.js`'s modal item, which is a PRIOR. Feeding a prior into a
 * measurement of the ENGINE'S MECHANICS would let the dataset's guess about a Life Orb decide whether
 * the engine is right. Where the record never revealed the item, the body carries none and the event
 * is flagged `item_unknown`, so its verdict can be read separately.
 *
 * THE ABILITY IS DIFFERENT AND THE ASYMMETRY IS DELIBERATE. A missing item means "no item"; a missing
 * ability cannot mean "no ability", because every Pokemon has one. So an unrevealed ability keeps the
 * row's ability — declared, flagged, and reported. */
/* A SPECIES THE TABLE HAS NO ROW FOR IS NOT AUTOMATICALLY AN UNBUILDABLE BODY, and the difference is
 * three cosmetic formes and one broken Disguise. `mimikyu-busted`, `florges-white` and
 * `vivillon-fancy` are the SAME Pokemon as their base in every respect this instrument measures —
 * Mimikyu-Busted differs only in the doll being gone, which the record does not carry either. Each
 * fallback is COUNTED and named, because a silent species substitution is precisely how a measurement
 * comes to be about a different Pokemon; a fallback that starts firing on ORDINARY species is a broken
 * alias table and the counter is what says so. */
const SPECIES_FALLBACK = new Map();
function resolveKey(raw) {
  let key = null;
  try { key = mcKey(raw, { mayMiss: 'a stored game may name a forme MC.mons has no row for' }); }
  catch (e) { key = null; }
  if (key && MC.mons[key]) return { key, how: 'mc_key' };
  if (MC.mons[id(raw)]) return { key: id(raw), how: 'raw id' };
  /* DEHYPHENATED EXACT MATCH. `MC.mons` keys `charizard-mega-y` and the store normalises to
   * `charizardmegay`; `mcKey` bridges that through Showdown's dex, WHICH IS NOT INSTALLED ON EVERY
   * MACHINE — it prints "cosmetic-forme aliases unavailable" and returns null. That is a silent
   * capability loss of exactly the shape CLAUDE.md names, so there is a fallback that does not need
   * the simulator, and it is COUNTED so a machine running without Showdown does not look like a
   * machine with a broken alias table. */
  const flat = FLAT_MONS.get(id(raw));
  if (flat) { bump(SPECIES_FALLBACK, raw + ' -> ' + flat + '  (dehyphenated match)'); return { key: flat, how: 'dehyphenated' }; }
  /* LONGEST-PREFIX, for a COSMETIC forme the table does not carry a row for at all:
   * `sinistchamasterpiece`, `mausholdfour`, `florgeswhite`, `vivillonfancy`, `mimikyubusted`. Every
   * one is the same Pokemon as its base in every respect this instrument measures. Longest first so a
   * genuine forme with its own row always wins, and every mapping is printed in the artifact — this is
   * the one place a wrong answer would silently make the measurement about a different Pokemon. */
  const q = id(raw);
  let best = null;
  for (const [fk, real] of FLAT_MONS) {
    if (fk.length < 4 || fk.length >= q.length) continue;
    if (q.startsWith(fk) && (!best || fk.length > best[0].length)) best = [fk, real];
  }
  if (best) { bump(SPECIES_FALLBACK, raw + ' -> ' + best[1] + '  (cosmetic forme; base used)'); return { key: best[1], how: 'cosmetic prefix' }; }
  return { key: null, how: 'MISS' };
}
const FLAT_MONS = (() => {
  const m = new Map();
  for (const k of Object.keys(MC.mons || {})) {
    const f = id(k);
    /* First writer wins so a base forme is never displaced by a longer key that flattens to the
     * same string. There is no such collision today; the rule is here so there cannot be one. */
    if (!m.has(f)) m.set(f, k);
  }
  return m;
})();

function bodyFor(species, sets, opts) {
  const raw = String(species || '');
  const rk = resolveKey(raw);
  if (!rk.key) return null;
  const key = rk.key;
  const b = M.buildMon(key, {});
  if (!b) return null;
  const set = (sets && (sets[raw] || sets[key])) || null;
  const flags = { item_unknown: false, ability_unknown: false, moves_known: 0 };
  if (set && set.item) b.item = id(set.item); else { b.item = ''; flags.item_unknown = true; }
  if (set && set.ability) b.ability = id(set.ability); else flags.ability_unknown = true;
  if (set && set.moves && set.moves.length) {
    b.moves = set.moves.map(id).slice(0, 4);
    flags.moves_known = b.moves.length;
  }
  b._replayFlags = flags;
  b._replaySpecies = raw;
  b._replayKey = key;
  b._replayBS = (MC.mons[key] && MC.mons[key].bs) || null;
  b._replayNature = (opts && opts.nature) || null;
  return b;
}

/* Put a log-derived slot state onto a live engine body. */
function dressBody(b, st) {
  if (!b || !st) return b;
  b.curHP = Math.max(0, Math.round(b.st.hp * (st.hp / 100)));
  b.fainted = st.hp <= 0;
  b.status = st.status === 'tox' ? 'tox' : (st.status || '');
  const bo = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 };
  const K = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp', accuracy: 'acc', evasion: 'eva' };
  for (const k of Object.keys(st.boosts || {})) { const kk = K[k] || k; if (kk in bo) bo[kk] = st.boosts[k]; }
  b.boosts = bo;
  return b;
}
function fieldFor(board) {
  const w = board.weather ? M.weatherId(board.weather) : '';
  const t = board.terrain ? M.terrainId(board.terrain) : '';
  return { weather: w || null, weatherT: w ? (board.weatherT || 5) : 0, terrain: t || '', terrainT: t ? 5 : 0,
           twA: (board.tw && board.tw.p1) || 0, twB: (board.tw && board.tw.p2) || 0,
           tr: board.tr || 0, sgA: {}, sgB: {} };
}

/* ================= THE DAMAGE COMPARATOR — DICE-FREE, ALL SIXTEEN ROLLS ===========================
 *
 * Returns one verdict for one damaging click. Nothing here rolls a die: `dmgRange`'s `hit.rolls`
 * out-parameter yields the whole spread, and the crit and spread states are READ OFF THE RECORD
 * rather than sampled — a crit is always announced, so its absence is knowledge and not a guess. */
const MULTIHIT_HINT = /(bulletseed|rockblast|iciclespear|pinmissile|tailslap|bonerush|doublehit|dualwingbeat|twineedle|doublekick|tripleaxel|triplekick|watershuriken|surgingstrikes|populationbomb|scaleshot|armthrust|cometpunch|furyattack|furyswipes|doubleironbash|gearrind|tripledive|dragondarts)/;
const FIXED_HINT = /(seismictoss|nightshade|dragonrage|sonicboom|superfang|naturesmadness|ruination|endeavor|finalgambit|guillotine|horndrill|fissure|sheercold|psywave|counter|mirrorcoat|metalburst|comeuppance|bide)/;

/* The guard family. Named here rather than tag-matched because `oneTurnGuard` lives in the engine's
 * own tag reader and this file has no TAGS handle; it is the one name list in this file and it is
 * flagged as such. Silk Trap, Obstruct and Burning Bulwark are BANNED in Champions and are absent on
 * purpose — the ban is read from the format, not from memory (CLAUDE.md). */
const GUARD = /^(protect|detect|spikyshield|banefulbunker|kingsshield|maxguard|wideguard|quickguard|craftyshield)$/;

function rollsFor(att, def, mv, field, spread, crit) {
  const hit = { rolls: [] };
  M.dmgRange(att, def, mv, field, !!spread, !!crit, hit);
  return (hit.rolls || []).slice();
}

function damageVerdict(ctx) {
  const { ev, att, def, mvRow, field, spread, board, tSlot } = ctx;
  const out = { verdict: null, why: null, span: null, observed: null, width: null };
  const mvId = id(ev.mv);

  if (MULTIHIT_HINT.test(mvId)) { out.verdict = 'unresolved'; out.why = 'multi-hit — the record sums the hits'; return out; }
  if (FIXED_HINT.test(mvId)) { out.verdict = 'unresolved'; out.why = 'fixed / level / counter damage, not a roll'; return out; }
  if (!mvRow || !mvRow.bp) { out.verdict = 'unresolved'; out.why = 'no base power in MC.moves'; return out; }
  if (!tSlot) { out.verdict = 'unresolved'; out.why = 'target slot could not be recovered from the species'; return out; }

  const obs = ev.dmg;
  const preHP = ctx.targetPreHP;
  const wasKO = !!ev.ko || ev.tgthp === 0;

  /* THE ENVELOPE CORNERS. The low corner is the weakest legal attacker into the bulkiest legal
   * defender with the largest legal HP pool; the high corner is the reverse. Both are evaluated by
   * the ENGINE'S OWN damage chain — the bodies are mutated and dmgRange is called, so no linearity in
   * the stat is assumed anywhere. */
  const aBS = att._replayBS, dBS = def._replayBS;
  if (!aBS || !dBS) { out.verdict = 'unresolved'; out.why = 'no base stats row for one of the bodies'; return out; }
  const physical = String(mvRow.c || '').toUpperCase() === 'P';
  const aKey = physical ? 'at' : 'sa';
  const dKey = physical ? 'df' : 'sd';
  const aEnv = statEnvelope(aBS, aKey, att._replayNature);
  const dEnv = statEnvelope(dBS, dKey, def._replayNature);
  const hEnv = hpEnvelope(dBS);

  const saveA = Object.assign({}, att.st), saveD = Object.assign({}, def.st), saveHP = def.curHP;
  let lowRolls, highRolls;
  try {
    att.st[aKey] = aEnv.lo; def.st[dKey] = dEnv.hi; def.st.hp = hEnv.hi; def.curHP = hEnv.hi;
    lowRolls = rollsFor(att, def, mvRow, field, spread, !!ev.crit);
    att.st[aKey] = aEnv.hi; def.st[dKey] = dEnv.lo; def.st.hp = hEnv.lo; def.curHP = hEnv.lo;
    highRolls = rollsFor(att, def, mvRow, field, spread, !!ev.crit);
  } finally {
    att.st = saveA; def.st = saveD; def.curHP = saveHP;
  }
  if (!lowRolls.length || !highRolls.length) { out.verdict = 'unresolved'; out.why = 'dmgRange returned no rolls'; return out; }

  /* Percent of the defender's maximum, which is how the record states it. Low corner over the LARGEST
   * pool, high corner over the SMALLEST — the widest honest interval. */
  const loPct = Math.min(...lowRolls) / hEnv.hi * 100;
  const hiPct = Math.max(...highRolls) / hEnv.lo * 100;
  /* ONE POINT OF SLACK EACH SIDE, because the record's `dmg` is a difference of two INTEGER percents
   * and each rounding can move it by up to half a point. */
  const lo = loPct - 1, hi = hiPct + 1;
  out.span = [+loPct.toFixed(2), +hiPct.toFixed(2)];
  out.observed = obs;
  out.width = +(hiPct - loPct).toFixed(2);
  SPAN_WIDTH.push(out.width);

  /* A KO CLAMPS THE RECORD. Showdown reports the HP actually lost, so a lethal hit reads as the
   * target's remaining HP and not as the damage the move would have dealt. The test becomes
   * one-sided: could our engine have killed it at all. */
  /* A KO CLAMPS THE RECORD, AND THE FIRST VERSION READ THE CLAMP OFF THE WRONG NUMBER.
   *
   * It compared our maximum against the target's HP as RECONSTRUCTED by this file's running board,
   * and that board can be wrong inside a turn — a spread move writes one `tgthp` for two victims, so
   * the second one's HP is not updated. The record states the answer directly: on a KO the extractor
   * writes `dmg = max(dmg, hp-before)`, which IS the HP the body actually had. Using it turns the test
   * back into the one-sided question it should always have been: could our maximum roll have removed
   * that much.
   *
   * MEASURED: this alone was 56 of 158 divergences at 300 games, and both published examples were
   * plainly wrong on their face — `weavile Flamethrower -> sneasler, observed 8, our span 7.5-31.0`
   * was reported as a KO we could not reach while 8 sat inside the interval. A top mechanic that is an
   * arithmetic error in the instrument is exactly what a differential is supposed to stop happening
   * to somebody else. */
  if (wasKO) {
    const lost = obs != null && obs > 0 ? obs : preHP;
    if (lost == null) { out.verdict = 'unresolved'; out.why = 'a KO with no recorded HP loss to bound it'; return out; }
    if (hi >= lost) { out.verdict = 'clamped_ok'; }
    else { out.verdict = 'no-match'; out.why = 'the record shows a KO our maximum roll cannot reach'; out.ratio = +(lost / ((loPct + hiPct) / 2 || 1)).toFixed(3); }
    return out;
  }

  if (obs === 0) {
    if (ev.immune || ev.miss || ev.fail || ev.blockedBy || ev.charging) { out.verdict = 'unresolved'; out.why = 'the move did not connect'; return out; }
    /* A CONNECTED MOVE THAT DEALT NOTHING. Substitute is the usual cause and the store cannot see one.
     * Its own bucket, never folded into a pass. */
    /* A CONNECTED MOVE THAT DEALT NOTHING SPLITS INTO TWO VERY DIFFERENT FACTS, and the first version
     * put 106 of them in one bucket. If the target CLICKED A GUARD in the same turn the record
     * explains itself — that is a Protect, and it is not evidence about the damage chain. If it did
     * not, the usual cause is a Substitute, which the store cannot record at all. Naming them apart is
     * the difference between a limitation and a mystery. */
    if (hiPct > 0) {
      out.verdict = 'unresolved';
      out.why = ctx.targetGuarded ? 'the target clicked a guard this turn (Protect family) — blocked, not a damage test'
                                  : 'connected but dealt 0 — Substitute / doll / unseen block';
      return out;
    }
    out.verdict = 'matched'; return out;
  }
  if (hiPct === 0 && obs > 0) { out.verdict = 'no-match'; out.why = 'our engine says this move cannot damage this target at all'; return out; }

  if (obs >= lo && obs <= hi) {
    /* Inside. Is it inside NARROWLY enough to have identified a roll? Only if the envelope collapsed,
     * which on this corpus it never does — reported rather than assumed. */
    const oneStep = (hiPct - loPct) / 16;
    out.verdict = (out.width <= 2 && oneStep >= 0.5) ? 'matched' : 'ambiguous';
    return out;
  }
  out.verdict = 'no-match';
  out.why = obs < lo ? 'observed BELOW everything our engine can produce'
                     : 'observed ABOVE everything our engine can produce';
  out.ratio = +(obs / ((loPct + hiPct) / 2 || 1)).toFixed(3);
  return out;
}

/* THE RATIO BUCKET IS THE MECHANIC HYPOTHESIS. A cluster at ~0.5 is a screen we cannot see; at ~2.0 a
 * type or weather multiplier we are missing; at ~1.3 an unrevealed Life Orb. Naming the bucket is what
 * turns "37 no-matches" into something somebody can act on. */
function ratioBucket(r) {
  if (r == null) return 'unknown';
  if (r < 0.18) return 'x0.125-ish — a resist chain or an ability halving we apply and the game did not';
  if (r < 0.36) return 'x0.25-ish — two resists, or a doubled resist we invented';
  if (r < 0.62) return 'x0.5-ish — ONE HALVING WE APPLY AND THE GAME DID NOT, or a screen the store cannot record';
  if (r < 0.85) return 'x0.75-ish — spread reduction, Multiscale, or a defensive item we invented';
  if (r < 1.18) return 'near 1 — inside the roll band but outside the spread envelope; small chain error';
  if (r < 1.45) return 'x1.3-ish — an unrevealed Life Orb / boosting item, or a power modifier we miss';
  if (r < 1.75) return 'x1.5-ish — STAB, sun/rain, or a boost stage we did not apply';
  if (r < 2.6) return 'x2-ish — A TYPE OR WEATHER MULTIPLIER WE ARE MISSING';
  return 'x4-plus — a type chart or base-power error';
}

/* ================= TURN ORDER — ROADMAP #43, AND NOTHING HAS EVER READ IT =========================
 *
 * The order of the `m` events IS the resolution order. Our engine's order is a function of priority
 * and effective speed, both exported and both dice-free. Where the two engines' speeds are EQUAL the
 * outcome is a coin and the unit is refused, counted, and not scored — a tie we happen to match is not
 * evidence and a tie we happen to miss is not a defect.
 *
 * THE SPEED ENVELOPE APPLIES HERE TOO, AND LEAVING IT OUT WAS THE FIRST VERSION'S BIGGEST ERROR. The
 * first run scored 33 of 77 turns as an ORDER divergence, and the top witness was a Kingambit moving
 * before a Sylveon it is 10 points slower than on a flat build — which is a Kingambit carrying Speed
 * SP, not an engine defect. Speed is exactly as unknown as Attack is. So an order is only scored as a
 * DIFFERENCE when the two bodies' attainable speed intervals are DISJOINT, i.e. when no legal
 * Champions spread could have produced the observed order. Everything else is `spread` and is refused.
 * That is the same one-sided discipline the damage test uses, applied to the second axis. */
/* ABILITIES THAT MOVE PRIORITY, READ OFF THE TAG ARTIFACT AND NOT OFF A LIST OF NAMES. `movePriority`
 * takes a move and a field and knows nothing about the user, so a Prankster Whimsicott's Tailwind is
 * priced at 0 here and at +1 in the game. That was the top witness in the first run's order
 * divergences — three of the six, plus the one PRIORITY row — and it is the instrument, not the
 * engine. A turn in which any acting body carries one is REFUSED rather than scored.
 *
 * MATCHED ON TAG SHAPE, so an ability added later is picked up without editing this file (CLAUDE.md).
 * `quickdraw` is tagged `untagged` in data/tags.json and is therefore INVISIBLE to this refusal — that
 * is a tag-artifact gap, it is FILED to ENGINE rather than patched here with a name, and it is stated
 * so nobody reads the order figure as covering it. */
const PRIORITY_MOD = (() => {
  const s = new Set();
  try {
    const t = JSON.parse(REL.read('data/tags.json'));
    for (const kind of ['abilities', 'items', 'moves']) {
      for (const k of Object.keys(t[kind] || {})) {
        if ((t[kind][k].tags || []).indexOf('priorityMod') >= 0) s.add(kind + ':' + k);   // 'abilities:prankster' — the SECTION name, matched below
      }
    }
  } catch (e) { console.error('  !! tags.json did not parse — the priority-ability refusal is OFF and every '
    + 'order figure below is contaminated by Prankster: ' + e.message); }
  return s;
})();

function orderVerdict(clicks, field) {
  const acting = clicks.filter(c => c.body && c.mv);
  if (acting.length < 2) return { verdict: 'n/a', why: 'fewer than two recorded moves' };
  for (const c of acting) {
    if (PRIORITY_MOD.has('abilities:' + id(c.body.ability || '')) || PRIORITY_MOD.has('items:' + id(c.body.item || ''))) {
      return { verdict: 'ability-priority', why: c.body._replaySpecies + ' carries ' + c.body.ability
        + ', which moves priority in a way movePriority() cannot see from a move id alone' };
    }
  }
  const scored = acting.map((c, i) => {
    let pri = 0;
    try { pri = M.movePriority(c.mv, field) || 0; } catch (e) { pri = 0; }
    const bs = c.body._replayBS;
    const env = bs ? statEnvelope(bs, 'sp', c.body._replayNature) : null;
    const save = c.body.st.sp;
    let lo = save, hi = save;
    try {
      if (env) { c.body.st.sp = env.lo; lo = M.effSpeed(c.body, field, c.side === 'p1' ? 'A' : 'B');
                 c.body.st.sp = env.hi; hi = M.effSpeed(c.body, field, c.side === 'p1' ? 'A' : 'B'); }
      else { lo = hi = M.effSpeed(c.body, field, c.side === 'p1' ? 'A' : 'B'); }
    } catch (e) { lo = hi = save; } finally { c.body.st.sp = save; }
    return { i, logIdx: c.logIdx, pri, spdLo: lo, spdHi: hi, who: c.body._replaySpecies, mv: c.mv };
  });
  /* The order the record shows. Under Trick Room the comparison inverts, and TR is in the record. */
  const logSeq = scored.slice().sort((a, b) => a.logIdx - b.logIdx);
  const trick = !!(field && field.tr > 0);
  let sawUndecidable = false;
  for (let k = 0; k + 1 < logSeq.length; k++) {
    const A = logSeq[k], B = logSeq[k + 1];
    if (A.pri !== B.pri) {
      if (A.pri < B.pri) return { verdict: 'differ', why: 'PRIORITY — the record moved a lower-priority '
        + 'move first', logSeq, scored };
      continue;                                  // priority settled it and we agree
    }
    /* Same priority: the record says A outsped B. Could any legal pair of spreads produce that? */
    const possible = trick ? (A.spdLo <= B.spdHi) : (A.spdHi >= B.spdLo);
    if (!possible) return { verdict: 'differ', logSeq, scored,
      why: 'SPEED — no legal Champions spread lets ' + A.who + ' move before ' + B.who
         + ' (our attainable speeds: ' + A.spdLo + '-' + A.spdHi + ' vs ' + B.spdLo + '-' + B.spdHi + ')' };
    /* It is possible, but is it FORCED? Only then does an agreement mean anything. */
    const forced = trick ? (A.spdHi <= B.spdLo) : (A.spdLo >= B.spdHi);
    if (!forced) sawUndecidable = true;
  }
  if (sawUndecidable) return { verdict: 'spread', why: 'the observed order is inside the legal spread '
    + 'envelope — consistent with our engine, and not evidence for it', logSeq, scored };
  return { verdict: 'agree', logSeq, scored };
}
const ORDER = { agree: 0, differ: 0, spread: 0, 'ability-priority': 0, tie: 0, 'n/a': 0 };

/* ================= THE TURN-EFFECT COMPARATOR — A ONE-SIDED REACHABILITY PROBE ====================
 *
 * The question is deliberately one-sided: THE RECORD SHOWS AN EFFECT — CAN OUR ENGINE PRODUCE IT AT
 * ALL. It is asked by resolving the turn under a small ladder of fixed pins and taking the UNION of
 * what happened. The pins are chosen at the thresholds a battle actually asks:
 *
 *     0.00   every sub-100 move HITS, every secondary FIRES, every crit lands, MIN damage
 *            — and every paralysed body is FULLY paralysed (`rng()<0.125`), which is why one pin is
 *              not enough and why this was nearly a silent bug
 *     0.13   paralysis passes, no crit, secondaries at 14%+ fire
 *     0.50   the middle
 *     0.90   near the top of the band
 *
 * IT IS NOT A DISTRIBUTION AND MUST NOT BE READ AS ONE. Six fixed values cannot estimate a rate;
 * they can only answer "is this outcome reachable". The rate question is the DEFERRED aggregate test
 * described in the header, and conflating the two would be exactly the vacuous green this instrument
 * exists to prevent. The reverse direction — our engine produced something the record does not show —
 * is NOT scored, because under a pin that forces every secondary it would fire constantly and mean
 * nothing.
 *
 * 0.05 IS THE ONE THAT MATTERS AND IT WAS MISSING, and a freeze dump is what found it. `par landed on
 * incineroar and our engine never applies it` had `status_reachable: []` and `fainted_reachable:
 * ['p2b']` — the par came from a 10% Thunderbolt secondary, and at pin 0.00 the OTHER side's Throat
 * Chop critted (every crit lands at 0) and killed the Thunderbolt user before it could move. At 0.13
 * the crit is gone but a 10% secondary no longer fires (13 >= 10). Neither pin could reach it. At 0.05
 * the crit does not land (0.05 > 1/24) and a 10% secondary does (5 >= 10 is false), which is exactly
 * the corner a 10% secondary lives in. THE ONE PIN THAT WOULD HAVE CAUGHT IT WAS THE ONE NOT IN THE
 * LADDER, and that is the shape of every sample-size failure in this repository. */
const PINS = [0, 0.05, 0.13, 0.5, 0.9, 0.999];

function reachableEffects(game, board, clicks, sets, megaHere, natures) {
  const seen = { status: new Set(), weather: new Set(), fainted: new Set(), moved: new Set() };
  let threw = null;
  for (const p of PINS) {
    let S;
    try {
      const teams = { p1: [], p2: [] };
      const slotOf = new Map();
      for (const side of ['p1', 'p2']) {
        for (const s of [side + 'a', side + 'b']) {
          const st = board.slot[s];
          if (!st) { teams[side].push(null); continue; }
          /* THE SAME MEGA SUBSTITUTION THE DAMAGE COMPARATOR MAKES. It was missing here on the first
           * run and the cost was eight false "the record set SunnyDay and our engine did not" in
           * twenty games: this probe was building a BASE Charizard, which has no Drought, while the
           * damage side was correctly building the evolved one. Two readers of one board must build
           * the same body or the instrument disagrees with itself. */
          const sp = (megaHere && megaHere.get(s)) || st.sp;
          const b = bodyFor(sp, sets, { nature: (natures && (natures[id(sp)] || natures[id(st.sp)])) || null });
          if (!b) { teams[side].push(null); continue; }
          dressBody(b, st);
          slotOf.set(b, s);
          teams[side].push(b);
        }
      }
      const A = teams.p1.filter(Boolean), B = teams.p2.filter(Boolean);
      if (!A.length || !B.length) return { seen, threw: null, ran: false };
      S = M.battleInit(A, B, { autoMega: false });
      S.maxTurns = 999;
      /* THE ENTRY EFFECTS ARE PART OF THE ANSWER AND OVERWRITING THEM WAS A BUG. `battleInit` applies
       * entry abilities, so a Drought Charizard-Mega-Y sets the sun right here — and the first version
       * then blanked `S.field` from the log-derived board and reported "the record set SunnyDay and
       * our engine did not" nine times in twenty games. The engine had set it and the instrument had
       * erased it one line later. The log's weather now OVERRIDES only when the log HAS one; an entry
       * effect that fired into an empty sky is kept and counted as reachable. */
      const entryWeather = S.field.weather || null;
      if (entryWeather) seen.weather.add(entryWeather);
      const lf = fieldFor(board);
      for (const k of ['terrain', 'terrainT', 'tr', 'twA', 'twB']) S.field[k] = lf[k];
      if (lf.weather) { S.field.weather = lf.weather; S.field.weatherT = lf.weatherT; }
      const mapFor = (own, foes, side) => {
        const m = new Map();
        own.forEach((mon, i) => {
          const c = clicks.find(x => x.body && slotOf.get(x.bodyProto) === undefined && false);
          void c;
          const slot = slotOf.get(mon);
          const click = clicks.find(x => x.slot === slot);
          if (!click || !click.mv) { m.set(mon, { kind: 'pass' }); return; }
          const tgt = click.tgtSlot ? own.concat(foes).find(z => slotOf.get(z) === click.tgtSlot) : null;
          let pa = null;
          try { pa = M.playerAction(mon, click.mv, tgt || null, S.field); } catch (e) { pa = null; }
          m.set(mon, pa || { kind: 'pass' });
        });
        return m;
      };
      M.battleTurn(S, () => p, mapFor(S.actA, S.actB, 'p1'), mapFor(S.actB, S.actA, 'p2'));
      for (const mon of S.actA.concat(S.actB)) {
        if (!mon) continue;
        const s = slotOf.get(mon);
        if (mon.status) seen.status.add(s + ':' + mon.status);
        if (mon.fainted || mon.curHP <= 0) seen.fainted.add(s);
      }
      if (S.field.weather) seen.weather.add(S.field.weather);
    } catch (e) {
      threw = String((e && e.message) || e).slice(0, 200);
    }
  }
  return { seen, threw, ran: true };
}

/* ================= RECONSTRUCTING THE CLICKS ======================================================
 * The choice is the move id off the `m` event plus the SLOT its named target occupied. Confidence is
 * recorded per click, because Will's freeze dump has to say how sure the reconstruction was — a board
 * that differs because we fed it the wrong click is not an engine defect. */
function reconstructClicks(board, turn, sets, amb) {
  const clicks = [];
  const byslot = new Map();
  (turn.ev || []).forEach((e, i) => {
    if (e.t !== 'm') return;
    if (byslot.has(e.s)) return;       // the first recorded move of the turn for that slot
    byslot.set(e.s, true);
    const st = board.slot[e.s];
    const tSlot = targetSlotOf(board, e.s, e.tgt, amb);
    clicks.push({
      slot: e.s, side: e.s.slice(0, 2), mv: id(e.mv), mvName: e.mv,
      tgtSpecies: e.tgt || null, tgtSlot: tSlot, logIdx: i,
      confidence: !st ? 'NO-BODY-IN-SLOT'
                : (!e.tgt ? 'move-only (no target named — spread, self or field)'
                : (tSlot ? 'move + slot recovered' : 'TARGET SLOT NOT RECOVERED')),
      raw: e,
    });
  });
  /* A slot that is occupied and produced no `m` event. The store has no `cant` event, so flinched,
   * fully paralysed, asleep, frozen, recharging and "switched out" are one indistinguishable bucket. */
  for (const s of SLOTS) {
    if (byslot.has(s)) continue;
    if (!board.slot[s] || board.slot[s].hp <= 0) continue;
    const switched = (turn.ev || []).some(e => e.t === 's' && e.s === s);
    clicks.push({ slot: s, side: s.slice(0, 2), mv: null, tgtSlot: null, logIdx: 999,
                  confidence: switched ? 'switched out (no move to reconstruct)'
                                       : 'NO CLICK RECORDED — the store has no `cant` event, so flinch / '
                                       + 'full-para / sleep / freeze / recharge are indistinguishable' });
  }
  return clicks;
}

/* ================= THE FREEZE DUMP ================================================================ */
const FREEZES = [];
function freeze(game, turnNo, board, after, ourAfter, clicks, turn, diffs, mechs) {
  if (FREEZES.length >= FREEZE_CAP * 4) return;
  FREEZES.push({
    game: game.id, turn: turnNo, date: game.date, format: game.format,
    replay: 'https://replay.pokemonshowdown.com/' + String(game.id || ''),
    open_sheet: !!game.openSheet,
    mechanics: mechs,
    board_before: board,
    clicks: clicks.map(c => ({ slot: c.slot, move: c.mvName || null, target_species: c.tgtSpecies || null,
                               target_slot: c.tgtSlot || null, reconstruction: c.confidence })),
    board_after_LOG: after,
    board_after_OURS: ourAfter,
    fields_that_differ: diffs,
    raw_log_events_this_turn: (turn.ev || []),
  });
}

/* ================= ONE GAME ====================================================================== */
function replayGame(game, opt) {
  const res = { turns: 0, compared: 0, diverged: 0 };
  const POP = SPLIT[population(game)];
  const sets = game.sets || {};
  /* Open sheets declare a NATURE, which narrows the envelope. They do NOT declare SP — measured: 884
   * of 52,089 stored games carry a sheet and every one has `evs: null`. */
  const natures = {};
  for (const side of ['p1', 'p2']) {
    const sh = (game.sheets && game.sheets[side]) || null;
    if (!sh) continue;
    for (const e of sh) if (e.species && e.nature) natures[id(e.species)] = e.nature;
  }
  if (!game.turns || !game.turns.length) { bump(SKIP_REASON, 'no turns recorded'); return null; }
  if (!game.lead || !game.lead.p1 || !game.lead.p2 || game.lead.p1.length < 1 || game.lead.p2.length < 1) {
    bump(SKIP_REASON, 'no leads recorded — the opening board cannot be built'); return null;
  }
  /* EVERY BODY THE GAME EVER SHOWS MUST BE BUILDABLE, decided BEFORE any turn is scored. A game that
   * loses a body halfway through would otherwise contribute turns and then vanish, which makes the
   * denominator a function of where the failure happened. */
  const species = new Set();
  for (const side of ['p1', 'p2']) for (const s of (game.brought && game.brought[side]) || []) species.add(s);
  for (const t of game.turns) for (const e of t.ev || []) { if (e.mon) species.add(e.mon); if (e.tgt) species.add(e.tgt); }
  for (const sp of species) {
    if (!bodyFor(sp, sets, {})) { bump(SKIP_REASON, 'a body in this game is unbuildable: ' + sp); return null; }
  }

  let board = blankBoard(game);
  /* THE LEADS' ENTRY WEATHER IS NOT IN THE STORE, AND THAT IS AN INGEST DEFECT WITH A REAL COST.
   * Showdown emits `|-weather|SunnyDay|[from] ability: Drought` BEFORE `|turn|1`, and
   * `engine/durable-ingest.js` only attaches events once a `|turn|` line has opened a bucket — so a
   * Torkoal or a Charizard-Mega-Y that leads sets a sun the record never mentions. Measured: it made
   * `torkoal Weather Ball` read `x4-plus — a type chart or base-power error` three times in a hundred
   * games, because a 100 BP Fire move was being priced as a 50 BP Normal one.
   *
   * SEEDED FROM OUR OWN ENGINE'S ENTRY EFFECTS AND MARKED `derived`, WHICH IS A REAL COST STATED
   * PLAINLY: the weather comparator cannot catch a lead-set weather we get wrong, because we supplied
   * it. That is the honest trade against pricing every sun move in clear skies. The fix belongs in the
   * ingest and is FILED. */
  try {
    const lead = [];
    for (const side of ['p1', 'p2']) for (const s of [side + 'a', side + 'b']) {
      const st = board.slot[s]; if (st) { const b = bodyFor(st.sp, sets, {}); if (b) lead.push([s, b]); }
    }
    const A = lead.filter(x => x[0][1] === '1').map(x => x[1]);
    const B = lead.filter(x => x[0][1] === '2').map(x => x[1]);
    if (A.length && B.length) {
      const S0 = M.battleInit(A, B, { autoMega: false });
      if (S0.field.weather) {
        board.weather = S0.field.weather; board.weatherT = 5;
        board.derived.push('the LEADS\' entry weather (' + S0.field.weather + ') — the store drops every '
          + 'event before |turn|1, so this is our engine\'s answer and the weather comparator cannot '
          + 'test it on turn 1');
      }
      if (S0.field.terrain) { board.terrain = S0.field.terrain; board.derived.push('the leads\' entry terrain'); }
    }
  } catch (e) { C.exceptions++; bump(EXCEPTIONS, 'lead entry effects: ' + String(e.message).slice(0, 120)); }
  const amb = { n: 0 };
  /* THE SIDE'S DEAD, walked from the record. Feeds Last Respects and Supreme Overlord. */
  const faints = { p1: 0, p2: 0 };
  for (const turn of game.turns) {
    res.turns++; C.turns_seen++;
    if (TURN1_ONLY && turn.n !== 1) break;
    const after = applyTurn(board, turn, amb);
    let clicks;
    try { clicks = reconstructClicks(board, turn, sets, amb); }
    catch (e) { C.exceptions++; bump(EXCEPTIONS, 'reconstructClicks: ' + String(e.message).slice(0, 120)); board = after; continue; }

    const field = fieldFor(board);
    const mechsHere = [];
    let diverged = false;

    /* ---- bodies for this turn's board, built once and shared by both comparators ----
     *
     * THE MEGA IS APPLIED BEFORE ANYTHING IS SCORED, and leaving it out was the first version's
     * second-biggest error. A mega resolves before any move in the turn, so a turn whose record
     * contains a `mega` event was played by the EVOLVED body — different stats, different typing and,
     * critically, a DIFFERENT ABILITY. The first run scored a `charizard Heat Wave -> incineroar` at
     * "x4-plus — a type chart or base-power error" purely because it priced a base Charizard's Heat
     * Wave with no Drought and no sun. It was measuring its own omission. */
    const bodies = {};
    const megaHere = new Map();
    for (const e of (turn.ev || [])) if (e.t === 'mega' && e.s && e.mon) megaHere.set(e.s, e.mon);
    for (const s of SLOTS) {
      const st = board.slot[s];
      if (!st) { bodies[s] = null; continue; }
      const sp = megaHere.get(s) || st.sp;
      let b = null;
      try { b = bodyFor(sp, sets, { nature: natures[id(sp)] || natures[id(st.sp)] || null }); } catch (e) { b = null; }
      if (b) { dressBody(b, st); b._replayMegaed = megaHere.has(s); }
      bodies[s] = b;
    }
    for (const c of clicks) { c.body = bodies[c.slot] || null; c.mvRow = c.mv ? MC.moves[c.mv] : undefined; }

    /* ---- COMPARATOR D: damage, dice-free, all sixteen rolls, WALKED EVENT BY EVENT ----
     * `run` is the board as it stood immediately BEFORE the event being scored. See stepEvent for the
     * receipt on why scoring from the opening board manufactured divergences. */
    let run = cloneBoard(board);
    const bodyAt = (slot) => {
      const st = run.slot[slot];
      if (!st) return null;
      let b = null;
      try { b = bodyFor(st.sp, sets, { nature: natures[id(st.sp)] || null }); } catch (x) { b = null; }
      if (!b) return null;
      dressBody(b, st);
      /* THE SIDE'S DEAD, WHICH THE RECORD DOES KNOW. Last Respects and Supreme Overlord read
       * `_sf.fainted`, and a rebuilt body has no side object at all — so a Basculegion five bodies
       * into a sweep was priced at base 50 and the record's real number read as `x4-plus — a type
       * chart or base-power error`. It was the top witness in the first hundred games. The count is
       * derived by walking `f` events, which is the only place the record states it. */
      const sd = slot.slice(0, 2);
      b._sf = { fainted: faints[sd] || 0, side: sd === 'p1' ? 'A' : 'B', sc: {}, team: [] };
      b._fallenStuck = faints[sd] || 0;
      return b;
    };
    for (const e of (turn.ev || [])) {
      if (e.t !== 'm') { stepEvent(run, e, amb); if (e.t === 'f') faints[e.s.slice(0, 2)]++; continue; }
      const field = fieldFor(run);
      const mvRow0 = MC.moves[id(e.mv)];
      const fx = (() => { try { return M.moveFx(id(e.mv)); } catch (x) { return null; } })();
      /* NOT EVERY MOVE EVENT IS A DAMAGE UNIT, and counting the ones that are not as `unresolved`
       * inflated that rate to 51% on the first run and made the headline unreadable. A Protect, a
       * Tailwind or a Trick Room is not an unresolved damage comparison — it is not a damage
       * comparison. They are tallied separately so the denominator means one thing. */
      if (!mvRow0 || !mvRow0.bp) {
        if (e.dmg) { DMG.unresolved++; bump(DMG_UNRESOLVED, 'the record shows damage and MC.moves has no base power for ' + id(e.mv)); }
        else bump(NOT_A_DAMAGE_UNIT, 'status / field move — no base power');
        stepEvent(run, e, amb); continue;
      }
      if (!e.dmg) {
        if (e.miss) { bump(NOT_A_DAMAGE_UNIT, 'the move MISSED (recovered from the record, not simulated)'); stepEvent(run, e, amb); continue; }
        if (e.immune) { bump(NOT_A_DAMAGE_UNIT, 'the move was IMMUNE-blocked'); stepEvent(run, e, amb); continue; }
        if (e.fail || e.blockedBy || e.charging) { bump(NOT_A_DAMAGE_UNIT, 'the move failed / was blocked / was charging'); stepEvent(run, e, amb); continue; }
      }
      /* A MOVE WHOSE BASE POWER DEPENDS ON STATE THE RECORD DOES NOT CARRY. Rage Fist counts the hits
       * this body has taken; the store has no per-body hit counter, so the power is unknowable and a
       * comparison would be a comparison with a guess. Refused by name, and named so the list can be
       * argued with. */
      if (/^(ragefist|storedpower|punishment|assurance|round|echoedvoice|fury cutter|furycutter|rollout|iceball|triplekick|beatup|presentmove|present|spitup|naturalgift|fling|magnitude|technoblast|judgment|multiattack)$/.test(id(e.mv))) {
        DMG.unresolved++; bump(DMG_UNRESOLVED, 'base power depends on state the record does not carry: ' + id(e.mv));
        stepEvent(run, e, amb); continue;
      }
      /* A SPREAD MOVE'S DAMAGE CANNOT BE READ OUT OF THIS STORE, AND THAT IS AN INGEST DEFECT.
       * `engine/durable-ingest.js` attributes every `-damage` line to the LAST `m` event with
       * `dmg = Math.max(dmg, delta)` and `tgt = tgt || <that slot>`. So for a Heat Wave into two
       * bodies the stored row carries the MAXIMUM of the two deltas against the FIRST target's
       * species and the LAST target's `tgthp`. Those are three different Pokemon's facts in one
       * record. Refused, counted, and filed — not scored, because a comparison against a conflated
       * number would be a divergence rate about the ingest. */
      const spread = !!(fx && /allAdjacent/.test(String(fx.target || '')))
                   && foeSlots(e.s).filter(s => run.slot[s] && run.slot[s].hp > 0).length > 1;
      if (spread) { DMG.unresolved++; bump(DMG_UNRESOLVED, 'SPREAD MOVE — the store conflates its targets into one dmg/tgt pair (ingest defect, filed)'); stepEvent(run, e, amb); continue; }
      const att = bodyAt(e.s);
      if (!att) { DMG.unresolved++; bump(DMG_UNRESOLVED, 'no body in the attacking slot'); stepEvent(run, e, amb); continue; }
      const tSlot = targetSlotOf(run, e.s, e.tgt, amb);
      const def = tSlot ? bodyAt(tSlot) : null;
      if (e.dmg == null) { DMG.unresolved++; bump(DMG_UNRESOLVED, 'no damage figure on the event'); stepEvent(run, e, amb); continue; }
      if (!def) { DMG.unresolved++; bump(DMG_UNRESOLVED, 'target slot could not be recovered from the species'); stepEvent(run, e, amb); continue; }
      const mvRow = mvRow0;
      let v;
      try {
        v = damageVerdict({ ev: e, att, def, mvRow, field, spread, board: run, tSlot,
                            targetPreHP: run.slot[tSlot] ? run.slot[tSlot].hp : null,
                            targetGuarded: (turn.ev || []).some(x => x.t === 'm' && x.s === tSlot && GUARD.test(id(x.mv))) });
      } catch (x) {
        C.exceptions++; bump(EXCEPTIONS, 'damageVerdict ' + id(e.mv) + ': ' + String(x.message).slice(0, 120));
        DMG.unresolved++; bump(DMG_UNRESOLVED, 'THREW — see the exception table'); stepEvent(run, e, amb); continue;
      }
      if (v.verdict === 'matched') DMG.matched++;
      else if (v.verdict === 'ambiguous') DMG.ambiguous++;
      else if (v.verdict === 'clamped_ok') DMG.clamped_ok++;
      else if (v.verdict === 'unresolved') { DMG.unresolved++; bump(DMG_UNRESOLVED, v.why || 'unstated'); }
      else {
        DMG.no_match++;
        diverged = true;
        const key = 'damage / ' + ratioBucket(v.ratio != null ? v.ratio : (v.why && /KO/.test(v.why) ? null : null));
        let k2 = v.why && /KO/.test(v.why) ? 'damage / the record shows a KO our maximum roll cannot reach' : key;
        const flags = [att._replayFlags.item_unknown ? 'attacker item UNKNOWN' : null,
                       att._replayFlags.ability_unknown ? 'attacker ability UNKNOWN' : null,
                       def._replayFlags.item_unknown ? 'defender item UNKNOWN' : null,
                       def._replayFlags.ability_unknown ? 'defender ability UNKNOWN' : null].filter(Boolean);
        /* A NO-MATCH WHERE WE DO NOT KNOW WHAT THE ATTACKER WAS HOLDING IS A DIFFERENT CLAIM, and
         * merging the two is exactly the "no-match is only evidence when we know everything that fed
         * the calculation" line. In a closed-sheet game — 98.3% of this store — an unrevealed Life Orb
         * is 1.3x and would land a hit outside our span with nothing wrong in the engine. Split at the
         * key so the two counts can never be quoted as one. */
        if (att._replayFlags.item_unknown) k2 += '   [UNRESOLVED-CAUSE: the attacker\'s item was never revealed]';
        mech(k2, att._replaySpecies + ' ' + e.mv + ' -> ' + def._replaySpecies,
             { game: game.id, turn: turn.n, move: e.mv, att: att._replaySpecies, def: def._replaySpecies,
               observed: v.observed, our_span: v.span, ratio: v.ratio, why: v.why, unknowns: flags });
        mechsHere.push(k2 + '  (' + att._replaySpecies + ' ' + e.mv + ' -> ' + def._replaySpecies
                     + ': record ' + v.observed + '%, our span ' + (v.span ? v.span.join('–') : '?') + '%)');
      }
      /* THE ROLL-IDENTIFICATION READING, against the DEFAULT baked body. Reported, never a verdict. */
      if (v.verdict !== 'unresolved' && e.dmg > 0 && !e.ko) {
        try {
          const rolls = rollsFor(att, def, mvRow, field, spread, !!e.crit);
          const pct = rolls.map(r => Math.round(r / def.st.hp * 100));
          const n = pct.filter(x => x === e.dmg).length;
          if (n === 1) ROLLID.unique++; else if (n > 1) ROLLID.ambiguous++; else ROLLID.none++;
        } catch (x) { /* already counted by the verdict path */ }
      }
      stepEvent(run, e, amb);
    }

    /* ---- COMPARATOR O: resolution order (ROADMAP #43) ---- */
    const ov = orderVerdict(clicks.filter(c => c.mv && c.body), field);
    ORDER[ov.verdict] = (ORDER[ov.verdict] || 0) + 1;
    if (ov.verdict === 'differ') {
      diverged = true;
      const names = (ov.logSeq || []).map(x => x.who + ' ' + x.mv + ' (pri ' + x.pri + ', our attainable speed '
                                              + x.spdLo + '-' + x.spdHi + ')');
      const key = /^PRIORITY/.test(ov.why || '')
        ? 'turn order / PRIORITY — the record moved a lower-priority move first'
        : 'turn order / SPEED — no legal Champions spread can produce the order the record shows';
      mech(key, names.join('  then  '),
           { game: game.id, turn: turn.n, why: ov.why, order_in_the_record: names });
      mechsHere.push(key + ' :: ' + (ov.why || ''));
    }

    /* ---- COMPARATOR T: is what the record shows REACHABLE at all ---- */
    let ourAfter = null;
    try {
      const R = reachableEffects(game, board, clicks, sets, megaHere, natures);
      if (R.threw) { C.exceptions++; bump(EXCEPTIONS, 'battleTurn: ' + R.threw); }
      if (R.ran) {
        ourAfter = { status_reachable: [...R.seen.status], fainted_reachable: [...R.seen.fainted],
                     weather_reachable: [...R.seen.weather] };
        /* A STATUS THE RECORD SHOWS AND NO PIN PRODUCED. */
        for (const e of (turn.ev || [])) {
          if (e.t !== 'x' || !e.s) continue;
          if (R.seen.status.has(e.s + ':' + e.st)) continue;
          /* Was it already there before the turn? Then nothing had to apply it. */
          if (board.slot[e.s] && board.slot[e.s].status === e.st) continue;
          /* Same refusal as the weather one below: a body that walked in this turn was not on the
           * board the rebuild started from, so nothing here could have statused it. */
          if ((turn.ev || []).some(x => x.t === 's' && x.s === e.s)) {
            bump(NOT_A_DAMAGE_UNIT, 'status landed on a body that SWITCHED IN this turn — cannot be staged from the opening board');
            continue;
          }
          /* WE CANNOT BURN A BODY WE KILLED, AND THAT IS A DAMAGE FINDING WEARING A STATUS COSTUME.
           * Read straight off a freeze: `brn landed on kingambit and our engine never applies it`, with
           * `fainted_reachable: ['p2b']` — p2b IS the Kingambit. Incineroar's Flare Blitz killed it in
           * our simulation and left it at 17% in the real game, so the 10% burn had no body to land on.
           * The engine's secondary is not the defect there; its damage might be, and the damage
           * comparator is where that belongs. Counting it twice, once in the wrong family, is how a
           * mechanic table stops being actionable. */
          if (R.seen.fainted.has(e.s)) {
            bump(NOT_A_DAMAGE_UNIT, 'status on a body OUR ENGINE KILLED this turn — a damage question, scored by the damage comparator instead');
            continue;
          }
          diverged = true;
          mech('status / the record applied ' + e.st + ' and no pin of our engine could produce it',
               (e.mon || '?') + ' <- ' + e.st,
               { game: game.id, turn: turn.n, slot: e.s, mon: e.mon, status: e.st,
                 our_reachable: [...R.seen.status] });
          mechsHere.push('status ' + e.st + ' landed on ' + (e.mon || e.s) + ' in the record and our engine never applies it');
        }
        /* A WEATHER THE RECORD SET AND NO PIN PRODUCED. */
        for (const e of (turn.ev || [])) {
          if (e.t !== 'w' || !e.field) continue;
          const want = M.weatherId(e.field);
          if (!want || R.seen.weather.has(want)) continue;
          if (board.weather && M.weatherId(board.weather) === want) continue;
          /* A WEATHER SET BY A BODY THAT WALKED IN DURING THE TURN CANNOT BE STAGED FROM THE TURN'S
           * OPENING BOARD. The rebuild starts from who was standing when the choice was made, so a
           * Pelipper that switched in and set rain has no body to fire from. Its own bucket, refused
           * rather than scored — it is a limit of rebuilding, not a defect in the engine. */
          if (e.s && (turn.ev || []).some(x => x.t === 's' && x.s === e.s)) {
            bump(NOT_A_DAMAGE_UNIT, 'weather set by a body that SWITCHED IN this turn — cannot be staged from the opening board');
            continue;
          }
          /* A MEGA'S WEATHER ABILITY FIRES MID-TURN AND THE REBUILD FIRES IT AT ENTRY, WHICH IS A
           * DIFFERENT ORDER. Read off a freeze: a Charizard megas into Drought on turn 1 against a
           * Pelipper's Drizzle. In the real game Drizzle lands at entry and Drought overwrites it at
           * the mega, so the record ends in SUN. This probe pre-applies the mega, so both entry
           * abilities fire at once and Drizzle wins — and the instrument accused the engine of not
           * setting a sun it would have set one step later. Refused for any turn carrying a mega. */
          if (megaHere.size) {
            bump(NOT_A_DAMAGE_UNIT, 'weather on a turn with a MEGA — the mega ability fires mid-turn and the rebuild fires it at entry');
            continue;
          }
          diverged = true;
          mech('weather / the record set ' + e.field + ' and our engine did not',
               e.field + (e.by ? ' by ' + e.by : ''),
               { game: game.id, turn: turn.n, weather: e.field, by: e.by || null, our_reachable: [...R.seen.weather] });
          mechsHere.push('weather ' + e.field + ' was set in the record and our engine did not set it');
        }
      }
    } catch (x) { C.exceptions++; bump(EXCEPTIONS, 'reachableEffects: ' + String(x.message).slice(0, 120)); }

    C.turns_compared++; res.compared++; POP.turns++;
    if (turn.n === 1) C.turns_turn1++;
    if (diverged) {
      C.turns_diverged++; res.diverged++; POP.diverged++;
      if (turn.n === 1) C.turns_turn1_diverged++;
      freeze(game, turn.n, board, after, ourAfter, clicks, turn, mechsHere, mechsHere);
    }
    board = after;
  }
  /* NOT A SKIP, AND IT WAS SITTING IN THE SKIP TABLE. A board with two of the same species makes a
   * target lookup ambiguous; the unit is still scored (foes are searched first, so the common case is
   * right) and the count belongs beside the refusals, not beside the games that never ran. */
  if (amb.n) AMBIGUOUS_TARGETS.n += amb.n, AMBIGUOUS_TARGETS.games++;
  POP.games++;
  return res;
}

/* ================= THE RED PROOF =================================================================
 * CLAUDE.md's founding failure is a capability that was absent while everything reported success. An
 * instrument that has never been shown red is not evidence. This corrupts a REAL game in three
 * separate ways and requires the instrument to catch each one. It runs against the same code path the
 * measurement uses — nothing is stubbed. */
const isSpreadMove = (mv) => { try { const f = M.moveFx(id(mv)); return !!(f && /allAdjacent/.test(String(f.target || ''))); } catch (e) { return false; } };
function selftest(games) {
  const out = [];
  const base = JSON.parse(JSON.stringify(games[0]));
  const reset = () => { for (const k of Object.keys(DMG)) DMG[k] = 0; MECH.clear();
                        C.turns_diverged = 0; C.turns_compared = 0; FREEZES.length = 0; };

  /* THE CLEAN ARM FIRST, so every plant is judged against this game's own baseline rather than
   * against zero. A game that already diverges would otherwise make every plant look caught. */
  reset(); replayGame(JSON.parse(JSON.stringify(base)), {});
  const clean = { diverged: C.turns_diverged, compared: C.turns_compared, no_match: DMG.no_match, mechs: [...MECH.keys()] };
  out.push({ name: 'the unmodified game (the baseline every plant is judged against)',
             caught: null, diverged: clean.diverged, compared: clean.compared,
             no_match: clean.no_match, mechanics: clean.mechs });

  /* PLANT 1 — A WRONG DAMAGE FIGURE. The record is told a move dealt a QUARTER of what it did.
   *
   * THE FIRST VERSION OF THIS PLANT WAS A NO-OP AND THE SELFTEST STILL PRINTED, which is the exact
   * failure this whole file is about. It multiplied by four and clamped at 99, and the event it
   * picked already read 99 — so it planted 99 over 99, the instrument correctly found nothing, and
   * the report said the instrument was blind. A plant is now ASSERTED to have changed the record
   * before the result is believed. */
  {
    /* THE HOST GAME IS SEARCHED FOR, NOT ASSUMED TO BE THE FIRST ONE. Pinning the plant to games[0]
     * made the whole gate a property of whichever slice was being sampled: `--skip 30000` produced a
     * first game with no KO in it and the run REFUSED TO PUBLISH over a plant that could not be
     * placed. A red proof must fail on a blind instrument and never on an unlucky sample. */
    let g = null, planted = null;
    for (const cand of games.slice(0, 200)) {
      const c = JSON.parse(JSON.stringify(cand));
      if (!c.turns || !c.turns.length) continue;
      for (const t of c.turns) for (const e of t.ev || []) {
        if (planted || e.t !== 'm' || !e.dmg || e.ko || e.dmg < 8 || isSpreadMove(e.mv)) continue;
        const now = Math.max(1, Math.round(e.dmg / 4));
        if (now === e.dmg) continue;
        planted = { game: c.id, turn: t.n, mv: e.mv, was: e.dmg, now };
        e.dmg = now; if (e.tgthp != null) e.tgthp = Math.min(100, e.tgthp + (planted.was - now));
      }
      if (planted) { g = c; break; }
    }
    reset(); if (g) replayGame(g, {});
    out.push({ name: 'PLANT: a damage figure cut to a quarter', planted,
               caught: planted ? DMG.no_match > clean.no_match : false,
               why_not: planted ? null : 'NO EVENT IN THIS GAME COULD CARRY THE PLANT — the arm proves nothing, and says so',
               no_match: DMG.no_match, mechanics: [...MECH.keys()] });
  }

  /* PLANT 2 — A STATUS THAT CANNOT HAPPEN. A body is recorded as being frozen by a move that cannot
   * freeze. Comparator T must report that no pin of our engine produces it. */
  {
    const g = JSON.parse(JSON.stringify(base));
    let planted = null;
    /* THE PLANT MUST LAND ON A SLOT THE INSTRUMENT WILL ACTUALLY SCORE, and the first attempt did not
     * — it put the freeze on a slot that had a `switch` event in the same turn, which this comparator
     * REFUSES by design (a body that walked in was never on the board the rebuild started from). The
     * plant read as "not caught" when the instrument was working exactly as written. A plant aimed at
     * a refused unit tests the refusal, not the detector. */
    /* THE PLANT IS APPLIED EVERYWHERE IT COULD BE SCORED, NOT AT ONE GUESSED SPOT, and both earlier
     * attempts to guess were wrong for reasons that were themselves the instrument working:
     *   - the first landed on a slot with a `switch` that turn, which is REFUSED (a body that walked
     *     in was never on the board the rebuild started from);
     *   - the second landed on a slot our engine KILLED that turn, which is also refused (we cannot
     *     freeze a body we killed — that is a damage finding, not a status one).
     * Both refusals are correct and both made a working detector read as blind. So the plant now says
     * "every standing body froze this turn", which is impossible on any board, and the arm DECLARES
     * ITSELF UNABLE TO TEST if not one of them survives to be scored. */
    let sites = 0;
    for (const t of g.turns) {
      const busy = new Set((t.ev || []).filter(e => e.t === 's').map(e => e.s));
      for (const slot of SLOTS) {
        if (busy.has(slot)) continue;
        const ref = (t.ev || []).find(e => e.s === slot && e.mon);
        if (!ref) continue;
        t.ev.push({ t: 'x', s: slot, mon: ref.mon, st: 'frz' });
        sites++;
      }
    }
    if (sites) planted = { sites, status: 'frz', note: 'every standing body in every turn is recorded as frozen — impossible on any board' };
    reset(); replayGame(g, {});
    const caught = [...MECH.keys()].some(k => /^status \/ the record applied frz/.test(k));
    out.push({ name: 'PLANT: a freeze the game cannot produce', planted,
               caught: planted ? caught : false,
               why_not: planted ? null : 'NO TURN IN THIS GAME COULD CARRY THE PLANT — the arm proves nothing, and says so',
               mechanics: [...MECH.keys()] });
  }

  /* PLANT 3 — A WRONG HP ON THE BOARD. This is the one Will named: the state the turn is scored from
   * is corrupted rather than the outcome. An `hp` event is inserted at the top of the turn putting the
   * body that is about to be killed back to full, so the recorded KO becomes something no roll of ours
   * can reach. It travels through the board reconstruction, not around it. */
  {
    let g = null, planted = null;
    for (const cand of games.slice(0, 200)) {
      const c = JSON.parse(JSON.stringify(cand));
      if (!c.turns || !c.turns.length) continue;
      for (const t of c.turns) {
        if (planted) break;
        const k = (t.ev || []).findIndex(e => e.t === 'm' && e.ko && e.tgt && e.dmg < 60 && !isSpreadMove(e.mv));
        if (k < 0) continue;
        const e = t.ev[k];
        const slot = (e.s.slice(0, 2) === 'p1' ? 'p2a' : 'p1a');
        t.ev.unshift({ t: 'hp', s: slot, mon: e.tgt, hp: 100 });
        e.dmg = 100;
        planted = { game: c.id, turn: t.n, mv: e.mv, slot,
                    note: 'the target is put back to 100% before the turn and the KO is restated as a full-HP kill' };
      }
      if (planted) { g = c; break; }
    }
    reset(); if (g) replayGame(g, {});
    out.push({ name: 'PLANT: a wrong HP on the board before the turn, making the recorded KO unreachable',
               planted: planted || null,
               caught: planted ? DMG.no_match > clean.no_match : false,
               why_not: planted ? null : 'THIS GAME HAD NO SUITABLE KO — the arm proves nothing, and says so',
               no_match: DMG.no_match, mechanics: [...MECH.keys()] });
  }

  reset();
  return out;
}

/* ================= THE DEFERRED AGGREGATE TEST ====================================================
 * Designed, wired to a flag, and NOT part of the headline. See the header for why it must exist:
 * pinning an outcome makes a wrong PROBABILITY agree with itself. This counts, per move, how often a
 * secondary was observed to fire in the record against how many times the move connected, so the
 * observed rate can be put beside the chance our own move row declares. It needs a corpus far larger
 * than the sample this pass validates on before an interval on a 10% secondary means anything, and
 * that is the reason it is reported separately rather than folded in. */
function secondaryRates(games) {
  const tally = new Map();
  for (const g of games) {
    for (const t of g.turns || []) {
      const ev = t.ev || [];
      ev.forEach((e, i) => {
        if (e.t !== 'm' || e.miss || e.fail || e.immune) return;
        const fx = (() => { try { return M.moveFx(id(e.mv)); } catch (x) { return null; } })();
        const sec = fx && fx.secondary;
        if (!sec || !sec.length) return;
        for (const s of sec) {
          const key = id(e.mv) + ' -> ' + (s.status || (s.boosts ? 'boosts' : 'effect')) + ' @ ' + s.chance + '%';
          let r = tally.get(key); if (!r) { r = { connected: 0, fired: 0, declared: s.chance }; tally.set(key, r); }
          r.connected++;
          const fired = ev.slice(i + 1, i + 6).some(x =>
            (s.status && x.t === 'x' && x.st === s.status) || (s.boosts && x.t === 'b'));
          if (fired) r.fired++;
        }
      });
    }
  }
  const rows = [...tally.entries()].filter(([, r]) => r.connected >= 20).map(([k, r]) => {
    const p = r.fired / r.connected;
    const se = Math.sqrt(Math.max(p * (1 - p), 1e-9) / r.connected);
    return { move: k, connected: r.connected, fired: r.fired, observed_rate: +(100 * p).toFixed(1),
             ci95: [+(100 * (p - 1.96 * se)).toFixed(1), +(100 * (p + 1.96 * se)).toFixed(1)],
             declared: r.declared,
             flag: (r.declared < 100 * (p - 1.96 * se) || r.declared > 100 * (p + 1.96 * se))
                   ? 'DECLARED CHANCE OUTSIDE THE OBSERVED INTERVAL' : 'consistent' };
  }).sort((a, b) => b.connected - a.connected);
  return rows;
}

/* ================= MAIN ========================================================================== */
function readGames(file, n, skip) {
  return new Promise((resolve, reject) => {
    const out = [];
    let i = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      i++;
      if (i <= skip) return;
      if (out.length >= n) { rl.close(); return; }
      try { out.push(JSON.parse(line)); } catch (e) { bump(EXCEPTIONS, 'store line did not parse'); }
    });
    rl.on('close', () => resolve(out));
    rl.on('error', reject);
  });
}

(async function main() {
  const t0 = Date.now();
  const games = await readGames(STORE, N_GAMES, SKIP_GAMES);
  C.games_read = games.length;

  if (SELFTEST) {
    const rows = selftest(games);
    console.log('\n  THE RED PROOF — this instrument corrupting a real game and being required to notice.\n');
    for (const r of rows) {
      console.log('    ' + r.name);
      console.log('      planted:   ' + JSON.stringify(r.planted || null));
      console.log('      caught:    ' + (r.caught === null ? '(baseline arm — nothing planted)' : r.caught ? 'YES' : '*** NO — THE INSTRUMENT IS BLIND TO THIS ***') + (r.why_not ? '   ' + r.why_not : ''));
      console.log('      no-match:  ' + (r.no_match != null ? r.no_match : '-') + '   mechanics: ' + JSON.stringify(r.mechanics));
      console.log('');
    }
    const failed = rows.filter(r => r.caught === false);
    console.log('  ' + (failed.length ? failed.length + ' PLANT(S) NOT CAUGHT — the instrument is not evidence.'
                                      : 'every plant was caught.') + '\n');
    process.exit(failed.length ? 1 : 0);
  }

  /* THE RED PROOF RUNS ON EVERY PUBLISHED RUN AND THE ARTIFACT REFUSES TO EXIST WITHOUT IT.
   *
   * CLAUDE.md's founding failure is a capability that was absent while everything reported success,
   * and a `--selftest` flag somebody has to remember to pass is the same shape one level up: the run
   * that skips it looks exactly like the run that passed it. Four extra replays cost milliseconds. */
  const RED = selftest(games);
  const redFailed = RED.filter(r => r.caught === false);
  if (redFailed.length) {
    console.error('\n  THE RED PROOF FAILED — ' + redFailed.length + ' planted defect(s) went unnoticed:');
    for (const r of redFailed) console.error('    ' + r.name + (r.why_not ? '   ' + r.why_not : ''));
    console.error('  REFUSING TO WRITE AN ARTIFACT. An instrument that cannot be shown red is not evidence.\n');
    process.exit(1);
  }
  for (const k of Object.keys(DMG)) DMG[k] = 0;
  MECH.clear(); DMG_UNRESOLVED.clear(); NOT_A_DAMAGE_UNIT.clear(); EXCEPTIONS.clear();
  SKIP_REASON.clear(); SPECIES_FALLBACK.clear(); SPAN_WIDTH.length = 0; FREEZES.length = 0;
  for (const k of Object.keys(C)) C[k] = 0;
  for (const k of Object.keys(ORDER)) ORDER[k] = 0;
  for (const k of Object.keys(ROLLID)) ROLLID[k] = 0;
  AMBIGUOUS_TARGETS.n = 0; AMBIGUOUS_TARGETS.games = 0;
  for (const k of Object.keys(SPLIT)) { SPLIT[k].games = 0; SPLIT[k].turns = 0; SPLIT[k].diverged = 0; }
  C.games_read = games.length;

  for (const g of games) {
    let r = null;
    try { r = replayGame(g, {}); }
    catch (e) { C.exceptions++; bump(EXCEPTIONS, 'replayGame ' + (g.id || '?') + ': ' + String(e.message).slice(0, 140)); }
    if (r) C.games_replayed++; else C.games_skipped++;
  }

  const rates = has('--rates') ? secondaryRates(games) : null;

  const spanSorted = SPAN_WIDTH.slice().sort((a, b) => a - b);
  const median = spanSorted.length ? spanSorted[Math.floor(spanSorted.length / 2)] : null;
  const dmgTotal = DMG.matched + DMG.ambiguous + DMG.unresolved + DMG.no_match + DMG.clamped_ok + DMG.clamped_unreachable;

  const mechRows = [...MECH.values()].sort((a, b) => b.n - a.n).map(r => ({
    mechanic: r.key, n: r.n,
    top_witnesses: [...r.witnesses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, n]) => w + ' x' + n),
    examples: r.examples,
  }));

  FREEZES.sort((a, b) => (b.mechanics.length - a.mechanics.length) || (a.turn - b.turn));
  const freezes = FREEZES.slice(0, FREEZE_CAP);

  const artifact = Object.assign({}, REL.stamp(), {
    generated: new Date().toISOString(),
    by: 'engine/replay_differential.js',
    what: 'ROADMAP #68 — real stored games replayed through the engine, divergences counted against '
        + 'what actually happened. The authority is data/games.ladder.jsonl, not Showdown.',
    store: path.relative(ROOT, STORE).replace(/\\/g, '/'),
    sample: { requested: N_GAMES, skipped_prefix: SKIP_GAMES, read: C.games_read },
    counts: Object.assign({}, C),
    skip_rate_pct: C.games_read ? +(100 * C.games_skipped / C.games_read).toFixed(2) : null,
    turn_divergence_rate_pct: C.turns_compared ? +(100 * C.turns_diverged / C.turns_compared).toFixed(2) : null,
    turn1_divergence_rate_pct: C.turns_turn1 ? +(100 * C.turns_turn1_diverged / C.turns_turn1).toFixed(2) : null,
    population_split: (() => { const o = {}; for (const k of Object.keys(SPLIT)) o[k] = Object.assign({}, SPLIT[k], { divergence_rate_pct: SPLIT[k].turns ? +(100 * SPLIT[k].diverged / SPLIT[k].turns).toFixed(2) : null }); return o; })(),
    population_note: 'BOT GAMES ARE INCLUDED AND ARE NOT A FILTER. Showdown resolved those turns and does not resolve differently for a bot; only legality and resolution matter here, and both are the server’s. They must never feed meta-usage.json or any human prior — that is a different analysis with a different filter.',
    ground_truth_clicks: 'NONE EXISTS. 22 stored games have willhoop as a player and carry the same extracted schema as every other row — no record of what was clicked. So the choice reconstruction cannot be validated against known answers and is validated only by the per-click confidence in the freeze dump. Filed: the live bot logging its own choice string would make this instrument exact.',
    skips_by_reason: [...SKIP_REASON.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ reason: k, n })),
    exceptions: [...EXCEPTIONS.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ what: k, n })),
    damage: {
      note: 'FOUR VERDICTS, NEVER TWO. `matched` needs the envelope to collapse to a roll; on this '
          + 'corpus it does not, and `ambiguous` means the observed value is inside our attainable '
          + 'interval without identifying which roll. Read the interval width beside it.',
      verdicts: Object.assign({}, DMG), total: dmgTotal,
      unresolved_rate_pct: dmgTotal ? +(100 * DMG.unresolved / dmgTotal).toFixed(2) : null,
      no_match_rate_pct: dmgTotal ? +(100 * DMG.no_match / dmgTotal).toFixed(2) : null,
      unresolved_by_reason: [...DMG_UNRESOLVED.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ reason: k, n })),
      /* KEPT OUT OF EVERY RATE ABOVE AND PRINTED ANYWAY. These are events this instrument declines to
       * turn into a comparison at all — a Protect is not an unresolved damage test. Folding them into
       * `unresolved` inflated that rate from 41% to 52% on the first run and made the denominator mean
       * two different things at once. */
      refused_not_scored: [...NOT_A_DAMAGE_UNIT.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ what: k, n })),
      ambiguous_target_lookups: AMBIGUOUS_TARGETS,
      species_fallbacks: [...SPECIES_FALLBACK.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, n]) => ({ what: k, n })),
      span_width_pct_of_maxhp: { median, min: spanSorted[0] || null, max: spanSorted[spanSorted.length - 1] || null,
                                 n: spanSorted.length },
    },
    roll_identification: Object.assign({}, ROLLID, {
      note: 'THE DIRECT ANSWER TO "can we identify which of the sixteen rolls was played". Computed '
          + 'against the DEFAULT baked body from data/engine-data.js, so it confounds the damage chain '
          + 'with that dataset\'s spread and is NOT a verdict on the engine. It is reported because the '
          + 'number did not exist before.',
    }),
    spread_envelope: {
      why_roll_recovery_fails: 'Champions team sheets do not declare SP (884 of 52,089 stored games '
        + 'carry a sheet; every one has evs:null), and the record states damage as an integer percent '
        + 'of an unknown maximum HP. The legal-spread envelope is wider than the whole 16-roll band, so '
        + 'the observed value is consistent with many rolls for reasons that have nothing to do with '
        + 'our engine.',
      sp_budget: 66, sp_cap_per_stat: SP_CAP,
      median_attainable_span_pct_of_maxhp: median,
      one_roll_step_pct: median != null ? +(median / 16).toFixed(3) : null,
    },
    turn_order: Object.assign({}, ORDER, {
      note: 'ROADMAP #43 — the resolution order IS the event order in the record, and nothing in this '
          + 'repository had ever read it. A genuine speed tie is REFUSED, not scored: matching a coin '
          + 'is not evidence and missing one is not a defect.',
    }),
    mechanics: mechRows,
    red_proof: { note: 'Run on EVERY published run, not behind a flag. Each row corrupts a real stored '
                     + 'game one way and the instrument is required to notice. The generator refuses to '
                     + 'write this file if any plant goes unnoticed.', arms: RED },
    cannot_see: [
      'side conditions — the store has no `-sidestart`, so Reflect, Light Screen, Aurora Veil and '
        + 'Tailwind are invisible. A halved damage reading is the expected signature and it has its own '
        + 'ratio bucket rather than being hidden inside "below band".',
      'Substitute — no event, so a move that hit a doll reads as connecting for zero. Its own bucket.',
      'item consumption and PP — a Sitrus eaten on turn 2 is restored by the turn-3 rebuild.',
      'volatile durations, choice locks, Encore, Taunt, Disable — not in the record.',
      'the `cant` family — the store records NO flinch, full-paralysis, sleep, freeze or recharge '
        + 'event at all. A prevented move is an ABSENT `m` event and is indistinguishable from a '
        + 'switch or an unrecorded action. This is an INGEST defect (Showdown emits '
        + '`|cant|p2a: X|flinch` and engine/durable-ingest.js drops it) and is filed, not fixed here.',
      'the attacker\'s SP spread — see spread_envelope. This is the binding limit on the damage test.',
      'secondary-effect PROBABILITIES — pinning the observed outcome makes a wrong chance agree with '
        + 'itself. The aggregate counter-test is designed and behind --rates; it is DEFERRED and is '
        + 'not part of any figure above.',
    ],
    secondary_rates: rates,
    seconds: +((Date.now() - t0) / 1000).toFixed(1),
  });

  fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n');
  fs.writeFileSync(FREEZE_OUT, JSON.stringify({
    note: 'One readable frozen state per diverging turn. Open one and the mistake should be visible '
        + 'without running anything. `board_after_LOG` is what really happened; `board_after_OURS` is '
        + 'what our engine could reach under any of its pins. `clicks[].reconstruction` says how sure '
        + 'the choice recovery was — a board that differs because the wrong click was fed in is not an '
        + 'engine defect.',
    engine_release: REL.id, generated: new Date().toISOString(),
    total_diverging_turns: C.turns_diverged, shown: freezes.length,
    freezes,
  }, null, 2) + '\n');

  if (!QUIET) {
    const P = (s) => console.log(s);
    P('\n  REPLAY DIFFERENTIAL — real stored games against our engine.  release ' + REL.id);
    P('  ' + artifact.what + '\n');
    P('  GAMES     read ' + C.games_read + '   replayed ' + C.games_replayed + '   SKIPPED ' + C.games_skipped
      + '   (' + artifact.skip_rate_pct + '%)');
    for (const r of artifact.skips_by_reason.slice(0, 8)) P('              ' + String(r.n).padStart(5) + '  ' + r.reason);
    P('  TURNS     seen ' + C.turns_seen + '   compared ' + C.turns_compared + '   DIVERGED ' + C.turns_diverged
      + '   (' + artifact.turn_divergence_rate_pct + '%)');
    P('            turn 1 only: ' + C.turns_turn1 + ' compared, ' + C.turns_turn1_diverged + ' diverged ('
      + artifact.turn1_divergence_rate_pct + '%)  — the only arm with no invisible state in it');
    for (const k of Object.keys(SPLIT)) { const v = artifact.population_split[k]; if (v.games) P('            ' + k.padEnd(14) + ' ' + String(v.games).padStart(5) + ' games  ' + String(v.turns).padStart(5) + ' turns  ' + String(v.diverged).padStart(4) + ' diverged  ' + v.divergence_rate_pct + '%'); }
    P('  EXCEPTIONS ' + C.exceptions + '   (a category, printed, never vanished)');
    for (const r of artifact.exceptions.slice(0, 8)) P('              ' + String(r.n).padStart(5) + '  ' + r.what);
    P('\n  DAMAGE — all 16 rolls, at the observed crit state, across the legal SP envelope');
    P('            matched   ' + DMG.matched + '   ambiguous ' + DMG.ambiguous + '   clamped-ok ' + DMG.clamped_ok);
    P('            NO-MATCH  ' + DMG.no_match + '   unresolved ' + DMG.unresolved
      + '  (' + artifact.damage.unresolved_rate_pct + '% of ' + dmgTotal + ')');
    for (const r of artifact.damage.unresolved_by_reason.slice(0, 8)) P('              ' + String(r.n).padStart(5) + '  ' + r.reason);
    P('            median attainable span: ' + median + ' points of max HP  -> one roll step is '
      + artifact.spread_envelope.one_roll_step_pct + ' points');
    P('  ROLL ID   unique ' + ROLLID.unique + '   ambiguous ' + ROLLID.ambiguous + '   none ' + ROLLID.none
      + '   (against the DEFAULT baked body — not a verdict on the engine)');
    P('  ORDER     forced-and-agree ' + ORDER.agree + '   DIFFER ' + ORDER.differ
      + '   inside the spread envelope (refused) ' + ORDER.spread
      + '   priority ability (refused) ' + ORDER['ability-priority']
      + '   n/a ' + ORDER['n/a']);
    P('  REFUSED, and kept out of every rate above:');
    for (const r of artifact.damage.refused_not_scored.slice(0, 6)) P('              ' + String(r.n).padStart(5) + '  ' + r.what);
    P('  RED PROOF ' + RED.filter(r => r.caught === true).length + ' of ' + RED.filter(r => r.caught !== null).length
      + ' planted defects caught — run on this run, not behind a flag');
    P('\n  DIVERGENCES BY MECHANIC');
    if (!mechRows.length) P('            none');
    for (const r of mechRows.slice(0, 20)) {
      P('    ' + String(r.n).padStart(5) + '  ' + r.mechanic);
      for (const w of r.top_witnesses.slice(0, 3)) P('             ' + w);
    }
    P('\n  ' + path.relative(ROOT, OUT).replace(/\\/g, '/') + '   and   '
      + path.relative(ROOT, FREEZE_OUT).replace(/\\/g, '/') + ' (' + freezes.length + ' frozen turns)');
    P('  ' + artifact.seconds + 's\n');
  }
})().catch(e => { console.error('replay_differential FAILED: ' + (e && e.stack || e)); process.exit(1); });
