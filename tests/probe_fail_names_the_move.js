#!/usr/bin/env node
/* tests/probe_fail_names_the_move.js — NARRATION BATCH S, CLUSTER 1
 * ==================================================================================================
 * A `-fail` THE HANDLER WRITES ITSELF CARRIES THE MOVE'S NAME. THIS ENGINE WROTE THE BARE LINE.
 *
 * `useMoveInner`'s generic failure is TWO fields — `|-fail|<mover>` — and that is what `mvFail`
 * emits. It is not the only shape. A handful of handlers announce their OWN refusal, name the move
 * in field 3, and return `NOT_FAIL` so the generic line never runs:
 *
 *     allyswitch.onHit    this.add('-fail', pokemon, 'move: Ally Switch');      data/moves.ts:326
 *                         this.attrLastMove('[still]'); return this.NOT_FAIL;
 *     substitute.onTryHit this.add('-fail', source, 'move: Substitute');        data/moves.ts:18309
 *                         this.add('-fail', source, 'move: Substitute', '[weak]');   :18314
 *
 * ROADMAP #241 already wired the SECOND of substitute's two branches — the one that fires when a
 * doll is already standing. Two branches were left bare and are the three NARRATION-ONLY causes this
 * probe is written against (release `2c4e125866cc`, four games):
 *
 *     -fail field 3 :: |-fail|p2b|allyswitch <> |-fail|p2b            (x2 causes, 3 games)
 *     -fail field 3 :: |-fail|p1a|allyswitch <> |-fail|p1a
 *     -fail field 3 :: |-fail|p1b|substitute|[weak] <> |-fail|p1b     (1 cause, 1 game)
 *
 * ================= THE ARMS, AND WHY TWO OF THEM MUST STAY GREEN ================================
 *
 *   ASW-DEAD-PARTNER  RED. The partner slot holds a fainted body, so `onHit` refuses and NAMES the
 *                     move. Staged by killing the partner with a +2 move (Extreme Speed) in the same
 *                     turn the +2 Ally Switch is clicked, from a faster body — the replacement does
 *                     not arrive until the end of the turn, so the slot is a corpse when the switch
 *                     resolves. Exactly the pool card's shape.
 *   ASW-STALLED       CONTROL, GREEN BEFORE AND AFTER. The consecutive-use refusal is a DIFFERENT
 *                     road: `condition.onRestart` deletes the volatile and returns false, `onHit` is
 *                     never reached, and `useMoveInner` writes the BARE two-field line. A fix that
 *                     labelled every Ally Switch failure breaks here and only here.
 *   SUB-WEAK          RED. The user is at or below a quarter of its max HP, so `onTryHit` refuses
 *                     with BOTH the name and `[weak]`.
 *   SUB-REPEAT        CONTROL, GREEN BEFORE AND AFTER. The doll is already standing: the SAME
 *                     handler, the SAME move name, and NO `[weak]`. A fix that appended the flag to
 *                     every substitute refusal breaks here and only here. It rides in the same game
 *                     as SUB-WEAK, on the same body, so the two differ in nothing but the HP.
 *
 * Every arm also asserts the BOARDS are identical at every boundary, so a fix that changed what
 * happened as well as what was said cannot pass.
 *
 * ================= THE ONE THING THIS PROBE READS RATHER THAN DERIVES ==========================
 *
 * `[weak]` is a PROTOCOL FLAG typed in the engine beside `[still]` and `[silent]`, and WHICH moves
 * carry it is not typed: the engine emits it at the `costsUserHP` threshold refusal, and §0 below
 * re-reads the handler of EVERY member of that tag on every run and fails if any member's
 * below-threshold branch does not carry exactly `'[weak]'`. A fourth member that refuses differently
 * turns this probe red instead of shipping a line the authority does not write.
 *
 * RED-FIRST KNOB: `MEDI_BARE_FAIL_LABELS=1` puts both bare lines back — the engine exactly as it
 * stood before batch S. Under it ASW-DEAD-PARTNER and SUB-WEAK go RED and both controls stay green.
 *
 *   SHOWDOWN_PATH=... node tests/probe_fail_names_the_move.js
 *   MEDI_BARE_FAIL_LABELS=1 SHOWDOWN_PATH=... node tests/probe_fail_names_the_move.js
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
const KNOB = process.env.MEDI_BARE_FAIL_LABELS === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_fail_names_the_move.js — a handler-written `-fail` names its own move');
console.log('  MEDI_BARE_FAIL_LABELS=' + (KNOB ? '1  (PRE-FIX ENGINE: both lines go out bare)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run. The CR is stripped because this checkout is CRLF and a carriage
 *    return is a JavaScript line terminator, so a multi-line anchor would match nothing.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const block = (src, id) => {
  const m = new RegExp('\\n\\t' + id + ': \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(src);
  return m ? m[1] : null;
};

console.log(NL + '0. THE AUTHORITY');
const ASW = block(MOVES, 'allyswitch');
ok(!!ASW && /this\.add\('-fail', pokemon, 'move: Ally Switch'\);/.test(ASW),
   "allyswitch's `onHit` announces its OWN refusal and NAMES the move",
   ASW ? (ASW.match(/if \(!success\) \{[\s\S]{0,150}/) || ['not found'])[0] : 'allyswitch block not found');
ok(!!ASW && /onRestart\(pokemon\) \{[\s\S]*?delete pokemon\.volatiles\['allyswitch'\];\s*\n\s*return false;/.test(ASW)
   && !/onRestart\(pokemon\) \{[\s\S]*?this\.add\('-fail'[\s\S]*?\n\t\t\t\},/.test(ASW),
   "the CONSECUTIVE-USE refusal is `condition.onRestart` and writes NO `-fail` of its own — so it is "
   + 'the BARE generic line, and that is what the ASW-STALLED control asserts',
   ASW ? (ASW.match(/onRestart\(pokemon\) \{[\s\S]{0,260}/) || ['not found'])[0] : '');
ok(!/\n\tallyswitch: \{/.test(CH_MOVES),
   'Champions does not override `allyswitch`, so mainline IS its authority');
ok(!/\n\tsubstitute: \{/.test(CH_MOVES),
   'Champions does not override `substitute`, so mainline IS its authority');

/* WHICH MOVES CARRY `[weak]` IS NOT TYPED IN THE ENGINE — every member of `costsUserHP` is re-read
 * here, and the tag's own membership is read out of data/tags.json rather than listed. */
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const COSTS = Object.keys(TAGS.moves || {})
  .filter(k => ((TAGS.moves[k] && TAGS.moves[k].tags) || []).indexOf('costsUserHP') >= 0);
