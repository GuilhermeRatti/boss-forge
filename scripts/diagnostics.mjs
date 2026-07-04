import { MODULE_ID, MODULE_TITLE } from "./constants.mjs";
import { log } from "./logger.mjs";
import { escapeHtml } from "./utils.mjs";

/**
 * Build a plain-text environment report: Foundry core, game system,
 * active modules and Sequencer database prefixes.
 * @returns {string}
 */
export function buildDiagnosticsReport() {
  const lines = [];
  const module = game.modules.get(MODULE_ID);

  lines.push(`=== ${MODULE_TITLE} Diagnostics ===`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`${MODULE_TITLE}: ${module?.version ?? "unknown"}`);
  lines.push(`Foundry VTT: ${game.version}`);
  lines.push(`System: ${game.system.id} ${game.system.version}`);

  const active = [...game.modules.values()]
    .filter(m => m.active)
    .sort((a, b) => a.id.localeCompare(b.id));
  lines.push(`Active modules (${active.length}):`);
  for (const m of active) lines.push(`  - ${m.id} ${m.version}`);

  const seqDb = globalThis.Sequencer?.Database;
  if (seqDb) {
    const prefixes = Object.keys(seqDb.entries ?? {}).sort();
    lines.push(`Sequencer database prefixes (${prefixes.length}): ${prefixes.join(", ") || "(none)"}`);
  } else {
    lines.push("Sequencer database: unavailable (Sequencer inactive or not ready)");
  }

  return lines.join("\n");
}

/**
 * Run diagnostics: print the report to the console, copy it to the
 * clipboard and show it in a dialog for easy copy/paste.
 * @returns {Promise<string>} the report text
 */
export async function runDiagnostics() {
  const report = buildDiagnosticsReport();

  console.log(report);
  log.debug("Diagnostics report generated.");

  const copied = await game.clipboard?.copyPlainText?.(report)
    .then(() => true)
    .catch(() => false);
  if (copied) ui.notifications?.info(game.i18n.localize("BOSSFORGE.Diagnostics.Copied"));

  await foundry.applications.api.DialogV2.prompt({
    window: { title: "BOSSFORGE.Diagnostics.Title" },
    position: { width: 560 },
    content: `
      <p>${game.i18n.localize("BOSSFORGE.Diagnostics.Instructions")}</p>
      <textarea readonly rows="18" style="width: 100%; font-family: monospace;">${escapeHtml(report)}</textarea>
    `,
    ok: { label: "BOSSFORGE.Diagnostics.Close" },
    rejectClose: false
  });

  return report;
}
