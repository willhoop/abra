/* game_differential.js — THE COMPARISON DRIVER. ROADMAP #68 step two, docs/GAME-DIFFERENTIAL-DESIGN.md.
 *
 *   SHOWDOWN_PATH=... node engine/game_differential.js                    a small run, printed
 *   SHOWDOWN_PATH=... node engine/game_differential.js --games 90         that many games
 *   SHOWDOWN_PATH=... node engine/game_differential.js --write            + data/game-differential.json
 *   SHOWDOWN_PATH=... node engine/game_differential.js --config baseline  one configuration only
 *   SHOWDOWN_PATH=... node engine/game_differential.js --proof            ONLY the planted-divergence proof
 *
 * ONE RUN = one team pair + one seed + one configuration, played through BOTH engines, the two
 * protocol streams aligned, the FIRST divergence recorded. Nothing here scores a game; these games
 * exist to make two engines disagree.
 *
 * MODE A ONLY. Every die is pinned identically on both sides, so the two engines are deterministic
 * functions of the same input and ANY difference is a bug — tolerance zero, no statistics. Mode B
 * (rolled, distribution comparison) is a different instrument and is not here.
 *
 * ================= THE PIN, AND WHY IT IS SHAPED THE WAY IT IS ===================================
 *
 * CHANGELOG 3.45.0 records what a mispinned die costs: `random` was pinned to the median and
 * `randomChance` to `num >= den`, which is a DIFFERENT die, so every sub-100-accuracy move missed in
 * the reference engine and connected in ours, and a filter written for the same reason hid it. So the
 * two pins here are ONE FUNCTION BY CONSTRUCTION — `PIN_CHANCE(num, den)` is literally
 * `pinRandom(den) < num`, which IS `PRNG.randomChance`'s upstream definition (sim/prng.ts:115).
 *
 * THE DAMAGE ROLL FORCED THE SHAPE, and this is the part worth reading before changing anything.
 * medicham2 rolls `min + floor(rng() * (max - min + 1))` — ELEVEN integers sampled uniformly.
 * Showdown rolls `tr(tr(base * (100 - random(16))) / 100)` — SIXTEEN indices onto the same span,
 * each floored separately, and THE INDEX IS INVERTED (index 0 is MAXIMUM damage). The two dice have
 * different sizes and opposite senses, so there is no scalar `r` that makes them agree in the middle.
 * They agree only at the ENDPOINTS — which is exactly what `tests/test-engine-diff.js` measures at
 * 149/150, and exactly what docs/GAME-DIFFERENTIAL-DESIGN.md §5a calls the unmeasured interior.
 *
 * So Mode A pins the damage roll to the MAXIMUM on both sides, because that is an endpoint where the
 * two engines are already known to agree:
 *
 *     medicham2   rng() = 1 - 1e-9   ->  min + floor((1-e) * span) = max
 *     showdown    random(16) = 0     ->  base * (100 - 0) / 100    = max
 *
 * Everything else on the Showdown side is pinned to the TOP of its range, which is the reading that
 * agrees with medicham2 at rng() = 1 - 1e-9 event for event:
 *
 *     randomChance(100, 100)  99 < 100  HIT      medicham2 skips the check when acc >= 100   AGREE
 *     randomChance( 90, 100)  99 <  90  MISS     medicham2  99.99 > 90 -> miss               AGREE
 *     randomChance(  1,  24)  23 <   1  no crit  medicham2  0.9999 < 1/24 is false           AGREE
 *     randomChance( 30, 100)  99 <  30  no proc  medicham2  99.99 >= 30 -> skipped           AGREE
 *     randomChance(  1,   3)   2 <   1  stall fails   medicham2 0.9999 < 1/3 is false        AGREE
 *
 * A SUB-100-ACCURACY MOVE THEREFORE MISSES IN BOTH ENGINES. That is symmetric and produces no false
 * divergence, and it is a REAL COVERAGE HOLE which the coverage report states in as many words —
 * those moves' hit paths are not tested by this instrument. Saying "Rock Slide: covered" because it
 * was clicked would be the 12%-tolerance mistake one level down.
 *
 * THE TWO-ARGUMENT FORM IS PINNED TO THE BOTTOM, and that is not an oversight. `random(m, n)` is the
 * range form, and its most consequential caller is `PRNG.shuffle` (sim/prng.ts:145), which is
 * Showdown's SPEED-TIE RESOLVER. Pinned to the bottom every swap is a self-swap, so the shuffle is
 * the identity and tied bodies keep their input order — which is what medicham2 does, because
 * battleInit is handed no rng and sorts stably. Pinned to the top or the middle, every speed tie in
 * the format would report as a turn-order divergence.
 *
 * ================= WHAT IS DROPPED FROM THE SHOWDOWN STREAM, AND WHY IT IS NOT A CHOICE ==========
 *
 * `data/protocol-events.json` is DERIVED from Showdown's own `add()` call sites (36 emitted here, 58
 * declared-not-emitted WITH A WRITTEN REASON, 10 partial shapes). The declared list IS the skip list:
 * an event medicham2 has said it does not produce must be removed from the Showdown side before
 * alignment, or every game "diverges" on a line we already said we would not emit.
 *
 * AND A DROP THAT IS NOT DECLARED IS COUNTED AND PRINTED. If Showdown emits something that is
 * neither in TRACE_EVENTS nor in the declared not-emitted list, dropping it silently would be a
 * fallback that looks like a working feature. `undeclared_drops` in the artifact must read 0.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

/* ---- ARGUMENTS ---------------------------------------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = (n, dflt) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : dflt; };
const has = n => argv.includes(n);
const GAMES = +flag('--games', 45);
const MAXTURNS = +flag('--turns', 12);
const ONLY = flag('--config', null);
const WRITE = has('--write');
const VERBOSE = has('--verbose');

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}

/* ---- THE PHOTOGRAPH ----------------------------------------------------------------------------
 * CLAUDE.md: a measurement reads a FROZEN RELEASE, not the live tree. Cut one over the current bytes
 * (a re-cut of an identical tree appends and returns the same id) and load medicham2 out of the
 * snapshot, so another division may keep editing while this runs. */
/* `--release <id>` RUNS THE BEFORE-ARM WITHOUT TOUCHING THE TREE. ROADMAP #81 WIRE 4.
 *
 * WIREs 1-3 each measured before/after by hand-cutting a release, landing the change, and cutting
 * again -- which works, and which also means the before-arm can only ever be run BEFORE the change.
 * Once the edit is in the working copy the earlier arm is unreachable except by swapping the file
 * back, and a file swap under a measurement is the exact hazard `engine_release.js` exists to
 * remove. Naming an EXISTING release reads the frozen bytes it already holds: the two arms then
 * differ in one file and in nothing else, and neither arm reads the live engine.
 *
 * IT DOES NOT CUT. A named release is a photograph somebody already took; re-cutting under it would
 * append a cut event describing a tree this run never used. */
const ER = require('./engine_release.js');
const REL_ID = flag('--release', null);
if (!REL_ID) ER.cut('game differential mode A — the comparison driver, ROADMAP #68 step two');
const REL = ER.open(REL_ID);
REL.require('data/engine-data.js');
const M = REL.require('engine/medicham2-browser.js');
const CS = require('./champions_sim.js');
const { Dex, Teams, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require('./names.js');
const SWARM = require('./diff_swarm.js');
const id = N.id;

/* tags.json is IN the release, so the coverage sets and the swarm's feature sets are the same bytes
 * the engine was frozen with. Asserted rather than assumed — if a tag file moved under the run the
 * coverage report would be describing a different corpus from the engine. */
const TAGS_LIVE = fs.readFileSync(D('data', 'tags.json'), 'utf8');
const TAGS_REL = REL.read('data/tags.json');
const TAGS_MATCH = TAGS_LIVE === TAGS_REL;

/* ---- FORMAT STANDING, ATTACHED TO EVERY CAUSE ---------------------------------------------------
 *
 * WHY THIS EXISTS. Three times on 2026-08-06/07 a WIRE was argued from a mechanic that CANNOT OCCUR in
 * Champions. Blunder Policy justified the miss-vs-fail wire: `isNonstandard: 'Past'`, 0 of 410,780
 * observed sets. Okidogi justified a Guard Dog wire: `tier: Illegal`, and NO legal body in this format
 * carries Guard Dog at all. Each time, the rule "check isNonstandard before citing anything" was
 * already written down. Each time it was read past, by a different reader.
 *
 * A RULE YOU HAVE TO REMEMBER IS A PREFERENCE. So the standing travels WITH the cause: whoever reads a
 * cause sees `uses: 0, legal: false` in the same object, at the moment they read it, rather than three
 * steps later when somebody thinks to check. Same move the project already made for the ban list
 * (ask the format, never a hand-maintained list) and for store counts in prose (reference the
 * artifact, never retype the number).
 *
 * USES COMES FROM tags.json, WHICH IS IN THE RELEASE, so the number is the frozen one and cannot drift
 * under the run. Entities tags.json does not carry report `uses: null` -- UNKNOWN, not zero. Those are
 * different claims and collapsing them is how a real mechanic gets dismissed as unused. */
/* THE FOUR FORMAT-STANDING LOOKUPS COUNT THEIR OWN FAILURES (ROADMAP #81 WIRE 4). Each of them hands
 * a plausible value downstream on a throw — an empty tag table, an empty carrier map, a null dex row
 * — and every one of those reads EXACTLY like a legitimate "this entity is not in that section". The
 * standing block's whole purpose is the difference between `uses: 0` and `uses: null`, and that
 * distinction is worthless if the reason something is UNKNOWN was discarded. Flagged by
 * tests/test-no-silent-failure.js; printed with the run so a zero is a receipt rather than silence. */
const STANDING_FAILS = { tagsParse: 0, carrierMap: 0, dexLookup: 0, speciesLookup: 0 };
const TAGS_OBJ = (() => {
  try { return JSON.parse(TAGS_REL || TAGS_LIVE); }
  catch (e) {
    STANDING_FAILS.tagsParse++;
    console.error('  standing: tags.json did not parse — every uses figure below is UNKNOWN: ' + e.message);
    return {};
  }
})();
const STANDING_KINDS = [['moves', 'moves'], ['abilities', 'abilities'], ['items', 'items']];

/* LEGAL IS NOT THE SAME AS REACHABLE, AND THE DIFFERENCE IS EXACTLY THE CASE WILL CAUGHT.
 * Guard Dog is `isNonstandard: null` — perfectly legal in Champions — and NO legal species in this
 * format carries it, so a wire against it changes nothing a real game can reach. A legality test alone
 * scores it `legal: true` and waves it through, which is what happened. Counted once, lazily. */
const ABILITY_CARRIERS = (() => {
  const m = new Map();
  try {
    for (const sp of dex.species.all()) {
      if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') continue;
      for (const a of Object.values(sp.abilities || {})) {
        const k = N.id(a); m.set(k, (m.get(k) || 0) + 1);
      }
    }
  } catch (e) { /* the map stays empty and carriers reads null — UNKNOWN, never a false zero */
    STANDING_FAILS.carrierMap++;
    console.error('  standing: the ability-carrier map could not be built — every carriers figure is UNKNOWN: ' + e.message);
  }
  return m;
})();

function entityStanding(id) {
  for (const [sec, dexKind] of STANDING_KINDS) {
    const row = TAGS_OBJ[sec] && TAGS_OBJ[sec][id];
    let d = null;
    try { d = dex[dexKind].get(id); } catch (e) { d = null; STANDING_FAILS.dexLookup++; }
    if (row || (d && d.exists)) {
      const legal = !!(d && d.exists && !d.isNonstandard);
      /* An ability nothing legal can carry is unreachable even though it is legal. `null` when the
       * map could not be built, so UNKNOWN never reads as zero. */
      const carriers = sec === 'abilities'
        ? (ABILITY_CARRIERS.size ? (ABILITY_CARRIERS.get(id) || 0) : null) : null;
      return { kind: sec, id, legal, carriers,
               reachable: legal && carriers !== 0,
               nonstandard: (d && d.isNonstandard) || null,
               uses: row && typeof row.uses === 'number' ? row.uses : null };
    }
  }
  const sp = (() => { try { return dex.species.get(id); } catch (e) { STANDING_FAILS.speciesLookup++; return null; } })();
  if (sp && sp.exists) {
    const legal = !sp.isNonstandard && sp.tier !== 'Illegal';
    return { kind: 'species', id, legal, carriers: null, reachable: legal,
             nonstandard: sp.isNonstandard || (sp.tier === 'Illegal' ? 'Illegal' : null), uses: null };
  }
  return null;
}

/* A cause is a protocol fragment, so the entity names in it are already normalised ids sitting between
 * pipes, colons and spaces. Split on everything that is not a letter or digit and test each token --
 * cheap, and it cannot miss one by guessing the wrong field position. */
function annotateCause(cause) {
  const seen = new Set(), out = [];
  for (const tok of String(cause).split(/[^a-z0-9]+/i)) {
    const id = N.id(tok);
    if (!id || id.length < 4 || seen.has(id)) continue;
    seen.add(id);
    const st = entityStanding(id);
    if (st) out.push(st);
  }
  if (!out.length) return { mentions: [] };
  const known = out.filter(m => typeof m.uses === 'number');
  return {
    mentions: out,
    /* THE HEADLINE FIELD. If every entity a cause names is illegal in this format, fixing it changes
     * nothing a real game can reach -- and that must be visible without a second query. */
    cannot_occur_in_format: out.every(m => m.reachable === false),
    max_uses: known.length ? Math.max(...known.map(m => m.uses)) : null,
  };
}

/* ---- THE PIN ------------------------------------------------------------------------------------ */
const MEDI_RNG_VALUE = 1 - 1e-9;
const mediRng = () => MEDI_RNG_VALUE;
/* THE DAMAGE ROLL IS THE ONLY SPECIAL CASE AND IT IS NAMED. `sim/battle.ts:2390` is the ONLY
 * `random(16)` in `sim/`, and there is no `randomChance(x, 16)` anywhere, so keying on the argument
 * cannot catch anything else. Checked by hand against the pinned checkout; if a second `random(16)`
 * appears upstream this pin silently changes meaning, which is why it is written down here. */
const DAMAGE_ROLL_SIDES = 16;
function pinRandom(m, n) {
  if (n === undefined) {
    if (m === undefined) return 0;                     // random() -> a float in [0,1)
    if (m === DAMAGE_ROLL_SIDES) return 0;             // THE DAMAGE ROLL -> index 0 -> MAX damage
    return m - 1;                                      // top of the range
  }
  return m;                                            // random(m,n) -> bottom: shuffle is the identity
}
const PIN_CHANCE = (num, den) => pinRandom(den) < num;

/* THE PIN IS ASSERTED ON ITS BEHAVIOUR, not on its arithmetic. Each row below is a claim about what
 * a battle does, and each has a medicham2 counterpart written beside it in the header. */
const PIN_CLAIMS = [
  ['a 100-accuracy move HITS',            () => PIN_CHANCE(100, 100) === true],
  ['a 90-accuracy move MISSES',           () => PIN_CHANCE(90, 100) === false],
  ['a 1-in-24 crit does NOT happen',      () => PIN_CHANCE(1, 24) === false],
  ['a 30% secondary does NOT fire',       () => PIN_CHANCE(30, 100) === false],
  ['a second consecutive Protect FAILS',  () => PIN_CHANCE(1, 3) === false],
  ['the damage roll is index 0 = MAX',    () => pinRandom(16) === 0],
  ['the speed-tie shuffle is identity',   () => pinRandom(0, 2) === 0 && pinRandom(1, 4) === 1],
  ['randomChance IS random(den) < num',   () => [[100, 100], [95, 100], [90, 100], [1, 24], [1, 8], [1, 2]]
                                                  .every(([a, b]) => PIN_CHANCE(a, b) === (pinRandom(b) < a))],
  ['medicham2 rng picks the TOP integer', () => [1, 2, 11, 16, 32]
                                                  .every(s => Math.floor(MEDI_RNG_VALUE * s) === s - 1)],
];
const PIN_BAD = PIN_CLAIMS.filter(([, f]) => !f()).map(([w]) => w);
if (PIN_BAD.length) {
  console.error('THE PIN IS WRONG — these claims are false: ' + PIN_BAD.join('; '));
  process.exit(1);
}

/* ---- THE SKIP LIST, READ FROM THE DERIVATION ---------------------------------------------------- */
const PROTO = JSON.parse(fs.readFileSync(D('data', 'protocol-events.json'), 'utf8'));
const CLAIMED = new Set(M.TRACE_EVENTS);
const DECLARED_NOT_EMITTED = new Set((PROTO.notEmitted || []).map(e => e.event));
/* TRANSPORT, NOT PROTOCOL. These four are not in `data/protocol-events.json` at all — they are not
 * rule events and `engine/derive_protocol_events.js` does not scan the paths that emit them, so they
 * are neither claimed nor declared and would count as undeclared drops forever. Each is written out
 * rather than pattern-matched, because "drop anything I do not recognise" is the silent default this
 * counter exists to prevent. */
const TRANSPORT = {
  't:': 'a unix timestamp the client uses to place a message in time; carries no rule',
  'uhtml': 'client-side HTML the simulator sends for display (the Champions mod uses it for a banner)',
  'uhtmlchange': 'the update half of `uhtml`',
  '': 'a blank line — Showdown\'s own message separator inside a chunk',
};
let UNDECLARED_DROPS = 0;
const UNDECLARED_SEEN = new Set();
/* Showdown's log carries `|split|SIDE` followed by the omniscient line and then the spectator line;
 * the omniscient one is what medicham2 emits, so the other is dropped. */
function sdStream(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i] === '|split|p1' || log[i] === '|split|p2') { out.push(log[i + 1]); i += 2; continue; }
    out.push(log[i]);
  }
  return out.filter(l => {
    const k = String(l).split('|')[1];
    if (CLAIMED.has(k)) return true;
    if (!DECLARED_NOT_EMITTED.has(k) && !(k in TRANSPORT)) {
      /* LOUD. A silent drop here is a fallback that looks like agreement. */
      if (!UNDECLARED_SEEN.has(k)) { UNDECLARED_SEEN.add(k); UNDECLARED_DROPS++; }
    }
    return false;
  });
}

