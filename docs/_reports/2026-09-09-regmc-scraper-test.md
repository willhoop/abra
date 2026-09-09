# 2026-09-09 — Reg M-C: scraper rehearsal, detector diagnosis and fix

Historical findings record (`docs/_reports/`, never maintained). Reg M-B stays the ACTIVE regulation;
`data/regulations.json` was not edited. No commit was made. Every figure below was read off a command
run this session; the command is named beside it.

## Verdict

- The scraper handles Reg M-C end to end: **1,044 bo1 + 560 bo3 games** collected via the rehearsal
  path, 0 parse failures, 0 empty `six`/`winner`, idempotent on re-run (+3 / +1 genuinely new ids).
- The detector said "DOES NOT EXIST YET" because `formats.js` (the CLIENT bundle, Last-Modified
  2026-09-08 02:10 GMT) does not list M-C while the replay SERVER already serves it. Fixed: a third
  arrival authority probes `search.json?format=<derived id>`. Shown red → green on the live server.
- The scheduled ingest will start collecting both M-C ids automatically on its next run, with no
  config edit.

## 1. The scraper test (rehearsal path)

Commands (PowerShell): `cmd /c tools\lownode.cmd engine\next_regulation_ingest.js --format <id>`,
twice per id. `PAGES` default 25, `CONC` default 20 (`engine/next_regulation_ingest.js` lines 63-64).

| format | run 1 | run 2 | store | .gz | raw archive |
|---|---|---|---|---|---|
| `gen9championsvgc2026regmc` | 0 → 1,041 (+1,041) | 1,041 → 1,044 (+3) | `data/games.gen9championsvgc2026regmc.jsonl` 6.66 MB | 781,281 B | `data/games.gen9championsvgc2026regmc.raw-logs.jsonl` 1,044 logs |
| `gen9championsvgc2026regmcbo3` | 0 → 559 (+559) | 559 → 560 (+1) | `data/games.gen9championsvgc2026regmcbo3.jsonl` 5.43 MB | 531,272 B | `data/games.gen9championsvgc2026regmcbo3.raw-logs.jsonl` 560 logs |

Both runs exit 0. The second run's appended rows have ids later than the first run's newest, so they
are new uploads, not re-fetches — idempotence holds (dedupe-by-id in `engine/durable-ingest.js`).
Raw archive rows == store rows for both, so **0 games were unparseable** (the archive is a strict
superset of the store; equality means the `six.length<4` filter dropped nothing).

Git: the plain `.jsonl` and `.raw-logs.jsonl` are ignored by `.gitignore:209`; the two `.jsonl.gz`
are untracked and trackable (`git check-ignore` returns nothing for them). The workflow's glob
`data/games.gen9champions*.jsonl.gz` would stage them.

**Note on "raw shards".** The next-regulation collector writes a FLAT raw-logs file, not the dated
shards under `data/raw/<store>/` that the ladder uses. That flat file is gitignored, so on the CI
runner the M-C raw logs are discarded every run — STORE RAW does not hold for M-C on CI. See the
ingest.yml proposal below.

### Extractor audit (snapshot copies, not the live files; `scratchpad/regmc_extract_audit.js`)

| check | bo1 (1,041 rows) | bo3 (559 rows) | ladder baseline (last 1,000 of `games.ladder.jsonl` / `games.bo3.jsonl`) |
|---|---|---|---|
| `format` tag | `champions-regmc` ×1,041 | `champions-regmc` ×559 | derived from the `\|tier\|` line — the rotation alarm can see it |
| empty `six` (sides) | 0 | 0 | — |
| `six` < 6 (sides) | 0 | 0 | — |
| empty `winner` | 0 | 0 | — |
| winner not a player | 0 | 0 | — |
| empty `brought` (sides) | 24 | 22 | 4 / 40 |
| `brought` ≠ 4 (sides) | 496 (24%) | 266 (24%) | 359 (18%) / 365 (18%) |
| `brought` > 4 | 0 | 0 | — |
| forfeit | 478 (46%) | 246 (44%) | 270 (27%) / 192 (19%) |
| zero turns | 15 | 13 | 5 / 25 |
| `openSheet` | 41 (3.9%) | 559 (100%) | 46 / 1,000 |
| bots (either side) | 2 | 4 | — |

