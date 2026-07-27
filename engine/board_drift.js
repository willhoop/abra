/* board_drift.js — is the board MAG scores against the board the simulator actually has?
 *
 *   SHOWDOWN_PATH=... node engine/board_drift.js data/<run>.raw-logs.jsonl
 *
 * WHY THIS IS THE CHECK THAT WAS MISSING
 * --------------------------------------
 * There are three ways a feature can be wrong and the project only checked one and a half:
 *
 *   1. it never fires                      engine/feature_coverage.js catches this
 *   2. its prediction disagrees with what  engine/surprise.js catches this, for SIX of 46 features
 *      actually happened
 *   3. THE BOARD IT IS COMPUTED ON IS WRONG   nothing checked this at all
 *
 * The third is the dangerous one. engine/board.js rebuilds state from the protocol stream — hp,
 * status, stat stages, weather, field, who has fainted — and every feature reads that reconstruction
 * rather than the simulator. If the reconstruction drifts, every feature is computed CORRECTLY on a
 * WRONG board. Nothing crashes. Coverage passes. The surprise report just looks a little worse and
 * the model takes the blame.
 *
 * This is not hypothetical either: hp was once tracked as cumulative damage with no healing events,
 * which buried Pokemon that were still alive and sent 1,219 clicks at targets that had left the
 * field. That was found by accident, months of games later.
 *
 * HOW IT WORKS
 * ------------
 * A raw log is the omniscient stream, so it contains the truth. The tracker is fed the same lines a
 * live player sees, and at every `|turn|` the reconstruction is compared against what the log says
 * outright. Any disagreement is drift, reported per field, with the worst offenders named.
 *
 * WHAT IT CANNOT SEE. Only what the protocol states explicitly. A quantity the stream never mentions
 * cannot be checked here, and the honest response to that is the count of fields checked, printed at
 * the end, rather than a clean bill.
 */
'use strict';
const fs = require('fs');
const readline = require('readline');
const CS = require('./champions_sim.js');
const B = require('./board.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm;
const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) {
  console.error('usage: node engine/board_drift.js <run>.raw-logs.jsonl');
  process.exit(1);
}

const SLOT = /^(p[12])([a-c]): (.*)$/;
const hpFrac = (s, prev) => {
  const t = String(s || '');
  if (/^0 fnt/.test(t)) return 0;
  const m = /^(\d+)\/(\d+)/.exec(t);
  if (!m) return prev;
  return +m[2] ? Math.max(0, Math.min(1, +m[1] / +m[2])) : prev;
};

const drift = {
  hp: { checks: 0, bad: 0, worst: 0, ex: [] },
  fainted: { checks: 0, bad: 0, ex: [] },
  status: { checks: 0, bad: 0, ex: [] },
  species: { checks: 0, bad: 0, ex: [] },
  weather: { checks: 0, bad: 0, ex: [] },
};
let games = 0, lines = 0;

