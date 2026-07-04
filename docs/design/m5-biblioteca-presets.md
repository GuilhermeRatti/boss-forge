# Design M5 — Biblioteca de presets de FX

> **Status: parte 1 implementada em 2026-07-04** (motor + presets novos, decisões delegadas, validação via teste); **parte 2 (catálogo com preview) em seguida** — é a estreia da barra de qualidade de UI registrada pelo usuário. Base: `docs/research/2026-07-04-m5-sequencer-fontes-instaladas.md`.

## 1. Escopo em duas partes

- **Parte 1 — motor**: registro modular de presets (um arquivo por preset, com metadados de parâmetros) e o arsenal inicial "boss-grade": `impact` (existente), `telegraph` (aviso de área sem asset → impacto opcional), `beam` (raio/breath do boss até os alvos) e `aura` (efeito persistente preso ao token, com limpeza determinística). Tudo plugável nas flags existentes (M1 item FX, legres, covil, fases) sem mudança nas integrações.
- **Parte 2 — catálogo**: `ApplicationV2` navegável listando os presets do registro, com formulário de parâmetros gerado dos metadados, botão de **preview** (toca no token selecionado/ponto) e **aplicar** (grava a flag no item/ator escolhido). UI bonita, concisa e prática — requisito de primeira classe.

## 2. Arquitetura do registro (modularidade por instrução do usuário)

Cada preset é um módulo em `scripts/fx/presets/` exportando `{ id, params, play }`:

- `params`: descritores `{ key, type: "file"|"number"|"color"|"select"|"boolean", default?, required?, options? }` — a parte 2 gera o formulário do catálogo a partir disso (adicionar um preset novo = 1 arquivo + 1 import no registro; nada de UI artesanal por preset).
- `play(options)`: recebe `{ locations, source, ...params }` — `locations` (tokens/pontos alvo) e `source` (token do boss) são resolvidos pelas integrações; presets são system-agnostic e nunca lançam para fora (softFail + try/catch no dispatcher).

## 3. Os presets da parte 1

| Preset | Parâmetros | Comportamento |
| --- | --- | --- |
| `impact` | `file`, `scale?`, `delay?` | Efeito único em cada location (inalterado). |
| `telegraph` | `form?` (`circle`/`cone`/`line`), `radius?`, `length?`, `angle?`, `width?` (grid/graus), `color?`, `duration?` (ms), `file?`, `scale?`, `delay?` | Aviso via `.shape()` (sem asset, `belowTokens`). **Cones e linhas** (2ª iteração, pedido do usuário — sopro de dragão): polígono calculado ancorado no boss apontando para cada alvo; o `file` de payoff **estica do boss ao alvo** (`stretchTo`). Círculo: comportamento original. |
| `beam` | `file`, `scale?` | `.stretchTo()` do `source` (boss) até cada location — raios, breaths, correntes. |
| `aura` | `file`, `scale?`, `opacity?` (0.75), `fadeIn?` (500), `belowToken?` (true) | `.attachTo(token).persist()` com `origin("boss-forge.aura.<tokenUuid>")`; `api.fx.clearAuras(actorOuToken)` encerra só as nossas. Persiste entre reloads (comportamento do Sequencer). |
| `rain` | `file`, `count?` (5), `radius?` (grid, 6), `interval?` (300 ms), `telegraph?` (true), `telegraphDuration?` (1200), `impactRadius?` (1), `color?`, `scale?` | **Chuva de impactos aleatórios** (ideia do usuário, 2026-07-04): pontos uniformes num raio ao redor do centro (token do boss por padrão), escalonados por `interval`, cada um telegrafado por um círculo que expira exatamente quando o impacto cai. |

Casos de uso imediatos: `aura` como FX de fase (enrage!), `telegraph` como FX de lair action, `beam` como FX de ação lendária com `at: "targets"`.

## 4. API

`api.fx.play(nome, opts)`, `list()`, `exists(nome)`, **`describe(nome)`** (metadados p/ UI e macros) e **`clearAuras(actorOuToken)`**.

## 5. Parte 2 — catálogo (próxima entrega)

`ApplicationV2` com: lista de presets (do registro), formulário por metadados, seletor de asset com busca no `Sequencer.Database` (prefixos reais da mesa: `jb2a`, `blfx`), preview no token selecionado, aplicar em item (ações lendárias/covil) ou ator (legres/covil/fases). i18n dos labels de parâmetros entra aí. Estética: primeira aplicação séria da barra de qualidade de UI.

**Norte de design (2026-07-04, indicado pelo usuário: a UI do BLFX)** — extraído do CSS instalado (`boss-loot-assets-premium/styles/blap.css`) e do vídeo de referência do usuário: variáveis CSS com tema claro/escuro (`body.theme-light`), layout **master-detail 30/70** (busca + filtros + lista à esquerda; detalhe/preview à direita), inputs em pílula (radius 20px), animação de glow para chamar atenção. Identidade própria do Boss Forge: paleta carvão + **laranja-brasa** (`#ff4d00`, o mesmo do telegraph) no lugar do dourado/vinho do BLFX.

