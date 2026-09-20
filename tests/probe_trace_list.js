/* probe_trace_list.js — DO THE TWO ENGINES BUILD THE SAME `possibleTargets`, ELEMENT BY ELEMENT?
 *
 *   SHOWDOWN_PATH=... node tests/probe_trace_list.js [--release <id>] [--cells 400]
 *
 * ================= WHY A THIRD TRACE FILE ========================================================
 *
 * `tests/probe_trace_choice.js` proves the choice is a DIE and that this engine reads it.
 * `tests/probe_trace_target.js` proves a QUEUE TIE was moving the authority's draw ADDRESS.
 * Both compare ONE OUTPUT — the ability that got copied — and an output can be wrong for two
 * completely different reasons:
 *
 *     the DIE     drew a different index into the same list
 *     the LIST    was a different list, so an identical index names a different body
 *
 * Nothing in either protocol stream carries the list. `|-ability|HOLDER|Levitate|[from] ability:
 * Trace|[of] FOE` names the winner and the loser is invisible, so a divergence report can never say
 * which of the two happened. THIS FILE READS BOTH LISTS AT THE MOMENT OF THE DRAW and compares them
 * position by position.
 *
 * ================= WHAT THE AUTHORITY'S LIST IS, DERIVED RATHER THAN ASSUMED =====================
 *
 * `data/mods/champions/abilities.ts` carries no `trace` row, so Champions inherits mainline
 * (`data/abilities.ts`, the whole block read):
 *
 *     onUpdate(pokemon) {
 *       if (!this.effectState.seek) return;
 *       const possibleTargets = pokemon.adjacentFoes().filter(
 *         target => !target.getAbility().flags['notrace'] && target.ability !== 'noability');
 *       if (!possibleTargets.length) return;
 *       const target = this.sample(possibleTargets);
 *
 * and `adjacentFoes()` (`sim/pokemon.ts:732`) is, for `activePerHalf <= 2` — which doubles is —
 * `this.side.foes()` with NO adjacency filter at all; `Side#foes` (`sim/side.ts:395`) is
 * `this.foe.allies()`, and `Side#allies` (`:388`) is `activeTeam().filter(a => a).filter(a => !!a.hp)`.
 * So: the opposing side's `active` array, IN SLOT ORDER, minus empty slots, minus fainted bodies.
 *
 * ================= HOW EACH SIDE IS READ ========================================================
 *
 * AUTHORITY. `Battle#sample` is wrapped and the call is claimed only when `battle.effect.id ===
 * 'trace'`, so no other sampler is caught. The wrapper calls through and returns the original value —
 * it draws nothing of its own, which the CONTROL below asserts by playing every board twice.
 *
 * MEDICHAM. Through `traceListSink`, the engine's own door, which hands out the array `traceCopy`
 * actually built. It is NOT re-derived here: a probe that rebuilt the list from the board would be
 * testing its own copy of the rule, which is the failure this repository has paid for repeatedly.
 *
 * ================= WHAT IT REFUSES =============================================================
 *
 *   - a game where either engine never reached a Trace draw (nothing to compare, COUNTED and named);
 *   - a comparison after the two games have already parted, because two different boards trivially
 *     produce two different lists and that says nothing about the rule. The cutoff is the first turn
 *     at which the two protocol streams disagree, read off `playGame`'s own record.
 *   - the CHOICE clause, on any cell whose list is shorter than 2 — with one candidate there is no
 *     choice to get wrong and an agreement proves nothing. The MEMBERSHIP and ORDER clauses still
 *     apply at length 1, because a one-element list can name the wrong body.
 *
 * ================= THE CONTROL, AND WHY THE OBVIOUS ONE IS WRONG ================================
 *
 * The first version of this file played each board twice in the same process — hooked, then unhooked —
 * and reported 23 of 40 boards "perturbed by the hooks". THAT NUMBER WAS THE INSTRUMENT. The driver's
 * coverage-seeking steering (`COV_CREDIT`) is module state that every game mutates, so replaying the
 * same pair a moment later is a DIFFERENT GAME whether or not anything is hooked. A control that
 * cannot separate its variable from the thing it measures reports the thing it measures.
 *
 * SO THE CONTROL IS A CHILD PROCESS. The parent plays the whole sweep hooked; the child (`--no-hooks`)
 * plays the identical sweep, in the identical order, from a FRESH module state, so its steering
 * evolves through exactly the same sequence. Each side prints a per-board digest of both protocol
 * streams and the parent compares them. Drift is now common to both arms and cancels; a hook that
 * touched the game does not. It can fail: deliberately making the authority wrapper return its own
 * draw instead of calling through moves the digests apart on the first board that reaches a die.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const argv = process.argv.slice(2);
/* `--cells 60` AND `--cells=60` BOTH, and the second spelling is what makes this row runnable —
 * 2026-08-28. `engine/register_reality.js`'s SAFE marker grammar admits flags and REFUSES a bare
 * value, deliberately: widening it for bare values would also admit `tests/roster.js --stage moves`
 * and `engine/game_differential.js --team-store …`, multi-minute runs that rewrite artifacts other
 * readers hold. So the marker is spelled with `=` and the parser learns the spelling, rather than the
 * gate learning to accept everything. */
