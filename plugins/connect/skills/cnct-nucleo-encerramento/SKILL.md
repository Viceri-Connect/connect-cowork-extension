---
name: cnct-nucleo-encerramento
description: >
  Encerra uma sessão de trabalho Connect consolidando tudo que precisa ser
  persistido — em TODOS os vaults tocados na sessão (matriz + qualquer
  sub-vault resolvido), nunca assumindo um único vault ativo. Use SEMPRE que o
  operador disser 'encerra sessão', 'fecha sessão', 'session close', 'consolida
  memória', 'persiste contexto', ou ao final de qualquer sessão de trabalho
  Connect.
metadata:
  version: "0.4.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
---

# cnct-nucleo-encerramento — encerramento de sessão multi-vault

Executor genérico (mecanismo, D96). Uma sessão Connect pode tocar mais de um vault (a
matriz + N sub-vaults resolvidos) — este executor nunca assume um único vault ativo.

## Protocolo

**Passo 1 — Enumerar vaults tocados.**
Chamar `list_mounts(workspace_dir)` — todo alias montado nesta sessão é candidato a
destino de conteúdo (`./matriz`, qualquer sub-vault resolvido via `resolver`). `./operador`
é destino **separado** (Passo 4, não é conteúdo de vault). `./pessoal`, quando presente, é
enriquecimento do operador — não recebe conteúdo de vault por este protocolo.

**Passo 2 — Varrer a conversa (fonte primária).**
Percorrer a sessão inteira identificando itens capturáveis (decisão, pendência, artefato
gerado, mudança de status, pessoa nova, skill criada/atualizada). Para **cada item**,
atribuir o **alias/vault a que ele pertence** — nunca depositar num vault por default
quando o item é de outro.

**Passo 3 — Persistir cada item de vault via `cnct-nucleo-escrita`.**
Para cada alias com itens atribuídos: invocar o protocolo `cnct-nucleo-escrita` passando
esse alias como vault alvo. Este executor **nunca escreve direto** em conteúdo de vault —
delega sempre.

**Passo 4 — Persistir estado do operador.**
Tasks pessoais (novas, concluídas, mudança de status) e delta de identidade vão em
`./operador/TASKS.md` e `./operador/_cerebro/meu-config.md` — **direto**, sem passar por
`cnct-nucleo-escrita` (não é conteúdo de vault, é estado gerido pelo Connect, D113). Se
`./operador` não estiver acessível ainda (Cowork não concedeu acesso à origem), solicitar
o acesso antes de escrever — nunca pular o passo silenciosamente.

**Passo 4b — Persistir o estado de CADA vínculo tocado (obrigatório, não opcional).**
Para **cada coletivo** que a sessão tocou (um por alias do Passo 1, exceto `./operador` e
`./pessoal`), atualizar `./operador/_cerebro/vinculos/{coletivo}/estado.md` — **o hot cache do
operador naquele coletivo**. Este passo existe porque a sua ausência foi medida: nenhum executor
escrevia nesse arquivo, e o `estado.md` do vínculo `mapfre` **nasceu vazio e permaneceu vazio**
enquanto o cérebro pessoal legado tinha a tabela cheia e fresca (P117).

Forma do arquivo — é **hot cache**, e a forma é o que o mantém útil:

- Uma linha por projeto/frente; **uma frase por célula**.
- **Substitui, nunca acrescenta.** Zero histórico, zero `✅ DD/MM`, zero narrativa. Não é log nem
  changelog: o que deixou de ser corrente **sai da linha**.
- A **fonte de verdade** é a nota do projeto no coletivo; aqui mora a **leitura do operador** sobre
  ela (ADR-14: fato → acervo; leitura/urgência/próximo passo → vínculo).
- Só entra alerta **cross-projeto** que muda o que o operador faz. Item de um projeto só vive na
  linha dele.
- `atualizado:` no frontmatter recebe a data da sessão.

