/**
 * Plugins Hub - a Big Picture Quick Access hub for Millennium plugins.
 * Copyright (C) 2026 DevsNate
 *
 * The panel layout is adapted from Decky Loader's frontend, GPLv2 software
 * maintained by its contributors. This modified work is distributed under GPLv2.
 */
import {
  ButtonItem,
  definePlugin,
  DialogButton,
  DropdownItem,
  ErrorBoundary,
  Focusable,
  Navigation,
  PanelSection,
  PanelSectionRow,
  staticClasses,
} from 'millennium';
import { cloneElement, createContext, isValidElement, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Context, CSSProperties, ReactElement } from 'react';
import { GAME_TAB_OPTIONS, migrateGameTab, readGameTab, writeGameTab } from './game-tab';
import { BsGearFill, FaArrowLeft, FaPlug } from './icons';
import { currentPanels, getRevision, panelName, subscribe, watchRegistry } from './registry';
import type { PluginPanel } from './registry';

declare global {
  interface Window {
    __pluginsHubWrap?: Context<boolean>;
  }
}

// Read by Steam's field component, through backend/main.lua's patch: inside the hub,
// a field moves its control under its label when the two don't fit side by side.
const FieldWrap = (window.__pluginsHubWrap ??= createContext(false));

const titleStyles: CSSProperties = {
  display: 'flex',
  paddingRight: '16px',
  position: 'sticky',
  top: '0px',
};

const titleButtonStyles: CSSProperties = { height: '28px', width: '40px', minWidth: 0, padding: '10px 12px' };
const titleIconStyles: CSSProperties = { marginTop: '-4px', display: 'block' };

const sizedIcon = (icon?: ReactElement) => {
  if (!icon || !isValidElement(icon)) return <FaPlug />;
  const style = (icon.props as { style?: CSSProperties }).style;
  return cloneElement(icon as ReactElement<{ style?: CSSProperties }>, {
    style: { ...style, width: '1em', height: '1em', maxWidth: '1em', maxHeight: '1em' },
  });
};

const openMillenniumSettings = () => {
  Navigation.Navigate('/millennium/settings');
  Navigation.CloseSideMenus();
};

const PanelView = ({ pluginName, panel, goBack }: { pluginName: string; panel: PluginPanel; goBack: () => void }) => (
  <Focusable onCancelButton={goBack}>
    <Focusable className={staticClasses.Title} style={titleStyles}>
      <DialogButton style={titleButtonStyles} onClick={goBack}>
        <FaArrowLeft style={titleIconStyles} />
      </DialogButton>
      {panel.titleView ?? <div style={{ flex: 0.9 }}>{panelName(pluginName, panel)}</div>}
    </Focusable>
    <div style={{ height: '100%', paddingTop: '16px' }}>
      <ErrorBoundary>{panel.content}</ErrorBoundary>
    </div>
  </Focusable>
);

const PanelList = ({ panels, open }: { panels: [string, PluginPanel][]; open: (pluginName: string) => void }) => (
  <>
    <Focusable style={titleStyles} className={staticClasses.Title}>
      <div style={{ marginRight: 'auto', flex: 0.9 }}>Plugins</div>
      <DialogButton style={titleButtonStyles} onClick={openMillenniumSettings} onOKActionDescription="Millennium settings">
        <BsGearFill style={titleIconStyles} />
      </DialogButton>
    </Focusable>
    <div style={{ paddingTop: '16px' }}>
      <PanelSection>
        {panels.length ? (
          panels.map(([pluginName, panel]) => (
            <PanelSectionRow key={pluginName}>
              <ButtonItem layout="below" onClick={() => open(pluginName)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {sizedIcon(panel.icon)}
                  <div>{panelName(pluginName, panel)}</div>
                </div>
              </ButtonItem>
            </PanelSectionRow>
          ))
        ) : (
          <PanelSectionRow>No configurable Millennium plugins were found.</PanelSectionRow>
        )}
      </PanelSection>
    </div>
  </>
);

const HubView = () => {
  const [activeName, setActiveName] = useState<string | null>(null);
  const revision = useSyncExternalStore(subscribe, getRevision);
  const panels = useMemo(currentPanels, [revision]);
  const active = activeName ? panels.find(([pluginName]) => pluginName === activeName) : undefined;

  useEffect(() => {
    if (activeName && !active) setActiveName(null);
  }, [active, activeName]);

  return active ? (
    <PanelView pluginName={active[0]} panel={active[1]} goBack={() => setActiveName(null)} />
  ) : (
    <PanelList panels={panels} open={setActiveName} />
  );
};

const HubSettings = () => {
  const [gameTab, setGameTab] = useState(readGameTab);

  return (
    <PanelSection>
      <PanelSectionRow>
        <DropdownItem
          label="Default game page tab"
          description="The tab game pages open on."
          rgOptions={GAME_TAB_OPTIONS}
          selectedOption={gameTab}
          onChange={({ data }) => {
            setGameTab(data);
            writeGameTab(data);
          }}
        />
      </PanelSectionRow>
    </PanelSection>
  );
};

// Rendered by the tab backend/main.lua adds to Steam's Quick Access menu.
export const HubIcon = FaPlug;
export const HubPanel = () => (
  <FieldWrap.Provider value={true}>
    <ErrorBoundary>
      <HubView />
    </ErrorBoundary>
  </FieldWrap.Provider>
);

watchRegistry();
migrateGameTab();

export default definePlugin(() => {
  window.dispatchEvent(new Event('plugins-hub-ready'));
  return {
    title: 'Plugins Hub',
    icon: <FaPlug />,
    content: <HubSettings />,
  };
});
