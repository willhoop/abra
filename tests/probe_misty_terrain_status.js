#!/usr/bin/env node
/* tests/probe_misty_terrain_status.js — MISTY TERRAIN REFUSES EVERY STATUS ON A GROUNDED BODY, AND
 * THIS ENGINE HAD NOTHING FOR IT. 2026-09-09, ROADMAP #551 (void game `omit-protect 2662758209`).
 *
 *   SHOWDOWN_PATH=... node tests/probe_misty_terrain_status.js
 *   SHOWDOWN_PATH=... MEDI_MISTY_STATUS_UNREFUSED=1 node tests/probe_misty_terrain_status.js   # RED
 *   ... --medi <path-to-a-medicham2-browser.js>     compile THOSE bytes under the release (pre-fix proof)
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * `data/game-differential.json` on release b730e44f3314 voided three games as `low-identity`, and all
 * three had parted their boards. The `omit-protect 2662758209 vs 2662995339` game was carded as "a
 * post-switch Scorching Sands secondary that may be the instrument". It is not. Replayed through the
 * same driver (docs/_reports/2026-09-09-void-games-attribution.md): Clefable set Misty Terrain on turn
 * 3, Klefki switched in on turn 4, Typhlosion's Scorching Sands hit it, and
 *
 *     authority   |-damage|p1a: Klefki|58/132                          (no burn)
 *     this engine |-damage|p1a: Klefki|58/132   |-status|p1a: Klefki|brn
 *
 * then on turn 5 Klefki's Thunder Wave into Typhlosion:
 *
 *     authority   |-activate|p2a: Typhlosion|move: Misty Terrain
 *     this engine |-status|p2a: Typhlosion|par
 *
 * The board parted at turn 4 (Klefki hp 15 vs 23, status brn vs none). Every Scorching Sands address
 * read `target differs` from then on because the two games had different bodies alive.
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED ========================================
 *
 * `grep mistyterrain data/mods/champions/*.ts` finds nothing, so mainline is the authority:
 *
 *     data/moves.ts:12173-12179
 *       onSetStatus(status, target, source, effect) {
 *         if (!target.isGrounded() || target.isSemiInvulnerable()) return;
 *         if (effect && ((effect as Move).status || effect.id === 'yawn')) {
 *           this.add('-activate', target, 'move: Misty Terrain');
 *         }
 *         return false;
 *       }
 *
 * Three things fall out of that block and each is an arm below:
 *   - EVERY status from EVERY source is refused: a primary (Thunder Wave) AND a secondary (a 30% burn).
 *     The engine only ever modelled the terrain's Dragon halving and declared its confusion refusal as
 *     a gap (`MEDFAILS.confusionMistyUnmodelled`).
 *   - the `-activate` line is written ONLY when the move carries a top-level `status` (or the effect is
 *     the yawn condition). Thunder Wave announces; a secondary is silent. The engine derives that from
 *     the `inflicts*` tag's `via: 'primary'` (engine/tag_dex.js, `m.status === st`).
 *   - an AIRBORNE body is not protected. A Flying-type entrant is statused under the terrain exactly
 *     as it is without it. That arm is what stops the fix being read as "refuse every status while
 *     the terrain is up".
 *
 * ================= THE ARMS =====================================================================
 *
 * Two turns. Turn 1 the setter clicks Misty Terrain (or Protect, in a control). Turn 2 BOTH of p1's
 * leads switch out to the two entrants, and p2 clicks Thunder Wave at slot 0 and a burn secondary at
 * slot 1. Switches resolve before moves, so both entrants are fresh grounded (or airborne) arrivals
 * when the statuses come — the shape of the pool game. Two entrants, because a body paralysed on one
 * turn cannot be burned on the next: a single entrant taking both statuses is a fixture that cannot
 * be shown working. Nothing is ever asked to `pass`.
 *
 *   CONTROL        no terrain, grounded entrants, the derived burn move.  Authority: 2 statuses.
 *   TERRAIN        terrain, the SAME cast.                              Authority: 0 statuses, 1 activate.
 *   SANDS-CONTROL  no terrain, grounded, SCORCHING SANDS — the pool game's own move.  2 statuses.
 *   SANDS          terrain, the SAME cast.                              0 statuses, 1 activate.
 *   AIR-CONTROL    no terrain, FLYING entrants, the derived burn move.  2 statuses.
 *   AIRBORNE       terrain, the SAME cast.                              2 statuses, 0 activate.
 *
 * The burn move is DERIVED: the highest-chance legal single-target damaging move with a `brn`
 * secondary that is not Ground-typed and has no accuracy roll — Scorching Sands is Ground and cannot
 * reach an airborne body at all, so the arm that separates "airborne" from "terrain up" needs a
 * carrier of another type, and one carrier serves every arm so the arms differ only in the knob.
 *
 * EVERY CAST IS FIXED BY ITS CONTROL: the control is played first over the derived candidates and the
 * first cast on which the AUTHORITY lands both statuses is kept; the terrain arm then plays exactly
 * that cast. A cast the authority refuses is printed by name. Under `bottom-tie-first` every secondary
 * fires in both engines, so what is left to differ is the refusal.
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
  console.log('MISTY TERRAIN STATUS REFUSAL');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MEDI_SRC_PATH = argOf('--medi', null);
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_MISTY_STATUS_UNREFUSED === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_misty_terrain_status.js — Misty Terrain refuses every status on a grounded body');
console.log('  knob MEDI_MISTY_STATUS_UNREFUSED=' + (KNOB ? '1  (the defect is RESTORED; the TERRAIN and SANDS arms must go RED)' : '0'));
if (MEDI_SRC_PATH) console.log('  engine bytes: ' + MEDI_SRC_PATH + ' (compiled under the release; NOT the release\'s own simulator)');

/* ==================================================================================================
 * 0. THE AUTHORITY
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
console.log(NL + '0. THE AUTHORITY');
const MT = /\n\tmistyterrain: \{[\s\S]*?\n\t\},\n/.exec(MOVES);
ok(!!MT && /onSetStatus\(status, target, source, effect\) \{\s*\n\s*if \(!target\.isGrounded\(\) \|\| target\.isSemiInvulnerable\(\)\) return;/.test(MT[0]),
   '`mistyterrain.condition.onSetStatus` opens with the grounded / semi-invulnerable test',
   MT ? (MT[0].match(/onSetStatus[\s\S]{0,120}/) || [''])[0] : 'block not found');
ok(!!MT && /if \(effect && \(\(effect as Move\)\.status \|\| effect\.id === 'yawn'\)\) \{\s*\n\s*this\.add\('-activate', target, 'move: Misty Terrain'\);/.test(MT[0]),
   'the `-activate` is written only for a move with a top-level `status`, or the yawn condition',
   MT ? (MT[0].match(/if \(effect && [\s\S]{0,140}/) || [''])[0] : 'block not found');
ok(!!MT && /return false;\s*\n\s*\},\s*\n\s*onTryAddVolatile/.test(MT[0]),
   'and it `return false`s for EVERY status, from every source — no status filter, no secondary filter',
   MT ? (MT[0].match(/return false;\s*\n\s*\},\s*\n\s*onTryAddVolatile/) || [''])[0] : 'block not found');
ok(!/^\tmistyterrain:/m.test(CH_MOVES), 'Champions does not override `mistyterrain`, so mainline IS its authority');

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
/* abilities that would refuse, move or absorb a status or a hit, set a field, or write extra lines the
 * arm does not stage. Printed, not hidden: the arm depends on this list being right, and the control's
 * fixture proof (both statuses land on the authority) is what catches an omission. */
