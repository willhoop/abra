# OUTPLAYED TURNS ARE NOT NOISE — the click-censoring fix

**Version 3.42.0 · 2026-08-05 · Ordered by Will:** *"i def dont like just tossing turns because they
got outplayed with a move liek encore or follow me, these are the basis of vgc man."* He is right,
and the literature says he is right. This document is the proposal AND the dispatch spec; MEASURE
implements it, ENGINE consults on protocol detection.

---

## 1. The problem, stated precisely

The policy fits learn from human clicks reconstructed out of replay logs. The log records what
**happened**; the fit needs what was **clicked**. Whenever an opponent's play makes those differ,
today's matcher does one of two things, and both are wrong in different ways:

| failure mode | mechanism examples | what the matcher does today | statistical name |
|---|---|---|---|
| executed **target** ≠ clicked target | Follow Me, Rage Powder | **drops the turn** — counted in `unmatchedClicks` (2.92%) / `fit_joint` unmatched (5,555 + 18 ambiguous of 101,459) | biased censoring |
| executed **move** ≠ clicked move, but legal-looking | Encore's application turn (Prankster Encore → victim executes last move, not its click) | **keeps it, labeled wrong** — counted nowhere | label noise |
| click erased entirely | flinch, full paralysis, sleep (`\|cant\|` lines carry no move) | drops — correctly, the click is unrecoverable | genuine missingness |

Two properties make this urgent rather than cosmetic:

**The censoring is MNAR — Missing Not At Random (Rubin, 1976).** A turn is dropped *because* the
opponent's redirection worked. Rubin's taxonomy is exactly the frame: data Missing Completely At
Random costs only sample size; data missing **as a function of the outcome itself** biases every
estimate computed on the survivors. We are not losing 5% of turns at random — we are
systematically deleting the turns where a core VGC mechanic succeeded, then fitting a policy on
the sanitized remainder and playing it in the unsanitized game.

**The label noise is silent and adversarially placed.** The Encore application turn passes every
counter we have: the executed move was on the victim's legal menu, so it "matches," and a click
that never happened enters the training set — concentrated precisely on turns where the opponent
outplayed the player. Learning with mislabeled examples is strictly harder than learning with
missing ones (Natarajan, Dhillon, Ravikumar & Tewari, 2013): a dropped turn costs information; a
poisoned turn *supplies* misinformation.

## 2. What the literature says to do instead

The redirection case is textbook **partial-label learning** (Cour, Sapp & Taskar, JMLR 2011,
"Learning from Partial Labels"): each training instance comes with a *candidate set* of labels
guaranteed to contain the true one. A redirected attack has a candidate set of exactly two — the
visible final target and the target the player may have aimed at before the drag. The correct
likelihood contribution is not "pick one" and not "drop it"; it is the **marginal over the
candidate set**:

```
ℓ_turn(w) = log  Σ_{c ∈ C_turn}  P_w(c | board, choice set)
```

For our conditional logit (McFadden, 1974 — the estimator MAG already uses), this marginal is a
log-sum-exp of affine functions minus the usual normalizer: a difference of convex functions, so
the standard fitting move is **EM** (Dempster, Laird & Rubin, 1977) — E-step: distribute each
partial turn's weight across its candidates in proportion to the current model's probabilities;
M-step: the ordinary conditional-logit fit on weighted rows, which is the code we already have.
(Equivalently CCCP, Yuille & Rangarajan 2003; EM is the implementation we choose because the
M-step is literally `fit_policy`'s existing inner loop with row weights.)

Cour et al.'s identifiability condition matters here and is satisfied: partial labels are
informative when the candidate sets vary — and ours do, because which Pokémon carries Follow Me
varies across games, so no pair of moves is *systematically* confounded.

The Encore case is not partial-label — the true click is **gone**. The fix is detection, not
inference: the protocol announces the coercion (`|-start|POKEMON|Encore` before the victim's
action; forced actions generally carry `[from]` provenance, and forced switches are `|drag|`
rather than `|switch|`). A detected coerced action is reclassified from "label" to
"not-a-click" — removed from the labeled set and **counted**, converting silent poison into loud,
honest missingness. The flinch/sleep/paralysis class stays dropped (the click is unrecoverable),
but each slot drops alone: today an unprovable slot in a pair turn takes its provable partner down
with it, which is pure waste.

(For completeness: state-only turns are not information-free — imitation-from-observation exists
(Torabi, Warnell & Stone, 2018) — but that is a research direction, not this fix.)

## 3. The fix, in four stages, each with its gate

**Stage A — the census instrument.** A classifier over the protocol's own annotations (`[from]`,
`|-activate|`, `|-start|Encore`, `|cant|`, `|drag|`) that labels every human action in the corpus:
CLEAN_CLICK / PARTIAL (with its candidate set) / COERCED / ERASED. Named test case from Will:
priority moves stopped by a blocking ability (Sneasler's Fake Out into a switched-in Farigiraf's
Armor Tail) — whether the intended slot survives in the fail line is a fact about the protocol, to
be read from real logs in the store, and it decides PARTIAL vs ERASED for that whole class. Artifact
`data/click-censoring-census.json` with per-mechanism counts. **The list of mechanisms is derived
from the protocol annotations, not typed from memory** — the whole lesson of this repo is that
hand lists rot. *Gate: a synthetic log with a planted Encore application and a planted redirection
must classify COERCED and PARTIAL respectively; shown failing first by running the classifier
without the Encore rule.*

