#!/usr/bin/env node
/* tests/probe_recoil_on_a_corpse.js — NARRATION BATCH S, CLUSTER 4
 * ==================================================================================================
 * A BODY ALREADY AT 0 HP PAYS NO RECOIL, AND NOTHING IS ANNOUNCED.
 *
 * THIS IS THE THIRD MECHANISM WEARING THE SAME RULE, and batch R found the first two. `cureStatus`
 * refuses a corpse, so a frozen body killed by its own thawing hit is never cured; `removeVolatile`
 * refuses a corpse, so the Flash Fire faint road writes no `-end`. The recoil road is the same shape
 * one level down, in `Battle#spreadDamage`:
 *
 *     if (!target || !target.hp) { retVals[i] = 0; continue; }          sim/battle.ts:2102-2105
 *
 * `applyRecoilDamage` ends `this.battle.damage(recoilDamage, pokemon, pokemon, effect)`
 * (sim/battle-actions.ts:1392), and `Battle#damage` funnels into `spreadDamage`. So an attacker that
 * died BETWEEN its own hit landing and its recoil being paid takes no recoil and the log carries no
 * line at all. The only thing that fits in that gap is the target's own damaging-hit punisher —
 * Rough Skin — which is exactly what both pool cards are.
 *
 * TWO NARRATION-ONLY CAUSES on release `ccdda3181a45`, one per direction of the comparator:
 *     showdown stopped emitting while medicham2 continued :: |-damage|p2a|0fnt|[from]recoil
 *     extra event emitted by medicham2 :: |move|p1a|outrage <> |-damage|p2a|0fnt|[from]recoil
 * Both are a recoil move into a Rough Skin body that kills the attacker.
 *
 * THE ORDER THIS ENGINE ALREADY HAD RIGHT, and it is why the defect is narration and not a board:
 * the payment sits BELOW the faint (`applyRecoilDamage` at :851 in the mod's `scripts.ts`), so the
 * engine wrote `-damage 0 fnt`, `Rough Skin`, `|faint|`, `-damage [from] Recoil` — the last line
 * being the invented one. The HP was already 0, so nothing on the board moved.
 *
 * THE ARMS
 *   CORPSE     RED. ENDURE takes the attacker to exactly 1 HP whatever the roll was, then its recoil
 *              move lands and the target's Rough Skin kills it before the payment. The authority
 *              writes NO recoil line. The pair is SEARCHED, frailest first, and every candidate the
 *              authority refuses to stage is printed by name.
 *   SURVIVES   THE KNOB-CLEARED CONTROL, and the arm that stops "never pay recoil" passing: the SAME
 *              attacker and the SAME move into a body with no Rough Skin. Both engines must write
 *              the recoil line, and the attacker must be alive to carry it.
 *   PUNISHED   The second control, and the sharper one: the same Rough Skin target, the same
 *              contact recoil move, and an attacker at FULL HP. Rough Skin fires, the attacker
 *              lives, and the recoil line IS owed. A fix keyed on "did a punisher fire" instead of
 *              on "is this body at 0 HP" breaks here and only here.
 *
 * Every arm asserts the boards are identical at every boundary.
 *
 * WHAT IS DELIBERATELY NOT FIXED, AND IT IS NAMED RATHER THAN LEFT TO BE FOUND: the OTHER recoil
 * road. Struggle and Steel Beam pay a share of the user's own MAXIMUM through `directDamage`, which
 * carries the identical guard — `if (!target?.hp) return 0;` (sim/battle.ts:2210) — and §0 asserts
 * that below. Steel Beam is not a contact move, so nothing can kill its user in the gap; Struggle
 * is, but reaching it costs a body's whole PP and no pinned-pool game witnesses it. Stated, not
 * assumed absent.
 *
 * RED-FIRST KNOB: `MEDI_RECOIL_ON_A_CORPSE=1` takes the HP guard back out — the engine exactly as it
 * stood before batch S. Under it CORPSE goes RED and both controls stay green; any run carrying it
 * also carries `MEDFAILS.recoilOnCorpseRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_recoil_on_a_corpse.js
 *   MEDI_RECOIL_ON_A_CORPSE=1 SHOWDOWN_PATH=... node tests/probe_recoil_on_a_corpse.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '8');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_RECOIL_ON_A_CORPSE === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_recoil_on_a_corpse.js — a body at 0 HP pays no recoil and says nothing');
console.log('  MEDI_RECOIL_ON_A_CORPSE=' + (KNOB ? '1  (PRE-FIX ENGINE: the corpse is charged and says so)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run, flattened so an anchor cannot fail on line wrapping.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const BATTLE = read('/sim/battle.ts');
const ACTIONS = read('/sim/battle-actions.ts');
const flat = s => String(s).replace(/\s+/g, ' ');

console.log(NL + '0. THE AUTHORITY');
ok(flat(BATTLE).indexOf('if (!target || !target.hp) { retVals[i] = 0; continue; }') >= 0,
   '`Battle#spreadDamage` gives a body at 0 HP a damage of 0 and writes no line',
   (BATTLE.match(/if \(!target \|\| !target\.hp\) \{[\s\S]{0,80}/) || ['not found'])[0]);
ok(flat(ACTIONS).indexOf("this.battle.damage(recoilDamage, pokemon, pokemon, effect);") >= 0,
   '`applyRecoilDamage` pays ordinary recoil through `Battle#damage`, which funnels into `spreadDamage`',
   (ACTIONS.match(/const effect = move\.mindBlownRecoil[\s\S]{0,140}/) || ['not found'])[0]);
ok(flat(BATTLE).indexOf('directDamage(damage: number, target?: Pokemon') >= 0
   && /directDamage\(damage: number[\s\S]{0,400}?if \(!target\?\.hp\) return 0;/.test(BATTLE),
   'the OTHER road carries the identical guard — `Battle#directDamage` opens `if (!target?.hp) '
   + 'return 0;` — which is why the max-HP payers are named in this file\'s header rather than fixed blind',
   (BATTLE.match(/directDamage\(damage: number[\s\S]{0,260}/) || ['not found'])[0]);

/* ==================================================================================================
 * 1. THE CAST — derived from the format
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legalX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const abilitiesOf = s => Object.values(s.abilities || {}).map(a => String(a).toLowerCase().replace(/[^a-z]/g, ''));
const learns = (sp, mv) => !!(((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {})[mv];
const PUNISHERS = D.species.all().filter(s => legalX(s) && abilitiesOf(s).indexOf('roughskin') >= 0);
console.log(NL + '1. THE CAST');
ok(PUNISHERS.length > 0, 'a legal Rough Skin body exists — the only thing that fits between the hit '
   + 'and the payment', PUNISHERS.map(s => s.name + ' ' + JSON.stringify(s.abilities)).join('  |  '));
if (!PUNISHERS.length) { console.log(NL + 'RED — the cast could not be derived.'); process.exit(1); }
/* The bulkiest one, because it must survive the hit that kills its attacker. */
const PUNISH = PUNISHERS.sort((a, b) => (b.baseStats.hp + b.baseStats.def) - (a.baseStats.hp + a.baseStats.def))[0];
/* The attacker: a legal carrier of a CONTACT recoil move that also learns the chip move used to put
 * it on its Focus Sash. Read off the dex on every run rather than named. */
