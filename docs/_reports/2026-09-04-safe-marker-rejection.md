# SAFE rejected nine markers and said nothing — 2026-09-04 (MEASURE)

Scope: `engine/register_reality.js` only. No file that plays a game was touched, no instrument was
started, `data/register-reality.json` was not written, nothing was committed.

---

## 1. The nine, derived

Not counted from the brief. The `SAFE` literal was lifted out of the shipping bytes with
`^const SAFE = (/.*/[a-z]*);$` and applied to every `VERIFIED BY:` marker `parse()` actually
collects. Requiring the module would have run its driver, which `execFileSync`s all 124 markers.

**124 markers on rows `parse()` collects. 115 admitted. 9 refused. 0 markers sit on lines the
parser drops** — so the marker regex and the row regex agree, and there is no second population.

| row | marker | reason `SAFE` refused it |
|---|---|---|
| #316 | `SHOWDOWN_PATH=... node tests/roster.js --stage items --release <id>` | leading `NAME=value`; the regex is anchored `^node\s+`. Also `--stage items` (bare value) and `<id>` |
| #318 | `SHOWDOWN_PATH=... node tests/roster.js --stage moves` | leading `NAME=value`; also `--stage moves` |
| #319 | `SHOWDOWN_PATH=... node tests/roster.js --stage moves` | leading `NAME=value`; also `--stage moves` |
| #344 | `node -r ./tests/_live_release.js tests/probe_corpse_in_slot.js --games 1200 --verify-inert` | trailing group is `(?:\s+--[A-Za-z0-9_\-=]+)*` — `1200` is a bare value and matches no alternative |
| #330 | `data/switchin-order.json` | does not begin `node ` — it is an artifact path, not a command |
| #438 | `node engine/all_mechanics_fire.js --kind abilities` | bare value `abilities` |
| #439 | `node engine/game_differential.js --arm middle --team-store data/team-pool-frozen` | bare values `middle` and `data/team-pool-frozen` |
| #440 | `node engine/game_differential.js --arm middle --team-store data/team-pool-frozen` | as #439 |
| #526 | `SHOWDOWN_PATH=... node tests/probe_volley_collapse.js` | leading `NAME=value` |

