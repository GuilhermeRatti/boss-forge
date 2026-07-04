# Design M3 — Covil

> **Status: decisões delegadas ao agente pelo usuário** ("vou deixar em seu encargo decidir a melhor forma; testaremos a sua decisão e dou um feedback") **e validação via teste**, no estilo de iteração combinado: automação ampla primeiro, poda por feedback. Escrito e implementado em 2026-07-04 com base em `docs/research/2026-07-04-m3-lair-fontes-instaladas.md` (+ pesquisa M1).

## 1. Escopo

Dois paradigmas de covil, inferidos **dos dados do ator** (sem depender do setting de regras do sistema):

- **2024** (`lair.value === true`): decidir se a luta acontece no covil e togglar `lair.inside` — o **+1 em legact.max/legres.max é nativo** do dnd5e; o Boss Forge não recalcula nada.
- **2014 clássico** (`lair.initiative` numérico, tipicamente 20): na contagem de iniciativa configurada, a cada round, o GM recebe o prompt com as **ações de covil** do boss (activities com `activation.type === "lair"`).

Fora do escopo: efeitos regionais, mapas/ambientação, fases (M4), catálogo de FX (M5).

## 2. Fatos verificados que moldam o design

1. dnd5e 5.3.3 **não tem integração de combate** para covil (pesquisa M3) — tracker/iniciativa 20/toggle são nossos.
2. `lair.inside` + `lair.value` ⇒ ajuste nativo (+1s e CR) em `prepareDerivedData` — togglar é suficiente.
3. Tipo de ativação `lair` existe nativamente para activities (sem consumo de recurso).
4. `combatStart` dispara no cliente do GM iniciador (pré-update); `combatTurnChange` em todos (pós-update, guarda de GM ativo); `createCombatant`/`deleteCombat` padrão.

## 3. Automações entregues (decisões do agente, a validar em teste)

### Modo 2024 — "dentro do covil"

- **Cena marcável como covil**: `api.lair.markScene(actor, scene?)` grava `flags.boss-forge.lairOf` (UUID do ator base) na cena. Quando o combate começa (ou o boss entra num combate em andamento) **na cena marcada**, `lair.inside` liga sozinho — sem pergunta — com aviso ao GM no chat. `clearScene()` desfaz.
- **Cena não marcada**: dialog ao GM no início do combate — "*a luta é no covil de X?*" [Sim / Não / Não perguntar mais para este boss].
- **Reversão automática**: toggles ligados pelo módulo (flag `lair.insideAuto`) desligam quando o combate é deletado — o ator não fica "preso no covil" para a próxima luta. Toggle manual do GM (ficha/API sem `auto`) nunca é revertido pelo módulo.
- **FX opcional de ativação**: `api.lair.setActorLairFx(actor, preset, options)` (flag no ator, ambos os lados) toca no token quando o modo covil liga.

### Modo 2014 — iniciativa 20

- Gatilho em `combatTurnChange`: dispara quando o tracker **cruza a contagem** `lair.initiative` (perdendo empates, RAW): mesma rodada = `iniciativa(anterior) ≥ N > iniciativa(atual)`; virada/início de round cobre os casos todos-acima/todos-abaixo. Guarda de 1 disparo por boss por round (memória em runtime; GM voltar o tracker re-permite — GM soberano).
- Prompt (dialog, padrão M1): lista as ações de covil com botão Usar (via `activity.use()` nativa — card, template, Midi de graça), badge "usada ×N" no round, Pular, "Não perguntar mais". Sem custo de recurso (RAW não consome); múltiplos usos permitidos com badge (RAW = 1/round; GM decide — precedente do M1).
- **FX por item**: mesma flag `flags.boss-forge.fx` do M1 (`api.legendary.setItemFx`) — toca após o uso.

### Comum

- Setting mundial **`lairPrompt`** (default on) liga/desliga tudo do covil.
- Avisos do módulo em **whisper ao GM** (ativação/desativação de covil); os cards das ações de covil seguem a visibilidade normal do dnd5e/Midi.
- API: `api.lair.setInside(actor, bool)`, `markScene/clearScene`, `setPromptEnabled(actor, bool)` (opt-out), `setActorLairFx/clearActorLairFx`.

## 4. Racional das superfícies de UI (decisão delegada)

Dialogs para as duas interações: a pergunta "é no covil?" é decisão una de setup (momento parado, resposta binária + opt-out) e o menu de ações de covil é uma lista de escolhas — ambos o formato em que o dialog do M1 já provou funcionar. A automação por cena marcada existe justamente para o caso frequente da mesa (covil preparado com antecedência) nem precisar do dialog.

## 5. Casos de borda mapeados

- Boss derrotado/HP 0 → sem prompt de lair action (2014); toggle 2024 não é revertido no meio do combate (morto no covil continua no covil — irrelevante mecanicamente).
- Vários bosses com covil → prompts sequenciais (precedente M1).
- `lair.initiative` ≠ 20 (GM custom) → respeitado; o gatilho usa o valor do ator.
- Combate sem `startCombat` formal (GM avança turno direto) → o fluxo 2024 também cobre via `createCombatant` só para combates iniciados; sem `combatStart`, o dialog 2024 não aparece — `api.lair.setInside` cobre; avaliar no feedback.
- Cena com covil de boss A, combate com boss B → B segue o fluxo de dialog normal (marca é por ator).
- Ator de token não-vinculado → flags e FX aplicados nos dois lados (`actorSides`, lição do M1); o toggle `inside` vai no ator do combate.

## 6. Roteiro de teste

Numerado na entrega (mensagem do agente).

## 7. Pós-teste

Feedback do usuário decide podas/ajustes, registrados aqui como nas M1/M2.
