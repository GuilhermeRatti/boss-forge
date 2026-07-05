import { MODULE_ID, SETTINGS, FLAGS } from "./constants.mjs";
import { log } from "./logger.mjs";
import { escapeHtml, actorSides, whisperGM } from "./utils.mjs";
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

/**
 * Normalized phase setup: { direction: "down"|"up", phases: [...] }.
 * "down" (default) = damage phases (trigger at pct <= threshold);
 * "up" = healing phases (trigger at pct >= threshold — protect/heal bosses).
 * Legacy flat-array flags are treated as "down".
 */
function getPhaseSetup(actor) {
  const raw = actor?.getFlag(MODULE_ID, FLAGS.PHASES);
  if (!raw) return null;
  const direction = raw.direction === "up" ? "up" : "down";
  const list = Array.isArray(raw) ? raw : raw.phases;
  if (!Array.isArray(list) || !list.length) return null;
  const phases = [...list].sort((a, b) => direction === "down"
    ? (b.threshold ?? 0) - (a.threshold ?? 0)
    : (a.threshold ?? 0) - (b.threshold ?? 0));
  return { direction, phases };
}

/**
 * @param {Actor} actor
 * @returns {number} current phase index (0 = initial)
 */
export function getPhaseIndex(actor) {
  return actor?.getFlag(MODULE_ID, FLAGS.PHASE_STATE)?.index ?? 0;
}

function computePhaseIndex({ direction, phases }, pct) {
  let index = 0;
  for (const phase of phases) {
    const threshold = phase.threshold ?? 0;
    if (direction === "down" ? pct <= threshold : pct >= threshold) index++;
  }
  return index;
}

async function onActorUpdated(actor, changes) {
  try {
    if (!game.user.isActiveGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.PHASES)) return;
    if (!foundry.utils.hasProperty(changes, "system.attributes.hp")) return;
    const pct = actor.system?.attributes?.hp?.pct;
    if (typeof pct !== "number") return;

    const setup = getPhaseSetup(actor);
    if (setup) {
      const stored = getPhaseIndex(actor);
      const target = computePhaseIndex(setup, pct);
      if (target > stored) {
        for (let index = stored + 1; index <= target; index++) {
          await triggerPhase(actor, setup.phases[index - 1], index);
        }
        await actor.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: target });
      }
    }

    // Linked triggers (design §"Gatilhos adicionais"): this actor dying may
    // complete a boss's death-link; its HP change may open a linked HP gap.
    if ((actor.system?.attributes?.hp?.value ?? 1) <= 0) await checkDeathTriggers();
    await checkGapTrigger(actor, pct);
  } catch (err) {
    log.error("Phase orchestration failed.", err);
  }
}

/**
 * Death-link: bosses flagged with deathTrigger advance a phase once every
 * watched creature (token/actor UUIDs) is at 0 HP or deleted. Candidates are
 * gathered from the active combat and the viewed scene.
 */
async function checkDeathTriggers() {
  const candidates = new Set();
  for (const combatant of game.combat?.combatants ?? []) if (combatant.actor) candidates.add(combatant.actor);
  for (const tokenDoc of canvas.scene?.tokens ?? []) if (tokenDoc.actor) candidates.add(tokenDoc.actor);
  for (const boss of candidates) {
    const trigger = boss.getFlag(MODULE_ID, FLAGS.DEATH_TRIGGER);
    if (!trigger?.uuids?.length || trigger.fired) continue;
    const allDead = trigger.uuids.every(uuid => {
      const doc = fromUuidSync(uuid);
      const watched = doc?.actor ?? doc;
      if (!watched) return true; // deleted counts as dead
      return (watched.system?.attributes?.hp?.value ?? 0) <= 0;
    });
    if (!allDead) continue;
    await boss.setFlag(MODULE_ID, FLAGS.DEATH_TRIGGER, { ...trigger, fired: true });
    await whisperGM("BOSSFORGE.Phases.DeathTriggerFired", { name: escapeHtml(boss.name) });
    await advancePhase(boss).catch(err => log.warn("Death trigger could not advance phase.", err));
  }
}

/**
 * Gap-link: two bosses flagged at each other advance a phase (both) when the
 * difference between their HP percentages reaches the configured gap.
 */
async function checkGapTrigger(actor, pct) {
  const trigger = actor.getFlag(MODULE_ID, FLAGS.GAP_TRIGGER);
  if (!trigger?.other || trigger.fired || !(trigger.gap > 0)) return;
  const otherDoc = fromUuidSync(trigger.other);
  const other = otherDoc?.actor ?? otherDoc;
  const otherPct = other?.system?.attributes?.hp?.pct;
  if (typeof otherPct !== "number") return;
  if (Math.abs(pct - otherPct) < trigger.gap) return;
  for (const side of [actor, other]) {
    const t = side.getFlag(MODULE_ID, FLAGS.GAP_TRIGGER);
    if (t) await side.setFlag(MODULE_ID, FLAGS.GAP_TRIGGER, { ...t, fired: true });
  }
  await whisperGM("BOSSFORGE.Phases.GapTriggerFired", {
    name: escapeHtml(actor.name),
    other: escapeHtml(other.name),
    gap: trigger.gap
  });
  for (const side of [actor, other]) {
    await advancePhase(side).catch(err => log.warn(`Gap trigger could not advance ${side.name}.`, err));
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
        await whisperGM("BOSSFORGE.Phases.EffectNotFound", {
          effect: escapeHtml(name),
          name: escapeHtml(actor.name)
        });
        continue;
      }
      await effect.update({ disabled });
    }
  }
}

/* -------------------------------------------- */
/*  API helpers                                 */
/* -------------------------------------------- */

