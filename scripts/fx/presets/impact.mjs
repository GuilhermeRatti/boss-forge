import { newSequence, validateFile, applyTemplateFit } from "../helpers.mjs";

/**
 * A single effect played at each location. The bread-and-butter preset.
 * With fit=true and a template location, the effect is stretched/sized to
 * the template (cone breaths, fitted explosions).
 */
export default {
  id: "impact",
  params: [
    { key: "file", type: "file", required: true },
    { key: "scale", type: "number" },
    { key: "delay", type: "number" }
  ],
  async play({ file, locations = [], scale, delay, fit } = {}) {
    if (!locations.length || !validateFile(file)) return false;
    const sequence = newSequence();
    for (const location of locations) {
      const effect = sequence.effect().file(file).atLocation(location);
      if (fit) applyTemplateFit(effect, location);
      if (typeof scale === "number") effect.scale(scale);
      if (typeof delay === "number") effect.delay(delay);
    }
    await sequence.play();
    return true;
  }
};
