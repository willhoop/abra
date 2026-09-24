# Merge pass into main — 2026-09-24

Merge coordinator run. Sixteen finished branches merged into `main` one at a time, each renumbered on the
`abra/regmc` line above main's top, each pushed before the next. Start: `7c9f7534` (0.87.0). Ledger restamp: 0.110.1 (`803a19ba`). Last merge: Burn Up / Double Shock, 0.111.0 (`85aac6b6`); ledgers restamped again as 0.111.1.

## 1. What merged

| # | branch | provisional | merged as | merge commit | probes after the merge (both regulations) |
|---|---|---|---|---|---|
| 1 | `worktree-agent-a6ef1ce6f974c73f4` Court Change NOT-IN-REGULATION | 0.86.2 | 0.87.1 | `335f544a` | `probe_court_change` 0/0 |
| 2 | `worktree-agent-a6d4345444712c79f` recoil faint order, White Herb before pivot | 0.87.0, 0.88.0 | 0.88.0, 0.89.0 | `5a76c6c1` | `probe_recoil_faint_below_after_move_secondary`, `probe_herb_before_pivot_switch`, `probe_narration_b_line_order` 0/0 |
| 3 | `worktree-agent-a4a865a6da8b65eb0` Curse order, Beak Blast burn | 0.87.0, 0.88.0 | 0.90.0, 0.91.0 | `3dc5ea54` | `probe_curse_ghost_order`, `probe_beak_blast_burn_order` 0/0; branch 2 probes re-run 0/0 |
| 4 | `worktree-agent-aec69d3b13fb0b1d8` Lightning Rod charge redirect, Magic Bounce fail | 0.87.0, 0.88.0, 0.88.1 | 0.92.0, 0.93.0, 0.93.1 | `8ff915ab` | `probe_redirect_above_prepare`, `probe_bounced_fail_names_bouncer` 0/0; branches 2-3 re-run 0/0 |
| 5 | `worktree-agent-ab5c591c0d93461d1` mega stone take guard | 0.87.0 | 0.94.0 | `9d4a9135` | `probe_megastone_take_guard` 0/0 |
| 6 | `worktree-agent-a1ac483af93614de1` solver API `engine/medicham_api.js` | 0.87.0 | 0.95.0 | `b853cbbf` | `test-medicham-api` 0/0 |
| 7 | `disabled-choice-struggle` (+ `worktree-agent-a958af2dc6a0cb4b2`) menu halves | 0.88.0-0.91.0 | 0.96.0-0.99.0 | `6732ea07` | `probe_move_menu_legality`, `probe_disabled_choice_struggle`, `test-medicham-api` 0/0; all earlier probes re-run 18/18 |
| 8 | `menu-halves-gravity-belch-cheeks` | 0.92.0-0.92.2 | 0.100.0-0.100.2 | `afd03130` | `probe_disabled_choice_struggle`, `probe_move_menu_legality`, `test-medicham-api` 0/0 |
| 9 | `worktree-agent-a3a3f5792128c7455` #310/#442 instruments | 0.87.1 | 0.100.3 | `20ee3af1` | `probe_rollout_trace_stream` 0/0 |
| 10 | `worktree-agent-aace036dabfd3b91c` #310 close | 0.92.0 | 0.101.0 | `c021b359` | `probe_rollout_trace_stream` 0/0 on releases cut from the merged tree |
| 11 | `worktree-agent-a7b76e60902ec6b30` roster staging | 0.88.0-0.90.0 | 0.102.0-0.104.0 | `f6be0e0c` | targeted `tests/roster.js --reds` (three rules) 0/0 |
| 12 | `worktree-agent-af2d7b18dd37e7d85` Mimicry | 0.95.0 | 0.105.0 | `2dc30836` | `probe_mimicry_terrain_event_only` 0/0 |
| 13 | `worktree-agent-ae31bbcb8893a2a9c` -ate / Weather Ball | 0.88.0 | 0.106.0 | `43e46c3c` | `probe_ate_abilities` 0/0 |
| 14 | `worktree-agent-a222541d6335eb8a2` -ate picker, Gravity called/chosen | 0.89.0, 0.90.0 | 0.107.0, 0.108.0 | `497b6cb1` | `probe_gravity_called_move`, `probe_disabled_choice_struggle`, `probe_ate_picker`, `probe_ate_abilities` 0/0; three knobs red |
| 15 | `worktree-agent-a5e52bc57194e4279` Reflect Type added-type corners | 0.96.0, 0.97.0 | 0.109.0, 0.110.0 | `ba56e7ac` | `probe_added_type_replaced`, `probe_reflect_type_typeless_added`, `probe_mimicry_terrain_event_only` 0/0 |
| 16 | `worktree-agent-a5d2cc4be7acae7ef` Burn Up / Double Shock clear the added type (stacked on 15) | 0.98.0 | 0.111.0 | this pass's last merge | `probe_spend_type_clears_added`, `probe_added_type_replaced`, `probe_reflect_type_typeless_added`, `probe_mimicry_terrain_event_only` 0/0 on releases `d9d69d58ef31` / `318ccd937118` |

