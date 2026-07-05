import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { log } from "./logger.mjs";
import { runDiagnostics, buildDiagnosticsReport } from "./diagnostics.mjs";
import { registerLegendaryOrchestrator, setPromptEnabled } from "./legendary/orchestrator.mjs";
import { setItemFx, clearItemFx, getItemFx, registerTemplateFx } from "./legendary/item-fx.mjs";
import {
  registerLegendaryResistance,
  setActorLegresFx,
  clearActorLegresFx
} from "./legendary/resistance.mjs";
import { playPreset, playFx, listPresets, presetExists, describePreset, clearAuras } from "./fx/presets.mjs";
import { openCatalog, registerCatalogButton } from "./fx/catalog.mjs";
import {
  registerLairOrchestrator,
  setInside,
  markScene,
  clearScene,
  setLairPromptEnabled,
  setActorLairFx,
  clearActorLairFx
} from "./lair.mjs";
import {
  registerPhaseOrchestrator,
  setPhases,
  getPhases,
  clearPhases,
  resetPhases,
  advancePhase,
  getPhaseIndex,
  setItemPhase,
  clearItemPhase,
  linkDeaths,
  clearDeathLink,
  linkGap,
  clearGapLink
} from "./phases.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerLegendaryOrchestrator();
  registerLegendaryResistance();
  registerLairOrchestrator();
  registerPhaseOrchestrator();
  registerTemplateFx();
  registerCatalogButton();
  log.info("Initialized.");
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  module.api = Object.freeze({
    diagnostics: runDiagnostics,
    buildDiagnosticsReport,
    fx: Object.freeze({
      play: playPreset,
      playSteps: playFx,
      list: listPresets,
      exists: presetExists,
      describe: describePreset,
      clearAuras,
      openCatalog
    }),
    legendary: Object.freeze({
      setItemFx,
      clearItemFx,
      getItemFx,
      setPromptEnabled,
      setActorLegresFx,
      clearActorLegresFx
    }),
    lair: Object.freeze({
      setInside,
      markScene,
      clearScene,
      setPromptEnabled: setLairPromptEnabled,
      setActorLairFx,
      clearActorLairFx
    }),
    phases: Object.freeze({
      set: setPhases,
      get: getPhases,
      clear: clearPhases,
      reset: resetPhases,
      advance: advancePhase,
      getIndex: getPhaseIndex,
      setItemPhase,
      clearItemPhase,
      linkDeaths,
      clearDeathLink,
      linkGap,
      clearGapLink
    })
  });
  log.info(`Ready (version ${module.version}).`);
  log.debug("Debug logging is enabled.");
});
