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
  /* ROADMAP #68 re-anchored: the shipped line now carries the `|-heal|` trace emit beside it. The
   * REVERSAL is unchanged -- the Flying-only predicate, healing a Levitate body -- so this
   * demonstration still tests exactly what it tested. */
  [[`         if(isGrounded(m)){const _h0=m.curHP;m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/_th.per));
           if(TR&&m.curHP>_h0)TR.heal(m,'[from] Grassy Terrain');}
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
  if(fx&&fx.accuracy!=null)return fx.accuracy===true?true:+fx.accuracy;
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
/* RE-TARGETED BY WIRE 128, WHICH IS THE GUARD DOING ITS JOB. This reversal used to strip the `m`
 * out of a bare `mcEff(effMoveType(...), tg.types)`; that call site is now `typeEffAgainst`, so the
 * patch stopped matching and `revertedEngine()` threw rather than quietly testing nothing. The
 * reversal is still exactly one argument — the attacker dropped from the type resolution — so it
 * remains WIRE 126's defect and not WIRE 128's. */
demoSource('WIRE 126 an -ate-converted move is judged on the type it BECAME',
/* AND RE-TARGETED AGAIN BY ROADMAP #84, for the same reason and with the same result: the immunity
 * gate now also raises `_explicitFail`, the pattern stopped matching and this file threw. The
 * reversal below is still exactly one argument.
 *
 * AND AGAIN BY ROADMAP #81 WIRE 10, third time, same guard: the gate is now a STEP closure, so it
 * drops its row and returns instead of `continue`-ing a loop it no longer sits in. The reversal is
 * still exactly one argument — the attacker dropped from the type resolution. */
  [['          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field, m)) === 0){_explicitFail=true;if(TR)TR.imm(tg);R.out=true;return;}',
    '          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field)) === 0){_explicitFail=true;R.out=true;return;}']],
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

/* ---- WIRE 128, three source-reverted engines ----------------------------------------------------
 *
 * There is no tag to strip for any of these. Every tag was present and every tag was READ — by
 * dmgRange, which was the half that was already right. The defect was that the battle loop asked the
 * same three questions with its own code, and its code did not take an attacker. So each reversal is
 * the ONE argument or the ONE call that carries the attacker into the gate, and nothing else.
 *
 * EACH ONE ASSERTS THE CONTROL IN BOTH ENGINES. "Scrappy landed" must not be reachable by an engine
 * that stopped enforcing Normal-into-Ghost at all, which is a worse bug and would read as the fix
 * working — the same trap WIRE 126's demo names one section up. */
demoSource('WIRE 128 the loop asks about the ATTACKER before calling a type immunity',
/* RE-TARGETED BY ROADMAP #84, which added `_explicitFail` to this same gate, and again by ROADMAP
 * #81 WIRE 10, which made the gate a STEP closure so it returns instead of `continue`-ing. The
 * reversal is still exactly the one call that carries the attacker into the immunity question. */
  [['          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field, m)) === 0){_explicitFail=true;if(TR)TR.imm(tg);R.out=true;return;}',
    '          if (mcEff(effMoveType(mv, a.move.id, field, m), tg.types) === 0){_explicitFail=true;R.out=true;return;}']],
  (E) => {
    const dealt = (ab) => {
      const me = bare('incineroar'), ally = bare('corviknight');
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
    return dealt('none') === 0 && dealt('scrappy') > 0;
  });

demoSource('WIRE 128 a Mold Breaker is not absorbed by the ability it suppresses',
  [['        const _ab=absorbedBy(m,tg,effMoveType(mv,a.move.id,field,m));',
    '        const _ab=absorbedBy(null,tg,effMoveType(mv,a.move.id,field,m));']],
  (E) => {
    const dealt = (ab) => {
      const me = bare('tinkaton'), ally = bare('corviknight');
      const f1 = bare('hydreigon'), f2 = bare('garchomp');
      me.ability = ab; f1.ability = 'levitate';
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    return dealt('none') === 0 && dealt('moldbreaker') > 0;
  });

demoSource('WIRE 128 a Mold Breaker goes through Bulletproof, which Showdown marks breakable',
/* RE-TARGETED BY ROADMAP #84, which added `_explicitFail` to this gate too, and by ROADMAP #81
 * WIRE 10, which made it a step closure. The reversal is still the one dropped attacker argument. */
  [["        if(moveClassBlocked(tg,a.move.id,m)){_explicitFail=true;if(TR)TR.imm(tg,'[from] ability: '+tg.ability);R.out=true;return;}   // WIRE 128 -- Mold Breaker suppresses Bulletproof too",
    '        if(moveClassBlocked(tg,a.move.id)){_explicitFail=true;R.out=true;return;}']],
  (E) => {
    const dealt = (defAb, attAb) => {
      const me = bare('tyranitar'), ally = bare('corviknight');
      const f1 = bare('kommoo'), f2 = bare('garchomp');
      me.ability = attAb; f1.ability = defAb;
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'rockblast', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    return dealt('none', 'none') > 0 && dealt('bulletproof', 'none') === 0
        && dealt('bulletproof', 'moldbreaker') > 0;
  });


/* ---- THE #42/#45 CONVERSIONS, EACH AGAINST ITS OWN STRIPPED TAG ---------------------------------
 *
 * 2026-08-06. Thirty-two probes in tests/test-mechanics.js stopped calling their mechanic's function
 * and started spending a REAL TURN, which took the direct-call count to zero. A conversion is only
 * worth anything if the converted probe still fails when the mechanic is taken away -- a turn is a
 * lot of moving parts, and "the damage changed" has many more ways to be true than a direct call
 * does. So each row below strips the ONE tag the converted probe is about and asserts the probe's own
 * comparison flips.
 *
 * EVERY ASSERTION HERE SPENDS A TURN, exactly like the probe it stands behind. A demo that reverted
 * to dmgRange would be showing that a DIFFERENT test watches the knob.
 *
 * The rows are a table because they are all the same shape and a table is checkable: `strip` names
 * the tag, `run` is the two-armed comparison, and the harness above asserts green-then-red without
 * any per-row judgement. Anything that is NOT this shape -- the three WIRE 128 demos, the source
 * reversions -- stays written out longhand above. */
const rngLoseD = () => 0.99;
const turnHit = (E, sps, stage, moveId, rngIn) => {
  const me = bare(sps[0]), ally = bare(sps[1]), f1 = bare(sps[2]), f2 = bare(sps[3]);
  const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
  f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
  f2.st = Object.assign({}, f2.st, { hp: f2.st.hp * 8 }); f2.curHP = f2.st.hp;
  if (stage) stage({ me, ally, f1, f2, S });
  const before = f1.curHP;
  E.battleTurn(S, rngIn || rng5,
    new Map([[me, E.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return before - f1.curHP;
};
const CONVERSIONS = [
  { name: 'damageReduce -- Filter cuts a super-effective hit', strip: ['ability', 'filter', 'damageReduce'],
    run: () => { const h = (ab) => turnHit(M, ['garchomp', 'incineroar', 'charizard', 'milotic'],
      (B) => { B.f1.ability = ab; }, 'rockslide');
      return h('filter') < h('none'); } },
  { name: 'damageReduce -- Ice Scales halves a special hit', strip: ['ability', 'icescales', 'damageReduce'],
    run: () => { const h = (ab) => turnHit(M, ['garchomp', 'incineroar', 'milotic', 'corviknight'],
      (B) => { B.f1.ability = ab; }, 'earthpower');
      return h('icescales') < h('none'); } },
  { name: 'boostsMoveClass -- Iron Fist raises a punch and not a kick', strip: ['ability', 'ironfist', 'boostsMoveClass'],
    run: () => { const h = (ab, mv) => turnHit(M, ['incineroar', 'corviknight', 'garchomp', 'milotic'],
      (B) => { B.me.ability = ab; }, mv);
      return h('ironfist', 'drainpunch') > h('none', 'drainpunch')
          && h('ironfist', 'closecombat') === h('none', 'closecombat'); } },
  { name: 'boostsSuperEffective -- Expert Belt only on a super-effective hit', strip: ['item', 'expertbelt', 'boostsSuperEffective'],
    run: () => { const h = (it, foe) => turnHit(M, ['incineroar', 'milotic', foe, 'garchomp'],
      (B) => { B.me.item = it; }, 'flamethrower');
      return h('expertbelt', 'corviknight') > h('', 'corviknight')
          && h('expertbelt', 'garchomp') === h('', 'garchomp'); } },
  { name: 'halvesTypeDamage -- Thick Fat halves Fire and not Fighting', strip: ['ability', 'thickfat', 'halvesTypeDamage'],
    run: () => { const h = (ab, mv) => turnHit(M, ['incineroar', 'corviknight', 'milotic', 'garchomp'],
      (B) => { B.f1.ability = ab; }, mv);
      return h('thickfat', 'flamethrower') < h('none', 'flamethrower')
          && h('thickfat', 'closecombat') === h('none', 'closecombat'); } },
  { name: 'halvesTypeDamage -- Dry Skin takes MORE from Fire', strip: ['ability', 'dryskin', 'halvesTypeDamage'],
    run: () => { const h = (ab) => turnHit(M, ['incineroar', 'corviknight', 'heliolisk', 'garchomp'],
      (B) => { B.f1.ability = ab; }, 'flamethrower');
      return h('dryskin') > h('none'); } },
  { name: 'halvesTypeDamage -- Purifying Salt halves a Ghost move only', strip: ['ability', 'purifyingsalt', 'halvesTypeDamage'],
    run: () => { const h = (ab, mv) => turnHit(M, ['gengar', 'incineroar', 'garganacl', 'garchomp'],
      (B) => { B.f1.ability = ab; }, mv);
      return h('purifyingsalt', 'shadowball') < h('none', 'shadowball')
          && h('purifyingsalt', 'sludgebomb') === h('none', 'sludgebomb'); } },
  { name: 'preventsCrit -- Shell Armor removes a certain crit', strip: ['ability', 'shellarmor', 'preventsCrit'],
    run: () => { const h = (ab, mv) => turnHit(M, ['meowscarada', 'corviknight', 'garchomp', 'milotic'],
      (B) => { B.f1.ability = ab; }, mv, rngLoseD);
      return h('shellarmor', 'flowertrick') < h('none', 'flowertrick')
          && h('shellarmor', 'knockoff') === h('none', 'knockoff'); } },
  { name: 'alwaysCrit -- Flower Trick carries a crit at a roll nothing else can', strip: ['move', 'flowertrick', 'alwaysCrit'],
    run: () => { const h = (ab) => turnHit(M, ['meowscarada', 'corviknight', 'garchomp', 'milotic'],
      (B) => { B.f1.ability = ab; }, 'flowertrick', rngLoseD);
      return h('none') > h('shellarmor'); } },
  { name: 'ignoresBoosts -- Sacred Sword ignores a Defence boost', strip: ['move', 'sacredsword', 'ignoresBoosts'],
    run: () => { const h = (df, mv) => turnHit(M, ['garchomp', 'incineroar', 'corviknight', 'milotic'],
      (B) => { B.f1.boosts.df = df; }, mv);
      return h(4, 'sacredsword') === h(0, 'sacredsword') && h(4, 'closecombat') < h(0, 'closecombat'); } },
  { name: "ignoresStatStages -- Unaware ignores the attacker's +6", strip: ['ability', 'unaware', 'ignoresStatStages'],
    run: () => { const h = (ab, at) => turnHit(M, ['garchomp', 'incineroar', 'milotic', 'corviknight'],
      (B) => { B.f1.ability = ab; B.me.boosts.at = at; }, 'earthquake');
      return h('unaware', 6) < h('none', 6); } },
  { name: "critDamageUp -- Sniper multiplies a certain crit", strip: ['ability', 'sniper', 'critDamageUp'],
    run: () => { const h = (ab, mv) => turnHit(M, ['meowscarada', 'corviknight', 'milotic', 'garchomp'],
      (B) => { B.me.ability = ab; }, mv, rngLoseD);
      return h('sniper', 'flowertrick') > h('none', 'flowertrick')
          && h('sniper', 'closecombat') === h('none', 'closecombat'); } },
  { name: 'hitsTwice -- Parental Bond, and not on a spread move', strip: ['ability', 'parentalbond', 'hitsTwice'],
    run: () => { const h = (ab, mv) => turnHit(M, ['kangaskhan', 'corviknight', 'milotic', 'garchomp'],
      (B) => { B.me.ability = ab; }, mv);
      return h('parentalbond', 'doubleedge') > h('none', 'doubleedge')
          && h('parentalbond', 'earthquake') === h('none', 'earthquake'); } },
  { name: 'removesOwnSecondaries -- Sheer Force raises a secondary-carrying move', strip: ['ability', 'sheerforce', 'removesOwnSecondaries'],
    run: () => { const h = (ab, mv) => turnHit(M, ['incineroar', 'corviknight', 'milotic', 'garchomp'],
      (B) => { B.me.ability = ab; }, mv);
      return h('sheerforce', 'rockslide') > h('none', 'rockslide')
          && h('sheerforce', 'doubleedge') === h('none', 'doubleedge'); } },
  { name: 'multiAccuracy -- Triple Axel is priced below three full hits', strip: ['move', 'tripleaxel', 'multiAccuracy'],
    run: () => { const att = bare('weavile'), def = bare('garchomp');
      const ta = MC.moves['tripleaxel'];
      const one = M.dmgRange(att, def, Object.assign({}, ta, { id: '__ta_flat' }), FIELD(), false).max;
      const all = M.dmgRange(att, def, ta, FIELD(), false).max;
      return all / one < 2.95 && turnHit(M, ['weavile', 'incineroar', 'garchomp', 'milotic'], null, 'tripleaxel') > 0; } },
  { name: 'weatherScaled -- Weather Ball changes type with the sky', strip: ['move', 'weatherball', 'weatherScaled'],
    run: () => { const h = (w) => turnHit(M, ['alakazam', 'incineroar', 'gengar', 'milotic'],
      (B) => { B.S.field.weather = w; }, 'weatherball');
      return h('') === 0 && h('rain') > 0 && h('sand') > 0; } },
  { name: 'weatherScaled -- Thunder cannot miss in rain', strip: ['move', 'thunder', 'weatherScaled'],
    run: () => { const h = (w) => turnHit(M, ['pikachu', 'incineroar', 'milotic', 'garchomp'],
      (B) => { B.S.field.weather = w; }, 'thunder', rngLoseD);
      return h('rain') > 0 && h('') === 0; } },
  { name: 'convertsMoveType -- Liquid Voice makes a sound move Water', strip: ['ability', 'liquidvoice', 'convertsMoveType'],
    run: () => { const h = (ab) => turnHit(M, ['primarina', 'incineroar', 'venusaur', 'milotic'],
      (B) => { B.me.ability = ab; }, 'psychicnoise');
      return h('liquidvoice') !== h('none'); } },
  { name: 'privateWeather -- Mega Sol sees a sun nobody else does', strip: ['ability', 'megasol', 'privateWeather'],
    run: () => { const h = (mine, allies) => turnHit(M, ['meganium', 'meganium', 'corviknight', 'milotic'],
      (B) => { B.me.ability = mine; B.ally.ability = allies; }, 'flamethrower');
      return h('megasol', 'none') > h('none', 'none') && h('none', 'megasol') === h('none', 'none'); } },
  { name: 'weatherSuppression -- Air Lock returns the sun to clear', strip: ['ability', 'airlock', 'weatherSuppression'],
    run: () => { const h = (ab, w) => turnHit(M, ['charizard', 'incineroar', 'garchomp', 'milotic'],
      (B) => { B.f1.ability = ab; B.S.field.weather = w; }, 'flamethrower');
      return h('airlock', 'sun') === h('none', '') && h('none', 'sun') > h('none', ''); } },
  { name: 'boostsWhenLowered -- Intimidate into Defiant is net +1', strip: ['ability', 'defiant', 'boostsWhenLowered'],
    run: () => { const entry = (ab) => {
        const me = bare('incineroar'), ally = bare('corviknight');
        const f1 = bare('milotic'), f2 = bare('garchomp');
        me.ability = 'intimidate'; f1.ability = ab;
        M.battleInit([me, ally], [f1, f2], {});
        return f1.boosts.at;
      };
      return entry('defiant') === 1 && entry('none') === -1; } },
  { name: 'condStatMult -- Marvel Scale hardens a burned body', strip: ['ability', 'marvelscale', 'condStatMult'],
    run: () => { const h = (ab, st) => turnHit(M, ['garchomp', 'incineroar', 'milotic', 'corviknight'],
      (B) => { B.f1.ability = ab; B.f1.status = st; }, 'earthquake');
      return h('marvelscale', 'brn') < h('none', 'brn') && h('marvelscale', '') === h('none', ''); } },
  { name: 'setsTerrain -- every member of the tag lands a terrain', strip: ['move', 'grassyterrain', 'setsTerrain'],
    run: () => { const landed = (id) => {
        const me = bare('venusaur'), ally = bare('incineroar');
        const f1 = bare('garchomp'), f2 = bare('milotic');
        const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
        M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, id, null, S.field)], [ally, { kind: 'pass' }]]),
          new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
        return S.field.terrain || 'none';
      };
      return ['psychicterrain', 'electricterrain', 'grassyterrain', 'mistyterrain']
        .every(id => landed(id) !== 'none') && landed('swordsdance') === 'none'; } },
];
for (const c of CONVERSIONS) demo('#42/#45  ' + c.name, shipped, without(c.strip[0], c.strip[1], c.strip[2]), c.run);

/* INSOMNIA IS NOT A TAG-STRIP DEMO, AND FINDING THAT OUT IS WHY THE DEMO IS WORTH WRITING.
 *
 * It was written as one row of the table above and it FAILED: strip `statusImmune` off Insomnia and
 * the Spore is still refused. The tag is not the knob, and the engine says so at the line --
 * `STATUS_IMMUNE_ABIL` is a hand table, kept deliberately, because the artifact's `statusImmune`
 * param is a bare `{immune:true}` on all twelve carriers and does not say WHICH status. Consuming it
 * by shape would make Leaf Guard (sun only) and Pastel Veil (poison only) refuse everything always.
 * That deviation is already declared in docs/ENGINE.md; what was missing is a demonstration that the
 * declared thing is the thing actually running.
 *
 * So the known-bad engine is the TABLE with Insomnia taken out of the sleep row and nothing else --
 * `vitalspirit` and `sweetveil` stay, so the reversion is one ability rather than the mechanism. */
demoSource('#42/#45  statusImmune -- Insomnia refuses a Spore and takes a burn (a hand table, not the tag)',
  [["                           slp:['insomnia','vitalspirit','sweetveil'] };",
    "                           slp:['vitalspirit','sweetveil'] };"]],
  (E) => {
    const st = (ab, mv) => {
      const me = bare('venusaur'), ally = bare('corviknight');
      const f1 = bare('gholdengo'), f2 = bare('garchomp');
      f1.ability = ab;
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      E.battleTurn(S, rng5, new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return f1.status || 'none';
    };
    return st('insomnia', 'spore') === 'none' && st('none', 'spore') === 'slp'
        && st('insomnia', 'willowisp') === 'brn';
  });

/* ---- WIRE 129, ACCURACY MODIFICATION -------------------------------------------------------------
 *
 * FIVE DEMONSTRATIONS, ONE REVERTED ARGUMENT EACH, because this wire has five separable parts and a
 * single coarse reversion (turn the whole of hitChance back into moveAccuracy) would go red on all
 * five at once and prove nothing about any of them.
 *
 * THE STAGING IS ONE HELPER, exactly as it is in tests/test-mechanics.js, and for the same reason:
 * two hand-rolled accuracy comparisons in one repository is WIRE 124's defect, and writing one here
 * would reintroduce it in the file whose whole job is to prove the probes watch their knob. */
const hitOn = (E, roll, moveId, opt) => {
  const o = opt || {};
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('incineroar');
  const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
  f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
  if (o.stage) o.stage({ me, ally, f1, f2, S });
  const rng = () => roll;
  const mine = (mv) => new Map([[me, mv ? E.playerAction(me, mv, f1, S.field) : { kind: 'pass' }],
                                [ally, { kind: 'pass' }]]);
  const theirs = (mv) => new Map([[f1, mv ? E.playerAction(f1, mv, me, S.field) : { kind: 'pass' }],
                                  [f2, { kind: 'pass' }]]);
  if (o.setupMe || o.setupFoe) E.battleTurn(S, rng, mine(o.setupMe || null), theirs(o.setupFoe || null));
  const before = f1.curHP;
  E.battleTurn(S, rng, mine(moveId), theirs(null));
  return before - f1.curHP;
};

/* THE KNOWN-BAD ENGINE IS THE STAT-NAME MAP AND NOTHING ELSE. `accuracy:null, evasion:null` is
 * verbatim what this file said before the wire, and it is the whole bug for the MOVE door: eleven
 * boost appliers all key off SD2ENG, so Coil's +1 accuracy and Minimize's +2 evasion were read out of
 * data/move-effects.js, mapped to null, and dropped on the floor. hitChance, ACCMOD and the relocated
 * roll all stay exactly as shipped. */
demoSource('WIRE 129 an accuracy stage and an evasion stage exist at all (SD2ENG dropped both)',
  [["const SD2ENG={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp',accuracy:'acc',evasion:'eva'};",
    "const SD2ENG={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp',accuracy:null,evasion:null};"]],
  (E) => {
    /* Howl is the control on both engines: a setup click that raises Attack and not accuracy. If the
     * control ever LANDS the staging is wrong and the whole row is meaningless, so it is asserted on
     * the shipped engine too rather than inferred. */
    const howl = hitOn(E, 0.85, 'hydropump', { setupMe: 'howl' });
    const coil = hitOn(E, 0.85, 'hydropump', { setupMe: 'coil' });
    const plain = hitOn(E, 0.85, 'icebeam', { setupFoe: 'protect' });
    const mini = hitOn(E, 0.85, 'icebeam', { setupFoe: 'minimize' });
    return howl === 0 && coil > 0 && plain > 0 && mini === 0;
  });

/* THE KNOWN-BAD ENGINE IS TWO TABLE ROWS. Everything else about the item door — the tag gate, the
 * untabled counter, hitChance itself — is left standing, so what goes red is specifically "the engine
 * knows Wide Lens is x1.1 and Bright Powder is x0.9", in the right DIRECTIONS. */
demoSource('WIRE 129 Wide Lens and Bright Powder are in the table, on the right sides',
  [["  'item:widelens':      {side:'att',mult:1.1},", "  'item:__nolens':      {side:'att',mult:1.1},"],
   ["  'item:brightpowder':  {side:'def',mult:0.9},", "  'item:__nopowder':  {side:'def',mult:0.9},"]],
  (E) => {
    const at = (roll, stage) => hitOn(E, roll, 'hydropump', stage ? { stage } : null);
    return at(0.85) === 0 && at(0.85, (B) => { B.me.item = 'widelens'; }) > 0
        && at(0.75) > 0 && at(0.75, (B) => { B.f1.item = 'brightpowder'; }) === 0;
  });

/* THE KNOWN-BAD ENGINE IS THE WEATHER GATE, AND IT IS REVERTED IN THE DIRECTION THAT STILL "WORKS".
 * `return true` leaves Sand Veil firing — the mechanic looks live, the sand arm still misses — and
 * only the CLEAR-SKY control catches it. That is the shape a one-armed probe cannot see, and the
 * reason this probe has three arms: a permanent 20% evasion bonus on every Garchomp in the format
 * would otherwise have printed as a working feature. */
demoSource('WIRE 129 Sand Veil fires ONLY in sand (the gate, not the ability)',
  [["  if(w==='sand')return ctx.weather==='sand';", "  if(w==='sand')return true;"]],
  (E) => {
    const at = (ab, wx) => hitOn(E, 0.70, 'hydropump',
      { stage: (B) => { B.f1.ability = ab; B.S.field.weather = wx; } });
    return at('sandveil', '') > 0 && at('none', 'sand') > 0 && at('sandveil', 'sand') === 0;
  });

/* THE KNOWN-BAD ENGINE IS ONE OPERAND. No Guard's handler is onAnyAccuracy — it does not care which
 * end of the move it is on — and an attacker-only implementation is the half a reasonable person
 * ships. Dropping `||_neverMissAb(def)` leaves the attacker half working, so the row goes red only on
 * the direction that was dropped. */
demoSource('WIRE 129 No Guard works from the TARGET as well as from the attacker',
  [['  if(_neverMissAb(att)||_neverMissAb(def))return Infinity;', '  if(_neverMissAb(att))return Infinity;']],
  (E) => {
    const at = (mine, theirs) => hitOn(E, 0.99, 'hydropump',
      { stage: (B) => { B.me.ability = mine; B.f1.ability = theirs; } });
    return at('none', 'none') === 0 && at('noguard', 'none') > 0 && at('none', 'noguard') > 0;
  });

/* THE KNOWN-BAD ENGINE IS THE DEFENDER ARGUMENT AT THE ATTACK SITE — the relocation itself. Before
 * this wire the to-hit roll happened ABOVE target resolution, so there was no defender to ask about.
 * `null` is exactly that engine, with hitChance, ACCMOD and the stage table all intact.
 *
 * IT ASSERTS THE ATTACKER SIDE STILL WORKS ON THE REVERTED BUILD, and that is the point: "accuracy
 * modification is on" is TRUE there. What is missing is only the half that needs a body on the other
 * side, which is where every evasion item and ability in this format lives. */
/* RE-TARGETED BY ROADMAP #81 WIRE 10, which moved the roll from above the immunity gates into step 4
 * of the step list and therefore made it read its surviving-row count instead of `targets`. The
 * reversal is still exactly the defender argument, at its new home. */
demoSource('WIRE 129 the attack-site roll knows WHO it is aimed at',
  [["          const _accDef=(!a.move.spread&&_acc1.length===1)?_acc1[0].tg:null;",
    "          const _accDef=null;"]],
  (E) => {
    const at = (roll, stage) => hitOn(E, roll, 'hydropump', stage ? { stage } : null);
    const lens = at(0.85, (B) => { B.me.item = 'widelens'; }) > 0;   // attacker side: TRUE on both engines
    const powder = at(0.75, (B) => { B.f1.item = 'brightpowder'; }) === 0;
    const veil = at(0.70, (B) => { B.f1.ability = 'sandveil'; B.S.field.weather = 'sand'; }) === 0;
    return lens && powder && veil;
  });

/* ---- WIRE 130 AND THE #51 BATCH -----------------------------------------------------------------
 *
 * ONE STAGING, shared, for the same reason as hitOn above. `setupFoe` is clicked by the body that is
 * then attacked, which is what a Substitute probe needs and what a hand-rolled version keeps getting
 * backwards. */
const twoOn = (E, opt) => {
  const o = opt || {};
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('incineroar');
  const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
  if (o.big) { f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp; }
  if (o.stage) o.stage({ me, ally, f1, f2, S });
  const rng = () => (o.roll == null ? 0.5 : o.roll);
  const mine = (mv) => new Map([[me, mv ? E.playerAction(me, mv, f1, S.field) : { kind: 'pass' }],
                                [ally, { kind: 'pass' }]]);
  const theirs = (mv) => new Map([[f1, mv ? E.playerAction(f1, mv, me, S.field) : { kind: 'pass' }],
                                  [f2, { kind: 'pass' }]]);
  let paid = 0;
  if (o.setupMe || o.setupFoe) {
    const h = f1.curHP;
    E.battleTurn(S, rng, mine(o.setupMe || null), theirs(o.setupFoe || null));
    paid = h - f1.curHP;
  }
  const before = f1.curHP;
  if (o.move || o.foeMove) E.battleTurn(S, rng, mine(o.move || null), theirs(o.foeMove || null));
  return { paid, dmg: before - f1.curHP, sub: f1._sub || 0, hp: f1.curHP,
           fainted: !!f1.fainted, status: f1.status || '-', me, f1 };
};

/* THE KNOWN-BAD ENGINE IS THE ENGINE AS SHIPPED BEFORE THIS PASS: the generic costsUserHP block paid
 * for the doll and the call that BUILDS it was not there. Nothing else moves -- subBlocks, SUBPASS
 * and the absorb site all stay -- so the row goes red on exactly the missing half. */
demoSource('WIRE 130 the Substitute that was paid for is actually built',
  [['          grantSubstitute(m,a.mv||a.move.id);\n', '']],
  (E) => {
    const ctrl = twoOn(E, { setupFoe: 'howl', move: 'icebeam' });
    const sub = twoOn(E, { setupFoe: 'substitute', move: 'icebeam' });
    /* The COST is asserted on both engines: the pre-wire build really did pay it, so "Substitute did
     * nothing" cannot be reached by an engine in which the click failed outright. */
    return ctrl.dmg > 0 && sub.paid > 0 && sub.dmg === 0;
  });

/* THE KNOWN-BAD ENGINE IS THE BYPASS, AND IT IS REVERTED IN THE DIRECTION THAT STILL "WORKS".
 * `tg._sub>0` is what the absorb site said for its whole life, and it makes the substitute STRONGER
 * than the real game's -- Hyper Voice, Boomburst, Snarl and every other sound move stopped dead, and
 * an Infiltrator body walled by a doll it ignores. The Ice Beam arm still passes there, so only the
 * bypass arm can see it. */
demoSource('WIRE 130 a sound move and an Infiltrator go THROUGH the doll',
  /* ROADMAP #68 re-anchored: the shipped branch now emits `|-activate|` for the doll and `|-end|`
   * when it breaks. ROADMAP #81 WIRE 10 re-anchored again: the branch sits in a step closure, so it
   * drops its row rather than `continue`-ing. The REVERSAL is unchanged in substance -- the bare
   * `_sub > 0` test, which is the bypass defect this demonstration exists to show red. */
  [[`        if(subBlocks(m,tg,a.move.id)){const _s0=tg._sub;tg._sub=Math.max(0,tg._sub-dmg);
          if(TR){TR.act(tg,'move: Substitute','[damage]');if(_s0>0&&tg._sub<=0)TR.vend(tg,'Substitute');}
          R.out=true;return;}`,
    '        if(tg._sub>0){tg._sub=Math.max(0,tg._sub-dmg);R.out=true;return;}']],
  (E) => {
    const beam = twoOn(E, { setupFoe: 'substitute', move: 'icebeam' });
    const sound = twoOn(E, { setupFoe: 'substitute', move: 'hypervoice' });
    const inf = twoOn(E, { setupFoe: 'substitute', move: 'icebeam',
                           stage: (B) => { B.me.ability = 'infiltrator'; } });
    return beam.dmg === 0 && sound.dmg > 0 && inf.dmg > 0;
  });

/* THE KNOWN-BAD ENGINE IS THE EARLY FAIL. Without it the second Substitute pays another quarter of
 * max HP and grantSubstitute refuses to replace the doll, so the click is a pure loss -- the same
 * shape as the bug this wire fixed, one turn later. */
demoSource('WIRE 130 a second Substitute costs nothing',
/* RE-TARGETED BY ROADMAP #84: the twenty-one `if(TR)TR.fail(m)` sites became `mvFail(m)`, which
 * writes the move result whether or not a trace is attached. The reversal still deletes exactly this
 * one early-fail line and nothing else. */
  [['          if(m._sub>0&&TAGS.has(\'move\',a.mv||a.move.id,\'substitute\')){m._lastMove=a.mv||a.move.id;mvFail(m);continue;}\n', '']],
  (E) => {
    const twice = twoOn(E, { setupFoe: 'substitute', foeMove: 'substitute' });
    const once = twoOn(E, { setupFoe: 'howl', foeMove: 'substitute' });
    return once.dmg > 0 && twice.dmg === 0;
  });

demo('#51  swapsAbilities -- Skill Swap exchanges the two abilities',
  shipped, without('move', 'skillswap', 'swapsAbilities'), () => {
    const r = twoOn(M, { move: 'skillswap',
      stage: (B) => { B.me.ability = 'blaze'; B.f1.ability = 'intimidate'; } });
    return r.me.ability === 'intimidate' && r.f1.ability === 'blaze';
  });

demo('#51  variablePower -- Acrobatics doubles with an empty hand',
  shipped, without('move', 'acrobatics', 'variablePower'), () => {
    const at = (item) => twoOn(M, { big: true, move: 'acrobatics',
                                    stage: (B) => { B.me.item = item; } }).dmg;
    const held = at('leftovers'), empty = at('');
    return held > 0 && empty >= 2 * held - 2;
  });

demo('#51  fixedDamage(ohko) -- Fissure kills a body no roll could reach',
  shipped, without('move', 'fissure', 'fixedDamage'), () => {
    const hit = twoOn(M, { big: true, move: 'fissure', roll: 0.1 });
    const normal = twoOn(M, { big: true, move: 'icebeam', roll: 0.1 });
    return hit.fainted && !normal.fainted && normal.dmg > 0;
  });

demo('#51  survivesFromFull -- Sturdy holds at 1 from full and not from 90%',
  shipped, without('ability', 'sturdy', 'survivesFromFull'), () => {
    const at = (frac) => twoOn(M, { move: 'icebeam', stage: (B) => {
      B.f1.ability = 'sturdy';
      B.me.st = Object.assign({}, B.me.st, { sa: 400 });
      B.f1.curHP = Math.floor(B.f1.st.hp * frac);
    } });
    const full = at(1), chipped = at(0.9);
    return !full.fainted && full.hp === 1 && chipped.fainted;
  });

demo('#51  ignoresScreensAndSubs -- Infiltrator hits the body behind the doll',
  shipped, without('ability', 'infiltrator', 'ignoresScreensAndSubs'), () => {
    const blocked = twoOn(M, { setupFoe: 'substitute', move: 'icebeam' });
    const through = twoOn(M, { setupFoe: 'substitute', move: 'icebeam',
                               stage: (B) => { B.me.ability = 'infiltrator'; } });
    return blocked.dmg === 0 && through.dmg > 0;
  });

demo('#51  boostsFromFallen -- Supreme Overlord counts the dead at switch-in',
  shipped, without('ability', 'supremeoverlord', 'boostsFromFallen'), () => {
    const run = (dead, ab) => {
      const lead = bare('milotic'), ally = bare('incineroar');
      const f1 = bare('garchomp'), f2 = bare('incineroar');
      const king = bare('kingambit'); king.ability = ab;
      const d = [bare('milotic'), bare('milotic'), bare('milotic')];
      const S = M.battleInit([lead, ally, king].concat(d), [f1, f2], { seeded: true });
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      for (let i = 0; i < dead; i++) { d[i].fainted = true; d[i].curHP = 0; }
      const P2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
      M.battleTurn(S, rng5, P2(lead, ally), P2(f1, f2));
      M.battleTurn(S, rng5, new Map([[lead, { kind: 'switch', to: king }], [ally, { kind: 'pass' }]]), P2(f1, f2));
      const before = f1.curHP;
      M.battleTurn(S, rng5, new Map([[king, M.playerAction(king, 'ironhead', f1, S.field)], [ally, { kind: 'pass' }]]),
        P2(f1, f2));
      return before - f1.curHP;
    };
    const zero = run(0, 'supremeoverlord'), three = run(3, 'supremeoverlord'), none3 = run(3, 'none');
    return zero > 0 && none3 === zero && three > zero;
  });

/* ---- WIRE 131 — THE VALUATION PATH ---------------------------------------------------------------
 *
 * THESE ARE REVERTS THAT STILL WORK, which is the only kind worth having here. The reverted engine
 * returns 0.8 for an 80%-accuracy move — a completely plausible number — so nothing crashes, nothing
 * reads as absent, and only a CONTROL ARM that varies the defender can tell the difference. That is
 * the same shape as WIRE 129's `_accWhen('sand') -> return true`.
 *
 * The bodies are staged through battleInit so the ability, item and boost table are the ones a real
 * turn would see, and the assertion is on the two numbers a DECISION is made from — never on damage,
 * because damage is the resolution path and the resolution path was already right. */
const valued = (E, moveId, stage) => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('incineroar');
  const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
  if (stage) stage({ me, ally, f1, f2, S });
  me.moves = [moveId];
  const b = E.bestMoveVs(me, f1, S.field);
  const pa = E.playerAction(me, moveId, f1, S.field);
  return { best: b ? +b.acc.toFixed(4) : null, action: +pa.move.acc.toFixed(4) };
};

demoSource('WIRE 131 bestMoveVs prices the DEFENDER (the old line took no defender at all)',
  [['    const acc=hitProb(att,def,id,field);const d=dmgRange(att,def,mv,field,SPREAD.has(id));',
    "    const acc=att.ability==='noguard'?1:moveAccuracy(id,field)/100;const d=dmgRange(att,def,mv,field,SPREAD.has(id));"]],
  (E) => {
    const bare_ = valued(E, 'hydropump', null).best;
    const bp = valued(E, 'hydropump', (B) => { B.f1.item = 'brightpowder'; }).best;
    const eva = valued(E, 'hydropump', (B) => { B.f1.boosts.eva = 6; }).best;
    const ng = valued(E, 'hydropump', (B) => { B.f1.ability = 'noguard'; }).best;
    /* The CONTROL is the bare arm sitting at the printed 0.8 — so "everything is 1" cannot pass. */
    return bare_ === 0.8 && bp === 0.72 && eva < 0.3 && ng === 1;
  });

demoSource("WIRE 131 the action object's acc is this click into THIS body",
  [["    return {kind:'attack',move:{id,mv,spread,d:dmgRange(me,target,mv,field,spread),acc:hitProb(me,target,id,field)},target};",
    "    return {kind:'attack',move:{id,mv,spread,d:dmgRange(me,target,mv,field,spread),acc:moveAccuracy(id,field)/100},target};"]],
  (E) => {
    const bare_ = valued(E, 'hydropump', null).action;
    const ng = valued(E, 'hydropump', (B) => { B.f1.ability = 'noguard'; }).action;
    const lens = valued(E, 'hydropump', (B) => { B.me.item = 'widelens'; }).action;
    return bare_ === 0.8 && ng === 1 && lens === 0.88;
  });

/* THE OTHER TWO SITES ARE DECLARED WITHOUT A DEMONSTRATION, AND THE REASON IS THAT ONE WOULD BE A
 * DIFFERENT TEST WEARING THIS ONE'S NAME. The KO scan and `bestKOsNow` live inside `_chooseAction`,
 * which is not exported; reaching them means letting the bot pick freely and reading which foe lost
 * HP, and every arm of that experiment printed the SAME two numbers (67/67) because the partner, the
 * priors sampler and the to-hit roll all move underneath it. A demonstration that cannot isolate its
 * knob is the hollow shape this file exists to reject, so the state is reported rather than staged.
 * Both lines are still PINNED: the two reverts above assert their own text applied, and the census
 * probes assert the two exported numbers. Filed in docs/ENGINE.md. */


/* ---- THE ARMING PASS, 2026-08-06: EVERY NEWLY-ARMED PROBE SHOWN RED ------------------------------
 *
 * The census's `unarmed` count went 76 -> 0 in this pass. Declaring two arms is PAPERWORK on its own;
 * what makes an arm worth anything is that the pair actually FLIPS when the mechanic is taken away.
 * So each row below re-runs the probe's own two-arm assertion against a known-bad artifact.
 *
 * The staging is deliberately the probe's staging and not a simplified version of it: a demonstration
 * that stages the mechanic differently from the probe proves something about the demonstration.
 *
 * A tag that is read ONCE AT MODULE LOAD cannot be demonstrated this way and is named rather than
 * faked: `move|spreadAll` is consumed through `const HITS_ALLY = new Set(TAGS.withTag(...))` at
 * medicham2-browser.js:230, which is evaluated when the module is required, so __setDB afterwards
 * cannot reach it. That is reported in docs/ENGINE.md, not worked around. */

/* ONE STAGING FOR THE WHOLE BLOCK, matching tests/test-mechanics.js's `board()` + PASS2. */
const P2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
const stage4 = (E, sps, mut) => {
  const me = bare(sps[0]), ally = bare(sps[1]), f1 = bare(sps[2]), f2 = bare(sps[3]);
  const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
  if (mut) mut({ me, ally, f1, f2, S });
  return { me, ally, f1, f2, S };
};
/* the aimed foe's HP loss over one turn, with an optional mutation before the click */
const dmgOn = (E, sps, mv, mut, roll) => {
  const B = stage4(E, sps, mut);
  const before = B.f1.curHP;
  E.battleTurn(B.S, () => (roll == null ? 0.5 : roll),
    new Map([[B.me, mv ? E.playerAction(B.me, mv, B.f1, B.S.field) : { kind: 'pass' }], [B.ally, { kind: 'pass' }]]),
    P2(B.f1, B.f2));
  return before - B.f1.curHP;
};

/* THE FIRST VERSION OF THIS ROW STRIPPED THE TAG OFF **FLARE BLITZ** AND STAYED GREEN, WHICH IS THE
 * DEMONSTRATION EARNING ITS KEEP. The engine thaws on `effMoveType === 'Fire' || TAGS.has(...)`, so a
 * Fire move satisfies the first clause and the artifact is never consulted. Matcha Gotcha (GRASS,
 * 5,352 uses) is the carrier the tag actually drives, and the probe in tests/test-mechanics.js gained
 * that arm because of this row. */
demo('ARM  thawsTarget -- a GRASS move with the tag thaws, and Crunch does not',
  shipped, without('move', 'matchagotcha', 'thawsTarget'), () => {
    const run = (mv) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp'], (b) => { b.f1.status = 'frz'; });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.f1.fainted ? 'FAINTED' : (B.f1.status || 'none');
    };
    return run('crunch') === 'frz' && run('matchagotcha') === 'none';
  });

demo('ARM  survivesFromFull -- a Focus Sash holder is left on 1',
  shipped, without('item', 'focussash', 'survivesFromFull'), () => {
    const run = (item) => {
      const B = stage4(M, ['garchomp', 'incineroar', 'alakazam', 'garchomp'], (b) => { b.f1.item = item; });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'earthquake', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return { hp: B.f1.curHP, dead: !!B.f1.fainted };
    };
    const none = run(''), sash = run('focussash');
    return none.dead && !sash.dead && sash.hp === 1;
  });

demo('ARM  healsAtThreshold -- Sitrus fires below half and an empty hand does not',
  shipped, without('item', 'sitrusberry', 'healsAtThreshold'), () => {
    const run = (item) => {
      const B = stage4(M, ['milotic', 'incineroar', 'corviknight', 'garchomp'],
        (b) => { b.f1.item = item; b.f1.curHP = Math.floor(b.f1.st.hp * 0.55); });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'surf', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.f1.curHP;
    };
    return run('sitrusberry') > run('');
  });

demo('ARM  resistBerry -- Chople halves a super-effective Fighting hit',
  shipped, without('item', 'chopleberry', 'resistBerry'), () => {
    const took = (item) => dmgOn(M, ['incineroar', 'corviknight', 'kingambit', 'garchomp'], 'closecombat',
      (b) => { b.f1.item = item; });
    const none = took(''), berry = took('chopleberry');
    return none > 0 && berry < none;
  });

demo('ARM  passiveHeal -- Leftovers ticks and an empty hand does not',
  shipped, without('item', 'leftovers', 'passiveHeal'), () => {
    const run = (item) => {
      const B = stage4(M, ['incineroar', 'incineroar', 'garchomp', 'garchomp'],
        (b) => { b.me.item = item; b.me.curHP = Math.floor(b.me.st.hp / 2); });
      const before = B.me.curHP;
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), P2(B.f1, B.f2));
      return B.me.curHP - before;
    };
    return run('') === 0 && run('leftovers') > 0;
  });

demo('ARM  sealsMoves -- a Disabled foe stops repeating, and an undisabled one repeats',
  shipped, without('move', 'disable', 'sealsMoves'), () => {
    const run = (disable) => {
      const B = stage4(M, ['whimsicott', 'incineroar', 'garchomp', 'garchomp']);
      M.battleTurn(B.S, rng5, P2(B.me, B.ally),
        new Map([[B.f1, M.playerAction(B.f1, 'earthquake', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
      const committed = B.f1._lastMove;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, disable ? M.playerAction(B.me, 'disable', B.f1, B.S.field) : { kind: 'pass' }],
                 [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), new Map([[B.f2, { kind: 'pass' }]]));
      const rec = (B.S.lastActs || []).find(x => x.side === 'B');
      return { committed, then: rec && (rec.move || rec.kind) };
    };
    const free = run(false), sealed = run(true);
    return free.then === free.committed && sealed.then !== sealed.committed;
  });

demo('ARM  punishesAttacker -- Rough Skin tolls contact and leaves a special hit alone',
  shipped, without('ability', 'roughskin', 'punishesAttacker'), () => {
    const lost = (ab, mv) => {
      const B = stage4(M, ['milotic', 'corviknight', 'garchomp', 'garchomp'], (b) => { b.f1.ability = ab; });
      const before = B.me.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return before - B.me.curHP;
    };
    return lost('none', 'waterfall') === 0 && lost('roughskin', 'waterfall') > 0
        && lost('roughskin', 'surf') === 0;
  });

demo('ARM  drain -- Drain Punch returns HP and Close Combat does not',
  shipped, without('move', 'drainpunch', 'drain'), () => {
    const run = (mv) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp'], (b) => {
        b.me.curHP = Math.floor(b.me.st.hp / 2);
        b.f1.st = Object.assign({}, b.f1.st, { hp: b.f1.st.hp * 8 }); b.f1.curHP = b.f1.st.hp;
      });
      const before = B.me.curHP, foe = B.f1.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return { gained: B.me.curHP - before, dealt: foe - B.f1.curHP };
    };
    const cc = run('closecombat'), dp = run('drainpunch');
    return cc.dealt > 0 && cc.gained === 0 && dp.dealt > 0 && dp.gained > 0;
  });

demo('ARM  priorityMod -- Prankster puts the screen in front of a faster foe',
  shipped, without('ability', 'prankster', 'priorityMod'), () => {
    const took = (ab) => {
      const B = stage4(M, ['grimmsnarl', 'incineroar', 'weavile', 'garchomp'], (b) => { b.me.ability = ab; });
      const before = B.me.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'reflect', null, B.S.field)], [B.ally, { kind: 'pass' }]]),
        new Map([[B.f1, M.playerAction(B.f1, 'iciclecrash', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
      return before - B.me.curHP;
    };
    const off = took('none'), on = took('prankster');
    return off > 0 && on > 0 && on < off;
  });

demo('ARM  pivotStatus -- Parting Shot leaves and Charm does not',
  shipped, without('move', 'partingshot', 'pivotStatus'), () => {
    const run = (mv) => {
      const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
      const f1 = bare('garchomp'), f2 = bare('garchomp');
      const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), P2(f1, f2));
      return S.actA.map(x => x && x.name).join(',');
    };
    return run('charm') === 'incineroar,corviknight' && run('partingshot') === 'milotic,corviknight';
  });

demo('ARM  pivotDamaging -- U-turn leaves and Crunch does not',
  shipped, without('move', 'uturn', 'pivotDamaging'), () => {
    const run = (mv) => {
      const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
      const f1 = bare('garchomp'), f2 = bare('garchomp');
      const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
      const before = f1.curHP;
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), P2(f1, f2));
      return { dealt: before - f1.curHP, front: S.actA.map(x => x && x.name).join(',') };
    };
    const c = run('crunch'), t = run('uturn');
    return c.dealt > 0 && c.front === 'incineroar,corviknight'
        && t.dealt > 0 && t.front === 'milotic,corviknight';
  });

demo('ARM  halvesDamage -- Reflect cuts a physical hit',
  shipped, without('move', 'reflect', 'halvesDamage'), () => {
    const run = (screen) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp']);
      M.battleTurn(B.S, rng5,
        new Map([[B.me, screen ? M.playerAction(B.me, 'reflect', null, B.S.field) : { kind: 'pass' }],
                 [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      B.me.curHP = B.me.st.hp;
      const before = B.me.curHP;
      M.battleTurn(B.S, rng5, P2(B.me, B.ally),
        new Map([[B.f1, M.playerAction(B.f1, 'earthquake', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
      return before - B.me.curHP;
    };
    const off = run(false), on = run(true);
    return on > 0 && on < off;
  });

demo('ARM  chargeTurn -- Fly deals nothing on turn 1 and Brave Bird does',
  shipped, without('move', 'fly', 'chargeTurn'), () => {
    const run = (mv, turns) => {
      const B = stage4(M, ['staraptor', 'incineroar', 'garchomp', 'garchomp']);
      const out = [];
      for (let i = 0; i < turns; i++) {
        const hp = B.f1.curHP;
        M.battleTurn(B.S, rng5,
          new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
        out.push(hp - B.f1.curHP);
      }
      return out;
    };
    const bird = run('bravebird', 1), fly = run('fly', 2);
    return bird[0] > 0 && fly[0] === 0 && fly[1] > 0;
  });

demo('ARM  failsIfTargetNotAttacking -- Sucker Punch lands into an attack and fails into a pass',
  shipped, without('move', 'suckerpunch', 'failsIfTargetNotAttacking'), () => {
    const run = (foeAttacks) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp']);
      const before = B.f1.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'suckerpunch', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
        new Map([[B.f1, foeAttacks ? M.playerAction(B.f1, 'earthquake', B.me, B.S.field) : { kind: 'pass' }],
                 [B.f2, { kind: 'pass' }]]));
      return before - B.f1.curHP;
    };
    return run(true) > 0 && run(false) === 0;
  });

/* THE TAG THE ENGINE CONSUMES IS `removesItem`, NOT `readsTargetItem`, and the first version of this
 * row proved it by staying green on a `readsTargetItem` strip. The comment at medicham2:4243 says so
 * in as many words -- "Knock Off, Covet, Thief, Trick, Switcheroo, Bug Bite, Pluck and Corrosive Gas
 * from one rule and no names". So the census's `readsTargetItem` row is really a probe of the
 * `removesItem` wire, and the known-bad engine has to be built from the tag that is read. */
demo('ARM  readsTargetItem -- Knock Off empties the aimed hand only, and Crunch empties none',
  shipped, without('move', 'knockoff', 'removesItem'), () => {
    const run = (mv) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp'],
        (b) => { b.f1.item = 'lifeorb'; b.f2.item = 'lifeorb'; });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return [B.f1.item || '', B.f2.item || ''];
    };
    return String(run('crunch')) === 'lifeorb,lifeorb' && String(run('knockoff')) === ',lifeorb';
  });

/* Same correction: the STEAL is `removesItem.steals` on Covet, derived from the move's own handler
 * calling setItem. Stripping `takesTargetItem` left the row green. */
demo('ARM  takesTargetItem -- Covet puts the item in MY hand and Knock Off does not',
  shipped, without('move', 'covet', 'removesItem'), () => {
    const run = (mv) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp'],
        (b) => { b.f1.item = 'lifeorb'; b.me.item = ''; });
      const act = M.playerAction(B.me, mv, B.f1, B.S.field);
      if (!act || act.kind === 'pass') return ['RESOLVED-TO-' + (act && act.kind), ''];
      M.battleTurn(B.S, rng5, new Map([[B.me, act], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return [B.me.item || '', B.f1.item || ''];
    };
    return String(run('knockoff')) === ',' && String(run('covet')) === 'lifeorb,';
  });

demo('ARM  healsAlly -- Life Dew reaches the partner and Recover does not',
  shipped, without('move', 'lifedew', 'healsAlly'), () => {
    const run = (mv) => {
      const B = stage4(M, ['milotic', 'incineroar', 'garchomp', 'garchomp'], (b) => {
        b.me.curHP = Math.floor(b.me.st.hp / 2);
        b.ally.curHP = Math.floor(b.ally.st.hp / 2);
      });
      const before = B.ally.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, null, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.ally.curHP - before;
    };
    return run('recover') === 0 && run('lifedew') > 0;
  });

/* Encore's volatile arrives through `statusInflict`, which is how playerAction classifies it (the
 * same route WIRE 130 found Substitute taking). `locksTarget` is not read, so that is the tag the
 * known-bad engine has to lose. */
demo('ARM  locksTarget -- an Encored foe repeats a move it would not have chosen',
  shipped, without('move', 'encore', 'statusInflict'), () => {
    const run = (enc) => {
      const B = stage4(M, ['whimsicott', 'incineroar', 'garchomp', 'garchomp']);
      M.battleTurn(B.S, rng5, P2(B.me, B.ally),
        new Map([[B.f1, M.playerAction(B.f1, 'rockslide', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
      M.battleTurn(B.S, rng5,
        new Map([[B.me, enc ? M.playerAction(B.me, 'encore', B.f1, B.S.field) : { kind: 'pass' }],
                 [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), new Map([[B.f2, { kind: 'pass' }]]));
      const rec = (B.S.lastActs || []).find(x => x.side === 'B');
      return (rec && (rec.move || rec.kind)) || 'nothing';
    };
    return run(false) !== 'rockslide' && run(true) === 'rockslide';
  });

demo('ARM  forbidsStatusMoves -- a Taunted foe clicks an attack and a free one clicks a status move',
  shipped, without('move', 'taunt', 'forbidsStatusMoves'), () => {
    const run = (taunt) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'whimsicott', 'garchomp']);
      M.battleTurn(B.S, rng5,
        new Map([[B.me, taunt ? M.playerAction(B.me, 'taunt', B.f1, B.S.field) : { kind: 'pass' }],
                 [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), new Map([[B.f2, { kind: 'pass' }]]));
      const rec = (B.S.lastActs || []).find(x => x.side === 'B');
      const kind = (rec && rec.kind) || 'nothing';
      return kind !== 'nothing' && (kind !== 'attack'
        || !!(rec.move && MC.moves[rec.move] && !MC.moves[rec.move].bp));
    };
    return run(false) === true && run(true) === false;
  });

/* A SOURCE REVERT, AND THE REASON IS A FINDING: playerAction routes Tailwind by its NAME
 * (`if(id==='tailwind')`), not by `doublesSideSpeed`, so the tag strip left the mechanic working.
 * That is a hard-coded id where the rest of the file reads a tag, and it is reported in
 * docs/ENGINE.md. The known-bad engine is the line removed. */
demoSource('ARM  doublesSideSpeed -- Tailwind doubles MY side and leaves the foe alone',
  [["  if(id==='tailwind')return {kind:'tail',mv:id};\n", '']],
  (E) => {
    const run = (mv) => {
      const B = stage4(E, ['whimsicott', 'incineroar', 'garchomp', 'garchomp']);
      const b = [E.effSpeed(B.ally, B.S.field, 'A'), E.effSpeed(B.f1, B.S.field, 'B')];
      E.battleTurn(B.S, rng5,
        new Map([[B.me, E.playerAction(B.me, mv, null, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return [E.effSpeed(B.ally, B.S.field, 'A') / b[0], E.effSpeed(B.f1, B.S.field, 'B') / b[1]];
    };
    const c = run('recover'), t = run('tailwind');
    return String(c) === '1,1' && t[0] > 1.8 && t[1] === 1;
  });

demo('ARM  choiceLock -- a Scarf holder ignores the second click and an empty hand honours it',
  shipped, without('item', 'choicescarf', 'choiceLock'), () => {
    const run = (item) => {
      const B = stage4(M, ['basculegion', 'incineroar', 'garchomp', 'garchomp'], (b) => {
        b.me.item = item;
        b.f1.st = Object.assign({}, b.f1.st, { hp: b.f1.st.hp * 8 }); b.f1.curHP = b.f1.st.hp;
      });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'crunch', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      const first = B.me._lastMove;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'closecombat', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return [first, B.me._lastMove];
    };
    return String(run('')) === 'crunch,closecombat' && String(run('choicescarf')) === 'crunch,crunch';
  });

demo('ARM  speedOnItemLoss -- Unburden doubles once the hand empties and nothing else does',
  shipped, without('ability', 'unburden', 'speedOnItemLoss'), () => {
    const run = (ab) => {
      const m = bare('weavile'); m.ability = ab; m.item = 'focussash';
      const ally = bare('incineroar'), f1 = bare('garchomp'), f2 = bare('garchomp');
      const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
      const held = M.effSpeed(m, S.field, 'A');
      m.item = '';
      return [held, M.effSpeed(m, S.field, 'A')];
    };
    const c = run('none'), t = run('unburden');
    return c[1] === c[0] && t[1] > t[0] * 1.8;
  });

demo('ARM  hazard -- Stealth Rock chips the switch-in and Howl does not',
  shipped, without('move', 'stealthrock', 'hazard'), () => {
    const run = (mv) => {
      const me = bare('garchomp'), ally = bare('corviknight');
      const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('staraptor');
      const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), P2(f1, f2));
      const before = fbench.curHP;
      M.battleTurn(S, rng5, P2(me, ally),
        new Map([[f1, { kind: 'switch', to: fbench }], [f2, { kind: 'pass' }]]));
      return { cameIn: S.actB.indexOf(fbench) >= 0, lost: before - fbench.curHP };
    };
    const c = run('howl'), t = run('stealthrock');
    return c.cameIn && c.lost === 0 && t.cameIn && t.lost > 0;
  });

demo('ARM  punishesContact -- Spiky Shield tolls the blocked attacker and Protect does not',
  shipped, without('move', 'spikyshield', 'punishesContact'), () => {
    const run = (shield) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp']);
      const before = B.f1.curHP, meBefore = B.me.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, shield, null, B.S.field)], [B.ally, { kind: 'pass' }]]),
        new Map([[B.f1, M.playerAction(B.f1, 'dragonclaw', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
      return { blocked: (meBefore - B.me.curHP) === 0, toll: before - B.f1.curHP };
    };
    const c = run('protect'), t = run('spikyshield');
    return c.blocked && c.toll === 0 && t.blocked && t.toll > 0;
  });

demo('ARM  forcesSwitch -- Dragon Tail drags and Dragon Claw does not',
  shipped, without('move', 'dragontail', 'forcesSwitch'), () => {
    const run = (mv) => {
      const me = bare('garchomp'), ally = bare('corviknight');
      const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('whimsicott');
      const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
      const before = f1.curHP;
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), P2(f1, f2));
      return { dealt: before - f1.curHP, dragged: S.actB.indexOf(f1) < 0 };
    };
    const c = run('dragonclaw'), t = run('dragontail');
    return c.dealt > 0 && !c.dragged && t.dealt > 0 && t.dragged;
  });

demo('ARM  userFaints -- Explosion kills its user and Crunch does not',
  shipped, without('move', 'explosion', 'userFaints'), () => {
    const run = (mv) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp'], (b) => {
        b.f1.st = Object.assign({}, b.f1.st, { hp: b.f1.st.hp * 8 }); b.f1.curHP = b.f1.st.hp;
      });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return (B.me.fainted || B.me.curHP <= 0) ? 'FAINTED' : 'alive';
    };
    return run('crunch') === 'alive' && run('explosion') === 'FAINTED';
  });

demo('ARM  invertsBoosts -- Contrary turns the self-drop upward',
  shipped, without('ability', 'contrary', 'invertsBoosts'), () => {
    const run = (ab) => {
      const B = stage4(M, ['staraptor', 'incineroar', 'garchomp', 'garchomp'], (b) => { b.me.ability = ab; });
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'closecombat', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.me.boosts.df;
    };
    return run('none') < 0 && run('contrary') > 0;
  });

demo('ARM  boostsEachTurn -- Speed Boost keeps going, turn after turn',
  shipped, without('ability', 'speedboost', 'boostsEachTurn'), () => {
    const run = (ab) => {
      const B = stage4(M, ['staraptor', 'incineroar', 'garchomp', 'garchomp'], (b) => { b.me.ability = ab; });
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), P2(B.f1, B.f2));
      const one = B.me.boosts.sp;
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), P2(B.f1, B.f2));
      return [one, B.me.boosts.sp];
    };
    return String(run('none')) === '0,0' && String(run('speedboost')) === '1,2';
  });

demo('ARM  restoresStats -- White Herb undoes the drop and an empty hand keeps it',
  shipped, without('item', 'whiteherb', 'restoresStats'), () => {
    const run = (item) => {
      const m = bare('garchomp'); m.item = item;
      const ally = bare('incineroar'), f1 = bare('incineroar'), f2 = bare('garchomp');
      const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
      M.applyIntimidate(m);
      const dropped = m.boosts.at;
      M.battleTurn(S, rng5, P2(m, ally), P2(f1, f2));
      return [dropped, m.boosts.at];
    };
    const c = run(''), t = run('whiteherb');
    return c[0] < 0 && c[1] === c[0] && t[0] < 0 && t[1] === 0;
  });

/* A SOURCE REVERT, BECAUSE THE TAG IS NOT WHAT IS READ. playerAction classifies a weather move from
 * `data/move-effects.js`'s own `fx.weather` -- `setsWeather` is never consulted -- so stripping the
 * tag leaves a working Sandstorm. The known-bad engine is the classifier refusing to recognise one. */
demoSource('ARM  setsWeather -- Sandstorm sets SAND, Sunny Day sets SUN, Howl sets nothing',
  [['  if(fx&&fx.weather&&weatherId(fx.weather))\n    return {kind:\'weather\',mv:id};',
    '  if(false&&fx&&fx.weather&&weatherId(fx.weather))\n    return {kind:\'weather\',mv:id};']],
  (E) => {
    const run = (mv) => {
      const B = stage4(E, ['tyranitar', 'incineroar', 'garchomp', 'garchomp'], (b) => { b.S.field.weather = ''; });
      E.battleTurn(B.S, rng5,
        new Map([[B.me, E.playerAction(B.me, mv, null, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.S.field.weather || 'none';
    };
    return run('howl') === 'none' && run('sandstorm') === 'sand' && run('sunnyday') === 'sun';
  });

demo('ARM  perishClock -- the song kills on turn four and not on turn two',
  shipped, without('move', 'perishsong', 'perishClock'), () => {
    const run = (mv, turns) => {
      const B = stage4(M, ['whimsicott', 'incineroar', 'garchomp', 'garchomp']);
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      for (let t = 0; t < turns; t++) M.battleTurn(B.S, rng5, P2(B.me, B.ally), P2(B.f1, B.f2));
      return !!B.f1.fainted;
    };
    return run('howl', 3) === false && run('perishsong', 1) === false && run('perishsong', 3) === true;
  });

demo('ARM  partialTrap -- Infestation chips on the idle turn and Bug Bite does not',
  shipped, without('move', 'infestation', 'partialTrap'), () => {
    const run = (mv) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp']);
      const full = B.f1.curHP;
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      const afterHit = B.f1.curHP;
      M.battleTurn(B.S, rng5, P2(B.me, B.ally), P2(B.f1, B.f2));
      return { hit: full - afterHit, chip: afterHit - B.f1.curHP };
    };
    const c = run('bugbite'), t = run('infestation');
    return c.hit > 0 && c.chip === 0 && t.hit > 0 && t.chip > 0;
  });

demo('ARM  typeBecomesMoveType -- Protean rewrites the user and no ability does not',
  shipped, without('ability', 'protean', 'typeBecomesMoveType'), () => {
    const run = (ab) => {
      const B = stage4(M, ['meowscarada', 'incineroar', 'garchomp', 'garchomp'], (b) => { b.me.ability = ab; });
      const before = (B.me.types || []).join('/');
      M.battleTurn(B.S, rng5,
        new Map([[B.me, M.playerAction(B.me, 'earthquake', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return [before, (B.me.types || []).join('/')];
    };
    const c = run('none'), t = run('protean');
    return c[1] === c[0] && t[1] === 'Ground';
  });

demo('ARM  crashOnMiss -- High Jump Kick costs the user on a miss and nothing on a hit',
  shipped, without('move', 'highjumpkick', 'crashOnMiss'), () => {
    const run = (roll) => {
      const B = stage4(M, ['incineroar', 'corviknight', 'garchomp', 'garchomp'], (b) => {
        b.f1.st = Object.assign({}, b.f1.st, { hp: b.f1.st.hp * 8 }); b.f1.curHP = b.f1.st.hp;
      });
      const before = B.me.curHP, foe = B.f1.curHP;
      M.battleTurn(B.S, () => roll,
        new Map([[B.me, M.playerAction(B.me, 'highjumpkick', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return { dealt: foe - B.f1.curHP, lost: before - B.me.curHP };
    };
    const c = run(0.5), t = run(0.99);
    return c.dealt > 0 && c.lost === 0 && t.dealt === 0 && t.lost > 0;
  });

/* THE STATUS FAMILY IS DRIVEN BY `statusInflict`, NOT BY THE PER-STATUS TAGS. `inflictsBurn`,
 * `inflictsFreeze`, `inflictsSleep`, `inflictsParalysis` and `inflictsConfusion` are the names the
 * census rows carry and NOTHING in the engine reads any of them -- the secondary site at
 * medicham2:4524 and playerAction's status branch at 5279 both read `statusInflict`. Every one of
 * these five rows stayed green on a strip of its own tag, which is exactly what this file is for.
 * Reported in docs/ENGINE.md rather than papered over: the census row names a tag the engine does
 * not consume, and the mechanic underneath it is real. */
/* A SOURCE REVERT, AND IT CORRECTS WHAT THIS ROW IS A PROBE OF. Ice Beam's freeze is a SECONDARY,
 * and the secondary loop walks `fx.secondary` out of data/move-effects.js -- `statusInflict` supplies
 * only the format's CHANCE, so stripping it leaves the generic 10% and the freeze still lands. The
 * known-bad engine is therefore the secondary loop refusing to run. */
demoSource('ARM  inflictsFreeze -- Ice Beam freezes at a forced roll and Surf does not',
  [['          if(fx&&fx.secondary&&!sheerForce){', '          if(false&&fx&&fx.secondary&&!sheerForce){']],
  (E) => {
    const run = (mv) => {
      const B = stage4(E, ['milotic', 'incineroar', 'corviknight', 'garchomp']);
      E.battleTurn(B.S, () => 0.01,
        new Map([[B.me, E.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.f1.fainted ? 'FAINTED' : (B.f1.status || 'none');
    };
    return run('surf') === 'none' && run('icebeam') === 'frz';
  });

demo('ARM  inflictsConfusion -- Confuse Ray hits the aimed foe only',
  shipped, without('move', 'confuseray', 'statusInflict'), () => {
    const run = (mv) => {
      const B = stage4(M, ['milotic', 'incineroar', 'garchomp', 'garchomp']);
      M.battleTurn(B.S, rng5,
        new Map([[B.me, mv ? M.playerAction(B.me, mv, B.f1, B.S.field) : { kind: 'pass' }], [B.ally, { kind: 'pass' }]]),
        P2(B.f1, B.f2));
      return [!!(B.f1._vol && B.f1._vol.confusion), !!(B.f2._vol && B.f2._vol.confusion)];
    };
    return String(run(null)) === 'false,false' && String(run('confuseray')) === 'true,false';
  });

/* A SOURCE REVERT FOR THE SAME REASON ONE FIELD OVER, AND IT TOOK THREE TRIES TO FIND THE RIGHT
 * KNOWN-BAD ENGINE, WHICH IS THE POINT OF WRITING ONE AT ALL. A major status reaches the target
 * through data/move-effects.js's `fx.status`, never through `inflictsSleep` or `statusInflict` -- so
 * the first two attempts, both tag strips, stayed green. The third attempt disabled the CLASSIFIER
 * at medicham2:5269 and stayed green as well, because playerAction then falls through to the
 * `affect` branch, which reads `statusInflict.effects` and applies the same burn by another door.
 * TWO DOORS TO ONE FACT, and only the APPLICATION site closes both: `const st=(fx&&fx.status)||null`
 * is where the status branch reads what to inflict, and it is the one line the probe watches. */
demoSource('ARM  inflictsSleep -- Spore sleeps and Will-O-Wisp burns, on the same board',
  [['        const st=(fx&&fx.status)||null;', '        const st=null;']],
  (E) => {
    const run = (mv) => {
      const B = stage4(E, ['venusaur', 'incineroar', 'garchomp', 'garchomp']);
      E.battleTurn(B.S, rng5,
        new Map([[B.me, E.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return [B.f1.status || 'none', B.f2.status || 'none'];
    };
    return String(run('willowisp')) === 'brn,none' && String(run('spore')) === 'slp,none';
  });

demoSource('ARM  inflictsBurn -- Will-O-Wisp burns and Spore sleeps, on the same board',
  [['        const st=(fx&&fx.status)||null;', '        const st=(fx&&fx.nostatus)||null;']],
  (E) => {
    const run = (mv) => {
      const B = stage4(E, ['incineroar', 'incineroar', 'garchomp', 'garchomp']);
      E.battleTurn(B.S, rng5,
        new Map([[B.me, mv ? E.playerAction(B.me, mv, B.f1, B.S.field) : { kind: 'pass' }], [B.ally, { kind: 'pass' }]]),
        P2(B.f1, B.f2));
      return B.f1.status || 'none';
    };
    return run(null) === 'none' && run('willowisp') === 'brn' && run('spore') === 'slp';
  });

demo('ARM  proceduralStatus -- Tri Attack rolls a status and Shadow Ball does not',
  shipped, without('move', 'triattack', 'proceduralStatus'), () => {
    const run = (mv) => {
      const B = stage4(M, ['gholdengo', 'incineroar', 'corviknight', 'garchomp']);
      M.battleTurn(B.S, () => 0.01,
        new Map([[B.me, M.playerAction(B.me, mv, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]), P2(B.f1, B.f2));
      return B.f1.status || 'none';
    };
    return run('shadowball') === 'none' && /brn|frz|par/.test(run('triattack'));
  });


/* ---- WIRE 132 — THE MEGA FORME KEY, AND A MEGA THAT THREATENS NOTHING ----------------------------
 *
 * A SOURCE REVERT AND NOT AN ARTIFACT STRIP, and the reason is stated at megaIntoTable(): the
 * into-table is built once and cached, so a __setDB swap after the first call would not be seen. A
 * demonstration that cannot reach its knob is the hollow shape this file rejects, so the known-bad
 * engine is the concatenated guess put back exactly as it was.
 *
 * THIS IS A REVERT THAT STILL WORKS, which is the only kind worth having: the reverted engine builds
 * a perfectly plausible `floette-eternal-mega` with real base stats. Only the ABILITY and the MOVES
 * give it away, and a probe that read the forme name alone would pass on both engines. */
demoSource('WIRE 132 the stone names the forme (the guess reaches the EMPTY twin)',
  /* THE REVERT IS THE ONE LINE THAT ASKS THE ARTIFACT, not the whole call site: megaKeyFor then falls
   * through to its own suffix guess, which is exactly the pre-wire behaviour. Reverting the call site
   * instead would have meant embedding a literal MC.mons[...] index in this file, which
   * tests/test-mc-key.js bans -- correctly, and it caught it. */
  [["  const named=T.fwd[K(item)+'|'+K(baseKey)];", '  const named=null;']],
  (E) => {
    const set = (item) => ({ species: 'Floette-Eternal', item, ability: 'Flower Veil', nature: 'Modest',
                             sp: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
                             moves: ['Moonblast', 'Dazzling Gleam', 'Light of Ruin', 'Protect'] });
    const built = (item) => {
      const me = E.buildMonFromSet(set(item));
      if (!me) return ['NO BODY', '', 0];
      const ally = bare('corviknight'), f1 = bare('garchomp'), f2 = bare('milotic');
      E.battleInit([me, ally], [f1, f2], {});
      return [me.name, me.ability, me.st.sa];
    };
    const none = built(''), stone = built('Floettite');
    /* The CONTROL is the un-megaed body, so "everything is Floette-Mega" cannot pass either. */
    return String(none) === 'floette-eternal,flowerveil,159'
        && stone[0] === 'floette-mega' && stone[1] === 'fairyaura' && stone[2] > none[2];
  });

/* AND THE OTHER HALF: a mega ROW with `mv: []` produces a body that threatens NOTHING. Reverting the
 * inheritance leaves `buildMon('floette-mega')` holding zero moves -- and note that it still returns
 * a complete, plausible Pokemon with the right types, stats and ability, which is exactly why nothing
 * in this project ever noticed. The control is a mega row whose own `mv` is populated, which must be
 * unaffected by the fix in either direction. */
demoSource('WIRE 132 a mega row with mv:[] inherits the base moveset',
  /* NARROWED TO THE ONE FIELD, 2026-08-07. This used to pin the whole `return {...}` line, which is
   * shared with every other property buildMon sets — so ROADMAP #31 adding `_ident` and the mega
   * CAPABILITY to that line broke a reversal that has nothing to do with either, and the file THREW
   * instead of reporting. `moves:megaRowMoves(name,m).slice(),` occurs exactly once in the engine and
   * is the whole of what WIRE 132 changed here. */
  [['moves:megaRowMoves(name,m).slice(),', 'moves:m.mv.slice(),']],
  (E) => {
    const holds = (name) => { const b = E.buildMon(name, {}); return b ? b.moves.length : -1; };
    return holds('floette-mega') === 4 && holds('scizor-mega') > 0;
  });

/* ================= ROADMAP #31 - MEGA EVOLUTION AS A MID-TURN CHOICE ==============================
 *
 * Six probes landed in tests/test-mechanics.js and each gets its own broken engine below. They are
 * deliberately DIFFERENT breakages rather than one switch turned off six times: a single "mega does
 * nothing" revert would red all six and would tell you only that the feature exists, not that each
 * probe watches the thing it names. The one that matters most is the LEFT-SLOT revert - that is the
 * literal historical defect in this project, which passed an at-least-one check for weeks.
 *
 * These are demoSource cases and not `demo` cases because there is no tag to strip: the defect lives
 * in the engine's own control flow. The `megaStone` tag IS consumed here, but stripping it would only
 * fall through to the `/ite(x|y)?$/` name-shape branch that WIRE 111 deliberately kept, so a tag
 * mutation would prove nothing about any of this. */
const MEGA_BODY = (E, key, item) => { const b = E.buildMon(key, {}); b.item = item; return b; };
const MEGA_PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

/* 1. THE BODY IS BASE AT BUILD TIME. The known-bad engine is the ENGINE AS IT SHIPPED UNTIL TODAY:
 *    buildMon ran megaAbility() on a base-forme stone-holder, so a Gengar carrying a Gengarite was
 *    built with Shadow Tag and Gengar's BASE stats - a chimera neither engine models. */
demoSource('ROADMAP #31  a stone-holder is BASE at build (the pre-change engine megaed the ABILITY)',
  [["ability:normAb(_canMega?(_rowAb||''):megaAbility(name,item,_rowAb||'')),",
    "ability:normAb(megaAbility(name,item,_rowAb||'')),"]],
  (E) => {
    const me = MEGA_BODY(E, 'gengar', 'gengarite');
    return me.name === 'gengar' && me.ability === 'cursedbody';
  });

/* 2. THE EVOLUTION ITSELF. Every probe's test arm depends on this, so it is reverted at the single
 *    point that performs it rather than at the caller - a caller revert would also disable the phase
 *    placement, and the next case needs that placement intact to be meaningful. */
demoSource('ROADMAP #31  the evolution resolves inside the turn',
  [['function megaEvolveNow(S,m,auto){\n  if(!m||m.fainted||m.curHP<=0)return false;',
    'function megaEvolveNow(S,m,auto){\n  return false;']],
  (E) => {
    const me = MEGA_BODY(E, 'gengar', 'gengarite');
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    const act = E.playerAction(me, 'shadowball', f1, S.field); act.mega = true;
    E.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), MEGA_PASS2(f1, f2));
    return me.name === 'gengar-mega' && me.ability === 'shadowtag';
  });

/* 3. EITHER SLOT. THIS IS THE HISTORICAL DEFECT, REPRODUCED: the base class could only mega from the
 *    LEFT slot, and the capability passed an at-least-one check at 56% of sides for as long as
 *    nobody asked which slot. The assertion is deliberately two-sided - an engine that megaed only
 *    from the RIGHT slot must fail it too. */
demoSource('ROADMAP #31  mega fires from the RIGHT slot as well as the left',
  [['  if(slot<0)return false;                       // a benched body cannot mega',
    '  if(slot!==0)return false;                     // a benched body cannot mega']],
  (E) => {
    const run = (slot) => {
      const me = MEGA_BODY(E, 'gengar', 'gengarite');
      const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
      const S = E.battleInit(slot === 0 ? [me, ally] : [ally, me], [f1, f2],
                             { seeded: true, autoMega: false });
      const act = E.playerAction(me, 'shadowball', f1, S.field); act.mega = true;
      E.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), MEGA_PASS2(f1, f2));
      return me.name;
    };
    return run(0) === 'gengar-mega' && run(1) === 'gengar-mega';
  });

/* 4. THE NEW SPEED GOVERNS THE TURN. The broken engine still evolves, at the right point, with the
 *    right stats - it simply does not re-sort what is left of the turn afterwards, so the order was
 *    frozen on the PRE-mega Speed. Nothing about the end state gives this away; only who moved does,
 *    which is why the probe reads damage taken by a body whose foe was left on 1 HP. */
demoSource('ROADMAP #31  the turn re-sorts around the new Speed the mega brought',
  [['      const _rest=sortTurnOrder(acts.slice(from),field,rng);\n      for(let _k=0;_k<_rest.length;_k++)acts[from+_k]=_rest[_k];',
    '      void from;']],
  (E) => {
    const me = MEGA_BODY(E, 'gengar', 'gengarite');
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    me.st = Object.assign({}, me.st, { sp: 100 });
    f1.st = Object.assign({}, f1.st, { sp: 110 });
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    f1.curHP = 1;
    const before = me.curHP;
    const act = E.playerAction(me, 'shadowball', f1, S.field); act.mega = true;
    E.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[f1, E.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return me.name === 'gengar-mega' && before - me.curHP === 0;
  });

/* 5. THE ENTRY ABILITY FIRES ON EVOLUTION. The broken engine sets the mega's ability correctly and
 *    never runs its onStart, so Mega Manectric arrives with Intimidate written on it and nothing
 *    dropped - which is exactly the shape WIRE 123 had. */
demoSource('ROADMAP #31  an entry ability on the mega forme fires when it evolves',
  /* ROADMAP #81 WIRE 11 -- the pattern gained the White Herb line that now sits between the entry
   * drops and `sf.megaUsed`. The reversal is the same reversal: it removes the mega's own entry
   * effects and leaves everything else alone, so the herb call is carried across rather than deleted
   * (deleting it would make this demo also a herb demo, and it would then be red for two reasons). */
  [['  applyEntryEffects(m,S.field,own.find(x=>x&&x!==m));\n  applyEntryDrops(m,_live(foes));',
    '  void own; void foes;']],
  (E) => {
    const me = MEGA_BODY(E, 'manectric', 'manectite');
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    const act = E.playerAction(me, 'thunder', f1, S.field); act.mega = true;
    E.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), MEGA_PASS2(f1, f2));
    return me.ability === 'intimidate' && f1.boosts.at === -1 && f2.boosts.at === -1;
  });

/* 6. ONE MEGA PER SIDE PER BATTLE. The broken engine drops only the per-side flag test, so both
 *    stone-holders on one side evolve. The probe's CONTROL - a second evolution on the OTHER side -
 *    must still succeed on both engines, or the probe would be testing "megas are rationed" rather
 *    than "megas are rationed PER SIDE". */
demoSource('ROADMAP #31  the second stone-holder on a side is refused',
  [['  if(sf.megaUsed)return false;\n  const megRow=monRow(key), baseRow=monRow(m.name);',
    '  const megRow=monRow(key), baseRow=monRow(m.name);']],
  (E) => {
    const a0 = MEGA_BODY(E, 'gengar', 'gengarite'), a1 = MEGA_BODY(E, 'mawile', 'mawilite');
    const b0 = MEGA_BODY(E, 'scizor', 'scizorite'), b1 = bare('milotic');
    const S = E.battleInit([a0, a1], [b0, b1], { seeded: true, autoMega: false });
    const t1 = E.playerAction(a0, 'shadowball', b0, S.field); t1.mega = true;
    E.battleTurn(S, rng5, new Map([[a0, t1], [a1, { kind: 'pass' }]]), MEGA_PASS2(b0, b1));
    const t2 = E.playerAction(a1, 'ironhead', b0, S.field); t2.mega = true;
    E.battleTurn(S, rng5, new Map([[a0, { kind: 'pass' }], [a1, t2]]), MEGA_PASS2(b0, b1));
    return a0.name === 'gengar-mega' && a1.name === 'mawile';
  });

/* ================= ROADMAP #81 WIRE 1 - A PROTECT BLOCK IS NOT A TYPE IMMUNITY ====================
 *
 * Three probes landed in tests/test-mechanics.js and each gets its OWN breakage, aimed at the site it
 * names. A single "delete the wire" revert would red all three and would only prove the wire exists.
 *
 * Every case below spends a real turn and reads HP, never a protocol line, because the whole finding
 * is that end-state and protocol disagreed: `tests/test-game-diff.js` agreed on all five scripted
 * games while the trace parted, and a probe that watches only the string would have inherited that.
 *
 * These are demoSource cases: `crashOnMiss` and `punishesContact` are both CONSUMED already, so
 * stripping either tag reds the pre-existing probes as well and proves nothing about the ORDER, which
 * is what this wire changed. */
const WIRE81 = {
  board(E, meSp, foeSp) {
    const me = E.buildMon(meSp, {}), ally = E.buildMon('corviknight', {});
    const f1 = E.buildMon(foeSp, {}), f2 = E.buildMon('garchomp', {});
    for (const b of [me, ally, f1, f2]) { b.item = ''; b.ability = 'none'; }
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.st = Object.assign({}, f1.st, { hp: 9999 }); f1.curHP = 9999;   // the foe cannot faint
    return { me, ally, f1, f2, S };
  },
  /* returns [what the ATTACKER lost, what the FOE lost] */
  click(E, meSp, foeSp, mv, shield, roll) {
    const { me, ally, f1, f2, S } = WIRE81.board(E, meSp, foeSp);
    const a = f1.curHP, b = me.curHP;
    E.battleTurn(S, () => roll,
      new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, shield ? { kind: 'protect', mv: shield } : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [b - me.curHP, a - f1.curHP];
  },
};

/* 1. THE CRASH IS AN onMoveFail. The broken engine keeps the whole reordering and pays the crash ONLY
 *    off the accuracy roll, which is exactly what shipped until today. The control arm - the same
 *    click at the same WINNING roll with the shield down - must connect and cost nothing on BOTH
 *    engines, or this would be watching "High Jump Kick hurts its user" rather than "it hurts its
 *    user when a shield stops it". */
demoSource('ROADMAP #81  a blocked High Jump Kick still pays its crash',
  [['      if(_hadTargets&&!targets.length){m._mvRes=null;_crashOnFail();continue;}',
    '      if(_hadTargets&&!targets.length){m._mvRes=null;continue;}'],
   ['      if(_hadTargets&&!_reached)_crashOnFail();',
    '      if(_hadTargets&&!_reached)void 0;']],
  (E) => {
    const blocked = WIRE81.click(E, 'incineroar', 'garchomp', 'highjumpkick', 'protect', 0.5);
    const open    = WIRE81.click(E, 'incineroar', 'garchomp', 'highjumpkick', null, 0.5);
    return blocked[1] === 0 && blocked[0] > 0 && open[1] > 0 && open[0] === 0;
  });

/* 2. THE SAME RULE ON THE IMMUNITY SIDE, and it needs its own breakage because the site is a
 *    different one - the post-loop test rather than the pre-loop one. High Jump Kick into a GHOST.
 *    The control is the identical click into a body that is NOT immune: it must land and cost
 *    nothing, so "the user lost half its HP" cannot come from a blanket crash. */
demoSource('ROADMAP #81  a High Jump Kick that hits nothing but a type immunity pays its crash',
  [['      if(_hadTargets&&!_reached)_crashOnFail();',
    '      if(_hadTargets&&!_reached)void 0;']],
  (E) => {
    const ghost = WIRE81.click(E, 'incineroar', 'gengar', 'highjumpkick', null, 0.5);
    const open  = WIRE81.click(E, 'incineroar', 'garchomp', 'highjumpkick', null, 0.5);
    return ghost[1] === 0 && ghost[0] > 0 && open[1] > 0 && open[0] === 0;
  });

/* 3. THE SHIELD ANSWERS BEFORE THE TYPE CHART. The broken engine restores the OLD gate order for
 *    exactly this case - a type-immune target falls straight through the shield to the damage loop's
 *    immunity gate - which is what medicham2 did until today and is why Supercell Slam into a
 *    Protecting Garchomp printed a bare `|-immune|`. Read as a TOLL (Spiky Shield's 1/8), not as a
 *    line, and the control is the same immune body with no shield up: it must toll nothing on both
 *    engines. */
demoSource('ROADMAP #81  a Spiky Shield tolls a contact move its holder is immune to',
  [[`          if(!(tg.protect&&!_thruProtect&&!(m.ability==='piercingdrill'&&mv.c==='P'))){_through.push(tg);continue;}`,
    `          if(!(tg.protect&&!_thruProtect&&!(m.ability==='piercingdrill'&&mv.c==='P'))||typeEffAgainst(m,tg,mv,effMoveType(mv,a.move.id,field,m))===0){_through.push(tg);continue;}`]],
  (E) => {
    const shielded = WIRE81.click(E, 'tauros', 'gengar', 'bodyslam', 'spikyshield', 0.5);
    const open     = WIRE81.click(E, 'tauros', 'gengar', 'bodyslam', null, 0.5);
    return shielded[1] === 0 && shielded[0] > 0 && open[1] === 0 && open[0] === 0;
  });

/* 4. THE SHIELD ANSWERS BEFORE THE ACCURACY ROLL. The broken engine puts the roll back in front of
 *    the shield, which is the literal historical defect: a 90%-accuracy move at a losing die printed
 *    `|-miss|` where Showdown prints `|-activate|move: Protect`. Read as the DIFFERENCE in what the
 *    attacker lost, because the crash is paid on both arms and only the shield's 1/8 separates them.
 *    The reversal is written as a hoist rather than a deletion so the broken engine is still a
 *    complete, running engine - it simply asks the two questions in the wrong order. */
demoSource('ROADMAP #81  a shield blocks a move whose accuracy die missed',
  [['      if(targets.length){\n        const _through=[];',
    '      if(_mvAccEARLY(m,a,field,targets,unresolved)){for(const _x of targets)void _x;targets=[];}\n      if(targets.length){\n        const _through=[];'],
   ['const TRACE=(function(){',
    `function _mvAccEARLY(m,a,field,targets,unresolved){
  const _d=(!a.move.spread&&targets.length===1)?targets[0]:null;
  const _a=hitChance(m,_d,a.move.id,field,{targetAlreadyMoved:!!(_d&&!unresolved.has(_d))});
  return _a<100 && 0.99*100>_a;
}
const TRACE=(function(){`]],
  (E) => {
    const shielded = WIRE81.click(E, 'incineroar', 'garchomp', 'highjumpkick', 'spikyshield', 0.99);
    const open     = WIRE81.click(E, 'incineroar', 'garchomp', 'highjumpkick', null, 0.99);
    const eighth = Math.floor(E.buildMon('incineroar', {}).st.hp / 8);
    return open[1] === 0 && shielded[1] === 0 && shielded[0] - open[0] === eighth;
  });

/* ================= ROADMAP #81 WIRE 2 - THE `stall` VOLATILE ======================================
 *
 * TWO INDEPENDENT CLAIMS, TWO BROKEN ENGINES. Both live in the same pre-pass, so a single revert
 * would red both probes and prove only that the block was edited. Each edit below leaves a complete,
 * running engine that simply gets ONE of the two rules wrong -- and each is the literal historical
 * behaviour, not an invented mutation:
 *   1. the counter incremented on every attempt and was never deleted on a failure (shipped until
 *      today, and the reason the old three-turn probe passed on a wrong engine);
 *   2. `willAct()` was not modelled at all, so a shield that held the last action still went up.
 *
 * READ ON HP, never on a `-singleturn` line: the whole observable is whether the NEXT shield holds. */
const WIRE82 = {
  board(E) {
    const me = E.buildMon('incineroar', {}), ally = E.buildMon('incineroar', {});
    const f1 = E.buildMon('garchomp', {}), f2 = E.buildMon('garchomp', {});
    for (const b of [me, ally, f1, f2]) { b.item = ''; b.ability = 'none'; }
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    /* a body that cannot faint: a KO clamps the HP loss and both arms would print the same number */
    for (const b of [me, ally]) { b.st = Object.assign({}, b.st, { hp: b.st.hp * 8 }); b.curHP = b.st.hp; }
    return { me, ally, f1, f2, S };
  },
  /* FOUR consecutive Protects at a fixed 0.2, against a real Earthquake. Returns the HP lost per turn. */
  streak(E) {
    const { me, ally, f1, f2, S } = WIRE82.board(E);
    const out = [];
    for (let t = 0; t < 4; t++) {
      const before = me.curHP;
      E.battleTurn(S, () => 0.2,
        new Map([[me, E.playerAction(me, 'protect', null, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, E.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
      out.push(before - me.curHP);
    }
    return out;
  },
  /* turn 1: four shields, so the foe's Speed alone decides whether `me` holds the last action.
   * turn 2: the same shield at a losing roll behind a real attack. Returns turn 2's HP loss. */
  lastAction(E, foeSpe) {
    const SH = { kind: 'protect', mv: 'protect' };
    const { me, ally, f1, f2, S } = WIRE82.board(E);
    me.st = Object.assign({}, me.st, { sp: 100 });
    ally.st = Object.assign({}, ally.st, { sp: 150 });
    f2.st = Object.assign({}, f2.st, { sp: 150 });
    f1.st = Object.assign({}, f1.st, { sp: foeSpe });
    E.battleTurn(S, rng5, new Map([[me, SH], [ally, SH]]), new Map([[f1, SH], [f2, SH]]));
    const before = me.curHP;
    E.battleTurn(S, () => 0.99,
      new Map([[me, SH], [ally, { kind: 'pass' }]]),
      new Map([[f1, E.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  },
};

demoSource('ROADMAP #81 WIRE 2  a FAILED Protect resets the counter, so the next one is a certainty again',
  [['          it.mon.tookProtectTurns=_ok?Math.min(6,it.mon.tookProtectTurns+1):0;',
    '          it.mon.tookProtectTurns=it.mon.tookProtectTurns+1;']],
  (E) => {
    const d = WIRE82.streak(E);
    /* turns 1-2 blocked and turn 3 taken on BOTH engines -- that is the decay half, which was never
     * wrong. Only turn 4 separates them, and it is the only turn the old probe never spent. */
    return d[0] === 0 && d[1] === 0 && d[2] > 0 && d[3] === 0;
  });

demoSource('ROADMAP #81 WIRE 2  a Protect holding the LAST action of the turn fails and arms nothing',
  [['        if(i+1>=acts.length){it.mon.protect=false;it.mon.tookProtectTurns=0;}   // willAct() === null',
    '        if(false){it.mon.protect=false;it.mon.tookProtectTurns=0;}']],
  (E) => {
    const slowFoe = WIRE82.lastAction(E, 50);    // `me` acts before it: turn-1 shield holds, counter armed
    const fastFoe = WIRE82.lastAction(E, 150);   // `me` acts LAST: turn-1 shield fails, counter untouched
    /* the broken engine returns the SAME number for both, which is the unwired-knob signature. */
    return slowFoe > 0 && fastFoe === 0;
  });

/* ---- ROADMAP #81 WIRE 3, two source-reverted engines --------------------------------------------
 *
 * TWO INDEPENDENT CLAIMS, SO TWO KNOWN-BAD ENGINES. The refusal of a stat drop turned out to be two
 * different bugs wearing one `-fail` divergence, and measuring them apart was the whole first half of
 * the wire: the STATE was wrong for the scoped refusers (a Charm into Inner Focus was blocked here and
 * lands in Showdown) and the PROTOCOL was missing for all of them (a refused drop announced nothing).
 * A single reversal cannot show both, and a single demo would let one half ride on the other. */

/* Claim 1 — SCOPE. The reversal restores the blanket reading: every member of `preventsStatDrop`
 * refuses whatever `blocks` names, from any source. That IS the engine as it stood, and the arms
 * separate on the ability that is scoped to Intimidate. */
demoSource('ROADMAP #81 WIRE 3  Inner Focus refuses INTIMIDATE only — a Charm still drops it',
  [[`  const only=p.onlyFrom||(INTIM_ONLY_BRIDGE.indexOf(ab)>=0?'Intimidate':null);
  if(only&&String(only).toLowerCase().replace(/[^a-z0-9]/g,'')!==_eid)return null;`,
    `  const only=null;
  if(only&&false)return null;`]],
  (E) => {
    const intimidated = () => {
      const me = bare('incineroar'), ally = bare('corviknight');
      const f1 = bare('gallade'), f2 = bare('milotic');
      me.ability = 'intimidate'; f1.ability = 'innerfocus';
      E.battleInit([me, ally], [f1, f2], {});
      return [f1.boosts.at, f2.boosts.at];
    };
    const charmed = () => {
      const me = bare('milotic'), ally = bare('corviknight');
      const f1 = bare('gallade'), f2 = bare('milotic');
      f1.ability = 'innerfocus';
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'charm', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return f1.boosts.at;
    };
    /* The no-ability partner MUST take the Intimidate in both engines, or "Inner Focus refused it"
     * would be satisfied by an engine in which Intimidate stopped firing at all. */
    return intimidated()[0] === 0 && intimidated()[1] === -1 && charmed() === -2;
  });

/* Claim 2 — THE ANNOUNCEMENT. The reversal silences the one emit and changes no state at all, which
 * is why it needs its own demonstration: the reverted engine's stat stages are IDENTICAL to the
 * shipped engine's, and only the protocol stream parts. */
demoSource('ROADMAP #81 WIRE 3  a refused stat drop is ANNOUNCED, and the state alone cannot see it',
  [['  if(TR&&r.announce)TR.failUnboost(target,r.label,r.ab);\n  return true;',
    '  if(false)TR.failUnboost(target,r.label,r.ab);\n  return true;']],
  (E) => {
    const run = (ab1, ab2) => {
      const me = bare('incineroar'), ally = bare('corviknight');
      const f1 = bare('metagross'), f2 = bare('gallade');
      me.ability = 'intimidate'; f1.ability = ab1; f2.ability = ab2;
      const trace = [];
      E.battleInit([me, ally], [f1, f2], { trace });
      return { lines: trace.filter(l => /^\|-(fail|unboost)\|/.test(l)).map(E.traceCanon),
               stages: [f1.boosts.at, f2.boosts.at] };
    };
    const ctl = run('none', 'none'), tst = run('clearbody', 'innerfocus');
    /* the STATE arm is asserted too, and it holds on BOTH engines — that is the point: this claim is
     * invisible to a probe that reads stat stages, which is how the family survived WIRE 1 and 2. */
    return ctl.stages.join() === '-1,-1' && tst.stages.join() === '0,0'
      && ctl.lines.length === 2 && ctl.lines.every(l => /^\|-unboost\|/.test(l))
      && tst.lines[0] === '|-fail|p2a:metagross|unboost|[from]ability:clearbody|[of]p2a:metagross'
      && tst.lines[1] === '|-fail|p2b:gallade|unboost|attack|[from]ability:innerfocus|[of]p2b:gallade';
  });

/* ROADMAP #81 WIRE 4 -- SHOWDOWN'S FIXED-POINT ARITHMETIC. Two claims, two reverts, because they are
 * two DIFFERENT multipliers reached down two different paths and one demonstration would let either
 * ride on the other. Each revert restores exactly the line that stood there before the wire.
 *
 * BOTH ASSERT THE CONTROL ARM TOO, AND IT IS EQUAL ON BOTH ENGINES BY CONSTRUCTION. That is what
 * makes an off-by-one legible: a demonstration that watched only the second number would also flip
 * on an engine that had simply stopped applying the modifier altogether. */
demoSource('ROADMAP #81 WIRE 4  a spread move takes x0.75 rounded half up on 4096ths, not a truncation',
  [['  if(spread)base=md4096(base,0.75);', '  if(spread)base=Math.floor(base*0.75);']],
  (E) => {
    const run = (mv) => {
      const B = (s) => { const b = E.buildMon(s, {}); b.item = ''; b.ability = 'none'; return b; };
      const me = B('garchomp'), ally = B('milotic'), f1 = B('kingambit'), f2 = B('incineroar');
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    /* The authority, same bodies, same rolls: Flamethrower 58-70 single, Heat Wave 46-56 spread. */
    return run('flamethrower') === 64 && run('heatwave') === 51;
  });

demoSource('ROADMAP #81 WIRE 4  Life Orb is chainModify([5324,4096]), not Math.floor(d * 1.3)',
  [['    const _ch=lo>1?ch4096(mod,lo):mod;\n    return mdChain(d,_ch);',
    '    if(mod!==CH_ONE)d=Math.floor(d*mod/4096);\n    if(lo>1)d=Math.floor(d*lo);\n    return d;']],
  (E) => {
    const run = (item) => {
      const B = (s) => { const b = E.buildMon(s, {}); b.item = ''; b.ability = 'none'; return b; };
      const me = B('incineroar'), ally = B('corviknight'), f1 = B('garchomp'), f2 = B('garchomp');
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      me.item = item;
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return before - f1.curHP;
    };
    /* The authority, same bodies, same rolls: 73-86 bare, 95-112 holding a Life Orb. */
    return run('') === 80 && run('lifeorb') === 104;
  });

/* ROADMAP #81 WIRE 4, THE THIRD CLAIM — RECOIL. Same root as the two above (an integer rule written
 * as float arithmetic) reached down a completely different path: this one is not `modify` at all,
 * it is `clampIntRange(Math.round(dealt * rc[0] / rc[1]), 1)` in `applyRecoilDamage`. The revert
 * restores the pre-wire line exactly, floor and pre-divided float together, because those were one
 * expression and separating them would demonstrate half a bug. */
demoSource('ROADMAP #81 WIRE 4  recoil is Math.round of the damage dealt, not a floor of a float ratio',
  [['      const _rc=a.move.mv&&a.move.mv.rc;\n      const _rcMul=(_nr&&_nr.recoil!=null)?+_nr.recoil:1;\n      const _rcDmg=(_rc&&_rcMul)?Math.max(1,Math.round(dealt*_rc[0]*_rcMul/_rc[1])):0;\n      if(_rcF&&dealt>0){m.curHP-=_rcDmg;',
    '      if(_rcF&&dealt>0){m.curHP-=Math.floor(dealt*_rcF);']],
  (E) => {
    const run = (mv) => {
      const B = (s) => { const b = E.buildMon(s, {}); b.item = ''; b.ability = 'none'; return b; };
      const me = B('staraptor'), ally = B('incineroar'), f1 = B('garchomp'), f2 = B('garchomp');
      const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
      f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
      const m0 = me.curHP, f0 = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      return { lost: m0 - me.curHP, dealt: f0 - f1.curHP };
    };
    /* Brave Bird 33/100 and Flare Blitz 33/100 both land on values where round and floor differ;
     * Wave Crash lands on one where they agree, and it must read the SAME on both engines. */
    const bb = run('bravebird'), fb = run('flareblitz'), wc = run('wavecrash');
    const rd = (d, mv) => Math.round(d * MC.moves[mv].rc[0] / MC.moves[mv].rc[1]);
    const fl = (d, mv) => Math.floor(d * (MC.moves[mv].rc[0] / MC.moves[mv].rc[1]));
    return bb.lost === rd(bb.dealt, 'bravebird') && rd(bb.dealt, 'bravebird') !== fl(bb.dealt, 'bravebird')
        && fb.lost === rd(fb.dealt, 'flareblitz') && rd(fb.dealt, 'flareblitz') !== fl(fb.dealt, 'flareblitz')
        && wc.lost === rd(wc.dealt, 'wavecrash');
  });


/* ================= ROADMAP #81 WIRE 6 - AN ACTION THAT DID NOT SAY WHAT IT WAS ====================
 *
 * Three breakages, three sites, because the defect had three of them and a single revert would only
 * prove that one line exists. The probes in tests/test-mechanics.js assert the EMITTED STREAM, so
 * every case below reads protocol lines - which is exactly what WIRE 1's cases were forbidden from
 * doing, and for the opposite reason: there the finding was that state and stream disagreed, here the
 * finding IS the stream. The state is provably fine (`reversesSpeed` has been green for weeks).
 *
 * EVERY CASE CARRIES A CONTROL THAT MUST HOLD ON BOTH ENGINES - an ordinary attack announcing itself,
 * and a passed turn announcing nothing. Without them these would be watching "the trace emits |move|
 * at all" rather than "it emits one for THIS action kind". */
const W6 = {
  /* every |move| line the acting body emitted in one real turn; `mv` null = it passed */
  lines(E, mv) {
    const B = (s) => { const b = E.buildMon(s, {}); b.item = ''; b.ability = 'none'; return b; };
    const me = B('incineroar'), ally = B('corviknight'), f1 = B('garchomp'), f2 = B('milotic');
    const S = E.battleInit([me, ally, B('clefable')], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    for (const b of [f1, me]) { b.st = Object.assign({}, b.st, { hp: b.st.hp * 8 }); b.curHP = b.st.hp; }
    E.battleTurn(S, rng5,
      new Map([[me, mv ? E.playerAction(me, mv, f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return trace.filter(l => l.startsWith('|move|p1a:'));
  },
  says(E, mv) { const l = W6.lines(E, mv); return l.length === 1 && l[0].split('|')[3] === mv; },
  /* the two controls, asserted inside every case */
  controls(E) { return W6.says(E, 'earthquake') && W6.lines(E, null).length === 0; },
};

/* 1. THE KIND THE MAP DID NOT HAVE. `playerAction` returned a bare `{kind:'trickroom'}` and
 *    `actionMoveId` fell back to KIND_MOVE, whose three hand-written rows do not include it - so the
 *    single most-used cause in the differential's largest family emitted nothing at all. */
demoSource('ROADMAP #81 WIRE 6  Trick Room announces the move that set it',
  [["  if(id==='trickroom')return {kind:'trickroom',mv:id};", "  if(id==='trickroom')return {kind:'trickroom'};"]],
  (E) => W6.controls(E) && W6.says(E, 'trickroom'));

/* 2. THE 46 MOVES THE ENGINE MODELS NOTHING FOR. `{kind:'pass'}` meant BOTH "no effect modelled" and
 *    "I forget which move it was", and the second half is what made the stream lose the line. Quick
 *    Guard is 803 corpus uses; the reverted engine is silent on all of them. */
demoSource('ROADMAP #81 WIRE 6  a move the engine models NOTHING for still announces itself',
  [['  return {kind:\'pass\',mv:id};', '  return {kind:\'pass\'};']],
  (E) => W6.controls(E) && W6.says(E, 'quickguard') && W6.says(E, 'psychup'));

/* 3. THE GATE, WHICH IS A SEPARATE SITE AND WOULD HAVE SUPPRESSED CASE 2 ON ITS OWN. The emit
 *    condition read `_mid && a.kind!=='pass'`; restoring the kind test leaves playerAction stamping
 *    the id correctly and the line still never reaches the stream. Trick Room must keep announcing on
 *    BOTH engines here - that is what makes this case about the gate rather than about the id. */
demoSource('ROADMAP #81 WIRE 6  the announcement is gated on THE MOVE, not on the kind being liked',
  [['        if(TR&&_mid){', "        if(TR&&_mid&&a.kind!=='pass'){"]],
  (E) => W6.controls(E) && W6.says(E, 'trickroom') && W6.says(E, 'quickguard'));

/* ================= ROADMAP #81 WIRE 7 — SEVEN TARGETS, EIGHT REVERTS ==============================
 *
 * A BATCH, so every claim gets its own known-bad engine and its own flip. Two of the eight are STREAM
 * claims and the rest read HP, the item slot or the doll's size; that split is stated in each case
 * rather than left to be inferred, because WIRE 1's cases were forbidden from reading the stream and
 * WIRE 6's were required to — the instrument follows the defect, not a house style.
 *
 * EVERY CASE CLEARS ITS CONTROL ON BOTH ENGINES. A revert that also breaks the control would produce
 * a green/red flip for the wrong reason, which is the hollow shape one level up. */
const W7 = {
  bare(E, s) { const b = E.buildMon(s, {}); if (!b) throw new Error('no MC row for ' + s); b.item = ''; b.ability = 'none'; return b; },
  board(E, a, b, c, d) {
    const me = W7.bare(E, a), ally = W7.bare(E, b), f1 = W7.bare(E, c), f2 = W7.bare(E, d);
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    return { me, ally, f1, f2, S };
  },
  pass2: (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]),
  big(m) { m.st = Object.assign({}, m.st, { hp: m.st.hp * 8 }); m.curHP = m.st.hp; },
  /* the entry stream a Hospitality body writes, with the partner at a chosen fraction of its HP */
  entry(E, ab, frac) {
    const me = W7.bare(E, 'incineroar'), ally = W7.bare(E, 'corviknight'), bench = W7.bare(E, 'sinistcha');
    const f1 = W7.bare(E, 'garchomp'), f2 = W7.bare(E, 'garchomp');
    bench.ability = ab; ally.curHP = Math.max(1, Math.round(ally.st.hp * frac));
    const S = E.battleInit([me, ally, bench], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    E.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    return { lines: trace.filter(l => /^\|-(heal|ability)\|/.test(l)), hp: ally.curHP, max: ally.st.hp };
  },
  /* one Knock Off from a full-HP body; returns what the target has left and what it is holding */
  knock(E, target, item) {
    const { me, ally, f1, f2, S } = W7.board(E, 'incineroar', 'corviknight', target, 'garchomp');
    f1.item = item; f1.curHP = f1.st.hp;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
    return { hp: f1.curHP, dead: !!f1.fainted, item: f1.item };
  },
};

/* 1. THE FULL-HP GATE. `Battle.heal()` returns false before it announces when the target is already
 *    at max, so a Sinistcha beside an untouched partner writes nothing. STREAM CLAIM, and the case
 *    asserts the partner's HP did not move on EITHER engine — the defect has no state in it, which is
 *    exactly what the roadmap asked to be established rather than assumed. */
demoSource('ROADMAP #81 WIRE 7  Hospitality at a full-HP partner announces nothing',
  [['&&ally.curHP>0&&ally.st&&ally.curHP<ally.st.hp){', '&&ally.curHP>0&&ally.st){']],
  (E) => { const hurt = W7.entry(E, 'hospitality', 1 / 3), full = W7.entry(E, 'hospitality', 1);
           return hurt.lines.length === 1 && full.hp === full.max && full.lines.length === 0; });

/* 2. AND IT NEVER WRITES AN `|-ability|`. Hospitality's handler is a bare heal loop with no
 *    `this.add('-ability', ...)` in it, unlike Intimidate two lines away. Separate revert, because
 *    this one is wrong even on the entries where the heal itself is correct — the control here is the
 *    DAMAGED partner, which must still write exactly one line and it must be the heal. */
demoSource('ROADMAP #81 WIRE 7  Hospitality writes a -heal and never an -ability',
  [["    if(TR)TR.heal(ally,'[from] ability: '+m.ability,m);",
    "    if(TR){TR.ab(m,m.ability);TR.heal(ally,'[from] ability: '+m.ability,m);}"]],
  (E) => { const hurt = W7.entry(E, 'hospitality', 1 / 3);
           return hurt.lines.length === 1 && /^\|-heal\|/.test(hurt.lines[0]); });

/* 3. KNOCK OFF STRIPS AFTER THE DAMAGE — ROADMAP #80's open half, ASSERTED AS A LIFE. The revert puts
 *    the two damage lines back above the strip, which is where they were. A full-HP Focus Sash holder
 *    taking a lethal Knock Off survives at 1 in the authority and DIES on the reverted engine, because
 *    the Sash it needed was taken first. The control is the same click with no item: it must faint on
 *    both engines, or "survived" is measuring a weak attack. */
demoSource('ROADMAP #81 WIRE 7  Knock Off cannot take the Sash that just saved the target',
  /* THE REVERT PUTS THE WHOLE BLOCK BACK WHERE IT WAS, not just the two damage lines — the first cut
   * of this case moved the `-damage` below the strip and DID NOT FLIP, because the Focus Sash block
   * sits above both and still fired. That is the probe catching the demonstration, one level up from
   * where it usually catches the engine: a reversal that leaves the defect unreachable proves nothing.
   * The old site is above the resist berry, which is above the Sash. */
  [["        {\n          const _ri=TAGS.param('move',a.move.id,'removesItem');\n          if(_ri&&tg.item&&!itemRefusesTake(tg)){\n            const _taken=tg.item; tg.item='';\n            if(TR)TR.enditem(tg,_taken,'[from] move: '+a.move.id,m);\n            if(_ri.steals&&!m.item){m.item=_taken;if(TR)TR.item(m,_taken,'[from] move: '+a.move.id);}\n          }\n        }\n", ''],
   ["        const _rbHit=TAGS.param('item',tg.item,'resistBerry');",
    "        {\n          const _ri=TAGS.param('move',a.move.id,'removesItem');\n          if(_ri&&tg.item&&!tg.fainted){\n            const _taken=tg.item; tg.item='';\n            if(TR)TR.enditem(tg,_taken,'[from] move: '+a.move.id,m);\n            if(_ri.steals&&!m.item){m.item=_taken;if(TR)TR.item(m,_taken,'[from] move: '+a.move.id);}\n          }\n        }\n        const _rbHit=TAGS.param('item',tg.item,'resistBerry');"]],
  (E) => { const none = W7.knock(E, 'gengar', ''), sash = W7.knock(E, 'gengar', 'focussash');
           return none.dead && !sash.dead && sash.hp === 1; });

/* 4. AND IT CANNOT TAKE A MEGA STONE. The control is the SAME stone on a body it does not belong to,
 *    which must still be knocked off on both engines — a refusal keyed on "is this a mega stone"
 *    rather than on "is it THIS body's" would pass the test arm and fail the control, and that
 *    over-match is what `itemRefusesTake` was measured against 47,064 (item x body) pairs to avoid. */
demoSource('ROADMAP #81 WIRE 7  a mega stone cannot be knocked off the body it belongs to',
  [['if(_ri&&tg.item&&!itemRefusesTake(tg)){', 'if(_ri&&tg.item){']],
  (E) => { const owner = W7.knock(E, 'gengar', 'gengarite'), other = W7.knock(E, 'garchomp', 'gengarite');
           return other.item === '' && owner.item === 'gengarite'; });

/* 5. THE PINCH BERRY IS AN `onUpdate`. The revert removes both Update passes, which puts the berry
 *    back where this engine had it — the residual. STATE CLAIM, and the state is a life: two Scalds
 *    that together exceed a Corviknight's HP but not its HP plus a quarter. */
demoSource('ROADMAP #81 WIRE 7  the Sitrus is eaten between the two attackers, not at the residual',
  [['      _updateAll();\n      const it=acts[actIdx];', '      const it=acts[actIdx];'],
   ['    _updateAll();   // ROADMAP #81 WIRE 7 -- after the LAST action',
    '    if(0)_updateAll();   // reverted -- after the LAST action']],
  (E) => {
    const run = (item) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'milotic', 'milotic', 'corviknight', 'garchomp');
      f1.item = item; f1.curHP = Math.round(f1.st.hp * 0.81);
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'scald', f1, S.field)], [ally, E.playerAction(ally, 'scald', f1, S.field)]]),
        W7.pass2(f1, f2));
      return { dead: !!f1.fainted, item: f1.item };
    };
    const none = run(''), berry = run('sitrusberry');
    return none.dead && !berry.dead && berry.item === '';
  });

/* 6. THE DOLL IS CEIL AND THE COST IS NOT. One rule for both members of the `substitute` tag; the
 *    control is the COST, which must stay floor on both engines — a revert that moved both would
 *    otherwise read as a fix. */
demoSource('ROADMAP #81 WIRE 7  the substitute doll is a rounded-UP quarter',
  [['m._sub=Math.max(1,Math.ceil(m.st.hp*(+_sb.buffer||0.25)));',
    'm._sub=Math.max(1,Math.floor(m.st.hp*(+_sb.buffer||0.25)));']],
  (E) => {
    const { me, ally, f1, f2, S } = W7.board(E, 'garchomp', 'incineroar', 'garchomp', 'garchomp');
    const hp0 = me.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'substitute', f1, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
    return me._sub === Math.ceil(me.st.hp / 4) && (hp0 - me.curHP) === Math.floor(me.st.hp / 4)
        && Math.ceil(me.st.hp / 4) !== Math.floor(me.st.hp / 4);
  });

/* 7. AND IT IS RAISED BEFORE THE HP IS PAID. `moveHit` adds `volatileStatus` and only then calls
 *    `onHit`, where the `directDamage` lives. STREAM CLAIM — the doll and the HP are identical either
 *    way, and only the two lines' order moves. The control is that BOTH lines are present on both
 *    engines, so a revert that lost one would not read as a pass. */
demoSource('ROADMAP #81 WIRE 7  the Substitute -start precedes the -damage that pays for it',
  [['grantSubstitute(m,a.mv||a.move.id);\n          m.curHP-=Math.floor(m.st.hp*+_cu.costsFraction);\n          if(TR)TR.dmg(m);\n          if(m.curHP<=0){m.curHP=0;m.fainted=true;m._sub=0;if(TR)TR.faint(m);continue;}',
    'm.curHP-=Math.floor(m.st.hp*+_cu.costsFraction);\n          if(TR)TR.dmg(m);\n          if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);continue;}\n          grantSubstitute(m,a.mv||a.move.id);']],
  (E) => {
    const { me, ally, f1, f2, S } = W7.board(E, 'garchomp', 'incineroar', 'garchomp', 'garchomp');
    const trace = []; S._trace = trace;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'substitute', f1, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
    const ls = trace.filter(l => /^\|(-start|-damage)\|p1a:/.test(l));
    return ls.length === 2 && /^\|-start\|/.test(ls[0]) && /^\|-damage\|/.test(ls[1]);
  });

/* 8. PROTEAN CONVERTS BEFORE THE HIT. The revert puts the block back where WIRE 54 left it — below
 *    every branch of the resolved move — which is a real engine that existed until tonight, not a
 *    deletion. The control is the SAME body with no ability, which must deal the same 123 on both. */
demoSource('ROADMAP #81 WIRE 7  Protean gives the move it converts into its STAB',
  [['      if(_hadTargets){\n        const _tb=', '      if(false){\n        const _tb='],
   ["      /* WIRE 54's PROTEAN BLOCK USED TO SIT HERE, below every branch of the resolved move, and\n         ROADMAP #81 WIRE 7 moved it up to the PrepareHit position -- see the block just under\n         `_hadTargets`. The old comment called the placement \"the wrong order by a hair\"; it was worth\n         the whole of the ability's offensive half. */\n    }",
    "      {\n        const _tbOld=TAGS.param('ability',m.ability,'typeBecomesMoveType');\n        if(_tbOld&&!m.fainted&&!(_tbOld.oncePerSwitchIn&&m._proteanUsed)){\n          const _ntOld=effMoveType(a.move.mv,a.move.id,field,m);\n          if(_ntOld&&!(m.types.length===1&&m.types[0]===_ntOld)){m.types=[_ntOld];m._proteanUsed=true;\n            if(TR)TR.vstart(m,'typechange',_ntOld+'|[from] ability: '+m.ability);}\n        }\n      }\n    }"]],
  (E) => {
    const run = (ab) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'meowscarada', 'incineroar', 'ceruledge', 'garchomp');
      me.ability = ab; W7.big(f1);
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
      return before - f1.curHP;
    };
    const control = run('none'), test = run('protean');
    return control > 0 && test > control * 1.4;
  });

/* 9. A REDIRECT ANNOUNCES NOTHING AND AN ABILITY REDIRECT ANNOUNCES AN `-activate`. Two reverts in one
 *    case because the engine had them SWAPPED: silence where Showdown writes a line, and a line where
 *    it writes silence. STREAM CLAIM — the redirect itself has been live since WIRE 25 and the draw is
 *    right in both engines, which is why the case reads announcement lines and not damage. */
demoSource('ROADMAP #81 WIRE 7  Follow Me announces nothing when it draws, Lightning Rod announces an -activate',
  [['if(TR)TR.retarget(drawer);}', "if(TR){TR.act(drawer,'move: '+drawer._redirect);TR.retarget(drawer);}}"],
   ["TR.act(_rod,'ability: '+_rod.ability)", 'TR.ab(_rod,_rod.ability)']],
  (E) => {
    const run = (ab, mv) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'raichu', 'incineroar', 'corviknight', 'milotic');
      if (ab) f2.ability = ab;
      W7.big(f1); W7.big(f2);
      const trace = []; S._trace = trace;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'thunderbolt', f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, mv ? E.playerAction(f2, mv, f2, S.field) : { kind: 'pass' }]]));
      return trace.filter(l => /^\|-(activate|ability)\|/.test(l));
    };
    const plain = run(null, null), drawn = run(null, 'followme'), rod = run('lightningrod', null);
    return plain.length === 0 && drawn.length === 0
        && rod.length === 1 && /^\|-activate\|/.test(rod[0]) && /lightningrod/.test(rod[0]);
  });

/* ---- ROADMAP #81 WIRE 8 -------------------------------------------------------------------------
 *
 * Two families, five demonstrations. Every reverted arm below is an engine that ACTUALLY EXISTED
 * this morning, except demo 3, which is stated as what it is: the plausible WRONG fix. A duplicate
 * check written per damage CATEGORY instead of per condition passes demos 1 and 2 and breaks Aurora
 * Veil, so the over-match needs its own known-bad input rather than an argument. */

/* THE CHARGE-TURN REVERT, shared by demos 4 and 5: the wind-up's announcement and its stat boost put
 * back INSIDE the "we are charging" branch, below the weather test, exactly where they sat until
 * tonight. Two edits because the block was reordered as well as moved. */
const W8_CHARGE = [
  ['          /* `|-prepare|ATTACKER|MOVE` -- sim/SIM-PROTOCOL.md:594, and it is unconditional. */\n          if(TR)TR.prep(m,a.move.id);\n', ''],
  ["          const _cp=TAGS.param('move',a.move.id,'chargeTurn'), _b=_cp&&_cp.boosts;\n"
 + '          if(_b)for(const _k of Object.keys(_b)){\n'
 + "            const _kk={spa:'sa',spd:'sd',atk:'at',def:'df',spe:'sp'}[_k]||_k;\n"
 + '            if(m.boosts&&_kk in m.boosts){const _b0=m.boosts[_kk];\n'
 + '              m.boosts[_kk]=Math.max(-6,Math.min(6,m.boosts[_kk]+_b[_k]));\n'
 + '              if(TR)TR.bst(m,_kk,m.boosts[_kk]-_b0);}\n'
 + '          }\n'
 + "          const _sk=TAGS.param('move',a.move.id,'chargeSkippedByWeather');\n"
 + "          const _herb=m.item==='powerherb';\n"
 + '          if(!(_sk&&_sk.skipsIn&&!field.wSup&&field.weather===_sk.skipsIn)&&!_herb){\n'
 + '            m._charging=a.move.id;\n'
 + "            m._invuln=TAGS.has('move',a.move.id,'semiInvulnerable');\n"
 + '            m._lastMove=a.move.id;\n'
 + '            continue;                                           // the turn is spent\n'
 + '          }',
    "          const _sk=TAGS.param('move',a.move.id,'chargeSkippedByWeather');\n"
 + "          const _herb=m.item==='powerherb';\n"
 + '          if(!(_sk&&_sk.skipsIn&&!field.wSup&&field.weather===_sk.skipsIn)&&!_herb){\n'
 + '            m._charging=a.move.id;\n'
 + "            m._invuln=TAGS.has('move',a.move.id,'semiInvulnerable');\n"
 + "            const _cp=TAGS.param('move',a.move.id,'chargeTurn'), _b=_cp&&_cp.boosts;\n"
 + '            if(_b)for(const _k of Object.keys(_b)){\n'
 + "              const _kk={spa:'sa',spd:'sd',atk:'at',def:'df',spe:'sp'}[_k]||_k;\n"
 + '              if(m.boosts&&_kk in m.boosts){const _b0=m.boosts[_kk];\n'
 + '                m.boosts[_kk]=Math.max(-6,Math.min(6,m.boosts[_kk]+_b[_k]));\n'
 + '                if(TR)TR.bst(m,_kk,m.boosts[_kk]-_b0);}\n'
 + '            }\n'
 + '            if(TR)TR.prep(m,a.move.id);\n'
 + '            m._lastMove=a.move.id;\n'
 + '            continue;                                           // the turn is spent\n'
 + '          }'],
];

/* the screen click's duplicate gate, as landed */
const W8_SCREEN_GATE = "        if(sf&&sf.sc&&sf.sc[a.mv]>0){m._lastMove=a.mv;mvFail(m);continue;}\n";

/* 1. A SECOND TAILWIND DOES NOT REFRESH THE FIRST. STATE claim, read off the SPEED four turns later
 *    — never off the `|-fail|`. The control inside the assertion is the same turn-2 click ALONE,
 *    which must still be fast at turn 5: without it, "the two arms agree" is also what an engine
 *    that never set a Tailwind at all would print. */
demoSource('ROADMAP #81 WIRE 8  a second Tailwind does not extend the first',
  [["      if(a.kind==='tail'){\n        if((it.side==='A'?field.twA:field.twB)>0){mvFail(m);continue;}\n        if(it.side==='A')field.twA=4;else field.twB=4;if(TR)TR.sstart(m,'Tailwind');continue;}",
    "      if(a.kind==='tail'){if(it.side==='A')field.twA=4;else field.twB=4;if(TR)TR.sstart(m,'Tailwind');continue;}"]],
  (E) => {
    const run = (clickOn) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'whimsicott', 'incineroar', 'garchomp', 'garchomp');
      const base = E.effSpeed(ally, S.field, 'A');
      for (let t = 1; t <= 4; t++) {
        E.battleTurn(S, rng5,
          new Map([[me, clickOn.includes(t) ? E.playerAction(me, 'tailwind', null, S.field) : { kind: 'pass' }],
                   [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
      }
      return +(E.effSpeed(ally, S.field, 'A') / base).toFixed(2);
    };
    const once = run([1]), dup = run([1, 2]), lateOnly = run([2]);
    return once === 1 && dup === once && lateOnly > 1.8;
  });

/* 2. A SECOND REFLECT DOES NOT EXTEND THE FIRST. STATE claim, read off the DAMAGE on turn 6 — a
 *    refreshed screen is a damage bug for the rest of the game and that is the thing to measure. */
demoSource('ROADMAP #81 WIRE 8  a second Reflect does not extend the first',
  [[W8_SCREEN_GATE, '']],
  (E) => {
    const run = (clickOn) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'incineroar', 'corviknight', 'garchomp', 'garchomp');
      let took = 0;
      for (let t = 1; t <= 6; t++) {
        me.curHP = me.st.hp; const before = me.curHP;
        E.battleTurn(S, rng5,
          new Map([[me, clickOn.includes(t) ? E.playerAction(me, 'reflect', null, S.field) : { kind: 'pass' }],
                   [ally, { kind: 'pass' }]]),
          new Map([[f1, E.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
        took = before - me.curHP;
      }
      return took;
    };
    const once = run([1]), dup = run([1, 2]), lateOnly = run([2]);
    return once > 0 && dup === once && lateOnly < once;
  });

/* 3. THE REFUSAL IS PER CONDITION, NOT PER CATEGORY. The known-bad engine is the OBVIOUS WRONG FIX
 *    rather than a historical build, and it is named as such: refusing any screen while any screen
 *    covering that category is up passes demos 1 and 2 and stops an Aurora Veil ever going up beside
 *    a Reflect. Showdown keeps three independent conditions (sim/side.ts:419), so the claim has the
 *    OPPOSITE sign — the second, different screen must LAND. */
demoSource('ROADMAP #81 WIRE 8  Aurora Veil still goes up on a side that already has Reflect',
  [[W8_SCREEN_GATE,
    "        if(sf&&(screenUp(sf,'Physical')||screenUp(sf,'Special'))){m._lastMove=a.mv;if(TR)TR.fail(m);continue;}\n"]],
  (E) => {
    const run = (veil) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'incineroar', 'corviknight', 'garchomp', 'garchomp');
      S.field.weather = 'snow';
      let special = 0, physical = 0;
      for (let t = 1; t <= 3; t++) {
        me.curHP = me.st.hp; const before = me.curHP;
        const click = t === 1 ? 'reflect' : (t === 2 && veil ? 'auroraveil' : null);
        E.battleTurn(S, rng5,
          new Map([[me, click ? E.playerAction(me, click, null, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
          new Map([[f1, E.playerAction(f1, t === 3 ? 'earthpower' : 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
        if (t === 3) special = before - me.curHP; else physical = before - me.curHP;
      }
      return { special, physical };
    };
    const control = run(false), test = run(true);
    return control.special > 0 && test.special < control.special
        && control.physical > 0 && test.physical === control.physical;
  });

/* 4. AN EXPIRING AURORA VEIL ANNOUNCES AN AURORA VEIL. STREAM claim, and it is one because the state
 *    is identical either way — the screen falls on the same turn in both builds, only its NAME moves.
 *    The revert is the two-counter engine's own emission: a physical counter reaching zero wrote
 *    `Reflect` and a special one wrote `Light Screen`, so a lapsing Veil wrote BOTH and never itself.
 *    The control is that the reverted arm emits TWO lines rather than none, so a revert that simply
 *    lost the announcement would not read as a pass. */
demoSource('ROADMAP #81 WIRE 8  an expiring Aurora Veil announces an Aurora Veil, once',
  [['      for(const _id of screenIds(sf)){\n        if(--sf.sc[_id]<=0){delete sf.sc[_id]; if(TR)TR.sendSide(sf.side===\'A\'?\'p1\':\'p2\',_id);}\n      }}}',
    '      for(const _id of screenIds(sf)){\n        const _c=screenCat(_id);\n'
  + '        if(--sf.sc[_id]<=0){delete sf.sc[_id]; if(TR){\n'
  + "          if(_c==='Physical'||_c==='both')TR.sendSide(sf.side==='A'?'p1':'p2','Reflect');\n"
  + "          if(_c==='Special'||_c==='both')TR.sendSide(sf.side==='A'?'p1':'p2','Light Screen');}}\n"
  + '      }}}']],
  (E) => {
    const { me, ally, f1, f2, S } = W7.board(E, 'incineroar', 'corviknight', 'garchomp', 'garchomp');
    S.field.weather = 'snow';
    const trace = []; S._trace = trace;
    for (let t = 1; t <= 6; t++) {
      E.battleTurn(S, rng5,
        new Map([[me, t === 1 ? E.playerAction(me, 'auroraveil', null, S.field) : { kind: 'pass' }],
                 [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
    }
    const ends = trace.filter(l => /^\|-sideend\|/.test(String(l)));
    return ends.length === 1 && /auroraveil/i.test(String(ends[0]));
  });

/* 5. THE WIND-UP HAPPENS EVEN WHEN THE TURN IS NOT SPENT. STATE claim, and the expensive half of the
 *    family: data/moves.ts:4640 boosts Special Attack ABOVE the rain test, so a rain Electro Shot
 *    fires the same turn WITH +1. This engine had the boost inside the charging branch. Measured
 *    against the official engine before anything changed — Archaludon into Snorlax under Drizzle,
 *    Showdown 97 and medicham2 65. The control is the same click from −1, which nets zero: an engine
 *    that skipped the boost prints the two arms EQUAL. */
demoSource('ROADMAP #81 WIRE 8  Electro Shot keeps its +1 Special Attack when rain skips the charge',
  W8_CHARGE,
  (E) => {
    const run = (weather, pre) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'archaludon', 'incineroar', 'milotic', 'garchomp');
      W7.big(f1); S.field.weather = weather; me.boosts.sa = pre;
      const before = f1.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'electroshot', f1, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
      return { dmg: before - f1.curHP, sa: me.boosts.sa };
    };
    const rain = run('rain', 0), flat = run('rain', -1), dry = run('', 0);
    return rain.dmg > 0 && dry.dmg === 0 && rain.sa === 1 && dry.sa === 1 && flat.sa === 0 && rain.dmg > flat.dmg;
  });

/* 6. A SKIPPED CHARGE STILL ANNOUNCES THE WIND-UP, AND THE ANNOUNCEMENT COMES BEFORE THE BOOST.
 *    STREAM claim, same revert as demo 5. Two assertions in one case because they are one defect:
 *    `this.add('-prepare', ...)` is the FIRST line of every one of the ten handlers, above the
 *    weather test and above the boost. Solar Beam in sun carries the announcement half (its wind-up
 *    grants nothing, so the state is identical) and Electro Shot out of rain carries the order. */
demoSource('ROADMAP #81 WIRE 8  a skipped charge still writes |-prepare|, and it precedes the boost',
  W8_CHARGE,
  (E) => {
    const stream = (sp, mv, weather) => {
      const { me, ally, f1, f2, S } = W7.board(E, sp, 'incineroar', 'milotic', 'garchomp');
      W7.big(f1); S.field.weather = weather;
      const trace = []; S._trace = trace;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
      return trace.filter(l => /^\|-(prepare|boost|damage)\|/.test(String(l)));
    };
    const sun = stream('venusaur', 'solarbeam', 'sun');       // charge skipped: prepare, then the hit
    const dry = stream('archaludon', 'electroshot', '');      // charge spent: prepare, then the boost
    return sun.length === 2 && /^\|-prepare\|/.test(sun[0]) && /^\|-damage\|/.test(sun[1])
        && dry.length === 2 && /^\|-prepare\|/.test(dry[0]) && /^\|-boost\|/.test(dry[1]);
  });

/* ================= ROADMAP #81 WIRE 9 / ROADMAP #84 ==============================================
 *
 * Five demonstrations, all source-reverted, and four of the five assert STATE.
 *
 * The reverts are written against the EXACT pre-wire text, so a later edit that moves any of these
 * sites makes this file throw rather than quietly stop testing anything — which is what
 * `revertedEngine` asserts on every pattern. */

/* THE SPREAD GATE, REVERTED TO "A DAMAGING MOVE NEEDS A NAMED TARGET". Removing the whole block is
 * the honest revert: before this wire `playerAction` had nothing at all between the Trick Room line
 * and the priced-attack branch, and a targetless spread click fell through to the status chain. */
const W9_SPREAD_GATE = [[
  '  if(mv&&hasPower(mv)&&!target&&SPREAD.has(id)){\n'
+ '    const _fo=liveFoesOf(me);\n'
+ '    if(_fo.length){\n'
+ '      let _t=null,_bs=-1;\n'
+ '      for(const _f of _fo){const _d=dmgRange(me,_f,mv,field,true);\n'
+ '        const _s=(_d.min>=_f.curHP?1e6:0)+_d.max; if(_s>_bs){_bs=_s;_t=_f;}}\n'
+ '      if(_t){MEDSEEN.spreadClickWithoutNamedTarget++;target=_t;}\n'
+ '    }\n'
+ '  }\n'
+ '  if(mv&&hasPower(mv)&&target){',
  '  if(mv&&hasPower(mv)&&target){']];

/* 1. THE STATE HALF, AND IT IS THE WHOLE SIZE OF THE WIRE. A spread move carries no target on
 *    Showdown's request, so every driver that asks the authority what is legal hands this engine a
 *    null — and the click became a no-op turn dealing ZERO to both foes.
 *    THE CONTROL IS THE SAME CLICK WITH THE TARGET NAMED, which must deal the SAME damage in both
 *    builds: without it a revert that simply broke Make It Rain would read as a pass. And the
 *    OPPOSITE-SIGN guard is the single-target arm — Shadow Ball with the target withheld must stay a
 *    no-op in BOTH builds, because Showdown rejects that choice and an engine that started aiming
 *    every targetless click would be inventing a decision nobody made. */
demoSource('ROADMAP #81 WIRE 9  a spread move clicked with NO named target still hits both foes',
  W9_SPREAD_GATE,
  (E) => {
    const run = (mv, named) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'gholdengo', 'incineroar', 'garchomp', 'milotic');
      W7.big(f1); W7.big(f2); W7.big(ally);
      const h1 = f1.curHP, h2 = f2.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, mv, named ? f1 : null, S.field)], [ally, { kind: 'pass' }]]),
        W7.pass2(f1, f2));
      return [h1 - f1.curHP, h2 - f2.curHP];
    };
    const named = run('makeitrain', true), withheld = run('makeitrain', false);
    const single = run('shadowball', false);
    return named[0] > 0 && named[1] > 0 && withheld[0] === named[0] && withheld[1] === named[1]
        && single[0] === 0 && single[1] === 0;
  });

/* 2. THE ANNOUNCEMENT HALF — a STREAM claim, and it is labelled as one because the state really is
 *    identical either way: one roll decides the whole move in this engine, so the bodies take zero
 *    whichever shape the line has. `hitStepAccuracy` writes `add('-miss', pokemon, target)` per
 *    target (battle-actions.ts:738); this engine wrote one line with an EMPTY target field.
 *    AND THE OTHER HALF OF THE ROADMAP'S CLAIM IS ASSERTED BESIDE IT: a move that could not work at
 *    all still writes `-fail` and no `-miss`. Fake Out on turn 2 is the cleanest impossible move in
 *    the format, and the two shapes must stay distinguishable — a fix that turned every failure into
 *    a `-miss` would pass a `-miss`-only assertion. */
/*    RE-ANCHORED BY ROADMAP #81 WIRE 10. The announcement is no longer reconstructed inside the
 *    damage loop — it IS step 4, so it is written once per surviving row and the reversal has to put
 *    the single bare line back by hand. `_mvMissed` is the step's own cached roll and carrying a
 *    third state on it is what makes the reverted build emit exactly one `|-miss|` with an empty
 *    target field, which is what this engine did before WIRE 9. */
demoSource('ROADMAP #81 WIRE 9  a MISS names its targets and an impossible move still writes -fail',
  [['        if(TR)TR.miss(m,tg);\n        _explicitFail=true;R.out=true;',
    "        if(TR&&_mvMissed!=='said'){_mvMissed='said';TR.miss(m,null);}\n        _explicitFail=true;R.out=true;"]],
  (E) => {
    /* THE TARGET IS NAMED FOR THE SINGLE-TARGET ARM AND WITHHELD FOR THE SPREAD ONE, which is what
     * each of them is legal as. Handing Fake Out a null target would test WIRE 9's refusal branch
     * instead of the -fail shape, and the two would then be the same case twice. */
    const stream = (mv, roll, turns, named) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'charizard', 'incineroar', 'garchomp', 'milotic');
      W7.big(f1); W7.big(f2);
      const trace = []; S._trace = trace;
      for (let t = 0; t < turns; t++)
        E.battleTurn(S, roll,
          new Map([[me, E.playerAction(me, mv, named ? f1 : null, S.field)], [ally, { kind: 'pass' }]]),
          W7.pass2(f1, f2));
      return trace;
    };
    const missed = stream('heatwave', () => 0.99, 1, false);
    const ms = missed.filter(l => /^\|-miss\|/.test(String(l)));
    /* Fake Out is legal on turn 1 and impossible on turn 2 — the second turn is the one read. */
    const impossible = stream('fakeout', rng5, 2, true).filter(l => /^\|-(miss|fail)\|/.test(String(l)));
    return ms.length === 2
        && ms.every(l => String(l).split('|').length === 4 && /^p2[ab]: /.test(String(l).split('|')[3]))
        && missed.filter(l => /^\|-fail\|/.test(String(l))).length === 0
        && impossible.length === 1 && /^\|-fail\|/.test(String(impossible[0]));
  });

/* 2b. THE CLASS WIRE 9 OPENED, and it is fixed in the same pass. A STREAM claim: the state is
 *     identical either way, so the demonstration reads the lines and asserts the zero beside them.
 *     The reverted arm is the engine's own text — the target list emptied BEFORE the announcement,
 *     which is why the line named nobody. */
demoSource('ROADMAP #81 WIRE 9  Wide Guard names each body it shielded',
  [['      if(a.move.spread&&((it.side===\'A\'&&field.wgB)||(it.side===\'B\'&&field.wgA))){\n'
  + '        if(TR)for(const _wg of targets)TR.act(_wg,\'move: Wide Guard\');\n'
  + '        targets=[];}',
    '      if(a.move.spread&&((it.side===\'A\'&&field.wgB)||(it.side===\'B\'&&field.wgA))){targets=[];\n'
  + '        if(TR)TR.push([\'-activate\',\'\',"move: Wide Guard"]);}']],
  (E) => {
    const run = (guard) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'charizard', 'incineroar', 'garchomp', 'milotic');
      W7.big(f1); W7.big(f2);
      const trace = []; S._trace = trace;
      const h1 = f1.curHP, h2 = f2.curHP;
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, 'heatwave', null, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, guard ? E.playerAction(f1, 'wideguard', null, S.field) : { kind: 'pass' }],
                 [f2, { kind: 'pass' }]]));
      return { lines: trace.filter(l => /^\|-activate\|.*Wide Guard/.test(String(l))),
               dealt: (h1 - f1.curHP) + (h2 - f2.curHP) };
    };
    const on = run(true), off = run(false);
    return on.lines.length === 2 && on.dealt === 0
        && on.lines.every(l => /^\|-activate\|p2[ab]: /.test(String(l)))
        && off.lines.length === 0 && off.dealt > 0;
  });

/* 2c. AND WHO A QUAKE HITS FIRST, which the family also reached for the first time. STREAM claim,
 *     stated: the three bodies take the same damage either way, so the demonstration asserts the
 *     total beside the order. The control is a `spreadFoes` move on the same board — its order must
 *     be unchanged by the revert, or this would pass on a build that reversed every target list. */
demoSource('ROADMAP #81 WIRE 9  a quake resolves against your own partner FIRST',
  [['      if(_allyHit)targets=[_allyHit].concat(targets);',
    '      if(_allyHit)targets=targets.concat([_allyHit]);']],
  (E) => {
    const run = (mv) => {
      const { me, ally, f1, f2, S } = W7.board(E, 'garchomp', 'incineroar', 'milotic', 'tyranitar');
      W7.big(ally); W7.big(f1); W7.big(f2);
      const trace = []; S._trace = trace;
      const h = [ally.curHP, f1.curHP, f2.curHP];
      E.battleTurn(S, rng5,
        new Map([[me, E.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
      return { order: trace.filter(l => /^\|-damage\|/.test(String(l))).map(l => String(l).split('|')[2].split(':')[0]),
               dealt: (h[0] - ally.curHP) + (h[1] - f1.curHP) + (h[2] - f2.curHP) };
    };
    const quake = run('earthquake'), slide = run('rockslide');
    return JSON.stringify(quake.order) === JSON.stringify(['p1b', 'p2a', 'p2b'])
        && JSON.stringify(slide.order) === JSON.stringify(['p2a', 'p2b'])
        && quake.dealt > 0 && slide.dealt > 0;
  });

/* ---- ROADMAP #84, and the two demonstrations have OPPOSITE SIGNS ---------------------------------
 *
 * A single demonstration ("the flinched arm doubles") would pass on an engine that recorded ONE
 * boolean for "did my move work" — which is the wrong engine, and the one this repo would most
 * naturally have written. So the second case reverts the recharge site from `null` to `false` and
 * requires the RECHARGED arm to stop reading 75. That is the whole of ROADMAP #84 made falsifiable:
 * if the split is not represented, one of the two must break. */
const W84_TANTRUM = (E, setup) => {
  const { me, ally, f1, f2, S } = W7.board(E, 'mudsdale', 'incineroar', 'milotic', 'milotic');
  W7.big(f1); W7.big(f2); W7.big(me); W7.big(ally);
  setup(E, S, me, ally, f1, f2);
  const h = f1.curHP;
  E.battleTurn(S, rng5,
    new Map([[me, E.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
    W7.pass2(f1, f2));
  return h - f1.curHP;
};
const W84_CLEAN = (E, S, me, ally, f1, f2) => E.battleTurn(S, rng5,
  new Map([[me, E.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
  W7.pass2(f1, f2));
const W84_FLINCH = (E, S, me, ally, f1, f2) => E.battleTurn(S, rng5,
  new Map([[me, E.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
  new Map([[f1, E.playerAction(f1, 'fakeout', me, S.field)], [f2, { kind: 'pass' }]]));
const W84_RECHARGE = (E, S, me, ally, f1, f2) => {
  E.battleTurn(S, rng5, new Map([[me, E.playerAction(me, 'hyperbeam', f1, S.field)], [ally, { kind: 'pass' }]]),
    W7.pass2(f1, f2));
  E.battleTurn(S, rng5, new Map([[me, E.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
    W7.pass2(f1, f2));
};

/* 3. THE `false` PATH. conditions.ts:205 — flinch's onBeforeMove returns false, so the turn after a
 *    Fake Out is 150 BP. Reverted at the flinch site alone, so the reverted build still records
 *    everything else and only this one refusal goes unrecorded. */
demoSource('ROADMAP #84  a FLINCHED Stomping Tantrum reads 150 BP next turn',
  [["      if(m._flinch){m._flinch=false;m._mvRes=false;if(TR)TR.cant(m,'flinch');continue;}",
    "      if(m._flinch){m._flinch=false;if(TR)TR.cant(m,'flinch');continue;}"]],
  (E) => {
    const clean = W84_TANTRUM(E, W84_CLEAN), flinched = W84_TANTRUM(E, W84_FLINCH);
    return clean > 0 && flinched >= clean * 1.8 && flinched <= clean * 2.2;
  });

/* 4. THE `null` PATH, AND ITS CLAIM HAS THE OPPOSITE SIGN. conditions.ts:372 — recharge returns
 *    null, so the turn after a Hyper Beam recharge is 75 and NOT 150. The known-bad engine here is
 *    the obvious wrong fix: one boolean, "my move did not happen", written at every refusal. It
 *    passes demonstration 3 and it is wrong, and this is the case that says so. */
demoSource('ROADMAP #84  a RECHARGING Stomping Tantrum still reads 75 — null is not false',
  [["      if(m._recharge){m._recharge=false;m._mvRes=null;m._lastMove=m._lastMove||null;if(TR)TR.cant(m,'recharge');continue;}",
    "      if(m._recharge){m._recharge=false;m._mvRes=false;m._lastMove=m._lastMove||null;if(TR)TR.cant(m,'recharge');continue;}"]],
  (E) => {
    const clean = W84_TANTRUM(E, W84_CLEAN), recharged = W84_TANTRUM(E, W84_RECHARGE);
    const flinched = W84_TANTRUM(E, W84_FLINCH);
    /* the flinch arm is carried along so this cannot pass by the doubling having disappeared */
    return clean > 0 && recharged === clean && flinched > clean;
  });

/* 5. AND THE GATE THAT LOCKED THE WHOLE FAMILY OUT. `variablePower` was consumed under
 *    `if(_vp && _vp.kind)`, and twelve moves — Stomping Tantrum and Temper Flare among them — carry
 *    the tag with NO kind at all (`idiom not yet derivable`). So the block was skipped for them, and
 *    skipped SILENTLY, because the unknown-kind counter beside it is gated on the same field. The
 *    control is Acrobatics, which HAS a kind and must be unaffected by the revert — without it this
 *    would also pass on a build that had simply lost variablePower altogether. */
demoSource('ROADMAP #84  the variablePower gate lets a KINDLESS member through, and changes nothing for a kinded one',
  [['  if(_vp){\n    if(_vp.kind===\'targetWeightKg\'', '  if(_vp&&_vp.kind){\n    if(_vp.kind===\'targetWeightKg\'']],
  (E) => {
    const acro = (item) => {
      const a = W7.bare(E, 'staraptor'); a.item = item;
      const d = W7.bare(E, 'milotic');
      return E.dmgRange(a, d, MC.moves['acrobatics'], FIELD(), false).max;
    };
    const clean = W84_TANTRUM(E, W84_CLEAN), flinched = W84_TANTRUM(E, W84_FLINCH);
    return flinched > clean && acro('') > acro('leftovers') * 1.5;
  });

/* ---- ROADMAP #81 WIRE 10 — THE SHAPE, AND THE KNOWN-BAD ENGINE IS ONE LINE -----------------------
 *
 * `medicham2` now holds a `_STEPS` array and drives it with two nested loops, step outside and target
 * inside, which is `trySpreadMoveHit`'s own shape. The reverted build below swaps the two `for`s and
 * nothing else: that IS the engine as it stood through WIRE 9 — a target at a time — so every
 * demonstration here is against the real previous behaviour rather than against a caricature of it.
 *
 * `break` rather than `continue` in the reverted arm, because in a per-target loop a row that drops
 * out has to stop this target's remaining steps, not skip to the next step. That is what a `continue`
 * inside the old single loop did. */
const W10_REVERT = [['      for(const _step of _STEPS)for(const R of _rows){if(R.out)continue;_step(R);}',
                     '      for(const R of _rows)for(const _step of _STEPS){if(R.out)break;_step(R);}']];
const W10 = {
  /* two identical Milotic, the first optionally left on 1 HP so the spread click kills it */
  board(E, ability, killFirst, mv) {
    const me = W7.bare(E, 'gholdengo'); me.ability = ability;
    const ally = W7.bare(E, 'incineroar'); W7.big(ally);
    const f1 = W7.bare(E, 'milotic'), f2 = W7.bare(E, 'milotic');
    W7.big(f2);
    if (killFirst) f1.curHP = 1; else W7.big(f1);
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    const h2 = f2.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), W7.pass2(f1, f2));
    return { trace: trace.map(String), b: h2 - f2.curHP, died: f1.fainted };
  },
};

/* 1. THE STATE HALF, and it is the one that is not a protocol string. `AfterFaint` runs from
 *    `faintMessages` (sim/battle.ts:2598), which `hitStepMoveHitLoop` calls after the WHOLE loop
 *    (battle-actions.ts:972) — so a KO on the first body cannot be holding a Beast Boost when the
 *    second body is priced. Reverted, this engine faints, boosts, and only then prices: 50 instead of
 *    33. The no-ability arm is carried so this cannot pass by the KO having stopped happening. */
demoSource('ROADMAP #81 WIRE 10  a KO on the first target cannot boost the hit on the second',
  W10_REVERT,
  (E) => {
    const koB = W10.board(E, 'eelevate', true, 'makeitrain');
    const noKO = W10.board(E, 'eelevate', false, 'makeitrain');
    const plain = W10.board(E, 'none', true, 'makeitrain');
    const fired = koB.trace.filter(l => /^\|-boost\|.*eelevate/.test(l)).length;
    return koB.died && !noKO.died && fired === 1 && noKO.b > 0
        && koB.b === noKO.b && plain.b === noKO.b;
  });

/* 2. THE STREAM HALF — every step over every target before the next step begins. Staged in the
 *    authority first (Gholdengo Icy Wind into two Milotic): `-resisted -resisted -damage -damage
 *    -unboost -unboost`. The single-target arm is carried BECAUSE it must NOT flip: it is the control
 *    for the whole restructure and it is asserted equal below on its own. */
demoSource('ROADMAP #81 WIRE 10  a spread move runs each step over every target before the next',
  W10_REVERT,
  (E) => {
    const me = W7.bare(E, 'gholdengo'), ally = W7.bare(E, 'incineroar'); W7.big(ally);
    const f1 = W7.bare(E, 'garchomp'), f2 = W7.bare(E, 'milotic'); W7.big(f1); W7.big(f2);
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    const h1 = f1.curHP, h2 = f2.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'icywind', null, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    const shape = trace.map(String).map(l => /^\|-(supereffective|resisted)\|/.test(l) ? 'eff'
      : /^\|-damage\|/.test(l) ? 'dmg' : /^\|-unboost\|p2/.test(l) ? 'sec' : null).filter(Boolean).join(',');
    return shape === 'eff,eff,dmg,dmg,sec,sec' && h1 - f1.curHP > 0 && h2 - f2.curHP > 0;
  });

/* 3. THE SHARP ONE. A target that FAINTS to the first damage packet does not interrupt the rest:
 *    `spreadDamage` only queues the faint, and every remaining `-damage` is written before the
 *    `|faint|` line appears. Reverted, the stream reads `dmg,faint,dmg`. The survivor's HP loss is
 *    asserted identical in both arms so "the right order" cannot come to mean "the second body
 *    stopped being hit". */
demoSource('ROADMAP #81 WIRE 10  a target that faints mid-spread does not interrupt the other target',
  W10_REVERT,
  (E) => {
    const kill = W10.board(E, 'none', true, 'dazzlinggleam');
    const live = W10.board(E, 'none', false, 'dazzlinggleam');
    const sh = (r) => r.trace.map(l => /^\|-damage\|p2/.test(l) ? 'dmg' : /^\|faint\|p2/.test(l) ? 'faint' : null)
      .filter(Boolean).join(',');
    return sh(kill) === 'dmg,dmg,faint' && sh(live) === 'dmg,dmg' && kill.b > 0 && kill.b === live.b;
  });

/* ---- AND THE CONTROL, WHICH IS THE OPPOSITE CLAIM AND THEREFORE CANNOT BE A `demoSource` ----------
 *
 * A restructure of the hit path is only attributable if the SINGLE-TARGET path did not move, and the
 * two arms here must AGREE — which is exactly the shape `demo`/`demoSource` reject. So it is asserted
 * directly: a batch of single-target clicks, each played through the shipped build and through the
 * reverted per-target build, must produce byte-identical streams and identical HP.
 *
 * At one target the two loop orders are the same permutation, so this is arithmetic rather than luck
 * — and it is measured anyway, because "it must be identical" is precisely the kind of claim this
 * repository has been wrong about while sounding certain. */
{
  const bad = revertedEngine(W10_REVERT);
  /* THE LIST IS CHECKED, NOT TRUSTED. The first cut of this control put `makeitrain` and
   * `earthquake` in it and reported five single-target clicks "moving" — both are spread moves, so
   * the control was measuring the very thing it exists to hold constant. That is this project's
   * standing failure mode arriving inside the guard against it, so single-targetness is now ASSERTED
   * per row (the partner slot must take nothing and no `p2b` line may appear) rather than claimed by
   * the name of the list. */
  const SINGLE = [['garchomp', 'milotic', 'earthpower'], ['gholdengo', 'garchomp', 'shadowball'],
                  ['incineroar', 'milotic', 'flareblitz'], ['garchomp', 'corviknight', 'dragonclaw'],
                  ['milotic', 'garchomp', 'scald'], ['gholdengo', 'mimikyu', 'shadowball'],
                  ['incineroar', 'garchomp', 'knockoff'], ['garchomp', 'gholdengo', 'ironhead'],
                  ['chesnaught', 'mimikyu', 'woodhammer'], ['incineroar', 'milotic', 'fakeout'],
                  ['tyranitar', 'gholdengo', 'crunch'], ['corviknight', 'garchomp', 'bravebird']];
  const play = (E, att, def, mv, roll) => {
    const me = W7.bare(E, att), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, def), f2 = W7.bare(E, 'tyranitar');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    const h = [f1.curHP, f2.curHP, me.curHP];
    E.battleTurn(S, roll, new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    const t = trace.map(String);
    return { key: JSON.stringify({ t, d: [h[0] - f1.curHP, h[1] - f2.curHP, h[2] - me.curHP] }),
             single: (h[1] - f2.curHP) === 0 && !t.some(l => /^\|-(damage|supereffective|resisted|immune|miss)\|p2b/.test(l)) };
  };
  let same = 0, diff = [], notSingle = [];
  for (const [att, def, mv] of SINGLE) for (const roll of [rng5, () => 0.99, () => 0]) {
    const A = play(M, att, def, mv, roll), B = play(bad, att, def, mv, roll);
    if (!A.single) notSingle.push(att + ' ' + mv);
    if (A.key === B.key) same++; else diff.push(att + ' ' + mv + ' -> ' + def);
  }
  ran++;
  const ok = diff.length === 0 && notSingle.length === 0 && same === SINGLE.length * 3;
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK   ' : 'FAIL '} ROADMAP #81 WIRE 10  CONTROL: ${same}/${SINGLE.length * 3} single-target `
    + `clicks byte-identical under the step driver and the reverted per-target driver`
    + (diff.length ? '   MOVED: ' + diff.join(', ') : '')
    + (notSingle.length ? '   NOT ACTUALLY SINGLE-TARGET: ' + [...new Set(notSingle)].join(', ') : ''));
}


/* ---- ROADMAP #81 WIRE 11 — FOUR DEFECTS, EACH ON ITS OWN REVERTED ENGINE ------------------------
 *
 * Read from `sim/battle-actions.ts`, `sim/battle.ts`, `data/items.ts` and `data/abilities.ts`, not
 * from a summary of them. Seven demonstrations. SIX READ STATE ONLY — HP, the item slot, a stat
 * stage, and the Speed that decided who moved first — and the seventh reads the damage-line ORDER
 * with both bodies' HP asserted beside it, because an order is the whole of that defect and there is
 * no state reading that can see it.
 *
 * EVERY REVERSAL ASSERTS IT APPLIED (revertedEngine throws on a pattern that no longer matches), so a
 * demo cannot go green because its known-bad engine quietly failed to be bad. */

const W11_SPREAD_REVERT = [[
  '          let d=dmgRange(m,tg,mv,field,_spreadHit,isCrit);',
  '          let d=dmgRange(m,tg,mv,field,a.move.spread&&targets.length>1,isCrit);']];

const W11_HERB_REVERT = [[
  'function restoreStatsAll(a,b){\n  let n=0;\n  for(const x of [...(a||[]),...(b||[])])if(x&&restoreStatsUpdate(x))n++;\n  return n;\n}',
  'function restoreStatsAll(a,b){\n  return 0;   /* WIRE 11 REVERTED: the residual keeps its own call, the other three do nothing */\n}']];

const W11_ORDER_REVERT = [
  ['        /* WIRE 11 REVERT ANCHOR -- THE OLD CALL SITE, and it is a comment on purpose. This engine ran',
   '        _koThisHit=dmg>=tg.curHP;_damagingHit();\n        /* WIRE 11 REVERTED -- THE OLD CALL SITE. This engine ran'],
  ['        _damagingHit();   /* ROADMAP #81 WIRE 11 -- the reactors, AFTER the damage */',
   '        ;                 /* WIRE 11 REVERTED -- the reactors already ran, above the damage */']];

const W11_CRIT_REVERT = [
  ['  const _critIgnA=_critHere&&_aBody.boosts[_aKey]<0;\n  const _critIgnD=_critHere&&def.boosts[_dKey]>0;',
   '  const _critIgnA=false;\n  const _critIgnD=false;   /* WIRE 11 REVERTED */'],
  ["  if(_sf&&!_critHere&&!TAGS.has('ability',attAb,'ignoresScreensAndSubs')){",
   "  if(_sf&&!TAGS.has('ability',attAb,'ignoresScreensAndSubs')){   /* WIRE 11 REVERTED */"]];

const W11 = {
  /* Will's live case: Dazzling Gleam into a Protecting Pelipper beside an Archaludon. `partner` is
   * 'alive', 'protect' or 'fainted'; the number returned is what the SURVIVOR lost. */
  gleam(E, partner) {
    const me = W7.bare(E, 'gholdengo'), ally = W7.bare(E, 'incineroar'); W7.big(ally);
    const f1 = W7.bare(E, 'archaludon'), f2 = W7.bare(E, 'pelipper');
    W7.big(f1); W7.big(f2);
    if (partner === 'fainted') { f2.fainted = true; f2.curHP = 0; }
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const h1 = f1.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'dazzlinggleam', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }],
               [f2, partner === 'protect' ? { kind: 'protect', mv: 'protect' } : { kind: 'pass' }]]));
    return { d: h1 - f1.curHP, partnerLeft: f2.curHP, partnerMax: f2.st.hp };
  },
  /* Incineroar Intimidates a Sneasler holding `item`. NO turn is spent, so the residual — which has
   * restored stats since WIRE 56 — cannot supply the answer and the switch-in trigger has to. */
  intim(E, item) {
    const me = W7.bare(E, 'incineroar'); me.ability = 'intimidate';
    const ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'sneasler'); f1.item = item; f1.ability = 'none';
    const f2 = W7.bare(E, 'garchomp');
    E.battleInit([me, ally], [f1, f2], {});
    return { at: f1.boosts.at, item: f1.item };
  },
  /* The Unburden half, read as an OUTCOME. Sneasler at an explicit 100 Speed against an Intimidating
   * Incineroar at 150 left on 1 HP: if the herb really came off mid-turn, Unburden doubles 100 to 200,
   * Sneasler moves first, the Incineroar dies before acting and Sneasler takes nothing back. */
  unburden(E, item) {
    const me = W7.bare(E, 'sneasler'); me.item = item; me.ability = 'unburden';
    me.st = Object.assign({}, me.st, { sp: 100 });
    const ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'incineroar'); f1.ability = 'intimidate';
    f1.st = Object.assign({}, f1.st, { sp: 150 }); f1.curHP = 1;
    const f2 = W7.bare(E, 'garchomp');
    const S = E.battleInit([me, ally], [f1, f2], {});
    const mine = me.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, E.playerAction(f1, 'flareblitz', me, S.field)], [f2, { kind: 'pass' }]]));
    return { took: mine - me.curHP, foeDead: !!f1.fainted };
  },
  /* Tyranitar Knock Off (contact) into a 20 HP Aftermath body. Returns what the ATTACKER paid. */
  aftermath(E, item) {
    const me = W7.bare(E, 'tyranitar'), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'milotic'); f1.ability = 'aftermath'; f1.item = item;
    f1.st = Object.assign({}, f1.st, { hp: 20 }); f1.curHP = 20;
    const f2 = W7.bare(E, 'garchomp');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const mine = me.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    return { paid: mine - me.curHP, left: f1.curHP, dead: !!f1.fainted };
  },
  /* The same click into a Rough Skin body that CANNOT die, read as the order of the two damage lines
   * with both HP deltas carried out beside them. */
  order(E, defAbility) {
    const me = W7.bare(E, 'tyranitar'), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'garchomp'); f1.ability = defAbility; W7.big(f1);
    const f2 = W7.bare(E, 'milotic');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    const h1 = f1.curHP, hm = me.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    return { shape: trace.map(String)
               .map(l => /^\|-damage\|p2a/.test(l) ? 'target' : /^\|-damage\|p1a/.test(l) ? 'attacker' : null)
               .filter(Boolean).join(','),
             d: h1 - f1.curHP, paid: hm - me.curHP };
  },
  /* A REAL Intimidate from the second foe slot, so the -1 Attack arrives through the path it arrives
   * through in a game. Flower Trick is pCrit 1; Knock Off is the plain physical control. */
  crit(E, moveId, intimidate) {
    const me = W7.bare(E, 'meowscarada'), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'garchomp'); W7.big(f1);
    const f2 = W7.bare(E, 'incineroar'); f2.ability = intimidate ? 'intimidate' : 'none';
    const S = E.battleInit([me, ally], [f1, f2], {});
    const h1 = f1.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    return { d: h1 - f1.curHP, at: me.boosts.at };
  },
  /* the same click with a chosen Defence stage on the target, or a Reflect over its side */
  critBoard(E, moveId, dfStage, reflect) {
    const me = W7.bare(E, 'meowscarada'), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'garchomp'); W7.big(f1); f1.boosts.df = dfStage;
    const f2 = W7.bare(E, 'milotic');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    if (reflect) S.sfB.sc.reflect = 5;
    const h1 = f1.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    return h1 - f1.curHP;
  },
};