`brought ≠ 4` and empty `brought` track forfeits and early ends, same mechanism as the ladder; the
higher forfeit rate is day-one behaviour, not an extractor gap. `openSheet` 3.9% / 100% matches the
M-B rulesets exactly (Open Team Sheets optional in bo1, forced in bo3), which is the only evidence
available for the config block's `openTeamSheets` — the replay search carries no ruleset.

**One pre-existing extractor quirk, not new to M-C:** `sets[*].moves` and `.item` carry two
spellings of the same name — `Glaive Rush` and `GlaiveRush`, `Rocky Helmet` and `RockyHelmet`. The
ladder baseline has the same (`Focus Sash` / `FocusSash`; 1,249 camel-case move strings in the last
1,000 ladder rows, 30,300 in bo3). The unspaced form is the packed-team spelling from the sheet, the
spaced form is the log's. Not fixed here; a dex lookup via `toID` merges them.

### Entities in the M-C games that the ACTIVE regulation's dex does not carry

Derived: `Dex.forFormat('gen9championsvgc2026regmb')`, `legal = exists && !isNonstandard && tier !== 'Illegal'`,
over `six` + `sets` keys, `sets[*].moves`, `sets[*].item`, `sets[*].ability`. Nothing typed.

- **Species (29 distinct keys, bo1)**, by count: rillaboom 1,127; salamence 878; indeedeef 783;
  golisopod 562; baxcalibur 273; salamencemega 271; indeedee 202; golisopodmega 194; baxcaliburmega 82;
  pawmot 82; lucariomegaz 79; absolmegaz 52; garchompmegaz 41; pincurchin 23; cinderace 20; sirfetchd 20;
  inteleon 14; toxtricity 14; grapploct 12; perrserker 10; persianalola 6; squawkabillywhite 4;
  thievul 4; gogoat 2; mrmime 2; persian 2; squawkabillyblue 2; toxtricitylowkey 2; arboliva 1.
  All `isNonstandard: 'Past'` under M-B except golisopodmega and baxcaliburmega (`'Future'`).
- **Moves (10 distinct after merging spellings):** Glaive Rush, Snipe Shot, Drum Beating, Milk Drink,
  Pyro Ball, Overdrive, Octolock, Revival Blessing, Double Shock, Court Change.
- **Items (17 distinct after merging spellings):** Lucarionite Z, Absolite Z, Garchompite Z,
  Baxcalibrite, Golisopite, Salamencite, Psychic Seed, Grassy Seed, Electric Seed, **Rocky Helmet**
  (5+4 bo1, 88 bo3 — banned in M-B, present in M-C), Red Card, Eject Button, Normal Gem, Air Balloon,
  Leek, Terrain Extender.
- **Abilities:** none unknown.

The pinned `pokemon-showdown` checkout does not carry `gen9championsvgc2026regmc` at all
(`tests/probe_unknown_format_refusal.js` PASS: `champions_sim` REFUSES it), so this list is the
M-B-relative delta as observed in play, not the regulation's legality list. Do not treat it as one.

## 2. The detector — diagnosis and fix

**Diagnosis.** `engine/next_regulation.js` had two arrival authorities, both wrong on the day:
- `https://play.pokemonshowdown.com/data/formats.js` — HTTP 200, 160,319 bytes, Last-Modified
  `Tue, 08 Sep 2026 02:10:18 GMT`, 371 entries, 16 Champions entries, **0 occurrences of `regmc`
  or `Reg M-C`**. It is the client's bundle and is rebuilt on the client's deploy cadence.
- `search.json?page=1` — 51 replays across the whole site. At the coordinator's run 0 of 51 were
  M-C; at mine 4 + 2 were. It was tallied only against rows the other authorities had already
  produced, so an id appearing ONLY there could never become a row.

