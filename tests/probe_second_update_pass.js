/* probe_second_update_pass.js — THE AUTHORITY RAISES `Update` TWICE INSIDE A MOVE, AND THE SECOND
 * ONE IS BELOW THE RECOIL. THIS ENGINE HAD ONLY THE FIRST.
 *
 *   SHOWDOWN_PATH=... node tests/probe_second_update_pass.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential on release `2a5fd78725e7`
 * (`data/verification/longtail-E-baseline.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`) has TWO board-material games with the same cause, and the `any`-dice join
 * says both drew SHARED COINS — so the simulator owns them:
 *
 *     medicham2 stopped emitting while showdown continued :: |-enditem|p2b|sitrusberry|[eat]
 *     medicham2 stopped emitting while showdown continued :: |-enditem|p1b|sitrusberry|[eat]
 *
 *     showdown   |-damage|p2b: Incineroar|81/170|[from] Recoil
 *                |-enditem|p2b: Incineroar|Sitrus Berry|[eat]
 *                |-heal|p2b: Incineroar|123/170|[from] item: Sitrus Berry
 *     medicham2  |-damage|p2b: Incineroar|81/170|[from] Recoil        (and nothing further)
 *
 * THE RULE, READ OFF THE CHAMPIONS MOD ITSELF rather than mainline — `hitStepMoveHitLoop` is one of
 * the methods the mod overrides, and it keeps both passes verbatim
 * (`data/mods/champions/scripts.ts`, mainline line numbers in brackets):
 *
 *     this.battle.eachEvent('Update');                                    :538   [:967]
 *     ...
 *     this.battle.faintMessages(false, false, !pokemon.hp);               :547   [:976]
 *     if (move.multihit ...) this.battle.add('-hitcount', ...);           :550   [:978]
 *     if (move.totalDamage) this.applyRecoilDamage(...);                  :554   [:982]
 *     ...
 *     if (!damage.some(val => !!val || val === 0)) return damage;         :572   [:1001]
 *     this.battle.eachEvent('Update');                                    :575   [:1003]
 *     this.afterMoveSecondaryEvent(...);                                  :577   [:1005]
 *
 * `_updateEvent`'s own header in medicham2-browser.js has DECLARED this omission since 2026-08-23
 * ("the authority's SECOND in-move pass at :1003 ... is NOT added here"). What it did not say is what
 * it costs, and the answer is not "a line arrives late":
 *
 * WHY THE BETWEEN-ACTION PASS DOES NOT COVER IT. medicham2 runs `_updateAll()` at the top of every
 * action and once more below the last one — and BOTH call sites sit UNDER
 * `if(sideWiped(S)){...break _TURN;}`. So a move that ENDS THE BATTLE never reaches the pass at all,
 * and the attacker walks off the field holding a berry the authority ate. In every other shape the
 * two engines coincide, because nothing is emitted between the recoil and the next action's pass —
 * which is exactly why only two games in 961 show it, and why a one-turn fixture cannot express it.
 *
 * SO THE FIXTURE IS A SIDE WIPE, AND EVERY NUMBER IN IT IS DERIVED THIS RUN:
 *
 *   - the recoil move is searched out of `Dex.forFormat('gen9championsvgc2026regmb')` — 100 accuracy
 *     (so the arm's accuracy die cannot make this a flake) and a recoil fraction;
 *   - the TARGET is searched so that the hit is LETHAL FROM FULL at the arm's minimum roll, which
 *     makes `dealt` exactly the target's built max HP — a constant under any roll and any crit,
 *     the same clamp trick `tests/probe_recoil_after_clamp.js` uses;
 *   - the ATTACKER is searched so that `round(dealt * r0/r1)` lands STRICTLY between half its own
 *     built max HP and all of it: the recoil must cross the pinch line without killing it;
 *   - the other three bodies on the defending side are Memento carriers. Memento is
 *     `selfdestruct: 'ifHit'` with `target: 'normal'`, so each one faints itself with no damage to
 *     anything, aimed at the attacker's PARTNER so the attacker is never touched. (Healing Wish was
 *     the first choice and is WRONG here: its `onTryHit` fails when the side cannot switch, so the
 *     third one would have survived and the side would never have been wiped.)
 *
 * THE THREE ARMS:
 *   REAL      the attacker holds the pinch berry. Both engines must land on the same HP.
 *   CONTROL   the same board with `MEDI_NO_SECOND_INMOVE_UPDATE=1`. It must PART from the authority;
 *             an identical result across a varied knob means the knob is unwired.
 *   SILENT    the same board with the berry replaced by nothing. Neither engine can settle anything
 *             at either pass, so this arm must NOT move under the knob — that is what says the fix is
 *             the Update pass and not "medicham2 heals more".
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_NO_SECOND_INMOVE_UPDATE === '1';

/* The preload, for `probe_recoil_after_clamp.js`'s reason: this file must stay runnable as a plain
 * `node tests/<it>.js` so `engine/register_reality.js` can execute it. */
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

