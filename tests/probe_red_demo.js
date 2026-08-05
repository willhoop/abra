/* EVERY NEW PROBE SHOWN RED ON A KNOWN-BAD ENGINE.   node tests/probe_red_demo.js
 *
 * The standing gate (docs/ENGINE-COVERAGE-PLAN.md): *no check is committed until it has been shown
 * failing on a known-bad input.* A probe written after a fix and never watched failing is an
 * assertion about the code as it stands -- it proves nothing about whether it WATCHES the knob.
 *
 * The known-bad engine here is the real engine with the consumed tag STRIPPED OUT of the in-memory
 * artifact through TAGS.__setDB -- the mutation-tier operation docs/TAG-COVERAGE.md §2 specifies.
 * For each wire in the 2026-08-05 batch this file runs the probe's core assertion twice:
 *
 *     with the artifact as shipped   -> must hold  (the probe is green)
 *     with the tag removed           -> must FAIL  (the probe goes red -- it watches the knob)
 *
 * A row where the second arm still holds means the probe cannot fail for the reason it claims --
 * the HOLLOW shape -- and this file exits 1 on it. The two STAGED tags run the same test inverted:
 * the shipped artifact IS the known-bad input (the tag does not exist yet), and injecting the
 * staged tag is what must flip the behaviour on.
 *
 * None of this touches disk. __setDB(null) restores the on-disk artifact after every case.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('engine', 'tags.js'));

const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row for ' + sp); b.item = ''; b.ability = 'none'; return b; };
const FIELD = () => ({ weather: '', terrain: '', twA: 0, twB: 0, tr: 0, wgA: false, wgB: false });
const rng5 = () => 0.5;

const clone = o => JSON.parse(JSON.stringify(o));
const shipped = clone(require(D('data', 'tags.json')));

function without(kind, id, tag) {
  const db = clone(shipped);
  const K = { move: 'moves', item: 'items', ability: 'abilities' }[kind];
  const rec = db[K][id];
  if (!rec || !rec.tags.includes(tag)) throw new Error(`cannot strip: ${kind} ${id} does not carry ${tag}`);
  rec.tags = rec.tags.filter(t => t !== tag);
  if (rec.params) delete rec.params[tag];
  return db;
}
function withAdded(kind, id, tag, params) {
  const db = clone(shipped);
  const K = { move: 'moves', item: 'items', ability: 'abilities' }[kind];
  db[K][id] = db[K][id] || { name: id, tags: [], uses: 0, params: {} };
  if (!db[K][id].tags.includes(tag)) db[K][id].tags.push(tag);
  db[K][id].params = db[K][id].params || {};
  db[K][id].params[tag] = params;
  return db;
}

let failures = 0, ran = 0;
/* assertFn returns true when the mechanic is LIVE. It must be true on `goodDB` and false on `badDB`. */
function demo(name, goodDB, badDB, assertFn) {
  ran++;
  let green, red;
  try {
    TAGS.__setDB(goodDB); green = !!assertFn();
    TAGS.__setDB(badDB); red = !!assertFn();
  } finally { TAGS.__setDB(null); }
  const ok = green && !red;
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK   ' : 'FAIL '} ${name}   green-arm=${green} (must be true)  stripped-arm=${red} (must be false)`);
}

/* ---- THE SECOND KIND OF KNOWN-BAD ENGINE: A REVERTED SOURCE, NOT A STRIPPED TAG ------------------
 *
 * `demo` above mutates the ARTIFACT, which is the right known-bad input for a wire whose defect was
 * "nothing consumed this tag". It cannot express a defect that lives in the CODE and has no tag to
 * strip -- WIRE 117's terrain branch sat outside a loop, and the artifact was innocent.
 *
 * So this loads the engine source through a fresh module, textually reverts the WIRE's sites to
 * EXACTLY what they said before the pass, and runs the same assertion against the reverted build.
 * Every reversal ASSERTS IT APPLIED: a patch that silently failed to match would make a broken
 * engine look fixed, which is this project's signature failure arriving through the test meant to
 * catch it. Nothing is written to disk; the reverted build exists only in this process. */