**Two of them are on OPEN rows that assert breakage** (#318, #319). The register has **9** open
rows asserting breakage that name an instrument, so **2 of 9 — 22% — of this register's live
instrument coverage was fictional.**

### What the symptom actually was — corrected against the artifact rather than assumed

It did not read as `NOT_STARTED` to a reader; `NOT-STARTED` is the internal `kind`. The published
verdict was **`INSTRUMENT UNRUNNABLE`**, and that is worse than it sounds, because that is the same
label a gate produces when it ENOENTs or is killed by a signal. In the last real artifact
(`generated 2026-08-27T20:06:53Z`) **all 27 `INSTRUMENT UNRUNNABLE` rows were `SAFE` rejections** —
one bucket in which *"my ruler would not read this marker"* is indistinguishable from *"this
instrument is broken"*. Those are a defect in the **ruler** and a defect in the **world**, and they
had one number.

(The artifact is also stale: 416 register rows / 112 markers then, 460 / 124 now.)

---

## 2. The old comment's defence was false, and it is the reason this is not a relaxation

The 2026-08-28 block says widening for bare values *"would silently put multi-minute game-playing
runs that REWRITE shared artifacts inside every register pass"*. **Measured on the pre-fix bytes,
that is false.** The trailing group permitted `--[A-Za-z0-9_\-=]+`, and `=` is in that class:

```
node engine/game_differential.js --arm middle      refused
node engine/game_differential.js --arm=middle      ADMITTED
node tests/roster.js --stage moves                 refused
node tests/roster.js --stage=moves                 ADMITTED
node -r ./tests/_live_release.js tests/probe_corpse_in_slot.js --games=1200 --verify-inert
                                                   ADMITTED
```

Every command the comment named as the thing it protected against was already admitted one
character away. And the pass it was said to protect **already runs 63 entry scripts, 12 of which
write a file**, `engine/quarantine.js` and `engine/status.js` among them.

So there was no cost guard to preserve. There was a **spelling** guard that caught one spelling of
four commands. Removing it removes no protection — which is the whole reason this is a widening and
not a hole.

---

## 3. The fix is a PROPERTY, with one enumeration that cannot fail open

`SAFE` (a regex) is replaced by `classifyMarker(cmd)` (a pure function returning `{ok, argv}` or
`{ok:false, code, why}`).

`runUncached` calls `execFileSync(process.execPath, argv)` and passes **no `shell` option**, so no
shell ever sees the string. "Could a shell be tricked" is therefore not the question. Two are:

1. **Does the string mean, as an argv, what it says?** If it only means what it says under a shell —
   an `NAME=value` prefix, `&&`, a pipe, a redirect, `$( )`, a backquote, a quote, a glob — then
   running it without one runs a **different command** while the row is reported as decided by it.
2. **Does anything make node load or evaluate code that is not this repository's?** Node reads only
   the tokens **before** the entry point. Everything after is handed verbatim to a repo script.

That second sentence is the property, because it splits the token vector into three regions with one
rule each:

| region | rule |
|---|---|
| pre-entry (node's options) | **closed by refusal.** Only `-r`/`--require` with a value that `path.resolve`s inside ROOT and ends `.js`. Anything else is refused. |
| entry point | must `path.resolve` inside ROOT and end `.js`. |
| post-entry | **inert by construction** — node does not read it, `execFileSync` does not interpret it. Admitted verbatim. |

Under it, `--stage moves`, `--stage=moves`, `--games 1200` and `--team-store data/team-pool-frozen`
are the **same fact**. The old rule gave two answers to two spellings of one command; a rule that
does that is measuring the spelling.

### Will's test: would this catch a second instance, spelled differently, through another door?

**For the region that matters, yes, and by construction rather than by listing.** #521's rule
policed the pre-entry region *by shape*, so `-r` — a shape nobody had enumerated — fell through to
silence. The pre-entry region now **fails closed**: an option nobody here has reasoned about is
refused, loudly, by default. `node --max-old-space-size=4096 engine/fit_policy.js` is refused today
with `UNKNOWN NODE OPTION` and a sentence telling the next person to admit it deliberately. A node
option invented next year cannot walk past this the way `-r` did.

**One enumeration remains and it is named in the code: `EVAL_OPTS`.** It **cannot fail open** — an
unlisted pre-entry option is refused anyway. It exists solely to give `-e`, `-p`, `--import` and the
loader family a better refusal sentence. If it goes stale, a marker gets a vaguer message, never an
execution. `SHELL_ONLY` is a character class, not a list of commands.

**Honest limit:** post-entry tokens are admitted verbatim. If a repo script has a flag that makes it
destructive, `classifyMarker` will pass it. That is deliberate — the containment claim is *"the code
that runs is this repository's"*, not *"this repository's code is safe"* — and it is stated so the
next reader does not mistake the first for the second.

---

## 4. The loud half — a rejected marker is now its own verdict

New `KIND.REJECTED` → verdict **`MARKER REJECTED`**, in `VERDICTS` and in `BAD` (so the file exits 1).

- It is **not** `INSTRUMENT UNRUNNABLE` any more, so a ruler defect no longer shares a bucket with a
  broken gate.
- `enumerate()` computes rejections **purely**, so **`--list` reports a marker that will never run
  without starting anything and without touching the artifact** — verified: `data/register-reality.json`
  size and mtime byte-identical to the millisecond across a `--list`.
- The count is in `renderCoverage`, printed by **both** paths:
  `5 markers this file REFUSES TO READ — they name an instrument that is never started (2 on an OPEN row asserting breakage)`
- `renderRejected()` prints **the row, the marker text in full, and the rule that refused it**, and
  prints nothing at all when the count is zero (a block that fires on a clean run is a block people
  learn to skip).
- The final summary line no longer says rejected rows *"disagree with their own instrument"* — a
  false sentence about a row nothing was asked of.
- `counts.markers_rejected` and a `markers_rejected` array are in the artifact.

Live output of `--list` (nothing run, nothing written):

```
  MARKER REJECTED — these rows NAME an instrument and this file refused to read the marker,
  so NOTHING RAN and the row is neither verified nor reported as unverified:
      #316  [PLACEHOLDER]  `SHOWDOWN_PATH=... node tests/roster.js --stage items --release <id>`
             the marker carries unexpanded template text (`<...>` or `...`) ...
      #330  [NOT A COMMAND]  `data/switchin-order.json`
             the marker does not begin with `node` ...
```

---

## 5. Proof, red first, both arms

**Arm A — the nine, BEFORE vs AFTER.** "Before" is the `SAFE` literal from
`git show HEAD:engine/register_reality.js`; "after" is the shipping `runUncached` driven with a
recording `exec`, so nothing starts and no restatement of the new rule judges the new rule.

| | before | after |
|---|---|---|
| #344, #438, #439, #440 | REFUSED (silent) | **RUN**, argv verified token-for-token |
| #316, #318, #319, #526 | REFUSED (silent) | **REJECTED — `PLACEHOLDER`** |
| #330 | REFUSED (silent) | **REJECTED — `NOT A COMMAND`** |

Four of the nine were legitimate and are now run. **Five are not legitimate and no widening makes
them so** — `SHOWDOWN_PATH=...` and `--release <id>` are unexpanded template text, and
`data/switchin-order.json` is a data file. Those five needed to become **loud**, which was always
the more important half.

**Arm B — the guard still holds. Without this arm a guard was removed, not widened.** All 22
refused, each with a named reason:

`rm -rf /` · `… && curl evil` · `… | tee /etc/passwd` · `… > data/register-reality.json` ·
`…; rm -rf data` · `node -e "require('fs').rmSync…"` · `node --eval …` · `node -p 1` ·
`node --import ./evil.mjs …` · `node -r /etc/passwd …` · `node -r ../../evil.js …` ·
`node -r=../../evil.js …` · `node ../../evil.js` · `node /etc/passwd` · `node C:/evil.js` ·
`node tests/evil.sh` · `node -r tests/a.js` (no entry point) ·
`node --max-old-space-size=4096 …` · `… $(cat /etc/passwd)` · ``… --out `whoami` `` ·
`node tests/*.js` · `SHOWDOWN_PATH=/real/path node tests/a.js`

**Arm C — regression across the whole population.** All 124 markers, comparing the argv the pre-fix
builder produced against the argv the new one produces:

```
markers 124   identical-argv 115   newly-runs 4   still-refused 5   ARGV-MOVED 0   LOST 0
REGRESSION CLEAN: every marker admitted before is admitted after with a byte-identical argv.
```

**Arm D — the shipping gates.**
- `node engine/register_reality.js --selftest` → **73 passed, 0 failed** (was 58; the 5 assertions
  that pinned the removed rule were shown RED first, then rewritten to assert the *reason code*,
  which is strictly stronger than the old "kind is NOT_STARTED").
- `node tests/test-register-reality-readonly.js` → **10 passed, 0 failed**, including the #369
  byte-identical and mtime assertions.

**On the `--list` hazard named in the brief:** checked, and it still writes nothing. The pure/measure
split (`enumerate` / `measure` / `publish` + `MEASUREMENT_TOKEN`) is intact; the rejection data is
computed in `enumerate()`, which is why `--list` can report it. Verified by mtime and size, not by
exit code.

---

## 6. What did NOT change

- **No gate flips.** `openDefectClause` in `engine/quarantine.js` buckets on the `green` tri-state
  only (`quarantine.js:2941-2945`). A rejected marker is `green: null` exactly as before, so it
  lands in `unrunnable` there exactly as before. Nothing in the MEDICHAM gate moves.
- **Nothing else reads the verdict string.** Repo-wide, `INSTRUMENT UNRUNNABLE` appears outside this
  file only in three probe header comments as prose.
- `data/register-reality.json` was not regenerated. It is stale (2026-08-27, 112 markers vs 124) and
  regenerating it means running 66+ instruments including games — not this pass's job, and not
  beside a live ENGINE agent.

---

## OWED

1. **Five register rows carry a marker that can never run, and they are now printed by name every
   pass.** #318 and #319 are OPEN and asserting breakage. The fix is in the ROW, not in this file:
   #316/#318/#319/#526 need the `SHOWDOWN_PATH=...` prefix removed (or a real path moved inside the
   instrument) and `<id>` replaced with a release id; #330 needs a command instead of
   `data/switchin-order.json`. **Not touched — `docs/ROADMAP.md` was out of scope for this pass.**
2. **Four heavy commands now enter the register pass for the first time** — `probe_corpse_in_slot.js
   --games 1200`, `all_mechanics_fire.js --kind abilities`, and `game_differential.js --arm middle
   --team-store data/team-pool-frozen` twice (cached to one run). Two of them rewrite
   `data/all-mechanics-fire.json` and `data/game-differential.json`, which `quarantine.js` reads.
   **This is not a new class** — the pass already ran 12 artifact-writing scripts — but it is now 14,
   and "a register pass may republish a gate input" is a decision with an owner that no instrument
   currently guards. Filing it rather than half-guarding it: a guard an equals sign defeats is what
   this whole report is about. **Do not run the full `node engine/register_reality.js` beside a live
   agent until this is decided.**
3. **`engine/quarantine.js` still conflates the two.** Its `unrunnable` line says open rows *"name an
   instrument that WOULD NOT RUN"*, which is now imprecise: some were never asked. It should read
   `verdict === 'MARKER REJECTED'` and split them. Not touched — not this pass's file.
4. **`data/register-reality.json` is stale** (2026-08-27; 112 markers against 124, 416 rows against
   460). Every verdict in it predates the #521 preload fix. Re-run it once (2) is settled.
5. **`tests/run-all.js` `PENDING_WIRE` is not currently lying about these** — checked. Its
   `tests/roster.js` entry says the exit code is *"genuinely UNKNOWN and is not being guessed at"*,
   which is honest. The #521-era false sentence was already corrected in place. No action.