/* 1. THE SPREAD MODIFIER IS DECIDED BY TARGETS ENTERED. `if (targets.length > 1 && !move.smartTarget)
 *    move.spreadHit = true;` is the first line of `trySpreadMoveHit` (battle-actions.ts:551), above
 *    the whole step list — so a partner behind a Protect is still IN the array and the survivor still
 *    eats the 0.75. Three arms, because two cannot separate "the modifier is right" from "there is no
 *    modifier": the shielded arm must EQUAL the both-alive arm and must be 0.75 of the fainted one.
 *    The fainted arm is carried on both engines as the control and must not move. */
demoSource('ROADMAP #81 WIRE 11  a PROTECTING partner still costs the survivor the spread 0.75',
  W11_SPREAD_REVERT,
  (E) => {
    const both = W11.gleam(E, 'alive'), shield = W11.gleam(E, 'protect'), alone = W11.gleam(E, 'fainted');
    const r = alone.d ? shield.d / alone.d : 0;
    return both.d > 0 && alone.d > both.d && shield.d === both.d
        && shield.partnerLeft === shield.partnerMax   /* the Protect really held */
        && r > 0.72 && r < 0.78;
  });

/* 2. WHITE HERB ON THE SWITCH-IN — the item slot and the stat stage, no turn spent. The reverted
 *    engine is WIRE 56's: the herb still works at the RESIDUAL, so this arm is only red because no
 *    turn has passed, which is exactly the defect (a whole turn played at -1). The Leftovers control
 *    must hold on BOTH engines, so "the slot emptied" cannot mean "the body never had an item". */
