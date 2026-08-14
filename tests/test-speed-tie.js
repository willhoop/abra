/* WIRE 134 — DOES A SPEED TIE RESOLVE TO THE SAME BODY IN BOTH ENGINES?
 *
 *   SHOWDOWN_PATH=... node tests/test-speed-tie.js
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * THE TWO ENGINES DISAGREED ABOUT EVERY SPEED TIE FOR THE LIFE OF THIS PROJECT, and nothing in the
 * repository could see it. `engine/game_differential.js`'s own header claimed the pin made the two
 * agree on a tie "by construction"; that claim was false. Measured 2026-08-07 on a staged pure tie
 * (Volcarona against Charizard, both 100 base Speed, and the differential builds every body
 * Serious / 0 EV / 31 IV so the two finals are exactly equal) under the differential's primary pin:
 *
 *     Showdown    |move|p2a: Charizard …   then   |move|p1a: Volcarona
 *     medicham2   |move|p1a: Volcarona  …   then   |move|p2a: Charizard
 *
 * It is not a corner case. ROADMAP #86 records that 91.4% of legal species share a base Speed with
 * some other species, and the published differential run resolved 53,242 tied groups. It is also not
 * confined to the instrument: `sortTurnOrder` IS the live engine, so every rollout MILTANK has run
 * and every live game resolved a tied matchup to the wrong body.
 *
 * ================= THE CAUSE WAS THE ALGORITHM, NOT THE COMPARATOR ==============================
 *
 * `Array.prototype.sort` is STABLE: a comparator returning 0 leaves the two in input order.
 * `Battle#speedSort` (sim/battle.ts:429) is a SELECTION SORT, and its swaps move UNTIED elements
 * around — so the tied group's order when the shuffle finally sees it is not the input order. In the
 * trace above, the swap that lifted the faster Protect to the front is what put Volcarona behind
 * Charizard before either was compared to the other. No comparator can make a stable sort produce
 * that permutation.
 *
 * ================= AND THE FIX IS NOT "TAKE THE LATER BODY" =====================================
 *
 * That is what the AUTHORITY PRODUCES UNDER THE HARNESS'S PIN — which replaces `PRNG.shuffle` with a
 * no-op — and it is not the game's rule. A real `speedSort` ends in a Fisher-Yates over the tied
 * group: a speed tie is a COIN FLIP. Hardcoding the pinned answer would make medicham2 match the
 * differential and be wrong in every rollout and every live game, and the differential would go
 * green on it. So the engine reproduces the selection sort and resolves the residual group by a
 * uniform key drawn per action — a uniform random permutation under real dice, and the identity
 * under a constant pinned die, which is exactly what the neutralised shuffle does.
 *
 * ================= WHAT IS ASSERTED, AND WHY EACH ARRANGEMENT IS HERE ===========================
 *
 * SHOWDOWN IS THE EXPECTATION AND NOTHING HERE CARRIES A TYPED ANSWER, the same discipline as
 * tests/staged_board.js. Each case plays one scripted turn in both engines and asserts the protocol
 * streams do not part. The arrangements are chosen so that a fix which merely REVERSES the
 * comparator — the exact shape of the bug being replaced — fails:
 *
 *   opposite-sides           the original finding.
 *   opposite-sides-mirrored  the same two bodies with the TEAMS SWAPPED. A reversal passes one
 *                            orientation and fails its mirror.
 *   same-side                both tied bodies on ONE side. There is no "later side" to take here, so
 *                            any rule phrased about sides rather than about the queue fails.
 *   three-way                three bodies at one Speed. A pairwise rule that happens to work on two
 *                            has no answer for a group of three, and the group size is printed.
 *   no-tie (CONTROL)         two bodies at DIFFERENT Speeds. This must have been passing all along;
 *                            if it ever fails, the fix broke ordinary ordering rather than the tie.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* The driver reads its flags off argv at module load; `--state` arms the board comparison so a case
 * that agrees on the stream but not on the board is still caught. */
if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* 100 base Speed, all four, and all four have a row in both engines. Charizard is deliberately NOT
 * given a stone anywhere here: a mega would change the Speed and dissolve the tie the case exists to
 * stage. */
