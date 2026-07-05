import { newSequence, validateFile, templateGeometry, conformToTemplate } from "../helpers.mjs";

/**
 * Asset-free area warning drawn under the tokens. Three forms:
 * - "circle": a circle at each location (radius in grid squares).
 * - "cone": a cone anchored on the source (the boss), pointing at each
 *   location — dragon breath telegraphs. Aperture via `angle`.
 * - "line": a thin rectangle from the source toward each location.
 * Template locations override the form entirely: the warning overlays the
 * placed template's exact shape (cone/ray/circle/cube), and the optional
 * payoff conforms to the same area.
 * When `file` is given, the payoff lands as the warning expires: at the
 * location for circles, stretched source→target for cones and lines.
 */

function directionBetween(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function centerOf(ref) {
  const obj = ref?.object ?? ref;
  return obj?.center ?? { x: obj?.x ?? 0, y: obj?.y ?? 0 };
}

function conePoints(direction, lengthPx, angleDeg, segments = 12) {
  const half = (angleDeg * Math.PI / 180) / 2;
  const points = [[0, 0]];
  for (let i = 0; i <= segments; i++) {
    const a = direction - half + (i / segments) * (2 * half);
    points.push([Math.cos(a) * lengthPx, Math.sin(a) * lengthPx]);
  }
  return points;
}

function linePoints(direction, lengthPx, widthPx) {
  const half = widthPx / 2;
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  // Perpendicular offsets for the rectangle corners
  const px = Math.cos(direction + Math.PI / 2) * half;
  const py = Math.sin(direction + Math.PI / 2) * half;
  return [
    [px, py],
    [cos * lengthPx + px, sin * lengthPx + py],
    [cos * lengthPx - px, sin * lengthPx - py],
    [-px, -py]
  ];
}

/** Flat cone (core setting coneTemplateType): a triangle whose edge rays
 *  extend to distance / cos(angle/2), matching Foundry's flat variant. */
function flatConePoints(direction, lengthPx, angleDeg) {
  const half = (angleDeg * Math.PI / 180) / 2;
  const edge = lengthPx / Math.cos(half);
  return [
    [0, 0],
    [Math.cos(direction - half) * edge, Math.sin(direction - half) * edge],
    [Math.cos(direction + half) * edge, Math.sin(direction + half) * edge]
  ];
}

/** Warning shape overlaying a placed template exactly (local px coords). */
function applyTemplateShape(warning, geo, shapeOptions) {
  warning.atLocation(geo.origin);
  if (geo.t === "cone") {
    const flat = game.settings.get("core", "coneTemplateType") === "flat";
    const points = flat
      ? flatConePoints(geo.rad, geo.lengthPx, geo.angle)
      : conePoints(geo.rad, geo.lengthPx, geo.angle);
    warning.shape("polygon", { ...shapeOptions, points });
  } else if (geo.t === "ray") {
    warning.shape("polygon", { ...shapeOptions, points: linePoints(geo.rad, geo.lengthPx, geo.widthPx) });
  } else if (geo.t === "rect") {
    const dx = Math.cos(geo.rad) * geo.lengthPx;
    const dy = Math.sin(geo.rad) * geo.lengthPx;
    warning.shape("polygon", { ...shapeOptions, points: [[0, 0], [dx, 0], [dx, dy], [0, dy]] });
  } else {
    warning.shape("circle", { ...shapeOptions, radius: geo.radiusGrid, gridUnits: true });
  }
}

export default {
  id: "telegraph",
  params: [
    { key: "form", type: "select", options: ["circle", "cone", "line"], default: "circle" },
    { key: "radius", type: "number", default: 2 },
    { key: "length", type: "number", default: 6 },
    { key: "angle", type: "number", default: 60 },
    { key: "width", type: "number", default: 2 },
    { key: "color", type: "color", default: "#ff4d00" },
    { key: "duration", type: "number", default: 1600 },
    { key: "file", type: "file" },
    { key: "scale", type: "number" },
    { key: "delay", type: "number" }
  ],
  async play({
    form = "circle", radius = 2, length = 6, angle = 60, width = 2,
    color = "#ff4d00", duration = 1600, file, scale, delay,
    locations = [], source
  } = {}) {
    if (!locations.length) return false;
    const grid = canvas.grid.size;
    const hasFile = !!file && validateFile(file);
    const baseDelay = typeof delay === "number" ? Math.max(0, delay) : 0;
    const anchor = source ?? locations[0];
    const anchorCenter = centerOf(anchor);
    const sequence = newSequence();

    for (const location of locations) {
      const geo = templateGeometry(location);
      const shapeOptions = { fillColor: color, fillAlpha: 0.25, lineSize: 4, lineColor: color };
      const warning = sequence.effect()
        .delay(baseDelay)
        .duration(duration)
        .fadeIn(150)
        .fadeOut(250)
        .belowTokens(true);

      if (geo) {
        applyTemplateShape(warning, geo, shapeOptions);
      } else if (form === "cone" || form === "line") {
        const direction = directionBetween(anchorCenter, centerOf(location));
        const points = form === "cone"
          ? conePoints(direction, length * grid, angle)
          : linePoints(direction, length * grid, width * grid);
        warning.atLocation(anchor).shape("polygon", { ...shapeOptions, points });
      } else {
        warning.atLocation(location).shape("circle", { ...shapeOptions, radius, gridUnits: true });
      }

      if (hasFile) {
        const payoff = sequence.effect().file(file).delay(baseDelay + duration);
        if (geo) {
          payoff.atLocation(geo.anchor);
          conformToTemplate(payoff, geo, { fit: true });
        } else if (form === "cone" || form === "line") {
          payoff.atLocation(anchor).stretchTo(location);
        } else {
          payoff.atLocation(location);
        }
        if (typeof scale === "number") payoff.scale(scale);
      }
    }
    await sequence.play();
    return true;
  }
};
