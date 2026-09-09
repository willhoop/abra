# Pre-6.0.0 OPS review — 2026-09-09 (read-only; nothing touched, nothing run)

Historical by construction. Every figure here was read from a file at the cited line on 2026-09-09;
re-derive rather than quote. Written by the OPS division; saved to disk by the coordinator because the
OPS agent has no write tool.

## VERDICT IN ONE PARAGRAPH

The 100 MB wall is gone, not postponed — sharding landed 2026-09-06 and no tracked file grows toward
it. Ingest is landing four times a day. The live bot loads the quarantined weights but nothing shows
it running since 2026-08-04. ONE BLOCKS item: the `smogon-stats` cron fires 2026-09-11 07:00 UTC and
rewrites `data/smogon-priors.json`, a frozen engine SOURCE, with a fresh `generated` date on every
run, so every release cut before it drifts. SHOULD FIX BEFORE: the pinned pool is gitignored (one
laptop copy); the local plain stores are five days behind origin; the legality verdict is a
2026-08-27 snapshot.

## 1. The 100 MB wall — LANDED, wall removed by construction

- **Status: sharding landed 2026-09-06.** `.github/workflows/ingest.yml:44-52` ("THE COMPRESSED FORM IS NOW SHARDS, NOT ONE .gz — 2026-09-06"), `:53-66` restores from `data/parsed/` and refuses on an empty shard dir, `:295-298` removes the monoliths from `add_artifacts`, `:335-340` stages `data/parsed/*/*.jsonl.gz` by glob. `.gitignore:75-100`: the three monoliths are `git rm --cached` and named-ignored. `docs/RUNNING-NOTES.md:573-595` is the row; `docs/_reports/2026-09-06-store-sharding-and-reclaim.md:183-185` records the cutover order and that the `.gz` files were left on disk.
- **Wall date re-derived:** not applicable. No tracked store file is rewritten; a shard is capped at `SHARD_BYTES = 32 * 1024 * 1024` of source (`build/compress-stores.js:268`). The 2026-10-17 date in the 09-06 report described `data/games.ladder.jsonl.gz`, which is no longer tracked.
- **What ingest writes now** (`ingest.yml:299-301, 315, 326, 335`): `data/meta-usage.json`, `data/live.js`, `data/move-priors.observed.json`, `data/bring-priors.json`, `data/chomp-ev.json`, `docs/ORIENTATION.md`, `data/next-regulation.json`, next-regulation `.gz` stores, raw shards, parsed shards. None approaches the wall.
- **Other tracked files over 50 MB:** none found in what I could read. `data/games.r4-decided.jsonl` 44.9 MB (`dusk-size-gate.json:12`) / 42.9 MB (`2026-09-06-repo-cleanup.md` §2), written once 2026-08-04. Enumeration owed (below).
- **Debris, reported and left:** `data/games.ladder.jsonl.gz`, `data/games.bo3.jsonl.gz`, `data/games.ots.jsonl.gz` still on disk, untracked, no longer written (`ingest.yml:295-296`).
- **Severity:** none. Done.

## 2. Ingest

- Cron `'17 */6 * * *'` (`ingest.yml:16`), `permissions: contents: write` (:18-19) — the job token, not a PAT. Commit author `abra-bot` (:272-273).
- **Landing:** shard pairs at `20260909T0447` and `20260909T1128`, matching HEAD commit `a07c00a4 ingest: new ladder games 2026-09-09T11:28Z`. 09-08 has four pairs (`0441, 1124, 1643, 2114`). Shard stamps sit 4-5 h after each cron slot; Actions logs were not readable here.
- **Does ingest touch what a measurement reads?** It never writes `data/team-pool-frozen` — the only mentions in `engine/ build/ tools/ .github/` are readers and CLI strings. It never writes any `SOURCES` file (list at `engine_release.js:92-200` checked against :299-301). It DOES overwrite `data/meta-usage.json`, which `engine/game_differential.js:697-719` reads LIVE for the severity ranking and stamps `severity_usage_source.generated` into the artifact (:9251-9263). By design and stamped; not a sample-selection input. `data/bring-priors.json` is read by `engine/mew.js:1103` (self-play generator, not frozen).
- **`data/next-regulation.json` says generated 2026-09-01 — not a stalled step:** `engine/next_regulation_ingest.js:349` leaves the file alone when detection is unchanged.
- **Latent gate hazard (verify, do not assume):** ingest commits `docs/ORIENTATION.md` (`ingest.yml:263-265, 300`). `engine/docs_scan.js:1201-1202` counts `^docs/` as RECORDABLE and exempts only `_reports|_inbox|_outbox|archive`, and `tests/test-docs-current.js:673-697` (clause 5) fails on any commit since the last RUNNING-NOTES commit that moved a recordable path. If a bot commit changes ORIENTATION.md after the last notes commit, clause 5 goes red with no human change behind it. **DEFER WITH REASON** — unconfirmed; one command decides it (owed).
- **Severity:** SHOULD FIX BEFORE only the ORIENTATION check; ingest itself is healthy.

