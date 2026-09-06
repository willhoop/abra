/* probe_pickpocket_on_a_corpse.js — A FAINTED BODY'S ABILITY IS IGNORED, SO A PICKPOCKET THAT DIED
 * TO THE CONTACT HIT STEALS NOTHING.
 *
 *   SHOWDOWN_PATH=... node tests/probe_pickpocket_on_a_corpse.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `8f446527f6f4`
 * (`data/game-differential.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), one board-material game, `any`-bucket verdict SHARED COINS:
 *
 *   extra event emitted by medicham2 :: |move|p2a|waterfall <> |-enditem|p2b|widelens|[from]pickpocket
 *
 *     showdown   |-damage|p1a: Tinkaton|0 fnt
 *                |faint|p1a: Tinkaton
 *                |-hitcount|p1:|2
 *                |move|p2a: Gyarados|Waterfall|p1b: Sableye
 *     medicham2  …the same three lines, and then
 *                |-enditem|p2b: Talonflame|widelens|[silent]|[from] ability: pickpocket
 *                |-item|p1a: Tinkaton|widelens|[from] ability: pickpocket
 *
 * A Talonflame's Dual Wing Beat killed a Tinkaton, and this engine then handed the CORPSE the
 * attacker's Wide Lens. Two bodies' items wrong, one of them a party leaf that lasts the game.
 *
 * IT IS THE OTHER HALF OF BATCH E's PICKPOCKET FIX, AND IT WAS INVISIBLE UNTIL THAT LANDED. The
 * theft used to be paid inside the per-hit reaction block, ABOVE `faintMessages`, where the thief was
 * not a corpse yet. Batch E moved the payment to the authority's own position — `AfterMoveSecondary`,
 * sim/battle-actions.ts:1005, below `faintMessages` at scripts.ts:547 — which is correct and which is
 * what put the handler on a dead body for the first time.
 *
 * THE RULE, READ OFF THE AUTHORITY, AND PICKPOCKET'S OWN HANDLER IS NOT WHERE IT LIVES.
 *
 *     pickpocket.onAfterMoveSecondary(target, source, move) {
 *       if (source && source !== target && move?.flags['contact']) {
 *         if (target.item || target.switchFlag || target.forceSwitchFlag ||
 *             source.switchFlag === true) return;                         data/abilities.ts:3230
 *
 * — there is no hp test and no fainted test in it. The refusal is one level up, in `runEvent`:
 *
 *     } else if (eventid !== 'End' && effect.effectType === 'Ability' &&
 *                (effectHolder instanceof Pokemon) && effectHolder.ignoringAbility()) { … continue; }
 *                                                                              sim/battle.ts
 *     ignoringAbility() { if (this.battle.gen >= 5 && !this.isActive) return true; … }
 *                                                                              sim/pokemon.ts
 *     faintMessages(): … pokemon.fainted = true; pokemon.isActive = false;      sim/battle.ts:2563-4
 *
 * So `faintMessages` clears `isActive`, `ignoringAbility()` then answers true, and EVERY ability
 * handler on that body — not only Pickpocket's — is skipped for the rest of the event, `End` alone
 * excepted. This probe measures the Pickpocket case because that is the one the differential caught;
 * the engine wires it at the Pickpocket payment and says so, rather than claiming to have implemented
 * the general clause everywhere.
 *
 * THE FIXTURE. The attacker holds a stealable item; the thief has Pickpocket and an EMPTY hand; and
 * the only thing that varies between the two arms is WHICH contact move is clicked:
 *
 *   LETHAL   a contact move that KOs the thief   -> `faintMessages` runs, the ability is ignored,
 *                                                   nothing is stolen
 *   SURVIVES a weaker contact move from the SAME attacker on the SAME body -> the theft happens
 *
 * Same two bodies, same items, same turn — the varied knob is lethality and nothing else.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_PICKPOCKET_ON_A_CORPSE === '1';
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];

let bad = 0;
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* ---- THE THIEF'S ABILITY IS THE TAG'S: it steals FROM THE ATTACKER, AFTER BEING HIT. */
const THIEVES = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('stealsItem'))
  .map(([k, v]) => ({ id: k, p: v.params.stealsItem, uses: v.uses || 0 }));
