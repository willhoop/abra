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

/* ---- WIRE 118, against a source-reverted engine -------------------------------------------------
 *
 * THE KNOWN-BAD ENGINE IS EXACTLY THE FROZEN QUEUE AND NOTHING ELSE. Deleting the three-line re-sort
 * leaves the comparator, the frozen bracket, the tie and the `order` overrides all in place, so what
 * flips is the one thing this wire is about: whether the remaining actions are re-ordered before each
 * one resolves. A wider revert would also prove a wider claim, and the point of a known-bad engine is
 * that it is bad in exactly one respect.
 *
 * The assertion is the shipped probe's, both arms in one expression: the control MUST take damage, or
 * "the partner took nothing" is satisfied by an engine where nothing happens at all. */
demoSource('WIRE 118 Tailwind speeds the PARTNER up inside the same turn (dynamic speed)',
  [[`      if(actIdx>0&&actIdx<acts.length-1){
        const _rest=sortTurnOrder(acts.slice(actIdx),field,rng);
        for(let _k=0;_k<_rest.length;_k++)acts[actIdx+_k]=_rest[_k];
      }
`, '']],
  (E) => {
    const took = (setTailwind) => {
      const me = bare('whimsicott'), ally = bare('incineroar');
      const f1 = bare('milotic'), f2 = bare('garchomp');
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      f1.curHP = 1;
      const before = ally.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, setTailwind ? E.playerAction(me, 'tailwind', null, S.field) : { kind: 'pass' }],
                 [ally, E.playerAction(ally, 'knockoff', f1, S.field)]]),
        new Map([[f1, E.playerAction(f1, 'scald', ally, S.field)], [f2, { kind: 'pass' }]]));
      return before - ally.curHP;
    };
    return took(false) > 0 && took(true) === 0;
  });

/* ---- WIRE 119, TAUNT, both halves against a STRIPPED TAG ----------------------------------------
 *
 * The artifact is the right known-bad input here: the defect was that NOTHING consumed
 * `forbidsStatusMoves`, and the whole gate -- selection and execution -- is built off the table that
 * tag feeds. Stripping it empties the table, which is exactly the engine as it stood before this
 * wire. `demo` restores the on-disk artifact afterwards, and medicham2 registers a __setDB rebuild
 * hook for its forbid table so the stripped arm is genuinely running on the stripped membership
 * rather than on a set memoised at first demand. */
demo('WIRE 119 forbidsStatusMoves -- Taunt FAILS an already-chosen status move (execution time)',
  shipped, without('move', 'taunt', 'forbidsStatusMoves'), () => {
    const run = (foeMove) => {
      const me = bare('incineroar'), ally = bare('corviknight');
      const f1 = bare('alakazam'), f2 = bare('garchomp');
      const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, 'taunt', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, M.playerAction(f1, foeMove, me, S.field)], [f2, { kind: 'pass' }]]));
      return !!(f1._vol && f1._vol.taunt > 0);
    };
    /* The control MUST land its Taunt, or "the foe was not Taunted" is satisfied by an engine in
     * which Taunt never lands at all. */
    return run('expandingforce') === true && run('taunt') === false;
  });

