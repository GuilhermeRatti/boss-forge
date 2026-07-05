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

/**
 * Snapshot a measured template's geometry at placement time as a plain
 * object. Live placeable references are fragile mid-composition — BLFX (and
 * other modules) delete instantaneous templates as soon as their own
 * animation fires — so later steps conform to the snapshot instead.
 * @param {object} template  MeasuredTemplate placeable or document.
 * @returns {object|null}
 */
export function snapshotTemplate(template) {
  const doc = template?.document ?? template;
  if (typeof doc?.t !== "string" || typeof doc?.x !== "number") return null;
  return {
    bossForgeTemplate: true,
    t: doc.t,
    x: doc.x,
    y: doc.y,
    direction: doc.direction ?? 0,
    angle: doc.angle ?? 0,
    distance: doc.distance ?? 0,
    width: doc.width ?? 0
  };
}

/**
 * Resolve a location into template geometry in canvas pixels, or null when
 * the location is not a template (tokens, plain points). Accepts snapshots
 * (see snapshotTemplate), placeables and documents. Angles follow Foundry's
 * convention (degrees clockwise from east); distances are scene units (ft).
 * @param {object} location
 * @returns {{t: string, origin: {x,y}, end: {x,y}, anchor: {x,y},
 *   rad: number, angle: number, lengthPx: number, widthPx: number,
 *   radiusGrid: number, rectWidthGrid: number, rectHeightGrid: number}|null}
 */
export function templateGeometry(location) {
  const snap = location?.bossForgeTemplate ? location : snapshotTemplate(location);
  if (!snap) return null;
  const gridSize = canvas.grid.size;
  const gridDistance = canvas.scene?.grid?.distance || 5;
  const px = units => (units / gridDistance) * gridSize;
  const rad = Math.toRadians(snap.direction);
  const lengthPx = px(snap.distance);
  const origin = { x: snap.x, y: snap.y };
  const end = { x: origin.x + Math.cos(rad) * lengthPx, y: origin.y + Math.sin(rad) * lengthPx };
  // Circle templates store their center as x/y; cones, rays and 5e "rect"
  // cubes (a 45° diagonal from x/y) get their area center from the midpoint.
  const anchor = snap.t === "circle"
    ? origin
    : { x: (origin.x + end.x) / 2, y: (origin.y + end.y) / 2 };
  return {
    t: snap.t,
    origin,
    end,
    anchor: (snap.t === "cone" || snap.t === "ray") ? origin : anchor,
    center: anchor,
    rad,
    angle: snap.angle || 53.13,
    lengthPx,
    widthPx: px(snap.width),
    radiusGrid: snap.distance / gridDistance,
    // Per-axis rect extents from the stored drag angle. dnd5e cubes are the
    // 45° case (both = d / sqrt(2)); hand-dragged rects keep their aspect.
    rectWidthGrid: Math.abs(Math.cos(rad)) * snap.distance / gridDistance,
    rectHeightGrid: Math.abs(Math.sin(rad)) * snap.distance / gridDistance
  };
}

/**
 * Conform an effect (already atLocation'd on geo.anchor) to the template:
 * cones and rays always rotate toward the template endpoint — Sequencer
 * never rotates a plain atLocation sprite (rotation is only applied via
 * attachTo + bindRotation, sequencer.js ~17200) — and stretch along it when
 * fit is on; circles and cubes are scaled to the area when fit is on.
 * @param {object} effect  A Sequencer EffectSection.
 * @param {object} geo     From templateGeometry().
 * @param {object} [options]
 * @param {boolean} [options.fit=false]
 */
export function conformToTemplate(effect, geo, { fit = false } = {}) {
  if (!geo) return;
  if (geo.t === "cone" || geo.t === "ray") {
    if (fit) effect.stretchTo(geo.end);
    else effect.rotateTowards(geo.end);
    return;
  }
  if (!fit) return;
  if (geo.t === "circle") effect.size(geo.radiusGrid * 2, { gridUnits: true });
  else if (geo.t === "rect") {
    effect.size({ width: geo.rectWidthGrid, height: geo.rectHeightGrid }, { gridUnits: true });
  }
}