const flag = (n, d) => {
  const eq = argv.find(a => a.startsWith(n + '='));
  if (eq) return eq.slice(n.length + 1);
  const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d;
};
const CELLS = Math.max(1, +flag('--cells', 300));
const STORE = flag('--team-store', 'data/team-pool-frozen');
const NO_HOOKS = argv.includes('--no-hooks');   // the control child; see the header

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const SW = require(D('engine', 'diff_swarm.js'));
const M = G.REL.require('engine/medicham2-browser.js');
if (typeof M.traceListSink !== 'function') {
  console.log('NOT RUN — the frozen engine has no traceListSink door. Cut a release that carries it.');
  process.exit(2);
}
const { Battle, Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE AUTHORITY HOOK ----------------------------------------------------------------------- */
let SD = [];
let HOOKED = false;
/* HOW OFTEN THE AUTHORITY SAMPLED A ONE-ELEMENT LIST. `PRNG#sample` is `items[this.random(items.length)]`
 * and `PRNG#random` calls `this.rng.next()` UNCONDITIONALLY, so a list of one still COSTS A DRAW. This
 * counter exists because a draw that changes no outcome still moves every later address in the turn. */
let SD_SAMPLED_LEN1 = 0;
const sdKey = p => (p && p.side ? p.side.id : '?') + '[' + (p ? p.position : '?') + ']:'
  + norm(p && p.species && p.species.id) + ':' + norm(p && p.ability);
/* ---- THE FOREIGN DEFECT THIS FIXTURE MUST NOT ABSORB -------------------------------------------
 *
 * `Battle#getRandomTarget` -> `Side#randomFoe` -> `sample()` is a draw the authority takes for a move
 * whose target is chosen at random, and it takes it up to FIVE times in one turn (commitChoices,
 * getActionSpeed twice, runMove). medicham2 takes none of them; that is a separate, already-filed
 * defect — the random-target address row — and it is NOT Trace.
 *
 * It lands in the SAME address bucket as Trace — `seed|turn|any|-|-` — so on a turn where it fires,
 * Trace's `nth` is shifted for a reason that has nothing to do with this file. A fixture that
 * qualifies for two reasons proves nothing, so every turn it touches is REFUSED BY NAME and counted.
 * The hook is on the authority's own entry point rather than on a list of moves, so a move added
 * later is picked up without editing this file. */
const SD_RT_TURNS = new Set();
let SD_RT_DRAWS = 0;
const origGetRandomTarget = Battle.prototype.getRandomTarget;
const origSample = Battle.prototype.sample;
function hookAuthority(on) {
  Battle.prototype.getRandomTarget = on ? function (...a) {
    if (HOOKED) { SD_RT_TURNS.add(this.turn); SD_RT_DRAWS++; }
    return origGetRandomTarget.apply(this, a);
  } : origGetRandomTarget;
  Battle.prototype.sample = on ? function (items) {
    const r = origSample.call(this, items);
    try {
      if (HOOKED && this.effect && this.effect.id === 'trace' && Array.isArray(items)) {
        const holder = this.effectState && this.effectState.target;
        if (items.length === 1) SD_SAMPLED_LEN1++;
        SD.push({
          holder: holder ? sdKey(holder) : '?',
          holderSlot: holder ? (holder.side.id + '[' + holder.position + ']') : '?',
          turn: this.turn,
          list: items.map(sdKey),
          index: items.indexOf(r),
          chosen: sdKey(r),
          /* 2026-09-20 — THE ADDRESS THE MIDDLE ARM JUST USED. `midDraw` pushes it before `sample`
           * returns, so the last entry is this draw's. The staged arm below compares it against
           * medicham2's, because the ADDRESS is deterministic where the copied body is a coin. */
          addr: (G.midAddresses().sd.slice(-1)[0]) || null,
        });
      }
    } catch (e) { SD.push({ holder: 'HOOK-THREW', err: String((e && e.message) || e), list: [], index: -1 }); }
    return r;
  } : origSample;
}

/* ---- THE MEDICHAM HOOK, THROUGH THE ENGINE'S OWN DOOR ----------------------------------------- */
let ME = [];
function meKey(x) {
  if (!x) return '?';
  const sf = x._sf, S = sf && sf._S;
  let side = '?', pos = '?';
  if (S) {
    let i = S.actA ? S.actA.indexOf(x) : -1;
    if (i >= 0) { side = 'p1'; pos = i; }
    else { i = S.actB ? S.actB.indexOf(x) : -1; if (i >= 0) { side = 'p2'; pos = i; } }
  }
  return side + '[' + pos + ']:' + norm(x.species || x.name) + ':' + norm(x.ability);
}
const meSlot = x => { const k = meKey(x); return k.slice(0, k.indexOf(':')); };
function installMe(on) {
  M.traceListSink(on ? rec => {
    const S = rec.holder && rec.holder._sf && rec.holder._sf._S;
    ME.push({
      holder: meKey(rec.holder), holderSlot: meSlot(rec.holder),
      turn: S ? (S.turn === undefined ? -1 : S.turn) : -1,
      offered: (rec.offered || []).map(meKey),
      list: (rec.eligible || []).map(meKey),
      index: rec.index, chosen: rec.chosen ? meKey(rec.chosen) : null,
    });
  } : null);
}

/* ================================================================================================
 * THE STAGED ARM — 2026-09-20. ONE BOARD, NO SEARCH, AND IT ASSERTS THE ADDRESS RATHER THAN THE WINNER.
 *
 * The sweep above found this defect at a rate of **1 joined draw in 2,442**, and a probe that needs
 * 2,442 trials to go red is a probe that will be believed when it is silent. This arm reproduces the
 * same cause on ONE deliberately built board, in one turn, with nothing random left in the verdict.
 *
 * THE CAUSE, MEASURED (`engine/game_differential.js`'s own `midAddresses()`, not a hypothesis):
 *
 *     showdown   <seed>|6|any|-|-|0        <- the pivot's switch is a SEPARATE queued action, and
 *     medicham2  <seed>|6|any|uturn|p20|0     `runAction` ran `clearActiveMove()` long before the
 *                                             entrant's `runSwitch` reached Trace's `onUpdate`
 *
 * One die, two addresses. The middle arm's streams are keyed on that string, so the two engines drew
 * DIFFERENT VALUES for the same event and copied different bodies. Nothing in the protocol shows it.
 *
 * WHY THE ADDRESS AND NOT THE COPIED BODY. Whether a mis-addressed draw actually lands on a different
 * index is a coin: over a two-element list it flips about half the time, which is precisely why the
 * sweep needed 2,442 draws to see one. The ADDRESS is deterministic, so this arm asserts THAT — the
 * two engines must name the same event — and reports the copied body beside it as corroboration.
 *
 * THE ARMS. Two children, because the knob is read at module load:
 *   clean  MEDI_PIVOT_ENTRY_MOVE_ADDR unset — the two addresses must be IDENTICAL and carry `-|-`.
 *   knob   MEDI_PIVOT_ENTRY_MOVE_ADDR=1     — medicham's address must carry the PIVOT MOVE and so
 *                                             must DIFFER from the authority's. An identical result
 *                                             across a varied knob means the knob is unwired.
 * Each child also returns `MEDFAILS.pivotEntryMoveAddrRestored` and `MEDSEEN.pivotEntryAddrCleared`,
 * so "the knob changed nothing" and "the knob reached no code" cannot read the same.
 * ============================================================================================== */
const STAGED_CHILD = process.env.ABRA_TRACE_STAGED === '1';
const legalX = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* A THROW HERE IS A FACT ABOUT THE VALIDATOR, NOT A 'NO'. Swallowing it would make a species
 * look unable to learn a move it can, which is how a fixture goes quietly unstageable. Counted
 * and printed; the count is asserted below, so a validator that starts throwing cannot pass. */
let CANL_THREW = 0;
const canL = (sp, mv) => {
  try { return !!CS.canLearn(sp, mv); }
  catch (e) {
    CANL_THREW++;
    console.error('  canLearn THREW for ' + sp + ' / ' + mv + ' — counted, not hidden: ' + e.message);
    return false;
  }
};
function stagedBoard() {
  const POOL = DEX.species.all().filter(s => legalX(s) && !/mega/i.test(s.forme || ''));
  /* THE PIVOT MOVE: a self-switch move aimed at a foe, read off the format rather than named. */
  const PIVOTS = DEX.moves.all().filter(m => m.exists && !m.isNonstandard && m.selfSwitch
    && m.target === 'normal').sort((a, b) => a.id.localeCompare(b.id));
  /* THE TRACE CARRIER: read off the format's ability table. */
  const CARRIERS = POOL.filter(s => Object.values(s.abilities || {}).some(a => norm(a) === 'trace'));
  /* WHAT TRACE MAY COPY is Showdown's own `notrace` flag, asked of the format. */
  const copyable = s => Object.values(s.abilities || {})
    .filter(a => !((DEX.abilities.get(a).flags || {})['notrace'])).map(norm);
  /* THE FOES MUST NOT SHIELD. A Protecting foe makes the pivot FAIL, and a failed self-switch never
   * brings the Trace body in — a fixture that cannot stage the event says nothing about the rule.
   * So each foe clicks a SELF-TARGET Status move, derived per body: it reaches nobody, takes no
   * accuracy die and no damage roll, and leaves the turn with one `any` draw in it. */
  const QUIET = DEX.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
    && m.target === 'self' && !(m.flags && m.flags.heal) && !m.selfSwitch && !m.stallingMove
    && !m.secondaries && !m.volatileStatus).sort((a, b) => a.id.localeCompare(b.id));
  const quietFor = s => QUIET.find(q => canL(s.name, q.id)) || null;
  const refused = [];
  for (const pm of PIVOTS) {
    for (const car of CARRIERS) {
      const u = POOL.find(s => s.id !== car.id && canL(s.name, pm.id));
      if (!u) { refused.push(pm.name + ' / ' + car.name + ': no legal user of the pivot move'); continue; }
      const used = new Set([u.id, car.id]);
      const f0 = POOL.find(s => !used.has(s.id) && quietFor(s) && copyable(s).length);
      const f1 = f0 ? POOL.find(s => !used.has(s.id) && s.id !== f0.id && quietFor(s)
        && copyable(s).length && copyable(s)[0] !== copyable(f0)[0]) : null;
      if (!f0 || !f1) { refused.push(pm.name + ' / ' + car.name + ': no two foes with DISTINCT copyable abilities and a quiet click'); continue; }
      const spare = (taken) => POOL.find(s => !taken.includes(s.id) && quietFor(s));
      const mate = spare([u.id, car.id, f0.id, f1.id]);
      const fAlly = spare([u.id, car.id, f0.id, f1.id, mate && mate.id]);
      const bench = spare([u.id, car.id, f0.id, f1.id, mate && mate.id, fAlly && fAlly.id]);
      const bench2 = spare([u.id, car.id, f0.id, f1.id, mate && mate.id, fAlly && fAlly.id, bench && bench.id]);
      if (!mate || !fAlly || !bench || !bench2) { refused.push(pm.name + ' / ' + car.name + ': no quiet bench filler'); continue; }
      if (!quietFor(car)) { refused.push(pm.name + ' / ' + car.name + ': the carrier has no quiet click'); continue; }
      return { pm, u, car, f0, f1, mate, fAlly, bench, bench2, quietFor, refused };
    }
  }
  return { refused };
}
function runStaged() {
  const B = stagedBoard();
  if (!B.pm) { console.log('__STAGED__' + JSON.stringify({ staged: false, why: B.refused.slice(0, 4) })); return; }
  const firstCopyable = sp => Object.values(sp.abilities || {})
    .find(a => !((DEX.abilities.get(a).flags || {})['notrace'])) || Object.values(sp.abilities)[0];
  const mk = (sp, ab) => ({ species: sp.name, item: '', ability: ab || Object.values(sp.abilities)[0],
                            moves: [B.quietFor(sp).name] });
  /* `buildPair` REQUIRES FOUR BUILDABLE BODIES and returns null below that (`TEAMS_UNBUILDABLE`), so
   * both sheets are four long. The Trace carrier sits at bench slot 0; the probe does not assume the
   * replacement — it READS which body Traced, off both engines, and the verdict fails if they differ. */
  const A = [mk(B.f0, firstCopyable(B.f0)), mk(B.f1, firstCopyable(B.f1)), mk(B.fAlly), mk(B.bench)];
  const Bs = [{ species: B.u.name, item: '', ability: Object.values(B.u.abilities)[0], moves: [B.pm.name] },
              mk(B.mate), { species: B.car.name, item: '', ability: 'Trace', moves: [B.quietFor(B.car).name] },
              mk(B.bench2)];
  let sdAddr = null, sdList = null, sdChosen = null;
  let meAddr = null, meList = null, meChosen = null;
  hookAuthority(true); HOOKED = true; SD = [];
  const prevSink = M.traceListSink(rec => {
    if (meAddr) return;                                   // the FIRST Trace draw of the game
    meAddr = (M.midEventLog().slice(-1)[0]) || null;
    meList = (rec.eligible || []).map(meKey); meChosen = rec.chosen ? meKey(rec.chosen) : null;
  });
  const pa = G.buildPair(A), pb = G.buildPair(Bs);
  let r;
  try {
    r = G.playGame(pa, pb, 'directed', 'probe_trace_list :: staged pivot entry',
      { arm: G.ARM_BY_ID.get('middle'),
        script: [{ p1: [{ m: norm(B.quietFor(B.f0).id) }, { m: norm(B.quietFor(B.f1).id) }],
                   p2: [{ m: norm(B.pm.id), t: 0 }, { m: norm(B.quietFor(B.mate).id) }] }] });
  } catch (e) { r = { err: String((e && e.message) || e) }; }
  hookAuthority(false); HOOKED = false; M.traceListSink(prevSink);
  const AD = G.midAddresses();
  if (SD.length) { sdList = SD[0].list; sdChosen = SD[0].chosen; sdAddr = SD[0].addr || null; }
  const MF = M.MEDFAILS || {}, MS = M.MEDSEEN || {};
  console.log('__STAGED__' + JSON.stringify({
    staged: !!SD.length && !!meAddr, err: (r && r.err) ? String(r.err) : null,
    cast: B.u.name + ' [' + B.pm.name + '] -> ' + B.car.name + ' vs ' + B.f0.name + ' / ' + B.f1.name,
    sdAddr, meAddr, sdList, meList, sdChosen, meChosen,
    scriptMissed: G.scriptCounters().moveNotOnRequest,
    knobReached: Number(MF.pivotEntryMoveAddrRestored || 0),
    cleared: Number(MS.pivotEntryAddrCleared || 0),
    /* THE TURN-0 BUCKET IS NOT AN ADDRESS, IT IS A SEQUENCE: every draw taken before the first turn
     * carries `|0|any|-|-|<nth>` and there are hundreds of them. Only the draws from turn 1 on are
     * reported, which is where the pivot's entry is. */
    sdAny: AD.sd.filter(x => x.indexOf('|any|') >= 0 && !/^[^|]*\|0\|/.test(x)),
    meAny: AD.me.filter(x => x.indexOf('|any|') >= 0 && !/^[^|]*\|0\|/.test(x)),
  }));
}
if (STAGED_CHILD) { runStaged(); process.exit(0); }