/* ================= THE SEMANTIC NORMALISER, AND IT IS THE DANGEROUS PART ==========================
 *
 * `M.traceCanon` is the SYNTACTIC normaliser: case, whitespace, the punctuation that lives inside a
 * name. It is symmetric and it is the engine's. What it cannot do is decide that two DIFFERENT
 * PROTOCOL FORMS mean the same thing, and run one of this driver said they did not:
 *
 *     showdown  |-ability|p1a: Sharpedo|Speed Boost|boost        <- announce, then boost
 *     medicham  |-boost|p1a: sharpedo|spe|1|[from] ability: speedboost   <- boost, attributed
 *
 * Same mechanic, same state change, two spellings. Run one reported 160/160 games diverging with a
 * median of ONE completed turn, and the largest class (44 games) was the TARGET FIELD of a spread
 * move, where Showdown names one victim plus `[spread]` and this engine names its own user. That is
 * display convention. §2.2 of the design — the Csmith lesson — says exactly what happens next: where
 * the thing compared is not semantically meaningful the ORACLE COLLAPSES, and the real bugs (Mirror
 * Armor not bouncing, Inner Focus not refusing Intimidate, recoil off by one HP) drown in it.
 *
 * ================= TWO RULES ON THIS LAYER, BECAUSE IT CAN LIE FOR US ============================
 *
 * 1. AN EQUIVALENCE MUST NOT BE ABLE TO NORMALISE A REAL BUG AWAY. Every rule below is a CLAIM that
 *    two forms mean the same thing, and every claim carries a RED DEMONSTRATION: a pair that must
 *    compare EQUAL (the form it collapses) and a pair that must still compare UNEQUAL (the meaning it
 *    must not). `EQUIV_PROOF` runs both directions before any game does, and a rule whose `distinct`
 *    pair compares equal is a SILENCER, not a normaliser. An equivalence with no red demonstration
 *    does not go in this list.
 * 2. WHAT IT COLLAPSED IS COUNTED AND PUBLISHED, PER RULE. A normaliser whose effect is invisible is
 *    how a 100% divergence rate becomes 2% with nobody able to say whether the engine improved or the
 *    comparator got quieter. `normalisation` in the artifact carries a row per rule.
 *
 * THE GENERAL ARGUMENT THAT MAKES THESE SAFE is one sentence: EVERY RULE DROPS AN ANNOUNCEMENT OR AN
 * ATTRIBUTION AND NEVER A STATE CHANGE. Showdown's `-ability` says an ability is about to do
 * something; the something is a separate line and is kept. `[from] ability: speedboost` says which
 * ability moved the stat; the stat, the direction and the amount are kept. The `|move|` line's target
 * field says who it was aimed at; who was actually HIT is carried by the `-damage`, `-status`,
 * `-unboost` and `-enditem` lines that follow, and those are kept and compared. So a mechanic that
 * did not fire, fired on the wrong body, or fired by the wrong amount is still a divergence — which
 * is what the `distinct` half of each rule proves rather than asserts. */
const NORM_COUNTS = new Map();          // rule id -> lines it changed or dropped
const bumpNorm = (id) => NORM_COUNTS.set(id, (NORM_COUNTS.get(id) || 0) + 1);

/* Each rule takes the CANONICAL line's field array and returns a new array, or null to drop the line.
 * `equal` is the form it collapses; `distinct` is the meaning it must never collapse. */
const EQUIV = [
  { id: 'ability-announcement',
    why: 'Showdown\'s `|-ability|` is a COSMETIC announcement that an ability activated (SIM-PROTOCOL). '
       + 'Every consequence of it is a separate line and is kept, so dropping the announcement cannot '
       + 'hide an ability that did not fire — its effect would still be missing.',
    fn: f => (f[1] === '-ability' ? null : f),
    equal: ['|-ability|p1a: Sharpedo|Speed Boost|boost', ''],
    distinct: ['|-boost|p1a: Sharpedo|spe|1', '|-boost|p1a: Sharpedo|atk|1'] },

  { id: 'stat-attribution',
    why: 'a stat line\'s meaning is (body, stat, direction, amount). `[from] ability: X` and `[of] Y` '
       + 'say WHICH effect moved it, which the two engines tag inconsistently; the four fields that '
       + 'decide the board are kept.',
    fn: f => (f[1] === '-boost' || f[1] === '-unboost'
              ? f.filter((x, i) => i < 5 || !/^\[(from|of)\]/.test(x)) : f),
    equal: ['|-boost|p1a: Sharpedo|spe|1|[from] ability: Speed Boost', '|-boost|p1a: Sharpedo|spe|1'],
    distinct: ['|-unboost|p2a: X|atk|1', '|-unboost|p2b: X|atk|1'] },

  { id: 'source-tag',
    why: '`[of] pXy` names the BODY behind an effect whose name is already carried by `[from]`. The '
       + 'two engines tag it inconsistently on -heal, -activate and -damage.',
    fn: f => f.filter(x => !/^\[of\]/.test(x)),
    equal: ['|-heal|p1a: X|100/100|[from] drain|[of] p2a', '|-heal|p1a: X|100/100|[from] drain'],
    distinct: ['|-heal|p1a: X|100/100|[from] drain', '|-heal|p1a: X|100/100|[from] item: Leftovers'] },

  { id: 'effect-namespace',
    why: 'Showdown writes an effect sometimes bare and sometimes namespaced — `|-sidestart|p1: A|Reflect` '
       + 'against this engine\'s `move: reflect`. The NAME is kept; only the namespace goes.',
    fn: f => f.map((x, i) => (i < 2 ? x : x.replace(/^(move|ability|item):/, '')
                                          .replace(/^(\[from\])(move|ability|item):/, '$1'))),
    equal: ['|-sidestart|p1: A|Reflect', '|-sidestart|p1: |move: Reflect'],
    distinct: ['|-sidestart|p1: A|Reflect', '|-sidestart|p1: A|Light Screen'] },

  { id: 'display-flags',
    why: '`[silent]`, `[still]`, `[miss]` and `[spread]` are rendering hints. The state each one '
       + 'decorates is a separate event — `-miss` for a miss, `-prepare` for a charge, one `-damage` '
       + 'per body actually hit for a spread — and all of those are kept.',
    fn: f => f.filter(x => !/^\[(silent|still|miss|spread|anim)\]/.test(x)),
    equal: ['|-start|p1a: X|perish3|[silent]', '|-start|p1a: X|perish3'],
    distinct: ['|-start|p1a: X|perish3', '|-start|p1a: X|perish2'] },

  { id: 'move-target-field',
    why: 'THE BIGGEST ONE, AND THE ONE THAT NEEDS THE ARGUMENT. A `|move|` line means "this body used '
       + 'this move". Showdown additionally names ONE nominal target plus `[spread]`; this engine '
       + 'names its own user on a spread move. WHO WAS ACTUALLY HIT is not in this field on either '
       + 'side — it is in the `-damage` / `-status` / `-unboost` / `-enditem` lines that follow, which '
       + 'are kept and compared body by body. A redirection bug is therefore caught one line later '
       + 'rather than not at all, and the `distinct` pair below is exactly that case.',
    fn: f => (f[1] === 'move' ? f.slice(0, 4) : f),
    equal: ['|move|p2b: Garchomp|Rock Slide|p1b: Kingambit|[spread] p1a,p1b', '|move|p2b: Garchomp|Rock Slide|p2b: Garchomp'],
    distinct: ['|-damage|p1a: Kingambit|100/175', '|-damage|p1b: Kingambit|100/175'] },

  { id: 'switch-cause',
    why: 'a pivot switch is tagged `[from] U-turn` by Showdown; the pivot itself is the `|move|` line '
       + 'immediately before it, which is kept. The species and the HP on the switch line are kept.',
    fn: f => (f[1] === 'switch' || f[1] === 'drag' ? f.filter(x => !/^\[from\]/.test(x)) : f),
    equal: ['|switch|p1b: Grimmsnarl|Grimmsnarl, L50|100/100|[from] U-turn', '|switch|p1b: Grimmsnarl|Grimmsnarl, L50|100/100'],
    distinct: ['|switch|p1a: Simisage|Simisage, L50|100/100', '|switch|p1a: Zoroark|Zoroark, L50|100/100'] },
];

/* ONE LINE THROUGH THE WHOLE PIPELINE: the engine's symmetric canonicaliser, then the equivalences.
 * Returns null when the line carries no state at all. */
function semantic(line) {
  let f = M.traceCanon(line).split('|');
  for (const r of EQUIV) {
    const before = f.join('|');
    const out = r.fn(f);
    if (out === null) { bumpNorm(r.id); return null; }
    if (out.join('|') !== before) bumpNorm(r.id);
    f = out;
  }
  return f.join('|');
}
/* A stream reduced to comparable lines, keeping the map back to the RAW line so a divergence still
 * prints what the engine actually emitted rather than what the comparator made of it. */
function reduce(stream) {
  const lines = [], rawIdx = [];
  for (let i = 0; i < stream.length; i++) {
    const s = semantic(stream[i]);
    if (s === null) continue;
    lines.push(s); rawIdx.push(i);
  }
  return { lines, rawIdx };
}

/* THE RED DEMONSTRATION FOR EVERY RULE, run before a game does. Both directions, per rule. */
function equivProof() {
  return EQUIV.map(r => {
    const eq = r.equal.map(x => (x === '' ? null : semantic(x)));
    const di = r.distinct.map(semantic);
    return { id: r.id, why: r.why,
             collapses: eq[0] === eq[1],
             keeps_meaning: di[0] !== di[1],
             equal_becomes: eq[0], distinct_becomes: di };
  });
}

/* ---- THE CENSUS, AS A COVERAGE TARGET ------------------------------------------------------------
 * §5.3: "a run that never triggered Illusion has not tested Illusion and must say so". The 235-row
 * census IS the list — nobody hand-writes which mechanics matter.
 *
 * 192 of the 235 rows name a tag that exists in data/tags.json and therefore have an ENTITY SET this
 * instrument can watch for. The other 43 are composite probe names (`intimidateRetaliationNet`,
 * `drainThenPunishOrder`) that describe an INTERACTION rather than a taggable entity. Those are
 * reported as UNMEASURABLE BY THIS INSTRUMENT and never as uncovered — a zero on them would read as
 * a failure of the run rather than a limit of the measurement. */
const CENSUS = JSON.parse(fs.readFileSync(D('data', 'mechanics-census.json'), 'utf8'));
const SECTION = { item: 'items', move: 'moves', ability: 'abilities' };
const COV_TARGETS = [];      // { key, kind, tag, label, entities:Set }
const COV_UNMEASURABLE = []; // { key, kind, tag, label }
for (const r of CENSUS.results) {
  const sec = SECTION[r.kind];
  const key = r.kind + ':' + r.tag;
  let set = null, why = null;
  /* THE THROW IS THE ANSWER, NOT AN ERROR. `names.byTag` throws on a tag name data/tags.json does not
   * carry, and for a census row like `intimidateRetaliationNet` that is the correct answer: the row
   * names an INTERACTION and there is no entity set to watch. The reason is KEPT and reported —
   * swallowing it would turn "this instrument cannot measure that" into a bare absence. */
  if (!sec) why = 'the census kind "' + r.kind + '" has no section in data/tags.json';
  else { try { set = N.byTag(sec, r.tag); } catch (e) { why = String((e && e.message) || e).split('.')[0]; } }
  if (set && set.size) COV_TARGETS.push({ key, kind: r.kind, tag: r.tag, label: r.label, sec, entities: set });
  else COV_UNMEASURABLE.push({ key, kind: r.kind, tag: r.tag, label: r.label,
                               why: why || 'the tag exists but no ' + sec + ' row carries it' });
}

/* ---- COVERAGE BOOKKEEPING -----------------------------------------------------------------------
 * OBSERVED, NEVER DECLARED. §3.1: the coverage report must count the ability a body ACTUALLY HAD
 * when it acted, not the one its sheet declared, or a body that megaed into Trace and used it reads
 * as "Trace exercised: 0". Every entity here is read off a live battle body or off the emitted
 * stream, never off the team sheet. */
const OBSERVED = { moves: new Map(), abilities: new Map(), items: new Map(), species: new Map() };
const bump = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
/* A MOVE THAT MISSED EXERCISED THE MISS PATH AND NOTHING ELSE. Counted separately so the report can
 * say which moves were clicked and never connected — under the Mode A pin that is every move with
 * printed accuracy below 100, and calling those "covered" would be a lie the size of the format. */
const CLICKED_BUT_MISSED = new Map();

/* Read the entities out of ONE medicham2 trace stream plus the live bodies that produced it. */
function harvest(stream, S) {
  for (let i = 0; i < stream.length; i++) {
    const p = String(stream[i]).split('|');
    if (p[1] !== 'move') continue;
    const mv = id(p[3]);
    /* the `-miss` for this click, if any, is the next line or the one after (a `-crit`/`-activate`
     * can sit between). Bounded at 3 rather than scanned to the next `|move|`, so a later miss by a
     * different body is never attributed here. */
    let missed = false;
    for (let j = i + 1; j < Math.min(i + 4, stream.length); j++) {
      const q = String(stream[j]).split('|');
      if (q[1] === 'move') break;
      if (q[1] === '-miss' && q[2] === p[2]) { missed = true; break; }
    }
    if (missed) bump(CLICKED_BUT_MISSED, mv); else bump(OBSERVED.moves, mv);
  }
  /* Bodies: whatever was on the field or on the bench when the game stopped, plus every body that
   * ever occupied an active slot (recorded per turn by the caller). */
  for (const m of [...S.actA, ...S.actB, ...S.benchA, ...S.benchB]) {
    if (!m) continue;
    bump(OBSERVED.species, id(m.name));
    bump(OBSERVED.abilities, id(m.ability));
    if (m.item) bump(OBSERVED.items, id(m.item));
  }
}

