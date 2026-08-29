/* rollout_leaf.js — judge a position by PLAYING IT OUT, instead of by scoring a snapshot.
 *
 * See docs/ROLLOUT-design.md. The short version: PORYGON2 judges a position at 63.70%, and
 * "material sign" — literally counting bodies and HP — judges it at 60.28%. The whole learned value
 * function is worth 3.4 points over counting. A search that maximises it is close to a search for
 * "take the most material this turn", which greedy already does.
 *
 * MEDICHAM can now answer the question a different way: seed it from the real board and play it out.
 * That was not buildable yesterday — the engine turned 10.8% of real clicks into a NO-OP TURN, and
 * a no-op is not neutral, it says the move was worthless. After 2026-08-03 it represents 96.7%
 * (engine/medicham_coverage.js) and can switch, which matters because a rollout that cannot switch
 * misjudges every position whose answer is a switch.
 *
 * NOTHING HERE IS A NEW ENGINE. The seeding is board.js's own `dmgMon`, which already maps a tracked
 * Pokemon onto a MEDICHAM body with live HP, status, stat stages, item and the EFFECTIVE ability —
 * the same function board.js uses to price damage. Reusing it means a rollout and a damage feature
 * cannot disagree about what a Pokemon is.
 */
'use strict';
const path = require('path');

const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));                   // globalThis.MC / mcEff, for MEDICHAM
const MEDI = require('./medicham2-browser.js');
const B = require('./board.js');
const TAGSMOD = require('./tags.js');
/* ROADMAP #145 — the one PP fact. See engine/pp.js for why it is a module and not a call into
 * medicham2-browser.js, whose five PP functions are file-local and are ENGINE's to export. */
const PP = require('./pp.js');

/* Every Pokemon a side owns, actives first, then the bench.
 *
 * THE BENCH IS SPECIES NAMES, NOT TRACKED BODIES: `bench()` returns what was brought, is not on the
 * field and is not in the graveyard, and the board keeps no live object for it. So a mon-shaped
 * object is synthesised for it and handed to the SAME `dmgMon` the actives go through, rather than
 * building it a second way here. `nature` is what dmgMon reads to decide the sheet is known, so
 * passing the sheet through is what makes a benched Pokemon carry its declared item instead of the
 * usage guess.
 *
 * Including the bench at all is new. Before voluntary switching existed it would have been
 * decorative; now it is half the rollout, and a leaf that judged 2v2 when the real position is 4v4
 * would be answering a different question.
 *
 * *** WHAT THE SYNTHESIS USED TO INVENT — ROADMAP #248, FIXED 2026-08-13. ***
 * It passed `item`, `nature` and `pp` from the sheet and stopped there, so:
 *
 *   - THE MOVES WERE THE DATASET'S. `dmgMon` overwrites `buildMon`'s representative four with
 *     `mon.moves` and nothing put the declared four on this object, so every body coming off the
 *     bench was valued on the AVERAGE build of its species in a format where the sheet is on the
 *     table. That is the same shape as the mega rows shipping with `mv: []` and as the two 2026-07-30
 *     instances CLAUDE.md records: the sheet reaching one consumer and not the next.
 *   - HP AND STATUS WERE FULL AND CLEAN. A body that pivoted out at 20% and burnt came back whole on
 *     every sample, on both sides. The board holds them now (`benchState`, written on switch-out);
 *     the guard is for a Board built before that landed, and the fallback is the old behaviour.
 *
 * BOOSTS STAY EMPTY AND THAT IS NOT AN OVERSIGHT: Showdown clears stat stages on switch-out, so a
 * body arriving from the bench genuinely has none. */
function sideTeam(board, side, dex) {
  const out = [];
  const seen = new Set();
  for (const L of ['a', 'b']) {
    const m = board.slot(side, L);
    if (m && !seen.has(m)) { seen.add(m); out.push(m); }
  }
  const sheets = (board.sheet && board.sheet[side]) || {};
  for (const sp of board.bench(side)) {
    const sh = sheets[sp] || null;
    const st = (typeof board.benchState === 'function') ? board.benchState(side, sp) : null;
    out.push({ species: sp,
               hp: st && typeof st.hp === 'number' ? st.hp : 1,
               status: (st && st.status) || '',
               boosts: {},
               /* THE ITEM IS ASKED FOR, NOT READ OFF THE SHEET (ROADMAP #271). A benched body is the
                * easiest one to get wrong here for the same reason its PP was: it has no live tracked
                * object, so this synthesis is the ONLY place its item is decided — and it read the
                * SHEET, which says what the Pokemon started the game with. Knock Off it, Trick it, or
                * simply let it eat its own berry before it pivoted out and the seed handed MEDICHAM a
                * body holding something the game removed. `sheetItem` is the one function that knows;
                * null means "no sheet at all", and `undefined` is passed on for that case so `dmgMon`
                * keeps `buildMon`'s dataset guess exactly as it did before. */
               item: (() => {
                 const obs = (typeof board.sheetItem === 'function') ? board.sheetItem(side, sp) : null;
                 if (obs != null) return obs;
                 return sh ? (sh.item || '') : undefined;
               })(),
               nature: sh ? (sh.nature || '') : undefined,
               /* THE DECLARED FOUR. Passed raw; `dmgMon` norms them, drops anything with no MC row
                * and keeps `buildMon`'s dataset set when the sheet declared nothing — so a
                * closed-sheet game is bit-identical to what it was. */
               moves: sh && Array.isArray(sh.moves) ? sh.moves : undefined,
               /* PP (ROADMAP #145). A BENCHED Pokemon is exactly the one this is easiest to get
                * wrong: it has no live tracked object, so it is synthesised here — and a synthesised
                * body with no ledger arrives at full PP even though it may have spent six turns on
                * the field before it pivoted out. Taken by REFERENCE from the board, same object the
                * actives hold, so the two cannot drift. `ppTable` is absent on a Board built before
                * this landed, hence the guard rather than a bare call. */
               pp: (typeof board.ppTable === 'function') ? board.ppTable(side, sp) : undefined });
  }
  return out;
}

/* THE DEAD ARE PART OF THE POSITION (ROADMAP #244).
 *
 * Will, 2026-08-13: *"miltanks rollout needs to just play the game out on medicham and have it match
 * showdown perfectly thats the whole point. miltanks just chooses the actions."* So the seed may not
 * approximate anything the real position knows, and the real position knows who is dead.
 *
 * `battleInit` derives THREE things from the ONE array it is handed -- the field (`teamA[0..1]`), the
 * bench (`teamA.slice(2)`) and THE ROSTER (`sfA.team = teamA.filter(Boolean)`) -- and the roster is
 * what `fallenCount` counts. So dropping the corpses before the seed did not merely tidy the bench,
 * it told MEDICHAM nobody had died: Last Respects at 50 where the position says 150, and a Kingambit
 * entering with a Supreme Overlord snapshot of zero. The deeper into a game the position is, the
 * wronger it gets, which is exactly the phase both mechanics exist for.
 *
 * THE COUNT IS NOT THREADED THROUGH AS AN OPTION, AND THAT IS THE WHOLE DESIGN. A `fallen: 2` field
 * on `battleInit` would make this card right and would still hand MEDICHAM a side of four where the
 * real side has six -- and it would be a SECOND SOURCE for a fact the engine already owns, which is
 * the rule CLAUDE.md says this project breaks most expensively. The seed reconstructs the position;
 * the engine derives the count, the mega spend and the Beat Up party from it, as it does in a real
 * battle.
 *
 * WHERE THE CORPSES COME FROM. `board.faint()` writes two things: the fainted flag on the body still
 * standing in its slot, and the species into `board.graveyard[side]`. A body that has already been
 * replaced is ONLY in the graveyard -- which is the ordinary mid-game case and the one `buildSide`'s
 * own `if (m.fainted) continue` could never have seen, because `sideTeam` never yielded it at all.
 * The slot copy is preferred where it exists: it is the richest record the board has of that body
 * (its real forme, so a mega that died still spends the side's mega), and the graveyard's
 * base-species entry for the same Pokemon is then skipped rather than duplicated.
 *
 * A synthesised corpse goes through the SAME `dmgMon` every other body goes through, exactly as a
 * benched species does -- one builder, so a corpse and a live body cannot disagree about what a
 * Pokemon is. */
function sideFallen(board, side) {
  const out = [];
  const seen = new Set();
  /* ONE BODY, ONE ENTRY. `sideTeam` carries the same guard for the living pass and for the same
   * reason: both letters can hold the SAME tracked object, and a roster that counted it twice would
   * report one death as two -- an OVERcount, which is the identical class of error in the opposite
   * direction and would look exactly like the fix working. */
  for (const L of ['a', 'b']) {
    const m = board.slot(side, L);
    if (!m || !m.fainted || out.includes(m)) continue;
    out.push(m); seen.add(B.baseSpecies(m.species));
  }
  const gy = (board.graveyard && board.graveyard[side]) || null;
  const sheets = (board.sheet && board.sheet[side]) || {};
  if (gy) for (const sp of gy) {
    if (!sp || seen.has(sp)) continue;
    seen.add(sp);
    const sh = sheets[sp] || null;
    out.push({ species: sp, hp: 0, fainted: true, status: '', boosts: {},
               /* ONE BUILDER, ONE SHAPE (ROADMAP #271). A corpse holds nothing that changes an
                * outcome — it cannot click and `battleResult` sums its 0 — but a synthesised body
                * that answers "what is it holding" differently from the living one is exactly how the
                * two come to disagree later. Same call as `sideTeam`'s, for that reason alone. */
               item: (() => {
                 const obs = (typeof board.sheetItem === 'function') ? board.sheetItem(side, sp) : null;
                 if (obs != null) return obs;
                 return sh ? (sh.item || '') : undefined;
               })(),
               nature: sh ? (sh.nature || '') : undefined,
               /* ONE BUILDER, ONE SHAPE (ROADMAP #248). A corpse cannot click anything, so its
                * moveset changes no outcome — but a synthesised body that differs from the living
                * one in what it declares is exactly how the two come to disagree later. */
               moves: sh && Array.isArray(sh.moves) ? sh.moves : undefined,
               pp: (typeof board.ppTable === 'function') ? board.ppTable(side, sp) : undefined });
  }
  return out;
}

/* A tracked Pokemon -> a MEDICHAM body. Nulls are DROPPED and COUNTED, not substituted: dmgMon
 * returns null for an in-battle forme with no usage row (Aegislash-Blade, Palafin-Hero), and quietly
 * replacing it with the base forme would roll out a different Pokemon than the one on the field.
 *
 * THE DROP IS STILL RIGHT FOR THE FIELD AND THE BENCH, AND ONLY FOR THEM. A corpse in `actA` would
 * put a dead body on the field and make the engine issue its replacement a turn late; a corpse in the
 * bench TAIL is inert, because every bench reader in `medicham2-browser.js` goes through `_live`
 * (`bringIn`, `switchOut`, `sideWiped`, the explore draw) and `battleResult` sums `max(0,curHP)/hp`,
 * which is 0 for a corpse. So the living pass below is byte-for-byte what it was, and the corpses are
 * APPENDED -- which is what puts them in `sfA.team` without moving a single living body's index. */
/* HOW LONG THIS BODY HAS BEEN STANDING THERE, AND WHAT IT WALKED IN ON.
 *
 * Two facts that `dmgMon` does not carry and MUST NOT — ROADMAP #250 and #247.
 *
 *   `_mvActs`       Showdown's `activeMoveActions`. `firstTurnOnlyRefused` is the only reader, so
 *                   with it at 0 EVERY seeded body could Fake Out, First Impression and Mat Block,
 *                   six turns into the game, on both sides. 16,871 corpus uses.
 *   `_fallenStuck`  Supreme Overlord's ENTRY snapshot. #243 records why it cannot be `sf.fainted`:
 *                   the ability reads the count once in `onStart` and freezes it, so an ally dying
 *                   while Kingambit stands there is worth nothing, and even the correct t=0 count
 *                   ROADMAP #246 landed is the wrong number for this body.
 *
 * *** THEY ARE SEEDED HERE AND NOT IN `dmgMon`, AND THAT IS LOAD-BEARING. ***
 * `dmgMon` is board.js's own builder and every damage FEATURE goes through it — `incomingThreat`,
 * `clickFragility`, `bestMoveVs`. `_fallenStuck` multiplies base power inside `dmgRange` and
 * `_mvActs` is read by `bestMoveVs`, so putting either one there would move fitted feature values
 * and silently invalidate `data/policy-weights.json`. This is a fact inside the PLAYOUT; it belongs
 * to the seed. Both fall back to 0 — today's behaviour — on a Board built before they existed. */
