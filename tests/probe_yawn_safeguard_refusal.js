#!/usr/bin/env node
/* tests/probe_yawn_safeguard_refusal.js — NARRATION BATCH T, PRIORITY 1 (A BOARD DEFECT)
 * ==================================================================================================
 * SAFEGUARD REFUSES THE DROWSE ITSELF, AND THIS ENGINE LANDS IT.
 *
 * Batch S found this with an over-match negative and deliberately did not fix it inside a narration
 * pass (docs/_reports/2026-09-09-narration-batch-S.md §4). It is a BOARD defect: the target falls
 * asleep two turns later in this engine and never sleeps in the authority.
 *
 *     safeguard.condition.onTryAddVolatile(status, target, source, effect) {
 *       if (!effect || !source) return;
 *       if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
 *       if ((status.id === 'confusion' || status.id === 'yawn') && target !== source) {
 *         if (effect.effectType === 'Move' && !effect.secondaries)
 *           this.add('-activate', target, 'move: Safeguard');
 *         return null;
 *       }
 *     }                                                                          data/moves.ts
 *
 * The CONFUSION half of that handler has been wired since WIRE 133 (`applyConfusion` asks
 * `sideBuffRefuses(t, src, 'blocksVolatile')`). The YAWN half had no reader at all, and the comment
 * standing in the engine's yawn branch asserted the opposite — that Safeguard is "an `onSetStatus`,
 * so a Safeguarded body takes the drowse in the authority". Batch S corrected the comment and left
 * the code. This probe closes it.
 *
 * ================= THE SCOREBOARD, SAID BEFORE THE RUN ===========================================
 *
 * A RARE MECHANIC: **the pinned pool should sit still and the lab should move.** No pinned-pool game
 * witnesses a Yawn into a Safeguard — that is why batch S could leave it — so `--games 1200` over
 * `data/team-pool-frozen` is predicted to report the SAME narration and the SAME board-material
 * count. What must move is this probe (RED -> green) and nothing else.
 *
 * ================= THE ARMS ======================================================================
 *
 *   SG-YAWN        RED, and RED ON THE BOARD. Foe puts Safeguard up, then eats a Yawn. The authority
 *                  writes `-activate|TARGET|move: Safeguard` and the body NEVER SLEEPS; this engine
 *                  writes `-start|TARGET|move: Yawn` and sleeps it two turns later.
 *   NO-SG          CONTROL, green before and after. The identical script with the Safeguard turn
 *                  spent idling: the drowse lands and the sleep arrives. This is what stops the fix
 *                  reading as "Yawn never lands".
 *   SG-STATUS      CONTROL, green before and after. Thunder Wave into the same Safeguard — the
 *                  `onSetStatus` half, wired since WIRE 133. It proves the side condition is UP and
 *                  that this engine already reads it, so a red SG-YAWN cannot be "no Safeguard".
 *   SG-SEED        THE OVER-MATCH NEGATIVE. Leech Seed into the same Safeguard. `onTryAddVolatile`
 *                  names `confusion` and `yawn` and NOTHING ELSE, so the seed LANDS. `blocksVolatile`
 *                  on the tag is a bare boolean derived from "the condition has an onTryAddVolatile",
 *                  so a fix that read it as "refuses every volatile" would break exactly here.
 *   ALLY-YAWN      The NEAR-SIDE road. A Yawn aimed at the user's OWN partner, under the user's OWN
 *                  Safeguard. The authority's clause is `target !== source` — IDENTITY, not side —
 *                  so it is refused and announced. This is the 2026-08-29 near-side rule, and the arm
 *                  exists so a fix keyed on "the other side" cannot pass.
 *
 * Every arm asserts the whole line list IN ORDER and every board boundary identical.
 *
 * RED-FIRST KNOB: `MEDI_YAWN_THROUGH_SAFEGUARD=1` puts the engine back exactly as it stood — the
 * drowse walks through Safeguard on both roads. Any run carrying it also carries
 * `MEDFAILS.yawnThroughSafeguardRestored`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_yawn_safeguard_refusal.js
 *   MEDI_YAWN_THROUGH_SAFEGUARD=1 SHOWDOWN_PATH=... node tests/probe_yawn_safeguard_refusal.js
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
const KNOB = process.env.MEDI_YAWN_THROUGH_SAFEGUARD === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_yawn_safeguard_refusal.js — Safeguard refuses the DROWSE');
console.log('  MEDI_YAWN_THROUGH_SAFEGUARD=' + (KNOB ? '1  (PRE-FIX ENGINE: the drowse walks through)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run, CR stripped (CRLF checkout, and a CR is a JS line terminator).
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const block = (src, id) => {
  const m = new RegExp('\\n\\t' + id + ': \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(src);
  return m ? m[1] : null;
};
const flat = s => String(s).replace(/\s+/g, ' ');

console.log(NL + '0. THE AUTHORITY');
const SG = block(MOVES, 'safeguard');
ok(!!SG, 'the `safeguard` block was found in data/moves.ts');
const SGV = SG ? (SG.match(/onTryAddVolatile\([\s\S]*?\n\t\t\t\},/) || [''])[0] : '';
ok(flat(SGV).indexOf("if ((status.id === 'confusion' || status.id === 'yawn') && target !== source)") >= 0,
   "`safeguard.onTryAddVolatile` names `yawn` EXPLICITLY, alongside `confusion`, and refuses when "
   + '`target !== source`', flat(SGV) || 'onTryAddVolatile not found');
ok(flat(SGV).indexOf("if (effect.effectType === 'Move' && !effect.secondaries) this.add('-activate', target, 'move: Safeguard');") >= 0,
   'and it ANNOUNCES `-activate|TARGET|move: Safeguard` for a Move with no secondaries — which Yawn is',
   flat(SGV) || 'announce clause not found');
ok(!/\n\tsafeguard: \{/.test(CH_MOVES) && !/\n\tyawn: \{/.test(CH_MOVES),
   'Champions overrides NEITHER `safeguard` NOR `yawn`, so mainline IS the authority for both');
const LS = block(MOVES, 'leechseed');
ok(!!LS && /volatileStatus: 'leechseed',/.test(LS),
   '`leechseed` is a `volatileStatus` and is named NOWHERE in that handler — the over-match arm\'s whole basis',
   LS ? flat(LS).slice(0, 120) : 'leechseed block not found');
/* The yawn volatile is what Safeguard refuses, so the drowse is what must not be written. */
const YW = block(MOVES, 'yawn');
ok(!!YW && /volatileStatus: 'yawn',/.test(YW) && !/secondaries/.test(YW),
   '`yawn` is a `volatileStatus: \'yawn\'` with NO secondaries, so the authority announces the refusal',
   YW ? flat(YW).slice(0, 140) : 'yawn block not found');