/* ---- THE POOL. Teams carrying a body whose dex abilities include Trace, derived from the format. */
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const TRACERS = new Set(DEX.species.all().filter(legal)
  .filter(s => Object.values(s.abilities || {}).some(a => norm(a) === 'trace'))
  .map(s => norm(s.name)));
if (!TRACERS.size) { console.log('NOT-STAGED — the format has no Trace carrier.'); process.exit(1); }

const teams = SW.loadTeams({ storeDir: D(STORE) });
const hasTracer = t => (t.team || []).some(p => p && TRACERS.has(norm(p.species)));
const withTrace = teams.filter(hasTracer);
const without = teams.filter(t => !hasTracer(t));
console.log('DERIVED FROM THE FORMAT AND THE PINNED POOL (nothing below is typed):');
console.log('  Trace carriers in the format: ' + [...TRACERS].sort().join(', '));
console.log('  pool ' + teams.length + ' teams;  ' + withTrace.length + ' carry a Trace body, '
  + without.length + ' do not.');
if (!withTrace.length) { console.log('NOT-STAGED — the pinned pool holds no Trace body.'); process.exit(1); }

/* PAIRINGS. Half against a NON-carrier (one Trace on the field) and half against another CARRIER
 * (two, which is the shape the divergence report shows), so a defect that only appears in the mirror
 * cannot hide behind the commoner board. Both halves are counted and printed apart. */
