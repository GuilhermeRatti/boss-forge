# Design M2 — Resistência Lendária (rascunho para revisão)

> **Status: aguardando revisão do usuário.** Escrito em 2026-07-04 com base em `docs/research/2026-07-03-m2-midi-qol-v13.md` e `docs/research/2026-07-04-m2-midi-qol-13.0.63-instalado.md` (fatos confirmados no bundle instalado). A implementação só começa após a revisão deste documento.

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
- **Setting de módulo**: `boss-forge.legresPrompt` (world, boolean, default true).
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

## 9. Questões abertas (para o usuário decidir na revisão)

1. **Mensagem de queima no chat: pública ou só GM?** Proposta: **pública** — "o dragão ignora o efeito" é informação clássica de mesa (a regra 2024 nem esconde o custo), e dá peso dramático. Alternativa: whisper para o GM.
2. **Timeout de 60 s com default "não queimar"** está bom? (Segurar o cast do jogador indefinidamente não parece aceitável; alternativa: sem timeout, confiando no GM presente.)
3. **Auto-burn** (queimar sozinho enquanto `legres > 0`, sem dialog — house rule comum): fica FORA do MVP como proposto, ou você quer já um toggle por boss? Proposta: fora (decisão do GM é soberana, consistente com o M1); fácil de adicionar depois.
4. **FX de queima por flag no ator** (mesmo preset `impact` serve — um shimmer/escudo quando sair catálogo no M5): ok como opcional silencioso?
