import { MODULE_ID, MODULE_TITLE, SETTINGS } from "./constants.mjs";

const PREFIX = `${MODULE_TITLE} |`;

function debugEnabled() {
  // Settings are not available before the "init" hook fires; fail closed.
  try {
    return game.settings.get(MODULE_ID, SETTINGS.DEBUG);
  } catch {
    return false;
  }
}

export const log = {
  debug(...args) {
    if (debugEnabled()) console.debug(PREFIX, ...args);
  },
  info(...args) {
    console.log(PREFIX, ...args);
  },
  warn(...args) {
    console.warn(PREFIX, ...args);
  },
  error(...args) {
    console.error(PREFIX, ...args);
  }
};
