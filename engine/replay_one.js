/* replay_one.js — ONE GAME, BOTH ENGINES, EVERY LINE.
 *
 *   node engine/replay_one.js --release 6a05dd9ad60d --team-store data/team-pool-frozen \
 *        --games 1200 --arm middle --config baseline \
 *        --seed "gen9championsvgc2026regmbbo3-2654714554 vs gen9championsvgc2026regmbbo3-2654812667"
 *
 * ================= WHY THIS EXISTS ================================================================
 *
 * Will, 2026-08-21: *"i need the full game log to see why we have a damaged pelipper in the back"*.
 * The repo could not produce one, and it said otherwise:
 *
 *   - `engine/explain_divergence.js` prints *"Re-run the differential with --explain to capture
 *     context"*. THERE IS NO `--explain` FLAG IN game_differential.js and there never was. An
 *     instruction pointing at a feature nobody built is this repo's signature failure in prose form.
 *   - `--dump-games` keeps a WINDOW: sixteen reduced lines before the split and ten after.
 *   - `explain_divergence --live` plays fresh games and prints a TEN-LINE window.
 *
 * None of those is a game. A human asked to explain a body arriving on the bench at 26% needs every
 * line from the leads onward, from BOTH engines, with the split marked — because the answer is
 * usually forty lines earlier than the window reaches.
 *
 * ================= WHAT IT IS NOT ================================================================
 *
 * A DEBUGGING VIEW. It writes no artifact, computes no rate, and publishes nothing. Every number it
 * shows came out of `game_differential.js`. It does not re-implement pairing, building, the pins or
 * the comparator: it calls `pairsFor` and `playGame`, because a second implementation of how a game is
 * built is exactly what CLAUDE.md forbids and would drift from the instrument it exists to explain.
 *
 * ================= THE HONESTY PROBLEM, AND HOW IT IS HANDLED ====================================
 *
 * A SINGLE GAME REPLAYED ALONE IS NOT AUTOMATICALLY THE SAME GAME. `chooseAction` ranks candidate
 * clicks by `covWant`, which reads coverage counters that ACCUMULATE ACROSS THE WHOLE RUN, and by
 * `CLICKS`, which does the same. Replaying pair #12 in a fresh process starts those counters at zero,
 * so the driver may click something different from what it clicked on the night.
 *
 * That is not a reason to reconstruct the game by hand; it is a reason to CHECK. This tool replays the
 * game and then compares its own result against the artifact's stored record of it — agreed lines, the
 * raw line at the split, the stop reason, both rosters — and prints REPRODUCED or NOT REPRODUCED at
 * the top, loudly, before anything else. A replay that does not match the artifact is still a real
 * game and may still be worth reading, but it is NOT the game in the dump and must never be reported
 * as though it were. (`docs/LESSONS.md`: a silent default looks exactly like a working feature.)
 *
 * THE SAME APPLIES TO THE POOL. `pairsFor` draws from `diff_swarm`, whose pick is a STRIDE over the
 * corpus — so `--games` changes WHICH teams get paired, and the artifact's seed only resolves at the
 * size the artifact was run at. If the seed is not found this tool says so and prints how many pairs
 * exist, rather than playing some other game under the requested name.
 */
'use strict';
require('./showdown_path.js');
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH to a built pokemon-showdown checkout. This is not a pass.');
  process.exit(2);
}

const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);

/* `--release` MUST BE PRESENT BEFORE game_differential IS REQUIRED. That file CUTS A RELEASE INTO THE
 * REAL STORE at require time when the flag is absent (game_differential.js:196), and several junk
 * releases have been cut that way. Refused here by name rather than left to chance. */
if (!arg('--release', null)) {
  console.error('REFUSED — pass --release <id>. Requiring engine/game_differential.js without it CUTS');
  console.error('A RELEASE into data/releases as a side effect of loading the module.');
  process.exit(2);
}

