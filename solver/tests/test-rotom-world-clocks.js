/* solver/tests/test-rotom-world-clocks.js — ROTOM's world carries the clocks, volatiles, abilities and field state the
 * public log shows (solver/rotom/world_log.js, 2026-09-30, docs/_reports/2026-09-30-rotom-world-fixes.md).
 *
 *   node solver/tests/test-rotom-world-clocks.js [--release eaa5becc54eb]        exit 0 GREEN, 1 RED
 *
 * Every REPLAY clause rebuilds the world from a SAVED LADDER LOG of the chomp1 run (fixtures/rotom/postmortem/, copied
 * from solver/out/rotom/chomp1-2026-09-29T23-13-11-521Z) at the decision the post-mortem named, and asks the engine
 * what the server showed. No game is played: one engine step from a rebuilt position at most.
 *
 *   PERISH    sdkvndfv g1, turn 4: both our actives (Salamence, Volcarona) at the engine's `_perish` 1, and one engine
 *             step from that world faints both — the server fainted both at the end of that turn.
 *   CLOCKS    the same game with volatile lines spliced into turn 2: a Taunt on a body that had acted runs the dex
 *             duration + 1 - 1 and the engine offers it no status move; an Encore locks the engine's menu to the encored
 *             move; a Substitute, a Leech Seed and a confusion are laid on the engine's own fields. Plus the walk on its
 *             own: sleep ticks, the toxic stage, Disable's -1 and Rest's fixed sleep.
 *   ABILITY   pandywulu g1, turn 8: Espeon holds the Shadow Tag it Skill Swapped, and the engine offers our Incineroar no
 *             switch (the server refused it: trapped). RED under ROTOM_WORLD_BREAK=noability.
 *   HAZARDS   AngryGator g3, turn 3: Toxic Spikes on our side is in sf.hz, and switching Rillaboom in poisons it in the
 *             engine (the server poisoned it). RED under ROTOM_WORLD_BREAK=hzsc.
 *   FIELD     at every turn start of five chomp1 games, each weather / terrain / Trick Room / Tailwind clock the world lays
 *             equals the turns the server let it run (read from the rest of the log); lead-set effects included. RED
 *             under ROTOM_WORLD_BREAK=turnclock.
 *   AUDIT     every per-body leaf engine/board_state.js mediBody reads, and every field leaf of readMedi, is either
 *             CARRIED or OWED in world_log.js (a leaf in neither fails by name).
 *   RED       ROTOM_WORLD_BREAK=noclocks (the pre-fix world: no body clocks, no log field) turns PERISH and CLOCKS red.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');

let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const W = require('../rotom/world.js');
const WL = require('../rotom/world_log.js');
const LR = require('./ladder_replay.js');
const FX = path.join(__dirname, 'fixtures', 'rotom', 'postmortem');
const WB = W.create(API);
const hpOf = row => { const b = T.buildBody(M, row); return b ? b.st.hp : 100; };
const opp = s => (s === 'A' ? 'B' : 'A');
const acts = (S, s) => (s === 'A' ? S.actA : S.actB);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------------- PERISH ---------------- */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'sdkvndfv-g1.battle.txt'), me: 'p2', bring: [0, 5, 2, 4], cut: '|turn|4', hpOf });
  const sal = LR.bodyOf(w, 'p2', 'Salamence'), vol = LR.bodyOf(w, 'p2', 'Volcarona');
  ok('PERISH', sal && sal._perish === 1 && vol && vol._perish === 1, 'our actives at turn 4: Salamence perish ' + (sal && sal._perish) + ', Volcarona ' + (vol && vol._perish) + ' (the server showed perish1 on both)');
  const mine = API.legalActions(w.S, w.side), theirs = API.legalActions(w.S, opp(w.side));
  const jm = mine.joint.find(j => j.every(o => o.kind === 'move' && !/protect/.test(o.move || ''))) || mine.joint[0];
  const S2 = API.step(w.S, w.side === 'A' ? jm : theirs.joint[0], w.side === 'A' ? theirs.joint[0] : jm, API.makeRng(7));
  const team = w.side === 'A' ? S2.sfA.team : S2.sfB.team;
  const dead = n => { const b = team.find(m => new RegExp('^' + n, 'i').test(m.name)); return !!(b && (b.fainted || b.curHP <= 0)); };
  ok('PERISH', dead('salamence') && dead('volcarona'), 'one engine step from the turn-4 world: Salamence fainted ' + dead('salamence') + ', Volcarona ' + dead('volcarona') + ' (the server fainted both)');
  console.log('  PERISH  turn 4: Salamence ' + (sal && sal._perish) + ', Volcarona ' + (vol && vol._perish) + '; after one step fainted ' + dead('salamence') + '/' + dead('volcarona'));
}

