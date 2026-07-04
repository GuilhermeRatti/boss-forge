import { MODULE_ID, SETTINGS, FLAGS } from "../constants.mjs";
import { log } from "../logger.mjs";
import { actorSides } from "../utils.mjs";
import { isEligibleBoss, getLegendaryResource } from "./activities.mjs";
import { promptLegendaryActions } from "./prompt.mjs";

/**
 * Runtime orchestrator for the legendary action cycle (M1).
 *
 * dnd5e already resets legact.spent natively (encounter start and the boss's
 * own turnEnd) and activity.use() already consumes it — this module only
 * prompts the GM at the right moments. See docs/design/m1-ciclo-acao-lendaria.md.
 */

// Serialize prompt chains: if the GM advances turns while dialogs are open,
// skip the new trigger instead of stacking dialogs.
let promptChainActive = false;

export function registerLegendaryOrchestrator() {
  Hooks.on("combatTurnChange", onCombatTurnChange);
}

/**
 * Enable/disable the legendary prompt for one boss (the "Don't ask again"
 * opt-out flag). Takes effect at the next turn change.
 *
 * Unlinked tokens split a boss into a world actor plus per-token synthetic
 * actors (the combat uses the synthetic one, and its ActorDelta overrides the
 * world actor's flags). Apply to every side so the toggle works no matter
 * which reference was passed.
 * @param {Actor} actor              World actor or a token's synthetic actor.
 * @param {boolean} [enabled=true]
 */
export async function setPromptEnabled(actor, enabled = true) {
  if (!(actor instanceof Actor)) {
    throw new Error(
      "setPromptEnabled: first argument must be an Actor. Tip: select the boss token and pass canvas.tokens.controlled[0].actor."
    );
  }
  for (const side of actorSides(actor)) {
    if (enabled) await side.unsetFlag(MODULE_ID, FLAGS.LEGENDARY_PROMPT_DISABLED);
    else await side.setFlag(MODULE_ID, FLAGS.LEGENDARY_PROMPT_DISABLED, true);
  }
  return actor;
}

/**
 * @param {Combat} combat
 * @param {object} prior    CombatHistoryData of the turn that ended
 * @param {object} current  CombatHistoryData of the turn that started
 */
async function onCombatTurnChange(combat, prior, current) {
  // Fires on all clients after the update; only the active GM acts.
  if (!game.user.isActiveGM) return;
  if (!game.settings.get(MODULE_ID, SETTINGS.LEGENDARY_PROMPT)) return;

  const priorCombatant = combat.combatants.get(prior?.combatantId);
  if (!priorCombatant) return;

  const bosses = combat.combatants.filter(c =>
    c !== priorCombatant &&
    !c.isDefeated &&
    c.actor &&
    !(c.actor.system?.attributes?.hp?.value <= 0) &&
    !c.actor.getFlag(MODULE_ID, FLAGS.LEGENDARY_PROMPT_DISABLED) &&
    isEligibleBoss(c) &&
    getLegendaryResource(c.actor).value > 0
  );
  if (!bosses.length) return;

  if (promptChainActive) {
    log.debug("Legendary prompt chain already active; skipping this turn change.");
    return;
  }
  promptChainActive = true;
  try {
    for (const boss of bosses) {
      log.debug(`Legendary prompt: ${boss.actor.name} (end of ${priorCombatant.name}'s turn).`);
      await promptLegendaryActions(boss, { triggerName: priorCombatant.name });
    }
  } finally {
    promptChainActive = false;
  }
}
