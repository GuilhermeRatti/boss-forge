# Pesquisa M5 — Sequencer 4.2.2 INSTALADO: API para os presets novos (2026-07-04)

> Grep em `%LOCALAPPDATA%\FoundryVTT\Data\modules\sequencer\dist\sequencer.js`. Complementa `2026-07-03-sequencer-effects.md` e `2026-07-04-m1-fontes-instaladas.md` (construtor/scale/atLocation/delay já confirmados).

## Assinaturas confirmadas (EffectSection)

- `persist(inBool = true, inOptions)` (~23195) — efeitos persistentes (auras); sobrevivem a reload (Sequencer grava na cena).
- `attachTo(inObject, inOptions)` (~23311) — segue o token.
- `stretchTo(inLocation, inOptions)` (~23435) — raios/beams entre dois pontos.
- `shape(inType, inOptions)` (~23713) — formas sem asset (telegraph): opções confirmadas no renderer (~17846–17855): `fillColor`, `lineColor`, `isMask`, `gridUnits` (`sizeMultiplier = shape.gridUnits ? canvas.grid.size : 1` ⇒ **raio em unidades de grid quando `gridUnits: true`**).
- `belowTokens(inBool)` (~24297) — telegraph/aura sob os tokens.
- `fadeIn(duration, options)` (~22090) / `fadeOut` idem; `origin(inOrigin)` (~22944) aceita string/documento (vira uuid).
- `Sequencer.EffectManager.endEffects(filtro)` (~11626) — limpeza determinística por `{ origin }` (usado para encerrar auras marcadas com `origin("boss-forge.aura.<tokenUuid>")` sem tocar em efeitos de outros módulos).

## Implicação de arquitetura

Nenhuma das capacidades exige asset garantido: telegraph é 100% shape; beam/aura validam o `file` como sempre (`entryExists` + softFail). O registro de presets vira **um módulo por preset com metadados de parâmetros** (`{ id, params, play }`) — a mesma estrutura alimenta a API e o futuro catálogo/preview do M5 parte 2 (convenção de modularidade do usuário).
