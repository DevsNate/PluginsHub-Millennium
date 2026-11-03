// The tab game pages open on. backend/main.lua reads this key each time a game page
// renders without a tab in its route, so the value is one of Steam's own tab ids, or
// nothing for Steam's default.
const STORAGE_KEY = 'plugins-hub.default-game-page-tab';

export const STEAM_DEFAULT = 'default';

export const GAME_TAB_OPTIONS = [
  { data: STEAM_DEFAULT, label: 'Steam Default' },
  { data: 'WhatsNew', label: 'Activity' },
  { data: 'YourStuff', label: 'Your Stuff' },
  { data: 'Community', label: 'Community' },
  { data: 'GameInfo', label: 'Game Info' },
];

// What earlier versions of the hub saved under the same key.
const EARLIER_VALUES: Record<string, string | null> = {
  'steam-default': null,
  activity: 'WhatsNew',
  'your-stuff': 'YourStuff',
  community: 'Community',
  'game-info': 'GameInfo',
};

export const readGameTab = () => localStorage.getItem(STORAGE_KEY) ?? STEAM_DEFAULT;

export const writeGameTab = (tab: string) => {
  if (tab === STEAM_DEFAULT) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, tab);
};

export const migrateGameTab = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null || !(saved in EARLIER_VALUES)) return;
  writeGameTab(EARLIER_VALUES[saved] ?? STEAM_DEFAULT);
};
