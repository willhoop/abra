/* probe_gigaton_repeat.js — `cantusetwice` IS A CHOICE-TIME DISABLE AND THIS ENGINE ENFORCED IT AT
 * EXECUTION TOO, SO EVERY FORCED REPEAT WAS REFUSED. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_gigaton_repeat.js
 *   SHOWDOWN_PATH=... node tests/probe_gigaton_repeat.js --release <id> --only instruct-repeat-gigaton
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED =================================
 *
 * `cantusetwice` is enforced in ONE place, and it is the request builder:
 *
 *     sim/battle.ts:1692
 *       if (activeMove.flags['cantusetwice'] && pokemon.lastMove?.id === moveSlot.id) {
 *         pokemon.disableMove(pokemon.lastMove.id);
 *       }
 *
 * There is NO refusal at use time. `sim/battle-actions.ts:267` adds a marker volatile named after the
 * move ("Used exclusively for a hint later") and `:313` removes it and prints
 *
 *     |-hint|Some effects can force a Pokemon to use <Move> again in a row.
 *
 * That hint exists for exactly this case: Encore and Instruct both bypass selection, so the disable
 * never applies, the move RUNS, and Showdown explains why. Champions overrides neither — `gigatonhammer`
 * appears in `data/mods/champions/` only in `learnsets.ts:14479`, and the mod's `encore` override
 * (`data/mods/champions/moves.ts:286`) makes the case WORSE, not better: it calls
 * `queue.changeAction(target, {choice:'move', moveid: move.id, order: action.order})` and rewrites the
 * already-queued action in place. Every one of these facts is re-derived at run time below and the file
 * exits 2 rather than run if the format stopped carrying them.
 *
 * TWO `cantusetwice` MOVES EXIST IN THE DEX AND ONLY ONE IS LEGAL HERE — `bloodmoon` is `Past`. The
 * population is DERIVED on every run, so a second legal member reds this file by name.
 *
 * ================= WHAT THIS ENGINE DID ==========================================================
 *
 * WIRE 44 armed `_noRepeat` when the move landed and then asked TWO questions off it:
 *
 *     moveDisabledBy   ->  'noRepeat'                       (the authority's clause; correct)
 *     the execution gate, above the kind dispatch: `if(m._noRepeat===a.move.id){ mvFail(m); }`
 *
 * The second one has no counterpart in the authority at all. And the STATE was a TIMER —
 * `_noRepeatT = (lockoutTurns||1)+1`, ticked down at the foot of every turn — where the authority holds
 * no timer and reads `pokemon.lastMove` directly. Those are not the same lock: a turn on which the body
 * never reached `moveUsed` (a Taunted status click, a flinch, a full paralysis) leaves the authority's
 * `lastMove` untouched and the slot still disabled, while our clock ran down anyway.
 *
 * ================= NOTHING BELOW IS TYPED ========================================================
 *
 * No arm declares an expected line, an expected damage or an expected lock. Both engines play the
 * identical script under the differential's own `middle` pin — which is what shares the `getRandomTarget`
 * draw the Encore override needs — and the file asserts that they AGREE on the move/damage lines of the
 * diagnostic turn, on the board at every boundary (through the driver's own `board_state` snapshot), and
 * on the SELECTION lock read from both engines' own answer: Showdown's `moveSlot.disabled` against
 * medicham2's exported `moveDisabledBy`. `MEDI_CANTUSETWICE_EXEC_REFUSE=1` must part every red arm and
 * move no control.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const NL = '\n';
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
/* The game must not stop at the first divergent line, and the boundary hook needs `--state`. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_gigaton_repeat.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_CANTUSETWICE_EXEC_REFUSE';

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

/* ---- THE BOARDS --------------------------------------------------------------------------------
 * ONE VICTIM AND TWO PRODUCERS, ON TWO BOARDS, BECAUSE THE TWO PRODUCERS NEED DIFFERENT NEIGHBOURS.
 *
 * Tinkaton is the ONLY legal carrier of Gigaton Hammer in this regulation (derived below, not named).
 * It aims at foe slot 1, which is Kingambit — Dark/Steel, so the 160 BP Steel move is RESISTED and the
 * target survives three of them. That matters twice: the arm needs a live board after the repeat, and a
 * faint mid-turn would drag a second, unrelated mechanic into the comparison.
 *
 * INSTRUCT IS THE DETERMINISTIC PRODUCER AND IT IS THE PRIMARY RED. Oranguru is the only legal Instruct
 * user and is SLOWER than Tinkaton (base 60 against 94), so its Instruct resolves after the Gigaton
 * Hammer it repeats — one turn, no Encore, and `targetLoc: target.lastMoveTargetLoc` is carried through,
 * so NO random-target draw is taken at all.
 *
 * ENCORE IS THE SECOND PRODUCER AND IT DOES TAKE A DRAW. Champions' `changeAction` writes no
 * `targetLoc`, so the rewritten action re-rolls its aim through `Battle#getRandomTarget` — which the
 * differential's `middle` arm gives its OWN shared address category, so both engines take the same one.
 * Whimsicott's Prankster puts Encore at +1, ahead of every priority-0 click, so it always lands while
 * the victim's own action is still queued. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const ORAN = ['oranguru', '', 'Telepathy', ['Instruct', 'Calm Mind', 'Protect']];
const WHIM = ['whimsicott', '', 'Prankster', ['Encore', 'Charm', 'Taunt', 'Protect']];
/* THE TARGET. Swords Dance is a self-boost with no die, no contact and no reaction: it keeps the body
 * doing something legal every turn without introducing a second mechanic into the diff. */