Bot ingest commits (`c800312d`, `1475265d`) were merged in twice (`100dbfc2`, `fb138058`).

**Final tree probe pass**, releases `c8e2aaa17dad` (Reg M-B) and `b72450580e0e` (Reg M-C) cut from `ba56e7ac`'s
engine: every probe above, both regulations — see §6.

`tests/test-docs-current.js` was run on every merge commit in a clean detached checkout: 39 passed, 0 failed, each time.

## 2. Renumbering

Every branch's `CHANGELOG-REGMC.md` and `docs/RUNNING-NOTES.md` entries were re-inserted above main's top entry with the
provisional version replaced; nothing else in an entry changed except the merge notes named in §3. Version tokens
were renumbered only on lines the branch added (never on main's lines), so main's real 0.87.0 / 0.87.1 references
survive. Stacked branches had their references to the parent's provisional numbers mapped to the parent's merged
numbers (e.g. menu-halves' "0.91.0 Struggle rewrite" reads 0.99.0; the Gravity branch's "0.88.0" reads 0.106.0).
The version header of `docs/REGMC.md` and `docs/REGULATION-ROTATION.md` is 0.111.1.

Branch 7's first commit (`8ae6561a`, the solver API) is content-identical to branch 6's `76691522`; it resolved to
main's copy and its entry was not duplicated. Engine resolution was cross-checked with an independent
`git merge-file` of the renumbered branch text: identical, no conflicts.

## 3. Reconciliations (two branches touching the same thing)

1. **`engine/medicham_api.js` vs #310 (merge 10).** The #310 probe's static clause found `newBattle` (0.95.0) calling
   `battleInit` with no stream by default. `newBattle` now throws unless `rng` or `seeded: true` is given and passes
   the stream explicitly. Every caller (`tests/test-medicham-api.js`) already passes `rng`. Recorded as a merge note in
   the 0.101.0 entry and row.
2. **Gravity's chosen-move refusal, wired twice at one site (merge 14).** Menu-halves (0.100.0) used
   `gravitySealsMove` + knob `MEDI_GRAVITY_CHOSEN_PLAYED`; the called-move branch (0.108.0) used
   `pseudoWeatherRefusal` + knobs `MEDI_GRAVITY_CLICKED_MOVE_PLAYS` / `MEDI_GRAVITY_CALLED_MOVE_PLAYS`. Kept both
   behaviours as ONE gate: the called half as 0.108.0 wrote it, the chosen half refused unless either chosen-half knob
   is set, both counters counted. The two tag rows name the same five moves (bounce, fly, flyingpress, highjumpkick,
   magnetrise) and the same `move: Gravity` line in both regulations. Knob demonstrations, both regulations:
   CHOSEN_PLAYED reds `probe_disabled_choice_struggle --part gravity` and `probe_gravity_called_move`; CLICKED reds
   both; CALLED reds `probe_gravity_called_move`.
3. **Census row `refusedByPseudoWeather` (merge 14).** Its chosen arm gave the body High Jump Kick alone. With the
   menu half, that body's menu is empty under Gravity and its click is Struggle (0.99.0), so the row read MISSING
   (25 HP dealt). The arm now keeps Sleep Talk in a second slot. The 0.108.0 notes row's branch-time "1012" is struck
   (`~~1012~~`), not deleted.
4. **MEDSEEN counter object (merges 15 and 16)**: union of both sides' keys.
5. **ROADMAP #310/#442, the #310 probe and the #310/#442 report (merge 10)**: branch 10 carried a hand copy of branch
   9's change; re-merged three-way against branch 9's (renumbered) text, result equal to branch 10's.
6. Split-heading artefacts of the doc conflicts (a duplicated `##` heading in `docs/ENGINE.md` four times, a duplicated
   ROTATION row once, a blank line inside the ROTATION table once) were removed; every branch's ENGINE.md headings
   were checked present in the result.

## 4. Tags

- Merge 4's hand patch to `data/tags-regmc.json` was compared with a fresh `tag_dex --regulation regmc`: identical tag
  rows and params. Merge 8's hand-written Gravity row and the merged tags after merges 13 and 14 were compared with
  fresh regenerations in both regulations: every entity row identical. The hand-merged files were kept, not the
  regenerations, because a regeneration also moves usage counts and ordering.
- **Found, not fixed (ENGINE):** `node engine/tag_dex.js` (Reg M-B) exits 1 — "12 tag(s) matched nothing" (Reg M-C-only
  predicates such as `revivesFainted`, `swapsSideConditions`, plus `switchesOutAtHalf`, `ejectsHolderOnHit` …) — and
  still writes. Committed `tags.json` lacks those 12 tag entries; both committed tag files carry `consumedBy: null` for
  `bypassesSubstitute` and `allyBasePowerBoost` where a regeneration finds a consumer. The Reg M-C regeneration's
  `sheet_entries` read 205,836 against the committed 215,244 (store-side; for OPS to explain).

## 5. Censuses

| | before | after (committed) |
|---|---|---|
| Reg M-C `data/mechanics-census-regmc.json` | 1010 live, 0 missing | **1024 live, 0 missing** (after merge 16; 1021 after merge 14, 1023 after 15) |
| Reg M-B `data/mechanics-census.json` | 1004 (published) | **unchanged, not committed** — tree reads 1020 live, 0 missing after merge 16; Will's call |

## 6. Final probe pass

Releases `c8e2aaa17dad` / `b72450580e0e`, cut from the final engine into a scratch store and copied into
`data/releases/` (gitignored); no release pointer was moved by this pass. Earlier verification releases, same method:
`ac6c640ff957`, `61d753d27b49`, `b655c9ea18dc`, `8e22abe0ab8d`.

44 runs (22 probes × 2 regulations): the 14 plain probes and `test-medicham-api`, `probe_ate_abilities`,
`probe_rollout_trace_stream`, `probe_mimicry_terrain_event_only`, `probe_added_type_replaced`,
`probe_reflect_type_typeless_added`, and three targeted `tests/roster.js --reds` rules. **43 exit 0 on the first pass.**
The one red, `probe_bounced_fail_names_bouncer --regulation regmc`, exit 1, did not reproduce: two immediate re-runs
exit 0 with every assertion green. That probe opens the regulation's *current* release through the pointer, and another
process ("game differential mode A") re-cut and re-pointed `data/engine-release-regmc.json` during the pass (its
`latest_cut` 13:29:32Z). Read as the pointer moving under the run, not an engine result; the failing run's output was
not captured, so this is inferred, not shown. The same pass after merge 14 (releases `b655c9ea18dc` / `8e22abe0ab8d`)
was 40 of 40.

## 7. Deviations from the brief, and why

- **`node engine/status.js --write`** restamped the five ledgers (committed as 0.110.1, a PATCH, because the notes gate
  requires a row). Its `data/provenance-stamp.json` rewrite was NOT committed: the provenance ratchet tripped on other
  processes' untracked `data/_diag*.json` files and its `verified` count moved 7 -> 3 with the release pointer churn.
  The restamped ledgers now read the live gate as 7 of 9 clauses failing, because the gate artifacts predate this
  engine; the gate re-read is the separate step.

- **`git pull --rebase` was not used for the two bot commits.** Rebasing would have linearised the local merge commit
  and replayed the branch's un-renumbered commits. Both bot commits touch only `data/` store shards and
  `data/next-regulation.json`, so they were merged (`100dbfc2`, `fb138058`).
- **`probe_medicham_api_differential.js` was not run.** It is a 1,200-game measurement on a frozen release, not a probe.
- **Full gate re-read not run**, as instructed.

## 8. Owed / red / left alone

- `tests/probe_mimicry_terrain_event_only.js:37`, `tests/probe_added_type_replaced.js:26` and
  `tests/probe_reflect_type_typeless_added.js:38` default `SHOWDOWN_PATH` to the Reg M-B checkout instead of requiring
  `engine/showdown_path.js`; under `--regulation regmc` they CANNOT-ANSWER unless `SHOWDOWN_PATH` names the M-C checkout
  (the ROTATION trap "a probe hard-codes that regulation's checkout"). All Reg M-C runs here set it explicitly.
- The four Gravity knobs (`MEDI_GRAVITY_MENU_OPEN`, `_CHOSEN_PLAYED`, `_CLICKED_MOVE_PLAYS`, `_CALLED_MOVE_PLAYS`) are
  not in `tests/test-mechanics.js` `DELIBERATE_BREAK`, so a census run with one armed would write.
- `tag_dex` Reg M-B exit 1 and the stale tag metadata (§4).
- In the main working tree, left untouched (not created by this pass): `docs/SOLVER-PLAN.md` (untracked; it makes
  `test-docs-current` report 4 FAILs in the main working tree only — clean checkouts are 39/39),
  `data/engine-release-regmc.json`, `data/roster-regmc.json`, `data/roster.*.prev-regmc.json` (untracked),
  `solver/LOG.md` and `data/engine-release.json` (modified by other processes). None were staged.
- All agent worktrees left in place.
