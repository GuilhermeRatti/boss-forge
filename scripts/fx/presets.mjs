import { MODULE_TITLE } from "../constants.mjs";
import { log } from "../logger.mjs";

/**
 * System-agnostic FX preset engine (M1 scope: the single "impact" preset).
 *
 * This folder must stay free of dnd5e-specific imports: presets receive
 * plain parameters (files, tokens/points) and only talk to Sequencer.
 */

/**
 * @typedef {object} ImpactOptions
 * @property {string} file                  Sequencer database path (e.g. "jb2a....") or a direct file path.
 * @property {Array<object>} [locations]    Tokens, token documents or {x, y} points to play the effect at.
 * @property {number} [scale]               Uniform effect scale.
 * @property {number} [delay]               Delay in milliseconds before the effect plays.
 */

/**
 * Play a single impact effect at each provided location.
 * @param {ImpactOptions} options
 * @returns {Promise<boolean>} whether the sequence was played
 */
async function impact({ file, locations = [], scale, delay } = {}) {
  if (!file || !locations.length) {
    log.debug("FX impact: missing file or locations, skipping.", { file, locations });
    return false;
  }
  if (!validateFile(file)) return false;

  const sequence = new Sequence({ moduleName: MODULE_TITLE, softFail: true });
  for (const location of locations) {
    const effect = sequence.effect().file(file).atLocation(location);
    if (typeof scale === "number") effect.scale(scale);
    if (typeof delay === "number") effect.delay(delay);
  }
  await sequence.play();
  return true;
}

const PRESETS = { impact };

/**
 * Check that a Sequencer database path exists. Direct file paths (anything
 * containing a slash) are passed through and left to softFail at play time.
 * @param {string} file
 * @returns {boolean}
 */
function validateFile(file) {
  if (file.includes("/") || file.includes("\\")) return true;
  if (!Sequencer.Database.entryExists(file)) {
    log.warn(`FX: Sequencer database entry "${file}" does not exist; skipping effect.`);
    return false;
  }
  return true;
}

/**
 * @param {string} name
 * @returns {boolean} whether a preset with this name exists
 */
export function presetExists(name) {
  return name in PRESETS;
}

/**
 * @returns {string[]} the available preset names
 */
export function listPresets() {
  return Object.keys(PRESETS);
}

/**
 * Play a named preset. Never throws: FX must not break the mechanics
 * that triggered them.
 * @param {string} name           Preset name (M1: "impact").
 * @param {object} options        Preset-specific options.
 * @returns {Promise<boolean>} whether the preset played
 */
export async function playPreset(name, options = {}) {
  if (!globalThis.Sequencer) {
    log.warn("FX: Sequencer is not available; skipping preset.", name);
    return false;
  }
  const preset = PRESETS[name];
  if (!preset) {
    log.warn(`FX: unknown preset "${name}". Available: ${listPresets().join(", ")}`);
    return false;
  }
  try {
    const played = await preset(options);
    if (played) log.debug(`FX: preset "${name}" played.`, options);
    return played;
  } catch (err) {
    log.error(`FX: preset "${name}" failed.`, err);
    return false;
  }
}
