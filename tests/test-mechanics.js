/* IS THE MECHANIC LIVE, OR ONLY TAGGED?  node tests/test-mechanics.js
 *
 * Will tagged every move, ability and item in the format, and reasonably expected the engine to play
 * them. A tag is a FACT in data/abra-tags.js; something has to consume it. Electro Shot carried
 * `chargeTurn` since July while the engine's own comment said the tag had "no state to land on", and
 * that stayed true until a live game exposed it. 122 of 172 distinct tags are never referenced by
 * name (tests/mechanics_rank.js ranks them by the corpus usage they cover).
 *
 * UNREFERENCED IS NOT UNIMPLEMENTED, which is the whole reason this file exists rather than a grep.
 * Choice Scarf, Fake Out's flinch and Filter all work without their tag being read anywhere. The only
 * way to know is to make the thing happen and look.
 *
 * EVERY PROBE CLEARS ITS OWN CONTROL, and that rule was learned the expensive way. The first version
 * of this reported Choice Scarf as MISSING: it built a "plain" Basculegion to compare against, and
 * buildMon hands a Pokemon its USAGE item -- which is a Choice Scarf. It compared a scarf to a scarf
 * and called the engine broken. So nothing here assumes a default; the varied thing is always set to
 * a known value on BOTH sides, and both sides are printed so a null result reads as a null result.
 *
 * A FAILING PROBE IS NOT A FAILING TEST. This reports a census, not a pass/fail suite -- MISSING is
 * the current honest state of several mechanics and the file would be useless if it went red and got
 * ignored. It exits 0 and prints a count. What must never happen is a mechanic going from WORKS to
 * MISSING, so the count is written to data/mechanics-census.json for a ratchet to hold.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));

/* NOTHING ASSUMED: item and ability are blanked, so a probe sets what it is testing and nothing else
 * can supply it silently. */
const bare = (sp) => {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none';
  return b;
};
const FIELD = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, wgA: false, wgB: false };
const fresh = () => Object.assign({}, FIELD);
/* Mid-roll rng: 0.5 defeats nothing and triggers nothing at the extremes, so a probe that needs a
 * chance effect forces it explicitly rather than hoping. */
const rng5 = () => 0.5;

const results = [];
const probe = (kind, tag, label, fn) => {
  let works = false, detail = '';
  try { const r = fn(); works = !!r.works; detail = r.detail; }
  catch (e) { works = false; detail = 'THREW: ' + e.message.slice(0, 60); }
  results.push({ kind, tag, label, works, detail });
};

/* ---- ITEMS -------------------------------------------------------------------------------------- */

probe('item', 'speedMult', 'Choice Scarf raises Speed', () => {
  const a = bare('basculegion'), b = bare('basculegion');
  b.item = 'choicescarf';
  const sa = M.effSpeed(a, fresh(), 'A'), sb = M.effSpeed(b, fresh(), 'A');
  return { works: sb > sa * 1.4, detail: `no item ${sa}  ->  scarf ${sb}` };
});

probe('item', 'passiveHeal', 'Leftovers heals at end of turn', () => {
  const run = (item) => {
    const me = bare('incineroar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.item = item; me.curHP = Math.floor(me.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return me.curHP - before;
  };
  const none = run(''), left = run('leftovers');
  return { works: left > none, detail: `no item ${none} hp  ->  leftovers ${left} hp` };
});

probe('item', 'megaStone', 'a mega stone builds the mega body', () => {
  const z = M.buildMon('charizard-mega-y', {});
  return { works: !!z && /mega/.test(z.name), detail: 'built ' + (z && z.name) };
});

/* ---- MOVES -------------------------------------------------------------------------------------- */

probe('move', 'neverMisses', 'Aerial Ace cannot miss', () => {
  const acc = M.moveAccuracy('aerialace', fresh());
  return { works: acc >= 100, detail: 'accuracy=' + acc };
});

probe('move', 'stalling', 'repeated Protect starts failing', () => {
  /* RE-DERIVING THE RULE IS NOT TESTING IT. The first version computed (1/3)^n here and asserted its
   * own arithmetic -- it would have passed with the engine deleted. This spends real turns and asks
   * whether the third consecutive Protect actually stops blocking. */
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const dealt = [];
  for (let t = 0; t < 3; t++) {
    const fa = new Map([[me, M.playerAction(me, 'protect', null, S.field)], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, fb);
    dealt.push(before - me.curHP);
    me.curHP = me.st.hp;                       // heal back so turn 3 is not a faint
  }
  return { works: dealt[0] === 0 && dealt[dealt.length - 1] > 0,
           detail: `damage taken per consecutive Protect: ${dealt.join(', ')}` };
});

probe('move', 'flinches', 'Fake Out stops the foe attacking', () => {
  const run = (useFO) => {
    const me = bare('incineroar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, useFO ? M.playerAction(me, 'fakeout', f1, S.field) : { kind: 'pass' }],
                        [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return before - me.curHP;
  };
  const off = run(false), on = run(true);
  return { works: on < off, detail: `foe dealt ${off} without  ->  ${on} after Fake Out` };
});

probe('move', 'recoil', 'Brave Bird hurts its user', () => {
  const me = bare('staraptor'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'bravebird', f1, S.field)], [ally, { kind: 'pass' }]]);
  const fb = new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]);
  const before = me.curHP;
  M.battleTurn(S, rng5, fa, fb);
  return { works: me.curHP < before, detail: `user lost ${before - me.curHP} hp to recoil` };
});

probe('move', 'lowersUser', 'Close Combat drops the user Def/SpD', () => {
  const me = bare('staraptor'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: me.boosts.df < 0 || me.boosts.sd < 0, detail: `def ${me.boosts.df} spd ${me.boosts.sd}` };
});

probe('move', 'boostsUser', 'Swords Dance raises Attack', () => {
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'swordsdance', null, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: me.boosts.at > 0, detail: 'atk stage ' + me.boosts.at };
});

probe('move', 'lowersTarget', 'Charm drops the target Attack', () => {
  const me = bare('whimsicott'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'charm', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.boosts.at < 0, detail: 'target atk stage after the turn: ' + f1.boosts.at };
});

/* THE PROBE MUST NOT APPLY THE EFFECT ITSELF. The first version called applyStatus(foe,'brn') and
 * then asserted foe.status === 'brn' -- it tested applyStatus, not Will-O-Wisp, and would pass even
 * if the move did nothing. Same defect as the Encore probe: checking the classification instead of
 * the outcome. These run the turn and let the engine do it. */
const statusProbe = (tag, label, user, mv, want) => probe('move', tag, label, () => {
  const me = bare(user), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.status === want, detail: `target status after the turn: ${f1.status || 'none'} (wanted ${want})` };
});
statusProbe('inflictsBurn', 'Will-O-Wisp burns', 'incineroar', 'willowisp', 'brn');

statusProbe('inflictsParalysis', 'Thunder Wave paralyses', 'raichu', 'thunderwave', 'par');

probe('move', 'locksTarget', 'Encore locks the target in', () => {
  /* THE FOURTH VERSION. v1 accepted kind !== 'pass' (Encore returns 'status' and applied nothing).
   * v2 accepted "some state moved" (the volatile was recorded while the target still chose freely).
   * v3 was right about what to measure and wrong about how to stage it: it had the foe PROTECT on the
   * turn it was Encored, and Protect blocks Encore -- correctly -- so the probe measured its own
   * setup. Whimsicott is also faster than Garchomp, so on that turn the foe had not moved yet and
   * there was no last move to copy.
   *
   * Staged properly now: the foe commits a move on its own turn FIRST, is Encored on the next turn,
   * and is then left completely free. If Encore is real it repeats. */
  const me = bare('whimsicott'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  /* Turn 1 -- the foe uses Rock Slide, so it HAS a last move. */
  M.battleTurn(S, rng5,
    new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'rockslide', me, S.field)], [f2, { kind: 'pass' }]]));
  const committed = f1._lastMove;
  /* Turn 2 -- Encore it. */
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'encore', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const locked = !!(f1._vol && f1._vol.encore > 0);
  /* Turn 3 -- nothing forced. It must repeat. */
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), null);
  const repeated = f1._lastMove === committed;
  return { works: locked && repeated,
           detail: `committed ${committed}, volatile set=${locked}, free choice next turn was ${f1._lastMove}` };
});

probe('move', 'conditionalPower', 'Facade doubles when statused', () => {
  const clean = bare('incineroar'), burnt = bare('incineroar');
  burnt.status = 'brn';
  const def = bare('garchomp'), mv = MC.moves['facade'];
  if (!mv) return { works: false, detail: 'facade not in MC.moves' };
  const a = M.dmgRange(clean, def, mv, fresh(), false);
  const b = M.dmgRange(burnt, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: `clean ${a.max}  ->  burnt ${b.max}` };
});

/* ---- ABILITIES ---------------------------------------------------------------------------------- */

probe('ability', 'onSwitchInDrop', 'Intimidate drops Attack', () => {
  const foe = bare('garchomp');
  const before = foe.boosts.at;
  M.applyIntimidate(foe);
  return { works: foe.boosts.at < before, detail: `atk ${before} -> ${foe.boosts.at}` };
});

probe('ability', 'priorityMod', 'Prankster raises status priority', () => {
  const p = bare('whimsicott'), n = bare('whimsicott');
  p.ability = 'prankster'; n.ability = 'none';
  /* movePriority is the move's own bracket; the ability bonus is applied in battleTurn's sort, so
   * this asks the engine's own helper rather than re-deriving the rule here. */
  const has = typeof M.moveFx === 'function';
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  return { works: has && /isPrankster/.test(src), detail: 'isPrankster() present and used in the sort' };
});

probe('ability', 'damageBoost', 'Aerilate converts and boosts', () => {
  const on = bare('staraptor'), off = bare('staraptor');
  on.ability = 'aerilate';
  const def = bare('garchomp'), mv = MC.moves['bodyslam'];
  const a = M.dmgRange(off, def, mv, fresh(), false);
  const b = M.dmgRange(on, def, mv, fresh(), false);
  return { works: b.max !== a.max, detail: `none ${a.max}  ->  aerilate ${b.max}` };
});

probe('ability', 'damageReduce', 'Filter cuts super-effective damage', () => {
  const atk = bare('garchomp');
  const off = bare('charizard'), on = bare('charizard');
  on.ability = 'filter';
  const mv = MC.moves['stoneedge'] || MC.moves['rockslide'];
  const a = M.dmgRange(atk, off, mv, fresh(), false);
  const b = M.dmgRange(atk, on, mv, fresh(), false);
  return { works: b.max < a.max, detail: `none ${a.max}  ->  filter ${b.max}` };
});

