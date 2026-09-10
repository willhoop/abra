/* probe_residual_trio_handlerless_body.js — A TIED PAIR'S RESIDUAL ORDER, WHEN A FASTER BODY WITH NO
 * RESIDUAL HANDLER AT ALL SHARES THE FIELD (the `psn <> psn` and `leftovers <> leftovers` rows of the
 * residual trio, 2026-09-10).
 *
 *   SHOWDOWN_PATH=... node tests/probe_residual_trio_handlerless_body.js --release <id>
 *
 * ================= THE GAMES THIS COMES FROM ==========================================================
 * game-differential release 7d66b526659e:
 *   omit-spread, pair 2636020596 vs 2636020596, turn 4 — Umbreon (base 65, slot 0, +32 SP) and
 *     Scovillain (base 75, slot 1, +22 SP) are BOTH built at Speed 117, both poisoned; the authority
 *     chips Umbreon first, this engine Scovillain first. Overqwil (127, Life Orb) sits at p2b with no
 *     residual handler. The record read the BASE speeds (65/75) and called it "not a tie".
 *   pair-protect-bust, pair 2659228530 vs 2659321485, turn 7 — Primarina and Clefable both built at
 *     Speed 80, both Leftovers; the authority heals Primarina first, this engine Clefable first.
 *     Vivillon (144) and Medicham (134/156) sit at p1a/p2b with no residual handler.
 *
 * ================= THE DERIVATION ====================================================================
 * Nothing is drawn for a tie under the differential's pin (game_differential.js:1859), so each engine's
 * SELECTION SORT decides. The authority's list holds HANDLERS only (sim/battle.ts:492-507): a body
 * with no status, no timed volatile, no residual ability and no residual item is NOT IN IT, and cannot
 * move anything. This engine's `residualOrder` sorts BODIES — every active body, handler or not, and
 * fainted ones too. A faster handler-less body is therefore selected first in the body sort and its
 * placement SWAP (`speedSort` :445-451) carries one member of the tied pair past the other, exactly
 * as in game 2 ([Umbreon 117, Scovillain 117, Dragalge 64, Overqwil 127] -> swap 0<->3 -> Scovillain
 * ahead of Umbreon) and game 3. The authority never saw a swap because its list was [psn, psn] or
 * [leftovers, leftovers] and nothing else.
 *
 * ================= THE KNOB ===========================================================================
 * Two same-species Leftovers holders at p1a and p2a (same slot index -> same spread -> same Speed),
 * damaged on turn 1 by each other's 100-accuracy attack so both Leftovers fire. The knob is the SPEED of
 * the two partners at p1b/p2b, each a body with no residual handler (a self-targeting stat move,
 * nothing else):
 *   slow/slow    body sort [X, s, X, s]: pair keep input order            -> p1a first (both engines)
 *   fast/slow    [X, F, X, s]: swap 0<->1, pair then tie in place         -> p1a first (both engines)
 *   slow/fast    [X, s, X, F]: swap 0<->3 puts p2a's X ahead of p1a's     -> this engine p2a FIRST
 *   fast/fast    [X, F1, X, F2]: either swap history lands p2a first      -> this engine p2a FIRST
 * The authority answers p1a in every cell because its list is [leftovers, leftovers] in every cell.
 * The file REFUSES TO PASS if either Leftovers fails to fire, if the pair's cached Speeds differ, if a
 * partner's Speed is not on the side of the pair the cell claims, or if the authority's residual list
 * holds anything but the two Leftovers entries.
 *
 * ================= THE CONTROL, CHANGED 2026-09-10 WHEN THE FIX LANDED (ROADMAP #563) =================
 * ~~The file REFUSES TO PASS if this engine gives the same answer on all four cells (then the partners did
 * not move the body sort and the knob is unwired).~~ That guard was written against the BROKEN engine: a
 * correct engine is indifferent to the partners on every cell, exactly as the authority is, so the guard
 * could only ever pass while the defect stood. The wiredness of the fixture is now proved the other way
 * round: this file re-runs ITSELF under `MEDI_RESIDUAL_SORTS_BODIES=1` (the body-only sort, the pre-fix
 * walk) as a child process with `--knob-arm`, and refuses to pass unless that arm reads RED (exit 1) on
 * the same derived fixture. A fixture the old sort cannot be seen swapping proves nothing.
 *
 * Exit 1 = a cell disagrees (the derivation stands and names its cell). Exit 0 = every cell agrees AND the
 * knob arm reads RED. Exit 2 = not run / could not stage / the knob arm did not read RED. */
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
const KNOB_ARM = process.argv.includes('--knob-arm');

