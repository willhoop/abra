/* click_census.js — how many of the human actions we fit on are actually clicks?
 *
 *   SHOWDOWN_PATH=... node engine/click_census.js [--games=N]  ->  data/click-censoring-census.json
 *
 * docs/CLICK-CENSORING-FIX.md Stage A. Every human action in the fit corpus is labelled
 * CLEAN / PARTIAL / COERCED / ERASED, and the per-mechanism counts are published so that the two
 * budgets in data/degradation-budgets.json can be RE-DERIVED from them rather than argued about.
 *
 * TWO ARMS, AND THE SECOND ONE IS THE POINT
 * -----------------------------------------
 * ARM 1 — THE EVENT STREAM. engine/click_class.js reads `g.turns[].ev`, which every corpus game has.
 *   Coverage 100%. It is what engine/fit_policy.js and engine/joint_rows.js actually consume, so
 *   these are the numbers that describe the fit.
 *
 * ARM 2 — THE RAW PROTOCOL. The store keeps `data/games.*.raw-logs.jsonl`, which carries the
 *   annotations the extractor throws away: `|cant|`, `|drag|`, `|-start|...|Encore`. Coverage is
 *   NOT 100% — `data/games.ots.jsonl` is an external archive with no raw log beside it — and the
 *   measured figure is published rather than assumed. Arm 2 does two jobs:
 *
 *     (a) it is the GROUND TRUTH for arm 1. A classifier that has only ever been run on the data it
 *         was written against is an assertion. Arm 1's per-turn detections are scored against arm 2's
 *         per-turn protocol lines, and the recall and precision are published.
 *     (b) it measures the classes arm 1 CANNOT SEE AT ALL, because engine/durable-ingest.js emits no
 *         event for them. That is the honest size of what is still missing.
 *
 * WHAT ARM 2 FOUND, AND WHY IT IS NOT LANDED — READ THIS BEFORE "FIXING" IT
 * ------------------------------------------------------------------------
 * Will's named case is a Fake Out into a switched-in Farigiraf's Armor Tail. The protocol writes:
 *
 *     |cant|p1a: Farigiraf|ability: Armor Tail|Aqua Jet|[of] p2b: Basculegion
 *
 * The blocker is named first, the MOVE is named, and `[of]` names the ATTACKER — so the intended
 * SLOT survives and the class is PARTIAL, not ERASED: user and move are exact, and the target is
 * ambiguous only between the blocker and its ally, because Armor Tail only blocks moves aimed at
 * that side. The same is true of the whole `onDisableMove` family: `|cant|p2b: Sinistcha|Disable|
 * Trick Room` states the click outright.
 *
 * Those clicks are recoverable and they are NOT recovered here, deliberately. They exist only in the
 * raw logs, the raw logs cover a MEASURED 66.17% of the fit corpus, and the missing third is one specific
 * source. Recovering them would add outplayed turns from `games.bo3` and `games.ladder` and none
 * from `games.ots`, which reweights the sample by store — a corpus change wearing a bug fix's
 * clothes. The count is published so the trade is visible; landing it needs the ots archive
 * re-ingested with its logs, which is OPS work and not a MEASURE decision.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');
const CC = require('./click_class.js');
const DI = require('./durable-ingest.js');
const B = require('./board.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

/* WHAT CONTENT THIS WAS COMPUTED FROM. engine/provenance.js ratchets on artifacts that can only be
 * checked by mtime, and mtime cannot tell a rebuild from a rewrite — an artifact newer than an input
 * it never read reads as `ok`. Stamped here so this file is checkable rather than assumed. */
const crypto = require('crypto');
const sha12 = require('./engine_release.js').sha12;   /* ONE implementation — the local copy returned null on an unreadable file, so two nulls compared EQUAL and a stamp could certify itself. See the comment on sha12 in engine_release.js. */
const SOURCES = ['engine/click_class.js', 'engine/click_match.js', 'engine/fit_policy.js',
  'engine/board.js', 'engine/durable-ingest.js', 'engine/medicham2-browser.js',
  'data/tags.json', 'data/engine-data.js'];
