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
/* THE DOOR IS LOADED BESIDE THE TABLE, ALWAYS. engine/mc_key.js installs the SEAL on MC.mons --
 * a raw read of a key the table does not have then THROWS instead of returning undefined, which
 * is how the same species-key bug went unnoticed four separate times. Requiring it here is not
 * decoration: section 4 of tests/test-mc-key.js FAILS on any file that loads the table without
 * it, because a seal that depends on load order is a seal that is sometimes absent. */
require(D('engine', 'mc_key.js'));
const { makeScoringPlayer } = require('./magnemite.js');

/* ---- a team, from REAL observed sets ---------------------------------------------------------
 *
 * Built from data/species-sets.json — the joint sets people actually run, sampled by how often they
 * run them. Not a hand-written team: the point of that artifact is that nothing about a set is
 * invented, and a bot bringing fictional Pokemon into a real client would be the same failure the
 * engine-data rebuild removed. */
const SETS = require('./species_sets.js');
const DEX = CS.sim().Dex.forFormat(FORMAT);

function packTeam(seed) {
  /* THE VALIDATED PACKER ALREADY EXISTED, AND WRITING A SECOND ONE COST FOUR REJECTIONS.
   *
   * engine/champions_sim.js packTeam() validates against Showdown's own TeamValidator and REPAIRS
   * what it can, and it already knew everything my hand-rolled version had to learn the hard way:
   *
   *   Item Clause    VGC allows one of each item per team. Sampling items per species independently
   *                  made the validator reject 80.5% of a 200-team pool, 66 for a second Focus Sash.
   *   illegal moves  dropped and refilled from the behaviour-clone priors rather than the learnset,
   *                  because ~2.6 of 4 moves are unrevealed and whatever fills them dominates.
   *
   * My version instead discovered, one server rejection at a time: mainline EVs where Champions uses
   * STAT POINTS capped at 32, four mega stones on one team, and Species Clause deduped on the forme
   * key rather than the base species. Every one of those was already solved twenty lines away.
   *
   * This now picks the SPECIES (sampling real observed sets from data/species-sets.json, one mega,
   * distinct base species) and hands the rest to the packer that knows the rules. */
  let s = seed >>> 0;
  const rng = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) & 0x7fffffff) / 0x80000000;
  const pool = SETS.speciesWithDepth(50);
  if (pool.length < 6) throw new Error(`only ${pool.length} species have 50+ sheets; cannot build a team`);

  const isStone = (it) => /ite$|itex$|itey$/.test(String(it || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const names = [], usedBase = new Set(), setsBySpecies = {};
  let guard = 0;
  while (names.length < 6 && guard++ < 500) {
    const sp = pool[Math.floor(rng() * pool.length)];
    const d = DEX.species.get(sp);
    const base = (d && d.exists && d.baseSpecies) ? String(d.baseSpecies).toLowerCase() : sp;
    if (usedBase.has(base)) continue;                    // Species Clause is on the BASE species
    let set = SETS.sample(sp, rng);
    if (!set) continue;
    if (isStone(set.item) && names.some(n => isStone((setsBySpecies[n] || {}).item))) {
      let alt = null;
      for (let t = 0; t < 12 && !alt; t++) { const c = SETS.sample(sp, rng); if (c && !isStone(c.item)) alt = c; }
      if (!alt) continue;                                // essentially always mega; skip the species
      set = alt;
    }
    usedBase.add(base);
    names.push(sp);
    setsBySpecies[sp] = { moves: set.moves, item: set.item, ability: set.ability, nature: set.nature };
  }
  if (names.length < 6) throw new Error('could not assemble six distinct base species');

  const r = CS.packTeam(names, setsBySpecies);
  if (!r || !r.valid) {
    /* A FAILED DRAW IS NOT A REASON TO REFUSE THE CHALLENGE. Measured 2026-08-01: 11 of 40 draws
     * (27.5%) fail validation, so better than a quarter of Will's challenges were being rejected
     * outright for a dice roll. Redraw instead -- packTeam is deterministic in its seed, so a new
     * seed is a genuinely new team rather than the same one retried. Bounded, and it gives up loudly
     * rather than looping. */
    if ((packTeam.depth = (packTeam.depth || 0) + 1) <= 12) {
      const again = packTeam((seed * 2654435761 + 1013904223) >>> 0);
      packTeam.depth--;
      return again;
    }
    packTeam.depth = 0;
    /* Refuse rather than send a team the server will reject: a rejected accept leaves the challenger
     * staring at "Waiting for MAG..." with nothing said, which is exactly what happened four times. */
    throw new Error('team failed local validation: ' + ((r && r.problems) || ['unknown']).slice(0, 3).join(' | '));
  }
  console.log('  team: ' + names.join(', '));
  return r.packed;
}

/* ---- websocket plumbing ------------------------------------------------------------------------
 *
 * THE SOCKET IS OPENED ONLY WHEN THIS FILE IS RUN, NOT WHEN IT IS REQUIRED.
 *
 * It used to connect at module load, which made the whole file untestable: `require`ing it dialled a
 * server. So the ordering logic below -- which is protocol ordering, the exact thing that produced
 * the team-preview race -- could only ever be checked by playing a game by hand and reading a log,
 * which is how the race survived in the first place.
 *
 * `send` is swappable for the same reason: a test drives handle() with recorded protocol lines and
 * reads back what MAG would have sent, in order. */
const IS_MAIN = require.main === module;
const ws = IS_MAIN ? new WebSocket(SERVER) : null;
let sink = (msg) => { ws.send(msg); };
const players = new Map();          // roomid -> { player, rqid }
const otsSent = new Set();          // rooms where open team sheets have already been accepted

/* HOW LONG TO HOLD THE BRING WAITING FOR THE OPPONENT'S SHEET.
 *
 * Team preview has its own clock on the server and running it out forfeits, so this cannot wait
 * forever. 5s is a starting value, not a derived one: the sheets were observed arriving in the same
 * protocol burst as the request -- microseconds later, not seconds -- so this is a safety net for
 * the case where they never come at all, and any value comfortably under the preview timer would do.
 * It is a parameter (--sheet-wait) and is stated as one. */
const SHEET_WAIT_MS = +arg('sheet-wait', '5000');
const teamPreviewHeld = new Map();  // roomid -> { line, timer }
const bringStats = { held: 0, releasedOnSheet: 0, releasedOnTimeout: 0, notHeld: 0 };
let joined = false;

const send = (msg) => { sink(msg); if (process.env.ABRA_BOT_DEBUG) console.log('>> ' + msg); };

function feed(data) {
  data = String(data || '');
  let room = '';
  let body = data;
  if (data.startsWith('>')) {
    const nl = data.indexOf('\n');
    room = data.slice(1, nl < 0 ? data.length : nl);
    body = nl < 0 ? '' : data.slice(nl + 1);
  }
  for (const line of body.split('\n')) handle(room, line);
}

if (IS_MAIN) {
  ws.addEventListener('open', () => console.log(`connected to ${SERVER}`));
  ws.addEventListener('error', (e) => { console.error('websocket error:', e.message || e); process.exit(1); });
  ws.addEventListener('close', () => { console.error('socket closed'); process.exit(1); });
  ws.addEventListener('message', (ev) => feed(ev.data));
} else {
  module.exports = {
    feed, handle, players, otsSent, teamPreviewHeld, bringStats, SHEET_WAIT_MS,
    setSink: (fn) => { sink = fn; },
  };
}

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

  /* CHALLENGES ARRIVE AS A PM ON THIS SERVER, not only on updatechallenges. Observed live:
   *
   *   |pm| willhoop| MAG|/challenge gen9championsvgc2026regmb|gen9championsvgc2026regmb|||
   *
   * The first version listened for updatechallenges alone, so a real challenge sat in Will's client
   * saying "Waiting for MAG..." while the bot logged nothing at all. Both paths are handled now,
   * because which one a server uses is not something to assume. */
  if (cmd === 'pm') {
    const body = parts.slice(4).join('|');
    const m = /^\/challenge\s*([a-z0-9]*)/i.exec(body || '');
    if (!m) return;
    const from = String(parts[2] || '').replace(/^[^a-zA-Z0-9]+/, '').trim();
    const fmt = (m[1] || parts[5] || '').trim();
    if (!fmt) return;                                  // a cancelled challenge sends an empty format
    if (fmt !== FORMAT) {
      console.log('  declining ' + from + ': ' + fmt + ' is not ' + FORMAT);
      send('|/reject ' + from);
      return;
    }
    console.log('  accepting ' + from + ' in ' + fmt);
    try { send('|/utm ' + packTeam(Date.now() & 0x7fffffff)); }
    catch (e) { console.error('  cannot build a team: ' + e.message); send('|/reject ' + from); return; }
    send('|/accept ' + from);
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

  /* ACCEPT OPEN TEAM SHEETS, WHICH MAG WAS SILENTLY DECLINING BY NEVER ANSWERING.
   *
   * Will, 2026-08-01, mid-battle: "dont u need my open team sheet". He was right. The server offers
   * it as a uhtml button and waits:
   *
   *     |uhtml|otsrequest|<button name="send" value="/acceptopenteamsheets" ...>
   *
   * Nothing in the bot answered, so MAG played the whole battle knowing only the six SPECIES from
   * team preview -- and it chose its bring at rqid 3 before any sheet could have arrived. That guts
   * the model: magnemite.js:430 parses |showteam| specifically to fill in the opponent's real sets,
   * and every open-sheet artifact this project is built on (data/species-sets.json, the covariate
   * reweighting from open-sheet to closed-sheet play) assumes those sets are known.
   *
   * Answered once per room -- the server re-sends the uhtml on rejoin, and a second /accept is an
   * error line rather than a no-op. */
  if (cmd === 'uhtml' && parts[2] === 'otsrequest') {
    if (!otsSent.has(room)) {
      otsSent.add(room);
      console.log('  accepting open team sheets in ' + room);
      send(`${room}|/acceptopenteamsheets`);
    }
    return;
  }

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
    /* joint: THE TWO SLOTS HAD NO IDEA WHAT EACH OTHER WERE DOING.
     *
     * magnemite.js defaults `this.joint = false`, so without this option each slot is scored on its
     * own 56 features and the pair is just the two independent argmaxes. Will, 2026-08-01: "two light
     * screens on the same turn? bro" -- Klefki set Light Screen, Grimmsnarl set Light Screen, and the
     * server answered "But it failed!". Neither slot was wrong on its own; there was nothing in the
     * scoring that could see the other one.
     *
     * `deadSide` is the most negative weight in the whole vector (-2.879) and could not help: it asks
     * whether the side condition is ALREADY UP, and on that turn it was not up yet for either.
     * Turn-simultaneity is precisely what the 18 pair features exist for.
     *
     * KNOWN GAP, STATED: this is necessary and may not be sufficient. The pair features cover
     * bothSameTarget, bothStatus and bothSwitch, but NONE of them is "both slots set the same side
     * condition", so the exact Light Screen case may still have no term that fires. Enabling this is
     * also UNMEASURED in the greedy configuration -- the joint fit exists, but no H2H has compared
     * joint-on against joint-off for a greedy player. */
    /* switching IS OFF BECAUSE IT WAS ALREADY MEASURED AS A LOSS, AND I SHIPPED IT ANYWAY.
     *
     * mew.js:135 states the verdict plainly: "--switching  let MAG choose to switch. Measured as a
     * 10-point LOSS against a random opponent, so it is off until the switch policy is worth more
     * than not switching." mew therefore requires an explicit --switching flag and defaults it off.
     *
     * This file asked for it in its very first version. It had no effect until the options merge
     * landed on 2026-08-01, so its first live outing was that same evening: MAG won the game where
     * its only switch was a forced post-KO replacement, and lost the game where it chose to switch
     * four times. That is one game each and proves nothing on its own -- but there is no need for it
     * to prove anything, because the lever was measured at -10 points before tonight and nothing has
     * re-measured it since. Turning it on was an unmeasured change against a measured verdict.
     *
     * Post-KO replacements are a DIFFERENT lever (forcedSwitch, also off) and are unaffected: when a
     * Pokemon faints, passing is not a legal choice, so the 10-point verdict does not apply there. */
    const Player = makeScoringPlayer({ greedy: true, joint: true });
    entry = { player: new Player(stream), rqid: '' };
    players.set(room, entry);
    console.log(`  battle started: ${room}`);
  }

  if (cmd === 'request') {
    try {
      const r = JSON.parse(parts.slice(2).join('|'));
      entry.rqid = r && r.rqid != null ? r.rqid : '';
      /* WHICH SIDE MAG IS, READ HERE RATHER THAN ASKED OF THE PLAYER.
       *
       * magnemite.js:655 sets this.me from the FIRST REQUEST it receives -- and the first request is
       * the team-preview one, which is exactly the line being held below. Asking the player would
       * therefore always get null, sheetSeenForFoe would never be able to name the foe, and every
       * bring would sit out the full timeout and then go blind: the original bug, slower. */
      if (!entry.mySide && r && r.side && r.side.id) entry.mySide = r.side.id;
    } catch (e) { console.error('  (unparseable request)'); }
  }

  /* ---- THE TEAM-PREVIEW RACE ------------------------------------------------------------------
   *
   * Will: "like how does it choose its pokemon before team sheet selection". Measured off the live
   * protocol log of battle 26, in this order:
   *
   *     |teampreview
   *     acceptopenteamsheets
   *     /choose team 4251        <- MAG commits its four
   *     showteam|p1              <- the opponent's sheet arrives
   *     showteam|p2
   *
   * So MAG agreed to open team sheets, and then answered before reading one. The information landed
   * after the decision it was supposed to inform. Nothing was broken in a way that errors -- the bot
   * simply chose in the dark and the sheet turned up a moment later.
   *
   * The fix is to hold the team-preview REQUEST rather than to hurry the sheets: the request is what
   * makes the player answer, so not delivering it yet is the whole mechanism. Everything else,
   * |showteam| included, is forwarded as it arrives, so by the time the request is released the
   * player's board already has the opponent's sets.
   *
   * WHAT THIS DOES AND DOES NOT BUY. It makes the sheet AVAILABLE at the moment of the decision. It
   * does not make the decision use it: prior_player.js chooseTeamPreview(team) still takes only its
   * own team and samples per-species marginals, so today MAG will read the sheet and ignore it. This
   * is a precondition for an opponent-aware bring, not the bring itself, and it is worth having on
   * its own because the same sheets feed the in-battle model.
   *
   * THE FALLBACK IS COUNTED, not silent. A bring chosen without the sheet is a different decision
   * from one chosen with it, and a run where that happened every time must not be indistinguishable
   * from a run where it never did. */
  if (cmd === 'win' || cmd === 'tie') {
    console.log(`  battle over: ${line.slice(1)}`);
    /* A room that ends mid-hold must not leave a timer pointing at a deleted player. */
    const h = teamPreviewHeld.get(room);
    if (h) { clearTimeout(h.timer); teamPreviewHeld.delete(room); }
    players.delete(room);
    send(`${room}|/leave`);
    return;
  }

  if (cmd === 'request' && /"teamPreview"\s*:\s*true/.test(line) && otsSent.has(room)
      && !teamPreviewHeld.has(room) && !sheetSeenForFoe(room, entry)) {
    const timer = setTimeout(() => {
      const h = teamPreviewHeld.get(room);
      if (!h) return;
      teamPreviewHeld.delete(room);
      bringStats.releasedOnTimeout++;
      console.log(`  WAITED ${SHEET_WAIT_MS}ms AND NO OPPONENT SHEET ARRIVED — bringing blind in ${room} `
        + `(${bringStats.releasedOnTimeout} of ${bringStats.held} held brings so far)`);
      deliver(room, h.line);
    }, SHEET_WAIT_MS);
    if (timer.unref) timer.unref();
    teamPreviewHeld.set(room, { line, timer });
    bringStats.held++;
    console.log(`  holding the bring in ${room} until the opponent's sheet arrives`);
    return;                                    // deliberately NOT delivered yet
  }

  try { entry.player.receiveLine(line); }
  catch (e) { console.error(`  player error in ${room}: ${e.message}`); }

  /* Released here, AFTER the |showteam| line above has reached the player, so the board it decides
   * against actually contains the sets. Releasing before would reproduce the original bug with extra
   * steps. */
  if (cmd === 'showteam' && teamPreviewHeld.has(room) && sheetSeenForFoe(room, entry)) {
    const h = teamPreviewHeld.get(room);
    teamPreviewHeld.delete(room);
    clearTimeout(h.timer);
    bringStats.releasedOnSheet++;
    console.log(`  opponent sheet seen — releasing the bring in ${room}`);
    deliver(room, h.line);
  }
  return;
}

/* Has the FOE's sheet landed? The player tracks sheets on its board, so this asks the board rather
 * than keeping a second copy of the same fact in this file. MAG's own side is whichever one the
 * request said it was; before that is known, nothing can be judged and the answer is no. */
function sheetSeenForFoe(room, entry) {
  const p = entry && entry.player;
  if (!entry || !entry.mySide || !p || !p.board || !p.board.sheet) return false;
  const foe = entry.mySide === 'p1' ? 'p2' : 'p1';
  return Object.keys(p.board.sheet[foe] || {}).length > 0;
}

function deliver(room, line) {
  const entry = players.get(room);
  if (!entry) return;
  try { entry.player.receiveLine(line); }
  catch (e) { console.error(`  player error in ${room}: ${e.message}`); }
}

