/* probe_room_unburden.js — AN ITEM PARKED BY MAGIC ROOM IS NOT AN ITEM LOST.
 *
 *   SHOWDOWN_PATH=... node tests/probe_room_unburden.js
 *
 * WHERE THIS CAME FROM. `ordering :: |switch|p1b|whimsicott <> |switch|p1a|alakazam` is a
 * BOARD-MATERIAL divergence in the pinned pool (config `omit-spread`, turn 2). Showdown's queue sorts
 * `switch` actions (order 103) on the SWITCHING-OUT body's `getActionSpeed()`, and the two engines
 * ordered p1's two switches differently. Read off the authority's own queue for that game:
 *
 *     Sneasler 151 | Meowstic-M-Mega 182 | Samurott-Hisui 115 | Hatterene 54
 *     showdown  p1b(182), p1a(151), p2a(115), p2b(54)   — a clean descending sort
 *     medicham2 p1a, p1b, p2a, p2b                       — so its Sneasler outran 182
 *
 * The Sneasler holds a White Herb and carries UNBURDEN, and p1b had put MAGIC ROOM up on turn 1.
 *
 * THE RULE. Showdown's Unburden is a VOLATILE that is added by `onAfterUseItem` / `onTakeItem` and
 * whose `onModifySpe` needs `!pokemon.item` (data/abilities.ts; `data/mods/champions/abilities.ts`
 * carries no `unburden` key, so mainline's is what this format runs). Magic Room does NEITHER: it
 * makes `Pokemon#ignoringItem()` true, and the item is still IN THE SLOT. Measured on the authority
 * — Sneasler @ Focus Sash, Magic Room up: `spe 140` before, `spe 140` after, `item focussash`, and
 * no `unburden` volatile at all.
 *
 * THIS ENGINE MODELS THE VOLATILE AS `_hadItem && !m.item` (effSpeed), and `itemRoomHide` EMPTIES the
 * slot into `_roomItem` — so a suppressed item read as a lost one and the Speed doubled. 165 -> 330
 * on a bare board, with the ability-off control unmoved at 165.
 *
 * IT ASSERTS NOTHING AND EXITS 0. It is a measurement; `tests/test-mechanics.js` is what asserts.
 * Knob: MEDI_ROOM_ITEM_IS_LOST=1 restores the defect.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FIXTURE, DERIVED -----------------------------------------------------------------------
 * Nothing below is typed. The carrier is the fastest legal Unburden body that can hold a turn; the
 * roomer is the first legal Magic Room learner; the foe is the SLOWEST legal body that is still
 * strictly faster than the carrier, so the arm separates "normal Speed" from "doubled Speed" by the
 * smallest margin the format allows and cannot pass for an unrelated reason. */
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

const CARRIER = POOL.filter(s => Object.values(s.abilities).some(a => norm(a) === 'unburden')
  && LEARNS(s, 'protect') && LEARNS(s, 'closecombat'))
  .sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
if (!CARRIER) { console.log('  NO LEGAL UNBURDEN CARRIER THAT LEARNS PROTECT AND A DAMAGING MOVE — a claim about the fixture.'); process.exit(0); }
/* the carrier's OTHER ability, for the arm that removes only Unburden. Never a name. */
const CARRIER_OTHER = Object.values(CARRIER.abilities).find(a => norm(a) !== 'unburden');
if (!CARRIER_OTHER) { console.log('  THE CARRIER HAS NO SECOND ABILITY — the control cannot be cleared.'); process.exit(0); }

const ROOMER = POOL.find(s => LEARNS(s, 'magicroom') && LEARNS(s, 'protect'));
if (!ROOMER) { console.log('  NO LEGAL MAGIC ROOM LEARNER THAT ALSO LEARNS PROTECT — a claim about the fixture.'); process.exit(0); }

const FOE = POOL.filter(s => s.baseStats.spe > CARRIER.baseStats.spe
  && LEARNS(s, 'protect') && LEARNS(s, 'knockoff') && s.name !== CARRIER.name)
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe)[0];
if (!FOE) { console.log('  NO LEGAL FOE FASTER THAN THE CARRIER THAT LEARNS PROTECT AND KNOCK OFF — a claim about the fixture.'); process.exit(0); }

const FILLER = 'clefable';
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
console.log('  carrier : ' + CARRIER.name + ' base Speed ' + CARRIER.baseStats.spe
  + '   abilities ' + JSON.stringify(CARRIER.abilities) + '   control ability ' + CARRIER_OTHER);
console.log('  roomer  : ' + ROOMER.name + ' (Magic Room)');
console.log('  foe     : ' + FOE.name + ' base Speed ' + FOE.baseStats.spe
  + '  — faster than the carrier, and far below twice it, so ONE doubling flips the order');

/* ---- THE DRIVER --------------------------------------------------------------------------------- */
const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const bench = (...n) => n.map(x => mon(x, ['Protect']));

