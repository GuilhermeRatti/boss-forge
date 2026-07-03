# Pesquisa — Sequencer: API de effects para presets (verificado em 2026-07-03)

> Fontes: release 4.2.2 (`module.json` oficial; compat mínimo 13, verified/max 14) e `docs/api/effect.md` do repo `fantasycalendar/FoundryVTT-Sequencer` (branch master). Database API já verificada em `2026-07-03-m0-fundacao.md`. Versão instalada do usuário: pendente (diagnóstico).

## Métodos do EffectSection relevantes para o FX Preset Engine

Enumerados dos headings de `docs/api/effect.md`:

- **Asset**: `.file(dbPathOuArquivo)` (aceita path do database tipo `jb2a.*`/`blfx.*`), `.baseFolder()`, `.copySprite(objeto)`.
- **Posicionamento**: `.atLocation(token|template|ponto)`, `.attachTo(token)` (segue o token), `.stretchTo(alvo)` (raios/breaths), `.rotateTowards(alvo)`, `.moveTowards(alvo)` + `.moveSpeed()`, `.snapToGrid()`, `.spriteOffset()`.
- **Tempo**: `.delay(ms)`, `.duration(ms)`, `.startTime/.endTime/.timeRange()`, `.waitUntilFinished()` (sequencia passos), `.repeats(n, delayMin, delayMax)`, `.persist()` (efeito persistente — enrage/aura de fase; remoção via Effect Manager), `.temporary()`, `.extraEndDuration()`, `.loopOptions()`.
- **Aparência**: `.opacity()`, `.fadeIn(ms)`/`.fadeOut(ms)`, `.fadeInAudio/.fadeOutAudio()`, `.volume()`.
- **Controle**: `.playIf(fn)`, `.locally()`/`.forUsers([...])` (quem vê), `.origin(idCustom)` (marca efeitos para remoção em lote — útil para presets nomeados), `.preset(nome)` (presets registrados no próprio Sequencer).

Uso geral: `new Sequence(...).effect().file("jb2a...").atLocation(token) ... .play()`. Sequences encadeiam `.effect()`, `.sound()`, `.wait()`, `.thenDo()` etc. (Assinatura exata do construtor de `Sequence` — atribuição por módulo/softFail — confirmar na implementação do primeiro preset.)

## Notas para o design do FX Preset Engine (núcleo system-agnostic)

- `.origin("boss-forge.<presetId>.<runId>")` + Effect Manager permitem cancelar/limpar FX de preset de forma determinística.
- `.persist()` cobre enrage/auras de fase (M4); telegraphs são compostos com `.duration()` + `.waitUntilFinished()` + passo de impacto.
- `.playIf()` permite presets tolerantes a asset ausente; combinar com `Sequencer.Database.entryExists(path)` para validar paths `jb2a.*`/`blfx.*` antes de tocar (prefixos exatos da mesa saem no diagnóstico).
- Nada aqui importa código dnd5e — o núcleo FX recebe tokens/pontos/paths como parâmetros puros.