const Module = require('module');
const fs = require('fs');
const MEDI_PATH = D('engine', 'medicham2-browser.js');
function revertedEngine(edits) {
  /* NORMALISED FIRST. The engine file is CRLF on this machine and the patterns below are written in
   * a JS source file with LF newlines, so an un-normalised match fails on every multi-line edit --
   * and it failed LOUDLY, which is the guard doing its job rather than a reason to weaken it. */
  let src = fs.readFileSync(MEDI_PATH, 'utf8').replace(/\r\n/g, '\n');
  for (const [find, replace] of edits) {
    if (!src.includes(find)) throw new Error('reversal did not apply — the source no longer contains:\n' + find);
    src = src.split(find).join(replace);
  }
  const m = new Module(MEDI_PATH, null);
  m.filename = MEDI_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(MEDI_PATH));
  m._compile(src, MEDI_PATH);
  return m.exports;
}
function demoSource(name, edits, assertFn) {
  ran++;
  const bad = revertedEngine(edits);
  const green = !!assertFn(M), red = !!assertFn(bad);
  const ok = green && !red;
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK   ' : 'FAIL '} ${name}   shipped-arm=${green} (must be true)  reverted-arm=${red} (must be false)`);
}

/* ---- the wires, each against its own mutation ---------------------------------------------------- */

demo('WIRE 91  speedMult -- Choice Scarf x1.5', shipped, without('item', 'choicescarf', 'speedMult'), () => {
  const b = bare('basculegion'); b.item = 'choicescarf';
  const c = bare('basculegion');
  return M.effSpeed(b, FIELD(), 'A') > M.effSpeed(c, FIELD(), 'A') * 1.4;
});

demo('WIRE 91  speedCond -- Swift Swim doubles in rain', shipped, without('ability', 'swiftswim', 'speedCond'), () => {
  const b = bare('basculegion'); b.ability = 'swiftswim';
  const f = FIELD(); f.weather = 'rain';
  return M.effSpeed(b, f, 'A') === 2 * M.effSpeed(b, FIELD(), 'A');
});

demo('WIRE 95  stabBoost -- Adaptability x2 STAB', shipped, without('ability', 'adaptability', 'stabBoost'), () => {
  const a = bare('basculegion'); a.ability = 'adaptability';
  const c = bare('basculegion');
  const def = bare('milotic'), mv = MC.moves['wavecrash'] || MC.moves['aquajet'];
  return M.dmgRange(a, def, mv, FIELD(), false).max > M.dmgRange(c, def, mv, FIELD(), false).max;
});

demo('WIRE 97  removesOwnSecondaries -- Sheer Force x1.3', shipped, without('ability', 'sheerforce', 'removesOwnSecondaries'), () => {
  const a = bare('incineroar'); a.ability = 'sheerforce';
  const c = bare('incineroar');
  const def = bare('milotic'), mv = MC.moves['rockslide'];
  return M.dmgRange(a, def, mv, FIELD(), false).max > M.dmgRange(c, def, mv, FIELD(), false).max * 1.2;
});

demo('WIRE 96  critDamageUp -- Sniper on a certain crit', shipped, without('ability', 'sniper', 'critDamageUp'), () => {
  const a = bare('sneasler'); a.ability = 'sniper';
  const c = bare('sneasler');
  const def = bare('milotic'), mv = MC.moves['flowertrick'];
  return M.dmgRange(a, def, mv, FIELD(), false).max > M.dmgRange(c, def, mv, FIELD(), false).max * 1.4;
});

demo('WIRE 98  hitsTwice -- Parental Bond x1.25', shipped, without('ability', 'parentalbond', 'hitsTwice'), () => {
  const a = bare('kangaskhan'); a.ability = 'parentalbond';
  const c = bare('kangaskhan'); c.ability = 'none';
  const def = bare('milotic'), mv = MC.moves['doubleedge'] || MC.moves['bodyslam'];
  return M.dmgRange(a, def, mv, FIELD(), false).max > M.dmgRange(c, def, mv, FIELD(), false).max * 1.15;
});

demo('WIRE 94  ignoresStatStages -- Unaware blanks a +6', shipped, without('ability', 'unaware', 'ignoresStatStages'), () => {
  const atk = bare('garchomp'); atk.boosts.at = 6;
  const wall = bare('milotic'); wall.ability = 'unaware';
  const plain = bare('milotic');
  const mv = MC.moves['earthquake'];
  return M.dmgRange(atk, wall, mv, FIELD(), false).max < M.dmgRange(atk, plain, mv, FIELD(), false).max;
});

