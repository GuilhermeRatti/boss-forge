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

## Templates e rotação (verificado 2026-07-05, pós-teste do sopro)

- **`.atLocation(template)` NUNCA rotaciona o sprite.** A rotação da fonte só é aplicada em `_transformAttachedNoStretchSprite` (~17200): `applyRotation = this.data.attachTo?.bindRotation && …` — ou seja, exige `attachTo` com `bindRotation`. `getSourceData()` (~15268) até calcula `rotation` da direção do template (t ≠ "rect"), mas o valor fica no cache sem uso fora do caminho attached. Confirmado no teste do usuário: sopro em `atLocation(cone)` tocou na rotação padrão do asset.
- `get_object_position(obj, {measure})` (~18011): template cone/ray com `measure: true` resolve `ray.B` (endpoint); sem `measure`, cai no fallback (~18100) `obj.x/obj.y` = origem do documento (vértice do cone / centro do círculo / canto do rect). O fallback também aceita **objetos planos `{x, y}`** — pontos crus funcionam em `atLocation`/`stretchTo`/`rotateTowards`.
- `rotateTowards(inLocation)` (~23568) aceita placeable, documento, uuid **ou ponto plano** — é o caminho para orientar um efeito não-esticado à direção do template.
- **Templates instantâneos são deletados por outros módulos no meio da composição** (BLFX: `BlfxMacroExecutor.js` deleta o template logo após a própria animação; visto no log do teste). Referência viva ao placeable é frágil ⇒ o Boss Forge fotografa a geometria (`snapshotTemplate`) no `createMeasuredTemplate` e as etapas conformam ao snapshot (`templateGeometry`/`conformToTemplate` em `scripts/fx/helpers.mjs`).

## Implicação de arquitetura

Nenhuma das capacidades exige asset garantido: telegraph é 100% shape; beam/aura validam o `file` como sempre (`entryExists` + softFail). O registro de presets vira **um módulo por preset com metadados de parâmetros** (`{ id, params, play }`) — a mesma estrutura alimenta a API e o futuro catálogo/preview do M5 parte 2 (convenção de modularidade do usuário).
