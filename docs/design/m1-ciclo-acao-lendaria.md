# Design M1 — Ciclo de ação lendária (rascunho para revisão)

> **Status: aguardando revisão do usuário.** Escrito em 2026-07-03 com base na pesquisa em `docs/research/2026-07-03-*`. A implementação só começa após o aceite do M0 e a revisão deste documento. Referência dnd5e: 5.3.3 (**confirmada pelo diagnóstico de 2026-07-04** — ver `docs/environment.md`).

## 1. Escopo

Critério de aceite do briefing: ao fim do turno de cada criatura ≠ boss, dialog GM lista as ações lendárias com custo/usos restantes; botão consome o recurso nativo (`legact`) via activity e dispara o preset de FX associado; reset no turno do boss. Roteiro com 1 boss + 2 PCs fecha o ciclo, contadores corretos na ficha, FX tocando.

**Fora do escopo do M1**: Boss Designer (app), resistência lendária (M2), covil (M3), fases (M4), catálogo de FX (M5), qualquer coisa player-facing.

## 2. Fatos nativos que moldam o design

Da pesquisa (ver `docs/research/`):

1. **Reset é nativo.** dnd5e zera `legact.spent` em `startCombat` (`encounter`) e no fim do turno do próprio boss (`turnEnd`). O Boss Forge **não reseta nada** — apenas confia no sistema. (Equivalente à regra "recupera no início do seu turno": nenhuma ação lendária ocorre durante o turno do boss.)
2. **Consumo é nativo.** Activity com `activation.type = "legendary"` e `activation.value = custo` debita `resources.legact` sozinha via `activity.use()`, com mensagem de uso e integração com o workflow do Midi (ataque/save/dano automatizados pelo stack existente).
3. **`legact.value` é derivado** (`max - spent`) — leitura de usos restantes vem de `system.resources.legact.value`; escrita (se algum dia necessária) vai em `spent`.
4. **Gancho de turno**: `combatTurnChange(combat, prior, current)` dispara em todos os clientes após o update; executar apenas no GM ativo (`game.users.activeGM === game.user`).

## 3. Modelo de dados (mínimo do M1)

Sem Designer ainda; tudo derivado do ator + uma flag opcional:

- **Boss elegível** = NPC no combate com `system.resources.legact.max > 0` **e** ≥ 1 activity com `activation.type === "legendary"` em seus itens.
- **Opt-out por ator**: `flags.boss-forge.legendary.promptDisabled = true` (togglável pelo dialog, "não perguntar mais para este boss").
- **FX por item (opcional)**: `flags.boss-forge.fx = { preset: string, options: object }` no item da ação lendária. Sem flag → sem FX (nada quebra). No M1 o GM seta a flag via macro/API; UI de edição vem com o Designer.
- **Setting de módulo**: `boss-forge.legendaryPrompt` (world, boolean, default true) — liga/desliga o prompt globalmente.

## 4. Fluxo runtime

```
combatTurnChange (todos os clientes)
└─ é o GM ativo? senão, return
└─ setting legendaryPrompt ativo? senão, return
└─ combatente que TERMINOU o turno = prior.combatantId
└─ para cada boss elegível no combate:
   ├─ é o próprio combatente que terminou o turno? pula (regra: não usa no próprio turno)
   ├─ derrotado/HP 0/promptDisabled? pula
   ├─ legact.value === 0? pula
   └─ abre dialog (DialogV2) com as ações lendárias
       ├─ [ação X (custo 2)] → activity.use() nativa → FX (se flag) 
       ├─ [Pular]            → fecha
       └─ [Não perguntar mais p/ este boss] → seta flag promptDisabled
```

- **Múltiplos bosses**: dialogs sequenciais (um por boss). Cenário raro; agregação em um painel único fica para depois, se incomodar.
- **Fechar o dialog = pular.** Sem re-prompt no mesmo turno.
- Ações com custo > usos restantes aparecem desabilitadas (título mostra `restantes/max`).
- Após `activity.use()`, o dialog reabre atualizado se ainda houver usos (> 0) — permite gastar 2×1 no mesmo gatilho (regra permite 1 ação por gatilho por RAW estrita; **decisão**: permitir múltiplas, o GM é o juiz — é ferramenta de mestre, não árbitro).
- FX dispara **depois** do `use()` resolver (não bloqueia a mecânica se o asset faltar; `entryExists` valida antes de tocar).

## 5. UX do dialog (GM)

`foundry.applications.api.DialogV2`, título com nome do boss + contador (`Ações lendárias: 2/3`), uma linha por activity: ícone do item, nome, custo, botão "Usar". Rodapé: "Pular" e "Não perguntar mais". Strings todas em `BOSSFORGE.Legendary.*` (en + pt-BR).

## 6. FX mínimo do M1

Um único preset genérico `impact`: `new Sequence().effect().file(<dbPath da flag>).atLocation(<token alvo ou boss>).play()`, implementado no núcleo `scripts/fx/` (pasta system-agnostic, zero imports dnd5e). Parâmetros: `{ file, at: "boss"|"targets", scale?, delay? }`. Telegraphs/compostos ficam no M5.

## 7. Casos de borda mapeados

- Combate sem boss elegível → zero overhead (early return).
- Boss fora do combate (token não adicionado) → não participa.
- Turno "voltado" (GM retrocede o tracker): `combatTurnChange` dispara igual; prompt de novo é aceitável (GM decide).
- dnd5e pode mostrar seu próprio aviso de ações disponíveis no card de turno (`ActivationsField.getActivations` no `createTurnMessage`) — o dialog do Boss Forge coexiste; avaliar no teste se vira redundância irritante.
- Cliente do GM recarregado no meio do combate → sem estado persistente necessário (tudo derivado do combate atual).

## 8. Roteiro de teste (esboço; será numerado na entrega)

1 boss (com 3 ações lendárias de custos 1/1/2 e `legact.max = 3`) + 2 PCs em combate. Verificar: prompt ao fim de cada turno de PC; consumo correto na ficha (contador da ficha do NPC e barra de recursos); ações desabilitadas quando custo > restante; reset automático ao fim do turno do boss; FX tocando na ação com flag; opt-out funcionando; console limpo.

## 9. Questões abertas (para o usuário decidir na revisão)

1. **Elegibilidade automática** (todo NPC com legact + activity legendary no combate) com opt-out por flag está ok, ou prefere opt-in explícito (só atores marcados como boss)? Proposta atual: automático + opt-out.
2. **Múltiplos usos por gatilho** (seção 4): manter permitido (GM como juiz) ou travar em 1 ação por prompt (RAW)?
3. **FX no M1**: um preset `impact` simples basta para validar o pipeline, ou você quer já um telegraph (aviso → delay → impacto) nessa primeira entrega?
