/* RAW-STORE-NOT-READ: the fixture log is hand-written from protocol SHAPES taken out of the raw-logs file; this test opens no store.
 * ABRA — replay parse tests.  Run: node tests/test-parse.js
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

/* ============================================================================================
 * abra/regmc 1.52.0 — WHOSE SET A LINE REVEALS. One pinned case per cause that
 * engine/store_sets_check.js found, measured against solver/porygon2/v2/reveal.js on a 1-in-10
 * sample of the Reg M-C bo1 store (docs/_reports/2026-10-01-store-set-attribution.md). The line
 * that carries each cause is copied from a real Reg M-C replay (the report names it); the lines
 * around it are hand-written in the same protocol shapes. Each case was shown RED with its own fix
 * reverted and GREEN with it in place (the report lists the break and what went red).
 * ========================================================================================= */
const mk = (p1, p2, body) => ['|player|p1|alpha||1500', '|player|p2|beta||1500',
  ...p1.map(s => `|poke|p1|${s}, L50|`), ...p2.map(s => `|poke|p2|${s}, L50|`),
  '|teampreview|4', '|start', ...body, '|win|alpha'].join('\n');
const sw = (slot, nick, sp) => `|switch|${slot}: ${nick}|${sp || nick}, L50|100/100`;
const S = (log) => extract('t', 1784521471, log);
const mv = (r, k) => ((r.sets[k] || {}).moves || []);

// CAUSE 1 — `|cant|` names the refused move, and an ability that refused it
{ const r = S(mk(['Emboar', 'Incineroar', 'Gengar', 'Clefable'], ['Farigiraf', 'Gengar', 'Garchomp', 'Lucario'], [
    sw('p1a', 'Super', 'Emboar'), sw('p1b', 'Incineroar'), sw('p2a', 'Farigiraf'), sw('p2b', 'Garchomp'), '|turn|1',
    '|cant|p1a: Super|move: Heal Block|Drain Punch',
    '|cant|p2a: Farigiraf|ability: Armor Tail|Fake Out|[of] p1b: Incineroar']));
  chk(mv(r, 'emboar').includes('Drain Punch'), 'CAUSE 1  a move named in |cant| is the mover\'s move');
  chk(mv(r, 'incineroar').includes('Fake Out') && !mv(r, 'farigiraf').includes('Fake Out'), 'CAUSE 1  a refused move is the [of] USER\'s, not the holder\'s');
  chk(r.sets.farigiraf.ability === 'Armor Tail', 'CAUSE 1  the ability that refused it is the holder\'s'); }

// CAUSE 2 — a called move (Magic Bounce) and Struggle are not moves of the set
{ const r = S(mk(['Clefable', 'Gengar', 'Garchomp', 'Lucario'], ['Gengar', 'Incineroar', 'Farigiraf', 'Garchomp'], [
    sw('p1a', 'Clefable'), sw('p2b', 'Gengar'), '|turn|1',
    '|move|p2b: Gengar|Disable|p1a: Clefable',
    '|move|p1a: Clefable|Disable|p2b: Gengar|[from] ability: Magic Bounce',
    '|move|p1a: Clefable|Moonblast|p2b: Gengar', '|move|p2b: Gengar|Struggle|p1a: Clefable']));
  chk(!mv(r, 'clefable').includes('Disable') && mv(r, 'clefable').includes('Moonblast'), 'CAUSE 2  a bounced move is not the bouncer\'s');
  chk(r.sets.clefable.ability === 'Magic Bounce', 'CAUSE 8  a bounce names the bouncer\'s ability');
  chk(!mv(r, 'gengar').includes('Struggle'), 'CAUSE 2  Struggle is no move of any set'); }

// CAUSE 3 — a transformed body plays its copy's moves
{ const r = S(mk(['Ditto', 'Farigiraf', 'Garchomp', 'Gengar'], ['Lucario', 'Incineroar', 'Farigiraf', 'Garchomp'], [
    sw('p1b', 'Ditto'), sw('p2a', 'Lucario'), '|-transform|p1b: Ditto|p2a: Lucario|[from] ability: Imposter', '|turn|1',
    '|move|p1b: Ditto|Aura Sphere|p2a: Lucario']));
  chk(!mv(r, 'ditto').includes('Aura Sphere'), 'CAUSE 3  a transformed body\'s move is not its own');
  chk(r.sets.ditto.ability === 'Imposter', 'CAUSE 8  a transform names Imposter as the Ditto\'s'); }

