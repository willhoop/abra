#!/usr/bin/env node
/* tests/probe_multihit_reaction_per_arrival.js — EVERY LEGAL ON-HIT CHANCE REACTOR AGAINST EVERY LEGAL
 * MULTI-HIT MOVE, PLAYED IN BOTH ENGINES, ONE ARRIVAL AT A TIME.
 *
 *   SHOWDOWN_PATH=... node tests/probe_multihit_reaction_per_arrival.js --release <id>
 *   ... MEDI_REACT_LATE_ONCE=1      (red)  Cursed Body and Poison Touch pay once per MOVE again
 *   ... MEDI_MULTIACC_UPFRONT=1     (red)  the per-arrival accuracy dice are drawn before the first hit
 *   ... MEDI_VOLLEY_IGNORES_SLEEP=1 (red)  a volley goes on after its user fell asleep mid-volley
 *   ... MEDI_SPORE_DIE_UNGATED=1    (red)  Effect Spore throws its die at a powder-immune attacker
 * ==================================================================================================
 *
 * 2026-09-19. The last whole-game lead on the 1950 lattice (docs/_reports/2026-09-19-gameend-dice.md,
 * GROUP 3): Cursed Body against Triple Axel. Read off the authority, not recalled:
 *
 *   data/mods/champions/scripts.ts `hitStepMoveHitLoop` (Champions OVERRIDES it; sim/battle-actions.ts is
 *   the mainline copy) runs `spreadMoveHit` ONCE PER HIT, and `spreadMoveHit` raises
 *   `runEvent('DamagingHit', ...)` at its step 7. So every `onDamagingHit` / `onSourceDamagingHit` handler
 *   runs once per ARRIVAL. For a `multiaccuracy` move the loop rolls
 *       if (target && move.multiaccuracy && hit > 1) { ... randomChance(accuracy, 100) ... break }
 *   at the TOP of arrivals 2..n, i.e. BETWEEN arrival k-1's reaction dice and arrival k's damage. The loop
 *   also opens every arrival with
 *       if (hit > 1 && pokemon.status === 'slp' && (!isSleepUsable || gen === 4)) break;
 *   so a user put to sleep by an arrival's reaction (Effect Spore) throws nothing more.
 *
 * WHAT THIS ENGINE DID: paid Cursed Body and Poison Touch ONCE per move (the `_dhAbil` / `_dhSrc`
 * closures, armed in `_stepEffects` below the whole volley), drew every per-arrival accuracy die in
 * `rollHitsOf` BEFORE the first hit, ignored a mid-volley sleep, and threw Effect Spore's die at a Grass
 * attacker whose `runStatusImmunity('powder')` the authority's handler asks first.
 *
 * THE CLASS IS DERIVED, NOT NAMED: every legal ability (with a legal carrier) whose `onDamagingHit` or
 * `onSourceDamagingHit` handler throws a die, crossed with every legal damaging `multihit` move; a
 * contact-gated handler is only crossed with contact moves. Each pairing is staged K times with k idle
 * turns in front of the attack, because the middle arm keys every die on `turn` and a single turn is one
 * coin. EVERY game must agree on the protocol stream and on the board at every turn boundary.
 *
 * NON-VACUITY is asserted separately: the authority must show a reaction landing BETWEEN two arrivals of
 * a volley for Cursed Body and for Poison Touch, and a multiaccuracy volley must interleave its accuracy
 * dice with a reactor's dice on one address. Each knob runs in a child and must make the sweep part.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const NL = String.fromCharCode(10);
/* Requiring engine/game_differential.js with no `--release` CUTS A RELEASE INTO THE REAL STORE at require
 * time, so this refuses unless a release is named or tests/_live_release.js was preloaded with `-r`. */