function seedHistory(b, m) {
  if (!b || !m) return;
  b._mvActs = m.moveActs | 0;
  b._fallenStuck = m.enteredWithFallen | 0;
}

/* HOW FAR THROUGH ITS STATUS THIS BODY IS — ROADMAP #267.
 *
 * The seed carried `status` onto every body and NOTHING about how far through it the body was, so a
 * body two turns into a one-or-two-turn sleep got a fresh one in every playout and a `tox` at stage
 * five chipped at stage one. The engine already models the split correctly — medicham2's own note
 * walks the format's condition table and records that `par/brn/psn/frz/slp` have no switch handler so
 * their counters CARRY OVER, while `tox.onSwitchIn` sets the stage to 0 so the ramp RESTARTS — so
 * this seeds the counter and the engine keeps deciding what happens to it.
 *
 * THE THREE FIELDS ARE THE ENGINE'S OWN and there is no fourth: `par` and `brn` have no counter
 * because nothing about them changes with time. Seeding `toxTurns` on a BENCHED body is deliberately
 * still done — the engine zeroes it on entry itself and counts `toxStageResetOnEntry` when it does,
 * so writing the truth here keeps one source and lets the engine apply its own rule.
 *
 * OFF BY AT MOST ONE, AND THE DIRECTION IS STATED: `board.endTurn` books a turn under the status at
 * the end of the turn, and the engine increments `slpTurns` as the body tries to act — so a body that
 * was slept AFTER it had already moved reads one turn light. It errs by keeping the body asleep
 * marginally longer, which is the direction the seed already erred in, and only for one turn. */
const STATUS_CLOCK_FIELD = { slp: 'slpTurns', tox: 'toxTurns', frz: 'frzTurns' };
function seedStatusClock(b, board, side, species) {
  if (!b || !board || typeof board.statusTurns !== 'function') return;
  const f = STATUS_CLOCK_FIELD[B.norm(b.status || '')];
  if (!f) return;
  const t = board.statusTurns(side, species) | 0;
  if (t > 0) b[f] = t;
}

/* THE DURABLE VOLATILES — ROADMAP #269.
 *
 * `magnemite.js` writes `board.startVolatile` from every `|-start|` WITH a duration, so the live
 * board holds an answer the seed threw away: an Encore with one turn left looked identical to a fresh
 * one, and a Taunted body walked into every playout free to click its status move.
 *
 * *** THE VOCABULARY CHECK CAME FIRST, AND IT FOUND A REAL MISMATCH. ***
 * The row warned that `_vol`'s keys come from a TAG PARAM while the board's come from the protocol's
 * own name, and that a key that does not match seeds a volatile NOTHING READS — silently, which is
 * the terrain-dialect defect MILTANK.md §3.7 records one layer down. It is not hypothetical:
 * `medicham2-browser.js:10160` states outright that **`_vol.healblock` is read by nothing** and the
 * consumer is `_healBlock`. Writing the board's key straight into `_vol` would have produced exactly
 * the green-looking no-op that comment describes.
 *
 * SO THE SEEDED SET IS THE ENGINE'S OWN TABLE, REBUILT BY THE SAME EXPRESSION. `durationVolatiles()`
 * is the `sealsMoves` + `statusInflict` join; this is that join. Nothing is named here, the two
 * vocabularies cannot come apart, and a volatile a future regulation adds to the family is carried
 * with no edit. Everything the board can hold OUTSIDE that set is declared below with the field it
 * would need, rather than written into `_vol` and forgotten.
 *
 * ENCORE AND DISABLE NEED THE MOVE, NOT ONLY THE COUNT. `medicham2` reads `_encoreMove` and
 * `_sealed`, and a volatile whose count is set and whose move is not is recorded and then ignored —
 * the shape that made Encore LOOK modelled for a whole session. The board records the move it sealed
 * at `startVolatile` from the body's own last click, so there is nothing to invent here.
 *
 * ACTIVE BODIES ONLY, AND THAT IS THE RULE RATHER THAN A LIMIT: Showdown clears volatiles on
 * switch-out, so a body arriving from the bench genuinely carries none. */
let _volSeed = null;
function seedableVolatiles() {
  if (_volSeed) return _volSeed;
  _volSeed = new Map();
  for (const id of (TAGSMOD.withTag('move', 'sealsMoves') || [])) {
    const sm = TAGSMOD.param('move', id, 'sealsMoves');
    const si = TAGSMOD.param('move', id, 'statusInflict');
    if (!sm || !(+sm.turns > 0) || !si || !Array.isArray(si.effects)) continue;
    for (const e of si.effects) if (e.volatile) _volSeed.set(e.volatile, +sm.turns);
  }
  return _volSeed;
}
/* WHAT IS DELIBERATELY NOT CARRIED, AND WHY — printed by the gate on every run, because a silent
 * omission and a considered one look identical in the code. */
function unseededVolatiles() {
  return [
    ['substitute', 'the consumer is `_sub`, which is the substitute\'s REMAINING hp. The protocol ' +
      'never states it, so any number here would be invented rather than read'],
    ['leechseed', 'the consumer is `_seededBy`, a reference to the BODY that drains — not a count. ' +
      'AND THE BOARD CANNOT HOLD IT EITHER: Leech Seed declares no `condition.duration`, so ' +
      '`magnemite.volatileDuration` falls back to 3 and the board forgets a seed that the real game ' +
      'keeps until the body leaves. Seeding it would carry that expiry into the playout'],
    ['perishsong', 'the consumer is `_perish` and the two counters are OFF BY ONE: the wire\'s ' +
      '`perish3` is stored as three board turns, while the engine holds `_perish = 4` at that ' +
      'instant and kills at the end of the turn it reaches 0 — so the board reads ZERO on the very ' +
      'turn the body dies. Seeding it would end the count a turn early, or drop the lethal turn ' +
      'entirely; the fix is in the live adapter, which is not SEARCH\'s. The engine also clears it ' +
      'on switch-out (`perishClearedOnSwitch`), so a bench seed would put that rule in two places'],
  ];
}
/* AND THE TWO THAT ARE PURE VOCABULARY, NOW CARRIED — ROADMAP #277.
 *
 * Both were on the refusal list for one reason: the board's key is the PROTOCOL's word and the engine
 * keeps the effect somewhere other than `_vol`. That is a translation, not a missing quantity — the
 * count itself is on the board and is the same count the engine ticks (`medicham2-browser.js:20854`
 * and `:20859`, beside the `_vol` tick at `:20937`, all three `if (x > 0) x--`).
 *
 *   healblock   -> `_healBlock`   `_vol.healblock` IS READ BY NOTHING (medicham2-browser.js:10160),
 *                                 which is the mismatch #269's vocabulary check was built to catch.
 *                                 `healBlocked` (:3659) asks `_healBlock > 0` and nothing else does.
 *   throatchop  -> `_noSound`     read at :8113 and :13800 to refuse a sound move.
 *
 * IT IS A DECLARED JOIN, exactly like `VOL_MOVE_FIELD`, and for the same reason: no data field states
 * which engine field a protocol volatile lands in, so the pairing is written down ONCE where the gate
 * can check both halves still exist rather than as two `if` branches inside the loop.
 *
 * A CONVENTION DIFFERENCE IS DECLARED RATHER THAN COMPENSATED. The engine applies these two as
 * `turns + 1` because its residual fires on the application turn too, while `_vol`'s duration family
 * is applied as `turns` flat. This seeds the BOARD's remaining count for all of them, which is what
 * Showdown's own duration means at a turn boundary — so where the two conventions differ this errs
 * SHORT by one turn, the same direction #270 chose for an unknown weather rock. Writing a `+1` here
 * would put a second opinion about the engine's tick inside the seed. */
const VOL_ENGINE_FIELD = { healblock: '_healBlock', throatchop: '_noSound' };
/* THE ONE THING IN THIS BLOCK THAT CANNOT BE DERIVED, DECLARED RATHER THAN HIDDEN.
 *
 * Both Encore and Disable seal a move and both carry a duration, and the engine keeps the two in
 * DIFFERENT fields because they are opposite constraints: `_encoreMove` is the move the body must
 * use, `_sealed` is the move it may not. No data field in the format or the tag artifact states that
 * difference — `sealsMoves` carries turns and scope and nothing about direction — so this is a JOIN
 * between two vocabularies and it is written down in one place, beside the derivation it completes,
 * rather than as two `if` branches inside the loop. `tests/test-seed-clock.js` asserts every key here
 * is in the derived table, so a name that stops existing fails loudly instead of going inert. */
const VOL_MOVE_FIELD = { encore: '_encoreMove', disable: '_sealed' };
const volCounters = { seeded: 0, translated: 0, unmapped: 0, unmappedKeys: {} };
function seedVolatiles(b, board, mon) {
  if (!b || !board || !mon || !mon.volatiles || typeof board.volLeftOn !== 'function') return;
  const table = seedableVolatiles();
  for (const key of mon.volatiles.keys()) {
    const left = board.volLeftOn(mon, key) | 0;
    if (left <= 0) continue;
    /* ROADMAP #277 — the translated pair, ABOVE the `_vol` table on purpose: writing either of these
     * into `_vol` as well would leave a second, consumer-less copy of the same effect on the body,
     * which is the duplicate the engine refuses at its own owner for Substitute and confusion. */
    if (VOL_ENGINE_FIELD[key]) { b[VOL_ENGINE_FIELD[key]] = left; volCounters.translated++; continue; }
    if (!table.has(key)) {
      volCounters.unmapped++;
      volCounters.unmappedKeys[key] = (volCounters.unmappedKeys[key] | 0) + 1;
      continue;
    }
    (b._vol = b._vol || {})[key] = left;
    volCounters.seeded++;
    const mv = B.norm(board.volMoveOn(mon, key) || '');
    if (mv && VOL_MOVE_FIELD[key]) b[VOL_MOVE_FIELD[key]] = mv;
  }
}

/* PROOF OF FIRING for the two facts #277 added to the seed, and for which SOURCE answered the
 * Protect streak. A seed that carried nothing looks exactly like a position with nothing on it,
 * which is what kept the foe's shield uncounted for as long as it was. */