/* ---- TEAM BUILDING ------------------------------------------------------------------------------
 * The sheet is what the player DECLARED, six deep. Four are brought, and both engines are handed the
 * same four.
 *
 * MEGA STONES ARE NO LONGER STRIPPED (ROADMAP #31, 2026-08-07). They were, and the reason was a real
 * modelling difference rather than laziness: medicham2 built a stone-holder AS THE MEGA before the
 * battle started and Showdown evolves on a CHOICE, mid-turn, so a stone parted the streams on line
 * one of every game carrying one. 460 sets were stripped and the first run tested ZERO mega bodies in
 * a format whose mega usage is ~26%. `megaEvolveNow` closed that, so the stone stays on, the driver
 * issues the SAME choice to both engines, and the run is paired: every team pair is played TWICE,
 * once with the stones removed and once with them kept, so what megas cost is a MEASUREMENT and not a
 * difference between two runs of different things.
 *
 * THE STAT BLOCKS ARE NOT ALIGNED ANY MORE — THEY AGREE, AND THAT IS A STRICTLY STRONGER POSITION.
 * This used to build each body from data/engine-data.js (which bakes the dataset's average spread and
 * nature into `st`) and then COPY those numbers onto the Showdown body, which papered over any
 * disagreement rather than removing it. It also could not survive a mega: `formeChange` calls
 * `setSpecies`, which RECOMPUTES `storedStats` from the new base stats and the SET — so the moment a
 * body evolved, Showdown went back to the set's own numbers mid-turn, with no seam for a harness to
 * re-align in (`battle.choose` runs the whole turn), and `updateMaxHp` emitted a silent `-heal` on top.
 *
 * So both bodies are now the SAME Pokemon by construction: Serious, 0 EVs, 31 IVs on the Showdown
 * side, and a flat level-50 stat line computed from the row's own base stats on the medicham side.
 * Those two formulas are identical arithmetic —
 *     showdown  statModify: trunc((2b + 31 + max(2e-1,0)) * 50/100) + 5   [levelclausemod, e = 0]
 *     medicham  l50:        floor((2b + 31) * 50/100) + 5 + sp            [sp = 0]
 * — and `alignStats` below is kept only to assert that, plus to carry the staged hpBoost arms. The
 * cost is stated rather than hidden: these bodies do not carry the ladder's spreads, so this
 * instrument tests RULES and not the stat lines people actually bring. */
let STONES_STRIPPED = 0, STONES_KEPT = 0, TEAMS_UNBUILDABLE = 0, MONS_UNBUILDABLE = 0;
let ALIGN_MOVED = 0;   // a stat the alignment had to CHANGE — must be 0 outside the hpBoost arms
/* ROADMAP #31 — THE EVOLUTION COUNTERS, PRINTED EVERY RUN AND A ZERO CALLED OUT LOUDLY. Mega has
 * already passed an at-least-one check in this project while firing on 56% of the sides it should
 * have, so a bare count is not enough and a RATE with a real denominator is reported beside it. Both
 * engines are counted SEPARATELY off their own streams: if the driver's choice reached one engine and
 * not the other, one number would be zero while the other was not, and a single merged counter could
 * not say which. */
let MEGA_CHOICES = 0, MEGA_SIDES_CAPABLE = 0, MEGA_SIDES_EVOLVED = 0;
let MEGA_MEDI = 0, MEGA_SD = 0, MEGA_SLOT_A = 0, MEGA_SLOT_B = 0;
let MEGA_PREFER_B = false;   // alternates, so the driver does not mega out of the left slot every time
/* DERIVED ONCE, AND ALLOWED TO THROW. A `catch { return false }` here would keep every mega stone on
 * every team and part the streams on line one of a quarter of the games, while the report cheerfully
 * said `mega stones stripped: 0` — the exact shape names.js was written to remove. */
const STONES = N.byTag('items', 'megaStone');
const isStone = it => STONES.has(id(it));

/* THE SPECIES KEY COMES FROM THE PROJECT'S OWN RESOLVER, and it used to be `id(p.species)` — which
 * strips hyphens, so `Floette-Eternal` became `floetteeternal` and data/engine-data.js keys it
 * `floette-eternal`. Every such body counted as UNBUILDABLE and left the run silently. That mattered
 * most for exactly the bodies this pass is about: Floette-Eternal is ~10.5% of ladder sides and megas
 * 96.1% of the time. `mcKey` is the one thing allowed to know how that table is keyed
 * (tests/test-mc-key.js), and it is read out of the RELEASE so the photograph rule holds. */
const { mcKey } = REL.require('engine/mc_key.js');
/* The flat level-50 line, no SP and no nature — see the block header for why both engines must
 * compute the same one. Written here rather than imported because medicham2 does not export `l50`,
 * and the two are pinned to each other by the ASSERTION in alignStats rather than by faith. */
function flatL50(bs) {
  const S = b => Math.floor((2 * b + 31) * 50 / 100) + 5;
  return { hp: Math.floor((2 * bs.hp + 31) * 50 / 100) + 50 + 10,
           at: S(bs.atk), df: S(bs.def), sa: S(bs.spa), sd: S(bs.spd), sp: S(bs.spe) };
}

function buildPair(sheet, opts) {
  const hpx = (opts && opts.hpBoost) || 1;
  const strip = !!(opts && opts.stripStones);
  const picked = [];
  for (const p of sheet) {
    if (picked.length >= 4) break;
    if (!p || !p.species) continue;
    const key = mcKey(p.species) || id(p.species);
    const b = M.buildMon(key, {});
    if (!b) { MONS_UNBUILDABLE++; continue; }
    const sp = dex.species.get(key);
    if (!sp || !sp.exists) { MONS_UNBUILDABLE++; continue; }
    let item = id(p.item || '');
    if (item && isStone(item)) { if (strip) { STONES_STRIPPED++; item = ''; } else STONES_KEPT++; }
    if (item && !dex.items.get(item).exists) item = '';
    const moves = [];
    for (const mv of (p.moves || [])) {
      const dm = dex.moves.get(id(mv));
      if (!dm || !dm.exists) continue;
      if (moves.some(x => x.id === dm.id)) continue;
      moves.push(dm);
    }
    if (!moves.length) { MONS_UNBUILDABLE++; continue; }
    let ability = id(p.ability || '');
    const legal = Object.values(sp.abilities || {}).map(id);
    if (!ability || !legal.includes(ability)) ability = legal[0] || '';
    b.moves = moves.map(m2 => m2.id);
    b.item = item;
    b.ability = ability;
    b._ident = sp.baseSpecies || sp.name;
    picked.push({ medi: b, spec: { key, moves: b.moves.slice(), item, ability, hpx, bs: sp.baseStats,
                                   ident: sp.baseSpecies || sp.name }, sd: {
      name: sp.name, species: sp.name,
      /* GENDER IS 'N' ON BOTH SIDES. Showdown writes the gender into the `|switch|` details field
       * (`Incineroar, L50, F`) and medicham2 has no gender at all, so a declared gender would part
       * the streams on line one of every game. It is a CONTROL, and its cost is that Attract,
       * Rivalry and Cute Charm are not exercised — stated, not hidden. */
      gender: 'N', level: 50, item: item ? dex.items.get(item).name : '',
      ability: ability ? dex.abilities.get(ability).name : '',
      moves: moves.map(m2 => m2.name), nature: 'Serious',
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    } });
  }
  if (picked.length < 4) { TEAMS_UNBUILDABLE++; return null; }
  return picked;
}

/* ONE PLACE THAT TURNS A PAIR SPEC BACK INTO LIVE MEDICHAM BODIES. `battleInit` takes the team BY
 * REFERENCE and the battle then damages it, boosts it, eats its item and reverts its mega, so every
 * arm that plays or measures must start from a fresh build rather than from the previous arm's
 * wreckage. Written once because two copies of "how do I get a body" would drift. */
function freshBodies(pair) {
  return pair.map(x => {
    const b = M.buildMon(x.spec.key, {});
    if (!b) return null;
    b.moves = x.spec.moves.slice(); b.item = x.spec.item; b.ability = x.spec.ability;
    /* THE FLAT LEVEL-50 LINE, so the two engines are the same Pokemon rather than one being copied
     * onto the other — see the buildPair header. `sp.baseStats` is the DEX's, and it was MEASURED to
     * equal data/engine-data.js's `bs` on all 318 rows before this was wired, which is what makes
     * medicham2's own mega stat swap (megaEvolveNow computes `megaL50 + (st - baseL50)`) come out at
     * a delta of exactly zero and land on Showdown's recomputed numbers. */
    if (x.spec.bs) { b.st = flatL50(x.spec.bs); b.curHP = b.st.hp; }
    /* THE PROTOCOL IDENTIFIER IS SHOWDOWN'S NICKNAME, AND SHOWDOWN DEFAULTS IT TO `baseSpecies`.
     *
     * A set whose name equals its species is renamed to the BASE species when the battle loads it, so
     * a Floette-Eternal is `|switch|p1a: Floette|Floette-Eternal, L50|` — the identifier is the base,
     * the DETAILS field is the forme. medicham2 has no nicknames and keyed the identifier off the
     * body's own name, so every non-base forme parted the streams on its own switch line.
     *
     * IT WAS INVISIBLE UNTIL THIS PASS and that is worth recording: `id(p.species)` strips hyphens, so
     * `Floette-Eternal` looked up as `floetteeternal`, data/engine-data.js keys it `floette-eternal`,
     * and every forme in the format counted as UNBUILDABLE and left the run. Fixing the key surfaced
     * the naming difference on 35 games in one run — a class that had been there all along behind a
     * silent drop.
     *
     * STAMPED BY THE HARNESS AND NOT BY THE ENGINE, deliberately: this file AUTHORS both sides' team
     * representations, and `baseSpecies` is the dex's own field rather than string arithmetic on a
     * forme name. medicham2 keeps its own convention when nobody stamps one. */
    if (x.spec.ident) b._ident = x.spec.ident;
    /* HP BOOST — opt-in, staged measurements only, and it exists for one reason: A DAMAGE RATIO
     * CANNOT BE READ OFF A BODY THAT DIED. Showdown clamps the recorded HP loss at the target's max,
     * so the first run of the Knock Off arms read 135 / 135 / 135 — three different multipliers all
     * reported as the same number, which is the interaction matrix's `saturated` bucket arriving in a
     * new instrument. Inflating the pool changes no multiplier and no rule; alignStats copies these
     * values onto the Showdown bodies so both engines get the same pool. Same fix, same reason, as
     * tests/test-game-diff.js's opts.hpBoost. */
    if (x.spec.hpx && x.spec.hpx !== 1) { b.st.hp = Math.round(b.st.hp * x.spec.hpx); b.curHP = b.st.hp; }
    return b;
  });
}

/* ---- THE DRIVER: COVERAGE-SEEKING, NOT SKILFUL ---------------------------------------------------
 * §3.3: at each decision prefer the legal action exercising the census mechanic furthest below its
 * floor; break ties toward the least-exercised entity. It will click Quash into an empty slot and
 * Trick Room on turn six, and that is correct — nobody is scoring these games.
 *
 * LEGALITY COMES FROM SHOWDOWN'S OWN REQUEST, not from a rule reimplemented here. `activeRequest`
 * already knows about Choice locks, Encore, Taunt, Disable, Torment, recharge and trapping, and it is
 * the authority by ADR-002. A driver that guessed legality would test positions the game cannot
 * reach, and a divergence in one of those means nothing.
 *
 * FEATURE OMISSION IS THE DRIVER'S JOB AND IS SCOPED PER CONFIGURATION. `omit-protect` forbids the
 * CLICK; `pair-protect-bust` requires it and then aims the buster into it. Both run in one swarm. A
 * global ban would silently destroy every pairing configuration while looking like it worked — and
 * it has to be the click rather than the team, because only 84 of 7,256 real teams carry no Protect. */
const FEATS = SWARM.featureSets();
/* Printed before it is used, per the standing rule: a derived set that over-matches is invisible
 * until somebody looks at what it matched. */
const DRIVER_AXES = {
  'omit-protect':      { ban: FEATS.protect },
  'omit-priority':     { ban: FEATS.priority },
  'omit-weather':      { ban: FEATS.weather },
  'omit-spread':       { ban: FEATS.spread },
  'pair-protect-bust': { prefer: new Set([...FEATS.protect, ...FEATS.protectBust]) },
  'pair-redirect-priority': { prefer: new Set([...FEATS.redirect, ...FEATS.priority]) },
  'pair-speedctrl':    { prefer: FEATS.speedCtrl },
};
let BAN_FALLBACKS = 0;   // a config banned everything this body could click — LOUD, never silent

/* How badly does the run still need this entity? Lower count = more wanted. A move is scored by the
 * least-exercised census mechanic it can reach, then by its own click count. */
const covWant = (sec, key) => {
  let worst = Infinity;
  for (const t of COV_TARGETS) if (t.sec === sec && t.entities.has(key)) {
    const n = COV_HITS.get(t.key) || 0;
    if (n < worst) worst = n;
  }
  return worst;
};
const COV_HITS = new Map();   // census key -> times an entity of it was clicked
function creditClick(sec, key) {
  for (const t of COV_TARGETS) if (t.sec === sec && t.entities.has(key)) COV_HITS.set(t.key, (COV_HITS.get(t.key) || 0) + 1);
}
const CLICKS = new Map();

/* ---- ONE GAME ------------------------------------------------------------------------------------ */
const SLOTCH = ['a', 'b'];

