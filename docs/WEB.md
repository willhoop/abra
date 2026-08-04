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
| `web/stadium.html` | **ABRA STADIUM** — model select screen, one cabinet per model. | added 2026-08-04 |
| `web/models.html` | the model map — inputs and outputs per model | live |
| `web/scoreboard.html` | watch MAG think | live |
| `web/tower.html` / `web/futuresight.html` | ALAKAZAM's Battle Tower | live |
| `web/orb.html` | ORB — On-battle Read Board | live |
| `web/replay.html` | MEW replay viewer | live |

## Guards this division owns

| Test | What it prevents |
|---|---|
| `tests/test-stadium-roster.js` | The Stadium's cabinet rack drifting from `docs/MODELS.md`. A model added to the ledger with no cabinet is **invisible** — there is no gap on screen where it should have been. Judgement gaps (sections of the ledger that are not models) are declared by name **with a reason**, never filtered out by a pattern that would also swallow a real model added later. |

The pattern generalises, and should be applied whenever a page starts carrying a list that a source
file also carries: compare the page against its source, fail on drift, and declare every exception.
This is CLAUDE.md's *a derived artifact is not a fact until something compares it to its source*,
applied to HTML.

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

- **Carry the caveat onto the page.** MEDICHAM's win rate is below chance and the Stadium says so on
  the cabinet. A CI is not simplified away for a cleaner card.

## Open

- ABRA STADIUM is not yet linked from ABRA WORLD's front door.
- No page yet renders the four division ledgers or `node engine/status.js` output for a visitor;
  the project's own state is currently legible only from a terminal.
- `docs/SUMMARY.md` and the white paper carry results that no page cross-checks. A guard comparing
  a rendered figure against its artifact — the `test-stadium-roster.js` pattern applied to numbers
  rather than to a roster — does not exist yet and is the obvious next one to build.