const SEED_COUNTERS = { streakFromBoard: 0, streakFromCaller: 0, choiceLocked: 0 };
function buildSide(board, side, dex, stats, protectTurns) {
  const mons = [];
  for (const m of sideTeam(board, side, dex)) {
    if (m && m.fainted) { stats.fainted++; continue; }
    let b = null;
    try { b = B.dmgMon(m, MEDI, dex); } catch (e) { stats.threw++; continue; }
    if (!b) { stats.unbuildable++; continue; }
    /* PROTECT'S CONSECUTIVE-USE PENALTY SURVIVES INTO THE ROLLOUT.
     *
     * MEDICHAM models it correctly -- medicham2-browser:953 succeeds with probability (1/3)^n after n
     * consecutive uses -- but a rollout builds FRESH bodies on every sample, and a fresh body carries
     * tookProtectTurns:0. So inside the search Protect always worked, every turn, at no risk: a free
     * turn of immunity, which the search duly spammed. Will watched it do that ("WAY TOO MUCH
     * PROTECTIGN") while the engine had the correct rule the entire time.
     *
     * *** THE STREAK IS THE BOARD'S NOW, AND THE FOE HAS ONE AT LAST — ROADMAP #277. ***
     * `protectTurns` was CALLER state: a map `mag_bot.js` builds off the wire and gates `if (mine)`,
     * so the OPPONENT's consecutive Protects were never counted anywhere and the search priced the
     * foe's shield as certain on every turn of every game. It was also absent from the fitter's board
     * and from every offline harness, because only the live bot kept it. `board.noteMove` already
     * reads `move.stallingMove` and is called on every `|move|` line from BOTH sides, so the counter
     * lives there and this reads it — one implementation, both sides, both worlds.
     *
     * THE MAP REMAINS AS A FALLBACK AND IS COUNTED. It is used only for a body the board has never
     * seen move (`protectStreak` absent), which is exactly the pre-existing behaviour; a body the
     * board HAS seen move takes the board's answer even when that answer is zero, because the map is
     * keyed by SPECIES and never resets on a switch-out while the streak does. */
    const streak = m && m.protectStreak;
    if (streak !== undefined) { if (streak) b.tookProtectTurns = streak | 0; SEED_COUNTERS.streakFromBoard++; }
    else {
      const pt = protectTurns && m && protectTurns[m.species];
      if (pt) { b.tookProtectTurns = pt; SEED_COUNTERS.streakFromCaller++; }
    }
    /* THE CHOICE LOCK — ROADMAP #277. `board.choiceLockOn` is the expression that used to live inside
     * `candidates()` and nowhere else, so the FIT knew a scarfed body had one legal move and the
     * PLAYOUT did not: `_lock`/`_lockT` were never written, so every locked body in every rollout was
     * offered all four of its moves and the search planned turns the game refuses.
     *
     * `_lockT === Infinity` is the engine's own discriminator between the item lock and Encore's
     * (`lockMenuMove`, medicham2-browser.js:8150), which is why the pair is written together. The
     * engine RE-READS the item before honouring it and drops a lock whose item has gone, so a
     * disagreement between the board and the body fails safe rather than silently constraining. */
    const lock = (typeof B.choiceLockOn === 'function') ? B.choiceLockOn(m, dex) : null;
    if (lock) { b._lock = lock; b._lockT = Infinity; SEED_COUNTERS.choiceLocked++; }
    seedHistory(b, m);
    /* ROADMAP #267 and #269, seeded HERE and not in `dmgMon`, for the reason `seedHistory`'s own note
     * gives: `dmgMon` is board.js's builder and every damage FEATURE goes through it, so a fact
     * written there moves fitted feature values. These are facts inside the PLAYOUT. */
    seedStatusClock(b, board, side, m.species);
    seedVolatiles(b, board, m);
    mons.push(b);
  }
  /* THE ROSTER TAIL. `dmgMon` carries `hp` across and leaves `fainted` alone -- it has never been
   * asked for a dead body before -- so the flag is stamped here, from the board, and `curHP` is
   * pinned to 0 beside it. Both, not one: `_live` tests both and `fallenCount` tests only `fainted`,
   * so a body with one and not the other is dead to half the engine and alive to the other half. */
  for (const m of sideFallen(board, side)) {
    let b = null;
    try { b = B.dmgMon(m, MEDI, dex); } catch (e) { stats.corpseThrew = (stats.corpseThrew || 0) + 1; continue; }
    /* COUNTED, because an unbuildable corpse is an UNDERCOUNT of the fallen and therefore a Last
     * Respects that is a step light -- the same silent shortfall this whole row exists to close,
     * arriving through the one door the fix leaves open. */
    if (!b) { stats.corpseUnbuildable = (stats.corpseUnbuildable || 0) + 1; continue; }
    b.fainted = true; b.curHP = 0;
    stats.corpses = (stats.corpses || 0) + 1;
    mons.push(b);
  }
  return mons;
}

/* How many of an array can still act. The seed now hands `battleInit` an array that deliberately
 * contains bodies that cannot, so "is there a side here at all" stopped being `arr.length` -- and a
 * leaf that answered 0% for a wiped side instead of `null` would be a silent contract change for
 * every caller that treats null as "do not score this". */
const liveCount = arr => arr.filter(x => x && !x.fainted && x.curHP > 0).length;

/* *** THE GUARD FOR #244 HAS TO STAND WHERE THE TRUTH IS VISIBLE — ROADMAP #245. ***
 *
 * `medicham2-browser.js`'s `fallenCount` carries the right principle and the wrong scope. Its own
 * comment: *"the one case where the roster is absent is COUNTED rather than falling silently back to
 * the arrays that caused this, because a quiet fallback here is indistinguishable from the bug."*
 * `MEDFAILS.fallenNoRoster` therefore increments only when `sf.team` is MISSING OR EMPTY. The #244
 * roster was PRESENT, NON-EMPTY and pre-filtered, so the counter stayed at zero while the function
 * returned a confident 0 — a capability counter reporting success while the capability is absent,
 * which is this project's named failure mode arriving through the door its own guard was built to
 * close. `tests/test-rollout-fallen.js` has asserted that zero since R13 and labelled it "not a pass".
 *
 * *** IT IS NOT ANOTHER COUNTER IN THE SAME PLACE, BECAUSE THE INFORMATION IS NOT IN THAT PLACE. ***
 * `fallenCount(sf, act, bench)` sees three arrays and nothing else. Nothing it can compute
 * distinguishes "this side has lost nobody" from "somebody pruned the corpses before I was called" —
 * so no counter written inside it can ever fire on #244, and adding one would be the same guard a
 * second time. The check has to run where BOTH the seeded roster and the real position are in scope,
 * and that is this seam.
 *
 * *** THE COMPARATOR IS A RECORD NOTHING ON THE SEEDING PATH CAN PRUNE. ***
 * `board.graveyard[side]` is written by `board.faint()` and is read by `sideFallen` to build the
 * corpses — but it is not the array `buildSide` returns, not the array `battleInit` slices, and not
 * `sf.team`. Every filter #244 was about operates on the ARRAY. So the guard asks the engine what it
 * will actually count — `S.sfA.fainted`, settled by `fallenSettle` at `battleInit` (#246), which is
 * the field Last Respects and Supreme Overlord read — and compares it against the board's own death
 * record. A pre-filtered roster, an unbuildable corpse, a `bringIn` splice that loses one, or a
 * future caller that "tidies" the array all land as a MISMATCH rather than as a confident zero.
 *
 * *** AND IT SPEAKS ONCE, RATHER THAN ONLY COUNTING. *** A counter nobody reads is what the row is
 * about. The counters exist so a gate can assert them (`checked > 0` is the proof-of-firing, `mismatch
 * === 0` is the claim), and the first disagreement also prints — once per process, the same shape
 * `magnemite.js`'s semantics warning uses, because a line per rollout in a 200,000-game run is a line
 * nobody reads. */
const FALLEN_GUARD = { checked: 0, agreed: 0, mismatch: 0, noRecord: 0, first: null, warned: false };
function fallenTruth(board, side) {
  if (!board || !board.graveyard || !board.graveyard[side]) return null;
  return board.graveyard[side].size;
}
function checkFallenSeeded(S, board, side, foe) {
  if (!S || !board) return;
  for (const [sf, sd] of [[S.sfA, side], [S.sfB, foe]]) {
    const truth = fallenTruth(board, sd);
    if (truth == null) { FALLEN_GUARD.noRecord++; continue; }
    FALLEN_GUARD.checked++;
    const got = sf ? (sf.fainted | 0) : -1;
    if (got === truth) { FALLEN_GUARD.agreed++; continue; }
    FALLEN_GUARD.mismatch++;
    const msg = `the seeded position says ${got} of ${sd} have fallen; the board's own death record says ${truth}`;
    if (!FALLEN_GUARD.first) FALLEN_GUARD.first = msg;
    if (!FALLEN_GUARD.warned) {
      FALLEN_GUARD.warned = true;
      console.error(`\nROLLOUT SEED — THE DEAD DID NOT REACH THE PLAYOUT (ROADMAP #244/#245)\n  ${msg}\n`);
    }
  }
}

/* Wilson, the same interval champions_sim.winProb uses and for the same stated reason: a rollout
 * estimate without one invites reading noise as signal. At N=20 the half-width near 0.5 is ~11
 * points, which is most of the gap this leaf is trying to close — see ROLLOUT-design 4.2. */
function wilson(wins, n) {
  if (!n) return { lo: 0, hi: 1 };
  const p = wins / n, z = 1.96, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

/* Deterministic per call, so the same board scored twice gives the same answer. A leaf that returns a
 * different number each time it is asked cannot be compared against another leaf, and the whole point
 * of R1 is a comparison. Seed is threaded in rather than read from a global. */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* THE LEAF.
 *
 * @param board  a live engine/board.js Board, or null when `opts.buildTeams` supplies the sides
 * @param side   'p1' | 'p2' — whose win probability is wanted
 * @param opts   { n, dex, seed, field, explore, foePolicy, maxTurns, protectTurns, bringIn,
 *                 seeded = true, buildTeams }
 * @returns      { p, wins, n, lo, hi, built, dropped } or null when nothing could be played.
 *               `n` is the number of playouts that ACTUALLY RAN, which is the denominator of `p`.
 *
 * `field` carries the weather/terrain/room the real board is under. Rolling out a snow board with no
 * weather would silently delete Aurora Veil, Slush Rush and every weather-scaled move — the same
 * class of one-directional error as an unmodelled click. */
/* A MEGA'S WEATHER COMES WITH THE MEGA.
 *
 * battleInit defaults to seeded:true because the actives are ALREADY on the field in the real game --
 * re-firing their entry effects would double an Intimidate that has already happened. That is right
 * for a mid-battle seed and wrong for one specific case: a stone-holder is built as its MEGA FORME,
 * so the rollout assumes the mega happened, while the weather that mega brings never fires. Measured:
 * seeded=false gives sun, seeded=true gives none.
 *
 * The result is a board that cannot exist -- Mega Charizard Y standing in clear weather, with every
 * Fire move and every Solar Beam mispriced for the whole playout. Will asked whether the search
 * knows his mega will set sun; it assumed the mega and forgot the sun.
 *
 * Applied only when the field is EMPTY, so a real weather already up is never overwritten, and only
 * from the ACTIVES, because a benched setter has not entered yet.
 *
 * THE WRITE USED TO BE DISCARDED, AND HAD BEEN SINCE IT WAS ADDED (PRIORITIES #37). Both leaves
 * called this and then assigned the caller's field over the top -- `S.field.weather = f.weather ||
 * ''` -- an UNCONDITIONAL overwrite one line later, so a mid-battle rollout of a Mega Charizard Y
 * stood in clear weather in every rollout this project ever ran. Fixed 2026-08-04 by applying the
 * caller's field FIRST and this second, so the guard above does the arbitration it was written to do.
 *
 * *** IT IS MEGA-ONLY, AND THAT GATE IS LOAD-BEARING RATHER THAN COSMETIC. ***
 * The version that was discarded had no mega check at all: it took the weather of the first ACTIVE
 * with a weather-setting ability, mega or not. Stopping the discard without adding the gate would
 * have INVENTED weather -- a Torkoal standing on a board the tracker says has no weather is a legal,
 * observed state (Drought lasts 5 turns and the game moved on), and re-setting its sun would
 * overrule the one thing that actually knows. The board is authoritative for a body that is what the
 * board says it is. A mega is the one case where it is not: dmgMon builds a stone-holder with the
 * MEGA's ability (measured -- a Charizard + Charizardite Y body carries `drought`, not `blaze`), so
 * the rollout has already assumed a mega evolution the real game has not seen, and the weather that
 * assumption implies is missing rather than absent. That is the whole and only justification, so the
 * fix is scoped to exactly it.
 *
 * ROUTED THROUGH board.js effAbility() (PRIORITIES #40b). The old code read the body's raw ability
 * field, which tests/test-effective-identity flags because that field is precisely what mega
 * evolution changes. TWO CORRECTIONS TO #40b AS FILED, both measured rather than reasoned:
 *
 *   - the raw read was NOT returning a wrong answer on this path. dmgMon already calls effAbility
 *     itself, so a Charizard + Charizardite Y body arrives here carrying `drought`, not `blaze`.
 *     #40b is a latent hazard here, not a live defect, and it goes live the moment a caller omits
 *     `dex`. The visible bug was #37 alone.
 *   - the field the gate actually needed was not the ability at all. It is `mega`, and effective()
 *     is the one resolver that states it. Nothing else in the old code distinguished a Torkoal from
 *     a Charizard-Mega-Y.
 *
 * THE BODY'S OWN ABILITY IS NOT PASSED IN, DELIBERATELY. effective() only falls back to it when the
 * forme is NOT a mega -- and a non-mega is skipped one line later -- so passing it would be a raw
 * read whose value is discarded on every path that reaches the lookup. Identity in, resolved answer
 * out; the file now holds zero raw reads of a transforming field, against a baseline of zero.
 *
 * Degrades to today's behaviour with no dex: effective() cannot resolve a forme without one, returns
 * mega:false, and nothing is applied.
 *
 * On the FRESH (unseeded) preview path battleInit runs the entry effects for real, so this stays a
 * no-op there rather than a fix -- the guard sees the weather Drought already set. */
function applyMegaWeather(S, dex) {
  if (!S || !S.field || S.field.weather) return;
  for (const m of (S.actA || []).concat(S.actB || [])) {
    if (!m) continue;
    /* The BODY is the subject: `name` is its MC key, and the stone is what makes it a mega. */
    const id = { species: m.name, item: m.item };
    if (!B.effective(id, dex).mega) continue;
    /* The second call runs only for a mega, which is rare enough that one resolver used twice is
     * cheaper than the bug of caching a half-resolved identity. */
    const p2 = TAGSMOD.param('ability', B.effAbility(id, dex), 'weatherSetter');
    /* `weatherId` for the same reason every other setter uses it: the param happens to carry the
     * engine word today, and a tag that ever spelled it `sunnyday` would write a word no damage
     * formula reads, silently. `weatherTurns` is the rock — this branch wrote a literal 5 while the
     * MOVE branch read Heat Rock, so Charizard-Y mega-ing in gave five turns of sun and clicking
     * Sunny Day gave eight. */
    const w = MEDI.weatherId((p2 && p2.weather) || '');
    if (w) { S.field.weather = w; S.field.weatherT = MEDI.weatherTurns(w, m.item, TAGSMOD); return; }
  }
}

/* THE PLAYOUT'S OPPONENT: a coin flip, or a person.
 *
 * explore=1.0 makes every mon click a UNIFORMLY RANDOM legal move. That was adopted for a real
 * reason -- a deterministic greedy playout replays one line, the samples stop being independent, and
 * accuracy goes flat in N (R1: random judges 68.18% against greedy's 64.42%). The MCTS literature
 * says the same: strong playout policies often make a search WORSE.
 *
 * But that is an argument about VARIANCE and it has been carrying an argument about REALISM it
 * cannot support. Will put it plainly: "reality cannot be that close to a 1/4 split for all moves".
 * He is right, and the corpus is emphatic -- Charizard clicks Protect 60.6% and Heat Wave 21.5%,
 * nothing like the 25% each a uniform draw assumes.
 *
 * data/move-priors.json is P(move | this species clicked something), measured from real ladder play,
 * and it is what engine/prior_player.js already samples for self-play. Sampling it keeps the variance
 * that made random playouts work AND gives an opponent who behaves like a person. Which is better is
 * an empirical question, so it is a PARAMETER and R4 decides it. */
let _mp = null;
function movePriorFor(name) {
  if (_mp === null) {
    _mp = {};
    try {
      const j = JSON.parse(require('fs').readFileSync(D('data', 'move-priors.json'), 'utf8'));
      for (const [sp, v] of Object.entries(j.species || {})) {
        const rows = (v.moves || []).filter(m => m && m.mv && m.p > 0);
        if (rows.length) _mp[String(sp).toLowerCase().replace(/[^a-z0-9-]/g, '')] = rows;
      }
    } catch (e) {
      /* absent: callers fall back to uniform, which is the old behaviour — but silently reverting
       * an entire capability (a renamed file would do it) is the CLAUDE.md failure shape, so the
       * downgrade is announced once per process */
      console.error('rollout_leaf: move-priors.json unavailable (' + ((e && e.message) || e) + ') — playout move choice falls back to UNIFORM');
    }
  }
  return _mp[String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '')] || null;
}

