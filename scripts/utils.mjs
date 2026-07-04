/**
 * @param {string} text
 * @returns {string} text safe to interpolate into dialog/chat HTML
 */
export function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Whisper a localized module message to the GMs.
 * @param {string} i18nKey
 * @param {object} [data]  Values for game.i18n.format (pre-escaped by caller).
 */
export async function whisperGM(i18nKey, data = {}) {
  await ChatMessage.create({
    speaker: { alias: "Boss Forge" },
    content: game.i18n.format(i18nKey, data),
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id)
  });
}

/**
 * All actor documents that represent "the same boss" for flag purposes.
 * Unlinked tokens split a boss into a world actor plus per-token synthetic
 * actors (whose ActorDelta overrides the world actor's flags), so toggles
 * must be applied to every side.
 * @param {Actor} actor  World actor or a token's synthetic actor.
 * @returns {Set<Actor>}
 */
export function actorSides(actor) {
  const sides = new Set([actor]);
  if (actor.isToken) {
    const base = actor.token?.baseActor;
    if (base) sides.add(base);
  } else {
    for (const tokenDoc of actor.getActiveTokens(false, true)) {
      if (tokenDoc.actor) sides.add(tokenDoc.actor);
    }
  }
  return sides;
}
