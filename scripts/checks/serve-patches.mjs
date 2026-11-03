// Applies backend/main.lua's patch to the installed Steam client's sp.js the way
// Millennium's loopback engine does, then checks the patched tab: the file still
// parses, the tab is inside the array Steam builds, and its panel shows the
// frontend's HubPanel, waiting for it if it hasn't loaded yet.
// Set STEAM_PATH if Steam isn't in the default folder.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBackend } from './lib/patches.mjs';

const steam = process.env.STEAM_PATH ?? 'C:/Program Files (x86)/Steam';
const spPath = join(steam, 'steamui/sp.js');
if (!existsSync(spPath)) {
  console.log(`Serve patch check skipped: no ${spPath}.`);
  process.exit(0);
}

const source = readFileSync(fileURLToPath(new URL('../../backend/main.lua', import.meta.url)), 'utf8');
const patches = runBackend(source).patches;
const original = readFileSync(spPath, 'utf8');

// Millennium's re2_to_rust_rep; JS replacement strings share Rust's `$N` and `$$`.
const replacement = (text) => text.replace(/\$|\\(\d)/g, (match, digit) => (digit ? `$${digit}` : '$$'));
let patched = original;
// Newer Steam builds slide the browser view out for a menu on any tab, so there the
// patch that adds the hub's tab to that condition has nothing to do.
const BROWSER_VIEW_EXPAND = 1;
const expandsForAnyMenu = /([\w$]+)=W\([\w$]+\?\?void 0\),([\w$]+)=[\w$]+\|\|\1,/.test(original);
const regions = patches.map((patch, index) => {
  assert.ok(new RegExp(patch.file).test('https://steamloopback.host/sp.js'));
  const matches = [...patched.matchAll(new RegExp(patch.find, 'g'))];
  if (index === BROWSER_VIEW_EXPAND && matches.length === 0 && expandsForAnyMenu) {
    console.log('This Steam already slides the browser view out for every menu; that patch is skipped.');
    return null;
  }
  assert.equal(matches.length, 1, `find must match exactly once: ${patch.find}`);
  const [found] = matches;
  assert.ok(found[0].length < 8192, 'find must stay inside its code');
  let region = found[0];
  for (const { match, replace } of patch.transforms) {
    // Rust reads a whole name after the $, where JS stops at the digit: "\2var" is
    // a group called 2var, which is empty, and the broken result makes Millennium
    // revert every plugin's patches to this file.
    assert.ok(!/\\\d\w/.test(replace), `a group followed by a letter, digit or _ is lost in Rust: ${replace}`);
    assert.ok(new RegExp(match).test(region), `transform must match: ${match}`);
    region = region.replace(new RegExp(match, 'g'), replacement(replace));
  }
  assert.notEqual(region, found[0]);
  patched = patched.slice(0, found.index) + region + patched.slice(found.index + found[0].length);
  return region;
});
new Function(patched);

// The view expands for the hub as it does for voice chat, in both forms of the menu.
for (const expand of regions.slice(1, 3).filter(Boolean)) {
  const condition = /&&\(([\w$]+)==[\w$]+\.[\w$]+\.VoiceChat\|\|([\w$]+)==998\)$/.exec(expand);
  assert.ok(condition && condition[1] === condition[2], `the condition must cover both tabs: ${expand}`);
}
const [region] = regions;

// A game page opens on the saved tab only when its route names no tab, and the key
// is the one the frontend writes.
const gameTab = /,activeTab:(([\w$]+)\?\?localStorage\.getItem\("([^"]+)"\))$/.exec(regions[3]);
assert.ok(gameTab, `the active tab must fall back to the saved one: ${regions[3]}`);
assert.ok(regions[3].startsWith('GamepadUI.App.Tab('), 'only the game page');
assert.ok(readFileSync(fileURLToPath(new URL('../../frontend/game-tab.ts', import.meta.url)), 'utf8').includes(`'${gameTab[3]}'`));
const activeTab = new Function(gameTab[2], 'localStorage', `return ${gameTab[1]};`);
const saved = (value) => ({ getItem: () => value });
assert.equal(activeTab(undefined, saved('YourStuff')), 'YourStuff');
assert.equal(activeTab('Community', saved('YourStuff')), 'Community', 'the tab in the route wins');
assert.equal(activeTab(undefined, saved(null)), null, "nothing saved leaves Steam's default");

