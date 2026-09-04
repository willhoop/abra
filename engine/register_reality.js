/* register_reality.js — THE REGISTER IS AN ARTIFACT, AND NOTHING WAS CHECKING IT AGAINST REALITY.
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * Every other artifact in this repository has something that compares it to its source.
 * `engine/provenance.js` compares an artifact to the files it declares it read. `engine/artifact_audit.js`
 * compares a generated file to the source values it was built from. `engine/quarantine.js` compares a
 * printed figure to whether its generator is downstream of a simulator we know is wrong.
 *
 * `docs/ROADMAP.md` had NOTHING. A row is a sentence a person typed, and the ONLY test applied to it
 * was whether some later person remembered to type a different sentence. That is prose, and this
 * repository's whole opening argument is what prose is worth here: fourteen stale handoffs, a
 * hand-maintained ban list of four, an auto-commit paragraph kept twelve days past its subject.
 *
 * THE COST IS MEASURED, NOT SUSPECTED. In one session on 2026-08-14 four rows turned out to be stale
 * rather than live — #279 claimed a guaranteed-crit damage error that `dmgRange` already got right and
 * had been RANKED FIRST OF FOURTEEN as the place to start; #244 had been fixed since 2026-08-13 with
 * nobody flipping the row; two of #273's eight FAILs probed abilities with no legal carrier in this
 * regulation; #266 said 41 illegal declarations against a true 32. On 2026-08-15 the audit of the
 * seven rows the MEDICHAM gate was counting found ONE fully closed (#273 — 200 demonstrations, 0
 * failed, and filed as red) and two matched only by a prose fallback reading a metaphor and a
 * description of an already-repaired bug.
 *
 * **A ROW THAT OVERSTATES ITS SCOPE COSTS A WHOLE AGENT, WHICH IS MORE THAN THE DEFECT IT NAMES.**
 * And because `quarantine.js` reads the open count as a GATE INPUT, a stale row holds the gate shut on
 * a defect that no longer exists — the gate then reports something untrue in the direction that gets
 * gates ignored, which is the exact failure `openDefectClause` was narrowed to prevent.
 *
 * ================= WHAT IT DOES ====================================================================
 *
 * A row may name the instrument that decides it:
 *
 *     VERIFIED BY: `node tests/test-fixture-legality.js`
 *
 * This file finds every such row, RUNS the command, and compares the exit code to the row's status:
 *
 *   STALE ROW        the row is OPEN and its instrument is GREEN. The register overstates. Loudest
 *                    verdict here, because it is the one that costs an agent.
 *   PREMATURE CLOSE  the row is CLOSED and its instrument is RED. The register understates.
 *   CONFIRMED        open + red, or closed + green. The row and the world agree.
 *   UNVERIFIABLE     no marker. Counted and named, never hidden — the coverage figure IS the honest
 *                    measure of how much of this register is still prose.
 *   INSTRUMENT       the instrument RAN and declared CANNOT-ANSWER. It is not green and it is not
 *   CANNOT ANSWER    red; it measured nothing, and the row is neither confirmed nor cleared by it.
 *   EXIT CODE        the instrument exited with a code outside {0,1} and never said what that code
 *   UNDECLARED       means. Not read as a verdict. See classifyExit().
 *   MARKER REJECTED  the row NAMES an instrument and this file refused to READ the marker, so nothing
 *                    was started. A defect in this file or in the row, never in the instrument, and
 *                    printed with the marker and the rule that refused it. It used to degrade to
 *                    INSTRUMENT UNRUNNABLE — the same label a broken gate produces — and nine markers
 *                    lived in that bucket after ROADMAP #521 fixed one spelling. See classifyMarker().
 *
 * ================= WHAT IT DELIBERATELY DOES NOT DO ================================================
 *
 * It does not guess. A row with no marker is reported as unverifiable, not as fine and not as
 * suspicious. Inferring an instrument from a row's prose would be the same vocabulary-matching that
 * put a metaphor into a gate; #148 has been paid for three times in one detector already.
 *
 * It is not the closed-detector. `roadmapRowIsClosed` is imported from `quarantine.js`, never copied:
 * CLAUDE.md's rule is that two files deciding the same fact will disagree eventually and the
 * disagreement will be invisible because both keep working.
 *
 * An exit code is a weaker oracle than a re-derivation, and that is stated rather than glossed: a
 * green instrument means THAT instrument sees nothing, not that the row's claim is false. It is
 * nevertheless strictly more than the register had, which was nothing at all.
 *
 *   node engine/register_reality.js            # run every marked row, and WRITE the verdicts
 *   node engine/register_reality.js --list     # coverage only; runs nothing AND writes nothing
 *   node engine/register_reality.js --json
 *   node engine/register_reality.js --selftest # every verdict on synthetic input, red and green
 *
 * Exit 1 on any STALE ROW or PREMATURE CLOSE. Runs no games. The MEASURING invocations write one
 * artifact; `--list` writes nothing at all, and that is enforced structurally — see THE SPLIT. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'register-reality.json');
const Q = require('./quarantine.js');

const has = (f) => process.argv.includes(f);
const TIMEOUT_MS = 10 * 60 * 1000;

/* THE MARKER IS UPPERCASE AND FENCED, so it is visible to a human reading the table and cannot be
 * produced by ordinary prose. The command must start with `node ` and name a path inside the
 * repository: this file executes what it finds, and a register anybody can edit is not a place to
 * accept an arbitrary shell string. Refused loudly rather than skipped — a marker that silently does
 * nothing is worse than no marker, because it reads as coverage. */
const MARKER = /VERIFIED BY:\s*`([^`]+)`/;
/* THE SECOND MARKER, AND IT IS THE HONEST ANSWER FOR MOST OF THIS REGISTER.
 *
 * `VERIFIED BY` needs a gate whose EXIT CODE tracks the row's claim, and for a great many rows no
 * such gate exists. Three of them were looked at on 2026-08-17 and each had a plausible candidate
 * that decided something else:
 *
 *   #241  `engine/game_differential.js` MEASURES the missing `-fail` emissions and deliberately
 *         exits 0 on them — *"a divergence is a FINDING"*, stated in its own header and in
 *         tests/test-game-differential.js, which fails only when the INSTRUMENT is wrong.
 *   #276  `tests/test-seed-clock.js` is green and covers #270, the SEED's clock. #276 is the BOARD's
 *         own `weather` field, which no gate reads.
 *   #283  `tests/test-rollout-fallen.js` is green and covers #244/#245/#246, the SEED's roster.
 *         #283 is `board.movePower`'s stub, which no gate reads.
 *
 * Pointing a `VERIFIED BY` at any of those three would have made a live defect read CONFIRMED-and-
 * green, which is worse than the prose it replaced. So the alternative is not silence: a row may
 * declare, in writing, that NOTHING decides it and name what would have to be built.
 *
 *     INSTRUMENT OWED: a gate asserting <the thing>, which does not exist
 *
 * It counts as coverage of a different KIND and is reported separately — never folded into the
 * verified figure, because a debt is not a measurement. */
const OWED = /INSTRUMENT OWED:\s*([^|]+?)(?:\s*\||$)/;
/* A `-r <repo script>` PRELOAD IS PART OF THE COMMAND, NOT DECORATION — 2026-08-28.
 *
 * THE DEFECT. `SAFE` used to require the string to begin with `node ` followed IMMEDIATELY by the
 * script, and to permit flags only. Three markers begin `node -r ./tests/_live_release.js …`, so all
 * three failed it and were reported NOT_STARTED — while `tests/run-all.js`'s PENDING_WIRE said in
 * writing of each that *"engine/register_reality.js execFileSyncs every marker it finds"* and counted
 * them as ACCOUNTED FOR. An unaccounted check is RED and gets fixed. These read GREEN.
 *
 * WHY THE REGEX WAS THE WRONG SIDE OF THE FENCE AND NOT THE MARKER. `tests/_live_release.js`
 * redirects `engine_release.js`'s `cut`/`open` to a temp store by wrapping the module object BEFORE
 * the instrument requires it, which only works as a `-r` preload — its own header says *"preloading
 * with `-r` is load-bearing and not decoration"*. Drop it and `game_differential.js` CUTS A REAL
 * RELEASE at require time, repointing `data/engine-release.json` under whatever else is measuring.
 * Measured rather than argued: all three probes detect the preload themselves and `process.exit(2)`
 * with `REFUSED — pass --release <id>, or preload -r ./tests/_live_release.js` when it is absent. So
 * rewriting the markers to satisfy the old regex would have bought three refusals and one corrupted
 * release pointer per run.
 *
 * THE NARROWNESS IS KEPT WHERE IT EARNS ITS KEEP. A preload must name a `.js` file under
 * `engine/`, `tests/` or `build/` exactly as the script must, it is resolved against ROOT rather than
 * against the caller's cwd, and BARE VALUES ARE STILL REFUSED. That last one is deliberate and it is
 * not laziness: the markers that would be admitted by allowing `--flag value` are
 * `tests/roster.js --stage moves`, `engine/all_mechanics_fire.js --kind abilities`,
 * `engine/game_differential.js --arm middle --team-store …` and `probe_corpse_in_slot.js --games 1200`
 * — multi-minute game-playing runs, three of which REWRITE artifacts other readers hold. Widening the
 * regex would silently put them inside every register pass. That is a decision with an owner, not a
 * regex tweak, and it is filed rather than taken here. */
/* ============ CORRECTED 2026-09-04: #521 FIXED ONE SPELLING AND NINE MORE WALKED PAST ============
 *
 * The paragraph above is dated evidence and is left standing. Its LAST argument — that admitting
 * bare `--flag value` pairs "would silently put multi-minute game-playing runs inside every register
 * pass" — was MEASURED FALSE on 2026-09-04, on these exact bytes. The old regex permitted
 * `--[A-Za-z0-9_\-=]+`, and `=` is in that class, so every single command it named as the thing it
 * was protecting against was ALREADY ADMITTED under one extra character:
 *
 *     node engine/game_differential.js --arm middle      refused
 *     node engine/game_differential.js --arm=middle      ADMITTED
 *     node tests/roster.js --stage moves                 refused
 *     node tests/roster.js --stage=moves                 ADMITTED
 *     node -r ./tests/_live_release.js tests/probe_corpse_in_slot.js --games=1200 --verify-inert
 *                                                        ADMITTED
 *
 * So there was no cost guard to preserve. There was a SPELLING guard that caught one spelling of four
 * commands, and the pass it was said to protect already runs 63 entry scripts of which 12 write a
 * file, `engine/quarantine.js` and `engine/status.js` among them. A guard an equals sign defeats is
 * this repository's own thesis wearing a regex: it reads as protection and is not.
 *
 * WHAT `SAFE` IS ACTUALLY FOR, STATED ONCE AND THEN IMPLEMENTED AS A PROPERTY. `runUncached` calls
 * `execFileSync(process.execPath, argv)` and passes NO `shell` option, so no shell will ever see this
 * string. "Could a shell be tricked by it" is therefore not the question. Exactly two are:
 *
 *   1. DOES THIS STRING MEAN, AS AN ARGV, WHAT IT SAYS? If it only means what it says under a shell —
 *      an `NAME=value` prefix, `&&`, a pipe, a redirect, `$(...)`, quotes, a glob — then running it
 *      without one runs a DIFFERENT COMMAND and reports the row as decided by it. That is worse than
 *      not running it, and it is why `node tests/a.js && curl evil` must stay refused even though,
 *      with no shell, those three tokens are inert argv.
 *   2. DOES ANYTHING IN IT MAKE NODE LOAD OR EVALUATE CODE THAT IS NOT THIS REPOSITORY'S? Node reads
 *      ONLY the tokens BEFORE the entry point. Everything after the entry point is handed verbatim to
 *      a repo script as `process.argv` and node never looks at it.
 *
 * THAT SPLIT IS THE PROPERTY, AND IT IS WHY THIS IS NOT A THIRD LIST OF PERMITTED SHAPES. The token
 * vector has three regions and each gets one rule:
 *
 *   PRE-ENTRY   node's own options. Hostile, and CLOSED BY REFUSAL: the only option admitted is
 *               `-r`/`--require` whose value resolves INSIDE ROOT and ends `.js`. Anything else —
 *               including an option nobody here has heard of — is REFUSED. The default is refuse, so
 *               a node option invented next year cannot walk past this the way `-r` walked past #521.
 *   ENTRY       the first non-option token. Must resolve inside ROOT and end `.js`.
 *   POST-ENTRY  the instrument's own argv. INERT BY CONSTRUCTION — node does not read it and
 *               execFileSync does not interpret it. Admitted verbatim, subject only to question 1.
 *
 * Under that property `--stage moves`, `--stage=moves`, `--games 1200` and
 * `--team-store data/team-pool-frozen` are all the SAME FACT, which is the whole point: the old rule
 * gave two different answers to two spellings of one command, and a rule that does that is measuring
 * the spelling.
 *
 * THE ONE ENUMERATION LEFT, NAMED RATHER THAN HIDDEN. `EVAL_OPTS` below is a list, and it CANNOT FAIL
 * OPEN: an unlisted pre-entry option is refused anyway. The list exists only to make the refusal
 * SENTENCE better for the cases most likely to be attempted. If it goes stale, a marker gets a
 * vaguer message — never an execution.
 *
 * AND A REFUSAL IS NOW LOUD. Every `false` out of here becomes `KIND.REJECTED` -> verdict
 * `MARKER REJECTED`, named with its reason, counted in the artifact, and printed by BOTH the
 * measuring path and `--list`. It used to become `KIND.NOT_STARTED` -> `INSTRUMENT UNRUNNABLE`,
 * which is the same label a gate that ENOENTs or gets killed produces — so "my ruler would not read
 * this marker" and "this instrument is broken" sat in one bucket of 27. Those are a defect in the
 * RULER and a defect in the WORLD, and one label for both is how nine of them survived #521. */
const EVAL_OPTS = new Set(['-e', '--eval', '-p', '--print', '--input-type',
  '--experimental-loader', '--loader', '--import', '--experimental-vm-modules']);
/* A shell would give these meaning. We run no shell, so a marker carrying one does not mean what its
 * author wrote — refuse rather than run a different command under the row's name. `<` and `>` are in
 * here too, but the placeholder check runs FIRST so `<id>` gets the message it deserves. */
const SHELL_ONLY = /[&|;<>$`(){}\[\]*?~'"\n]/;
/* Unexpanded template text. `SHOWDOWN_PATH=...` and `--release <id>` are not commands, they are
 * instructions to a human, and no widening of any kind makes them runnable. */
