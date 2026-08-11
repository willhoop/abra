/* all_mechanics_fire.js — ROADMAP #143. BUILD THE GAMES FROM THE MECHANIC LIST, NOT FROM REALISTIC
 * SETS, SO EVERY MOVE ACTUALLY FIRES INSIDE A REAL SHOWDOWN GAME, AND COMPARE TURN BY TURN.
 *
 *   SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --release 7bf3a1e19ce5
 *   ... --kind moves|abilities|items|all      which population (default moves)
 *   ... --limit 40                            first N of the population, for a smoke run
 *   ... --only thunderbolt,willowisp          named rows only
 *   ... --red                                 THE RED DEMONSTRATION, and nothing else
 *   ... --write                               + data/all-mechanics-fire.json
 *
 * WILL, 2026-08-10:  "WE HAVE TO CREATE THE GAMES OURSELVES AND TEST IT ON SHOWDOWN"
 *                    "SET UP SCENARIOS WHERE ALL MOVES CAN BE USED SUCCESSFULLY"
 *                    "I DONT CARE IF THEY ARE GOOD PLAYS, JUST HAVE THE MOVES SUCEED"
 *
 * The last line is the design constraint and it is what makes this instrument possible at all: the
 * teams do not have to be SENSIBLE. They have to be LEGAL — judged by Showdown's own `TeamValidator`,
 * never by ours — and they have to make the mechanic RESOLVE.
 *
 * ================= WHY THIS AND NOT THE REPLAY DIFFERENTIAL =======================================
 *
 * Replay testing is capped BY CONSTRUCTION. Champions open sheets declare item, ability, moves and
 * nature and do NOT declare SP, and the legal-SP envelope is wider than the whole 16-roll damage band
 * — 0 of 22,313 turn-1 damage comparisons across 12,071 stored games resolve to an exact roll. No
 * quantity of sheet data fixes that. `game_differential.js` has no such ceiling because it BUILDS both
 * teams; its one real limit is COVERAGE, because it plays teams a bot would bring and therefore
 * exercises only moves a bot clicks. This closes that hole from the other end: the TEAM IS DERIVED
 * FROM THE MECHANIC, so the rare rows get tested the strong way — inside a real game against the
 * official engine — rather than on a staged board.
 *
 * ================= WHAT "RESOLVED" MEANS, AND WHY A CLICK IS NOT ONE ==============================
 *
 * ROADMAP #91's founding lesson, one instrument over: Primarina clicking Haze into a board with no
 * boosts on it is not a test of Haze. So a row is credited only when the AUTHORITY'S OWN STREAM shows
 * the move executing AND producing a consequence:
 *
 *   ATTEMPTED   a `|move|` line naming the actor and the move, in Showdown's log
 *   BLOCKED     that segment carries a refusal — `-fail`, `-miss`, `-immune`, `-notarget`, `|cant|`,
 *               or a guard `-activate` (Protect and its family). The move was clicked and did nothing.
 *   RESOLVED    attempted, not blocked, and the segment carries at least one CONSEQUENCE line
 *
 * The verdict is read off SHOWDOWN and never off medicham2, because a resolution judged from
 * medicham2's own narration would be the engine grading its own homework. Whether medicham2 agrees is
 * the SEPARATE question this file also asks, in `game_differential`'s existing divergence vocabulary.
 *
 * ================= A MECHANIC WITH NO NARRATION: THE A/B ARM ======================================
 *
 * A move announces itself. AN ABILITY OFTEN DOES NOT — Blaze under a third, Sheer Force, Thick Fat and
 * Analytic emit no protocol line at all, so "did it fire" cannot be read from a stream the way a move
 * can. Hand-listing a trigger per ability is the thing docs/TAGS.md forbids, because it rots the first
 * time an ability is added.
 *
 * So the ability and item verdicts are DIFFERENTIAL: play the SAME game twice under the same pinned
 * dice, once with the mechanic and once with a CONTROL (another of that species' own legal abilities;
 * for an item, no item), and ask whether the two games differ.
 *
 *   FIRED          removing it changed the game — in Showdown AND in medicham2
 *   SHOWDOWN-ONLY  the authority's game changed and ours did not. THAT IS AN ENGINE BUG.
 *   MEDICHAM-ONLY  ours changed and the authority's did not. ALSO AN ENGINE BUG.
 *   DID-NOT-FIRE   neither game changed. The scenario did not reach the trigger — a gap in THIS
 *                  instrument, reported as such and never as a pass.
 *
 * That definition is derived rather than listed, and it is the same question the MEDICHAM gate's
 * deliberate roster asks on a STAGED single turn (`FIRED-AND-BOARDS-DIFFER` / `DID-NOT-FIRE`) — asked
 * here inside a real game instead. Where the two instruments disagree about one mechanic, that
 * disagreement is itself the finding.
 *
 * ================= THE RED DEMONSTRATION ==========================================================
 *
 * `--red` breaks the comparison ON PURPOSE and asserts it is caught. An instrument that has never
 * failed is not evidence. Three plants, each aimed at a different claim this file makes:
 *   1. a move that CANNOT resolve (clicked into a type immunity) must be reported BLOCKED, not resolved
 *   2. a mechanic swapped for its own control must be reported DID-NOT-FIRE by the A/B arm
 *   3. a corrupted medicham stream must be reported as a DIVERGENCE at the line it was corrupted
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);
const KIND = String(flag('--kind', 'moves')).toLowerCase();
const LIMIT = +flag('--limit', 0) || 0;
const ONLY = flag('--only', null);
const WRITE = has('--write');
const RED = has('--red');
const VERBOSE = has('--verbose');
const DUMPLOG = has('--dumplog');
const OUT = flag('--out', null);

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}
/* THE PHOTOGRAPH. `game_differential.js` reads `--release` off the same argv, so naming one here pins
 * BOTH the driver's frozen engine and this file's. Absent, the driver cuts a release over the live
 * tree and says so; that is fine for a smoke run and is NOT a measurement. */
if (!flag('--release', null)) {
  console.log('  NO --release GIVEN. The driver will cut one over the LIVE tree; another division may be');
  console.log('  editing it. This is a smoke run, not a measurement.');
}

/* ---- THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE, AND THAT IS NOT A PREFERENCE ------------
 *
 * `game_differential`'s default stop rule ends a game at its FIRST PROTOCOL DIVERGENCE, which is right
 * for the swarm — every line after that point is downstream of the first. It is FATAL here, because a
 * scenario's precondition turns come BEFORE the click: a heal needs a prior turn of damage, Spit Up
 * needs a prior Stockpile, a charge move needs a first turn to charge. MEASURED: 12 of the 500 move
 * rows had their click turn eaten by a divergence on the SETUP turn, and every one of them was
 * reported as "the move was never issued" — an instrument limitation wearing the costume of a finding.
 *
 * `--state` is the driver's own switch for exactly this: the game runs to `--turns` or to its first
 * BOARD divergence, and THE FIRST PROTOCOL DIVERGENCE IS STILL RECORDED AT EXACTLY THE LINE IT WAS
 * FOUND. So nothing about the protocol measurement changes; the game simply keeps playing.
 *
 * IT IS PUSHED ONTO argv RATHER THAN DOCUMENTED AS A FLAG THE CALLER SHOULD REMEMBER. A caller who
 * forgot it would get a quieter, smaller, wronger answer that looks exactly like a real one — the
 * silent default this project has been bitten by repeatedly. It is announced on every run. */
if (!has('--state')) { process.argv.push('--state'); argv.push('--state'); }
console.log('  --state is ON (forced): a game runs past its first divergent LINE so a scenario\'s setup '
          + 'turns cannot eat its click turn. The first protocol divergence is still recorded where it was found.');

const GD = require('./game_differential.js');
const CS = require('./champions_sim.js');
const { Dex, TeamValidator } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require('./names.js');
const id = N.id;
const VALIDATOR = new TeamValidator(CS.FORMAT);
const TAGS = JSON.parse(GD.REL.read('data/tags.json') || fs.readFileSync(D('data', 'tags.json'), 'utf8'));

/* THE ARM. `bottom-tie-first` and not the primary, and this is not a preference — under the primary
 * arm EVERY SUB-100-ACCURACY MOVE MISSES, and a missed move has not resolved. Focus Blast, Hydro Pump,
 * Thunder, Fissure, Hypnosis and 140 others could not be credited under any scenario whatsoever. The
 * bottom corner is the arm in which every accuracy check HITS, every crit lands and every secondary
 * fires; it is a shipped arm of the differential, not one invented here, and the two engines agree
 * event-for-event under it (see game_differential's pin header). */
const ARM = GD.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.error('the `bottom-tie-first` arm is gone from game_differential — refusing to guess'); process.exit(2); }

/* ================= THE POPULATION ================================================================
 * Every entity the FORMAT admits, asked of the format rather than of a list (CLAUDE.md: the ban is a
 * MECHANISM). `isNonstandard` is the authority's own marker for "does not exist in Gen 9". */
const LEGAL_SPECIES = dex.species.all().filter(s =>
  s.exists && !s.isNonstandard && s.tier !== 'Illegal' && !s.isMega && !s.battleOnly && s.num > 0);

/* THE MOVE POOL PER SPECIES, ASKED OF THE AUTHORITY. `getMovePool` is the same function
 * `TeamValidator` reasons from, so a carrier chosen here is one the validator will accept — and the
 * validator is still run afterwards, because "the same function" is a belief and the verdict is a
 * fact. A species whose pool cannot be built is COUNTED, never skipped silently. */
const POOL_FAILS = [];
const POOL = new Map();
for (const s of LEGAL_SPECIES) {
  try { POOL.set(s.id, dex.species.getMovePool(s.id)); }
  catch (e) { POOL_FAILS.push(s.id + ': ' + e.message); }
}
/* move id -> every legal species that can learn it */
const CARRIERS = new Map();
for (const [sid, pool] of POOL) for (const mv of pool) {
  if (!CARRIERS.has(mv)) CARRIERS.set(mv, []);
  CARRIERS.get(mv).push(sid);
}
for (const v of CARRIERS.values()) v.sort();

const LEGAL_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard).map(m => m.id).sort();
const LEGAL_ABILITIES = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.id).sort();
const LEGAL_ITEMS = dex.items.all().filter(i => i.exists && !i.isNonstandard).map(i => i.id).sort();
/* ability id -> every legal species that has it in its OWN ability slots. An ability no legal body
 * carries is UNREACHABLE in this format and is reported as that rather than as a failure — the Guard
 * Dog lesson from game_differential's standing block. */
const AB_CARRIERS = new Map();
for (const s of LEGAL_SPECIES) for (const a of Object.values(s.abilities || {})) {
  const k = id(a); if (!AB_CARRIERS.has(k)) AB_CARRIERS.set(k, []);
  AB_CARRIERS.get(k).push(s.id);
}
for (const v of AB_CARRIERS.values()) v.sort();