/* ==================================================================================================
 * 1. THE CAST — derived from the format, never recalled
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legalX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => !!(((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {})[mv];
const carriers = mv => D.species.all().filter(s => legalX(s) && learns(s.name, mv));
const YAWNER = carriers('yawn').filter(s => learns(s.name, 'thunderwave') && learns(s.name, 'safeguard'))[0]
            || carriers('yawn').filter(s => learns(s.name, 'thunderwave'))[0];
const SEEDER = carriers('leechseed').filter(s => s.types.indexOf('Grass') >= 0)[0] || carriers('leechseed')[0];
/* The victim must hold Safeguard, must NOT be Grass (Leech Seed would be refused two steps higher at
 * `onTryImmunity`) and must not be sleep-immune. */
const VICTIM = carriers('safeguard').filter(s => s.types.indexOf('Grass') < 0)[0];
/* The ALLY arm needs a partner on the Yawn user's own side that is a legal, non-Grass body. */
const PARTNER = D.species.all().filter(s => legalX(s) && s.types.indexOf('Grass') < 0
                                         && s.name !== YAWNER.name && s.name !== SEEDER.name)[0];
console.log(NL + '1. THE CAST');
ok(!!YAWNER && !!SEEDER && !!VICTIM && !!PARTNER, 'every role was derived from the format',
   'yawn+twave+safeguard: ' + carriers('yawn').filter(s => learns(s.name, 'thunderwave') && learns(s.name, 'safeguard')).map(s => s.name).slice(0, 6).join(', ')
   + NL + 'leechseed: ' + carriers('leechseed').map(s => s.name).slice(0, 6).join(', ')
   + NL + 'safeguard, non-Grass: ' + carriers('safeguard').filter(s => s.types.indexOf('Grass') < 0).map(s => s.name).slice(0, 6).join(', '));