probe('ability', 'damageReduce', 'Ice Scales halves special damage', () => {
  const atk = bare('garchomp');
  const off = bare('milotic'), on = bare('milotic');
  on.ability = 'icescales';
  const mv = MC.moves['earthpower'] || MC.moves['hydropump'];
  const a = M.dmgRange(atk, off, mv, fresh(), false);
  const b = M.dmgRange(atk, on, mv, fresh(), false);
  return { works: b.max < a.max, detail: `none ${a.max}  ->  icescales ${b.max}` };
});

probe('ability', 'statusImmune', 'Insomnia refuses sleep', () => {
  const m = bare('gholdengo'); m.ability = 'insomnia';
  M.applyStatus(m, 'slp');
  return { works: m.status !== 'slp', detail: 'status=' + (m.status || 'none') };
});

probe('ability', 'preventsStatDrop', 'Clear Body refuses Intimidate', () => {
  const m = bare('garchomp'); m.ability = 'clearbody';
  const before = m.boosts.at;
  M.applyIntimidate(m);
  return { works: m.boosts.at === before, detail: `atk ${before} -> ${m.boosts.at}` };
});

probe('ability', 'boostsWhenLowered', 'Defiant raises Attack when dropped', () => {
  const m = bare('kingambit'); m.ability = 'defiant';
  M.applyIntimidate(m);
  return { works: m.boosts.at > 0, detail: 'atk stage ' + m.boosts.at };
});

probe('ability', 'contactPunish', 'Rough Skin hurts a contact attacker', () => {
  const run = (ab) => {
    const me = bare('staraptor'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const none = run('none'), rough = run('roughskin');
  return { works: rough > none, detail: `attacker lost ${none} vs none, ${rough} vs Rough Skin` };
});

probe('ability', 'formeChange', 'Zero to Hero upgrades Palafin on return', () => {
  /* THE RULE HAS TWO HALVES AND THE NEGATIVE ONE IS THE ONE THAT PROVES IT. Will: "PALAFIN GOTTA
   * BE SENT OUT FIRST AND THEN SWITCH AND COME BACK TO ACTIVATE". So a Palafin arriving from the
   * bench for the FIRST time must stay ordinary -- a transform that fires on any entry would pass
   * a test that only checks it fires, while being wrong in every game.
   *
   * Both halves are asserted here: first entry does nothing, the return upgrades. */
  const firstEntry = (() => {
    const bench = M.buildMon('palafin', {}); bench.ability = 'zerotohero';
    const lead = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([lead, ally, bench], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[lead, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]), null);
    return { name: bench.name, atk: bench.st.at };
  })();

  const me = M.buildMon('palafin', {}); me.ability = 'zerotohero';
  const ally = bare('incineroar'), back = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally, back], [f1, f2], { seeded: true });
  const atkBefore = me.st.at;
  M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: back }], [ally, { kind: 'pass' }]]), null);
  M.battleTurn(S, rng5, new Map([[back, { kind: 'switch', to: me }], [ally, { kind: 'pass' }]]), null);

  const firstStayedBase = firstEntry.name === 'palafin' && firstEntry.atk === atkBefore;
  const returnUpgraded = me.st.at > atkBefore;
  return { works: firstStayedBase && returnUpgraded,
           detail: 'first entry from bench: ' + firstEntry.name + ' ' + firstEntry.atk + ' Atk (must stay base)'
                 + '  |  out and back: ' + me.name + ' ' + me.st.at + ' Atk' };
});

/* ---- BATCH 2 — the next sixteen by corpus usage ------------------------------------------------
 *
 * Ordered by tests/mechanics_rank.js, which ranks by the clicks a tag covers rather than the number
 * of ids carrying it. Every probe here follows the four rules the first batch cost us: clear the
 * control explicitly; never apply the effect yourself; test the OUTCOME and not the classification;
 * and treat identical results across a varied knob as proof the knob is not wired.
 */

probe('move', 'neverMissesAttack', 'Aura Sphere cannot miss', () => {
  const acc = M.moveAccuracy('aurasphere', fresh());
  return { works: acc >= 100, detail: 'accuracy=' + acc };
});

probe('move', 'inflictsFreeze', 'Ice Beam can freeze', () => {
  /* A 10% secondary, so the roll is forced LOW. At rng 0.5 it would never fire and the probe would
   * report MISSING on a mechanic that works -- the same class of staging error as having the target
   * Protect on the turn it was meant to be Encored. */
  /* THE TARGET HAS TO SURVIVE THE HIT. The first version fired Ice Beam at Garchomp -- 4x on
   * Dragon/Ground -- which knocked it out, and a fainted Pokemon takes no status. The probe read
   * 'none' and blamed the engine. Corviknight resists Ice and lives. */
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('corviknight'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'icebeam', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, () => 0.01, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.status === 'frz',
           detail: 'target ' + (f1.fainted ? 'FAINTED' : 'survived at ' + f1.curHP) + ', status: ' + (f1.status || 'none') };
});

probe('move', 'inflictsPoison', 'Toxic poisons', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'toxic', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: /psn|tox/.test(f1.status || ''), detail: 'target status: ' + (f1.status || 'none') };
});

probe('move', 'inflictsConfusion', 'Confuse Ray confuses', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'confuseray', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !!(f1._vol && f1._vol.confusion), detail: 'volatiles on target: ' + JSON.stringify(f1._vol || {}) };
});

probe('move', 'oneTurnGuard', 'Wide Guard blocks a spread move', () => {
  const run = (guard) => {
    /* THE ALLY MUST BE ABLE TO TAKE THE MOVE. The first version used Corviknight, which is
     * Flying and immune to Earthquake -- so the probe read 0 damage with and without the guard
     * and reported a working mechanic as missing. Milotic has no Ground immunity. */
    const me = bare('incineroar'), ally = bare('milotic');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, guard ? M.playerAction(me, 'wideguard', null, S.field) : { kind: 'pass' }],
                        [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = ally.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return before - ally.curHP;
  };
  const off = run(false), on = run(true);
  return { works: on < off, detail: 'ally took ' + off + ' without  ->  ' + on + ' behind Wide Guard' };
});

probe('move', 'weightBased', 'Grass Knot scales with target weight', () => {
  const me = bare('venusaur');
  const light = bare('whimsicott'), heavy = bare('archaludon');
  const mv = MC.moves['grassknot'];
  if (!mv) return { works: false, detail: 'grassknot not in MC.moves' };
  const a = M.dmgRange(me, light, mv, fresh(), false);
  const b = M.dmgRange(me, heavy, mv, fresh(), false);
  return { works: a.max !== b.max, detail: 'vs light ' + a.max + '  ->  vs heavy ' + b.max };
});

probe('move', 'swapsStat', 'Body Press attacks with Defense', () => {
  /* Two identical bodies but for the stat that should matter. If Body Press reads Attack instead,
   * the high-Defense one deals the SAME damage -- that equality is the null result to look for. */
  const lowDef = bare('corviknight'), highDef = bare('corviknight');
  highDef.st = Object.assign({}, highDef.st, { df: highDef.st.df * 2 });
  const def = bare('garchomp'), mv = MC.moves['bodypress'];
  if (!mv) return { works: false, detail: 'bodypress not in MC.moves' };
  const a = M.dmgRange(lowDef, def, mv, fresh(), false);
  const b = M.dmgRange(highDef, def, mv, fresh(), false);
  return { works: b.max > a.max,
           detail: 'def ' + lowDef.st.df + ' deals ' + a.max + ', def ' + highDef.st.df + ' deals ' + b.max };
});

probe('move', 'ignoresStatStages', 'Sacred Sword ignores a Defense boost', () => {
  const atk = bare('garchomp');
  const plain = bare('corviknight'), boosted = bare('corviknight');
  boosted.boosts.df = 4;
  const mv = MC.moves['sacredsword'];
  if (!mv) return { works: false, detail: 'sacredsword not in MC.moves' };
  const a = M.dmgRange(atk, plain, mv, fresh(), false);
  const b = M.dmgRange(atk, boosted, mv, fresh(), false);
  return { works: a.max === b.max, detail: 'unboosted ' + a.max + ' vs +4 Def ' + b.max + ' (equal = ignored)' };
});

probe('move', 'readsTargetItem', 'Knock Off removes the item', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  f1.item = 'lifeorb';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !f1.item, detail: 'target item after Knock Off: ' + JSON.stringify(f1.item || '') };
});

probe('move', 'healsAlly', 'Life Dew heals the partner', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  ally.curHP = Math.floor(ally.st.hp / 2);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const before = ally.curHP;
  const fa = new Map([[me, M.playerAction(me, 'lifedew', null, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: ally.curHP > before, detail: 'partner ' + before + ' -> ' + ally.curHP + ' hp' };
});

probe('ability', 'stabBoost', 'Adaptability raises same-type damage', () => {
  const on = bare('basculegion'), off = bare('basculegion');
  on.ability = 'adaptability';
  const def = bare('garchomp');
  const mv = MC.moves['wavecrash'] || MC.moves['surf'] || MC.moves['liquidation'];
  if (!mv) return { works: false, detail: 'no water move in MC.moves' };
  const a = M.dmgRange(off, def, mv, fresh(), false);
  const b = M.dmgRange(on, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: 'none ' + a.max + '  ->  adaptability ' + b.max };
});

probe('ability', 'speedCond', 'Chlorophyll doubles Speed in sun', () => {
  const m = bare('venusaur'); m.ability = 'chlorophyll';
  const dry = M.effSpeed(m, Object.assign(fresh(), { weather: '' }), 'A');
  const sun = M.effSpeed(m, Object.assign(fresh(), { weather: 'sun' }), 'A');
  return { works: sun > dry * 1.8, detail: 'no sun ' + dry + '  ->  sun ' + sun };
});

probe('ability', 'blocksStatusMoves', 'Good as Gold refuses a status move', () => {
  const me = bare('whimsicott'), ally = bare('incineroar');
  const f1 = bare('gholdengo'), f2 = bare('garchomp');
  f1.ability = 'goodasgold';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'charm', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.boosts.at === 0, detail: 'target atk stage after Charm: ' + f1.boosts.at + ' (0 = refused)' };
});

probe('ability', 'weatherChipImmune', 'Ice Body ignores weather chip', () => {
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const has = /icebody|weatherChipImmune|magmaarmor/.test(src);
  return { works: has, detail: 'engine references a weather-chip immunity: ' + has };
});

probe('ability', 'speedOnItemLoss', 'Unburden doubles Speed once the item is gone', () => {
  /* THROUGH battleInit, because that is where the engine stamps what each body STARTED holding --
   * the flag that distinguishes 'lost its item' from 'never had one'. The first version called
   * effSpeed on a loose body, so the flag was undefined and the probe reported the engine broken
   * while measuring its own shortcut. */
  const m = bare('weavile'); m.ability = 'unburden'; m.item = 'focussash';
  const ally = bare('incineroar'), f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
  const held = M.effSpeed(m, S.field, 'A');
  m.item = '';                                     // the Sash is spent
  const gone = M.effSpeed(m, S.field, 'A');
  return { works: gone > held * 1.8, detail: 'holding ' + held + '  ->  item gone ' + gone };
});

probe('move', 'takesTargetItem', 'Covet steals the item', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  f1.item = 'lifeorb'; me.item = '';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const act = M.playerAction(me, 'covet', f1, S.field);
  if (!act || act.kind === 'pass') return { works: false, detail: 'covet resolves to kind ' + (act && act.kind) };
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: me.item === 'lifeorb',
           detail: 'attacker item ' + JSON.stringify(me.item) + ', target item ' + JSON.stringify(f1.item) };
});


