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
  [['          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field, m)) === 0){if(TR)TR.imm(tg);continue;}',
    '          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field)) === 0) continue;']],
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
  [['          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field, m)) === 0){if(TR)TR.imm(tg);continue;}',
    '          if (mcEff(effMoveType(mv, a.move.id, field, m), tg.types) === 0) continue;']],
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
  [["        if(moveClassBlocked(tg,a.move.id,m)){if(TR)TR.imm(tg,'[from] ability: '+tg.ability);continue;}   // WIRE 128 -- Mold Breaker suppresses Bulletproof too",
    '        if(moveClassBlocked(tg,a.move.id))continue;']],
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
demoSource('WIRE 129 the attack-site roll knows WHO it is aimed at',
  [["      const _accDef=(!a.move.spread&&targets.length===1)?targets[0]:null;",
    "      const _accDef=null;"]],
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
   * when it breaks. The REVERSAL is unchanged -- the bare `_sub > 0` test, which is the bypass
   * defect this demonstration exists to show red. */
  [[`        if(subBlocks(m,tg,a.move.id)){const _s0=tg._sub;tg._sub=Math.max(0,tg._sub-dmg);
          if(TR){TR.act(tg,'move: Substitute','[damage]');if(_s0>0&&tg._sub<=0)TR.vend(tg,'Substitute');}
          continue;}`,
    '        if(tg._sub>0){tg._sub=Math.max(0,tg._sub-dmg);continue;}']],
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
  [['          if(m._sub>0&&TAGS.has(\'move\',a.mv||a.move.id,\'substitute\')){m._lastMove=a.mv||a.move.id;if(TR)TR.fail(m);continue;}\n', '']],
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
  [["  if(id==='tailwind')return {kind:'tail'};\n", '']],
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
  [['  return {name,types,st,item,wt:m.wt||null,_bsAtk,ability:normAb(megaAbility(name,item,_rowAb||\'\')),baseAbility:normAb(_rowAb||\'\'),moves:megaRowMoves(name,m).slice(),',
    '  return {name,types,st,item,wt:m.wt||null,_bsAtk,ability:normAb(megaAbility(name,item,_rowAb||\'\')),baseAbility:normAb(_rowAb||\'\'),moves:m.mv.slice(),']],
  (E) => {
    const holds = (name) => { const b = E.buildMon(name, {}); return b ? b.moves.length : -1; };
    return holds('floette-mega') === 4 && holds('scizor-mega') > 0;
  });

console.log(`\n  ${ran} demonstrations, ${failures} failed`);
if (failures) { console.log('  A green-and-stripped pair that did not flip means the probe does NOT watch its knob.'); process.exit(1); }
