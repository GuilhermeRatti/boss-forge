import { MODULE_ID, SETTINGS, FLAGS } from "../constants.mjs";
import { log } from "../logger.mjs";
import { escapeHtml, actorSides } from "../utils.mjs";
import { playPreset, presetExists, listPresets } from "../fx/presets.mjs";
import { registerSocketHandler, executeAsGM, socketAvailable } from "../socket.mjs";

/**
 * Legendary resistance (M2): intercept failed boss saves inside the Midi-QOL
 * workflow, ask the GM whether to burn a use, and force the save to a success
 * before damage/effects apply.
 *
 * The workflow (and this hook) runs on the client of whoever used the item —
 * typically a player. The GM dialog and the legres update therefore run
 * GM-side via socketlib; the workflow client only mutates the workflow's
 * saves/failedSaves sets with the GM's verdict.
 * See docs/design/m2-resistencia-lendaria.md.
 */

const SOCKET_PROMPT = "legresPrompt";

export function registerLegendaryResistance() {
  Hooks.on("midi-qol.preSavesComplete", onPreSavesComplete);
  // Native path (saves rolled outside a Midi workflow): announce burns made
  // through dnd5e's own card button.
  Hooks.on("updateChatMessage", onSaveMessageUpdated);
  registerSocketHandler(SOCKET_PROMPT, handleGmPrompt);
}

function getLegres(actor) {
  return actor?.system?.resources?.legres ?? null;
}

/**
 * Bosses in failedSaves that could still burn a legendary resistance.
 * Elements of the midi sets may be Token placeables or TokenDocuments —
 * keep the original reference for the set mutation later.
 */
function eligibleFailedBosses(workflow) {
  const out = [];
  for (const target of workflow.failedSaves ?? []) {
    const tokenDoc = target.document ?? target;
    const actor = tokenDoc?.actor;
    if (!actor) continue;
    const legres = getLegres(actor);
    if (!legres || !(legres.max > 0) || legres.value <= 0) continue;
    if (actor.getFlag(MODULE_ID, FLAGS.LEGRES_PROMPT_DISABLED)) continue;
    out.push({ target, tokenDoc, actor });
  }
  return out;
}

/**
 * midi-qol.preSavesComplete handler. Always returns true: a Boss Forge
 * failure must never abort the player's workflow.
 * @param {object} workflow
 */
async function onPreSavesComplete(workflow) {
  try {
    if (!game.settings.get(MODULE_ID, SETTINGS.LEGRES_PROMPT)) return true;
    const candidates = eligibleFailedBosses(workflow);
    if (!candidates.length) return true;
    if (!socketAvailable()) {
      log.warn("Legendary resistance: socketlib unavailable; saves stay failed.");
      return true;
    }

    const context = {
      itemName: workflow.saveItem?.name ?? workflow.item?.name ?? "?",
      casterName: workflow.actor?.name ?? "?",
      saveDC: workflow.saveDC ?? null
    };

    for (const candidate of candidates) {
      const payload = {
        actorUuid: candidate.actor.uuid,
        tokenUuid: candidate.tokenDoc.uuid,
        ...context
      };
      let verdict = null;
      try {
        verdict = await executeAsGM(SOCKET_PROMPT, payload);
      } catch (err) {
        log.warn("Legendary resistance: could not reach an active GM; save stays failed.", err);
        continue;
      }
      if (verdict?.burned) {
        workflow.failedSaves.delete(candidate.target);
        workflow.saves.add(candidate.target);
        log.debug(`Legendary resistance burned for ${candidate.actor.name}; save forced to success.`);
      }
    }
  } catch (err) {
    log.error("Legendary resistance hook failed; workflow continues untouched.", err);
  }
  return true;
}

/* -------------------------------------------- */
/*  GM side (runs via socketlib)                */
/* -------------------------------------------- */

/**
 * @param {object} payload  {actorUuid, tokenUuid, itemName, casterName, saveDC}
 * @returns {Promise<{burned: boolean}>}
 */
async function handleGmPrompt(payload) {
  const actor = await fromUuid(payload.actorUuid);
  const tokenDoc = await fromUuid(payload.tokenUuid);
  if (!actor) return { burned: false };
  const legres = getLegres(actor);
  if (!legres || legres.value <= 0) return { burned: false };

  const choice = await showGmDialog({ actor, legres, payload });

  if (choice === "optout") {
    await setResistPromptEnabled(actor, false);
    ui.notifications.info(game.i18n.format("BOSSFORGE.LegRes.OptOutConfirmed", { name: actor.name }));
    return { burned: false };
  }
  if (choice !== "burn") return { burned: false };

  await actor.update({ "system.resources.legres.spent": legres.spent + 1 });
  await createBurnMessage(actor, { remaining: Math.max(legres.value - 1, 0), max: legres.max });
  await playActorLegresFx(actor, tokenDoc);
  return { burned: true };
}

/* -------------------------------------------- */
/*  Native path (saves outside Midi workflows)  */
/* -------------------------------------------- */

/**
 * Announce burns made through dnd5e's native resistSave (the card button):
 * forceSuccess flips to true on the message.
 * Posts an independent chat message that follows the visibility setting
 * regardless of whether the save roll itself was private. The workflow path
 * announces directly and never sets forceSuccess, so nothing double-fires.
 * @param {ChatMessage} message
 * @param {object} changes
 */
