#!/usr/bin/env node
/* tests/probe_shield_before_ability.js — NARRATION BATCH T, PRIORITY 1(b)
 * ==================================================================================================
 * THE SHIELD SPEAKS BEFORE THE ABILITY — AT TEN MORE CALL SITES, NOT JUST ON THE PIVOT ROAD.
 *
 * Batch R fixed exactly ONE branch (`kind === 'switch'`, the pivot) and wrote down that it was
 * leaving the rest: *"Eight other `tryHitRefusal` sites have a shield check below them in the same
 * shape and are NOT touched here … Recorded as an open question."* This probe is that question asked
 * of the authority, and the count is TEN rather than eight because the window used to find them was
 * 14 raw lines and several of these carry long comments between the two checks.
 *
 * ================= THE RULE, READ OFF THE AUTHORITY'S OWN STEP LIST ==============================
 *
 * `trySpreadMoveHit`'s `moveSteps` is STEP-MAJOR:
 *
 *   hitStepInvulnerabilityEvent -> hitStepTryHitEvent -> hitStepTypeImmunity -> hitStepTryImmunity
 *     -> hitStepAccuracy -> hitStepBreakProtect -> hitStepStealBoosts -> hitStepMoveHitLoop
 *
 * and inside step 1 the handlers for one target are gathered in this order
 * (`findPokemonEventHandlers`): `getStatus -> volatiles -> volatiles -> getAbility -> getItem`.
 *
 *   PROTECT is a VOLATILE.            Good as Gold is an ABILITY.  -> the shield is asked FIRST.
 *   The absorbing abilities are ABILITIES, at the same tier as Good as Gold.
 *   The Prankster/Dark refusal is `hitStepTryImmunity` — TWO WHOLE STEPS below the shield.
 *
 * `tryHitRefusal` answers all three of those, so at every site it must sit BELOW the shield. It sat
 * above at ten of them, so a Protecting Gholdengo ate `|-immune|…|[from] ability: Good as Gold`
 * where the authority writes `|-activate|…|move: Protect`.
 *
 * ================= THE SCOREBOARD, SAID BEFORE THE RUN ===========================================
 *
 * A RARE SHAPE: **the pinned pool should sit still and the lab should move.** Batch R already
 * measured that no pinned-pool card names any of these ten branches — the three pool causes it closed
 * were all Parting Shot, which is the pivot road it did fix. So the 1,200-game pinned-pool run is
 * predicted to report the SAME narration count and the SAME board-material count, and what must move
 * is this probe.
 *
 * ================= THE ARMS ======================================================================
 *
 * ONE PAIR PER MOVE, and the moves are chosen by DERIVATION rather than by branch name — every legal
 * Status move that (a) carries the `protect` flag, so a shield can answer it at all, and (b) is
 * refused by Good as Gold. Whichever internal branch each one lands in, the pair covers it.
 *
 *   SHIELDED    the target clicked Protect. The authority writes `-activate|move: Protect` and
 *               NOTHING about the ability. RED before the fix on every branch that had the order
 *               backwards.
 *   BARE        THE KNOB-CLEARED CONTROL, and the arm that stops this passing for the wrong reason.
 *               The identical click at the identical body with NO Protect: the authority writes
 *               `-immune|[from] ability: Good as Gold`, and so must this engine. Without it, an
 *               engine that had simply stopped refusing anything would sweep the SHIELDED arms.
 *
 * Every arm asserts the whole line list IN ORDER and every board boundary identical.
 *
 * RED-FIRST KNOB: `MEDI_ABILITY_BEFORE_SHIELD=1` puts the old order back at all ten sites. It does
 * NOT touch the pivot road, which has its own knob (`MEDI_PIVOT_ABILITY_BEFORE_SHIELD`) from batch R
 * — two knobs, because a single one could not tell a fix that regressed the pivot apart from one that
 * never reached these ten. Any run carrying it also carries
 * `MEDFAILS.abilityBeforeShieldRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_shield_before_ability.js
 *   MEDI_ABILITY_BEFORE_SHIELD=1 SHOWDOWN_PATH=... node tests/probe_shield_before_ability.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '40');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_ABILITY_BEFORE_SHIELD === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_shield_before_ability.js — the shield answers above the ability');
console.log('  MEDI_ABILITY_BEFORE_SHIELD=' + (KNOB ? '1  (PRE-FIX ENGINE: the ability answers first)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run, CR stripped (CRLF checkout, and a CR is a JS line terminator).
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const ACTIONS = read('/sim/battle-actions.ts');
const BATTLE = read('/sim/battle.ts');
const flat = s => String(s).replace(/\s+/g, ' ');

console.log(NL + '0. THE AUTHORITY');
const STEPS = flat((ACTIONS.match(/const moveSteps[\s\S]{0,1500}?hitStepMoveHitLoop/) || [''])[0]);
const iHit = STEPS.indexOf('hitStepTryHitEvent'), iImm = STEPS.indexOf('hitStepTryImmunity');
ok(iHit >= 0 && iImm >= 0 && iHit < iImm,
   '`hitStepTryHitEvent` (Protect, Good as Gold) sits ABOVE `hitStepTryImmunity` (the Prankster/Dark '
   + 'refusal) in `moveSteps`', STEPS.slice(0, 240));
const GATHER = flat((BATTLE.match(/findPokemonEventHandlers\(pokemon[\s\S]{0,1600}/) || [''])[0]);
const iVol = GATHER.indexOf('for (const id in pokemon.volatiles)'), iAb = GATHER.indexOf('pokemon.getAbility()');
ok(iVol >= 0 && iAb >= 0 && iVol < iAb,
   'and INSIDE that step `findPokemonEventHandlers` gathers VOLATILES before ABILITIES — Protect is a '
   + 'volatile, Good as Gold is an ability',
   GATHER.slice(GATHER.indexOf('getStatus') >= 0 ? GATHER.indexOf('getStatus') : 0, 300));

/* ==================================================================================================
 * 1. THE CAST AND THE MOVE SET — derived, never listed by hand
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legalX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => !!(((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {})[mv];

/* THE SHIELD CAN ONLY ANSWER A MOVE THAT CARRIES THE `protect` FLAG, so the set is derived on that
 * flag and not on a branch name. `target: 'normal'` or `'any'` keeps the click aimable at one foe;
 * a spread or a side move is a different question and is excluded BY NAME below. */