/* ---------------- CLOCKS ---------------- */
{
  const inject = [['|-sidestart|p2: medicham32|move: Tailwind', ['|-start|p2a: Salamence|move: Taunt', '|-start|p2b: Volcarona|Encore',
    '|-start|p2a: Salamence|Substitute', '|-start|p2b: Volcarona|move: Leech Seed', '|-start|p2a: Salamence|confusion']]];
  const w = LR.worldAt(WB, { log: path.join(FX, 'sdkvndfv-g1.battle.txt'), me: 'p2', bring: [0, 5, 2, 4], cut: '|turn|3', hpOf, inject });
  const sal = LR.bodyOf(w, 'p2', 'Salamence'), vol = LR.bodyOf(w, 'p2', 'Volcarona');
  const tauntWant = WL.durationOf('taunt') - 1 + WL.startAdj('taunt').ifActed;
  ok('CLOCKS', sal._vol && sal._vol.taunt === tauntWant, 'Taunt on a body that acted, one residual later: ' + (sal._vol && sal._vol.taunt) + ', want ' + tauntWant);
  ok('CLOCKS', vol._vol && vol._vol.encore > 0 && vol._encoreMove === 'quiverdance', 'Encore laid ' + (vol._vol && vol._vol.encore) + ' on ' + vol._encoreMove + ' (want the last move, quiverdance)');
  const la = API.legalActions(w.S, w.side);
  const slotOf = b => acts(w.S, w.side).indexOf(b);
  const movesIn = b => la.slots[slotOf(b)].options.filter(o => o.kind === 'move').map(o => o.move);
  const salMoves = [...new Set(movesIn(sal))], volMoves = [...new Set(movesIn(vol))];
  const status = id => { const m = require('../human/dex.js').D.moves.get(id); return m.exists && m.category === 'Status'; };
  ok('CLOCKS', salMoves.length && !salMoves.some(status), 'a Taunted Salamence is offered no status move by the engine: ' + salMoves.join(','));
  ok('CLOCKS', volMoves.length && volMoves.every(m => m === 'quiverdance'), 'an Encored Volcarona is offered only Quiver Dance by the engine: ' + volMoves.join(','));
  ok('CLOCKS', sal._sub > 0 && vol._seededBy && sal._vol.confusion > 0, 'Substitute ' + sal._sub + ', Leech Seed ' + !!vol._seededBy + ', confusion ' + (sal._vol && sal._vol.confusion));
  console.log('  CLOCKS  taunt ' + (sal._vol && sal._vol.taunt) + ' | encore ' + (vol._vol && vol._vol.encore) + ' ' + vol._encoreMove + ' | Salamence offered ' + salMoves.join(',') + ' | Volcarona offered ' + volMoves.join(','));

  /* the walk on its own */
  const sheets = { p1: [{ nick: 'A', item: '' }, { nick: 'B', item: '' }], p2: [{ nick: 'C', item: '' }, { nick: 'D', item: '' }] };
  const L = WL.walk(['|switch|p1a: A|X|100/100', '|switch|p2a: C|Y|100/100', '|switch|p2b: D|Z|100/100', '|turn|1',
    '|move|p1a: A|Spore|p2a: C', '|-status|p2a: C|slp|[from] move: Spore', '|move|p1a: A|Toxic|p2b: D', '|-status|p2b: D|tox',
    '|-start|p2b: D|Disable|Tackle', '|upkeep', '|turn|2', '|cant|p2a: C|slp', '|upkeep', '|turn|3', '|cant|p2a: C|slp', '|-status|p1a: A|slp|[from] move: Rest'], sheets);
  const C = L.bodies.get('p2:0'), D = L.bodies.get('p2:1'), A = L.bodies.get('p1:0');
  ok('CLOCKS', C && C.slp && C.slp.ticks === 2, 'sleep ticks after two |cant|slp: ' + (C && C.slp && C.slp.ticks));
  ok('CLOCKS', D && D.tox && L.U - D.tox.since === 2, 'toxic stage after two residuals: ' + (D && D.tox && L.U - D.tox.since));
  ok('CLOCKS', D && D.vols.get('disable') && D.vols.get('disable').adj === WL.startAdj('disable').ifNotActed && D.vols.get('disable').arg === 'tackle', 'Disable on a body that had not acted: adj ' + (D && D.vols.get('disable') && D.vols.get('disable').adj) + ' move ' + (D && D.vols.get('disable') && D.vols.get('disable').arg));
  ok('CLOCKS', A && A.slp && A.slp.rest === true && WL.restTime() > 0, 'Rest sleep marked (fixed time ' + WL.restTime() + ')');
}

