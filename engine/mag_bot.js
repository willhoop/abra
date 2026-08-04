/* mag_bot.js — put MAG on a real Pokémon Showdown server, so you can challenge it in the client.
 *
 *   1.  cd <pokemon-showdown>  &&  node pokemon-showdown start --no-security
 *   2.  SHOWDOWN_PATH=... node engine/mag_bot.js
 *   3.  open http://localhost:8000, pick a name, and challenge "MAG"
 *
 *   --name <n>      what it logs in as (default MAG)
 *   --server <url>  default ws://localhost:8000/showdown/websocket
 *   --pass <p>      account password for a PUBLIC server. PREFER data/.showdown-pass (gitignored,
 *                   one line) or SHOWDOWN_PASS — a password on the command line lands in shell
 *                   history and in `ps`.
 *   --greedy        take the best-scoring move rather than a weighted roll (+9 points, measured)
 *   --switching     let it switch (-10 points, measured, which is why it is off)
 *   --why           print its per-option scores to this terminal as it plays
 *
 * TO LET FRIENDS PLAY IT, which is the whole point of a bot nobody else can reach:
 *
 *   SHOWDOWN_PATH=... SHOWDOWN_PASS=... node engine/mag_bot.js \
 *     --name <registered-name> --server wss://sim3.psim.us/showdown/websocket --greedy
 *
 *   ...then anyone opens play.pokemonshowdown.com and challenges that name in the format below.
 *
 * WHY THE PUBLIC SERVER AND NOT A TUNNEL. The format is `gen9championsvgc2026regmb`, which comes
 * from the `champions` mod — and that mod is in smogon/pokemon-showdown itself, not a local hack, so
 * the real server has the format. Tunnelling a `--no-security` localhost server would also work and
 * needs no password, but it hands anyone who finds the URL the ability to claim any name on it.
 *
 * A NOTE WORTH HAVING: a bot answering CHALLENGES from people who know it is a bot is ordinary. A bot
 * on the LADDER is a different thing and is against Showdown's rules on the main server. This file
 * only accepts challenges — it never searches for a ladder game — and that should stay true.
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
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const D = (...p) => path.join(__dirname, '..', ...p);

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const NAME = arg('name', 'MAG');
const SERVER = arg('server', 'ws://localhost:8000/showdown/websocket');
/* The account password, for a PUBLIC server. Read from the environment by preference so it does not
 * land in shell history or in a screenshot of this terminal; --pass exists for convenience. */
/* THE PASSWORD IS READ, NEVER TYPED INTO A COMMAND.
 *
 * `--pass <p>` puts it in shell history, in `ps`, and in any screenshot of this terminal. The env var
 * is better and still ends up in a shell profile. So the preferred route is a FILE the account owner
 * writes once and nothing else ever echoes: data/.showdown-pass, gitignored, one line.
 *
 * Order: --pass, then SHOWDOWN_PASS, then the file. The flag stays for the local `--no-security` case
 * where the value is not a secret at all. */
const PASS_FILE = D('data', '.showdown-pass');
const PASS = (() => {
  const flag = arg('pass', '');
  if (flag) return flag;
  if (process.env.SHOWDOWN_PASS) return process.env.SHOWDOWN_PASS;
  try {
    /* A BOM IS INVISIBLE AND BREAKS THE LOGIN. Notepad writes one when it saves as UTF-8, and
     * .trim() does not remove it -- the assertion request would carry a stray U+FEFF and the
     * server would simply refuse, with nothing on screen to explain why. */
    return fs.readFileSync(PASS_FILE, 'utf8').replace(/^﻿/, '').trim();
  } catch (e) {
    /* Absent is the normal case for a local server and must not look like a failure; anything else —
     * a permissions problem, a directory where a file should be — is reported, because a bot that
     * silently plays unauthenticated then ignores every challenge is the least debuggable failure. */
    if (e.code !== 'ENOENT') console.error(`  could not read ${PASS_FILE}: ${e.message}`);
    return '';
  }
})();
const LOGIN_URL = arg('login-url', 'https://play.pokemonshowdown.com/api/login');
const GREEDY = process.argv.includes('--greedy');
const SWITCHING = process.argv.includes('--switching');
/* --mega p  probability of taking a mega evolution when one is available. Matches mew.js's default
 * so the bot you challenge is the bot that was trained and measured. NOTE this is a coin flip in
 * the BASE player, not a decision: no feature in board.js scores mega TIMING, so MAG megas at
 * random rather than choosing when. Making it a real choice is a separate piece of work. */
const MEGA_P = parseFloat(arg('mega', '1'));
const WHY = process.argv.includes('--why');
const TRACE = process.argv.includes('--trace');
/* --weights <file>  play a different fitted vector. The one worth trying is
 * data/policy-weights-nopop.json, refitted with "how often people click this" removed entirely --
 * which predicts human choices BETTER than the version that has it. */
const WEIGHTS = arg('weights', '');
/* --rollout      decide by playing the position out instead of by scoring it. This is the bot that
 *                SWITCHES; MAG's switching is one flat feature and measured 10 points worse than
 *                never switching, which is a fact about MAG and not about switching.
 * --rollout-n    playouts per candidate (default 200; R3 found the search stops flip-flopping
 *                around 600, and R2 puts a playout at well under a millisecond)
 */
/* MILTANK -- the SEARCH player, and a different player to MAG rather than a setting on it.
 *
 * MAG is a fitted linear policy over board features, trained to predict what a human CLICKS. It
 * imitates. MILTANK decides by playing the position out and taking the line that wins most, so it
 * can prefer a move no human in the corpus ever chose. Will named it: Whitney's Miltank is the
 * classic Rollout user, and calling it 'the rollout' described the mechanism while hiding that a
 * second player existed at all.
 *
 * They are not rivals. MILTANK searches; when the search cannot separate its options -- inside the
 * noise floor, or in a position already decided -- it defers to MAG, because a fitted human prior
 * beats a coin flip over near-ties. Imitation is the floor and the search is the ceiling.
 *
 * --rollout is kept as an alias so anything already running keeps working. */
