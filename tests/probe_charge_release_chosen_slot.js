#!/usr/bin/env node
/* tests/probe_charge_release_chosen_slot.js — A CHARGE MOVE RELEASES AT THE SLOT THAT WAS CHOSEN, NOT AT
 * THE BODY THE CHARGE TURN WAS RE-AIMED ONTO. 2026-09-09, ROADMAP #551 (void game `omit-spread 2658645239`).
 *
 *   SHOWDOWN_PATH=... node tests/probe_charge_release_chosen_slot.js
 *   SHOWDOWN_PATH=... MEDI_CHARGE_REMEMBERS_REAIMED=1 node tests/probe_charge_release_chosen_slot.js   # RED
 *   ... --medi <path-to-a-medicham2-browser.js>     compile THOSE bytes under the release (pre-fix proof)
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * Replayed through the differential's own driver (docs/_reports/2026-09-09-void-games-attribution.md):
 * turn 2, Annihilape chose Phantom Force at the Slowbro in slot a; Incineroar's Flare Blitz killed that
 * Slowbro before Annihilape moved; Mudsdale took slot a at the end of the turn.
 *
 *     authority   |move|p1a: Annihilape|Phantom Force||[still]  ...  turn 3: |move|...|p2a: Mudsdale|[from] lockedmove
 *                 |-damage|p2a: Mudsdale|0 fnt
 *     this engine |move|p1a: Annihilape|phantomforce|p2b: Liepard        turn 3: |-resisted|p2b: Liepard|1
 *
 * The board parted at turn 3: Mudsdale fainted there and standing at 92 here; Liepard untouched there
 * and at 68 here.
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED ========================================
 *
 *   sim/battle-actions.ts:291   pokemon.moveUsed(move, targetLoc);        -- runMove's OWN targetLoc argument,
 *   sim/pokemon.ts:919          this.lastMoveTargetLoc = targetLoc;        -- the slot as CHOSEN, never re-aimed
 *   data/conditions.ts:295-298  // lastMoveTargetLoc is the location of the originally targeted slot before any redirection
 *                               let moveTargetLoc: number = attacker.lastMoveTargetLoc!;
 *   data/conditions.ts:308      attacker.volatiles[effect.id].targetLoc = moveTargetLoc;
 *   sim/side.ts:675-684         lockedMoveTargetLoc = pokemon.volatiles[lockedMoveID].targetLoc  -> the release's targetLoc
 *
 * So the release goes to WHOEVER STANDS IN THE CHOSEN SLOT. This engine's dispatch re-aim
 * (`reaimToSlot`, which moves an aim off a foe that fainted earlier in the turn) had already MUTATED
 * `it.a.target` when the charge block read it, so the remembered slot was the re-aimed body's.
 * `it.tgtSlot` is the slot as chosen — it is what `reaimToSlot` itself reads — and the fix remembers that.
 *
 * ================= THE ARMS =====================================================================
 *
 *   RED        charger aims slot a; the killer (faster than both) KOs slot a's body before the charge
 *              starts; the bench refills slot a. Release turn: authority strikes slot a's NEW occupant.
 *              Pre-fix this engine struck slot b. `chargeSlotChosenDiffersFromReaimed` must read +1.
 *   FOE-ALIVE  the same cast, the killer clicks Protect instead — slot a's body lives; both engines
 *              release at it. The knob must not move this arm.
 *   SLOT-B     charger aims slot b; the killer still KOs slot a. The release must strike slot b in both
 *              engines — what stops the fix being read as "always release at slot a".
 *
 * Every cast is DERIVED and the fixture is proven off the AUTHORITY's own log before anything is
 * asserted: on turn 1 the aimed body must faint BEFORE the charger's `-prepare`, and it must never have
 * moved. A cast the authority refuses is printed by name.
 *
 * The charge move is the one legal single-target charge move that breaks protection, which is what lets
 * the arms be read without a Protect in the way; both p2 bodies click a derived self-targeting stat
 * move on the release turn so nobody is ever asked to `pass`.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
require(path.join(ROOT, 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('CHARGE RELEASE AT THE CHOSEN SLOT');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MEDI_SRC_PATH = argOf('--medi', null);
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_CHARGE_REMEMBERS_REAIMED === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_charge_release_chosen_slot.js — a charge move releases at the slot as CHOSEN');
console.log('  knob MEDI_CHARGE_REMEMBERS_REAIMED=' + (KNOB ? '1  (the defect is RESTORED; the RED arm must go RED)' : '0'));
if (MEDI_SRC_PATH) console.log('  engine bytes: ' + MEDI_SRC_PATH + ' (compiled under the release; NOT the release\'s own simulator)');

/* ==================================================================================================
 * 0. THE AUTHORITY
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const BA = read('/sim/battle-actions.ts'), PK = read('/sim/pokemon.ts'), CD = read('/data/conditions.ts'), SD = read('/sim/side.ts');
console.log(NL + '0. THE AUTHORITY');
ok(/pokemon\.moveUsed\(move, targetLoc\);/.test(BA), 'runMove records the move with its OWN `targetLoc` argument (sim/battle-actions.ts)');
ok(/this\.lastMoveTargetLoc = targetLoc;/.test(PK), '`Pokemon#moveUsed` stores it as `lastMoveTargetLoc` (sim/pokemon.ts)');
ok(/lastMoveTargetLoc is the location of the originally targeted slot before any redirection/.test(CD)
   && /let moveTargetLoc: number = attacker\.lastMoveTargetLoc!;/.test(CD)
   && /attacker\.volatiles\[effect\.id\]\.targetLoc = moveTargetLoc;/.test(CD),
   '`twoturnmove.onStart` copies the ORIGINAL slot onto the charge volatile (data/conditions.ts)');
ok(/lockedMoveTargetLoc = pokemon\.volatiles\[lockedMoveID\]\.targetLoc;/.test(SD), 'the release turn is aimed at that stored slot (sim/side.ts)');
for (const f of ['moves', 'conditions', 'scripts']) {
  const CH = read('/data/mods/champions/' + f + '.ts');
  ok(!/twoturnmove|lastMoveTargetLoc/.test(CH), 'Champions does not touch `twoturnmove` / `lastMoveTargetLoc` in ' + f + '.ts');
}

/* ==================================================================================================
 * 1. THE CAST — derived
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega && !s.forme);
const learnsetOf = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const learns = (sp, mv) => !!learnsetOf(sp)[mv];
const abilIds = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);
/* abilities that write lines, move dice, absorb hits, change speed or survive a KO. The control's fixture
 * proof (the aimed body faints before moving) is what catches an omission. */