function playArm(tag, p1sheet, p2sheet, script) {
  const a = G.buildPair(p1sheet), b = G.buildPair(p2sheet);
  if (!a || !b) return { tag, err: 'COULD NOT BUILD THE PAIR' };
  const rows = [];
  const r = G.playGame(a, b, 'directed', 'roomunburden/' + tag, {
    script, arm: G.ARM_BY_ID.get('middle'),
    onBoundary: (snap, turnIdx, S, battle) => {
      const read = (mediSide, sdSide, label, sideId) => {
        const out = [];
        for (let i = 0; i < 2; i++) {
          const m = mediSide[i], p = sdSide.active[i];
          out.push({
            slot: label + (i === 0 ? 'a' : 'b'),
            name: m ? norm(m.name) : '?',
            sdName: p ? norm(p.species.id) : '?',
            /* THE SPEED THE TURN ORDER IS ACTUALLY SORTED ON, off each engine's own function —
             * never a stat read, and never one engine's number quoted for the other. */
            meSpe: m ? M.effSpeed(m, S.field, sideId) : null,
            sdSpe: p ? p.getActionSpeed() : null,
            meItem: m ? (m.item || '') : '',
            meParked: m ? (m._roomItem || '') : '',
            sdItem: p ? (p.item || '') : '',
            sdUnburden: p ? !!(p.volatiles && p.volatiles.unburden) : false,
            meHP: m ? Math.max(0, m.curHP) : -1,
            sdHP: p ? Math.max(0, p.hp) : -1,
          });
        }
        return out;
      };
      rows.push({ t: turnIdx, p1: read(S.actA, battle.p1, 'p1', 'A'), p2: read(S.actB, battle.p2, 'p2', 'B'),
                  room: (S.field.magicRoom | 0), sdRoom: !!battle.field.getPseudoWeather('magicroom'),
                  sdLog: battle.log.slice() });
    },
  });
  return { tag, rows, err: r.err, div: r.div || null, stateDiv: r.stateDiv || null, mediTrace: r.mediTrace || [] };
}

const ORDER = ls => ls.filter(l => /^\|move\|/.test(l)).map(l => l.split('|')[2] + ' ' + l.split('|')[3]);

function show(res) {
  if (res.err) console.log('    [game ended: ' + res.err + ']');
  if (!res.rows || !res.rows.length) { console.log('    NO BOUNDARY TAKEN'); return null; }
  for (const r of res.rows) {
    console.log('    --- boundary b' + r.t + '   magicRoom me=' + r.room + ' sd=' + r.sdRoom + ' ---');
    console.log('    slot  body            spe me/sd    item me(parked)/sd        sd unburden  hp me/sd');
    for (const x of [...r.p1, ...r.p2]) {
      console.log('    ' + x.slot.padEnd(5) + ' ' + (x.name + (x.name === x.sdName ? '' : '/' + x.sdName)).padEnd(15)
        + ' ' + String(x.meSpe).padEnd(4) + '/' + String(x.sdSpe).padEnd(7)
        + ' ' + (x.meItem + (x.meParked ? '(' + x.meParked + ')' : '')).padEnd(22) + '/' + String(x.sdItem).padEnd(12)
        + ' ' + String(x.sdUnburden).padEnd(11)
        + ' ' + x.meHP + '/' + x.sdHP
        + (x.meSpe !== x.sdSpe ? '   <-- SPEED DIFFERS' : ''));
    }
  }
  const last = res.rows[res.rows.length - 1];
  const sd = ORDER(last.sdLog), me = ORDER(res.mediTrace);
  console.log('    showdown  moves: ' + sd.join('   |   '));
  console.log('    medicham2 moves: ' + me.join('   |   '));
  /* THE VERDICT IS SPLIT IN TWO, BECAUSE THIS BOARD CARRIES TWO DEFECTS AND ONLY ONE OF THEM IS
   * UNDER TEST. `itemRoomHide` empties `m.item` into `_roomItem`, and `board_state.js` compares
   * `item` -- so EVERY Magic Room board parts on that leaf whatever Unburden does. Reporting one
   * number would let the residue mask the fix, or the fix take credit for the residue.
   *
   * `playGame` STOPS at the first divergent line, so two truncated streams can compare equal while
   * the game has already parted -- which is exactly what the first version of this probe reported.
   * The comparator's own verdict is used instead of a list diff. */
  const spd = res.rows.filter(r => [...r.p1, ...r.p2].some(x => x.meSpe !== x.sdSpe));
  const paths = res.stateDiv ? [...new Set(res.stateDiv.diffs.map(d => String(d.path).split('.').pop()))] : [];
  if (res.div) console.log('    SPLIT at index ' + res.div.index + ':  SD ' + res.div.sdRaw + '   <>   US ' + res.div.meRaw);
  if (res.stateDiv) console.log('    THE BOARD PARTED at turn ' + res.stateDiv.turn + ':  '
    + res.stateDiv.diffs.slice(0, 4).map(d => d.path + ' sd=' + JSON.stringify(d.showdown) + ' we=' + JSON.stringify(d.medicham)).join('   '));
  if (spd.length) console.log('    SPEED LEAF PARTS at boundary ' + spd.map(r => 'b' + r.t).join(', '));
  console.log('    VERDICT:  speed ' + (spd.length ? '*** PARTS ***' : 'AGREE')
    + '   protocol ' + (res.div ? '*** PARTS ***' : 'AGREE')
    + '   board leaves that part: ' + (paths.length ? paths.join(',') : 'none'));
  return { speed: !spd.length, protocol: !res.div, paths };
}