const RECOILERS = D.species.all().filter(s => legalX(s) && Object.keys(((D.species.getLearnsetData(s.id) || {}).learnset) || {})
  .some(mv => { const m = D.moves.get(mv); return legalX(m) && m.recoil && m.flags && m.flags.contact; }));
/* FRAILEST FIRST. The attacker has to DIE to a fraction of its own maximum, so bulk is the enemy;
 * `endure` is required because that is what puts it on 1 HP without depending on a damage roll. */
const CANDIDATES = RECOILERS.filter(s => learns(s.name, 'endure'))
  .sort((a, b) => (a.baseStats.hp + a.baseStats.def + a.baseStats.spd)
                - (b.baseStats.hp + b.baseStats.def + b.baseStats.spd));
const recoilMoveOf = s => Object.keys(((D.species.getLearnsetData(s.id) || {}).learnset) || {})
  .map(mv => D.moves.get(mv)).filter(m => legalX(m) && m.recoil && m.flags && m.flags.contact)
  .sort((a, b) => b.basePower - a.basePower)[0];
ok(CANDIDATES.length > 0, 'legal carriers of a CONTACT recoil move that also learn Endure exist',
   CANDIDATES.slice(0, 6).map(s => s.name).join(', '));

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, A, B, script) {
  const ARM = G.ARM_BY_ID.get('bottom-tie-first');
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_recoil_on_a_corpse :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 4) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const rec = s => s.filter(l => /\[from\] Recoil/i.test(l)).map(l => l.replace(/\s+/g, ' ').toLowerCase());
  /* THE TWO ENGINES SPELL THE ABILITY DIFFERENTLY — `Rough Skin` against `roughskin` — and that is a
   * display convention the differ's own canonicaliser folds. Folded here too, or this count would
   * read 0 on one side and look like the punisher never firing. */
  const skin = s => s.filter(l => /ability: *roughskin/.test(l.toLowerCase().replace(/[^a-z:| ]/g, '').replace(/ +/g, ' ').replace('rough skin', 'roughskin'))).length;
  const faint = s => s.filter(l => /^\|faint\|p1a: /.test(l)).length;
  return { staged: true, sd, me, sdRec: rec(sd), meRec: rec(me),
           sdSkin: skin(sd), meSkin: skin(me), sdFaint: faint(sd), meFaint: faint(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* ENDURE, NOT A COUNT OF TURNS: the attacker eats one hit under Endure and stands at exactly 1 HP,
 * whatever the roll was, then clicks its recoil move the turn after. Rough Skin takes 1/8 of the
 * attacker's MAXIMUM, which is more than 1, so the attacker is a corpse when the payment comes due.
 *
 * THE FIXTURE IS SEARCHED, NOT NAMED. A candidate is accepted only when the AUTHORITY does what the
 * arm needs — Rough Skin fires, the attacker faints, and Showdown writes NO recoil line — and every
 * candidate refused before it is printed BY NAME. */
const bench = ['gengar', 'sableye'];
const attTeam = (sp, mvName) => [mon(sp.name, '', '', [mvName, 'Endure']),
                                 mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])]
  .concat(bench.map(n => mon(n, '', '', ['Nasty Plot'])));