/* ---- THE PINCH ITEM. It must be DETERMINISTIC and it must be settled on the `Update` event, which
 * is what puts it in this pass rather than in the residual. Read off the tag, never named. */
const PINCH = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('healsAtThreshold'))
  .map(([k, v]) => ({ id: k, p: v.params.healsAtThreshold, uses: v.uses || 0 }))
  .filter(x => dex.items.get(x.id).exists && !dex.items.get(x.id).isNonstandard)
  .sort((a, b) => b.uses - a.uses);
console.log('  items tagged healsAtThreshold      :');
for (const s of PINCH.slice(0, 6)) console.log('      ' + s.id.padEnd(14) + ' ' + JSON.stringify(s.p)
  + '  (' + s.uses + ' sheets)');
if (!PINCH.length) { console.log('  NO PINCH-HEAL ITEM IN THIS FORMAT — a claim about the artifact.'); process.exit(2); }
const BERRY = PINCH[0];
const BERRY_ITEM = dex.items.get(BERRY.id);

/* ---- THE ARITHMETIC IS THE AUTHORITY'S, TWO LINES, BOTH CITED --------------------------------- */
/* sim/battle-actions.ts:1384  clampIntRange(Math.round(damageDealt * move.recoil[0] / move.recoil[1]), 1) */
const recoilOf = (mv, dealt) => Math.max(1, Math.round(dealt * mv.recoil[0] / mv.recoil[1]));
/* data/items.ts sitrusberry  onEat: this.heal(pokemon.baseMaxhp / 4)   ->  Battle#heal truncates. */
const healOf = (H) => { const d = +BERRY.p.heal === +BERRY.p.heal ? H * +BERRY.p.heal : H / 4; return Math.trunc(d); };

/* THE BUILT STAT LINE IS THE ONE THAT MATTERS and it is read out of the builder, never modelled.
 * A body that will not build is COUNTED and NAMED — `probe_recoil_after_clamp.js`'s rule. */
const FILLER0 = POOL.filter(s => LEARNS(s, 'protect')).slice(0, 3);
const built = new Map(); const BUILD_FAILED = [];
const buildOne = (s) => {
  if (built.has(s.name)) return built.get(s.name);
  let row = null;
  try {
    const p = G.buildPair([{ species: s.name, item: '', ability: '', moves: ['Protect'] },
      ...FILLER0.filter(f => f.name !== s.name).slice(0, 3)
        .map(f => ({ species: f.name, item: '', ability: '', moves: ['Protect'] }))]);
    /* THE KEYS ARE THE ENGINE'S OWN (`l50` -> hp/at/df/sa/sd/sp), NOT Showdown's spelling. Reading
     * `st.atk` here returned `undefined`, the modelled damage came out NaN, and `NaN < hp` is FALSE —
     * so the lethality filter silently passed EVERY row and the search proposed a fixture whose hit
     * could not kill. A silent default looks exactly like a working feature; this asserts instead. */
    if (p) {
      const st = p[0].medi.st;
      for (const k of ['hp', 'at', 'df', 'sa', 'sd']) {
        if (typeof st[k] !== 'number') throw new Error('built stat line has no numeric `' + k + '` — keys are ' + Object.keys(st).join(','));
      }
      row = { hp: st.hp, at: st.at, df: st.df, sa: st.sa, sd: st.sd };
    }
    else BUILD_FAILED.push(s.name + ': buildPair returned null');
  } catch (e) { BUILD_FAILED.push(s.name + ': ' + String((e && e.message) || e)); }
  built.set(s.name, row);
  return row;
};

/* ---- THE SEARCH --------------------------------------------------------------------------------
 * Nothing below is typed: the recoil set, the accuracy filter, the type chart and the damage formula
 * all come out of the format. The one modelled quantity is the MINIMUM-roll damage, and it is used
 * only to PROPOSE a fixture — the run itself proves the KO happened. */