const AB_BLOCK = new Set(['sturdy', 'multiscale', 'shadowshield', 'disguise', 'iceface', 'wonderguard', 'levitate',
  'intimidate', 'trace', 'imposter', 'illusion', 'zenmode', 'schooling', 'hungerswitch', 'protosynthesis', 'quarkdrive',
  'unburden', 'stancechange', 'powerconstruct', 'gulpmissile', 'drought', 'drizzle', 'sandstream', 'snowwarning',
  'orichalcumpulse', 'hadronengine', 'mistysurge', 'electricsurge', 'grassysurge', 'psychicsurge', 'speedboost',
  'chlorophyll', 'swiftswim', 'sandrush', 'slushrush', 'surgesurfer', 'quickfeet', 'unnerve', 'pressure', 'frisk',
  'forewarn', 'anticipation', 'download', 'moxie', 'beastboost', 'soulheart', 'chillingneigh', 'grimneigh',
  'battlebond', 'emergencyexit', 'wimpout', 'berserk', 'angerpoint', 'stamina', 'weakarmor', 'justified', 'rattled',
  'steadfast', 'competitive', 'defiant', 'aftermath', 'innardsout', 'perishbody', 'cursedbody', 'mummy',
  'lingeringaroma', 'wanderingspirit', 'pickpocket', 'roughskin', 'ironbarbs', 'flamebody', 'static', 'poisonpoint',
  'effectspore', 'cutecharm', 'gooey', 'tanglinghair', 'toxicdebris', 'seedsower', 'sandspit', 'windpower',
  'electromorphosis', 'colorchange', 'dancer', 'receiver', 'powerofalchemy', 'liquidooze', 'friendguard', 'healer',
  'airlock', 'cloudnine', 'neutralizinggas', 'terashell', 'terashift', 'zerotohero', 'commander', 'costar',
  'opportunist', 'mimicry', 'protean', 'libero', 'magicguard', 'regenerator', 'symbiosis', 'ripen', 'harvest',
  'cudchew', 'sheerforce', 'serenegrace', 'moldbreaker', 'teravolt', 'turboblaze', 'goodasgold', 'magicbounce',
  'prankster', 'mirrorarmor', 'thickfat', 'filter', 'solidrock', 'prismarmor', 'fluffy', 'furcoat', 'icescales',
  'punkrock', 'heatproof', 'waterbubble', 'flashfire', 'voltabsorb', 'motordrive', 'lightningrod', 'waterabsorb',
  'stormdrain', 'dryskin', 'sapsipper', 'wellbakedbody', 'eartheater', 'purifyingsalt', 'bulletproof', 'soundproof',
  'overcoat', 'telepathy', 'dazzling', 'queenlymajesty', 'armortail', 'stall', 'myceliummight', 'quickdraw',
  'galewings', 'triage', 'stalwart', 'propellertail', 'noguard', 'compoundeyes', 'hugepower', 'purepower',
  'toughclaws', 'ironfist', 'reckless', 'technician', 'adaptability', 'guts', 'hustle', 'tintedlens', 'scrappy',
  'sniper', 'superluck', 'rockypayload', 'sharpness', 'steelworker', 'steelyspirit', 'transistor', 'dragonsmaw',
  'strongjaw', 'megalauncher', 'aerilate', 'pixilate', 'refrigerate', 'galvanize', 'normalize', 'liquidvoice',
  'analytic', 'rivalry', 'flareboost', 'toxicboost', 'defeatist', 'slowstart', 'truant', 'contrary', 'simple',
  'unaware', 'klutz', 'skilllink', 'parentalbond', 'infiltrator', 'longreach', 'punkrock', 'supremeoverlord',
  'sandforce', 'sandveil', 'snowcloak', 'tangledfeet', 'wonderskin', 'shielddust', 'owntempo', 'innerfocus',
  'oblivious', 'vitalspirit', 'insomnia', 'immunity', 'limber', 'waterveil', 'thermalexchange', 'comatose',
  'leafguard', 'synchronize', 'naturalcure', 'shedskin', 'hydration', 'earlybird', 'marvelscale', 'poisonheal',
  'pastelveil', 'flowerveil', 'sweetveil', 'aromaveil', 'hospitality', 'toxicchain', 'poisonpuppeteer',
  'supersweetsyrup', 'embodyaspectteal', 'embodyaspectwellspring', 'embodyaspecthearthflame', 'embodyaspectcornerstone']);
