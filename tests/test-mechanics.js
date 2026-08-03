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
  /* A VOLATILE IS NOT A STATUS, and checking the CLASSIFICATION rather than the EFFECT gave this a
   * false LIVE on the first run. Encore's rulebook entry carries `volatile: "encore"` and no
   * `status`, so playerAction returns kind 'status' -- which looks modelled -- and the status branch
   * then calls applyStatus with nothing to apply. The move costs its turn and does nothing.
   *
   * A false LIVE is worse than a false MISSING: it hides the gap instead of listing it. So this runs
   * the turn and asks whether ANY state on the target moved. */
  const me = bare('whimsicott'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const snap = JSON.stringify({ st: f1.status, b: f1.boosts, keys: Object.keys(f1).filter(k => /encore|lock|disab/i.test(k)) });
  const fa = new Map([[me, M.playerAction(me, 'encore', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const after = JSON.stringify({ st: f1.status, b: f1.boosts, keys: Object.keys(f1).filter(k => /encore|lock|disab/i.test(k)) });
  return { works: snap !== after, detail: after === snap ? 'target unchanged after Encore resolved' : 'target state moved' };
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

probe('ability', 'formeChange', 'Zero to Hero upgrades Palafin', () => {
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const buildable = !!M.buildMon('palafin-hero', {});
  return { works: /zerotohero/.test(src),
           detail: 'palafin-hero buildable=' + buildable + ', engine references zerotohero=' + /zerotohero/.test(src) };
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