const weakRows = COSTS.map(k => {
  const b = block(MOVES, k) || '';
  const gate = /this\.add\('-fail', \w+, 'move: ([^']+)', '(\[[a-z]+\])'\);/.exec(b);
  const tag = ((TAGS.moves[k].params || {}).costsUserHP || {}).announcesFailBelow || null;
  return { id: k, flag: gate ? gate[2] : null, label: gate ? gate[1] : null, tag };
});
/* THE MEMBERS DO NOT ALL ANNOUNCE, AND THAT IS THE POINT OF THE FIELD. Substitute and Shed Tail
 * write the label AND `[weak]`; Clangorous Soul's `onTry` is a bare `return false`, so the generic
 * two-field line is correct for it and the engine must NOT label it. The assertion is that the tag
 * and the handler AGREE, member by member — not that every member announces. */
ok(COSTS.length > 0
   && weakRows.every(r => (r.flag === null && r.tag === null)
                       || (r.tag && r.tag.flag === r.flag && r.tag.label === r.label)),
   '`costsUserHP.announcesFailBelow` agrees with each member\'s own handler, and a member that '
   + 'announces nothing carries no field — ' + COSTS.length + ' member(s) read this run',
   weakRows.map(r => '  ' + r.id.padEnd(16)
     + 'handler: ' + (r.flag ? "'" + r.label + "' " + r.flag : 'no announced refusal (the generic bare line)')
     + '   tag: ' + (r.tag ? "'" + r.tag.label + "' " + r.tag.flag : 'absent')).join('\n'));
ok(weakRows.some(r => r.tag), 'at least one member DOES announce, so this clause is not vacuous');

/* ==================================================================================================
 * 1. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NOT STAGED — the top arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
/* Every idle click is a SELF-TARGETED status move, so no arm depends on a foe aim and nothing but the
 * scripted attack can touch a board. Nasty Plot at +6 stops boosting and writes `|-boost|spa|0` on
 * both engines, which is compared and agreed. */
const IDLE = { m: 'nastyplot' };