const norm = B.norm, base = B.baseSpecies;
const LIMIT = (() => { const a = process.argv.find(s => s.startsWith('--games=')); return a ? +a.slice(8) : 0; })();

/* SCOPE IS EXPLICIT BECAUSE INHERITING IT IS THE BUG. This census's whole point is that it reads
 * EVERY stored game while the fit reads only the open-sheet slice -- docs/MODELS.md says so in
 * words. On 2026-08-06 a change to loadCorpus's DEFAULT (ROADMAP #65) silently narrowed this from
 * 9,230 games to 6,675, and nothing failed: the census ran, wrote a smaller artifact, and the
 * documents quoting the old figures went stale. Caught only by test-docs-current, and only because
 * a doc happened to cite a number the new artifact no longer contained. THIS IS ROADMAP #73 --
 * make the scope required at all 46 call sites -- arriving as a live regression rather than a
 * hypothetical. */
const { games: allGames } = FP.loadCorpus({ scope: 'all' });
const games = LIMIT ? allGames.slice(0, LIMIT) : allGames;
console.log(`CLICK CENSORING CENSUS — ${games.length.toLocaleString()} clean open-sheet games` +
  (LIMIT ? ` (of ${allGames.length.toLocaleString()}; --games=${LIMIT})` : '') + '\n');

/* ---------------------------------------------------------------------------------------------
 * ARM 1 — the event stream, through the path the fit actually uses
 * ------------------------------------------------------------------------------------------- */
const tally = { seen: 0, kept: 0, noUser: 0, noSheet: 0, trivial: 0, unmatched: 0, ambiguous: 0, coerced: 0, partial: 0 };
let partialRows = 0;
const t0 = Date.now();
for (const g of games) {
  const rows = FP.decisionsFor(g, tally);
  for (const r of rows) if (r.cset && r.cset.length > 1) partialRows++;
}
const arm1Secs = (Date.now() - t0) / 1000;
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(4) + '%';

console.log('ARM 1 — EVENT STREAM (100% of the corpus; this is what the fit consumes)\n');
console.log(`  actions seen                    ${tally.seen.toLocaleString()}`);
console.log(`  CLEAN, fitted                   ${(tally.kept - partialRows).toLocaleString()}  ${pct(tally.kept - partialRows, tally.seen)}`);
console.log(`  PARTIAL, fitted marginally      ${partialRows.toLocaleString()}  ${pct(partialRows, tally.seen)}   ${JSON.stringify(tally.partialWhy || {})}`);
console.log(`  COERCED, removed from labels    ${tally.coerced.toLocaleString()}  ${pct(tally.coerced, tally.seen)}   ${JSON.stringify(tally.coercedWhy || {})}`);
console.log(`  dropped, not a censoring class  unmatched ${tally.unmatched.toLocaleString()}, trivial ${tally.trivial.toLocaleString()}, ` +
            `ambiguous ${tally.ambiguous.toLocaleString()}, noSheet ${tally.noSheet.toLocaleString()}, noUser ${tally.noUser.toLocaleString()}`);
console.log(`  (${arm1Secs.toFixed(0)}s)\n`);

/* ---------------------------------------------------------------------------------------------
 * ARM 2 — the raw protocol
 *
 * A turn's raw lines and a turn's `ev` come from the same text, so the comparison is per (game,
 * turn, slot) rather than per corpus total. `|-start|X|Encore` names the VICTIM slot directly, which
 * is exactly what arm 1 has to infer from a species match — so this scores the inference.
 * ------------------------------------------------------------------------------------------- */
const wantIds = new Set(games.map(g => g.id));
const RAW = ['games.ladder.raw-logs.jsonl', 'games.bo3.raw-logs.jsonl'];

