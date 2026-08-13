/* test-switch-carry.js — WHAT SURVIVES A SWITCH, AND WHAT DOES NOT.
 *
 *   SHOWDOWN_PATH=... node tests/test-switch-carry.js
 *   SHOWDOWN_PATH=... node tests/test-switch-carry.js --only 2      one part
 *
 * Will, 2026-08-12: *"does toxic and sleep turns carry over when a mon is switched out and are we
 * tracking relevant things like that"*.
 *
 * THE TWO HALVES OF THAT QUESTION HAVE OPPOSITE ANSWERS AND THIS ENGINE HAD THE SAME ANSWER FOR BOTH.
 * `Pokemon#clearVolatile()` (sim/pokemon.ts:1514) is called on the OUTGOING body by `switchIn` and by
 * `faintMessages`. Two clauses matter and they pull apart:
 *
 *   this.volatiles = {}        EVERY volatile is dropped, wholesale, with no `onEnd`. There is no
 *                              membership to consult -- the authority does not look at the volatile
 *                              at all. Anything that must survive a switch is therefore not a
 *                              volatile.
 *   (status untouched)         `status` and `statusState` are NOT in the function. A status and every
 *                              counter hanging off it survives by default, and the ONLY thing that
 *                              can reset one is that condition's own `onSwitchIn`.
 *
 * So sleep CARRIES and badly-poison RESTARTS, and nothing generic distinguishes them.
 *
 * ---- WHAT THIS FILE MAY NOT DO ------------------------------------------------------------------
 *
 * IT MAY NOT CARRY A LIST OF MECHANICS. A hand-typed list of "the volatiles that should reset" is the
 * exact artifact this bug lived inside for months: `switchOut` emptied `_vol` BY HAND, three members
 * at a time, and its own comment filed `taunt`, `encore` and `disable` as known-wrong. A staged audit
 * then found ELEVEN more beside them. A test written from a list inherits the list's blind spot.
 *
 * So every expectation here is DERIVED from `gen9championsvgc2026regmb` on the run that uses it:
 * PART 1 walks the format's own condition table, PART 4 walks every legal move that installs a
 * volatile and finds each one a legal carrier out of the format's own learnsets. If Champions changes
 * a handler, this file changes with it.
 *
 * ---- WHAT IT STRUCTURALLY CANNOT SEE ------------------------------------------------------------
 *
 *   - a volatile no legal move in this format installs (an ability-granted one), and any move for
 *     which the regulation holds no legal carrier. Both are PRINTED per row, never absorbed;
 *   - a body that cannot voluntarily switch. Ingrain, No Retreat and the partial-trap family TRAP the
 *     carrier, so Showdown refuses the switch and there is no pivot to measure. That is the mechanic
 *     working, and the rows say so rather than counting as passes;
 *   - anything about the turns BETWEEN the pivots. This asks what state a body arrives holding.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset, so the authority could not be consulted.');
  console.log('THIS IS NOT A PASS.');
  process.exit(2);
}
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
/* EVERY SUB-100 MOVE HITS AND EVERY SECONDARY FIRES. Without it a 90%-accuracy Toxic MISSES under the
 * primary arm and the whole measurement reads "the engines agree" for the wrong reason. */
const ARM = G.ARM_BY_ID.get('bottom-tie-first');

const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const _oi = process.argv.indexOf('--only');
const ONLY = _oi >= 0 ? +process.argv[_oi + 1] : null;
/* THE DELIBERATE BREAKS. Each names a clause of the fix and is used to show this file RED before it
 * is trusted; they are applied to the ENGINE by hand, not from here — see the header of PART 6. */
let FAIL = 0, PASS = 0;
const say = (ok, what, detail) => {
  if (ok) { PASS++; console.log('    PASS  ' + what + (detail ? '   ' + detail : '')); }
  else { FAIL++; console.log('    FAIL  ' + what + (detail ? '   ' + detail : '')); }
};

/* ================================================================================================
 * THE FIXTURE POOL — a victim that can take a status, a body to pivot to, and two fillers.
 * Everything clicks Agility so nothing but the mechanic under test moves any HP.
 * ============================================================================================== */
