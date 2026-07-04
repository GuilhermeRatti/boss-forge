import { MODULE_ID, FLAGS } from "../constants.mjs";
import { log } from "../logger.mjs";
import { playFx, assertValidFxConfig } from "../fx/presets.mjs";

/**
 * Macro/API helpers to attach an FX preset to a legendary action item
 * (flags.boss-forge.fx). UI for this arrives with the Boss Designer; in M1
 * the GM calls game.modules.get("boss-forge").api.legendary.setItemFx(...).
 */

/**
 * Attach FX to an item: a single preset (name + options) or a composition —
 * an array of steps [{preset, options, delay?}] played in order, each delay
 * in ms relative to the previous step's start.
 * @param {Item} item
 * @param {string|Array} preset                 Preset name, or an array of steps.
 * @param {object} [options]                    Preset options (single form);
 *   `options.at` ("boss"|"targets") applies to compositions too.
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
  const config = Array.isArray(preset)
    ? { steps: preset, at: options.at }
    : { preset, options };
  assertValidFxConfig(Array.isArray(preset) ? preset : config);
  // Foundry merges object flags on setFlag; unset first so shape switches
  // (single <-> composition) and dropped option keys never leave residue.
  await item.unsetFlag(MODULE_ID, FLAGS.FX);
  return item.setFlag(MODULE_ID, FLAGS.FX, config);
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
  if (!fx) return;
  const at = fx.at ?? fx.options?.at;
  const locations = resolveLocations(at, combatant);
  if (!locations.length) {
    log.debug(`FX: no locations resolved for "${item.name}" (at: ${at}).`);
    return;
  }
  const source = combatant.token?.object ?? combatant.token;
  const userTargets = [...game.user.targets];
  const config = fx.steps
    ? fx.steps
    : { preset: fx.preset, options: (({ at: _at, ...rest }) => rest)(fx.options ?? {}) };
  await playFx(config, {
    locations,
    source,
    targets: userTargets.length ? userTargets : undefined
  });
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