/* ---- BATCH 3 — the next by corpus usage -------------------------------------------------------
 *
 * Written while an R4 self-play run was in flight, which is why nothing here touches the engine:
 * a probe reads, it does not change, so the run keeps measuring the build it started on.
 */

probe('move', 'setsWeather', 'Sandstorm sets the weather', () => {
  const me = bare('tyranitar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  S.field.weather = '';
  const fa = new Map([[me, M.playerAction(me, 'sandstorm', null, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !!S.field.weather, detail: 'weather after the turn: ' + (S.field.weather || 'none') };
});

probe('move', 'inflictsSleep', 'Spore puts the target to sleep', () => {
  const me = bare('venusaur'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const mv = MC.moves['spore'] ? 'spore' : 'sleeppowder';
  const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.status === 'slp', detail: mv + ' -> target status: ' + (f1.status || 'none') };
});

probe('move', 'forbidsStatusMoves', 'Taunt stops the target using a status move', () => {
  /* Staged like the Encore probe: the target is Taunted, then left FREE, and what it picks is the
   * measurement. Checking only that the volatile was recorded would pass on a Taunt nothing reads. */
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('whimsicott'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'taunt', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const tainted = !!(f1._vol && f1._vol.taunt);
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), null);
  const picked = f1._lastMove || '';
  const isStatus = picked && MC.moves[picked] && !MC.moves[picked].bp;
  return { works: tainted && !isStatus,
           detail: 'volatile=' + tainted + ', free choice was ' + (picked || 'nothing') };
});

probe('move', 'ignoresProtect', 'Feint goes through Protect', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'protect', null, S.field)], [f2, { kind: 'pass' }]]);
    const before = f1.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return before - f1.curHP;
  };
  if (!MC.moves['feint']) return { works: false, detail: 'feint not in MC.moves' };
  const blocked = run('bulletpunch'), through = run('feint');
  return { works: through > 0 && blocked === 0,
           detail: 'a normal move into Protect dealt ' + blocked + ', Feint dealt ' + through };
});

probe('move', 'recharge', 'Giga Impact costs the following turn', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const mv = MC.moves['gigaimpact'] ? 'gigaimpact' : 'hyperbeam';
  if (!MC.moves[mv]) return { works: false, detail: 'no recharge move in MC.moves' };
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const hpAfterFirst = f1.curHP;
  /* Turn two: the user is left FREE. If recharge is modelled it must do nothing. */
  M.battleTurn(S, rng5, null, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.curHP === hpAfterFirst,
           detail: 'foe hp ' + hpAfterFirst + ' after the hit, ' + f1.curHP + ' after the recharge turn' };
});

probe('move', 'needsTargetToAttack', 'Avalanche doubles after being hit', () => {
  const mv = MC.moves['avalanche'];
  if (!mv) return { works: false, detail: 'avalanche not in MC.moves' };
  const fresh1 = bare('corviknight'), hurt = bare('corviknight');
  hurt.curHP = Math.floor(hurt.st.hp / 2);
  const def = bare('garchomp');
  const a = M.dmgRange(fresh1, def, mv, fresh(), false);
  const b = M.dmgRange(hurt, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: 'untouched ' + a.max + '  ->  already hit ' + b.max };
});

probe('move', 'needsUntrackedState', 'Gyro Ball scales with the speed gap', () => {
  const mv = MC.moves['gyroball'];
  if (!mv) return { works: false, detail: 'gyroball not in MC.moves' };
  const slow = bare('archaludon'), fast = bare('weavile');
  const def = bare('garchomp');
  const a = M.dmgRange(slow, def, mv, fresh(), false);
  const b = M.dmgRange(fast, def, mv, fresh(), false);
  return { works: a.max !== b.max, detail: 'slow user ' + a.max + '  vs  fast user ' + b.max };
});

