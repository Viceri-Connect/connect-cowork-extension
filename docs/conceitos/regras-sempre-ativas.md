# Regras sempre ativas

As 5 **regras duras** do Connect (`plugins/connect/lib/regras.mjs`) são o único conteúdo cuja
ausência causa dano em vez de ignorância: um agente sem a carta navega mal e sabe disso; um
agente sem as regras contorna e não sabe.

## Onde elas chegam ao agente

| Canal | Hosts |
|---|---|
| Bloco injetado no início da sessão | Todos |
| `CLAUDE.md` de governança da matriz | Cowork (entra sozinho pela pasta conectada); nos outros, o hook manda ler |
| Regra sempre ativa do plugin (`rules/AGENTS.md`) | Antigravity |

## Por que o Antigravity tem um canal a mais

O SessionStart do Antigravity roda uma vez por conversa, sem resume nem compact. Numa conversa
longa, o bloco do início fica distante. A regra sempre ativa entra em toda conversa com o plugin
ligado.

## Uma fonte só

Os três canais saem do mesmo texto. `rules/AGENTS.md` é gerado por `npm run gerar:regras`, e o
teste falha se ele divergir de `lib/regras.mjs`.
