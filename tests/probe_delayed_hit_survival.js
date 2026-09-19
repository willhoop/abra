#!/usr/bin/env node
/* tests/probe_delayed_hit_survival.js — A FUTURE SIGHT PAYOUT MEETS FOCUS SASH AND STURDY. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_delayed_hit_survival.js --release <id>
 *   MEDI_DELAYED_HIT_NO_SURVIVAL=1 ...   (the two payout survival arms must go RED)
 *   MEDI_SELFHIT_NO_SURVIVAL=1 ...       (the confusion self-hit arm must go RED)
 *
 * ================= THE AUTHORITY, READ, NOT RECALLED ===========================================
 *
 * `futuremove.onEnd` (data/conditions.ts:394-422; `data/mods/champions/conditions.ts` has no
 * futuremove row) builds `hitMove = new this.dex.Move(data.moveData)` and pays out through
 * `this.actions.trySpreadMoveHit([target], data.source, hitMove, true)`. The booked `moveData` carries
 * `effectType: 'Move'` (data/moves.ts futuresight.onTry). The hit's damage goes through `spreadDamage`,
 * which runs the `Damage` event, and both full-HP survival handlers answer it:
 *
 *     focussash.onDamage   if (target.hp === target.maxhp && damage >= target.hp && effect && effect.effectType === 'Move')
 *                            if (target.useItem()) return target.hp - 1;                       data/items.ts:2272-2277
 *     sturdy.onDamage      same test -> add('-ability', target, 'Sturdy'); return target.hp - 1 data/abilities.ts:4673-4677
 *
 * Booked on turn 1, the payout lands at the end of turn 3 (measured on the authority's log).
 * The full-HP test is asked of the collector's HP AT PAYOUT. Endure does NOT apply: the same onEnd
 * removes `Protect` and `Endure` before the hit (data/conditions.ts:404-405).
 *
 * WHOLE-GAME CARD: `…2657391947` (g1950, pair-protect-bust, turn 6) — a Future Sight payout from a
 * fainted Alakazam onto a full-HP Focus Sash Kleavor: the authority prints `|-enditem|p1a: Kleavor|Focus
 * Sash` and leaves 1/145; this engine fainted it.
 *
 * THE CLASS, DERIVED IN §0: every legal item/ability whose handler tests the holder at FULL HP, and every
 * legal delayed payout. Multiscale (a full-HP damage halving, `damageReduce onlyWhen fullHP`) is staged as
 * well — it is priced through `dmgRange` at payout and is expected to agree already.
 *
 * THE OTHER MOVE-TYPED INDIRECT PATH: THE CONFUSION SELF-HIT. `confusion.onBeforeMove` deals it as
 * `this.damage(damage, pokemon, pokemon, { id: 'confused', effectType: 'Move', type: '???' })`
 * (data/conditions.ts:193-194, no Champions override), so the same two handlers answer it. The arm below
 * was FOUND by searching scripts for one whose shared middle-arm die gives a self-hit (a confused body hits
 * itself on 33 in 100); the authority's own stream is asserted to carry it, so a script that stops
 * producing one reads NOT STAGED rather than green.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
if (!process.argv.includes('--release')) {
  console.log('REFUSED — pass --release <id>. This probe measures a frozen engine, never the live tree.');
  process.exit(2);
}
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const NL = String.fromCharCode(10);
const KNOB = process.env.MEDI_DELAYED_HIT_NO_SURVIVAL === '1';
const K_SELF = process.env.MEDI_SELFHIT_NO_SURVIVAL === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split(NL).join(NL + '          '));
  if (!cond) bad++;
};
console.log(NL + 'tests/probe_delayed_hit_survival.js   MEDI_DELAYED_HIT_NO_SURVIVAL=' + (KNOB ? '1 (PRE-FIX)' : '0')
  + '   MEDI_SELFHIT_NO_SURVIVAL=' + (K_SELF ? '1 (PRE-FIX)' : '0'));

/* ---- 0. THE CLASS, DERIVED -------------------------------------------------------------------- */
console.log(NL + '0. THE CLASS IN THIS REGULATION');
const fullHp = [];
for (const [k, t] of [['item', dex.items], ['ability', dex.abilities]]) for (const x of t.all()) {
  if (!legal(x)) continue;
  for (const h of Object.keys(x)) if (typeof x[h] === 'function' && /hp\s*(===|>=)\s*target\.maxhp/.test(String(x[h])))
    fullHp.push(k + ':' + x.id + '.' + h);
}
console.log('     full-HP handlers : ' + fullHp.join(', '));
const delayed = dex.moves.all().filter(m => legal(m) && m.flags && m.flags.futuremove).map(m => m.id);
console.log('     delayed payouts  : ' + delayed.join(', '));
ok(fullHp.includes('item:focussash.onDamage') && fullHp.includes('ability:sturdy.onDamage'),
  'Focus Sash and Sturdy are legal and both answer onDamage from full HP');