/* ---------------------------------------------------------------------------------------------
 * WHAT THE STORE SAYS, READ RATHER THAN REMEMBERED (ROADMAP #152/#153).
 *
 * Two numbers below are FACTS ABOUT THE GAME, not settings: how often a real player's chosen action
 * is "leave", and how long a real game has left to run from a position. Both are measured by
 * `engine/rollout_switch_census.js` off the RAW replay logs of both human stores and written to
 * `data/rollout-switch-census.json`. They are read from that artifact and never typed here, for the
 * reason CLAUDE.md gives about the ban list of four: a hand-carried number goes stale without anybody
 * noticing, and a second copy of a fact is how two files come to disagree.
 *
 * The artifact is upstream of MEDICHAM and is NOT quarantined — nothing in it passes through the
 * simulator, board.js, the weights or any leaf.
 *
 * THE FALLBACK IS ANNOUNCED, NOT SILENT. If the artifact is missing the switch rate falls to 0,
 * which is exactly the defect this closes, so it says so once per process rather than quietly
 * reverting a capability — the CLAUDE.md failure shape, and the same treatment move-priors.json gets
 * forty lines up. */
let _census = null;
function census() {
  if (_census === null) {
    try {
      const j = JSON.parse(require('fs').readFileSync(D('data', 'rollout-switch-census.json'), 'utf8'));
      /* THE CONDITIONAL RATE, not the marginal one. The draw below only happens when a live body is
       * on the bench, so the denominator has to match: `pct_decisions_that_are_a_voluntary_switch`
       * counts every decision including the ones made with an empty bench, and using it made the
       * playout switch at 3.9% while claiming 7.7%. */
      const p = j && j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
      const cap = j && j.derived_cap && j.derived_cap.max_turns;
      _census = {
        switchRate: (typeof p === 'number' && p > 0) ? p / 100 : 0,
        maxTurns: (typeof cap === 'number' && cap > 0) ? cap : 0,
        generated: (j && j.generated) || null,
        ok: true,
      };
    } catch (e) {
      console.error('rollout_leaf: data/rollout-switch-census.json unavailable (' + ((e && e.message) || e) +
        ') — THE PLAYOUT CANNOT SWITCH and the horizon falls back to the caller\'s. Run: node engine/rollout_switch_census.js');
      _census = { switchRate: 0, maxTurns: 0, generated: null, ok: false };
    }
  }
  return _census;
}

/* THE COUNTERS THAT PROVE THE SWITCH PATH RAN.
 *
 * "A capability that cannot prove it ran is assumed broken." `offered` is what this file decided to
 * click; `executed` is what MEDICHAM actually did with it, checked by looking at the FIELD after the
 * turn rather than by trusting the action object — a refused action and a working one are the same
 * object, so only the board can tell them apart.
 *
 * `refused` IS NOT A BUG COUNTER, and reading it as one was the first mistake made with it. Three
 * mechanics legitimately overrule a handed-in switch, all of them ENGINE's and all of them right:
 *
 *   - a MULTI-TURN LOCK (`_mtLock`: Outrage, Petal Dance, Thrash, Raging Fury, Uproar).
 *     `Pokemon#getMoveRequestData` sets `trapped = true` for these, so the real client does not offer
 *     the switch at all; medicham2 rewrites the action to the locked move. The body still acts.
 *   - a CHARGE turn (`_charging`: Solar Beam, Fly, Dig). The release turn is not a decision.
 *   - a TRAP (Arena Trap, Shadow Tag, Block, Mean Look, a partial trap). This one COSTS THE TURN —
 *     the engine `continue`s — exactly as it costs a real player who clicked switch into a trap.
 *
 * Only the third is a wasted turn, and it is the engine's own counters (`MEDSEEN.trapBlockedSwitch`,
 * `moveTrapBlockedSwitch`, `trapBlockedSwitchByMove`) that name it, so `engine/rollout_switch_probe.js`
 * reads those rather than this file inventing a fourth opinion about what a trap is. */
/* `decisions` is the DENOMINATOR, and it exists because the first version of this probe reported a
 * realised switch rate of 3.5% against the store's 7.7% and the gap was entirely in the denominator,
 * not in the draw. `decisions` counts every body that reached the draw; `benchAvailable` counts the
 * subset that had somewhere to go. The store's 7.677% is over ALL chosen actions, so `offered /
 * decisions` is the number that compares to it — and a playout spends much of its length at an empty
 * bench, which a real game also does. Guessing the denominator is how a rate comes to be wrong by a
 * factor of two while every line of the draw is correct. */
const SWITCH_COUNTERS = { decisions: 0, benchAvailable: 0, offered: 0, executed: 0, refused: 0,
                          noBench: 0, drainedIntoSwitch: 0 };

/* Pick from the mon's OWN moveset, weighted by how often that species really clicks each one.
 * Moves it is not carrying are skipped rather than renormalised away silently. */
/* `usable` is the SELECTABLE subset, supplied by the caller (ROADMAP #145). Defaulting to
 * `mon.moves` keeps every existing caller identical; passing the filtered list is what stops the
 * priors sampler putting an empty slot back after the uniform draw already filtered it out — the
 * exact leak WIRE 26 found on Disable, one layer up. */
function pickByPrior(mon, rng, usable) {
  const rows = movePriorFor(mon && mon.name);
  const have = usable || (mon && mon.moves) || [];
  if (!rows || !have.length) return null;
  const cand = [];
  let tot = 0;
  for (const id of have) {
    const r = rows.find(x => x.mv === id);
    const w = r ? r.p : 0.02;            // carried but never observed: rare, not impossible
    cand.push([id, w]); tot += w;
  }
  if (!tot) return null;
  let x = rng() * tot;
  for (const [id, w] of cand) { x -= w; if (x <= 0) return id; }
  return cand[cand.length - 1][0];
}

/* THE PLAYOUT. ONE implementation, and there must only ever be one.
 *
 * FACTS ARE GLOBAL. "How a rollout is played" is a fact about the leaf, not a private detail of
 * whoever happens to be asking. It was written out THREE times: twice in this file, and a third time
 * inside miltank.js's team-preview loop, which called battleInit/battleTurn directly and never
 * reached this file at all. That third copy ran DETERMINISTIC GREEDY on both sides while the shipped
 * leaf runs explore=1.0 -- so MILTANK shipped two different players, and only one of them was ever
 * swept. The measured 53.22%-preview against 50.99%-in-game contrast was therefore partly a contrast
 * between two IMPLEMENTATIONS rather than between two settings of one. docs/SEARCH.md open item 0.
 *
 * `explore` and `foePolicy` are the parameters, so greedy is still reachable -- it is explore=0, the
 * arm the sweep already includes. What is no longer reachable is a SECOND policy nobody swept.
 *
 * @param counters  optional { threw, first } — an explore action the engine cannot represent is
 *                  counted rather than swallowed, because swallowing it quietly lowers the effective
 *                  exploration rate and makes explore=1 behave like something smaller, which is the
 *                  variable under test.
 */