demo('WIRE 119 forbidsStatusMoves -- Taunt empties the status menu (selection time)',
  shipped, without('move', 'taunt', 'forbidsStatusMoves'), () => {
    const KINDMV = { protect: 'protect', wideguard: 'wideguard', tail: 'tailwind' };
    const run = (taunted) => {
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const me = bare('milotic'), ally = bare('corviknight');
        const f1 = bare('garchomp'), f2 = bare('weavile');
        const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
        if (taunted) (me._vol = me._vol || {}).taunt = 3;
        let s = 1000 + i * 7919;
        /* mulberry32 — see the note in tests/test-mechanics.js; tests/test-prng.js forbids the
         * overflowing textbook LCG outright and caught the first version of this using it. */
        const rng = () => { s = (s + 0x6D2B79F5) | 0; let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        M.battleTurn(S, rng, null, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
        const act = (S.lastActs || []).find(x => x.side === 'A' && x.name === me.name);
        const id = act && (act.move || KINDMV[act.kind]);
        /* `statusCategory` is read off the LIVE artifact deliberately: the stripped arm removes only
         * `forbidsStatusMoves`, so the classifier used to score both arms is identical. */
        if (id && TAGS.has('move', id, 'statusCategory')) n++;
      }
      return n;
    };
    return run(false) > 0 && run(true) === 0;
  });

/* ---- WIRE 120, against a source-reverted engine -------------------------------------------------
 *
 * There is no tag to strip: the defect is one clause in actionPriority that gave a pivot MOVE the
 * bare-switch bracket. The revert is exactly that clause and nothing else. */
demoSource('WIRE 120 Parting Shot does not jump the queue (a pivot MOVE is a MOVE)',
  [['  if(k===\'switch\')    return it.a.mv?movePriority(it.a.mv,field)+pk:6;',
    '  if(k===\'switch\')    return 6;']],
  (E) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const rep = bare('garchomp'), rep2 = bare('pangoro');
    const f1 = bare('milotic'), f2 = bare('weavile');
    const S = E.battleInit([me, ally, rep, rep2], [f1, f2], { seeded: true });
    const hp0 = me.curHP, rep0 = rep.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'partingshot', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, E.playerAction(f1, 'scald', me, S.field)], [f2, { kind: 'pass' }]]));
    /* The pivot must still have happened in BOTH arms, or this would pass on an engine where Parting
     * Shot simply stopped switching. */
    const pivoted = S.actA.indexOf(rep) >= 0 && S.actA.indexOf(me) < 0;
    return pivoted && (hp0 - me.curHP) > 0 && (rep0 - rep.curHP) === 0;
  });

/* ---- WIRE 121, against a source-reverted engine ------------------------------------------------- */
demoSource('WIRE 121 Volt Switch does not pivot out of an absorbed hit',
  [['      if(!m.fainted&&m.curHP>0&&dealt>0&&TAGS.has(\'move\',a.move.id,\'pivotDamaging\')){',
    '      if(!m.fainted&&m.curHP>0&&TAGS.has(\'move\',a.move.id,\'pivotDamaging\')){']],
  (E) => {
    const run = (ab) => {
      const me = bare('pikachu'), ally = bare('corviknight');
      const rep = bare('garchomp'), rep2 = bare('incineroar');
      const f1 = bare('milotic'), f2 = bare('weavile');
      f1.ability = ab;
      const S = E.battleInit([me, ally, rep, rep2], [f1, f2], { seeded: true });
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'voltswitch', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return S.actA.indexOf(me) >= 0;
    };
    return run('marvelscale') === false && run('lightningrod') === true;
  });

/* ---- WIRE 122, against a STRIPPED TAG ----------------------------------------------------------- */
demo('WIRE 122 refusesStatusMoves -- Good as Gold refuses Yawn',
  shipped, without('ability', 'goodasgold', 'refusesStatusMoves'), () => {
    const run = (ab) => {
      const me = bare('milotic'), ally = bare('corviknight');
      const f1 = bare('gholdengo'), f2 = bare('weavile');
      f1.ability = ab;
      const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, 'yawn', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return f1._yawn != null;
    };
    return run('none') === true && run('goodasgold') === false;
  });

/* ---- WIRE 123, against a source-reverted engine -------------------------------------------------
 *
 * The known-bad engine is the ORDERING RULE and nothing else. The entrants list, the interleaving of
 * effects with drops and the tie counter all stay exactly as shipped; only the comparator is
 * neutered, which leaves the list in declaration order (A0, A1, B0, B1) -- the engine as it stood
 * before this wire. So the one thing that can flip the arms is the thing the wire is about.
 *
 * A per-side implementation would pass the first two arms, which is why the third is here. */
