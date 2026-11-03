// The panels Millennium plugins register. Millennium keeps them on a plain
// object and sends no event when a plugin adds one, but every plugin writes to
// it through window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS when it finishes
// loading, so a Proxy on that global sees each change as it happens.
import type { ReactElement } from 'react';

export type PluginPanel = {
  title?: unknown;
  titleView?: ReactElement;
  icon?: ReactElement;
  content?: ReactElement;
  alwaysRender?: boolean;
};

export type PluginRegistry = Record<string, PluginPanel>;

declare global {
  interface Window {
    MILLENNIUM_SIDEBAR_NAVIGATION_PANELS?: PluginRegistry;
  }
}

const listeners = new Set<() => void>();
let revision = 0;
let target: PluginRegistry | undefined;

const changed = () => {
  revision += 1;
  for (const listener of listeners) listener();
};

export function watchRegistry() {
  if (target) return;
  target = window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS ?? {};
  window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS = new Proxy(target, {
    set(object, key, value) {
      const done = Reflect.set(object, key, value);
      changed();
      return done;
    },
    deleteProperty(object, key) {
      const done = Reflect.deleteProperty(object, key);
      changed();
      return done;
    },
  });
}

// For useSyncExternalStore.
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getRevision = () => revision;

export const panelName = (pluginName: string, panel: PluginPanel) => {
  if (typeof panel.title === 'string' && panel.title.trim()) return panel.title;
  return pluginName
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const currentPanels = () =>
  Object.entries(window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS ?? {})
    .filter(([, panel]) => Boolean(panel?.content))
    .sort(([nameA, panelA], [nameB, panelB]) => panelName(nameA, panelA).localeCompare(panelName(nameB, panelB)));
