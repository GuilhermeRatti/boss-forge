import { log } from "../logger.mjs";
import impact from "./presets/impact.mjs";
import telegraph from "./presets/telegraph.mjs";
import beam from "./presets/beam.mjs";
import aura, { clearAuras } from "./presets/aura.mjs";

/**
 * System-agnostic FX preset registry. One module per preset (id + params
 * metadata + play) — the params descriptors will also drive the M5 catalog
 * UI, so adding a preset means one file plus one import here.
 */
const REGISTRY = new Map([impact, telegraph, beam, aura].map(p => [p.id, p]));

export { clearAuras };

/**
 * @param {string} name
 * @returns {boolean} whether a preset with this name exists
 */
export function presetExists(name) {
  return REGISTRY.has(name);
}

/**
 * @returns {string[]} the available preset names
 */
export function listPresets() {
  return [...REGISTRY.keys()];
}

/**
 * @param {string} name
 * @returns {{id: string, params: Array<object>}|null} preset metadata
 */
export function describePreset(name) {
  const preset = REGISTRY.get(name);
  return preset ? { id: preset.id, params: preset.params } : null;
}

/**
 * Play a named preset. Never throws: FX must not break the mechanics
 * that triggered them.
 * @param {string} name       Preset name (see listPresets()).
 * @param {object} options    Preset params plus { locations, source }.
 * @returns {Promise<boolean>} whether the preset played
 */
export async function playPreset(name, options = {}) {
  if (!globalThis.Sequencer) {
    log.warn("FX: Sequencer is not available; skipping preset.", name);
    return false;
  }
  const preset = REGISTRY.get(name);
  if (!preset) {
    log.warn(`FX: unknown preset "${name}". Available: ${listPresets().join(", ")}`);
    return false;
  }
  try {
    const played = await preset.play(options);
    if (played) log.debug(`FX: preset "${name}" played.`, options);
    return played;
  } catch (err) {
    log.error(`FX: preset "${name}" failed.`, err);
    return false;
  }
}
