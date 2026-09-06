# WEB — the division ledger

**Owns:** `web/` — ABRA WORLD and every room in it.
**Its one number:** every rendered figure traces to an artifact.
**Agent:** `.claude/agents/web.md`. **Map and routing:** [DIVISIONS.md](DIVISIONS.md).

WEB is the leaf of the invalidation graph. Everything flows into it; nothing flows out. That is why
it has hands on its own files and none anywhere else, and why its restriction is about **authority**
rather than tools:

> **WEB renders numbers. It never authors one.** Where no artifact says it, the page says
> **NOT MEASURED**, at the same visual weight as a real figure.

---

## The rooms

| Page | What it is | State |
|---|---|---|
| `web/index.html` | **ABRA WORLD** — the Champions modelling town. The front door. | live |
| `web/stadium.html` | **ABRA STADIUM** — model select screen, one **playable minigame** per model. 15 cabinets; GURU added 2026-08-04, GARY and DUSK 2026-08-06. Each cabinet is the Pokémon's identity and the model's real finding at the same time: Wobbuffet is a punching bag that returns your hit harder, Miltank's Rollout grows every lap and drops the 777 unscorable pairs through a trapdoor, Doduo's two heads can be aimed apart to waste the turn, Machamp's bar cannot be lifted. | rebuilt 2026-08-04 |
| `web/models.html` | the model map — inputs and outputs per model | live |
| `web/scoreboard.html` | watch MAG think | live |
| `web/tower.html` / `web/futuresight.html` | ALAKAZAM's Battle Tower | live |
| `web/orb.html` | ORB — On-battle Read Board | live |
| `web/replay.html` | MEW replay viewer | live |

## Guards this division owns

| Test | What it prevents |
|---|---|
| `tests/test-model-map.js` | **`web/models.html` drifting from `docs/MODELS.md`** — the same rule as the roster guard, applied to the map. It parses the ledger's model headings (`## NAME — job`, ALL-CAPS name, em dash required, so the prose sections are excluded), asserts each is named INSIDE the `<svg>`, and runs the reverse direction over the box titles that have the ledger's own shape. Short names are an explicit `ALIASES` table with a reason each, never a loose substring: `MAG` for MAGNEMITE, `META USAGE` for META-USAGE, `BEHAVIOUR PRIORS` for MOVE PRIORS. Matching is **case-sensitive and bounded on both sides**, because a case-insensitive match would let the ordinary words *counters*, *cores*, *roles* and *war* in body prose stand in for four models that are not there. Every deliberate omission is `DECLARED` with a reason AND must be named in the page's own `#notonmap` note — a declaration only the test can read is an exemption. `--selftest` plants a model with no box, a box with no model, a name glued inside a longer word and a lowercase occurrence, and asserts all four are rejected. |
| `tests/test-stadium-roster.js` | The Stadium's cabinet rack drifting from `docs/MODELS.md`, **and a model that is in neither of them.** Two directions catch a model that is in ONE file; GURU was in NEITHER, so both passed while the front door rendered its matrix daily. The third direction reads `engine/provenance.js --graph` — the set of things that actually generate a `data/*` artifact, which is a fact about the code rather than a claim about it — and requires every generator to be named in the ledger or declared with a reason. Judgement gaps in all three directions are declared by name **with a reason**, never by a pattern that would also swallow a real model added later. |
| `tests/test-web-parses.js` | **A room that does not run.** `web/stadium.html` shipped with `class="wd"` inside a double-quoted JS string; the whole inline block was a SyntaxError and the Stadium rendered its header and nothing else. The roster guard passed and the figure audit scored the page 100% traced, because both read the page as **text**. This parses it. |
| `tests/test-web-figures.js` | **This division's own number going unmeasured, and then going down.** It calls `web/figure-audit.js` — the one implementation of *what is a figure* and *what counts as traced* — and asserts a FLOOR on the fraction of hardcoded figures whose source line cites an artifact. It also asserts the **withdrawn count never drops**, which is what stops a retracted claim being quietly deleted or quietly un-struck, and that every `<s class="wd">` carries a `title` saying when and why. A relation, not a pinned value: raising the floor is the intended edit, lowering it has to be justified out loud. |
| `tests/test-web-status.js` | `web/status-data.js` drifting from the artifacts it names, and `web/status.html` acquiring a `fetch()` or an external asset that breaks it under `file://`. |
| `tests/test-web-quarantine-loaders.js` | **A page that reads a withheld artifact rather than quoting one**, in all three shapes this site has actually had. (1) It LOADS the bundle — `data/mag.js`, `data/mew.js`, `data/scoreboard.js` — and draws the room from the object, so there is no verdict sentence to grep for. (2) It loads **the SIMULATOR**: `web/tower.html` plays a live battle out of `../engine/medicham2-browser.js`, and a check that resolves a load to a `data/` row is structurally blind to it. Membership is `classify().play` read at runtime, so a room that loads a different play-layer file tomorrow is caught with no edit here. (3) It loads a bundle the graph **cleared** which re-encodes a withheld artifact — `data/status.js` — caught by putting each row's own declared `evidence` line to the gate. Every direction is shown RED on synthetic input first, and the whole thing is driven twice over one classification, changing only the gate, so LIFT proves the site can show its numbers again rather than merely having deleted them. |
| `tests/test-site-sync.js` | `web/index.html` and `app/index.html` diverging. Two of them are shipped and only one gets edited; the last two WEB passes both broke this. Run `cp web/index.html app/index.html` before finishing, every time. |