ok(delayed.includes('futuresight'), 'Future Sight is the legal delayed payout');
const FM_END = String((dex.conditions.get('futuremove') || {}).onEnd || '');
ok(/trySpreadMoveHit/.test(FM_END) && /removeVolatile\(["']Endure["']\)/.test(FM_END),
  'futuremove.onEnd pays through trySpreadMoveHit and strips Endure first');
const FS_TRY = String(dex.moves.get('futuresight').onTry || '');
ok(/effectType:\s*["']Move["']/.test(FS_TRY), 'the booked moveData carries effectType Move (so the Sash test can pass)');
const CONF_BM = String((dex.conditions.get('confusion') || {}).onBeforeMove || '');
ok(/effectType:\s*["']Move["']/.test(CONF_BM) && /this\.damage\(/.test(CONF_BM),
  'confusion.onBeforeMove deals the self-hit as a Move-typed damage event (so the Sash test can pass)');

/* ---- THE FIXTURE ------------------------------------------------------------------------------ */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const KAZAM = mon('alakazam', '', 'Inner Focus', ['Future Sight', 'Calm Mind', 'Protect']);
const CLEF = mon('clefable', '', 'Unaware', ['Calm Mind', 'Moonblast', 'Protect']);
const BENCH = [mon('garchomp', '', 'Rough Skin', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])];
const SALA = (item) => mon('salazzle', item, 'Oblivious', ['Nasty Plot', 'Protect']);
const AVA = mon('avalugg', '', 'Sturdy', ['Iron Defense', 'Protect']);
const NITE = mon('dragonite', '', 'Multiscale', ['Dragon Dance', 'Protect']);
const A = [KAZAM, CLEF].concat(BENCH);
const B = (lead) => [lead, mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(BENCH);
const FS = { m: 'futuresight', t: 0 }, CM = { m: 'calmmind' }, MB = { m: 'moonblast', t: 0 };
const WEAV = mon('weavile', 'Focus Sash', 'Pressure', ['Swords Dance', 'Protect']);
const UMB = mon('umbreon', '', 'Inner Focus', ['Screech', 'Confuse Ray', 'Calm Mind']);
const SDm = { m: 'swordsdance' };

const SCEN = [
  { id: 'sash-at-full', red: true, who: 'Salazzle', saved: /^\|-enditem\|p2a: Salazzle\|Focus Sash/,
    what: 'THE CARD. The payout is lethal into a full-HP Focus Sash Salazzle (Psychic into Poison). The '
        + 'authority spends the Sash and leaves 1 HP.',
    A, B: B(SALA('Focus Sash')),
    script: [{ p1: [FS, CM], p2: [{ m: 'nastyplot' }, CM] }, { p1: [CM, CM], p2: [{ m: 'nastyplot' }, CM] }, { p1: [CM, CM], p2: [{ m: 'nastyplot' }, CM] } ] },
  { id: 'sturdy-at-full', red: true, who: 'Avalugg', saved: /^\|-ability\|p2a: Avalugg\|Sturdy/,
    what: 'The same payout into a full-HP Sturdy Avalugg. The authority announces Sturdy and leaves 1 HP.',
    A, B: B(AVA),
    script: [{ p1: [FS, CM], p2: [{ m: 'irondefense' }, CM] }, { p1: [CM, CM], p2: [{ m: 'irondefense' }, CM] }, { p1: [CM, CM], p2: [{ m: 'irondefense' }, CM] } ] },
  { id: 'sash-not-full', red: false, who: 'Salazzle', saved: null,
    what: 'CONTROL, THE GATE. Clefable chips the Sash Salazzle with Moonblast on turn 1, so at payout it is '
        + 'NOT at full HP and the payout kills it on both engines. A fix that saved every Sash holder breaks here.',
    A, B: B(SALA('Focus Sash')),
    script: [{ p1: [FS, MB], p2: [{ m: 'nastyplot' }, CM] }, { p1: [CM, CM], p2: [{ m: 'nastyplot' }, CM] }, { p1: [CM, CM], p2: [{ m: 'nastyplot' }, CM] } ] },
  { id: 'no-sash', red: false, who: 'Salazzle', saved: null,
    what: 'CONTROL, THE CARRIER. The first arm with no item: the payout kills on both engines, so the '
        + 'instrument can see a faint here.',
    A, B: B(SALA('')),
    script: [{ p1: [FS, CM], p2: [{ m: 'nastyplot' }, CM] }, { p1: [CM, CM], p2: [{ m: 'nastyplot' }, CM] }, { p1: [CM, CM], p2: [{ m: 'nastyplot' }, CM] } ] },
  { id: 'confusion-selfhit-sash', self: true, who: 'Weavile', saved: /^\|-enditem\|p1a: Weavile\|Focus Sash/,
    what: 'A confused full-HP Focus Sash Weavile at +6 Attack and -2 Defense hits itself for lethal damage on '
        + 'turn 6. The authority spends the Sash and leaves 1 HP.',
    A: [WEAV, CLEF].concat(BENCH), B: [UMB, mon('clefable', '', 'Unaware', ['Calm Mind', 'Protect'])].concat(BENCH),
    script: [{ p1: [SDm, CM], p2: [{ m: 'screech', t: 0 }, CM] }, { p1: [SDm, CM], p2: [CM, CM] },
             { p1: [SDm, CM], p2: [CM, CM] }, { p1: [SDm, CM], p2: [CM, CM] },
             { p1: [SDm, CM], p2: [{ m: 'confuseray', t: 0 }, CM] }, { p1: [SDm, CM], p2: [CM, CM] }] },
  { id: 'multiscale-at-full', red: false, who: 'Dragonite', saved: null,
    what: 'The full-HP damage halving at payout (Multiscale). Priced through dmgRange at the payout; '
        + 'expected to agree before and after.',
    A, B: B(NITE),
    script: [{ p1: [FS, CM], p2: [{ m: 'dragondance' }, CM] }, { p1: [CM, CM], p2: [{ m: 'dragondance' }, CM] }, { p1: [CM, CM], p2: [{ m: 'dragondance' }, CM] } ] },
];

let illegal = 0;
const seen = new Set();
for (const sc of SCEN) for (const row of sc.A.concat(sc.B)) {
  const key = JSON.stringify(row); if (seen.has(key)) continue; seen.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('  ILLEGAL  ' + row.species); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) { console.log('  ILLEGAL  ' + row.item); illegal++; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id).includes(dex.abilities.get(row.ability).id)) {
    console.log('  ILLEGAL  ' + sp.name + ' / ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    if (!legal(dex.moves.get(mv))) { console.log('  ILLEGAL  ' + mv); illegal++; continue; }
    if (!CS.canLearn(row.species, mv)) { console.log('  ILLEGAL  ' + sp.name + ' does not learn ' + mv); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture cell(s). This is not a pass.'); process.exit(2); }

/* ---- 1. THE ARMS ------------------------------------------------------------------------------- */
console.log(NL + '1. THE ARMS, BOTH ENGINES');
const G = SB.harness();
for (const sc of SCEN) {
  const r = SB.runOne(sc);
  const sdLog = G.sdStream(G.lastSdLog()).map(String);
  /* the payout turn: Future Sight booked on turn 1 pays at the end of turn 3 */
  const N = sc.script.length;
  const from = sdLog.indexOf('|turn|' + N), to = sdLog.indexOf('|turn|' + (N + 1));
  const tN = from < 0 ? [] : sdLog.slice(from, to < 0 ? sdLog.length : to);
  const paid = tN.some(l => /^\|-end\|p2a: [^|]*\|move: Future Sight/.test(l));
  const fainted = tN.some(l => new RegExp('^\\|faint\\|p[12]a: ' + sc.who).test(l));
  const saved = sc.saved ? tN.some(l => sc.saved.test(l)) : false;
  console.log(NL + '  ' + sc.id + (sc.red ? '   [governed by MEDI_DELAYED_HIT_NO_SURVIVAL]'
    : sc.self ? '   [governed by MEDI_SELFHIT_NO_SURVIVAL]' : '   [control]'));
  console.log('    ' + sc.what);
  /* THE INSTRUMENT: the payout happened on the authority, and the collector ended as the arm claims. */
  if (sc.self) {
    const selfHit = tN.some(l => /^\|-damage\|p1a: Weavile\|[^|]*\|\[from\] confusion/.test(l));
    ok(selfHit && saved && !fainted, 'authority: Weavile hit itself, spent the Sash and lived (selfhit=' + selfHit
      + ', saved=' + saved + ', fainted=' + fainted + ')' + (selfHit ? '' : '  -- NOT STAGED: the shared die gave no self-hit'));
  } else if (sc.red) ok(paid && saved && !fainted, 'authority: payout landed, ' + sc.who + ' saved and alive (paid=' + paid + ', saved=' + saved + ', fainted=' + fainted + ')');
  else if (sc.id === 'multiscale-at-full') ok(paid && !fainted, 'authority: payout landed and ' + sc.who + ' survived on its own bulk (paid=' + paid + ', fainted=' + fainted + ')');
  else ok(paid && fainted, 'authority: payout landed and ' + sc.who + ' fainted (paid=' + paid + ', fainted=' + fainted + ')');
  ok(r.script && r.script.moveNotOnRequest === 0, 'every scripted click was on the request',
    r.script && r.script.moveNotOnRequest ? 'first missing: ' + r.script.firstMissing : null);
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us) + ' / authority ' + JSON.stringify(d.sd))
        .join(NL)).filter(Boolean).join(NL));
  if ((sc.red && KNOB) || (sc.self && K_SELF)) ok(r.verdict !== 'IDENTICAL', 'boards DIFFER under the knob -> ' + r.verdict + ' (this is what makes the arm a red one)');
  else ok(r.verdict === 'IDENTICAL', 'boards -> ' + r.verdict, detail);
}

console.log(NL + '2. THE COUNTERS AND THE STAMP');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const F = (M && M.MEDFAILS) || {}, S = (M && M.MEDSEEN) || {};
console.log('     MEDSEEN.delayedHitSurvived ' + S.delayedHitSurvived + '   delayedHitLanded ' + S.delayedHitLanded);
ok((F.delayedHitNoSurvivalRestored || 0) === (KNOB ? 1 : 0),
  'MEDFAILS.delayedHitNoSurvivalRestored = ' + F.delayedHitNoSurvivalRestored + ' (expected ' + (KNOB ? 1 : 0) + ')');
ok(KNOB || (S.delayedHitSurvived || 0) >= 2, 'the payout survival branch ran on both red arms (delayedHitSurvived >= 2)');
console.log('     MEDSEEN.confusionSelfHitSurvived ' + S.confusionSelfHitSurvived);
ok((F.selfHitNoSurvivalRestored || 0) === (K_SELF ? 1 : 0),
  'MEDFAILS.selfHitNoSurvivalRestored = ' + F.selfHitNoSurvivalRestored + ' (expected ' + (K_SELF ? 1 : 0) + ')');
ok(K_SELF || (S.confusionSelfHitSurvived || 0) >= 1, 'the self-hit survival branch ran (confusionSelfHitSurvived >= 1)');

console.log(NL + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed') + '   release ' + G.REL.id);
process.exit(bad ? 1 : 0);
