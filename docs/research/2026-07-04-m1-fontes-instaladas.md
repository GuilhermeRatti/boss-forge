# Pesquisa M1 — verificação nas fontes INSTALADAS (2026-07-04)

> Complemento da pesquisa de 2026-07-03, feito lendo as builds que **de fato rodam** na máquina do usuário: `C:\Program Files\Foundry Virtual Tabletop\resources\app\public\scripts\foundry.mjs` (core 13.351), `%LOCALAPPDATA%\FoundryVTT\Data\systems\dnd5e\dnd5e.mjs` (5.3.3) e `%LOCALAPPDATA%\FoundryVTT\Data\modules\sequencer\dist\sequencer.js` (4.2.2). Números de linha referem-se a essas builds.

## DialogV2 (core 13.351, `foundry.mjs` ~57151+)

- `DialogV2.wait({window, content, buttons, submit?, render?, close?, rejectClose=false, position, modal})` (~57388): resolve com `callback(event, target, dialog) ?? action` do botão clicado; **`null` se fechado/ESC** (com `rejectClose: false`, o default).
- `buttons` é **array obrigatório** (≥ 1 entrada; ~57180) de `{action, label, icon, class, style, type, disabled, default, callback}`; são renderizados no `<footer class="form-footer">`.
  - **`disabled` é suportado por botão** (~57214, ~57224) — cobre o requisito "ação com custo > restante aparece desabilitada".
  - `label` passa por `game.i18n.localize` e vira `innerText` (~57232) — texto puro, sem risco de injeção de HTML.
- `content` (string) passa por `foundry.utils.cleanHTML` (~57179) e é renderizado acima do footer. Nomes de atores interpolados devem ser escapados mesmo assim.
- Em `_onSubmit` (~57247) todos os botões são desabilitados durante o callback (sem duplo-clique) e o dialog fecha com `form.closeOnSubmit` default `true`.

## dnd5e 5.3.3 instalado (`dnd5e.mjs`)

- `ActivityMixin.use(usage={}, dialog={}, message={})` (~16822): retorna `Promise<ActivityUsageResults|void>` — **void quando cancelado** (guardas de embedded/owner/canUse ou dialog de uso abortado). Truthiness do retorno é o critério para "uso de fato aconteceu" (contador do badge + FX).
- `item.system.activities` é Collection (o próprio `use()` faz `item.system.activities.get(this.id)` em ~16835) — iterável com `for...of`, e cada activity expõe `activation.type`/`activation.value`.
- `CONFIG.DND5E.activityActivationTypes.legendary` (~44583): `{ consume: { property: "resources.legact" }, scalar: true, ... }` — idêntico ao pesquisado no repo do tag.

## Core 13.351 (`foundry.mjs`)

- `Hooks.callAll("combatTurnChange", this, previous, current)` (~44331) — assinatura confirmada; na mesma função o core usa **`game.user.isActiveGM`** (~44328) para os turn events, o getter que usaremos como guarda do orquestrador (equivalente a `game.users.activeGM === game.user`).
- `Combatant#isDefeated` (~49129): `this.defeated || actor.statuses.has(CONFIG.specialStatusEffects.DEFEATED)`.

## Sequencer 4.2.2 instalado (`dist/sequencer.js`)

- `new Sequence(options)` (~27696): `options` pode ser `{ moduleName, softFail }` (ou string = moduleName). Com `softFail: true`, arquivo/entrada ausente **não lança** (EffectSection retorna cedo, ~25098/25118).
- `EffectSection.scale(número)` existe (~22341); `.delay(ms)`/`.atLocation()`/`.file()` conforme pesquisa anterior.
- `Sequencer.Database.getEntry(path, { softFail: true })` (~6732) e `entryExists` seguem disponíveis para validar paths antes de tocar.
