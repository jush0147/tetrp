import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pieces from '../src/data/pieces.json' with { type: 'json' };
import kicks from '../src/data/kicks.json' with { type: 'json' };
import spins from '../src/data/spins.json' with { type: 'json' };
import contract from './fixtures/data-contract.json' with { type: 'json' };
import { cells } from '../src/board.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('#5 public data preserves the behavioral projections frozen before cleanup',()=>{
  for(const [path,expected] of Object.entries(contract.data)) {
    const bytes=readFileSync(new URL(`../${path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,path);
  }
});
test('#5 geometry has only pivots and xy cells; kick/spin domain is seven pieces',()=>{
  assert.deepEqual(Object.keys(pieces).sort(),[...'zlosijt'].sort());
  for(const piece of Object.values(pieces)) {
    assert.deepEqual(Object.keys(piece).sort(),['pivot','rotations']);
    assert.equal(piece.pivot.length,2); assert.equal(piece.rotations.length,4);
    for(const rotation of piece.rotations) {
      assert.equal(rotation.length,4);
      for(const cell of rotation) { assert.equal(cell.length,2); assert.ok(cell.every(Number.isInteger)); }
    }
  }
  assert.deepEqual(Object.keys(kicks).sort(),['i_kicks','kicks']);
  for(const rule of Object.values(spins.spinbonuses_rules)) {
    assert.ok(Object.keys(rule).every(key=>key==='types'));
    assert.ok((rule.types ?? []).every(type=>type in pieces));
  }
});
test('#5 geometry arithmetic matches pre-cleanup projections at integer and epsilon boundaries',()=>{
  const output=[];
  for(const type of [...'zlosijt']) for(let r=0;r<4;r++) {
    for(const x of contract.geometry.x) for(const y of contract.geometry.y) output.push(cells({type,r,x,y}));
  }
  assert.equal(createHash('sha256').update(JSON.stringify(output)).digest('hex'),contract.geometry.sha256);
});
test('#5 public tree excludes research directories and binary assets',()=>{
  const root=new URL('../',import.meta.url);
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:fileURLToPath(root),encoding:'utf8'}).split('\0').filter(Boolean);
  for(const path of tracked) {
    assert.ok(!/^(01_core_spec|02_engine_details|03_fixtures|04_reference|05_phase2_replay|\.cache|\.private-replays)\//.test(path),`Research/private data tracked: ${path}`);
    assert.ok(!/\.ttrm?$/i.test(path),`Private replay tracked: ${path}`);
    assert.ok(path==='viewer/kiwi-button.jpg'||!/\.(zip|png|jpg|svg|webp|woff2?|ttf|mp3|wav|exe)$/i.test(path),`Unexpected binary/asset tracked: ${path}`);
    assert.ok(!/tetrio\.beautified|01_Official_Standalone|production.bundle/i.test(path),`Forbidden artifact: ${path}`);
  }
  for(const name of ['01_core_spec','02_engine_details','03_fixtures','04_reference','05_phase2_replay',
    'README_FOR_CODEX.md','ROADMAP_FOR_CODEX.md','ERRATA_FOR_CODEX.md','SHA256SUMS.txt']) {
    assert.equal(existsSync(new URL(name,root)),false,`${name} must remain outside the public tree`);
  }
  // Audit publication, not untracked user files or temporary test output.
  const publicReplayScripts = new Set(['scripts/inspect-replays.mjs','scripts/validate-replays.mjs','scripts/validate-analysis.mjs']);
  const kiwiLock=JSON.parse(readFileSync(new URL('../vendor/kiwi-v1/artifact-lock.json',import.meta.url),'utf8'));
  const kiwiFiles=new Set(['artifact-lock.json',...Object.keys(kiwiLock.files)].map(p=>'vendor/kiwi-v1/'+p));
  const publicViewerAssets = new Set(['viewer/index.html','viewer/style.css','viewer/kiwi-button.jpg']);
  // Reviewed diagnostic source only; compiled artifacts and fetched upstream
  // sources remain in ignored directories and are never publication exceptions.
  const cc2DiagnosticSources = new Set([
    'docs/audits/cc2-alignment/source-witnesses.mjs',
    'tools/cc2-transition-audit/.gitignore','tools/cc2-transition-audit/Cargo.toml',
    'tools/cc2-transition-audit/src/main.rs','tools/cc2-transition-audit/lock-timing.patch',
    'tools/cc2-transition-audit/lock-timing-tests.rs',
    'tools/cc2-transition-audit/queue-scan.patch','tools/cc2-transition-audit/queue-scan-tests.rs',
  ]);
  for(const path of tracked) {
    assert.ok(kiwiFiles.has(path)||cc2DiagnosticSources.has(path)||/\.(js|json|py|md|yml|yaml)$/.test(path)||publicReplayScripts.has(path)||publicViewerAssets.has(path)||['LICENSE','.gitignore','.gitattributes'].includes(path),`Unexpected public artifact ${path}`);
  }
});