/* THE FILLER IS NASTY PLOT AND THREE OF THE ORIGINAL BODIES COULD NOT LEARN IT (2026-09-10). The
 * validator refuses Nasty Plot on Garchomp, Kingambit and Milotic, and the packed team carried it anyway
 * because a raw Battle validates nothing. A body that is CLICKED (or can enter after a faint and then be
 * clicked) is swapped for a legal Nasty Plot carrier of the same shape — Slowbro for the Water target,
 * Sinistcha for the bench body that enters — and a body that is never clicked keeps its species with a
 * move it legally learns. A scripted move the request does not offer is a silent `pass` on BOTH engines
 * (`scriptMoveNotOnRequest`), which is why the clicked slots could not simply be given any legal move. */
/* SLOT 1 IS THE SECOND ACTIVE, NOT THE BENCH — it is IDLE-clicked every turn, so it must be a legal
 * Nasty Plot carrier (Sinistcha, Heatproof silent) and not Kingambit with a filler the request never
 * offers: the authority REJECTS a `pass` from a standing body, and the fixture search refused every
 * candidate on exactly that sentence before this was corrected (2026-09-10). */
const punishTeam = (chip) => [mon(PUNISH.name, '', 'Rough Skin', [chip, 'Nasty Plot']),
                    mon('sinistcha', '', 'Heatproof', ['Nasty Plot']),
                    mon('incineroar', '', 'Intimidate', ['Nasty Plot']),
                    mon('milotic', '', 'Marvel Scale', ['Recover'])];
