/* probe_knockoff_berry_consumers.js — ROADMAP #80, ASKED OF THE CONSUMERS RATHER THAN OF THE FIELD.
 *
 *   SHOWDOWN_PATH=... node tests/probe_knockoff_berry_consumers.js
 *
 * ROADMAP #80 says Knock Off records the wrong DISPOSITION for a resist berry the holder ate itself
 * (`[eat]` versus a move-attributed removal), and that Harvest / Recycle / Belch / Cud Chew read it.
 * `tests/probe_item_disposition.js` already reads the two FIELDS (`lastItem`, `ateBerry`) off both
 * engines on its `ko-colbur` arm and they match. A field that matches is a CLASSIFICATION; this file
 * tests the OUTCOME: after the berry-eating Knock Off, does each consumer do on medicham2 what it does
 * on Showdown — and does it do something DIFFERENT when Knock Off takes an inert item instead?
 *
 * THE CONTROL IS THE KNOB. Each consumer is staged twice on the same body, the same attacker and the
 * same script, differing only in the held item:
 *   berry    the Dark-resist berry. It resists Knock Off and is EATEN inside the damage calculation
 *            (`onSourceModifyDamage` -> `eatItem`), so `lastItem`/`ateBerry` are written.
 *   inert    Leftovers. Knock Off REMOVES it (`takeItem`, which writes neither field).
 * Showdown must answer differently across the two, or the arm cannot see the mechanic at all and is
 * reported UNREADABLE rather than MATCH.
 *
 * NOTHING HERE IS TYPED. The berry is the legal berry whose `onSourceModifyDamage` exists and whose
 * `naturalGift.type` is Knock Off's type; each consumer body is the first legal, non-mega carrier the
 * format's own validator accepts that Knock Off hits super-effectively (so the berry fires); the
 * attacker is the first legal non-mega Knock Off learner sharing Knock Off's type. Species keys go
 * through `buildPair`, which resolves them with engine/mc_key.js.
 *
 * Unburden is NOT an arm: its authority handler fires on `onTakeItem` AND on `onAfterUseItem`, so it
 * activates whichever disposition is recorded — the disposition cannot move it.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));

const legal = x => x && x.exists && !x.isNonstandard;
const KO = dex.moves.get('knockoff');
const sp = n => dex.species.get(n);
const nonMega = n => !sp(n).isMega && legal(sp(n));
const hitsSE = n => dex.getImmunity(KO.type, sp(n).types) && dex.getEffectiveness(KO.type, sp(n).types) > 0;

const BERRY = dex.items.all().filter(legal)
  .find(i => i.isBerry && i.onSourceModifyDamage && i.naturalGift && i.naturalGift.type === KO.type);
const INERT = dex.items.get('leftovers');
if (!BERRY || !legal(INERT)) { console.log('FIXTURE — no legal resist berry for ' + KO.type); process.exit(1); }

/* the attacker's own ability must not set a weather — a sand or rain lead would overwrite the Harvest
 * arm's sun and every arm would then be reading the weather, not the berry */
const setsWeather = a => /setWeather/.test(String(dex.abilities.get(a).onStart || ''));
const ATTACKER = CS.moveCarriers(KO.name).filter(nonMega)
  .find(n => sp(n).types.includes(KO.type) && !setsWeather(sp(n).abilities[0]));
const firstCarrier = (list) => list.filter(nonMega).find(hitsSE);

const recycleBody = firstCarrier(CS.moveCarriers('Recycle'));
const belchBody = firstCarrier(CS.moveCarriers('Belch').filter(n => dex.getImmunity('Poison', sp(ATTACKER).types)
  && !sp(ATTACKER).types.includes('Steel')));
const harvestBody = firstCarrier(CS.abilityCarriers('Harvest'));
const cudBody = firstCarrier(CS.abilityCarriers('Cud Chew'));
const sunBody = CS.abilityCarriers('Drought').filter(nonMega)[0];

console.log('\n  FIXTURES, DERIVED FROM ' + CS.FORMAT);
console.log('    attacker ' + ATTACKER + ' (' + sp(ATTACKER).types.join('/') + ')  move ' + KO.name + ' (' + KO.type + ')');
console.log('    berry    ' + BERRY.name + '   inert ' + INERT.name);
console.log('    Recycle  ' + recycleBody + '  Belch ' + belchBody + '  Harvest ' + harvestBody
  + '  Cud Chew ' + cudBody + '  sun from ' + sunBody + ' (Drought)');

const legalSet = (species, moves) => {
  const bad = moves.filter(m => !CS.canLearn(species, m));
  if (bad.length) { console.log('  FIXTURE ILLEGAL — ' + species + ' cannot learn ' + bad.join(', ')); process.exit(1); }
};
/* TURN 1 NEEDS A CLICK THAT CHANGES NOTHING THE ARM READS. Showdown refuses `pass` for a body that can
 * move, and Protect would block Knock Off. So: a legal self-targeting status move whose ONLY effect is a
 * stat boost — derived per body, never named. */