const SEED = arg('--seed', null);
const CONFIG = arg('--config', 'baseline');
const ARM_ID = arg('--arm', 'middle');
const AGAINST = arg('--against', 'data/divergence-turns.json');
const OUT = arg('--out', null);
const RAW = !has('--no-raw');

if (!SEED) {
  console.error('REFUSED — pass --seed "<teamA id> vs <teamB id>", exactly as data/divergence-turns.json');
  console.error('spells it. That string IS the pair identity; there is no other handle on a game.');
  process.exit(2);
}

const G = require('./game_differential.js');
const W = require('./protocol_words.js');

/* ---- --trace-choices: WHAT THE HARNESS SAID TO THE AUTHORITY, AND WHETHER IT WAS ACCEPTED --------
 *
 * THIS IS THE ONE THING NEITHER STREAM CAN SHOW. A protocol log records what HAPPENED; a choice that
 * the authority REFUSED produces no line at all, and the refusal is invisible in both directions.
 * `game_differential.js` throws on a rejected MOVE choice — and DOES NOT on a rejected forced switch
 * (`battle.choose(sd, picks.join(', '))` at :3402, return value discarded), so a replacement the
 * authority would not accept is swallowed and the battle simply stops advancing.
 *
 * OBSERVATIONAL ONLY. It wraps `Battle.prototype.choose`, records the arguments, the return value and
 * the side's own error string, and delegates. It changes nothing, and it is OFF unless asked for —
 * an instrument that is always on is an instrument nobody can turn off when it is the suspect. */
/* ---- --repair-forced-switch: AN EXPERIMENT, AND IT CHANGES THE GAME -------------------------------
 *
 * OFF BY DEFAULT AND LOUD WHEN ON. `game_differential.js`'s forced-switch mirror (:3393-3407) has no
 * de-duplication: for each empty slot it takes medicham2's occupant, and when that lookup fails it
 * falls back to "the first live body on the bench" — with no memory of what the other slot just took.
 * A side with TWO empty slots and ONE live body therefore always emits `switch N, switch N`, which
 * Showdown refuses. `chooseAction` carries a `claimed` set for exactly this reason; this path does not.
 *
 * This lever answers the follow-up question — "would the game have continued?" — by de-duplicating at
 * the choose() boundary. It keeps the LAST occurrence, because medicham2 filled the SECOND slot in the
 * game this was written for, and answers `pass` for the rest. A REPAIRED RUN IS NOT THE ARTIFACT'S GAME
 * and the reproduction check will say so. */
const REPAIR = has('--repair-forced-switch');
const REPAIRS = [];
const CHOICES = [];
if (has('--trace-choices') || REPAIR) {
  const { Battle } = require('./champions_sim.js').sim();
  const orig = Battle.prototype.choose;
  Battle.prototype.choose = function (sideId, input) {
    const before = this.requestState;
    if (REPAIR && before === 'switch' && /switch/.test(String(input))) {
      const parts = String(input).split(',').map(s => s.trim());
      const seen = new Set();
      for (let i = parts.length - 1; i >= 0; i--) {
        const m = /^switch\s+(\d+)$/.exec(parts[i]);
        if (!m) continue;
        if (seen.has(m[1])) parts[i] = 'pass'; else seen.add(m[1]);
      }
      const fixed = parts.join(', ');
      if (fixed !== String(input)) { REPAIRS.push({ turn: this.turn, side: sideId, was: String(input), now: fixed }); input = fixed; }
    }
    const ok = orig.call(this, sideId, input);
    const side = this[sideId];
    CHOICES.push({ turn: this.turn, side: sideId, input: String(input),
                   requestBefore: before, requestAfter: this.requestState, accepted: !!ok,
                   error: (side && side.choice && side.choice.error) || null,
                   forceSwitch: (side && side.activeRequest && side.activeRequest.forceSwitch) || null });
    return ok;
  };
}