/* ================= THE FIXTURES ==================================================================
 *
 * THE RECEIVER IS IMMUNE TO NOTHING, AND THAT IS COMPUTED RATHER THAN CHOSEN. A move that hits a type
 * immunity has not resolved, so a receiver carrying ANY immunity silently deletes a whole type from
 * the measurement. Seven types confer one: Normal (vs Ghost), Ghost (vs Normal and Fighting), Flying
 * (vs Ground), Ground (vs Electric), Steel (vs Poison), Dark (vs Psychic), Fairy (vs Dragon). Grass is
 * excluded on top of those because it is immune to the seven `powder` moves and to Leech Seed.
 *
 * ITS ABILITY MUST ALSO BE INERT — an absorbing or bouncing ability is a second immunity wearing a
 * different hat, and the receiver's whole job is to be hittable. `Torrent` fires only for the
 * HOLDER'S OWN Water attacks below a third HP; the receiver attacks with nothing Water and never gets
 * low (see the HP pool below), so it is inert BY THE SCENARIO rather than by hope. */
const RECEIVER = { species: 'feraligatr', ability: 'Torrent', item: '',
  why: 'pure Water — no type immunity at all; Torrent cannot fire for a body that never clicks a Water move at full HP' };
/* WHAT THE RECEIVER CLICKS, AND WHY IT IS NOT PROTECT. Protect is +4 and would block the very move
 * being staged — `tests/test-game-diff.js`'s `fillerFor` lesson, 30 pairs where the interaction under
 * test could not happen. Agility is priority 0 and raises a stat no damage formula reads.
 * The two ATTACKS are there for the moves that fail — or lose their whole point — unless the target is
 * attacking: Counter, Mirror Coat, Metal Burst, Comeuppance, Sucker Punch, Payback, Avalanche,
 * Assurance. One physical and one special, because those split on the category. */
/* NOT WATERFALL AND NOT WATER PULSE, AND THIS WAS MEASURED RATHER THAN CHOSEN. Both carry a SECONDARY
 * — Waterfall flinches 20% of the time, Water Pulse confuses 20% — and under the `bottom-tie-first`
 * arm EVERY SECONDARY FIRES. The receiver's "just hit it" click therefore flinched the actor on every
 * single turn, and six moves (Counter, Mirror Coat, Metal Burst, Payback, Assurance, Avalanche) were
 * reported as "the move was never issued" when what had happened is that the harness stunned its own
 * actor. Facade and Round carry no secondary at all. */
/* TWO ATTACKING TYPES, NOT ONE, AND THAT WAS A MEASURED DEFECT TOO. Facade and Round are both NORMAL,
 * so against a GHOST actor — Annihilape holding Counter — the receiver's hit was `-immune` and Counter
 * correctly failed for want of a hit to counter. Aqua Tail and Hydro Pump are Water, which nothing in
 * this format is immune to by type; `hittingMove` below picks whichever of the pair can actually reach
 * the body in front of it. */
const RECEIVER_MOVES = ['Agility', 'Facade', 'Aqua Tail', 'Hydro Pump'];
/* THE PADS ARE GENERATED, NOT LISTED. A fixed list of four ran out the moment a scenario's own actor
 * or receiver was already on it — the sheet came back five bodies long and `TeamValidator` refused it
 * for a reason that had nothing to do with the mechanic under test. The pool is every legal species
 * that can click Protect, in the authority's own order, and a scenario takes the first ones it has
 * not already used. It cannot run out and it cannot collide. */
const PAD_POOL = LEGAL_SPECIES.filter(s => (POOL.get(s.id) || new Set()).has('protect')).map(s => s.id);
const PAD_MOVES = ['Protect', 'Endure', 'Rest'];
/* THE HP POOL, x6 ON BOTH SIDES. Nothing may faint: a faint forces a switch, and medicham2 refills a
 * dead slot from its own bench while Showdown is told to mirror it — a legitimate mechanism that
 * would nonetheless be THIS HARNESS producing the divergence rather than the engine. The multiplier
 * is applied identically to both engines by the driver (`spec.hpx`), so every FRACTIONAL mechanic —
 * Sitrus at a half, Blaze at a third, Leftovers at a sixteenth — is unchanged. */
const HP_BOOST = 6;
/* A NEUTRAL NATURE THAT IS NOT `Serious`. The validator objects to a 0-SP body under `Serious`
 * specifically — *"did you forget to invest it? change your Nature to a different neutral Nature"* —
 * so the sheet says `Hardy`, which is neutral, declares the zero was deliberate, and moves no stat. */
const NATURE = 'Hardy';

/* ================= BUILDING A SHEET =============================================================== */
const spName = s => { const x = dex.species.get(s); return x && x.exists ? x.name : null; };
const mvName = m => { const x = dex.moves.get(m); return x && x.exists ? x.name : null; };

/* A body's four moves, filtered to what it can actually learn, with a learnable filler appended so no
 * set is empty. A set that survives with zero moves is DROPPED and counted — never given a guessed
 * move, which is how a scenario comes to test something nobody asked for. */
const FILLERS = ['protect', 'rest', 'facade', 'round', 'tackle', 'takedown', 'sleeptalk', 'swagger'];
function bodyOf(species, ability, item, wantMoves) {
  const sp = dex.species.get(species);
  if (!sp || !sp.exists) return null;
  const pool = POOL.get(sp.id);
  if (!pool) return null;
  const moves = [];
  for (const w of (wantMoves || [])) {
    const k = id(w); if (!k || moves.includes(k)) continue;
    if (!pool.has(k)) continue;
    const dm = dex.moves.get(k); if (!dm || !dm.exists || dm.isNonstandard) continue;
    moves.push(k);
    if (moves.length >= 4) break;
  }
  if (!moves.length) for (const f of FILLERS) { if (pool.has(f) && !dex.moves.get(f).isNonstandard) { moves.push(f); break; } }
  if (!moves.length) return null;
  const legalAb = Object.values(sp.abilities || {});
  let ab = legalAb.find(a => id(a) === id(ability)) || legalAb[0] || '';
  return { species: sp.name, item: item || '', ability: ab, moves: moves.map(mvName) };
}

/* THE SHEET THE AUTHORITY JUDGES IS SIX BODIES; THE GAME BRINGS FOUR. Showdown's `TeamValidator`
 * refuses a four-body team outright — *"You must bring at least 6 Pokemon"* — so a team that is only
 * ever four long cannot be judged at all, whatever is on it. The first four are the ones that play
 * (`team 1234`); the last two are fixed legal pads. THE PLAYED BODIES ARE THEREFORE ALL VALIDATED,
 * and the reason the battle is not six-long is not convenience: medicham2 would carry a four-body
 * bench against Showdown's two, and Beat Up and Revival Blessing read the PARTY SIZE — the harness
 * would manufacture a divergence out of its own padding. */
let SHEET_FAILS = 0;
function sheetOf(bodies) {
  const out = bodies.slice(0, 4).filter(Boolean);
  if (out.length !== bodies.slice(0, 4).length) { SHEET_FAILS++; return null; }
  for (const pid of PAD_POOL) {
    if (out.length >= 6) break;
    if (out.some(b => id(b.species) === pid)) continue;
    const p = bodyOf(pid, '', '', PAD_MOVES);
    if (p) out.push(p);
  }
  if (out.length !== 6) { SHEET_FAILS++; return null; }
  return out;
}

/* THE AUTHORITY'S VERDICT ON A SHEET, and its REASONS. A refusal is reported with what the validator
 * said and is never quietly dropped: "a set it refuses is not a test", and a refusal nobody reads is
 * a row that silently left the population. */
const VAL_CACHE = new Map();
function validate(sheet) {
  const sets = sheet.map(b => ({
    name: b.species, species: b.species, gender: 'N', level: 50, item: b.item,
    ability: b.ability, moves: b.moves.slice(), nature: NATURE,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  }));
  const key = JSON.stringify(sets);
  if (VAL_CACHE.has(key)) return VAL_CACHE.get(key);
  let errs = null;
  try { errs = VALIDATOR.validateTeam(sets); }
  catch (e) { errs = ['validator threw: ' + e.message]; }
  const r = { ok: !errs, errors: errs || [] };
  VAL_CACHE.set(key, r);
  return r;
}

/* ================= READING THE AUTHORITY'S STREAM =================================================
 *
 * The verdict vocabulary of the header, implemented once. A `|move|` line opens a SEGMENT that runs
 * to the next `|move|`, `|turn|`, `|upkeep|` or the end of the log; everything the move did is in it.
 *
 * WHAT COUNTS AS A REFUSAL is the authority's own words, not a guess: `-fail` (the move did nothing),
 * `-miss` (accuracy), `-immune` (type or ability), `-notarget` (nobody there), `|cant|` (the move
 * could not be used at all), and a guard `-activate` — Protect, Detect, Spiky Shield, Baneful Bunker,
 * Wide Guard, Quick Guard, Crafty Shield, Mat Block, Max Guard. A move blocked by a shield was clicked
 * and did nothing, which is exactly the case ROADMAP #91 exists to stop crediting. */