const ROLLOUT = process.argv.includes('--miltank') || process.argv.includes('--rollout');
const ROLLOUT_N = parseInt(arg('rollout-n', '200'), 10);
/* --rollout-explore  how random the playout is. 1.0 is the best POSITION judge (R1: 68.18% against
 *   64.42% for greedy), but judging a position and choosing an ACTION are different jobs: random
 *   players never punish a wasted turn, so a random playout prices tempo at nearly zero and every
 *   switch looks free. Exposed so the two can be compared rather than assumed equal. */
const ROLLOUT_EXPLORE = parseFloat(arg('rollout-explore', '1.0'));
/* --rollout-turns  how far a playout runs before it is scored. MEDICHAM's default is 20 and
 *   battleResult scores LIVE BODIES first, so a SEARCH maximising that finds stalling: switch
 *   back and forth and nothing dies before the horizon. A rollout on its own never noticed
 *   because it was not choosing. Default raised here so the games actually resolve. */
const ROLLOUT_TURNS = parseInt(arg('rollout-turns', '60'), 10);
/* --preview-n / --preview-ms  how hard MILTANK thinks about which four to bring. 90 brings is the
 * full enumeration for six Pokemon; the deadline is what keeps it inside Showdown's preview timer
 * on a slow machine, and whatever was scored by then is reported honestly. */
const PREVIEW_N = parseInt(arg('preview-n', '40'), 10);
const PREVIEW_MS = parseInt(arg('preview-ms', '15000'), 10);

const { realTeams } = require('./mew.js');
const makeScoringPlayer = require('./magnemite.js').makeScoringPlayer;
/* MEDICHAM's OWN protect set, not a copy of it. A second list here would be a hardcode that drifts
 * from the engine whose (1/3)^n rule the counter exists to feed. */
const PROTECT_IDS = require('./medicham2-browser.js').PROTECTMOVES;
/* dmgMon, for asking MEDICHAM whether it can actually express a click before offering it. */
const B = require('./board.js');
/* The tag artifact, for asking whether a click can do its one job against THIS target. */
const TAGSMOD = require('./tags.js');

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

/* OPEN TEAM SHEETS ONLY. NO GUESSING.
 *
 * A corpus team carries the moves the REPLAY REVEALED, and a replay reveals almost nothing: across
 * 41,040 Pokemon slots, 47.0% show zero moves and only 7.8% show all four. Everything else is drawn
 * from per-species priors -- INDEPENDENTLY, one Pokemon at a time, with nothing checking that the
 * team still works as a team. That is how Will got handed a Banette/Drampa/Milotic Trick Room team
 * with no Trick Room on it: Banette's real set had the move, the replay never showed it, and the
 * redraw gave it Poltergeist and Disable instead. Banette draws Trick Room on 30% of samples;
 * Drampa and Milotic on 0%.
 *
 * OPEN TEAM SHEET GAMES ARE ALREADY SCRAPED FOR EXACTLY THIS REASON and the corpus proves it. The
 * per-team completeness is bimodal, not a gradient: 73% of teams have NO fully-known Pokemon, and
 * 3.4% have all six -- 231 teams, of which 230 also have every item and ability. Those are the sheets.
 * Nothing preferred them; realTeams returned all 6,840 and the picker rolled a die.
 *
 * So the live bot plays REAL teams only. 231 complete VGC teams is not a small pool for playing
 * friends, and every one of them is coherent because a person built it. --any-team restores the old
 * behaviour rather than deleting it, because self-play may still want the variety.
 */
const ALL_TEAMS = realTeams();
const isComplete = (t) => t.six.length >= 4 && t.six.every((sp) => {
  const st = (t.sets || {})[sp];
  return st && st.moves && st.moves.length >= 4 && st.item && st.ability;
});
const ANY_TEAM = process.argv.includes('--any-team');
const teams = ANY_TEAM ? ALL_TEAMS : ALL_TEAMS.filter(isComplete);
if (!ANY_TEAM) {
  console.log(`teams: ${teams.length} complete open-sheet teams of ${ALL_TEAMS.length} ` +
    `(${(100 * teams.length / ALL_TEAMS.length).toFixed(1)}%) — no move is guessed`);
}
if (teams.length < 2) {
  console.error(ANY_TEAM ? 'no clean teams — run the ingest first'
    : 'no COMPLETE open-sheet teams found. Run with --any-team to fall back to reconstructed sets, '
      + 'but expect incoherent teams: 47% of corpus Pokemon reveal no moves at all.');
  process.exit(1);
}
/* packTeam reports whether the result passes Showdown's validator, and MEW discards roughly 2% of
 * draws for exactly that reason. Ignoring the flag means offering the server a team it will reject,
 * and a rejected team makes /accept fail SILENTLY — which is indistinguishable from the bot simply
 * ignoring you, and is how the first version behaved. */
/* --team-index k  ALWAYS draw team k. This is what makes an A/B between two players a controlled
 * one: in a SINGLE-TEAM MIRROR MATCH the two sides hold identical Pokemon with identical sets, so a
 * win cannot be explained by the draw. It is the setting VGC-Bench used to beat a professional
 * player, and the honest caveat travels with it -- a result on one team is a result on one team.
 * Absent, teams are drawn at random exactly as before. */
const TEAM_INDEX = arg('team-index', '');
const pickTeam = () => {
  for (let i = 0; i < 40; i++) {
    const t = TEAM_INDEX !== '' ? teams[(parseInt(TEAM_INDEX, 10) || 0) % teams.length]
                                : teams[Math.floor(Math.random() * teams.length)];
    const packed = CS.packTeam(t.six, Object.assign({}, t.sets, { __seed: (Math.random() * 1e9) | 0 }));
    if (packed && packed.packed && packed.valid !== false) return packed.packed;
  }
  return null;
};