const KING = ['kingambit', '', 'Supreme Overlord', ['Swords Dance', 'Protect', 'Iron Head']];
/* FACADE AND NOT PLAY ROUGH, AND THE REASON IS THE FIXTURE RATHER THAN THE MECHANIC. Play Rough is
 * 90% accurate, so an arm using it carries an accuracy DIE — and when the shared die missed, the two
 * narrators wrote the miss differently (`|move|X|Play Rough|[miss]` against a bare `|move|` line plus
 * a `|-miss|`), which is a second, unrelated divergence this file cannot tell apart from its own.
 * Facade is 100% accurate, has no secondary and no self-effect, and against Kingambit (Dark/Steel) it
 * is RESISTED, so nothing faints mid-script. Its `basePowerCallback` doubles only for a statused user
 * and no arm statuses Tinkaton. */
const TINK = ['tinkaton', '', 'Mold Breaker', ['Gigaton Hammer', 'Facade', 'Thunder Wave', 'Protect']];
const LAX = ['snorlax', '', 'Immunity', ['Protect']];

const INS_SIDE = stage([ORAN, KING]).concat(BENCH('clefable', 'sylveon'));
const ENC_SIDE = stage([WHIM, KING]).concat(BENCH('clefable', 'sylveon'));
const VIC_SIDE = stage([TINK, LAX]).concat(BENCH('garchomp', 'milotic'));

const GH = { m: 'gigatonhammer', t: 1 }, PR = { m: 'facade', t: 1 }, TW = { m: 'thunderwave', t: 1 },
      P = { m: 'protect' }, SD = { m: 'swordsdance' }, CM = { m: 'calmmind' },
      INS0 = { m: 'instruct', t: 0 }, ENC0 = { m: 'encore', t: 0 }, CHA0 = { m: 'charm', t: 0 },
      TAU0 = { m: 'taunt', t: 0 };