/* ---------------- ABILITY (abra/regmc 1.41.0) ----------------
 * pandywulu g1, turn 8: the server refused our `switch 4` from Incineroar ("trapped"). Espeon had Skill Swapped our
 * Gengar-Mega's Shadow Tag on turn 6 (`-activate|p2a: Espeon|Skill Swap|Shadow Tag|Defiant|[of] p1a: Gengar`). The
 * rebuilt world must hold Shadow Tag on Espeon and Defiant on our Gengar, and the engine must offer Incineroar no switch.
 * RED under ROTOM_WORLD_BREAK=noability (and noclocks). */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'pandywulu-g1.battle.txt'), me: 'p1', bring: [0, 3, 1, 5], cut: '|turn|8', hpOf });
  const esp = LR.bodyOf(w, 'p2', 'Espeon'), gen = LR.bodyOf(w, 'p1', 'Gengar'), inc = LR.bodyOf(w, 'p1', 'Incineroar');
  ok('ABILITY', esp && toID(esp.ability) === 'shadowtag', 'Espeon holds ' + (esp && esp.ability) + ' at turn 8 (the log: Skill Swapped Shadow Tag on turn 6)');
  ok('ABILITY', gen && toID(gen.ability) === 'defiant' && toID(gen._preAb) === 'shadowtag', 'our Gengar-Mega holds ' + (gen && gen.ability) + ', restores ' + (gen && gen._preAb) + ' on a switch (want defiant / shadowtag)');
  const la = API.legalActions(w.S, w.side);
  const k = acts(w.S, w.side).indexOf(inc);
  const sw = k >= 0 ? la.slots[k].options.filter(o => o.kind === 'switch').length : -1;
  ok('ABILITY', k >= 0 && sw === 0, 'the engine offers our Incineroar ' + sw + ' switch options at turn 8 (the server refused its switch: trapped)');
  console.log('  ABILITY Espeon ' + (esp && esp.ability) + ' | Gengar ' + (gen && gen.ability) + ' (restores ' + (gen && gen._preAb) + ') | Incineroar switch options ' + sw);
}

