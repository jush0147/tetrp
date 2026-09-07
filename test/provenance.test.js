import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('all supplied handoff files match the corrected archive SHA256 manifest', () => {
  const root = new URL('../',import.meta.url);
  const manifest = readFileSync(new URL('SHA256SUMS.txt',root),'utf8');
  for(const line of manifest.trim().split(/\r?\n/)) {
    const [,expected,path] = line.match(/^([0-9a-f]{64})\s+(.+)$/) ?? [];
    assert.ok(expected && path && !path.includes('..'),`Invalid manifest line: ${line}`);
    const bytes = readFileSync(new URL(path,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,path);
  }
});