const RECOILS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.recoil
  && m.basePower > 0 && (m.accuracy === true || m.accuracy === 100)
  && (m.target === 'normal' || m.target === 'any'));
console.log('  100-accuracy recoil moves legal here:');
for (const m of RECOILS) console.log('      ' + m.id.padEnd(12) + ' recoil ' + JSON.stringify(m.recoil)
  + '  bp ' + m.basePower + '  ' + m.type + '/' + m.category);
if (!RECOILS.length) { console.log('  NONE — a claim about the format.'); process.exit(2); }

/* Showdown's own damage line, min roll (`85/100`), at level 50 with no boosts and no weather. */
const minDamage = (bp, atk, def, stab, eff) => {
  let d = Math.floor(Math.floor(Math.floor(2 * 50 / 5 + 2) * bp * atk / def) / 50) + 2;
  d = Math.floor(Math.floor(d * stab) * eff);
  return Math.floor(d * 85 / 100);
};

const rows = [];
for (const mv of RECOILS) {
  const attackers = POOL.filter(s => LEARNS(s, mv.id));
  if (!attackers.length) continue;
  for (const T of POOL) {
    if (!dex.getImmunity(mv.type, T)) continue;
    const eff = Math.pow(2, dex.getEffectiveness(mv.type, T));
    const bt = buildOne(T); if (!bt) continue;
    const rc = recoilOf(mv, bt.hp);
    for (const A of attackers) {
      const ba = buildOne(A); if (!ba) continue;
      if (!(rc > ba.hp / 2 && rc < ba.hp)) continue;           // crosses the pinch line, does not kill
      const stab = A.types.includes(mv.type) ? 1.5 : 1;
      const dmin = minDamage(mv.basePower, mv.category === 'Physical' ? ba.at : ba.sa,
        mv.category === 'Physical' ? bt.df : bt.sd, stab, eff);
      if (!(dmin >= bt.hp)) continue;                           // must be LETHAL FROM FULL
      rows.push({ mv, A, T, ba, bt, rc, eff, dmin, margin: dmin - bt.hp });
    }
  }
}
console.log('  bodies asked of the builder        : ' + built.size + ', of which ' + BUILD_FAILED.length
  + ' would not build' + (BUILD_FAILED.length ? '   e.g. ' + BUILD_FAILED.slice(0, 3).join(' | ') : ''));
if (BUILD_FAILED.length && BUILD_FAILED.length === built.size) {
  console.log('  RED — NOTHING BUILT AT ALL. That is the BUILDER, not the format.');
  process.exit(1);
}
if (!rows.length) {
  console.log('  NO TRIPLE IN THIS FORMAT STAGES A LETHAL RECOIL THAT CROSSES THE PINCH LINE — a claim '
    + 'about the fixture, not about the engine. Nothing was staged.');
  process.exit(2);
}
rows.sort((a, b) => b.margin - a.margin || a.mv.id.localeCompare(b.mv.id)
  || a.A.name.localeCompare(b.A.name) || a.T.name.localeCompare(b.T.name));
const F = rows[0];

/* THE TARGET'S ABILITY IS CHOSEN, NOT TAKEN FROM SLOT 0, and the reason is measured rather than
 * hoped: slot 0 is an Attack-dropping on-entry ability on the chosen body, which would cut the hit
 * below lethal and silently un-stage the whole probe. Anything that touches the incoming hit or the
 * attacker is refused HERE, by tag, and the choice is printed. */
const REFUSE = new Set(['onSwitchInDrop', 'statDropOnEntry', 'damageReduce', 'survivesFromFull',
  'absorbsMoveType', 'immuneToMoveClass', 'punishesContact', 'reflectsStatus', 'noRecoil',
  'formeAbsorbsHit', 'halvesTypeDamage', 'boostsOwnStatOnHit']);
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const tOptions = Object.values(F.T.abilities);
const T_AB = tOptions.find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));
console.log('  target abilities                   : '
  + tOptions.map(ab => ab + ' [' + (abilityTags(ab).join(' ') || 'no tags') + ']').join('   |   '));
if (!T_AB) { console.log('  EVERY ABILITY ON THE TARGET TOUCHES THE HIT — a claim about the fixture.'); process.exit(2); }
const A_AB = Object.values(F.A.abilities)[0];

/* ---- THE THREE BODIES THAT REMOVE THEMSELVES --------------------------------------------------- */
const MEMENTOS = POOL.filter(s => LEARNS(s, 'memento') && s.name !== F.A.name && s.name !== F.T.name
  && !G.CLOSET_SPECIES.has(norm(s.id)));