const VOLC = () => mon('volcarona', '', 'Flame Body', ['Bug Buzz', 'Protect']);
const ZARD = () => mon('charizard', '', 'Blaze', ['Flamethrower', 'Dragon Claw', 'Protect']);
/* PSYSHOCK, NOT DAZZLING GLEAM -- 2026-08-14. Ninetales cannot learn Dazzling Gleam in this
 * regulation (TeamValidator: "Ninetales can't learn Dazzling Gleam."), so this body could never have
 * stood on a board the game would accept. Psyshock is the closest legal click: 100-accurate, no
 * secondary, and NOT Fire -- which is the constraint the three-way case below is built around.
 * THE COST, named: Dazzling Gleam is a SPREAD move and Psyshock is single-target, so the click now
 * carries a target and hits one body instead of two. This file's verdict is about the ORDER three
 * tied bodies move in, not about how many of them are hit, and nothing else in the case reads it. */
const NINE = () => mon('ninetales', '', 'Flash Fire', ['Psyshock', 'Protect']);
/* 130 base Speed against 100 — the control's whole content is that these two are NOT tied. */
const WEAV = () => mon('weavile', '', 'Pressure', ['Night Slash', 'Protect']);

const CASES = [
  { id: 'opposite-sides',
    what: 'Volcarona (100 base) leads for side A and Charizard (100 base) for side B. Both click a '
        + 'damaging move at the other. THE ORIGINAL FINDING.',
    A: [VOLC(), mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [ZARD(), mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'garchomp')),
    script: [{ p1: [{ m: 'bugbuzz', t: 0 }, { m: 'protect' }],
               p2: [{ m: 'flamethrower', t: 0 }, { m: 'protect' }] }] },

  { id: 'opposite-sides-mirrored',
    what: 'THE SAME TWO BODIES WITH THE TEAMS SWAPPED. A fix that reverses the comparator passes the '
        + 'case above and fails this one — which is the shape of the defect being replaced.',
    A: [ZARD(), mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'garchomp')),
    B: [VOLC(), mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    script: [{ p1: [{ m: 'flamethrower', t: 0 }, { m: 'protect' }],
               p2: [{ m: 'bugbuzz', t: 0 }, { m: 'protect' }] }] },

  { id: 'same-side',
    what: 'BOTH TIED BODIES ON ONE SIDE — Volcarona and Charizard are side A\'s two actives, at the '
        + 'same Speed, each clicking a damaging move at a different foe. There is no "later side" to '
        + 'take, so a rule phrased about sides rather than about the queue has no answer here.',
    A: [VOLC(), ZARD()].concat(FILL('milotic', 'snorlax')),
    B: [mon('corviknight', '', 'Pressure', ['Protect']),
        mon('toxapex', '', 'Regenerator', ['Protect'])].concat(FILL('clefable', 'garchomp')),
    script: [{ p1: [{ m: 'bugbuzz', t: 0 }, { m: 'flamethrower', t: 1 }],
               p2: [{ m: 'protect' }, { m: 'protect' }] }] },

  { id: 'three-way',
    what: 'THREE bodies at 100 base Speed — Volcarona and Charizard on side A, Ninetales on side B. '
        + 'A pairwise rule that happens to work on two has nothing to say about a group of three.',
    A: [VOLC(), ZARD()].concat(FILL('milotic', 'snorlax')),
    B: [NINE(), mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'garchomp')),
    /* CHARIZARD CLICKS DRAGON CLAW HERE AND NOT FLAMETHROWER. Ninetales' only legal abilities are
     * Flash Fire and Drought, and a Fire move into Flash Fire stages an ABSORPTION rather than a hit —
     * the two engines part there on the announcement (`-start ability: Flash Fire` against
     * `-immune`), which is a real defect and belongs to the protocol differential, not to this file.
     * A scenario that fails for somebody else's reason cannot report on its own. */
    script: [{ p1: [{ m: 'bugbuzz', t: 0 }, { m: 'dragonclaw', t: 0 }],
               p2: [{ m: 'psyshock', t: 0 }, { m: 'protect' }] }] },

  { id: 'no-tie-CONTROL',
    what: 'Weavile (130 base) against Volcarona (100 base). NOT A TIE, and it must have been agreeing '
        + 'all along — a failure here says the fix broke ordinary ordering rather than the tie.',
    A: [WEAV(), mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'snorlax')),
    B: [VOLC(), mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('toxapex', 'garchomp')),
    script: [{ p1: [{ m: 'nightslash', t: 0 }, { m: 'protect' }],
               p2: [{ m: 'bugbuzz', t: 0 }, { m: 'protect' }] }] },
];