**Stage B — stop the poison.** The matcher consumes the census: COERCED actions leave the labeled
set, counted in a new `coercedActions` counter with a declared ceiling in the degradation budgets.
This is the priority stage because wrong labels are worse than missing ones (§2). *Gate:
refitting after Stage B on the same corpus must change the label count by exactly the census's
COERCED count; the planted-log test from Stage A wired into `tests/`.*

**Stage C — keep the outplayed turns.** PARTIAL actions enter the fit under the marginal
likelihood via EM row-weighting; pair turns keep their provable slot regardless of the partner.
*Gate: the EM harness is validated on synthetic data first — generate clicks from KNOWN weights,
censor them with the real censoring process, and require the fit to recover the planted weights
within tolerance where the naive (dropping) fit demonstrably does not. That is the
known-bad-input demonstration, and it doubles as the measurement of how much bias Stage C
removes.*

**Stage D — refit and measure, paired.** Both layers refit; held-out paired comparison against
tonight's four-channel weights, same protocol as `data/sheet-channel-value.json` (game-clustered
bootstrap, noise floor stated). Plus the number this whole fix exists for: **behavior on the
outplayed-turn class** — on held-out turns where redirection/Encore is active, the model's
agreement with human clicks, before vs after. If learning from outplayed turns changes how the
bot plays outplayed turns, that is the point, proven.

## 4. What this does NOT claim

- No claim that the recovered turns improve overall top-1 — the class is ~5% of turns; the honest
  expectation is a real likelihood gain concentrated on redirection/Encore contexts, and Stage D's
  class-conditional number is the one to watch, not the corpus-wide average.
- ERASED clicks stay lost. The fix's promise is: **never keep a wrong label, never drop a provable
  one, count everything that remains.**
- The `turnsDropped` ceiling question (5.49%) is superseded rather than resolved: Stages B–C
  change what "dropped" means, so the budget gets re-derived from the new counters with its
  granularity stated — the re-cut Will already has on his desk folds into this.

## 4a. IMPLEMENTATION RECORD — MEASURE, 2026-08-05. Two things above are wrong; here is what is true.

The spec is kept as written; corrections are added, never substituted. Artifacts:
`data/click-censoring-census.json` (Stage A), `data/partial-label-em.json` (Stage C),
`data/censoring-value.json` (Stage D).

**CORRECTION 1 — §1's first row is wrong, and `engine/redirect_audit.js` said so on 2026-08-02.**
Redirection does **not** drop the turn and is **not** counted in `unmatchedClicks`. The redirector is
a perfectly legal candidate target, so the matcher finds it, matches it and is happy — the click
enters the fit with a CONFIDENT WRONG TARGET. So redirection belongs in row two of that table, not
row one: it is label noise, the class §2 calls strictly worse than missingness. That makes Stage C a
poison fix as much as a recovery, and it makes the MNAR framing stronger rather than weaker, because
the mislabel lands exactly on the turns where the opponent's play worked. The 2.92% `unmatchedClicks`
figure is a real number about a different population.

