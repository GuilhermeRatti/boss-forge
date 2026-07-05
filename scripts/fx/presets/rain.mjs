import { newSequence, validateFile } from "../helpers.mjs";

/**
 * Randomized multi-impact barrage (meteor rain): impacts land at random
 * points inside a radius (grid squares) around the center — the boss token
 * by default — staggered by `interval` ms, each optionally telegraphed by a
 * warning circle that expires exactly when its impact lands.
 */
function randomPointAround(center, radiusPx) {
  const angle = Math.random() * 2 * Math.PI;
  // sqrt distributes points uniformly over the area (not clustered at center)
  const distance = Math.sqrt(Math.random()) * radiusPx;
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance
  };
}

export default {
  id: "rain",
  params: [
    { key: "file", type: "file", required: true },
    { key: "count", type: "number", default: 5 },
    { key: "radius", type: "number", default: 6 },
    { key: "interval", type: "number", default: 300 },
    { key: "telegraph", type: "boolean", default: true },
    { key: "telegraphDuration", type: "number", default: 1200 },
    { key: "impactRadius", type: "number", default: 1 },
    { key: "color", type: "color", default: "#ff4d00" },
    { key: "scale", type: "number" }
  ],
  async play({
    file, locations = [], source,
    count = 5, radius = 6, interval = 300,
    telegraph = true, telegraphDuration = 1200,
    impactRadius = 1, color = "#ff4d00", scale
  } = {}) {
    const centerRef = source ?? locations[0];
    if (!centerRef || !validateFile(file)) return false;
    const obj = centerRef.object ?? centerRef;
    const center = obj.center ?? { x: obj.x ?? 0, y: obj.y ?? 0 };
    const radiusPx = Math.max(1, radius) * canvas.grid.size;

    const sequence = newSequence();
    for (let i = 0; i < Math.max(1, count); i++) {
      const point = randomPointAround(center, radiusPx);
      const delay = i * Math.max(0, interval);
      if (telegraph) {
        sequence.effect()
          .atLocation(point)
          .shape("circle", {
            radius: impactRadius,
            gridUnits: true,
            fillColor: color,
            fillAlpha: 0.25,
            lineSize: 3,
            lineColor: color
          })
          .delay(delay)
          .duration(telegraphDuration)
          .fadeIn(100)
          .fadeOut(150)
          .belowTokens(true);
      }
      const impact = sequence.effect()
        .file(file)
        .atLocation(point)
        .delay(delay + (telegraph ? telegraphDuration : 0));
      if (typeof scale === "number") impact.scale(scale);
    }
    await sequence.play();
    return true;
  }
};
