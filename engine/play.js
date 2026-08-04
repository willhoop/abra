/* play.js — play a real game against MAG, in the terminal.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/play.js
 *   node engine/play.js --why            show what MAG was thinking each turn
 *   node engine/play.js --greedy         MAG takes its best move instead of rolling
 *   node engine/play.js --switching      let MAG switch (measured as a 10-point loss, off by default)
 *   node engine/play.js --seed 12345     replay the exact same game
 *
 * WHY THIS EXISTS
 * ---------------
 * Every number in this project comes from bots playing bots. That is the only way to get the volume,
 * and it has a blind spot no amount of volume fixes: a bot opponent cannot notice that MAG never
 * switches, never plays around a Protect, and presses the same buttons whether it is facing a
 * champion or a random number generator. A person notices in about four turns.
 *
 * The engine is the same pinned Champions simulator that generates every corpus, the teams are real
 * ladder teams, and the bot is the same engine/magnemite.js that played the 60,000 games measured
 * tonight. Nothing here is a demo version.
 *
 * --why is the part worth having. MAG scores every option it can see, and those scores are normally
 * discarded the instant a move is chosen. With --why they are printed: every option, and the chance
 * it had of being picked. Watching it rate a move you can see is terrible is the fastest way to find
 * a feature that is wrong, and faster than any audit in this repository.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CS = require('./champions_sim.js');
const B = require('./board.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
/* THE OVERLAY IS ON BY DEFAULT AND TOGGLEABLE WITH `w`.
 *
 * This is a play interface and the reason to play the bot at all is to catch it doing something
 * plainly wrong -- an untaken KO, a Protect into nothing. Hiding its reasoning behind a flag makes
 * the tool worse at its only job. It prints once YOU have already committed, so it can never tell
 * you what is coming. --quiet starts it off. */
let WHY = !process.argv.includes('--quiet');
const GREEDY = process.argv.includes('--greedy');
const SWITCHING = process.argv.includes('--switching');
const SEED = parseInt(arg('seed', String(Math.floor(Math.random() * 1e8))), 10);

const { BattleStream, getPlayerStreams, Teams } = CS.sim();
const { realTeams } = require('./mew.js');

/* ---- presentation ---------------------------------------------------------------------------- */
const C = { dim: '\x1b[2m', b: '\x1b[1m', r: '\x1b[0m', y: '\x1b[33m', g: '\x1b[32m', c: '\x1b[36m', red: '\x1b[31m' };
const pretty = s => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2');
const bar = (frac) => {
  const n = Math.max(0, Math.min(20, Math.round(20 * frac)));
  const col = frac > 0.5 ? C.g : frac > 0.2 ? C.y : C.red;
  return col + '█'.repeat(n) + C.dim + '░'.repeat(20 - n) + C.r;
};

/* The protocol lines worth showing a human. Everything else is bookkeeping and would bury the game
 * in noise -- this is a play interface, not a debugger. */
function render(line) {
  const p = line.split('|').slice(1);
  const nm = s => pretty(String(s || '').replace(/^p[12][a-c]: /, ''));
  switch (p[0]) {
    case 'turn': return `\n${C.b}${C.c}── turn ${p[1]} ──${C.r}`;
    case 'move': return `  ${nm(p[1])} used ${C.b}${p[2]}${C.r}${p[3] ? ' on ' + nm(p[3]) : ''}`;
    case 'switch': case 'drag': return `  ${C.c}${nm(p[1])} → ${pretty(String(p[2] || '').split(',')[0])}${C.r}`;
    case 'faint': return `  ${C.red}${nm(p[1])} fainted${C.r}`;
    case '-damage': case '-heal': return `    ${nm(p[1])}  ${p[2]}`;
    case '-supereffective': return `    ${C.g}super effective${C.r}`;
    case '-resisted': return `    ${C.dim}resisted${C.r}`;
    case '-immune': return `    ${C.dim}no effect${C.r}`;
    case '-miss': return `    ${C.y}missed${C.r}`;
    case '-crit': return `    ${C.y}critical hit${C.r}`;
    case '-status': return `    ${nm(p[1])} is ${p[2]}`;
    case '-weather': return p[1] === 'none' ? '    weather cleared' : `    ${C.c}${p[1]}${C.r}`;
    case '-fieldstart': return `    ${C.c}${String(p[1] || '').replace('move: ', '')}${C.r}`;
    case '-sidestart': return `    ${C.c}${String(p[2] || '').replace('move: ', '')}${C.r}`;
    case '-activate': case '-ability': return `    ${C.dim}${nm(p[1])}: ${p[2]}${C.r}`;
    case 'win': return `\n${C.b}${p[1]} wins.${C.r}`;
    case 'tie': return `\n${C.b}It is a tie.${C.r}`;
    default: return null;
  }
}

