import { MODULE_ID, FLAGS } from "../constants.mjs";
import { presetExists, listPresets } from "../fx/presets.mjs";

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
  if (!(item instanceof Item)) throw new Error("setItemFx: first argument must be an Item.");
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