/* `producer` names which side sheet plays p1. `mirror` exchanges the two sides whole. */
const CASES = [
  /* ---- RED ------------------------------------------------------------------------------------ */
  { id: 'instruct-repeat-gigaton', kind: 'red', producer: 'ins', mirror: false, knobExec: 1, repeat: 1,
    script: [{ p1: [INS0, SD], p2: [GH, P] }],
    what: 'THE AUTHORITY PLAYS GIGATON HAMMER TWICE IN ONE TURN. Tinkaton is faster, so it uses the '
        + 'move and sets `lastMove`; Oranguru then Instructs it, splicing a second action with the '
        + 'SAME `targetLoc`. `sim/battle.ts:1692` never runs between the two — it is the request '
        + 'builder — so nothing is disabled and the second 160 BP hit lands. This engine refused it at '
        + 'the execution gate.' },

  { id: 'instruct-repeat-gigaton-mirror', kind: 'red', producer: 'ins', mirror: true, knobExec: 1, repeat: 1,
    script: [{ p1: [GH, P], p2: [INS0, SD] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE. A fix that reached one side only would pass '
        + 'the arm above and fail here.' },

  { id: 'encore-into-gigaton', kind: 'red', producer: 'enc', mirror: false, knobExec: 1, repeat: 1,
    script: [{ p1: [P, SD], p2: [GH, P] }, { p1: [ENC0, SD], p2: [PR, P] }],
    what: 'THE OTHER PRODUCER, AND IT IS THE INTERACTION WILL FOUND. Turn 1 Tinkaton uses Gigaton '
        + 'Hammer, so the turn-2 request disables the slot and the script clicks Facade instead. '
        + 'Whimsicott then Encores it at +1 while that action is still queued, and Champions\' own '
        + 'Encore REWRITES the queued action to `gigatonhammer`. 160 BP, legally, on the turn the menu '
        + 'refused it.' },

  { id: 'encore-into-gigaton-mirror', kind: 'red', producer: 'enc', mirror: true, knobExec: 1, repeat: 1,
    script: [{ p1: [GH, P], p2: [P, SD] }, { p1: [PR, P], p2: [ENC0, SD] }],
    what: 'AND THE ENCORE HALF WITH THE SIDES EXCHANGED.' },

  { id: 'blank-turn-keeps-the-lock', kind: 'red', producer: 'enc', mirror: false, knobExec: 0, repeat: 0,
    lockRed: true,
    script: [{ p1: [P, SD], p2: [GH, P] }, { p1: [TAU0, SD], p2: [TW, P] }, { p1: [P, SD], p2: [PR, P] }],
    what: 'THE LOCK IS A `lastMove` READ AND NOT A CLOCK. Turn 1 Gigaton Hammer. Turn 2 Whimsicott '
        + 'Taunts at +1 and Tinkaton\'s Thunder Wave is refused at `BeforeMove` — `runMove` returns '
        + 'ABOVE `pokemon.moveUsed`, so the authority\'s `lastMove` is STILL Gigaton Hammer and the '
        + 'turn-3 request still disables the slot. Our timer ticked twice and released it. No board '
        + 'leaf moves here and no line differs: the whole arm is the SELECTION READ, which is why it '
        + 'declares `lockRed` instead of an exec count.' },

  /* ---- CONTROLS. Each clears exactly one thing and must hold on BOTH loads --------------------- */
  { id: 'instruct-repeat-nonlocked', kind: 'control', producer: 'ins', mirror: false, knobExec: 0, repeat: 0,
    script: [{ p1: [INS0, SD], p2: [PR, P] }],
    what: 'THE INSTRUCT MACHINERY, CLEARED. The identical board and the identical splice with Facade '
        + '— which carries no `cantusetwice` — in the Gigaton\'s place. The repeat happens on '
        + 'both engines and always did, so a fix that unblocked the SPLICE rather than the FLAG would '
        + 'not show here and a fix that broke it would.' },

  { id: 'no-instruct', kind: 'control', producer: 'ins', mirror: false, knobExec: 0, repeat: 0,
    differsFrom: 'instruct-repeat-gigaton',
    script: [{ p1: [CM, SD], p2: [GH, P] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and the identical Gigaton Hammer with '
        + 'Calm Mind in the Instruct\'s place. One use, no repeat, nothing to refuse. This arm also '
        + 'carries the instrument\'s own proof: its AUTHORITY lines are asserted DIFFERENT from '
        + '`instruct-repeat-gigaton`\'s, so "the two engines agree" cannot be read off a turn in which '
        + 'no second hit could have appeared on either side.' },

  { id: 'gap-then-gigaton', kind: 'control', producer: 'enc', mirror: false, knobExec: 0, repeat: 0,
    script: [{ p1: [P, SD], p2: [GH, P] }, { p1: [P, SD], p2: [PR, P] }, { p1: [P, SD], p2: [GH, P] }],
    what: 'THE LOCK RELEASES, AND IT RELEASES BECAUSE THE LAST MOVE CHANGED. Gigaton, Facade, '
        + 'Gigaton — the turn-3 click is on the authority\'s own request (asserted: '
        + '`moveNotOnRequest` is 0) and both engines play it. A fix that deleted the mechanic rather '
        + 'than moving it would pass every red arm above and this one too, which is why the boundary '
        + 'LOCK READ below is asserted on every turn of every arm, not only on the red ones.' },

  { id: 'no-encore', kind: 'control', producer: 'enc', mirror: false, knobExec: 0, repeat: 0,
    differsFrom: 'encore-into-gigaton',
    script: [{ p1: [P, SD], p2: [GH, P] }, { p1: [CHA0, SD], p2: [PR, P] }],
    what: 'THE ENCORE CLEARED EXPLICITLY — Charm in its place, so nothing substitutes and Tinkaton\'s '
        + 'own Facade resolves. The knob must not move one byte of this.' },
];

/* ---- LEGALITY AND THE MECHANISM, DERIVED AND REFUSED ------------------------------------------- */
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
for (const row of INS_SIDE.concat(ENC_SIDE, VIC_SIDE)) {
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

/* THE POPULATION AND THE HANDLERS, RE-DERIVED. Nothing here is quoted from the header. */
const CUT = dex.moves.all().filter(m => m.flags && m.flags['cantusetwice']);
const CUT_LEGAL = CUT.filter(legal).map(m => m.id);
const CARRIERS = dex.species.all().filter(legal)
  .filter(s => { const e = LS[s.id]; return !!(e && e.learnset && e.learnset['gigatonhammer']); })
  .map(s => s.name);
const ENC_START = String((dex.moves.get('encore').condition || {}).onStart || '');
const INS_HIT = String(dex.moves.get('instruct').onHit || '');
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    cantusetwice moves in the dex   : ' + CUT.map(m => m.id + (legal(m) ? '' : '[' + m.isNonstandard + ']')).join(' '));
console.log('    ...of which LEGAL here          : ' + CUT_LEGAL.join(' '));
console.log('    legal Gigaton Hammer carriers   : ' + CARRIERS.join(', '));
console.log('    champions encore rewrites queue : ' + /changeAction/.test(ENC_START));
console.log('    instruct re-uses lastMoveTargetLoc: ' + /lastMoveTargetLoc/.test(INS_HIT));
console.log('    instruct refuses failinstruct   : ' + /failinstruct/.test(INS_HIT)
  + '   gigatonhammer carries failinstruct: ' + !!dex.moves.get('gigatonhammer').flags['failinstruct']);
if (CUT_LEGAL.length !== 1 || CUT_LEGAL[0] !== 'gigatonhammer') {
  console.log(NL + 'NOT RUN — the legal `cantusetwice` population is ' + JSON.stringify(CUT_LEGAL)
    + ' and every arm below stages exactly `gigatonhammer`. That is a finding, not a pass.');
  process.exit(2);
}
if (!/changeAction/.test(ENC_START) || !/lastMoveTargetLoc/.test(INS_HIT)
    || dex.moves.get('gigatonhammer').flags['failinstruct']) {
  console.log(NL + 'NOT RUN — the format no longer carries the producer this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS ------------------------------------------------------------------------------- */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* WHAT A MOVE DID, reduced to what both narrators must agree on: which body acted, with what, and what
 * came out of it. Move ids are lowercased and the target field dropped, because the two engines
 * legitimately spell those differently; the DAMAGE field is kept whole, because the whole point of a
 * refused repeat is a hit that did not happen. */
const KEEP = /^\|(move|cant|-damage|-fail|-crit|-supereffective|-resisted|-immune|-hitcount|faint|-activate|-singleturn)\|/;
function shape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!KEEP.test(raw)) continue;
    const p = raw.split('|');
    const tag = p[1], who = norm(String(p[2] || '').split(':').slice(-1)[0]);
    const rest = p.slice(3).filter(x => !/^p[12][ab]:/.test(x))
      .map(x => norm(String(x).replace(/^\s*(move|ability|item):\s*/i, ''))).filter(Boolean);
    out.push(tag + '|' + who + '|' + rest.join('|'));
  }
  return out;
}

/* THE SELECTION LOCK, ASKED OF BOTH ENGINES' OWN ANSWER.
 *   authority : `moveSlot.disabled` — what `sim/battle.ts:1692` wrote via `Pokemon#disableMove`
 *   medicham2 : `moveDisabledBy(mon, id) === 'noRepeat'` — the function `chooseAction` filters with
 * Neither is re-implemented here. `probeReads` counts this file's own calls so the engine counter can
 * be reported net of the instrument. */
let probeReads = 0;
function lockPair(M, mon, sdMon) {
  probeReads++;
  const me = mon ? (M.moveDisabledBy(mon, 'gigatonhammer') === 'noRepeat') : null;
  const slot = sdMon && (sdMon.moveSlots || []).find(s => s.id === 'gigatonhammer');
  const sd = slot ? !!slot.disabled : null;
  return { me, sd };
}

function play(G, c) {
  const M = REL.require('engine/medicham2-browser.js', { need: ['moveDisabledBy'] });
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  const reads0 = probeReads;
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const PROD = c.producer === 'ins' ? INS_SIDE : ENC_SIDE;
  const A = c.mirror ? VIC_SIDE : PROD, B = c.mirror ? PROD : VIC_SIDE;
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { notStaged: true };
  const vicSide = c.mirror ? 'A' : 'B';
  const locks = [], boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_gigaton_repeat :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t, S, battle) => {
      const team = (vicSide === 'A' ? S.sfA : S.sfB);
      const mon = ((team && team.team) || []).find(x => x && norm(x.name) === 'tinkaton');
      const sdMon = (battle.sides[vicSide === 'A' ? 0 : 1].pokemon || [])
        .find(p => p && norm(p.species && p.species.id) === 'tinkaton');
      locks.push(Object.assign({ t }, lockPair(M, mon, sdMon)));
      boards.push({ t, identical: !!snap.identical, leaves: snap.leaves_compared | 0,
                    diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) });
    },
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  /* THE INSTRUMENT'S OWN CALLS, KEPT APART RATHER THAN SUBTRACTED. This file asks `moveDisabledBy`
   * once per boundary per game, and a scripted game skips medicham2's own chooser entirely, so the
   * engine-side figure is small and a subtraction would go negative and look like a bug. Both
   * numbers are printed; neither is asserted, because the SELECTION verdict is asserted directly
   * through `lockPair` on every boundary of every arm. */
  delta.probeSelectionReads = probeReads - reads0;
  const sdRaw = G.lastSdLog().map(String);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  const cut = arr => {                       // the lines of the LAST turn of the script
    let i = -1, n = 0;
    for (let k = 0; k < arr.length; k++) if (/^\|turn\|/.test(arr[k])) { n++; if (n === c.script.length) { i = k; break; } }
    return i < 0 ? [] : arr.slice(i + 1);
  };
  return { r, delta, locks, boards,
    sd: shape(cut(sdAll)), me: shape(cut(meAll)),
    /* THE ARM'S OWN SENSITIVITY, read off the AUTHORITY: how many Gigaton Hammer `|move|` lines the
     * diagnostic turn actually contains. A red arm that reads 1 proves nothing. */
    sdGigatons: cut(sdAll).filter(l => /^\|move\|/.test(l) && /gigaton/i.test(l)).length,
    sdHints: sdRaw.filter(l => /^\|-hint\|/.test(l) && /again in a row/i.test(l)).length,
    meHints: meAll.filter(l => /^\|-hint\|/.test(l)).length,
    sc: G.scriptCounters(), cc: G.choiceCounters(),
    restored: (globalThis.MEDFAILS || {}).cantUseTwiceExecRefuseRestored || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const lockEq = rows => rows.every(r => r.me === r.sd);
const lockStr = rows => rows.map(r => 'b' + r.t + ':' + (r.me ? 'D' : '-') + '/' + (r.sd ? 'D' : '-')).join(' ');
const boardEq = rows => rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

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

  console.log('    showdown  ' + clean.sd.join('  ->  '));
  console.log('    medicham  ' + clean.me.join('  ->  '));
  console.log('    medicham  ' + brk.me.join('  ->  ') + '   [knob]');
  console.log('    lock (medicham/showdown)  ' + lockStr(clean.locks)
    + '   |   knob ' + lockStr(brk.locks));
  console.log('    board                     ' + boardStr(clean.boards)
    + '   |   knob ' + boardStr(brk.boards));
  if (!boardEq(clean.boards)) for (const b of clean.boards) if (!b.identical) console.log('      b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  console.log('    authority Gigaton |move| lines on the diagnostic turn : ' + clean.sdGigatons);
  console.log('    authority `-hint` lines : ' + clean.sdHints + '   medicham `-hint` lines : ' + clean.meHints);
  console.log('    counters  execRefused ' + (clean.delta.cantUseTwiceRefusedAtExec || 0)
    + '  repeatRan ' + (clean.delta.cantUseTwiceRepeatRan || 0)
    + '  selectionRefused ' + (clean.delta.cantUseTwiceRefusedAtSelection || 0)
    + ' (of which this probe asked ' + (clean.delta.probeSelectionReads || 0) + ')'
    + '   |   knob execRefused ' + ((brk.delta || {}).cantUseTwiceRefusedAtExec || 0)
    + '   |   expected clean exec 0, knob exec ' + c.knobExec + ', repeat ' + c.repeat);
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : '')
    + '   |   choices refused ' + clean.cc.refused + (clean.cc.first ? ' (' + clean.cc.first + ')' : ''));

  /* THE FIXTURE, BEFORE ANY VERDICT. */
  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) {
    console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue; }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED. */
  if (!(clean.restored === 0 && brk.restored === 1)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue; }
  /* SENSITIVITY, READ OFF THE AUTHORITY'S OWN INSTRUMENTATION. `sim/battle-actions.ts:267` raises the
   * marker volatile under EXACTLY the condition this fix is about, and `:313` spends it on the
   * `|-hint|` line — so the count of hints in Showdown's raw log IS the authority saying "a
   * `cantusetwice` repeat ran here", with no classification by this file. An arm declaring a repeat
   * that produces no hint proves nothing; a control that produces one is not a control. */
  if (c.repeat !== (clean.sdHints > 0 ? 1 : 0)) {
    console.log('    >> FIXTURE FAILED — the authority printed ' + clean.sdHints + ' `-hint` line(s) '
      + 'and this arm declared repeat ' + c.repeat + '.'); bad++; continue; }
  /* AND THE DECLARED PROTOCOL GAP, ASSERTED RATHER THAN LEFT IMPLICIT. This engine emits no `-hint`
   * at all: `-hint` is a DECLARED non-emission in data/protocol-events.json ("client hint text;
   * carries no rule") and is absent from TRACE_EVENTS, so `sdStream` drops it from the authority's
   * side too and the whole-game differential cannot see it. That is why the boards above agree while
   * this number stays at 0. It is recorded here so the gap is a measured fact and not an omission. */
  if (clean.meHints !== 0) {
    console.log('    >> UNEXPECTED — this engine emitted a `-hint`, which is not claimed in '
      + 'TRACE_EVENTS and would fail tests/test-protocol-trace.js PART 1.'); bad++; continue; }

  seen.set(c.id, { sd: clean.sd, me: clean.me });

  /* THE COUNTERS, EXACT, ON BOTH LOADS. `cantUseTwiceRefusedAtExec` must be 0 on EVERY clean arm —
   * the execution refusal no longer exists — and must hit the per-arm declared value under the knob,
   * so "the arm agreed" can never be read off a restore path that did not run. `cantUseTwiceRepeatRan`
   * is the authority's `:267` condition asked at this engine's `moveUsed` position and is the count of
   * repeats that actually reached execution. */
  if ((clean.delta.cantUseTwiceRefusedAtExec || 0) !== 0
      || (clean.delta.cantUseTwiceRepeatRan || 0) !== c.repeat
      || ((brk.delta || {}).cantUseTwiceRefusedAtExec || 0) !== c.knobExec) {
    console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED.'); bad++; }

  const agree = eq(clean.sd, clean.me) && boardEq(clean.boards) && lockEq(clean.locks);
  if (!agree) {
    console.log('    >> DEFECT — the engines part on the move lines, on the board, or on the '
      + 'selection lock.'); bad++;
  } else console.log('    >> the two engines agree on the lines, the board AND the selection lock.');

  const knobAgree = eq(clean.sd, brk.me) && boardEq(brk.boards) && lockEq(brk.locks);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* THE INSTRUMENT'S OWN CONTROL: the cleared arm must produce DIFFERENT AUTHORITY lines from the red
 * one it clears. Without it, every "the engines agree" above could be a turn in which no second hit
 * could have appeared on either side. */
for (const c of CASES) {
  if (!c.differsFrom) continue;
  const a = seen.get(c.id), b = seen.get(c.differsFrom);
  if (!a || !b) continue;
  const moved = !eq(a.sd, b.sd);
  console.log(NL + '  INSTRUMENT CONTROL — showdown plays `' + c.id + '` differently from `'
    + c.differsFrom + '`: ' + (moved ? 'YES' : 'NO'));
  if (!moved) { console.log('    >> THE PRODUCER IS UNWIRED IN THE AUTHORITY TOO — nothing here measures anything.'); bad++; }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