console.log('  abilities tagged `stealsItem`:');
for (const t of THIEVES) console.log('      ' + t.id.padEnd(14) + JSON.stringify(t.p) + '  (' + t.uses + ' sheets)');
const TH = THIEVES.filter(t => t.p && t.p.takesFrom === 'attacker' && t.p.onlyMoveFlag === 'contact')
  .sort((a, b) => b.uses - a.uses)[0];
if (!TH) { console.log('  NO ON-BEING-HIT ITEM THIEF — a claim about the format.'); process.exit(2); }

/* ---- THE ITEM THE ATTACKER CARRIES. Inert on purpose: not a berry (it could be eaten before the
 * theft), not a mega stone (`itemRefusesTake`), and nothing that heals or chips. */
const itemTags = id => ((TAGS.items[norm(id)] || {}).tags || []);
const CARRY = dex.items.all().filter(i => i.exists && !i.isNonstandard && !i.isBerry && !i.megaStone
  && !i.onTakeItem && !itemTags(i.id).some(t => /passiveHeal|healsAtThreshold|residual|damagesHolder|curesStatus/i.test(t)))
  .sort((a, b) => ((TAGS.items[norm(b.id)] || {}).uses || 0) - ((TAGS.items[norm(a.id)] || {}).uses || 0));
console.log('  inert stealable items              : '
  + (CARRY.slice(0, 5).map(i => i.id).join(', ') || 'NONE') + (CARRY.length > 5 ? ' … ' + CARRY.length + ' total' : ''));
if (!CARRY.length) { console.log('  NO INERT STEALABLE ITEM — a claim about the format.'); process.exit(2); }
const ITEM = CARRY[0];

const SELF_HOLD = (s) => {
  const bad2 = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (bad2.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};

/* ---- THE BUILT STAT LINE IS THE BUILDER'S. */
const FILLER0 = POOL.filter(s => LEARNS(s, 'protect')).slice(0, 3);
const built = new Map(); const BUILD_FAILED = [];
const buildOne = (s) => {
  if (built.has(s.name)) return built.get(s.name);
  let row = null;
  try {
    const p = G.buildPair([{ species: s.name, item: '', ability: '', moves: ['Protect'] },
      ...FILLER0.filter(f => f.name !== s.name).slice(0, 3)
        .map(f => ({ species: f.name, item: '', ability: '', moves: ['Protect'] }))]);
    if (p) { const st = p[0].medi.st; row = { hp: st.hp, at: st.at, df: st.df, sa: st.sa, sd: st.sd }; }
    else BUILD_FAILED.push(s.name + ': buildPair returned null');
  } catch (e) { BUILD_FAILED.push(s.name + ': ' + String((e && e.message) || e)); }
  built.set(s.name, row);
  return row;
};
const minDamage = (bp, atk, def, stab, eff) => {
  let d = Math.floor(Math.floor(Math.floor(2 * 50 / 5 + 2) * bp * atk / def) / 50) + 2;
  d = Math.floor(Math.floor(d * stab) * eff);
  return Math.floor(d * 85 / 100);
};
const maxDamage = (bp, atk, def, stab, eff) => {
  let d = Math.floor(Math.floor(Math.floor(2 * 50 / 5 + 2) * bp * atk / def) / 50) + 2;
  d = Math.floor(Math.floor(d * stab) * eff);
  return Math.floor(d * 1.5);        // a crit at the top roll — the SURVIVES arm must beat this
};

const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const REFUSE_A = new Set(['damageBoost', 'writesAccuracy', 'accuracyMod', 'punishesContact']);
const pickAbility = (sp, refuse) => Object.values(sp.abilities)
  .find(ab => !abilityTags(ab).some(t => refuse.has(t))) || null;

/* `basePower > 0` IS LOAD-BEARING AND WAS MISSING ON THE FIRST RUN. Without it the SURVIVES arm was
 * staged with ENDEAVOR, whose base power is 0 and which simply FAILS from a full-HP user — so the
 * control arm made no contact at all and the authority stole nothing in EITHER arm, which reads as
 * the authority contradicting the rule rather than as a fixture that was never set. */
const CONTACT = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.flags && m.flags.contact
  && m.category !== 'Status' && m.basePower > 0 && m.damage == null
  && m.target === 'normal' && (m.accuracy === true || m.accuracy === 100)
  && !m.multihit && !m.recoil && !m.selfSwitch && !m.flags.charge && !m.secondaries);