// CAUSE 4 — an item handed over by Trick is not the item brought
{ const r = S(mk(['Grimmsnarl', 'Gengar', 'Garchomp', 'Lucario'], ['Garchomp', 'Incineroar', 'Farigiraf', 'Gengar'], [
    sw('p1b', 'Grimmsnarl'), sw('p2a', 'Garchomp'), '|turn|1',
    '|move|p1b: Grimmsnarl|Trick|p2a: Garchomp', '|-activate|p1b: Grimmsnarl|move: Trick|[of] p2a: Garchomp',
    '|-item|p2a: Garchomp|Iron Ball|[from] move: Trick', '|-item|p1b: Grimmsnarl|Choice Scarf|[from] move: Trick',
    '|-enditem|p1b: Grimmsnarl|Choice Scarf|[from] move: Knock Off|[of] p2a: Garchomp']));
  chk(r.sets.grimmsnarl.item === null && r.sets.garchomp.item === null, 'CAUSE 4  a Tricked item is credited to neither receiver'); }

// CAUSE 5 — a replaced ability (Trace, Entrainment, Skill Swap) is not the body's own
{ const r = S(mk(['Gardevoir', 'Meowstic', 'Garchomp', 'Swampert'], ['Incineroar', 'Salamence', 'Araquanid', 'Lucario'], [
    sw('p2a', 'Incineroar'), sw('p2b', 'Salamence'), sw('p1a', 'Gardevoir'), sw('p1b', 'Meowstic'),
    '|-ability|p1a: Gardevoir|Intimidate|Trace|[from] ability: Trace|[of] p2a: Incineroar',
    '|-ability|p1a: Gardevoir|Intimidate|boost', '|turn|1',
    '|move|p1b: Meowstic|Skill Swap|p2b: Salamence',
    '|-activate|p1b: Meowstic|Skill Swap|Intimidate|Prankster|[of] p2b: Salamence',
    '|-ability|p1b: Meowstic|Intimidate|boost',
    sw('p1b', 'Swampert'), sw('p2b', 'Araquanid'),
    '|move|p2b: Araquanid|Entrainment|p1b: Swampert',
    '|-ability|p1b: Swampert|Water Bubble|Swift Swim|[from] move: Entrainment|[of] p2b: Araquanid']));
  chk(r.sets.gardevoir.ability === 'Trace', 'CAUSE 5  a tracer\'s own ability is Trace, not the copy');
  chk(r.sets.incineroar.ability === 'Intimidate', 'CAUSE 5  the traced ability is the [of] body\'s');
  chk(r.sets.meowstic.ability === null, 'CAUSE 5  an ability received by Skill Swap is not the receiver\'s');
  chk(r.sets.swampert.ability === 'Swift Swim' && r.sets.araquanid.ability === 'Water Bubble', 'CAUSE 5  Entrainment: OLD is the target\'s, NEW the user\'s'); }

// CAUSE 6 — Ally Switch moves both bodies; a slot-keyed line follows them
{ const r = S(mk(['Garchomp', 'Incineroar', 'Gengar', 'Lucario'], ['Farigiraf', 'Annihilape', 'Gengar', 'Garchomp'], [
    sw('p1a', 'Garchomp'), sw('p1b', 'Incineroar'), sw('p2a', 'Farigiraf'), sw('p2b', 'Annihilape'), '|turn|1',
    '|move|p2a: Farigiraf|Ally Switch|p2a: Farigiraf', '|swap|p2a: Farigiraf|1|[from] move: Ally Switch',
    '|move|p1a: Garchomp|Dragon Claw|p2b: Farigiraf', '|-damage|p2b: Farigiraf|60/100',
    '|-enditem|p2b: Farigiraf|Colbur Berry|[eat]']));
  chk(r.sets.farigiraf.item === 'Colbur Berry' && r.sets.annihilape.item === null, 'CAUSE 6  an item after Ally Switch is the mover\'s');
  const dc = (r.turns[0].ev || []).find(e => e.t === 'm' && e.mv === 'Dragon Claw') || {};
  chk(dc.tgt === 'farigiraf', 'CAUSE 6  a move after Ally Switch targets the body now in the slot'); }