const AB_BLOCK = new Set(['limber', 'waterveil', 'waterbubble', 'thermalexchange', 'comatose', 'purifyingsalt',
  'shielddust', 'leafguard', 'synchronize', 'naturalcure', 'shedskin', 'hydration', 'immunity', 'insomnia',
  'vitalspirit', 'mistysurge', 'electricsurge', 'grassysurge', 'psychicsurge', 'levitate', 'intimidate',
  'sheerforce', 'serenegrace', 'pastelveil', 'flowerveil', 'sweetveil', 'goodasgold', 'magicbounce',
  'prankster', 'mirrorarmor', 'guts', 'marvelscale', 'quickfeet', 'flareboost', 'poisonheal', 'toxicboost',
  'earlybird', 'moldbreaker', 'teravolt', 'turboblaze', 'drought', 'drizzle', 'sandstream', 'snowwarning',
  'orichalcumpulse', 'hadronengine', 'sandspit', 'seedsower', 'cudchew', 'ripen', 'harvest', 'trace',
  'imposter', 'illusion', 'zenmode', 'schooling', 'hungerswitch', 'protosynthesis', 'quarkdrive',
  'unburden', 'symbiosis', 'stancechange', 'powerconstruct', 'gulpmissile', 'iceface', 'disguise',
  'voltabsorb', 'motordrive', 'lightningrod', 'waterabsorb', 'stormdrain', 'dryskin', 'flashfire',
  'wellbakedbody', 'sapsipper', 'magicguard', 'multiscale', 'sturdy', 'wonderguard', 'shadowshield',
  'regenerator', 'emergencyexit', 'wimpout', 'berserk', 'angerpoint', 'stamina', 'weakarmor', 'justified',
  'rattled', 'steadfast', 'competitive', 'defiant', 'moxie', 'beastboost', 'soulheart', 'battlebond',
  'poisonpoint', 'flamebody', 'static', 'effectspore', 'cutecharm', 'roughskin', 'ironbarbs', 'aftermath',
  'innardsout', 'mummy', 'lingeringaroma', 'wanderingspirit', 'perishbody', 'gooey', 'tanglinghair',
  'cursedbody', 'pickpocket', 'toxicdebris', 'seedsower', 'sandspit', 'windpower', 'electromorphosis',
  'colorchange', 'dancer', 'receiver', 'powerofalchemy', 'liquidooze', 'friendguard', 'healer',
  'airlock', 'cloudnine', 'neutralizinggas', 'terashell', 'terashift', 'zerotohero', 'commander',
  'costar', 'opportunist', 'mimicry', 'protean', 'libero']);