/* ---- THE LIVE ODDS WINDOW ----------------------------------------------------------------------
 *
 * MAG scores every option and those numbers are destroyed the moment it clicks. They were being
 * printed to a terminal — the wrong place to look when the battle is in a browser. This serves the
 * latest decision as a page, so it can sit beside the game and move as the turn moves.
 *
 * Deliberately a poll rather than a socket: the page must survive the bot restarting, and a dead
 * socket that never reconnects is worse than a page that quietly retries twice a second.
 */
const OVERLAY_PORT = +(arg('port', '8081'));
let LATEST = { turn: 0, room: '', decisions: [] };
const HISTORY = [];   // one entry per decision, for the trace

const PAGE = `<!doctype html><meta charset=utf-8><title>MAG — live odds</title>
<style>
 *{box-sizing:border-box} body{margin:0;background:#0f1116;color:#e8ecf3;
   font:14px/1.45 ui-monospace,Menlo,Consolas,monospace}
 header{padding:12px 16px;border-bottom:1px solid #232838;display:flex;justify-content:space-between;align-items:center}
 h1{font:600 13px/1 system-ui;margin:0;letter-spacing:.14em;text-transform:uppercase;color:#7c8persist}
 h1{color:#7c88a8}
 .room{font-size:11px;color:#5b647d}
 .mon{padding:10px 12px;border-bottom:1px solid #1a1e2a}
 /* NARROW BY DESIGN. This is meant to sit in a snapped half-screen column beside the battle, not to
  * be a page you visit. Everything below keeps it legible at ~360px: the move name truncates before
  * it wraps, the target drops to its own line, and the bars stay tall enough to read at a glance. */
 @media (max-width:520px){
   .mon{padding:8px 10px}
   .row{grid-template-columns:40px 1fr;gap:6px;margin:4px 0}
   .barwrap{height:22px}
   .lbl{font-size:12px;padding:0 7px;gap:5px}
   .tgt{font-size:10px}
   header{padding:8px 10px}
 }
 .name{font:600 15px/1 system-ui;margin-bottom:10px;color:#fff}
 .row{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:center;margin:5px 0}
 .pct{text-align:right;font-variant-numeric:tabular-nums;color:#9aa6c0}
 .barwrap{background:#171b26;border-radius:4px;height:26px;position:relative;overflow:hidden}
 .bar{position:absolute;inset:0 auto 0 0;border-radius:4px;
   background:linear-gradient(90deg,#2f5fc0,#5f8ee0);transition:width .35s cubic-bezier(.2,.7,.3,1)}
 .lbl{position:absolute;inset:0;display:flex;align-items:center;padding:0 10px;gap:8px;
   font-size:13px;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap;overflow:hidden}
 .lbl span:first-child{overflow:hidden;text-overflow:ellipsis}
 .top .bar{background:linear-gradient(90deg,#1f7a4d,#3fbf7f)}
 .tgt{color:#98a4bd;font-size:12px}
 .empty{padding:40px 16px;color:#5b647d;text-align:center}
</style>
<header><h1>MAG — what it is weighing</h1><span class=room id=room>waiting…</span></header>
<div id=body class=empty>challenge ${NAME} and this fills in</div>
<script>
const COLORS=['#5f8ee0','#3fbf7f','#d98b3f','#b06be0','#e05f7f','#4fc4c4'];
async function tick(){
  let d; try{ d=await (await fetch('/odds')).json(); }catch(e){ return; }
  document.getElementById('room').textContent = d.room ? d.room+' · turn '+d.turn : 'waiting for a turn…';
  const body=document.getElementById('body');
  if(!d.decisions.length){ return; }
  body.className='';
  body.innerHTML = d.decisions.map(dec=>{
    const rows = dec.opts.map((o,i)=>{
      const pct=(100*o.p);
      return '<div class="row'+(i===0?' top':'')+'"><div class=pct>'+pct.toFixed(0)+'%</div>'+
        '<div class=barwrap><div class=bar style="width:'+Math.max(2,pct)+'%"></div>'+
        '<div class=lbl><span>'+o.mv+'</span>'+(o.tgt?'<span class=tgt>→ '+o.tgt+'</span>':'')+'</div></div></div>';
    }).join('');
    return '<div class=mon><div class=name>'+dec.mon+'</div>'+rows+'</div>';
  }).join('');
}
setInterval(tick,500); tick();
</script>`;

require('http').createServer((req, res) => {
  if (req.url === '/odds') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ...LATEST, history: HISTORY.slice(-120) }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(PAGE);
}).listen(OVERLAY_PORT, () => console.log(`live odds: http://localhost:${OVERLAY_PORT}`));

/* THE SOCKET RECONNECTS INSTEAD OF DYING, because "leave it running so my friends can play" was the
 * whole point and `onclose -> process.exit(0)` made that impossible. Any wifi blip, any server
 * restart, any laptop lid closing for a second ended the bot permanently -- and it announced that to
 * an empty terminal at 3am, so the first anyone knew was a friend saying it was offline.
 *
 * Backoff doubles from 2s to a 60s ceiling so a server that is genuinely down is not hammered, and
 * resets on a successful login rather than on a successful CONNECT: a socket that opens and then
 * fails to authenticate is not a working bot, and treating it as one would spin a tight reconnect
 * loop against a wrong password.
 *
 * Rooms are dropped on disconnect. A battle cannot be resumed from this side -- the server has the
 * state and the player object does not -- so pretending otherwise would have MAG answering a room it
 * no longer understands. */
