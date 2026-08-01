/* showdown_bot.js — play MAG in the REAL Pokemon Showdown client.
 *
 * WHY (Will, 2026-08-01, looking at the hand-rolled Battle Tower: "bruh this sucks. cant we just
 * use showdown?")
 * -------------------------------------------------------------------------------------------
 * Yes, and it is the better architecture rather than a shortcut. app/tower.html is a battle UI built
 * on engine/medicham2-browser.js — OUR OWN second simulator. Every divergence found on 2026-07-31
 * exists because that engine has to agree with Showdown and periodically does not: the speed
 * multipliers, the Focus Sash discount, the volatile durations, buildMon's item override, the HP
 * formula split between l50() and buildMonFromSet(). Playing on the real server deletes that entire
 * category of bug, and gives the real client for free.
 *
 * IT NEEDS NO ADAPTER LAYER, WHICH IS THE POINT. engine/magnemite.js extends Showdown's own
 * BattlePlayer (via RandomPlayerAI), whose contract is exactly two methods:
 *
 *     receiveLine(line)   parses "|request|{json}" and routes to receiveRequest
 *     choose(choice)      writes the choice to this.stream
 *
 * A websocket speaks the identical protocol. So the bot constructs the normal MAG player with a
 * stream whose write() sends over the socket, and feeds it the room's lines. The policy code is
 * untouched — the same chooseMove that has played 586,816 self-play games.
 *
 * NO NEW DEPENDENCY. Node 24 ships a global WebSocket, and this project pins exactly one dependency
 * on purpose; the 2026-07-31 engineering review flagged unpinned deps as live risk.
 *
 *   node pokemon-showdown start --no-security      (in the showdown checkout, first)
 *   node engine/showdown_bot.js --name MAG
 *   ... then challenge MAG from http://localhost:8000
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const SERVER = arg('server', 'ws://localhost:8000/showdown/websocket');
const NAME = arg('name', 'MAG');
const CS = require('./champions_sim.js');
const FORMAT = arg('format', CS.FORMAT);

if (typeof WebSocket !== 'function') {
  console.error('This needs Node 18+ for a global WebSocket. Node here: ' + process.version);
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const { makeScoringPlayer } = require('./magnemite.js');

/* ---- a team, from REAL observed sets ---------------------------------------------------------
 *
 * Built from data/species-sets.json — the joint sets people actually run, sampled by how often they
 * run them. Not a hand-written team: the point of that artifact is that nothing about a set is
 * invented, and a bot bringing fictional Pokemon into a real client would be the same failure the
 * engine-data rebuild removed. */
const SETS = require('./species_sets.js');

