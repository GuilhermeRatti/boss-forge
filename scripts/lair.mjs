import { MODULE_ID, SETTINGS, FLAGS } from "./constants.mjs";
import { log } from "./logger.mjs";
import { escapeHtml, actorSides, whisperGM } from "./utils.mjs";
import { playFx, assertValidFxConfig } from "./fx/presets.mjs";
import { playItemFx } from "./legendary/item-fx.mjs";
import { getActivitiesByActivationType } from "./legendary/activities.mjs";

/**
 * Lair orchestration (M3), two paradigms inferred from the NPC's lair data:
 *
 * - 2024 (lair.value): decide whether the fight happens inside the lair and
 *   toggle lair.inside — dnd5e natively grants +1 legact/legres max while
 *   inside. Scenes can be marked as a boss's lair (flags.boss-forge.lairOf)
 *   for hands-free activation, and module-set toggles auto-revert when the
 *   combat is deleted.
 * - 2014 (lair.initiative): when the tracker crosses that initiative count
 *   (losing ties, RAW) each round, prompt the GM with the boss's lair
 *   activities (activation.type "lair").
 *
 * See docs/design/m3-covil.md.
 */

// One classic prompt per boss per round (in-runtime memory; a GM rewinding
// the tracker re-arms it, which is fine — the GM is the referee).
const classicFired = new Map();

export function registerLairOrchestrator() {
  Hooks.on("combatStart", onCombatStart);
  Hooks.on("createCombatant", onCombatantCreated);
  Hooks.on("combatTurnChange", onCombatTurnChange);
  Hooks.on("deleteCombat", onCombatDeleted);
}

function lairData(actor) {
  return actor?.system?.resources?.lair ?? null;
}

function classicInitiative(actor) {
  const value = lairData(actor)?.initiative;
  return (typeof value === "number" && Number.isFinite(value)) ? value : null;
}

function baseUuid(actor) {
  return actor.isToken ? (actor.token?.baseActor?.uuid ?? actor.uuid) : actor.uuid;
}

/* -------------------------------------------- */
/*  2024 mode — inside the lair                 */
/* -------------------------------------------- */

async function onCombatStart(combat) {
  try {
    // combatStart fires (pre-update) only on the initiating client — the GM
    // who clicks "Begin Combat".
    if (!game.user.isGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.LAIR_PROMPT)) return;
    for (const combatant of combat.combatants) {
      await maybeActivateLairMode(combatant);
    }
  } catch (err) {
    log.error("Lair mode (combat start) failed.", err);
  }
}

async function onCombatantCreated(combatant) {
  try {
    if (!game.user.isActiveGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.LAIR_PROMPT)) return;
    if (!combatant.combat?.started) return;
    await maybeActivateLairMode(combatant);
  } catch (err) {
    log.error("Lair mode (combatant created) failed.", err);
  }
}

async function maybeActivateLairMode(combatant) {
  const actor = combatant?.actor;
  const lair = lairData(actor);
  if (!lair?.value || lair.inside) return;
  if (actor.getFlag(MODULE_ID, FLAGS.LAIR_PROMPT_DISABLED)) return;

  // Hands-free path: the combat's scene is marked as this boss's lair.
  const scene = combatant.token?.parent ?? canvas.scene;
  const markedFor = scene?.getFlag(MODULE_ID, FLAGS.LAIR_SCENE);
  if (markedFor && (markedFor === baseUuid(actor) || markedFor === actor.uuid)) {
    await setInside(actor, true, { auto: true });
    await whisperGM("BOSSFORGE.Lair.AutoActivated", {
      name: escapeHtml(actor.name),
      scene: escapeHtml(scene.name)
    });
    await playActorLairFx(actor, combatant.token);
    return;
  }

  const choice = await foundry.applications.api.DialogV2.wait({
    classes: ["boss-forge-legendary"],
    window: { title: game.i18n.format("BOSSFORGE.Lair.InsideDialogTitle", { name: actor.name }) },
    position: { width: 420 },
    content: `<p>${game.i18n.format("BOSSFORGE.Lair.InsideDialogPrompt", { name: escapeHtml(actor.name) })}</p>`,
    buttons: [
      { action: "yes", label: "BOSSFORGE.Lair.InsideYes", icon: "fa-solid fa-dungeon", default: true },
      { action: "no", label: "BOSSFORGE.Lair.InsideNo", icon: "fa-solid fa-xmark" },
      { action: "optout", label: "BOSSFORGE.Legendary.OptOut", icon: "fa-solid fa-bell-slash" }
    ]
  });

  if (choice === "optout") {
    await setLairPromptEnabled(actor, false);
    return;
  }
  if (choice !== "yes") return;

  await setInside(actor, true, { auto: true });
  await whisperGM("BOSSFORGE.Lair.Activated", { name: escapeHtml(actor.name) });
  await playActorLairFx(actor, combatant.token);
}