const REFUSAL = new Set(['-fail', '-miss', '-immune', '-notarget', '-block', 'cant']);
const GUARDS = /move:\s*(protect|detect|spiky ?shield|baneful ?bunker|wide ?guard|quick ?guard|crafty ?shield|mat ?block|max ?guard|obstruct|silk ?trap|burning ?bulwark|king'?s ?shield)/i;
/* LINES THAT ARE NEITHER A CONSEQUENCE NOR A REFUSAL. `-anim` is the client's animation hint and is
 * emitted for a move that then fails; `-hitcount` and `-waiting` are bookkeeping. Counting any of them
 * as a consequence would credit a move for having been drawn on a screen. */
const NOT_A_CONSEQUENCE = new Set(['-anim', '-hitcount', '-waiting', '-center', '-notarget', '-message',
                                   '-hint', '-ohko', '-combine', '-nothing']);
/* CONSEQUENCES THAT ARE NOT `-` EVENTS, and every one of them cost a false negative before it was
 * written down. Showdown announces the biggest things a move can do WITHOUT a leading dash:
 *   `faint`         the target died — Explosion, an OHKO move
 *   `drag`          Roar and Whirlwind dragged something out. This USED to end the segment, so Roar
 *                   and Whirlwind were filed as "produced no consequence line at all"
 *   `switch`        the user left — U-turn, Volt Switch, Teleport, Baton Pass, Parting Shot
 *   `swap`          Ally Switch moved two bodies
 *   `detailschange` / `formechange` / `replace`   Aura Wheel's Morpeko, Illusion breaking
 *   `move …[from]`  Copycat, Metronome, Sleep Talk, Instruct — the move it CALLED is a nested `|move|`,
 *                   which used to open a new segment and leave the caller looking inert
 * They still CLOSE the segment (everything after is that new event's business), but they are counted
 * on the way out. */
const NONDASH_CONSEQUENCE = new Set(['faint', 'drag', 'switch', 'swap', 'detailschange', 'formechange', 'replace']);
function segments(log) {
  const segs = [];
  let cur = null;
  for (const raw of log) {
    const p = String(raw).split('|');
    const ev = p[1];
    if (ev === 'move') {
      /* A NESTED CALL — `|move|p1a: X|Thunderbolt|p2a: Y|[from]Copycat` — is the CALLER'S consequence
       * and then a segment of its own. Both, in that order. */
      if (cur && /\[from\]/.test(raw)) cur.lines.push(raw);
      if (cur) segs.push(cur);
      cur = { who: p[2], move: id(p[3]), still: raw.indexOf('[still]') >= 0, lines: [] };
      continue;
    }
    if (ev === 'cant') { if (cur) { segs.push(cur); cur = null; } segs.push({ who: p[2], move: id(p[4] || ''), cant: p[3], lines: [] }); continue; }
    if (NONDASH_CONSEQUENCE.has(ev)) { if (cur) { cur.lines.push(raw); segs.push(cur); cur = null; } continue; }
    if (ev === 'turn' || ev === 'upkeep') { if (cur) segs.push(cur); cur = null; continue; }
    if (cur) cur.lines.push(raw);
  }
  if (cur) segs.push(cur);
  return segs;
}
/* Did THIS actor's click of THIS move resolve? Returns the verdict and, when it did not, the
 * authority's own reason — because "0" is not a finding and "-immune" is. */
/* ---- A DIVERGENCE ON ANOTHER SLOT IS NOT THIS ROW'S DEFECT ---------------------------------------
 *
 * MEASURED 2026-08-10, and it produced three false findings. `afteryou`, `sleeptalk` and `snore`
 * (442 clicks between them) were each filed as the SUBJECT emitting a spurious `-fail`. The line is
 * `|-fail|p1b: Venusaur` — the PARTNER slot — while every subject in this harness is staged at `p1a`.
 * The harness recorded the game's first protocol divergence and attributed it to whatever row the
 * game was staged for, so one bug in the partner slot was charged to three unrelated moves.
 *
 * Will spotted it from the mechanics without seeing the code: "7 YOU GOTTA BE ASLEEP FOR SLEEP TALK
 * AND SNORE" — true, and precisely why the SUBJECT failing made no sense.
 *
 * THE ROW IS STILL RECORDED. Suppressing it would trade three false findings for one invisible real
 * one, which is this project's signature failure. It is recorded with `attributed: false` and the
 * slot it actually belongs to, and the cause report counts the two kinds separately — so a partner
 * bug reads as ONE bug in the partner slot instead of N bugs in N subjects.
 *
 * THE SLOT NAMED ON THE LINE IS THE WRONG TEST, and it was written first and caught by its own
 * fixture. `|-damage|p2a: Feraligatr|915/960` names the OPPONENT'S slot and is the subject's move
 * LANDING — the whole Aegislash class looks like that. A slot rule would have exonerated every real
 * finding in this run while fixing three false ones. That is "correct the diagnosis, not just the
 * bug" — a fix aimed at the wrong mechanism is still a bug.
 *
 * THE RIGHT ANCHOR IS THE MOVE SEGMENT, which this file already computes. `segments()` opens a
 * segment on each `|move|` line and files every consequence under it, so a `-damage` on the target
 * belongs to the ATTACKER'S segment. Walk the authority's log to the divergent index and ask whose
 * segment is open there. If it is the subject's own click, the divergence is this row's. If a
 * partner or the opponent was mid-move, it is theirs. */
function ownerAt(log, idx) {
  /* Mirrors segments()' state machine, stopping at `idx`. Deliberately a separate walk rather than a
   * second return value from segments(): that function is the verdict reader and is called on both
   * engines' logs, and threading indices through it to serve one caller would put two jobs in one
   * function. */
  let who = null, move = null;
  for (let i = 0; i <= idx && i < log.length; i++) {
    const p = String(log[i]).split('|');
    const ev = p[1];
    if (ev === 'move') { who = p[2]; move = id(p[3]); continue; }
    if (ev === 'cant') { who = p[2]; move = id(p[4] || ''); continue; }
    if (ev === 'turn' || ev === 'upkeep') { who = null; move = null; continue; }
    if (NONDASH_CONSEQUENCE.has(ev)) { who = null; move = null; continue; }
  }
  return { who, move };
}
/* AND THE THIRD REWRITE ENDED IN A FLAG, NOT A VERDICT — deliberately, and this is the honest answer.
 *
 * Attempt 2 was "attribute by the MOVE'S TARGET": After You reaches its partner, so a partner-slot
 * divergence is genuinely its bug, while Sleep Talk (`self`) and Snore cannot touch a partner.
 * WILL, 2026-08-10: "AFTER YOU IS USED BY A FAST POKEMON LIKE LOPUNNY TO MAKE THEIR SLOW PARTNER MOVE
 * FIRST LIKE TORKOAL" — which is exactly right, and measuring it killed the rule: in this format After
 * You's target is `normal`, and `normal` in doubles INCLUDES the ally. So does Snore's. The dex does
 * not separate these three rows, and a rule built on it would have looked principled and decided
 * nothing.
 *
 * THREE ATTEMPTS, THREE DIFFERENT WRONG ANSWERS, AND THE PATTERN IS THE POINT. Each version traded a
 * false positive for a false negative — and in this repository a false negative is strictly worse: a
 * defect wrongly kept gets investigated and dropped, a defect wrongly disowned is invisible, which is
 * the failure mode CLAUDE.md opens with. So NOTHING IS DISOWNED HERE.
 *
 * What is recorded is the fact, not a judgement: which slot's move segment the divergent line fell
 * inside. When it is not the subject's, the row carries `shared_suspect` and the reporter groups those
 * rows together, so a single partner-slot bug reads as ONE suspect shared by N rows rather than N
 * independent findings. The count is no longer inflated and no finding is thrown away. Deciding which
 * of the two it actually is needs a human reading one full log, and that is ROADMAP work, not a
 * predicate. */
function divOf(div, who, sdLog, moveId) {
  if (!div) return null;
  const subject = (String(who || '').match(/^(p[12][abc])/) || [])[1] || 'p1a';
  const own = ownerAt(sdLog || [], div.index);
  const ownSlot = own.who ? (String(own.who).match(/^(p[12][abc])/) || [])[1] : null;
  /* NO OPEN SEGMENT — a residual, an end-of-turn line, a switch — belongs to the game rather than to
   * any one click, so it is not a shared suspect either. */
  const shared = !!(ownSlot && ownSlot !== subject);
  return Object.assign({ at: div.index }, GD.classify(div), {
    showdown: div.sdRaw, medicham: div.meRaw,
    subject_slot: subject,
    segment_owner: ownSlot,
    segment_move: own.move || null,
    shared_suspect: shared,
    /* Kept true for every row on purpose. A consumer that filters on it must not start hiding rows
     * because this predicate could not be decided; `shared_suspect` is the field to group on. */
    attributed: true,
    attribution_note: !shared ? null
      : 'the divergent line falls inside ' + own.who + '\'s ' + (own.move || 'move') + ', not the'
        + ' subject\'s' + (moveId ? ' ' + moveId : '') + ' at ' + subject + '. This row may share ONE'
        + ' defect in that slot with every other row whose game contained it — it is NOT dismissed.',
  });
}

function verdictFor(log, who, moveId) {
  const segs = segments(log).filter(s => s.move === moveId && (!who || s.who === who));
  if (!segs.length) return { attempted: false, resolved: false, why: 'the move was never issued — Showdown emitted no |move| line for it' };
  /* A DELAYED EFFECT LANDS OUTSIDE ITS OWN SEGMENT, and the authority says so itself. Wish heals at the
   * end of the FOLLOWING turn and emits nothing at all on the turn it is used, so a segment read alone
   * calls it inert. Showdown attributes every deferred effect with `[from] move: <Name>` — one derived
   * rule, no list of delayed moves, and it is checked only when the segment itself was empty so it can
   * never launder a move that plainly failed. */
  const NAME = (dex.moves.get(moveId) || {}).name || moveId;
  const attributedLater = log.some(l => String(l).indexOf('[from] move: ' + NAME) >= 0
                                     || String(l).indexOf('[from]move: ' + NAME) >= 0);
  let best = null;
  for (const s of segs) {
    if (s.cant) { best = best || { attempted: true, resolved: false, why: 'cant: ' + s.cant }; continue; }
    /* HARD vs PER-TARGET, and the distinction cost three false negatives before it was written down.
     *   HARD      `-fail` and `|cant|` NAME THE USER. The click itself did nothing, whatever else is
     *             in the segment.
     *   PER-TARGET `-miss`, `-immune`, `-notarget` and a guard `-activate` name ONE BODY. A spread move
     *             whose partner-side target is behind a Protect still resolved against the other one,
     *             and reading `-activate|p2b|move: Protect` as a refusal marked Earthquake, Rock Slide
     *             and Dazzling Gleam unresolved when the authority's own log showed them connecting.
     * So a per-target refusal counts only when the segment produced NO consequence at all. */
    let hard = null, soft = null, consequence = 0;
    for (const raw of s.lines) {
      const p = String(raw).split('|');
      const ev = p[1];
      if (ev === '-fail') { hard = hard || ('-fail' + (p[3] ? ' ' + p[3] : '')); continue; }
      if (REFUSAL.has(ev)) { soft = soft || (ev + (p[3] ? ' ' + p[3] : '')); continue; }
      if (ev === '-activate' && GUARDS.test(raw)) { soft = soft || 'blocked by a guard: ' + raw; continue; }
      if (NOT_A_CONSEQUENCE.has(ev)) continue;
      if (NONDASH_CONSEQUENCE.has(ev) || ev === 'move' || (ev && ev[0] === '-')) consequence++;
    }
    if (s.still && !consequence) soft = soft || 'the move was announced [still] and did nothing';
    if (!hard && !consequence && attributedLater) {
      return { attempted: true, resolved: true, why: null, consequences: 0,
               note: 'the effect landed OUTSIDE the move\'s own segment — Showdown attributed a later '
                   + 'line to it with [from] move: ' + NAME };
    }
    if (!hard && consequence) return { attempted: true, resolved: true, why: null, consequences: consequence };
    best = best || { attempted: true, resolved: false,
                     why: hard || soft || 'the move executed and produced no consequence line at all' };
  }
  return best;
}

/* WHAT A BUILT BODY WILL ACTUALLY CLICK. `scripted()` looks the ask up in Showdown's own request and
 * answers `pass` when it is not there — and Showdown REFUSES a pass from a healthy active body, which
 * throws the whole game. So every click in every script is read back off the body that has to make it,
 * never assumed from the species. This is the single most common way a staged scenario silently stops
 * testing what it was written for. */
function clickOf(body, prefs) {
  const have = (body.moves || []).map(id);
  for (const p of (prefs || [])) if (have.includes(id(p))) return id(p);
  return have[0] || 'protect';
}

/* ================= THE SCENARIO ===================================================================
 *
 * ONE actor in p1a, the receiver in p2a, a pad beside each. The script is a list of turns; the actor
 * clicks the mechanic under test on the LAST one, so anything that happens afterwards (a faint, a
 * forced switch) is outside the window the verdict is read from.
 *
 * A SETUP TURN IS DERIVED FROM THE MECHANIC'S OWN TAGS, never from a list of move names — docs/TAGS.md,
 * and the reason is that a hand list is wrong the day a move is added. What each rule reads is named
 * beside it. */
/* AN ABILITY THAT MOVES THE BOARD BEFORE THE SCENARIO DOES. Derived from the ability's own tags, so
 * an ability added later is caught without editing this file. `switchInForme`, `transformsOnEntry` and
 * the two setters are the ones that have actually bitten: see the carrier block in `runMoves`. */
const AB_TAGS = a => ((TAGS.abilities && TAGS.abilities[a] && TAGS.abilities[a].tags) || []);
const DISRUPTIVE = ['weatherSetter', 'terrainSetter', 'privateWeather', 'switchInForme', 'formeChange',
                    'transformsOnEntry', 'onSwitchInDrop', 'clearsAllyBoostsOnEntry', 'auraBoost',
                    'auraBreak', 'weatherSuppression', 'neutralizinggas'];
const DISRUPTIVE_ABILITY = (a) => AB_TAGS(a).some(t => DISRUPTIVE.indexOf(t) >= 0)
  /* Illusion carries no tag of its own and it renames the body the verdict is read from, which is the
   * one failure mode a stream-reading verdict cannot survive. Named, and named LOUDLY, because it is
   * the single exception to "derive it from the tag". */
  || a === 'illusion';
const MOVE_TAGS = m => ((TAGS.moves && TAGS.moves[m] && TAGS.moves[m].tags) || []);
const MOVE_PARAMS = m => ((TAGS.moves && TAGS.moves[m] && TAGS.moves[m].params) || {});
/* volatile -> a move that grants it TO THE USER, inverted out of `statusInflict` rather than listed.
 * Spit Up and Swallow declare `spendsVolatile {volatile:'stockpile', requires:true}`; this is how the
 * scenario finds Stockpile without anybody writing "Stockpile" down. */
const GRANTS_VOLATILE = new Map();
for (const [mid, row] of Object.entries(TAGS.moves || {})) {
  const eff = (row.params && row.params.statusInflict && row.params.statusInflict.effects) || [];
  for (const e of eff) if (e.volatile && e.to === 'user') {
    if (!GRANTS_VOLATILE.has(e.volatile)) GRANTS_VOLATILE.set(e.volatile, []);
    GRANTS_VOLATILE.get(e.volatile).push(mid);
  }
}
/* weather id -> a move that sets it, inverted out of `setsWeather`. Same rule, same reason. */
const SETS_WEATHER = new Map();
for (const [mid, row] of Object.entries(TAGS.moves || {})) {
  const w = row.params && row.params.setsWeather && row.params.setsWeather.weather;
  if (w && !SETS_WEATHER.has(w)) SETS_WEATHER.set(w, mid);
}
const SETS_TERRAIN = new Map();
for (const [mid, row] of Object.entries(TAGS.moves || {})) {
  const t = row.params && row.params.setsTerrain && row.params.setsTerrain.terrain;
  if (t && !SETS_TERRAIN.has(t)) SETS_TERRAIN.set(t, mid);
}

/* The SETUP a move needs before it can resolve, derived. Each entry returns extra moves the actor (or
 * its ally) must carry and extra script turns to play first. */
function setupFor(moveId, pool) {
  const tags = MOVE_TAGS(moveId), pars = MOVE_PARAMS(moveId);
  const pre = [];            // [{ actor: <moveid> }] — one script turn each, clicked by p1a
  const extra = [];          // moves the actor must also carry
  let receiverAttacks = null;  // 'physical' | 'special' — what p2a clicks on the CLICK turn
  let selfDamage = false;      // the receiver hits p1a first, so a heal has something to heal

  /* A MOVE THAT SPENDS A VOLATILE CANNOT RESOLVE WITHOUT IT. `requires: true` is the artifact's own
   * word for the precondition; the granting move is found by inverting `statusInflict`. */
  const sv = pars.spendsVolatile;
  if (sv && sv.requires && GRANTS_VOLATILE.has(sv.volatile)) {
    const g = GRANTS_VOLATILE.get(sv.volatile).find(x => pool.has(x));
    if (g) { extra.push(g); pre.push({ actor: g }); }
  }
  /* A MOVE THAT FAILS WITHOUT ITS SKY. `failsWithoutWeather` names the weather; the setter is found by
   * inverting `setsWeather`. If the actor cannot learn the setter the row is still attempted and the
   * failure is reported with Showdown's reason, which is the honest outcome. */
  const fw = pars.failsWithoutWeather;
  if (fw && (fw.weather || fw.needsWeather)) {
    /* `failsWithoutWeather` DOES NOT ALWAYS NAME A WEATHER. Aurora Veil's params read
     * `{needsWeather: true}` with no `weather` field, so a rule that keys on the name alone staged
     * nothing at all — and the row passed anyway for a WORSE reason: the alphabetically first carrier
     * was Abomasnow, whose Snow Warning had already put snow up. Fixing the carrier's ability exposed
     * the missing setup, which is the honest order for those two to be found in. Unnamed means ANY:
     * the first weather setter the carrier can learn. */
    const g = fw.weather && SETS_WEATHER.has(fw.weather) ? SETS_WEATHER.get(fw.weather)
            : [...SETS_WEATHER.values()].find(x => pool.has(x));
    if (g && pool.has(g)) { extra.push(g); pre.push({ actor: g }); }
  }
  const ft = pars.failsWithoutTerrain;
  if (ft && ft.terrain && SETS_TERRAIN.has(ft.terrain)) {
    const g = SETS_TERRAIN.get(ft.terrain);
    if (pool.has(g)) { extra.push(g); pre.push({ actor: g }); }
  }
  /* A MOVE THAT FAILS UNLESS THE TARGET IS ATTACKING. Sucker Punch, Counter, Mirror Coat, Metal Burst,
   * Comeuppance. `failsIfTargetNotAttacking` is the tag; the CATEGORY it must be hit by is the move's
   * own — a physical counter needs a physical hit. */
  /* `fixedDamage.retaliates` IS THE SAME PRECONDITION UNDER ANOTHER NAME, and Comeuppance carries only
   * that one — no `needsTargetToAttack` tag at all. Reading the params rather than the tag list catches
   * it, and `fixedDamage.category` says which half of the split it retaliates against (null = either). */
  const fd = pars.fixedDamage;
  if (tags.indexOf('failsIfTargetNotAttacking') >= 0 || tags.indexOf('needsTargetToAttack') >= 0
      || (fd && fd.retaliates)) {
    const cat = (fd && fd.category) ? (fd.category === 'special' ? 'Special' : 'Physical')
                                    : (dex.moves.get(moveId) || {}).category;
    receiverAttacks = cat === 'Special' ? 'special' : 'physical';
    /* Counter and Mirror Coat resolve only if the hit ALREADY LANDED this turn, so the actor must be
     * slower — it is, against an Agility-free receiver only by luck, so the receiver attacks on the
     * SAME turn and the pin resolves the order. Reported rather than assumed: if it does not resolve,
     * the reason line says so. */
  }
  /* A HEAL AT FULL HP FAILS. `healsSelf` / `healDescriptor` / `drain` all want a hole to fill; the
   * receiver punches one on a prior turn. */
  if (tags.indexOf('healsSelf') >= 0 || tags.indexOf('healDescriptor') >= 0) selfDamage = true;
  /* A HEAL THAT LANDS LATER NEEDS THE GAME TO STILL BE RUNNING WHEN IT DOES. `healDescriptor.when`
   * is the artifact's own word for it — Wish reads `endOfNextTurn` — and without a trailing turn the
   * script ends before the heal and the move looks inert. */
  const hd = pars.healDescriptor;
  const trailing = !!(hd && hd.when && hd.when !== 'immediate') ? 1 : 0;
  /* A CHARGE MOVE NEEDS TWO TURNS AND THE SECOND ONE IS THE RESOLUTION. `chargeTurn` is the tag; the
   * second turn's click is LOCKED by Showdown and carries no target field, which `scripted()` already
   * handles. */
  const charge = tags.indexOf('chargeTurn') >= 0 || tags.indexOf('semiInvulnerable') >= 0;
  const recharge = tags.indexOf('recharge') >= 0;
  return { pre, extra, receiverAttacks, selfDamage, charge, recharge, trailing };
}

/* ================= PLAYING ONE ROW ================================================================ */
let GAMES = 0, THREW = 0;

/* Build the two sheets and play. `spec` names the actor body, the receiver body, the script and the
 * move whose verdict is wanted. Returns the authority's verdict, medicham2's, and the divergence. */
/* THE FOUR BODIES ON THE FIELD, with distinct species so no sheet has a duplicate and no `switch`
 * ask is ambiguous. The two allies are pads and are chosen from the generated pool. */
function stageBodies(actor, receiver) {
  const used = new Set([id(actor.species), id(receiver.species)]);
  const pads = [];
  for (const pid of PAD_POOL) {
    if (pads.length >= 2) break;
    if (used.has(pid)) continue;
    const b = bodyOf(pid, '', '', PAD_MOVES);
    if (b) { pads.push(b); used.add(pid); }
  }
  /* WHICH BODY A SWITCH ASK MAY NAME. `sheetOf` fills p1's sheet with [actor, ally] and then pads from
   * `PAD_POOL` skipping what is already there, so slot 3 is the first pad that is neither — and slot 3
   * is on the bench of the four that play. Derived by the same rule the sheet uses rather than
   * guessed, because a `sw` ask naming a body that is not there resolves to `pass` on both sides and
   * Showdown then throws the game. */
  const benchKey = PAD_POOL.find(p => p !== id(actor.species) && (!pads[0] || p !== id(pads[0].species)));
  return { actor, ally: pads[0], receiver, foeAlly: pads[1], benchKey };
}

function playScenario(spec) {
  const aSheet = sheetOf([spec.actor, spec.ally]);
  const bSheet = sheetOf([spec.receiver, spec.foeAlly]);
  if (!aSheet || !bSheet) return { staged: false, why: 'a sheet could not be assembled' };
  const vA = validate(aSheet), vB = validate(bSheet);
  if (!vA.ok || !vB.ok) return { staged: false, why: 'TeamValidator refused the team',
                                 validator: vA.errors.concat(vB.errors) };
  /* THE POOL IS A SCENARIO PARAMETER. x6 keeps everything alive so no forced switch can manufacture a
   * divergence; x1 is the REAL pool, which is the only board on which a FRACTIONAL threshold — Sitrus
   * at a half, Focus Sash from full, Blaze at a third, Berserk at a half — can actually be crossed.
   * Both are used, in that order, and the row records which one it took. */
  const hpx = spec.hpBoost || HP_BOOST;
  const a6 = GD.buildPair(aSheet, { hpBoost: hpx, max: 6 });
  const b6 = GD.buildPair(bSheet, { hpBoost: hpx, max: 6 });
  if (!a6 || !b6) return { staged: false, why: 'buildPair could not build the validated sheet' };
  const a = a6.slice(0, 4), b = b6.slice(0, 4);
  let g;
  GAMES++;
  try { g = GD.playGame(a, b, 'all-mechanics-fire', spec.tag, { script: spec.script, arm: ARM }); }
  catch (e) { THREW++; return { staged: false, why: 'the game threw: ' + String(e.message || e).slice(0, 120) }; }
  const sdLog = GD.lastSdLog();
  return { staged: true, sdLog, mediTrace: g.mediTrace, div: g.div, turns: g.turns, err: g.err,
           validator_ok: true };
}

/* The script: `pre` turns then the click turn. EVERY SLOT GETS A STEP EVERY TURN, because Showdown
 * refuses `pass` for a healthy active body and a rejected choice throws the whole game away. Every one
 * of those steps is read back off the BUILT body via `clickOf`, so a script can never ask for a move
 * the body does not hold. */
function scriptFor(su, clickMove, bodies) {
  const { actor, ally, receiver, foeAlly } = bodies;
  /* THE TWO ALLIES CLICK PROTECT, AND THE ALTERNATIVE WAS TRIED FIRST AND WITHDRAWN — which is worth
   * recording, because withdrawing it is what turned it into a finding.
   *
   * Protect is a GUARD, so a spread move that reaches the ally slot writes `-activate|p1b|move: Protect`
   * into the very segment the verdict is read from. The obvious answer is Endure: priority +4, blocks
   * nothing, changes no damage figure, learnable by 263 of the 264 species this format admits. IT WAS
   * INSTALLED AND IT PARTED EVERY SINGLE GAME AT LINE 6:
   *
   *     showdown  |-singleturn|p2b: Charizard|move: Endure
   *     medicham  |-start|p2b: Charizard|move: endure
   *
   * That is a real medicham2 defect (Showdown's Endure condition is `onStart -> add('-singleturn', ...)`)
   * and it is REPORTED rather than worked around — but with it in every ally slot the comparison stops
   * at line 6 of every game and can see nothing else. The fixture goes back to Protect, and the
   * spread-move problem it causes is solved where it belongs instead: a guard refuses a move only when
   * the segment produced NO consequence at all (see `verdictFor`). */
  const allyClick = clickOf(ally, ['Protect', 'Endure']);
  const foeAllyClick = clickOf(foeAlly, ['Protect', 'Endure']);
  const inert = clickOf(receiver, ['Agility', 'Iron Defense', 'Endure', 'Rest', 'Protect']);
  /* THE HIT MUST ACTUALLY LAND ON THE ACTOR. A move the actor is IMMUNE to is not a hit, and a
   * scenario built on "the target attacked me" then measures nothing. The authority's own type chart
   * decides, per body. */
  const canReach = (mvid) => { const d = dex.moves.get(mvid); const sp = dex.species.get(id(actor.species));
    return !d || !sp ? true : dex.getImmunity(d.type, sp.types); };
  const pickHit = (prefs) => { const have = (receiver.moves || []).map(id);
    for (const pfx of prefs) { const k = id(pfx); if (have.includes(k) && canReach(k)) return k; }
    for (const k of have) { const d = dex.moves.get(k); if (d && d.category !== 'Status' && canReach(k)) return k; }
    return clickOf(receiver, prefs); };
  const phys = pickHit(['Facade', 'Aqua Tail', 'Body Slam']);
  const spec = pickHit(['Hydro Pump', 'Round']);
  const actorHit = clickOf(actor, ['Facade', 'Body Slam', 'Round', 'Endure']);
  const allyHit = clickOf(foeAlly, ['Facade', 'Body Slam', 'Protect']);
  const turns = [];
  const T = (p1a, p2a, p1b, p2b) => turns.push({
    p1: [p1a, p1b || { m: allyClick }], p2: [p2a, p2b || { m: foeAllyClick }] });
  /* RUNG 2 — A WARM-UP TURN. Disable, Encore and Spite all FAIL against a body that has not used a
   * move yet, and on a bare board the actor may act first, so the target's last move does not exist
   * when the click lands. One turn in which both sides simply act gives every body a history. */
  if (su.warmup) T({ m: actorHit, t: 0 }, { m: inert });
  /* RUNG 3 — EVERYBODY HAS TAKEN DAMAGE. A heal aimed at a full-HP body fails, and which body needs
   * the hole depends on the move (self, ally, or an arbitrary target). Rather than deriving three
   * separate rules, one turn puts a hole in all four. */
  if (su.everyoneHurt) T({ m: actorHit, t: 0 }, { m: phys, t: 0 }, { m: clickOf(ally, ['Rest', 'Protect']) },
                         { m: allyHit, t: 1 });
  for (const p of su.pre) T({ m: p.actor, t: 0 }, { m: inert });
  /* A HEAL AT FULL HP FAILS, so the receiver punches the hole one turn early. THE ACTOR SPENDS THAT
   * TURN ATTACKING, not on a filler, and that is the third fixture choice this file has had to make
   * for the same reason: Protect would block the very hit that makes the hole, Rest would heal the
   * hole shut and put the actor to sleep, and Endure parts the two streams at line 6. An ordinary
   * attack does none of the three. */
  if (su.selfDamage) T({ m: actorHit, t: 0 }, { m: phys, t: 0 });
  /* RUNG 5 — THE ACTOR IS ASLEEP. Sleep Talk and Snore are the only two moves in the format that
   * REQUIRE their user to be asleep, and there is no legal way to reach that state on a bare board
   * with a receiver that carries no sleep move. Rest does it to the actor itself, and Rest needs a
   * hole first — which `everyoneHurt` has already made. A body that cannot learn Rest SKIPS the turn
   * rather than clicking whatever came back instead: `clickOf` falls back to slot 1, which is the
   * move under test, and spending it on a setup turn would measure the wrong turn. */
  if (su.asleep) { const rest = clickOf(actor, ['Rest']); if (rest === 'rest') T({ m: rest }, { m: inert }); }
  const foe = su.receiverAttacks === 'physical' ? phys : su.receiverAttacks === 'special' ? spec : inert;
  const click = { m: clickMove, t: 0 };
  T(click, { m: foe, t: 0 });
  /* A CHARGE MOVE SPENDS TURN ONE CHARGING; the RESOLUTION is on turn two, and Showdown LOCKS the
   * second click (no target field at all), which `scripted()` already handles. */
  if (su.charge) T(click, { m: foe, t: 0 });
  for (let k = 0; k < (su.trailing || 0); k++) T({ m: actorHit, t: 0 }, { m: inert });
  return turns;
}

/* ================= MOVES ==========================================================================
 *
 * THE ESCALATION LADDER. Rung 0 is the tag-derived scenario. A move that does not resolve there is
 * retried on progressively richer boards, and the row records WHICH RUNG caught it — so "it resolved"
 * always comes with what it took.
 *
 * EVERY RUNG IS GENERIC. None of them names a move, a species or an item, which is the whole point:
 * the alternative is a hand-written precondition table, and docs/TAGS.md says why that rots. A rung
 * describes a SHAPE OF BOARD ("everyone has taken damage", "both sides hold something") and any move
 * that needs that shape finds it. The cost is that a rung can be reached for the wrong reason, which
 * is why the rung is recorded rather than hidden. */
const RUNGS = [
  { id: 'bare', what: 'the tag-derived scenario and nothing else' },
  { id: 'items', what: 'both sides hold a berry — reaches every move that reads, takes, flings or '
                     + 'eats an item, none of which can resolve on an empty-handed board',
    apply: (su) => { su.actorItem = 'Sitrus Berry'; su.receiverItem = 'Sitrus Berry'; } },
  { id: 'warm-up', what: 'one turn in which both sides simply act, so every body has a last move — '
                       + 'Disable, Encore and Spite all fail without one',
    apply: (su) => { su.warmup = true; } },
  { id: 'everyone-hurt', what: 'one turn in which all four bodies take damage — a heal aimed at a '
                             + 'full-HP body fails, whichever body the move aims at',
    apply: (su) => { su.everyoneHurt = true; su.warmup = true; } },
  { id: 'hurt+items', what: 'both at once — the berry is then EATEN, which is the only board on which '
                          + 'Belch and Recycle can resolve',
    apply: (su) => { su.everyoneHurt = true; su.actorItem = 'Sitrus Berry'; su.receiverItem = 'Sitrus Berry'; } },
  { id: 'asleep', what: 'the actor Rests itself to sleep first — Sleep Talk and Snore require it and '
                      + 'no receiver in this fixture carries a sleep move',
    apply: (su) => { su.everyoneHurt = true; su.asleep = true; } },
];

function runMoves(list) {
  const rows = [];
  for (const mv of list) {
    const dm = dex.moves.get(mv);
    const carriers = CARRIERS.get(mv) || [];
    if (!carriers.length) {
      rows.push({ kind: 'move', id: mv, name: dm.name, resolved: false, attempted: false,
                  why: 'NO LEGAL CARRIER — no species this format admits can learn it', unreachable: true });
      continue;
    }
    /* THE CARRIER IS THE FIRST LEGAL ONE THAT CAN ALSO CARRY THE SETUP. Deterministic, so a re-run
     * plays the same game; a carrier that cannot hold the precondition is skipped rather than played
     * into a failure this file already knows about. */
    let chosen = null, su = null;
    for (const c of carriers) {
      const pool = POOL.get(c);
      const s = setupFor(mv, pool);
      if (s.pre.length && !s.pre.every(p => pool.has(p.actor))) continue;
      chosen = c; su = s; break;
    }
    if (!chosen) { chosen = carriers[0]; su = setupFor(mv, POOL.get(carriers[0])); }
    /* THE CARRIER'S OWN ABILITY MUST NOT SABOTAGE THE TEST, and two rows proved it does. Abomasnow is
     * the alphabetically first legal Snowscape carrier and it has SNOW WARNING, so snow is already up
     * when the click lands and Showdown answers `-fail` — a correct engine reported as an unresolved
     * move. Zoroark-Hisui is the first Bitter Malice carrier and it has ILLUSION, so the body standing
     * in p1a is not the one the verdict is looking for.
     *
     * The disqualifying set is READ OFF THE ABILITY TAGS, never listed here: an ability that sets
     * weather or terrain, changes forme on entry, or transforms is one that moves the board before the
     * scenario does. A carrier with no clean ability is used anyway and the ability is RECORDED, so a
     * reader can tell an engine result from a fixture artefact. */
    const cleanAb = (sid) => {
      const abs = Object.values(dex.species.get(sid).abilities || {});
      return abs.find(a => !DISRUPTIVE_ABILITY(id(a))) || null;
    };
    const better = carriers.find(c => cleanAb(c) && (!su.pre.length || su.pre.every(p => POOL.get(c).has(p.actor))));
    if (better && !cleanAb(chosen)) { chosen = better; su = setupFor(mv, POOL.get(better)); }
    const useAbility = cleanAb(chosen) || Object.values(dex.species.get(chosen).abilities)[0];
    /* WHAT ELSE THE ACTOR CARRIES: the move under test, whatever the tag-derived setup needs, and then
     * the two fixture clicks the ladder's richer rungs use — an ordinary attack and Rest. Four slots,
     * so the setup always wins the ties. */
    const wants = [mv].concat(su.extra, ['facade', 'rest', 'protect']);
    const actor = bodyOf(chosen, useAbility, '', wants);
    if (!actor || !actor.moves.some(x => id(x) === mv)) {
      rows.push({ kind: 'move', id: mv, name: dm.name, resolved: false, attempted: false,
                  carrier: chosen, why: 'the carrier body could not be built holding the move' });
      continue;
    }
    const who = 'p1a: ' + (dex.species.get(chosen).baseSpecies || dex.species.get(chosen).name);
    let best = null;
    for (const rung of RUNGS) {
      const s = Object.assign({}, su, { pre: su.pre.slice() });
      if (rung.apply) rung.apply(s);
      const actor2 = bodyOf(chosen, useAbility, s.actorItem || '', wants);
      const receiver = bodyOf(RECEIVER.species, RECEIVER.ability, s.receiverItem || RECEIVER.item, RECEIVER_MOVES);
      if (!actor2 || !receiver) break;
      const bodies = stageBodies(actor2, receiver);
      const script = scriptFor(s, mv, bodies);
      const r = playScenario(Object.assign({ script, tag: 'move/' + mv + '/' + rung.id }, bodies));
      if (!r.staged) { best = best || { kind: 'move', id: mv, name: dm.name, carrier: chosen, resolved: false,
                                        attempted: false, rung: rung.id, why: r.why, validator: r.validator }; continue; }
      const sd = verdictFor(r.sdLog, who, mv);
      const me = verdictFor(r.mediTrace, who, mv);
      const row = { kind: 'move', id: mv, name: dm.name, carrier: chosen, rung: rung.id,
                    setup: s.pre.map(p => p.actor), turns: script.length,
                    attempted: sd.attempted, resolved: sd.resolved, why: sd.why,
                    medicham_attempted: me.attempted, medicham_resolved: me.resolved, medicham_why: me.why,
                    diverged: !!r.div, divergence: divOf(r.div, who, r.sdLog, mv),
                    err: r.err };
      if (DUMPLOG) {
        console.log('  ---- ' + mv + ' [' + rung.id + ']  carrier ' + chosen + '  script ' + JSON.stringify(script));
        console.log('  SHOWDOWN:'); for (const l of r.sdLog) console.log('    ' + l);
        console.log('  MEDICHAM:'); for (const l of r.mediTrace) console.log('    ' + l);
      }
      /* THE FIRST RUNG THAT RESOLVES WINS AND THE LADDER STOPS. A row that never resolves keeps the
       * FIRST rung's reason, because the bare board's reason is the one that describes the move — the
       * richer boards' reasons describe the fixture. */
      best = best || row;
      if (sd.resolved) { best = row; break; }
    }
    if (best) rows.push(best);
    if (VERBOSE && best) console.log('    ' + mv + '  ' + (best.resolved ? 'RESOLVED [' + best.rung + ']' : 'NOT: ' + best.why));
  }
  return rows;
}

/* ================= ABILITIES AND ITEMS — THE A/B ARM ============================================== */
/* THE SAME GAME TWICE, THE MECHANIC AND ITS CONTROL. See the header for why this is a differential
 * rather than a stream read: an ability that emits no protocol line still changes the game, and
 * "changed the game" is the only definition of FIRED that does not need a hand-written trigger list. */
function abControlFor(species, ability) {
  const abs = Object.values(dex.species.get(species).abilities || {});
  const other = abs.find(a => id(a) !== id(ability));
  return other || null;
}
/* THE GAUNTLET. Four turns that between them reach a large share of ability and item triggers WITHOUT
 * NAMING ANY OF THEM — which is the docs/TAGS.md rule: match on shape, never on a name, so a mechanic
 * added later is reached without editing this file.
 *
 *   the leads          an ENTRY — Intimidate, Drought, Download, Trace, Imposter, Air Balloon
 *   the actor attacks  a CONTACT PHYSICAL click — Tough Claws, Sheer Force, Life Orb, Rocky-Helmet-shaped
 *                      punishers on the far side, Poison Touch, contact-KO abilities
 *   it is hit, twice   once PHYSICAL and once SPECIAL — Weak Armor, Justified, Rattled, Static,
 *                      Rough Skin, resist berries, Focus Sash, Air Balloon popping, damage-reducers
 *   it switches out    a SWITCH-OUT trigger — Regenerator, Natural Cure, Zero to Hero, Emergency Exit
 *
 * Everything a tag names is reached by one of these or is reported DID-NOT-FIRE, and DID-NOT-FIRE is a
 * gap in THIS instrument rather than a pass. Every click is read off the built body by `clickOf`. */
const GAUNTLET_ACTOR_MOVES = ['Facade', 'Endure', 'Rest', 'Substitute'];

/* The adversary table lives in its own module — see engine/faces.js. It is required rather
 * than defined here because THIS FILE RUNS ON REQUIRE: a probe that merely wanted to read the table
 * kicked off a whole sweep the first time I tried it. A table is data and must be importable without
 * starting an instrument. */
const { FACES, facesFor } = require('./faces.js');

function gauntletScript(bodies, beats) {
  const { actor, ally, receiver, foeAlly } = bodies;
  const hit = clickOf(actor, ['Facade', 'Body Slam', 'Round', 'Protect']);
  const A = { m: clickOf(ally, ['Protect', 'Endure']) };
  const F = { m: clickOf(foeAlly, ['Protect', 'Endure']) };
  const phys = clickOf(receiver, ['Facade', 'Aqua Tail']);
  const spec = clickOf(receiver, ['Hydro Pump', 'Round']);
  const inert = clickOf(receiver, ['Agility', 'Endure']);
  const turns = [];
  /* HOW MANY TIMES THE ACTOR IS HIT. One physical and one special reaches an on-hit trigger; a
   * THRESHOLD trigger — Sitrus at a half, Focus Sash, Blaze, Berserk, Emergency Exit — needs the HP
   * bar to actually travel, which takes repetition and a real HP pool. */
  for (let k = 0; k < (beats || 1); k++) {
    turns.push({ p1: [{ m: hit, t: 0 }, A], p2: [{ m: phys, t: 0 }, F] });
    turns.push({ p1: [{ m: hit, t: 0 }, A], p2: [{ m: spec, t: 0 }, F] });
  }
  /* THE SWITCH IS THE LAST TURN AND IT IS AN ASK, not a hope: `{sw}` names the bench body by the
   * same `_switchKey` both engines stamp, so a switch-out trigger has an actual switch to fire on. */
  turns.push({ p1: [{ sw: id(bodies.benchKey) }, A], p2: [{ m: inert }, F] });
  return turns;
}
/* THE TWO RUNGS EVERY ABILITY AND ITEM ROW IS TRIED ON. Rung 1 is the safe board — nothing faints, so
 * no forced switch can manufacture a divergence. Rung 2 is the REAL pool and a longer beating, which
 * is the only board a fractional threshold can be crossed on; it can end in a faint, and that is the
 * price of reaching Sitrus, Focus Sash and Blaze at all. */
const AB_RUNGS = [
  { id: 'safe-pool', hpBoost: HP_BOOST, beats: 1 },
  { id: 'real-pool', hpBoost: 1, beats: 3 },
];
function abLadder(kind, key, name, carrier, control, mkOn, mkOff, receiver) {
  let best = null;
  for (const rung of AB_RUNGS) {
    const onB = stageBodies(mkOn(), receiver), offB = stageBodies(mkOff(), receiver);
    const on = playScenario(Object.assign({ script: gauntletScript(onB, rung.beats), hpBoost: rung.hpBoost,
                                            tag: kind + '/' + key + '/on/' + rung.id }, onB));
    const off = playScenario(Object.assign({ script: gauntletScript(offB, rung.beats), hpBoost: rung.hpBoost,
                                             tag: kind + '/' + key + '/off/' + rung.id }, offB));
    const row = abRow(kind, key, name, carrier, control, on, off);
    row.rung = rung.id;
    best = best || row;
    if (row.verdict && row.verdict !== 'DID-NOT-FIRE') { best = row; break; }
  }
  return best;
}

function runAbilities(list) {
  const rows = [];
  for (const ab of list) {
    const da = dex.abilities.get(ab);
    const carriers = (AB_CARRIERS.get(ab) || []);
    if (!carriers.length) {
      rows.push({ kind: 'ability', id: ab, name: da.name, fired: false, unreachable: true,
                  why: 'NO LEGAL CARRIER — no species this format admits has it' });
      continue;
    }
    const c = carriers.find(s => abControlFor(s, ab)) || carriers[0];
    const ctrl = abControlFor(c, ab);
    if (!ctrl) {
      rows.push({ kind: 'ability', id: ab, name: da.name, carrier: c, fired: false,
                  why: 'NO CONTROL — every legal carrier has this as its only ability, so the A/B arm '
                     + 'has nothing to swap it for. The row is not measurable by this instrument.' });
      continue;
    }
    const mkActor = (which) => bodyOf(c, which, '', GAUNTLET_ACTOR_MOVES);
    const receiver = bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES);
    const a1 = mkActor(da.name), a2 = mkActor(ctrl);
    if (!a1 || !a2 || !receiver) {
      rows.push({ kind: 'ability', id: ab, name: da.name, carrier: c, fired: false,
                  why: 'the carrier body could not be built' });
      continue;
    }
    /* THE CARRIER MUST NOT BE THE RECEIVER. Feraligatr holds Torrent and Sheer Force, so those two
     * rows put the same species on both sides — the sheets then collide, `stageBodies` is handed a
     * null, and the whole run died at ability 250 of 316. */
    if (id(a1.species) === id(receiver.species)) {
      rows.push({ kind: 'ability', id: ab, name: da.name, carrier: c, fired: false,
                  why: 'the only legal carrier IS the receiver fixture — this instrument cannot put '
                     + 'the same species on both sides of the field' });
      continue;
    }
    rows.push(abLadder('ability', ab, da.name, c, ctrl,
                       () => mkActor(da.name), () => mkActor(ctrl), receiver));
  }
  /* THE CONTROL ARM IS ITSELF AN ABILITY, AND WHEN IT IS A LIVE ONE THE PAIR CANNOT SAY WHICH OF THE
   * TWO MOVED THE GAME. The deliberate roster hit this first and named it `CONTROL-NOT-QUIET` on 15 of
   * its own rows; the same hazard is here and it is annotated rather than hidden, because a row that
   * says FIRED for its neighbour's reason is worse than one that says it does not know.
   *
   * DETECTED FROM THIS RUN'S OWN RESULTS: an ability used as a control is "not quiet" if its own row
   * moved a game. That is a derived test, not a list, and it needs no extra games. DISAMBIGUATING it
   * needs a THIRD arm against a control proven inert, which this pass did NOT run — so the ambiguity
   * is reported, not resolved. */
  const live = new Set(rows.filter(r => r.showdown_moved || r.medicham_moved).map(r => r.id));
  for (const r of rows) {
    if (!r.control || !live.has(id(r.control))) continue;
    r.control_not_quiet = true;
    r.control_note = 'the CONTROL ability (' + r.control + ') is itself live in this run, so the pair '
                   + 'cannot say which of the two moved the game. A third arm would settle it; this pass did not run one.';
  }
  return rows;
}

