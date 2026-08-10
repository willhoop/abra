/* ABRA — replay parse tests.  Run: node tests/test-parse.js
 * Feeds a hand-written Showdown log to the shipped extractor and checks every
 * field. Expected values are derived by hand from the log below, not captured. */
const { extract } = require('../engine/durable-ingest.js');

const LOG = [
  '|player|p1|willhoop|crasherwake|1269',
  '|player|p2|pcrlbot99|170|1300',
  '|poke|p1|Pelipper, L50, M|',
  '|poke|p1|Swampert, L50, M|',
  '|poke|p1|Sneasler, L50, M|',
  '|poke|p1|Meowscarada, L50, F|',
  '|poke|p2|Garchomp, L50, M|',
  '|poke|p2|Gholdengo, L50|',
  '|poke|p2|Sinistcha, L50|',
  '|poke|p2|Kingambit, L50, M|',
  '|teampreview|4',
  '|start',
  '|switch|p1a: Pelipper|Pelipper, L50, M|100/100',
  '|switch|p1b: Swampert|Swampert, L50, M|100/100',
  '|switch|p2a: Garchomp|Garchomp, L50, M|100/100',
  '|switch|p2b: Gholdengo|Gholdengo, L50|100/100',
  '|move|p2a: Garchomp|Earthquake|p1a: Pelipper',
  '|-item|p2a: Garchomp|Life Orb|[from] ability: Frisk',
  '|-ability|p2b: Gholdengo|Good as Gold',
  '|switch|p1b: Sneasler|Sneasler, L50, M|100/100',
  '|win|willhoop',
].join('\n');

let pass = 0, fail = 0;
const chk = (c, m) => { if (c) { pass++; console.log('pass  ' + m); } else { fail++; console.log('FAIL  ' + m); } };

const r = extract('testid', 1784521471, LOG);

chk(r.p1.name === 'willhoop' && r.p1.rating === 1269 && r.p1.bot === false, 'p1 name/rating/human');
chk(r.p2.name === 'pcrlbot99' && r.p2.rating === 1300 && r.p2.bot === true, 'p2 name/rating/bot flagged');
chk(r.winner === 'willhoop', 'winner parsed');
chk(r.six.p1.join(',') === 'pelipper,swampert,sneasler,meowscarada', 'p1 six correct');
chk(r.six.p2.join(',') === 'garchomp,gholdengo,sinistcha,kingambit', 'p2 six correct');
chk(r.lead.p1.join(',') === 'pelipper,swampert', 'p1 leads = first two sent out');
chk(r.lead.p2.join(',') === 'garchomp,gholdengo', 'p2 leads correct');
chk(r.brought.p1.includes('sneasler'), 'p1 brought includes the back switch-in');
chk(r.sets.garchomp && r.sets.garchomp.moves.includes('Earthquake'), 'observed move recorded');
chk(r.sets.garchomp.item === 'Life Orb', 'observed item recorded');
chk(r.sets.gholdengo.ability === 'Good as Gold', 'observed ability recorded');
chk(r.date === '2026-07-20 04:24', 'uploadtime -> date');

/* ============================================================================================
 * ROADMAP #134 — THE FOUR FACTS THE PARSER REACHED AND THREW AWAY, PLUS THE FIFTH.
 *
 * Everything below is ADDITIVE. The block above pins the shape 52,089 stored games already
 * have and must keep passing unchanged; this block pins the facts that were on the wire and
 * were dropped. Written RED first against the shipped parser (2026-08-10): 0 of these passed.
 *
 * The log is hand-written from real shapes taken out of data/games.ladder.raw-logs.jsonl, so
 * the awkward cases are the ones the corpus actually contains — `-hitcount` after a faint
 * losing its slot letter, `-enditem` carrying `[eat]` / `[from] move: Knock Off|[of] pNx`,
 * a spread move naming ONE target and damaging two.
 * ========================================================================================= */