/* Every accuracy in this file is 100. THE PIN MAKES ANYTHING BELOW 100 MISS, and a click that stages
 * nothing reads exactly like one that agreed — the trap tests/staged_board.js records four of its
 * first six red demonstrations dying in. Checked here rather than trusted. */
const CS = require(D('engine', 'champions_sim.js'));
const _dex = CS.sim().Dex.forFormat(CS.FORMAT);
let fixtureBad = 0;
for (const c of CASES) {
  for (const step of c.script) {
    for (const side of ['p1', 'p2']) {
      for (const a of (step[side] || [])) {
        const mv = _dex.moves.get(a.m);
        if (!mv || !mv.exists) { console.log('FIXTURE — ' + c.id + ': no such move ' + a.m); fixtureBad++; continue; }
        if (!(mv.accuracy === true || mv.accuracy === 100)) {
          console.log('FIXTURE — ' + c.id + ': ' + mv.name + ' is ' + mv.accuracy + '-accurate and the '
            + 'pin makes it MISS, so the click would stage nothing');
          fixtureBad++;
        }
      }
    }
  }
}

/* EVERY `|move|` line in order, not just the first — the first is usually a Protect, and the thing
 * under test is the order of the two TIED bodies rather than the head of the turn. */
function moveOrder(lines) {
  const out = [];
  for (const l of lines) { const m = /^\|move\|([^|]+)\|([^|]+)/.exec(String(l)); if (m) out.push(m[1] + ' ' + m[2]); }
  return out.length ? out.join('  ->  ') : '(no |move| line at all)';
}

console.log('SPEED TIE — the same body must move first in BOTH engines\n');
console.log('  release ' + G.REL.id + ', arm ' + G.PRIMARY_ARM.id + '\n');
let bad = fixtureBad;
for (const c of CASES) {
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) { console.log('  NOT-STAGED  ' + c.id + ' — buildPair returned null'); bad++; continue; }
  const r = G.playGame(a, b, 'directed', 'speedtie:' + c.id, { script: c.script });
  if (r.err) { console.log('  THREW       ' + c.id + ' — ' + r.err); bad++; continue; }
  if (r.turns !== c.script.length) {
    console.log('  SHORT       ' + c.id + ' — ' + r.turns + ' turn(s) played, ' + c.script.length + ' scripted');
    bad++; continue;
  }
  const parted = !!r.div || !!r.stateDiv;
  console.log('  ' + (parted ? 'DIFFERS ' : 'AGREES  ') + c.id.padEnd(26)
    + moveOrder(r.mediTrace));
  if (parted) {
    bad++;
    const d = r.div || r.stateDiv;
    console.log('      ' + JSON.stringify(d).slice(0, 400));
  }
}

/* ================= AND UNDER REAL DICE IT MUST BE A COIN, NOT A CONSTANT =======================
 *
 * The board cases above all run under the harness's PIN, which neutralises the shuffle in both
 * engines. That proves the two land together; it says NOTHING about whether the engine's tie is a
 * coin flip or a hardcoded side, because a hardcoded side passes every one of them. This is the
 * other half, and it is the half that "take the later body" would fail. */
globalThis.window = globalThis;
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const bare = (sp) => { const m = M.buildMon(sp, {}); m.item = ''; m.ability = 'none'; return m; };
/* THE SAME FUNCTION THE TURN LOOP CALLS, over two real bodies at an identical Speed, with a REAL die.
 * Read off the sort rather than off a battle, because the reading has to be "which action came out
 * first" and a battle only exposes that through a consequence. */
