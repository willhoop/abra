// Live gen5 payoff tables (arm A of gen5ab): how much of the row mix sits on protect-family rows, and what the opponent
// columns look like (share of columns with a protect-family slot, with a switch). Read only.
process.chdir('C:/Users/willj/Projects/Pokemon/ABRA/.claude/worktrees/agent-ae7df0f2762a51c55');
const WT = process.cwd() + '/solver/';
process.env.ABRA_REGULATION = 'regmc';
require(WT + 'arena/env.js');
const fs = require('fs');
const FAM = require(WT + 'arena/protect_stats.js').family();
const X = require(WT + 'human/dex.js');
const f = 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/rotom/gen5ab-2026-09-26T04-06-53-848Z/decisions-medicham32.jsonl';
const famName = new Set([...FAM].map(id => X.D.moves.get(id).name.toLowerCase().replace(/[^a-z]/g, '')));
const rowHas = s => String(s).split(',').some(x => { const m = /move (\S+)/.exec(x.trim()); return false; });
let dec = 0, rowsP = 0, rowsN = 0, mixP = 0, colsP = 0, colsSw = 0, colsN = 0, pickP = 0;
const isFamRowChoice = (choice, req) => false;
for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!l) continue;
  const d = JSON.parse(l);
  if (d.kind !== 'move' || d.policy !== 'miltank-gen5' || !d.info || !d.info.table || !d.info.table.rows) continue;
  const t = d.info.table;
  dec++;
  // rows are request choice strings ("move 2 1, move 1 -1"): map the move index through the request's own move list
  const req = d.req || null;
  const act = req && req.active ? req.active : null;
  const rowFam = t.rows.map(r => {
    if (!act) return null;
    return String(r).split(',').some((c, k) => { const m = /move (\d+)/.exec(c.trim()); if (!m || !act[k]) return false; const mv = act[k].moves[+m[1] - 1]; return mv && FAM.has(mv.id); });
  });
  t.rows.forEach((r, i) => { if (rowFam[i]) { rowsP++; mixP += t.mix[i]; } rowsN++; });
  if (rowFam[t.pick]) pickP++;
  for (const c of t.cols) { colsN++; if (String(c).split(',').some(x => FAM.has(String(x).trim().split(' ')[0]))) colsP++; if (/switch/.test(c)) colsSw++; }
}
console.log({ decisions: dec, rows: rowsN, famRows: rowsP, meanMixOnFam: +(mixP / dec).toFixed(3), pickedFam: pickP, cols: colsN, colsWithOppProtect: +(colsP / colsN).toFixed(3), colsWithOppSwitch: +(colsSw / colsN).toFixed(3) });
