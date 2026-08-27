/* probe_corpse_in_slot.js — DOES A FAINTED BODY OCCUPY A DIFFERENT PLACE IN THE TWO ENGINES?
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_corpse_in_slot.js [--games N]
 *
 * ROADMAP #344 says: *"a fainted body stays in one of our active slots where Showdown clears it
 * inside `faintMessages`"*, sourced from a `final_roster` dump in which a body read `fainted=true`
 * together with `where=active` on the medicham side. The row calls that REAL STATE rather than a
 * labelling artifact, on the ground that `rosterSnapshot` *"reads membership of the active array
 * itself, not a flag"*.
 *
 * ================= THE TWO PREDICATES ============================================================
 *
 * That ground covers ONE HALF of the comparison. `rosterSnapshot` (engine/game_differential.js) is:
 *
 *     medicham   where: acts.indexOf(m) >= 0 ? 'active' : 'bench'     <- MEMBERSHIP of S.actA/actB
 *     showdown   where: p.isActive          ? 'active' : 'bench'      <- a FLAG on the Pokemon
 *
 * `faintMessages` sets `pokemon.isActive = false` (sim/battle.ts:2563). It does NOT remove the body
 * from `side.active`, and nothing else does either: the only writers of `side.active[pos]` in the
 * whole simulator are `switchIn` (sim/battle-actions.ts:136), `swapPosition` (sim/battle.ts:1597-8)
 * and the request-mirror at :2690. So the authority keeps the corpse in the slot exactly as we do,
 * and the dump's two columns are answering two different questions.
 *
 * THIS FILE MEASURES BOTH PREDICATES ON THE AUTHORITY'S OWN OBJECT rather than arguing from the
 * source, and holds our membership against the authority's membership.
 *
 * ================= PART 1 — MEMBERSHIP, AT THE MOMENT THE ROW NAMES ==============================
 *
 * `Battle#faintMessages` is wrapped. The instant it returns — which is after `isActive = false` and
 * BEFORE the switch request is issued at :2907 — every slot of every side is read:
 *
 *     corpse_in_slot          a fainted body that is STILL a member of side.active
 *     corpse_flag_active      of those, how many still read isActive === true   (must be 0)
 *     corpse_gone_from_slot   a fainted body that is NOT a member               (the row's claim)
 *
 * CONTROL, AND IT CAN FAIL: the same wrapper counts bodies that have LEFT the field — every body
 * `switchIn` displaced. If membership never distinguishes anything, `left_field_still_in_slot` would
 * be non-zero and the whole predicate would be inert.
 *
 * ================= PART 2 — PARITY, HELD BETWEEN THE ENGINES ======================================
 *
 * At every turn boundary the driver hands both live states to `onBoundary`. The occupancy of the two
 * active arrays is compared BY ROSTER KEY, through `G.rosterKey` — the one door — with the fainted
 * flag beside it. A boundary at which one engine holds a corpse in a slot and the other does not is
 * exactly the state #344 asserts.
 *
 * THE PLANT. A comparator that has never been shown catching a planted bug is not a comparator, so
 * the last boundary of every Nth game is compared a SECOND time with one of medicham's occupants
 * removed. That must be reported as a mismatch, and the count of successful plants is printed.
 *
 * ================= PART 3 — THE CONSEQUENCE, WHICH IS WHAT THE ROW ACTUALLY ASKS FOR =============
 *
 * The row's status cell says *"consequence unmeasured; NOT A DEFECT until then"*. `isActive` is read
 * in exactly one place where a CORPSE can reach it and an `hp`/`fainted` gate does not already
 * dominate: `findEventHandlers` opens
 *
 *     if (target instanceof Pokemon && (target.isActive || source?.isActive)) { ...; target = target.side; }
 *                                                                              (sim/battle.ts:1053-1067)
 *
 * For a corpse that test is false, so the target's own handlers, every `onAlly`/`onAny`/`onFoe`
 * handler on the field, and the whole `target instanceof Side` block below it are ALL skipped. That
 * is the channel today's replacement work used for `ModifySpe`. This part measures the rest of it:
 * `findEventHandlers` is wrapped, and every call whose target is a corpse recomputes what the skipped
 * block WOULD have collected. The histogram of event names, with handler counts and effect ids, is
 * printed. A row with a non-zero count is a channel where the authority is silent because the body is
 * dead — and therefore a place where an engine that keeps the body in play could fire something.
 *
 * CONTROL, AND IT CAN FAIL: `ModifySpe` is the one channel already known to carry suppressed
 * handlers, and the run REFUSES to pass if the histogram does not contain it. A detector that found
 * nothing anywhere would otherwise be indistinguishable from a detector that is not wired.
 *
 * ================= WHAT THIS FILE DOES NOT DO ====================================================
 *
 * It does not change the engine and it has no MEDI_* knob, because it is an OBSERVATION of the
 * authority plus a parity check. If Part 2 finds a mismatch or Part 3 finds a channel medicham2 does
 * not model, THAT is the defect and it gets its own probe and its own knob.
 *
 * The wrapper in Part 3 adds READ-ONLY calls to the authority (`findPokemonEventHandlers` and
 * `resolvePriority` are pure — sim/battle.ts:950-1000). `--verify-inert` replays every game with the
 * wrapper disarmed and asserts the divergence verdicts are identical, so "the instrument moved the
 * thing it measured" is ruled out rather than assumed.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = Number(argOf('--games', 40)) || 40;
const VERIFY_INERT = argv.includes('--verify-inert');

if (!process.argv.includes('--state')) process.argv.push('--state');
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');

const SD = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const Pokemon = require(process.env.SHOWDOWN_PATH + '/dist/sim/pokemon').Pokemon;

/* ---- PART 1's WRAPPER — the authority's own membership, at the moment faintMessages returns ----- */
const P1 = { faint_calls: 0, corpse_in_slot: 0, corpse_flag_active: 0, corpse_gone_from_slot: 0,
             left_field_still_in_slot: 0, left_field_checked: 0, live_in_slot: 0 };