const SPARE = 'vaporeon', PARTNER = 'milotic';
const FILL = { species: 'clefable', item: '', ability: '', moves: ['Agility', 'Moonblast'] };
const SPECIES = dex.species.all().filter(legal).filter(s => !s.forme || !/mega|gmax/i.test(s.forme));
const LS = new Map();
for (const s of SPECIES) { let l; try { l = dex.species.getLearnsetData(s.id); } catch (e) { l = null; }
  LS.set(s.id, (l && l.learnset) || {}); }
/* An ability on the CARRIER that would clear or refuse the thing under test makes an arm that cannot
 * show the effect, which proves nothing whatever the engine does (docs/LESSONS §5). */
const AVOID_AB = new Set(['naturalcure', 'regenerator', 'zerotohero', 'shedskin', 'hydration',
  'magicguard', 'owntempo', 'oblivious', 'aromaveil', 'insomnia', 'vitalspirit', 'innerfocus',
  'illusion', 'imposter', 'disguise', 'synchronize', 'corrosion', 'merciless', 'unburden']);
function carrierOf(moveId) {
  for (const s of SPECIES) {
    if (!(LS.get(s.id) || {})[moveId]) continue;
    if (AVOID_AB.has(norm(Object.values(s.abilities || {})[0]))) continue;
    return s;
  }
  return null;
}
const VICT_BAN = new Set(['immunity', 'insomnia', 'vitalspirit', 'comatose', 'purifyingsalt',
  'naturalcure', 'shedskin', 'hydration', 'magicguard', 'poisonheal', 'earlybird', 'guts',
  'sweetveil', 'leafguard', 'flowerveil', 'pastelveil', 'limber', 'waterveil', 'thermalexchange',
  'waterbubble', 'magmaarmor']);
const IMMUNE_TYPE = { tox: ['Poison', 'Steel'], psn: ['Poison', 'Steel'], par: ['Electric'],
  brn: ['Fire'], frz: ['Ice'], slp: [] };
function victimFor(statusId, minHp) {
  for (const s of SPECIES) {
    if ((IMMUNE_TYPE[statusId] || []).some(t => s.types.includes(t))) continue;
    if (VICT_BAN.has(norm(Object.values(s.abilities || {})[0]))) continue;
    if (s.baseStats.hp < (minHp || 0)) continue;
    if ([SPARE, PARTNER, 'clefable', 'corviknight', 'garchomp'].includes(norm(s.id))) continue;
    return s;
  }
  return null;
}
const AG = { m: 'agility' };
function teams(victimKey, userKey, userMove, victimMoves) {
  return [
    [{ species: victimKey, item: '', ability: '', moves: victimMoves || ['Agility', 'Protect'] },
     { species: PARTNER, item: '', ability: '', moves: ['Agility', 'Protect'] },
     { species: SPARE, item: '', ability: '', moves: ['Agility', 'Protect'] }, FILL],
    [{ species: userKey, item: '', ability: '', moves: userMove ? [userMove, 'Agility'] : ['Agility', 'Protect'] },
     { species: 'corviknight', item: '', ability: '', moves: ['Agility', 'Protect'] },
     { species: 'garchomp', item: '', ability: '', moves: ['Agility', 'Protect'] }, FILL]];
}
/* Read the victim out of BOTH engines at each boundary. `_switchKey` is not copied by `freshBodies`,
 * so the medicham lookup uses the same two keys the driver's own switch chooser falls back to. */
function watch(vk, take) {
  return (snap, turnIdx, S, battle) => {
    const all = [...(S.actA || []), ...(S.benchA || [])].filter(Boolean);
    const m = all.find(x => norm(x.name) === vk || norm(x._ident || '') === vk);
    const p = battle.p1.pokemon.find(x => norm(x.species.id) === vk);
    if (!m || !p) return;
    take({ t: turnIdx, onField: (S.actA || []).includes(m), m, p });
  };
}
const sdVols = p => Object.keys(p.volatiles || {}).sort();
const medVols = m => Object.keys(m._vol || {}).filter(k => m._vol[k]).sort();

/* ================================================================================================
 * PART 1 — THE AUTHORITY'S OWN TABLE. Derived every run; the engine's hard-coded membership is
 *          CHECKED here rather than remembered.
 * ============================================================================================== */
