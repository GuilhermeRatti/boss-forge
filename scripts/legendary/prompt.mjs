import { MODULE_ID, SETTINGS, FLAGS } from "../constants.mjs";
import { escapeHtml } from "../utils.mjs";
import { playItemFx } from "./item-fx.mjs";
import { getLegendaryActivities, getLegendaryResource } from "./activities.mjs";

/**
 * Run the legendary action prompt cycle for one boss: show the dialog,
 * use the chosen activity, then re-prompt while uses remain. Multiple uses
 * per trigger are allowed by design (the GM is the referee); actions already
 * used in this cycle get a visual "used ×N" badge for RAW-minded GMs.
 * @param {Combatant} combatant           The boss combatant.
 * @param {object} [context]
 * @param {string} [context.triggerName]  Name of the combatant whose turn just ended.
 */
export async function promptLegendaryActions(combatant, { triggerName } = {}) {
  const actor = combatant.actor;
  const used = new Map();

  while (true) {
    const legact = getLegendaryResource(actor);
    if (!legact || legact.value <= 0) return;
    const entries = getLegendaryActivities(actor);
    if (!entries.length) return;

    const choice = await showDialog({ actor, legact, entries, used, triggerName });
    if (choice === null || choice === "skip") return;

    if (choice === "optout") {
      await actor.setFlag(MODULE_ID, FLAGS.LEGENDARY_PROMPT_DISABLED, true);
      ui.notifications.info(game.i18n.format("BOSSFORGE.Legendary.OptOutConfirmed", { name: actor.name }));
      return;
    }

    // choice is a LegendaryActivityEntry. use() returns void when canceled
    // in the dnd5e usage dialog — only count and play FX on real uses.
    const results = await choice.activity.use();
    if (!results) continue;
    used.set(choice.activity.uuid, (used.get(choice.activity.uuid) ?? 0) + 1);
    await playItemFx(choice.item, combatant);
    // RAW default: one legendary action per trigger. The promptMultiUse
    // setting re-enables the reopen-with-badge loop (house rule).
    if (!game.settings.get(MODULE_ID, SETTINGS.PROMPT_MULTI_USE)) return;
  }
}

/**
 * @returns {Promise<object|string|null>} a LegendaryActivityEntry, "skip",
 *   "optout", or null when the dialog was dismissed (= skip).
 */
async function showDialog({ actor, legact, entries, used, triggerName }) {
  const buttons = entries.map((entry, i) => {
    const usedCount = used.get(entry.activity.uuid) ?? 0;
    const activityName = entry.activity.name?.trim();
    const name = activityName && activityName !== entry.item.name
      ? `${entry.item.name}: ${activityName}`
      : entry.item.name;
    let label = game.i18n.format("BOSSFORGE.Legendary.UseLabel", { name, cost: entry.cost });
    if (usedCount > 0) label += game.i18n.format("BOSSFORGE.Legendary.UsedBadge", { count: usedCount });
    return {
      action: `use-${i}`,
      label,
      icon: "fa-solid fa-bolt",
      disabled: entry.cost > legact.value,
      callback: () => entry
    };
  });

  buttons.push({
    action: "skip",
    label: "BOSSFORGE.Legendary.Skip",
    icon: "fa-solid fa-forward",
    default: true
  });
  buttons.push({
    action: "optout",
    label: "BOSSFORGE.Legendary.OptOut",
    icon: "fa-solid fa-bell-slash"
  });

  const content = `<p>${game.i18n.format("BOSSFORGE.Legendary.Prompt", {
    trigger: escapeHtml(triggerName ?? "?"),
    name: escapeHtml(actor.name),
    remaining: legact.value,
    max: legact.max
  })}</p>`;

  return foundry.applications.api.DialogV2.wait({
    classes: ["boss-forge-legendary"],
    window: {
      title: game.i18n.format("BOSSFORGE.Legendary.DialogTitle", {
        name: actor.name,
        remaining: legact.value,
        max: legact.max
      })
    },
    position: { width: 420 },
    content,
    buttons
    // rejectClose defaults to false: dismissing the dialog resolves null (= skip).
  });
}