**`tests/run-all.js` AUTO-DISCOVERS `tests/`** — `readdirSync` over `/^test-.*\.(js|py)$/`, so a new
guard is covered the moment the file lands and there is no list to forget to edit. A previous WEB
pass recorded that `test-web-figures.js` was unregistered; it never was. Only the engine-side gates
are hand-listed, because other tooling imports them and they cannot be globbed out of `tests/`.

**What counts as a MODEL, for the roster guard's third direction.** 88 generators (70 of the 103
artifacts counted off the game store) against 15 cabinets is a large gap and most of it is
legitimate — a build script is not a model. The
exception list is the dangerous half, so the rule is written down in the test rather than remembered:

> A generator is a **MODEL** when its artifact states something about **Champions** — the game, its
> players or the metagame — that anything or anyone is meant to ACT on. It is a **PIPELINE STEP**
> when its artifact states something about **ABRA** instead — our own code's cost, coverage,
> calibration, conformance or corpus — or when it only RE-ENCODES a statement that already has a
> home. The question that settles it: **if this number is wrong, who is misled?**

Three corollaries, each of which caught a wrong first answer: reading the game store does not make
you a model (`build_ability_blocks.js` is a census of a RULE — twice the games raises coverage, it
does not move the answer); not reading it does not save you (`slowking_preview.py` opens no game file
and publishes an equilibrium that can be wrong); and **nothing consuming it does not save you
either** — exempting unread artifacts would shrink the table by a dozen entries and would re-create
CLAUDE.md's own recorded failure, *"PORYGON2 and DODUO were fitted, saved, quoted in documents, and
never once in a live decision."* An unwired model is still a model.

The roster pattern generalises, and should be applied whenever a page starts carrying a list that a
source file also carries: compare the page against its source, fail on drift, and declare every
exception. This is CLAUDE.md's *a derived artifact is not a fact until something compares it to its
source*, applied to HTML. `test-web-figures.js` is the same rule applied to numbers rather than to a
roster, which is what the Open item below used to ask for.

## Standing decisions

- **A room may commit to its own visual world.** `stadium.html` is a 1999 stadium CRT and
  deliberately does not do light mode. The house palette (`--ink:#20344a`, `--electric:#ffd23f`,
  `--fight:#ff6b57`, `--psy:#ff6bd6`, `--water:#4fb0ff`, `--grass:#5fd07a`, hard `0 5px 0` shadows)
  is the default, not a cage — but a new room should still feel like the same town.
- **No remote CODE or TYPE — but sprites are allowed, with a fallback.** This rule was written too
  broadly on 2026-08-04 and contradicted the codebase within a day: `web/index.html` has always
  loaded animated sprites from `play.pokemonshowdown.com/sprites/ani/*.gif`.

  The distinction that actually matters is **how the failure looks**. A blocked stylesheet, webfont
  or script fails **silently** and ships a design nobody chose — those stay banned, inline them. A
  blocked **image** is visibly missing, so it is a degradation rather than a lie.

  **But a page that may be published as a claude.ai artifact has a strict CSP that blocks every
  external host.** So any sprite must have a self-contained fallback that carries the same meaning —
  procedural canvas art, a CSS shape, or a data URI. Never let the fallback be an empty box: if the
  sprite is the only thing identifying a model, the page is broken in the artifact and nobody
  testing on the site will see it.
- **Some pages are opened from `file://`.** `models.html` and the replay coach are expected to work
  offline from bundled `data/*.js`. Check before introducing `fetch()`.
- **The site uses the POKÉMON NAME and a plain-English job. The backronym is not displayed.**
  (Will, 2026-08-04: *"I thought we shortened model names so they dont have dumb long acronyms"* /
  *"But we can still call them the mons names on the site"*.)

  `SLOWKING` is the name. *"Search over Learned Opponent-belief World, Knowledge-Intensive Nash
  Game-solver"* is a backronym reverse-engineered from it, and putting it on screen makes a real
  model look like it is trying too hard. The Stadium was already inconsistent about this — MILTANK's
  line read *"The search player — bring, lead, mega and post-KO replacement"* while SLOWKING's read
  the full expansion.

  So: **name + one line of what it does, in words a person uses.** `docs/MODELS.md` may keep the
  expansion as an origin note — it is where the name came from and that is worth recording — but it
  does not belong on a page somebody is reading.

