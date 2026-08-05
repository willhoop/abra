/* miltank.js — MILTANK, the SEARCH player.  See docs/MILTANK.md.
 *
 * MAG (engine/magnemite.js) is a fitted linear policy trained to predict what a human CLICKS. It
 * imitates. MILTANK decides by PLAYING THE POSITION OUT and taking the line that wins most, so it
 * can prefer a move that appears nowhere in the corpus. Named for the classic Rollout user.
 *
 * WHY THIS FILE EXISTS AT ALL, WHICH IS THE POINT OF THE EXTRACTION
 * ----------------------------------------------------------------
 * MILTANK was born inside mag_bot.js, as ~550 lines of overrides installed on a websocket player.
 * That made it unreachable from anywhere else -- and specifically from engine/mew.js, which is the
 * ONLY harness that can run a controlled A/B. So R4, the SPRT that asks whether MILTANK actually
 * WINS MORE than MAG, was not merely unrun: it was unrunnable. Every claim about MILTANK to date is
 * about mechanism (R1 leaf accuracy, R2 cost, R3 divergence) and none is about winning.
 *
 * A player living in a socket handler cannot be measured. So it lives here, and both mag_bot.js and
 * the self-play harness install the same object.
 *
 * WHAT IT INSTALLS -- three decisions, all by the same method:
 *   chooseTeamPreview   which four to bring and which two to lead (90 brings, played out)
 *   chooseMove          both clicks, by successive halving over every legal pair
 *   chooseSwitch        the post-KO replacement, each candidate played out
 *
 * AND WHERE IT DEFERS. When the search cannot separate its options -- finalists inside one standard
 * error, or a position already decided -- it hands the turn back to MAG, because a fitted human
 * prior beats a coin flip over near-ties. Imitation is the floor; search is the ceiling.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const TAGSMOD = require('./tags.js');

/* ===========================================================================
 * THE CLOCK.  Read out of the Showdown source we actually play against, not assumed.
 *
 * `config/formats.ts` gives [Gen 9 Champions] VGC 2026 Reg M-B the ruleset `VGC Timer`, and
 * `data/rulesets.ts:778` is verbatim:
 *
 *     Timer Starting = 420   Timer Grace = 90   Timer Add Per Turn = 0
 *     Timer Max Per Turn = 55   Timer Max First Turn = 90
 *     Timeout Auto Choose    DC Timer Bank
 *
 * `server/room-battle.ts` says what those do, and TWO of the things this project believed about
 * them are wrong.  Both were found by reading the source rather than by watching a game, because
 * the timer HAS NEVER BEEN ON IN A GAME ANYONE HAS WATCHED (Will, 2026-08-04: "when i play the bot
 * i have turned the timer off").
 *
 *   1. THE BANK IS 420 s, NOT 510.  `:209` does start with `starting + grace` = 510 -- but
 *      `updateTurn` at `:305-306` runs `secondsLeft = Math.min(secondsLeft + addPerTurn, starting)`
 *      on every NEW TURN, and `starting` is 420.  So the 90 s of grace is CLAMPED AWAY on the second
 *      timed request.  It is use-it-or-lose-it on the FIRST timed request and is not bankable.
 *      Consequence: the shipped `budgetMs: 20000` buys 21 decisions, not the 24 SEARCH.md claimed.
 *
 *   2. THE BANK DOES NOT TICK WHILE THE TIMER IS OFF.  `secondsLeft` is decremented only in
 *      `nextTick` (`:353`), which is scheduled only by `nextRequest`, which returns at `:320` when
 *      `!this.timerRequesters.size`.  `start()` (`:239-240`) then calls `nextRequest` itself.  So an
 *      opponent typing `/timer on` at turn 9 does NOT find a bank we have already spent -- it finds
 *      a full one.  The fear that the mid-game switch-on arrives with unknown consumption is
 *      unfounded, and that makes this design EASIER, not harder.
 *
 *   3. `isFirstRequest` (`:167`, `:326`) is still true whenever the timer first comes on, so the
 *      90 s first-turn allowance is granted on WHATEVER TURN THE TIMER STARTS -- not only at preview.
 *
 *   4. A post-KO replacement is its own REQUEST with its own 55 s window off the same bank
 *      (`updateTurn` returns at `:286` for a mid-turn request without clamping).  So the unit that
 *      spends the bank is a REQUEST, not a turn, and a game with KOs has more requests than turns.
 *
 *   5. Charging is quantised: `TICK_TIME = 5` (`:41`) and every tick subtracts 5 whole seconds.
 *      Thinking for 12 s costs 15 s.  Round our own spend UP to a tick before believing it.
 *
 * And the two failure modes are NOT symmetric, which is the whole shape of the reserve below:
 *   turn expires with bank alive -> `>{slot} default`, a server-chosen move   (`:451-453`)
 *   bank hits zero               -> `forfeitPlayer(..., ' lost due to inactivity.')`, WE LOSE (`:455`)
 * =========================================================================== */
const CLK = {
  BANK_MS: 420000,        // Timer Starting -- and the hard ceiling updateTurn re-imposes every turn
  GRACE_MS: 90000,        // Timer Grace -- spendable ONLY on the first timed request, then clamped
  TURN_CAP_MS: 55000,     // Timer Max Per Turn
  FIRST_CAP_MS: 90000,    // Timer Max First Turn
  TICK_MS: 5000,          // TICK_TIME -- the bank is charged in whole 5 s units
};

/* WHAT WE CAN ACTUALLY SEE OF THE CLOCK, and it is more than I expected.
 *
 * `room-battle.ts:332` sends the PLAYER, privately, on every request while the timer is on:
 *
 *     |inactive|Time left: 55 sec this turn | 420 sec total | 90 sec grace
 *
 * so `turnSecondsLeft` and `secondsLeft` are both OBSERVABLE EXACTLY, not inferred.  Two traps in
 * parsing it: the "total" field is `secondsLeft - grace` (`:330-332`), so the real bank is
 * total + grace and reading "total" alone under-reads by 90 s early; and the grace field is absent
 * once it is gone.  `|inactive|Battle timer is ON:` (`:237`) and `|inactiveoff|` (`:257`) bracket it.
 *
 * THE CAPABILITY IS NOT WIRED LIVE.  `engine/mag_bot.js` handles no `|inactive|` line at all
 * (grepped: zero hits) and mag_bot is OPS's file, not SEARCH's.  So `noteClock` below exists, is
 * counted, and in a live game is CALLED ZERO TIMES until OPS wires it.  Under CLAUDE.md that means
 * it is assumed broken, so the adaptive rule must be correct WITHOUT it -- see `bankMs()`, which
 * falls back to charging ourselves from a full bank as though the timer had been on since move one.
 * That is the worst case and it errs toward under-spending, which costs search quality rather than
 * the game. */
function parseInactive(line) {
  const m = /Time left:\s*(\d+)\s*sec this turn\s*\|\s*(\d+)\s*sec total(?:\s*\|\s*(\d+)\s*sec grace)?/i.exec(String(line || ''));
  if (!m) return null;
  return { turnSec: +m[1], totalSec: +m[2], graceSec: m[3] ? +m[3] : 0 };
}

/* The build these timings describe.  A duration is a fact about a machine under a load AND about a
 * build -- PRIORITIES #14 is "R2 is re-run or it is nothing" for exactly the missing half of that.
 * Hashed once per process. */
let _STAMP = null;
/* WHICH NAMED ENGINE RELEASE THIS PROCESS IS RUNNING, resolved by CONTENT and not by a tag.
 *
 * docs/DIVISIONS.md rule 1 — SEARCH plays a frozen, named engine release, never HEAD — has never had
 * a mechanism, so every run to date is attributed by `status.js` comparing MTIMES, which a checkout
 * moves without moving code. `data/engine-release.json` is that mechanism: a cut writes the release
 * name beside the sha256 of every file whose bytes can change a rollout's value, and any run can
 * then answer "which release did you play" by hashing its own worktree and comparing.
 *
 * THE DIGESTS COME FROM `run_stamp.sourceDigests`, NOT FROM THE FOUR-FILE sha1 SET BELOW. Those two
 * lists disagreed — `run_stamp.LEAF_SOURCES` is 5 files hashed with sha256 and this file hashed 4
 * with sha1, so `data/abra-tags.js` (which ENGINE rewrites constantly) was invisible to a MILTANK
 * stamp and visible to every other gate's. FACTS ARE GLOBAL: there is one definition of "the engine
 * these numbers describe" and it lives in run_stamp.
 *
 * INERT UNTIL THE CUT. With no release file this records `UNRELEASED`, which is the honest answer and
 * is exactly what every run on disk should read. When the cut lands, this resolver moves to
 * `engine/engine_release.js` so `status.js` and `run_stamp.js` share it — DO NOT WRITE A SECOND ONE.
 * `source_digests` is kept unchanged beside it because `reduce()`'s mixed-build check keys on it and
 * because a TIMING artifact is legitimately about the player as well as the engine. */
function resolveRelease(engineDigests) {
  let rel = null;
  try { rel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'engine-release.json'), 'utf8')); }
  catch (e) {
    /* An absent file IS the documented state ("no cut has ever happened"); a file that exists but
     * cannot be parsed is a finding, and collapsing the two is how a corrupt release would read as
     * merely uncut. The reason rides in the stamp, where reduce()'s reader can see it. */
    const errWhy = (e && e.code === 'ENOENT') ? null : String((e && e.message) || e);
    return Object.assign(
      { release: 'UNRELEASED', release_status: 'NO RELEASE HAS EVER BEEN CUT — docs/DIVISIONS.md rule 1 is unenforced' },
      errWhy ? { release_read_error: errWhy } : {});
  }
  const want = (rel && rel.digests) || {};
  const moved = Object.keys(want).filter(k => k !== 'note' && engineDigests[k] !== want[k]);
  return {
    release: rel.release || 'UNNAMED',
    release_status: moved.length ? 'PRE-RELEASE' : 'ON_RELEASE',
    release_moved: moved.length ? moved : undefined,
  };
}
function buildStamp() {
  if (_STAMP) return _STAMP;
  const files = ['medicham2-browser.js', 'rollout_leaf.js', 'miltank.js', 'board.js'];
  const digests = {};
  for (const f of files) {
    try {
      const p = path.join(__dirname, f);
      digests[f] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
      digests[f + ':mtime'] = fs.statSync(p).mtime.toISOString();
    } catch (e) {
      /* the stamp carries the reason, not just the fact: 'UNREADABLE' alone cannot distinguish a
       * deleted file from a permissions failure when the artifact is read a week later */
      const errMsg = String((e && e.message) || e);
      digests[f] = 'UNREADABLE: ' + errMsg;
    }
  }
  const RS = require('./run_stamp.js');
  const engineDigests = RS.sourceDigests();
  _STAMP = Object.assign({
    engine_digests: engineDigests,
    player_digest: digests['miltank.js'],
    source_digests: digests,
  }, resolveRelease(engineDigests), {
    node: process.version,
    host: os.hostname(),
    cpu: (os.cpus()[0] || {}).model || 'unknown',
    cores: os.cpus().length,
    ruleset: 'VGC Timer (Timer Starting=420, Grace=90, AddPerTurn=0, MaxPerTurn=55, MaxFirstTurn=90)',
  });
  return _STAMP;
}
/* HASHED AT LOAD, NOT AT THE FIRST DECISION.  ENGINE lands fixes while SEARCH runs; if the digest
 * were taken when the first row is written, it could describe a file that was edited AFTER this
 * process loaded it, and the run would carry a stamp for a build it is not running. */