/* SWITCHING IS IN THE ACTION SET. ROADMAP #152.
 *
 * *** THE DEFECT ***  `runPlayout` only ever clicked MOVES. A voluntary switch was not in the draw at
 * all, so every position this search has ever evaluated was scored as though both players were pinned
 * to the field until somebody fainted. VGC is a switching game: measured off the raw logs of both
 * human stores (`data/rollout-switch-census.json`, 58,639 finished games), **7.7% of all chosen
 * actions are a voluntary switch and 71.2% of games contain at least one** — 83.0% on the bo3
 * open-sheet ladder, which is the population MILTANK actually plays. The rollout had that at exactly
 * zero. It could not represent a pivot out of a bad matchup, could not represent the sack, and could
 * not represent the most common real answer to a threat, which is leaving.
 *
 * The PP work makes it sharper rather than softer: `board.js` depletes PP now, so a long no-switch
 * playout is a game where four moves grind down to Struggle with nobody ever pivoting.
 *
 * *** THE ENGINE WAS NEVER THE PROBLEM ***  `medicham2-browser.js:10464` has executed `{kind:'switch',
 * to}` for as long as `rolloutAfterActions` has been able to force one as a top-level CANDIDATE, with
 * the trap gates, the Regenerator heal, the boost/volatile clearing and the priority-6 bracket all
 * modelled. Nothing new is asked of ENGINE here. The action simply was not being generated.
 *
 * *** HOW IT IS PRICED, AND WHY ***  The brief is "priced by whatever policy the rollout already uses
 * rather than a new hand-tuned heuristic", and the honest reading of that took a decision, so it is
 * stated rather than implied.
 *
 * The playout's policy is `explore`: with probability `explore` a body clicks a uniformly random
 * legal MOVE (or, under `foePolicy:'prior'`, a move drawn from `data/move-priors.json`). There are
 * two defensible extensions and they disagree by a factor of four:
 *
 *   (a) UNIFORM OVER LEGAL ACTIONS — fold the live bench into the same uniform draw. Four moves and
 *       two available bodies makes a switch 2/6 = 33% of actions. It is the smaller code change and
 *       it is what Showdown's own RandomPlayerAI does. It also puts the playout's switch rate 4.3x
 *       ABOVE the measured human rate, in a policy where a switch always costs the turn.
 *   (b) THE MEASURED RATE — a switch is drawn with the probability the store says a real chosen
 *       action is a switch, and the move draw is untouched underneath it.
 *
 * **(b) is the default, and the number is READ FROM THE STORE ARTIFACT, not tuned.** The reason is
 * that the uniform move draw is already only ~2.5x off reality per move (Charizard clicks Protect
 * 60.6% against a uniform 25%), while (a) would be 4.3x off on the one action class that is
 * unconditionally turn-consuming — and it would be off in the direction that makes every playout
 * longer and less lethal, which is the direction the horizon defect already errs in. Nothing here is
 * a claim that (b) judges better; that is an A/B and it is an SPRT arm, which is exactly why
 * `switchRate` is a PARAMETER and (a) is reachable as `switchRate:'uniform'`.
 *
 * **`switchRate: 0` reproduces the old playout EXACTLY, dice included** — the rng is short-circuited
 * before it is drawn, so the control arm is byte-identical rather than merely similar. That is
 * deliberate: it is the only way the before/after comparison means anything.
 *
 * *** WHAT IS DELIBERATELY NOT DONE ***
 *   - **No feature was added.** `board.js` FEATURES is untouched and `data/policy-weights.json` keeps
 *     its fitted dimensionality. Nothing MAG scores reads any of this.
 *   - **WHICH body comes in is uniform over the live bench**, and that is a known weakness stated
 *     rather than hidden: `move-priors.json` is P(move | species), so there is no measured prior over
 *     switch TARGETS to sample and inventing one would be the hand-tuned heuristic the brief rules
 *     out. §4's note about the opponent's bring being uniform is the same gap one level up.
 *   - **At `explore = 0` the playout still cannot switch.** That path is `chooseAction`, which lives
 *     in `medicham2-browser.js` and returns no `kind:'switch'` anywhere — ENGINE's file, filed not
 *     fixed. The shipped setting is explore=1.0, so the shipped playout is fully covered.
 *   - **A body that cannot leave is offered the switch anyway and the engine overrules it.** That is
 *     not the empty-slot leak wearing a new hat. Two of the three overrules (a multi-turn lock, a
 *     charge turn) substitute the correct action and cost nothing; only a TRAP costs the turn, and
 *     the refusal is the correct mechanic in every case. Re-deriving "can this body leave" here would
 *     be a second implementation of a fact, which CLAUDE.md names by name — so it is MEASURED
 *     instead. `SWITCH_COUNTERS.refused` is the total and the engine's own trap counters decompose
 *     it. If the trap share is ever material the ask is one export from ENGINE, not a copy here.
 */
function runPlayout(S, rng, explore, foePolicy, counters, switchRate) {
  /* Absent -> the measured rate. Explicit 0 -> the old, switchless playout, dice-identical. */
  const SWR = (switchRate === undefined || switchRate === null) ? census().switchRate : switchRate;
  const SW_UNIFORM = SWR === 'uniform';
  const SWP = SW_UNIFORM ? 1 : (typeof SWR === 'number' ? SWR : 0);
  while (!MEDI.battleOver(S)) {
    let fa = null, fb = null;
    /* WITHIN ONE TURN, TWO SLOTS ON A SIDE MAY NOT CLAIM THE SAME BODY. `bringIn` falls back to
     * `_live(bench)[0]` when the body it was asked for is no longer on the bench, so the second slot
     * would silently bring in whoever happened to be first — a decision nobody made, wearing the
     * shape of one. One set for the turn rather than one per side: the claim is on BODY IDENTITY and
     * no object is ever on two benches, so a shared set is the same rule with one fewer place to
     * forget to clear. */
    const claimed = new Set();
    /* Proof of execution, checked AFTER the turn against the field rather than inferred from the
     * action object: an action that was refused looks identical to one that worked. */
    const issued = [];
    if (explore > 0) {
      /* EXPLORE: with probability e, a mon clicks a RANDOM legal move instead of chooseAction's pick.
       *
       * This is not a way of playing better. It is the fix the MCTS literature prescribes for exactly
       * the pathology this leaf shows: chooseAction is deterministic greedy, so every playout from one
       * position replays the same line and the N samples are near-identical. That is why accuracy was
       * FLAT in N and why the estimate saturated -- 50.7% of positions landed in the 0-10% or 90-100%
       * bin at explore=0 against 29.4% at explore=1.0. "Heavy rollouts help only when they avoid
       * becoming low-variance" (An Analysis of Monte Carlo Tree Search); ours became low-variance.
       *
       * Injected HERE and not in chooseAction, deliberately: chooseAction is the Tower's policy and
       * the live bot's, and randomising it would change shipped behaviour to fix a rollout. */
      const pick = (mon, mineSide) => {
        if (!mon || mon.fainted || mon.curHP <= 0 || rng() >= explore) return null;
        /* THE EXPLORE PICK MUST NOT OFFER A SLOT THE CHOOSER WOULD REFUSE (ROADMAP #145).
         *
         * This line bypasses `chooseAction`, which is the whole point of it — but `chooseAction` is
         * also where every selection guard lives, including ENGINE's new empty-slot refusal and the
         * Struggle branch under it. So a uniformly random draw over `mon.moves` kept clicking moves
         * that were out of PP, and the engine answered `|cant|nopp` at execution: **the turn was
         * wasted rather than Struggled**. Measured on the probe board at explore=1.0, which is the
         * SHIPPED setting: 52 `|cant|nopp` lines and 0 Struggles.
         *
         * Filtering here restores the invariant, and returning null when NOTHING is selectable is
         * the other half — that hands the body back to `chooseAction`, whose `ppAllOut` branch
         * produces the real Struggle action. Deliberately routed through `PP.bodySelectable` rather
         * than testing `_pp[id] > 0` inline, so when ENGINE widens the condition past PP (Choice
         * lock plus Disable, Encore into an unusable move) this line widens with it. */
        const mvs = (mon.moves || []).filter(id => PP.bodySelectable(mon, id));
        const foesL = (mineSide ? S.actB : S.actA).filter(x => x && !x.fainted && x.curHP > 0);
        /* THE SWITCH BRANCH. Ordered before the move guard on purpose: a body with nothing
         * selectable left is precisely the one a real player leaves with, and returning null there
         * would send it to `chooseAction` to Struggle while a full bench sat behind it. */
        if (SWP > 0) {
          SWITCH_COUNTERS.decisions++;
          const bench = (mineSide ? S.benchA : S.benchB) || [];
          const outs = bench.filter(x => x && !x.fainted && x.curHP > 0 && !claimed.has(x));
          if (!outs.length) { SWITCH_COUNTERS.noBench++; }
          else {
            SWITCH_COUNTERS.benchAvailable++;
            /* (a) uniform over legal actions, or (b) the store's measured rate. In the degenerate
             * case where NO move is selectable, leaving is the only action there is, so its
             * probability is 1 under either reading rather than a third rule. */
            const p = !mvs.length ? 1
              : (SW_UNIFORM ? outs.length / (mvs.length + outs.length) : SWP);
            if (rng() < p) {
              const to = outs[Math.floor(rng() * outs.length) % outs.length];
              claimed.add(to);
              SWITCH_COUNTERS.offered++;
              if (!mvs.length) SWITCH_COUNTERS.drainedIntoSwitch++;
              if (counters) counters.switches = (counters.switches || 0) + 1;
              issued.push({ mon, side: mineSide ? 'A' : 'B', to });
              return { kind: 'switch', to };
            }
          }
        }
        if (!mvs.length || !foesL.length) return null;
        /* Weighted by what this species really clicks when foePolicy is 'prior'. */
        const mv = (foePolicy === 'prior' && pickByPrior(mon, rng, mvs)) ||
          mvs[Math.floor(rng() * mvs.length) % mvs.length];
        const tg = foesL[Math.floor(rng() * foesL.length) % foesL.length];
        try {
          return MEDI.playerAction(mon, mv, tg, S.field);
        } catch (e) {
          if (counters) {
            counters.threw++;
            if (!counters.first) counters.first = `${mon.name} ${mv}: ${e.message}`;
          }
          return null;
        }
      };
      for (const m of S.actA) { const a = pick(m, true); if (a) (fa = fa || new Map()).set(m, a); }
      for (const m of S.actB) { const a = pick(m, false); if (a) (fb = fb || new Map()).set(m, a); }
    }
    MEDI.battleTurn(S, rng, fa, fb);
    /* DID IT ACTUALLY LEAVE? Asked of the FIELD, after the turn. A body that is no longer among its
     * side's actives left; one that is still standing there had its switch refused — a trap, or a
     * faint that pre-empted it. This is the counter CLAUDE.md's "a capability that cannot prove it
     * ran is assumed broken" asks for, and it is deliberately not `offered`, because offering proves
     * only that this file made a decision. */
    for (const it of issued) {
      const acts = it.side === 'A' ? S.actA : S.actB;
      if (acts.indexOf(it.mon) < 0) SWITCH_COUNTERS.executed++;
      else {
        SWITCH_COUNTERS.refused++;
        /* NAMED, not just counted. "15 switches were refused" is not actionable and reads as a bug
         * in this file until somebody can see which body and in what state — the first refusal is
         * kept for exactly the reason `firstExploreError` is. */
        if (!SWITCH_COUNTERS.refusedFirst) {
          SWITCH_COUNTERS.refusedFirst = `${it.mon.name} hp=${it.mon.curHP} fainted=${!!it.mon.fainted}` +
            ` bench=[${(it.side === 'A' ? S.benchA : S.benchB).map(x => x && `${x.name}:${x.curHP}`).join(',')}]` +
            ` wanted=${it.to && it.to.name}`;
        }
      }
    }
  }
  return MEDI.battleResult(S);          /* 1 / 0 / 0.5, side A is the asking side by construction */
}

/* THE CALLER'S FIELD, applied over whatever battleInit left behind.
 *
 * On a SEEDED (mid-battle) seed the board is authoritative: no weather on the board means no weather
 * in the playout, so an empty value must OVERWRITE. On a FRESH seed battleInit has just run the entry
 * effects, and those are the only thing that knows a Drought lead just walked in -- so an ABSENT
 * value must NOT erase them. Assigning unconditionally, which is what both leaves used to do, is
 * exactly what would make a fresh-game seed pointless for the weather half of the question.
 *
 * Tailwind is mapped from the ASKING side's point of view; battleInit's side A is always `side`.
 *
 * *** THE TWO SIDES OF THIS ASSIGNMENT DID NOT SPEAK THE SAME LANGUAGE. FIXED 2026-08-04. ***
 * `f.weather` comes from `board.weather`, which is Showdown's `|-weather|` line normalised, so its
 * values are MOVE names: `sunnyday`, `raindance`, `sandstorm`, `snowscape`. MEDICHAM compares against
 * `sun` / `rain` / `sand` / `snow`. They had never matched, so the weather a mid-battle board reported
 * was INERT in every rollout ever run -- truthy enough to suppress a guard, meaningless to every
 * formula. Measured on the shipped engine, Charizard Flamethrower into Garchomp: `sun` 92-109,
 * `sunnyday` 61-72, `rain` 29-35, `raindance` 61-72.
 *
 * The fix is `MEDI.weatherId`, which is MEDICHAM's own `SD2WEATHER` exported rather than a second map
 * copied into this file -- FACTS ARE GLOBAL, and a second copy is how choiceLock came to have two
 * engines disagreeing. It is idempotent, so the OTHER two paths that already speak the engine's
 * vocabulary (`weatherSetter` on switch-in, a weather move played inside the playout) are unchanged,
 * and an unrecognised value resolves to no weather and is COUNTED in `MEDI.fails.weatherUnknown`
 * rather than passed through as a truthy string nothing reads.
 *
 * Parity, 250 corpus boards, both arms in one process at n=40: 130 carried a weather, 77 boards moved
 * (59.2% of the weather boards), mean |delta| 9.92 pt, max 37.5 pt, and **0 of the 120 boards with no
 * weather moved at all** -- the control that says this is the weather and not the reordering. */
