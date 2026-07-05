import { log } from "../logger.mjs";
import impact from "./presets/impact.mjs";
import telegraph from "./presets/telegraph.mjs";
import beam from "./presets/beam.mjs";
import rain from "./presets/rain.mjs";
import aura, { clearAuras } from "./presets/aura.mjs";

/**
 * System-agnostic FX preset registry. One module per preset (id + params
 * metadata + play) — the params descriptors will also drive the M5 catalog
 * UI, so adding a preset means one file plus one import here.
 */
const REGISTRY = new Map([impact, telegraph, beam, rain, aura].map(p => [p.id, p]));

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
 * Normalize an FX flag config into a list of steps.
 * Accepted shapes: {preset, options, delay?, at?, fit?}, an array of those,
 * or {steps: [...], at?} — a wrapper-level `at` becomes the default anchor
 * for steps that do not set their own. Returns [] for anything else.
 * @param {object|Array} config
 * @returns {Array<{preset: string, options?: object, delay?: number, at?: string, fit?: boolean}>}
 */
export function normalizeFxSteps(config) {
  if (!config) return [];
  const wrapperAt = (!Array.isArray(config) && Array.isArray(config.steps)) ? config.at : undefined;
  const steps = Array.isArray(config) ? config : (Array.isArray(config.steps) ? config.steps : [config]);
  return steps
    .filter(s => s && typeof s.preset === "string")
    .map(s => (wrapperAt && !(s.at ?? s.options?.at)) ? { ...s, at: wrapperAt } : s);
}

/**
 * Play an FX config — a single {preset, options} or a composition of steps.
 * Steps are SCHEDULED, not serialized: each step's `delay` (ms) is relative
 * to the previous step's start, so delay 0 overlaps two animations and a
 * chain of delays staggers them. Each step may anchor independently via
 * `at`: "boss" (the source token), "targets" (the current targets) or
 * unset (inherit the context's default locations). Never throws.
 * @param {object|Array} config
 * @param {object} [context]  { locations, source, targets }
 * @returns {Promise<boolean>} whether at least one step played
 */
export async function playFx(config, context = {}) {
  const steps = normalizeFxSteps(config);
  if (!steps.length) return false;
  const { locations = [], source, targets, template } = context;

  let offset = 0;
  const runs = steps.map(step => {
    if (typeof step.delay === "number" && step.delay > 0) offset += step.delay;
    const at = step.at ?? step.options?.at;
    const stepLocations = at === "targets"
      ? (targets?.length ? targets : locations)
      : at === "boss"
        ? (source ? [source] : locations)
        : at === "template"
          ? (template ? [template] : locations)
          : locations;
    const options = { ...(step.options ?? {}) };
    delete options.at;
    if (step.fit) options.fit = true;
    const when = offset;
    return new Promise(resolve => {
      setTimeout(() => {
        playPreset(step.preset, { ...options, locations: stepLocations, source }).then(resolve);
      }, when);
    });
  });

  const results = await Promise.all(runs);
  return results.some(Boolean);
}

/**
 * Whether any step of a config anchors on a placed template — such configs
 * are played by the createMeasuredTemplate listener (after the GM places
 * the template), not immediately on activity use.
 * @param {object|Array} config
 * @returns {boolean}
 */
export function configUsesTemplate(config) {
  return normalizeFxSteps(config).some(s => (s.at ?? s.options?.at) === "template");
}

/**
 * Validate a config for storage in an FX flag. Validates the RAW steps (not
 * the normalized list) so malformed entries in a mixed array are rejected
 * instead of silently dropped. Throws with a helpful message.
 * @param {object|Array} config
 */
export function assertValidFxConfig(config) {
  const raw = Array.isArray(config)
    ? config
    : (Array.isArray(config?.steps) ? config.steps : [config]);
  if (!raw.length) {
    throw new Error(`FX config must be {preset, options} or a non-empty array of steps. Available presets: ${listPresets().join(", ")}`);
  }
  for (const step of raw) {
    if (!step || typeof step.preset !== "string") {
      throw new Error("FX config: each step must be an object {preset, options?, delay?, at?} with a string preset.");
    }
    if (!presetExists(step.preset)) {
      throw new Error(`Unknown preset "${step.preset}". Available: ${listPresets().join(", ")}`);
    }
  }
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