const CAND = D.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.flags && m.flags.protect && (m.target === 'normal' || m.target === 'any'));
/* A move needs a legal carrier that is not the target itself. */
const withCarrier = CAND.map(m => {
  const c = D.species.all().filter(s => legalX(s) && s.id !== 'gholdengo' && learns(s.name, m.id))[0];
  return c ? { mv: m.id, name: m.name, user: c.name } : null;
}).filter(Boolean);

/* THE EXCLUDED SET IS PRINTED, because an exclusion rule that over-matches is this project's standing
 * hazard. Three kinds go out, each for a reason that is about the FIXTURE and not about the rule:
 *   - a move whose effect ends the turn for the user or the target (a pivot, a phaze, a forced
 *     switch) — batch R already owns the pivot road and a phaze changes who is standing there;
 *   - a move the scripted request will refuse on turn 2 of a two-turn arm;
 *   - a move whose own success needs setup this fixture does not stage.
 * Everything else is kept, INCLUDING moves whose branch nobody has identified — the point is to
 * cover the branches by exercising the format rather than by reading the dispatcher. */
const SKIP = new Set(['partingshot', 'uturn', 'voltswitch', 'flipturn', 'chillyreception', 'shedtail',
  'batonpass', 'whirlwind', 'roar', 'dragontail', 'circlethrow', 'teleport']);
const SET = withCarrier.filter(x => !SKIP.has(x.mv));
console.log(NL + '1. THE MOVE SET — every legal Status move with the `protect` flag aimed at ONE body');
console.log('     kept    (' + SET.length + '): ' + SET.map(x => x.mv).join(', '));
console.log('     skipped (' + withCarrier.filter(x => SKIP.has(x.mv)).length + '): '
  + withCarrier.filter(x => SKIP.has(x.mv)).map(x => x.mv).join(', '));
console.log('     no legal carrier (' + (CAND.length - withCarrier.length) + '): '
  + CAND.filter(m => !withCarrier.some(x => x.mv === m.id)).map(m => m.id).slice(0, 20).join(', '));