/* THE ITEM HOLDER. It must be able to click a contact physical attack (so an offensive item has
 * something to modify) and must not be the receiver. Chosen once and named, so every item row is the
 * same game with one field changed. */
const ITEM_HOLDER = 'corviknight';
function runItems(list) {
  const rows = [];
  for (const it of list) {
    const di = dex.items.get(it);
    /* A MEGA STONE IS NOT AN ITEM TEST — it is the mega mechanism, which `game_differential`'s own
     * mega counters already measure, and a stone on a body that cannot use it is inert by definition.
     * Declared, not silently skipped. */
    if (di.megaStone || di.zMove || di.isPokeball) {
      rows.push({ kind: 'item', id: it, name: di.name, fired: false, out_of_scope: true,
                  why: (di.megaStone ? 'a mega stone — measured by the mega counters, not here'
                        : 'not a held item this format uses in battle') });
      continue;
    }
    /* AN ITEM'S CARRIER IS FREE — any legal body may hold any legal item — so it is FIXED, and fixing
     * it is what makes the A/B honest: the two arms then differ in the item and in nothing else. */
    const c = ITEM_HOLDER;
    const mkActor = (item) => bodyOf(c, '', item, GAUNTLET_ACTOR_MOVES);
    const receiver = bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES);
    rows.push(abLadder('item', it, di.name, c, '(no item)',
                       () => mkActor(di.name), () => mkActor(''), receiver));
  }
  return rows;
}

