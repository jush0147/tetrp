import { build } from 'esbuild';
import { mkdir,copyFile,writeFile,readdir,readFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {iconPNG} from './pwa-icons.js';
import assert from 'node:assert/strict';
// Only explicit viewer entrypoints are emitted: no replay, checkpoints or source tree copy.
await mkdir('dist',{recursive:true});
await build({entryPoints:{app:'viewer/app.js',worker:'viewer/worker.js'},outdir:'dist',bundle:true,
  format:'esm',platform:'browser',target:['safari16','chrome110','firefox115'],minify:true,legalComments:'none'});
await copyFile('viewer/index.html','dist/index.html');
await copyFile('viewer/style.css','dist/app.css');
await writeFile('dist/.nojekyll','');
for(const size of [180,192,512])await writeFile(`dist/icon-${size}.png`,iconPNG(size));
// Omit id so it defaults to resolved start_url, keeping different hosted subpaths distinct.
await writeFile('dist/manifest.webmanifest',JSON.stringify({name:'Tetrp Replay Viewer',short_name:'tetrp',lang:'zh-Hant',
  description:'在裝置上回看本機 replay',start_url:'./',scope:'./',display:'standalone',background_color:'#061923',theme_color:'#061923',
  icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
    {src:'./icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},null,2));
const assets=['index.html','app.css','app.js','worker.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const sw=await readFile('viewer/sw.js','utf8');
const hash=createHash('sha256').update(sw);
for(const name of assets)hash.update(name).update(await readFile(`dist/${name}`));
await writeFile('dist/sw.js',sw.replace('__VERSION__',JSON.stringify(hash.digest('hex').slice(0,20))).replace('__ASSETS__',JSON.stringify(assets)));
assert.deepEqual((await readdir('dist')).sort(),['.nojekyll','sw.js',...assets].sort(),'Unexpected artifact in dist; do not publish');
console.log('Built client-only viewer in dist/');
