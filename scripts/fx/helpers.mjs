import { MODULE_TITLE } from "../constants.mjs";
import { log } from "../logger.mjs";

/**
 * Shared helpers for FX preset modules. This folder stays system-agnostic:
 * no dnd5e imports, presets receive plain tokens/points/paths.
 */

export function newSequence() {
  return new Sequence({ moduleName: MODULE_TITLE, softFail: true });
}

/**
 * Check that a Sequencer database path exists. Direct file paths (anything
 * containing a slash) are passed through and left to softFail at play time.
 * @param {string} file
 * @returns {boolean}
 */
export function validateFile(file) {
  if (typeof file !== "string" || !file) return false;
  if (file.includes("/") || file.includes("\\")) return true;
  if (!Sequencer.Database.entryExists(file)) {
    log.warn(`FX: Sequencer database entry "${file}" does not exist; skipping effect.`);
    return false;
  }
  return true;
}

/**
 * @param {object} location  Token placeable, TokenDocument or point
 * @returns {string|null} a stable uuid for tokens, null for plain points
 */
export function locationUuid(location) {
  return location?.document?.uuid ?? location?.uuid ?? null;
}

/**
 * Fit an effect to a MeasuredTemplate location (no-op for anything else):
 * cones and rays stretch from the template origin to its endpoint (Sequencer
 * rotates and scales along it); circles are sized to the template diameter;
 * 5e "rect" cubes (stored as a 45° diagonal) are sized to their side.
 * Distances are scene units (ft) — converted to grid squares for .size().
 * @param {object} effect    A Sequencer EffectSection (already atLocation'd).
 * @param {object} location  The template placeable or document.
 */
export function applyTemplateFit(effect, location) {
  const doc = location?.document ?? location;
  const type = doc?.t;
  if (!type) return;
  if (type === "cone" || type === "ray") {
    effect.stretchTo(location);
    return;
  }
  const unit = canvas.scene?.grid?.distance || 5;
  if (type === "circle") {
    effect.size(((doc.distance ?? unit) * 2) / unit, { gridUnits: true });
  } else if (type === "rect") {
    // dnd5e cubes store distance as the 45° diagonal (side = d / sqrt(2))
    const side = (doc.distance ?? unit) / Math.SQRT2;
    effect.size(side / unit, { gridUnits: true });
  }
}
