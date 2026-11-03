// The saved game page tab: Steam's own ids, nothing stored for Steam's default, and
// values from earlier versions of the hub converted once.
import assert from 'node:assert/strict';
import { createLoader } from './lib/load-ts.mjs';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};
const KEY = 'plugins-hub.default-game-page-tab';
const gameTab = createLoader()('frontend/game-tab.ts');

assert.equal(gameTab.readGameTab(), gameTab.STEAM_DEFAULT);
gameTab.writeGameTab('YourStuff');
assert.equal(store.get(KEY), 'YourStuff');
assert.equal(gameTab.readGameTab(), 'YourStuff');
gameTab.writeGameTab(gameTab.STEAM_DEFAULT);
assert.ok(!store.has(KEY), "Steam's default stores nothing, so the patch falls through to Steam");

for (const [earlier, current] of [['activity', 'WhatsNew'], ['your-stuff', 'YourStuff'], ['community', 'Community'], ['game-info', 'GameInfo']]) {
  store.set(KEY, earlier);
  gameTab.migrateGameTab();
  assert.equal(store.get(KEY), current);
  gameTab.migrateGameTab();
  assert.equal(store.get(KEY), current, 'a converted value stays');
}
store.set(KEY, 'steam-default');
gameTab.migrateGameTab();
assert.ok(!store.has(KEY));
gameTab.migrateGameTab();
assert.ok(!store.has(KEY));

assert.deepEqual(gameTab.GAME_TAB_OPTIONS.map(({ label }) => label), ['Steam Default', 'Activity', 'Your Stuff', 'Community', 'Game Info']);

console.log('Game tab check passed.');
