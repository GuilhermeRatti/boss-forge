import { MODULE_ID, SETTINGS } from "./constants.mjs";

/**
 * Declarative settings registry. Name/Hint i18n keys derive from the setting
 * key (BOSSFORGE.Settings.<CapitalizedKey>.Name/Hint), choice labels from
 * <CapitalizedKey>.<CapitalizedChoice>. Registration order = display order,
 * grouped by feature; new settings only need an entry here plus the strings.
 */
const SETTINGS_SCHEMA = {
  // Module-wide
  [SETTINGS.DEBUG]: { scope: "client", type: Boolean, default: false },
  // Legendary actions (M1)
  [SETTINGS.LEGENDARY_PROMPT]: { scope: "world", type: Boolean, default: true },
  // Legendary resistance (M2)
  [SETTINGS.LEGRES_PROMPT]: { scope: "world", type: Boolean, default: true },
  [SETTINGS.LEGRES_AUTO_BURN]: { scope: "world", type: Boolean, default: false },
  [SETTINGS.LEGRES_CHAT_VISIBILITY]: { scope: "world", type: String, default: "public", choices: ["public", "gm"] },
  [SETTINGS.LEGRES_TIMEOUT]: { scope: "world", type: Number, default: 60, range: { min: 10, max: 300, step: 5 } }
};

function capitalize(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function registerSettings() {
  for (const [key, def] of Object.entries(SETTINGS_SCHEMA)) {
    const i18nBase = `BOSSFORGE.Settings.${capitalize(key)}`;
    const config = {
      name: `${i18nBase}.Name`,
      hint: `${i18nBase}.Hint`,
      scope: def.scope,
      config: true,
      type: def.type,
      default: def.default
    };
    if (def.choices) {
      config.choices = Object.fromEntries(def.choices.map(c => [c, `${i18nBase}.${capitalize(c)}`]));
    }
    if (def.range) config.range = def.range;
    game.settings.register(MODULE_ID, key, config);
  }
}