// CAUSE 7 — an item that only shows itself on another line (Life Orb, Leftovers)
{ const r = S(mk(['Gholdengo', 'Garchomp', 'Gengar', 'Lucario'], ['Incineroar', 'Farigiraf', 'Gengar', 'Garchomp'], [
    sw('p1b', 'Gholdengo'), sw('p2a', 'Incineroar'), '|turn|1',
    '|-damage|p1b: Gholdengo|90/100|[from] item: Life Orb', '|-heal|p2a: Incineroar|56/100|[from] item: Leftovers']));
  chk(r.sets.gholdengo.item === 'Life Orb', 'CAUSE 7  Life Orb named by its recoil');
  chk(r.sets.incineroar.item === 'Leftovers', 'CAUSE 7  Leftovers named by its heal'); }

// CAUSE 8 — an ability that only shows itself on another line, and whose it is
{ const r = S(mk(['Garchomp', 'Pawmot', 'Sinistcha', 'Runerigus'], ['Incineroar', 'Gholdengo', 'Gengar', 'Lucario'], [
    sw('p1a', 'RuneriGoat', 'Runerigus'), sw('p1b', 'Garchomp'), sw('p2a', 'Incineroar'), sw('p2b', 'Golden Gate', 'Gholdengo'), '|turn|1',
    '|-damage|p2a: Incineroar|87/100|[from] ability: Rough Skin|[of] p1b: Garchomp',
    sw('p1b', 'Sinistcha'), '|-heal|p1a: RuneriGoat|41/100|[from] ability: Hospitality|[of] p1b: Sinistcha',
    sw('p1b', 'Pawmot'), '|move|p2b: Golden Gate|Thunderbolt|p1b: Pawmot',
    '|-heal|p1b: Pawmot|74/100|[from] ability: Volt Absorb|[of] p2b: Golden Gate']));
  chk(r.sets.garchomp.ability === 'Rough Skin' && r.sets.incineroar.ability === null, 'CAUSE 8  Rough Skin is the [of] body\'s');
  chk(r.sets.sinistcha.ability === 'Hospitality' && r.sets.runerigus.ability === null, 'CAUSE 8  Hospitality is the ally source\'s');
  chk(r.sets.pawmot.ability === 'Volt Absorb' && r.sets.gholdengo.ability === null, 'CAUSE 8  an absorb heal is the healed body\'s'); }

// CAUSE 9 — a species on both sides is two Pokemon
{ const r = S(mk(['Incineroar', 'Garchomp', 'Gengar', 'Lucario'], ['Incineroar', 'Farigiraf', 'Gengar', 'Garchomp'], [
    sw('p1a', 'Incineroar'), sw('p2a', 'Incineroar'), '|turn|1',
    '|move|p1a: Incineroar|Fake Out|p2a: Incineroar', '|move|p2a: Incineroar|Parting Shot|p1a: Incineroar',
    '|-enditem|p1a: Incineroar|Sitrus Berry|[eat]']));
  const ms = (r.mirrorSets || {}).incineroar || {};
  chk(r.sets.incineroar.mirror === true, 'CAUSE 9  a mirrored entry says it is one');
  chk(ms.p1 && ms.p2 && ms.p1.moves.join() === 'Fake Out' && ms.p2.moves.join() === 'Parting Shot', 'CAUSE 9  each side keeps its own moves');
  chk(ms.p1 && ms.p2 && ms.p1.item === 'Sitrus Berry' && ms.p2.item === null, 'CAUSE 9  each side keeps its own item');
  const sheet = (mons) => mons.map(([sp, mvs]) => `${sp}||Sitrus Berry|Intimidate|${mvs}|Adamant||M|||50|`).join(']');
  const b = S(mk(['Incineroar', 'Garchomp', 'Gengar', 'Lucario'], ['Incineroar', 'Farigiraf', 'Gengar', 'Garchomp'], [
    '|showteam|p1|' + sheet([['Incineroar', 'FakeOut,KnockOff,PartingShot,FlareBlitz']]),
    '|showteam|p2|' + sheet([['Incineroar', 'FakeOut,Protect,Taunt,FlareBlitz']])]));
  const bm = (b.mirrorSets || {}).incineroar || {};
  chk(bm.p1 && bm.p2 && bm.p1.moves.length === 4 && bm.p2.moves.length === 4 && bm.p2.moves.indexOf('KnockOff') < 0,
    'CAUSE 9  two open sheets of one species stay two sets of four'); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
