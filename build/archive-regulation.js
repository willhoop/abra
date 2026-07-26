// RAW-STORE-OK: archives a whole regulation verbatim; an archive that dropped 87% of its records would not be an archive
// Reads data/games.ladder.jsonl unfiltered ON PURPOSE. Anything measuring BEHAVIOUR
// must go through quality (loadGames/load_games) instead — bot games are 87% of the store.
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
/* THE RAW LOGS MUST LEAVE THIS MACHINE, SO THEY ARE COMPRESSED.
 *
 * .gitignore excludes every raw-logs.jsonl -- correctly, the live one is ~1GB and GitHub rejects it.
 * But that exclusion also caught the ARCHIVE copy, so the most valuable artefact here existed only
 * on one disk. The parsed store is a derived view; the protocol logs are what any NEW question gets
 * re-parsed out of, which is the whole "store raw, analyse on top" principle. Losing them is the one
 * unrecoverable failure this project has.
 *
 * gzip takes 61 MB to 8.7 MB (14%), well under GitHub's 100 MB per-file limit, and .gz does not match
 * the ignore pattern. So the archive keeps a compressed copy and drops the uncompressed one. */
try {
  const zlib = require('zlib');
  for (const f of fs.readdirSync(dest)) {
    if (!/\.raw-logs\.jsonl$/.test(f)) continue;
    const full = path.join(dest, f);
    const gz = full + '.gz';
    if (!fs.existsSync(gz)) fs.writeFileSync(gz, zlib.gzipSync(fs.readFileSync(full)));
    fs.unlinkSync(full);
    process.stderr.write('compressed ' + f + ' -> ' + (fs.statSync(gz).size / 1048576).toFixed(1) + ' MB (committable)' + String.fromCharCode(10));
  }
} catch (e) { process.stderr.write('raw-log compression failed: ' + e.message + String.fromCharCode(10)); }

fs.writeFileSync(path.join(dest,'MANIFEST.json'), JSON.stringify({ regulation:id, label:(reg.regulations[id]||{}).label||id, archivedAt:new Date().toISOString(), filesArchived:n, games },null,2));
process.stderr.write(`archived ${n} files for '${id}' (${games} games) -> data/archive/${id}/  [${stamp}]\n`);
if(process.argv.includes('--rotate')){
  for(const f of ['games.ladder.jsonl','games.ladder.raw-logs.jsonl']){ const p=path.join(D,f);
    if(fs.existsSync(p)) fs.renameSync(p, p+`.retired-${id}-${stamp}`); }
  process.stderr.write(`rotated: fresh store ready for the next regulation. Update data/regulations.json 'active' to the new reg.\n`);
}