let ARMED = false;
const _faintMessages = SD.Battle.prototype.faintMessages;
SD.Battle.prototype.faintMessages = function (...a) {
  const out = _faintMessages.apply(this, a);
  if (!ARMED) return out;
  P1.faint_calls++;
  for (const side of this.sides) {
    /* MEMBERSHIP: is the body an element of side.active? Never a flag. */
    for (const p of side.active) {
      if (!p) continue;
      if (p.fainted) { P1.corpse_in_slot++; if (p.isActive) P1.corpse_flag_active++; }
      else P1.live_in_slot++;
    }
    /* THE ROW'S CLAIM, counted directly: a fainted body of this side that is NOT in a slot. Split
     * from the control below by `side.faintedThisTurn`, which is the authority's own field. */
    for (const p of side.pokemon) {
      if (!p.fainted) continue;
      if (!side.active.includes(p)) P1.corpse_gone_from_slot++;
    }
    /* THE CONTROL. A body that is alive, on the bench, and therefore genuinely off the field: it must
     * NOT be a member. If membership could not tell anybody apart, this would be non-zero. */
    for (const p of side.pokemon) {
      if (p.fainted || p.isActive) continue;
      P1.left_field_checked++;
      if (side.active.includes(p)) P1.left_field_still_in_slot++;
    }
  }
  return out;
};

/* ---- PART 3's WRAPPER — what `isActive === false` silences on a corpse ------------------------- */
const NO_PREFIX = ['BeforeTurn', 'Update', 'Weather', 'WeatherChange', 'TerrainChange'];
const P3 = new Map();       /* eventName -> { calls, handlers, ids:Map<id,n> } */
/* THE PLANT FOR PART 3. The recompute below only ever reports what a CORPSE was carrying, so a table
 * of zeroes is indistinguishable from a recompute that returns nothing for anybody. Every Nth call
 * whose target is a LIVE active body is therefore run through the SAME recompute, which must come
 * back non-zero — a live body on a real board always has an ability handler at minimum. */