function abRow(kind, key, name, carrier, control, on, off) {
  if (!on.staged || !off.staged) {
    return { kind, id: key, name, carrier, control, fired: false,
             why: 'could not stage: ' + (on.why || off.why), validator: on.validator || off.validator };
  }
  /* THE COMPARISON RUNS ON THE REDUCED STREAM, AND THE RAW ONE WAS A NON-DETERMINISM BUG.
   *
   * Showdown's log carries `|t:|<unix seconds>` timestamp lines. Comparing the raw logs of the two
   * arms therefore reported "the game changed" whenever the two arms happened to straddle a second
   * boundary — and two identical invocations of this file, minutes apart, returned
   * `showdown_only: 23` and `showdown_only: 16`. A non-deterministic instrument is worth nothing, and
   * this one WAS non-deterministic until it was caught by re-running it twice and comparing, which is
   * the only reason it was caught at all.
   *
   * `sdStream` is the DRIVER'S OWN reducer — the same function the differential aligns with — so what
   * counts as a meaningful line is decided in one place rather than two. */
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const sdMoved = !same(GD.sdStream(on.sdLog), GD.sdStream(off.sdLog));
  const meMoved = !same(on.mediTrace, off.mediTrace);
  let verdict;
  if (sdMoved && meMoved) verdict = 'FIRED';
  else if (sdMoved && !meMoved) verdict = 'SHOWDOWN-ONLY';
  else if (!sdMoved && meMoved) verdict = 'MEDICHAM-ONLY';
  else verdict = 'DID-NOT-FIRE';
  return { kind, id: key, name, carrier, control, verdict, fired: verdict === 'FIRED',
           showdown_moved: sdMoved, medicham_moved: meMoved,
           why: verdict === 'DID-NOT-FIRE'
             ? 'the gauntlet never reached its trigger — swapping it for ' + control + ' changed neither game'
             : null,
           diverged: !!on.div,
           /* Every subject this harness stages sits at p1a — the move path builds `who` as
            * 'p1a: <Species>' and the ability gauntlet does the same. `abRow` is not handed that
            * string, so the slot is named directly rather than reaching for a variable not in scope.
            *
            * TARGET 'all', SO AN ABILITY ROW IS NEVER DISOWNED. A move has a declared target and the
            * reach test is exact; an ABILITY has none, and its effect can legitimately land anywhere
            * on the field — Friend Guard changes the PARTNER'S damage, Intimidate the opponents', Rough
            * Skin the attacker's. Narrowing this to the holder's own slot would invent a false-negative
            * class exactly where Friend Guard lives, which is an open defect in this very run. The
            * ability arm therefore keeps its previous behaviour and attributes everything; when an
            * ability row needs finer attribution it needs a reach derived from its TAG, not a guess. */
           divergence: divOf(on.div, "p1a", on.sdLog, null) };
}

