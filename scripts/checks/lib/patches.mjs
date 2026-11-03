// Runs a backend/main.lua in fengari with stub Millennium modules and returns
// its plugin table's patches, the way Millennium would read them.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');

const STUBS = `
loaded = 0
package.preload.logger = function() return {info=function() end, warn=function() end, error=function() end} end
package.preload.millennium = function() return {ready=function() loaded = loaded + 1 end} end
`;

export function runBackend(source) {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  const run = (code) => {
    if (lauxlib.luaL_dostring(state, to_luastring(code)) !== lua.LUA_OK) throw Error(to_jsstring(lua.lua_tostring(state, -1)));
  };
  run(STUBS);
  run(`plugin = (function() ${source} end)()`);
  const text = (expression) => {
    run(`return tostring(${expression})`);
    const value = to_jsstring(lua.lua_tostring(state, -1));
    lua.lua_settop(state, 0);
    return value;
  };
  const patches = [];
  for (let i = 1; i <= Number(text('#plugin.patches')); i++) {
    const transforms = [];
    for (let j = 1; j <= Number(text(`#plugin.patches[${i}].transforms`)); j++) {
      transforms.push({ match: text(`plugin.patches[${i}].transforms[${j}].match`), replace: text(`plugin.patches[${i}].transforms[${j}].replace`) });
    }
    patches.push({ file: text(`plugin.patches[${i}].file`), find: text(`plugin.patches[${i}].find`), transforms });
  }
  return { text, run, patches };
}