- **A cabinet does not have to be a Pokémon, and it says so.** GURU is the project's own name for
  the archetype matchup matrix. There is no sprite, so its cabinet carries `sprite:false` and never
  asks the host for a file that can only 404 — the procedural canvas art is the identity, which is
  what the fallback rule already required of every other cabinet. The `why` line says out loud that
  there is no Pokémon here rather than inventing one.

- **Carry the caveat onto the page.** The Stadium prints MEDICHAM's Brier loss against a coin, and
  MILTANK's cabinet says its head-to-head share is biased high by the stopping rule. A CI is not
  simplified away for a cleaner card.

  **AND WHERE THE ARTIFACT UNDER THE CAVEAT IS QUARANTINED, A CAVEAT IS NOT ENOUGH — THE FIGURE IS
  WITHHELD.** This bullet used to name MILTANK's share against MAG greedy as a bare percentage with no
  artifact cited at all, which is two defects in one sentence. It is withheld, not annotated.
  MILTANK's head-to-head share: QUARANTINED — the figure is withheld, not annotated.
  `data/rollout-r4.json` is downstream of MEDICHAM, and `engine/quarantine.js` withholds every figure
  downstream of the simulator while MEDICHAM is not correct. `docs/SEARCH.md` gives the same ruling on
  the same figure — it is not retracted, it is unquotable — and an uncited figure is worse again,
  because there is nothing for a reader to check it against. It becomes quotable again when the gate
  opens AND this is re-run: `node engine/rollout_r4.js`.

  **And when the caveat itself goes stale, strike the old claim — and when the artifact under it is
  QUARANTINED, strike it and print NOTHING in its place.** This entry read *"MEDICHAM's win rate is
  below chance and the Stadium says so"*, which was the 2026-07-23 reading, and was then rewritten to
  quote a leaf calibration figure faithfully out of `data/winrate-backtest.json`. A faithful citation
  of a quarantined artifact is still a republication. Leaf calibration: QUARANTINED — the figure is
  withheld, not annotated. `data/winrate-backtest.json` is downstream of MEDICHAM: it was measured on
  2026-08-04 against an `engine/medicham2-browser.js` of **134,648** bytes, which the artifact records
  in its own `measured_against` block, and the live simulator is more than twenty times that size — so
  it is a claim about a build that no longer exists. No point estimate, no interval and no sample size
  is carried in its place. It becomes quotable again when the gate opens AND this is re-run:
  `node engine/backtest_winrate.js`.

- **An interactive control may not interpolate.** A dial with stops at two measured points and a
  smooth path between them is authoring a number at every position on that path. So every control on
  a page has stops, each stop is a value some artifact recorded, and any position nothing measured
  prints **NOT MEASURED** in the same red as everywhere else. XATU's slider is measured at 0 moves
  revealed and at 4 and nowhere between; watching the middle go blank turned out to explain the
  four-move cap better than either endpoint did.