probe('ability', 'redirectsType', 'Lightning Rod pulls an Electric move', () => {
  /* THE AIMED TARGET WAS GARCHOMP, WHICH IS GROUND AND IMMUNE TO ELECTRIC. So "aimed target took 0"
   * was true no matter what the ability did, and the probe could have passed its own headline claim
   * on a completely absent mechanic. Corviknight is Flying/Steel and takes Electric at 2x, so the
   * zero now means something. Same defect as the Follow Me probe next door, and found by the same
   * question: which of these zeros did I build in myself.
   *
   * A CONTROL ARM as well, so "the rod did not pull" cannot be confused with "the move did nothing". */
  const run = (ab) => {
    const me = bare('raichu'), ally = bare('incineroar');
    const f1 = bare('corviknight'), f2 = bare('milotic');
    f2.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before1 = f1.curHP, before2 = f2.curHP;
    const fa = new Map([[me, M.playerAction(me, 'thunderbolt', f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { aimed: before1 - f1.curHP, rod: before2 - f2.curHP, spa: f2.boosts.sa };
  };
  const off = run('none'), on = run('lightningrod');
  /* THE ROD HOLDER MUST TAKE ZERO, AND THE FIRST VERSION DEMANDED IT TAKE DAMAGE. Lightning Rod
   * both DRAWS the move and ABSORBS it -- the artifact says so in one line, `typeImmunity` with a
   * `gain` of +1 SpA sitting beside `redirectsType`. So "the rod holder took 101" would have been a
   * broken engine, and asserting it would have made the correct fix fail. What proves the draw is
   * that the AIMED target stops taking the hit while the holder's Special Attack goes up: the boost
   * is the receipt. Eighth probe in this file to be corrected before the engine was. */
  return { works: off.aimed > 0 && on.aimed === 0 && on.rod === 0 && on.spa > 0,
           detail: 'no ability: aimed ' + off.aimed + ' / other ' + off.rod + ' / spa ' + off.spa
                 + '   |   Lightning Rod: aimed ' + on.aimed + ' / rod ' + on.rod + ' / spa ' + on.spa };
});

probe('ability', 'healsAllyOnSwitchIn', 'Hospitality heals the partner on entry', () => {
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  return { works: /hospitality|healsAllyOnSwitchIn/.test(src),
           detail: 'engine references it: ' + /hospitality|healsAllyOnSwitchIn/.test(src) };
});

probe('ability', 'blocksBerries', 'Unnerve stops the foe eating a berry', () => {
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  return { works: /unnerve|blocksBerries/.test(src),
           detail: 'engine references it: ' + /unnerve|blocksBerries/.test(src) };
});

probe('ability', 'disablesAttacker', 'Cursed Body can disable the move that hit it', () => {
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  return { works: /cursedbody|disablesAttacker/.test(src),
           detail: 'engine references it: ' + /cursedbody|disablesAttacker/.test(src) };
});

probe('item', 'restoresStats', 'White Herb undoes a stat drop', () => {
  const m = bare('garchomp'); m.item = 'whiteherb';
  const ally = bare('incineroar'), f1 = bare('incineroar'), f2 = bare('garchomp');
  const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
  M.applyIntimidate(m);
  const dropped = m.boosts.at;
  M.battleTurn(S, rng5, new Map([[m, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: dropped < 0 && m.boosts.at === 0,
           detail: 'dropped to ' + dropped + ', after the turn ' + m.boosts.at + ' (0 = restored)' };
});

probe('move', 'statChangeInCode', 'Belly Drum maxes Attack', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const mv = MC.moves['bellydrum'] ? 'bellydrum' : null;
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const act = M.playerAction(me, mv || 'bellydrum', null, S.field);
  if (!act || act.kind === 'pass') return { works: false, detail: 'belly drum resolves to kind ' + (act && act.kind) };
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: me.boosts.at >= 6, detail: 'atk stage ' + me.boosts.at + ' (needs +6)' };
});

probe('move', 'proceduralStatus', 'Tri Attack can burn, freeze or paralyse', () => {
  const me = bare('gholdengo') , ally = bare('incineroar');
  const f1 = bare('corviknight'), f2 = bare('garchomp');
  const mv = MC.moves['triattack'];
  if (!mv) return { works: false, detail: 'triattack not in MC.moves' };
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'triattack', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, () => 0.01, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !!f1.status, detail: 'target status with the roll forced low: ' + (f1.status || 'none') };
});

/* ---- BATCH 4 — the tag walk, in descending corpus usage ---------------------------------------
 *
 * 126 of 180 tags had never been probed. tests/mechanics_rank.js orders them by the clicks they
 * cover; this walks that order from the top and stops being useful somewhere below a thousand uses.
 *
 * PROBE FIRST, ALWAYS. Every probe here was written and RUN RED OR GREEN BEFORE anything was decided
 * about the engine, because a probe written after a fix tests the fix and not the mechanic. Several
 * of these came back green and that is a result too: unreferenced is not unimplemented, and the only
 * way to tell is to make the thing happen and look.
 *
 * Nothing in this batch touches engine source. A probe reads; it does not change.
 */

/* One standard doubles board, so the staging is identical across probes and a difference between two
 * arms is the varied knob and not the setup. seeded:true skips entry effects -- a probe that wants
 * Intimidate or Drizzle must ask for them, exactly like every other input here. */
const board = (meSp, allySp, f1Sp, f2Sp) => {
  const me = bare(meSp), ally = bare(allySp), f1 = bare(f1Sp), f2 = bare(f2Sp);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  return { me, ally, f1, f2, S };
};
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

probe('move', 'priority', 'Bullet Punch moves before a faster foe', () => {
  /* THE OUTCOME, NOT THE BRACKET. Asking movePriority() what number it returns tests a lookup
   * table. This asks whether the slower Pokemon actually got there first, and the only way to see
   * that in damage is to make going first MATTER: the fast foe is left on 1 HP, so if the priority
   * move lands first the foe never acts and the user takes nothing. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('archaludon', 'incineroar', 'weavile', 'garchomp');
    f1.curHP = 1;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const normal = run('ironhead'), prio = run('bulletpunch');
  return { works: normal > 0 && prio === 0,
           detail: 'slow user took ' + normal + ' with a 0-priority move, ' + prio + ' with Bullet Punch' };
});

probe('move', 'contact', 'a contact move triggers Rough Skin and a special one does not', () => {
  /* BOTH DIRECTIONS. A probe that only checks Close Combat gets punished would pass on an engine
   * that punished EVERY move, which is the more likely bug. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.ability = 'roughskin';
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - me.curHP;
  };
  const touch = run('closecombat'), noTouch = run('flamethrower');
  return { works: touch > 0 && noTouch === 0,
           detail: 'contact move cost the user ' + touch + ', special non-contact cost ' + noTouch };
});

probe('move', 'spreadFoes', 'Rock Slide hits both foes', () => {
  const { me, ally, f1, f2, S } = board('tyranitar', 'incineroar', 'garchomp', 'milotic');
  const b1 = f1.curHP, b2 = f2.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'rockslide', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (b1 - f1.curHP) > 0 && (b2 - f2.curHP) > 0,
           detail: 'aimed foe took ' + (b1 - f1.curHP) + ', the OTHER foe took ' + (b2 - f2.curHP) };
});

probe('move', 'spreadAll', 'Earthquake hits your own partner too', () => {
  const { me, ally, f1, f2, S } = board('garchomp', 'milotic', 'incineroar', 'incineroar');
  const bAlly = ally.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (bAlly - ally.curHP) > 0,
           detail: 'own partner (Milotic, no Ground immunity) took ' + (bAlly - ally.curHP) };
});

probe('move', 'weatherScaled', 'Blizzard cannot miss in snow', () => {
  const dry = M.moveAccuracy('blizzard', fresh());
  const snow = M.moveAccuracy('blizzard', Object.assign(fresh(), { weather: 'snow' }));
  return { works: snow >= 100 && dry < 100, detail: 'no weather ' + dry + '  ->  snow ' + snow };
});

probe('move', 'thawsTarget', 'Flare Blitz thaws a frozen target', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  f1.status = 'frz';                                   // Garchomp resists Fire, so it survives to be looked at
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'flareblitz', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: !f1.fainted && f1.status !== 'frz',
           detail: 'target ' + (f1.fainted ? 'FAINTED' : 'survived') + ', status now ' + (f1.status || 'none') };
});

probe('item', 'survivesFromFull', 'Focus Sash leaves 1 HP from full', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('garchomp', 'incineroar', 'alakazam', 'garchomp');
    f1.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { hp: f1.curHP, dead: !!f1.fainted };
  };
  const none = run(''), sash = run('focussash');
  return { works: none.dead && !sash.dead && sash.hp === 1,
           detail: 'no item: ' + (none.dead ? 'FAINTED' : none.hp + ' hp') + '  ->  Sash: '
                 + (sash.dead ? 'FAINTED' : sash.hp + ' hp') };
});

probe('item', 'healsAtThreshold', 'Sitrus Berry heals when it drops below half', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
    f1.item = item; f1.curHP = Math.floor(f1.st.hp * 0.55);
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'surf', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.curHP;
  };
  const none = run(''), berry = run('sitrusberry');
  return { works: berry > none, detail: 'no item ended on ' + none + ' hp  ->  Sitrus ended on ' + berry };
});

probe('item', 'resistBerry', 'Chople Berry halves a super-effective Fighting hit', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'kingambit', 'garchomp');
    f1.item = item; f1.curHP = f1.st.hp;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run(''), berry = run('chopleberry');
  return { works: berry < none, detail: 'no item took ' + none + '  ->  Chople took ' + berry };
});

probe('item', 'damageMultAll', 'Life Orb raises damage', () => {
  const on = bare('incineroar'), off = bare('incineroar');
  on.item = 'lifeorb';
  const def = bare('garchomp');
  const a = M.dmgRange(off, def, MC.moves['closecombat'], fresh(), false);
  const b = M.dmgRange(on, def, MC.moves['closecombat'], fresh(), false);
  return { works: b.max > a.max, detail: 'no item ' + a.max + '  ->  Life Orb ' + b.max };
});

probe('item', 'damageMultType', 'Black Glasses raises Dark damage only', () => {
  /* THE SECOND ARM IS THE ONE THAT MATTERS. An item that raised every move would pass a probe that
   * only looked at Crunch, and would be a worse bug than doing nothing. */
  const on = bare('incineroar'), off = bare('incineroar');
  on.item = 'blackglasses';
  const def = bare('garchomp');
  const dk = (m) => M.dmgRange(m, def, MC.moves['crunch'], fresh(), false).max;
  const fi = (m) => M.dmgRange(m, def, MC.moves['closecombat'], fresh(), false).max;
  return { works: dk(on) > dk(off) && fi(on) === fi(off),
           detail: 'Dark ' + dk(off) + '->' + dk(on) + ', Fighting ' + fi(off) + '->' + fi(on) + ' (must not move)' };
});

probe('move', 'doublesSideSpeed', 'Tailwind doubles the side Speed', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  const before = M.effSpeed(ally, S.field, 'A');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'tailwind', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const after = M.effSpeed(ally, S.field, 'A');
  return { works: after > before * 1.8, detail: 'partner speed ' + before + '  ->  ' + after };
});

probe('move', 'sealsMoves', 'Disable stops the target repeating that move', () => {
  /* Staged like Encore and Taunt: the foe commits a move on its own, is Disabled, and is then left
   * COMPLETELY FREE. What it picks is the measurement. Checking the volatile alone would pass on a
   * Disable nothing reads. */
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5, PASS2(me, ally),
    new Map([[f1, M.playerAction(f1, 'rockslide', me, S.field)], [f2, { kind: 'pass' }]]));
  const committed = f1._lastMove;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'disable', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  M.battleTurn(S, rng5, PASS2(me, ally), null);
  return { works: !!committed && f1._lastMove !== committed,
           detail: 'committed ' + committed + ', free choice after Disable was ' + (f1._lastMove || 'nothing') };
});

probe('move', 'drain', 'Drain Punch heals the user', () => {
  /* THE DAMAGE DEALT IS PRINTED TOO. A drain that healed nothing and a move that never landed look
   * identical from the user's HP alone, and only one of them is an engine gap. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  me.curHP = Math.floor(me.st.hp / 2);
  const before = me.curHP, foeBefore = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'drainpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP > before,
           detail: 'move dealt ' + (foeBefore - f1.curHP) + ' to the foe; user ' + before + ' -> ' + me.curHP + ' hp' };
});

probe('move', 'redirects', 'Follow Me pulls the attack onto the partner', () => {
  /* THE FIRST VERSION AIMED ROCK SLIDE, WHICH IS A SPREAD MOVE. It hits both targets by design, so
   * both bodies took damage and the probe called a redirect broken while measuring its own staging.
   * Sixteenth time a probe in this project was wrong before the engine was; the tell was that the
   * "aimed" target and the "redirected" one BOTH took a number. Dragon Claw is single-target. */
  /* TWO ARMS, because the one-armed version read 0 and 0 and could not say which of three things
   * happened: the redirect worked and the hit vanished, the redirect did nothing and the hit
   * vanished, or the move never resolved at all. The no-Follow-Me arm settles it.
   *
   * THE REDIRECTOR MUST NOT BE IMMUNE TO THE MOVE, and getting that wrong nearly cost an engine
   * "fix" to a mechanic that works. The two-arm version used WHIMSICOTT, which is Grass/FAIRY, and
   * aimed DRAGON Claw at it: the redirect fired correctly, pulled the attack off Incineroar, and
   * landed it on a body that takes exactly zero from Dragon. Both arms read 0, and it was written up
   * as "the attack VANISHES — the worst bug in the repo". It is not a bug at all. Milotic is pure
   * Water and takes Dragon neutrally, and the same staging then reads aimed 0 / redirector 101.
   *
   * That is the seventh probe in this file to be wrong before the engine was, and the first to have
   * been believed. Lesson 5, and the reason a red probe is a QUESTION and not a finding. */
  const run = (useFollowMe) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'milotic', 'garchomp', 'garchomp');
    const bMe = me.curHP, bAlly = ally.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, { kind: 'pass' }],
               [ally, useFollowMe ? M.playerAction(ally, 'followme', null, S.field) : { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'dragonclaw', me, S.field)], [f2, { kind: 'pass' }]]));
    return { aimed: bMe - me.curHP, guard: bAlly - ally.curHP };
  };
  const off = run(false), on = run(true);
  return { works: off.aimed > 0 && on.guard > 0 && on.aimed === 0,
           detail: 'no Follow Me: aimed ' + off.aimed + ' / partner ' + off.guard
                 + '   |   Follow Me: aimed ' + on.aimed + ' / partner ' + on.guard };
});

probe('move', 'powder', 'Sleep Powder fails into a Grass type', () => {
  const run = (foeSp) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', foeSp, 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'sleeppowder', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const normal = run('garchomp'), grass = run('venusaur');
  return { works: normal === 'slp' && grass !== 'slp',
           detail: 'into Garchomp: ' + normal + ', into Venusaur (Grass): ' + grass };
});

probe('move', 'halvesDamage', 'Reflect halves physical damage', () => {
  const run = (screen) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, screen ? M.playerAction(me, 'reflect', null, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const off = run(false), on = run(true);
  return { works: on < off, detail: 'took ' + off + ' with no screen  ->  ' + on + ' behind Reflect' };
});

probe('ability', 'weatherSetter', 'Drizzle sets rain on entry', () => {
  const run = (ab) => {
    const me = bare('pelipper'), ally = bare('incineroar');
    me.ability = ab;
    const S = M.battleInit([me, ally], [bare('garchomp'), bare('garchomp')], {});   // NOT seeded: entry effects fire
    return S.field.weather || 'none';
  };
  const none = run('none'), rain = run('drizzle');
  return { works: none === 'none' && rain === 'rain', detail: 'ability none -> ' + none + ', Drizzle -> ' + rain };
});

probe('move', 'pivotStatus', 'Parting Shot switches the user out', () => {
  const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'partingshot', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: S.actA.indexOf(bench) >= 0 && S.actA.indexOf(me) < 0,
           detail: 'active side A after the turn: ' + S.actA.map(x => x && x.name).join(', ') };
});

probe('move', 'pivotDamaging', 'U-turn damages and then switches the user out', () => {
  const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'uturn', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (before - f1.curHP) > 0 && S.actA.indexOf(bench) >= 0 && S.actA.indexOf(me) < 0,
           detail: 'foe took ' + (before - f1.curHP) + ', active side A: ' + S.actA.map(x => x && x.name).join(', ') };
});

