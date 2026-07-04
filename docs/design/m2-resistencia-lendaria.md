# Design M2 — Resistência Lendária

> **Status: APROVADO pelo usuário em 2026-07-04** ("a parte técnica me parece irretocável"); decisões da revisão registradas na §9. Escrito em 2026-07-04 com base em `docs/research/2026-07-03-m2-midi-qol-v13.md` e `docs/research/2026-07-04-m2-midi-qol-13.0.63-instalado.md` (fatos confirmados no bundle instalado).

## 1. Escopo

Critério de aceite do briefing: quando um boss com resistência lendária **falha um save** dentro de um workflow do Midi, o GM recebe um dialog "queimar resistência lendária?"; ao confirmar, o save vira sucesso **antes da aplicação de dano/efeitos**, `legres` é decrementado na ficha e a mesa fica sabendo. Roteiro com PC castando magia de save contra o boss fecha o ciclo.

**Fora do escopo do M2**: covil (M3), fases (M4), UI bonita (barra de qualidade registrada — chega com o Designer), auto-burn sem dialog (ver §9), interações fora do workflow do Midi (save "solto" rolado da ficha sem item — cobre-se com o botão nativo do dnd5e, que continua existindo).

## 2. Fatos verificados que moldam o design

1. **Midi não trata legres** (zero menções no 13.0.63) — pista livre, sem dupla automação.
2. **Hooks de transição são aguardados e canceláveis** — `midi-qol.preSavesComplete` recebe o workflow com `saves`/`failedSaves` (Sets de tokens) já computados e ainda **antes** do dano ⇒ é O ponto de interceptação.
3. **O workflow roda no cliente de quem usou o item** — no caso típico (player ataca boss), o hook dispara no cliente do player. Dialog é GM-only ⇒ **socketlib** (já ativo, dependência do Midi) para: perguntar ao GM e aguardar; e executar o update de `legres.spent` com permissão de GM. Uso de socketlib fica **comprovadamente necessário** (condição do CLAUDE.md satisfeita).
4. **`resistSave(message)` nativo não serve no pipeline Midi** (message-cêntrico; merge cards; não atualiza `failedSaves`) — o M2 replica o efeito mecânico dele (increment de `legres.spent` + save tratado como sucesso), mas dentro do workflow.
5. `legres.value` é derivado (`max - spent`); escrita vai em `spent` (pesquisa dnd5e M1, mesma regra do legact).

## 3. Modelo de dados (mínimo do M2)

- **Boss elegível** = NPC alvo do workflow com `system.resources.legres.max > 0` e `legres.value > 0`, presente em `workflow.failedSaves`.
- **Opt-out por ator**: `flags.boss-forge.legendary.resistPromptDisabled = true` (simétrico ao M1; togglável no dialog e via API). Vale no ator do combate (sintético em token não-vinculado) — helpers cobrem os dois lados, lição do M1.
- **FX opcional na queima**: `flags.boss-forge.legresFx = { preset, options }` no **ator** (não em item — a queima não tem item), tocado no token do boss após confirmar. Sem flag → sem FX.
- **Settings de módulo** (world): `legresPrompt` (boolean, default true — liga/desliga o recurso), `legresAutoBurn` (boolean, default false — queima sem dialog enquanto houver usos; decisão da revisão), `legresChatVisibility` (choices `public`/`gm`, default `public` — visibilidade da mensagem de queima; decisão da revisão), `legresTimeout` (number 10–300 s, default 60 — pedido pós-teste). Registro de settings passa a ser **declarativo** (tabela → loop, i18n derivada da chave) para organizar o crescimento previsto de configurações sem retrabalho.
- **Timeout do dialog**: constante (60 s) com default "não queimar" — segurar o workflow trava o cast do jogador; o GM ausente não pode congelar a mesa.

## 4. Fluxo runtime

```
midi-qol.preSavesComplete (cliente do workflow, aguardado)
└─ setting ligado? senão, return true
└─ candidatos = failedSaves ∩ bosses elegíveis (legres.value > 0, sem opt-out)
└─ nenhum? return true
└─ para cada candidato (sequencial):
   ├─ [cliente do workflow == GM ativo?]
   │    sim → abre o dialog localmente
   │    não → socketlib.executeAsGM("promptLegres", dados) e AGUARDA
   ├─ dialog GM: "Boss falhou (save de DES, CD 15, total 9). Queimar resistência lendária? (2/3 restantes)"
   │    [Queimar] / [Não queimar] / [Não perguntar mais p/ este boss] / timeout 60s → não queimar
   └─ se queimar (executado como GM):
       ├─ update system.resources.legres.spent += 1
       ├─ mensagem no chat (pública; ver §9): "X queima uma Resistência Lendária e transforma a falha em sucesso (2 restantes)."
       ├─ FX do ator (se flag), no token do boss
       └─ resposta ao cliente do workflow → move token: failedSaves → saves
└─ return true (workflow segue; dano/efeitos respeitam os Sets atualizados)
```

