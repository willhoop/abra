# The orphaned series k=16 (aa2): a real series, and the preview choice lost to the server's chat throttle

Date: 2026-09-26. Read-only investigation of the live run `solver/out/rotom/aa2-2026-09-25T23-54-09-059Z/`
(`--release eaa5becc54eb`, arms `aa-prior.json`, A/A, both arms `policy: prior`). Nothing in the run
directory was modified and no process was touched. Scratch scripts are in the session scratchpad
(`k16/leads.js`). Historical findings record, not maintained.

## Verdict

1. **`game-bestof3-gen9championsvgc2026regmcbo3-2687988520` was a real, rated series** against
   `weedwizardxx68` (ladder 1000, medicham32 1031). It was not a phantom. The id is public because the
   room was never hidden: 8 of the 17 series in this run have public ids, so a missing `pw` suffix is
   normal.
2. **medicham32 did not lose or forfeit anything by 02:04Z.** It **won game 1** at 02:01:01Z (replay
   `gen9championsvgc2026regmcbo3-2687988521`, `|win|medicham32`). The bot is playing **game 2**
   (`battle-...-2687991391`, joined 02:01:41Z, turn 5 by 02:04:06Z) **at the same time as series k=17**.
   The ladder book has no row for k=16, and it will not get one.
3. **The cause was the Showdown chat throttle, not a room problem.** The bot sent `/choose team 2143|2`
   at 01:53:31.5Z. The server dropped it and sent
   `|raw|…Your message was not sent because you've been typing too quickly.` twice into the battle room.
   The bot records the choice as `sent: true` and never resends. The server waited for medicham32's team
   preview choice. The opponent did not turn the timer on for about 4.5 minutes, so there was no traffic.
   The watch orphaned the series at 01:57:05Z. About 80 s later the opponent turned the timer on. The
   server counted down **medicham32's** preview clock from 60 s and then auto-picked the default team
   (slots 1 to 4, leads 1 and 2).
4. **This is a gap in the hang fix (2ba63f7e), in two places, and a wider defect in game 1 of every series.**

## Evidence

### Timeline (local clock; the server's `|t:|` stamps are about 6 s ahead)