**Não preencher por suposição.** Projeto que a sessão não tocou **não muda de linha** — repetir status
antigo como se fosse novo é pior que deixá-lo velho, porque apaga o sinal de que está velho. Se o dado
corrente não está na conversa, buscá-lo na nota do projeto no coletivo antes de escrever; não havendo
fonte, a célula fica declarada como *a reconciliar* — nunca inventada.

> **Vínculo tocado sem registro ainda** (`vinculos/{coletivo}/` inexistente): criar `estado.md` e
> `config.md` no schema vigente (`vinculos-v1`, CA6–CA9 da `CONNECT-E2-01`) e reportar ao operador.
> **Nunca** usar o schema antigo `_cerebro/clientes/{slug}/`.

**Passo 5 — Despromoção obrigatória, por vault, antes de acrescentar.**
Regra do contrato `cnct-nucleo-escrita` (matriz): identificar o que deixou de ser
corrente, confirmar que já existe na fonte, só então substituir. Nunca podar sem
confirmar duplicação.

**Passo 6 — Relatório final, por vault.**
```
## Encerramento — DD/MM/YYYY HH:mm

### Vaults tocados
- ./matriz: [N] itens persistidos
- {alias do sub-vault}: [N] itens persistidos

### Operador (./operador)
TASKS.md: [N] concluídas · [N] novas · [N] atualizadas
Vínculos atualizados: {coletivo} ([N] linhas substituídas · [N] a reconciliar) · …

### ⚠️ Para revisão manual (se houver)
- [itens sem vault claro, ou vault sem taxonomia — reportados na íntegra, nunca descartados]
```

**Passo 7 — Hooks de saída, por vault. Genérico: a lista é knowledge, nunca daqui.**

Este executor **não conhece hook nenhum**. Para cada vault do Passo 1, ler a seção
`## Hooks Registrados` do knowledge daquele vault
(`{alias}/_inteligencia/skills/cnct-nucleo-encerramento/cnct-nucleo-encerramento.md`) e
executar os hooks declarados lá, **na ordem em que aparecem**. Adicionar, alterar ou remover
hook é editar aquele knowledge — **sem reinstalar** este executor. Hook hardcoded aqui seria
conhecimento de coletivo dentro do produto (corte `_`/conteúdo, D96).

- **Vault sem a seção, ou sem knowledge:** zero hooks naquele vault. Não é lacuna — é o caso
  normal de um coletivo que não registrou nenhum. Seguir em silêncio.
- **Hook cuja skill de origem não está no coletivo:** registrar `não aplicável neste coletivo`
  e seguir. Nunca abortar o encerramento por hook ausente.
- **Hook falhou:** o item vai para `⚠️ Para revisão manual` do relatório, na íntegra. Falha de
  hook nunca engole o encerramento nem some do relatório.
- Cada hook declara no knowledge: condição de disparo · a qual MODO de qual skill delega · o
  que registrar no relatório. Este executor só orquestra e reporta.

> **Por que este passo existe.** Ele foi medido como **ausente** em 31/08: a arquitetura de
> hooks vivia no knowledge do `session-close` legado (Hook 1 `lei-do-bem`, Hook 2
> `elicitacao-captura`) e não sobreviveu à absorção pelo núcleo. Consequência: as duas skills
> seguiam instaladas esperando um hook que nenhum executor chamava — captura passiva de PD&I e
> de caso-zero **desligada em silêncio** desde então.

## Fora de escopo (não faz)

- Não gera nem altera artefatos de entrega (specs, discoveries) — isso acontece durante o
  trabalho, não no encerramento.
- Não cria conteúdo — se não está na conversa, não preenche.
- Idempotente — rodar duas vezes não duplica.
- **Nunca reescreve arquivo inteiro** — edita o mínimo necessário no destino.
- **Não commita, e não menciona commit.** Preparar e parar; a validação é do operador (D167).
- **Não atualiza `agents.md` de repositório nenhum.** Decisão técnica vai para a nota do
  projeto; `agents.md` só em sessão deliberada de refinamento técnico.
- **`TASKS.md` do operador não é `tasks.md` de Delivery Hub** — nomes parecidos, destinos
  distintos. Não confundir ao persistir o Passo 4.