if (!process.argv.includes('--release')
    && !require.cache[require.resolve(path.join(ROOT, 'tests', '_live_release.js'))]) {
  console.log('REFUSING TO RUN — pass --release <id>, or preload tests/_live_release.js with -r.');
  process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOBS = ['MEDI_REACT_LATE_ONCE', 'MEDI_MULTIACC_UPFRONT', 'MEDI_VOLLEY_IGNORES_SLEEP', 'MEDI_SPORE_DIE_UNGATED'];
const ARMED = KNOBS.filter(k => process.env[k] === '1');
const CHILD = process.env.PROBE_MHR_CHILD === '1';
const K = +(process.env.PROBE_MHR_K || 8);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail != null ? '   — ' + detail : ''));
  if (!cond) bad++;
  return cond;
};
console.log(NL + 'tests/probe_multihit_reaction_per_arrival.js — on-hit chance reactors x multi-hit moves, per arrival'
  + (ARMED.length ? '   [KNOB ARMED: ' + ARMED.join(',') + ']' : ''));

const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const D = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const learns = (s, mv) => {
  let cur = s;
  for (let g = 0; cur && g < 6; g++) {
    const l = D.species.getLearnsetData(cur.id);
    if (l && l.learnset && l.learnset[mv]) return true;
    cur = cur.prevo ? D.species.get(cur.prevo) : null;
  }
  return false;
};
const POOL = D.species.all().filter(s => legal(s) && !/mega/i.test(s.forme || '') && !s.battleOnly);
const abIds = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);