/* ---------------- HAZARDS (abra/regmc 1.42.0) ----------------
 * AngryGator g3: Glimmora's Toxic Debris laid Toxic Spikes on our side on turn 1; on turn 3 our Rillaboom switched in
 * and the server poisoned it (`-status|p1a: Rillaboom|psn`). From the turn-3 world, switching Kingambit out for Rillaboom
 * must poison Rillaboom in the engine. RED under ROTOM_WORLD_BREAK=hzsc (the hazard written into sf.sc). */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'angrygator-g3.battle.txt'), me: 'p1', bring: [3, 5, 0, 2], cut: '|turn|3', hpOf });
  const sf = w.side === 'A' ? w.S.sfA : w.S.sfB;
  ok('HAZARDS', sf.hz && sf.hz.toxicspikes === 1, 'our side carries Toxic Spikes ' + JSON.stringify(sf.hz || {}) + ' in sf.hz (the engine reads hazards there), sf.sc ' + JSON.stringify(sf.sc || {}));
  const kin = LR.bodyOf(w, 'p1', 'Kingambit'), ril = LR.bodyOf(w, 'p1', 'Rillaboom');
  const la = API.legalActions(w.S, w.side), th = API.legalActions(w.S, opp(w.side));
  const k = acts(w.S, w.side).indexOf(kin);
  const jm = la.joint.find(j => j[k] && j[k].kind === 'switch' && j[k].ident === 'rillaboom' && j[1 - k] && j[1 - k].kind === 'move');
  let st = null;
  if (jm) {
    const S2 = API.step(w.S, w.side === 'A' ? jm : th.joint[0], w.side === 'A' ? th.joint[0] : jm, API.makeRng(3));
    const r2 = (w.side === 'A' ? S2.sfA : S2.sfB).team.find(m => /^rillaboom/i.test(m.name));
    st = r2 ? r2.status : null;
  }
  ok('HAZARDS', !!jm && st === 'psn', 'Rillaboom switched in over Toxic Spikes: status ' + st + ' (the server: psn)' + (jm ? '' : ' — no switch joint found'));
  console.log('  HAZARDS sf.hz ' + JSON.stringify(sf.hz || {}) + ' | Rillaboom after the switch: ' + st);
}

