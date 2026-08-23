/* test-no-silent-failure.js — a catch block may not discard the reason.
 *
 * WHY THIS EXISTS (whole-repo review, 2026-07-31)
 * ----------------------------------------------
 * 164 confirmed findings clustered into four habits, and the largest by far was this one: something
 * failed, the failure was caught and discarded, and a plausible-looking default was substituted. The
 * code then ran cleanly and reported success. Four of them had never worked once:
 *
 *   engine/magnemite.js    `dex` out of scope -> ReferenceError -> bare catch -> an EMPTY duration
 *                          table cached permanently. Every volatile duration in every scored game
 *                          this project has ever played was the fallback 3.
 *   engine/champions_sim.js  used fs without requiring it, so the derived-format read threw every
 *                          time and the hardcoded literal in the catch is the only path ever run.
 *   engine/ditto.js        `catch(e){ return null }` around the referee, so a missing require and an
 *                          unbuildable matchup were indistinguishable; both read as a tasteful "n/a"
 *                          while the file printed a FINAL TEAM.
 *   engine/sprt.js         (mine, written the same day) readFileSync inside a bare catch; on a
 *                          1.59 GB corpus V8 threw ERR_STRING_TOO_LONG and the tool reported "no
 *                          records read" as though the run had produced nothing.
 *
 * The last one matters most for justifying this file: it was written by someone who had just
 * finished documenting the habit. Discipline demonstrably does not prevent it. A check does.
 *
 * WHAT COUNTS AS NOT-SILENT. The body must do at least one of: rethrow, report (console.*), exit,
 * or record the failure somewhere a human or a later assertion can see (a counter, a push, an
 * assignment to something named like an error). Returning a default and saying nothing is silent.
 *
 * IT IS A RATCHET, NOT A BIG BANG. There were 75 bare catches in engine/ when this was written and
 * stopping the world for all of them would mean it never lands. The baseline is GENERATED, never
 * typed (S13): `node tests/test-no-silent-failure.js --update` records what exists today, and the
 * test fails on anything NEW. The baseline is keyed by a hash of the catch body rather than by line
 * number, so it survives edits elsewhere in the file but does NOT survive someone quietly changing
 * what a known-silent catch does.
 *
 * The count is printed every run, so the number going DOWN is visible and going up is impossible.
 *
 *   node tests/test-no-silent-failure.js                     check
 *   node tests/test-no-silent-failure.js --all               ... and list every new one with its body
 *   node tests/test-no-silent-failure.js --dangerous         the MANUFACTURE subset, by file
 *   node tests/test-no-silent-failure.js --in <file>...     every silent catch in the files YOU own
 *   node tests/test-no-silent-failure.js --update            lock in FIXES (the floor may only fall)
 *   node tests/test-no-silent-failure.js --accept <file> "reason"    accept ONE file's new silence
 *
 * THE RATCHET HAD ONE CONTROL AND IT WAS ALL-OR-NOTHING — ROADMAP #258, 2026-08-14
 * -------------------------------------------------------------------------------
 * `--update` used to write the CURRENT silent set as the new baseline. So there was no way to lock in
 * a fix without also laundering every new offender into the floor in the same command, and the
 * register row says exactly that: *"NOT RE-BASELINED, because --update would launder a week of it
 * into the floor."* The consequence is the failure this repository is worst at: the gate stayed red
 * for a week, three separate agent reports called it pre-existing and moved on, and "pre-existing"
 * did the work the banned phrase "known failure" used to do.
 *
 * A ratchet with a laundering button is not a ratchet. So `--update` is now MONOTONE: for every key
 * it writes min(baseline, current), which removes what was fixed and can never add what is new. The
 * only way into the floor is `--accept <file> "reason"`, one file at a time, with the reason recorded
 * in the artifact beside the keys — a person deciding, once, in writing, exactly like `"rerun": false`
 * in engine/engine_release.js. Shown RED before it was trusted: with the old behaviour, `--update`
 * over a fresh silent catch made the gate green; with this one it stays red and names the file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, 'data', 'silent-catch-baseline.json');
const UPDATE = process.argv.includes('--update');
/* `--accept <file> "reason"` — the ONLY door into the floor, and it takes one file at a time because
 * the unit of work in ROADMAP #258 is a file, owned by the division that owns it. Both arguments are
 * required: an acceptance with no reason is the silence this whole file is about, one level up. */
const ACCEPT_AT = process.argv.indexOf('--accept');
const ACCEPT_FILE = ACCEPT_AT >= 0 ? process.argv[ACCEPT_AT + 1] : null;
const ACCEPT_WHY = ACCEPT_AT >= 0 ? process.argv[ACCEPT_AT + 2] : null;
const DIRS = ['engine', 'build', 'tests'];

