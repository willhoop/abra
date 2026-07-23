/* ABRA WORLD — tiny local server (no dependencies, built-in http only).
 * Serves the site AND runs the REAL engines on your own machine, so every model
 * is accessible — not just JOLTEON (which already runs in the page).
 *
 *   node server.js         (or double-click start.bat)
 *   -> http://localhost:8790
 *
 * Endpoints (all compute locally):
 *   /api/medicham?a=team&b=team&n=250   -> grounded rollout win prob   (needs Node)
 *   /api/kadabra?id=replayId&me=name    -> turn-by-turn coaching       (needs Node)
 *   /api/jolteon?a=team&b=team          -> win prob from the trained model (needs Python)
 *   /api/ditto?seed=team                -> team optimiser (slow ~30s)  (needs Python)
 */
const http=require('http'), fs=require('fs'), path=require('path'), {spawn,spawnSync}=require('child_process');
const ROOT=__dirname, WEB=path.join(ROOT, require('fs').existsSync(path.join(ROOT,'app','index.html'))?'app':'web');
const PORT=process.env.PORT||8790;

// find a REAL Python with numpy (skip the Windows Microsoft-Store alias stub).
// Resolved LAZILY on first use so the server starts listening instantly.
let _pyCache;
function getPy(){
  if(_pyCache!==undefined) return _pyCache;
  const cands = process.platform==='win32' ? ['py','python','python3'] : ['python3','python'];
  for(const c of cands){ try{ const r=spawnSync(c,['-c','import numpy'],{timeout:8000,encoding:'utf8'});
    if(r.status===0){ return _pyCache={cmd:c,numpy:true}; } }catch(e){} }
  for(const c of cands){ try{ const r=spawnSync(c,['--version'],{timeout:5000,encoding:'utf8'});
    const txt=(r.stdout||'')+(r.stderr||''); if(r.status===0 && !/Microsoft Store|was not found/i.test(txt)){ return _pyCache={cmd:c,numpy:false}; } }catch(e){} }
  return _pyCache={cmd:null,numpy:false};
}
const PY_HELP = "Python with numpy not found. JOLTEON (in-page) and MEDICHAM/KADABRA still work. "+
  "For DITTO: install Python from python.org (check 'Add to PATH'), then run: pip install numpy — and restart start.bat.";

function run(cmd,args,cb){
  let out=''; let done=false;
  const p=spawn(cmd,args,{cwd:ROOT});
  p.stdout.on('data',d=>out+=d); p.stderr.on('data',d=>out+=d);
  p.on('close',()=>{ if(!done){done=true;cb(out);} });
  p.on('error',e=>{ if(!done){done=true;cb('ERR: '+e.message+' (is '+cmd+' installed and on your PATH?)');} });
}
const TYPES={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',svg:'image/svg+xml',png:'image/png',gif:'image/gif'};

http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const send=(code,type,body)=>{res.writeHead(code,{'Content-Type':type,'Access-Control-Allow-Origin':'*'});res.end(body);};
  const q=k=>u.searchParams.get(k)||'';

  if(u.pathname==='/api/stats'){
    let games=0,turns=0,dmg=0; const seen=new Set();
    try{ for(const l of fs.readFileSync(path.join(ROOT,'data','games.ladder.jsonl'),'utf8').split('\n')){
        if(!l.trim())continue; let g; try{g=JSON.parse(l);}catch(e){continue;}
        if(seen.has(g.id))continue; seen.add(g.id); games++; turns+=(g.turns||[]).length; }
    }catch(e){}
    try{ dmg=Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT,'data','dynamics.json'),'utf8')).damage||{}).length; }catch(e){}
    return send(200,'application/json',JSON.stringify({games,turns,dmg}));
  }
  if(u.pathname==='/api/medicham'){
    return run('node',[path.join('engine','medicham.js'),q('a'),q('b'),q('n')||'250'],out=>{
      const m=out.match(/P\(A wins\) = ([\d.]+)/); send(200,'application/json',JSON.stringify({p:m?+m[1]:null,raw:out}));});
  }
  if(u.pathname==='/api/kadabra'){
    return run('node',[path.join('engine','kadabra.js'),q('id'),q('me'),'--json'],out=>send(200,'application/json',JSON.stringify({json:out})));
  }
  if(u.pathname==='/api/jolteon'){
    const py=getPy(); if(!py.cmd||!py.numpy) return send(200,'application/json',JSON.stringify({raw:PY_HELP}));
    return run(py.cmd,[path.join('engine','jolteon.py'),'predict',q('a'),q('b')],out=>send(200,'application/json',JSON.stringify({raw:out})));
  }
  if(u.pathname==='/api/ditto'){
    // Node port — no Python needed. JOLTEON (JS scoring) proposes, MEDICHAM (native) decides.
    const args=[path.join('engine','ditto.js')]; if(q('seed'))args.push(q('seed'));
    return run('node',args,out=>send(200,'application/json',JSON.stringify({text:out})));
  }
  // static files from web/
  let f=u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname);
  const fp=path.join(WEB,f);
  if(fp.startsWith(WEB)&&fs.existsSync(fp)&&fs.statSync(fp).isFile()){
    return send(200,TYPES[path.extname(fp).slice(1)]||'text/plain',fs.readFileSync(fp));
  }
  send(404,'text/plain','not found');
}).listen(PORT,()=>{
  console.log('\n  ABRA WORLD is live  ->  http://localhost:'+PORT+'\n');
  console.log('  All engines run locally. MEDICHAM & KADABRA need Node; JOLTEON & DITTO need Python.');
  console.log('  Leave this window open. Ctrl+C to stop.\n');
});