- **ONE VERB PER CABINET, AND THE RESULT LANDS IN THE SCENE.** (Will, 2026-08-04, three times:
  *"the inputs dont make sense man"* / *"lack inputs that are clear"* / *"make it stupidly obvious
  what the inputs are"*.)

  What failed was a segmented dial reading `90-100% | 0-10%` floating between two rows of meters.
  Nothing said it was pressable, nothing said what pressing would do, and **the meters rendered the
  same figure the canvas already drew**, so one press moved two copies of one number and read as a
  bug. The rules that replaced it:

  - the primary control is **one big button whose label is a verb** — `PUNCH IT`, `ROLL IT OUT`,
    `REVEAL A MOVE`, `LIFT`. Not a value, not a bare toggle, not an abstract noun the reader has to
    map onto an outcome. It carries a one-line hint underneath saying what will happen;
  - it is **chunky, high-contrast and visibly depressed when hit**, sits centred directly under the
    display, and everything secondary is a third of its size;
  - **the result appears in the scene, not in a caption.** You punch Wobbuffet and something bigger
    comes back — no label is needed to explain that. The line under the pad is the **receipt**: the
    interval, the caveat, the artifact path. That line is also what a screen reader gets, since the
    canvas is `aria-hidden`;
  - **state is legible before the first press.** An unplayed cabinet reads as an invitation
    (`PRESS ROLL IT OUT`), never as an error;
  - **NOT MEASURED is a legitimate outcome of pressing a button, and it must be pressable.**
    MACHAMP's bar can be lifted at any time and always falls back, because the run recorded no
    verdict; WOBBUFFET's counter-punch returns a struck-through figure. A disabled control hides the
    finding — a control that visibly refuses *is* the finding.

- **Two rendering bugs worth not repeating.** `paint()` wrote to `#dMeters` after the meters were
  deleted from the DOM, so **every cabinet click threw** and the stats, the aria state and the
  animation loop never ran; `test-web-parses.js` cannot see that, because the file parses. And the
  hero canvas had a 640x460 backing store inside a 16:7 box, so every drawing was squashed ~40%
  vertically — which is most of why the art read as bar charts. The backing store is now sized from
  the element's own box, and the design space is pinned by **height** (200 units) so one renderer
  serves the hero and the thumbnail at the same visual scale.

- **Keep a model's figures and its citation on ONE source line.** `web/figure-audit.js` attributes a
  figure to its line, so a `CTRLDATA`-style table with the artifact path in the same row is what makes
  the trace checkable instead of asserted. It is also the cheapest way to make the guard agree with a
  human reading the file.

- **When the artifact under a room is repaired, the room's THESIS may be what changed.**
  `data/slowking-playstyle-eval.json` was the wrong file — `slowking_preview.py` took its output
  *name* from `TAG` and its *matrix* from `MATRIX_FILE`, which defaulted to GURU, so the playstyle
  artifact was a byte-identical copy of the archetype one. Repaired it reads 2,860 games over 8
  playstyles, and its own `verdict` field now says *"no material exploitability gap … close to
  transitive"*. The SLOWKING room was headed **"The meta looks like rock-paper-scissors"** and argued
  that picking one playstyle is exploitable while a mixture is not. That is a rewrite, not a number
  swap, and swapping the numbers alone would have left the page arguing against its own source.

  The two typed literals that went stale with it (*"49, 37 and 15 games"*, *"1,320 candidate
  triples"*) are now **read off `S.cycle`** rather than retyped, so they cannot drift again. The
  honest version is the better story anyway: **the strongest cycle in the data rests on a five-game
  leg, and the artifact says `supported: false` itself.** Non-transitivity is *unestablished*, which
  is not the same as absent — the room says exactly that.

  One figure is deliberately **not** printed: greedy-minus-Nash. `data/slowking-playstyle.js` carries
  the interval and the three levels but not the difference, and subtracting two of them in the
  browser would be this division authoring a number. The interval is shown and the omission is
  stated on the page.

## Open

- **THE SITE WAS THREE DAYS BEHIND ITS OWN GATE, AND IT DRIFTED IN THE DIRECTION NOBODY WATCHES.
  Fixed 2026-08-25.** `node web/build-quarantine.js --check` was RED on both outputs: the committed
  `web/quarantine-data.js` and the block stamped inside `web/stadium.html` were built on 2026-08-22
  and told a visitor **6 of 8 gate clauses fail**, naming the three deliberate-roster clauses as
  FAILING. The gate today is **3 of 8**, and all three roster clauses are CLEAN
  (`items 139 of 148`, `abilities 130 of 202`, `moves 475 of 500`). It also said `58 of 227`
  artifacts were withheld against `60 of 234` now.

  **The direction is the lesson.** This project's stated fear is a page telling a visitor the
  simulator is clean; what actually happened is the opposite — the site OVER-withheld and published
  a harsher verdict than the artifacts support. That is still drift, it is still a figure on a page
  that no artifact says, and it was invisible to `web/figure-audit.js` because every one of those
  numbers *did* cite an artifact. **A citation proves a figure has a source, never that it still
  says this.** Only the rebuild-and-diff guard could see it, which is the argument for
  `tests/test-web-quarantine-loaders.js` restated.

  Rebuilt with `node web/build-quarantine.js`; both guards green. **The block is a SNAPSHOT and goes
  stale by construction — re-run `--check` immediately before any publish, not at the start of the
  pass.** Two of the artifacts it now names, `data/_pair-pilot.json` and
  `data/medicham-represented-clicks.json`, are **untracked in git**, so the committed page names two
  files a fresh clone does not have. Reported, not acted on: the classification is
  `engine/quarantine.js`'s and not this division's to filter.

- **THE STADIUM'S MEDICHAM CABINET DREW A DISAGREEMENT ITS OWN CITED ARTIFACT SAYS DOES NOT EXIST.
  Fixed 2026-08-25.** `CTRLDATA.medicham` held `cmp:"150", agreed:"149", diff:"1"` with a named red
  tick — `CHESNAUGHT WOOD HAMMER → MIMIKYU`, `Showdown 0-0` against `MEDICHAM's 120-130` — and
  `worst:"3%"`. `data/engine-diff.json` reads **6,000 compared / 6,000 agreed / 0 disagreed**, and
  `data/damage-validation.json`'s `result.worst_pct` has read **0 since 2026-08-08**. The canvas
  loop drew exactly 150 ticks with a red one hardcoded at index 103.

  **The stat card one screen above it was corrected on 2026-08-22 and this line was not**, which is
  the whole failure: one FACT lived in two places on one page and only one copy got fixed. That is
  CLAUDE.md's FACTS ARE GLOBAL, inside a single HTML file. The strip now draws a **proportion**, not
  a count — it fills, and the counts are in the label — so no future artifact value can make the
  drawing itself a lie about its resolution; the red segment still exists and is drawn whenever
  `diff` is non-zero, because deleting a failure state is how a page loses the ability to report the
  next one. The `badFrac` quotient is **geometry and is never printed**, on the same reasoning that
  keeps `web/models.html` from dividing `matrix_agree` by `matrix_live`.

  **The scope caveat was ADDED while the disagreement was removed, deliberately.** A full green bar
  with nothing beside it reads as *the simulator is correct*, and the whole-game clause is still
  FAILING at 18 of 961. The scene now ends on `DAMAGE ONLY — NOT THE WHOLE GAME` and the artifact's
  own `scope` line. The stat card also stopped reproducing the artifact's `generated` stamp: a stamp
  typed onto a page is a second copy of a field that moves every time the run repeats.

- **`web/index.html` ROUNDED A NUMBER, AND THE FIGURE AUDIT COULD NOT SEE IT. Fixed 2026-08-25.**
  The MEDICHAM room's warning read *"off by about **30 points on average**, and it picked the
  **wrong winner in three out of eight**"* with **no citation on the line**.
  `docs/ADR-001-use-the-champions-mod.md` says **31.1 percentage points** and **3 of 8**. Both are
  now quoted exactly, both ADRs are cited, and the ADR's own caveat — 8 matchups at 60 battles each
  is roughly a ±12 point interval per cell — is carried onto the page rather than dropped.

  **Why nothing caught it:** `web/figure-audit.js` counts a token as a figure only when it has a
  decimal point, a thousands comma, a `%`, or a value **≥ 100** (its scale filter, Definition 1(b)).
  `30` fails all four and `three out of eight` is words, so a rounded, uncited, stale claim scored
  as no figure at all and the page reported **100% traced**. This is a real blind spot in this
  division's own instrument and it is **NOT fixed here** — lowering the threshold would sweep in
  every `2`, `4` and `50` in the page's prose, which is the over-firing gate CLAUDE.md #148 warns
  about. The narrower shape worth building is a spelled-out-number check plus a small-integer check
  that fires only on a line already carrying a comparison word. Filed, not done.

- **`tests/test-model-map.js` IS RED AND THIS DIVISION COULD NOT CLOSE IT.** `docs/MODELS.md` gained
  a heading, **THE PER-TURN PIPELINE — WHO DOES WHAT, 2026-08-13**, that has no box on the map and
  no declared reason. It is not a model: it is the COMPOSITION block, and every model it names
  (MAG, DODUO, MILTANK, SLOWKING, DUSK) already has a box. So it wants a `DECLARED` entry, and
  `DECLARED` lives inside `tests/test-model-map.js`, which is outside this division's write set
  (`web/`, `tests/test-*web*.js`, `tests/test-stadium-roster.js`). **Reported RED, not filed** — the
  exact text to add is in `docs/_reports/2026-08-25-site-truthfulness.md` under OWED, NOT RUN.

- **`web/status-data.js` IS FOURTEEN DAYS OLD AND EVERY CONSUMER CORRECTLY REFUSES IT.** Built
  2026-08-11; `tests/test-web-status.js` is red on **12** scalars — the mechanics census reads
  `423/423` against `706/706`, the interaction matrix `1624 of 1643` against `1642 of 1642`, and
  `ops.games` `52,089` against `69,932`. **Nothing false is published**: `web/status.html` and
  `web/models.html` both compute `SUPERSEDED` off the bundle's own `built_at` and render a plate
  instead of the value. That is the design working — and it means the whole status room is currently
  blank, so *"no page yet renders the project's own state for a visitor"* is true again in practice.
  The rebuild is `node web/build-status.js`, which runs `node engine/status.js` (two minutes-plus)
  and **must not be run beside a live MEASURE agent** — baking a snapshot out of a moving tree is
  the defect the SUPERSEDED state exists to stop, not the fix for it. OWED.

- **`app/` IS TWELVE DAYS BEHIND `web/` AND ITS COPY OF THE GATE IS THE OPTIMISTIC ONE.**
  `tests/test-site-sync.js` is red on five pages. `app/quarantine-data.js`, and the block inside
  `app/stadium.html`, say **"1 of 6 gate clauses fail"** — five of six passing, from the era before
  the roster clauses existed. **That is the shape this brief was written to find**: a shipped page
  telling a visitor the simulator is nearly clean while 3 of 8 clauses fail. It was NOT fixed in
  this pass, on purpose — syncing `app/` is effectively a publish, and publishing is confirmed
  before it happens, not during a read-mostly pass. The command is one line and it is in the report.

- **`divergences.html` SITS AT THE REPOSITORY ROOT, IS 215 KB OF RENDERED MEDICHAM-VS-SHOWDOWN
  OUTPUT, AND NO WEB GUARD CAN SEE IT.** Titled *"Where MEDICHAM and Showdown part"*, it reads like
  a room and is not in `web/`, so `figure-audit.js` does not scan it, `test-web-parses.js` does not
  parse it and it loads no quarantine payload. It is **untracked**, so it cannot ship — which is the
  only reason this is a note and not a red row. **Left in place and not deleted** (CLAUDE.md: an
  untracked file is unrecoverable). If it is ever meant to be a room, it belongs under `web/` where
  the guards reach it.

- **THE MODEL MAP NAMED 14 OF THE LEDGER'S 31 MODELS, AND NOTHING COULD SEE IT. Fixed and GUARDED
  2026-08-06.** (Will: *"i want to make sure nothing is left out, this project is massive and has so
  many different parts i cant keep track of all them."*) A missing box leaves **no gap on screen**,
  which is why the page could be titled THE MODEL MAP and be less than half a map without ever
  looking wrong — the same shape as the Stadium roster hole, one page over.

  **The gate came first and was red on exactly the five it should have been.** `tests/test-model-map.js`
  was written before the fix and reported DODUO, MACHAMP, WOBBUFFET, GURU and CHAMPIONS_SIM. All five
  are now drawn: **CHAMPIONS_SIM** beside MEDICHAM in THE ENGINE (ADR-001; the authority MEDICHAM is
  graded against, and the two-engine agreement counts are **WIRED out of `web/status-data.js`**, not
  typed — see below, this one caught the page mid-drift);
  **GURU** above SLOWKING, because SLOWKING's box says *"in: how each matchup scores"* and the thing
  that scores the matchups had no box anywhere; **DODUO** beside MAG in THE DECIDERS; and a new band,
  **MAKING MAG BETTER**, carrying **MACHAMP** and **WOBBUFFET** — they are not deciders, nothing in a
  battle calls them, they are what would make the decider better.

  **The three statuses are the point of the pass, not the boxes.** DODUO renders **NOT MEASURED FOR
  WINNING** and quotes `data/policy-weights-joint.json`'s own `caveat` field verbatim — *"Not evidence
  that the pair wins more games."* Its 12.2% top-1 is deliberately **not** on the page: it predicts a
  human click, and a percentage beside a box on a decision map reads as how good the model is.
  MACHAMP renders `data/ladder.json`'s own record — **2 of the 8 generations it asked for, no
  verdict, 48-feature vector** — and that its champion was deleted, 48 against the **58** in
  `data/policy-weights.json`. WOBBUFFET renders the ABSENCE: `data/exploitability.json` carries
  `void: true`, so **there is no exploitability number** and the retracted 63.2% appears nowhere, not
  even struck through.
  Layout re-checked by script before and after: viewBox 1560 → **2040**, 28 boxes, **no rect out of
  bounds, no two rects overlapping, no routed arrow through a box interior** (47 straight segments
  and 6 beziers sampled at 1% steps), and no new text run exceeding its box.

  **AND THE ONE FIGURE THIS PASS TYPED WENT STALE INSIDE THE PASS, WHICH IS THE LESSON.**
  CHAMPIONS_SIM's box first read *"agrees on 98.8% of 1,643 live pairs"*, taken from
  `data/interaction-matrix.json` at 08:01:07. ENGINE regenerated that artifact at **18:42:48** while
  this page was being written — the same shape as *"3k good games"* and *"5,368 real teams"* before
  it, and the third time this page has been caught by it. Both counts are now **read from
  `web/status-data.js`** the way the mechanics census beside them already was, so `test-web-status.js`
  is the guard and the page inherits it. The **percentage is deliberately not rendered at all**:
  dividing `matrix_agree` by `matrix_live` in the browser would be this division authoring a number,
  and both counts side by side say the same thing without one.
  `web/models.html` stays at **100%** traced — 5/5 → 10/10 → **8/8** once the two figures became
  reads; site-wide **100% of 132**.
  *Open part:* twelve ledger entries are DECLARED off the map with a reason — ROLES, WAR, NMF,
  COUNTERPLAY, COUNTERS, CORES, DYNAMICS, MEGA DEX, ILLUSION, SPECIES SETS, BRING PRIORS, SMOGON
  PRIORS. **BRING PRIORS is the one to revisit**: it is declared out because the thing that would draw
  from it is GARY and GARY is off, so the day GARY is switched on it earns a box and the declaration
  becomes false.
- **THE MODEL MAP WAS MISSING THE MODEL THAT PICKS THE MOVES. Fixed 2026-08-06, and it is worth
  recording why it was possible.** `web/models.html` went from THE DECIDERS (MAG, DITTO, the value
  nets, KADABRA) straight to the ALAKAZAM capstone. **MILTANK — the shipping search player — was not
  on the map at all**, so nothing on the page showed that a search exists, that it imagines ~200
  games per option, or that its judge's calibration had ever been measured — a figure now WITHHELD
  under the MEDICHAM quarantine, per the ruling above. A map that omits the thing choosing the moves
  is not a map of the models.
  Added in this pass: a **THE SEARCH** band carrying MILTANK, **GARY** (the imagined opponent, named
  2026-08-06 and drawn in the quarantine colour because it defaults to a coin) and **DUSK** (planned,
  the endgame tablebase), plus a drawn **language boundary** — 127 JavaScript files must play because
  Showdown is TypeScript, 40 Python files do the maths, and the verified Nash solver is on the wrong
  side of the line. viewBox grew 1310 → 1560; layout re-checked for bounds and overlaps.
  Two corrections travelled with it: the retired-value-net box read *"PORYGON — same, mid-game"*,
  which filed **PORYGON2 — built, never retracted, and never called by a live decision** under
  RETIRED alongside PORY, which genuinely is retracted; and ALAKAZAM's build order read
  *"… → value net → belief → search"*, which is the wrong order for a game whose median length is 6
  turns, because a rollout that reaches a real terminal state has no position left to approximate.
  **WEB still authors no number here** — the leaf calibration figure this bullet carried is WITHHELD
  under the MEDICHAM quarantine rather than cited, the two defaults go to their source lines, and the
  6-turn median to `docs/POKER-TO-POKEMON.md` §4b.
  *Open part:* the SEARCH band's figures are **typed, not wired**. `web/status-data.js` carries no
  scalar for the leaf's accuracy or for `foePolicy`, so these will drift exactly the way *"3k good
  games"* and *"5,368 real teams"* did. Wiring them is the follow-up, and it needs MEASURE to stamp
  `foePolicy` into the artifacts first (task #33).
- **`data/exploitability.json` is UNSAFE and WOBBUFFET's headline is unquotable.** 17 features
  against the 58 in `data/policy-weights.json`, older than the quality filter and older than its own
  input; `engine/provenance.js --strict` says so and `tests/run-all.js` gates on it. The Stadium
  cabinet still works — you punch the bag, and what comes back is **NOT MEASURED** with
  `63.2% CI [56.6, 69.3]` and the `47.5%` mirror control struck through beside it. **A re-run is
  MEASURE's, not WEB's.** Nothing on the page says the leak was closed.
- **`tests/test-site-data-fresh.js` is RED on two `data/` artifacts and neither is WEB's to fix** —
  `data/pory-nn.json` declares 6,008 games against 7,228 clean now (16.9% corpus drift), and
  `data/engine-data.js` is a day behind `build/rebuild_sets_from_sheets.js`. Routed, not filed:
  the first is MEASURE, the second is OPS/ENGINE's bundle rebuild.
- **THE MODEL MAP'S DUSK BOX WAS CONTRADICTED BY AN ARTIFACT THAT LANDED THE SAME DAY IT WAS DRAWN.
  Fixed 2026-08-06.** The box read *"planned — table SIZE not yet measured"* and named DUSK as the
  route that gets the Python Nash solver to the JavaScript bot. `engine/dusk_size_gate.js` then
  measured the size and moved BOTH claims: the table is **TOO BIG**, and `docs/SEARCH.md` retires
  the bridge argument in the same breath — *"that justification is gone … #41 should not be argued
  for on DUSK's back."* The box now leads with the **reach rate**, because it kills the tablebase
  independently of the size (16.42% of games reach 1v1, 45.93% reach 2v1, both read off
  `data/dusk-size-gate.json`), and the language-boundary strip says *"DUSK was the bridge — the
  table is TOO BIG"* instead of asserting the bridge. This is the third page-versus-artifact drift
  this room has had in two days and all three had the same shape: a sentence that was true when it
  was typed.
- **`docs/MODELS.md`'s own DUSK entry still predates its gate**, and it is not this division's file.
  The entry says the size question is *"NOT MEASURED — and that number decides whether DUSK is a
  weekend or a year (#40)"*; `data/dusk-size-gate.json` answered it at 06:49 the same day and
  `docs/SEARCH.md` carries the whole verdict. The Stadium cabinet therefore quotes the **artifact**
  and not the ledger. **Routed to MEASURE, not fixed here.**
- **`data/mechanics-census.json` moved three times during one WEB pass** — 102/144, then 107/147,
  then 108/148 within about an hour. The Stadium's MEDICHAM card carries the current value and says
  out loud that it moves. A page that hardcodes a live census will always be a little behind; the
  alternative is reading `web/status-data.js` the way `models.html` does, which `stadium.html`
  cannot do while it is also publishable as a claude.ai artifact (a sibling `<script src>` is
  blocked there exactly like a remote one).
- ABRA STADIUM is not yet linked from ABRA WORLD's front door.
- No page yet renders the four division ledgers or `node engine/status.js` output for a visitor;
  the project's own state is currently legible only from a terminal.
- *Superseded 2026-08-06 — every page is now at 100% and the site total is **100% of 134** (`index`
  44/44, `models` 10/10, `stadium` 78/78, `tower` 2/2, 40 struck out as withdrawn). Kept because a
  prior reading is never silently rewritten.* **`web/index.html` at 80.5% (33 of 41) is now the only
  page below 100%.** Overall is **91.8%**
  (90 of 98), from 84.3% (70 of 83) and 27.4% (17 of 62) earlier the same day. `models.html` and
  `tower.html` are closed: `models.html` cites `data/quality-filter.json` beside its bot share and
  now **reads** the mechanics census out of `web/status-data.js` rather than carrying it — it moved
  102/144 → 104/147 while that edit was being written, which is why it is read and not restamped —
  and `tower.html` cites `data/damage-validation.json` and takes its species count off
  `data/engine-data.js` instead of a typed 289. The eight left on the front door are the ones with
  no artifact behind them at all, not ones missing a citation.
- **`tests/test-stadium-roster.js` WAS RED ON TWO THINGS AND IS NOW ALL PASS. Closed 2026-08-06**,
  15 cabinets against 36 ledger headings and 88 generators. *(The five it used to be red on —
  `analyze.js`, `porygon2.py`, `state_encoder.py`, `derive_sets.js`, `counters.py` — were closed the
  right way by MEASURE, with ledger entries, and that half was already done.)*

  1. **GARY and DUSK now have cabinets**, because neither could take a truthful `NOT_A_CABINET`
     entry — GARY decides the imagined opponent's move on every rollout turn and DUSK is scoped.
     **GARY** (`SHIPS OFF`, quarantine colour, no sprite) is a spinner over each foe slot: press
     TAKE THEIR TURN and the move is drawn from four equal sectors, the target from a second wheel,
     and the two slots are drawn separately, so the caption reads *"BOTH HIT ONE SLOT — BY LUCK, NOT
     BY PLAN"* when they collide. The secondary button swaps the move wheel for the behaviour clone
     and stamps it **SHIPS OFF** — the toggle exists, and the target wheel deliberately does not
     change, because in `rollout_leaf.js` it does not either. **DUSK** (`PLANNED`, slate, no sprite)
     draws four squares whose **area is the cell count** — 1v1, 2v1, 2v2 and a whole turn — so the
     comparison is the drawing rather than a caption on it; SOLVE IT walks up the ladder and the
     fourth press draws Will's retrograde step, a 3v2 feeding into two cells of a solved 2v2. Its
     secondary button is the retired plan: BUILD THE TABLE runs off the end of its own declared
     ceiling and stamps **TOO BIG**. Both statuses are new (`off`, `planned`) rather than folded
     into `stale`: a model that ran and aged is not the same thing as one that has never been
     switched on, or never built.
  2. **The three generators are declared, each with its own reason** — a shared reason would have
     been the shape-based excuse this table forbids. `engine/dusk_size_gate.js` and
     `engine/porygon2_separation_gate.py` are GATE-class outright: their artifacts state how big
     **our** table would be and whether **our** value function separates, against ceilings that are
     a GitHub file limit, a V8 heap budget and this project's own 0.43-point split-half floor —
     none of which is a fact about Champions. `build/strong_player_baseline.js` is **the borderline
     one and the caveat is written into the declaration**, so the next reader can reverse the call
     with the reasoning visible: its headline is that our own per-turn realism metric cannot
     separate the rating bands it was built to separate, which is a statement about the power of our
     instrument — but it also publishes real Champions-facing material (species usage at four Smogon
     cutoffs, the within-species build gradient) whose home is `docs/MEASURE.md` §19a-d, and if
     anything is ever built that DECIDES off that gradient the declaration is wrong and owes
     `docs/MODELS.md` an entry instead.
  3. **`BRING PRIORS` now carries its own expiry.** It is declared off the rack because the thing
     that would draw on it is GARY and GARY's default is the coin — a reason with a known end date,
     so the `TRIGGER` is written into the declaration text and into `web/models.html`'s own
     *not on this map* note rather than left to be noticed. `tests/test-model-map.js` already
     carried it; the roster guard and the page did not.
- **Owed and not written by this division:** `CHANGELOG.md`, the white paper, the deck, the
  technical docs and `docs/SUMMARY.md` all still describe the pre-2026-08-04 state of the site.
  WEB's boundary is `web/`, `app/`, this file and its own tests.

## Retired from Open

- *Reconciling the Stadium to its artifacts (2026-08-04) found `docs/MODELS.md` drifted in three
  places — MAG's fit, MAG's corpus line and SLOWKING's mixture/exploitability/cycle. MEASURE
  corrected all three in its GURU pass and recorded that a fourth reported drift (the mechanics
  census at 42/54) did not reproduce. Closed.*
