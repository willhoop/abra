/* quarantine.js — EVERYTHING DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS CORRECT.
 *
 *   node engine/quarantine.js            print the gate, the failing clauses and the withheld set
 *   node engine/quarantine.js --graph    print the derivation: why each artifact is in or out
 *   node engine/quarantine.js --check    GATE — fails if a quarantined figure is being printed
 *   node engine/quarantine.js --selftest drive every branch on synthetic input, red and green
 *   node engine/quarantine.js --whole-game  BOARD-MATERIAL games — the gating whole-game clause
 *   node engine/quarantine.js --narration   PROTOCOL first-divergence games — reports, does not gate
 *   node engine/quarantine.js --order-probe the move-vs-move turn-order floor
 *
 * THE TWO WHOLE-GAME COMMANDS ANSWER TWO DIFFERENT QUESTIONS AND NEITHER IS "THE" DIVERGENCE RATE.
 * Will's call, 2026-08-22: *"board-material now, narration as its own separate gate afterwards."*
 * `--whole-game` counts games whose BOARDS part (`state.games` less
 * `state.games_board_never_diverged`) and decides the gate. `--narration` counts games whose
 * PROTOCOL LINES part (`j.diverged`, less what is declared and cleared) and decides nothing. On
 * release `8ad06030e129` they read 77 of 961 and 167 of 961 — the same run, two quantities. Quote
 * one without its name and somebody spends an afternoon reconciling it; ROADMAP #387 is that
 * afternoon already spent once.
 *
 * WHY THIS EXISTS
 * ---------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * CLAUDE.md states the rule. This file is the mechanism, because this repository's whole history says
 * a rule that exists only in prose is a preference: the fourteen stale handoffs, the hand-maintained
 * ban list of four, the auto-commit paragraph kept twelve days past the thing it described.
 *
 * A CAPTION IS NOT A QUARANTINE, AND THAT IS THE SPECIFIC BUG THIS CLOSES.
 * `status.js` has printed `PRE-CHANGE — measured against a different build of: ...` and
 * `[engine moved since; transfer assumed, not measured]` beside these numbers for days, and the
 * numbers went on being quoted anyway — including to Will, by the session that wrote the caption. It
 * is the identical failure to a red gate reported for two days as "one of the two known failures":
 * the figure is rendered, the warning is skimmed, the figure gets used. So the figure is WITHHELD.
 * Printing it with a caveat IS the bug, and a reader who wants it can run the generator.
 *
 * THE GATE IS READ, NOT REMEMBERED. It lifts on a measured condition and on nothing else. There is
 * deliberately no flag anybody can set by hand: a field that can silence a gate eventually silences
 * it wrongly, which is why `provenance.js`'s `void` is one-way and has no `valid: true` counterpart.
 *
 * A MISSING STAGE IS A FAILING CLAUSE. The deliberate roster has three stages that matter and only
 * one has ever produced an artifact. Absence must never read as success — that is the single failure
 * mode CLAUDE.md says this project actually has ("a capability was absent, and everything reported
 * success"), and reading two-out-of-three as a pass would reproduce it inside the guard written to
 * stop it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
/* THE ONE REFUSAL FOR "WHAT WAS THIS MEASURED UNDER" — 2026-09-04. Five clauses in this file each
 * carried their own copy of *"this refuses a MISMATCH, not an absence"*, so five of them read an
 * artifact that declared NOTHING as agreement. See engine/pin_guard.js for the receipt. */
const PIN = require('./pin_guard.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
/* ROADMAP #258 — UNREADABLE IS NOT ABSENT, AND HERE THE DIFFERENCE DECIDES A GATE. Every clause below
 * reads its evidence through this function, and a null means "NO ARTIFACT — run the instrument". A
 * corrupt or half-written file therefore produced the same verdict as a file nobody has generated,
 * which is a wrong diagnosis handed to the gate that decides whether MEDICHAM is correct. ENOENT is
 * genuinely absent and stays quiet; anything else says so on stderr. */
const readJson = p => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    /* ONLY FOR A .json PATH, AND THE FIRST DRAFT GOT THIS WRONG IN THE DIRECTION THAT MATTERS. This
     * helper is also pointed at `.js` BUNDLES (data/mag.js, data/mew.js, data/scoreboard.js) to ask
     * cheaply whether they happen to be JSON; those never parse, by design, and reporting them
     * printed six lines of pure noise on a clean run. A ratchet that flags code for doing what it
     * asked is how a ratchet gets ignored — the fourth correction of that shape in this repository.
     * (That third bundle read `web/scoreboard.js` for 13 days — written 2026-08-14 in f545e35c,
     * corrected 2026-08-27. It is `data/scoreboard.js`, which is the bundle the withheld-set clause
     * below names; there is no web/scoreboard.js and there never has been. A one-word slip that
     * still pointed
     * a reader at a file that does not exist.) */
    if (e.code !== 'ENOENT' && /\.json$/i.test(p)) console.error(`  ${path.basename(p)} EXISTS AND `
      + 'COULD NOT BE READ (' + e.message + ') — the clause reading it will report NO ARTIFACT, '
      + 'which is not what happened.');
    return null;
  }
};

/* ================================================================================================
 * 1. THE GATE — is MEDICHAM correct?
 * ================================================================================================
 * Two conditions, both read out of artifacts that MEASURE the simulator rather than consume it:
 *
 *   the game differential shows no disagreements with Showdown, and
 *   the deliberate roster shows no FIRED-AND-BOARDS-DIFFER and no DID-NOT-FIRE across the items,
 *   abilities and moves stages.
 *
 * Each clause reports its MAGNITUDE, not a boolean. "false" tells a reader nothing about how far away
 * the lift is, and a gate whose distance cannot be seen is a gate that gets argued with.
 */

/* SWALLOWED READS ARE COUNTED, NOT SILENT. Every `catch` in this file guards a read that is allowed
 * to be absent — an optional directory, an artifact not written yet, a stamp helper that may not
 * exist. A bare `catch (e) {}` is the right CONTROL FLOW and the wrong REPORTING: it is exactly the
 * shape CLAUDE.md opens on, "a capability was absent and everything reported success". So each one
 * records where it fired, and `--check` prints the tally. If this gate ever goes quiet because it
 * could not read the thing it polices, the count says so instead of the gate reading clean.
 * `tests/test-no-silent-failure.js` found all eleven the day they were written. */
const SWALLOWED = [];
const why = e => (e && e.message) || String(e);

/* THE THREE STAGES THAT THE RULE NAMES. `tests/roster.js --stage` also accepts `spine` (its own
 * selftest) and `pairs`; neither is part of the condition, so neither is read here. */
const ROSTER_STAGES = ['items', 'abilities', 'moves'];

/* ================================================================================================
 * THE BAR IS DECISION-EQUIVALENCE, NOT PROTOCOL-EQUALITY — WILL, 2026-08-18
 * ================================================================================================
 * *"medicham needs to be good enough that when miltank uses it, it wouldnt affect any decisions"*,
 * and the worked example: *"so like if trick or treat isnt working, that doesnt matter because no one
 * uses gorgeist."*
 *
 * That is a strictly better bar than the one two of these clauses were asking for, and it is not a
 * relaxation of "if its not correct then it shouldnt pass". It is a different question. The mechanics
 * clause counted every diverging entity whether or not anybody plays it; the whole-game clause
 * demanded literal zero over a unit — the GAME — that nothing was allowed to filter. Both were asking
 * for something that cannot be delivered, which is what made the open-defect clause endless until it
 * started counting evidence instead of sentences.
 *
 * TWO FILTERS, ON TWO AXES, AND NEITHER IS "THIS IS HARD":
 *
 *   REACH           — nobody plays it, so a fix cannot move a decision that never comes up.
 *   DECISION IMPACT — people play it, and a paired argmax run says fixing it does not change the
 *                     click.
 *
 * A THIRD THING ALREADY EXISTS AND MUST NOT BECOME A DUMPING GROUND: `DECLARED_DIVERGENCE`, for the
 * case where matching the authority would make this engine LESS correct. That bar is narrower than
 * either of these and it is unchanged. `medicham2-browser.js:17440` is the receipt: a declaration
 * whose stated reason was COST — *"a far larger change than this wire is buying"* — hid the largest
 * real defect in the engine, spread accuracy rolled once per move where Showdown rolls it per target,
 * so Rock Slide (18,122 clicks) and Heat Wave (11,121) could never hit one body and miss the other.
 * At 90 accuracy the exactly-one case is 18% of outcomes and it did not exist here at all. **That one
 * would have cleared a reach filter without breaking stride, which is precisely why reach may never be
 * the only filter and why neither filter may ever be reached by a cost argument.**
 * ================================================================================================ */

/* ---- FILTER 1: REACH -----------------------------------------------------------------------------
 *
 * THE THRESHOLD IS THE PROJECT'S, NOT A NEW ONE. `tests/roster.js` shelves a move below 25 real
 * clicks (`USAGE_SHELF_BELOW`, Will's call on 2026-08-10: *"if no one clicks them we can just put them
 * on the to do list at some point but not holding back medicham from functioning"*), and the coverage
 * clause below reads the same 25. Inventing a second number here would be the two-implementations-of-
 * one-fact failure CLAUDE.md forbids, so this constant is the coverage clause's as well — it used to
 * carry its own literal and no longer does.
 *
 * TWO LITERALS DO STILL EXIST IN THE REPOSITORY AND THAT IS STATED RATHER THAN HIDDEN.
 * `tests/roster.js` does not export `USAGE_SHELF_BELOW` (it exports `DEFERRED` only) and belongs to
 * another division, so this file cannot import it. `reachDrift()` reads the roster ARTIFACT's own
 * shelved rows, which state their threshold in prose, and reports a mismatch on every run. Reported,
 * not gated: failing a gate on a regex over prose is how a gate becomes something people argue with.
 *
 * THE UNIT IS WHATEVER THE STORE CAN ACTUALLY OBSERVE FOR THAT KIND, AND THE TWO ARE NOT
 * INTERCHANGEABLE:
 *   moves            CLICKS,  from `engine/click_counts.js` over both human stores (64,846 games).
 *   abilities/items  TEAMS,   from `engine/sheet_usage.js` over declared open sheets (13,116 games,
 *                             26,232 teams) — *"The first honest store-derived ability usage this
 *                             project has had."*
 * `tests/roster.js`'s header says no honest store-derived ability usage exists and that was true when
 * it was written on 2026-08-10; `data/sheet-usage.json` was generated on 2026-08-11.
 *
 * ROADMAP #295 — THE SHELF WAS ONE INTEGER COMPARED AGAINST TWO POPULATIONS, AND THAT IS TWO
 * THRESHOLDS WEARING ONE NUMBER. Until 2026-08-18 the literal 25 was compared to CLICKS (denominator
 * 1,259,717 clicks over 64,846 games) and to TEAMS (denominator 26,232 teams over 13,116 games). The
 * same integer therefore meant **0.095% of teams** or **0.0020% of clicks**: a move cleared the bar at
 * roughly **48x lower relative usage** than an ability. Nobody decided that. It fell out of two usage
 * artifacts having different denominators, and it was invisible because both printed as a bare integer
 * beside a name. Every one of this repository's expensive bugs has that shape — a value that looks
 * authoritative because nothing next to it states what it is a value OF.
 *
 * THE FIX IS NOT A RETUNE. Will, 2026-08-18: *"leave it at 25"*, said after being shown that raising
 * it to 100 moves 14 tail rows and touches none of the five holding the clause shut. So the 25 stays
 * exactly where it was ruled, in the unit it was ruled in, and the OTHER population's threshold is
 * derived from it rather than assumed equal to it.
 *
 *   THE ANCHOR      25 CLICKS. That is where the number comes from and what it has always meant:
 *                   `tests/roster.js:1517` `const USAGE_SHELF_BELOW = 25`, applied at :1522 as
 *                   `clicks >= USAGE_SHELF_BELOW`. A clicks threshold, ruled on as a clicks threshold.
 *   THE COMMON UNIT OCCURRENCES PER STORED GAME. Both instruments can express it and neither has to
 *                   be reinterpreted to get there: a move's rate is `clicks / click-counts.store_games`
 *                   (64,846), an ability's is `teams / sheet-usage.sheet_games` (13,116). "How often
 *                   does this come up in a game" is the reach question stated exactly.
 *   THE DERIVED     TEAMS shelf = 25 x 13,116 / 64,846 = **5.06 teams**, so 6 teams is the smallest
 *                   counting observation. Nothing is typed: both denominators are read off the
 *                   artifacts, and the comparison is integer cross-multiplication so no float
 *                   boundary can move a row.
 *
 * WHAT THIS MOVED ON THE DAY IT LANDED: NOTHING, AND THAT IS THE TEST IT HAD TO PASS. 34 counted and
 * 15 shelved before, 34 counted and 15 shelved after. It reproduces because no diverging ability sits
 * between 6 and 24 teams — the lowest counted one is `angerpoint` at 25 teams — and every shelved row
 * is a move, decided by the unchanged anchor. **A RE-UNITISED THRESHOLD IS STILL A NEW THRESHOLD** and
 * the equality is a measured coincidence of today's population, not a property of the change: an
 * ability diverging at 6-24 teams used to be shelved and now COUNTS. That is the direction the defect
 * demanded — abilities were being held to a 48x stricter bar than moves — and it is stated here rather
 * than discovered later by whoever wonders why a row appeared.
 *
 * ANCHORING THE OTHER WAY DOES NOT REPRODUCE, WHICH IS WHY THE ANCHOR IS NAMED AND NOT ASSUMED. Take
 * the ability figure as the anchor instead (25 teams = 1.906 per thousand games) and the move shelf
 * becomes 124 clicks, shelving twelve currently-counted moves from `ficklebeam` (112) down to
 * `attract` (30). Same "fix", opposite result. The anchor is a decision with an owner and it is
 * recorded above.
 *
 * THE DENOMINATOR IS PRINTED BESIDE EVERY ROW, not once in a header. That is the actual defect being
 * closed: a bare integer beside a name cannot carry its unit, and a reader who scrolls past one header
 * line has no way back to it.
 *
 * `tags.json.uses` IS NOT AN AUTHORITY AND USING IT HERE WOULD HAVE BEEN A REAL ERROR. Measured
 * 2026-08-18 on the nine entities a briefing named as unplayed: `tags.json` reads bittermalice 0
 * against **519 real clicks**, attract 2 against **30**, belch 0 against 2, snore 0 against 3. A reach
 * filter run off that file would have shelved a 519-click move as unused. ROADMAP #70, landing on a
 * live decision for the second time.
 *
 * UNKNOWN IS NOT ZERO, AND THIS IS THE HALF THAT DECIDES WHETHER THE FILTER IS HONEST. An entity the
 * usage instrument STRUCTURALLY CANNOT SEE is not below the shelf; it is unmeasured, it counts, and it
 * is named separately. `data/sheet-usage.json` declares that set itself — a team sheet reveals the
 * PRE-MEGA ability, so an ability that exists only on a mega forme can never appear in it, and the
 * artifact carries the list. Absence from an instrument that DOES cover the whole class (every move
 * click in every stored game) is an observed zero and is a different thing. If the usage artifact for
 * a kind is missing altogether, every row of that kind is UNKNOWN and the filter shelves nothing —
 * a shelf that opens when its evidence disappears is not a shelf. */

/* THE ANCHOR, AND ITS UNIT IN THE NAME so no caller can compare it to something else by accident.
 * `_CLICKS` is not decoration: the previous name was `REACH_SHELF`, and a name with no unit in it is
 * exactly how one integer came to be compared against two populations. */
const REACH_SHELF_CLICKS = 25;

/* A THIRD USE OF THE SAME INTEGER, IN A THIRD UNIT, DECLARED RATHER THAN SHARED. `decisionImpact`
 * needs a minimum number of PAIRED DECISION POINTS before a 0-flip row may excuse anything. That is a
 * sample-size floor, not a usage rate, and it must NOT track the clicks anchor if the clicks anchor
 * ever moves. It is the same 25 for the reason the header gives — 25 observations is this project's
 * standing bar for "there is something here to look at" — and it says so on its own line. */
const DECISION_POINTS_FLOOR = 25;
const nid = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SINGULAR = { moves: 'move', abilities: 'ability', items: 'item' };

function usageIndex() {
  const clicks = readJson(D('data', 'click-counts.json'));
  const sheets = readJson(D('data', 'sheet-usage.json'));
  const idx = (o) => { const m = new Map(); for (const [k, v] of Object.entries(o || {})) m.set(nid(k), v); return m; };
  const teams = (o) => { const m = new Map(); for (const [k, v] of Object.entries(o || {})) m.set(nid(k), (v && v.teams) || 0); return m; };
  const denomTeams = (() => {
    /* DERIVED FROM THE ARTIFACT'S OWN NUMBERS rather than typed: any row carries teams and per_team,
     * and their ratio is the denominator. Typing 26,232 here would be a figure with no source. */
    for (const v of Object.values((sheets && sheets.abilities) || {})) {
      if (v && v.teams > 0 && v.per_team > 0) return Math.round(v.teams / v.per_team * 100);
    }
    return null;
  })();
  return {
    moves: clicks ? idx(clicks.moves) : null,
    abilities: sheets ? teams(sheets.abilities) : null,
    items: sheets ? teams(sheets.items) : null,
    invisible: new Set(((sheets && sheets.not_countable) || []).map(nid)),
    invisible_why: (sheets && sheets.not_countable_note) || null,
    denominators: {
      moves: clicks ? `${(clicks.store_games || 0).toLocaleString()} stored games, `
                    + `${(clicks.total_clicks || 0).toLocaleString()} clicks` : null,
      teams: sheets ? `${(denomTeams || 0).toLocaleString()} teams from `
                    + `${(sheets.sheet_games || 0).toLocaleString()} open-sheet games` : null,
    },
    /* THE RATE DENOMINATORS, NUMERIC AND IN ONE UNIT — GAMES. ROADMAP #295. The strings above are for
     * a human; these are what the shelf is actually computed from, and they are the only pair in this
     * file that may be divided into each other. Both are read off the artifacts. A missing or
     * non-finite figure is `null` and the shelf for that kind then shelves NOTHING rather than
     * silently falling back to the anchor's integer — which is the defect. */
    games: {
      moves: clicks && Number.isFinite(clicks.store_games) && clicks.store_games > 0 ? clicks.store_games : null,
      teams: sheets && Number.isFinite(sheets.sheet_games) && sheets.sheet_games > 0 ? sheets.sheet_games : null,
    },
    gamesLabel: {
      moves: clicks && clicks.store_games ? `${clicks.store_games.toLocaleString()} stored games` : null,
      teams: sheets && sheets.sheet_games ? `${sheets.sheet_games.toLocaleString()} open-sheet games` : null,
    },
    absent: [clicks ? null : 'data/click-counts.json (engine/click_counts.js)',
             sheets ? null : 'data/sheet-usage.json (engine/sheet_usage.js)'].filter(Boolean),
  };
}

/* Returns `{ known, n, unit, denom, denomLabel, why }`. `known: false` means UNKNOWN and never means
 * zero. `denom` and `denomLabel` travel WITH the count so that no consumer can print the number
 * without its population — ROADMAP #295. */
function reachOf(U, kind, id) {
  const k = nid(id);
  const unit = kind === 'moves' ? 'clicks' : 'teams';
  const pop = kind === 'moves' ? 'moves' : 'teams';
  const denom = (U.games && U.games[pop]) || null;
  const denomLabel = (U.gamesLabel && U.gamesLabel[pop]) || (denom ? denom.toLocaleString() + ' games' : 'NO DENOMINATOR');
  const map = U[kind];
  if (!map) {
    return { known: false, n: null, unit, denom, denomLabel, why: 'NO USAGE INSTRUMENT for ' + kind
      + ' — ' + (U.absent.join(', ') || 'the artifact is absent') + '. Unknown is not zero.' };
  }
  if (kind !== 'moves' && U.invisible.has(k)) {
    return { known: false, n: null, unit, denom, denomLabel, why: 'INVISIBLE TO THE INSTRUMENT — data/sheet-usage.json '
      + 'declares this one not countable (a team sheet shows the PRE-MEGA ability). Unknown is not zero.' };
  }
  const n = map.has(k) ? map.get(k) : 0;
  return { known: true, n, unit, denom, denomLabel,
    per10k: denom ? n * 10000 / denom : null,
    why: n + ' ' + unit + ' in ' + denomLabel
       + ' (' + (U.denominators[pop] || '?') + ')' };
}

/* THE SHELF ITSELF — ONE ANCHOR, ONE RATE, A THRESHOLD PER POPULATION. ROADMAP #295.
 *
 * `below(kind, n)` is the ONLY place a usage count is compared to a threshold. Three properties it
 * has deliberately:
 *
 *   1. THE COMPARISON IS INTEGER CROSS-MULTIPLICATION, `n * AD < ANCHOR * denom`, never a float
 *      threshold. `25 * 13116 / 64846 = 5.0566...` has no exact double, and a row is not going to be
 *      decided by which side of a rounding error it lands on. For moves this reduces to `n < 25`
 *      exactly, so the anchor is preserved bit-for-bit rather than approximately.
 *   2. STRICTLY BELOW SHELVES, exactly as `tests/roster.js:1522`'s `clicks >= USAGE_SHELF_BELOW` does.
 *      An ability sits at exactly 25 teams in today's artifact; a `<=` here would excuse a live row.
 *   3. AN UNDERIVABLE SHELF SHELVES NOTHING. If either denominator is absent the threshold is not
 *      computable, and the answer is that everything of that kind COUNTS — never that everything falls
 *      back to the bare integer, which is the defect this function exists to remove. A shelf that
 *      opens when its evidence disappears is not a shelf; a shelf that quietly changes unit when its
 *      evidence disappears is worse, because it still prints a number. */
function reachShelf(U) {
  const AD = (U.games && U.games.moves) || null;          /* the anchor's own denominator, in games */
  const of = (kind) => {
    const pop = kind === 'moves' ? 'moves' : 'teams';
    const unit = kind === 'moves' ? 'clicks' : 'teams';
    const denom = (U.games && U.games[pop]) || null;
    const denomLabel = (U.gamesLabel && U.gamesLabel[pop]) || null;
    if (!AD || !denom) {
      return { kind, unit, denom, denomLabel, derivable: false, exact: null, minCount: null,
        why: 'NOT DERIVABLE — ' + (!AD ? 'the anchor population (data/click-counts.json store_games) '
          : 'this population (data/sheet-usage.json sheet_games) ') + 'is absent, so no threshold in '
          + unit + ' can be derived from ' + REACH_SHELF_CLICKS + ' clicks. NOTHING of this kind is '
          + 'shelved; every row counts.' };
    }
    const exact = REACH_SHELF_CLICKS * denom / AD;
    return { kind, unit, denom, denomLabel, derivable: true, exact, minCount: Math.ceil(exact),
      why: REACH_SHELF_CLICKS + ' clicks in ' + AD.toLocaleString() + ' games = '
         + exact.toFixed(2) + ' ' + unit + ' in ' + denom.toLocaleString() + ' games; smallest counting '
         + 'observation is ' + Math.ceil(exact) + ' ' + unit };
  };
  const below = (kind, n) => {
    const s = of(kind);
    if (!s.derivable) return false;
    return n * AD < REACH_SHELF_CLICKS * s.denom;
  };
  const rate10k = AD ? REACH_SHELF_CLICKS * 10000 / AD : null;
  return { anchor: { n: REACH_SHELF_CLICKS, unit: 'clicks', denom: AD, kind: 'moves' },
           rate10k, of, below };
}

/* THE ROSTER'S OWN SHELF, READ BACK OFF ITS ARTIFACT so the two numbers cannot drift in silence.
 * Reported by the clause, never gated on — see the header above. */
function reachDrift() {
  const rm = readJson(D('data', 'roster.moves.json'));
  const rows = (rm && (rm.results || rm.rows || rm.entries)) || [];
  for (const r of rows) {
    const m = /under the shelf of (\d+)/.exec(String((r && r.why) || ''));
    /* THE ROSTER'S SHELF IS A CLICKS SHELF, so it is compared to the CLICKS ANCHOR and to nothing
     * else. Comparing it to the derived teams threshold would be the #295 defect in reverse. */
    if (m) return +m[1] === REACH_SHELF_CLICKS ? null
      : `tests/roster.js shelves a move below ${m[1]} clicks and this clause anchors at `
      + `${REACH_SHELF_CLICKS} clicks — two thresholds for one decision. Neither file can import the `
      + `other's constant; say which is right.`;
  }
  return null;
}

/* ---- FILTER 2: DECISION IMPACT -------------------------------------------------------------------
 *
 * For a mechanic that people DO play, the question is Will's exactly: would fixing it change what
 * MILTANK clicks. That is not a thing a clause can decide by reading a divergence count, and it is not
 * a thing this file may guess at. It is a MEASUREMENT, the instrument exists, and this is the wire to
 * it rather than a second copy of it.
 *
 * `engine/argmax_paired.js` (ROADMAP #278) scores the same decision points twice under two arms with
 * common random numbers keyed on CANDIDATE IDENTITY rather than index, and reports the ARGMAX FLIP
 * RATE. It carries three zero-controls, one of which — identical dice — is asserted to be exactly 0
 * flips and exactly 0 value gap, so its null is demonstrated rather than assumed.
 *
 * WHAT THIS FUNCTION IS: a CONTRACT, and a refusal by default. It reads `data/decision-impact.json`
 * and clears a row only when every one of these holds:
 *
 *   1. the artifact exists;
 *   2. `null_demonstrated: true` — the identical-dice control reported exactly 0 flips in that run.
 *      Same discipline as the whole-game clause's planted-divergence proof: an instrument that cannot
 *      reproduce itself says nothing about the rows it did not plant;
 *   3. `engine_release` equals the tree's current release. An artifact cut against other bytes is not
 *      a weaker answer to this question, it is an answer to a different one;
 *   4. the row itself reports `flips: 0` over `paired >= 25` decision points AT WHICH THE MECHANIC WAS
 *      IN PLAY, and names the arm the fix landed in.
 *
 * WHY 25 AGAIN, AND WHY IT IS ITS OWN CONSTANT RATHER THAN THE REACH SHELF. It is the same INTEGER
 * and a different UNIT: PAIRED DECISION POINTS, not clicks and not teams. 25 observations is this
 * project's standing bar for "there is something here to look at", so a claim that a mechanic changes
 * no decision should rest on at least as many. It was written as `REACH_SHELF` — one name for three
 * units — and ROADMAP #295 is what that costs, so it is now `DECISION_POINTS_FLOOR` and moves only
 * when somebody decides to move it. It is a FLOOR and a thin one —
 * 0 flips in 25 is a 95% upper bound of about 11% by the rule of three — so the bound is COMPUTED FROM
 * THE ROW'S OWN n AND PRINTED beside every row this clears. Nobody gets to read a cleared row as proof
 * that the flip rate is zero. Raising the floor is a decision with an owner; picking a second number
 * here would not be.
 *
 * NOTHING IS CLEARED TODAY. There is no `data/decision-impact.json` in this tree, and the clause says
 * so in the same sentence that reports the count — an exemption mechanism that is silent about being
 * empty is how "0 of 49 were cleared" and "we did not check" become the same line. */
function decisionImpact(curId) {
  const inert = (why) => ({ active: false, why, cleared: [], clear: () => null });
  const j = readJson(D('data', 'decision-impact.json'));
  if (!j) {
    return inert('NO DECISION-IMPACT RUN — data/decision-impact.json is absent, so nothing is excused '
      + 'on decision impact and every played divergence counts. It is written by a paired argmax run '
      + '(engine/argmax_paired.js, ROADMAP #278) with arms that differ by the FIX.');
  }
  if (j.null_demonstrated !== true) {
    return inert('THE DECISION-IMPACT RUN DID NOT DEMONSTRATE ITS NULL — data/decision-impact.json '
      + 'carries no `null_demonstrated: true`, so its identical-dice control did not report exactly 0 '
      + 'flips. An instrument that cannot reproduce itself excuses nothing. Nothing is cleared.');
  }
  const ranOn = j.engine_release || null;
  if (!ranOn || (curId && ranOn !== curId)) {
    return inert('THE DECISION-IMPACT RUN DESCRIBES OTHER BYTES — it ran on release '
      + (ranOn || '(unstamped)') + ' and the tree is ' + (curId || '(unknown)') + '. Nothing is cleared.');
  }
  const rows = Array.isArray(j.rows) ? j.rows : [];
  const cleared = [];
  const clear = (key) => {
    const row = rows.find((r) => {
      const rk = String((r && r.key) || '');
      if (/^cause:/.test(rk)) return /^cause:/.test(key) && key.slice(6).startsWith(rk.slice(6));
      return nid(rk) === nid(key);
    });
    if (!row) return null;
    const paired = +row.paired || 0, flips = +row.flips || 0;
    if (flips !== 0) return null;
    if (paired < DECISION_POINTS_FLOOR) return null;
    const bound = 100 * 3 / paired;          /* rule of three: the 95% upper bound on a zero numerator */
    const out = { key, paired, bound, fixed_in: row.fixed_in || '(arm unnamed)' };
    if (!cleared.some((c) => c.key === key)) cleared.push(out);
    return out;
  };
  return { active: true, cleared, clear, generated: j.generated || null,
    why: `${rows.length} decision-impact row(s) read from data/decision-impact.json (release ${ranOn}).` };
}

/* WHERE A STAGE'S ARTIFACT LIVES, AND WHY THIS TAKES THREE GUESSES RATHER THAN ONE.
 *
 * `tests/roster.js --write` writes `data/roster.json` unconditionally, whatever stage it ran, so the
 * file holds only the NEWEST stage and a second run destroys the first. Reading that one file and
 * calling it three stages would be the "capability absent, everything reports success" failure
 * exactly: two thirds of the condition would be silently satisfied by an artifact that never
 * described them.
 *
 * So a stage is satisfied only by an artifact whose OWN `stage` field names it. Three shapes count,
 * in the order tried:
 *   data/roster.<stage>.json   a per-stage artifact (what a stage-preserving writer would produce)
 *   data/roster.all.json       a `--stage all` run, which covers item, ability and move together
 *   data/roster.json           the shared file, and ONLY when its `stage` field matches
 * Anything else is MISSING, and MISSING FAILS. tests/roster.js is held by another division as this is
 * written, so the per-stage filename is a convention this reader accepts rather than one it imposes. */
/* ---- AND IT MUST REFUSE AN ARTIFACT CUT AGAINST OTHER BYTES (ROADMAP #316) ----------------------
 *
 * The three clauses above were the last ones in this file that would still answer off an artifact
 * older than the engine it describes, and on 2026-08-21 they were doing exactly that: PASS, PASS,
 * PASS, read out of files generated 2026-08-11 on release 96361d523e20 — while `tests/roster.js`
 * itself had been unable to run AT ALL since 2026-08-12, when a learnset clause landed in
 * `tests/staged_board.js` and refused every fixture the roster stages. Ten days of green on an
 * instrument that could not start.
 *
 * The whole-game clause (#298) and the order probe already refuse this, in these words: *"that is
 * not a weaker answer, it is an answer about other bytes."* There is no argument for the roster
 * being different — it is the SAME kind of claim about the SAME simulator.
 *
 * WITHHELD, NOT ANNOTATED. The counts are not returned and do not appear in the verdict string.
 * `PRE-CHANGE` was a caption beside a real number and the number was quoted for days; a figure that
 * is still in the sentence has not been withheld, whatever word sits in front of it.
 *
 * AND FIXING THE INSTRUMENT DOES NOT CLOSE THIS. The repair makes the roster runnable again; it does
 * nothing about the next ten days in which somebody forgets to re-run it. This is the half that
 * prevents the recurrence.
 *
 * `inject` drives THE SHIPPING FUNCTION from the selftest, the same injection point
 * `differentialClause` and `wholeGameClause` already take, so the rule cannot pass by having its
 * selftest restate it. */
function rosterStage(stage, inject) {
  const tried = [];
  const cur = readJson(D('data', 'engine-release.json'));
  const curId = cur && (cur.id || cur.release || cur.current);
  const files = inject !== undefined ? [inject.file || '(injected)']
                                     : [`roster.${stage}.json`, 'roster.all.json', 'roster.json'];
  for (const f of files) {
    tried.push('data/' + f);
    const j = inject !== undefined ? (inject.json || inject) : readJson(D('data', f));
    if (!j) continue;
    /* AN `all` ARTIFACT SATISFIES THE THREE STAGES THE RULE NAMES, AND NOTHING ELSE. Accepting
     * `stage: 'all'` for ANY requested name made this function answer for a stage that does not
     * exist — so the selftest's own "a MISSING stage must FAIL" probe started matching
     * data/roster.all.json the moment that file first landed, and went red. The probe was right and
     * the reader was wrong: `all` is a claim about items, abilities and moves, not a wildcard. This
     * is the one case the whole file turns on, so it is scoped to ROSTER_STAGES explicitly rather
     * than to "any truthy stage name". */
    if (j.stage !== stage && !(j.stage === 'all' && ROSTER_STAGES.includes(stage))) continue;
    /* THE RELEASE GUARD, BEFORE A SINGLE COUNT IS READ — see the header on this function. It sits
     * here rather than after the arithmetic so that nothing downstream can read a figure the clause
     * has decided it may not report.
     *
     * IT USED TO REFUSE A MISMATCH AND ALLOW AN ABSENCE, and it said so in as many words. That
     * sentence was copied into five clauses in this file, so five of them read an artifact that
     * declared NOTHING as agreement — the equivalence CLAUDE.md names as this repository's most
     * expensive failure mode. It now goes through engine/pin_guard.js, which refuses both, and asks
     * for `source_digests` as well: an id is a CLAIM about which bytes were read and the digest set
     * is the only thing provenance.js can check BY CONTENT. tests/roster.js opens a release and holds
     * the handle, so spreading `REL.stamp()` into its artifact is a one-line change. */
    {
      const r = PIN.guard({ name: `deliberate roster / ${stage}`, file: 'data/' + f, artifact: j,
        need: ['release', 'digests'], curId,
        rerun: `SHOWDOWN_PATH=... node tests/roster.js --stage ${stage} --write` });
      /* THE COUNT FIELDS ARE ABSENT FROM A WITHHELD VERDICT, not set to null — a reader doing
       * `r.differ ?? '?'` would print `?` either way, but `differ in r` is the difference between
       * "this clause reported no divergences" and "this clause reported nothing". The selftest
       * asserts it by name. */
      if (r) return Object.assign(r, { stage, file: 'data/' + f });
    }
    const c = j.counts || {};
    const differ = c['FIRED-AND-BOARDS-DIFFER'] || 0;
    const silent = c['DID-NOT-FIRE'] || 0;
    /* A RED THE ROSTER ITSELF DECLARES BAD counts too. `reds` carries the red demonstrations, each
     * with an `ok` flag; a red that did not behave as the rule predicted means the rule is not proven,
     * so the stage's greens are not evidence either. */
    const badReds = (j.reds || []).filter(r => r && r.ok === false).length;
    /* THE CLOSET DOES NOT HOLD THE GATE — BUT A STALE SHELF DOES. An entity the owner deferred by
     * name (tests/roster.js DEFERRED) is still staged and still played; it is simply not counted as a
     * failure. What IS counted is a deferral whose row would now pass on its own: that shelf has
     * quietly become a false claim, and the roster marks it `would_pass_now`. Same discipline as the
     * DECLARED staleness check, which once retracted its own author's declaration. */
    const deferred = (j.results || []).filter(r => r && r.verdict === 'DEFERRED-BY-OWNER');
    const staleShelf = deferred.filter(r => r.would_pass_now).length;
    /* ---- THE DENOMINATOR, AND THE ROWS THAT COUNT IN NEITHER COLUMN (ROADMAP #120, #121) --------
     *
     * THIS CLAUSE SAID "clean: 84 fired and matched" AND PASSED. It did not say of how many, and 84
     * of 316 is 26.6% while 84 of the 201 rows that HAVE a legal carrier in this format is 42%. It
     * also said nothing at all about fifteen CONTROL-NOT-QUIET rows sitting inside that green — rows
     * where the control arm was ANOTHER LIVE ABILITY, so the measurement is (subject minus a live
     * control) and names neither of them. Those are UNMEASURED, not passing.
     *
     * A bare PASS is the same failure this file was built to stop one level up: `status.js` printed
     * `PRE-CHANGE` beside a figure for days and the figure went on being quoted. A caption is not a
     * quarantine, and a verdict with no denominator is not a result.
     *
     * THE NUMBERS ARE READ OFF THE ARTIFACT'S OWN `scope` BLOCK, written by tests/roster.js at the
     * refusal, never re-derived here by matching prose. An artifact predating that block says
     * DENOMINATOR NOT CARRIED rather than defaulting to zero — a missing count must not read as
     * "none", which is the whole shape of the bug above.
     *
     * WHY UNATTRIBUTABLE ROWS ARE REPORTED AND DO NOT HOLD THE GATE. Four of them (Aroma Veil, Flower
     * Veil, Fluffy, Imposter) are untestable in this format by construction: their only legal carriers
     * have exactly one alternative ability, that alternative is live, and this format has 8 quiet
     * abilities of which none shares a species with them. A clause that can never open is not a gate.
     * They are named in the text on every run instead, so nobody has to go and look. If Will wants
     * them to fail, the flag is one `&&` on the line below. */
    const sc = j.scope || null;
    /* A ZERO IS A RESULT AND `|| null` EATS IT. An artifact that carries `results` can be counted
     * whatever its scope block says; only an artifact with no rows at all cannot answer. */
    const unattributable = sc ? sc.unattributable
      : (Array.isArray(j.results)
          ? j.results.filter(r => r && r.verdict === 'CONTROL-NOT-QUIET').length : null);
    /* WHAT IS NOT IN THE REGULATION IS NOT A DENOMINATOR. Will, 2026-08-11, reading this line on his
     * phone: *"Can we remove all the irrelevant numbers then and just have a quarantined closet
     * section. Like not legal in the regulation should be gone"*.
     *
     * This used to print `94 TESTED of 202 IN SCOPE, of 316 total (114 have NO LEGAL CARRIER in this
     * format — a fact about the regulation)`. The 316 and the 114 describe the National Dex, not the
     * game we play. Printing them next to the real ratio invites exactly the reading CLAUDE.md spends
     * a section forbidding — a number that looks authoritative because it sits beside one that is.
     * An entity no legal body can carry is not untested coverage; it does not exist here.
     *
     * The out-of-scope count is still CARRIED in the returned object (`scope`), so nothing that wants
     * it has lost it — it is dropped from the SENTENCE, not from the artifact. The deliberate
     * deferrals keep their own clause because those ARE in the regulation and someone chose to
     * shelve them, which is a different fact and belongs in the closet. */
    const denom = sc
      ? `${sc.tested} of ${sc.in_scope} tested`
      : `DENOMINATOR NOT CARRIED by ${'data/' + f} — it predates the scope block; re-run `
        + `tests/roster.js --stage ${stage} --write`;
    const unattrib = unattributable === null
      ? '. UNATTRIBUTABLE ROWS NOT COUNTED — this artifact carries no rows to count'
      : unattributable === 0 ? ''
      : `. ${unattributable} row(s) count in NEITHER column — the control arm is itself a live ability`
        + (sc && sc.unattributable_ids ? `: ${sc.unattributable_ids.join(', ')}` : '');
    return {
      stage, file: 'data/' + f, generated: j.generated || null, release: j.engine_release || null,
      pins: PIN.receipt({ file: 'data/' + f, checked: ['release', 'digests'],
                          release: j.engine_release || null }),
      differ, silent, badReds, matched: c['FIRED-AND-BOARDS-MATCH'] || 0,
      couldNotStage: c['COULD-NOT-STAGE'] || 0,
      deferred: deferred.length, staleShelf, scope: sc, unattributable,
      ok: differ === 0 && silent === 0 && badReds === 0 && staleShelf === 0,
      /* THE DEFERRAL COUNT MOVED TO THE CLOSET SECTION and is deliberately not repeated here — it
       * was printing in both places once the closet existed, and a number shown twice is a number
       * a reader has to reconcile. The count is still on the returned object for anything that
       * wants it programmatically. */
      why: (differ === 0 && silent === 0 && badReds === 0 && staleShelf === 0
        ? `clean: ${denom}`
        : `${differ} FIRED-AND-BOARDS-DIFFER, ${silent} DID-NOT-FIRE — ${denom}`
          + (badReds ? `, ${badReds} red demonstration(s) did not behave as their rule predicted` : '')
          + (staleShelf ? `, ${staleShelf} DEFERRAL(S) NOW PASS ON THEIR OWN — take the shelf down` : ''))
        + unattrib,
    };
  }
  return {
    stage, file: null, ok: false, missing: true, differ: null, silent: null,
    pins: PIN.receipt({ file: null, checked: ['release', 'digests'],
                        why: 'no artifact declares this stage' }),
    why: `NO ARTIFACT FOR THIS STAGE — none of ${tried.join(', ')} declares stage "${stage}". `
       + `A missing stage is a FAILING clause, never a passing one: run `
       + `SHOWDOWN_PATH=... node tests/roster.js --stage ${stage} --write`,
  };
}

/* `artifact` IS AN INJECTION POINT FOR THE SELFTEST AND NOTHING ELSE. The roster clause's selftest
 * reimplements its rule in three lines and therefore proves nothing about the rule that ships; this
 * one drives THE SHIPPING FUNCTION on synthetic artifacts. Absent, it reads the real file exactly as
 * before. */
function differentialClause(artifact, curId) {
  const j = artifact === undefined ? readJson(D('data', 'engine-diff.json')) : artifact;
  if (!j) {
    return { name: 'game differential', ok: false, missing: true,
             pins: PIN.receipt({ file: 'data/engine-diff.json', checked: ['release', 'digests'],
                                 why: 'no artifact to pin' }),
             why: 'NO ARTIFACT — data/engine-diff.json is absent. Run tests/test-engine-diff.js.' };
  }
  /* ---- THE PIN, BEFORE A SINGLE COUNT IS READ — 2026-09-04 --------------------------------------
   *
   * THIS ARTIFACT CARRIED NO RELEASE PIN AT ALL, and it is the one behind "clean at BOTH corners of
   * the damage roll: midpoint 0 of 6000". Measured: between its `generated` stamp (2026-08-29T06:49Z)
   * and 2026-09-04, FOUR of the twenty-six frozen sources moved — `engine/medicham2-browser.js`
   * (six commits), `data/engine-data.js`, `data/tags.json` and `data/abra-tags.js`. Every other
   * clause in this file refuses a release mismatch. This one could not: there was no field to read.
   *
   * ITS PRODUCER READS THE LIVE TREE ON PURPOSE and that is not the defect — an INSTRUMENT is not
   * frozen, only the engine is. What was missing was a way to stamp the live tree without cutting a
   * release it had not read from, which `engine_release.liveStamp()` now provides. */
  {
    const r = PIN.guard({ name: 'game differential', file: 'data/engine-diff.json', artifact: j,
      need: ['release', 'digests'], curId,
      rerun: 'SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000 --seed 20260804' });
    if (r) return r;
  }
  const dis = j.disagreed || 0;
  const worst = (j.worst || [])[0];
  /* ---- ROADMAP #88 — THE CLAUSE ASKS BOTH CORNERS, NOT ONE AVERAGED NUMBER ---------------------
   *
   * `disagreed` above is a MIDPOINT residual: the instrument averages Showdown's two endpoints, averages
   * MEDICHAM's, and compares those. A range that is wrong by the SAME AMOUNT AT BOTH ENDS has an
   * identical midpoint and cannot move it — demonstrated in the instrument itself by `--plant spread`,
   * which reads 0 on the midpoint and 196/218 of 300 on the corners. So "0 of 6000" was a weaker claim
   * than it read, and this gate was resting on it.
   *
   * IT HAD ALREADY HIDDEN ONE. CHANGELOG 3.75.0: the rolled crit sat in the wrong position in the
   * damage formula — 46.5% of rows wrong at the bottom roll, invisible at the top — while every check
   * in the repository stayed green.
   *
   * AN ARTIFACT WITH NO `arms` FAILS, and that is deliberate rather than lenient. A clause that cannot
   * be computed must fail (the same rule `coverageClause` states); reading a missing arm as "nothing
   * disagreed" is exactly the silent default this file exists to stop. A PLANTED run fails too — a red
   * demonstration is not a measurement, and the instrument already refuses to write it here. */
  /* the receipt every return below carries — see engine/pin_guard.js `audit` */
  const RCPT = PIN.receipt({ file: 'data/engine-diff.json', checked: ['release', 'digests'],
                             release: (j[PIN.K.id] || null) });
  if (j.plant) {
    return { name: 'game differential', ok: false, generated: j.generated || null, pins: RCPT,
      why: `THIS ARTIFACT IS A PLANTED RED DEMONSTRATION (--plant ${j.plant.kind}) and is not a `
         + 'measurement. Re-run tests/test-engine-diff.js without --plant.' };
  }
  const arms = Array.isArray(j.arms) ? j.arms : null;
  if (!arms || !arms.length) {
    return { name: 'game differential', ok: false, generated: j.generated || null, pins: RCPT,
      why: 'THE CORNER ARMS ARE ABSENT from data/engine-diff.json. `disagreed` is a MIDPOINT residual '
         + 'and cannot see a range wrong by the same amount at both ends, so it is not a sufficient '
         + 'claim on its own. Re-run: SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000 '
         + '--seed 20260804' };
  }
  const badArms = arms.filter(a => (a.disagreed || 0) > 0);
  const ok = dis === 0 && badArms.length === 0;
  const armTxt = arms.map(a => `${a.arm} ${a.disagreed || 0}/${a.compared}`).join(', ');
  return {
    name: 'game differential', ok, generated: j.generated || null, pins: RCPT,
    arms: arms.map(a => ({ arm: a.arm, compared: a.compared, disagreed: a.disagreed || 0 })),
    why: ok
      ? `clean at BOTH corners of the damage roll: midpoint 0 of ${j.compared}, ${armTxt} (seed ${j.seed})`
      : (dis > 0
          ? `${dis} of ${j.compared} comparisons disagree with Showdown at the MIDPOINT`
            + (worst ? ` — worst: ${worst.att} ${worst.mv} -> ${worst.def} (showdown ${worst.showdown}, medicham ${worst.medicham})` : '')
          : `the midpoint is clean and a CORNER IS NOT — ${armTxt}`)
        + (badArms.length
            ? '. ' + badArms.map(a => {
                const w = (a.worst || [])[0];
                return `${a.arm}: ${a.disagreed} of ${a.compared}`
                     + (w ? ` — worst ${w.att} ${w.mv} -> ${w.def} (showdown ${w.showdown}, medicham ${w.medicham})` : '');
              }).join('; ')
            : ''),
  };
}

/* ---- COVERAGE: A USED MECHANIC THAT NO INSTRUMENT MEASURES IS A FAILING CLAUSE ------------------
 *
 * Will, 2026-08-10, on the things the gate was ignoring: *"those things need to block the gate man
 * (except for the under 25 clicks)"*. He is right, and the reason is the one this whole file exists
 * for: a gate that passes while we KNOW something is unmeasured is a preference, not a bar.
 *
 * THE FIRST VERSION OF THIS CLAUSE WAS WRONG AND WAS PRICED BEFORE IT WAS WIRED. The obvious rule —
 * "COULD-NOT-STAGE stops being a free pass" — fails 42 moves above the shelf including Rage Powder
 * (9,626 clicks), Wide Guard (6,615) and Follow Me (4,005). Every one of those IS measured, by the
 * mechanics census, which probes the TAG. COULD-NOT-STAGE is a statement about one harness's fixture,
 * not about the mechanic, and a clause built on it would have cried wolf on the busiest moves in the
 * format on its first run.
 *
 * SO THE CLAUSE ASKS THE ONLY QUESTION THAT MATTERS: does ANY instrument measure this?
 *   - the deliberate roster STAGED it (a FIRED-AND-BOARDS verdict), or
 *   - the census probes EVERY tag it carries, so no aspect of it is unexercised
 * Untagged is covered by nothing, and that is the honest verdict rather than a pass — an entity the
 * tagger never described cannot be tested by anything downstream of the tagger.
 *
 * EVERY tag, not "some tag". A move carrying `priority, noExtraHit` whose `priority` is probed is not
 * covered: the probed half says nothing about the unprobed one. "Some tag probed" would mark every
 * priority move green and is the kind of bar that looks like a gate and is a formality.
 *
 * THE USAGE SHELF APPLIES, at Will's explicit exception. Below 25 real clicks in the store a row is
 * shelved rather than failing — the same threshold, from the same artifact, as the roster's own shelf,
 * so the two can never drift apart. `engine/click_counts.js` is the authority; `tags.json.uses`
 * undercounts by up to 8.6x and must not be used here.
 *
 * MEASURED THE DAY IT WAS WIRED: 410 moves above the shelf, 402 covered, 8 covered by nothing, across
 * four distinct unprobed tags. 2,022 clicks of 1,004,407. A clause that fails on 0.2% of clicks and
 * names four tags is actionable; one that fails on 42 rows including the top three is noise. */
/* ---- THE MECHANICS CLAUSE — WILL, 2026-08-12: "we dont care about the games ending, we just care
 * about the mechanics lining up with showdowns" -----------------------------------------------------
 *
 * The whole-game clause counts GAMES, and a game is whatever the coverage-seeking chooser happened to
 * click. That weights a mechanic by how often a sampler reached it, which is not the question. Will's
 * question is per-MECHANIC: does each one line up with the authority.
 *
 * `engine/all_mechanics_fire.js` already answers it and nothing gated on it. It builds the teams FROM
 * THE MECHANIC LIST rather than from realistic sets — Will, 2026-08-10: *"WE HAVE TO CREATE THE GAMES
 * OURSELVES AND TEST IT ON SHOWDOWN"*, *"I DONT CARE IF THEY ARE GOOD PLAYS, JUST HAVE THE MOVES
 * SUCEED"* — so its coverage is a property of the format, not of what a bot felt like clicking. It
 * reached 500 of 500 moves where the swarm reaches whatever it reaches.
 *
 * IT MUST FAIL WHEN IT IS STALE, AND THAT IS THE POINT RATHER THAN AN INCONVENIENCE. Its artifact
 * stamps the release it measured. An artifact cut against a different engine is not a weaker answer to
 * this question, it is an answer to a different question — and this repo has the receipt: a 2026-08-11
 * run was quoted as current while every fix of 2026-08-12 postdated it. "We have not measured this
 * engine" is a real failure and must read as one.
 *
 * DID-NOT-FIRE IS DELIBERATELY NOT COUNTED AS A DIVERGENCE. A mechanic the fixture could not make
 * happen is a HARNESS defect; a mechanic that happened and disagreed is an ENGINE defect. Those were
 * one bucket until the preflight split them, and folding them back together here would undo that. The
 * unfired count is REPORTED so it cannot be forgotten, and it fails nothing. */
/* THE CLASSIFICATION IS ONE FUNCTION, CALLED BY THE CLAUSE AND BY `--reach`. The alternative was a
 * probe script that re-derives the same split to print it, which is the second-implementation failure
 * this repository names by its own casualty (`buildMon("Scizor")` returned null beside a working
 * builder). The clause DECIDES on this; the printer only shows it. */
function classifyMechanics(j, curId, inject) {
  /* `inject` IS THE SELFTEST'S INJECTION POINT, on the same reasoning as `wholeGameClause`'s second
   * argument: a parameter is visible in the caller where a flag is not. Every shipping caller leaves
   * it undefined, so the real readers are the default. */
  const U = (inject && inject.U) || usageIndex();
  const DI = (inject && inject.DI) || decisionImpact(curId);
  const SH = reachShelf(U);       /* one anchor, one rate, a threshold per population — #295 */
  const counted = [], belowShelf = [], unknown = [], excused = [], declaredHits = [], ownerShelved = [];
  /* THIS CLAUSE'S OWN THROW SINK. Not `MATCHER_THREW`: a shared accumulator would print a mechanics
   * cause under the whole-game clause's heading. See `declaredMatch`. */
  const declaredThrew = [];
  const EV = mechanicsCauseEvidence(j);
  /* SAME CONTEXT, SAME DOOR — a CLOSETED row's evidence must be aged against THIS artifact's release
   * too, or one clause would report the exemption fresh while the other reported it stale. */
  const MECHCTX = { release: (j && (j.release || j.engine_release)) || null,
                    generated: (j && j.generated) || null };
  let rowsSeen = 0; const rowsMissing = [];
  for (const kind of ['moves', 'abilities', 'items']) {
    const list = Array.isArray(j && j.rows && j.rows[kind]) ? j.rows[kind] : null;
    if (!list) { rowsMissing.push(kind); continue; }
    for (const r of list) {
      if (!r || !r.diverged) continue;
      /* ---- THE OWNER'S CLOSET, AND IT IS COLLECTED ON THE WAY PAST RATHER THAN DROPPED — #291/#520
       * `deferred` is the shelf `all_mechanics_fire.js` stamps onto a row: `tests/roster.js DEFERRED`
       * by entity id, or the ILLUSION shelf derived from `GD.CLOSET_SPECIES`. It has always skipped
       * the row and it still does — the ruling is Will's and it does not vote.
       *
       * WHAT CHANGED IS THAT IT USED TO SKIP SILENTLY AND THE CLAUSE PRINTED A BARE INTEGER. This
       * file's own standard, stated three times above, is that **a filter may only ever SUBTRACT
       * from a number a reader can still see** — and the DECLARED register prints every row that may
       * subtract, with its ruling, whether or not it fired. The owner's shelf was subtracting with
       * strictly less accountability than a declaration, so a fifth entry could have appeared and
       * nothing would have named it. That is the invisible-exception failure the roster's own header
       * exists to prevent, sitting inside the guard written to stop it.
       *
       * THE SKIP IS DELIBERATELY BEFORE `declaredMatch` AND MUST STAY THERE. A shelf DERIVED from
       * the ability beats a matcher TYPED against a cause string; asking the declared list first
       * would let a hand-written row claim credit for a subtraction the derivation already made. */
      if (r.deferred) {
        ownerShelved.push({ kind, id: r.id, key: SINGULAR[kind] + ':' + nid(r.id),
                            carrier: r.carrier || null,
                            by: r.deferred.by || null, on: r.deferred.on || null,
                            why: String(r.deferred.why || ''),
                            cause: String((r.divergence && r.divergence.cause) || ''),
                            board_verdict: (r.board && r.board.verdict) || null });
        continue;
      }
      rowsSeen++;
      const key = SINGULAR[kind] + ':' + nid(r.id);
      const reach = reachOf(U, kind, r.id);
      const row = { kind, id: r.id, key, reach, shelf: SH.of(kind) };
      /* ---- THE DECLARED LIST IS ASKED FIRST, AND THE ORDER IS THE CLAIM ------------------------
       * DECLARED does not say "this defect is small" — it says THERE IS NO DEFECT, because matching
       * the authority here would make this engine less correct, or because there is no shared
       * address to compare against. Reach and decision impact both presuppose a defect and ask
       * whether it is worth fixing. So a declared row must never be filed under "nobody plays it":
       * that would be a true statement making a false claim, and it would go quiet the moment the
       * mechanic became popular.
       *
       * MEASURED on the 2026-08-26 artifact before this was wired: no row below the reach shelf
       * matches any declaration, so putting this first moves nothing today. It is first for the
       * reason above, not for the count. */
      const dec = declaredMatch(r.divergence && r.divergence.cause, EV, declaredThrew, MECHCTX);
      if (dec) {
        declaredHits.push({ ...row, kind_declared: dec.kind, name: dec.name, why: dec.why,
                            closet: dec.closet || null, evidence: dec.evidence || null,
                            falsifiedBy: dec.falsifiedBy || null,
                            evidence_stale: dec.evidence_stale || null,
                            cause: String((r.divergence && r.divergence.cause) || '') });
        continue;
      }
      if (!reach.known) { unknown.push(row); continue; }
      if (SH.below(kind, reach.n)) { belowShelf.push(row); continue; }
      const c = DI.clear(key);
      if (c) { excused.push({ ...row, impact: c }); continue; }
      counted.push(row);
    }
  }
  return { U, DI, SH, counted, belowShelf, unknown, excused, declared: declaredHits,
           ownerShelved, declaredThrew, rowsSeen, rowsMissing };
}

/* `inject` IS THE SELFTEST'S DOOR AND EVERY SHIPPING CALLER LEAVES IT UNDEFINED — the same door, for
 * the same reason, as `wholeGameClause`'s and `classifyMechanics`'s extra arguments: a parameter is
 * visible in the caller where a flag is not.
 *
 * IT EXISTS BECAUSE A SELFTEST THAT READS A LIVE ARTIFACT IS NOT A SELFTEST. The first version of
 * the printer assertion below drove this function off disk, and it went RED mid-session for a reason
 * that had nothing to do with the code: another division cut a release, `data/engine-release.json`
 * moved from `aea838766e7f` to `b035aa665740`, and the clause correctly took its
 * MEASURED-AGAINST-A-DIFFERENT-ENGINE early return. A signal another agent can flip is noise, and
 * this repository's history says a test that goes red for a reason nobody owns gets filed as a known
 * failure. So the fixture is handed in. */
function mechanicsClause(inject) {
  const NAME = 'mechanics / each one staged and compared against showdown';
  const j = (inject && inject.j) || readJson(D('data', 'all-mechanics-fire.json'));
  if (!j) {
    return { name: NAME, ok: false, missing: true,
      pins: PIN.receipt({ file: 'data/all-mechanics-fire.json', checked: ['release', 'digests'],
                          why: 'no artifact to pin' }),
      why: 'NO ARTIFACT — data/all-mechanics-fire.json is absent. A clause that cannot be computed '
         + 'FAILS. Run: SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --kind all --write' };
  }
  const cur = (inject && inject.cur) || readJson(D('data', 'engine-release.json'));
  const curId = cur && (cur.id || cur.release || cur.current);
  const ranOn = j.release || j.engine_release || null;
  const MRCPT = PIN.receipt({ file: 'data/all-mechanics-fire.json',
                             checked: ['release', 'digests'], release: ranOn });
  const s = j.summary || {};
  const div = ['moves', 'abilities', 'items'].reduce((n, k) => n + (+((s[k] || {}).diverged) || 0), 0);
  const unfired = ['abilities', 'items'].reduce((n, k) => n + (+((s[k] || {}).did_not_fire) || 0), 0);
  const parts = ['moves', 'abilities', 'items']
    .filter(k => s[k]).map(k => k + ' ' + ((s[k] || {}).diverged || 0));
  /* ROADMAP #291 — THE CLOSET REACHES THIS CLAUSE TOO. `summary[k].diverged` now EXCLUDES the
   * entities the owner shelved by name (tests/roster.js DEFERRED, the one declaration), exactly as
   * the three deliberate-roster clauses already did. It was counting `abilities:forewarn` and
   * `items:metronome` — and metronome was the only item in the failing count, so the item clause read
   * 1 where the honest answer is 0. The subtraction is PRINTED rather than applied quietly; a shelf
   * nobody can see is the invisible exception the roster's own header exists to prevent. */
  const shelved = ['moves', 'abilities', 'items']
    .reduce((n, k) => n + (+((s[k] || {}).shelved_by_owner_diverging) || 0), 0);
  const tail = `  [${parts.join(', ')};  ${unfired} never fired — a harness gap, not counted here`
             + (shelved ? `;  ${shelved} shelved by the owner — still staged and played, not counted` : '')
             + `]`;

  /* ---- THE PIN, THROUGH THE ONE DOOR — 2026-09-04 -----------------------------------------------
   *
   * TWO THINGS WERE WRONG HERE AND ONLY ONE OF THEM WAS THE MISSING ABSENCE CHECK.
   *
   * (1) THE REFUSAL PRINTED THE FIGURES IT WAS REFUSING. `+ tail` appended
   *     `[moves 4, abilities 0, items 0; 3 never fired ...]` to a sentence saying the artifact
   *     describes other bytes. That is a captioned figure, which CLAUDE.md calls the bug in as many
   *     words — `PRE-CHANGE` was printed beside the quarantined numbers and they were quoted anyway.
   *     Nothing measured comes back on the refusal now.
   * (2) `ranOn &&` MEANT AN ARTIFACT WITH NO PIN ANSWERED. And this one hand-rolls `release: <id>`
   *     rather than spreading `REL.stamp()`, so it carries no `showdown_commit` — while the AUTHORITY
   *     selects its population: its 500 moves come from `dex.moves.all()` filtered to the format, so a
   *     different Showdown checkout is a different denominator — and no `source_digests`, which is
   *     the only thing provenance.js can verify by CONTENT. `GD.REL` is already open in that file;
   *     `...GD.REL.stamp()` replaces the hand-rolled field.
   *
   * IT IS NOT CENSUS-STEERED, and the note in CLAUDE.md saying it is does not hold for this file.
   * MEASURED 2026-09-04: `engine/all_mechanics_fire.js` contains no reference to
   * `data/mechanics-census.json` at all — the census steers `engine/game_differential.js`, which is a
   * different instrument. Its population is the format's legal entity lists plus `data/tags.json`,
   * and both are covered by the release stamp (tags.json is a frozen source; the checkout is
   * `showdown_commit`). So the pin it needs is the STAMP, not a steering block. */
  {
    const r = PIN.guard({ name: NAME, file: 'data/all-mechanics-fire.json', artifact: j,
      need: ['release', 'digests'], curId: curId || null,
      rerun: 'SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --kind all --write' });
    if (r) return r;
  }

  /* ---- THE DECISION-EQUIVALENCE BAR, APPLIED PER ENTITY ----------------------------------------
   * The count above is the artifact's own summary and it stays printed, because the two filters may
   * only ever SUBTRACT from a number a reader can still see. What decides the clause is the set of
   * diverging entities that somebody plays and that no paired run has cleared. */
  const C = classifyMechanics(j, curId, inject);
  const { U, DI, counted, belowShelf, unknown, excused, declared, ownerShelved, declaredThrew,
          rowsSeen, rowsMissing } = C;

  /* A DERIVED SET IS NOT A FACT UNTIL SOMETHING COMPARES IT TO ITS SOURCE. If the per-entity rows and
   * the artifact's own summary disagree about how many diverged, the filter is being applied to a
   * population that is not the one the headline describes — and the honest answer is to fail saying
   * so, never to publish whichever number is smaller. Absent rows are the same failure by omission:
   * an older artifact with a `summary` and no `rows` must not read as "nothing to filter". */
  if (rowsMissing.length || rowsSeen !== div) {
    return { name: NAME, ok: div === 0, generated: j.generated || null, diverged: div, unfired,
      pins: MRCPT,
      why: (rowsMissing.length
        ? `THE REACH FILTER CANNOT BE APPLIED — data/all-mechanics-fire.json carries no per-entity rows `
          + `for ${rowsMissing.join(', ')}, so every divergence counts. `
        : `THE ROWS AND THE SUMMARY DISAGREE — ${rowsSeen} diverging row(s) against a summary of ${div}. `
          + `A filter applied to a population the headline does not describe is worse than no filter. `)
        + `${div} MECHANICS DISAGREE with the authority.` + tail };
  }

  const drift = reachDrift();
  const NL = String.fromCharCode(10);
  /* THE DENOMINATOR TRAVELS WITH EVERY COUNT — #295. `1799 clicks` and `2177 teams` are figures in
   * different populations and a bare integer beside a name cannot say which. */
  const show = (rs) => rs.sort((a, b) => (b.reach.n || 0) - (a.reach.n || 0))
    .map((r) => r.key + ' (' + (r.reach.known
      ? r.reach.n + ' ' + r.reach.unit + '/' + (r.reach.denomLabel || 'NO DENOMINATOR')
      : 'no figure') + ')').join(', ');
  const SH = C.SH;
  const shelfOf = (kind) => { const s = SH.of(kind); return s.derivable
    ? `${s.minCount}+ ${s.unit} in ${(s.denom || 0).toLocaleString()} games` : 'NOT DERIVABLE — nothing shelved'; };
  const reachLine = NL
    + `  REACH — one anchor (${SH.anchor.n} clicks in ${(SH.anchor.denom || 0).toLocaleString()} stored games`
    + `) carried to each population at the same rate; still staged and played, not counted `
    + `[moves count at ${shelfOf('moves')};  abilities/items count at ${shelfOf('abilities')}]:` + NL
    + (belowShelf.length ? '    ' + show(belowShelf) : '    (none)');
  const unknownLine = unknown.length
    ? NL + `  NO USAGE FIGURE — ${unknown.length} diverging mechanic(s) the usage instrument cannot see. `
      + `UNKNOWN IS NOT ZERO: these are NOT shelved and they DO count:` + NL
      + '    ' + unknown.map((r) => r.key + ' — ' + r.reach.why).join(NL + '    ')
    : NL + `  NO USAGE FIGURE: none — every diverging mechanic has a store-derived usage number.`;
  const impactLine = NL + '  DECISION IMPACT — ' + (excused.length
    ? `${excused.length} played divergence(s) cleared by a paired argmax run: `
      + excused.map((r) => r.key + ' (0 flips in ' + r.impact.paired + ', 95% upper bound '
        + r.impact.bound.toFixed(1) + '% — a floor, not a zero; fixed in ' + r.impact.fixed_in + ')').join(', ')
    : DI.why);
  const driftLine = drift ? NL + '  SHELF DRIFT — ' + drift : '';
  /* ---- WHAT THIS CLAUSE SUBTRACTED ON A DECLARATION, AND WHY -------------------------------------
   * PRINTED AT ZERO AS WELL, exactly like the whole-game clause's Illusion closet and its
   * matcher-threw line. A gate that gets quieter without saying what it stopped counting is how a
   * real defect hides — and this clause got quieter by one the day the door was opened, so the line
   * that names the row is the whole point of the change rather than decoration on it.
   *
   * ONE BLOCK PER KIND, NEVER SUMMED: the two kinds make OPPOSITE claims about whether a defect
   * exists, so a blended "declared: 1" would hide which claim is being made. Same reasoning, and the
   * same headings, as `wholeGameClause`. */
  const declaredLine = NL + '  DECLARED — ' + (declared.length
    ? `${declared.length} diverging mechanic(s) subtracted because a declaration in `
      + `engine/quarantine.js covers the cause. Each is NOT a defect; it is not "small":`
      + Object.keys(DECLARED_KINDS).map((kind) => {
          const rows = declared.filter((r) => r.kind_declared === kind);
          if (!rows.length) return '';
          return NL + '    ' + DECLARED_KINDS[kind] + '  [' + rows.length + ' mechanic(s)]'
            + rows.map((r) => NL + '      ' + r.key + '  ' + r.name
                + NL + '        cause: ' + r.cause
                + NL + '        ' + r.why
                + (r.closet ? NL + '        CLOSETED BY ' + r.closet.by + ' ' + r.closet.on
                    + ' (' + r.closet.authority + '): "' + r.closet.ruling + '"' : '')
                + (r.falsifiedBy ? NL + '        WOULD BE WRONG IF: ' + r.falsifiedBy : '')
                + (r.evidence_stale ? NL + '        ' + r.evidence_stale : '')).join('');
        }).join('')
    : `none — no diverging mechanic's cause is covered by a declaration, so all ${rowsSeen} are `
      + `judged on reach and decision impact alone.`);
  /* ---- WHAT THE OWNER'S CLOSET SUBTRACTED, BY NAME — #520 ---------------------------------------
   * PRINTED AT ZERO AS WELL, for the same reason the DECLARED register is: a shelf that gets quieter
   * without saying what it stopped counting is indistinguishable from a mechanic that never came up.
   * `tail` above carries the INTEGER and it stays; this line carries the ROWS, so the subtraction and
   * the accountability for it arrive together.
   *
   * AND THE TWO NUMBERS ARE COMPARED RATHER THAN ASSUMED EQUAL. The integer comes from the
   * artifact's own `shelved_by_owner_diverging` summary and the rows come from walking `rows[*]`; a
   * derived set is not a fact until something compares it to its source. A mismatch PRINTS and does
   * not move the clause — this batch is a reporting change and may not move a count. */
  const shelvedLine = NL + '  SHELVED BY THE OWNER — ' + (ownerShelved.length
    ? `${ownerShelved.length} diverging mechanic(s) the owner closeted. Still staged, still played, `
      + `still carrying their divergence in the artifact; they do not vote:`
      + ownerShelved.map((r) => NL + '    ' + r.key
          + (r.carrier ? '  (staged on ' + r.carrier + ')' : '')
          + (r.board_verdict ? '  board: ' + r.board_verdict : '')
          + NL + '      cause: ' + (r.cause || '(none recorded)')
          + NL + '      CLOSETED BY ' + (r.by || 'UNNAMED') + ' ' + (r.on || 'UNDATED') + ': ' + r.why).join('')
      + (ownerShelved.length !== shelved
          ? NL + '    THE ROWS AND THE SUMMARY DISAGREE — ' + ownerShelved.length + ' shelved row(s) '
            + 'against a summary of ' + shelved + '. One of the two is describing a different '
            + 'population; neither is authoritative until they agree.' : '')
    : `none — no diverging mechanic is on the owner's shelf, so nothing is subtracted here.`);
  /* ROADMAP #258, CARRIED ACROSS. A matcher that throws pushes its row into the UNDECLARED pile and
   * INFLATES the count above, so the line sits beside the number it would distort — and is this
   * clause's own list, never the whole-game clause's. */
  const declaredThrewLine = declaredThrew.length
    ? NL + '  A DECLARED-DIVERGENCE MATCHER THREW on ' + declaredThrew.length + ' cause(s), each of '
      + 'which is therefore counted as UNDECLARED and is INFLATING the count above:' + NL
      + declaredThrew.map((r) => '    ' + r.cause + '  ->  ' + r.error).join(NL)
    : '';

  return { name: NAME, ok: counted.length === 0, generated: j.generated || null, pins: MRCPT,
    diverged: div, unfired, counted: counted.length, shelved: belowShelf.length,
    unknown_reach: unknown.length, decision_cleared: excused.length,
    /* the split a reader needs, as DATA and not only as prose — never summed into `diverged` */
    declared: declared.length,
    declared_by_kind: Object.keys(DECLARED_KINDS).reduce((o, kind) => {
      o[kind] = declared.filter((r) => r.kind_declared === kind).length; return o; }, {}),
    declared_rows: declared.map((r) => ({ key: r.key, kind: r.kind_declared, name: r.name })),
    declared_matcher_threw: declaredThrew,
    /* THE OWNER'S SHELF AS DATA — #520. Named `owner_shelved` and NOT folded into `shelved` above,
     * which is the REACH shelf and answers a different question ("nobody plays it" vs "the owner
     * ruled"). Two subtractions under one key would be unreadable in exactly the way this batch is
     * fixing. `owner_shelved_summary` is the artifact's own integer, carried beside the derived rows
     * so a reader can see the two agree rather than take it on trust. */
    owner_shelved: ownerShelved.length,
    owner_shelved_summary: shelved,
    owner_shelved_rows: ownerShelved.map((r) => ({ key: r.key, carrier: r.carrier, by: r.by, on: r.on,
                                                   cause: r.cause, board_verdict: r.board_verdict })),
    why: (counted.length === 0
      ? `every mechanic anybody plays agrees with the authority: ${div} diverge, ${declared.length} are `
        + `declared, ${belowShelf.length} are below the reach shelf and ${excused.length} were cleared `
        + `on decision impact, leaving 0.`
      : `${counted.length} of ${div} DIVERGING MECHANICS ARE PLAYED AND UNCLEARED — each is a rule, not `
        + `a sampling artefact, since the teams are built from the mechanic list. Worst: `
        + show(counted.slice()).split(', ').slice(0, 6).join(', ')) + tail
      + declaredLine + shelvedLine + declaredThrewLine + reachLine + unknownLine + impactLine
      + driftLine };
}

function coverageClause() {
  const clicks = readJson(D('data', 'click-counts.json'));
  const census = readJson(D('data', 'mechanics-census.json'));
  const tags = readJson(D('data', 'tags.json'));
  const missing = [];
  if (!clicks) missing.push('data/click-counts.json (run engine/click_counts.js)');
  if (!census) missing.push('data/mechanics-census.json');
  if (!tags) missing.push('data/tags.json');
  if (missing.length) {
    return { name: 'coverage / every used mechanic is measured by something', ok: false, missing: true,
      pins: PIN.noArtifact('this clause recomputes from data/click-counts.json, data/mechanics-census.json '
      + 'and data/tags.json on every run and holds no result of its own, so there is nothing for it '
      + 'to be stale against — it is the READER of those artifacts, not a record of a measurement'),
      why: `CANNOT ANSWER — absent: ${missing.join(', ')}. A clause that cannot be computed FAILS; `
         + 'reading it as "nothing is uncovered" is the shape of bug this gate exists to stop.' };
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const live = new Set((census.results || []).filter(r => r && r.live !== false).map(r => norm(r.tag)));
  const rm = readJson(D('data', 'roster.moves.json'));
  const rows = (rm && (rm.rows || rm.results || rm.entries)) || [];
  const measured = new Set(rows.filter(r => /FIRED-AND-BOARDS/.test(r.verdict || '')).map(r => norm(r.id || r.name)));
  const shelved = new Set(rows.filter(r => r.verdict === 'DEFERRED-BY-OWNER').map(r => norm(r.id || r.name)));

  /* ONE SHELF, DECLARED ONCE. This carried its own literal 25 until 2026-08-18; the reach filter
   * above needed the same number and two literals in one file is how they drift. It reads the CLICKS
   * ANCHOR and not a per-population threshold, because this loop's population IS clicks — it walks
   * `click-counts.json.moves` and nothing else. #295. */
  const SHELF = REACH_SHELF_CLICKS;
  let above = 0;
  const uncovered = [];
  for (const [mv, n] of Object.entries(clicks.moves || {})) {
    if (n < SHELF) continue;
    above++;
    const mid = norm(mv);
    if (measured.has(mid) || shelved.has(mid)) continue;
    const t = ((tags.moves || {})[mid] || {}).tags || [];
    const untagged = !t.length || t.includes('untagged');
    const unprobed = untagged ? [] : t.filter(x => !live.has(norm(x)));
    if (!untagged && !unprobed.length) continue;
    uncovered.push({ move: mid, clicks: n, why: untagged ? 'UNTAGGED — nothing describes it' : 'tag(s) never probed: ' + unprobed.join(', ') });
  }
  uncovered.sort((a, b) => b.clicks - a.clicks);
  const lost = uncovered.reduce((s, u) => s + u.clicks, 0);
  const tagsAtFault = [...new Set(uncovered.flatMap(u => (u.why.match(/probed: (.*)$/) || [, ''])[1].split(', ').filter(Boolean)))];
  return {
    name: 'coverage / every used mechanic is measured by something',
    pins: PIN.noArtifact('this clause recomputes from data/click-counts.json, data/mechanics-census.json '
      + 'and data/tags.json on every run and holds no result of its own, so there is nothing for it '
      + 'to be stale against — it is the READER of those artifacts, not a record of a measurement'),
    ok: uncovered.length === 0, uncovered, above_shelf: above,
    why: uncovered.length === 0
      ? `clean: all ${above} moves above ${SHELF} clicks are measured by the roster or the census`
      : `${uncovered.length} of ${above} moves above ${SHELF} clicks are measured by NOTHING `
        + `(${lost.toLocaleString()} clicks) — ${tagsAtFault.length} tag(s) at fault: ${tagsAtFault.join(', ')}. `
        + `Worst: ${uncovered.slice(0, 4).map(u => u.move + ' (' + u.clicks + ')').join(', ')}`,
  };
}

/* ---- NO OPEN, KNOWN, UNFIXED ENGINE DEFECT ------------------------------------------------------
 *
 * Will, 2026-08-10, on seeing the gate OPEN beside the register: *"THE GATE SHOULDNT BE OPEN, SO MANY
 * OF THESE ITEMS ARE DISQUALIFYING FOR THE ENGINE TO WORK."* He is right and the GATE was wrong, not
 * the items.
 *
 * WHAT THE OTHER FIVE CLAUSES ACTUALLY ASK. The differential asks whether Showdown disagreed about
 * what the bots HAPPENED TO CLICK. The three roster clauses ask whether OUR TWO ENGINES agree. The
 * coverage clause asks whether SOMETHING measured it. **Not one of them asks whether we already KNOW
 * a mechanic is broken.**
 *
 * And we do know. The roadmap is precisely that register, and on the day this clause was written it
 * held 22 open rows describing a live engine defect — Struggle unimplemented, PP absent, 32 moves
 * resolving to a whole no-op turn, the Choice lock not arming on a status move at 7,844 uses, Quick
 * Guard the only priority refusal that does not work, thirteen moves never recording `_lastMove` so
 * Encore cannot reach most of what it should. Any one of those is disqualifying, and the gate said
 * OPEN over all of them.
 *
 * THIS IS THE "KNOWN FAILURE IS A BANNED PHRASE" RULE, ONE LEVEL UP. That rule stops a RED TEST being
 * filed as a status. This stops a KNOWN DEFECT being filed as a roadmap row while the gate reports the
 * engine correct. Same failure, different register — and the fix is the same one the file already
 * applies everywhere else: the gate is READ, not remembered.
 *
 * HOW A ROW IS CLASSIFIED. It counts if the roadmap files it to `docs/ENGINE.md`, or if its own text
 * says the engine does not do something — "NEVER FIRED", "NOT IMPLEMENTED", "DOES NOT WORK", "IS
 * ABSENT", "no-op", "never records". Matched on the row's own words rather than a hand list of numbers,
 * so an item added tomorrow is counted without editing this file, and a row that is CLOSED says so in
 * its own text and drops out. That cuts both ways deliberately: it means a row cannot be quietly
 * excluded, and it means a stale row keeps the gate shut until somebody marks it done — which is the
 * correct direction for a bar to err.
 *
 * IT IS NOT A USAGE THRESHOLD. A defect is a defect; the shelf that exists for the roster is about
 * which rows are worth STAGING, not about which broken mechanics are acceptable. Usage is reported so
 * the queue can be ordered, and it does not excuse anything. */
/* THE TWO PREDICATES BELOW WERE INLINE IN THE CLAUSE, AND THAT IS WHY NOBODY COULD ASK THE REGISTER A
 * QUESTION. This gate answers exactly one: "is there an open row that ASSERTS BREAKAGE?" — narrow on
 * purpose, because an over-firing gate is the one people learn to ignore (#148). Correct, and it is
 * NOT a work list: #80, #84, #59 and #60 are all open and none of them trips `saysBroken`.
 *
 * On 2026-08-11 I read a hand-typed list of ~30 open defects to Will while this gate sat GREEN two
 * lines away. Eight of the rows I named had been closed for days; four had never had a register row at
 * all. Will: *"i feel like we already talked about and fixed most of these."* He was right, and it was
 * the SECOND time in one hour I had quoted a stale list — the first was the interaction matrix.
 *
 * The cause was structural, not carelessness: **nothing in this repo printed the open work.** The gate
 * printed a verdict, so the only list that existed was one somebody typed. `engine/open_work.js`
 * prints it now, and it imports these two so the work list and the gate can never disagree about
 * whether a row is closed. */
function roadmapRowIsClosed(l) {
  /* the row's STATUS CELL first — see #148's prescription below — then the prose scan, kept because
   * a row that says it is done in its title and forgets the cell should still drop out. */
  if (/\|\s*(closed|done|page closed)\b[^|]*\|\s*$/i.test(l)) return true;
  /* AND THE CELL WINS IN THE OTHER DIRECTION TOO -- 2026-08-18. This was the CLOSED half of #148's
   * prescription done once and only once: a cell saying `closed` outranked the prose, and a cell
   * saying `open` did not. So the prose fallback below could close a row the register declares OPEN,
   * by matching a `CLOSED 2026-08-11` inside the row's account of a part that IS closed.
   *
   * MEASURED BEFORE CHANGING IT, over all 217 register rows: EXACTLY FIVE verdicts move, every one of
   * them from closed to open, and every one has a status cell beginning with the literal word `open`.
   * THREE OF THE FIVE ASSERT BREAKAGE -- #218, #220 and #224 -- so the open-defect clause has been
   * blind to three live engine-defect rows. #220 is the expensive one: its `-fail` vs
   * `-singleturn|protect` family is 238 games of the 695 in data/game-differential.json, the LARGEST
   * single family in the whole-game differential, sitting in a row the gate could not see. Its head
   * says `CLOSED 2026-08-11` about the WEATHER RESIDUAL half; the row was reopened the next day and
   * its cell has said `open -- engine DEFECT` ever since.
   *
   * The direction is the safe one -- this can only ever make the gate MORE shut -- and it is the same
   * rule as `NOT A DEFECT`: an explicit ruling in the cell outranks a guess over prose. */
  if (/^\s*\(?open\b/i.test(roadmapRowStatusCell(l))) return false;
  const head = l.slice(0, 600);
  /* THE DATED-CLOSURE TOKEN IS THE ONE THAT MUST IGNORE CASE, AND ONLY IT.
   *
   * This register SHOUTS its titles, so the house spelling is `CLOSED 2026-08-11` — and the token was
   * written lowercase with no /i, so the detector could not see the very phrase the rows use. #220 said
   * CLOSED in its own first line, read as OPEN, and it asserts breakage, so it was inflating the
   * MEDICHAM gate with a defect that had been fixed the day before. That is #148's lesson again with
   * LETTER CASE in place of word choice.
   *
   * MEASURED BEFORE CHANGING IT, because the obvious fix — /i on the whole alternation — is WRONG and
   * the measurement is what showed it. Four rows are hidden by case; only two of them are closed.
   * A blanket /i also swallows #33 ("`rollout_r1.js` done, 3 callers left" — three callers left is not
   * done) and #80 (prose "retracted" about a DISPOSITION, not about the row). Widening the whole
   * pattern would have silently closed two live rows, which is the failure this detector exists to
   * prevent, pointed the other way. */
  return /—\s*DONE|DONE,|RETRACTED|GUARDED,/.test(head) || /closed 20\d\d/i.test(head);
}
/* THE BREAKAGE CLAIM IS DECLARED IN THE STATUS CELL FIRST, AND ONLY THEN GUESSED FROM PROSE.
 *
 * #148's own words, quoted in the block below: *"a defect register whose enforcement depends on word
 * choice is a structural weakness"*. That lesson was cashed in for the CLOSED half — `roadmapRowIsClosed`
 * reads the status cell above — and the BROKEN half was left on a vocabulary list. It cost immediately.
 *
 * MEASURED 2026-08-11, before this was wired: ten engine defects were registered off `test-tag-wire`'s
 * own assertions and the clause matched ZERO of them, because the assertions say "does not save",
 * "lands on a Grass type", "hits your own partner", "punishes nobody", "charges a survivor nothing"
 * and "still clickable on turn two". Every one is a mechanic behaving wrongly in a real game. None is
 * in the list. The gate read `clean: the roadmap registers no open row describing a live engine defect`
 * with Focus Sash failing to save at 1 HP sitting in the register two screens above it.
 *
 * So a row now SAYS it is a defect: the token `DEFECT` in its status cell. That cannot drift with
 * phrasing, it is visible to a human reading the table, and it is the same shape as the fix above.
 *
 * THE PROSE SCAN IS KEPT, NOT REPLACED. Every row already carrying the old vocabulary keeps counting
 * with no edit, and a row whose author states breakage plainly in the title but forgets the cell still
 * holds the gate shut. Removing a working clause in the same pass as adding one is how a fix eats a
 * guard — the file says so about `roadmapRowIsClosed` and it is no less true here.
 *
 * IT STILL ERRS SHUT. A row that might be a wrong FIXTURE rather than a wrong ENGINE is marked anyway;
 * the gate reopens when somebody states plainly which it was, which is the correct direction.
 *
 * ================= TWO REPAIRS, 2026-08-15, AND BOTH WERE MEASURED FIRST ==========================
 *
 * The clause read `7 OPEN roadmap row(s) describe a live engine defect`. Audited row by row, TWO of
 * the seven were matched by the PROSE fallback alone and neither describes a defect of any kind:
 *
 *   #266  matched `does not exist` at character 2022 — inside *"`'dampro'` resolves to a row that does
 *         not exist"*, which is the description of a FIXTURE bug this register already CLOSED, and at
 *         5017 inside *"an item that does not exist in Gen 9"*, likewise.
 *   #252  matched `IS DEAD` at character 575 — inside *"Priority into an Armor Tail Farigiraf is dead
 *         only while that Farigiraf is still there"*, which is a METAPHOR for a futile click.
 *
 * That is #148's lesson for the third time in one detector, and the cost is no longer theoretical: a
 * register that overstates its scope costs a whole agent, which is more than the defect it names.
 *
 * REPAIR 1 — THE PROSE FALLBACK READS THE ROW HEAD, NOT THE WHOLE ROW. `roadmapRowIsClosed` above
 * already slices the first 600 characters, for exactly this reason, and the BROKEN half was never
 * given the same treatment. These rows carry thousands of characters of history: quotes, retractions,
 * and descriptions of bugs that were fixed weeks ago. Matching a defect vocabulary against a row's own
 * account of a CLOSED defect is the detector reading its own archive as news. Measured over all 206
 * open rows before the change (LESSONS §4 — print what it matches): exactly ONE verdict moves, #266,
 * and it moves the right way. Nothing that reads broken in its title is affected.
 *
 * REPAIR 2 — `NOT A DEFECT` IN THE STATUS CELL IS AN EXPLICIT RULING AND OVERRIDES THE GUESS. The
 * block above finished the CLOSED half of #148's prescription and left the BROKEN half half-done: a
 * row could DECLARE that it is a defect and had no way to declare that it is not, so the only voice
 * on that side was a guess over prose. #252 is the case — a modelling-soundness note about the search,
 * deferred by Will *"much much later into the project"*, whose cell says `deferred by decision —
 * search` and which asserts nothing about a mechanic being wrong. Err-shut is preserved exactly where
 * it was designed to apply: the file's own words are that an AMBIGUOUS row keeps the gate closed
 * "until somebody states plainly whether the thing is broken". This is how somebody states it.
 *
 * IT IS AN ESCAPE HATCH AND IT IS THEREFORE COUNTED IN PUBLIC. Every use is listed by number on every
 * run of the clause, at zero as well as at seven — the `--accept <file> "reason"` shape from #258, for
 * the same reason: a door into a gate that nobody can see being used is not a door, it is a hole. */
function roadmapRowStatusCell(l) {
  const m = l.match(/\|\s*([^|]*)\|\s*$/);
  return m ? m[1] : '';
}
/* Rows whose cell exercises the override, filled by `roadmapRowSaysBroken` and printed by the clause.
 * Module-level rather than returned, so a caller cannot use the detector and skip the receipt. */
const NOT_A_DEFECT = [];
/* ONE PROSE VOCABULARY, ONE PLACE. It was written out twice — inline in the detector and quoted in
 * the comment above — and this now has a second reader (`notADefectSuppresses`), which is exactly the
 * point at which this repository's own rule applies: two copies of one fact disagree eventually and
 * the disagreement is invisible because both keep working. */
const BREAKAGE_PROSE = /NEVER FIRED|NEVER FIRES|NOT IMPLEMENTED|DOES NOT WORK|DOES NOT ARM|DOES NOT FIRE|UNIMPLEMENTED|silent no-op|IS ABSENT|is not implemented|does not exist|never records|never record|resolve[sd]? to `\{kind:'pass'\}`|HAS NEVER FIRED|IS DEAD/i;
/* ================================================================================================
 * THE RECEIPT OVERSTATED ITS OWN REACH BY 8x — MEASURED 2026-08-27, AND IT IS A DISPLAY BUG.
 * ================================================================================================
 * The clause prints *"N open row(s) declare NOT A DEFECT in their status cell and are excused from
 * this clause"*, and a reader takes that as N rows the override is holding out of the gate. It is
 * not. `\bDEFECT\b` MATCHES INSIDE THE PHRASE `NOT A DEFECT` ITSELF, so the early return fires on
 * every row carrying the phrase — including rows whose only `DEFECT` token is the one inside it, and
 * which would therefore never have counted as broken on their own merits.
 *
 * MEASURED over all 432 register rows (205 open) on 2026-08-27: EIGHT rows carry the phrase in the
 * cell and exactly ONE — #252 — would have counted without it, through the prose fallback matching
 * `IS DEAD` inside a metaphor. The other seven are self-cancelling.
 *
 * NO VERDICT MOVES. `roadmapRowSaysBroken` returns `false` for all eight before and after; the open
 * set, the red set and the clause's pass/fail are byte-identical. What changes is that the receipt
 * says which of the two things it is doing. That distinction matters because the audit trail of an
 * ESCAPE HATCH is the whole reason it is printed: a door reported as being used eight times when it
 * is used once is a door nobody can reason about, which is the same failure as a caption nobody
 * reads. It is reported here as a DISPLAY correction and not as an improvement to the gate. */
function notADefectSuppresses(l, cell) {
  /* strip EVERY occurrence of the phrase, then ask whether an independent claim survives */
  const stripped = String(cell).replace(/NOT A DEFECT/ig, '');
  return /\bDEFECT\b/.test(stripped) || BREAKAGE_PROSE.test(l.slice(0, 600));
}
function roadmapRowSaysBroken(l) {
  const cell = roadmapRowStatusCell(l);
  if (/\bNOT A DEFECT\b/i.test(cell)) {
    const n = (l.match(/^\|\s*#(\d+)/) || [, '?'])[1];
    if (!NOT_A_DEFECT.some(r => r.n === n)) {
      NOT_A_DEFECT.push({ n, cell: cell.trim().slice(0, 90),
                          suppresses: notADefectSuppresses(l, cell) });
    }
    return false;
  }
  if (/\bDEFECT\b/.test(cell)) return true;
  /* THE HEAD, NOT THE ROW — see REPAIR 1 above. The 600 is `roadmapRowIsClosed`'s number, deliberately
   * the same one: two detectors reading the same table must not disagree about where a row's claim
   * stops and its history starts. */
  return BREAKAGE_PROSE.test(l.slice(0, 600));
}

/* ---- THE WHOLE-GAME CLAUSE — WILL, 2026-08-12: "add the whole game comparison to the medicham its
 * part of it and we need to focus on getting that lining up" ---------------------------------------
 *
 * IT WAS MEASURING AND GATING NOTHING, AND THAT IS HOW A 39.6% SAT BESIDE A 0-OF-6000 FOR MONTHS.
 * `data/engine-diff.json` — the clause above — is DAMAGE ONLY, and says so in its own scope line:
 * "no items or abilities. Turn order, status duration and switching need a different harness and are
 * not attempted here rather than attempted badly." `engine/game_differential.js` is that different
 * harness: one team pair, real sheets, real natures, played through BOTH engines with every die pinned
 * identically, first divergence recorded. Nothing read it. I quoted the damage figure for whole games
 * repeatedly until Will asked whether we had ever played the same game on both.
 *
 * THE BAR IS A RATCHET, NOT ZERO, AND THAT IS A DELIBERATE CHOICE AGAINST THE OBVIOUS ONE.
 *
 * Zero is the CORRECT bar in principle — mode A pins every die on both sides, so the two engines are
 * deterministic functions of one input and any difference is a bug, tolerance zero, no statistics. But
 * a clause that will read red for weeks is a clause people learn to skip, and this repo has the
 * receipt: a docs gate sat red for two days and was reported as "one of the two known failures" until
 * the rule it guarded broke. A gate nobody acts on is not a gate.
 *
 * So the clause fails on a RISE. The rate may only go down, the baseline moves with it, and the
 * absolute figure is printed on every run so nobody can mistake a ratchet for a pass.
 *
 * THE TOLERANCE IS DERIVED, NOT PICKED. The swarm re-selects teams between runs, so the denominator
 * moves and two raw counts are not comparable — 408/982 and 570/1556 are the same instrument saying
 * different things. The RATE is comparable and it is a binomial proportion: at n≈1000 and p≈0.33 one
 * standard error is about 1.5 points, so the band is 2 SE computed from the run's own n, and a
 * regression smaller than noise is not a regression. A jump above it is real and holds the gate.
 *
 * AND IT PRINTS EMISSION AND RULE SEPARATELY, because they are two questions added together (#223):
 * one is the engine NARRATING the game differently, the other is it PLAYING the game differently. A
 * single blended percentage is the merged-number failure this file already learned once, when the
 * midpoint residual hid a range wrong at both ends. */
/* ==================================================================================================
 * DIVERGENCES THAT ARE NOT DEFECTS — TWO KINDS, PRINTED APART, NEVER SUMMED.
 * ==================================================================================================
 * Opened 2026-08-18 for ONE kind ("matching the authority would make this engine LESS correct").
 * WIDENED 2026-08-23 for a SECOND kind, on Will's ruling: *"yeah some things we can just quarantine
 * as a known failure with a quoted reason (speed ties, moody, etc)"*, and then, on how to shape it:
 * *"yes we can have two things, impossible to compare, and too difficult and irrelevant to add at the
 * moment."*
 *
 *   AUTHORITY-WRONG  — the authority has a bug and we do not. Reproducing it is not correctness.
 *   INCOMPARABLE     — the authority makes a RANDOM DRAW at an address this harness does not share.
 *                      The two engines therefore disagree BY CONSTRUCTION, about half the time,
 *                      forever. There is no defect and nothing to fix.
 *
 * BOTH KINDS ASSERT "THERE IS NO DEFECT HERE", WHICH IS THE ONLY REASON EITHER MAY BE SUBTRACTED FROM
 * THE DIVERGENCE COUNT. They are printed under SEPARATE HEADINGS with SEPARATE COUNTS because they are
 * different claims and a reader must be able to tell which one is being made.
 *
 * THE THIRD KIND WILL NAMED — *"too difficult and irrelevant to add at the moment"* — IS DELIBERATELY
 * NOT BUILT HERE, and this comment is where that decision is recorded. A DEFERRED row would assert the
 * opposite: that there IS a real defect and we chose not to fix it yet. Such a row must never open this
 * gate, and it must never print under a heading that reads as "no defect", because that is precisely
 * how *"one of the two known failures"* cost this project two days and got the phrase banned in
 * CLAUDE.md. The mechanism for it is proposed in `docs/_reports/2026-08-23-declared-moody-ties.md`, not
 * half-wired in here.
 *
 * AND IT IS FAIL-SAFE AGAINST SOMEBODY TRYING ANYWAY. A row is only subtracted when its `kind` is one
 * of the two in `DECLARED_KINDS` below. A row typed `kind: 'DEFERRED'` — or with a misspelt or missing
 * kind — is counted as UNDECLARED and NAMED on the run, so it holds the gate shut rather than opening
 * it quietly. That is asserted in the selftest.
 *
 * `ok = div === 0` is the right bar and the comment below defends it well: mode A pins every die, so
 * the engines are deterministic functions of one input and every disagreement is a RULE. Will:
 * *"so if its not correct then it shouldnt pass man"*. Nothing here weakens that.
 *
 * WHAT IT DOES NOT COVER is a disagreement where WE ARE RIGHT AND THE AUTHORITY IS NOT. Reproducing a
 * bug in Showdown is not correctness, and a clause that demands zero without an exit for those is
 * asking for something that cannot be delivered — which is exactly what made the open-defect clause
 * endless until it started counting evidence instead of sentences.
 *
 * THE BAR IS DELIBERATELY NARROW, AND "THIS IS HARD" IS NOT ON IT. A row belongs here only when
 * matching the authority would make this engine WORSE, or when the authority's answer HAS NO SHARED
 * ADDRESS to be compared against. It does NOT belong here because the fix is expensive, because
 * nobody has got to it, or because it has been open a long time.
 *
 * THE SECOND KIND HAS ITS OWN NARROW BAR, AND IT IS NOT "THERE IS RANDOMNESS INVOLVED". Mode A pins
 * FIVE dice on both sides — `MID_CATS = ['acc','crit','sec','dmg','stall']` at
 * `engine/game_differential.js:699` — and every other draw the authority makes is unaddressed. An
 * INCOMPARABLE row must name the authority's draw at the line, must show that the draw is not one of
 * those five, and must MATCH ONLY THE DRAW: everything around the draw (its magnitude, its pool, when
 * it fires, what it is allowed to touch) is still a rule the two engines must agree about, and a
 * matcher that shelters any of that is a defect wearing a label exactly like the one below.
 *
 * THE RECEIPT FOR WHY THAT BAR MATTERS IS FRESH. `medicham2-browser.js:17440` carried a DECLARED
 * divergence reading *"rolling per target here would change how much rng every existing seeded run
 * consumes, which is a far larger change than this wire is buying"* — a COST argument. It hid the
 * largest real defect in the engine: Showdown rolls spread accuracy per target and this engine rolled
 * once per move, so Rock Slide (18,122 clicks) and Heat Wave (11,121) could never hit one body and
 * miss the other. At 90 accuracy the exactly-one case is 18% of outcomes and it did not exist here at
 * all. **A declaration whose reason is cost is a defect wearing a label.**
 *
 * Every row prints on every run with its reason, like the closet. A declared count is reported
 * SEPARATELY from the verdict and never folded into it.
 * ================================================================================================ */
/* ROADMAP #258 — every `match` that THREW while classifying a cause. A throw here silently moves the
 * cause into the UNDECLARED pile and inflates the divergence rate this file publishes, so it is
 * recorded and printed beside the declared count rather than absorbed into it. Empty is the claim
 * that every matcher answered. */
const MATCHER_THREW = [];

/* THE SENTENCE THE NARRATION CLAUSE CARRIES ON EVERY RUN, PASSING OR FAILING — see `gates: false` in
 * `narrationClause`'s return. It says the quantity, says it does not block, and says what would make
 * that a lie, because a clause that quietly stopped blocking is exactly what "we'll do narration
 * later" turning into the fourteen stale handoffs would look like from the outside. */
const REPORTS_NOT_GATES =
  ' THIS CLAUSE REPORTS, IT DOES NOT HOLD THE GATE SHUT — Will, 2026-08-22: board-material now,'
  + ' narration as its own separate gate afterwards. The GATING whole-game clause counts'
  + ' BOARD-MATERIAL games (`state.games` less `state.games_board_never_diverged`) and is a different'
  + ' number on the line above this one; do not read the two as one quantity. Narration exits'
  + ' non-zero on its own through `node engine/quarantine.js --narration`.';

/* THE ONLY KINDS THAT MAY BE SUBTRACTED, AND THEIR HEADINGS. A `kind` outside this table is not
 * declared — see the loop in `wholeGameClause`. Keeping the headings HERE, beside the rows, is what
 * makes "which claim is this row making" answerable without reading the printer.
 *
 * ================================================================================================
 * THE THIRD KIND — `CLOSETED` — WILL'S RULING, 2026-08-26, AND IT IS THE ONE THAT ADMITS A DEFECT
 * ================================================================================================
 * Will, 2026-08-26: *"no if i put things into the closet it should not be gated — like illusion"*,
 * and 2026-08-27: *"things in the closet shouldnt block a gate if we know why they fail and choose
 * to accept it."*
 *
 * THE COST OF NOT HAVING IT IS ON THE RECORD. He closeted Tailwind's expiry order on 2026-08-24
 * (*"put it into the closet with that note and move on"*). There was nowhere honest to put it: the
 * two kinds above both assert THERE IS NO DEFECT, and this is a real, deterministic, reproducible
 * divergence that we have chosen not to fix. So it went in as `DEFERRED`, which the guard three
 * hundred lines below deliberately refuses to subtract, and ROADMAP #355 says so in its own words —
 * *"it stays UNDECLARED, red, and named on every run"*. **The instruction was recorded and had no
 * effect for two days.** That is the fourteen-stale-handoffs shape with the owner's own ruling
 * inside it.
 *
 * THE DIFFERENCE FROM `DEFERRED` IS THE OWNER AND THE MEASUREMENT, NOT THE MOOD. `DEFERRED` is what
 * an agent writes when it ran out of time or judged the fix expensive — and *"a declaration whose
 * reason is cost is a defect wearing a label"* is this file's own receipt (the spread-accuracy row
 * at `medicham2-browser.js:17440`, which hid the largest real defect in the engine). `CLOSETED`
 * requires four things a sentence cannot supply, checked by `closetFault` below and refused at the
 * door if any is missing:
 *
 *   closet.by / .on / .ruling / .authority   the OWNER, dated, in his own quoted words, with the
 *                                            register row that carries the account
 *   evidence.instrument / .release / .on     WHAT MEASURED the no-board-effect claim, on which
 *                        / .says             frozen release, when, and what it reported
 *   falsifiedBy                              the observation that would make this entry WRONG
 *   match                                    a matcher narrow enough to name this pair and nothing else
 *
 * WHY A STRUCTURED REASON AND NOT A PROSE ONE. `roadmapRowSaysBroken` tests `/NOT A DEFECT/i`
 * against a register cell, and a phrase anybody can type into a cell is not a ruling. This kind is
 * the same door built the other way round: it cannot be opened by writing a sentence, only by
 * filling in fields that name a person, a date, an instrument and a falsifier.
 *
 * AND IT IS RE-CHECKED, BECAUSE FOUR DECLARATIONS IN THIS PROJECT HAVE BEEN REFUTED — speed ties,
 * Tailwind's own coin, Moody, and a fainted body in an active slot. `evidence.release` is compared
 * against the release the artifact was measured on, on every run, and a mismatch PRINTS. An entry
 * that matched nothing prints too, marked, because a declaration that matches nothing is a claim
 * that has quietly become false — the discipline `tests/roster.js` already applies to its own.
 * ============================================================================================== */
const DECLARED_KINDS = {
  INCOMPARABLE:
    'DECLARED / IMPOSSIBLE TO COMPARE — the authority makes a RANDOM DRAW at an address this harness '
    + 'does not share, so the two engines disagree by construction and always will. NO DEFECT, NOTHING '
    + 'TO FIX:',
  'AUTHORITY-WRONG':
    'DECLARED / THE AUTHORITY IS WRONG — matching it here would make this engine LESS correct, so '
    + 'these do not count:',
  CLOSETED:
    'CLOSETED BY THE OWNER — a REAL, reproducible divergence that the owner has ruled does not matter, '
    + 'on a MEASURED claim that no board state moves. THIS IS A DEFECT WE HAVE CHOSEN NOT TO FIX, NOT '
    + 'AN ABSENCE OF ONE, and it does not vote:',
};

/* THE FOUR FIELDS A `CLOSETED` ROW MUST CARRY, AND THE ONLY PLACE THEY ARE SPELLED.
 *
 * Returns `null` when the row is well formed, or a sentence naming the FIRST fault. A row with a
 * fault is NOT subtracted and is named on the run, exactly like a row typed with an unknown kind —
 * so an entry somebody half-wrote holds the gate shut rather than opening it, which is the safe
 * direction and the one this file errs in everywhere else. */
const CLOSET_REQUIRED = {
  'closet.by': (d) => d.closet && d.closet.by,
  'closet.on': (d) => d.closet && /^20\d\d-\d\d-\d\d$/.test(String(d.closet.on || '')),
  'closet.ruling': (d) => d.closet && String(d.closet.ruling || '').length >= 20,
  'closet.authority': (d) => d.closet && d.closet.authority,
  'evidence.instrument': (d) => d.evidence && d.evidence.instrument,
  'evidence.release': (d) => d.evidence && d.evidence.release,
  'evidence.on': (d) => d.evidence && /^20\d\d-\d\d-\d\d$/.test(String(d.evidence.on || '')),
  'evidence.says': (d) => d.evidence && String(d.evidence.says || '').length >= 20,
  'falsifiedBy': (d) => String(d.falsifiedBy || '').length >= 20,
};
function closetFault(d) {
  for (const k of Object.keys(CLOSET_REQUIRED)) {
    if (!CLOSET_REQUIRED[k](d)) {
      return 'closeted row `' + String(d && d.name) + '` is missing or malformed `' + k + '` — a '
           + 'closet entry is a RULING WITH A MECHANISM, not a sentence. NOT subtracted.';
    }
  }
  return null;
}
/* IS THIS ENTRY'S EVIDENCE OLDER THAN THE ARTIFACT IT IS EXCUSING? Returns null or a sentence.
 * `ctx.release` is the release the artifact under judgement was measured on. A closet entry rests
 * on a measurement taken on ONE release; when the artifact has moved to another, the claim has not
 * been re-checked against the bytes it is now excusing. It still subtracts — the owner ruled — but
 * it says so on every run, at the point of use, in the same block as the subtraction. */
function closetEvidenceStale(d, ctx) {
  if (!ctx || !ctx.release || !d.evidence || !d.evidence.release) return null;
  if (ctx.release === d.evidence.release) return null;
  return 'EVIDENCE NOT RE-CHECKED — the no-board-effect claim was measured on release `'
       + d.evidence.release + '` (' + d.evidence.on + ') and this artifact was measured on release `'
       + ctx.release + '`. The ruling stands; the measurement under it has not been repeated against '
       + 'these bytes.';
}

/* ---- THE EVIDENCE A MATCHER IS ALLOWED TO SEE ----------------------------------------------------
 *
 * A cause string is NORMALISED — `|-boost|p2a|spa|2` — and the normalisation is what strips the very
 * fields a narrow matcher needs: which ability emitted the line, and whether the two bodies were
 * actually speed-tied. Both facts are already in the artifact, measured, on the rows the differential
 * writes for the same cause: `first_divergences` carries the raw pair of lines, and `order_probe`
 * carries `speed_tied` / `speed_gap` / `same_priority` read off the AUTHORITY at the turn boundary.
 *
 * So the matcher is handed them rather than being asked to guess from a normalised string. This is
 * narrowing, not widening: without it the only available Moody matcher is "a +2 boost picked a
 * different stat", which would also swallow a real defect in any other +2 boost in the game.
 *
 * Returns [] for a cause with no rows, and a matcher that requires evidence therefore DECLINES on
 * absence — the safe direction, because an undeclared divergence holds the gate shut. */
function causeEvidence(j) {
  const firsts = new Map(), probes = new Map();
  const push = (m, r) => {
    const k = String((r && r.cause) || '');
    if (!k) return;
    const a = m.get(k); if (a) a.push(r); else m.set(k, [r]);
  };
  for (const r of (Array.isArray(j && j.first_divergences) ? j.first_divergences : [])) push(firsts, r);
  for (const r of (Array.isArray(j && j.order_probe) ? j.order_probe : [])) push(probes, r);
  return (cause) => ({ firsts: firsts.get(cause) || [], probes: probes.get(cause) || [] });
}

/* `parseBoostEvent` and `MOODY_POOL` lived here and were REMOVED WITH THE MOODY ROW on 2026-08-25 —
 * they had exactly one caller, its matcher, and a helper kept alive after its premise is refuted is
 * an invitation to rebuild the same declaration. The pool derivation they carried is preserved in
 * the withdrawal note below, where it is still true and no longer load-bearing. */

const DECLARED_DIVERGENCE = [
  /* ~~`Outrage's random re-target`~~ — PROPOSED 2026-08-27 AS `INCOMPARABLE`, **REFUSED THE SAME HOUR
   * BEFORE IT WAS EVER WRITTEN AS A ROW, BECAUSE ITS MECHANISM IS THE MOODY MECHANISM AND THAT ONE
   * WAS MEASURED FALSE TWO DAYS AGO.** Left here as a comment on this file's own standing rule — a
   * closet that silently loses rows teaches nobody, and a refusal nobody can find gets re-proposed.
   *
   * WHAT WAS PROPOSED, AND IT IS PLAUSIBLE, WHICH IS THE PROBLEM. One of the 18 raw whole-game
   * divergences on release `6272fa445b73` is `-damage: a different body :: |-damage|p2a|H/H <>
   * |-damage|p2b|H/H` (`...2635122796 vs ...2634861011`, turn 2). The authority's line before it is
   * `|move|p1b: Garchomp|Outrage|p2a: Staraptor` and medicham2 hit p2b instead. Outrage is
   * `randomNormal` (DERIVED: `Dex.forFormat('gen9championsvgc2026regmb').moves.get('outrage').target`),
   * so which foe it hits in a double IS a draw. The differential had ALREADY VOIDED that game —
   * `mid_void.by_reason.low-identity: 1`, `by_reason_detail['low-identity'] = {games: 1, diverged: 1}`,
   * and every unshared address in the run is an `outrage` one (`unshared_address_field`:
   * `target differs (acc|outrage)`, `(crit|outrage)`, `(dmg|outrage)`, one each). The accounting closes
   * exactly: 18 raw - 5 declared = 13 = 12 usable + 1 void, against `usable_games 960` /
   * `diverged_among_usable 17`. All of that is TRUE and none of it makes the divergence incomparable.
   *
   * WHY IT IS NOT INCOMPARABLE. The bar in the header above is that the authority draws at an address
   * THIS HARNESS DOES NOT SHARE. It shares this one. Traced, not assumed:
   *
   *   authority   sim/battle.ts:2461 gates the named-target branch OFF for `randomNormal` and falls to
   *               :2484 `getRandomTarget` -> sim/side.ts:367 `randomFoe()` -> `battle.sample(actives)`
   *               -> sim/prng.ts:136 `const index = this.random(items.length)`. `this` is the PRNG and
   *               `battle.prng.random` IS REPLACED — engine/game_differential.js:3009 — so the draw
   *               goes through `pinRandom` -> `midDraw('any')` -> `midCtx([MID_SEED, turn, cat, move,
   *               target])` at :1072, hashed by `midValue` at :791 off `MID_SEED = 20260813` at :783.
   *   medicham2   WIRE 144 at engine/medicham2-browser.js:20043 draws `rng()` — the GENERIC `any`
   *               stream — and indexes `_rlive[Math.floor(rng()*_rlive.length)]` at :20046, addressed
   *               by `midEventBase` at :18411 off `MID_EVENT_SEED = 20260813` at :18333, the same
   *               constant and the same FNV-1a.
   *
   * ONE STREAM, ONE SEED, ONE HASH, AND EVEN THE INDEX MAPPING MATCHES: `pinRandom(2)` returns
   * `Math.floor(u*2)` and medicham2 computes `Math.floor(u*2)`, over lists in the same slot order
   * (`side.foes()` is `foe.allies()`, alive-filtered in position order; `live(actB)` likewise). **If
   * the two addresses matched, the two engines would pick the same body deterministically.**
   *
   * SO WHAT ACTUALLY DIVERGES IS THE ADDRESS, AND IT IS OURS. Showdown resolves the target on the
   * FIRST working line of `runMove` — sim/battle-actions.ts:223 `getTarget(...)` — which is ABOVE
   * `setActiveMove` at :245, with `battle.activeMove` and `battle.activeTarget` still nulled by the
   * previous action's `clearActiveMove()` at sim/battle.ts:2828. Its address is therefore
   * `20260813|<turn>|any|-|-|<nth>`. medicham2 writes `MID_MOVE` / `MID_TGT` at :19878-19880, above
   * the WIRE 144 draw at :20043, so its address is `20260813|<turn>|any|outrage|<named slot>|<nth>`.
   *
   *     authority     20260813|2|any|-|-|0
   *     this engine   20260813|2|any|outrage|p20|0
   *
   * That is BYTE FOR BYTE the diagram in the Moody note sixty lines below, which is the same diagram
   * in `medicham2-browser.js:18349`. `midClearActiveMove()` was added at :19800 to fix exactly this
   * class and it runs BEFORE the write at :19878, so it does not reach a draw taken after it. The
   * repair is to address the `randomTarget` re-roll where the authority takes it — with the move and
   * target fields still cleared — not to exempt it.
   *
   * WHY THE ARM DID NOT CATCH IT AND WHY THAT IS NOT A LICENCE. `engine/game_differential.js:919`
   * `const OUT = new Set(['acc','crit','sec','dmg','stall'])` keeps the `any` bucket out of the
   * identity computation, and `midWrapShowdown` names a category only inside `hitStepAccuracy`,
   * `secondaries` and `getDamage` (:1023-1025), so this draw is `any` by construction. **Excluded
   * from the CHECK is not the same claim as unshared.** The check declining to look is why the two
   * engines' target picks were never compared directly; what surfaced instead is the CONSEQUENCE —
   * every downstream `acc`/`crit`/`dmg` address carrying a different `target` field, which is what
   * dropped the overlap under `MID_OVERLAP_FLOOR` and voided the game.
   *
   * WHAT WOULD FALSIFY THIS REFUSAL, stated so it is testable rather than argued: print both engines'
   * `any` address logs for this seed pair at turn 2. If the authority's Outrage target draw carries a
   * move or target field medicham2 cannot construct — or if the two lists of living foes are ordered
   * differently — then there is genuinely no shared address and the row may be written. Today the two
   * addresses differ only in fields THIS ENGINE fills in and the authority has deliberately emptied.
   *
   * FILED, NOT DECLARED: ROADMAP #467. The game stays UNDECLARED and holds the gate shut, which is the
   * safe direction and the correct one — it is board-material (`DIFFERENT-END-STATE`, board parts at
   * turn 2) and it is one of only four board-material games in the run. */
  /* ~~`Moody's stat pick`~~ — DECLARED 2026-08-23 AS `INCOMPARABLE`, **WITHDRAWN 2026-08-25 BECAUSE
   * ITS MECHANISM WAS REFUTED BY MEASUREMENT.** Left as a comment, like the speed-tie and drag rows
   * below and above, because a closet that silently loses rows teaches nobody.
   *
   * WHAT IT CLAIMED. That the authority's residual `sample()` "belongs to no named category on either
   * side, so both engines take it off the GENERIC `any` stream at an occurrence index each engine
   * populates with its own unrelated draws" — therefore no shared address, therefore disagreement by
   * construction, therefore nothing to fix. Will waived it by name on that reasoning.
   *
   * WHAT WAS ACTUALLY WRONG. The `any` stream WAS shared. The ADDRESS ON OUR SIDE WAS NOT. The middle
   * arm keys both engines' dice on `seed|turn|category|move|target|nth`; the authority's `move`/
   * `target` come off `battle.activeMove`/`battle.activeTarget`, and it NULLS BOTH after every action
   * (`sim/battle.ts:2828`) and again at the top of the residual (`:2810`, `clearActiveMove(true)`,
   * which runs BEFORE `fieldEvent('Residual')` and therefore before Moody draws). `medicham2-browser.js`
   * wrote `MID_MOVE`/`MID_TGT` at the top of each action and never cleared them, so every end-of-turn
   * die was addressed with a move name that had already finished:
   *
   *     authority     20260813|1|any|-|-|0
   *     this engine   20260813|1|any|curse|p20|0
   *
   * Two addresses that cannot match are two independent dice. The die was private BECAUSE THE ADDRESS
   * WAS OURS AND IT WAS WRONG, not because the authority's draw is unaddressable. The row's own text
   * said the exit condition out loud — *"give the residual pick a named stream on both sides ... and
   * this row must be deleted rather than kept"* — and that is what happened.
   *
   * THE EVIDENCE, derived from the committed artifacts rather than recalled. Same 961 games, same
   * pool, `wholeGameClause` run over each:
   *
   *     0447cd1 (rel ffdec64bed0c, pre-fix)   35 raw   declared 13 = INCOMPARABLE 8 + AUTH-WRONG 5
   *     382e998 (rel cbf345e56bc0, post-fix)  28 raw   declared  5 = INCOMPARABLE 0 + AUTH-WRONG 5
   *     65a9c5c (rel 359b51b61d83, HEAD)      28 raw   declared  5 = INCOMPARABLE 0 + AUTH-WRONG 5
   *
   * The eight games were 7 causes: 6 x `-boost field 3` and 2 x `-unboost field 3`. After the address
   * fix ZERO games carry either shape. Six stopped diverging outright; two now part on a DIFFERENT
   * cause — `|-immune|p1a <> |-miss|p2b|p1a` and `|switch|p1a|krookodile <> |detailschange|p1b|
   * charizardmegay`. **So the declaration was sheltering two real defects that nothing could see while
   * it stood.** Knob `MEDI_ACTIVE_MOVE_STICKY=1` restores the leak, so the red is reproducible.
   *
   * WHAT WAS NEVER IN DISPUTE, and is recorded here so it is not re-litigated: Moody's rule. The
   * authority (`data/abilities.ts:2691-2716`) takes two `sample()` draws over the five main stats only
   * — both loops `continue` on accuracy and evasion — and this engine implements that. The withdrawn
   * matcher's negative boundary (a wrong magnitude, accuracy or evasion in the pool, a boost the
   * authority attributes elsewhere, a boost that follows the same slot clicking a move) is now simply
   * the default: every one of those is UNDECLARED and holds the gate shut, which is what the selftest
   * ratchet asserts.
   *
   * THE GENERAL LESSON, and the reason this note is long: a declaration is only as good as its
   * mechanism, and this mechanism was never independently checked. It is the fourth "nothing to fix
   * here" in three days that turned out to be a real defect — speed ties, Tailwind twice, now Moody.
   * A plausible reason typed beside a citation reads exactly like a measured one. */
  /* ~~`Speed tie / the tie-break coin flip`~~ — WRITTEN, THEN REFUSED THE SAME HOUR, 2026-08-23, AND
   * LEFT HERE AS A COMMENT BECAUSE A CLOSET THAT SILENTLY LOSES ROWS TEACHES NOBODY.
   *
   * The case for it is true about the GAME and false about this HARNESS, and only the harness's number
   * reaches this clause. Yes, `sim/battle.ts:429` speedSort ends in `prng.shuffle(list, sorted, sorted
   * + nextIndexes.length)` at :455-457 and a real speed tie is an actual coin flip. But the whole-game
   * differential does not run real dice on that coin, on EITHER side:
   *
   *   - Showdown's shuffle is replaced by a NO-OP in every shipped arm (`pinShuffle`,
   *     `sdShuffleReverses` false everywhere) — engine/game_differential.js:1085;
   *   - medicham2's tied-group key has had ITS OWN NAMED STREAM since 2026-08-20, `RNG_STREAMS =
   *     ['acc','crit','sec','dmg','stall','tie']` (medicham2-browser.js:15613), and the middle arm
   *     neutralises it to a constant — `o.tie = () => 0` at game_differential.js:1182 — precisely so
   *     it mirrors the no-op on the other side;
   *   - and the tie was FIXED AT THE ROOT in 3.74.0: medicham2 runs the authority's own selection sort
   *     and resolves the residual group with the key it already drew, which is why the two
   *     `tie-second` arms were RETIRED for "breaking a correct one" (game_differential.js:1229-1256).
   *
   * SO THE SIXTH DIE THIS DECLARATION WOULD CLAIM DOES NOT EXIST IS ALREADY SHARED. A cause that still
   * diverges with both tie-breaks pinned is a real disagreement — a queue built in a different order,
   * or a speed the probe read as equal at the turn boundary that was not equal when the queue was
   * built (the probe's own artifact calls an EQUAL reading weak evidence for exactly that reason).
   * Declaring it would subtract a live turn-order defect under a heading that reads "nothing to fix",
   * which is the `medicham2-browser.js:17440` failure — a declaration that hid per-target spread
   * accuracy for weeks — repeated with a better-sounding reason.
   *
   * MEASURED, so it is a number and not a worry: 3 of this run's `ordering` causes carry an order
   * probe reading `speed_tied: true, speed_gap: 0, same_priority: true`. They stay UNDECLARED and are
   * proposed as a roadmap row instead. Will's ruling was about the GAME (*"we know the sps and natures
   * and exact speeds ... its just when we play showdowns games we have ties"*) and it is right about
   * the game; it does not reach this artifact, and MEASURE's job is to say so rather than to spend
   * it. */
  {
    kind: 'AUTHORITY-WRONG',
    name: "Supreme Overlord `fallenundefined`",
    match: (c) => /fallenundefined/.test(c),
    why: "THE AUTHORITY IS WRONG AND THE LINE IS INVISIBLE. `data/abilities.ts` guards supremeoverlord's "
       + "onStart on `pokemon.side.totalFainted` and does NOT guard its onEnd, so when nothing has fainted "
       + "`effectState.fallen` is never set and the template emits the literal string `fallenundefined` on a "
       + "`[silent]` line players never see. The ABILITY is correct — onBasePower is guarded and the "
       + "multiplier table is right. Reproducing a typo is not correctness.",
  },
  /* ================================================================================================
   * THE PERISH DRAIN'S POSITION — THE CLOSET'S FIRST SHIPPING ROW, 2026-08-28.
   * ================================================================================================
   * The comment below this one said *"the closet ships empty and prints empty"* and that was true for
   * two days. It is not true any more, and the entry underneath is the reason. Read that comment for
   * the discipline it teaches — THE FIRST QUESTION IS WHETHER THE DIVERGENCE IS STILL THERE — because
   * this row was written only after asking it: the cause is live in `data/game-differential.json`
   * generated 2026-08-28T19:30:53Z on release `5f3f7141227c`, one game of 961, and the matcher below
   * was run against that artifact before it was wired.
   *
   * WHAT DIVERGES, IN ONE SENTENCE. A residual in which Perish Song's counter reaches `perish0` owes a
   * faint; the authority writes `|upkeep` and then the faint, and this engine writes the faint and then
   * `|upkeep`. The row in the artifact:
   *
   *     config    baseline
   *     seed      gen9championsvgc2026regmbbo3-2654016071 vs gen9championsvgc2026regmbbo3-2654363031
   *     turn      11        index 171        agreed_lines 171
   *     showdown  |upkeep
   *     medicham  |faint|p2b: Gengar
   *     before    |-start|p2b: Gengar|perish0   |-start|p1b: Staraptor|perish0   |-start|p1a: Glimmora|perish0
   *
   * IT IS NARRATION AND NOT STATE, AND THE RECEIPT IS A COMPARED LEAF RATHER THAN AN ABSENT ONE. That
   * qualifier is the whole of the claim: ROADMAP #528 measured that 43 of the 80 leaves a legal
   * mechanic can write are in NEITHER the compared set nor `NOT_COMPARED`, so "no board differs" can
   * mean "nobody looked". Here somebody looked. `fainted` — with `hp`, `maxhp` and `status` — is read
   * off both engines for the ACTIVE bodies (`board_state.js:866`), for the PARTY (`:1034`) and for the
   * benched group (`:769`, `:843`), and `statusOf` maps a corpse to `fnt` in both engines precisely so
   * that a body dead on one side and alive on the other cannot hide. On this run: 12,445 turn
   * boundaries compared and 12,445 identical, `games_board_never_diverged` 961 of 961,
   * `protocol_diverged_games` 6 and `protocol_diverged_board_never_did` 6. Gengar is dead in both
   * engines at the boundary, at the same HP, and the difference is WHERE THE LINE IS PRINTED.
   *
   * IT WAS TRIED, TWICE, AND THE SECOND ATTEMPT IS WHY THIS IS ONE GAME AND NOT A FAMILY. ROADMAP #440
   * filed it on 2026-08-24 as BLOCKED on the residual handler list this engine did not have. The
   * 2026-08-26 card-8 pass built that list: `residualFollowerRuns` (medicham2-browser.js:6838) derives
   * the 58 rows that sort after `perishsong@24.2` from `data/residual-order.json` by CALLING
   * `Battle#resolvePriority`, splits them 18 always-expires / 14 handlers / 26 clocks, and answers
   * whether anything survives the walk — with three over-fire controls (Protect, Tailwind, Pickup) and
   * a knob, `MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1`, that puts the old unconditional drain back. The bare
   * arm went green and THIS SAME SEED PAIR moved from turn 4 to turn 11, which is where it now sits.
   *
   * WHAT IS LEFT IS THE PREDICATE DISAGREEING ON ONE BOARD, AND IT IS NOT BLIND — `MEDFAILS`
   * `.residualFollowerUnmapped` is empty on this build, so every clocks row has a reader. On this board
   * the authority's walk ends with nothing surviving and ours believes something does. WHICH follower
   * is UNDIAGNOSED: naming it needs the game replayed with both handler lists printed, which is a run
   * this pass was not permitted to start. That is stated rather than guessed at, because a plausible
   * reason typed beside a citation reads exactly like a measured one — this file's own receipt, four
   * declarations refuted.
   *
   * SO IT IS `CLOSETED` AND NOT `AUTHORITY-WRONG` AND NOT `INCOMPARABLE`. The authority is right; the
   * draw is shared; we are wrong and we have chosen not to fix it. That is the one thing this kind is
   * for and the only kind that admits it.
   *
   * THE MATCHER IS NARROWED BY EVIDENCE, NOT BY THE STRING. `|upkeep <> |faint|pXY` on its own would
   * cover every residual faint in the game — leech seed, poison, sandstorm, curse, salt cure. It is
   * therefore required to be a PERISH drain, read off `showdown_before` on every first-divergence row
   * carrying the cause, and it DECLINES when the evidence is absent (the safe direction, and the reason
   * it cannot reach `data/all-mechanics-fire.json`, whose evidence adapter carries no
   * `showdown_before` at all). The class prefix is deliberately NOT pinned: this cause was filed as
   * `ordering ::` in #440 and the classifier calls it `event missing from medicham2 ::` today, and
   * pinning a classifier's label would make the exemption evaporate on a rename rather than on a fix. */
  {
    kind: 'CLOSETED',
    name: 'the perish drain sits above `|upkeep|` when the authority puts it below',
    match: (c, ev) => {
      if (!/ :: \|upkeep <> \|faint\|p[12][ab]$/.test(String(c || ''))) return false;
      const rows = (ev && ev.firsts) || [];
      /* NO EVIDENCE IS A DECLINE, NEVER A MATCH — `causeEvidence`'s own contract. */
      if (!rows.length) return false;
      return rows.every((r) => Array.isArray(r.showdown_before)
        && r.showdown_before.some((l) => /^\|-start\|p[12][ab][^|]*\|perish0$/.test(String(l))));
    },
    why: 'A REAL DEFECT, OURS, AND THE POSITION OF A LINE RATHER THAN THE STATE OF A BOARD. '
       + "`perishsong.condition.onEnd` is `add('-start', target, 'perish0'); target.faint()`, and "
       + '`Pokemon#faint()` only QUEUES — the line is written by a `faintMessages()`. `fieldEvent`\'s '
       + 'duration-expiry branch `continue`s past the one at sim/battle.ts:565, so the deaths are paid '
       + 'by the next handler that does not itself expire, and when none does they fall to the tail of '
       + '`runAction` at :2832, EIGHTEEN LINES BELOW the `|upkeep|` written at :2814. This engine\'s '
       + '`residualFollowerRuns` decides the same question from a derived handler list and answers '
       + "TRUE on this one board where the authority's walk answers false. One game of 961, turn 11.",
    closet: {
      by: 'Will',
      on: '2026-08-28',
      authority: 'ROADMAP #440',
      ruling: 'STANDING RULE, 2026-08-27, verbatim: "things in the closet shouldnt block a gate if we '
            + 'know why they fail and choose to accept it." APPLIED TO THIS ROW 2026-08-28 — Will '
            + 'authorised closing the last open MEDICHAM gate clause by declaring this divergence, '
            + 'with a note saying we could not make it work. THE 2026-08-28 AUTHORISATION IS RELAYED '
            + 'THROUGH THE COORDINATOR AND IS RECORDED AS RELAYED, NOT DRESSED AS A QUOTATION; the '
            + 'sentence in quotation marks is the 2026-08-27 standing rule and nothing else is quoted.',
    },
    evidence: {
      instrument: 'engine/game_differential.js (arm middle, pins ccb365985023, --team-store '
                + 'data/team-pool-frozen, cap 12, 961 games), comparing boards through '
                + 'engine/board_state.js',
      release: '5f3f7141227c',
      on: '2026-08-28',
      says: '12,445 turn boundaries compared and 12,445 IDENTICAL; games_board_never_diverged 961 of '
          + '961; protocol_diverged_games 6 and protocol_diverged_board_never_did 6; '
          + 'first_board_divergences []. The leaf a real faint difference would move is COMPARED and '
          + 'agreed — `fainted` with `hp`/`maxhp`/`status` on the active bodies (board_state.js:866), '
          + 'the party (:1034) and the bench (:769, :843) — so this is a leaf that was looked at, not '
          + "one of ROADMAP #528's 43 leaves in neither list.",
    },
    falsifiedBy:
      'ANY of: (a) the pair appearing on a first-divergence row whose `showdown_before` carries no '
    + '`perish0`, which would mean the exemption has spread to a different residual drain; (b) the '
    + 'board claim failing — `state.games_board_never_diverged` below `state.games`, or '
    + '`protocol_diverged_board_never_did` below `protocol_diverged_games`, or a non-empty '
    + '`state.first_board_divergences`; (c) `MEDFAILS.residualFollowerUnmapped` becoming non-empty, '
    + 'which would mean the predicate is BLIND to a follower rather than merely wrong about one board, '
    + 'and makes this a bigger claim than one game; (d) the cause reaching more than the single game '
    + 'measured here. Any one of those and this row comes out and #440 goes back on the gate.',
  },
  /* ~~`Tailwind's expiry order` — THE ROW THE `CLOSETED` KIND WAS BUILT FOR, AND IT IS NOT WRITTEN,
   * BECAUSE THE DEFECT WAS FIXED BEFORE THE DOOR WAS FINISHED.~~
   *
   * Will closeted it on 2026-08-24 (*"tailwind coming out in the wrong order doesnt matter, put it into
   * the closet with that note and move on"*) and it went in as `DEFERRED`, which this list refuses to
   * subtract by design — so the instruction had no effect for two days and ROADMAP #355 recorded the
   * refusal in its own cell. `CLOSETED` above is the door that instruction needed. **It opened onto an
   * empty room until 2026-08-28** — see the perish-drain row directly above, which is the first thing
   * ever to ship through it. The rest of this comment is dated 2026-08-27 and is left standing as
   * written, because a dated finding is not rewritten in place; read "SHIPS EMPTY" below as "shipped
   * empty on 2026-08-27, for the reason given, and that reason still holds for TAILWIND".
   *
   * MEASURED BEFORE WRITING THE ROW, WHICH IS THE ONLY REASON IT WAS NOT WRITTEN. ROADMAP #493 closed
   * on 2026-08-27: ENGINE rebuilt the authority's residual handler LIST as a shadow, whole-game went
   * 13 -> 11 of 961, and `data/game-differential.json` on release `f3d423e19e88` holds SIX causes, none
   * of them a `-sideend` / `tailwind` pair. The cause this entry would match does not occur. Writing it
   * would have registered a permanent exemption for a divergence that no longer exists — a declaration
   * that matches nothing, which is the claim `tests/roster.js` calls "quietly become false" and which
   * the register printer below now names on every run for exactly this reason.
   *
   * SO THE CLOSET SHIPS EMPTY AND PRINTS EMPTY. That is the honest state, not a gap: the gate's clause
   * count is unchanged by this kind existing, and any later reader looking for the Tailwind exemption
   * finds this comment instead of an exemption. Left here rather than deleted, because a closet that
   * silently loses rows teaches nobody — and because the next person to closet something needs to see
   * that the FIRST question is whether the divergence is still there. */
  /* ~~`Bitter Malice` and `Night Daze` — proposed 2026-08-28 as the closet's first two entries.~~
   * **REFUSED, AND THE REFUSAL IS THE FINDING: BOTH ROWS ARE ALREADY SHELVED BY A MECHANISM THAT
   * DERIVES, AND A SECOND EXEMPTION WOULD HAVE MATCHED NOTHING.**
   *
   * WILL'S RULING IS REAL AND IT IS NOT WHAT WAS MISSING. 2026-08-28: *"we put illusion and zoroark
   * into the closet cause its too ahrd to deal with"*, and *"bitter malice and night daze are only
   * learned by zoroark i believe, which we put in the closet"*, against the earlier general rule
   * *"things in the closet shouldnt block a gate if we know why they fail and choose to accept it"*.
   * ROADMAP #160 (Will, 2026-08-11) already declares Illusion closet material. Every word of that is
   * right. What it asks for was built nine days before it was asked for, and asking this list for it
   * a second time would have produced a permanent exemption that fires on nothing.
   *
   * THE PREMISE, DERIVED RATHER THAN ACCEPTED — and the first derivation of it was WRONG, which is
   * why this paragraph cites the validator. Walking prevo/`baseSpecies` chains by hand reported
   * Zoroark-Hisui as a Night Daze learner (it inherits nothing of the kind). The authority on move
   * legality is `TeamValidator`, run over all 347 legal species of
   * `gen9championsvgc2026regmb` filtered `exists && !isNonstandard && tier !== 'Illegal'`:
   *
   *     Bitter Malice  ->  Zoroark-Hisui   1 legal learner
   *     Night Daze     ->  Zoroark         1 legal learner
   *
   * and both carriers hold `{"0":"Illusion"}` — ONE ability, no second slot — and are the ONLY two
   * legal Illusion carriers in the regulation. So the harness cannot stage either move on a body
   * without Illusion. That is stronger than "the carrier happens to have Illusion": there is no
   * fixture in which these rows could have parted for any other reason.
   *
   * THE DIVERGENCE IS ILLUSION, MEASURED AND NOT INFERRED FROM THE CAUSE STRING. On release
   * `aea838766e7f` (`data/all-mechanics-fire.json`, generated 2026-08-28T05:56:07Z) both rows part at
   * index 0 on `switch: a different body`, and the two lines carry the SAME HP under DIFFERENT NAMES:
   *
   *     showdown   |switch|p1a: Blastoise|Blastoise, L50|780/780
   *     medicham2  |switch|p1a: Zoroark|zoroark-hisui, L50|780/780
   *
   * A disguise name over the true body's HP is Illusion's signature and nothing else's — a genuinely
   * different body would carry a different maximum.
   *
   * AND THE NO-BOARD-EFFECT CLAIM IS EARNED, WHICH IS THE FIELD THAT MAY NOT BE FUDGED. Both rows:
   * `board.verdict = ANNOUNCEMENT-ONLY`, `boundaries 4 / boundaries_agreed 4`,
   * `boards_after_the_parting 4`, `state_parted_on_turn null`, `diffs []`, 402 leaves compared on each
   * side, `uncomparable_leaves []` and `core_leaf_unchecked false` — so the verdict is not resting on
   * a leaf nobody looked at, which is the qualifier that would have voided it. That verdict is
   * defended by a state plant with a control (`all_mechanics_fire.js`, plant 6), so it is a
   * comparison shown to catch a silent state difference rather than one assumed to.
   *
   * SO WHY REFUSE. Because the subtraction already happens, twice over, and neither path reaches this
   * list:
   *   - `all_mechanics_fire.js` stamps `deferred = ILLUSION_SHELF` on any row whose carrier is in
   *     `GD.CLOSET_SPECIES` — derived from the ABILITY, not from a name list — so both rows already
   *     carry `counts_against_the_gate: false` and are already out of `summary[kind].diverged`
   *     (`diverged 6` against `diverged_including_shelved 8`);
   *   - `classifyMechanics` skips a `deferred` row BEFORE it asks `declaredMatch`, so a CLOSETED row
   *     written here could not be consulted even if it matched;
   *   - and `game_differential.js` drops every team carrying a legal Illusion body from the pool
   *     before pairing (43 teams this run), so the whole-game clause holds ZERO zoroark causes — its
   *     six are five `fallenundefined` and one faint.
   * Measured before and after on release `aea838766e7f`: GATE CLOSED, 2 of 8 clauses fail, whole-game
   * 1 of 961, mechanics 2 of 9 — IDENTICAL. A row here would have moved nothing and would have joined
   * the register as a declaration that matches nothing, which this file's own printer names on every
   * run because such a claim has quietly become false.
   *
   * WHAT WAS ACTUALLY MISSING, AND IS NOW FIXED, IS THE ACCOUNTABILITY AND NOT THE EXEMPTION. The
   * mechanics clause printed the owner's shelf as the bare integer `4 shelved by the owner` — no
   * names, no ruling, no falsifier — while the DECLARED register beside it printed every row that
   * MAY subtract whether or not it did. A fifth shelf entry could have appeared and nothing would
   * have said so. `SHELVED BY THE OWNER` now names each row, its carrier, its cause, its board
   * verdict and the dated ruling, and compares the derived count against the artifact's own summary.
   *
   * FALSIFIED BY — write it so a later run can check it rather than argue it: **a divergence on
   * `bittermalice` or `nightdaze` that Illusion does not explain.** Concretely, any of — the row
   * parting at an index other than the opening `switch` line; the two `|switch|` lines disagreeing on
   * HP as well as on name; `board.verdict` moving off `ANNOUNCEMENT-ONLY`, or holding it with
   * `core_leaf_unchecked true` or a non-empty `uncomparable_leaves`; `TeamValidator` admitting a
   * legal learner whose ability set is not `{"0":"Illusion"}`; or `GD.CLOSET_SPECIES` ceasing to
   * contain the staged carrier. Any one of those means the shelf is covering a move defect and both
   * rows must come off it. */
  /* ~~`drag: a different body` — declared 2026-08-18 as "not a rule, a bench index".~~ **WITHDRAWN THE
   * SAME DAY, ON WILL'S BAR.** The reasoning was sound about MECHANISM and wrong about CONSEQUENCE:
   * `sim/battle.ts` getRandomSwitchable takes `this.sample(canSwitchIn)` over `side.pokemon` order, the
   * authority deterministically takes one index under the pinned die and this engine takes another, and
   * nothing about phazing is in dispute. But the bar is *"good enough that when miltank uses it, it
   * wouldnt affect any decisions"* — and A DIFFERENT BODY ARRIVING ON THE FIELD IS A DIFFERENT POSITION.
   * Every decision after it is taken against a board the authority does not have. That is the largest
   * decision impact a divergence can have, not the smallest.
   *
   * It was never a claim that the authority is WRONG, which is the only thing this list is for. It is an
   * alignment gap between two benches, and it belongs on the decision-impact axis where a paired argmax
   * run can price it — or in the harness's pin, where it can be removed. Left here as a comment rather
   * than deleted, because a closet that silently loses rows teaches nobody, and because "declared" is a
   * third axis that must not become a dumping ground for the two real ones. */
];

/* ================================================================================================
 * ONE DOOR ONTO THE DECLARED LIST — 2026-08-26
 * ================================================================================================
 * `DECLARED_DIVERGENCE` had exactly ONE reader: the loop inside `wholeGameClause`. So the Supreme
 * Overlord row was subtracted from the whole-game count and COUNTED AS A DEFECT by
 * `classifyMechanics` on the same run, off the same declaration, on a cause string in the same
 * grammar. `tests/test-mechanics.js` carried a live probe asserting we refuse that line deliberately,
 * `wholeGameClause` agreed with the probe, and the mechanics clause did not — one declaration, two
 * verdicts, and nothing said so. That is the two-implementations-of-one-fact failure CLAUDE.md names
 * by its own casualty, arriving as an ABSENT reader rather than a duplicated one.
 *
 * THE FIX IS A FUNCTION, NOT A SECOND COPY OF THE LOOP. Both clauses call `declaredMatch`, so the
 * matching rule, the throw handling and the `DECLARED_KINDS` whitelist exist once. A row added
 * tomorrow is honoured by both because neither clause knows what is in the list.
 *
 * ---- WHAT STILL WALKS PAST THIS DOOR, NAMED RATHER THAN IMPLIED ---------------------------------
 *
 * A gate built from an instance catches that instance, not the class. These are the readers that do
 * NOT consult the declared list today, each with the reason it is out of scope rather than pending:
 *
 *   - `differentialClause` (data/engine-diff.json) — damage-table rows carry attacker / move /
 *     defender and two NUMBERS, not a `|line <> |line` cause. There is no string for a matcher to
 *     read, so a damage-roll declaration would need its own evidence shape. NOT SUPPORTED: a
 *     declaration about a damage row would be silently ignored here.
 *   - the three `rosterStage` clauses — they compare OUR TWO ENGINES to each other, so "the authority
 *     is wrong" cannot arise; their exemption axis is `DEFERRED-BY-OWNER` and it is separate on
 *     purpose. An INCOMPARABLE row could in principle apply and would be ignored.
 *   - `orderProbeClause` — its rows DO carry `cause`, and it counts every unequal-speed/same-priority
 *     pair whether or not the cause is declared. Inert today (this run probed 0 pairs and no live row
 *     is an ordering row); it is the nearest thing to the next instance of this bug.
 *   - `coverageClause` asks whether an instrument measures a mechanic, not whether it agrees, and
 *     `openDefectClause` reads register sentences. Neither has a cause string; both are out of scope.
 *   - `engine/all_mechanics_fire.js` writes `summary[k].diverged` knowing nothing about declarations,
 *     and that is deliberate: a filter may only ever SUBTRACT from a number a reader can still see.
 *     The headline stays 16 and the subtraction is printed beneath it.
 *
 * `SHOWDOWN-ONLY` IS A VERDICT NO CLAUSE READS, AND THAT IS RECORDED HERE RATHER THAN FIXED.
 * `classifyMechanics` filters on `diverged` / `deferred` and never looks at `verdict`, so the eight
 * SHOWDOWN-ONLY ability rows are handled correctly BY ACCIDENT. Out of scope for this batch.
 * ================================================================================================ */

/* `threw` IS A SINK THE CALLER OWNS, NOT A MODULE GLOBAL, so the two clauses cannot print each
 * other's failures. `wholeGameClause` passes `MATCHER_THREW` — its existing array, and the one the
 * selftest push/pops — and `classifyMechanics` passes its own. A shared accumulator would have put a
 * mechanics cause under the whole-game clause's heading, which is a smaller version of exactly the
 * bug this function is closing. */
/* `ctx` CARRIES THE ARTIFACT'S OWN RELEASE so a `CLOSETED` row can be told when its evidence has not
 * been re-checked against the bytes it is excusing. Optional: a caller that passes nothing gets the
 * old behaviour for the two kinds that make no measured claim, and a CLOSETED row simply cannot be
 * reported stale — it is never reported FRESH by default, which is the safe direction. */
function declaredMatch(cause, ev, threw, ctx) {
  const c = String(cause || '');
  const d = DECLARED_DIVERGENCE.find((x) => {
    try { return x.match(c, ev(c)); }
    catch (e) {
      /* ROADMAP #258 — A MATCHER THAT THREW IS NOT A CAUSE THAT IS UNDECLARED. This returned
       * `false` silently, which moves the cause into the UNDECLARED pile and inflates the
       * divergence rate this file publishes. `false` is still the safe direction — an undeclared
       * divergence is the conservative reading — but it is counted and named now. */
      threw.push({ cause: c,
                   error: String((e && e.message) || e).split(String.fromCharCode(10))[0] });
      return false;
    }
  });
  if (!d) return null;
  if (!DECLARED_KINDS[d.kind]) {
    /* A ROW WHOSE KIND IS NOT IN THE TABLE IS NOT DECLARED. This is the guard that stops a
     * DEFERRED row — "a real defect we chose not to fix yet" — from being subtracted and opening
     * the gate. It is counted as UNDECLARED and named, exactly like a matcher that threw.
     *
     * `CLOSETED` DOES NOT WEAKEN IT AND THE DIFFERENCE IS NOT COSMETIC. `DEFERRED` is an AGENT
     * saying it did not get to something; `CLOSETED` is the OWNER ruling, dated and quoted, on a
     * measured no-board-effect claim, with a falsifier. The guard below is what makes that a real
     * distinction rather than a rename: a `CLOSETED` row that cannot produce those fields is
     * refused here exactly as a `DEFERRED` row is. */
    threw.push({ cause: c,
      error: 'declared row `' + d.name + '` carries kind `' + String(d.kind) + '`, which is not '
           + 'one of ' + Object.keys(DECLARED_KINDS).join(' / ') + ' — NOT subtracted' });
    return null;
  }
  if (d.kind === 'CLOSETED') {
    /* THE SCHEMA IS CHECKED AT THE DOOR, NOT AT THE PRINTER. A half-written closet row must hold the
     * gate SHUT, because the alternative is an exemption that exists because somebody started typing
     * one. Named on the run through the same sink as an unknown kind, so it cannot go quiet. */
    const fault = closetFault(d);
    if (fault) { threw.push({ cause: c, error: fault }); return null; }
    const stale = closetEvidenceStale(d, ctx);
    /* A COPY, NEVER THE LIST'S OWN OBJECT — the staleness verdict is per-artifact and writing it back
     * onto the shared row would leak one clause's context into the other's. */
    return stale ? { ...d, evidence_stale: stale } : d;
  }
  return d;
}

/* THE WHOLE REGISTER, PRINTED ON EVERY RUN, MATCHED OR NOT — CONSTRAINT 2 OF WILL'S RULING.
 *
 * *"A GATE, NOT A BACKLOG"* is his own wording about the narration gate, and the reason is the
 * fourteen stale handoffs: a deferred thing that stops being printed has been hidden rather than
 * accepted. `declaredLine` in `wholeGameClause` prints only rows that MATCHED, so a declaration
 * covering nothing was invisible — and an exemption that matches nothing is the shape
 * `tests/roster.js` already calls a claim that has quietly become false.
 *
 * So every row is listed with the games it took THIS RUN, including zero. `hits` is the clause's own
 * per-name tally. */
function declaredRegisterLine(hits, ctx) {
  const NL = String.fromCharCode(10);
  const by = new Map();
  for (const h of (hits || [])) by.set(h.name, (by.get(h.name) || 0) + (h.n || 0));
  const rows = DECLARED_DIVERGENCE.map((d) => {
    const n = by.get(d.name) || 0;
    const fault = d.kind === 'CLOSETED' ? closetFault(d) : null;
    const stale = d.kind === 'CLOSETED' && !fault ? closetEvidenceStale(d, ctx) : null;
    let s = '    ' + String(n).padStart(4) + '  [' + String(d.kind) + '] ' + d.name;
    if (n === 0) {
      s += NL + '           MATCHED NOTHING IN THIS RUN — a declaration that covers no cause is a '
        + 'claim that has quietly become false. Withdraw it or show the cause it excuses.';
    }
    if (fault) s += NL + '           REFUSED: ' + fault;
    if (stale) s += NL + '           ' + stale;
    if (d.kind === 'CLOSETED' && d.closet) {
      s += NL + '           CLOSETED BY ' + d.closet.by + ' ' + d.closet.on + ' (' + d.closet.authority
        + '): "' + d.closet.ruling + '"'
        + NL + '           WOULD BE WRONG IF: ' + d.falsifiedBy;
    }
    return s;
  });
  return NL + '  THE DECLARED REGISTER — every row that MAY subtract, printed whether or not it did ['
    + DECLARED_DIVERGENCE.length + ' row(s); CLOSETED: '
    + DECLARED_DIVERGENCE.filter((d) => d.kind === 'CLOSETED').length + ']:'
    + (rows.length ? NL + rows.join(NL)
       : NL + '    (none — nothing in this repository is exempt from the whole-game comparison)');
}

/* THE MECHANICS ARTIFACT'S EVIDENCE, ADAPTED HONESTLY AND NOT WIDENED.
 *
 * The two artifacts already speak ONE cause grammar — `<cls> :: |lineA <> |lineB`, written by the
 * same comparator — so the matching rule needs no loosening to reach across. What differs is the
 * EVIDENCE a matcher may ask for. `data/game-differential.json` carries `first_divergences` (the raw
 * pair of lines) and `order_probe` (speed read off the authority at the turn boundary);
 * `data/all-mechanics-fire.json` carries the raw pair on each row's `divergence` and NO ORDER PROBE
 * AT ALL.
 *
 * So this hands over the four keys that genuinely mean the same thing on both sides and INVENTS
 * NOTHING. `probes` is empty here by construction, and the contract on `causeEvidence` already says
 * what that means: a matcher that requires evidence DECLINES on absence, which is the safe direction
 * — an undeclared divergence holds the gate shut. A future order-probe matcher will therefore refuse
 * to subtract a mechanics row rather than subtract it on evidence nobody measured.
 *
 * It builds through `causeEvidence` rather than beside it, so "index the evidence by cause" has one
 * implementation. */
function mechanicsCauseEvidence(j) {
  const firsts = [];
  for (const kind of ['moves', 'abilities', 'items']) {
    for (const r of (Array.isArray(j && j.rows && j.rows[kind]) ? j.rows[kind] : [])) {
      const d = r && r.divergence;
      if (!d || !d.cause) continue;
      firsts.push({ cause: d.cause, cls: d.cls, showdown: d.showdown, medicham: d.medicham });
    }
  }
  return causeEvidence({ first_divergences: firsts });   /* deliberately no `order_probe` */
}

/* ================================================================================================
 * ONE DOOR ONTO data/game-differential.json — THE READ AND EVERY REFUSAL, ASKED ONCE FOR BOTH OF
 * THE CLAUSES THAT READ IT.
 * ================================================================================================
 * WILL'S 2026-08-22 CALL SPLIT THIS ARTIFACT INTO TWO CLAUSES — board-material GATES, narration
 * REPORTS — and a split is exactly the shape that has already cost this file. `pin_guard.js`'s own
 * header records ONE refusal sentence copied into FIVE clauses, every one of which therefore read an
 * artifact that declared NOTHING as agreement. Copying the pin guard, the steering guard and the
 * missing-artifact branch into a second whole-game clause would have rebuilt that failure on the day
 * the guard against it landed.
 *
 * So the door is asked ONCE and answers `{ refused }` or `{ j, rcpt }`. A caller that ignores the
 * refusal cannot get a `j` out of it — there is no path to the numbers that does not pass the guard.
 *
 * WHAT IS DELIBERATELY *NOT* IN HERE: THE PLANTED PROOFS, BECAUSE THEY ARE TWO DIFFERENT PROOFS.
 * `planted_divergence_proof_ok` is the PROTOCOL comparator proving it can see a protocol divergence
 * it planted itself. `state.planted_state_proof_ok` is the BOARD comparator proving it can see a
 * board one — a planted HP off-by-one, a planted stat stage — and `state.mappings_all_proved` is the
 * claim that every leaf mapping was demonstrated. A board clause resting on the protocol proof would
 * be an instrument vouched for by a DIFFERENT instrument, which reads exactly like a vouched one.
 * Each clause therefore checks its own, below.
 * ============================================================================================== */
function wholeGameDoor(NAME, artifact) {
  const j = artifact === undefined ? readJson(D('data', 'game-differential.json')) : artifact;
  if (!j) {
    return { refused: { name: NAME, ok: false, missing: true,
      pins: PIN.receipt({ file: 'data/game-differential.json',
                          checked: ['release', 'digests', 'population'], why: 'no artifact to pin' }),
      why: 'NO ARTIFACT — data/game-differential.json is absent. A clause that cannot be computed '
         + 'FAILS. Run: SHOWDOWN_PATH=... node engine/game_differential.js --release <id> '
         + '--games 1200 --write' } };
  }
  /* ==============================================================================================
   * THE HEADLINE IS WITHHELD WHEN IT DESCRIBES BYTES THE TREE NO LONGER HAS — ROADMAP #298.
   * ==============================================================================================
   * `mechanicsClause` has refused a mismatched release since it was built (*"that is not a weaker
   * answer, it is an answer about other bytes"*), `decisionImpact` refuses one, and `orderProbeClause`
   * refuses one. THIS CLAUSE — the one whose number gets quoted — compared nothing at all. Measured
   * 2026-08-18: `data/game-differential.json` was stamped release `6875c8ace00e` while the tree had
   * moved twice, through `488fd1bf3f7c` (#294, the per-target accuracy roll — the largest behaviour
   * change of the day, landing directly on spread moves) to `978ca8fe72c9`. The clause published
   * `695 of 1230`, its class composition, the 228-game `ordering` class and the 238-game Protect
   * family, and said nothing.
   *
   * THE FIGURE IS WITHHELD, NOT CAPTIONED, AND CLAUDE.md HAD ALREADY DECIDED THAT. `status.js` printed
   * `PRE-CHANGE` and `[engine moved since; transfer assumed, not measured]` beside the quarantined
   * numbers and they were quoted anyway, including by the agent that printed them — *"the figure must
   * be WITHHELD, not annotated. Printing it with a caveat is the bug."* So nothing measured comes back
   * on this branch: no `rate`, no `diverged`, no `games`, no class composition. What comes back is
   * WHICH RELEASE IT WANTED AND WHICH IT GOT, because that is the only fact this artifact still
   * supports, and the command that repairs it.
   *
   * YES, THIS REMOVES THE PROJECT'S MOST-QUOTED ENGINE NUMBER UNTIL IT IS RE-MEASURED. That is the
   * intended consequence of the rule rather than a side effect of it: a number quoted from a dead
   * release is worse than no number, and the differential is ~3 minutes of wall clock to re-run.
   *
   * CONSISTENT WITH ITS SIBLINGS ON THE UNSTAMPED CASE TOO. It refuses only on a MISMATCH: an
   * artifact carrying no release at all is allowed to answer, exactly as `orderProbeClause` allows
   * one, and the selftest's injected artifacts rely on that. A tree with no `engine-release.json`
   * likewise compares nothing — there is no id to disagree with.
   *
   *   ^^^ THAT PARAGRAPH IS RETRACTED, 2026-09-04, AND IS LEFT STANDING BECAUSE IT IS WHAT THE
   *   SENTENCE COST. "Consistent with its siblings" was true and was the problem: FIVE clauses in
   *   this file carried the same rule, so all five read an artifact that declared NOTHING as
   *   agreement. `engine/sweep.js` §2 reported 3 of 8 clauses blind on exactly this, and the
   *   selftest arms that "relied on that" were relying on a fixture nobody had pinned rather than on
   *   a principle. Absence now REFUSES, in `engine/pin_guard.js`, for every clause at once.
   * ============================================================================================ */
  /* THE `ranOn && curId &&` ABOVE MEANT AN ARTIFACT WITH NO PIN ANSWERED, and the paragraph below
   * argued for that on purpose ("a missing release id is a fact about an old writer"). It is wrong,
   * and it was wrong in the same place four more times: `rosterStage`, `mechanicsClause`,
   * `orderProbeClause` and `decisionImpact` each carried the same sentence. Silence is not a fact
   * about an old writer when the thing being decided is WHICH BYTES THIS NUMBER DESCRIBES — it is
   * the absence of the only evidence that could answer. One refusal now, in engine/pin_guard.js. */
  {
    const r = PIN.guard({ name: NAME, file: 'data/game-differential.json', artifact: j,
      need: ['release', 'digests'],
      rerun: 'SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --release <id> '
           + '--arm middle --end-state --census <pin> --games 1200 '
           + '--team-store data/team-pool-frozen --write' });
    if (r) return { refused: r };
  }
  /* ==============================================================================================
   * THE POPULATION IS PART OF THE QUESTION — 2026-09-03. A GATE THAT CANNOT TELL WHICH DRIVER
   * PRODUCED ITS INPUT IS THE DEFECT, NOT JUST THE READING IT HAPPENED TO GIVE.
   * ==============================================================================================
   * This clause read whatever sat at `data/game-differential.json` and asked nothing about how those
   * games were played. Measured on release `8ad06030e129`, cap 12, pool `0d103fb9fa87`, census pin
   * `9446a684709d` — the SAME pins on both sides, the driver the only difference:
   *
   *     census-coverage-seeking/v1   17 of 961 games reached a result (1.8%),  0 boards parted
   *     empirical-click/v1          474 of 961 games reached a result (49.3%), 77 boards parted
   *
   * So the clause read 8 of 8 PASS and MEDICHAM was declared correct on a population that does not
   * contain the failure. 944 of 961 games were cut off by the 12-turn cap; severity band 1
   * (DIFFERENT-WINNER) has never once been reachable. A question answerable by games that never end
   * is not the question the gate is asking.
   *
   * IT REFUSES RATHER THAN DOWNGRADES, AND IT REFUSES ON ABSENCE TOO. The sibling refusals in this
   * function (#298, decisionImpact) allowed an UNSTAMPED artifact to answer when this was written,
   * because a missing release id was read as a fact about an old writer and not a claim about the
   * games. THEY NO LONGER DO — 2026-09-04, engine/pin_guard.js; the exception this paragraph carves
   * out for steering turned out to be the RULE. Steering is not like that: an
   * artifact with no `steering` block is one whose sample nobody recorded, and `steering.comparable`
   * has failed closed on exactly that since it was written — *"the honest answer for those is NOT
   * that they were comparable, it is that nothing recorded whether they were."* Every artifact this
   * driver has written since 2026-08-07 carries the block.
   *
   * THE FIGURES ARE WITHHELD, NOT CAPTIONED, for the same reason as #298 one block up: a rate printed
   * beside a warning gets quoted without the warning. `PRE-CHANGE` has the receipt. */
  /* IT CHECKED `steering.policy` AND NOTHING ELSE — 2026-09-04, LAST NIGHT'S DEFECT ONE FIELD OVER.
   *
   * The block above refused the wrong DRIVER and waved through the wrong TEAM POOL, using a field the
   * artifact ALREADY RECORDS (`steering.team_pool_digest`) and that `engine/steering.js` has refused
   * the absence of since WIRE 5 — *"the swarm reads the live game store, which OPS appends to"*. A run
   * against a different pool passed this clause. So the selector list is asked for through
   * `steering.vouches()`, which is now the one implementation for the one-sided question and for
   * `comparable()`'s two-sided one; a selector added there tomorrow is checked here the same day with
   * no edit in this file. */
  {
    const STEERING = require('./steering.js');
    const r = PIN.guard({ name: NAME, file: 'data/game-differential.json', artifact: j,
      need: ['population'], policy: STEERING.POLICY_EMPIRICAL,
      note: 'Under the coverage driver the games do not end — 944 of 961 stop at the turn cap and 17 '
          + 'reach a result, so a PASS there is a claim about openings, not about games.',
      rerun: 'SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --release <id> '
           + '--arm middle --end-state --census <pin> --games 1200 '
           + '--team-store data/team-pool-frozen --write' });
    if (r) return { refused: Object.assign(r, { steering_policy: (j.steering && j.steering.policy) || null,
                                                wanted_steering_policy: STEERING.POLICY_EMPIRICAL }) };
  }
  const WGRCPT = PIN.receipt({ file: 'data/game-differential.json',
                              checked: ['release', 'digests', 'population'],
                              release: j[PIN.K.id] || null });
  return { j, rcpt: WGRCPT };
}


/* ================================================================================================
 * THE WHOLE-GAME CLAUSE COUNTS BOARDS THAT PART — WILL'S CALL, 2026-08-22, WIRED 2026-09-04.
 * ================================================================================================
 * *"the bar is BOARD-MATERIAL now, with narration as its own separate gate afterwards."* CLAUDE.md
 * carries the ruling and the reasoning: **commentary may differ; boards may not.** What it did NOT
 * carry until today was a clause that computes it. The whole-game clause gated on `j.diverged` — the
 * PROTOCOL first-divergence count, the turn at which the two engines' `|` lines stop matching — and
 * read `167 of 961` while `state.games - state.games_board_never_diverged` sat in the same artifact,
 * unread, at `77 of 961`.
 *
 * THE TWO FIELDS ARE READ, NOT DERIVED. `engine/game_differential.js` writes `state.games` and
 * `state.games_board_never_diverged`; this clause subtracts them and does nothing else. There is no
 * second implementation of "did a board part" here — `engine/board_state.js` decides that, once, and
 * the differential records the answer.
 *
 * WHY THIS IS NOT A RELAXATION, MEASURED RATHER THAN ASSERTED. Of the 168 protocol-diverged games in
 * the artifact this landed against, `protocol_diverged_board_never_did` is **102**: those games write
 * no differing board leaf at any compared turn boundary. They are real work and they are narration.
 * Meanwhile 11 games part a BOARD with no protocol divergence at all — see UNCAUSED below — and the
 * old clause counted exactly none of them. The split does not lower the bar so much as point it at
 * the right quantity, and on those 11 it RAISES it.
 *
 * NOTHING MAY BE SUBTRACTED FROM THIS COUNT, AND THAT IS STRUCTURAL RATHER THAN STRICT. Both
 * subtraction mechanisms in this file — `DECLARED_DIVERGENCE` and `data/decision-impact.json` —
 * attribute by protocol CAUSE, over `classes[].causes[]`. The artifact records no cause for a parted
 * board: a board divergence is a `state.first_board_divergences` row carrying leaf PATHS, and there
 * is no mapping from a path to a cause. So this clause publishes a RAW count and says so, and the
 * perish-drain `CLOSETED` row — which is a protocol declaration — subtracts from the NARRATION clause
 * and cannot open this one. Inventing an attribution here to make the two look symmetrical would be
 * the merged-number failure this file has already paid for twice.
 *
 * AND THAT CLOSETED ROW'S OWN FALSIFIER IS LIVE ON THIS ARTIFACT. Its `falsifiedBy` clause (b) reads
 * *"the board claim failing — `state.games_board_never_diverged` below `state.games`, ... or a
 * non-empty `state.first_board_divergences`"*. Both are true here. That is not this clause's verdict
 * to take — the row is a NARRATION declaration and the register printer names it there — but a board
 * clause that computed the exact quantity a live declaration is falsified by, and said nothing, would
 * be the silent default rebuilt inside the fix for it.
 * ============================================================================================== */
function wholeGameClause(artifact) {
  const NAME = 'whole-game differential / BOARD-MATERIAL — games whose boards part';
  const DOOR = wholeGameDoor(NAME, artifact);
  if (DOOR.refused) return DOOR.refused;
  const j = DOOR.j;
  const NL = String.fromCharCode(10);
  const RCPT = PIN.receipt({ file: 'data/game-differential.json',
    checked: ['release', 'digests', 'population', 'state.planted_state_proof_ok',
              'state.mappings_all_proved'],
    release: j[PIN.K.id] || null });
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const st = (j.state && typeof j.state === 'object') ? j.state : null;
  const games = st ? num(st.games) : null;
  const never = st ? num(st.games_board_never_diverged) : null;
  /* A CLAUSE THAT CANNOT BE COMPUTED FAILS — this file's own standing rule, and the ONE branch a
   * board gate must not soften. Falling back on `j.diverged` here would publish the narration count
   * under the board clause's name, which is precisely the confusion this split exists to end. There
   * is no fallback and there will not be one: `state_mode` is named so a reader knows the run was
   * never asked for boards, rather than guessing that boards agreed. */
  if (games === null || never === null) {
    return { name: NAME, ok: false, cannot_answer: true, generated: j.generated || null, pins: RCPT,
      why: 'CANNOT ANSWER — this artifact carries no board comparison. `state.games` reads '
         + String(st ? st.games : '(no `state` block at all)')
         + ' and `state.games_board_never_diverged` reads '
         + String(st ? st.games_board_never_diverged : '-')
         + '; `state_mode` is ' + String(j.state_mode) + '. THERE IS NO FALLBACK ONTO THE PROTOCOL '
         + 'COUNT: `j.diverged` answers a different question and publishing it here would be the '
         + 'silent default. Re-run with boards on: SHOWDOWN_PATH=... node '
         + 'engine/game_differential.js --steering empirical --release <id> --arm middle --end-state '
         + '--census <pin> --games 1200 --team-store data/team-pool-frozen --write' };
  }
  if (!games) {
    return { name: NAME, ok: false, generated: j.generated || null, pins: RCPT,
      why: 'THE ARTIFACT RECORDS ZERO GAMES WITH A BOARD COMPARED, which is not the same as zero '
         + 'boards parting.' };
  }
  /* THE BOARD COMPARATOR'S OWN PLANTED PROOF, NOT THE PROTOCOL ONE. `planted_divergence_proof_ok`
   * proves the LINE comparator can see a planted line; it says nothing about whether the LEAF
   * comparator can see a planted HP or a planted stat stage. `state.planted_state_proof` plants
   * exactly those, and `state.mappings_all_proved` is the claim that every leaf mapping was
   * demonstrated. An instrument blind to a board difference it planted itself cannot be believed
   * about the ones it did not plant — and a board clause vouched for by the PROTOCOL proof would be
   * an instrument vouched for by a different instrument, which reads exactly like a vouched one. */
  if (st.planted_state_proof_ok !== true || st.mappings_all_proved !== true) {
    return { name: NAME, ok: false, cannot_answer: true, generated: j.generated || null, pins: RCPT,
      why: 'THE BOARD COMPARATOR DID NOT PROVE ITSELF — `state.planted_state_proof_ok` is '
         + String(st.planted_state_proof_ok) + ' and `state.mappings_all_proved` is '
         + String(st.mappings_all_proved) + '. A comparator blind to a board difference it planted '
         + 'itself says nothing about the ones it did not plant, so every board figure in this run is '
         + 'WITHHELD rather than printed with a caveat. Re-run: SHOWDOWN_PATH=... node '
         + 'engine/game_differential.js --steering empirical --release <id> --arm middle --end-state '
         + '--census <pin> --games 1200 --team-store data/team-pool-frozen --write' };
  }
  const material = games - never;
  if (material < 0) {
    return { name: NAME, ok: false, cannot_answer: true, generated: j.generated || null, pins: RCPT,
      why: 'THE ARTIFACT CONTRADICTS ITSELF — `state.games_board_never_diverged` is ' + never
         + ' out of `state.games` ' + games + ', which is more games than were played. No board '
         + 'figure can be taken from a run whose own two fields disagree.' };
  }
  /* ==============================================================================================
   * THE UNCAUSED SET — A BOARD THAT PARTS WITH NOTHING IN THE NARRATION POINTING AT IT.
   * ==============================================================================================
   * This is the failure mode of the split, and it is named here rather than left to be discovered. A
   * fix that closes a game's PROTOCOL divergence without fixing the board moves that game out of the
   * narration clause entirely — no cause, no class, no shape, nothing to grep — while the board goes
   * on being wrong. Under the single clause that shipped until today such a game vanished from the
   * count outright. Under the split it stays in the board count, and this line is what makes it
   * legible as a distinct KIND rather than as one of N.
   *
   * DERIVED FROM FOUR ARTIFACT FIELDS AND NAMED AS DERIVED. The artifact does not carry the figure;
   * it carries `games`, `games_board_never_diverged`, `protocol_diverged_games` and
   * `protocol_diverged_board_never_did`, and the games whose boards parted while their protocol
   * matched are `material - (protocol_diverged_games - protocol_diverged_board_never_did)`. A
   * negative result means those four fields disagree, and it is REPORTED rather than clamped —
   * `Math.max(0, ...)` here would turn a broken instrument into a clean bill of health. */
  const P = num(st.protocol_diverged_games), Pn = num(st.protocol_diverged_board_never_did);
  const bothParted = (P === null || Pn === null) ? null : P - Pn;
  const uncaused = bothParted === null ? null : material - bothParted;
  const uncausedLine = (() => {
    if (uncaused === null) {
      return NL + '  UNCAUSED — NOT COMPUTED. This artifact carries no `state.protocol_diverged_games`'
        + ' / `state.protocol_diverged_board_never_did`, so nothing here can say how many of the '
        + material + ' parted boards have NOTHING in the narration pointing at them.';
    }
    if (uncaused < 0) {
      return NL + '  UNCAUSED — THE ARTIFACT CONTRADICTS ITSELF: ' + material + ' board-material '
        + 'game(s) but ' + bothParted + ' game(s) whose protocol AND board both parted (' + P
        + ' protocol divergence(s) less ' + Pn + ' whose board never did). A subset cannot be larger '
        + 'than its set; one of those four fields is wrong.';
    }
    const rows = Array.isArray(st.first_board_divergences) ? st.first_board_divergences : [];
    const orphans = rows.filter((r) => r && r.protocol_diverged_at_turn === null);
    return NL + '  UNCAUSED — ' + uncaused + ' of the ' + material + ' game(s) part a BOARD while the'
      + ' protocol NEVER diverges at all (' + material + ' less ' + bothParted + ' whose protocol also'
      + ' parted: ' + P + ' protocol divergence(s) less ' + Pn + ' whose board never did). THESE ARE'
      + ' THE ONES WITH NOTHING TO GREP: no cause, no class, no shape and no row in the narration'
      + ' clause. A fix that closes a protocol divergence without fixing the board puts a game HERE,'
      + ' and under the single clause that shipped until 2026-09-04 it would have left the count'
      + ' altogether.'
      + (orphans.length
          ? NL + '    the artifact carries ' + rows.length + ' first-board-divergence row(s) — a'
            + ' SAMPLE of the ' + material + ', never the list — of which ' + orphans.length
            + ' carry `protocol_diverged_at_turn: null`:'
            + orphans.slice(0, 8).map((r) => NL + '      turn ' + r.turn + '  '
                + String(r.seed || '?').slice(0, 46) + '  '
                + (r.diffs || []).map((d) => d.path).join(', ')).join('')
          : NL + '    the artifact carries no first-board-divergence row with'
            + ' `protocol_diverged_at_turn: null`, so this count has no worked example in it and the '
            + uncaused + ' above is arithmetic over four fields and nothing more.');
  })();
  const held = num(st.protocol_diverged_board_held_longer);
  const before = num(st.board_parted_before_the_protocol_did);
  const orderLine = (held === null && before === null) ? ''
    : NL + '  ORDER OF PARTING — ' + (before === null ? '?' : before) + ' game(s) parted a BOARD'
      + ' before the protocol did and ' + (held === null ? '?' : held) + ' held the board together'
      + ' after the protocol parted. Neither is this clause\'s verdict; they are printed because a'
      + ' board that parts FIRST is a rule disagreement the narration only reports downstream of.';
  const boundLine = (num(st.turn_boundaries_compared) === null) ? ''
    : NL + '  ' + st.turn_boundaries_identical + ' of ' + st.turn_boundaries_compared
      + ' turn boundaries compared were IDENTICAL. That is the denominator this clause does NOT use —'
      + ' a game counts here if ANY boundary parted, so a per-boundary rate always reads greener.';
  const rawLine = NL + '  RAW, AND NOT BY OVERSIGHT: no `DECLARED_DIVERGENCE` row and no'
    + ' data/decision-impact.json row can be subtracted from this count. Both attribute by protocol'
    + ' CAUSE over `classes[].causes[]`, and the artifact records no cause for a parted board — a'
    + ' board divergence is a leaf PATH. The NARRATION clause is where a declaration subtracts.';
  const pct = (100 * material / games).toFixed(1);
  return {
    name: NAME, ok: material === 0, gates: true, generated: j.generated || null, pins: RCPT,
    quantity: 'board_material_games',
    games, board_material: material, board_never_diverged: never,
    protocol_diverged_games: P, protocol_diverged_board_never_did: Pn,
    board_material_uncaused_by_protocol: uncaused,
    why: (material === 0
      ? 'BOARD-MATERIAL: 0 of ' + games + ' games. Every compared turn boundary in every game holds '
        + 'the SAME BOARD on both engines. This is the quantity Will named on 2026-08-22 — '
        + 'commentary may differ, boards may not — and it is met.'
      : 'BOARD-MATERIAL: ' + material + ' of ' + games + ' = ' + pct + '% of games reach a turn '
        + 'boundary whose BOARD differs between the two engines (' + games + ' games less ' + never
        + ' whose board never diverged, both read straight off `state`). Mode A pins every die on '
        + 'both sides, so each one is a RULE they disagree about. This clause fails until it is zero.')
      + rawLine + uncausedLine + orderLine + boundLine,
  };
}

/* `wgDecisionImpact` IS THE SECOND INJECTION POINT AND IT EXISTS FOR THE SELFTEST ONLY, on the same
 * reasoning as `artifact` above and as `withholder`'s gate argument: a `--force` flag anybody can pass
 * on the command line eventually gets passed, and a parameter is visible in the caller where a flag is
 * not. Left undefined by every shipping caller, which is what makes the real reader the default. */
/* ================================================================================================
 * EVERY RETURN PATH CARRIES `gates: false`, INCLUDING THE REFUSALS — AND THAT IS NOT TIDINESS.
 * ================================================================================================
 * `narrationVerdict` has SEVEN exits: the missing artifact, three pin/steering refusals inside
 * `wholeGameDoor`, zero games, a planted proof that did not fire, and the verdict itself. Only the
 * last one built the flag by hand in the first draft, and the consequence is the exact silent
 * default this repository opens with: on a STALE or torn artifact the narration clause would come
 * back WITHHELD with no `gates` field, default to gating, and hold the quarantine gate shut on a
 * quantity Will took off the critical path on 2026-08-22. Nothing would have said so — the gate
 * would simply have read CLOSED for a reason nobody had chosen.
 *
 * So the flag is applied by the WRAPPER, to whatever the body returns, and an eighth exit added
 * later inherits it without anybody remembering to. `quantity` is applied the same way and the same
 * spread lets the body override it, so a future branch can name a narrower quantity if it has one.
 * ============================================================================================== */
function narrationClause(artifact, wgDecisionImpact) {
  const r = narrationVerdict(artifact, wgDecisionImpact);
  if (!r || typeof r !== 'object') return r;
  return Object.assign({ quantity: 'protocol_first_divergence_games' }, r, { gates: false });
}

function narrationVerdict(artifact, wgDecisionImpact) {
  const NAME = 'whole-game differential / NARRATION — protocol first divergence';
  const DOOR = wholeGameDoor(NAME, artifact);
  if (DOOR.refused) return DOOR.refused;
  const j = DOOR.j, WGRCPT = DOOR.rcpt;
  const games = +j.games || 0, div = +j.diverged || 0;
  if (!games) {
    return { name: NAME, ok: false, generated: j.generated || null, pins: WGRCPT,
      why: 'THE ARTIFACT RECORDS ZERO GAMES, which is not the same as zero divergences.' };
  }
  /* A PLANTED PROOF THAT DID NOT FIRE INVALIDATES THE RUN. An instrument that cannot see a divergence
   * it planted itself cannot be believed about the ones it did not plant. */
  if (j.planted_divergence_proof_ok !== true) {
    return { name: NAME, ok: false, generated: j.generated || null, pins: WGRCPT,
      why: 'THE PLANTED-DIVERGENCE PROOF DID NOT FIRE, so this run cannot be believed at all. An '
         + 'instrument blind to a divergence it planted itself says nothing about ' + div + '.' };
  }
  const rate = div / games;
  const base = readJson(D('data', 'whole-game-baseline.json'));
  const se = Math.sqrt(Math.max(rate, 1e-9) * (1 - rate) / games);
  const band = 2 * se;                                   /* derived from this run's own n */
  /* ROADMAP #292 — THE COMPOSITION MUST COME FROM THE ARTIFACT THE HEADLINE CAME FROM.
   *
   * This read `data/divergence-report.json` — a SEPARATE file, written by a SEPARATE run — and printed
   * its shape counts beside a headline taken from `j`. Measured 2026-08-17: the headline said
   * `287 of 1539` off release `0c5bb83c5744`, and the composition beside it (`emission 132, rule 91,
   * ordering 39, unparsed 34, field 5`) came from a report whose own `run` block records **983 games,
   * 303 diverged, release `a81663f17c0c`**. Two runs, one line, and nothing said so. Shaping the
   * CURRENT artifact gives EMISSION 116 / RULE 83 / ORDERING 52 / UNPARSED 35 / FIELD 1 — the FIELD
   * count alone was off by 5x.
   *
   * It is now computed from `j.classes[].causes[]` through `engine/divergence_shape.js`, the one
   * implementation of "what do these two lines disagree about". So the composition cannot describe a
   * run other than the one the headline describes: there is no other file to read.
   *
   * AND `unparsed` IS NAMED FOR WHAT IT IS. It is NOT a fifth kind of disagreement — the shape module
   * says so in as many words — it is the comparator admitting it could not shape the pair. 32 of the
   * 35 are the `drag: a different body` class, whose cause is ONE `|drag|` line and not a pair, so
   * there is no grammar for it rather than a mystery. The dominant class is printed beside the count
   * so nobody reads it as 35 comparator gaps again. */
  const shapes = (() => {
    const SHAPE = require('./divergence_shape.js');
    const cls = Array.isArray(j.classes) ? j.classes : null;
    if (!cls) return null;
    const g = {}, unparsedBy = {};
    for (const c of cls) for (const k of (c.causes || [])) {
      const sh = SHAPE.shapeOf(k.cause).shape;
      g[sh] = (g[sh] || 0) + (k.n || 0);
      if (sh === 'UNPARSED') unparsedBy[c.cls] = (unparsedBy[c.cls] || 0) + (k.n || 0);
    }
    const worst = Object.entries(unparsedBy).sort((a, b) => b[1] - a[1])[0] || null;
    return { rows: Object.entries(g).sort((a, b) => b[1] - a[1]), unparsedWorst: worst };
  })();
  const pct = (100 * rate).toFixed(1);
  const shapeLine = shapes
    ? '  [' + shapes.rows.map(([k, v]) => k.toLowerCase() + ' ' + v).join(', ')
      + (shapes.unparsedWorst
         ? ';  unparsed is not a disagreement — ' + shapes.unparsedWorst[1] + ' of it is `'
           + shapes.unparsedWorst[0] + '`, a cause the comparator has no grammar for'
         : '')
      + ']'
    : '';
  if (!base || typeof base.rate !== 'number') {
    return { name: NAME, ok: false, generated: j.generated || null, rate, pins: WGRCPT,
      why: `NO BASELINE — data/whole-game-baseline.json is absent, so nothing can say whether ${div} `
         + `of ${games} (${pct}%) is better or worse than yesterday. THE FIRST RUN FAILS BY DESIGN: `
         + 'stamp it deliberately (node engine/quarantine.js --stamp-whole-game) so the number that '
         + 'becomes the bar is one somebody chose.' + shapeLine };
  }
  /* ROADMAP #292, THE SECOND HALF — A RATE MAY ONLY BE COMPARED WITH A RATE UNDER THE SAME PIN.
   *
   * The artifact's own `pins.why` says it in as many words: *"ONE PIN IS ONE CORNER."* The baseline
   * carries the `mode` string it was stamped under and nothing compared it. Measured 2026-08-17: the
   * baseline is `A/top-tie-first/pins:ef342837b791` at 30.8%, and the run beside it was
   * `A/middle/pins:1fd77b835ee2` at 61.2% — a DIFFERENT ARM with a DIFFERENT die model, whose own
   * top-tie-first arm read 14.7% on the same games. The clause printed `AND IT GOT WORSE` about a
   * 30-point rise that is entirely the instrument changing corner.
   *
   * THE TREND IS WITHHELD, NOT ANNOTATED. CLAUDE.md: printing a figure with a caveat is the bug —
   * `PRE-CHANGE` was rendered beside the quarantined numbers and they were quoted anyway. So when the
   * modes differ there is no `progress` and no `regressed`, and the reason is stated in place of the
   * comparison. The VERDICT does not move: correctness decides that, and zero is zero under any pin. */
  const baseMode = String(base.mode || '');
  const runMode = String(j.mode || '');
  const comparable = !!baseMode && !!runMode && baseMode === runMode;
  const rose = comparable && rate > base.rate + band;
  /* THE CLAUSE USED TO PRINT "NOT ZERO, AND THE RATCHET IS NOT A PASS" AND THEN REPORT PASS.
   *
   * Will, 2026-08-12: *"so if its not correct then it shouldnt pass man"*. He is right, and the old
   * text was arguing with its own verdict — a caption saying this is not really a pass, sitting beside
   * a green light. That is the shape this repo has a receipt for: `PRE-CHANGE` was printed next to the
   * quarantined figures and they were quoted anyway, including by me, which is why CLAUDE.md says a
   * figure must be WITHHELD rather than annotated.
   *
   * THE RATCHET WAS CHOSEN FOR A REAL REASON AND IT WAS THE WRONG LEVER. The argument was that a
   * clause reading red for weeks is one people learn to skip — true, with its own receipt (a docs gate
   * sat red for two days as "one of the two known failures" until the rule it guarded broke). But that
   * is a fact about how people read reports, and the fix for it cannot be a gate that says something
   * untrue. Mode A pins every die on both sides, so the two engines are deterministic functions of one
   * input: tolerance is zero, no statistics, and every one of these games is a rule they disagree
   * about. Zero is not an aspiration here, it is the definition.
   *
   * SO CORRECTNESS DECIDES THE VERDICT AND THE RATCHET BECOMES PROGRESS. Both are still reported,
   * because direction of travel is genuinely useful — it just may not open a gate. A run that gets
   * WORSE is now named as a separate, louder failure rather than folded into the same red. */
  /* SPLIT THE DIVERGENCE INTO DECLARED AND UNDECLARED. Games are attributed by CAUSE, so a class that
   * is entirely declared removes its games and a class that is partly declared removes only its share. */
  const declaredHits = [];
  let declaredGames = 0;
  /* THE SECOND AXIS REACHES THIS CLAUSE TOO, AND REACH DOES NOT. A game is not an entity: 695 of these
   * are dominated by `ordering` and `field` classes that name no mechanic at all, so there is no usage
   * figure to threshold and a reach filter here would be a fabrication. The question Will asked about a
   * played divergence — does fixing it change the click — is answerable for a CAUSE as well as for a
   * mechanic, and that is what a `cause:` row in data/decision-impact.json prices. Same contract, same
   * refusal by default: no artifact, no null demonstrated, or a different release clears nothing. */
  const DI = wgDecisionImpact === undefined
    ? decisionImpact(((readJson(D('data', 'engine-release.json')) || {}).id) || null)
    : wgDecisionImpact;
  const impactHits = [];
  let impactGames = 0;
  const EV = causeEvidence(j);
  /* THE ARTIFACT'S OWN RELEASE, HANDED TO THE DOOR. A `CLOSETED` row rests on a measurement taken on
   * one release; this is what lets the run say when that measurement has not been repeated against
   * the bytes it is now excusing. Four declarations in this project have been refuted — a closet
   * that cannot notice its own evidence ageing is a trap, not an exemption. */
  const WGCTX = { release: j.engine_release || j.release || null, generated: j.generated || null };
  for (const c of (Array.isArray(j.classes) ? j.classes : [])) {
    for (const k of (c.causes || [])) {
      /* THE SHARED DOOR — see `declaredMatch`. The matching rule, the throw handling and the
       * `DECLARED_KINDS` whitelist used to live inline here and were therefore this clause's alone,
       * which is how the mechanics clause came to count a row this one had already declared. */
      const d = declaredMatch(k.cause, EV, MATCHER_THREW, WGCTX);
      if (d) {
        declaredGames += (k.n || 0);
        const row = declaredHits.find((r) => r.name === d.name);
        if (row) row.n += (k.n || 0);
        else declaredHits.push({ kind: d.kind, name: d.name, why: d.why, n: (k.n || 0),
                                 closet: d.closet || null, evidence: d.evidence || null,
                                 falsifiedBy: d.falsifiedBy || null,
                                 evidence_stale: d.evidence_stale || null });
        continue;
      }
      const imp = DI.clear('cause:' + String(k.cause || ''));
      if (!imp) continue;
      impactGames += (k.n || 0);
      const row = impactHits.find((r) => r.key === imp.key);
      if (row) row.n += (k.n || 0); else impactHits.push({ ...imp, n: (k.n || 0) });
    }
  }
  const undeclared = Math.max(0, div - declaredGames - impactGames);
  const _NL = String.fromCharCode(10);
  /* ==============================================================================================
   * WHAT LEFT THE SAMPLE BEFORE THE RATE WAS TAKEN — 2026-08-26.
   * ==============================================================================================
   * `engine/game_differential.js` drops every pool team carrying an Illusion carrier (ROADMAP #160,
   * Will's call, 2026-08-11) and that exclusion was stamped only into `data/divergence-turns.json`,
   * the `--dump-games` debugging view. The artifact THIS CLAUSE reads carried no `closet` key at all,
   * so every whole-game figure the project has published described a narrowed sample and said nothing.
   *
   * IT IS RENDERED BESIDE THE HEADLINE, NOT STORED AND FORGOTTEN. A declaration nothing consults is
   * the same defect wearing a receipt — `engine/register_reality.js --list` was a read-only-looking
   * enumeration that flipped a clause to a false OK, one layer down from exactly this.
   *
   * AND AN ARTIFACT THAT DECLARES NOTHING SAYS SO, LOUDLY. It is not a FAIL: an older artifact simply
   * predates the key and refusing it would withhold the rate for a reason that is about the writer,
   * not the engine. But it may not read as "nothing was excluded", which is the silent-default shape
   * this repo has a standing rule about.
   * ============================================================================================ */
  const closetLine = (() => {
    const c = j.closet;
    if (!c) {
      return _NL + '  SAMPLE EXCLUSIONS — UNDECLARED. This artifact carries no `closet` block, so it '
        + 'cannot say what left the pool before the rate above was taken. That is NOT a claim that '
        + 'nothing did: engine/game_differential.js has dropped Illusion carriers since 2026-08-11. '
        + 'Re-run to get a declaration: SHOWDOWN_PATH=... node engine/game_differential.js '
        + '--games 1200 --write';
    }
    return _NL + '  SAMPLE EXCLUSIONS [' + (c.authority || 'undeclared authority') + ', '
      + (c.by || '?') + ' ' + (c.on || '?') + ']  ' + (c.says || '(no sentence published)')
      + (c.teams_whose_only_carrier_sits_past_the_bodies_brought
          ? _NL + '    of which ' + c.teams_whose_only_carrier_sits_past_the_bodies_brought
            + ' carry the body PAST the ' + c.bodies_a_pair_brings + ' bodies a pair brings, so it '
            + 'never entered either engine — the rule is over-broad by that much and the rate above '
            + 'is measured on the narrower pool.'
          : '');
  })();
  /* ROADMAP #258 — printed at zero as well, because "every matcher answered" is the claim that makes
   * the declared count mean anything. A matcher that throws pushes its cause into UNDECLARED, so this
   * line has to sit beside the number it would distort. */
  const matcherLine = MATCHER_THREW.length
    ? _NL + "  A DECLARED-DIVERGENCE MATCHER THREW on " + MATCHER_THREW.length + " cause(s), each of"
      + " which is therefore counted as UNDECLARED and is INFLATING the rate above:" + _NL
      + MATCHER_THREW.map((r) => "    " + r.cause + "  ->  " + r.error).join(_NL)
    : "";
  /* ONE BLOCK PER KIND, EACH WITH ITS OWN COUNT, NEVER SUMMED INTO ONE LINE. The two kinds make
   * OPPOSITE claims about whether a defect exists, so a single blended "declared: 11" would hide
   * which claim is being made — the merged-number failure this file has already paid for twice. */
  const declaredLine = declaredHits.length
    ? Object.keys(DECLARED_KINDS).map((kind) => {
        const rows = declaredHits.filter((r) => r.kind === kind);
        if (!rows.length) return "";
        const n = rows.reduce((a, r) => a + r.n, 0);
        return _NL + "  " + DECLARED_KINDS[kind] + "  [" + n + " game(s), " + rows.length + " row(s)]"
          + _NL
          + rows.map((r) => "    " + String(r.n).padStart(4) + "  " + r.name + _NL
              + "           " + r.why
              + (r.closet ? _NL + "           CLOSETED BY " + r.closet.by + " " + r.closet.on
                  + " (" + r.closet.authority + '): "' + r.closet.ruling + '"' : "")
              + (r.evidence ? _NL + "           EVIDENCE: " + r.evidence.instrument + " on release `"
                  + r.evidence.release + "` (" + r.evidence.on + ") — " + r.evidence.says : "")
              + (r.falsifiedBy ? _NL + "           WOULD BE WRONG IF: " + r.falsifiedBy : "")
              + (r.evidence_stale ? _NL + "           " + r.evidence_stale : "")).join(_NL);
      }).join("")
    : "";
  /* AND THE WHOLE REGISTER BENEATH IT, MATCHED OR NOT — see `declaredRegisterLine`. `declaredLine`
   * above prints only what fired, which is what made a stale exemption invisible. */
  const registerLine = declaredRegisterLine(declaredHits, WGCTX);
  const impactLine = _NL + "  DECISION IMPACT — " + (impactHits.length
    ? impactGames + " game(s) across " + impactHits.length + " cause(s) cleared by a paired argmax run: "
      + impactHits.map((r) => r.key.slice(6) + " (0 flips in " + r.paired + ", 95% upper bound "
        + r.bound.toFixed(1) + "% — a floor, not a zero; fixed in " + r.fixed_in + ")").join("; ")
    : DI.why);
  const ok = undeclared === 0;

  return {
    name: NAME, ok, generated: j.generated || null, rate, baseline: base.rate, pins: WGRCPT,
    /* ============================================================================================
     * `gates: false` — NARRATION REPORTS, IT DOES NOT HOLD THE GATE SHUT. WILL'S CALL, 2026-08-22.
     * ============================================================================================
     * *"board-material now, narration as its own separate gate afterwards"*. So this clause has its
     * own row, its own count and its own verdict line on every run, and `medichamIsCorrect()` does
     * not ask it for permission.
     *
     * WHY THAT IS NOT QUIETLY DROPPING IT, WHICH IS THE OBVIOUS OBJECTION AND A FAIR ONE. The thing
     * this project fails at is a real finding going unread — fourteen stale handoffs, a ban list of
     * four, `PRE-CHANGE` printed beside a number that got quoted anyway. Every one of those was
     * something NOBODY PRINTED, or printed as a caption on a figure. This is the opposite shape: the
     * count is COMPUTED on every run by the shipping clause, printed on its own line with the word
     * NARRATION in it, exported as data, and it exits non-zero through `--narration`. What it does
     * not do is block. CLAUDE.md's own words for the alternative — *"the narration gate is a GATE,
     * not a backlog"* — are satisfied by a clause that computes and prints, not by one that blocks;
     * a blocking narration clause is exactly what Will's ruling removed from the critical path, and
     * re-adding it here under a different name would be overriding him.
     *
     * WHAT IT COSTS, SAID PLAINLY RATHER THAN LEFT TO BE DISCOVERED: a regression that adds ONLY
     * protocol divergences — new narration, identical boards — will no longer hold the gate shut.
     * That is the deliberate content of the ruling, and it is the reason this row prints its count on
     * a PASSING run as well as a failing one. */
    gates: false,
    quantity: 'protocol_first_divergence_games',
    diverged: div, games,
    /* kept so a reader can see the trend without the trend being able to pass anything — and set to
     * null rather than guessed when the baseline was stamped under a different pin */
    progress: !comparable ? null
      : (rose ? 'WORSE than the baseline' : (rate < base.rate ? 'better than the baseline' : 'level')),
    regressed: comparable ? rose : null,
    baseline_mode: baseMode || null, run_mode: runMode || null, baseline_comparable: comparable,
    declared: declaredGames, decision_cleared: impactGames, undeclared,
    /* the split a reader needs to tell "nothing is wrong here" from "something is" — never summed */
    declared_by_kind: Object.keys(DECLARED_KINDS).reduce((o, kind) => {
      o[kind] = declaredHits.filter((r) => r.kind === kind).reduce((a, r) => a + r.n, 0);
      return o;
    }, {}),
    declared_matcher_threw: MATCHER_THREW,
    /* THE REGISTER AS DATA, so status.js and any later reader can see an exemption that matched
     * nothing without parsing the sentence above it. */
    declared_register: DECLARED_DIVERGENCE.map((d) => ({
      kind: d.kind, name: d.name,
      n: declaredHits.filter((r) => r.name === d.name).reduce((a, r) => a + r.n, 0),
      closet: d.closet || null, evidence: d.evidence || null, falsified_by: d.falsifiedBy || null,
      refused: d.kind === 'CLOSETED' ? closetFault(d) : null,
      evidence_stale: d.kind === 'CLOSETED' ? closetEvidenceStale(d, WGCTX) : null,
    })),
    /* the exclusion, carried as DATA as well as prose so status.js and any later reader can see it
     * without parsing a sentence. `null` means the artifact declared none — see closetLine. */
    sample_exclusions: j.closet || null,
    /* THE QUANTITY IS NAMED IN THE FIRST FIVE WORDS, BECAUSE TWO CORRECTLY-COMPUTED NUMBERS PRINTED
     * SIDE BY SIDE WITH ONLY ONE PUBLISHED IS HOW THIS PROJECT SPENDS AN AFTERNOON RECONCILING.
     * ROADMAP #387 is exactly this defect one layer up — *"what is genuinely wrong is that nothing
     * labels the quantity"* — filed against the single clause that used to print both 8.0% and 8.5%
     * with no word attached to either. A reader must never have to work out which of the two
     * whole-game clauses a bare `N of M` came from. */
    why: ok
      ? `PROTOCOL FIRST DIVERGENCE: ZERO across ${games} games that anything is asked to answer for`
        + (declaredGames || impactGames ? ` (${div} raw, ${declaredGames} declared, ${impactGames}`
          + ` cleared on decision impact)` : '')
        + `. Mode A pins every die on both sides, so this is the real bar and it has been met.`
        + REPORTS_NOT_GATES
        + declaredLine + registerLine + impactLine + matcherLine + closetLine
      : `PROTOCOL FIRST DIVERGENCE: ${undeclared} of ${games} = `
        + `${(100 * undeclared / games).toFixed(1)}% of games have a `
        + `turn at which the two engines' PROTOCOL LINES stop matching`
        + (declaredGames || impactGames ? ` (${div} raw, less ${declaredGames} declared and`
          + ` ${impactGames} cleared on decision impact)` : '')
        + `. Mode A pins every die on both sides, so each one is a RULE they disagree about, not noise.`
        + ` This clause reads RED until that is zero.` + REPORTS_NOT_GATES
        + declaredLine + registerLine + impactLine
        + matcherLine + closetLine
        + (!comparable
             ? `  DIRECTION OF TRAVEL WITHHELD — the baseline was stamped under \`${baseMode}\` and this`
               + ` run is \`${runMode}\`. One pin is one corner: those are two instruments, and`
               + ` subtracting one rate from the other invents a trend. Re-stamp under this pin`
               + ` (node engine/quarantine.js --stamp-whole-game) if it is the pin you mean to hold.`
           : rose ? `  AND IT GOT WORSE: RAW ${pct}% against a raw baseline of`
                  + ` ${(100 * base.rate).toFixed(1)}% (band ±${(100 * band).toFixed(1)} pts, 2 SE at`
                  + ` n=${games}). The trend is RAW on both sides deliberately — the baseline was stamped`
                  + ` before anything was declared or cleared, and subtracting today's exemptions from`
                  + ` one side only would manufacture progress.`
                : `  Direction of travel: RAW ${pct}% against a raw baseline of`
                  + ` ${(100 * base.rate).toFixed(1)}% — better, and better is not correct.`)
        + shapeLine,
  };
}

/* ================================================================================================
 * THE SHAPE OF data/register-reality.json, DECLARED ONCE AND WRITTEN THROUGH.
 *
 * `engine/register_reality.js` requires this file (for the one closed-detector), so the dependency
 * runs writer -> reader and the contract can only live on this side of it. The writer imports these
 * key names instead of spelling its own; its selftest round-trips a built artifact back through
 * `registerRealityRows` below. Two files that both decide a fact will disagree eventually and the
 * disagreement will be invisible because both keep working — that is not a hypothetical here, it is
 * what this constant was introduced to repair. See openDefectClause for the receipt.
 * ============================================================================================== */
const REGISTER_REALITY = {
  rowsFile: 'register-reality.json',
  rowsKey: 'results',
  /* per-row field names, in the writer's spelling */
  idKey: 'n', cmdKey: 'cmd', greenKey: 'green',
  /* THE VERDICT THAT MEANS "NOTHING WAS EVER ASKED" — 2026-09-04.
   *
   * `green: null` is not one fact, it is two, and until today they had one number. A marker the
   * WRITER REFUSED TO READ (`MARKER REJECTED`) never started an instrument at all; a marker it read
   * and ran can still come back null because the instrument would not start, or ran and declared
   * cannot-answer, or exited outside {0,1}. The first is a defect in the RULER or in the ROW; the
   * rest are a defect in the WORLD. In the last real artifact ALL 27 rows this clause counted as
   * "instrument unrunnable" were rejections — a ruler defect and a world defect summed into one
   * figure, which is the same silence-reading-as-agreement shape the whole file is about.
   *
   * IT IS HERE AND NOT TYPED INSIDE THE CLAUSE for the reason the rest of this constant exists: two
   * files spelling one fact will disagree eventually and the disagreement will be invisible because
   * both keep working. The writer cannot be required from here (the dependency runs writer -> reader,
   * and requiring it would execute its driver), so the selftest COMPARES THIS LITERAL TO THE WRITER'S
   * SHIPPING BYTES instead — a derived value is not a fact until something checks it against its
   * source. A rename on either side is RED. */
  rejectedVerdict: 'MARKER REJECTED',
};

/* Returns the row array, or NULL when the artifact parsed and carries no recognised array. NULL and
 * `[]` mean different things and the caller prints them differently: `[]` is an empty register,
 * `null` is a reader that cannot see one. Collapsing the two is the bug this file just paid for. */
function registerRealityRows(rr) {
  if (!rr || typeof rr !== 'object') return null;
  const a = rr[REGISTER_REALITY.rowsKey];
  if (!Array.isArray(a)) return null;
  return a.map((r) => ({
    n: r && r[REGISTER_REALITY.idKey],
    cmd: (r && r[REGISTER_REALITY.cmdKey]) || null,
    green: r && Object.prototype.hasOwnProperty.call(r, REGISTER_REALITY.greenKey)
      ? r[REGISTER_REALITY.greenKey] : null,
    verdict: (r && r.verdict) || null,
  }));
}

/* ================================================================================================
 * "THE INSTRUMENT REFUSED TO START" AND "THE INSTRUMENT RAN AND SAID NOTHING" ARE TWO FACTS.
 *
 * PURE, AND EXPORTED SO THE SELFTEST DRIVES THE SHIPPING SPLIT RATHER THAN A RESTATEMENT OF IT. It
 * takes the open rows and the verdict index and returns the five disjoint buckets plus the two
 * sentences this split exists to keep apart. Both sentences are built here, beside the buckets they
 * count, so a bucket cannot be renamed without its wording moving with it — the failure this whole
 * change is repairing is a count and a sentence describing different things.
 * ============================================================================================== */
function registerEvidence(open, byRow) {
  const withRed = [], debt = [], staleRows = [], rejected = [], unrunnable = [];
  for (const r of open) {
    const v = byRow.get(String(r.n));
    if (!v || !v.cmd) { debt.push(r); continue; }
    /* `green` IS TRI-STATE AND `null` IS NOT GREEN. An instrument that would not start says nothing
     * about the row; calling that agreement is the "a capability was absent and everything reported
     * success" shape. It is named on its own line rather than folded into either column. */
    if (v.green === false) { withRed.push(r); continue; }
    if (v.green === true) { staleRows.push(r); continue; }
    /* ...AND `null` IS ITSELF TWO ANSWERS. Split on the verdict the writer published, never on a
     * guess: a rejected marker means NOBODY WAS ASKED, so calling it an instrument that would not
     * run is a false sentence about a row nothing was ever run for. */
    if (v.verdict === REGISTER_REALITY.rejectedVerdict) rejected.push({ ...r, verdict: v.verdict });
    else unrunnable.push({ ...r, verdict: v.verdict || null });
  }
  const rejectedLine = rejected.length
    ? '  ' + rejected.length + ' open row(s) name an instrument that WAS NEVER ASKED — '
      + 'engine/register_reality.js refused to READ the marker (`' + REGISTER_REALITY.rejectedVerdict
      + '`), so no instrument started and the row is neither verified nor reported as unverified. '
      + 'That is a defect in the RULER or in the ROW and never in the instrument, and it is repaired '
      + 'by fixing the marker, not the engine: '
      + rejected.map(function (r) { return '#' + r.n; }).join(', ') + '.'
    : '';
  const unrunnableLine = unrunnable.length
    ? '  ' + unrunnable.length + ' open row(s) name an instrument that WAS ASKED AND ANSWERED '
      + 'NOTHING USABLE — it would not start, or it ran and declared cannot-answer, or it exited '
      + 'outside {0,1}. That is not agreement and it is not evidence either: '
      + unrunnable.map(function (r) { return '#' + r.n + (r.verdict ? ' [' + r.verdict + ']' : ''); })
          .join(', ') + '.'
    : '';
  return { withRed, debt, staleRows, rejected, unrunnable, rejectedLine, unrunnableLine };
}

function openDefectClause() {
  let lines;
  try { lines = fs.readFileSync(D('docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/); }
  catch (e) {
    /* ROADMAP #258 — the verdict was already loud; the REASON was not. "docs/ROADMAP.md is
     * unreadable" does not distinguish a missing file from a permission error from a torn write, and
     * the person reading this clause is the one who has to fix it. */
    return { name: 'no open, known engine defect', ok: false, missing: true,
      pins: PIN.noArtifact('this clause reads docs/ROADMAP.md and data/register-reality.json live on every '
      + 'run and records no measurement of its own; it stamps the AGE of what it read rather than '
      + 'carrying a result that could go stale'),
      why: 'CANNOT ANSWER — docs/ROADMAP.md is unreadable (' + e.message + '). A clause that cannot '
         + 'be computed FAILS.' };
  }
  const open = [];
  for (const l of lines) {
    const m = l.match(/^\|\s*#(\d+)\s*\|\s*\*\*(.{0,140})/);
    if (!m) continue;
    /* THE STATUS IS READ FROM THE STATUS COLUMN, AND THAT IS #148'S OWN PRESCRIPTION CASHED IN.
     *
     * The first version scanned the first 600 characters of PROSE for `— DONE`, `closed 20\d\d` and
     * friends, case-sensitively. #148 records what that costs, in its own words: *"a defect register
     * whose enforcement depends on word choice is a structural weakness"*. It cost twice on 2026-08-11
     * in one pass:
     *   - four rows CLOSED that day, each headed `— CLOSED 2026-08-11` in capitals, went on counting,
     *     because the pattern had no `/i` and `closed` is lower case in it;
     *   - **#148 counted ITSELF**, because it QUOTES the breakage vocabulary (`IS ABSENT`,
     *     `IS NOT IMPLEMENTED`) while explaining the detector. A row about the detector tripping the
     *     detector is the clearest possible statement that prose-matching is the wrong instrument.
     *
     * So the row's STATUS CELL — the last cell of the table row, which is where this register has
     * always recorded status — is consulted first, and it must BEGIN with a closed word. That is not a
     * loosening: measured over all 119 rows before it was wired (LESSONS §4, print what it matches),
     * the cell clause newly clears **16** rows and every one of them is stamped `closed 20xx-xx-xx`,
     * `DONE 2026-08-10` or `page closed 2026-08-10` in that cell. It clears NOTHING whose cell reads
     * `open — …`, `in progress`, `scoping`, `queued behind 42` or prose.
     *
     * `PART DONE` IS DELIBERATELY NOT ACCEPTED. Partly done is open, and a gate that reads it as closed
     * is the "known failure" filing this clause exists to stop.
     *
     * The prose scan is KEPT as well, not replaced: a row that says it is done in its title and forgets
     * the cell should still drop out, and removing a working clause in the same pass as adding one is
     * how a fix eats a guard. */
    if (roadmapRowIsClosed(l)) continue;   /* both clauses, extracted above and shared with open_work.js */
    /* THE ROW MUST ASSERT BREAKAGE, NOT MERELY BE FILED TO ENGINE.
     *
     * The first version also counted any row filed to `docs/ENGINE.md`, and that was too loose: it
     * held the gate shut on "hand MEDICHAM to Fable 5 and make it faster" and on a cost measurement
     * that had already been taken. Sixteen rows, of which four were not defects and three were
     * finished the same night.
     *
     * AN OVER-FIRING GATE IS THE ONE PEOPLE LEARN TO IGNORE, which is the failure this file exists to
     * prevent — "one of the two known failures" begins with a bar that cried wolf. So the test is now
     * the row's own CLAIM: it counts when it says a mechanic does not work, is absent, is
     * unimplemented, never fires, or resolves to nothing. A task, an investigation or a measurement is
     * not a defect however it is filed.
     *
     * It still errs shut rather than open: a row whose wording is ambiguous keeps the gate closed until
     * somebody states plainly whether the thing is broken, which is the correct direction. */
    if (!roadmapRowSaysBroken(l)) continue;   /* extracted above and shared with open_work.js */
    const uses = +((l.match(/([\d,]{3,})\s*(uses|clicks)/) || [, '0'])[1].replace(/,/g, '')) || 0;
    open.push({ n: +m[1], uses, title: m[2].replace(/\s+/g, ' ').slice(0, 84) });
  }
  open.sort((a, b) => b.uses - a.uses);
  const weight = open.reduce((s, r) => s + r.uses, 0);
  /* THE ESCAPE HATCH IS PART OF THE VERDICT, AT ZERO AS WELL AS AT SEVEN. A guard that can only be
   * seen when it fires is a guard nobody can tell has stopped running. */
  const excused = NOT_A_DEFECT.slice().sort((a, b) => +a.n - +b.n);
  /* ==============================================================================================
   * A ROW IS EVIDENCE ONLY WHEN AN INSTRUMENT AGREES WITH IT — WILL, 2026-08-15.
   * ==============================================================================================
   * This clause used to hold the whole gate shut on the CONTENTS OF A MARKDOWN TABLE. Three of the
   * eight clauses measure MEDICHAM. This one measured our own bookkeeping, and it is the only one
   * with no visible end: on 2026-08-15 SEARCH closed #276 and #283 and filed #286 and #287 in the
   * same pass, so the count went 4 -> 2 -> 4 while the simulator got strictly MORE correct. Serious
   * work inspects code nobody had inspected and finds things; a clause that counts findings is
   * driven UP by doing the work well, which is the wrong direction for a gate.
   *
   * AND THE REGISTER IS MEASURABLY UNRELIABLE AS A SOURCE. In one session four rows proved stale
   * rather than live: #279 claimed a damage error that dmgRange already got right and had been
   * RANKED FIRST OF FOURTEEN as the place to start; #244 had been fixed for two days with nobody
   * flipping it. A sentence somebody typed was holding the gate shut on a defect that no longer
   * existed — a gate reporting something untrue in the direction that gets gates ignored, which is
   * the exact failure this clause was narrowed to prevent, arriving from the other side.
   *
   * SO IT COUNTS EVIDENCE, NOT SENTENCES. A row holds the gate shut when it names an instrument
   * (VERIFIED BY) and that instrument is RED. engine/register_reality.js runs them and publishes the
   * verdicts to data/register-reality.json.
   *
   * THIS IS NOT A LAUNDERING HOLE, AND THE DIFFERENCE IS THAT NOTHING GOES QUIET. A row with no
   * instrument is DEBT: printed by name, counted, carried in the artifact. It simply cannot hold a
   * gate shut by assertion alone. That is the standard every other clause here already meets — the
   * differential, the rosters and the census all fail on a MEASUREMENT, not on a claim.
   *
   * A row whose instrument is RED still fails this clause exactly as before. The way to make a
   * defect block the gate is to write the test that proves it, which is the work anyway.
   * ============================================================================================ */
  /* ==============================================================================================
   * THE WIRE TO register_reality.js HAD NEVER CARRIED A SINGLE ROW — MEASURED 2026-08-18.
   * ==============================================================================================
   * This block read `rr.rows || rr.verdicts`, `v.command` and `v.exit`. `engine/register_reality.js`
   * writes `results`, `cmd` and `green`. THREE key names, none of them matching, so `_rrows` was `[]`
   * on every run this clause has ever made: every open row fell into `debt`, `withRed` was
   * structurally empty, and the clause printed *"no open row names an instrument that is RED — no open
   * defect is backed by a failing measurement"* for the reason that should have made it loudest.
   * #258 has carried a `VERIFIED BY` since 2026-08-15 and its instrument exits 1 today.
   *
   * THIS IS THE MEGA-MERGE FAILURE, EXACTLY. `merge_mega_into_engine.js` keyed `venusaurmega` where
   * the artifact keyed `venusaur-mega`, zero of 67 writes matched, and nothing compared the two files.
   * CLAUDE.md's answer is that a generated file needs a check that its SOURCE's values are actually in
   * it — so the SHAPE is now declared here, once, and `register_reality.js` WRITES THROUGH IT rather
   * than spelling the keys again. Its selftest round-trips a built artifact back through this reader.
   *
   * AND IT IS NEVER SILENT AGAIN. An artifact that is present, parseable and carries no recognised row
   * array now says so in the verdict instead of degrading into "everything is debt", which is
   * indistinguishable from an honest empty register. */
  const RR = (() => {
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(D('data', REGISTER_REALITY.rowsFile), 'utf8')); }
    catch (e) {
      return { rows: [], why: 'NO VERDICTS — ' + REGISTER_REALITY.rowsFile + ' could not be read ('
        + String((e && e.message) || e).split(String.fromCharCode(10))[0] + '). Every open row below is DEBT because '
        + 'nothing ran, NOT because nothing is broken. Run: node engine/register_reality.js' };
    }
    const rows = registerRealityRows(raw);
    if (rows === null) {
      return { rows: [], why: 'THE VERDICT ARTIFACT CARRIES NO `' + REGISTER_REALITY.rowsKey + '` ARRAY — '
        + REGISTER_REALITY.rowsFile + ' parsed and has keys [' + Object.keys(raw).join(', ') + ']. '
        + 'The reader and the writer disagree about the shape, which is how this wire carried zero rows '
        + 'from the day it was built. Nothing below is evidence.' };
    }
    return { rows, why: null, generated: raw.generated || null };
  })();
  const _byRow = new Map();
  for (const r of RR.rows) _byRow.set(String(r.n), r);
  const EV = registerEvidence(open, _byRow);
  const withRed = EV.withRed, debt = EV.debt, staleRows = EV.staleRows;
  const rejected = EV.rejected, unrunnable = EV.unrunnable;
  const wireLine = RR.why ? '  ' + RR.why : '';
  const rejectedLine = EV.rejectedLine;
  const unrunnableLine = EV.unrunnableLine;
  const debtLine = debt.length
    ? "  " + debt.length + " open row(s) assert breakage with NO instrument that decides them — DEBT, "
      + "not evidence, and they do not hold this clause shut: "
      + debt.map(function (r) { return "#" + r.n; }).join(", ")
      + ". Give one a verdict by adding a VERIFIED BY line naming the gate."
    : "";
  const staleLine = staleRows.length
    ? "  " + staleRows.length + " open row(s) name an instrument that is GREEN — register_reality "
      + "calls those STALE ROW and they are not evidence of a live defect: "
      + staleRows.map(function (r) { return "#" + r.n; }).join(", ") + "."
    : "";
  /* THE RECEIPT SAYS WHICH ROWS THE DOOR ACTUALLY MOVED — see `notADefectSuppresses`. Both numbers
   * are printed: the rows USING the phrase (the audit trail of the escape hatch) and the rows it is
   * genuinely holding out of the gate, which is the number a reader thought they were being told. */
  const suppressing = excused.filter(r => r.suppresses);
  const receipt = `  ${excused.length} open row(s) declare NOT A DEFECT in their status cell and are `
    + `excused from this clause, of which ${suppressing.length} would otherwise have counted as `
    + `broken` + (suppressing.length ? ' (' + suppressing.map(r => '#' + r.n).join(', ') + ')' : '')
    + ` — the rest carry no breakage claim but the phrase's own \`DEFECT\` token, so the override `
    + `only cancels itself on them`
    + (excused.length
      ? ': ' + excused.map(r => '#' + r.n + (r.suppresses ? ' SUPPRESSES' : '')
          + ' [' + r.cell + ']').join('; ') : '.');
  return {
    name: 'no open, known engine defect', ok: withRed.length === 0, open, excused, withRed, debt,
    pins: PIN.noArtifact('this clause reads docs/ROADMAP.md and data/register-reality.json live on every '
      + 'run and records no measurement of its own; it stamps the AGE of what it read rather than '
      + 'carrying a result that could go stale'),
    /* `rejected` IS ITS OWN KEY AND IS NOT SUMMED INTO `unrunnable`. A reader of the artifact gets
     * the same split the sentence gives; one number for both is what this change removed. */
    staleRows, rejected, unrunnable, verdicts_read: RR.rows.length, verdicts_generated: RR.generated || null,
    why: (withRed.length === 0
      ? 'clean: no open row names an instrument that is RED — no open defect is backed by a failing '
        + 'measurement (' + RR.rows.length + ' verdict(s) read)'
      : `${withRed.length} OPEN roadmap row(s) name an instrument that is RED: `
        + withRed.map(r => '#' + r.n + (r.uses ? ' (' + r.uses.toLocaleString() + ' uses)' : '')).join(', ')
        + `. A gate cannot report the engine correct while the register says otherwise — that is `
        + `"known failure" filed one level up.`)
      + receipt + wireLine + rejectedLine + unrunnableLine + debtLine + staleLine,
  };
}

/* ================================================================================================
 * THE ORDER PROBE, AS A CLAUSE — ROADMAP #290's `INSTRUMENT OWED`, BUILT.
 *
 * The row asked for exactly this and named it precisely: *"a gate that FAILS while any row of
 * `data/game-differential.json`'s `order_probe` carries `speed_tied: false` AND `same_priority: true`
 * — that conjunction is the defect itself rather than a proxy for it, and it reads zero the day the
 * turn order is right."*
 *
 * WHY THE CONJUNCTION IS THE DEFECT AND NOT A PROXY. `ordering` is the shape "same event, different
 * slot", and its biggest member is two `|move|` lines naming the same move in different slots — which
 * is what the retired pinned speed tie also looked like, which is why the class was read as an
 * artefact for weeks. `engine/game_differential.js` resolves that by ASKING: it reads both bodies'
 * `getActionSpeed()` off the AUTHORITY and both moves' priority off the format. Two bodies that are
 * NOT tied, clicking at IDENTICAL priority, in a run where every die is pinned on both sides, is a
 * turn-order disagreement with nothing left to be. There is no threshold and no sample to argue
 * about: one such row is one defect.
 *
 * IT READS AT THE TURN BOUNDARY, NOT AT QUEUE-BUILD TIME, and the artifact says so on every row. That
 * makes an EQUAL reading weak evidence (Tailwind can have ended in between) and an UNEQUAL one strong
 * — the asymmetry runs in the safe direction for a gate that only fires on UNEQUAL.
 *
 * FOUR WAYS TO BE RED, AND ONLY ONE WAY TO BE GREEN. A clause that cannot be computed FAILS, which is
 * this file's standing rule everywhere else: no artifact, no probe array, a probe measured against
 * other bytes, or one or more rows carrying the conjunction. GREEN means the probe ran on THIS tree's
 * release and found none. "The probe is absent" must never read as "the turn order is right" — that
 * is the capability-absent-and-everything-reports-success shape this repository is named for.
 *
 * AN EMPTY PROBE ARRAY IS NOT GREEN EITHER. `order_probe: []` on a real run means no move-vs-move
 * ordering pair occurred, which is a fact about the pool rather than about the engine; it passes only
 * when the artifact records a non-zero `games`, and the count of probed pairs is printed beside the
 * verdict so nobody reads 0-of-0 as 0-of-1230.
 * ============================================================================================== */
function orderProbeClause(inject) {
  const NAME = 'turn order / no unequal-speed pair at identical priority (ROADMAP #290)';
  const j = inject !== undefined ? inject : readJson(D('data', 'game-differential.json'));
  if (!j) {
    return { name: NAME, ok: false, why: 'NO ARTIFACT — data/game-differential.json is absent, so the '
      + 'order probe cannot be read. A clause that cannot be computed FAILS. Run engine/game_differential.js.' };
  }
  const probe = Array.isArray(j.order_probe) ? j.order_probe : null;
  if (!probe) {
    return { name: NAME, ok: false, why: 'NO ORDER PROBE — data/game-differential.json carries no '
      + '`order_probe` array. The discriminator did not run, which says nothing about the turn order '
      + 'and must not read as green.' };
  }
  const ranOn = j[PIN.K.id] || j.release || null;
  const bad = probe.filter((r) => r && r.speed_tied === false && r.same_priority === true);
  /* ---- THE FIFTH COPY OF THE SENTENCE, AND THE SECOND CAPTIONED FIGURE — 2026-09-04 -------------
   *
   * This clause is NOT in `medichamIsCorrect()` — it is the `--order-probe` command, run by
   * `engine/register_reality.js` on its exit code — so the assembler's receipt audit does not reach
   * it. It is here because looking for a second instance found one: the same `ranOn && curId &&`
   * (absence answers) AND the same captioned figure `mechanicsClause` had, arguing for itself in as
   * many words — *"the count is still PRINTED, because a listing is not a verdict"*. It printed
   * `probed 1,411 pair(s), 0 carried the conjunction` inside a sentence saying neither figure
   * describes this tree, which is the shape CLAUDE.md names: the number gets quoted and the warning
   * gets skimmed. `PRE-CHANGE` has the receipt.
   *
   * WHAT THIS DOES NOT CLOSE, said plainly: the door itself. A SIXTH clause outside the gate's list
   * is still only caught by somebody calling the guard. Inside the list, `PIN.audit` makes it
   * structural; outside it, this is a fix and not a mechanism. */
  {
    const r = PIN.guard({ name: NAME, file: 'data/game-differential.json', artifact: j,
      need: ['release', 'digests'],
      rerun: 'SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --arm middle '
           + '--games 1200 --team-store data/team-pool-frozen --write' });
    if (r) return r;
  }
  const games = +j.games || 0;
  if (!probe.length) {
    return { name: NAME, ok: games > 0, probed: 0, unequal: 0,
      why: games > 0
        ? `clean by absence: ${games} games produced NO move-vs-move ordering pair to probe. That is a `
          + `fact about the pool, not a demonstration that the turn order is right.`
        : 'AN EMPTY PROBE OVER ZERO GAMES DECIDES NOTHING and does not pass.' };
  }
  const NL = String.fromCharCode(10);
  const seeds = new Set(bad.map((r) => r.seed));
  return {
    name: NAME, ok: bad.length === 0, probed: probe.length, unequal: bad.length,
    games, generated: j.generated || null, engine_release: ranOn,
    why: (bad.length === 0
      ? `clean: ${probe.length} move-vs-move ordering pair(s) probed over ${games} games and every one `
        + `was either speed-tied or at different priority.`
      : `${bad.length} of ${probe.length} PROBED ORDERING PAIR(S) ARE A REAL TURN-ORDER DISAGREEMENT — `
        + `bodies NOT speed-tied, priorities IDENTICAL, every die pinned on both sides. `
        + `${seeds.size} distinct game(s).` + NL
        + bad.slice(0, 12).map((r) => '    gap ' + r.speed_gap + '  ' + String(r.cause || '').slice(0, 64)
          + '   [showdown moved ' + ((r.showdown_first || {}).body || '?') + ' @'
          + ((r.showdown_first || {}).speed) + ', medicham2 moved '
          + ((r.medicham_first || {}).body || '?') + ' @' + ((r.medicham_first || {}).speed) + ']').join(NL))
      + NL + '    [the probe covers move-vs-move pairs only; it is a FLOOR on the ordering class, '
      + 'never a count of it]',
  };
}

/* ---- EVERY CLAUSE SAYS WHAT IT WAS MEASURED UNDER, OR IT IS WITHHELD — 2026-09-04 ---------------
 *
 * `PIN.audit` is applied to the LIST and not to three named clauses, and that is the whole point.
 * Will's acceptance test for a fix here is *would this catch a second instance, spelled differently,
 * through another door?* Three targeted fixes answer no: a FOURTH clause added tomorrow, reading a
 * fourth artifact with no pin at all, would pass on its first run and the only thing that would say
 * so is `engine/sweep.js` — which is itself in sweep §1, the list of checks that nothing invokes.
 *
 * A clause now passes only if it hands back a `pins` receipt naming the artifact it read and what it
 * checked, or declares — with a reason — that it reads no artifact. There is no third state and no
 * inference step: the audit does not go looking for an unreceipted clause's file, because a search
 * that returns null on an ambiguous match is the silent default rebuilt inside the guard against it. */
function medichamIsCorrect() {
  const clauses = PIN.audit([differentialClause(), ...ROSTER_STAGES.map(s => {
    const r = rosterStage(s);
    return { ...r, name: `deliberate roster / ${s}` };
  }), coverageClause(), wholeGameClause(), narrationClause(), mechanicsClause(), openDefectClause()]);
  /* ==============================================================================================
   * A CLAUSE MAY REPORT WITHOUT GATING, AND IT MUST SAY SO IN ITS OWN RETURN — 2026-09-04.
   * ==============================================================================================
   * `gates === false` is OPT-IN and defaults to gating. A clause added tomorrow that forgets the
   * field holds the gate shut, which is the safe direction; the unsafe default would be a new clause
   * that quietly reports and blocks nothing, which is the silent-default shape CLAUDE.md opens with.
   *
   * ONLY `narrationClause` SETS IT, and only because Will took that decision by name on 2026-08-22.
   * It is not a general-purpose escape hatch: `PIN.audit` runs FIRST, so a reporting clause that
   * cannot say what it was measured under is still withheld, and `failing` still carries it — a
   * reader of `status.js` sees the red row whether or not the gate turned on it.
   *
   * `failing` AND `gate_failing` ARE DIFFERENT LISTS AND BOTH ARE PUBLISHED. Collapsing them would
   * make "8 of 9 clauses fail" and "the gate is open" appear together, which is the pair of
   * contradictory sentences this file's own printer shipped on 2026-08-11. */
  return gateVerdict(clauses);
}

/* THE RULE, AS A FUNCTION, SO THE SELFTEST DRIVES THE SHIPPING ONE AND NOT A COPY OF IT.
 *
 * The first draft of the arms asserted this rule against a five-line reimplementation written beside
 * them, and it was CAUGHT by a deliberate break: setting `gating = clauses` — narration back on the
 * gate, the whole point of the 2026-08-22 ruling undone — left the selftest at 210 passed, 0 failed.
 * A test of a copy is a test of the copy. `medichamIsCorrect` cannot be driven on synthetic rows
 * because it reads live artifacts, so the RULE is what gets extracted, not the assembler. */
function gateVerdict(clauses) {
  const gating = clauses.filter(c => c.gates !== false);
  return { ok: gating.every(c => c.ok), clauses,
           failing: clauses.filter(c => !c.ok),
           gate_failing: gating.filter(c => !c.ok),
           reporting: clauses.filter(c => c.gates === false) };
}

/* ================================================================================================
 * 2. THE MEMBERSHIP TEST — what is downstream of MEDICHAM
 * ================================================================================================
 * DERIVED FROM ONE ROOT, not from a list of filenames. A hand-maintained list of quarantined
 * artifacts would be the hand-maintained-ban-list failure this project's instructions open with, and
 * it would rot the first time somebody adds a model.
 *
 * THE PLAY LAYER is the transitive closure of "requires the simulator", seeded with the single file
 * `engine/medicham2-browser.js`. board.js reaches it through damageEngine(); rollout_leaf, miltank,
 * fit_policy, mag_bot and the rest reach it through board. 63 modules fall out of one root, and a
 * module added tomorrow joins by existing.
 *
 * AN ARTIFACT IS QUARANTINED if its generator is in the play layer, or if it reads a file that a
 * play-layer module wrote, or if it reads another quarantined artifact. The second clause is what
 * catches `data/rollout-r1.json` and `data/rollout-r4.json`, whose generators require nothing at all
 * and simply read a row dump or a self-play store that the play layer produced. A number computed off
 * a dump of MEDICHAM's games is a number MEDICHAM produced, however few modules the reader imports.
 *
 * WHAT IS DELIBERATELY *NOT* QUARANTINED, AND WHY THE STRICT DIRECTION IS THE DANGEROUS ONE.
 * The census, the interaction matrix, the game differential, the deliberate roster and the release
 * ladder MEASURE MEDICHAM. They are the instruments that will say when the quarantine can lift, so
 * withholding them would blind the project to its own exit condition — a quarantine that can never
 * lift is as broken as one that never engages. Most of them fall out on their own: they are written
 * by `tests/` or they drive the official engine through a subprocess or a frozen release, so they
 * never enter the closure. ONE does not, and it is declared below with its reason.
 */

const SIMULATOR = 'engine/medicham2-browser.js';

/* THE ONE THING THE GRAPH CANNOT EXPRESS, DECLARED WITH ITS REASON — the RAW-STORE-OK convention.
 *
 * MEASURED, not assumed: `engine/game_differential.js` and `engine/backtest_winrate.js` have the same
 * graph signature. Both load the simulator, both load Showdown, both play games. The only difference
 * is which QUESTION the artifact answers — the differential's number is "how often do the two engines
 * disagree", which is a measurement OF medicham and is exactly what the gate above reads; the
 * backtest's number is "how good is the leaf", which is a measurement THROUGH medicham. That
 * distinction is not present in either file's source, so no derivation can find it and a declaration
 * is the honest instrument.
 *
 * It is CHECKED rather than trusted: an exemption naming a module that is not in the play layer is a
 * claim that has quietly become false, and `--check` fails on it. That is the same discipline
 * tests/roster.js applies to its own DECLARED divergences ("a declared divergence that matched
 * nothing is a claim that has quietly become false"). */
const MEASURES_THE_ENGINE = [
  { module: 'engine/game_differential.js',
    why: 'MEDICHAM is its SUBJECT, not its input: it drives the official Showdown engine and ours '
       + 'over identical inputs and reports the disagreements. Its value does not depend on MEDICHAM '
       + 'being right — it is how we find out. It is the first clause of the gate above.' },
  { module: 'engine/derive_protocol_events.js',
    why: 'it loads the simulator only to read the event list it CLAIMS it can emit, and checks that '
       + 'claim against Showdown\'s own add() call sites. The artifact is the comparison, not a '
       + 'quantity MEDICHAM computed — and quarantining it would have withheld the game differential '
       + 'downstream of it, which is the gate\'s own first clause.' },
];

function stripComments(s) {
  /* A NAME DISCUSSED IN PROSE IS NOT A DEPENDENCY. provenance.js records the same lesson twice (a
   * comment credited this very file with generating pokemon-roles.json; a comment one file away
   * picked the corpus for winrate-backtest.json). A require inside a comment block is a citation. */
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function sources() {
  const src = {};
  for (const dir of ['engine', 'build']) {
    /* ROADMAP #258: this was the one read in `sources()` that stayed silent while the read one line
     * below it already reported. An unlistable `engine/` returns an EMPTY source map, and every
     * membership test in this file is derived from that map — so the quarantine set would come back
     * empty and the gate would read clean for the reason that should make it loudest. */
    let list = []; try { list = fs.readdirSync(D(dir)); } catch (e) { SWALLOWED.push('list ' + dir + '/ for sources' + ': ' + why(e)); continue; }
    for (const f of list) {
      if (!/\.js$/.test(f)) continue;
      try { src[dir + '/' + f] = fs.readFileSync(D(dir, f), 'utf8'); } catch (e) { SWALLOWED.push('readSource ' + dir + '/' + f + ': ' + why(e)); }
    }
  }
  return src;
}

/* Local module dependencies, in the three spellings this repository actually uses:
 *   require('./board.js')                      the ordinary one
 *   REL.require('engine/board.js')             the frozen-release loader — a real dependency that
 *                                              names the path from the repo root rather than relatively
 *   require(D('engine','board.js'))            occasionally, through the path helper
 * A module reached only by execFileSync is NOT a require: a subprocess is a separate process with its
 * own release, which is precisely how wire_ladder.js orchestrates the differential without inheriting
 * its engine. */
function requiresOf(src, id) {
  const code = stripComments(src[id] || '');
  const out = new Set();
  for (const m of code.matchAll(/require\(\s*['"]\.\/([A-Za-z0-9_.-]+?)(?:\.js)?['"]/g)) out.add('engine/' + m[1] + '.js');
  for (const m of code.matchAll(/\.require\(\s*['"](engine\/[A-Za-z0-9_.-]+\.js)['"]/g)) out.add(m[1]);
  for (const m of code.matchAll(/require\(\s*D\(\s*['"]engine['"]\s*,\s*['"]([A-Za-z0-9_.-]+\.js)['"]/g)) out.add('engine/' + m[1]);
  return [...out].filter(x => src[x]);
}

function playLayer(src) {
  const play = new Set([SIMULATOR]);
  for (let i = 0; i < 32; i++) {
    let grew = false;
    for (const id of Object.keys(src)) {
      if (play.has(id)) continue;
      if (requiresOf(src, id).some(r => play.has(r))) { play.add(id); grew = true; }
    }
    if (!grew) break;
  }
  return play;
}

/* Files a play-layer module WRITES that are not artifacts in the graph — row dumps and self-play game
 * stores. These are MEDICHAM's output in the most literal sense, and a generator that reads one is
 * reporting on games MEDICHAM played. */
function playProducts(src, play) {
  const out = new Set();
  const WRITE = /writeFileSync|createWriteStream|appendFileSync/;
  for (const id of play) {
    for (const ln of stripComments(src[id] || '').split('\n')) {
      if (!WRITE.test(ln)) continue;
      for (const m of ln.matchAll(/['"]([A-Za-z0-9_.\-]+\.jsonl)['"]/g)) out.add(m[1]);
    }
  }
  /* AND EVERY ROW DUMP AND SELF-PLAY STORE ON DISK, because the literal filename is usually not in the
   * writer at all. `rollout_r1.js` resolves its dump from a `DUMP` environment variable and `mew.js`
   * takes its output store as an argument, so scanning writers for string literals finds neither —
   * and those two are exactly the runs behind R1 and R4, the gates whose generators require nothing
   * and simply read what a previous run left behind.
   *
   * THE STORE IS UPSTREAM OF THE SIMULATOR, NOT DOWNSTREAM, and that is the boundary that must not be
   * got wrong in the strict direction. `games.ladder.jsonl`, `games.bo3.jsonl` and `games.ots.jsonl`
   * are HUMAN replays that OPS ingests; nothing MEDICHAM does can change a byte of them, so everything
   * OPS reports out of them — usable %, battles recorded, meta-usage — stays quotable while the gate
   * is closed. They are identified by their INGEST WRITER rather than by name, so a store added by a
   * new collector is exempt for the right reason instead of by spelling. Everything else under data/
   * with a .jsonl extension is something one of our own runs produced. */
  const ingested = new Set();
  /* WHO COLLECTS IS THE AUTHORITY ON WHAT IS COLLECTED. The hourly Action is what actually pulls
   * replays into this repository, so the stores it names are the ones nothing of ours produced.
   * `engine/durable-ingest.js` names none of them — it takes the path as an argument — which is why
   * reading the ingest SCRIPTS alone left `games.bo3.jsonl` classed as one of our own runs and
   * quarantined every OPS figure counted off it. */
  const collectors = ['.github/workflows/ingest.yml'];
  for (const f of fs.existsSync(D('engine')) ? fs.readdirSync(D('engine')) : []) {
    if (/ingest/i.test(f) && /\.(js|py)$/.test(f)) collectors.push('engine/' + f);
  }
  {
    for (const rel of collectors) {
      /* ROADMAP #258: silence here has a DIRECTION and it is the expensive one. A collector we cannot
       * read contributes no store names, so its stores stay classed as something one of our own runs
       * produced — which is precisely the failure the comment above records, where `games.bo3.jsonl`
       * quarantined every OPS figure counted off it. The absent case is still allowed (a checkout
       * without `.github/` is legitimate); the UNREADABLE case is reported, because those two are not
       * the same event and only the first one is benign. */
      let s = '';
      try { s = fs.readFileSync(D(rel), 'utf8'); }
      catch (e) {
        if (fs.existsSync(D(rel))) SWALLOWED.push('read collector ' + rel + ' for store names' + ': ' + why(e));
        continue;
      }
      for (const m of stripComments(s).matchAll(/(games\.[A-Za-z0-9_.\-]+?)(?:\.jsonl)\b/g)) {
        /* THE GREEDY CAPTURE ATE THE EXTENSION and produced `games.ladder.jsonl.jsonl`, so NOTHING was
         * ever removed from the product set and every store reader in the repository was quarantined —
         * including data/live.js and data/meta-usage.json, which are OPS's and are explicitly NOT
         * quarantined. Caught by reading the output rather than by trusting the regex. */
        const base = m[1].replace(/\.jsonl$/, '').replace(/\.raw-logs$/, '');
        ingested.add(base + '.jsonl');
        ingested.add(base + '.raw-logs.jsonl');
      }
    }
  }
  let disk = []; try { disk = fs.readdirSync(D('data')); } catch (e) { SWALLOWED.push('scan data/ for jsonl stores' + ': ' + why(e)); }
  for (const f of disk) if (/\.jsonl$/.test(f) && !ingested.has(f)) out.add(f);
  for (const f of ingested) out.delete(f);
  return out;
}

/* WHAT MEDICHAM READS IS NOT WHAT MEDICHAM PRODUCED.
 *
 * `data/tags.json`, `data/abra-tags.js` and `data/engine-data.js` are the rulebook and the species
 * table the simulator READS. Their generators require the simulator — `tag_dex.js` uses it to resolve
 * a move's shape — so a naive closure marks them downstream and then drags in everything that reads
 * them, including the game differential itself. That is the strict-direction error CLAUDE.md warns
 * about: it would withhold the tag file the engine is fixed WITH, and the instrument that says when
 * the fixing is done.
 *
 * The set is not typed here. `provenance.js` already derives which files are ENGINE INPUTS — the same
 * list `status.js` reads for the refit edge — and an artifact that IS one, or that one is built FROM,
 * sits upstream of the arrow in docs/DIVISIONS.md rather than to the right of it. */
function engineInputArtifacts(g) {
  const out = new Set();
  try {
    const s = fs.readFileSync(D('engine', 'provenance.js'), 'utf8');
    const m = s.match(/ENGINE_INPUTS\s*=\s*\[([^\]]*)\]/);
    if (!m) return out;
    for (const n of m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)) out.add(n);
  } catch (e) { SWALLOWED.push('parse the ingest workflow for collector names' + ': ' + why(e)); return out; }
  if (!Array.isArray(g)) return out;
  const by = new Map(g.map(a => [a.file, a]));
  for (let i = 0; i < 16; i++) {
    let grew = false;
    for (const f of [...out]) {
      const a = by.get(f);
      if (!a) continue;
      for (const dep of a.from || []) {
        if (/\.jsonl$/.test(dep) || dep.includes('/')) continue;   // stores and engine sources, not artifacts
        if (!out.has(dep)) { out.add(dep); grew = true; }
      }
    }
    if (!grew) break;
  }
  return out;
}

function graph() {
  /* ONE DERIVATION OF THE ARTIFACT GRAPH, and it is provenance.js's. status.js shells out to
   * provenance.js rather than reimplementing its staleness rules; this does the same for its edges. */
  try {
    return JSON.parse(execFileSync(process.execPath, [D('engine', 'provenance.js'), '--graph', '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 26 }));
  } catch (e) {
    return { error: String((e && e.message) || e).split('\n')[0] };
  }
}

function classify(opts = {}) {
  const src = opts.src || sources();
  const play = opts.play || playLayer(src);
  const exempt = new Map((opts.exemptions || MEASURES_THE_ENGINE).map(e => [e.module, e.why]));
  const products = opts.products || playProducts(src, play);
  const g = opts.graph || graph();
  const staleExemptions = [...exempt.keys()].filter(m => !play.has(m));

  if (g.error) return { error: g.error, play, exempt, staleExemptions };

  const upstream = opts.upstream || engineInputArtifacts(g);
  /* A row dump is almost never in provenance's `from` — that arm tracks .json/.js artifacts and the
   * game stores, not an arbitrary .jsonl — so the generator's own source is asked directly. */
  /* NEAR A READ VERB, exactly as provenance.js does it, and for the reason it learned: a bare
   * substring match turned every filename mentioned anywhere into a dependency and gave one artifact
   * seventeen of them. A dump named in a usage string or an error message is not a dump being read. */
  const READ = /readFileSync|createReadStream|require\s*\(|open\s*\(|read_json|json\.load|loadGames|load_games/;
  const WROTE = /writeFileSync|createWriteStream|appendFileSync|json\.dump/;
  const namesProduct = (id) => {
    const code = stripComments(src[id] || '');
    const hits = [];
    /* A READ VERB IS THE STRONG SIGNAL, AND A BARE MENTION IS THE COMMON ONE. Both R1 and R4 — the two
     * gates this clause exists to catch — bind their input through a default:
     *     const ROWS   = argv.find(a => !a.startsWith('--')) || 'data/rollout-r1-rows.jsonl';
     *     const CORPUS = argv.find(a => !a.startsWith('--')) || 'data/games.r4-decided.jsonl';
     * There is no read verb on either line; the read happens hundreds of lines later through the
     * identifier. Requiring proximity to a read verb found NEITHER, which is how the first version of
     * this file cleared R1 and R4 — the two artifacts CLAUDE.md's quarantine list names first.
     *
     * So a product named in LIVE CODE counts unless this generator is the one that WRITES it: naming a
     * dump you do not write is reading it. Comments are stripped first, so a filename discussed in
     * prose still does not count — the fault provenance.js records twice about itself. */
    for (const p of products) {
      let i = code.indexOf(p), mention = false, written = false;
      while (i >= 0) {
        /* A SUBSTRING IS NOT A FILENAME. `rows.jsonl` is a substring of `rollout-r1-rows.jsonl`, which
         * is provenance.js's `ladder.json` inside `games.ladder.jsonl` fault in a new pair of names —
         * it credited R1 with reading a dump it has never heard of. The character before the match
         * must not continue the name. */
        if (/[A-Za-z0-9_.\-]/.test(code[i - 1] || '')) { i = code.indexOf(p, i + 1); continue; }
        const near = code.slice(Math.max(0, i - 140), i + 60);
        if (WROTE.test(near)) written = true; else mention = true;
        i = code.indexOf(p, i + 1);
      }
      if (mention && !written) hits.push(p);
    }
    return hits;
  };

  /* AN UNKNOWN ROW MAY NOT ENTER THE CLASSIFICATION, AND THIS IS THE WHOLE POINT OF THE CHANGE.
   *
   * provenance.js now emits a row for every file in data/, including the ones it cannot name a writer
   * for (`unknown: true`, `by: null`). That is what stops the set being invisible. It is also, if it
   * were fed straight into the loop below, exactly how the set would be silently CLEARED: `by` is
   * null, so `play.has(null)` is false, so no clause fires, so `quarantined` comes out false and the
   * artifact reads as examined-and-fine. `web/build-quarantine.js` asks only whether a row exists, so
   * that page would have gone from "unclassified" to "clear" for twenty artifacts on this change
   * alone — a default in the permissive direction, arriving through a fix to the thing that refuses
   * to default. They are split out here and reported as unknowns, which is what they are. */
  const known = g.filter(a => !a.unknown);
  const unknownRows = g.filter(a => a.unknown);
  const rows = new Map();
  for (const a of known) {
    const consumes = play.has(a.by) && !exempt.has(a.by);
    const reads = (a.from || []).filter(f => products.has(f) || products.has(f.replace(/^data\//, '')));
    const dumps = reads.length ? [] : namesProduct(a.by);
    let reason = null;
    if (upstream.has(a.file)) reason = null;      /* what the simulator READS is upstream of it */
    else if (consumes) reason = `its generator ${a.by} is in the play layer (it reaches ${SIMULATOR} through require)`;
    else if (reads.length) reason = `${a.by} reads ${reads.join(', ')}, which one of our own runs wrote`;
    else if (dumps.length) reason = `${a.by} reads ${dumps.slice(0, 2).join(', ')} — a dump of games MEDICHAM played`;
    rows.set(a.file, { file: a.file, by: a.by, from: a.from || [], quarantined: !!reason, reason,
                       upstream: upstream.has(a.file),
                       exempt: exempt.has(a.by) ? exempt.get(a.by) : null });
  }
  /* TRANSITIVE: an artifact that reads a quarantined artifact carries the quarantine. This is what
   * puts data/weight-multiplicity.json, data/mag.js, data/scoreboard.js and data/ladder.json in the
   * set — they read policy-weights.json, and the weights were fitted on features computed through a
   * simulator we know is wrong. The refit is exactly the event that clears them, and it is gated. */
  for (let i = 0; i < 32; i++) {
    let grew = false;
    for (const r of rows.values()) {
      if (r.quarantined || r.upstream) continue;
      const hit = r.from.find(f => rows.has(f) && rows.get(f).quarantined);
      if (hit) { r.quarantined = true; r.reason = `it reads ${hit}, which is quarantined`; grew = true; }
    }
    if (!grew) break;
  }
  return { rows, play, exempt, staleExemptions, products, unknownRows };
}

/* THE ONE ENTRY POINT EVERY CALLER USES. status.js asks two questions — is the gate open, and is this
 * artifact in the set — and must never grow its own answer to either. */
/* ARTIFACTS THE GRAPH CANNOT NAME A WRITER FOR, reported rather than guessed at.
 *
 * THEY ARE NOT DEFAULTED EITHER WAY, and that is deliberate. The set holds both instruments (the
 * census) and consumers (`exploitability-holdout.json`, seven `policy-weights-*.json` variants), so
 * defaulting to CLEAN hides a withheld figure and defaulting to HELD withholds the instrument that
 * says when the quarantine lifts. An unknown that is silently resolved either way is the failure this
 * whole file exists to stop, so it is printed as an unknown.
 *
 * IT IS READ FROM provenance.js NOW, NOT SUBTRACTED FROM A DIRECTORY LISTING.
 *
 * This function used to list `data/` and remove everything the graph had a row for. That is a second
 * derivation of provenance.js's own answer, living in the caller, and it came with its own
 * explanation of WHY the graph could not see those files — a sentence saying the writer scan reads
 * "engine/ and build/" only, which stopped being true on 2026-08-09 when it learned to read tests/.
 * Twenty artifacts were being explained by a reason that no longer applied to any of them, and
 * nothing could tell, because the subtraction produces the same list whatever the cause. provenance.js
 * now emits an explicit unknown row carrying a DERIVED reason per file, and this reads it.
 *
 * THE SUBTRACTION SURVIVES AS A CROSS-CHECK AND NOTHING MORE. If a file on disk appears in neither
 * set, that is a hole in provenance.js's own scan rather than an unknown artifact, and the two are
 * different bugs. It is reported under its own heading instead of being folded in — folding it in is
 * how the last explanation came to cover a set it did not describe. */
function unclassified(rows, unknownRows) {
  const out = (unknownRows || []).map(r => r.file);
  let disk = []; try { disk = fs.readdirSync(D('data')); } catch (e) { SWALLOWED.push('scan data/ for unclassified artifacts' + ': ' + why(e)); return out; }
  for (const f of disk) {
    if (!/\.(json|js)$/.test(f) || /^games\./.test(f) || /\.meta\.json$/.test(f)) continue;
    if ((rows && rows.has(f)) || out.includes(f)) continue;
    /* NOT pushed onto SWALLOWED: that channel means "a read this gate is allowed to miss", and this
     * is not a read that failed — it is an artifact provenance.js never examined, which is a hole in
     * the scan rather than a permitted gap. It joins the unknown set with NO reason attached, and the
     * printer says exactly that, so the two cannot be confused by a reader. */
    out.push(f);
  }
  return out.sort();
}

/* WITHHOLD is the question a caller actually has, and it is deliberately ONE function rather than two
 * facts a caller has to combine — combining them wrongly (printing while the gate is closed) is the
 * only way left to reintroduce the bug this file closes.
 *
 * IT TAKES THE GATE AS AN ARGUMENT so the selftest can drive the REAL function with a passing gate and
 * with a failing one. A `--force-open` flag would have done the same job and would have been a hole:
 * anything that can silence this from the command line eventually does, which is why provenance.js's
 * `void` is one-way and has no `valid: true`. A parameter is visible in the caller; a flag is not. */
function withholder(gate, rows) {
  const set = new Set();
  if (rows) for (const r of rows.values()) if (r.quarantined) set.add(r.file);
  const fn = function withhold(file) {
    if (gate.ok) return null;
    const f = String(file).replace(/^data\//, '');
    if (!set.has(f)) return null;
    const r = rows && rows.get(f);
    return {
      file: 'data/' + f,
      because: r ? r.reason : 'downstream of ' + SIMULATOR,
      rerun: r ? `node ${r.by}` : null,
      /* THE CLAUSE SUMMARY IS A COUNT, NOT THE FIRST CLAUSE'S PROSE. Repeating one clause's full
       * sentence under every withheld line printed the same 150 characters six times and buried the
       * fact that the other three clauses fail too. The banner carries the detail once. */
      clause: `${gate.failing.length} of ${gate.clauses.length} gate clauses fail `
            + `(${gate.failing.map(c => c.name).join('; ')})`,
    };
  };
  fn.set = set;
  return fn;
}

let CACHE = null;
function state() {
  if (CACHE) return CACHE;
  const gate = medichamIsCorrect();
  const c = classify();
  const withhold = withholder(gate, c.rows);
  CACHE = {
    ok: gate.ok, gate, rows: c.rows, error: c.error, play: c.play,
    staleExemptions: c.staleExemptions || [],
    unclassified: unclassified(c.rows, c.unknownRows),
    unknownRows: c.unknownRows || [],
    withhold,
    set: withhold.set,
  };
  return CACHE;
}

module.exports = { medichamIsCorrect, classify, state, withholder, playLayer, sources, requiresOf,
                   MEASURES_THE_ENGINE, ROSTER_STAGES, rosterStage, SIMULATOR,
                   /* EXPORTED FOR engine/open_work.js SO THERE IS ONE CLOSED-DETECTOR, NOT TWO.
                    * CLAUDE.md: two files that both decide a fact will disagree eventually, and the
                    * disagreement will be invisible because both keep working. This gate and the work
                    * list must never differ on whether a row is closed. */
                   roadmapRowIsClosed, roadmapRowSaysBroken, openDefectClause,
                   /* THE TWO FILTERS, EXPORTED SO THE BAR IS ONE IMPLEMENTATION. Anything that wants
                    * to ask "does anybody play this" or "has a paired run cleared this" imports these
                    * rather than re-deriving them — `buildMon("Scizor")` returned null because a second
                    * version of something that already existed got hand-rolled beside it. */
                   /* THE SHAPE CONTRACT FOR data/register-reality.json, EXPORTED SO ITS WRITER
                    * WRITES THROUGH IT. Three mismatched key names carried zero rows across this
                    * wire from the day it was built; see openDefectClause. */
                   /* EXPORTED SO THE SELFTEST DRIVES THE SHIPPING SPLIT. It is the only place that
                    * decides which of the two null-verdict facts a row carries. */
                   REGISTER_REALITY, registerRealityRows, registerEvidence, orderProbeClause,
                   REACH_SHELF_CLICKS, DECISION_POINTS_FLOOR, reachShelf,
                   reachOf, usageIndex, reachDrift, decisionImpact, mechanicsClause,
                   classifyMechanics,
                   /* ROADMAP #292 — exported so a test can hand it a KNOWN artifact and read the
                    * composition it prints. Its `artifact` argument already existed; without the
                    * export the only way to check that the composition and the headline describe the
                    * SAME run was to read the source, which is how they came to describe two. */
                   wholeGameClause,
                   /* SPLIT 2026-09-04 ON WILL'S 2026-08-22 RULING. `wholeGameClause` is now the
                    * BOARD-MATERIAL clause and it GATES; `narrationClause` is the protocol
                    * first-divergence clause and it REPORTS. Both are exported, both name their
                    * quantity in `quantity` and in the first words of `why`, and neither restates the
                    * other — `wholeGameDoor` is the one read and the one refusal for both.
                    *
                    * A CONSUMER THAT WANTS THE PROTOCOL COMPOSITION NOW WANTS `narrationClause`:
                    * `data/game-differential.json`'s `classes[].causes[]` are protocol causes, so the
                    * shape composition ROADMAP #292 pinned belongs to that clause and moved with it. */
                   narrationClause, gateVerdict, clauseExit };

/* THE ONE PLACE A CLAUSE BECOMES AN EXIT CODE — `--order-probe`, `--whole-game` and anything added
 * after them. It was two copies of one expression the moment the second command existed, and this
 * repository's rule is that two implementations of one fact disagree eventually and the disagreement
 * is invisible because both keep working.
 *
 *   0  the clause passes.
 *   1  the defect is PRESENT.
 *   2  the clause CANNOT ANSWER — no artifact, or one measured against other bytes (#298).
 *
 * BOTH NON-ZERO CODES ARE RED TO `register_reality.js`, deliberately. Separating them is legibility,
 * not leniency: a `VERIFIED BY` exiting 0 because the artifact was missing would report the row STALE
 * and close a live defect, which is the loudest failure an audit tool has. */
function clauseExit(r) {
  if (!r) return 2;
  if (r.ok === true) return 0;
  return (r.cannot_answer || r.withheld) ? 2 : 1;
}

/* ================================================================================================
 * 3. CLI — report, derivation, gate, selftest
 * ============================================================================================== */
if (require.main === module) {
  const ARG = process.argv.slice(2);
  const has = f => ARG.includes(f);

  /* STAMPING THE WHOLE-GAME BAR IS AN EXPLICIT ACT, NEVER A SIDE EFFECT OF A RUN.
   *
   * `wholeGameClause` fails when no baseline exists, and that is deliberate: a ratchet that seeds
   * itself from whatever the last run happened to produce is not a bar somebody chose, it is a number
   * that arrived. Every other ratchet in this repo learned the same thing the same way — the mc-key
   * baseline and the docs-currency census both require `--update` and both record what moved.
   *
   * IT REFUSES TO STAMP A WORSE NUMBER. A baseline may only ratchet DOWN; raising one is how a gate
   * quietly becomes decoration, and the only two files that have raised a baseline tonight did it with
   * the audit written into the register beside the diff. */
  if (has('--stamp-whole-game')) {
    const j = readJson(D('data', 'game-differential.json'));
    if (!j || !j.games) { console.error('NO RUN TO STAMP — data/game-differential.json is absent or empty.'); process.exit(2); }
    if (j.planted_divergence_proof_ok !== true) {
      console.error('REFUSING — the planted-divergence proof did not fire in that run, so its rate is not a bar.');
      process.exit(2);
    }
    const rate = j.diverged / j.games;
    const prev = readJson(D('data', 'whole-game-baseline.json'));
    if (prev && typeof prev.rate === 'number' && rate > prev.rate && !has('--force')) {
      console.error('REFUSING — ' + (100 * rate).toFixed(1) + '% is WORSE than the standing '
        + (100 * prev.rate).toFixed(1) + '%. A baseline may only ratchet down. Pass --force with a '
        + 'register row saying why, the way every other raised baseline in this repo is recorded.');
      process.exit(2);
    }
    fs.writeFileSync(D('data', 'whole-game-baseline.json'), JSON.stringify({
      what: 'THE BAR FOR engine/game_differential.js — the same game played through BOTH engines with '
          + 'real sheets and real natures, every die pinned identically on both sides. NOT ZERO, and '
          + 'the clause says so on every run: mode A makes any difference a rule bug, so the honest '
          + 'target is 0 and this is a ratchet toward it rather than a definition of correct.',
      rate, games: j.games, diverged: j.diverged,
      engine_release: j.engine_release || null,
      mode: j.mode || null,
      stamped: new Date().toISOString(),
      by: 'engine/quarantine.js --stamp-whole-game',
    }, null, 2) + '\n');
    console.log('stamped whole-game baseline: ' + j.diverged + ' of ' + j.games
                + ' = ' + (100 * rate).toFixed(1) + '%'
                + (prev ? '   (was ' + (100 * prev.rate).toFixed(1) + '%)' : '   (first bar)'));
    process.exit(0);
  }

  /* ---- --order-probe: ROADMAP #290's GATE, RUNNABLE AND WITH AN EXIT CODE ----------------------
   *
   * `engine/register_reality.js` runs whatever a register row names in `VERIFIED BY` and compares the
   * EXIT CODE to the row's open/closed status. #290 therefore needs a command, not a clause buried in
   * a report — so this is the clause with a process exit attached and nothing else. It reads an
   * artifact, runs no games and loads no simulator, so a register sweep can afford to call it.
   *
   * EXIT 1 ON EVERY RED, INCLUDING "CANNOT ANSWER". A `VERIFIED BY` whose command exited 0 because the
   * artifact was missing would report the row STALE and close a live defect — the loudest failure this
   * repository has, arriving through its own audit tool. */
  if (has('--order-probe')) {
    const r = orderProbeClause();
    console.log('');
    console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name);
    console.log('  ' + r.why);
    if (r.engine_release) console.log('  artifact: data/game-differential.json  generated '
      + (r.generated || '?') + '  release ' + r.engine_release);
    console.log('');
    /* TWO NON-ZERO CODES, AND BOTH ARE RED TO `register_reality.js` ON PURPOSE.
     *   1  the defect is PRESENT — a pair not speed-tied at identical priority.
     *   2  the clause CANNOT ANSWER — no artifact, no probe, or a probe cut against other bytes.
     * The mapping itself is `clauseExit`, one implementation for every command here. */
    process.exit(clauseExit(r));
  }

  /* ---- --whole-game: ROADMAP #218's GATE, RUNNABLE AND WITH AN EXIT CODE -----------------------
   *
   * #218 is *"the whole-game differential says 39.6% of games diverge, IT GATES NOTHING"*. The gating
   * half landed in 2026-08-12 as clause 7 of 7 — and a clause inside a four-minute report is not a
   * thing `engine/register_reality.js` can run, so the row went on having no instrument and #297's
   * closed-detector repair reopened it. This is the same clause with a process exit attached and
   * nothing else: it reads an artifact, runs no games and loads no simulator, so a register sweep can
   * afford to call it.
   *
   * IT CALLS `wholeGameClause` AND DOES NOT RESTATE IT. Two implementations of one verdict disagree
   * eventually and the disagreement is invisible because both keep working.
   *
   * EXIT 2 IS THE #298 BRANCH AND IT IS RED. An artifact measured against other bytes withholds every
   * figure, so this cannot answer — and a `VERIFIED BY` that exited 0 there would report the row STALE
   * and close a live defect on the strength of a run nobody could read. */
  if (has('--whole-game')) {
    const r = wholeGameClause();
    console.log('');
    console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name);
    console.log('  ' + r.why);
    console.log('');
    console.log('  exit ' + clauseExit(r)
              + '   [0 no board parts in any game, 1 at least one does, 2 cannot answer]');
    console.log('  THE QUANTITY CHANGED ON 2026-09-04 AND THE COMMAND DID NOT. This printed the'
              + ' PROTOCOL first-divergence count until then; it now prints BOARD-MATERIAL games,'
              + ' which is Will\'s 2026-08-22 bar. For the protocol number use --narration. Any'
              + ' figure quoted from this command before 2026-09-04 is the other quantity.');
    console.log('');
    process.exit(clauseExit(r));
  }

  /* ---- --narration: THE SECOND HALF OF THE SPLIT, WITH ITS OWN EXIT CODE ----------------------
   *
   * It has a command for the same reason the board clause has one: *"the narration gate is a GATE,
   * not a backlog."* A quantity that only appears inside a four-minute report is a quantity nothing
   * can be ratcheted against, which is how ROADMAP #218 came to have no instrument for six days.
   * This exits 1 while narration is red — it simply is not what `medichamIsCorrect()` asks. */
  if (has('--narration')) {
    const r = narrationClause();
    console.log('');
    console.log((r.ok ? 'PASS  ' : 'RED   ') + r.name);
    console.log('  ' + r.why);
    console.log('');
    console.log('  exit ' + clauseExit(r)
              + '   [0 the protocol never parts, 1 it does, 2 cannot answer]'
              + '   — this clause does NOT hold the quarantine gate shut; --whole-game does.');
    console.log('');
    process.exit(clauseExit(r));
  }

  /* ---- --reach: THE MECHANICS CLAUSE'S POPULATION, SHOWN RATHER THAN SUMMARISED ----------------
   *
   * The clause prints a count. This prints the rows behind it, because a filter nobody can inspect is
   * a filter people argue with — the closet learned that first. It calls `classifyMechanics`, the same
   * function the clause decides on, so the two cannot disagree.
   *
   * IT SAYS WHEN THE ARTIFACT IS STALE AND IT DOES NOT REFUSE TO PRINT. The clause must refuse — a
   * verdict about other bytes is a wrong verdict. A LISTING is not a verdict, and being able to see
   * which mechanics are in play before paying for a re-run is the whole point of it. The staleness is
   * printed first and in full so no reader can take these rows for the current engine. */
  if (has('--reach')) {
    const j = readJson(D('data', 'all-mechanics-fire.json'));
    if (!j) { console.error('NO ARTIFACT — data/all-mechanics-fire.json is absent.'); process.exit(2); }
    const cur = readJson(D('data', 'engine-release.json'));
    const curId = cur && (cur.id || cur.release || cur.current);
    const ranOn = j.release || j.engine_release || null;
    const C = classifyMechanics(j, curId);
    console.log('');
    console.log('REACH AND DECISION IMPACT — the mechanics clause population, row by row');
    console.log('  artifact: data/all-mechanics-fire.json  generated ' + (j.generated || '?')
                + '  release ' + (ranOn || '(unstamped)'));
    if (ranOn && curId && ranOn !== curId) {
      console.log('  STALE — the tree is ' + curId + '. These rows describe OTHER BYTES and the clause');
      console.log('  refuses them. They are printed because a listing is not a verdict.');
    }
    /* THE SHELF, STATED AS WHAT IT IS: ONE RATE, TWO THRESHOLDS, EACH WITH ITS POPULATION. #295. */
    const SH = C.SH;
    const line = (kind) => { const s = SH.of(kind);
      return s.derivable
        ? `${s.exact.toFixed(2)} ${s.unit} in ${(s.denom || 0).toLocaleString()} games `
          + `-> counts at ${s.minCount}+ ${s.unit}`
        : 'NOT DERIVABLE — nothing of this kind is shelved'; };
    console.log('  ANCHOR: ' + SH.anchor.n + ' clicks in '
                + (SH.anchor.denom || 0).toLocaleString() + ' stored games = '
                + (SH.rate10k == null ? '?' : SH.rate10k.toFixed(2)) + ' per 10k games'
                + '   [tests/roster.js:1517 USAGE_SHELF_BELOW; Will 2026-08-18 "leave it at 25"]');
    console.log('    moves           ' + line('moves'));
    console.log('    abilities/items ' + line('abilities'));
    console.log('    populations     moves: ' + (C.U.denominators.moves || 'NO ARTIFACT')
                + ';  abilities/items: ' + (C.U.denominators.teams || 'NO ARTIFACT'));
    /* EVERY ROW CARRIES ITS OWN DENOMINATOR AND ITS OWN THRESHOLD. That is the whole of #295: the
     * unit can never again be implicit, and no reader has to scroll back to a header to learn which
     * population an integer came out of. */
    const dump = (title, rows, extra) => {
      console.log('');
      console.log('  ' + title + ': ' + rows.length);
      for (const r of rows.slice().sort((a, b) => (b.reach.n || 0) - (a.reach.n || 0))) {
        const sh = r.shelf || SH.of(r.kind);
        console.log('    ' + pad2(r.key, 28)
          + pad2(r.reach.known ? r.reach.n + ' ' + r.reach.unit : 'NO FIGURE', 14)
          + pad2('in ' + (r.reach.denomLabel || 'NO DENOMINATOR'), 29)
          + pad2(r.reach.per10k == null ? '' : r.reach.per10k.toFixed(2) + '/10k games', 20)
          + pad2(sh.derivable ? 'shelf ' + sh.minCount + ' ' + sh.unit : 'shelf N/A', 18)
          + (extra ? extra(r) : ''));
      }
    };
    dump('COUNTED — played, uncleared, and holding the clause shut', C.counted);
    /* THE DECLARED BUCKET IS DUMPED TOO, OR THE LISTING LOSES A ROW SILENTLY. Before the shared door
     * this printer showed all 16 diverging rows across four buckets; a row that is subtracted and not
     * re-printed is the "gate got quieter" failure one layer down from the one being fixed. */
    dump('DECLARED — the authority is wrong or there is no shared address; NOT a defect', C.declared,
      (r) => r.kind_declared + ': ' + r.name);
    dump('SHELVED BY REACH — staged and played every run, not counted', C.belowShelf);
    dump('NO USAGE FIGURE — unknown is not zero, these COUNT', C.unknown, (r) => r.reach.why);
    dump('CLEARED ON DECISION IMPACT', C.excused,
      (r) => '0 flips in ' + r.impact.paired + ', 95% upper bound ' + r.impact.bound.toFixed(1) + '%');
    console.log('');
    console.log('  ' + C.DI.why);
    if (C.rowsMissing.length) console.log('  NO PER-ENTITY ROWS for: ' + C.rowsMissing.join(', ')
      + ' — the filter cannot be applied and the clause counts every divergence.');
    console.log('');
    process.exit(0);
  }

  /* ---- SELFTEST: shown RED on a deliberately-quarantined figure before it is trusted -------------
   * `.githooks/pre-commit` was demonstrated red on a deliberate break before it was armed, and
   * `status.js --selftest` exists because `refit edge: CLEAN` printed for two days over a contrast
   * that had measured three columns moving. A gate that has only ever been green is not evidence.
   *
   * Both directions are driven. The RED cases prove the quarantine engages; the LIFT cases prove it
   * disengages, because a quarantine that can never lift is as broken as one that never fires. */
  if (has('--selftest')) {
    let bad = 0, ran = 0;
    /* THE TOTAL IS COUNTED, NOT TYPED. The first draft printed a literal 19 beside 18 cases — a
     * hand-maintained number inside the guard written against hand-maintained numbers. */
    const ok = (name, cond, got) => {
      ran++;
      if (!cond) bad++;
      console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : '   got ' + JSON.stringify(got)}`);
    };

    /* ---- THE PIN EVERY SYNTHETIC FIXTURE NOW NEEDS — 2026-09-04 --------------------------------
     *
     * `engine/pin_guard.js` withholds a clause whose artifact cannot say what it was measured under,
     * and the fixtures below carried no pin because until today nothing asked for one. FIXING THE
     * FIXTURE IS THE RIGHT MOVE AND WEAKENING THE CLAUSE IS NOT: the same miss on 2026-09-03 was that
     * session's only regression, when the steering refusal fired on
     * `tests/test-divergence-composition.js`'s synthetic arms.
     *
     * A synthetic digest map is honest here. The guard asks whether the artifact CAN be verified by
     * content, not whether it verifies — verifying is `provenance.js`'s job and it reads real files.
     * What every arm below is about is the OTHER thing the clause decides, so each one is given a pin
     * that vouches and then tests its own question; the pin's own red and green arms are separate and
     * are named `PIN GUARD` so nothing can pass by having them share a fixture. */
    const PINNED = (extra) => {
      const cur = readJson(D('data', 'engine-release.json'));
      const id = (cur && (cur.id || cur.release || cur.current)) || null;
      return Object.assign({ [PIN.K.id]: id,
        [PIN.K.digests]: { 'engine/medicham2-browser.js': 'fixture0000f' } }, extra || {});
    };
    /* AND THE POPULATION HALF. `steering.vouches()` asks for the SELECTOR, which under the empirical
     * policy is the behaviour tables, plus the team pool — the field `wholeGameClause` recorded and
     * never read. A fixture declaring only `policy` is exactly the artifact this change refuses. */
    const STEER_OK = (extra) => Object.assign({
      policy: require('./steering.js').POLICY_EMPIRICAL,
      driver_inputs: [{ file: 'data/move-priors.json', digest: 'fixtureprior' }],
      team_pool_digest: 'fixturepool0' }, extra || {});

    /* -- the gate's clauses, on synthetic artifacts ------------------------------------------- */
    const stage = (counts, reds) => ({ counts, reds: reds || [] });
    const clause = j => {
      const c = j.counts || {};
      const differ = c['FIRED-AND-BOARDS-DIFFER'] || 0, silent = c['DID-NOT-FIRE'] || 0;
      const badReds = (j.reds || []).filter(r => r && r.ok === false).length;
      return differ === 0 && silent === 0 && badReds === 0;
    };
    ok('a stage with 2 DIFFER and 4 DID-NOT-FIRE fails',
      !clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 2, 'DID-NOT-FIRE': 4 })));
    ok('a clean stage passes', clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0, 'FIRED-AND-BOARDS-MATCH': 31 })));
    ok('a clean stage with a FAILED red demonstration still fails',
      !clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0 }, [{ ok: false }])));
    /* THE CASE THE WHOLE FILE TURNS ON. A stage with no artifact must FAIL, not pass by absence. */
    const missing = rosterStage('__no_such_stage__');
    ok('a MISSING stage is a FAILING clause, not a passing one', missing.ok === false && missing.missing === true, missing);

    /* -- ROADMAP #316 — THE ROSTER CLAUSE REFUSES AN ARTIFACT CUT AGAINST OTHER BYTES -----------
     *
     * Driven through `rosterStage` itself on injected artifacts, so this asserts the shipping rule
     * rather than a restatement of it. The red case is asserted TWICE — the clause must fail, AND the
     * counts must be ABSENT from what it returns and from the sentence. A withheld figure that is
     * still in the string is `PRE-CHANGE` with a new word in front of it.
     *
     * THIS WAS THE LIVE DEFECT ON 2026-08-21: three PASSes read out of artifacts generated
     * 2026-08-11 on release 96361d523e20, while the instrument that writes them had been unable to
     * run since 2026-08-12. */
    {
      const relCur = readJson(D('data', 'engine-release.json'));
      const relId = relCur && (relCur.id || relCur.release || relCur.current);
      const ART = (extra) => PINNED({ stage: 'items', generated: 'then',
        counts: { 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0, 'FIRED-AND-BOARDS-MATCH': 136 },
        scope: { tested: 139, in_scope: 148, unattributable: 0 }, reds: [], results: [], ...extra });
      if (!relId) {
        ok('#316 — no engine-release.json on this tree, so the roster clause has no id to disagree '
          + 'with and is inert BY DESIGN (same as its siblings)',
          rosterStage('items', { file: 'roster.items.json',
            json: ART({ engine_release: '__not-this-tree__' }) }).withheld !== true);
      } else {
        const stale = rosterStage('items', { file: 'roster.items.json',
          json: ART({ engine_release: '__not-this-tree__' }) });
        ok('RED — #316 — a roster artifact stamped to ANOTHER release FAILS its clause',
          stale.ok === false && stale.withheld === true && stale.cannot_answer === true, stale.why);
        ok('RED — #316 — and THE COUNTS ARE GONE, not captioned: no differ, no silent, no matched, '
          + 'no scope, and none of them appears in the verdict string',
          stale.differ === undefined && stale.silent === undefined && stale.matched === undefined
          && stale.scope === undefined && !/136|139|148/.test(stale.why), stale);
        ok('#316 — the withheld verdict names WHICH release it wanted and WHICH it got',
          stale.ranOn === '__not-this-tree__' && stale.staleAgainst === relId
          && stale.why.indexOf(relId) >= 0, stale);
        const fresh = rosterStage('items', { file: 'roster.items.json',
          json: ART({ engine_release: relId }) });
        ok('#316 — an artifact stamped to THIS tree is answered normally, so the check refuses a '
          + 'mismatch and nothing else', fresh.withheld !== true && fresh.ok === true, fresh.why);
        ok('RED — #316 — a WITHHELD roster verdict exits 2, never 0', clauseExit(stale) === 2);
      }
      /* THIS ARM READ *"an UNSTAMPED roster artifact is ALLOWED TO ANSWER: the clause refuses a
       * MISMATCH, not an absence"* and it was inverted on 2026-09-04. It is not a tightening of
       * taste: `ART({})` now spreads a valid pin, so the old arm would have gone on passing while
       * asserting NOTHING — a green test asking no question, which is worse than the red it replaces.
       * The pin is stripped explicitly here so the fixture is genuinely unstamped. */
      const unstampedArt = ART({}); delete unstampedArt[PIN.K.id]; delete unstampedArt[PIN.K.digests];
      const unstamped = rosterStage('items', { file: 'roster.items.json', json: unstampedArt });
      ok('#316 — INVERTED 2026-09-04 — an UNSTAMPED roster artifact is WITHHELD, not answered. '
        + 'Silence about which bytes produced a count is not a fact about an old writer; it is the '
        + 'absence of the only evidence that could answer',
        unstamped.withheld === true && unstamped.ok === false, unstamped.why);
    }

    /* -- ROADMAP #88: THE DIFFERENTIAL CLAUSE, THROUGH THE SHIPPING FUNCTION -------------------
     * Every case below is a WHOLE artifact handed to `differentialClause` itself, so a change to the
     * rule cannot pass by having its selftest re-state the old one. The two RED cases are the point:
     * a clean midpoint with a dirty corner, and an artifact with no corners at all. */
    const armArt = (mid, top, bot) => PINNED({ compared: 6000, seed: 20260804, disagreed: mid,
      arms: [{ arm: 'top', compared: 6000, disagreed: top, worst: [] },
             { arm: 'bottom', compared: 6000, disagreed: bot, worst: [] }] });
    ok('both corners clean and the midpoint clean PASSES', differentialClause(armArt(0, 0, 0)).ok === true);
    ok('RED — the midpoint is clean and the BOTTOM corner is not: the clause FAILS',
      differentialClause(armArt(0, 0, 7)).ok === false, differentialClause(armArt(0, 0, 7)).why);
    ok('RED — the midpoint is clean and the TOP corner is not: the clause FAILS',
      differentialClause(armArt(0, 3, 0)).ok === false);
    ok('RED — an artifact with NO corner arms FAILS rather than passing by absence',
      differentialClause(PINNED({ compared: 6000, seed: 1, disagreed: 0 })).ok === false);
    ok('RED — a PLANTED artifact is refused even when every number in it is zero',
      differentialClause({ ...armArt(0, 0, 0), plant: { kind: 'spread', halfwidth: 12 } }).ok === false);
    ok('a dirty midpoint still fails, with both corners clean',
      differentialClause(armArt(5, 0, 0)).ok === false);
    ok('the passing reason NAMES both corners rather than one pooled number',
      /top 0\/6000/.test(differentialClause(armArt(0, 0, 0)).why)
      && /bottom 0\/6000/.test(differentialClause(armArt(0, 0, 0)).why),
      differentialClause(armArt(0, 0, 0)).why);

    /* ============================================================================================
     * PIN GUARD — EVERY CLAUSE SAYS WHAT IT WAS MEASURED UNDER, OR IT IS WITHHELD (2026-09-04)
     * ============================================================================================
     * RED FIRST, THEN GREEN, PER CLAUSE. Each pair below hands the SHIPPING function an artifact with
     * an absent or wrong stamp and asserts it REFUSES, then the same artifact with a good one and
     * asserts it ANSWERS. Without the second arm a guard is indistinguishable from a gate somebody
     * broke — and the point of this change is that the clauses answer again once the artifacts are
     * regenerated, not that they are red forever.
     *
     * WHY THE NO-FIGURE ARMS. A refusal that still carries the count is `PRE-CHANGE` with a new word
     * in front of it, and `mechanicsClause` was doing exactly that — its stale branch appended
     * `[moves 4, abilities 0, items 0; ...]` to a sentence saying the artifact describes other bytes.
     * So each refusal is asserted to carry NONE of its artifact's numbers. */
    {
      const relCur2 = readJson(D('data', 'engine-release.json'));
      const relId2 = (relCur2 && (relCur2.id || relCur2.release || relCur2.current)) || null;
      const noPin = (o) => { const c = { ...o }; delete c[PIN.K.id]; delete c[PIN.K.digests]; return c; };

      /* ---- 1. THE DAMAGE DIFFERENTIAL — the artifact that carried NO PIN AT ALL --------------- */
      const dNo = differentialClause(noPin(armArt(0, 0, 0)));
      ok('PIN GUARD / RED — data/engine-diff.json with NO release pin is WITHHELD, not answered: it '
        + 'is the artifact behind "clean at BOTH corners" and it could not notice four frozen '
        + 'sources moving underneath it',
        dNo.ok === false && dNo.withheld === true && dNo.cannot_answer === true, dNo.why);
      /* THE ASSERTION IS ON THE RESULT, NOT ON EVERY DIGIT. A first draft forbade the string `6000`
       * and went red on the RE-RUN COMMAND, which legitimately names `--n 6000` — the sample the
       * repair should take is not a figure from the measurement being withheld. What may not appear
       * is the artifact's own verdict and its arm table. */
      ok('PIN GUARD / RED — and NO FIGURE comes back with the refusal: no verdict, no corner arms',
        !/clean at BOTH corners|midpoint 0 of|top 0\/6000/.test(dNo.why)
        && dNo.arms === undefined, dNo);
      ok('PIN GUARD / RED — a differential stamped to ANOTHER release is WITHHELD',
        differentialClause({ ...armArt(0, 0, 0), [PIN.K.id]: '__not-this-tree__' }, relId2 || 'X')
          .withheld === true);
      ok('PIN GUARD / RED — an id with no `source_digests` is WITHHELD: an id is a CLAIM and the '
        + 'digest set is the only thing provenance.js can check by CONTENT',
        differentialClause({ ...noPin(armArt(0, 0, 0)), [PIN.K.id]: relId2 }, relId2).withheld === true);
      ok('PIN GUARD / GREEN — a fully stamped differential ANSWERS, so the guard refuses a missing '
        + 'pin and nothing else', differentialClause(armArt(0, 0, 0)).ok === true);
      ok('PIN GUARD / RED — a withheld differential exits 2, never 0', clauseExit(dNo) === 2);

      /* ---- 2. THE DELIBERATE ROSTER — absence used to be waved through ------------------------ */
      const rArt = (extra) => ({ stage: 'items', generated: 'then',
        counts: { 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0, 'FIRED-AND-BOARDS-MATCH': 136 },
        scope: { tested: 139, in_scope: 148, unattributable: 0 }, reds: [], results: [], ...extra });
      const rNo = rosterStage('items', { file: 'roster.items.json', json: rArt({}) });
      ok('PIN GUARD / RED — a roster artifact with NO stamp is WITHHELD. It used to ANSWER, and the '
        + 'clause said so in as many words ("this refuses a MISMATCH, not an absence") — a sentence '
        + 'copied into five clauses in this file, every one of which read silence as agreement',
        rNo.ok === false && rNo.withheld === true, rNo.why);
      ok('PIN GUARD / RED — and the counts are ABSENT from that refusal, not set to null',
        rNo.differ === undefined && rNo.matched === undefined && !/136|139|148/.test(rNo.why), rNo);
      ok('PIN GUARD / GREEN — a roster artifact carrying the WHOLE stamp ANSWERS',
        rosterStage('items', { file: 'roster.items.json',
          json: rArt({ [PIN.K.id]: relId2, [PIN.K.digests]: { 'engine/board.js': 'aaaaaaaaaaaa' } }) })
          .ok === true);

      /* ---- 3. THE MECHANICS CLAUSE — a hand-rolled `release` is not a stamp ------------------- */
      const mBase = { summary: { moves: { diverged: 0 }, abilities: { diverged: 0 },
                                 items: { diverged: 0 } },
                      rows: { moves: [], abilities: [], items: [] } };
      const mLegacy = mechanicsClause({ j: { release: 'rel-fixture', ...mBase },
        cur: { id: 'rel-fixture' }, U: usageIndex(), DI: decisionImpact('nothing-on-disk') });
      ok('PIN GUARD / RED — `release: <id>` hand-rolled instead of REL.stamp() is WITHHELD: it '
        + 'carries no `showdown_commit`, and the AUTHORITY selects this run population — its 500 '
        + 'moves are dex.moves.all() filtered to the format, so a different checkout is a different '
        + 'denominator', mLegacy.withheld === true, mLegacy.why);
      const mNo = mechanicsClause({ j: { ...mBase }, cur: { id: 'rel-fixture' }, U: usageIndex(),
                                    DI: decisionImpact('nothing-on-disk') });
      ok('PIN GUARD / RED — and an artifact with NO pin at all is WITHHELD too',
        mNo.withheld === true, mNo.why);
      const mOk = mechanicsClause({ j: { [PIN.K.id]: 'rel-fixture',
        [PIN.K.digests]: { 'engine/medicham2-browser.js': 'bbbbbbbbbbbb' }, ...mBase },
        cur: { id: 'rel-fixture' }, U: usageIndex(), DI: decisionImpact('nothing-on-disk') });
      ok('PIN GUARD / GREEN — the same artifact carrying the whole stamp ANSWERS',
        mOk.withheld !== true && mOk.ok === true, mOk.why);

      /* ---- 4. THE WHOLE-GAME CLAUSES — the population, one field over -------------------------
       *
       * DRIVEN THROUGH THE BOARD CLAUSE AND CROSS-CHECKED THROUGH THE NARRATION ONE, because the
       * read and the refusals are now ONE door (`wholeGameDoor`) with two callers. The whole point
       * of extracting it was that `pin_guard.js`'s header records the same refusal sentence copied
       * into five clauses; a split that copied it into a sixth would have been the same defect
       * landing on the day of the fix. So each refusal is asserted on BOTH callers — if the door
       * were ever bypassed in one of them, exactly one column of these arms would go green. */
      const WG_STATE = { games: 1230, games_board_never_diverged: 1230,
        protocol_diverged_games: 0, protocol_diverged_board_never_did: 0,
        planted_state_proof_ok: true, mappings_all_proved: true };
      const wgBase = (steer) => PINNED({ games: 1230, diverged: 0, planted_divergence_proof_ok: true,
        mode: 'M', generated: 'then', classes: [], state_mode: true, state: WG_STATE,
        steering: steer });
      const wPolicyOnly = wholeGameClause(
        wgBase({ policy: require('./steering.js').POLICY_EMPIRICAL }), decisionImpact('NOPE'));
      ok('PIN GUARD / RED — THE DEFECT ITSELF: a steering block declaring the RIGHT POLICY and no '
        + '`team_pool_digest` is WITHHELD. The clause read `steering.policy` and never the field its '
        + 'own artifact already records, so a run against the wrong team pool passed',
        wPolicyOnly.withheld === true && /team_pool_digest/.test(wPolicyOnly.why), wPolicyOnly.why);
      ok('PIN GUARD / RED — and no figure comes back with it: no 1230, no rate, no class composition',
        !/1230/.test(wPolicyOnly.why) && wPolicyOnly.games === undefined
        && wPolicyOnly.rate === undefined, wPolicyOnly);
      const wNoSteer = wholeGameClause(wgBase(undefined), decisionImpact('NOPE'));
      ok('PIN GUARD / RED — an artifact with NO steering block at all is WITHHELD',
        wNoSteer.withheld === true, wNoSteer.why);
      const wWrongPol = wholeGameClause(
        wgBase(STEER_OK({ policy: require('./steering.js').POLICY })), decisionImpact('NOPE'));
      ok('PIN GUARD / RED — the coverage arm is still refused, and the refusal NAMES BOTH policies',
        wWrongPol.withheld === true
        && wWrongPol.why.indexOf(require('./steering.js').POLICY) >= 0
        && wWrongPol.why.indexOf(require('./steering.js').POLICY_EMPIRICAL) >= 0, wWrongPol.why);
      const wGood = wholeGameClause(wgBase(STEER_OK()), decisionImpact('NOPE'));
      ok('PIN GUARD / GREEN — release stamp + a steering block naming every selector ANSWERS',
        wGood.withheld !== true && wGood.games === 1230, wGood.why);
      ok('PIN GUARD / RED — every withheld whole-game verdict exits 2, never 0',
        clauseExit(wPolicyOnly) === 2 && clauseExit(wNoSteer) === 2 && clauseExit(wWrongPol) === 2);
      /* THE SAME FOUR ARTIFACTS THROUGH THE OTHER CALLER. One door, two clauses: a refusal that
       * fires for the board clause and not for the narration clause would mean the door had been
       * bypassed in one of them, which is precisely the five-copies failure this shape replaced. */
      ok('PIN GUARD — the NARRATION clause refuses the identical three artifacts, because the read '
        + 'and the refusal are one door with two callers rather than two copies of one sentence',
        narrationClause(wgBase({ policy: require('./steering.js').POLICY_EMPIRICAL }),
                        decisionImpact('NOPE')).withheld === true
        && narrationClause(wgBase(undefined), decisionImpact('NOPE')).withheld === true
        && narrationClause(wgBase(STEER_OK({ policy: require('./steering.js').POLICY })),
                           decisionImpact('NOPE')).withheld === true);
      ok('PIN GUARD / GREEN — and it ANSWERS the good one, so the arm above is not just refusing '
        + 'everything handed to it',
        narrationClause(wgBase(STEER_OK()), decisionImpact('NOPE')).withheld !== true);

      /* ---- 5. THE DOOR THAT CATCHES THE FOURTH CLAUSE ---------------------------------------- */
      const audited = PIN.audit([{ name: 'a clause added tomorrow', ok: true, why: 'looks clean' }]);
      ok('PIN GUARD / RED — A FOURTH CLAUSE ADDED TOMORROW WITH NO PIN CANNOT PASS. It hands back no '
        + '`pins` receipt, so the ASSEMBLER withholds it — the refusal is on the LIST, not on three '
        + 'named clauses, which is what makes it catch a second instance through another door',
        audited[0].ok === false && audited[0].withheld === true, audited[0]);
      ok('PIN GUARD / RED — and the refusal says HOW to add one, so it is a route and not a hole',
        /pins: PIN\.receipt/.test(audited[0].why) && /PIN\.noArtifact/.test(audited[0].why),
        audited[0].why);
      ok('PIN GUARD / GREEN — a clause that DOES declare its artifact passes through untouched',
        PIN.audit([{ name: 'x', ok: true, pins: PIN.receipt({ file: 'data/x.json' }) }])[0].ok === true);
      ok('PIN GUARD / GREEN — and a clause that legitimately reads NO artifact declares that, with a '
        + 'reason, rather than being withheld',
        PIN.audit([{ name: 'y', ok: true,
                     pins: PIN.noArtifact('recomputed live every run') }])[0].ok === true);
      let pinThrew = null;
      try { PIN.noArtifact(); } catch (e) { pinThrew = e.message; }
      ok('PIN GUARD / RED — an artifact-free declaration with NO REASON throws: an unexplained '
        + 'exemption is the invisible exception this whole guard is against',
        typeof pinThrew === 'string' && /must say why/.test(pinThrew), pinThrew);
      let pinThrew2 = null;
      try { PIN.guard({ name: 'n', file: 'data/n.json', artifact: {}, need: ['release'] }); }
      catch (e) { pinThrew2 = e.message; }
      ok('PIN GUARD / RED — a refusal with no re-run command throws: a withheld figure with no route '
        + 'back is a hole, not a refusal',
        typeof pinThrew2 === 'string' && /rerun/.test(pinThrew2), pinThrew2);

      /* ---- 5b. THE GUARD CAN PROVE IT RAN ----------------------------------------------------
       * CLAUDE.md: a capability that cannot prove it ran is assumed broken. Every arm above would
       * also pass against a guard that returned a canned refusal without reading anything, so the
       * counters are asserted to have MOVED on each distinct branch. */
      ok('PIN GUARD — the guard proves it ran: the release, digest, population and receipt branches '
        + 'have each fired at least once in this process',
        PIN.PIN_COUNTERS.checked > 0 && PIN.PIN_COUNTERS.no_release > 0
        && PIN.PIN_COUNTERS.no_digests > 0 && PIN.PIN_COUNTERS.population > 0
        && PIN.PIN_COUNTERS.no_receipt > 0, PIN.PIN_COUNTERS);

      /* ---- 6. EVERY SHIPPING CLAUSE CARRIES A RECEIPT ---------------------------------------- */
      const liveClauses = medichamIsCorrect().clauses;
      ok('PIN GUARD — every clause the gate assembles hands back a receipt naming what it read',
        liveClauses.every((c) => c.pins
          && (c.pins.artifact || (c.pins.checked || []).indexOf('no-artifact') >= 0)),
        liveClauses.filter((c) => !c.pins).map((c) => c.name));
    }

    /* -- THE ROW DETECTOR, ON SYNTHETIC ROWS — ROADMAP #148 FOR THE THIRD TIME -----------------
     *
     * `roadmapRowSaysBroken` is a GATE INPUT and had no test at all, which is how it came to report
     * `7 OPEN roadmap row(s) describe a live engine defect` when two of the seven asserted nothing of
     * the kind. Both false positives are here as RED cases, in the shape they actually occurred:
     * a defect vocabulary matched against a row's account of an ALREADY-FIXED bug, and against a
     * METAPHOR. Both are quoted from the real rows, so a re-widening cannot pass this block.
     *
     * THE POSITIVE CONTROLS ARE NOT OPTIONAL. A narrowing that also stops seeing real defects is the
     * same failure pointed the other way, and this file has the receipt for it: the pattern once
     * matched ZERO of ten registered `test-tag-wire` defects and printed `clean`. */
    const row = (n, title, cell) => `| #${n} | **${title} | ${cell} |`;
    const HEAD = 'A MECHANIC THAT NEVER FIRES — 8,524 uses.**';
    ok('a row whose TITLE says the mechanic never fires counts, with no cell token',
      roadmapRowSaysBroken(row(1, HEAD, 'open')) === true);
    ok('a row whose CELL carries DEFECT counts, whatever the title says',
      roadmapRowSaysBroken(row(2, 'A MEASUREMENT WE OWE.**', 'open — engine DEFECT')) === true);
    ok('a row that is neither does NOT count',
      roadmapRowSaysBroken(row(3, 'HAND MEDICHAM TO A FASTER RUNTIME.**', 'queued')) === false);
    ok('RED — a defect word 2,000 characters deep, describing a bug this row already CLOSED, does '
      + 'not count (#266: "`\'dampro\'` resolves to a row that does not exist")',
      roadmapRowSaysBroken(row(266, 'FORTY-ONE ILLEGAL FIXTURE DECLARATIONS.** ' + 'x'.repeat(1800)
        + " `'dampro'` resolves to a row that does not exist whose `.name` is `''`", 'PART TWO DONE')) === false);
    ok('RED — a METAPHOR inside the head does not count when the cell states the row is not a defect '
      + '(#252: "a Farigiraf is dead only while it is still there")',
      roadmapRowSaysBroken(row(252, 'THE FUTILITY GATE CARRIES A DECLARED PREDICTION.** Priority into '
        + 'an Armor Tail Farigiraf is dead only while that Farigiraf is still there',
        'deferred by decision — NOT A DEFECT, search')) === false);
    /* -- THE CLOSED-DETECTOR, IN BOTH DIRECTIONS -- 2026-08-18 -------------------------------
     *
     * The cell outranked the prose when it said `closed` and did NOT when it said `open`, so a row
     * whose narrative contains `CLOSED 2026-08-11` about a part that IS closed read as a closed ROW.
     * Measured over the live register: five verdicts moved, three of them rows asserting breakage,
     * including #220 -- 238 games of the 695 in the whole-game differential, invisible to the gate.
     * The RED case is the one that matters: it fails the moment the cell stops outranking the prose. */
    ok('RED - a cell that says OPEN outranks a `CLOSED 2026-08-11` inside the row narrative',
      roadmapRowIsClosed(row(220, 'THE RESIDUAL - CLOSED 2026-08-11.** reopened the next day',
        'open - engine DEFECT')) === false);
    ok('a cell that says CLOSED still closes the row, and that half is unchanged',
      roadmapRowIsClosed(row(90, 'A THING.** done', 'closed 2026-08-11')) === true);
    ok('the prose fallback still closes a row whose cell states no disposition at all',
      roadmapRowIsClosed(row(91, 'A THING - DONE, 3.72.0.** account', 'engine')) === true);
    ok('RED - `open` must be the START of the cell, not a word buried in it: a closed row that '
      + 'mentions an open question is still closed',
      roadmapRowIsClosed(row(92, 'A THING - DONE.** x', 'closed; one open question remains')) === true);

    ok('NOT A DEFECT beats an explicit DEFECT token, so the escape hatch is unambiguous and visible',
      roadmapRowSaysBroken(row(9, 'X.**', 'NOT A DEFECT — measured green 2026-08-15, DEFECT')) === false);
    ok('every use of the override is recorded for the receipt, never silently applied',
      NOT_A_DEFECT.some(r => r.n === '252') && NOT_A_DEFECT.some(r => r.n === '9'), NOT_A_DEFECT);
    ok('the clause reports the override list on every run, at zero as well as at seven',
      / open row\(s\) declare NOT A DEFECT in their status cell/.test(openDefectClause().why),
      openDefectClause().why.slice(-160));
    /* -- THE RECEIPT MUST SAY WHICH ROWS THE DOOR ACTUALLY MOVED -- 2026-08-27 -----------------
     *
     * `\bDEFECT\b` matches INSIDE the phrase `NOT A DEFECT`, so every row carrying the phrase used
     * to be reported as excused whether or not it made any breakage claim of its own. Measured on
     * the live register: 8 rows carry it, exactly ONE (#252, through the prose metaphor `IS DEAD`)
     * would have counted without it. NO VERDICT MOVES; the receipt stops overstating its reach 8x.
     *
     * The three cases below are the audit's own controls, and case A is the RED one: if the
     * suppression flag ever collapses to "the phrase is present", A and C stop disagreeing. */
    ok('RED — a cell whose ONLY defect token is the phrase itself is recorded as NOT suppressing: '
      + 'the override cancels its own phrase and nothing else',
      (() => { const l = row(9001, 'X.**', 'NOT A DEFECT — register hygiene, nothing about the game');
               roadmapRowSaysBroken(l);
               const r = NOT_A_DEFECT.find(x => x.n === '9001');
               return r && r.suppresses === false; })(), NOT_A_DEFECT.slice(-1));
    ok('a cell carrying an INDEPENDENT `DEFECT` token outside the phrase IS recorded as suppressing',
      (() => { const l = row(9002, 'X.**', 'open — engine DEFECT; the narration half is NOT A DEFECT');
               roadmapRowSaysBroken(l);
               const r = NOT_A_DEFECT.find(x => x.n === '9002');
               return r && r.suppresses === true; })(), NOT_A_DEFECT.slice(-1));
    ok('a PROSE breakage claim in the head is recorded as suppressing too — #252 is exactly this',
      (() => { const l = row(9003, 'THE ABILITY NEVER FIRES.**', 'NOT A DEFECT — cosmetic');
               roadmapRowSaysBroken(l);
               const r = NOT_A_DEFECT.find(x => x.n === '9003');
               return r && r.suppresses === true; })(), NOT_A_DEFECT.slice(-1));
    ok('...and all three still return the SAME verdict as before, so this is a DISPLAY correction '
      + 'and not a change to what the gate decides',
      roadmapRowSaysBroken(row(9004, 'THE ABILITY NEVER FIRES.**', 'NOT A DEFECT — cosmetic')) === false
      && roadmapRowSaysBroken(row(9005, 'X.**', 'NOT A DEFECT — hygiene')) === false);
    /* THE SYNTHETIC ROWS ARE SPLICED BACK OUT before the receipt is read. `NOT_A_DEFECT` is module
     * level by design — a caller cannot use the detector and skip the receipt — so a selftest that
     * left its fixtures in would inflate the very number the next assertion reads. */
    for (const n of ['9001', '9002', '9003', '9004', '9005']) {
      const i = NOT_A_DEFECT.findIndex(x => x.n === n);
      if (i >= 0) NOT_A_DEFECT.splice(i, 1);
    }
    ok('the receipt prints BOTH numbers — the rows using the door and the rows it actually moved',
      /of which \d+ would otherwise have counted as broken/.test(openDefectClause().why),
      openDefectClause().why.slice(0, 300));

    /* -- A REFUSED MARKER AND A BROKEN GATE ARE TWO FACTS, AND THEY HAD ONE NUMBER — 2026-09-04 ---
     *
     * `green: null` was one bucket called "instrument unrunnable". In the last real artifact ALL 27
     * rows in it were markers `engine/register_reality.js` REFUSED TO READ — nothing had been asked
     * of a single one of those instruments — so a defect in the RULER was being reported in the
     * words of a defect in the WORLD. These arms drive the SHIPPING split on synthetic input, and
     * the RED ones are the ones that matter: a collapse back to one bucket makes A and B agree. */
    const EVIDX = (rows) => { const m = new Map(); for (const r of rows) m.set(String(r.n), r); return m; };
    const EVOPEN = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }, { n: 6 }];
    const EVSPLIT = registerEvidence(EVOPEN, EVIDX([
      { n: 1, cmd: 'node tests/a.js', green: false, verdict: 'CONFIRMED' },
      { n: 2, cmd: 'node tests/b.js', green: true, verdict: 'STALE ROW' },
      { n: 3, cmd: 'SHOWDOWN_PATH=... node tests/c.js', green: null,
        verdict: REGISTER_REALITY.rejectedVerdict },
      { n: 4, cmd: 'node tests/d.js', green: null, verdict: 'INSTRUMENT UNRUNNABLE' },
      { n: 5, cmd: 'node tests/e.js', green: null, verdict: 'EXIT CODE UNDECLARED' },
      { n: 6, cmd: null, green: null, verdict: 'UNVERIFIABLE' }]));
    ok('A — a marker the ruler REFUSED lands in `rejected` and NOWHERE else: nothing was asked of '
      + 'that instrument, so calling it unrunnable is a false sentence about a row nothing ran for',
      EVSPLIT.rejected.length === 1 && EVSPLIT.rejected[0].n === 3
      && !EVSPLIT.unrunnable.some(r => r.n === 3), EVSPLIT);
    ok('B — an instrument that WAS asked and answered nothing usable stays in `unrunnable`, and it '
      + 'keeps its own verdict so a reader can tell WHICH of the three it was',
      EVSPLIT.unrunnable.length === 2
      && EVSPLIT.unrunnable.map(r => r.verdict).join('|') === 'INSTRUMENT UNRUNNABLE|EXIT CODE UNDECLARED'
      && !EVSPLIT.rejected.some(r => r.n === 4 || r.n === 5), EVSPLIT);
    ok('RED — the two sentences are DIFFERENT WORDS carrying DIFFERENT COUNTS, which is the whole '
      + 'change: one heading over both is how a ruler defect got reported as a world defect',
      EVSPLIT.rejectedLine !== EVSPLIT.unrunnableLine
      && /WAS NEVER ASKED/.test(EVSPLIT.rejectedLine) && /#3/.test(EVSPLIT.rejectedLine)
      && !/#4|#5/.test(EVSPLIT.rejectedLine)
      && /WAS ASKED AND ANSWERED/.test(EVSPLIT.unrunnableLine) && /#4/.test(EVSPLIT.unrunnableLine)
      && !/#3\b/.test(EVSPLIT.unrunnableLine),
      [EVSPLIT.rejectedLine, EVSPLIT.unrunnableLine]);
    ok('the five buckets are DISJOINT and TOTAL — every open row lands in exactly one, so a split '
      + 'cannot lose a row the way a widened bucket hid nine markers',
      ['withRed', 'staleRows', 'rejected', 'unrunnable', 'debt']
        .reduce((s, k) => s.concat(EVSPLIT[k].map(r => r.n)), []).sort().join(',') === '1,2,3,4,5,6',
      EVSPLIT);
    ok('RED — a null verdict with NO verdict string is NOT read as a rejection: the split turns on '
      + 'what the writer published, never on the absence of it',
      registerEvidence([{ n: 7 }], EVIDX([{ n: 7, cmd: 'node tests/f.js', green: null, verdict: null }]))
        .rejected.length === 0);
    /* THE LITERAL IS CHECKED AGAINST ITS SOURCE, because a derived value is not a fact until
     * something compares it to the file it came from. `engine/register_reality.js` cannot be
     * REQUIRED here — the dependency runs writer -> reader and requiring it executes its driver — so
     * its shipping bytes are read as text. A rename on the writer's side is RED. */
    ok('the rejected-verdict literal is the one engine/register_reality.js actually returns, read '
      + 'out of its shipping bytes rather than remembered',
      new RegExp("return '" + REGISTER_REALITY.rejectedVerdict + "';")
        .test(fs.readFileSync(D('engine', 'register_reality.js'), 'utf8')),
      REGISTER_REALITY.rejectedVerdict);

    /* -- THE TWO FILTERS, RED AND GREEN, ON SYNTHETIC INPUT -----------------------------------
     *
     * Both are shown RED on a deliberate break before either is trusted, and the RED cases are the
     * ones that matter: a filter can only ever make a gate easier to pass, so its failure mode is
     * silent leniency. Each pair below is the same input with one field moved.
     *
     * The reach cases drive `reachOf` — the shipping function — against a synthetic usage index, so a
     * change to the rule cannot pass by having its selftest restate the old one. */
    const UIDX = {
      moves: new Map([['bigmove', 400], ['smallmove', 3]]),
      abilities: new Map([['bigability', 900], ['smallability', 2]]),
      items: new Map(),
      invisible: new Set(['megaonly']),
      denominators: { moves: 'N games', teams: 'N teams' },
      /* THE TWO RATE DENOMINATORS, DELIBERATELY DIFFERENT AND DELIBERATELY IN A 5:1 RATIO, so the
       * translation below is a real division and not an identity that would pass either way. */
      games: { moves: 1000, teams: 200 },
      gamesLabel: { moves: '1,000 stored games', teams: '200 open-sheet games' },
      absent: [],
    };
    ok('REACH — a move above the shelf is KNOWN and not shelved',
      reachOf(UIDX, 'moves', 'bigmove').known === true && reachOf(UIDX, 'moves', 'bigmove').n >= REACH_SHELF_CLICKS);
    ok('REACH — a move below the shelf is KNOWN and below it',
      reachOf(UIDX, 'moves', 'smallmove').n < REACH_SHELF_CLICKS);

    /* -- ROADMAP #295: ONE ANCHOR, ONE RATE, A THRESHOLD PER POPULATION -----------------------
     *
     * The defect was that the literal 25 was compared to CLICKS in a 64,846-game population and to
     * TEAMS in a 13,116-game one, so a move cleared the bar at ~48x lower relative usage than an
     * ability. Every case below is driven through the SHIPPING `reachShelf` / `classifyMechanics`,
     * and the RED ones are the ones that matter: each fails if the code reverts to a bare integer. */
    const SHT = reachShelf(UIDX);
    ok('#295 — the ANCHOR is unchanged and is in CLICKS, exactly where it was ruled',
      SHT.anchor.n === REACH_SHELF_CLICKS && SHT.anchor.unit === 'clicks' && SHT.anchor.denom === 1000);
    ok('#295 — the TEAMS threshold is DERIVED at the anchor rate, not copied from the integer',
      Math.abs(SHT.of('abilities').exact - 5) < 1e-12 && SHT.of('abilities').minCount === 5,
      SHT.of('abilities'));
    ok('RED — an ability at 6 teams (above the derived shelf) COUNTS where the bare integer shelved it',
      SHT.below('abilities', 6) === false && SHT.below('moves', 6) === true);
    ok('RED — an ability at 4 teams is still shelved: the derived shelf is a shelf, not an amnesty',
      SHT.below('abilities', 4) === true);
    ok('#295 — the two thresholds carry the SAME rate per game, which is the whole point',
      Math.abs(SHT.of('moves').exact / SHT.of('moves').denom
             - SHT.of('abilities').exact / SHT.of('abilities').denom) < 1e-12);
    ok('#295 — every row carries its own DENOMINATOR, so a bare integer can never stand alone',
      reachOf(UIDX, 'abilities', 'bigability').denomLabel === '200 open-sheet games'
      && reachOf(UIDX, 'moves', 'bigmove').denomLabel === '1,000 stored games');
    /* THE SAFE DIRECTION WHEN THE EVIDENCE IS GONE. A threshold that cannot be derived must shelve
     * NOTHING — never fall back to the anchor's integer in the wrong unit, which is the defect. */
    const NOGAMES = reachShelf({ ...UIDX, games: { moves: 1000, teams: null } });
    ok('RED — with the teams denominator absent the shelf is NOT DERIVABLE and shelves nothing',
      NOGAMES.of('abilities').derivable === false && NOGAMES.below('abilities', 1) === false
      && NOGAMES.below('moves', 1) === true);
    const NOANCHOR = reachShelf({ ...UIDX, games: { moves: null, teams: 200 } });
    ok('RED — with the ANCHOR population absent nothing is shelved at all, in either unit',
      NOANCHOR.below('moves', 0) === false && NOANCHOR.below('abilities', 0) === false);
    /* THE CASE THE WHOLE FILTER TURNS ON, IN BOTH DIRECTIONS. */
    ok('RED — a move the instrument covers and never saw is an OBSERVED ZERO, not unknown',
      reachOf(UIDX, 'moves', 'neverclicked').known === true && reachOf(UIDX, 'moves', 'neverclicked').n === 0);
    ok('RED — an ability the instrument CANNOT see is UNKNOWN and is never read as zero',
      reachOf(UIDX, 'abilities', 'megaonly').known === false && reachOf(UIDX, 'abilities', 'megaonly').n === null,
      reachOf(UIDX, 'abilities', 'megaonly'));
    ok('RED — with the usage artifact ABSENT, every row of that kind is UNKNOWN and nothing is shelved',
      reachOf({ ...UIDX, items: null, absent: ['data/sheet-usage.json'] }, 'items', 'anything').known === false);
    ok('the ability unit is TEAMS and the move unit is CLICKS — they are not interchangeable',
      reachOf(UIDX, 'abilities', 'bigability').unit === 'teams'
      && reachOf(UIDX, 'moves', 'bigmove').unit === 'clicks');
    /* THE BOUNDARY, THROUGH `classifyMechanics` — the function the clause decides on, driven with an
     * injected usage index rather than a re-statement of its rule. `below the shelf` means STRICTLY
     * below, exactly as tests/roster.js's `clicks >= USAGE_SHELF_BELOW` does. Not pedantry: an ability
     * sits at exactly 25 teams in today's artifact, so a `<=` here would silently excuse a live row. */
    const EDGE = { rows: { moves: [
      { id: 'atexactly', diverged: true },
      { id: 'onebelow', diverged: true },
      { id: 'closeted', diverged: true, carrier: 'zoroark',
        deferred: { by: 'Will', on: '2026-08-28', why: 'ROADMAP #160 — Illusion is in the closet.' },
        divergence: { cause: 'switch: a different body :: |switch|p1a|blastoise <> |switch|p1a|zoroark' },
        board: { verdict: 'ANNOUNCEMENT-ONLY' } }] } };
    const EDGEU = { ...UIDX, moves: new Map([['atexactly', REACH_SHELF_CLICKS], ['onebelow', REACH_SHELF_CLICKS - 1],
                                             ['closeted', 9999]]) };
    const EDGEC = classifyMechanics(EDGE, null, { U: EDGEU, DI: decisionImpact('nothing-on-disk') });
    ok('BOUNDARY — exactly at the shelf COUNTS, and one below it is shelved',
      EDGEC.counted.length === 1 && EDGEC.counted[0].id === 'atexactly'
      && EDGEC.belowShelf.length === 1 && EDGEC.belowShelf[0].id === 'onebelow',
      { counted: EDGEC.counted.map(r => r.id), belowShelf: EDGEC.belowShelf.map(r => r.id) });
    ok('a row the OWNER closeted is in neither column, however heavily it is played',
      EDGEC.rowsSeen === 2 && !EDGEC.counted.concat(EDGEC.belowShelf).some(r => r.id === 'closeted'));
    /* -- THE OWNER'S SHELF IS SUBTRACTED **AND NAMED** — #520 -------------------------------------
     * The assertion one line up has always held; what it did NOT hold is that anyone can see WHICH
     * row was subtracted or on whose ruling. The clause printed `4 shelved by the owner` and stopped
     * there, which is the bare-integer version of the invisible exception this file's DECLARED
     * register was built to avoid. Shown RED before being trusted: drop the `ownerShelved.push`
     * block in `classifyMechanics` and this fails with an empty list. */
    ok('RED — a row the owner shelved is COLLECTED with its ruling, not silently dropped',
      EDGEC.ownerShelved.length === 1 && EDGEC.ownerShelved[0].key === 'move:closeted'
      && EDGEC.ownerShelved[0].by === 'Will' && EDGEC.ownerShelved[0].on === '2026-08-28'
      && /ROADMAP #160/.test(EDGEC.ownerShelved[0].why)
      && EDGEC.ownerShelved[0].carrier === 'zoroark'
      && EDGEC.ownerShelved[0].board_verdict === 'ANNOUNCEMENT-ONLY'
      && /switch: a different body/.test(EDGEC.ownerShelved[0].cause), EDGEC.ownerShelved);
    /* -- THE DERIVATION BEATS THE MATCHER, AND THE ORDER IS THE CLAIM -----------------------------
     * A shelf DERIVED from the ability (`GD.CLOSET_SPECIES`) and a declaration TYPED against a cause
     * string can both cover one row. The skip must stay ABOVE `declaredMatch` so the derived shelf
     * takes it — otherwise a hand-written row collects credit for a subtraction it did not make, and
     * the register would report a CLOSETED hit that fires only because the shelf was already there.
     * This is the assertion that refused Bitter Malice and Night Daze as closet entries on
     * 2026-08-28: a declaration for either could never have been reached. Shown RED by moving the
     * `r.deferred` skip below the `declaredMatch` call — `declared` then holds the row. */
    const CLASH = { rows: { moves: [{ id: 'clash', diverged: true,
      deferred: { by: 'Will', on: '2026-08-28', why: 'the owner shelved it' },
      divergence: { cause: 'event missing from medicham2 :: |-end|p1a|fallenundefined <> |switch|p1a|x' } }] } };
    const CLASHC = classifyMechanics(CLASH, null,
      { U: { ...UIDX, moves: new Map([['clash', 9999]]) }, DI: decisionImpact('nothing-on-disk') });
    ok('RED — when the owner\'s shelf and a live declaration both cover a row, the SHELF takes it and '
     + 'the declared register does NOT claim the subtraction',
      CLASHC.ownerShelved.length === 1 && CLASHC.declared.length === 0 && CLASHC.rowsSeen === 0,
      { shelved: CLASHC.ownerShelved.map(r => r.key), declared: CLASHC.declared.map(r => r.key) });
    /* AND THE PRINTER RENDERS IT, because a field nobody prints is a field nobody reads. Driven on a
     * HANDED-IN artifact through `mechanicsClause`'s own `inject` door, never off disk — see the note
     * on that door for the release cut that made the disk version go red on somebody else's work. The
     * fixture carries ONE counted row beside the shelved one, so the clause still has to decide
     * something and the shelf is not the only thing in it. */
    {
      /* the injected `cur` below is `rel-fixture`, so the fixture's own pin must name it — a
        * fixture that pins the REAL tree while claiming the tree is `rel-fixture` would be testing
        * the release guard rather than the shelf printer. */
      const FIX = { ...PINNED({ [PIN.K.id]: 'rel-fixture' }), generated: '2026-08-28T00:00:00.000Z',
        summary: { moves: { diverged: 1, shelved_by_owner_diverging: 1 } },
        rows: { moves: [
          { id: 'atexactly', diverged: true },
          { id: 'shelfrow', diverged: true, carrier: 'zoroark',
            deferred: { by: 'Will', on: '2026-08-28',
                        why: 'ROADMAP #160 — we put illusion and zoroark into the closet.' },
            divergence: { cause: 'switch: a different body :: |switch|p1a|blastoise <> |switch|p1a|zoroark' },
            board: { verdict: 'ANNOUNCEMENT-ONLY' } }],
          /* THE OTHER TWO KINDS ARE PRESENT AND EMPTY, NEVER ABSENT. An artifact with no `rows` for a
           * kind takes the clause's REACH FILTER CANNOT BE APPLIED branch — correctly, since an
           * older artifact must not read as "nothing to filter" — and a fixture that trips it would
           * be testing that branch instead of the printer. */
          abilities: [], items: [] } };
      const FIXU = { ...UIDX, moves: new Map([['atexactly', REACH_SHELF_CLICKS], ['shelfrow', 9999]]) };
      const MC = mechanicsClause({ j: FIX, cur: { id: 'rel-fixture' }, U: FIXU,
                                   DI: decisionImpact('nothing-on-disk') });
      ok('RED — the mechanics clause NAMES what the owner shelved, with the carrier, the cause, the '
       + 'board verdict and the dated ruling, instead of a bare integer',
        /SHELVED BY THE OWNER/.test(MC.why || '')
        && /move:shelfrow/.test(MC.why) && /staged on zoroark/.test(MC.why)
        && /ANNOUNCEMENT-ONLY/.test(MC.why) && /CLOSETED BY Will 2026-08-28/.test(MC.why)
        && /switch: a different body/.test(MC.why)
        && MC.owner_shelved === 1 && MC.owner_shelved_summary === 1
        && MC.owner_shelved_rows.length === 1 && MC.owner_shelved_rows[0].key === 'move:shelfrow',
        { owner_shelved: MC.owner_shelved, summary: MC.owner_shelved_summary });
      /* THE SHELVED ROW STILL DOES NOT VOTE, AND THE COUNTED ONE STILL DOES. Naming a subtraction
       * must not become making it — the whole refusal this batch is built on is that the exemption
       * already existed and only its accountability was missing. */
      ok('RED — naming the shelf does not change the verdict: the shelved row is out of the count and '
       + 'the played one is still in it',
        MC.counted === 1 && MC.ok === false && MC.diverged === 1,
        { counted: MC.counted, ok: MC.ok, diverged: MC.diverged });
      /* PRINTED AT ZERO TOO — the DECLARED register's own standard, one block up. A subtraction that
       * goes silent when it stops firing is indistinguishable from a mechanic that never came up. */
      const NONE = mechanicsClause({ j: { ...PINNED({ [PIN.K.id]: 'rel-fixture' }),
                                          summary: { moves: { diverged: 1 } },
                                          rows: { moves: [{ id: 'atexactly', diverged: true }],
                                                  abilities: [], items: [] } },
        cur: { id: 'rel-fixture' }, U: FIXU, DI: decisionImpact('nothing-on-disk') });
      ok('RED — with nothing on the owner shelf the line still prints, and says so',
        /SHELVED BY THE OWNER — none/.test(NONE.why || '') && NONE.owner_shelved === 0,
        String(NONE.why || '').slice(0, 160));
      /* AND THE TWO COUNTS ARE COMPARED RATHER THAN ASSUMED EQUAL. A derived set is not a fact until
       * something compares it to its source. It does NOT fail on a mismatch — this batch is a
       * reporting change and may not move a count — but it says so at the point of subtraction. */
      const SKEW = mechanicsClause({ j: { ...FIX, summary: { moves: { diverged: 1, shelved_by_owner_diverging: 4 } } },
        cur: { id: 'rel-fixture' }, U: FIXU, DI: decisionImpact('nothing-on-disk') });
      ok('RED — when the shelved ROWS and the artifact SUMMARY disagree, the clause says so out loud '
       + 'and still does not move the verdict',
        /THE ROWS AND THE SUMMARY DISAGREE — 1 shelved row\(s\) against a summary of 4/.test(SKEW.why || '')
        && SKEW.counted === 1 && SKEW.ok === false,
        String(SKEW.why || '').slice(0, 240));
    }

    /* -- ROADMAP #290's GATE, RED AND GREEN, ON SYNTHETIC ARTIFACTS ---------------------------
     *
     * Driven through `orderProbeClause` itself — the function `--order-probe` exits on — with the
     * artifact passed in rather than read off disk, so a change to the rule cannot pass by having its
     * selftest restate the old one. The GREEN case matters as much as the red here: this gate is what
     * closes #290 the day the turn order is right, and a gate that can only be red is a gate that
     * cannot close anything.
     *
     * THE CURRENT RELEASE IS READ OFF DISK BY THE CLAUSE, so every synthetic artifact below carries
     * NO release. An unstamped artifact is deliberately allowed to answer — the clause refuses only on
     * a MISMATCH — which is the same rule `mechanicsClause` applies. */
    /* PINNED, because the order probe now refuses an artifact that cannot say what it was measured
     * under (see the block in `orderProbeClause`). Fixing the fixture is the right move; loosening
     * the clause so a synthetic artifact keeps passing would be the tuning this change is against. */
    const PROBE = (rows, extra) => PINNED({ games: 100, order_probe: rows, ...(extra || {}) });
    const PAIR = (tied, samePri) => ({ speed_tied: tied, same_priority: samePri, speed_gap: 40,
      cause: 'ordering :: |move|p1a|tailwind <> |move|p2a|tailwind', seed: 's' + tied + samePri,
      showdown_first: { body: 'A', speed: 300 }, medicham_first: { body: 'B', speed: 260 } });
    ok('RED — a pair NOT speed-tied at IDENTICAL priority is a turn-order defect and FAILS the clause',
      orderProbeClause(PROBE([PAIR(false, true)])).ok === false,
      orderProbeClause(PROBE([PAIR(false, true)])).why);
    ok('GREEN — a genuinely TIED pair is not a defect and the clause passes',
      orderProbeClause(PROBE([PAIR(true, true)])).ok === true);
    ok('GREEN — an UNTIED pair at DIFFERENT priority is not a defect either: both halves are required',
      orderProbeClause(PROBE([PAIR(false, false)])).ok === true);
    ok('the clause counts the conjunction rather than the array, and prints both',
      orderProbeClause(PROBE([PAIR(false, true), PAIR(true, true), PAIR(false, false)])).unequal === 1
      && orderProbeClause(PROBE([PAIR(false, true), PAIR(true, true), PAIR(false, false)])).probed === 3);
    /* THE THREE WAYS TO BE UNABLE TO ANSWER. Each must be RED, and none of them may read as green —
     * "the probe is absent" reading as "the turn order is right" is this project's signature bug. */
    ok('RED — NO ARTIFACT is a FAILING clause, never a passing one',
      orderProbeClause(null).ok === false && /NO ARTIFACT/.test(orderProbeClause(null).why));
    ok('RED — an artifact with NO order_probe array FAILS rather than passing by absence',
      orderProbeClause(PINNED({ games: 100 })).ok === false
      && /NO ORDER PROBE/.test(orderProbeClause(PINNED({ games: 100 })).why));
    ok('RED — an EMPTY probe over ZERO games decides nothing and does not pass',
      orderProbeClause(PINNED({ games: 0, order_probe: [] })).ok === false);
    ok('an empty probe over REAL games passes, and says it is clean BY ABSENCE rather than by proof',
      orderProbeClause(PINNED({ games: 100, order_probe: [] })).ok === true
      && /clean by absence/.test(orderProbeClause(PINNED({ games: 100, order_probe: [] })).why));
    /* THE RELEASE GUARD, WHICH IS THE ONE THAT FIRES TODAY. A probe cut against other bytes must
     * fail and must be distinguishable from the defect (`cannot_answer`). */
    const OTHER = orderProbeClause(PROBE([PAIR(true, true)], { [PIN.K.id]: 'not-this-tree' }));
    ok('RED — a probe measured against OTHER BYTES cannot answer, however clean it looks',
      OTHER.ok === false && OTHER.cannot_answer === true, OTHER.why);
    /* INVERTED 2026-09-04. This read *"the withheld run still reports what it found, so the figure is
     * visible and unquotable"* and asserted `OTHER.probed === 1`. There is no such thing as a visible
     * unquotable figure in this repository — `status.js` printed `PRE-CHANGE` beside the quarantined
     * numbers and they were quoted anyway, by the agent that printed them. Withheld means GONE. */
    ok('INVERTED 2026-09-04 — the withheld probe reports NOTHING it found: no probed count, no '
      + 'unequal count, and neither in the sentence',
      OTHER.probed === undefined && OTHER.unequal === undefined && !/1 pair/.test(OTHER.why), OTHER);
    ok('RED — an order probe with NO pin at all is WITHHELD too, not answered',
      orderProbeClause({ games: 100, order_probe: [PAIR(true, true)] }).withheld === true);


    /* DECISION IMPACT — the contract, driven through the shipping reader by pointing it at a synthetic
     * artifact on disk. Every refusal below is a case where a real run's verdict must NOT be honoured. */
    const diPath = D('data', 'decision-impact.json');
    const diHad = fs.existsSync(diPath);
    const diSaved = diHad ? fs.readFileSync(diPath, 'utf8') : null;
    /* THE LIVE FILE IS NEVER CLOBBERED. If one exists it is read back byte-for-byte at the end, and
     * this block refuses to run at all rather than risk it — a selftest that can destroy an artifact
     * is a worse bug than the one it is testing. */
    const diWrite = (o) => fs.writeFileSync(diPath, JSON.stringify(o, null, 2) + '\n');
    const GOOD = { engine_release: 'REL', null_demonstrated: true, generated: 'now',
      rows: [{ key: 'move:someplayedmove', flips: 0, paired: 60, fixed_in: 'arm-b' },
             { key: 'move:thinevidence', flips: 0, paired: 4, fixed_in: 'arm-b' },
             { key: 'move:itflipped', flips: 7, paired: 60, fixed_in: 'arm-b' },
             { key: 'cause:drag: a different body', flips: 0, paired: 90, fixed_in: 'arm-b' }] };
    try {
      diWrite(GOOD);
      const di = decisionImpact('REL');
      ok('DECISION IMPACT — a 0-flip row over enough paired points clears',
        !!di.clear('move:someplayedmove') && di.active === true);
      ok('the cleared row carries the 95% upper bound from its OWN n, never a bare zero',
        Math.abs(di.clear('move:someplayedmove').bound - 5) < 1e-9, di.clear('move:someplayedmove'));
      ok('RED — a row that FLIPPED clears nothing', di.clear('move:itflipped') === null);
      ok('RED — a 0-flip row over too few paired points clears nothing',
        di.clear('move:thinevidence') === null);
      ok('RED — a mechanic with no row at all clears nothing', di.clear('move:unmeasured') === null);
      ok('a cause row matches by PREFIX, so the whole-game clause can use the same contract',
        !!di.clear('cause:drag: a different body :: |drag|p1a|x <> |drag|p1a|y'));
      diWrite({ ...GOOD, null_demonstrated: false });
      ok('RED — an artifact that did not demonstrate its null clears NOTHING, however many rows it has',
        decisionImpact('REL').clear('move:someplayedmove') === null
        && decisionImpact('REL').active === false);
      diWrite({ ...GOOD, engine_release: 'OTHER' });
      ok('RED — an artifact cut against other bytes clears NOTHING',
        decisionImpact('REL').clear('move:someplayedmove') === null);
      diWrite({ ...GOOD, engine_release: null });
      ok('RED — an UNSTAMPED artifact clears NOTHING (absence of a release is not a match)',
        decisionImpact('REL').clear('move:someplayedmove') === null);
      fs.unlinkSync(diPath);
      ok('RED — with NO artifact, nothing is cleared and the clause says so rather than going quiet',
        decisionImpact('REL').clear('move:someplayedmove') === null
        && /NO DECISION-IMPACT RUN/.test(decisionImpact('REL').why));
      /* THE WHOLE-GAME CLAUSE THROUGH ITS OWN INJECTION POINT: the same cause, cleared and not. */
      const wgArt = { ...PINNED(), games: 100, diverged: 10, planted_divergence_proof_ok: true,
        mode: 'M',
        /* the published arm, so these cases exercise the SUBTRACTION rather than the population
         * refusal added 2026-09-03 — which has its own red block further down */
        steering: STEER_OK(),
        classes: [{ cls: 'drag', causes: [{ cause: 'drag: a different body :: x', n: 10 }] }] };
      diWrite(GOOD);
      /* the reader closes over the rows it read, so the file is no longer needed after this line */
      const wgDI = decisionImpact('REL');
      ok('NARRATION — a cause cleared by a paired run does not hold the clause shut',
        narrationClause(wgArt, wgDI).ok === true, narrationClause(wgArt, wgDI).why);
      ok('RED — the SAME artifact with an inert decision-impact reader still FAILS',
        narrationClause(wgArt, decisionImpact('NOPE')).ok === false);
      ok('the narration clause prints what was cleared and never folds it into the verdict silently',
        /DECISION IMPACT/.test(narrationClause(wgArt, wgDI).why));
    } finally {
      if (diSaved !== null) fs.writeFileSync(diPath, diSaved);
      else if (fs.existsSync(diPath)) fs.unlinkSync(diPath);
    }

    /* -- ROADMAP #298 — THE HEADLINE REFUSES AN ARTIFACT CUT AGAINST OTHER BYTES ---------------
     *
     * Driven through `wholeGameClause` itself, on artifacts injected through its first parameter, so
     * these assert the SHIPPING function rather than a restatement of it. The release id is read off
     * the real `data/engine-release.json` and never written — a selftest that moves the release
     * pointer would invalidate every run on the machine.
     *
     * THE RED CASE IS THE ONE THAT MATTERS AND IT IS ASSERTED TWICE: the clause must fail, AND the
     * measured figures must be ABSENT from what it returns. `PRE-CHANGE` was a caption beside a real
     * number and the number got quoted for days; a withheld figure that is still in the string is the
     * same bug with a different word in front of it. */
    {
      const relCur = readJson(D('data', 'engine-release.json'));
      const relId = relCur && (relCur.id || relCur.release || relCur.current);
      /* THE FIXTURE CARRIES A `state` BLOCK because these arms are driven through the BOARD clause,
       * which reads `state.games` / `state.games_board_never_diverged` and refuses an artifact that
       * carries neither. Its board numbers are deliberately DIFFERENT from its protocol ones (1230
       * games, 695 protocol divergences, 700 boards never parted -> 530 board-material) so that an
       * arm cannot pass by reading the wrong quantity and getting the same answer. */
      const WG = (extra) => PINNED({ games: 1230, diverged: 695, planted_divergence_proof_ok: true,
        mode: 'M', generated: 'then', classes: [], steering: STEER_OK(),
        state_mode: true,
        state: { games: 1230, games_board_never_diverged: 700, protocol_diverged_games: 695,
                 protocol_diverged_board_never_did: 200,
                 planted_state_proof_ok: true, mappings_all_proved: true },
        ...extra });
      const stale = wholeGameClause(WG({ engine_release: '__not-this-tree__' }), decisionImpact('NOPE'));
      if (!relId) {
        ok('#298 — no engine-release.json on this tree, so the clause has no id to disagree with and '
          + 'is inert BY DESIGN (same as its siblings)', stale.withheld !== true, stale.why);
      } else {
        ok('RED — #298 — an artifact stamped to ANOTHER release FAILS the whole-game clause',
          stale.ok === false && stale.withheld === true && stale.cannot_answer === true, stale.why);
        ok('RED — #298 — and the FIGURE IS GONE, not captioned: no rate, no diverged, no games, and '
          + 'none of the three numbers appears in the verdict string',
          stale.rate === undefined && stale.diverged === undefined && stale.games === undefined
          && !/1230|695|56\.5/.test(stale.why), stale);
        ok('#298 — the withheld verdict names WHICH release it wanted and WHICH it got, because that '
          + 'is the only fact the artifact still supports',
          stale.ranOn === '__not-this-tree__' && stale.staleAgainst === relId
          && stale.why.indexOf(relId) >= 0, stale);
        const fresh = wholeGameClause(WG({ engine_release: relId }), decisionImpact('NOPE'));
        ok('#298 — an artifact stamped to THIS tree is answered normally, so the check refuses a '
          + 'mismatch and nothing else', fresh.withheld !== true && fresh.games === 1230, fresh.why);
      }
      /* INVERTED 2026-09-04, for the same reason as the roster arm above. This read *"an UNSTAMPED
       * artifact is allowed to answer, exactly as orderProbeClause allows one"* — and `WG({})` now
       * carries a pin, so the arm would have kept passing while testing nothing at all. */
      const unstampedWG = WG({}); delete unstampedWG[PIN.K.id]; delete unstampedWG[PIN.K.digests];
      const unstamped = wholeGameClause(unstampedWG, decisionImpact('NOPE'));
      ok('#298 — INVERTED 2026-09-04 — an UNSTAMPED whole-game artifact is WITHHELD. This is the '
        + 'clause whose number gets quoted, and an unpinned figure reads exactly like a pinned one',
        unstamped.withheld === true && unstamped.games === undefined, unstamped.why);

      /* -- AND THE EXIT CODE THE WITHHOLD TURNS INTO, because a verdict object nobody maps is not a
       * gate. `--whole-game` (ROADMAP #218's instrument) and `--order-probe` (#290's) share ONE
       * mapping, so a withheld figure cannot exit 0 through one command and 2 through the other. */
      ok('RED — #298/#218 — a WITHHELD whole-game verdict exits 2, never 0: a `VERIFIED BY` that '
        + 'exited 0 because the artifact described other bytes would close a live defect',
        clauseExit(stale) === 2, clauseExit(stale));
      ok('a passing clause exits 0 and a failing-but-answerable one exits 1',
        clauseExit({ ok: true }) === 0 && clauseExit({ ok: false }) === 1);
      ok('RED — a clause that returned NOTHING AT ALL exits 2, never 0',
        clauseExit(null) === 2 && clauseExit(undefined) === 2);
      ok('RED — `cannot_answer` alone is enough for 2, without `withheld`',
        clauseExit({ ok: false, cannot_answer: true }) === 2);

      /* -- THE POPULATION REFUSAL — 2026-09-03 ------------------------------------------------
       *
       * The gate read 8 of 8 PASS on a coverage-arm artifact in which 944 of 961 games never
       * ended. The artifact records its own `steering.policy`, so the clause can tell — it simply
       * never asked. These are driven through the SHIPPING clause on injected artifacts, and the
       * green case is the one above (`WG` declares the empirical policy), so this block proves the
       * refusal fires without proving that it fires on everything.
       *
       * A GREEN THAT LOOKS LIKE THIS BLOCK'S GREEN IS WORTHLESS WITHOUT THE THIRD CASE. Refusing a
       * NAMED coverage artifact and refusing an artifact with NO block are different failures — the
       * second is the one that would quietly return if somebody re-published an older run. */
      {
        const S = require('./steering.js');
        const cov = wholeGameClause(WG({ steering: { policy: S.POLICY } }), decisionImpact('NOPE'));
        ok('RED — a COVERAGE-arm artifact cannot answer the whole-game clause: 944 of 961 of its '
          + 'games never end, so a PASS there is a claim about openings',
          cov.ok === false && cov.cannot_answer === true && cov.withheld === true, cov.why);
        ok('RED — and the FIGURE IS GONE, not captioned: no rate, no diverged, no games, and none '
          + 'of the three numbers appears in the verdict string',
          cov.rate === undefined && cov.diverged === undefined && cov.games === undefined
          && !/1230|695|56\.5/.test(cov.why), cov);
        ok('the refusal NAMES both policies, so a reader is not left guessing which arm it wanted',
          cov.steering_policy === S.POLICY && cov.wanted_steering_policy === S.POLICY_EMPIRICAL
          && cov.why.indexOf(S.POLICY) >= 0 && cov.why.indexOf(S.POLICY_EMPIRICAL) >= 0, cov);
        const none = wholeGameClause(WG({ steering: undefined }), decisionImpact('NOPE'));
        ok('RED — an artifact with NO steering block cannot answer either: nothing recorded what '
          + 'selected its sample, which is how steering.comparable has failed closed since #81',
          none.ok === false && none.cannot_answer === true && none.games === undefined, none.why);
        ok('RED — the population refusal exits 2, never 0', clauseExit(cov) === 2);
      }
    }

    /* -- BOARD-MATERIAL vs NARRATION — TWO CLAUSES, AND EACH MUST BE ABLE TO FAIL ALONE ---------
     *
     * WILL'S CALL, 2026-08-22, WIRED 2026-09-04: board-material gates, narration reports. The whole
     * hazard of a split like this is ONE CLAUSE WEARING TWO NAMES — two rows in the report, one
     * quantity underneath, and nobody able to tell because both rows move together. So the proof is
     * not that each clause returns a number; it is that the two arms below are OPPOSITE, and that
     * each clause is red on exactly one of them.
     *
     * MEASURED BEFORE THE ARMS WERE TRUSTED, on the pre-change implementation — the protocol clause
     * standing in the board slot, which is what shipped until 2026-09-04. It passes ARM A (where 12
     * boards part and the narration is clean) and fails ARM B (where 40 protocol lines part and no
     * board does): 6 of the 9 assertions below go red, and both directions are inverted. An arm set
     * that could not do that would be re-testing one clause twice.
     *
     * THE FIXTURES DIFFER IN THEIR BOARD FIELDS AND THEIR PROTOCOL FIELDS INDEPENDENTLY, which is
     * the only way a clause reading the wrong one is caught: ARM A is `diverged: 0` with 12 boards
     * parted, ARM B is `diverged: 40` with zero boards parted. A clause reading the other quantity
     * gives the wrong verdict on BOTH, not on neither. */
    {
      const SPLIT = (o) => PINNED(Object.assign({
        mode: (readJson(D('data', 'whole-game-baseline.json')) || {}).mode || 'M',
        generated: 'fixture', planted_divergence_proof_ok: true, steering: STEER_OK(),
        state_mode: true,
      }, o));
      const INERT = { active: false, why: 'no run', clear: () => null };
      /* ARM A — 12 boards part; the protocol never diverges once. */
      const ARM_A = SPLIT({ games: 1000, diverged: 0, classes: [],
        state: { games: 1000, games_board_never_diverged: 988,
                 protocol_diverged_games: 0, protocol_diverged_board_never_did: 0,
                 turn_boundaries_compared: 9000, turn_boundaries_identical: 8970,
                 board_parted_before_the_protocol_did: 12, protocol_diverged_board_held_longer: 0,
                 planted_state_proof_ok: true, mappings_all_proved: true,
                 first_board_divergences: [{ turn: 4, seed: 'fixture-a-1',
                   protocol_diverged_at_turn: null,
                   diffs: [{ path: 'p1.active[0].hp', medicham: 100, showdown: 80 }] }] } });
      /* ARM B — 40 protocol first divergences; not one board ever parts. */
      const ARM_B = SPLIT({ games: 1000, diverged: 40,
        classes: [{ cls: 'event missing from medicham2',
          causes: [{ cause: 'event missing from medicham2 :: |upkeep <> |-end|p1a|x', n: 40 }] }],
        state: { games: 1000, games_board_never_diverged: 1000,
                 protocol_diverged_games: 40, protocol_diverged_board_never_did: 40,
                 turn_boundaries_compared: 9000, turn_boundaries_identical: 9000,
                 board_parted_before_the_protocol_did: 0, protocol_diverged_board_held_longer: 0,
                 planted_state_proof_ok: true, mappings_all_proved: true,
                 first_board_divergences: [] } });
      const aB = wholeGameClause(ARM_A), aN = narrationClause(ARM_A, INERT);
      const bB = wholeGameClause(ARM_B), bN = narrationClause(ARM_B, INERT);
      ok('SPLIT / ARM A — boards part and the narration agrees: the BOARD clause FAILS',
        aB.ok === false && aB.board_material === 12, aB.why);
      ok('SPLIT / ARM A — ...and on the SAME artifact the NARRATION clause PASSES. Two rows, two '
        + 'answers: this is the assertion that the split is not one clause wearing two names',
        aN.ok === true, aN.why);
      ok('SPLIT / ARM B — the narration parts and no board does: the BOARD clause PASSES',
        bB.ok === true && bB.board_material === 0, bB.why);
      ok('SPLIT / ARM B — ...and on the SAME artifact the NARRATION clause FAILS',
        bN.ok === false && bN.undeclared === 40, bN.why);
      ok('SPLIT — the two arms move the board clause in OPPOSITE directions from the narration '
        + 'clause. Identical verdicts across a varied knob would mean the knob is unwired',
        aB.ok !== bB.ok && aN.ok !== bN.ok && aB.ok !== aN.ok && bB.ok !== bN.ok,
        'A board=' + aB.ok + '/narr=' + aN.ok + '  B board=' + bB.ok + '/narr=' + bN.ok);
      /* THE QUANTITY IS IN THE FIRST WORDS OF EACH VERDICT, NOT ONLY IN A FIELD. Two correct numbers
       * printed side by side with only one published is ROADMAP #387, and it cost three reconciles
       * in one session. A reader must never have to work out which `N of M` this is. */
      ok('SPLIT — each clause NAMES ITS QUANTITY in the first words of its own verdict and in a '
        + '`quantity` field, so no reader has to guess which of the two an `N of M` came from',
        /^BOARD-MATERIAL/.test(aB.why) && /^PROTOCOL FIRST DIVERGENCE/.test(bN.why)
        && aB.quantity === 'board_material_games'
        && bN.quantity === 'protocol_first_divergence_games',
        aB.quantity + ' / ' + bN.quantity);
      ok('SPLIT — the narration clause declares `gates: false` and the board clause does not, and '
        + 'the narration verdict SAYS SO in words as well as in a field',
        bN.gates === false && aB.gates !== false && /REPORTS, IT DOES NOT HOLD THE GATE SHUT/.test(bN.why),
        'narration gates=' + bN.gates + '  board gates=' + aB.gates);

      /* -- THE UNCAUSED SET, WHICH IS THE FAILURE MODE OF THE SPLIT ---------------------------
       *
       * A game whose protocol divergence CLOSES while its board still parts has nothing in the
       * narration pointing at it — no cause, no class, no shape. Under the single clause that
       * shipped until 2026-09-04 it left the count altogether, and a fix could therefore make the
       * headline better by making the engine no more correct. ARM A is entirely that case. */
      ok('SPLIT / UNCAUSED — a board that parts with NO protocol divergence anywhere in the game is '
        + 'counted AND named as uncaused, not merely counted',
        aB.board_material_uncaused_by_protocol === 12 && /UNCAUSED — 12 of the 12/.test(aB.why),
        aB.board_material_uncaused_by_protocol);
      ok('SPLIT / UNCAUSED — the sample row carrying `protocol_diverged_at_turn: null` is PRINTED '
        + 'with its leaf path, because a count with no worked example is not evidence anybody can act on',
        /fixture-a-1/.test(aB.why) && /p1\.active\[0\]\.hp/.test(aB.why), aB.why);
      ok('SPLIT / UNCAUSED — with every board agreeing there are none, and the sample is EMPTY '
        + 'rather than absent — a control, so the arm above is not matching a fixed string',
        bB.board_material_uncaused_by_protocol === 0
        && !/protocol_diverged_at_turn: null`:/.test(bB.why), bB.why);
      /* RED — the four fields are not clamped. `Math.max(0, ...)` here would turn an instrument
       * contradicting itself into a clean bill of health, which is the silent default this file
       * opens with. */
      const CONTRA = SPLIT({ games: 1000, diverged: 40, classes: [],
        state: { games: 1000, games_board_never_diverged: 995,
                 protocol_diverged_games: 40, protocol_diverged_board_never_did: 0,
                 planted_state_proof_ok: true, mappings_all_proved: true } });
      const contra = wholeGameClause(CONTRA);
      ok('SPLIT / RED — 5 board-material games but 40 games whose protocol AND board both parted is '
        + 'an artifact contradicting itself, and it is REPORTED rather than clamped to zero',
        contra.ok === false && contra.board_material_uncaused_by_protocol === -35
        && /CONTRADICTS ITSELF/.test(contra.why), contra.why);

      /* -- THE BOARD CLAUSE HAS NO FALLBACK ONTO THE PROTOCOL COUNT ---------------------------
       *
       * This is the one branch that would quietly undo the whole change: an artifact with no board
       * comparison, answered off `j.diverged`, publishes the narration count under the board
       * clause's name. It refuses, and the refusal names `state_mode` so a reader knows the run was
       * never asked for boards rather than guessing that boards agreed. */
      const NOSTATE = SPLIT({ games: 1000, diverged: 40, classes: [], state_mode: false });
      delete NOSTATE.state;
      const nos = wholeGameClause(NOSTATE);
      ok('SPLIT / RED — an artifact with NO board comparison CANNOT ANSWER the board clause, and '
        + 'nothing falls back onto `j.diverged`: the protocol count may not be published under the '
        + 'board clause\'s name',
        nos.ok === false && nos.cannot_answer === true && nos.board_material === undefined
        && !/\b40\b/.test(nos.why) && /state_mode/.test(nos.why), nos.why);
      ok('SPLIT / RED — and the same artifact still ANSWERS the narration clause, so the refusal '
        + 'above is about the missing BOARD data and not about the fixture being malformed',
        narrationClause(NOSTATE, INERT).cannot_answer !== true, narrationClause(NOSTATE, INERT).why);

      /* -- THE BOARD COMPARATOR'S OWN PLANTED PROOF, NOT THE PROTOCOL ONE --------------------- */
      const UNPROVED = SPLIT({ games: 1000, diverged: 0, classes: [],
        state: { games: 1000, games_board_never_diverged: 1000,
                 protocol_diverged_games: 0, protocol_diverged_board_never_did: 0,
                 planted_state_proof_ok: false, mappings_all_proved: true } });
      const unp = wholeGameClause(UNPROVED);
      ok('SPLIT / RED — a run whose BOARD comparator never proved it can see a planted board '
        + 'difference is WITHHELD, even though its PROTOCOL proof fired. An instrument vouched for '
        + 'by a different instrument reads exactly like a vouched one',
        unp.ok === false && unp.cannot_answer === true && unp.board_material === undefined,
        unp.why);
      const UNMAPPED = SPLIT({ games: 1000, diverged: 0, classes: [],
        state: { games: 1000, games_board_never_diverged: 1000,
                 protocol_diverged_games: 0, protocol_diverged_board_never_did: 0,
                 planted_state_proof_ok: true, mappings_all_proved: false } });
      ok('SPLIT / RED — and an unproved LEAF MAPPING withholds it too: "no board differs" means '
        + 'nothing when nobody demonstrated the mapping that would have shown one',
        wholeGameClause(UNMAPPED).cannot_answer === true, wholeGameClause(UNMAPPED).why);
      ok('SPLIT / GREEN — with both proofs fired and every board agreeing, the clause PASSES. '
        + 'Without this the two arms above would pass against a clause that refuses everything',
        wholeGameClause(SPLIT({ games: 1000, diverged: 0, classes: [],
          state: { games: 1000, games_board_never_diverged: 1000,
                   protocol_diverged_games: 0, protocol_diverged_board_never_did: 0,
                   planted_state_proof_ok: true, mappings_all_proved: true } })).ok === true);

      /* -- AND THE GATE ITSELF: A REPORTING CLAUSE MAY NOT DECIDE IT, AND MUST STILL BE SEEN ---
       *
       * Driven on synthetic clause lists rather than on the live gate, because the live gate reads
       * whatever artifact is on disk and this asserts the RULE. `gates` is opt-in: a clause added
       * tomorrow that forgets the field GATES, which is the safe direction. */
      const G = gateVerdict;      /* THE SHIPPING RULE, not a restatement of it — see gateVerdict */
      const gRows = [{ name: 'board', ok: true }, { name: 'narration', ok: false, gates: false }];
      ok('SPLIT / GATE — a RED reporting clause does not hold the gate shut, which is what Will\'s '
        + '2026-08-22 ruling says in as many words',
        G(gRows).ok === true);
      ok('SPLIT / GATE — ...but it is STILL in `failing`, so status.js and every reader sees the red '
        + 'row. Withholding it from the gate is not the same as hiding it, and the difference is '
        + 'the whole reason the ruling kept narration as a clause rather than a backlog',
        G(gRows).failing.length === 1 && G(gRows).gate_failing.length === 0
        && G(gRows).reporting.length === 1);
      ok('SPLIT / GATE / RED — a clause that does NOT declare `gates` still holds the gate shut. '
        + 'The unsafe default would be a new clause that quietly reports and blocks nothing',
        G([{ name: 'board', ok: false }, { name: 'narration', ok: true, gates: false }]).ok === false);
      /* RED — THE REFUSAL PATHS CARRY THE FLAG TOO. A stale, torn or unpinned artifact makes the
       * narration clause come back WITHHELD, and a withheld clause with no `gates` field would
       * default to gating and hold the quarantine gate shut on the quantity Will took off the
       * critical path. Both refusal families are asserted, because they leave through different
       * doors — `wholeGameDoor` for the pin, the clause body for the planted proof. */
      const refusedNarr = narrationClause(SPLIT({ games: 1000, diverged: 40, classes: [],
        steering: undefined, state: ARM_B.state }), INERT);
      ok('SPLIT / RED — a WITHHELD narration clause still declares `gates: false`. Without this a '
        + 'stale artifact would put narration back on the gate and nothing would say so',
        refusedNarr.withheld === true && refusedNarr.gates === false, refusedNarr.gates);
      const noProofNarr = narrationClause(SPLIT({ games: 1000, diverged: 40, classes: [],
        planted_divergence_proof_ok: false, state: ARM_B.state }), INERT);
      ok('SPLIT / RED — and so does the OTHER refusal family, which leaves through a different exit: '
        + 'a planted protocol proof that did not fire',
        noProofNarr.ok === false && noProofNarr.gates === false, noProofNarr.gates);
      ok('SPLIT / GATE — and the SHIPPING assembler is the thing being described: the live gate '
        + 'carries exactly one reporting clause and it is the narration one',
        (() => { const g = medichamIsCorrect();
                 return (g.reporting || []).length === 1
                   && /NARRATION/.test(g.reporting[0].name); })(),
        (medichamIsCorrect().reporting || []).map(c => c.name));
    }


    /* -- THE TWO DECLARED KINDS, AND THE BOUNDARY ON EACH MATCHER — 2026-08-23 ------------------
     *
     * THE POSITIVE CASE IS NOT THE PROOF. A declaration is one loose matcher away from hiding a real
     * defect, so what is asserted here is mostly what does NOT match: every one of these mutations is
     * a REAL defect wearing the same cause shape, and each must fall through to UNDECLARED and hold
     * the gate shut. Driven through the shipping `wholeGameClause` on injected artifacts, so these
     * assert the function the gate calls rather than a restatement of it. */
    {
      const MOODY_SD = '|-boost|p2a: Scovillain|spa|2';
      const MOODY_ME = '|-boost|p2a: Scovillain|def|2|[from] ability: moody';
      const WG = (cause, rows, probe) => PINNED({ games: 100, diverged: rows.length, mode: 'M',
        planted_divergence_proof_ok: true, steering: STEER_OK(),
        classes: [{ cls: cause.split(' :: ')[0], causes: [{ cause, n: rows.length }] }],
        first_divergences: rows.map((r) => ({ cause, showdown_before: [], ...r })),
        order_probe: (probe || []).map((r) => ({ cause, ...r })) });
      const INERT = { active: false, why: 'no run', clear: () => null };
      const dec = (cause, rows, probe) => narrationClause(WG(cause, rows, probe), INERT);
      const MOODY = '-boost field 3 :: |-boost|p2a|spa|2 <> |-boost|p2a|def|2';

      /* MOODY IS NO LONGER DECLARED, AND THIS IS THE RATCHET THAT KEEPS IT THAT WAY — 2026-08-25.
       * The row claimed the residual `sample()` had no shared address. It had one; OUR half of it was
       * stale, because this engine never cleared the active move the way `sim/battle.ts:2810/:2828`
       * does. With the address fixed the eight declared games went to ZERO in the artifact, six of
       * them stopped diverging at all, and TWO were revealed to be different real defects the label
       * had been hiding. If somebody re-adds the row, this goes red — the same shape as the speed-tie
       * refusal below, and for the same reason. */
      const gone = dec(MOODY, [{ showdown: MOODY_SD, medicham: MOODY_ME }]);
      ok("RED — a Moody-shaped stat-pick divergence is UNDECLARED and HOLDS THE GATE SHUT: the "
        + "declaration's mechanism was refuted, so the exemption is withdrawn",
        gone.declared === 0 && gone.declared_by_kind.INCOMPARABLE === 0 && gone.undeclared === 1
        && gone.ok === false, gone.declared_by_kind);
      ok('...and no INCOMPARABLE heading is printed when no row makes that claim',
        !/IMPOSSIBLE TO COMPARE/.test(gone.why), gone.why);

      /* THE TWO KINDS STILL PRINT APART AND ARE NEVER SUMMED. Asserted on a SYNTHETIC row rather than
       * a shipping one, push/pop like the DEFERRED guard below, because the shipping list currently
       * holds no INCOMPARABLE row and a printer property must not silently lose its test when the
       * last row of a kind is withdrawn. */
      {
        DECLARED_DIVERGENCE.push({ kind: 'INCOMPARABLE', name: 'a synthetic unshared draw',
          match: (c) => c === MOODY, why: 'selftest only — never shipped' });
        try {
          const r = dec(MOODY, [{ showdown: MOODY_SD, medicham: MOODY_ME }]);
          ok('an INCOMPARABLE row prints under its OWN heading and is not summed with AUTHORITY-WRONG',
            r.declared === 1 && r.declared_by_kind.INCOMPARABLE === 1
            && r.declared_by_kind['AUTHORITY-WRONG'] === 0
            && /IMPOSSIBLE TO COMPARE/.test(r.why) && /\[1 game\(s\), 1 row\(s\)\]/.test(r.why),
            r.declared_by_kind);
        } finally { DECLARED_DIVERGENCE.pop(); }
      }

      /* SPEED TIES ARE NOT DECLARED, AND THIS ASSERTS THE REFUSAL RATHER THAN LEAVING IT TO THE
       * ABSENCE OF A ROW. The middle arm pins the tie on BOTH sides (`o.tie = () => 0` against a
       * no-op `pinShuffle`), so a probed tie that still diverges is a real turn-order disagreement.
       * If somebody re-adds the row, this goes red. */
      const TIE = 'ordering :: |move|p1b|protect <> |move|p2a|protect';
      const tieRow = [{ showdown: '|move|p1b: Venusaur|Protect|p1b: Venusaur',
                        medicham: '|move|p2a: Politoed|protect|p2a: Politoed' }];
      for (const gap of [0, 40]) {
        const r = dec(TIE, tieRow, [{ speed_tied: gap === 0, speed_gap: gap, same_priority: true }]);
        ok('RED — a probed speed tie at gap ' + gap + ' is UNDECLARED: the harness already shares '
          + 'the tie die, so this is a real disagreement and not an incomparability',
          r.declared === 0 && r.undeclared === 1, r.declared_by_kind);
      }

      /* THE GUARD THAT MAKES THE THIRD KIND SAFE TO NOT BUILD. A DEFERRED row asserts there IS a
       * defect; it must never be subtracted and must never open this gate. `DECLARED_KINDS` is the
       * whitelist, so a row typed with any other kind is counted UNDECLARED and NAMED. */
      const before = MATCHER_THREW.length;
      DECLARED_DIVERGENCE.push({ kind: 'DEFERRED', name: 'a deferred defect',
        match: () => true, why: 'we know this is wrong and have not fixed it' });
      try {
        const r = dec('anything at all :: |x <> |y', [{ showdown: '|x', medicham: '|y' }]);
        ok('RED — a row typed `kind: DEFERRED` is NOT subtracted and does NOT open the clause: a '
          + 'defect we chose to skip is not the same as no defect',
          r.declared === 0 && r.undeclared === 1 && r.ok === false, r);
        ok('...and it is NAMED on the run rather than going quiet',
          MATCHER_THREW.length > before && /DEFERRED/.test(MATCHER_THREW[MATCHER_THREW.length - 1].error),
          MATCHER_THREW[MATCHER_THREW.length - 1]);
      } finally {
        DECLARED_DIVERGENCE.pop();
        MATCHER_THREW.length = before;
      }

      /* == THE CLOSET — WILL'S RULING, 2026-08-26/27 ============================================
       *
       * *"no if i put things into the closet it should not be gated — like illusion"*, and
       * *"things in the closet shouldnt block a gate if we know why they fail and choose to accept
       * it."* `CLOSETED` is the kind that does that, and it is the ONLY kind here that admits a
       * defect exists — so the whole weight of these assertions is on the DOOR rather than on the
       * subtraction. Every one of them is a way of getting into the closet that must FAIL.
       *
       * DRIVEN THROUGH THE SHIPPING `wholeGameClause`, on synthetic rows pushed and popped, for the
       * same reason as the two blocks above: a selftest that restates the rule proves nothing about
       * the rule that ships, and the shipping list holds NO closeted row today (see the withdrawn
       * Tailwind comment in `DECLARED_DIVERGENCE`), so without push/pop this whole block would be
       * testing an empty list.
       *
       * A COMPLETE ROW, USED AS THE POSITIVE CASE AND THEN BROKEN ONE FIELD AT A TIME. */
      {
        const CAUSE = 'anything at all :: |x <> |y';
        const ROWS = [{ showdown: '|x', medicham: '|y' }];
        const FULL = () => ({
          kind: 'CLOSETED', name: 'a synthetic closeted divergence', match: () => true,
          why: 'selftest only — never shipped',
          closet: { by: 'Will', on: '2026-08-26', authority: 'ROADMAP #000',
                    ruling: 'selftest ruling long enough to be a sentence somebody said' },
          evidence: { instrument: 'engine/game_differential.js', release: 'REL-A', on: '2026-08-26',
                      says: 'zero board leaves written across the run' },
          falsifiedBy: 'any run in which this cause writes a board leaf on either side',
        });
        const push = (mut) => {
          const d = FULL(); if (mut) mut(d); DECLARED_DIVERGENCE.push(d); return d;
        };
        /* -- POSITIVE: a complete closet row DOES leave the gate, which is the whole ruling ---- */
        {
          const before = MATCHER_THREW.length;
          push();
          try {
            const r = dec(CAUSE, ROWS);
            ok('a COMPLETE closeted row is subtracted and the clause OPENS — Will, 2026-08-26: '
              + '"if i put things into the closet it should not be gated"',
              r.declared === 1 && r.declared_by_kind.CLOSETED === 1 && r.undeclared === 0
              && r.ok === true, r.declared_by_kind);
            ok('...under its OWN heading, which says it IS a defect, never summed with the two '
              + 'kinds that say there is none',
              /CLOSETED BY THE OWNER/.test(r.why) && r.declared_by_kind['AUTHORITY-WRONG'] === 0
              && r.declared_by_kind.INCOMPARABLE === 0, r.declared_by_kind);
            ok('...and it is NOT INVISIBLE: the owner, the date, the register row, his own words '
              + 'and the falsifier all print at the point of subtraction',
              /CLOSETED BY Will 2026-08-26 \(ROADMAP #000\)/.test(r.why)
              && /WOULD BE WRONG IF: any run in which this cause writes a board leaf/.test(r.why),
              r.why);
          } finally { DECLARED_DIVERGENCE.pop(); MATCHER_THREW.length = before; }
        }
        /* -- THE DOOR: every missing field must REFUSE, and the row must be NAMED ---------------
         * This is the assertion that separates `CLOSETED` from `DEFERRED`. If any of these passes,
         * the closet has become a sentence anybody can type — which is the `NOT A DEFECT` regex
         * failure rebuilt on the other side of the file. */
        for (const [field, mut] of [
          ['closet',             (d) => { delete d.closet; }],
          ['closet.by',          (d) => { delete d.closet.by; }],
          ['closet.on',          (d) => { d.closet.on = 'last tuesday'; }],
          ['closet.ruling',      (d) => { d.closet.ruling = 'nah'; }],
          ['closet.authority',   (d) => { delete d.closet.authority; }],
          ['evidence',           (d) => { delete d.evidence; }],
          ['evidence.instrument',(d) => { delete d.evidence.instrument; }],
          ['evidence.release',   (d) => { delete d.evidence.release; }],
          ['evidence.on',        (d) => { d.evidence.on = ''; }],
          ['evidence.says',      (d) => { d.evidence.says = 'fine'; }],
          ['falsifiedBy',        (d) => { delete d.falsifiedBy; }],
        ]) {
          const before = MATCHER_THREW.length;
          push(mut);
          try {
            const r = dec(CAUSE, ROWS);
            ok('RED — a closeted row missing `' + field + '` is REFUSED at the door and holds the '
              + 'gate SHUT: a closet entry is a ruling with a mechanism, not a phrase',
              r.declared === 0 && r.undeclared === 1 && r.ok === false, r.declared_by_kind);
            ok('...and the refusal is NAMED on the run rather than going quiet (' + field + ')',
              MATCHER_THREW.length > before
              && /is missing or malformed/.test(MATCHER_THREW[MATCHER_THREW.length - 1].error),
              MATCHER_THREW[MATCHER_THREW.length - 1]);
          } finally { DECLARED_DIVERGENCE.pop(); MATCHER_THREW.length = before; }
        }
        /* -- A CLOSET ENTRY IS A CLAIM AND MUST BE RE-CHECKED ----------------------------------
         * Four declarations in this project have been refuted — speed ties, Tailwind's coin, Moody,
         * and a fainted body in an active slot — and tonight's die fix voided every measurement
         * taken before it. An exemption resting on evidence from another release must SAY SO.
         *
         * IT IS ASSERTED THROUGH `declaredMatch` AND THE PRINTER, NOT THROUGH THE CLAUSE, AND THAT
         * IS FORCED RATHER THAN CHOSEN. `wholeGameClause` refuses outright (#298) any artifact whose
         * release differs from the tree's, so an injected artifact can only ever carry the CURRENT
         * release or none at all — there is no way to hand the clause a second release to compare
         * against. The comparison a closeted row actually makes is therefore "my evidence's release
         * against the release this run measured", which is exactly what these two calls exercise. */
        {
          const before = MATCHER_THREW.length;
          const d = push();
          try {
            const same = declaredMatch(CAUSE, () => ({ firsts: [], probes: [] }), MATCHER_THREW,
                                       { release: 'REL-A' });
            ok('a closet row whose evidence was measured on THIS run\'s release is subtracted with '
              + 'no staleness reported', !!same && !same.evidence_stale, same && same.evidence_stale);
            const stale = declaredMatch(CAUSE, () => ({ firsts: [], probes: [] }), MATCHER_THREW,
                                        { release: 'REL-B' });
            ok('RED — the same closet row against a run measured on ANOTHER release SAYS its '
              + 'evidence has not been re-checked, naming both releases',
              !!stale && /EVIDENCE NOT RE-CHECKED/.test(String(stale.evidence_stale))
              && /REL-A/.test(String(stale.evidence_stale))
              && /REL-B/.test(String(stale.evidence_stale)), stale && stale.evidence_stale);
            ok('...and it STILL SUBTRACTS, because the owner ruled and staleness is a warning about '
              + 'the measurement under the ruling, not a reversal of it',
              !!stale && stale.kind === 'CLOSETED', stale && stale.kind);
            ok('...and the staleness sentence REACHES THE PRINTED REGISTER, which is the only place '
              + 'a reader would ever see it',
              /EVIDENCE NOT RE-CHECKED/.test(declaredRegisterLine([{ name: d.name, n: 1 }],
                { release: 'REL-B' })),
              declaredRegisterLine([{ name: d.name, n: 1 }], { release: 'REL-B' }));
            ok('RED — a run that carries NO release at all cannot report the evidence FRESH: an '
              + 'unstamped artifact is an absence of evidence, never a clean bill',
              !/re-checked/i.test(declaredRegisterLine([{ name: d.name, n: 1 }], { release: null }))
              && !/FRESH/.test(declaredRegisterLine([{ name: d.name, n: 1 }], { release: null })),
              declaredRegisterLine([{ name: d.name, n: 1 }], { release: null }));
          } finally { DECLARED_DIVERGENCE.pop(); MATCHER_THREW.length = before; }
        }
        /* -- EXCLUDED IS NOT INVISIBLE, AND A DECLARATION THAT MATCHES NOTHING SAYS SO ----------
         * Will's own bar for the narration gate was *"a GATE, not a backlog"*. `declaredLine`
         * prints only rows that FIRED, so a stale exemption covering nothing was invisible — which
         * is how the withdrawn Tailwind row would have sat here forever after #493 fixed it. */
        {
          const before = MATCHER_THREW.length;
          DECLARED_DIVERGENCE.push({ ...FULL(), match: () => false });
          try {
            const r = dec(CAUSE, ROWS);
            ok('RED — a declared row that MATCHED NOTHING is printed anyway and named as a claim '
              + 'that may have quietly become false',
              /THE DECLARED REGISTER/.test(r.why) && /MATCHED NOTHING IN THIS RUN/.test(r.why), r.why);
            ok('...and it subtracts nothing, so an unused exemption cannot open a gate',
              r.declared === 0 && r.undeclared === 1 && r.ok === false, r.declared_by_kind);
          } finally { DECLARED_DIVERGENCE.pop(); MATCHER_THREW.length = before; }
        }
        /* THE COUNT IS PRINTED, NOT PINNED — CHANGED 2026-08-28 WHEN THE CLOSET STOPPED BEING EMPTY.
         * This read `/CLOSETED: 0/` and the assertion it was making was never about the ZERO: it is
         * that the register prints the closet's size on every run, at zero as loudly as at seven,
         * because a closet that goes quiet has been hidden rather than accepted. Pinning the literal
         * made the ratchet fail the moment the first row shipped, which would have read as a broken
         * gate and is the "a green test can be asking nothing" shape pointed the other way. */
        ok('the register prints its closeted count on EVERY run, whatever that count is — a closet '
          + 'that goes quiet has been hidden, not accepted',
          /THE DECLARED REGISTER/.test(dec(CAUSE, ROWS).why)
          && /CLOSETED: \d+/.test(dec(CAUSE, ROWS).why), dec(CAUSE, ROWS).why.slice(0, 200));
        /* AND THE SHIPPING ROWS ARE SCHEMA-CHECKED HERE, WHICH IS THE RATCHET THAT DOES NOT ROT.
         * The assertion this replaces was `the shipping closet is empty today` — true on 2026-08-27,
         * false on 2026-08-28, and a fact about a LIST is exactly the thing this repository has been
         * burned by writing down (the ban list of four, the fourteen handoffs). What is worth
         * ratcheting is not the SIZE of the closet but that nothing gets into it half-written:
         * `closetFault` is the door, and a row that cannot answer it must be REFUSED rather than
         * silently subtracted. Asserted over whatever the list holds, so it survives the next row. */
        {
          const shipped = DECLARED_DIVERGENCE.filter((d) => d.kind === 'CLOSETED');
          const faults = shipped.map((d) => closetFault(d)).filter(Boolean);
          ok('every CLOSETED row on the SHIPPING list carries its owner, its date, its ruling, its '
            + 'authority, its measured evidence and its falsifier — ' + shipped.length + ' row(s), '
            + 'checked by the same `closetFault` the door uses, not by a second copy of the schema',
            faults.length === 0, faults);
        }
      }

      /* -- ONE DECLARED LIST, TWO CLAUSES — 2026-08-26 -------------------------------------------
       *
       * THE BUG THIS RATCHETS. `DECLARED_DIVERGENCE` had one reader. The whole-game clause subtracted
       * the Supreme Overlord `fallenundefined` row and `classifyMechanics` counted the same
       * declaration as a defect on the same run, off a cause string in the SAME grammar. One
       * declaration, two verdicts, and nothing printed the disagreement.
       *
       * SO WHAT IS ASSERTED IS NOT "SUPREME OVERLORD IS EXEMPT" — a gate built from an instance
       * catches that instance and not the class. It is that a declaration NOBODY HAS WRITTEN YET is
       * honoured by BOTH clauses and by neither when it is withdrawn. Driven by pushing a synthetic
       * row and popping it, through the two shipping functions the gate decides on.
       *
       * THE INSTRUMENT IS CHECKED BEFORE IT IS BELIEVED. The first assertion runs with NO declaration
       * pushed and requires BOTH synthetic mechanics to COUNT. A probe that reads "0 counted" because
       * its fixture never staged anything would pass every assertion below it while measuring
       * nothing, which is this repository's most expensive failure shape. */
      const MECHCAUSE = 'event missing from medicham2 :: |-end|p1a|synthdeclared <> |upkeep';
      const NEARMISS  = 'event missing from medicham2 :: |-end|p1a|synthundeclared <> |upkeep';
      const MECH = (cause, near) => ({ rows: { moves: [
        { id: 'declaredmech', diverged: true, divergence: { cause, showdown: '|-end|p1a|x', medicham: '|upkeep' } },
        { id: 'nearmissmech', diverged: true, divergence: { cause: near, showdown: '|-end|p1a|y', medicham: '|upkeep' } },
      ] } });
      const MECHU = { ...UIDX, moves: new Map([['declaredmech', 9999], ['nearmissmech', 9999]]) };
      const mech = () => classifyMechanics(MECH(MECHCAUSE, NEARMISS), null,
        { U: MECHU, DI: decisionImpact('nothing-on-disk') });

      const blank = mech();
      ok('INSTRUMENT CHECK — with NOTHING declared, BOTH synthetic mechanics COUNT. A probe that '
        + 'reads zero because its fixture staged nothing would pass every assertion below it',
        blank.counted.length === 2 && blank.declared.length === 0,
        { counted: blank.counted.map((r) => r.id), declared: blank.declared.map((r) => r.id) });

      const wgBefore = MATCHER_THREW.length;
      DECLARED_DIVERGENCE.push({ kind: 'AUTHORITY-WRONG', name: 'a synthetic authority typo',
        match: (c) => /synthdeclared/.test(c), why: 'selftest only — never shipped' });
      try {
        const m = mech();
        ok('ONE DOOR — a declaration written TODAY is honoured by the MECHANICS clause, which read '
          + 'the list not at all until 2026-08-26',
          m.declared.length === 1 && m.declared[0].id === 'declaredmech'
          && m.declared[0].kind_declared === 'AUTHORITY-WRONG' && m.counted.length === 1,
          { declared: m.declared.map((r) => r.id), counted: m.counted.map((r) => r.id) });
        ok('RED — and the NEAR MISS still counts: the matching rule is the declaration, not the '
          + 'shape of the cause around it',
          m.counted.length === 1 && m.counted[0].id === 'nearmissmech');
        ok('the mechanics clause loses NO row when it subtracts one — declared + counted + shelved + '
          + 'unknown + cleared still equals every diverging row it saw',
          m.declared.length + m.counted.length + m.belowShelf.length + m.unknown.length
            + m.excused.length === m.rowsSeen, m.rowsSeen);
        /* THE SAME PUSH, THE OTHER CLAUSE, THE SAME CAUSE STRING. This is the invariant the whole
         * change exists for: neither clause knows what is in the list, so neither can be the only
         * one that honours it. */
        const w = dec(MECHCAUSE, [{ showdown: '|-end|p1a|x', medicham: '|upkeep' }]);
        ok('ONE DOOR — the SAME declaration, on the SAME cause string, is honoured by the WHOLE-GAME '
          + 'clause too, so a row added tomorrow cannot be seen by one clause and not the other',
          w.declared === 1 && w.declared_by_kind['AUTHORITY-WRONG'] === 1 && w.undeclared === 0);
      } finally { DECLARED_DIVERGENCE.pop(); MATCHER_THREW.length = wgBefore; }

      const after = mech();
      ok('RED — WITHDRAW the declaration and BOTH mechanics count again: the exemption lives in the '
        + 'list, never in the clause',
        after.counted.length === 2 && after.declared.length === 0
        && dec(MECHCAUSE, [{ showdown: '|-end|p1a|x', medicham: '|upkeep' }]).undeclared === 1);

      /* THE DEFERRED GUARD REACHES THE MECHANICS CLAUSE TOO, AND THAT IS THE HALF MOST LIKELY TO BE
       * SKIPPED. Sharing a door is only safe if the whitelist came through it: a `kind: DEFERRED` row
       * asserts a defect EXISTS, and subtracting it here would open the clause on the strength of a
       * label. It must hold the clause shut AND be named. */
      DECLARED_DIVERGENCE.push({ kind: 'DEFERRED', name: 'a deferred mechanic',
        match: (c) => /synthdeclared/.test(c), why: 'we know this is wrong and have not fixed it' });
      try {
        const m = mech();
        ok('RED — a `kind: DEFERRED` row does NOT open the MECHANICS clause either: a defect we chose '
          + 'to skip is not the same as no defect',
          m.declared.length === 0 && m.counted.length === 2);
        ok('...and the mechanics clause NAMES it, in its OWN throw list rather than the whole-game '
          + "clause's — a shared accumulator would print one clause's failures under the other's",
          m.declaredThrew.length === 1 && /DEFERRED/.test(m.declaredThrew[0].error)
          && MATCHER_THREW.length === wgBefore, m.declaredThrew);
      } finally { DECLARED_DIVERGENCE.pop(); }

      /* A MATCHER THAT THROWS MUST INFLATE THE MECHANICS COUNT AND SAY SO — ROADMAP #258, carried
       * across the door rather than left behind it. */
      DECLARED_DIVERGENCE.push({ kind: 'AUTHORITY-WRONG', name: 'a matcher that throws',
        match: () => { throw new Error('deliberate selftest throw'); }, why: 'selftest only' });
      try {
        const m = mech();
        ok('RED — a matcher that THROWS leaves every mechanic UNDECLARED and is NAMED beside the '
          + 'count it inflates, never swallowed',
          m.counted.length === 2 && m.declared.length === 0 && m.declaredThrew.length === 2
          && /deliberate selftest throw/.test(m.declaredThrew[0].error), m.declaredThrew);
      } finally { DECLARED_DIVERGENCE.pop(); }
    }

    /* -- membership, on a synthetic source tree ------------------------------------------------ */
    const src = {
      'engine/medicham2-browser.js': 'module.exports={battle}',
      'engine/board.js': "const M=require('./medicham2-browser.js');",
      'engine/rollout_leaf.js': "const B=require('./board.js');",
      'engine/consumer.js': "const L=require('./rollout_leaf.js'); fs.writeFileSync('data/consumer.json',x)",
      'engine/instrument.js': "const R=require('./board.js'); // drives both engines",
      'engine/dumper.js': "const L=require('./rollout_leaf.js'); fs.writeFileSync('rows.jsonl',x)",
      'engine/reader.js': "JSON.parse(fs.readFileSync('rows.jsonl'))",
      'engine/store_only.js': "const Q=require('./quality.js');",
      /* A NAME IN A COMMENT IS NOT A REQUIRE — the fault provenance.js records twice. */
      'engine/prose.js': "/* this one day may require('./board.js') */ const x=1;",
    };
    const play = playLayer(src);
    ok('the play layer reaches board.js from the simulator', play.has('engine/board.js'));
    ok('the play layer reaches rollout_leaf.js transitively', play.has('engine/rollout_leaf.js'));
    ok('a store-only generator is NOT in the play layer', !play.has('engine/store_only.js'));
    ok('a require inside a COMMENT does not taint', !play.has('engine/prose.js'));
    ok('a play-layer row dump is detected', playProducts(src, play).has('rows.jsonl'));

    const g = [
      { file: 'consumer.json', by: 'engine/consumer.js', from: [] },
      { file: 'instrument.json', by: 'engine/instrument.js', from: [] },
      { file: 'reader.json', by: 'engine/reader.js', from: ['rows.jsonl'] },
      { file: 'downstream.json', by: 'engine/store_only.js', from: ['consumer.json'] },
      { file: 'clean.json', by: 'engine/store_only.js', from: [] },
    ];
    const c = classify({ src, play, graph: g,
      exemptions: [{ module: 'engine/instrument.js', why: 'it drives both engines' }] });
    const q = f => c.rows.get(f).quarantined;
    ok('a play-layer generator is QUARANTINED', q('consumer.json'));
    ok('a DECLARED instrument is not', !q('instrument.json'));
    ok('a generator reading a play-layer row dump is QUARANTINED', q('reader.json'));
    ok('an artifact reading a quarantined artifact is QUARANTINED (transitive)', q('downstream.json'));
    ok('a store-only artifact is NOT quarantined', !q('clean.json'));
    ok('an exemption naming a module outside the play layer is reported STALE',
      classify({ src, play, graph: g, exemptions: [{ module: 'engine/nope.js', why: 'x' }] })
        .staleExemptions.length === 1);

    /* -- WITHHOLDING, both directions, THROUGH THE REAL FUNCTION -------------------------------
     * The first draft of this block wrote its own two-line withhold() and asserted against that,
     * which proves the test can implement a quarantine and says nothing about the one that ships.
     * `withholder` is the function `state()` hands to status.js; only the GATE differs between the
     * two cases below, which is exactly the variable under test. */
    const CLOSED = { ok: false, clauses: [{}, {}], failing: [{ name: 'game differential' }] };
    const OPEN = { ok: true, clauses: [{}, {}], failing: [] };
    const wClosed = withholder(CLOSED, c.rows), wOpen = withholder(OPEN, c.rows);
    ok('RED — with the gate closed, a quarantined figure is withheld', !!wClosed('data/consumer.json'));
    ok('the withheld line carries the reason and what re-runs it',
      !!(wClosed('data/consumer.json').because && wClosed('data/consumer.json').rerun), wClosed('data/consumer.json'));
    ok('a NON-quarantined figure is never withheld', !wClosed('data/clean.json'));
    /* THE NEGATIVE, AND IT MATTERS AS MUCH AS THE POSITIVE. A quarantine that can never lift is as
     * broken as one that never engages: the same artifact, the same classification, gate open. */
    ok('LIFT — with the gate open, the same figure is released', !wOpen('data/consumer.json'));
    ok('LIFT — with the gate open, NOTHING is withheld',
      [...wOpen.set].every(f => !wOpen('data/' + f)));

    console.log(`\nQUARANTINE SELFTEST: ${ran - bad} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }

  const S = state();

  if (has('--graph')) {
    console.log('QUARANTINE DERIVATION — nothing here is typed; the root is ' + SIMULATOR + '\n');
    console.log(`  play layer: ${S.play.size} modules reach the simulator through require`);
    for (const e of MEASURES_THE_ENGINE) console.log(`  DECLARED INSTRUMENT: ${e.module}\n    ${e.why.replace(/\s+/g, ' ')}`);
    console.log('');
    if (S.error) { console.log('  GRAPH UNAVAILABLE: ' + S.error); process.exit(1); }
    const pad = (s, n) => String(s).padEnd(n);
    console.log('  ' + pad('artifact', 34) + pad('', 6) + 'why');
    console.log('  ' + '-'.repeat(110));
    for (const r of [...S.rows.values()].sort((a, b) => a.file.localeCompare(b.file))) {
      console.log('  ' + pad(r.file, 34) + pad(r.quarantined ? 'HELD' : 'ok', 6) +
        (r.quarantined ? r.reason : (r.exempt ? 'DECLARED INSTRUMENT' : 'not downstream of the simulator')));
    }
    process.exit(0);
  }

  console.log('');
  console.log('QUARANTINE — everything downstream of MEDICHAM is withheld until MEDICHAM is correct');
  console.log('');
  const GATING = S.gate.clauses.filter(c => c.gates !== false);
  console.log(`  GATE: ${S.ok ? 'OPEN — MEDICHAM passes both conditions; nothing is withheld'
                              : 'CLOSED — ' + (S.gate.gate_failing || S.gate.failing).length + ' of '
                                + GATING.length + ' GATING clauses fail'}`);
  /* A REPORTING CLAUSE IS LABELLED `RPRT`, NEVER `FAIL`, AND NEVER `PASS` EITHER. Printing it as
   * FAIL beside an OPEN gate is the contradictory-sentences bug this printer already shipped once;
   * printing it as PASS while it is red is worse — it would be the caption-on-a-figure failure with
   * the caption removed. A third word is the only honest option, and every reporting row carries its
   * own red/green inside its verdict text. */
  for (const c of S.gate.clauses) {
    const tag = c.gates === false ? 'RPRT' : (c.ok ? 'PASS' : 'FAIL');
    console.log(`    ${tag}  ${pad2(c.name, 30)} ${c.why.replace(/\s+/g, ' ')}`);
  }
  if ((S.gate.reporting || []).length) {
    console.log('');
    console.log('  RPRT = REPORTS, DOES NOT GATE. Will, 2026-08-22: board-material now, narration as');
    console.log('  its own separate gate afterwards. These rows are computed and printed on every run');
    console.log('  and exit non-zero through their own command; they do not decide the line above.');
    for (const c of S.gate.reporting) {
      console.log('    ' + pad2(c.name, 62) + ' ' + (c.ok ? 'GREEN' : 'RED') + '  — quantity `'
        + (c.quantity || 'UNNAMED — a reporting row that does not name its quantity is a number '
           + 'nobody can reconcile') + '`');
    }
  }
  if (S.staleExemptions.length) {
    console.log('');
    console.log('  STALE EXEMPTION — a declared instrument that is no longer in the play layer:');
    for (const m of S.staleExemptions) console.log('    ' + m);
  }

  /* THE CLOSET — things IN the regulation that somebody deliberately shelved.
   *
   * Will, 2026-08-11: *"Can we remove all the irrelevant numbers then and just have a quarantined
   * closet section."* The out-of-scope counts are gone from the clause lines above, because an
   * entity no legal body can carry is not untested coverage — it is not in this game.
   *
   * What IS worth a section is the opposite: entities that ARE legal, that COULD be tested, and that
   * a human chose to defer. That is a decision with an owner and it should be visible rather than
   * folded into a parenthetical, because a deferral nobody re-reads is how a shelf becomes permanent.
   * Every row here is staged and printed by its own instrument; none of them is being hidden. */
  const closet = [];
  for (const c of S.gate.clauses) {
    if (c.deferred) closet.push(`    ${pad2(c.stage || c.name, 12)} ${c.deferred} deferred by the owner`);
  }
  if (closet.length) {
    console.log('');
    console.log('  THE CLOSET — legal in this regulation, testable, and deliberately shelved:');
    for (const l of closet) console.log(l);
    console.log('    ' + pad2('illusion', 12) + 'ROADMAP #160 — Zoroark, 384 games excluded from the fit corpus; ILLUSION_IN=1 re-admits');
    console.log('    ' + pad2('stall', 12) + 'ROADMAP #195 — zero corpus uses, one carrier; reopens if a Sableye ever appears');
    /* ~~ROADMAP #213 — tangledfeet, closeted on Will's call.~~ **OFF THE SHELF, ROADMAP #217, AND THE
     * REASON IT WAS SHELVED WAS NEVER TRUE.**
     *
     * The closet entry said its condition "cannot be ENTERED" because this engine has no confusion
     * volatile. That came from an `off:` string in `medicham2-browser.js`'s ACCMOD table which was
     * accurate when written and had been overtaken: `applyConfusion` writes `_vol.confusion` with the
     * self-hit roll, the expiry and every refusal, and the rate runner already carries targets for it.
     * The closet is for a DECISION WITH AN OWNER, and this row was never a decision — it was a stale
     * sentence quoted as a measurement, which is the failure this whole file exists to make visible.
     * Wired and probed in #217 (`ability/accuracyMod`, a 2x2 where three cells must agree). Left here
     * as a comment rather than deleted, because a closet that silently loses rows teaches nobody. */
    console.log('    Nothing here is a coverage gap. Each is a choice, and each names the way back.');
  }
  console.log('');
  if (S.error) {
    console.log('  THE ARTIFACT GRAPH COULD NOT BE READ: ' + S.error);
    console.log('  Nothing can be classified, so nothing is cleared. Fix engine/provenance.js first.');
    process.exitCode = 1;
  } else {
    const held = [...S.rows.values()].filter(r => r.quarantined).sort((a, b) => a.file.localeCompare(b.file));
    /* THE HEADING FOLLOWS THE GATE, AND UNTIL 2026-08-11 IT DID NOT — because until 2026-08-11 the
     * gate had never been open, so nobody had read this page in that state. It printed
     * `GATE: OPEN — nothing is withheld` and then, four lines down, `47 artifacts … are WITHHELD`.
     * Two contradictory statements about the same 47 files, and a reader would have been entitled to
     * believe either.
     *
     * `withholder()` is the authority on the WITHHOLDING and it is right in both states (its selftest
     * asserts the lift explicitly). This list is the DOWNSTREAM SET, which does not change when the
     * gate opens; what changes is what it means. Open, these numbers are not false and not withheld —
     * they are STALE, measured under an engine that has since been corrected, and ROADMAP #57 is the
     * re-run list. Saying so is the whole difference between "you may quote this" and "you may quote
     * this once you have re-run it". */
    console.log(S.gate.ok
      ? `  ${held.length} of ${S.rows.size} artifacts are downstream of MEDICHAM and are now RE-RUNNABLE.`
        + ` They are NOT withheld and they are NOT current — every one was measured under an engine`
        + ` that has since changed, so each must be re-run before it is quoted (ROADMAP #57):`
      : `  ${held.length} of ${S.rows.size} artifacts are downstream of MEDICHAM and are WITHHELD:`);
    for (const r of held) console.log('    data/' + pad2(r.file, 34) + ' re-run: node ' + r.by);
    console.log('');
    console.log('  Re-running is not optional once the gate opens. A quarantined number does not become');
    console.log('  true when MEDICHAM becomes correct; it becomes re-runnable. ROADMAP #57.');
    /* THE REASON IS READ, NOT RECITED. This block used to carry one typed sentence — "provenance.js
     * finds a writer only in engine/ and build/" — as the explanation for all twenty files. That was
     * true until 2026-08-09 and false afterwards, and it applied to none of the twenty by the time
     * anybody acted on it: the scan reads tests/ now, and these files are unknown for five different
     * reasons, one of which is that they are CONFIG and correctly have no generator at all. Each row
     * carries its own derived reason and this prints that. */
    if (S.unclassified.length) {
      const whyOf = new Map((S.unknownRows || []).map(r => [r.file, r.why]));
      console.log('');
      console.log(`  ${S.unclassified.length} artifact(s) on disk have NO DISCOVERABLE WRITER and are neither`);
      console.log('  cleared nor withheld. The set holds instruments AND consumers, so it cannot be');
      console.log('  defaulted either way. Reasons are derived per file by engine/provenance.js:');
      for (const f of S.unclassified) {
        console.log('    ' + f);
        const w = whyOf.get(f) || 'NO REASON RECORDED — engine/provenance.js did not examine this file at all.';
        let cur = '';
        for (const word of String(w).split(/\s+/)) {
          if ((cur + ' ' + word).trim().length > 92) { console.log('        ' + cur.trim()); cur = word; }
          else cur += ' ' + word;
        }
        if (cur.trim()) console.log('        ' + cur.trim());
      }
    }
  }
  console.log('');

  /* ---- THE GATE ---------------------------------------------------------------------------------
   * Fails when a quarantined FIGURE is being printed. The check is on `status.js`, because that is the
   * one command every session is required to run first and therefore the one place a withheld number
   * would be read from. It re-runs status.js and asserts two things at once: the withheld artifact's
   * own verdict string does not appear, and the word QUARANTINED does.
   *
   * IT DOES NOT GATE ON docs/ OR web/. Those are other divisions' files — WEB may not author a number
   * and MEASURE may not edit web/ — so failing on them would leave a gate that cannot be satisfied by
   * the division that owns it, which CLAUDE.md names as how a red check becomes "one of the known
   * failures". They are REPORTED instead, in full, every run. */
  if (has('--check')) {
    let fail = 0;
    /* THE CLASSIFIER IS PROVED BEFORE THE TREE IS JUDGED. --check asks whether a real leak exists; if
     * the classifier underneath it is broken, "no leak" is the answer it returns either way. Running
     * the selftest here rather than registering the file twice in tests/run-all.js keeps one entry and
     * makes the dependency explicit: a red selftest is a red gate. */
    try {
      execFileSync(process.execPath, [__filename, '--selftest'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      console.log('QUARANTINE CHECK: the selftest is RED, so this gate cannot be believed:');
      console.log(String((e && e.stdout) || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
      fail++;
    }
    if (S.staleExemptions.length) {
      console.log('QUARANTINE CHECK: a declared instrument exemption names a module that is not in the');
      console.log('play layer. The claim has quietly become false — remove it or find out why.');
      fail++;
    }
    if (S.error) { console.log('QUARANTINE CHECK: the artifact graph could not be read — ' + S.error); fail++; }

    if (!S.ok && !S.error) {
      let out = '';
      try {
        out = execFileSync(process.execPath, [D('engine', 'status.js')],
          { encoding: 'utf8', maxBuffer: 1 << 26 });
      } catch (e) { SWALLOWED.push('run engine/status.js to scan its output' + ': ' + why(e)); out = (e && (e.stdout || '')) || ''; }
      if (!out) {
        console.log('QUARANTINE CHECK: engine/status.js produced no output, so nothing could be checked.');
        fail++;
      } else {
        /* A VERDICT STRING IS THE FIGURE. Every quarantined artifact that carries one carries its whole
         * headline in it — "MILTANK takes 55.5% of 535 DECISIVE PAIRS", "is WORSE than a coin on Brier
         * (paired +0.0502...)". If that sentence is on the screen, the number was not withheld. This is
         * a stronger test than looking for a bare number: it is the exact text a reader would quote. */
        const leaked = [];
        for (const r of S.rows.values()) {
          if (!r.quarantined) continue;
          const j = readJson(D('data', r.file));
          if (!j) continue;
          for (const k of ['verdict', 'headline', 'summary']) {
            const v = j[k];
            if (typeof v !== 'string' || v.length < 24) continue;
            const probe = v.slice(0, 60);
            if (out.includes(probe)) leaked.push(`data/${r.file} (${k}): ${probe}...`);
          }
        }
        if (leaked.length) {
          console.log('QUARANTINE CHECK FAILED — engine/status.js is printing a QUARANTINED figure:');
          for (const l of leaked) console.log('  ' + l);
          console.log('  A caption is not a quarantine. Withhold the number; print what would re-run it.');
          fail++;
        }
        if (!/QUARANTINED/.test(out)) {
          console.log('QUARANTINE CHECK FAILED — the gate is CLOSED and engine/status.js never says');
          console.log('  QUARANTINED. Either the withholding is not wired, or it silently did nothing.');
          fail++;
        }
      }
    }

    /* ---- WHERE A WITHHELD NUMBER IS STILL CITED — reported, ratcheted, never edited from here ---- */
    const cites = citations(S);
    const stampPath = D('data', 'quarantine-stamp.json');
    const prev = readJson(stampPath);
    const nowList = cites.map(c => c.where).sort();
    const prevList = prev && Array.isArray(prev.citation_sites) ? prev.citation_sites : null;
    const added = prevList ? nowList.filter(f => !prevList.includes(f)) : [];
    if (cites.length) {
      console.log(`  ${cites.length} file(s) outside engine/ still quote a QUARANTINED artifact's verdict:`);
      for (const c of cites) console.log(`    ${c.where}  <- data/${c.file}`);
      console.log('  These are not edited from here — docs/ and web/ belong to other divisions, and a');
      console.log('  gate its owner cannot satisfy becomes a "known failure". RATCHETED instead.');
    }
    if (prevList && added.length) {
      console.log('');
      console.log(`  CITATION RATCHET BROKEN: ${added.length} NEW place(s) quote a withheld number —`);
      for (const f of added) console.log('    ' + f);
      console.log('  This list may shrink and may never grow while the gate is closed.');
      fail++;
    }
    try {
      fs.writeFileSync(stampPath, JSON.stringify({
        note: 'RATCHET. citation_sites may SHRINK and may never grow while the MEDICHAM quarantine is '
            + 'closed. A new entry means a withheld figure was just published somewhere.',
        /* STAMPED, BECAUSE AN UNSTAMPED NEW ARTIFACT BREAKS provenance.js's OWN RATCHET — and it did,
         * on the first run of this file: `RATCHET BROKEN: 1 artifact newly rests on mtime alone —
         * quarantine-stamp.json`. That ratchet may shrink and may never grow, and a gate that adds a
         * red row while installing itself is the "known failure" pattern arriving with the guard.
         * The two files whose CONTENT decides everything in here are the classifier and the graph it
         * reads; run_stamp owns the digest format so there is not a second one. */
        source_digests: (() => {
          try { return require('./run_stamp.js').sourceDigests(['engine/quarantine.js', 'engine/provenance.js']); }
          catch (e) { return SWALLOWED.push('stamp source digests' + ': ' + why(e)); }
        })(),
        not_store_derived: 'it records which artifacts are downstream of the simulator and where they '
            + 'are still cited. No game is counted anywhere in it, so the quality filter has no bearing.',
        gate_open: S.ok,
        failing_clauses: S.gate.failing.map(c => c.name),
        quarantined: [...S.set].sort(),
        citation_sites: nowList,
        generated: new Date().toISOString(),
      }, null, 2) + '\n');
    } catch (e) { console.log('  (could not write data/quarantine-stamp.json: ' + e.message + ')'); }

    console.log('');
    /* THE TALLY OF SWALLOWED READS, PRINTED EVERY RUN. A gate that could not read the thing it
     * polices must not report clean in silence — that is the failure this whole file exists to stop,
     * turned inward. Each entry names the read and the error, so "clean" always means "clean, and
     * here is everything I could not open" rather than "clean, as far as I got". */
    if (SWALLOWED.length) {
      console.log(`  ${SWALLOWED.length} read(s) this gate is allowed to miss DID miss — it is reporting on less than the whole tree:`);
      for (const w of SWALLOWED) console.log('    ' + w);
    }
    console.log(`QUARANTINE CHECK: ${fail ? fail + ' failure(s)' : 'clean — no withheld figure is being printed'}`
      + (SWALLOWED.length ? ` (${SWALLOWED.length} read(s) swallowed, listed above)` : ''));
    process.exit(fail ? 1 : 0);
  }
}

function pad2(s, n) { return String(s).padEnd(n); }

/* Where a quarantined artifact's headline sentence still appears outside engine/. Reported so the
 * list of places already citing a number they should not is a MEASUREMENT rather than a memory. */
function citations(S) {
  const out = [];
  if (!S.rows) return out;
  const probes = [];
  for (const r of S.rows.values()) {
    if (!r.quarantined) continue;
    const j = readJson(D('data', r.file));
    if (!j) continue;
    for (const k of ['verdict', 'headline', 'summary']) {
      const v = j[k];
      if (typeof v === 'string' && v.length >= 30) probes.push({ file: r.file, probe: v.slice(0, 50) });
    }
  }
  if (!probes.length) return out;
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let list = []; try { list = fs.readdirSync(D(dir), { withFileTypes: true }); } catch (e) { SWALLOWED.push('walk ' + dir + ' for citations' + ': ' + why(e)); return; }
    for (const e of list) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (!/^(node_modules|\.git|releases|_inbox)$/.test(e.name)) walk(rel, depth + 1); continue; }
      if (!/\.(md|html|js)$/.test(e.name)) continue;
      let s = ''; try { s = fs.readFileSync(D(rel), 'utf8'); } catch (e2) { SWALLOWED.push('read ' + rel + ' for citations' + ': ' + why(e2)); continue; }
      for (const p of probes) if (s.includes(p.probe)) out.push({ where: rel, file: p.file });
    }
  };
  /* `app/` IS THE DEPLOYED MIRROR AND IT WAS A BLIND SPOT IN THIS CHECKER. `tests/test-site-sync.js`
   * asserts every page under web/ is byte-identical to its app/ twin, so app/ is the copy a visitor
   * actually loads — and this walker looked at docs/ and web/ only. On 2026-08-08 that meant WEB
   * closed all five leaks in `web/status-data.js`, this check went green, and `app/status-data.js`
   * went on quoting the same five withheld verdicts to anyone opening the site. A checker whose
   * blind spot is exactly the published copy is worse than none: it certifies the leak.
   * Walked LAST so the web/ row is reported first when both carry it, which is the one to fix. */
  walk('docs', 0); walk('web', 0); walk('app', 0);
  return out;
}
