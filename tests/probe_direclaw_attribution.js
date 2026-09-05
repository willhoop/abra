/* probe_direclaw_attribution.js — A SLEEP CHOSEN INSIDE THE HANDLER IS ANNOUNCED BARE, AND THIS
 * ENGINE NAMED THE MOVE ON IT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_direclaw_attribution.js
 *   SHOWDOWN_PATH=... MEDI_PROCEDURAL_STATUS_NAMES_MOVE=1 node tests/probe_direclaw_attribution.js  (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * Two of the 41 board-material games on release `3187ea18c625` open on this line, and it is the
 * FIRST divergence in both (`data/verification/fix-batch-5.json`,
 * `pair-protect-bust ...2660356793` and `pair-redirect-priority ...2654068794`):
 *
 *     sd   |-status|p1a: Golurk|slp
 *     us   |-status|p1a: Golurk|slp|[from] move: direclaw
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/mods/champions/conditions.ts` `slp.onStart` (the format OVERRIDES this condition, so
 * `data/conditions.ts` is the wrong file to read, and the two differ — Champions samples `[2,3,3]`
 * where mainline draws `random(2,5)`):
 *
 *     onStart(target, source, sourceEffect) {
 *       if (sourceEffect && sourceEffect.effectType === 'Ability') { … '[from] ability: ' … }
 *       else if (sourceEffect && sourceEffect.effectType === 'Move') { … `[from] move: ${sourceEffect.name}` }
 *       else { this.add('-status', target, 'slp'); }                       // <- the bare arm
 *
 * `sourceEffect` is whatever the CALLER handed `setStatus`. Two shapes reach it:
 *
 *   a DECLARED status  `runMoveEffects` calls `target.setStatus(moveData.status, pokemon, move, false)`
 *                      — the move is passed, `effectType === 'Move'`, the line NAMES it
 *   a status chosen    `data/mods/champions/moves.ts:191-208`, direclaw's secondary:
 *   IN THE HANDLER       onHit(target, source) {
 *                          const status = this.sample(['psn', 'par', 'slp']);
 *                          …
 *                          target.trySetStatus(status, source);            // <- NO third argument
 *                        }
 *                      so `setStatus` falls back to `if (!sourceEffect) sourceEffect = this.battle.effect`
 *                      (sim/pokemon.ts), and inside `singleEvent('Hit', <the secondary>, …)` that is
 *                      the ANONYMOUS secondary object — `{ chance: 30, onHit }` — whose `effectType`
 *                      is neither. The bare arm.
 *
 * THAT IS THE SHAPE OF THE TAG, NOT A PROPERTY OF ONE MOVE. `proceduralStatus` is derived by
 * `engine/tag_dex.js` from exactly this: a secondary with a chance, no `status`, and a
 * `sample([...])` inside its own `onHit`. Both legal members are printed by arm 1.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 * Every line below is the one the ENGINE emitted. Nothing is recomputed alongside it.
 *
 *   1  FIXTURE   the `proceduralStatus` family, its statuses and its carrier are derived and printed
 *   2  CONTROL   a DECLARED sleep move — `sec.status` or a primary `status` — still NAMES the move
 *                in both engines, so the fix is the anonymous shape and not "sleep never names"
 *   3  TEST      the procedural sleep is announced BARE in both engines
 *   4  CONTROL   and the same click's NON-sleep statuses are bare in both engines too, before AND
 *                after — the other two thirds of the roll were never attributed and must not become so
 *   5  CONTROL   the sleep DURATION distribution is unchanged by the attribution: both engines lose
 *                1 turn about a third of the time and 2 turns about two thirds, off `sample([2,3,3])`
 *   6  COUNTER   MEDSEEN.proceduralStatusApplied and MEDSEEN.slpUnattributedAnonEffect are non-zero
 *
 * `MEDI_PROCEDURAL_STATUS_NAMES_MOVE=1` restores the invented attribution. The parent re-runs ITSELF
 * under it and FAILS if that child passes.
 *
 * DECLARED REMAINDER, NOT FIXED HERE AND NOT BUNDLED: the Champions override ALSO adds a refusal the
 * engine does not carry — `if (target.status) { add('-fail', target, status===target.status ? status
 * : undefined); return; }`, measured in the authority as `|-fail|p2a: Milotic|slp` and
 * `|-fail|p2a: Milotic`. It is Dire-Claw-only ("This seems to only happen with Dire Claw", the mod's
 * own comment), so wiring it needs a new `proceduralStatus` param derived from the handler source
 * rather than a move name — and `engine/tag_dex.js` currently exhausts the heap under
 * `tools/lownode.cmd`, so `data/tags.json` could not be regenerated in this pass. Owed, unprobed,
 * and stated rather than swept into this arm.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE PROCEDURAL SLEEP ATTRIBUTION');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_PROCEDURAL_STATUS_NAMES_MOVE === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const uses = id => (TAGS.moves && TAGS.moves[id] && TAGS.moves[id].uses) || 0;

console.log('\n== A SLEEP CHOSEN INSIDE THE HANDLER IS ANNOUNCED BARE =='
  + (CHILD ? '   [MEDI_PROCEDURAL_STATUS_NAMES_MOVE=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FIXTURE, DERIVED.
 * ============================================================================================= */
