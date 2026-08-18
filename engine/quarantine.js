/* quarantine.js — EVERYTHING DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS CORRECT.
 *
 *   node engine/quarantine.js            print the gate, the failing clauses and the withheld set
 *   node engine/quarantine.js --graph    print the derivation: why each artifact is in or out
 *   node engine/quarantine.js --check    GATE — fails if a quarantined figure is being printed
 *   node engine/quarantine.js --selftest drive every branch on synthetic input, red and green
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
     * helper is also pointed at `.js` BUNDLES (data/mag.js, data/mew.js, web/scoreboard.js) to ask
     * cheaply whether they happen to be JSON; those never parse, by design, and reporting them
     * printed six lines of pure noise on a clean run. A ratchet that flags code for doing what it
     * asked is how a ratchet gets ignored — the fourth correction of that shape in this repository. */
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
function rosterStage(stage) {
  const tried = [];
  for (const f of [`roster.${stage}.json`, 'roster.all.json', 'roster.json']) {
    tried.push('data/' + f);
    const j = readJson(D('data', f));
    if (!j) continue;
    /* AN `all` ARTIFACT SATISFIES THE THREE STAGES THE RULE NAMES, AND NOTHING ELSE. Accepting
     * `stage: 'all'` for ANY requested name made this function answer for a stage that does not
     * exist — so the selftest's own "a MISSING stage must FAIL" probe started matching
     * data/roster.all.json the moment that file first landed, and went red. The probe was right and
     * the reader was wrong: `all` is a claim about items, abilities and moves, not a wildcard. This
     * is the one case the whole file turns on, so it is scoped to ROSTER_STAGES explicitly rather
     * than to "any truthy stage name". */
    if (j.stage !== stage && !(j.stage === 'all' && ROSTER_STAGES.includes(stage))) continue;
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
    why: `NO ARTIFACT FOR THIS STAGE — none of ${tried.join(', ')} declares stage "${stage}". `
       + `A missing stage is a FAILING clause, never a passing one: run `
       + `SHOWDOWN_PATH=... node tests/roster.js --stage ${stage} --write`,
  };
}

/* `artifact` IS AN INJECTION POINT FOR THE SELFTEST AND NOTHING ELSE. The roster clause's selftest
 * reimplements its rule in three lines and therefore proves nothing about the rule that ships; this
 * one drives THE SHIPPING FUNCTION on synthetic artifacts. Absent, it reads the real file exactly as
 * before. */
