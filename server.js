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
const http=require('http'), fs=require('fs'), path=require('path'), {spawn}=require('child_process');
const ROOT=__dirname, WEB=path.join(ROOT,'web');
const PY = process.platform==='win32' ? 'python' : 'python3';
const PORT=process.env.PORT||8790;

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

  if(u.pathname==='/api/medicham'){
    return run('node',[path.join('engine','medicham.js'),q('a'),q('b'),q('n')||'250'],out=>{
      const m=out.match(/P\(A wins\) = ([\d.]+)/); send(200,'application/json',JSON.stringify({p:m?+m[1]:null,raw:out}));});
  }
  if(u.pathname==='/api/kadabra'){
    return run('node',[path.join('engine','kadabra.js'),q('id'),q('me')],out=>send(200,'application/json',JSON.stringify({text:out})));
  }
  if(u.pathname==='/api/jolteon'){
    return run(PY,[path.join('engine','jolteon.py'),'predict',q('a'),q('b')],out=>send(200,'application/json',JSON.stringify({raw:out})));
  }
  if(u.pathname==='/api/ditto'){
    const args=[path.join('engine','ditto.py')]; if(q('seed'))args.push(q('seed'));
    return run(PY,args,out=>send(200,'application/json',JSON.stringify({text:out})));
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