const softTeam = [mon('slowbro', '', 'Oblivious', ['Nasty Plot']),
                  mon('sinistcha', '', 'Heatproof', ['Nasty Plot']),
                  mon('incineroar', '', 'Intimidate', ['Nasty Plot']),
                  mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const chipFor = (sp) => Object.keys(((D.species.getLearnsetData(PUNISH.id) || {}).learnset) || {})
  .map(mv => D.moves.get(mv))
  .filter(m => legalX(m) && m.category !== 'Status' && m.target === 'normal'
            && (m.accuracy === true || m.accuracy >= 80)
            && D.getEffectiveness(m.type, sp.types) > 0)
  .sort((a, b) => b.basePower - a.basePower)[0];

let ATT = null, ATT_MOVE = null, CHIP = null, CORPSE = null;
const tried = [];
for (const cand of CANDIDATES.slice(0, 8)) {
  const mv = recoilMoveOf(cand); const chip = chipFor(cand);
  if (!mv) { tried.push(cand.name + ' (no contact recoil move)'); continue; }
  if (!chip) { tried.push(cand.name + ' (the punisher has no super-effective attack against it)'); continue; }
  const R = play('CORPSE:' + cand.name, attTeam(cand, mv.name), punishTeam(chip.name), [
    { p1: [{ m: 'endure' }, IDLE], p2: [{ m: chip.id, t: 0 }, IDLE] },
    { p1: [{ m: mv.id, t: 0 }, IDLE], p2: [IDLE, IDLE] },
  ]);
  if (!R.staged) { tried.push(cand.name + ' (' + R.why + ')'); continue; }
  if (!R.sdSkin) { tried.push(cand.name + ' (Rough Skin never fired on the authority)'); continue; }
  if (!R.sdFaint) { tried.push(cand.name + ' (the authority did not kill the attacker — Endure held it above the punisher)'); continue; }
  if (R.sdRec.length) { tried.push(cand.name + ' (the authority DID pay recoil — the attacker survived the punisher)'); continue; }
  ATT = cand; ATT_MOVE = mv; CHIP = chip; CORPSE = R; break;
}
console.log(NL + '2. THE FIXTURE SEARCH');
for (const t of tried) console.log('     refused: ' + t);
ok(!!CORPSE, 'the CORPSE arm staged on the AUTHORITY — Rough Skin killed the attacker and Showdown '
   + 'wrote no recoil line', ATT ? ATT.name + ' / ' + ATT_MOVE.name + ' into ' + PUNISH.name
   + ', chipped onto Endure with ' + CHIP.name : 'every candidate was refused');
if (!CORPSE) { console.log(NL + 'RED — no fixture staged.'); process.exit(1); }
console.log('     punisher : ' + PUNISH.name + '   attacker: ' + ATT.name + '   recoil move: '
  + ATT_MOVE.name + ' (recoil ' + ATT_MOVE.recoil.join('/') + ', contact)   chip: ' + CHIP.name);

const FIRE = { p1: [{ m: ATT_MOVE.id, t: 0 }, IDLE], p2: [IDLE, IDLE] };
const PUNISHED = play('PUNISHED', attTeam(ATT, ATT_MOVE.name), punishTeam(CHIP.name), [FIRE]);
const SURVIVES = play('SURVIVES', attTeam(ATT, ATT_MOVE.name), softTeam, [FIRE]);

/* ==================================================================================================
 * 3. THE JUDGEMENT
 * ============================================================================================== */
console.log(NL + '3. THE ARMS');
for (const [tag, R] of [['CORPSE', CORPSE], ['PUNISHED', PUNISHED], ['SURVIVES', SURVIVES]]) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown recoil lines : ' + (R.sdRec.join('   ') || '(none)')
    + '   [rough skin ' + R.sdSkin + ', attacker faints ' + R.sdFaint + ']');
  console.log('     medicham recoil lines : ' + (R.meRec.join('   ') || '(none)')
    + '   [rough skin ' + R.meSkin + ', attacker faints ' + R.meFaint + ']');
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdRec) === JSON.stringify(R.meRec),
     tag + ' — the two engines write the SAME recoil lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '4. THE SHAPES THE ARMS EXIST FOR');
ok(CORPSE.staged && CORPSE.sdFaint === 1 && CORPSE.sdSkin >= 1 && CORPSE.sdRec.length === 0,
   'CORPSE — Rough Skin killed the attacker and the authority paid NO recoil at all',
   CORPSE.staged ? 'rough skin lines ' + CORPSE.sdSkin + ', attacker faints ' + CORPSE.sdFaint
                 + ', recoil lines ' + CORPSE.sdRec.length : CORPSE.why);
ok(PUNISHED.staged && PUNISHED.sdSkin >= 1 && PUNISHED.sdFaint === 0 && PUNISHED.sdRec.length === 1,
   'PUNISHED — the SAME punisher fired, the attacker LIVED, and the recoil line IS written '
   + '(the control that separates "at 0 HP" from "a punisher fired")',
   PUNISHED.staged ? 'rough skin lines ' + PUNISHED.sdSkin + ', attacker faints ' + PUNISHED.sdFaint
                   + ', recoil lines ' + PUNISHED.sdRec.length : PUNISHED.why);
ok(SURVIVES.staged && SURVIVES.sdSkin === 0 && SURVIVES.sdRec.length === 1,
   'SURVIVES — no punisher at all and the recoil line is still written (the arm that stops '
   + '"never pay recoil")',
   SURVIVES.staged ? 'rough skin lines ' + SURVIVES.sdSkin + ', recoil lines ' + SURVIVES.sdRec.length : SURVIVES.why);

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
