#!/usr/bin/env node
/* tests/probe_redirect_above_prepare.js — NARRATION, THE REDIRECT DRAW SITS ABOVE THE CHARGE
 * ==================================================================================================
 * `RedirectTarget` IS RESOLVED WHERE THE TARGET LIST IS BUILT, WHICH IS ABOVE `onTryMove` — AND IT IS
 * SKIPPED ENTIRELY ON A TURN THE MOVE ACTUALLY SPENDS CHARGING.
 *
 * THE AUTHORITY, read this run:
 *
 *   sim/battle-actions.ts:466   const { targets, pressureTargets } = pokemon.getMoveTargets(move, target);
 *   sim/pokemon.ts:829-835        if (this.battle.activePerHalf > 1 && !move.tracksTarget) {
 *                                   const isCharging = move.flags['charge'] && !this.volatiles['twoturnmove'] &&
 *                                     !(move.id.startsWith('solarb') && [sun].includes(...)) &&
 *                                     !(move.id === 'electroshot' && [rain].includes(...)) &&
 *                                     !(this.hasItem('powerherb') && move.id !== 'skydrop');
 *                                   if (!isCharging) target = this.battle.priorityEvent('RedirectTarget', ...);
 *                                 }
 *   sim/battle-actions.ts:591   this.battle.singleEvent('PrepareHit', move, {}, targets[0], pokemon, move)
 *   data/moves.ts electroshot     onTryMove: this.add('-prepare', attacker, move.name);  ... in rain:
 *                                 this.attrLastMove('[still]'); this.add('-anim', ...); return;
 *
 * So the `|-activate|<ally>|ability: Lightning Rod` written by the draw lands ABOVE the `|-prepare|`
 * written by the charge handler — and on a turn the move genuinely charges there is no draw at all.
 *
 * THE MECHANISM, versus what the divergence card claimed. The card reads
 * `ordering :: |-activate|p1a|lightningrod <> |-prepare|p1b|electroshot`, which is a LOCATION. It is
 * NOT "the redirect announcement is late in general": on a real charge turn the authority writes no
 * redirect line at all, and this engine already writes none, because its charge branch spends the turn
 * and `continue`s above the draw. The whole divergence lives on the OTHER road — the charge that is
 * SKIPPED (Electro Shot in rain, Solar Beam in sun, a Power Herb), where the handler writes
 * `|-prepare|` and the move then hits in the same turn. There the authority has already drawn the
 * target and this engine had not.
 *
 * ================= THE ARMS, AND WHY TWO OF THEM MUST STAY GREEN ================================
 *
 *   ROD-RAIN        RED before the fix. Rain is up (a Drizzle lead), so Electro Shot's charge is
 *                   SKIPPED — `isCharging` is false, the draw runs, and `|-activate|ability:
 *                   Lightning Rod` precedes `|-prepare|`. This is the pool card's own shape.
 *   ROD-NORAIN      CONTROL, GREEN BEFORE AND AFTER, AND IT IS THE ONE THAT CATCHES AN UNGATED FIX.
 *                   No rain, so turn 1 is a REAL charge turn: the authority skips `RedirectTarget`
 *                   outright and writes no `-activate` at all. Hoisting the draw above the charge
 *                   without carrying the authority's own `isCharging` guard invents a line here and
 *                   nowhere else. Turn 2 is the release, where the draw DOES run.
 *   NO-ROD-RAIN     CONTROL, GREEN BEFORE AND AFTER, and the knob-cleared arm: the same board with
 *                   Raichu on Static instead of Lightning Rod. No redirect line exists to be ordered,
 *                   so a fix that emitted one unconditionally breaks here.
 *
 * Every arm also asserts the BOARDS are identical at every boundary, so a fix that changed what
 * happened as well as what was said cannot pass.
 *
 * ================= WHAT THIS PROBE READS RATHER THAN DERIVES ===================================
 *
 * §0 re-reads `getMoveTargets`'s `isCharging` expression and the `-prepare` write out of the authority
 * on every run. Archaludon's ability is asserted NOT to be Stalwart, because Stalwart turns the whole
 * draw off and an arm staged on it would be green for the wrong reason.
 *
 * RED-FIRST KNOB: `MEDI_REDIRECT_BELOW_CHARGE=1` puts the draw back below the charge — the engine
 * exactly as it stood before this pass. Under it ROD-RAIN goes RED and both controls stay green. Any
 * run carrying it also carries `MEDFAILS.redirectBelowChargeRestored`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_redirect_above_prepare.js
 *   MEDI_REDIRECT_BELOW_CHARGE=1 SHOWDOWN_PATH=... node tests/probe_redirect_above_prepare.js
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
const KNOB = process.env.MEDI_REDIRECT_BELOW_CHARGE === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_redirect_above_prepare.js — the redirect draw is above `-prepare`, and off on a real charge turn');
console.log('  MEDI_REDIRECT_BELOW_CHARGE=' + (KNOB ? '1  (PRE-FIX ENGINE: the draw runs below the charge)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const POKEMON = read('/sim/pokemon.ts');
const ACTIONS = read('/sim/battle-actions.ts');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const CH_AB = read('/data/mods/champions/abilities.ts');
const CH_SCR = read('/data/mods/champions/scripts.ts');

console.log(NL + '0. THE AUTHORITY');
const idxTargets = ACTIONS.indexOf('pokemon.getMoveTargets(move, target)');
const idxPrepare = ACTIONS.indexOf("this.battle.singleEvent('PrepareHit', move, {}, targets[0], pokemon, move)");
ok(idxTargets > 0 && idxPrepare > 0 && idxTargets < idxPrepare,
   '`getMoveTargets` (which holds the redirect) runs ABOVE the `PrepareHit` that writes `-prepare`',
   'getMoveTargets at char ' + idxTargets + ', PrepareHit at char ' + idxPrepare);
ok(/const isCharging = move\.flags\['charge'\] && !this\.volatiles\['twoturnmove'\]/.test(POKEMON)
   && /if \(!isCharging\) \{\s*\n\s*target = this\.battle\.priorityEvent\('RedirectTarget'/.test(POKEMON),
   'the draw is SKIPPED on a real charge turn — `if (!isCharging) ... RedirectTarget`',
   (POKEMON.match(/const isCharging = [\s\S]{0,320}/) || ['not found'])[0]);
ok(/!\(move\.id === 'electroshot' && \['raindance', 'primordialsea'\]\.includes\(this\.effectiveWeather\(move\)\)\)/.test(POKEMON),
   'and a charge SKIPPED BY WEATHER is not "charging" — Electro Shot in rain draws normally');
const ES = (new RegExp('\\n\\telectroshot: \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(MOVES) || [])[1] || '';
ok(/this\.add\('-prepare', attacker, move\.name\);/.test(ES),
   "`electroshot.onTryMove` writes `-prepare` — the line the draw must precede");
ok(/\['raindance', 'primordialsea'\]\.includes\(attacker\.effectiveWeather\(\)\)/.test(ES),
   'and Electro Shot is the move whose charge rain skips, so rain is the staging lever');
ok(!/\n\telectroshot: \{/.test(CH_MOVES), 'Champions does not override `electroshot`');
ok(!/\n\tlightningrod: \{/.test(CH_AB), 'Champions does not override `lightningrod`');
ok(!/getMoveTargets\(/.test(CH_SCR), 'Champions does not override `getMoveTargets`, so mainline IS the draw');
const LR = (new RegExp("\\n\\tlightningrod: \\{\\n([\\s\\S]*?)\\n\\t\\},\\n").exec(read('/data/abilities.ts')) || [])[1] || '';
ok(/this\.add\('-activate', this\.effectState\.target, 'ability: Lightning Rod'\);/.test(LR),
   'the draw announces `|-activate|<drawer>|ability: Lightning Rod`', (LR.match(/onRedirectTarget[\s\S]{0,360}/) || [''])[0]);

/* THE CAST'S ABILITY IS A CLAIM ABOUT THE ARM AND IT IS CHECKED, not remembered — Stalwart would turn
 * the whole draw off and every arm would be green for the wrong reason. */
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const ARCH = dex.species.get('archaludon');
ok(Object.values(ARCH.abilities).indexOf('Stalwart') >= 0 && 'Stamina' === ARCH.abilities['0'],
   'Archaludon does carry Stalwart (which ignores redirection) and this probe stages STAMINA instead',
   JSON.stringify(ARCH.abilities));

