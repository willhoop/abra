#!/usr/bin/env node
/* tests/probe_regmc_white_herb_at_win.js — WHITE HERB IS SPENT ON THE MOVE THAT ENDS THE BATTLE, UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.36.0).
 *
 *   node tests/probe_regmc_white_herb_at_win.js --regulation regmc                             # green, exit 0
 *   MEDI_HERB_SKIPPED_AT_WIN=1 node tests/probe_regmc_white_herb_at_win.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts whiteherb (read from the dist dex): restores every negative stage and spends the item, raised from
 *   onAnySwitchIn, onAnyAfterMega, onAnyAfterMove and onResidual. `AfterMove` is raised inside `useMove`, BEFORE
 *   `runAction`'s `faintMessages()` (default `checkWin = true`, sim/battle.ts :2832-2833) ends the battle. So a
 *   self-dropping hit that knocks out the last foe still spends its user's herb. The item is found by its TAG.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   WIN       turns 1-2: the partner knocks out slot a twice while the holder protects; turn 3: the partner knocks out
 *             slot b and the holder's self-dropping hit knocks out the last body: the battle ends on the herb move.
 *   CONTROL   the same with no herb: the drop stays, and both engines end the battle on it.
 *   The foe side is four frail bodies weak to the attacks; the cast is searched until the AUTHORITY ends the battle.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_white_herb_at_win', ['MEDI_HERB_SKIPPED_AT_WIN']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, sure, mon, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const HERB = Object.keys(TAGS.items).find(i => (TAGS.items[i].tags || []).includes('restoresStats') && K.legal(D.items.get(i)));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     herb: ' + HERB);
if (!HERB) { console.log('  NOT STAGED — no legal restoresStats item'); process.exit(1); }
/* Reg M-B's checkout QUEUES this restore (`insertChoice`, order 99: never after the battle ends); Reg M-C's runs it inside
 * `useMove`. The tag carries which, and the engine reads only the tag. */
const HERBP = TAGS.items[HERB].params.restoresStats;
const immediate = !!D.items.get(HERB).onAnyAfterMove && !/insertChoice/.test(String(D.items.get(HERB).onAnyAfterMove));
ok(!!HERBP.afterMoveImmediate === immediate && immediate, 'the tag says the AfterMove restore is immediate in this checkout, as the handler does', JSON.stringify(HERBP));
const boostQuiet = s => { const a = quiet(s); if (!a) return null; const A = D.abilities.get(a);
  return (A.onTryBoost || A.onChangeBoost || A.onAfterBoost || A.onAfterEachBoost || A.onFoeAfterBoost) ? null : a; };
const basic = m => K.legal(m) && m.category === 'Physical' && m.target === 'normal' && sure(m) && !m.priority && !m.multihit
  && !m.flags.charge && !m.flags.recharge && !m.selfSwitch && !m.basePowerCallback && !m.damageCallback && !m.recoil && !m.drain
  && !m.onModifyMove && !m.onBasePower && !m.onTryHit && !m.onHit && !m.volatileStatus && !m.self;   /* a secondary on the FOE is allowed: the foes only idle */
/* the self-dropping hit (a user drop and nothing else) and a plain hit of the same type, both learned */
const selfDrop = (s, type) => D.moves.all().filter(m => (K.legal(m) && m.category === 'Physical' && m.target === 'normal' && sure(m)
  && m.self && m.self.boosts && Object.values(m.self.boosts).every(v => v < 0) && !m.priority && !m.multihit && !m.flags.charge
  && !m.selfSwitch && !m.secondary && !m.secondaries && !m.basePowerCallback && !m.recoil))
  .filter(m => m.self && m.self.boosts && learns(s, m.id) && (!type || m.type === type)).sort((a, b) => b.basePower - a.basePower)[0] || null;
const plainOf = (s, type) => D.moves.all().filter(m => basic(m) && m.type === type && learns(s, m.id)).sort((a, b) => b.basePower - a.basePower)[0] || null;
/* a foe's repeatable click: K.idle unless that is Focus Energy (a second use writes -fail on the authority only), else a
 * self-targeting +1 boost (three uses stay under +6) */
const idleN = s => { const i = K.idle(s); if (i && i.id !== 'focusenergy') return i;
  return D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.heal && !m.onHit && !m.onTry
    && Object.values(m.boosts).every(v => v === 1) && learns(s, m.id)).sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null; };
const atk = s => s.baseStats.atk;
const frail = s => s.baseStats.hp + s.baseStats.def;
const KEEP = /^\|(-enditem|-clearnegativeboost|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ atWin: K.M.MEDSEEN.herbAtWin || 0 }));