const PLACEHOLDER = /<[^>]*>|\.\.\./;

/* Lexical containment only — no fs, so `enumerate()` stays pure and `--list` can report a rejection
 * without touching the disk. path.resolve is what decides it, not a regex over the string: that is
 * what kills `../../evil.js`, `/etc/passwd` and a bare drive letter in one rule rather than three. */
function insideRepo(tok) {
  if (!/\.js$/.test(tok)) return null;
  const p = path.resolve(ROOT, tok);
  const rel = path.relative(ROOT, p);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return p;
}

/* PURE. Returns { ok: true, argv } or { ok: false, code, why }. `code` is a short machine-readable
 * reason so the artifact can carry WHICH rule refused, not just that something did. */
function classifyMarker(cmd) {
  const no = (code, why) => ({ ok: false, code, why });
  const s = String(cmd == null ? '' : cmd).trim();
  if (!s) return no('NOT A COMMAND', 'the marker is empty');
  const t = s.split(/\s+/);
  if (PLACEHOLDER.test(s))
    return no('PLACEHOLDER', 'the marker carries unexpanded template text (`<...>` or `...`), so it is '
      + 'an instruction to a human and cannot be run as written. Write the real value into the row.');
  if (t[0] !== 'node') {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]))
      return no('NEEDS A SHELL', 'the marker begins with the environment assignment `' + t[0] + '`. '
        + 'That is a SHELL feature and this file runs no shell, so the assignment would be taken as '
        + 'the program name. Pass the value inside the instrument, or drop the prefix.');
    return no('NOT A COMMAND', 'the marker does not begin with `node` — it is ' + JSON.stringify(t[0])
      + ', which names no instrument this file can run');
  }
  const meta = t.find(x => SHELL_ONLY.test(x));
  if (meta)
    return no('NEEDS A SHELL', 'the token ' + JSON.stringify(meta) + ' only means what its author wrote '
      + 'under a shell, and this file runs none. Executed as plain argv it would run a DIFFERENT '
      + 'command while reporting the row as decided by this one.');
  const pre = [];
  let i = 1;
  while (i < t.length && t[i].startsWith('-')) {
    const tok = t[i];
    const eq = tok.indexOf('=');
    const name = eq === -1 ? tok : tok.slice(0, eq);
    if (name !== '-r' && name !== '--require') {
      if (EVAL_OPTS.has(name))
        return no('EVALUATES CODE', 'the node option `' + name + '` hands node a program or a loader '
          + 'to run. A register row may name an instrument; it may not carry code.');
      return no('UNKNOWN NODE OPTION', 'the node option `' + name + '` is not one this file has '
        + 'reasoned about, and an option before the entry point can change what node LOADS. Refused by '
        + 'default. If it is legitimate, admit it here deliberately and say why it is safe.');
    }
    const val = eq === -1 ? t[++i] : tok.slice(eq + 1);
    if (val === undefined)
      return no('NO PRELOAD PATH', 'the marker ends with a bare `' + name + '` and names no file to preload');
    const abs = insideRepo(val);
    if (!abs)
      return no('LOADS OUTSIDE THE REPO', 'the preload ' + JSON.stringify(val) + ' is not a `.js` file '
        + 'inside this repository. `-r` executes it in this process tree exactly as the entry point is '
        + 'executed, so it is held to exactly the same bar.');
    pre.push(name, abs);
    i++;
  }
  if (i >= t.length)
    return no('NO ENTRY POINT', 'the marker names node options but no script for node to run');
  const entry = insideRepo(t[i]);
  if (!entry)
    return no('LOADS OUTSIDE THE REPO', 'the entry point ' + JSON.stringify(t[i]) + ' is not a `.js` '
      + 'file inside this repository, and this file executes what a register row names');
  /* EVERYTHING AFTER THE ENTRY POINT IS INERT. Node stops reading options at the entry point and hands
   * the remainder to the script as process.argv; execFileSync interprets none of it. So these tokens
   * are input to code that is already inside this repository, and the questions above are both already
   * answered for them. This is the region the old regex was policing, and policing it was never a
   * safety act — see the equals-sign measurement at the head of this block. */
  return { ok: true, argv: pre.concat([entry], t.slice(i + 1)) };
}

/* TWO OF MY OWN TOOLS PRINTED `register rows` AND DISAGREED — 206 HERE, 251 IN open_work.js.
 * Neither was wrong and that is the problem: `docs/ROADMAP.md` holds 251 lines shaped `| #N | …`, of
 * which 206 are DEFECT-REGISTER rows (a bolded claim and a status cell) and 45 are older planning
 * tables with four different columns (`| #33 | record which GARY ran | why | trivial |`). A marker
 * cannot be attached to those and they have no status to compare an exit code against. So the
 * denominator is stated rather than left to be inferred — CLAUDE.md's rule is that two files
 * deciding the same fact will disagree eventually and the disagreement will be invisible because
 * both keep working. This one was visible for about a minute. */