function packTeam(seed) {
  let s = seed >>> 0;
  const rng = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) & 0x7fffffff) / 0x80000000;
  const pool = SETS.speciesWithDepth(50);
  if (pool.length < 6) throw new Error(`only ${pool.length} species have 50+ sheets; cannot build a team`);
  const picked = [];
  const seen = new Set();
  while (picked.length < 6 && seen.size < pool.length) {
    const sp = pool[Math.floor(rng() * pool.length)];
    if (seen.has(sp)) continue;
    seen.add(sp);
    let set = SETS.sample(sp, rng);
    if (!set) continue;
    /* ONE MEGA STONE PER TEAM, or the server rejects the whole team and the bot never plays. The
     * sets are sampled independently and 129 of 308 species carry a stone as their most-common item,
     * so an unconstrained draw produced FOUR megas on the first try. Re-sample this species for a
     * stoneless set rather than dropping the species — its other sets are just as real. */
    const isStone = (it) => /ite$|itex$|itey$/.test(String(it || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (isStone(set.item) && picked.some(pk => isStone(pk.set.item))) {
      let alt = null;
      for (let t = 0; t < 12 && !alt; t++) { const c = SETS.sample(sp, rng); if (c && !isStone(c.item)) alt = c; }
      if (!alt) continue;                 // this species is essentially always mega; skip it
      set = alt;
    }
    picked.push({ sp, set });
  }
  if (picked.length < 6) throw new Error('could not assemble six distinct species');

  /* Showdown packed format:
   * nick|species|item|ability|moves|nature|evs|gender|ivs|shiny|level|happiness,ball,hptype */
  return picked.map(({ sp, set }) => {
    const moves = (set.moves || []).slice(0, 4).join(',');
    /* EVs: the sheets do not carry them (0 of 68,580), so a standard offensive spread is used and
     * that is an ASSUMPTION, stated here as it is stated in data/species-sets.json. */
    const evs = '252,252,4,,,'.split(',').length ? '4,252,,,,252' : '';
    return [`, ${sp}`, sp, set.item || '', set.ability || '', moves, set.nature || '', evs, '', '', '', '', ''].join('|');
  }).join(']');
}

/* ---- websocket plumbing ------------------------------------------------------------------------ */
const ws = new WebSocket(SERVER);
const players = new Map();          // roomid -> { player, rqid }
let joined = false;

const send = (msg) => { ws.send(msg); if (process.env.ABRA_BOT_DEBUG) console.log('>> ' + msg); };

ws.addEventListener('open', () => console.log(`connected to ${SERVER}`));
ws.addEventListener('error', (e) => { console.error('websocket error:', e.message || e); process.exit(1); });
ws.addEventListener('close', () => { console.error('socket closed'); process.exit(1); });

ws.addEventListener('message', (ev) => {
  const data = String(ev.data || '');
  let room = '';
  let body = data;
  if (data.startsWith('>')) {
    const nl = data.indexOf('\n');
    room = data.slice(1, nl < 0 ? data.length : nl);
    body = nl < 0 ? '' : data.slice(nl + 1);
  }
  for (const line of body.split('\n')) handle(room, line);
});

function handle(room, line) {
  if (!line.startsWith('|')) return;
  if (process.env.ABRA_BOT_DEBUG) console.log(`<< [${room}] ${line.slice(0, 140)}`);
  const parts = line.split('|');
  const cmd = parts[1];

  if (cmd === 'challstr') {
    /* --no-security lets a name be claimed with an empty assertion. Without it the server wants a
     * login-server assertion, which a local development bot has no business fetching. */
    send(`|/trn ${NAME},0,`);
    return;
  }

  if (cmd === 'updateuser' && !joined && parts[2] && parts[2].replace(/^[^a-zA-Z0-9]/, '').toLowerCase().startsWith(NAME.toLowerCase())) {
    joined = true;
    console.log(`logged in as ${parts[2].trim()}`);
    console.log(`waiting for a challenge in ${FORMAT} — open http://localhost:8000 and challenge "${NAME}"`);
    return;
  }

  /* A challenge arrives on the user's update line. Accept only the format MAG was fitted for:
   * playing a format the policy was never trained on would produce a number nobody should read. */
  if (cmd === 'updatechallenges') {
    let j = null;
    try { j = JSON.parse(parts.slice(2).join('|')); } catch (e) { console.error('  (unparseable challenge blob)'); return; }
    for (const [from, fmt] of Object.entries((j && j.challengesFrom) || {})) {
      if (fmt !== FORMAT) {
        console.log(`  declining ${from}: ${fmt} is not ${FORMAT}`);
        send(`|/reject ${from}`);
        continue;
      }
      console.log(`  accepting ${from} in ${fmt}`);
      try { send(`|/utm ${packTeam(Date.now() & 0x7fffffff)}`); }
      catch (e) { console.error('  cannot build a team: ' + e.message); send(`|/reject ${from}`); continue; }
      send(`|/accept ${from}`);
    }
    return;
  }

  if (!room.startsWith('battle-')) return;

  let entry = players.get(room);
  if (!entry) {
    /* The stream MAG writes its choice into. This is the whole adapter: BattlePlayer.choose() calls
     * stream.write(choice), and here that becomes a protocol message instead of a stream write. */
    const stream = {
      write: (choice) => {
        const e = players.get(room);
        send(`${room}|/choose ${choice}|${e ? e.rqid : ''}`);
      },
    };
    const Player = makeScoringPlayer({ greedy: true, switching: true });
    entry = { player: new Player(stream), rqid: '' };
    players.set(room, entry);
    console.log(`  battle started: ${room}`);
  }

  if (cmd === 'request') {
    try { const r = JSON.parse(parts.slice(2).join('|')); entry.rqid = r && r.rqid != null ? r.rqid : ''; }
    catch (e) { console.error('  (unparseable request)'); }
  }
  if (cmd === 'win' || cmd === 'tie') {
    console.log(`  battle over: ${line.slice(1)}`);
    players.delete(room);
    send(`${room}|/leave`);
    return;
  }

  try { entry.player.receiveLine(line); }
  catch (e) { console.error(`  player error in ${room}: ${e.message}`); }
}