const quietAbility = s => abilIds(s).find(a => !AB_BLOCK.has(a)) || null;
const hasType = (s, t) => (s.types || []).includes(t);
const eff = (type, s) => D.getEffectiveness(type, s);           // >0 super-effective, 0 neutral, <0 resisted
const immune = (type, s) => !D.getImmunity(type, s);
const bulk = (a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd);

/* THE BURN MOVE, DERIVED. Not Ground (an airborne body is immune to Ground), no accuracy roll, single
 * target, damaging, a `brn` secondary, nothing else attached that would write lines the arm does not
 * stage. Highest chance first. */
const BURNERS = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal'
  && m.secondary && m.secondary.status === 'brn' && !m.secondary.self && !m.secondary.boosts
  && m.type !== 'Ground' && (m.accuracy === true || m.accuracy === 100))
  .filter(m => !m.flags.charge && !m.flags.recharge && !m.multihit && !m.recoil && !m.selfdestruct && !m.drain && !m.self)
  .sort((a, b) => b.secondary.chance - a.secondary.chance || a.basePower - b.basePower);
const SETTERS = SPEC.filter(s => learns(s.name, 'mistyterrain') && quietAbility(s));
const WAVERS = SPEC.filter(s => learns(s.name, 'thunderwave') && quietAbility(s));
const usersOf = mv => SPEC.filter(s => learns(s.name, mv) && quietAbility(s));
/* the first burner SOMEBODY legal can carry with a quiet ability — Infernal Parade tops the list and has
 * no such user, which the first run of this file found by refusing to stage */
const BURN = BURNERS.find(m => usersOf(m.id).length) || null;
const SANDS = D.moves.get('scorchingsands');
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
ok(!!BURN, 'a legal non-Ground burn secondary with a legal quiet-ability user exists for the airborne arm',
   BURNERS.slice(0, 5).map(m => m.id + '/' + m.type + '/' + m.basePower + 'bp/' + m.secondary.chance + '%').join(', '));
ok(legal(SANDS) && SANDS.secondary && SANDS.secondary.status === 'brn' && SANDS.type === 'Ground',
   'Scorching Sands (the pool game\'s move) is legal, Ground, and carries a `brn` secondary',
   SANDS.type + ' ' + SANDS.basePower + 'bp ' + (SANDS.secondary && SANDS.secondary.chance) + '%');
if (!BURN) process.exit(1);

const BURNUSERS = usersOf(BURN.id), SANDUSERS = usersOf(SANDS.id);
/* the Thunder Wave target: grounded, reachable by Electric, able to carry paralysis */
const twOk = s => quietAbility(s) && !hasType(s, 'Flying') && !hasType(s, 'Electric') && !hasType(s, 'Ground')
  && !immune('Electric', s) && !abilIds(s).includes('levitate');
/* the burn target: grounded, able to carry a burn, not weak to either burn carrier's type (so the hit
 * cannot KO before the secondary is asked), not immune to either */
const brnOk = s => quietAbility(s) && !hasType(s, 'Flying') && !hasType(s, 'Fire') && !abilIds(s).includes('levitate')
  && !immune(BURN.type, s) && eff(BURN.type, s) <= 0 && !immune('Ground', s) && eff('Ground', s) <= 0;