const PAIRS = [];
for (let i = 0; i < withTrace.length && PAIRS.length < CELLS; i++) {
  const a = withTrace[i];
  const b = (i % 2 === 0) ? without[i % Math.max(without.length, 1)] : withTrace[(i + 1) % withTrace.length];
  if (!b || b === a) continue;
  PAIRS.push({ a, b, mirror: hasTracer(b) });
}

const ARM = G.ARM_BY_ID.get('middle');
const canon = ls => (ls || []).map(x => Array.isArray(x) ? x.join('|') : String(x)).join(NL);

let played = 0, noDraw = 0, threw = 0;
const cells = [];
const DIGESTS = [];
const h32 = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; return (h >>> 0).toString(16); };
if (!NO_HOOKS) { hookAuthority(true); installMe(true); HOOKED = true; }
for (const P of PAIRS) {
  const pa = G.buildPair(P.a.team), pb = G.buildPair(P.b.team);
  if (!pa || !pb) continue;
  const tag = (P.a.id || P.a.key) + ' vs ' + (P.b.id || P.b.key);
  SD = []; ME = []; SD_RT_TURNS.clear();
  let r1;
  try { r1 = G.playGame(pa, pb, 'probe-trace-list', tag, { arm: ARM }); }
  catch (e) { threw++; DIGESTS.push('THREW'); continue; }
  const sd1 = G.sdStream(G.lastSdLog()), me1 = (r1.mediTrace || []).slice();
  DIGESTS.push(h32(canon(sd1)) + '/' + h32(canon(me1)));
  const sdRec = SD.slice(), meRec = ME.slice();
  played++;
  if (!sdRec.length && !meRec.filter(x => x.chosen).length) { noDraw++; continue; }
  cells.push({ tag, mirror: P.mirror, divTurn: (r1.div && r1.div.turn !== undefined) ? r1.div.turn : null,
               divIndex: r1.div ? r1.div.index : null, sd: sdRec, me: meRec, turns: r1.turns,
               rtTurns: new Set(SD_RT_TURNS) });
}
if (!NO_HOOKS) { hookAuthority(false); installMe(false); HOOKED = false; }
/* THE CONTROL CHILD prints only this and exits; the parent reads it. */
if (NO_HOOKS) { console.log('CONTROL-DIGESTS ' + DIGESTS.join(' ')); process.exit(0); }

