# Ambiente pinado — diagnóstico M0

Saída da macro **Boss Forge: Diagnostics** executada na máquina do Foundry (Windows 11). Este arquivo é a fonte da verdade sobre o ambiente-alvo; quando o ambiente mudar (atualização de core/sistema/módulo, novo módulo de assets), re-executar a macro e atualizar aqui e no README.

## Saída do diagnóstico (verbatim, 2026-07-04 — pós-instalação do JB2A)

```
=== Boss Forge Diagnostics ===
Generated: 2026-07-04T04:56:30.801Z
Boss Forge: 0.0.1
Foundry VTT: 13.351
System: dnd5e 5.3.3
Active modules (9):
  - blfx-assets-pack01 1.0.19
  - boss-forge 0.0.1
  - boss-loot-assets-premium 3.4.5
  - dae 13.0.29
  - jb2a_patreon 0.9.1
  - lib-wrapper 1.13.5.1
  - midi-qol 13.0.63
  - sequencer 4.2.2
  - socketlib v1.1.4
Sequencer database prefixes (2): blfx, jb2a
```

(Primeira rodada do diagnóstico, mais cedo no mesmo dia, era idêntica exceto pela ausência do `jb2a_patreon` — ver histórico do git.)

## Versões pinadas

| Componente | Versão | Cruzamento com a pesquisa (`docs/research/`) |
| --- | --- | --- |
| Foundry VTT | **13.351** | ≥ 13.347 (mínimo do dnd5e 5.3.3) e exatamente a *verified* do midi-qol branch v13 ✓ |
| dnd5e | **5.3.3** | **Igual à tag `release-5.3.3` da pesquisa M1** — caveat "provisória" resolvido ✓ |
| Midi-QOL | **13.0.63** | Pesquisa M2 foi no head do branch `v13` (2026-05-28); conferir divergências na release 13.0.63 ao implementar o M2 |
| DAE | **13.0.29** | Satisfaz `dae ≥ 13.0.23` exigido pelo midi-qol ✓ |
| Sequencer | **4.2.2** | Igual à release da pesquisa de effects ✓ |
| libWrapper | 1.13.5.1 | — |
| socketlib | 1.1.4 | Presente (dependência do Midi) |
| BLFX | blfx-assets-pack01 1.0.19 + boss-loot-assets-premium 3.4.5 | Prefixo `blfx` no database do Sequencer |
| JB2A Patreon | **0.9.1** (`jb2a_patreon`) | Instalado manualmente em 2026-07-04; prefixo `jb2a` no database |

## Prefixos do database do Sequencer

**`blfx` e `jb2a`** (diagnóstico pós-JB2A de 2026-07-04). Regra de projeto mantida: presets **sempre** validam paths com `Sequencer.Database.entryExists()` antes de tocar — nenhum path é assumido como garantido.

## Discrepâncias vs. stack presumido no CLAUDE.md

- **JB2A Patreon: RESOLVIDO em 2026-07-04** — instalado manualmente (0.9.1) e ativo; prefixo `jb2a` confirmado no diagnóstico acima.
  - Histórico do problema: o instalador do app do Foundry **falhava na extração**, não no download — `%LOCALAPPDATA%\FoundryVTT\Logs\{error,debug}.2026-07-04.log` mostram download 100% e depois `ENOTEMPTY: directory not empty, rmdir ...\jb2a_patreon\Library\...` → `PACKAGE.InstallFailed` (corrida de filesystem no Windows — handle preso por AV/indexador e/ou sobras de tentativa anterior).
  - Contorno que funcionou (repetir em updates futuros do JB2A se o app voltar a falhar): baixar o zip da URL `download` do manifest (9,28 GB, acessível sem autenticação) e extrair manualmente em `Data\modules\jb2a_patreon` — via staging + rename para não deixar pasta meio-populada.
- **Combat Carousel: não instalado.** Cosmético, sem impacto nas integrações — o orquestrador usa `combatTurnChange` + guarda de GM ativo e não depende de quem avança o turno.
- Automated Animations está presente no disco mas **inativo** no mundo dnd5e — consistente com a decisão de mantê-lo fora do stack 5e (é do projeto Tormenta 20).

## Notas de instalação

- O `boss-forge 0.0.1` ativo veio de **instalação via manifest da release do GitHub** (a pasta `Data\modules\boss-forge` contém só o conteúdo do zip, sem `.git`) — o pipeline de release do M0 foi validado de ponta a ponta.
- Código e Foundry agora rodam na **mesma máquina Windows 11**; repo de desenvolvimento em `C:\Users\guira\OneDrive\Documentos\GitHub\boss-forge`. Ver DEVELOPMENT.md §2 para o fluxo de teste de código não-released.
