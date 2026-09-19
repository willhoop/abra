/* probe_tie_order.js — FOUR ORDERINGS THE AUTHORITY DECIDES BY ITS SORT'S INPUTS, NOT BY A DIE, AND ONE
 * ANNOUNCEMENT AT THE CAP. The 2026-09-19 tie-order batch.
 *
 *   SHOWDOWN_PATH=... node tests/probe_tie_order.js --release <id>
 *
 * ================= WHY THESE ARE NOT "EXACT TIES, NOBODY'S FAULT" =====================================
 * Under the differential's pin `PRNG.shuffle` is the identity (engine/game_differential.js pinShuffle), and
 * this engine's `tie` stream is the same constant, so a tied group's order is a DETERMINISTIC function of the
 * list `speedSort` (sim/battle.ts:429-460) was handed and of the swaps its selection sort makes. Under real
 * dice both engines shuffle the tied group off the shared `tie` die. So where the two engines part on a tie,
 * the parting is in the INPUTS — which bodies/handlers are in the list, in what order, on which speed — and
 * each of those is a defect. Five pinned-pool games, four mechanisms:
 *
 *   arm       mechanism (the authority's rule, read)                                   knob
 *   charge    a charge-turn `this.boost` at +6 writes `-boost|..|spa|0`                MEDI_CHARGE_BOOST_ZERO_SILENT
 *             (sim/battle.ts:2076-2077; data/moves.ts:4645 electroshot, meteorbeam alike)
 *   sand      `eachEvent('Weather')` sorts `getAllActive()` — no corpse (:1362-1372)   MEDI_WEATHER_SORT_KEEPS_CORPSES
 *   update    `eachEvent('Update')` sorts the CACHED `pokemon.speed` (pokemon.ts:556)   MEDI_UPDATE_LIVE_SPEED
 *             with the selection sort's swaps, a zero-HP not-yet-fainted body included
 *   perish    `findPokemonEventHandlers` walks `pokemon.volatiles` in INSERTION order    MEDI_VOL_ARTIFACT_ORDER
 *   salt      two order-13 volatiles on one body tie on every key -> insertion order   MEDI_VOL_ARTIFACT_ORDER
 *
 * ================= THE SHAPE ===========================================================================
 * Every arm is a RED board (the mechanism bites) and a CONTROL board (the same bodies, one input changed so
 * the mechanism cannot bite). Both are played on BOTH engines under the pinned `top-tie-first` arm. Then:
 *   - clean (this process): red and control must show NO protocol divergence and NO board divergence;
 *   - under the arm's knob (a child process): the red board MUST part, and the control MUST NOT.
 * Every red board also asserts, off the AUTHORITY's own log, that it staged what it claims (the tie, the
 * corpse, the cap, the order) — a board that did not stage its mechanism is NOT A PASS, never a green.
 * Species are DERIVED from the format and the learnsets on every run, and printed.
 *
 * Exit 0 = all clean arms agree and every knob parts exactly its red. Exit 1 = a clean arm parts (the fix is
 * wrong or gone). Exit 2 = not run / could not stage / a knob did not part its red or parted its control. */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (!arg('--release', null)) {
  console.error('REFUSED — pass --release <id>. Requiring engine/game_differential.js without it CUTS A RELEASE into data/releases as a side effect of loading the module.');
  process.exit(2);
}
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
const ONLY = arg('--only', null);          // a child runs one arm under its knob
const KNOBS = { charge: 'MEDI_CHARGE_BOOST_ZERO_SILENT', sand: 'MEDI_WEATHER_SORT_KEEPS_CORPSES',
                update: 'MEDI_UPDATE_LIVE_SPEED', perish: 'MEDI_VOL_ARTIFACT_ORDER', salt: 'MEDI_VOL_ARTIFACT_ORDER' };

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('NOT RUN — arm top-tie-first is not registered.'); process.exit(2); }

const learns = (s, mv) => { try { const ls = dex.species.getLearnsetData(s.id); return !!(ls && ls.learnset && ls.learnset[mv]); }
  catch (e) { console.error('learnset lookup failed for ' + s.id + ': ' + e.message); return false; } };
