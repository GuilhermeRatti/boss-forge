import { newSequence, validateFile } from "../helpers.mjs";

/**
 * Asset-free area warning: a colored circle drawn under the tokens for
 * `duration` ms; when `file` is given, the impact lands as the warning ends.
 * The radius is in grid squares.
 */
export default {
  id: "telegraph",
  params: [
    { key: "radius", type: "number", default: 2 },
    { key: "color", type: "color", default: "#ff4d00" },
    { key: "duration", type: "number", default: 1600 },
    { key: "file", type: "file" },
    { key: "scale", type: "number" }
  ],
  async play({ radius = 2, color = "#ff4d00", duration = 1600, file, scale, locations = [] } = {}) {
    if (!locations.length) return false;
    const sequence = newSequence();
    for (const location of locations) {
      sequence.effect()
        .atLocation(location)
        .shape("circle", {
          radius,
          gridUnits: true,
          fillColor: color,
          fillAlpha: 0.25,
          lineSize: 4,
          lineColor: color
        })
        .duration(duration)
        .fadeIn(150)
        .fadeOut(250)
        .belowTokens(true);
      if (file && validateFile(file)) {
        const impact = sequence.effect().file(file).atLocation(location).delay(duration);
        if (typeof scale === "number") impact.scale(scale);
      }
    }
    await sequence.play();
    return true;
  }
};
