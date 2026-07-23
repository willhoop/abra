/* Archive a regulation's data + models before moving to the next one.
 * Snapshots the current store, usage model, dynamics, behaviour-clone and JOLTEON
 * weights into data/archive/<id>/ (date-stamped), so previous-regulation data is
 * preserved forever. With --rotate, also starts a fresh store for the new reg.
 *
 *   node build/archive-regulation.js            # archive the currently-active reg
 *   node build/archive-regulation.js regmb      # archive a specific reg id
 *   node build/archive-regulation.js regmb --rotate   # archive AND start fresh
 */
const fs=require('fs'), path=require('path');
const D=path.join(__dirname,'..','data');
const reg=JSON.parse(fs.readFileSync(path.join(D,'regulations.json'),'utf8'));
const id=(process.argv[2]&&!process.argv[2].startsWith('--'))?process.argv[2]:reg.active;
const dest=path.join(D,'archive',id);
fs.mkdirSync(dest,{recursive:true});
const stamp=new Date().toISOString().slice(0,10);
const files=['games.ladder.jsonl','meta-usage.json','dynamics.json','move-priors.json','jolteon-weights.json','games.ladder.raw-logs.jsonl'];
let n=0;
for(const f of files){ const src=path.join(D,f);
  if(fs.existsSync(src)){ fs.copyFileSync(src, path.join(dest, f.replace(/(\.[^.]+(?:\.[^.]+)?)$/, `.${stamp}$1`))); n++; } }
const games = fs.existsSync(path.join(D,'games.ladder.jsonl')) ? fs.readFileSync(path.join(D,'games.ladder.jsonl'),'utf8').split('\n').filter(Boolean).length : 0;
fs.writeFileSync(path.join(dest,'MANIFEST.json'), JSON.stringify({ regulation:id, label:(reg.regulations[id]||{}).label||id, archivedAt:new Date().toISOString(), filesArchived:n, games },null,2));
process.stderr.write(`archived ${n} files for '${id}' (${games} games) -> data/archive/${id}/  [${stamp}]\n`);
if(process.argv.includes('--rotate')){
  for(const f of ['games.ladder.jsonl','games.ladder.raw-logs.jsonl']){ const p=path.join(D,f);
    if(fs.existsSync(p)) fs.renameSync(p, p+`.retired-${id}-${stamp}`); }
  process.stderr.write(`rotated: fresh store ready for the next regulation. Update data/regulations.json 'active' to the new reg.\n`);
}
