# Guia de desenvolvimento — Boss Forge

Este guia assume que você nunca criou um módulo de Foundry antes. Ele cobre a anatomia de um módulo, o ciclo de desenvolvimento local, o pipeline de compêndios e o processo de release/rollback. Todos os comandos são copy-paste.

## 1. Anatomia de um módulo Foundry

Um módulo é apenas uma **pasta** dentro do diretório de dados do Foundry, em `<FoundryData>/Data/modules/boss-forge/`, com um `module.json` na raiz. O `module.json` é o manifesto: declara id, versão, compatibilidade, e aponta para os arquivos que o Foundry deve carregar:

- `esmodules` → JavaScript (ES Modules). Aqui: [scripts/boss-forge.mjs](scripts/boss-forge.mjs), o ponto de entrada que registra hooks e expõe a API.
- `languages` → traduções ([lang/en.json](lang/en.json), [lang/pt-BR.json](lang/pt-BR.json)).
- `packs` → compêndios (bancos LevelDB na pasta `packs/`).
- `relationships.requires` → dependências (aqui, o Sequencer).

Quando você ativa o módulo num mundo, o Foundry carrega esses arquivos no navegador. **Não há build step**: o `.mjs` que você edita é o que roda. A única exceção são os compêndios (seção 4).

## 2. Setup do ambiente de desenvolvimento

**Configuração real deste projeto: o código é editado no Linux e o Foundry roda em OUTRA máquina, com Windows 11.** O git faz a ponte entre as duas — o repo no GitHub é a fonte da verdade, e no Windows o clone vive direto dentro da pasta de módulos do Foundry.

### 2.1. Máquina de código (Linux — já pronta)

Pré-requisitos: git e Node.js (≥ 18; o repo foi criado com Node 22). O repo local já tem `npm install` e `npm run packs:build` executados. Fluxo: editar → commit → `git push`.

### 2.2. Máquina do Foundry (Windows 11 — setup único)

Pré-requisitos: [Git for Windows](https://git-scm.com/download/win) e [Node.js LTS](https://nodejs.org) (Node só compila compêndios).

1. Descubra o diretório de dados do Foundry: **Configuration → User Data Path** (padrão: `C:\Users\SEU_USUARIO\AppData\Local\FoundryVTT\Data`).
2. No prompt de comando:

```bat
cd %LOCALAPPDATA%\FoundryVTT\Data\modules
git clone https://github.com/SEU_USUARIO/boss-forge.git boss-forge
cd boss-forge
npm install
npm run packs:build
```

Clonar direto dentro de `Data\modules` dispensa junction/symlink: a pasta do clone **é** a pasta do módulo (o nome precisa ser exatamente `boss-forge`, igual ao id no `module.json`).

### 2.3. Atualizar o módulo no Windows (cada iteração)

Com o **mundo fechado** (volte ao setup — o Foundry mantém lock nos bancos LevelDB dos compêndios com o mundo aberto):

```bat
cd %LOCALAPPDATA%\FoundryVTT\Data\modules\boss-forge
git pull
npm run packs:build
```

O `packs:build` só é obrigatório quando algo em `packs/_source/` mudou (as entregas avisam quando for o caso), mas rodar sempre é rápido e inofensivo. Mudança só de código `.mjs` não precisa de build: `git pull` + F5 basta, mesmo com o mundo aberto.

### 2.4. Alternativa para Foundry na MESMA máquina do código

Se um dia o Foundry rodar na máquina de desenvolvimento, troque o clone dentro de `Data/modules` por um link simbólico para o repo de trabalho:

```bash
# Linux/macOS
ln -s "/home/guilhermeratti/Área de trabalho/Boss Forge" "$HOME/.local/share/FoundryVTT/Data/modules/boss-forge"
```

```bat
:: Windows (junction; não exige admin)
mklink /J "%LOCALAPPDATA%\FoundryVTT\Data\modules\boss-forge" "C:\caminho\para\o\repo\boss-forge"
```

## 3. Ciclo de desenvolvimento

1. Edite o código no repo (Linux) e faça push; atualize o clone no Windows (seção 2.3).
2. No Foundry, pressione **F5** (recarrega o cliente; módulos são recarregados do disco).
3. Teste. Abra o console com **F12** — o critério permanente de aceite é console limpo: sem erros e sem *deprecation warnings*.
4. Para logs detalhados, ative **Configurações → Boss Forge → Log de depuração**. Mensagens do módulo têm o prefixo `Boss Forge |`.
5. Para reportar o ambiente, rode a macro **Boss Forge: Diagnostics** (compêndio *Boss Forge Macros*) ou, no console, `game.modules.get("boss-forge").api.diagnostics()`.

## 4. Compêndios (packs)

O Foundry v13 usa LevelDB (binário) para compêndios — inadequado para git. Por isso:

- A **fonte da verdade** são os JSONs em [packs/_source/](packs/_source/) (um arquivo por documento, com `_id` e `_key` fixos).
- `npm run packs:build` compila `packs/_source/*` → LevelDB em `packs/*` (o que o Foundry lê).
- `npm run packs:extract` faz o caminho inverso: se você editar uma macro *dentro* do Foundry, extraia de volta para o source antes de commitar. **Feche o mundo antes de rodar build/extract** — o Foundry mantém lock no banco.

Rode o build sempre que editar algo em `packs/_source/` e após cada `git pull` que mexa nessa pasta.

## 5. Release e distribuição

O fluxo é automatizado por [.github/workflows/release.yml](.github/workflows/release.yml):

```bash
# 1. Atualize CHANGELOG.md e commite tudo
# 2. Crie e envie a tag (o "v" é obrigatório)
git tag v0.0.1
git push origin main --tags
```

A Action então: compila os packs, carimba versão e URLs no `module.json` (derivados da tag e do repositório — os placeholders `OWNER` do repo são sobrescritos), gera `module.zip` e publica uma GitHub Release com `module.zip` + `module.json` anexados.

Instalação/atualização no Foundry via **manifest URL estável** (aponta sempre para a release mais recente; o Foundry detecta atualizações sozinho):

```
https://github.com/SEU_USUARIO/boss-forge/releases/latest/download/module.json
```

### Rollback

Cada release guarda o próprio manifesto. Para voltar a uma versão específica, desinstale o módulo e reinstale com o manifest daquela release:

```
https://github.com/SEU_USUARIO/boss-forge/releases/download/v0.0.1/module.json
```

> Nota: instalar por essa URL fixa ainda permite que o Foundry ofereça atualização para a latest depois (o campo `manifest` dentro do arquivo aponta para a latest). Para "congelar" numa versão, basta não aceitar a atualização.

## 6. Convenções

- **Conventional commits** (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`…), commits pequenos.
- `CHANGELOG.md` no formato Keep a Changelog, atualizado a cada mudança relevante.
- Strings de UI sempre em `lang/en.json` **e** `lang/pt-BR.json` (chaves `BOSSFORGE.*`).
- Nada de API deprecated da v13; APIs namespaced (`foundry.applications.api.*`, `foundry.utils.*`).
- Antes de integrar com dnd5e/Midi-QOL/Sequencer, verificar a fonte na versão pinada e registrar em [docs/research/](docs/research/).