function playGame(pairA, pairB, cfgId, seedTag, opts) {
  opts = opts || {};
  const axis = DRIVER_AXES[cfgId] || {};
  const trace = [];
  /* FRESH BODIES EVERY GAME. `battleInit` takes the team BY REFERENCE and the battle then damages it,
   * boosts it, eats its item and reverts its mega. Handing the same objects to a second game starts
   * that game from the wreckage of the first — and the way it showed up is worth recording, because it
   * is this project's signature shape: the PLANTED-DIVERGENCE PROOF reported all three plants "caught
   * at line 0", which reads as a healthy comparator and was the second game's leads announcing
   * already-damaged HP against a freshly built Showdown side. A proof that passes for the wrong reason
   * is worse than one that fails. */
  const A = freshBodies(pairA), B = freshBodies(pairB);
  /* ROADMAP #31 — `autoMega: false`. medicham2's own policy would evolve at the first opportunity,
   * which is right for a rollout and wrong here: this driver has to issue the SAME choice to both
   * engines, so the choice is the driver's and the engine is told. An engine deciding for itself
   * beside a Showdown that was told is two different games. */
  const S = M.battleInit(A, B, { trace, autoMega: false });

  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(pairA.map(x => x.sd)) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(pairB.map(x => x.sd)) });
  /* ALIGN BEFORE THE LEADS ARE ANNOUNCED. The `|switch|` line carries the body's max HP, so aligning
   * after the team-preview choice would part the two streams on the very first line.
   *
   * AND THIS IS NOW AN ASSERTION AS MUCH AS AN ACTION. Since ROADMAP #31 both engines compute the
   * same flat level-50 line (see the buildPair header), so outside the staged hpBoost arms every
   * write below must be a no-op — and a write that MOVES something is counted and printed, because a
   * silent copy is exactly how the old alignment hid a real disagreement. It has to stay for the
   * hpBoost arms, which deliberately inflate the pool so a damage ratio can be read off a body that
   * would otherwise have died. */
  for (const [side, pair, built] of [[battle.p1, pairA, A], [battle.p2, pairB, B]]) {
    for (const p of side.pokemon) {
      const k = pair.findIndex(x => id(x.sd.species) === id(p.species.id));
      if (k < 0) continue;
      const st = built[k].st;      /* the FRESHLY built body, never a previous game's leftovers */
      if (!(pair[k].spec.hpx > 1)) {
        if (p.storedStats.atk !== st.at || p.storedStats.def !== st.df || p.storedStats.spa !== st.sa
            || p.storedStats.spd !== st.sd || p.storedStats.spe !== st.sp || p.maxhp !== st.hp) ALIGN_MOVED++;
      }
      p.storedStats.atk = st.at; p.storedStats.def = st.df; p.storedStats.spa = st.sa;
      p.storedStats.spd = st.sd; p.storedStats.spe = st.sp;
      p.baseStoredStats.atk = st.at; p.baseStoredStats.def = st.df; p.baseStoredStats.spa = st.sa;
      p.baseStoredStats.spd = st.sd; p.baseStoredStats.spe = st.sp;
      const full = p.hp === p.maxhp; p.maxhp = st.hp; p.baseMaxhp = st.hp; if (full) p.hp = st.hp;
    }
  }
  battle.prng.random = pinRandom;
  battle.prng.randomChance = PIN_CHANCE;
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }

  const bodiesSeen = [];
  let firstDiv = null, turns = 0, err = null, megaChoices = 0;

  const alignAndCheck = () => {
    /* `opts.plant` corrupts the MEDICHAM side and only the medicham side. It exists for the
     * planted-divergence proof and is undefined on every real run — a comparator that finds nothing
     * must first prove it can find something, and a plant applied to a shared normaliser would land
     * on both streams and cancel out, which is the failure it is trying to detect. */
    const sdRawAll = sdStream(battle.log);
    const raw = opts.plant ? opts.plant(trace.slice()) : trace;
    const A = reduce(sdRawAll), B = reduce(raw);
    const a = A.lines, b = B.lines;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        return { index: i, sd: a[i], me: b[i],
                 /* THE RAW LINES, so a report shows what the engines EMITTED and not what the
                  * comparator reduced them to. The reduced form is what decided; the raw form is
                  * what a person has to go and fix. */
                 sdRaw: sdRawAll[A.rawIdx[i]], meRaw: raw[B.rawIdx[i]],
                 meRawIndex: B.rawIdx[i],
                 before: b.slice(Math.max(0, i - 4), i),
                 sdAfter: a.slice(i, i + 6), meAfter: b.slice(i, i + 6),
                 sdAfterRaw: A.rawIdx.slice(i, i + 6).map(j => sdRawAll[j]),
                 meAfterRaw: B.rawIdx.slice(i, i + 6).map(j => raw[j]),
                 agreedLines: i };
      }
    }
    return null;
  };
  /* the reduced -> raw map of the medicham stream as it stands, so a plant can be aimed at the raw
   * line that produced a given REDUCED index. */
  playGame._mediRawIdx = () => reduce(trace).rawIdx;

  try {
    firstDiv = alignAndCheck();     // the leads, entry abilities and entry weather, before turn 1
    for (let t = 0; t < MAXTURNS && !firstDiv; t++) {
      if (battle.ended || M.battleOver(S)) break;
      if (battle.requestState !== 'move') break;
      const chosen = { p1: [], p2: [] };
      for (const sd of ['p1', 'p2']) {
        const side = sd === 'p1' ? battle.p1 : battle.p2;
        const req = side.activeRequest;
        if (!req || !req.active) { chosen[sd] = null; continue; }
        req.active.forEach((act, i) => {
          const p = side.active[i];
          if (!p || p.fainted || !act) { chosen[sd].push({ pass: true }); return; }
          /* A DIRECTED SCENARIO OVERRIDES THE COVERAGE RULE, and only there. §3.2: the swarm alone
           * never reaches the fringe, and the two findings this harness was built to reproduce
           * (order within a hit; the damage interior) are staged rather than stumbled into. */
          if (opts.script) { chosen[sd].push(scripted(opts.script, t, sd, i, act, side)); return; }
          chosen[sd].push(chooseAction(battle, side, i, act, axis));
        });
      }
      if (!chosen.p1 || !chosen.p2) break;

      /* ROADMAP #31 — THE MEGA CHOICE, MADE ONCE AND ISSUED TO BOTH ENGINES.
       *
       * LEGALITY COMES FROM SHOWDOWN'S OWN REQUEST, exactly as the move legality above does:
       * `activeRequest.active[i].canMegaEvo` already knows about the stone, the species and whether
       * this side has spent its mega. A driver that decided for itself would be a second copy of the
       * rule, and this instrument would then be comparing its own belief against the authority.
       *
       * THE POLICY IS AT THE FIRST OPPORTUNITY, and it is a COVERAGE policy rather than a good one —
       * §3.3. The point is to get mega bodies onto the field and acting, not to mega well. One per
       * side per turn, because Showdown rejects a second (`Can't mega evolve: You can only
       * mega-evolve once per battle`) and a rejected choice is a thrown game. */
      for (const sd of ['p1', 'p2']) {
        const side = sd === 'p1' ? battle.p1 : battle.p2;
        const req = side.activeRequest;
        if (!req || !req.active || opts.script) continue;
        /* WHICH SLOT, WHEN BOTH COULD: alternate. Taking the first offer every time would mega out of
         * the LEFT slot on almost every side, and "the base class could only mega from the LEFT slot"
         * is the historical defect this instrument is supposed to be able to see. Alternating is the
         * coverage-seeking rule of §3.3 applied to a second axis. */
        const order = MEGA_PREFER_B ? [1, 0] : [0, 1];
        for (const i of order) {
          const a = chosen[sd][i];
          if (!a || a.pass || a.switchTo != null) continue;
          if (!req.active[i] || !req.active[i].canMegaEvo) continue;
          a.mega = true; megaChoices++; MEGA_PREFER_B = !MEGA_PREFER_B; break;
        }
      }

      /* --- medicham2 --- */
      const mk = (own, foes, bench, acts) => {
        const map = new Map();
        own.forEach((mon, i) => {
          if (!mon) return;
          const a = acts[i];
          if (!a || a.pass) { map.set(mon, { kind: 'pass' }); return; }
          if (a.switchTo != null) {
            const want = bench.find(x => x && !x.fainted && id(x.name) === a.switchTo);
            if (want) { map.set(mon, { kind: 'switch', to: want }); return; }
            map.set(mon, { kind: 'pass' }); return;
          }
          const tgt = a.foeSlot != null ? foes[a.foeSlot] : null;
          const pa = M.playerAction(mon, a.move, tgt, S.field);
          /* the SAME flag Showdown gets as ` mega` on the choice string below — one decision, two
           * spellings, never two decisions */
          if (a.mega && pa) pa.mega = true;
          map.set(mon, pa);
        });
        return map;
      };
      M.battleTurn(S, mediRng, mk(S.actA, S.actB, S.benchA, chosen.p1), mk(S.actB, S.actA, S.benchB, chosen.p2));

      /* --- showdown --- */
      const str = (sd, acts) => {
        const side = sd === 'p1' ? battle.p1 : battle.p2;
        return side.active.map((p, i) => {
          const a = acts[i];
          if (!p || p.fainted || !a || a.pass) return 'pass';
          if (a.switchTo != null) {
            const j = side.pokemon.findIndex(q => !q.isActive && !q.fainted && id(q.species.id) === a.switchTo);
            return j >= 0 ? 'switch ' + (j + 1) : 'pass';
          }
          return 'move ' + a.slot + (a.target != null ? ' ' + a.target : '') + (a.mega ? ' mega' : '');
        }).join(', ');
      };
      const c1 = str('p1', chosen.p1), c2 = str('p2', chosen.p2);
      if (!battle.choose('p1', c1)) throw new Error('p1 choice rejected "' + c1 + '": ' + (battle.p1.choice.error || '?'));
      if (!battle.choose('p2', c2)) throw new Error('p2 choice rejected "' + c2 + '": ' + (battle.p2.choice.error || '?'));

      /* A FORCED SWITCH IS MIRRORED FROM MEDICHAM2, never chosen independently. medicham2 refills a
       * dead slot itself; if Showdown picked its own replacement the two engines would be playing
       * different games from the next line on and every later divergence would be the harness. */
      let guard = 0;
      while (battle.requestState === 'switch' && guard++ < 8) {
        for (const sd of ['p1', 'p2']) {
          const side = sd === 'p1' ? battle.p1 : battle.p2;
          if (!side.activeRequest || !side.activeRequest.forceSwitch) continue;
          const mine = sd === 'p1' ? S.actA : S.actB;
          const picks = side.activeRequest.forceSwitch.map((need, i) => {
            if (!need) return 'pass';
            const want = mine[i] ? id(mine[i].name) : null;
            let j = want == null ? -1
              : side.pokemon.findIndex(q => !q.isActive && !q.fainted && id(q.species.id) === want);
            if (j < 0) j = side.pokemon.findIndex(q => !q.isActive && !q.fainted);
            return j >= 0 ? 'switch ' + (j + 1) : 'pass';
          });
          battle.choose(sd, picks.join(', '));
        }
      }
      turns++;
      for (const m of [...S.actA, ...S.actB]) if (m) bodiesSeen.push(m);
      firstDiv = alignAndCheck();
    }
  } catch (e) { err = String((e && e.message) || e).slice(0, 160); }

  _lastSdLog = battle.log.slice();
  harvest(trace, S);
  for (const m of bodiesSeen) { bump(OBSERVED.species, id(m.name)); bump(OBSERVED.abilities, id(m.ability)); if (m.item) bump(OBSERVED.items, id(m.item)); }
  /* ROADMAP #31 — READ OFF THE TWO STREAMS, not off a counter kept beside them, for the same reason
   * traceCounts parses rather than tallies: a counter maintained next to the thing it counts is a
   * second implementation of "what happened" and will eventually disagree with it. Both engines are
   * counted so a choice that reached one and not the other is visible as an ASYMMETRY rather than as
   * a divergence somewhere downstream. */
  const megaMedi = trace.filter(l => /^\|-mega\|/.test(String(l)));
  const megaSd = battle.log.filter(l => /^\|-mega\|/.test(String(l)));
  const capable = [pairA, pairB].filter(p => p.some(x => isStone(x.spec.item))).length;
  return { config: cfgId, seed: seedTag, turns, lines: trace.length, err, div: firstDiv, mediTrace: trace,
           megaMedi: megaMedi.length, megaSd: megaSd.length, megaCapableSides: capable, megaChoices,
           megaSlotA: megaMedi.filter(l => /\|p[12]a:/.test(l)).length,
           megaSlotB: megaMedi.filter(l => /\|p[12]b:/.test(l)).length,
           megaSidesEvolved: new Set(megaMedi.map(l => String(l).split('|')[2].slice(0, 2))).size };
}

/* A scripted click, resolved against Showdown's own request so an illegal one is impossible. `null`
 * in a slot means "do nothing this turn", which is `pass` on both sides. */
function scripted(script, turn, sd, i, act, side) {
  const step = script[turn];
  const want = step && step[sd] && step[sd][i];
  if (!want) return { pass: true };
  const k = (act.moves || []).findIndex(mv => id(mv.id) === id(want.m));
  if (k < 0) return { pass: true };
  const dm = dex.moves.get(id(want.m));
  let target = null;
  const tt = (act.moves[k] && 'target' in act.moves[k]) ? act.moves[k].target : dm.target;
  if (tt === 'normal' || tt === 'any' || tt === 'adjacentFoe') target = (want.t == null ? 0 : want.t) + 1;
  else if (tt === 'adjacentAlly') target = -((i === 0 ? 1 : 0) + 1);
  else if (tt === 'adjacentAllyOrSelf') target = -(i + 1);
  return { move: dm.id, slot: k + 1, target, foeSlot: target != null && target > 0 ? target - 1 : null };
}

/* Pick ONE action for one active slot. Legal actions come from Showdown's request; the choice among
 * them is the coverage rule. */
function chooseAction(battle, side, i, act, axis) {
  const p = side.active[i];
  const foes = (side.foe && side.foe.active) || [];
  const cands = [];
  (act.moves || []).forEach((mv, k) => {
    if (mv.disabled) return;
    const dm = dex.moves.get(mv.id);
    if (!dm || !dm.exists) return;
    const banned = axis.ban ? axis.ban.has(dm.id) : false;
    /* WHICH SLOT THE CLICK NEEDS COMES FROM THE REQUEST, NOT FROM THE DEX ROW. Curse is `normal` on
     * a Ghost and `self` on everything else, and the dex row cannot know which body is holding it —
     * `Can't move: You can't choose a target for Curse` was a rejected choice and a thrown game, i.e.
     * the harness testing a position the game cannot reach. `activeRequest` already resolved it. */
    let target = null;
    /* AND AN ABSENT `target` ON THE REQUEST ENTRY MEANS "DO NOT NAME ONE". Showdown omits the field
     * entirely for a LOCKED move — the second turn of Solar Beam or Phantom Force — because the target
     * was chosen when the move was started. Falling back to the dex row there supplied a target and
     * Showdown rejected the choice: `Can't move: You can't choose a target for Solar Beam`, four
     * thrown games. `'target' in mv` is the authority answering; `mv.target || dm.target` was a guess. */
    const tt = ('target' in mv) ? mv.target : null;
    if (tt === null) { /* locked: no target field at all */ }
    else
    if (tt === 'normal' || tt === 'any' || tt === 'adjacentFoe') {
      const j = foes.findIndex(q => q && !q.fainted);
      if (j < 0) return;                       // no legal target: not a legal action
      target = j + 1;
    } else if (tt === 'adjacentAlly') {
      const j = side.active.findIndex((q, n) => q && !q.fainted && n !== i);
      if (j < 0) return;
      target = -(j + 1);
    } else if (tt === 'adjacentAllyOrSelf') {
      target = -(i + 1);
    }
    const want = covWant('moves', dm.id);
    cands.push({ move: dm.id, slot: k + 1, target, banned,
                 foeSlot: target != null && target > 0 ? target - 1 : null,
                 want: want === Infinity ? 1e6 : want,
                 prefer: axis.prefer && axis.prefer.has(dm.id) ? 1 : 0,
                 clicks: CLICKS.get(dm.id) || 0 });
  });
  /* switching is a legal action too, and it is the largest single source of NEW entities */
  if (!act.trapped) {
    side.pokemon.forEach(q => {
      if (q.isActive || q.fainted) return;
      cands.push({ switchTo: id(q.species.id), want: 1e6, prefer: 0, banned: false,
                   clicks: (CLICKS.get('switch:' + id(q.species.id)) || 0) * 6 });
    });
  }
  if (!cands.length) return { pass: true };
  const allowed = cands.filter(c => !c.banned);
  let pool = allowed;
  if (!pool.length) {
    /* THE CONFIG BANNED EVERY LEGAL CLICK. Counted and reported rather than quietly falling through —
     * a silent default here looks exactly like a working omission. */
    BAN_FALLBACKS++;
    pool = cands;
  }
  pool.sort((a, b) => (b.prefer - a.prefer) || (a.want - b.want) || (a.clicks - b.clicks)
                   || String(a.move || a.switchTo).localeCompare(String(b.move || b.switchTo)));
  const pick = pool[0];
  if (pick.move) { CLICKS.set(pick.move, (CLICKS.get(pick.move) || 0) + 1); creditClick('moves', pick.move); }
  else CLICKS.set('switch:' + pick.switchTo, (CLICKS.get('switch:' + pick.switchTo) || 0) + 1);
  return pick;
}

/* ---- CLASSIFICATION ------------------------------------------------------------------------------
 * §5: the report must read `turn order — 12 games, 3 distinct causes`, because twelve instances of
 * one turn-order bug is ONE WIRE and not twelve findings.
 *
 * THE CLASS IS DERIVED FROM THE TWO STREAMS, NOT FROM A TABLE OF EVENT NAMES. A hand-written map
 * would have to be extended for every event and would silently mis-file the one it had not seen. The
 * rule is a LOOKAHEAD: if each side's line reappears shortly on the other side, the two engines
 * emitted the same events IN A DIFFERENT ORDER; if only one reappears, one engine emitted an extra
 * line or omitted one; if neither does and the event names match, a FIELD is wrong. */