- **Vários bosses falhando o mesmo save** (raro): dialogs sequenciais, um por boss — mesmo padrão do M1.
- **GM caster** (boss usa item contra outro boss?): mesmo fluxo, sem socket (o cliente do workflow É o GM).
- **Sem Midi no meio** (save rolado direto da ficha): fora do escopo — o botão nativo do dnd5e no card continua funcionando para esse caso.

## 5. UX do dialog (GM)

`DialogV2` (mesmo estilo interino do M1, classe CSS própria): título `"{boss} — Resistência Lendária ({restantes}/{max})"`; corpo com o contexto do save (habilidade, CD, total rolado, item/magia de origem, quem castou); botões **Queimar** (default), **Não queimar**, **Não perguntar mais para este boss**. Strings `BOSSFORGE.LegRes.*` (en + pt-BR). Barra de timeout simples (texto com contagem, sem animação — polimento vem depois).

## 6. API

- `api.legendary.setResistPromptEnabled(actor, enabled)` — simétrico ao `setPromptEnabled` do M1 (cobre mundo + tokens da cena).
- `api.legendary.setActorLegresFx(actor, preset, options)` / `clearActorLegresFx(actor)`.
- Interno via socketlib: `promptLegres` (GM-side), registrado no `init`.

## 7. Casos de borda mapeados

- `legres.value === 0` ao chegar a vez do boss (queimou tudo em decisão anterior do mesmo save) → pula sem dialog.
- GM desconectado / sem GM ativo → timeout aplica "não queimar"; log debug.
- Workflow abortado enquanto o dialog está aberto → resposta descartada com segurança (guard por `workflow.id`).
- Boss derrotado no meio do fluxo → ainda pergunta (HP não importa para legres; save pode ser de efeito persistente).
- Save com sucesso já (não está em `failedSaves`) → nunca pergunta.
- Exibição do merge card do Midi pós-força (`saveDisplayData` já renderizado): risco mapeado na pesquisa — resolver na implementação (re-render/anotação no card); a mensagem pública de queima já garante clareza mínima na mesa mesmo se o card ficar defasado.

## 8. Roteiro de teste (esboço; numerado na entrega)

Boss com `legres 3` + PC com magia de save (ex.: *Fireball* ou *Toll the Dead*). Player-cliente castando (2 clientes: GM + player, ou 2 abas) e GM-cliente castando. Verificar: dialog só no GM; queimar → save vira sucesso (sem dano/meio dano conforme a magia), `legres` decrementa na ficha, mensagem no chat, FX (se flag); não queimar → dano normal; opt-out; timeout; setting global; console limpo.

## 9. Questões abertas — decididas pelo usuário na revisão (2026-07-04)

1. **Mensagem de queima: pública por padrão, com setting para restringir ao GM** (`legresChatVisibility`). Recado incorporado: as configurações vão se multiplicar — registro declarativo desde já para minimizar retrabalho.
2. **Timeout de 60 s com default "não queimar"**: confirmado.
3. **Auto-burn: fora por padrão, disponível como toggle na config** (`legresAutoBurn`, world, default false).
4. **FX de queima via flag no ator**: confirmado como opcional silencioso ("fácil de abandonar depois").

## 10. Ajustes pós-teste (2026-07-04) e aceite

O teste do usuário revelou que a mesa rola saves de monstro **fora do workflow** (privados, direto da ficha/card) — caminho em que o M2 original era inerte de propósito e onde o **botão nativo do dnd5e no card** ("Used Legendary Resistance") cobre a queima manual com fricção baixa (preferido pelo usuário ao dialog). Ajustes incorporados:

1. **Anúncio desacoplado da visibilidade do save**: ouvinte de `updateChatMessage` detecta `flags.dnd5e.roll.forceSuccess = true` (botão nativo ou auto-burn) e publica a mensagem de queima conforme `legresChatVisibility`, mesmo com o save privado. O caminho workflow segue anunciando direto (sem `forceSuccess` ⇒ sem duplicidade).
2. **Auto-burn cobre o caminho nativo**: `createChatMessage` de card de save do dnd5e **com CD explícita em todos os rolls** e falha ⇒ `actor.system.resistSave(message)` (GM ativo; ignora cards com `flags["midi-qol"]`, que pertencem ao workflow — sem queima dupla). Sem CD não há queima automática (falha indeterminável).
3. **Timeout configurável**: `legresTimeout` (10–300 s, default 60).

**M2 ACEITO em 2026-07-04** — nas palavras do usuário, "podemos riscar o M2 do roadmap": o conjunto dialog-no-workflow + botão nativo no card atende a mesa sem fricção relevante.
