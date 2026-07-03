# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-07-03

### Added

- Module foundation: manifest for Foundry VTT v13 with Sequencer as a required dependency, plain ESM entry point (no build step), `en` and `pt-BR` localization.
- Client setting **Debug logging** and a namespaced logger (`Boss Forge |` console prefix).
- Diagnostics API (`game.modules.get("boss-forge").api.diagnostics()`) reporting core/system/module versions and Sequencer database prefixes, plus the **Boss Forge: Diagnostics** macro shipped in the *Boss Forge Macros* compendium.
- Compendium pack pipeline: JSON sources in `packs/_source/` compiled to LevelDB via `npm run packs:build`.
- GitHub Actions release workflow: pushing a `v*` tag builds packs, stamps version/URLs into `module.json` and publishes `module.zip` + `module.json` with a stable latest-manifest URL.