let ws = null;
let backoff = 2000;
let stopping = false;
const send = (s) => { if (ws && ws.readyState === 1) ws.send(s); };

/* --challenge <user>: the bot opens the game instead of waiting to be challenged.
 *
 * Waiting requires the challenger's client to hold a popup open, and Will's does not: the trace
 * showed his challenges never reached the server at all, so no amount of work on this side could
 * have received them. Challenging outward reduces his side to one Accept button. */
const CHALLENGE = arg('challenge', '');
/* Rooms rejoined ONLY to ask for a replay link. They must not be handed to a battle player: the
 * room handler would build a fresh MAG, replay a finished game into it and have it try to choose
 * in a battle that is over. */
const RECOVERING = new Set();
let lastOffer = 0;
function offerChallenge(why) {
  if (!CHALLENGE) return;
  /* Rate-limited because a re-offer is triggered by PMs and by battles ending, and Showdown throttles
   * a client that repeats a command -- which would get the bot muted rather than connected. */
  const now = Date.now();
  if (now - lastOffer < 8000) return;
  lastOffer = now;
  const team = pickTeam();
  if (!team) { console.error('could not draw a VALID team — not challenging'); return; }
  send(`|/utm ${team}`);
  send(`|/challenge ${CHALLENGE}, ${CS.FORMAT}`);
  console.log(`challenged ${CHALLENGE} in ${CS.FORMAT} (${why}) — accept it on your screen`);
}


/* Rooms are tracked so two simultaneous challenges do not share a player object — each battle gets
 * its own MAG with its own board, which is the same isolation MEW gets per game. */
const rooms = new Map();
/* A running record across the session. The reason a person plays this bot is to find out how badly
 * they beat it, and a number nobody is keeping is a number nobody will remember. */
const RECORD = { you: 0, mag: 0, tie: 0 };
/* Kept vs thrown out, so a night of closed-sheet games cannot read as a night of no games. */
const SAVED = { kept: 0, skipped: 0 };

/* IF THE NAME IS ALREADY TAKEN, SAY SO. LOUDLY.
 *
 * Two bot processes cannot both be MAG. The server hands the name to one and silently refuses the
 * other, which then sits there connected, logged in as nobody, ignoring every challenge -- and looks
 * exactly like a broken bot. That cost twenty minutes tonight. A connection that has not acquired
 * its name within five seconds is a failure and now announces itself as one. */
let loggedIn = false;
/* THE CLOCK STARTS AT CONNECT, NOT AT PROCESS START, and that is the difference between a warning
 * that means something and one that cries wolf. Loading the team pool and the simulator takes
 * longer than five seconds on a cold start, so the timer was firing before the socket had finished
 * handshaking -- printing "another instance already has it" and then, two lines later, "logged in".
 * A false alarm that names a specific wrong cause is worse than no alarm: it sends you to close a
 * process that does not exist. Ten seconds because a PUBLIC server adds a login round trip that
 * localhost does not. */
const armNameCheck = () => setTimeout(() => {
  if (!loggedIn) {
    console.error(`
  COULD NOT BECOME "${NAME}" — almost certainly another instance already has it.`);
    console.error('  Close the other one, or run this with a different name:');
    console.error(`      node engine/mag_bot.js --name ${NAME}2
`);
  }
}, 10000);

/* connect() is a FUNCTION and the handlers are attached inside it, rather than the whole file being
 * wrapped in one. The first attempt wrapped everything from the socket down to here, which put
 * `handle` outside the scope holding `loggedIn` and crashed on the first line the server sent.
 * Keeping the module flat and re-attaching per socket is the smaller change and the one that works. */
function connect() {
  ws = new WebSocket(SERVER);
  ws.onopen = () => { console.log(`connected to ${SERVER}`); armNameCheck(); };
  ws.onerror = (e) => console.error('socket error:', e && e.message ? e.message : e);
  ws.onmessage = onMessage;
  ws.onclose = () => {
    loggedIn = false;
    rooms.clear();
    if (stopping) return;
    const wait = backoff;
    backoff = Math.min(backoff * 2, 60000);
    console.log(`disconnected — reconnecting in ${Math.round(wait / 1000)}s`);
    setTimeout(connect, wait);
  };
}

/* Ctrl-C sets `stopping` BEFORE exiting so the close handler does not schedule a reconnect on the way
 * out — otherwise quitting the bot prints "reconnecting in 2s" as its last words. */
process.on('SIGINT', () => { stopping = true; console.log('stopping'); process.exit(0); });
/* Named, so connect() can re-attach it to each new socket. It used to be assigned once to the one
 * socket that existed; with reconnection there is a new socket every time. */
function onMessage(ev) {
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
}

