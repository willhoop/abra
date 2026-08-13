/* THE RESIDUAL ORDER, OBSERVED FROM A REAL SHOWDOWN BATTLE RATHER THAN READ OUT OF ITS SOURCE.
 *
 * Will, 2026-08-12: *"i think sandstorm hits before leftovers but i dont check that too often, were
 * gonna need to validate against showdown or find an external confirmation"*.
 *
 * He is right on both counts. `data/residual-order.json` is DERIVED — it reads `onResidualOrder` off
 * the format — and a derivation is only as good as my reading of which field the authority consults.
 * That table has already been wrong once tonight: its first cut walked `move.condition` and so missed
 * every weather, including the sandstorm chip, which is the largest end-of-turn damage source in the
 * format. It was published as authoritative while missing the effect Will asked about.
 *
 * THE STRONGEST AVAILABLE CONFIRMATION IS NOT AN EXTERNAL DOCUMENT. It is making the real simulator
 * do it and reading what comes out. A wiki can be stale and a forum post can be about another
 * generation; `battle.log` is the authority behaving. So this file stages ONE turn with as many
 * residual families live at once as it can arrange, and reads the ORDER OF THE EMITTED LINES.
 *
 * WHAT IT COMPARES. The observed sequence of `[from]` tags against the sequence the derived table
 * predicts. A disagreement means the TABLE is wrong — not the engine, which is not consulted here at
 * all. That separation is the point: this file can fail without medicham2 being involved, so a red
 * here is never ambiguous about which of the two is at fault.
 *
 * IT DOES NOT ASSERT A HAND-WRITTEN SEQUENCE. Writing "sandstorm, then Leftovers, then poison" here
 * would be the fourth place in this repo where an order is typed from memory, and it would agree with
 * the table by construction on the day it was written and drift silently afterwards.
 *
 *   SHOWDOWN_PATH=... node tests/test-residual-order-observed.js
 *   SHOWDOWN_PATH=... node tests/test-residual-order-observed.js --verbose   # the whole turn's log
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const SHOWDOWN = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const { Battle, Teams, Dex } = require(path.join(SHOWDOWN, 'dist', 'sim'));
const FORMAT = 'gen9championsvgc2026regmb';
const DEX = Dex.forFormat(FORMAT);
const VERBOSE = process.argv.includes('--verbose');

let fails = 0, checks = 0;
const ok = (cond, label, extra) => {
  checks++;
  if (cond) { console.log('  ok    ' + label + (extra ? '   (' + extra + ')' : '')); return true; }
  fails++; console.log('  FAIL  ' + label + (extra ? '   (' + extra + ')' : '')); return false;
};

/* ---- 1. the fixture, DERIVED. Every body is searched for in the legal species list ---------------
 * CLAUDE.md: a fixture named after a body this format does not contain makes the whole result
 * unusable, and `.all()` is the National Dex until it is filtered. */
const legal = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const species = DEX.species.all().filter(legal);
const pick = (pred, why) => {
  const s = species.find(pred);
  if (!s) throw new Error('COULD NOT STAGE: no legal species satisfies ' + why
    + '. That is a claim about the fixture, never about the mechanic.');
  return s;
};
/* A body that TAKES the sandstorm chip must not be Rock, Ground or Steel, and must not carry an
 * ability that refuses it — otherwise the most important line in this test silently never appears. */
const chipable = s => !s.types.some(t => t === 'Rock' || t === 'Ground' || t === 'Steel')
                   && !Object.values(s.abilities).some(a => /Magic Guard|Sand Veil|Sand Rush|Sand Force|Overcoat/i.test(a));
const A1 = pick(s => chipable(s) && s.baseStats.hp >= 70, 'a sandstorm-chippable body with some bulk');
const A2 = pick(s => chipable(s) && s.name !== A1.name, 'a second sandstorm-chippable body');
const B1 = pick(s => chipable(s) && ![A1.name, A2.name].includes(s.name), 'a third');
const B2 = pick(s => chipable(s) && ![A1.name, A2.name, B1.name].includes(s.name), 'a fourth');

/* the ability each body actually gets — slot 0, and NEVER one that would refuse the chip */
const ab = s => Object.values(s.abilities).find(a => !/Magic Guard|Overcoat|Sand/i.test(a)) || s.abilities[0];
const set = (s, item, extra) => Object.assign({
  name: s.name, species: s.name, item: item || '', ability: ab(s), gender: 'N',
  moves: ['Protect'], evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
}, extra || {});

/* p1a holds Leftovers and will be poisoned; p1b holds nothing and will be burned; both take sand. */
const teamA = [set(A1, 'Leftovers'), set(A2, '')];
const teamB = [set(B1, ''), set(B2, '')];

const battle = new Battle({ formatid: FORMAT, seed: [1, 2, 3, 4] });
battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
if (battle.requestState === 'teampreview') {
  battle.choose('p1', 'team 1, 2');
  battle.choose('p2', 'team 1, 2');
}

/* ---- 2. arrange the residual families directly on the battle state -------------------------------
 * Staged rather than played: clicking the moves would take turns, and every extra turn is another
 * chance for a faint to end the battle before the one turn this test needs. The state is set through
 * the authority's OWN methods, so nothing here invents a mechanic. */