if (MEMENTOS.length < 3) { console.log('  FEWER THAN THREE MEMENTO CARRIERS — a claim about the format.'); process.exit(2); }
const MEM = MEMENTOS.slice(0, 3);

/* ---- THE HOLD MOVES. A self-target Status move that neither shields nor leaves nor sleeps: Protect
 * and Substitute would REFUSE the Memento (it carries the `protect` flag and does not bypass a sub)
 * and un-stage the whole run, and Rest would put the body to sleep. Derived, never named. */
const SELF_HOLD = (s) => {
  const bad2 = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'protect', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (bad2.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};
const T_HOLD = SELF_HOLD(F.T), A_HOLD = SELF_HOLD(F.A);
if (!T_HOLD || !A_HOLD) { console.log('  NO SAFE SELF-MOVE FOR ONE OF THE TWO — a claim about the fixture.'); process.exit(2); }

/* ---- THE ATTACKER'S PARTNER. Memento is aimed at it, so it must NOT shield. */
const PARTNERS = POOL.filter(s => s.name !== F.A.name && s.name !== F.T.name
  && !MEM.some(m => m.name === s.name) && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (PARTNERS.length < 3) { console.log('  NOT ENOUGH FILLER — a claim about the fixture.'); process.exit(2); }
const P = PARTNERS.slice(0, 3);
const P_HOLD = P.map(s => SELF_HOLD(s));

const DEALT = F.bt.hp;                       // the hit is lethal from full, so `dealt` is the clamp
const RECOIL = recoilOf(F.mv, DEALT);
const AFTER_RECOIL = F.ba.hp - RECOIL;
const HEAL = healOf(F.ba.hp);
const AFTER_BERRY = Math.min(F.ba.hp, AFTER_RECOIL + HEAL);

console.log('\n  chosen  : ' + F.A.name + ' [' + A_AB + '] holding ' + BERRY_ITEM.name
  + ' clicks ' + F.mv.id + ' ' + JSON.stringify(F.mv.recoil) + ' into ' + F.T.name + ' [' + T_AB + ']');
console.log('            target built max HP ' + F.bt.hp + ', def ' + F.bt.df + ', effectiveness x' + F.eff
  + ';  minimum-roll damage ' + F.dmin + '  ->  LETHAL FROM FULL by ' + F.margin);
console.log('            so `dealt` is the CLAMP, exactly ' + DEALT + ', whatever the roll or the crit does');
console.log('            recoil = max(1, round(' + DEALT + ' * ' + F.mv.recoil[0] + '/' + F.mv.recoil[1]
  + ')) = ' + RECOIL + '   against the attacker\'s built max HP ' + F.ba.hp
  + '  (half = ' + (F.ba.hp / 2) + ')');
console.log('            -> the attacker lands on ' + AFTER_RECOIL + '/' + F.ba.hp
  + ', at or under the pinch line, and the berry heals ' + HEAL + '  ->  ' + AFTER_BERRY);
console.log('            the three self-removers  : ' + MEM.map(s => s.name).join(', '));
console.log('            the attacker\'s partner   : ' + P[0].name + ' (Memento is aimed HERE, never at the attacker)');

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = (withBerry) => {
  const A = [
    mon(F.A.name, [F.mv.name, A_HOLD], withBerry ? BERRY_ITEM.name : '', A_AB),
    mon(P[0].name, [P_HOLD[0]]),
    mon(P[1].name, [P_HOLD[1]]),
    mon(P[2].name, [P_HOLD[2]]),
  ];
  const B = [
    mon(F.T.name, [T_HOLD], '', T_AB),
    ...MEM.map(s => mon(s.name, ['Memento'])),
  ];
  return [A, B];
};

/* ---- THE SCRIPT ---------------------------------------------------------------------------------
 * slot a of the defending side is the TARGET and never moves. Slot b cycles through the three
 * Memento carriers, each of which removes itself. Turn 4 is the only turn the attacker swings, and
 * that swing both wipes the side and crosses its own pinch line. */
const SCRIPT = [
  { p1: [{ m: norm(A_HOLD) }, { m: norm(P_HOLD[0]) }], p2: [{ m: norm(T_HOLD) }, { m: 'memento', t: 1 }] },
  { p1: [{ m: norm(A_HOLD) }, { m: norm(P_HOLD[0]) }], p2: [{ m: norm(T_HOLD) }, { m: 'memento', t: 1 }] },
  { p1: [{ m: norm(A_HOLD) }, { m: norm(P_HOLD[0]) }], p2: [{ m: norm(T_HOLD) }, { m: 'memento', t: 1 }] },
  { p1: [{ m: norm(F.mv.id), t: 0 }, { m: norm(P_HOLD[0]) }], p2: [{ m: norm(T_HOLD) }] },
];

const run = (withBerry, tag) => {
  const [SA, SB] = sides(withBerry);
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'secondupdate/' + tag, { arm: G.ARM_BY_ID.get('middle'), script: SCRIPT });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const key = norm(F.A.name);
  const fr = r.finalRoster || {};
  const me = ((fr.medicham && fr.medicham.p1) || []).find(x => norm(x.key || x.name) === key
    || norm(x.name) === key) || null;
  const sdSide = (fr.showdown && fr.showdown.p1) || {};
  const sd = ((sdSide.mons) || []).find(x => norm(x.key || x.name) === key || norm(x.name) === key) || null;
  const foeLeft = ((fr.showdown && fr.showdown.p2 && fr.showdown.p2.mons) || []).filter(x => !x.fainted).length;
  return { staged: true, r, meHp: me && me.hp, sdHp: sd && sd.hp, foeLeft,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null,
           endReason: r.endReason, sdLeft: sdSide.pokemonLeft };
};

console.log('\n  === THE REAL ARM — the attacker holds the berry ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
console.log('  end reason              : ' + REAL.endReason);
console.log('  defending side, showdown: ' + REAL.foeLeft + ' body(ies) still standing   (must be 0 — the wipe IS the fixture)');
console.log('  attacker final HP       : medicham2 ' + REAL.meHp + '     showdown ' + REAL.sdHp
  + '      (recoil only = ' + AFTER_RECOIL + ', recoil + berry = ' + AFTER_BERRY + ')');
console.log('  first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — same board, no berry, so neither pass can settle anything ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
console.log('  attacker final HP       : medicham2 ' + SIL.meHp + '     showdown ' + SIL.sdHp
  + '      (must both be ' + AFTER_RECOIL + ' and must NOT move under the knob)');

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_NO_SECOND_INMOVE_UPDATE=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ meHp: REAL.meHp, sdHp: REAL.sdHp, silentMe: SIL.meHp,
    parted: REAL.meHp !== REAL.sdHp, div: !!REAL.div, divLine: REAL.div && REAL.div.sd }));
  console.log('\ngreen — the control arm ran');
  process.exit(0);
}

