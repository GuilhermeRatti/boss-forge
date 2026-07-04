# Pesquisa M4 — HP/fases na fonte INSTALADA (dnd5e 5.3.3), 2026-07-04

> Grep no bundle instalado. Complementa as pesquisas anteriores.

## HP derivado (base dos thresholds)

`prepareDerivedData` de HP (~26112–26118):

- `hp.effectiveMax = max(hp.max + (hp.tempmax ?? 0), 0)` — **temp max entra no máximo efetivo**;
- **`hp.pct` é nativo**: `clamp(value / effectiveMax * 100, 0, 100)` — thresholds de fase em % comparam direto com `hp.pct`, sem recalcular nada.

## Gatilho de mudança de HP

- `dnd5e.preApplyDamage(actor, amount, updates, options)` (cancelável, ~36739) e `dnd5e.applyDamage(actor, amount, options)` (~36760) existem — mas cobrem só o fluxo `applyDamage` (cards/Midi), **não** edição manual de HP na ficha.
- Decisão: gatilho primário = **hook core `updateActor`** filtrando `changes.system.attributes.hp` — cobre Midi, cards, macros e edição manual. Detecção **por estado** (comparar fase calculada de `hp.pct` com a fase armazenada em flag), dispensando o valor anterior do HP e tolerando saltos (dano que cruza duas fases dispara as duas, em ordem).
- Tokens não-vinculados: updates de HP no ator sintético disparam `updateActor` normalmente (ActorDelta, v11+); flags de config aplicadas nos dois lados (padrão do projeto).

## Troca de "auras"/efeitos

- `ActiveEffect#disabled` é o toggle nativo; `actor.allApplicableEffects()` (core v11+) enumera efeitos do ator e de itens. Fases habilitam/desabilitam efeitos **por nome**.

## Troca de ações

- Sem mecanismo nativo para "esconder" itens de NPC. A troca é feita **dentro do nosso próprio sistema**: flag `flags.boss-forge.phase` no item (número ou array) filtra as activities oferecidas pelos prompts de ações lendárias (M1) e de covil (M3) conforme a fase corrente. A ficha continua mostrando tudo (ferramenta de GM).