/* THE BOARD'S TERRAIN, IN THE ENGINE'S VOCABULARY. ONE IMPLEMENTATION, BECAUSE THERE WERE THREE.
 *
 * ENGINE fixed medicham2 to translate terrain at every read (`terrainId`, the sibling of
 * `weatherId`) and then measured that **0 of 863 terrain-carrying corpus boards reach the leaf at
 * all** — because the two callers that BUILD the field object, `miltank.js` and `rollout_r1.js`,
 * probed `board.hasField('electric'|'grassy'|'misty'|'psychic')`. Those are the ENGINE's words.
 * `board.startField` stores the dex's `move.terrain`, which is `electricterrain`, `grassyterrain`,
 * `mistyterrain`, `psychicterrain`. So the probe was a third spelling, it matched nothing, and the
 * field object handed to every rollout carried `terrain: ''` on every board that had one.
 *
 * NO FOURTH MAP IS WRITTEN HERE. The list below is a list of BOARD KEYS to probe — the same four
 * `board.js:2543` and `position_features.js:296` already probe — and the short/long translation is
 * done by `MEDI.terrainId` and nowhere else, exactly as `applyField` does for weather.
 *
 * Why probe four named keys instead of walking `board.pseudoWeather`: Trick Room lives in the same
 * namespace, and handing `trickroom` to `terrainId` would count a bogus `MEDI.fails.terrainUnknown`
 * on nearly every board. A swallowed-failure counter that fires when nothing is wrong is a counter
 * that gets ignored. */
const BOARD_TERRAIN_KEYS = ['electricterrain', 'grassyterrain', 'mistyterrain', 'psychicterrain'];
function terrainOnBoard(board) {
  if (!board || typeof board.hasField !== 'function') return '';
  const k = BOARD_TERRAIN_KEYS.find(t => board.hasField(t));
  return k ? MEDI.terrainId(k) : '';
}

/* THE HAZARDS, THE SCREENS AND GRAVITY — ROADMAP #249.
 *
 * `applyField` translates four things (weather, terrain, Tailwind, Trick Room) and `battleInit`
 * starts `sf.hz` absent and `sf.sc` empty. So every rollout switch-in walked onto a clean field,
 * every screen the real position is under was deleted, and a search that has already had to be
 * taught not to spam Protect was being shown a cheaper switch than the game offers. Same shape as
 * the terrain defect MILTANK.md §3.7 closed — a fact the position holds that never reached the
 * engine — except here the leaf was not even being given it.
 *
 * *** WHOSE SIDE. READ, NEVER RE-DERIVED. ROADMAP #254 CLOSED THE OTHER HALF OF THIS. ***
 * Of the 11 legal side-condition moves in this regulation SEVEN are `allySide` and FOUR are
 * `foeSide` — Stealth Rock, Spikes, Sticky Web, Toxic Spikes — so a hazard lands on the side it was
 * laid AGAINST. `board.js` resolves that ONCE, in `sideFor`, at the moment the condition is
 * WRITTEN, which is why there is no call to `sideFor` here and must not be: the board's per-side
 * record is already the answer, and flipping it a second time would re-introduce #254 one layer up
 * while looking exactly like a fix. `tests/test-rollout-seed.js` asserts the placement from BOTH
 * seats precisely so a double flip fails instead of cancelling.
 *
 * NOTHING IS NAMED. The hazards come from the `hazard` tag (which also carries `maxLayers`), the
 * screens from `halvesDamage`, Safeguard from `sideBuff`, Gravity from `groundsField` — so a
 * condition added by a future regulation is picked up without editing this file, which is the rule
 * docs/TAGS.md states and the ban-list-of-four shape CLAUDE.md warns about.
 *
 * *** THREE THINGS IT CANNOT SAY, DECLARED RATHER THAN GUESSED ***
 *   - A HAZARD'S REAL LIFETIME. Stealth Rock, Spikes, Sticky Web and Toxic Spikes carry no
 *     `condition.duration` because they are permanent until removed, and `board.startSide` defaults
 *     an absent duration to ONE TURN offline (the live path's `-sidestart` gets 5). So the seed sees
 *     a hazard only while the board still believes it is up. That is a board defect, it moves the
 *     `deadSide` FEATURE and therefore the fit, and it is filed rather than fixed here.
 *   - LAYERS. The board records an expiry, not a count, so a seeded Spikes or Toxic Spikes is always
 *     ONE layer. `maxLayers` is read from the tag and clamps it, so this can only ever under-state.
 *   - QUICK GUARD / WIDE GUARD. Those live for the turn they are clicked (`field.sgA`/`sgB`) and a
 *     mid-battle seed starts at the top of a turn, so there is nothing to carry.
 */
function applySideState(S, board, side) {
  if (!S || !board || typeof board.hasSide !== 'function') return;
  const foe = side === 'p1' ? 'p2' : 'p1';
  /* battleInit's side A is always the asking side, so the pairing is fixed by construction. */
  const pairs = [[S.sfA, side], [S.sfB, foe]];

  for (const mv of (TAGSMOD.withTag('move', 'hazard') || [])) {
    const p = TAGSMOD.param('move', mv, 'hazard') || {};
    const key = p.hazard || mv;
    /* Clamped by the tag's own ceiling, never by a number typed here. */
    const ceiling = +p.maxLayers > 0 ? +p.maxLayers : 1;
    for (const [sf, sd] of pairs) {
      if (!board.hasSide(sd, key)) continue;
      /* ROADMAP #268 — THE LAYER COUNT IS READ NOW. This was `Math.min(1, ceiling)`, a constant 1,
       * because `sideConditions` held an expiry and no count: a Spikes laid three times seeded one
       * layer (1/8 of a switch-in's HP where the position says 1/4) and Toxic Spikes could never
       * reach the second layer that makes it BADLY poisoned rather than poisoned. The board counts
       * them now and clamps on the way in; the second clamp here is kept because the two ceilings
       * come from the same tag and a seed that trusted the board alone would silently pass a value
       * the engine's own table does not allow. */
      (sf.hz = sf.hz || {})[key] = Math.min(ceiling,
        typeof board.sideLayers === 'function' ? Math.max(1, board.sideLayers(sd, key)) : 1);
    }
  }

  /* A SCREEN IS KEYED BY ITS MOVE, which is what `sf.sc` holds (medicham2's screen branch writes
   * `sf.sc[a.mv]`), and the three screens' move id and `sideCondition` are the same word. Safeguard
   * is keyed by the tag's `sideCondition`, which is what the engine's sidebuff branch writes. */
  const named = [];
  for (const mv of (TAGSMOD.withTag('move', 'halvesDamage') || [])) named.push([mv, mv]);
  for (const mv of (TAGSMOD.withTag('move', 'sideBuff') || [])) {
    const p = TAGSMOD.param('move', mv, 'sideBuff') || {};
    named.push([mv, p.sideCondition || mv]);
  }
  for (const [cond, key] of named) {
    for (const [sf, sd] of pairs) {
      const left = typeof board.sideLeft === 'function' ? board.sideLeft(sd, cond) : (board.hasSide(sd, cond) ? 1 : 0);
      if (left > 0) (sf.sc = sf.sc || {})[key] = left;
    }
  }

  /* GRAVITY IS A FIELD FACT, not a side one, and it is a counter in the engine rather than a flag.
   * DECLARED: medicham2 sets `field.gravity` on the click and never ticks it down, so a seeded
   * Gravity lasts the whole playout whatever number is written here. The truthful remaining count is
   * written anyway — the day the engine expires it, this is already right. */
  for (const mv of (TAGSMOD.withTag('move', 'groundsField') || [])) {
    const p = TAGSMOD.param('move', mv, 'groundsField') || {};
    const key = p.pseudoWeather || mv;
    const left = typeof board.fieldLeft === 'function' ? board.fieldLeft(key) : (board.hasField(key) ? 1 : 0);
    if (left > 0) S.field.gravity = left;
  }
}

/* THE FIELD'S CLOCK — ROADMAP #270.
 *
 * `applyField` set `S.field.weather` and `S.field.terrain` and never the two counters beside them,
 * and the engine's tick is `if (field.weatherT > 0 && --field.weatherT <= 0)` — so **ZERO MEANS NEVER
 * EXPIRES**. A sun the real board has two turns of ran for sixty in every rollout, mispricing every
 * Fire move, every Solar Beam, every weather-scaled ability and every Aurora Veil for the whole
 * playout. The same file already did it correctly one function away: `applyMegaWeather` sets
 * `weatherT` from `MEDI.weatherTurns`, so the seed's two weather paths disagreed with each other —
 * which is the shape that produced the mega-weather defect in the first place.
 *
 * IT IS ITS OWN FUNCTION, BESIDE `applySideState`, AND NOT A NEW ARGUMENT ON `applyField`. Six
 * callers build the `field` object by hand (`miltank.js`, the four R-gates, the switch probe) and
 * every one of them would have had to grow the same two lines — six copies of one fact, which is the
 * defect this whole batch is made of. The board is already in scope at both leaves; this reads it.
 *
 * THE LENGTH IS ASKED OF THE ENGINE. `MEDI.weatherTurns(w, rock, TAGS)` is the one implementation and
 * the mega branch calls it too, so a Heat Rock, an Icy Rock or a regulation that re-lengths a weather
 * moves both paths together and neither can drift.
 *
 * *** AN EXPIRED WEATHER IS DELETED, NOT COUNTED DOWN TO ZERO, and that is not cosmetic. *** Zero is
 * the engine's word for "runs forever", so handing over a weather whose clock has run out with
 * `weatherT: 0` is the precise bug this fixes, spelled differently. The board's own `weather` field is
 * deliberately NOT expired — it feeds `deadWeather` and the weather-boost features, and expiring it
 * would move fitted values. That the board's weather never expires FOR THOSE FEATURES is a real and
 * separate defect; it is filed, not fixed here.
 *
 * AN UNKNOWN AGE IS SEEDED AT FULL LENGTH AND COUNTED. A Board that never saw the weather start
 * cannot say how old it is, and a full clock is both the closest honest answer and strictly better
 * than the infinity it replaces. */
/* *** AND THE TWO CLOCKS THE CALLER WAS TYPING AS CONSTANTS — ROADMAP #275. ***
 *
 * `miltank.js` built `twA: board.hasSide(side,'tailwind') ? 4 : 0` and `tr: hasField('trickroom') ? 5
 * : 0`, and the four R-gates, the switch probe, the contrast tool and the paired-argmax harness each
 * built the same object with the same two literals. EIGHT copies of one fact, and every one of them
 * says a Tailwind with one turn left has four — which is #270 exactly, in a different file: the
 * position is running a clock and the seed hands over a constant. A search seeded that way believes
 * it outruns the foe for three turns it does not have, and Trick Room is worse because the number is
 * a SPEED INVERSION rather than a multiplier.
 *
 * THE REMAINDER WAS ALREADY ON THE BOARD AND ALREADY READ. `sideLeft` and `fieldLeft` have returned
 * it since #249, which is what `applySideState` uses for the screens. Nothing new is tracked here.
 *
 * IT IS READ AT THE LEAF SO NO CALLER GROWS THE LINES A NINTH TIME — the same argument that made this
 * function a new seam rather than an argument on `applyField`. The caller's `twA`/`twB`/`tr` are
 * OVERWRITTEN rather than merged: the board is the authority for every one of those eight callers,
 * because all eight built their constant out of this same board. When they disagree it is counted,
 * which is what turns "the callers were wrong" from a claim into a number.
 *
 * WHOSE SIDE: `battleInit`'s side A is always the ASKING side, which is `applySideState`'s pairing
 * and not a second convention — so `twA` is read for `side` and `twB` for the foe, and `applyField`'s
 * p1/p2 swap one function down is exactly what this replaces.
 *
 * NEITHER KEY IS SPELLED HERE. `board.speedSideKeys()` is the format's own answer to "which side
 * condition multiplies speed" and `board.roomFieldKey()` is the declared irreducible `GAME_RULES`
 * already holds — so a regulation that renames either is followed with no edit in this file.
 *
 * AN INFINITE REMAINDER IS REFUSED AND COUNTED. `sideLeft` returns Infinity for a PERMANENT side
 * condition (#268), and the engine's tick is `if (field[k] > 0 && --field[k] <= 0)` — so writing
 * Infinity would hand over a Tailwind that never ends, which is the bug this row is about with the
 * sign flipped. Nothing in this family is permanent today; the guard costs nothing and its
 * alternative failure is silent. */
