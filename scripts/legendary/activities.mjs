import { MODULE_ID, FLAGS } from "../constants.mjs";

/**
 * Read helpers for the dnd5e legendary action economy (dnd5e 5.3.3).
 * See docs/research/2026-07-03-m1-dnd5e-5.3.3.md and
 * docs/research/2026-07-04-m1-fontes-instaladas.md.
 */

/**
 * Items can be restricted to HP phases (M4): flags.boss-forge.phase as a
 * number (exactly that phase) or array (any of them); unflagged = always.
 * @param {Item} item
 * @param {number} phaseIndex  The actor's current phase (0 = initial)
 * @returns {boolean}
 */
function availableInPhase(item, phaseIndex) {
  const phase = item.getFlag(MODULE_ID, FLAGS.ITEM_PHASE);
  if (phase == null) return true;
  if (Array.isArray(phase)) return phase.includes(phaseIndex);
  return phase === phaseIndex;
}

/**
 * @param {Actor} actor
 * @returns {{value: number, max: number, spent: number}|null}
 */
export function getLegendaryResource(actor) {
  return actor?.system?.resources?.legact ?? null;
}

/**
 * @typedef {object} LegendaryActivityEntry
 * @property {Item} item
 * @property {object} activity   dnd5e Activity (pseudo-document)
 * @property {number} cost       Legendary action cost (activation.value, min 1)
 */

/**
 * All activities with the given activation type across the actor's items.
 * @param {Actor} actor
 * @param {string} type  dnd5e activation type (e.g. "legendary", "lair")
 * @returns {LegendaryActivityEntry[]}
 */
export function getActivitiesByActivationType(actor, type) {
  const phaseIndex = actor?.getFlag(MODULE_ID, FLAGS.PHASE_STATE)?.index ?? 0;
  const entries = [];
  for (const item of actor?.items ?? []) {
    const activities = item.system?.activities;
    if (!activities) continue;
    if (!availableInPhase(item, phaseIndex)) continue;
    for (const activity of activities) {
      if (activity.activation?.type !== type) continue;
      entries.push({ item, activity, cost: Math.max(activity.activation.value ?? 1, 1) });
    }
  }
  return entries.sort((a, b) => (a.cost - b.cost) || a.item.name.localeCompare(b.item.name));
}

/**
 * All legendary activities across the actor's items, cheapest first.
 * @param {Actor} actor
 * @returns {LegendaryActivityEntry[]}
 */
export function getLegendaryActivities(actor) {
  return getActivitiesByActivationType(actor, "legendary");
}

/**
 * A combatant is an eligible boss when its actor has a legendary action pool
 * and at least one legendary activity to spend it on.
 * @param {Combatant} combatant
 * @returns {boolean}
 */
export function isEligibleBoss(combatant) {
  const actor = combatant?.actor;
  if (!actor) return false;
  const legact = getLegendaryResource(actor);
  if (!legact || !(legact.max > 0)) return false;
  return getLegendaryActivities(actor).length > 0;
}
