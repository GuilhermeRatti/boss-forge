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

  game.settings.register(MODULE_ID, SETTINGS.LEGENDARY_PROMPT, {
    name: "BOSSFORGE.Settings.LegendaryPrompt.Name",
    hint: "BOSSFORGE.Settings.LegendaryPrompt.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
