import { MODULE_ID, FLAGS } from "../constants.mjs";
import { log } from "../logger.mjs";
import { playPreset, presetExists, listPresets } from "../fx/presets.mjs";

/**
 * Macro/API helpers to attach an FX preset to a legendary action item
 * (flags.boss-forge.fx). UI for this arrives with the Boss Designer; in M1
 * the GM calls game.modules.get("boss-forge").api.legendary.setItemFx(...).
 */

/**
 * @param {Item} item
 * @param {string} preset                       Preset name (M1: "impact").
 * @param {object} [options]                    Preset options.
 * @param {string} options.file                 Sequencer database path or file path.
 * @param {"boss"|"targets"} [options.at]       Where to play (default "boss").
 * @param {number} [options.scale]
 * @param {number} [options.delay]
 * @returns {Promise<Item>}
 */
export async function setItemFx(item, preset, options = {}) {
  if (item == null) {
    throw new Error(
      "setItemFx: item is null/undefined. If you used actor.items.getName(...), the name was not found — "
      + "it is case-sensitive and must match the item (first half of the prompt button label, before the colon)."
    );
  }
  if (!(item instanceof Item)) throw new Error("setItemFx: first argument must be an Item document.");
  if (!presetExists(preset)) {
    throw new Error(`setItemFx: unknown preset "${preset}". Available: ${listPresets().join(", ")}`);
  }
  return item.setFlag(MODULE_ID, FLAGS.FX, { preset, options });
}

/**
 * @param {Item} item
 * @returns {Promise<Item>}
 */
export async function clearItemFx(item) {
  return item.unsetFlag(MODULE_ID, FLAGS.FX);
}

/**
 * @param {Item} item
 * @returns {{preset: string, options: object}|undefined}
 */
export function getItemFx(item) {
  return item.getFlag(MODULE_ID, FLAGS.FX);
}

/**
 * Play the FX preset configured on the item (flags.boss-forge.fx), if any.
 * FX failures never propagate into the action economy.
 * @param {Item} item
 * @param {Combatant} combatant
 */
export async function playItemFx(item, combatant) {
  const fx = getItemFx(item);
  if (!fx?.preset) return;
  const { at, ...options } = fx.options ?? {};
  const locations = resolveLocations(at, combatant);
  if (!locations.length) {
    log.debug(`FX: no locations resolved for "${item.name}" (at: ${at}).`);
    return;
  }
  await playPreset(fx.preset, { ...options, locations });
}

/**
 * "boss" (default) plays on the boss token; "targets" plays on the GM's
 * currently targeted tokens, falling back to the boss token.
 * @param {"boss"|"targets"|undefined} at
 * @param {Combatant} combatant
 * @returns {Array<object>}
 */
function resolveLocations(at, combatant) {
  if (at === "targets") {
    const targets = [...game.user.targets];
    if (targets.length) return targets;
  }
  const token = combatant.token?.object ?? combatant.token;
  return token ? [token] : [];
}