const P3_PLANT = { tried: 0, nonzero: 0 };
const P3L = new Map();      /* the same recompute, on LIVE bodies, sampled — eventName -> {reads,handlers} */
let P3_ARMED = false, P3_LIVE_SEEN = 0;
const _findEventHandlers = SD.Battle.prototype.findEventHandlers;
function suppressedBlock(battle, target, eventName, onHandler) {
  /* EXACTLY the block sim/battle.ts:1053-1067 skipped, recomputed. Read-only:
   * `findPokemonEventHandlers` / `findSideEventHandlers` / `resolvePriority` mutate nothing on the
   * battle (sim/battle.ts:950-1000). */
  let n = 0;
  const note = arr => { for (const h of arr) { n++; if (onHandler) onHandler(h); } };
  note(battle.findPokemonEventHandlers(target, 'on' + eventName));
  if (!NO_PREFIX.includes(eventName)) {
    for (const a of target.alliesAndSelf()) {
      note(battle.findPokemonEventHandlers(a, 'onAlly' + eventName));
      note(battle.findPokemonEventHandlers(a, 'onAny' + eventName));
    }
    for (const f of target.foes()) {
      note(battle.findPokemonEventHandlers(f, 'onFoe' + eventName));
      note(battle.findPokemonEventHandlers(f, 'onAny' + eventName));
    }
    /* the `target instanceof Side` block that never ran either — side conditions only, since
     * shouldBubbleDown is false for a Pokemon target. */
    for (const side of battle.sides) {
      if (side.n >= 2 && side.allySide) continue;
      if (side === target.side || side === target.side.allySide) note(battle.findSideEventHandlers(side, 'on' + eventName));
      else note(battle.findSideEventHandlers(side, 'onFoe' + eventName));
      note(battle.findSideEventHandlers(side, 'onAny' + eventName));
    }
  }
  return n;
}
SD.Battle.prototype.findEventHandlers = function (target, eventName, source) {
  const out = _findEventHandlers.call(this, target, eventName, source);
  if (!P3_ARMED) return out;
  if (!(target instanceof Pokemon)) return out;
  if (target.isActive || (source && source.isActive)) {
    /* THE PLANT — the same recompute on a body that is genuinely on the field, sampled. It is what
     * separates "this corpse was carrying nothing" from "this recompute returns nothing for anybody",
     * and it is kept PER EVENT NAME so the two can be read off one table. */
    if (target.isActive && !target.fainted && (++P3_LIVE_SEEN % 50 === 0)) {
      const n = suppressedBlock(this, target, eventName, null);
      const l = P3L.get(eventName) || { reads: 0, handlers: 0 };
      l.reads++; l.handlers += n; P3L.set(eventName, l);
      P3_PLANT.tried++; if (n > 0) P3_PLANT.nonzero++;
    }
    return out;
  }
  if (!target.fainted) return out;              /* an off-field body is not what #344 is about */
  const row = P3.get(eventName) || { calls: 0, handlers: 0, ids: new Map() };
  row.calls++;
  row.handlers += suppressedBlock(this, target, eventName, h => {
    const id = (h && h.effect && h.effect.id) || '?';
    row.ids.set(id, (row.ids.get(id) || 0) + 1);
  });
  P3.set(eventName, row);
  return out;
};

const G = require(D('engine', 'game_differential.js'));

/* ---- PART 2 — the parity comparator ------------------------------------------------------------ */
const occ = (S, battle) => {
  const me = [], sd = [];
  const push = (into, arr, sideId) => {
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      into.push(m ? (sideId + i + ':' + G.rosterKey(m) + ':' + (m.fainted ? 'fnt' : 'ok')) : (sideId + i + ':-'));
    }
  };
  push(me, S.actA, 'A'); push(me, S.actB, 'B');
  push(sd, battle.p1.active, 'A'); push(sd, battle.p2.active, 'B');
  return { me, sd };
};
const P2 = { boundaries: 0, mismatched: 0, corpse_boundaries: 0, corpse_slots: 0,
             plants: 0, plants_caught: 0, witnesses: [] };

/* ---- PART 1b — THE DUMP FIELD ITSELF, which is where #344 was read -----------------------------
 * `final_roster` is what `engine/replay_one.js` prints, and it is the only place a person meets this
 * question. Every fainted body is looked up in BOTH halves by roster key and the two `where` words
 * are compared. They must agree, because Part 1 has just measured that the two engines hold the body
 * in the same place. */
const P1B = { corpses_matched: 0, where_disagreed: 0, unmatched: 0, witnesses: [] };
function dumpCheck(fr, tag) {
  if (!fr || fr.failed || !fr.medicham || !fr.showdown) return;
  for (const side of ['p1', 'p2']) {
    const sd = new Map(((fr.showdown[side] || {}).mons || []).map(m => [m.key, m]));
    for (const m of (fr.medicham[side] || [])) {
      if (!m.fainted) continue;
      const s = sd.get(m.key);
      if (!s) { P1B.unmatched++; continue; }
      P1B.corpses_matched++;
      if (String(m.where) !== String(s.where)) {
        P1B.where_disagreed++;
        if (P1B.witnesses.length < 6)
          P1B.witnesses.push(tag + ' ' + side + ' ' + m.name + '  medicham where=' + m.where
            + '  showdown where=' + s.where + (s.isActive === undefined ? '' : ' isActive=' + s.isActive));
      }
    }
  }
}
const cmp = (me, sd) => me.length === sd.length && me.every((v, i) => v === sd[i]);