(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(FILE), crlfDelay: Infinity });
  for await (const raw of rl) {
    if (!raw.trim()) continue;
    let rec; try { rec = JSON.parse(raw); } catch (e) { continue; }
    if (!rec.log) continue;
    games++;

    const board = new B.Board();
    /* TRUTH, straight off the stream. Every line that states a value outright updates this, and the
     * tracker never sees it — the two are built from the same input and compared, not shared. */
    const truth = {};                       // "p1a" -> {hp, fainted, status, species}
    let trueWeather = '';

    const track = (line) => {
      /* The same calls engine/magnemite.js makes in receiveLine. Kept in step with it deliberately:
       * if this ever diverges from the player, the check stops measuring the player. */
      if (!line.startsWith('|')) return;
      const p = line.slice(1).split('|');
      const cmd = p[0];
      const who = (s) => { const m = SLOT.exec(s || ''); return m ? { side: m[1], letter: m[2] } : null; };
      const monAt = (s) => { const w = who(s); return w ? board.slot(w.side, w.letter) : null; };
      if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
        const w = who(p[1]); if (!w) return;
        board.switchIn(w.side, w.letter, String(p[2] || '').split(',')[0]);
        const m = board.slot(w.side, w.letter); if (m) m.hp = hpFrac(p[3], 1);
      } else if (cmd === 'detailschange' || cmd === '-formechange') {
        const m = monAt(p[1]); if (m) m.species = norm(String(p[2] || '').split(',')[0]);
      } else if (cmd === '-damage' || cmd === '-sethp' || cmd === '-heal') {
        const m = monAt(p[1]); if (m) m.hp = hpFrac(p[2], m.hp);
      } else if (cmd === 'faint') {
        const w = who(p[1]); if (w) board.faint(w.side, w.letter);
      } else if (cmd === '-status') {
        const m = monAt(p[1]); if (m) m.status = norm(p[2]);
      } else if (cmd === '-curestatus') {
        const m = monAt(p[1]); if (m) m.status = '';
      } else if (cmd === '-weather') {
        const wx = String(p[1] || '');
        if (/^none$/i.test(wx)) board.setWeather('');
        else if (!line.includes('[upkeep]')) board.setWeather(wx);
      } else if (cmd === 'turn') {
        board.endTurn();
      }
    };

    const observe = (line) => {
      if (!line.startsWith('|')) return;
      const p = line.slice(1).split('|');
      const cmd = p[0];
      const m = SLOT.exec(p[1] || '');
      const key = m ? m[1] + m[2] : null;
      if (key && !truth[key]) truth[key] = { hp: 1, fainted: false, status: '', species: '' };
      if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
        truth[key] = { hp: hpFrac(p[3], 1), fainted: false, status: '', species: norm(String(p[2] || '').split(',')[0]) };
      } else if (cmd === 'detailschange' || cmd === '-formechange') {
        if (key) truth[key].species = norm(String(p[2] || '').split(',')[0]);
      } else if (cmd === '-damage' || cmd === '-sethp' || cmd === '-heal') {
        if (key) truth[key].hp = hpFrac(p[2], truth[key].hp);
      } else if (cmd === 'faint') {
        if (key) { truth[key].fainted = true; truth[key].hp = 0; }
      } else if (cmd === '-status') {
        if (key) truth[key].status = norm(p[2]);
      } else if (cmd === '-curestatus') {
        if (key) truth[key].status = '';
      } else if (cmd === '-weather') {
        const wx = String(p[1] || '');
        if (/^none$/i.test(wx)) trueWeather = '';
        else if (!line.includes('[upkeep]')) trueWeather = norm(wx);
      }
    };

    const compare = (turnNo) => {
      for (const [key, t] of Object.entries(truth)) {
        const side = key.slice(0, 2), letter = key.slice(2);
        const m = board.slot(side, letter);
        if (!m) continue;
        /* Only compare the mon the tracker believes is in that slot — a species mismatch is itself
         * a finding and is counted, but comparing hp across two different Pokemon is meaningless. */
        drift.species.checks++;
        if (t.species && norm(m.species) !== t.species) {
          drift.species.bad++;
          if (drift.species.ex.length < 5) drift.species.ex.push(`turn ${turnNo} ${key}: tracked ${m.species}, real ${t.species}`);
          continue;
        }
        drift.hp.checks++;
        const d = Math.abs((m.hp || 0) - t.hp);
        if (d > 0.02) {                       // 2% tolerance: the protocol rounds to whole percents
          drift.hp.bad++;
          if (d > drift.hp.worst) drift.hp.worst = d;
          if (drift.hp.ex.length < 5) drift.hp.ex.push(`turn ${turnNo} ${key}: tracked ${(100 * m.hp).toFixed(0)}%, real ${(100 * t.hp).toFixed(0)}%`);
        }
        drift.fainted.checks++;
        if (!!m.fainted !== !!t.fainted) {
          drift.fainted.bad++;
          if (drift.fainted.ex.length < 5) drift.fainted.ex.push(`turn ${turnNo} ${key}: tracked ${m.fainted ? 'dead' : 'alive'}, real ${t.fainted ? 'dead' : 'alive'}`);
        }
        drift.status.checks++;
        if (norm(m.status || '') !== norm(t.status || '')) {
          drift.status.bad++;
          if (drift.status.ex.length < 5) drift.status.ex.push(`turn ${turnNo} ${key}: tracked "${m.status}", real "${t.status}"`);
        }
      }
      drift.weather.checks++;
      if (norm(board.weather || '') !== norm(trueWeather || '')) {
        drift.weather.bad++;
        if (drift.weather.ex.length < 5) drift.weather.ex.push(`turn ${turnNo}: tracked "${board.weather}", real "${trueWeather}"`);
      }
    };

    let turnNo = 0;
    for (const line of String(rec.log).split('\n')) {
      lines++;
      if (line.startsWith('|turn|')) { compare(turnNo); turnNo = parseInt(line.slice(6), 10) || turnNo + 1; }
      observe(line);
      track(line);
    }
  }

  const pct = (a, b) => (b ? (100 * a / b).toFixed(3) + '%' : 'n/a');
  console.log(`BOARD DRIFT — ${games.toLocaleString()} games, ${lines.toLocaleString()} protocol lines\n`);
  console.log('  field        comparisons     disagreements     rate');
  console.log('  ' + '-'.repeat(58));
  for (const [k, v] of Object.entries(drift)) {
    console.log('  ' + k.padEnd(12) + String(v.checks).padStart(11) + String(v.bad).padStart(17) + '     ' + pct(v.bad, v.checks));
  }
  if (drift.hp.worst) console.log(`\n  worst hp disagreement: ${(100 * drift.hp.worst).toFixed(1)} percentage points`);
  for (const [k, v] of Object.entries(drift)) {
    if (!v.ex.length) continue;
    console.log(`\n  ${k}:`);
    for (const e of v.ex) console.log('    ' + e);
  }
  const total = Object.values(drift).reduce((a, v) => a + v.bad, 0);
  console.log(`\n  ${total === 0
    ? 'No drift on any checked field. The board MAG scores against is the board the simulator has.'
    : 'DRIFT PRESENT. Every feature reading these fields is computed on a board that is not real.'}`);
  console.log('  5 fields checked. A quantity the protocol never states cannot be checked here.');
})();