demoSource('WIRE 123 the SLOWER entry weather setter owns the field, across both sides',
  [['    entrants.sort((x,y)=>compareTurnOrder({spe:x.spe},{spe:y.spe},S.field));',
    '    entrants.sort((x,y)=>0);']],
  (E) => {
    const run = (pelSpe, tyrSpe, allySp, allyAb, allySpe) => {
      const pel = bare('pelipper'), ally = bare(allySp);
      const tyr = bare('tyranitar'), f2 = bare('milotic');
      pel.ability = 'drizzle'; tyr.ability = 'sandstream'; ally.ability = allyAb; f2.ability = 'none';
      pel.st.sp = pelSpe; tyr.st.sp = tyrSpe; ally.st.sp = allySpe; f2.st.sp = 100;
      return E.battleInit([pel, ally], [tyr, f2], {}).field.weather || 'none';
    };
    return run(117, 81, 'corviknight', 'none', 100) === 'sand'
        && run(85, 113, 'corviknight', 'none', 100) === 'rain'
        && run(117, 113, 'torkoal', 'drought', 40) === 'sun';
  });

/* ---- WIRE 124, against a source-reverted engine -------------------------------------------------
 *
 * There is no tag to strip. `neverMisses` was never the thing that was broken -- what was broken is
 * that EVERY move was never-missing, because `moveAccuracy` ended `return ACC[id]||100` over a
 * hand-typed 35-move literal. So the known-bad engine is that literal, restored verbatim, and
 * nothing else: the weatherScaled branch above it, the two status-branch call sites and the battle
 * loop's roll all stay exactly as shipped.
 *
 * The assertion is the OUTCOME on a board. Heat Wave is 90% in this format and 7,405 clicks in the
 * corpus, and on a losing roll it must deal nothing; Aerial Ace, on the same roll, must land. The
 * reverted engine lands both, which is what it did for the whole life of the file. */