/* ---- output plumbing: everything goes through this so --out captures the identical text ---------- */
const BUF = [];
const say = (s) => { const line = (s === undefined ? '' : String(s)); BUF.push(line); console.log(line); };
const RULE = (c) => say(String(c || '=').repeat(100));

/* ---- find the pair ------------------------------------------------------------------------------ */
const arm = G.ARM_BY_ID.get(ARM_ID);
if (!arm) {
  console.error('NO SUCH ARM "' + ARM_ID + '". Known: ' + [...G.ARM_BY_ID.keys()].join(', '));
  process.exit(2);
}
const pairs = G.pairsFor(CONFIG);
const pair = pairs.find(p => p.tag === SEED);
if (!pair) {
  console.error('');
  console.error('SEED NOT IN THIS POOL — the game was NOT replayed and nothing below is about it.');
  console.error('  asked for : ' + SEED);
  console.error('  config    : ' + CONFIG + '   pairs available: ' + pairs.length);
  console.error('');
  console.error('`diff_swarm` picks teams by a STRIDE over the corpus, so --games decides WHICH teams');
  console.error('get paired. The artifact resolves only at the size it was run at. data/team-pool-frozen');
  console.error('+ --games 1200 is what produced the current data/divergence-turns.json.');
  console.error('  first pairs here: ');
  for (const p of pairs.slice(0, 3)) console.error('    ' + p.tag);
  process.exit(3);
}

/* ---- play it ------------------------------------------------------------------------------------ */
/* THE WARM-UP IS WHAT MAKES THE REPLAY THE SAME GAME, AND IT WAS ADDED BECAUSE THE CHECK ABOVE WENT
 * RED FIRST. Played standalone, this game agreed for its whole length and both engines ended the
 * battle — a completely different game from the artifact's, wearing the artifact's name. The reason is
 * in `chooseAction`: candidate clicks are ranked by `covWant` (coverage counters) and then by `CLICKS`,
 * and both accumulate across the whole run. Game #12 of a run is not game #1.
 *
 * So the schedule is REPLAYED, not approximated — the same loop `game_differential.js` runs for a
 * fixed-count run: `driverReset()` at the top of the arm, configurations in `SW.out` order, at most
 * `floor(GAMES / configs)` pairs each, and for the PRIMARY arm the stones-removed CONTROL game before
 * every measured one, bracketed by `driverSnap`/`driverRestore` exactly as `playOne` brackets it. It
 * stops the instant the target pair has been played.
 *
 * `--per-config` exists because the original run's `perConfig` is `floor(GAMES / live.length)` and
 * `live` is every configuration UNLESS the run passed `--config`. This tool's own `--config` names
 * which pool to search and must not be allowed to change the arithmetic underneath it. */
const WARMUP = !has('--no-warmup');
const t0 = Date.now();
let r = null, warmedGames = 0, warmedTo = null;
if (WARMUP) {
  const cfgs = G.SW.out.map(c => c.config);
  const perConfig = Math.max(1, +arg('--per-config', String(Math.floor((+arg('--games', '45')) / cfgs.length))));
  const isPrimary = arm.id === G.PRIMARY_ARM.id;
  G.driverReset();
  outer:
  for (const cfgId of cfgs) {
    let made = 0;
    for (const pr of G.pairsFor(cfgId)) {
      if (made >= perConfig) break;
      if (isPrimary) {
        const s0 = G.driverSnap();
        G.playGame(pr.aN, pr.bN, cfgId, pr.tag + ' [stones removed]', { arm });
        G.driverRestore(s0);
        warmedGames++;
      }
      /* the choice trace is a statement about THE TARGET GAME, so it is cleared on its threshold and
       * not left holding every warm-up game's choices */
      const isTarget = (cfgId === CONFIG && pr.tag === SEED);
      if (isTarget) CHOICES.length = 0;
      const g = G.playGame(pr.a, pr.b, cfgId, pr.tag, { arm });
      warmedGames++;
      made++;
      if (isTarget) { r = g; warmedTo = cfgId + ' pair #' + made; break outer; }
    }
  }
  if (!r) {
    console.error('WARM-UP NEVER REACHED THE TARGET — it is outside this run\'s per-config budget of '
      + Math.floor((+arg('--games', '45')) / cfgs.length) + ' pairs. Raise --games or --per-config.');
    process.exit(3);
  }
} else {
  r = G.playGame(pair.a, pair.b, CONFIG, pair.tag, { arm });
}
const sdRaw = G.sdStream(G.lastSdLog());     // the authority's stream, filtered exactly as the comparator filters it
const meRaw = r.mediTrace || [];
const A = G.reduce(sdRaw), B = G.reduce(meRaw);
const div = r.div || null;

