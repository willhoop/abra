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
- **No external assets, ever.** No CDN, no webfont URL, no remote image. A blocked font fails
  silently and the page ships in a fallback nobody chose.
- **Some pages are opened from `file://`.** `models.html` and the replay coach are expected to work
  offline from bundled `data/*.js`. Check before introducing `fetch()`.
- **Carry the caveat onto the page.** MEDICHAM's win rate is below chance and the Stadium says so on
  the cabinet. A CI is not simplified away for a cleaner card.

## Open

- ABRA STADIUM is not yet linked from ABRA WORLD's front door.
- No page yet renders the four division ledgers or `node engine/status.js` output for a visitor;
  the project's own state is currently legible only from a terminal.
- `docs/SUMMARY.md` and the white paper carry results that no page cross-checks. A guard comparing
  a rendered figure against its artifact — the `test-stadium-roster.js` pattern applied to numbers
  rather than to a roster — does not exist yet and is the obvious next one to build.