console.log(NL + 'PLAYED ' + played + ' board(s) (' + PAIRS.length + ' offered, ' + threw
  + ' threw, ' + noDraw + ' reached no Trace draw).');

/* ---- THE CONTROL CLAUSE — a child process replaying the identical sweep with no hooks ---------- */
let bad = 0;
{
  const { spawnSync } = require('child_process');
  /* THE CHILD INHERITS THE PARENT NODE FLAGS — 2026-08-28. Without this, a parent started with
   * `-r ./tests/_live_release.js` was redirected and its child was NOT: the child re-required
   * engine/game_differential.js with no --release, which CUTS A REAL RELEASE at require time and
   * REPOINTS data/engine-release.json under whatever else is measuring. Measured, not argued: a
   * redirected cut was shown NOT to touch data/engine-release.json, so every real cut seen during
   * a preloaded run came from here. process.execArgv is node OWN record of how this process was
   * started, so this reads the fact rather than re-deriving it. tests/probe_hazard_recap_fail.js
   * already did this by hand; this is the same fix at the four sites that did not. */
  const cp = spawnSync(process.execPath, [...process.execArgv, __filename, ...argv, '--no-hooks'],
    { env: { ...process.env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const line = String(cp.stdout || '').split(NL).find(l => l.startsWith('CONTROL-DIGESTS '));
  if (!line) {
    console.log('  FAIL — the unhooked control child printed no digest line (exit ' + cp.status
      + '). The control did not run, so "the hooks changed nothing" is unverified.');
    bad++;
  } else {
    const ctrl = line.slice('CONTROL-DIGESTS '.length).trim().split(/\s+/).filter(Boolean);
    const n = Math.min(ctrl.length, DIGESTS.length);
    let moved = 0;
    for (let i = 0; i < n; i++) if (ctrl[i] !== DIGESTS[i]) moved++;
    console.log('CONTROL   ' + n + ' board(s) replayed unhooked in a fresh process; '
      + moved + ' produced a different stream'
      + (ctrl.length !== DIGESTS.length ? '   [LENGTHS DIFFER ' + DIGESTS.length + ' vs ' + ctrl.length + ']' : ''));
    if (ctrl.length !== DIGESTS.length) {
      console.log('  FAIL — the two arms played different numbers of boards, so they are not the same sweep.');
      bad++;
    }
    if (moved) {
      console.log('  FAIL — ' + moved + ' board(s) played DIFFERENTLY with the hooks installed. The'
        + ' instrument is changing the game it measures and nothing below can be trusted.');
      bad++;
    }
  }
}
if (!cells.length) {
  console.log('NOT-STAGED — no board reached a Trace draw on either side, so nothing was compared.');
  process.exit(1);
}

/* ---- THE COMPARISON ---------------------------------------------------------------------------
 * Joined on (holder slot, occurrence for that slot). A holder's slot is stable within a game and the
 * k-th copy by that slot is the k-th on both sides; the SPECIES is carried in the element strings so a
 * replacement walking into the same slot shows up as a mismatch rather than being silently joined. */
function joinByHolder(recs) {
  const m = new Map();
  for (const r of recs) {
    if (r.chosen === null || r.index < 0) continue;   // our engine records empty lists too
    const k = r.holderSlot;
    const a = m.get(k) || []; a.push(r); m.set(k, a);
  }
  return m;
}
let cmp = 0, memberDiff = 0, orderDiff = 0, idxDiff = 0, sameList = 0, onlySd = 0, onlyMe = 0;
let choiceCells = 0, choiceDiff = 0, rtRefused = 0, rtRefusedIdxDiff = 0;
const examples = [];
const unpaired = [];
for (const c of cells) {
  const A = joinByHolder(c.sd), B = joinByHolder(c.me);
  const keys = new Set([...A.keys(), ...B.keys()]);
  for (const k of keys) {
    const as = A.get(k) || [], bs = B.get(k) || [];
    const n = Math.max(as.length, bs.length);
    for (let i = 0; i < n; i++) {
      const a = as[i], b = bs[i];
      if (!a) { onlyMe++; unpaired.push('  medicham-only  ' + c.tag.slice(0,46) + '  holder ' + k + '  occ ' + i + '  turn ' + b.turn + '  divTurn ' + c.divTurn + '  turns ' + c.turns + '  list [' + b.list.join('  ') + ']'); continue; }
      if (!b) { onlySd++; unpaired.push('  showdown-only  ' + c.tag.slice(0,46) + '  holder ' + k + '  occ ' + i + '  turn ' + a.turn + '  divTurn ' + c.divTurn + '  turns ' + c.turns + '  list [' + a.list.join('  ') + ']  idx ' + a.index + ' -> ' + a.chosen); continue; }
      /* AFTER THE STREAMS PART, TWO BOARDS ARE TWO BOARDS. Refuse the comparison rather than count it. */
      if (c.divTurn !== null && c.divTurn !== undefined && a.turn > c.divTurn) continue;
      cmp++;
      const sameSet = a.list.length === b.list.length
        && [...a.list].sort().join(',') === [...b.list].sort().join(',');
      const sameSeq = a.list.join(',') === b.list.join(',');
      if (!sameSet) memberDiff++;
      else if (!sameSeq) orderDiff++;
      else sameList++;
      /* THE INDEX CLAUSE, AND THE ONE THING THAT DISQUALIFIES IT — see SD_RT_TURNS. The LIST clauses
       * above still apply on a refused turn: membership and order are a property of the board and no
       * die can move them. */
      const foreign = c.rtTurns.has(a.turn);
      if (foreign) {
        rtRefused++;
        if (sameSeq && a.index !== b.index) rtRefusedIdxDiff++;
      } else {
        if (sameSeq && a.index !== b.index) idxDiff++;
        if (a.list.length > 1 && b.list.length > 1) {
          choiceCells++;
          if (a.chosen !== b.chosen) choiceDiff++;
        }
      }
      if (!foreign && (!sameSeq || a.index !== b.index) && examples.length < 12) {
        examples.push('  ' + (c.mirror ? 'MIRROR' : 'SINGLE') + '  ' + c.tag.slice(0, 46)
          + '  t' + a.turn + '/' + b.turn + '  holder ' + k
          + NL + '      showdown list [' + a.list.join('  ') + ']  idx ' + a.index + ' -> ' + a.chosen
          + NL + '      medicham list [' + b.list.join('  ') + ']  idx ' + b.index + ' -> ' + b.chosen);
      }
    }
  }
}

console.log(NL + 'THE LISTS, ELEMENT BY ELEMENT — ' + cmp + ' joined draw(s)');
console.log('  identical list (same members, same order)   ' + sameList);
console.log('  MEMBERSHIP differs                          ' + memberDiff);
console.log('  ORDER differs, same members                 ' + orderDiff);
console.log('  same list, DIFFERENT INDEX drawn            ' + idxDiff);
console.log('  a draw only one engine took   showdown-only ' + onlySd + '   medicham-only ' + onlyMe);
console.log('  cells with a real choice on both sides (>=2): ' + choiceCells + ', of which the copied'
  + ' body differs: ' + choiceDiff);
console.log('  REFUSED for the random-target address defect  ' + rtRefused
  + '   (of which the index differs: ' + rtRefusedIdxDiff + ')   authority getRandomTarget draws this'
  + ' run: ' + SD_RT_DRAWS);

/* ---- THE MECHANISM, MEASURED RATHER THAN ARGUED -----------------------------------------------
 *
 * `PRNG#sample` (`sim/prng.ts:132`) is `items[this.random(items.length)]` and `PRNG#random` (`:91`)
 * calls `this.rng.next()` UNCONDITIONALLY — so a ONE-ELEMENT list still costs the authority a draw.
 * It cannot change the authority's own answer (index 0 is the only index), and under the middle arm's
 * event-addressed dice it changes EVERY LATER DRAW IN THE TURN, because `nth` is a per-address repeat
 * counter. An engine that skips the draw is one address behind for the rest of that turn.
 *
 * `traceChoiceDie` is this engine's own receipt for "a die was taken". The two numbers below are the
 * claim: if the authority drew more often than we did, the addresses cannot line up. */
console.log(NL + 'THE DRAW COUNT — the half a copied-ability comparison cannot see');
console.log('  authority `sample()` calls on a ONE-element list   ' + SD_SAMPLED_LEN1);
console.log('  this engine, dice taken for a Trace choice          ' + M.MEDSEEN.traceChoiceDie
  + '   (copies made: ' + M.MEDSEEN.traceCopied + ', ambiguous: ' + M.MEDSEEN.traceAmbiguousChoice + ')');
if (SD_SAMPLED_LEN1 > 0 && M.MEDSEEN.traceChoiceDie < M.MEDSEEN.traceCopied) {
  console.log('  the authority drew on ' + SD_SAMPLED_LEN1 + ' list(s) of length 1 that this engine'
    + ' resolved WITHOUT a draw. Every `any` draw after one of those, in the same turn, is addressed'
    + ' one `nth` apart.');
}
if (examples.length) console.log(NL + 'FIRST DIVERGENT DRAWS:' + NL + examples.join(NL));
if (unpaired.length) console.log(NL + 'DRAWS ONE ENGINE TOOK ALONE:' + NL + unpaired.join(NL));

if (memberDiff) { console.log(NL + '  FAIL — ' + memberDiff + ' draw(s) built a list with different MEMBERS.'); bad++; }
if (orderDiff) { console.log('  FAIL — ' + orderDiff + ' draw(s) built the same members in a different ORDER.'); bad++; }
if (onlySd) { console.log('  FAIL — ' + onlySd + ' draw(s) the authority took and this engine did not.'); bad++; }
if (onlyMe) { console.log('  FAIL — ' + onlyMe + ' draw(s) this engine took and the authority did not.'); bad++; }
if (idxDiff) { console.log('  FAIL — ' + idxDiff + ' draw(s) shared a list and drew a different INDEX.'); bad++; }
if (!cmp) { console.log('  FAIL — nothing was joined, so no clause above was actually asked.'); bad++; }

/* THE MACHINE-READABLE VERDICT, so a parent judges this file on NUMBERS rather than on an exit code
 * that only means "my own clauses held". Both arms print it; only the red child's is read. */
console.log('KNOB-VERDICT knob=' + (process.env.MEDI_TRACE_SOLO_NODRAW === '1' ? 1 : 0)
  + ' cmp=' + cmp + ' member=' + memberDiff + ' order=' + orderDiff + ' idx=' + idxDiff
  + ' choice=' + choiceCells + ' choiceDiff=' + choiceDiff
  + ' sdLen1=' + SD_SAMPLED_LEN1 + ' meDie=' + M.MEDSEEN.traceChoiceDie
  + ' meCopied=' + M.MEDSEEN.traceCopied);

/* ---- THE RED ARM ------------------------------------------------------------------------------
 *
 * `MEDI_TRACE_SOLO_NODRAW=1` puts the length-1 skip back. It runs in a CHILD because the knob is read
 * at module load. IT IS NOT JUDGED ON ITS EXIT CODE — under the knob the child's own clauses assert
 * the DEFECT IS PRESENT, so a working knob makes the child exit 1 and a dead knob makes it exit 0;
 * reading that as pass/fail is the inverted control this repository has got wrong before. The parent
 * reads the child's numbers, and every one of them can fail: a knob that reached no code reports
 * `meDie === meCopied`, and a fixture that never staged a one-element list reports `sdLen1 === 0`. */
if (process.env.MEDI_TRACE_SOLO_NODRAW !== '1') {
  const { spawnSync } = require('child_process');
  console.log(NL + '--- THE RED ARM (MEDI_TRACE_SOLO_NODRAW=1, a child; the knob is read at module load) ---');
  /* THE CHILD INHERITS THE PARENT NODE FLAGS — 2026-08-28. Without this, a parent started with
   * `-r ./tests/_live_release.js` was redirected and its child was NOT: the child re-required
   * engine/game_differential.js with no --release, which CUTS A REAL RELEASE at require time and
   * REPOINTS data/engine-release.json under whatever else is measuring. Measured, not argued: a
   * redirected cut was shown NOT to touch data/engine-release.json, so every real cut seen during
   * a preloaded run came from here. process.execArgv is node OWN record of how this process was
   * started, so this reads the fact rather than re-deriving it. tests/probe_hazard_recap_fail.js
   * already did this by hand; this is the same fix at the four sites that did not. */
  const cp = spawnSync(process.execPath, [...process.execArgv, __filename, ...argv],
    { env: { ...process.env, MEDI_TRACE_SOLO_NODRAW: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(cp.stdout || '') + String(cp.stderr || '');
  const vline = out.split(NL).find(l => l.startsWith('KNOB-VERDICT'));
  if (!vline) {
    console.log('  FAIL — the red arm printed no verdict line (exit ' + cp.status + '). It did not run.');
    bad++;
  } else {
    console.log('  | ' + vline);
    const V = {}; for (const kv of vline.split(' ').slice(1)) { const [k, v] = kv.split('='); V[k] = +v; }
    if (V.sdLen1 === 0) {
      console.log('  FAIL — the red arm never staged a ONE-ELEMENT eligible list, so the knob had'
        + ' nothing to skip and this arm tested nothing.');
      bad++;
    }
    if (V.meDie >= V.meCopied) {
      console.log('  FAIL — the red arm took a die on every copy (' + V.meDie + '/' + V.meCopied
        + '). The knob reached no code.');
      bad++;
    }
    if (V.idx === 0) {
      console.log('  FAIL — the red arm restored the skip and NO draw parted. The skipped draw is not'
        + ' what moves the index, and the fix above rests on nothing.');
      bad++;
    }
    if (V.member || V.order) {
      console.log('  FAIL — the red arm moved the LIST (' + V.member + ' members, ' + V.order
        + ' order). The knob is over-firing: it must move the DIE and nothing else.');
      bad++;
    }
    if (!bad) console.log('  the red arm reproduced the defect: ' + V.idx + ' draw(s) part, '
      + (V.meCopied - V.meDie) + ' copy(ies) resolved with no die, lists still identical.');
  }
}

/* A RUN UNDER A RESTORE KNOB CAN NEVER READ AS A CLEAN ONE. The staged arms below spawn their own
 * children and clear the knob explicitly, so they are green whatever this process was started with —
 * correct for a controlled experiment, and it would leave an externally-knobbed run resting entirely
 * on a 1-in-2,442 sweep. This clause makes it immediate: the engine stamps `MEDFAILS`, and a stamped
 * process fails by name. */
if (Number((M.MEDFAILS || {}).pivotEntryMoveAddrRestored || 0) > 0) {
  console.log(NL + '  FAIL — MEDI_PIVOT_ENTRY_MOVE_ADDR=1 is set in THIS process '
    + '(MEDFAILS.pivotEntryMoveAddrRestored), so the engine under test has the defect restored.');
  bad++;
}

/* ---- THE STAGED ARM'S VERDICT — one board, two children, no search --------------------------- */
if (process.env.MEDI_TRACE_SOLO_NODRAW !== '1') {
  const { spawnSync } = require('child_process');
  console.log(NL + '--- THE STAGED PIVOT-ENTRY ARM (one board; the knob is read at module load, so each'
    + ' arm is a child) ---');
  /* THE CLEAN ARM CLEARS THE KNOB EXPLICITLY. Inheriting `process.env` would let a knob set from
   * OUTSIDE this process reach the arm that is supposed to be the control, and the two arms would
   * then agree for the one reason that proves nothing — the first Choice Scarf probe's mistake. */
  const arm = (env) => {
    const cp = spawnSync(process.execPath, [...process.execArgv, __filename, ...argv],
      { env: { ...process.env, MEDI_PIVOT_ENTRY_MOVE_ADDR: '', ABRA_TRACE_STAGED: '1', ...env },
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const line = (String(cp.stdout || '') + String(cp.stderr || '')).split(NL).find(l => l.startsWith('__STAGED__'));
    return line ? JSON.parse(line.slice('__STAGED__'.length)) : null;
  };
  const CLEAN = arm({});
  const KNOB = arm({ MEDI_PIVOT_ENTRY_MOVE_ADDR: '1' });
  const say = (what, ok, detail) => { console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + detail);
    if (!ok) bad++; return ok; };
  if (!CLEAN || !KNOB) {
    console.log('  FAIL — a staged child printed no verdict line, so this arm did not run.'); bad++;
  } else if (!CLEAN.staged) {
    console.log('  FAIL — NOT STAGED, and that is a claim about the FIXTURE: '
      + JSON.stringify(CLEAN.why || CLEAN.err)); bad++;
  } else {
    console.log('  cast: ' + CLEAN.cast);
    console.log('  clean  showdown ' + CLEAN.sdAddr + '   medicham2 ' + CLEAN.meAddr);
    console.log('  knob   showdown ' + KNOB.sdAddr + '   medicham2 ' + KNOB.meAddr);
    say('the fixture: the pivot connected and the Trace body walked in on BOTH engines',
        !!CLEAN.sdList && !!CLEAN.meList && CLEAN.scriptMissed === 0,
        'scripted clicks not on the request: ' + CLEAN.scriptMissed);
    say('the fixture: both engines built the SAME two-body eligible list',
        CLEAN.sdList.join(',') === CLEAN.meList.join(',') && CLEAN.sdList.length === 2,
        JSON.stringify(CLEAN.sdList));
    say('the two engines ADDRESS the draw identically', CLEAN.sdAddr === CLEAN.meAddr,
        CLEAN.sdAddr + ' vs ' + CLEAN.meAddr);
    say('...and the authority\'s address carries NO active move, because the pivot switch is its own action',
        /\|any\|-\|-\|/.test(String(CLEAN.sdAddr)), String(CLEAN.sdAddr));
    say('so the two engines copy the same body', CLEAN.sdChosen === CLEAN.meChosen,
        CLEAN.sdChosen + ' vs ' + CLEAN.meChosen);
    say('the fix RAN on this board (MEDSEEN.pivotEntryAddrCleared)', CLEAN.cleared > 0,
        'counter ' + CLEAN.cleared
        + (CLEAN.cleared > 0 ? '' : '   [nothing was stale, so this board asked nothing]'));
    /* AND THE KNOB — an identical result across a varied knob means the knob is unwired. */
    say('the knob REACHED THE CODE it names (MEDFAILS.pivotEntryMoveAddrRestored)', KNOB.knobReached > 0,
        'counter ' + KNOB.knobReached);
    say('KNOB: medicham2 addresses the draw to the PIVOT MOVE again', KNOB.meAddr !== KNOB.sdAddr
        && String(KNOB.meAddr).indexOf('|any|-|-|') < 0, KNOB.meAddr);
    say('KNOB: the authority is UNMOVED, so the difference is ours', KNOB.sdAddr === CLEAN.sdAddr,
        KNOB.sdAddr);
    say('KNOB: the LIST is unmoved — the knob must move the ADDRESS and nothing else',
        KNOB.sdList.join(',') === CLEAN.sdList.join(',') && KNOB.meList.join(',') === CLEAN.meList.join(','),
        JSON.stringify(KNOB.meList));
    say('KNOB: and on this board the mis-addressed draw copies a DIFFERENT body',
        KNOB.meChosen !== KNOB.sdChosen, KNOB.sdChosen + ' vs ' + KNOB.meChosen);
  }
}

if (CANL_THREW) {
  bad++;
  console.log('  RED    the learnset validator THREW ' + CANL_THREW + ' time(s) — every throw was read as a NO, so the fixture choice in this run is not trustworthy');
}
console.log(NL + (bad ? bad + ' FAILING CLAUSE(S)' : 'all clauses green'));
process.exit(bad ? 1 : 0);