const raw = {
  gamesWithLog: 0,
  unparsableLines: 0,             // torn JSONL rows — legitimate (a killed writer), counted anyway
  cantByReason: {},               // every |cant| reason, derived from the protocol's own strings
  erasedActions: 0,               // flinch / slp / par / frz — the click is unrecoverable
  notADecision: 0,                // recharge — the player was never offered a menu
  recoverableClicks: 0,           // |cant| lines that NAME the attempted move
  recoverableByReason: {},
  priorityBlocked: 0,             // the Armor Tail family: user + move exact, target ambiguous x2
  priorityBlockedNamesAttacker: 0,
  dragLines: 0,
  encoreStarts: 0,
  /* ---- A FOURTH THING, FOUND ON THE WAY: THE MENU SHRINKS AND THE FIT DOES NOT KNOW ----------
   * `engine/board.js`'s `candidates()` narrows the choice set for a CHOICE ITEM — derived from the
   * dex's `isChoice`, with a comment that says exactly why: "that is not a scoring error, it is a
   * WRONG DENOMINATOR. A conditional logit divides by the sum over the choice set."
   *
   * It does nothing about the OTHER family that shrinks a menu. Encore leaves one legal move for
   * three turns; Taunt removes every status move; Disable, Torment, Throat Chop, Heal Block and
   * Imprison each remove some. Those are precisely `onDisableMove` in the running format, which is
   * the same derivation `menuSeal` already publishes above. So the fit prices a human who had ONE
   * option as though they had chosen it over nine.
   *
   * This is NOT the censoring fix — the LABEL is right on these turns, it is the DENOMINATOR that is
   * wrong — and it is not landed here, because narrowing the menu changes every feature row and owes
   * its own refit. It is counted so the decision has a size attached to it. */
  sealedActions: 0,
  sealedByVolatile: {},
  actionsSeenInLog: 0,
};
/* The protocol's own name for each seal, mapped to nothing: the KEY is whatever `|-start|` wrote,
 * so a new sealing volatile is counted without an edit here. What decides that a volatile is a seal
 * is engine/click_class.js's `menuSeal` set, read from the format. */
/* Per-turn agreement between the two arms. */
const agree = { encore: { truth: 0, found: 0, hit: 0 }, drag: { truth: 0, found: 0, hit: 0 } };
const examples = {};

function slotOf(s) { const m = /^(p[12][ab]):/.exec(s || ''); return m ? m[1] : null; }

async function arm2() {
  for (const f of RAW) {
    const p = D('data', f);
    if (!fs.existsSync(p)) continue;
    const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const m = /^\{"id":"([^"]+)"/.exec(line);
      if (!m || !wantIds.has(m[1])) continue;
      /* A torn JSONL line is legitimate silence — the store is append-only and a killed writer can
       * leave half a row. But "legitimate" is not "uninteresting": counted, so a store that starts
       * shedding rows shows up as a number rather than as a quietly smaller corpus. */
      let j; try { j = JSON.parse(line); } catch (tornLine) { raw.unparsableLines++; continue; }
      raw.gamesWithLog++;
      scoreGame(j.id, j.log || '');
    }
  }
}

/* Which `|-start|` volatile names correspond to the format's own onDisableMove moves. Built once,
 * from the mechanism set, by matching the protocol's spelling against the move's name/id — never a
 * typed table. `|-start|p1a: X|move: Taunt` and `|-start|p1a: X|Encore` are both spellings the
 * server uses, so the comparison is on the normalised tail. */
let SEAL_NAMES = null;
function sealNames() {
  if (SEAL_NAMES) return SEAL_NAMES;
  const M = CC.mechanisms(dex);
  SEAL_NAMES = new Set();
  for (const id of M.menuSealMoves) {
    SEAL_NAMES.add(id);
    const mv = dex.moves.get(id);
    if (mv && mv.exists) SEAL_NAMES.add(norm(mv.name));
  }
  return SEAL_NAMES;
}
const sealKey = (s) => norm(String(s || '').replace(/^move:\s*/, ''));