function part1() {
  console.log('\n  PART 1 — what the format says a switch does to a STATUS. Derived, not typed.');
  const statuses = [];
  for (const id of Object.keys(dex.data.Conditions)) {
    const c = dex.conditions.get(id);
    if (c.effectType !== 'Status') continue;
    const hs = ['onSwitchIn', 'onSwitchOut'].filter(k => c[k] != null);
    statuses.push({ id, hs, src: hs.map(k => String(c[k]).replace(/\s+/g, ' ')).join(' | ') });
  }
  console.log('    the format holds ' + statuses.length + ' status conditions: '
    + statuses.map(s => s.id).join(' '));
  for (const s of statuses) console.log('      ' + s.id.padEnd(6)
    + (s.hs.length ? s.src : 'NO SWITCH HANDLER -> its counter carries over'));
  const withHandler = statuses.filter(s => s.hs.length);
  say(withHandler.length === 1 && withHandler[0].id === 'tox',
    'exactly one status declares a switch handler, and it is tox',
    'got [' + withHandler.map(s => s.id).join(',') + ']');
  say(withHandler.length === 1 && /stage\s*=\s*0/.test(withHandler[0].src),
    'that handler ZEROES the ramp stage', withHandler.length ? withHandler[0].src : '(none)');
  const carriers = statuses.filter(s => !s.hs.length).map(s => s.id);
  say(carriers.includes('slp') && carriers.includes('frz'),
    'sleep and freeze declare NO switch handler, so their counters carry', 'carriers: ' + carriers.join(' '));
  /* THE OTHER CLAUSE, and it is the one PART 4 rests on. Read off the function rather than asserted
   * from memory: if `clearVolatile` ever stops emptying the table wholesale, PART 4's expectation
   * ("empty afterwards, every time") is no longer the authority's and must be rewritten. */
  const src = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'sim/pokemon.ts'), 'utf8');
  const body = (/clearVolatile\(includeSwitchFlags = true\) \{([\s\S]*?)\n\t\}/.exec(src) || [])[1] || '';
  say(/this\.volatiles = \{\};/.test(body),
    'clearVolatile() empties the volatile table WHOLESALE (no membership to consult)');
  say(!/this\.status\s*=/.test(body),
    'clearVolatile() does NOT touch `status` — which is why a status counter carries by default');
}

/* ================================================================================================
 * PART 2 — THE BADLY-POISON RAMP ACROSS A PIVOT. The headline, staged as an OUTCOME (HP).
 * ============================================================================================== */
function part2() {
  console.log('\n  PART 2 — the badly-poison ramp across a pivot. Both engines, one script.');
  const user = carrierOf('toxic'), vic = victimFor('tox', 100);
  if (!user || !vic) return say(false, 'PART 2 could not be staged', 'user=' + (user && user.name) + ' victim=' + (vic && vic.name));
  const vk = norm(vic.id);
  const [A, B] = teams(vk, norm(user.id), 'Toxic');
  const a = G.buildPair(A), b = G.buildPair(B);
  const script = [
    { p1: [AG, AG], p2: [{ m: 'toxic', t: 0 }, AG] },
    { p1: [AG, AG], p2: [AG, AG] },
    { p1: [AG, AG], p2: [AG, AG] },
    { p1: [{ sw: SPARE }, AG], p2: [AG, AG] },       // out
    { p1: [{ sw: vk }, AG], p2: [AG, AG] },          // back — the reset lands here
    { p1: [AG, AG], p2: [AG, AG] },
    { p1: [AG, AG], p2: [AG, AG] }];
  const rows = [];
  G.playGame(a, b, 'directed', 'sc/tox', { script, arm: ARM, onBoundary: watch(vk, r => rows.push({
    t: r.t, onField: r.onField, mhp: r.m.curHP, shp: r.p.hp, mtox: r.m.toxTurns || 0,
    stage: (r.p.statusState && r.p.statusState.stage) || 0,
    mst: r.m.status || '-', sst: r.p.status || '-' })) });
  console.log('      boundary   where    medicham2            showdown');
  for (const r of rows) console.log('      t' + String(r.t).padEnd(9)
    + (r.onField ? 'FIELD  ' : 'BENCH  ')
    + (r.mhp + ' hp  ' + r.mst + ' stage ' + r.mtox).padEnd(22)
    + r.shp + ' hp  ' + r.sst + ' stage ' + r.stage);
  say(rows.length >= 6, 'the pivot script produced boundaries on both sides', rows.length + ' boundaries');
  const bench = rows.find(r => !r.onField);
  say(!!bench, 'the victim actually left the field');
  if (bench) say(bench.mtox === bench.stage && bench.mtox > 0,
    'the ramp is FROZEN, not reset, while the body sits on the bench',
    'medicham ' + bench.mtox + ' vs showdown ' + bench.stage);
  const back = rows.filter(r => bench && r.t > bench.t && r.onField);
  say(back.length >= 2, 'the victim came back and took at least two more residuals', back.length + ' boundaries after the return');
  if (back.length) say(back[0].mtox === 1 && back[0].stage === 1,
    'the ramp RESTARTS at stage 1 on the return, in BOTH engines',
    'medicham ' + back[0].mtox + ' vs showdown ' + back[0].stage);
  const bad = rows.filter(r => r.mhp !== r.shp);
  say(!bad.length, 'the two engines hold the same HP at every boundary',
    bad.length ? 'parted at ' + bad.map(r => 't' + r.t + ' (' + r.mhp + ' vs ' + r.shp + ')').join(', ') : '');
}