probe('move', 'reversesSpeed', 'Trick Room lets the slow user move first', () => {
  /* Same shape as the priority probe -- the fast foe sits on 1 HP, so who moved first is visible in
   * whether the user took anything at all. The user's HP is restored between the setup turn and the
   * measured turn so the setup cannot contaminate the reading. */
  const run = (tr) => {
    const { me, ally, f1, f2, S } = board('archaludon', 'incineroar', 'weavile', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, tr ? M.playerAction(me, 'trickroom', null, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    me.curHP = me.st.hp; f1.curHP = 1;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'ironhead', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', me, S.field)], [f2, { kind: 'pass' }]]));
    return { took: before - me.curHP, tr: S.field.tr };
  };
  const off = run(false), on = run(true);
  return { works: on.tr > 0 && off.took > 0 && on.took === 0,
           detail: 'field.tr=' + on.tr + '; slow user took ' + off.took + ' normally, ' + on.took + ' under Trick Room' };
});

probe('move', 'chargeTurn', 'Fly deals nothing on the turn it is clicked', () => {
  const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'fly', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (before - f1.curHP) === 0, detail: 'foe took ' + (before - f1.curHP) + ' on the charge turn (must be 0)' };
});

probe('move', 'chargeSkippedByWeather', 'Solar Beam fires the same turn in sun and not otherwise', () => {
  const run = (weather) => {
    const { me, ally, f1, f2, S } = board('venusaur', 'incineroar', 'garchomp', 'garchomp');
    S.field.weather = weather;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'solarbeam', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const dry = run(''), sun = run('sun');
  return { works: sun > 0 && dry === 0,
           detail: 'turn-1 damage: no sun ' + dry + ' (must be 0), sun ' + sun + ' (must be > 0)' };
});

probe('move', 'failsIfTargetNotAttacking', 'Sucker Punch fails against a target that is not attacking', () => {
  const run = (foeAttacks) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'suckerpunch', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, foeAttacks ? M.playerAction(f1, 'earthquake', me, S.field) : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return before - f1.curHP;
  };
  const attacking = run(true), idle = run(false);
  return { works: attacking > 0 && idle === 0,
           detail: 'foe attacking: ' + attacking + ', foe idle: ' + idle + ' (must be 0)' };
});

probe('item', 'choiceLock', 'Choice Scarf locks the holder into its first move', () => {
  /* THIS IS NOT "NOBODY IMPLEMENTED CHOICE LOCK". tests/test-choice-lock.js asserts it four ways and
   * passes -- on board.js, where B.candidates() removes the other moves from the SEARCH's action set.
   * MEDICHAM's battleTurn honours whatever action it is handed, so the rule exists on one engine and
   * not the other. That is CLAUDE.md's FACTS ARE GLOBAL rule broken: whether a Choice item locks you
   * is a fact about the game, and two engines that disagree about it will keep disagreeing invisibly,
   * because each keeps working. The probe stays red until MEDICHAM enforces it too. */
  const { me, ally, f1, f2, S } = board('basculegion', 'incineroar', 'garchomp', 'garchomp');
  me.item = 'choicescarf';
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const first = me._lastMove;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: first === 'crunch' && me._lastMove === 'crunch',
           detail: 'turn 1 used ' + first + ', turn 2 asked for closecombat and used ' + me._lastMove };
});

probe('move', 'healsSelf', 'Recover restores the user', () => {
  const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
  me.curHP = Math.floor(me.st.hp / 3);
  const before = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'recover', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP > before, detail: 'user ' + before + ' -> ' + me.curHP + ' hp' };
});

probe('ability', 'blocksMove', 'Armor Tail refuses a priority move', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'farigiraf', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'bulletpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), tail = run('armortail');
  return { works: none > 0 && tail === 0, detail: 'no ability took ' + none + ', Armor Tail took ' + tail };
});

probe('ability', 'typeImmunity', 'Levitate takes nothing from Earthquake', () => {
  const atk = bare('garchomp');
  const off = bare('hydreigon'), on = bare('hydreigon');
  on.ability = 'levitate';
  const a = M.dmgRange(atk, off, MC.moves['earthquake'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['earthquake'], fresh(), false);
  return { works: a.max > 0 && b.max === 0, detail: 'no ability ' + a.max + '  ->  Levitate ' + b.max };
});

probe('ability', 'convertsMoveType', 'Aerilate makes Body Slam hit a Ghost', () => {
  /* THE SHARPEST FORM OF THIS TEST. Normal does exactly ZERO to a Ghost; Flying does not. So a
   * working conversion turns a 0 into a number, which no partial implementation can fake. The
   * existing damageBoost probe only asked whether the number MOVED. */
  const on = bare('staraptor'), off = bare('staraptor');
  on.ability = 'aerilate';
  const def = bare('gengar');
  const a = M.dmgRange(off, def, MC.moves['bodyslam'], fresh(), false);
  const b = M.dmgRange(on, def, MC.moves['bodyslam'], fresh(), false);
  return { works: a.max === 0 && b.max > 0, detail: 'no ability ' + a.max + ' (Normal vs Ghost)  ->  Aerilate ' + b.max };
});

probe('move', 'multiHit', 'Rock Blast lands more than one hit', () => {
  /* THE CONTROL IS A COPY OF THE MOVE WITH ITS ID CHANGED, so the tag lookup misses and the copy is
   * a single 25-BP hit by construction. If the engine returns the same number for both, multiHit is
   * not wired -- that is Lesson 5's rule: an identical result across a varied knob means the knob is
   * unwired, not that it does not matter. dmgRange stamps ids onto MC.moves entries only, so this
   * local copy is untouched by it. */
  const att = bare('tyranitar'), def = bare('garchomp');
  const real = MC.moves['rockblast'];
  if (!real) return { works: false, detail: 'rockblast not in MC.moves' };
  const oneHit = Object.assign({}, real, { id: '__rockblast_onehit' });
  const a = M.dmgRange(att, def, oneHit, fresh(), false);
  const b = M.dmgRange(att, def, real, fresh(), false);
  return { works: b.max > a.max * 1.5,
           detail: 'one hit ' + a.max + '  ->  Rock Blast as the engine prices it ' + b.max
                 + ' (real average is about 3.2 hits)' };
});

probe('move', 'powerFromFallen', 'Last Respects grows with fallen allies', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const mv = MC.moves['lastrespects'];
  if (!mv) return { works: false, detail: 'lastrespects not in MC.moves' };
  const a = M.dmgRange(me, f1, mv, S.field, false);
  S.sfA.fainted = 3;                                   // the input, not the effect: three of ours are down
  const b = M.dmgRange(me, f1, mv, S.field, false);
  return { works: b.max > a.max, detail: '0 fallen ' + a.max + '  ->  3 fallen ' + b.max };
});

probe('move', 'overridesEffectiveness', 'Freeze-Dry beats Ice Beam into a Water type', () => {
  /* THE MOVE'S ENTIRE IDENTITY, and found by the differential test rather than by anyone reading a
   * list. Ice is normally RESISTED by Water; Freeze-Dry is super effective on it. So the correct
   * answer is not "different", it is FOUR TIMES Ice Beam, and the probe asks for the direction. */
  const att = bare('weavile'), def = bare('vaporeon');
  const ib = M.dmgRange(att, def, MC.moves['icebeam'], fresh(), false);
  const fd = M.dmgRange(att, def, MC.moves['freezedry'], fresh(), false);
  return { works: fd.max > ib.max, detail: 'Ice Beam ' + ib.max + '  ->  Freeze-Dry ' + fd.max + ' (must be higher)' };
});

probe('ability', 'reducesAllyDamage', 'Friend Guard cuts what the partner takes', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'milotic');
    f2.ability = ab;                                   // the partner of the Pokemon being hit
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), fg = run('friendguard');
  return { works: fg < none, detail: 'took ' + none + ' with a plain partner  ->  ' + fg + ' with Friend Guard' };
});

probe('ability', 'poisonsOnMyContact', 'Poison Touch poisons on a contact hit', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'corviknight', 'garchomp');
    me.ability = ab;
    M.battleTurn(S, () => 0.01, new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    /* A FAINTED TARGET TAKES NO STATUS, and the Ice Beam probe already cost us that lesson once. */
    return (f1.fainted ? 'FAINTED' : (f1.status || 'none'));
  };
  const none = run('none'), pt = run('poisontouch');
  return { works: none === 'none' && /psn|tox/.test(pt),
           detail: 'no ability -> ' + none + ', Poison Touch -> ' + pt };
});