function handle(room, line) {
  if (!line) return;
  /* --trace prints every non-battle line the server sends. Guessing at why a challenge does not
   * arrive is how the last hour went; this makes the server's side of it visible. Battle rooms are
   * excluded because a live battle is thousands of lines and would bury the thing being looked for. */
  if (TRACE && !room.startsWith('battle-')) {
    const c = line.split('|')[1] || '';
    if (!['', 'init', 'title', 'users', 'j', 'l', 'c', 'c:', 'raw', 'html', ':'].includes(c)) {
      console.log('  << ' + line.slice(0, 220));
    }
  }
  const p = line.split('|');
  const cmd = p[1];

  /* LOGGING IN, THE LOCAL WAY AND THE REAL WAY.
   *
   * `--no-security` accepts `/trn name,0,` as-is with no auth round trip, which is why this worked
   * locally and would not against the real site. A public server issues a challstr and wants an
   * ASSERTION, obtained by posting that challstr together with the account password.
   *
   * Both paths live here because the difference is one field: with a password we fetch an assertion
   * first; without one we send the empty third argument exactly as before. The no-password case
   * against a NON-local server is reported rather than attempted quietly — a bot that connects,
   * fails to authenticate and then sits ignoring every challenge is the least debuggable failure
   * there is, which is the same reason the popup handler below exists.
   *
   * No new dependency: Node 24 ships a global fetch, and this project pins exactly one dependency on
   * purpose. */
  if (cmd === 'challstr') {
    const challstr = p.slice(2).join('|');
    if (!PASS) {
      if (!/^wss?:\/\/(localhost|127\.)/.test(SERVER)) {
        console.error('  No --pass given and the server is not localhost. A public server will');
        console.error('  refuse an unauthenticated name — pass --pass <password> or set SHOWDOWN_PASS.');
      }
      send(`|/trn ${NAME},0,`);
      return;
    }
    (async () => {
      try {
        const res = await fetch(LOGIN_URL, {
          method: 'POST',
          body: new URLSearchParams({ name: NAME, pass: PASS, challstr }),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        /* The login endpoint has historically prefixed its JSON with `]` to defeat naive eval.
         * Stripped if present rather than assuming either shape. */
        const json = JSON.parse((await res.text()).replace(/^\]/, ''));
        if (!json.assertion) throw new Error(json.actionerror || 'no assertion in the login response');
        console.log('  login assertion received; sending /trn');
        send(`|/trn ${NAME},0,${json.assertion}`);
      } catch (e) {
        /* Said out loud and NOT retried silently: a wrong password and a network failure both leave
         * the bot connected and mute, and they need different fixes. */
        console.error(`  LOGIN FAILED for ${NAME}: ${e.message}`);
        console.error('  Connected but not authenticated — it will ignore every challenge.');
      }
    })();
    return;
  }
  /* A rejected team or a bad command comes back as a popup and is otherwise invisible: the bot just
   * appears to ignore the challenge, which is the least debuggable failure there is. */
  if (cmd === 'popup') { console.error('SERVER SAYS: ' + line.slice(8).replace(/\|\|/g, '  ')); return; }

  /* COMPARED THE WAY SHOWDOWN COMPARES NAMES: lowercased, non-alphanumerics dropped. That is the
   * server's own `toID`, and it matters on a PUBLIC server in a way it never did locally — the site
   * echoes the name with its REGISTERED capitalisation, so an exact-string match against whatever
   * was typed on the command line fails whenever the two differ by a letter's case. The symptom is
   * silent: no login line, no error, and a ten-second timer that then blames a duplicate instance.
   * Also strips the rank sigil the server prefixes (space, +, %, @, #, &). */
  const toID = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cmd === 'updateuser' && toID(p[2]) === toID(NAME)) {
    loggedIn = true;
    /* JOIN A ROOM. A logged-in account that sits in no room appears in no userlist, and the client's
     * user popup -- the thing a challenge is sent from -- has nothing anchoring it, so it closes on
     * its own. Being in a public room is what makes the account reachable by clicking its name. */
    send('|/join lobby');
    console.log(`logged in as ${NAME} -- joining lobby; challenge it from the client`);
    /* Given a moment: /utm and /challenge are both rejected until the login has settled server-side. */
    setTimeout(() => offerChallenge('on login'), 2500);
    /* RECOVER THE REPLAYS FOR GAMES ALREADY PLAYED. /savereplay was wired only after three real
     * games had been played and lost to the client, but a finished battle room survives on the
     * server for a while -- so rejoining it and asking is worth one attempt. The room ids are DERIVED
     * from what was recorded in data/live-games rather than typed, so this needs no maintenance and
     * cannot name a game that was never recorded. Local-server ids (short) are skipped: those rooms
     * are gone with the process that hosted them. */
    setTimeout(() => {
      let ids = [];
      try {
        ids = fs.readdirSync(D('data', 'live-games'))
          .filter(f => f.endsWith('.log'))
          .map(f => f.replace(/\.log$/, ''))
          .filter(f => /-\d{6,}$/.test(f));
      } catch (e) { return; }
      let done = [];
      try { done = fs.readFileSync(D('data', 'live-games', 'replays.txt'), 'utf8').split('\n'); } catch (e) { /* none yet */ }
      for (const id of ids) {
        if (done.some(u => u.indexOf(id.replace(/^battle-/, '')) >= 0)) continue;
        RECOVERING.add(id);
        send(`|/join ${id}`);
        send(`${id}|/savereplay`);
      }
      if (RECOVERING.size) console.log(`asking the server for ${RECOVERING.size} past replay(s)`);
    }, 4000);
    return;
  }

  /* A CHALLENGE ARRIVES AS A PM, NOT AS `updatechallenges`.
   *
   * The first version listened for `updatechallenges` -- and then, worse, explicitly IGNORED any pm
   * mentioning a battle. So the one message that mattered was thrown away by name. What the server
   * actually sends is:
   *
   *     |pm| BBB| AAA|/challenge gen9championsvgc2026regmb|gen9championsvgc2026regmb|||
   *
   * Found by simulating both sides and dumping every line the CHALLENGED client receives, after
   * three rounds of guessing at it from the outside. */
  if (cmd === 'pm') {
    const from = String(p[2] || '').replace(/^[ !@#$%^&*+ -]/, '').trim();
    const payload = p.slice(4).join('|');
    /* ANY PM RE-ISSUES THE OUTBOUND CHALLENGE.
     *
     * The inbound path assumes the challenger can hold the client's user popup open long enough to
     * pick a format and press a button. On Will's client it closes within a second -- and the trace
     * proves the challenge never reaches the server at all, so nothing on this side can fix it.
     *
     * A PM is not the popup and does not have that problem: his friend request landed fine while
     * every challenge did not. So a PM of any content re-fires the challenge FROM here, which turns
     * his side into a single Accept button. */
    if (CHALLENGE && toID(from) === toID(CHALLENGE) && !/^\//.test(payload)) {
      offerChallenge('asked over PM');
      return;
    }
    /* THE FORMAT IS THE FIRST PIPE-FIELD, NOT THE WHOLE PAYLOAD.
     *
     * A challenge PM arrives as `/challenge FORMAT|FORMAT|||` -- format, then the challenger's team
     * and options. `\S+` does not stop at a pipe, so it captured the entire blob and the wrong-format
     * guard then rejected every valid challenge in the format it was written to allow. That guard was
     * added to make a rejection VISIBLE instead of silent; it made a working path fail loudly instead.
     * [^|\s]+ stops at the delimiter, which is what the protocol actually uses. */
    const m = /^\/challenge\s+([^|\s]+)/.exec(payload);
    if (!m || !from || from === NAME) return;
    const fmt = m[1];
    /* A WRONG-FORMAT CHALLENGE IS ANSWERED, NOT IGNORED.
     *
     * This bot has one team, in one format. A challenge in Random Battle used to be dropped in
     * silence — and from the client that is indistinguishable from the bot being offline, which is
     * exactly what Will reported ("everytime i go to challenge magabra it disappears"). Two very
     * different problems, one symptom, and the silent one sends you looking at the wrong thing.
     *
     * So it says so, in a PM the challenger can actually read, and rejects the challenge rather than
     * leaving it hanging until the client times it out. */
    if (fmt && fmt !== CS.FORMAT) {
      console.log(`challenge from ${from} in ${fmt} — REJECTED, this bot only plays ${CS.FORMAT}`);
      send(`|/reject ${from}`);
      send(`|/pm ${from}, I only play ${CS.FORMAT} — pick that format and challenge me again.`);
      return;
    }
    const team = pickTeam();
    if (!team) { console.error('could not draw a VALID team — not accepting'); return; }
    console.log(`challenge from ${from} (${fmt}) — accepting`);
    send(`|/utm ${team}`);
    send(`|/accept ${from}`);
    return;
  }
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

  /* THE LINK ARRIVES IN A POPUP, NOT IN A QUERYRESPONSE.
   *
   * The first version parsed `|queryresponse|savereplay|{...}` -- a shape I wrote from memory, which
   * never fired once. What the server actually sends is
   *     |popup||html|<p>Your replay has been uploaded! ...href="https://replay.pokemonshowdown.com/..."
   * and that was found by PRINTING what the server sent rather than by assuming it. The URL is taken
   * from the message instead of rebuilt from an id, so a private room's password suffix comes along
   * with it and the link cannot 404 in a way this code invented. */
  {
    const mUrl = /https:\/\/replay\.pokemonshowdown\.com\/[A-Za-z0-9_-]+/.exec(line);
    if (mUrl && line.indexOf('uploaded') >= 0) {
      const url = mUrl[0];
      console.log(`REPLAY  ${url}`);
      try {
        let seen = '';
        try { seen = fs.readFileSync(D('data', 'live-games', 'replays.txt'), 'utf8'); } catch (e) { /* first one */ }
        if (seen.indexOf(url) < 0) fs.appendFileSync(D('data', 'live-games', 'replays.txt'), url + '\n');
      } catch (e) { console.error('  could not append replays.txt: ' + e.message); }
    }
  }

  if (!room.startsWith('battle-')) return;

  if (RECOVERING.has(room)) return;
  if (!rooms.has(room)) {
    const stream = playerStream((choice) => {
      /* BattlePlayer writes bare choices like "move 1 1"; a room wants them as /choose. */
      const c = String(choice).trim();
      if (!c) return;
      if (/mega/.test(c)) console.log(`${room}: CHOOSING MEGA -> ${c}`);
      send(`${room}|/choose ${c}`);
    });
    const Player = makeScoringPlayer();
    /* MEGA EVOLUTION WAS NEVER PASSED, SO THE BOT ON THE SERVER COULD NOT MEGA EVOLVE.
     *
     * Found by Will in his first session actually playing it: "its not mega evolving swampert".
     *
     * The base player appends ` mega` to whatever chooseMove returns, but only when
     * `prng.random() < this.mega`, and `this.mega = options.mega || 0`. mew.js passes 0.85. This
     * file passed nothing, so it resolved to 0 and the bot declined every mega for its entire
     * existence.
     *
     * That makes this a TRAIN/PLAY MISMATCH, not just a missing feature. MACHAMP's champion earned
     * its 57.3% as a bot that megas 85% of the time it can; the bot on the Showdown server was a
     * different and strictly weaker policy, and every human impression formed here was of that
     * weaker bot. 27.5% of sheet entries in this format carry a mega item.
     *
     * Default matches mew.js so the thing you play is the thing that was measured. */
    const bot = new Player(stream, { greedy: GREEDY,
                                     /* SWITCH CANDIDATES MUST BE ON THE MENU FOR THE SEARCH TO WEIGH
                                      * THEM. magnemite only builds them when `switching` is set, and
                                      * it defaults off because MAG's switch SCORING is one flat
                                      * feature and cost 10 points. Under --rollout that scorer is not
                                      * what decides, so the reason for the default does not apply:
                                      * the switch is offered and the playout judges it. */
                                     switching: SWITCHING || ROLLOUT, /* ALWAYS ON, not gated behind --why.
                                      *
                                      * The comment further down claims "the window is fed whether
                                      * or not --why is on", and it was not: keepThoughts: WHY meant
                                      * the bot never RECORDED its per-option scores unless the
                                      * terminal flag was set, so the live-odds page sat on
                                      * "waiting for a turn..." through an entire battle. Will hit
                                      * exactly that. --why controls TERMINAL printing; the page is a
                                      * separate surface and silencing one should not blank the
                                      * other. Cost is one small object per decision, which a live
                                      * bot can obviously afford. */
                                     keepThoughts: true,
                                     mega: MEGA_P,
                                     weightsFile: WEIGHTS || undefined });
    /* ---- THE ROLLOUT SEARCH, WIRED IN AS THE DECISION MAKER -------------------------------------
     *
     * `--rollout` replaces MAG's scoring with: for each joint action I could take, play the position
     * OUT and take the one that wins most. It is wrapped around the player rather than built into
     * engine/magnemite.js on purpose — magnemite is the policy that played the measured games, and a
     * bot you can compare against is worth more than one file with two brains in it.
     *
     * THE REASON IT EXISTS IS SWITCHING. board.js scores a switch with ONE flat feature, the same
     * constant whoever is coming in and whatever is about to die, which is why MAG's switching
     * measured 10 points worse than never switching. A rollout needs no such feature: it brings the
     * body in and plays the game. Measured on 70 real decisions it takes a switch on a third of the
     * turns where one is available; MAG takes one essentially never.
     *
     * BOTH SLOTS AT ONCE, parked exactly the way _decidePair already does it: Showdown calls
     * chooseMove once per active slot, so the pair is decided on the first call and the partner's
     * half is handed back on the second. Deciding them independently would be a different and worse
     * player — it is a doubles format and the two choices interact. */
    if (ROLLOUT) {
      /* MILTANK lives in engine/miltank.js now. It was ~550 lines of overrides inline here,
       * which made it unreachable from engine/mew.js -- the only harness that can run a
       * controlled A/B. R4, the SPRT that asks whether MILTANK WINS MORE than MAG, was not
       * merely unrun but UNRUNNABLE. A player living in a socket handler cannot be measured. */
      require('./miltank.js').install(bot, {
        n: ROLLOUT_N, explore: ROLLOUT_EXPLORE, turns: ROLLOUT_TURNS,
        previewN: PREVIEW_N, previewMs: PREVIEW_MS, why: WHY, trace: TRACE,
      });
    }
    bot.start();
    rooms.set(room, { stream, bot, shown: 0, ots: false, log: [], started: Date.now() });
    console.log(`joined ${room}`);
    /* ACCEPT OPEN TEAM SHEETS -- BUT ONLY DURING TEAM PREVIEW.
     *
     * The main Champions format offers them; the Bo3 id forces them. Half of MAG's work reads the
     * sheet -- the SP spread distribution is narrowed by the opponent's revealed nature -- so
     * declining, or simply never answering, measures those features switched off. It is also the
     * regime the weights were FITTED in, so playing closed-sheet is playing a different game to the
     * one the model learned.
     *
     * Sent on `|teampreview` rather than on joining the room: sending it after preview is an ERROR,
     * and reconnecting to a battle already in progress made the bot send it late, take the server's
     * complaint as a fatal error, and exit. See the teampreview branch below. */
  }
  const st = rooms.get(room);
  /* PUBLISH THE REPLAY, because a game nobody can watch back is not evidence of anything.
   *
   * Will: "any games with ots lets record so i can watch them back", then "SEND ME THE REPLAY LINKS
   * FOR ALL THE GAMES". The bot was already writing the room's protocol stream to data/live-games --
   * which is what a replay IS -- but a local .log is not a link, and /savereplay was never sent. So
   * three games were played and none of them were watchable.
   *
   * Sent on the win line, which is the point the room is complete and still open. OTS only, for the
   * same reason the recording is OTS only: a closed-sheet game is thrown out, so publishing it would
   * put a game that does not count next to the ones that do. */
  if (line.startsWith('|win|') && st && st.ots) send(`${room}|/savereplay`);
  /* KEEP PLAYING. An A/B run needs hundreds of games and a bot that challenges once and then waits
   * forever produces one. Re-offered on the win line, rate-limited by offerChallenge itself. */
  if (line.startsWith('|win|') && CHALLENGE) setTimeout(() => offerChallenge('next game'), 1500);
  /* The one moment it is legal to agree. */
  if (line.startsWith('|teampreview')) {
    send(`${room}|/acceptopenteamsheets`);
    console.log(`${room}: agreeing to open team sheets`);
  }
  if (line.startsWith('|showteam|')) {
    if (st) st.ots = true;
    console.log(`${room}: OPEN SHEETS ARE UP — sets are visible`);
  }

  /* HOW MANY TIMES IN A ROW THIS POKEMON HAS PROTECTED, read off the battle log.
   *
   * MEDICHAM fails a repeated Protect with probability (1/3)^n, but a rollout builds fresh bodies and
   * a fresh body has protected zero times -- so inside the search Protect never failed and the search
   * spammed it. rollout_leaf takes this map and seeds `tookProtectTurns` from it.
   *
   * Read from `|move|` rather than from what the bot CHOSE, deliberately: a chosen move that never
   * executes (the user was knocked out first, or flinched, or the picker fell back to MAG) would
   * desynchronise a choice-side counter from the game, and a counter that drifts is worse than none.
   * The log says what actually happened. */
  if (st && st.bot && line.startsWith('|move|')) {
    const mp = line.split('|');
    const who = String(mp[2] || '');                       // "p1a: Roaring Moon"
    const mine = who.startsWith(st.bot.me || 'p1');
    if (mine) {
      const species = who.split(':').slice(1).join(':').trim();
      const id = String(mp[3] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      st.protectTurns = st.protectTurns || {};
      if (PROTECT_IDS.has(id)) st.protectTurns[species] = (st.protectTurns[species] || 0) + 1;
      else st.protectTurns[species] = 0;
      st.bot._protectTurns = st.protectTurns;
    }
  }

  /* ---- RECORD EVERY OTS GAME, AND ONLY OTS GAMES -------------------------------------------------
   *
   * Will: "we are solving open team sheet first ... any games without ots just throw them out", and
   * "any games with ots lets record so i can watch them back".
   *
   * OTS is not a preference here, it is the input. The rollout seeds the opponent's team from the
   * sheet; without one it is guessing four Pokemon out of a species it has not even seen, and a game
   * played on that is not evidence about the bot. So a closed-sheet battle is recorded as SKIPPED
   * rather than silently mixed in with the rest — a corpus that quietly contains both is exactly the
   * kind that produced the withdrawn Sucker Punch claim.
   *
   * The log is the room's own protocol stream, which is what Showdown replays are made of, so it can
   * be watched back rather than merely read. */
  if (st) {
    if (!st.log) st.log = [];
    st.log.push(line);
  }
  /* MEGA DIAGNOSTIC. Will reported twice that the bot never mega evolves, while self-play megas
   * 2,174 times in 1,934 games -- so the engine is fine and something on THIS path is not. Passing
   * the `mega` option was necessary and turned out not to be sufficient, and guessing between the
   * two remaining explanations is exactly the habit that has cost this project a day at a time.
   * So: log what the request actually declares, and log every choice that carries a mega suffix.
   * If canMegaEvo never appears, the request is the problem; if it appears and no choice follows,
   * the suffix is being lost between chooseMove and /choose. */
  if (line.startsWith('|request|')) {
    try {
      const rq = JSON.parse(line.slice(9));
      const act = rq.active || [];
      const flags = act.map((a, i) => `slot${i}:canMegaEvo=${a && a.canMegaEvo}`).join(' ');
      if (flags) console.log(`${room}: REQUEST ${flags}`);
    } catch (e) {}
  }
  /* HOLD THE TEAM-PREVIEW REQUEST UNTIL THE SHEETS ARRIVE.
   *
   * MILTANK picks its bring and lead by playing the matchup out against the OPPONENT'S ACTUAL TEAM,
   * which is the whole reason that search beats a usage prior. But Showdown asks for the preview
   * choice BEFORE it sends |showteam| -- two lines earlier, measured live:
   *
   *     4603  preview: no open sheet for the opponent -- falling back to default order
   *     4605  OPEN SHEETS ARE UP -- sets are visible
   *
   * So the biggest decision in the game was being answered two lines before the information needed
   * to answer it existed. The fallback said so out loud, which is the only reason it was caught.
   *
   * The request is buffered rather than the player changed: this file owns what enters the stream,
   * so holding one line needs no cooperation from BattlePlayer. Released the moment a sheet lands,
   * or after a timeout -- a bot that waits forever for a sheet that never comes is worse than one
   * that leads badly, and a closed-sheet game must still be played. */
  if (/^\|request\|/.test(line) && /teamPreview/i.test(line) && !st.ots && !st.previewHeld) {
    st.previewHeld = line;
    st.previewTimer = setTimeout(() => {
      if (st.previewHeld) { const l = st.previewHeld; st.previewHeld = null; st.stream.push(l);
        console.log(`${room}: no sheet after 6s — answering team preview blind`); }
    }, 6000);
    return;
  }
  if (st.previewHeld && st.ots) {
    clearTimeout(st.previewTimer);
    const held = st.previewHeld; st.previewHeld = null;
    console.log(`${room}: sheets are up — releasing team preview to MILTANK`);
    st.stream.push(held);
  }
  st.stream.push(line);

  {
    const th = (st.bot.stats && st.bot.stats.thoughts) || [];
    /* The window is fed whether or not --why is on: it is a separate surface and silencing the
     * terminal should not blank the page. */
    if (th.length > st.shown) {
      const fresh = th.slice(Math.max(0, th.length - 2));
      LATEST = { turn: fresh[fresh.length - 1].turn, room, decisions: fresh };
      for (const d of fresh) if (d.opts && d.opts.length) HISTORY.push(d.opts[0].p);
    }
  }
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

    /* SAVED IF AND ONLY IF THE SHEETS WERE OPEN. A closed-sheet game is thrown out rather than kept
     * with a flag, because a directory that quietly contains both is exactly the corpus that produced
     * the withdrawn 47.9% Sucker Punch claim — two populations, one name. The skip is COUNTED and
     * printed, so "no games today" and "twelve games, all discarded" cannot look the same. */
    try {
      const dir = D('data', 'live-games');
      if (st.ots) {
        fs.mkdirSync(dir, { recursive: true });
        const safe = room.replace(/[^a-z0-9-]/gi, '_');
        const meta = {
          room, bot: NAME, rollout: ROLLOUT,
          rolloutN: ROLLOUT_N, rolloutExplore: ROLLOUT_EXPLORE, rolloutTurns: ROLLOUT_TURNS,
          greedy: GREEDY, ots: true,
          started: st.started, ended: Date.now(), result: line.trim(),
        };
        fs.writeFileSync(path.join(dir, safe + '.json'),
          JSON.stringify({ meta, log: st.log || [] }, null, 1) + String.fromCharCode(10));
        /* The raw protocol too, which is what a Showdown replay IS — paste it into the client's
         * replay uploader and it plays back as a battle rather than as a wall of text. */
        fs.writeFileSync(path.join(dir, safe + '.log'), (st.log || []).join(String.fromCharCode(10)) + String.fromCharCode(10));
        SAVED.kept++;
        console.log(`  recorded -> data/live-games/${safe}.log  (${(st.log || []).length} lines)`);
      } else {
        SAVED.skipped++;
        console.log('  NOT recorded: this game had no open team sheets, so it is thrown out.');
      }
      console.log(`  games kept ${SAVED.kept}, discarded for no OTS ${SAVED.skipped}`);
    } catch (e) {
      /* Losing a recording is not worth losing the connection over, but it must not be silent —
       * a bot that quietly records nothing looks identical to a bot nobody has played. */
      console.error('  could not write the recording: ' + e.message);
    }

    st.stream.end();
    rooms.delete(room);
    send(`${room}|/leave`);
  }
}

connect();