/* `--only <file>...` — THE SAME RATCHET, NARROWED TO THE FILES OF ONE COMMIT (2026-08-23).
 *
 * WHY. This gate detected new silent catches in 0.68s and was wired to NOTHING, so the count went
 * 67 -> 95 in four days: writing one carried no consequence at the moment it was written. It is now
 * run by .githooks/pre-commit over `git diff --cached --name-only`.
 *
 * The whole-repo run cannot be that hook. 80 pre-existing offenders are REAL DEFECTS, deliberately
 * not re-baselined, and a hook that failed on them would block every unrelated commit in the
 * repository — which trains everyone to pass --no-verify, and then nothing is enforced at all.
 *
 * So `--only` narrows the VERDICT, not the DETECTION: the scan above is unchanged and repo-wide, and
 * this filters the result to the named files and judges them against the same baseline, by the same
 * per-file catch-body-hash counts. A block already in the floor stays in the floor, so touching a
 * file for an unrelated reason cannot fail. Only a hash the baseline does not cover fails.
 * There is exactly ONE detector; this flag is a filter on its output, never a second copy of it. */
const ONLY_AT = process.argv.indexOf('--only');
const ONLY = ONLY_AT >= 0
  ? process.argv.slice(ONLY_AT + 1).filter(a => !a.startsWith('--'))
      .map(a => a.replace(/\\/g, '/').replace(/^\.\//, ''))
  : null;
if (ONLY && !ONLY.length) {
  console.error('  usage: node tests/test-no-silent-failure.js --only engine/a.js tests/b.js');
  process.exit(2);
}

/* ---- strip what would confuse a brace scanner ------------------------------------------------
 * Comments, strings, template literals and regex literals are replaced by spaces of the same length
 * so every offset in the stripped text still maps to the original. Written out because a naive
 * regex over raw source would treat a brace inside a string as structure. */
function blank(src) {
  const out = src.split('');
  let i = 0, n = src.length;
  const isRegexPos = (j) => {
    for (let k = j - 1; k >= 0; k--) {
      const c = src[k];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
      return !/[A-Za-z0-9_$)\]]/.test(c);      // after an operator/paren-open -> a regex can start
    }
    return true;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') out[i++] = ' '; continue; }
    if (c === '/' && d === '*') { out[i++] = ' '; out[i++] = ' ';
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; }
      if (i < n) { out[i++] = ' '; out[i++] = ' '; } continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out[i++] = ' ';
      while (i < n) {
        if (src[i] === '\\') { out[i++] = ' '; if (i < n) { if (src[i] !== '\n') out[i] = ' '; i++; } continue; }
        if (src[i] === q) { out[i++] = ' '; break; }
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && isRegexPos(i)) {
      let j = i + 1, ok = false;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '\n') break;
        if (src[j] === '[') { while (j < n && src[j] !== ']' && src[j] !== '\n') j++; }
        if (src[j] === '/') { ok = true; break; }
        j++;
      }
      if (ok) { for (let k = i; k <= j; k++) if (src[k] !== '\n') out[k] = ' '; i = j + 1; continue; }
    }
    i++;
  }
  return out.join('');
}

/* ---- the body the CLASSIFIER reads, which is not the body the detector reads -------------------
 *
 * FOUND 2026-08-23, AND IT WAS A HOLE IN THE RULER ITSELF, in the direction that hides danger.
 * `blank()` replaces a string, template or regex with spaces of the same length so that offsets still
 * map. That is right for the brace scanner and right for `isSilent`. It is WRONG for `manufactures`,
 * because `return 'NO SUCH FILE';` strips to `return              ;` — and `/\breturn\b(?!\s*;)/`
 * then sees a bare `return;` and calls the block a harmless skip.
 *
 * So a catch that hands a MADE-UP STRING to its caller — the exact shape this gate names as the
 * dangerous one — was being filed under "merely skip/continue, usually legitimate". Measured on the
 * run that found it: `engine/orient.js:99  return 'NO SUCH FILE'` and `engine/million_run.js:1843
 * return 'N'` were both in the safe column. A ruler that miscounts toward SAFE is worse than one
 * that miscounts toward alarm, which is why this is a fix and not a note.
 *
 * `declank` rebuilds the body with every blanked-out region as `0` instead of a space. Literals
 * become visible to the classifier; comments become runs of zeros, so a comment that says the word
 * "return" still cannot fool it — strictly better than testing the raw body. It is used ONLY by
 * `manufactures()`. `isSilent` keeps reading the stripped body, so this change CANNOT move a block
 * from silent to speaking or the reverse, and therefore cannot change whether this gate passes. It
 * only moves blocks between the two priority columns, toward the one that gets fixed first. */
function declank(raw, stripped) {
  const out = stripped.split('');
  for (let i = 0; i < out.length; i++) if (out[i] === ' ' && !/\s/.test(raw[i])) out[i] = '0';
  return out.join('');
}