buildStamp();

/* PER-DECISION WALL CLOCK, WRITTEN TO AN ARTIFACT.  "The mean is not what times you out" -- the
 * whole point is the tail, so rows are kept and reduced afterwards rather than averaged in flight.
 * Enabled by `timing:` or MILTANK_TIMING=<path>; a zero decision count is a broken capability and
 * `--reduce` says so out loud. */
function makeTimer(dest) {
  const file = dest || process.env.MILTANK_TIMING || null;
  const state = { file, rows: 0, wroteStamp: false, install: crypto.randomBytes(4).toString('hex') };
  return {
    on: !!file,
    count: () => state.rows,
    install: state.install,
    record(row) {
      if (!file) return;
      try {
        let out = '';
        if (!state.wroteStamp) {
          state.wroteStamp = true;
          out += JSON.stringify({ _stamp: buildStamp(), install: state.install, t: new Date().toISOString() }) + '\n';
        }
        out += JSON.stringify(Object.assign({ install: state.install, t: Date.now() }, row)) + '\n';
        fs.appendFileSync(file, out);
        state.rows++;
      } catch (e) {
        /* a timing artifact must never break a turn — so the game continues, but the failure is
         * counted and said once, because a recorder that dies silently is PRIORITIES 0b in a new
         * costume: the run finishes clean and the shard simply has fewer rows than decisions */
        state.errWrites = (state.errWrites || 0) + 1;
        if (state.errWrites === 1) console.error('MILTANK timing: write failed (' + ((e && e.message) || e) + ') — continuing; further write failures counted, not printed');
      }
    },
  };
}

/* THE ADAPTIVE SPEND.  DEFAULT OFF -- `clock: false` -- so nothing changes in a live game without a
 * deliberate decision, and so the flag is a pure throttle: it can only ever LOWER the budget below
 * the configured `budgetMs`, never raise it.  A rule that could also spend more would need its own
 * accuracy evidence; this one needs only to not be worse.
 *
 * The rule, in one line: spend `(bank - reserve) / expected remaining requests`, clamped under the
 * per-turn wall with a safety margin, floored so a starved tail still searches something.
 *
 * WHY THE RESERVE IS NOT SYMMETRIC.  Overrunning the TURN costs one server-chosen move; emptying the
 * BANK forfeits the game.  So the reserve sits on the bank and the turn gets only a tick-quantisation
 * margin.  `clockRequestsP90` is a HIGH QUANTILE of requests per game, not the mean, for the same
 * reason the distribution is being measured at all. */
/* ENV FALLBACKS, AND WHY THEY EXIST RATHER THAN A FLAG.  The A/B that judges this rule has to run
 * through `engine/mew.js`, and the switch that turns the lever on has to reach `install()` from the
 * command line.  `mew.js` is MEASURE's file and `mag_bot.js` is OPS's, so SEARCH cannot add
 * `--miltank-clock` to either -- the same one-liner PRIORITIES #33 already owes `--miltank-explore`.
 * An environment variable is reachable from both without editing another division's file, and it is
 * recorded in every timing row, so a result can still be attributed to the lever.  Replace these
 * with real flags when #33 is done; do not add a second way to set the same thing and leave both. */
function envOn(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return v !== '0' && v.toLowerCase() !== 'false';
}

function makeClock(opts, timer) {
  const ON = envOn('MILTANK_CLOCK', !!opts.clock);
  const STATIC = opts.budgetMs || 20000;
  const RESERVE = opts.clockReserveMs != null ? opts.clockReserveMs : 45000;
  const MIN_MS = opts.clockMinMs != null ? opts.clockMinMs : 1500;
  const SAFETY = opts.clockSafetyMs != null ? opts.clockSafetyMs : 10000;
  /* THE PLANNING HORIZON, IN REQUESTS, AND IT IS MEASURED RATHER THAN GUESSED.
   * `node engine/miltank.js --horizon data/games.ladder.jsonl` over 30,396 non-forfeit ladder games:
   * requests (turns plus own-faint turns, since a replacement is its own request) run p50 9, p90 13,
   * p95 15, p99 19, max 74, and only 0.58% of games exceed 21.  A bank timeout forfeits, so the
   * horizon is the p99 and not the p90 -- planning against the median is planning to lose the tail. */
  const EXPECT = opts.clockHorizonRequests != null ? opts.clockHorizonRequests : 19;
  /* PAST THE HORIZON, `EXPECT - requests` COLLAPSES TO 1 AND THE RULE SPENDS THE WHOLE BUDGET AGAIN.
   * Caught by driving the clock through 40 requests rather than by reading it: at request 35 with an
   * observed 200 s bank the divisor is 1, `usable/1` clears 20,000, and the throttle silently turns
   * itself off exactly when the game has proved it is a long one.  A game that has already outlived
   * the p90 has a conditional remaining length nowhere near 1, so always plan for at least this many
   * more requests.  A stated conservative choice, not a measurement. */
  const TAIL_MIN = opts.clockTailMin != null ? opts.clockTailMin : 8;
  const st = {
    on: ON, requests: 0, charged: 0, timerSeen: false, timerOn: false,
    obsBank: null, obsAt: 0, obsTurnCap: null, notes: 0, timedRequests: 0,
  };
  return {
    enabled: ON,
    stats: () => Object.assign({}, st),
    /* Called once per REQUEST, not once per slot: both halves of a doubles turn are one charge. */
    onRequest() { st.requests++; if (st.timerOn) st.timedRequests++; },
    charge(ms) { st.charged += Math.ceil(ms / CLK.TICK_MS) * CLK.TICK_MS; },
    /* The observation hook.  OPS must call this from the `|inactive|` handler mag_bot does not yet
     * have; `notes` is the counter that proves whether it ever ran. */
    noteClock(o) {
      st.notes++;
      if (!o) return;
      if (o.on === false) { st.timerOn = false; return; }
      st.timerSeen = true; st.timerOn = true;
      const p = typeof o === 'string' ? parseInactive(o) : o;
      if (!p) return;
      /* bank = total + grace.  `:330-332` prints them apart and the sum is the real secondsLeft. */
      st.obsBank = (p.totalSec + (p.graceSec || 0)) * 1000;
      st.obsAt = Date.now();
      if (p.turnSec != null) st.obsTurnCap = p.turnSec * 1000;
      st.charged = 0;                      // an observation supersedes every estimate before it
    },
    /* WORST CASE WHEN NOBODY IS WATCHING.  With no observation we assume the timer has been on since
     * the first request and charge ourselves from a full 420 s.  If the timer is in fact off we have
     * throttled for nothing -- a weaker search, not a lost game.  If it comes on at turn 9 the
     * estimate has over-charged us for turns that were free, so we under-spend.  Both errors land on
     * the safe side, which is the only property this function is allowed to have. */
    bankMs() {
      let bank;
      if (st.obsBank != null) bank = st.obsBank - (Date.now() - st.obsAt);
      else bank = CLK.BANK_MS - st.charged;
      /* updateTurn re-clamps to `starting` on every new turn, so the grace is never bankable past
       * the first timed request.  Never believe more than 420 s once one has gone by. */
      if (st.requests > 1) bank = Math.min(bank, CLK.BANK_MS);
      return Math.max(0, bank);
    },
    /* The per-request wall.  90 s on the first timed request (`maxFirstTurn`), 55 s after. */
    turnCapMs() {
      if (st.obsTurnCap != null) return st.obsTurnCap;
      return st.requests <= 1 ? CLK.FIRST_CAP_MS : CLK.TURN_CAP_MS;
    },
    /* `configured` is what the flag would have spent; this can only return that or less. */
    budgetFor(kind, configured) {
      const want = configured != null ? configured : STATIC;
      if (!ON) return want;
      const bank = this.bankMs();
      const R = Math.max(TAIL_MIN, EXPECT - st.requests);
      const usable = Math.max(0, bank - RESERVE);
      let ms = usable / R;
      ms = Math.min(ms, want, Math.max(0, this.turnCapMs() - SAFETY));
      ms = Math.max(ms, MIN_MS);
      ms = Math.min(ms, Math.max(0, bank - CLK.TICK_MS * 2));
      return Math.round(ms);
    },
  };
}

/* Defaults match mag_bot's flags so a caller that passes nothing gets the shipped player. */
/* `defer` -- hand a turn back to MAG when the search cannot separate its options.
 *
 * ON by default, and that default is an ASSUMPTION rather than a measurement: an argmax over
 * indistinguishable options is a coin flip, and a prior fitted on humans should beat a coin flip.
 * Plausible, untested, and it decides 29% of turns in an R4 run -- so it is a flag now, and the A/B
 * is one run rather than an argument.
 *
 * There is one live reason to keep it while it is untested: MEDICHAM is missing sixteen confirmed
 * mechanics, so in a position the search cannot separate, MAG's prior was fitted on people playing
 * the REAL game and the search is reasoning about a broken one. That argument weakens with every
 * mechanic fixed, which is itself worth measuring. */
/* `previewExplore` -- null means FOLLOW `explore`, which is the point of it existing.
 *
 * The preview used to run its own hand-rolled playout at deterministic greedy while every other
 * decision ran explore=1.0, so MILTANK shipped two leaves and only one of them was ever swept. They
 * are one implementation now (rollout_leaf.runPlayout) and greedy is still reachable -- set this to
 * 0. It is a separate knob because preview may legitimately want a different setting: explore is
 * monotone as a JUDGE over the swept range, but preview scores a whole game from turn zero rather
 * than a mid-battle board, and nothing has measured that it wants the same value. Defaulting it to
 * `explore` is a decision to have ONE player until something says otherwise, not a measurement.
 * No CLI flag reaches it yet -- mag_bot.js and mew.js are not this division's files; see
 * PRIORITIES #33, which owes `--miltank-explore` the same one-liner. */
/* `clock` -- adaptive spend against the bank.  OFF, deliberately: the shipped player must not change
 * because an instrumentation pass landed.  See makeClock above for the rule and for what the
 * Showdown source actually says.  `clockEarlyDefer` is a SEPARATE flag and is also off, because it
 * changes WHAT IS CLICKED and not only how long it takes -- it needs its own SPRT arm, not a timing
 * argument.  `timing` writes the per-decision wall-clock artifact and is off unless asked. */
const DEFAULTS = { defer: true, budgetMs: 20000, foePolicy: 'uniform', n: 200, explore: 1.0, turns: 60, previewN: 40, previewMs: 15000,
                   previewExplore: null, why: false, trace: false,
                   timing: null, clock: false, clockEarlyDefer: false,
                   clockReserveMs: 45000, clockMinMs: 1500, clockSafetyMs: 10000,
                   clockHorizonRequests: 19, clockTailMin: 8 };

/* Install MILTANK onto an already-constructed magnemite player.
 *
 * `bot` must be a live magnemite instance: the overrides close over its chooseMove, chooseSwitch and
 * chooseTeamPreview, so MAG is still there underneath and is what every fallback returns to. */