Meanwhile `search.json?format=gen9championsvgc2026regmc` returned 51 games (page cap), newest
2026-09-09T18:26Z; `...regmcbo3` likewise; `...regmd` returned 0.

**The SHOWDOWN_PATH error the coordinator saw** (`Cannot find module '../pokemon-showdown/dist/sim'`)
does not reproduce here: `engine/showdown_path.js` resolves the sibling checkout
`C:\Users\willj\Projects\Pokemon\pokemon-showdown` (which has `dist/sim`) and the local dex lists
333 formats. The relative path in that message means the coordinator's shell had `SHOWDOWN_PATH`
set to `../pokemon-showdown`, which `showdown_path.js` honours verbatim ("an explicit env var always
wins") and which only resolves from a cwd one level below the Pokemon directory. Fix in that shell:
unset it, or set it absolute. Nothing in the repo is wrong.

**Red, before the change** (`node engine/next_regulation.js`, live):
```
  Champions VGC regulation formats detected: 4
    gen9championsvgc2026regma ... regmbbo3   (superseded / known)
  THE NEXT REGULATION DOES NOT EXIST YET. Nothing to collect, and nothing collected.
```
while `search.json?format=gen9championsvgc2026regmc` held 51 games.

**The change** (`engine/next_regulation.js`, +126/-23 lines, minimal):
- `REPLAY_SEARCH_URL` + `PROBE_LETTERS = 3`. `probeIds(activeTriple)` advances the LAST LETTER of the
  active token (M-B → M-C, M-D, M-E) and emits bo1 + bo3 ids — derived from `data/regulations.json`,
  nothing spelled. Stops at `z`; capped at 3 letters.
- `replayFormats()` probes each derived id with `search.json?format=<id>`; a non-empty answer is a
  row `seen_in: ['replay']`, named from the search row's `format` field, carrying `replay_games` and
  `replay_newest`. The global 51-replay sample is folded in too (for a token that is not a one-letter
  advance), but only for ids the other two authorities did NOT list, so the ingest artifact's
  signature cannot flicker with the sample.
- `collectable` now includes `replay`; `collectable_not_simulatable` is `collectable && !dex`;
  new counter `replay_only` with a `::warning::` line; `authorities.replay_search` records what was
  probed and what hit. Injectable `opts.replaySearch` so the arm is provable offline.
- `engine/format_id_scan.js` gate: the id is appended at the call (`REPLAY_SEARCH_URL +
  encodeURIComponent(id)`), so no literal follows `search.json?format=`.
  `node tests/probe_format_id_derivation.js` → GREEN, 0 typed ids under engine/ and build/.

**Green, after the change** (`node engine/next_regulation.js`, live):
```
  replay search   : 6 derived id(s) probed, 2 with games
  Champions VGC regulation formats detected: 6
    gen9championsvgc2026regmc        candidate  [replay]  51 in its search pool, newest 2026-09-09T18:34:11.000Z
    gen9championsvgc2026regmcbo3     candidate  [replay]  51 in its search pool, newest 2026-09-09T18:33:15.000Z
  ::warning::2 format(s) have games on the replay server and are NOT in formats.js yet.
  ::warning::A NEW CHAMPIONS VGC REGULATION IS LIVE.
    gen9championsvgc2026regmc  [Gen 9 Champions] VGC 2026 Reg M-C
      seen in replay; NOT in the local dex — collectable, NOT simulatable
```
plus the paste-ready block (label read from the search row, `openTeamSheets: null` because replays
carry no ruleset). `--no-net` output is unchanged (replay arm `NOT PROBED`, 4 formats, "does not
exist yet") — the offline arm was not touched.

`node engine/next_regulation_ingest.js --dry-run --no-write` now prints
`would collect gen9championsvgc2026regmc, gen9championsvgc2026regmcbo3 — fetching nothing.` and
`COUNTERS {... "candidates":2, "collectable_not_simulatable":2, "replay_only":2, "problems":0 ...}`.
`next_regulation_ingest.js` itself was not edited: it already collects `det.candidates`.

**`data/regulations.json` needs nothing** for collection. The design holds: the collector never
edits it, and the two M-C stores are named by format id and cannot touch the three tracked stores
(test check 6, still green with three next-regulation stores on disk).

## 3. What the scheduled ingest does at its next run

`.github/workflows/ingest.yml` step "Collect the next Champions regulation, if Showdown has shipped
it" runs `PAGES=25 CONC=20 node engine/next_regulation_ingest.js` every run. With this change on
`main` it will: detect both M-C ids as `candidate` via the replay probe → `reconcile()` (no `.gz` in
the checkout yet unless the two local `.gz` are committed, so it starts from 0) → spawn
`durable-ingest.js` for each → write `data/games.gen9championsvgc2026regmc.jsonl.gz` and
`...regmcbo3.jsonl.gz` → the `data/games.gen9champions*.jsonl.gz` glob stages them → commit. It
rewrites `data/next-regulation.json` because the signature moved. **Yes, it starts collecting M-C
automatically.** Until the change is pushed, it keeps saying "does not exist yet" and collects nothing
— the replay pool is rolling (~1,250/format; bo1 filled 1,044 in ~10 h today), so every six-hour run
that passes before the push loses the games that age out. The two local `.gz` files hold the opening
of the metagame (earliest replay in pool: bo3 2026-09-09 08:08 UTC, bo1 08:13 UTC; the bo1 pool was
NOT exhausted at 1,044 < 1,275 cap, so 08:08 is very likely the first public M-C replay).

**Growth budget (CLAUDE.md requires it):** the M-C `.gz` monoliths are 781 KB + 531 KB after one
day; at today's rate (~1,000 + ~560 games/day, ~750 B/game compressed) that is ~0.75 + 0.4 MB/day,
so the bo1 file would reach GitHub's 100 MB wall in roughly 130 days. A regulation lasts about that
long. Shard it before then — see the ingest.yml proposal.

### Manual steps that remain (`node engine/next_regulation.js --checklist`, NOT performed)

1. Archive the outgoing regulation first: `node build/triggers.js`, `node build/archive-regulation.js`.
2. Make M-C simulatable, not merely collectable: pull `pokemon-showdown` (the pinned checkout carries
   M-A and M-B only; `champions_sim.dexFor` refuses M-C today), then `node engine/champions_sim.js`
   must print FOUND for the new id.
3. Edit `data/regulations.json`: paste the printed `regmc` block, fill `openTeamSheets` (evidence:
   bo1 3.9% / bo3 100% open sheets, same as M-B → `true`), `started` (2026-09-09), `started_evidence`
   (earliest replay 08:08 UTC in `data/games.gen9championsvgc2026regmcbo3.jsonl`), then set `active`.
4. Rebuild what the format decides: `build/build_browser_data.js`, `engine/switchin_order.js --write`,
   `engine/tag_dex.js && build/build_tags_js.js`, `build/build_engine_data.js && engine/merge_mega_into_engine.js`,
   `engine/artifact_audit.js` (check H fails until every new mega has a row).
5. Re-point the store and the model: decide which store is "the ladder"; `engine/analyze.js`;
   `build/triggers.js`.
6. Decide every format id typed under `tests/`: 45 live call sites across 43 files name
   `gen9championsvgc2026regmb` (`node tests/probe_format_id_derivation.js` lists them).
7. Only then cut a release and re-measure: `engine/status.js`, `engine/provenance.js`.

The checklist also lists 12 direct readers of `data/regulations.json` that write an artifact
(`build/archive-regulation.js`, `engine/analyze.js`, `engine/chomp_ev.js`, `engine/meta-ingest.js`, …)
to run by hand after the flip.

## 4. Tests

- `node tests/test-next-regulation.js` → **GREEN, 25 checks** (19 before + 6 new). New check 3b
  proves the replay arm is WIRED offline with an injected search: a fake that answers games for the
  first derived id moves candidates 0 → 1 with `seen_in = replay`, collectable, not simulatable,
  named from the search row; a fake answering nothing yields 0. Also asserts the probe derives
  `2 × PROBE_LETTERS` ids and that the first is one letter past the active regulation, not a constant.
  No existing check pinned the old behaviour, so none was rewritten.
- `node tests/probe_format_id_derivation.js` → GREEN (0 typed ids under engine/, build/).
- `node tests/probe_unknown_format_refusal.js` → PASS (M-C still refused by the pinned checkout —
  correct until the checkout is pulled).

## Files touched this session

- `engine/next_regulation.js` — the replay-search arm (edited).
- `tests/test-next-regulation.js` — check 3b (edited).
- `data/next-regulation.json` — rewritten by the two rehearsal runs (artifact; expected).
- `data/games.gen9championsvgc2026regmc.jsonl(.gz|.raw-logs.jsonl)`, `...regmcbo3...` — new stores.
  Plain and raw files are gitignored; the two `.gz` are untracked.
- Not touched: `data/regulations.json`, `.github/workflows/ingest.yml`, tags/roster/census/simulator,
  the `pokemon-showdown` checkout, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md`.

## Proposed rows (not written)

**RUNNING-NOTES row.** Reg M-C detected on the replay server 2026-09-09 while `formats.js` (Last-Modified
2026-09-08 02:10 GMT) did not list it; `engine/next_regulation.js` gained a replay-search arrival
authority over derived next-letter ids, shown red → green on the live server; rehearsal collection
1,044 bo1 + 560 bo3 games into `data/games.gen9championsvgc2026regmc*.jsonl`, 0 unparseable
(artifact: `data/next-regulation.json`, this report). **Supersedes.** Nothing — no published figure
moves. **Basis.** unchanged. **Owes.** technical docs (the three-authority description of the detector).

**CHANGELOG.** MINOR is not warranted (no published figure moved); PATCH by the repo's own table.
`### Fixed` — the next-regulation detector treated the client bundle as the arrival authority and
missed a format the replay server was already serving; it now probes `search.json?format=` for the
ids derived by advancing the active regulation's letter (cap 3). `### Added` — check 3b in
`tests/test-next-regulation.js`; counter `replay_only`.

**ROADMAP rows.**
- Shard the next-regulation stores and their raw logs like the ladder (`build/compress-stores.js`
  knows only the three tracked stores; the M-C `.gz` monoliths hit 100 MB in ~130 days at day-one
  rate; the flat raw-logs file is gitignored so CI discards M-C raw logs every run — STORE RAW broken
  on CI for the new regulation).
- Dual spelling of move/item names in `sets` (`GlaiveRush` / `Glaive Rush`) — pre-existing, packed
  sheet vs log; normalise at extract or document as a re-parse.
- `openTeamSheets` in the config block is `null` from the replay arm; derive it from the store's
  `openSheet` rate once a store exists, or from `formats.js` once it catches up.

**Proposed `.github/workflows/ingest.yml` change (owner: the other agent this wave).** No change is
REQUIRED for collection to start. Recommended: (a) after the collect step, shard the new stores'
raw logs and rows under `data/raw/<formatid>/` and `data/parsed/<formatid>/` via
`build/compress-stores.js` (it would need to learn the next-regulation store names from
`engine/next_regulation_ingest.js`'s `ownStores()` rather than a list), and drop the
`data/games.gen9champions*.jsonl.gz` monolith glob once shards exist; (b) surface the
`::warning::N format(s) have games on the replay server and are NOT in formats.js yet` line in the
job summary so the day is visible in the Actions UI.

## OWED, NOT RUN

- Commit + push of `engine/next_regulation.js`, `tests/test-next-regulation.js`,
  `data/next-regulation.json`, and the two `.gz` stores (the opening ~10 h of M-C exist only on this
  disk; the pool is rolling). Not done — brief said no commits.
- `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md` rows above — not written.
- `.github/workflows/ingest.yml` sharding change — proposed, not made (other agent owns it).
- The seven checklist steps in §3 — listed, not performed. `data/regulations.json` untouched;
  M-B remains active.
- Pulling `pokemon-showdown` so M-C becomes simulatable — not done (out of scope).
- `node engine/status.js --write` / division ledger row — not run (no ledger was edited).