const flyTwOk = s => quietAbility(s) && hasType(s, 'Flying') && !hasType(s, 'Electric') && !hasType(s, 'Ground') && !immune('Electric', s);
const flyBrnOk = s => quietAbility(s) && hasType(s, 'Flying') && !hasType(s, 'Fire') && !immune(BURN.type, s) && eff(BURN.type, s) <= 0;
const TW_G = SPEC.filter(twOk).sort(bulk), BR_G = SPEC.filter(brnOk).sort(bulk);
const TW_F = SPEC.filter(flyTwOk).sort(bulk), BR_F = SPEC.filter(flyBrnOk).sort(bulk);
const show = (xs, n) => xs.slice(0, n || 6).map(s => s.name).join(', ') + (xs.length > (n || 6) ? ', …' : '');
console.log('     burn move                    : ' + BURN.name + ' (' + BURN.type + ', ' + BURN.secondary.chance + '%)   +  ' + SANDS.name + ' for the pool game\'s own arm');
console.log('     Misty Terrain setters        : ' + show(SETTERS));
console.log('     Thunder Wave users           : ' + show(WAVERS));
console.log('     ' + BURN.name.padEnd(29) + 'users: ' + show(BURNUSERS));
console.log('     Scorching Sands users        : ' + show(SANDUSERS));
console.log('     grounded TW targets (bulkiest): ' + show(TW_G));
console.log('     grounded burn targets        : ' + show(BR_G));
console.log('     Flying TW targets            : ' + show(TW_F));
console.log('     Flying burn targets          : ' + show(BR_F));
if (![SETTERS, WAVERS, BURNUSERS, SANDUSERS, TW_G, BR_G, TW_F, BR_F].every(x => x.length)) {
  console.log('  NOT STAGED — a role has no legal filler.'); process.exit(1);
}

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const snapCounters = () => ({ refused: M.MEDSEEN.mistyRefusedStatus || 0, announced: M.MEDSEEN.mistyRefusalAnnounced || 0,
                              restored: M.MEDFAILS.mistyStatusUnrefusedRestored || 0,
                              fieldUnknown: M.MEDFAILS.terrainStatusFieldUnknown || 0 });

const isStatus = l => /^\|-status\|/.test(String(l));
const isMistyAct = l => /^\|-activate\|[^|]+\|move: misty terrain$/i.test(String(l));
const norm = l => String(l).toLowerCase();

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const c0 = snapCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_misty_terrain_status :: ' + tag, { script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const c1 = snapCounters();
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  return { staged: true, boards, sd, me,
           sdS: sd.filter(isStatus).map(norm), meS: me.filter(isStatus).map(norm),
           sdA: sd.filter(isMistyAct).map(norm), meA: me.filter(isMistyAct).map(norm),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.join(', ')).join(' | '),
           counters: { refused: c1.refused - c0.refused, announced: c1.announced - c0.announced, restored: c1.restored,
                       fieldUnknown: c1.fieldUnknown - c0.fieldUnknown },
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const FILL_A = ['toxapex', 'corviknight'], FILL_B = ['milotic', 'weavile'];
for (const f of FILL_A.concat(FILL_B)) if (!legal(D.species.get(f))) { console.log('  NOT STAGED — filler ' + f + ' is not legal'); process.exit(1); }

