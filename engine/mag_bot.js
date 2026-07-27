/* mag_bot.js — put MAG on a real Pokémon Showdown server, so you can challenge it in the client.
 *
 *   1.  cd <pokemon-showdown>  &&  node pokemon-showdown start --no-security
 *   2.  SHOWDOWN_PATH=... node engine/mag_bot.js
 *   3.  open http://localhost:8000, pick a name, and challenge "MAG"
 *
 *   --name <n>      what it logs in as (default MAG)
 *   --server <url>  default ws://localhost:8000/showdown/websocket
 *   --greedy        take the best-scoring move rather than a weighted roll (+9 points, measured)
 *   --switching     let it switch (-10 points, measured, which is why it is off)
 *   --why           print its per-option scores to this terminal as it plays
 *
 * WHY BOTHER, GIVEN engine/play.js ALREADY WORKS
 * ----------------------------------------------
 * play.js is a text interface and judging a bot through one is judging it through a straw. Showdown
 * is where anyone with an opinion about VGC already has their reflexes: sprites, damage numbers, the
 * teambuilder, and the timer. Removing the friction is the point, because the reason to play MAG at
 * all is to catch it doing something a human notices instantly and no automated check ever will —
 * it presses Protect at the same rate against a champion and against a random number generator, and
 * nothing in this repository flagged that.
 *
 * WHAT IS ACTUALLY NEW HERE, WHICH IS LESS THAN IT LOOKS
 * -----------------------------------------------------
 * engine/magnemite.js is unchanged and unchangeable by this file. It already speaks the exact
 * protocol a server room emits, because it was built against BattleStream — so the only job here is
 * DELIVERY: take the lines the socket hands us, put them in the shape the player expects, and post
 * its choices back as `/choose`. If this file needed magnemite to change, the abstraction would be
 * wrong and the bot playing here would not be the bot that played the 60,000 measured games.
 */
'use strict';
const path = require('path');
const CS = require('./champions_sim.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const NAME = arg('name', 'MAG');
const SERVER = arg('server', 'ws://localhost:8000/showdown/websocket');
const GREEDY = process.argv.includes('--greedy');
const SWITCHING = process.argv.includes('--switching');
const WHY = process.argv.includes('--why');
/* --weights <file>  play a different fitted vector. The one worth trying is
 * data/policy-weights-nopop.json, refitted with "how often people click this" removed entirely --
 * which predicts human choices BETTER than the version that has it. */
const WEIGHTS = arg('weights', '');

const { realTeams } = require('./mew.js');
const makeScoringPlayer = require('./magnemite.js').makeScoringPlayer;

/* A stream in the shape BattlePlayer wants, backed by the socket rather than by the simulator.
 *
 * BattlePlayer.start() does `for await (const chunk of this.stream)` and BattlePlayer.choose(c)
 * does `this.stream.write(c)`. That is the whole contract, so it is met directly rather than by
 * dragging in the server's own stream machinery: lines pushed in are yielded to the player, and
 * anything the player writes is handed to `onChoice`. */
function playerStream(onChoice) {
  const queue = [];
  let waiting = null, done = false;
  return {
    push(chunk) {
      if (waiting) { const w = waiting; waiting = null; w({ value: chunk, done: false }); }
      else queue.push(chunk);
    },
    end() { done = true; if (waiting) { const w = waiting; waiting = null; w({ value: undefined, done: true }); } },
    write(data) { onChoice(String(data)); },
    writeEnd() {},
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
          if (done) return Promise.resolve({ value: undefined, done: true });
          return new Promise(res => { waiting = res; });
        },
      };
    },
  };
}

const teams = realTeams();
if (teams.length < 2) { console.error('no clean teams — run the ingest first'); process.exit(1); }
/* packTeam reports whether the result passes Showdown's validator, and MEW discards roughly 2% of
 * draws for exactly that reason. Ignoring the flag means offering the server a team it will reject,
 * and a rejected team makes /accept fail SILENTLY — which is indistinguishable from the bot simply
 * ignoring you, and is how the first version behaved. */
const pickTeam = () => {
  for (let i = 0; i < 40; i++) {
    const t = teams[Math.floor(Math.random() * teams.length)];
    const packed = CS.packTeam(t.six, Object.assign({}, t.sets, { __seed: (Math.random() * 1e9) | 0 }));
    if (packed && packed.packed && packed.valid !== false) return packed.packed;
  }
  return null;
};

