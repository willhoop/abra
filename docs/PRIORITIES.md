# PRIORITIES — the ordered work queue

**Opened 2026-08-04 from the overnight session.** Every item traces to a measurement or a probe.
Where an item has no number, it says so.

For *what a set is* and *which slots are genuinely open*, see [BACKLOG.md](BACKLOG.md) — that file is
domain analysis. This file is the queue.

## How this is ordered

Not by size, and not by how annoying it is. By **what a wrong answer costs**, which here runs one way:

```
a broken MECHANIC  →  every rollout is wrong
  → every leaf value is wrong
    → every search decision is wrong
      → every H2H comparing two of them cancels the error and reports success
```

**Fix what is FALSE, then what is UNCHECKABLE, then what is merely WEAK.** An improvement measured on
a broken engine is not an improvement, it is a new unknown.

Three standing rules apply throughout. Probe first and watch it fail. The census never goes down. A
red test is fixed in the session that sees it red, or waived by Will by name — never filed.

---

## P0 — FALSE. The engine reports things that are not the game.

Every rollout, leaf value and H2H ever run inherited all of this.

| # | Item | Evidence | Owner |
|---|---|---|---|
| 1 | **`redirects` — the attack VANISHES** | 7,240 uses. `no Follow Me: aimed 92 / partner 0 \| Follow Me: aimed 0 / partner 0`. Follow Me and Rage Powder have been a free team-wide Protect in every rollout ever run | ENGINE *(landing)* |
| 2 | **`drain` heals nothing** | 8,553 uses. `dealt 51 to the foe; user 85 → 85 hp` | ENGINE *(landing)* |
| 3 | **`choiceLock` — two engines disagree about a fact** | 5,886 uses. `board.js` passes `test-choice-lock.js`; medicham2 does not. FACTS ARE GLOBAL, broken | ENGINE *(landing)* |
| 4 | **`multiHit` priced as one hit** | 4,655 uses. The differential structurally cannot see this, so the probe is the only guard | ENGINE *(landing)* |
| 5 | **`blocksSoundMoves` / `punishesContact`** | 2,726 / 1,761 uses | ENGINE |
| 6 | **`fixedDamage` — Seismic Toss worth zero** | 1,122 uses, `mv.bp=0` | ENGINE *(landing)* |
| 7 | **Freeze-Dry** | 1,252 uses | ENGINE |
| 8 | **Foul Play swings with the wrong Attack** | 734 uses, 1.55× high. Body Press and Psyshock work *by accident* | ENGINE *(landing)* |
| 9 | **Disguise, Bulletproof, Soundproof, Overcoat, Dry Skin's Fire half** | the last 4 of 400 seeded differentials | ENGINE *(landing)* |
| 10 | **`forcesSwitch` (513), `hazard` (195)** | probed red | ENGINE |
| 11 | **39 tags still unprobed** | coverage 137/176 | ENGINE |
| 12 | **12 census mechanics missing** | Facade, Ice Scales, Feint, recharge, Avalanche, Gyro Ball, Lightning Rod, Unnerve, Cursed Body, White Herb, Belly Drum, Tri Attack | ENGINE |
| 13 | **`train_value.py` drops every forme-changed body** | 21.7% of faints, 22.7% of damaging events, 20.8% of all damage — silently. 21,196 of 21,629 dropped targets are megas. The `venusaurmega`/`venusaur-mega` bug in a new file; fix by calling `engine/mc_key.js`, not a second resolver | MEASURE |

**Blocked on a signature change:** `writesAccuracy`/`accuracyMod` — `moveAccuracy(id, field)` takes
neither attacker nor defender. **Possibly not bugs:** `critRatioUp`/`alwaysCrit` — `dmgRange` models
no crit anywhere, so there is nothing to modify.

### P0.5 — the release boundary. Do this the moment P0 lands.

**Cut a named, frozen engine release.** Every SEARCH baseline and every MEASURE number currently
describes an engine in which redirection deleted attacks. Cutting the release triggers the refit and
the seven restamps, and it is the only thing that stops the next result being born `PRE-CHANGE`.
Until then, **start no wide run** — it will measure a build that stops existing. *(DIVISIONS.md rule 1.)*

---

## P1 — UNCHECKABLE. Numbers we quote that nothing can reproduce.