const SD = require(process.env.SHOWDOWN_PATH + '/dist/sim');
let CAP = false; const SDRES = [];
const _fieldEvent = SD.Battle.prototype.fieldEvent;
SD.Battle.prototype.fieldEvent = function (eventid, targets) {
  if (eventid !== 'Residual' || !CAP) return _fieldEvent.call(this, eventid, targets);
  const orig = this.speedSort, self = this;
  this.speedSort = function (list, cmp) {
    const r = orig.call(self, list, cmp);
    SDRES.push({ turn: self.turn,
      handlers: list.map(h => ({ id: (h.effect && h.effect.id) || '?', ord: h.order || 4294967296, sub: h.subOrder | 0, spe: h.speed || 0,
        who: (h.effectHolder && h.effectHolder.getStat) ? h.effectHolder.side.id + String.fromCharCode(97 + h.effectHolder.position) : (h.effectHolder && h.effectHolder.id) || '?' })),
      bodies: self.getAllActive().map(p => ({ slot: p.side.id + String.fromCharCode(97 + p.position), species: p.species.id, speed: p.speed, status: p.status, item: p.item, ability: p.ability, boostSpe: p.boosts.spe, hp: p.hp, maxhp: p.maxhp })),
      trickRoom: !!self.field.pseudoWeather.trickroom });
    self.speedSort = orig;
    return r;
  };
  const out = _fieldEvent.call(this, eventid, targets);
  this.speedSort = orig;
  return out;
};

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const ARM = G.ARM_BY_ID.get('top-tie-first');   // a 100-accuracy move lands, no crit, no secondary, minimum roll
if (!ARM) { console.log('NOT RUN — arm top-tie-first is not registered.'); process.exit(2); }

/* ---- derive the fixture ---- */
const learns = (s, mv) => { try { const ls = dex.species.getLearnsetData(s.id); return !!(ls && ls.learnset && ls.learnset[mv]); } catch (e) { console.error('learnset lookup failed for ' + s.id + ': ' + e.message + ' (raw-learnset walk, ROADMAP #565)'); return false; } };
const SELF_BOOSTS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self' && m.boosts
  && !m.boosts.spe && !m.volatileStatus && !m.self && !m.weather && !m.terrain && !m.sideCondition && !m.pseudoWeather && !m.heal).map(m => m.id);
/* A PLAIN HIT: 100 accuracy, one target, no secondary, no self effect, no volatile, no recoil, no drain,
 * no multi-hit, no charge, no priority — nothing that could put an entry in either residual list or
 * draw a die the arm does not pin. */
const PLAIN_HITS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status' && (m.accuracy === true || m.accuracy >= 100)
  && !m.secondary && !m.secondaries && !m.self && !m.volatileStatus && !m.recoil && !m.drain && !m.multihit && !m.ohko && !m.selfdestruct
  && !m.flags.charge && !m.flags.recharge && !m.priority && m.target === 'normal' && m.basePower >= 30 && m.basePower <= 70 && !m.mindBlownRecoil && !m.struggleRecoil && !m.hasCrashDamage && !m.willCrit).map(m => m.id);
