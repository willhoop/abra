/* probe_shield_rearm.js — THE SHIELD GATE WAS ARMED OFF THE MOVE THE PLAYER CLICKED, AND THREE SITES
 * REPLACE THAT MOVE AFTER THE PRE-PASS HAS RUN. 2026-08-29.
 *
 *   SHOWDOWN_PATH=... node tests/probe_shield_rearm.js
 *   SHOWDOWN_PATH=... node tests/probe_shield_rearm.js --release <id> --only encore-into-free-protect
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED =================================
 *
 * `data/mods/champions/moves.ts` overrides `protect` with `{ inherit: true, pp: 5 }` and nothing else,
 * so the handler is mainline's (`data/moves.ts`) and it is read out of the format on every run below:
 *
 *     onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
 *     onHit(pokemon)        { pokemon.addVolatile('stall'); }
 *
 * `onPrepareHit` lives inside `useMoveInner` — PER ACTION, AT EXECUTION — so it is raised on the move
 * that is BEING USED and cannot see when the action was chosen. `stall` (data/conditions.ts:439-462,
 * no Champions override) starts its counter at 3, triples it on each further use, and is deleted only
 * by a LOST roll, a `breaksProtect` hit and its own `duration: 2` running out.
 *
 * ================= WHAT THIS ENGINE DID ==========================================================
 *
 * `_shieldPending` / `_guardPending` / `_stallPending` were decided ONCE PER TURN, in the pre-pass,
 * off `it.a.kind` and `actionMoveId(it.a)` — i.e. off the move the player clicked. Three sites replace
 * that move afterwards and none of them re-asked:
 *
 *     WIRE 143   Encore's execution-time override rewrites `it.a` in place
 *     Instruct   splices a whole second action into `acts` that the pre-pass never walked
 *     a called move (Copycat / Sleep Talk) splices one the same way
 *
 * So a substituted shield never reached `_shieldGate`: no queue scan, no stall die, no counter, and
 * the `kind:'protect'` branch then announced the shield off whatever `mon.protect` ALREADY held —
 * `-fail` for a body that had none, and a free UNROLLED `-singleturn` for one that did.
 *
 * ================= WHY IT IS THE `stall` BOARD LEAF ==============================================
 *
 * `data/verification/game-differential.stallbase.json` (release cc7dca43e395, pool 0d103fb9fa87,
 * census 9446a684709d, 961 games, arm middle) carries `active[].stall` at 13 leaves in 13 games, and
 * every leaf that appears in `first_board_divergences` reads the SAME WAY ROUND:
 *
 *     p2.active[0].stall  medicham 0  showdown 9
 *     p1.active[0].stall  medicham 0  showdown 3   (x3)
 *     p1.active[1].stall  medicham 0  showdown 3
 *
 * — we hold no counter where the authority holds one. Six of the diverging games carry
 * `|-singleturn|pXa|protect <> |-fail|pXa` as their first protocol divergence, and in ALL SIX the
 * shield in question was substituted mid-turn: four by an Encore that landed the same turn, two by an
 * Instruct. Two more games part on the BOARD ALONE with no protocol divergence at all.
 *
 * ================= NOTHING BELOW IS TYPED ========================================================
 *
 * No arm declares an expected line and no arm declares an expected counter value. Both engines play
 * the identical script under the differential's own `middle` pin; the file asserts that they AGREE,
 * that the knob puts them back apart on the red arms and does NOT move the controls, and that the
 * branch counters say which arms exercised the fix. The stall leaf is compared through medicham2's own
 * exported `stallBoardCounter` — the same function `engine/board_state.js` calls — against Showdown's
 * `volatiles.stall.counter`, so no mapping is invented here.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const NL = '\n';
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
/* The game must not stop at the first divergent line: the diagnostic turn is turn 2 on every arm. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_shield_rearm.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_SHIELD_NO_REARM';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE BOARD ---------------------------------------------------------------------------------
 * TWO SUBSTITUTORS AND ONE VICTIM PER ARM. Whimsicott's Prankster puts Encore at +1, ahead of every
 * priority-0 click, so it always lands while the victim's own action is still queued. Oranguru is the
 * ONLY legal Instruct user in this regulation and is faster than Toxapex, so its Instruct resolves
 * BEFORE the victim's own action — which is card 6's board and is what makes the repeat a move from a
 * PREVIOUS turn rather than this one. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const WHIM = ['whimsicott', '', 'Prankster', ['Encore', 'Charm', 'Protect', 'Helping Hand']];
const ORAN = ['oranguru', '', 'Telepathy', ['Instruct', 'Calm Mind', 'Protect']];
/* THE VICTIM IS THE SLOWEST BODY ON THE FIELD (base 35), and that is load-bearing twice: it is what
 * makes its own shield the LAST action of turn 1 — so `willAct()` is false, the authority refuses the
 * move, adds NO stall and draws NO die — and it is what puts it behind Oranguru on turn 2. Both red
 * families therefore reach turn 2 with the counter provably at 0, so the authority's shield CANNOT be
 * refused and no die decides the arm. */
