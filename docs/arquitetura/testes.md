# Testes

Ferramental na raiz (Vitest), fora do bundle.

| Pasta | O que prova | Comando |
|---|---|---|
| `tests/architecture/` | Contrato de harness e paridade entre hosts | `npm run test:architecture` |
| `tests/unit/` | Módulos de `lib/`, anotações das tools, render por host, skills por host | `npm run test:unit` |
| `tests/integration/` | Spikes por domínio (em perfil descartável), adaptadores, runtime em sandbox | `npm run test:integration` |
| `tests/e2e/` | MCP real (stdio e HTTP), bundle do Copilot, hooks dos hosts | `npm run test:e2e` |

Tudo: `npm test`. Diagnóstico do contrato sem Vitest: `npm run check:harnesses`.

## Isolamento

Testes que tocam o Connect rodam num perfil descartável: `HOME`, `USERPROFILE` e `CONNECT_HOME`
apontam para `.test-tmp/` (fora de AppData, que o Connect recusa), e variáveis `CONNECT_*` da
máquina são removidas. Nenhum teste toca o seu `~/Connect`. O Node do teste é ligado (hard
link) como runtime portátil do sandbox, para nunca baixar 70 MB.

## Testes de arquitetura

- `harness-contract.mjs` declara o que cada host precisa ter ([conceito](../conceitos/contrato-de-harness.md)).
- `harness-checks.mjs` confere; `harnesses.test.mjs` roda um teste por pacote × host × feature.
- `paridade.mjs` é a tabela de paridade ([conceito](../conceitos/paridade-e-limiar.md)).

As checagens executam hooks e o MCP de verdade (spawn). Por isso cada teste cede um ciclo do
event loop antes de rodar, ou o Vitest acusa "Timeout calling onTaskUpdate" no Windows.

## CI (`.github/workflows/ci.yml`)

1. `architecture` (Ubuntu) roda primeiro e bloqueia os demais.
2. `test`: Windows e Linux × Node 20.11.1 e 22; macOS informativo.
3. `bundle` (.plugin) e `copilot-bundle`.

## Tempo

No Windows a suíte inteira leva ~2,5 min (os testes de arquitetura sobem PowerShell e cmd de
verdade). No Linux, ~30 s para o contrato.