/* ---- the reproduction check --------------------------------------------------------------------- */
/* WHAT IS COMPARED AND WHY EACH ONE. `agreed_lines` is where the comparator parted; the raw line at
 * the split is WHAT parted; `end_reason` is why the loop stopped. Three independent facts — a replay
 * that matches all three played the same game, and one that matches none played a different one. */
let record = null, repro = null;
try {
  const dump = JSON.parse(fs.readFileSync(D(AGAINST), 'utf8'));
  record = (dump.divergences || []).find(x => x.seed === SEED && x.config === CONFIG && x.arm === ARM_ID) || null;
  if (record) {
    const checks = [
      ['agreed lines', record.agreed_lines, div ? div.agreedLines : null],
      ['showdown line at split', record.at.showdown_raw, div ? div.sdRaw : null],
      ['medicham line at split', record.at.medicham_raw, div ? div.meRaw : null],
      ['stop reason', record.end_reason, r.endReason],
      ['class', record.cls, div ? G.classify(div).cls : null],
    ];
    repro = { checks, ok: checks.every(c => String(c[1]) === String(c[2])), dump_generated: dump.generated,
              dump_release: dump.engine_release, dump_store: dump.team_store_pinned_to };
  }
} catch (e) { record = null; repro = { error: String((e && e.message) || e) }; }

/* ---- header ------------------------------------------------------------------------------------- */
RULE('=');
say('ONE GAME, BOTH ENGINES, EVERY LINE   —   a debugging view. Nothing here is written to an artifact.');
RULE('=');
say('  seed      ' + SEED);
say('  config    ' + CONFIG + '        arm  ' + ARM_ID + '   (' + String(arm.what || '').slice(0, 60) + '…)');
say('  release   ' + G.REL.id + '      showdown ' + (process.env.SHOWDOWN_PATH || '?'));
say('  turns     ' + r.turns + '   medicham raw lines ' + meRaw.length + '   showdown raw lines ' + sdRaw.length);
say('  reduced   showdown ' + A.lines.length + '   medicham ' + B.lines.length
    + '   (the comparator walks the REDUCED streams index by index)');
say('  stopped   ' + r.endReason + '     showdown ended the battle: ' + (r.endedSd ? 'YES' : 'no')
    + '     medicham2 ended the battle: ' + (r.endedMedi ? 'YES' : 'no'));
say('  played in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'
    + (WARMUP ? '   after replaying the run\'s schedule: ' + warmedGames + ' games to reach ' + warmedTo
              : '   NO WARM-UP (--no-warmup): the driver\'s coverage counters started at zero'));
say('');