/* THE VICTIM'S FILLER CLICK IS HAZE AND NOT RECOVER, AND THE REASON IS THE FIXTURE RATHER THAN THE
 * MECHANIC. Recover at full HP FAILS, and the two engines narrate that failure differently — the
 * authority writes `|move|X|Recover||[still]` and this engine `|move|X|recover|X` — so an arm using it
 * carries a second, unrelated divergence and could not say which one it had found. Haze always
 * succeeds, touches no HP and no counter, and clears the same boosts on both sides. */
const TOX = ['toxapex', '', 'Regenerator', ['Protect', 'Haze', 'Wide Guard', 'Endure', 'Toxic Spikes']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Charm', 'Protect', 'Helping Hand']];

const SUB = stage([WHIM, ORAN]).concat(BENCH('clefable', 'snorlax'));
const VIC = stage([TOX, MEOW]).concat(BENCH('garchomp', 'sylveon'));

const P = { m: 'protect' }, RC = { m: 'haze' }, C = { m: 'charm', t: 0 }, CM = { m: 'calmmind' },
      EN = { m: 'endure' }, WG = { m: 'wideguard' }, HH = { m: 'helpinghand' }, TS = { m: 'toxicspikes' },
      ENC0 = { m: 'encore', t: 0 }, INS0 = { m: 'instruct', t: 0 };

/* p1 = the substitutors, p2 slot 0 = the victim. `mirror: true` exchanges the two sides whole. */
const CASES = [
  /* ---- RED ------------------------------------------------------------------------------------ */
  { id: 'encore-into-free-protect', kind: 'red', mirror: false, rearm: 1, armed: 1,
    script: [{ p1: [P, P], p2: [P, P] }, { p1: [ENC0, CM], p2: [RC, C] }],
    what: 'THE POOL\'S OWN SHAPE. Turn 1 all four bodies click Protect and the victim, being slowest, '
        + 'holds the last action — `willAct()` is false, the authority refuses the move and adds NO '
        + 'stall. Turn 2 it clicks Haze and Whimsicott Encores it back into Protect while that '
        + 'action is still queued. The counter is 0, so the authority CANNOT refuse the shield and no '
        + 'die decides this arm.' },

  { id: 'encore-into-free-protect-mirror', kind: 'red', mirror: true, rearm: 1, armed: 1,
    script: [{ p1: [P, P], p2: [P, P] }, { p1: [RC, C], p2: [ENC0, CM] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE. The pool carries it on p1 and on p2; a fix '
        + 'that reached one side only would pass the arm above and fail here.' },

  { id: 'instruct-repeat-free-protect', kind: 'red', mirror: false, rearm: 1, armed: 1,
    script: [{ p1: [P, P], p2: [P, P] }, { p1: [C, INS0], p2: [RC, C] }],
    what: 'THE OTHER PRODUCER, AND IT IS THE SAME DEFECT. Identical turn 1. On turn 2 Oranguru '
        + 'Instructs the victim, which SPLICES a whole second action into the turn that the pre-pass '
        + 'never walked. Instruct carries no "has it moved yet" clause, so the move it repeats is the '
        + 'victim\'s Protect from turn 1 — which is card 6\'s board exactly.' },

  { id: 'instruct-repeat-free-protect-mirror', kind: 'red', mirror: true, rearm: 1, armed: 1,
    script: [{ p1: [P, P], p2: [P, P] }, { p1: [RC, C], p2: [C, INS0] }],
    what: 'AND THE INSTRUCT HALF WITH THE SIDES EXCHANGED.' },

  { id: 'encore-into-endure', kind: 'red', mirror: false, rearm: 1, armed: 1,
    script: [{ p1: [P, P], p2: [EN, P] }, { p1: [ENC0, CM], p2: [RC, C] }],
    what: 'THE FIX IS THE TAG AND NOT THE `protect` KIND. Endure is the sixth `stallCounterChecks` '
        + 'member and this engine dispatches it as `{kind:\'affect\'}`, so it arms through the '
        + '`_stallPending` branch rather than the shield one. An implementation keyed on '
        + '`kind === \'protect\'` passes every arm above and fails here.' },

  /* ---- CONTROLS. Each clears exactly one thing and must hold on BOTH loads --------------------- */
  { id: 'no-encore', kind: 'control', mirror: false, rearm: 0, armed: 0, differsFrom: 'encore-into-free-protect',
    script: [{ p1: [P, P], p2: [P, P] }, { p1: [C, CM], p2: [RC, C] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and the identical clicks with Charm in '
        + 'the Encore\'s place. Nothing substitutes, so nothing re-arms. This arm also carries the '
        + 'instrument\'s own proof: its AUTHORITY lines are asserted DIFFERENT from '
        + '`encore-into-free-protect`\'s, so "the two engines agree" cannot be read off a turn in '
        + 'which no shield could have appeared.' },

  { id: 'plain-protect-chain', kind: 'control', mirror: false, rearm: 0, armed: 0,
    script: [{ p1: [C, CM], p2: [P, C] }, { p1: [C, CM], p2: [P, C] }],
    what: 'THE ORDINARY PATH, WHICH IS EVERY SHIELD IN ALMOST EVERY TURN. A body clicks Protect twice '
        + 'and nothing substitutes anything: the arming is decided once, `_armMv` still equals the '
        + 'move at the gate, and the second use draws its own 1/3 off the shared counter. The knob '
        + 'must not move one byte of this.' },

  { id: 'encore-into-nonshield', kind: 'control', mirror: false, rearm: 1, armed: 0,
    script: [{ p1: [C, CM], p2: [TS, C] }, { p1: [ENC0, CM], p2: [RC, C] }],
    what: 'THE RE-ARM FIRES AND ARMS NOTHING. The victim clicks Haze and is Encored into Toxic Spikes, '
        + 'which is neither a shield nor a `stallCounterChecks` member, so the re-ask runs and leaves '
        + 'all three pendings false. A fix that armed on the FACT of a substitution rather than on the '
        + 'move breaks here.' },

  { id: 'instruct-repeat-nonshield', kind: 'control', mirror: false, rearm: 1, armed: 0,
    script: [{ p1: [C, CM], p2: [RC, C] }, { p1: [C, INS0], p2: [RC, C] }],
    what: 'AND THE SAME FOR THE SPLICED ACTION: Instruct repeats a Haze. The entry is new, so the '
        + 're-ask runs on it — and must arm nothing.' },

  { id: 'wideguard-plain', kind: 'control', mirror: false, rearm: 0, armed: 0,
    script: [{ p1: [C, CM], p2: [WG, C] }, { p1: [C, CM], p2: [P, C] }],
    what: 'THE `_guardPending` PATH, UNTOUCHED. A Wide Guard feeds the shared counter through '
        + '`stallCounterFeeds` and the Protect that follows is rolled against it. Nothing substitutes, '
        + 'so this arm proves the refactor moved the branches without changing them.' },

  { id: 'endure-plain', kind: 'control', mirror: false, rearm: 0, armed: 0,
    script: [{ p1: [C, CM], p2: [EN, C] }, { p1: [C, CM], p2: [EN, C] }],
    what: 'AND THE `_stallPending` PATH, UNTOUCHED — an ordinary Endure chain with no substitution in '
        + 'it at all.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const row of SUB.concat(VIC)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE MECHANISM, READ OUT OF THE FORMAT RATHER THAN QUOTED ---------------------------------- */
const PREP = String(dex.moves.get('protect').onPrepareHit || '');
const ONHIT = String(dex.moves.get('protect').onHit || '');
const STALL = dex.conditions.get('stall');
const INSTRUCT = dex.moves.get('instruct');
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    protect.onPrepareHit reads queue.willAct() : ' + /willAct/.test(PREP));
console.log('    protect.onPrepareHit raises StallMove      : ' + /StallMove/.test(PREP));
/* THE COMPILED `dist/` SOURCE QUOTES WITH DOUBLE QUOTES (`addVolatile("stall")`) and the `.ts` with
 * single ones. Matching the argument rather than the quoting is what stops this check from failing on
 * a build detail and reporting it as "the format changed". */
console.log('    protect.onHit adds the stall volatile      : ' + /addVolatile\(["']stall["']\)/.test(ONHIT));
console.log('    stall duration=' + STALL.duration + ' counterMax=' + STALL.counterMax
  + '   (onStart 3, onRestart *=3, randomChance(1,counter))');
console.log('    instruct exists / not standard            : ' + (INSTRUCT.exists && !INSTRUCT.isNonstandard));
console.log('    protect carries failinstruct              : ' + !!dex.moves.get('protect').flags['failinstruct']);
const STALLERS = dex.moves.all().filter(m => m.stallingMove && legal(m)).map(m => m.id);
console.log('    LEGAL stallingMove members                : ' + STALLERS.join(' '));
if (!/willAct/.test(PREP) || !/StallMove/.test(PREP) || !/addVolatile\(["']stall["']\)/.test(ONHIT)) {
  console.log(NL + 'NOT RUN — the format no longer carries the handler this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS -------------------------------------------------------------------------------
 * THE STALL LEAF IS COMPARED THROUGH THE ENGINE'S OWN FUNCTION. `stallBoardCounter` maps this engine's
 * count-UP (`tookProtectTurns`) onto Showdown's DENOMINATOR (`volatiles.stall.counter`); it is what
 * `engine/board_state.js` calls, and its three constants come off `stallCounterChecks` and therefore
 * off `data/conditions.ts`. Calling it rather than copying it is the whole point. */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* THE SHIELD LINES OF THE DIAGNOSTIC TURN, REDUCED TO WHAT A SHIELD IS: which body, which shield
 * verb, and whether it went up. Move ids are lowercased and target fields dropped, because the two
 * engines legitimately spell those differently (`|move|X|Protect|X` against `|move|X|protect|X`) and a
 * casing difference is not this defect. */
const SHIELD_LINE = /^\|(move|-singleturn|-fail|-activate|-start)\|/;
function shieldShape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!SHIELD_LINE.test(raw)) continue;
    const p = raw.split('|');
    const tag = p[1], who = String(p[2] || '').split(':')[0].trim();
    const rest = p.slice(3).filter(x => !/^p[12][ab]:/.test(x))
      .map(x => norm(String(x).replace(/^\s*(move|ability|item):\s*/i, ''))).filter(Boolean);
    out.push(tag + '|' + who + '|' + rest.join('|'));
  }
  return out;
}

function play(G, c) {
  const M = REL.require('engine/medicham2-browser.js', { need: ['stallBoardCounter'] });
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const A = c.mirror ? VIC : SUB, B = c.mirror ? SUB : VIC;
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { notStaged: true };
  const vicSide = c.mirror ? 'A' : 'B';
  const rows = [];
  const r = G.playGame(a, b, 'directed', 'probe_shield_rearm :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t, S, battle) => {
      const team = (vicSide === 'A' ? S.sfA : S.sfB);
      const m = ((team && team.team) || []).find(x => x && norm(x.name) === 'toxapex');
      const s = (battle.sides[vicSide === 'A' ? 0 : 1].pokemon || [])
        .find(p => p && norm(p.species && p.species.id) === 'toxapex');
      const v = s && s.volatiles && s.volatiles.stall;
      rows.push({ t, me: m ? M.stallBoardCounter(m.tookProtectTurns | 0) : -1, sd: v ? (v.counter | 0) : 0 });
    },
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  const cut = arr => {                       // the lines of the LAST turn of the script
    let i = -1, n = 0;
    for (let k = 0; k < arr.length; k++) if (/^\|turn\|/.test(arr[k])) { n++; if (n === c.script.length) { i = k; break; } }
    return i < 0 ? [] : arr.slice(i + 1);
  };
  return { r, delta, rows,
    sd: shieldShape(cut(sdAll)), me: shieldShape(cut(meAll)),
    sdRaised: cut(sdAll).filter(l => /^\|-singleturn\|/.test(l) && /toxapex/i.test(l)
                                     && /(protect|endure)/i.test(l)).length,
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).shieldNoRearmRestored || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const stallEq = rows => rows.every(r => r.me === r.sd);
const stallStr = rows => rows.map(r => 'b' + r.t + ':' + r.me + '/' + r.sd).join('  ');

let bad = 0, ran = 0;
const seen = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  console.log('    stall leaf (medicham/showdown)   ' + stallStr(clean.rows));
  console.log('    stall leaf under the knob        ' + stallStr(brk.rows));
  console.log('    showdown  ' + clean.sd.join('  ->  '));
  console.log('    medicham  ' + clean.me.join('  ->  '));
  console.log('    medicham  ' + brk.me.join('  ->  ') + '   [knob]');
  console.log('    re-arms   clean ' + (clean.delta.shieldGateRearmed || 0) + ' (armed '
    + (clean.delta.shieldGateRearmedArmed || 0) + ', disarmed ' + (clean.delta.shieldGateRearmedDisarmed || 0)
    + ', stood-through ' + (clean.delta.shieldStoodThroughRefusal || 0) + ')   knob '
    + ((brk.delta || {}).shieldGateRearmed || 0)
    + '   |   expected clean ' + c.rearm + '/' + c.armed);
  console.log('    MEDFAILS stamp   clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   script clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : ''));

  /* A CLICK THE REQUEST DID NOT OFFER becomes a `pass` on both engines and the arm agrees while
   * testing nothing. Asserted at EXACT zero. */
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue;
  }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED. */
  if (!(clean.restored === 0 && brk.restored === 1)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue;
  }
  /* THE BRANCH COUNTERS, EXACT. A control at 0 and a red arm at 1, so "it agreed" cannot be read off
   * a branch that never ran. */
  if ((clean.delta.shieldGateRearmed || 0) !== c.rearm
      || (clean.delta.shieldGateRearmedArmed || 0) !== c.armed) {
    console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED.'); bad++;
  }
  /* THE ARM MUST BE SENSITIVE: on a red arm the AUTHORITY's substituted shield has to have gone UP,
   * or "the engines agree" is a turn in which nothing could have differed. */
  if (c.kind === 'red' && clean.sdRaised < 1) {
    console.log('    >> FIXTURE FAILED — the authority raised no shield on the diagnostic turn, so '
      + 'this arm proves nothing.'); bad++; continue;
  }

  seen.set(c.id, { sd: clean.sd, me: clean.me, meKnob: brk.me, rows: clean.rows });

  const agree = eq(clean.sd, clean.me) && stallEq(clean.rows);
  if (!agree) { console.log('    >> DEFECT — the engines part on the shield lines or on the stall leaf.'); bad++; }
  else console.log('    >> the two engines agree on the shield lines AND on the stall counter.');

  const knobAgree = eq(clean.sd, brk.me) && stallEq(brk.rows);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* THE INSTRUMENT'S OWN CONTROL: `no-encore` must produce DIFFERENT AUTHORITY lines from
 * `encore-into-free-protect`. Without it, every "the engines agree" above could be a turn in which no
 * shield could have appeared on either side. */
for (const c of CASES) {
  if (!c.differsFrom) continue;
  const a = seen.get(c.id), b = seen.get(c.differsFrom);
  if (!a || !b) continue;
  const moved = !eq(a.sd, b.sd);
  console.log(NL + '  INSTRUMENT CONTROL — showdown plays `' + c.id + '` differently from `'
    + c.differsFrom + '`: ' + (moved ? 'YES' : 'NO'));
  if (!moved) { console.log('    >> THE KNOB IS UNWIRED IN THE AUTHORITY TOO — nothing here measures anything.'); bad++; }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