/* ---- the human ------------------------------------------------------------------------------- */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(res => rl.question(q, res));
/* ---- MENU: ARROW KEYS OR TYPING, WHICHEVER YOU REACH FOR --------------------------------------
 *
 * Typing a number is fastest once you know the list; arrows are better when you are reading it. The
 * two are not in tension, so both work: up/down (or w/s, or j/k) to move, Enter to take it, or just
 * press the number. `t` toggles MAG's reasoning at any menu.
 *
 * Raw mode is entered only for the duration of one menu and always restored, including on Ctrl-C --
 * a terminal left in raw mode after a crash stops echoing what you type, which is a miserable thing
 * to do to somebody's shell. */
function menu(title, items) {
  return new Promise((resolve) => {
    let cur = 0;
    const draw = (first) => {
      if (!first) process.stdout.write(`[${items.length}A`);
      items.forEach((it, i) => {
        const sel = i === cur;
        const mark = sel ? `${C.c}›${C.r}` : ' ';
        const label = sel ? `${C.b}${it.label}${C.r}` : it.label;
        process.stdout.write(`[2K  ${mark} ${C.dim}${i + 1}.${C.r} ${label}
`);
      });
    };
    console.log(`
${C.b}${title}${C.r}   ${C.dim}↑↓ or type a number · enter · t = MAG's scores${C.r}`);
    draw(true);

    const done = (v) => {
      process.stdin.setRawMode(false);
      process.stdin.removeListener('keypress', onKey);
      process.stdin.pause();
      resolve(v);
    };
    const onKey = (ch, key) => {
      if (key && key.ctrl && key.name === 'c') { process.stdin.setRawMode(false); process.exit(0); }
      if (key && (key.name === 'up' || key.name === 'k')) { cur = (cur - 1 + items.length) % items.length; draw(); return; }
      if (key && (key.name === 'down' || key.name === 'j')) { cur = (cur + 1) % items.length; draw(); return; }
      if (ch === 't') { WHY = !WHY; process.stdout.write(`  ${C.dim}MAG's scores ${WHY ? 'ON' : 'off'}${C.r}
`); draw(true); return; }
      if (ch && /^[1-9]$/.test(ch)) {
        const n = parseInt(ch, 10) - 1;
        if (n < items.length) { cur = n; draw(); return done(items[cur]); }
        return;
      }
      if (key && (key.name === 'return' || key.name === 'enter' || key.name === 'space')) return done(items[cur]);
    };
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKey);
  });
}

/* One prompt handles the toggle, so every input point supports it without repeating the check. */
async function askOpt(q) {
  for (;;) {
    const a = (await ask(q)).trim().toLowerCase();
    if (a === 'w') { WHY = !WHY; console.log(`   ${C.dim}MAG's scores ${WHY ? 'ON' : 'off'}  (press w again to flip)${C.r}`); continue; }
    return a;
  }
}
/* Printed by the human player the instant its own choice is locked in -- MAG has already decided by
 * then, so nothing here is a leak, and you see what it was weighing before watching it resolve. */
function showThoughts(bot, state) {
  const th = (bot && bot.stats && bot.stats.thoughts) || [];
  if (!WHY || th.length <= state.shown) { state.shown = th.length; return; }
  console.log(`
  ${C.dim}── what MAG is weighing ──${C.r}`);
  for (let i = state.shown; i < th.length; i++) {
    const d = th[i];
    console.log(`  ${C.b}${pretty(d.mon)}${C.r}`);
    for (const o of d.opts.slice(0, 6)) {
      const p = 100 * o.p;
      const b2 = C.dim + '▖'.repeat(Math.max(0, Math.round(p / 5))) + C.r;
      console.log(`    ${(p.toFixed(0) + '%').padStart(4)}  ${b2} ${o.mv}${o.tgt ? ' → ' + pretty(o.tgt) : ''}`);
    }
  }
  state.shown = th.length;
}