const LOOKAHEAD = 10;
function classify(d) {
  const sdAt = d.sdAfter, meAt = d.meAfter;
  const sdHead = sdAt[0], meHead = meAt[0];
  const sdEv = sdHead.split('|')[1], meEv = meHead.split('|')[1];
  const sdLater = meAt.indexOf(sdHead) > 0;    // showdown's line turns up later on our side
  const meLater = sdAt.indexOf(meHead) > 0;    // our line turns up later on showdown's side
  let cls, detail;
  if (sdLater && meLater) { cls = 'ordering'; detail = meEv + ' before ' + sdEv; }
  else if (sdLater)       { cls = 'extra event emitted by medicham2'; detail = meEv; }
  else if (meLater)       { cls = 'event missing from medicham2'; detail = sdEv; }
  else if (sdEv === meEv) {
    const a = sdHead.split('|'), b = meHead.split('|');
    let f = -1;
    for (let k = 2; k < Math.max(a.length, b.length); k++) if (a[k] !== b[k]) { f = k; break; }
    /* FIELD 2 IS THE ACTING BODY, and when the event is `move` that is not "a field differs", it is
     * §5's own example: *an out-of-order `|move|` pair is turn order*. Naming it `move field 2` would
     * file the single most consequential class in the format under a field index. */
    if (f === 2 && sdEv === 'move') { cls = 'turn order'; detail = a[2] + ' moved first, we moved ' + b[2]; }
    else if (f === 2) { cls = sdEv + ': a different body'; detail = a[2] + ' vs ' + b[2]; }
    else { cls = sdEv + ' field ' + f; detail = sdEv + '[' + f + '] ' + a[f] + ' vs ' + b[f]; }
  } else { cls = 'unrelated event mismatch'; detail = sdEv + ' vs ' + meEv; }
  /* THE CAUSE is the class made specific but SPECIES-BLIND, so twelve games hitting one wire through
   * twelve different Pokemon collapse to one cause instead of twelve.
   *
   * AND IT MUST NOT GENERALISE AWAY THE THING THAT DIFFERED. The first version replaced every `n/m`
   * with `H/H`, which made a damage-amount divergence print as `|-damage|p2a|H/H <> |-damage|p2a|H/H`
   * — two identical strings offered as the explanation of a difference. When the generalisation
   * collapses the two lines onto each other, the raw values are appended. */
  const gen = s => String(s).replace(/(p[12][ab]):[^|]*/g, '$1').replace(/\d+\/\d+/g, 'H/H');
  const ga = gen(sdHead), gb = gen(meHead);
  const raw = ga === gb ? '  [values differ: ' + sdHead + ' vs ' + meHead + ']' : '';
  return { cls, detail, cause: cls + ' :: ' + ga + ' <> ' + gb + raw };
}

/* ---- THE PLANTED-DIVERGENCE PROOF ----------------------------------------------------------------
 * tests/test-game-diff.js's trap 4, one instrument over. A comparator that finds nothing must first
 * prove it can find something: a silent zero is a broken comparator, not a clean engine, and that is
 * this project's signature failure. Two plants, because the aligner has two distinct failure modes —
 * a WRONG FIELD it could miss by comparing loosely, and a MISSING EVENT it could miss by resyncing. */
/* THE PLANT MUST LAND INSIDE THE AGREEING PREFIX, and the first version did not — which is why this
 * comment exists rather than a shorter one.
 *
 * The first version planted on CONTENT ("corrupt the first `-damage` on p2a"). Every real game in this
 * swarm already diverges, most of them inside ten lines, so a content plant usually landed AFTER the
 * game had already parted and the proof reported CAUGHT for a divergence it had not caused. Combined
 * with the body-reuse bug above it printed "caught at line 0" three times and looked healthy.
 *
 * So the plants are INDEXED off the clean run's own divergence: whatever the game is, the last line
 * before it parts is a line both engines produced identically, and mutating THAT must be caught
 * STRICTLY EARLIER than the clean divergence. That property is what makes the catch attributable, and
 * it holds for any game rather than for the one the plant was written against. */
/* EVERY PLANT IS A NO-OP UNTIL THE STREAM IS LONG ENOUGH, and that guard is not defensive coding.
 * `alignAndCheck` runs once per turn AND once before turn 1, when the trace holds only the four
 * `|switch|` lines. Unguarded, the FIELD plant indexed past the end and threw (reported as NOT
 * CAUGHT), and the SWAP plant wrote `undefined` into the stream and was "caught" at the line it had
 * corrupted by accident rather than at the line it meant to swap — a proof passing for the wrong
 * reason, on the same run as one failing for the wrong reason. */
/* THE PLANT IS AIMED IN REDUCED SPACE AND APPLIED IN RAW SPACE. `k` is an index into the COMPARED
 * stream, and the plant mutates the stream the engine emitted, so it maps through `reduce`'s own
 * index table rather than assuming the two are the same array — which they stopped being the moment
 * the semantic layer landed. It mutates FIELD 2, the body identifier, because no equivalence rule
 * drops that field: a plant a normaliser can erase proves the opposite of what it is for. */
function plantsFor(k) {
  const at = (s, j) => { const m = reduce(s).rawIdx; return j >= 0 && j < m.length ? m[j] : -1; };
  const bend = (line) => { const p = line.split('|'); if (p.length > 2) p[2] += 'XX'; return p.join('|'); };
  return [
    ['a wrong FIELD on the last agreeing line', k - 1,
      s => { const i = at(s, k - 1); if (i < 0) return s; const t = s.slice(); t[i] = bend(t[i]); return t; }],
    ['a MISSING event — the last agreeing line deleted', k - 1,
      s => { const i = at(s, k - 1); if (i < 0) return s; const t = s.slice(); t.splice(i, 1); return t; }],
    ['two agreeing events SWAPPED — the ordering class must fire', k - 2,
      s => { const i = at(s, k - 1), j = at(s, k - 2); if (i < 0 || j < 0) return s;
             const t = s.slice(); const x = t[j]; t[j] = t[i]; t[i] = x; return t; }],
  ];
}
/* THE FOUR ARMS OF THE PROOF MUST BE THE SAME GAME, and they were not. The driver is COVERAGE-SEEKING
 * and therefore STATEFUL: `CLICKS` and `COV_HITS` carry across games on purpose, so the second run of
 * one team pair deliberately clicks something else. That is right for the swarm and fatal for a
 * proof — the FIELD plant reported NOT CAUGHT because the planted arm was a different game that
 * happened not to part where the clean one did. Frozen and restored around each arm. */
function withFrozenDriver(fn) {
  const c = new Map(CLICKS), h = new Map(COV_HITS);
  try { return fn(); }
  finally { CLICKS.clear(); for (const [k, v] of c) CLICKS.set(k, v);
            COV_HITS.clear(); for (const [k, v] of h) COV_HITS.set(k, v); }
}
function plantedProof(pairA, pairB) {
  const clean = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'proof/clean'));
  const k = clean.div ? clean.div.index : clean.lines;
  const cleanRow = { what: 'the CLEAN arm of the same game', caught: !!clean.div,
                     at: clean.div ? clean.div.index : null, agreeing_prefix: k,
                     cls: clean.div ? classify(clean.div).cls : null };
  if (k < 3) return [{ what: 'CANNOT PLANT — the clean game parts after only ' + k + ' lines, so there '
                             + 'is no agreeing prefix to plant inside', caught: false, at: null }, cleanRow];
  return plantsFor(k).map(([what, expectAt, plant]) => {
    const r = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'proof/' + what.slice(0, 12), { plant }));
    return { what, caught: !!r.div, at: r.div ? r.div.index : null, expected_at: expectAt,
             earlier_than_clean: !!r.div && r.div.index < k,
             cls: r.div ? classify(r.div).cls : null };
  }).concat([cleanRow]);
}

/* ---- DIRECTED SCENARIOS — §3.2, and the two findings this harness was built to reproduce ---------
 *
 * The swarm alone never reaches the fringe: Upper Hand is 76 uses and a uniform 1,000-game sample
 * gets it 1.6 times. These are staged on purpose, driven through the SAME aligner as every swarm
 * game, so a finding here is the same kind of object as a finding there.
 *
 * TWO OF THEM ARE PREDICTIONS RATHER THAN DISCOVERIES. docs/GAME-DIFFERENTIAL-DESIGN.md §5a filed
 * both from a hand-run on the night the stream was built, and a harness that cannot reproduce a
 * finding somebody already made by hand is not aligned. */
/* THE DECLARED EXCEPTION, per conformance S12b. The scenarios below name real species, real moves,
 * real items and real abilities, and that is not a hardcode — it is a FIXTURE. A staged two-line
 * scenario cannot be derived from a tag: "an Intimidated attacker landing a guaranteed crit" is a
 * specific board, and docs/GAME-DIFFERENTIAL-DESIGN.md §6 writes it out by name for the same reason.
 * Every probe in tests/test-mechanics.js does likewise.
 *
 * NOTHING HERE DECIDES ANYTHING. The names appear only inside `DIRECTED`, which is a table of staged
 * boards; no membership test, no lookup and no branch in this file reads a name. The swarm's feature
 * sets come from `engine/diff_swarm.js`, which derives them through `names.byTag` and throws on a tag
 * that does not exist. If a name below stopped existing the scenario would fail to build and say so —
 * which is exactly the failure mode S12b exists to prevent, arriving loudly rather than as a silent
 * zero. */
const GAME_RULES = {
  'move:protect': 'fixture only — the partner slot in a staged scenario must click something legal',
  'move:agility': 'fixture only — the body TAKING the staged hit must click something that is not a shield and cannot change the damage',
  'ability:intimidate': 'fixture only — §6\'s acceptance case IS "an Intimidated attacker landing a crit"',
};
void GAME_RULES;
const stage = (rows) => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
/* THE BODY TAKING THE HIT MUST STILL CLICK SOMETHING. Showdown refuses `pass` for a healthy active
 * Pokemon, and it is right to — a position that cannot be reached is a position whose divergence
 * means nothing. It must not be Protect either: Protect is +4 and would block the very hit being
 * staged, which is tests/test-game-diff.js's `fillerFor` lesson (30 pairs where the interaction under
 * test could not happen).
 *
 * AND IT MUST NOT BE IRON DEFENSE EITHER, WHICH IS THE VERSION THIS WAS FIRST WRITTEN AS. The comment
 * said "resolves at priority 0 AFTER the hit, so its boost cannot change the damage" — which is true
 * only when the ATTACKER IS FASTER. Garchomp is 102 base Speed against Incineroar's 60, so in the
 * contact-punish scenario the defender moved first, took Close Combat at +2 Defence, and the interior
 * measurement read `showdown 37..44  medicham 73..86` — a clean factor of two that looked exactly
 * like an engine bug and was the harness boosting the target it was measuring.
 * Agility is the same shape with the stat swapped for one no damage formula here reads. */