/* ================= THE RED DEMONSTRATION ========================================================== */
/* An instrument that has never failed is not evidence. Each plant attacks a DIFFERENT claim this file
 * makes, and each must be caught by the same code path a real run uses. */
function red() {
  const out = [];
  const receiver = bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES);
  /* THE PLANTED MOVE AND ITS CARRIER ARE DERIVED, not named, so this demonstration cannot rot into a
   * test of two species that stopped being legal. An Electric attack, its first legal carrier, and the
   * first legal species that is IMMUNE to it — asked of the authority's own type chart. */
  const PLANT_MOVE = 'thunderbolt';
  const carrier = (CARRIERS.get(PLANT_MOVE) || [])[0];
  const immuneSp = LEGAL_SPECIES.find(s => dex.getEffectiveness('Electric', s.types) === 0
    ? false : dex.getImmunity('Electric', s.types) === false);
  const actorOf = () => bodyOf(carrier, '', '', [mvName(PLANT_MOVE), 'Protect']);
  const who = 'p1a: ' + (dex.species.get(carrier).baseSpecies || dex.species.get(carrier).name);
  const one = (recv, tag) => {
    const b = stageBodies(actorOf(), recv);
    const script = scriptFor({ pre: [], extra: [], receiverAttacks: null, selfDamage: false, charge: false }, PLANT_MOVE, b);
    const r = playScenario(Object.assign({ script, tag }, b));
    return { r, v: r.staged ? verdictFor(r.sdLog, who, PLANT_MOVE) : { resolved: null, why: r.why } };
  };
  /* 1. A MOVE THAT CANNOT RESOLVE. An Electric attack into a Ground type is a type immunity; the
   *    verdict must be NOT RESOLVED, carrying the authority's own `-immune`, not a credited row. */
  {
    const ground = bodyOf(immuneSp.id, '', '', ['Agility', 'Endure', 'Protect']);
    const { r, v } = one(ground, 'red/immune');
    out.push({ plant: 'a move clicked into a TYPE IMMUNITY must not be credited (' + PLANT_MOVE
                    + ' into ' + (immuneSp && immuneSp.name) + ')',
               staged: r.staged, resolved: v.resolved, why: v.why,
               caught: r.staged && v.resolved === false });
  }
  /* 1b. THE SAME MOVE INTO A LEGAL TARGET MUST BE CREDITED. A detector that says NO to everything is
   *     not a detector; the plant above proves nothing without this control beside it. */
  {
    const { r, v } = one(receiver, 'red/control');
    out.push({ plant: 'CONTROL — the same move into a legal target MUST be credited',
               staged: r.staged, resolved: v.resolved, why: v.why,
               caught: r.staged && v.resolved === true });
  }
  /* 2. THE A/B ARM MUST SAY DID-NOT-FIRE WHEN THE TWO ARMS ARE THE SAME ABILITY. Swapping an ability
   *    for ITSELF cannot change a game, so a verdict of FIRED here would mean the comparison is
   *    reading noise — which under a pinned die it must not be. */
  {
    const mk = () => stageBodies(bodyOf(ITEM_HOLDER, '', '', GAUNTLET_ACTOR_MOVES), receiver);
    const b1 = mk(), b2 = mk();
    const on = playScenario(Object.assign({ script: gauntletScript(b1), tag: 'red/ab-on' }, b1));
    const off = playScenario(Object.assign({ script: gauntletScript(b2), tag: 'red/ab-off' }, b2));
    const row = abRow('ability', 'control', '(the same ability twice)', ITEM_HOLDER, '(itself)', on, off);
    out.push({ plant: 'a mechanic swapped for ITSELF must read DID-NOT-FIRE — a FIRED here is noise',
               staged: !!row.verdict, verdict: row.verdict, why: row.why,
               caught: row.verdict === 'DID-NOT-FIRE' });
  }
  /* 3. A CORRUPTED MEDICHAM STREAM MUST BE REPORTED AS A DIVERGENCE. `game_differential`'s own plant
   *    machinery, run through THIS file's scenario, so "the comparison is live in these games" is
   *    demonstrated here rather than inherited from another file's run. */
  {
    const b = stageBodies(actorOf(), receiver);
    const script = scriptFor({ pre: [], extra: [], receiverAttacks: null, selfDamage: false, charge: false }, PLANT_MOVE, b);
    const aS = sheetOf([b.actor, b.ally]), bS = sheetOf([b.receiver, b.foeAlly]);
    const pa = GD.buildPair(aS, { hpBoost: HP_BOOST, max: 6 }).slice(0, 4);
    const pb = GD.buildPair(bS, { hpBoost: HP_BOOST, max: 6 }).slice(0, 4);
    const clean = GD.playGame(pa, pb, 'all-mechanics-fire', 'red/clean', { script, arm: ARM });
    const bent = GD.playGame(pa, pb, 'all-mechanics-fire', 'red/bent', { script, arm: ARM,
      plant: (s) => { const t = s.slice(); for (let i = 0; i < t.length; i++) {
        if (/^\|-damage\|/.test(String(t[i]))) { const p = String(t[i]).split('|'); p[3] = '1/999'; t[i] = p.join('|'); break; } }
        return t; } });
    out.push({ plant: 'a corrupted medicham2 damage line must be caught as a divergence',
               clean_diverged: !!clean.div, bent_diverged: !!bent.div,
               bent_cause: bent.div ? GD.classify(bent.div).cls : null,
               caught: !clean.div && !!bent.div });
  }
  /* 4. THE SAME QUESTION ASKED TWICE MUST GIVE THE SAME ANSWER, and this plant exists because the
   *    instrument FAILED it. Showdown's log carries `|t:|<unix seconds>`, the A/B arm compared raw
   *    logs, and two identical runs minutes apart returned 23 and then 16 SHOWDOWN-ONLY abilities. A
   *    non-deterministic instrument produces findings that cannot be acted on and regressions that
   *    cannot be seen. Nothing in the earlier plants could catch it — they each run once. */
  {
    const mk = () => stageBodies(bodyOf(ITEM_HOLDER, '', 'Sitrus Berry', GAUNTLET_ACTOR_MOVES), receiver);
    const play = () => { const b = mk();
      const on = playScenario(Object.assign({ script: gauntletScript(b), tag: 'red/det-on' }, b));
      const b2 = stageBodies(bodyOf(ITEM_HOLDER, '', '', GAUNTLET_ACTOR_MOVES), receiver);
      const off = playScenario(Object.assign({ script: gauntletScript(b2), tag: 'red/det-off' }, b2));
      return abRow('item', 'sitrusberry', 'Sitrus Berry', ITEM_HOLDER, '(no item)', on, off); };
    const a = play(), b = play();
    out.push({ plant: 'THE SAME A/B ASKED TWICE MUST GIVE THE SAME VERDICT — the instrument failed this once',
               verdict: a.verdict + ' then ' + b.verdict,
               caught: a.verdict === b.verdict && a.showdown_moved === b.showdown_moved
                    && a.medicham_moved === b.medicham_moved });
  }
  return out;
}