let theirsSix = [];
/* THE TEAM SHEETS, ALWAYS ON.
 *
 * This is an open-team-sheet format: both players see all six sets, items, abilities and moves
 * before the first turn. Hiding that behind a toggle would make this interface HARDER than the real
 * game, and every judgement about whether MAG misplayed depends on knowing what it had available.
 * Only the SCORES toggle — those are the model's private reasoning and are genuinely extra. */
const SHEETS = { you: [], mag: [] };
function setLine(st) {
  const it = st.item ? '@ ' + st.item : '';
  const tail = [it, st.ability, st.nature].filter(Boolean).join(' · ');
  return C.b + pretty(st.species || st.name) + C.r + '  ' + C.dim + tail + C.r + '\n' +
         '        ' + C.dim + (st.moves || []).join('  ·  ') + C.r;
}
function printSheets() {
  for (const [who, label] of [['you', 'YOUR TEAM'], ['mag', "MAG'S TEAM"]]) {
    if (!SHEETS[who].length) continue;
    console.log('\n' + C.b + C.c + label + C.r);
    for (const st of SHEETS[who]) console.log('   ' + setLine(st));
  }
}
/* Shown at every decision: your active pair in full, and MAG's whole six, because on an open sheet
 * that is public and it is what you are actually deciding against. */
function printActive(req) {
  const act = (req.side.pokemon || []).filter(p2 => p2.active)
    .map(p2 => String(p2.details || '').split(',')[0].toLowerCase());
  const find = nm => SHEETS.you.find(st => String(st.species || st.name).toLowerCase() === nm);
  const rows = act.map(find).filter(Boolean);
  if (rows.length) {
    console.log(C.dim + '   ── your sets ──' + C.r);
    for (const st of rows) console.log('   ' + setLine(st));
  }
  if (SHEETS.mag.length) {
    console.log(C.dim + "   ── MAG's six (open sheet) ──" + C.r);
    for (const st of SHEETS.mag) console.log('   ' + setLine(st));
  }
}
function humanPlayer(BattlePlayer) {
  return class Human extends BattlePlayer {
    constructor(stream, opts = {}, debug = false) { super(stream, debug); this.side = null; }
    receiveLine(line) {
      if (line.startsWith('|request|')) return super.receiveLine(line);
      const out = render(line);
      if (out !== null) console.log(out);
      return super.receiveLine(line);
    }
    async receiveRequest(req) {
      if (req.wait) return;
      this.side = req.side;

      /* THE BOARD, BEFORE THE MENU. A choice made without seeing what is on the field is not a
       * choice; the first version printed only the move list and was unplayable. */
      const mine = (req.side.pokemon || []).filter(p => p.active);
      console.log(`\n${C.b}your side${C.r}`);
      for (const p of mine) console.log(`   ${pretty(String(p.details || '').split(',')[0]).padEnd(20)} ${bar(hpOf(p))}  ${p.condition}`);
      if (!req.teamPreview) printActive(req);

      /* TEAM PREVIEW IS A REQUEST TOO, and the first version fell through it into the move loop and
       * sent an empty choice. In this format you bring FOUR of six and the first two lead. */
      if (req.teamPreview) {
        console.log(`
${C.b}team preview — bring four, first two lead${C.r}`);
        console.log(`   ${C.dim}MAG's six: ${theirsSix.join(', ')}${C.r}`);
        /* Four sequential picks rather than one typed string: the order IS the lead order, and a
         * four-digit blob is easy to get backwards. Each pick removes itself from the next list. */
        const pool = (req.side.pokemon || []).map((p, k) => ({
          label: pretty(String(p.details || '').split(',')[0]), idx: k,
        }));
        const order = [];
        const slotName = ['lead 1', 'lead 2', 'back 1', 'back 2'];
        for (let k = 0; k < 4; k++) {
          const left = pool.filter(o => !order.includes(o.idx));
          const got = await menu(`${slotName[k]}`, left);
          order.push(got.idx);
        }
        return this.choose('team ' + order.map(i => i + 1).join(''));
      }

      const choices = [];
      if (req.forceSwitch) {
        for (const [i, s] of (req.forceSwitch || []).entries()) {
          if (!s) { choices.push('pass'); continue; }
          console.log(`\n${C.b}send something in${C.r}`);
          const bench = (req.side.pokemon || [])
            .map((p, idx) => ({ p, idx }))
            .filter(({ p }) => !p.active && !/fnt/.test(p.condition || ''));
          const pick = await menu('send something in', bench.map(({ p, idx }) => ({
            label: `${pretty(String(p.details || '').split(',')[0])}  ${C.dim}${p.condition}${C.r}`, idx,
          })));
          choices.push(`switch ${pick.idx + 1}`);
        }
        return this.choose(choices.join(', '));
      }

      for (const [i, act] of (req.active || []).entries()) {
        const me = mine[i];
        if (!me || /fnt/.test(me.condition || '')) { choices.push('pass'); continue; }
        console.log(`\n${C.b}${pretty(String(me.details || '').split(',')[0])}${C.r} — what do you do?`);
        const opts = [];
        (act.moves || []).forEach((m, k) => {
          if (m.disabled) return;
          opts.push({ label: `${m.move}${m.pp != null ? `  ${C.dim}${m.pp}/${m.maxpp}pp${C.r}` : ''}`, choice: `move ${k + 1}` });
        });
        if (!act.trapped) {
          (req.side.pokemon || []).forEach((p, idx) => {
            if (p.active || /fnt/.test(p.condition || '')) return;
            opts.push({ label: `${C.c}switch to ${pretty(String(p.details || '').split(',')[0])}${C.r}  ${p.condition}`, choice: `switch ${idx + 1}` });
          });
        }
        const picked = await menu(`${pretty(String(me.details || '').split(',')[0])} — what do you do?`, opts);
        let ch = picked.choice;
        /* Doubles needs a target for a single-target move, and getting this wrong is the difference
         * between hitting the thing you meant and the thing beside it. */
        if (/^move /.test(ch)) {
          const mv = (act.moves || [])[parseInt(ch.split(' ')[1], 10) - 1];
          if (mv && ['normal', 'any', 'adjacentFoe'].includes(mv.target)) {
            const t = await menu('aim at', [
              { label: 'left foe', choice: '1' },
              { label: 'right foe', choice: '2' },
            ]);
            ch += ' ' + t.choice;
          }
        }
        choices.push(ch);
      }
      const out = this.choose(choices.join(', '));
      /* MAG has already decided by the time our choice is accepted, so this leaks nothing. */
      if (this.peek) setTimeout(() => this.peek(), 0);
      return out;
    }
  };
}
const hpOf = p => {
  const m = /^(\d+)\/(\d+)/.exec(String(p.condition || ''));
  return m ? (+m[1]) / (+m[2] || 1) : (/fnt/.test(p.condition || '') ? 0 : 1);
};