function teams(cast, burnMove) {
  const A = [mon(cast.setter.name, '', quietAbility(cast.setter), ['Misty Terrain', 'Protect']),
             mon(FILL_A[0], '', '', ['Protect']),
             mon(cast.e1.name, '', quietAbility(cast.e1), ['Protect']),
             mon(cast.e2.name, '', quietAbility(cast.e2), ['Protect'])];
  const B = [mon(cast.waver.name, '', quietAbility(cast.waver), ['Thunder Wave', 'Protect']),
             mon(cast.burner.name, '', quietAbility(cast.burner), [burnMove.name, 'Protect']),
             mon(FILL_B[0], '', '', ['Protect']), mon(FILL_B[1], '', '', ['Protect'])];
  return { A, B };
}
function script(withTerrain, cast, burnMove) {
  const t1 = { p1: [{ m: withTerrain ? 'mistyterrain' : 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };
  const t2 = { p1: [{ sw: cast.e1.id }, { sw: cast.e2.id }], p2: [{ m: 'thunderwave', t: 0 }, { m: burnMove.id, t: 1 }] };
  return [t1, t2];
}
const castName = c => c.setter.name + ' / ' + c.waver.name + ' / ' + c.burner.name + ' -> ' + c.e1.name + ' + ' + c.e2.name;

/* THE CONTROL FIXES THE CAST: the first cast on which the AUTHORITY lands BOTH statuses with no
 * terrain in play. Everything refused is printed by name. */
function stageControl(tag, twTargets, brnTargets, burnMove, burnUsers) {
  const tried = [];
  for (const e1 of twTargets.slice(0, 3)) for (const e2 of brnTargets.slice(0, 3)) {
    if (e1.id === e2.id) continue;
    for (const setter of SETTERS.slice(0, 3)) for (const waver of WAVERS.slice(0, 3)) for (const burner of burnUsers.slice(0, 3)) {
      const ids = new Set([setter.id, waver.id, burner.id, e1.id, e2.id, ...FILL_A, ...FILL_B]);
      if (ids.size < 9) continue;
      const cast = { setter, waver, burner, e1, e2 };
      const { A, B } = teams(cast, burnMove);
      const R = play(tag + ':' + castName(cast), A, B, script(false, cast, burnMove));
      if (!R.staged) { tried.push(castName(cast) + ' (' + R.why + ')'); continue; }
      const par = R.sdS.some(l => /\|par$/.test(l)), brn = R.sdS.some(l => /\|brn$/.test(l));
      if (!par || !brn) { tried.push(castName(cast) + ' (authority landed par=' + par + ' brn=' + brn + ' with no terrain in play)'); continue; }
      R.cast = cast; R.tried = tried; return R;
    }
  }
  return { staged: false, why: 'every cast was refused', tried };
}
function stageTerrain(tag, cast, burnMove) {
  const { A, B } = teams(cast, burnMove);
  const R = play(tag + ':' + castName(cast), A, B, script(true, cast, burnMove));
  R.cast = cast; R.tried = []; return R;
}

const CONTROL = stageControl('control', TW_G, BR_G, BURN, BURNUSERS);
const TERRAIN = CONTROL.staged ? stageTerrain('terrain', CONTROL.cast, BURN) : CONTROL;
const SANDS_CONTROL = stageControl('sands-control', TW_G, BR_G, SANDS, SANDUSERS);
const SANDS_ARM = SANDS_CONTROL.staged ? stageTerrain('sands', SANDS_CONTROL.cast, SANDS) : SANDS_CONTROL;
const AIR_CONTROL = stageControl('air-control', TW_F, BR_F, BURN, BURNUSERS);
const AIRBORNE = AIR_CONTROL.staged ? stageTerrain('airborne', AIR_CONTROL.cast, BURN) : AIR_CONTROL;

console.log(NL + '2. THE ARMS');
const ARMS = [['CONTROL', CONTROL], ['TERRAIN', TERRAIN], ['SANDS-CONTROL', SANDS_CONTROL], ['SANDS', SANDS_ARM],
              ['AIR-CONTROL', AIR_CONTROL], ['AIRBORNE', AIRBORNE]];
for (const [tag, R] of ARMS) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); for (const t of (R.tried || [])) console.log('      refused: ' + t); process.exit(1); }
  console.log('  === ' + tag + ' :: ' + castName(R.cast) + ' ===');
  for (const t of R.tried) console.log('      refused first: ' + t);
  console.log('    showdown  -status  x' + R.sdS.length + '  ' + JSON.stringify(R.sdS));
  console.log('    medicham2 -status  x' + R.meS.length + '  ' + JSON.stringify(R.meS));
  console.log('    showdown  -activate misty x' + R.sdA.length + '  ' + JSON.stringify(R.sdA));
  console.log('    medicham2 -activate misty x' + R.meA.length + '  ' + JSON.stringify(R.meA));
  console.log('    boards: ' + R.boardDiffs + ' diff(s) across ' + R.boards.length + ' boundaries' + (R.boardDetail ? '   ' + R.boardDetail : ''));
  console.log('    counters this arm: refused ' + R.counters.refused + ', announced ' + R.counters.announced + ', fieldUnknown ' + R.counters.fieldUnknown);
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
const same = (x, y) => x.length === y.length && x.every((l, i) => l === y[i]);
/* the authority first: these are the EXPECTATIONS and they do not depend on the knob */
ok(CONTROL.sdS.length === 2, 'CONTROL — the authority lands BOTH statuses with no terrain (the fixture can see a status)', JSON.stringify(CONTROL.sdS));
ok(SANDS_CONTROL.sdS.length === 2, 'SANDS-CONTROL — the authority lands BOTH statuses with no terrain, Scorching Sands as the secondary', JSON.stringify(SANDS_CONTROL.sdS));
ok(AIR_CONTROL.sdS.length === 2, 'AIR-CONTROL — the authority lands BOTH statuses on the Flying entrants with no terrain', JSON.stringify(AIR_CONTROL.sdS));
ok(TERRAIN.sdS.length === 0 && TERRAIN.sdA.length === 1,
   'TERRAIN — the authority refuses BOTH statuses on the grounded entrants and announces exactly ONCE (Thunder Wave, a top-level `status`; the secondary is silent)',
   'status ' + JSON.stringify(TERRAIN.sdS) + '  activate ' + JSON.stringify(TERRAIN.sdA));
