import { MODULE_ID } from "../constants.mjs";
import { log } from "../logger.mjs";
import { listPresets, describePreset, playPreset } from "./presets.mjs";
import { setItemFx } from "../legendary/item-fx.mjs";
import { setActorLegresFx } from "../legendary/resistance.mjs";
import { setActorLairFx } from "../lair.mjs";
import { getActivitiesByActivationType } from "../legendary/activities.mjs";

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
 * the registry metadata, live preview on the controlled token, and one-click
 * apply onto the existing FX flags (legendary/lair items, legres, lair mode).
 */
export class FxCatalog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "boss-forge-fx-catalog",
    classes: ["boss-forge-app"],
    window: {
      title: "BOSSFORGE.FxCatalog.Title",
      icon: "fa-solid fa-fire-flame-curved",
      resizable: true
    },
    position: { width: 840, height: 600 },
    actions: {
      selectPreset: FxCatalog.#onSelectPreset,
      preview: FxCatalog.#onPreview,
      apply: FxCatalog.#onApply,
      copySnippet: FxCatalog.#onCopySnippet,
      openDatabaseViewer: FxCatalog.#onOpenDatabaseViewer
    }
  };

  static PARTS = {
    main: { template: "modules/boss-forge/templates/fx-catalog.hbs" }
  };

  #selected = "impact";
  #values = {};

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
    const params = meta.params.map(p => ({
      key: p.key,
      type: p.type,
      isFile: p.type === "file",
      isNumber: p.type === "number",
      isColor: p.type === "color",
      isBoolean: p.type === "boolean",
      label: game.i18n.localize(`BOSSFORGE.FxParams.${p.key}.Label`),
      hint: game.i18n.localize(`BOSSFORGE.FxParams.${p.key}.Hint`),
      value: stored[p.key] ?? p.default ?? (p.type === "boolean" ? false : "")
    }));

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

  #previewContext() {
    const controlled = canvas.tokens.controlled;
    if (!controlled.length) {
      ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.NoToken"));
      return null;
    }
    const source = controlled[0];
    const targets = [...game.user.targets];
    return { source, locations: targets.length ? targets : [source] };
  }

  static async #onSelectPreset(event, target) {
    this.#readForm();
    this.#selected = target.dataset.preset;
    await this.render();
  }

  static async #onPreview() {
    const context = this.#previewContext();
    if (!context) return;
    const played = await playPreset(this.#selected, { ...this.#readForm(), ...context });
    if (!played) ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.PreviewFailed"));
  }

  static async #onApply() {
    const actor = canvas.tokens.controlled[0]?.actor;
    if (!actor) return ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.NoToken"));
    const options = this.#readForm();
    const mode = this.element.querySelector("[name=applyMode]")?.value;
    try {
      if (mode === "item") {
        const itemId = this.element.querySelector("[name=applyItem]")?.value;
        const item = actor.items.get(itemId);
        if (!item) return ui.notifications.warn(game.i18n.localize("BOSSFORGE.FxCatalog.NoItem"));
        const at = this.element.querySelector("[name=applyAt]")?.value ?? "boss";
        await setItemFx(item, this.#selected, { ...options, at });
        ui.notifications.info(game.i18n.format("BOSSFORGE.FxCatalog.AppliedItem", { item: item.name }));
      } else if (mode === "legres") {
        await setActorLegresFx(actor, this.#selected, options);
        ui.notifications.info(game.i18n.format("BOSSFORGE.FxCatalog.AppliedLegres", { name: actor.name }));
      } else {
        await setActorLairFx(actor, this.#selected, options);
        ui.notifications.info(game.i18n.format("BOSSFORGE.FxCatalog.AppliedLair", { name: actor.name }));
      }
    } catch (err) {
      log.error("FX catalog apply failed.", err);
      ui.notifications.error(err.message);
    }
  }

  static async #onCopySnippet() {
    const options = this.#readForm();
    const code = [
      `game.modules.get("boss-forge").api.fx.play("${this.#selected}", {`,
      `  ...${JSON.stringify(options)},`,
      "  source: canvas.tokens.controlled[0],",
      "  locations: game.user.targets.size ? [...game.user.targets] : canvas.tokens.controlled",
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
      icon: "fa-solid fa-fire-flame-curved",
      order: 100,
      button: true,
      onChange: () => openCatalog()
    };
  });
}
