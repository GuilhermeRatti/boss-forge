# Boss Forge

A GM-side authoring and orchestration layer for homebrew **D&D 5e boss fights** in Foundry VTT: legendary action economy, legendary resistance, lair events, HP-based phases and a library of boss-grade FX presets built on top of [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer).

Boss Forge does **not** replace your automation stack (Midi-QOL/DAE) or animation editors (BLFX) — it orchestrates what they don't cover.

> **Status: pre-release (M0 — foundation).** Nothing here is stable yet.

## Requirements

- Foundry VTT **v13**
- dnd5e system (modern / 2024 rules)
- [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) (required dependency)
- Recommended companions: Midi-QOL, DAE, JB2A / BLFX asset packs

## Installation

Install via manifest URL in Foundry's **Add-on Modules → Install Module**:

```
https://github.com/GuilhermeRatti/Boss-Forge/releases/latest/download/module.json
```

To roll back to a specific version, use that release's own manifest URL:

```
https://github.com/GuilhermeRatti/Boss-Forge/releases/download/vX.Y.Z/module.json
```

## Pinned target environment

<!-- Populated from the diagnostics report (docs/environment.md). -->

| Component | Version |
| --- | --- |
| Foundry VTT | 13 (exact build pending diagnostics) |
| dnd5e | pending diagnostics |
| Sequencer | pending diagnostics |
| Midi-QOL | pending diagnostics |
| DAE | pending diagnostics |

## Roadmap

- **M0 — Foundation** *(current)*: module skeleton, i18n, debug logging, diagnostics macro, release pipeline.
- **M1 — Legendary action cycle**: end-of-turn GM prompt, native `legact` consumption, FX presets.
- **M2 — Legendary resistance**: burn-on-failed-save inside the Midi-QOL workflow.
- **M3 — Lair**: initiative-20 prompts (2014 mode) and in-lair legendary action bonus (2024 mode).
- **M4 — Phases**: HP thresholds, transition cutscenes, action-set swaps.
- **M5 — FX preset library**: browsable catalog with parameters and preview.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) (in Brazilian Portuguese) for the full development setup, compendium pack pipeline and release process.

## License

[MIT](LICENSE)