/* ---- 1. THE CLASS, DERIVED ------------------------------------------------------------------------ */
const REACTORS = [];
for (const a of D.abilities.all()) {
  if (!legal(a)) continue;
  const carriers = POOL.filter(s => abIds(s).includes(a.id));
  if (!carriers.length) continue;
  for (const h of ['onDamagingHit', 'onSourceDamagingHit']) {
    if (typeof a[h] !== 'function') continue;
    const src = a[h].toString();
    if (!/randomChance\(|\.random\(/.test(src)) continue;
    REACTORS.push({ id: a.id, name: a.name, side: h === 'onDamagingHit' ? 'target' : 'source',
                    contact: /checkMoveMakesContact/.test(src), powder: /runStatusImmunity\(["']powder/.test(src),
                    carriers });
  }
}
const MULTI = D.moves.all().filter(m => legal(m) && m.multihit && m.basePower > 0 && m.category !== 'Status');
console.log(NL + '  === THE CLASS, DERIVED THIS RUN ===');
for (const r of REACTORS) console.log('    reactor ' + r.id.padEnd(13) + ' ' + r.side.padEnd(6) + (r.contact ? ' contact' : ' any-hit')
  + (r.powder ? ' powder-gated' : '') + '   carriers: ' + r.carriers.map(s => s.name).join(', '));
for (const m of MULTI) console.log('    move    ' + m.id.padEnd(15) + ' ' + JSON.stringify(m.multihit).padEnd(6)
  + (m.multiaccuracy ? ' multiaccuracy' : '') + (m.flags.contact ? ' contact' : ''));
ok(REACTORS.length > 0 && MULTI.length > 0, 'the class is not empty', REACTORS.length + ' reactors x ' + MULTI.length + ' moves');
ok(REACTORS.some(r => r.id === 'cursedbody') && MULTI.some(m => m.id === 'tripleaxel'),
   'the lead itself (Cursed Body, Triple Axel) is inside the derived class');

/* ---- 2. THE CAST ------------------------------------------------------------------------------------ */
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const tagsOf = id => (((TAGS.abilities || {})[id] || {}).tags) || [];
const REACTOR_IDS = new Set(REACTORS.map(r => r.id));
/* A QUIET ABILITY: every tag it carries is a passive modifier (none acts on entry, at the residual, on
 * the field or on the attacker's own volley), it is legal, and it is not itself a reactor. Skill Link
 * would delete the multiaccuracy roll and hide the address half entirely; a -ate ability would change
 * the move's type; Intimidate, a weather setter or Shed Skin would throw dice of their own. */
const PASSIVE = new Set(['breakable', 'damageBoost', 'preventsStatDrop', 'typeImmunity', 'refusesCopy', 'statusImmune',
  'halvesTypeDamage', 'boostsMoveClass', 'damageReduce', 'preventsCrit', 'weatherChipImmune', 'refusesVolatile',
  'critRatioUp', 'stabBoost', 'speedCond']);
const quietAb = s => Object.values(s.abilities).find(a => { const ab = D.abilities.get(a);
  return legal(ab) && !REACTOR_IDS.has(ab.id) && tagsOf(ab.id).every(t => PASSIVE.has(t)); });
const immune = (m, s) => !D.getImmunity(m.type, s);
const IDLE = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && !m.selfSwitch
  && !m.selfdestruct && m.boosts && Object.values(m.boosts).every(v => v > 0) && !m.boosts.evasion && !m.boosts.accuracy
  && !m.heal && !m.flags.charge).sort((a, b) => a.id.localeCompare(b.id));
const idleOf = s => IDLE.find(m => learns(s, m.id));
/* The fillers never act but Protect, and carry an ability with no tag, so they cannot touch the lines. */
const FILLERS = POOL.filter(s => learns(s, 'protect') && quietAb(s))
  .map(s => ({ name: s.name, ab: quietAb(s), id: s.id }));

const PAIRS = [];
const NOPAIR = [];
for (const r of REACTORS) {
  for (const mv of MULTI) {
    if (r.contact && !mv.flags.contact) continue;
    let att = null, def = null, attAb = null, defAb = null;
    if (r.side === 'target') {
      for (const d of r.carriers) {
        if (!idleOf(d)) continue;
        const a = POOL.find(s => s.id !== d.id && learns(s, mv.id) && !immune(mv, d) && quietAb(s)
          /* the powder gate is exercised on its own arm below: here, a body that DOES take the die */
          && !(r.powder && s.types.includes('Grass')));
        if (a) { att = a; def = d; break; }
      }
      if (att) { attAb = quietAb(att); defAb = r.name; }
    } else {
      for (const a of r.carriers) {
        if (!learns(a, mv.id)) continue;
        const d = POOL.find(s => s.id !== a.id && !immune(mv, s) && idleOf(s) && quietAb(s)
          && !s.types.includes('Poison') && !s.types.includes('Steel'));
        if (d) { att = a; def = d; break; }
      }
      if (att) { attAb = r.name; defAb = quietAb(def); }
    }
    if (!att) { NOPAIR.push(r.id + ' x ' + mv.id); continue; }
    PAIRS.push({ r, mv, att, def, attAb, defAb, tag: r.id + ' x ' + mv.id });
  }
}
/* THE POWDER ARM: the one reactor whose handler asks the attacker's powder immunity, against a Grass
 * attacker. The authority throws NO die here; a die thrown by one engine only shifts `nth` for the rest. */
for (const r of REACTORS.filter(x => x.powder)) {
  for (const mv of MULTI.filter(m => m.flags.contact)) {
    const d = r.carriers.find(c => idleOf(c));
    const a = d && POOL.find(s => s.types.includes('Grass') && s.id !== d.id && learns(s, mv.id) && !immune(mv, d) && quietAb(s));
    if (a) { PAIRS.push({ r, mv, att: a, def: d, attAb: quietAb(a), defAb: r.name, tag: r.id + ' x ' + mv.id + ' [Grass attacker]', powderArm: true }); break; }
  }
}
console.log(NL + '  ' + PAIRS.length + ' pairings staged, ' + NOPAIR.length + ' with no legal cast'
  + (NOPAIR.length ? ' (' + NOPAIR.join(', ') + ')' : ''));
ok(PAIRS.some(p => p.r.id === 'cursedbody' && p.mv.id === 'tripleaxel'), 'Cursed Body x Triple Axel is staged');
ok(PAIRS.some(p => p.powderArm) || !REACTORS.some(r => r.powder), 'the powder-gated reactor has a Grass-attacker arm');
ok(FILLERS.length >= 6, 'six filler bodies exist', FILLERS.length);

/* ---- 3. PLAY ---------------------------------------------------------------------------------------- */
const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js — this probe needs its event dice');
console.log('  release ' + G.REL.id + '   K = ' + K + ' staged copies per pairing');
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });

const REACT_LINE = /\|-start\||\|-status\||\|-activate\|/;
const results = [];
for (const P of PAIRS) {
  const fill = FILLERS.filter(f => ![P.att.id, P.def.id].includes(f.id)).slice(0, 6);
  const A = [mon(P.att.name, P.attAb, [P.mv.name, 'Protect'])].concat(fill.slice(0, 3).map(f => mon(f.name, f.ab, ['Protect'])));
  const idle = idleOf(P.def);
  const B = [mon(P.def.name, P.defAb, [idle.name, 'Protect'])].concat(fill.slice(3, 6).map(f => mon(f.name, f.ab, ['Protect'])));
  for (let k = 0; k < K; k++) {
    const script = [];
    for (let i = 0; i < k; i++) script.push({ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: norm(idle.id) }, { m: 'protect' }] });
    script.push({ p1: [{ m: norm(P.mv.id), t: 0 }, { m: 'protect' }], p2: [{ m: norm(idle.id) }, { m: 'protect' }] });
    if (G.midResetAddresses) G.midResetAddresses();
    if (G.resetScriptCounters) G.resetScriptCounters();
    const a = G.buildPair(A), b = G.buildPair(B);
    const parts = [];
    const r = (!a || !b) ? { err: 'buildPair returned null' } : G.playGame(a, b, 'directed', 'mhr-' + P.tag + '-' + k,
      { script, arm: ARM, onBoundary: (snap, t) => { if ((snap.diffs || []).length) parts.push({ t, d: snap.diffs.slice(0, 3) });
                                                     snap.identical = true; snap.diffs = []; } });
    const SC = G.scriptCounters();
    const sd = r.err ? [] : G.sdStream(G.lastSdLog()).map(String);
    /* THE ATTACK TURN'S VOLLEY, AS THE AUTHORITY PLAYED IT: a reaction line with a `-damage` on the target
     * after it, before `-hitcount`, is a proc BETWEEN two arrivals. */
    const T = k + 1, i0 = sd.indexOf('|turn|' + T), seg = i0 < 0 ? [] : sd.slice(i0);
    const hc = seg.findIndex(l => /^\|-hitcount\|/.test(l));
    const vol = hc < 0 ? [] : seg.slice(0, hc);
    const firstDmg = vol.findIndex(l => /^\|-damage\|p2a/.test(l));
    let midProc = false;
    for (let j = firstDmg + 1; firstDmg >= 0 && j < vol.length; j++) {
      if (REACT_LINE.test(vol[j]) && vol.slice(j + 1).some(l => /^\|-damage\|p2a/.test(l))) { midProc = true; break; }
    }
    const ad = G.midAddresses ? G.midAddresses() : { sd: [], me: [] };
    const anyAt = ad.sd.filter(x => x.indexOf('|' + T + '|any|' + P.mv.id + '|') > 0).length;
    results.push({ P, k, err: r.err || (SC.moveNotOnRequest ? 'scripted click not on the request: ' + SC.firstMissing : null),
                   div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, parts, midProc, anyAt,
                   hits: hc >= 0 ? +String(seg[hc]).split('|').pop() : null });
  }
}

