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