const LOG2 = [
  '|player|p1|alpha|1|1500',
  '|player|p2|beta|2|1500',
  '|poke|p1|Kingambit, L50, M|',
  '|poke|p1|Incineroar, L50, M|',
  '|poke|p1|Basculegion, L50, M|',
  '|poke|p1|Whimsicott, L50, F|',
  '|poke|p2|Charizard, L50, M|',
  '|poke|p2|Tyranitar, L50, M|',
  '|poke|p2|Sylveon, L50, F|',
  '|poke|p2|Garchomp, L50, M|',
  '|teampreview|4',
  '|start',
  // ---- everything here is BEFORE |turn|1 and used to be dropped entirely ----
  '|switch|p1a: Kingambit|Kingambit, L50, M|100/100',
  '|switch|p1b: Incineroar|Incineroar, L50, M|100/100',
  '|switch|p2a: Charizard|Charizard, L50, M|100/100',
  '|switch|p2b: Tyranitar|Tyranitar, L50, M|100/100',
  '|-weather|Sandstorm|[from] ability: Sand Stream|[of] p2b: Tyranitar',
  '|-ability|p1b: Incineroar|Intimidate|boost',
  '|-unboost|p2a: Charizard|atk|1',
  '|turn|1',
  // ---- a SPREAD move: one |move| line, two damaged bodies ----
  '|move|p2a: Charizard|Heat Wave|p1b: Incineroar|[spread] p1a,p1b',
  '|-supereffective|p1a: Kingambit|1',
  '|-enditem|p1a: Kingambit|Focus Sash',
  '|-damage|p1a: Kingambit|1/100',
  '|-damage|p1b: Incineroar|65/100',
  '|-status|p1a: Kingambit|brn',
  '|-damage|p2a: Charizard|90/100|[from] item: Life Orb',
  '|move|p1b: Incineroar|Fake Out|p2b: Tyranitar',
  '|-damage|p2b: Tyranitar|88/100',
  '|cant|p2b: Tyranitar|flinch',
  '|-status|p2a: Charizard|slp|[from] move: Sleep Powder',
  '|move|p1a: Kingambit|Knock Off|p2b: Tyranitar',
  '|-damage|p2b: Tyranitar|70/100',
  '|-enditem|p2b: Tyranitar|Sitrus Berry|[from] move: Knock Off|[of] p1a: Kingambit',
  '|-damage|p1a: Kingambit|0 fnt|[from] brn',
  '|faint|p1a: Kingambit',
  '|turn|2',
  // ---- a MULTI-HIT move: three damage lines, one |-hitcount| ----
  '|move|p2b: Tyranitar|Icicle Spear|p1b: Incineroar',
  '|-damage|p1b: Incineroar|50/100',
  '|-damage|p1b: Incineroar|35/100',
  '|-damage|p1b: Incineroar|20/100',
  '|-hitcount|p1b: Incineroar|3',
  '|-enditem|p1b: Incineroar|Sitrus Berry|[eat]',
  '|-heal|p1b: Incineroar|45/100|[from] item: Sitrus Berry',
  '|move|p2a: Charizard|Heat Wave|p1b: Incineroar|[spread] p1b',
  '|-damage|p1b: Incineroar|0 fnt',
  '|faint|p1b: Incineroar',
  '|-hitcount|p1: Incineroar|1',
  '|-weather|Sandstorm|[upkeep]',
  '|-damage|p2a: Charizard|84/100|[from] Sandstorm',
  '|upkeep',
  '|win|beta',
].join('\n');

const r2 = extract('testid2', 1784521471, LOG2);
const T1 = (r2.turns[0] || { ev: [] }).ev, T2 = (r2.turns[1] || { ev: [] }).ev;
const first = (ev, f) => ev.find(f) || {};
const heatwave1 = first(T1, e => e.t === 'm' && e.mv === 'Heat Wave');
const icicle = first(T2, e => e.t === 'm' && e.mv === 'Icicle Spear');
const heatwave2 = first(T2, e => e.t === 'm' && e.mv === 'Heat Wave');

// ---- the invariants the 52,089 stored games rest on: NOTHING here may move ----
chk(r2.turns.length === 2 && r2.turns[0].n === 1 && r2.turns[1].n === 2, 'turns still start at turn 1');
chk(heatwave1.dmg === 99, 'LEGACY UNCHANGED: spread dmg is still max(delta)');
chk(heatwave1.tgt === 'incineroar', 'LEGACY UNCHANGED: tgt is still the first target named');
chk(heatwave1.tgthp === 65, 'LEGACY UNCHANGED: tgthp is still the last target hit');
chk(icicle.dmg === 15, 'LEGACY UNCHANGED: multi-hit dmg is still max of one hit');
chk(heatwave2.ko === true, 'LEGACY UNCHANGED: ko still set on the move');