async function onSaveMessageUpdated(message, changes) {
  try {
    if (!game.user.isActiveGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.LEGRES_PROMPT)) return;
    const forced = changes?.flags?.dnd5e?.roll?.forceSuccess
      ?? changes?.flags?.dnd5e?.["roll.forceSuccess"]
      ?? changes?.["flags.dnd5e.roll.forceSuccess"];
    if (forced !== true) return;
    const actor = getMessageActor(message);
    if (!actor) return;
    const legres = getLegres(actor); // resistSave already decremented it
    await createBurnMessage(actor, { remaining: legres?.value ?? 0, max: legres?.max ?? 0 });
    const tokenDoc = game.scenes.get(message.speaker?.scene)?.tokens?.get(message.speaker?.token)
      ?? actor.token
      ?? actor.getActiveTokens(false, true)[0];
    await playActorLegresFx(actor, tokenDoc);
  } catch (err) {
    log.error("Legendary resistance burn announcement failed.", err);
  }
}

function getMessageActor(message) {
  return message.getAssociatedActor?.() ?? ChatMessage.getSpeakerActor(message.speaker);
}

/**
 * @returns {Promise<"burn"|"pass"|"optout"|null>} null = dismissed or timed out (= pass)
 */
async function showGmDialog({ actor, legres, payload }) {
  const content = `
    <p>${game.i18n.format("BOSSFORGE.LegRes.Prompt", {
      name: escapeHtml(actor.name),
      item: escapeHtml(payload.itemName),
      caster: escapeHtml(payload.casterName),
      dc: payload.saveDC ?? "?"
    })}</p>
  `;

  return foundry.applications.api.DialogV2.wait({
    classes: ["boss-forge-legendary"],
    window: {
      title: game.i18n.format("BOSSFORGE.LegRes.DialogTitle", {
        name: actor.name,
        remaining: legres.value,
        max: legres.max
      })
    },
    position: { width: 420 },
    content,
    buttons: [
      { action: "burn", label: "BOSSFORGE.LegRes.Burn", icon: "fa-solid fa-shield-halved", default: true },
      { action: "pass", label: "BOSSFORGE.LegRes.Pass", icon: "fa-solid fa-xmark" },
      { action: "optout", label: "BOSSFORGE.Legendary.OptOut", icon: "fa-solid fa-bell-slash" }
    ]
    // No timeout by design: the burn is the GM's call, and dismissing the
    // dialog (ESC/close) resolves null = "let it fail".
  });
}

async function createBurnMessage(actor, { remaining, max }) {
  const content = game.i18n.format("BOSSFORGE.LegRes.BurnMessage", {
    name: escapeHtml(actor.name),
    remaining,
    max
  });
  const data = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  };
  if (game.settings.get(MODULE_ID, SETTINGS.LEGRES_CHAT_VISIBILITY) === "gm") {
    data.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  }
  await ChatMessage.create(data);
}

async function playActorLegresFx(actor, tokenDoc) {
  const fx = actor.getFlag(MODULE_ID, FLAGS.LEGRES_FX);
  if (!fx?.preset) return;
  const token = tokenDoc?.object ?? tokenDoc;
  if (!token) return;
  await playPreset(fx.preset, { ...(fx.options ?? {}), locations: [token] });
}

/* -------------------------------------------- */
/*  API helpers                                 */
/* -------------------------------------------- */

/**
 * Enable/disable the legendary resistance prompt for one boss (applies to
 * the world actor and its scene tokens alike; see utils.actorSides).
 * @param {Actor} actor
 * @param {boolean} [enabled=true]
 */
export async function setResistPromptEnabled(actor, enabled = true) {
  if (!(actor instanceof Actor)) {
    throw new Error(
      "setResistPromptEnabled: first argument must be an Actor. Tip: select the boss token and pass canvas.tokens.controlled[0].actor."
    );
  }
  for (const side of actorSides(actor)) {
    if (enabled) await side.unsetFlag(MODULE_ID, FLAGS.LEGRES_PROMPT_DISABLED);
    else await side.setFlag(MODULE_ID, FLAGS.LEGRES_PROMPT_DISABLED, true);
  }
  return actor;
}

/**
 * Attach an FX preset to a boss's legendary resistance burn
 * (flags.boss-forge.legresFx on the actor, both sides).
 * @param {Actor} actor
 * @param {string} preset
 * @param {object} [options]  Preset options (e.g. { file, scale, delay }).
 */
export async function setActorLegresFx(actor, preset, options = {}) {
  if (!(actor instanceof Actor)) throw new Error("setActorLegresFx: first argument must be an Actor.");
  if (!presetExists(preset)) {
    throw new Error(`setActorLegresFx: unknown preset "${preset}". Available: ${listPresets().join(", ")}`);
  }
  for (const side of actorSides(actor)) {
    await side.setFlag(MODULE_ID, FLAGS.LEGRES_FX, { preset, options });
  }
  return actor;
}

/**
 * @param {Actor} actor
 */
export async function clearActorLegresFx(actor) {
  if (!(actor instanceof Actor)) throw new Error("clearActorLegresFx: first argument must be an Actor.");
  for (const side of actorSides(actor)) {
    await side.unsetFlag(MODULE_ID, FLAGS.LEGRES_FX);
  }
  return actor;
}
