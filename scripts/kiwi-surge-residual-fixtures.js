// Unit oracle uses Tetrp authority, not another Surge formula.
import {writeFile,mkdir} from 'node:fs/promises';
import {createAttack,resolveAttack} from '../src/attack.js';
import {ruleset} from '../src/rules.js';
import {createHoles} from '../src/random.js';
const rows=[];
for(const rawB2B of [0,1,4,5,8,9])for(const multiplier of [1,1.25,1.5,2])for(const pending of [0,8])for(const charging of [false,true])for(const base of [0,3]){
 const rules=ruleset('tl',{b2bcharging:charging,b2bcharge_base:base}),s=createAttack();Object.assign(s,{btb:rawB2B,pieces:30,multiplier});
 if(pending)s.pending.push({amt:pending,active:true,hardened:false,shielded:false});
 const tx=resolveAttack(s,{lines:1,spin:'none',allClear:false,garbageRows:0},rules,createHoles(1));
 rows.push({rawB2B,multiplier,pending,charging,base,surgeGenerated:tx.surge.reduce((n,x)=>n+x.generated,0)});
}
await mkdir('.cache/surge-residual-build',{recursive:true});await writeFile('.cache/surge-residual-build/authority-fixtures.json',JSON.stringify(rows));console.log(`${rows.length} authority unit fixtures`);
