# Documentação do Connect (repositório)

Páginas curtas, uma por assunto. Comece pela visão geral.

## Arquitetura

| Página | O que explica |
|---|---|
| [Visão geral](arquitetura/visao-geral.md) | As peças (mecanismo, MCP, hooks, skills) e como se ligam |
| [Hosts e superfície](arquitetura/hosts.md) | Que arquivo cada host lê, por formato |
| [Bootstrap da sessão](arquitetura/bootstrap.md) | O que o hook injeta e como cada host recebe |
| [Runtime portátil](arquitetura/runtime-node.md) | Como tudo roda sem Node no PATH |
| [Pacotes e build](arquitetura/pacotes-e-build.md) | `connect`, `connect-http`, bundles e o que é gerado |
| [Testes](arquitetura/testes.md) | Camadas de teste, contrato de harness e CI |

## Conceitos

| Página | Em uma linha |
|---|---|
| [Harness](conceitos/harness.md) | Um host de agente que carrega o plugin |
| [Contrato de harness](conceitos/contrato-de-harness.md) | O que todo host precisa ter, verificado no build |
| [Paridade e limiar](conceitos/paridade-e-limiar.md) | Hosts são pares; diferença aceita é declarada |
| [Acesso no ritmo do host](conceitos/acesso-no-ritmo-do-host.md) | Quando o pedido de pastas vem inteiro ou como lembrete |
| [Guarda de varredura](conceitos/guarda-de-varredura.md) | A regra dura 4 aplicada antes da ferramenta rodar |
| [Regras sempre ativas](conceitos/regras-sempre-ativas.md) | Regras duras que valem a conversa inteira |
| [Anotações das tools](conceitos/anotacoes-mcp.md) | Leitura × escrita, para o host decidir a aprovação |

Os conceitos do **produto** (instância, matriz, sub-vault, operador, skills) vivem no pacote:
[`CONCEITOS.md`](../plugins/connect/CONCEITOS.md), [`FRAMEWORK.md`](../plugins/connect/FRAMEWORK.md) e
[`GLOSSARIO.md`](../plugins/connect/GLOSSARIO.md).

## Guias

| Página | Quando usar |
|---|---|
| [Adicionar um host](guias/adicionar-um-host.md) | Suportar um harness novo |
| [Adicionar uma capacidade](guias/adicionar-uma-capacidade.md) | Hook, tool ou skill nova sem quebrar a paridade |
| [Release](guias/release.md) | Subir versão e gerar os pacotes |
| [Teste em host real](guias/teste-em-host-real.md) | O roteiro do que o CI não prova |

## Referência e histórico

- [Paridade entre harnesses](paridade-harness.md) — tabela gerada, não edite à mão.
- [Fronteira de controle do host](host-control-boundary.md) — o que o MCP do Connect nunca expõe.
- [Plano: camada 1 pelo canal injetado](PLANO-camada-1-canal-injetado.md) e [notas do POC](POC-NOTES.md) — histórico.