const PAIRS = G.pairsFor('baseline');
console.log('\n  pairs available: ' + PAIRS.length + ', playing ' + Math.min(PAIRS.length, GAMES));
if (!PAIRS.length) { console.log('NO PAIRS — nothing measured. This is not a pass.'); process.exit(2); }

const verdicts = [];
function run(arm) {
  ARMED = P3_ARMED = arm;
  const v = [];
  let gi = 0;
  for (const pr of PAIRS.slice(0, GAMES)) {
    gi++;
    const r = G.playGame(pr.a, pr.b, 'baseline', 'corpseslot/' + pr.tag.slice(0, 24), {
      arm: G.PRIMARY_ARM,
      onBoundary: arm ? (snap, turnIdx, S, battle) => {
        const o = occ(S, battle);
        P2.boundaries++;
        const corpses = o.me.filter(x => /:fnt$/.test(x)).length + o.sd.filter(x => /:fnt$/.test(x)).length;
        if (corpses) { P2.corpse_boundaries++; P2.corpse_slots += corpses; }
        if (!cmp(o.me, o.sd)) {
          P2.mismatched++;
          if (P2.witnesses.length < 8) P2.witnesses.push({ game: gi, turn: turnIdx, me: o.me.join(' '), sd: o.sd.join(' ') });
        }
        /* THE PLANT — every 7th boundary, drop one medicham occupant and demand the mismatch. */
        if (P2.boundaries % 7 === 0 && o.me.length > 1) {
          P2.plants++;
          if (!cmp(o.me.slice(1), o.sd)) P2.plants_caught++;
        }
      } : undefined,
    });
    if (arm) dumpCheck(r.finalRoster, 'g' + gi);
    v.push(r.err ? 'ERR:' + String(r.err).slice(0, 40) : (r.diverged ? 'DIV:' + String(r.cause || '').slice(0, 60) : 'same'));
  }
  ARMED = P3_ARMED = false;
  return v;
}

const t0 = Date.now();
const ARMED_V = run(true);
console.log('  armed run: ' + ARMED_V.length + ' games in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

let bad = 0;
const say = (ok, what, detail) => { console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + (detail ? '   ' + detail : '')); if (!ok) bad++; };

/* ================= PART 1 ======================================================================== */
console.log('\n  === PART 1 — THE AUTHORITY\'S OWN MEMBERSHIP, READ AT `faintMessages` RETURN ===');
for (const k of Object.keys(P1)) console.log('    ' + k.padEnd(26) + P1[k]);
say(P1.faint_calls > 0, 'the wrapper ran at all', 'faintMessages calls = ' + P1.faint_calls);
say(P1.corpse_in_slot > 0, 'the fixture actually staged a corpse in a slot', 'corpse_in_slot = ' + P1.corpse_in_slot);
say(P1.corpse_flag_active === 0, 'every corpse in a slot reads isActive === FALSE (the flag DOES move)',
  'corpse_flag_active = ' + P1.corpse_flag_active);
say(P1.left_field_still_in_slot === 0, 'CONTROL — a body that left the field is NOT a member of side.active',
  P1.left_field_still_in_slot + ' of ' + P1.left_field_checked + ' checked');
console.log('    ROADMAP #344 asserts the authority CLEARS the body from the slot. Membership says:');
console.log('      still a member while fainted : ' + P1.corpse_in_slot);
console.log('      removed from the slot        : ' + P1.corpse_gone_from_slot
  + '   (these are bodies already REPLACED by switchIn, not cleared by faintMessages)');

console.log('\n  === PART 1b — THE DUMP FIELD #344 WAS READ OUT OF (`final_roster`) ===');
console.log('    fainted bodies matched in both halves  ' + P1B.corpses_matched);
console.log('    halves that DISAGREED on `where`       ' + P1B.where_disagreed);
console.log('    unmatched keys (not compared)          ' + P1B.unmatched);
for (const w of P1B.witnesses) console.log('      ' + w);
say(P1B.corpses_matched > 0, 'the dump held fainted bodies at all', P1B.corpses_matched + ' compared');
say(P1B.where_disagreed === 0,
  'both halves of the dump answer `where` with the SAME predicate for a corpse',
  P1B.where_disagreed + ' of ' + P1B.corpses_matched);