const FIELD = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, sgA: {}, sgB: {} };
const N = 400;
let later = 0;
for (let i = 0; i < N; i++) {
  const x = bare('volcarona'), y = bare('charizard');
  x.st = Object.assign({}, x.st, { sp: 120 });
  y.st = Object.assign({}, y.st, { sp: 120 });
  const ax = { mon: x, side: 'A', a: { kind: 'pass' }, _pri: 0, _qc: 0 };
  const ay = { mon: y, side: 'B', a: { kind: 'pass' }, _pri: 0, _qc: 0 };
  const acts = [ax, ay];
  M.sortTurnOrder(acts, Object.assign({}, FIELD), Math.random);
  if (acts[0] === ay) later++;
}
const p = later / N;
/* +-4.9 points is the 95% half-width at n=400, so 0.40/0.60 is a wide gate on purpose: this asserts
 * "it is a coin rather than a constant", not "it is exactly fair to three places". A hardcoded side
 * reads 0% or 100% and fails it by a mile. */
const fair = p > 0.4 && p < 0.6;
console.log('\n  UNDER REAL DICE the tie goes to the SECOND action ' + later + '/' + N
  + ' times (' + (p * 100).toFixed(1) + '%). A coin is the RULE; the pinned answer is not.');
if (!fair) { console.log('  FAILED: a speed tie is not a coin flip. A hardcoded side passes every board case above.'); bad++; }

/* ================= AND THE CASES ABOVE HAVE TO BE SENSITIVE TO THE ALGORITHM ====================
 *
 * A comparator that has never been shown catching the thing it is trusted on is not evidence. The
 * five board cases would ALSO read AGREES on an engine whose sort happened to coincide with the
 * authority's for other reasons, so the last thing asserted here is that the two algorithms actually
 * PART on this arrangement: the shipped selection sort against the STABLE sort it replaces, over the
 * same four actions, the same keys and the same constant die.
 *
 * The stable arm is built here rather than patched into the engine, because what is being contrasted
 * is one line of algorithm and reproducing it costs four. If these two ever agree, the board cases
 * above have stopped testing anything and this file says so. */
{
  const V = bare('volcarona'), Z = bare('charizard'), C = bare('clefable'), K = bare('corviknight');
  V.st = Object.assign({}, V.st, { sp: 120 }); Z.st = Object.assign({}, Z.st, { sp: 120 });
  const mkAct = (mon, side, pri) => ({ mon, side, a: { kind: 'pass' }, _pri: pri, _qc: 0 });
  /* the `opposite-sides` turn: two Protects at +4 and the two tied attackers at 0, in queue order */
  const make = () => [mkAct(V, 'A', 0), mkAct(C, 'A', 4), mkAct(Z, 'B', 0), mkAct(K, 'B', 4)];
  const PIN = () => 1 - 1e-9;                 // the harness's own primary corner: a CONSTANT die
  const sel = make(); M.sortTurnOrder(sel, Object.assign({}, FIELD), PIN);
  const stab = make();
  const KEYS = new Map(); for (const it of stab) KEYS.set(it, M.turnOrderKey(it, Object.assign({}, FIELD)));
  stab.sort((x, y) => M.compareTurnOrder(KEYS.get(x), KEYS.get(y), FIELD));   // stable: a tie keeps input order
  const nm = (l) => l.map(x => x.mon.name).join(',');
  console.log('\n  SENSITIVITY — the same four actions, the same constant die:');
  console.log('    selection sort (shipped) ' + nm(sel));
  console.log('    stable sort    (before)  ' + nm(stab));
  if (nm(sel) === nm(stab)) {
    console.log('  FAILED: the two algorithms agree on this arrangement, so the board cases above cannot '
      + 'see the defect they exist for.');
    bad++;
  }
}

console.log('\n  ' + (bad ? 'FAILED — ' + bad + ' problem(s)' : 'PASS — every arrangement agrees, and the tie is a coin'));
process.exitCode = bad ? 1 : 0;