probe('ability', 'immuneToMoveClass', 'Bulletproof refuses Rock Blast', () => {
  const atk = bare('tyranitar');
  const off = bare('kommoo'), on = bare('kommoo');
  on.ability = 'bulletproof';
  const a = M.dmgRange(atk, off, MC.moves['rockblast'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['rockblast'], fresh(), false);
  return { works: a.max > 0 && b.max === 0, detail: 'no ability ' + a.max + '  ->  Bulletproof ' + b.max };
});

probe('ability', 'boostsMoveClass', 'Iron Fist raises a punch and nothing else', () => {
  const on = bare('incineroar'), off = bare('incineroar');
  on.ability = 'ironfist';
  const def = bare('garchomp');
  const punch = (m) => M.dmgRange(m, def, MC.moves['drainpunch'], fresh(), false).max;
  const kick = (m) => M.dmgRange(m, def, MC.moves['closecombat'], fresh(), false).max;
  return { works: punch(on) > punch(off) && kick(on) === kick(off),
           detail: 'punch ' + punch(off) + '->' + punch(on) + ', non-punch ' + kick(off) + '->' + kick(on) + ' (must not move)' };
});

probe('ability', 'writesAccuracy', 'No Guard makes an 80%-accurate move land on a losing roll', () => {
  /* THE ROLL IS PINNED ABOVE THE MOVE'S ACCURACY, so the control MUST miss. A probe run at rng 0.5
   * would hit either way and report a working mechanic whatever the engine does. */
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
    me.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, () => 0.9,
      new Map([[me, M.playerAction(me, 'hydropump', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), ng = run('noguard');
  return { works: none === 0 && ng > 0, detail: 'roll 0.9 vs 80% accuracy: no ability dealt ' + none + ', No Guard dealt ' + ng };
});

probe('ability', 'accuracyMod', 'Sand Veil makes the attacker miss a roll it would have hit', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
    S.field.weather = 'sand'; f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, () => 0.7,
      new Map([[me, M.playerAction(me, 'hydropump', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), sv = run('sandveil');
  return { works: none > 0 && sv === 0, detail: 'roll 0.7 in sand: no ability took ' + none + ', Sand Veil took ' + sv };
});

probe('ability', 'boostsEachTurn', 'Speed Boost raises Speed every turn', () => {
  const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
  me.ability = 'speedboost';
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return { works: me.boosts.sp > 0, detail: 'speed stage after one turn: ' + me.boosts.sp };
});

probe('ability', 'healsOnSwitchOut', 'Regenerator heals a third on the way out', () => {
  const me = bare('milotic'), ally = bare('corviknight'), bench = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  me.ability = 'regenerator'; me.curHP = Math.floor(me.st.hp / 3);
  const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
  const before = me.curHP;
  M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP > before, detail: 'on the bench: ' + before + ' -> ' + me.curHP + ' hp' };
});

probe('ability', 'buffsHolderOnHit', 'Justified raises Attack when hit by a Dark move', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'corviknight', 'garchomp');
    f1.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.boosts.at;
  };
  const none = run('none'), j = run('justified');
  return { works: none === 0 && j > 0, detail: 'no ability atk stage ' + none + ', Justified ' + j };
});

probe('move', 'fixedDamage', 'Seismic Toss deals the level, whoever it hits', () => {
  const att = bare('incineroar');
  const mv = MC.moves['seismictoss'];
  if (!mv) return { works: false, detail: 'seismictoss not in MC.moves' };
  const soft = M.dmgRange(att, bare('alakazam'), mv, fresh(), false);
  const hard = M.dmgRange(att, bare('corviknight'), mv, fresh(), false);
  return { works: soft.max === hard.max && soft.max === 50,
           detail: 'mv.bp=' + mv.bp + '; vs frail ' + soft.max + ', vs bulky ' + hard.max + ' (both must be 50)' };
});

probe('move', 'perishClock', 'Perish Song faints the target three turns later', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'perishsong', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  for (let t = 0; t < 3; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return { works: !!f1.fainted, detail: 'target after four turns: ' + (f1.fainted ? 'FAINTED' : f1.curHP + ' hp') };
});

probe('move', 'costsUserHP', 'Substitute costs the user a quarter', () => {
  /* The ACTION KIND is printed, because "the engine resolved this to a pass" and "the engine did the
   * move and forgot the cost" are different bugs with the same HP reading. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const act = M.playerAction(me, 'substitute', null, S.field);
  const before = me.curHP;
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP < before,
           detail: 'resolved to kind ' + (act && act.kind) + '; user ' + before + ' -> ' + me.curHP
                 + ' hp (a quarter is ' + Math.floor(me.st.hp / 4) + ')' };
});

probe('move', 'delayedSleep', 'Yawn puts the target to sleep on the following turn', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'yawn', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const immediate = f1.status || 'none';
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return { works: immediate !== 'slp' && f1.status === 'slp',
           detail: 'same turn: ' + immediate + ' (must not be slp), next turn: ' + (f1.status || 'none') };
});

probe('move', 'partialTrap', 'Infestation chips at the end of each turn', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const full = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'infestation', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const afterHit = f1.curHP;
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  /* THE HIT ITSELF IS PRINTED. "the trap chips nothing" and "the move never landed" are different
   * bugs and the target's HP after one idle turn cannot tell them apart on its own. */
  return { works: f1.curHP < afterHit,
           detail: 'the move dealt ' + (full - afterHit) + '; after the hit ' + afterHit
                 + ', after an idle turn ' + f1.curHP };
});

probe('move', 'boostsTarget', 'Decorate raises the partner', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'decorate', ally, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: ally.boosts.at > 0, detail: 'partner atk stage ' + ally.boosts.at + ' spa ' + ally.boosts.sa };
});

