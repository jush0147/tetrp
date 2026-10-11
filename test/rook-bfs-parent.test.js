import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {enumerateReachable} from '../src/analysis/rook.js';

// Fingerprints captured from pre-refactor canonical SRS+ BFS under Node 22,
// including the exact reachable pose, spin, softdrop count and input path.
// This guards the parent-pointer optimization against silent path changes.
const fingerprints=[
  ['empty-67020',17,'0cb6701c7e64ff23039213a14176cdf67d84e38653ba21e52959d37f67123140'],
  ['empty-67023',9,'8e949820176f6b004b27579f27078149f2706efacc582e6fb5579b0dea7aa8be'],
  ['pocket',34,'a1c19dd49d05bb37de9ddc6b42922f0152f375c1dabadc3060f6f8101e115f04'],
  ['garbage',34,'c475ddb48f53f2c4200d6ee679f20995eef7f27883340b33ef2d66ca9c0e9485'],
  ['permanent',34,'c475ddb48f53f2c4200d6ee679f20995eef7f27883340b33ef2d66ca9c0e9485']
];

test('parent-pointer SRS BFS reproduces exact pre-refactor paths and spins',()=>{
  const scenarios=[];
  for(const seed of [67020,67023]){
    const v=visibleState(new Engine({mode:'tl',seed,rules:{g:0}}).state);
    scenarios.push(['empty-'+seed,v.board,v.current,v.rules]);
  }
  const v=visibleState(new Engine({mode:'tl',seed:67027,rules:{g:0}}).state);
  for(const kind of ['pocket','garbage','permanent']){
    const board=structuredClone(v.board);
    for(let y=board.rows.length-4;y<board.rows.length;y++)
      for(let x=0;x<board.width;x++){
        const occupied=kind==='pocket'?(x<=3||x>=7):
          (x<=3&&y>=board.rows.length-3);
        if(occupied)board.rows[y][x]=kind==='permanent'&&x===0?'gbd':
          kind==='garbage'?'gb':'t';
      }
    scenarios.push([kind,board,{...v.current,type:'t'},v.rules]);
  }
  for(const [i,[id,board,piece,rules]] of scenarios.entries()){
    const before=JSON.stringify(board),moves=enumerateReachable(board,piece,rules,
      {maxStates:800,maxSteps:42});
    const [name,count,expected]=fingerprints[i];
    assert.equal(id,name);
    assert.equal(moves.length,count);
    assert.equal(createHash('sha256').update(JSON.stringify(moves)).digest('hex'),
      expected,'Canonical path/spin/landing signature changed in '+id);
    assert.equal(JSON.stringify(board),before,'SRS query must never mutate board');
  }
});
