## Why

O Connect foi concebido para operar como um mecanismo de contexto e navegação para um ambiente específico do Claude Cowork. Isso trouxe um comportamento muito forte em governança, carregamento lazy e resolução de sub-vaults, mas também acoplou parte da arquitetura ao provedor Claude e ao seu marketplace/hooks. O objetivo desta mudança é manter o valor do mecanismo intacto e tornar a plataforma portável para outros ambientes, especialmente o GitHub Copilot e outros clientes de IA compatíveis com MCP ou integração local via extensão VS Code.

Sem essa portabilidade, o sistema fica preso a um provedor, gerando custo de onboarding, dependência de um ambiente específico e fragilidade quando o operador muda de stack. A mudança nasce para preservar a mesma governança de negócio, contexto de operador e resolução de conceito, mas com um contrato de adaptação multi-provider.

## What Changes

- Extrair o mecanismo de contexto e governança do provedor Claude para uma camada de abstração.
- Criar uma interface comum para providers (`claude`, `copilot`, `generic`) em torno de sessão, injeção de contexto e resolução de skills.
- Manter o núcleo do Connect funcional e provider-agnostic: resolver conceitos, montar sub-vaults, navegar pela matriz e proteger fronteiras.
- Dar suporte a um adapter local para o GitHub Copilot via VS Code e bridge HTTP/MCP.
- Tornar as skills mais portáveis, com manifestos declarativos e templates específicos por provider.
- Introduzir governança explícita (consentimento, limites de exposição e contexto por sessão) para qualquer provider.

## Capabilities

### New Capabilities
- `provider-abstraction`: define a interface comum de adaptadores para sessões, resolução de contexto e injeção de contexto entre ambientes de IA.
- `copilot-integration`: adapta o mecanismo de contexto para um fluxo local e portátil no GitHub Copilot / VS Code.
- `skill-portability`: torna as skills portáveis entre providers, com fontes, deltas e templates por ambiente.
- `context-governance`: governa o que pode ser injetado, quando e sob consentimento do operador.

### Modified Capabilities
- `session-context`: requisitos de contexto e sessão passam a ser provider-agnostic, sem depender de hooks específicos do Claude.
- `vault-resolution`: a resolução de matriz/sub-vault continua a mesma, mas passa a operar via provider-adapter e não por runtime exclusivo do Claude.

## Impact

- Repositório de plugin Connect: mudança na camada de bootstrap e proveniência do provider.
- Skills e templates do vault: ajuste de estrutura para manifestos e fontes/deltas multi-provider.
- Fluxo local em VS Code: novo adapter de injeção de contexto e bridge para leitura do MCP.
- Configuração e guardrails: nova camada de consentimento e exposição de memória/contexto por sessão.
- Dependências: foco em Node.js, MCP, VS Code extension APIs e contratos de sessão sem depender de marketplace do Claude.
