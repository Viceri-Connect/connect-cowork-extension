# Testes

Ferramental na raiz (Vitest), fora do bundle.

| Pasta | O que prova | Comando |
|---|---|---|
| `tests/architecture/` | Contrato de harness e paridade entre hosts | `npm run test:architecture` |
| `tests/unit/` | Módulos de `lib/`, anotações das tools, render por host, skills por host | `npm run test:unit` |
| `tests/integration/` | Spikes por domínio (em perfil descartável), adaptadores, runtime em sandbox | `npm run test:integration` |
| `tests/e2e/` | MCP real (stdio e HTTP), bundle do Copilot, hooks dos hosts | `npm run test:e2e` |
| `tests/regressao/` | O Cowork recebe o mesmo que na referência aceita (ver abaixo) | `npm run test:regressao` |

Tudo: `npm test`. Diagnóstico do contrato sem Vitest: `npm run check:harnesses`.
Ambos exigem `npm ci`: o diagnóstico usa o parser `yaml`, dependência apenas de desenvolvimento,
para validar a sintaxe real do frontmatter das skills, além de nome e description no padrão
Agent Skills. YAML inválido, chave duplicada ou description que não seja texto reprova o contrato.
Descrições com `:` seguido de espaço precisam de aspas ou de um bloco `>`/`>-`.

## Regressão do Cowork

`tests/regressao/referencia/` guarda o que o Cowork recebe, num estado de máquina fixo. A
primeira referência veio da main na 0.40.0, a última versão antes do multi-harness
(`referencia/origem.md`). O teste compara o pacote atual com ela:

- o texto do hook de SessionStart (sessão normal e na nuvem sem configuração);
- o contrato das tools do MCP (nome, descrição e parâmetros; tool nova pode entrar);
- o hash dos arquivos que só o Cowork lê (`hooks/hooks.json`, `.mcp.json`, `mcp/launcher.bat`,
  `scripts/run-node.ps1`).

O mesmo teste prova o runtime portátil no caso do Cowork: Node no `CONNECT_HOME/bin` mesmo com
`CLAUDE_PLUGIN_DATA` definido, e `CONNECT_HOME` não definido caindo no perfil do usuário. Com
`CONNECT_TESTE_DOWNLOAD=1`, baixa o Node de verdade e confere que ele vai para o `CONNECT_HOME/bin`.

### Quando o teste falha

- **Mudança sem querer** (refatoração, outro host): corrija o código. É para isso que o teste existe.
- **Mudança decidida no Cowork** (texto novo no hook, tool com parâmetro novo, timeout do hook):
  no mesmo PR, rode `node tests/regressao/gerar-referencia.mjs plugins/connect` e registre no
  CHANGELOG. O diff de `referencia/` mostra ao revisor exatamente o que muda para o operador.

Regenerar só para o teste voltar a passar, sem decisão, apaga a proteção.

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
3. `cowork-runtime`: regressão do Cowork com download real do Node, em Windows e Linux.
4. `bundle` (.plugin) e `copilot-bundle`.

## Tempo

No Windows a suíte inteira leva ~2,5 min (os testes de arquitetura sobem PowerShell e cmd de
verdade). No Linux, ~30 s para o contrato.
