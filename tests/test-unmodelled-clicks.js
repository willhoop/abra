/* tests/test-unmodelled-clicks.js — ROADMAP #125. THE TERMINAL FALL-THROUGH NOW HAS A COUNTER.
 *
 *   node tests/test-unmodelled-clicks.js
 *
 * `playerActionPrimary` ends in `return {kind:'pass', mv:id}` — "this engine models no effect for that
 * click" — and for the whole life of this file that line was SILENT. A move no branch claimed became a
 * WHOLE NO-OP TURN and nothing anywhere said so. Nine of the thirteen rows the precondition layer
 * exposed on 2026-08-10 arrived through that one line, and exactly ONE of the thirteen was named by
 * any counter (`MEDFAILS.healProceduralFirst`, naming `swallow`). That is CLAUDE.md's founding failure
 * — a capability absent and everything reporting success — sitting in the exact place built to catch
 * it, which is why those moves stayed invisible until somebody pointed a probe at each one by hand.
 *
 * WHAT THIS FILE ASSERTS, and it is deliberately not "the number is zero":
 *
 *   1. THE COUNTER IS WIRED. A move that lands there increments it and NAMES ITSELF. A capability that
 *      cannot prove it ran is assumed broken, and this counter's whole job is to prove a FAILURE ran.
 *   2. IT DOES NOT OVER-FIRE. A modelled click adds nothing, and a BARE `{kind:'pass'}` built by a
 *      caller (the idle ally in ~200 probes, game_differential's empty slot) is not counted either —
 *      that is a legitimate no-action, and counting it would drown the signal in exactly the way a
 *      counter nobody reads is born.
 *   3. THE QUEUE IS PRINTED, WITH USAGE. The number is a QUEUE LENGTH that must fall, not a bar that
 *      must be zero today. `--list` is the whole point of the row: Will is owed the list.
 *
 * IT IS A RATCHET, NOT A GATE. The set may shrink and may never grow: a new move resolving to a no-op
 * turn is a regression however small its usage, and the file goes red on it.
 *
 * AND A RED RUN WRITES NOTHING. The baseline it ratchets against is the artifact it writes, so an
 * unconditional write let a failing run publish the GROWN set as the new baseline — measured on
 * 2026-08-23, the regression was caught on run 1 and was GREEN on run 2 with nothing else changed.
 * Section 4 has the demonstration and the reasoning. The write is green-only; `--accept` re-baselines
 * deliberately and says so.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

let fails = 0;
const ok = (c, label, detail) => {
  console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? '   ' + detail : ''));
  if (!c) fails++;
};

console.log('UNMODELLED CLICKS — the terminal fall-through of the classifier (ROADMAP #125)\n');

const mk = (s) => { const b = M.buildMon(s, {}); b.item = ''; b.ability = 'none'; return b; };
const me = mk('garchomp'), ally = mk('skeledirge'), f1 = mk('incineroar'), f2 = mk('farigiraf');
const S = M.battleInit([me, ally], [f1, f2], { seeded: true });

/* ---- 1. THE SWEEP ------------------------------------------------------------------------------ */
const before = M.MEDFAILS.unmodelledClick;
for (const id of Object.keys(MC.moves)) {
  try { M.playerAction(me, id, f1, S.field); } catch (e) { /* a throw is a different defect */ }
}
const by = M.MEDFAILS.unmodelledClickBy;
const rows = Object.keys(by).map(id => ({ id, uses: ((TAGS.moves[id] || {}).uses) || 0 }))
  .sort((a, b) => b.uses - a.uses || a.id.localeCompare(b.id));
const clicks = rows.reduce((s, r) => s + r.uses, 0);

console.log('  THE LIST — every move in this format that resolves to a whole no-op turn:');
for (const r of rows) console.log('    ' + String(r.uses).padStart(6) + '  ' + r.id);
console.log('    ' + String(clicks).padStart(6) + '  TOTAL over ' + rows.length + ' move(s)\n');

ok(M.MEDFAILS.unmodelledClick > before, 'the counter fires at all',
   before + ' -> ' + M.MEDFAILS.unmodelledClick);
ok(!!M.MEDFAILS.unmodelledClickFirst, 'and it names its first offender',
   M.MEDFAILS.unmodelledClickFirst);