function install(bot, o) {
  const opts = Object.assign({}, DEFAULTS, o || {});
  const ROLLOUT_N = opts.n, ROLLOUT_EXPLORE = opts.explore, ROLLOUT_TURNS = opts.turns;
  const PREVIEW_N = opts.previewN, PREVIEW_MS = opts.previewMs;
  const PREVIEW_EXPLORE = typeof opts.previewExplore === 'number' ? opts.previewExplore : ROLLOUT_EXPLORE;
  const WHY = !!opts.why, TRACE = !!opts.trace;
  const DEFER = opts.defer !== false;
  /* 'uniform' (a coin flip) or 'prior' (what the species really clicks). See rollout_leaf. */
  const FOE_POLICY = opts.foePolicy || 'uniform';
  /* Optional: told the win probability after a real decision, so a caller can surface it. */
  const SAY = typeof opts.onSay === 'function' ? opts.onSay : null;

  /* THE CLOCK.  TIMER records; CLOCK decides.  Both are inert unless switched on. */
  const TIMER = makeTimer(opts.timing);
  const CLOCK = makeClock(opts, TIMER);
  const EARLY_DEFER = envOn('MILTANK_EARLY_DEFER', !!opts.clockEarlyDefer);
  bot._miltankClock = CLOCK;
  bot._miltankTimer = TIMER;
  /* THE OBSERVATION HOOK, exposed on the bot so a socket handler can feed it the `|inactive|` line
   * verbatim.  Nothing calls it today -- mag_bot.js parses no `|inactive|` and is OPS's file -- and
   * `CLOCK.stats().notes` is the counter that will prove it when something does. */
  bot.noteClock = (o) => CLOCK.noteClock(o);
  bot.clockStats = () => CLOCK.stats();
  /* One REQUEST is one charge against the bank, and a doubles turn is two chooseMove calls on one
   * request.  Counting calls instead of requests would double the spend estimate. */
  let _lastReq = null;
  const onRequest = function (req) { if (req !== _lastReq) { _lastReq = req; CLOCK.onRequest(); } };
  let _dec = 0;
  /* THE COUNTER THAT PROVES THE SEARCH RAN, and it exists because a run without one produced a full
   * null that looked like a result. PRIORITIES 0b: `--miltank` with `--policy random` bails out of
   * every `chooseMove` SILENTLY — 81 of 81 calls, 0 leaf calls, `acts=0 i=-1 board=false` — and the
   * only visible output is one preview-fallback line. An H2H arm can therefore run a whole job
   * having searched NOTHING and still print a win rate. Under CLAUDE.md a capability that cannot
   * prove it ran is assumed broken, so every leaf call is counted and the count is stamped on every
   * timing row; `reduce` then reports total leaf calls and how many decisions made ZERO of them.
   *
   * `calls` is leaf ENTRIES (one `rolloutWinProb`/`rolloutAfterActions`); `playouts` is games
   * actually played out, which is the quantity that scales with cost. */
  const LEAF = { calls: 0, playouts: 0 };
  bot.searchStats = () => ({ calls: LEAF.calls, playouts: LEAF.playouts, decisions: _dec });
  const leafWinProb = (b, s, o) => { LEAF.calls++; LEAF.playouts += (o && o.n) || 0; return RL.rolloutWinProb(b, s, o); };
  const leafAfterActions = (b, s, o) => { LEAF.calls++; LEAF.playouts += (o && o.n) || 0; return RL.rolloutAfterActions(b, s, o); };
  const say = (kind, ms, extra) => {
    _dec++;
    if (!TIMER.on) return;
    TIMER.record(Object.assign({
      dec: _dec, kind, ms, req: CLOCK.stats().requests,
      leaf: LEAF.calls, playouts: LEAF.playouts,
      turn: (bot.board && bot.board.turn) || null,
      n: ROLLOUT_N, explore: ROLLOUT_EXPLORE, turns: ROLLOUT_TURNS, foe: FOE_POLICY,
      previewN: PREVIEW_N, previewMs: PREVIEW_MS, budgetMs: opts.budgetMs || 20000,
      clock: CLOCK.enabled, early: EARLY_DEFER, bankMs: CLOCK.bankMs(), notes: CLOCK.stats().notes,
    }, extra || {}));
  };

      const RL = require('./rollout_leaf.js');
      /* The real dex, not undefined. dmgMon uses it to resolve the EFFECTIVE ability — a mega's
       * own ability rather than the sheet's pre-mega one — and Huge Power doubles Attack. */
      const DEX = CS.sim().Dex.forFormat(CS.FORMAT);
      const base = bot.chooseMove.bind(bot);
      bot._rolloutPick = null;
      bot._rolloutReq = null;
      /* POST-KO REPLACEMENT, JUDGED BY THE SAME SEARCH THAT PLAYS THE REST OF THE GAME.
       *
       * Showdown routes a forced replacement to chooseSwitch and never through chooseMove, so this
       * decision was made by magnemite's one-step `_scoreForcedPick` while the rollout that plays
       * every other turn never saw it. Two players deciding alternate turns disagree, and Will
       * watched the disagreement: "IT SWAPPED IN FROSLASS AFTER A KO ONLY TO IMMEDIATELY SWITCH IT
       * OUT" -- the heuristic brought it in, the search sent it away.
       *
       * Falls back to magnemite on ANY doubt -- an unbuildable body, a species that cannot be read
       * off the request, or a set of candidates the rollout cannot separate. The heuristic is a
       * fitted one and is the right floor; it is being overridden only where there is evidence. */
      /* ONE MEGA PER REQUEST, ENFORCED HERE.
       *
       * magnemite's _withMega has no such guard and states it does not need one: a team holds
       * one stone, so only one slot ever carries canMegaEvo. That invariant is true and this
       * does not doubt it -- but the cost of it being wrong is a REJECTED CHOICE, which on a
       * live server is a battle that stalls until the timer kills it. A three-line guard against
       * a stalled game is worth more than the invariant is worth defending. */
      /* WHY A MEGA DID OR DID NOT HAPPEN, said out loud. Three separate mega bugs have now been
       * found by Will noticing it did not mega -- each time the failure was SILENT, because a
       * capability that is absent logs nothing. This prints the two facts that decide it. */
      const megaTrace = function (choice, active, where) {
        if (!TRACE) return choice;
        const can = !!(active && active.canMegaEvo);
        console.log(`    mega[${where}] canMegaEvo=${can} megaP=${this.megaP} choice="${choice}"`);
        return choice;
      };
      const megaOnce = function (choice) {
        if (!/ mega$/.test(String(choice))) return choice;
        if (this._megaReq === this._req) return String(choice).replace(/ mega$/, '');
        this._megaReq = this._req;
        return choice;
      };
      const baseTeamPreview = bot.chooseTeamPreview.bind(bot);
      /* WHICH FOUR TO BRING AND WHICH TWO TO LEAD -- decided by playing it out, not by imitation.
       *
       * magnemite never overrode chooseTeamPreview, so the live bot inherited RandomPlayerAI's
       * `return 'default'`: bring Pokemon 1-4 in packed order and lead the first two. Every game
       * ever played against this bot had its lead decided by where a Pokemon happened to sit in a
       * team string. The code's own comment calls preview "the single largest branch in the game".
       *
       * WINNING, NOT IMITATING, and the distinction decides the design. Will asked it directly:
       * "ARE WE TRYING TO IMITATE HUMANS OR WIN, OR IS THAT THE SAME". engine/prior_player.js has a
       * fitted bring sampler that reproduces what people lead, and it is the wrong tool here -- a
       * prior can only say "Whimsicott leads 53% of the time", which is a fact about the population
       * and not about this game. WITH OPEN TEAM SHEETS WE KNOW THEIR ENTIRE TEAM, which is
       * information no human-usage prior can encode. So the matchup is computed instead of guessed.
       *
       * Imitation still earns its place where the search cannot separate options -- that fallback is
       * already in the move picker -- but it is a floor, not a target.
       *
       * THEIR CHOICE IS MARGINALISED, NOT ASSUMED. We do not know which four they bring, so each
       * playout samples one of theirs at random. Fixing a guess for their side would optimise
       * against one opponent out of fifteen and call it a plan.
       */
      bot.chooseTeamPreview = function (team) {
        const t0 = Date.now();
        onRequest(this._req || 'preview');
        try {
          const side = this.me || 'p1';
          const foe = side === 'p1' ? 'p2' : 'p1';
          const sheets = (this.board && this.board.sheet) || {};
          const mine = sheets[side] || {}, theirs = sheets[foe] || {};
          const myNames = (team || []).map(m =>
            String((m && (m.details || m.speciesForme || m.species)) || '').split(',')[0].trim());
          const theirNames = Object.keys(theirs);
          /* NO SHEET, NO SEARCH. Without their team this is guessing dressed as computation, and the
           * inherited default is at least honest about being arbitrary. Reported, not silent. */
          if (myNames.length < 4 || theirNames.length < 2) {
            console.log('  preview: no open sheet for the opponent — falling back to default order');
            return baseTeamPreview(team);
          }
          const MEDI = require('./medicham2-browser.js');
          /* THROUGH dmgMon, THE ONE PATH THAT ALREADY WORKS.
           *
           * The first version called buildMon with the species name straight off the request and
           * buildMonFromSet with a hand-assembled set. Both failed, on the WHOLE TEAM:
           *
           *     buildMon("Scizor")          -> null      capitalised
           *     buildMon("scizor")          -> scizor
           *     buildMon("Ninetales-Alola") -> null      and hyphens must be KEPT, not stripped
           *     buildMonFromSet(...)        -> THREW     wrong set shape
           *
           *     preview: too few bodies -- unbuildable: Scizor, Sylveon, Trevenant, Infernape, ...
           *
           * So the lead search failed on every one of its own Pokemon and fell back, three restarts
           * in a row, each time behind a different symptom.
           *
           * dmgMon is what rollout_leaf builds every rollout body with. It resolves the MC key
           * through mcKeyFor -- the ONE way to turn a species name into a damage-engine key, which
           * exists precisely so this is not done by hand -- and reads the sheet for item and nature.
           * Writing a second builder was the mistake; there was already one. */
          const bodyOf = (name, sheet) => {
            try {
              const st = sheet[name] || null;
              return B.dmgMon({
                species: name, hp: 1, status: '', boosts: {},
                item: st ? (st.item || '') : undefined,
                nature: st ? (st.nature || '') : undefined,
              }, MEDI, DEX) || null;
            } catch (e) {
              /* dmgMon returning null is a normal condition (handled below, by name); dmgMon
               * THROWING is not, and folding the two together is how a broken builder would read
               * as a merely-absent usage row */
              console.error('  preview: body build THREW for ' + name + ': ' + ((e && e.message) || e));
              return null;
            }
          };
          const myBodies = myNames.map(n => () => bodyOf(n, mine));
          const theirBodies = theirNames.map(n => () => bodyOf(n, theirs));
          /* DROP WHAT CANNOT BE BUILT; DO NOT ABANDON THE SEARCH.
           *
           * Requiring all twelve bodies meant ONE unbuildable Pokemon threw away the whole lead
           * decision -- and dmgMon legitimately returns null for an in-battle forme with no usage
           * row, so that is a normal condition rather than an error. Seen live: the sheet arrived,
           * the search had everything it needed, and it fell back anyway.
           *
           * A bring needs four of mine and something of theirs to be worth computing. Below that,
           * fall back and say which species could not be built, because a silent fallback is what
           * hid this for two restarts. */
          const badMine = myNames.filter((n, i) => !myBodies[i]());
          const okTheirs = theirNames.filter((n, i) => theirBodies[i]());
          if (myNames.length - badMine.length < 4 || okTheirs.length < 2) {
            console.log('  preview: too few bodies to score a bring — falling back to default order' +
              (badMine.length ? '  (unbuildable: ' + badMine.join(', ') + ')' : '') +
              '  theirs=' + okTheirs.length);
            return baseTeamPreview(team);
          }
          if (badMine.length) console.log('  preview: skipping unbuildable ' + badMine.join(', '));

          /* Every (lead pair, back pair) our six allows: 15 leads x 6 backs = 90 brings. */
          const combos = [];
          /* Only indices that actually build, or a bring can name a Pokemon the playout cannot field. */
          const idx = myNames.map((_, i) => i).filter(i => myBodies[i]());
          /* `a` AND `b` ARE POSITIONS IN `idx`; `rest` HOLDS THE INDICES THEMSELVES. Mixing the two
           * is what the previous version did -- it pushed the POSITIONS a and b beside the INDEX
           * values rest[c], rest[d] -- and the two coincide only when every Pokemon builds, which is
           * why it survived. The moment one does not, the enumeration is wrong in three ways at once,
           * measured on a six-mon team with two unbuildable bodies:
           *
           *     19 brings enumerated where exactly 6 exist
           *     18 of the 19 named a Pokemon the search had just declared UNBUILDABLE
           *     15 "distinct" brings out of a true set of 6
           *
           * and the log then reported a lead the playout never fielded -- `combo.map(...).filter(
           * Boolean)` silently dropped the missing body, so a 3-mon bring was scored and printed as
           * a 4-mon one. Caught by the preview smoke for the leaf unification, not by anything that
           * was watching. */
          for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
            const rest = idx.filter((_, p) => p !== a && p !== b);
            for (let c = 0; c < rest.length; c++) for (let d = c + 1; d < rest.length; d++) {
              combos.push([idx[a], idx[b], rest[c], rest[d]]);
            }
          }
          const N = PREVIEW_N;
          /* PREVIEW TIME IS THE CHEAPEST TIME IN THE GAME and the arithmetic says so: the first
           * timed request gets `maxFirstTurn` = 90 s, and `updateTurn` clamps the bank back to 420 s
           * on the NEXT turn regardless -- so anything spent here inside 90 s comes out of grace that
           * would otherwise be thrown away.  The throttle therefore only ever binds preview when the
           * bank is already in trouble, which at request 0 it is not. */
          const PMS = CLOCK.budgetFor('preview', PREVIEW_MS);
          const DEADLINE = t0 + PMS;
          /* COMMON RANDOM NUMBERS ACROSS BRINGS. One seed for the whole preview, so playout i of
           * every candidate bring faces the SAME sampled opponent four and the same dice.
           *
           * The seed used to be mixed from the combo itself, so each of the 90 brings was judged
           * against its own independent draws and the difference between two brings sat underneath
           * that noise. That is the identical mistake the post-KO replacement search made and fixed
           * (see `replSeed` below): sharing the seed cancels the variance the candidates have in
           * common and leaves the part that is actually about WHICH FOUR I BROUGHT. Standard
           * variance reduction, and free. */
          const previewSeed = (Date.now() & 0xffff) * 7919 + 13;
          let best = null, bestVal = -1, done = 0;
          for (const combo of combos) {
            if (Date.now() > DEADLINE) break;
            /* THE SAME LEAF AS EVERYTHING ELSE. This loop used to call battleInit/battleTurn itself
             * with no explore and no forced actions -- deterministic greedy on BOTH sides -- so
             * MILTANK shipped two playout policies and only the other one was ever swept. The
             * position preview asks about is different (a fresh game, no board); the way it is
             * played out is not, and it is a PARAMETER now rather than a second implementation. */
            const r = leafWinProb(null, side, {
              n: N, dex: DEX, explore: PREVIEW_EXPLORE, foePolicy: FOE_POLICY,
              maxTurns: ROLLOUT_TURNS, seed: previewSeed,
              /* NOBODY HAS ENTERED YET, so the entry effects must fire.
               *
               * `seeded:true` is right for a mid-battle leaf -- the actives are already standing
               * there and re-running Intimidate would drop the same Attack twice. At PREVIEW it is
               * simply wrong: it suppressed turn-one Intimidate, Drought, Drizzle, Snow Warning,
               * the terrain setters and every other switch-in ability, which are precisely the
               * effects a lead decision is about. Deciding a lead is largely deciding who eats an
               * Intimidate, and the search could not see one. */
              seeded: false,
              /* THEIR BRING IS MARGINALISED, NOT ASSUMED -- sampled fresh every playout, off the
               * leaf's own per-playout rng so the sampling and the dice come from one stream. */
              buildTeams: (i, rng) => {
                const A = combo.map(i2 => myBodies[i2]()).filter(Boolean);
                const pool = theirBodies.slice();
                const B2 = [];
                while (B2.length < 4 && pool.length) {
                  const j = Math.floor(rng() * pool.length) % pool.length;
                  const b = pool.splice(j, 1)[0]();
                  if (b) B2.push(b);
                }
                if (A.length < 2 || B2.length < 2) return null;
                return { A, B: B2 };
              },
            });
            if (!r) continue;
            done++;
            if (r.p > bestVal) { bestVal = r.p; best = combo; }
          }
          if (!best) return baseTeamPreview(team);
          const order = best.concat(idx.filter(i => best.indexOf(i) < 0));
          /* THE SETTINGS ARE IN THE LINE. A preview that prints a win% and not the leaf it used is
           * a number nobody can attribute to a lever afterwards -- which is how two different
           * playout policies shipped for as long as they did. */
          console.log(`  preview: lead ${myNames[best[0]]} + ${myNames[best[1]]}, back ` +
            `${myNames[best[2]]} + ${myNames[best[3]]}  win ${(100 * bestVal).toFixed(0)}%  ` +
            `(${done}/${combos.length} brings scored, ${Date.now() - t0}ms, ` +
            `n=${PREVIEW_N} explore=${PREVIEW_EXPLORE} foe=${FOE_POLICY} turns=${ROLLOUT_TURNS} fresh-game)`);
          const _ms = Date.now() - t0;
          CLOCK.charge(_ms);
          say('preview', _ms, { opts: combos.length, done, budget: PMS, deferred: false });
          return 'team ' + order.map(i => i + 1).join('');
        } catch (e) {
          console.error('  preview search threw, falling back to default: ' + e.message);
          const _ms = Date.now() - t0;
          CLOCK.charge(_ms);
          say('preview', _ms, { threw: true, deferred: true });
          return baseTeamPreview(team);
        }
      };

      const baseSwitch = bot.chooseSwitch.bind(bot);
      bot.chooseSwitch = function (active, switches) {
        const tSw = Date.now();
        onRequest(this._req);
        try {
          /* `ROLLOUT` was mag_bot's own on/off flag and came through the extraction as a free
           * variable -- so chooseSwitch threw on every forced replacement and fell back to MAG,
           * silently, in the one harness where it had never been exercised. Inside this file the
           * guard is meaningless: if install() ran, MILTANK is on. */
          if (!this.board || !(switches || []).length) return baseSwitch(active, switches);
          if ((switches || []).length < 2) return baseSwitch(active, switches);
          const side = this.me || 'p1';
          const req = this._req;
          const reqMons = (req && req.side && req.side.pokemon) || [];
          const speciesOf = (slot) => {
            const m = reqMons[slot - 1];
            return m ? String(m.details || m.ident || '').split(',')[0].trim() : '';
          };
          const DEX2 = DEX;
          const field = {
            /* Terrain was hardcoded '' here, so the post-KO search judged every replacement on a
             * bare field even when one was up — the same hole as the in-game leaf, in a decision
             * where the terrain is often exactly the point (who is safe to send into Electric
             * Terrain). One call, same helper, no map in this file. */
            weather: this.board.weather || '', terrain: RL.terrainOnBoard(this.board),
            tr: this.board.hasField('trickroom') ? 5 : 0,
            twA: this.board.hasSide(side, 'tailwind') ? 4 : 0,
            twB: this.board.hasSide(side === 'p1' ? 'p2' : 'p1', 'tailwind') ? 4 : 0,
          };
          const replSeed = (Date.now() & 0xffff) * 6151 + 17;
          const scored = [];
          /* THE REPLACEMENT SEARCH HAD NO DEADLINE AT ALL -- five candidates at n = 2*ROLLOUT_N, and
           * it is a SEPARATE REQUEST with its own 55 s wall (`room-battle.ts:286`, a mid-turn request
           * does not clamp and does draw from the bank).  So a game with KOs spends more requests
           * than it has turns, and this was the one decision nothing bounded.  Only enforced when the
           * clock flag is on, so the OFF path is byte-for-byte the player that was measured. */
          const SW_DEADLINE = CLOCK.enabled ? tSw + CLOCK.budgetFor('switch', opts.budgetMs || 20000) : Infinity;
          let swCut = 0;
          for (const sw of switches) {
            const sp = speciesOf(sw.slot);
            if (!sp) continue;
            if (Date.now() > SW_DEADLINE) { swCut++; continue; }
            const r = leafWinProb(this.board, side, {
              n: ROLLOUT_N * 2, dex: DEX2, explore: ROLLOUT_EXPLORE, foePolicy: FOE_POLICY, field,
              /* COMMON RANDOM NUMBERS. Every candidate is judged on the SAME dice.
               *
               * The seed used to vary per candidate, so the difference between two replacements was
               * buried in independent noise -- and the replacement search then deferred to MAG on
               * EVERY decision of a live game:
               *
               *     Simipour 3%, Heliolisk 2%       within a 1.0pt error
               *     Aerodactyl 100%, Charizard 100% within a 0.3pt error
               *     Sneasler 87%, Staraptor 85%     within a 2.1pt error
               *
               * Five of five, so the post-KO search I built was never once used and MAG's one-step
               * heuristic made every replacement -- the exact thing that caused Froslass in-then-out.
               *
               * Sharing the seed cancels the variance the candidates have in common (the same
               * opponent draws, the same crit rolls) and leaves the difference that is actually
               * about WHICH POKEMON CAME IN. Standard variance reduction, and free. */
              maxTurns: ROLLOUT_TURNS, seed: replSeed,
              bringIn: sp, protectTurns: this._protectTurns,
            });
            if (r && typeof r.p === 'number') scored.push([r.p, sw.slot, sp]);
          }
          if (scored.length < 2) {
            const _ms = Date.now() - tSw; CLOCK.charge(_ms);
            say('switch', _ms, { opts: switches.length, done: scored.length, cut: swCut, deferred: true });
            return baseSwitch(active, switches);
          }
          scored.sort((a, b) => b[0] - a[0]);
          /* The same noise-floor rule the move picker uses: an argmax over estimates that overlap is
           * a coin flip wearing a search's clothes, and magnemite's ranking is the better tiebreak. */
          const se = Math.sqrt(Math.max(scored[0][0] * (1 - scored[0][0]), 0.0025) / (ROLLOUT_N * 2));
          if (DEFER && scored[0][0] - scored[1][0] < 1.5 * se) {
            console.log(`  replacement: UNDECIDED — ${scored.map(s => s[2] + ' ' + (100 * s[0]).toFixed(0) + '%').join(', ')}` +
              `; within a ${(100 * se).toFixed(1)}pt error, deferring to MAG`);
            const _ms = Date.now() - tSw; CLOCK.charge(_ms);
            say('switch', _ms, { opts: switches.length, done: scored.length, cut: swCut, deferred: true });
            return baseSwitch(active, switches);
          }
          {
            const _ms = Date.now() - tSw; CLOCK.charge(_ms);
            say('switch', _ms, { opts: switches.length, done: scored.length, cut: swCut, deferred: false });
          }
          console.log(`  replacement: ${scored[0][2]} ${(100 * scored[0][0]).toFixed(0)}%` +
            `  (over ${scored.slice(1).map(s => s[2] + ' ' + (100 * s[0]).toFixed(0) + '%').join(', ')})`);
          if (this._claimReq !== this._req) { this._claimReq = this._req; this._claimed = new Set(); }
          /* The double-claim guard magnemite documents at :409 applies here too: both slots can be
           * asked for a replacement in the same request, and naming one body twice kills the battle. */
          for (const [, slot] of scored) {
            if (this._claimed.has(slot)) continue;
            this._claimed.add(slot);
            return slot;
          }
          return baseSwitch(active, switches);
        } catch (e) {
          console.error('  replacement search threw, falling back to MAG: ' + e.message);
          const _ms = Date.now() - tSw; CLOCK.charge(_ms);
          say('switch', _ms, { threw: true, deferred: true });
          return baseSwitch(active, switches);
        }
      };

      bot.chooseMove = function (active, moves) {
        const tCall = Date.now();
        try {
          const req = this._req;
          onRequest(req);
          const acts = (req && req.active) || [];
          const i = acts.indexOf(active);
          /* The partner's half, decided on the other slot's call. */
          if (this._rolloutReq === req && this._rolloutPick && this._rolloutPick[i] != null) {
            const pick = this._rolloutPick[i]; this._rolloutPick[i] = null;
            return megaOnce.call(this, megaTrace.call(this, this._withMega(pick, active), active, 'parked'));
          }
          /* Singles-shaped requests, forced switches and anything with one slot fall through to MAG:
           * the pair logic below assumes two live slots and would otherwise index undefined. */
          if (acts.length < 2 || i < 0 || (req && req.forceSwitch)) return base(active, moves);

          const side = this.me || 'p1';
          const board = this.board;
          /* THE BOARD DOES NOT KNOW THE TEAM IN LIVE PLAY, and nothing said so.
           *
           * `setParty` is called by fit_policy, joint_rows and the other OFFLINE walkers and by
           * nothing in magnemite, so `board.bench()` returns [] for the whole battle. MAG never
           * noticed because it builds switch candidates from the REQUEST instead — two candidate
           * builders, and only one of them is fed here.
           *
           * The seeder reads the board, so every rollout was judging a 2v2 with empty benches: a
           * switch had no body to bring in, the forced click was skipped, and the slot quietly fell
           * back to the playout policy. That is why every switch scored the same and the search
           * took one every turn. Diagnosed from the timing — 1,000 playouts in 10ms is not a fast
           * rollout, it is a battle that ended before turn 1.
           *
           * Filled from the request, which is authoritative about what this side actually brought. */
          const reqMons = (req.side && req.side.pokemon) || [];
          /* RE-SEEDED EVERY DECISION, not once per battle.
           *
           * The guard used to skip whenever a party was already set, so a party that went stale --
           * or that the tracker rebuilt empty -- stayed stale for the rest of the game. The rollout
           * resolves a switch against board.bench(), while the CANDIDATES come from the request, so
           * an empty bench makes every switch unresolvable while still being offered.
           *
           * Seen live and it is not subtle: `bravebird + fakeout win 94% (sw resolved 0/unres 800)`.
           * Eight hundred switch clicks that resolved to nothing, so every switch candidate collapsed
           * to the same fallback and the 94% was an argmax over a menu that did not exist. That turn
           * was in the game MAGABRA threw from 100%.
           *
           * The request is authoritative about what this side actually brought and it arrives every
           * turn, so there is no reason to prefer a remembered answer to the current one. */
          if (reqMons.length) {
            const species = reqMons
              .map(m => String(m.details || m.ident || '').split(',')[0].trim())
              .filter(Boolean);
            if (species.length) board.setParty(side, species);
          }
          /* THE OPPONENT'S SIDE TOO, or the rollout plays my four against their two and reports 100%
           * for every option — which is exactly what it did, and an argmax over ties is a coin flip
           * that looked like a decision to switch every turn.
           *
           * `showteam` already fills board.sheet with all SIX of their Pokemon (magnemite.js:509) and
           * never touches the party, so the information was there and unused. Capped at four, because
           * six would bias the other way just as hard: this is a bring-four format and a 4v6 rollout
           * is not the game either. Revealed bodies go first — those are known to be brought — and the
           * rest fills from the sheet, which is a GUESS about which four they chose and is stated as
           * one rather than presented as knowledge. */
          const foeS = side === 'p1' ? 'p2' : 'p1';
          /* THE OPPONENT'S FOUR, from the open sheet. Will is running OTS-only, so their team is
           * public — which is the whole reason this is answerable at all.
           *
           * Capping MY side to their revealed count was tried and was worse: it emptied my bench, so
           * every switch candidate had no body to resolve to and the search ranked options that could
           * not happen (480 unresolved clicks in one turn). Symmetric ignorance is not better than
           * asymmetric knowledge when the asymmetry is the thing being searched over.
           *
           * Revealed bodies first — those are known to have been brought — then filled from the sheet
           * to four. The fill is a GUESS about which four of six they chose and is one of the two
           * things most likely to be wrong about this bot's judgement. */
          if (!(board.party && (board.party[foeS] || []).length)) {
            const seen = ['a', 'b'].map(L => board.slot(foeS, L)).filter(Boolean).map(m => m.species);
            const sheetSp = Object.keys((board.sheet && board.sheet[foeS]) || {});
            const foeParty = [];
            for (const sp of seen.concat(sheetSp)) {
              if (sp && !foeParty.includes(sp) && foeParty.length < 4) foeParty.push(sp);
            }
            if (foeParty.length) board.setParty(foeS, foeParty);
          }
          /* `_movesForSlot` IS THE NORMALISER, and skipping it was the whole bug.
           *
           * `_candsFor` expects magnemite's own move shape, with a `.choice` string on each entry.
           * The RAW request array does not have that, so passing `a2.moves` produced a candidate list
           * of `{move: null, choice: undefined}` — four dead entries per slot — and the only survivors
           * were the switches. The search then picked a double switch every turn because THOSE WERE
           * THE ONLY TWO OPTIONS IT COULD SEE. Not a preference for switching: a menu with nothing
           * else on it.
           *
           * Diagnosed by printing the per-class means live and getting `SW+SW 6%(2)` — two pairs
           * evaluated out of thirty-six. The arithmetic gave it away before the dump did.
           *
           * magnemite's own _decidePair does exactly this at lines 909-912; copied rather than
           * re-derived, because the shape is its business and this file has now got it wrong once. */
          const built = ['a', 'b'].map((L, k) => {
            const a2 = acts[k];
            const user = board.slot(side, L);
            if (!user || user.fainted || !a2) return null;
            const mv2 = (k === i) ? moves : this._movesForSlot(a2, k);
            if (!mv2 || !mv2.length) return null;
            const b2 = this._candsFor(a2, mv2, k);
            return b2 && b2.cands && b2.cands.length ? b2 : null;
          });
          if (!built[0] || !built[1]) return base(active, moves);

          const field = {
            weather: board.weather || '',
            /* A THIRD SPELLING, AND IT MATCHED NOTHING. This read `hasField('electric')` — the
             * ENGINE's word — against a Board that stores the dex's `electricterrain`. ENGINE
             * measured the consequence directly: 0 of 863 terrain-carrying corpus boards ever
             * reached the leaf with a terrain. `RL.terrainOnBoard` probes the board's own keys and
             * translates with `MEDI.terrainId`; no map lives in this file. */
            terrain: RL.terrainOnBoard(board),
            tr: board.hasField('trickroom') ? 5 : 0,
            twA: board.hasSide(side, 'tailwind') ? 4 : 0,
            twB: board.hasSide(side === 'p1' ? 'p2' : 'p1', 'tailwind') ? 4 : 0,
          };
          /* THE CANDIDATE SHAPE HERE IS MAGNEMITE'S, NOT BOARD.JS'S, and I used the wrong one.
           *
           *   `targetLetter` does not exist on these — that is board.js's `candidates()` shape, used
           *   by rollout_r3. _candsFor carries `targetMon`, a board mon, so the slot is derived by
           *   asking which foe slot holds it. Reading the absent field silently aimed every move at
           *   the first live foe, which collapses "Fake Out the left one" and "Fake Out the right
           *   one" into one candidate.
           *
           *   `move` can be NULL without being a switch: magnemite.js:682 pushes a candidate with
           *   move:null for anything the dex does not recognise. Its own scorer guards this at line
           *   860 (`if (!c.move && !c.switchTo)`) and I did not, which threw on every single turn —
           *   the fallback then played the whole game as MAG while printing one line per decision. */
          const foeSide = side === 'p1' ? 'p2' : 'p1';
          const letterOf = (tm) => {
            if (!tm) return '';
            for (const L of ['a', 'b']) if (board.slot(foeSide, L) === tm) return L;
            return '';
          };
          const clickOf = (c) => {
            if (c.switchTo) return { switchTo: c.switchTo };
            if (!c.move) return null;
            return { move: c.move.id, targetLetter: letterOf(c.targetMon) };
          };
          /* EVERY CANDIDATE, NOT A TOP-K.
           *
           * The first version pruned to the best K per slot — except `_candsFor` returns no scores,
           * so it was taking the first three in array order and calling that the best three. That is
           * worse than not pruning at all: an arbitrary shortlist that LOOKS principled.
           *
           * Enumerating everything also deletes the ceiling engine/truncation_curve.js measured — at
           * K=3 the pair a human clicked falls outside the window 52% of the time, and a search
           * cannot recover value from a branch it never enumerated. The corpus median is 8 options a
           * slot, so ~64 pairs; at ROLLOUT_N=200 that is well inside a Showdown turn timer, and the
           * elapsed cost is printed every decision so it is visible if a board is unusually wide. */
          /* ONE-TIME SANITY LINE. A rollout that returns in microseconds has not played anything,
           * and the win rate it reports is about a battle that ended before turn 1. Printing what the
           * seeder actually built is the difference between "the search prefers switching" and "the
           * search is scoring an empty board". */
          if (!this._rolloutChecked) {
            this._rolloutChecked = true;
            const probe = leafWinProb(board, side, { n: 3, dex: DEX, explore: 1.0, field, seed: 1 });
            console.log('  MILTANK seed check: ' + (probe
              ? `${probe.built} bodies built, dropped ${JSON.stringify(probe.dropped)}, p=${probe.p}`
              : 'NULL — a side could not be built at all'));
            console.log('  my bench: [' + board.bench(side).join(', ') + ']  foe bench: [' +
              board.bench(side === 'p1' ? 'p2' : 'p1').join(', ') + ']');
            /* THE ASYMMETRY IS REPORTED, NOT HIDDEN. I know my whole team from the request; the
             * opponent's bench is only what has been revealed. So the rollout is optimistic by
             * construction — it plays my four against however many of theirs are known — and that
             * bias favours anything that survives to a later turn, switching included. Stated here
             * because a bot that thinks it is ahead switches for the wrong reason. */
          }
          if (!this._candsDumped) {
            this._candsDumped = true;
            for (const k of [0, 1]) console.log("    slot " + k + " cands: " +
              built[k].cands.map(c => c.switchTo ? ("SW:" + c.switchTo)
                : (c.move ? c.move.id : "NULLMOVE(" + JSON.stringify(c.choice) + ")")).join(", "));
          }
          let bestVal = -1, bestPair = null, _res = 0, _unres = 0;
          const _foe = {};
          const byKind = {};
          const t0 = Date.now();
          /* SUCCESSIVE HALVING, because an argmax over 60-odd noisy estimates picks the luckiest one
           * and not the best one.
           *
           * At n=120 a win rate near 0.7 carries a standard error around 4 points. Taking the max over
           * 63 such estimates inflates the winner by roughly two standard errors of pure dice, which
           * is larger than most real differences between two reasonable clicks. The visible symptom
           * was the bot clicking RECOVER AT FULL HP — a move MEDICHAM correctly heals 0 with, so it is
           * a wasted turn that simply drew good rollouts. The heal is clamped; the SEARCH was wrong.
           *
           * This is the project's own noise-floor law applied to the live picker: an effect smaller
           * than the spread is not an effect. Rather than arbitrate ties after the fact, spend the
           * budget where it decides anything — screen every pair cheaply, then re-test only the
           * survivors at high n with FRESH seeds, so a lucky first pass has to be lucky twice.
           *
           * Cheaper than the flat version it replaces: 63*40 + 8*240 beats 63*120. */
          /* A MOVE THIS ENGINE CANNOT EXPRESS IS NOT PUT ON THE MENU.
           *
           * rollout_leaf states the rule for switches -- "a candidate this engine cannot express is
           * SKIPPED, not approximated ... offering the search a cell it will silently resolve as
           * something else is worse than a smaller menu" -- and it was never applied to MOVES.
           *
           * MEDICHAM returns kind 'pass' for anything it has no model of: Psych Up, Haze, and the
           * rest of the 1.5% the coverage report counts. A 'pass' is not neutral, it is a turn spent
           * doing nothing -- so every such candidate scored identically, and an argmax over a menu
           * padded with identical do-nothings picks one whenever the real options are close. Will
           * watched it: "IT JUST PSYCH UP WITH NO BOOSTS TO COPY".
           *
           * Dropping them does not make the bot play those moves worse. It cannot play them at all;
           * this only stops it CHOOSING them blind. If every candidate for a slot is unexpressible
           * the whole decision falls back to MAG, which does have an opinion about them. */
          const MEDI = require('./medicham2-browser.js');
          const _body = (m) => {
            try { return m ? B.dmgMon(m, MEDI, DEX) : null; }
            catch (e) {
              /* null feeds "cannot tell -- keep it rather than guess" below, which is safe; but a
               * builder that ALWAYS throws would silently turn the whole expressibility filter off,
               * so the throw is said out loud */
              console.error('  expressibility: dmgMon THREW for ' + ((m && m.species) || '?') + ': ' + ((e && e.message) || e));
              return null;
            }
          };
          const _foeBody = (() => {
            for (const L of ['a', 'b']) { const f = board.slot(foeSide, L); if (f && !f.fainted) { const b = _body(f); if (b) return b; } }
            return null;
          })();
          const expressible = (c, k) => {
            if (!c || c.switchTo) return true;                 // switches are resolved by rollout_leaf
            if (!c.move) return false;
            const ub = _body(board.slot(side, k === 0 ? 'a' : 'b'));
            /* The candidate's OWN target, not just the first live foe: a status aimed at the left
             * Pokemon and one aimed at the right are different clicks and only one may be dead. */
            const tb = _body(c.targetMon) || _foeBody;
            if (!ub || !tb) return true;                       // cannot tell -- keep it rather than guess
            try {
              const a = MEDI.playerAction(ub, c.move.id, tb, field);
              if (!a || a.kind === 'pass') return false;
              /* A CLICK THAT CANNOT DO ITS ONE JOB IS ALSO NOT A CANDIDATE.
               *
               * Will-O-Wisp into a Fire type is expressible, resolves cleanly, and burns nothing --
               * so the previous filter kept it and the search picked it whenever the real options were
               * close. Will: "IT JUST WILLO WISPED INTO A FIRE TYPE THAT SHOULD BE A BANNED CLICK".
               *
               * Asked of the engine rather than asserted here: canTakeStatus already enforces the type
               * and ability immunities, so this covers Toxic into Steel, sleep into Insomnia and every
               * other dead status without naming one. Only dropped when EVERY effect the move has is
               * refused -- a move that also drops a stat or hits is still a real option. */
              /* READ FROM THE ARTIFACT, NOT FROM THE ACTION. Will-O-Wisp returns kind 'status' from
               * a branch that predates the generic one, so it never carries the spec on the action --
               * checking a.si silently skipped exactly the move that prompted this. The tag is on the
               * MOVE and is true whichever branch classified it. */
              const _sp = TAGSMOD.param('move', c.move.id, 'statusInflict');
              const si = _sp && _sp.effects;
              const _scp = TAGSMOD.param('move', c.move.id, 'statChange');
              if (si && si.length && !(_scp && _scp.target) && !c.move.basePower) {
                const anyLands = si.some(e => {
                  if (e.volatile) return true;                 // volatiles are not status immunities
                  if (!e.status) return true;
                  const who = e.to === 'user' ? ub : tb;
                  try { return MEDI.canTakeStatus(who, e.status); }
                catch (err) {
                  /* keep-rather-than-ban is the safe direction, but a canTakeStatus that always
                   * throws would silently retire the banned-click filter Will asked for — say it */
                  console.error('  expressibility: canTakeStatus THREW (' + ((err && err.message) || err) + ') — keeping the candidate');
                  return true;
                }
                });
                if (!anyLands) return false;
              }
              return true;
            } catch (e) {
              /* same shape as canTakeStatus above: keeping the candidate is safe, a filter that
               * always throws is a capability silently off */
              console.error('  expressibility check THREW (' + ((e && e.message) || e) + ') — keeping the candidate');
              return true;
            }
          };
          for (const k of [0, 1]) {
            const keep = built[k].cands.filter((c) => expressible(c, k));
            const dropped = built[k].cands.length - keep.length;
            if (dropped && keep.length) {
              built[k] = Object.assign({}, built[k], { cands: keep });
              if (WHY) console.log(`    slot ${k}: dropped ${dropped} candidate(s) MEDICHAM plays as a no-op`);
            }
          }
          /* Built AFTER the filter above, or they would index a menu that no longer exists. */
          const oa = built[0].cands.map((c, idx) => idx);
          const ob = built[1].cands.map((c, idx) => idx);
          /* A HARD BUDGET. One live decision took 33,589ms -- 56 options at n=120 -- which is close
           * enough to Showdown's turn timer that a harder position could time out, and a loss on the
           * clock says nothing about the player. The finalist round stops when the budget is spent
           * and reports how many it managed, because a silent truncation reads as full coverage. */
          /* ADAPTIVE, AND ONLY DOWNWARD.  With `clock:false` this is exactly `opts.budgetMs` and the
           * player is unchanged; with it on, the budget is `(bank - reserve) / remaining requests`
           * clamped under the 55 s wall.  A flat 20 s survives 21 decisions off a 420 s bank; VGC
           * doubles games run past that often enough that the shipped constant can forfeit a won
           * game, and a loss on the clock says nothing about the player. */
          const BUDGET_MS = CLOCK.budgetFor('move', opts.budgetMs || 20000);
          const tStart = Date.now();
          const SCREEN_N = Math.max(12, Math.round(ROLLOUT_N / 3));
          const FINAL_K = 8;
          const evalPair = (ia, ib, n, salt) => {
            const ca2 = built[0].cands[ia], cb2 = built[1].cands[ib];
            if (ca2.switchTo && cb2.switchTo && ca2.choice === cb2.choice) return null;
            const ka = clickOf(ca2), kb = clickOf(cb2);
            if (!ka || !kb) return null;
            return leafAfterActions(board, side, {
              n, dex: DEX, explore: ROLLOUT_EXPLORE, foePolicy: FOE_POLICY, field, maxTurns: ROLLOUT_TURNS,
              seed: (Date.now() & 0xffff) * 7919 + ia * 31 + ib + salt,
              myClicks: [ka, kb], protectTurns: this._protectTurns,
              report: (r) => { if (r.unresolved) _unres += r.unresolved; else _res += r.resolved;
                /* What the OPPONENT did across the playouts, so the assumption is inspectable. */
                if (r.foeFirst) for (const k in r.foeFirst) _foe[k] = (_foe[k] || 0) + r.foeFirst[k]; },
            });
          };
          /* Round one: every pair, cheaply. These values decide who advances and nothing else — they
           * are never reported as the chosen action's worth, precisely because they are the biased ones. */
          /* THE SCREEN GETS A SHARE OF THE BUDGET, NOT ALL OF IT.
           *
           * The budget was checked only in the finalist round, so a wide turn spent the whole
           * allowance screening and then evaluated ONE finalist:
           *
           *     MILTANK: tickle + closecombat  win 53%  (72 opts, 20873ms, finals 1/8)
           *       slot 1 cands: fakeout, fakeout, closecombat, ...
           *
           * Fake Out was on the menu and was never compared to anything. Will asked why it did not
           * Fake Out turn one; the answer is that the search never got that far, and the truncation
           * counter said so. Screening is the CHEAP half whose only job is to shortlist -- spending
           * everything there and nothing on the decision inverts the whole point of halving.
           *
           * 40% to the screen, the rest to the finalists, and the screen shrinks its own sample when
           * the menu is wide rather than simply running out of time. */
          const SCREEN_BUDGET = Math.floor(BUDGET_MS * 0.4);
          const nPairs = Math.max(1, oa.length * ob.length);
          const screenN = Math.max(8, Math.min(SCREEN_N, Math.round(SCREEN_N * 60 / nPairs)));
          const screened = [];
          let screenCut = 0;
          for (const ia of oa) for (const ib of ob) {
            if (Date.now() - tStart > SCREEN_BUDGET) { screenCut++; continue; }
            const v = evalPair(ia, ib, screenN, 0);
            if (v === null) continue;
            screened.push([v, ia, ib]);
          }
          if (screenCut && WHY) console.log(`    screen ran out of time on ${screenCut} pair(s)`);
          if (!screened.length) {
            const _ms = Date.now() - tCall; CLOCK.charge(_ms);
            say('move', _ms, { opts: oa.length * ob.length, budget: BUDGET_MS, deferred: true, why: 'no-screen' });
            return base(active, moves);
          }
          screened.sort((a, b) => b[0] - a[0]);
          const finalists = screened.slice(0, FINAL_K);
          /* EARLY DEFER -- STOP PAYING FOR A DECISION WE ARE ABOUT TO GIVE AWAY.
           *
           * MILTANK handed 29% of turns back to MAG in an R4 run and paid the FULL search first every
           * time: the screen, then eight finalists at 2*ROLLOUT_N, then a spread test that said the
           * finalists are indistinguishable.  The finalist round is ~60% of the budget by
           * construction, so a quarter of the clock is spent producing an answer that is discarded.
           *
           * The screen already has an opinion about the spread; it is just noisier.  The estimator,
           * with its bias stated rather than hidden: K estimates of ONE true value span roughly
           * 2.8 sigma, so subtract that expected pure-dice range from the observed screen spread and
           * ask whether what is left clears the FINAL round's tie band.  It is an estimate of the
           * true spread and it is biased low by construction -- which is the direction that makes it
           * defer MORE often, so it must be judged on play and not on clock.
           *
           * OFF BY DEFAULT AND IT IS NOT A TIMING LEVER.  It changes what gets clicked on every turn
           * where the screen and the finals would have disagreed, so it needs its own SPRT arm.  A
           * "this is only an optimisation" argument would be false here and is not made. */
          let earlyDefer = false;
          if (EARLY_DEFER && DEFER && finalists.length > 1) {
            const top = finalists[0][0];
            const seScreen = Math.sqrt(Math.max(top * (1 - top), 0.0025) / Math.max(1, screenN));
            const seFinal = Math.sqrt(Math.max(top * (1 - top), 0.0025) / (ROLLOUT_N * 2));
            const ceil0 = top > 0.95 || top < 0.05;
            const bandFinal = ceil0 ? Math.max(1.5 * seFinal, 0.05) : 1.5 * seFinal;
            const obs = finalists[0][0] - finalists[finalists.length - 1][0];
            const trueHat = Math.max(0, obs - 2.8 * seScreen);
            if (trueHat < bandFinal) {
              earlyDefer = true;
              console.log(`  MILTANK: EARLY-UNDECIDED — screen spans ${(100 * obs).toFixed(1)}pt over ` +
                `${finalists.length} finalists at n=${screenN}; true spread ~${(100 * trueHat).toFixed(1)}pt ` +
                `against a ${(100 * bandFinal).toFixed(1)}pt final band; deferring to MAG without the finals`);
              const _ms = Date.now() - tCall; CLOCK.charge(_ms);
              say('move', _ms, { opts: oa.length * ob.length, budget: BUDGET_MS, deferred: true,
                                 why: 'early', screenN, screenSpread: obs, trueHat, bandFinal });
              return base(active, moves);
            }
          }
          /* Round two: the survivors only, at the full budget and with a DIFFERENT seed salt, so a
           * pair that advanced on lucky dice has to roll them again. */
          let finalsDone = 0;
          for (const [, ia, ib] of finalists) {
            if (Date.now() - tStart > BUDGET_MS) break;
            finalsDone++;
            const v = evalPair(ia, ib, ROLLOUT_N * 2, 104729);
            if (v === null) continue;
            const ca2 = built[0].cands[ia], cb2 = built[1].cands[ib];
            const kind = (ca2.switchTo ? 'SW' : 'mv') + '+' + (cb2.switchTo ? 'SW' : 'mv');
            (byKind[kind] = byKind[kind] || []).push(v);
            if (v > bestVal) { bestVal = v; bestPair = [ia, ib]; }
          }
          if (!bestPair) {
            const _ms = Date.now() - tCall; CLOCK.charge(_ms);
            say('move', _ms, { opts: oa.length * ob.length, budget: BUDGET_MS, deferred: true, why: 'no-finals' });
            return base(active, moves);
          }
          /* WHEN THE SEARCH CANNOT TELL THE OPTIONS APART, IT MUST SAY SO RATHER THAN GUESS.
           *
           * Live log, a lost position: `protect + protect win 1%` with `by class: mv+mv 0%(35)` --
           * all thirty-five options scored zero, so the argmax ranked pure dice and dice chose double
           * Protect. Same shape produced `blizzard + flamethrower` at 1%. The search was not choosing
           * badly; it had NO SIGNAL and no way to report that, and an argmax always returns something.
           *
           * MAG is the better tiebreak there. It is a fitted policy over human games, so in a position
           * the rollout cannot separate it still plays something a person would play -- which is the
           * whole reason it is the shipped player. Deviating from it needs evidence, and no spread
           * between candidates is the absence of evidence.
           *
           * Two ways that happens, both handled: the finalists are statistically indistinguishable, or
           * the position is decided and every line loses anyway. */
          const fv = [];
          for (const k of Object.keys(byKind)) for (const v of byKind[k]) fv.push(v);
          const spread = Math.max(...fv) - Math.min(...fv);
          const se = Math.sqrt(Math.max(bestVal * (1 - bestVal), 0.0025) / (ROLLOUT_N * 2));
          /* A WON POSITION COMPRESSES EVERYTHING, so the spread test needs a wider net up there.
           *
           * Two failures, same root, opposite directions:
           *   deferring at >97% threw a game -- the leaf read 100%, stopped thinking, and lost;
           *   NOT deferring picked ELECTRO SHOT OUT OF RAIN at 100%, because when the position is
           *   already won a two-turn charge move also wins and the search cannot tell it apart.
           *
           * The old rule skipped the search entirely on confidence. This one still SEARCHES -- so a
           * wrong 100% is not blindly trusted -- and only uses MAG to break a tie among options the
           * search rates as equivalent. Near the ceiling "equivalent" has to be measured on a looser
           * scale than one standard error, because at 100% the standard error collapses to nothing
           * while the real differences do not.
           *
           * The genuine fix is calibrating the leaf. This is a mitigation and is labelled as one. */
          const ceiling = bestVal > 0.95 || bestVal < 0.05;
          const tieBand = ceiling ? Math.max(1.5 * se, 0.05) : 1.5 * se;
          if (DEFER && fv.length > 1 && spread < tieBand) {
            console.log(`  MILTANK: UNDECIDED — ${fv.length} finalists span ${(100 * spread).toFixed(1)}pt` +
              ` against a ${(100 * tieBand).toFixed(1)}pt band${ceiling ? ' (near the ceiling)' : ''}; deferring to MAG`);
            const _ms = Date.now() - tCall; CLOCK.charge(_ms);
            say('move', _ms, { opts: oa.length * ob.length, budget: BUDGET_MS, deferred: true, why: 'late',
                               screenN, finalsDone, finalsK: finalists.length, screenCut });
            return base(active, moves);
          }
          /* NO LONGER DEFERS ON CONFIDENCE, and the reason is a game it threw.
           *
           * The rule used to hand the turn to MAG whenever the search read the position as already
           * won or already lost, on the argument that every line scores the same so the choice does
           * not matter. That argument holds ONLY IF THE EVALUATION IS RIGHT, and it is not:
           *
           *     94%  switch gholdengo + heatwave
           *     100% position already decided -- deferring to MAG
           *     100% position already decided -- deferring to MAG
           *     90%  closecombat + weatherball
           *          |win|willhoop
           *
           * So it stopped thinking precisely in the positions where its leaf was most wrong, and
           * coasted a 100% read into a loss. A miscalibrated evaluation plus a rule that trusts it
           * is worse than either alone.
           *
           * The noise-floor deferral above SURVIVES, because that one is about the SPREAD between
           * candidates rather than the absolute number -- it says "these options are within one
           * standard error of each other", which is true whether the leaf is calibrated or not. */
          const ms = Date.now() - t0;
          const chosen = [built[0].cands[bestPair[0]], built[1].cands[bestPair[1]]];
          /* WHO clicked it, not just what. The log named the moves and not the Pokemon, so a line
           * like "ragepowder + playrough" cannot be traced back to a body -- and asked which mon used
           * Rage Powder, I guessed Amoonguss from the move alone and was wrong. A log that invites a
           * guess is a log that will get one. */
          const _who = ['a', 'b'].map((L) => { const m = board.slot(side, L); return m ? m.species : '?'; });
          console.log(`  MILTANK: ${chosen.map((c, i) => _who[i] + ' ' + (c.switchTo ? 'switch ' + c.switchTo : c.move.id)).join(' + ')}` +
            `  win ${(100 * bestVal).toFixed(0)}%  (${oa.length * ob.length} opts, ${ms}ms, ` +
            `finals ${finalsDone}/${finalists.length}, sw resolved ${_res}/unres ${_unres})`);
          const summary = Object.keys(byKind).sort().map(k =>
            k + ' ' + (100 * byKind[k].reduce((a, b) => a + b, 0) / byKind[k].length).toFixed(0) +
            '%(' + byKind[k].length + ')').join('  ');
          console.log('    by class: ' + summary);
          /* WHAT IT ASSUMED YOU WOULD DO. Will asked whether the search considered that he would
           * mega, Tailwind and Solar Beam. It does not PREDICT any of that -- at explore=1.0 the
           * opponent clicks a uniformly random legal move -- so his line is one draw among many.
           * Printing the distribution makes that inspectable instead of something I assert. */
          {
            const tot = Object.values(_foe).reduce((x, y) => x + y, 0);
            if (tot) {
              const top = Object.entries(_foe).sort((x, y) => y[1] - x[1]).slice(0, 5)
                .map(([k, v]) => k + ' ' + Math.round(100 * v / tot) + '%').join(', ');
              console.log('    it assumed you might: ' + top);
            }
          }
          {
            const _ms = Date.now() - tCall; CLOCK.charge(_ms);
            say('move', _ms, { opts: oa.length * ob.length, budget: BUDGET_MS, deferred: false, why: 'chose',
                               screenN, finalsDone, finalsK: finalists.length, screenCut, searchMs: ms });
          }
          if (SAY) { try { SAY(bestVal, chosen); } catch (e) { console.error('MILTANK: chat line failed: ' + ((e && e.message) || e)); /* never let a chat line break a turn */ } }
          this._rolloutReq = req;
          this._rolloutPick = [];
          /* THROUGH _withMega, WHICH THE ROLLOUT PATH WAS BYPASSING ENTIRELY.
           *
           * magnemite appends ` mega` in _withMega and calls it at three sites -- all of them
           * inside ITS OWN decision paths. This override returns a choice built here and went
           * through none of them, so the rollout bot could not mega evolve in any game ever
           * played against it. Will found it live: 'IT DIDNT MEGA ITS KANGA'. Zero CHOOSING MEGA
           * lines across the whole session log, which is the same silence the mega bug produced
           * the first two times -- a capability that is absent rather than wrong logs nothing.
           *
           * Both halves of the pair go through it. Only one slot ever carries canMegaEvo, because
           * a team holds one stone, so the pair cannot both claim it; _withMega also leaves
           * switches alone, where a mega suffix is not legal to send. */
          this._rolloutPick[1 - i] = chosen[1 - i].choice;
          return megaOnce.call(this, megaTrace.call(this, this._withMega(chosen[i].choice, active), active, 'direct'));
        } catch (e) {
          /* NEVER FORFEIT A LIVE BATTLE OVER A SEARCH BUG. Falling back to MAG is a worse move, not a
           * lost game — and the reason is printed so it is fixable rather than mysterious. */
          /* The first stack frame too: 'Cannot read properties of null' names a symptom and not
           * a site, and the fallback means this can otherwise repeat silently every turn of
           * every game while the bot quietly plays as MAG. */
          const at = (String(e.stack || '').split('\n')[1] || '').trim();
          console.error('  rollout failed, falling back to MAG: ' + e.message + (at ? ' | ' + at : ''));
          const _ms = Date.now() - tCall; CLOCK.charge(_ms);
          say('move', _ms, { threw: true, deferred: true, why: 'threw' });
          return base(active, moves);
        }
      };
  return bot;
}