console.log('  100-accuracy single-hit contact moves with no recoil / pivot / secondary: ' + CONTACT.length);
if (!CONTACT.length) { console.log('  NONE — a claim about the format.'); process.exit(2); }

/* THE THIEF: a legal carrier of the tagged ability with a safe self-move. */
const THIEF_POOL = POOL.filter(s => Object.values(s.abilities).some(a => norm(a) === TH.id)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
console.log('  legal carriers of ' + TH.id + ': ' + (THIEF_POOL.map(s => s.name).join(', ') || 'NONE'));
if (!THIEF_POOL.length) { console.log('  NO CARRIER — a claim about the format.'); process.exit(2); }

/* THE SEARCH. One attacker, one thief, and TWO of the attacker's contact moves: one lethal from full
 * at the MINIMUM roll, one that cannot kill even at a top-roll crit. The model only proposes; the run
 * below proves the KO happened and proves the other one did not. */
const rows = [];
for (const T of THIEF_POOL) {
  const bt = buildOne(T); if (!bt) continue;
  const T_AB = Object.values(T.abilities).find(a => norm(a) === TH.id);
  for (const A of POOL) {
    if (A.name === T.name || G.CLOSET_SPECIES.has(norm(A.id))) continue;
    const A_AB = pickAbility(A, REFUSE_A); if (!A_AB) continue;
    if (!SELF_HOLD(A)) continue;
    const ba = buildOne(A); if (!ba) continue;
    let kill = null, weak = null;
    for (const mv of CONTACT) {
      if (!LEARNS(A, mv.id)) continue;
      if (!dex.getImmunity(mv.type, T)) continue;
      const eff = Math.pow(2, dex.getEffectiveness(mv.type, T));
      const stab = A.types.includes(mv.type) ? 1.5 : 1;
      const dn = minDamage(mv.basePower, mv.category === 'Physical' ? ba.at : ba.sa,
        mv.category === 'Physical' ? bt.df : bt.sd, stab, eff);
      const dx = maxDamage(mv.basePower, mv.category === 'Physical' ? ba.at : ba.sa,
        mv.category === 'Physical' ? bt.df : bt.sd, stab, eff);
      if (dn >= bt.hp && (!kill || dn - bt.hp > kill.margin)) kill = { mv, margin: dn - bt.hp };
      if (dx < bt.hp && (!weak || bt.hp - dx > weak.margin)) weak = { mv, margin: bt.hp - dx };
    }
    if (kill && weak) rows.push({ A, A_AB, T, T_AB, bt, ba, kill, weak, score: kill.margin + weak.margin });
  }
}
console.log('  bodies asked of the builder        : ' + built.size + ', of which ' + BUILD_FAILED.length + ' would not build');
if (!rows.length) { console.log('  NO ATTACKER WITH BOTH A LETHAL AND A NON-LETHAL CONTACT MOVE — a claim about the fixture.'); process.exit(2); }
rows.sort((a, b) => b.score - a.score || a.A.name.localeCompare(b.A.name) || a.T.name.localeCompare(b.T.name));

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });

