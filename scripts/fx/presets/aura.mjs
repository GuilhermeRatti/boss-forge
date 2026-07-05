import { newSequence, validateFile, locationUuid } from "../helpers.mjs";
import { log } from "../../logger.mjs";

function auraOrigin(location) {
  const uuid = locationUuid(location);
  return uuid ? `boss-forge.aura.${uuid}` : null;
}

/**
 * Persistent effect attached to the token (enrage glows, phase auras).
 * Survives reloads (Sequencer persists it in the scene); ended
 * deterministically via clearAuras thanks to the origin tag.
 */
export default {
  id: "aura",
  params: [
    { key: "file", type: "file", required: true },
    { key: "scale", type: "number" },
    { key: "opacity", type: "number", default: 0.75 },
    { key: "fadeIn", type: "number", default: 500 },
    { key: "belowToken", type: "boolean", default: true }
  ],
  // Auras attach to tokens; template snapshots and plain points have no
  // stable uuid to persist/clear on, so those fall back to the source token
  // (an anchorless aura step in a template composition means "the boss").
  async play({ file, locations = [], source, scale, opacity = 0.75, fadeIn = 500, belowToken = true } = {}) {
    if (!locations.length || !validateFile(file)) return false;
    const sequence = newSequence();
    let queued = 0;
    for (const location of locations) {
      const anchor = auraOrigin(location) ? location : source;
      const origin = auraOrigin(anchor);
      if (!origin) {
        log.warn("FX aura: location has no stable uuid (template or plain point) and no source token; skipping.");
        continue;
      }
      const effect = sequence.effect()
        .file(file)
        .attachTo(anchor)
        .persist(true)
        .origin(origin)
        .opacity(opacity)
        .fadeIn(fadeIn)
        .belowTokens(belowToken);
      if (typeof scale === "number") effect.scale(scale);
      queued++;
    }
    if (!queued) return false;
    await sequence.play();
    return true;
  }
};

/**
 * End Boss Forge auras on the given token/actor (other modules' effects are
 * untouched — the origin tag scopes the cleanup).
 * @param {Token|TokenDocument|Actor} target
 */
export async function clearAuras(target) {
  if (!globalThis.Sequencer) return false;
  const tokens = target instanceof Actor
    ? target.getActiveTokens(false, true)
    : [target].filter(Boolean);
  for (const token of tokens) {
    const origin = auraOrigin(token);
    if (origin) await Sequencer.EffectManager.endEffects({ origin });
  }
  return true;
}
