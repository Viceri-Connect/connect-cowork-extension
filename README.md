# connect-cowork-extension

Marketplace da extensão **Connect** (programa Impulsa / Viceri Seidor) para o Claude **Cowork**.

No início de cada sessão o Connect **restaura a identidade do operador**, monta a
**matriz de contexto** como atalho *flat* no workspace e carrega o **contexto lazy
da camada 1**. Sub-vaults descem **sob demanda**, resolvidos por conceito — a
governança que mora na matriz desce para todos os sub-vaults.

> Conceituação, ADRs e backlog canônicos vivem no vault matriz (`projetos/ativos/Connect/`).
> O banco de provas anterior (plugin CLI do lab) fica em `D:\Impulsa\lab\lab\connect`.

## Instalação no Cowork

> **Nota (v0.12.2+):** A extensão não exige mais que o usuário tenha o Node.js instalado. O próprio plugin fará o download de um executável portátil do Node.js (apenas para Windows) na primeira vez que a sessão for iniciada.


**Caminho primário — adicionar o marketplace pela URL do repo (recomendado):**

1. No Cowork, adicionar um marketplace de plugins apontando para a URL deste repo
   git (`https://github.com/Viceri-Connect/connect-cowork-extension`).
2. Instalar o plugin **connect** a partir do marketplace `impulsa`.
3. Apontar, uma vez, a **pasta fixa do Connect** (`CONNECT_HOME`, fora do OneDrive)
   e os caminhos da matriz e do cérebro pessoal (ver *Configuração*).

Vantagem: aponta uma vez e recebe atualizações ao atualizar o marketplace.

**Caminho secundário — bundle `.plugin` de um clique (leigo, sem git):**

```
bash scripts/build-plugin.sh      # gera ./dist/connect.plugin
```

Entregar o `connect.plugin`; no Cowork, abrir o arquivo e aceitar a instalação.

> **Claude Code (só desenvolvimento):** `claude plugin marketplace add <repo>` +
> `claude plugin install connect@impulsa`. É a CLI do Claude Code, **não** o Cowork —
> serve para desenvolver/testar o mecanismo, não é o caminho de entrega da v1.

## Estrutura (marketplace + plugin)

```
.claude-plugin/marketplace.json     # marketplace "impulsa" — aponta ./plugins/connect
plugins/connect/                     # o plugin instalável
  ├── .claude-plugin/plugin.json     # ← fonte da VERSÃO
  ├── .mcp.json                      # registra o MCP stdio local "connect"
  ├── mcp/connect-mcp.mjs            # servidor MCP (iniciar_sessao + primitivos de mount)
  ├── lib/                           # núcleo testável, zero-dep
  │   ├── mount.mjs                  #   junction (Windows) / symlink (POSIX)
  │   ├── matriz.mjs                 #   identidade + montagem da camada 1
  │   ├── session.mjs                #   iniciarSessao() — o bootstrap
  │   └── render.mjs                 #   bloco de contexto da sessão
  ├── hooks/                         # SessionStart (type: command) → iniciarSessao
  ├── skills/connect-knowledge-mount/
  ├── scripts/spike-junction.ps1     # spike da premissa 2 (junction NTFS) no host
  └── config/connect.config.example.json
scripts/build-plugin.sh              # empacota o .plugin (caminho secundário)
docs/                                # SPEC, notas do POC
tests/                               # spikes que matam premissas (repetíveis)
```

## Configuração (paths locais, nunca versionados)

Via env ou por `{CONNECT_HOME}/connect.config.json`
(ver `plugins/connect/config/connect.config.example.json`):

- `CONNECT_HOME` — pasta fixa do Connect, **fora do OneDrive** (scaffold das sessões).
- `CONNECT_VAULT_MATRIZ` — caminho local da matriz.
- `CONNECT_CEREBRO_PESSOAL` — caminho local do cérebro pessoal (identidade).

## Testes

```
node tests/spike-mecanismo.mjs     # núcleo ponta a ponta (symlink no Linux, junction no Windows)
node tests/handshake-mcp.mjs       # handshake do MCP + iniciar_sessao
```

Ver `docs/POC-NOTES.md` para o spike das premissas 1–3 no host Windows/Cowork.