async function onCombatDeleted(combat) {
  try {
    if (!game.user.isActiveGM) return;
    for (const combatant of combat.combatants) {
      const actor = combatant.actor;
      if (!actor?.getFlag(MODULE_ID, FLAGS.LAIR_INSIDE_AUTO)) continue;
      await setInside(actor, false);
      await whisperGM("BOSSFORGE.Lair.Deactivated", { name: escapeHtml(actor.name) });
    }
    for (const key of classicFired.keys()) {
      if (key.startsWith(`${combat.id}:`)) classicFired.delete(key);
    }
  } catch (err) {
    log.error("Lair mode (combat deleted) failed.", err);
  }
}

/* -------------------------------------------- */
/*  2014 mode — lair actions at initiative N    */
/* -------------------------------------------- */

async function onCombatTurnChange(combat, prior, current) {
  try {
    if (!game.user.isActiveGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.LAIR_PROMPT)) return;
    const priorC = combat.combatants.get(prior?.combatantId);
    const currentC = combat.combatants.get(current?.combatantId);
    if (!currentC) return;

    const bosses = combat.combatants.filter(c => {
      const actor = c.actor;
      if (!actor || c.isDefeated) return false;
      if (actor.system?.attributes?.hp?.value <= 0) return false;
      if (actor.getFlag(MODULE_ID, FLAGS.LAIR_PROMPT_DISABLED)) return false;
      return classicInitiative(actor) !== null && getActivitiesByActivationType(actor, "lair").length > 0;
    });

    for (const boss of bosses) {
      const lairInit = classicInitiative(boss.actor);
      if (!crossedCount(prior, current, priorC, currentC, lairInit)) continue;
      const key = `${combat.id}:${boss.id}`;
      if (classicFired.get(key) === current.round) continue;
      classicFired.set(key, current.round);
      log.debug(`Lair actions: ${boss.actor.name} at initiative ${lairInit}, round ${current.round}.`);
      await promptLairActions(boss, lairInit, current.round);
    }
  } catch (err) {
    log.error("Lair actions (turn change) failed.", err);
  }
}

/**
 * Whether the tracker crossed the given initiative count between the prior
 * and current turns. Lair actions lose ties (RAW), so the crossing happens
 * when we leave a combatant at or above the count for one below it — with
 * round wraps covering the all-above/all-below orders.
 */
function crossedCount(prior, current, priorC, currentC, count) {
  const pi = priorC?.initiative;
  const ci = currentC?.initiative;
  if (ci == null) return false;
  if (prior?.round === current?.round) {
    if (pi == null) return ci < count;
    return pi >= count && ci < count;
  }
  // Round wrapped (or combat just started): the tracker ran out the bottom
  // and restarted at the top.
  return (pi != null && pi >= count) || ci < count;
}

async function promptLairActions(combatant, lairInit, round) {
  const actor = combatant.actor;
  const used = new Map();

  while (true) {
    const entries = getActivitiesByActivationType(actor, "lair");
    if (!entries.length) return;

    const buttons = entries.map((entry, i) => {
      const usedCount = used.get(entry.activity.uuid) ?? 0;
      const activityName = entry.activity.name?.trim();
      let label = activityName && activityName !== entry.item.name
        ? `${entry.item.name}: ${activityName}`
        : entry.item.name;
      if (usedCount > 0) label += game.i18n.format("BOSSFORGE.Legendary.UsedBadge", { count: usedCount });
      return {
        action: `use-${i}`,
        label,
        icon: "fa-solid fa-dungeon",
        callback: () => entry
      };
    });
    buttons.push({ action: "skip", label: "BOSSFORGE.Legendary.Skip", icon: "fa-solid fa-forward", default: true });
    buttons.push({ action: "optout", label: "BOSSFORGE.Legendary.OptOut", icon: "fa-solid fa-bell-slash" });

    const choice = await foundry.applications.api.DialogV2.wait({
      classes: ["boss-forge-legendary"],
      window: {
        title: game.i18n.format("BOSSFORGE.Lair.ActionsDialogTitle", { name: actor.name, initiative: lairInit })
      },
      position: { width: 420 },
      content: `<p>${game.i18n.format("BOSSFORGE.Lair.ActionsPrompt", {
        name: escapeHtml(actor.name),
        initiative: lairInit,
        round
      })}</p>`,
      buttons
    });

    if (choice === null || choice === "skip") return;
    if (choice === "optout") {
      await setLairPromptEnabled(actor, false);
      return;
    }

    const results = await choice.activity.use();
    if (!results) continue;
    used.set(choice.activity.uuid, (used.get(choice.activity.uuid) ?? 0) + 1);
    await playItemFx(choice.item, combatant);
    // RAW default: one lair action per round. The promptMultiUse setting
    // re-enables the reopen-with-badge loop (house rule).
    if (!game.settings.get(MODULE_ID, SETTINGS.PROMPT_MULTI_USE)) return;
  }
}

