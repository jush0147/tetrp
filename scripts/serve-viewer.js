// Local preview only. The deployed artifact requires no Node server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const port=Number(process.env.PORT||4173);
const files=new Map([['index.html','text/html; charset=utf-8'],['app.js','text/javascript; charset=utf-8'],['worker.js','text/javascript; charset=utf-8'],['app.css','text/css; charset=utf-8']]);
files.set('kiwi-worker.js','text/javascript; charset=utf-8');files.set('cold_clear_2_bg.wasm','application/wasm');
for(const f of ['kiwi-build.json','kiwi-artifact-lock.json'])files.set(f,'application/json');
for(const f of ['kiwi-LICENSE-MIT','kiwi-LICENSE-APACHE','kiwi-NOTICES'])files.set(f,'text/plain');
files.set('sw.js','text/javascript; charset=utf-8');files.set('manifest.webmanifest','application/manifest+json');
for(const size of [180,192,512])files.set(`icon-${size}.png`,'image/png');
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/tetrp/'||pathname==='/'?'index.html':pathname.replace(/^\/tetrp\//,'').replace(/^\//,'');
  if(!files.has(name)){res.writeHead(404);res.end('Not found');return;}
  try{const data=await readFile(new URL(`../dist/${name}`,import.meta.url));res.writeHead(200,{'Content-Type':files.get(name),'Cache-Control':'no-store'});res.end(data);}
  catch{res.writeHead(404);res.end('Run npm run build first');}
}).listen(port,'127.0.0.1',()=>console.log(`Viewer: http://127.0.0.1:${port}/tetrp/`));
