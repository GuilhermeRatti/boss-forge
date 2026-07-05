import { newSequence, validateFile, templateGeometry } from "../helpers.mjs";

/**
 * Beams/breaths: stretches the effect from the source (the boss token) to
 * each location. Meant for use with at: "targets" in the FX flags. Template
 * locations resolve to the template endpoint (cones/rays) or area center
 * (circles/cubes) — fireball projectiles fly to the placed area.
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
      const geo = templateGeometry(target);
      const endpoint = geo ? ((geo.t === "cone" || geo.t === "ray") ? geo.end : geo.anchor) : target;
      const effect = sequence.effect().file(file).atLocation(origin).stretchTo(endpoint);
      if (typeof scale === "number") effect.scale(scale);
    }
    await sequence.play();
    return true;
  }
};