/* ================================================================================================
 * PART 3 — SLEEP. The other half of Will's question, and the answer is the opposite one, so a fix
 *          that reset every counter would fail HERE.
 * ============================================================================================== */
function part3() {
  console.log('\n  PART 3 — sleep across a pivot. The counter must CARRY.');
  /* The move is picked by whether the regulation has a legal CARRIER, never by accuracy alone: Spore
   * is the most accurate sleep move in the dex and ZERO legal species in this format learns it, so an
   * accuracy-only pick stages nothing and reports it as a mechanic result. */
  const opts = dex.moves.all().filter(legal).filter(m => m.status === 'slp' && m.category === 'Status')
    .sort((x, y) => (y.accuracy === true ? 101 : y.accuracy) - (x.accuracy === true ? 101 : x.accuracy));
  console.log('      sleep moves in this format: ' + opts.map(o => o.name + (carrierOf(o.id) ? '' : ' (NO LEGAL CARRIER)')).join(', '));
  const mv = opts.find(o => carrierOf(o.id));
  if (!mv) return say(false, 'PART 3 could not be staged — no legal sleep carrier in the regulation');
  const user = carrierOf(mv.id), vic = victimFor('slp', 100);
  const vk = norm(vic.id);
  const [A, B] = teams(vk, norm(user.id), mv.name);
  const a = G.buildPair(A), b = G.buildPair(B);
  /* THE PIVOT IS IMMEDIATE. Under the pinned arm a sleep lasts one or two turns, so a script that
   * waits three turns before pivoting measures a body that is already awake — a claim about the
   * fixture and never about the mechanic. */
  const script = [
    { p1: [AG, AG], p2: [{ m: mv.id, t: 0 }, AG] },
    { p1: [{ sw: SPARE }, AG], p2: [AG, AG] },
    { p1: [{ sw: vk }, AG], p2: [AG, AG] },
    { p1: [AG, AG], p2: [AG, AG] }];
  const rows = [];
  G.playGame(a, b, 'directed', 'sc/slp', { script, arm: ARM, onBoundary: watch(vk, r => rows.push({
    t: r.t, onField: r.onField, mst: r.m.status || '-', sst: r.p.status || '-',
    mslp: r.m.slpTurns || 0, stime: (r.p.statusState && r.p.statusState.time) || 0,
    mhp: r.m.curHP, shp: r.p.hp })) });
  console.log('      boundary   where    medicham2               showdown');
  for (const r of rows) console.log('      t' + String(r.t).padEnd(9) + (r.onField ? 'FIELD  ' : 'BENCH  ')
    + (r.mst + ' slpTurns=' + r.mslp + ' hp=' + r.mhp).padEnd(25) + r.sst + ' time=' + r.stime + ' hp=' + r.shp);
  const asleep = rows.find(r => r.mst === 'slp');
  say(!!asleep, 'the victim actually fell asleep', mv.name + ' from ' + (user && user.name));
  const bench = rows.find(r => !r.onField);
  say(!!bench, 'the victim left the field while asleep', bench ? 'status on the bench = ' + bench.mst : '');
  const back = rows.filter(r => bench && r.t > bench.t && r.onField)[0];
  if (back) {
    say(back.mst === back.sst, 'both engines agree on the status after the return',
      'medicham ' + back.mst + ' vs showdown ' + back.sst);
    /* THE POINT OF THIS PART. If the fix had reset every counter rather than the one the authority
     * resets, a sleeping body would walk back in with a fresh clock and sleep for ever. */
    say(back.mst !== 'slp' || back.mslp > 0,
      'a body still asleep on its return has NOT had its sleep counter reset',
      'slpTurns=' + back.mslp);
  }
  const bad = rows.filter(r => r.mhp !== r.shp || r.mst !== r.sst);
  say(!bad.length, 'the two engines hold the same status and HP at every boundary',
    bad.length ? 'parted at ' + bad.map(r => 't' + r.t).join(', ') : '');
}