const ALL = dex.species.all().filter(s => legal(s) && !s.isMega && !/^Mega/.test(s.forme || '') && !s.battleOnly);
const abil = (s) => Object.values(s.abilities).map(a => dex.abilities.get(a).id);
const types = (s) => s.types;
/* a self-targeting stat move with NO volatile, NO speed change and NO field effect — the idle click, so an
 * idle body adds nothing to any residual list and moves nobody's speed */
const IDLE = dex.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.boosts.spe
  && !m.volatileStatus && !m.self && !m.weather && !m.terrain && !m.sideCondition && !m.pseudoWeather && !m.heal && !m.slotCondition).map(m => m.id);
const idleOf = s => IDLE.find(mv => learns(s, mv)) || null;
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const unsplit = lines => { const out = []; for (let i = 0; i < lines.length; i++) { if (/^\|split\|/.test(String(lines[i]))) { i++; continue; } out.push(lines[i]); } return out; };

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { err: 'buildPair returned null' };
  const r = G.playGame(a, b, 'directed', 'tieorder:' + tag, { script, arm: ARM });
  const sd = unsplit(G.lastSdLog() || []).map(String);
  return { err: r.err, div: r.div || null, stateDiv: r.stateDiv || null, sd, me: (r.mediTrace || []).map(String), illegal: G.fixtureIllegal() };
}
const divText = d => d ? ('index ' + d.index + ': ' + String(d.showdown || d.sd || '').slice(0, 90) + ' <> ' + String(d.medicham || d.me || '').slice(0, 90)) : 'none';
const idx = (lines, re) => lines.findIndex(l => re.test(l));
const bodyName = s => s.name;

/* ============================== the five arms ===================================================== */
const ARMS = {};

/* CHARGE — a Meteor Beam / Electro Shot user clicks a +2 Special Attack setup to +6 and then winds up. The
 * wind-up's own `boost({spa: 1})` caps to 0 and the authority writes `-boost|<it>|spa|0`. CONTROL: one setup
 * fewer (+4), so the wind-up is a real +1 on both engines. */
ARMS.charge = () => {
  const CHARGE = ['electroshot', 'meteorbeam'].filter(m => legal(dex.moves.get(m)));
  const SETUP = dex.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && m.boosts.spa >= 2).map(m => m.id);
  let cand = null;
  for (const s of ALL) { const c = CHARGE.find(m => learns(s, m)), u = SETUP.find(m => learns(s, m)); if (c && u) { cand = { s, c, u }; break; } }
  if (!cand) return { stage: 'no legal species learns a charge-boost move AND a +2 SpA setup' };
  const foe = ALL.find(s => idleOf(s) && s.id !== cand.s.id && !types(s).includes('Rock'));
  const ally = ALL.find(s => idleOf(s) && s.id !== cand.s.id && s.id !== foe.id);
  const i1 = idleOf(ally), i2 = idleOf(foe);
  const A = [mon(cand.s.name, '', '', [cand.u, cand.c]), mon(ally.name, '', '', [i1]), mon(ally.name, '', '', [i1]), mon(ally.name, '', '', [i1])];
  const B = [mon(foe.name, '', '', [i2]), mon(foe.name, '', '', [i2]), mon(foe.name, '', '', [i2]), mon(foe.name, '', '', [i2])];
  const step = (m) => ({ p1: [{ m, t: 0 }, { m: i1 }], p2: [{ m: i2 }, { m: i2 }] });
  const redScript = [step(cand.u), step(cand.u), step(cand.u), step(cand.c)];
  const ctlScript = [step(cand.u), step(cand.u), step(cand.c)];
  const want = new RegExp('^\\|-boost\\|p1a: [^|]*\\|spa\\|0\\s*$');
  return { fixture: cand.s.name + ' (' + cand.u + ' then ' + cand.c + ') vs idle ' + foe.name + ', ally ' + ally.name,
    red: () => play('charge-red', A, B, redScript), control: () => play('charge-control', A, B, ctlScript),
    staged: (red, ctl) => idx(red.sd, want) >= 0 && idx(ctl.sd, want) < 0 && idx(ctl.sd, /^\|-boost\|p1a: [^|]*\|spa\|1/) >= 0,
    what: 'the authority writes `-boost|p1a|spa|0` on the +6 wind-up and `-boost|p1a|spa|1` on the +4 one' };
};

