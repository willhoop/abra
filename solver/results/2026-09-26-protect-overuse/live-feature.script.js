// Does DODUO's `stall_repeat` feature fire on the LIVE row (ROTOM's parse of the room log) for our bodies that carry
// the stall counter? And what does DODUO put on the repeat there (slot marginal) vs how often argmax takes it?
process.chdir('C:/Users/willj/Projects/Pokemon/ABRA/.claude/worktrees/agent-ae7df0f2762a51c55');
const WT = process.cwd() + '/solver/';
process.env.ABRA_REGULATION = 'regmc';
require(WT + 'arena/env.js');
const fs = require('fs'), path = require('path');
const W = require(WT + 'rotom/world.js');
const F0 = require(WT + 'prior/features.js');
const CI = Object.fromEntries(F0.CAND_NAMES.map((n, i) => [n, i]));
const MAGI = require(WT + 'mag/infer.js');
const model = MAGI.load();
const { parseShowteam, parseGame } = require(WT + 'human/parse_game.js');
let n = 0, fired = 0, pred = 0, argmax = 0, err = 0;
for (const run of process.argv.slice(2)) {
  const dir = path.join('C:/Users/willj/Projects/Pokemon/ABRA/solver/out/rotom', run, 'games', 'medicham32');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.log'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => l.startsWith('|'));
    let me = null; const sheets = {};
    for (const l of lines) { const p = l.split('|'); if (p[1] === 'player' && /medicham32/i.test(p[3] || '')) me = p[2]; if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
    if (!me || !sheets.p1 || !sheets.p2) continue;
    lines.forEach((l, i) => {
      if (!/^\|turn\|/.test(l)) return;
      const upto = lines.slice(0, i + 1);
      const st = W.stallStreaks(upto, sheets);
      const mine = [...st.keys()].filter(k => k.startsWith(me + ':')).map(k => +k.slice(3));
      if (!mine.length) return;
      let row; try { row = parseGame({ id: f, log: upto.join('\n') }).game ? parseGame({ id: f, log: upto.join('\n') }) : null; } catch (e) { err++; return; }
      const t = row.turns.length - 1;
      let r; try { r = model.predict(row, t, me); } catch (e) { err++; return; }
      if (!r) return;
      r.decision.slots.forEach((s, k) => {
        if (!s) return;
        const act = row.turns[t].state.sides[me].active[k];
        if (!mine.includes(act)) return;
        const stI = s.cands.map((c, i) => (c.attr && c.attr.stall ? i : -1)).filter(i => i >= 0);
        if (!stI.length) return;
        n++;
        if (stI.some(i => s.cands[i].f[CI.stall_repeat] === 1)) fired++;
        let p = 0; for (const c of r.cells) if (stI.includes(k === 0 ? c.a : c.b)) p += c.p;
        pred += p;
        if (stI.includes(k === 0 ? r.cells[0].a : r.cells[0].b)) argmax++;
      });
    });
  }
}
console.log('our bodies carrying the counter, slot-decisions', n, ' stall_repeat fired', fired, ' DODUO v1 mean P(protect)', (pred / n).toFixed(3), ' argmax takes it', argmax, (argmax / n).toFixed(3), ' parse errors', err);
