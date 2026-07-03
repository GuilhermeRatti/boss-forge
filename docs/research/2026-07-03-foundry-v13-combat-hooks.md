# Pesquisa M1 — hooks de combate do Foundry v13 (verificado em 2026-07-03)

Fonte: documentação oficial da API v13 (`foundryvtt.com/api`, páginas `hookEvents.combatTurnChange` e `hookEvents.combatTurn`, fetch em 2026-07-03).

## `combatTurnChange` — o hook do orquestrador

```
combatTurnChange(combat: Combat, prior: CombatHistoryData, current: CombatHistoryData): void
```

- Dispara **em todos os clientes, após o update no banco** ("This event fires on all clients after the database update has occurred for the Combat").
- É o ponto de escuta do Runtime Orchestrator (M1): o turno que **terminou** é `prior` (combatente `prior.combatantId`); o que começou é `current`.
- `CombatHistoryData` ≈ `{ round, turn, tokenId, combatantId }` (mesma forma de `combat.current`/`combat.previous`) — confirmar campos na implementação.
- Como dispara em todos os clientes, guardar com o padrão de GM ativo para executar uma única vez:
  `if ( game.users.activeGM !== game.user ) return;` (ou `game.users.activeGM?.isSelf`).

## `combatTurn` / `combatRound` — pré-update, cliente iniciador

```
combatTurn(combat: Combat, updateData: { round, turn }, updateOptions: { direction, worldTime.delta }): void
```

- Disparam **apenas no cliente que iniciou** a mudança, **antes** do update. Úteis para vetar/ajustar a transição, não para efeitos pós-turno (o GM pode não ser o iniciador — ex.: jogador terminando o próprio turno pelo Combat Carousel).

## Como o dnd5e se pendura no ciclo

O sistema **não** usa esses hooks: sobrescreve métodos do documento `Combat5e` (`_onStartTurn`, `_onEndTurn`, `_onStartRound`, `startCombat`, `rollInitiative`) para disparar a recuperação de usos (ver pesquisa dnd5e). Módulos não têm esse luxo — ficamos com `combatTurnChange` + guarda de GM ativo.

## Implicações para o Boss Forge

- Prompt de ação lendária (M1): `combatTurnChange` → se `prior.combatantId` ≠ boss e boss elegível → dialog no cliente do GM ativo.
- Ordem relativa ao reset nativo: o reset de `legact` do dnd5e ocorre via `_onEndTurn` (turnEnd do próprio boss), no fluxo de update do documento; nosso prompt reage ao fim de turno de **outras** criaturas, então não há corrida entre os dois.
- Iniciativa 20 (M3 modo 2014): monitorar `combatTurnChange`/`combatRound` e comparar iniciativas cruzadas — design a detalhar no M3.
