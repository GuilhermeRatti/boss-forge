import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { log } from "./logger.mjs";
import { runDiagnostics, buildDiagnosticsReport } from "./diagnostics.mjs";
import { registerLegendaryOrchestrator, setPromptEnabled } from "./legendary/orchestrator.mjs";
import { setItemFx, clearItemFx, getItemFx } from "./legendary/item-fx.mjs";
import {
  registerLegendaryResistance,
  setActorLegresFx,
  clearActorLegresFx
} from "./legendary/resistance.mjs";
import { playPreset, listPresets, presetExists } from "./fx/presets.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerLegendaryOrchestrator();
  registerLegendaryResistance();
  log.info("Initialized.");
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  module.api = Object.freeze({
    diagnostics: runDiagnostics,
    buildDiagnosticsReport,
    fx: Object.freeze({
      play: playPreset,
      list: listPresets,
      exists: presetExists
    }),
    legendary: Object.freeze({
      setItemFx,
      clearItemFx,
      getItemFx,
      setPromptEnabled,
      setActorLegresFx,
      clearActorLegresFx
    })
  });
  log.info(`Ready (version ${module.version}).`);
  log.debug("Debug logging is enabled.");
});