/* ===========================================================================
 * THE REDUCER.  `node engine/miltank.js --reduce <rows.jsonl> [--out <summary.json>]`
 *
 * Lives in this file on purpose: the thing that reads the artifact and the thing that writes it
 * should not be able to drift apart about what a row means.  It reports the SHAPE -- median, p90,
 * p99, max, the count over the 55 s per-turn wall, and the cumulative per-game spend against the
 * 420 s bank -- because "the mean is not what times you out" is the entire premise.
 *
 * It refuses to summarise rows written under more than one build.  A timing distribution that mixes
 * two engines is not a fact about either of them, and PRIORITIES #14 exists because that was already
 * allowed to happen once.
 * =========================================================================== */
function reduce(file) {
  const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))] : null;
  /* A MISSING FILE IS THE LOUDEST VERSION OF THE 0b TRAP, not a crash. Reproduced 2026-08-04:
   * `--policy random --miltank` finishes a clean 2-game run, prints `MEW done ... (0 discarded)`,
   * and writes NO timing row at all, because every chooseMove bails before `say()` is reached. The
   * reducer used to answer that with an ENOENT stack trace, which reads like a broken tool rather
   * than a run that never searched. */
  if (!fs.existsSync(file)) {
    return { ERROR: 'NO TIMING FILE — MILTANK recorded nothing, so the search almost certainly never ran (see PRIORITIES 0b: --policy random bails silently)', file };
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const stamps = [], rows = [];
  let torn = 0;   // a torn shard line is data loss, and a reduce that cannot say so undercounts silently
  for (const ln of lines) {
    let r; try { r = JSON.parse(ln); } catch (e) { torn++; continue; }
    if (r._stamp) stamps.push(r); else rows.push(r);
  }
  /* A capability that cannot prove it ran is assumed broken. */
  if (!rows.length) return { ERROR: 'ZERO DECISIONS RECORDED — the recorder did not run', file };
  const digestOf = (s) => JSON.stringify(s._stamp.source_digests);
  const uniq = [...new Set(stamps.map(digestOf))];
  const byKind = {};
  for (const r of rows) (byKind[r.kind] = byKind[r.kind] || []).push(r);
  const shape = (rs) => {
    const ms = rs.map(r => r.ms).sort((a, b) => a - b);
    return {
      n: ms.length,
      mean_ms: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length),
      p50_ms: q(ms, 0.5), p90_ms: q(ms, 0.9), p99_ms: q(ms, 0.99), max_ms: ms[ms.length - 1],
      over_turn_wall_55s: ms.filter(x => x > CLK.TURN_CAP_MS).length,
      over_45s: ms.filter(x => x > 45000).length,
      deferred: rs.filter(r => r.deferred).length,
    };
  };
  /* PER GAME, because the bank is per game.  `install()` runs once per player per battle in both
   * mag_bot and mew, so ONE INSTALL ID IS ONE PLAYER IN ONE GAME -- which is exactly the unit the
   * bank is charged against.  Grouping on it also survives rows from several processes being cat'd
   * together, which is how a sharded run arrives. */
  const byInstall = {};
  for (const r of rows) (byInstall[r.install] = byInstall[r.install] || []).push(r);
  const games = Object.keys(byInstall).map(k => {
    const rs = byInstall[k];
    return {
      install: k, decisions: rs.length,
      requests: Math.max(...rs.map(r => r.req || 0)),
      ms: rs.reduce((a, r) => a + r.ms, 0),
      deferred: rs.filter(r => r.deferred).length,
    };
  });
  const gm = games.map(g => g.ms).sort((a, b) => a - b);
  const gr = games.map(g => g.requests).sort((a, b) => a - b);
  return {
    file, generated: new Date().toISOString(),
    build: uniq.length === 1 ? stamps[0]._stamp : { MIXED: uniq.length, WARNING: 'rows span more than one build — not a fact about either' },
    n_measured: rows.length, n_unit: 'decision (one MILTANK search call)',
    torn_lines: torn,
    flags: rows[0] ? { n: rows[0].n, explore: rows[0].explore, turns: rows[0].turns, foe: rows[0].foe,
                       budgetMs: rows[0].budgetMs, previewN: rows[0].previewN, previewMs: rows[0].previewMs,
                       clock: rows[0].clock, earlyDefer: rows[0].early } : null,
    clock_observations: rows.reduce((a, r) => a + (r.notes || 0), 0),
    /* DID THE SEARCH ACTUALLY SEARCH. PRIORITIES 0b: `--miltank` with `--policy random` bails out of
     * every chooseMove silently and produces a complete, normal-looking run in which the leaf was
     * never called once.  `leaf` is cumulative per install, so a decision that searched nothing
     * leaves the count unchanged from the previous row.  A run whose `leaf_calls` is 0, or whose
     * `decisions_with_zero_leaf_calls` is most of the rows, is NOT a result — it is a null produced
     * by a player that never ran.  Read this field before reading anything else in the artifact. */
    search: (() => {
      let zero = 0;
      for (const rs of Object.values(byInstall)) {
        let prev = 0;
        for (const r of rs.slice().sort((a, b) => (a.dec || 0) - (b.dec || 0))) {
          const c = r.leaf || 0;
          if (c <= prev) zero++;
          prev = c;
        }
      }
      const calls = Object.values(byInstall).reduce((a, rs) => a + Math.max(0, ...rs.map(r => r.leaf || 0)), 0);
      const play = Object.values(byInstall).reduce((a, rs) => a + Math.max(0, ...rs.map(r => r.playouts || 0)), 0);
      return {
        leaf_calls: calls, playouts: play,
        decisions_with_zero_leaf_calls: zero,
        zero_leaf_pct: +(100 * zero / rows.length).toFixed(1),
        VERDICT: calls === 0 ? 'THE SEARCH NEVER RAN — this artifact is not a measurement of MILTANK'
               : (zero / rows.length > 0.5 ? 'MOST DECISIONS DID NOT SEARCH — check --policy and the board' : 'ok'),
        note: rows.some(r => r.leaf != null) ? null : 'ROWS PREDATE THE LEAF COUNTER — cannot prove the search ran',
      };
    })(),
    per_decision: { all: shape(rows) },
    by_kind: Object.fromEntries(Object.keys(byKind).map(k => [k, shape(byKind[k])])),
    per_game: {
      games: games.length,
      requests: { p50: q(gr, 0.5), p90: q(gr, 0.9), p99: q(gr, 0.99), max: gr[gr.length - 1] },
      total_ms: { p50: q(gm, 0.5), p90: q(gm, 0.9), p99: q(gm, 0.99), max: gm[gm.length - 1] },
      bank_ms: CLK.BANK_MS,
      games_over_bank: games.filter(g => g.ms > CLK.BANK_MS).length,
      games_over_bank_pct: +(100 * games.filter(g => g.ms > CLK.BANK_MS).length / games.length).toFixed(1),
    },
    /* THE TWO NUMBERS THAT DECIDE THE DESIGN, not decoration.
     *  - `budgetMs` IS A CHECKPOINT, NOT A DEADLINE: it is tested between finalists, so the last
     *    finalist runs to completion past it.  The real per-decision cap is budgetMs + one finalist.
     *  - `deferred_spend_pct` IS THE CEILING ON `clockEarlyDefer`: the share of the clock spent on
     *    decisions that were then handed to MAG anyway. */
    budget: (() => {
      const b = rows[0] ? rows[0].budgetMs : 20000;
      const over = rows.filter(r => r.kind === 'move' && r.ms > b);
      const tot = rows.reduce((a, r) => a + r.ms, 0);
      const def = rows.filter(r => r.deferred).reduce((a, r) => a + r.ms, 0);
      return {
        configured_ms: b,
        decisions_over_configured: over.length,
        max_overrun_ms: over.length ? Math.max(...over.map(r => r.ms - b)) : 0,
        note: 'budgetMs is checked between finalists, so it is a checkpoint and not a deadline',
        deferred_decisions: rows.filter(r => r.deferred).length,
        deferred_spend_pct: +(100 * def / tot).toFixed(1),
      };
    })(),
  };
}