/* -------------------------------------------- */
/*  FX                                          */
/* -------------------------------------------- */

async function playActorLairFx(actor, tokenDoc) {
  const fx = actor.getFlag(MODULE_ID, FLAGS.LAIR_FX);
  if (!fx) return;
  const token = tokenDoc?.object ?? tokenDoc;
  if (!token) return;
  await playFx(fx, { locations: [token], source: token });
}

/* -------------------------------------------- */
/*  API helpers                                 */
/* -------------------------------------------- */

/**
 * Toggle dnd5e's native "inside the lair" state (+1 legact/legres max).
 * Pass the combat token's actor for unlinked tokens. Module-set toggles
 * (auto) revert when the combat is deleted; manual ones are left alone.
 * @param {Actor} actor
 * @param {boolean} [inside=true]
 * @param {object} [options]
 * @param {boolean} [options.auto=false]
 */
export async function setInside(actor, inside = true, { auto = false } = {}) {
  if (!(actor instanceof Actor)) {
    throw new Error("setInside: first argument must be an Actor (tip: canvas.tokens.controlled[0].actor).");
  }
  await actor.update({ "system.resources.lair.inside": inside });
  if (auto && inside) await actor.setFlag(MODULE_ID, FLAGS.LAIR_INSIDE_AUTO, true);
  else await actor.unsetFlag(MODULE_ID, FLAGS.LAIR_INSIDE_AUTO);
  return actor;
}

/**
 * Mark a scene as a boss's lair: combats started there activate the boss's
 * lair mode automatically.
 * @param {Actor} actor
 * @param {Scene} [scene=canvas.scene]
 */
export async function markScene(actor, scene = canvas.scene) {
  if (!(actor instanceof Actor)) throw new Error("markScene: first argument must be an Actor.");
  if (!scene) throw new Error("markScene: no scene given and no scene is being viewed.");
  await scene.setFlag(MODULE_ID, FLAGS.LAIR_SCENE, baseUuid(actor));
  ui.notifications.info(game.i18n.format("BOSSFORGE.Lair.SceneMarked", { scene: scene.name, name: actor.name }));
  return scene;
}

/**
 * @param {Scene} [scene=canvas.scene]
 */
export async function clearScene(scene = canvas.scene) {
  if (!scene) throw new Error("clearScene: no scene given and no scene is being viewed.");
  await scene.unsetFlag(MODULE_ID, FLAGS.LAIR_SCENE);
  ui.notifications.info(game.i18n.format("BOSSFORGE.Lair.SceneCleared", { scene: scene.name }));
  return scene;
}

/**
 * Enable/disable all lair prompts for one boss (both actor sides).
 * @param {Actor} actor
 * @param {boolean} [enabled=true]
 */
export async function setLairPromptEnabled(actor, enabled = true) {
  if (!(actor instanceof Actor)) {
    throw new Error("setLairPromptEnabled: first argument must be an Actor (tip: canvas.tokens.controlled[0].actor).");
  }
  for (const side of actorSides(actor)) {
    if (enabled) await side.unsetFlag(MODULE_ID, FLAGS.LAIR_PROMPT_DISABLED);
    else await side.setFlag(MODULE_ID, FLAGS.LAIR_PROMPT_DISABLED, true);
  }
  return actor;
}

/**
 * Attach an FX preset to the boss's lair-mode activation
 * (flags.boss-forge.lairFx on the actor, both sides).
 * @param {Actor} actor
 * @param {string} preset
 * @param {object} [options]
 */
export async function setActorLairFx(actor, preset, options = {}) {
  if (!(actor instanceof Actor)) throw new Error("setActorLairFx: first argument must be an Actor.");
  const config = Array.isArray(preset) ? { steps: preset } : { preset, options };
  assertValidFxConfig(Array.isArray(preset) ? preset : config);
  for (const side of actorSides(actor)) {
    // setFlag merges objects; unset first so shape switches leave no residue.
    await side.unsetFlag(MODULE_ID, FLAGS.LAIR_FX);
    await side.setFlag(MODULE_ID, FLAGS.LAIR_FX, config);
  }
  return actor;
}

/**
 * @param {Actor} actor
 */
export async function clearActorLairFx(actor) {
  if (!(actor instanceof Actor)) throw new Error("clearActorLairFx: first argument must be an Actor.");
  for (const side of actorSides(actor)) {
    await side.unsetFlag(MODULE_ID, FLAGS.LAIR_FX);
  }
  return actor;
}
