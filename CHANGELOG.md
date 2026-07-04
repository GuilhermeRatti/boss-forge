# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Legendary resistance (M2).** When a boss with remaining legendary resistances fails a saving throw inside a Midi-QOL workflow, the GM gets a burn/pass dialog (60 s timeout defaults to pass) and a confirmed burn forces the save to a success **before** damage and effects apply, decrementing the native `legres` resource. Works when a player's client runs the workflow: the prompt is relayed to the active GM via socketlib (`"socket": true` added to the manifest; midi-qol and socketlib declared as recommended modules).
- Burn announcements in chat — public by default, switchable to GM-only whisper (**Legendary resistance chat message** setting) — plus an **Auto-burn** world setting (off by default) that skips the dialog while uses remain.
- Optional FX on burn via an actor flag (`api.legendary.setActorLegresFx/clearActorLegresFx`), and `api.legendary.setResistPromptEnabled` for the per-boss opt-out (same both-sides handling as M1 for unlinked tokens).
- Declarative settings registry (data table → registration loop, i18n keys derived from setting keys) to keep the growing settings list organized.

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