demoSource('ROADMAP #81 WIRE 11  White Herb answers Intimidate on the SWITCH-IN, not a turn later',
  W11_HERB_REVERT,
  (E) => {
    const control = W11.intim(E, 'leftovers'), test = W11.intim(E, 'whiteherb');
    return control.at === -1 && control.item === 'leftovers'
        && test.at === 0 && test.item === '';
  });

/* 3. AND THE THIRD EFFECT IS THE ONE THAT MATTERS: losing the item procs Unburden, which is a SPEED
 *    TIER CHANGE MID-TURN. Read as who got there first, never as a Speed number. */
demoSource('ROADMAP #81 WIRE 11  a White Herb spent to Intimidate procs Unburden in the same turn',
  W11_HERB_REVERT,
  (E) => {
    const control = W11.unburden(E, 'leftovers'), test = W11.unburden(E, 'whiteherb');
    return control.took > 0 && control.foeDead && test.took === 0 && test.foeDead;
  });

/* 4. THE CONTACT PUNISH, ON HP. Aftermath's gate is `!target.hp` — the HP after the Sash. The
 *    reverted engine reads the RAW damage against the pre-Sash HP, so a body that survives at 1
 *    detonates anyway. The no-item arm must fire on BOTH engines: without it this would pass on an
 *    engine that had simply lost Aftermath. */
