/* solver/tests/probe_protect_live.js — THE LIVE PROTECT READ, per turn a body carries the counter (2026-09-26,
 * docs/_reports/2026-09-26-protect-overuse.md).
 *
 *   node solver/tests/probe_protect_live.js <rotom run dir> [<rotom run dir> ...]      (e.g. solver/out/rotom/gen5ab-…)
 *
 * A MEASUREMENT over finished ROTOM runs (read only; never a live one). For every game log under <run>/games/<account>/,
 * at the start of every turn, each active body's consecutive-Protect counter is read off the log with the SAME function
 * ROTOM's world now uses (solver/rotom/world.js stallStreaks). Then, per group — our arm and policy (from the game's
 * decision log) and the human opponents in the same games:
 *   withCounter / repeat / repeatFailed   turns a body started with the counter; it clicked the protect family again;
 *                                         that click failed (no `-singleturn` before its next line)
 *   fresh / freshProtect                  turns a body started without it; it clicked the family
 * The account is the one that owns the run (`|player|` name matched by --account, default medicham32).
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ACCOUNT = flag('--account', 'medicham32');
const runs = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--account');
const W = require('../rotom/world.js');
const FAM = require('../arena/protect_stats.js').family();
const X = require('../human/dex.js');
const { parseShowteam } = require('../human/parse_game.js');
const T = {};
const bump = (k, f) => { T[k] = T[k] || { withCounter: 0, repeat: 0, repeatFailed: 0, fresh: 0, freshProtect: 0 }; T[k][f]++; };
const re = new RegExp(ACCOUNT, 'i');
for (const run of runs) {
  const dir = path.join(run, 'games', ACCOUNT);
  if (!fs.existsSync(dir)) { console.error('  no games under ' + dir); continue; }
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.log'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    const dfile = path.join(dir, f.replace(/\.log$/, '.decisions.jsonl'));
    let arm = '?', pol = '?';
    if (fs.existsSync(dfile)) {
      const d = fs.readFileSync(dfile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(x => x.kind === 'move');
      if (d) { arm = d.arm; pol = d.policy; }
    }
    let me = null; const sheets = {};
    for (const l of lines) { const p = l.split('|'); if (p[1] === 'player' && re.test(p[3] || '')) me = p[2]; if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
    if (!me || !sheets.p1 || !sheets.p2) continue;
    const turnIdx = []; lines.forEach((l, i) => { if (/^\|turn\|/.test(l)) turnIdx.push(i); });
    for (let t = 0; t < turnIdx.length; t++) {
      const upto = lines.slice(0, turnIdx[t] + 1);
      const st = W.stallStreaks(upto, sheets);
      const seg = lines.slice(turnIdx[t] + 1, t + 1 < turnIdx.length ? turnIdx[t + 1] : lines.length);
      const pos = new Map();
      for (const l of upto) {
        const p = l.split('|'); const m = /^(p[12][ab]): ?(.*)$/.exec(p[2] || '');
        if (!m) continue;
        if (['switch', 'drag', 'replace'].includes(p[1])) pos.set(m[1], m[2]);
        if (p[1] === 'faint' && pos.get(m[1]) === m[2]) pos.delete(m[1]);
      }
      for (const [ps, nick] of pos) {
        const side = ps.slice(0, 2);
        const n = st.get(side + ':' + sheets[side].findIndex(r => r.nick === nick)) || 0;
        const who = side === me ? 'ours-' + arm + ' (' + pol + ')' : 'humans (opponents)';
        let clicked = false, up = false;
        for (let k = 0; k < seg.length; k++) {
          const p = seg[k].split('|');
          if (p[1] !== 'move' || !p[2] || p[2].replace(/^(p[12])[ab]/, '$1') !== side + ': ' + nick || /\[from\]/.test(seg[k])) continue;
          const mv = X.D.moves.get(X.toID(p[3]));
          if (mv && FAM.has(mv.id)) { clicked = true; const nx = seg.slice(k + 1).find(x => /^\|(-singleturn|move|-fail|upkeep)\|/.test(x + '|')); up = !!(nx && nx.startsWith('|-singleturn|')); }
          break;
        }
        if (n > 0) { bump(who, 'withCounter'); if (clicked) { bump(who, 'repeat'); if (!up) bump(who, 'repeatFailed'); } }
        else { bump(who, 'fresh'); if (clicked) bump(who, 'freshProtect'); }
      }
    }
  }
}
for (const [k, v] of Object.entries(T)) console.log('  ' + k.padEnd(28), JSON.stringify(v), ' P(repeat | counter) =', (v.repeat / v.withCounter).toFixed(3), ' P(protect | fresh) =', (v.freshProtect / v.fresh).toFixed(3));