/* ---------------- FIELD (abra/regmc 1.43.0) ----------------
 * At every turn start of every fixture game, each weather, terrain, Trick Room and Tailwind the rebuilt world lays is
 * held against the SERVER's own answer, read from the rest of that log: the effect ended in the residual of the turn
 * whose `-weather|none` / `-fieldend` / `-sideend` line it is, so the turns it had left = the residuals from here to
 * that one inclusive. An effect replaced or still up at the game's end is skipped (no answer). At least one LEAD-set
 * effect (set before turn 1) must be compared: that is the case the turn arithmetic got wrong.
 * RED under ROTOM_WORLD_BREAK=turnclock (the old path: turns left = duration - (turn - turn set)). */
{
  let compared = 0, lead = 0; const bad = [];
  const games = [['sdkvndfv-g1.battle.txt', 'p2', [0, 5, 2, 4]], ['pandywulu-g1.battle.txt', 'p1', [0, 3, 1, 5]], ['angrygator-g3.battle.txt', 'p1', [3, 5, 0, 2]],
                 ['lead-psychic-sand.battle.txt', 'p1', null], ['lead-rain.battle.txt', 'p2', null]];
  for (const [file, me, bring] of games) {
    const all = fs.readFileSync(path.join(FX, file), 'utf8').replace(/\r/g, '').split('\n');
    const turnsAt = all.map((l, i) => (/^\|turn\|\d+$/.test(l) ? i : -1)).filter(i => i >= 0);
    for (const i of turnsAt) {
      let w;
      try { w = LR.worldAt(WB, { log: path.join(FX, file), me, bring, cut: all[i], hpOf }); } catch (e) { bad.push(file + ' ' + all[i] + ': build threw ' + e.message); continue; }
      const F = w.S.field;
      /* the server's answer for an effect: scan forward for its end or its replacement */
      const answer = (isEnd, isReplace) => { let up = 0; for (let j = i + 1; j < all.length; j++) { const l = all[j]; if (isEnd(l)) return up + 1; if (isReplace(l)) return null; if (l === '|upkeep') up++; } return null; };
      const leadSet = re => { for (let j = 0; j < i; j++) if (re.test(all[j])) return all.slice(0, j).every(l => !/^\|turn\|/.test(l)); return false; };
      const check = (name, got, want, isLead) => { if (want == null) return; compared++; if (isLead) lead++; if (got !== want) bad.push(file + ' ' + all[i] + ' ' + name + ': world ' + got + ', server ' + want + (isLead ? ' (lead-set)' : '')); };
      if (F.weather) check('weather ' + F.weather, F.weatherT, answer(l => l === '|-weather|none', l => /^\|-weather\|(?!none)/.test(l) && !/\[upkeep\]/.test(l)), leadSet(/^\|-weather\|(?!none)/));
      if (F.terrain) { const T0 = F.terrain; check('terrain ' + T0, F.terrainT, answer(l => new RegExp('^\\|-fieldend\\|move: ' + T0 + ' Terrain', 'i').test(l), l => /^\|-fieldstart\|move: \w+ Terrain/.test(l)), leadSet(/^\|-fieldstart\|move: \w+ Terrain/)); }
      if (F.tr > 0) check('trickroom', F.tr, answer(l => /^\|-fieldend\|move: Trick Room/.test(l), () => false), false);
      for (const [p, key] of [[me, w.side === 'A' ? 'twA' : 'twB'], [me === 'p1' ? 'p2' : 'p1', w.side === 'A' ? 'twB' : 'twA']]) {
        if (F[key] > 0) check('tailwind ' + p, F[key], answer(l => new RegExp('^\\|-sideend\\|' + p + ':.*\\|move: Tailwind').test(l), () => false), false);
      }
    }
  }
  ok('FIELD', !bad.length, bad.slice(0, 6).join(' | ') + (bad.length > 6 ? ' ... ' + bad.length + ' in all' : ''));
  ok('FIELD', compared >= 10 && lead >= 1, 'coverage: ' + compared + ' field clocks compared, ' + lead + ' of them lead-set (need >= 10 and >= 1)');
  console.log('  FIELD   ' + compared + ' field clocks compared with the server over ' + games.length + ' ladder games, ' + lead + ' lead-set; mismatches ' + bad.length);
}

/* ---------------- AUDIT ---------------- */
{
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'engine', 'board_state.js'), 'utf8');
  const i = src.indexOf('function mediBody'), j = src.indexOf('function sdBody');
  const body = src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '');
  const leaves = new Set([...body.matchAll(/^\s+([a-z_]+):/gm)].map(m => m[1]).filter(k => k !== 'vol'));
  const r = src.indexOf('function readMedi'); const rm = src.slice(r, src.indexOf('\n}', r)).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of rm.matchAll(/([a-z_]+)_turns:/g)) leaves.add(m[1] + '_turns');
  for (const k of ['weather', 'terrain', 'screens', 'tailwind', 'hazards', 'party', 'pp', 'slots']) if (new RegExp('\\b' + k + ':').test(rm)) leaves.add(k);
  const missing = [...leaves].filter(k => !(k in WL.CARRIED) && !(k in WL.OWED));
  ok('AUDIT', leaves.size >= 40, 'parsed only ' + leaves.size + ' leaves from engine/board_state.js — the parse is broken');
  ok('AUDIT', !missing.length, 'board leaves neither CARRIED nor OWED in world_log.js: ' + missing.join(', '));
  console.log('  AUDIT   ' + leaves.size + ' board leaves: ' + [...leaves].filter(k => k in WL.CARRIED).length + ' carried, ' + [...leaves].filter(k => k in WL.OWED).length + ' owed');
}

console.log(fails ? `RED  ${fails} of ${checks} checks failed${process.env.ROTOM_WORLD_BREAK ? ' (ROTOM_WORLD_BREAK=' + process.env.ROTOM_WORLD_BREAK + ')' : ''}` : `GREEN  ${checks} checks`);
process.exit(fails ? 1 : 0);
