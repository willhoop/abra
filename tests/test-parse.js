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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