/* ---- run ------------------------------------------------------------------------------------- */
(async () => {
  const teams = realTeams();
  if (teams.length < 2) { console.error('need clean teams; run the ingest first'); process.exit(1); }
  /* realTeams returns {six, sets} objects, not lists of sets. Picked from the seed alone so
   * `--seed N` replays the same matchup — the whole point of being able to report a bad turn. */
  const idx = (n, pool) => Math.abs((SEED * 2654435761 + n * 40503) | 0) % pool.length;

  /* --vs <species>  give MAG a team that actually runs the thing you want to play against.
   *
   * Drawn from the SAME clean pool, just filtered -- so it is still a real team somebody laddered
   * with, not one invented to make a point. If nothing in the pool has it, that is itself worth
   * knowing and is said out loud rather than silently falling back. */
  const VS = String(arg('vs', '')).toLowerCase().replace(/[^a-z0-9]/g, '');
  let theirPool = teams;
  if (VS) {
    const hits = teams.filter(t => (t.six || []).some(sp => String(sp).toLowerCase().replace(/[^a-z0-9]/g, '') === VS));
    if (!hits.length) {
      console.error(`no clean team in the pool runs "${VS}" — it may not be played in this format.`);
      process.exit(1);
    }
    theirPool = hits;
    console.log(`${C.dim}MAG drawn from ${hits.length} real teams that run ${pretty(VS)}${C.r}`);
  }
  const mine = teams[idx(1, teams)], theirs = theirPool[idx(2, theirPool)];

  /* --team <pokepaste.txt> — bring your own six.
   *
   * A random ladder team is fine for a smoke test and nearly useless for judging the bot: half of
   * what you would notice depends on knowing your own sets cold. Showdown's own importer parses the
   * paste format exactly as the teambuilder does, so anything you can paste there works here. */
  let myPacked = null;
  const TEAMFILE = arg('team', '');
  if (TEAMFILE) {
    if (!fs.existsSync(TEAMFILE)) { console.error(`no such file: ${TEAMFILE}`); process.exit(1); }
    const parsed = Teams.import(fs.readFileSync(TEAMFILE, 'utf8'));
    if (!parsed || parsed.length < 4) { console.error('could not read that paste as a team'); process.exit(1); }
    myPacked = Teams.pack(parsed);
    console.log(`${C.dim}your team: ${TEAMFILE} — ${parsed.length} Pokemon${C.r}`);
  }

  const stream = new BattleStream();
  const streams = getPlayerStreams(stream);
  const { BattlePlayer } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle-stream.js'));
  const Human = humanPlayer(BattlePlayer);
  const MAG = require('./magnemite.js').makeScoringPlayer();

  const you = new Human(streams.p1);
  const bot = new MAG(streams.p2, { seed: [SEED & 0xffff, SEED >> 4 & 0xffff, SEED >> 8 & 0xffff, SEED >> 12 & 0xffff],
                                    mega: 0.85, greedy: GREEDY, switching: SWITCHING, keepThoughts: WHY });
  /* The hook the human calls once its own choice is locked in. */
  const seenThoughts = { shown: 0 };
  you.peek = () => showThoughts(bot, seenThoughts);
  you.start(); bot.start();

  /* THE SEED, ALONE ON ITS OWN LINE AND WITHOUT COLOUR CODES AROUND THE DIGITS.
   *
   * Reporting a bad turn means quoting the seed, and a seed buried in a decorated header is fiddly
   * to grab. A bare number delimited by spaces is one double-click in every terminal. Printed again
   * when the game ends, because that is when you know whether it was worth keeping. */
  console.log(`${C.b}ABRA — you vs MAG${C.r}`);
  console.log(`${C.dim}seed${C.r}  ${SEED}`);
  console.log(`${C.dim}engine ${CS.PINNED_COMMIT.slice(0, 12)} · ${CS.FORMAT}`);
  console.log(`${C.dim}MAG: ${GREEDY ? 'takes its best move' : 'weighted roll over its scores'}, switching ${SWITCHING ? 'ON' : 'off'}${C.r}\n`);
  console.log(`${C.b}your six:${C.r}   ${myPacked ? '(from your paste)' : mine.six.map(pretty).join(', ')}`);
  console.log(`${C.b}MAG's six:${C.r}  ${theirs.six.map(pretty).join(', ')}\n`);
  /* The team-preview menu shows this too and was rendering blank — the assignment got dropped in an
   * edit, which reads as "MAG has no team" rather than as a missing variable. */
  theirsSix = theirs.six.map(pretty);

  /* Unpacked from the SAME packed strings handed to the simulator, so what is shown is exactly what
   * is being played rather than a second description that can drift from it. */
  const packYou = myPacked || CS.packTeam(mine.six, Object.assign({}, mine.sets, { __seed: SEED * 2 + 1 })).packed;
  const packMag = CS.packTeam(theirs.six, Object.assign({}, theirs.sets, { __seed: SEED * 2 + 2 })).packed;
  try { SHEETS.you = Teams.unpack(packYou) || []; } catch (e) { SHEETS.you = []; }
  try { SHEETS.mag = Teams.unpack(packMag) || []; } catch (e) { SHEETS.mag = []; }
  printSheets();

  /* packTeam takes (six, setsBySpecies) and needs a per-call __seed, or every Incineroar comes out
   * byte-identical — the default-argument bug that flattened a 199,524-game corpus into one build
   * per species. Same call shape engine/mew.js uses, deliberately. */
  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: CS.FORMAT, seed: [SEED & 0xffff, SEED >> 4 & 0xffff, SEED >> 8 & 0xffff, SEED >> 12 & 0xffff] })}\n` +
    `>player p1 ${JSON.stringify({ name: 'You', team: packYou })}\n` +
    `>player p2 ${JSON.stringify({ name: 'MAG', team: packMag })}\n`);

  for await (const chunk of streams.omniscient) {
    if (/\|win\||\|tie\|/.test(chunk)) {
      console.log(`
${C.dim}replay this exact game:${C.r}`);
      console.log(`node engine/play.js --seed ${SEED}${VS ? ' --vs ' + VS : ''}${GREEDY ? ' --greedy' : ''}${SWITCHING ? ' --switching' : ''}`);
      console.log(`${C.dim}seed${C.r}  ${SEED}`);
      break;
    }
  }
  rl.close();
})();
