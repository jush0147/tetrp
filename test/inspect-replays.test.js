import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../scripts/inspect-replays.mjs', import.meta.url).pathname;
const fixture = {version: 1, gamemode: '40l', replay: {
  frames: 5, options: {version: 15, seed: 42, handling: {}},
  events: [
    {frame: 0, type: 'start', data: {}},
    {frame: 1, type: 'keydown', data: {key: 'hardDrop', subframe: 0.2}},
    {frame: 5, type: 'end', data: {reason: 'clear'}},
  ],
}};

test('plain replay inspection speaks structural facts without file paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tetrp-inspection-'));
  const path = join(dir, 'sensitive-filename.ttr');
  try {
    writeFileSync(path, JSON.stringify(fixture));
    const plain = spawnSync(process.execPath, [script, '--plain', path], {encoding: 'utf8'});
    assert.equal(plain.status, 0, plain.stderr);
    assert.match(plain.stdout, /Replay 1/);
    assert.match(plain.stdout, /Rounds: 1/);
    assert.match(plain.stdout, /Player streams: 1/);
    assert.match(plain.stdout, /Events: 3/);
    assert.match(plain.stdout, /Event types: /);
    assert.doesNotMatch(plain.stdout, /sensitive-filename/);
    const json = spawnSync(process.execPath, [script, path], {encoding: 'utf8'});
    assert.equal(json.status, 0, json.stderr);
    const summary = JSON.parse(json.stdout);
    assert.equal(summary.rounds, 1);
    assert.equal(summary.events, 3);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('plain inspection describes usage when no private file is supplied', () => {
  const result = spawnSync(process.execPath, [script, '--help'], {encoding: 'utf8'});
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--plain/);
});
