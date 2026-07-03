import { MODULE_ID, SETTINGS } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.DEBUG, {
    name: "BOSSFORGE.Settings.Debug.Name",
    hint: "BOSSFORGE.Settings.Debug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}
