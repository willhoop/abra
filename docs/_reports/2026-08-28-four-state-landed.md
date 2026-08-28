# The four state fixes, verified on a settled tree and landed — 2026-08-28

Closing verification for the pass written up in `docs/_reports/2026-08-27-four-state-fixes.md`,
`-instruct-shield.md`, `-two-gates.md` and `-shell-side-arm.md`. The agent that wrote the four
patches was killed mid-verification, at the point of re-cutting a release over the settled tree.
This pass did not author a fix. It read the staged diff, ran the probes unpiped, re-ran every
instrument on one release cut over the settled tree, and committed.

## THE TWO NUMBERS FIRST

| | reads |
|---|---|
| **board-material** | **0 of 961** — `state.games_board_never_diverged` = 961, `games` = 961 |
| **damage, sixteen corners** | **0/6000 at every one**: midpoint, `top`, `bottom`, `idx01`…`idx14` |

Both on release `aea838766e7f`, seed 20260804, arm `middle`, cap 12,
`--team-store data/team-pool-frozen`, census pin `9446a684709d`, `--state --end-state`.
**All four landed. None was dropped.**

## WHAT WAS STAGED, AND WHETHER IT WAS COMPLETE

`git diff --cached -- engine/ tests/` is 1,974 insertions over six files. Read in full. **No
half-written function, no call site without a callee.** The four state changes are:

1. `#519` — the `status` action branch swapped `if(t.protect)` for
   `shieldRefuses(t, a.mv)` / `shieldRefusalAnnounce(t)`, the shared reader that consults
   `shieldsUser.blocksStatus`. Knob `MEDI_STATUS_SHIELD_BLIND=1`.
2. `#514` — a `failsWithoutUserLatch` gate at use time, with `LATCH_FIELDS_WRITTEN` derived from
   the module's own source and `MEDFAILS.userLatchUnwritten` for a latch with no writer.
3. `#517` — `volatileStartGate` applied in `applyMoveVolatile`, five ordered clauses, plus the
   consume, the charge cancel through the renamed `_queueCancel`, and the `-start` label off
   `startLine`.
4. `#518` — the category choice at the commit site in `battleTurn`, a per-use clone hung on the
   action (`a.move.mv = Object.assign({}, _pcm, {c: …, flagUse: …})`), and `mvMakesContact` given
   a third parameter. **Every call site of `mvMakesContact` and `stealFlagOK` in the diff is
   updated together with the signature** — 7 sites, checked by reading each one.

## THE PROBES, RUN UNPIPED

| probe | exit | what it asserts |
|---|---|---|
| `tests/probe_status_blocksstatus.js` | **0, GREEN** | Glare lands through King's Shield on both engines; Protect refuses on both; no shield inflicts on both. Prints the legal shield family (5, exactly one `blocksStatus=false`) and the `kind:'status'` family (11 members, **0** carrying `noProtectFlag`) so the swap has exactly one difference on it. |
| `tests/probe_two_gates.js` | **0, GREEN** | 8 Smack Down cells, authority and ours identical, `flying`/`levitate` moving as the live control; the `magnetrise` board leaf, the consume and the Bounce cancel all agree. Belch: 0 damage with no berry on both, and the authority's request slot still reads `"disabled":false`. |
| `tests/probe_shell_side_arm.js` | **0, GREEN** | 6 arms, each played as a real turn. Category and damage agree on all 6; **coins drawn 0 on a non-tie and 1 on a tie, on both engines** — the short-circuit, which is what keeps the middle arm in step. |

## THE SETTLE — ONE RELEASE, AND THE DELTA WAS DERIVED

The engine moved after `d29f6677bc76`. Diffing the two release manifests (26 files each) gives
exactly one differing digest, `engine/medicham2-browser.js`, and diffing the two snapshot bodies
gives exactly one hunk: `#514`'s `LATCH_FIELDS_WRITTEN` fell back through a silent
`catch(e){/* an unreadable source is the empty set above */}`, now
`MEDFAILS.latchSourceUnreadable = 1` plus `latchSourceUnreadableWhy`. The pre-commit silent-catch
gate is right about that, and under node the branch cannot fire — `__filename` is always a string.

`aea838766e7f` was cut over the settled tree: **`0 of 26 files have moved since`**. Generated frozen
sources were already rebuilt before it (`data/tags.json` and `data/abra-tags.js` both carry
`picksCategory`, `volatileStartGate`, `failsWithoutUserLatch` and `gatesSelection`).

## EVERY INSTRUMENT, RE-RUN ON `aea838766e7f`