const p1a = battle.p1.active[0], p1b = battle.p1.active[1];
const p2a = battle.p2.active[0];
const staged = [];
/* `setWeather` REFUSES WITHOUT A SOURCE — the authority will not let weather exist uncaused, and that
 * refusal is a fixture guard rather than an obstacle: weather with no setter is a state no real battle
 * reaches, so staging it would test a board that cannot occur. */
battle.field.setWeather('sandstorm', p2a);                  staged.push('sandstorm');
if (p1a.setStatus('psn'))       staged.push('psn on p1a');
if (p1b.setStatus('brn'))       staged.push('brn on p1b');
if (p2a.addVolatile('leechseed', p1a)) staged.push('leechseed on p2a');
if (p1a.addVolatile('aquaring')) staged.push('aquaring on p1a');

console.log('RESIDUAL ORDER — OBSERVED FROM A REAL SHOWDOWN BATTLE');
console.log('  format  : ' + FORMAT);
console.log('  bodies  : p1a ' + A1.name + ' (Leftovers), p1b ' + A2.name + ', p2a ' + B1.name + ', p2b ' + B2.name);
console.log('  staged  : ' + staged.join(', '));

/* ---- 3. play ONE turn where nothing happens but the residual ------------------------------------ */
const before = battle.log.length;
battle.choose('p1', 'move protect, move protect');
battle.choose('p2', 'move protect, move protect');
const turnLog = battle.log.slice(before);
if (VERBOSE) { console.log('\n  --- the whole turn ---'); turnLog.forEach(l => console.log('    ' + l)); }

/* ---- 4. what the authority emitted, in order ----------------------------------------------------
 * Read from the `[from]` tag, which is the authority naming its own cause — not inferred from the
 * event type, because `-damage` alone cannot tell sand from poison. */
const seen = [];
for (const line of turnLog) {
  const m = /\|\[from\]\s*(?:ability:|item:|move:)?\s*([A-Za-z ]+)/.exec(String(line));
  if (!m) continue;
  const id = m[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!id) continue;
  if (seen.length && seen[seen.length - 1].id === id) { seen[seen.length - 1].n++; continue; }
  seen.push({ id, n: 1, line: String(line) });
}
console.log('\n  OBSERVED, in the order Showdown emitted it:');
if (!seen.length) console.log('    (nothing carrying a [from] tag — the fixture staged nothing)');
seen.forEach((s, i) => console.log('    ' + (i + 1) + '. ' + s.id + (s.n > 1 ? '  x' + s.n : '')
  + '        ' + s.line.slice(0, 76)));

/* ---- 5. against the derived table --------------------------------------------------------------- */
const TABLE = require(D('data', 'residual-order.json'));
const orderOf = id => {
  const r = TABLE.rows.find(x => x.id === id)
         || TABLE.rows.find(x => x.id.replace(/[^a-z0-9]/g, '') === id)
         || TABLE.rows.find(x => x.name.toLowerCase().replace(/[^a-z0-9]/g, '') === id);
  return r ? r.order : null;
};
console.log('\n  AGAINST THE DERIVED TABLE:');
const placed = seen.map(s => ({ id: s.id, order: orderOf(s.id) }));
placed.forEach(p => console.log('    ' + p.id.padEnd(18)
  + (p.order == null ? 'NOT IN THE TABLE' : 'order ' + p.order)));

const known = placed.filter(p => p.order != null);
ok(known.length >= 2, 'at least two ordered effects were observed, so there is a sequence to check',
   known.length + ' of ' + placed.length + ' placed');

/* THE ACTUAL ASSERTION: the observed sequence must be non-decreasing in the table's order. */
let bad = null;
for (let i = 1; i < known.length; i++) {
  if (known[i].order < known[i - 1].order) { bad = known[i - 1].id + ' (order ' + known[i - 1].order
    + ') was emitted BEFORE ' + known[i].id + ' (order ' + known[i].order + ')'; break; }
}
ok(!bad, 'the observed sequence agrees with the derived order', bad || 'monotonic');

/* And the specific pair Will asked about, checked by name so a reader can see it was answered. */
const iSand = known.findIndex(p => /sandstorm/.test(p.id));
const iLeft = known.findIndex(p => /leftovers/.test(p.id));
if (iSand >= 0 && iLeft >= 0) {
  ok(iSand < iLeft, 'SANDSTORM IS EMITTED BEFORE LEFTOVERS — Will\'s call, confirmed by the authority',
     'sand at position ' + (iSand + 1) + ', Leftovers at ' + (iLeft + 1));
} else {
  console.log('  note  the sand/Leftovers pair was not both observed this run '
    + '(sand ' + (iSand >= 0) + ', leftovers ' + (iLeft >= 0) + ') — NOT a pass, just not staged');
}

console.log('\n' + (fails ? 'FAILED: ' + fails + ' of ' + checks
  : 'ALL GREEN — ' + checks + ' checks. The derived table matches what the real simulator emits.'));
process.exitCode = fails ? 1 : 0;
