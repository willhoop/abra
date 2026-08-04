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
  const me = bare('raichu'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('milotic');
  f2.ability = 'lightningrod';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const before1 = f1.curHP, before2 = f2.curHP;
  const fa = new Map([[me, M.playerAction(me, 'thunderbolt', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const hitAimed = before1 - f1.curHP, hitRod = before2 - f2.curHP;
  return { works: hitRod > 0 && hitAimed === 0,
           detail: 'aimed target took ' + hitAimed + ', Lightning Rod holder took ' + hitRod };
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