/* ---- THE VERDICT -------------------------------------------------------------------------------- */
console.log('\n  === THE VERDICT ===');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
    + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
  return ok;
};
/* THE FIXTURE FIRST. If the side was not wiped, the pass this probe is about was never skipped and
 * every assertion under it would be measuring nothing. */
need('the defending side was WIPED by the recoil click (the fixture)', REAL.foeLeft, 0);
/* THE AUTHORITY SECOND, as a control on the arithmetic above rather than a restatement of it. */
need('showdown settles the berry INSIDE the move (the authority — a control on the arithmetic)', REAL.sdHp, AFTER_BERRY);
need('medicham2 lands on the same HP', REAL.meHp, AFTER_BERRY);
need('...and the two engines agree', REAL.meHp, REAL.sdHp);
need('the streams do not part at all', REAL.div, null);
need('SILENT CONTROL: with no berry the authority is on the bare recoil', SIL.sdHp, AFTER_RECOIL);
need('SILENT CONTROL: and so is medicham2', SIL.meHp, AFTER_RECOIL);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_NO_SECOND_INMOVE_UPDATE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_NO_SECOND_INMOVE_UPDATE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.meHp !== REAL.meHp;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the attacker\'s HP: default '
      + REAL.meHp + '  vs control ' + ctl.meHp);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.meHp !== AFTER_RECOIL) {
      console.log('  RED    the control arm did not land on the bare recoil (' + AFTER_RECOIL
        + '), so it is not the old behaviour.'); bad++;
    }
    if (!ctl.parted) { console.log('  RED    the control arm did NOT part from the authority.'); bad++; }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on the authority\'s line: ' + ctl.divLine);
    if (ctl.silentMe !== SIL.meHp) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + SIL.meHp + ' -> ' + ctl.silentMe
        + '). The knob is reaching further than the Update pass.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.silentMe + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
