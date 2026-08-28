/* probe_upkeep_lines.js — THE THREE `<> |upkeep` ROWS, STAGED ONE AT A TIME.
 *
 *   node tests/probe_upkeep_lines.js --release <id>
 *
 * ================= WHAT IT IS ====================================================================
 *
 * A PROBE, not a gate. It is not in tests/run-all.js. It stages three shapes the pinned pool
 * produced as first divergences on release a4b2832e0a0f, all three sitting against `|upkeep`:
 *
 *   HITCOUNT  `event missing from medicham2 :: |-hitcount|p2a|1 <> |upkeep`
 *   TRAP      `event missing from medicham2 :: |-end|p2a|infestation|[partiallytrapped] <> |upkeep`
 *   PERISH    `event missing from medicham2 :: |upkeep <> |faint|p2b`
 *
 * READ THE CLASSIFIER BEFORE THE ROWS. `classify()` (engine/game_differential.js:4531) builds the
 * cause as `cls :: gen(sdHead) <> gen(meHead)` — THE LEFT SIDE IS SHOWDOWN'S LINE and the right is
 * medicham2's. So HITCOUNT and TRAP are lines SHOWDOWN emits and we do not, and PERISH is the
 * opposite sign inside the same class name: we emit `|faint|` where the authority emits `|upkeep|`.
 *
 * Every arm is TWO PROTOCOL STREAMS and a control that moves exactly one thing. Nothing here is
 * judged by whether an arm "looks" right.
 */
'use strict';
require('../engine/showdown_path.js');
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH to a built pokemon-showdown checkout. This is not a pass.');
  process.exit(2);
}
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (!arg('--release', null)) {
  console.error('REFUSED — pass --release <id>. Requiring engine/game_differential.js without it CUTS');
  console.error('A RELEASE into data/releases as a side effect of loading the module.');
  process.exit(2);
}
const ONLY = arg('--only', null);

const GD = require('../engine/game_differential.js');
const { buildPair, playGame, ARM_BY_ID } = GD;
const TAGS = require('../data/tags.json');
const CS = require('../engine/champions_sim.js');
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const MID = ARM_BY_ID.get('middle');
const BOT = ARM_BY_ID.get('bottom-tie-first');

const mon = (species, item, ability, moves) => ({ species, item, ability, moves });

/* ---- DERIVATIONS. Nothing below is a typed species key. ------------------------------------------ */
const params = (ns, id) => ((TAGS[ns] || {})[id] || {}).params || {};
const movesWith = f => Object.keys(TAGS.moves || {}).filter(m => f(params('moves', m), m));

/* the fastest legal carrier of a move, so the fixture's turn order is a derived fact */
function fastestCarrier(moveId, reject) {
  let best = null;
  for (const n of CS.moveCarriers(moveId)) {
    const sp = DEX.species.get(n);
    if (!legal(sp) || sp.battleOnly || sp.isMega || sp.requiredItem) continue;
    if (reject && reject(sp)) continue;
    if (!best || sp.baseStats.spe > best.baseStats.spe) best = sp;
  }
  return best;
}
/* N legal bodies with PAIRWISE DISTINCT base Speed, so no fixture in this file can be decided by a
 * speed tie — the two engines are only guaranteed to agree on a tie under some arms, and a tie in an
 * idle slot would part every stream before the thing being measured ever happens. `reject` keeps the
 * follower families out of the bare perish board. */
