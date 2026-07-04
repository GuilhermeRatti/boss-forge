import { MODULE_ID, SETTINGS, FLAGS } from "../constants.mjs";
import { log } from "../logger.mjs";
import { escapeHtml, actorSides } from "../utils.mjs";
import { playPreset, presetExists, listPresets } from "../fx/presets.mjs";

/**
 * Legendary resistance companion (M2, final scope): dnd5e's native card
 * button ("Use Legendary Resistance") is the burn UI. Boss Forge only adds
 * what that flow lacks — a chat announcement whose visibility follows module
 * settings regardless of the save roll's own privacy (GMs roll monster saves
 * privately), and an optional per-boss FX. The announcement deliberately does
 * not reveal how many resistances remain: players should not know.
 * See docs/design/m2-resistencia-lendaria.md §10.
 */

export function registerLegendaryResistance() {
  Hooks.on("updateChatMessage", onSaveMessageUpdated);
}

/**
 * dnd5e's resistSave (the card button) sets flags.dnd5e.roll.forceSuccess on
 * the save message — that flip is the burn signal. Runs on the active GM only.
 * @param {ChatMessage} message
 * @param {object} changes
 */
async function onSaveMessageUpdated(message, changes) {
  try {
    if (!game.user.isActiveGM) return;
    if (!game.settings.get(MODULE_ID, SETTINGS.LEGRES_ANNOUNCE)) return;
    const forced = changes?.flags?.dnd5e?.roll?.forceSuccess
      ?? changes?.flags?.dnd5e?.["roll.forceSuccess"]
      ?? changes?.["flags.dnd5e.roll.forceSuccess"];
    if (forced !== true) return;
    const actor = message.getAssociatedActor?.() ?? ChatMessage.getSpeakerActor(message.speaker);
    if (!actor) return;
    await createBurnMessage(actor);
    const tokenDoc = game.scenes.get(message.speaker?.scene)?.tokens?.get(message.speaker?.token)
      ?? actor.token
      ?? actor.getActiveTokens(false, true)[0];
    await playActorLegresFx(actor, tokenDoc);
  } catch (err) {
    log.error("Legendary resistance burn announcement failed.", err);
  }
}

async function createBurnMessage(actor) {
  const content = game.i18n.format("BOSSFORGE.LegRes.BurnMessage", { name: escapeHtml(actor.name) });
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
 * Attach an FX preset to a boss's legendary resistance burn
 * (flags.boss-forge.legresFx on the actor, both sides for unlinked tokens).
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