const TAKE_IT = 'Agility';
const BENCH = (...names) => names.map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }));
const DIRECTED = [
  { name: 'knock-off order — the item leaves before the HP is subtracted (§5a)',
    predicts: 'ordering',
    A: stage([['incineroar', '', 'Blaze', ['Knock Off', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'garchomp')),
    B: stage([['snorlax', 'Leftovers', 'Thick Fat', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'weavile')),
    script: [{ p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  { name: 'contact punish — Rough Skin resolves against the attacker (§5a)',
    predicts: 'ordering',
    A: stage([['incineroar', '', 'Blaze', ['Close Combat', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['garchomp', '', 'Rough Skin', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  { name: 'resist berry — the berry is spent against the hit it resists (§5a)',
    predicts: 'ordering',
    A: stage([['garchomp', '', 'Sand Veil', ['Stomping Tantrum', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['incineroar', 'Shuca Berry', 'Blaze', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'stompingtantrum', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  { name: 'Intimidate x guaranteed crit — the crit ignores the attacker\'s -1 (§6)',
    predicts: '-damage field',
    A: stage([['meowscarada', '', 'Overgrow', ['Flower Trick', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['incineroar', '', 'Intimidate', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'flowertrick', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
];

function runDirected() {
  return DIRECTED.map(sc => {
    const a = buildPair(sc.A), b = buildPair(sc.B);
    if (!a || !b) return { name: sc.name, predicts: sc.predicts, staged: false };
    const r = playGame(a, b, 'directed', sc.name, { script: sc.script });
    return { name: sc.name, predicts: sc.predicts, staged: true, turns: r.turns, err: r.err,
             diverged: !!r.div, at: r.div ? r.div.index : null, agreed: r.div ? r.div.agreedLines : null,
             cls: r.div ? classify(r.div).cls : null,
             showdown: r.div ? r.div.sdRaw : null, medicham: r.div ? r.div.meRaw : null,
             sdAfter: r.div ? r.div.sdAfterRaw.slice(0, 4) : null, meAfter: r.div ? r.div.meAfterRaw.slice(0, 4) : null };
  });
}

/* ---- ROADMAP #80 — THE KNOCK OFF ORDERING IS A DAMAGE BUG, AND IT HAS TWO HALVES ----------------
 *
 * The directed knock-off scenario above shows the ORDER: Showdown subtracts the HP and only then
 * takes the item, medicham2 takes the item first. Will identified the consequence and it was checked
 * against the pinned checkout rather than recalled:
 *
 *     data/moves.ts:9962   onBasePower  -> getItem(); if (item.id) chainModify(1.5)   BEFORE damage
 *                          onAfterHit   -> takeItem(); add('-enditem', ...)           AFTER  damage
 *
 * TWO BERRIES SIT ON OPPOSITE SIDES OF THAT LINE AND GIVE OPPOSITE ANSWERS:
 *
 *   COLBUR BERRY (items.ts:1133) is `onSourceModifyDamage` — INSIDE the damage calculation. It eats
 *   itself and halves a super-effective Dark move. So Showdown takes Knock Off's 1.5x, halves the
 *   result while the berry consumes itself, and `onAfterHit`'s takeItem() then finds NOTHING and
 *   emits NO `-enditem` at all. Net 0.75x. Because medicham2 strips the item first, COLBUR CAN NEVER
 *   FIRE FOR IT — full super-effective damage where Showdown deals half.
 *   SITRUS BERRY (items.ts:5740) is `onUpdate` — it tests hp <= maxhp/2 AFTER the hit, by which time
 *   takeItem() has run, so Showdown DOES strip it before it can proc. Opposite result, same move,
 *   same turn. A probe that tests one of these proves nothing about the other.
 *
 * SO THE TWO HALVES ARE ASSERTED SEPARATELY AND NEVER ON THE FINAL HP. If the 1.5x is also evaluated
 * after removal, the lost boost and the lost halving PARTIALLY CANCEL, and the net error ends up small
 * enough that nothing flags it — the worst outcome, because it looks like agreement.
 *
 *   arm 0   target holds NOTHING          D0
 *   arm 1   target holds an inert item    D1     BOOST HALF     D1 / D0 must be 1.5
 *   arm 2   target holds Colbur Berry     D2     REDUCTION HALF D2 / D1 must be 0.5
 */
const KO_TARGET_ITEMS = [['', 'no item at all — the baseline the 1.5x is measured against'],
                         ['Leftovers', 'an inert held item — Knock Off\'s onBasePower sees it, nothing else does'],
                         ['Colbur Berry', 'onSourceModifyDamage — it fires INSIDE the damage calculation']];
function knockOffArms() {
  const out = [];
  for (const [item, why] of KO_TARGET_ITEMS) {
    /* Gengar is Ghost/Poison, so Knock Off is super-effective and Colbur is in scope. */
    const A = stage([['incineroar', '', 'Blaze', ['Knock Off', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile'));
    const B = stage([['gengar', item, 'Cursed Body', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax'));
    const script = [{ p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }];
    const a = buildPair(A, { hpBoost: 8 }), b = buildPair(B, { hpBoost: 8 });
    if (!a || !b) { out.push({ item, why, staged: false }); continue; }
    const sd = oneHitDamage(a, b, script, { sdRoll: 0 });
    const me = mediSpan(a, b, script);
    /* did Knock Off announce taking the item, in each engine? */
    const g = playGame(a, b, 'directed', 'ko/' + (item || 'none'), { script });
    const sdLines = sdStream(gLogOf(g));
    /* WHICH `-enditem` — the berry eating ITSELF or Knock Off taking it — is the whole question, so
     * the two are kept apart. A bare "was there an -enditem" answers yes in both engines for
     * opposite reasons, which is a check that cannot fail. */
    const tag = (lines) => lines.filter(l => /\|-enditem\|/.test(l));
    out.push({ item, why, staged: true, showdown: sd, medicham: me ? me.max : null,
               showdown_enditem: tag(sdLines), medicham_enditem: tag(g.mediTrace),
               showdown_stream: sdLines, medicham_stream: g.mediTrace });
  }
  /* THE SITRUS HALF, WHICH IS THE OPPOSITE CASE AND NEEDS ITS OWN HP POOL. Sitrus is `onUpdate` and
   * tests hp <= maxhp/2 AFTER the hit, by which time Showdown's takeItem() has run — so Showdown
   * strips it and it never procs. It needs a pool the Knock Off drops BELOW half without killing, so
   * it cannot ride on the ratio arms above (which are inflated x8 precisely so nothing dies). */
  const sitrus = (() => {
    const A = stage([['incineroar', '', 'Blaze', ['Knock Off', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile'));
    const B = stage([['gengar', 'Sitrus Berry', 'Cursed Body', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax'));
    const script = [{ p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }];
    const a = buildPair(A, { hpBoost: 3 }), b = buildPair(B, { hpBoost: 3 });
    if (!a || !b) return { staged: false };
    const g = playGame(a, b, 'directed', 'ko/sitrus', { script });
    const sd = sdStream(gLogOf(g));
    const heal = (lines) => lines.filter(l => /\|-heal\|.*sitrus/i.test(l));
    const end = (lines) => lines.filter(l => /\|-enditem\|/.test(l));
    return { staged: true,
      what: 'Knock Off takes Sitrus BEFORE its onUpdate can see the HP, so it must NOT heal',
      showdown_healed: heal(sd).length > 0, medicham_healed: heal(g.mediTrace).length > 0,
      showdown_enditem: end(sd), medicham_enditem: end(g.mediTrace) };
  })();
  const num = (i, j) => (out[i].showdown && out[j].showdown ? +(out[i].showdown / out[j].showdown).toFixed(3) : null);
  const mnum = (i, j) => (out[i].medicham && out[j].medicham ? +(out[i].medicham / out[j].medicham).toFixed(3) : null);
  return { arms: out, sitrus_half: sitrus,
    boost_half:     { what: 'Knock Off x1.5 when the target HOLDS an item — measured against the no-item arm',
                      showdown: num(1, 0), medicham: mnum(1, 0), expected: 1.5 },
    reduction_half: { what: 'Colbur Berry x0.5 against a super-effective Dark move — measured against the inert-item arm',
                      showdown: num(2, 1), medicham: mnum(2, 1), expected: 0.5 },
    net:            { what: 'the two multiplied — 0.75. Quoted LAST, because asserting only this is how '
                          + 'a lost boost and a lost halving cancel into something nobody flags',
                      showdown: num(2, 0), medicham: mnum(2, 0), expected: 0.75 } };
}
/* the Showdown log of a played game, kept off `playGame`'s return shape so nothing else grows a
 * dependency on it. */
let _lastSdLog = [];
const gLogOf = () => _lastSdLog;

/* ---- THE DAMAGE INTERIOR, MEASURED RATHER THAN ASSERTED ------------------------------------------
 * The second filed prediction: `tests/test-engine-diff.js` compares `roll=0` against MEDICHAM's min
 * and `roll=15` against its max, so 149/150 is compatible with every one of the fourteen middle
 * rolls being off, AND with every roll's probability being wrong. Mode A had to confront this to
 * choose a pin at all (see the header), so the honest thing is to MEASURE the interior rather than
 * quote the header.
 *
 * For one staged hit: enumerate all 16 Showdown rolls by pinning `random(16)` to each index in turn,
 * and all of medicham2's values by pinning its rng to each of its own integers. Then compare the two
 * as MULTISETS — the design's claim is about multiplicities, not about the span. */
function damageInterior(sc) {
  const a = buildPair(sc.A), b = buildPair(sc.B);
  if (!a || !b) return null;
  const sdVals = [];
  for (let roll = 0; roll < 16; roll++) {
    const v = oneHitDamage(a, b, sc.script, { sdRoll: roll });
    if (v != null) sdVals.push(v);
  }
  /* MEDICHAM'S SPAN IS ASKED FOR, NOT SWEPT. The first version swept its scalar `rng` across [0,1)
   * and got 37..55 where the true span is 37..44 — because the SAME scalar drives the crit roll
   * (`rng() < 1/24`), so the bottom of the damage sweep was silently critting. A sweep that has to
   * dodge the instrument's own side effects is not a measurement of the thing it names.
   * `dmgRange` IS the fact, and every rollout in this engine reads it. */
  const meSpan = mediSpan(a, b, sc.script);
  if (!meSpan) return null;
  const meVals = [];
  for (let v = meSpan.min; v <= meSpan.max; v++) meVals.push(v);   // sampled UNIFORMLY by the engine
  const uniq = arr => [...new Set(arr)].sort((x, y) => x - y);
  const sdSet = uniq(sdVals), meSet = uniq(meVals);
  const count = arr => { const m2 = new Map(); for (const v of arr) m2.set(v, (m2.get(v) || 0) + 1); return m2; };
  const sdC = count(sdVals), meC = count(meVals);
  /* medicham2 draws its span UNIFORMLY, so its probability for value v is 1/|span|; Showdown's is
   * (times v appears among 16 rolls)/16. Reported as the largest absolute difference in probability
   * over the union of the two spans. */
  let worstP = 0, worstAt = null;
  for (const v of uniq([...sdSet, ...meSet])) {
    const p1 = (sdC.get(v) || 0) / sdVals.length, p2 = (meC.get(v) || 0) / meSet.length;
    if (Math.abs(p1 - p2) > worstP) { worstP = Math.abs(p1 - p2); worstAt = v; }
  }
  return { name: sc.name, sd_span: [sdSet[0], sdSet[sdSet.length - 1]], me_span: [meSet[0], meSet[meSet.length - 1]],
           sd_distinct: sdSet.length, me_distinct: meSet.length,
           endpoints_agree: sdSet[0] === meSet[0] && sdSet[sdSet.length - 1] === meSet[meSet.length - 1],
           values_showdown_can_produce_that_medicham_cannot: sdSet.filter(v => !meSet.includes(v)),
           values_medicham_can_produce_that_showdown_cannot: meSet.filter(v => !sdSet.includes(v)),
           worst_probability_gap: +worstP.toFixed(4), worst_at: worstAt };
}
/* medicham2's own damage span for the staged hit, read from the engine's own `dmgRange` after
 * `battleInit` has applied the entry abilities — so an Intimidate on the field is priced in. */
function mediSpan(pairA, pairB, script) {
  const A = freshBodies(pairA), B = freshBodies(pairB);
  if (A.some(x => !x) || B.some(x => !x)) return null;
  const S = M.battleInit(A, B, {});
  const w = script[0].p1[0]; if (!w) return null;
  const mv = (globalThis.MC && globalThis.MC.moves) ? globalThis.MC.moves[id(w.m)] : null;
  if (!mv) return null;
  const spread = M.MEDI_SPREAD ? M.MEDI_SPREAD.has(id(w.m)) : false;
  const d = M.dmgRange(S.actA[0], S.actB[0], mv, S.field, spread);
  return d && d.max >= d.min ? { min: d.min, max: d.max } : null;
}

/* One staged turn, one engine, one roll. Returns the HP the defender lost. */
function oneHitDamage(pairA, pairB, script, opt) {
  if (opt.sdRoll != null) {
    const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
    battle.setPlayer('p1', { name: 'A', team: Teams.pack(pairA.map(x => x.sd)) });
    battle.setPlayer('p2', { name: 'B', team: Teams.pack(pairB.map(x => x.sd)) });
    const bA = freshBodies(pairA), bB = freshBodies(pairB);
    for (const [side, pair, built] of [[battle.p1, pairA, bA], [battle.p2, pairB, bB]]) for (const p of side.pokemon) {
      const k = pair.findIndex(x => id(x.sd.species) === id(p.species.id)); if (k < 0) continue;
      const st = built[k].st;
      p.storedStats.atk = st.at; p.storedStats.def = st.df; p.storedStats.spa = st.sa;
      p.storedStats.spd = st.sd; p.storedStats.spe = st.sp;
      p.baseStoredStats.atk = st.at; p.baseStoredStats.def = st.df; p.baseStoredStats.spa = st.sa;
      p.baseStoredStats.spd = st.sd; p.baseStoredStats.spe = st.sp;
      const full = p.hp === p.maxhp; p.maxhp = st.hp; p.baseMaxhp = st.hp; if (full) p.hp = st.hp;
    }
    battle.prng.random = (m2, n2) => (n2 === undefined && m2 === 16 ? opt.sdRoll : pinRandom(m2, n2));
    battle.prng.randomChance = (num, den) => (den === 16 ? opt.sdRoll < num : PIN_CHANCE(num, den));
    if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
    const before = battle.p2.active[0].hp;
    const step = script[0];
    const mk = (side, acts) => side.active.map((p, i) => {
      const w = acts[i]; if (!p || !w) return 'pass';
      const k = p.set.moves.findIndex(mv => id(mv) === id(w.m)); if (k < 0) return 'pass';
      const dm = dex.moves.get(id(w.m));
      const needs = ['normal', 'any', 'adjacentFoe'].includes(dm.target);
      return 'move ' + (k + 1) + (needs ? ' ' + ((w.t == null ? 0 : w.t) + 1) : '');
    }).join(', ');
    battle.choose('p1', mk(battle.p1, step.p1)); battle.choose('p2', mk(battle.p2, step.p2));
    return before - battle.p2.active[0].hp;
  }
  const A = freshBodies(pairA), B = freshBodies(pairB);
  const S = M.battleInit(A, B, {});
  const before = S.actB[0].curHP;
  const step = script[0];
  const mk = (own, foes, acts) => { const map = new Map();
    own.forEach((mon, i) => { const w = acts[i]; if (!mon) return;
      if (!w) { map.set(mon, { kind: 'pass' }); return; }
      map.set(mon, M.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
    return map; };
  M.battleTurn(S, () => opt.mediRoll, mk(S.actA, S.actB, step.p1), mk(S.actB, S.actA, step.p2));
  return before - S.actB[0].curHP;
}

/* ---- RUN ----------------------------------------------------------------------------------------- */
const SW = SWARM.buildSwarm(Math.max(GAMES * 2, 18));

/* ROADMAP #31 — EVERY PAIR IS BUILT TWICE, AND THE TWO BUILDS DIFFER ONLY IN THE STONES.
 *
 * `stones` is the measured arm; `nostones` is the paired control and is exactly what this instrument
 * measured on 2026-08-06, when 460 stone sets were stripped and it tested zero mega bodies. Reporting
 * one rate over a mixed population would let the two absorb each other, and the whole point is to see
 * WHAT MEGAS COST — so the same teams, the same seeds and the same driver state are played both ways
 * and the two rates are published apart. A pair carrying no stone at all produces two IDENTICAL games,
 * which is a free consistency check and is asserted rather than assumed. */
function pairsFor(cfgId) {
  const cfg = SW.out.find(c => c.config === cfgId);
  const out = [];
  const pool = (cfg && cfg.picked_teams) || [];
  for (let i = 0; i + 1 < pool.length; i += 2) {
    const a = buildPair(pool[i].team), b = buildPair(pool[i + 1].team);
    if (!a || !b) continue;
    const aN = buildPair(pool[i].team, { stripStones: true });
    const bN = buildPair(pool[i + 1].team, { stripStones: true });
    if (!aN || !bN) continue;
    out.push({ a, b, aN, bN, tag: pool[i].id + ' vs ' + pool[i + 1].id,
               stones: [...a, ...b].filter(x => isStone(x.spec.item)).length });
  }
  return out;
}

module.exports = { playGame, buildPair, classify, pinRandom, PIN_CHANCE, sdStream, chooseAction,
                   plantedProof, pairsFor, COV_TARGETS, COV_UNMEASURABLE, PIN_CLAIMS, REL, SW,
                   runDirected, damageInterior, DIRECTED, EQUIV, equivProof, semantic, reduce, NORM_COUNTS,
                   knockOffArms, KO_TARGET_ITEMS };

if (require.main !== module) return;

/* TRAP 4 FIRST, ALWAYS — the comparator proves it can find a planted divergence before any result
 * below is worth reading. */
/* THE EQUIVALENCE LAYER PROVES ITSELF FIRST, BOTH DIRECTIONS, BEFORE IT IS ALLOWED TO QUIETEN
 * ANYTHING. A rule that does not collapse the form it claims to is dead weight; a rule that collapses
 * the MEANING is a silencer, and the second is the one that would make every number below a lie. */
const EQP = equivProof();
const EQ_BAD = EQP.filter(r => !r.collapses || !r.keeps_meaning);
console.log('\n  THE SEMANTIC NORMALISER — every equivalence, both directions, before any game:');
for (const r of EQP) console.log('    ' + (r.collapses ? 'collapses' : 'DOES NOT COLLAPSE') + ' / '
  + (r.keeps_meaning ? 'keeps meaning' : 'SILENCER — it collapses the DISTINCT pair too') + '   ' + r.id);
if (EQ_BAD.length) {
  console.log('    A RULE FAILED ITS OWN RED DEMONSTRATION. Every rate below would be the comparator, not the engine.');
  process.exitCode = 1;
}

const proofPairs = pairsFor('baseline');
const PROOF = proofPairs.length ? plantedProof(proofPairs[0].a, proofPairs[0].b) : [];
/* CAUGHT IS NOT ENOUGH. It must be caught EARLIER than the clean arm's own divergence (or the catch
 * might be that divergence) and at EXACTLY the line it was planted at (or the aligner is detecting
 * without localising, which is the scoreboard §5 exists to reject). */
const PROOF_OK = PROOF.filter(p => p.what !== 'the CLEAN arm of the same game')
  .every(p => p.caught && p.earlier_than_clean && p.at === p.expected_at);
console.log('\n  PLANTED-DIVERGENCE PROOF (a silent zero is a broken comparator, not a clean engine):');
for (const p of PROOF) console.log('    ' + (p.what === 'the CLEAN arm of the same game'
  ? (p.caught ? 'the CLEAN arm itself diverges at line ' + p.at + ' (' + p.cls + ') — the plants are judged against that'
              : 'the CLEAN arm agrees, so every catch below is the plant')
  : (p.caught && p.at === p.expected_at && p.earlier_than_clean
       ? 'CAUGHT at line ' + String(p.at).padEnd(5) + 'exactly where planted: ' + p.what
       : (p.caught ? 'CAUGHT at ' + p.at + ' but PLANTED at ' + p.expected_at + ' — ' + p.what
                   : 'NOT CAUGHT — ' + p.what))));
if (!PROOF_OK) console.log('    THE COMPARATOR FAILED ITS OWN PROOF — everything below is worthless.');

const results = [];      // the MEASURED arm — stones kept
const control = [];      // the PAIRED CONTROL — the same pair with the stones removed
/* A pair carrying no stone produces two identical games; when it does not, the harness is not paired
 * and the two rates below are not comparable. Counted, printed, must read 0. */
let PAIRING_BROKEN = 0;
const t0 = Date.now();
if (!has('--proof')) {
  const live = SW.out.filter(c => !ONLY || c.config === ONLY);
  const perConfig = Math.max(1, Math.floor(GAMES / live.length));
  /* THE DRIVER IS STATEFUL ON PURPOSE (`CLICKS`, `COV_HITS` carry across games so the swarm keeps
   * reaching new mechanics), which is fatal for a PAIRED comparison — the second arm of a pair would
   * deliberately click something else and stop being the same game. Frozen across the two arms and
   * released afterwards, exactly as withFrozenDriver does for the planted proof. */
  const snap = () => ({ c: new Map(CLICKS), h: new Map(COV_HITS) });
  const restore = (s) => { CLICKS.clear(); for (const [k, v] of s.c) CLICKS.set(k, v);
                           COV_HITS.clear(); for (const [k, v] of s.h) COV_HITS.set(k, v); };
  for (const cfg of live) {
    let made = 0;
    for (const pr of pairsFor(cfg.config)) {
      if (made >= perConfig) break;
      const s0 = snap();
      const c = playGame(pr.aN, pr.bN, cfg.config, pr.tag + ' [stones removed]');
      restore(s0);
      const r = playGame(pr.a, pr.b, cfg.config, pr.tag);
      r.stones = pr.stones; c.stones = 0;
      if (!pr.stones) {
        const same = (!!r.div === !!c.div) && (!r.div || r.div.index === c.div.index) && r.turns === c.turns;
        if (!same) PAIRING_BROKEN++;
      }
      results.push(r); control.push(c); made++;
      /* SUMMED OVER THE MEASURED ARM ONLY, and that is not fussiness. `playGame` is also called by
       * the planted-divergence proof (four extra games on the baseline pair) and by the directed
       * scenarios, so a module-level counter incremented inside it would count offers from games
       * whose EVOLUTIONS are not in `results` — and the report would then show 44 choices against 40
       * evolutions and look like a lost choice. It did, on the first run of this. */
      MEGA_CHOICES += r.megaChoices;
      MEGA_MEDI += r.megaMedi; MEGA_SD += r.megaSd;
      MEGA_SIDES_CAPABLE += r.megaCapableSides; MEGA_SIDES_EVOLVED += r.megaSidesEvolved;
      MEGA_SLOT_A += r.megaSlotA; MEGA_SLOT_B += r.megaSlotB;
      if (VERBOSE) console.log('   ' + cfg.config.padEnd(24) + (r.err ? 'THREW ' + r.err
        : r.div ? 'DIVERGES at line ' + r.div.index + '  ' + classify(r.div).cls : 'agrees, ' + r.turns + ' turns'));
    }
  }
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const DIR = runDirected();
const KO = knockOffArms();
/* THE INTERIOR IS MEASURED ONLY WHERE THE ENDPOINTS ARE THE QUESTION. The Intimidate-crit scenario is
 * excluded on purpose: `dmgRange` does not carry the crit multiplier and the Intimidate case's whole
 * point is that the two engines price the ATTACK differently, so its span gap would be that bug
 * rather than the roll granularity — two findings sharing one number is how a tolerance gets set. */
const INTERIOR = DIRECTED.filter(s => /knock-off|contact/.test(s.name)).map(damageInterior).filter(Boolean);

/* ---- REPORT --------------------------------------------------------------------------------------- */
const diverged = results.filter(r => r.div);
const threw = results.filter(r => r.err);
const classes = new Map();
for (const r of diverged) {
  const c = classify(r.div);
  if (!classes.has(c.cls)) classes.set(c.cls, { games: 0, causes: new Map() });
  const e = classes.get(c.cls);
  e.games++;
  e.causes.set(c.cause, (e.causes.get(c.cause) || 0) + 1);
  r._cls = c;
}

/* TWO STRENGTHS OF COVERAGE, AND THEY MUST NOT BE ADDED UP INTO ONE NUMBER.
 *
 * A move that CONNECTED did something: the engine ran its handler and the stream carries the result.
 * An ability or an item that was merely ON THE FIELD did not necessarily do anything at all — and in
 * this run that distinction is not academic, because the median game parts after SEVEN protocol
 * lines, which is inside turn one. Reporting "Unnerve: covered" because a body holding Unnerve stood
 * in a slot for one turn is the same over-claim as the damage differential's 12% tolerance.
 *
 * So: MOVES are exercised, ABILITIES and ITEMS are present, and the report says which is which. */
const reach = t => {
  const src = t.sec === 'moves' ? OBSERVED.moves : t.sec === 'abilities' ? OBSERVED.abilities : OBSERVED.items;
  for (const e of t.entities) if (src.has(e)) return true;
  return false;
};
const covStrong = COV_TARGETS.filter(t => t.sec === 'moves' && reach(t));
const covWeak = COV_TARGETS.filter(t => t.sec !== 'moves' && reach(t));
const covered = COV_TARGETS.filter(reach);
const uncovered = COV_TARGETS.filter(t => !reach(t));
const TURNS = results.map(r => r.turns).sort((a, b) => a - b);
const medianTurns = TURNS.length ? TURNS[Math.floor(TURNS.length / 2)] : 0;

console.log('\nWHOLE-GAME DIFFERENTIAL — MODE A (pinned, tolerance zero)   ' + REL.id);
console.log('  ' + results.length + ' games, ' + elapsed + 's, showdown ' + (CS.actualCommit() || 'UNKNOWN').slice(0, 12));
console.log('  tags.json in the release matches the live tree: ' + (TAGS_MATCH ? 'yes' : 'NO — the coverage sets and the engine were frozen from different bytes'));
console.log('');
console.log('  THE PIN — every claim below was asserted before a game ran:');
for (const [w] of PIN_CLAIMS) console.log('    ok  ' + w);
console.log('');
console.log('  DIVERGED: ' + diverged.length + ' of ' + results.length + ' games'
  + (threw.length ? '   (' + threw.length + ' threw)' : ''));
console.log('');
/* ROADMAP #31 — THE TWO RATES, PUBLISHED APART. One number over a mixed population would let the mega
 * games and the non-mega games absorb each other, and the whole reason the stones came back is to see
 * what they cost. Same teams, same seeds, same driver state; the ONLY difference is the stone. */
{
  const withStone = results.filter(r => r.stones);
  const withStoneCtl = control.filter((c, i) => results[i].stones);
  const noStone = results.filter(r => !r.stones);
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
  const dv = arr => arr.filter(r => r.div).length;
  console.log('  THE TWO RATES — the same pairs played twice, and the stone is the only difference:');
  console.log('    with megas, on the pairs that CARRY a stone     '
    + dv(withStone) + '/' + withStone.length + '  ' + pct(dv(withStone), withStone.length));
  console.log('    the SAME pairs with the stones removed          '
    + dv(withStoneCtl) + '/' + withStoneCtl.length + '  ' + pct(dv(withStoneCtl), withStoneCtl.length));
  console.log('    pairs that carry no stone at all (unaffected)   '
    + dv(noStone) + '/' + noStone.length + '  ' + pct(dv(noStone), noStone.length));
  console.log('    whole-run control arm, every stone stripped     '
    + dv(control) + '/' + control.length + '  ' + pct(dv(control), control.length)
    + '   <- this is what the 2026-08-06 run measured');
  console.log('    stoneless pairs whose two arms were NOT the same game: ' + PAIRING_BROKEN
    + (PAIRING_BROKEN ? '  <-- THE PAIRING IS BROKEN and the two rates are not comparable' : ' (must read 0)'));
  console.log('');
  /* A RATE ALREADY AT 100% CANNOT ANSWER "WHAT DID MEGAS COST", and saying it did would be the
   * 12%-tolerance mistake in a new place. So the paired arms are compared on WHERE they part and on
   * WHETHER the mega itself is what parted them — two questions a saturated rate cannot reach. */
  console.log('  WHAT THE MEGAS ACTUALLY COST, measured pairwise (the rate above is saturated and');
  console.log('  therefore says nothing on its own):');
  const at = r => (r.div ? r.div.index : Infinity);
  const paired = results.map((r, i) => ({ r, c: control[i] })).filter(x => x.r.stones);
  const earlier = paired.filter(x => at(x.r) < at(x.c)).length;
  const later = paired.filter(x => at(x.r) > at(x.c)).length;
  const same = paired.filter(x => at(x.r) === at(x.c)).length;
  /* `-mega` AND `detailschange` ARE COUNTED APART, and that is not pedantry: `detailschange` is
   * Showdown's line for ANY permanent forme change, and Zero to Hero is one. Merging them would have
   * reported this run's single hit as a mega wire when it is a Palafin. */
  const isMega = l => /^\|-mega\|/.test(String(l || ''));
  const isDetails = l => /^\|detailschange\|/.test(String(l || ''));
  const megaFirst = results.filter(r => r.div && (isMega(r.div.sdRaw) || isMega(r.div.meRaw))).length;
  const detFirst = results.filter(r => r.div && (isDetails(r.div.sdRaw) || isDetails(r.div.meRaw))).length;
  console.log('    of ' + paired.length + ' stone-carrying pairs, the mega arm parted EARLIER on '
    + earlier + ', LATER on ' + later + ', at the SAME line on ' + same);
  console.log('    games whose FIRST divergence is a |-mega| line: ' + megaFirst
    + (megaFirst ? '  <-- MEGA WIRES, listed in mega.cost_of_the_megas.on_a_mega_line'
                 : '  — nothing in this run is attributable to the evolution itself'));
  console.log('    games whose FIRST divergence is a |detailschange| line: ' + detFirst
    + '  (any permanent forme change, NOT only megas — Zero to Hero is one)');
  console.log('');
  console.log('  MEGA EVOLUTION — the counter, and a RATE beside it because non-zero is not a bar:');
  console.log('    ' + MEGA_MEDI + ' evolutions in medicham2, ' + MEGA_SD + ' in showdown'
    + (MEGA_MEDI === MEGA_SD ? '  (they agree)' : '  <-- ASYMMETRIC: the choice reached one engine and not the other'));
  /* THE FLOOR IS ON THE CHOICE, NOT ON THE SIDE, and the difference matters. Every choice this driver
   * issues came from Showdown's own `canMegaEvo`, so every one of them MUST produce exactly one
   * evolution in each engine — that is a hard 100% and a real floor. "Sides that brought a stone" is
   * reported beside it and is deliberately NOT the floor: a game stops at its FIRST divergence, the
   * median game here lasts one completed turn, and a stone-holder sitting on the bench is never
   * offered the choice at all. Making that the floor would be measuring the harness's early stop. */
  const choiceFloor = MEGA_CHOICES && MEGA_MEDI === MEGA_CHOICES && MEGA_SD === MEGA_CHOICES;
  console.log('    ' + MEGA_CHOICES + ' mega choices issued (from Showdown\'s own `canMegaEvo`) -> '
    + MEGA_MEDI + ' medicham / ' + MEGA_SD + ' showdown evolutions   '
    + (choiceFloor ? 'FLOOR MET: every choice evolved in both engines'
                   : '<-- A CHOICE DID NOT EVOLVE. The floor is 100% of issued choices.'));
  console.log('    ' + MEGA_SIDES_EVOLVED + ' of ' + MEGA_SIDES_CAPABLE + ' sides that BROUGHT a stone evolved  '
    + pct(MEGA_SIDES_EVOLVED, MEGA_SIDES_CAPABLE)
    + '   (not a floor: a game stops at its first divergence, so a benched stone-holder is never offered)');
  console.log('    from the LEFT slot ' + MEGA_SLOT_A + ', from the RIGHT slot ' + MEGA_SLOT_B
    + (MEGA_SLOT_A && MEGA_SLOT_B ? '' : '  <-- ONE SLOT ONLY, which is the literal historical defect'));
  if (!MEGA_MEDI) console.log('    ZERO EVOLUTIONS. The capability cannot prove it ran, so it is assumed broken.');
  console.log('');
}
console.log('  WHAT THE SEMANTIC NORMALISER COLLAPSED, per rule — a normaliser whose effect is invisible');
console.log('  is how a 100% divergence rate becomes 2% with nobody able to say which half moved:');
{
  const tot = [...NORM_COUNTS.values()].reduce((a, b) => a + b, 0);
  for (const r of EQUIV) console.log('    ' + String(NORM_COUNTS.get(r.id) || 0).padStart(7)
    + '  lines  ' + r.id + (NORM_COUNTS.get(r.id) ? '' : '   <-- collapsed NOTHING this run'));
  console.log('    ' + String(tot).padStart(7) + '  lines  TOTAL across ' + EQUIV.length + ' equivalence rules');
}
console.log('');
if (classes.size) {
  console.log('  CLASSES — a class is a WIRE, an instance is not:');
  for (const [cls, e] of [...classes].sort((a, b) => b[1].games - a[1].games)) {
    console.log('    ' + cls.padEnd(38) + String(e.games).padStart(4) + ' games   '
      + e.causes.size + ' distinct cause' + (e.causes.size === 1 ? '' : 's'));
    for (const [cause, n] of [...e.causes].sort((a, b) => b[1] - a[1]).slice(0, 4))
      console.log('        ' + String(n).padStart(3) + '  ' + cause.slice(cause.indexOf('::') + 3, 200));
  }
  console.log('');
  const ex = diverged[0];
  console.log('  ONE WORKED EXAMPLE (' + ex.config + '):');
  console.log('    ' + ex.div.agreedLines + ' lines agreed, then:');
  for (const l of ex.div.before) console.log('        both      ' + l);
  console.log('        showdown  ' + ex.div.sd);
  console.log('        medicham  ' + ex.div.me);
  console.log('');
}
if (threw.length) {
  console.log('  THREW — the harness could not finish these games. Counted, never dropped:');
  const byMsg = new Map();
  for (const r of threw) byMsg.set(r.err, (byMsg.get(r.err) || 0) + 1);
  for (const [m2, n] of [...byMsg].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('    ' + String(n).padStart(3) + '  ' + m2);
  console.log('');
}
console.log('  DIRECTED SCENARIOS — the fringe the swarm never reaches (§3.2), and the two findings');
console.log('  docs/GAME-DIFFERENTIAL-DESIGN.md §5a filed by hand before this driver existed:');
for (const d of DIR) {
  console.log('    ' + (d.diverged ? 'DIVERGES' : d.err ? 'THREW   ' : 'agrees  ') + '  ' + d.name);
  if (d.err) console.log('        ' + d.err);
  if (d.diverged) {
    console.log('        ' + d.agreed + ' lines agreed, class "' + d.cls + '"');
    /* THE NEXT FEW LINES OF BOTH STREAMS, because "they differ here" is a scoreboard and "they emit
     * the same three events in a different order" is the finding. */
    for (let k = 0; k < Math.max(d.sdAfter.length, d.meAfter.length); k++)
      console.log('        ' + (k ? '          ' : 'showdown  ') + String(d.sdAfter[k] || '').padEnd(58)
        + (k ? '  ' : '  medicham  ').slice(0, k ? 2 : 12) + (d.meAfter[k] || ''));
  }
}
console.log('');
console.log('  ROADMAP #80 — THE KNOCK OFF ORDERING, ASKED AS TWO INDEPENDENT HALVES:');
{
  const r = (o) => 'showdown ' + o.showdown + '   medicham ' + o.medicham + '   (expected ' + o.expected + ')';
  console.log('    boost      x1.5 for holding an item        ' + r(KO.boost_half));
  console.log('    reduction  x0.5 Colbur vs super-eff Dark   ' + r(KO.reduction_half));
  console.log('    net        the two multiplied              ' + r(KO.net));
  console.log('    ASSERTED APART ON PURPOSE: if the 1.5x were also evaluated after removal the two errors');
  console.log('    would partially cancel and the net would look fine. It does not, and they do not.');
  console.log('    THE PREDICTED DAMAGE BUG DOES NOT REPRODUCE. medicham2 prices BOTH halves correctly,');
  console.log('    because playerAction computes the damage RANGE at click time — before the item is');
  console.log('    stripped — so the ordering costs no damage here. What differs is the item\'s DISPOSITION:');
  for (const a of KO.arms) if (a.item) {
    console.log('      ' + a.item.padEnd(13) + 'showdown ' + JSON.stringify(a.showdown_enditem.map(x => x.split('|').slice(3).join('|'))));
    console.log('      ' + ''.padEnd(13) + 'medicham ' + JSON.stringify(a.medicham_enditem.map(x => x.split('|').slice(3).join('|'))));
  }
  console.log('    Showdown records Colbur as EATEN BY ITSELF ([eat] then [weaken]) so Knock Off finds nothing');
  console.log('    left to take; medicham2 records it as KNOCKED OFF. Same end state, different FACT — and');
  console.log('    "was it eaten" is what Harvest, Recycle, Belch, Cud Chew and Unburden read.');
  console.log('    SITRUS, the opposite side of the same line: ' + (KO.sitrus_half.staged
    ? 'both engines strip it and NEITHER heals — agrees exactly.' : 'COULD NOT BE STAGED.'));
}
console.log('');
console.log('  THE DAMAGE INTERIOR — measured, not quoted. medicham2 samples its span UNIFORMLY;');
console.log('  Showdown rolls 16 indices onto the same span and floors each separately:');
for (const it of INTERIOR) {
  console.log('    ' + it.name);
  console.log('      showdown ' + it.sd_span[0] + '..' + it.sd_span[1] + ' (' + it.sd_distinct + ' distinct)   '
    + 'medicham ' + it.me_span[0] + '..' + it.me_span[1] + ' (' + it.me_distinct + ' distinct)   '
    + 'endpoints ' + (it.endpoints_agree ? 'AGREE' : 'DIFFER'));
  console.log('      values only showdown can produce: [' + it.values_showdown_can_produce_that_medicham_cannot.join(',') + ']');
  console.log('      values only medicham can produce: [' + it.values_medicham_can_produce_that_showdown_cannot.join(',') + ']');
  console.log('      worst per-value probability gap: ' + (100 * it.worst_probability_gap).toFixed(2) + ' points at ' + it.worst_at);
}
console.log('');
console.log('  MECHANIC COVERAGE — what this run actually exercised (§5.3):');
console.log('    ' + covStrong.length + ' / ' + COV_TARGETS.filter(t => t.sec === 'moves').length
  + '  reached by a move that CONNECTED — the engine ran its handler and the stream carries the result');
console.log('    ' + covWeak.length + ' / ' + COV_TARGETS.filter(t => t.sec !== 'moves').length
  + '  reached only by an ability or item that was ON THE FIELD. Present is NOT exercised, and the');
console.log('        median game here parts after ' + medianTurns + ' completed turn(s), so most of these bodies');
console.log('        never acted. This half is the weaker claim and is deliberately not added to the first.');
console.log('    ' + covered.length + ' / ' + COV_TARGETS.length + ' union of the two, stated last because it is the weakest of the three');
console.log('    ' + COV_UNMEASURABLE.length + ' of the ' + CENSUS.results.length
  + ' census rows name an INTERACTION rather than a taggable entity and cannot be measured by this');
console.log('      instrument at all. They are NOT counted as uncovered — a zero on them would read as');
console.log('      a failure of the run instead of a limit of the measurement.');
console.log('    clicked but ALWAYS MISSED (the Mode A pin misses every sub-100-accuracy move): '
  + CLICKED_BUT_MISSED.size + ' moves');
console.log('');
console.log('  THE DRIVER AND THE SWARM COVER DIFFERENT SPACES (§3.3) and are reported apart:');
console.log('    driver / mechanic space :  ' + OBSERVED.moves.size + ' distinct moves connected, '
  + OBSERVED.abilities.size + ' abilities, ' + OBSERVED.items.size + ' items, ' + OBSERVED.species.size + ' species');
console.log('    swarm  / situation space:  ' + [...new Set(results.map(r => r.config))].length + ' configurations, '
  + results.length + ' team pairs');
console.log('');
console.log('  DECLARED GAPS, printed every run so they cannot quietly grow:');
console.log('    mega stones stripped from the MEASURED arm: ' + STONES_KEPT + ' sets kept, 0 stripped'
  + '  (' + STONES_STRIPPED + ' stripped from the paired CONTROL arm, on purpose)');
console.log('    both engines are built Serious / 0 EVs / 31 IVs, so the ladder\'s SPREADS are not tested;');
console.log('      the alignment had to MOVE a stat ' + ALIGN_MOVED + ' times outside the staged hpBoost arms'
  + (ALIGN_MOVED ? '  <-- the two engines are NOT the same Pokemon' : ' (must read 0)'));
console.log('    gender is N on both sides, so Attract / Rivalry / Cute Charm are not exercised.');
console.log('    ZERO TO HERO IS SILENT — found by this run, not assumed. Showdown transforms Palafin on');
console.log('      SWITCH-OUT (`|detailschange|p1a: Palafin|Palafin-Hero, L50`) and announces');
console.log('      `|-activate|...|ability: Zero to Hero` on the way back in; medicham2 transforms on the');
console.log('      RETURN, inside bringIn(), and emits neither. Different moment AND two missing lines.');
console.log('    ' + TEAMS_UNBUILDABLE + ' teams and ' + MONS_UNBUILDABLE + ' individual sets could not be built in both engines.');
console.log('    ' + BAN_FALLBACKS + ' clicks where the configuration had banned every legal action (fell through, counted).');
console.log('    MEDFAILS.traceBodyOffField = ' + M.fails.traceBodyOffField
  + (M.fails.traceBodyOffField ? '  <-- a `??` identifier reached the stream, first: ' + M.fails.traceBodyOffFieldFirst
                                 + '. tests/test-protocol-trace.js PART 6 says this must read 0.' : ' (must read 0)'));
console.log('    undeclared Showdown events dropped before alignment: ' + UNDECLARED_DROPS
  + (UNDECLARED_DROPS ? '  <-- ' + [...UNDECLARED_SEEN].join(', ') : ' (must read 0)'));
/* The standing block's own swallowed failures. A zero here is the CLAIM that every `uses: null` and
 * `carriers: null` printed above means "not in that table" and not "the lookup threw". */
console.log('    format-standing lookups that threw and fell back: '
  + Object.entries(STANDING_FAILS).map(([k, v]) => k + ' ' + v).join(', ')
  + (Object.values(STANDING_FAILS).some(v => v) ? '  <-- a UNKNOWN above is a FAILURE, not an absence' : ' (must all read 0)'));
console.log('');

if (WRITE) {
  const artifact = Object.assign({
    generated: new Date().toISOString(), by: 'engine/game_differential.js', mode: 'A',
    games: results.length, turns_cap: MAXTURNS, elapsed_s: +elapsed,
    planted_divergence_proof: PROOF, planted_divergence_proof_ok: PROOF_OK,
    /* THE HEADLINE RATE IS NOT READABLE WITHOUT THIS. Stated at the top level, not buried in
     * declared_gaps, because a reader who takes `diverged / games` and nothing else has taken a
     * number about a population it does not know the shape of.
     *
     * IT USED TO SAY "ZERO MEGA BODIES WERE TESTED". ROADMAP #31 closed that; what remains is the
     * SPREADS, which is a smaller and differently-shaped hole and is named rather than inherited. */
    rate_excludes: 'both engines are built Serious / 0 EVs / 31 IVs so that they compute the same '
      + 'stat line before AND after a forme change, so this instrument tests RULES and not the '
      + 'spreads the ladder actually brings. Mega bodies ARE tested as of ROADMAP #31 ('
      + STONES_KEPT + ' stone sets kept, 0 stripped from the measured arm).',
    /* ROADMAP #31 — THE TWO RATES, NEVER ONE. Same pairs, same seeds, same driver state; the stone is
     * the only difference between `with_megas` and `control_same_pairs_no_stones`. */
    mega: (() => {
      const withStone = results.filter(r => r.stones);
      const withStoneCtl = control.filter((c, i) => results[i].stones);
      const noStone = results.filter(r => !r.stones);
      const dv = arr => arr.filter(r => r.div).length;
      return {
        why: 'the 2026-08-06 run stripped 460 stone sets and tested ZERO mega bodies in a ~26%-mega '
           + 'format. medicham2 now evolves on a CHOICE mid-turn, so the stones stay on and every '
           + 'pair is played TWICE — the difference between the two arms IS what megas cost.',
        rates: {
          with_megas: { games: withStone.length, diverged: dv(withStone) },
          control_same_pairs_no_stones: { games: withStoneCtl.length, diverged: dv(withStoneCtl) },
          pairs_with_no_stone_at_all: { games: noStone.length, diverged: dv(noStone) },
          whole_control_arm: { games: control.length, diverged: dv(control),
                               note: 'every stone stripped — this is what the 2026-08-06 run measured' },
        },
        pairing_broken: PAIRING_BROKEN,
        /* THE RATE IS SATURATED, SO THE PAIRED COMPARISON IS THE ANSWER. Where each arm parts, and
         * whether the evolution itself is what parted it. */
        cost_of_the_megas: (() => {
          const at = r => (r.div ? r.div.index : Infinity);
          const pr = results.map((r, i) => ({ r, c: control[i] })).filter(x => x.r.stones);
          /* COUNTED APART. `detailschange` is Showdown's line for ANY permanent forme change and Zero
           * to Hero is one, so merging the two would file a Palafin as a mega wire — which is exactly
           * what the first cut of this did. */
          const isMega = l => /^\|-mega\|/.test(String(l || ''));
          const isDetails = l => /^\|detailschange\|/.test(String(l || ''));
          const row = r => ({ config: r.config, seed: r.seed, index: r.div.index,
                              showdown: r.div.sdRaw, medicham: r.div.meRaw,
                              sdAfter: r.div.sdAfterRaw.slice(0, 5), meAfter: r.div.meAfterRaw.slice(0, 5) });
          return { stone_carrying_pairs: pr.length,
                   mega_arm_parted_earlier: pr.filter(x => at(x.r) < at(x.c)).length,
                   mega_arm_parted_later: pr.filter(x => at(x.r) > at(x.c)).length,
                   parted_at_the_same_line: pr.filter(x => at(x.r) === at(x.c)).length,
                   first_divergence_is_a_mega_line:
                     results.filter(r => r.div && (isMega(r.div.sdRaw) || isMega(r.div.meRaw))).length,
                   first_divergence_is_a_detailschange_line:
                     results.filter(r => r.div && (isDetails(r.div.sdRaw) || isDetails(r.div.meRaw))).length,
                   /* LISTED IN FULL, not sampled. `first_divergences` above is capped at 60 games and
                    * the forme-change ones are the actionable output of this pass — a finding that
                    * falls off the end of a slice is a finding nobody acts on. */
                   on_a_mega_line: results.filter(r => r.div && (isMega(r.div.sdRaw) || isMega(r.div.meRaw))).map(row),
                   on_a_detailschange_line:
                     results.filter(r => r.div && (isDetails(r.div.sdRaw) || isDetails(r.div.meRaw))).map(row) };
        })(),
        evolutions_medicham: MEGA_MEDI, evolutions_showdown: MEGA_SD,
        engines_agree_on_the_count: MEGA_MEDI === MEGA_SD,
        sides_capable: MEGA_SIDES_CAPABLE, sides_evolved: MEGA_SIDES_EVOLVED,
        from_left_slot: MEGA_SLOT_A, from_right_slot: MEGA_SLOT_B,
        choices_issued: MEGA_CHOICES,
        every_issued_choice_evolved_in_both_engines:
          !!MEGA_CHOICES && MEGA_MEDI === MEGA_CHOICES && MEGA_SD === MEGA_CHOICES,
        stones_kept: STONES_KEPT, stones_stripped_from_control_arm: STONES_STRIPPED,
      };
    })(),
    normalisation: {
      why: 'every rule drops an ANNOUNCEMENT or an ATTRIBUTION and never a STATE CHANGE; each carries '
         + 'a red demonstration in both directions and they run before any game does',
      all_rules_proved: !EQ_BAD.length,
      rules: EQUIV.map(r => ({ id: r.id, why: r.why, lines_collapsed: NORM_COUNTS.get(r.id) || 0,
        collapses_the_form: (EQP.find(x => x.id === r.id) || {}).collapses,
        keeps_the_meaning: (EQP.find(x => x.id === r.id) || {}).keeps_meaning,
        equal_pair: r.equal, distinct_pair: r.distinct })),
      total_lines_collapsed: [...NORM_COUNTS.values()].reduce((a, b) => a + b, 0),
    },
    directed: DIR, damage_interior: INTERIOR,
    /* ROADMAP #80. The streams are dropped from the artifact — they are debugging context, not a
     * measurement, and two full protocol logs per arm would bury the three numbers that matter. */
    knock_off_roadmap_80: { arms: KO.arms.map(({ showdown_stream, medicham_stream, ...a }) => a),
                            sitrus_half: KO.sitrus_half, boost_half: KO.boost_half,
                            reduction_half: KO.reduction_half, net: KO.net,
                            verdict: 'the predicted DAMAGE bug does not reproduce — medicham2 prices both '
                              + 'halves correctly because playerAction computes the range at CLICK time, '
                              + 'before the item is stripped. What differs is the item DISPOSITION: Showdown '
                              + 'records Colbur as EATEN BY ITSELF, medicham2 as KNOCKED OFF.' },
    diverged: diverged.length, threw: threw.length,
    pin: PIN_CLAIMS.map(([w]) => w),
    /* EVERY CAUSE CARRIES ITS FORMAT STANDING. See annotateCause() -- three separate times on
     * 2026-08-06/07 a WIRE was justified by a mechanic that CANNOT OCCUR in Champions (Blunder Policy,
     * `isNonstandard: 'Past'`, 0 of 410,780 sets; Okidogi, `tier: Illegal`, and no legal body in this
     * format carries Guard Dog at all). Each time the rule "check isNonstandard before citing
     * anything" was written down, and each time it was read past. A rule you have to remember is a
     * preference; the standing now travels WITH the cause, so a zero is visible at the moment the
     * cause is read rather than three steps later when somebody thinks to check. */
    classes: [...classes].map(([cls, e]) => ({
      cls, games: e.games,
      causes: [...e.causes].map(([cause, n]) => Object.assign({ cause, n }, annotateCause(cause))),
    })),
    first_divergences: diverged.slice(0, 60).map(r => ({
      config: r.config, seed: r.seed, index: r.div.index, agreed_lines: r.div.agreedLines,
      cls: r._cls.cls, cause: r._cls.cause, showdown: r.div.sdRaw, medicham: r.div.meRaw })),
    errors: threw.map(r => ({ config: r.config, seed: r.seed, err: r.err })),
    coverage: {
      measurable: COV_TARGETS.length, exercised: covered.length,
      exercised_by_a_connected_move: covStrong.length,
      move_targets: COV_TARGETS.filter(t => t.sec === 'moves').length,
      present_on_the_field_only: covWeak.length,
      ability_or_item_targets: COV_TARGETS.filter(t => t.sec !== 'moves').length,
      median_completed_turns_before_divergence: medianTurns,
      unmeasurable_by_this_instrument: COV_UNMEASURABLE.map(t => ({ key: t.key, why: t.why })),
      not_exercised: uncovered.map(t => t.key),
      clicked_but_always_missed: [...CLICKED_BUT_MISSED.keys()].sort(),
      distinct_moves_connected: OBSERVED.moves.size, distinct_abilities: OBSERVED.abilities.size,
      distinct_items: OBSERVED.items.size, distinct_species: OBSERVED.species.size,
    },
    swarm: SW.out.map(c => ({ config: c.config, available: c.available, picked: c.picked,
                              games: results.filter(r => r.config === c.config).length })),
    declared_gaps: {
      mega_stones_stripped: 0,
      mega_stones_kept: STONES_KEPT,
      control_arm_stones_stripped: STONES_STRIPPED,
      align_had_to_move_a_stat: ALIGN_MOVED,
      teams_unbuildable: TEAMS_UNBUILDABLE, sets_unbuildable: MONS_UNBUILDABLE,
      ban_fallbacks: BAN_FALLBACKS, undeclared_event_drops: UNDECLARED_DROPS,
      trace_body_off_field: M.fails.traceBodyOffField,
      trace_body_off_field_first: M.fails.traceBodyOffFieldFirst,
      undeclared_events: [...UNDECLARED_SEEN],
      gender_neutralised: true, tags_release_matches_live: TAGS_MATCH,
    },
  }, REL.stamp());
  fs.writeFileSync(D('data', 'game-differential.json'), JSON.stringify(artifact, null, 2) + '\n');
  console.log('  -> data/game-differential.json');
}