const quietAbility = s => abilIds(s).find(a => !AB_BLOCK.has(a)) || null;
const eff = (type, s) => D.getEffectiveness(type, s);
const immune = (type, s) => !D.getImmunity(type, s);

/* THE CHARGE MOVE: the one legal single-target damaging charge move that breaks protection. */
const CHARGES = D.moves.all().filter(m => legal(m) && m.flags.charge && m.target === 'normal' && m.category !== 'Status');
const BP_CHARGES = CHARGES.filter(m => m.breaksProtect);
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
console.log('     single-target charge moves : ' + CHARGES.map(m => m.id + (m.breaksProtect ? ' (breaksProtect)' : '')).join(', '));
ok(BP_CHARGES.length === 1, 'exactly ONE of them breaks protection — it is the carrier for every arm', BP_CHARGES.map(m => m.name).join(', '));
if (BP_CHARGES.length !== 1) process.exit(1);
const CHARGE = BP_CHARGES[0];

/* THE KILLER'S MOVE: the strongest legal physical single-target move with nothing attached — no accuracy
 * roll, no charge, no recharge, no recoil, no secondary, no self effect, no multi-hit, no drain. */
const KILLMOVES = D.moves.all().filter(m => legal(m) && m.category === 'Physical' && m.target === 'normal'
  && (m.accuracy === true || m.accuracy === 100) && !m.flags.charge && !m.flags.recharge && !m.recoil && !m.secondary
  && !m.secondaries && !m.self && !m.multihit && !m.drain && !m.selfdestruct && !m.ohko && !m.basePowerCallback
  && !m.damageCallback && !m.onHit && !m.onAfterHit && !m.volatileStatus && !m.forceSwitch && !m.selfSwitch
  && !m.willCrit && !m.mindBlownRecoil && !m.struggleRecoil && m.priority === 0 && m.basePower >= 80)
  .sort((a, b) => b.basePower - a.basePower);
console.log('     killer moves (strongest)   : ' + KILLMOVES.slice(0, 6).map(m => m.id + '/' + m.type + '/' + m.basePower).join(', '));

/* a self-targeting stat move with nothing else attached, for bodies that must act without protecting */
const SELFBOOSTS = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
  && !m.volatileStatus && !m.self && !m.heal && !m.status && !m.weather && !m.terrain && !m.sideCondition
  && !m.pseudoWeather && !m.onHit && !m.onTryHit && !m.slotCondition);