function validatePhases(phases, direction) {
  if (!Array.isArray(phases) || !phases.length) {
    throw new Error("setPhases: config must be a non-empty array of phases.");
  }
  for (const phase of phases) {
    const t = phase?.threshold;
    const max = direction === "up" ? 100 : 99.999;
    if (typeof t !== "number" || !(t > 0) || !(t <= max)) {
      throw new Error(`setPhases: each phase needs a threshold percentage in (0, ${direction === "up" ? "100]" : "100)"} (got ${t}).`);
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
 * @param {object} [options]
 * @param {"down"|"up"} [options.direction="down"]  "down" = damage phases;
 *   "up" = healing phases (trigger when hp.pct climbs past the threshold).
 */
export async function setPhases(actor, phases, { direction = "down" } = {}) {
  if (!(actor instanceof Actor)) throw new Error("setPhases: first argument must be an Actor.");
  if (direction !== "down" && direction !== "up") {
    throw new Error('setPhases: direction must be "down" or "up".');
  }
  validatePhases(phases, direction);
  for (const side of actorSides(actor)) {
    await side.setFlag(MODULE_ID, FLAGS.PHASES, { direction, phases });
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
 * Re-arm the phase state (back to the initial phase) and any linked
 * triggers. Does not revert effect toggles — the GM stages the sheet.
 * @param {Actor} actor
 */
export async function resetPhases(actor) {
  if (!(actor instanceof Actor)) throw new Error("resetPhases: first argument must be an Actor.");
  for (const side of actorSides(actor)) {
    await side.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: 0 });
    for (const key of [FLAGS.DEATH_TRIGGER, FLAGS.GAP_TRIGGER]) {
      const trigger = side.getFlag(MODULE_ID, key);
      if (trigger?.fired) await side.setFlag(MODULE_ID, key, { ...trigger, fired: false });
    }
  }
  return actor;
}

/**
 * Manually force the next phase, regardless of HP (the GM is sovereign).
 * @param {Actor} actor
 */
export async function advancePhase(actor) {
  if (!(actor instanceof Actor)) throw new Error("advancePhase: first argument must be an Actor.");
  const setup = getPhaseSetup(actor);
  if (!setup) throw new Error("advancePhase: this actor has no phase configuration.");
  const stored = getPhaseIndex(actor);
  if (stored >= setup.phases.length) return actor;
  await triggerPhase(actor, setup.phases[stored], stored + 1);
  await actor.setFlag(MODULE_ID, FLAGS.PHASE_STATE, { index: stored + 1 });
  return actor;
}

/**
 * Death-link: when every watched creature is dead (HP 0 or deleted), the
 * boss advances a phase (e.g. a ritual ends and the boss weakens).
 * @param {Actor} boss
 * @param {Array<Token|TokenDocument|Actor>} watched
 */
export async function linkDeaths(boss, watched) {
  if (!(boss instanceof Actor)) throw new Error("linkDeaths: first argument must be an Actor.");
  if (!Array.isArray(watched) || !watched.length) {
    throw new Error("linkDeaths: pass a non-empty array of tokens/actors to watch.");
  }
  const uuids = watched.map(w => w?.document?.uuid ?? w?.uuid).filter(Boolean);
  if (!uuids.length) throw new Error("linkDeaths: could not resolve any UUIDs from the watched list.");
  for (const side of actorSides(boss)) {
    await side.setFlag(MODULE_ID, FLAGS.DEATH_TRIGGER, { uuids, fired: false });
  }
  return boss;
}

/**
 * @param {Actor} boss
 */
export async function clearDeathLink(boss) {
  if (!(boss instanceof Actor)) throw new Error("clearDeathLink: first argument must be an Actor.");
  for (const side of actorSides(boss)) await side.unsetFlag(MODULE_ID, FLAGS.DEATH_TRIGGER);
  return boss;
}

/**
 * Gap-link two bosses: when the difference between their HP percentages
 * reaches the gap, both advance a phase (council/consort enrage).
 * @param {Actor} actorA
 * @param {Actor} actorB
 * @param {object} options
 * @param {number} options.gap  Percentage-point difference (1–100).
 */
export async function linkGap(actorA, actorB, { gap } = {}) {
  for (const a of [actorA, actorB]) {
    if (!(a instanceof Actor)) throw new Error("linkGap: both arguments must be Actors.");
  }
  if (typeof gap !== "number" || !(gap > 0) || !(gap <= 100)) {
    throw new Error("linkGap: options.gap must be a percentage between 1 and 100.");
  }
  for (const side of actorSides(actorA)) {
    await side.setFlag(MODULE_ID, FLAGS.GAP_TRIGGER, { other: actorB.uuid, gap, fired: false });
  }
  for (const side of actorSides(actorB)) {
    await side.setFlag(MODULE_ID, FLAGS.GAP_TRIGGER, { other: actorA.uuid, gap, fired: false });
  }
  return actorA;
}

/**
 * Clears the gap-link from this actor and its linked partner.
 * @param {Actor} actor
 */
export async function clearGapLink(actor) {
  if (!(actor instanceof Actor)) throw new Error("clearGapLink: first argument must be an Actor.");
  const trigger = actor.getFlag(MODULE_ID, FLAGS.GAP_TRIGGER);
  for (const side of actorSides(actor)) await side.unsetFlag(MODULE_ID, FLAGS.GAP_TRIGGER);
  if (trigger?.other) {
    const otherDoc = fromUuidSync(trigger.other);
    const other = otherDoc?.actor ?? otherDoc;
    if (other instanceof Actor) {
      for (const side of actorSides(other)) await side.unsetFlag(MODULE_ID, FLAGS.GAP_TRIGGER);
    }
  }
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