function distinctSpeeds(n, reject) {
  const seen = new Set(), out = [];
  for (const sp of DEX.species.all()) {
    if (!legal(sp) || sp.baseStats.hp < 90) continue;
    /* NO `battleOnly` FORME MAY BE A FILLER. A mega on a sheet is displayed by the authority as
     * `Clefable-Mega` and rebuilt here as its base, so a bench body that is one parts both streams on
     * its replacement `|switch|` line — a fixture defect that reads exactly like a mechanic. */
    if (sp.battleOnly || sp.isMega || sp.requiredItem) continue;
    if (reject && reject(sp)) continue;
    if (seen.has(sp.baseStats.spe)) continue;
    seen.add(sp.baseStats.spe); out.push(sp);
    if (out.length >= n) break;
  }
  return out;
}
/* a legal body with a named ability, for the follower sweep */
function carrierOfAbility(abId, reject) {
  for (const sp of DEX.species.all()) {
    if (!legal(sp) || sp.battleOnly || sp.isMega || sp.requiredItem) continue;
    if (reject && reject(sp)) continue;
    if (Object.values(sp.abilities || {}).some(a => idOf(a) === abId)) return sp;
  }
  return null;
}

const MULTIACC = movesWith(p => p.multiHit && p.multiAccuracy);
const PARTIALTRAP = movesWith(p => p.partialTrap);

/* ---- the shared plumbing ------------------------------------------------------------------------ */
const REPORT = [];
function play(name, p1, p2, script, opts) {
  opts = opts || {};
  GD.resetScriptCounters();
  const a = buildPair(p1, { hpBoost: opts.hpA || 1 });
  const b = buildPair(p2, { hpBoost: opts.hpB || 1 });
  if (!a || !b || a.length < 2 || b.length < 2) return { name, staged: false };
  const r = playGame(a, b, 'upkeep-lines/' + name, 'upkeep-lines/' + name,
                     { script, arm: opts.arm || MID });
  const sc = GD.scriptCounters();
  return { name, staged: true, err: r.err || null, turns: r.turns,
           diverged: !!r.div, at: r.div ? r.div.index : null,
           sd: r.div ? r.div.sdRaw : null, me: r.div ? r.div.meRaw : null,
           sdLog: GD.lastSdLog(), meLog: (r.mediTrace || []).map(String),
           notOnRequest: sc.moveNotOnRequest, firstMissing: sc.firstMissing };
}
const grep = (log, re) => (log || []).filter(l => re.test(String(l)));
function verdict(r) {
  if (!r.staged) return 'COULD-NOT-STAGE';
  if (r.err) return 'THREW: ' + String(r.err).slice(0, 110);
  if (r.notOnRequest) return 'SCRIPT DID NOT RUN — ' + r.notOnRequest + ' click(s) not on the request: ' + r.firstMissing;
  return r.diverged ? '*** PARTS *** at reduced index ' + r.at : 'AGREES';
}
function show(label, expect, r, extra) {
  console.log('  ' + label.padEnd(52) + ' expect ' + String(expect).padEnd(12) + ' -> ' + verdict(r));
  if (extra) for (const line of extra) console.log('        ' + line);
  if (r.diverged) { console.log('        SD  ' + r.sd); console.log('        US  ' + r.me); }
  REPORT.push({ label, expect, got: verdict(r) });
}

console.log('');
console.log('probe_upkeep_lines — release ' + arg('--release', '?'));

/* ================================================================================================
 * ROW 3 — `|-hitcount|p2a|1`.  A VOLLEY THAT LANDS EXACTLY ONE ARRIVAL.
 *
 * Champions overrides the hit loop (data/mods/champions/scripts.ts:425-550). Its close is
 *
 *     if (hit === 1) return damage.fill(false);                                        :541
 *     this.battle.faintMessages(false, false, !pokemon.hp);                            :544
 *     if (move.multihit && typeof move.smartTarget !== 'boolean' && ...)               :545
 *         this.battle.add('-hitcount', targets[0], hit - 1);                           :550
 *
 * `hit` is one higher than the arrivals that landed, so a multiaccuracy move whose SECOND roll
 * misses leaves hit = 2 and the authority prints `|-hitcount|...|1`. Only a volley that landed
 * ZERO arrivals (hit === 1) returns above the line.
 *
 * TEST ARM  the middle arm, real per-hit accuracy: over enough clicks a volley stops at one hit.
 * CONTROL   the SAME fixture at the bottom corner, where every sub-100 roll HITS, so the volley is
 *           always full. One knob — the dice — and nothing else moves.
 * ============================================================================================== */