ok(SET.length >= 10, 'at least ten moves are stageable, so the ten branches can be reached',
   'set size ' + SET.length);
/* THE MOVES A SHIELD CANNOT ANSWER AT ALL, printed because their branches are therefore NOT covered
 * here and a silent gap is the thing this repository keeps paying for. */
const NOPROT = D.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && (m.target === 'normal' || m.target === 'any') && !(m.flags && m.flags.protect));
console.log('     NOT COVERED — no `protect` flag, so no shield can answer them: '
  + NOPROT.map(m => m.id).join(', '));

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, A, B, script) {
  const ARM = G.ARM_BY_ID.get('middle');
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_shield_before_ability :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 6) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* The differential's own EQUIV rules, rule for rule — see probe_yawn_safeguard_refusal.js for why
   * a probe must normalise exactly as the gate does and no more. */
  const HINT = /^\[(silent|still|miss|spread|anim)\]$/;
  const norm = s => s.filter(l => /^\|-(fail|miss|start|immune|activate|status|end|enditem|item)\|/.test(l))
    .map(l => {
      let f = l.split('|').filter(x => !/^\[of\]/.test(x) && !HINT.test(x));
      /* AND THE ID/NAME FOLD, which is `traceCanon`'s own: *"the NAMES inside are ids … traceCanon
       * folds case, spaces and hyphens on every field"*. Without it this probe reads
       * `good as gold` against `goodasgold` as a divergence the GATE does not see, and 30 arms went
       * red on it before the fold was added. IT IS APPLIED PER FIELD FROM INDEX 2 — folding the whole
       * line ate the hyphen in `-activate` too, which is the event name and is not a name at all. */
      f = f.map((x, i) => (i < 2 ? x
        : x.replace(/^(move|ability|item):\s*/, '').toLowerCase().replace(/[:,\s-]/g, '')));
      return f.join('|');
    });
  return { staged: true, sdLines: norm(sd), meLines: norm(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* Gholdengo carries Good as Gold and Protect and nothing else that could answer first. The mover
 * holds Leftovers so the item-swapping members of the set have something to trade. */
/* THE FILLER IS NASTY PLOT AND THREE OF THE ORIGINAL BODIES COULD NOT LEARN IT (2026-09-10). The
 * validator refuses Nasty Plot on Garchomp, Kingambit and Milotic, and the packed team carried it anyway
 * because a raw Battle validates nothing. A body that is CLICKED (or can enter after a faint and then be
 * clicked) is swapped for a legal Nasty Plot carrier of the same shape — Slowbro for the Water target,
 * Sinistcha for the bench body that enters — and a body that is never clicked keeps its species with a
 * move it legally learns. A scripted move the request does not offer is a silent `pass` on BOTH engines
 * (`scriptMoveNotOnRequest`), which is why the clicked slots could not simply be given any legal move. */
const foe = () => [mon('gholdengo', '', 'Good as Gold', ['Protect', 'Nasty Plot']),
                   mon('raichu', '', 'Static', ['Nasty Plot']),
                   mon('kingambit', '', 'Defiant', ['Swords Dance']),
                   mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const usr = x => [mon(x.user, 'leftovers', '', [x.name, 'Nasty Plot']),
                  mon('sableye', '', 'Prankster', ['Nasty Plot']),
                  mon('gengar', '', 'Cursed Body', ['Nasty Plot']),
                  mon('milotic', '', 'Marvel Scale', ['Recover'])];

console.log(NL + '2. THE ARMS — one SHIELDED / BARE pair per move');
const results = [];
for (const x of SET) {
  const CLICK = { p1: [{ m: x.mv, t: 0 }, IDLE], p2: [{ m: 'protect' }, IDLE] };
  const BARE = { p1: [{ m: x.mv, t: 0 }, IDLE], p2: [IDLE, IDLE] };
  results.push({ x, sh: play(x.mv + '/SHIELDED', usr(x), foe(), [CLICK]),
                     br: play(x.mv + '/BARE', usr(x), foe(), [BARE]) });
}
for (const R of results) {
  const tag = R.x.mv + ' (' + R.x.user + ')';
  for (const [w, A] of [['SHIELDED', R.sh], ['BARE', R.br]]) {
    if (!A.staged) { ok(false, tag + ' ' + w + ' — NOT STAGED', A.why); continue; }
    const same = JSON.stringify(A.sdLines) === JSON.stringify(A.meLines) && A.boardDiffs === 0;
    if (!same) {
      console.log(NL + '  ' + tag + ' ' + w);
      console.log('     showdown : ' + (A.sdLines.join('   ') || '(nothing)'));
      console.log('     medicham : ' + (A.meLines.join('   ') || '(nothing)'));
    }
    ok(same, tag + ' ' + w + ' — same lines in order, and every board boundary identical',
       same ? null : (A.boardDiffs ? 'BOARD ' + JSON.stringify(A.firstDiffs) : '')
         + (A.div ? '\nfirst protocol split:\n  showdown ' + A.div.sd + '\n  medicham ' + A.div.me : ''));
  }
}

/* ==================================================================================================
 * 2b. THE SECOND DEFECT THE REORDER UNCOVERED, AND IT NEEDS A TARGET WITH NO ABILITY REFUSAL AT ALL
 *
 * `healdesc`'s shield block wrote `-activate|move: Protect` AND a generic `|-fail|<mover>`.
 * `protect.condition.onTryHit` ends `return this.NOT_FAIL`, which is exactly the value that
 * SUPPRESSES `useMoveInner`'s generic failure — so the authority writes one line, not two. It is
 * independent of the ordering fix and is reachable against ANY Protecting body, which is why this arm
 * uses a plain one rather than the Gholdengo the arms above use: with Good as Gold in the way, the
 * shield block was never entered at all.
 * KNOB: `MEDI_SHIELDED_HEAL_FAILS=1`.
 * ============================================================================================== */
const HP = withCarrier.find(x => x.mv === 'healpulse');
const plainFoe = [mon('milotic', '', 'Marvel Scale', ['Protect', 'Recover']),
                  mon('raichu', '', 'Static', ['Nasty Plot']),
                  mon('kingambit', '', 'Defiant', ['Swords Dance']),
                  mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const HEALSH = HP ? play('healpulse/PLAIN-SHIELD', usr(HP), plainFoe,
  [{ p1: [{ m: 'healpulse', t: 0 }, IDLE], p2: [{ m: 'protect' }, IDLE] }])
  : { staged: false, why: 'no legal Heal Pulse carrier' };
console.log(NL + '  healpulse / PLAIN-SHIELD (a Protecting body with no ability refusal)');
if (HEALSH.staged) {
  console.log('     showdown : ' + (HEALSH.sdLines.join('   ') || '(nothing)'));
  console.log('     medicham : ' + (HEALSH.meLines.join('   ') || '(nothing)'));
}
ok(HEALSH.staged && HEALSH.boardDiffs === 0
   && JSON.stringify(HEALSH.sdLines) === JSON.stringify(HEALSH.meLines),
   'healpulse PLAIN-SHIELD — one line, not two: the shield speaks and the generic `-fail` does not',
   HEALSH.staged ? null : HEALSH.why);

console.log(NL + '3. THE SHAPES THE ARMS EXIST FOR');
const anySd = (A, re) => A.staged && A.sdLines.some(l => re.test(l));
const PROT = /^\|-activate\|p2agholdengo\|protect$/;
const GAG = /^\|-immune\|p2agholdengo\|\[from\]abilitygoodasgold$/;
const shieldedSpoke = results.filter(R => anySd(R.sh, PROT));
const bareSpoke = results.filter(R => anySd(R.br, GAG));
ok(shieldedSpoke.length === results.length,
   'EVERY shielded arm — the authority answered with `-activate move: Protect` and never with the '
   + 'ability, so each pair really does stage the ordering question',
   shieldedSpoke.length === results.length ? null
     : 'no Protect line on: ' + results.filter(R => !anySd(R.sh, PROT)).map(R => R.x.mv).join(', '));
ok(bareSpoke.length === results.length,
   'EVERY bare arm — the authority answered with `-immune [from] ability: Good as Gold`, so the '
   + 'shielded arms are not passing because the ability had stopped refusing',
   bareSpoke.length === results.length ? null
     : 'no Good as Gold line on: ' + results.filter(R => !anySd(R.br, GAG)).map(R => R.x.mv).join(', '));

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