/* SAND — a tied pair (the same species at p1a and p2a, so the same built Speed), sand from a slow Sand
 * Stream partner at p1b, and at p2b the FASTEST body, which faints on turn 1 by its own self-KO move. The
 * corpse is not in `getAllActive()`; in a list that kept it, its placement swap would throw p1a behind p2a.
 * CONTROL: the same p2b clicks its idle move and stays alive. */
ARMS.sand = () => {
  const setter = ALL.filter(s => Object.values(s.abilities).includes('Sand Stream') && idleOf(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe)[0];
  if (!setter) return { stage: 'no legal Sand Stream body with an idle move' };
  const KO = dex.moves.all().filter(m => legal(m) && m.selfdestruct && m.category === 'Status' && (m.target === 'self' || m.target === 'normal' || m.target === 'adjacentFoe')).map(m => m.id);
  const fast = ALL.filter(s => KO.some(m => learns(s, m)) && idleOf(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
  const immuneAb = new Set(['overcoat', 'sandveil', 'sandrush', 'sandforce', 'magicguard']);
  const pairs = ALL.filter(s => idleOf(s) && !types(s).some(t => t === 'Rock' || t === 'Ground' || t === 'Steel') && !immuneAb.has(abil(s)[0]))
    .sort((a, b) => a.baseStats.spe - b.baseStats.spe || (a.id < b.id ? -1 : 1));
  for (const f of fast.slice(0, 4)) {
    const ko = KO.find(m => learns(f, m));
    for (const X of pairs.filter(p => p.baseStats.spe + 10 < f.baseStats.spe && p.baseStats.spe > setter.baseStats.spe).slice(0, 6)) {
      const iX = idleOf(X), iS = idleOf(setter), iF = idleOf(f);
      const A = [mon(X.name, '', abil(X)[0], [iX]), mon(setter.name, '', 'Sand Stream', [iS]), mon(X.name, '', '', [iX]), mon(X.name, '', '', [iX])];
      const B = [mon(X.name, '', abil(X)[0], [iX]), mon(f.name, '', '', [ko, iF]), mon(X.name, '', '', [iX]), mon(X.name, '', '', [iX])];
      const red = [{ p1: [{ m: iX }, { m: iS }], p2: [{ m: iX }, { m: ko, t: 0 }] }];
      const ctl = [{ p1: [{ m: iX }, { m: iS }], p2: [{ m: iX }, { m: iF }] }];
      const r = play('sand-probe', A, B, red);
      const chip = (who) => idx(r.sd, new RegExp('^\\|-damage\\|' + who + ': [^|]*\\|[^|]*\\|\\[from\\] Sandstorm'));
      const faint = idx(r.sd, /^\|faint\|p2b: /);
      if (r.err || faint < 0 || chip('p1a') < 0 || chip('p2a') < 0) continue;
      return { fixture: 'pair ' + X.name + ' at p1a/p2a, ' + setter.name + ' (Sand Stream) at p1b, ' + f.name + ' (' + ko + ') at p2b',
        red: () => play('sand-red', A, B, red), control: () => play('sand-control', A, B, ctl),
        staged: (rr, cc) => { const c1 = idx(rr.sd, /^\|-damage\|p1a: [^|]*\|[^|]*\|\[from\] Sandstorm/), c2 = idx(rr.sd, /^\|-damage\|p2a: [^|]*\|[^|]*\|\[from\] Sandstorm/);
          return idx(rr.sd, /^\|faint\|p2b: /) >= 0 && c1 >= 0 && c2 > c1 && idx(cc.sd, /^\|faint\|p2b: /) < 0; },
        what: 'the authority chips p1a before p2a with the p2b corpse on the field' };
    }
  }
  return { stage: 'no fast self-KO body / pair combination staged a corpse and two sand chips on turn 1' };
};

/* UPDATE — two Sitrus holders of one species at p1a and p2a (the same cached Speed), a slow body at p1b and
 * the FASTEST body at p2b clicking a spread physical 100-accuracy hit that takes both holders under half.
 * p1a carries Weak Armor, so its LIVE Speed doubles inside the hit; the in-move `eachEvent('Update')` still
 * sorts the CACHED Speeds (a tie), and p2b's placement swap puts p2a first. CONTROL: the attacker stands at
 * p1b instead (its swap moves nobody past anybody), so every sort agrees. */
ARMS.update = () => {
  const SPREAD = dex.moves.all().filter(m => legal(m) && m.category === 'Physical' && m.target === 'allAdjacent' && m.accuracy === 100
    && !m.secondary && !m.secondaries && !m.self && !m.recoil && !m.multihit && !m.selfdestruct && !m.flags.charge).map(m => m.id);
  const wa = ALL.filter(s => abil(s).includes('weakarmor') && abil(s).some(a => a !== 'weakarmor') && idleOf(s));
  const atk = ALL.filter(s => SPREAD.some(m => learns(s, m)) && idleOf(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
  const slow = ALL.filter(s => idleOf(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
  for (const X of wa) {
    const other = abil(X).find(a => a !== 'weakarmor');
    const iX = idleOf(X);
    for (const F of atk.filter(f => f.baseStats.spe > X.baseStats.spe + 15).slice(0, 20)) {
      const hit = SPREAD.find(m => learns(F, m));
      const S = slow.find(s => s.id !== X.id && s.id !== F.id && s.baseStats.spe < X.baseStats.spe - 10);
      if (!S) continue;
      const iS = idleOf(S), iF = idleOf(F);
      const Xa = (ab) => mon(X.name, 'Sitrus Berry', ab, [iX]);
      const A = [Xa(dex.abilities.get('weakarmor').name), mon(S.name, '', '', [iS]), mon(S.name, '', '', [iS]), mon(S.name, '', '', [iS])];
      const B = [Xa(dex.abilities.get(other).name), mon(F.name, '', '', [hit, iF]), mon(S.name, '', '', [iS]), mon(S.name, '', '', [iS])];
      const red = [{ p1: [{ m: iX }, { m: iS }], p2: [{ m: iX }, { m: hit }] }];
      const r = play('update-probe', A, B, red);
      const e1 = idx(r.sd, /^\|-enditem\|p1a: [^|]*\|Sitrus Berry\|\[eat\]/), e2 = idx(r.sd, /^\|-enditem\|p2a: [^|]*\|Sitrus Berry\|\[eat\]/);
      const armor = idx(r.sd, /^\|-boost\|p1a: [^|]*\|spe\|2/);
      if (r.err || e1 < 0 || e2 < 0 || armor < 0 || idx(r.sd, /^\|faint\|/) >= 0) continue;
      /* the control: the attacker at p1b, the slow body at p2b */
      const A2 = [Xa(dex.abilities.get('weakarmor').name), mon(F.name, '', '', [hit, iF]), mon(S.name, '', '', [iS]), mon(S.name, '', '', [iS])];
      const B2 = [Xa(dex.abilities.get(other).name), mon(S.name, '', '', [iS]), mon(S.name, '', '', [iS]), mon(S.name, '', '', [iS])];
      const ctl = [{ p1: [{ m: iX }, { m: hit }], p2: [{ m: iX }, { m: iS }] }];
      return { fixture: X.name + ' x2 with Sitrus (p1a Weak Armor, p2a ' + dex.abilities.get(other).name + '), ' + F.name + ' (' + hit + ') at p2b, ' + S.name + ' at p1b; control swaps the attacker to p1b',
        red: () => play('update-red', A, B, red), control: () => play('update-control', A2, B2, ctl),
        staged: (rr, cc) => { const a1 = idx(rr.sd, /^\|-enditem\|p1a: [^|]*\|Sitrus Berry\|\[eat\]/), a2 = idx(rr.sd, /^\|-enditem\|p2a: [^|]*\|Sitrus Berry\|\[eat\]/);
          return a1 >= 0 && a2 >= 0 && a2 < a1 && idx(rr.sd, /^\|-boost\|p1a: [^|]*\|spe\|2/) >= 0
            && idx(cc.sd, /^\|-enditem\|p1a: [^|]*\|Sitrus Berry\|\[eat\]/) >= 0 && idx(cc.sd, /^\|-enditem\|p2a: [^|]*\|Sitrus Berry\|\[eat\]/) >= 0; },
        what: 'the authority eats p2a\'s Sitrus before p1a\'s although p1a\'s LIVE Speed is double (Weak Armor, same hit)' };
    }
  }
  return { stage: 'no Weak Armor pair / fastest spread attacker staged two in-move Sitrus eats with no faint' };
};

/* PERISH — a tied pair of one species at p1a/p2a, a slow Perish Song user at p1b, the FASTEST body at p2b.
 * p1a clicks Protect first, so its volatiles are [protect, stall, perishsong] in insertion order; the artifact's
 * row order would put perishsong first, and p2b's placement swap then throws p1a's perish entry behind p2a's.
 * CONTROL: p1a clicks its idle move instead — no protect, no stall — and every order agrees. */
ARMS.perish = () => {
  const users = ALL.filter(s => learns(s, 'perishsong') && idleOf(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
  const fast = ALL.filter(s => idleOf(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
  const pairs = ALL.filter(s => idleOf(s) && learns(s, 'protect')).sort((a, b) => a.baseStats.spe - b.baseStats.spe || (a.id < b.id ? -1 : 1));
  for (const U of users.slice(0, 3)) for (const X of pairs.filter(p => p.baseStats.spe > U.baseStats.spe + 10).slice(0, 6)) {
    const F = fast.find(f => f.baseStats.spe > X.baseStats.spe + 20 && f.id !== U.id);
    if (!F) continue;
    const iX = idleOf(X), iU = idleOf(U), iF = idleOf(F);
    const A = [mon(X.name, '', '', ['protect', iX]), mon(U.name, '', '', ['perishsong', iU]), mon(U.name, '', '', [iU]), mon(U.name, '', '', [iU])];
    const B = [mon(X.name, '', '', ['protect', iX]), mon(F.name, '', '', [iF]), mon(U.name, '', '', [iU]), mon(U.name, '', '', [iU])];
    const red = [{ p1: [{ m: 'protect' }, { m: 'perishsong' }], p2: [{ m: iX }, { m: iF }] }];
    const ctl = [{ p1: [{ m: iX }, { m: 'perishsong' }], p2: [{ m: iX }, { m: iF }] }];
    const r = play('perish-probe', A, B, red);
    const p1 = idx(r.sd, /^\|-start\|p1a: [^|]*\|perish3/), p2 = idx(r.sd, /^\|-start\|p2a: [^|]*\|perish3/);
    if (r.err || p1 < 0 || p2 < 0 || idx(r.sd, /^\|-singleturn\|p1a: [^|]*\|Protect/) < 0) continue;
    return { fixture: 'pair ' + X.name + ' at p1a/p2a, ' + U.name + ' (Perish Song) at p1b, ' + F.name + ' at p2b; p1a clicks Protect',
      red: () => play('perish-red', A, B, red), control: () => play('perish-control', A, B, ctl),
      staged: (rr, cc) => { const a1 = idx(rr.sd, /^\|-start\|p1a: [^|]*\|perish3/), a2 = idx(rr.sd, /^\|-start\|p2a: [^|]*\|perish3/);
        return a1 >= 0 && a2 > a1 && idx(rr.sd, /^\|-singleturn\|p1a: [^|]*\|Protect/) >= 0 && idx(cc.sd, /^\|-singleturn\|p1a: /) < 0; },
      what: 'the authority starts p1a\'s perish3 before p2a\'s when p1a Protected first' };
  }
  return { stage: 'no Perish Song user / pair / fast body staged a tied perish pair' };
};

/* SALT — one body carrying Salt Cure (turn 1) and then a partial trap (turn 2). Both are order 13 subOrder 2 on
 * one body: every key ties and the authority keeps insertion order, so Salt Cure chips first. This engine's
 * walk ran the trap block first by code position. CONTROL: the trap first (turn 1), Salt Cure second — both
 * the code order and the insertion order put the trap first. */
ARMS.salt = () => {
  const cure = ALL.filter(s => learns(s, 'saltcure') && idleOf(s));
  const TRAPS = dex.moves.all().filter(m => legal(m) && m.volatileStatus === 'partiallytrapped' && m.accuracy === 100 && m.category !== 'Status').map(m => m.id);
  const trappers = ALL.filter(s => TRAPS.some(m => learns(s, m)) && idleOf(s));
  const bulky = ALL.filter(s => idleOf(s) && !types(s).includes('Ghost')).sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd));
  for (const C of cure) for (const T of trappers.slice(0, 5)) for (const Z of bulky.slice(0, 6)) {
    if (Z.id === C.id || Z.id === T.id) continue;
    const trap = TRAPS.find(m => learns(T, m));
    const iC = idleOf(C), iT = idleOf(T), iZ = idleOf(Z);
    const A = [mon(C.name, '', '', ['saltcure', iC]), mon(T.name, '', '', [trap, iT]), mon(T.name, '', '', [iT]), mon(T.name, '', '', [iT])];
    const B = [mon(Z.name, '', '', [iZ]), mon(Z.name, '', '', [iZ]), mon(Z.name, '', '', [iZ]), mon(Z.name, '', '', [iZ])];
    const idleB = { m: iZ };
    const red = [{ p1: [{ m: 'saltcure', t: 0 }, { m: iT }], p2: [idleB, idleB] }, { p1: [{ m: iC }, { m: trap, t: 0 }], p2: [idleB, idleB] }];
    const ctl = [{ p1: [{ m: iC }, { m: trap, t: 0 }], p2: [idleB, idleB] }, { p1: [{ m: 'saltcure', t: 0 }, { m: iT }], p2: [idleB, idleB] }];
    const r = play('salt-probe', A, B, red);
    const t2 = r.sd.lastIndexOf('|turn|2');
    const sc = r.sd.findIndex((l, i) => i > t2 && /^\|-damage\|p2a: [^|]*\|[^|]*\|\[from\] Salt Cure/.test(l));
    const tp = r.sd.findIndex((l, i) => i > t2 && /^\|-damage\|p2a: [^|]*\|[^|]*\|\[from\] move: /.test(l) && /\[partiallytrapped\]/.test(l));
    if (r.err || t2 < 0 || sc < 0 || tp < 0 || idx(r.sd, /^\|faint\|/) >= 0) continue;
    return { fixture: C.name + ' Salt Cures ' + Z.name + ' on turn 1, ' + T.name + ' ' + trap + 's it on turn 2; control reverses the turns',
      red: () => play('salt-red', A, B, red), control: () => play('salt-control', A, B, ctl),
      staged: (rr, cc) => { const k = (x) => { const t = x.sd.lastIndexOf('|turn|2');
          return [x.sd.findIndex((l, i) => i > t && /^\|-damage\|p2a: [^|]*\|[^|]*\|\[from\] Salt Cure/.test(l)),
                  x.sd.findIndex((l, i) => i > t && /\[partiallytrapped\]/.test(l) && /^\|-damage\|p2a: /.test(l))]; };
        const [s1, t1] = k(rr), [s2, t2x] = k(cc);
        return s1 >= 0 && t1 > s1 && t2x >= 0 && s2 > t2x; },
      what: 'the authority chips Salt Cure before the trap when Salt Cure came first, and the trap first otherwise' };
  }
  return { stage: 'no Salt Cure / trapper / target combination staged both order-13 chips on turn 2 with no faint' };
};

/* ============================== run ================================================================ */
function runArm(name) {
  const def = ARMS[name]();
  if (def.stage) return { name, stage: def.stage };
  const red = def.red(), control = def.control();
  return { name, fixture: def.fixture, what: def.what, red, control, staged: !red.err && !control.err && def.staged(red, control),
           illegal: [...new Set([...(red.illegal || []), ...(control.illegal || [])])] };
}
const brief = (r) => ({ div: r.div ? divText(r.div) : null, board: r.stateDiv ? ('t' + r.stateDiv.turn) : null, err: r.err || null });

if (ONLY) {
  const r = runArm(ONLY);
  console.log('@@RESULT ' + JSON.stringify({ name: r.name, stage: r.stage || null, staged: !!r.staged,
    red: r.red ? brief(r.red) : null, control: r.control ? brief(r.control) : null }));
  process.exit(0);
}

console.log('TIE ORDER — four sort inputs and one announcement, both engines, release ' + G.REL.id + ', arm ' + ARM.id + '\n');
let bad = 0, cannot = 0;
const clean = {};
for (const name of Object.keys(ARMS)) {
  const r = runArm(name);
  clean[name] = r;
  if (r.stage) { console.log('  ' + name.padEnd(7) + ' COULD NOT STAGE — ' + r.stage); cannot++; continue; }
  console.log('  ' + name.padEnd(7) + ' fixture: ' + r.fixture + (r.illegal.length ? '   ILLEGAL FIXTURE: ' + r.illegal.join(',') : ''));
  console.log('          staged: ' + (r.staged ? 'yes — ' + r.what : 'NO — the authority log does not show: ' + r.what));
  const rr = brief(r.red), cc = brief(r.control);
  console.log('          clean   red: protocol ' + (rr.div || 'none') + ', board ' + (rr.board || 'held') + (rr.err ? ', ERR ' + rr.err : ''));
  console.log('          clean   control: protocol ' + (cc.div || 'none') + ', board ' + (cc.board || 'held') + (cc.err ? ', ERR ' + cc.err : ''));
  if (!r.staged || r.illegal.length || rr.err || cc.err) { cannot++; continue; }
  if (rr.div || rr.board || cc.div || cc.board) bad++;
}
if (bad) { console.log('\n  RED — ' + bad + ' arm(s) part on the clean engine.'); process.exit(1); }

/* THE KNOBS: each arm in a child under its own knob. The red must part; the control must not. */
const { spawnSync } = require('child_process');
let knobBad = 0;
console.log('');
for (const name of Object.keys(ARMS)) {
  if (clean[name].stage || !clean[name].staged) continue;
  const env = Object.assign({}, process.env, { [KNOBS[name]]: '1' });
  const ch = spawnSync(process.execPath, [__filename, ...process.argv.slice(2), '--only', name], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const m = /@@RESULT (.*)/.exec(String(ch.stdout || ''));
  if (!m) { console.log('  ' + name.padEnd(7) + ' knob ' + KNOBS[name] + ': child printed no result (exit ' + ch.status + ')' + String(ch.stderr || '').slice(-300)); knobBad++; continue; }
  const k = JSON.parse(m[1]);
  const ok = k.staged && k.red && k.red.div && !(k.control && (k.control.div || k.control.board));
  console.log('  ' + name.padEnd(7) + ' knob ' + KNOBS[name] + ': red parts at ' + (k.red && k.red.div || 'NOTHING') + (k.red && k.red.board ? ' (board ' + k.red.board + ')' : ', board held')
    + ' | control ' + (k.control && (k.control.div || k.control.board) ? 'PARTS ' + (k.control.div || k.control.board) : 'none') + (ok ? '' : '   <-- NOT A PASS'));
  if (!ok) knobBad++;
}
if (cannot || knobBad) { console.log('\n  NOT A PASS — ' + cannot + ' arm(s) could not stage, ' + knobBad + ' knob arm(s) did not part exactly the red.'); process.exit(2); }
console.log('\n  GREEN — every arm staged its mechanism, agrees on protocol and board on the clean engine, and its knob parts the red and not the control.');
process.exit(0);