const PROC = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('proceduralStatus') >= 0 && legal(dex.moves.get(k)))
  .map(k => ({ id: k, p: TAGS.moves[k].params.proceduralStatus, uses: uses(k) }))
  .sort((a, b) => b.uses - a.uses);
console.log('  THE `proceduralStatus` FAMILY legal here:');
console.log('    ' + (PROC.map(m => m.id + ' p=' + m.p.p + ' oneOf=' + JSON.stringify(m.p.oneOf)
  + ' uses=' + m.uses).join('\n    ') || 'NONE'));
const SLEEPERS = PROC.filter(m => (m.p.oneOf || []).indexOf('slp') >= 0);
if (!SLEEPERS.length) { console.log('  NOT RUN — no legal member of the family can roll `slp`.'); process.exit(2); }
const PS = SLEEPERS[0];

/* THE CONTROL MOVE: a legal move that DECLARES sleep — the shape that DOES reach `setStatus` with
 * the move attached. Derived off the dex field, never named. */
const DECLARED = dex.moves.all().filter(legal)
  .filter(m => m.status === 'slp' || (m.secondary && m.secondary.status === 'slp')
    || (m.secondaries || []).some(s => s && s.status === 'slp'))
  .map(m => ({ id: m.id, acc: m.accuracy, uses: uses(m.id) }))
  .sort((a, b) => (b.acc === true ? 101 : b.acc) - (a.acc === true ? 101 : a.acc) || b.uses - a.uses);
console.log('  LEGAL moves that DECLARE sleep (the control shape): '
  + (DECLARED.map(m => m.id + ' acc=' + m.acc).join(', ') || 'NONE'));
if (!DECLARED.length) { console.log('  NOT RUN — no declared-sleep move to control against.'); process.exit(2); }
/* The control move is the FIRST declared-sleep move that a legal, buildable body actually learns —
 * the highest-accuracy one is preferred, but a move with no carrier in this format is not a control,
 * it is a fixture failure, so the list is walked rather than indexed. */

/* A TARGET that is immune to nothing this probe throws and never attacks: derived as a legal body
 * with a self-target heal and no status immunity to sleep, poison or paralysis. */
