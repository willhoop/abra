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
| `web/stadium.html` | **ABRA STADIUM** — model select screen, one cabinet per model. 13 cabinets; GURU added 2026-08-04. | added 2026-08-04 |
| `web/models.html` | the model map — inputs and outputs per model | live |
| `web/scoreboard.html` | watch MAG think | live |
| `web/tower.html` / `web/futuresight.html` | ALAKAZAM's Battle Tower | live |
| `web/orb.html` | ORB — On-battle Read Board | live |
| `web/replay.html` | MEW replay viewer | live |

## Guards this division owns

| Test | What it prevents |
|---|---|
| `tests/test-stadium-roster.js` | The Stadium's cabinet rack drifting from `docs/MODELS.md`, **and a model that is in neither of them.** Two directions catch a model that is in ONE file; GURU was in NEITHER, so both passed while the front door rendered its matrix daily. The third direction reads `engine/provenance.js --graph` — the set of things that actually generate a `data/*` artifact, which is a fact about the code rather than a claim about it — and requires every generator to be named in the ledger or declared with a reason. Judgement gaps in all three directions are declared by name **with a reason**, never by a pattern that would also swallow a real model added later. |
| `tests/test-web-parses.js` | **A room that does not run.** `web/stadium.html` shipped with `class="wd"` inside a double-quoted JS string; the whole inline block was a SyntaxError and the Stadium rendered its header and nothing else. The roster guard passed and the figure audit scored the page 100% traced, because both read the page as **text**. This parses it. |
| `tests/test-web-figures.js` | **This division's own number going unmeasured, and then going down.** It calls `web/figure-audit.js` — the one implementation of *what is a figure* and *what counts as traced* — and asserts a FLOOR on the fraction of hardcoded figures whose source line cites an artifact. It also asserts the **withdrawn count never drops**, which is what stops a retracted claim being quietly deleted or quietly un-struck, and that every `<s class="wd">` carries a `title` saying when and why. A relation, not a pinned value: raising the floor is the intended edit, lowering it has to be justified out loud. |
| `tests/test-web-status.js` | `web/status-data.js` drifting from the artifacts it names, and `web/status.html` acquiring a `fetch()` or an external asset that breaks it under `file://`. |
| `tests/test-site-sync.js` | `web/index.html` and `app/index.html` diverging. Two of them are shipped and only one gets edited; the last two WEB passes both broke this. Run `cp web/index.html app/index.html` before finishing, every time. |

**`tests/run-all.js` AUTO-DISCOVERS `tests/`** — `readdirSync` over `/^test-.*\.(js|py)$/`, so a new
guard is covered the moment the file lands and there is no list to forget to edit. A previous WEB
pass recorded that `test-web-figures.js` was unregistered; it never was. Only the engine-side gates
are hand-listed, because other tooling imports them and they cannot be globbed out of `tests/`.

**What counts as a MODEL, for the roster guard's third direction.** 57 store-derived generators
against 13 cabinets is a large gap and most of it is legitimate — a build script is not a model. The
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
  MILTANK's cabinet says its 55.5% is biased high by the stopping rule. A CI is not simplified away
  for a cleaner card.

  **And when the caveat itself goes stale, quote the artifact and strike the old claim.** This entry
  used to read *"MEDICHAM's win rate is below chance and the Stadium says so"*. That was the
  2026-07-23 reading. `data/winrate-backtest.json`, measured 2026-08-04, puts the live in-game leaf at
  **51.0%** of 1,314 decisive calls, 95% CI **[48.3, 53.7]** — worse than a coin on Brier, but an
  interval that *contains* chance, so "below chance, systematically inverted" is a stronger claim than
  the evidence now supports. A memorable caveat is exactly the kind of sentence that survives the
  measurement it came from.

- **An interactive control may not interpolate.** A dial with stops at two measured points and a
  smooth path between them is authoring a number at every position on that path. So every control on
  a page has stops, each stop is a value some artifact recorded, and any position nothing measured
  prints **NOT MEASURED** in the same red as everywhere else. XATU's slider is measured at 0 moves
  revealed and at 4 and nowhere between; watching the middle go blank turned out to explain the
  four-move cap better than either endpoint did.

- **Keep a model's figures and its citation on ONE source line.** `web/figure-audit.js` attributes a
  figure to its line, so a `CTRLDATA`-style table with the artifact path in the same row is what makes
  the trace checkable instead of asserted. It is also the cheapest way to make the guard agree with a
  human reading the file.

## Open

- ABRA STADIUM is not yet linked from ABRA WORLD's front door.
- No page yet renders the four division ledgers or `node engine/status.js` output for a visitor;
  the project's own state is currently legible only from a terminal.
- **`web/index.html` at 80.5% (33 of 41) is now the only page below 100%.** Overall is **91.8%**
  (90 of 98), from 84.3% (70 of 83) and 27.4% (17 of 62) earlier the same day. `models.html` and
  `tower.html` are closed: `models.html` cites `data/quality-filter.json` beside its bot share and
  now **reads** the mechanics census out of `web/status-data.js` rather than carrying it — it moved
  102/144 → 104/147 while that edit was being written, which is why it is read and not restamped —
  and `tower.html` cites `data/damage-validation.json` and takes its species count off
  `data/engine-data.js` instead of a typed 289. The eight left on the front door are the ones with
  no artifact behind them at all, not ones missing a citation.
- **`tests/test-stadium-roster.js` is RED, deliberately, on five generators.** Each writes a
  `data/*` artifact, appears in neither `docs/MODELS.md` nor the Stadium, and is a MODEL by the rule
  above, so none of them can be given a truthful entry in `NOT_A_MODEL`. **The fix is a ledger
  entry and `docs/MODELS.md` is MEASURE's file**, so this is routed, not filed:
  `engine/analyze.js` → `data/meta-usage.json` (the artifact CHOMP and `engine/mag_bot.js` read);
  `engine/porygon2.py` → `data/porygon2*.json` (read by `mew.js`, `player_digest.js`);
  `engine/state_encoder.py` → `data/move-priors.json` (read by `board.js`,
  `medicham2-browser.js`, `fit_policy.js`, `prior_player.js`); `engine/derive_sets.js` →
  `data/species-sets.json` (read by `showdown_bot.js`); `engine/counters.py` →
  `data/counters.json` (read by nothing, and the same class of thing as `COUNTERPLAY`, which the
  ledger already carries).
- **Owed and not written by this division:** `CHANGELOG.md`, the white paper, the deck, the
  technical docs and `docs/SUMMARY.md` all still describe the pre-2026-08-04 state of the site.
  WEB's boundary is `web/`, `app/`, this file and its own tests.

## Retired from Open

- *Reconciling the Stadium to its artifacts (2026-08-04) found `docs/MODELS.md` drifted in three
  places — MAG's fit, MAG's corpus line and SLOWKING's mixture/exploitability/cycle. MEASURE
  corrected all three in its GURU pass and recorded that a fourth reported drift (the mechanics
  census at 42/54) did not reproduce. Closed.*