// Fields wrap inside the hub only, and a plugin's own choice still wins.
const wrap = /^([\w$]+)=([\w$]+)\?\?(\(([\w$]+)\.useContext\(window\.__pluginsHubWrap\?\?=\4\.createContext\(!1\)\)\?"shift-children-below":"keep-inline"\))/.exec(regions[4]);
assert.ok(wrap, `fields must read the hub's context: ${regions[4]}`);
assert.ok(regions[4].endsWith(`${wrap[4]}.useRef`), 'the React name must be the one the component uses');
assert.ok(readFileSync(fileURLToPath(new URL('../../frontend/index.tsx', import.meta.url)), 'utf8').includes('window.__pluginsHubWrap ??= createContext(false)'));
const fieldWrap = new Function(wrap[2], wrap[4], 'window', `return ${wrap[2]}??${wrap[3]};`);
const fieldReact = (value) => ({ useContext: () => value, createContext: () => ({}) });
assert.equal(fieldWrap(undefined, fieldReact(true), {}), 'shift-children-below');
assert.equal(fieldWrap(undefined, fieldReact(false), {}), 'keep-inline', "outside the hub, Steam's default");
assert.equal(fieldWrap('keep-inline', fieldReact(true), {}), 'keep-inline', "a plugin's choice wins");
const fieldWindow = {};
fieldWrap(undefined, fieldReact(false), fieldWindow);
assert.ok(fieldWindow.__pluginsHubWrap, 'the context exists before the frontend has loaded');

// Millennium v3.6.2 stops Steam from starting if the whole patch list outgrows a pipe
// of about 4 KB, shared with every other plugin.
const bytes = patches.reduce((sum, { file, find, transforms }) => sum + file.length + find.length + transforms.reduce((n, { match, replace }) => n + match.length + replace.length, 0), 0);
assert.ok(bytes < 1500, `the patches must stay small: ${bytes} bytes`);

// The tab and its wrapper, without Steam: a fake React and JSX runtime.
const names = /^return ([\w$]+)\.useMemo\(\(\)=>\{ var W=/.exec(region);
assert.ok(names, 'the wrapper must be defined inside the useMemo');
const jsxName = /tab:\(0,([\w$]+)\.jsx\)\(W,/.exec(region)[1];
const wrapperSource = region.slice(region.indexOf('var W='), region.indexOf(';let ') + 1);
const tabStart = region.lastIndexOf('{key:998');
assert.ok(tabStart > 0, 'the tab must be in the array');
const tabSource = region.slice(tabStart, region.lastIndexOf('].filter(Boolean)'));

const effects = [];
const state = { renders: 0 };
const React = {
  useState: () => [0, () => { state.renders += 1; }],
  useEffect: (effect) => effects.push(effect),
};
const jsx = { jsx: (type, props) => ({ type, props }) };
const listeners = new Map();
const fakeWindow = {
  addEventListener: (name, listener) => listeners.set(name, listener),
  removeEventListener: (name) => listeners.delete(name),
};
const tab = new Function(names[1], jsxName, 'window', `${wrapperSource} return ${tabSource};`)(React, jsx, fakeWindow);

assert.equal(tab.key, 998);
assert.equal(tab.strTitle, 'Plugins');
assert.notEqual(tab.vrLocation, 'quick-access-menu', 'the tab stays out of the VR dashboard');

// Opened before the frontend has loaded: nothing yet, and it waits for the event.
const Wrapper = tab.panel.type;
assert.equal(Wrapper, fakeWindow.__pluginsHubW, 'one component, kept on window');
assert.equal(tab.tab.type, Wrapper);
assert.equal(Wrapper(tab.panel.props), null);
const cleanup = effects.pop()();
assert.ok(listeners.has('plugins-hub-ready'));
listeners.get('plugins-hub-ready')();
assert.equal(state.renders, 1, 'the event re-renders the wrapper');
cleanup();
assert.equal(listeners.size, 0);

// Loaded: shows the frontend's exports and doesn't listen.
const HubPanel = () => null;
const HubIcon = () => null;
fakeWindow.PLUGIN_LIST = { 'plugins-hub': { HubPanel, HubIcon } };
assert.equal(Wrapper(tab.panel.props).type, HubPanel);
assert.equal(Wrapper(tab.tab.props).type, HubIcon);
assert.equal(effects.pop()(), undefined);
assert.equal(listeners.size, 0);

console.log('Serve patch check passed against the installed sp.js.');