/* ================================================================================================
 * PART 4 — EVERY LEGAL VOLATILE, STAGED. The membership is the format's, computed on this run.
 * ============================================================================================== */
function part4() {
  console.log('\n  PART 4 — every legal move that installs a volatile: install, pivot out, pivot back.');
  const CAND = [];
  for (const m of dex.moves.all().filter(legal)) {
    if (!m.volatileStatus) continue;
    CAND.push({ id: m.id, name: m.name, vol: m.volatileStatus,
      self: m.target === 'self' || m.target === 'allySide' || m.target === 'adjacentAllyOrSelf' });
  }
  console.log('      ' + CAND.length + ' legal moves install a volatile: '
    + [...new Set(CAND.map(c => c.vol))].sort().join(' '));
  const out = { staged: 0, agreed: 0, differ: [], noFixture: [], trapped: [] };
  for (const c of CAND) {
    const user = carrierOf(c.id);
    if (!user) { out.noFixture.push(c.name + ' (no legal carrier)'); continue; }
    const vk = c.self ? norm(user.id) : norm((victimFor('psn', 100) || {}).id || '');
    if (!vk || vk === SPARE || vk === PARTNER) { out.noFixture.push(c.name + ' (fixture clash)'); continue; }
    const [A, B] = c.self
      ? [teams(vk, 'garchomp', null, [c.name, 'Agility'])[0], teams(vk, 'garchomp', null)[1]]
      : teams(vk, norm(user.id), c.name);
    let a, b; try { a = G.buildPair(A); b = G.buildPair(B); } catch (e) { out.noFixture.push(c.name + ' (build threw)'); continue; }
    if (!a || !b || a.length < 3) { out.noFixture.push(c.name + ' (unbuildable)'); continue; }
    const apply = c.self ? { p1: [{ m: c.id }, AG], p2: [AG, AG] }
                         : { p1: [AG, AG], p2: [{ m: c.id, t: 0 }, AG] };
    const script = [apply,
      { p1: [{ sw: SPARE }, AG], p2: [AG, AG] },
      { p1: [{ sw: vk }, AG], p2: [AG, AG] },
      { p1: [AG, AG], p2: [AG, AG] }];
    let before = null, after = null, err = null;
    try {
      const r = G.playGame(a, b, 'directed', 'sc/' + c.vol, { script, arm: ARM,
        onBoundary: watch(vk, x => {
          if (x.t === 1) before = { sd: sdVols(x.p), med: medVols(x.m) };
          if (x.t === 3) after = { sd: sdVols(x.p), med: medVols(x.m) };
        }) });
      err = r && r.err;
    } catch (e) { err = e.message; }
    if (err && /trapped/i.test(String(err))) { out.trapped.push(c.name + ' [' + c.vol + ']'); continue; }
    if (!before || !after) { out.noFixture.push(c.name + ' (no boundary pair' + (err ? ': ' + String(err).slice(0, 60) : '') + ')'); continue; }
    /* A ROW WHERE NEITHER ENGINE EVER HELD THE VOLATILE IS A CLAIM ABOUT THE FIXTURE, NEVER ABOUT THE
     * MECHANIC (Will has taught this twice). It is named and not counted either way. */
    if (!before.sd.length && !before.med.length) { out.noFixture.push(c.name + ' (neither engine produced it)'); continue; }
    out.staged++;
    if (after.sd.length || after.med.length) {
      out.differ.push(c.name + ' [' + c.vol + '] before sd=' + JSON.stringify(before.sd)
        + ' med=' + JSON.stringify(before.med) + '  AFTER sd=' + JSON.stringify(after.sd)
        + ' med=' + JSON.stringify(after.med));
    } else out.agreed++;
  }
  console.log('      staged ' + out.staged + ', both engines empty after the return: ' + out.agreed);
  if (out.trapped.length) console.log('      the volatile TRAPS its carrier, so there is no pivot to measure — '
    + 'the mechanic working, not a pass: ' + out.trapped.join(', '));
  if (out.noFixture.length) { console.log('      not staged (a claim about THIS FIXTURE, never about the mechanic):');
    for (const x of out.noFixture) console.log('        ' + x); }
  for (const d of out.differ) console.log('      DIFFER  ' + d);
  say(out.staged >= 15, 'the fixture staged a real sample of the volatile family', out.staged + ' staged');
  say(!out.differ.length, 'no volatile survives a pivot in EITHER engine', out.differ.length + ' survived');
}