RULE('-');
if (!record) {
  say('  NO STORED RECORD of this game in ' + AGAINST + ' — so this replay is UNCHECKED.');
  say('  It is a real game. It is not, and must not be reported as, the game in the artifact.');
} else if (repro && repro.ok) {
  say('  REPRODUCED — every stored field of this game matches the replay.');
  say('  (' + AGAINST + ', generated ' + repro.dump_generated + ', release ' + repro.dump_release
      + ', store ' + repro.dump_store + ')');
} else {
  say('  *** NOT REPRODUCED — THIS IS A DIFFERENT GAME FROM THE ONE IN THE ARTIFACT. ***');
  say('  The driver ranks clicks by coverage counters that accumulate across a whole run; a replay in');
  say('  a fresh process starts them at zero. Read the mismatches below before believing anything.');
}
if (repro && repro.checks) {
  for (const [what, want, got] of repro.checks) {
    const ok = String(want) === String(got);
    say('     ' + (ok ? 'ok  ' : 'DIFF') + '  ' + String(what).padEnd(24)
        + ' artifact: ' + String(want).slice(0, 60));
    if (!ok) say('              ' + ' '.repeat(24) + ' replay  : ' + String(got).slice(0, 60));
  }
}
RULE('-');
say('');

/* ---- the two teams, as built --------------------------------------------------------------------- */
/* THE MAX HP IS THE WHOLE POINT OF PRINTING THIS. A card that says `35/135` cannot tell a reader
 * whether that body has been chipped or is simply small, and "why is there a damaged Pelipper" is
 * exactly that question. Read off the BUILT body, which is what both engines were handed. */
const teamBlock = (label, team) => {
  say('  ' + label);
  team.forEach((x, i) => {
    const s = x.spec || {}, m = x.medi || {};
    const st = m.st || {};
    const maxhp = m.maxHP != null ? m.maxHP : (m.curHP != null ? m.curHP : (st.hp != null ? st.hp : '?'));
    say('    ' + (i + 1) + '. ' + String(s.key || '?').padEnd(16)
        + ' hp ' + String(maxhp).padStart(4)
        + '  spe ' + String(st.sp != null ? st.sp : '?').padStart(4)
        + '  ' + String(s.item || '(no item)').padEnd(14)
        + '  ' + String(s.ability || '(no ability)').padEnd(16)
        + '  ' + (s.moves || []).join(', '));
  });
};
RULE('-');
say('  THE TWO TEAMS AS BUILT (four bodies each; the battle brings all four)');
RULE('-');
teamBlock('P1 — "yours"', pair.a);
say('');
teamBlock('P2 — "theirs"', pair.b);
say('');

/* ---- the aligned, glossed stream ------------------------------------------------------------------ */
/* ALIGNED ON THE REDUCED STREAMS, because that is the alignment the comparator actually makes; the
 * RAW line is what is PRINTED, because the raw form is what has to be fixed. Where the two engines
 * agree the line is printed ONCE, marked `both` — 128 identical pairs printed twice is the illegible
 * dump Will has already rejected twice. Where they differ, both are printed and the split is
 * unmissable. Beyond the end of one stream the other continues alone and is labelled. */
const nothing = '— nothing further —';
const sdAt = (i) => (i < A.rawIdx.length ? sdRaw[A.rawIdx[i]] : null);
const meAt = (i) => (i < B.rawIdx.length ? meRaw[B.rawIdx[i]] : null);
const splitIdx = div ? div.agreedLines : null;

RULE('=');
say('  THE GAME, LINE BY LINE.   SD = Pokemon Showdown (the authority).   US = medicham2.');
say('  `both` means the two engines emitted the same thing at that index. The raw protocol for the');
say('  whole game is printed in full further down; this half is the reading view.');
RULE('=');
say('');