const runArm = (F, lethal, tag) => {
  const MV = lethal ? F.kill.mv : F.weak.mv;
  const FILL = POOL.filter(s => ![F.A.name, F.T.name].includes(s.name)
    && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 6);
  if (FILL.length < 6) return { staged: false, why: 'not enough filler' };
  const sideA = [mon(F.A.name, [F.kill.mv.name, F.weak.mv.name], ITEM.name, F.A_AB),
    mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
    mon(FILL[2].name, [SELF_HOLD(FILL[2])])];
  const sideB = [mon(F.T.name, [SELF_HOLD(F.T)], '', F.T_AB),
    mon(FILL[3].name, [SELF_HOLD(FILL[3])]), mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
    mon(FILL[5].name, [SELF_HOLD(FILL[5])])];
  const SCRIPT = [{ p1: [{ m: norm(MV.id), t: 0 }, { m: norm(SELF_HOLD(FILL[0])) }],
                    p2: [{ m: norm(SELF_HOLD(F.T)) }, { m: norm(SELF_HOLD(FILL[3])) }] }];
  const a = G.buildPair(sideA), b = G.buildPair(sideB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'ppcorpse/' + tag, { arm: G.ARM_BY_ID.get('middle'), script: SCRIPT });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = G.lastSdLog(), me = r.mediTrace || [];
  /* THE OUTCOME IS THE `|-item|` LINE: who is holding the stolen item afterwards. Counted on both
   * streams, and the ROSTER is read too so the claim is about state and not only narration. */
  const gained = (lines) => lines.filter(l => /^\|-item\|/.test(String(l))
    && new RegExp(norm(ITEM.name), 'i').test(norm(String(l)))).length;
  const fr = r.finalRoster || {};
  const p2 = ((fr.showdown && fr.showdown.p2) || {}).mons || [];
  const meP2 = (fr.medicham && fr.medicham.p2) || [];
  const thiefSd = p2.find(x => norm(x.key || x.name) === norm(F.T.name));
  const thiefMe = meP2.find(x => norm(x.key || x.name) === norm(F.T.name));
  return { staged: true, r,
           /* THE ROSTER IS READ FOR THE FIXTURE ONLY, AND ONLY ON THE AUTHORITY'S SIDE. `mediSide`
            * (engine/game_differential.js:4585) carries no `item` field at all, so a medicham item
            * read here is `undefined` and an assertion on it would compare '' against '' and pass on
            * a working engine and a broken one alike. Every claim about medicham2 below is made on
            * its STREAM, where the `|-item|` line either exists or does not. */
           thiefFaintedSd: !!(thiefSd && thiefSd.fainted), thiefFaintedMe: !!(thiefMe && thiefMe.fainted),
           sdSteals: gained(sd), meSteals: gained(me),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

/* WALK THE CANDIDATES AND PLAY THEM. The model orders; the run decides. */
let F = null, KILLARM = null, tried = 0;
console.log('  candidates ranked by modelled margin, then PLAYED:');
for (const cand of rows) {
  if (tried >= 6) break;
  tried++;
  const label = cand.A.name + ' ' + cand.kill.mv.id + '/' + cand.weak.mv.id + ' -> ' + cand.T.name;
  const k = runArm(cand, true, 'probe-lethal');
  if (!k.staged) { console.log('      skip  ' + label.padEnd(52) + 'NOT STAGED: ' + k.why); continue; }
  const ok = k.thiefFaintedSd;
  console.log('      ' + (ok ? 'TAKE' : 'no  ') + '  ' + label.padEnd(52)
    + 'lethal arm: thief ' + (ok ? 'DIED' : 'survived'));
  if (ok) { F = cand; KILLARM = k; break; }
}
if (!F) { console.log('  NO CANDIDATE STAGED IN ' + tried + ' TRIES — a claim about the fixture. Nothing was measured.'); process.exit(2); }

console.log('\n  chosen  : ' + F.A.name + ' [' + F.A_AB + '] holding ' + ITEM.name + ' hits '
  + F.T.name + ' [' + F.T_AB + '], empty-handed');
console.log('            LETHAL arm   ' + F.kill.mv.id + '  (bp ' + F.kill.mv.basePower + ')');
console.log('            SURVIVES arm ' + F.weak.mv.id + '  (bp ' + F.weak.mv.basePower + ') — same attacker, same target');
console.log('            THE AUTHORITY clears `isActive` in faintMessages (sim/battle.ts:2564), '
  + '`ignoringAbility()` then answers true, and runEvent skips every Ability handler on that body.');

console.log('\n  === THE LETHAL ARM — the thief dies to the contact hit ===');
const KILL = CHILD ? runArm(F, true, 'control') : KILLARM;
if (!KILL.staged) { console.log('  NOT STAGED — ' + KILL.why); process.exit(1); }
console.log('  the thief (showdown)     : ' + (KILL.thiefFaintedSd ? 'FAINTED' : 'alive'));
console.log('  `|-item|` lines for ' + ITEM.name + ' : showdown ' + KILL.sdSteals + '   medicham2 ' + KILL.meSteals);
/* THE HAND IS READ OFF THE STREAMS AND NOT OFF THE ROSTER. Neither roster projection in
 * engine/game_differential.js carries an `item` field — `mediSide` at :4585 and `sdSide` at :4611
 * both stop at name/key/hp/fainted/where — so an item read there is undefined on BOTH sides and an
 * assertion on it would compare undefined with undefined and pass on a broken engine too. */
console.log('  first protocol divergence: ' + (KILL.div ? JSON.stringify(KILL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — the same two bodies, a weaker contact move ===');
const LIVE = runArm(F, false, CHILD ? 'silent-control' : 'survives');
if (!LIVE.staged) { console.log('  NOT STAGED — ' + LIVE.why); process.exit(1); }
console.log('  the thief (showdown)     : ' + (LIVE.thiefFaintedSd ? 'FAINTED' : 'alive'));
console.log('  `|-item|` lines for ' + ITEM.name + ' : showdown ' + LIVE.sdSteals + '   medicham2 ' + LIVE.meSteals);
/* THE HAND IS READ OFF THE STREAMS AND NOT OFF THE ROSTER. Neither roster projection in
 * engine/game_differential.js carries an `item` field — `mediSide` at :4585 and `sdSide` at :4611
 * both stop at name/key/hp/fainted/where — so an item read there is undefined on BOTH sides and an
 * assertion on it would compare undefined with undefined and pass on a broken engine too. */

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_PICKPOCKET_ON_A_CORPSE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ killMe: KILL.meSteals, killSd: KILL.sdSteals,
    div: !!KILL.div, divLine: KILL.div && KILL.div.me, liveMe: LIVE.meSteals }));
  console.log('\ngreen — the control arm ran');
  process.exit(0);
}

console.log('\n  === THE VERDICT ===');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
    + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
  return ok;
};
need('the thief DIED in the lethal arm (the fixture)', KILL.thiefFaintedSd, true);
need('...and survived in the control arm (the fixture)', LIVE.thiefFaintedSd, false);
need('showdown steals NOTHING from a corpse (the authority)', KILL.sdSteals, 0);
need('showdown DOES steal when the thief lives (the authority, the other way)', LIVE.sdSteals, 1);
need('medicham2 steals nothing either', KILL.meSteals, 0);
need('medicham2 still steals when the thief lives', LIVE.meSteals, 1);
need('the lethal game does not part at all', KILL.div, null);
need('the control game does not part at all', LIVE.div, null);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_PICKPOCKET_ON_A_CORPSE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_PICKPOCKET_ON_A_CORPSE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.killMe !== KILL.meSteals;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the lethal arm: default '
      + KILL.meSteals + ' theft(s)  vs control ' + ctl.killMe);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.killMe !== 1) { console.log('  RED    the control arm did not steal exactly once, so it is not the old behaviour.'); bad++; }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on its own line: ' + ctl.divLine);
    if (ctl.liveMe !== LIVE.meSteals) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + LIVE.meSteals
        + ' -> ' + ctl.liveMe + ' theft(s)).'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.liveMe + ' theft)');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
