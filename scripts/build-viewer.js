import { build } from 'esbuild';
import { mkdir,copyFile,writeFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Only explicit viewer entrypoints are emitted: no replay, checkpoints or source tree copy.
await mkdir('dist',{recursive:true});
await build({entryPoints:{app:'viewer/app.js',worker:'viewer/worker.js'},outdir:'dist',bundle:true,
  format:'esm',platform:'browser',target:['safari16','chrome110','firefox115'],minify:true,legalComments:'none'});
await copyFile('viewer/index.html','dist/index.html');
await copyFile('viewer/style.css','dist/app.css');
await writeFile('dist/.nojekyll','');
assert.deepEqual((await readdir('dist')).sort(),['.nojekyll','app.css','app.js','index.html','worker.js'],'Unexpected artifact in dist; do not publish');
console.log('Built client-only viewer in dist/');
