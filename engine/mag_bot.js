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
/* --mega p  probability of taking a mega evolution when one is available. Matches mew.js's default
 * so the bot you challenge is the bot that was trained and measured. NOTE this is a coin flip in
 * the BASE player, not a decision: no feature in board.js scores mega TIMING, so MAG megas at
 * random rather than choosing when. Making it a real choice is a separate piece of work. */
const MEGA_P = parseFloat(arg('mega', '0.85'));
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

const ws = new WebSocket(SERVER);
const send = (s) => ws.send(s);
/* Rooms are tracked so two simultaneous challenges do not share a player object — each battle gets
 * its own MAG with its own board, which is the same isolation MEW gets per game. */
const rooms = new Map();
/* A running record across the session. The reason a person plays this bot is to find out how badly
 * they beat it, and a number nobody is keeping is a number nobody will remember. */
const RECORD = { you: 0, mag: 0, tie: 0 };

/* IF THE NAME IS ALREADY TAKEN, SAY SO. LOUDLY.
 *
 * Two bot processes cannot both be MAG. The server hands the name to one and silently refuses the
 * other, which then sits there connected, logged in as nobody, ignoring every challenge -- and looks
 * exactly like a broken bot. That cost twenty minutes tonight. A connection that has not acquired
 * its name within five seconds is a failure and now announces itself as one. */
let loggedIn = false;
setTimeout(() => {
  if (!loggedIn) {
    console.error(`
  COULD NOT BECOME "${NAME}" — almost certainly another instance already has it.`);
    console.error('  Close the other one, or run this with a different name:');
    console.error(`      node engine/mag_bot.js --name ${NAME}2
`);
  }
}, 5000);

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
    const bot = new Player(stream, { greedy: GREEDY, switching: SWITCHING, /* ALWAYS ON, not gated behind --why.
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
    bot.start();
    rooms.set(room, { stream, bot, shown: 0 });
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
  if (line.startsWith('|showteam|')) console.log(`${room}: OPEN SHEETS ARE UP — sets are visible`);
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
    st.stream.end();
    rooms.delete(room);
    send(`${room}|/leave`);
  }
}