function armHitcount() {
  console.log('');
  console.log('ROW 3 — |-hitcount| on a volley that landed exactly one arrival');
  if (!MULTIACC.length) { console.log('  COULD-NOT-STAGE — no legal multiHit+multiAccuracy move in this regulation.'); return; }
  const MV = MULTIACC.sort((a, b) => (params('moves', b).multiHit.hits || 0) - (params('moves', a).multiHit.hits || 0))[0];
  const P = params('moves', MV);
  const att = fastestCarrier(MV);
  if (!att) { console.log('  COULD-NOT-STAGE — no legal carrier of ' + MV); return; }
  /* the three idle slots have pairwise-distinct Speed AND differ from the attacker's, so nothing in
   * this fixture is decided by a tie. The defender is HP-boosted so the volley cannot end the game. */
  const F = distinctSpeeds(4, s => s.baseStats.spe === att.baseStats.spe);
  if (F.length < 3) { console.log('  COULD-NOT-STAGE — cannot find three tie-free idle bodies.'); return; }
  console.log('  move     ' + MV + '   hits ' + P.multiHit.hits + '  per-hit accuracy ' + P.multiAccuracy.accuracy
    + '   (derived: multiHit + multiAccuracy)');
  console.log('  attacker ' + att.name + ' spe ' + att.baseStats.spe
    + '   idle bodies ' + F.slice(0, 3).map(s => s.name + '/' + s.baseStats.spe).join(' '));
  const fill = i => mon(F[i].id, '', Object.values(F[i].abilities)[0], ['Agility']);
  const p1 = [mon(att.id, '', Object.values(att.abilities)[0], [DEX.moves.get(MV).name, 'Agility']),
              fill(0), fill(1), fill(2)];
  const p2 = [fill(1), fill(2), fill(0), fill(1)];
  const TURNS = +arg('--hit-turns', 12);
  const script = [];
  for (let t = 0; t < TURNS; t++)
    script.push({ p1: [{ m: MV, t: 0 }, { m: 'agility' }], p2: [{ m: 'agility' }, { m: 'agility' }] });
  const counts = log => {
    const m = {};
    for (const l of grep(log, /^\|-hitcount\|/)) { const n = String(l).split('|').pop(); m[n] = (m[n] || 0) + 1; }
    return m;
  };
  const fmt = m => Object.keys(m).sort().map(k => k + ' x' + m[k]).join('  ') || '(none)';
  /* THE EXPECTATION IS THE AUTHORITY'S BEHAVIOUR, NOT THIS ENGINE'S. It read `PARTS` while the
   * defect was being diagnosed, which is a probe that PINS THE BUG; flipped to AGREES on 2026-08-27
   * so the file is RED until the single-arrival `-hitcount` line is emitted and GREEN after. */
  for (const [name, armId, expect] of [['A TEST     real per-hit dice', 'middle', 'AGREES'],
                                       ['B CONTROL  bottom corner, every roll hits', 'bottom-tie-first', 'AGREES']]) {
    const r = play('hitcount-' + armId, p1, p2, script, { hpA: 6, hpB: 14, arm: ARM_BY_ID.get(armId) });
    const cs = r.staged ? counts(r.sdLog) : {}, cm = r.staged ? counts(r.meLog) : {};
    show(name, expect, r, ['showdown -hitcount: ' + fmt(cs), 'medicham -hitcount: ' + fmt(cm)]);
  }
}