demo('WIRE 99  privateWeather -- Mega Sol\'s own sun', shipped, without('ability', 'megasol', 'privateWeather'), () => {
  const a = bare('meganium'); a.ability = 'megasol';
  const c = bare('meganium');
  const def = bare('corviknight'), mv = MC.moves['flamethrower'] || MC.moves['fireblast'];
  return M.dmgRange(a, def, mv, FIELD(), false).max > M.dmgRange(c, def, mv, FIELD(), false).max * 1.3;
});

demo('WIRE 104 boostsOnKO -- Eelevate +1 on a kill', shipped, without('ability', 'eelevate', 'boostsOnKO'), () => {
  const me = bare('garchomp'); me.ability = 'eelevate';
  const ally = bare('corviknight');
  const f1 = bare('weavile'), f2 = bare('milotic');
  f1.curHP = 5;
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return Object.values(me.boosts).reduce((s, v) => s + v, 0) === 1;
});

demo('WIRE 92  preventsSwitch -- Shadow Tag holds a switch', shipped, without('ability', 'shadowtag', 'preventsSwitch'), () => {
  const me = bare('milotic'), ally = bare('corviknight'), sub = bare('incineroar');
  const f1 = bare('gengar'), f2 = bare('garchomp');
  f1.ability = 'shadowtag';
  const S = M.battleInit([me, ally, sub], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: sub }], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return S.actA[0] && S.actA[0].name === 'milotic';   /* held */
});

demo('WIRE 93  priorityMod -- Gale Wings jumps the bracket', shipped, without('ability', 'galewings', 'priorityMod'), () => {
  const me = bare('talonflame'); me.ability = 'galewings';
  const ally = bare('milotic');
  const f1 = bare('dragapult'), f2 = bare('garchomp');
  f1.curHP = 40;
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const before = me.curHP;
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'drillpeck', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'shadowball', me, S.field)], [f2, { kind: 'pass' }]]));
  return before - me.curHP === 0;   /* it moved first, the 40-HP foe died */
});

demo('WIRE 101 fractionalPriority -- Quick Claw wins the roll', shipped, without('item', 'quickclaw', 'fractionalPriority'), () => {
  const me = bare('torkoal'); me.item = 'quickclaw';
  const ally = bare('corviknight');
  const f1 = bare('weavile'), f2 = bare('garchomp');
  f1.curHP = 60;
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  let first = true;
  const rng = () => { if (first) { first = false; return 0.05; } return 0.5; };
  const before = me.curHP;
  M.battleTurn(S, rng, new Map([[me, M.playerAction(me, 'lavaplume', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'brickbreak', me, S.field)], [f2, { kind: 'pass' }]]));
  return before - me.curHP === 0 && f1.fainted;
});

demo("WIRE 103 addsFlinch -- King's Rock stops the setup", shipped, without('item', 'kingsrock', 'addsFlinch'), () => {
  const me = bare('weavile'); me.item = 'kingsrock';
  const ally = bare('corviknight');
  const f1 = bare('milotic'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const rng = () => 0.05;
  M.battleTurn(S, rng, new Map([[me, M.playerAction(me, 'nightslash', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'swordsdance', null, S.field)], [f2, { kind: 'pass' }]]));
  return f1.boosts.at === 0;   /* flinched out of its Swords Dance */
});

demo('WIRE 100 boostsWhenLowered -- Defiant fires on the drop', shipped, without('ability', 'defiant', 'boostsWhenLowered'), () => {
  const m = bare('kingambit'); m.ability = 'defiant';
  M.applyIntimidate(m);
  return m.boosts.at === 1;   /* -1 landed, +2 fired */
});

demo('WIRE 100b invertsBoosts -- Contrary flips Intimidate', shipped, without('ability', 'contrary', 'invertsBoosts'), () => {
  const m = bare('milotic'); m.ability = 'contrary';
  M.applyIntimidate(m);
  return m.boosts.at === 1;
});

demo('WIRE 100a onSwitchInDrop -- the entry drop reads the tag', shipped, without('ability', 'intimidate', 'onSwitchInDrop'), () => {
  const m = bare('milotic');
  const f = bare('garchomp');
  /* through the real entry path: battleInit runs applyEntryDrops over the leads. NOT {seeded:true},
   * which exists precisely to SKIP entry effects -- the first cut of this demo passed it and read
   * green-arm=false, which was the demo staging and not the wire. */
  const me = bare('incineroar'); me.ability = 'intimidate';
  const S = M.battleInit([me, m], [f, bare('weavile')], {});
  return f.boosts.at === -1;
});

demo('WIRE 90  hazard (toxic spikes) -- laid, then resolved on entry', shipped, without('move', 'toxicspikes', 'hazard'), () => {
  const me = bare('incineroar'), ally = bare('corviknight'), nx = bare('milotic');
  const f1 = bare('garchomp'), f2 = bare('weavile');
  const S = M.battleInit([me, ally, nx], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'toxicspikes', null, S.field)], [f2, { kind: 'pass' }]]));
  M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: nx }], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return nx.status === 'psn';
});