function scoreGame(id, log) {
  /* Split the raw text into turns the same way engine/durable-ingest.js does, so a turn index here
   * and a turn index there are the same turn. */
  const lines = log.split('\n');
  const turns = [];
  let cur = null;
  for (const L of lines) {
    if (/^\|turn\|\d+/.test(L)) { cur = { n: +L.split('|')[2], lines: [] }; turns.push(cur); continue; }
    if (cur) cur.lines.push(L);
  }
  const g = DI.extract(id, 0, log);
  const evByTurn = new Map();
  for (const t of g.turns || []) evByTurn.set(t.n, t.ev || []);

  /* Active menu-seal volatiles per slot, carried ACROSS turns, cleared on switch/drag because a
   * volatile belongs to the Pokemon and not to the slot. Read straight off `|-start|` / `|-end|`. */
  const seals = Object.create(null);
  const SEALS = sealNames();

  for (const t of turns) {
    const ev = evByTurn.get(t.n) || [];
    const found = CC.coercedSlots(ev, dex);

    /* ---- truth from the protocol ---------------------------------------------------------- */
    const truthDrag = new Set(), truthEncore = new Set();
    for (let i = 0; i < t.lines.length; i++) {
      const L = t.lines[i];
      const p = L.split('|');
      /* ---- the menu-seal ledger, maintained in the same pass ------------------------------- */
      if (L.startsWith('|switch|') || L.startsWith('|drag|') || L.startsWith('|replace|')) {
        const s = slotOf(p[2]); if (s) delete seals[s];
      } else if (L.startsWith('|-start|')) {
        const s = slotOf(p[2]), k = sealKey(p[3]);
        if (s && SEALS.has(k)) { (seals[s] || (seals[s] = new Set())).add(k); }
      } else if (L.startsWith('|-end|')) {
        const s = slotOf(p[2]), k = sealKey(p[3]);
        if (s && seals[s]) seals[s].delete(k);
      } else if (L.startsWith('|move|')) {
        const s = slotOf(p[2]);
        raw.actionsSeenInLog++;
        if (s && seals[s] && seals[s].size) {
          raw.sealedActions++;
          for (const k of seals[s]) raw.sealedByVolatile[k] = (raw.sealedByVolatile[k] || 0) + 1;
        }
      }
      if (L.startsWith('|drag|')) {
        raw.dragLines++;
        const s = slotOf(p[2]); if (s) truthDrag.add(s);
        if (!examples.drag) examples.drag = L;
      } else if (L.startsWith('|-start|') && /\|Encore$/.test(L)) {
        raw.encoreStarts++;
        const s = slotOf(p[2]);
        /* An Encore only OVERRIDES this turn if the victim had not moved yet — which in a resolved
         * log is "a |move| line for that slot appears later in the turn". */
        if (s) for (let k = i + 1; k < t.lines.length; k++) {
          if (t.lines[k].startsWith('|move|' + s + ':')) { truthEncore.add(s); break; }
        }
        if (!examples.encore) examples.encore = L;
      } else if (L.startsWith('|cant|')) {
        const s = slotOf(p[2]);
        const reason = p[3] || '';
        const attempted = p[4] || '';
        raw.cantByReason[reason] = (raw.cantByReason[reason] || 0) + 1;
        if (!examples['cant:' + reason]) examples['cant:' + reason] = L;
        if (/^ability: /.test(reason)) {
          /* The onFoeTryMove family. `|cant|BLOCKER|ability: X|MOVE|[of] ATTACKER` — the blocker is
           * named first, the attempted MOVE is named, and [of] names the ATTACKER, so the intended
           * slot survives. PARTIAL over the blocker's side, never ERASED. Measured, not assumed. */
          raw.priorityBlocked++;
          if (/\[of\] p[12][ab]:/.test(L)) raw.priorityBlockedNamesAttacker++;
        } else if (attempted) {
          /* Disable / Taunt / Imprison / Throat Chop: the click is stated outright. Recoverable and
           * deliberately NOT recovered — see the header. */
          raw.recoverableClicks++;
          raw.recoverableByReason[reason] = (raw.recoverableByReason[reason] || 0) + 1;
        } else if (reason === 'recharge') {
          raw.notADecision++;
        } else {
          raw.erasedActions++;
        }
        void s;
      }
    }

    /* ---- score arm 1 against it ------------------------------------------------------------ */
    const foundDrag = new Set(), foundEnc = new Set();
    for (const [slot, c] of found) (c.why === 'draggedIn' ? foundDrag : foundEnc).add(slot);
    for (const [k, T, F] of [['encore', truthEncore, foundEnc], ['drag', truthDrag, foundDrag]]) {
      agree[k].truth += T.size;
      agree[k].found += F.size;
      for (const s of F) if (T.has(s)) agree[k].hit++;
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * REPORT + ARTIFACT
 * ------------------------------------------------------------------------------------------- */
arm2().then(() => {
  const M = CC.mechanisms(dex);
  const cov = raw.gamesWithLog / Math.max(1, games.length);
  console.log('ARM 2 — RAW PROTOCOL (ground truth, partial coverage)\n');
  console.log(`  corpus games with a raw log     ${raw.gamesWithLog.toLocaleString()} of ${games.length.toLocaleString()}  (${(100 * cov).toFixed(2)}%)`);
  console.log(`  |cant| by reason                ${JSON.stringify(raw.cantByReason)}`);
  console.log(`  ERASED (click unrecoverable)    ${raw.erasedActions.toLocaleString()}`);
  console.log(`  not a decision (recharge)       ${raw.notADecision.toLocaleString()}`);
  console.log(`  RECOVERABLE clicks not taken    ${raw.recoverableClicks.toLocaleString()}   ${JSON.stringify(raw.recoverableByReason)}`);
  console.log(`  priority-blocked (Armor Tail)   ${raw.priorityBlocked.toLocaleString()}, of which the line names the attacker: ` +
              `${raw.priorityBlockedNamesAttacker.toLocaleString()} (${pct(raw.priorityBlockedNamesAttacker, raw.priorityBlocked)})`);
  console.log(`  WRONG DENOMINATOR, not a label  ${raw.sealedActions.toLocaleString()} of ${raw.actionsSeenInLog.toLocaleString()} logged actions ` +
              `(${pct(raw.sealedActions, raw.actionsSeenInLog)}) were taken with a menu-sealing volatile up ` +
              `${JSON.stringify(raw.sealedByVolatile)} — board.js narrows for a Choice item and not for these`);
  console.log('');
  console.log('  DOES ARM 1 FIND WHAT THE PROTOCOL SAYS IS THERE?\n');
  for (const k of ['encore', 'drag']) {
    const a = agree[k];
    console.log(`    ${k.padEnd(8)} protocol says ${String(a.truth).padStart(6)}   arm 1 flagged ${String(a.found).padStart(6)}   ` +
      `both ${String(a.hit).padStart(6)}   recall ${pct(a.hit, a.truth)}   precision ${pct(a.hit, a.found)}`);
  }

  const out = {
    generated: new Date().toISOString(),
    source: 'engine/click_census.js',
    source_digests: SOURCES.reduce((o, f) => (o[f] = sha12(D(f)), o), {}),
    what: 'Every human action in the fit corpus labelled CLEAN / PARTIAL / COERCED / ERASED. '
        + 'docs/CLICK-CENSORING-FIX.md Stage A.',
    corpus: { games: games.length, games_requested: LIMIT || null, of_total: allGames.length },
    /* The mechanism sets, PUBLISHED, because they are derived from the running format and a reader
     * has no other way to check that they were not typed. */
    mechanisms: {
      derivation: 'moves with condition.onOverrideAction; moves with forceSwitch; abilities with '
                + 'onFoeTryMove; items assigning switchFlag/forceSwitchFlag; data/tags.json '
                + '`redirects` and `redirectsType`. Nothing here is a literal list.',
      actionOverride: [...M.overrideMoves],
      forcedSwitch: [...M.forceSwitchMoves],
      menuSeal: [...M.menuSealMoves],
      priorityBlock: [...M.priorityBlockAbilities],
      redirect: [...M.redirectMoves],
      redirectByAbility: M.redirectAbility,
      forcedSwitchItems_legal: [...M.forceSwitchItems],
      forcedSwitchItems_banned_in_this_format: [...M.forceSwitchItemsBanned],
    },
    event_stream_arm: {
      coverage: 1,
      actions_seen: tally.seen,
      clean: tally.kept - partialRows,
      partial: partialRows,
      partial_why: tally.partialWhy || {},
      partial_by: tally.partialBy || {},
      partial_set_size: tally.partialSetSize || {},
      partial_degenerate: tally.partialDegenerate || 0,
      coerced: tally.coerced,
      coerced_why: tally.coercedWhy || {},
      coerced_by: tally.coercedBy || {},
      other_drops: { unmatched: tally.unmatched, trivial: tally.trivial, ambiguous: tally.ambiguous,
                     noSheet: tally.noSheet, noUser: tally.noUser },
      rates: {
        coerced: tally.coerced / Math.max(1, tally.seen),
        partial: partialRows / Math.max(1, tally.seen),
        unmatched: tally.unmatched / Math.max(1, tally.seen),
      },
      /* THE SHARES IN THE FORM THEY ARE REPORTED. A rate stored as a fraction and quoted as a
       * percentage is a number a reader cannot check without recomputing it, and
       * tests/test-docs-current.js counts exactly that as untraceable. An artifact should carry
       * what it publishes. */
      shares_pct: {
        clean: 100 * (tally.kept - partialRows) / Math.max(1, tally.seen),
        partial: 100 * partialRows / Math.max(1, tally.seen),
        coerced: 100 * tally.coerced / Math.max(1, tally.seen),
        unreadable: 100 * (tally.seen - tally.kept - tally.coerced) / Math.max(1, tally.seen),
      },
      seconds: +arm1Secs.toFixed(1),
    },
    raw_protocol_arm: {
      coverage: cov,
      coverage_note: 'data/games.ots.jsonl is an external archive with no raw-log file beside it. '
                   + 'The gap is one SOURCE, not a random sample, which is why the recoverable '
                   + 'clicks below are counted and not taken.',
      games_with_log: raw.gamesWithLog,
      cant_by_reason: raw.cantByReason,
      erased_actions: raw.erasedActions,
      not_a_decision_recharge: raw.notADecision,
      recoverable_clicks_not_taken: raw.recoverableClicks,
      recoverable_by_reason: raw.recoverableByReason,
      priority_blocked: raw.priorityBlocked,
      priority_blocked_naming_attacker: raw.priorityBlockedNamesAttacker,
      drag_lines: raw.dragLines,
      encore_starts: raw.encoreStarts,
      /* NOT a censoring class. The label is right on these turns; the CHOICE SET is wrong.
       * engine/board.js `candidates()` narrows for a Choice item (derived from `isChoice`) and does
       * nothing for the onDisableMove family, so a human with one legal move is priced as having
       * chosen it over nine. Counted here, deliberately not fixed: narrowing the menu moves every
       * feature row and owes its own refit. */
      menu_sealed_actions: raw.sealedActions,
      menu_sealed_by_volatile: raw.sealedByVolatile,
      actions_seen_in_log: raw.actionsSeenInLog,
      menu_sealed_rate: raw.sealedActions / Math.max(1, raw.actionsSeenInLog),
      examples,
      farigiraf_verdict:
        'PARTIAL, not ERASED. `|cant|BLOCKER|ability: Armor Tail|MOVE|[of] ATTACKER` names the '
        + 'attacker slot and the move exactly; only the target is ambiguous, and only between the '
        + 'blocker and its ally, because the ability blocks nothing aimed elsewhere. Showdown emits '
        + 'no |move| line for the blocked attempt, so the extractor produces no event and the class '
        + 'is invisible to the event-stream arm.',
    },
    agreement: agree,
    /* Recall and precision as percentages, for the same reason as `shares_pct`. */
    agreement_pct: Object.fromEntries(Object.entries(agree).map(([k, a]) => [k, {
      recall: 100 * a.hit / Math.max(1, a.truth),
      precision: 100 * a.hit / Math.max(1, a.found),
    }])),
    limits: [
      'The event-stream arm cannot see any class that leaves no event: the whole |cant| family. '
      + 'That is a property of engine/durable-ingest.js, not of the classifier.',
      'The raw-protocol arm covers ' + (100 * cov).toFixed(2) + '% of the fit corpus and the gap is '
      + 'one store, so it can validate and it cannot be fitted on without reweighting the sample.',
    ],
  };
  fs.writeFileSync(D('data', 'click-censoring-census.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('\n  -> data/click-censoring-census.json');
});