/* ================================================================================================
 * ROW 2 — `|-end|POKEMON|MOVE|[partiallytrapped]|[silent]` WHEN THE TRAPPER LEAVES.
 *
 * data/conditions.ts:222-248, `partiallytrapped`, read whole. Champions does NOT override it
 * (data/mods/champions/conditions.ts carries no `partiallytrapped` key).
 *
 *     onResidualOrder: 13,
 *     onResidual(pokemon) {
 *       const source = this.effectState.source;
 *       if (source && (!source.isActive || source.hp <= 0 || !source.activeTurns) && !gmaxEffect) {
 *         delete pokemon.volatiles['partiallytrapped'];
 *         this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]', '[silent]');
 *         return;
 *       }
 *       this.damage(...);
 *     }
 *     onEnd(pokemon) { this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]'); }
 *
 * `[silent]` is stripped by the differential's own reducer (game_differential.js:2023-2027), so the
 * two lines compare identically and this arm is measuring the EMISSION, not the tag.
 *
 * TEST ARM  the trapper switches out the turn after it lands the trap.
 * CONTROL   the trapper stays in. Same board, same move, one knob.
 * ============================================================================================== */
function armTrap() {
  console.log('');
  console.log('ROW 2 — the partial trap ending because its source left the field');
  if (!PARTIALTRAP.length) { console.log('  COULD-NOT-STAGE — no legal partialTrap move in this regulation.'); return; }
  const ends = log => grep(log, /^\|-end\|.*partiallytrapped/).map(l => String(l).replace(/\|\[silent\]$/, ''));
  /* EVERY partialTrap MOVE WITH A LEGAL CARRIER IS STAGED, not one chosen by hand — the row names
   * Infestation and the mechanism is the condition, so a single move would leave open whether the
   * other six behave differently. */
  let ran = 0;
  for (const MV of PARTIALTRAP.sort()) {
    const att = fastestCarrier(MV);
    if (!att) { console.log('  ' + ('A TEST     ' + MV).padEnd(52) + ' COULD-NOT-STAGE — no legal carrier'); continue; }
    const F = distinctSpeeds(4, s => s.baseStats.spe === att.baseStats.spe);
    if (F.length < 4) { console.log('  COULD-NOT-STAGE — cannot find four tie-free bodies.'); return; }
    const fill = i => mon(F[i].id, '', Object.values(F[i].abilities)[0], ['Agility']);
    const p1 = [mon(att.id, '', Object.values(att.abilities)[0], [DEX.moves.get(MV).name, 'Agility']),
                fill(0), fill(3), fill(3)];
    const p2 = [fill(1), fill(2), fill(0), fill(1)];
    const base = { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'agility' }, { m: 'agility' }] };
    const land = { p1: [{ m: MV, t: 0 }, { m: 'agility' }], p2: [{ m: 'agility' }, { m: 'agility' }] };
    const leave = { p1: [{ sw: F[3].id }, { m: 'agility' }], p2: [{ m: 'agility' }, { m: 'agility' }] };
    if (!ran++) console.log('  idle bodies ' + F.map(s => s.name + '/' + s.baseStats.spe).join(' '));
    const arms = [
      /* AGREES, not PARTS — see the hitcount arm's note. The expectation is the authority's
       * behaviour, so this file is RED until the source-gone branch announces its `-end`. */
      ['A TEST     ' + MV + ' — trapper LEAVES next turn', [land, leave, base, base], 'AGREES'],
      ['B CONTROL  ' + MV + ' — trapper stays in', [land, base, base, base], 'AGREES'],
    ];
    for (const [name, script, expect] of arms) {
      const r = play('trap-' + MV + name.slice(0, 1), p1, p2, script, { hpA: 4, hpB: 4 });
      /* DID THE TRAP EVER LAND? `partiallytrapped.onStart` writes `-activate|TARGET|move: NAME`, so
       * this is the authority's own receipt. Without it the arm staged NOTHING and an AGREES would
       * be the fixture, not the engine — this file's whole job is to refuse that reading. */
      /* the authority's own line is `|-activate|TARGET|move: NAME|[of] SOURCE`, so the name is
       * followed by a pipe OR by the end of the line — anchoring on `$` alone reads every real
       * staging as a failure, which is the same silent-default shape in the opposite direction. */
      const landed = r.staged && grep(r.sdLog, new RegExp('^\\|-activate\\|.*move: '
        + DEX.moves.get(MV).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\||$)')).length;
      show(name, landed ? expect : 'NOT-STAGED', r,
           r.staged ? ['trap landed in the authority: ' + (landed ? 'yes' : 'NO — the move missed or failed'),
                       'showdown -end: ' + (ends(r.sdLog).join(' ; ') || '(none)'),
                       'medicham -end: ' + (ends(r.meLog).join(' ; ') || '(none)')] : null);
    }
  }
}

