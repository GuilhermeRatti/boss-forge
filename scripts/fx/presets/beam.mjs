import { newSequence, validateFile } from "../helpers.mjs";

/**
 * Beams/breaths: stretches the effect from the source (the boss token) to
 * each location. Meant for use with at: "targets" in the FX flags.
 */
export default {
  id: "beam",
  params: [
    { key: "file", type: "file", required: true },
    { key: "scale", type: "number" }
  ],
  async play({ file, locations = [], source, scale } = {}) {
    const origin = source ?? locations[0];
    if (!origin || !locations.length || !validateFile(file)) return false;
    const targets = locations.filter(l => l !== origin);
    if (!targets.length) return false;
    const sequence = newSequence();
    for (const target of targets) {
      const effect = sequence.effect().file(file).atLocation(origin).stretchTo(target);
      if (typeof scale === "number") effect.scale(scale);
    }
    await sequence.play();
    return true;
  }
};
