import { MODULE_ID, SETTINGS, FLAGS } from "./constants.mjs";
import { log } from "./logger.mjs";
import { escapeHtml, actorSides } from "./utils.mjs";
import { playPreset, presetExists, listPresets } from "./fx/presets.mjs";

/**
 * HP-phase orchestration (M4): bosses configured with percentage thresholds
 * (flags.boss-forge.phases) trigger a phase transition when hp.pct crosses
 * them — a public announcement, optional FX on the token, and optional
 * ActiveEffect toggles. Item action sets swap through the per-item phase
 * flag, filtered by the M1/M3 prompts. Phase advancement is one-way
 * (healing does not regress it); api.phases.reset re-arms.
 * See docs/design/m4-fases.md.
 */

export function registerPhaseOrchestrator() {
  Hooks.on("updateActor", onActorUpdated);
}

function getPhaseConfig(actor) {
  const phases = actor?.getFlag(MODULE_ID, FLAGS.PHASES);
  if (!Array.isArray(phases) || !phases.length) return null;
  return [...phases].sort((a, b) => (b.threshold ?? 0) - (a.threshold ?? 0));
}

/**
 * @param {Actor} actor
 * @returns {number} current phase index (0 = initial)
 */
export function getPhaseIndex(actor) {
  return actor?.getFlag(MODULE_ID, FLAGS.PHASE_STATE)?.index ?? 0;
}

function computePhaseIndex(phases, pct) {
  let index = 0;
  for (const phase of phases) {
    if (pct <= (phase.threshold ?? 0)) index++;
  }
  return index;
}

async function onActorUpdated(actor, changes) {
  try {
    if (!game.user.isActiveGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.PHASES)) return;
    if (!foundry.utils.hasProperty(changes, "system.attributes.hp")) return;
    const phases = getPhaseConfig(actor);
    if (!phases) return;
    const pct = actor.system?.attributes?.hp?.pct;
    if (typeof pct !== "number") return;

    const stored = getPhaseIndex(actor);
    const target = computePhaseIndex(phases, pct);
    if (target <= stored) return;

    for (let index = stored + 1; index <= target; index++) {
      await triggerPhase(actor, phases[index - 1], index);
    }
    await actor.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: target });
  } catch (err) {
    log.error("Phase orchestration failed.", err);
  }
}

async function triggerPhase(actor, phase, index) {
  log.debug(`Phase ${index} triggered for ${actor.name} ("${phase.name ?? ""}").`);
  await announcePhase(actor, phase, index);
  await playPhaseFx(actor, phase);
  await togglePhaseEffects(actor, phase);
}

