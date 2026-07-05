import { MODULE_ID, FLAGS } from "../constants.mjs";
import { log } from "../logger.mjs";
import { playFx, assertValidFxConfig, configUsesTemplate } from "../fx/presets.mjs";

/**
 * Template-anchored FX: when any step of an item's FX config anchors on
 * "template", playback waits for the GM to actually place the measured
 * template. dnd5e stamps flags.dnd5e.item (item uuid) on templates created
 * by activities (native flow, Midi and straight-from-the-sheet casts all
 * pass through it), so the createMeasuredTemplate hook resolves the item
 * directly. Runs only on the placing client — Sequencer broadcasts.
 */
export function registerTemplateFx() {
  Hooks.on("createMeasuredTemplate", onTemplatePlaced);
}

async function onTemplatePlaced(templateDoc, options, userId) {
  try {
    if (userId !== game.user.id) return;
    const itemUuid = templateDoc.getFlag("dnd5e", "item");
    if (!itemUuid) return;
    const item = await fromUuid(itemUuid);
    if (!item) return;
    const fx = getItemFx(item);
    // The RAW flag goes to both the check and playFx: normalizeFxSteps
    // handles every stored shape (single, steps, wrapper-level at) and
    // playFx strips per-step at itself.
    if (!fx || !configUsesTemplate(fx)) return;
    const template = templateDoc.object ?? templateDoc;
    const tokenDoc = item.actor?.token ?? item.actor?.getActiveTokens(false, true)[0];
    const source = tokenDoc?.object ?? tokenDoc;
    const userTargets = [...game.user.targets];
    log.debug(`Template FX for "${item.name}" (template t=${templateDoc.t}).`);
    await playFx(fx, {
      locations: [template],
      source,
      targets: userTargets.length ? userTargets : undefined,
      template
    });
  } catch (err) {
    log.error("Template-anchored FX failed.", err);
  }
}

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
  // Template-anchored configs are played by onTemplatePlaced after the GM
  // places the template — checked on the RAW flag before any reshaping.
  if (configUsesTemplate(fx)) {
    log.debug(`FX for "${item.name}" anchors on a template; waiting for placement.`);
    return;
  }
  const token = combatant.token?.object ?? combatant.token;
  if (!token) {
    log.debug(`FX: no token resolved for "${item.name}".`);
    return;
  }
  const userTargets = [...game.user.targets];
  // Default locations = the boss token; per-step anchors (including the
  // legacy flag-level at, propagated by normalizeFxSteps) pick targets.
  await playFx(fx, {
    locations: [token],
    source: token,
    targets: userTargets.length ? userTargets : undefined
  });
}
