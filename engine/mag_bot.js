/* mag_bot.js — put MAG on a real Pokémon Showdown server, so you can challenge it in the client.
 *
 *   1.  cd <pokemon-showdown>  &&  node pokemon-showdown start --no-security
 *   2.  SHOWDOWN_PATH=... node engine/mag_bot.js
 *   3.  open http://localhost:8000, pick a name, and challenge "MAG"
 *
 *   --name <n>      what it logs in as (default MAG)
 *   --server <url>  default ws://localhost:8000/showdown/websocket
 *   --pass <p>      account password, for a PUBLIC server (or set SHOWDOWN_PASS)
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
const PASS = arg('pass', process.env.SHOWDOWN_PASS || '');
const LOGIN_URL = arg('login-url', 'https://play.pokemonshowdown.com/api/login');
const GREEDY = process.argv.includes('--greedy');
const SWITCHING = process.argv.includes('--switching');
/* --mega p  probability of taking a mega evolution when one is available. Matches mew.js's default
 * so the bot you challenge is the bot that was trained and measured. NOTE this is a coin flip in
 * the BASE player, not a decision: no feature in board.js scores mega TIMING, so MAG megas at
 * random rather than choosing when. Making it a real choice is a separate piece of work. */
const MEGA_P = parseFloat(arg('mega', '1'));
const WHY = process.argv.includes('--why');
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
const ROLLOUT = process.argv.includes('--rollout');
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

  if (cmd === 'updateuser' && String(p[2] || '').replace(/^[ !@#$%^&*]/, '') === NAME) {
    loggedIn = true;
    console.log(`logged in as ${NAME} — challenge it from the client`);
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
    const m = /^\/challenge\s+(\S+)/.exec(payload);
    if (!m || !from || from === NAME) return;
    const fmt = m[1];
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

  if (!room.startsWith('battle-')) return;

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
      const RL = require('./rollout_leaf.js');
      /* The real dex, not undefined. dmgMon uses it to resolve the EFFECTIVE ability — a mega's
       * own ability rather than the sheet's pre-mega one — and Huge Power doubles Attack. */
      const DEX = CS.sim().Dex.forFormat(CS.FORMAT);
      const base = bot.chooseMove.bind(bot);
      bot._rolloutPick = null;
      bot._rolloutReq = null;
      bot.chooseMove = function (active, moves) {
        try {
          const req = this._req;
          const acts = (req && req.active) || [];
          const i = acts.indexOf(active);
          /* The partner's half, decided on the other slot's call. */
          if (this._rolloutReq === req && this._rolloutPick && this._rolloutPick[i] != null) {
            const pick = this._rolloutPick[i]; this._rolloutPick[i] = null;
            return pick;
          }
          /* Singles-shaped requests, forced switches and anything with one slot fall through to MAG:
           * the pair logic below assumes two live slots and would otherwise index undefined. */
          if (acts.length < 2 || i < 0 || (req && req.forceSwitch)) return base(active, moves);

          const side = this.me || 'p1';
          const board = this.board;
          /* THE BOARD DOES NOT KNOW THE TEAM IN LIVE PLAY, and nothing said so.
           *
           * `setParty` is called by fit_policy, joint_rows and the other OFFLINE walkers and by
           * nothing in magnemite, so `board.bench()` returns [] for the whole battle. MAG never
           * noticed because it builds switch candidates from the REQUEST instead — two candidate
           * builders, and only one of them is fed here.
           *
           * The seeder reads the board, so every rollout was judging a 2v2 with empty benches: a
           * switch had no body to bring in, the forced click was skipped, and the slot quietly fell
           * back to the playout policy. That is why every switch scored the same and the search
           * took one every turn. Diagnosed from the timing — 1,000 playouts in 10ms is not a fast
           * rollout, it is a battle that ended before turn 1.
           *
           * Filled from the request, which is authoritative about what this side actually brought. */
          const reqMons = (req.side && req.side.pokemon) || [];
          if (reqMons.length && !(board.party && (board.party[side] || []).length)) {
            const species = reqMons
              .map(m => String(m.details || m.ident || '').split(',')[0].trim())
              .filter(Boolean);
            if (species.length) board.setParty(side, species);
          }
          /* THE OPPONENT'S SIDE TOO, or the rollout plays my four against their two and reports 100%
           * for every option — which is exactly what it did, and an argmax over ties is a coin flip
           * that looked like a decision to switch every turn.
           *
           * `showteam` already fills board.sheet with all SIX of their Pokemon (magnemite.js:509) and
           * never touches the party, so the information was there and unused. Capped at four, because
           * six would bias the other way just as hard: this is a bring-four format and a 4v6 rollout
           * is not the game either. Revealed bodies go first — those are known to be brought — and the
           * rest fills from the sheet, which is a GUESS about which four they chose and is stated as
           * one rather than presented as knowledge. */
          const foeS = side === 'p1' ? 'p2' : 'p1';
          /* THE OPPONENT'S FOUR, from the open sheet. Will is running OTS-only, so their team is
           * public — which is the whole reason this is answerable at all.
           *
           * Capping MY side to their revealed count was tried and was worse: it emptied my bench, so
           * every switch candidate had no body to resolve to and the search ranked options that could
           * not happen (480 unresolved clicks in one turn). Symmetric ignorance is not better than
           * asymmetric knowledge when the asymmetry is the thing being searched over.
           *
           * Revealed bodies first — those are known to have been brought — then filled from the sheet
           * to four. The fill is a GUESS about which four of six they chose and is one of the two
           * things most likely to be wrong about this bot's judgement. */
          if (!(board.party && (board.party[foeS] || []).length)) {
            const seen = ['a', 'b'].map(L => board.slot(foeS, L)).filter(Boolean).map(m => m.species);
            const sheetSp = Object.keys((board.sheet && board.sheet[foeS]) || {});
            const foeParty = [];
            for (const sp of seen.concat(sheetSp)) {
              if (sp && !foeParty.includes(sp) && foeParty.length < 4) foeParty.push(sp);
            }
            if (foeParty.length) board.setParty(foeS, foeParty);
          }
          const built = ['a', 'b'].map((L, k) => {
            const a2 = acts[k];
            const user = board.slot(side, L);
            if (!user || user.fainted || !a2) return null;
            const b2 = this._candsFor(k === i ? active : a2, (a2.moves || moves), k);
            return b2 && b2.cands && b2.cands.length ? b2 : null;
          });
          if (!built[0] || !built[1]) return base(active, moves);

          const field = {
            weather: board.weather || '',
            terrain: ['electric', 'grassy', 'misty', 'psychic'].find(t => board.hasField(t)) || '',
            tr: board.hasField('trickroom') ? 5 : 0,
            twA: board.hasSide(side, 'tailwind') ? 4 : 0,
            twB: board.hasSide(side === 'p1' ? 'p2' : 'p1', 'tailwind') ? 4 : 0,
          };
          /* THE CANDIDATE SHAPE HERE IS MAGNEMITE'S, NOT BOARD.JS'S, and I used the wrong one.
           *
           *   `targetLetter` does not exist on these — that is board.js's `candidates()` shape, used
           *   by rollout_r3. _candsFor carries `targetMon`, a board mon, so the slot is derived by
           *   asking which foe slot holds it. Reading the absent field silently aimed every move at
           *   the first live foe, which collapses "Fake Out the left one" and "Fake Out the right
           *   one" into one candidate.
           *
           *   `move` can be NULL without being a switch: magnemite.js:682 pushes a candidate with
           *   move:null for anything the dex does not recognise. Its own scorer guards this at line
           *   860 (`if (!c.move && !c.switchTo)`) and I did not, which threw on every single turn —
           *   the fallback then played the whole game as MAG while printing one line per decision. */
          const foeSide = side === 'p1' ? 'p2' : 'p1';
          const letterOf = (tm) => {
            if (!tm) return '';
            for (const L of ['a', 'b']) if (board.slot(foeSide, L) === tm) return L;
            return '';
          };
          const clickOf = (c) => {
            if (c.switchTo) return { switchTo: c.switchTo };
            if (!c.move) return null;
            return { move: c.move.id, targetLetter: letterOf(c.targetMon) };
          };
          /* EVERY CANDIDATE, NOT A TOP-K.
           *
           * The first version pruned to the best K per slot — except `_candsFor` returns no scores,
           * so it was taking the first three in array order and calling that the best three. That is
           * worse than not pruning at all: an arbitrary shortlist that LOOKS principled.
           *
           * Enumerating everything also deletes the ceiling engine/truncation_curve.js measured — at
           * K=3 the pair a human clicked falls outside the window 52% of the time, and a search
           * cannot recover value from a branch it never enumerated. The corpus median is 8 options a
           * slot, so ~64 pairs; at ROLLOUT_N=200 that is well inside a Showdown turn timer, and the
           * elapsed cost is printed every decision so it is visible if a board is unusually wide. */
          /* ONE-TIME SANITY LINE. A rollout that returns in microseconds has not played anything,
           * and the win rate it reports is about a battle that ended before turn 1. Printing what the
           * seeder actually built is the difference between "the search prefers switching" and "the
           * search is scoring an empty board". */
          if (!this._rolloutChecked) {
            this._rolloutChecked = true;
            const probe = RL.rolloutWinProb(board, side, { n: 3, dex: DEX, explore: 1.0, field, seed: 1 });
            console.log('  rollout seed check: ' + (probe
              ? `${probe.built} bodies built, dropped ${JSON.stringify(probe.dropped)}, p=${probe.p}`
              : 'NULL — a side could not be built at all'));
            console.log('  my bench: [' + board.bench(side).join(', ') + ']  foe bench: [' +
              board.bench(side === 'p1' ? 'p2' : 'p1').join(', ') + ']');
            /* THE ASYMMETRY IS REPORTED, NOT HIDDEN. I know my whole team from the request; the
             * opponent's bench is only what has been revealed. So the rollout is optimistic by
             * construction — it plays my four against however many of theirs are known — and that
             * bias favours anything that survives to a later turn, switching included. Stated here
             * because a bot that thinks it is ahead switches for the wrong reason. */
          }
          const oa = built[0].cands.map((c, idx) => idx);
          const ob = built[1].cands.map((c, idx) => idx);
          let bestVal = -1, bestPair = null, _res = 0, _unres = 0;
          const t0 = Date.now();
          for (const ia of oa) for (const ib of ob) {
            const ca2 = built[0].cands[ia], cb2 = built[1].cands[ib];
            /* TWO SLOTS CANNOT SWITCH TO THE SAME BODY. magnemite guards this at line 931 as a
             * property of the PAIR, and skipping the guard produced exactly what it prevents:
             * "switch delphox + switch delphox", an illegal pair the search happily ranked first
             * because MEDICHAM's bringIn just hands the same Pokemon to whichever slot asks first
             * and the second slot silently gets nothing. An illegal cell that EVALUATES is worse
             * than one that throws. */
            if (ca2.switchTo && cb2.switchTo && ca2.choice === cb2.choice) continue;
            const ka = clickOf(ca2), kb = clickOf(cb2);
            /* A candidate this engine cannot express is SKIPPED, not approximated — offering the
             * search a cell it will silently resolve as something else is worse than a smaller menu. */
            if (!ka || !kb) continue;
            const v = RL.rolloutAfterActions(board, side, {
              n: ROLLOUT_N, dex: DEX, explore: ROLLOUT_EXPLORE, field, maxTurns: ROLLOUT_TURNS,
              seed: (Date.now() & 0xffff) * 7919 + ia * 31 + ib,
              myClicks: [ka, kb],
              report: (r) => { if (r.unresolved) _unres += r.unresolved; else _res += r.resolved; },
            });
            if (v === null) continue;
            if (v > bestVal) { bestVal = v; bestPair = [ia, ib]; }
          }
          if (!bestPair) return base(active, moves);
          const ms = Date.now() - t0;
          const chosen = [built[0].cands[bestPair[0]], built[1].cands[bestPair[1]]];
          console.log(`  rollout: ${chosen.map(c => c.switchTo ? 'switch ' + c.switchTo : c.move.id).join(' + ')}` +
            `  win ${(100 * bestVal).toFixed(0)}%  (${oa.length * ob.length} opts, ${ms}ms, sw resolved ${_res}/unres ${_unres})`);
          this._rolloutReq = req;
          this._rolloutPick = [];
          this._rolloutPick[1 - i] = chosen[1 - i].choice;
          return chosen[i].choice;
        } catch (e) {
          /* NEVER FORFEIT A LIVE BATTLE OVER A SEARCH BUG. Falling back to MAG is a worse move, not a
           * lost game — and the reason is printed so it is fixable rather than mysterious. */
          /* The first stack frame too: 'Cannot read properties of null' names a symptom and not
           * a site, and the fallback means this can otherwise repeat silently every turn of
           * every game while the bot quietly plays as MAG. */
          const at = (String(e.stack || '').split('\n')[1] || '').trim();
          console.error('  rollout failed, falling back to MAG: ' + e.message + (at ? ' | ' + at : ''));
          return base(active, moves);
        }
      };
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
  /* The one moment it is legal to agree. */
  if (line.startsWith('|teampreview')) {
    send(`${room}|/acceptopenteamsheets`);
    console.log(`${room}: agreeing to open team sheets`);
  }
  if (line.startsWith('|showteam|')) {
    if (st) st.ots = true;
    console.log(`${room}: OPEN SHEETS ARE UP — sets are visible`);
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