ok(SANDS_ARM.sdS.length === 0 && SANDS_ARM.sdA.length === 1,
   'SANDS — the same with the pool game\'s own Scorching Sands: 0 statuses, 1 announce',
   'status ' + JSON.stringify(SANDS_ARM.sdS) + '  activate ' + JSON.stringify(SANDS_ARM.sdA));
ok(AIRBORNE.sdS.length === 2 && AIRBORNE.sdA.length === 0,
   'AIRBORNE — the authority lands BOTH statuses on the Flying entrants under the terrain, announcing nothing',
   'status ' + JSON.stringify(AIRBORNE.sdS) + '  activate ' + JSON.stringify(AIRBORNE.sdA));

/* this engine against it */
for (const [tag, R, mustMatch] of [['CONTROL', CONTROL, true], ['TERRAIN', TERRAIN, !KNOB], ['SANDS-CONTROL', SANDS_CONTROL, true],
                                   ['SANDS', SANDS_ARM, !KNOB], ['AIR-CONTROL', AIR_CONTROL, true], ['AIRBORNE', AIRBORNE, true]]) {
  const s = same(R.sdS, R.meS) && same(R.sdA, R.meA);
  ok(mustMatch ? s : !s,
     tag + ' — every `-status` and `-activate|…|move: Misty Terrain` line matches the authority, in order'
     + (mustMatch ? '' : '   [expected to DIFFER: the knob is armed]'),
     s ? null : 'showdown  ' + JSON.stringify(R.sdS) + ' / ' + JSON.stringify(R.sdA) + '\nmedicham2 ' + JSON.stringify(R.meS) + ' / ' + JSON.stringify(R.meA));
  ok(mustMatch ? R.boardDiffs === 0 : R.boardDiffs > 0,
     tag + ' — the BOARDS ' + (mustMatch ? 'stay identical' : 'PART (the knob is armed: a status lands here and not there)'),
     R.boardDiffs + ' diff(s)' + (R.boardDetail ? ': ' + R.boardDetail : ''));
}

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
for (const [tag, R] of [['TERRAIN', TERRAIN], ['SANDS', SANDS_ARM]]) {
  ok(KNOB ? R.counters.refused === 0 : R.counters.refused === 2,
     KNOB ? tag + ' refused NOTHING (the knob is armed)' : tag + ' refused exactly TWO statuses — the primary and the secondary',
     'mistyRefusedStatus +' + R.counters.refused);
  ok(KNOB ? R.counters.announced === 0 : R.counters.announced === 1,
     KNOB ? tag + ' announced nothing (the knob is armed)' : tag + ' announced exactly ONCE — Thunder Wave, not the secondary',
     'mistyRefusalAnnounced +' + R.counters.announced);
}
ok([CONTROL, SANDS_CONTROL, AIR_CONTROL, AIRBORNE].every(R => R.counters.refused === 0),
   'the three controls and AIRBORNE refused nothing — no terrain, or bodies the terrain does not reach',
   [CONTROL, SANDS_CONTROL, AIR_CONTROL, AIRBORNE].map(R => '+' + R.counters.refused).join(' '));
ok(ARMS.every(([, R]) => R.counters.fieldUnknown === 0),
   'no status was ever priced on a body with no side stamp — `terrainStatusFieldUnknown` did not move (the silent-default door stayed shut)',
   ARMS.map(([t, R]) => t + ' +' + R.counters.fieldUnknown).join(' '));
ok(KNOB ? TERRAIN.counters.restored === 1 : !TERRAIN.counters.restored,
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'mistyStatusUnrefusedRestored = ' + TERRAIN.counters.restored);

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
