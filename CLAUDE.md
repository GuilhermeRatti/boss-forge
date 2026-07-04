# Boss Forge — contexto do projeto

Módulo de Foundry VTT para D&D 5e voltado ao **Mestre**: camada de autoria e orquestração de boss fights homebrew (ações lendárias, resistência lendária, covil, fases por HP, presets de FX "boss-grade" sobre o Sequencer). **Não** substitui Midi-QOL/DAE nem editores de animação (BLFX) — orquestra o que falta.

Comunicação com o usuário: **PT-BR**, técnica e direta, honestidade sobre incertezas. Código, commits e strings-fonte em inglês.

## Estado atual

- **M0 ACEITO em 2026-07-04** — diagnóstico ok e console limpo confirmados pelo usuário.
- **Design do M1 APROVADO pelo usuário em 2026-07-04** (decisões na §9 do doc: elegibilidade automática + opt-out; múltiplos usos por gatilho com badge visual de "já usada"; FX = só preset `impact`).
- **M1 ACEITO formalmente em 2026-07-04** (roteiro completo passando, console limpo verificado em log; commits `0c1e7a7` + fixes `111d5dc`/`a9dc6e2`). Aprendizado incorporado: tokens não-vinculados têm ator sintético — flags de opt-out vivem lá; `setPromptEnabled` cobre os dois lados. Teste local: módulo em `Data\modules\boss-forge` é junction para o repo (mundo mostra versão 0.0.0).
- **M2 ACEITO em 2026-07-04**, com escopo final reduzido em teste: **o botão nativo do dnd5e no card é a UI de queima**; Boss Forge só adiciona anúncio no chat (visibilidade configurável, **sem revelar usos restantes**) + FX opcional por ator, via `forceSuccess`. Dialog de workflow, relay socketlib, opt-out, auto-burn e timeout: implementados e **removidos** por decisão do usuário (histórico no git; socketlib volta só se comprovadamente necessário). Aprendizados: automação mínima e GM no controle; a superfície de UI é POR CASO (card serviu ao legres; dialog segue certo para ações lendárias; covil = decisão delegada ao agente com feedback pós-teste); settings declarativas (`SETTINGS_SCHEMA`).
- Diagnóstico M0 executado em **2026-07-04** e registrado em `docs/environment.md` (versões pinadas lá e no README). **JB2A Patreon 0.9.1 instalado manualmente em 2026-07-04** (o instalador do app falha na extração — causa e contorno em `docs/environment.md`); diagnóstico pós-instalação confirma prefixos `blfx` + `jb2a` no Sequencer. Combat Carousel ausente (cosmético, sem impacto).
- Repo GitHub: `https://github.com/GuilhermeRatti/boss-forge` (criado e com main publicada pelo próprio usuário; no Windows o clone vai na pasta `boss-forge` — id do módulo).
- **Adiantado sem quebrar o gate**: pesquisa §9 do M1/M2 concluída (`docs/research/2026-07-03-m1-dnd5e-5.3.3.md`, `…-foundry-v13-combat-hooks.md`, `…-m2-midi-qol-v13.md`, `…-sequencer-effects.md`; referência dnd5e 5.3.3 **confirmada pelo diagnóstico**) e design do M1 em `docs/design/m1-ciclo-acao-lendaria.md` (aprovado em 2026-07-04). Fatos-chave: reset de legact e consumo via activity (activation.type "legendary") são NATIVOS do dnd5e; covil 2024 = toggle nativo `lair.inside`; dnd5e tem `resistSave()` nativo p/ M2; gancho do orquestrador = `combatTurnChange` + guarda de GM ativo.
- Setup de máquinas (**atualizado 2026-07-04**): código e Foundry agora na **mesma máquina Windows 11** — repo em `C:\Users\guira\OneDrive\Documentos\GitHub\boss-forge`, Foundry em `%LOCALAPPDATA%\FoundryVTT`. O módulo ativo no Foundry veio de **instalação via manifest da release v0.0.1** (pipeline de release validado de ponta a ponta), não de clone git; para testar código não-released, usar a junction do DEVELOPMENT.md §2.4. Setup antigo (código no Linux) segue documentado como alternativa.

## Ambiente-alvo (fatos pinados)

