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
| `telegraph` | `radius?` (grid, default 2), `color?` (default `#ff4d00`), `duration?` (ms, default 1600), `file?`, `scale?` | Círculo de aviso via `.shape()` (sem asset, `belowTokens`), e se `file` for dado, o impacto cai quando o aviso termina. |
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

## 6. Pós-teste

Feedback do usuário decide podas/ajustes, registrados aqui.
