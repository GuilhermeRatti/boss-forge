import { MODULE_ID } from "../constants.mjs";
import { log } from "../logger.mjs";
import { listPresets, describePreset, playPreset, playFx } from "./presets.mjs";
import { setItemFx } from "../legendary/item-fx.mjs";
import { setActorLegresFx } from "../legendary/resistance.mjs";
import { setActorLairFx } from "../lair.mjs";
import { getActivitiesByActivationType } from "../legendary/activities.mjs";
import { registerColorWheel } from "./color-wheel.mjs";

registerColorWheel();

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PRESET_ICONS = {
  impact: "fa-solid fa-burst",
  telegraph: "fa-solid fa-bullseye",
  beam: "fa-solid fa-bolt",
  rain: "fa-solid fa-meteor",
  aura: "fa-solid fa-fire-flame-simple"
};

/**
 * The FX Forge: browsable preset catalog with parameter forms generated from
 * the registry metadata, a composition tray (ordered steps with per-step
 * delays), live preview on the controlled token, and one-click apply onto
 * the existing FX flags (legendary/lair items, legres, lair mode).
 */
export class FxCatalog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "boss-forge-fx-catalog",
    classes: ["boss-forge-app"],
    window: {
      title: "BOSSFORGE.FxCatalog.Title",
      icon: "fa-solid fa-hammer",
      resizable: true
    },
    position: { width: 860, height: 640 },
    actions: {
      selectPreset: FxCatalog.#onSelectPreset,
      preview: FxCatalog.#onPreview,
      apply: FxCatalog.#onApply,
      copySnippet: FxCatalog.#onCopySnippet,
      openDatabaseViewer: FxCatalog.#onOpenDatabaseViewer,
      addStep: FxCatalog.#onAddStep,
      removeStep: FxCatalog.#onRemoveStep
    }
  };

  static PARTS = {
    main: { template: "modules/boss-forge/templates/fx-catalog.hbs" }
  };

  #selected = "impact";
  #values = {};
  #steps = [];

  async _prepareContext() {
    const presets = listPresets().map(id => ({
      id,
      active: id === this.#selected,
      icon: PRESET_ICONS[id] ?? "fa-solid fa-wand-sparkles",
      name: game.i18n.localize(`BOSSFORGE.FxPresets.${id}.Name`),
      tag: game.i18n.localize(`BOSSFORGE.FxPresets.${id}.Tag`)
    }));

    const meta = describePreset(this.#selected);
    const stored = this.#values[this.#selected] ?? {};
    const params = meta.params.map(p => {
      const value = stored[p.key] ?? p.default ?? (p.type === "boolean" ? false : "");
      return {
        key: p.key,
        type: p.type,
        isFile: p.type === "file",
        isNumber: p.type === "number",
        isColor: p.type === "color",
        isBoolean: p.type === "boolean",
        isSelect: p.type === "select",
        options: p.type === "select"
          ? p.options.map(o => ({
              value: o,
              label: game.i18n.localize(`BOSSFORGE.FxParams.${p.key}.Options.${o}`),
              selected: value === o
            }))
          : null,
        label: game.i18n.localize(`BOSSFORGE.FxParams.${p.key}.Label`),
        hint: game.i18n.localize(`BOSSFORGE.FxParams.${p.key}.Hint`),
        value
      };
    });

    const actor = canvas.tokens.controlled[0]?.actor ?? null;
    const items = actor
      ? [...new Map(
          [...getActivitiesByActivationType(actor, "legendary"), ...getActivitiesByActivationType(actor, "lair")]
            .map(e => [e.item.id, e.item])
        ).values()].map(i => ({ id: i.id, name: i.name }))
      : [];

    return {
      presets,
      selected: {
        id: this.#selected,
        icon: PRESET_ICONS[this.#selected] ?? "fa-solid fa-wand-sparkles",
        name: game.i18n.localize(`BOSSFORGE.FxPresets.${this.#selected}.Name`),
        description: game.i18n.localize(`BOSSFORGE.FxPresets.${this.#selected}.Description`)
      },
      params,
      steps: this.#steps.map((s, index) => ({
        index,
        order: index + 1,
        icon: PRESET_ICONS[s.preset] ?? "fa-solid fa-wand-sparkles",
        name: game.i18n.localize(`BOSSFORGE.FxPresets.${s.preset}.Name`),
        delay: s.delay ?? 0,
        fit: !!s.fit,
        anchors: [
          { value: "", label: game.i18n.localize("BOSSFORGE.FxCatalog.AtInherit"), selected: !s.at },
          { value: "boss", label: game.i18n.localize("BOSSFORGE.FxCatalog.AtBoss"), selected: s.at === "boss" },
          { value: "targets", label: game.i18n.localize("BOSSFORGE.FxCatalog.AtTargets"), selected: s.at === "targets" },
          { value: "template", label: game.i18n.localize("BOSSFORGE.FxCatalog.AtTemplate"), selected: s.at === "template" }
        ]
      })),
      hasSteps: this.#steps.length > 0,
      hasActor: !!actor,
      actorName: actor?.name,
      items
    };
  }

  /** Read the current parameter form into a plain options object. */
  #readForm() {
    const options = {};
    for (const input of this.element.querySelectorAll("[data-param]")) {
      const key = input.dataset.param;
      if (input.dataset.type === "boolean") options[key] = input.checked;
      else if (input.dataset.type === "number") {
        const value = input.value.trim();
        if (value !== "") options[key] = Number(value);
      } else {
        const value = input.value.trim();
        if (value) options[key] = value;
      }
    }
    this.#values[this.#selected] = { ...options };
    return options;
  }

  /** Sync per-step delay and anchor inputs back into the steps state. */
  #readStepDelays() {
    for (const input of this.element.querySelectorAll("input[name=stepDelay]")) {
      const step = this.#steps[Number(input.dataset.index)];
      if (step) step.delay = Math.max(0, Number(input.value) || 0);
    }
    for (const select of this.element.querySelectorAll("select[name=stepAt]")) {
      const step = this.#steps[Number(select.dataset.index)];
      if (!step) continue;
      if (select.value) step.at = select.value;
      else delete step.at;
    }
    for (const checkbox of this.element.querySelectorAll("input[name=stepFit]")) {
      const step = this.#steps[Number(checkbox.dataset.index)];
      if (!step) continue;
      if (checkbox.checked) step.fit = true;
      else delete step.fit;
    }
  }

  /** @override Wire drag-and-drop reordering of composition steps. */
  _onRender(context, options) {
    super._onRender?.(context, options);
    let dragIndex = null;
    for (const chip of this.element.querySelectorAll(".bf-step-chip")) {
      const grip = chip.querySelector(".bf-step-grip");
      grip?.addEventListener("dragstart", event => {
        dragIndex = Number(chip.dataset.index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(dragIndex));
        event.dataTransfer.setDragImage(chip, 20, 20);
      });
      // Clear on ANY drag end (drop, ESC, drag-out) so a stale index can
      // never let an unrelated drop reorder the steps.
      grip?.addEventListener("dragend", () => { dragIndex = null; });
      chip.addEventListener("dragover", event => {
        if (dragIndex === null) return;
        event.preventDefault();
        chip.classList.add("bf-drop-target");
      });
      chip.addEventListener("dragleave", () => chip.classList.remove("bf-drop-target"));
      chip.addEventListener("drop", async event => {
        event.preventDefault();
        chip.classList.remove("bf-drop-target");
        const to = Number(chip.dataset.index);
        if (dragIndex === null || dragIndex === to) return;
        this.#readForm();
        this.#readStepDelays();
        const [moved] = this.#steps.splice(dragIndex, 1);
        this.#steps.splice(to, 0, moved);
        dragIndex = null;
        await this.render();
      });
    }
  }

  /** The composition if steps exist, else the current single-preset form. */
  #currentConfig() {
    this.#readStepDelays();
    if (this.#steps.length) return this.#steps.map(s => ({ ...s }));
    return { preset: this.#selected, options: this.#readForm() };
  }

  #previewContext() {
    const controlled = canvas.tokens.controlled;
    if (!controlled.length) {
      ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.NoToken"));
      return null;
    }
    const source = controlled[0];
    const targets = [...game.user.targets];
    return {
      source,
      locations: targets.length ? targets : [source],
      targets: targets.length ? targets : undefined
    };
  }

  static async #onSelectPreset(event, target) {
    this.#readForm();
    this.#readStepDelays();
    this.#selected = target.dataset.preset;
    await this.render();
  }

  static async #onAddStep() {
    this.#readStepDelays();
    this.#steps.push({ preset: this.#selected, options: this.#readForm(), delay: this.#steps.length ? 600 : 0 });
    await this.render();
  }

  static async #onRemoveStep(event, target) {
    this.#readForm();
    this.#readStepDelays();
    this.#steps.splice(Number(target.dataset.index), 1);
    await this.render();
  }

  static async #onPreview() {
    const context = this.#previewContext();
    if (!context) return;
    const config = this.#currentConfig();
    const played = Array.isArray(config)
      ? await playFx(config, context)
      : await playPreset(config.preset, { ...config.options, ...context });
    if (!played) ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.PreviewFailed"));
  }

  static async #onApply() {
    const actor = canvas.tokens.controlled[0]?.actor;
    if (!actor) return ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.NoToken"));
    const config = this.#currentConfig();
    const single = !Array.isArray(config);
    const mode = this.element.querySelector("[name=applyMode]")?.value;
    try {
      if (mode === "item") {
        const itemId = this.element.querySelector("[name=applyItem]")?.value;
        const item = actor.items.get(itemId);
        if (!item) return ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.NoItem"));
        const at = this.element.querySelector("[name=applyAt]")?.value ?? "boss";
        if (single) await setItemFx(item, config.preset, { ...config.options, at });
        else await setItemFx(item, config, { at });
        ui.notifications.info(game.i18n.format("BOSSFORGE.FxCatalog.AppliedItem", { item: item.name }));
      } else if (mode === "legres") {
        await setActorLegresFx(actor, single ? config.preset : config, single ? config.options : undefined);
        ui.notifications.info(game.i18n.format("BOSSFORGE.FxCatalog.AppliedLegres", { name: actor.name }));
      } else {
        await setActorLairFx(actor, single ? config.preset : config, single ? config.options : undefined);
        ui.notifications.info(game.i18n.format("BOSSFORGE.FxCatalog.AppliedLair", { name: actor.name }));
      }
    } catch (err) {
      log.error("FX catalog apply failed.", err);
      ui.notifications.error(err.message);
    }
  }

  static async #onCopySnippet() {
    const config = this.#currentConfig();
    const context = [
      "  source: canvas.tokens.controlled[0],",
      "  locations: game.user.targets.size ? [...game.user.targets] : canvas.tokens.controlled"
    ].join("\n");
    const code = Array.isArray(config)
      ? [
          `game.modules.get("boss-forge").api.fx.playSteps(${JSON.stringify(config, null, 2)}, {`,
          context,
          "});"
        ].join("\n")
      : [
          `game.modules.get("boss-forge").api.fx.play("${config.preset}", {`,
          `  ...${JSON.stringify(config.options)},`,
          context,
          "});"
        ].join("\n");
    await game.clipboard.copyPlainText(code);
    ui.notifications.info(game.i18n.localize("BOSSFORGE.FxCatalog.Copied"));
  }

  static #onOpenDatabaseViewer() {
    if (globalThis.Sequencer?.DatabaseViewer?.show) Sequencer.DatabaseViewer.show();
    else ui.notifications.warn("Sequencer Database Viewer unavailable.");
  }
}

/** Open (or focus) the FX Forge catalog. */
export function openCatalog() {
  const existing = foundry.applications.instances.get("boss-forge-fx-catalog");
  if (existing) return existing.bringToFront();
  return new FxCatalog().render({ force: true });
}

/** GM-only button on the token controls to open the catalog. */
export function registerCatalogButton() {
  Hooks.on("getSceneControlButtons", controls => {
    if (!game.user.isGM) return;
    const tokens = controls.tokens;
    if (!tokens?.tools) return;
    tokens.tools.bossForgeFxCatalog = {
      name: "bossForgeFxCatalog",
      title: "BOSSFORGE.FxCatalog.OpenButton",
      icon: "fa-solid fa-hammer",
      order: 100,
      button: true,
      onChange: () => openCatalog()
    };
  });
}
