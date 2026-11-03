// Runs backend/main.lua in fengari: it must load, tell Millennium it is ready and
// return its patches. With --packed, reads the backend out of dist/plugins-hub.star.
// Also fails on the APIs Millennium has deprecated, anywhere in the source.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBackend } from './lib/patches.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packed = process.argv.includes('--packed');
const source = packed
  ? execFileSync(process.execPath, ['node_modules/@steambrew/starlight/bin/starlight.js', '-i', 'dist/plugins-hub.star', '-q', 'backend:backend/main.lua'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  : readFileSync(join(root, 'backend/main.lua'), 'utf8');

const { text, run, patches } = runBackend(source);
assert.equal(text('type(plugin.on_load)'), 'function');
run('plugin.on_load()');
assert.equal(text('loaded'), '1', 'on_load must call millennium.ready()');
assert.equal(patches.length, 5);

if (!packed) {
  assert.ok(!existsSync(join(root, 'plugin.json')), 'plugin.json is the deprecated manifest');
  const deprecated = /AddWindowCreateHook|findElement|callServerMethod|exposeObj/;
  const scan = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) scan(path);
      else assert.ok(!deprecated.test(readFileSync(join(root, path), 'utf8')), `${path} uses a deprecated API`);
    }
  };
  scan('frontend');
  scan('backend');
}

console.log(`Backend check passed${packed ? ' (packed)' : ''}.`);
