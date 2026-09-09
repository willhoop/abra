#!/usr/bin/env node
/* tests/probe_faint_before_source_gone_end.js — NARRATION BATCH T, PRIORITY 2c
 * ==================================================================================================
 * A BODY WHOSE `|faint|` HAS NOT BEEN WRITTEN YET IS STILL ON THE FIELD.
 *
 * ONE pool cause, and it is an ordering one:
 *     ordering :: |faint|p2b <> |-end|p1a|syrupbomb
 * Whimsicott's Moonblast kills the Hydrapple that laid a Syrup Bomb. The authority writes
 * `|faint|p2b: Hydrapple` and THEN `|-end|p1a: Ceruledge|Syrup Bomb|[silent]`; this engine wrote the
 * `-end` first.
 *
 * ================= THE MECHANISM, AND IT IS NOT AN `Update` ORDERING BUG ==========================
 *
 * Both engines already run the update pass ABOVE `faintMessages`, which is the authority's own order:
 *
 *     this.battle.eachEvent('Update');            sim/battle-actions.ts:967
 *     ...
 *     this.battle.faintMessages(false, false, !pokemon.hp);          :976
 *
 * The difference is WHAT THE HANDLER SEES on that pass. Syrup Bomb's condition is
 *
 *     onUpdate(pokemon) {
 *       if (this.effectState.source && !this.effectState.source.isActive) {
 *         pokemon.removeVolatile('syrupbomb');    // -> onEnd -> |-end|BODY|Syrup Bomb|[silent]
 *       } }                                                          data/moves.ts
 *
 * and `isActive` is cleared INSIDE `faintMessages`, in the same three statements that write the line:
 *
 *     this.add('faint', pokemon);
 *     pokemon.clearVolatile(false);
 *     pokemon.fainted = true;
 *     pokemon.isActive = false;                                      sim/battle.ts
 *
 * So on the Update pass the corpse is at 0 HP and STILL `isActive`, the handler does not fire, and the
 * `-end` is owed to the NEXT update — which is after the faint line. This engine's `sourceOffField`
 * read `src.fainted || src.curHP <= 0` and answered "gone" the moment the HP hit zero, which is one
 * whole step early. Its own comment named `sim/battle.ts` and then tested the wrong thing.
 *
 * ================= THE SCOREBOARD, SAID BEFORE THE RUN ===========================================
 *
 * **The pinned pool should MOVE by exactly one cause and the lab should sit still.** This is not a
 * rare mechanic: it has a pool witness, it is the whole reason it is being fixed, and the prediction
 * is narration 22 -> 21 causes with no transfer. The census and the roster stage nothing new.
 *
 * ================= THE ARMS ======================================================================
 *
 *   KO-SOURCE   RED. The Syrup Bomb source is killed. The `|faint|` must come FIRST.
 *   DRAGGED-OUT CONTROL, green before and after. The source LEAVES the field alive instead of dying,
 *               dragged off by a Whirlwind — the other half of `sourceOffField`, which has no faint
 *               line in it at all, so the fix must not touch it. Without this arm, "never end the
 *               volatile" would pass KO-SOURCE. (The Syrup Bomb carrier learns no PIVOT in this
 *               format, which the arm prints; the phaze stages the same clause from the other side.)
 *   ALIVE       CONTROL. The source stays on the field and the volatile stays up, so the arm cannot
 *               pass by ending nothing.
 *
 * Every arm asserts the whole line list IN ORDER and every board boundary identical.
 *
 * RED-FIRST KNOB: `MEDI_FAINT_CLEARS_ACTIVE_EARLY=1` puts the old reading back — a body at 0 HP is
 * off the field before its line is written. Any run carrying it also carries
 * `MEDFAILS.faintClearsActiveEarlyRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_faint_before_source_gone_end.js
 *   MEDI_FAINT_CLEARS_ACTIVE_EARLY=1 SHOWDOWN_PATH=... node tests/probe_faint_before_source_gone_end.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '12');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_FAINT_CLEARS_ACTIVE_EARLY === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_faint_before_source_gone_end.js — the faint line comes first');
console.log('  MEDI_FAINT_CLEARS_ACTIVE_EARLY=' + (KNOB ? '1  (PRE-FIX ENGINE: 0 HP is already off the field)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run, CR stripped.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const BATTLE = read('/sim/battle.ts');
const ACTIONS = read('/sim/battle-actions.ts');
const flat = s => String(s).replace(/\s+/g, ' ');

console.log(NL + '0. THE AUTHORITY');
const SYR = (new RegExp('\\n\\tsyrupbomb: \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(MOVES) || [])[1] || '';
ok(flat(SYR).indexOf("onUpdate(pokemon) { if (this.effectState.source && !this.effectState.source.isActive)") >= 0,
   "`syrupbomb.condition.onUpdate` ends the volatile on `!source.isActive` — an `isActive` test, not an HP one",
   flat(SYR).slice(flat(SYR).indexOf('onUpdate'), flat(SYR).indexOf('onUpdate') + 180) || 'onUpdate not found');
/* CHAMPIONS *DOES* CARRY A `syrupbomb` KEY AND THE FIRST DRAFT OF THIS LINE ASSERTED IT DID NOT - the
 * probe caught it. The override is `{ inherit: true, accuracy: 90 }` and NOTHING ELSE, so the
 * condition (and therefore `onUpdate`) is mainline's. `inherit: true` is what makes that a derivation
 * rather than an assumption, and it is asserted rather than described. */