/* ---- 4. VERDICT ------------------------------------------------------------------------------------- */
const byPair = new Map();
for (const x of results) { if (!byPair.has(x.P.tag)) byPair.set(x.P.tag, []); byPair.get(x.P.tag).push(x); }
console.log(NL + '  === PER PAIRING (games parted / staged, authority mid-volley procs) ===');
for (const [tag, xs] of byPair) {
  const P = xs[0].P;
  const parted = xs.filter(x => x.err || x.div || x.parts.length);
  console.log('    ' + (parted.length ? 'PART ' : 'ok   ') + tag.padEnd(40) + ' ' + P.att.name + ' @' + P.attAb + ' -> ' + P.def.name + ' @' + P.defAb
    + '   ' + parted.length + '/' + xs.length + '   mid-volley ' + xs.filter(x => x.midProc).length);
  for (const x of parted.slice(0, 2)) console.log('           k=' + x.k + ' ' + (x.err ? 'ERR ' + x.err : '')
    + (x.div ? ' div sd=' + x.div.sd + ' | me=' + x.div.me : '')
    + (x.parts.length ? ' BOARD t' + x.parts[0].t + ' ' + x.parts[0].d.map(d => d.path + ' me ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)).join('; ') : ''));
}
const errs = results.filter(x => x.err);
const divs = results.filter(x => !x.err && x.div);
const boards = results.filter(x => !x.err && x.parts.length);
const partedGames = results.filter(x => x.err || x.div || x.parts.length);
console.log(NL + '  === THE VERDICT ===');
ok(errs.length === 0, 'every staged game played its whole script', errs.length ? errs.length + ' threw, first ' + errs[0].P.tag + ': ' + errs[0].err : null);
ok(divs.length === 0, 'every game: the two protocol streams agree', divs.length ? divs.length + ' parted, first ' + divs[0].P.tag + ' k=' + divs[0].k : results.length + ' games');
ok(boards.length === 0, 'every game: the boards agree at every turn boundary', boards.length ? boards.length + ' parted' : null);
const wit = id => results.filter(x => x.P.r.id === id && x.midProc && !x.P.powderArm).length;
ok(wit('cursedbody') > 0, 'NON-VACUOUS: the authority landed Cursed Body BETWEEN two arrivals at least once', wit('cursedbody'));
ok(!REACTORS.some(r => r.id === 'poisontouch') || wit('poisontouch') > 0,
   'NON-VACUOUS: the authority landed Poison Touch BETWEEN two arrivals at least once', wit('poisontouch'));
const maMix = results.filter(x => x.P.mv.multiaccuracy && x.anyAt >= 3 && (x.hits || 0) >= 2).length;
ok(maMix > 0, 'NON-VACUOUS: a multiaccuracy volley drew accuracy AND reaction dice on one address', maMix + ' games');
console.log('  counters: lateReactPerArrival ' + (M.MEDSEEN.lateReactPerArrival | 0)
  + '   multiAccLazyDrawn ' + (M.MEDSEEN.multiAccLazyDrawn | 0) + '   multiAccLazyStopped ' + (M.MEDSEEN.multiAccLazyStopped | 0)
  + '   volleyStoppedUserAsleep ' + (M.MEDSEEN.volleyStoppedUserAsleep | 0) + '   sporeDieRefusedPowder ' + (M.MEDSEEN.sporeDieRefusedPowder | 0));
if (!ARMED.length) {
  ok((M.MEDSEEN.lateReactPerArrival | 0) > 0, 'the per-arrival late reactor wire actually ran (counter moved)');
  ok((M.MEDSEEN.multiAccLazyDrawn | 0) > 0, 'the lazy per-arrival accuracy draw actually ran (counter moved)');
}

if (CHILD) {
  console.log('__CHILD__' + JSON.stringify({ parted: partedGames.map(x => x.P.tag + '#' + x.k) }));
  process.exit(bad ? 1 : 0);
}
/* ---- 5. EACH KNOB MUST MAKE THE SWEEP PART, IN A CHILD ---------------------------------------------- */
if (!ARMED.length) {
  const { spawnSync } = require('child_process');
  const want = { MEDI_REACT_LATE_ONCE: t => /^(cursedbody|poisontouch) x /.test(t),
                 MEDI_MULTIACC_UPFRONT: t => /x (tripleaxel|populationbomb)/.test(t),
                 MEDI_VOLLEY_IGNORES_SLEEP: t => /^effectspore x /.test(t),
                 MEDI_SPORE_DIE_UNGATED: t => /Grass attacker/.test(t) };
  for (const kn of KNOBS) {
    console.log(NL + '  --- child under ' + kn + '=1 ---');
    const c = spawnSync(process.execPath, [...process.execArgv, __filename, ...process.argv.slice(2)],
      { env: { ...process.env, [kn]: '1', PROBE_MHR_CHILD: '1' }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const mark = /__CHILD__(\{.*\})/.exec(String(c.stdout || ''));
    if (!mark) { ok(false, kn + ': the child printed a verdict', 'exit ' + c.status + ' ' + String(c.stderr || '').slice(-400)); continue; }
    const parted = JSON.parse(mark[1]).parted;
    const inScope = parted.filter(p => want[kn](p.split('#')[0]));
    const outScope = parted.filter(p => !want[kn](p.split('#')[0]));
    ok(c.status !== 0 && inScope.length > 0, kn + ' makes the sweep RED on its own arms',
       inScope.length + ' parted in scope' + (inScope.length ? ', first ' + inScope[0] : '')
       + (inScope.length ? '' : '   [an identical result across a varied knob means the knob is UNWIRED]'));
    ok(outScope.length === 0, kn + ' moves nothing outside its own arms', outScope.length ? outScope.slice(0, 4).join(', ') : null);
  }
}
console.log(NL + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