| instrument | on `aea838766e7f` | on `d29f6677bc76` |
|---|---|---|
| census | **773 live / 773 probed / 0 missing** | 773 / 773 / 0 |
| board-material | **0 of 961** | 0 of 961 |
| whole-game raw / clause | **6 raw, 1 of 961 after 5 declared** | 6 / 1 |
| damage `--n 6000 --seed 20260804` | **0/6000 at all sixteen corners** | 0/6000 |
| roster items | **139**, 0 DIFFER, 0 DID-NOT-FIRE, reds **18/18** | 139, 0, 0, 18/18 |
| roster abilities | **129**, 0 DIFFER, 0 DID-NOT-FIRE, reds **29/29** | 129, 0, 0, 29/29 |
| roster moves | **475**, 0 DIFFER, 0 DID-NOT-FIRE, reds **35/35** | 475, 0, 0, 35/35 |
| `all_mechanics_fire --kind all` | every summary count identical; 1,289 games, 0 threw, 0 sheets unassembled | identical |
| gate | **6 of 8 PASS**; mechanics **2 of 9**; whole-game **1 of 961** | 6 of 8, 2 of 9, 1 of 961 |

Census at `HEAD` before this pass: **766 live / 766 probed / 0 missing**. Now **773 / 773 / 0**.
**Up seven. It did not go down.**

## TWO THINGS THE VERIFICATION PINNED DOWN

- **`34/35 -> 35/35` is right about the pass and attaches to the FOURTH cut, not the fifth.**
  `data/roster.moves.prev.json`, which holds the `d29f6677bc76` bytes, already reads 35 of 35
  caught, so the CRLF restore landed before that cut and this pass confirmed the row twice rather
  than earning it. The direction of travel in `docs/ENGINE.md` and the CHANGELOG stands; which
  release it belongs to is now stated beside it.
- **Git Bash's `grep -c $'\r'` says `engine/medicham2-browser.js` has zero carriage returns.**
  Counting the bytes in node says **34,902**, and both `--reds` anchors that embed `\r\n` match.
  The tool is doing text-mode translation. This was very nearly written up as "the CRLF story is
  wrong"; it is the check that was wrong. Recorded in the sprint notes as a carry-forward.

## OWED, NOT RUN

Nothing below was started, by instruction. Each is a fact about what is still open, not a claim
about what was measured.

- **`move:switcheroo` (85 clicks / 64,846 stored games) and `ability:berserk` (56 teams / 13,116
  open-sheet games)** — the two worst of the 2 of 9 remaining diverging mechanics, and the reason
  the mechanics clause still fails. `tests/probe_berserk_switcheroo.js` and
  `docs/_reports/2026-08-27-berserk-switcheroo.md` exist, untracked, and were not run here.
- **Instruct's shield check** — `tests/probe_instruct_shield.js` exists, untracked, not run.
  `docs/_reports/2026-08-27-instruct-shield.md` is the account.
- **The `5324/4096` multiplier, Healer / Shed Skin, and the Endure volley collapse (`#511`).**
- **`engine/board_state.js` neither compares `volatile:smackdown` nor declares it uncomparable** —
  an UNLISTED omission. This pass did not add it to either list; that is not ENGINE's call to take
  quietly. Safe to wire now that the gate has landed.
- **Charge's `-start` payload diverges** — authority `Charge`, ours `move: charge`. A pre-existing
  declared gap in the `volatileAnnounce` deriver; belongs to the narration batch.
- **`volatileAnnounce` still cannot read a guarded multi-statement `onStart`.** 49 members; the
  `volatileStartGate.startLine` fallback covers the one member that has a gate and nothing else.
- **Six new counters have only ever been read on a staged board** — `categoryPicked`,
  `categoryPickTieDrawn`, `contactFlagPerUse`, `volStartGateRefused`, `volStartGateApplied`,
  `userLatchRefused`. `game_differential.js` surfaces no `MEDSEEN`, so the pool-scale reach of all
  four fixes is unknown.
- **The per-use contact flag has no fixture.** Nothing has staged a Physical Shell Side Arm into a
  Rough Skin or a Spiky Shield.
- **The unreproducible faint row** (`|upkeep <> |faint|p2b`) — not touched; 33 staged arms agree
  with the authority.
- **The whole-game baseline is still stamped under a two-generation-old pin**, so
  `engine/quarantine.js` withholds direction of travel and is right to.
- **ROADMAP `#516`, `#511`, `#507`, the partial trap's `!source.activeTurns` clause** — carried
  over unchanged; nothing here touched them.
- **`data/interaction-matrix.json` and `data/wire-ladder.json` are UNSAFE**, so both figures are
  withheld by `engine/provenance.js`.
- **Left in the tree, not deleted, not mine**: `.scratch_*` files and directories at the repo root,
  `data/_scratch-scovillain-dump.json`, `data/_pair-pilot.json`,
  `data/medicham-represented-clicks.json`, and `stash@{0}` / `stash@{1}`. `stash@{0}` is the
  backup of this same work and was neither popped nor dropped.
