import { newSequence, validateFile } from "../helpers.mjs";

/**
 * A single effect played at each location. The bread-and-butter preset.
 */
export default {
  id: "impact",
  params: [
    { key: "file", type: "file", required: true },
    { key: "scale", type: "number" },
    { key: "delay", type: "number" }
  ],
  async play({ file, locations = [], scale, delay } = {}) {
    if (!locations.length || !validateFile(file)) return false;
    const sequence = newSequence();
    for (const location of locations) {
      const effect = sequence.effect().file(file).atLocation(location);
      if (typeof scale === "number") effect.scale(scale);
      if (typeof delay === "number") effect.delay(delay);
    }
    await sequence.play();
    return true;
  }
};