/* ================================================================================================
 * ROW 1 — `|upkeep <> |faint|p2b`.  WHERE A PERISH DEATH IS ANNOUNCED.
 *
 * sim/battle.ts, `case 'residual'`: `this.fieldEvent('Residual'); if (!this.ended) this.add('upkeep')`
 * at :2813-2814, and `this.faintMessages()` EIGHTEEN LINES BELOW at :2832. Inside `fieldEvent`, a
 * handler whose duration reaches zero calls `handler.end(...)` and `continue`s (:514-524), SKIPPING
 * the `this.faintMessages()` at :565. So a perish death is announced above `|upkeep|` only when some
 * later handler in the same walk does NOT itself expire.
 *
 * medicham2 models that with `residualFollowerRuns()` and drains at one of two sites. This arm asks
 * whether the predicate over-fires: the BARE board must read `perish0 | upkeep | faint`, and each
 * follower family must read `perish0 | faint | upkeep` IN BOTH ENGINES.
 * ============================================================================================== */
function armPerish() {
  console.log('');
  console.log('ROW 1 — a perish death announced above or below |upkeep|');
  const M = require('../engine/medicham2-browser.js');
  const rep = M.residualFollowerReport();
  const PS = fastestCarrier('perishsong');
  if (!PS) { console.log('  COULD-NOT-STAGE — no legal Perish Song carrier.'); return; }
  /* the bare board must carry NOTHING from the follower families: no handler ability, no White Herb,
   * no screen, no terrain, no Protect (its `stall` volatile survives its first residual). */
  const handlerSet = new Set(rep.handlers);
  const F = distinctSpeeds(3, s => Object.values(s.abilities || {}).some(a => handlerSet.has(idOf(a)))
                                || s.baseStats.spe === PS.baseStats.spe);
  if (F.length < 3) { console.log('  COULD-NOT-STAGE — no three tie-free bodies free of every follower ability.'); return; }
  console.log('  perish carrier ' + PS.name + ' spe ' + PS.baseStats.spe
    + '   clean idle bodies ' + F.map(s => s.name + '/' + s.baseStats.spe).join(' '));
  console.log('  follower families: ' + rep.handlers.length + ' handlers, ' + rep.clocks.length
    + ' clocks, ' + rep.alwaysExpires.length + ' always-expire' + (rep.unmapped ? '   UNMAPPED: ' + rep.unmapped : ''));
  const fill = i => mon(F[i].id, '', Object.values(F[i].abilities)[0], ['Agility']);
  const p1 = [mon(PS.id, '', Object.values(PS.abilities)[0], ['Perish Song', 'Agility']),
              fill(0), fill(1), fill(2)];

  /* PERISH SONG SETS `perish3` AT THE CLICK AND THE VOLATILE'S DURATION IS 4, so the clock reads
   * perish3/2/1/0 at the residuals of the CAST TURN and the three after it. Script step 3 is
   * therefore the turn whose residual kills, and a follower has to be standing during THAT walk. */
  const KILL_TURN = 3;
  function runPerish(name, lead, expect, followerClick) {
    const p2 = [lead, fill(2), fill(0), fill(1)];
    const script = [{ p1: [{ m: 'perishsong' }, { m: 'agility' }], p2: [{ m: 'agility' }, { m: 'agility' }] }];
    for (let t = 0; t < 5; t++)
      script.push({ p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'agility' }, { m: 'agility' }] });
    if (followerClick) script[KILL_TURN].p2[0] = followerClick;
    const r = play('perish-' + name.slice(0, 14), p1, p2, script, { hpA: 1, hpB: 1 });
    /* THE WINDOW IS THE THING BEING MEASURED, printed for BOTH streams whether or not they parted —
     * an AGREES with no perish0 in it is a fixture that never reached the mechanic. */
    const win = log => {
      const out = [], L = (log || []).map(String);
      const i = L.findIndex(l => /^\|-start\|.*\|perish0/.test(l));
      if (i < 0) return '(NO perish0 IN THIS STREAM — the fixture never reached the clock)';
      for (let k = i; k < Math.min(L.length, i + 14); k++)
        if (/^\|(-start\|.*perish0|upkeep|faint)/.test(L[k])) out.push(L[k].replace(/: [^|]*/g, ''));
      return out.join('  ');
    };
    const reached = r.staged && /perish0/.test(String(r.sdLog));
    show(name, reached ? expect : 'NOT-STAGED', r,
         r.staged ? ['SD  ' + win(r.sdLog), 'US  ' + win(r.meLog)] : null);
  }

  runPerish('A TEST     bare board, no follower at all', fill(1), 'AGREES');

  /* THE OVER-FIRE SWEEP. One arm per handler-family ability that has a legal carrier: the follower is
   * PRESENT, so both engines must announce the faint ABOVE `|upkeep|`. A member where they disagree
   * is a `residualFollowerRuns` member the authority does not actually run — which is the only way
   * the pool row can be produced, since the bare board is already right. */
  const taken = new Set([PS.baseStats.spe, ...F.map(s => s.baseStats.spe)]);
  for (const ab of rep.handlers) {
    /* the family is `route: 'handler'` and holds BOTH abilities and items (White Herb is the item),
     * so the member is placed on whichever slot the dex says it belongs in — never guessed. */
    const it = DEX.items.get(ab);
    if (legal(it)) { runPerish('C follower item ' + ab, mon(F[1].id, it.name, Object.values(F[1].abilities)[0], ['Agility']), 'AGREES'); continue; }
    const sp = carrierOfAbility(ab, s => taken.has(s.baseStats.spe));
    if (!sp) { console.log('  ' + ('C follower ' + ab).padEnd(52) + ' COULD-NOT-STAGE — no tie-free legal carrier'); continue; }
    const abName = Object.values(sp.abilities).find(a => idOf(a) === ab);
    runPerish('C follower ' + ab, mon(sp.id, '', abName, ['Agility']), 'AGREES');
  }

  /* THE CLOCK FAMILY. A `clocks` member is a duration this engine has a reader for; the authority
   * runs its handler, finds the duration SURVIVED the decrement, and therefore reaches :565 and pays
   * the faint queue. The member is staged by CLICKING IT on the kill turn — and the move is found by
   * asking the dex whether a legal move shares the clock's id, never by naming one. Members with no
   * same-named move (`stall`, `mustrecharge`, `lockedmove`, `twoturnmove`) are PRINTED as unswept
   * rather than passed over. */
  const unswept = [];
  for (const c of rep.clocks) {
    const id = c.split(':')[1];
    const mv = DEX.moves.get(id);
    if (!legal(mv)) { unswept.push(c); continue; }
    const sp = fastestCarrier(id, s => taken.has(s.baseStats.spe));
    if (!sp) { console.log('  ' + ('D clock ' + c).padEnd(52) + ' COULD-NOT-STAGE — no tie-free legal carrier'); continue; }
    runPerish('D clock ' + c, mon(sp.id, '', Object.values(sp.abilities)[0], [mv.name, 'Agility']),
              'AGREES', { m: id, t: 0 });
  }
  if (unswept.length) console.log('  D clock UNSWEPT (no same-named legal move): ' + unswept.join(', '));

  /* ---- `volatile:stall`, THE ONE UNSWEPT CLOCK THE POOL IS FULL OF -------------------------------
   *
   * Protect's `stall` is a duration-2 volatile that SURVIVES the residual it was raised on, so it is
   * a follower — but only when the shield actually went up. `protect.onPrepareHit` is
   * `return !!this.queue.willAct() && this.runEvent('StallMove', pokemon)`, so a Protect clicked by
   * the LAST body still to act FAILS and no `stall` is added at all. If this engine marks the clock
   * fresh on a refused shield it gains a follower the authority does not have, and the perish faint
   * moves above `|upkeep|` on exactly the boards the pinned pool is made of.
   *
   * ONE KNOB: WHERE THE SHIELD SITS IN THE SPEED ORDER. Same body class, same click, same turn. */
  const others = [PS.baseStats.spe, F[0].baseStats.spe, F[2].baseStats.spe];
  const pool = DEX.species.all().filter(legal)
    .filter(s => !s.battleOnly && !s.isMega && !s.requiredItem && s.baseStats.hp >= 90)
    .filter(s => !taken.has(s.baseStats.spe))
    .filter(s => CS.moveCarriers('protect').includes(s.name));
  /* THE ONLY THING THAT DECIDES `willAct()` IS WHETHER ANY BODY STILL HAS AN ACTION QUEUED BELOW
   * THIS ONE, so the two ends are "slower than every other active" and "faster than at least one". */
  const slow = pool.filter(s => s.baseStats.spe < Math.min(...others)).sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
  const fast = pool.filter(s => s.baseStats.spe > Math.min(...others)).sort((a, b) => a.baseStats.spe - b.baseStats.spe)[0];
  if (!slow || !fast) { console.log('  E stall  COULD-NOT-STAGE — no tie-free Protect carrier at both ends of the order.'); }
  else {
    console.log('  E stall  last-to-act ' + slow.name + '/' + slow.baseStats.spe
      + '   not-last ' + fast.name + '/' + fast.baseStats.spe
      + '   other actives ' + others.join(','));
    runPerish('E CONTROL  Protect with a body still to act after it',
              mon(fast.id, '', Object.values(fast.abilities)[0], ['Protect', 'Agility']), 'AGREES', { m: 'protect' });
    runPerish('E TEST     Protect from the LAST body to act (it fails)',
              mon(slow.id, '', Object.values(slow.abilities)[0], ['Protect', 'Agility']), 'AGREES', { m: 'protect' });
  }
}

