-- Plugins Hub backend: makes the hub one of Steam's own Quick Access tabs, and opens
-- game pages on the chosen tab, by patching Steam's code as sp.js is served. The
-- frontend supplies what the hub's tab shows and the setting.

local logger = require("logger")
local millennium = require("millennium")

local TAB_KEY = "998"

-- Everything here goes into Millennium's patch list, which has to stay small: v3.6.2
-- stops Steam from starting if the list outgrows a pipe of about 4 KB. So the patch
-- only adds the tab; its icon and panel come from the frontend.
--
-- \1 is Steam's React module and \4 its JSX runtime (see the match below). W shows
-- one of the frontend's exports, and waits for it if the menu is opened before the
-- frontend has loaded. It is kept on window so React sees the same component if Steam
-- rebuilds the array. Without vrLocation "quick-access-menu", the tab stays out of
-- the VR dashboard.
local TAB = [[{key:]] .. TAB_KEY .. [[,title:null,strTitle:"Plugins",tab:(0,\4.jsx)(W,{n:"HubIcon"}),panel:(0,\4.jsx)(W,{n:"HubPanel"}),vrLocation:"manual"}]]
local WRAPPER = [[var W=window.__pluginsHubW||(window.__pluginsHubW=function(a){]]
    .. [[var w=window,r=\1.useState(0)[1],l=w.PLUGIN_LIST&&w.PLUGIN_LIST["plugins-hub"],P=l&&l[a.n];]]
    .. [[\1.useEffect(function(){if(P)return;var f=function(){r(1)};w.addEventListener("plugins-hub-ready",f);]]
    .. [[return function(){w.removeEventListener("plugins-hub-ready",f)}},[!P]);]]
    .. [[return P?(0,\4.jsx)(P,{}):null});]]

-- Only the first 348 px of the Quick Access view are on screen, and Steam centres
-- a dropdown's menu in all 854. For its voice chat tab, Steam slides the whole view
-- out while a menu is open, so the menu is fully visible. The hub's panels are in
-- the same position, so its tab gets the same treatment.
local EXPAND_ON_MENU = {
    {
        match = [[&&([\w$]+)==([\w$]+\.[\w$]+\.VoiceChat)$]],
        replace = [[&&(\1==\2||\1==]] .. TAB_KEY .. [[)]],
    },
}
local EXPAND_CONDITION = [[,[\w$]+=[\w$]+\|\|[\w$]+&&[\w$]+==[\w$]+\.[\w$]+\.VoiceChat]]

local patches = {
    -- The useMemo in Steam's Quick Access menu that builds its tabs.
    {
        file = [[sp\.js]],
        find = [[return [\w$]+\.useMemo\(\(\)=>\{let [\w$]+=\[[\w$]+&&\{key:[\w$]+\.[\w$]+\.VoiceChat,tab:\(0,[\w$]+\.jsx\)[\s\S]*?\]\.filter\(Boolean\)]],
        transforms = {
            {
                match = [[^return ([\w$]+)(\.useMemo\(\(\)=>\{)(let [\w$]+=\[[\w$]+&&\{key:[\w$]+\.[\w$]+\.VoiceChat,tab:\(0,)([\w$]+)([\s\S]*)\]\.filter\(Boolean\)$]],
                -- The space ends \2: Millennium reads \2var as a group named 2var.
                replace = [[return \1\2 ]] .. WRAPPER .. [[\3\4\5,]] .. TAB .. [[].filter(Boolean)]],
            },
        },
    },
    -- When the menu is its own browser view (Big Picture). Newer Steam builds already
    -- slide this view out for a menu on any tab; there this finds nothing, and
    -- Millennium skips it.
    {
        file = [[sp\.js]],
        find = [[=[\w$]+\([\w$]+\?\?void 0\)]] .. EXPAND_CONDITION,
        transforms = EXPAND_ON_MENU,
    },
    -- When the menu is embedded in the Big Picture window.
    {
        file = [[sp\.js]],
        find = [[GetContextMenuManagerFromWindow\([^)]*\)\)]] .. EXPAND_CONDITION,
        transforms = EXPAND_ON_MENU,
    },
    -- A game page's tab is part of its route, and a route without one opens Steam's
    -- first tab. That is the only case this fills in, so the page opens on the saved
    -- tab from its first render, and the tab the user picks still wins. An id Steam
    -- doesn't show, such as a tab Family View blocks, also opens Steam's first tab.
    {
        file = [[sp\.js]],
        find = [[GamepadUI\.App\.Tab\([\w$,]+\),\[\]\)[^;]*;return[^;]*?,activeTab:[\w$]+]],
        transforms = {
            {
                match = [[(,activeTab:[\w$]+)$]],
                replace = [[\1??localStorage.getItem("plugins-hub.default-game-page-tab")]],
            },
        },
    },
    -- A panel is 300 px wide and a dropdown row's control at least 270, so a row that
    -- keeps them side by side runs off the edge. Steam's own Quick Access dropdowns ask
    -- for "shift-children-below", which moves the control under the label when it
    -- doesn't fit. Inside the hub (see fieldWrap in the frontend) that is what a field
    -- gets unless the plugin chose. Everywhere else, Steam's default stays.
    {
        file = [[sp\.js]],
        find = [[[\w$]+=[\w$]+\?\?"keep-inline"[^;]*?[\w$]+\.useRef]],
        transforms = {
            {
                match = [[^([\w$]+=[\w$]+\?\?)"keep-inline"([^;]*?([\w$]+)\.useRef)$]],
                replace = [[\1(\3.useContext(window.__pluginsHubWrap??=\3.createContext(!1))?"shift-children-below":"keep-inline")\2]],
            },
        },
    },
}

local function on_load()
    logger:info("Plugins Hub backend loaded")
    millennium.ready()
end

return {
    on_load = on_load,
    patches = patches,
}