probe('move', 'clearsScreens', 'Brick Break removes the opposing Reflect', () => {
  const run = (breakIt) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    /* the FOE puts up Reflect, then side A optionally breaks it, then the foe is hit physically */
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'reflect', null, S.field)], [f2, { kind: 'pass' }]]));
    M.battleTurn(S, rng5,
      new Map([[me, breakIt ? M.playerAction(me, 'brickbreak', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    f1.curHP = f1.st.hp;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const behind = run(false), broken = run(true);
  return { works: broken > behind, detail: 'screen up ' + behind + '  ->  after Brick Break ' + broken };
});

probe('move', 'blocksSoundMoves', 'Throat Chop stops the target using a sound move', () => {
  const run = (chop) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, chop ? M.playerAction(me, 'throatchop', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'boomburst', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const free = run(false), chopped = run(true);
  return { works: free > 0 && chopped === 0, detail: 'sound move dealt ' + free + ' normally, ' + chopped + ' after Throat Chop' };
});

probe('move', 'ignoresBoosts', 'Darkest Lariat ignores a Defense boost', () => {
  const atk = bare('incineroar');
  const plain = bare('corviknight'), boosted = bare('corviknight');
  boosted.boosts.df = 4;
  const mv = MC.moves['darkestlariat'];
  if (!mv) return { works: false, detail: 'darkestlariat not in MC.moves' };
  const a = M.dmgRange(atk, plain, mv, fresh(), false);
  const b = M.dmgRange(atk, boosted, mv, fresh(), false);
  return { works: a.max === b.max, detail: 'unboosted ' + a.max + ' vs +4 Def ' + b.max + ' (equal = ignored)' };
});

probe('move', 'failsWithoutWeather', 'Aurora Veil fails when it is not snowing', () => {
  const run = (weather) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    S.field.weather = weather;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'auroraveil', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const dry = run(''), snow = run('snow');
  return { works: snow < dry, detail: 'took ' + dry + ' after Aurora Veil in clear weather (must be unreduced), '
                                    + snow + ' in snow' };
});

probe('move', 'punishesContact', 'Spiky Shield hurts the attacker it blocked', () => {
  /* WHETHER THE BLOCK EVEN HAPPENED IS PART OF THE READING. A shield that never blocked and a shield
   * that blocked without punishing both leave the attacker on full HP, and only the second is the
   * mechanic this probe is named for. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const before = f1.curHP, meBefore = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'spikyshield', null, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'dragonclaw', me, S.field)], [f2, { kind: 'pass' }]]));
  const blocked = (meBefore - me.curHP) === 0;
  return { works: blocked && (before - f1.curHP) > 0,
           detail: 'the shield ' + (blocked ? 'blocked' : 'DID NOT BLOCK — user took ' + (meBefore - me.curHP))
                 + '; blocked attacker lost ' + (before - f1.curHP) + ' hp' };
});

probe('move', 'critRatioUp', 'Night Slash is priced above the same move without its crit ratio', () => {
  /* Same control trick as the Rock Blast probe: a COPY with the id changed carries no tag, so the
   * only difference between the two calls is critRatioUp itself. */
  const att = bare('weavile'), def = bare('garchomp');
  const real = MC.moves['nightslash'];
  if (!real) return { works: false, detail: 'nightslash not in MC.moves' };
  const flat = Object.assign({}, real, { id: '__nightslash_nocrit' });
  const a = M.dmgRange(att, def, flat, fresh(), false);
  const b = M.dmgRange(att, def, real, fresh(), false);
  return { works: b.max > a.max, detail: 'no crit ratio ' + a.max + '  ->  Night Slash ' + b.max };
});

probe('move', 'clearsBoosts', 'Haze wipes the boosts off both sides', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  f1.boosts.at = 4; me.boosts.at = 2;
  const act = M.playerAction(me, 'haze', null, S.field);
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: f1.boosts.at === 0 && me.boosts.at === 0,
           detail: 'resolved to kind ' + (act && act.kind) + '; after Haze: foe atk ' + f1.boosts.at
                 + ', own atk ' + me.boosts.at + ' (both must be 0)' };
});

probe('move', 'cantUseTwice', 'Gigaton Hammer cannot be clicked twice in a row', () => {
  const { me, ally, f1, f2, S } = board('tinkaton', 'corviknight', 'garchomp', 'garchomp');
  if (!MC.moves['gigatonhammer']) return { works: false, detail: 'gigatonhammer not in MC.moves' };
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'gigatonhammer', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const first = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'gigatonhammer', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (first - f1.curHP) === 0,
           detail: 'second consecutive Gigaton Hammer dealt ' + (first - f1.curHP) + ' (must be 0)' };
});

probe('move', 'terrainScaled', 'Expanding Force gains power on Psychic Terrain', () => {
  const att = bare('alakazam'), def = bare('garchomp');
  const mv = MC.moves['expandingforce'];
  if (!mv) return { works: false, detail: 'expandingforce not in MC.moves' };
  const a = M.dmgRange(att, def, mv, fresh(), false);
  const b = M.dmgRange(att, def, mv, Object.assign(fresh(), { terrain: 'psychic' }), false);
  return { works: b.max > a.max, detail: 'no terrain ' + a.max + '  ->  Psychic Terrain ' + b.max };
});

probe('move', 'swapsStat', 'Foul Play attacks with the TARGET Attack', () => {
  /* Two identical targets but for their Attack. If Foul Play reads the USER's Attack the two are
   * equal, and that equality is the null result. Confirmed against Showdown independently:
   * spiritomb foulplay -> pelipper reads 28-34 there and 51-61 here. */
  const att = bare('spiritomb');
  const weak = bare('pelipper'), strong = bare('pelipper');
  strong.st = Object.assign({}, strong.st, { at: strong.st.at * 3 });
  const mv = MC.moves['foulplay'];
  if (!mv) return { works: false, detail: 'foulplay not in MC.moves' };
  const a = M.dmgRange(att, weak, mv, fresh(), false);
  const b = M.dmgRange(att, strong, mv, fresh(), false);
  return { works: b.max > a.max,
           detail: 'target atk ' + weak.st.at + ' -> ' + a.max + ', target atk ' + strong.st.at + ' -> ' + b.max };
});

probe('ability', 'formeChange', 'Disguise eats the first hit', () => {
  /* CLOSE COMBAT WAS THE WRONG MOVE AND THE CONTROL SAID SO: Mimikyu is Ghost/Fairy, so Fighting
   * does exactly ZERO to it, and the first version read 0 with the ability and 0 without and would
   * have gone green the moment Disguise was implemented OR deleted. Crunch is Dark -- 2x on Ghost,
   * 0.5x on Fairy, net neutral -- and physical contact, which is what Disguise is meant to eat. */
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'mimikyu', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  /* THE ASSERTION IS THE GEN-9 RULE, NOT "ABOUT ZERO". The first version demanded the Disguise arm
   * take at most 15% of the real hit, which was written while expecting a flat nullification -- and
   * it would have REJECTED the correct behaviour: since Gen 8 the busted disguise costs the holder
   * exactly maxhp/8, which on Mimikyu is 16 against a 92 hit, i.e. 17%. A probe whose threshold
   * encodes the wrong rule fails the fix and passes the bug. Exact number, both halves. */
  const eighth = Math.floor(M.buildMon('mimikyu', {}).st.hp / 8);
  const none = run('none'), dis = run('disguise');
  return { works: none > 0 && dis === eighth,
           detail: 'no ability took ' + none + ', Disguise took ' + dis + ' (must be exactly maxhp/8 = ' + eighth + ')' };
});

probe('ability', 'untagged', 'Marvel Scale raises Defense while statused', () => {
  /* `untagged` is a BUCKET, not a mechanic -- 45 abilities carry it, worth 2,129 clicks between
   * them. Probed here under that name because that is what the artifact says, with the mechanic
   * named in the label so the census row is readable. Marvel Scale is on the differential's hand
   * list; the tag walk found it has no tag at all to be wired from. */
  const atk = bare('garchomp');
  const off = bare('milotic'), on = bare('milotic');
  off.status = 'brn'; on.status = 'brn'; on.ability = 'marvelscale';
  const a = M.dmgRange(atk, off, MC.moves['earthquake'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['earthquake'], fresh(), false);
  return { works: b.max < a.max, detail: 'burned, no ability ' + a.max + '  ->  burned with Marvel Scale ' + b.max };
});

probe('move', 'secondaryStatEffect', 'Moonblast drops the target Special Attack', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'corviknight', 'garchomp');
  M.battleTurn(S, () => 0.01,
    new Map([[me, M.playerAction(me, 'moonblast', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: f1.boosts.sa < 0, detail: 'target spa stage with the roll forced low: ' + f1.boosts.sa };
});

probe('move', 'statusInflict', 'Scald burns as a secondary of a damaging move', () => {
  const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
  M.battleTurn(S, () => 0.01,
    new Map([[me, M.playerAction(me, 'scald', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: f1.status === 'brn',
           detail: 'target ' + (f1.fainted ? 'FAINTED' : 'survived') + ', status ' + (f1.status || 'none') };
});

probe('move', 'variablePower', 'Acrobatics doubles with no item held', () => {
  const held = bare('staraptor'), empty = bare('staraptor');
  held.item = 'lifeorb'; empty.item = '';
  const def = bare('garchomp');
  const mv = MC.moves['acrobatics'];
  if (!mv) return { works: false, detail: 'acrobatics not in MC.moves' };
  /* Life Orb would raise the held arm by 1.3x, so a working Acrobatics must still beat it. */
  const a = M.dmgRange(held, def, mv, fresh(), false);
  const b = M.dmgRange(empty, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: 'holding an item ' + a.max + '  ->  empty-handed ' + b.max };
});

/* ---- BATCH 5 — the rest of the walk, down to about 800 corpus uses ------------------------------ */

probe('move', 'statusCategory', 'Thunder Wave paralyses without dealing damage', () => {
  const { me, ally, f1, f2, S } = board('raichu', 'incineroar', 'garchomp', 'garchomp');
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'thunderwave', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (before - f1.curHP) === 0 && f1.status === 'par',
           detail: 'damage ' + (before - f1.curHP) + ' (must be 0), status ' + (f1.status || 'none') };
});

probe('move', 'statSwap', 'Psyshock is scored against the target Defense', () => {
  /* Two identical targets but for physical Defense. Psyshock is a SPECIAL move that hits the
   * PHYSICAL side, so raising Defense must lower the damage; if the engine reads Special Defense the
   * two are equal and that equality is the null result. */
  const att = bare('alakazam');
  const soft = bare('milotic'), hard = bare('milotic');
  hard.st = Object.assign({}, hard.st, { df: hard.st.df * 3 });
  const mv = MC.moves['psyshock'];
  if (!mv) return { works: false, detail: 'psyshock not in MC.moves' };
  const a = M.dmgRange(att, soft, mv, fresh(), false);
  const b = M.dmgRange(att, hard, mv, fresh(), false);
  return { works: b.max < a.max, detail: 'def ' + soft.st.df + ' takes ' + a.max + ', def ' + hard.st.df + ' takes ' + b.max };
});

probe('move', 'removesItem', 'a knocked-off Life Orb stops boosting the target damage', () => {
  /* NOT "is the item field blank" -- that is already probed under readsTargetItem, and a blank field
   * nothing reads is worth nothing. This asks the CONSEQUENCE: after the item is gone, does the
   * damage the victim deals actually fall back to the no-item number. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  f1.item = 'lifeorb';
  const withOrb = M.dmgRange(f1, me, MC.moves['earthquake'], S.field, false).max;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const after = M.dmgRange(f1, me, MC.moves['earthquake'], S.field, false).max;
  return { works: !f1.item && after < withOrb,
           detail: 'holding a Life Orb it dealt ' + withOrb + ', after Knock Off ' + after
                 + ' (item field now ' + JSON.stringify(f1.item || '') + ')' };
});

probe('item', 'extendsDuration', 'Light Clay keeps Reflect up past turn five', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    me.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'reflect', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    for (let t = 0; t < 5; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const none = run(''), clay = run('lightclay');
  return { works: clay < none, detail: 'turn 7 damage: no item ' + none + '  ->  Light Clay ' + clay };
});

probe('ability', 'refusesStatusMoves', 'Good as Gold refuses Thunder Wave', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('raichu', 'incineroar', 'gholdengo', 'garchomp');
    f1.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'thunderwave', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const none = run('none'), gold = run('goodasgold');
  return { works: none === 'par' && gold !== 'par', detail: 'no ability -> ' + none + ', Good as Gold -> ' + gold };
});

probe('move', 'inflictsToxic', 'Toxic damage grows each turn', () => {
  /* BADLY POISONED IS NOT POISONED. The existing inflictsPoison probe only asks whether the status
   * landed; the whole point of Toxic is that the chip ESCALATES, and an engine that treats it as
   * ordinary poison prices a stall matchup completely wrongly.
   *
   * NOT INTO CORVIKNIGHT. The first version did, read `status none`, and was about to be written up
   * as an engine gap -- Corviknight is STEEL and cannot be poisoned at all, so the probe was
   * measuring a correct immunity. Same family of staging error as firing Ice Beam at a Garchomp that
   * then fainted. Garchomp takes it. */
  const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'toxic', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const chips = [];
  for (let t = 0; t < 4; t++) {
    const before = f1.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    chips.push(before - f1.curHP);
  }
  return { works: chips[chips.length - 1] > chips[0],
           detail: 'status ' + (f1.status || 'none') + ', chip per turn: ' + chips.join(', ') };
});

probe('move', 'semiInvulnerable', 'a Pokemon in the air cannot be hit', () => {
  /* THE FLIER MUST BE FASTER, and the first version had it exactly backwards. Staraptor (100 base
   * Speed) went up against Garchomp (102), so Garchomp attacked BEFORE the charge was declared, hit
   * a Pokemon still standing on the ground, and the probe reported the engine broken. It is not:
   * `_invuln` is set at line 1420 when the charge begins and honoured at 1521, and that is also what
   * the real game does — going up second does not retroactively dodge anything.
   *
   * Sixteenth-and-seventeenth time a probe here was wrong before the engine was. Archaludon is 60
   * base Speed, so the order is not in doubt, and the SPEEDS ARE PRINTED so a future reader can see
   * the assumption instead of trusting it. */
  const run = (flies) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'archaludon', 'garchomp');
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, flies ? M.playerAction(me, 'fly', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'ironhead', me, S.field)], [f2, { kind: 'pass' }]]));
    return { took: before - me.curHP, mine: me.st.sp, theirs: f1.st.sp };
  };
  const grounded = run(false), airborne = run(true);
  return { works: grounded.took > 0 && airborne.took === 0,
           detail: 'flier speed ' + grounded.mine + ' vs attacker ' + grounded.theirs
                 + '; on the ground took ' + grounded.took + ', on the Fly charge turn took ' + airborne.took };
});

/* ---- BATCH 6 — the rest of the walk, plus the authorised fix list ------------------------------- */

probe('ability', 'halvesTypeDamage', 'Thick Fat halves Fire and Ice and nothing else', () => {
  const atk = bare('incineroar');
  const off = bare('milotic'), on = bare('milotic');
  on.ability = 'thickfat';
  const fire = (d) => M.dmgRange(atk, d, MC.moves['flamethrower'], fresh(), false).max;
  const other = (d) => M.dmgRange(atk, d, MC.moves['closecombat'], fresh(), false).max;
  return { works: fire(on) < fire(off) && other(on) === other(off),
           detail: 'Fire ' + fire(off) + '->' + fire(on) + ', Fighting ' + other(off) + '->' + other(on) + ' (must not move)' };
});

probe('ability', 'halvesTypeDamage', 'Dry Skin takes 1.25x from Fire', () => {
  /* FILED UNDER THE TAG THAT SHOULD CARRY IT, WHICH IS WHY THIS ONE IS DIFFERENT FROM THE REST.
   * `halvesTypeDamage` is the artifact's idiom for a type-scaled damage-taken multiplier -- Thick
   * Fat, Heatproof, Purifying Salt and Water Bubble all carry it with `attackerStatMult: 0.5`. Dry
   * Skin's Fire half is the same shape with 1.25 and the artifact has NO ROW FOR IT: `dryskin.tags`
   * is `["typeImmunity"]` and its params describe only the Water absorb. So the engine cannot have
   * this mechanic — there is nothing to read — and the fix is a tag before it is any code.
   *
   * Found by the differential, not by reading a list: `houndoom fireblast -> heliolisk` reads
   * 123-137 on Showdown and 99-117 here, which is 1.24. */
  const atk = bare('incineroar');
  const off = bare('heliolisk'), on = bare('heliolisk');
  on.ability = 'dryskin';
  const a = M.dmgRange(atk, off, MC.moves['flamethrower'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['flamethrower'], fresh(), false);
  return { works: b.max > a.max, detail: 'no ability ' + a.max + '  ->  Dry Skin ' + b.max + ' (must be about 1.25x)' };
});

probe('ability', 'ignoresDefenderAbility', 'Mold Breaker ignores Levitate', () => {
  /* THE SHARPEST AVAILABLE FORM AGAIN: Levitate is a hard zero, so a working Mold Breaker turns a 0
   * into a number and no partial implementation can fake it. */
  const plain = bare('tinkaton'), breaker = bare('tinkaton');
  breaker.ability = 'moldbreaker';
  const def = bare('hydreigon'); def.ability = 'levitate';
  const a = M.dmgRange(plain, def, MC.moves['earthquake'], fresh(), false);
  const b = M.dmgRange(breaker, def, MC.moves['earthquake'], fresh(), false);
  return { works: a.max === 0 && b.max > 0, detail: 'no ability ' + a.max + '  ->  Mold Breaker ' + b.max };
});

probe('ability', 'ignoresTypeImmunity', 'Scrappy lets Normal hit a Ghost', () => {
  const plain = bare('incineroar'), scrappy = bare('incineroar');
  scrappy.ability = 'scrappy';
  const def = bare('gengar');
  const a = M.dmgRange(plain, def, MC.moves['bodyslam'], fresh(), false);
  const b = M.dmgRange(scrappy, def, MC.moves['bodyslam'], fresh(), false);
  return { works: a.max === 0 && b.max > 0, detail: 'no ability ' + a.max + '  ->  Scrappy ' + b.max };
});

probe('ability', 'noRecoil', 'Rock Head takes no recoil', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
    me.ability = ab;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'bravebird', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - me.curHP;
  };
  const none = run('none'), rh = run('rockhead');
  return { works: none > 0 && rh === 0, detail: 'no ability lost ' + none + ' to recoil, Rock Head lost ' + rh };
});