const fieldClockCounters = { weatherKnown: 0, weatherUnknownAge: 0, weatherExpired: 0, terrainKnown: 0, terrainUnknownAge: 0,
                             twSeeded: 0, twCallerDiffered: 0, twInfinite: 0, trSeeded: 0, trCallerDiffered: 0, trInfinite: 0 };
function applySpeedClocks(S, board, side) {
  if (!S || !S.field || !board || typeof board.sideLeft !== 'function') return;
  const foe = side === 'p1' ? 'p2' : 'p1';
  const left = (sd) => {
    let n = 0;
    for (const k of (typeof B.speedSideKeys === 'function' ? B.speedSideKeys() : [])) {
      const v = board.sideLeft(sd, k);
      if (!isFinite(v)) { fieldClockCounters.twInfinite++; continue; }
      n = Math.max(n, v | 0);
    }
    return n;
  };
  for (const [k, sd] of [['twA', side], ['twB', foe]]) {
    const was = S.field[k] | 0, now = left(sd);
    if (was !== now) fieldClockCounters.twCallerDiffered++;
    S.field[k] = now;
    if (now > 0) fieldClockCounters.twSeeded++;
  }
  if (typeof board.fieldLeft === 'function' && typeof B.roomFieldKey === 'function') {
    const v = board.fieldLeft(B.roomFieldKey());
    if (!isFinite(v)) fieldClockCounters.trInfinite++;
    else {
      const was = S.field.tr | 0, now = v | 0;
      if (was !== now) fieldClockCounters.trCallerDiffered++;
      S.field.tr = now;
      if (now > 0) fieldClockCounters.trSeeded++;
    }
  }
}
function applyFieldClock(S, board, side) {
  if (!S || !S.field || !board) return;
  applySpeedClocks(S, board, side);
  /* *** THE REMAINDER IS THE BOARD'S NOW — ROADMAP #276. ***
   *
   * This used to compute `full - age` here, and #276 made the board compute the same thing for the
   * FEATURES. Two copies of one subtraction is the FACTS-ARE-GLOBAL breach that gave the two weather
   * paths different answers in the first place, so this asks `board.weatherLeft()` and the board asks
   * `MEDI.weatherTurns`. `null` from it means "cannot say" — no age, no engine, no length — and is not
   * zero, so an unknown age still seeds the full clock exactly as it did.
   *
   * THE WORD COMES OFF `weatherWord()` AND NOT OFF `board.weather`, because since #276 the accessor
   * already returns '' for a weather that has run out. Reading it here would make this branch — and
   * `weatherExpired` with it — silently unreachable, which is a dead guard wearing the shape of a
   * fixed one. A board that is one turn past its sun still arrives here as sun-with-zero-left and is
   * DELETED, counted, and proved by the gate.
   *
   * The caller's own `S.field.weather` is honoured when it names a weather the board does not hold:
   * `applyMegaWeather` legitimately hands over a weather that is about to be set. */
  const w = S.field.weather;
  if (w) {
    const word = typeof board.weatherWord === 'function' ? board.weatherWord() : (board.weather || '');
    const mine = !!word && MEDI.weatherId(word) === w;
    const left = mine && typeof board.weatherLeft === 'function' ? board.weatherLeft() : null;
    if (!mine || left == null) {
      fieldClockCounters.weatherUnknownAge++;
      S.field.weatherT = MEDI.weatherTurns(w, mine ? (board.weatherRock || '') : '', TAGSMOD) | 0;
    } else if (left > 0) { fieldClockCounters.weatherKnown++; S.field.weatherT = left; }
    else { fieldClockCounters.weatherExpired++; S.field.weather = ''; S.field.weatherT = 0; }
  }
  /* THE TERRAIN HALF WAS ALREADY REPRESENTABLE and was simply never read: `board.startField` stores an
   * expiry and `board.fieldLeft` has read it back since ROADMAP #249 gave Gravity the same treatment.
   * The board key is the long form (`electricterrain`); `terrainId` owns that translation and nothing
   * else does. */
  const t = S.field.terrain;
  if (t && typeof board.fieldLeft === 'function') {
    const k = BOARD_TERRAIN_KEYS.find(x => MEDI.terrainId(x) === t);
    const left = k ? board.fieldLeft(k) | 0 : 0;
    if (left > 0) { fieldClockCounters.terrainKnown++; S.field.terrainT = left; }
    else fieldClockCounters.terrainUnknownAge++;
  }
}

function applyField(S, f, side, seeded) {
  /* Terrain goes through `terrainId` for the SAME reason weather goes through `weatherId` one line
   * over: this boundary is handed both vocabularies — `terrainOnBoard` above yields the engine's,
   * and a caller this file does not own may still pass the board's raw key. `terrainId` is
   * idempotent, so a value already in the engine's words is unchanged, and an unrecognised one
   * resolves to no terrain and is COUNTED rather than passed through as a truthy string that every
   * formula ignores. */
  const w = MEDI.weatherId(f.weather), t = MEDI.terrainId(f.terrain);
  if (seeded || w) S.field.weather = w;
  else if (!S.field.weather) S.field.weather = '';
  if (seeded || t) S.field.terrain = t;
  else if (!S.field.terrain) S.field.terrain = '';
  S.field.twA = side === 'p1' ? (f.twA || 0) : (f.twB || 0);
  S.field.twB = side === 'p1' ? (f.twB || 0) : (f.twA || 0);
  S.field.tr = f.tr || 0;
}

function rolloutWinProb(board, side, opts) {
  opts = opts || {};
  const n = opts.n || 40;
  /* 0 reproduces the deterministic-greedy playout exactly, so the sweep includes the incumbent. */
  const EXPLORE = typeof opts.explore === 'number' ? opts.explore : 0;
  const FOE_POLICY = opts.foePolicy || 'uniform';
  /* A MID-BATTLE SEED AND A FRESH GAME ARE DIFFERENT QUESTIONS, so it is a parameter.
   *
   * `seeded:true` is right for every mid-game leaf: the actives are already standing there and
   * re-firing their entry effects would drop the foe's Attack a SECOND time on every board with an
   * Incineroar. It is WRONG for team preview, where nobody has entered yet and the entry effects are
   * most of what a lead decision is about. Default unchanged. */
  const SEEDED = opts.seeded !== false;
  const dex = opts.dex;
  const foe = side === 'p1' ? 'p2' : 'p1';
  const stats = { fainted: 0, unbuildable: 0, threw: 0 };
  const exCount = { threw: 0, first: null };

  /* WHERE THE TWO SIDES COME FROM IS A PARAMETER; HOW THEY ARE PLAYED OUT IS NOT.
   *
   * `buildTeams(i, rng) -> {A, B} | null` supplies FRESH bodies for playout i, and is how team
   * preview asks this leaf about a position that has no board yet: a candidate bring of mine against
   * one of the fifteen fours they might bring, sampled per playout. Returning null skips that sample
   * rather than scoring it as a loss. When it is absent the sides are seeded off the board exactly as
   * before, so every existing caller is untouched. */
  const TEAMS = typeof opts.buildTeams === 'function' ? opts.buildTeams : null;
  let built = 0;
  if (!TEAMS) {
    const mine = buildSide(board, side, dex, stats, opts.protectTurns);
    const theirs = buildSide(board, foe, dex, stats);
    /* A side with nothing standing is not a 0% — the caller asked about a position that does not
     * exist, and returning a confident number for it would be worse than saying so. Counted over the
     * LIVING (ROADMAP #244): the array now carries the roster's corpses too, and `.length` would say
     * a wiped side is still playable. */
    if (!liveCount(mine) || !liveCount(theirs)) return null;
    built = mine.length + theirs.length;
  }

  const f = opts.field || {};
  let wins = 0, ran = 0;
  /* HOW FAR THE PLAYOUTS ACTUALLY RAN, and how many hit the wall. ROADMAP #153: the cap is derived
   * from a distribution of REAL game lengths, and a uniformly random playout is less lethal than a
   * person, so the rate at which the cap actually binds is a different number and has to be read
   * rather than assumed. A truncated playout is scored on HP totals, so a high truncation rate turns
   * the leaf into a material comparison — which is a real change of character, not a rounding. */
  let turnsRun = 0, truncated = 0;
  for (let i = 0; i < n; i++) {
    const rng = mulberry((opts.seed || 1) * 1000003 + i);
    /* Fresh bodies EVERY rollout. MEDICHAM mutates the mons it is handed — HP, status, boosts, the
     * bench arrays — so reusing them would make rollout 2 start from wherever rollout 1 ended. The
     * same aliasing that broke the Showdown fork this morning, one layer up. */
    let A, Bt;
    if (TEAMS) {
      const t = TEAMS(i, rng);
      if (!t || !t.A || !t.B) continue;
      A = t.A; Bt = t.B;
      if (!built) built = A.length + Bt.length;
    } else {
      A = buildSide(board, side, dex, { fainted: 0, unbuildable: 0, threw: 0 }, opts.protectTurns);
      Bt = buildSide(board, foe, dex, { fainted: 0, unbuildable: 0, threw: 0 });
    }
    if (!liveCount(A) || !liveCount(Bt)) break;
    /* `bringIn`: EVALUATE A POST-KO REPLACEMENT BY PLAYING IT OUT.
     *
     * Showdown routes a forced replacement to chooseSwitch, never through chooseMove, so the live
     * search never saw the decision at all -- it was made by a one-step heuristic while the rollout
     * that could actually judge it sat unused. The visible symptom was Will's: the bot brought in
     * Froslass after a KO and switched it straight back out the next turn, because the two decisions
     * were being made by two different players who disagree.
     *
     * No new machinery is needed to express it. battleInit takes teamA[0] and teamA[1] as the actives
     * and the rest as bench, and buildSide has ALREADY dropped the fainted mon -- so the surviving
     * actives sit at the front of A, and "bring in X" is exactly "move X's body to the first free
     * active index". Resolved by species through mcKeyFor, the same way a switch click resolves,
     * because a bench index that slips brings in the wrong Pokemon. */
    if (opts.bringIn) {
      const key = B.mcKeyFor(opts.bringIn, { mayMiss: 'replacement with no MC row; not offered' });
      /* LIVING ONLY. The array's tail is the roster's corpses now, and a replacement that resolved to
       * one of them would be spliced onto the field as a dead body. Species clause makes the collision
       * unreachable today; the guard costs nothing and the alternative failure is silent. */
      const at = A.findIndex(x => x && !x.fainted && x.name === key);
      /* Unbuildable replacement: say so rather than roll out whoever happened to be at that index. */
      if (!key || at < 0) return null;
      const surv = ['a', 'b'].filter(L => { const m = board.slot(side, L); return m && !m.fainted; }).length;
      if (at !== surv) { const [body] = A.splice(at, 1); A.splice(surv, 0, body); }
    }
    const S = MEDI.battleInit(A, Bt, { seeded: SEEDED });
    /* ROADMAP #245. Board-seeded only: a `buildTeams` caller (team preview) supplies its own bodies
     * and there is no position behind them to check against, so asking would compare a hypothetical
     * bring against a real graveyard and invent a mismatch. */
    if (!TEAMS) checkFallenSeeded(S, board, side, foe);
    S._explore = EXPLORE;
    if (opts.maxTurns) S.maxTurns = opts.maxTurns;
    /* ORDER IS THE FIX. The caller's field is applied FIRST and the mega's own weather SECOND, so
     * applyMegaWeather's `if (S.field.weather) return` guard arbitrates between them instead of
     * being overwritten by the next line. A real weather the board reports still wins. */
    applyField(S, f, side, SEEDED);
    /* ROADMAP #249 and #270. Board-seeded only: `buildTeams` (team preview) has no board and no game
     * has started, so there is nothing up to carry — and inventing it would be worse than omitting
     * it. The clock runs BEFORE `applyMegaWeather`, so that a real weather with turns left keeps its
     * own remainder and the mega's guard still arbitrates on `S.field.weather` exactly as it did. */
    if (board && SEEDED) { applyFieldClock(S, board, side); applySideState(S, board, side); }
    applyMegaWeather(S, dex);
    wins += runPlayout(S, rng, EXPLORE, FOE_POLICY, exCount, opts.switchRate);
    ran++;
    turnsRun += S.turn || 0;
    if (S.turn >= (S.maxTurns || 20)) truncated++;
  }
  /* DENOMINATOR IS WHAT ACTUALLY RAN, not what was asked for. Identical for every board-seeded
   * caller -- buildSide is deterministic, so a pre-check that passed cannot fail inside the loop --
   * and it is the difference between a skipped sample and a lost game for a buildTeams caller. */
  if (!ran) return null;
  const iv = wilson(wins, ran);
  return { p: wins / ran, wins, n: ran, lo: iv.lo, hi: iv.hi,
           built, dropped: stats,
           exploreThrew: exCount.threw, firstExploreError: exCount.first,
           switches: exCount.switches || 0, meanTurns: turnsRun / ran, truncated };
}

