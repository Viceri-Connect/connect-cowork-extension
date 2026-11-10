# Pacotes e build

## O pacote do marketplace

Um pacote só, `plugins/connect`, com MCP em **stdio**, para os quatro hosts. É a fonte: edite aqui.

O servidor também fala **Streamable HTTP local** (`--transport=http`, ou
`CONNECT_MCP_TRANSPORT=http`; só escuta em `127.0.0.1:3737`), para quem precisar configurar um host
à mão. Não há pacote separado para isso: os quatro hosts sobem stdio, e um pacote HTTP exigiria
o operador subir o servidor à mão a cada sessão.

## O que é gerado (não edite à mão)

| Arquivo | Gerado por | Fonte |
|---|---|---|
| `plugins/connect/rules/AGENTS.md` | `npm run gerar:regras` | `lib/regras.mjs` |
| `docs/paridade-harness.md` | `npm run gerar:paridade` | `tests/architecture/paridade.mjs` |

O teste de arquitetura compara cada um com o gerado. Divergência quebra o build.

## Bundles de distribuição

| Bundle | Comando | Conteúdo |
|---|---|---|
| `connect.plugin` (Cowork, um clique) | `bash scripts/build-plugin.sh <pasta-absoluta>` | zip de `plugins/connect` |
| Copilot Agent Plugin | `npm run build:copilot -- <pasta>` | `plugins/connect` sem a superfície dos outros hosts |

`dist/` é ignorado pelo git.

## Fim de linha e modo

- `.gitattributes`: tudo LF, exceto `*.bat`, `*.cmd` e `*.ps1` em CRLF.
- `scripts/connect-mcp`, `run-node.sh` e `run-node.bat` com modo 755 no git
  (`git update-index --chmod=+x`).
