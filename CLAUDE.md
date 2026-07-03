# Boss Forge — contexto do projeto

Módulo de Foundry VTT para D&D 5e voltado ao **Mestre**: camada de autoria e orquestração de boss fights homebrew (ações lendárias, resistência lendária, covil, fases por HP, presets de FX "boss-grade" sobre o Sequencer). **Não** substitui Midi-QOL/DAE nem editores de animação (BLFX) — orquestra o que falta.

Comunicação com o usuário: **PT-BR**, técnica e direta, honestidade sobre incertezas. Código, commits e strings-fonte em inglês.

## Estado atual

- **M0 entregue, aguardando aceite do usuário.** Não abrir M1 sem aceite explícito.
- Pendências bloqueantes leves: saída da macro de diagnóstico (→ commitar em `docs/environment.md`, pinar versões no README); URL do repositório GitHub.
- **Adiantado sem quebrar o gate**: pesquisa §9 do M1/M2 concluída (`docs/research/2026-07-03-m1-dnd5e-5.3.3.md`, `…-foundry-v13-combat-hooks.md`, `…-m2-midi-qol-v13.md`, `…-sequencer-effects.md`; referência dnd5e 5.3.3 provisória — re-verificar na tag do diagnóstico) e design do M1 em `docs/design/m1-ciclo-acao-lendaria.md` aguardando revisão. Fatos-chave: reset de legact e consumo via activity (activation.type "legendary") são NATIVOS do dnd5e; covil 2024 = toggle nativo `lair.inside`; dnd5e tem `resistSave()` nativo p/ M2; gancho do orquestrador = `combatTurnChange` + guarda de GM ativo.
- Setup de máquinas: código editado **nesta máquina Linux**; o Foundry roda em **outra máquina, Windows 11**. A ponte é git: clone do repo direto em `Data\modules\boss-forge` no Windows, atualização por `git pull` + `npm run packs:build` (mundo fechado) — ver DEVELOPMENT.md §2. Não há Foundry local para testar.

## Ambiente-alvo (fatos pinados)

- **Foundry VTT v13** — não migrar para v14 até o ecossistema Midi estabilizar; código forward-compatible.
- **dnd5e "moderno"** (regras 2024, errata set/2024). Versão exata: pendente (diagnóstico).
- Módulos da mesa: Midi-QOL, DAE, Combat Carousel, BLFX Premium, JB2A Patreon, Sequencer.
- **Automated Animations está FORA do stack 5e por decisão** (conflito de nicho com BLFX). Boss Forge fala com o Sequencer diretamente. AA é de OUTRO projeto do usuário (Tormenta 20) — não misturar.
- Assets registrados no database do Sequencer com prefixos `jb2a.*` e `blfx.*` (exatos a confirmar no diagnóstico).

## Arquitetura (decidida)

1. **Boss Designer** (`ApplicationV2`, GM-side): declara o boss uma vez (fases por HP, pool de ações lendárias, resistência lendária, covil, mecânicas custom); **gera** itens/activities/efeitos/flags no ator de forma idempotente.
2. **Runtime Orchestrator**: hooks de combate + workflow do Midi. Prompt de ações lendárias ao fim do turno de criatura ≠ boss; interceptação de save falho (queimar resistência lendária); covil; transição de fase.
3. **FX Preset Engine** — núcleo **system-agnostic** em pasta própria, **zero imports** do código dnd5e (será reaproveitado no futuro módulo de Tormenta 20). Telegraphs, slams, breath, círculo de invocação, enrage, cutscene de fase.
4. **API de macros**: tudo exposto em `game.modules.get("boss-forge").api`.

Covil em dois paradigmas: clássico 2014 (iniciativa 20) e 2024 (usos extras de ação lendária com toggle "em covil").

## Milestones (ordem estrita — não abrir M(n+1) sem aceite de M(n))

- **M0 — Fundação** ✅ entregue: repo, `module.json`, ESM sem build, i18n en/pt-BR, logger + setting de debug, macro de diagnóstico em compêndio, Action de release, `DEVELOPMENT.md`.
- **M1 — Ciclo de ação lendária**: dialog GM ao fim de turno ≠ boss; consumo de `legact` via activity nativa + FX; reset no turno do boss.
- **M2 — Resistência lendária**: save falho → dialog → sucesso forçado + decremento de `legres`, dentro do workflow do Midi.
- **M3 — Covil**: prompt iniciativa 20 (2014) e bônus de usos com toggle (2024).
- **M4 — Fases**: thresholds de HP → cutscene + troca opcional de ações/auras.
- **M5 — Biblioteca de presets**: catálogo navegável com parâmetros e preview.

Não-objetivos: reimplementar automação coberta por Midi/CPR/BLFX; nada player-facing no MVP (socketlib só se comprovadamente necessário); não depender de AA; não suportar dnd5e legacy/2014 (exceto modo de covil clássico).

## Regra de ouro — verificar antes de assumir

**Nenhuma integração é escrita de memória.** Antes de cada milestone, ler a fonte na versão pinada e registrar em `docs/research/*.md`:

- **dnd5e**: clonar `github.com/foundryvtt/dnd5e` no tag da versão do usuário; confirmar schema de `system.resources.legact/legres/lair`, modelo de activities, hooks `dnd5e.*`.
- **Midi-QOL**: `gitlab.com/tposney/midi-qol` — nomes/assinaturas reais dos hooks de workflow. Nomes de memória são presumidos errados até prova em contrário.
- **Sequencer**: wiki oficial (fantasycomputer.works) + código no GitHub (`fantasycalendar/FoundryVTT-Sequencer`).
- **Foundry v13**: docs oficiais; conferir deprecations.

Verificações já feitas: `docs/research/`.

## Convenções técnicas

- APIs namespaced (`foundry.applications.api.ApplicationV2`, `foundry.utils.*`); **proibido** API deprecated na v13 — console limpo é critério permanente de aceite.
- Flags sob namespace `boss-forge`; design do boss em flags do Actor; itens gerados levam flag de origem para regeneração idempotente.
- JavaScript ESM puro, sem bundler (introduzir só com justificativa). Packs têm source JSON em `packs/_source/` compilado com `npm run packs:build` (isso não é build de código).
- libWrapper apenas se um patch for inevitável; preferir hooks.
- Conventional commits, commits pequenos, `CHANGELOG.md` mantido (Keep a Changelog). Licença MIT.
- Todas as strings de UI em `lang/en.json` e `lang/pt-BR.json` (prefixo `BOSSFORGE.`).

## Workflow com o usuário

- O agente **não tem Foundry**; o usuário executa os testes. Toda entrega inclui: (a) roteiro de teste numerado, (b) logging debug atrás do setting `boss-forge.debug`, (c) macro de diagnóstico atualizada se necessário.
- Em bug: pedir **UMA colagem** (diagnóstico + stack trace do console), não pingue-pongue de perguntas.
- Usuário: mestre 5e (regras 2024), engenheiro em formação, confortável com F12 e git básico; hoje faz tudo com macros à mão.

## Comandos

- `npm install` (uma vez) e `npm run packs:build` — compila `packs/_source/*` → LevelDB em `packs/`.
- `npm run packs:extract` — traz edições feitas no Foundry de volta ao source.
- Release: push de tag `vX.Y.Z` → GitHub Action gera zip + manifest (versão/URLs carimbados a partir do tag e do repo; ver `.github/workflows/release.yml`).