if (!ONLY || ONLY === 'hitcount') armHitcount();
if (!ONLY || ONLY === 'trap') armTrap();
if (!ONLY || ONLY === 'perish') armPerish();

console.log('');
/* the summary compares the CANONICAL verdict, not the printed one — `*** PARTS *** at index 29` and
 * `PARTS` are the same answer and a string compare would report every expected part as a surprise. */
const canon = s => /^\*\*\* PARTS/.test(s) ? 'PARTS' : s;
const bad = REPORT.filter(r => canon(r.got) !== r.expect && !/COULD-NOT-STAGE/.test(r.got));
console.log('  ' + REPORT.length + ' arms, ' + bad.length + ' not as expected');
for (const b of bad) console.log('    ' + b.label + '  expected ' + b.expect + ' got ' + b.got);
console.log('');
/* AN EXIT CODE, ADDED 2026-08-27. The file printed its verdict and always exited 0, so `&& GREEN`
 * around it was meaningless. Run it per-arm (`--only hitcount` / `--only trap`): the whole-file run
 * is red on the PERISH arm's five incidental parts, which are other rows' open defects (Uproar@28
 * between two perish0 lines, and the Intimidate order on a double replacement) and are NOT this
 * file's subject. Those are recorded in docs/_reports/2026-08-27-upkeep-lines.md. */
process.exit(bad.length ? 1 : 0);