/* ================================================================================================
 * PART 5 — THE COUNTERS. A capability that cannot prove it ran is assumed broken (CLAUDE.md).
 *
 * DRIVEN AGAINST THE LIVE ENGINE DIRECTLY, not through the differential: `game_differential.js`
 * loads medicham2 out of a FROZEN RELEASE, so its `MEDSEEN` is a different object from this file's
 * and reading it here would show zero on a run that worked perfectly. That is exactly the shape of
 * the silent default these counters exist to catch, so it is written down rather than worked around.
 * ============================================================================================== */
function part5() {
  console.log('\n  PART 5 — the counters, read off the LIVE engine (not the differential\'s snapshot).');
  const before = { vol: M.MEDSEEN.volatilesClearedOnSwitch, bod: M.MEDSEEN.volatileSwitchBodies,
                   tox: M.MEDSEEN.toxStageResetOnEntry, gate: M.MEDSEEN.beforeMoveGateSkipped };
  const mk = (key, moves) => { const b = M.buildMon(key, {}); b.moves = moves; return b; };
  const A = [mk('azumarill', ['agility', 'protect']), mk('milotic', ['agility', 'protect']),
             mk('vaporeon', ['agility', 'protect']), mk('clefable', ['agility', 'moonblast'])];
  const B = [mk('alakazam', ['taunt', 'agility']), mk('venusaur', ['toxic', 'agility']),
             mk('garchomp', ['agility', 'protect']), mk('clefable', ['agility', 'moonblast'])];
  const S = M.battleInit(A, B, { autoMega: false });
  const rng = () => 0;   // every sub-100 move connects, matching the arm above
  const act = (mon, mv, tgt) => M.playerAction(mon, mv, tgt, S.field);
  /* `battleTurn(S, rng, actsForA, actsForB)` — TWO maps, one per side. Passing a single combined map
   * silently gives B no actions at all, which reads as "the staging did not land" rather than as a
   * caller error, so the signature is named here. */
  const victim = S.actA[0];
  /* turn 1 — Taunt and Toxic both onto A's slot 0 */
  M.battleTurn(S, rng,
    new Map([[S.actA[0], act(S.actA[0], 'agility')], [S.actA[1], act(S.actA[1], 'agility')]]),
    new Map([[S.actB[0], act(S.actB[0], 'taunt', victim)], [S.actB[1], act(S.actB[1], 'toxic', victim)]]));
  const held = Object.keys(victim._vol || {}).filter(k => victim._vol[k]);
  console.log('      after turn 1 the victim holds: _vol=' + JSON.stringify(held)
    + ' status=' + victim.status + ' toxTurns=' + victim.toxTurns);
  say(held.length > 0 && victim.status === 'tox',
    'the staging actually landed a volatile AND badly-poison', '_vol=' + JSON.stringify(held));
  /* turn 2 — pivot out; turn 3 — pivot back.
   *
   * THE FOE PASSES, AND THE FIRST VERSION OF THIS DID NOT. `mk()` inside battleTurn is
   * `_a = forced || chooseAction(...)`, so a handed-in action that is falsy silently becomes the
   * ENGINE'S OWN CHOICE — and the engine's choice for an Alakazam holding Taunt is Taunt. It
   * re-taunted the returning body on the pivot turn, the volatile was present again afterwards, and
   * the reading looked exactly like "the clear does not work". `{kind:'pass'}` is unambiguous and is
   * asserted below rather than assumed. */
  M.battleTurn(S, rng,
    new Map([[S.actA[0], { kind: 'switch', to: S.benchA.find(x => x && !x.fainted) }],
             [S.actA[1], act(S.actA[1], 'agility')]]),
    new Map([[S.actB[0], { kind: 'pass' }], [S.actB[1], { kind: 'pass' }]]));
  M.battleTurn(S, rng,
    new Map([[S.actA[0], { kind: 'switch', to: victim }], [S.actA[1], act(S.actA[1], 'agility')]]),
    new Map([[S.actB[0], { kind: 'pass' }], [S.actB[1], { kind: 'pass' }]]));
  const d = { vol: M.MEDSEEN.volatilesClearedOnSwitch - before.vol,
              bod: M.MEDSEEN.volatileSwitchBodies - before.bod,
              tox: M.MEDSEEN.toxStageResetOnEntry - before.tox,
              gate: M.MEDSEEN.beforeMoveGateSkipped - before.gate };
  console.log('      volatilesClearedOnSwitch +' + d.vol + '   volatileSwitchBodies +' + d.bod
    + '   toxStageResetOnEntry +' + d.tox + '   beforeMoveGateSkipped +' + d.gate);
  console.log('      volatileSwitchNames = ' + JSON.stringify(M.MEDSEEN.volatileSwitchNames));
  /* THE FOE REALLY DID NOTHING. If `chooseAction` had taken over it would have re-applied the very
   * volatile this part is measuring the removal of, and every assertion below would be about a
   * different board. Asserted, not assumed — a silent default looks exactly like a working feature. */
  say(d.gate > 0, 'the two pivot turns skipped the onBeforeMove block (switch/pass are not moves)',
    '+' + d.gate + ' actions');
  say(d.vol > 0, 'the wholesale volatile clear FIRED on a real pivot', '+' + d.vol + ' entries');
  say(d.bod > 0, 'it fired on a body, not on an empty table', '+' + d.bod + ' bodies');
  say(M.MEDSEEN.volatileSwitchNames.length > 0,
    'and it recorded WHICH volatiles were riding the bench', JSON.stringify(M.MEDSEEN.volatileSwitchNames));
  say(d.tox > 0, 'the badly-poison ramp reset on the RETURN', '+' + d.tox);
  say(!Object.keys(victim._vol || {}).filter(k => victim._vol[k]).length,
    'the returned body carries no volatile at all', JSON.stringify(Object.keys(victim._vol || {})));
  say(victim.status === 'tox' && (victim.toxTurns || 0) <= 1,
    'it is still badly poisoned and its ramp restarted', 'status=' + victim.status + ' toxTurns=' + victim.toxTurns);
  say(victim._lastMove == null,
    'and it has NO last move, so Encore and Disable must fail against it', '_lastMove=' + JSON.stringify(victim._lastMove));
}

/* ================================================================================================
 * PART 6 — THE RED PROOF, which is a PROCEDURE and not a flag.
 *
 * This file was shown red by editing engine/medicham2-browser.js and re-running it, before any of it
 * was trusted. A `--break` flag here would prove only that the flag works — the break has to be in
 * the ENGINE, on the same bytes a real regression would touch. The three breaks used, and what each
 * one turned red, are recorded in docs/ENGINE.md beside this pass.
 * ============================================================================================== */

console.log('  test-switch-carry.js — what survives a switch');
console.log('  arm: ' + ARM.id);
if (!ONLY || ONLY === 1) part1();
if (!ONLY || ONLY === 2) part2();
if (!ONLY || ONLY === 3) part3();
if (!ONLY || ONLY === 4) part4();
if (!ONLY || ONLY === 5) part5();
console.log('\n  ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