if (!YAWNER || !SEEDER || !VICTIM || !PARTNER) { console.log(NL + 'RED — the cast could not be derived.'); process.exit(1); }
/* THE CLAUSE THE FIRST DRAFT DECLARED UNREACHABLE, AND THIS ASSERTION IS WHY IT IS MODELLED INSTEAD.
 * The handler's FIRST line exempts an INFILTRATING move aimed at a foe
 * (`effect.infiltrates && !target.isAlly(source)`). The engine comment written with the fix claimed
 * no legal Infiltrator carrier learns Yawn, so the case could not arise — that claim was put HERE, as
 * a question to the format, instead of typed there as a fact, and it came back RED naming Meowstic
 * and Meowstic-F. The exemption is now wired in `sideBuffRefuses` and the INFIL arms below stage it;
 * this line is kept as the DERIVATION of the cast rather than as a claim of absence. */
const INFIL = D.species.all().filter(s => legalX(s)
  && Object.values(s.abilities || {}).some(a => String(a).toLowerCase() === 'infiltrator')
  && learns(s.name, 'yawn'));
ok(INFIL.length > 0,
   'a legal Infiltrator carrier that learns Yawn exists, so the `infiltrates` exemption is REACHABLE '
   + 'in this regulation and has to be modelled — it is not a theoretical clause',
   INFIL.map(s => s.name).join(', ') || '(none — then the INFIL arms below cannot be staged)');
