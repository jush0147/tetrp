import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export async function verifyKiwi(){
  const base=new URL('../vendor/kiwi-v1/',import.meta.url);
  const lock=JSON.parse(await readFile(new URL('artifact-lock.json',base),'utf8'));
  const found=[];
  async function walk(prefix=''){
    for(const e of await readdir(new URL(prefix,base),{withFileTypes:true})){
      if(e.isDirectory())await walk(prefix+e.name+'/');else found.push(prefix+e.name);
    }
  }
  await walk();
  assert.deepEqual(found.sort(),['artifact-lock.json',...Object.keys(lock.files)].sort());
  for(const [path,hash] of Object.entries(lock.files))
    assert.equal(createHash('sha256').update(await readFile(new URL(path,base))).digest('hex'),hash,`Kiwi artifact modified: ${path}`);
  const build=JSON.parse(await readFile(new URL('kiwi-build.json',base),'utf8'));
  assert.equal(build.source_commit,lock.sourceCommit);
  assert.equal(build.default_node_budget,lock.defaultNodeBudget);
}
