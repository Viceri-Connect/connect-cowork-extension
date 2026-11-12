# AGENTS.md — connect-cowork-extension

Instruções para agentes de código (Codex, Copilot, Antigravity, Claude) neste repositório.
Documentação completa: [`docs/README.md`](docs/README.md).

## O que é

Plugin **Connect**: um mecanismo (núcleo em `lib/`, servidor MCP, hooks, skills) entregue a
quatro hosts de agente — Claude/Cowork, Codex, Copilot e Antigravity — pelo mesmo pacote.
Os hosts são pares; o Cowork é a referência da migração, não uma dependência.

## Mapa

| Caminho | O quê |
|---|---|
| `plugins/connect/` | **Fonte** do plugin (edite aqui) |
| `plugins/connect/lib/` | Núcleo; `bootstrap.mjs` decide o que todo hook injeta |
| `plugins/connect/mcp/connect-mcp.mjs` | Servidor MCP (tools + `ANOTACOES`) |
| `plugins/connect/hooks/`, `copilot/` | Entrada de cada host (só envelope) |
| `plugins/connect/scripts/` | Runtime portátil (`run-node.*`, `connect-mcp`) |
| `plugins/connect/skills/` | Skills `cnct-*` |
| `tests/architecture/` | Contrato de harness e paridade entre hosts |
| `docs/` | Arquitetura, conceitos e guias |

## Regras

1. **Nunca edite à mão o que é gerado.** Regenere:
   - `plugins/connect/rules/AGENTS.md`: `npm run gerar:regras`;
   - `docs/paridade-harness.md`: `npm run gerar:paridade`.
2. **Lógica no núcleo, nunca no hook.** Hook só lê o payload e embrulha a saída
   (`contextoDeInicio()` + `jsonAscii()`).
3. **Nada de `node` direto** em hook ou MCP: passe por `scripts/run-node.*` ou `scripts/connect-mcp`.
4. **Paridade:** capacidade nova precisa de decisão para os quatro hosts em
   `tests/architecture/paridade.mjs` (`igual` ou `limiar` com o porquê). Hook novo sem capacidade
   e texto injetado diferente fora de `BLOCOS_POR_HOST` quebram o build.
5. **Agnóstico de cliente:** nada de cliente, caminho de máquina ou e-mail no plugin.
6. **MCP sem shell:** só operações nomeadas; toda tool com anotação de leitura/escrita.
7. **Skills no padrão Agent Skills:** `name` = pasta, `description` de 1 a 1.024 caracteres.
8. **Fim de linha e modo:** LF em tudo, CRLF em `*.bat`, `*.cmd`, `*.ps1`. `scripts/connect-mcp`,
   `run-node.sh` e `run-node.bat` com modo 755 no git (`git update-index --chmod=+x`).
9. **Versão:** os três manifests iguais e a 1ª entrada do `CHANGELOG.md`.
10. **Regressão do Cowork:** se `test:regressao` falhar, corrija o código. Só regenere a
    referência (`node tests/regressao/gerar-referencia.mjs plugins/connect`) quando a mudança no
    Cowork tiver sido pedida, no mesmo commit da mudança e com entrada no CHANGELOG.

## Comandos

```
npm ci                      # uma vez
npm test                    # tudo
npm run test:architecture   # contrato e paridade
npm run test:regressao      # o Cowork recebe o mesmo que a referência aceita
npm run check:harnesses     # contrato sem Vitest (diagnóstico rápido)
npm run test:unit | test:integration | test:e2e
```

No Windows, se a política de execução do PowerShell bloquear o `npx.ps1`, use `npx.cmd`. A suíte
inteira leva ~2,5 min no Windows.

## Ao terminar uma mudança

- Regenere os artefatos que ela afeta e rode `npm test`.
- Um commit por pacote de mudança, cada um verde sozinho; mensagem em português, no imperativo,
  dizendo o que muda e por quê.
- Mudou comportamento para o operador? Entrada no `plugins/connect/CHANGELOG.md`.
- Mudou arquitetura ou conceito? Atualize a página em `docs/`.