const CH_SYR = (/\n\tsyrupbomb: \{\n([\s\S]*?)\n\t\},/.exec(CH_MOVES) || [])[1] || '';
ok(/inherit: true/.test(CH_SYR) && !/condition/.test(CH_SYR) && !/onUpdate/.test(CH_SYR),
   "Champions' `syrupbomb` is `inherit: true` plus an accuracy and NOTHING ELSE, so the condition -- "
   + "and therefore `onUpdate` -- is mainline's", flat(CH_SYR) || '(no champions key at all)');
const FM = flat((BATTLE.match(/faintMessages\(lastFirst[\s\S]{0,2200}/) || [''])[0]);
const iAdd = FM.indexOf("this.add('faint', pokemon)"), iAct = FM.indexOf('pokemon.isActive = false');
ok(iAdd >= 0 && iAct >= 0 && iAdd < iAct,
   '`faintMessages` writes the `|faint|` line and clears `isActive` in the SAME block, the line first',
   FM.slice(iAdd >= 0 ? iAdd : 0, (iAdd >= 0 ? iAdd : 0) + 200));
/* THE HIT LOOP'S OWN `eachEvent('Update')`, not the switch-out one -- matched by anchoring on the
 * `faintMessages` call that follows it, because a bare search for the event name finds
 * `BattleActions#switchIn` first and the first draft of this line went red on exactly that. */
const TAIL = flat((ACTIONS.match(/this\.battle\.eachEvent\('Update'\);[\s\S]{0,600}?faintMessages\(false, false/) || [''])[0]);
ok(TAIL.indexOf("faintMessages(false, false") >= 0,
   "and `eachEvent('Update')` runs ABOVE `faintMessages` in the hit loop — so a corpse is still "
   + '`isActive` on that pass, and the `-end` is owed to the NEXT one', TAIL.slice(0, 220));

/* ==================================================================================================
 * 1. THE CAST — derived
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legalX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => !!(((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {})[mv];
const SRC = D.species.all().filter(s => legalX(s) && learns(s.name, 'syrupbomb'))[0];
/* The killer needs a move the SOURCE is weak to. Syrup Bomb's only legal carrier is Grass/Dragon, so
 * the set is derived from the type chart rather than named. */
const weak = D.species.all().filter(s => legalX(s) && learns(s.name, 'moonblast'))
  .filter(s => s.name !== (SRC && SRC.name));
const KILLER = weak[0];
/* THE OTHER HALF OF `sourceOffField` IS "IT WALKED OUT", AND THE FIRST DRAFT TRIED TO STAGE IT WITH A
 * PIVOT. The Syrup Bomb carrier learns none in this format — printed by the arm rather than assumed —
 * so the control is staged from the OTHER side instead: a PHAZE drags the source off the field. Same
 * clause, no faint line, and it is aimed at the source rather than clicked by it. */
const PHAZER = D.species.all().filter(s => legalX(s) && learns(s.name, 'whirlwind')
  && s.name !== (SRC && SRC.name) && s.name !== (KILLER && KILLER.name))[0];
console.log(NL + '1. THE CAST');
ok(!!SRC && !!KILLER, 'a Syrup Bomb carrier and a Fairy attacker were derived from the format',
   'syrupbomb: ' + D.species.all().filter(s => legalX(s) && learns(s.name, 'syrupbomb')).map(s => s.name).join(', ')
   + NL + 'moonblast: ' + weak.slice(0, 6).map(s => s.name).join(', '));
if (!SRC || !KILLER) { console.log(NL + 'RED — the cast could not be derived.'); process.exit(1); }
console.log('     source: ' + SRC.name + '   killer: ' + KILLER.name + '   phazer: ' + (PHAZER ? PHAZER.name : '(none)'));
console.log('     the Syrup Bomb carrier learns no pivot in this format: '
  + ['uturn', 'flipturn', 'voltswitch', 'partingshot', 'chillyreception']
      .filter(mv => learns(SRC.name, mv)).join(', ') + '(none)');

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, armId, A, B, script) {
  const ARM = G.ARM_BY_ID.get(armId);
  if (!ARM) return { staged: false, why: 'arm ' + armId + ' is not in ARM_BY_ID' };
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_faint_before_source_gone_end :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 6) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const HINT = /^\[(silent|still|miss|spread|anim)\]$/;
  const norm = s => s.filter(l => /^\|(faint|-end|-start|switch)\|/.test(l))
    .map(l => {
      let f = l.split('|').filter(x => !/^\[of\]/.test(x) && !HINT.test(x));
      f = f.map((x, i) => (i < 2 ? x : x.replace(/^(move|ability|item):\s*/, '').toLowerCase().replace(/[:,\s-]/g, '')));
      return f.join('|');
    });
  return { staged: true, turns: r.turns, sdLines: norm(sd), meLines: norm(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const P2 = [mon(SRC.name, '', '', ['Syrup Bomb', 'Nasty Plot']),
            mon('raichu', '', 'Static', ['Nasty Plot']),
            mon('kingambit', '', 'Defiant', ['Nasty Plot']),
            mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const P1 = [mon('milotic', '', 'Marvel Scale', ['Nasty Plot']),
            mon(KILLER.name, '', '', ['Moonblast', 'Nasty Plot']),
            mon('gengar', '', 'Cursed Body', ['Nasty Plot']),
            mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const P1W = PHAZER ? [mon('milotic', '', 'Marvel Scale', ['Nasty Plot']),
                      mon(PHAZER.name, '', '', ['Whirlwind', 'Nasty Plot']),
                      mon('gengar', '', 'Cursed Body', ['Nasty Plot']),
                      mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])] : null;

const SYRUP = { p1: [IDLE, IDLE], p2: [{ m: 'syrupbomb', t: 0 }, IDLE] };
const HIT = { p1: [IDLE, { m: 'moonblast', t: 0 }], p2: [IDLE, IDLE] };
const WAIT = { p1: [IDLE, IDLE], p2: [IDLE, IDLE] };
/* `top-tie-first` is the MAX-damage corner, so the kill lands in as few turns as possible and the arm
 * does not depend on a roll. Four attacking turns are scripted; the arm asserts a faint happened. */
const KO = play('KO-SOURCE', 'top-tie-first', P1, P2, [SYRUP, HIT, HIT, HIT, HIT, WAIT]);
const ALIVE = play('ALIVE', 'top-tie-first', P1, P2, [SYRUP, WAIT, WAIT]);
const PIVOT = P1W
  ? play('DRAGGED-OUT', 'top-tie-first', P1W, P2,
      [SYRUP, { p1: [IDLE, { m: 'whirlwind', t: 0 }], p2: [IDLE, IDLE] }, WAIT])
  : { staged: false, why: 'no legal Whirlwind carrier outside the cast' };

console.log(NL + '2. THE ARMS');
const arms = [['KO-SOURCE', KO], ['ALIVE', ALIVE], ['DRAGGED-OUT', PIVOT]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag + '  (' + R.turns + ' turns)');
  console.log('     showdown : ' + (R.sdLines.join('   ') || '(nothing)'));
  console.log('     medicham : ' + (R.meLines.join('   ') || '(nothing)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdLines) === JSON.stringify(R.meLines),
     tag + ' — the same faint / volatile lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '3. THE SHAPES THE ARMS EXIST FOR');
const src = SRC.name.split('-')[0].toLowerCase();
const iOf = (L, re) => L.findIndex(l => re.test(l));
const FAINT = new RegExp('^\\|faint\\|p2a' + src + '$');
const SYREND = /^\|-end\|p1a[a-z]+\|syrupbomb$/;
if (KO.staged) {
  const f = iOf(KO.sdLines, FAINT), e = iOf(KO.sdLines, SYREND);
  ok(f >= 0 && e >= 0 && f < e,
     'KO-SOURCE — the authority writes `|faint|` BEFORE the Syrup Bomb `-end`, which is the whole claim',
     KO.sdLines.join(' | '));
}
ok(ALIVE.staged && iOf(ALIVE.sdLines, SYREND) < 0 && iOf(ALIVE.sdLines, /^\|-start\|p1a[a-z]+\|syrupbomb$/) >= 0,
   'ALIVE — the volatile is APPLIED and never ends while the source stands, so no arm passes by '
   + 'ending nothing', ALIVE.staged ? ALIVE.sdLines.join(' | ') : ALIVE.why);
if (PIVOT.staged) {
  ok(iOf(PIVOT.sdLines, SYREND) >= 0 && iOf(PIVOT.sdLines, FAINT) < 0,
     'DRAGGED-OUT — the OTHER half of `sourceOffField`: the source leaves the field alive, the '
     + 'volatile ends, and no faint line is involved at all', PIVOT.sdLines.join(' | '));
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
