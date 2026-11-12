# Harness

**Harness** (ou host) é o programa de agente que carrega o plugin do Connect e o põe para
trabalhar: injeta o contexto no início da sessão, sobe o servidor MCP e oferece as skills.

Hoje são quatro: **Claude/Cowork**, **Codex** (CLI e ChatGPT desktop), **Copilot** (VS Code e
Copilot CLI) e **Antigravity**.

## O que um harness dá ao Connect

| Recurso | Para quê |
|---|---|
| Hook de início de sessão | Injetar identidade, regras e ponteiros antes do 1º pedido |
| Servidor MCP | Expor as tools do Connect |
| Skills | Instruções que o agente carrega sob demanda |
| Hooks antes de ferramenta (quando há) | [Guarda de varredura](guarda-de-varredura.md) |
| Regras sempre ativas (quando há) | [Regras duras a conversa inteira](regras-sempre-ativas.md) |

## O que muda de um para outro

Só o formato: nome e local dos arquivos, variável de raiz, como executa o comando, formato da
resposta. A tabela completa está em [hosts e superfície](../arquitetura/hosts.md).

## Regra

Um harness nunca ganha lógica própria. Se algo precisa ser diferente por host, a diferença é
declarada como [limiar](paridade-e-limiar.md) e provada por teste.