demoSource('ROADMAP #81 WIRE 11  a Focus Sash survivor does not set off Aftermath',
  W11_ORDER_REVERT,
  (E) => {
    const control = W11.aftermath(E, ''), test = W11.aftermath(E, 'focussash');
    const quarter = Math.floor(W7.bare(E, 'tyranitar').st.hp / 4);
    return control.dead && control.paid === quarter
        && !test.dead && test.left === 1 && test.paid === 0;
  });

/* 5. THE ORDER ITSELF, which has no state reading. `spreadDamage` is step 2 of `spreadMoveHit`
 *    (battle-actions.ts:1079) and `runEvent('DamagingHit')` is four steps later (:1117). Both bodies'
 *    HP is asserted equal to the no-ability control, so "the right order" cannot come to mean "the
 *    toll stopped being paid" or "the move stopped landing". */
demoSource('ROADMAP #81 WIRE 11  the contact punish is paid AFTER the damage lands',
  W11_ORDER_REVERT,
  (E) => {
    const control = W11.order(E, 'none'), test = W11.order(E, 'roughskin');
    const eighth = Math.floor(W7.bare(E, 'tyranitar').st.hp / 8);
    return control.shape === 'target' && control.paid === 0 && control.d > 0
        && test.shape === 'target,attacker' && test.paid === eighth && test.d === control.d;
  });