/* ================= THE OVERLAP WITH THE DELIBERATE ROSTER ========================================= */
/* The roster stages a SINGLE TURN on a built board; this plays a REAL GAME. The interesting output is
 * not either list but the INTERSECTION and the two differences — and above all the set NEITHER
 * reaches, which is what is still untested by anything. Read out of the roster's own artifact, never
 * restated here. */
const ROSTER_FILE = { moves: 'data/roster.moves.json', abilities: 'data/roster.abilities.json',
                      items: 'data/roster.items.json' };
function rosterOverlap(kind, rows) {
  let roster;
  try { roster = JSON.parse(fs.readFileSync(D(ROSTER_FILE[kind]), 'utf8')); }
  catch (e) { return { available: false, why: 'no roster artifact for ' + kind + ': ' + e.message }; }
  /* THE ROSTER'S OWN WORD FOR "IT FIRED". `FIRED-AND-BOARDS-*` is a fired row whatever the board did;
   * `COULD-NOT-STAGE` is the roster admitting it never reached the mechanic, which is exactly the set
   * this instrument exists to attack. Read out of the artifact, never restated. */
  const staged = new Set(), notStaged = new Set();
  for (const r of roster.results || []) {
    (/^FIRED/.test(String(r.verdict)) ? staged : notStaged).add(r.id);
  }
  const mine = new Set(rows.filter(r => (kind === 'moves' ? r.resolved : r.verdict === 'FIRED')).map(r => r.id));
  const both = [...mine].filter(x => staged.has(x));
  const onlyHere = [...mine].filter(x => !staged.has(x));
  const onlyRoster = [...staged].filter(x => !mine.has(x));
  const neither = [...notStaged].filter(x => !mine.has(x));
  return { available: true, file: ROSTER_FILE[kind], roster_fired: staged.size, here_fired: mine.size,
           both: both.length, only_here: onlyHere.sort(), only_roster: onlyRoster.sort(),
           neither: neither.sort(),
           what_neither_means: 'NEITHER the staged single-turn roster nor a real game has made this fire. '
                             + 'This is the set nothing in the project tests.' };
}