const BOOSTERS = dex.moves.all().filter(legal).filter(m => m.category === 'Status' && m.target === 'self'
  && m.boosts && !m.stallingMove && !m.heal && !m.onHit && !m.self && !m.volatileStatus && !m.selfSwitch
  && !m.sideCondition && !m.condition && !m.onTryHit && !m.onTry);
const idleFor = (n) => { const m = BOOSTERS.find(x => CS.canLearn(n, x.name)); return m && m.name; };
const filler = (exclude) => CS.moveCarriers('Protect').filter(nonMega).filter(n => !exclude.includes(n)
  && !CS.abilityCarriers('Drought').includes(n)).slice(0, 3);

/* the attacker keeps the SAME set in every arm so the only varied input is the consumer's item */
const attackerSet = () => { const mv = [KO.name, 'Protect', idleFor(ATTACKER)]; legalSet(ATTACKER, mv);
  return { species: ATTACKER, item: '', ability: sp(ATTACKER).abilities[0], moves: mv }; };

/* each arm: the consumer body, its ability, its moves, the turn-2 click, an optional partner, and a
 * reader that turns the two engines' state into one comparable token */
const CONSUMERS = [
  { id: 'recycle', body: recycleBody, ability: sp(recycleBody).abilities[0], moves: ['Recycle', 'Protect'],
    t2: { m: 'recycle' },
    read: (mB, sB) => ({ medi: N.id(mB.item || mB._roomItem || '') || '-', sd: N.id(sB.item || '') || '-' }),
    what: 'the item held after the turn-2 Recycle' },
  { id: 'belch', body: belchBody, ability: sp(belchBody).abilities[0], moves: ['Belch', 'Protect'],
    t2: { m: 'belch', t: 0 },
    read: null, what: 'whether Belch dealt damage to the attacker on turn 2' },
  { id: 'harvest', body: harvestBody, ability: 'Harvest', moves: ['Protect', 'Trick-or-Treat'].filter(m => CS.canLearn(harvestBody, m)).length === 2
      ? ['Protect', 'Trick-or-Treat'] : ['Protect'], partner: sunBody,
    t2: { m: 'protect' },
    read: (mB, sB) => ({ medi: N.id(mB.item || mB._roomItem || '') || '-', sd: N.id(sB.item || '') || '-' }),
    what: 'the item held at the end of turn 1 (Harvest under a Drought sun is certain)' },
  { id: 'cudchew', body: cudBody, ability: 'Cud Chew', moves: ['Protect'],
    t2: { m: 'protect' }, read: null, what: 'Cud Chew re-eat lines (`-activate … Cud Chew`) by the end of turn 3' },
];