let TGT = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => b.baseStats.hp - a.baseStats.hp)) {
  const fill = Object.keys(LS(s)).find(id => { const m = dex.moves.get(id);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self' && m.heal; });
  if (!fill) continue;
  if (!dex.getImmunity('psn', s) || !dex.getImmunity('par', s)) continue;
  const abs = Object.values(s.abilities).map(a => dex.abilities.get(a).id);
  if (abs.some(a => ['insomnia', 'vitalspirit', 'comatose', 'purifyingsalt', 'sweetveil', 'limber',
                     'immunity', 'naturalcure', 'shedskin', 'overcoat', 'magicguard'].indexOf(a) >= 0)) continue;
  /* AND IT MUST NOT REFUSE THE CONTROL MOVE EITHER. Every declared-sleep move in this format carries
   * `powder`, which Grass types and Overcoat bodies are immune to — a target that refuses the control
   * makes the control vacuous rather than green. */
  if (s.types.indexOf('Grass') >= 0) continue;
  let built = null; try { built = MEDI.buildMon(mcKey(s.name, { mayMiss: 'the target must be a real row' }), {}); } catch (e) { built = null; console.error('probe fixture: buildMon threw for ' + (s && s.name) + ' -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); }
  if (!built) continue;
  TGT = { sp: s, fill, ab: dex.abilities.get(Object.values(s.abilities)[0]).id }; break;
}
if (!TGT) { FIXTURE('no legal target that can take all three statuses and carries a self-heal'); process.exit(2); }

const carrierOf = (mv, alsoLearns) => {
  for (const s of dex.species.all().filter(legal).sort((a, b) => b.baseStats.spe - a.baseStats.spe)) {
    if (!LS(s)[mv]) continue;
    if (alsoLearns && !LS(s)[alsoLearns]) continue;
    let built = null; try { built = MEDI.buildMon(mcKey(s.name, { mayMiss: 'the attacker must be a real row' }), {}); } catch (e) { built = null; console.error('probe fixture: buildMon threw for ' + (s && s.name) + ' -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); }
    if (!built) continue;
    return { sp: s, ab: dex.abilities.get(Object.values(s.abilities)[0]).id };
  }
  return null;
};
const ATK = carrierOf(PS.id);
if (!ATK) { FIXTURE('no legal carrier of ' + PS.id); process.exit(2); }
let DEC = null, CTL = null;
/* The control carrier must ALSO learn a shield: arm 5 sleeps the target ONCE and then has to spend
 * five turns doing nothing, and a carrier that can only re-click the sleep move re-applies it — which
 * turns a 1-or-2 histogram into a 3-4-5 one and measures the wrong thing. */
for (const d of DECLARED) { const c = carrierOf(d.id, 'protect'); if (c) { DEC = d; CTL = c; break; } }
if (!CTL) { FIXTURE('no legal carrier of any declared-sleep move'); process.exit(2); }

console.log('\n  CHOSEN   procedural=' + PS.id + ' from ' + ATK.sp.name
  + '   declared=' + DEC.id + ' from ' + CTL.sp.name
  + '\n           target=' + TGT.sp.name + ' (' + TGT.ab + ', filler ' + TGT.fill + ')');

/* ================================================================================================
 * THE TWO RUNS. `turns` clicks of `mv` at the target, every other body healing. The `-status` lines
 * are collected verbatim; each run reports which ones it saw.
 * ============================================================================================= */
const lcg = s => { let x = (s >>> 0) || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
/* `-` IS KEPT. Every event name in the protocol begins with one (`|-status|`), and a normaliser that
 * strips it turns every assertion below into a filter that matches nothing — which reads as "the
 * mechanic never fired" and is the probe being wrong, not the engine. */
const norm = l => String(l).toLowerCase().replace(/[^a-z0-9|:\[\]-]/g, '');

function runMedi(atk, mv, turns, seed) {
  const mk = (name, moves, ab) => { const b = MEDI.buildMon(mcKey(name, { mayMiss: 'a probe body must be a real row' }), {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = moves.map(m => dex.moves.get(m).id); b.item = ''; b.ability = ab; return b; };
  const A = mk(atk.sp.name, [mv, mv], atk.ab), A2 = mk(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab);
  const V = mk(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab), V2 = mk(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab);
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  const rng = lcg(seed);
  for (let t = 0; t < turns; t++) MEDI.battleTurn(S, rng,
    new Map([[A, MEDI.playerAction(A, mv, V, S.field)], [A2, MEDI.playerAction(A2, TGT.fill, null, S.field)]]),
    new Map([[V, MEDI.playerAction(V, TGT.fill, null, S.field)], [V2, MEDI.playerAction(V2, TGT.fill, null, S.field)]]));
  return trace.map(norm).filter(l => /^\|-status\|/.test(l));
}

function runSD(atk, mv, turns, seed) {
  const set = (n, mvs, ab) => ({ name: n, species: n, item: '', ability: dex.abilities.get(ab).name,
    moves: mvs.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [seed, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(atk.sp.name, [mv, mv], atk.ab), set(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab)]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab), set(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab)]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  for (let t = 0; t < turns && !b.ended; t++) {
    b.choose('p1', 'move ' + mv + ' 1, move ' + TGT.fill);
    b.choose('p2', 'move ' + TGT.fill + ', move ' + TGT.fill);
  }
  return b.log.map(norm).filter(l => /^\|-status\|/.test(l));
}

/* Sweep seeds until each engine has produced its first `slp` line from this move. The two engines
 * do NOT have to agree on WHICH seed sleeps — this arm is about the SHAPE of the line, and pairing
 * them by seed would make it a die-address test wearing an attribution test's name. */
const firstSlp = (fn, atk, mv, turns, seeds) => {
  for (let s = 1; s <= seeds; s++) { const L = fn(atk, mv, turns, s).filter(l => /\|slp/.test(l)); if (L.length) return L[0]; }
  return null;
};
const allOf = (fn, atk, mv, turns, seeds) => { const out = []; for (let s = 1; s <= seeds; s++) out.push(...fn(atk, mv, turns, s)); return out; };

/* ================================================================================================
 * 2 — CONTROL: a DECLARED sleep still names its move, in both engines.
 * ============================================================================================= */
const decM = firstSlp(runMedi, CTL, DEC.id, 3, 40), decS = firstSlp(runSD, CTL, DEC.id, 3, 40);
console.log('\n  DECLARED  medi ' + JSON.stringify(decM) + '\n            sd   ' + JSON.stringify(decS));
if (!decM || !decS) { FIXTURE(DEC.id + ' never landed a sleep in 40 seeds in one of the engines'); }
else ok(/\[from\]move:/.test(decM) && /\[from\]move:/.test(decS) && decM === decS,
  'CONTROL — a DECLARED sleep move still NAMES itself, in both engines',
  'medi ' + decM + '\n          sd   ' + decS);

/* ================================================================================================
 * 3 — TEST: the procedural sleep.
 * ============================================================================================= */
const procM = firstSlp(runMedi, ATK, PS.id, 4, 40), procS = firstSlp(runSD, ATK, PS.id, 4, 40);
console.log('\n  PROCEDURAL medi ' + JSON.stringify(procM) + '\n             sd   ' + JSON.stringify(procS));
if (!procM || !procS) { FIXTURE(PS.id + ' never rolled a sleep in 40 seeds in one of the engines'); }
else {
  ok(procM === procS && !/\[from\]/.test(procS),
    'TEST — the procedural sleep is announced BARE, in both engines',
    'medi ' + procM + '\n          sd   ' + procS);
}

/* ================================================================================================
 * 4 — CONTROL: the other two thirds of the same roll. Bare before AND after.
 * ============================================================================================= */
const otherM = allOf(runMedi, ATK, PS.id, 4, 25).filter(l => !/\|slp/.test(l));
const otherS = allOf(runSD, ATK, PS.id, 4, 25).filter(l => !/\|slp/.test(l));
const shapes = L => [...new Set(L.map(l => l.replace(/\|p\d[ab]:[a-z0-9]+/, '|<body>')))].sort();
console.log('\n  NON-SLEEP medi ' + JSON.stringify(shapes(otherM)) + '\n            sd   ' + JSON.stringify(shapes(otherS)));
ok(otherM.length > 0 && otherS.length > 0
   && otherM.every(l => !/\[from\]/.test(l)) && otherS.every(l => !/\[from\]/.test(l)),
  'CONTROL — the same click\'s NON-sleep statuses are bare in both engines (they always were)',
  'medi ' + otherM.length + ' line(s) ' + JSON.stringify(shapes(otherM))
  + '\n          sd   ' + otherS.length + ' line(s) ' + JSON.stringify(shapes(otherS)));

/* ================================================================================================
 * 5 — CONTROL: the sleep CLOCK is untouched by the attribution.
 *
 * This arm is here because the batch that named this defect diagnosed it as a CLOCK — "a `slp` clock
 * we hold one turn past the authority" — and that is REFUTED. Champions samples `[2,3,3]`, so one
 * missed turn about a third of the time and two about two thirds, and both engines do. The board
 * divergence in the corpus games is the DRAW, not the model, and this arm is what says so.
 * ============================================================================================= */
function missedTurns(engineIsMedi, seed) {
  if (engineIsMedi) {
    const mk = (name, moves, ab) => { const b = MEDI.buildMon(mcKey(name, { mayMiss: 'x' }), {});
      b.moves = moves.map(m => dex.moves.get(m).id); b.item = ''; b.ability = ab; return b; };
    const A = mk(CTL.sp.name, [DEC.id, 'protect'], CTL.ab), A2 = mk(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab);
    const V = mk(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab), V2 = mk(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab);
    const trace = []; const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
    const rng = lcg(seed);
    for (let t = 0; t < 7; t++) MEDI.battleTurn(S, rng,
      new Map([[A, t === 0 ? MEDI.playerAction(A, DEC.id, V, S.field) : MEDI.playerAction(A, 'protect', null, S.field)],
               [A2, MEDI.playerAction(A2, TGT.fill, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, TGT.fill, null, S.field)], [V2, MEDI.playerAction(V2, TGT.fill, null, S.field)]]));
    const L = trace.map(norm);
    return L.some(l => /^\|-status\|.*slp/.test(l)) ? L.filter(l => /^\|cant\|.*slp/.test(l)).length : null;
  }
  const set = (n, mvs, ab) => ({ name: n, species: n, item: '', ability: dex.abilities.get(ab).name,
    moves: mvs.map(m => dex.moves.get(m).name), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [seed, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(CTL.sp.name, [DEC.id, 'protect'], CTL.ab), set(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab)]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab), set(TGT.sp.name, [TGT.fill, TGT.fill], TGT.ab)]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  for (let t = 0; t < 7 && !b.ended; t++) {
    b.choose('p1', (t === 0 ? 'move ' + DEC.id + ' 1' : 'move protect') + ', move ' + TGT.fill);
    b.choose('p2', 'move ' + TGT.fill + ', move ' + TGT.fill);
  }
  const L = b.log.map(norm);
  return L.some(l => /^\|-status\|.*slp/.test(l)) ? L.filter(l => /^\|cant\|.*slp/.test(l)).length : null;
}
const hist = (isMedi) => { const h = {}; for (let s = 1; s <= 200; s++) { const v = missedTurns(isMedi, s); if (v !== null && v > 0) h[v] = (h[v] || 0) + 1; } return h; };
const hM = hist(true), hS = hist(false);
const share = h => { const n = Object.values(h).reduce((a, b2) => a + b2, 0) || 1; return (((h[1] || 0) / n)).toFixed(2); };
console.log('\n  CLOCK     medi missed-turn histogram ' + JSON.stringify(hM)
  + '\n            sd   missed-turn histogram ' + JSON.stringify(hS));
ok(Object.keys(hM).sort().join(',') === '1,2' && Object.keys(hS).sort().join(',') === '1,2'
   && Math.abs(+share(hM) - +share(hS)) < 0.10,
  'CONTROL — the sleep CLOCK is the same model in both engines: only 1 or 2 missed turns, one third at 1',
  'medi ' + JSON.stringify(hM) + ' share(1)=' + share(hM)
  + '   authority ' + JSON.stringify(hS) + ' share(1)=' + share(hS)
  + '   [this is what REFUTES the "one turn long" diagnosis]');

/* ================================================================================================
 * 6 — COUNTER.
 * ============================================================================================= */
const C = MEDI.MEDSEEN || {}, F = MEDI.MEDFAILS || {};
ok((C.proceduralStatusApplied || 0) > 0 && (CHILD ? (F.proceduralStatusNamesMoveRestored || 0) > 0
                                                  : (C.slpUnattributedAnonEffect || 0) > 0),
  'COUNTER — the branch applied statuses AND the sleep took the anonymous arm during this run',
  'proceduralStatusApplied=' + (C.proceduralStatusApplied === undefined ? 'ABSENT' : C.proceduralStatusApplied)
  + '  slpUnattributedAnonEffect=' + (C.slpUnattributedAnonEffect === undefined ? 'ABSENT' : C.slpUnattributedAnonEffect)
  + '  proceduralStatusNamesMoveRestored=' + (F.proceduralStatusNamesMoveRestored === undefined ? 'ABSENT' : F.proceduralStatusNamesMoveRestored));

/* ================================================================================================
 * THE KNOB.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename],
    { env: { ...process.env, MEDI_PROCEDURAL_STATUS_NAMES_MOVE: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const a = (out.match(/^ *(PASS|FAIL) *TEST — the procedural sleep is announced BARE.*$/m) || [''])[0].trim();
  const b2 = (out.match(/^ *(PASS|FAIL) *CONTROL — a DECLARED sleep move still NAMES itself.*$/m) || [''])[0].trim();
  ok(r.status !== 0,
    'KNOB — restoring the invented `[from] move:` REDS this probe',
    'child exit ' + r.status + '\n          ' + (a || '(no procedural arm printed — the knob is not wired)')
    + '\n          ' + (b2 || '(no declared control printed)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
