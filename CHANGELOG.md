# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Legendary resistance companion (M2).** dnd5e's native "Use Legendary Resistance" button on save cards stays the burn UI; Boss Forge adds what that flow lacks: a chat announcement — public by default or GM-only whisper (**Legendary resistance chat message** setting), independent of the save roll's own privacy, and deliberately not revealing how many resistances remain — plus an optional per-boss burn FX (`api.legendary.setActorLegresFx/clearActorLegresFx`).
- Declarative settings registry (data table → registration loop, i18n keys derived from setting keys) to keep the growing settings list organized.
- **Lair orchestration (M3).** 2024 mode (`lair.value`): at combat start (or when the boss joins), the GM is asked whether the fight is inside the lair — flipping dnd5e's native `lair.inside` (+1 max legendary action/resistance); scenes can be marked as a boss's lair (`api.lair.markScene`) for hands-free activation, and module-set toggles revert automatically when the combat ends. 2014 mode (`lair.initiative`): when the tracker crosses the boss's lair count each round (losing ties), the GM gets a prompt with the boss's lair activities (activation type "Lair"), reusing the M1 dialog pattern with used-badges and per-item FX.
- Lair API under `api.lair`: `setInside`, `markScene/clearScene`, `setPromptEnabled`, `setActorLairFx/clearActorLairFx` (activation FX), plus the **Lair orchestration** world setting.
- Prompt dialogs (legendary and lair actions) close after one use by default, matching RAW; the **Multiple uses per prompt** world setting re-enables the reopen-with-badges loop as a house rule.
- **HP phases (M4).** Configure percentage thresholds per boss (`api.phases.set`): when hit points cross one (native `hp.pct`, temp-max aware), the phase transition is announced publicly, plays the phase's FX (single preset or an ordered list) and toggles named ActiveEffects on/off. Damage that crosses several thresholds fires each phase in order; advancement is one-way (healing never regresses it) with `api.phases.reset/advance` for GM control.
- Phase-gated action sets: items flagged with `api.phases.setItemPhase(item, n)` (number or array) only appear in the legendary/lair prompts during matching phases.
- Phases API under `api.phases` (`set/get/clear/reset/advance/getIndex/setItemPhase/clearItemPhase`) and an **HP phases** world setting.
- Phase triggers beyond damage: healing phases (`direction: "up"` — thresholds fire as HP climbs, for protect/heal encounters), death-links (`linkDeaths` — the boss advances a phase once every watched creature is down, e.g. a ritual ending) and HP-gap links (`linkGap` — two bosses both advance a phase when their HP percentages drift apart). Linked triggers fire once and re-arm on `reset`.

- **Legendary action cycle (M1).** At the end of each combat turn, the active GM is prompted with the legendary actions of every other eligible boss (NPC with a `legact` pool and at least one activity with the "Legendary" activation type). Using an action goes through the native `activity.use()`, so consumption, chat cards and the Midi-QOL workflow all behave as if triggered from the sheet; dnd5e's native reset (encounter start and the boss's own turn end) is left untouched.
- Multiple uses per trigger are allowed (the GM adjudicates): the dialog reopens while uses remain, marking actions already used this trigger with a "used ×N" badge and disabling unaffordable ones.
- Per-boss opt-out ("Don't ask again", stored as an actor flag) and a world setting (**Legendary action prompt**) to disable the prompt globally. `api.legendary.setPromptEnabled(actor, enabled)` toggles it and handles unlinked tokens (applies to the world actor and its scene tokens alike).
- System-agnostic FX preset engine (`scripts/fx/`, no dnd5e imports) with the first preset, `impact`. Legendary items opt into FX via `flags.boss-forge.fx` (helper: `api.legendary.setItemFx(item, "impact", { file, at, scale, delay })`); Sequencer database paths are validated before playing and FX failures never break the action flow.
- API surface: `api.fx.play/list/exists`, `api.legendary.setItemFx/clearItemFx/getItemFx/setPromptEnabled`.

## [0.0.1] - 2026-07-03

### Added

- Module foundation: manifest for Foundry VTT v13 with Sequencer as a required dependency, plain ESM entry point (no build step), `en` and `pt-BR` localization.
- Client setting **Debug logging** and a namespaced logger (`Boss Forge |` console prefix).
- Diagnostics API (`game.modules.get("boss-forge").api.diagnostics()`) reporting core/system/module versions and Sequencer database prefixes, plus the **Boss Forge: Diagnostics** macro shipped in the *Boss Forge Macros* compendium.
- Compendium pack pipeline: JSON sources in `packs/_source/` compiled to LevelDB via `npm run packs:build`.
- GitHub Actions release workflow: pushing a `v*` tag builds packs, stamps version/URLs into `module.json` and publishes `module.zip` + `module.json` with a stable latest-manifest URL.
