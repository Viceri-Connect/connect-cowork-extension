# Regras sempre ativas

As 5 **regras duras** do Connect (`plugins/connect/lib/regras.mjs`) são o único conteúdo cuja
ausência causa dano em vez de ignorância: um agente sem a carta navega mal e sabe disso; um
agente sem as regras contorna e não sabe.

## Onde elas chegam ao agente

| Canal | Hosts |
|---|---|
| Bloco injetado no início da sessão | Todos |
| `CLAUDE.md` de governança na raiz do vault | Cowork (entra sozinho pela pasta conectada); nos outros, o hook manda ler |
| `AGENTS.md` espelho na raiz do vault | Codex e Copilot, quando o vault é pasta aberta ou a sessão roda dentro dele |
| Regra sempre ativa do plugin | Antigravity (`rules/AGENTS.md`) e Copilot (`com.github.copilot/rules/connect.md`) |

## Por que Antigravity e Copilot têm um canal a mais

- **Antigravity:** o SessionStart roda uma vez por conversa, sem resume nem compact. Numa conversa
  longa, o bloco do início fica distante.
- **Copilot:** o `CLAUDE.md` de governança da matriz só entra sozinho no Cowork. No Copilot, o mesmo
  conteúdo (regras duras e "leia a carta `_cerebro/camada-1.md`") vai como regra do plugin, sem
  depender de pasta aberta.

## Por que o `AGENTS.md` é cópia, e não `@CLAUDE.md`

A importação por `@arquivo` só o Claude Code resolve, e nem ela chega pelo canal de pasta conectada
do Cowork: lá o `CLAUDE.md` entra literal. Um ponteiro faria o marcador `CNCT-GOV-*` sumir de um dos
lados. Por isso `lib/governanca.mjs` gera os dois arquivos com o mesmo texto, com as mesmas regras:
só escreve sobre arquivo com marcador do Connect, e só quando o texto muda.

## Uma fonte só

Todos os canais saem do mesmo texto. `rules/AGENTS.md` e `com.github.copilot/rules/connect.md` são
gerados por `npm run gerar:regras`, e o teste falha se divergirem de `lib/regras.mjs`.