// ---- FACT 1: |-hitcount| ----
chk(icicle.hitcount === 3, 'FACT 1  hitcount recorded on the move');
chk(icicle.tgts && icicle.tgts[0] && icicle.tgts[0].hitcount === 3, 'FACT 1  hitcount reaches the target row');
chk(heatwave2.hitcount === 1, 'FACT 1  hitcount after a faint (slot letter dropped) still lands');

// ---- FACT 2: |cant| ----
const cant = first(T1, e => e.t === 'c');
chk(cant.s === 'p2b' && cant.mon === 'tyranitar' && cant.why === 'flinch',
  'FACT 2  cant/flinch is an event, not an absence');

// ---- FACT 3: the [from] clause on chip damage ----
const orb = T1.find(e => e.t === 'hp' && e.s === 'p2a');
const brn = T1.find(e => e.t === 'hp' && e.s === 'p1a' && e.hp === 0);
const sand = T2.find(e => e.t === 'hp' && e.s === 'p2a');
const sitrus = T2.find(e => e.t === 'hp' && e.s === 'p1b' && e.hp === 45);
chk(orb && orb.from === 'item: Life Orb' && orb.dmg === 10, 'FACT 3  Life Orb chip names itself');
chk(brn && brn.from === 'brn', 'FACT 3  burn chip that KOs names itself');
chk(sand && sand.from === 'Sandstorm', 'FACT 3  sandstorm chip names itself');
chk(sitrus && sitrus.from === 'item: Sitrus Berry' && sitrus.heal === 1, 'FACT 3  a heal names its source');
const PRE = r2.preTurn || [];
const slp = first(T1, e => e.t === 'x' && e.st === 'slp');
const brnStatus = first(T1, e => e.t === 'x' && e.st === 'brn');
chk(slp.from === 'move: Sleep Powder', 'FACT 3  a status names the move that applied it');
chk(brnStatus.s === 'p1a' && brnStatus.from === null,
  'FACT 3  a status with no [from] reads null — the move that just resolved carried it');
const wof = PRE.find(e => e.t === 'w');
chk(wof && wof.by === 'Sand Stream', 'FACT 3  [of] survives on the weather event');

// ---- FACT 4: |-enditem| as a turn event ----
const sash = first(T1, e => e.t === 'ei' && e.item === 'Focus Sash');
const knock = first(T1, e => e.t === 'ei' && e.item === 'Sitrus Berry');
const eaten = first(T2, e => e.t === 'ei');
chk(sash.s === 'p1a' && sash.mon === 'kingambit', 'FACT 4  the Sash triggered THIS turn');
chk(knock.from === 'move: Knock Off' && knock.of === 'p1a', 'FACT 4  a knocked item names the thief');
chk(eaten.item === 'Sitrus Berry' && eaten.why === 'eat', 'FACT 4  a berry eaten is distinguishable');

// ---- FACT 5: a spread move damaged TWO bodies and the store kept one ----
chk(heatwave1.spread && heatwave1.spread.join(',') === 'p1a,p1b', 'FACT 5  the spread target list is kept');
chk(heatwave1.tgts && heatwave1.tgts.length === 2, 'FACT 5  both bodies have a row');
const kg = (heatwave1.tgts || []).find(x => x.s === 'p1a') || {};
const inc = (heatwave1.tgts || []).find(x => x.s === 'p1b') || {};
chk(kg.mon === 'kingambit' && kg.dmg === 99 && kg.hp === 1, 'FACT 5  target A: its own damage, its own hp');
chk(inc.mon === 'incineroar' && inc.dmg === 35 && inc.hp === 65, 'FACT 5  target B: its own damage, its own hp');
const ice0 = (icicle.tgts || [{}])[0];
chk(ice0.dmg === 45 && ice0.hp === 20 && ice0.n === 3,
  'FACT 5  multi-hit damage sums to the whole attack');
chk((heatwave2.tgts || [{}])[0].ko === true, 'FACT 5  a KO is recorded per target');

// ---- everything before |turn|1 ----
chk(Array.isArray(r2.preTurn) && PRE.length > 0, 'PRE-TURN  the entry phase is no longer dropped');
chk(PRE.some(e => e.t === 'w' && e.field === 'Sandstorm'), 'PRE-TURN  a lead\'s entry weather survives');
chk(PRE.filter(e => e.t === 's').length === 4, 'PRE-TURN  all four lead switch-ins are there');
chk(PRE.some(e => e.t === 'b' && e.s === 'p2a' && e.b.atk === -1), 'PRE-TURN  the Intimidate drop survives');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