/* HOW LONG A REAL GAME IS, IN REQUESTS -- the input the adaptive rule's horizon is set from.
 * A REQUEST, not a turn: a post-KO replacement is its own request off the same bank
 * (`room-battle.ts:286`), so it is counted as `turns + turns in which one of MY bodies fainted`.
 * Forfeits are excluded -- a game that ended because somebody quit says nothing about length. */
function horizon(store) {
  // RAW-STORE-OK: measures game LENGTH in requests; a game's length is a fact about the battle
  // whoever played it, and the clock plans against the whole opponent population, not the clean subset.
  const lines = fs.readFileSync(store, 'utf8').split('\n');
  const reqs = [], turns = [];
  let torn = 0;   // counted, not skipped silently: a store shredding itself should show in the artifact
  for (const l of lines) {
    if (!l) continue;
    let g; try { g = JSON.parse(l); } catch (e) { torn++; continue; }
    if (!Array.isArray(g.turns) || !g.turns.length || g.forfeit) continue;
    let ft = 0;
    for (const t of g.turns) if ((t.ev || []).some(e => e.t === 'f' && /^p1/.test(String(e.s || '')))) ft++;
    turns.push(g.turns.length); reqs.push(g.turns.length + ft);
  }
  const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)]; };
  const over = (k) => +(100 * reqs.filter(x => x > k).length / reqs.length).toFixed(2);
  return {
    store, n_measured: reqs.length, n_unit: 'non-forfeit game', torn_lines: torn,
    turns: { p50: q(turns, .5), p90: q(turns, .9), p99: q(turns, .99), max: q(turns, 1) },
    requests: { p50: q(reqs, .5), p75: q(reqs, .75), p90: q(reqs, .9), p95: q(reqs, .95), p99: q(reqs, .99), max: q(reqs, 1) },
    pct_over: { 13: over(13), 21: over(21), 24: over(24), 30: over(30), 34: over(34) },
  };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--horizon') { console.log(JSON.stringify(horizon(a[1]), null, 2)); }
  else if (a[0] === '--reduce') {
    const out = reduce(a[1]);
    const hi = a.indexOf('--horizon-store');
    if (hi > 0 && a[hi + 1]) out.game_length = horizon(a[hi + 1]);
    const oi = a.indexOf('--out');
    const txt = JSON.stringify(out, null, 2);
    if (oi > 0 && a[oi + 1]) { fs.writeFileSync(a[oi + 1], txt); console.log('wrote ' + a[oi + 1]); }
    console.log(txt);
  } else {
    console.log('usage: node engine/miltank.js --reduce <rows.jsonl> [--out <summary.json>] [--horizon-store <store.jsonl>]\n' +
                '       node engine/miltank.js --horizon <store.jsonl>');
  }
}

module.exports = { install, DEFAULTS, reduce, horizon, parseInactive, CLK };