| # | Item | Evidence | Owner |
|---|---|---|---|
| 14 | **R2 is re-run or it is nothing** | base timings are never dumped, and a duration is not recomputable in principle — no CPU, node version or load recorded. It also timed `explore=0/maxTurns=20` when the shipped leaf is `1.0/60` | MEASURE |
| 15 | **17 twin-test statistics on the site with no artifact** | `web/index.html:1107-1108` — `52.3% of decisive pairs (95% CI 50.9–53.6)`, `87,150 games`, `43,575 paired`, stamped "Confirmed 2026-07-30". Only `586,816` is backed. Either MEASURE writes the artifact or the paragraphs go | MEASURE + WEB |
| 16 | **Two live definitions of "clean games"** | `live.js`/`winrate-backtest.json` say 6,943; `meta-usage.json`/`roles-eval.json`/`guru-matchups.json` say ~5,269. The front door renders the larger beside results computed on the smaller | MEASURE |
| 17 | **`guru.js` says `n_decisive: 0`, `guru-matchups.json` says `6`** | and `guru.js` is *generated from* it. The site is self-consistent only by luck of which file it reads | MEASURE |
| 18 | **Exploitability is 3 feature generations stale** | WOBBUFFET's 63.2% [56.6, 69.3] was on 17 features; we ship 53 **and** greedy-over-sampling, which makes the policy *more* deterministic. Average strength rose; readability is unmeasured | MEASURE |
| 19 | **`rollout_r1_join.py` writes naked `isoformat()`** | `2026-08-03T04:14:10` parses in JS as `08:14:10Z` — a four-hour shift. Latent only because status.js refuses withdrawn artifacts | MEASURE |
| 20 | **`n_measured`/`n_unit` missing on R1 and R4** | one line each | MEASURE |
| 21 | **PORY tooltip contradicts the PORY room** | `index.html:2149` "beats a coin, well calibrated" vs `:915` "I add nothing over counting" | WEB |
| 22 | **WEB has no number of its own** | the fraction of rendered figures tracing to an artifact is unmeasured. The division that polices drift does not get to exempt itself | WEB |
| 23 | **`data/games.ots.jsonl` not written since July** | either OTS ingest moved to the ladder store or it stopped. Read the ingest code; do not guess from the filename | OPS |

---

## P2 — WEAK. Real components that under-perform.

**The leaf gates most of this.** Advantage-reweighted BC needs a critic worth trusting; so does
downside-aware selection. Neither starts before the leaf question is settled.

| # | Item | Why | Owner |
|---|---|---|---|
| 24 | **The action-ranking backtest** | Every leaf number so far scores a *position*. A search leaf ranks *actions*, and two leaves with identical Brier can order actions completely differently. **Nothing measured so far touches this.** Enumerate expressible joint actions per decision, score with `rolloutWinProb` and `materialP`, report rank-correlation and argmax-agreement **with intervals** — not a winner. ~2,000 decisions ≈ 5 h at n=200, ~1 h with a 40-rollout screen. Do NOT size it as a superiority test; that needs ~190,000 decisions | SEARCH |
| 25 | **MILTANK ships TWO leaves** | `miltank.js:216-222` is a second hand-rolled playout loop that never calls `rolloutWinProb`. The 53.22%-vs-50.99% contrast is partly a contrast between *leaves*, not settings | SEARCH |
| 26 | **Preview calls `battleInit({seeded:true})` on a fresh game** | suppresses turn-1 Intimidate and weather setters | SEARCH |
| 27 | **`board.js` scores every switch with one flat feature** | MAG's switching measured **10 points worse than never switching**, and a switch was on the menu on 17 of 121 R3 decisions. A hole in the live policy, not a measurement problem | MEASURE *(owns the refit)* |
| 28 | **Downside-aware selection** | MILTANK argmaxes the **mean** rollout value, so it cannot tell a flat 60% line from a 90% line that loses on the spot. The distribution is already computed and everything past the first moment is thrown away. Selection rule only — no new model, no refit, scorable on the R4 harness. From a domain expert describing how strong players actually decide | SEARCH |
| 29 | **MACHAMP re-run** | half-run on a 17-feature vector against today's 56, and the only component whose objective is winning rather than imitating | MEASURE |
| 30 | **Fit the same LINEAR vector to a winning objective** | the cheap ablation separating "capacity" from "objective". If the null moves, capacity was never the binding constraint and architecture is second-order. We can afford this ablation; the external work does not have one | MEASURE |
| 31 | **Self-play volume 0.15:1 → 10:1** | the external pipeline that works runs 10 self-play games per human game; MEW has 1,000 against 6,890, built and gated. **After the release boundary** | MEASURE |
| 32 | **PPO clipping instead of the hand-rolled trust region** | `train_policy.js`, bounded change to one file | MEASURE |
| 33 | **`--miltank-explore` on `mew.js`** | two parsed flags, and the A/B that settles explore=1.0 as a *player* rather than a *judge* becomes a standard ~420-game paired SPRT. Currently not runnable at all | MEASURE |
| 34 | **`train_policy.js` `writeWeights` provenance lie** | copies the base file's `generated`/`source`, so a REINFORCE checkpoint claims `source: engine/fit_policy.js` | ENGINE |
| 35 | **`battleResult` cannot tell a wipeout from an expired clock** | real hazard, measured at 0.2–0.5% of playouts — a correctness fix, **not** the explanation for anything | ENGINE |
| 36 | **45-second live decision budget** | real VGC allows 45 s on a 7-minute clock. R2's leaf cost has never been checked against it | SEARCH |