| UTC | source | what |
|---|---|---|
| 01:53:28.855 | events | k=15 `series_end`, winner Jackie67890; row k=15 written |
| 01:53:29.260 | events | `/savereplay` for k=15 g2 |
| 01:53:30.196 | events | `ladder_search` k=16 |
| 01:53:31.398 | events | `ladder_matched` `…-2687988520` (public id), join |
| 01:53:31.407 | rotom.js:535 | `/timer on` to the bestof room |
| 01:53:31.434/.435 | events | **two** `join_from_updatesearch` for `battle-…-2687988521` |
| 01:53:31.438 | rotom.js:605 | `battle_join`, `/timer on` to the battle room |
| 01:53:31.545 | decisions | preview rqid 2, `team 2143`, `sent: true` |
| (in the bot's own room log) | games/…2687988521.log | two `message-throttle-notice` lines directly after `|teampreview|4` |
| 01:56:05 / 01:56:25 / 01:56:45 | events | probes 1-3: `/crq roominfo` answers **`alive`, users 2** each time |
| 01:57:05.482 | events | `series_orphan` "silent 212 s through 3 probes"; `/leave` bestof room; k=16 has no row, `ladder_error` |
| 01:57:07 | events | k=17 matched (`…-2687989813-…pw`) |
| ≈01:58:18 | replay | `Battle timer is ON … (requested by weedwizardxx68)`, then `medicham32 has 60 … 5 seconds left` |
| 01:59:18 | decisions | turn 1 request: the preview has resolved |
| 02:01:01 | events | `game_end` g1, **winner p1 = medicham32**; replay saved |
| 02:01:41 | events | `battle_join` `battle-…-2687991391` = **k=16 game 2**, played alongside k=17 |

Replay search (`search.json?user=medicham32`, read-only GET) did not list `…2687988521` before its
save. The direct replay `gen9championsvgc2026regmcbo3-2687988521.json` returned 404 at 01:58Z and
was available after the bot saved it at 02:01Z.

### What the replay shows the server did

- There is no `medicham32 also wants the timer to be on` line. The bot's `/timer on` to the battle room
  was dropped as well: two notices, two dropped messages (`/timer on` and `/choose`).
- The leads were **Indeedee-F + Gardevoir**. That is sheet slots 1 and 2, the server default. The choice
  `2143` would have led Gardevoir + Indeedee-F. Sneasler (slot 3) came in as the first replacement,
  which is consistent with the default bring of `1234`.

### Why the silence was real

The watch treated 212 s without a line as a dead room. The room was not dead: both players were in it
and the server was waiting for medicham32. Showdown sends timer ticks only when the timer is on (see
`server/room-battle.ts` `nextTick` in `pokemon-showdown-mc`), and nobody had turned it on. Our request
had been dropped too.

### The same defect in game 1 of every series

`k16/leads.js` compares each preview decision with the leads the server actually used.

| run | game 1: throttled | game 1: preview applied | games 2-3: throttled | games 2-3: preview applied |
|---|---|---|---|---|
| aa2 (this run) | **14 of 17** | 3 of 17 (the unthrottled ones) | 0 of 21 | 21 of 21 |
| aa1 (pre-fix) | 4 of 10 | 6 of 10 | 0 of 12 | 12 of 12 |

In every throttled game 1, the preview choice was lost and the server auto-picked the default team.
Usually this happens after 60 s, when the opponent turns the timer on. Three other replays show the same
thing: k=17 g1 (`…2687989814`), k=15 g1 (`…2687985934`) and k=11 g1 (`…2687976704`, where our
`/timer on` got through and only the choice was dropped). So **in this run, 14 of 17 game-1 team
previews were played with sheet slots 1-4 and leads 1+2, not with the policy's choice.** A game 2 has
no burst before it, and all 21 were correct.

This does not bias an A/A comparison, because both arms lose the choice at the same rate. But it
**silently disables CHOMP/preview for game 1**, and it would bias any arm that differs at preview. The
per-game `preview` decision row says `sent: true` for a choice the server never received. This is a
capability that cannot prove it ran.

## Where the code needs a fix (SOLVER owns `solver/rotom/`; this report fixes nothing)

1. **Root cause: there is no client-side send pacing, and the throttle notice is ignored.**
   `solver/rotom/rotom.js:278`, `const send = (s) => { … ws.send(s) … }`, sends immediately. The server
   (`pokemon-showdown-mc/server/users.ts:33-36,1442-1455`) allows one message per 600 ms and queues 5.
   Anything beyond that is **dropped** with `message-throttle-notice`, and `/choose` is not exempt. The
   burst at series start is `/search`, `/utm`, `/savereplay`, `/leave` (previous series), `/join` bestof
   (plus the `pw` twin), `/timer on` bestof, `/join` battle **twice** (updatesearch fires twice before the
   room answers, so `battles.has(rid)` is still false: rotom.js:342), `/timer on` battle, and then
   `/choose`. The choice is last, so it is the one dropped. The fix belongs in `send()`: a paced outgoing
   queue with at least 600 ms spacing that puts `/choose` ahead of `/timer` and `/join`. A second part
   belongs in `handleBattle`: treat a `raw` `message-throttle-notice` line as "last send lost", and
   resend the open request's choice (the `_needResend` path at rotom.js:780 already does that for
   rejoins). Also count it, so a zero or a spike is visible.
2. **The hang fix orphans a live series.** `onRoomInfo` (rotom.js ~428-435) logs `answer: 'alive'` and
   does nothing else when we are in the room. `LADDER_LIB.stallAction` (ladder.js:95-103) then orphans
   the series after `SERIES_MAX_PROBES` whatever the probes answered. An "alive, and we are in it"
   answer should count as life, or at least stop the orphan. A room that is alive and waiting on us is
   the case the watch should repair (resend the open request), not abandon. It is fair to orphan only
   `gone`, or `alive` with no battle request of ours outstanding past a much longer bound.
3. **Orphaning does not end the series; it only stops tracking it.** `orphanSeries` (rotom.js:450-461)
   sets `bo.done`, sends `/leave` for the bestof room only, and calls `maybeChallenge`. The battle rooms
   stay joined, and later games arrive through `|updatesearch|` (rotom.js:339-343). So the bot keeps
   playing the orphaned series **in parallel** with the next ladder series. Because it left the bestof
   room and `bo.done` is true, it will never see the series `|win|` or the rating lines. **A rated result
   and its rating change are dropped from the ladder book silently.** That biases the mean over the last
   N series and `S − E`, which is exactly the number this ladder exists to produce. As long as the watch
   can orphan an alive series, `orphanSeries` must either forfeit it explicitly (spend it knowingly and
   record S=0) or keep it and block the next search. It must not do neither.

## Owed

- k=16 is still open. Its final result will show only in the battle-room events and replays, not in
  `ladder-series-medicham32.jsonl`. When the run ends, record it by hand from `events-medicham32.jsonl`
  and the two or three replays (`…2687988521`, `…2687991391`, and any game 3) as a separate,
  clearly-marked row, or declare it excluded. Do not let it disappear.
- The 14 of 17 game-1 previews in aa2 that defaulted mean that game-1 results in aa2 (and 4 of 10 in
  aa1) were not played with the policy's preview. This is recorded here and not captioned elsewhere.