let failed = 0, unreadable = 0;
const rows = [];
console.log('\n  ' + 'consumer'.padEnd(10) + 'item'.padEnd(14) + 'medicham2'.padEnd(16) + 'showdown'.padEnd(16) + 'verdict');
for (const c of CONSUMERS) {
  if (!c.body) { console.log('  ' + c.id.padEnd(10) + 'NO LEGAL CARRIER that ' + KO.name + ' hits super-effectively'); rows.push({ id: c.id, verdict: 'NO-CARRIER' }); continue; }
  const out = {};
  for (const [tag, heldItem] of [['berry', BERRY.name], ['inert', INERT.name]]) {
    c.idle = c.idle || idleFor(c.body);
    if (!c.idle) { console.log('  FIXTURE — no idle boost move for ' + c.body); process.exit(1); }
    if (!c.moves.includes(c.idle)) c.moves = c.moves.concat(c.idle);
    legalSet(c.body, c.moves);
    const consumer = { species: c.body, item: heldItem, ability: c.ability, moves: c.moves };
    const partner = c.partner ? [{ species: c.partner, item: '', ability: 'Drought', moves: ['Protect'] }] : [];
    const A = [attackerSet()].concat(filler([ATTACKER, c.body]).map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] })));
    const B = [consumer].concat(partner, filler([ATTACKER, c.body, c.partner || '']).map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }))).slice(0, 4);
    const a = G.buildPair(A, { hpBoost: 8 }), b = G.buildPair(B, { hpBoost: 8 });
    if (!a || !b) { out[tag] = { err: 'COULD NOT BUILD' }; continue; }
    const PR = { m: 'protect' };
    const script = [
      { p1: [{ m: 'knockoff', t: 0 }, PR], p2: [{ m: N.id(c.idle) }, PR] },   // a boost only — Protect would stop Knock Off landing
      /* turn 2: the attacker must not Protect on the Belch arm, or Belch can never connect */
      { p1: [c.id === 'belch' ? { m: N.id(idleFor(ATTACKER)) } : PR, PR], p2: [c.t2, PR] },
      { p1: [PR, PR], p2: [PR, PR] },
    ];
    const hp = { medi: [], sd: [] }, item = { medi: [], sd: [] };
    let sdBattle = null;
    const r = G.playGame(a, b, 'directed', 'ko80/' + c.id + '/' + tag, { script,
      onBoundary: (snap, turnIdx, S, battle) => {
        sdBattle = battle;
        const mA = (S.actA || [])[0], sA = battle.sides[0].active[0];
        const mB = (S.actB || [])[0], sB = battle.sides[1].active[0];
        if (mA && sA) { hp.medi.push(+mA.curHP); hp.sd.push(sA.hp); }
        if (mB && sB && c.read) { const v = c.read(mB, sB); item.medi.push(v.medi); item.sd.push(v.sd); }
      } });
    if (process.env.PROBE_VERBOSE) {
      console.log('    [' + c.id + '/' + tag + '] hp medi ' + hp.medi.join(',') + '  sd ' + hp.sd.join(',') + '   item medi ' + item.medi.join(',') + '  sd ' + item.sd.join(','));
      const keep = l => /|(move|-enditem|-item|-activate|-fail|-miss|-damage|turn|-weather)|/.test(String(l)) || /^|turn|/.test(String(l));
      console.log('      medi: ' + (r.mediTrace || []).filter(keep).join(' ; '));
      console.log('      sd  : ' + ((sdBattle && sdBattle.log) || []).filter(keep).join(' ; '));
    }
    let tok;
    if (c.id === 'belch') {
      /* WHAT HAPPENED TO THE BELCH, read off each engine's own line after its `|move|…|belch|`.
       * The authority's gate is `onTry(source) { return source.ateBerry; }` (data/moves.ts belch; the
       * Champions mod removes only `onDisableMove`), and onTry runs BEFORE the accuracy roll, so a
       * `-miss` is a Belch the gate ALLOWED and a `-fail` is one it refused. HP alone cannot tell the
       * two apart — a shared-die miss read as a refusal on this probe's first run. */
      const fate = (log) => { const L = (log || []).map(String);
        const i = L.findIndex(l => /^\|move\|[^|]*\|belch\|/i.test(l));
        if (i < 0) return 'not-clicked';
        const nx = L.slice(i + 1).find(l => /^\|(-miss|-fail|-damage|-immune|move|upkeep)\|/.test(l)) || '';
        return /^\|-miss\|/.test(nx) ? 'allowed(miss)' : /^\|-damage\|/.test(nx) ? 'allowed(hit)'
             : /^\|-fail\|/.test(nx) ? 'refused' : 'other:' + nx.split('|')[1]; };
      tok = { medi: fate(r.mediTrace), sd: fate(sdBattle && sdBattle.log) };
    } else if (c.id === 'cudchew') {
      /* medicham2 writes the ability as an id (`ability: cudchew`), Showdown as a name — fold both */
      const cnt = (log) => (log || []).filter(l => /\|-activate\|[^|]*\|ability: ?cud ?chew/i.test(String(l))).length;
      tok = { medi: 'cud×' + cnt(r.mediTrace), sd: 'cud×' + cnt(sdBattle && sdBattle.log) };
    } else {
      /* boundary 0 is the board BEFORE turn 1; boundary k is the board after turn k */
      const pick = c.id === 'harvest' ? 1 : 2;   // harvest: after turn 1's residual; recycle: after turn 2
      tok = { medi: item.medi[pick] || 'none', sd: item.sd[pick] || 'none' };
    }
    out[tag] = { ...tok, err: r.err || null };
    const same = tok.medi === tok.sd;
    if (!same) failed++;
    console.log('  ' + c.id.padEnd(10) + tag.padEnd(14) + String(tok.medi).padEnd(16) + String(tok.sd).padEnd(16)
      + (same ? 'MATCH' : 'PARTS') + (r.err ? '   [game threw: ' + r.err + ']' : ''));
  }
  /* the knob must MOVE the authority, or this arm could not have seen a wrong disposition */
  const moved = out.berry && out.inert && out.berry.sd !== out.inert.sd;
  if (!moved) { unreadable++; console.log('  ' + c.id.padEnd(10) + 'UNREADABLE — Showdown answered the same with the berry and with ' + INERT.name); }
  rows.push({ id: c.id, body: c.body, what: c.what, berry: out.berry, inert: out.inert, controlMovesAuthority: moved });
}

const fs = require('fs');
fs.writeFileSync(D('data', 'verification', 'probe-knockoff-berry-consumers.json'), JSON.stringify({
  generated: new Date().toISOString(), roadmap: 80, format: CS.FORMAT,
  fixtures: { attacker: ATTACKER, move: KO.name, berry: BERRY.name, inert: INERT.name },
  rows, parted: failed, unreadable, run_ok: failed === 0 && unreadable === 0,
}, null, 1) + '\n');
console.log('\n  parted: ' + failed + '   unreadable arms: ' + unreadable);
console.log('  wrote data/verification/probe-knockoff-berry-consumers.json\n');
process.exit(failed || unreadable ? 1 : 0);