const ALL = dex.species.all().filter(s => legal(s) && !s.isMega && !/^Mega/.test(s.forme || '') && !s.battleOnly);
const hitOf = s => PLAIN_HITS.find(mv => learns(s, mv)) || null;
const boostMoveOf = s => SELF_BOOSTS.find(mv => learns(s, mv)) || null;
const bulk = s => s.baseStats.hp + s.baseStats.def + s.baseStats.spd;
const PAIR_CANDIDATES = ALL.filter(s => hitOf(s)).sort((a, b) => bulk(b) - bulk(a) || (a.id < b.id ? -1 : 1));
const PARTNERS = ALL.filter(s => boostMoveOf(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe || (a.id < b.id ? -1 : 1));
if (!PAIR_CANDIDATES.length || PARTNERS.length < 2) { console.log('NOT RUN — the dex walk produced no fixture.'); process.exit(2); }
const SLOW = PARTNERS.slice(0, 6), FAST = PARTNERS.slice().reverse().slice(0, 12);

const mon = (species, item, moves) => ({ species, item: item || '', ability: '', moves });
const unsplit = lines => { const out = []; for (let i = 0; i < lines.length; i++) { if (/^\|split\|/.test(String(lines[i]))) { i++; continue; } out.push(lines[i]); } return out; };
const HEAL = /^\|-heal\|p\d[ab]:[^|]*\|[^|]*\|\[from\] item: leftovers\s*$/i;
const seqOf = (lines) => unsplit(lines).filter(l => HEAL.test(String(l))).map(l => (/^\|-heal\|(p\d[ab])/.exec(String(l)) || [])[1]);
const turn1 = lines => { const a = lines.findIndex(l => /^\|turn\|1\s*$/.test(String(l))); const b = lines.findIndex((l, i) => i > a && /^\|upkeep\s*$/.test(String(l))); return lines.slice(a < 0 ? 0 : a, b < 0 ? undefined : b + 1); };

function cell(id, pairSp, p1Partner, p2Partner) {
  const hit = hitOf(pairSp), b1 = boostMoveOf(p1Partner), b2 = boostMoveOf(p2Partner);
  const A = [mon(pairSp.name, 'Leftovers', [hit]), mon(p1Partner.name, '', [b1]), mon(p1Partner.name, '', [b1]), mon(p1Partner.name, '', [b1])];
  const B = [mon(pairSp.name, 'Leftovers', [hit]), mon(p2Partner.name, '', [b2]), mon(p2Partner.name, '', [b2]), mon(p2Partner.name, '', [b2])];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { id, err: 'buildPair returned null' };
  const STEP = { p1: [{ m: hit, t: 0 }, { m: b1 }], p2: [{ m: hit, t: 0 }, { m: b2 }] };
  SDRES.length = 0; CAP = true;
  const r = G.playGame(a, b, 'directed', 'restrio-body:' + id, { script: [STEP, STEP], arm: ARM });
  CAP = false;
  const res = SDRES.find(x => x.turn === 1) || null;
  return { id, err: r.err, sd: seqOf(turn1(G.lastSdLog() || [])), me: seqOf(turn1(r.mediTrace || [])), res };
}
const pairOf = res => res.bodies.filter(bd => bd.slot === 'p1a' || bd.slot === 'p2a');
const partnersOf = res => ({ p1b: res.bodies.find(bd => bd.slot === 'p1b'), p2b: res.bodies.find(bd => bd.slot === 'p2b') });
const cleanList = res => res.handlers.length === 2 && res.handlers.every(h => h.id === 'leftovers');

console.log('RESIDUAL TRIO — a tied pair beside a FASTER BODY WITH NO RESIDUAL HANDLER (the psn <> psn and leftovers <> leftovers rows)\n');
console.log('  release ' + G.REL.id + ', arm ' + ARM.id + ' (no die is drawn for a tie on either side)');
console.log('  DERIVED FIXTURE — ' + ALL.length + ' legal species; ' + PAIR_CANDIDATES.length + ' learn a plain 100-accuracy hit (' + PLAIN_HITS.length
  + ' qualifying moves); ' + PARTNERS.length + ' learn a self-boost (' + SELF_BOOSTS.length + ' moves)');

/* stage: a pair that survives its own hit with both Leftovers firing, a slow partner slower than it and a
 * fast partner faster than it, with a clean two-entry residual list */
let pairSp = null, slow = null, fast = null, staged = null;
outer:
for (const cand of PAIR_CANDIDATES.slice(0, 10)) {
  for (const s of SLOW) {
    const t = cell('stage-slow', cand, s, s);
    if (t.err || !t.res || !cleanList(t.res) || t.sd.length !== 2 || t.me.length !== 2) continue;
    const pr = pairOf(t.res); if (pr.length !== 2 || pr[0].speed !== pr[1].speed || t.res.trickRoom) continue;
    const pt = partnersOf(t.res); if (!(pt.p1b.speed < pr[0].speed && pt.p2b.speed < pr[0].speed)) continue;
    for (const f of FAST) {
      const u = cell('stage-fast', cand, f, f);
      if (u.err || !u.res || !cleanList(u.res) || u.sd.length !== 2 || u.me.length !== 2) continue;
      const pu = partnersOf(u.res); const px = pairOf(u.res);
      if (!(pu.p1b.speed > px[0].speed && pu.p2b.speed > px[0].speed)) continue;
      pairSp = cand; slow = s; fast = f; staged = t; break outer;
    }
  }
}
if (!pairSp) { console.log('\n  FIXTURE — no candidate staged a same-speed Leftovers pair with a slower and a faster handler-less partner and a clean list. This is not a pass.'); process.exit(2); }
console.log('    pair     ' + pairSp.name + ' x2 at p1a/p2a (' + hitOf(pairSp) + ' on each other), built Speed ' + pairOf(staged.res).map(b => b.speed).join(' / '));
console.log('    slow     ' + slow.name + ' (' + boostMoveOf(slow) + ')    fast ' + fast.name + ' (' + boostMoveOf(fast) + ')');
console.log('');
console.log('  cell         partners p1b/p2b speed   authority heal order   medicham heal order   authority list');
const CELLS = [['slow/slow', slow, slow], ['fast/slow', fast, slow], ['slow/fast', slow, fast], ['fast/fast', fast, fast]];
let bad = 0, fixtureBad = 0;
for (const [id, P1, P2] of CELLS) {
  const c = cell(id, pairSp, P1, P2);
  if (c.err) { console.log('  ' + id.padEnd(12) + ' THREW ' + c.err); fixtureBad++; continue; }
  const pr = c.res ? pairOf(c.res) : [], pt = c.res ? partnersOf(c.res) : null;
  const X = pr.length ? pr[0].speed : NaN;
  const sideOk = pt && ((P1 === slow) ? pt.p1b.speed < X : pt.p1b.speed > X) && ((P2 === slow) ? pt.p2b.speed < X : pt.p2b.speed > X);
  const clean = c.res && cleanList(c.res) && pr.length === 2 && pr[0].speed === pr[1].speed && c.sd.length === 2 && c.me.length === 2 && sideOk && !c.res.trickRoom;
  const agree = JSON.stringify(c.sd) === JSON.stringify(c.me);
  console.log('  ' + id.padEnd(12) + ' ' + (pt ? (pt.p1b.speed + '/' + pt.p2b.speed + ' (pair ' + X + ')') : '?').padEnd(25) + ' ' + c.sd.join(',').padEnd(22) + ' ' + c.me.join(',').padEnd(21) + ' '
    + (c.res ? c.res.handlers.map(h => h.who + ':' + h.id).join(' ') : '(none)')
    + (clean ? '' : '   <-- FIXTURE NOT CLEAN') + (clean && !agree ? '   <-- RED: the engines disagree' : ''));
  if (!clean) fixtureBad++; else if (!agree) bad++;
}
console.log('');
if (fixtureBad) { console.log('  NOT A PASS — ' + fixtureBad + ' cell(s) did not stage cleanly.'); process.exit(2); }
if (bad) {
  console.log('  RED — ' + bad + ' of ' + CELLS.length + ' cells disagree. The authority\'s list is [leftovers, leftovers] in every cell and keeps p1a first; this engine\'s body sort lets a faster body with NO handler swap the tied pair. Fix site: engine/medicham2-browser.js residualOrder sorts every active body (fainted included) rather than the bodies that hold a handler in the group being walked.');
  process.exit(1);
}
if (KNOB_ARM) {
  console.log('  knob arm (MEDI_RESIDUAL_SORTS_BODIES=1) — every cell agrees, so the body-only sort did NOT swap the pair on this fixture. The parent reads this as an unwired control.');
  process.exit(0);
}
/* THE CONTROL: the same file, the same fixture, under the knob that restores the body-only sort. It must
 * read RED, or the fixture cannot see the defect it was staged for. `--knob-arm` stops the child spawning
 * a child of its own. */
{
  const { spawnSync } = require('child_process');
  const child = spawnSync(process.execPath, [__filename, ...process.argv.slice(2), '--knob-arm'],
    { env: Object.assign({}, process.env, { MEDI_RESIDUAL_SORTS_BODIES: '1' }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tail = String(child.stdout || '').trim().split(/\r?\n/).filter(l => /^\s{2}(slow|fast)\/(slow|fast)|RED|GREEN|NOT A PASS|knob arm/.test(l));
  console.log('  control — the same fixture under MEDI_RESIDUAL_SORTS_BODIES=1 (the body-only sort), exit ' + child.status + ':');
  for (const l of tail) console.log('    | ' + l);
  if (child.status !== 1) {
    console.log('  NOT A PASS — the knob arm did not read RED, so the body-only sort never swapped this pair and the fixture proves nothing about the fix.');
    process.exit(2);
  }
}
console.log('  GREEN — every cell agrees with the authority, and the body-only sort under MEDI_RESIDUAL_SORTS_BODIES=1 reads RED on the same fixture (the control is wired).');
process.exit(0);
