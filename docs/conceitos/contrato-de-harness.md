# Contrato de harness

O **contrato** é a declaração do que cada host precisa ter em cada pacote. Mora em
`tests/architecture/harness-contract.mjs` e é verificado por `harness-checks.mjs` a cada build.

## O que ele exige (features)

| Feature | Exige |
|---|---|
| identidade | manifesto com nome do pacote, versão canônica e `$schema` certo |
| mcp | servidor `connect` no transporte da variante (stdio ou HTTP) |
| hook declarado | SessionStart cobrindo startup/resume, executando um `.mjs`; exec form no Claude |
| referencias | todo caminho citado em manifesto, MCP e hooks existe no pacote |
| isolamento | cada host só usa a própria variável de raiz; ninguém fixa `CONNECT_HOME` |
| bootstrap | o hook roda de verdade e injeta o contexto no formato do host |
| bootstrap na nuvem | em sessão na nuvem sem config local, orienta e não cria sessão |
| runtime portatil | nenhum hook nem MCP exige `node` no PATH |
| hook pelo runtime | a linha real do host roda no SO atual e injeta o contexto |
| acesso no ritmo do host | pedido de pastas inteiro e depois lembrete (fora do Cowork) |
| extensao OpenAI | `extensions.com.openai` com hooks e onboarding, espelhada no overlay |
| regras sempre ativas | `rules/AGENTS.md` em sincronia com `lib/regras.mjs` (Antigravity) |
| guarda de varredura | busca no vault marca; fora do vault, nada (Codex, Antigravity) |
| artefato gerado | arquivo versionado igual ao que o build gera |

Por pacote também: skills canônicas no padrão Agent Skills, nenhum arquivo de host sem dono
no contrato, launcher do MCP respondendo pelo runtime, e o [mesmo contexto](paridade-e-limiar.md)
nos quatro hosts.

## Por que existe

Cada host lê arquivos próprios, e cada um pode quebrar sem sinal: o host instala, mas fica sem
MCP, sem bootstrap ou com versão errada. O contrato transforma isso em falha de build, com a
mensagem dizendo pacote, host e o que divergiu.

## Diagnóstico rápido

```
npm run check:harnesses
```