## 3. The two human stores

- `data/team-pool-frozen/` holds `games.bo3.jsonl` (13,214 lines, sha `5e10d7ba991f`) and `games.ots.jsonl` (4,167 lines, `cd21077a4578`) — `FROZEN.md:23-26`. bo3 + ots only; `engine/bench_speed_consolidate.js:448` states the ladder store is not in it. The current differential stamps `team_store_pinned_to: data/team-pool-frozen` (`data/game-differential.json:16947`).
- **The pinned pool is gitignored** (`.gitignore:176-180`): the sample every 6.0.0 board-material figure was measured on exists on one laptop; only FROZEN.md's digests are tracked. **SHOULD FIX BEFORE** — copy it outside the tree and verify sha256 against FROZEN.md (owed).
- `data/meta-usage.json` reads ONE store: `engine/analyze.js:153` `source:'data/games.ladder.jsonl'`; the workflow runs `node engine/analyze.js data/games.ladder.jsonl` (`ingest.yml:225`). bo1 only, never bo3.
- **Local plain stores are stale:** `docs/OPS.md:17-18` (stamped 2026-09-09 08:09) shows `games.ladder.jsonl` / `games.bo3.jsonl` last written 2026-09-04 01:30, while origin's shards run to 09-09T1128. Any unpinned local read is five days behind. **SHOULD FIX BEFORE** — `--restore-parsed` (owed). `engine/quality.js:41-46` falls back to `<store>.jsonl.gz` when the plain file is absent; on a fresh clone neither exists now, and quality.js is a frozen source deliberately not touched (`RUNNING-NOTES.md:580-581`). Reported, not a 6.0.0 input.
- Store-derived, unfrozen, read by an instrument: `data/meta-usage.json` (severity ranking, stamped), `data/store-validation.json` (legality verdict — §8), `data/diff-team-pool.json` single-slot cache (ROADMAP #546 residue, `docs/ROADMAP.md:1440`).

## 4. The self-play store — #536 still open

- `docs/ROADMAP.md:1430`: 3,090 lines, 3,001 unique ids, 89 ids twice, blocks at lines 2,902-2,993 and 2,994-3,090; status "open — corpus DEFECT". The generator is fixed (`engine/mew.js:817-831`: run stamp now part of the id); the store was not repaired.
- **Readers keyed by id:** `engine/validate_selfplay.js:184` (`ok(dupes === 0)`, red, needs `ABRA-HEAP: 6144`); `build/build_mew_bundle.js:113-116` dedupes by id (drops one game of each pair); `engine/conditional_audit.js:190` `kept.set(g.id, g)` (last wins); `engine/rebuild_records.js` re-asks its guard by id (`OPS.md:95-100`).
- **Severity: DEFER WITH REASON** — the store is MEASURE's generator output, downstream of MEDICHAM and quarantined; nothing in the 6.0.0 figure set reads it (mew bundle is site content, web paused).

## 5. The live bot

- Two files. `engine/showdown_bot.js` is the local `--no-security` bot (server default `ws://localhost:8000`, :38; `/trn NAME,0,` with no password, :195; `makeScoringPlayer({ greedy: true, joint: true })`, :319 — so it also reads `data/policy-weights-joint.json`, `magnemite.js:442`). `engine/mag_bot.js` is the public one: name via `--name` (default `MAG`, :61; live games record `"bot": "MAGABRA"`), public server per header :24-25, password order `--pass` → `SHOWDOWN_PASS` → `data/.showdown-pass` (:73-90), format `CS.FORMAT` from `data/regulations.json` (`active: regmb`).
- **Policy:** `mag_bot.js:729 makeScoringPlayer()` → `magnemite.js:41 WEIGHTS_FILE = data/policy-weights.json` unless `--weights` (:765). With `--rollout`/`--miltank` (:143) MILTANK decides and defers to MAG. The 34 recorded games (`OPS.md:16`) carry `rollout: true, rolloutN: 120, greedy: false, ots: true` (`data/live-games/battle-…-2659523072.json:5-12`).
- **On quarantined weights: yes.** `data/policy-weights.json` is in `SOURCES` (`engine_release.js:156`) and on CLAUDE.md's quarantine list. If the bot is started it plays with them.
- **Running now?** Not determinable from files. No `schtasks`/Task Scheduler/nssm/pm2 reference in `tools/ engine/ docs/ build/`. Last recorded battle `started: 1785819302497` → 2026-08-04 UTC. Two replays in `data/live-games/replays.txt`.
- **Severity:** SHOULD FIX BEFORE — state in the 6.0.0 docs that MAGABRA is paused and, when resumed, plays the pre-refit vector.

## 6. Format rotation and the Showdown commit

- `engine/next_regulation.js:4`: a new regulation "is announced for roughly 2026-09-09" — today. Detection at 2026-09-01 had `candidates: 0` (`data/next-regulation.json:34`); the ingest re-checks every run (`ingest.yml:219-221`) and would auto-collect `data/games.<newid>.jsonl` without an edit.
- **Manual steps** (`next_regulation.js:450-521 --checklist`): archive first (`build/archive-regulation.js`), then **pull pokemon-showdown** — the "collectable, NOT simulatable" case at :363-368 and step 2 at :475-479 — then paste the block into `data/regulations.json` and flip `active` by hand, rebuild the derived sources, re-point the store, decide every typed format id under `tests/`, then cut a release. `:22` records the checkout 72 commits behind upstream (measured 2026-08-31).
- **Is the Showdown commit stamped?** Yes. `engine/champions_sim.js:85-86` `PINNED_COMMIT = '20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4'` (2026-07-22); `actualCommit()` reads `git rev-parse HEAD` of the checkout (:231-239); `engine_release.js:352-357` stamps it as `showdown_commit` in every release manifest and `REL.stamp()` (:499); the current `data/game-differential.json:16953` carries `showdown_commit: 20ad99ff…`, equal to the pin. Caveat stated in the code itself: an uncommitted edit inside `SHOWDOWN_PATH` is invisible to it (`engine/wire_ladder.js:619`).
- **Severity:** DEFER WITH REASON — no rotation has shipped; the procedure is derived and printed. Re-run the detector today (owed).

## 7. Repository health

- Hook armed: `.git/config:8 hooksPath = .githooks`; `.githooks/pre-commit` and `commit-msg` exist.
- Pack: 1037.1 → 525.1 MiB after `git gc` (`2026-09-06-repo-cleanup.md` §4); `.git` 526 → 591 MB after the 19 shard blobs, pack unmoved at 524.28 MiB (`RUNNING-NOTES.md:587-588`).
- PDFs: five ledger PDFs plus `ROADMAP.pdf`, `RUNNING-NOTES.pdf` untracked and ignored (`docs/.gitignore:20-24, 43-44`).
- `.gitattributes` `text eol=lf`: 18 of the 27 `SOURCES` pinned (lines 78-95); the nine absent are named at :72-77 — `medicham2-browser.js, rollout_leaf.js, position_features.js, engine/tags.js, mc_key.js, set_priors.js, smogon_priors.js, data/quality-filter.json, data/engine-data.js` — deliberately, because pinning them rewrites CRLF bytes and moves every release id. The instrument set is pinned separately (:126-140). Not a 6.0.0 blocker; the digest read is EOL-insensitive per :118-122.
- History rewrite: nothing in flight — grep for `filter-repo|filter-branch|BFG|force-push` across `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, and the 09-07..09-09 reports returns nothing.
- Notes: `.git/config:12-13` has an `[lfs]` block but no `filter=lfs` attribute exists — LFS initialised once, unused. `.git/config:21-23` binds a `jsonl-store` merge driver to paths that are now gitignored (`.gitattributes:41-45`) — inert.

## 8. Corpus contamination filter

- **Not in `engine/durable-ingest.js`** — grep for `custom|ruleset|isNonstandard|contaminat` returns nothing. Correct: store raw, filter on top.
- **In `engine/quality.js:154-203` `illegalTeams()`**: keys on SPECIES and ITEM rejections from `data/store-validation.json` (written by `engine/validate_store.js`), never MOVE (the Illusion argument, :169-176). Config `on: true`, classes `["species","item"]` (`data/quality-filter.json:68-73`). A missing verdict prints NOT APPLIED rather than a clean store (:194-201).
- **Gated:** `tests/test-quality.js:25-27` asserts the class list excludes `move` and that `known_limitation` is recorded. Session-close lists `tests/test-quality` red 1 of 31, carried openly — not re-checked here.
- **Limitation for 6.0.0:** the verdict is a snapshot generated 2026-08-27T05:14Z over 67,384 judged games (`quality-filter.json:80-81`); games appended since are unjudged (`quality.js:181-182`), and it judges the ladder store only (`quality-filter.json:131`). **SHOULD FIX BEFORE** — refresh the verdict before any clean-store figure is published (owed).

## 9. Anything else that would embarrass a 6.0.0

- **BLOCKS — a cron rewrites a frozen engine source on 2026-09-11.** `.github/workflows/smogon-stats.yml:17-18` (`0 7 4 * *`, `0 7 11 * *`) runs `node engine/smogon_priors.js` (:53) and commits `data/smogon-priors.json` (:83). `engine/smogon_priors.js:219` stamps `generated: new Date().toISOString().slice(0,10)` and :228 writes the file, so even with no new month the bytes change and the commit lands. `data/smogon-priors.json` is a frozen `SOURCES` entry (`engine_release.js:150`). The current file reads `generated 2026-09-04, month 2026-08` — the 09-04 run already moved it once. `ingest.yml:236-252` documents exactly this failure for `move-priors.json` ("every write here minted a NEW ENGINE and withheld every artifact measured before it") and fixed it by writing an `.observed` table and promoting by hand. The smogon workflow was never given the same treatment.
- **Credentials:** no `ghp_`/`github_pat_`/AWS/Slack token pattern anywhere in the tree; `data/.showdown-pass` ignored (`.gitignore:142`); both workflows use the job token via `permissions: contents: write`, nothing expiring.
- **Site artifacts ingest overwrites:** `data/live.js`, `data/meta-usage.json`, `docs/ORIENTATION.md` — by design; web is paused.
- **A tracked store for a SUPERSEDED format:** `data/games.gen9championsvgc2026regmabo3.jsonl.gz` (Reg M-A bo3, classification `superseded`, `next-regulation.json:77-86`) is the 51-game rehearsal store (`CHANGELOG.md:3155-3158`), tracked on purpose (`.gitignore:95-97`) and reconciled idempotently on every ingest (`ingest.yml:404`, `next_regulation_ingest.js:144, 219-224`). DEFER — harmless, but it is a Reg M-A artifact in a Reg M-B 6.0.0 tree; decide whether to keep it.
- **Already owed by the session-close note, not duplicated here:** the release re-cut for `tags.json`/`abra-tags.js` disagreement (`2026-09-09-session-close.md:65-69`) — 6.0.0 must not rest on that snapshot.

## OWED, NOT RUN

```bash
# 9 (BLOCKS) — stop the 2026-09-11 cron writing a frozen source. Two options; pick one BEFORE Thursday 07:00 UTC:
#   (a) hold the cron: edit .github/workflows/smogon-stats.yml -> make the priors step write data/smogon-priors.observed.json
#       and drop data/smogon-priors.json from its `git add` (mirror ingest.yml:236-252); promote by hand.
#   (b) minimal: disable the workflow in the Actions UI until (a) lands.
# Prove the hazard is real before editing (byte-stable output would refute it):
node engine/smogon_priors.js && git diff --stat -- data/smogon-priors.json && git checkout -- data/smogon-priors.json

# 3 — back up and verify the pinned pool (untracked, one copy):
sha256sum data/team-pool-frozen/games.bo3.jsonl data/team-pool-frozen/games.ots.jsonl     # expect 5e10d7ba991f… / cd21077a4578…
cp data/team-pool-frozen/*.jsonl <somewhere outside the tree>/

# 3 — bring the local plain stores up to origin (union by id, cannot delete):
node build/compress-stores.js --restore-parsed && node build/compress-stores.js --verify-parsed
node engine/status.js --write

# 8 — refresh the legality verdict before any clean-store figure is published:
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/validate_store.js --write
node tests/test-quality.js

# 2 — decide the ORIENTATION.md clause-5 question with one read of history:
git log --author=abra-bot --name-only --format=%H -5 -- docs/ORIENTATION.md
node tests/test-docs-current.js

# 1 — enumerate tracked file sizes:
git ls-files -z | xargs -0 stat -c '%s %n' | sort -n | tail -20

# 6 — re-run the rotation detector today (announcement date is today per engine/next_regulation.js:4):
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/next_regulation.js
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/champions_sim.js     # commit_matches must be true

# 5 — confirm the bot is not running (by name, read-only; never kill by image):
tasklist /FI "IMAGENAME eq node.exe" /V | findstr /I mag_bot

# 4 — a cheap id-uniqueness count for #536 without playing a game:
node -e "const s=new Set(),d=new Set();require('fs').readFileSync('data/games.selfplay.jsonl','utf8').split('\n').filter(Boolean).forEach(l=>{const id=JSON.parse(l).id;(s.has(id)?d:s).add(id)});console.log(s.size,'ids',d.size,'duplicated')"

# owed by the session-close note, restated so it is not lost:
tools\lownode.cmd engine\engine_release.js cut "tags.json and abra-tags.js back in agreement"
tools\lownode.cmd engine\major_readiness.js
```