demoSource('WIRE 124 a 90% move can miss — accuracy is derived, not a 35-name list',
  [[`  const key=String(id||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(ACC_FIX[key]!=null)return ACC_FIX[key];
  let fx=null;
  /* THE ONLY WAY moveFx THROWS is data/move-effects.js not being loaded at all, and the reason is
   * KEPT rather than discarded: without it every move in the game silently becomes 100% accurate,
   * which is the exact defect this wire exists to remove, and a caller looking at \`fails\` afterwards
   * needs to be able to tell that from "the table was there and this move was not in it". */
  try{ fx=moveFx(key); }
  catch(e){ MEDFAILS.accuracyNoTable++;
            if(!MEDFAILS.accuracyNoTableFirst)MEDFAILS.accuracyNoTableFirst=String(e.message).slice(0,80); }
  if(fx&&fx.accuracy!=null)return fx.accuracy===true?100:+fx.accuracy;
  MEDFAILS.accuracyUnknown++;
  if(!MEDFAILS.accuracyUnknownFirst)MEDFAILS.accuracyUnknownFirst=key;
  return 100;`,
    `  return ({hydropump:80,hurricane:70,fireblast:85,focusblast:70,thunder:70,blizzard:70,stoneedge:80,megahorn:85,gunkshot:80,iciclecrash:90,playrough:90,dynamicpunch:50,zapcannon:50,highjumpkick:90,drillrun:95,crosschop:80,sleeppowder:75,willowisp:85,thunderwave:90,hypnosis:60,irontail:75,dragonrush:75,inferno:50,fissure:30,sheercold:30,rockslide:90,airslash:95,gigaimpact:90,overheat:90,leafstorm:90,powerwhip:85,meteorbeam:90,muddywater:85,darkvoid:50,sing:55})[id]||100;`]],
  (E) => {
    const rngLose = () => 0.99;
    const dealt = (mv, rng) => {
      const me = bare('incineroar'), ally = bare('corviknight');
      const f1 = bare('garchomp'), f2 = bare('garchomp');
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      const before = f1.curHP;
      E.battleTurn(S, rng,
        new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    /* The winning-roll arm keeps this honest in BOTH engines: a Heat Wave that deals nothing because
     * the staging is wrong would otherwise read as the mechanic working. */
    return dealt('heatwave', rng5) > 0 && dealt('heatwave', rngLose) === 0 && dealt('aerialace', rngLose) > 0;
  });

/* ---- WIRE 125, against a source-reverted engine -------------------------------------------------
 *
 * The known-bad engine is the end-of-turn death recount and nothing else: `sf.team` back to
 * `[...act,...bench]`, which is the expression that lost the dead the moment bringIn() overwrote the
 * active slot. Everything about the faint, the replacement and Last Respects itself stays as shipped.
 *
 * A LATER TURN IS THE WHOLE POINT. Both engines get the count right on the turn of the death, so an
 * assertion made on that turn passes on both and proves nothing — the ally is killed on turn 1 and
 * the move is clicked on turn 2. */
demoSource('WIRE 125 the fallen count survives the turn after the death',
  [['    sfA.fainted=fallenCount(sfA,actA,benchA);\n    sfB.fainted=fallenCount(sfB,actB,benchB);',
    '    sfA.fainted=[...actA,...benchA].filter(x=>x&&x.fainted).length;\n    sfB.fainted=[...actB,...benchB].filter(x=>x&&x.fainted).length;']],
  (E) => {
    const run = (killAlly) => {
      const me = bare('houndstone'), ally = bare('corviknight');
      const sp1 = bare('milotic'), sp2 = bare('incineroar');
      const f1 = bare('garchomp'), f2 = bare('tyranitar');
      const S = E.battleInit([me, ally, sp1, sp2], [f1, f2], { seeded: true });
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      if (killAlly) ally.curHP = 1;
      E.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
        new Map([[f1, E.playerAction(f1, 'dragonclaw', ally, S.field)], [f2, { kind: 'pass' }]]));
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'lastrespects', f1, S.field)], [S.actA[1], { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return [S.sfA.fainted, before - f1.curHP];
    };
    const control = run(false), test = run(true);
    return control[0] === 0 && test[0] === 1 && test[1] > control[1] && control[1] > 0;
  });

/* ---- WIRE 126, against a source-reverted engine -------------------------------------------------
 *
 * There is no tag to strip: `convertsMoveType` was on Aerilate and dmgRange was reading it correctly.
 * The defect was that the battle loop asked a DIFFERENT function for the move's type, and that
 * function is handed no attacker. So the revert is the one argument -- the attacker dropped from the
 * loop's type-immunity gate -- and nothing else. Everything about the conversion, the damage and the
 * ability stays exactly as shipped.
 *
 * THE CONTROL ARM IS THE ONE THAT MAKES THIS EVIDENCE. A Body Slam with NO ability must deal zero to
 * a Ghost in BOTH engines, or "Aerilate landed" would be indistinguishable from an engine that had
 * simply stopped enforcing the Normal-into-Ghost immunity altogether -- which is a worse bug than the
 * one being fixed and would otherwise read as the fix working. */
demoSource('WIRE 126 an -ate-converted move is judged on the type it BECAME',
  [['          if (mcEff(effMoveType(mv, a.move.id, field, m), tg.types) === 0) continue;',
    '          if (mcEff(effMoveType(mv, a.move.id, field), tg.types) === 0) continue;']],
  (E) => {
    const dealt = (ab) => {
      const me = bare('staraptor'), ally = bare('incineroar');
      const f1 = bare('gengar'), f2 = bare('garchomp');
      me.ability = ab;
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'bodyslam', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    return dealt('none') === 0 && dealt('aerilate') > 0;
  });

console.log(`\n  ${ran} demonstrations, ${failures} failed`);
if (failures) { console.log('  A green-and-stripped pair that did not flip means the probe does NOT watch its knob.'); process.exit(1); }