ok(rows.length > 0 && rows.every(r => !!MC.moves[r.id]),
   'every id it recorded is a real move in the compact table');

/* ---- 2. IT DOES NOT OVER-FIRE ------------------------------------------------------------------- */
{
  const n0 = M.MEDFAILS.unmodelledClick;
  M.playerAction(me, 'earthquake', f1, S.field);
  M.playerAction(me, 'protect', null, S.field);
  M.playerAction(me, 'swordsdance', null, S.field);
  ok(M.MEDFAILS.unmodelledClick === n0, 'a MODELLED click adds nothing',
     'earthquake / protect / swordsdance');
}
{
  /* A caller-built bare pass carries no `mv`, so `playerAction` is never involved and nothing is
   * counted. Asserted through the real classifier with an empty id, which is the same road. */
  const n0 = M.MEDFAILS.unmodelledClick;
  const a = M.playerAction(me, '', f1, S.field);
  ok(a && a.kind === 'pass' && M.MEDFAILS.unmodelledClick === n0,
     'a BARE pass with no move id is not counted', 'kind=' + (a && a.kind));
}

/* ---- 3. THE RATCHET ----------------------------------------------------------------------------- */
const OUT = D('data', 'unmodelled-clicks.json');
let prev = null, prevErr = null;
/* AN ABSENT BASELINE AND AN UNREADABLE ONE ARE DIFFERENT ANSWERS. Both used to land in `prev = null`,
 * which skips the did-not-GROW comparison and lets the run pass — a ratchet that stops ratcheting
 * without a word, which is section 4's own failure arriving through the read instead of the write.
 * ENOENT is the honest first run; anything else is a fault and is reported below. */
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); }
catch (e) { prev = null; if (e.code !== 'ENOENT') prevErr = e; }
let moved = false;                                   /* did the ratchet actually TIGHTEN this run? */
if (prev && Array.isArray(prev.moves)) {
  const grew = rows.map(r => r.id).filter(id => prev.moves.indexOf(id) < 0);
  ok(grew.length === 0,
     'the set did not GROW — a new no-op turn is a regression however small its usage',
     grew.length ? 'NEW: ' + grew.join(', ') : prev.moves.length + ' -> ' + rows.length);
  if (rows.length < prev.moves.length) {
    console.log('  note  the queue SHRANK ' + prev.moves.length + ' -> ' + rows.length + ': '
      + prev.moves.filter(id => rows.every(r => r.id !== id)).join(', '));
  }
  /* Compared as the ORDERED id list: both sides are sorted by uses desc then id, so a reordering is a
   * real change in the usage table and is worth recording. Compared as ids, never as row objects — the
   * first draft of this line compared a string id against a row OBJECT, which is unequal every time and
   * would have made `moved` permanently true, quietly restoring the churn it exists to stop. */
  moved = prev.moves.join('|') !== rows.map(r => r.id).join('|');
} else if (prevErr) {
  ok(false, 'the baseline on disk is READABLE — an unreadable one silently skips the did-not-GROW '
     + 'comparison and passes the run',
     OUT + ': ' + (prevErr.code || '') + ' ' + ((prevErr && prevErr.message) || prevErr));
  moved = false;                                     /* and it is NOT overwritten while unreadable */
} else {
  console.log('  note  no baseline on disk — this run writes the first one.');
  moved = true;
}

