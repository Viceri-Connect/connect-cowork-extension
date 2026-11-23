# Adicionar uma capacidade

Toda capacidade nova (hook, tool, skill, comportamento) precisa chegar aos quatro hosts, ou
declarar o limiar.

## Tool nova no MCP

1. Defina em `TOOLS` e trate em `handleToolCall` (`mcp/connect-mcp.mjs`), com a lógica em `lib/`.
2. Anote em `ANOTACOES` (leitura, escrita ou sobrescrita). Sem anotação, `mcp-anotacoes.test.mjs` falha.
3. Nunca exponha shell ou execução genérica ([fronteira de controle](../host-control-boundary.md)).

O MCP é o mesmo em todos os hosts: a tool aparece em todos sem passo extra.

## Evento de hook novo (em qualquer host)

1. Implemente o entrypoint em `hooks/` reaproveitando `lib/`, pelo runtime portátil.
2. Mapeie o evento em `EVENTOS_COBERTOS` (`tests/architecture/paridade.mjs`) para uma capacidade.
   Hook novo sem capacidade quebra o build.
3. Se o host tem o equivalente, implemente lá também; se não, declare o limiar.

## Mudança no que o hook injeta

Mude em `lib/render.mjs` ou `lib/bootstrap.mjs`, nunca num hook. Se o texto precisar ser
diferente por host, registre o bloco em `BLOCOS_POR_HOST`: o teste "mesmo contexto" compara os
quatro hosts e só tolera os blocos declarados.

## Skill nova ou alterada

1. `skills/<nome>/SKILL.md` com `name` igual à pasta e `description` de 1 a 1.024 caracteres
   (padrão Agent Skills; fora disso Codex, Copilot e Antigravity descartam a skill em silêncio).
2. Instrução que só existe num host (pasta conectada, ferramenta de agendamento) precisa trazer o
   equivalente dos outros. `tests/unit/skills-hosts.test.mjs` cobre as principais.
3. Siga o checklist de [`FRAMEWORK.md`](../../plugins/connect/FRAMEWORK.md) §6.

## Fechando

- Atualize a linha em `tests/architecture/paridade.mjs` e rode `npm run gerar:paridade`.
- Rode `npm test`.