/* ==================================================================================================
 * 1. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NOT STAGED — the top arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, A, B, script, opts) {
  const a = G.buildPair(A, (opts && opts.optA) || undefined);
  const b = G.buildPair(B, (opts && opts.optB) || undefined);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_redirect_above_prepare :: ' + tag, {
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
  /* THE WHOLE ORDERED SUBSEQUENCE OF THE TWO LINES THIS PROBE IS ABOUT — never a count, and never a
   * membership test that would pass on a stream that wrote them the other way round. */
  /* NAMES ARE COMPARED WITH THE SPACES OUT. The authority writes `ability: Lightning Rod` and
   * `Electro Shot`; this engine writes `lightningrod` and `electroshot`, and the whole-game differ
   * normalises exactly that away — a probe that did not would report a divergence the gate does not
   * count, and this one did on its first run. */
  const flat = (l) => String(l).toLowerCase().replace(/[\s:,]/g, '');
  const keep = (s) => s.map(flat)
                       .filter(l => /^\|-activate\|[^|]*\|abilitylightningrod$/.test(l) || /^\|-prepare\|/.test(l));
  return { staged: true, boards, sd, me, sdSeq: keep(sd), meSeq: keep(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* THE CAST. Politoed appears on BOTH sides of the rain question as the SAME SPECIES with a different
 * declared ability — Drizzle for the rain arms, Water Absorb for the dry one — so the only thing that
 * varies between ROD-RAIN and ROD-NORAIN is the weather, not the board. */
const A_ROD = [mon('raichu', '', 'Lightning Rod', ['Nasty Plot']),
               mon('archaludon', '', 'Stamina', ['Electro Shot', 'Iron Defense']),
               mon('sableye', '', 'Prankster', ['Nasty Plot']),
               mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const A_NOROD = [mon('raichu', '', 'Static', ['Nasty Plot'])].concat(A_ROD.slice(1));
const B_RAIN = [mon('politoed', '', 'Drizzle', ['Protect']),
                mon('farigiraf', '', 'Cud Chew', ['Nasty Plot']),
                mon('incineroar', '', 'Intimidate', ['Nasty Plot']),
                mon('milotic', '', 'Marvel Scale', ['Recover'])];
const B_DRY = [mon('politoed', '', 'Water Absorb', ['Protect'])].concat(B_RAIN.slice(1));
const SHOT = { m: 'electroshot', t: 1 };     /* aimed at p2b, so the draw to the ALLY is visible */
const PRO = { m: 'protect' };

const ROD_RAIN   = play('ROD-RAIN',   A_ROD,   B_RAIN, [{ p1: [IDLE, SHOT], p2: [PRO, IDLE] }]);
const NOROD_RAIN = play('NO-ROD-RAIN', A_NOROD, B_RAIN, [{ p1: [IDLE, SHOT], p2: [PRO, IDLE] }]);
const ROD_NORAIN = play('ROD-NORAIN', A_ROD,   B_DRY,  [
  { p1: [IDLE, SHOT], p2: [PRO, IDLE] },
  { p1: [IDLE, SHOT], p2: [PRO, IDLE] },
]);

/* ==================================================================================================
 * 2. THE JUDGEMENT
 * ============================================================================================== */
console.log(NL + '1. THE ARMS');
const arms = [['ROD-RAIN', ROD_RAIN], ['NO-ROD-RAIN', NOROD_RAIN], ['ROD-NORAIN', ROD_NORAIN]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown : ' + (R.sdSeq.join('   ') || '(neither line)'));
  console.log('     medicham : ' + (R.meSeq.join('   ') || '(neither line)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdSeq) === JSON.stringify(R.meSeq),
     tag + ' — the two engines write the SAME redirect/prepare lines, IN ORDER',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '2. THE SHAPES THE ARMS EXIST FOR');
const seqAt = (R, re) => R.sdSeq.findIndex(l => re.test(l));
if (ROD_RAIN.staged) {
  const iRod = seqAt(ROD_RAIN, /lightningrod/), iPrep = seqAt(ROD_RAIN, /^\|-prepare\|/);
  ok(iRod >= 0 && iPrep >= 0 && iRod < iPrep,
     'ROD-RAIN — the authority wrote the rod line ABOVE the prepare line (this is the card)',
     ROD_RAIN.sdSeq.join(' | '));
}
if (NOROD_RAIN.staged) {
  ok(seqAt(NOROD_RAIN, /lightningrod/) < 0 && seqAt(NOROD_RAIN, /^\|-prepare\|/) >= 0,
     'NO-ROD-RAIN — the same board with Static writes NO rod line and still writes the prepare '
     + '(the knob-cleared control: the ability is what moves the line)', NOROD_RAIN.sdSeq.join(' | '));
}
if (ROD_NORAIN.staged) {
  const first = ROD_NORAIN.sdSeq[0] || '';
  ok(/^\|-prepare\|/.test(first),
     'ROD-NORAIN — on a REAL charge turn the authority writes the prepare with NO rod line above it, '
     + 'because `isCharging` skips the draw', ROD_NORAIN.sdSeq.join(' | '));
  ok(ROD_NORAIN.sdSeq.some(l => /lightningrod/.test(l)),
     'ROD-NORAIN — and the draw DOES run on the release turn, so this arm is not vacuous',
     ROD_NORAIN.sdSeq.join(' | '));
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
