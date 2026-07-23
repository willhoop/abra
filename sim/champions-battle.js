/* ABRA engine adapter — run REAL Champions battles in the open-source Showdown sim.
 * This is the concrete start of wiring the (now-confirmed OPEN) engine into ABRA.
 * It plays a full [Gen 9 Champions] VGC 2026 Reg M-B battle between two agent
 * functions and returns the winner + protocol log. Two agents = self-play.
 *
 * Requires the sim:  npm install pokemon-showdown   (in this sim/ folder)
 * Then:  node sim/selfplay.js
 *
 * playBattle(team1, team2, agent1, agent2, opts) -> {winner, turns, log}
 *   team*  : packed team string, or an array of set objects (Teams.pack handles both)
 *   agent* : (request, side) => choiceString   e.g. ">p1 default" or ">p1 move 1, move 1"
 */
let PS;
try { PS = require('pokemon-showdown'); }
catch (e) { PS = null; }

async function playBattle(team1, team2, agent1, agent2, opts = {}) {
  if (!PS) throw new Error("pokemon-showdown not installed. Run:  cd sim && npm install pokemon-showdown");
  const { BattleStream, getPlayerStreams, Teams } = PS;
  const format = opts.format || 'gen9championsvgc2026regmb';
  const pack = t => (typeof t === 'string' ? t : Teams.pack(t));

  const battleStream = new BattleStream();
  const streams = getPlayerStreams(battleStream);
  const log = []; let winner = null;

  // read the omniscient stream for the result + full log
  (async () => {
    for await (const chunk of streams.omniscient) {
      for (const line of chunk.split('\n')) {
        log.push(line);
        if (line.startsWith('|win|')) winner = line.slice(5).trim();
        if (line.startsWith('|tie')) winner = 'tie';
      }
    }
  })();

  // each player: read requests, ask its agent for a choice, write it back.
  // Loop protection: if the SAME request comes back (our last choice was rejected
  // as illegal), fall back to `default` so a buggy agent can never hang the battle.
  async function drive(who, agent) {
    const s = streams[who];
    let lastReq = null, retried = false;
    for await (const chunk of s) {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('|request|')) continue;
        const raw = line.slice(9) || '{}';
        const req = JSON.parse(raw);
        if (req.wait) continue;                 // waiting on the opponent
        const repeat = raw === lastReq;         // same request => previous choice was invalid
        lastReq = raw;
        let choice;
        if (repeat && retried) { choice = `>${who} default`; }        // give up, take a legal default
        else {
          try { choice = agent(req, who); } catch (e) { choice = `>${who} default`; }
          retried = repeat;
        }
        if (!choice) choice = `>${who} default`;
        s.write(choice.startsWith('>') ? choice.slice(1) : choice);
      }
    }
  }

  const spec = { formatid: format };
  battleStream.write(`>start ${JSON.stringify(spec)}`);
  battleStream.write(`>player p1 ${JSON.stringify({ name: opts.name1 || 'P1', team: pack(team1) })}`);
  battleStream.write(`>player p2 ${JSON.stringify({ name: opts.name2 || 'P2', team: pack(team2) })}`);

  await Promise.all([drive('p1', agent1), drive('p2', agent2)]);
  return { winner, turns: log.filter(l => l.startsWith('|turn|')).length, log };
}

module.exports = { playBattle, get PS() { return PS; } };