/* ---- THE ARMS -----------------------------------------------------------------------------------
 * Every arm is the SAME four bodies and the SAME turn-2 click. Only one thing varies per arm.
 *
 *   A  Magic Room up, carrier holds an item, carrier has Unburden      <- the defect
 *   B  CONTROL: identical, carrier's ability is its OTHER one          <- removes only Unburden
 *   C  CONTROL: identical, the roomer clicks Protect instead           <- removes only Magic Room
 *   D  POSITIVE: no Magic Room, the foe KNOCKS the item OFF on turn 1  <- Unburden really firing
 *
 * WHAT EACH ONE HAS TO SAY, AND WHY NONE OF THEM IS REDUNDANT:
 *   A's SPEED leaf must agree with B's. Before the fix A read 344 against the authority's 172 and B
 *   read 172 -- one board, one varied ability, two answers, so the parting is Unburden and not the
 *   room. C proves the same body with no room agrees, so it is not the ability alone. D proves the
 *   doubling still FIRES on a real loss, so a fix that simply deleted Unburden fails it.
 *   The `item` board leaf parts in A and B alike and is DECLARED RESIDUE -- see effSpeed's header.
 */
const ITEM = 'Focus Sash';
const sheets = (ability) => [
  [mon(CARRIER.name, ['Close Combat', 'Protect'], ITEM, ability), mon(ROOMER.name, ['Magic Room', 'Protect'])]
    .concat(bench(FILLER, 'milotic')),
  [mon(FOE.name, ['Knock Off', 'Protect']), mon(FILLER, ['Protect'])].concat(bench('milotic', 'corviknight')),
];

const T1_ROOM = { p1: [{ m: 'protect' }, { m: 'magicroom' }], p2: [{ m: 'protect' }, { m: 'protect' }] };
const T1_NOROOM = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };
const T1_KNOCK = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'knockoff', t: 0 }, { m: 'protect' }] };
/* TURN 2 IS THE MEASUREMENT: both fast bodies click a damaging move, so the `|move|` order IS the
 * Speed comparison. The carrier does NOT Protect here -- a shield would resolve at +4 and hide the
 * very thing being asked. */
const T2 = { p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'knockoff', t: 0 }, { m: 'protect' }] };

function runArm(label, ability, t1) {
  console.log('\n  ' + label);
  const [p1, p2] = sheets(ability);
  const res = playArm(label.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), p1, p2, [t1, T2]);
  return show(res);
}

const A = runArm('A   MAGIC ROOM + the item + Unburden      — THE ARM UNDER TEST', 'Unburden', T1_ROOM);
const B = runArm('B   CONTROL: the same board, ability ' + CARRIER_OTHER, CARRIER_OTHER, T1_ROOM);
const C = runArm('C   CONTROL: the same board, NO Magic Room', 'Unburden', T1_NOROOM);
const Dp = runArm('D   POSITIVE: no Magic Room, the item is KNOCKED OFF on turn 1', 'Unburden', T1_KNOCK);

const row = (n, v) => '  ' + n.padEnd(38) + ' speed ' + (v && v.speed ? 'AGREE' : 'PARTS')
  + '   protocol ' + (v && v.protocol ? 'AGREE' : 'PARTS')
  + '   board leaves: ' + (v && v.paths.length ? v.paths.join(',') : 'none');
console.log('\n  === WHAT THE FOUR ARMS SAID ===');
console.log(row('A  magic room + the item + unburden', A));
console.log(row('B  CONTROL, ability ' + CARRIER_OTHER, B));
console.log(row('C  CONTROL, no magic room', C));
console.log(row('D  POSITIVE, the item is knocked off', Dp));
console.log('\n  THE QUESTION UNDER TEST is A\'s SPEED column. It must read AGREE, and it must read the');
console.log('  same as B\'s -- one board, one varied ability, one answer. The `item` board leaf parts in');
console.log('  A and B alike and is declared residue (docs/ENGINE.md, "Magic Room parks the item").');
console.log('\n  Nothing above is asserted. tests/test-mechanics.js is what asserts.\n');