const occBoth = {};
const N = Math.max(A.lines.length, B.lines.length);
let printedSplit = false;
for (let i = 0; i < N; i++) {
  const sl = sdAt(i), ml = meAt(i);
  const same = (i < A.lines.length && i < B.lines.length && A.lines[i] === B.lines[i]);
  const n = String(i).padStart(4, '0');
  if (same) {
    const g = W.glossText(sl, occBoth);
    /* a turn header gets air around it, because a wall of lines with no turn boundary is unreadable */
    if (/^\|turn\|/.test(String(sl))) { say(''); say('  ' + n + '  ---- ' + g + ' ' + '-'.repeat(60)); }
    else say('  ' + n + '  both  ' + g);
    continue;
  }
  if (!printedSplit) {
    printedSplit = true;
    say('');
    RULE('>');
    say('  >>>>  THE SPLIT — index ' + i + '. They agreed for ' + i + ' reduced lines.  <<<<');
    if (div) say('  >>>>  classifier: ' + G.classify(div).cls);
    RULE('>');
  }
  /* PAST THE SPLIT THE TWO ENGINES ARE TELLING DIFFERENT STORIES, so the occupancy table has to fork:
   * feeding both panels one table produced "Gholdengo replacing Gholdengo" in divergence_cards.js and
   * Will read it as an engine defect. Two tables, seeded from the shared one at the split. */
  if (!occBoth._forked) { occBoth._forked = { sd: { ...occBoth }, me: { ...occBoth } }; }
  const f = occBoth._forked;
  say('  ' + n + '  SD    ' + (sl == null ? nothing : W.glossText(sl, f.sd)));
  say('  ' + '    ' + '  US    ' + (ml == null ? nothing : W.glossText(ml, f.me)));
}
if (!printedSplit) say('  (the two streams never parted)');
say('');

/* ---- where each engine thought it stood when the game stopped ------------------------------------ */
RULE('=');
say('  WHAT EACH ENGINE WAS HOLDING WHEN THE GAME STOPPED');
say('  Same question asked of both: every body, is it fainted, at what HP, active or benched.');
RULE('=');
const fr = r.finalRoster || {};
if (fr.failed) say('  ROSTER UNAVAILABLE: ' + fr.failed);
else {
  for (const side of ['p1', 'p2']) {
    say('');
    say('  ---- ' + side.toUpperCase() + ' ' + (side === 'p1' ? '("yours")' : '("theirs")') + ' '
        + '-'.repeat(60));
    const sd = (fr.showdown && fr.showdown[side]) || null;
    const me = (fr.medicham && fr.medicham[side]) || [];
    say('    SHOWDOWN   pokemonLeft=' + (sd ? sd.pokemonLeft : '?') + '  teamSize=' + (sd ? sd.teamSize : '?')
        + '     (pokemonLeft is the number checkWin actually reads)');
    /* THE SAME ANNOTATION ON BOTH HALVES — 2026-08-27, ROADMAP #344. It used to hang off the
     * MEDICHAM rows only, against a showdown column that answered `where` from `p.isActive` rather
     * than from membership of `side.active`. A corpse awaiting its replacement is in the slot in
     * BOTH engines, so the old layout showed an alarm beside one engine and a clean row beside the
     * other for behaviour they agree on, and that is what ROADMAP #344 was written from. Both
     * columns now read membership; `isActive` is printed beside it because it is a real fact about
     * the authority and has no counterpart here. A corpse in a slot is NORMAL — it is how both
     * engines carry a body between its faint and its replacement — so the note says so. */
    const slotNote = m => (m.fainted && m.where === 'active')
      ? '   <- corpse in the slot, awaiting its replacement (both engines do this)' : '';
    for (const m of (sd ? sd.mons : [])) {
      say('      ' + String(m.name).padEnd(18) + ' hp ' + String(m.hp).padStart(4)
          + '  ' + (m.fainted ? 'FAINTED' : 'alive  ') + '  ' + String(m.where).padEnd(6)
          + (m.isActive === undefined ? '' : ' isActive=' + (m.isActive ? 'yes' : 'no ')) + slotNote(m));
    }
    say('    MEDICHAM2  (this snapshot lists actives then bench; a fainted body it has DISCARDED');
    say('               does not appear at all, so a missing row is not evidence of anything)');
    for (const m of me) {
      say('      ' + String(m.name).padEnd(18) + ' hp ' + String(m.hp).padStart(4)
          + '  ' + (m.fainted ? 'FAINTED' : 'alive  ') + '  ' + String(m.where).padEnd(6) + slotNote(m));
    }
  }
  if (fr.showdown) say('');
  if (fr.showdown) say('    showdown winner: ' + (fr.showdown.winner == null ? '(none declared)' : fr.showdown.winner));
}
say('');