console.log('     Yawn user: ' + YAWNER.name + '   Seeder: ' + SEEDER.name
          + '   Victim (Safeguard): ' + VICTIM.name + '   Partner: ' + PARTNER.name);

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
  const r = G.playGame(a, b, 'directed', 'probe_yawn_safeguard_refusal :: ' + tag, {
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
  /* THE NORMALISATION IS THE DIFFERENTIAL'S OWN, RULE FOR RULE, and it is taken from `EQUIV` in
   * engine/game_differential.js rather than invented here — a probe that compared MORE strictly than
   * the gate would go red on lines the gate has already declared equal, and a probe that compared
   * less strictly would clear a real divergence:
   *     source-tag        `[of] pXy` — the two engines tag it inconsistently.
   *     display-flags     `[silent] [still] [miss] [spread] [anim]` are rendering hints. The
   *                       authority writes `|-end|…|move: Yawn|[silent]` where this engine writes the
   *                       bare line; the STATE each flag decorates is a separate event and is kept.
   *     effect-namespace  `|-sidestart|p2: b|Safeguard` against `|-sidestart|p2: |move: Safeguard`.
   *                       The NAME is kept; the namespace and the player name go.
   * `-status` is KEPT and is the whole board claim: the sleep two turns later. */
  const HINT = /^\[(silent|still|miss|spread|anim)\]$/;
  const norm = s => s.filter(l => /^\|-(fail|miss|start|immune|activate|status|end|sidestart)\|/.test(l))
    .map(l => {
      let f = l.split('|').filter(x => !/^\[of\]/.test(x) && !HINT.test(x));
      f = f.map((x, i) => (i < 2 ? x : x.replace(/^(move|ability|item):\s*/, '')));
      if (f[1] === '-sidestart' || f[1] === '-sideend') f[2] = String(f[2]).replace(/^(p\d):.*$/, '$1');
      return f.join('|').replace(/\s+/g, ' ').toLowerCase().replace(/[:,]/g, '');
    });
  return { staged: true, sd, me, sdLines: norm(sd), meLines: norm(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const P1 = [mon(YAWNER.name, '', '', ['Yawn', 'Thunder Wave', 'Safeguard', 'Nasty Plot']),
            mon(SEEDER.name, '', '', ['Leech Seed', 'Nasty Plot']),
            mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const P2 = [mon(VICTIM.name, '', '', ['Safeguard', 'Nasty Plot']), mon('raichu', '', 'Static', ['Nasty Plot']),
            mon('kingambit', '', 'Defiant', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
/* The ALLY arm: the Yawn user's own side puts Safeguard up and then Yawns its OWN partner. */
const P1A = [mon(YAWNER.name, '', '', ['Yawn', 'Safeguard', 'Nasty Plot']),
             mon(PARTNER.name, '', '', ['Nasty Plot']),
             mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];

const SG_UP = { p1: [IDLE, IDLE], p2: [{ m: 'safeguard' }, IDLE] };
const NO_SG = { p1: [IDLE, IDLE], p2: [IDLE, IDLE] };
const YAWN_AT = { p1: [{ m: 'yawn', t: 0 }, IDLE], p2: [IDLE, IDLE] };
const WAIT = { p1: [IDLE, IDLE], p2: [IDLE, IDLE] };

/* Four turns: the shield goes up, the Yawn is clicked, and TWO more turns pass so a drowse that
 * landed has time to mature into `slp`. The board claim lives on those last two boundaries. */
const A_SG = play('SG-YAWN', 'middle', P1, P2, [SG_UP, YAWN_AT, WAIT, WAIT]);
const A_NO = play('NO-SG', 'middle', P1, P2, [NO_SG, YAWN_AT, WAIT, WAIT]);
const A_ST = play('SG-STATUS', 'middle', P1, P2,
  [SG_UP, { p1: [{ m: 'thunderwave', t: 0 }, IDLE], p2: [IDLE, IDLE] }]);
const A_SD = play('SG-SEED', 'middle', P1, P2,
  [SG_UP, { p1: [IDLE, { m: 'leechseed', t: 0 }], p2: [IDLE, IDLE] }, WAIT]);
/* THE INFILTRATOR PAIR. `INFIL[0]` is a legal carrier that learns Yawn, derived above; the ability is
 * declared explicitly so the arm cannot quietly run on the species' first slot instead.
 *   INFIL-FOE   the exemption. The authority's handler RETURNS on line one, so the drowse lands
 *               through the Safeguard and the foe sleeps. A fix without the clause refuses here.
 *   INFIL-ALLY  the exemption's own negative: `!target.isAlly(source)`. The SAME body aims the SAME
 *               move at its OWN partner under its OWN Safeguard and IS refused. Without this arm,
 *               "Infiltrator ignores Safeguard" would pass. */
const IN1 = INFIL[0] ? [mon(INFIL[0].name, '', 'Infiltrator', ['Yawn', 'Safeguard', 'Nasty Plot']),
                        mon(PARTNER.name, '', '', ['Nasty Plot']),
                        mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])] : null;
const A_IF = IN1 ? play('INFIL-FOE', 'middle', IN1, P2, [SG_UP, YAWN_AT, WAIT, WAIT])
                 : { staged: false, why: 'no legal Infiltrator carrier learns Yawn' };
const A_IA = IN1 ? play('INFIL-ALLY', 'middle', IN1, P2,
  [{ p1: [{ m: 'safeguard' }, IDLE], p2: [IDLE, IDLE] },
   { p1: [{ m: 'yawn', ally: true }, IDLE], p2: [IDLE, IDLE] }, WAIT, WAIT])
                 : { staged: false, why: 'no legal Infiltrator carrier learns Yawn' };

const A_AL = play('ALLY-YAWN', 'middle', P1A, P2,
  [{ p1: [{ m: 'safeguard' }, IDLE], p2: [IDLE, IDLE] },
   { p1: [{ m: 'yawn', ally: true }, IDLE], p2: [IDLE, IDLE] }, WAIT, WAIT]);

/* ==================================================================================================
 * 3. THE JUDGEMENT — the whole list in order, never a count
 * ============================================================================================== */
console.log(NL + '2. THE ARMS');
const arms = [['SG-YAWN', A_SG], ['NO-SG', A_NO], ['SG-STATUS', A_ST], ['SG-SEED', A_SD],
              ['ALLY-YAWN', A_AL], ['INFIL-FOE', A_IF], ['INFIL-ALLY', A_IA]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown : ' + (R.sdLines.join('   ') || '(nothing)'));
  console.log('     medicham : ' + (R.meLines.join('   ') || '(nothing)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdLines) === JSON.stringify(R.meLines),
     tag + ' — the two engines write the SAME lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '3. THE SHAPES THE ARMS EXIST FOR');
const sdHas = (R, re) => R.staged && R.sdLines.some(l => re.test(l));
const meHas = (R, re) => R.staged && R.meLines.some(l => re.test(l));
const vic = VICTIM.name.split('-')[0].toLowerCase();
const par = PARTNER.name.split('-')[0].toLowerCase();
const SGACT = new RegExp('^\\|-activate\\|p2a ' + vic + '\\|safeguard$');

ok(sdHas(A_SG, SGACT), 'SG-YAWN — the authority refuses the DROWSE with `-activate move: Safeguard`',
   A_SG.staged ? A_SG.sdLines.join(' | ') : A_SG.why);
ok(A_SG.staged && !A_SG.sdLines.some(l => /^\|-start\|p2a .*\|yawn$/.test(l))
   && !A_SG.sdLines.some(l => /^\|-status\|p2a .*slp/.test(l)),
   'SG-YAWN — and the authority NEVER writes the drowse and the body NEVER SLEEPS (the board claim)',
   A_SG.staged ? A_SG.sdLines.join(' | ') : A_SG.why);
ok(A_NO.staged && sdHas(A_NO, /^\|-start\|p2a .*\|yawn$/) && sdHas(A_NO, /^\|-status\|p2a .*slp/),
   'NO-SG — with the shield down the SAME script drowses and then SLEEPS, so the arm is not vacuous',
   A_NO.staged ? A_NO.sdLines.join(' | ') : A_NO.why);
ok(sdHas(A_ST, SGACT) && meHas(A_ST, SGACT),
   'SG-STATUS — the `onSetStatus` half fires on BOTH engines, so a red SG-YAWN cannot be "no Safeguard"',
   A_ST.staged ? 'sd: ' + A_ST.sdLines.join(' | ') + NL + 'me: ' + A_ST.meLines.join(' | ') : A_ST.why);
ok(A_SD.staged && sdHas(A_SD, /^\|-start\|p2a .*leech seed$/i) && !sdHas(A_SD, SGACT),
   'SG-SEED — Leech Seed is NOT named by the handler, so it LANDS through Safeguard (the over-match negative)',
   A_SD.staged ? A_SD.sdLines.join(' | ') : A_SD.why);
ok(A_AL.staged && A_AL.sdLines.some(l => new RegExp('^\\|-activate\\|p1b ' + par + '\\|safeguard$').test(l)),
   'ALLY-YAWN — the authority refuses a Yawn aimed at the user\'s OWN partner under its OWN Safeguard '
   + '(`target !== source` is IDENTITY, not side)',
   A_AL.staged ? A_AL.sdLines.join(' | ') : A_AL.why);
ok(A_AL.staged && !A_AL.sdLines.some(l => /^\|-status\|p1b .*slp/.test(l)),
   'ALLY-YAWN — and the partner never sleeps either',
   A_AL.staged ? A_AL.sdLines.join(' | ') : A_AL.why);
ok(A_IF.staged && sdHas(A_IF, /^\|-start\|p2a .*\|yawn$/) && sdHas(A_IF, /^\|-status\|p2a .*slp/)
   && !sdHas(A_IF, SGACT),
   'INFIL-FOE — an INFILTRATING Yawn at a FOE walks through the Safeguard: the handler returns on its '
   + 'first line, the drowse lands and the body SLEEPS',
   A_IF.staged ? A_IF.sdLines.join(' | ') : A_IF.why);
ok(A_IA.staged && A_IA.sdLines.some(l => new RegExp('^\|-activate\|p1b ' + par + '\|safeguard$').test(l))
   && !A_IA.sdLines.some(l => /^\|-status\|p1b .*slp/.test(l)),
   'INFIL-ALLY — the SAME infiltrating body aiming at its OWN partner IS refused (`!target.isAlly(source)`), '
   + 'so the exemption is not "Infiltrator ignores Safeguard"',
   A_IA.staged ? A_IA.sdLines.join(' | ') : A_IA.why);

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
