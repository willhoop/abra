/* double_protect.js — how often do BOTH slots Protect on the same turn, bot versus human?
 *
 *   SHOWDOWN_PATH=... node engine/double_protect.js <selfplay.raw-logs.jsonl> [more...]
 *
 * WHY
 * ---
 * Will, playing MACHAMPSW on a real server: "weird double protect to start". Both slots Protected
 * on turn one, which spends the whole turn and hands the opponent a free one.
 *
 * That is not a Protect bug. It is the JOINT-DECISION failure in its purest form, and it is exactly
 * the thing he argued about when he reversed the retirement of the pair layer: each slot
 * independently notices it is threatened, each independently concludes Protect, and neither can see
 * that its partner has reached the same conclusion. No number in a single move's vector can mean
 * "my partner is already handling this turn".
 *
 * DODUO has a feature for precisely this -- `bothStatus`, "neither move damages anything: a turn
 * spent on nothing" -- and DODUO is switched off, because fitted to imitate humans it lost 28.4% of
 * decisive games.
 *
 * So the question this answers is narrow and falsifiable: DOES THE BOT DO THIS MORE THAN PEOPLE DO?
 * An anecdote from one game cannot say. If the rates match, Will saw a normal play that happened to
 * look odd. If the bot is well above human, the coordination hole is real, measurable, and has a
 * size -- which is what turns his argument from a good argument into a target.
 *
 * WHAT COUNTS. The protect FAMILY, not just Protect: Detect, Spiky Shield, Baneful Bunker, Burning
 * Bulwark, Silk Trap, Obstruct, Wide Guard and Quick Guard included, because they spend the turn
 * the same way. Wide Guard and Quick Guard are kept SEPARATE in the report as well, since a double
 * involving one of those can be deliberate.
 *
 * Turn 1 is reported apart from all turns. Leads carry Fake Out, so a single lead Protect is normal
 * and both of them doing it is the thing that is not.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Q = require('./quality.js');

const ROOT = path.join(__dirname, '..');
const PROTECT = new Set(['protect', 'detect', 'spikyshield', 'banefulbunker', 'burningbulwark',
  'silktrap', 'obstruct', 'kingsshield', 'maxguard']);
const SIDEGUARD = new Set(['wideguard', 'quickguard']);
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Count, per side, the turns where BOTH of that side's active Pokemon used a protect-family move.
 * Reads the protocol directly: |move|p1a: Name|Protect|... is unambiguous and needs no inference. */
function scanLog(log) {
  const lines = String(log || '').split('\n');
  const res = { turns: 0, both: 0, t1turns: 0, t1both: 0, single: 0 };
  let turn = 0;
  let used = { p1: new Set(), p2: new Set() };
  const flush = () => {
    if (!turn) return;
    for (const side of ['p1', 'p2']) {
      const n = used[side].size;
      res.turns++;
      if (turn === 1) res.t1turns++;
      if (n >= 2) { res.both++; if (turn === 1) res.t1both++; }
      else if (n === 1) res.single++;
    }
    used = { p1: new Set(), p2: new Set() };
  };
  for (const l of lines) {
    if (l.startsWith('|turn|')) { flush(); turn = parseInt(l.slice(6), 10) || turn + 1; continue; }
    const m = /^\|move\|(p[12])([a-c]): [^|]*\|([^|]*)/.exec(l);
    if (!m) continue;
    const mv = id(m[3]);
    if (PROTECT.has(mv) || SIDEGUARD.has(mv)) used[m[1]].add(m[2]);
  }
  flush();
  return res;
}

function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.959964, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [100 * (c - h), 100 * (c + h)];
}
const fmt = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return `${(100 * k / (n || 1)).toFixed(2)}% [${lo.toFixed(2)}, ${hi.toFixed(2)}]`;
};

(async () => {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!files.length) { console.error('give me at least one raw-logs jsonl'); process.exit(2); }

  const bot = { turns: 0, both: 0, t1turns: 0, t1both: 0, single: 0 };
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch (e) { continue; }
      const s = scanLog(r.log);
      for (const k of Object.keys(bot)) bot[k] += s[k];
    }
  }

  /* HUMANS, through the clean filter and nothing else. Baselining against the raw ladder store is
   * the mistake GARBODOR exists to prevent -- 87% of it is bots and stubs, and a bot baseline would
   * be measuring MAG against other bots' habits. */
  const human = { turns: 0, both: 0, t1turns: 0, t1both: 0, single: 0 };
  let humanGames = 0;
  const games = Q.loadGames ? Q.loadGames({ clean: true }) : null;
  if (games) {
    for (const g of games) {
      if (!g.log) continue;
      humanGames++;
      const s = scanLog(g.log);
      for (const k of Object.keys(human)) human[k] += s[k];
    }
  }

  console.log('DOUBLE PROTECT — both slots spend the same turn doing nothing\n');
  console.log('  Will, playing MACHAMPSW: "weird double protect to start". This asks whether the bot');
  console.log('  does it MORE than people do, which one game cannot answer.\n');
  console.log('  source              side-turns      both protected            turn 1 only');
  console.log('  ' + '-'.repeat(84));
  console.log('  bot (self-play)   ' + String(bot.turns).padStart(9) + '   ' + fmt(bot.both, bot.turns).padEnd(24) + '  ' + fmt(bot.t1both, bot.t1turns));
  if (human.turns) {
    console.log('  human (clean)     ' + String(human.turns).padStart(9) + '   ' + fmt(human.both, human.turns).padEnd(24) + '  ' + fmt(human.t1both, human.t1turns));
  } else {
    console.log('  human (clean)      -- no logs on the clean corpus records, cannot baseline --');
  }
  console.log('');
  if (human.turns) {
    const bAll = bot.both / bot.turns, hAll = human.both / human.turns;
    const b1 = bot.t1turns ? bot.t1both / bot.t1turns : 0, h1 = human.t1turns ? human.t1both / human.t1turns : 0;
    console.log(`  all turns: bot is ${(bAll / (hAll || 1)).toFixed(2)}x the human rate`);
    console.log(`  turn 1   : bot is ${(b1 / (h1 || 1)).toFixed(2)}x the human rate`);
  }

  fs.writeFileSync(path.join(ROOT, 'data', 'double-protect.json'), JSON.stringify({
    generated: new Date().toISOString(),
    by: 'engine/double_protect.js',
    what: 'How often BOTH active Pokemon on a side use a protect-family move on the same turn, bot '
        + 'versus clean human games. Prompted by Will observing a turn-1 double Protect while '
        + 'playing MACHAMPSW. This is the joint-decision failure in its purest form: each slot '
        + 'independently concludes it is threatened and neither can see the partner reaching the '
        + 'same conclusion.',
    counted: 'protect, detect, spiky shield, baneful bunker, burning bulwark, silk trap, obstruct, '
           + 'king\'s shield, max guard, wide guard, quick guard',
    bot, human, human_games: humanGames, files,
    caveat: 'A high rate is not automatically wrong -- against two threatened slots a double protect '
          + 'can be correct. The comparison against humans is what carries the claim, not the rate.',
  }, null, 1));
  console.log('\nwrote data/double-protect.json');
})();