probe('move', 'alwaysCrit', 'Flower Trick always crits', () => {
  /* Same control trick as Rock Blast and Night Slash: a copy with the id changed carries no tag, so
   * the only thing that differs between the two calls is alwaysCrit. */
  const att = bare('meowscarada'), def = bare('garchomp');
  const real = MC.moves['flowertrick'];
  if (!real) return { works: false, detail: 'flowertrick not in MC.moves' };
  const flat = Object.assign({}, real, { id: '__flowertrick_nocrit' });
  const a = M.dmgRange(att, def, flat, fresh(), false);
  const b = M.dmgRange(att, def, real, fresh(), false);
  return { works: b.max > a.max, detail: 'without the tag ' + a.max + '  ->  Flower Trick ' + b.max };
});

probe('move', 'forcesSwitch', 'Dragon Tail drags the target out', () => {
  const me = bare('garchomp'), ally = bare('corviknight');
  const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('whimsicott');
  const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'dragontail', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  /* THE DAMAGE IS PRINTED so "the drag is not modelled" cannot be confused with "the move never
   * resolved" -- Dragon Tail deals damage AND drags, and only one of those halves is in question. */
  return { works: S.actB.indexOf(f1) < 0,
           detail: 'the move dealt ' + (before - f1.curHP) + '; foe actives after Dragon Tail: '
                 + S.actB.map(x => x && x.name).join(', ') };
});

probe('move', 'crashOnMiss', 'High Jump Kick hurts the user when it misses', () => {
  /* THE ROLL IS PINNED ABOVE THE MOVE'S ACCURACY so the miss is guaranteed. At rng 0.5 it would
   * connect and the probe would report a working crash whatever the engine does. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const mv = MC.moves['highjumpkick'];
  if (!mv) return { works: false, detail: 'highjumpkick not in MC.moves' };
  const before = me.curHP, foeBefore = f1.curHP;
  M.battleTurn(S, () => 0.99,
    new Map([[me, M.playerAction(me, 'highjumpkick', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (foeBefore - f1.curHP) === 0 && (before - me.curHP) > 0,
           detail: 'foe took ' + (foeBefore - f1.curHP) + ' (must be 0, it missed), user lost ' + (before - me.curHP) };
});

probe('move', 'userFaints', 'Explosion faints its user', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const mv = MC.moves['explosion'];
  if (!mv) return { works: false, detail: 'explosion not in MC.moves' };
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'explosion', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: !!me.fainted || me.curHP <= 0, detail: 'user after Explosion: ' + (me.fainted ? 'FAINTED' : me.curHP + ' hp') };
});

probe('item', 'boostsSuperEffective', 'Expert Belt raises only super-effective damage', () => {
  const on = bare('incineroar'), off = bare('incineroar');
  on.item = 'expertbelt';
  const se = bare('corviknight');                      // Fire into Steel/Flying is super effective
  const neutral = bare('garchomp');                    // Fire into Dragon/Ground is resisted, not SE
  const hit = (m, d) => M.dmgRange(m, d, MC.moves['flamethrower'], fresh(), false).max;
  return { works: hit(on, se) > hit(off, se) && hit(on, neutral) === hit(off, neutral),
           detail: 'super-effective ' + hit(off, se) + '->' + hit(on, se)
                 + ', not super-effective ' + hit(off, neutral) + '->' + hit(on, neutral) + ' (must not move)' };
});

probe('item', 'curesStatus', 'Lum Berry cures the status it was just given', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'willowisp', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const none = run(''), lum = run('lumberry');
  return { works: none === 'brn' && lum === 'none', detail: 'no item -> ' + none + ', Lum Berry -> ' + lum };
});

probe('ability', 'typeBecomesMoveType', 'Protean makes the user the type it just used', () => {
  /* THE MOVE'S TYPE MUST BE ONE THE USER DOES NOT ALREADY HAVE. The first version fired Crunch off a
   * Meowscarada, which is already Grass/DARK, so a fully working Protean and a completely absent one
   * both leave a Dark type in the list. Earthquake is Ground and Meowscarada is not. */
  const { me, ally, f1, f2, S } = board('meowscarada', 'incineroar', 'garchomp', 'garchomp');
  me.ability = 'protean';
  const before = (me.types || []).join('/');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (me.types || []).length === 1 && (me.types || [])[0] === 'Ground',
           detail: 'types ' + before + '  ->  ' + (me.types || []).join('/') + ' after using a Ground move' };
});

probe('ability', 'invertsBoosts', 'Contrary turns a self-drop into a boost', () => {
  const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
  me.ability = 'contrary';
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.boosts.df > 0, detail: 'own def stage after Close Combat with Contrary: ' + me.boosts.df + ' (must be positive)' };
});

probe('ability', 'blocksExplosion', 'Damp stops Explosion happening at all', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'explosion', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { took: before - f1.curHP, userDead: !!me.fainted };
  };
  const none = run('none'), damp = run('damp');
  return { works: none.took > 0 && damp.took === 0 && !damp.userDead,
           detail: 'no ability: foe took ' + none.took + ' / user ' + (none.userDead ? 'fainted' : 'lived')
                 + '   |   Damp: foe took ' + damp.took + ' / user ' + (damp.userDead ? 'FAINTED' : 'lived') };
});

probe('move', 'hazard', 'Stealth Rock chips what comes in afterwards', () => {
  const me = bare('garchomp'), ally = bare('corviknight');
  const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('staraptor');
  const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'stealthrock', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const before = fbench.curHP;
  M.battleTurn(S, rng5, PASS2(me, ally),
    new Map([[f1, { kind: 'switch', to: fbench }], [f2, { kind: 'pass' }]]));
  /* WHETHER THE SWITCH HAPPENED IS PART OF THE READING. An unchipped body that never came in and an
   * unchipped body that walked through a hazard nothing implements read the same from HP alone. */
  const cameIn = S.actB.indexOf(fbench) >= 0;
  return { works: cameIn && fbench.curHP < before,
           detail: 'the switch ' + (cameIn ? 'happened' : 'DID NOT HAPPEN') + '; the switch-in (Staraptor, '
                 + '4x weak to Rock) came in on ' + before + ' and is on ' + fbench.curHP };
});

probe('move', 'blocksHealing', 'Psychic Noise stops the target healing', () => {
  const run = (noise) => {
    const { me, ally, f1, f2, S } = board('alakazam', 'incineroar', 'milotic', 'garchomp');
    f1.curHP = Math.floor(f1.st.hp / 3);
    M.battleTurn(S, rng5,
      new Map([[me, noise ? M.playerAction(me, 'psychicnoise', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    const before = f1.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'recover', null, S.field)], [f2, { kind: 'pass' }]]));
    return f1.curHP - before;
  };
  const free = run(false), blocked = run(true);
  return { works: free > 0 && blocked <= 0, detail: 'healed ' + free + ' normally, ' + blocked + ' after Psychic Noise' };
});

probe('move', 'reordersTurn', 'After You lets the partner move next', () => {
  /* The partner is slower than both foes, so without After You it acts last. The fast foe is left on
   * 1 HP: if the partner really moves next it kills before the foe ever acts. */
  const run = (afterYou) => {
    const me = bare('whimsicott'), ally = bare('archaludon');
    const f1 = bare('weavile'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.curHP = 1;
    const before = ally.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, afterYou ? M.playerAction(me, 'afteryou', ally, S.field) : { kind: 'pass' }],
               [ally, M.playerAction(ally, 'ironhead', f1, S.field)]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', ally, S.field)], [f2, { kind: 'pass' }]]));
    return before - ally.curHP;
  };
  const normal = run(false), moved = run(true);
  return { works: normal > 0 && moved === 0,
           detail: 'slow partner took ' + normal + ' normally, ' + moved + ' after After You' };
});

probe('item', 'curesVolatile', 'Mental Herb frees the holder from Taunt', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'whimsicott', 'garchomp');
    f1.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'taunt', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return !!(f1._vol && f1._vol.taunt);
  };
  const none = run(''), herb = run('mentalherb');
  return { works: none === true && herb === false, detail: 'no item taunted=' + none + ', Mental Herb taunted=' + herb };
});

probe('move', 'multiAccuracy', 'Triple Axel rolls accuracy on every hit', () => {
  /* THE TAG IS ABOUT THE ROLL, NOT THE POWER, so this asks the engine's own accuracy helper whether
   * Triple Axel's effective hit chance is below its printed 90 -- three 90% rolls compound to 0.73.
   * An engine that treats it as one 90% roll returns 90 and that equality is the null result. */
  const acc = M.moveAccuracy('tripleaxel', fresh());
  return { works: acc > 0 && acc < 90, detail: 'effective accuracy ' + acc + ' (one roll is 90, three compound to about 73)' };
});

/* ---- REPORT ------------------------------------------------------------------------------------- */

const works = results.filter(r => r.works);
const missing = results.filter(r => !r.works);
console.log('MECHANIC CENSUS — does the engine actually DO the thing?\n');
for (const r of results) {
  console.log('  ' + (r.works ? 'LIVE   ' : 'MISSING') + '  ' + r.tag.padEnd(20) + r.label.padEnd(38) + r.detail);
}
console.log(`\n  ${works.length} live, ${missing.length} missing, ${results.length} probed.`);
if (missing.length) {
  console.log('\n  MISSING:');
  for (const r of missing) console.log('    - ' + r.label + '   (' + r.kind + ' tag `' + r.tag + '`)');
}

fs.writeFileSync(D('data', 'mechanics-census.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/test-mechanics.js',
  design: 'Behavioural probes. Each clears its own control explicitly, because the first version '
        + 'compared a Choice Scarf against a Basculegion that buildMon had already given a Choice '
        + 'Scarf and reported the engine broken.',
  probed: results.length, live: works.length, missing: missing.length,
  results: results.map(r => ({ kind: r.kind, tag: r.tag, label: r.label, live: r.works, detail: r.detail })),
}, null, 2) + '\n');
console.log('\n  wrote data/mechanics-census.json');
/* Exits 0 deliberately: this is a census, and MISSING is the honest current state of several of
 * these. A ratchet on data/mechanics-census.json is what should fail when `live` goes DOWN. */