demo('WIRE 105 partialTrap -- the chip the trap-death probe controls on', shipped, without('move', 'infestation', 'partialTrap'), () => {
  const me = bare('ariados'), ally = bare('corviknight');
  const f1 = bare('milotic'), f2 = bare('weavile');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'infestation', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return !!f1._trap;
});

demo('WIRE 107 takesTargetItem -- Trick swaps', shipped, without('move', 'trick', 'takesTargetItem'), () => {
  const me = bare('sableye'), ally = bare('corviknight');
  const f1 = bare('milotic'), f2 = bare('garchomp');
  me.item = 'quickclaw';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'trick', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return f1.item === 'quickclaw' && me.item === '';
});

demo('WIRE 108 changesTargetType -- Trick-or-Treat adds Ghost', shipped, without('move', 'trickortreat', 'changesTargetType'), () => {
  const me = bare('gengar'), ally = bare('corviknight');
  const f1 = bare('milotic'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'trickortreat', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return f1.types.includes('Ghost');
});

demo('WIRE 109 reordersTurn -- After You promotes the ally', shipped, without('move', 'afteryou', 'reordersTurn'), () => {
  const me = bare('whimsicott'), ally = bare('archaludon');
  const f1 = bare('garchomp'), f2 = bare('corviknight');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  f1.curHP = 1;
  const before = ally.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'afteryou', ally, S.field)],
             [ally, M.playerAction(ally, 'ironhead', f1, S.field)]]),
    new Map([[f1, M.playerAction(f1, 'closecombat', ally, S.field)], [f2, { kind: 'pass' }]]));
  return before - ally.curHP === 0;
});

demo('WIRE 106 boostsTarget -- the foe-aimed Decorate needs BOTH its tags gone to die', shipped,
  /* Decorate carries statChange beside boostsTarget, and either alone can boost the foe -- so the
   * known-bad engine for this probe strips both. That redundancy is real and is called out in the
   * triage table rather than hidden here. */
  (() => { let db = without('move', 'decorate', 'boostsTarget'); TAGS.__setDB(null);
           const K = db.moves.decorate; K.tags = K.tags.filter(t => t !== 'statChange'); delete K.params.statChange; return db; })(),
  () => {
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('weavile');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'decorate', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1.boosts.at === 2;
  });

demo('WIRE 90b refusesStatusMoves -- Good as Gold refuses the foe-aimed Decorate', shipped,
  without('ability', 'goodasgold', 'refusesStatusMoves'), () => {
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('weavile');
    f1.ability = 'goodasgold';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'decorate', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1.boosts.at === 0;   /* refused */
  });

demo('WIRE 111 megaStone -- the stone guard on Trick reads the tag', shipped, without('item', 'gengarite', 'megaStone'), () => {
  const me = bare('sableye'), ally = bare('corviknight');
  const f1 = bare('milotic'), f2 = bare('garchomp');
  me.item = 'quickclaw'; f1.item = 'gengarite';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'trick', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return f1.item === 'gengarite';   /* the stone did not move */
});

/* ---- WIRES 110 and 112: STAGED on 2026-08-05, GRADUATED the same day when the coordinator ran the
 * regeneration -- the tags are in the shipped artifact now, so these two run in the same direction
 * as every other demo (shipped = green, stripped = red). Their original inverted form (shipped as
 * the known-bad arm) went red the moment the regeneration landed, which is exactly what an
 * inverted arm should do. ---------------------------------------------------------------------- */

