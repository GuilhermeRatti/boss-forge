import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { log } from "./logger.mjs";
import { runDiagnostics, buildDiagnosticsReport } from "./diagnostics.mjs";

Hooks.once("init", () => {
  registerSettings();
  log.info("Initialized.");
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  module.api = Object.freeze({
    diagnostics: runDiagnostics,
    buildDiagnosticsReport
  });
  log.info(`Ready (version ${module.version}).`);
  log.debug("Debug logging is enabled.");
});