async function announcePhase(actor, phase, index) {
  const name = phase.name?.trim() || game.i18n.format("BOSSFORGE.Phases.DefaultName", { index });
  let content = `<p>${game.i18n.format("BOSSFORGE.Phases.Announcement", {
    boss: escapeHtml(actor.name),
    name: `<strong>${escapeHtml(name)}</strong>`
  })}</p>`;
  if (phase.message) content += `<p><em>${escapeHtml(phase.message)}</em></p>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

async function playPhaseFx(actor, phase) {
  if (!phase.fx) return;
  const tokenDoc = actor.token ?? actor.getActiveTokens(false, true)[0];
  const token = tokenDoc?.object ?? tokenDoc;
  if (!token) {
    log.debug(`Phase FX skipped for ${actor.name}: no active token.`);
    return;
  }
  const sequence = Array.isArray(phase.fx) ? phase.fx : [phase.fx];
  for (const fx of sequence) {
    if (!fx?.preset) continue;
    await playPreset(fx.preset, { ...(fx.options ?? {}), locations: [token] });
  }
}

async function togglePhaseEffects(actor, phase) {
  const { enable = [], disable = [] } = phase.effects ?? {};
  if (!enable.length && !disable.length) return;
  const all = [...actor.allApplicableEffects()];
  for (const [names, disabled] of [[enable, false], [disable, true]]) {
    for (const name of names) {
      const effect = all.find(e => e.name === name);
      if (!effect) {
        log.warn(`Phase effect "${name}" not found on ${actor.name}.`);
        continue;
      }
      await effect.update({ disabled });
    }
  }
}

/* -------------------------------------------- */
/*  API helpers                                 */
/* -------------------------------------------- */

function validatePhases(phases) {
  if (!Array.isArray(phases) || !phases.length) {
    throw new Error("setPhases: config must be a non-empty array of phases.");
  }
  for (const phase of phases) {
    const t = phase?.threshold;
    if (typeof t !== "number" || !(t > 0) || !(t < 100)) {
      throw new Error(`setPhases: each phase needs a threshold percentage between 0 and 100 (got ${t}).`);
    }
    const sequence = phase.fx ? (Array.isArray(phase.fx) ? phase.fx : [phase.fx]) : [];
    for (const fx of sequence) {
      if (fx?.preset && !presetExists(fx.preset)) {
        throw new Error(`setPhases: unknown FX preset "${fx.preset}". Available: ${listPresets().join(", ")}`);
      }
    }
    for (const list of [phase.effects?.enable, phase.effects?.disable]) {
      if (list !== undefined && (!Array.isArray(list) || list.some(n => typeof n !== "string"))) {
        throw new Error("setPhases: effects.enable/disable must be arrays of effect names.");
      }
    }
  }
}

/**
 * Configure a boss's phases (applied to both actor sides for unlinked
 * tokens) and reset its phase state.
 * @param {Actor} actor
 * @param {Array<object>} phases  See docs/design/m4-fases.md §3.
 */
export async function setPhases(actor, phases) {
  if (!(actor instanceof Actor)) throw new Error("setPhases: first argument must be an Actor.");
  validatePhases(phases);
  for (const side of actorSides(actor)) {
    await side.setFlag(MODULE_ID, FLAGS.PHASES, phases);
    await side.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: 0 });
  }
  return actor;
}

/**
 * @param {Actor} actor
 * @returns {Array<object>|undefined}
 */
export function getPhases(actor) {
  return actor.getFlag(MODULE_ID, FLAGS.PHASES);
}

/**
 * @param {Actor} actor
 */
export async function clearPhases(actor) {
  if (!(actor instanceof Actor)) throw new Error("clearPhases: first argument must be an Actor.");
  for (const side of actorSides(actor)) {
    await side.unsetFlag(MODULE_ID, FLAGS.PHASES);
    await side.unsetFlag(MODULE_ID, FLAGS.PHASE_STATE);
  }
  return actor;
}

/**
 * Re-arm the phase state (back to the initial phase). Does not revert
 * effect toggles — the GM stages the sheet as desired.
 * @param {Actor} actor
 */
export async function resetPhases(actor) {
  if (!(actor instanceof Actor)) throw new Error("resetPhases: first argument must be an Actor.");
  for (const side of actorSides(actor)) {
    await side.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: 0 });
  }
  return actor;
}

/**
 * Manually force the next phase, regardless of HP (the GM is sovereign).
 * @param {Actor} actor
 */
export async function advancePhase(actor) {
  if (!(actor instanceof Actor)) throw new Error("advancePhase: first argument must be an Actor.");
  const phases = getPhaseConfig(actor);
  if (!phases) throw new Error("advancePhase: this actor has no phase configuration.");
  const stored = getPhaseIndex(actor);
  if (stored >= phases.length) return actor;
  await triggerPhase(actor, phases[stored], stored + 1);
  await actor.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: stored + 1 });
  return actor;
}

/**
 * Restrict an item's legendary/lair activities to specific phases
 * (number = exactly that phase; array = any of them; cleared = always).
 * @param {Item} item
 * @param {number|number[]} phase
 */
export async function setItemPhase(item, phase) {
  if (!(item instanceof Item)) throw new Error("setItemPhase: first argument must be an Item.");
  const valid = typeof phase === "number"
    || (Array.isArray(phase) && phase.length && phase.every(p => typeof p === "number"));
  if (!valid) throw new Error("setItemPhase: phase must be a number or an array of numbers.");
  return item.setFlag(MODULE_ID, FLAGS.ITEM_PHASE, phase);
}

/**
 * @param {Item} item
 */
export async function clearItemPhase(item) {
  if (!(item instanceof Item)) throw new Error("clearItemPhase: first argument must be an Item.");
  return item.unsetFlag(MODULE_ID, FLAGS.ITEM_PHASE);
}