const HOLDERS = SPEC.filter(s => boostQuiet(s) && selfDrop(s) && learns(s, 'protect')).sort((a, b) => atk(b) - atk(a));
console.log('     holders: ' + HOLDERS.slice(0, 12).map(h => h.id + '(' + selfDrop(h).id + ')').join(', '));
let WN = null, CT = null, tried = 0;
outer: for (const h of HOLDERS.slice(0, 12)) {
  const sd = selfDrop(h);
  /* the partner: faster than the holder, strong, with a plain hit of the same type */
  const pals = SPEC.filter(s => s.baseSpecies !== h.baseSpecies && quiet(s) && s.baseStats.spe > h.baseStats.spe + 10 && plainOf(s, sd.type))
    .sort((a, b) => atk(b) - atk(a)).slice(0, 3);
  for (const pal of pals) {
    const pm = plainOf(pal, sd.type);
    const used = new Set([h.baseSpecies, pal.baseSpecies]);
    /* four frail foes weak to the type, each with a harmless repeatable click (their speed does not matter: they only idle) */
    const foes = [];
    for (const s of SPEC.filter(s => quiet(s) && D.getImmunity(sd.type, s) && D.getEffectiveness(sd.type, s) > 0 && idleN(s)).sort((a, b) => frail(a) - frail(b))) {
      if (used.has(s.baseSpecies)) continue; used.add(s.baseSpecies); foes.push(s); if (foes.length === 4) break;
    }
    if (foes.length < 4) { console.log('   (skip ' + h.id + '+' + pal.id + ': ' + foes.length + ' slow frail foes weak to ' + sd.type + ')'); continue; }
    const fill = SPEC.filter(s => quiet(s) && !used.has(s.baseSpecies)).slice(0, 2);
    const A = it => [mon(h, it, [sd.name, 'Protect'], boostQuiet(h)), mon(pal, '', [pm.name]), mon(fill[0], '', ['Protect']), mon(fill[1], '', ['Protect'])];
    const B = foes.map(s => mon(s, '', [idleN(s).name]));
    const idleOf = i => ({ m: idleN(foes[i]).id });
    /* turns 1-2: the partner knocks out the foe in slot a twice (a lead, then its replacement) while the holder stands
     * behind Protect (a failed second Protect is harmless: the foes only idle); turn 3: the partner knocks out slot b
     * and the holder's self-dropping hit knocks out the last body in slot a */
    const script = [
      { p1: [P.protect, { m: pm.id, t: 0 }], p2: [idleOf(0), idleOf(1)] },
      { p1: [P.protect, { m: pm.id, t: 0 }], p2: [idleOf(2), idleOf(1)] },
      { p1: [{ m: sd.id, t: 0 }, { m: pm.id, t: 1 }], p2: [idleOf(3), idleOf(1)] },
    ];
    tried++;
    const w = play('win', A(D.items.get(HERB).name), B, script);
    if (!w.staged) { console.log('   (skip ' + h.id + '+' + pal.id + ': ' + w.why + ')'); continue; }
    const sdFaint = w.sd.filter(l => /^\|faint\|p2/.test(l)).length;
    const herbLine = w.sd.some(l => /^\|-enditem\|p1a:/.test(l));
    if (sdFaint !== 4 || !herbLine) { console.log('   (skip ' + h.id + '+' + pal.id + ' vs ' + foes.map(f => f.id).join('/') + ': the authority fainted ' + sdFaint + ' foes, herb line ' + herbLine + ')'); continue; }
    const c = play('control', A(''), B, script);
    if (!c.staged) continue;
    w.cast = h.id + ' @ ' + HERB + ' (' + sd.id + ' on turn 3) + ' + pal.id + ' (' + pm.id + ') vs ' + foes.map(f => f.id).join(', ');
    c.cast = 'the same, no item';
    WN = w; CT = c; break outer;
  }
}
console.log('     casts tried: ' + tried);
const RUNS = [['WIN', WN], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
ok(WN.sd.filter(l => /^\|faint\|p2/.test(l)).length === 4, 'WIN: the authority knocks out all four foes (the battle ends)');
const lastHerb = WN.sd.map(String).filter(l => /^\|(-enditem|faint)\|/.test(l)).pop() || '';
ok(/^\|-enditem\|p1a:/.test(lastHerb), 'WIN: the authority spends the herb AFTER the last faint (on the battle-ending move)', lastHerb);
ok(!CT.sd.some(l => /^\|-enditem\|/.test(l)), 'CONTROL: nothing is spent');

K.compareArms(RUNS, KEEP, '-enditem / -clearnegativeboost / faint');
K.finish();