/* ================= PART 2 ======================================================================== */
console.log('\n  === PART 2 — PARITY OF THE TWO ACTIVE ARRAYS, BY ROSTER KEY, AT EVERY BOUNDARY ===');
console.log('    boundaries compared        ' + P2.boundaries);
console.log('    boundaries holding a corpse ' + P2.corpse_boundaries + '  (corpse-slots ' + P2.corpse_slots + ')');
console.log('    boundaries that MISMATCHED  ' + P2.mismatched);
for (const w of P2.witnesses) {
  console.log('      game ' + w.game + ' turn ' + w.turn);
  console.log('        medicham ' + w.me);
  console.log('        showdown ' + w.sd);
}
say(P2.boundaries > 0, 'boundaries were compared at all');
say(P2.plants > 0 && P2.plants === P2.plants_caught,
  'CONTROL — every planted occupancy change was reported as a mismatch',
  P2.plants_caught + ' of ' + P2.plants);
say(P2.mismatched === 0, 'the two engines hold the SAME bodies in the SAME slots, corpses included');
const kf = G.rosterKeyFallbacks();
say(!Object.values(kf).some(v => v), 'no roster-key read had to fall back', JSON.stringify(kf));

/* ================= PART 3 ======================================================================== */
console.log('\n  === PART 3 — WHAT `isActive === false` SILENCES ON A CORPSE (sim/battle.ts:1053) ===');
const rows = [...P3.entries()].sort((a, b) => b[1].handlers - a[1].handlers || b[1].calls - a[1].calls);
if (!rows.length) console.log('    (no runEvent reached a corpse at all)');
console.log('    ' + 'event'.padEnd(24) + 'corpse-calls  SUPPRESSED   live-reads  live-handlers   what');
for (const [ev, r] of rows) {
  const ids = [...r.ids.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([i, n]) => i + '*' + n).join(' ');
  const l = P3L.get(ev) || { reads: 0, handlers: 0 };
  console.log('    ' + ev.padEnd(24) + String(r.calls).padStart(11) + String(r.handlers).padStart(13)
    + String(l.reads).padStart(13) + String(l.handlers).padStart(15) + '   ' + ids);
}
const withHandlers = rows.filter(([, r]) => r.handlers > 0);
say(rows.length > 0, 'at least one event was run against a corpse at all', rows.length + ' event name(s)');
/* THE CONTROL. The `live-handlers` column is the SAME recompute run against a body that is genuinely
 * on the field. It must be non-zero somewhere, or every zero in the SUPPRESSED column would be a fact
 * about this instrument rather than about the corpse. */
say(P3_PLANT.nonzero > 0,
  'CONTROL — the same recompute DOES return handlers when the body is alive',
  P3_PLANT.nonzero + ' of ' + P3_PLANT.tried + ' sampled live reads were non-zero, over '
  + [...P3L.entries()].filter(([, l]) => l.handlers > 0).length + ' event name(s)');
console.log('    channels that DO suppress something: ' + (withHandlers.map(([e, r]) => e + '(' + r.handlers + ')').join(', ') || '(none)'));
console.log('\n    Every row above with a non-zero suppressed count is a channel where the AUTHORITY is');
console.log('    silent because the body is dead. It is a DEFECT here only if medicham2 fires it, and');
console.log('    that is a separate probe per channel with its own knob.');

/* ================= THE INSTRUMENT DID NOT MOVE THE GAME ========================================== */
if (VERIFY_INERT) {
  console.log('\n  === --verify-inert — the same games with both wrappers disarmed ===');
  const BARE = run(false);
  const same = BARE.length === ARMED_V.length && BARE.every((v, i) => v === ARMED_V[i]);
  say(same, 'the wrappers did not change a single game\'s verdict',
    same ? ARMED_V.filter(v => v !== 'same').length + ' diverged, both runs' : 'FIRST DIFF at game '
      + (BARE.findIndex((v, i) => v !== ARMED_V[i]) + 1));
} else {
  console.log('\n  (--verify-inert not given: the read-only claim about the wrappers is argued, not measured)');
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