/* ---- what the harness said to the authority ------------------------------------------------------- */
if (REPAIR) {
  RULE('!');
  say('  *** --repair-forced-switch WAS ON. THIS IS AN EXPERIMENT, NOT THE GAME IN THE ARTIFACT. ***');
  say('  ' + REPAIRS.length + ' duplicate forced-switch choice(s) were rewritten at the choose() boundary:');
  for (const x of REPAIRS) say('     turn ' + x.turn + '  ' + x.side + '   "' + x.was + '"  ->  "' + x.now + '"');
  RULE('!');
  say('');
}
if (has('--trace-choices') || REPAIR) {
  RULE('=');
  say('  EVERY CHOICE THE HARNESS SENT TO SHOWDOWN, AND WHETHER SHOWDOWN TOOK IT');
  say('  A REFUSED choice emits no protocol line, so it is invisible in both streams. A refused forced');
  say('  switch is worse: game_differential.js throws on a rejected MOVE and discards the return value');
  say('  of a rejected SWITCH (:3402), so the battle just stops advancing and nothing says why.');
  RULE('=');
  for (const c of CHOICES) {
    say('  turn ' + String(c.turn).padStart(3) + '  ' + c.side + '  ' + (c.accepted ? 'ACCEPTED' : 'REFUSED ')
        + '  req ' + String(c.requestBefore).padEnd(6) + '-> ' + String(c.requestAfter).padEnd(6)
        + '  ' + (c.forceSwitch ? 'forceSwitch=[' + c.forceSwitch.map(x => x ? 'T' : 'f').join(',') + ']  ' : '')
        + '"' + c.input + '"' + (c.error ? '   ERROR: ' + c.error : ''));
  }
  const bad = CHOICES.filter(c => !c.accepted);
  say('');
  say('  ' + CHOICES.length + ' choices, ' + bad.length + ' REFUSED.'
      + (bad.length ? '   A refused choice is the harness failing to answer the authority, not the engine.' : ''));
  say('');
}

/* ---- the raw protocol, in full, both engines ------------------------------------------------------ */
/* BOTH FORMS, ALWAYS. The glossed view is what a person reads; the raw stream is what a person has to
 * go and fix, and the two have to be in the same output or the reader is back to holding a dump in one
 * hand and a translation in the other — which is the exact complaint explain_divergence.js was written
 * against. The UNFILTERED authority log is printed too: `sdStream` drops every event the comparator
 * does not claim, and a dropped line can be the whole answer. */
if (RAW) {
  const rawBlock = (title, lines, markRaw) => {
    RULE('=');
    say('  RAW PROTOCOL — ' + title + '   (' + lines.length + ' lines)');
    RULE('=');
    lines.forEach((l, i) => {
      const mark = (markRaw != null && i === markRaw) ? '  <<<<<< THE SPLIT' : '';
      say('  ' + String(i).padStart(4, '0') + '  ' + String(l) + mark);
    });
    say('');
  };
  rawBlock('SHOWDOWN, as the comparator sees it (sdStream-filtered)', sdRaw,
           div && splitIdx != null && splitIdx < A.rawIdx.length ? A.rawIdx[splitIdx] : null);
  rawBlock('MEDICHAM2 (its own trace, unfiltered)', meRaw,
           div && div.meRawIndex != null ? div.meRawIndex : null);
  rawBlock('SHOWDOWN, UNFILTERED battle.log — every line the authority emitted, including the ones the '
           + 'comparator drops', G.lastSdLog(), null);
}

RULE('=');
say('  END OF GAME. Written nowhere; re-run to regenerate.');
RULE('=');

if (OUT) {
  fs.writeFileSync(OUT, BUF.join('\n') + '\n');
  console.log('\n  also written to ' + OUT + '  (a scratch copy, not an artifact)');
}