/* ---- find every catch body -------------------------------------------------------------------- */
function catches(src) {
  const b = blank(src);
  const found = [];
  const re = /\bcatch\b/g;
  let m;
  while ((m = re.exec(b))) {
    let i = m.index + 5;
    while (i < b.length && /\s/.test(b[i])) i++;
    /* THE CAUGHT BINDING'S NAME, kept rather than skipped past. A body that hands the binding itself
     * back to its caller is REPORTING (see the `carried out` clause in SPEAKS below), and that cannot
     * be decided without knowing what the binding is called. `catch {}` with no clause yields null. */
    let binding = null;
    if (b[i] === '(') {
      let depth = 0; const open = i;
      for (; i < b.length; i++) { if (b[i] === '(') depth++; else if (b[i] === ')') { depth--; if (!depth) { i++; break; } } }
      const inner = src.slice(open + 1, i - 1).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(inner)) binding = inner;   // a plain identifier only, never a pattern
    }
    while (i < b.length && /\s/.test(b[i])) i++;
    if (b[i] !== '{') continue;                       // not a catch clause we understand
    const start = i;
    let depth = 0, end = -1;
    for (; i < b.length; i++) {
      if (b[i] === '{') depth++;
      else if (b[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) continue;
    const line = src.slice(0, m.index).split('\n').length;
    const bodyRaw = src.slice(start + 1, end), bodyStripped = b.slice(start + 1, end);
    found.push({ line, binding, bodyRaw, bodyStripped, bodyClass: declank(bodyRaw, bodyStripped) });
  }
  return found;
}

/* A body is NOT silent if it rethrows, reports, exits, or records the failure somewhere visible. */
const SPEAKS = [
  /\bthrow\b/,                       // rethrow
  /\bconsole\s*\./,                  // report
  /\bprocess\s*\.\s*exit\b/,         // stop
  /\+\+/, /\+=/,                     // a counter
  /\.push\s*\(/,                     // recorded into a list of failures
  /\b(err|error|fail|failure|failed|warn)\w*\s*=/i,   // stashed for a later assertion
  /\blog\w*\s*\(/i,
  /* CALLING a failure recorder is reporting. tests/test-stadium-roster.js's `catch { fail(msg) }`
   * counts AND prints through its own `fail()` helper and was flagged as silent, which is a false
   * positive — a wrongly-red ratchet is how a ratchet gets ignored. Call syntax only: a bare
   * mention of a name like `failCount` in a condition does not qualify. This can only SHRINK the
   * silent set, which is the one direction a detector change here is allowed to move it. */
  /\bfail\w*\s*\(/i,
  /* WRITING TO stderr IS REPORTING. The list recognised `console.*` and missed
   * `process.stderr.write`, which is the same act through a lower-level door — and it is the door a
   * library uses when it must not assume a console exists. `engine/job_cost.js` was flagged for a
   * catch whose entire body writes the failure to stderr. Same false-positive class as `fail(` above,
   * same justification: this can only SHRINK the silent set, which is the one direction a detector
   * change here is allowed to move it. */
  /\bprocess\s*\.\s*std(err|out)\s*\.\s*write\s*\(/,
  /* CARRYING THE MESSAGE INTO THE VALUE UNDER TEST IS REPORTING, and it is the loudest form of it —
   * louder than a counter, because a later assertion cannot help but read it.
   *
   * `tests/mutation_harness.js` writes `'THREW:' + e.message` into the digest it then COMPARES, so a
   * mutation that makes the engine throw is distinguishable from one that changes its output; its
   * own `threwAnywhere()` reads the string back. Three of its catches were flagged silent while the
   * failure reason was travelling in the return value the whole time.
   *
   * The pattern is deliberately narrow: the caught binding's `.message` (or the binding itself) must
   * appear inside a STRING CONCATENATION or template, which is what "the reason is being carried
   * somewhere" looks like. A bare `e` in a condition still does not qualify. Same justification as
   * `fail(` and `process.stderr.write` above: this can only SHRINK the silent set, which is the one
   * direction a detector change here is allowed to move it. */
  /\.\s*message\b/,
  /* THE OTHER WAY TO WRITE A COUNTER, AND THE COMMONEST ONE IN THIS REPO. The list recognises `++`
   * and `+=` and misses `n = (n || 0) + 1`, which is the idiom used wherever the counter lives on an
   * object that may not have the key yet — `STATE_FAILS.battle_over_threw = (STATE_FAILS.x || 0) + 1`
   * in engine/game_differential.js is exactly that, and it was reported as a NEW SILENT CATCH while
   * counting the failure the gate asked it to count.
   *
   * Found 2026-08-13 by reading three flagged blocks rather than trusting the count: two of the three
   * were false positives. **A RATCHET THAT FLAGS CODE FOR DOING WHAT IT ASKED IS HOW A RATCHET GETS
   * IGNORED**, which is the same argument as `fail(`, `process.stderr.write` and `.message` above and
   * is now the fourth time this file has been corrected for it. Deliberately narrow — the `|| 0` guard
   * must be present, so a plain `x = y + 1` assignment does not qualify. Same justification as the
   * three above: this can only SHRINK the silent set, the one direction a detector change may move it. */
  /=\s*\(\s*[\w$.[\]]+\s*\|\|\s*0\s*\)\s*\+/,
  /* A SECOND STATED LIMIT, FOUND 2026-08-14 WHILE FIXING ROADMAP #258 AND WRITTEN DOWN RATHER THAN
   * WORKED AROUND SILENTLY: `blank()` replaces template literals wholesale, so the reason travelling
   * in `${e.message}` INSIDE a template is invisible to the `.message` clause above, while the same
   * reason in `'...' + e.message + '...'` is seen. `engine/quarantine.js`'s open-defect clause was
   * flagged for a body that returns a fully-worded FAILING verdict. The fix went into the code (plain
   * concatenation) rather than into this detector, because recovering `${}` interpolations would mean
   * changing the brace scanner every other check in this file depends on — a large change to the one
   * piece of machinery here that must not be wrong, to catch a case a one-line edit at the call site
   * already handles. Accepted knowingly; it costs a false POSITIVE, never a false negative. */
  /* AND THE LIMIT OF THAT PATTERN, STATED RATHER THAN DISCOVERED LATER: a catch that reads
   * `e.message` only to BRANCH on it and then discards it — `if (e.message === 'x') return null` —
   * still passes this test while being genuinely silent. That case is accepted knowingly. The
   * alternative is telling four honest catches they are silent, and a wrongly-red ratchet is how a
   * ratchet gets ignored, which this file has already been corrected for twice. */
];

/* HANDING THE CAUGHT BINDING ITSELF BACK IS REPORTING, AND IT IS THE LOUDEST FORM OF ALL — the
 * caller receives the Error object, not a story about it. The `.message` clause above already
 * accepts exactly this act for ONE spelling of it; this is the same argument for the others, and it
 * is the FIFTH correction of this kind (after `fail(`, `process.stderr.write`, `.message` and the
 * `(x||0)+1` counter). Same justification as all four: it can only SHRINK the silent set, which is
 * the one direction a detector change here is allowed to move it.
 *
 *   engine/register_reality.js:618,749   `catch (e) { return e; }` — the error IS the value under
 *                                        test; the next line asserts `CONTRACT.status === 2`.
 *   tests/test-orient.js:51              returns `{ code: e.status, out: e.stdout + e.stderr }`,
 *                                        which is the only correct way to wrap execFileSync, since
 *                                        node throws on a non-zero exit and the code is the answer.
 *   tests/test-lownode.js:49             `sawFailure = true; code = e.status;`
 *
 * It requires a PLAIN identifier binding (`catch (e)`, never a destructuring pattern) and one of:
 * the binding returned, the binding assigned, or a property of it read.
 *
 * WHAT IT DELIBERATELY DOES NOT CATCH, STATED HERE SO THE COVERAGE IS NOT MISTAKEN FOR MORE THAN IT
 * IS. This clause is a CLASS test over one catch body. It says nothing about the far commoner shape
 * in this repo — the catch assigns a SENTINEL and the NEXT LINES test that sentinel and shout:
 *
 *   let rows = null;
 *   try { rows = require('../data/switchin-order.json').rows; } catch (e) { rows = null; }
 *   if (!rows) { MEDFAILS.switchInPriorityTableMissing = 1; ... }     <- loud, one line later
 *
 * Every such block is still reported as silent by this gate, and on 2026-08-23 that was 15 of the
 * 95 new ones. They are NOT false alarms in the sense of being harmless — each still discards WHY —
 * but they are not the failure this file was built for either. Deciding them needs look-ahead into
 * the enclosing scope, which this file does not do and which is not a regex. Until something
 * measures it, a `loud caller` is a judgement made by a person reading the block, never by this
 * gate, and the count above must be read with that in mind. */
SPEAKS.push({
  test: (body, binding) => {
    if (!binding) return false;
    const b = binding.replace(/[$]/g, '\\$');
    return new RegExp(`\\breturn\\s+${b}\\b`).test(body)
        || new RegExp(`=\\s*${b}\\s*[;,)\\]}]`).test(body)
        || new RegExp(`\\b${b}\\s*\\.\\s*\\w`).test(body);
  },
});

const isSilent = (body, binding) =>
  !SPEAKS.some(re => re instanceof RegExp ? re.test(body) : re.test(body, binding));

/* ---- NOT ALL SILENCE IS EQUAL, and treating it as such is how a guard becomes noise ------------
 *
 * `catch (e) { continue; }` while parsing a ragged JSONL line is CORRECT silence: nothing failed,
 * the data was torn, and forcing it to shout would train everyone to ignore this check.
 *
 * The catches that have actually cost this project something share one shape: the body MANUFACTURES
 * A VALUE that something downstream then trusts.
 *
 *   magnemite.js   cached an empty duration table   -> every duration became the fallback 3
 *   ditto.js       returned null from the referee   -> sorted, and a team was recommended anyway
 *   sprt.js        returned an empty array          -> read as "the run produced no games"
 *   board.js       (not a catch, same shape)        -> a dropped key made a live feature constant
 *
 * So: a silent catch that RETURNS a value, or ASSIGNS to something, or writes into a map/array, is
 * manufacturing an answer. One that only skips, continues, or breaks is not. The first group is
 * where every real defect has been; the second is mostly legitimate.
 *
 * Approximated without a parser, deliberately conservatively — `=` catches assignment but also `==`
 * and `=>`, so those are excluded explicitly rather than being allowed to inflate the count. */
const MANUFACTURES = [
  /\breturn\b(?!\s*;)/,             // returns an actual value (bare `return;` is just an exit)
  /[^=!<>]=(?!=|>)/,                 // an assignment, excluding ==, ===, !=, <=, >=, =>
  /\.set\s*\(/, /\.push\s*\(/,      // written into a map or list
];
const manufactures = (body) => MANUFACTURES.some(re => re.test(body));

const hash = (s) => crypto.createHash('sha1').update(s.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);

/* ---- scan --------------------------------------------------------------------------------------- */
const silent = [];
const unreadable = [];
let scanned = 0, total = 0;
for (const dir of DIRS) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.js')) continue;
    const rel = dir + '/' + f;
    /* THIS FILE'S OWN BLIND SPOT, AND IT HAD THE BUG IT EXISTS TO CATCH (ROADMAP #258). A source
     * file that cannot be read is a file whose catch blocks were never examined, and skipping it
     * in silence made `files scanned 333` and a clean bill of health for 333 files identical to
     * a clean bill of health for 332 plus one nobody looked at. It is now counted, named, and
     * the run FAILS on it: a ratchet that cannot see a file cannot vouch for it. */
    let src; try { src = fs.readFileSync(path.join(d, f), 'utf8'); }
    catch (e) { unreadable.push(rel + ': ' + e.message); continue; }
    scanned++;
    for (const c of catches(src)) {
      total++;
      if (!isSilent(c.bodyStripped, c.binding)) continue;
      silent.push({ file: rel, line: c.line, hash: hash(c.bodyRaw),
                    manufactures: manufactures(c.bodyClass),
                    body: c.bodyRaw.replace(/\s+/g, ' ').trim().slice(0, 70) });
    }
  }
}

/* ---- the current census, keyed the way the baseline is keyed ------------------------------------ */
/* COUNTS, NOT A SET. Keying on file#hash alone collapsed 229 silent blocks into 184 keys, because
 * `catch (e) {}` and `catch (e) { /* ignore *\/ }` hash identically wherever they appear. A set
 * therefore could not tell a THIRD identical silent catch in the same file from the two already
 * baselined — the ratchet would have been fooled by the commonest shape of the very thing it exists
 * to stop. Counting per key is edit-resilient (a change elsewhere in the file does not move the key)
 * and still catches duplication. */
const CURRENT = {};
for (const s of silent) { const k = `${s.file}#${s.hash}`; CURRENT[k] = (CURRENT[k] || 0) + 1; }

function readBaseline() {
  let b = null;
  try { b = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (e) {
    /* NOT SILENT: an absent baseline and an unparseable one are different situations and the caller
     * must be able to tell them apart. This file has cost enough to know better than to return the
     * same empty object for both. */
    if (e.code !== 'ENOENT') console.error(`  data/${path.basename(BASELINE)} did not parse: ${e.message}`);
    return null;
  }
  /* Old baselines were an array of keys; treat those as count 1 each so the file can be re-based
   * without a flag day. */
  const raw = b.entries || {};
  b.entries = Array.isArray(raw) ? raw.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {}) : raw;
  if (!b.accepted || typeof b.accepted !== 'object') b.accepted = {};
  return b;
}

function writeBaseline(entries, accepted, how) {
  const sorted = Object.fromEntries(Object.entries(entries).filter(([, n]) => n > 0)
    .sort(([a], [b]) => a < b ? -1 : 1));
  fs.writeFileSync(BASELINE, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    by: 'tests/test-no-silent-failure.js ' + how,
    note: 'GENERATED. Silent catch blocks that existed when the ratchet was set. Never hand-edit. '
        + '`--update` is MONOTONE — it writes min(baseline, current) per key, so it locks in FIXES '
        + 'and structurally cannot launder a new offender into the floor (ROADMAP #258). The only '
        + 'way in is `--accept <file> "reason"`, one file at a time, and the reason is recorded in '
        + '`accepted` beside the keys it let through.',
    count: Object.values(sorted).reduce((a, b) => a + b, 0),
    entries: sorted,
    accepted,
  }, null, 1) + '\n');
}

/* ---- --update: LOCK IN FIXES, and nothing else --------------------------------------------------- */
if (UPDATE) {
  const b = readBaseline();
  if (!b) { console.error('NO BASELINE to update. This file may not create one from the current state '
    + '— that is the laundering ROADMAP #258 is about.'); process.exit(2); }
  const next = {}; const lockedIn = [];
  for (const [k, n] of Object.entries(b.entries)) {
    const now = CURRENT[k] || 0;
    const keep = Math.min(n, now);
    if (keep > 0) next[k] = keep;
    if (keep < n) lockedIn.push(`${k}  ${n} -> ${keep}`);
  }
  const wouldLaunder = Object.entries(CURRENT).filter(([k, n]) => n > (b.entries[k] || 0));
  writeBaseline(next, b.accepted, '--update');
  const before = Object.values(b.entries).reduce((a, c) => a + c, 0);
  const after = Object.values(next).reduce((a, c) => a + c, 0);
  console.log(`  baseline ${before} -> ${after}   (${lockedIn.length} key(s) fixed and locked in)`);
  for (const l of lockedIn) console.log('    fixed  ' + l);
  if (wouldLaunder.length) {
    console.log(`\n  ${wouldLaunder.length} key(s) are NEW and were NOT added. --update can only lower`);
    console.log('  the floor; a new silent catch is fixed, or accepted one file at a time with a reason:');
    console.log('    node tests/test-no-silent-failure.js --accept <file> "why this silence is right"');
  }
  process.exit(0);
}

/* ---- --accept: the only door into the floor, one file and one reason at a time -------------------- */
if (ACCEPT_AT >= 0) {
  if (!ACCEPT_FILE || !ACCEPT_WHY || ACCEPT_WHY.startsWith('--')) {
    console.error('  usage: node tests/test-no-silent-failure.js --accept <engine/foo.js> "the reason"');
    console.error('  Both are required. An acceptance with no reason is the silence this gate is about.');
    process.exit(2);
  }
  const b = readBaseline();
  if (!b) { console.error('NO BASELINE — nothing to accept into.'); process.exit(2); }
  const target = ACCEPT_FILE.replace(/\\/g, '/').replace(/^\.\//, '');
  const mine = Object.entries(CURRENT).filter(([k]) => k.split('#')[0] === target);
  if (!mine.length) { console.error(`  no silent catch blocks found in ${target} — nothing to accept.`); process.exit(2); }
  const next = Object.assign({}, b.entries);
  const accepted = Object.assign({}, b.accepted);
  const added = [];
  for (const [k, n] of mine) {
    const was = next[k] || 0;
    if (n <= was) continue;
    next[k] = n;
    accepted[k] = { at: new Date().toISOString().slice(0, 10), why: ACCEPT_WHY, count: n - was };
    added.push(`${k}  +${n - was}`);
  }
  if (!added.length) { console.log(`  ${target} has no NEW silent catch blocks. Baseline unchanged.`); process.exit(0); }
  writeBaseline(next, accepted, `--accept ${target}`);
  console.log(`  accepted ${added.length} key(s) from ${target} into the floor, with the reason recorded:`);
  console.log(`    "${ACCEPT_WHY}"`);
  for (const a of added) console.log('    ' + a);
  process.exit(0);
}

if (process.argv.includes('--dangerous')) {
  const d = silent.filter(s => s.manufactures);
  console.log(`SILENT CATCHES THAT MANUFACTURE A VALUE — ${d.length} of ${silent.length}\n`);
  const byFile = {};
  for (const s of d) (byFile[s.file] = byFile[s.file] || []).push(s);
  for (const [f, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${f}  (${list.length})`);
    for (const s of list) console.log(`      :${String(s.line).padEnd(5)} ${s.body}`);
  }
  process.exit(0);
}

/* ---- --in <file>...: EVERY silent catch in the named files, baselined ones included --------------
 *
 * ROADMAP #258's unit of work is a FILE, owned by the division that owns it, and the two listings
 * above cannot answer "what is left in mine": the default run prints only what is NEW, and
 * `--dangerous` prints only the manufacturing subset across the whole repo. A division that wants to
 * clear its own files had to eyeball a 97-line repo-wide list and grep, which is a second scanner
 * built by hand — the failure mode CLAUDE.md names as how `buildMon("Scizor")` returned null.
 *
 * It reads the baseline so a block already in the floor is marked BASELINED rather than looking
 * clean. Listing only; it changes nothing and exits 0. */
if (process.argv.includes('--in')) {
  const at = process.argv.indexOf('--in');
  const want = process.argv.slice(at + 1).filter(a => !a.startsWith('--'))
    .map(a => a.replace(/\\/g, '/').replace(/^\.\//, ''));
  if (!want.length) { console.error('  usage: node tests/test-no-silent-failure.js --in engine/a.js tests/b.js'); process.exit(2); }
  const b = readBaseline();
  const floor = (b && b.entries) || {};
  const seen = {};
  const mine = silent.filter(s => want.includes(s.file));
  console.log(`SILENT CATCHES IN ${want.length} NAMED FILE(S) — ${mine.length} found\n`);
  for (const f of want) {
    const list = mine.filter(s => s.file === f);
    console.log(`  ${f}  (${list.length})`);
    for (const s of list) {
      const k = `${s.file}#${s.hash}`;
      seen[k] = (seen[k] || 0) + 1;
      const state = seen[k] <= (floor[k] || 0) ? 'BASELINED' : 'NEW      ';
      console.log(`      :${String(s.line).padEnd(6)} ${state} ${s.manufactures ? 'MANUFACTURES' : 'skips       '}  ${s.body}`);
    }
  }
  process.exit(0);
}

const base = readBaseline();
if (!base) {
  console.error('NO BASELINE. data/silent-catch-baseline.json is absent or unreadable.');
  process.exit(2);
}
let known = base.entries;

/* --only: keep the named files and nothing else, on BOTH sides of the comparison. Filtering the
 * baseline too is what makes a pre-existing block stay pre-existing — the keys are `file#hash`, so
 * a per-file subset of the floor gives exactly the verdict the whole-repo run would give for those
 * files, and none of the verdicts for anyone else's. */
const noHead = [];
if (ONLY) {
  const want = new Set(ONLY);
  for (let i = silent.length - 1; i >= 0; i--) if (!want.has(silent[i].file)) silent.splice(i, 1);
  for (let i = unreadable.length - 1; i >= 0; i--) if (!want.has(unreadable[i].split(':')[0])) unreadable.splice(i, 1);
  known = Object.fromEntries(Object.entries(known).filter(([k]) => want.has(k.slice(0, k.lastIndexOf('#')))));

  /* THE FLOOR IS NOT THE ONLY THING THAT COUNTS AS PRE-EXISTING, AND ASSUMING IT WAS WOULD HAVE MADE
   * THIS GATE UNUSABLE ON ITS FIRST DAY. The baseline was set on 2026-08-18; 80 silent blocks have
   * landed since, because nothing was enforcing it. Those are real defects and they stay on the
   * books — but they are ALREADY IN THE FILE. Judging a commit against the baseline alone would have
   * refused an unrelated one-line edit to engine/medicham2-browser.js over five blocks the author
   * never touched, and a gate that does that gets routed around with --no-verify within a day.
   *
   * So a block is pre-existing if the baseline covers it OR HEAD's copy of the file already had it.
   * The question this gate asks is exactly "did THIS commit make it worse", nothing wider. It
   * launders nothing: data/silent-catch-baseline.json is not written here, and the whole-repo run
   * still reports every one of the 80.
   *
   * HEAD's copy is measured with the SAME detector — catches(), isSilent(), hash() — and not with a
   * diff of the patch text, because a hunk that merely MOVES a catch block would read as an addition
   * and a reindent would read as a rewrite. The key is the body hash, so moved code is still the
   * same block. */
  const headCount = {};
  const { execFileSync } = require('child_process');
  for (const f of ONLY) {
    let src;
    try {
      src = execFileSync('git', ['show', `HEAD:${f}`],
                         { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      /* NOT SILENT, and it must not be: this file scans itself. A file with no copy in HEAD is
       * usually a NEW file, where every block in it is genuinely new — which is the strict answer.
       * If git itself were broken, every file would land here and the gate would get STRICTER, never
       * weaker. It is recorded and printed either way, so the reason is never merely inferred. */
      noHead.push(`${f}: ${String(e.message).split('\n')[0]}`);
      continue;
    }
    for (const c of catches(src)) {
      if (!isSilent(c.bodyStripped, c.binding)) continue;
      const k = `${f}#${hash(c.bodyRaw)}`;
      headCount[k] = (headCount[k] || 0) + 1;
    }
  }
  for (const [k, n] of Object.entries(headCount)) if (!(known[k] >= n)) known[k] = n;
}

const now = {};
for (const s of silent) { const k = `${s.file}#${s.hash}`; (now[k] = now[k] || []).push(s); }

/* NEW = this key appears MORE times than the baseline allows. The extras are the new ones. */
const fresh = [];
for (const [k, list] of Object.entries(now)) {
  const allowed = known[k] || 0;
  if (list.length > allowed) fresh.push(...list.slice(allowed));
}
const knownTotal = Object.values(known).reduce((a, b) => a + b, 0);
const gone = Object.entries(known)
  .filter(([k, n]) => (now[k] ? now[k].length : 0) < n)
  .map(([k, n]) => `${k} (${n - (now[k] ? now[k].length : 0)})`);

/* --only prints the FACTS and nothing else — which file, which line, and whether the block hands a
 * made-up value downstream. The repo-wide header below would be a lie here (`files scanned 333`
 * against a two-file verdict), and the plain-English "what do I do now" belongs to the caller that
 * refused the commit, so that there is one wording of it and it lives beside the refusal. */
if (ONLY) {
  if (unreadable.length) {
    console.log('COULD NOT BE READ, so its catch blocks were never examined:');
    for (const u of unreadable) console.log('  ' + u);
    process.exit(1);
  }
  for (const n of noHead) console.log(`  (no copy in HEAD, so every block in it counts as new) ${n}`);
  if (!fresh.length) { console.log(`  no new silent catch blocks in ${ONLY.length} file(s).`); process.exit(0); }
  console.log(`NEW SILENT CATCH BLOCKS — ${fresh.length} in this change\n`);
  for (const s of fresh) {
    console.log(`  ${s.file}:${s.line}`);
    console.log(`      ${s.manufactures ? 'HANDS BACK A MADE-UP VALUE' : 'skips and carries on'}   ${s.body}`);
  }
  process.exit(1);
}

console.log('SILENT FAILURE RATCHET — a catch block may not discard the reason\n');
console.log(`  files scanned            ${scanned}`);
if (unreadable.length) console.log(`  COULD NOT BE SCANNED     ${unreadable.length}   <- not vouched for by this gate`);
console.log(`  catch blocks             ${total}`);
const danger = silent.filter(s => s.manufactures);
console.log(`  silent (say nothing)     ${silent.length}   of ${total}  (${(100 * silent.length / Math.max(1, total)).toFixed(0)}%)`);
console.log(`    of those, MANUFACTURE  ${danger.length}   <- these hand a made-up value downstream`);
console.log(`    merely skip/continue   ${silent.length - danger.length}   <- usually legitimate`);
console.log(`  baselined                ${knownTotal}`);
console.log(`  FIXED since the baseline ${gone.length}`);
console.log(`  NEW since the baseline   ${fresh.length}`);

if (fresh.length) {
  /* THE NEW SET IS RANKED, NOT LISTED — ROADMAP #258. It is two populations and treating it as one
   * is why a week of it read as a single undifferentiated wall: a catch that skips a torn line and
   * continues is usually right, and a catch that RETURNS A PLAUSIBLE VALUE is this project's named
   * failure mode — a capability that could not prove it ran, reporting success. The manufacturing
   * ones go first, grouped by the file that owns them, because the unit of work is a file and a
   * division owns each one. */
  const mfg = fresh.filter(s => s.manufactures);
  const skip = fresh.filter(s => !s.manufactures);
  const group = (list) => {
    const m = {};
    for (const s of list) (m[s.file] = m[s.file] || []).push(s);
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
  };
  const ALL = process.argv.includes('--all');
  console.log(`\n  NEW, AND THEY MANUFACTURE A VALUE — ${mfg.length}. Fix these first: each hands a`);
  console.log('  made-up answer to whatever reads it, and reports success doing it.');
  for (const [f, list] of group(mfg)) {
    console.log(`    ${f}  (${list.length})`);
    for (const s of list) console.log(`      :${String(s.line).padEnd(6)} ${s.body}`);
  }
  console.log(`\n  NEW, AND THEY ONLY SKIP OR CONTINUE — ${skip.length}. Lower priority: usually correct`);
  console.log('  silence over ragged input, but each still discards the reason.');
  /* `--all` prints every one. The cap is right for a gate — a wall of text is a wall nobody reads —
   * but a truncated list cannot be worked through, and "... and 27 more" is how the tail of a list
   * stops being anybody's job. */
  for (const [f, list] of group(skip)) {
    console.log(`    ${f}  (${list.length})`
      + (ALL ? '' : list.length > 3 ? '   [--all for every line]' : ''));
    for (const s of (ALL ? list : list.slice(0, 3))) console.log(`      :${String(s.line).padEnd(6)} ${s.body}`);
  }
  console.log('\n  Make it speak: rethrow, console.error it, count it, or record it somewhere a later');
  console.log('  assertion can see.');
  console.log('  `--update` locks in FIXES and can no longer launder these into the floor (#258).');
  console.log('  If a silence here is genuinely right, say why in the code and then, one file at a time:');
  console.log('    node tests/test-no-silent-failure.js --accept <file> "the reason"');
  process.exit(1);
}
if (gone.length) console.log(`\n  ${gone.length} baselined block(s) now speak. Re-run with --update to lock the gain in.`);
if (unreadable.length) {
  console.log('\n  ' + unreadable.length + ' FILE(S) COULD NOT BE READ, so their catch blocks were never examined:');
  for (const u of unreadable) console.log('    ' + u);
  console.log('  A ratchet that cannot see a file may not report that file clean.');
  process.exit(1);
}
console.log('\n  no NEW silent failures.');
process.exit(0);
