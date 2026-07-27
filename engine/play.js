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
/* One prompt handles the toggle, so every input point supports it without repeating the check. */
async function askOpt(q) {
  for (;;) {
    const a = (await ask(q)).trim().toLowerCase();
    if (a === 'w') { WHY = !WHY; console.log(`   ${C.dim}MAG's reasoning ${WHY ? 'ON' : 'off'}  (press w again to flip)${C.r}`); continue; }
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

      /* TEAM PREVIEW IS A REQUEST TOO, and the first version fell through it into the move loop and
       * sent an empty choice. In this format you bring FOUR of six and the first two lead. */
      if (req.teamPreview) {
        console.log(`
${C.b}team preview — bring four, first two lead${C.r}`);
        (req.side.pokemon || []).forEach((p, k) => {
          const sp = pretty(String(p.details || '').split(',')[0]);
          console.log(`   ${C.b}${k + 1}${C.r}. ${sp}`);
        });
        console.log(`   ${C.dim}MAG brings: ${theirsSix.join(', ')}${C.r}`);
        const a = await askOpt('   four numbers, lead first (e.g. 1342) > ');
        const digits = String(a).replace(/[^1-6]/g, '').split('');
        const seen = new Set(); const order = [];
        for (const d of digits) { if (!seen.has(d)) { seen.add(d); order.push(d); } }
        while (order.length < 4) for (let k = 1; k <= 6 && order.length < 4; k++) { if (!seen.has(String(k))) { seen.add(String(k)); order.push(String(k)); } }
        return this.choose('team ' + order.slice(0, 4).join(''));
      }

      const choices = [];
      if (req.forceSwitch) {
        for (const [i, s] of (req.forceSwitch || []).entries()) {
          if (!s) { choices.push('pass'); continue; }
          console.log(`\n${C.b}send something in${C.r}`);
          const bench = (req.side.pokemon || [])
            .map((p, idx) => ({ p, idx }))
            .filter(({ p }) => !p.active && !/fnt/.test(p.condition || ''));
          bench.forEach(({ p, idx }, k) => console.log(`   ${C.b}${k + 1}${C.r}. ${pretty(String(p.details || '').split(',')[0])}  ${p.condition}`));
          const a = await askOpt('   > ');
          const pick = bench[Math.max(0, Math.min(bench.length - 1, (parseInt(a, 10) || 1) - 1))];
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
        opts.forEach((o, k) => console.log(`   ${C.b}${k + 1}${C.r}. ${o.label}`));
        const a = await askOpt('   > ');
        const n = Math.max(1, Math.min(opts.length, parseInt(a, 10) || 1));
        let ch = opts[n - 1].choice;
        /* Doubles needs a target for a single-target move, and getting this wrong is the difference
         * between hitting the thing you meant and the thing beside it. */
        if (/^move /.test(ch)) {
          const mv = (act.moves || [])[parseInt(ch.split(' ')[1], 10) - 1];
          if (mv && ['normal', 'any', 'adjacentFoe'].includes(mv.target)) {
            console.log(`   aim at:  ${C.b}1${C.r}. left foe   ${C.b}2${C.r}. right foe`);
            const t = await askOpt('   > ');
            ch += ' ' + (String(t).trim() === '2' ? '2' : '1');
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
  const idx = (n) => Math.abs((SEED * 2654435761 + n * 40503) | 0) % teams.length;
  const mine = teams[idx(1)], theirs = teams[idx(2)];

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

  console.log(`${C.b}ABRA — you vs MAG${C.r}   ${C.dim}seed ${SEED}${C.r}`);
  console.log(`${C.dim}engine ${CS.PINNED_COMMIT.slice(0, 12)} · ${CS.FORMAT}`);
  console.log(`${C.dim}MAG: ${GREEDY ? 'takes its best move' : 'weighted roll over its scores'}, switching ${SWITCHING ? 'ON' : 'off'}${C.r}\n`);
  console.log(`${C.b}your six:${C.r}   ${myPacked ? '(from your paste)' : mine.six.map(pretty).join(', ')}`);
  console.log(`${C.b}MAG's six:${C.r}  ${theirs.six.map(pretty).join(', ')}\n`);

  /* packTeam takes (six, setsBySpecies) and needs a per-call __seed, or every Incineroar comes out
   * byte-identical — the default-argument bug that flattened a 199,524-game corpus into one build
   * per species. Same call shape engine/mew.js uses, deliberately. */
  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: CS.FORMAT, seed: [SEED & 0xffff, SEED >> 4 & 0xffff, SEED >> 8 & 0xffff, SEED >> 12 & 0xffff] })}\n` +
    `>player p1 ${JSON.stringify({ name: 'You', team: myPacked || CS.packTeam(mine.six, Object.assign({}, mine.sets, { __seed: SEED * 2 + 1 })).packed })}\n` +
    `>player p2 ${JSON.stringify({ name: 'MAG', team: CS.packTeam(theirs.six, Object.assign({}, theirs.sets, { __seed: SEED * 2 + 2 })).packed })}\n`);

  for await (const chunk of streams.omniscient) {
    if (/\|win\||\|tie\|/.test(chunk)) break;
  }
  rl.close();
})();