**CORRECTION 2 — a `|drag|` is a third coerced class, and §1 does not list it.**
`engine/durable-ingest.js:67` parses `|switch|`, `|drag|` and `|replace|` with ONE regex, so a mon
phazed in by Roar / Whirlwind / Dragon Tail / Circle Throw is stored as `t:'s'`, identical to a
click. `engine/fit_policy.js`'s `forcedSlot` guard only excludes a switch that follows a faint, so
every drag was being fitted as a voluntary switch decision. **220 of them in the corpus.**

**THE FARIGIRAF QUESTION IS ANSWERED: PARTIAL, NOT ERASED.** Read from real logs, as Stage A asks:

```
|cant|p1a: Farigiraf|ability: Armor Tail|Aqua Jet|[of] p2b: Basculegion
|cant|p2b: Tsareena|ability: Queenly Majesty|Sucker Punch|[of] p1a: Kingambit
```

The blocker is named first, the attempted **move** is named, and `[of]` names the **attacker**.
**284 of 284 priority-block lines carry the attacker slot (100.0%).** So the user and the move are
exact and only the target is ambiguous — and only between the blocker and its ally, because the
ability blocks nothing aimed elsewhere. Candidate set of at most two.

**It is counted and NOT recovered, deliberately.** Showdown emits no `|move|` line for a blocked
attempt (the `TryMove` event returns false before `addMove`), so the class leaves no event and is
invisible to the extracted stream. It exists only in the raw logs, and the raw logs cover **66.17%
of the fit corpus** — the gap is one SOURCE, `data/games.ots.jsonl`, an external archive with no log
file beside it. Recovering these clicks would add outplayed turns from two stores and none from the
third, which is a corpus reweighting wearing a bug fix's clothes. The same applies to the 126
`|cant|` lines that state the click outright (Taunt 59, Disable 58, Heal Block 5, Imprison 4).
Closing it means re-ingesting the ots archive with its logs, which is OPS work.

**The mechanism sets are read from the running format, not typed** — moves with
`condition.onOverrideAction` (`{encore}`), moves with `forceSwitch` (`{roar, whirlwind, dragontail,
circlethrow}`), abilities with `onFoeTryMove` (`{armortail, dazzling, queenlymajesty}`), items
assigning `switchFlag`/`forceSwitchFlag` (**empty in this format**: Eject Button, Eject Pack and Red
Card are all `isNonstandard: 'Past'`), and `data/tags.json`'s `redirects` / `redirectsType`. Every
set refuses to be empty.

**THE CLASSIFIER'S OWN ERROR RATE, measured against the protocol rather than asserted.** The census
scores the event-stream classifier per (game, turn, slot) against the raw log on the 5,917 games that
have one:

| class | protocol says | classifier flagged | both | recall | precision |
|---|---|---|---|---|---|
| Encore application | 619 | 642 | 617 | 99.68% | 96.11% |
| drag | 86 | 86 | 83 | 96.51% | 96.51% |

The 25 Encore false positives are ~0.01% of all actions, and the asymmetry is the right way round: a
false positive deletes a real click, a false negative keeps a poisoned one, and there are two of
those. The most likely cause is an Encore blocked by Protect — `|-activate|…|move: Protect` is not
captured by the extractor, so the move event carries no failure flag. Not chased: fixing it means
editing the classifier, and the classifier was frozen while the refit that depends on it ran.

**Known limit, stated rather than discovered later:** the Encore rule looks for the victim on the
FOE side. Encore aimed at one's own ally would be missed. The recall figure above is the measurement
of how much that costs, and it is at most 2 turns in 619.

## 5. References

- Rubin, D.B. (1976). Inference and missing data. *Biometrika* 63(3).
- Dempster, A.P., Laird, N.M., Rubin, D.B. (1977). Maximum likelihood from incomplete data via the
  EM algorithm. *JRSS B* 39(1).
- Cour, T., Sapp, B., Taskar, B. (2011). Learning from partial labels. *JMLR* 12.
- Natarajan, N., Dhillon, I., Ravikumar, P., Tewari, A. (2013). Learning with noisy labels.
  *NeurIPS 26*.
- Yuille, A., Rangarajan, A. (2003). The concave-convex procedure. *Neural Computation* 15(4).
- McFadden, D. (1974). Conditional logit analysis of qualitative choice behavior.
- Torabi, F., Warnell, G., Stone, P. (2018). Behavioral cloning from observation. *IJCAI*.