**Técnica anotada (observação do usuário)**: o BLFX cria *atores invisíveis* para magias como Darkness/Daylight — provável veículo para fontes de luz/escuridão móveis e controláveis. Guardar como caminho para futuros presets de iluminação (aura de escuridão, eclipse de fase); fora do escopo da parte 2.

## 6. Parte 2 entregue (2026-07-04) — a Forja de FX

Identidade visual **própria** (instrução do usuário: inspirar no BLFX sem copiar): tema "forja" — carvão/aço com brasa laranja-fundida (`--bf-ember`), **cantos chanfrados** via clip-path (metal forjado; contraponto às pílulas arredondadas do BLFX), glow de calor em hover/foco, switches de brasa, tema claro/escuro via variáveis CSS. Estrutura: master-detail (trilho de presets à esquerda; herói + formulário + aplicar à direita), formulário **gerado dos metadados** do registro (preset novo aparece na UI sem código de UI), preview no token selecionado (alvos marcados viram locations), aplicar em item lendário/covil, legres ou covil do ator, botão de database do Sequencer no campo de arquivo, e "Copiar código" como válvula de escape de power user (lição do editor do BLFX). Abertura: botão GM na barra de tokens ou `api.fx.openCatalog()`.

## 6b. Segunda iteração (2026-07-04, feedback do teste da Forja)

1. **Composição de FX**: todo ponto de FX (item M1/covil, legres, covil, fases) aceita além de `{preset, options}` um **array de etapas** `[{preset, options, delay, at}]` (`playFx`/`api.fx.playSteps`). Semântica refinada pelo usuário: (a) **etapas são agendadas, não serializadas** — `delay` em ms relativo ao início da etapa anterior; `delay: 0` = **overlap** (duas animações simultâneas); confirmado na fonte que `Sequence.play()` só resolve ao fim das seções, por isso o agendamento é nosso (`setTimeout` cumulativo); (b) **âncora por etapa** — `at: "boss" | "targets" | herdar` — cobrindo o caso bola de fogo: cast no boss (`at: "boss"`) → projétil esticado (preset `beam`) → explosão nos alvos (`at: "targets"`). Na Forja: seção **Composição** — monta o preset, "adiciona como etapa"; cada chip tem âncora e delay editáveis; Preview/Aplicar/Copiar usam a composição inteira. Fix da revisão adversarial: os setters de flag agora fazem `unsetFlag` antes do `setFlag` (o Foundry MESCLA flags de objeto — trocar composição↔preset único deixaria resíduo permanente).
2. **Telegraph cone/linha** (ver tabela §3) — sopros direcionais telegrafados.
3. **Color picker nativo** (`<input type="color">`) no lugar do campo hexadecimal — feedback direto do usuário ("humanos não veem hexadecimal").
4. **Identidade v2 — "ferro fundido"**: o v1 leu como "terrano de SC2" para o usuário; a v2 puxa para forja de verdade — placas de aço **em relevo** (embossing por sombras internas), **rebites** nos cantos das barras e do ícone-herói, **costuras de lava animadas** (gradiente fluindo no sublinhado do herói, na borda das seções e no botão primário), vermelho-lava vivo (`#ff2d00`) + amarelo-calor, marca d'água de **dragão** fantasma no herói, e os dialogs do M1/M3/legres ganharam o mesmo tratamento (header com costura de lava, botões de ferro). `prefers-reduced-motion` desliga as animações.
5. **Para chegar na "moldura de dragão esculpido" imaginada pelo usuário**: CSS puro tem teto — o próximo salto exige **arte**: uma moldura 9-slice em PNG com transparência (ornamentos de ferro/dragão nos cantos; ~512×512, cantos de ~96px) + opcionalmente uma fonte display licenciável. O usuário pode gerar/encomendar essas peças; a Forja as adota via `border-image` sem refatorar nada.

## 7. Backlog de ideias (do usuário)

- **Telegraph por turnos** (2026-07-04): virada de turno telegrafa X impactos; na virada seguinte eles explodem e novos X são telegrafados — mecânica de boss fight acoplada ao tracker. A discutir (impacto no ritmo da luta) antes de prototipar.
- **Fit-to-area inteligente** (2026-07-04): redimensionar a animação para caber EXATAMENTE na área da habilidade (ex.: explosão encaixada num círculo de raio X). Mecanismo já verificado na fonte: `EffectSection.size(valor, { gridUnits: true })` existe no 4.2.2 — um flag por etapa (`fit: true` + `area: {shape, radius}`) resolveria o "quais etapas encaixam": no exemplo cast → aura → sopro, só o sopro levaria `fit`, pois cast e aura são cosméticos. A UI marcaria isso por etapa (toggle "encaixar na área"). Complexidade real está na interação com composições — implementar numa iteração dedicada.

## 8. Pós-teste

Feedback do usuário decide podas/ajustes, registrados aqui.