const selfBoostFor = s => SELFBOOSTS.find(m => learns(s.name, m.id)) || null;

const CHARGERS = SPEC.filter(s => learns(s.name, CHARGE.id) && quietAbility(s));
console.log('     ' + CHARGE.name.padEnd(27) + 'users: ' + CHARGERS.slice(0, 6).map(s => s.name + '/spe' + s.baseStats.spe).join(', '));
if (!CHARGERS.length || !KILLMOVES.length || !SELFBOOSTS.length) { console.log('  NOT STAGED — a role has no legal filler.'); process.exit(1); }

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const snap = () => ({ chosen: M.MEDSEEN.chargeSlotFromChosen || 0, differs: M.MEDSEEN.chargeSlotChosenDiffersFromReaimed || 0,
                      remembered: M.MEDSEEN.chargeReleasedAtRememberedSlot || 0, restored: M.MEDFAILS.chargeRemembersReaimedRestored || 0 });
const norm = l => String(l).toLowerCase();
const FILL_A = ['toxapex', 'corviknight'];
for (const f of FILL_A) if (!legal(D.species.get(f))) { console.log('  NOT STAGED — filler ' + f + ' is not legal'); process.exit(1); }

/* who took the release: on the RELEASE turn (turn 2), the charger's `|move|p1a: …|<charge>|p2X: <body>` line
 * and the first `-damage|p2X:` after it, read off ONE stream. Keyed on the turn and the move id, not on
 * `[from] lockedmove`, which the authority writes and this engine does not. */