function parse(lines) {
  const rows = [];
  let idRows = 0;
  for (const l of lines) {
    if (/^\|\s*#\d+\s*\|/.test(l)) idRows++;
    const m = l.match(/^\|\s*#(\d+)\s*\|\s*\*\*(.{0,140})/);
    if (!m) continue;
    const mk = l.match(MARKER);
    rows.push({
      n: +m[1],
      title: m[2].replace(/\s+/g, ' ').slice(0, 90),
      closed: Q.roadmapRowIsClosed(l),
      saysBroken: Q.roadmapRowSaysBroken(l),
      cmd: mk ? mk[1].trim() : null,
      owed: (!mk && l.match(OWED)) ? l.match(OWED)[1].replace(/\s+/g, ' ').trim() : null,
    });
  }
  rows.idRows = idRows;
  return rows;
}

/* THE VERDICT TABLE, EXTRACTED SO THE SELFTEST DRIVES THE SHIPPING FUNCTION RATHER THAN A RESTATEMENT
 * OF IT. `green` is a tri-state: true, false, or null when the instrument said nothing about the row —
 * and null is NOT green. An instrument that will not start, or that ran and REFUSED TO ANSWER, says
 * nothing about the row, and calling that agreement is the "a capability was absent and everything
 * reported success" shape.
 *
 * `kind` comes from classifyExit() below and splits the null case three ways, because "I never
 * started", "I ran and refused" and "I exited with a code I never explained" are three different
 * facts and one label for all three would be a sentence that is false for two of them. */
function verdict(row, green, kind) {
  if (!row.cmd) return row.owed ? 'INSTRUMENT OWED' : 'UNVERIFIABLE';
  if (green === null) {
    if (kind === KIND.REFUSED || kind === KIND.CONTRADICTION) return 'INSTRUMENT CANNOT ANSWER';
    if (kind === KIND.UNDECLARED) return 'EXIT CODE UNDECLARED';
    /* NOT `INSTRUMENT UNRUNNABLE`, WHICH WOULD BE A FALSE SENTENCE. Nobody asked the instrument
     * anything; this file declined to read the row's marker. That is fixable HERE or in the row, and
     * it must not look like a broken gate. */
    if (kind === KIND.REJECTED) return 'MARKER REJECTED';
    return 'INSTRUMENT UNRUNNABLE';
  }
  if (!row.closed && green) return 'STALE ROW';
  if (row.closed && !green) return 'PREMATURE CLOSE';
  return 'CONFIRMED';
}
const BAD = new Set(['STALE ROW', 'PREMATURE CLOSE', 'INSTRUMENT UNRUNNABLE',
  'INSTRUMENT CANNOT ANSWER', 'EXIT CODE UNDECLARED',
  /* A REJECTED MARKER EXITS THIS FILE 1. It is a row claiming to be decided by something that was
   * never started, which is the coverage lie #521 was filed for. */
  'MARKER REJECTED']);

/* ================= WHICH EXIT CODES ARE VERDICTS, AND WHICH ARE REFUSALS ==========================
 *
 * THE DEFECT THIS REPLACES. The catch block below read *any* non-zero exit as `green: false`, and
 * `green: false` is not "the instrument had something to say" — it is a MEASURED RED. `verdict()`
 * turns it into CONFIRMED ("the row and the world agree") on an open row and PREMATURE CLOSE
 * (an accusation against whoever closed it) on a closed one, and `openDefectClause` in
 * engine/quarantine.js turns it into `withRed`, which holds the MEDICHAM gate shut.
 *
 * Measured 2026-08-23 on the pre-fix bytes: `engine/gate_offfield_target.js` (row #224) and
 * `engine/gate_fail_and_silent.js` (row #241) BOTH exit 2 today, both printing `CANNOT ANSWER` —
 * #224 because every artifact it reads was measured against other bytes, #241 because its artifact
 * ran on release c66976713feb against a tree of 33d871e6db92. Neither had a finding. Both were being
 * published as RED evidence of a live engine defect. That is a gate reporting something untrue in the
 * direction that gets gates ignored (#148), arriving through the ruler rather than the engine.
 *
 * ================= WHY THIS IS NOT `if (status === 2)` ============================================
 *
 * Exit 2 is the INSTANCE. The question is which codes are VERDICTS and which are REFUSALS, and a
 * hand-kept list of known refusal codes is the ban-list-of-four shape: it cannot catch a new
 * instrument that refuses with a code nobody thought of. So the burden is inverted and put on the
 * instrument:
 *
 *   exit 0                       VERDICT-GREEN. The universal convention, and every runner in this
 *                                repository already relies on it.
 *   exit 1                       VERDICT-RED. Also the universal convention, and also what node
 *                                itself exits on an uncaught throw.
 *   any other non-zero code      NOT A VERDICT unless the instrument says so. It becomes
 *                                `green: null` — named, counted, and never read as agreement.
 *
 * An instrument that wants a code outside {0,1} to carry meaning DECLARES it on the way out, in one
 * machine-readable line naming the code it is about to exit with:
 *
 *     ABRA-EXIT 2 CANNOT-ANSWER
 *     ABRA-EXIT 3 VERDICT-RED
 *
 * The declaration is matched at the START OF A LINE, uppercase and hyphenated, for the same reason
 * `VERIFIED BY:` is: it must be impossible for ordinary prose to produce. That is not decoration —
 * `engine/gate_offfield_target.js` prints the legend `exit 2   [0 clean, 1 the placeholder is back,
 * 2 cannot answer]` on EVERY run including its green ones, so a tolerant search for the words
 * "cannot answer" would classify every run as a refusal. Only the line matching the code the process
 * ACTUALLY exited with is read, and the last such line wins.
 *
 * ================= WHAT THIS CATCHES, AND THE ONE THING IT CANNOT ================================
 *
 * IT CATCHES a new instrument that refuses in a way nobody here anticipated, as long as the refusal
 * carries a code outside {0,1} — including one that declares nothing at all, which is the case this
 * fix was written for: neither gate above was edited, and both stop being published as red.
 *
 * IT CANNOT CATCH a refusal spelled as exit 1 with no declaration. That is irreducible rather than an
 * oversight: exit 1 is the universal "I failed", and an instrument that refuses without saying so is
 * indistinguishable from one that found the defect. The only defence is the instrument declaring
 * itself, which is why the declaration exists and why `exit_codes_undeclared` is counted and printed
 * on every run — a coverage figure that can be driven down, not a claim that it is already zero.
 *
 * IT ALSO CANNOT CATCH a lying declaration. `ABRA-EXIT 1 VERDICT-GREEN` on a real failure would be
 * honoured. An instrument that misreports itself is outside what any consumer of its exit code can
 * detect; the one contradiction that IS detectable — a declaration attached to exit 0 that does not
 * say VERDICT-GREEN — is refused rather than guessed at.
 *
 * THE SAME FACT IS DECIDED IN A SECOND PLACE AND THAT IS FILED, NOT FIXED HERE. `tests/run-all.js`
 * (its runner loop, at `r.status === 2`) already treats exit 2 as *"I COULD NOT RUN, NOT I FAILED"*
 * for every script it runs, and says so in those words. Two files deciding one fact will disagree
 * eventually — they DID disagree, and this file was the one that was wrong — so the durable fix is
 * one implementation both call. That refactor is not made here: this pass was forbidden to touch
 * tests/, and doing it blind is how a runner starts skipping real failures. See the register row.
 *
 * THE KNOB RESTORES THE DEFECT ON DEMAND. `RR_CANNOT_ANSWER_AS_RED=1` puts every non-zero exit back
 * to `green: false`, so the selftest can show the old behaviour red instead of describing it. */
const KIND = {
  GREEN: 'VERDICT-GREEN',
  RED: 'VERDICT-RED',
  REFUSED: 'CANNOT-ANSWER',
  UNDECLARED: 'UNDECLARED',
  CONTRADICTION: 'DECLARATION-CONTRADICTS-EXIT',
  NOT_STARTED: 'NOT-STARTED',
  /* THE RULER REFUSED TO READ THE MARKER — a defect in THIS FILE or in the ROW, never in the
   * instrument. Split out of NOT_STARTED on 2026-09-04 because the two shared one label and one
   * bucket of 27, and nine markers lived in it. */
  REJECTED: 'MARKER-REJECTED',
  LEGACY: 'LEGACY-ANY-NONZERO-IS-RED',
};
const DECLARATION = /^ABRA-EXIT[ \t]+(\d+)[ \t]+(VERDICT-GREEN|VERDICT-RED|CANNOT-ANSWER)\b/;

/* The declaration for THIS exit code, or null. Last one wins. Reads whatever the caller captured —
 * stdout and stderr both, because a gate that refuses may say so on either. */
function declaredKind(status, text) {
  let found = null;
  for (const line of String(text == null ? '' : text).split(/\r?\n/)) {
    const m = line.match(DECLARATION);
    if (m && Number(m[1]) === status) found = m[2];
  }
  return found;
}

function classifyExit(status, text) {
  if (process.env.RR_CANNOT_ANSWER_AS_RED === '1')
    return status === 0
      ? { green: true, kind: KIND.LEGACY, why: 'exit 0' }
      : { green: false, kind: KIND.LEGACY, why: 'exit ' + status + ' (RR_CANNOT_ANSWER_AS_RED=1: the '
          + 'pre-fix behaviour — every non-zero exit is published as a RED verdict)' };
  const declared = declaredKind(status, text);
  if (status === 0) {
    if (declared && declared !== KIND.GREEN)
      return { green: null, kind: KIND.CONTRADICTION, declared,
        why: 'exit 0 with a declaration of ' + declared + ' — the instrument contradicts itself, and a '
           + 'contradiction is not a verdict' };
    return { green: true, kind: KIND.GREEN, declared: declared || null, why: 'exit 0' };
  }
  if (declared === KIND.REFUSED)
    return { green: null, kind: KIND.REFUSED, declared,
      why: 'exit ' + status + ' — the instrument DECLARED CANNOT-ANSWER. It ran; it had no finding to '
         + 'report about this row, and a refusal is not evidence in either direction' };
  if (declared === KIND.RED)
    return { green: false, kind: KIND.RED, declared, why: 'exit ' + status + ' (declared VERDICT-RED)' };
  if (declared === KIND.GREEN)
    return { green: true, kind: KIND.GREEN, declared, why: 'exit ' + status + ' (declared VERDICT-GREEN)' };
  if (status === 1) return { green: false, kind: KIND.RED, declared: null, why: 'exit 1' };
  return { green: null, kind: KIND.UNDECLARED, declared: null,
    why: 'exit ' + status + ' — a code outside {0,1} that the instrument never declared, so it is NOT '
       + 'read as a verdict. Declare it with a line `ABRA-EXIT ' + status + ' <VERDICT-RED|CANNOT-ANSWER>`' };
}

/* ONE RUN PER DISTINCT COMMAND. Four rows closed on tests/test-seed-clock.js is the normal shape —
 * a gate is built for a defect and the defect splits — and running it four times costs four times as
 * much for an identical answer. Cached on the exact command STRING, so `--flag` variants stay
 * separate; there is no staleness risk because the whole cache lives for one process. */
const RUN_CACHE = new Map();
function run(cmd) {
  if (RUN_CACHE.has(cmd)) return { ...RUN_CACHE.get(cmd), cached: true };
  const r = runUncached(cmd);
  RUN_CACHE.set(cmd, r);
  return r;
}
/* `exec` is injectable ONLY so the selftest can drive this exact function with a synthetic child
 * result instead of a restatement of it. Nothing else passes it; the default is the real thing. */
function runUncached(cmd, exec) {
  /* A REFUSED MARKER IS A VERDICT OF ITS OWN, NOT A QUIET NOT-STARTED. `classifyMarker` builds the
   * argv, so the preloads keep their order and stay in front of the entry point — node ignores a `-r`
   * that lands after the script, and a preload built in the wrong position would run the child WITHOUT
   * it and look exactly like a run that had it. */
  const c = classifyMarker(cmd);
  if (!c.ok) return { green: null, kind: KIND.REJECTED, reject: c.code,
    why: 'MARKER REJECTED (' + c.code + '): ' + c.why + '  marker: `' + cmd + '`' };
  const args = c.argv;
  const t0 = Date.now();
  try {
    const out = (exec || execFileSync)(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: TIMEOUT_MS });
    return { ...classifyExit(0, out), ms: Date.now() - t0 };
  } catch (e) {
    /* NEVER STARTED, OR KILLED MID-RUN. Distinct from a refusal: this instrument produced no exit
     * code of its own at all. `e.status` is null when a signal ended it. */
    if (e && (e.code === 'ENOENT' || e.killed || e.status === null || e.status === undefined))
      return { green: null, kind: KIND.NOT_STARTED,
        why: 'the instrument could not be run: ' + String(e.message).split('\n')[0], ms: Date.now() - t0 };
    /* THE STDIO IS READ, NOT DISCARDED. execFileSync attaches the captured streams to the error on a
     * non-zero exit (asserted in the selftest against the real child, not assumed), and the
     * instrument's own declaration of what its exit code MEANS is in there. */
    return { ...classifyExit(e.status, String(e.stdout || '') + '\n' + String(e.stderr || '')),
      ms: Date.now() - t0 };
  }
}

/* ================= THE SPLIT: ENUMERATING IS NOT MEASURING ========================================
 *
 * ROADMAP #369. `--list` advertised *"coverage only; runs nothing"*, and that was TRUE of the
 * INSTRUMENTS and FALSE of the ARTIFACT. Both modes ran down ONE code path, differing only in a
 * ternary, and fell through together into the write site at the bottom of the file. So a listing —
 * the thing you do to LOOK at the register without disturbing it — republished it.
 *
 * MEASURED ON THIS FILE'S OWN PRE-FIX BYTES, 2026-08-23. One `--list` took the settled
 * 2026-08-22T01:55:12.569Z artifact from `premature_closes: 2, unrunnable: 1,
 * distinct_commands_run: 22` to `0, 0, 0` — 306 insertions and 144 deletions against HEAD, every
 * verdict replaced by `NOT RUN` — and then printed *"REGISTER REALITY: every marked row agrees with
 * its instrument"*, a verdict sentence about 22 instruments not one of which had been started.
 * That second half is the worse half: the wipe leaves a trace in git, the false sentence does not.
 *
 * THE BLAST RADIUS IS A GATE. `openDefectClause` in engine/quarantine.js sorts each open row by the
 * `green` tri-state it finds here (quarantine.js:1570-1576): `false` -> withRed, `true` -> staleRows,
 * anything else -> unrunnable, and `ok` is `withRed.length === 0`. A wiped artifact carries `green:
 * null` on every row, so the FIVE rows whose instruments were measured RED (#218, #224, #241, #258,
 * #273) stop holding the clause shut — it reports OK for exactly the reason that should make it
 * loudest.
 *
 * THE FIX IS A SPLIT, NOT A FLAG CHECK BOLTED TO THE WRITE SITE. `if (!has('--list')) write(...)` is
 * one careless edit away from being wandered around, and it leaves the two behaviours sharing a body
 * that a reader has to hold two states in their head to follow. Instead:
 *
 *   enumerate(lines)   PURE. Parses the register and computes coverage. Starts no instrument, opens
 *                      no artifact. This is all `--list` gets to call.
 *   measure(en)        The ONLY thing that runs an instrument, and the ONLY producer of a
 *                      MEASUREMENT — an object carrying the module-private token below.
 *   publish(m, art)    THROWS unless it is handed a real measurement. The listing path never
 *                      constructs one, so it cannot write even if a later edit calls publish from it.
 *
 * AND `NOT RUN` IS GONE FROM THE VERDICT VOCABULARY. There is no longer a value this artifact could
 * carry meaning "this row was never checked", because there is no longer a code path that builds a
 * row without checking it. `publish` re-asserts that at the write site: a verdict outside VERDICTS
 * refuses the write rather than recording it.
 *
 * NOT MADE IDEMPOTENT, DELIBERATELY. Rewriting the file with identical content would still move its
 * mtime and its provenance, and the artifact's whole job is to say WHEN a verdict was measured.
 *
 * `--json` STILL WRITES, and that is not an inconsistency. `--json` runs every instrument; it is the
 * measurement wearing a different renderer, so its timestamp is honest. `--list` runs none. */
const MEASUREMENT_TOKEN = Symbol('register_reality: this came from a real run of the instruments');
const VERDICTS = new Set(['STALE ROW', 'PREMATURE CLOSE', 'CONFIRMED', 'UNVERIFIABLE',
  'INSTRUMENT OWED', 'INSTRUMENT UNRUNNABLE', 'INSTRUMENT CANNOT ANSWER', 'EXIT CODE UNDECLARED',
  'MARKER REJECTED']);

/* PURE. Everything `--list` is allowed to touch lives in here. */
function enumerate(lines) {
  const rows = parse(lines);
  const marked = rows.filter(r => r.cmd);
  const owed = rows.filter(r => !r.cmd && r.owed);
  const openBroken = rows.filter(r => !r.closed && r.saysBroken);
  /* COMPUTED HERE BECAUSE classifyMarker IS PURE, so `--list` reports a marker this file will never
   * run WITHOUT running anything and WITHOUT touching the artifact. That is the honest place for it:
   * a rejected marker is a fact about the REGISTER, not a measurement of an instrument. */
  const rejected = marked.map(r => ({ r, c: classifyMarker(r.cmd) })).filter(x => !x.c.ok)
    .map(x => ({ n: x.r.n, cmd: x.r.cmd, code: x.c.code, why: x.c.why, title: x.r.title }));
  return {
    rows, marked, owed, openBroken, rejected,
    coverage: {
      register_rows: rows.length,
      id_rows: rows.idRows,
      open_asserting_breakage: openBroken.length,
      marked: marked.length,
      open_asserting_breakage_and_marked: openBroken.filter(r => r.cmd).length,
      instrument_owed: owed.length,
      open_asserting_breakage_and_owed: openBroken.filter(r => !r.cmd && r.owed).length,
      /* THE FIGURE THE NINE HID BEHIND. It is meant to be zero, and it is printed on every run and
       * every listing so that it cannot go quiet again. */
      markers_rejected: rejected.length,
      markers_rejected_and_open_asserting_breakage:
        rejected.filter(x => openBroken.some(o => o.n === x.n)).length,
    },
    unverifiable_open_defects: openBroken.filter(r => !r.cmd && !r.owed).map(r => ({ n: r.n, title: r.title })),
  };
}
const readRegister = () =>
  enumerate(fs.readFileSync(path.join(ROOT, 'docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/));

/* THE ONLY PLACE AN INSTRUMENT IS STARTED, AND THE ONLY PLACE A MEASUREMENT IS MINTED. */
function measure(en) {
  const results = [];
  for (const r of en.marked) {
    const res = run(r.cmd);
    results.push({ ...r, ...res, verdict: verdict(r, res.green, res.kind) });
  }
  return { token: MEASUREMENT_TOKEN, en, results };
}

function buildArtifact(m) {
  if (!m || m.token !== MEASUREMENT_TOKEN)
    throw new Error('register_reality: buildArtifact() was not handed a measurement. Only measure() '
      + 'produces one, and only a run of the instruments produces verdicts (ROADMAP #369).');
  const c = m.en.coverage, results = m.results;
  return {
    generated: new Date().toISOString(),
    by: 'engine/register_reality.js',
    what: 'Every register row that names the instrument deciding it, run, with its exit code compared '
        + 'to the row\'s open/closed status.',
    why: 'docs/ROADMAP.md is read by engine/quarantine.js as a GATE INPUT and nothing checked it against '
       + 'reality. On 2026-08-14 four rows were stale rather than live and two of them were put in front '
       + 'of a human as the place to start. A row nobody re-verifies is prose.',
    weaker_than_it_looks: 'A green instrument means THAT instrument sees nothing. It is not a '
        + 'derivation of the row\'s claim. It is strictly more than the register had, which was nothing.',
    counts: {
      register_rows: c.register_rows,
      id_rows: c.id_rows,
      open_asserting_breakage: c.open_asserting_breakage,
      marked: c.marked,
      open_asserting_breakage_and_marked: c.open_asserting_breakage_and_marked,
      stale_rows: results.filter(r => r.verdict === 'STALE ROW').length,
      premature_closes: results.filter(r => r.verdict === 'PREMATURE CLOSE').length,
      unrunnable: results.filter(r => r.verdict === 'INSTRUMENT UNRUNNABLE').length,
      /* THE INSTRUMENT RAN AND REFUSED. Kept out of `unrunnable` because "never started" and "ran and
       * had nothing to say" are different facts, and out of the red counts because a refusal is not a
       * finding. Both were published as RED until 2026-08-23 — see classifyExit(). */
      cannot_answer: results.filter(r => r.verdict === 'INSTRUMENT CANNOT ANSWER').length,
      /* THE COVERAGE FIGURE FOR THE CONVENTION ITSELF, and it is meant to be driven down. Every row
       * here is an instrument that exited outside {0,1} without declaring what it meant, so this file
       * had to refuse to read it as a verdict. */
      exit_codes_undeclared: results.filter(r => r.verdict === 'EXIT CODE UNDECLARED').length,
      /* KEPT SEPARATE FROM `marked` ON PURPOSE. A row that has DECLARED nothing decides it is better
       * than a row that says nothing at all, and it is not the same thing as a verified row. Folding
       * the two into one coverage figure would be the caption-instead-of-a-quarantine move. */
      instrument_owed: c.instrument_owed,
      open_asserting_breakage_and_owed: c.open_asserting_breakage_and_owed,
      /* KEPT OUT OF `unrunnable`. Until 2026-09-04 a marker this file refused to read was counted
       * there beside gates that ENOENT'd or were killed — one bucket of 27, in which nine markers
       * refused by SAFE were indistinguishable from broken instruments. A defect in the ruler and a
       * defect in the world do not share a number. */
      markers_rejected: c.markers_rejected,
      markers_rejected_and_open_asserting_breakage: c.markers_rejected_and_open_asserting_breakage,
      distinct_commands_run: RUN_CACHE.size,
    },
    markers_rejected: m.en.rejected,
    instrument_owed: m.en.owed.map(r => ({ n: r.n, owes: r.owed, title: r.title })),
    /* WRITTEN THROUGH THE READER'S OWN KEY, NEVER SPELLED AGAIN — 2026-08-18.
     *
     * This said `results,` and `engine/quarantine.js`'s open-defect clause read `rr.rows`, `v.command`
     * and `v.exit` against this file's `results`, `cmd` and `green`. THREE key names, none matching, so
     * the clause saw zero verdicts on every run it has ever made and printed *"no open row names an
     * instrument that is RED"* — while #258's instrument was exiting 1. Nothing failed; the number was
     * simply never true. That is the `merge_mega_into_engine.js` failure to the letter: 67 writes, zero
     * matching keys, and no check comparing the two files.
     *
     * The key now comes from the consumer. The selftest above round-trips a built artifact back through
     * `Q.registerRealityRows`, so a rename on either side is RED rather than silent. */
    [Q.REGISTER_REALITY.rowsKey]: results,
    unverifiable_open_defects: m.en.unverifiable_open_defects,
  };
}

/* THE WRITE SITE, AND THE ONLY ONE. It refuses on the DATA rather than on the FLAG: a caller that is
 * not holding a measurement cannot publish, and neither can a measurement carrying a verdict that no
 * instrument produced. A `has('--list')` check here would be a restatement of the mode, which is what
 * failed. */
function publish(m, art) {
  if (!m || m.token !== MEASUREMENT_TOKEN)
    throw new Error('register_reality: REFUSING to write data/register-reality.json — publish() was not '
      + 'handed a measurement. This artifact records WHEN each verdict was measured; writing it from '
      + 'anything but a run of the instruments makes that timestamp a lie (ROADMAP #369).');
  for (const r of art[Q.REGISTER_REALITY.rowsKey])
    if (!VERDICTS.has(r.verdict))
      throw new Error('register_reality: REFUSING to write data/register-reality.json — row #' + r.n
        + ' carries verdict ' + JSON.stringify(r.verdict) + ', which no instrument produced.');
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
}

/* ---- rendering, shared by both paths so the coverage block cannot drift between them ------------ */
function renderCoverage(c) {
  console.log('  ' + String(c.register_rows).padStart(4) + '  defect-register rows  (of ' + c.id_rows
    + ' `| #N |` rows in the file; the other ' + (c.id_rows - c.register_rows)
    + ' are planning tables with no status cell to check an exit code against)');
  console.log('  ' + String(c.open_asserting_breakage).padStart(4) + '  OPEN and asserting breakage  (the MEDICHAM gate counts these)');
  console.log('  ' + String(c.open_asserting_breakage_and_marked).padStart(4) + '  of those, naming the instrument that decides them');
  console.log('  ' + String(c.open_asserting_breakage_and_owed).padStart(4) + '  of those, DECLARING that nothing decides them (a debt, not coverage)');
  console.log('  ' + String(c.marked).padStart(4) + '  rows carrying a VERIFIED BY marker in total');
  console.log('  ' + String(c.instrument_owed).padStart(4) + '  rows declaring INSTRUMENT OWED — nothing decides them and they say so');
  console.log('  ' + String(c.markers_rejected).padStart(4) + '  markers this file REFUSES TO READ — they name an instrument that is never started ('
    + c.markers_rejected_and_open_asserting_breakage + ' on an OPEN row asserting breakage)');
}
/* THE REJECTED BLOCK, PRINTED BY BOTH PATHS. The marker is printed IN FULL next to the rule that
 * refused it, because "9 rejected" is a number somebody skims and a marker somebody can fix is a
 * marker they can see. This is the half of ROADMAP #521 that was missing: the spelling was widened
 * and the SILENCE was left in place, so nine more went the same way through other doors. */
function renderRejected(en) {
  if (!en.rejected.length) return;
  console.log('  MARKER REJECTED — these rows NAME an instrument and this file refused to read the marker,');
  console.log('  so NOTHING RAN and the row is neither verified nor reported as unverified:');
  for (const x of en.rejected) {
    console.log('      #' + String(x.n).padEnd(5) + '[' + x.code + ']  `' + x.cmd + '`');
    console.log('             ' + x.why);
  }
  console.log('');
}
function renderOwedAndProse(en) {
  if (en.owed.length) {
    console.log('  INSTRUMENT OWED — no gate decides these, and the row now says what would have to be built:');
    for (const r of en.owed) console.log('      #' + String(r.n).padEnd(5) + String(r.owed).slice(0, 110));
    console.log('');
  }
  if (en.unverifiable_open_defects.length) {
    console.log('  NO INSTRUMENT NAMED — these rows are still prose, and that is the coverage number:');
    for (const r of en.unverifiable_open_defects) console.log('      #' + String(r.n).padEnd(5) + r.title);
    console.log('');
  }
  console.log('  Add one to a row with:   VERIFIED BY: `node tests/<the gate that decides it>.js`');
  console.log('  If nothing decides it:   INSTRUMENT OWED: <the gate that would have to exist>');
}

/* THE WHOLE LISTING PATH, IN ONE FUNCTION THAT CANNOT WRITE. It does not call process.exit either —
 * the driver does — so the selftest can run it end to end with fs.writeFileSync booby-trapped and
 * assert the trap never fires. A claim that a path does not write is worth what its demonstration is
 * worth; this one is demonstrated on every run of the selftest. */
function renderListing(en, opts) {
  if (opts && opts.json) {
    console.log(JSON.stringify({
      listing: true,
      wrote: null,
      not_a_verdict: 'This is a COVERAGE LISTING. No instrument was run and data/register-reality.json '
        + 'was neither read nor written. The verdicts in that file are whatever the last real run measured.',
      coverage: en.coverage,
      marked: en.marked.map(r => ({ n: r.n, cmd: r.cmd, title: r.title })),
      /* NOT A MEASUREMENT AND SO LEGITIMATE HERE: whether this file can READ a marker is decided
       * lexically, with nothing started and nothing opened. */
      markers_rejected: en.rejected,
      instrument_owed: en.owed.map(r => ({ n: r.n, owes: r.owed, title: r.title })),
      unverifiable_open_defects: en.unverifiable_open_defects,
    }, null, 2));
    return;
  }
  console.log('\nREGISTER REALITY --list — COVERAGE ONLY. NO INSTRUMENT WAS RUN AND NOTHING WAS WRITTEN.\n');
  renderCoverage(en.coverage);
  console.log('');
  for (const r of en.marked)
    console.log('  ' + 'NOT RUN'.padEnd(22) + '#' + String(r.n).padEnd(5) + '--list: not run'.padEnd(22) + r.title);
  console.log('');
  renderRejected(en);
  renderOwedAndProse(en);
  console.log('\n  THIS IS NOT A VERDICT. data/register-reality.json was NOT written, and no row above was\n'
    + '  compared to anything. For the verdicts, run:   node engine/register_reality.js\n');
}

if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const R = (closed, cmd, owes) => ({ n: 1, title: 't', closed, saysBroken: true, cmd, owed: owes || null });
  const C = 'node tests/x.js';
  ok('RED — an OPEN row whose instrument is GREEN is a STALE ROW, the case that costs an agent',
    verdict(R(false, C), true) === 'STALE ROW', verdict(R(false, C), true));
  ok('RED — a CLOSED row whose instrument is RED is a PREMATURE CLOSE',
    verdict(R(true, C), false) === 'PREMATURE CLOSE', verdict(R(true, C), false));
  ok('an OPEN row with a RED instrument is CONFIRMED', verdict(R(false, C), false) === 'CONFIRMED');
  ok('a CLOSED row with a GREEN instrument is CONFIRMED', verdict(R(true, C), true) === 'CONFIRMED');
  ok('a row with no marker is UNVERIFIABLE, never assumed fine', verdict(R(false, null), true) === 'UNVERIFIABLE');
  ok('a row that DECLARES nothing decides it reads INSTRUMENT OWED, not UNVERIFIABLE',
    verdict(R(false, null, 'a gate on board.movePower'), true) === 'INSTRUMENT OWED');
  ok('RED — an INSTRUMENT OWED row is NOT counted as a failure; it is declared debt, not disagreement',
    !BAD.has('INSTRUMENT OWED'));
  ok('a VERIFIED BY marker WINS over an INSTRUMENT OWED note on the same row — a runnable gate is '
    + 'always stronger than a declaration that none exists',
    verdict(R(false, C, 'something'), false) === 'CONFIRMED');
  ok('RED — an instrument that will not run is NOT treated as agreement',
    verdict(R(false, C), null) === 'INSTRUMENT UNRUNNABLE' && BAD.has('INSTRUMENT UNRUNNABLE'));
  /* THE PARSER, ON SYNTHETIC ROWS. A marker that is not picked up reads as coverage that does not
   * exist, which is the failure this file is about wearing its own uniform. */
  const p = parse([
    '| #1 | **A THING.** VERIFIED BY: `node tests/a.js` | open — DEFECT |',
    '| #2 | **ANOTHER.** nothing here | open — DEFECT |',
    '| #3 | **A CLOSED ONE.** VERIFIED BY: `node tests/b.js --flag` | closed 2026-08-15 |',
  ]);
  ok('the marker is parsed off a row', p[0].cmd === 'node tests/a.js', p[0]);
  ok('a row without one carries null, not a guess', p[1].cmd === null);
  ok('flags survive the marker', p[2].cmd === 'node tests/b.js --flag', p[2]);
  ok('the closed-detector is the one the GATE uses, not a second copy', p[2].closed === true && p[0].closed === false);
  ok('RED — a marker that is not a plain node command is REFUSED rather than run, and it is refused '
    + 'as MARKER REJECTED naming the rule, not as a silent NOT-STARTED',
    run('rm -rf /').green === null && run('rm -rf /').kind === KIND.REJECTED
    && run('rm -rf /').reject === 'NOT A COMMAND', run('rm -rf /'));
  ok('RED — a shell chain hidden after a legitimate script is refused too. There is no shell here, so '
    + 'those tokens are inert argv — it is refused because the marker would then run a DIFFERENT '
    + 'command than the one written while the row is reported as decided by it',
    run('node tests/a.js && curl evil').green === null
    && run('node tests/a.js && curl evil').reject === 'NEEDS A SHELL');
  /* -- THE `-r` PRELOAD, 2026-08-28 -------------------------------------------------------------
   *
   * Every one of these is RED on the pre-fix `SAFE`, which required `node` to be followed IMMEDIATELY
   * by the script. The first is the whole finding: three real markers read NOT_STARTED while
   * tests/run-all.js counted them as accounted for, so they read GREEN without ever running.
   *
   * The args are inspected through the SHIPPING runUncached with a recording exec, not by re-applying
   * the regex here — a restatement of the regex would agree with itself whatever the builder did. */
  const seenArgs = [];
  const recExec = (bin, a) => { seenArgs.push(a); return ''; };
  const PRE = 'node -r ./tests/_live_release.js tests/probe_x.js';
  seenArgs.length = 0;
  const preRun = runUncached(PRE, recExec);
  ok('RED — a `-r <repo script>` PRELOAD is accepted. The three markers this was found on were '
    + 'reported NOT_STARTED while PENDING_WIRE counted them as run',
    preRun.kind === KIND.GREEN, preRun);
  ok('RED — the preload is passed to the child, in front of the entry point, with both paths rooted '
    + 'at ROOT. node ignores a -r that lands after the script, which would look identical to a run '
    + 'that had it',
    seenArgs.length === 1 && seenArgs[0].length === 3 && seenArgs[0][0] === '-r'
    && seenArgs[0][1] === path.join(ROOT, 'tests', '_live_release.js')
    && seenArgs[0][2] === path.join(ROOT, 'tests', 'probe_x.js'), seenArgs[0]);
  seenArgs.length = 0;
  runUncached('node -r ./tests/_live_release.js tests/probe_x.js --verify-inert', recExec);
  ok('flags still survive alongside a preload, and land AFTER the script',
    seenArgs.length === 1 && seenArgs[0][3] === '--verify-inert', seenArgs[0]);
  const rej = (c, code) => { const r = runUncached(c, recExec); return r.kind === KIND.REJECTED && (!code || r.reject === code); };
  ok('RED — a preload OUTSIDE the repository is refused. The marker names a path inside this repo, '
    + 'and `-r` executes it in this process tree exactly as the script is executed',
    rej('node -r /etc/passwd tests/a.js', 'LOADS OUTSIDE THE REPO')
    && rej('node -r ../../evil.js tests/a.js', 'LOADS OUTSIDE THE REPO')
    && rej('node -r C:/evil.js tests/a.js', 'LOADS OUTSIDE THE REPO'));
  ok('RED — a preload that is not a .js file is refused, and so is a bare `-r` with no path',
    rej('node -r tests/evil.sh tests/a.js', 'LOADS OUTSIDE THE REPO')
    && rej('node -r tests/a.js', 'NO ENTRY POINT'));
  ok('RED — the ENTRY POINT is held to the same bar as the preload, by path.resolve rather than by '
    + 'a regex over the string: a relative escape, an absolute path and a bare drive letter are one '
    + 'rule, not three',
    rej('node ../../evil.js', 'LOADS OUTSIDE THE REPO') && rej('node /etc/passwd', 'LOADS OUTSIDE THE REPO')
    && rej('node C:/evil.js', 'LOADS OUTSIDE THE REPO') && rej('node tests/evil.sh', 'LOADS OUTSIDE THE REPO'));

  /* -- THE NINE, AND WHY THE BARE-VALUE RULE WAS RETIRED — 2026-09-04 ---------------------------
   *
   * The assertion that used to sit here read: *"widening for `-r` did NOT widen for bare values …
   * admitting them would put multi-minute game-playing runs that REWRITE shared artifacts inside
   * every register pass"*. It is retired rather than quietly deleted, because it was GREEN and FALSE,
   * and the reason is one line of measurement: the old regex permitted `--[A-Za-z0-9_\-=]+`, and `=`
   * is in that class. Every command it named was already admitted one character away. Both spellings
   * are asserted below so that claim cannot rot back into prose. */
  const EQ_PAIRS = [
    ['node tests/roster.js --stage moves', 'node tests/roster.js --stage=moves'],
    ['node engine/all_mechanics_fire.js --kind abilities', 'node engine/all_mechanics_fire.js --kind=abilities'],
    ['node engine/game_differential.js --arm middle', 'node engine/game_differential.js --arm=middle'],
  ];
  ok('RED — THE MEASUREMENT THAT RETIRED THE BARE-VALUE RULE. The pre-fix SAFE gave two DIFFERENT '
    + 'answers to two spellings of ONE command, admitting `--arm=middle` while refusing `--arm middle`. '
    + 'A rule that does that is measuring the spelling, so there was no cost guard to preserve',
    EQ_PAIRS.every(([a, b]) => {
      const HEAD = /^node\s+((?:-r\s+(?:\.[\\/])?(?:engine|tests|build)[\\/][A-Za-z0-9_.\-]+\.js\s+)*)((?:engine|tests|build)[\\/][A-Za-z0-9_.\-]+\.js)((?:\s+--[A-Za-z0-9_\-=]+)*)\s*$/;
      return HEAD.test(b) && !HEAD.test(a);          /* the pre-fix rule disagreed with itself */
    }));
  ok('RED — and the rule now in force gives ONE answer to both spellings, which is the property the '
    + 'old one only approximated',
    EQ_PAIRS.every(([a, b]) => classifyMarker(a).ok === true && classifyMarker(b).ok === true));
  ok('RED — post-entry tokens reach the child VERBATIM, bare values included. Node stops reading '
    + 'options at the entry point, so these are input to repo code and never anything node interprets',
    (() => { seenArgs.length = 0;
      runUncached('node engine/game_differential.js --arm middle --team-store data/team-pool-frozen', recExec);
      return seenArgs.length === 1 && JSON.stringify(seenArgs[0].slice(1))
        === JSON.stringify(['--arm', 'middle', '--team-store', 'data/team-pool-frozen']); })(),
    seenArgs[0]);
  ok('RED — a `SHOWDOWN_PATH=… node …` marker is STILL refused, and now says WHY: an environment '
    + 'assignment is a shell feature, and with no shell it would be taken as the program name',
    rej('SHOWDOWN_PATH=/real/path node tests/a.js', 'NEEDS A SHELL'));
  ok('RED — the four markers spelled `SHOWDOWN_PATH=... node …` are refused as PLACEHOLDER, not as '
    + 'a shell problem: no widening of any kind makes an unexpanded `...` or `<id>` runnable, and the '
    + 'row is what has to change',
    rej('SHOWDOWN_PATH=... node tests/roster.js --stage moves', 'PLACEHOLDER')
    && rej('node tests/roster.js --stage items --release <id>', 'PLACEHOLDER'));
  ok('RED — a marker that is not a command at all (#330 carries a DATA FILE PATH) is refused as '
    + 'NOT A COMMAND. It read as coverage for as long as the refusal was silent',
    rej('data/switchin-order.json', 'NOT A COMMAND'));
  ok('RED — EVERY shell metacharacter class is refused, not the two that were thought of: a pipe, a '
    + 'redirect, a semicolon, a substitution, a backquote, a glob and a quote',
    ['node tests/a.js | tee x', 'node tests/a.js > data/register-reality.json',
      'node tests/a.js; rm -rf data', 'node tests/a.js $(cat /etc/passwd)',
      'node tests/a.js --out `whoami`', 'node tests/*.js', 'node tests/a.js --x "y z"',
    ].every(c => rej(c, 'NEEDS A SHELL')));
  ok('RED — an option that hands node CODE is refused whatever its value, and `-e`/`-p`/`--import` '
    + 'are named only to improve the sentence',
    rej('node -p 1', 'EVALUATES CODE') && rej('node --import ./evil.mjs tests/a.js', 'EVALUATES CODE'));
  /* THE ANSWER TO "WOULD THIS CATCH A SECOND INSTANCE, SPELLED DIFFERENTLY, THROUGH ANOTHER DOOR?"
   * #521 enumerated one wrong form and nine walked past it. The pre-entry region now FAILS CLOSED:
   * an option nobody here has heard of is refused, so the next `-r` cannot be admitted by silence. */
  ok('RED — AN UNRECOGNISED NODE OPTION IS REFUSED BY DEFAULT rather than admitted by silence. This '
    + 'is the assertion that answers #521: a pre-entry token nobody enumerated cannot walk past, '
    + 'because the default in that region is REFUSE and the refusal is LOUD',
    rej('node --max-old-space-size=4096 engine/fit_policy.js', 'UNKNOWN NODE OPTION')
    && rej('node --nonsense-option-invented-today tests/a.js', 'UNKNOWN NODE OPTION'));

  /* -- THE LOUD HALF, AND IT IS THE HALF THAT MATTERS -------------------------------------------
   *
   * #521 widened the spelling and left the SILENCE in place, so nine more markers went the same way
   * through other doors. Everything below is about the silence rather than the regex: a marker this
   * file refuses must be DISTINGUISHABLE from a broken instrument, must be counted, and must be
   * printed with the marker text and the rule that refused it. */
  ok('RED — A REJECTED MARKER IS ITS OWN VERDICT. It used to degrade to INSTRUMENT UNRUNNABLE, which '
    + 'is the label a gate that ENOENTs or gets killed produces — 27 rows in one bucket, nine of them '
    + 'markers SAFE would not read. A defect in the RULER and a defect in the WORLD are not one fact',
    verdict(R(false, C), null, KIND.REJECTED) === 'MARKER REJECTED'
    && verdict(R(false, C), null, KIND.NOT_STARTED) === 'INSTRUMENT UNRUNNABLE'
    && verdict(R(false, C), null, KIND.REJECTED) !== verdict(R(false, C), null, KIND.NOT_STARTED),
    verdict(R(false, C), null, KIND.REJECTED));
  ok('RED — a rejected marker is BAD, so this file exits 1 on it. A row claiming to be decided by '
    + 'something that was never started is the coverage lie, not a note',
    BAD.has('MARKER REJECTED') && VERDICTS.has('MARKER REJECTED'));
  ok('RED — a rejected marker is NOT read as agreement in either direction, on an open row or a '
    + 'closed one. CONFIRMED off a marker nothing read is the "capability absent, everything reported '
    + 'success" shape',
    ['CONFIRMED', 'STALE ROW', 'PREMATURE CLOSE']
      .every(v => verdict(R(true, C), null, KIND.REJECTED) !== v
                && verdict(R(false, C), null, KIND.REJECTED) !== v));
  /* THE COUNT AND THE NAMES, THROUGH THE PURE ENUMERATOR — so `--list` reports a marker that will
   * never run WITHOUT starting anything, which is the only way to see this before paying for a run. */
  const ENR = enumerate([
    '| #1 | **A GOOD ONE.** VERIFIED BY: `node tests/a.js` | open — DEFECT |',
    '| #2 | **A TEMPLATE.** VERIFIED BY: `SHOWDOWN_PATH=... node tests/roster.js --stage moves` | open — DEFECT |',
    '| #3 | **NOT A COMMAND.** VERIFIED BY: `data/switchin-order.json` | open — DEFECT |',
    '| #4 | **NO MARKER.** plain prose | open — DEFECT |',
  ]);
  ok('RED — enumerate() counts rejected markers PURELY, so the figure exists without running an '
    + 'instrument and `--list` can print it',
    ENR.coverage.markers_rejected === 2 && ENR.coverage.marked === 3
    && ENR.coverage.markers_rejected_and_open_asserting_breakage === 2, ENR.coverage);
  ok('RED — each rejection carries the ROW, the MARKER TEXT and the RULE that refused it. "9 rejected" '
    + 'is a number somebody skims; a marker somebody can fix is one they can see',
    ENR.rejected.length === 2
    && ENR.rejected[0].n === 2 && ENR.rejected[0].code === 'PLACEHOLDER'
    && /SHOWDOWN_PATH/.test(ENR.rejected[0].cmd) && ENR.rejected[0].why.length > 20
    && ENR.rejected[1].n === 3 && ENR.rejected[1].code === 'NOT A COMMAND', ENR.rejected);
  ok('RED — the rejected marker is not merely counted, it is PRINTED, with its text and its reason. '
    + 'The nine survived a table built to prevent exactly this because nothing said their names',
    (() => {
      const out = []; const realLog = console.log;
      console.log = (...a) => out.push(a.join(' '));
      try { renderRejected(ENR); } finally { console.log = realLog; }
      const t = out.join('\n');
      return /MARKER REJECTED/.test(t) && /#2/.test(t) && /#3/.test(t)
        && /SHOWDOWN_PATH=\.\.\. node tests\/roster\.js --stage moves/.test(t)
        && /PLACEHOLDER/.test(t) && /NOT A COMMAND/.test(t) && /data\/switchin-order\.json/.test(t);
    })());
  ok('a register with nothing rejected prints NOTHING here — a block that fires on a clean run is a '
    + 'block people learn to skip (#148)',
    (() => {
      const out = []; const realLog = console.log;
      console.log = (...a) => out.push(a.join(' '));
      try { renderRejected(enumerate(['| #1 | **FINE.** VERIFIED BY: `node tests/a.js` | open — DEFECT |'])); }
      finally { console.log = realLog; }
      return out.length === 0;
    })());
  /* THE OWED MARKER, THROUGH THE PARSER, because a marker that is not picked up reads as prose and a
   * marker picked up off the wrong row reads as debt somebody else owes. */
  const po = parse([
    '| #4 | **NO GATE.** INSTRUMENT OWED: a gate asserting board.weather expires | open — DEFECT |',
    '| #5 | **HAS ONE.** VERIFIED BY: `node tests/a.js` INSTRUMENT OWED: ignored | open — DEFECT |',
    '| #6 | **NEITHER.** plain prose | open — DEFECT |',
  ]);
  ok('the owed note is parsed off a row and stops at the table cell boundary',
    po[0].owed === 'a gate asserting board.weather expires', po[0]);
  ok('a row with a real gate does NOT also read as owed — otherwise the debt figure double-counts',
    po[1].owed === null && po[1].cmd === 'node tests/a.js', po[1]);
  ok('a row with neither carries null for both', po[2].owed === null && po[2].cmd === null);
  /* THE CACHE, because a wrong cache would report one gate's exit code under another gate's name. */
  RUN_CACHE.clear();
  const c1 = run('node tests/does-not-exist-xyz.js');
  const c2 = run('node tests/does-not-exist-xyz.js');
  ok('the same command runs once and the second read is served from the cache',
    c2.cached === true && c1.cached !== true && c2.green === c1.green, { c1, c2 });
  ok('RED — a DIFFERENT command is not served from the first one cache entry',
    run('node tests/other-missing-xyz.js').cached !== true);
  /* -- THE WIRE TO THE GATE, ROUND-TRIPPED THROUGH BOTH SHIPPING SIDES ----------------------
   *
   * The clause in `quarantine.js` reads this file's artifact. For its whole life it read `rr.rows`,
   * `v.command` and `v.exit` against the `results`, `cmd` and `green` written here: three key names,
   * none matching, zero rows carried, and the clause reported "no open row names an instrument that
   * is RED" while #258's instrument exited 1. Nothing could catch it because nothing compared the two
   * files — the `merge_mega_into_engine.js` shape exactly.
   *
   * So the artifact below is built with the SHIPPING key (`Q.REGISTER_REALITY.rowsKey`) and read back
   * with the SHIPPING reader (`Q.registerRealityRows`). A rename on either side is RED here. The RED
   * case is the one that matters: an artifact under any other key must come back NULL, never `[]`,
   * because "no rows" and "I cannot see the rows" are the two answers this bug confused. */
  const WIRE = { [Q.REGISTER_REALITY.rowsKey]: [
    { n: 258, cmd: 'node tests/x.js', green: false, verdict: 'CONFIRMED' },
    { n: 99, cmd: 'node tests/y.js', green: true, verdict: 'STALE ROW' },
    { n: 98, cmd: null, green: null, verdict: 'UNVERIFIABLE' }] };
  const back = Q.registerRealityRows(WIRE);
  ok('THE WIRE — an artifact written with this file KEYS is READ by the gate reader, not dropped',
    Array.isArray(back) && back.length === 3, back);
  ok('THE WIRE — the command and the tri-state exit survive the crossing intact',
    back && back[0].n === 258 && back[0].cmd === 'node tests/x.js' && back[0].green === false
    && back[1].green === true && back[2].cmd === null && back[2].green === null, back);
  ok('RED — an artifact under the OLD key comes back NULL, not an empty list: "no rows" and '
    + '"I cannot see the rows" are the two answers this bug confused',
    Q.registerRealityRows({ rows: [{ n: 1, cmd: 'node tests/x.js', green: false }] }) === null);
  ok('RED — a row spelling its command the OLD way carries no command rather than a silent pass',
    (Q.registerRealityRows({ [Q.REGISTER_REALITY.rowsKey]: [{ n: 1, command: 'node tests/x.js', exit: 1 }] })
      || [{}])[0].cmd === null);

  /* -- ROADMAP #369: A READ-ONLY FLAG THAT WRITES ---------------------------------------------
   *
   * These four are the structural half of the fix. The behavioural half — that the real `--list`
   * process leaves data/register-reality.json byte-identical — is asserted from OUTSIDE this file,
   * by tests/test-register-reality-readonly.js, because a claim about a whole process is not one a
   * function inside that process can make honestly.
   *
   * Each was shown RED on the pre-fix bytes before being trusted: `verdict()` had no `NOT RUN` case
   * because the driver spelled it inline, the driver reached `fs.writeFileSync` unconditionally, and
   * there was no publish() to refuse anything. */
  const threw = (f) => { try { f(); return null; } catch (e) { return e; } };
  ok('RED — `NOT RUN` is not a verdict this file can produce for ANY row, at any tri-state. It was '
    + 'the value the listing path wrote over 22 measured verdicts with',
    [true, false, null].every(g => [true, false].every(cl =>
      [null, 'node tests/x.js'].every(cmd => verdict(R(cl, cmd), g) !== 'NOT RUN'))));
  ok('RED — buildArtifact REFUSES anything that is not a measurement, so an artifact cannot be '
    + 'assembled out of rows nothing ran',
    /REFUS|not handed a measurement/i.test(String(threw(() => buildArtifact({ results: [], en: {} })))));
  /* THE WRITER IS BOOBY-TRAPPED FOR THE REST OF THIS BLOCK. If any of it reaches the real
   * fs.writeFileSync the selftest fails LOUDLY instead of quietly republishing the artifact — the
   * exact accident #369 records, arriving through the check written to prevent it. */
  const realWrite = fs.writeFileSync, realLog = console.log;
  const trap = [];
  fs.writeFileSync = (...a) => { trap.push(String(a[0])); throw new Error('THE WRITER WAS REACHED'); };
  const EN0 = enumerate(['| #7 | **NO MARKER HERE.** plain prose | open — DEFECT |']);
  const m0 = measure(EN0);                       /* no row names an instrument, so nothing is run */
  const notMine = threw(() => publish({ token: {}, results: [] }, { [Q.REGISTER_REALITY.rowsKey]: [] }));
  const badVerdict = threw(() => publish(m0, { [Q.REGISTER_REALITY.rowsKey]: [{ n: 1, verdict: 'NOT RUN' }] }));
  let listingErr = null;
  console.log = () => {};
  listingErr = threw(() => { renderListing(EN0); renderListing(EN0, { json: true }); });
  console.log = realLog;
  fs.writeFileSync = realWrite;
  ok('RED — publish() REFUSES a caller that is not holding a measurement, and refuses at the WRITE '
    + 'SITE rather than by re-reading the mode flag',
    notMine && /REFUSING to write/.test(String(notMine)) && trap.length === 0, String(notMine));
  ok('RED — publish() REFUSES a row carrying a verdict no instrument produced, even from a real '
    + 'measurement: the artifact may not record "never checked" as a finding',
    badVerdict && /REFUSING to write/.test(String(badVerdict)) && /NOT RUN/.test(String(badVerdict)),
    String(badVerdict));
  ok('RED — THE WHOLE LISTING PATH RUNS, BOTH RENDERERS, WITH fs.writeFileSync BOOBY-TRAPPED, AND '
    + 'NEVER TOUCHES IT. This is the assertion #369 is about',
    listingErr === null && trap.length === 0, { listingErr: listingErr && listingErr.message, trap });

  /* -- A REFUSAL IS NOT A RED VERDICT ----------------------------------------------------------
   *
   * Every one of these was RED on the pre-fix bytes, where the catch block read ANY non-zero exit as
   * `green: false`. They can be shown red again on demand without editing anything:
   *
   *     RR_CANNOT_ANSWER_AS_RED=1 node engine/register_reality.js --selftest
   *
   * The knob restores the defect exactly — every non-zero exit becomes a published RED verdict — and
   * the assertions below fail by name. That is the MEDI_* / ROSTER_* discipline: a claim about a fix
   * is worth what its demonstration is worth, and a demonstration nobody can re-run is prose.
   *
   * THE CASE THIS IS ABOUT IS THE UNDECLARED ONE. Neither `engine/gate_offfield_target.js` (#224) nor
   * `engine/gate_fail_and_silent.js` (#241) was edited to make this fix work: both exit 2, both
   * declare nothing, and both stop being published as red. That is the difference between a gate that
   * covers a class and one that covers the two instances somebody happened to name. */
  const cx = (s, t) => classifyExit(s, t || '');
  ok('exit 0 is a GREEN verdict — the universal convention, unchanged',
    cx(0).green === true && cx(0).kind === KIND.GREEN, cx(0));
  ok('exit 1 is a RED verdict — also the universal convention, and what node exits on an uncaught '
    + 'throw. A refusal spelled as exit 1 with no declaration is NOT catchable and this file says so',
    cx(1).green === false && cx(1).kind === KIND.RED, cx(1));
  ok('RED — an UNDECLARED exit outside {0,1} is NOT a verdict. This is #224 and #241 exactly: both '
    + 'exit 2 today, neither declares anything, and both were being published as red',
    cx(2).green === null && cx(2).kind === KIND.UNDECLARED, cx(2));
  ok('RED — a DECLARED refusal is not a verdict either, and it is labelled as a refusal rather than '
    + 'as an undeclared code',
    cx(2, 'ABRA-EXIT 2 CANNOT-ANSWER\nsome other output\n').green === null
    && cx(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n').kind === KIND.REFUSED, cx(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n'));
  ok('RED — a declaration is read off stderr as well as stdout: a gate that refuses may say so on '
    + 'either, and runUncached hands both to this function',
    cx(2, 'nothing on stdout\nABRA-EXIT 2 CANNOT-ANSWER from stderr\n').kind === KIND.REFUSED);
  /* THE LEGEND TRAP, IN THE GATE'S OWN WORDS. `engine/gate_offfield_target.js` prints this line on
   * EVERY run, including its green ones. A tolerant search for "cannot answer" would have called
   * every clean run a refusal — the same vocabulary-matching that put a metaphor into a gate. */
  ok('RED — the words "cannot answer" in an instrument PROSE do not make a refusal. The exit-0 legend '
    + '`[0 clean, 1 the placeholder is back, 2 cannot answer]` prints on every clean run of #224 gate',
    cx(0, '  exit 0   [0 clean, 1 the placeholder is back, 2 cannot answer]\n').green === true);
  ok('RED — a declaration naming a DIFFERENT exit code does not apply to this one',
    cx(3, 'ABRA-EXIT 2 CANNOT-ANSWER\n').kind === KIND.UNDECLARED, cx(3, 'ABRA-EXIT 2 CANNOT-ANSWER\n'));
  /* WITHOUT THIS ONE THE FIX WOULD WEAKEN A REAL RED. `engine/gate_fail_and_silent.js` uses exit 3 for
   * REGRESSION — a genuine verdict on a code outside {0,1} — and the undeclared rule would otherwise
   * turn it into not-evidence. It now declares itself, and this pins that the declaration is honoured. */
  ok('a DECLARED VERDICT-RED on a code outside {0,1} stays RED — exit 3 REGRESSION must not be '
    + 'softened into not-evidence by the undeclared rule',
    cx(3, 'ABRA-EXIT 3 VERDICT-RED\n').green === false, cx(3, 'ABRA-EXIT 3 VERDICT-RED\n'));
  ok('RED — a declaration that CONTRADICTS a zero exit is refused rather than guessed at',
    cx(0, 'ABRA-EXIT 0 CANNOT-ANSWER\n').green === null
    && cx(0, 'ABRA-EXIT 0 CANNOT-ANSWER\n').kind === KIND.CONTRADICTION);
  ok('the last declaration for the code wins, so a re-print cannot be shadowed by an earlier line',
    cx(2, 'ABRA-EXIT 2 VERDICT-RED\nABRA-EXIT 2 CANNOT-ANSWER\n').kind === KIND.REFUSED);
  ok('RED — the marker must be line-anchored: a declaration quoted mid-sentence is prose, not a '
    + 'declaration, or any file DESCRIBING this convention would refuse every gate that reads it',
    cx(2, 'the convention is ABRA-EXIT 2 CANNOT-ANSWER, described here\n').kind === KIND.UNDECLARED);

  /* THE VERDICT MAPPING. This is where the defect actually reached the register: an OPEN row read
   * CONFIRMED ("the row and the world agree") and a CLOSED row read PREMATURE CLOSE — an accusation
   * against whoever closed it — both off an exit code that said "I could not answer". */
  ok('RED — an OPEN row whose instrument REFUSED is INSTRUMENT CANNOT ANSWER, never CONFIRMED. '
    + 'A refusal is not the world agreeing with the row',
    verdict(R(false, C), null, KIND.REFUSED) === 'INSTRUMENT CANNOT ANSWER',
    verdict(R(false, C), null, KIND.REFUSED));
  ok('RED — a CLOSED row whose instrument REFUSED is NOT a PREMATURE CLOSE. Nothing measured it, so '
    + 'there is no accusation to make',
    verdict(R(true, C), null, KIND.UNDECLARED) === 'EXIT CODE UNDECLARED',
    verdict(R(true, C), null, KIND.UNDECLARED));
  ok('a refusal is still BAD — this file exits 1 on it. Not evidence is not the same as fine, and '
    + 'the row must not go quiet',
    BAD.has('INSTRUMENT CANNOT ANSWER') && BAD.has('EXIT CODE UNDECLARED'));
  ok('a refusal is NOT reported as INSTRUMENT UNRUNNABLE — that sentence would be false: the '
    + 'instrument ran perfectly well and declined to answer',
    verdict(R(false, C), null, KIND.REFUSED) !== 'INSTRUMENT UNRUNNABLE'
    && verdict(R(false, C), null, KIND.NOT_STARTED) === 'INSTRUMENT UNRUNNABLE');
  ok('RED — EVERY verdict this file can produce, across every tri-state and every kind, is one '
    + 'publish() will accept. A new label that publish refuses would abort the whole run at the write site',
    [true, false, null].every(g => [true, false].every(cl =>
      [null, C].every(cmd => Object.keys(KIND).every(k =>
        VERDICTS.has(verdict(R(cl, cmd), g, KIND[k])))))));

  /* THE PLUMBING, THROUGH THE SHIPPING runUncached RATHER THAN A RESTATEMENT OF IT. The pre-fix catch
   * block discarded the child's stdio entirely; if it still did, a declared refusal would be
   * indistinguishable from an undeclared one and the classifier would never see either. */
  const fakeExit = (status, stdout, stderr) => () => {
    const e = new Error('Command failed'); e.status = status; e.stdout = stdout || ''; e.stderr = stderr || ''; throw e;
  };
  ok('RED — runUncached READS the failed child stdio and classifies off it, rather than discarding '
    + 'the reason the way the pre-fix catch block did',
    runUncached(C, fakeExit(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n')).kind === KIND.REFUSED,
    runUncached(C, fakeExit(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n')));
  ok('RED — and an UNDECLARED non-{0,1} exit through the same path is null, not false',
    runUncached(C, fakeExit(2, 'CANNOT ANSWER — no current artifact\n')).green === null);
  ok('a signal kill still reads as NOT STARTED, not as a refusal: no exit code of its own was produced',
    runUncached(C, () => { const e = new Error('killed'); e.status = null; e.killed = true; throw e; }).kind
      === KIND.NOT_STARTED);
  /* NODE'S OWN CONTRACT, ASSERTED RATHER THAN ASSUMED. The whole classifier rests on execFileSync
   * attaching the captured streams to the error object on a non-zero exit. One 40ms child. */
  const CONTRACT = (() => {
    try { execFileSync(process.execPath, ['-e', 'console.log("ABRA-EXIT 2 CANNOT-ANSWER");process.exit(2)'],
      { encoding: 'utf8', stdio: 'pipe' }); return null; } catch (e) { return e; }
  })();
  ok('RED — execFileSync attaches the child STDOUT to the error on a non-zero exit. Everything above '
    + 'rests on this and it is measured here, not assumed',
    CONTRACT && CONTRACT.status === 2 && /^ABRA-EXIT 2 CANNOT-ANSWER$/m.test(String(CONTRACT.stdout)),
    CONTRACT && { status: CONTRACT.status, stdout: CONTRACT.stdout });

  /* THE KNOB, BOTH WAYS. It must restore the defect when set and be off when not — a knob that is
   * silently always on would make the demonstration above meaningless. */
  const KNOB_WAS = process.env.RR_CANNOT_ANSWER_AS_RED;
  process.env.RR_CANNOT_ANSWER_AS_RED = '1';
  const knobbed = classifyExit(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n');
  if (KNOB_WAS === undefined) delete process.env.RR_CANNOT_ANSWER_AS_RED;
  else process.env.RR_CANNOT_ANSWER_AS_RED = KNOB_WAS;
  ok('RR_CANNOT_ANSWER_AS_RED=1 restores the pre-fix defect exactly — a declared refusal is published '
    + 'as a RED verdict again — so this fix can be shown red on demand',
    knobbed.green === false && knobbed.kind === KIND.LEGACY, knobbed);
  ok('and the knob is OFF unless it is set to exactly "1"',
    (process.env.RR_CANNOT_ANSWER_AS_RED === '1') || classifyExit(2, '').green === null);

  console.log(`\nREGISTER-REALITY SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ================= THE DRIVER — THIN, AND THE TWO PATHS DO NOT MEET =============================
 *
 * Read this and the read-only claim is checkable by eye: the listing branch calls readRegister() and
 * renderListing() and exits. It never names measure(), buildArtifact() or publish(), and publish()
 * would refuse it if it did. Everything below the exit is the MEASUREMENT, and it writes because it
 * measured. */
const en = readRegister();

if (has('--list')) {
  renderListing(en, { json: has('--json') });
  process.exit(0);          /* --list is an inventory, not a verdict, and never a publication. */
}

const m = measure(en);
const art = buildArtifact(m);
publish(m, art);
const results = m.results;
const failing = results.filter(r => BAD.has(r.verdict));

if (has('--json')) { console.log(JSON.stringify(art, null, 2)); process.exit(failing.length ? 1 : 0); }

const c = art.counts;
console.log('\nREGISTER REALITY — the register checked against the instruments, not against itself\n');
renderCoverage(c);
console.log('  ' + String(c.distinct_commands_run).padStart(4) + '  distinct instrument(s) actually run');
/* PRINTED HERE AND NOT IN renderCoverage(), which --list also calls off a coverage block that has no
 * such keys — a figure rendered as `undefined` is worse than one not rendered. */
console.log('  ' + String(c.cannot_answer).padStart(4) + '  instrument(s) that RAN AND DECLARED CANNOT-ANSWER — not evidence, in either direction');
console.log('  ' + String(c.exit_codes_undeclared).padStart(4) + '  instrument(s) that exited outside {0,1} without declaring what the code means\n');
for (const r of results)
  console.log('  ' + r.verdict.padEnd(22) + '#' + String(r.n).padEnd(5)
    + ((r.why || '') + (r.cached ? ' (cached)' : '')).padEnd(22) + r.title);
console.log('');
renderRejected(en);
renderOwedAndProse(en);
console.log('  wrote data/register-reality.json\n');
if (failing.length) {
  /* THE TWO HALVES ARE NAMED SEPARATELY. "disagree with their own instrument" is a FALSE sentence
   * about a rejected marker — nothing was asked of that instrument — and a summary line that is false
   * for part of its own count is how a figure stops being read. */
  const rej = failing.filter(r => r.verdict === 'MARKER REJECTED').length;
  if (failing.length - rej)
    console.log('REGISTER REALITY: ' + (failing.length - rej) + ' row(s) disagree with their own '
      + 'instrument. A stale row holds a gate shut on a defect that does not exist.');
  if (rej)
    console.log('REGISTER REALITY: ' + rej + ' marker(s) REJECTED — those rows name an instrument and '
      + 'this file refused to read the marker, so nothing ran. Listed above with the rule that '
      + 'refused each. This is coverage the register CLAIMS and does not have.');
  process.exit(1);
}
console.log('REGISTER REALITY: every marked row agrees with its instrument.');