- **Foundry VTT v13, build 13.351** (diagnóstico 2026-07-04) — não migrar para v14 até o ecossistema Midi estabilizar; código forward-compatible.
- **dnd5e 5.3.3** "moderno" (regras 2024, errata set/2024) — pinado pelo diagnóstico; igual à tag da pesquisa M1.
- Módulos ativos da mesa (versões completas em `docs/environment.md`): Midi-QOL 13.0.63, DAE 13.0.29, Sequencer 4.2.2, BLFX (blfx-assets-pack01 + boss-loot-assets-premium), **JB2A Patreon 0.9.1**, libWrapper, socketlib. Combat Carousel não está instalado (cosmético).
- **Automated Animations está FORA do stack 5e por decisão** (conflito de nicho com BLFX; presente no disco, inativo no mundo dnd5e). Boss Forge fala com o Sequencer diretamente. AA é de OUTRO projeto do usuário (Tormenta 20) — não misturar.
- Database do Sequencer: prefixos **`blfx` e `jb2a`** (diagnóstico pós-JB2A). Presets continuam validando todo path com `Sequencer.Database.entryExists()` — nenhum asset é assumido como garantido.

## Arquitetura (decidida)

1. **Boss Designer** (`ApplicationV2`, GM-side): declara o boss uma vez (fases por HP, pool de ações lendárias, resistência lendária, covil, mecânicas custom); **gera** itens/activities/efeitos/flags no ator de forma idempotente.
2. **Runtime Orchestrator**: hooks de combate + workflow do Midi. Prompt de ações lendárias ao fim do turno de criatura ≠ boss; interceptação de save falho (queimar resistência lendária); covil; transição de fase.
3. **FX Preset Engine** — núcleo **system-agnostic** em pasta própria, **zero imports** do código dnd5e (será reaproveitado no futuro módulo de Tormenta 20). Telegraphs, slams, breath, círculo de invocação, enrage, cutscene de fase.
4. **API de macros**: tudo exposto em `game.modules.get("boss-forge").api`.

Covil em dois paradigmas: clássico 2014 (iniciativa 20) e 2024 (usos extras de ação lendária com toggle "em covil").

## Milestones (ordem estrita — não abrir M(n+1) sem aceite de M(n))

- **M0 — Fundação** ✅ aceito (2026-07-04): repo, `module.json`, ESM sem build, i18n en/pt-BR, logger + setting de debug, macro de diagnóstico em compêndio, Action de release, `DEVELOPMENT.md`.
- **M1 — Ciclo de ação lendária** ✅ aceito (2026-07-04): dialog GM ao fim de turno ≠ boss; consumo de `legact` via activity nativa + FX; reset no turno do boss.
- **M2 — Resistência lendária** ✅ aceito (2026-07-04): queima pelo botão nativo do dnd5e no card; Boss Forge anuncia no chat (visibilidade configurável, sem contagem de usos) e toca FX opcional do ator.
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
- Atalho do setup atual: a build **instalada** (a que de fato roda) está legível em `%LOCALAPPDATA%\FoundryVTT\Data\systems\dnd5e` e `…\Data\modules\{midi-qol,sequencer,dae}` — bundles compilados com sourcemaps; usar como tira-teima da versão exata (o repo no tag continua melhor para navegar).

Verificações já feitas: `docs/research/`.

## Convenções técnicas

- APIs namespaced (`foundry.applications.api.ApplicationV2`, `foundry.utils.*`); **proibido** API deprecated na v13 — console limpo é critério permanente de aceite.
- Flags sob namespace `boss-forge`; design do boss em flags do Actor; itens gerados levam flag de origem para regeneração idempotente.
- JavaScript ESM puro, sem bundler (introduzir só com justificativa). Packs têm source JSON em `packs/_source/` compilado com `npm run packs:build` (isso não é build de código).
- libWrapper apenas se um patch for inevitável; preferir hooks.
- Conventional commits, commits pequenos, `CHANGELOG.md` mantido (Keep a Changelog). Licença MIT.
- Todas as strings de UI em `lang/en.json` e `lang/pt-BR.json` (prefixo `BOSSFORGE.`).

## Workflow com o usuário

- O Foundry está instalado nesta máquina, mas o agente **não executa testes nele** (sessão interativa no navegador) — o usuário executa os testes. Toda entrega inclui: (a) roteiro de teste numerado, (b) logging debug atrás do setting `boss-forge.debug`, (c) macro de diagnóstico atualizada se necessário.
- Em bug: pedir **UMA colagem** (diagnóstico + stack trace do console), não pingue-pongue de perguntas.
- Usuário: mestre 5e (regras 2024), engenheiro em formação, confortável com F12 e git básico; hoje faz tudo com macros à mão.

## Comandos

- `npm install` (uma vez) e `npm run packs:build` — compila `packs/_source/*` → LevelDB em `packs/`.
- `npm run packs:extract` — traz edições feitas no Foundry de volta ao source.
- Release: push de tag `vX.Y.Z` → GitHub Action gera zip + manifest (versão/URLs carimbados a partir do tag e do repo; ver `.github/workflows/release.yml`).