/* 6. A CRIT IGNORES THE ATTACKER'S NEGATIVE ATTACK STAGE. `ignoreOffensive = (moveHit.crit &&
 *    atkBoosts < 0)` (battle-actions.ts:1683-1691). Intimidate is on 31,129 observed sets, which is
 *    why this is the expensive member of the family. The plain-move arm must MOVE on both engines —
 *    it is the proof that the -1 costs anything at all. */
demoSource('ROADMAP #81 WIRE 11  an Intimidated attacker lands a guaranteed crit at FULL Attack',
  W11_CRIT_REVERT,
  (E) => {
    const p0 = W11.crit(E, 'knockoff', false), p1 = W11.crit(E, 'knockoff', true);
    const c0 = W11.crit(E, 'flowertrick', false), c1 = W11.crit(E, 'flowertrick', true);
    return p0.at === 0 && p1.at === -1 && c1.at === -1
        && p1.d < p0.d && c0.d > 0 && c1.d === c0.d;
  });

/* 7. THE OTHER TWO IGNORES, AND THE SIGN THAT IS *NOT* IGNORED. A crit refuses the defender's
 *    POSITIVE Defence stage and a screen, and still takes a NEGATIVE Defence stage — an engine that
 *    simply dropped the defender's boost multiplier on a crit would pass a two-armed version of this
 *    and be wrong in the other direction, so the minus arm is carried. */
