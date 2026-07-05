import { newSequence, validateFile, templateGeometry, conformToTemplate } from "../helpers.mjs";

/**
 * A single effect played at each location. The bread-and-butter preset.
 * Template locations always orient the effect to the placed direction
 * (cones/rays); with fit=true it is also stretched/sized to the area
 * (cone breaths, fitted explosions).
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
      const geo = templateGeometry(location);
      const effect = sequence.effect().file(file).atLocation(geo?.anchor ?? location);
      if (geo) conformToTemplate(effect, geo, { fit });
      if (typeof scale === "number") effect.scale(scale);
      if (typeof delay === "number") effect.delay(delay);
    }
    await sequence.play();
    return true;
  }
};