demo('WIRE 110 swapsAbilities -- Skill Swap exchanges the abilities',
  shipped, without('move', 'skillswap', 'swapsAbilities'), () => {
    const me = bare('milotic'); me.ability = 'marvelscale';
    const ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('weavile'); f1.ability = 'roughskin';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'skillswap', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return me.ability === 'roughskin' && f1.ability === 'marvelscale';
  });

demo('WIRE 112 condStatMult -- Marvel Scale raises Defense while statused',
  shipped, without('ability', 'marvelscale', 'condStatMult'), () => {
    const atk = bare('garchomp');
    const def = bare('milotic'); def.ability = 'marvelscale'; def.status = 'brn';
    const mv = MC.moves['earthquake'];
    const plain = bare('milotic'); plain.status = 'brn';
    return M.dmgRange(atk, def, mv, FIELD(), false).max < M.dmgRange(atk, plain, mv, FIELD(), false).max;
  });

/* ---- WIRE 117, against a source-reverted engine ------------------------------------------------- */

/* The reverted terrain branch is the shipped line, verbatim: outside the defender loop, inspecting
 * no body at all. Both probe arms are asserted in one assertion, because either alone passes on some
 * wrong engine -- grounded-blocked passes on the shipped-broken build, airborne-lands passes on a
 * build with no Psychic Terrain whatsoever. */
const WIRE117_PRIORITY_REVERT = [[
  `  if(field&&terrainId(field.terrain)==='psychic'){
    const aim=aimedAt?[aimedAt]:(defenders||[]);
    let blocked=false,airborne=false;
    for(const d of aim){
      if(!d||d.fainted) continue;
      if(isGrounded(d)) blocked=true; else airborne=true;
    }
    if(blocked) out=Math.min(out,0);`,
  `  if(field&&terrainId(field.terrain)==='psychic'){
    let blocked=true,airborne=false;
    if(blocked) out=Math.min(out,0);`]];

demoSource('WIRE 117 Psychic Terrain refuses priority only against a GROUNDED target',
  WIRE117_PRIORITY_REVERT, (E) => {
    const took = (sp, terrain, ab) => {
      const me = bare('incineroar'), ally = bare('incineroar');
      const f1 = bare(sp), f2 = bare('garchomp');
      if (ab) f1.ability = ab;
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      S.field.terrain = terrain;
      const before = f1.curHP;
      E.battleTurn(S, rng5, new Map([[me, E.playerAction(me, 'fakeout', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    const gP = took('garchomp', 'psychic');
    const fC = took('talonflame', ''), fP = took('talonflame', 'psychic');
    const lC = took('garchomp', '', 'levitate'), lP = took('garchomp', 'psychic', 'levitate');
    return gP === 0 && fP === fC && fC > 0 && lP === lC && lC > 0;
  });

/* The Grassy Terrain heal is the same predicate one field over, and its own MEDFAILS counter said so
 * for a whole pass. The reverted line is the shipped one: the TYPE half applied, the ability half
 * counted and healed anyway. */
demoSource('WIRE 117 Grassy Terrain does not heal a Levitate body',
  [[`         if(isGrounded(m)) m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/_th.per));
         else MEDSEEN.terrainHealSkippedAirborne++;`,
    `         if(m.types.indexOf('Flying')<0) m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/_th.per));`]],
  (E) => {
    const healed = (ab) => {
      const me = bare('garchomp'), ally = bare('incineroar');
      const f1 = bare('milotic'), f2 = bare('weavile');
      me.ability = ab; me.curHP = Math.floor(me.st.hp / 2);
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      S.field.terrain = 'grassy';
      const before = me.curHP;
      E.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return me.curHP - before;
    };
    /* The control must HEAL, or "Levitate is not healed" would be satisfied by a terrain that heals
     * nobody -- which is precisely what WIRE 72 found the last time this branch was touched. */
    return healed('none') > 0 && healed('levitate') === 0;
  });

console.log(`\n  ${ran} demonstrations, ${failures} failed`);
if (failures) { console.log('  A green-and-stripped pair that did not flip means the probe does NOT watch its knob.'); process.exit(1); }