/* THE DIVERGENCES, COLLAPSED ONTO THE DRIVER'S OWN SPECIES-BLIND CAUSE, with the rows that carry each
 * one named. A bare count answers "how many games parted"; this answers "how many BUGS", which is the
 * number a fix list is made of. */
function reportCauses(rows) {
  /* ATTRIBUTED AND UNATTRIBUTED ARE COUNTED APART, and mixing them was worth three false findings.
   * A divergence on the PARTNER slot is one bug in that slot; charged to every row whose game
   * happened to contain it, it reads as N bugs in N subjects and inflates the fix list. Both are
   * printed — an unattributed cause is still a real defect, just not this row's. */
  const tally = (pred) => {
    const by = new Map();
    for (const r of rows) {
      if (!r.divergence || !pred(r.divergence)) continue;
      const k = r.divergence.cause;
      if (!by.has(k)) by.set(k, { n: 0, cls: r.divergence.cls, who: [], sd: r.divergence.showdown,
                                  me: r.divergence.medicham, slot: r.divergence.diverged_slot });
      const e = by.get(k); e.n++; if (e.who.length < 6) e.who.push(r.id);
    }
    return [...by.entries()].sort((a, b) => b[1].n - a[1].n);
  };
  const show = (label, list, cap) => {
    if (!list.length) return;
    console.log('    ' + label + ' — ' + list.length + ' distinct, across '
              + list.reduce((s, [, e]) => s + e.n, 0) + ' rows:');
    for (const [, e] of list.slice(0, cap)) {
      console.log('      ' + String(e.n).padStart(4) + '  [' + e.cls + ']' + (e.slot ? '  slot ' + e.slot : ''));
      console.log('            showdown  ' + e.sd);
      console.log('            medicham  ' + e.me);
      console.log('            e.g. ' + e.who.join(', '));
    }
  };
  const mine = tally(d => !d.shared_suspect);
  const other = tally(d => d.shared_suspect);
  show('DIVERGENCE CAUSES', mine, 25);
  if (other.length) {
    console.log('');
    console.log('    SHARED SUSPECTS — the divergent line fell inside ANOTHER slot\'s move, not the');
    console.log('    subject\'s. NOTHING HERE IS DISMISSED. Each is a real divergence; the open question');
    console.log('    is whether it is one defect in that slot shared by every row whose game contained');
    console.log('    it, or a genuine consequence of each subject. Reading one full log decides it, and');
    console.log('    three attempts to decide it by rule each produced a different wrong answer.');
    show('SHARED-SUSPECT CAUSES', other, 15);
  }
  const emit = ([cause, e]) => ({ cause, n: e.n, cls: e.cls, showdown: e.sd, medicham: e.me,
                                  rows: e.who, slot: e.slot });
  return { attributed: mine.map(emit), other_slot: other.map(emit) };
}

/* ================= MAIN =========================================================================== */
function pick(all) {
  let list = all;
  if (ONLY) { const want = new Set(ONLY.split(',').map(id)); list = list.filter(x => want.has(x)); }
  if (LIMIT) list = list.slice(0, LIMIT);
  return list;
}

console.log('\n  ALL MECHANICS FIRE — ROADMAP #143');
console.log('  release ' + (GD.REL.id || '(live)') + '   arm ' + ARM.id);
console.log('  the format admits ' + LEGAL_SPECIES.length + ' species, ' + LEGAL_MOVES.length + ' moves, '
          + LEGAL_ABILITIES.length + ' abilities, ' + LEGAL_ITEMS.length + ' items');
if (POOL_FAILS.length) console.log('  ' + POOL_FAILS.length + ' species move pools could not be built: ' + POOL_FAILS.slice(0, 5).join('; '));

const REDS = red();
console.log('\n  THE RED DEMONSTRATION — the comparison must be shown catching something before any green counts:');
for (const r of REDS) console.log('    ' + (r.caught ? 'CAUGHT  ' : 'NOT CAUGHT  ') + r.plant
  + (r.why ? '   [' + r.why + ']' : '') + (r.verdict ? '   [' + r.verdict + ']' : '')
  + (r.bent_cause ? '   [' + r.bent_cause + ']' : ''));
const RED_OK = REDS.every(r => r.caught);
if (!RED_OK) { console.log('    A PLANT WAS NOT CAUGHT. Every verdict below would be the instrument, not the engine.'); process.exitCode = 1; }
if (RED) { if (WRITE) fs.writeFileSync(OUT || D('data', 'all-mechanics-fire.json'), JSON.stringify({ red: REDS }, null, 1)); return; }

const report = { generated: new Date().toISOString(), release: GD.REL.id || null, arm: ARM.id,
                 format: CS.FORMAT, red: REDS, red_ok: RED_OK, rows: {}, summary: {} };

if (KIND === 'moves' || KIND === 'all') {
  const list = pick(LEGAL_MOVES);
  console.log('\n  MOVES — ' + list.length + ' of ' + LEGAL_MOVES.length + ' attempted');
  const t0 = Date.now();
  const rows = runMoves(list);
  report.rows.moves = rows;
  const resolved = rows.filter(r => r.resolved);
  const attempted = rows.filter(r => r.attempted);
  const diverged = rows.filter(r => r.diverged);
  const disagree = rows.filter(r => r.attempted && r.resolved !== r.medicham_resolved);
  report.summary.moves = { exist: LEGAL_MOVES.length, attempted: attempted.length, tried: rows.length,
                           resolved: resolved.length, diverged: diverged.length,
                           resolution_disagreements: disagree.length, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  console.log('    RESOLVED ' + resolved.length + ' of ' + rows.length + ' tried, of ' + LEGAL_MOVES.length + ' that exist'
            + '   (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  /* THE HEADLINE COUNT SPLITS, because a single partner-slot bug used to inflate it by one per row
   * that happened to contain it. Both numbers are printed; neither is hidden. */
  const mineN = diverged.filter(r => r.divergence && !r.divergence.shared_suspect).length;
  const otherN = diverged.length - mineN;
  console.log('    diverged from Showdown: ' + diverged.length
            + '   (' + mineN + ' inside the subject\'s own move'
            + (otherN ? ', ' + otherN + ' inside another slot\'s move — possibly ONE shared defect, '
                      + 'not ' + otherN + ' separate ones' : '') + ')');
  const byWhy = new Map();
  for (const r of rows) if (!r.resolved) { const k = String(r.why || '?').slice(0, 90); byWhy.set(k, (byWhy.get(k) || 0) + 1); }
  console.log('    WHY THE REST DID NOT RESOLVE:');
  for (const [k, v] of [...byWhy].sort((x, y) => y[1] - x[1])) console.log('      ' + String(v).padStart(4) + '  ' + k);
  /* §5 OF THE DIFFERENTIAL DESIGN, APPLIED HERE: twelve games hitting one wire is ONE finding and not
   * twelve, so the divergences are collapsed onto the driver's own SPECIES-BLIND cause. */
  reportCauses(rows);
}

if (KIND === 'abilities' || KIND === 'all') {
  const list = pick(LEGAL_ABILITIES);
  console.log('\n  ABILITIES — ' + list.length + ' of ' + LEGAL_ABILITIES.length + ' attempted');
  const t0 = Date.now();
  const rows = runAbilities(list);
  report.rows.abilities = rows;
  const fired = rows.filter(r => r.verdict === 'FIRED');
  report.summary.abilities = { exist: LEGAL_ABILITIES.length, tried: rows.length, fired: fired.length,
    showdown_only: rows.filter(r => r.verdict === 'SHOWDOWN-ONLY').length,
    medicham_only: rows.filter(r => r.verdict === 'MEDICHAM-ONLY').length,
    did_not_fire: rows.filter(r => r.verdict === 'DID-NOT-FIRE').length,
    unreachable: rows.filter(r => r.unreachable).length,
    control_not_quiet: rows.filter(r => r.control_not_quiet).length,
    diverged: rows.filter(r => r.diverged).length, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  console.log('    ' + JSON.stringify(report.summary.abilities));
  const so = rows.filter(r => r.verdict === 'SHOWDOWN-ONLY');
  console.log('    SHOWDOWN-ONLY — the authority\'s game moved and ours did not. Each is a candidate ENGINE GAP:');
  for (const r of so) console.log('      ' + r.id.padEnd(18) + ' carrier ' + String(r.carrier).padEnd(15)
    + ' control ' + String(r.control).padEnd(14) + (r.control_not_quiet ? '  [CONTROL NOT QUIET — attribution ambiguous]' : ''));
}

if (KIND === 'items' || KIND === 'all') {
  const list = pick(LEGAL_ITEMS);
  console.log('\n  ITEMS — ' + list.length + ' of ' + LEGAL_ITEMS.length + ' attempted');
  const t0 = Date.now();
  const rows = runItems(list);
  report.rows.items = rows;
  report.summary.items = { exist: LEGAL_ITEMS.length, tried: rows.length,
    fired: rows.filter(r => r.verdict === 'FIRED').length,
    showdown_only: rows.filter(r => r.verdict === 'SHOWDOWN-ONLY').length,
    medicham_only: rows.filter(r => r.verdict === 'MEDICHAM-ONLY').length,
    did_not_fire: rows.filter(r => r.verdict === 'DID-NOT-FIRE').length,
    out_of_scope: rows.filter(r => r.out_of_scope).length,
    diverged: rows.filter(r => r.diverged).length, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  console.log('    ' + JSON.stringify(report.summary.items));
}

report.games_played = GAMES;
report.games_threw = THREW;
report.sheets_unassembled = SHEET_FAILS;
/* THE OVERLAP WITH THE DELIBERATE ROSTER. Printed for every population that ran, because the useful
 * output of two instruments is not either list — it is the row NEITHER of them reaches. */
report.overlap = {};
console.log('\n  OVERLAP WITH THE DELIBERATE ROSTER (staged single turn) — the interesting column is the last one:');
for (const k of Object.keys(report.rows)) {
  const o = rosterOverlap(k, report.rows[k]);
  report.overlap[k] = o;
  if (!o.available) { console.log('    ' + k + ': ' + o.why); continue; }
  console.log('    ' + k.padEnd(10) + ' roster fired ' + String(o.roster_fired).padStart(4)
            + '   here fired ' + String(o.here_fired).padStart(4)
            + '   BOTH ' + String(o.both).padStart(4)
            + '   only here ' + String(o.only_here.length).padStart(4)
            + '   only roster ' + String(o.only_roster.length).padStart(4)
            + '   NEITHER ' + String(o.neither.length).padStart(4));
  if (o.only_here.length) console.log('      only THIS instrument reaches: ' + o.only_here.slice(0, 30).join(' ')
    + (o.only_here.length > 30 ? ' …' : ''));
  if (o.neither.length) console.log('      NEITHER reaches: ' + o.neither.slice(0, 40).join(' ')
    + (o.neither.length > 40 ? ' …' : ''));
}
console.log('\n  ' + GAMES + ' games played, ' + THREW + ' threw, ' + SHEET_FAILS + ' sheets could not be assembled');
if (WRITE) {
  const f = OUT || D('data', 'all-mechanics-fire.json');
  fs.writeFileSync(f, JSON.stringify(report, null, 1));
  console.log('  wrote ' + f);
}