/* ONE STEP OF SEARCH: force MY two clicks, let the opponent play its own policy, run exactly one turn,
 * then roll the rest out. This is the transition R3 needs and it is the same machinery as the leaf --
 * only the first turn differs, and only on my side.
 *
 * The opponent is NOT modelled. It plays chooseAction during the stepped turn, identically for every
 * candidate, so the ranking across candidates is like-for-like. That makes this a best response to a
 * fixed opponent rather than an equilibrium: weaker than the design's matrix game, and the right first
 * cut, because if a best response does not diverge from MAG then a mixture over the same cells will
 * not either.
 *
 * @param myClicks  [{move, target}, {move, target}] for slots a and b, in sideTeam order
 * @returns         win probability after that pair, or null when the position cannot be built
 */
function rolloutAfterActions(board, side, opts) {
  const foeFirstMoves = {};   // what the opponent chose on the stepped turn, across playouts
  opts = opts || {};
  const n = opts.n || 20;
  const dex = opts.dex;
  const foe = side === 'p1' ? 'p2' : 'p1';
  /* Defined per function: the first version declared it only in rolloutWinProb and read it in
   * rolloutAfterActions, which is a free variable that a syntax check cannot see and that throws
   * only when a real turn calls it -- the same mistake as the ROLLOUT flag left behind by the
   * miltank extraction. */
  const FOE_POLICY = opts.foePolicy || 'uniform';
  const f = opts.field || {};
  const clicks = opts.myClicks || [];
  const zero = () => ({ fainted: 0, unbuildable: 0, threw: 0 });
  let forcedThrew = 0, firstForcedError = null;
  const exCount = { threw: 0, first: null };
  let resolved = 0, unresolved = 0;
  let wins = 0, ran = 0;
  for (let i = 0; i < n; i++) {
    const A = buildSide(board, side, dex, zero(), opts.protectTurns);
    const Bt = buildSide(board, foe, dex, zero());
    if (!liveCount(A) || !liveCount(Bt)) break;
    const S = MEDI.battleInit(A, Bt, { seeded: true });
    checkFallenSeeded(S, board, side, foe);          /* ROADMAP #245 — and this is the RANKING path */
    if (opts.maxTurns) S.maxTurns = opts.maxTurns;
    /* Always SEEDED here: rolloutAfterActions only ever steps a real mid-battle board.
     * Field first, mega weather second -- see the note at the call site in rolloutWinProb. */
    applyField(S, f, side, true);
    applyFieldClock(S, board, side);                /* ROADMAP #270 — the field's own countdown */
    applySideState(S, board, side);                 /* ROADMAP #249 — always a mid-battle board here */
    applyMegaWeather(S, dex);
    const rng = mulberry((opts.seed || 1) * 1000003 + i);

    /* THE FORCED TURN. The click's target is a board.js mon; MEDICHAM needs one of ITS bodies, and the
     * two arrays are in the same order by construction (sideTeam puts actives first), so the target is
     * resolved by SLOT INDEX rather than by name. Resolving by species would pick the wrong body in a
     * mirror, and 58.63% of corpus games have one. */
    const forced = new Map();
    for (let k = 0; k < Math.min(2, clicks.length); k++) {
      const c = clicks[k], me = S.actA[k];
      if (!me || !c) continue;
      /* A SWITCH IS A CANDIDATE LIKE ANY OTHER, and until now the search refused to consider one.
       *
       * board.js scores a switch with a single flat `isSwitch` feature — the same constant whoever is
       * coming in and whatever is about to die — which is why MAG's switching measured 10 points
       * WORSE than never switching. A rollout needs no such feature: it brings the body in and plays
       * the game out.
       *
       * Resolved BY SPECIES, not by bench index. buildSide drops any Pokemon dmgMon cannot build (an
       * in-battle forme with no usage row), so the bench array here and board.bench() can differ in
       * length — and an index that silently slips brings in the wrong Pokemon, which is worse than
       * refusing. A switch whose target cannot be found is skipped and the slot keeps its own action. */
      if (c.switchTo) {
        const key = B.mcKeyFor(c.switchTo, { mayMiss: 'bench species with no MC row; the switch is then not offered' });
        const body = key && S.benchA.find(x => x && x.name === key && !x.fainted && x.curHP > 0);
        /* COUNTED, because a forced click that fails to resolve does not error — the slot simply
         * falls through to chooseAction, and then EVERY unresolvable candidate evaluates to the same
         * thing. That makes a menu of distinct options collapse into one, and the argmax over the
         * collapse looks exactly like a decision. If `unresolved` is nonzero the caller is not
         * ranking what it thinks it is ranking. */
        if (body) { forced.set(me, { kind: 'switch', to: body }); resolved++; }
        else unresolved++;
        continue;
      }
      if (!c.move) continue;
      const foesLive = S.actB.filter(x => x && !x.fainted && x.curHP > 0);
      if (!foesLive.length) continue;
      /* targetMon is null for a spread move, which takes no target -- passing one anyway would make
       * playerAction treat it as aimed. */
      /* THE SLOT LETTER, which is what a board.js candidate actually carries -- `targetLetter`,
       * not a `.slot` on the target mon. Reading a field that does not exist would have defaulted
       * every aimed move to the first live foe, silently collapsing "Fake Out the left one" and
       * "Fake Out the right one" into the same candidate and understating divergence. */
      let tgt = foesLive[0];
      const idx = ['a', 'b'].indexOf(c.targetLetter || '');
      if (idx >= 0 && S.actB[idx] && !S.actB[idx].fainted && S.actB[idx].curHP > 0) tgt = S.actB[idx];
      /* A throw here means the CANDIDATE cannot be represented, which is not a detail: the caller is
       * ranking that candidate against the others, and a click that silently fails to register leaves
       * the mon on chooseAction instead -- so the cell being scored is not the cell that was asked
       * for, and it would look like a candidate that happens to score the same as the default.
       * Counted onto the state so the caller can see it rather than infer it. */
      try {
        const act = MEDI.playerAction(me, c.move, tgt, S.field);
        if (act) forced.set(me, act);
      } catch (e) {
        forcedThrew++;
        if (!firstForcedError) firstForcedError = `${c.move}: ${e.message}`;
      }
    }
    MEDI.battleTurn(S, rng, forced, null);

    /* ...and the rest is an ordinary rollout -- THE SAME ONE, not a copy of it. */
    const EX = typeof opts.explore === 'number' ? opts.explore : 0;
    wins += runPlayout(S, rng, EX, FOE_POLICY, exCount, opts.switchRate);
    ran++;
  }
  /* Reported rather than returned quietly: the caller wants a number, and a number produced while
   * some clicks failed to register is a different number. Loud on the first occurrence only. */
  if (forcedThrew && !rolloutAfterActions._warned) {
    rolloutAfterActions._warned = true;
    console.error(`  rolloutAfterActions: ${forcedThrew} forced click(s) could not be built, first: ${firstForcedError}`);
  }
  if (exCount.threw && !rolloutAfterActions._warnedEx) {
    rolloutAfterActions._warnedEx = true;
    console.error(`  rolloutAfterActions: ${exCount.threw} explore action(s) threw, first: ${exCount.first}`);
  }
  /* WHAT THE OPPONENT ACTUALLY DID across the playouts.
   *
   * Will asked whether the search considered that he would mega, then Tailwind, then Solar Beam --
   * a fair question that nothing in the output could answer. It cannot be answered by reading the
   * code either, because the honest answer is a DISTRIBUTION: at explore=1.0 the opponent clicks a
   * uniformly random legal move every turn, so his real line is one draw among many rather than
   * something anticipated.
   *
   * A player that cannot show what it assumed about you is a player you cannot argue with. This
   * counts the foe's first-turn clicks so the assumption is inspectable instead of asserted. */
  if (opts.report) opts.report({ resolved, unresolved, foeFirst: foeFirstMoves });
  return ran ? wins / ran : null;
}

/* applyField is exported as a TEST SEAM, and named as one. It is the boundary where an observed board
 * becomes a playout field, which makes it the one place the board's vocabulary is translated into the
 * engine's -- `tests/test-mechanics.js` probes it directly rather than inferring the translation from
 * a win probability, because a leaf value moving is consistent with several other explanations. */
module.exports = { rolloutWinProb, rolloutAfterActions, sideTeam, sideFallen, buildSide, wilson, runPlayout, applyField,
                   /* ROADMAP #249. Exported as the same kind of TEST SEAM `applyField` is, and for
                    * the same reason: it is the boundary where an observed side condition becomes a
                    * playout one, so the translation is probed directly rather than inferred from a
                    * win probability that several other things could also have moved. */
                   applySideState, terrainOnBoard,
                   /* ROADMAP #152/#153. `SWITCH_COUNTERS` is the proof-of-firing surface — a run
                    * prints it and `tests/test-rollout-switch.js` fails on a zero. `census()` is the
                    * ONE reader of the store-measured switch rate and horizon, so miltank.js and the
                    * leaf cannot end up holding two different numbers for one fact. */
                   SWITCH_COUNTERS, census,
                   /* ROADMAP #267/#269/#270. Same kind of test seam, and the counters for the same
                    * stated reason `ppCounters` is exported: a seed that carried nothing looks
                    * exactly like a position with nothing on it, so the wire has to be able to prove
                    * it fired. `seedableVolatiles`/`unseededVolatiles` are the vocabulary check
                    * itself — the gate asserts the first against the engine's own table and PRINTS
                    * the second, because a silent omission and a considered one look identical in
                    * the code. */
                   applyFieldClock, seedableVolatiles, unseededVolatiles, VOL_MOVE_FIELD,
                   fieldClockCounters, volCounters,
                   /* ROADMAP #275/#277. `applySpeedClocks` is exported for the gate alone — the leaf
                    * calls it through `applyFieldClock` — and `VOL_ENGINE_FIELD` is the declared
                    * protocol-to-engine join the gate checks both halves of. `SEED_COUNTERS` says
                    * which source answered the Protect streak and whether a choice lock ever fired. */
                   applySpeedClocks, VOL_ENGINE_FIELD, SEED_COUNTERS,
                   /* ROADMAP #245. `FALLEN_GUARD` is the guard the engine's own `fallenNoRoster`
                    * structurally cannot be: it compares what the engine will COUNT against the
                    * board's own death record, at the seam where both are in scope. Exported so a
                    * gate can assert `checked > 0` (it ran at all) and `mismatch === 0` (the claim),
                    * and `fallenTruth` so a caller outside the leaf can ask the same question of the
                    * same source rather than re-deriving it from a list somebody else pruned. */
                   FALLEN_GUARD, fallenTruth, checkFallenSeeded,
                   /* 2026-08-29, the empirical-click arm of the whole-game differential. EXPORT ONLY
                    * — no line of this file's behaviour changes, and no require edge is added, so
                    * `engine_release.js` SOURCES is untouched and no existing release is stranded.
                    *
                    * `engine/empirical_driver.js` DUPLICATES this draw, and it has to: requiring this
                    * file from `game_differential.js` would pull a LIVE medicham2 and board.js into a
                    * process whose whole purpose is to read a frozen release, and lifting the sampler
                    * into a shared module would add a require edge to a frozen SOURCE and strand
                    * every release cut before today (LESSONS §12 — that reached 168 of 200 once).
                    *
                    * So the duplication is pinned by a TEST rather than by a promise:
                    * `tests/test-empirical-driver.js` runs the same rows through both implementations
                    * across a sweep of u and FAILS the day they disagree. Two producers of one fact
                    * is this repo's most-repeated failure; the only safe version of it is one that
                    * goes red. This export is what makes that check possible at all. */
                   pickByPrior, movePriorFor };