function releaseOf(lines) {
  const L = lines.map(norm);
  const t2 = L.findIndex(l => l === '|turn|2');
  if (t2 < 0) return null;
  for (let i = t2 + 1; i < L.length; i++) {
    const m = /^\|move\|p1a: [^|]+\|([^|]+)\|(p2[ab]): ([^|]+)/.exec(L[i]);
    if (!m || m[1].replace(/[^a-z0-9]/g, '') !== CHARGE.id) continue;
    let dmg = null;
    for (let j = i + 1; j < Math.min(L.length, i + 10) && /^\|-/.test(L[j]); j++) {
      const d = /^\|-damage\|(p2[ab]): ([^|]+)\|/.exec(L[j]); if (d) { dmg = { slot: d[1], body: d[2] }; break; }
    }
    return { announced: { move: m[1], slot: m[2], body: m[3] }, damaged: dmg, line: L[i] };
  }
  return null;
}

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const c0 = snap();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_charge_release_chosen_slot :: ' + tag, { script, arm: ARM,
    onBoundary: (s, ti) => {
      boards.push({ turn: ti, compared: s.leaves_compared, diffs: (s.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      s.identical = true; s.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const c1 = snap();
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  return { staged: true, boards, sd, me,
           sdRel: releaseOf(sd), meRel: releaseOf(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.join(', ')).join(' | '),
           counters: { chosen: c1.chosen - c0.chosen, differs: c1.differs - c0.differs, remembered: c1.remembered - c0.remembered, restored: c1.restored },
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* THE FIXTURE PROOF, OFF THE AUTHORITY'S TURN 1: the aimed body fainted, it never moved, and it fainted
 * BEFORE the charger's `-prepare`. Returns null when it holds, else the reason. */
function fixtureFault(sd, aimedSlot, aimedName, chargerName, wantKO) {
  const L = sd.map(norm);
  const t2 = L.findIndex(l => l === '|turn|2');
  const t1 = t2 < 0 ? L : L.slice(0, t2);
  const fainted = t1.findIndex(l => l.startsWith('|faint|' + aimedSlot + ': ' + aimedName.toLowerCase()));
  const prepared = t1.findIndex(l => l.startsWith('|-prepare|p1a: ' + chargerName.toLowerCase()));
  const moved = t1.some(l => l.startsWith('|move|' + aimedSlot + ': ' + aimedName.toLowerCase()));
  if (prepared < 0) return 'the charger never wrote `-prepare` on turn 1';
  if (wantKO) {
    if (fainted < 0) return aimedName + ' did not faint on turn 1';
    if (moved) return aimedName + ' moved before it fainted';
    if (fainted > prepared) return aimedName + ' fainted AFTER the charge began, so nothing was re-aimed';
    const sw = t1.some(l => l.startsWith('|switch|' + aimedSlot + ': '));
    if (!sw) return 'nobody refilled ' + aimedSlot + ' at the end of turn 1';
  } else if (fainted >= 0) return aimedName + ' fainted in the control, which must keep it alive';
  return null;
}

function stage(tag, aimSlot, killerAttacks) {
  const tried = [];
  for (const charger of CHARGERS.slice(0, 4)) {
    const cBoost = selfBoostFor(charger);
    for (const kmove of KILLMOVES.slice(0, 4)) {
      const killers = SPEC.filter(s => learns(s.name, kmove.id) && quietAbility(s) && s.baseStats.spe > charger.baseStats.spe + 10 && selfBoostFor(s))
        .sort((a, b) => b.baseStats.atk - a.baseStats.atk);
      for (const killer of killers.slice(0, 3)) {
        /* the aimed body: frail, weak to the killer's type, slower than the killer, able to act */
        const victims = SPEC.filter(s => quietAbility(s) && !immune(kmove.type, s) && eff(kmove.type, s) > 0
          && s.baseStats.spe + 10 < killer.baseStats.spe && !immune(CHARGE.type, s) && selfBoostFor(s))
          .sort((a, b) => (a.baseStats.hp + a.baseStats.def) - (b.baseStats.hp + b.baseStats.def));
        /* the other three p2 bodies: sturdy, able to act, reachable by the charge */
        const others = SPEC.filter(s => quietAbility(s) && !immune(CHARGE.type, s) && selfBoostFor(s) && !immune(kmove.type, s))
          .sort((a, b) => (b.baseStats.hp + b.baseStats.def) - (a.baseStats.hp + a.baseStats.def));
        for (const A of victims.slice(0, 3)) {
          const [B, C, Dd] = others.filter(s => ![charger.id, killer.id, A.id].includes(s.id)).slice(0, 3);
          if (!Dd) continue;
          const ids = new Set([charger.id, killer.id, A.id, B.id, C.id, Dd.id, ...FILL_A]);
          if (ids.size < 8) continue;
          const P1 = [mon(charger.name, '', quietAbility(charger), [CHARGE.name, cBoost ? cBoost.name : 'Protect']),
                      mon(killer.name, '', quietAbility(killer), [kmove.name, selfBoostFor(killer).name]),
                      mon(FILL_A[0], '', '', ['Protect']), mon(FILL_A[1], '', '', ['Protect'])];
          const P2 = [A, B, C, Dd].map(s => mon(s.name, '', quietAbility(s), [selfBoostFor(s).name, 'Protect']));
          /* the killer never Protects (a second Protect draws a stall die); slot a's turn-2 click is Protect
           * because the driver, not this script, picks WHICH bench body refills it, and the charge breaks
           * protection anyway — so the release reaches slot a's occupant whoever it is */
          const t1 = { p1: [{ m: CHARGE.id, t: aimSlot }, killerAttacks ? { m: kmove.id, t: 0 } : { m: selfBoostFor(killer).id }],
                       p2: [{ m: selfBoostFor(A).id }, { m: 'protect' }] };
          const t2 = { p1: [{ m: CHARGE.id, t: aimSlot }, { m: selfBoostFor(killer).id }],
                       p2: [{ m: 'protect' }, { m: selfBoostFor(B).id }] };
          const who = charger.name + ' (' + CHARGE.name + ' -> slot ' + (aimSlot ? 'b' : 'a') + ') + ' + killer.name + ' (' + kmove.name + ') vs '
            + A.name + ' / ' + B.name + ' ; bench ' + C.name + ', ' + Dd.name;
          const R = play(tag + ':' + who, P1, P2, [t1, t2]);
          if (!R.staged) { tried.push(who + ' (' + R.why + ')'); continue; }
          const fault = fixtureFault(R.sd, 'p2a', A.name, charger.name, killerAttacks);
          if (fault) { tried.push(who + ' (' + fault + ')'); continue; }
          if (!R.sdRel || !R.sdRel.damaged) { tried.push(who + ' (the authority wrote no locked-move release with damage)'); continue; }
          R.who = who; R.tried = tried; R.cast = { charger, killer, A, B, C, D: Dd, kmove };
          return R;
        }
      }
    }
  }
  return { staged: false, why: 'every cast was refused', tried };
}

const RED = stage('red', 0, true);
const FOE_ALIVE = RED.staged ? stage('foe-alive', 0, false) : RED;
const SLOT_B = RED.staged ? stage('slot-b', 1, true) : RED;

console.log(NL + '2. THE ARMS');
for (const [tag, R] of [['RED', RED], ['FOE-ALIVE', FOE_ALIVE], ['SLOT-B', SLOT_B]]) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); for (const t of (R.tried || [])) console.log('      refused: ' + t); process.exit(1); }
  console.log('  === ' + tag + ' :: ' + R.who + ' ===');
  for (const t of R.tried) console.log('      refused first: ' + t);
  console.log('    showdown  release: ' + JSON.stringify(R.sdRel));
  console.log('    medicham2 release: ' + JSON.stringify(R.meRel));
  console.log('    boards: ' + R.boardDiffs + ' diff(s) across ' + R.boards.length + ' boundaries' + (R.boardDetail ? '   ' + R.boardDetail : ''));
  console.log('    counters this arm: fromChosen +' + R.counters.chosen + ', chosenDiffersFromReaimed +' + R.counters.differs + ', releasedAtRememberedSlot +' + R.counters.remembered);
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
const slotA = R => R.sdRel && R.sdRel.damaged && R.sdRel.damaged.slot === 'p2a';
const slotB = R => R.sdRel && R.sdRel.damaged && R.sdRel.damaged.slot === 'p2b';
/* the authority's expectations, knob-independent */
ok(slotA(RED) && RED.sdRel.damaged.body !== RED.cast.A.name.toLowerCase(),
   'RED — the authority releases at slot a and damages its NEW occupant, not the body that was chosen and died',
   JSON.stringify(RED.sdRel));
ok(slotA(FOE_ALIVE) && FOE_ALIVE.sdRel.damaged.body === FOE_ALIVE.cast.A.name.toLowerCase(),
   'FOE-ALIVE — the authority releases at slot a and damages the chosen body, which lived', JSON.stringify(FOE_ALIVE.sdRel));
ok(slotB(SLOT_B) && SLOT_B.sdRel.damaged.body === SLOT_B.cast.B.name.toLowerCase(),
   'SLOT-B — the authority releases at slot b, the chosen slot, though slot a was the one that emptied', JSON.stringify(SLOT_B.sdRel));

const sameRel = R => !!(R.sdRel && R.meRel && R.sdRel.damaged && R.meRel.damaged
  && R.sdRel.damaged.slot === R.meRel.damaged.slot && R.sdRel.damaged.body === R.meRel.damaged.body);
for (const [tag, R, mustMatch] of [['RED', RED, !KNOB], ['FOE-ALIVE', FOE_ALIVE, true], ['SLOT-B', SLOT_B, true]]) {
  ok(mustMatch ? sameRel(R) : !sameRel(R),
     tag + ' — this engine damages the SAME slot and body on the release' + (mustMatch ? '' : '   [expected to DIFFER: the knob is armed]'),
     'showdown ' + JSON.stringify(R.sdRel && R.sdRel.damaged) + '  medicham2 ' + JSON.stringify(R.meRel && R.meRel.damaged));
  ok(mustMatch ? R.boardDiffs === 0 : R.boardDiffs > 0,
     tag + ' — the BOARDS ' + (mustMatch ? 'stay identical' : 'PART (the knob is armed: a different body took the hit)'),
     R.boardDiffs + ' diff(s)' + (R.boardDetail ? ': ' + R.boardDetail : ''));
}

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
ok(KNOB ? RED.counters.differs === 0 : RED.counters.differs === 1,
   KNOB ? 'RED — the chosen/re-aimed disagreement was not counted (the knob takes the re-aimed slot)' : 'RED — the chosen slot and the re-aimed body disagreed exactly ONCE',
   'chargeSlotChosenDiffersFromReaimed +' + RED.counters.differs);
ok(FOE_ALIVE.counters.differs === 0 && SLOT_B.counters.differs === 0,
   'FOE-ALIVE and SLOT-B — chosen and re-aimed never disagreed (nothing to re-aim)',
   '+' + FOE_ALIVE.counters.differs + ' / +' + SLOT_B.counters.differs);
ok(KNOB ? RED.counters.chosen === 0 : RED.counters.chosen >= 1,
   KNOB ? 'RED — the memory was NOT taken from the chosen slot (the knob is armed)' : 'RED — the memory was taken from the chosen slot',
   'chargeSlotFromChosen +' + RED.counters.chosen);
ok([RED, FOE_ALIVE, SLOT_B].every(R => R.counters.remembered >= 1),
   'every arm released at a remembered slot (the release site never fell back to the first live foe)',
   [RED, FOE_ALIVE, SLOT_B].map(R => '+' + R.counters.remembered).join(' '));
ok(KNOB ? RED.counters.restored === 1 : !RED.counters.restored,
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'chargeRemembersReaimedRestored = ' + RED.counters.restored);

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
