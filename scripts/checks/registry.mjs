// The panel registry: panels added before or after the hub loads, and only the
// changes that happen notify anyone.
import assert from 'node:assert/strict';
import { createLoader } from './lib/load-ts.mjs';

const content = { type: 'content' };
globalThis.window = { MILLENNIUM_SIDEBAR_NAVIGATION_PANELS: { early: { title: 'Zeta', icon: {}, content } } };
const plain = window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS;

const registry = createLoader()('frontend/registry.ts');
registry.watchRegistry();
assert.notEqual(window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS, plain, 'the global is watched');
registry.watchRegistry();

let notified = 0;
const unsubscribe = registry.subscribe(() => { notified += 1; });
const before = registry.getRevision();

// Exactly what a plugin's build does when it finishes loading.
window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS ||= {};
window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS['deck-shelves'] = { title: { type: 'element' }, icon: {}, content };
window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS.css = { title: 'Alpha', icon: {}, content };
window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS.empty = { title: 'No content', icon: {} };
assert.equal(notified, 3);
assert.equal(registry.getRevision(), before + 3);
assert.ok(plain.css, 'writes reach the real object');

assert.deepEqual(registry.currentPanels().map(([name, panel]) => registry.panelName(name, panel)), ['Alpha', 'Deck Shelves', 'Zeta']);

delete window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS.css;
assert.equal(notified, 4);
unsubscribe();
window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS.other = {};
assert.equal(notified, 4, 'unsubscribed');

console.log('Registry check passed.');
