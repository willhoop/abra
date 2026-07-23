/* ABRA engine adapter — run REAL Champions battles in the open-source Showdown sim.
 * This is the concrete start of wiring the (now-confirmed OPEN) engine into ABRA.
 * It plays a full [Gen 9 Champions] VGC 2026 Reg M-B battle between two agent
 * functions and returns the winner + protocol log. Two agents = self-play.
 *
 * Requires the sim:  npm install pokemon-showdown   (in this sim/ folder)
 * Then:  node selfplay.js
 *
 * playBattle(team1, team2, agent1, agent2, opts) -> {winner, turns, log}
 *   team*  : packed team string, or an array of set objects (Teams.pack handles both)
 *   agent* : (request, side) => choiceString   e.g. ">p1 default" or ">p1 move 1, move 1"
 *            OR an object { agent, note } where note(line) is fed each protocol line
 *            (lets a policy track the opponent's revealed Pokemon — see greedy agent).
 */
let PS;
try { PS = require('pokemon-showdown'); }
catch (e) { PS = null; }

// accept a plain function or a { agent, note } object
function norm(a) {
  if (typeof a === 'function') return { agent: a, note: null };
  return { agent: a.agent, note: a.note || null };
}

async function playBattle(team1, team2, agent1, agent2, opts = {}) {
  if (!PS) throw new Error("pokemon-showdown not installed. Run:  cd sim && npm install pokemon-showdown");
  const { BattleStream, getPlayerStreams, Teams } = PS;
  const format = opts.format || 'gen9championsvgc2026regmb';
  const pack = t => (typeof t === 'string' ? t : Teams.pack(t));

  const streams = getPlayerStreams(new BattleStream());
  const log = []; let winner = null;
  const A = norm(agent1), B = norm(agent2);

  // read the omniscient stream for the result + full log, and feed every line to
  // any policy that wants to track revealed information (foe species, etc.)
  const omniDone = (async () => {
    for await (const chunk of streams.omniscient) {
      for (const line of chunk.split('\n')) {
        log.push(line);
        if (A.note) try { A.note(line); } catch (_) {}
        if (B.note) try { B.note(line); } catch (_) {}
        if (line.startsWith('|win|')) winner = line.slice(5).trim();
        if (line.startsWith('|tie')) winner = 'tie';
      }
    }
  })();

  // each player: read requests, ask its agent for a choice, write it back.
  // Loop protection: if the SAME request comes back (our last choice was rejected
  // as illegal), fall back to `default` so a buggy agent can never hang the battle.
  async function drive(who, ag) {
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
          try { choice = ag(req, who); } catch (e) { choice = `>${who} default`; }
          retried = repeat;
        }
        if (!choice) choice = `>${who} default`;
        s.write(choice.startsWith('>') ? choice.slice(1) : choice);
      }
    }
  }

  const spec = { formatid: format };
  const p1spec = { name: opts.name1 || 'P1', team: pack(team1) };
  const p2spec = { name: opts.name2 || 'P2', team: pack(team2) };
  // IMPORTANT: control messages go to the omniscient stream (this actually starts
  // the battle; writing them to the raw BattleStream leaves the player streams idle
  // and Node exits silently with no output).
  streams.omniscient.write(
    `>start ${JSON.stringify(spec)}\n` +
    `>player p1 ${JSON.stringify(p1spec)}\n` +
    `>player p2 ${JSON.stringify(p2spec)}`
  );

  await Promise.all([drive('p1', A.agent), drive('p2', B.agent), omniDone]);
  return { winner, turns: log.filter(l => l.startsWith('|turn|')).length, log };
}

module.exports = { playBattle, get PS() { return PS; } };
