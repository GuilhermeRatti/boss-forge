# Pesquisa M3 — covil na fonte INSTALADA (dnd5e 5.3.3 + core 13.351), 2026-07-04

> Grep no bundle instalado (`%LOCALAPPDATA%\FoundryVTT\Data\systems\dnd5e\dnd5e.mjs` e core `foundry.mjs`). Complementa a pesquisa de 2026-07-03 (schema já conhecido).

## Fato central: dnd5e NÃO tem integração de combate para lair actions

Todas as ocorrências de `lair` no bundle são: schema (`~73071–77`: `value`, `initiative`, `inside`), ajuste derivado (+1 `legact.max`/`legres.max` e CR quando `lair.value && lair.inside`, ~73317–27), labels de usos na ficha (~73403, ~73484), tipo de ativação **`lair`** para activities (`~44603`; sem consumo) e filtros/labels de UI (~57694, ~60579, ~75675). **Nenhum código de tracker/iniciativa/rounds** — a orquestração da iniciativa 20 (2014) e o momento de togglar `inside` (2024) são inteiramente do módulo.

## Heurística de modo (da própria sheet, ~60631)

A ficha exibe o bloco de covil quando `(modernRules && lair.value) || (!modernRules && lair.initiative)`. Para o runtime, inferência **por dados do ator** (sem depender do setting de regras):

- `lair.initiative` numérico ⇒ modo clássico 2014 (lair actions na contagem, tipicamente 20).
- `lair.value === true` ⇒ modo 2024 (toggle `inside`; bônus nativo).
- Ambos setados ⇒ os dois fluxos operam (configuração do GM, sem conflito).

## Hooks do core (13.351)

- `Hooks.callAll("combatStart", combat, updateData)` (~43667): **pré-update, só no cliente iniciador** (o GM que clica "Begin Combat") — ponto do prompt "está no covil?" do modo 2024.
- `combatRound` idem pré-update/iniciador (~43693/43713); para a iniciativa 20 o orquestrador continua em `combatTurnChange` (todos os clientes, pós-update, guarda de GM ativo — pesquisa M1).
- `createCombatant`/`deleteCombat`: hooks de documento padrão (todos os clientes) — boss entrando em combate já iniciado e limpeza pós-combate.

## Regra 2014 relevante (para o gatilho)

Lair action ocorre na contagem de iniciativa 20, **perdendo empates** — ou seja, dispara quando o tracker passa de um combatente com iniciativa ≥ 20 para um com iniciativa < 20 (ou na virada/início de round quando aplicável).
