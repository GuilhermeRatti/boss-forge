# Design M4 — Fases por HP

> **Status: decisões delegadas ao agente; validação via teste do usuário** (fluxo consolidado no M3). Escrito e implementado em 2026-07-04 com base em `docs/research/2026-07-04-m4-fases-fontes-instaladas.md`.

## 1. Escopo

Bosses com fases definidas por **thresholds de % de HP**: ao cruzar um threshold, dispara a "cutscene" da fase — anúncio dramático no chat + FX — e aplica as trocas opcionais: **efeitos/auras** (ActiveEffects habilitados/desabilitados por nome) e **conjunto de ações** (itens marcados por fase somem/aparecem nos prompts de ações lendárias e de covil). Sem Boss Designer ainda: configuração via API/macro (`api.phases.*`), como nos milestones anteriores.

Fora do escopo: cutscenes compostas/cinemáticas (telegraph → impacto → pausa — M5), mudança de statblock inteiro, HP máximo por fase.

## 2. Fatos verificados que moldam o design

1. `hp.pct` é derivado nativamente (0–100 sobre `effectiveMax`, incluindo temp max) — thresholds comparam direto.
2. `updateActor` cobre TODA mudança de HP (Midi, cards, macro, edição manual); `dnd5e.applyDamage` não cobre edição manual — por isso não é o gatilho.
3. Detecção **por estado**: fase alvo = quantos thresholds estão ≥ `hp.pct`; comparada com a fase armazenada (`flags.boss-forge.phaseState.index`). Dano que atravessa duas fases dispara ambas em sequência.
4. Sem toggle nativo de item de NPC — a troca de ações é filtro nosso nos prompts (M1/M3) via flag de fase no item.

## 3. Modelo de dados

- **Config por ator** (`flags.boss-forge.phases`, aplicada nos dois lados de tokens não-vinculados):
  ```js
  [
    {
      threshold: 50,              // dispara quando hp.pct <= 50
      name: "Fúria Desperta",    // opcional; default "Fase {n}"
      message: "O dragão...",    // opcional, parágrafo extra no anúncio
      fx: { preset: "impact", options: { file: "jb2a....", scale: 2 } }, // opcional; objeto ou ARRAY (tocados em ordem)
      effects: { enable: ["Aura de Fogo"], disable: ["Postura Defensiva"] } // opcional, por NOME do ActiveEffect
    },
    { threshold: 25, ... }
  ]
  ```
- **Estado**: `flags.boss-forge.phaseState = { index }` (0 = inicial). **One-way**: cura acima do threshold não regride a fase (drama não anda para trás); `api.phases.reset(actor)` re-arma para outra tentativa da mesa.
- **Fase em itens**: `flags.boss-forge.phase = 1` (ou `[1, 2]`) — as activities lendárias/de covil desse item só aparecem nos prompts quando a fase corrente casa (número = exata; array = qualquer uma; sem flag = sempre). `api.phases.setItemPhase(item, faseOuArray)`.
- **Setting mundial** `phases` (default on).

## 4. Fluxo runtime

```
updateActor (todos os clientes; GM ativo age)
└─ setting ligado? mudança toca system.attributes.hp? ator tem config de fases?
└─ alvo = fase calculada de hp.pct; armazenada = phaseState.index
└─ alvo <= armazenada? nada (one-way)
└─ para cada fase pulada (armazenada+1 .. alvo), em ordem:
   ├─ anúncio PÚBLICO no chat (nome da fase em destaque + message opcional)
   ├─ FX no token do boss (objeto ou array de presets, em ordem)
   └─ efeitos: enable/disable por nome via allApplicableEffects()
└─ phaseState.index = alvo
```

- Anúncio público de propósito: a virada de fase é a cutscene da mesa. (Se incomodar, o feedback poda — precedente estabelecido.)
- `api.phases.advance(actor)` força a próxima fase manualmente (GM soberano, independe de HP).

## 5. API

`api.phases.set(actor, config)` (valida thresholds/presets/estrutura e zera o estado), `get(actor)`, `clear(actor)`, `reset(actor)`, `advance(actor)`, `setItemPhase(item, phase)`, `clearItemPhase(item)`, `getIndex(actor)`.

## 6. Casos de borda mapeados

- Dano que cruza 2+ thresholds de uma vez → todas as fases disparam, em ordem.
- Cura de volta acima do threshold → fase mantida (one-way); `reset` disponível.
- HP a 0 → não é fase (morte é assunto do sistema); fases com threshold 0 são ignoradas na validação.
- Ator sem token na cena → anúncio e efeitos saem; FX é pulado com debug log.
- Config nos dois lados de token não-vinculado; estado vive no ator que sofreu o dano (o do combate).
- Prompts (M1/M3) refletem a fase na hora — item marcado com a fase nova aparece no gatilho seguinte.

## 7. Gatilhos adicionais (2ª iteração, 2026-07-04 — cenários do usuário)

Do feedback do primeiro teste (núcleo aprovado; cenários de campanha listados pelo usuário):

1. **Fases por cura** (`direction: "up"` no `api.phases.set`): thresholds disparam quando `hp.pct` SOBE (proteger/curar um NPC de 1% até 100%; permite threshold 100). One-way para cima; flag legada em array continua valendo como "down".
2. **Gatilho de mortes vinculadas** (`api.phases.linkDeaths(boss, [tokens...])`): quando TODAS as criaturas vigiadas estiverem com HP 0 (ou deletadas), o boss avança uma fase — ex.: banshees mortas → ritual cessa → sala seca → boss enfraquece (fases podem enfraquecer: `effects.disable` + ações que somem do prompt via fase de item). Dispara uma vez; `reset` re-arma.
3. **Gatilho de diferença de HP** (`api.phases.linkGap(bossA, bossB, { gap: 25 })`): quando |pctA − pctB| ≥ gap, **ambos** avançam de fase (conselho/consortes em enrage). Uma vez; `reset` re-arma.
4. **Manual**: `api.phases.advance(actor)` já cobria.

Avisos de gatilho saem em whisper ao GM (o anúncio público da fase em si já acontece pelo fluxo normal). A cura passiva de 10%/turno do cenário de proteção fica fora do módulo (é um ActiveEffect/macro da mesa — as fases só reagem ao HP).

## 8. Pós-teste

Feedback do usuário decide podas/ajustes, registrados aqui. Primeiro teste (2026-07-04): transições, animações, mensagens e one-way aprovados; erro "api is not defined" era snippet do roteiro sem o prefixo `game.modules.get("boss-forge")` (corrigido na entrega seguinte).