function differentialClause(artifact) {
  const j = artifact === undefined ? readJson(D('data', 'engine-diff.json')) : artifact;
  if (!j) {
    return { name: 'game differential', ok: false, missing: true,
             why: 'NO ARTIFACT — data/engine-diff.json is absent. Run tests/test-engine-diff.js.' };
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
  if (j.plant) {
    return { name: 'game differential', ok: false, generated: j.generated || null,
      why: `THIS ARTIFACT IS A PLANTED RED DEMONSTRATION (--plant ${j.plant.kind}) and is not a `
         + 'measurement. Re-run tests/test-engine-diff.js without --plant.' };
  }
  const arms = Array.isArray(j.arms) ? j.arms : null;
  if (!arms || !arms.length) {
    return { name: 'game differential', ok: false, generated: j.generated || null,
      why: 'THE CORNER ARMS ARE ABSENT from data/engine-diff.json. `disagreed` is a MIDPOINT residual '
         + 'and cannot see a range wrong by the same amount at both ends, so it is not a sufficient '
         + 'claim on its own. Re-run: SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000 '
         + '--seed 20260804' };
  }
  const badArms = arms.filter(a => (a.disagreed || 0) > 0);
  const ok = dis === 0 && badArms.length === 0;
  const armTxt = arms.map(a => `${a.arm} ${a.disagreed || 0}/${a.compared}`).join(', ');
  return {
    name: 'game differential', ok, generated: j.generated || null,
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
  const counted = [], belowShelf = [], unknown = [], excused = [];
  let rowsSeen = 0; const rowsMissing = [];
  for (const kind of ['moves', 'abilities', 'items']) {
    const list = Array.isArray(j && j.rows && j.rows[kind]) ? j.rows[kind] : null;
    if (!list) { rowsMissing.push(kind); continue; }
    for (const r of list) {
      if (!r || !r.diverged || r.deferred) continue;   /* `deferred` is the owner's closet — #291 */
      rowsSeen++;
      const key = SINGULAR[kind] + ':' + nid(r.id);
      const reach = reachOf(U, kind, r.id);
      const row = { kind, id: r.id, key, reach, shelf: SH.of(kind) };
      if (!reach.known) { unknown.push(row); continue; }
      if (SH.below(kind, reach.n)) { belowShelf.push(row); continue; }
      const c = DI.clear(key);
      if (c) { excused.push({ ...row, impact: c }); continue; }
      counted.push(row);
    }
  }
  return { U, DI, SH, counted, belowShelf, unknown, excused, rowsSeen, rowsMissing };
}

function mechanicsClause() {
  const NAME = 'mechanics / each one staged and compared against showdown';
  const j = readJson(D('data', 'all-mechanics-fire.json'));
  if (!j) {
    return { name: NAME, ok: false, missing: true,
      why: 'NO ARTIFACT — data/all-mechanics-fire.json is absent. A clause that cannot be computed '
         + 'FAILS. Run: SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --kind all --write' };
  }
  const cur = readJson(D('data', 'engine-release.json'));
  const curId = cur && (cur.id || cur.release || cur.current);
  const ranOn = j.release || j.engine_release || null;
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

  if (ranOn && curId && ranOn !== curId) {
    return { name: NAME, ok: false, generated: j.generated || null, staleAgainst: curId, ranOn,
      why: `MEASURED AGAINST A DIFFERENT ENGINE — this artifact ran on release ${ranOn} and the tree `
         + `is ${curId}. That is not a weaker answer, it is an answer about other bytes. Re-run before `
         + `this clause can say anything.` + tail };
  }

  /* ---- THE DECISION-EQUIVALENCE BAR, APPLIED PER ENTITY ----------------------------------------
   * The count above is the artifact's own summary and it stays printed, because the two filters may
   * only ever SUBTRACT from a number a reader can still see. What decides the clause is the set of
   * diverging entities that somebody plays and that no paired run has cleared. */
  const C = classifyMechanics(j, curId);
  const { U, DI, counted, belowShelf, unknown, excused, rowsSeen, rowsMissing } = C;

  /* A DERIVED SET IS NOT A FACT UNTIL SOMETHING COMPARES IT TO ITS SOURCE. If the per-entity rows and
   * the artifact's own summary disagree about how many diverged, the filter is being applied to a
   * population that is not the one the headline describes — and the honest answer is to fail saying
   * so, never to publish whichever number is smaller. Absent rows are the same failure by omission:
   * an older artifact with a `summary` and no `rows` must not read as "nothing to filter". */
  if (rowsMissing.length || rowsSeen !== div) {
    return { name: NAME, ok: div === 0, generated: j.generated || null, diverged: div, unfired,
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

  return { name: NAME, ok: counted.length === 0, generated: j.generated || null,
    diverged: div, unfired, counted: counted.length, shelved: belowShelf.length,
    unknown_reach: unknown.length, decision_cleared: excused.length,
    why: (counted.length === 0
      ? `every mechanic anybody plays agrees with the authority: ${div} diverge, ${belowShelf.length} are `
        + `below the reach shelf and ${excused.length} were cleared on decision impact, leaving 0.`
      : `${counted.length} of ${div} DIVERGING MECHANICS ARE PLAYED AND UNCLEARED — each is a rule, not `
        + `a sampling artefact, since the teams are built from the mechanic list. Worst: `
        + show(counted.slice()).split(', ').slice(0, 6).join(', ')) + tail
      + reachLine + unknownLine + impactLine + driftLine };
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
function roadmapRowSaysBroken(l) {
  const cell = roadmapRowStatusCell(l);
  if (/\bNOT A DEFECT\b/i.test(cell)) {
    const n = (l.match(/^\|\s*#(\d+)/) || [, '?'])[1];
    if (!NOT_A_DEFECT.some(r => r.n === n)) NOT_A_DEFECT.push({ n, cell: cell.trim().slice(0, 90) });
    return false;
  }
  if (/\bDEFECT\b/.test(cell)) return true;
  /* THE HEAD, NOT THE ROW — see REPAIR 1 above. The 600 is `roadmapRowIsClosed`'s number, deliberately
   * the same one: two detectors reading the same table must not disagree about where a row's claim
   * stops and its history starts. */
  return /NEVER FIRED|NEVER FIRES|NOT IMPLEMENTED|DOES NOT WORK|DOES NOT ARM|DOES NOT FIRE|UNIMPLEMENTED|silent no-op|IS ABSENT|is not implemented|does not exist|never records|never record|resolve[sd]? to `\{kind:'pass'\}`|HAS NEVER FIRED|IS DEAD/i.test(l.slice(0, 600));
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
 * DIVERGENCES WHERE MATCHING THE AUTHORITY WOULD MAKE THIS ENGINE LESS CORRECT — WILL, 2026-08-18.
 * ==================================================================================================
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
 * matching the authority would make this engine WORSE. It does NOT belong here because the fix is
 * expensive, because nobody has got to it, or because it has been open a long time.
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
const DECLARED_DIVERGENCE = [
  {
    name: "Supreme Overlord `fallenundefined`",
    match: (c) => /fallenundefined/.test(c),
    why: "THE AUTHORITY IS WRONG AND THE LINE IS INVISIBLE. `data/abilities.ts` guards supremeoverlord's "
       + "onStart on `pokemon.side.totalFainted` and does NOT guard its onEnd, so when nothing has fainted "
       + "`effectState.fallen` is never set and the template emits the literal string `fallenundefined` on a "
       + "`[silent]` line players never see. The ABILITY is correct — onBasePower is guarded and the "
       + "multiplier table is right. Reproducing a typo is not correctness.",
  },
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
/* `wgDecisionImpact` IS THE SECOND INJECTION POINT AND IT EXISTS FOR THE SELFTEST ONLY, on the same
 * reasoning as `artifact` above and as `withholder`'s gate argument: a `--force` flag anybody can pass
 * on the command line eventually gets passed, and a parameter is visible in the caller where a flag is
 * not. Left undefined by every shipping caller, which is what makes the real reader the default. */
function wholeGameClause(artifact, wgDecisionImpact) {
  const NAME = 'whole-game differential / the same game on both engines';
  const j = artifact === undefined ? readJson(D('data', 'game-differential.json')) : artifact;
  if (!j) {
    return { name: NAME, ok: false, missing: true,
      why: 'NO ARTIFACT — data/game-differential.json is absent. A clause that cannot be computed '
         + 'FAILS. Run: SHOWDOWN_PATH=... node engine/game_differential.js --release <id> '
         + '--games 1200 --write' };
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
   * ============================================================================================ */
  {
    const cur = readJson(D('data', 'engine-release.json'));
    const curId = cur && (cur.id || cur.release || cur.current);
    const ranOn = j.engine_release || j.release || null;
    if (ranOn && curId && ranOn !== curId) {
      return { name: NAME, ok: false, cannot_answer: true, withheld: true,
        generated: j.generated || null, ranOn, staleAgainst: curId,
        why: `MEASURED AGAINST A DIFFERENT ENGINE — this artifact ran on release ${ranOn} and the tree `
           + `is ${curId}. That is not a weaker answer, it is an answer about other bytes. THE RATE, `
           + `THE DIVERGED COUNT, THE GAME COUNT AND THE CLASS COMPOSITION ARE ALL WITHHELD rather `
           + `than printed with a caveat — a figure beside a warning is what got the PRE-CHANGE `
           + `numbers quoted for days. Re-run before this clause can say anything: `
           + `SHOWDOWN_PATH=... node engine/game_differential.js --games 1200 --write` };
    }
  }
  const games = +j.games || 0, div = +j.diverged || 0;
  if (!games) {
    return { name: NAME, ok: false, generated: j.generated || null,
      why: 'THE ARTIFACT RECORDS ZERO GAMES, which is not the same as zero divergences.' };
  }
  /* A PLANTED PROOF THAT DID NOT FIRE INVALIDATES THE RUN. An instrument that cannot see a divergence
   * it planted itself cannot be believed about the ones it did not plant. */
  if (j.planted_divergence_proof_ok !== true) {
    return { name: NAME, ok: false, generated: j.generated || null,
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
    return { name: NAME, ok: false, generated: j.generated || null, rate,
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
  for (const c of (Array.isArray(j.classes) ? j.classes : [])) {
    for (const k of (c.causes || [])) {
      const d = DECLARED_DIVERGENCE.find((x) => { try { return x.match(String(k.cause || "")); } catch (e) { return false; } });
      if (d) {
        declaredGames += (k.n || 0);
        const row = declaredHits.find((r) => r.name === d.name);
        if (row) row.n += (k.n || 0); else declaredHits.push({ name: d.name, why: d.why, n: (k.n || 0) });
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
  const declaredLine = declaredHits.length
    ? _NL + "  DECLARED — matching the authority here would make this engine LESS correct, so these"
      + " do not count:" + _NL
      + declaredHits.map((r) => "    " + String(r.n).padStart(4) + "  " + r.name + _NL
          + "           " + r.why).join(_NL)
    : "";
  const impactLine = _NL + "  DECISION IMPACT — " + (impactHits.length
    ? impactGames + " game(s) across " + impactHits.length + " cause(s) cleared by a paired argmax run: "
      + impactHits.map((r) => r.key.slice(6) + " (0 flips in " + r.paired + ", 95% upper bound "
        + r.bound.toFixed(1) + "% — a floor, not a zero; fixed in " + r.fixed_in + ")").join("; ")
    : DI.why);
  const ok = undeclared === 0;

  return {
    name: NAME, ok, generated: j.generated || null, rate, baseline: base.rate,
    diverged: div, games,
    /* kept so a reader can see the trend without the trend being able to pass anything — and set to
     * null rather than guessed when the baseline was stamped under a different pin */
    progress: !comparable ? null
      : (rose ? 'WORSE than the baseline' : (rate < base.rate ? 'better than the baseline' : 'level')),
    regressed: comparable ? rose : null,
    baseline_mode: baseMode || null, run_mode: runMode || null, baseline_comparable: comparable,
    declared: declaredGames, decision_cleared: impactGames, undeclared,
    why: ok
      ? `ZERO divergences across ${games} games that anything is asked to answer for`
        + (declaredGames || impactGames ? ` (${div} raw, ${declaredGames} declared, ${impactGames}`
          + ` cleared on decision impact)` : '')
        + `. Mode A pins every die on both sides, so this is the real bar and it has been met.`
        + declaredLine + impactLine
      : `${undeclared} of ${games} = ${(100 * undeclared / games).toFixed(1)}% DIVERGE — the two engines`
        + ` disagree about ${undeclared} games`
        + (declaredGames || impactGames ? ` (${div} raw, less ${declaredGames} declared and`
          + ` ${impactGames} cleared on decision impact)` : '')
        + `. Mode A pins every die on both sides, so each one is a RULE they disagree about, not noise.`
        + ` This clause fails until that is zero.` + declaredLine + impactLine
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

function openDefectClause() {
  let lines;
  try { lines = fs.readFileSync(D('docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/); }
  catch (e) {
    /* ROADMAP #258 — the verdict was already loud; the REASON was not. "docs/ROADMAP.md is
     * unreadable" does not distinguish a missing file from a permission error from a torn write, and
     * the person reading this clause is the one who has to fix it. */
    return { name: 'no open, known engine defect', ok: false, missing: true,
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
  const withRed = [], debt = [], staleRows = [], unrunnable = [];
  for (const r of open) {
    const v = _byRow.get(String(r.n));
    if (!v || !v.cmd) { debt.push(r); continue; }
    /* `green` IS TRI-STATE AND `null` IS NOT GREEN. An instrument that would not start says nothing
     * about the row; calling that agreement is the "a capability was absent and everything reported
     * success" shape. It is named on its own line rather than folded into either column. */
    if (v.green === false) withRed.push(r);
    else if (v.green === true) staleRows.push(r);
    else unrunnable.push(r);
  }
  const wireLine = RR.why ? '  ' + RR.why : '';
  const unrunnableLine = unrunnable.length
    ? '  ' + unrunnable.length + ' open row(s) name an instrument that WOULD NOT RUN — that is not '
      + 'agreement and it is not evidence either: '
      + unrunnable.map(function (r) { return '#' + r.n; }).join(', ') + '.'
    : '';
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
  const receipt = `  ${excused.length} open row(s) declare NOT A DEFECT in their status cell and are `
    + `excused from this clause` + (excused.length
      ? ': ' + excused.map(r => '#' + r.n + ' [' + r.cell + ']').join('; ') : '.');
  return {
    name: 'no open, known engine defect', ok: withRed.length === 0, open, excused, withRed, debt,
    staleRows, unrunnable, verdicts_read: RR.rows.length, verdicts_generated: RR.generated || null,
    why: (withRed.length === 0
      ? 'clean: no open row names an instrument that is RED — no open defect is backed by a failing '
        + 'measurement (' + RR.rows.length + ' verdict(s) read)'
      : `${withRed.length} OPEN roadmap row(s) name an instrument that is RED: `
        + withRed.map(r => '#' + r.n + (r.uses ? ' (' + r.uses.toLocaleString() + ' uses)' : '')).join(', ')
        + `. A gate cannot report the engine correct while the register says otherwise — that is `
        + `"known failure" filed one level up.`)
      + receipt + wireLine + unrunnableLine + debtLine + staleLine,
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
  const cur = readJson(D('data', 'engine-release.json'));
  const curId = cur && (cur.id || cur.release || cur.current);
  const ranOn = j.engine_release || j.release || null;
  const bad = probe.filter((r) => r && r.speed_tied === false && r.same_priority === true);
  if (ranOn && curId && ranOn !== curId) {
    /* CANNOT ANSWER, AND IT SAYS WHICH KIND OF RED IT IS. The count is still PRINTED, because a
     * listing is not a verdict and being able to see what the last answerable run found is worth
     * having — but `cannot_answer` is what the exit code carries, and nobody may quote the number as a
     * statement about this tree. */
    return { name: NAME, ok: false, cannot_answer: true, ranOn, staleAgainst: curId,
      probed: probe.length, unequal: bad.length,
      why: `MEASURED AGAINST A DIFFERENT ENGINE — the probe ran on release ${ranOn} and the tree is `
         + `${curId}. That is not a weaker answer to this question, it is an answer about other bytes. `
         + `WITHHELD, not annotated: that run probed ${probe.length} pair(s) and ${bad.length} carried `
         + `the conjunction, and neither figure describes this tree. Re-run engine/game_differential.js.` };
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

function medichamIsCorrect() {
  const clauses = [differentialClause(), ...ROSTER_STAGES.map(s => {
    const r = rosterStage(s);
    return { ...r, name: `deliberate roster / ${s}` };
  }), coverageClause(), wholeGameClause(), mechanicsClause(), openDefectClause()];
  return { ok: clauses.every(c => c.ok), clauses, failing: clauses.filter(c => !c.ok) };
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
                   REGISTER_REALITY, registerRealityRows, orderProbeClause,
                   REACH_SHELF_CLICKS, DECISION_POINTS_FLOOR, reachShelf,
                   reachOf, usageIndex, reachDrift, decisionImpact, mechanicsClause,
                   classifyMechanics,
                   /* ROADMAP #292 — exported so a test can hand it a KNOWN artifact and read the
                    * composition it prints. Its `artifact` argument already existed; without the
                    * export the only way to check that the composition and the headline describe the
                    * SAME run was to read the source, which is how they came to describe two. */
                   wholeGameClause, clauseExit };

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
              + '   [0 the two engines agree on every game, 1 they do not, 2 cannot answer]');
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

    /* -- ROADMAP #88: THE DIFFERENTIAL CLAUSE, THROUGH THE SHIPPING FUNCTION -------------------
     * Every case below is a WHOLE artifact handed to `differentialClause` itself, so a change to the
     * rule cannot pass by having its selftest re-state the old one. The two RED cases are the point:
     * a clean midpoint with a dirty corner, and an artifact with no corners at all. */
    const armArt = (mid, top, bot) => ({ compared: 6000, seed: 20260804, disagreed: mid,
      arms: [{ arm: 'top', compared: 6000, disagreed: top, worst: [] },
             { arm: 'bottom', compared: 6000, disagreed: bot, worst: [] }] });
    ok('both corners clean and the midpoint clean PASSES', differentialClause(armArt(0, 0, 0)).ok === true);
    ok('RED — the midpoint is clean and the BOTTOM corner is not: the clause FAILS',
      differentialClause(armArt(0, 0, 7)).ok === false, differentialClause(armArt(0, 0, 7)).why);
    ok('RED — the midpoint is clean and the TOP corner is not: the clause FAILS',
      differentialClause(armArt(0, 3, 0)).ok === false);
    ok('RED — an artifact with NO corner arms FAILS rather than passing by absence',
      differentialClause({ compared: 6000, seed: 1, disagreed: 0 }).ok === false);
    ok('RED — a PLANTED artifact is refused even when every number in it is zero',
      differentialClause({ ...armArt(0, 0, 0), plant: { kind: 'spread', halfwidth: 12 } }).ok === false);
    ok('a dirty midpoint still fails, with both corners clean',
      differentialClause(armArt(5, 0, 0)).ok === false);
    ok('the passing reason NAMES both corners rather than one pooled number',
      /top 0\/6000/.test(differentialClause(armArt(0, 0, 0)).why)
      && /bottom 0\/6000/.test(differentialClause(armArt(0, 0, 0)).why),
      differentialClause(armArt(0, 0, 0)).why);

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
      { id: 'closeted', diverged: true, deferred: { by: 'Will' } }] } };
    const EDGEU = { ...UIDX, moves: new Map([['atexactly', REACH_SHELF_CLICKS], ['onebelow', REACH_SHELF_CLICKS - 1],
                                             ['closeted', 9999]]) };
    const EDGEC = classifyMechanics(EDGE, null, { U: EDGEU, DI: decisionImpact('nothing-on-disk') });
    ok('BOUNDARY — exactly at the shelf COUNTS, and one below it is shelved',
      EDGEC.counted.length === 1 && EDGEC.counted[0].id === 'atexactly'
      && EDGEC.belowShelf.length === 1 && EDGEC.belowShelf[0].id === 'onebelow',
      { counted: EDGEC.counted.map(r => r.id), belowShelf: EDGEC.belowShelf.map(r => r.id) });
    ok('a row the OWNER closeted is in neither column, however heavily it is played',
      EDGEC.rowsSeen === 2 && !EDGEC.counted.concat(EDGEC.belowShelf).some(r => r.id === 'closeted'));

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
    const PROBE = (rows, extra) => ({ games: 100, order_probe: rows, ...(extra || {}) });
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
      orderProbeClause({ games: 100 }).ok === false
      && /NO ORDER PROBE/.test(orderProbeClause({ games: 100 }).why));
    ok('RED — an EMPTY probe over ZERO games decides nothing and does not pass',
      orderProbeClause({ games: 0, order_probe: [] }).ok === false);
    ok('an empty probe over REAL games passes, and says it is clean BY ABSENCE rather than by proof',
      orderProbeClause({ games: 100, order_probe: [] }).ok === true
      && /clean by absence/.test(orderProbeClause({ games: 100, order_probe: [] }).why));
    /* THE RELEASE GUARD, WHICH IS THE ONE THAT FIRES TODAY. A probe cut against other bytes must fail,
     * must be distinguishable from the defect (`cannot_answer`), and must still PRINT its count —
     * withheld as a verdict, visible as a listing. */
    const OTHER = orderProbeClause(PROBE([PAIR(true, true)], { engine_release: 'not-this-tree' }));
    ok('RED — a probe measured against OTHER BYTES cannot answer, however clean it looks',
      OTHER.ok === false && OTHER.cannot_answer === true, OTHER.why);
    ok('the withheld run still reports what it found, so the figure is visible and unquotable',
      OTHER.probed === 1 && /WITHHELD, not annotated/.test(OTHER.why));


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
      const wgArt = { games: 100, diverged: 10, planted_divergence_proof_ok: true, mode: 'M',
        classes: [{ cls: 'drag', causes: [{ cause: 'drag: a different body :: x', n: 10 }] }] };
      diWrite(GOOD);
      /* the reader closes over the rows it read, so the file is no longer needed after this line */
      const wgDI = decisionImpact('REL');
      ok('WHOLE GAME — a cause cleared by a paired run does not hold the clause shut',
        wholeGameClause(wgArt, wgDI).ok === true, wholeGameClause(wgArt, wgDI).why);
      ok('RED — the SAME artifact with an inert decision-impact reader still FAILS',
        wholeGameClause(wgArt, decisionImpact('NOPE')).ok === false);
      ok('the whole-game clause prints what was cleared and never folds it into the verdict silently',
        /DECISION IMPACT/.test(wholeGameClause(wgArt, wgDI).why));
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
      const WG = (extra) => ({ games: 1230, diverged: 695, planted_divergence_proof_ok: true,
        mode: 'M', generated: 'then', classes: [], ...extra });
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
      const unstamped = wholeGameClause(WG({}), decisionImpact('NOPE'));
      ok('#298 — an UNSTAMPED artifact is allowed to answer, exactly as orderProbeClause allows one: '
        + 'the clause refuses a MISMATCH, not an absence',
        unstamped.withheld !== true && unstamped.games === 1230, unstamped.why);

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
  console.log(`  GATE: ${S.ok ? 'OPEN — MEDICHAM passes both conditions; nothing is withheld'
                              : 'CLOSED — ' + S.gate.failing.length + ' of ' + S.gate.clauses.length + ' clauses fail'}`);
  for (const c of S.gate.clauses) console.log(`    ${c.ok ? 'PASS' : 'FAIL'}  ${pad2(c.name, 30)} ${c.why.replace(/\s+/g, ' ')}`);
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