/* ---- 4. THE WRITE IS GREEN-ONLY, AND THAT IS THE WHOLE POINT OF THE FILE ------------------------ *
 *
 * THIS WRITE USED TO BE UNCONDITIONAL, AND IT DESTROYED THE RATCHET IN EXACTLY ONE RUN. Measured
 * 2026-08-23, by removing `healbell` from the baseline on disk so the live set appeared to have grown:
 *
 *   run 1   FAIL  the set did not GROW ... NEW: healbell        exit 1   <- the ratchet works
 *           wrote data/unmodelled-clicks.json                            <- ...and eats its own finding
 *   run 2   ok    the set did not GROW ... 3 -> 3               exit 0   <- the regression is now BASELINE
 *
 * Nothing else changed between those two runs. A red run published the GROWN set as the new baseline,
 * so the second run — the one a person naturally does after seeing a red test — was green, and
 * `healbell` was accepted forever. A ratchet that launders the regression it just caught is worse than
 * no ratchet: it reports the defect once, to a scrollback nobody kept, and then certifies its absence.
 *
 * That is CLAUDE.md's founding failure in the instrument rather than the engine — a capability absent
 * and everything reporting success — and it is the same shape as the torn read that produced `344
 * attributed games` where the settled artifact had 450: a well-formed, plausible, current-looking file
 * from a run that did not pass.
 *
 * SO: WRITE ONLY ON GREEN. No `void: true` half-measure. engine/provenance.js does honour a
 * self-declared `void` (and this artifact declares no run status at all, which is how a red-run write
 * read as `ok` to it) — but a void declaration is for a run that was INVALIDATED BY SOMETHING ELSE and
 * still has to publish. A failing check has no such obligation: it can simply not write, and then no
 * consumer needs to know how to refuse it. Writing `void: true` here would also trip provenance's void
 * RATCHET on every red run, which fails a second gate to paper over this one.
 *
 * AND WRITE ONLY WHEN THE SET MOVED. A green run that changed nothing rewrote `generated` and left the
 * tree dirty; three commits on 2026-08-23 — 086dd25, 4383241, 483f529 — were cleanups after that exact
 * churn in the neighbouring docs gate. A timestamp is not a finding.
 *
 * Green-only + monotone is what .githooks/pre-commit already relies on to stage a moved ratchet safely,
 * so this file now satisfies the property that hook documents rather than contradicting it.
 *
 * RE-BASELINING IS EXPLICIT, NEVER AUTOMATIC. If a new no-op turn is genuinely ACCEPTED — a move
 * arrives in the format that this engine will not model yet — run with `--accept`. It is loud, it is a
 * human decision, and it is the repo's existing idiom (tests/test-rulebook-collision.js `--update`).
 * What may not exist is a path where a regression enters the baseline because nobody typed anything.
 *
 * THIS FIX IS A PROPERTY, NOT A LIST. The rule is "a check writes nothing unless it passed", enforced
 * by the control flow above rather than by naming the artifact or the moves. A new offender, a renamed
 * artifact, or a check added below all inherit it. There is deliberately no list of known-bad move ids
 * anywhere in this file — a ratchet written as a list of wrong forms cannot catch a new wrong form, and
 * this repository has paid for that three times.
 */
const ACCEPT = process.argv.includes('--accept');
if (fails && ACCEPT) {
  console.log('\n  --accept: RE-BASELINING A RED RUN, BY EXPLICIT REQUEST.');
  console.log('    This records the CURRENT set as the accepted one, including anything new above.');
  console.log('    If you did not mean to accept a new no-op turn, do not do this.');
}
const willWrite = (!fails || ACCEPT) && (moved || ACCEPT);
if (willWrite) {
  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString(), by: 'tests/test-unmodelled-clicks.js',
    what: 'Every move in gen9championsvgc2026regmb whose click resolves to {kind:"pass"} — a whole '
        + 'no-op turn. RATCHETED: the set may shrink and may never grow.',
    write_policy: 'Written ONLY by a run that PASSED (or by an explicit --accept). A failing run '
        + 'leaves the previous baseline untouched, so a regression can never be laundered into the '
        + 'set that defines it. See section 4 of tests/test-unmodelled-clicks.js.',
    accepted_from_red_run: (fails && ACCEPT) ? true : undefined,
    count: rows.length, clicks, moves: rows.map(r => r.id), rows,
  }, null, 1) + '\n');
  console.log('\n  wrote data/unmodelled-clicks.json' + (moved ? ' — the set moved' : ''));
} else if (fails) {
  console.log('\n  DID NOT WRITE data/unmodelled-clicks.json — this run FAILED.');
  console.log('    The baseline on disk is left exactly as it was, so the next run asks the same');
  console.log('    question and gets the same red. Re-running does not make this pass.');
  console.log('    To accept the current set deliberately:  node tests/test-unmodelled-clicks.js --accept');
} else {
  console.log('\n  data/unmodelled-clicks.json unchanged — the set did not move, so nothing was rewritten.');
}
console.log(fails ? '\nUNMODELLED CLICKS: ' + fails + ' FAILED' : '\nUNMODELLED CLICKS: all checks passed');
process.exitCode = fails ? 1 : 0;