---

## Capacity

8 physical / 16 logical cores (Ryzen 7 7735HS). **RAM is the ceiling, not cores.**

**16 GB installed, 13.35 GB usable, and the gap is not recoverable from software.** The Radeon 680M
reserves ~2.65 GB as a UMA frame buffer in firmware. Only a BIOS change (UMA frame buffer 2 GB →
512 MB on this ThinkBook 14 G7 ARP) recovers it. Do not spend time looking for a Windows setting;
there isn't one.

Measured breakdown at 04:17 on 2026-08-04, with four agents live and 3.6 GB free:

| process | count | GB |
|---|---|---|
| `claude` — this session **plus every other Claude window** | 20 | 2.88 |
| `vmmem` | 1 | 1.43 |
| `node` — one agent's engine run | 1 | 1.34 |
| `svchost` | 92 | 1.23 |
| `msedgewebview2` | 11 | 0.42 |

**`vmmem` is CONFIRMED as Virtualization-Based Security, not a leftover VM.** Checked directly:
`VirtualizationBasedSecurityStatus = 2` (enabled and running) and `SecurityServicesRunning = 2`
(Hypervisor-Enforced Code Integrity / Memory Integrity), with `HvHost` and `vmcompute` running. WSL
is **not installed**; Docker and the Android subsystem are **not running**; there are no Hyper-V VMs
to list. It started with the machine, not with any session.

It was suspected of being a Claude Cowork relic. It is not. **It is a security feature, it is a
protected process that cannot be killed, and it should not be disabled to buy memory.** Recorded
because it looks exactly like reclaimable overhead and is not — the next person to go looking for
1.4 GB will land on it too.

**The `claude` figure is ONE window, and this was got wrong once already.** 2.88 GB across 20
processes looks like several sessions and is not: it is the Electron shell and renderer (~1.1 GB
between two processes), the agent workers (~200-350 MB each), and roughly fourteen MCP servers at
14-116 MB apiece. Closing windows is not the lever, because there is one window.

**The only lever actually under our control is agent concurrency.** Budget an agent at ~300 MB
itself, plus up to ~1.3 GB if it spawns a `node` engine run. Four light agents cost about what one
heavy one does, so the cap is not a count — it is how many are holding a rollout at the same time.
Check `FreePhysicalMemory` before adding one rather than assuming a number.

`mew_farm` runs 12 procs at `--conc 1` (44–46 games/sec). `--conc` must stay at 1: the simulator is
synchronous and CPU-bound, so in-process concurrency never overlaps real work and only multiplies GC
pressure. Measured 8 procs at `--conc 4` = 11 games/sec against the same 8 at `--conc 1` = 38.

For agents: **4 concurrent is the working cap** while engine work is live, not the 6 in DIVISIONS.md.
Two agents each holding a rollout is what actually exhausts memory.

---

## Not on this list, deliberately

- **A transformer, or any architecture change.** The cheap ablation (#30) runs first. Changing
  architecture and objective at once is exactly the un-ablated result we criticised in others.
- **More MAG features.** Four measured nulls, with an overdispersion check (~1.00) saying they are
  genuine rather than a real effect hidden by team heterogeneity.
- **Deeper search.** Our evidence and the external evidence agree that the leaf bounds a search
  agent. A better search over a coin-flip evaluator is a better-organised coin flip.