demoSource('ROADMAP #81 WIRE 11  a crit ignores a POSITIVE Defence stage and Reflect, and not a negative one',
  W11_CRIT_REVERT,
  (E) => {
    const p0 = W11.critBoard(E, 'knockoff', 0, false), p2 = W11.critBoard(E, 'knockoff', 2, false);
    const c0 = W11.critBoard(E, 'flowertrick', 0, false), c2 = W11.critBoard(E, 'flowertrick', 2, false);
    const sp = W11.critBoard(E, 'knockoff', 0, true), sc = W11.critBoard(E, 'flowertrick', 0, true);
    const cn = W11.critBoard(E, 'flowertrick', -2, false);
    return p2 < p0 && c0 > 0 && c2 === c0        /* the +2 is ignored by the crit and not by the plain move */
        && sp < p0 && sc === c0                  /* Reflect likewise */
        && cn > c0;                              /* and a MINUS still counts */
  });

/* ---- AND THE CONTROL FOR THE CRIT WIRE, WHICH IS THE OPPOSITE CLAIM AND CANNOT BE A `demoSource` --
 *
 * A crit that ignores NOTHING must price exactly as it did before this wire, and a BURN must survive
 * a crit. Both arms have to AGREE, which is the shape demoSource rejects, so they are asserted
 * directly. The burn half is the trap Will named — "i dont think it ignores burn tho" — and it is a
 * guard against a future pass "completing" the list with a fourth member that does not exist. */
{
  const bad = revertedEngine(W11_CRIT_REVERT);
  const plainCrit = (E) => W11.critBoard(E, 'flowertrick', 0, false);
  const burned = (E) => {
    const me = W7.bare(E, 'meowscarada'), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, 'garchomp'); W7.big(f1);
    const f2 = W7.bare(E, 'milotic');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    me.status = 'brn';
    const h1 = f1.curHP;
    E.battleTurn(S, rng5,
      new Map([[me, E.playerAction(me, 'flowertrick', f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    return h1 - f1.curHP;
  };
  const a = plainCrit(M), b = plainCrit(bad), ba = burned(M), bb = burned(bad);
  ran++;
  const ok = a === b && a > 0 && ba < a && ba === bb;
  if (!ok) failures++;
  console.log('  ' + (ok ? 'OK   ' : 'FAIL ') + 'ROADMAP #81 WIRE 11  CONTROL: a crit with nothing to '
    + 'ignore is UNCHANGED (' + a + ' vs ' + b + ') and a crit under a BURN is still halved ('
    + ba + ' vs ' + bb + ') — burn is a multiplier, not a stage');
}


/* ---- THE ATTRIBUTION CONTROL FOR THE WHOLE OF WIRE 11 --------------------------------------------
 *
 * The seven demonstrations above each show ONE thing moving. This shows that NOTHING ELSE did, which
 * is the claim a wire cannot make about itself and is the reason WIRE 10's rung was attributable at
 * all. All three reversals are applied AT ONCE, so the arm is the engine exactly as it stood before
 * this pass, and a batch of ordinary clicks is played through both.
 *
 * IT IS A STATE COMPARISON AND NOT A STREAM ONE, DELIBERATELY, and the split is the finding rather
 * than a convenience:
 *
 *   - the STATE of every body — HP, boosts, item, status, fainted — must be IDENTICAL on every row.
 *     None of these rows has a crit-ignorable stage, a screen, a shielded partner or an `onFaintOnly`
 *     reactor in it, so no rule this wire touched can reach them, and if one moves the wire has a
 *     reach nobody declared.
 *   - the STREAM must be identical on every row with NO reactor at all, and must DIFFER on every row
 *     whose reactor pays an UNCONDITIONAL toll — because the contact punish moved below the damage
 *     line and that is the whole of defect 3. Asserting only the first half would let a build that
 *     silently stopped reordering pass; asserting only the second would not notice a reorder leaking
 *     into rows with no reactor at all.
 *
 * AND A THIRD CLASS, WHICH IS A FINDING AND NOT A CONVENIENCE. The first cut of this control put
 * Static, Stamina and Weak Armor in the "must reorder" list and it went red on all three — correctly,
 * and for two different reasons the list could not express:
 *   - STATIC's toll is a 30% ROLL. On the pinned median die it does not fire at all, so two of its
 *     three rolls produce an identical stream in both engines and the row is only sometimes a
 *     reorder. It IS one at roll 0, and that is asserted separately below.
 *   - STAMINA and WEAK ARMOR are `buffsHolderOnHit`, which this engine resolves in `_stepEffects`,
 *     a LATER step that WIRE 11 did not touch. In Showdown they are `onDamagingHit` — the same event
 *     as Rough Skin — so they SHOULD move with it. They did not, and that residual is filed in
 *     docs/ENGINE.md rather than folded in here.
 * So they are counted, printed and asserted neither way, with the reason. A row placed in the wrong
 * class is reported by name. */
{
  const bad = revertedEngine(W11_SPREAD_REVERT.concat(W11_ORDER_REVERT).concat(W11_CRIT_REVERT));
  /* [attacker, defender, defender ability, move, class] — 'none' the stream must not move,
     'toll' it must, 'rolled/laterstep' it is counted and printed and asserted neither way. */
  const ROWS = [
    ['garchomp', 'milotic', 'none', 'earthpower', 'none'],
    ['gholdengo', 'garchomp', 'none', 'shadowball', 'none'],
    ['incineroar', 'milotic', 'none', 'flareblitz', 'none'],
    ['garchomp', 'corviknight', 'none', 'dragonclaw', 'none'],
    ['milotic', 'garchomp', 'none', 'scald', 'none'],
    ['tyranitar', 'gholdengo', 'none', 'crunch', 'none'],
    ['gholdengo', 'milotic', 'none', 'makeitrain', 'none'],
    ['gholdengo', 'garchomp', 'none', 'dazzlinggleam', 'none'],
    ['garchomp', 'milotic', 'none', 'earthquake', 'none'],
    ['tyranitar', 'garchomp', 'roughskin', 'knockoff', 'toll'],
    ['incineroar', 'garchomp', 'roughskin', 'flareblitz', 'toll'],
    ['garchomp', 'corviknight', 'roughskin', 'dragonclaw', 'toll'],
    ['tyranitar', 'milotic', 'static', 'knockoff', 'rolled'],
    ['garchomp', 'milotic', 'stamina', 'dragonclaw', 'laterstep'],
    ['incineroar', 'milotic', 'weakarmor', 'flareblitz', 'laterstep'],
  ];
  const play = (E, [att, def, defAb, mv], roll) => {
    const me = W7.bare(E, att), ally = W7.bare(E, 'corviknight');
    const f1 = W7.bare(E, def); f1.ability = defAb;
    const f2 = W7.bare(E, 'milotic');
    const S = E.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    E.battleTurn(S, roll,
      new Map([[me, E.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      W7.pass2(f1, f2));
    const body = (x) => [x.curHP, x.item, x.status || '', !!x.fainted, JSON.stringify(x.boosts)];
    return { state: JSON.stringify([me, ally, f1, f2].map(body)),
             stream: JSON.stringify(trace.map(String)) };
  };
  let stateSame = 0, stateMoved = [], streamShouldMatch = [], streamShouldDiffer = [], n = 0;
  let thirdClassMoved = 0, thirdClassStill = 0;
  const name = (r) => r[0] + ' ' + r[3] + ' -> ' + r[1] + (r[2] === 'none' ? '' : '/' + r[2]);
  for (const row of ROWS) for (const roll of [rng5, () => 0.99, () => 0]) {
    n++;
    const A = play(M, row, roll), B = play(bad, row, roll);
    if (A.state === B.state) stateSame++; else stateMoved.push(name(row));
    const streamSame = A.stream === B.stream;
    if (row[4] === 'none' && !streamSame) streamShouldMatch.push(name(row));
    if (row[4] === 'toll' && streamSame) streamShouldDiffer.push(name(row));
    if (row[4] !== 'none' && row[4] !== 'toll') { if (streamSame) thirdClassStill++; else thirdClassMoved++; }
  }
  /* AND STATIC IS PINNED SEPARATELY AT THE ROLL THAT FIRES IT, so "sometimes" cannot quietly become
   * "never": at roll 0 its 30% paralysis lands, and the `|-status|` on the ATTACKER must sit after
   * the `|-damage|` on the target rather than before it. */
  const staticRow = ['tyranitar', 'milotic', 'static', 'knockoff'];
  const sA = JSON.parse(play(M, staticRow, () => 0).stream).filter(l => /-damage\|p2a|-status\|p1a/.test(l));
  const sB = JSON.parse(play(bad, staticRow, () => 0).stream).filter(l => /-damage\|p2a|-status\|p1a/.test(l));
  const staticOK = sA.length === 2 && sB.length === 2
    && /-damage/.test(sA[0]) && /-status/.test(sA[1])
    && /-status/.test(sB[0]) && /-damage/.test(sB[1]);
  ran++;
  const ok = stateSame === n && !streamShouldMatch.length && !streamShouldDiffer.length && staticOK;
  if (!ok) failures++;
  console.log('  ' + (ok ? 'OK   ' : 'FAIL ') + 'ROADMAP #81 WIRE 11  CONTROL: ' + stateSame + '/' + n
    + ' ordinary clicks land in an IDENTICAL state under all three reversals; the stream moves on '
    + 'every unconditional-toll row and on no reactorless row; a ROLLED toll reorders at the roll that '
    + 'fires it (' + (staticOK ? 'yes' : 'NO') + '); the `buffsHolderOnHit`/rolled class moved on '
    + thirdClassMoved + ' and held still on ' + thirdClassStill + ' of its '
    + (thirdClassMoved + thirdClassStill) + ' cells — asserted neither way, see the header'
    + (stateMoved.length ? '   STATE MOVED: ' + [...new Set(stateMoved)].join(', ') : '')
    + (streamShouldMatch.length ? '   STREAM MOVED WITH NO REACTOR: ' + [...new Set(streamShouldMatch)].join(', ') : '')
    + (streamShouldDiffer.length ? '   TOLL ROW DID NOT REORDER: ' + [...new Set(streamShouldDiffer)].join(', ') : ''));
}

console.log(`\n  ${ran} demonstrations, ${failures} failed`);
if (failures) { console.log('  A green-and-stripped pair that did not flip means the probe does NOT watch its knob.'); process.exit(1); }