function play(tag, A, B, script, opts) {
  const a = G.buildPair(A, (opts && opts.optA) || undefined);
  const b = G.buildPair(B, (opts && opts.optB) || undefined);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_fail_names_the_move :: ' + tag, {
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
  const fails = (s) => s.filter(l => /^\|-fail\|/.test(l))
                        .map(l => l.replace(/\s+/g, ' ').toLowerCase().replace(/[:,]/g, ''));
  return { staged: true, boards, sd, me, sdFails: fails(sd), meFails: fails(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* ---- ALLY SWITCH. Side B holds exactly TWO bodies so the partner slot cannot be refilled, and the
 * partner is killed by a +2 move from a FASTER body in the same turn the +2 Ally Switch is clicked.
 * Dragonite (spe 80) outruns Farigiraf (spe 60) inside the +2 bracket, so the corpse is in the slot
 * when `onHit` asks. Farigiraf runs Cud Chew rather than Armor Tail deliberately: Armor Tail refuses
 * the incoming priority move outright and no partner ever dies. */
const ASW_A = [mon('dragonite', '', 'Multiscale', ['Extreme Speed']), mon('garchomp', '', 'Rough Skin', ['Dragon Claw']),
               mon('toxapex', '', 'Regenerator', ['Recover']), mon('milotic', '', 'Marvel Scale', ['Recover'])];
const ASW_B = [mon('farigiraf', '', 'Cud Chew', ['Ally Switch', 'Protect']), mon('raichu', '', 'Static', ['Nasty Plot'])];
const ASW_DEAD = play('ASW-DEAD-PARTNER', ASW_A, ASW_B, [
  { p1: [{ m: 'extremespeed', t: 1 }, { m: 'dragonclaw', t: 1 }], p2: [{ m: 'protect' }, IDLE] },
  { p1: [{ m: 'extremespeed', t: 1 }, { m: 'dragonclaw', t: 1 }], p2: [{ m: 'allyswitch' }, IDLE] },
  { p1: [{ m: 'extremespeed', t: 0 }, { m: 'dragonclaw', t: 0 }], p2: [{ m: 'allyswitch' }, null] },
], { optB: { max: 2 } });

/* The stall arm keeps BOTH bodies alive and clicks Ally Switch twice in a row. Turn 1 always
 * succeeds (the volatile is fresh), which swaps the two bodies, so turn 2's click comes from the
 * OTHER slot — the body is the same one. */
const STALL_A = [mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
                 mon('garchomp', '', 'Rough Skin', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const STALL_B = [mon('farigiraf', '', 'Cud Chew', ['Ally Switch']), mon('raichu', '', 'Static', ['Nasty Plot']),
                 mon('kingambit', '', 'Defiant', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const ASW_STALL = play('ASW-STALLED', STALL_A, STALL_B, [
  { p1: [IDLE, IDLE], p2: [{ m: 'allyswitch' }, IDLE] },
  { p1: [IDLE, IDLE], p2: [IDLE, { m: 'allyswitch' }] },
]);

/* ---- SUBSTITUTE. The user is FASTER than its attacker, so it puts a doll up and the attacker
 * breaks it in the same turn; each doll costs a quarter of max HP, so five turns walk the body from
 * full down past the threshold. Turn 2's attacker idles, so turn 3's click meets a doll that is
 * still standing — that is SUB-REPEAT, in the same game and on the same body. */
const SUB_A = [mon('kingambit', '', 'Defiant', ['Iron Head', 'Nasty Plot']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
               mon('garchomp', '', 'Rough Skin', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const SUB_B = [mon('farigiraf', '', 'Cud Chew', ['Substitute']), mon('raichu', '', 'Static', ['Nasty Plot']),
               mon('incineroar', '', 'Intimidate', ['Nasty Plot']), mon('milotic', '', 'Marvel Scale', ['Nasty Plot'])];
const HIT = { m: 'ironhead', t: 0 };
const subTurn = (k) => ({ p1: [k, IDLE], p2: [{ m: 'substitute' }, IDLE] });
const SUB = play('SUB-WEAK+SUB-REPEAT', SUB_A, SUB_B,
  [subTurn(HIT), subTurn(IDLE), subTurn(HIT), subTurn(HIT), subTurn(HIT), subTurn(HIT)]);

/* ==================================================================================================
 * 2. THE JUDGEMENT — the whole `-fail` list in order, never a count
 * ============================================================================================== */
console.log(NL + '1. THE ARMS');
const arms = [['ASW-DEAD-PARTNER', ASW_DEAD], ['ASW-STALLED', ASW_STALL], ['SUB-WEAK+SUB-REPEAT', SUB]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown -fail lines : ' + (R.sdFails.join('   ') || '(none)'));
  console.log('     medicham -fail lines : ' + (R.meFails.join('   ') || '(none)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(R.sdFails.length > 0, tag + ' — the authority actually wrote a `-fail` (an arm with none proves nothing)');
  ok(JSON.stringify(R.sdFails) === JSON.stringify(R.meFails),
     tag + ' — the two engines write the SAME `-fail` lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

/* THE SHAPES, ASSERTED BY NAME, so an arm that agreed by writing nothing cannot pass. */
console.log(NL + '2. THE SHAPES THE ARMS EXIST FOR');
const has = (list, re) => list.some(l => re.test(l));
if (ASW_DEAD.staged) {
  ok(has(ASW_DEAD.sdFails, /^\|-fail\|p2a farigiraf\|move ally switch$/),
     'ASW-DEAD-PARTNER — the authority named the move', ASW_DEAD.sdFails.join(' | '));
}
if (ASW_STALL.staged) {
  ok(has(ASW_STALL.sdFails, /^\|-fail\|p2[ab] farigiraf$/),
     'ASW-STALLED — the authority wrote the BARE line (this is the control that must not move)',
     ASW_STALL.sdFails.join(' | '));
}
if (SUB.staged) {
  ok(has(SUB.sdFails, /^\|-fail\|p2a farigiraf\|move substitute\|\[weak\]$/),
     'SUB-WEAK — the authority named the move AND carried `[weak]`', SUB.sdFails.join(' | '));
  ok(has(SUB.sdFails, /^\|-fail\|p2a farigiraf\|move substitute$/),
     'SUB-REPEAT — the authority named the move and carried NO flag (the control)', SUB.sdFails.join(' | '));
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