const ws = new WebSocket(SERVER);
const send = (s) => ws.send(s);
/* Rooms are tracked so two simultaneous challenges do not share a player object — each battle gets
 * its own MAG with its own board, which is the same isolation MEW gets per game. */
const rooms = new Map();
/* A running record across the session. The reason a person plays this bot is to find out how badly
 * they beat it, and a number nobody is keeping is a number nobody will remember. */
const RECORD = { you: 0, mag: 0, tie: 0 };

ws.onopen = () => console.log(`connected to ${SERVER}`);
ws.onerror = (e) => console.error('socket error:', e && e.message ? e.message : e);
ws.onclose = () => { console.log('disconnected'); process.exit(0); };

ws.onmessage = (ev) => {
  const raw = String(ev.data || '');
  /* A message may be addressed to a room, in which case its first line is ">roomid". */
  let room = '';
  let body = raw;
  if (raw.startsWith('>')) {
    const nl = raw.indexOf('\n');
    room = raw.slice(1, nl < 0 ? undefined : nl);
    body = nl < 0 ? '' : raw.slice(nl + 1);
  }
  for (const line of body.split('\n')) handle(room, line);
};

function handle(room, line) {
  if (!line) return;
  const p = line.split('|');
  const cmd = p[1];

  /* --no-security means no auth server round trip: `/trn name,0,` is accepted as-is. That is the
   * whole reason this works locally and would not against the real site. */
  if (cmd === 'challstr') { send(`|/trn ${NAME},0,`); return; }
  /* A rejected team or a bad command comes back as a popup and is otherwise invisible: the bot just
   * appears to ignore the challenge, which is the least debuggable failure there is. */
  if (cmd === 'popup') { console.error('SERVER SAYS: ' + line.slice(8).replace(/\|\|/g, '  ')); return; }

  if (cmd === 'updateuser' && String(p[2] || '').replace(/^[ !@#$%^&*]/, '') === NAME) {
    console.log(`logged in as ${NAME} — challenge it from the client`);
    return;
  }

  /* Any challenge in this format is accepted, with a real clean ladder team. */
  if (cmd === 'pm' && /wants to battle/.test(line)) return;
  if (cmd === 'updatechallenges') {
    let data; try { data = JSON.parse(p[2]); } catch (e) { return; }
    for (const [who, fmt] of Object.entries(data.challengesFrom || {})) {
      const team = pickTeam();
      if (!team) { console.error('could not draw a VALID team — not accepting'); continue; }
      console.log(`challenge from ${who} (${fmt}) — accepting`);
      send(`|/utm ${team}`);
      send(`|/accept ${who}`);
    }
    return;
  }

  if (!room.startsWith('battle-')) return;

  if (!rooms.has(room)) {
    const stream = playerStream((choice) => {
      /* BattlePlayer writes bare choices like "move 1 1"; a room wants them as /choose. */
      const c = String(choice).trim();
      if (!c) return;
      send(`${room}|/choose ${c}`);
    });
    const Player = makeScoringPlayer();
    const bot = new Player(stream, { greedy: GREEDY, switching: SWITCHING, keepThoughts: WHY,
                                     weightsFile: WEIGHTS || undefined });
    bot.start();
    rooms.set(room, { stream, bot, shown: 0 });
    console.log(`joined ${room}`);
  }
  const st = rooms.get(room);
  st.stream.push(line);

  if (WHY) {
    const th = (st.bot.stats && st.bot.stats.thoughts) || [];
    for (; st.shown < th.length; st.shown++) {
      const d = th[st.shown];
      console.log(`  ${d.mon}:`);
      for (const o of d.opts.slice(0, 6)) {
        console.log(`     ${(100 * o.p).toFixed(0).padStart(3)}%  ${o.mv}${o.tgt ? ' -> ' + o.tgt : ''}`);
      }
    }
  }

  if (line.startsWith('|win|') || line.startsWith('|tie|')) {
    if (line.startsWith('|win|')) {
      const w = line.slice(5).trim();
      if (w === NAME) RECORD.mag++; else RECORD.you++;
    } else RECORD.tie++;
    const n = RECORD.mag + RECORD.you + RECORD.tie;
    console.log(`RECORD  you ${RECORD.you} — MAG ${RECORD.mag}${RECORD.tie ? ' — ' + RECORD.tie + ' tied' : ''}` +
                `   (you win ${(100 * RECORD.you / Math.max(1, n)).toFixed(0)}% of ${n})`);
    console.log(`${room} finished: ${line}`);
    st.stream.end();
    rooms.delete(room);
    send(`${room}|/leave`);
  }
}
