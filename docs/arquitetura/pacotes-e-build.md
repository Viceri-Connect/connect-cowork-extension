# Pacotes e build

## Pacotes do marketplace

| Pacote | Transporte do MCP | Como nasce |
|---|---|---|
| `plugins/connect` | stdio (padrão) | **fonte** — edite aqui |
| `plugins/connect-http` | Streamable HTTP em `127.0.0.1:3737` | **gerado** por `scripts/build-connect-http.mjs` |

O `connect-http` só muda o que é de transporte (configs de MCP de cada host e os nomes). Hooks,
skills, `lib/` e `scripts/` são os mesmos. O servidor HTTP sobe com
`scripts/connect-mcp --transport=http --port=3737` (ou `.cmd` no Windows).

## O que é gerado (não edite à mão)

| Arquivo | Gerado por | Fonte |
|---|---|---|
| `plugins/connect-http/**` | `npm run build:connect-http -- plugins/connect-http` (apague a pasta antes) | `plugins/connect` |
| `plugins/connect/rules/AGENTS.md` | `npm run gerar:regras` | `lib/regras.mjs` |
| `docs/paridade-harness.md` | `npm run gerar:paridade` | `tests/architecture/paridade.mjs` |

O teste de arquitetura compara cada um com o gerado. Divergência quebra o build.

## Bundles de distribuição

| Bundle | Comando | Conteúdo |
|---|---|---|
| `connect.plugin` (Cowork, um clique) | `bash scripts/build-plugin.sh <pasta-absoluta>` | zip de `plugins/connect` |
| Copilot Agent Plugin | `npm run build:copilot -- <pasta>` | `plugins/connect` sem a superfície dos outros hosts |
| `connect-http` de distribuição | `npm run build:connect-http -- <pasta>` | igual ao versionado |

`dist/` é ignorado pelo git.

## Fim de linha e modo

- `.gitattributes`: tudo LF, exceto `*.bat`, `*.cmd` e `*.ps1` em CRLF.
- `scripts/connect-mcp`, `run-node.sh` e `run-node.bat` com modo 755 no git
  (`git update-index --chmod=+x`), nos dois pacotes.
